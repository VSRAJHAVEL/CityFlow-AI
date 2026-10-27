/**
 * CityFlow AI - Interactive Frontend Engine
 * Stage 3: Full Integration with HiDPI Canvas, Real-City Aesthetics,
 * Agent Transparency, Live Message Feed, Extended KPIs, Full-Width Analytics, and CSV Export.
 */

// Viewport Elements
const canvas = document.getElementById('cityCanvas');
const ctx = canvas.getContext('2d');
const container = document.getElementById('canvasContainer');
const tooltip = document.getElementById('carTooltip');

const baselineCanvas = document.getElementById('baselineCanvas');
const bCtx = baselineCanvas ? baselineCanvas.getContext('2d') : null;
const baselineContainer = document.getElementById('baselineCanvasContainer');

// Grid Configurations
const GRID = 4;
let dpr = window.devicePixelRatio || 1;
let cityWidth = 500;
let cityHeight = 500;
let cellSize = 125;
let roadWidth = 42;
let originX = 0;
let originY = 0;

// State Tracking
let latestState = null;
let lastTick = -1;
let signalTimers = {};
let trackedCars = new Map();
let trackedBaselineCars = new Map();
let heatmapEnabled = false;
let isPaused = false;
let compareMode = false;
let selectedNode = null;
let currentFeedFilter = 'all';
let allMessages = [];

// Drag & Drop Ambulance Dispatch
let isDraggingDispatch = false;
let dragStartNode = null;
let dragStartX = 0;
let dragStartY = 0;
let dragDistance = 0;
let currentMousePos = { x: 0, y: 0 };
let hoveredNode = null;
let hoveredCar = null;

// FPS
let frameCount = 0;
let lastFpsUpdate = performance.now();
let currentFps = 60;

// Direction vector helpers
const DIRS = {
  N: { dr: -1, dc: 0, angle: -Math.PI / 2 },
  S: { dr: 1, dc: 0, angle: Math.PI / 2 },
  E: { dr: 0, dc: 1, angle: 0 },
  W: { dr: 0, dc: -1, angle: Math.PI }
};

function pseudoRandom(seed) {
  const x = Math.sin(seed * 9999) * 10000;
  return x - Math.floor(x);
}

// Generate static city architecture
const CITY_BLOCKS = [];
for (let r = 0; r < GRID + 1; r++) {
  CITY_BLOCKS[r] = [];
  for (let c = 0; c < GRID + 1; c++) {
    const seed = r * 17 + c * 31 + 42;
    const isPark = pseudoRandom(seed) > 0.8;
    const height = 12 + Math.floor(pseudoRandom(seed + 1) * 35);
    const shade = 18 + Math.floor(pseudoRandom(seed + 2) * 14);
    const windowColor = pseudoRandom(seed + 3) > 0.5 ? '#00f0ff' : '#ffd166';
    const subDivide = pseudoRandom(seed + 4) > 0.4;
    CITY_BLOCKS[r][c] = { isPark, height, shade, windowColor, subDivide, seed };
  }
}

// Full Analytics Charts
let historyChart = null;
let fullWaitChart = null;
let fullThroughputChart = null;
let fullBarChart = null;

function initMiniChart() {
  const chartCanvas = document.getElementById('historyChart');
  if (!chartCanvas) return;
  historyChart = new Chart(chartCanvas.getContext('2d'), {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        { label: 'Multi-Agent', borderColor: '#00f0ff', backgroundColor: 'rgba(0, 240, 255, 0.08)', borderWidth: 2, pointRadius: 0, tension: 0.35, fill: true, data: [] },
        { label: 'Fixed Timer', borderColor: '#ff3366', backgroundColor: 'transparent', borderWidth: 1.8, borderDash: [4, 4], pointRadius: 0, tension: 0.35, data: [] }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { display: false, grid: { display: false } },
        y: { grid: { color: 'rgba(255, 255, 255, 0.05)', drawBorder: false }, ticks: { color: '#64748b', font: { size: 9 } } }
      }
    }
  });
}

function initFullCharts() {
  const fwCanvas = document.getElementById('fullWaitChart');
  if (fwCanvas && !fullWaitChart) {
    fullWaitChart = new Chart(fwCanvas.getContext('2d'), {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          { label: 'Multi-Agent Q-Net Wait', borderColor: '#00f0ff', backgroundColor: 'rgba(0, 240, 255, 0.1)', borderWidth: 2.5, pointRadius: 0, tension: 0.3, fill: true, data: [] },
          { label: 'Fixed Cycle Timer Wait', borderColor: '#ff3366', backgroundColor: 'transparent', borderWidth: 2, borderDash: [4, 4], pointRadius: 0, tension: 0.3, data: [] }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false, animation: false, scales: { x: { ticks: { color: '#94a3b8' } }, y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.06)' } } } }
    });
  }

  const ftCanvas = document.getElementById('fullThroughputChart');
  if (ftCanvas && !fullThroughputChart) {
    fullThroughputChart = new Chart(ftCanvas.getContext('2d'), {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          { label: 'Multi-Agent Throughput', borderColor: '#00e676', backgroundColor: 'rgba(0, 230, 118, 0.1)', borderWidth: 2.5, pointRadius: 0, tension: 0.3, fill: true, data: [] },
          { label: 'Baseline Throughput', borderColor: '#ffab00', backgroundColor: 'transparent', borderWidth: 2, borderDash: [4, 4], pointRadius: 0, tension: 0.3, data: [] }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false, animation: false, scales: { x: { ticks: { color: '#94a3b8' } }, y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.06)' } } } }
    });
  }

  const fbCanvas = document.getElementById('fullBarChart');
  if (fbCanvas && !fullBarChart) {
    const nodeLabels = [];
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        nodeLabels.push(`I(${r},${c})`);
      }
    }
    fullBarChart = new Chart(fbCanvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: nodeLabels,
        datasets: [
          { label: 'Multi-Agent Congestion', backgroundColor: 'rgba(0, 240, 255, 0.75)', borderRadius: 4, data: [] },
          { label: 'Baseline Fixed Timer Congestion', backgroundColor: 'rgba(255, 51, 102, 0.75)', borderRadius: 4, data: [] }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        scales: {
          x: { ticks: { color: '#94a3b8', font: { size: 9 } }, grid: { display: false } },
          y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.06)' } }
        }
      }
    });
  }
}

function openAnalyticsModal() {
  const modal = document.getElementById('analyticsModal');
  if (modal) {
    modal.style.display = 'flex';
    initFullCharts();
    updateFullCharts();
  }
}

function closeAnalyticsModal() {
  const modal = document.getElementById('analyticsModal');
  if (modal) modal.style.display = 'none';
}

