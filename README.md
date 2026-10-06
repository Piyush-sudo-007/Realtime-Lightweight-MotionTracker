# 🚀 Realtime Lightweight Motion Tracker for Games (Phone Camera)

A lightweight, high-FPS, cross-platform motion tracking system designed for gaming using your smartphone's camera. Transform any smartphone (iOS or Android) into a wireless motion controller over local Wi-Fi without installing any mobile apps!

---

## 🌟 Key Features

- **📱 Zero-Install Phone Pair:** Scan the auto-generated QR code on your PC screen to immediately start streaming camera motion from your phone browser.
- **⚡ Multi-Mode Motion Engine:**
  - **Body Pose Tracking (MediaPipe Pose):** Real-time body leaning (Left/Right steering), Jumping, and Squatting/Ducking.
  - **Hand Tracking (MediaPipe Hands):** 3D hand tracking, Left/Right punch strikes, and directional pointers.
  - **Ultra-Fast Motion Grid:** Zero-AI frame differencing algorithm for ultra-low latency on low-end smartphones.
- **🎛️ Real-Time Calibration HUD:** Live motion telemetry canvas, FPS & ping monitoring, sensitivity & deadzone calibration sliders.
- **🎮 Built-In Interactive Web Games:**
  - **Space Motion Runner:** Dodge obstacles by leaning left/right, jump over low hurdles, duck under high beams.
  - **Motion Target Boxing:** Smash pop-up targets on screen using punches detected by phone camera.
- **💻 External PC Game Controller (Python Bridge):** Translate phone motion into native PC keypresses (`Arrow Keys`, `Space`, `WASD`, `Z`, `X`) to play PC games like Subway Surfers, Chrome Dino, Racing games, or Emulators.

---

## 🛠️ Quickstart Guide

### 1. Prerequisites
- **Node.js** (v18 or higher) installed on your computer.
- Both your **PC and Smartphone** must be connected to the **same Wi-Fi network** (or Smartphone Hotspot).

### 2. Installation
```bash
# Navigate to project directory
cd motion_tracker

# Install dependencies
npm install
```

### 3. Start Server
```bash
node server.js
```

### 4. Connect Phone & Play!
1. Open your browser on your desktop and go to: `http://localhost:3000`
2. Scan the **QR Code** on screen with your iPhone or Android camera.
3. Tap **"Start Camera Stream"** on your phone.
4. Launch **Space Motion Runner** or **Motion Target Boxing** from the desktop screen!

---

## 🐍 Controlling External PC Games (Python Bridge)

To control external PC games using your phone camera (e.g. Chrome Dino, Subway Surfers, emulators):

1. Install Python requirements:
```bash
pip install -r python_bridge/requirements.txt
```

2. Run the bridge:
```bash
python python_bridge/motion_to_keys.py
```

3. Default Key Mappings:
- **Lean Body Left** $\rightarrow$ `Left Arrow`
- **Lean Body Right** $\rightarrow$ `Right Arrow`
- **Jump** $\rightarrow$ `Spacebar`
- **Duck / Squat** $\rightarrow$ `Down Arrow`
- **Left Punch** $\rightarrow$ `Z Key`
- **Right Punch** $\rightarrow$ `X Key`

---

## 📁 Project Structure

```
motion_tracker/
├── package.json              # Node.js dependencies
├── server.js                 # Express & Socket.io server + QR generator
├── public/
│   ├── index.html            # Desktop Hub & Game Launcher
│   ├── phone.html            # Mobile Camera Streamer Page
│   ├── dashboard.html        # Live Calibration HUD & Visualizer
│   ├── css/
│   │   └── style.css         # Cyberpunk UI styling
│   ├── js/
│   │   ├── motion_engine.js  # Tracking algorithms (MediaPipe + Frame Differencing)
│   │   ├── phone_client.js   # Smartphone client controller
│   │   ├── dashboard_client.js # Desktop HUD visualizer
│   │   └── games/
│   │       ├── runner_game.js # Space Motion Runner 3D Canvas
│   │       └── boxing_game.js # Motion Target Boxing Canvas
├── python_bridge/
│   ├── requirements.txt      # Python dependencies
│   └── motion_to_keys.py     # PC virtual keypress emulator
└── README.md
```

---

## 🔧 Troubleshooting

- **Camera Permission Denied on Phone:** Make sure your mobile browser (Chrome/Safari) has permission to access the camera.
- **Phone Won't Connect:** Verify both phone and PC are on the same Wi-Fi router. Check PC Firewall if port `3000` is blocked.
- **Jittery Motion:** Go to `http://localhost:3000/dashboard.html` and increase the **Deadzone** slider or reduce **Sensitivity**.
