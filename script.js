'use strict';

// ── DOM Refs ────────────────────────────────────────────────
const dockBtns     = document.querySelectorAll('.dock-item');
const panes        = document.querySelectorAll('.pane');
const langBtns     = document.querySelectorAll('.lang-toggle button');
const modalOverlay = document.getElementById('modal-overlay');
const modalClose   = document.getElementById('modal-close');
const modalContent = document.getElementById('modal-content');
const termText     = document.getElementById('term-text');
const termPrev     = document.getElementById('term-prev');
const termCwd      = document.getElementById('term-cwd');
const btnClose     = document.querySelector('.ctrl-close');

let currentLang = 'en';
let gameActive  = false;

// ════════════════════════════════════════════════════════════
//  TAB SWITCHING (Dock)
// ════════════════════════════════════════════════════════════
function switchTab(id) {
  dockBtns.forEach(t => t.classList.toggle('active', t.dataset.tab === id));
  panes.forEach(p => {
    if (p.id === 'tab-' + id) {
      p.style.display = 'flex';
      p.offsetHeight; // reflow
      p.classList.add('active');
      if (id === 'sobre') animateCounters();
    } else {
      p.classList.remove('active');
      p.style.display = 'none';
    }
  });

  gameActive = (id === 'game');
}
dockBtns.forEach(t => t.addEventListener('click', () => switchTab(t.dataset.tab)));
if(btnClose) btnClose.addEventListener('click', () => { document.querySelector('.window').style.display = 'none'; });

// ════════════════════════════════════════════════════════════
//  LANGUAGE TOGGLE
// ════════════════════════════════════════════════════════════
function switchLang(lang) {
  currentLang = lang;
  langBtns.forEach(b => b.classList.toggle('active', b.id === 'btn-' + lang));
  document.querySelectorAll('[data-en][data-pt]').forEach(el => {
    const val = el.dataset[lang];
    if (val !== undefined) el.innerHTML = val;
  });
}
langBtns.forEach(b => b.addEventListener('click', () => switchLang(b.id.replace('btn-',''))));

// ════════════════════════════════════════════════════════════
//  MODALS
// ════════════════════════════════════════════════════════════
function openProject(key) {
  const p = window.PROJECTS[key];
  if (!p) return;
  const l = currentLang;
  const ttl = l === 'pt' ? p.titlePt : p.titleEn;
  const dsc = l === 'pt' ? p.descPt  : p.descEn;
  const lnk = l === 'pt' ? 'Ver no GitHub' : 'View on GitHub';

  modalContent.innerHTML = `
    <div class="modal-header">
      <i class="${p.icon}"></i><h2>${ttl}</h2>
    </div>
    <p class="modal-desc">${dsc}</p>
    <div class="modal-tech">${p.tech.map(t => `<span>${t}</span>`).join('')}</div>
    <pre class="modal-code">${p.code.replace(/</g,'&lt;')}</pre>
    <a href="${p.link}" target="_blank" class="btn btn--solid"><i class="fab fa-github" style="margin-right:8px"></i>${lnk}</a>
  `;
  modalOverlay.classList.add('open');
}
function closeModal() { modalOverlay.classList.remove('open'); }
modalClose.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });

// ════════════════════════════════════════════════════════════
//  TERMINAL TYPER (Fixed Layout)
// ════════════════════════════════════════════════════════════
const SESSIONS = [
  ['~', 'python main.py'],
  ['~/projects', 'git commit -m "fix layout bug"'],
  ['~', 'docker compose up -d'],
  ['~/api', 'uvicorn app:app --reload'],
  ['~', 'htop'],
  ['~', 'sudo systemctl restart nginx'],
  ['~/projects', 'pytest -v'],
];
let si = 0, ci = 0, typing = true, paused = false;