function updateFullCharts() {
  if (!latestState) return;

  if (fullWaitChart && latestState.wait_agent) {
    const labels = Array.from({ length: latestState.wait_agent.length }, (_, i) => i * 10);
    fullWaitChart.data.labels = labels;
    fullWaitChart.data.datasets[0].data = latestState.wait_agent;
    fullWaitChart.data.datasets[1].data = latestState.wait_baseline || [];
    fullWaitChart.update();
  }

  if (fullThroughputChart && latestState.throughput_agent) {
    const labels = Array.from({ length: latestState.throughput_agent.length }, (_, i) => i * 10);
    fullThroughputChart.data.labels = labels;
    fullThroughputChart.data.datasets[0].data = latestState.throughput_agent;
    fullThroughputChart.data.datasets[1].data = latestState.throughput_baseline || [];
    fullThroughputChart.update();
  }

  if (fullBarChart && latestState.agent_intersection_loads) {
    fullBarChart.data.datasets[0].data = latestState.agent_intersection_loads;
    fullBarChart.data.datasets[1].data = latestState.baseline_intersection_loads || [];
    fullBarChart.update();
  }
}

function drawSparkline(waitHistory) {
  const sCanvas = document.getElementById('sparklineCanvas');
  if (!sCanvas) return;
  const sCtx = sCanvas.getContext('2d');
  const w = sCanvas.clientWidth;
  const h = sCanvas.clientHeight;
  sCanvas.width = w * dpr;
  sCanvas.height = h * dpr;
  sCtx.scale(dpr, dpr);

  sCtx.clearRect(0, 0, w, h);
  if (!waitHistory || !waitHistory.length) return;

  const maxVal = Math.max(10, ...waitHistory);
  sCtx.beginPath();
  sCtx.strokeStyle = '#00f0ff';
  sCtx.lineWidth = 1.8;

  waitHistory.forEach((v, i) => {
    const x = (i / Math.max(1, waitHistory.length - 1)) * (w - 8) + 4;
    const y = h - (v / maxVal) * (h - 8) - 4;
    if (i === 0) sCtx.moveTo(x, y);
    else sCtx.lineTo(x, y);
  });
  sCtx.stroke();
}

function resizeCanvases() {
  dpr = window.devicePixelRatio || 1;

  [ { cv: canvas, cnt: container }, { cv: baselineCanvas, cnt: baselineContainer } ].forEach(item => {
    if (!item.cnt || !item.cv) return;
    const rect = item.cnt.getBoundingClientRect();
    const w = Math.floor(rect.width);
    const h = Math.floor(rect.height);
    if (w <= 0 || h <= 0) return;

    item.cv.width = Math.round(w * dpr);
    item.cv.height = Math.round(h * dpr);
    item.cv.style.width = w + 'px';
    item.cv.style.height = h + 'px';
  });

  if (container) {
    const rect = container.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    const padding = 28;
    const availSize = Math.max(180, Math.min(w, h) - padding * 2);
    cityWidth = availSize;
    cityHeight = availSize;
    cellSize = availSize / GRID;
    roadWidth = Math.max(34, cellSize * 0.32);
    originX = Math.round((w - availSize) / 2);
    originY = Math.round((h - availSize) / 2);
  }
}

function getIntersectionCenter(r, c) {
  return {
    x: originX + c * cellSize + cellSize / 2,
    y: originY + r * cellSize + cellSize / 2
  };
}

function angleDiff(a, b) {
  let diff = (a - b) % (Math.PI * 2);
  if (diff < -Math.PI) diff += Math.PI * 2;
  if (diff > Math.PI) diff -= Math.PI * 2;
  return diff;
}

function ctrl(action, payload = {}) {
  fetch('/control', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload })
  }).then(r => r.json()).then(res => {
    if (action === 'pause') {
      isPaused = !isPaused;
      const lbl = document.getElementById('pauseLabel');
      if (lbl) lbl.textContent = isPaused ? 'Resume' : 'Pause';
    } else if (action === 'toggle_baseline' || action === 'set_mode') {
      updateModeUI(res.use_agents);
    }
  }).catch(console.error);
}

function updateModeUI(useAgents) {
  const pill = document.getElementById('systemModePill');
  const dot = document.getElementById('systemModeDot');
  const txt = document.getElementById('systemModeText');
  const btn = document.getElementById('btnToggleMode');
  const btnLbl = document.getElementById('btnToggleModeLabel');

  if (useAgents) {
    if (pill) { pill.className = 'status-pill mode-active'; }
    if (dot) { dot.className = 'status-dot'; }
    if (txt) { txt.textContent = 'Multi-Agent System (Active)'; }
    if (btn) { btn.className = 'action-btn mode-toggle'; }
    if (btnLbl) { btnLbl.textContent = 'Switch to Fixed Timer'; }
  } else {
    if (pill) { pill.className = 'status-pill mode-baseline'; }
    if (dot) { dot.className = 'status-dot baseline'; }
    if (txt) { txt.textContent = 'Fixed Timer Baseline (Active)'; }
    if (btn) { btn.className = 'action-btn mode-toggle is-baseline'; }
    if (btnLbl) { btnLbl.textContent = 'Switch to Multi-Agent'; }
  }
}

function toggleControlMode() {
  ctrl('toggle_baseline');
}

function setScenario(sc, elem) {
  document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
  if (elem) elem.classList.add('active');
  ctrl('set_scenario', { scenario: sc });
}

// Stage 3: Live Agent Message Feed
function setFeedFilter(filter, elem) {
  currentFeedFilter = filter;
  document.querySelectorAll('.feed-filter-btn').forEach(b => b.classList.remove('active'));
  if (elem) elem.classList.add('active');
  renderMessageFeed();
}

function renderMessageFeed() {
  const feedElem = document.getElementById('agentMessageFeed');
  if (!feedElem) return;

  const filtered = allMessages.filter(m => {
    if (currentFeedFilter === 'all') return true;
    if (currentFeedFilter === 'coordinator') return m.type === 'coordinator';
    if (currentFeedFilter === 'emergency') return m.type === 'emergency';
    if (currentFeedFilter === 'incident') return m.type === 'incident';
    if (currentFeedFilter === 'intersection') return m.type === 'intersection';
    return true;
  });

  if (!filtered.length) {
    feedElem.innerHTML = `<div style="color:var(--text-dim);font-size:0.62rem;padding:6px;">No messages matching '${currentFeedFilter}'</div>`;
    return;
  }

  feedElem.innerHTML = filtered.slice(-25).reverse().map(m => `
    <div class="feed-item ${m.type || 'system'}">
      <div class="feed-meta">
        <span class="feed-tag">${m.sender || 'Agent'}</span>
        <span>Tick ${m.tick || 0}</span>
      </div>
      <div class="feed-text">${m.text || ''}</div>
    </div>
  `).join('');
}

async function fetchMessages() {
  try {
    const res = await fetch('/messages');
    if (res.ok) {
      const msgs = await res.json();
      if (msgs.length !== allMessages.length) {
        allMessages = msgs;
        renderMessageFeed();
      }
    }
  } catch (err) {}
}

