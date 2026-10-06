document.addEventListener('DOMContentLoaded', () => {
  const socket = io();

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const startOverlay = document.getElementById('startOverlay');
  const startGameBtn = document.getElementById('startGameBtn');
  const scoreVal = document.getElementById('scoreVal');
  const comboVal = document.getElementById('comboVal');
  const statusDot = document.getElementById('statusDot');

  let isPlaying = false;
  let score = 0;
  let combo = 0;
  let animId = null;

  // Active Target Orbs
  let targets = [];
  let particles = [];

  socket.on('connect', () => {
    statusDot.classList.add('connected');
  });

  socket.on('motion_event', (data) => {
    if (!isPlaying) return;

    const g = data.gestures || {};

    if (g.punchLeft) {
      handlePunch('left');
    }
    if (g.punchRight) {
      handlePunch('right');
    }

    // Also support hand coordinates direct strike
    if (data.hands) {
      if (data.hands.left) checkHandHit(data.hands.left, 'left');
      if (data.hands.right) checkHandHit(data.hands.right, 'right');
    }
  });

  // Keyboard / Click Fallback for local desktop testing
  window.addEventListener('keydown', (e) => {
    if (!isPlaying) return;
    if (e.key === 'z' || e.key === 'Z' || e.key === 'ArrowLeft') handlePunch('left');
    if (e.key === 'm' || e.key === 'M' || e.key === 'ArrowRight') handlePunch('right');
  });

  window.addEventListener('click', (e) => {
    if (!isPlaying) return;
    const side = e.clientX < canvas.width / 2 ? 'left' : 'right';
    handlePunch(side);
  });

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  function spawnTarget() {
    const side = Math.random() < 0.5 ? 'left' : 'right';
    const minX = side === 'left' ? 100 : canvas.width / 2 + 100;
    const maxX = side === 'left' ? canvas.width / 2 - 100 : canvas.width - 100;

    targets.push({
      x: minX + Math.random() * (maxX - minX),
      y: 150 + Math.random() * (canvas.height - 300),
      radius: 45,
      side: side,
      life: 120, // Frames before disappearing
      maxLife: 120
    });
  }

  function handlePunch(side) {
    let hitCount = 0;
    for (let i = targets.length - 1; i >= 0; i--) {
      const t = targets[i];
      if (t.side === side) {
        // Target smashed!
        createExplosion(t.x, t.y, t.side === 'left' ? '#ff007f' : '#00f2fe');
        targets.splice(i, 1);
        hitCount++;
      }
    }

    if (hitCount > 0) {
      combo += hitCount;
      score += hitCount * 150 * (1 + Math.floor(combo / 5) * 0.5);
      scoreVal.innerText = score;
      comboVal.innerText = `${combo}x`;
    } else {
      combo = 0;
      comboVal.innerText = '0x';
    }
  }

  function checkHandHit(hand, side) {
    const hX = (1 - hand.x) * canvas.width;
    const hY = hand.y * canvas.height;

    for (let i = targets.length - 1; i >= 0; i--) {
      const t = targets[i];
      const dist = Math.hypot(hX - t.x, hY - t.y);
      if (dist < t.radius + 20) {
        createExplosion(t.x, t.y, side === 'left' ? '#ff007f' : '#00f2fe');
        targets.splice(i, 1);
        combo++;
        score += 200 * (1 + Math.floor(combo / 5) * 0.5);
        scoreVal.innerText = score;
        comboVal.innerText = `${combo}x`;
      }
    }
  }

  function createExplosion(x, y, color) {
    for (let i = 0; i < 20; i++) {
      particles.push({
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * 12,
        vy: (Math.random() - 0.5) * 12,
        life: 25,
        color: color
      });
    }
  }

  // Game Render Loop
  function gameLoop() {
    if (!isPlaying) return;

    ctx.fillStyle = '#070310';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Dividing Line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw Zone Labels
    ctx.font = '24px monospace';
    ctx.fillStyle = 'rgba(255, 0, 127, 0.4)';
    ctx.fillText('LEFT PUNCH ZONE', 50, 80);
    ctx.fillStyle = 'rgba(0, 242, 254, 0.4)';
    ctx.fillText('RIGHT PUNCH ZONE', canvas.width / 2 + 50, 80);

    // Spawn New Targets
    if (Math.random() < 0.04 && targets.length < 5) {
      spawnTarget();
    }

    // Update & Render Targets
    for (let i = targets.length - 1; i >= 0; i--) {
      const t = targets[i];
      t.life--;

      if (t.life <= 0) {
        targets.splice(i, 1);
        combo = 0;
        comboVal.innerText = '0x';
        continue;
      }

      ctx.save();
      ctx.translate(t.x, t.y);

      const color = t.side === 'left' ? '#ff007f' : '#00f2fe';
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 20;

      ctx.beginPath();
      ctx.arc(0, 0, t.radius * (t.life / t.maxLife), 0, Math.PI * 2);
      ctx.fill();

      // Outer Ring
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, t.radius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
    }

    // Update & Render Particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life--;

      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }

      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.life / 4, 0, Math.PI * 2);
      ctx.fill();
    }

    animId = requestAnimationFrame(gameLoop);
  }

  startGameBtn.addEventListener('click', () => {
    score = 0;
    combo = 0;
    targets = [];
    particles = [];
    scoreVal.innerText = '0';
    comboVal.innerText = '0x';
    startOverlay.style.display = 'none';
    isPlaying = true;
    gameLoop();
  });
});
