"""FastAPI server with background simulation loop and Stage 3 transparency endpoints."""
import asyncio, json, io, csv
from pathlib import Path
from fastapi import FastAPI
from fastapi.responses import HTMLResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from sim import Simulation, GRID, DIRS
from agents import AgentSystem
import numpy as np

app = FastAPI()
QTABLE_PATH = Path("qtable.npy")

sim = Simulation(seed=100)
system = AgentSystem(sim, use_agents=True)
if QTABLE_PATH.exists():
    system.load_qtables(np.load(str(QTABLE_PATH)))
    for a in system.intersection_agents:
        a.eps = 0.05

state = {
    "paused": False,
    "running": True,
    "speed": 1.0,
    "wait_history_agent": [],
    "wait_history_baseline": [],
    "throughput_history_agent": [],
    "throughput_history_baseline": [],
    "telemetry_records": []
}

# run parallel baseline sim
baseline_sim = Simulation(seed=100)
baseline_system = AgentSystem(baseline_sim, use_agents=False)


async def tick_loop():
    while state["running"]:
        if not state["paused"]:
            system.step()
            baseline_system.step()
            if sim.tick % 10 == 0:
                wa = round(sim.avg_wait(), 2)
                wb = round(baseline_sim.avg_wait(), 2)
                ta = sim.throughput()
                tb = baseline_sim.throughput()
                state["wait_history_agent"].append(wa)
                state["wait_history_baseline"].append(wb)
                state["throughput_history_agent"].append(ta)
                state["throughput_history_baseline"].append(tb)

                agent_cars_cnt = sum(len(q) for row in sim.intersections for inter in row for q in inter.queues.values())
                base_cars_cnt = sum(len(q) for row in baseline_sim.intersections for inter in row for q in inter.queues.values())
                emerg = 1 if any(car.is_ambulance for row in sim.intersections for inter in row for q in inter.queues.values() for car in q) else 0

                # Store real-tick telemetry records for accurate CSV export
                state["telemetry_records"].append({
                    "tick": sim.tick,
                    "time_sec": round(sim.tick * 0.1, 1),
                    "agent_wait": wa,
                    "baseline_wait": wb,
                    "agent_throughput": ta,
                    "baseline_throughput": tb,
                    "agent_cars": agent_cars_cnt,
                    "baseline_cars": base_cars_cnt,
                    "emergency": emerg,
                    "incidents": len(sim.blocked_segments)
                })
                if len(state["telemetry_records"]) > 1000:
                    state["telemetry_records"] = state["telemetry_records"][-1000:]

                if len(state["wait_history_agent"]) > 300:
                    state["wait_history_agent"] = state["wait_history_agent"][-300:]
                    state["wait_history_baseline"] = state["wait_history_baseline"][-300:]
                    state["throughput_history_agent"] = state["throughput_history_agent"][-300:]
                    state["throughput_history_baseline"] = state["throughput_history_baseline"][-300:]
        sleep_time = max(0.003, 0.016 / max(0.1, state["speed"]))
        await asyncio.sleep(sleep_time)


@app.on_event("startup")
async def startup():
    asyncio.create_task(tick_loop())

STATIC_DIR = Path("static")
MODERN_DIR = STATIC_DIR / "modern"
CLASSIC_DIR = STATIC_DIR / "classic"

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@app.get("/", response_class=HTMLResponse)
@app.get("/modern", response_class=HTMLResponse)
@app.get("/dashboard", response_class=HTMLResponse)
async def modern_dashboard():
    target = MODERN_DIR / "index.html"
    if target.exists():
        return target.read_text(encoding="utf-8")
    legacy = Path("stitch_modern_frontend_dashboard/code.html")
    if legacy.exists():
        return legacy.read_text(encoding="utf-8")
    return HTMLResponse("<h1>Modern Dashboard not found</h1>", status_code=404)


@app.get("/classic", response_class=HTMLResponse)
async def classic_dashboard():
    target = CLASSIC_DIR / "index.html"
    if target.exists():
        return target.read_text(encoding="utf-8")
    legacy = STATIC_DIR / "index.html"
    if legacy.exists():
        return legacy.read_text(encoding="utf-8")
    return HTMLResponse("<h1>Classic Dashboard not found</h1>", status_code=404)