async function inspectNode(r, c) {
  selectedNode = { r, c };
  const inspector = document.getElementById('agentInspector');
  if (inspector) inspector.style.display = 'block';

  try {
    const res = await fetch(`/inspect/${r}_${c}`);
    if (res.ok) {
      const data = await res.json();
      document.getElementById('inspNodeTitle').textContent = `Intersection I(${data.r},${data.c})`;
      const phaseElem = document.getElementById('inspPhase');
      phaseElem.textContent = `${data.phase}-Green`;
      phaseElem.style.color = (data.phase === 'NS') ? 'var(--accent-green)' : 'var(--accent-cyan)';
      document.getElementById('inspTimer').textContent = `${data.phase_timer || 0}t / ${data.min_green || 5}t`;
      document.getElementById('inspQueues').textContent = `${data.queues.N} / ${data.queues.S} / ${data.queues.E} / ${data.queues.W}`;
      document.getElementById('inspNeighbor').textContent = `${data.neighbor_load || 0} vehicles`;

      const [qNS, qEW] = data.q_values || [0, 0];
      document.getElementById('qValNS').textContent = qNS.toFixed(1);
      document.getElementById('qValEW').textContent = qEW.toFixed(1);

      const minQ = Math.min(qNS, qEW, -10);
      const maxQ = Math.max(qNS, qEW, 10);
      const span = maxQ - minQ || 1;
      const pctNS = Math.max(10, Math.min(100, ((qNS - minQ) / span) * 100));
      const pctEW = Math.max(10, Math.min(100, ((qEW - minQ) / span) * 100));

      document.getElementById('qBarNS').style.width = `${pctNS}%`;
      document.getElementById('qBarEW').style.width = `${pctEW}%`;
      document.getElementById('inspReason').textContent = data.reason || 'Optimal';

      drawSparkline(data.wait_history || []);
    }
  } catch (err) {
    console.error('Inspector error:', err);
  }
}

function closeInspector() {
  selectedNode = null;
  const inspector = document.getElementById('agentInspector');
  if (inspector) inspector.style.display = 'none';
}

// Canvas interactions
canvas.addEventListener('mousedown', e => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  dragStartX = mx;
  dragStartY = my;
  dragDistance = 0;

  const halfRoad = roadWidth / 2 + 6;
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      const center = getIntersectionCenter(r, c);
      if (Math.abs(mx - center.x) <= halfRoad && Math.abs(my - center.y) <= halfRoad) {
        isDraggingDispatch = true;
        dragStartNode = { r, c };
        currentMousePos = { x: mx, y: my };
        return;
      }
    }
  }
});

canvas.addEventListener('mousemove', e => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  currentMousePos = { x: mx, y: my };
  dragDistance = Math.hypot(mx - dragStartX, my - dragStartY);

  const halfRoad = roadWidth / 2 + 6;
  hoveredNode = null;
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      const center = getIntersectionCenter(r, c);
      if (Math.abs(mx - center.x) <= halfRoad && Math.abs(my - center.y) <= halfRoad) {
        hoveredNode = { r, c };
        break;
      }
    }
    if (hoveredNode) break;
  }

  if (!isDraggingDispatch || dragDistance < 8) {
    hoveredCar = null;
    trackedCars.forEach(car => {
      if (Math.hypot(car.x - mx, car.y - my) < 14) {
        hoveredCar = car;
      }
    });

    if (hoveredCar && tooltip) {
      tooltip.style.display = 'block';
      tooltip.style.left = `${mx + 15}px`;
      tooltip.style.top = `${my - 15}px`;
      tooltip.innerHTML = `
        <div class="tooltip-title">${hoveredCar.isAmb ? '🚑 Emergency Unit #' + hoveredCar.id : '🚗 Vehicle #' + hoveredCar.id}</div>
        <div>Wait: <strong style="color:${hoveredCar.wait > 4 ? 'var(--accent-red)' : 'var(--accent-green)'}">${hoveredCar.wait} ticks</strong></div>
        <div style="color:var(--text-dim);font-size:0.65rem">Destination: ${hoveredCar.dest || 'Transit'}</div>
      `;
    } else if (tooltip && !isDraggingDispatch) {
      tooltip.style.display = 'none';
    }
  } else if (tooltip && isDraggingDispatch) {
    tooltip.style.display = 'block';
    tooltip.style.left = `${mx + 15}px`;
    tooltip.style.top = `${my - 15}px`;
    if (hoveredNode) {
      const dist = Math.abs(hoveredNode.r - dragStartNode.r) + Math.abs(hoveredNode.c - dragStartNode.c);
      const liveEta = dist * 4 + 6;
      tooltip.innerHTML = `
        <div class="tooltip-title" style="color:#00f0ff">🚑 Dispatch Route</div>
        <div>Target: <strong>I(${hoveredNode.r},${hoveredNode.c})</strong></div>
        <div>Live ETA: <strong style="color:var(--accent-amber)">${liveEta} ticks</strong></div>
      `;
    } else {
      tooltip.innerHTML = `<div class="tooltip-title">Drag to Target Intersection</div>`;
    }
  }
});

canvas.addEventListener('mouseup', e => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  if (isDraggingDispatch) {
    isDraggingDispatch = false;
    if (tooltip) tooltip.style.display = 'none';

    if (dragDistance > 15 && hoveredNode && dragStartNode && (hoveredNode.r !== dragStartNode.r || hoveredNode.c !== dragStartNode.c)) {
      ctrl('spawn_emergency', {
        start: [dragStartNode.r, dragStartNode.c],
        goal: [hoveredNode.r, hoveredNode.c]
      });
      dragStartNode = null;
      return;
    }

    if (dragStartNode) {
      inspectNode(dragStartNode.r, dragStartNode.c);
      dragStartNode = null;
      return;
    }
  }

  // Click on road segment: toggle accident / block
  const halfRoad = roadWidth / 2;
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      const center = getIntersectionCenter(r, c);
      if (Math.abs(mx - center.x) <= halfRoad && my < center.y - halfRoad && my > center.y - cellSize + halfRoad) {
        ctrl('toggle_road_block', { r, c, d: 'N' });
        return;
      }
      if (Math.abs(mx - center.x) <= halfRoad && my > center.y + halfRoad && my < center.y + cellSize - halfRoad) {
        ctrl('toggle_road_block', { r, c, d: 'S' });
        return;
      }
      if (Math.abs(my - center.y) <= halfRoad && mx < center.x - halfRoad && mx > center.x - cellSize + halfRoad) {
        ctrl('toggle_road_block', { r, c, d: 'W' });
        return;
      }
      if (Math.abs(my - center.y) <= halfRoad && mx > center.x + halfRoad && mx < center.x + cellSize - halfRoad) {
        ctrl('toggle_road_block', { r, c, d: 'E' });
        return;
      }
    }
  }
});

