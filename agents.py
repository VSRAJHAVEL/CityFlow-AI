"""All agents + message bus for multi-agent traffic optimization."""
import numpy as np
from collections import defaultdict, deque
from typing import Optional
from sim import Simulation, GRID, DIRS, OPP

class MessageBus:
    def __init__(self):
        self.messages: dict = defaultdict(deque)
        self.event_log = deque(maxlen=80)

    def send(self, topic: str, msg: dict):
        self.messages[topic].append(msg)

    def log(self, text: str, sender: str = "System", agent_type: str = "system", tick: int = 0):
        self.event_log.append({
            "tick": tick,
            "sender": sender,
            "type": agent_type,
            "text": text
        })

    def recv(self, topic: str):
        msgs = list(self.messages[topic])
        self.messages[topic].clear()
        return msgs

    def clear(self):
        self.messages.clear()
        self.event_log.clear()


def discretize_queue(n: int) -> int:
    if n <= 1: return 0
    if n <= 3: return 1
    if n <= 6: return 2
    return 3


class IntersectionAgent:
    STATES = 4 ** 4 * 4  # 4 queue bins ^ 4 dirs * 4 neighbor congestion levels
    ACTIONS = 2  # 0=NS, 1=EW

    def __init__(self, r: int, c: int, lr: float = 0.1, gamma: float = 0.95, eps: float = 0.3):
        self.r, self.c = r, c
        self.lr, self.gamma, self.eps = lr, gamma, eps
        self.q_table = np.zeros((self.STATES, self.ACTIONS))
        self.prev_state = None
        self.prev_action = None
        self.min_green = 5
        self.green_bias = 0
        self.last_decision = "NS"
        self.last_reason = "Initialized"
        self.last_q_values = [0.0, 0.0]
        self.neighbor_load = 0

    def _state_index(self, ql, neighbor_load: int = 0) -> int:
        n, s, e, w = [discretize_queue(x) for x in ql]
        nc = min(neighbor_load // 4, 3)
        return ((n * 4 + s) * 4 + e) * 4 + w + nc * (4**4)

    def act(self, sim: Simulation, bus: MessageBus, rng: np.random.RandomState):
        inter = sim.intersections[self.r][self.c]
        if inter.forced_green is not None:
            self.last_decision = inter.forced_green
            self.last_reason = "Emergency Corridor Override"
            return
        ql = inter.queue_lengths()
        # get neighbor load
        neighbor_load = 0
        for msg in bus.recv(f"load_{self.r}_{self.c}"):
            neighbor_load += msg.get("load", 0)
        self.neighbor_load = neighbor_load
        state = self._state_index(ql, neighbor_load)
        reward = -sum(ql)
        if self.prev_state is not None:
            best_next = np.max(self.q_table[state])
            td = reward + self.gamma * best_next - self.q_table[self.prev_state, self.prev_action]
            self.q_table[self.prev_state, self.prev_action] += self.lr * td
        
        q_vals = [round(float(v), 3) for v in self.q_table[state]]
        self.last_q_values = q_vals

        if inter.phase_timer < self.min_green:
            action = 0 if inter.phase == "NS" else 1
            reason = f"Min-Green Lock ({self.min_green - inter.phase_timer}t remaining)"
        elif rng.random() < self.eps:
            action = rng.randint(2)
            reason = f"Exploration Random (ε={self.eps:.2f})"
        else:
            effective = self.q_table[state] + [0, self.green_bias]
            action = int(np.argmax(effective))
            diff = abs(q_vals[0] - q_vals[1])
            reason = f"Q-Policy Exploitation (ΔQ={diff:.2f})"

        decision = "NS" if action == 0 else "EW"
        self.last_decision = decision
        self.last_reason = reason
        inter.phase = decision
        if self.prev_action is not None and action != self.prev_action:
            inter.phase_timer = 0
        self.prev_state = state
        self.prev_action = action
        # broadcast load to neighbors
        total_load = sum(ql)
        for d, (dr, dc) in DIRS.items():
            nr, nc = self.r + dr, self.c + dc
            if 0 <= nr < GRID and 0 <= nc < GRID:
                bus.send(f"load_{nr}_{nc}", {"load": total_load})


class EmergencyAgent:
    def __init__(self):
        self.active_path = []
        self.ambulance = None
        self.forced_intersections = []
        self.last_action = "Standby (monitoring grid)"

    def spawn(self, sim: Simulation, bus: MessageBus, start=(0, 0), goal=(GRID-1, GRID-1)):
        self.release(sim)
        self.ambulance = sim.spawn_ambulance(start[0], start[1])
        self.active_path = self._bfs(sim, start, goal)
        self.ambulance.path = self.active_path
        self.last_action = f"Green corridor active: I{start}->I{goal}"
        bus.log(f"Priority corridor established: I{start} -> I{goal} ({len(self.active_path)} hops)", "Emergency", "emergency", sim.tick)
        if len(self.active_path) > 1:
            r1, c1 = self.active_path[0]
            r2, c2 = self.active_path[1]
            for d, (dr, dc) in DIRS.items():
                if (dr, dc) == (r2 - r1, c2 - c1):
                    self.ambulance.direction = d
                    for qd in list(sim.intersections[r1][c1].queues.keys()):
                        q = sim.intersections[r1][c1].queues[qd]
                        if self.ambulance in q:
                            q.remove(self.ambulance)
                    sim.intersections[r1][c1].queues[d].append(self.ambulance)
                    break
        self._force_green(sim)

    def _bfs(self, sim: Simulation, start, goal):
        from collections import deque as dq
        visited = {start}
        queue = dq([(start, [start])])
        while queue:
            (r, c), path = queue.popleft()
            if (r, c) == goal:
                return path
            for d, (dr, dc) in DIRS.items():
                nr, nc = r + dr, c + dc
                if 0 <= nr < GRID and 0 <= nc < GRID and (nr, nc) not in visited:
                    if (r, c, d) not in sim.blocked_segments:
                        visited.add((nr, nc))
                        queue.append(((nr, nc), path + [(nr, nc)]))
        return [start, goal]

    def _force_green(self, sim: Simulation):
        self.release(sim)
        for i in range(len(self.active_path) - 1):
            r1, c1 = self.active_path[i]
            r2, c2 = self.active_path[i + 1]
            dr, dc = r2 - r1, c2 - c1
            for d, (ddr, ddc) in DIRS.items():
                if (ddr, ddc) == (dr, dc):
                    sim.intersections[r1][c1].forced_green = d
                    self.forced_intersections.append((r1, c1))
                    break

    def release(self, sim: Simulation):
        for r, c in self.forced_intersections:
            sim.intersections[r][c].forced_green = None
        self.forced_intersections.clear()

    def update(self, sim: Simulation, bus: Optional[MessageBus] = None):
        if not self.ambulance:
            return
        found = False
        for r in range(GRID):
            for c in range(GRID):
                for q in sim.intersections[r][c].queues.values():
                    if any(car.id == self.ambulance.id for car in q):
                        found = True
                        break
        if not found:
            self.release(sim)
            self.ambulance = None
            self.active_path = []
            self.last_action = "Corridor completed & released"
            if bus:
                bus.log("Emergency unit reached destination; corridor released to local Q-agents", "Emergency", "emergency", sim.tick)


class IncidentAgent:
    def __init__(self):
        self.incidents = []
        self.last_action = "Monitoring city arterial roads"

    def maybe_spawn(self, sim: Simulation, bus: MessageBus, rng: np.random.RandomState):
        if rng.random() < 0.003 and len(self.incidents) < 2:
            r, c = rng.randint(GRID), rng.randint(GRID)
            d = rng.choice(list(DIRS.keys()))
            sim.block_segment(r, c, d)
            self.incidents.append((r, c, d, sim.tick))
            self.last_action = f"Dispatched barrier to road ({r},{c},{d})"
            bus.send("incident", {"r": r, "c": c, "d": d, "action": "block"})
            bus.log(f"Accident reported on road ({r},{c},{d}): barricade deployed", "Incident", "incident", sim.tick)

    def cleanup(self, sim: Simulation, bus: Optional[MessageBus] = None, duration: int = 100):
        now = sim.tick
        remaining = []
        for r, c, d, t in self.incidents:
            if now - t > duration:
                sim.unblock_segment(r, c, d)
                self.last_action = f"Cleared road ({r},{c},{d})"
                if bus:
                    bus.log(f"Accident cleared on road ({r},{c},{d}): reopened traffic flow", "Incident", "incident", sim.tick)
            else:
                remaining.append((r, c, d, t))
        self.incidents = remaining


class CoordinatorAgent:
    def __init__(self):
        self.last_check = 0
        self.check_interval = 40
        self.last_action = "Monitoring network macro-flow"

    def llm_decide(self, metrics: dict) -> dict:
        return {}

    def update(self, sim: Simulation, agents: list, bus: MessageBus):
        if sim.tick - self.last_check < self.check_interval:
            return
        self.last_check = sim.tick
        metrics = {"tick": sim.tick, "avg_wait": sim.avg_wait(), "throughput": sim.throughput()}
        hotspots = []
        for r in range(GRID):
            for c in range(GRID):
                ql = sim.intersections[r][c].queue_lengths()
                if max(ql) > 6:
                    hotspots.append((r, c, max(ql)))
        metrics["hotspots"] = hotspots

        if sim.avg_wait() > 10:
            for a in agents:
                a.eps = max(0.02, a.eps * 0.95)
            self.last_action = "Tuned exploration epsilon for network stability"
            bus.log("Network wait elevated: dampened agent exploration rate", "Coordinator", "coordinator", sim.tick)

        for r, c, load in hotspots:
            for a in agents:
                if a.r == r and a.c == c:
                    ns = sum(sim.intersections[r][c].queue_lengths()[:2])
                    ew = sum(sim.intersections[r][c].queue_lengths()[2:])
                    a.green_bias = 0.5 if ew > ns else -0.5
                    self.last_action = f"Rebalanced green bias at hotspot I({r},{c})"
                    bus.log(f"Hotspot alert at I({r},{c}) (queue {load}): injected green bias", "Coordinator", "coordinator", sim.tick)
        metrics["hotspots"] = hotspots
        llm_adj = self.llm_decide(metrics)
        # rule-based adjustments
        if sim.avg_wait() > 10:
            for a in agents:
                a.eps = max(0.05, a.eps * 0.95)
        for r, c, load in hotspots:
            for a in agents:
                if a.r == r and a.c == c:
                    ns = sum(sim.intersections[r][c].queue_lengths()[:2])
                    ew = sum(sim.intersections[r][c].queue_lengths()[2:])
                    a.green_bias = 0.5 if ew > ns else -0.5
        # handle incidents - reroute
        for msg in bus.recv("incident"):
            pass  # cars already avoid blocked segments in sim._pick_dir


class AgentSystem:
    def __init__(self, sim: Simulation, use_agents: bool = True):
        self.sim = sim
        self.bus = MessageBus()
        self.use_agents = use_agents
        self.intersection_agents = [
            IntersectionAgent(r, c) for r in range(GRID) for c in range(GRID)
        ]
        self.emergency = EmergencyAgent()
        self.incident = IncidentAgent()
        self.coordinator = CoordinatorAgent()
        self.fixed_timer = 15
        self.fixed_count = 0

    def load_qtables(self, data: np.ndarray):
        for i, agent in enumerate(self.intersection_agents):
            agent.q_table = data[i].copy()

    def save_qtables(self) -> np.ndarray:
        return np.array([a.q_table for a in self.intersection_agents])

    def step(self):
        if self.use_agents:
            for agent in self.intersection_agents:
                agent.act(self.sim, self.bus, self.sim.rng)
            self.emergency.update(self.sim, self.bus)
            self.incident.maybe_spawn(self.sim, self.bus, self.sim.rng)
            self.incident.cleanup(self.sim, self.bus)
            self.coordinator.update(self.sim, self.intersection_agents, self.bus)
        else:
            self.fixed_count += 1
            if self.fixed_count >= self.fixed_timer:
                self.fixed_count = 0
                for r in range(GRID):
                    for c in range(GRID):
                        inter = self.sim.intersections[r][c]
                        inter.phase = "EW" if inter.phase == "NS" else "NS"
                        inter.phase_timer = 0
            self.emergency.update(self.sim, self.bus)
            self.incident.cleanup(self.sim, self.bus)
        self.sim.step()
