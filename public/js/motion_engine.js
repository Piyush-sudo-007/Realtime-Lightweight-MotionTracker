/**
 * MotionEngine - Lightweight Realtime Motion Detection Engine
 * Supports MediaPipe Pose, MediaPipe Hands, and Ultra-Fast Frame Differencing.
 */
class MotionEngine {
  constructor(options = {}) {
    this.mode = options.mode || 'pose'; // 'pose', 'hand', 'grid'
    this.sensitivity = options.sensitivity || 5; // 1 - 10
    this.deadzone = options.deadzone || 0.15;
    this.smoothing = options.smoothing || 0.5;

    // Smoothed keypoints & states
    this.smoothedPose = null;
    this.smoothedHands = null;
    this.baselineY = null;

    // Frame differencing state
    this.prevFrameData = null;
    this.diffCanvas = document.createElement('canvas');
    this.diffCtx = this.diffCanvas.getContext('2d', { willReadFrequently: true });

    // Active detected gestures
    this.activeGestures = {
      leanLeft: false,
      leanRight: false,
      jump: false,
      squat: false,
      punchLeft: false,
      punchRight: false,
      intensity: 0
    };

    // Callback on gesture frame
    this.onMotionDetected = options.onMotionDetected || null;
  }

  setSettings(settings) {
    if (settings.mode) this.mode = settings.mode;
    if (settings.sensitivity !== undefined) this.sensitivity = settings.sensitivity;
    if (settings.deadzone !== undefined) this.deadzone = settings.deadzone;
    if (settings.smoothing !== undefined) this.smoothing = settings.smoothing;
  }

  // Smooth a 2D coordinate using Exponential Filter
  smoothPoint(prev, current, factor) {
    if (!prev) return { x: current.x, y: current.y, z: current.z || 0 };
    return {
      x: prev.x * factor + current.x * (1 - factor),
      y: prev.y * factor + current.y * (1 - factor),
      z: (prev.z || 0) * factor + (current.z || 0) * (1 - factor)
    };
  }

  /**
   * Process Pose Keypoints (MediaPipe Pose output)
   */
  processPose(landmarks) {
    if (!landmarks || landmarks.length === 0) return null;

    const nose = landmarks[0];
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    const leftHip = landmarks[23];
    const rightHip = landmarks[24];

    if (!nose || !leftShoulder || !rightShoulder) return null;

    // Calculate mid-shoulder point
    const midShoulder = {
      x: (leftShoulder.x + rightShoulder.x) / 2,
      y: (leftShoulder.y + rightShoulder.y) / 2
    };

    // Smooth landmarks
    this.smoothedPose = {
      nose: this.smoothPoint(this.smoothedPose?.nose, nose, this.smoothing),
      midShoulder: this.smoothPoint(this.smoothedPose?.midShoulder, midShoulder, this.smoothing)
    };

    // Calculate baseline shoulder Y for jump/squat detection
    if (this.baselineY === null) {
      this.baselineY = this.smoothedPose.midShoulder.y;
    } else {
      // Slowly adapt baseline to account for user standing posture shifts
      this.baselineY = this.baselineY * 0.98 + this.smoothedPose.midShoulder.y * 0.02;
    }

    // Dynamic thresholds based on sensitivity
    const sensFactor = (11 - this.sensitivity) / 5; // Higher sensitivity = lower threshold
    const leanThreshold = this.deadzone * sensFactor;
    const jumpThreshold = 0.08 * sensFactor;
    const squatThreshold = 0.08 * sensFactor;

    // 1. Lean Left / Right (Nose X relative to Mid Shoulder X)
    // Note: In mirrored camera feed, nose.x < midShoulder.x is leaning left
    const leanDiff = this.smoothedPose.nose.x - this.smoothedPose.midShoulder.x;
    
    this.activeGestures.leanLeft = leanDiff < -leanThreshold;
    this.activeGestures.leanRight = leanDiff > leanThreshold;

    // 2. Jump / Squat (Mid Shoulder Y relative to Baseline Y)
    // Note: Y coordinates are 0 (top) to 1 (bottom). Lower Y means higher up.
    const verticalDiff = this.smoothedPose.midShoulder.y - this.baselineY;

    this.activeGestures.jump = verticalDiff < -jumpThreshold;
    this.activeGestures.squat = verticalDiff > squatThreshold;

    // Calculate total body intensity
    this.activeGestures.intensity = Math.min(1.0, Math.abs(leanDiff) * 3 + Math.abs(verticalDiff) * 3);

    const payload = {
      mode: 'pose',
      gestures: { ...this.activeGestures },
      normalizedPos: {
        x: this.smoothedPose.midShoulder.x,
        y: this.smoothedPose.midShoulder.y,
        leanRatio: leanDiff / leanThreshold
      },
      landmarks: [
        { x: nose.x, y: nose.y },
        { x: leftShoulder.x, y: leftShoulder.y },
        { x: rightShoulder.x, y: rightShoulder.y }
      ]
    };

    if (this.onMotionDetected) this.onMotionDetected(payload);
    return payload;
  }