// Keyboard Shortcuts
window.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  if (e.code === 'Space') { e.preventDefault(); ctrl('pause'); }
  else if (e.code === 'KeyR') { ctrl('reset'); }
  else if (e.code === 'KeyE') { ctrl('spawn_emergency'); }
  else if (e.code === 'KeyI') { ctrl('spawn_incident'); }
  else if (e.code === 'KeyS') { ctrl('step'); }
});

function updateMetricsUI(state, metrics) {
  const mWait = document.getElementById('mWait');
  const mBase = document.getElementById('mBase');
  const mThru = document.getElementById('mThru');
  const mTickBadge = document.getElementById('mTickBadge');
  const mAmb = document.getElementById('mAmb');
  const mEff = document.getElementById('mEfficiency');
  const mStops = document.getElementById('mStops');
  const mCO2 = document.getElementById('mCO2');

  if (mWait) mWait.textContent = state.avg_wait !== undefined ? state.avg_wait.toFixed(1) : '-';
  if (mThru) mThru.textContent = state.throughput !== undefined ? state.throughput : '-';
  if (mTickBadge) mTickBadge.textContent = `Tick ${state.tick || 0}`;

  if (state.use_agents !== undefined) {
    updateModeUI(state.use_agents);
  }

  // Agent Status Hierarchy Cards
  if (state.agents_status) {
    const cs = state.agents_status.coordinator;
    const es = state.agents_status.emergency;
    const is = state.agents_status.incident;
    if (cs) {
      document.getElementById('coordState').textContent = cs.state || 'Active';
      document.getElementById('coordAction').textContent = cs.action || 'Monitoring';
      document.getElementById('coordAction').title = cs.action || '';
    }
    if (es) {
      document.getElementById('emergState').textContent = es.state || 'Standby';
      document.getElementById('emergAction').textContent = es.action || 'Clear';
      document.getElementById('emergAction').title = es.action || '';
    }
    if (is) {
      document.getElementById('incidState').textContent = is.state || 'Clear';
      document.getElementById('incidAction').textContent = is.action || 'Clear';
      document.getElementById('incidAction').title = is.action || '';
    }
  }

  // Extended KPIs
  if (mBase && state.baseline) {
    mBase.textContent = state.baseline.avg_wait !== undefined ? state.baseline.avg_wait.toFixed(1) : '-';
  }
  if (mEff && state.avg_wait !== undefined && state.baseline && state.baseline.avg_wait > 0) {
    const delta = ((state.baseline.avg_wait - state.avg_wait) / state.baseline.avg_wait * 100);
    const isPositive = delta >= 0;
    mEff.textContent = `${isPositive ? '+' : ''}${delta.toFixed(1)}%`;
    mEff.className = `val ${isPositive ? 'green' : 'amber'}`;
  }
  if (mStops && state.avg_stops !== undefined) {
    mStops.textContent = `${state.avg_stops} (${state.baseline_avg_stops || 2.1})`;
  }
  if (mCO2 && state.co2_saved_kg !== undefined) {
    mCO2.textContent = `+${state.co2_saved_kg}kg`;
  }
  if (mAmb) {
    if (state.amb_times && state.amb_times.length > 0) {
      const last = state.amb_times[state.amb_times.length - 1];
      mAmb.textContent = `${last} ticks`;
    } else {
      mAmb.textContent = 'None';
    }
  }

  // Update Mini Chart
  if (historyChart && state.wait_agent && state.wait_agent.length) {
    const dataLen = state.wait_agent.length;
    const labels = Array.from({ length: dataLen }, (_, i) => i);
    historyChart.data.labels = labels;
    historyChart.data.datasets[0].data = state.wait_agent;
    historyChart.data.datasets[1].data = state.wait_baseline || [];
    historyChart.update();
  }

  const modal = document.getElementById('analyticsModal');
  if (modal && modal.style.display === 'flex') {
    updateFullCharts();
  }

  if (selectedNode) {
    inspectNode(selectedNode.r, selectedNode.c);
  }
}

function updateCarsFromState(carsList, targetMap) {
  targetMap.forEach(car => car.active = false);

  const queues = {};
  carsList.forEach(c => {
    const key = `${c.r}_${c.c}_${c.d}`;
    if (!queues[key]) queues[key] = [];
    queues[key].push(c);
  });

  Object.entries(queues).forEach(([key, list]) => {
    const [r, c, d] = key.split('_');
    const row = parseInt(r);
    const col = parseInt(c);
    const center = getIntersectionCenter(row, col);
    const halfRoad = roadWidth / 2;
    const laneOffset = halfRoad * 0.48;

    list.forEach((carData, qIdx) => {
      const carId = carData.id !== undefined ? carData.id : `${carData.amb ? 'amb' : 'car'}_${row}_${col}_${d}_${qIdx}`;
      const carKey = `${carId}`;
      let tx = center.x;
      let ty = center.y;
      let targetAngle = DIRS[d].angle;
      const maxQueueDist = cellSize * 0.44;
      const stopDistance = Math.min(maxQueueDist, halfRoad + 10 + qIdx * 12);

      if (d === 'N') { tx -= laneOffset; ty += stopDistance; }
      else if (d === 'S') { tx += laneOffset; ty -= stopDistance; }
      else if (d === 'E') { tx -= stopDistance; ty += laneOffset; }
      else if (d === 'W') { tx += stopDistance; ty -= laneOffset; }

      let tracked = targetMap.get(carKey);
      if (!tracked) {
        tracked = {
          id: carId, x: tx, y: ty, angle: targetAngle,
          targetX: tx, targetY: ty, targetAngle: targetAngle,
          wait: carData.w || 0, isAmb: !!carData.amb,
          dest: carData.dest || '', r: row, c: col, d: d, active: true
        };
        targetMap.set(carKey, tracked);
      } else {
        tracked.targetX = tx;
        tracked.targetY = ty;
        tracked.targetAngle = targetAngle;
        tracked.wait = carData.w || 0;
        tracked.isAmb = !!carData.amb;
        tracked.dest = carData.dest || tracked.dest;
        tracked.r = row; tracked.c = col; tracked.d = d;
        tracked.active = true;
      }
    });
  });

  targetMap.forEach((car, key) => {
    if (!car.active) targetMap.delete(key);
  });
}

function updateSignals(signals, currentTick) {
  if (!signals) return;
  signals.forEach(s => {
    const key = `${s.r}_${s.c}`;
    let record = signalTimers[key];
    if (!record) {
      record = { lastPhase: s.phase, phaseTick: currentTick, countdown: 5 };
      signalTimers[key] = record;
    } else {
      if (record.lastPhase !== s.phase) {
        record.lastPhase = s.phase;
        record.phaseTick = currentTick;
        record.countdown = 5;
      } else {
        const elapsed = (currentTick - record.phaseTick) % 15;
        record.countdown = Math.max(0, 5 - elapsed);
      }
    }
  });
}