function tickTerminal() {
  if (paused) return;
  const [cwd, cmd] = SESSIONS[si];
  termCwd.textContent = cwd;

  if (typing) {
    if (ci <= cmd.length) {
      termText.textContent = cmd.slice(0, ci++);
      setTimeout(tickTerminal, 60 + Math.random() * 40);
    } else {
      paused = true;
      setTimeout(() => { paused = false; typing = false; tickTerminal(); }, 1500);
    }
  } else {
    if (ci > 0) {
      termText.textContent = cmd.slice(0, --ci);
      setTimeout(tickTerminal, 25);
    } else {
      termPrev.textContent = `$ ${cmd}`;
      si = (si + 1) % SESSIONS.length;
      typing = true;
      setTimeout(tickTerminal, 400);
    }
  }
}
setTimeout(tickTerminal, 500);

// ════════════════════════════════════════════════════════════
//  COUNTERS
// ════════════════════════════════════════════════════════════
let countersDone = false;
function animateCounters() {
  if (countersDone) return;
  countersDone = true;
  document.querySelectorAll('[data-count]').forEach(el => {
    const target = +el.dataset.count;
    const t0 = performance.now();
    (function tick(now) {
      const p = Math.min((now - t0) / 1000, 1);
      const e = p < .5 ? 2*p*p : -1+(4-2*p)*p;
      el.textContent = Math.round(e * target);
      if (p < 1) requestAnimationFrame(tick);
    })(t0);
  });
}

// ════════════════════════════════════════════════════════════
//  BACKGROUND PARTICLES (Interactive Fluid)
// ════════════════════════════════════════════════════════════
const bgCanvas = document.getElementById('bg-canvas');
const bgCtx = bgCanvas.getContext('2d');
let bgW, bgH;
let particles = [];
let mX = -9999, mY = -9999;

function resizeBg() {
  bgW = bgCanvas.width = window.innerWidth;
  bgH = bgCanvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeBg);
window.addEventListener('mousemove', e => { mX = e.clientX; mY = e.clientY; });
resizeBg();

class BgParticle {
  constructor() {
    this.x = Math.random() * bgW;
    this.y = Math.random() * bgH;
    this.vx = (Math.random() - 0.5) * 0.5;
    this.vy = (Math.random() - 0.5) * 0.5;
    this.baseSize = Math.random() * 1.5 + 0.5;
  }
  update() {
    // Magnetic repel from mouse
    const dx = mX - this.x;
    const dy = mY - this.y;
    const dist = Math.hypot(dx, dy);
    
    if (dist < 150) {
      const force = (150 - dist) / 150;
      this.vx -= (dx / dist) * force * 0.2;
      this.vy -= (dy / dist) * force * 0.2;
    }

    // Friction and bounds
    this.vx *= 0.98;
    this.vy *= 0.98;
    
    // Add natural drift
    this.x += this.vx + (Math.sin(Date.now() * 0.001 + this.y) * 0.1);
    this.y += this.vy - 0.2;

    if (this.y < -10) this.y = bgH + 10;
    if (this.x < -10) this.x = bgW + 10;
    if (this.x > bgW + 10) this.x = -10;
  }
  draw() {
    bgCtx.fillStyle = 'rgba(0, 255, 204, 0.4)';
    bgCtx.beginPath();
    bgCtx.arc(this.x, this.y, this.baseSize, 0, Math.PI * 2);
    bgCtx.fill();
  }
}

for (let i = 0; i < 150; i++) particles.push(new BgParticle());