@app.get("/modern_app.js")
@app.get("/modern-app.js")
@app.get("/modern-static/modern_app.js")
async def get_modern_app_js():
    target = MODERN_DIR / "app.js"
    if target.exists():
        return Response(content=target.read_text(encoding="utf-8"), media_type="application/javascript")
    legacy = Path("stitch_modern_frontend_dashboard/modern_app.js")
    if legacy.exists():
        return Response(content=legacy.read_text(encoding="utf-8"), media_type="application/javascript")
    return Response(status_code=404)


@app.get("/bg-dark.png")
@app.get("/modern-static/bg-dark.png")
@app.get("/static/bg-dark.png")
async def get_bg_dark():
    from fastapi.responses import FileResponse
    target = MODERN_DIR / "bg-dark.png"
    if target.exists():
        return FileResponse(target, media_type="image/png")
    return Response(status_code=404)


@app.get("/bg-light.png")
@app.get("/modern-static/bg-light.png")
@app.get("/static/bg-light.png")
async def get_bg_light():
    from fastapi.responses import FileResponse
    target = MODERN_DIR / "bg-light.png"
    if target.exists():
        return FileResponse(target, media_type="image/png")
    return Response(status_code=404)


@app.get("/state")
async def get_state():
    snap = sim.snapshot()
    snap["wait_agent"] = state["wait_history_agent"][-300:]
    snap["wait_baseline"] = state["wait_history_baseline"][-300:]
    snap["throughput_agent"] = state["throughput_history_agent"][-300:]
    snap["throughput_baseline"] = state["throughput_history_baseline"][-300:]
    snap["use_agents"] = system.use_agents
    snap["paused"] = state["paused"]
    snap["speed"] = state["speed"]
    snap["density"] = sim.density_mult
    snap["eps"] = system.intersection_agents[0].eps if system.intersection_agents else 0.05

    # Parallel baseline snapshot for Split-screen compare mode
    base_snap = baseline_sim.snapshot()
    snap["baseline"] = {
        "cars": base_snap["cars"],
        "signals": base_snap["signals"],
        "blocked": base_snap["blocked"],
        "avg_wait": base_snap["avg_wait"],
        "throughput": base_snap["throughput"]
    }

    # Per-intersection congestion loads (16 nodes)
    snap["agent_intersection_loads"] = [
        sum(len(q) for q in inter.queues.values()) for row in sim.intersections for inter in row
    ]
    snap["baseline_intersection_loads"] = [
        sum(len(q) for q in inter.queues.values()) for row in baseline_sim.intersections for inter in row
    ]

    # Extended KPIs
    b_wait = baseline_sim.avg_wait()
    a_wait = sim.avg_wait()
    diff_wait = max(0.0, b_wait - a_wait)
    thru = sim.throughput()
    co2_saved = round(diff_wait * thru * 0.0022, 2)
    fuel_saved = round(co2_saved * 0.42, 2)

    snap["avg_stops"] = sim.avg_stops()
    snap["baseline_avg_stops"] = baseline_sim.avg_stops()
    snap["co2_saved_kg"] = co2_saved
    snap["fuel_saved_l"] = fuel_saved

    # Agent Status Hierarchy Cards
    snap["agents_status"] = {
        "coordinator": {
            "state": "Active (Macro-Control)",
            "action": system.coordinator.last_action
        },
        "emergency": {
            "state": "Active Corridor" if system.emergency.ambulance else "Standby (Clear)",
            "action": system.emergency.last_action
        },
        "incident": {
            "state": f"{len(system.incident.incidents)} Active Hazard(s)" if system.incident.incidents else "Standby (Zero Hazards)",
            "action": system.incident.last_action
        }
    }
    return JSONResponse(snap)