/* ========================================================
   RENDER LOOP
   ======================================================== */

function render(timestamp) {
  frameCount++;
  if (timestamp - lastFpsUpdate >= 500) {
    currentFps = Math.round((frameCount * 1000) / (timestamp - lastFpsUpdate));
    frameCount = 0;
    lastFpsUpdate = timestamp;
    const fpsElem = document.getElementById('fpsVal');
    if (fpsElem) fpsElem.textContent = currentFps;
  }

  renderScene(ctx, canvas, trackedCars, latestState ? latestState.signals : [], latestState ? latestState.blocked : [], timestamp, true);

  if (compareMode && bCtx && baselineCanvas && latestState && latestState.baseline) {
    renderScene(bCtx, baselineCanvas, trackedBaselineCars, latestState.baseline.signals, latestState.baseline.blocked, timestamp, false);
  }

  requestAnimationFrame(render);
}

function renderScene(targetCtx, targetCanvas, carsMap, signals, blocked, timestamp, isPrimary) {
  targetCtx.save();
  targetCtx.scale(dpr, dpr);
  const w = targetCanvas.width / dpr;
  const h = targetCanvas.height / dpr;
  targetCtx.fillStyle = '#080c16';
  targetCtx.fillRect(0, 0, w, h);

  drawCityBlocks(targetCtx);
  drawRoadNetwork(targetCtx);

  if (heatmapEnabled && isPrimary) {
    drawHeatmap(targetCtx);
  }

  drawTrafficSignals(targetCtx, signals);

  if (isPrimary) {
    drawAmbulanceCorridor(targetCtx, signals);
  }

  drawAccidentHazards(targetCtx, blocked);
  drawVehicles(targetCtx, carsMap, timestamp);

  if (isPrimary) {
    drawInteractionOverlay(targetCtx);
  }

  targetCtx.restore();
}

function drawCityBlocks(targetCtx) {
  const halfRoad = roadWidth / 2;

  for (let r = 0; r < GRID + 1; r++) {
    for (let c = 0; c < GRID + 1; c++) {
      let x1 = (c === 0) ? originX - cellSize * 0.4 : originX + (c - 1) * cellSize + cellSize / 2 + halfRoad + 4;
      let y1 = (r === 0) ? originY - cellSize * 0.4 : originY + (r - 1) * cellSize + cellSize / 2 + halfRoad + 4;
      let x2 = (c === GRID) ? originX + cityWidth + cellSize * 0.4 : originX + c * cellSize + cellSize / 2 - halfRoad - 4;
      let y2 = (r === GRID) ? originY + cityHeight + cellSize * 0.4 : originY + r * cellSize + cellSize / 2 - halfRoad - 4;

      const bw = x2 - x1;
      const bh = y2 - y1;
      if (bw <= 8 || bh <= 8) continue;

      const block = CITY_BLOCKS[r][c];

      targetCtx.fillStyle = '#111827';
      targetCtx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      targetCtx.lineWidth = 1;
      roundRect(targetCtx, x1, y1, bw, bh, 6);
      targetCtx.fill();
      targetCtx.stroke();

      if (block.isPark) {
        targetCtx.fillStyle = '#0d2818';
        roundRect(targetCtx, x1 + 4, y1 + 4, bw - 8, bh - 8, 4);
        targetCtx.fill();

        targetCtx.strokeStyle = '#1b4332';
        targetCtx.lineWidth = 3;
        targetCtx.beginPath();
        targetCtx.arc(x1 + bw / 2, y1 + bh / 2, Math.min(bw, bh) * 0.28, 0, Math.PI * 1.5);
        targetCtx.stroke();

        const trees = [
          { x: x1 + bw * 0.3, y: y1 + bh * 0.3 },
          { x: x1 + bw * 0.7, y: y1 + bh * 0.4 },
          { x: x1 + bw * 0.4, y: y1 + bh * 0.75 }
        ];
        trees.forEach(t => {
          targetCtx.fillStyle = '#2d6a4f';
          targetCtx.beginPath();
          targetCtx.arc(t.x, t.y, 4, 0, Math.PI * 2);
          targetCtx.fill();
        });
      } else {
        const buildingX = x1 + 4;
        const buildingY = y1 + 4;
        const buildingW = bw - 8;
        const buildingH = bh - 8;

        targetCtx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        roundRect(targetCtx, buildingX + 2, buildingY + 3, buildingW, buildingH, 4);
        targetCtx.fill();

        targetCtx.fillStyle = `rgb(${block.shade}, ${block.shade + 4}, ${block.shade + 12})`;
        roundRect(targetCtx, buildingX, buildingY, buildingW, buildingH, 4);
        targetCtx.fill();

        targetCtx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        targetCtx.lineWidth = 1;
        targetCtx.stroke();

        if (block.subDivide && buildingW > 24 && buildingH > 24) {
          targetCtx.fillStyle = block.windowColor;
          targetCtx.globalAlpha = 0.25;
          for (let wx = buildingX + 6; wx < buildingX + buildingW - 5; wx += 10) {
            for (let wy = buildingY + 6; wy < buildingY + buildingH - 5; wy += 10) {
              targetCtx.fillRect(wx, wy, 2, 2);
            }
          }
          targetCtx.globalAlpha = 1.0;
        } else {
          targetCtx.strokeStyle = 'rgba(255, 209, 102, 0.25)';
          targetCtx.lineWidth = 1.2;
          targetCtx.beginPath();
          targetCtx.arc(buildingX + buildingW / 2, buildingY + buildingH / 2, Math.min(buildingW, buildingH) * 0.22, 0, Math.PI * 2);
          targetCtx.stroke();
        }
      }
    }
  }
}