function loopBg() {
  bgCtx.fillStyle = 'rgba(2, 4, 10, 0.3)'; // Trail effect
  bgCtx.fillRect(0, 0, bgW, bgH);
  
  particles.forEach(p => {
    p.update();
    p.draw();
  });
  
  // Connect close particles
  bgCtx.lineWidth = 0.5;
  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      const dx = particles[i].x - particles[j].x;
      const dy = particles[i].y - particles[j].y;
      const dist = Math.hypot(dx, dy);
      if (dist < 80) {
        bgCtx.strokeStyle = \`rgba(0, 255, 204, \${0.15 * (1 - dist/80)})\`;
        bgCtx.beginPath();
        bgCtx.moveTo(particles[i].x, particles[i].y);
        bgCtx.lineTo(particles[j].x, particles[j].y);
        bgCtx.stroke();
      }
    }
  }

  requestAnimationFrame(loopBg);
}
loopBg();

// ════════════════════════════════════════════════════════════
//  SPACE SHOOTER GAME (Plays only inside Tab)
// ════════════════════════════════════════════════════════════
const sCanvas = document.getElementById('shooter-canvas');
const sCtx = sCanvas.getContext('2d');
const sBtn = document.getElementById('start-game-btn');
const sOverlay = document.getElementById('game-overlay');
const sScore = document.getElementById('game-score');

let sW, sH;
let gameRunning = false;
let score = 0;
let ship = { x: 0, y: 0, w: 20, h: 20 };
let bullets = [];
let enemies = [];
let lastEnemyTime = 0;

function resizeGame() {
  const rect = sCanvas.parentElement.getBoundingClientRect();
  sW = sCanvas.width = rect.width;
  sH = sCanvas.height = rect.height;
  if (!gameRunning) {
    ship.x = sW / 2;
    ship.y = sH - 40;
  }
}
window.addEventListener('resize', resizeGame);

sCanvas.addEventListener('mousemove', e => {
  if (!gameRunning) return;
  const rect = sCanvas.getBoundingClientRect();
  ship.x = e.clientX - rect.left;
});

sCanvas.addEventListener('mousedown', () => {
  if (!gameRunning) return;
  bullets.push({ x: ship.x, y: ship.y - 10, v: 7 });
});

sBtn.addEventListener('click', () => {
  sOverlay.classList.add('hidden');
  gameRunning = true;
  score = 0;
  bullets = [];
  enemies = [];
  resizeGame();
  requestAnimationFrame(loopGame);
});

function spawnEnemy(now) {
  if (now - lastEnemyTime > 800) {
    enemies.push({
      x: Math.random() * (sW - 20) + 10,
      y: -20,
      v: Math.random() * 1.5 + 1.5,
      r: Math.random() * 10 + 10
    });
    lastEnemyTime = now;
  }
}

function loopGame(now) {
  if (!gameRunning || !gameActive) return; // Pause if tab is changed

  sCtx.clearRect(0, 0, sW, sH);

  // Draw Ship
  sCtx.fillStyle = '#00ffcc';
  sCtx.beginPath();
  sCtx.moveTo(ship.x, ship.y - ship.h);
  sCtx.lineTo(ship.x - ship.w/2, ship.y);
  sCtx.lineTo(ship.x + ship.w/2, ship.y);
  sCtx.fill();

  // Draw Bullets
  sCtx.fillStyle = '#ff3366';
  bullets.forEach((b, i) => {
    b.y -= b.v;
    sCtx.fillRect(b.x - 2, b.y, 4, 10);
    if (b.y < -10) bullets.splice(i, 1);
  });

  // Draw Enemies & Collision
  spawnEnemy(now);
  sCtx.fillStyle = '#ffbd2e';
  
  for (let i = enemies.length - 1; i >= 0; i--) {
    let e = enemies[i];
    e.y += e.v;
    
    // Draw Asteroid
    sCtx.beginPath();
    sCtx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
    sCtx.fill();

    // Collision with bullet
    for (let j = bullets.length - 1; j >= 0; j--) {
      let b = bullets[j];
      let dist = Math.hypot(e.x - b.x, e.y - b.y);
      if (dist < e.r + 5) {
        enemies.splice(i, 1);
        bullets.splice(j, 1);
        score += 10;
        sScore.textContent = 'Score: ' + score;
        break;
      }
    }

    // Out of bounds
    if (e && e.y > sH + 20) {
      enemies.splice(i, 1);
    }
  }

  requestAnimationFrame(loopGame);
}

// Ensure init sizing
setTimeout(resizeGame, 100);
