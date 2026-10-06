document.addEventListener('DOMContentLoaded', () => {
  const socket = io();

  // DOM Elements
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const modeDisplay = document.getElementById('modeDisplay');
  const hudCanvas = document.getElementById('hudCanvas');
  const ctx = hudCanvas.getContext('2d');
  const fpsStat = document.getElementById('fpsStat');
  const pingStat = document.getElementById('pingStat');
  const triggerIndicator = document.getElementById('triggerIndicator');

  const leanVal = document.getElementById('leanVal');
  const jumpVal = document.getElementById('jumpVal');
  const duckVal = document.getElementById('duckVal');
  const punchVal = document.getElementById('punchVal');

  const modeSelect = document.getElementById('modeSelect');
  const sensitivitySlider = document.getElementById('sensitivitySlider');
  const sensitivityVal = document.getElementById('sensitivityVal');
  const deadzoneSlider = document.getElementById('deadzoneSlider');
  const deadzoneVal = document.getElementById('deadzoneVal');
  const smoothingSlider = document.getElementById('smoothingSlider');
  const smoothingVal = document.getElementById('smoothingVal');

  let frameCount = 0;
  let lastFPSCheck = performance.now();

  // Socket Connection Handlers
  socket.on('connect', () => {
    startPingTimer();
  });

  socket.on('init_state', (state) => {
    if (state.hasPhoneConnected) {
      statusDot.classList.add('connected');
      statusText.innerText = 'Phone Online';
    }
    updateControlsUI(state.trackingSettings);
  });

  socket.on('phone_status', (status) => {
    if (status.connected) {
      statusDot.classList.add('connected');
      statusText.innerText = 'Phone Online';
    } else {
      statusDot.classList.remove('connected');
      statusText.innerText = 'Phone Offline';
    }
  });

  socket.on('settings_changed', (settings) => {
    updateControlsUI(settings);
  });

  // Calculate Ping
  function startPingTimer() {
    setInterval(() => {
      if (socket.connected) {
        const start = Date.now();
        socket.emit('ping_check', start);
      }
    }, 2000);
  }

  socket.on('pong_check', (start) => {
    const latency = Date.now() - start;
    pingStat.innerText = `LATENCY: ${latency}ms`;
  });

  function updateControlsUI(settings) {
    if (settings.mode) {
      modeSelect.value = settings.mode;
      modeDisplay.innerText = `MODE: ${settings.mode.toUpperCase()}`;
    }
    if (settings.sensitivity) {
      sensitivitySlider.value = settings.sensitivity;
      sensitivityVal.innerText = settings.sensitivity;
    }
    if (settings.deadzone) {
      deadzoneSlider.value = settings.deadzone;
      deadzoneVal.innerText = settings.deadzone;
    }
    if (settings.smoothing) {
      smoothingSlider.value = settings.smoothing;
      smoothingVal.innerText = settings.smoothing;
    }
  }

  // Handle Incoming Motion Telemetry Frame
  socket.on('motion_event', (data) => {
    frameCount++;
    const now = performance.now();
    if (now - lastFPSCheck >= 1000) {
      fpsStat.innerText = `FPS: ${frameCount}`;
      frameCount = 0;
      lastFPSCheck = now;
    }

    renderHUD(data);
    updateStatsHUD(data);
  });

  function updateStatsHUD(data) {
    const g = data.gestures || {};
    
    if (data.normalizedPos) {
      leanVal.innerText = (data.normalizedPos.leanRatio || 0).toFixed(2);
    }
    jumpVal.innerText = g.jump ? 'ACTIVE' : 'OFF';
    duckVal.innerText = g.squat ? 'ACTIVE' : 'OFF';
    punchVal.innerText = (g.punchLeft || g.punchRight) ? 'STRIKE!' : 'OFF';

    if (g.jump) {
      showIndicator('JUMP DETECTED');
    } else if (g.squat) {
      showIndicator('DUCK / SQUAT');
    } else if (g.leanLeft) {
      showIndicator('LEAN LEFT');
    } else if (g.leanRight) {
      showIndicator('LEAN RIGHT');
    } else if (g.punchLeft) {
      showIndicator('LEFT PUNCH!');
    } else if (g.punchRight) {
      showIndicator('RIGHT PUNCH!');
    } else {
      triggerIndicator.classList.remove('active');
    }
  }

  function showIndicator(text) {
    triggerIndicator.innerText = text;
    triggerIndicator.classList.add('active');
  }

  // Render Skeleton / Vectors onto Canvas
  function renderHUD(data) {
    ctx.fillStyle = '#0a0e17';
    ctx.fillRect(0, 0, hudCanvas.width, hudCanvas.height);

    // Draw Grid Lines background
    ctx.strokeStyle = 'rgba(0, 242, 254, 0.1)';
    ctx.lineWidth = 1;
    const step = 40;
    for (let x = 0; x < hudCanvas.width; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, hudCanvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < hudCanvas.height; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(hudCanvas.width, y);
      ctx.stroke();
    }

    if (data.mode === 'pose' && data.landmarks) {
      drawPoseData(data);
    } else if (data.mode === 'hand' && data.hands) {
      drawHandData(data.hands);
    } else if (data.mode === 'grid' && data.gridStats) {
      drawGridData(data.gridStats);
    }
  }

  function drawPoseData(data) {
    const lms = data.landmarks;
    if (!lms || lms.length < 3) return;

    const nose = { x: (1 - lms[0].x) * hudCanvas.width, y: lms[0].y * hudCanvas.height };
    const leftS = { x: (1 - lms[1].x) * hudCanvas.width, y: lms[1].y * hudCanvas.height };
    const rightS = { x: (1 - lms[2].x) * hudCanvas.width, y: lms[2].y * hudCanvas.height };

    // Draw Shoulder Line
    ctx.strokeStyle = '#00f2fe';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(leftS.x, leftS.y);
    ctx.lineTo(rightS.x, rightS.y);
    ctx.stroke();

    // Draw Nose Point
    ctx.fillStyle = '#ff007f';
    ctx.beginPath();
    ctx.arc(nose.x, nose.y, 10, 0, Math.PI * 2);
    ctx.fill();

    // Draw Mid-Shoulder Vector
    const midX = (leftS.x + rightS.x) / 2;
    const midY = (leftS.y + rightS.y) / 2;

    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(midX, midY);
    ctx.lineTo(nose.x, nose.y);
    ctx.stroke();
  }

  function drawHandData(hands) {
    ['left', 'right'].forEach(side => {
      const h = hands[side];
      if (h) {
        const x = (1 - h.x) * hudCanvas.width;
        const y = h.y * hudCanvas.height;
        ctx.fillStyle = side === 'left' ? '#ff007f' : '#00f2fe';
        ctx.beginPath();
        ctx.arc(x, y, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 15;
      }
    });
    ctx.shadowBlur = 0;
  }

  function drawGridData(stats) {
    const w = hudCanvas.width / 2;
    const h = hudCanvas.height / 2;

    ctx.fillStyle = `rgba(0, 242, 254, ${Math.min(0.8, stats.top / 10000)})`;
    ctx.fillRect(0, 0, hudCanvas.width, h);

    ctx.fillStyle = `rgba(255, 0, 127, ${Math.min(0.8, stats.bottom / 10000)})`;
    ctx.fillRect(0, h, hudCanvas.width, h);
  }

  // Live Control Change Listeners
  function emitSettings() {
    const newSettings = {
      mode: modeSelect.value,
      sensitivity: parseInt(sensitivitySlider.value),
      deadzone: parseFloat(deadzoneSlider.value),
      smoothing: parseFloat(smoothingSlider.value)
    };
    socket.emit('update_settings', newSettings);
  }

  modeSelect.addEventListener('change', emitSettings);

  sensitivitySlider.addEventListener('input', () => {
    sensitivityVal.innerText = sensitivitySlider.value;
    emitSettings();
  });

  deadzoneSlider.addEventListener('input', () => {
    deadzoneVal.innerText = deadzoneSlider.value;
    emitSettings();
  });

  smoothingSlider.addEventListener('input', () => {
    smoothingVal.innerText = smoothingSlider.value;
    emitSettings();
  });
});