function drawRoadNetwork(targetCtx) {
  const halfRoad = roadWidth / 2;

  targetCtx.fillStyle = '#131926';
  for (let i = 0; i < GRID; i++) {
    const center = getIntersectionCenter(i, i);
    targetCtx.fillRect(originX - 20, center.y - halfRoad, cityWidth + 40, roadWidth);
    targetCtx.fillRect(center.x - halfRoad, originY - 20, roadWidth, cityHeight + 40);
  }

  targetCtx.strokeStyle = '#1e293b';
  targetCtx.lineWidth = 1.5;
  for (let i = 0; i < GRID; i++) {
    const center = getIntersectionCenter(i, i);
    targetCtx.beginPath();
    targetCtx.moveTo(originX - 20, center.y - halfRoad);
    targetCtx.lineTo(originX + cityWidth + 20, center.y - halfRoad);
    targetCtx.moveTo(originX - 20, center.y + halfRoad);
    targetCtx.lineTo(originX + cityWidth + 20, center.y + halfRoad);
    targetCtx.moveTo(center.x - halfRoad, originY - 20);
    targetCtx.lineTo(center.x - halfRoad, originY + cityHeight + 20);
    targetCtx.moveTo(center.x + halfRoad, originY - 20);
    targetCtx.lineTo(center.x + halfRoad, originY + cityHeight + 20);
    targetCtx.stroke();
  }

  targetCtx.save();
  targetCtx.setLineDash([8, 8]);
  targetCtx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  targetCtx.lineWidth = 1.2;
  for (let i = 0; i < GRID; i++) {
    const center = getIntersectionCenter(i, i);
    for (let c = 0; c < GRID - 1; c++) {
      const c1 = getIntersectionCenter(i, c);
      const c2 = getIntersectionCenter(i, c + 1);
      targetCtx.beginPath();
      targetCtx.moveTo(c1.x + halfRoad + 14, center.y);
      targetCtx.lineTo(c2.x - halfRoad - 14, center.y);
      targetCtx.stroke();
    }
    for (let r = 0; r < GRID - 1; r++) {
      const r1 = getIntersectionCenter(r, i);
      const r2 = getIntersectionCenter(r + 1, i);
      targetCtx.beginPath();
      targetCtx.moveTo(center.x, r1.y + halfRoad + 14);
      targetCtx.lineTo(center.x, r2.y - halfRoad - 14);
      targetCtx.stroke();
    }
  }
  targetCtx.restore();

  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      const center = getIntersectionCenter(r, c);
      targetCtx.fillStyle = '#171f30';
      targetCtx.fillRect(center.x - halfRoad, center.y - halfRoad, roadWidth, roadWidth);

      targetCtx.strokeStyle = 'rgba(255, 209, 102, 0.12)';
      targetCtx.lineWidth = 1;
      targetCtx.strokeRect(center.x - halfRoad + 2, center.y - halfRoad + 2, roadWidth - 4, roadWidth - 4);

      drawCrosswalk(targetCtx, center.x - halfRoad, center.y - halfRoad - 8, roadWidth, 6, true);
      drawCrosswalk(targetCtx, center.x - halfRoad, center.y + halfRoad + 2, roadWidth, 6, true);
      drawCrosswalk(targetCtx, center.x - halfRoad - 8, center.y - halfRoad, 6, roadWidth, false);
      drawCrosswalk(targetCtx, center.x + halfRoad + 2, center.y - halfRoad, 6, roadWidth, false);
    }
  }
}

function drawCrosswalk(targetCtx, x, y, w, h, isHorizontal) {
  targetCtx.save();
  targetCtx.fillStyle = 'rgba(255, 255, 255, 0.28)';
  if (isHorizontal) {
    const stripes = 6;
    const stripeW = w / stripes;
    for (let i = 0; i < stripes; i += 2) {
      targetCtx.fillRect(x + i * stripeW + 1, y, stripeW - 2, h);
    }
  } else {
    const stripes = 6;
    const stripeH = h / stripes;
    for (let i = 0; i < stripes; i += 2) {
      targetCtx.fillRect(x, y + i * stripeH + 1, w, stripeH - 2);
    }
  }
  targetCtx.restore();
}

function drawTrafficSignals(targetCtx, signals) {
  if (!signals) return;
  const halfRoad = roadWidth / 2;

  signals.forEach(s => {
    const center = getIntersectionCenter(s.r, s.c);
    const key = `${s.r}_${s.c}`;
    const timerInfo = signalTimers[key] || { countdown: 5 };

    const nsGreen = (s.phase === 'NS' || s.forced === 'N' || s.forced === 'S');
    const ewGreen = (s.phase === 'EW' || s.forced === 'E' || s.forced === 'W');

    drawStopLight(targetCtx, center.x + halfRoad * 0.48, center.y - halfRoad, nsGreen, 'S', timerInfo.countdown);
    drawStopLight(targetCtx, center.x - halfRoad * 0.48, center.y + halfRoad, nsGreen, 'N', timerInfo.countdown);
    drawStopLight(targetCtx, center.x - halfRoad, center.y + halfRoad * 0.48, ewGreen, 'E', timerInfo.countdown);
    drawStopLight(targetCtx, center.x + halfRoad, center.y - halfRoad * 0.48, ewGreen, 'W', timerInfo.countdown);

    if (s.forced) {
      targetCtx.save();
      targetCtx.strokeStyle = '#00f0ff';
      targetCtx.lineWidth = 2;
      targetCtx.shadowColor = '#00f0ff';
      targetCtx.shadowBlur = 10;
      targetCtx.beginPath();
      targetCtx.arc(center.x, center.y, 7, 0, Math.PI * 2);
      targetCtx.stroke();
      targetCtx.restore();
    }
  });
}

function drawStopLight(targetCtx, x, y, isGreen, heading, countdown) {
  const color = isGreen ? '#00e676' : '#ff3366';
  targetCtx.save();
  targetCtx.fillStyle = color;
  targetCtx.shadowColor = color;
  targetCtx.shadowBlur = 8;
  targetCtx.beginPath();
  targetCtx.arc(x, y, 3.5, 0, Math.PI * 2);
  targetCtx.fill();

  if (isGreen && countdown !== undefined) {
    targetCtx.shadowBlur = 0;
    targetCtx.fillStyle = '#00f0ff';
    targetCtx.font = '600 8px Inter';
    targetCtx.textAlign = 'center';
    targetCtx.textBaseline = 'middle';

    let tx = x, ty = y;
    if (heading === 'S') ty -= 9;
    else if (heading === 'N') ty += 9;
    else if (heading === 'E') tx -= 9;
    else if (heading === 'W') tx += 9;

    targetCtx.fillText(countdown.toString(), tx, ty);
  }
  targetCtx.restore();
}

function drawAmbulanceCorridor(targetCtx, signals) {
  if (!signals) return;
  const forcedSignals = signals.filter(s => s.forced);
  if (!forcedSignals.length) return;

  targetCtx.save();
  const pulseScale = 1 + (Math.sin(performance.now() * 0.008) + 1) * 0.25;

  forcedSignals.forEach(s => {
    const center = getIntersectionCenter(s.r, s.c);
    targetCtx.strokeStyle = 'rgba(0, 240, 255, 0.7)';
    targetCtx.lineWidth = 2;
    targetCtx.shadowColor = '#00f0ff';
    targetCtx.shadowBlur = 12;
    targetCtx.beginPath();
    targetCtx.arc(center.x, center.y, (roadWidth * 0.6) * pulseScale, 0, Math.PI * 2);
    targetCtx.stroke();
  });

  if (forcedSignals.length > 1) {
    targetCtx.setLineDash([6, 6]);
    targetCtx.lineDashOffset = -performance.now() * 0.03;
    targetCtx.strokeStyle = '#00f0ff';
    targetCtx.lineWidth = 3;
    targetCtx.shadowColor = '#00f0ff';
    targetCtx.shadowBlur = 14;
    targetCtx.beginPath();
    forcedSignals.forEach((s, idx) => {
      const center = getIntersectionCenter(s.r, s.c);
      if (idx === 0) targetCtx.moveTo(center.x, center.y);
      else targetCtx.lineTo(center.x, center.y);
    });
    targetCtx.stroke();
  }
  targetCtx.restore();
}