  /**
   * Process Hand Keypoints (MediaPipe Hands output)
   */
  processHands(handsResult) {
    if (!handsResult || !handsResult.multiHandLandmarks) return null;

    const landmarksList = handsResult.multiHandLandmarks;
    const handedness = handsResult.multiHandedness || [];

    let leftHandPos = null;
    let rightHandPos = null;

    for (let i = 0; i < landmarksList.length; i++) {
      const hand = landmarksList[i];
      const wrist = hand[0]; // Wrist point
      const indexTip = hand[8]; // Index finger tip
      const label = handedness[i]?.label || (i === 0 ? 'Right' : 'Left');

      const handPoint = { x: (wrist.x + indexTip.x) / 2, y: (wrist.y + indexTip.y) / 2 };

      if (label === 'Left') {
        leftHandPos = handPoint;
      } else {
        rightHandPos = handPoint;
      }
    }

    // Smooth hands
    this.smoothedHands = {
      left: leftHandPos ? this.smoothPoint(this.smoothedHands?.left, leftHandPos, this.smoothing) : null,
      right: rightHandPos ? this.smoothPoint(this.smoothedHands?.right, rightHandPos, this.smoothing) : null
    };

    // Punch detection based on rapid forward movement
    const sensFactor = (11 - this.sensitivity) / 5;
    const punchThreshold = 0.15 * sensFactor;

    if (this.smoothedHands.left && this.prevLeftHand) {
      const dist = Math.hypot(
        this.smoothedHands.left.x - this.prevLeftHand.x,
        this.smoothedHands.left.y - this.prevLeftHand.y
      );
      this.activeGestures.punchLeft = dist > punchThreshold;
    }
    if (this.smoothedHands.right && this.prevRightHand) {
      const dist = Math.hypot(
        this.smoothedHands.right.x - this.prevRightHand.x,
        this.smoothedHands.right.y - this.prevRightHand.y
      );
      this.activeGestures.punchRight = dist > punchThreshold;
    }

    this.prevLeftHand = this.smoothedHands.left;
    this.prevRightHand = this.smoothedHands.right;

    const payload = {
      mode: 'hand',
      gestures: { ...this.activeGestures },
      hands: {
        left: this.smoothedHands.left,
        right: this.smoothedHands.right
      }
    };

    if (this.onMotionDetected) this.onMotionDetected(payload);
    return payload;
  }

  /**
   * Ultra-Fast Lightweight Frame Differencing (Zero AI required)
   * Process raw video canvas frame directly
   */
  processGridFrame(videoElement) {
    if (!videoElement || videoElement.videoWidth === 0) return null;

    const width = 64; // Downscaled low-res for speed
    const height = 48;
    this.diffCanvas.width = width;
    this.diffCanvas.height = height;

    this.diffCtx.drawImage(videoElement, 0, 0, width, height);
    const currImageData = this.diffCtx.getImageData(0, 0, width, height);
    const curr = currImageData.data;

    if (!this.prevFrameData) {
      this.prevFrameData = curr;
      return null;
    }

    const prev = this.prevFrameData;
    let totalDiff = 0;
    let leftMotion = 0;
    let rightMotion = 0;
    let topMotion = 0;
    let bottomMotion = 0;

    const midX = Math.floor(width / 2);
    const midY = Math.floor(height / 2);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        // Grayscale diff
        const diff = (Math.abs(curr[idx] - prev[idx]) +
                      Math.abs(curr[idx+1] - prev[idx+1]) +
                      Math.abs(curr[idx+2] - prev[idx+2])) / 3;

        if (diff > 35) { // Pixel motion threshold
          totalDiff += diff;
          if (x < midX) leftMotion += diff;
          else rightMotion += diff;

          if (y < midY) topMotion += diff;
          else bottomMotion += diff;
        }
      }
    }

    this.prevFrameData = curr;

    const totalPixels = width * height;
    const sensFactor = (11 - this.sensitivity) * 1.5;
    const motionThreshold = 1000 * sensFactor;

    this.activeGestures.leanLeft = leftMotion > rightMotion * 1.5 && leftMotion > motionThreshold;
    this.activeGestures.leanRight = rightMotion > leftMotion * 1.5 && rightMotion > motionThreshold;
    this.activeGestures.jump = topMotion > bottomMotion * 1.5 && topMotion > motionThreshold;
    this.activeGestures.squat = bottomMotion > topMotion * 1.5 && bottomMotion > motionThreshold;
    this.activeGestures.intensity = Math.min(1.0, totalDiff / (totalPixels * 20));

    const payload = {
      mode: 'grid',
      gestures: { ...this.activeGestures },
      gridStats: {
        left: leftMotion,
        right: rightMotion,
        top: topMotion,
        bottom: bottomMotion,
        total: totalDiff
      }
    };

    if (this.onMotionDetected) this.onMotionDetected(payload);
    return payload;
  }
}

// Export for browser script usage
if (typeof window !== 'undefined') {
  window.MotionEngine = MotionEngine;
}
