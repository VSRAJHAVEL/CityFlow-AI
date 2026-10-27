"""Headless training: 200 episodes, save Q-tables, print comparison."""
import numpy as np
from sim import Simulation
from agents import AgentSystem

EPISODES = 200
TICKS_PER_EP = 500

def run_episode(seed, use_agents, qtables=None):
    sim = Simulation(seed=seed)
    system = AgentSystem(sim, use_agents=use_agents)
    if qtables is not None and use_agents:
        system.load_qtables(qtables)
    for _ in range(TICKS_PER_EP):
        system.step()
    # spawn an ambulance mid-episode for timing
    sim2 = Simulation(seed=seed)
    sys2 = AgentSystem(sim2, use_agents=use_agents)
    if qtables is not None and use_agents:
        sys2.load_qtables(qtables)
    for t in range(TICKS_PER_EP):
        if t == 200:
            sys2.emergency.spawn(sim2, sys2.bus)
        sys2.step()
    amb_time = sim2.ambulance_times[0] if sim2.ambulance_times else 999
    return sim.avg_wait(), sim.throughput(), amb_time, system.save_qtables()

def main():
    print("Training multi-agent system (200 episodes)...")
    qtables = None
    for ep in range(EPISODES):
        seed = 42 + ep
        avg_w, thru, amb, qtables = run_episode(seed, use_agents=True, qtables=qtables)
        # decay exploration
        if ep % 20 == 0:
            print(f"  Episode {ep:3d}: avg_wait={avg_w:.2f}  throughput={thru}")

    np.save("qtable.npy", qtables)
    print("Q-tables saved to qtable.npy\n")

    # Final comparison on 10 test seeds
    print("=" * 60)
    print(f"{'Metric':<25} {'Multi-Agent':>15} {'Fixed Timer':>15}")
    print("=" * 60)
    agent_waits, base_waits = [], []
    agent_thrus, base_thrus = [], []
    agent_ambs, base_ambs = [], []
    for seed in range(1000, 1010):
        aw, at, aa, _ = run_episode(seed, True, qtables)
        bw, bt, ba, _ = run_episode(seed, False)
        agent_waits.append(aw); base_waits.append(bw)
        agent_thrus.append(at); base_thrus.append(bt)
        agent_ambs.append(aa); base_ambs.append(ba)

    print(f"{'Avg Wait (ticks)':<25} {np.mean(agent_waits):>15.2f} {np.mean(base_waits):>15.2f}")
    print(f"{'Throughput (cars)':<25} {np.mean(agent_thrus):>15.0f} {np.mean(base_thrus):>15.0f}")
    print(f"{'Ambulance Time (ticks)':<25} {np.mean(agent_ambs):>15.1f} {np.mean(base_ambs):>15.1f}")
    print("=" * 60)
    improvement = (1 - np.mean(agent_waits)/np.mean(base_waits)) * 100
    print(f"Wait time improvement: {improvement:.1f}%")

if __name__ == "__main__":
    main()