function drawAccidentHazards(targetCtx, blocked) {
  if (!blocked) return;
  const halfRoad = roadWidth / 2;
  const now = performance.now();
  const blink = (Math.sin(now * 0.01) + 1) * 0.5;

  blocked.forEach(b => {
    const center = getIntersectionCenter(b.r, b.c);
    let bx = center.x, by = center.y;
    const offset = halfRoad + 18;

    if (b.d === 'N') { bx -= halfRoad * 0.48; by += offset; }
    else if (b.d === 'S') { bx += halfRoad * 0.48; by -= offset; }
    else if (b.d === 'E') { bx -= offset; by += halfRoad * 0.48; }
    else if (b.d === 'W') { bx += offset; by -= halfRoad * 0.48; }

    targetCtx.save();
    targetCtx.translate(bx, by);

    targetCtx.fillStyle = `rgba(255, 171, 0, ${0.2 + blink * 0.6})`;
    targetCtx.shadowColor = '#ffab00';
    targetCtx.shadowBlur = 14 * blink;
    targetCtx.beginPath();
    targetCtx.arc(0, -10, 5, 0, Math.PI * 2);
    targetCtx.fill();

    targetCtx.fillStyle = '#1e293b';
    targetCtx.fillRect(-12, -4, 24, 9);
    targetCtx.strokeStyle = '#f1f5f9';
    targetCtx.lineWidth = 1;
    targetCtx.strokeRect(-12, -4, 24, 9);

    targetCtx.fillStyle = '#ff3366';
    for (let sx = -10; sx < 10; sx += 6) {
      targetCtx.beginPath();
      targetCtx.moveTo(sx, 5);
      targetCtx.lineTo(sx + 4, -4);
      targetCtx.lineTo(sx + 7, -4);
      targetCtx.lineTo(sx + 3, 5);
      targetCtx.fill();
    }

    targetCtx.strokeStyle = '#94a3b8';
    targetCtx.lineWidth = 1.5;
    targetCtx.beginPath();
    targetCtx.moveTo(-9, 5); targetCtx.lineTo(-12, 10);
    targetCtx.moveTo(9, 5); targetCtx.lineTo(12, 10);
    targetCtx.stroke();

    targetCtx.restore();
  });
}

function drawVehicles(targetCtx, carsMap, timestamp) {
  carsMap.forEach(car => {
    car.x += (car.targetX - car.x) * 0.22;
    car.y += (car.targetY - car.y) * 0.22;
    car.angle += angleDiff(car.targetAngle, car.angle) * 0.25;

    targetCtx.save();
    targetCtx.translate(car.x, car.y);
    targetCtx.rotate(car.angle);

    if (car.isAmb) {
      const ambW = 20, ambH = 10;
      drawHeadlights(targetCtx, ambW, ambH, '#ffffff');

      targetCtx.fillStyle = '#f8fafc';
      roundRect(targetCtx, -ambW / 2, -ambH / 2, ambW, ambH, 2.5);
      targetCtx.fill();

      targetCtx.fillStyle = '#ff1744';
      targetCtx.fillRect(-ambW * 0.2, -ambH / 2, ambW * 0.4, 2);
      targetCtx.fillRect(-ambW * 0.2, ambH / 2 - 2, ambW * 0.4, 2);

      const sirenState = Math.sin(timestamp * 0.02) > 0;
      const sirenColor = sirenState ? '#ff1744' : '#2979ff';
      targetCtx.fillStyle = sirenColor;
      targetCtx.shadowColor = sirenColor;
      targetCtx.shadowBlur = 16;
      targetCtx.beginPath();
      targetCtx.arc(0, 0, 3.5, 0, Math.PI * 2);
      targetCtx.fill();
    } else {
      const carW = 14, carH = 7.5;
      let carColor = '#00e676';
      if (car.wait > 8) carColor = '#ff3366';
      else if (car.wait > 4) carColor = '#ffab00';
      else if (car.wait > 1) carColor = '#ffd166';

      drawHeadlights(targetCtx, carW, carH, 'rgba(235, 248, 255, 0.2)');

      targetCtx.fillStyle = carColor;
      targetCtx.shadowColor = carColor;
      targetCtx.shadowBlur = car.wait > 0 ? 0 : 4;
      roundRect(targetCtx, -carW / 2, -carH / 2, carW, carH, 2);
      targetCtx.fill();

      targetCtx.fillStyle = 'rgba(10, 15, 30, 0.65)';
      targetCtx.fillRect(-carW * 0.15, -carH * 0.35, carW * 0.45, carH * 0.7);

      const brakeAlpha = car.wait > 0 ? 1.0 : 0.25;
      targetCtx.fillStyle = `rgba(255, 23, 68, ${brakeAlpha})`;
      targetCtx.shadowColor = '#ff1744';
      targetCtx.shadowBlur = car.wait > 0 ? 8 : 1;
      targetCtx.fillRect(-carW / 2, -carH / 2 + 1, 1.5, 1.8);
      targetCtx.fillRect(-carW / 2, carH / 2 - 2.8, 1.5, 1.8);
    }
    targetCtx.restore();
  });
}

function drawHeadlights(targetCtx, w, h, color) {
  targetCtx.save();
  const beamDist = 24, beamSpread = 9;

  let grad1 = targetCtx.createRadialGradient(w / 2, -h * 0.3, 1, w / 2 + beamDist, -h * 0.3 - beamSpread / 2, beamDist);
  grad1.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
  grad1.addColorStop(1, 'rgba(255, 255, 255, 0)');
  targetCtx.fillStyle = grad1;
  targetCtx.beginPath();
  targetCtx.moveTo(w / 2, -h * 0.3);
  targetCtx.lineTo(w / 2 + beamDist, -h * 0.3 - beamSpread);
  targetCtx.lineTo(w / 2 + beamDist, -h * 0.3 + 2);
  targetCtx.closePath();
  targetCtx.fill();

  let grad2 = targetCtx.createRadialGradient(w / 2, h * 0.3, 1, w / 2 + beamDist, h * 0.3 + beamSpread / 2, beamDist);
  grad2.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
  grad2.addColorStop(1, 'rgba(255, 255, 255, 0)');
  targetCtx.fillStyle = grad2;
  targetCtx.beginPath();
  targetCtx.moveTo(w / 2, h * 0.3);
  targetCtx.lineTo(w / 2 + beamDist, h * 0.3 - 2);
  targetCtx.lineTo(w / 2 + beamDist, h * 0.3 + beamSpread);
  targetCtx.closePath();
  targetCtx.fill();

  targetCtx.restore();
}

