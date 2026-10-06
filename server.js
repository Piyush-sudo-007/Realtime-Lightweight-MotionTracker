const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const QRCode = require('qrcode');
const ip = require('ip');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;
const localIP = ip.address();
const phoneUrl = `http://${localIP}:${PORT}/phone.html`;

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// API Endpoint to get connection details & QR code
app.get('/api/info', async (req, res) => {
  try {
    const qrImageData = await QRCode.toDataURL(phoneUrl);
    res.json({
      localIP,
      port: PORT,
      phoneUrl,
      qrImageData
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

// Connected clients state
let connectedPhone = null;
let trackingSettings = {
  mode: 'pose', // 'pose', 'hand', 'grid'
  sensitivity: 5, // 1 to 10
  deadzone: 0.15, // 0.05 to 0.4
  smoothing: 0.5, // 0.1 to 0.9
  cameraFacing: 'user', // 'user' (front) or 'environment' (back)
  fpsLimit: 30
};

io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);

  // Send current server state and settings to newly connected client
  socket.emit('init_state', {
    localIP,
    phoneUrl,
    trackingSettings,
    hasPhoneConnected: !!connectedPhone
  });

  // Phone registering itself
  socket.on('register_phone', (deviceInfo) => {
    connectedPhone = socket.id;
    console.log(`[Phone] Phone registered: ${socket.id}`, deviceInfo);
    io.emit('phone_status', { connected: true, socketId: socket.id, deviceInfo });
  });

  // Relay motion telemetry from Phone to Desktop Dashboard and Games
  socket.on('motion_data', (data) => {
    // Broadcast motion payload to all other clients (Desktop HUD, Games, Python bridge)
    socket.broadcast.emit('motion_event', data);
  });

  // Update tracking settings from Dashboard and broadcast to Phone
  socket.on('update_settings', (newSettings) => {
    trackingSettings = { ...trackingSettings, ...newSettings };
    console.log('[Settings] Updated:', trackingSettings);
    io.emit('settings_changed', trackingSettings);
  });

  // Ping test for measuring latency
  socket.on('ping_check', (timestamp) => {
    socket.emit('pong_check', timestamp);
  });

  // Disconnect handling
  socket.on('disconnect', () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);
    if (socket.id === connectedPhone) {
      connectedPhone = null;
      console.log('[Phone] Phone disconnected');
      io.emit('phone_status', { connected: false });
    }
  });
});

server.listen(PORT, '0.0.0.0', async () => {
  console.log(`====================================================`);
  console.log(` 🚀 Motion Tracker Server Running!`);
  console.log(` 💻 Desktop Dashboard: http://localhost:${PORT}`);
  console.log(` 📱 Mobile Camera URL: http://${localIP}:${PORT}/phone.html`);
  console.log(`====================================================`);
});