@app.get("/metrics")
async def metrics():
    b_wait = baseline_sim.avg_wait()
    a_wait = sim.avg_wait()
    diff_wait = max(0.0, b_wait - a_wait)
    thru = sim.throughput()
    co2_saved = round(diff_wait * thru * 0.0022, 2)
    fuel_saved = round(co2_saved * 0.42, 2)

    return {
        "tick": sim.tick,
        "avg_wait": a_wait,
        "throughput": thru,
        "baseline_avg_wait": b_wait,
        "baseline_throughput": baseline_sim.throughput(),
        "amb_times": sim.ambulance_times[-5:],
        "avg_stops": sim.avg_stops(),
        "baseline_avg_stops": baseline_sim.avg_stops(),
        "co2_saved_kg": co2_saved,
        "fuel_saved_l": fuel_saved,
        "use_agents": system.use_agents
    }


@app.get("/messages")
async def get_messages():
    """Live Agent Message Feed."""
    return JSONResponse(list(system.bus.event_log))


EXPORT_FILE = Path("static/exports/cityflow_traffic_telemetry.csv")
EXPORT_FILE.parent.mkdir(parents=True, exist_ok=True)


@app.get("/export/csv")
async def export_csv():
    """Export clean, high-fidelity simulation telemetry as a physical RFC 4180 CSV with UTF-8 BOM via FileResponse."""
    from fastapi.responses import FileResponse
    records = state.get("telemetry_records", [])

    # If simulation just started, build records from current state so file is never blank
    if not records:
        curr_tick = max(10, sim.tick)
        wa = round(sim.avg_wait(), 2)
        wb = round(baseline_sim.avg_wait(), 2)
        ta = sim.throughput()
        tb = baseline_sim.throughput()
        agent_cars_cnt = sum(len(q) for row in sim.intersections for inter in row for q in inter.queues.values())
        base_cars_cnt = sum(len(q) for row in baseline_sim.intersections for inter in row for q in inter.queues.values())
        emerg = 1 if any(car.is_ambulance for row in sim.intersections for inter in row for q in inter.queues.values() for car in q) else 0
        records = [{
            "tick": curr_tick,
            "time_sec": round(curr_tick * 0.1, 1),
            "agent_wait": wa,
            "baseline_wait": wb,
            "agent_throughput": ta,
            "baseline_throughput": tb,
            "agent_cars": agent_cars_cnt,
            "baseline_cars": base_cars_cnt,
            "emergency": emerg,
            "incidents": len(sim.blocked_segments)
        }]

    # Write directly to disk with UTF-8 BOM encoding for guaranteed Windows Excel compatibility
    with open(EXPORT_FILE, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f, lineterminator="\r\n")
        # RFC 4180 Standard Header with clear, human-readable column titles
        writer.writerow([
            "Sample_ID",
            "Simulation_Tick",
            "Elapsed_Seconds",
            "Agent_Avg_Wait_Ticks",
            "Baseline_Avg_Wait_Ticks",
            "Wait_Reduction_Ticks",
            "Improvement_Percentage",
            "Agent_Cumulative_Throughput",
            "Baseline_Cumulative_Throughput",
            "Throughput_Gain_Vehicles",
            "Active_Vehicles_Agent",
            "Active_Vehicles_Baseline",
            "Emergency_Preemption_Active",
            "Active_Incidents_Count",
            "Estimated_CO2_Saved_Kg"
        ])

        for idx, r in enumerate(records, 1):
            tick = r["tick"]
            sec = r["time_sec"]
            wa = r["agent_wait"]
            wb = r["baseline_wait"]
            reduction = round(max(0.0, wb - wa), 2)
            pct = round(((wb - wa) / max(0.01, wb)) * 100, 2) if wb > 0 else 0.0
            ta = r["agent_throughput"]
            tb = r["baseline_throughput"]
            gain = max(0, ta - tb)
            cars_a = r["agent_cars"]
            cars_b = r["baseline_cars"]
            emerg = "YES" if r["emergency"] else "NO"
            inc = r["incidents"]
            co2 = round(reduction * min(cars_a, max(1, ta)) * 0.00045, 2)

            writer.writerow([
                idx, tick, sec, wa, wb, reduction, f"{pct}%", ta, tb, gain,
                cars_a, cars_b, emerg, inc, co2
            ])

    return FileResponse(
        path=str(EXPORT_FILE),
        media_type="text/csv; charset=utf-8",
        filename="cityflow_traffic_telemetry.csv",
        headers={
            "Content-Disposition": 'attachment; filename="cityflow_traffic_telemetry.csv"',
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
        }
    )


