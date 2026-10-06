document.addEventListener('DOMContentLoaded', () => {
  const socket = io();

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const startOverlay = document.getElementById('startOverlay');
  const startGameBtn = document.getElementById('startGameBtn');
  const scoreVal = document.getElementById('scoreVal');
  const distVal = document.getElementById('distVal');
  const statusDot = document.getElementById('statusDot');

  let isPlaying = false;
  let score = 0;
  let distance = 0;
  let gameSpeed = 6;
  let animId = null;

  // Player state
  const player = {
    x: 0, // -1 (Left), 0 (Center), 1 (Right)
    targetX: 0,
    y: 0, // Vertical offset: >0 (Jumping), <0 (Ducking)
    isJumping: false,
    isDucking: false,
    jumpTimer: 0,
    duckTimer: 0
  };

  // Motion Gestures Receiver
  socket.on('connect', () => {
    statusDot.classList.add('connected');
  });

  socket.on('motion_event', (data) => {
    if (!isPlaying) return;

    const g = data.gestures || {};

    // 1. Steering (Lean Left / Right)
    if (g.leanLeft) {
      player.targetX = -1;
    } else if (g.leanRight) {
      player.targetX = 1;
    } else {
      player.targetX = 0;
    }

    // 2. Jump Trigger
    if (g.jump && !player.isJumping && !player.isDucking) {
      triggerJump();
    }

    // 3. Duck / Squat Trigger
    if (g.squat && !player.isDucking && !player.isJumping) {
      triggerDuck();
    }
  });

  // Keyboard Fallback for local testing
  window.addEventListener('keydown', (e) => {
    if (!isPlaying) return;
    if (e.key === 'ArrowLeft' || e.key === 'a') player.targetX = -1;
    if (e.key === 'ArrowRight' || e.key === 'd') player.targetX = 1;
    if ((e.key === 'ArrowUp' || e.key === 'w' || e.key === ' ') && !player.isJumping) triggerJump();
    if ((e.key === 'ArrowDown' || e.key === 's') && !player.isDucking) triggerDuck();
  });

  window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'a' || e.key === 'd') {
      player.targetX = 0;
    }
  });

  function triggerJump() {
    player.isJumping = true;
    player.jumpTimer = 25; // Frame duration
  }

  function triggerDuck() {
    player.isDucking = true;
    player.duckTimer = 25;
  }

  // Obstacles list
  let obstacles = [];

  function spawnObstacle() {
    const lane = [-1, 0, 1][Math.floor(Math.random() * 3)];
    const types = ['pillar', 'hurdle', 'high_beam'];
    const type = types[Math.floor(Math.random() * types.length)];

    obstacles.push({
      lane: lane,
      z: 1000, // Distance away
      type: type
    });
  }

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // Main Game Loop
  function gameLoop() {
    if (!isPlaying) return;

    ctx.fillStyle = '#05070c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Update Player smooth position
    player.x += (player.targetX - player.x) * 0.15;

    // Handle Jump & Duck Timers
    if (player.isJumping) {
      player.jumpTimer--;
      player.y = Math.sin((25 - player.jumpTimer) / 25 * Math.PI) * 120;
      if (player.jumpTimer <= 0) {
        player.isJumping = false;
        player.y = 0;
      }
    } else if (player.isDucking) {
      player.duckTimer--;
      player.y = -40; // Crouch down
      if (player.duckTimer <= 0) {
        player.isDucking = false;
        player.y = 0;
      }
    }

    // Draw Perspective Highway Grid
    drawHighway();

    // Update & Draw Obstacles
    if (Math.random() < 0.035) spawnObstacle();

    for (let i = obstacles.length - 1; i >= 0; i--) {
      const obs = obstacles[i];
      obs.z -= gameSpeed * 5;

      drawObstacle(obs);

      // Collision Check when obstacle reaches player Z zone
      if (obs.z > 40 && obs.z < 120) {
        if (Math.abs(player.x - obs.lane) < 0.6) {
          if (obs.type === 'pillar') {
            gameOver();
            return;
          } else if (obs.type === 'hurdle' && !player.isJumping) {
            gameOver();
            return;
          } else if (obs.type === 'high_beam' && !player.isDucking) {
            gameOver();
            return;
          }
        }
      }

      if (obs.z <= 0) {
        obstacles.splice(i, 1);
        score += 100;
        scoreVal.innerText = score;
      }
    }

    // Draw Player Ship
    drawPlayer();

    // Stats update
    distance += Math.round(gameSpeed / 2);
    distVal.innerText = `${distance}m`;
    gameSpeed += 0.001; // Gradual speed ramp

    animId = requestAnimationFrame(gameLoop);
  }

  // 3D Perspective Highway Rendering
  function drawHighway() {
    const horizonY = canvas.height * 0.4;
    const centerX = canvas.width / 2;

    // Draw Horizon Glow
    const grad = ctx.createLinearGradient(0, horizonY - 50, 0, horizonY + 50);
    grad.addColorStop(0, 'rgba(0, 242, 254, 0.4)');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.fillRect(0, horizonY - 50, canvas.width, 100);

    // Draw Lane Lines
    ctx.strokeStyle = '#00f2fe';
    ctx.lineWidth = 2;
    [-1.5, -0.5, 0.5, 1.5].forEach((laneOffset) => {
      ctx.beginPath();
      ctx.moveTo(centerX + laneOffset * 80, horizonY);
      ctx.lineTo(centerX + laneOffset * 400, canvas.height);
      ctx.stroke();
    });
  }

  function drawPlayer() {
    const horizonY = canvas.height * 0.4;
    const centerX = canvas.width / 2;
    const pX = centerX + player.x * 250;
    const pY = canvas.height - 120 - player.y;

    ctx.save();
    ctx.translate(pX, pY);

    // Lean Tilt Effect
    const tilt = (player.x - player.targetX) * 0.3;
    ctx.rotate(tilt);

    // Ship Body
    ctx.fillStyle = player.isDucking ? '#ffcc00' : '#00f2fe';
    ctx.shadowColor = '#00f2fe';
    ctx.shadowBlur = 20;

    ctx.beginPath();
    ctx.moveTo(0, -35);
    ctx.lineTo(-30, 25);
    ctx.lineTo(0, 15);
    ctx.lineTo(30, 25);
    ctx.closePath();
    ctx.fill();

    // Thruster Fire
    ctx.fillStyle = '#ff007f';
    ctx.beginPath();
    ctx.arc(0, 22, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawObstacle(obs) {
    const horizonY = canvas.height * 0.4;
    const scale = 1 - obs.z / 1000;
    if (scale <= 0) return;

    const centerX = canvas.width / 2;
    const oX = centerX + obs.lane * (80 + scale * 320);
    const oY = horizonY + scale * (canvas.height - horizonY - 120);

    ctx.save();
    ctx.translate(oX, oY);

    if (obs.type === 'pillar') {
      ctx.fillStyle = '#ff007f';
      ctx.shadowColor = '#ff007f';
      ctx.shadowBlur = 15;
      ctx.fillRect(-25 * scale, -100 * scale, 50 * scale, 120 * scale);
    } else if (obs.type === 'hurdle') {
      ctx.fillStyle = '#ffcc00';
      ctx.shadowColor = '#ffcc00';
      ctx.shadowBlur = 15;
      ctx.fillRect(-60 * scale, -30 * scale, 120 * scale, 30 * scale);
    } else if (obs.type === 'high_beam') {
      ctx.fillStyle = '#00ff88';
      ctx.shadowColor = '#00ff88';
      ctx.shadowBlur = 15;
      ctx.fillRect(-80 * scale, -140 * scale, 160 * scale, 40 * scale);
    }

    ctx.restore();
  }

  function gameOver() {
    isPlaying = false;
    if (animId) cancelAnimationFrame(animId);

    alert(`💥 CRASH! Game Over!\n\nFinal Score: ${score}\nDistance Survived: ${distance}m`);
    startOverlay.style.display = 'flex';
  }

  startGameBtn.addEventListener('click', () => {
    score = 0;
    distance = 0;
    gameSpeed = 6;
    obstacles = [];
    scoreVal.innerText = '0';
    distVal.innerText = '0m';
    startOverlay.style.display = 'none';
    isPlaying = true;
    gameLoop();
  });
});
