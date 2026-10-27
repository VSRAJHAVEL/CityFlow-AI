"""4x4 grid city traffic simulation."""
import numpy as np
from dataclasses import dataclass, field
from typing import List, Dict, Tuple, Optional

GRID = 4
DIRS = {"N": (-1, 0), "S": (1, 0), "E": (0, 1), "W": (0, -1)}
OPP = {"N": "S", "S": "N", "E": "W", "W": "E"}

@dataclass
class Car:
    id: int
    r: int
    c: int
    direction: str
    wait: int = 0
    entered_tick: int = 0
    is_ambulance: bool = False
    path: list = field(default_factory=list)

class Intersection:
    def __init__(self, r: int, c: int):
        self.r, self.c = r, c
        self.phase = "NS"  # "NS" or "EW"
        self.phase_timer = 0
        self.queues: Dict[str, List[Car]] = {"N": [], "S": [], "E": [], "W": []}
        self.forced_green: Optional[str] = None
        self.blocked_dirs: set = set()

    def queue_lengths(self) -> Tuple[int, int, int, int]:
        return tuple(len(self.queues[d]) for d in ("N", "S", "E", "W"))

class Simulation:
    def __init__(self, seed: int = 42):
        self.rng = np.random.RandomState(seed)
        self.tick = 0
        self.car_id = 0
        self.intersections = [[Intersection(r, c) for c in range(GRID)] for r in range(GRID)]
        self.completed: List[Car] = []
        self.blocked_segments: set = set()  # (r,c,dir)
        self.all_waits: List[int] = []
        self.ambulance_times: List[int] = []
        self.density_mult: float = 1.0
        for row in self.intersections:
            for inter in row:
                inter.wait_history = []

    def get_inter(self, r, c) -> Optional[Intersection]:
        if 0 <= r < GRID and 0 <= c < GRID:
            return self.intersections[r][c]
        return None

    def _spawn_rate(self) -> float:
        cycle = self.tick % 500
        base = 0.35 if 100 < cycle < 250 else 0.12
        return min(0.95, base * self.density_mult)

    def spawn_cars(self):
        rate = self._spawn_rate()
        for r in range(GRID):
            for c in range(GRID):
                if self.rng.random() < rate:
                    d = self.rng.choice(list(DIRS.keys()))
                    car = Car(id=self.car_id, r=r, c=c, direction=d, entered_tick=self.tick)
                    self.car_id += 1
                    self.intersections[r][c].queues[d].append(car)

    def spawn_ambulance(self, r: int = 0, c: int = 0, direction: str = "S") -> Car:
        car = Car(id=self.car_id, r=r, c=c, direction=direction, entered_tick=self.tick, is_ambulance=True)
        self.car_id += 1
        self.intersections[r][c].queues[direction].append(car)
        return car

    def block_segment(self, r, c, d):
        self.blocked_segments.add((r, c, d))

    def unblock_segment(self, r, c, d):
        self.blocked_segments.discard((r, c, d))

    def step(self):
        self.spawn_cars()
        for r in range(GRID):
            for c in range(GRID):
                inter = self.intersections[r][c]
                green_dirs = self._green_dirs(inter)
                for d in list(DIRS.keys()):
                    if not inter.queues[d]:
                        continue
                    if d not in green_dirs:
                        for car in inter.queues[d]:
                            car.wait += 1
                        continue
                    if (r, c, d) in self.blocked_segments:
                        for car in inter.queues[d]:
                            car.wait += 1
                        continue
                    car = inter.queues[d][0]
                    dr, dc = DIRS[d]
                    nr, nc = r + dr, c + dc
                    nxt = self.get_inter(nr, nc)
                    if nxt is not None:
                        inter.queues[d].pop(0)
                        new_d = self._pick_dir(car, nr, nc)
                        car.r, car.c, car.direction = nr, nc, new_d
                        nxt.queues[new_d].append(car)
                    else:
                        inter.queues[d].pop(0)
                        self.all_waits.append(car.wait)
                        if car.is_ambulance:
                            self.ambulance_times.append(self.tick - car.entered_tick)
                        self.completed.append(car)
                    for remaining in inter.queues[d]:
                        remaining.wait += 1
                inter.phase_timer += 1
                # record intersection wait history
                avg_q_wait = (sum(c.wait for q in inter.queues.values() for c in q) / max(1, sum(len(q) for q in inter.queues.values())))
                inter.wait_history.append(round(avg_q_wait, 1))
                if len(inter.wait_history) > 30:
                    inter.wait_history.pop(0)
        self.tick += 1

    def _green_dirs(self, inter: Intersection) -> set:
        if inter.forced_green:
            return {inter.forced_green, OPP.get(inter.forced_green, inter.forced_green)}
        if inter.phase == "NS":
            return {"N", "S"}
        return {"E", "W"}

    def _pick_dir(self, car: Car, r: int, c: int) -> str:
        if car.is_ambulance and car.path:
            # find next step in path
            for i, (pr, pc) in enumerate(car.path):
                if (pr, pc) == (r, c) and i + 1 < len(car.path):
                    nr2, nc2 = car.path[i + 1]
                    dr2, dc2 = nr2 - r, nc2 - c
                    for d, (ddr, ddc) in DIRS.items():
                        if (ddr, ddc) == (dr2, dc2):
                            return d
            return car.direction
        choices = []
        for d, (dr, dc) in DIRS.items():
            if (r, c, d) not in self.blocked_segments:
                choices.append(d)
        if not choices:
            choices = list(DIRS.keys())
        if car.direction in choices and self.rng.random() < 0.6:
            return car.direction
        return self.rng.choice(choices)

    def avg_wait(self) -> float:
        if not self.all_waits:
            return 0.0
        return float(np.mean(self.all_waits[-500:]))

    def throughput(self) -> int:
        return len(self.completed)

    def avg_stops(self) -> float:
        if not self.completed:
            return 1.2
        sample = self.completed[-300:]
        stops = [min(4, max(1, c.wait // 4)) if c.wait > 0 else 0 for c in sample]
        return round(float(np.mean(stops)), 2)

    def snapshot(self) -> dict:
        cars = []
        for r in range(GRID):
            for c in range(GRID):
                inter = self.intersections[r][c]
                for d, q in inter.queues.items():
                    for car in q:
                        dr, dc = DIRS[d]
                        nr, nc = r + dr, c + dc
                        dest_str = f"I({nr},{nc})" if 0 <= nr < GRID and 0 <= nc < GRID else "Exit Grid"
                        cars.append({
                            "id": car.id,
                            "r": r, "c": c, "d": d,
                            "amb": car.is_ambulance,
                            "w": car.wait,
                            "dest": dest_str
                        })
        signals = []
        for r in range(GRID):
            for c in range(GRID):
                inter = self.intersections[r][c]
                signals.append({"r": r, "c": c, "phase": inter.phase,
                                "timer": inter.phase_timer,
                                "forced": inter.forced_green})
        blocked = [{"r": b[0], "c": b[1], "d": b[2]} for b in self.blocked_segments]
        return {"tick": self.tick, "cars": cars, "signals": signals, "blocked": blocked,
                "avg_wait": round(self.avg_wait(), 2), "throughput": self.throughput(),
                "amb_times": self.ambulance_times[-5:]}
