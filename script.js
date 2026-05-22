'use strict';

// ── Refs ────────────────────────────────────────────────────
const tabBtns      = document.querySelectorAll('.tab');
const panes        = document.querySelectorAll('.pane');
const langBtns     = document.querySelectorAll('.lang-toggle button');
const translatables= document.querySelectorAll('[data-en],[data-pt]');
const modalOverlay = document.getElementById('modal-overlay');
const modalClose   = document.getElementById('modal-close');
const modalContent = document.getElementById('modal-content');
const cursorEl     = document.getElementById('cursor');
const cursorRing   = document.getElementById('cursor-ring');
const termText     = document.getElementById('term-text');
const termPrev     = document.getElementById('term-prev');
const termCwd      = document.getElementById('term-cwd');

let currentLang = 'en';

// ════════════════════════════════════════════════════════════
//  1 — NEURAL NETWORK CANVAS  (interactive, click-reactive)
// ════════════════════════════════════════════════════════════
const canvas = document.getElementById('neural-canvas');
const ctx    = canvas.getContext('2d');

let W, H;
let particles = [];
let ripples   = [];
let mouse     = { x: -9999, y: -9999 };

const CFG = {
  count:      68,
  connDist:   125,
  mouseDist:  160,
  speed:      0.28,
  color:      '0,229,176',      // teal green
  colorB:     '77,166,255',     // blue for mouse lines
  colorRipple:'0,229,176',
};

