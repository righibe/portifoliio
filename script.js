/* ════════════════════════════
   Portfolio JS — Bernardo Righi
   ════════════════════════════ */

'use strict';

// ── DOM refs ──────────────────────────────────────────
const tabs         = document.querySelectorAll('.tab');
const panes        = document.querySelectorAll('.pane');
const langBtns     = document.querySelectorAll('.lang-toggle button');
const translatables= document.querySelectorAll('[data-en][data-pt]');
const modalOverlay = document.getElementById('modal-overlay');
const modalClose   = document.getElementById('modal-close');
const modalContent = document.getElementById('modal-content');
const cursor       = document.getElementById('cursor');
const cursorTrail  = document.getElementById('cursor-trail');
const termText     = document.getElementById('term-text');

let currentLang = 'en';

// ═══════════════════════════════════════════════
// 1. NEURAL NETWORK CANVAS BACKGROUND
// ═══════════════════════════════════════════════
const canvas = document.getElementById('neural-canvas');
const ctx    = canvas.getContext('2d');

let W, H, particles = [], mouse = { x: -999, y: -999 };

const PARTICLE_COUNT  = 70;
const CONNECTION_DIST = 130;
const MOUSE_DIST      = 180;

class Particle {
  constructor() { this.reset(true); }

  reset(init = false) {
    this.x  = Math.random() * W;
    this.y  = init ? Math.random() * H : -10;
    this.vx = (Math.random() - 0.5) * 0.35;
    this.vy = Math.random() * 0.25 + 0.1;
    this.r  = Math.random() * 1.8 + 0.6;
    this.opacity = Math.random() * 0.5 + 0.2;
    this.pulse   = Math.random() * Math.PI * 2;
  }

  update() {
    // Mouse repel
    const dx = this.x - mouse.x;
    const dy = this.y - mouse.y;
    const d  = Math.sqrt(dx * dx + dy * dy);
    if (d < MOUSE_DIST) {
      const force = (MOUSE_DIST - d) / MOUSE_DIST;
      this.vx += (dx / d) * force * 0.5;
      this.vy += (dy / d) * force * 0.5;
    }

    // Dampen
    this.vx *= 0.98;
    this.vy *= 0.98;

    this.x += this.vx;
    this.y += this.vy;
    this.pulse += 0.025;

    // Wrap X, reset Y
    if (this.x < -10)   this.x = W + 10;
    if (this.x > W + 10) this.x = -10;
    if (this.y > H + 10) this.reset();
  }