function drawHeatmap(targetCtx) {
  if (!latestState || !latestState.cars) return;
  const segmentCounts = {};
  latestState.cars.forEach(c => {
    const key = `${c.r}_${c.c}_${c.d}`;
    segmentCounts[key] = (segmentCounts[key] || 0) + 1;
  });

  const halfRoad = roadWidth / 2;
  targetCtx.save();

  Object.entries(segmentCounts).forEach(([key, count]) => {
    const [r, c, d] = key.split('_');
    const center = getIntersectionCenter(parseInt(r), parseInt(c));
    let hx = center.x, hy = center.y;
    const len = cellSize * 0.45;

    let heatColor = 'rgba(0, 240, 255, 0.25)';
    if (count >= 5) heatColor = 'rgba(255, 51, 102, 0.55)';
    else if (count >= 3) heatColor = 'rgba(255, 171, 0, 0.45)';
    else if (count >= 2) heatColor = 'rgba(255, 209, 102, 0.35)';

    targetCtx.fillStyle = heatColor;
    targetCtx.shadowColor = heatColor;
    targetCtx.shadowBlur = count * 3;

    if (d === 'N') targetCtx.fillRect(hx - halfRoad, hy, halfRoad, len);
    else if (d === 'S') targetCtx.fillRect(hx, hy - len, halfRoad, len);
    else if (d === 'E') targetCtx.fillRect(hx - len, hy, len, halfRoad);
    else if (d === 'W') targetCtx.fillRect(hx, hy - halfRoad, len, halfRoad);
  });
  targetCtx.restore();
}

function drawInteractionOverlay(targetCtx) {
  if (selectedNode) {
    const center = getIntersectionCenter(selectedNode.r, selectedNode.c);
    targetCtx.save();
    targetCtx.strokeStyle = '#00f0ff';
    targetCtx.lineWidth = 2.5;
    targetCtx.shadowColor = '#00f0ff';
    targetCtx.shadowBlur = 16;
    const halfBox = roadWidth / 2 + 5;
    targetCtx.strokeRect(center.x - halfBox, center.y - halfBox, halfBox * 2, halfBox * 2);
    targetCtx.restore();
  }

  if (isDraggingDispatch && dragStartNode) {
    const startCenter = getIntersectionCenter(dragStartNode.r, dragStartNode.c);
    targetCtx.save();

    targetCtx.fillStyle = '#00f0ff';
    targetCtx.shadowColor = '#00f0ff';
    targetCtx.shadowBlur = 12;
    targetCtx.beginPath();
    targetCtx.arc(startCenter.x, startCenter.y, 8, 0, Math.PI * 2);
    targetCtx.fill();

    targetCtx.setLineDash([6, 6]);
    targetCtx.lineDashOffset = -performance.now() * 0.04;
    targetCtx.strokeStyle = '#00f0ff';
    targetCtx.lineWidth = 3;
    targetCtx.beginPath();
    targetCtx.moveTo(startCenter.x, startCenter.y);
    targetCtx.lineTo(currentMousePos.x, currentMousePos.y);
    targetCtx.stroke();

    if (hoveredNode) {
      const targetCenter = getIntersectionCenter(hoveredNode.r, hoveredNode.c);
      targetCtx.fillStyle = 'rgba(0, 240, 255, 0.3)';
      targetCtx.beginPath();
      targetCtx.arc(targetCenter.x, targetCenter.y, roadWidth * 0.7, 0, Math.PI * 2);
      targetCtx.fill();
    }

    targetCtx.restore();
  }
}

function roundRect(targetCtx, x, y, width, height, radius) {
  targetCtx.beginPath();
  targetCtx.moveTo(x + radius, y);
  targetCtx.lineTo(x + width - radius, y);
  targetCtx.quadraticCurveTo(x + width, y, x + width, y + radius);
  targetCtx.lineTo(x + width, y + height - radius);
  targetCtx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  targetCtx.lineTo(x + radius, y + height);
  targetCtx.quadraticCurveTo(x, y + height, x, y + height - radius);
  targetCtx.lineTo(x, y + radius);
  targetCtx.quadraticCurveTo(x, y, x + radius, y);
  targetCtx.closePath();
}

/* ========================================================
   NETWORK POLLING & STARTUP
   ======================================================== */

async function fetchState() {
  try {
    const res = await fetch('/state');
    if (res.ok) {
      const data = await res.json();
      latestState = data;

      if (data.tick !== lastTick) {
        lastTick = data.tick;
        updateCarsFromState(data.cars || [], trackedCars);
        if (data.baseline && data.baseline.cars) {
          updateCarsFromState(data.baseline.cars, trackedBaselineCars);
        }
        updateSignals(data.signals, data.tick);
      }

      updateMetricsUI(data, null);
    }
  } catch (err) {}
}

setInterval(fetchState, 100);
setInterval(fetchMessages, 1200);

window.addEventListener('DOMContentLoaded', () => {
  resizeCanvases();
  window.addEventListener('resize', resizeCanvases);
  initMiniChart();
  fetchMessages();

  // Attach button listeners directly
  const aBtn = document.getElementById('analyticsToggle');
  if (aBtn) aBtn.addEventListener('click', openAnalyticsModal);

  const cBtn = document.getElementById('compareToggle');
  if (cBtn) {
    cBtn.addEventListener('click', () => {
      compareMode = !compareMode;
      cBtn.classList.toggle('active', compareMode);
      const mc = document.getElementById('mainContainer');
      if (mc) mc.classList.toggle('compare-mode', compareMode);
      setTimeout(resizeCanvases, 50);
    });
  }

  const hBtn = document.getElementById('heatmapToggle');
  if (hBtn) {
    hBtn.addEventListener('click', () => {
      heatmapEnabled = !heatmapEnabled;
      hBtn.classList.toggle('active', heatmapEnabled);
    });
  }

  const sDens = document.getElementById('sliderDensity');
  if (sDens) {
    sDens.addEventListener('input', e => {
      const val = parseFloat(e.target.value);
      document.getElementById('densityVal').textContent = `${val.toFixed(1)}x`;
      ctrl('set_density', { density: val });
    });
  }

  const sSpd = document.getElementById('sliderSpeed');
  if (sSpd) {
    sSpd.addEventListener('input', e => {
      const val = parseFloat(e.target.value);
      document.getElementById('speedVal').textContent = `${val.toFixed(1)}x`;
      ctrl('set_speed', { speed: val });
    });
  }

  const sEps = document.getElementById('sliderEps');
  if (sEps) {
    sEps.addEventListener('input', e => {
      const val = parseFloat(e.target.value);
      document.getElementById('epsVal').textContent = val.toFixed(2);
      ctrl('set_exploration', { eps: val });
    });
  }



  requestAnimationFrame(render);
});
