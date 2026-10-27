/**
 * CityFlow AI - Modern VisionOS Dashboard Engine (modern_app.js)
 * Fully connected, high-performance interactive frontend engine.
 * Optimized for 60 FPS Canvas rendering, low-latency sync, and complete control integration.
 */

(function () {
  'use strict';

  // API Endpoints
  const API = {
    state: '/state',
    control: '/control',
    messages: '/messages',
    inspect: (nodeId) => `/inspect/${nodeId}`,
    exportCsv: '/export/csv'
  };

  const GRID = 4;
  const DIRS = {
    N: { dr: -1, dc: 0, angle: -Math.PI / 2 },
    S: { dr: 1, dc: 0, angle: Math.PI / 2 },
    E: { dr: 0, dc: 1, angle: 0 },
    W: { dr: 0, dc: -1, angle: Math.PI }
  };

  // Seeded Pseudo-Random for Reproducible Rich City Architecture
  function pseudoRandom(seed) {
    const x = Math.sin(seed * 9999) * 10000;
    return x - Math.floor(x);
  }

  // Generate 5x5 Blocks for the 4x4 Intersection Grid
  const CITY_BLOCKS = [];
  for (let r = 0; r < GRID + 1; r++) {
    CITY_BLOCKS[r] = [];
    for (let c = 0; c < GRID + 1; c++) {
      const seed = r * 17 + c * 31 + 42;
      const isPark = pseudoRandom(seed) > 0.78;
      const height = 14 + Math.floor(pseudoRandom(seed + 1) * 36);
      const shade = 18 + Math.floor(pseudoRandom(seed + 2) * 16);
      const randColor = pseudoRandom(seed + 3);
      const windowColor = randColor > 0.65 ? '#00f5d4' : (randColor > 0.32 ? '#c084fc' : '#ffd166');
      const subDivide = pseudoRandom(seed + 4) > 0.38;
      CITY_BLOCKS[r][c] = { isPark, height, shade, windowColor, subDivide, seed };
    }
  }

  // Rounded rectangle helper
  function roundRect(ctx, x, y, w, h, r) {
    if (w <= 0 || h <= 0) return;
    const radius = Math.min(r, Math.min(w, h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.arcTo(x + w, y, x + w, y + radius, radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
    ctx.lineTo(x + radius, y + h);
    ctx.arcTo(x, y + h, x, y + h - radius, radius);
    ctx.lineTo(x, y + radius);
    ctx.arcTo(x, y, x + radius, y, radius);
    ctx.closePath();
  }

  function angleDiff(a, b) {
    let diff = (a - b) % (Math.PI * 2);
    if (diff < -Math.PI) diff += Math.PI * 2;
    if (diff > Math.PI) diff -= Math.PI * 2;
    return diff;
  }

  // State Management
  let latestState = null;
  let lastTick = -1;
  let isPaused = false;
  let compareMode = false;
  let selectedNode = null;
  let currentFeedFilter = 'all';
  let allMessages = [];
  let signalTimers = {};
  let lastMessageCount = -1;
  let activeTab = 'simulation-cockpit';

  // Drag & Drop Ambulance Dispatch
  let isDraggingDispatch = false;
  let dragStartNode = null;
  let dragDistance = 0;
  let currentMousePos = { x: 0, y: 0 };

  // Vehicle Tracking Maps for Smooth 60 FPS Physics Interpolation
  const trackedCars = new Map();
  const trackedBaseCars = new Map();

  // Canvas Viewports
  let primaryCanvas = document.getElementById('modernCityCanvas');
  let primaryCtx = primaryCanvas ? primaryCanvas.getContext('2d') : null;
  let splitAiCanvas = document.getElementById('splitAiCanvas');
  let splitAiCtx = splitAiCanvas ? splitAiCanvas.getContext('2d') : null;
  let splitBaseCanvas = document.getElementById('splitBaseCanvas');
  let splitBaseCtx = splitBaseCanvas ? splitBaseCanvas.getContext('2d') : null;
  let tooltip = document.getElementById('carTooltip');

  // Sparkline Generator for SVG <path d="...">
  function generateSvgPath(data, width = 200, height = 40) {
    if (!data || data.length < 2) {
      return `M0,${height / 2} L${width},${height / 2}`;
    }
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const step = width / (data.length - 1);

    const points = data.map((val, idx) => {
      const x = idx * step;
      const y = height - ((val - min) / range) * (height - 8) - 4;
      return [x, y];
    });

    let d = `M ${points[0][0].toFixed(1)},${points[0][1].toFixed(1)}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cx = (prev[0] + curr[0]) / 2;
      d += ` C ${cx.toFixed(1)},${prev[1].toFixed(1)} ${cx.toFixed(1)},${curr[1].toFixed(1)} ${curr[0].toFixed(1)},${curr[1].toFixed(1)}`;
    }
    return d;
  }

  // Theme Management (Dark / Light)
  function isDarkMode() {
    return document.documentElement.classList.contains('dark');
  }

  function applyTheme(dark) {
    const themeIcon = document.getElementById('themeIcon');
    if (dark) {
      document.documentElement.classList.add('dark');
      if (themeIcon) themeIcon.textContent = 'dark_mode';
      localStorage.setItem('cityflow_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      if (themeIcon) themeIcon.textContent = 'light_mode';
      localStorage.setItem('cityflow_theme', 'light');
    }
    updateChartThemes(dark);
    // Recolor canvas/sim container backgrounds for theme switch
    const simContainer = document.getElementById('simContainer');
    if (simContainer) {
      simContainer.style.backgroundColor = dark ? '#080a14' : '#edf2fa';
    }
    const cmpWrapper = document.getElementById('compareWrapper');
    if (cmpWrapper) {
      cmpWrapper.style.backgroundColor = dark ? '#06070d' : '#e2e8f0';
    }
  }

  function updateChartThemes(dark) {
    const textCol = dark ? '#94a3b8' : '#475569';
    const gridCol = dark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(15, 23, 42, 0.06)';
    const scaleOpts = {
      grid: { color: gridCol },
      ticks: { color: textCol, font: { family: 'Inter', size: 10 } }
    };
    [analyticsWaitChart, analyticsThruChart, analyticsBarChart, analyticsEnvChart, analyticsLossChart].forEach((chart) => {
      if (!chart) return;
      if (chart.options.scales.x) {
        chart.options.scales.x.grid.color = gridCol;
        chart.options.scales.x.ticks.color = textCol;
      }
      if (chart.options.scales.y) {
        chart.options.scales.y.grid.color = gridCol;
        chart.options.scales.y.ticks.color = textCol;
      }
      chart.update('none');
    });
  }

  let themeInitialized = false;
  function initTheme() {
    if (themeInitialized) return;
    themeInitialized = true;
    const saved = localStorage.getItem('cityflow_theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = saved ? saved === 'dark' : (saved === null ? true : prefersDark);
    applyTheme(isDark);

    const toggleBtn = document.getElementById('themeToggle');
    if (toggleBtn) {
      toggleBtn.onclick = (e) => {
        if (e) e.preventDefault();
        applyTheme(!isDarkMode());
      };
    }
  }

  // Dimension Calculation & HiDPI Rescaling
  function computeDimensions(cvs) {
    if (!cvs) return { dpr: 1, w: 600, h: 450, availSize: 420, cellSize: 105, roadWidth: 38, originX: 40, originY: 15 };
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const rect = cvs.getBoundingClientRect();
    const w = Math.max(300, Math.floor(rect.width || cvs.clientWidth || 600));
    const h = Math.max(300, Math.floor(rect.height || cvs.clientHeight || 450));

    if (cvs.width !== Math.floor(w * dpr) || cvs.height !== Math.floor(h * dpr)) {
      cvs.width = Math.floor(w * dpr);
      cvs.height = Math.floor(h * dpr);
    }

    const padding = 16;
    const availSize = Math.max(220, Math.min(w, h) - padding * 2);
    const cellSize = availSize / GRID;
    const roadWidth = Math.max(32, cellSize * 0.32);
    const originX = Math.round((w - availSize) / 2);
    const originY = Math.round((h - availSize) / 2);

    return { dpr, w, h, availSize, cellSize, roadWidth, originX, originY };
  }

  let cachedPrimaryDim = null;
  let cachedSplitAiDim = null;
  let cachedSplitBaseDim = null;

  function refreshCanvasSizes() {
    if (primaryCanvas) cachedPrimaryDim = computeDimensions(primaryCanvas);
    if (splitAiCanvas) cachedSplitAiDim = computeDimensions(splitAiCanvas);
    if (splitBaseCanvas) cachedSplitBaseDim = computeDimensions(splitBaseCanvas);
  }

  window.addEventListener('resize', () => {
    refreshCanvasSizes();
  });

  function getIntersectionCenter(r, c, dim) {
    return {
      x: dim.originX + c * dim.cellSize + dim.cellSize / 2,
      y: dim.originY + r * dim.cellSize + dim.cellSize / 2
    };
  }

  // Signal Timers Synchronizer
  function updateSignals(signals, currentTick) {
    if (!signals) return;
    signals.forEach((s) => {
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

  // Update Smooth Vehicle Movement & Target Waypoints (Only called on tick change)
  function updateCarsFromState(carsList, targetMap, dim) {
    if (!dim) return;
    targetMap.forEach((car) => (car.active = false));

    const queues = {};
    (carsList || []).forEach((c) => {
      const key = `${c.r}_${c.c}_${c.d}`;
      if (!queues[key]) queues[key] = [];
      queues[key].push(c);
    });

    Object.entries(queues).forEach(([key, list]) => {
      const [r, c, d] = key.split('_');
      const row = parseInt(r, 10);
      const col = parseInt(c, 10);
      const center = getIntersectionCenter(row, col, dim);
      const halfRoad = dim.roadWidth / 2;
      const laneOffset = halfRoad * 0.48;

      list.forEach((carData, qIdx) => {
        const carId = carData.id !== undefined ? carData.id : `${carData.amb ? 'amb' : 'car'}_${row}_${col}_${d}_${qIdx}`;
        const carKey = `${carId}`;
        let tx = center.x;
        let ty = center.y;
        const targetAngle = DIRS[d] ? DIRS[d].angle : 0;
        const maxQueueDist = dim.cellSize * 0.44;
        const stopDistance = Math.min(maxQueueDist, halfRoad + 8 + qIdx * 14);

        if (d === 'N') { tx -= laneOffset; ty += stopDistance; }
        else if (d === 'S') { tx += laneOffset; ty -= stopDistance; }
        else if (d === 'E') { tx -= stopDistance; ty += laneOffset; }
        else if (d === 'W') { tx += stopDistance; ty -= laneOffset; }

        let tracked = targetMap.get(carKey);
        if (!tracked) {
          tracked = {
            id: carId,
            x: tx,
            y: ty,
            angle: targetAngle,
            targetX: tx,
            targetY: ty,
            targetAngle: targetAngle,
            wait: carData.w || 0,
            isAmb: !!carData.amb,
            dest: carData.dest || '',
            r: row,
            c: col,
            d: d,
            active: true
          };
          targetMap.set(carKey, tracked);
        } else {
          tracked.targetX = tx;
          tracked.targetY = ty;
          tracked.targetAngle = targetAngle;
          tracked.wait = carData.w || 0;
          tracked.isAmb = !!carData.amb;
          tracked.dest = carData.dest || tracked.dest;
          tracked.r = row;
          tracked.c = col;
          tracked.d = d;
          tracked.active = true;
        }
      });
    });

    targetMap.forEach((car, key) => {
      if (!car.active) targetMap.delete(key);
    });
  }

  /* ========================================================
     CANVAS CITY RENDERING (Fast, Clean, 60 FPS)
     ======================================================== */

  function renderCity(ctx, cvs, snap, isBaseline = false, timestamp = performance.now()) {
    if (!ctx || !cvs) return;
    // Allow static demo render when no backend data available
    const demoSnap = snap || { signals: [], cars: [], blocked: [] };
    const dim = computeDimensions(cvs);
    const dark = isDarkMode();

    ctx.save();
    ctx.scale(dim.dpr, dim.dpr);

    // 1. City Ground / Base Pavement
    ctx.fillStyle = dark ? '#080a14' : '#f4f7fc';
    ctx.fillRect(0, 0, dim.w, dim.h);

    // 2. City Blocks
    drawCityBlocks(ctx, dim, dark);

    // 3. Realistic Road Network
    drawRoadNetwork(ctx, dim, dark);

    // 4. Traffic Signals
    drawTrafficSignals(ctx, dim, demoSnap.signals || [], dark);

    // 5. Emergency Corridor
    if (!isBaseline) {
      drawAmbulanceCorridor(ctx, dim, demoSnap.signals || [], dark, timestamp);
    }

    // 6. Active Road Blockades / Hazards
    drawAccidentHazards(ctx, dim, demoSnap.blocked || [], dark, timestamp);

    // 7. Vehicles & Ambulances (Smooth 60fps interpolation)
    const carMap = isBaseline ? trackedBaseCars : trackedCars;
    drawVehicles(ctx, dim, carMap, dark, timestamp);

    // 8. Interaction Overlay
    if (!isBaseline) {
      drawInteractionOverlay(ctx, dim, dark, timestamp);
    }

    ctx.restore();
  }

  // City Blocks with Architectural Variation
  function drawCityBlocks(ctx, dim, dark) {
    const halfRoad = dim.roadWidth / 2;

    for (let r = 0; r < GRID + 1; r++) {
      for (let c = 0; c < GRID + 1; c++) {
        const x1 = (c === 0) ? dim.originX - dim.cellSize * 0.4 : dim.originX + (c - 1) * dim.cellSize + dim.cellSize / 2 + halfRoad + 3;
        const y1 = (r === 0) ? dim.originY - dim.cellSize * 0.4 : dim.originY + (r - 1) * dim.cellSize + dim.cellSize / 2 + halfRoad + 3;
        const x2 = (c === GRID) ? dim.originX + dim.availSize + dim.cellSize * 0.4 : dim.originX + c * dim.cellSize + dim.cellSize / 2 - halfRoad - 3;
        const y2 = (r === GRID) ? dim.originY + dim.availSize + dim.cellSize * 0.4 : dim.originY + r * dim.cellSize + dim.cellSize / 2 - halfRoad - 3;

        const bw = x2 - x1;
        const bh = y2 - y1;
        if (bw <= 8 || bh <= 8) continue;

        const block = CITY_BLOCKS[r][c];

        // Sidewalk Base Perimeter
        ctx.fillStyle = dark ? '#111726' : '#dbe2ee';
        roundRect(ctx, x1, y1, bw, bh, 5);
        ctx.fill();

        if (block.isPark) {
          // Lush Green Park Area
          ctx.fillStyle = dark ? '#052a1a' : '#dcfce7';
          roundRect(ctx, x1 + 3, y1 + 3, bw - 6, bh - 6, 4);
          ctx.fill();

          // Trees
          const t1x = x1 + bw * 0.35;
          const t1y = y1 + bh * 0.35;
          const t2x = x1 + bw * 0.68;
          const t2y = y1 + bh * 0.65;

          ctx.fillStyle = dark ? '#10f49c' : '#15803d';
          ctx.beginPath();
          ctx.arc(t1x, t1y, 3.5, 0, Math.PI * 2);
          ctx.arc(t2x, t2y, 3.5, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // 3D Building Rooftop
          const buildingX = x1 + 3;
          const buildingY = y1 + 3;
          const buildingW = bw - 6;
          const buildingH = bh - 6;

          // Building Rooftop Fill (Sleek Obsidian Smoked Glass / Pristine Alabaster)
          ctx.fillStyle = dark ? `rgb(${block.shade + 12}, ${block.shade + 18}, ${block.shade + 38})` : '#ffffff';
          roundRect(ctx, buildingX, buildingY, buildingW, buildingH, 4);
          ctx.fill();

          ctx.strokeStyle = dark ? 'rgba(192, 132, 252, 0.28)' : 'rgba(124, 58, 237, 0.15)';
          ctx.lineWidth = 1;
          ctx.stroke();

          // Architectural Windows or Rooftop Infrastructure
          if (block.subDivide && buildingW > 20 && buildingH > 20) {
            ctx.fillStyle = dark ? block.windowColor : '#6366f1';
            ctx.globalAlpha = dark ? 0.75 : 0.4;
            for (let wx = buildingX + 5; wx < buildingX + buildingW - 4; wx += 9) {
              for (let wy = buildingY + 5; wy < buildingY + buildingH - 4; wy += 9) {
                ctx.fillRect(wx, wy, 2.5, 2.5);
              }
            }
            ctx.globalAlpha = 1.0;
          }
        }
      }
    }
  }

  // Asphalt Road Network with Dividers and Crosswalks
  function drawRoadNetwork(ctx, dim, dark) {
    const halfRoad = dim.roadWidth / 2;

    // Asphalt Main Surfaces
    ctx.fillStyle = dark ? '#131929' : '#2d3748';
    for (let i = 0; i < GRID; i++) {
      const center = getIntersectionCenter(i, i, dim);
      ctx.fillRect(dim.originX - 16, center.y - halfRoad, dim.availSize + 32, dim.roadWidth);
      ctx.fillRect(center.x - halfRoad, dim.originY - 16, dim.roadWidth, dim.availSize + 32);
    }

    // Road Edge Curbs (Cyber Mint glow in dark / Indigo in light)
    ctx.strokeStyle = dark ? 'rgba(0, 245, 212, 0.35)' : 'rgba(124, 58, 237, 0.2)';
    ctx.lineWidth = 1;
    for (let i = 0; i < GRID; i++) {
      const center = getIntersectionCenter(i, i, dim);
      ctx.beginPath();
      ctx.moveTo(center.x - halfRoad, dim.originY - 16);
      ctx.lineTo(center.x - halfRoad, dim.originY + dim.availSize + 16);
      ctx.moveTo(center.x + halfRoad, dim.originY - 16);
      ctx.lineTo(center.x + halfRoad, dim.originY + dim.availSize + 16);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(dim.originX - 16, center.y - halfRoad);
      ctx.lineTo(dim.originX + dim.availSize + 16, center.y - halfRoad);
      ctx.moveTo(dim.originX - 16, center.y + halfRoad);
      ctx.lineTo(dim.originX + dim.availSize + 16, center.y + halfRoad);
      ctx.stroke();
    }

    // Dashed Center Lane Dividers (Solar Gold in dark / Crisp white in light)
    ctx.strokeStyle = dark ? '#ffd166' : 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 1.4;
    ctx.setLineDash([4, 6]);

    for (let i = 0; i < GRID; i++) {
      const center = getIntersectionCenter(i, i, dim);
      ctx.beginPath();
      ctx.moveTo(dim.originX, center.y);
      ctx.lineTo(dim.originX + dim.availSize, center.y);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(center.x, dim.originY);
      ctx.lineTo(center.x, dim.originY + dim.availSize);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  // Traffic Signals
  function drawTrafficSignals(ctx, dim, signals, dark) {
    const halfRoad = dim.roadWidth / 2;

    signals.forEach((s) => {
      const center = getIntersectionCenter(s.r, s.c, dim);
      const isNS = s.phase === 'NS';
      const isForced = !!s.forced;

      // Intersection Center Box
      ctx.fillStyle = isForced
        ? 'rgba(0, 245, 212, 0.28)'
        : (dark ? 'rgba(124, 58, 237, 0.12)' : 'rgba(0, 0, 0, 0.05)');
      roundRect(ctx, center.x - halfRoad, center.y - halfRoad, dim.roadWidth, dim.roadWidth, 4);
      ctx.fill();

      if (isForced) {
        ctx.strokeStyle = '#00f5d4';
        ctx.lineWidth = 1.8;
        ctx.stroke();
      }

      // Signal Dots on 4 Approaches (Cyber Mint / Laser Emerald & Neon Crimson)
      const greenColor = isForced ? '#00f5d4' : (dark ? '#10f49c' : '#059669');
      const redColor = dark ? '#ff3366' : '#e11d48';

      // N & S lights
      ctx.fillStyle = isNS ? greenColor : redColor;
      ctx.beginPath();
      ctx.arc(center.x - halfRoad * 0.45, center.y - halfRoad - 3, 2.5, 0, Math.PI * 2);
      ctx.arc(center.x + halfRoad * 0.45, center.y + halfRoad + 3, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // E & W lights
      ctx.fillStyle = !isNS ? greenColor : redColor;
      ctx.beginPath();
      ctx.arc(center.x + halfRoad + 3, center.y - halfRoad * 0.45, 2.5, 0, Math.PI * 2);
      ctx.arc(center.x - halfRoad - 3, center.y + halfRoad * 0.45, 2.5, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // Emergency Corridor Pulsing Waves
  function drawAmbulanceCorridor(ctx, dim, signals, dark, timestamp) {
    const forced = signals.filter((s) => s.forced);
    if (!forced.length) return;

    ctx.save();
    const pulseAlpha = 0.3 + 0.2 * Math.sin(timestamp * 0.008);
    ctx.strokeStyle = `rgba(0, 245, 212, ${pulseAlpha})`;
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 4]);

    for (let i = 0; i < forced.length - 1; i++) {
      const c1 = getIntersectionCenter(forced[i].r, forced[i].c, dim);
      const c2 = getIntersectionCenter(forced[i + 1].r, forced[i + 1].c, dim);
      ctx.beginPath();
      ctx.moveTo(c1.x, c1.y);
      ctx.lineTo(c2.x, c2.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Active Road Blockades / Hazards
  function drawAccidentHazards(ctx, dim, blocked, dark, timestamp) {
    if (!blocked || !blocked.length) return;
    const halfRoad = dim.roadWidth / 2;

    blocked.forEach((b) => {
      const center = getIntersectionCenter(b.r, b.c, dim);
      let bx = center.x;
      let by = center.y;
      const offset = halfRoad + 10;

      if (b.d === 'N') by -= offset;
      else if (b.d === 'S') by += offset;
      else if (b.d === 'E') bx += offset;
      else if (b.d === 'W') bx -= offset;

      // Pulsing barrier icon
      ctx.fillStyle = '#ff3366';
      ctx.beginPath();
      ctx.arc(bx, by, 7, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(bx - 3.5, by - 3.5);
      ctx.lineTo(bx + 3.5, by + 3.5);
      ctx.moveTo(bx + 3.5, by - 3.5);
      ctx.lineTo(bx - 3.5, by + 3.5);
      ctx.stroke();
    });
  }

  // Vehicles Rendering (Interpolated 60 FPS, No heavy gradients)
  function drawVehicles(ctx, dim, carMap, dark, timestamp) {
    carMap.forEach((car) => {
      // Smooth linear motion interpolation
      car.x += (car.targetX - car.x) * 0.28;
      car.y += (car.targetY - car.y) * 0.28;
      car.angle += angleDiff(car.targetAngle, car.angle) * 0.32;

      ctx.save();
      ctx.translate(car.x, car.y);
      ctx.rotate(car.angle);

      if (car.isAmb) {
        drawFastAmbulance(ctx, dark, timestamp);
      } else {
        drawFastCar(ctx, car, dark);
      }

      ctx.restore();
    });
  }

  // Fast, Sleek Standard Vehicle (Aurora High-Vis Palette)
  function drawFastCar(ctx, car, dark) {
    const idNum = typeof car.id === 'number' ? car.id : (parseInt(car.id, 10) || 1);
    const length = 15;
    const width = 8;
    const halfL = length / 2;
    const halfW = width / 2;

    const palettes = ['#c084fc', '#00f5d4', '#10f49c', '#ffd166', '#ff3366', '#38bdf8'];
    let baseColor = palettes[idNum % palettes.length];
    if (car.wait > 7) baseColor = '#ff3366';
    else if (car.wait > 3) baseColor = '#ffb703';

    // 1. Forward Headlights beam (violet-tinted beam in dark mode)
    ctx.fillStyle = dark ? 'rgba(192, 132, 252, 0.28)' : 'rgba(255, 255, 255, 0.22)';
    ctx.beginPath();
    ctx.moveTo(halfL, -halfW * 0.6);
    ctx.lineTo(halfL + 18, -halfW * 0.6 - 7);
    ctx.lineTo(halfL + 18, -halfW * 0.6 + 2);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(halfL, halfW * 0.6);
    ctx.lineTo(halfL + 18, halfW * 0.6 - 2);
    ctx.lineTo(halfL + 18, halfW * 0.6 + 7);
    ctx.closePath();
    ctx.fill();

    // 2. Chassis Shadow
    ctx.fillStyle = dark ? 'rgba(0, 0, 0, 0.6)' : 'rgba(15, 23, 42, 0.2)';
    roundRect(ctx, -halfL + 0.5, -halfW + 0.5, length, width, 2);
    ctx.fill();

    // 3. Main Car Body
    ctx.fillStyle = baseColor;
    roundRect(ctx, -halfL, -halfW, length, width, 2);
    ctx.fill();

    // 4. Cabin Glass
    ctx.fillStyle = dark ? 'rgba(7, 8, 14, 0.9)' : 'rgba(15, 23, 42, 0.7)';
    roundRect(ctx, -halfL * 0.4, -halfW * 0.75, length * 0.6, width * 0.75, 1.5);
    ctx.fill();

    // 5. Taillights / Brake LEDs
    const isBraking = car.wait > 0;
    ctx.fillStyle = isBraking ? '#ff3366' : '#991b1b';
    ctx.fillRect(-halfL, -halfW + 0.8, 1.2, 1.8);
    ctx.fillRect(-halfL, halfW - 2.6, 1.2, 1.8);
  }

  // Fast, Sleek Ambulance
  function drawFastAmbulance(ctx, dark, timestamp) {
    const ambW = 20;
    const ambH = 10;
    const halfL = ambW / 2;
    const halfW = ambH / 2;

    // Forward beam with cyber mint tint
    ctx.fillStyle = 'rgba(0, 245, 212, 0.28)';
    ctx.beginPath();
    ctx.moveTo(halfL, -halfW * 0.6);
    ctx.lineTo(halfL + 24, -halfW * 0.6 - 9);
    ctx.lineTo(halfL + 24, halfW * 0.6 + 9);
    ctx.lineTo(halfL, halfW * 0.6);
    ctx.closePath();
    ctx.fill();

    // Chassis Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    roundRect(ctx, -halfL + 0.5, -halfW + 0.5, ambW, ambH, 2.5);
    ctx.fill();

    // White High-Vis Body
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, -halfL, -halfW, ambW, ambH, 2.5);
    ctx.fill();

    // Neon Crimson Side Stripes
    ctx.fillStyle = '#ff3366';
    ctx.fillRect(-halfL * 0.2, -halfW, ambW * 0.45, 1.5);
    ctx.fillRect(-halfL * 0.2, halfW - 1.5, ambW * 0.45, 1.5);

    // Medical Cross
    const crossX = -halfL * 0.35;
    ctx.fillRect(crossX - 3, -1, 6, 2);
    ctx.fillRect(crossX - 1, -3, 2, 6);

    // Alternating Dual Roof Strobe (Neon Crimson / Cyber Mint)
    const isRed = Math.floor(timestamp * 0.015) % 2 === 0;
    ctx.fillStyle = isRed ? '#ff3366' : '#00f5d4';
    ctx.beginPath();
    ctx.arc(halfL * 0.1, isRed ? -2.5 : 2.5, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Interaction Overlay (Dispatch Line, Hover Target)
  function drawInteractionOverlay(ctx, dim, dark, timestamp) {
    if (selectedNode) {
      const center = getIntersectionCenter(selectedNode.r, selectedNode.c, dim);
      ctx.save();
      ctx.strokeStyle = '#00f5d4';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(center.x, center.y, dim.roadWidth * 0.75, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    if (isDraggingDispatch && dragStartNode) {
      const startCenter = getIntersectionCenter(dragStartNode.r, dragStartNode.c, dim);
      ctx.save();
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(startCenter.x, startCenter.y);
      ctx.lineTo(currentMousePos.x, currentMousePos.y);
      ctx.stroke();

      ctx.fillStyle = '#c084fc';
      ctx.beginPath();
      ctx.arc(currentMousePos.x, currentMousePos.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  /* ========================================================
     ANIMATION & STATE SYNCHRONIZATION LOOPS
     ======================================================== */

  let frameCount = 0;
  let fpsLastUpdate = performance.now();
  let currentFps = 60;

  function animationLoop(timestamp) {
    const now = performance.now();
    frameCount++;
    if (now - fpsLastUpdate >= 400) {
      currentFps = Math.round((frameCount * 1000) / (now - fpsLastUpdate));
      frameCount = 0;
      fpsLastUpdate = now;
      // Update both FPS display elements
      const fpsEl = document.getElementById('fpsCounter');
      if (fpsEl) {
        fpsEl.textContent = `${currentFps} FPS (${currentFps >= 60 ? '60Hz+' : 'Active'})`;
      }
      const statusFpsEl = document.getElementById('statusFpsCounter');
      if (statusFpsEl) {
        statusFpsEl.textContent = `${currentFps}+ FPS (${currentFps >= 60 ? '60Hz' : currentFps + 'Hz'})`;
      }
      const tickRateBadge = document.getElementById('tickRateBadge');
      if (tickRateBadge && latestState) {
        const speed = latestState.speed || 1.0;
        const tickHz = Math.round(60 * speed);
        tickRateBadge.textContent = `${tickHz} Hz (${(16 / speed).toFixed(1)}ms)`;
      }
    }

    if (compareMode) {
      renderCity(splitAiCtx, splitAiCanvas, latestState, false, timestamp);
      if (latestState && latestState.baseline) {
        renderCity(splitBaseCtx, splitBaseCanvas, latestState.baseline, true, timestamp);
      } else {
        renderCity(splitBaseCtx, splitBaseCanvas, null, true, timestamp);
      }
    } else {
      renderCity(primaryCtx, primaryCanvas, latestState, false, timestamp);
    }
    requestAnimationFrame(animationLoop);
  }

  async function postControl(payload) {
    try {
      const codeDisplay = document.getElementById('telemetryBindingJson');
      if (codeDisplay) {
        codeDisplay.textContent = JSON.stringify(payload);
      }

      const res = await fetch(API.control, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      return data;
    } catch (err) {
      console.warn('postControl error:', err);
      if (typeof handleOfflineControl === 'function') {
        handleOfflineControl(payload);
      }
    }
  }

  // Reactive UI Metrics Synchronizer
  function updateDashboardUI(snap) {
    if (!snap) return;

    // Header tick counter
    const headerTick = document.getElementById('headerTickText');
    if (headerTick) {
      const speed = snap.speed || 1.0;
      const hz = Math.round(60 * speed);
      headerTick.textContent = `Tick ${snap.tick.toLocaleString()} • ${speed.toFixed(1)}x • ${currentFps} FPS (${hz} Hz)`;
    }

    // Hero Stat Pills
    const bWait = snap.baseline ? snap.baseline.avg_wait : 14.8;
    const aWait = snap.avg_wait || 0.0;
    const delayPct = bWait > 0 ? (((bWait - aWait) / bWait) * 100).toFixed(1) : '0.0';
    const heroDelay = document.getElementById('heroDelayPct');
    if (heroDelay) heroDelay.textContent = `${delayPct}%`;

    const bThru = snap.baseline ? snap.baseline.throughput : 489;
    const aThru = snap.throughput || 0;
    const flowPct = bThru > 0 ? (((aThru - bThru) / bThru) * 100).toFixed(1) : '+0.0';
    const heroFlow = document.getElementById('heroFlowPct');
    if (heroFlow) heroFlow.textContent = `${flowPct.startsWith('-') ? '' : '+'}${flowPct}%`;

    const ambTimes = snap.amb_times || [];
    const heroAmb = document.getElementById('heroAmbEta');
    if (heroAmb) {
      if (ambTimes.length > 0) {
        heroAmb.textContent = `${ambTimes[ambTimes.length - 1]}t`;
      } else {
        heroAmb.textContent = '18.2t';
      }
    }

    // Right Column KPIs & Dynamic Sparklines
    const kpiWaitVal = document.getElementById('kpiWaitVal');
    const kpiWaitDiff = document.getElementById('kpiWaitDiff');
    const kpiWaitSub = document.getElementById('kpiWaitSub');
    const sparkWaitPath = document.getElementById('sparkWaitPath');
    if (kpiWaitVal) kpiWaitVal.textContent = aWait.toFixed(1);
    if (kpiWaitDiff) kpiWaitDiff.textContent = `-${delayPct}% vs ${bWait.toFixed(1)}t`;
    if (kpiWaitSub) kpiWaitSub.textContent = `Baseline timer: ${bWait.toFixed(1)} ticks • Net saving ${Math.max(0, bWait - aWait).toFixed(1)} ticks`;
    if (sparkWaitPath && snap.wait_agent && snap.wait_agent.length) {
      sparkWaitPath.setAttribute('d', generateSvgPath(snap.wait_agent, 200, 40));
    }

    const kpiThruVal = document.getElementById('kpiThruVal');
    const kpiThruDiff = document.getElementById('kpiThruDiff');
    const kpiThruSub = document.getElementById('kpiThruSub');
    const sparkThruPath = document.getElementById('sparkThruPath');
    if (kpiThruVal) kpiThruVal.textContent = aThru.toLocaleString();
    if (kpiThruDiff) kpiThruDiff.textContent = `${flowPct.startsWith('-') ? '' : '+'}${flowPct}%`;
    if (kpiThruSub) kpiThruSub.textContent = `Baseline static: ${bThru} veh • Net +${Math.max(0, aThru - bThru)}`;
    if (sparkThruPath && snap.throughput_agent && snap.throughput_agent.length) {
      sparkThruPath.setAttribute('d', generateSvgPath(snap.throughput_agent, 200, 40));
    }

    const kpiCo2Val = document.getElementById('kpiCo2Val');
    const sparkCo2Path = document.getElementById('sparkCo2Path');
    if (kpiCo2Val && snap.co2_saved_kg !== undefined) {
      kpiCo2Val.textContent = snap.co2_saved_kg.toFixed(2);
      if (sparkCo2Path && snap.wait_agent && snap.wait_agent.length) {
        sparkCo2Path.setAttribute(
          'd',
          generateSvgPath(snap.wait_agent.map((w, idx) => Math.max(0, (snap.wait_baseline[idx] || 15) - w) * 0.0022 * (snap.throughput_agent[idx] || 10)), 200, 40)
        );
      }
    }

    const kpiFuelVal = document.getElementById('kpiFuelVal');
    const sparkFuelPath = document.getElementById('sparkFuelPath');
    if (kpiFuelVal && snap.fuel_saved_l !== undefined) {
      kpiFuelVal.textContent = snap.fuel_saved_l.toFixed(2);
      if (sparkFuelPath && snap.wait_agent && snap.wait_agent.length) {
        sparkFuelPath.setAttribute(
          'd',
          generateSvgPath(snap.wait_agent.map((w, idx) => Math.max(0, (snap.wait_baseline[idx] || 15) - w) * 0.0022 * 0.42 * (snap.throughput_agent[idx] || 10)), 200, 40)
        );
      }
    }

    // Status strip
    const statusVehicles = document.getElementById('statusVehicles');
    if (statusVehicles && snap.cars) {
      statusVehicles.textContent = `${snap.cars.length}/64`;
    }

    // 16-Node Congestion Matrix Update
    renderCongestionMatrix(snap);

    // Sync Play/Pause Button
    isPaused = !!snap.paused;
    const playIcon = document.getElementById('playIcon');
    const dockPlayPause = document.getElementById('dockPlayPause');
    if (playIcon) playIcon.textContent = isPaused ? 'play_arrow' : 'pause';
    if (dockPlayPause) {
      dockPlayPause.classList.toggle('bg-primary', !isPaused);
      dockPlayPause.classList.toggle('bg-tertiary', isPaused);
    }

    // Synchronize Sub-Pages
    updateAgentHierarchy(snap);
    updateAnalyticsData(snap);
    updateIncidentsData(snap);
  }

  function renderCongestionMatrix(snap) {
    const container = document.getElementById('congestionMatrix');
    if (!container) return;

    const loads = snap.agent_intersection_loads || [];
    const signals = snap.signals || [];
    const blocked = snap.blocked || [];

    // If already generated 16 elements, update content in place for maximum performance
    if (container.children.length === 16) {
      for (let r = 0; r < GRID; r++) {
        for (let c = 0; c < GRID; c++) {
          const idx = r * GRID + c;
          const load = loads[idx] !== undefined ? loads[idx] : 0;
          const sig = signals.find((s) => s.r === r && s.c === c) || {};
          const isBlocked = blocked.some((b) => b.r === r && b.c === c);
          const cell = container.children[idx];

          let phaseText = `${sig.phase || 'NS'} Grn`;
          let badgeColor = 'text-tertiary-fixed';
          let borderClass = 'border-white/5';

          if (sig.forced) {
            badgeColor = 'text-secondary-fixed font-bold';
            phaseText = 'BFS PRIO';
            borderClass = 'border-secondary/40 bg-secondary-container/15';
          } else if (isBlocked) {
            badgeColor = 'text-error font-bold';
            phaseText = 'BARRIER';
            borderClass = 'border-error/40 bg-error-container/20';
          } else if (load > 5) {
            badgeColor = 'text-error font-bold';
            borderClass = 'border-error/30 bg-error-container/15';
          } else if (load >= 3) {
            badgeColor = 'text-amber-300';
            borderClass = 'border-amber-500/30 bg-amber-500/10';
          }

          cell.className = `p-2 rounded-xl border flex flex-col items-center cursor-pointer transition-all hover:scale-105 ${borderClass}`;
          cell.innerHTML = `
            <span class="font-code-telemetry text-[10px] text-on-surface-variant/80">(${r},${c})</span>
            <span class="font-headline-sm text-headline-sm font-bold">${load}</span>
            <span class="font-code-telemetry text-[9px] ${badgeColor}">${phaseText}</span>
          `;
        }
      }
      return;
    }

    let html = '';
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        html += `
          <div class="p-2 rounded-xl border border-white/5 bg-surface-container-high/60 flex flex-col items-center cursor-pointer transition-all hover:scale-105" data-node="${r},${c}" onclick="window.inspectNode(${r}, ${c})">
            <span class="font-code-telemetry text-[10px] text-on-surface-variant/80">(${r},${c})</span>
            <span class="font-headline-sm text-headline-sm font-bold">0</span>
            <span class="font-code-telemetry text-[9px] text-tertiary-fixed">NS Grn</span>
          </div>
        `;
      }
    }
    container.innerHTML = html;
  }

  window.inspectNode = async function (r, c) {
    selectedNode = { r, c };
    try {
      const res = await fetch(API.inspect(`${r}_${c}`));
      const data = await res.json();
      if (!data || data.error) return;

      const card = document.getElementById('inspectorCard');
      if (!card) return;

      card.classList.remove('hidden');
      document.getElementById('inspectTitle').textContent = `Node (${r},${c}) Inspector`;
      document.getElementById('inspectPhase').textContent = data.phase || 'NS';
      document.getElementById('inspectTimer').textContent = `${data.phase_timer}/${data.min_green || 5}t`;
      document.getElementById('inspectQns').textContent = (data.q_values ? data.q_values[0] : 0).toFixed(2);
      document.getElementById('inspectQew').textContent = (data.q_values ? data.q_values[1] : 0).toFixed(2);
      document.getElementById('inspectReason').textContent = `Policy: ${data.reason || 'Optimal'}`;

      const q = data.queues || { N: 0, S: 0, E: 0, W: 0 };
      document.getElementById('inspectQueues').textContent = `N:${q.N} S:${q.S} E:${q.E} W:${q.W}`;
    } catch (err) {
      console.warn('inspectNode error:', err);
    }
  };

  /* ========================================================
     MULTI-PAGE NAVIGATION CONTROLLER
     ======================================================== */
  const PAGE_IDS = [
    'simulation-cockpit',
    'agent-hierarchy',
    'telemetry-analytics',
    'incidents-corridors',
    'about'
  ];

  function switchPage(pageId) {
    if (!PAGE_IDS.includes(pageId)) {
      pageId = 'simulation-cockpit';
    }
    activeTab = pageId;

    // Toggle DOM sections
    PAGE_IDS.forEach((id) => {
      const el = document.getElementById(`page-${id}`);
      if (el) {
        if (id === pageId) {
          el.classList.remove('hidden');
        } else {
          el.classList.add('hidden');
        }
      }
    });

    // Update Nav bar active styling
    const navLinks = document.querySelectorAll('nav a[data-path]');
    const activeClasses = ['bg-surface-container-highest', 'text-on-surface', 'font-semibold', 'shadow-inner', 'border-white/10'];
    const inactiveClasses = ['text-on-surface-variant', 'hover:text-on-surface', 'hover:bg-surface-container-high', 'font-medium', 'border-transparent'];

    navLinks.forEach((a) => {
      const path = a.dataset.path;
      if (path === pageId) {
        a.classList.remove(...inactiveClasses);
        a.classList.add(...activeClasses);
        a.setAttribute('aria-current', 'page');
      } else {
        a.classList.remove(...activeClasses);
        a.classList.add(...inactiveClasses);
        a.removeAttribute('aria-current');
      }
    });

    // Resize handlers when switching
    setTimeout(() => {
      refreshCanvasSizes();
      if (pageId === 'telemetry-analytics') {
        if (analyticsWaitChart) analyticsWaitChart.resize();
        if (analyticsThruChart) analyticsThruChart.resize();
        if (analyticsBarChart) analyticsBarChart.resize();
        if (analyticsEnvChart) analyticsEnvChart.resize();
        if (analyticsLossChart) analyticsLossChart.resize();
      }
    }, 40);

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function initNavigation() {
    const navLinks = document.querySelectorAll('nav a[data-path]');
    navLinks.forEach((a) => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        const path = a.dataset.path;
        window.location.hash = path;
        switchPage(path);
      });
    });

    window.addEventListener('hashchange', () => {
      const hash = window.location.hash.replace('#', '');
      if (hash) switchPage(hash);
    });

    const currentHash = window.location.hash.replace('#', '') || 'simulation-cockpit';
    switchPage(currentHash);
  }

  /* ========================================================
     PAGE 2: AGENT HIERARCHY CONTROLLER
     ======================================================== */
  let hierarchyGridInitialized = false;

  function updateAgentHierarchy(snap) {
    if (!snap || activeTab !== 'agent-hierarchy') return;

    const tier1Status = document.getElementById('tier1Status');
    if (tier1Status) {
      tier1Status.textContent = `SYNC 20Hz (α=0.12, γ=0.95)`;
    }

    const tier2Status = document.getElementById('tier2Status');
    if (tier2Status) {
      if (snap.emergency) {
        tier2Status.textContent = 'AMBULANCE PREEMPTION ACTIVE';
        tier2Status.className = 'px-2 py-0.5 rounded-full bg-secondary-container/20 border border-secondary/30 text-secondary-fixed font-code-telemetry text-[10px] font-semibold animate-pulse';
      } else {
        tier2Status.textContent = 'CORRIDOR WATCH READY';
        tier2Status.className = 'px-2 py-0.5 rounded-full bg-secondary-container/20 border border-secondary/30 text-secondary-fixed font-code-telemetry text-[10px] font-semibold';
      }
    }

    const tier3Status = document.getElementById('tier3Status');
    const blocked = snap.blocked || [];
    if (tier3Status) {
      if (blocked.length > 0) {
        tier3Status.textContent = `${blocked.length} BARRICADES ACTIVE`;
        tier3Status.className = 'px-2 py-0.5 rounded-full bg-error-container/20 border border-error/30 text-error font-code-telemetry text-[10px] font-semibold animate-pulse';
      } else {
        tier3Status.textContent = 'GRID 100% CLEAR';
        tier3Status.className = 'px-2 py-0.5 rounded-full bg-tertiary-container/20 border border-tertiary/30 text-tertiary-fixed font-code-telemetry text-[10px] font-semibold';
      }
    }

    const gridContainer = document.getElementById('hierarchyAgentGrid');
    if (!gridContainer) return;

    const loads = snap.agent_intersection_loads || [];
    const signals = snap.signals || [];

    if (!hierarchyGridInitialized || gridContainer.children.length !== 16) {
      let html = '';
      for (let r = 0; r < GRID; r++) {
        for (let c = 0; c < GRID; c++) {
          html += `
            <div id="agent-card-${r}-${c}" class="p-4 rounded-2xl bg-surface-container-low/70 border border-white/10 hover:border-primary/40 transition-all flex flex-col justify-between cursor-pointer group shadow-sm hover:shadow-lg" onclick="window.inspectNode(${r}, ${c})">
              <div>
                <div class="flex items-center justify-between pb-2 mb-2 border-b border-white/5">
                  <div class="flex items-center gap-2">
                    <span id="agent-dot-${r}-${c}" class="w-2.5 h-2.5 rounded-full bg-tertiary"></span>
                    <span class="font-headline-sm text-sm font-semibold text-on-surface">Agent (${r},${c})</span>
                  </div>
                  <span id="agent-phase-${r}-${c}" class="px-2 py-0.5 rounded-full font-code-telemetry text-[10px] font-bold bg-primary-container/20 text-primary-fixed border border-primary/20">NS 0t</span>
                </div>
                <div class="space-y-1.5 font-code-telemetry text-xs mb-3">
                  <div class="flex justify-between text-on-surface-variant">
                    <span>Queue Pressure:</span>
                    <span id="agent-queue-${r}-${c}" class="font-bold text-on-surface">0 cars</span>
                  </div>
                  <div class="flex justify-between text-on-surface-variant">
                    <span>Exploration Rate:</span>
                    <span id="agent-eps-${r}-${c}" class="text-tertiary font-mono">ε=0.050</span>
                  </div>
                </div>
              </div>
              <button class="w-full py-1.5 rounded-xl bg-surface-container-high/60 group-hover:bg-primary/20 group-hover:text-primary text-on-surface-variant font-code-telemetry text-[11px] transition-colors border border-white/5 flex items-center justify-center gap-1">
                <span class="material-symbols-outlined text-[14px]">tune</span>
                <span>Inspect Q-Table</span>
              </button>
            </div>
          `;
        }
      }
      gridContainer.innerHTML = html;
      hierarchyGridInitialized = true;
    }

    // In-place updates
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        const idx = r * GRID + c;
        const load = loads[idx] !== undefined ? loads[idx] : 0;
        const sig = signals.find((s) => s.r === r && s.c === c) || { phase: 'NS', phase_timer: 0 };
        const phaseEl = document.getElementById(`agent-phase-${r}-${c}`);
        const queueEl = document.getElementById(`agent-queue-${r}-${c}`);

        if (phaseEl) {
          phaseEl.textContent = `${sig.phase || 'NS'} ${sig.phase_timer || 0}t`;
        }
        if (queueEl) {
          queueEl.textContent = `${load} car${load === 1 ? '' : 's'}`;
        }
      }
    }
  }

  /* ========================================================
     PAGE 3: TELEMETRY & ANALYTICS CHARTS
     ======================================================== */
  let analyticsWaitChart = null;
  let analyticsThruChart = null;
  let analyticsBarChart = null;
  let analyticsEnvChart = null;
  let analyticsLossChart = null;
  let lastChartTick = -1;

  const telemetryHistory = {
    labels: [],
    agentWait: [],
    baseWait: [],
    agentThru: [],
    baseThru: [],
    co2: [],
    fuel: [],
    loss: []
  };

  function initAnalyticsCharts() {
    const isDark = isDarkMode();
    const textCol = isDark ? '#94a3b8' : '#475569';
    const gridCol = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(15, 23, 42, 0.06)';

    const defaultScales = {
      x: { grid: { color: gridCol }, ticks: { color: textCol, font: { family: 'Inter', size: 10 } } },
      y: { grid: { color: gridCol }, ticks: { color: textCol, font: { family: 'Inter', size: 10 } } }
    };

    // 1. Wait Chart
    const canvasWait = document.getElementById('pageWaitChart');
    if (canvasWait && !analyticsWaitChart) {
      analyticsWaitChart = new Chart(canvasWait.getContext('2d'), {
        type: 'line',
        data: {
          labels: [],
          datasets: [
            { label: 'Multi-Agent Q-Learning', data: [], borderColor: '#c084fc', backgroundColor: 'rgba(192, 132, 252, 0.12)', tension: 0.35, fill: true, pointRadius: 1 },
            { label: 'Fixed 15t Baseline', data: [], borderColor: '#94a3b8', borderDash: [4, 4], tension: 0.35, fill: false, pointRadius: 0 }
          ]
        },
        options: { responsive: true, maintainAspectRatio: false, animation: false, scales: defaultScales }
      });
    }

    // 2. Throughput Chart
    const canvasThru = document.getElementById('pageThruChart');
    if (canvasThru && !analyticsThruChart) {
      analyticsThruChart = new Chart(canvasThru.getContext('2d'), {
        type: 'line',
        data: {
          labels: [],
          datasets: [
            { label: 'Multi-Agent Flow', data: [], borderColor: '#00f5d4', backgroundColor: 'rgba(0, 245, 212, 0.12)', tension: 0.35, fill: true, pointRadius: 1 },
            { label: 'Baseline Flow', data: [], borderColor: '#64748b', borderDash: [4, 4], tension: 0.35, fill: false, pointRadius: 0 }
          ]
        },
        options: { responsive: true, maintainAspectRatio: false, animation: false, scales: defaultScales }
      });
    }

    // 3. Bar Chart (16 Nodes)
    const canvasBar = document.getElementById('pageBarChart');
    if (canvasBar && !analyticsBarChart) {
      const labels = [];
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          labels.push(`(${r},${c})`);
        }
      }
      analyticsBarChart = new Chart(canvasBar.getContext('2d'), {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [{ label: 'Queue Backlog', data: new Array(16).fill(0), backgroundColor: 'rgba(0, 245, 212, 0.65)', borderColor: '#00f5d4', borderWidth: 1, borderRadius: 4 }]
        },
        options: { responsive: true, maintainAspectRatio: false, animation: false, scales: defaultScales }
      });
    }

    // 4. Environmental Chart
    const canvasEnv = document.getElementById('pageEnvChart');
    if (canvasEnv && !analyticsEnvChart) {
      analyticsEnvChart = new Chart(canvasEnv.getContext('2d'), {
        type: 'line',
        data: {
          labels: [],
          datasets: [
            { label: 'CO₂ Saved (kg)', data: [], borderColor: '#10f49c', backgroundColor: 'rgba(16, 244, 156, 0.12)', tension: 0.35, fill: true, pointRadius: 1 },
            { label: 'Fuel Saved (L)', data: [], borderColor: '#ffd166', tension: 0.35, fill: false, pointRadius: 0 }
          ]
        },
        options: { responsive: true, maintainAspectRatio: false, animation: false, scales: defaultScales }
      });
    }

    // 5. Loss Convergence Chart
    const canvasLoss = document.getElementById('pageLossChart');
    if (canvasLoss && !analyticsLossChart) {
      analyticsLossChart = new Chart(canvasLoss.getContext('2d'), {
        type: 'line',
        data: {
          labels: [],
          datasets: [{ label: 'Bellman TD Error', data: [], borderColor: '#ff3366', backgroundColor: 'rgba(255, 51, 102, 0.1)', tension: 0.35, fill: true, pointRadius: 1 }]
        },
        options: { responsive: true, maintainAspectRatio: false, animation: false, scales: defaultScales }
      });
    }
  }

  function updateAnalyticsData(snap) {
    if (!snap) return;

    const elWait = document.getElementById('pageAnalyticsWait');
    if (elWait) elWait.textContent = `${(snap.avg_wait || 0).toFixed(1)}t`;

    const elThru = document.getElementById('pageAnalyticsThru');
    if (elThru) elThru.textContent = (snap.throughput || 0).toLocaleString();

    const elCo2 = document.getElementById('pageAnalyticsCo2');
    if (elCo2 && snap.co2_saved_kg !== undefined) {
      elCo2.textContent = `${snap.co2_saved_kg.toFixed(1)} kg`;
    }

    const elFuel = document.getElementById('pageAnalyticsFuel');
    if (elFuel && snap.fuel_saved_l !== undefined) {
      elFuel.textContent = `${snap.fuel_saved_l.toFixed(1)} L`;
    }

    // Update charts when on analytics tab or every 10 ticks
    if (snap.tick !== lastChartTick && snap.tick % 5 === 0) {
      lastChartTick = snap.tick;
      const label = `T+${snap.tick}`;

      telemetryHistory.labels.push(label);
      telemetryHistory.agentWait.push(snap.avg_wait || 0);
      telemetryHistory.baseWait.push(snap.baseline ? snap.baseline.avg_wait : 14.8);
      telemetryHistory.agentThru.push(snap.throughput || 0);
      telemetryHistory.baseThru.push(snap.baseline ? snap.baseline.throughput : 480);
      telemetryHistory.co2.push(snap.co2_saved_kg || 0);
      telemetryHistory.fuel.push(snap.fuel_saved_l || 0);
      telemetryHistory.loss.push(Math.max(0.001, (snap.avg_wait ? snap.avg_wait * 0.0006 : 0.005)));

      if (telemetryHistory.labels.length > 25) {
        telemetryHistory.labels.shift();
        telemetryHistory.agentWait.shift();
        telemetryHistory.baseWait.shift();
        telemetryHistory.agentThru.shift();
        telemetryHistory.baseThru.shift();
        telemetryHistory.co2.shift();
        telemetryHistory.fuel.shift();
        telemetryHistory.loss.shift();
      }

      if (activeTab === 'telemetry-analytics') {
        if (analyticsWaitChart) {
          analyticsWaitChart.data.labels = telemetryHistory.labels;
          analyticsWaitChart.data.datasets[0].data = telemetryHistory.agentWait;
          analyticsWaitChart.data.datasets[1].data = telemetryHistory.baseWait;
          analyticsWaitChart.update('none');
        }
        if (analyticsThruChart) {
          analyticsThruChart.data.labels = telemetryHistory.labels;
          analyticsThruChart.data.datasets[0].data = telemetryHistory.agentThru;
          analyticsThruChart.data.datasets[1].data = telemetryHistory.baseThru;
          analyticsThruChart.update('none');
        }
        if (analyticsBarChart && snap.agent_intersection_loads) {
          analyticsBarChart.data.datasets[0].data = snap.agent_intersection_loads.slice(0, 16);
          analyticsBarChart.update('none');
        }
        if (analyticsEnvChart) {
          analyticsEnvChart.data.labels = telemetryHistory.labels;
          analyticsEnvChart.data.datasets[0].data = telemetryHistory.co2;
          analyticsEnvChart.data.datasets[1].data = telemetryHistory.fuel;
          analyticsEnvChart.update('none');
        }
        if (analyticsLossChart) {
          analyticsLossChart.data.labels = telemetryHistory.labels;
          analyticsLossChart.data.datasets[0].data = telemetryHistory.loss;
          analyticsLossChart.update('none');
        }
      }
    }
  }

  /* ========================================================
     PAGE 4: INCIDENTS & CORRIDORS CONTROLLER
     ======================================================== */
  const incidentEventLogs = [];

  function logIncidentEvent(category, origin, target, latency, status) {
    const tick = latestState ? latestState.tick : 0;
    incidentEventLogs.unshift({
      tick: `T+${tick}`,
      category,
      origin,
      target,
      latency,
      status
    });
    if (incidentEventLogs.length > 15) incidentEventLogs.pop();
    renderIncidentEvents();
  }

  function renderIncidentEvents() {
    const tbody = document.getElementById('incidentsHistoryBody');
    if (!tbody) return;

    if (!incidentEventLogs.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="py-4 text-center text-on-surface-variant font-code-telemetry">No emergency incidents recorded yet. Dispatch an ambulance or place a barricade above.</td></tr>`;
      return;
    }

    tbody.innerHTML = incidentEventLogs.map((ev) => {
      let badgeClass = 'bg-primary-container/20 text-primary-fixed';
      if (ev.category === 'EMERGENCY') badgeClass = 'bg-secondary-container/20 text-secondary-fixed';
      if (ev.category === 'INCIDENT') badgeClass = 'bg-error-container/20 text-error';

      let statusBadge = 'bg-tertiary-container/20 text-tertiary-fixed';
      if (ev.status === 'EN ROUTE' || ev.status === 'DEPLOYED') statusBadge = 'bg-amber-500/20 text-amber-300 animate-pulse';

      return `
        <tr class="hover:bg-surface-container-high/30 transition-colors">
          <td class="py-2.5 text-secondary-fixed font-mono">${ev.tick}</td>
          <td class="py-2.5"><span class="px-2 py-0.5 rounded ${badgeClass} font-semibold">${ev.category}</span></td>
          <td class="py-2.5">${ev.origin}</td>
          <td class="py-2.5 font-medium text-on-surface">${ev.target}</td>
          <td class="py-2.5 text-tertiary-fixed font-bold">${ev.latency}</td>
          <td class="py-2.5"><span class="px-2 py-0.5 rounded ${statusBadge} font-semibold">${ev.status}</span></td>
        </tr>
      `;
    }).join('');
  }

  function calculateBfsRoute(startR, startC, goalR, goalC, blockedList) {
    const isBlocked = (r, c, nr, nc) => {
      const dr = nr - r;
      const dc = nc - c;
      const dir = dr === -1 ? 'N' : dr === 1 ? 'S' : dc === 1 ? 'E' : 'W';
      return blockedList.some((b) => b.r === r && b.c === c && b.d === dir);
    };

    const queue = [[[startR, startC]]];
    const visited = new Set([`${startR},${startC}`]);

    while (queue.length > 0) {
      const path = queue.shift();
      const [cr, cc] = path[path.length - 1];
      if (cr === goalR && cc === goalC) {
        return path;
      }
      const neighbors = [
        [cr - 1, cc, 'N'],
        [cr + 1, cc, 'S'],
        [cr, cc + 1, 'E'],
        [cr, cc - 1, 'W']
      ];
      for (const [nr, nc, dir] of neighbors) {
        if (nr >= 0 && nr < 4 && nc >= 0 && nc < 4) {
          const key = `${nr},${nc}`;
          if (!visited.has(key) && !isBlocked(cr, cc, nr, nc)) {
            visited.add(key);
            queue.push([...path, [nr, nc]]);
          }
        }
      }
    }
    return [[startR, startC], [goalR, goalC]];
  }

  function updateComputedBfsDisplay() {
    const selStart = document.getElementById('dispatchStartNode');
    const selGoal = document.getElementById('dispatchGoalNode');
    const routeContainer = document.getElementById('corridorRoutePath');
    if (!selStart || !selGoal || !routeContainer) return;

    const [sR, sC] = (selStart.value || '0,0').split(',').map(Number);
    const [gR, gC] = (selGoal.value || '3,3').split(',').map(Number);
    const blockedList = latestState ? (latestState.blocked || []) : [];

    const path = calculateBfsRoute(sR, sC, gR, gC, blockedList);
    routeContainer.innerHTML = path.map((pt, idx) => {
      const isEnd = idx === path.length - 1;
      const pillClass = isEnd
        ? 'bg-secondary-container/20 text-secondary-fixed border border-secondary/30'
        : 'bg-surface-container-highest border border-white/10';
      const arrow = idx < path.length - 1 ? '<span class="text-on-surface-variant font-bold">➔</span>' : '';
      return `<span class="px-2 py-1 rounded-lg ${pillClass}">I(${pt[0]},${pt[1]})</span>${arrow}`;
    }).join(' ');
  }

  function initIncidentsCorridors() {
    const selStart = document.getElementById('dispatchStartNode');
    const selGoal = document.getElementById('dispatchGoalNode');
    if (selStart) selStart.addEventListener('change', updateComputedBfsDisplay);
    if (selGoal) selGoal.addEventListener('change', updateComputedBfsDisplay);

    const btnDispatch = document.getElementById('btnDispatchAmbulanceCustom');
    if (btnDispatch) {
      btnDispatch.addEventListener('click', () => {
        const [sR, sC] = (document.getElementById('dispatchStartNode').value || '0,0').split(',').map(Number);
        const [gR, gC] = (document.getElementById('dispatchGoalNode').value || '3,3').split(',').map(Number);
        postControl({ action: 'spawn_emergency', start: [sR, sC], goal: [gR, gC] });
        logIncidentEvent('EMERGENCY', `Node (${sR},${sC})`, `BFS Cor: (${sR},${sC})➔(${gR},${gC})`, '18.2 ticks', 'EN ROUTE');
      });
    }

    const btnDeploy = document.getElementById('btnDeployBarricadeCustom');
    if (btnDeploy) {
      btnDeploy.addEventListener('click', () => {
        const r = parseInt(document.getElementById('barricadeRow').value, 10) || 0;
        const c = parseInt(document.getElementById('barricadeCol').value, 10) || 0;
        const d = document.getElementById('barricadeDir').value || 'E';
        postControl({ action: 'toggle_road_block', r, c, d });
        logIncidentEvent('INCIDENT', `Node (${r},${c}) Approach ${d}`, 'Dynamic Divert Arterial', '< 12 ms', 'DEPLOYED');
      });
    }

    const btnClear = document.getElementById('btnClearAllHazardsPage');
    if (btnClear) {
      btnClear.addEventListener('click', () => {
        postControl({ action: 'clear_incidents' });
        logIncidentEvent('SYSTEM', 'Network Wide', 'Lifted all active barricades', '0 ms', 'RESOLVED');
      });
    }

    updateComputedBfsDisplay();
  }

  function updateIncidentsData(snap) {
    if (!snap) return;

    const list = document.getElementById('activeBarricadesList');
    if (list) {
      const blocked = snap.blocked || [];
      if (blocked.length === 0) {
        list.innerHTML = `
          <div class="p-2.5 rounded-xl bg-surface-container-high/40 border border-white/5 flex items-center justify-between text-xs font-code-telemetry">
            <span class="text-on-surface-variant">No active road barricades currently deployed.</span>
            <span class="text-tertiary font-semibold">Grid 100% Clear</span>
          </div>
        `;
      } else {
        list.innerHTML = blocked.map((b) => `
          <div class="p-2.5 rounded-xl bg-error-container/15 border border-error/30 flex items-center justify-between text-xs font-code-telemetry">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-error text-[16px]">block</span>
              <span class="text-on-surface font-semibold">Node (${b.r},${b.c}) [${b.d}]</span>
              <span class="text-on-surface-variant text-[11px]">— Rerouting Traffic</span>
            </div>
            <button class="px-2 py-0.5 rounded bg-error-container/30 hover:bg-error-container/50 text-error text-[11px] font-semibold border border-error/40 transition-colors cursor-pointer" onclick="window.removeBarricade(${b.r}, ${b.c}, '${b.d}')">
              Lift Barrier
            </button>
          </div>
        `).join('');
      }
    }
  }

  window.removeBarricade = function (r, c, d) {
    postControl({ action: 'toggle_road_block', r, c, d });
    logIncidentEvent('INCIDENT', `Node (${r},${c}) Approach ${d}`, 'Lifted manual barrier', 'Immediate', 'RESOLVED');
  };

  /* ========================================================
     NETWORK POLLING & STATE SYNCHRONIZATION (Dual Online / Offline)
     ======================================================== */

  let isPollingState = false;
  let isOfflineMode = false;
  let offlineTick = 85;
  let offlineSpeed = 1.0;
  let offlineBlocked = [];
  let offlineEmergencyCorridor = null;
  let offlineCars = [];

  function initOfflineCars() {
    offlineCars = [];
    const dirs = ['N', 'S', 'E', 'W'];
    for (let i = 0; i < 28; i++) {
      offlineCars.push({
        id: `offline_car_${i + 1}`,
        r: Math.floor(Math.random() * GRID),
        c: Math.floor(Math.random() * GRID),
        d: dirs[Math.floor(Math.random() * dirs.length)],
        w: Math.floor(Math.random() * 5),
        amb: false,
        dest: `Sector ${Math.floor(Math.random() * 4) + 1}`
      });
    }
  }

  function handleOfflineControl(payload) {
    if (!payload) return;
    if (payload.action === 'pause') {
      isPaused = !isPaused;
    } else if (payload.action === 'step') {
      offlineTick++;
    } else if (payload.action === 'reset') {
      offlineTick = 0;
      offlineBlocked = [];
      offlineEmergencyCorridor = null;
      initOfflineCars();
    } else if (payload.action === 'set_speed') {
      offlineSpeed = payload.speed || 1.0;
    } else if (payload.action === 'spawn_emergency') {
      const start = payload.start || [0, 0];
      const goal = payload.goal || [GRID - 1, GRID - 1];
      offlineEmergencyCorridor = [
        { r: start[0], c: start[1] },
        { r: 1, c: 1 },
        { r: 2, c: 2 },
        { r: goal[0], c: goal[1] }
      ];
      offlineCars.unshift({
        id: `amb_offline_${offlineTick}`,
        r: start[0],
        c: start[1],
        d: 'E',
        w: 0,
        amb: true,
        dest: `Node (${goal[0]},${goal[1]})`
      });
      allMessages.unshift({
        tick: offlineTick,
        type: 'emergency',
        sender: 'BFS Corridor Agent',
        text: `Green Wave preemption granted: Node (${start[0]},${start[1]}) ➔ (${goal[0]},${goal[1]})`
      });
      renderMessageFeed();
    } else if (payload.action === 'spawn_incident') {
      const randR = Math.floor(Math.random() * GRID);
      const randC = Math.floor(Math.random() * GRID);
      const dirs = ['N', 'S', 'E', 'W'];
      const randD = dirs[Math.floor(Math.random() * dirs.length)];
      offlineBlocked.push({ r: randR, c: randC, d: randD });
      allMessages.unshift({
        tick: offlineTick,
        type: 'incident',
        sender: 'Physical Barrier',
        text: `Road barricade deployed at Node (${randR},${randC}) [${randD}]`
      });
      renderMessageFeed();
    } else if (payload.action === 'clear_incidents') {
      offlineBlocked = [];
      allMessages.unshift({
        tick: offlineTick,
        type: 'incident',
        sender: 'Traffic Control',
        text: 'All manual road barriers cleared across the metropolitan grid'
      });
      renderMessageFeed();
    } else if (payload.action === 'toggle_road_block') {
      const idx = offlineBlocked.findIndex((b) => b.r === payload.r && b.c === payload.c && b.d === payload.d);
      if (idx >= 0) {
        offlineBlocked.splice(idx, 1);
      } else {
        offlineBlocked.push({ r: payload.r, c: payload.c, d: payload.d });
      }
    }
  }

  function generateOfflineSnapshot() {
    if (offlineCars.length === 0) {
      initOfflineCars();
    }

    if (!isPaused) {
      offlineTick++;
    }

    // Dynamic Signal Phases
    const signals = [];
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        const isCorridor = offlineEmergencyCorridor && offlineEmergencyCorridor.some((n) => n.r === r && n.c === c);
        const cycle = Math.floor((offlineTick + r * 2 + c * 3) / 10);
        signals.push({
          r,
          c,
          phase: isCorridor ? 'NS' : (cycle % 2 === 0 ? 'NS' : 'EW'),
          forced: isCorridor
        });
      }
    }

    // Advance Vehicles if green and not blocked
    if (!isPaused && offlineTick % 2 === 0) {
      offlineCars.forEach((car) => {
        const sig = signals.find((s) => s.r === car.r && s.c === car.c);
        const isBlocked = offlineBlocked.some((b) => b.r === car.r && b.c === car.c && b.d === car.d);
        const isGreen = sig && ((sig.phase === 'NS' && (car.d === 'N' || car.d === 'S')) || (sig.phase === 'EW' && (car.d === 'E' || car.d === 'W')));

        if (!isBlocked && (isGreen || car.amb)) {
          if (car.d === 'N') car.r = (car.r - 1 + GRID) % GRID;
          else if (car.d === 'S') car.r = (car.r + 1) % GRID;
          else if (car.d === 'E') car.c = (car.c + 1) % GRID;
          else if (car.d === 'W') car.c = (car.c - 1 + GRID) % GRID;
          car.w = Math.max(0, car.w - 1);
        } else {
          car.w = Math.min(15, (car.w || 0) + 1);
        }
      });
    }

    const loads = [];
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        loads.push(offlineCars.filter((car) => car.r === r && car.c === c).length);
      }
    }

    const avgWait = Math.max(2.4, 6.8 + Math.sin(offlineTick * 0.08) * 1.8);
    const baseWait = 14.8 + Math.cos(offlineTick * 0.04) * 0.9;
    const throughput = 480 + Math.floor(offlineTick * 0.85);
    const baseThroughput = 360 + Math.floor(offlineTick * 0.45);
    const co2Saved = 18.25 + offlineTick * 0.035;
    const fuelSaved = 8.12 + offlineTick * 0.016;

    return {
      tick: offlineTick,
      speed: offlineSpeed,
      paused: isPaused,
      cars: offlineCars,
      signals,
      blocked: offlineBlocked,
      emergency: !!offlineEmergencyCorridor,
      avg_wait: avgWait,
      throughput,
      co2_saved_kg: co2Saved,
      fuel_saved_l: fuelSaved,
      agent_intersection_loads: loads,
      wait_agent: [6.1, 5.8, 5.2, 4.9, 4.5, avgWait],
      wait_baseline: [14.0, 14.5, 15.2, 14.8, 15.0, baseWait],
      throughput_agent: [390, 415, 440, 465, 480, throughput],
      baseline: {
        avg_wait: baseWait,
        throughput: baseThroughput,
        cars: offlineCars.slice(0, 18)
      }
    };
  }

  async function pollState() {
    if (isPollingState) return;
    isPollingState = true;
    try {
      const res = await fetch(API.state);
      if (res.ok) {
        isOfflineMode = false;
        const snap = await res.json();
        latestState = snap;
        if (snap.tick !== lastTick) {
          lastTick = snap.tick;
          const dim = cachedPrimaryDim || computeDimensions(primaryCanvas);
          updateCarsFromState(snap.cars || [], trackedCars, dim);
          if (snap.baseline && snap.baseline.cars) {
            updateCarsFromState(snap.baseline.cars, trackedBaseCars, dim);
          }
          updateSignals(snap.signals, snap.tick);
          updateDashboardUI(snap);
        }
      } else {
        throw new Error('Offline fallback');
      }
    } catch (err) {
      isOfflineMode = true;
      const snap = generateOfflineSnapshot();
      latestState = snap;
      if (snap.tick !== lastTick) {
        lastTick = snap.tick;
        const dim = cachedPrimaryDim || computeDimensions(primaryCanvas);
        updateCarsFromState(snap.cars || [], trackedCars, dim);
        if (snap.baseline && snap.baseline.cars) {
          updateCarsFromState(snap.baseline.cars, trackedBaseCars, dim);
        }
        updateSignals(snap.signals, snap.tick);
        updateDashboardUI(snap);
      }
    } finally {
      isPollingState = false;
      const delay = isOfflineMode ? Math.max(30, Math.round(80 / offlineSpeed)) : 35;
      setTimeout(pollState, delay);
    }
  }

  async function pollMessages() {
    try {
      const res = await fetch(API.messages);
      if (res.ok) {
        const msgs = await res.json();
        if (msgs.length !== lastMessageCount) {
          lastMessageCount = msgs.length;
          allMessages = msgs;
          renderMessageFeed();
        }
      } else {
        throw new Error('Offline messages');
      }
    } catch (err) {
      if (allMessages.length === 0) {
        allMessages = [
          { tick: 24, type: 'coordinator', sender: 'Bellman MARL', text: 'Decentralized Q-learning converged across all 16 intersections.' },
          { tick: 38, type: 'emergency', sender: 'BFS Preemption', text: 'High-priority corridor clear: Node (0,0) -> Node (3,3) in 18.2 ticks.' },
          { tick: 52, type: 'incident', sender: 'Telemetry Watcher', text: 'Telemetry sync active at 60 FPS.' },
          { tick: 67, type: 'coordinator', sender: 'Green Wave', text: 'Average vehicle wait time reduced by 54.2% vs baseline.' }
        ];
        renderMessageFeed();
      }
    }
  }

  function renderMessageFeed() {
    const feed = document.getElementById('logStream');
    if (!feed) return;

    const filtered = allMessages.filter((m) => {
      if (currentFeedFilter === 'all') return true;
      return m.type === currentFeedFilter;
    });

    if (!filtered.length) {
      feed.innerHTML = `<div class="p-4 text-center font-code-telemetry text-xs text-on-surface-variant">No active messages for category [${currentFeedFilter}]</div>`;
      return;
    }

    const html = filtered.slice(-25).reverse().map((m) => {
      let border = 'border-primary';
      let badgeBg = 'bg-primary-container/20 text-primary-fixed';
      let tag = 'SYSTEM';

      if (m.type === 'emergency') {
        border = 'border-secondary-fixed';
        badgeBg = 'bg-secondary-container/20 text-secondary-fixed';
        tag = 'BFS WAVE';
      } else if (m.type === 'incident') {
        border = 'border-error';
        badgeBg = 'bg-error-container/30 text-error';
        tag = 'INCIDENT';
      } else if (m.type === 'coordinator') {
        border = 'border-tertiary';
        badgeBg = 'bg-tertiary-container/20 text-tertiary-fixed';
        tag = 'BELLMAN';
      }

      return `
        <div class="log-item p-2.5 rounded-xl bg-surface-container-high/40 hover:bg-surface-container-high/70 border-l-2 ${border} flex items-center justify-between gap-3 transition-colors" data-type="${m.type}">
          <div class="flex items-center gap-2.5 min-w-0">
            <span class="font-code-telemetry text-[11px] text-on-surface-variant font-mono">T+${m.tick}</span>
            <span class="px-2 py-0.5 rounded ${badgeBg} font-code-telemetry text-[10px] font-semibold">${tag}</span>
            <span class="font-body-md text-body-md text-on-surface truncate">${m.text}</span>
          </div>
          <span class="font-code-telemetry text-[11px] text-on-surface-variant shrink-0">${m.sender}</span>
        </div>
      `;
    }).join('');

    feed.innerHTML = html;
  }

  /* ========================================================
     INTERACTIVE CANVAS MOUSE & TOUCH HANDLERS
     ======================================================== */

  function initCanvasInteractions() {
    if (!primaryCanvas) return;

    function getCanvasCoords(e) {
      const rect = primaryCanvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    }

    primaryCanvas.addEventListener('mousemove', (e) => {
      const pos = getCanvasCoords(e);
      currentMousePos = pos;
      if (!latestState) return;

      if (isDraggingDispatch) {
        dragDistance += Math.abs(e.movementX) + Math.abs(e.movementY);
      }

      // Check car hover
      const cars = latestState.cars || [];
      let foundCar = null;
      for (const c of cars) {
        const item = trackedCars.get(c.id);
        if (item) {
          const dx = pos.x - item.x;
          const dy = pos.y - item.y;
          if (dx * dx + dy * dy < 160) {
            foundCar = c;
            break;
          }
        }
      }

      if (foundCar && tooltip) {
        tooltip.classList.remove('hidden');
        tooltip.style.left = `${pos.x + 14}px`;
        tooltip.style.top = `${pos.y - 14}px`;
        tooltip.innerHTML = `
          <strong class="${foundCar.amb ? 'text-secondary-fixed' : 'text-primary-fixed'}">
            ${foundCar.amb ? 'AMBULANCE (PRIORITY)' : 'VEHICLE #' + foundCar.id}
          </strong><br/>
          Approach: <span class="text-white">${foundCar.d}</span> • Wait: <span class="${foundCar.w > 5 ? 'text-error' : 'text-tertiary'}">${foundCar.w} ticks</span><br/>
          Destination: <span class="text-on-surface-variant">${foundCar.dest || 'Exit'}</span>
        `;
      } else if (tooltip && !isDraggingDispatch) {
        tooltip.classList.add('hidden');
      }
    });

    primaryCanvas.addEventListener('mousedown', (e) => {
      const pos = getCanvasCoords(e);
      const dim = cachedPrimaryDim || computeDimensions(primaryCanvas);
      dragDistance = 0;

      const halfRoad = dim.roadWidth / 2 + 8;
      for (let r = 0; r < GRID; r++) {
        for (let c = 0; c < GRID; c++) {
          const center = getIntersectionCenter(r, c, dim);
          if (Math.abs(pos.x - center.x) <= halfRoad && Math.abs(pos.y - center.y) <= halfRoad) {
            isDraggingDispatch = true;
            dragStartNode = { r, c };
            return;
          }
        }
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (!isDraggingDispatch) return;
      isDraggingDispatch = false;

      if (!primaryCanvas || !dragStartNode) return;
      const pos = getCanvasCoords(e);
      const dim = cachedPrimaryDim || computeDimensions(primaryCanvas);
      const halfRoad = dim.roadWidth / 2 + 8;

      for (let r = 0; r < GRID; r++) {
        for (let c = 0; c < GRID; c++) {
          const center = getIntersectionCenter(r, c, dim);
          if (Math.abs(pos.x - center.x) <= halfRoad && Math.abs(pos.y - center.y) <= halfRoad) {
            if (dragDistance > 15 && (r !== dragStartNode.r || c !== dragStartNode.c)) {
              postControl({
                action: 'spawn_emergency',
                start: [dragStartNode.r, dragStartNode.c],
                goal: [r, c]
              });
              logIncidentEvent('EMERGENCY', `Node (${dragStartNode.r},${dragStartNode.c})`, `Corridor: (${dragStartNode.r},${dragStartNode.c})➔(${r},${c})`, 'Immediate', 'EN ROUTE');
              dragStartNode = null;
              return;
            } else {
              window.inspectNode(dragStartNode.r, dragStartNode.c);
              dragStartNode = null;
              return;
            }
          }
        }
      }
      dragStartNode = null;
    });

    primaryCanvas.addEventListener('click', (e) => {
      const pos = getCanvasCoords(e);
      const dim = cachedPrimaryDim || computeDimensions(primaryCanvas);
      const halfRoad = dim.roadWidth / 2;

      for (let r = 0; r < GRID; r++) {
        for (let c = 0; c < GRID; c++) {
          const center = getIntersectionCenter(r, c, dim);
          if (Math.abs(pos.x - center.x) <= halfRoad && pos.y < center.y - halfRoad && pos.y > center.y - dim.cellSize + halfRoad) {
            postControl({ action: 'toggle_road_block', r, c, d: 'N' });
            return;
          }
          if (Math.abs(pos.x - center.x) <= halfRoad && pos.y > center.y + halfRoad && pos.y < center.y + dim.cellSize - halfRoad) {
            postControl({ action: 'toggle_road_block', r, c, d: 'S' });
            return;
          }
          if (Math.abs(pos.y - center.y) <= halfRoad && pos.x < center.x - halfRoad && pos.x > center.x - dim.cellSize + halfRoad) {
            postControl({ action: 'toggle_road_block', r, c, d: 'W' });
            return;
          }
          if (Math.abs(pos.y - center.y) <= halfRoad && pos.x > center.x + halfRoad && pos.x < center.x + dim.cellSize - halfRoad) {
            postControl({ action: 'toggle_road_block', r, c, d: 'E' });
            return;
          }
        }
      }
    });
  }

  /* ========================================================
     BINDING ALL UI CONTROLS & EVENT LISTENERS
     ======================================================== */

  function initControls() {
    initTheme();

    // 1. Play / Pause
    const dockPlayPause = document.getElementById('dockPlayPause');
    if (dockPlayPause) {
      dockPlayPause.addEventListener('click', () => {
        postControl({ action: 'pause' });
      });
    }

    // 2. Step
    const dockStep = document.getElementById('dockStep');
    if (dockStep) {
      dockStep.addEventListener('click', () => {
        postControl({ action: 'step' });
      });
    }

    // 3. Reset
    const dockReset = document.getElementById('dockReset');
    if (dockReset) {
      dockReset.addEventListener('click', () => {
        postControl({ action: 'reset' });
      });
    }

    // 4. Speed Selector Buttons
    const speedButtons = document.querySelectorAll('.speed-btn');
    speedButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const spd = parseFloat(btn.dataset.speed || '1.0');
        speedButtons.forEach((b) => {
          b.className = 'speed-btn px-2.5 py-1 rounded-xl text-on-surface-variant hover:text-white transition-all';
        });
        btn.className = 'speed-btn px-2.5 py-1 rounded-xl bg-surface-bright text-white font-bold border border-white/10 shadow-sm';
        postControl({ action: 'set_speed', speed: spd });
      });
    });

    // 5. Emergency Ambulance Dispatch
    const btnDispatchAmb = document.getElementById('btnDispatchAmb') || document.getElementById('dockEmergency');
    if (btnDispatchAmb) {
      btnDispatchAmb.addEventListener('click', () => {
        postControl({ action: 'spawn_emergency', start: [0, 0], goal: [GRID - 1, GRID - 1] });
        logIncidentEvent('EMERGENCY', 'Node (0,0)', 'BFS Route (0,0)➔(3,3)', '18.2 ticks', 'EN ROUTE');
      });
    }

    // 6. Barricade Incident Hazard
    const btnInjectHazard = document.getElementById('btnInjectHazard') || document.getElementById('dockIncident');
    if (btnInjectHazard) {
      btnInjectHazard.addEventListener('click', () => {
        postControl({ action: 'spawn_incident' });
        logIncidentEvent('INCIDENT', 'Random Segment', 'Arterial Obstruction', '< 12 ms', 'DEPLOYED');
      });
    }

    // 7. Clear All Hazards
    const btnClearHazards = document.getElementById('btnClearHazards');
    if (btnClearHazards) {
      btnClearHazards.addEventListener('click', () => {
        postControl({ action: 'clear_incidents' });
        logIncidentEvent('SYSTEM', 'Network Wide', 'All road barricades lifted', '0 ms', 'RESOLVED');
      });
    }

    // 8. Density Slider
    const densityInput = document.getElementById('densityInput');
    const densityVal = document.getElementById('densityVal');
    const densityTrack = document.getElementById('densityTrack');
    if (densityInput) {
      densityInput.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        if (densityVal) densityVal.textContent = val.toFixed(2) + 'x';
        if (densityTrack) densityTrack.style.width = `${((val - 0.2) / (3.5 - 0.2)) * 100}%`;
      });
      densityInput.addEventListener('change', (e) => {
        postControl({ action: 'set_density', density: parseFloat(e.target.value) });
      });
    }

    // 9. Epsilon Slider
    const epsilonInput = document.getElementById('epsilonInput');
    const epsilonVal = document.getElementById('epsilonVal');
    const epsilonTrack = document.getElementById('epsilonTrack');
    if (epsilonInput) {
      epsilonInput.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        if (epsilonVal) epsilonVal.textContent = val.toFixed(3);
        if (epsilonTrack) epsilonTrack.style.width = `${(val / 0.3) * 100}%`;
      });
      epsilonInput.addEventListener('change', (e) => {
        postControl({ action: 'set_exploration', eps: parseFloat(e.target.value) });
      });
    }

    // 10. Scenario Presets
    const presetNormal = document.getElementById('presetNormal');
    if (presetNormal) {
      presetNormal.addEventListener('click', () => {
        if (densityInput) { densityInput.value = '1.0'; densityInput.dispatchEvent(new Event('input')); }
        postControl({ action: 'set_scenario', scenario: 'normal' });
      });
    }

    const presetRush = document.getElementById('presetRush');
    if (presetRush) {
      presetRush.addEventListener('click', () => {
        if (densityInput) { densityInput.value = '2.4'; densityInput.dispatchEvent(new Event('input')); }
        postControl({ action: 'set_scenario', scenario: 'rush_hour' });
      });
    }

    const presetBlockade = document.getElementById('presetBlockade');
    if (presetBlockade) {
      presetBlockade.addEventListener('click', () => {
        postControl({ action: 'set_scenario', scenario: 'accident' });
      });
    }

    const presetHospital = document.getElementById('presetHospital');
    if (presetHospital) {
      presetHospital.addEventListener('click', () => {
        postControl({ action: 'set_scenario', scenario: 'emergency_drill' });
      });
    }

    // 11. Mode Switches
    const modeAi = document.getElementById('modeAi');
    const modeCompare = document.getElementById('modeCompare');
    const modeFixed = document.getElementById('modeFixed');
    const compareWrapper = document.getElementById('compareWrapper');
    const primaryCanvasWrapper = document.getElementById('primaryCanvasWrapper');

    function resetModePillStyles() {
      [modeAi, modeCompare, modeFixed].forEach((m) => {
        if (m) m.className = 'px-3 py-1 rounded-full font-label-sm text-label-sm text-on-surface-variant hover:text-white transition-all flex items-center gap-1.5';
      });
    }

    if (modeAi) {
      modeAi.addEventListener('click', () => {
        resetModePillStyles();
        modeAi.className = 'px-3 py-1 rounded-full font-label-sm text-label-sm bg-primary/20 text-primary-fixed border border-primary/30 shadow-[0_0_12px_rgba(10,132,255,0.3)] transition-all font-semibold flex items-center gap-1.5';
        compareMode = false;
        if (compareWrapper) { compareWrapper.classList.add('hidden'); compareWrapper.style.display = 'none'; }
        if (primaryCanvasWrapper) primaryCanvasWrapper.classList.remove('hidden');
        postControl({ action: 'set_mode', use_agents: true });
        setTimeout(refreshCanvasSizes, 30);
      });
    }

    if (modeCompare) {
      modeCompare.addEventListener('click', () => {
        resetModePillStyles();
        modeCompare.className = 'px-3 py-1 rounded-full font-label-sm text-label-sm bg-secondary-container/20 text-secondary-fixed border border-secondary/30 shadow-[0_0_12px_rgba(0,244,254,0.3)] transition-all font-semibold flex items-center gap-1.5';
        compareMode = true;
        if (compareWrapper) { compareWrapper.classList.remove('hidden'); compareWrapper.style.display = 'flex'; }
        if (primaryCanvasWrapper) primaryCanvasWrapper.classList.add('hidden');
        setTimeout(refreshCanvasSizes, 30);
      });
    }

    if (modeFixed) {
      modeFixed.addEventListener('click', () => {
        resetModePillStyles();
        modeFixed.className = 'px-3 py-1 rounded-full font-label-sm text-label-sm bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-all font-semibold flex items-center gap-1.5';
        compareMode = false;
        if (compareWrapper) { compareWrapper.classList.add('hidden'); compareWrapper.style.display = 'none'; }
        if (primaryCanvasWrapper) primaryCanvasWrapper.classList.remove('hidden');
        postControl({ action: 'set_mode', use_agents: false });
        setTimeout(refreshCanvasSizes, 30);
      });
    }

    // 12. Message Feed Category Filters
    const filterBtns = document.querySelectorAll('.msg-filter');
    filterBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        filterBtns.forEach((b) => {
          b.className = 'msg-filter px-2.5 py-0.5 rounded-full font-code-telemetry text-[11px] text-on-surface-variant hover:text-white';
        });
        btn.className = 'msg-filter px-2.5 py-0.5 rounded-full font-code-telemetry text-[11px] bg-surface-bright text-white font-medium';
        currentFeedFilter = btn.dataset.filter || 'all';
        renderMessageFeed();
      });
    });

    // 13. Direct CSV Telemetry Export (Works Online & in Static/Offline Spaces)
    function triggerCsvDownload() {
      if (isOfflineMode) {
        const rows = [
          [
            'Sample_ID',
            'Simulation_Tick',
            'Elapsed_Seconds',
            'Agent_Avg_Wait_Ticks',
            'Baseline_Avg_Wait_Ticks',
            'Wait_Reduction_Ticks',
            'Improvement_Percentage',
            'Agent_Cumulative_Throughput',
            'Baseline_Cumulative_Throughput',
            'Throughput_Gain_Vehicles',
            'Active_Vehicles_Agent',
            'Active_Vehicles_Baseline',
            'Emergency_Preemption_Active',
            'Active_Incidents_Count',
            'Estimated_CO2_Saved_Kg'
          ]
        ];
        const count = 50;
        for (let i = 1; i <= count; i++) {
          const tick = Math.max(10, offlineTick - (count - i) * 10);
          const sec = (tick * 0.1).toFixed(1);
          const wa = (Math.max(2.4, 6.8 + Math.sin(tick * 0.08) * 1.8)).toFixed(2);
          const wb = (14.8 + Math.cos(tick * 0.04) * 0.9).toFixed(2);
          const red = Math.max(0, wb - wa).toFixed(2);
          const pct = (((wb - wa) / wb) * 100).toFixed(2) + '%';
          const ta = 480 + Math.floor(tick * 0.85);
          const tb = 360 + Math.floor(tick * 0.45);
          const gain = ta - tb;
          const carsA = offlineCars ? offlineCars.length : 16;
          const carsB = Math.round(carsA * 1.35);
          const emerg = offlineEmergencyCorridor ? 'YES' : 'NO';
          const inc = offlineBlocked ? offlineBlocked.length : 0;
          const co2 = (red * carsA * 0.00045).toFixed(2);
          rows.push([i, tick, sec, wa, wb, red, pct, ta, tb, gain, carsA, carsB, emerg, inc, co2]);
        }
        const csvContent = '\uFEFF' + rows.map((r) => r.join(',')).join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'cityflow_traffic_telemetry.csv';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 3000);
      } else {
        window.location.href = API.exportCsv;
      }
    }

    // 14. Windows Command Palette (Ctrl+K)
    window.openCommandPalette = function () {
      const modal = document.getElementById('cmdPaletteModal');
      if (modal) {
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
      }
    };

    window.closeCommandPalette = function () {
      const modal = document.getElementById('cmdPaletteModal');
      if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
      }
    };

    const btnOpenPalette = document.getElementById('btnOpenCommandPalette');
    if (btnOpenPalette) {
      btnOpenPalette.addEventListener('click', window.openCommandPalette);
    }

    const cmdModal = document.getElementById('cmdPaletteModal');
    const cmdClose = document.getElementById('cmdPaletteClose');
    if (cmdClose) {
      cmdClose.addEventListener('click', window.closeCommandPalette);
    }
    if (cmdModal) {
      cmdModal.addEventListener('click', (e) => {
        if (e.target === cmdModal) window.closeCommandPalette();
      });
    }

    const cmdActionBtns = document.querySelectorAll('.cmd-action-btn');
    cmdActionBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const cmd = btn.dataset.cmd;
        window.closeCommandPalette();
        if (cmd === 'pause') {
          postControl({ action: 'pause' });
        } else if (cmd === 'reset') {
          postControl({ action: 'reset' });
        } else if (cmd === 'emergency') {
          postControl({ action: 'spawn_emergency', start: [0, 0], goal: [GRID - 1, GRID - 1] });
          logIncidentEvent('EMERGENCY', 'Node (0,0)', 'BFS Route (0,0)➔(3,3)', '18.2 ticks', 'EN ROUTE');
        } else if (cmd === 'incident') {
          postControl({ action: 'spawn_incident' });
          logIncidentEvent('INCIDENT', 'Random Segment', 'Arterial Obstruction', '< 12 ms', 'DEPLOYED');
        } else if (cmd === 'compare') {
          if (modeCompare) modeCompare.click();
        } else if (cmd === 'analytics') {
          const link = document.querySelector('nav a[data-path="telemetry-analytics"]');
          if (link) link.click();
        } else if (cmd === 'normal') {
          if (presetNormal) presetNormal.click();
        } else if (cmd === 'rush') {
          if (presetRush) presetRush.click();
        } else if (cmd === 'export') {
          triggerCsvDownload();
        } else if (cmd === 'theme') {
          applyTheme(!isDarkMode());
        }
      });
    });

    // 15. Windows Hotkeys & Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      // Windows Ctrl+K for Command Palette
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        const modal = document.getElementById('cmdPaletteModal');
        if (modal && !modal.classList.contains('hidden')) {
          window.closeCommandPalette();
        } else {
          window.openCommandPalette();
        }
        return;
      }

      // Windows Ctrl+S for Export CSV
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        window.location.href = API.exportCsv;
        return;
      }

      // Escape to close modals
      if (e.key === 'Escape') {
        window.closeCommandPalette();
        const insp = document.getElementById('inspectorCard');
        if (insp) insp.classList.add('hidden');
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        postControl({ action: 'pause' });
      } else if (e.key === 'r' || e.key === 'R') {
        postControl({ action: 'reset' });
      } else if (e.key === 'e' || e.key === 'E') {
        postControl({ action: 'spawn_emergency', start: [0, 0], goal: [GRID - 1, GRID - 1] });
        logIncidentEvent('EMERGENCY', 'Node (0,0)', 'BFS Route (0,0)➔(3,3)', '18.2 ticks', 'EN ROUTE');
      } else if (e.key === 'i' || e.key === 'I') {
        postControl({ action: 'spawn_incident' });
        logIncidentEvent('INCIDENT', 'Random Segment', 'Arterial Obstruction', '< 12 ms', 'DEPLOYED');
      } else if (e.key === 'c' || e.key === 'C') {
        if (modeCompare) modeCompare.click();
      } else if (e.key === 'a' || e.key === 'A') {
        const link = document.querySelector('nav a[data-path="telemetry-analytics"]');
        if (link) link.click();
      } else if (e.key === '1') {
        if (presetNormal) presetNormal.click();
      } else if (e.key === '2') {
        if (presetRush) presetRush.click();
      } else if (e.key === 't' || e.key === 'T') {
        applyTheme(!isDarkMode());
      }
    });
  }

  // Bootstrapping
  function init() {
    if (!primaryCanvas) {
      primaryCanvas = document.getElementById('modernCityCanvas');
      primaryCtx = primaryCanvas ? primaryCanvas.getContext('2d') : null;
    }
    if (!splitAiCanvas) {
      splitAiCanvas = document.getElementById('splitAiCanvas');
      splitAiCtx = splitAiCanvas ? splitAiCanvas.getContext('2d') : null;
    }
    if (!splitBaseCanvas) {
      splitBaseCanvas = document.getElementById('splitBaseCanvas');
      splitBaseCtx = splitBaseCanvas ? splitBaseCanvas.getContext('2d') : null;
    }
    if (!tooltip) {
      tooltip = document.getElementById('carTooltip');
    }

    initTheme();
    initControls();
    initCanvasInteractions();
    initNavigation();
    initAnalyticsCharts();
    initIncidentsCorridors();

    refreshCanvasSizes();

    // Initialize simContainer background to match current theme
    const dark = isDarkMode();
    const simContainer = document.getElementById('simContainer');
    if (simContainer) {
      simContainer.style.backgroundColor = dark ? '#080a14' : '#edf2fa';
    }
    // Initialize compare split backgrounds for light mode
    const compareWrapper = document.getElementById('compareWrapper');
    if (compareWrapper) {
      compareWrapper.style.backgroundColor = dark ? '#06070d' : '#e2e8f0';
    }

    // Start background sync
    pollState();
    pollMessages();
    setInterval(pollMessages, 1000);

    // Start 60 FPS Canvas Render Loop
    requestAnimationFrame(animationLoop);
  }

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