  draw() {
    const pulse = Math.sin(this.pulse) * 0.3;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r + pulse, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(0,234,197,${this.opacity + pulse * 0.1})`;
    ctx.shadowBlur  = 6;
    ctx.shadowColor = 'rgba(0,234,197,0.5)';
    ctx.fill();
    ctx.shadowBlur  = 0;
  }
}

function resize() {
  W = canvas.width  = window.innerWidth;
  H = canvas.height = window.innerHeight;
}

function initParticles() {
  particles = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) particles.push(new Particle());
}

function drawConnections() {
  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      const p = particles[i], q = particles[j];
      const dx = p.x - q.x, dy = p.y - q.y;
      const d  = Math.sqrt(dx * dx + dy * dy);
      if (d < CONNECTION_DIST) {
        const alpha = (1 - d / CONNECTION_DIST) * 0.35;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(q.x, q.y);
        ctx.strokeStyle = `rgba(0,234,197,${alpha})`;
        ctx.lineWidth   = 0.8;
        ctx.stroke();
      }
    }
    // Mouse connections
    const p  = particles[i];
    const dx = p.x - mouse.x, dy = p.y - mouse.y;
    const d  = Math.sqrt(dx * dx + dy * dy);
    if (d < MOUSE_DIST) {
      const alpha = (1 - d / MOUSE_DIST) * 0.5;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(mouse.x, mouse.y);
      ctx.strokeStyle = `rgba(0,184,245,${alpha})`;
      ctx.lineWidth   = 1;
      ctx.stroke();
    }
  }
}

function animateCanvas() {
  ctx.clearRect(0, 0, W, H);
  drawConnections();
  particles.forEach(p => { p.update(); p.draw(); });
  requestAnimationFrame(animateCanvas);
}

window.addEventListener('resize', () => { resize(); initParticles(); });
window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });

resize();
initParticles();
animateCanvas();

// ═══════════════════════════════════════════════
// 2. CUSTOM CURSOR
// ═══════════════════════════════════════════════
let cursorX = 0, cursorY = 0, trailX = 0, trailY = 0;

document.addEventListener('mousemove', e => {
  cursorX = e.clientX;
  cursorY = e.clientY;
  cursor.style.left = cursorX + 'px';
  cursor.style.top  = cursorY + 'px';
});

function animateCursor() {
  trailX += (cursorX - trailX) * 0.12;
  trailY += (cursorY - trailY) * 0.12;
  cursorTrail.style.left = trailX + 'px';
  cursorTrail.style.top  = trailY + 'px';
  requestAnimationFrame(animateCursor);
}
animateCursor();

// ═══════════════════════════════════════════════
// 3. TAB SWITCHING
// ═══════════════════════════════════════════════
function switchTab(id) {
  tabs.forEach(t  => t.classList.toggle('active', t.dataset.tab === id));
  panes.forEach(p => {
    const active = p.id === 'tab-' + id;
    if (active) {
      p.style.display = 'flex';
      // Force reflow for animation
      p.offsetHeight;
      p.classList.add('active');
      // Trigger skill bars
      if (id === 'habilidades') animateSkillBars();
      // Trigger counters
      if (id === 'sobre') animateCounters();
    } else {
      p.classList.remove('active');
      p.style.display = '';
    }
  });
}

tabs.forEach(tab => {
  tab.addEventListener('click', () => switchTab(tab.dataset.tab));
});

// ═══════════════════════════════════════════════
// 4. LANGUAGE TOGGLE
// ═══════════════════════════════════════════════
function switchLang(lang) {
  currentLang = lang;
  langBtns.forEach(btn => btn.classList.toggle('active', btn.id === 'btn-' + lang));
  translatables.forEach(el => {
    const val = el.dataset[lang];
    if (val) el.innerHTML = val;
  });
}

langBtns.forEach(btn => {
  btn.addEventListener('click', () => switchLang(btn.id.replace('btn-', '')));
});

// ═══════════════════════════════════════════════
// 5. PROJECT MODALS
// ═══════════════════════════════════════════════
const PROJECTS = window.PROJECTS || {};

function openProject(key) {
  const p = PROJECTS[key];
  if (!p) return;

  const lang    = currentLang;
  const title   = lang === 'pt' ? p.titlePt : p.titleEn;
  const desc    = lang === 'pt' ? p.descPt  : p.descEn;
  const linkTxt = lang === 'pt' ? 'Ver no GitHub' : 'View on GitHub';

  modalContent.innerHTML = `
    <div class="modal-header">
      <i class="${p.icon}"></i>
      <h2>${title}</h2>
    </div>
    <p class="modal-desc">${desc}</p>
    <div class="modal-tech">
      ${p.tech.map(t => `<span>${t}</span>`).join('')}
    </div>
    <pre class="modal-code">${escapeHtml(p.code)}</pre>
    <a href="${p.link}" target="_blank" class="modal-link">
      <i class="fab fa-github"></i> ${linkTxt}
    </a>
  `;

  modalOverlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  modalOverlay.classList.remove('open');
  document.body.style.overflow = '';
}

modalClose.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', e => {
  if (e.target === modalOverlay) closeModal();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ═══════════════════════════════════════════════
// 6. ANIMATED SKILL BARS
// ═══════════════════════════════════════════════
let skillsAnimated = false;

function animateSkillBars() {
  if (skillsAnimated) return;
  skillsAnimated = true;
  const bars = document.querySelectorAll('.skill-bar__fill');
  bars.forEach((bar, i) => {
    setTimeout(() => {
      bar.style.width = bar.dataset.pct + '%';
    }, i * 60);
  });
}

// ═══════════════════════════════════════════════
// 7. COUNTER ANIMATION (About stats)
// ═══════════════════════════════════════════════
let countersAnimated = false;

function animateCounters() {
  if (countersAnimated) return;
  countersAnimated = true;
  document.querySelectorAll('[data-count]').forEach(el => {
    const target   = parseInt(el.dataset.count);
    const duration = 1200;
    const start    = performance.now();
    function step(now) {
      const t   = Math.min((now - start) / duration, 1);
      const ease= t < 0.5 ? 2*t*t : -1+(4-2*t)*t;
      el.textContent = Math.round(ease * target);
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  });
}

// ═══════════════════════════════════════════════
// 8. TERMINAL TYPER (sidebar)
// ═══════════════════════════════════════════════
const COMMANDS = [
  'python manage.py runserver',
  'git commit -m "feat: add AI"',
  'docker compose up -d',
  'pytest --cov=. -v',
  'pip install openai langchain',
  'java -jar spring-boot.jar',
  'git push origin main',
  'flake8 . && black .',
];

let cmdIdx = 0, charIdx = 0, typing = true, waiting = false;

function typeTerminal() {
  if (waiting) return;
  const cmd = COMMANDS[cmdIdx];

  if (typing) {
    if (charIdx <= cmd.length) {
      termText.textContent = cmd.slice(0, charIdx);
      charIdx++;
      setTimeout(typeTerminal, 55 + Math.random() * 30);
    } else {
      // Done typing, wait then erase
      waiting = true;
      setTimeout(() => {
        waiting = false;
        typing  = false;
        typeTerminal();
      }, 1800);
    }
  } else {
    // Erasing
    if (charIdx > 0) {
      charIdx--;
      termText.textContent = cmd.slice(0, charIdx);
      setTimeout(typeTerminal, 25);
    } else {
      // Move to next command
      cmdIdx  = (cmdIdx + 1) % COMMANDS.length;
      typing  = true;
      charIdx = 0;
      setTimeout(typeTerminal, 400);
    }
  }
}

// ═══════════════════════════════════════════════
// 9. STAGGER CARD ENTRANCE ANIMATION
// ═══════════════════════════════════════════════
function addEntranceAnimations() {
  const style = document.createElement('style');
  style.textContent = `
    .skill-card, .ai-card, .proj-card, .pillar, .clink {
      opacity: 0;
      transform: translateY(16px);
      animation: none;
    }
    .pane.active .skill-card,
    .pane.active .ai-card,
    .pane.active .proj-card,
    .pane.active .pillar,
    .pane.active .clink {
      animation: cardIn .4s var(--ease) both;
    }
    @keyframes cardIn {
      from { opacity: 0; transform: translateY(16px); }
      to   { opacity: 1; transform: translateY(0); }
    }
  `;

  // Add staggered delays via inline styles
  document.querySelectorAll('.skill-card').forEach((el, i) => {
    el.style.animationDelay = `${i * 40}ms`;
  });
  document.querySelectorAll('.ai-card').forEach((el, i) => {
    el.style.animationDelay = `${i * 50}ms`;
  });
  document.querySelectorAll('.proj-card').forEach((el, i) => {
    el.style.animationDelay = `${i * 60}ms`;
  });
  document.querySelectorAll('.pillar').forEach((el, i) => {
    el.style.animationDelay = `${i * 70}ms`;
  });
  document.querySelectorAll('.clink').forEach((el, i) => {
    el.style.animationDelay = `${i * 60}ms`;
  });

  document.head.appendChild(style);
}

// ═══════════════════════════════════════════════
// 10. KEYBOARD NAVIGATION
// ═══════════════════════════════════════════════
const TAB_KEYS = ['sobre','habilidades','aiml','lideranca','projetos','contato'];

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && modalOverlay.classList.contains('open')) return;
  if (e.altKey) {
    const idx = parseInt(e.key) - 1;
    if (idx >= 0 && idx < TAB_KEYS.length) {
      switchTab(TAB_KEYS[idx]);
    }
  }
});

// ═══════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════
(function init() {
  addEntranceAnimations();
  animateCounters();  // First tab is About
  typeTerminal();
})();