@app.get("/inspect/{node_id}")
async def inspect_node(node_id: str):
    """Return detailed Agent Inspector metrics for an intersection."""
    parts = node_id.replace("-", "_").split("_")
    r, c = int(parts[0]), int(parts[1])
    inter = sim.get_inter(r, c)
    if not inter:
        return JSONResponse({"error": "not found"}, status_code=404)
    
    agent = None
    for a in system.intersection_agents:
        if a.r == r and a.c == c:
            agent = a
            break

    q_dict = {d: len(inter.queues[d]) for d in ("N", "S", "E", "W")}
    resp = {
        "r": r,
        "c": c,
        "queues": q_dict,
        "phase": inter.phase,
        "phase_timer": inter.phase_timer,
        "min_green": agent.min_green if agent else 5,
        "forced_green": inter.forced_green,
        "q_values": agent.last_q_values if agent else [0.0, 0.0],
        "decision": agent.last_decision if agent else inter.phase,
        "reason": agent.last_reason if agent else "Fixed cycle",
        "neighbor_load": agent.neighbor_load if agent else 0,
        "wait_history": getattr(inter, "wait_history", [])[-25:],
        "blocked_dirs": [d for d in ("N", "S", "E", "W") if (r, c, d) in sim.blocked_segments]
    }
    return JSONResponse(resp)