// ── Particle ──
class Particle {
  constructor() { this.init(true); }
  init(scattered = false) {
    this.x   = scattered ? Math.random() * W : Math.random() * W;
    this.y   = scattered ? Math.random() * H : -12;
    this.vx  = (Math.random() - 0.5) * CFG.speed;
    this.vy  = Math.random() * (CFG.speed * 0.8) + 0.06;
    this.r   = Math.random() * 1.5 + 0.7;
    this.op  = Math.random() * 0.45 + 0.18;
    this.phi = Math.random() * Math.PI * 2;
  }
  update() {
    const dx = this.x - mouse.x, dy = this.y - mouse.y;
    const d  = Math.hypot(dx, dy);
    if (d < CFG.mouseDist) {
      const f = (1 - d / CFG.mouseDist) * 0.42;
      this.vx += (dx / d) * f;
      this.vy += (dy / d) * f;
    }
    this.vx *= 0.975;
    this.vy *= 0.975;
    this.x  += this.vx;
    this.y  += this.vy;
    this.phi += 0.02;
    if (this.x < -14) this.x = W + 14;
    if (this.x > W + 14) this.x = -14;
    if (this.y > H + 14) this.init();
  }
  draw() {
    const pw = Math.sin(this.phi) * 0.3;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r + pw, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${CFG.color},${this.op})`;
    ctx.shadowBlur = 5;
    ctx.shadowColor = `rgba(${CFG.color},0.45)`;
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

// ── Click Ripple ──
class Ripple {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.r = 0; this.maxR = 90;
    this.life = 1;
  }
  update() {
    this.r    += 2.8;
    this.life -= 0.03;
  }
  draw() {
    if (this.life <= 0) return;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${CFG.colorRipple},${this.life * 0.55})`;
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // Inner ring
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r * 0.5, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${CFG.colorRipple},${this.life * 0.3})`;
    ctx.lineWidth = 0.7;
    ctx.stroke();
  }
  get dead() { return this.life <= 0 || this.r > this.maxR; }
}

function drawConnections() {
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];

    // Particle ↔ particle
    for (let j = i + 1; j < particles.length; j++) {
      const q  = particles[j];
      const d  = Math.hypot(p.x - q.x, p.y - q.y);
      if (d < CFG.connDist) {
        const a = (1 - d / CFG.connDist) * 0.3;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(q.x, q.y);
        ctx.strokeStyle = `rgba(${CFG.color},${a})`;
        ctx.lineWidth = 0.7;
        ctx.stroke();
      }
    }

    // Particle ↔ mouse
    const md = Math.hypot(p.x - mouse.x, p.y - mouse.y);
    if (md < CFG.mouseDist) {
      const a = (1 - md / CFG.mouseDist) * 0.5;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(mouse.x, mouse.y);
      ctx.strokeStyle = `rgba(${CFG.colorB},${a})`;
      ctx.lineWidth   = 1;
      ctx.stroke();
    }
  }
}

function resizeCanvas() {
  W = canvas.width  = window.innerWidth;
  H = canvas.height = window.innerHeight;
}

function buildParticles() {
  particles = Array.from({ length: CFG.count }, () => new Particle());
}

function loop() {
  ctx.clearRect(0, 0, W, H);
  drawConnections();
  particles.forEach(p => { p.update(); p.draw(); });

  // Ripples
  ripples = ripples.filter(r => !r.dead);
  ripples.forEach(r => { r.update(); r.draw(); });

  requestAnimationFrame(loop);
}

canvas.addEventListener('click', e => {
  for (let i = 0; i < 3; i++) ripples.push(new Ripple(e.clientX, e.clientY));
});

window.addEventListener('resize', () => { resizeCanvas(); buildParticles(); });
window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });

resizeCanvas();
buildParticles();
loop();

// ════════════════════════════════════════════════════════════
//  2 — CUSTOM CURSOR
// ════════════════════════════════════════════════════════════
let cx = 0, cy = 0, rx = 0, ry = 0;

document.addEventListener('mousemove', e => {
  cx = e.clientX; cy = e.clientY;
  cursorEl.style.left = cx + 'px';
  cursorEl.style.top  = cy + 'px';
});

(function trackRing() {
  rx += (cx - rx) * 0.13;
  ry += (cy - ry) * 0.13;
  cursorRing.style.left = rx + 'px';
  cursorRing.style.top  = ry + 'px';
  requestAnimationFrame(trackRing);
})();

// ════════════════════════════════════════════════════════════
//  3 — TAB SWITCHING
// ════════════════════════════════════════════════════════════
function switchTab(id) {
  tabBtns.forEach(t => t.classList.toggle('active', t.dataset.tab === id));
  panes.forEach(p => {
    const hit = p.id === 'tab-' + id;
    if (hit) {
      p.style.display = 'flex';
      p.offsetHeight; // reflow for animation
      p.classList.add('active');
      if (id === 'sobre')       animateCounters();
    } else {
      p.classList.remove('active');
      p.style.display = '';
    }
  });
}

tabBtns.forEach(t => t.addEventListener('click', () => switchTab(t.dataset.tab)));

// ════════════════════════════════════════════════════════════
//  4 — LANGUAGE TOGGLE
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
//  5 — PROJECT MODALS
// ════════════════════════════════════════════════════════════
function openProject(key) {
  const p   = (window.PROJECTS || {})[key];
  if (!p) return;
  const l   = currentLang;
  const ttl = l === 'pt' ? p.titlePt : p.titleEn;
  const dsc = l === 'pt' ? p.descPt  : p.descEn;
  const lnk = l === 'pt' ? 'Ver no GitHub' : 'View on GitHub';

  modalContent.innerHTML = `
    <div class="modal-header">
      <i class="${p.icon}"></i>
      <h2>${ttl}</h2>
    </div>
    <p class="modal-desc">${dsc}</p>
    <div class="modal-tech">${p.tech.map(t => `<span>${t}</span>`).join('')}</div>
    <pre class="modal-code">${esc(p.code)}</pre>
    <a href="${p.link}" target="_blank" class="modal-link">
      <i class="fab fa-github"></i>${lnk}
    </a>`;

  modalOverlay.classList.add('open');
}

function closeModal() { modalOverlay.classList.remove('open'); }
modalClose.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

function esc(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ════════════════════════════════════════════════════════════
//  6 — COUNTER ANIMATION
// ════════════════════════════════════════════════════════════
let countersDone = false;
function animateCounters() {
  if (countersDone) return;
  countersDone = true;
  document.querySelectorAll('[data-count]').forEach(el => {
    const target = +el.dataset.count;
    const t0     = performance.now();
    const dur    = 1100;
    (function tick(now) {
      const p = Math.min((now - t0) / dur, 1);
      const e = p < .5 ? 2*p*p : -1+(4-2*p)*p;
      el.textContent = Math.round(e * target);
      if (p < 1) requestAnimationFrame(tick);
    })(t0);
  });
}

// ════════════════════════════════════════════════════════════
//  7 — STAGGER CARD ENTRANCE (injected CSS)
// ════════════════════════════════════════════════════════════
function setupStagger() {
  const s = document.createElement('style');
  s.textContent = `
    .skill-card,.proj-card,.pillar,.clink {
      opacity:0; transform:translateY(14px);
    }
    .pane.active .skill-card,
    .pane.active .proj-card,
    .pane.active .pillar,
    .pane.active .clink {
      animation: _cardIn .38s var(--ease) both;
    }
    @keyframes _cardIn {
      from { opacity:0; transform:translateY(14px); }
      to   { opacity:1; transform:translateY(0); }
    }`;
  document.head.appendChild(s);

  const delay = (sel, step) =>
    document.querySelectorAll(sel).forEach((el,i) => el.style.animationDelay = `${i*step}ms`);

  delay('.skill-card', 35);
  delay('.proj-card',  50);
  delay('.pillar',     60);
  delay('.clink',      55);
}

// ════════════════════════════════════════════════════════════
//  8 — TERMINAL TYPER  (Linux + Python + Git commands)
// ════════════════════════════════════════════════════════════
const SESSIONS = [
  // [cwd, command, output?]
  ['~',           'python main.py'],
  ['~/projects',  'git status'],
  ['~/projects',  'git add -A; git commit -m "fix: edge case"'],
  ['~/projects',  'git push origin main'],
  ['~',           'docker compose up -d'],
  ['~',           'docker ps'],
  ['~/api',       'uvicorn app:app --reload'],
  ['~',           'htop'],
  ['~',           'ls -la /var/log'],
  ['~',           'sudo systemctl restart nginx'],
  ['~/projects',  'pytest -v --tb=short'],
  ['~',           'pip install openai langchain'],
  ['~',           'cat /etc/os-release'],
  ['~/api',       'curl localhost:8000/health'],
  ['~',           'grep -r "TODO" . --include="*.py"'],
  ['~/projects',  'black . && flake8 .'],
  ['~',           'journalctl -u myapp -f'],
  ['~',           'ssh bernardo@prod-server'],
];

let si = 0, ci = 0, typing = true, paused = false;

function tick() {
  if (paused) return;
  const [cwd, cmd] = SESSIONS[si];
  termCwd.textContent = cwd;

  if (typing) {
    if (ci <= cmd.length) {
      termText.textContent = cmd.slice(0, ci++);
      setTimeout(tick, 52 + Math.random() * 28);
    } else {
      paused = true;
      setTimeout(() => {
        paused  = false;
        typing  = false;
        tick();
      }, 1700);
    }
  } else {
    if (ci > 0) {
      termText.textContent = cmd.slice(0, --ci);
      setTimeout(tick, 22);
    } else {
      termPrev.textContent = `$ ${cmd}`;
      si = (si + 1) % SESSIONS.length;
      typing = true;
      setTimeout(tick, 380);
    }
  }
}

// ════════════════════════════════════════════════════════════
//  INIT
// ════════════════════════════════════════════════════════════
setupStagger();
animateCounters();
setTimeout(tick, 600);
