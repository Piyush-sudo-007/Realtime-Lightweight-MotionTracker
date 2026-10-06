document.addEventListener('DOMContentLoaded', () => {
  const socket = io();

  // DOM Elements
  const videoElement = document.getElementById('videoElement');
  const canvasElement = document.getElementById('outputCanvas');
  const canvasCtx = canvasElement.getContext('2d');
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const currentModeText = document.getElementById('currentMode');
  const activeModeText = document.getElementById('activeModeText');
  const fpsVal = document.getElementById('fpsVal');
  const pingVal = document.getElementById('pingVal');
  const triggerBadge = document.getElementById('triggerBadge');
  const cameraSelect = document.getElementById('cameraSelect');
  const fpsSelect = document.getElementById('fpsSelect');
  const toggleCamBtn = document.getElementById('toggleCamBtn');

  // Motion Tracker Engine Instance
  const motionEngine = new MotionEngine({
    mode: 'pose',
    onMotionDetected: (payload) => {
      // Send motion event to socket server
      socket.emit('motion_data', payload);
      updateTriggerHUD(payload.gestures);
    }
  });

  // State Variables
  let isCameraRunning = false;
  let mediaStream = null;
  let animFrameId = null;
  let poseDetector = null;
  let handsDetector = null;
  let lastFrameTime = performance.now();
  let frameCount = 0;
  let currentFPS = 0;

  // Socket Connection Handlers
  socket.on('connect', () => {
    statusDot.classList.add('connected');
    statusText.innerText = 'Connected';
    socket.emit('register_phone', {
      userAgent: navigator.userAgent,
      screen: `${window.innerWidth}x${window.innerHeight}`
    });
    startPingTimer();
  });

  socket.on('disconnect', () => {
    statusDot.classList.remove('connected');
    statusText.innerText = 'Disconnected';
  });

  socket.on('settings_changed', (settings) => {
    motionEngine.setSettings(settings);
    currentModeText.innerText = settings.mode.toUpperCase();
    activeModeText.innerText = `MODE: ${settings.mode.toUpperCase()}`;
  });

  // Ping Latency Calculation
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
    pingVal.innerText = latency;
  });

  // Update Visual Trigger Badge on Mobile Screen
  function updateTriggerHUD(gestures) {
    if (gestures.jump) {
      showBadge('JUMP!');
    } else if (gestures.squat) {
      showBadge('DUCK!');
    } else if (gestures.leanLeft) {
      showBadge('LEAN LEFT');
    } else if (gestures.leanRight) {
      showBadge('LEAN RIGHT');
    } else if (gestures.punchLeft) {
      showBadge('LEFT PUNCH!');
    } else if (gestures.punchRight) {
      showBadge('RIGHT PUNCH!');
    } else {
      triggerBadge.classList.remove('active');
    }
  }

  function showBadge(text) {
    triggerBadge.innerText = text;
    triggerBadge.classList.add('active');
  }

  // Initialize MediaPipe Detectors
  function initDetectors() {
    if (window.Pose) {
      poseDetector = new window.Pose({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
      });
      poseDetector.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });
      poseDetector.onResults(onPoseResults);
    }

    if (window.Hands) {
      handsDetector = new window.Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
      });
      handsDetector.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });
      handsDetector.onResults(onHandsResults);
    }
  }

  function onPoseResults(results) {
    if (!isCameraRunning) return;
    drawFrameAndSkeleton(results);
    if (results.poseLandmarks && motionEngine.mode === 'pose') {
      motionEngine.processPose(results.poseLandmarks);
    }
  }

  function onHandsResults(results) {
    if (!isCameraRunning) return;
    drawFrameAndSkeleton(results);
    if (results.multiHandLandmarks && motionEngine.mode === 'hand') {
      motionEngine.processHands(results);
    }
  }

  // Draw Camera Frame & Overlay onto Mobile Canvas
  function drawFrameAndSkeleton(results) {
    canvasElement.width = videoElement.videoWidth || 640;
    canvasElement.height = videoElement.videoHeight || 480;

    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    // Draw Video Feed (Mirrored)
    canvasCtx.translate(canvasElement.width, 0);
    canvasCtx.scale(-1, 1);
    canvasCtx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.restore();

    // Draw Keypoint Skeletons
    if (results && results.poseLandmarks) {
      drawPoseSkeleton(results.poseLandmarks);
    }

    // Calculate FPS
    frameCount++;
    const now = performance.now();
    if (now - lastFrameTime >= 1000) {
      currentFPS = frameCount;
      fpsVal.innerText = currentFPS;
      frameCount = 0;
      lastFrameTime = now;
    }
  }

  function drawPoseSkeleton(landmarks) {
    canvasCtx.fillStyle = '#00f2fe';
    canvasCtx.strokeStyle = '#ff007f';
    canvasCtx.lineWidth = 4;

    // Draw key points for shoulders & nose
    [0, 11, 12, 23, 24].forEach((idx) => {
      const lm = landmarks[idx];
      if (lm) {
        const x = (1 - lm.x) * canvasElement.width; // Mirrored X
        const y = lm.y * canvasElement.height;
        canvasCtx.beginPath();
        canvasCtx.arc(x, y, 6, 0, 2 * Math.PI);
        canvasCtx.fill();
      }
    });
  }

  // Camera Processing Loop
  async function processCameraFrame() {
    if (!isCameraRunning) return;

    if (videoElement.readyState >= 2) {
      if (motionEngine.mode === 'grid') {
        drawFrameAndSkeleton(null);
        motionEngine.processGridFrame(videoElement);
      } else if (motionEngine.mode === 'hand' && handsDetector) {
        await handsDetector.send({ image: videoElement });
      } else if (poseDetector) {
        await poseDetector.send({ image: videoElement });
      }
    }

    const fpsLimit = parseInt(fpsSelect.value) || 30;
    const interval = 1000 / fpsLimit;
    setTimeout(() => {
      animFrameId = requestAnimationFrame(processCameraFrame);
    }, interval);
  }

  // Start / Stop Camera Stream
  async function startCamera() {
    try {
      const facingMode = cameraSelect.value;
      mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30 }
        },
        audio: false
      });

      videoElement.srcObject = mediaStream;
      await videoElement.play();

      isCameraRunning = true;
      toggleCamBtn.innerText = 'STOP CAMERA STREAM';
      toggleCamBtn.style.background = '#ff4757';

      initDetectors();
      processCameraFrame();
    } catch (err) {
      console.error('Camera Access Error:', err);
      alert('Could not access camera. Please allow camera permissions in browser settings.');
    }
  }

  function stopCamera() {
    isCameraRunning = false;
    if (animFrameId) cancelAnimationFrame(animFrameId);
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
      mediaStream = null;
    }
    toggleCamBtn.innerText = 'START CAMERA STREAM';
    toggleCamBtn.style.background = '';
  }

  toggleCamBtn.addEventListener('click', () => {
    if (isCameraRunning) {
      stopCamera();
    } else {
      startCamera();
    }
  });

  cameraSelect.addEventListener('change', () => {
    if (isCameraRunning) {
      stopCamera();
      startCamera();
    }
  });
});