@app.post("/control")
async def control(body: dict):
    global sim, system, baseline_sim, baseline_system
    action = body.get("action", "")
    if action == "pause":
        state["paused"] = not state["paused"]
    elif action == "step":
        system.step()
        baseline_system.step()
    elif action == "reset":
        sim = Simulation(seed=100)
        system = AgentSystem(sim, use_agents=True)
        if QTABLE_PATH.exists():
            system.load_qtables(np.load(str(QTABLE_PATH)))
            for a in system.intersection_agents:
                a.eps = 0.05
        baseline_sim = Simulation(seed=100)
        baseline_system = AgentSystem(baseline_sim, use_agents=False)
        state["wait_history_agent"].clear()
        state["wait_history_baseline"].clear()
        state["throughput_history_agent"].clear()
        state["throughput_history_baseline"].clear()
        system.bus.clear()
        system.bus.log("Simulation and agent tables reset to initial state", "System", "system", sim.tick)
    elif action in ("spawn_emergency", "emergency"):
        start = tuple(body.get("start", [0, 0]))
        goal = tuple(body.get("goal", [GRID - 1, GRID - 1]))
        system.emergency.spawn(sim, system.bus, start=start, goal=goal)
    elif action in ("spawn_incident", "incident"):
        r = body.get("r", int(sim.rng.randint(4)))
        c = body.get("c", int(sim.rng.randint(4)))
        d = body.get("d", str(sim.rng.choice(["N", "S", "E", "W"])))
        sim.block_segment(r, c, d)
        system.incident.incidents.append((r, c, d, sim.tick))
        system.bus.log(f"Manual incident created on segment ({r},{c},{d})", "Operator", "incident", sim.tick)
    elif action in ("toggle_road_block", "toggle_block"):
        r, c, d = int(body["r"]), int(body["c"]), str(body["d"])
        if (r, c, d) in sim.blocked_segments:
            sim.unblock_segment(r, c, d)
            system.incident.incidents = [inc for inc in system.incident.incidents if not (inc[0] == r and inc[1] == c and inc[2] == d)]
            system.bus.log(f"Operator unblocked road segment ({r},{c},{d})", "Operator", "incident", sim.tick)
        else:
            sim.block_segment(r, c, d)
            system.incident.incidents.append((r, c, d, sim.tick))
            system.bus.log(f"Operator manually blocked road segment ({r},{c},{d})", "Operator", "incident", sim.tick)
    elif action in ("clear_incidents", "clear_all_incidents"):
        sim.blocked_segments.clear()
        system.incident.incidents.clear()
        system.bus.log("Operator cleared all active road barricades and hazards", "Operator", "incident", sim.tick)
    elif action in ("toggle_baseline", "toggle_mode"):
        system.use_agents = not system.use_agents
        mode_str = "Multi-Agent Q-Net" if system.use_agents else "Fixed Cycle Timer"
        system.bus.log(f"Control mode switched to {mode_str}", "Operator", "system", sim.tick)
    elif action in ("set_mode", "mode"):
        if "use_agents" in body:
            system.use_agents = bool(body["use_agents"])
        elif "mode" in body:
            system.use_agents = (body["mode"] == "ai" or body["mode"] == "marl")
        mode_str = "Multi-Agent Q-Net" if system.use_agents else "Fixed Cycle Timer"
        system.bus.log(f"Control mode set to {mode_str}", "Operator", "system", sim.tick)
    elif action in ("set_speed", "speed"):
        val = body.get("speed", body.get("value", 1.0))
        state["speed"] = max(0.2, min(10.0, float(val)))
        system.bus.log(f"Simulation speed set to {state['speed']:.1f}x", "Operator", "system", sim.tick)
    elif action in ("set_density", "density"):
        val = max(0.1, min(4.0, float(body.get("density", body.get("value", 1.0)))))
        sim.density_mult = val
        baseline_sim.density_mult = val
        system.bus.log(f"Traffic density adjusted to {val:.2f}x", "Operator", "system", sim.tick)
    elif action in ("set_exploration", "set_epsilon", "epsilon"):
        val = max(0.0, min(1.0, float(body.get("eps", body.get("value", 0.05)))))
        for a in system.intersection_agents:
            a.eps = val
        system.bus.log(f"Exploration rate epsilon set to {val:.3f}", "Operator", "system", sim.tick)
    elif action in ("set_scenario", "scenario"):
        sc = body.get("scenario", body.get("preset", "normal"))
        sim.blocked_segments.clear()
        system.incident.incidents.clear()
        if sc in ("normal", "default"):
            sim.density_mult = 1.0
            baseline_sim.density_mult = 1.0
            for a in system.intersection_agents: a.eps = 0.05
            system.bus.log("Scenario applied: Normal flow (density 1.0x)", "Operator", "system", sim.tick)
        elif sc in ("rush_hour", "rush"):
            sim.density_mult = 2.4
            baseline_sim.density_mult = 2.4
            for a in system.intersection_agents: a.eps = 0.02
            system.bus.log("Scenario applied: Rush Hour peak congestion (density 2.4x)", "Operator", "system", sim.tick)
        elif sc in ("accident", "blockade"):
            sim.density_mult = 1.2
            baseline_sim.density_mult = 1.2
            sim.block_segment(1, 1, "S")
            system.incident.incidents.append((1, 1, "S", sim.tick))
            sim.block_segment(2, 2, "E")
            system.incident.incidents.append((2, 2, "E", sim.tick))
            system.bus.log("Scenario applied: Dual Accident roadblocks at (1,1,S) and (2,2,E)", "Operator", "incident", sim.tick)
        elif sc in ("event_surge", "stadium"):
            sim.density_mult = 3.2
            baseline_sim.density_mult = 3.2
            for a in system.intersection_agents: a.eps = 0.08
            system.bus.log("Scenario applied: Stadium Event Surge traffic (density 3.2x)", "Operator", "system", sim.tick)
        elif sc in ("emergency_drill", "hospital"):
            sim.density_mult = 1.5
            baseline_sim.density_mult = 1.5
            start = tuple(body.get("start", [0, 3]))
            goal = tuple(body.get("goal", [3, 0]))
            system.emergency.spawn(sim, system.bus, start=start, goal=goal)
            system.bus.log(f"Scenario applied: Emergency Drill {start}->{goal}", "Operator", "emergency", sim.tick)
    return {"ok": True, "use_agents": system.use_agents, "paused": state["paused"], "speed": state["speed"]}


if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
