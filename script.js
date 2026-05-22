"use strict";

const canvas = document.getElementById("neural-canvas");
const ctx = canvas.getContext("2d");
const panel = document.getElementById("section-panel");
const panelContent = document.getElementById("panel-content");
const panelKicker = document.getElementById("panel-kicker");
const panelClose = document.getElementById("panel-close");
const navItems = [...document.querySelectorAll(".nav__item")];
const langItems = [...document.querySelectorAll(".lang-toggle__item")];
const modal = document.getElementById("project-modal");
const modalContent = document.getElementById("modal-content");
const modalClose = document.getElementById("modal-close");
const exploreHud = document.getElementById("explore-hud");
const exploreScore = document.getElementById("explore-score");

const sections = window.PORTFOLIO.sections;
const projects = window.PORTFOLIO.projects;
const keys = ["about", "skills", "leadership", "projects", "contact"];
const colors = ["#E5E7EB", "#8FAEFF", "#D1D5DB", "#BFC7D5", "#8F1D2C"];

let width = 0;
let height = 0;
let dpr = 1;
let activeSection = null;
let currentLang = "en";
let hoverNode = null;
let time = 0;
let mouse = { x: -999, y: -999, tx: -999, ty: -999, down: false };
let camera = { x: 0, y: 0, tx: 0, ty: 0 };
let nodes = [];
let filaments = [];
let sparks = [];
let asteroids = [];
let exploreMode = false;
let score = 0;
let ship = { x: 0, y: 0, tx: 0, ty: 0, vx: 0, vy: 0 };
let keysDown = new Set();
const bootTime = performance.now();

const clusterLayout = {
  about: { x: 0.47, y: 0.44, r: 94 },
  skills: { x: 0.63, y: 0.27, r: 88 },
  leadership: { x: 0.67, y: 0.58, r: 84 },
  projects: { x: 0.55, y: 0.74, r: 92 },
  contact: { x: 0.36, y: 0.68, r: 82 },
  secret: { x: 0.28, y: 0.18, r: 28 }
};

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = width + "px";
  canvas.style.height = height + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  buildNetwork();
  ship.x = ship.tx = width * 0.5;
  ship.y = ship.ty = height * 0.58;
}

function buildNetwork() {
  nodes = [];
  filaments = [];
  sparks = [];
  keys.forEach((key, clusterIndex) => {
    const cluster = clusterLayout[key];
    const count = key === "about" ? 19 : 14;
    const cx = cluster.x * width;
    const cy = cluster.y * height;

    nodes.push(makeNode({
      key,
      label: labelFor(key),
      x: cx,
      y: cy,
      size: key === activeSection ? 12 : 10,
      core: true,
      color: colors[clusterIndex]
    }));

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.34;
      const radius = cluster.r * (0.38 + Math.random() * 0.82);
      nodes.push(makeNode({
        key,
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
        size: 2.1 + Math.random() * 3.5,
        color: colors[clusterIndex],
        orbit: angle,
        orbitSpeed: 0.00018 + Math.random() * 0.00028
      }));
    }
  });

  const secret = clusterLayout.secret;
  nodes.push(makeNode({
    key: "secret",
    label: "Explore",
    x: secret.x * width,
    y: secret.y * height,
    size: 7,
    core: true,
    secret: true,
    color: "#8F1D2C"
  }));

  nodes.forEach((node, index) => {
    for (let other = index + 1; other < nodes.length; other++) {
      const pair = nodes[other];
      const sameCluster = node.key === pair.key;
      const dist = distance(node, pair);
      if ((sameCluster && dist < 132) || (!sameCluster && node.core && pair.core && dist < width * 0.48)) {
        filaments.push({
          a: node,
          b: pair,
          alpha: sameCluster ? 0.28 : 0.13,
          pulse: Math.random() * Math.PI * 2
        });
      }
    }
  });

  for (let i = 0; i < 70; i++) {
    sparks.push({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.13,
      vy: (Math.random() - 0.5) * 0.13,
      size: 0.7 + Math.random() * 1.6,
      alpha: 0.12 + Math.random() * 0.35,
      red: Math.random() < 0.08
    });
  }
}

function makeNode(options) {
  return {
    baseX: options.x,
    baseY: options.y,
    x: options.x,
    y: options.y,
    vx: 0,
    vy: 0,
    key: options.key,
    label: options.label || "",
    size: options.size,
    core: Boolean(options.core),
    secret: Boolean(options.secret),
    color: options.color,
    orbit: options.orbit || 0,
    orbitSpeed: options.orbitSpeed || 0
  };
}

function labelFor(key) {
  const labels = {
    en: { about: "About", skills: "Skills", leadership: "Leadership", projects: "Projects", contact: "Contact" },
    pt: { about: "Sobre", skills: "Skills", leadership: "Liderança", projects: "Projetos", contact: "Contato" }
  };
  return labels[currentLang][key];
}

function t(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value[currentLang] || value.en || "";
  return value || "";
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function setActiveSection(key) {
  if (!sections[key]) return;
  activeSection = key;
  document.body.classList.add("content-open");
  hoverNode = null;
  navItems.forEach(item => item.classList.toggle("active", item.dataset.section === key));

  const core = nodes.find(node => node.key === key && node.core);
  if (core) {
    camera.tx = (width * 0.52 - core.baseX) * 0.035;
    camera.ty = (height * 0.5 - core.baseY) * 0.035;
    core.size = 12;
  }

  panel.classList.remove("active");
  panel.scrollTop = 0;
  window.setTimeout(() => {
    renderPanel(key);
    panel.classList.add("active");
  }, 170);
}

function closeSection() {
  activeSection = null;
  document.body.classList.remove("content-open");
  panel.classList.remove("active");
  navItems.forEach(item => item.classList.remove("active"));
  camera.tx = 0;
  camera.ty = 0;
  mouse.tx = -999;
  mouse.ty = -999;
  hoverNode = null;
}

function renderPanel(key) {
  const data = sections[key];
  panelKicker.textContent = t(data.kicker);
  let html = `<h2 class="panel-title">${t(data.title)}</h2>`;

  if (key === "about") {
    html += `
      <div class="about-layout">
        <div class="about-photo"><img src="avatar.png" alt="Bernardo Righi"></div>
        <div><p class="panel-text">${t(data.text)}</p></div>
      </div>
    `;
  } else {
    html += `<p class="panel-text">${t(data.text)}</p>`;
  }

  if (data.stats) {
    html += `<div class="stat-flow">${data.stats.map(([value, label]) => `<div class="stat"><strong>${value}</strong><span>${t(label)}</span></div>`).join("")}</div>`;
  }

  if (data.chips) {
    html += `<div class="chip-cloud">${data.chips.map(chip => `<span class="chip">${chip}</span>`).join("")}</div>`;
  }

  if (data.groups) {
    html += `<div class="orbital-list">${data.groups.map(([title, desc]) => {
      const titleText = t(title);
      const isPartnerships = key === "leadership" && titleText.toLowerCase().includes(currentLang === "pt" ? "parcerias" : "partnerships");
      const partners = isPartnerships && data.links
        ? `<div class="partner-links">${data.links.map(([label, href]) => `<a class="partner-link" href="${href}" target="_blank" rel="noopener"><i class="fa-solid fa-arrow-up-right-from-square"></i>${label}</a>`).join("")}</div>`
        : "";
      return `<div class="orbital-item"><strong>${titleText}</strong><span>${t(desc)}</span>${partners}</div>`;
    }).join("")}</div>`;
  }

  if (data.projects) {
    html += `<div class="project-flow">${data.projects.map(projectKey => {
      const project = projects[projectKey];
      return `<button class="project-card" data-project="${projectKey}"><i class="${project.icon}"></i><strong>${project.title}</strong><span>${project.tech.join(" / ")}</span><p>${t(project.desc)}</p><small>${t(project.impact)}</small></button>`;
    }).join("")}</div>`;
  }

  if (data.links && key === "contact") {
    html += `<div class="contact-flow">${data.links.map(([label, value, href]) => `<a class="contact-link" href="${href}" target="_blank" rel="noopener"><span>${label}</span>${value}</a>`).join("")}</div>`;
  }

  panelContent.innerHTML = html;
  panelContent.querySelectorAll("[data-project]").forEach(button => {
    button.addEventListener("click", () => openProject(button.dataset.project));
  });
}

function openProject(key) {
  const project = projects[key];
  if (!project) return;
  modalContent.innerHTML = `
    <div class="modal-heading">
      <i class="${project.icon}"></i>
      <h2 id="modal-title">${project.title}</h2>
    </div>
    <p>${t(project.desc)}</p>
    <div class="modal-impact"><strong>${currentLang === "pt" ? "Impacto" : "Impact"}:</strong> ${t(project.impact)}</div>
    <div class="modal-tech">${project.tech.map(item => `<span>${item}</span>`).join("")}</div>
    <a class="modal-link" href="${project.link}" target="_blank" rel="noopener"><i class="fa-brands fa-github"></i> ${currentLang === "pt" ? "Ver no GitHub" : "View on GitHub"}</a>
  `;
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
}

function closeProject() {
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
}

function activateExploreMode() {
  if (exploreMode) return;
  exploreMode = true;
  score = 0;
  asteroids = [];
  document.body.classList.add("content-open");
  exploreHud.classList.add("active");
  exploreHud.setAttribute("aria-hidden", "false");
  exploreScore.textContent = "0";
}

function updateNetwork(delta) {
  mouse.x += (mouse.tx - mouse.x) * 0.12;
  mouse.y += (mouse.ty - mouse.y) * 0.12;
  camera.x += (camera.tx - camera.x) * 0.045;
  camera.y += (camera.ty - camera.y) * 0.045;

  hoverNode = null;
  let nearest = Infinity;

  nodes.forEach(node => {
    const activePull = node.key === activeSection ? 1.1 : 0.72;
    const wave = Math.sin(time * 0.0012 + node.baseX * 0.008 + node.baseY * 0.006);
    const orbitX = Math.cos(time * node.orbitSpeed + node.orbit) * (node.core ? 0 : 4.5 * activePull);
    const orbitY = Math.sin(time * node.orbitSpeed + node.orbit) * (node.core ? 0 : 4.5 * activePull);
    const targetX = node.baseX + orbitX + wave * 4 + camera.x;
    const targetY = node.baseY + orbitY + Math.cos(time * 0.001 + node.baseX * 0.006) * 4 + camera.y;
    const dx = mouse.x - node.x;
    const dy = mouse.y - node.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 118 && dist > 0.01) {
      const force = (118 - dist) / 118;
      node.vx -= (dx / dist) * force * 0.22;
      node.vy -= (dy / dist) * force * 0.22;
    }

    node.vx += (targetX - node.x) * 0.012;
    node.vy += (targetY - node.y) * 0.012;
    node.vx *= 0.9;
    node.vy *= 0.9;
    node.x += node.vx * delta;
    node.y += node.vy * delta;

    const hitSize = node.secret ? 54 : node.core ? 66 : 22;
    if (hitSize && dist < hitSize && dist < nearest) {
      hoverNode = node;
      nearest = dist;
    }
  });

  sparks.forEach(spark => {
    spark.x += spark.vx * delta;
    spark.y += spark.vy * delta;
    if (spark.x < -20) spark.x = width + 20;
    if (spark.x > width + 20) spark.x = -20;
    if (spark.y < -20) spark.y = height + 20;
    if (spark.y > height + 20) spark.y = -20;
  });
}

function drawNetwork() {
  const intro = Math.min(1, Math.max(0, (time - bootTime) / 1650));
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "rgba(0, 0, 0, 0.92)");
  gradient.addColorStop(0.52, "rgba(2, 3, 7, 0.94)");
  gradient.addColorStop(1, "rgba(4, 5, 9, 0.96)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  sparks.forEach(spark => {
    ctx.beginPath();
    const redSpark = spark.red ? "143, 29, 44" : "230, 236, 246";
    ctx.fillStyle = `rgba(${redSpark}, ${spark.alpha * 0.62})`;
    ctx.arc(spark.x, spark.y, spark.size, 0, Math.PI * 2);
    ctx.fill();
  });

  filaments.forEach(line => {
    const active = line.a.key === activeSection || line.b.key === activeSection;
    const nearMouse = pointLineDistance(mouse.x, mouse.y, line.a.x, line.a.y, line.b.x, line.b.y) < 62;
    const secretLine = exploreMode && (line.a.secret || line.b.secret);
    const pulse = (Math.sin(time * (exploreMode ? 0.012 : 0.004) + line.pulse) + 1) * 0.5;
    const alpha = (line.alpha + (active ? 0.18 : 0) + (nearMouse ? 0.22 : 0) + (secretLine ? 0.3 : 0) + pulse * 0.05) * intro;
    const stroke = active || nearMouse ? "230, 236, 246" : "118, 128, 148";

    ctx.beginPath();
    ctx.lineWidth = active ? 1.1 : 0.7;
    ctx.strokeStyle = `rgba(${stroke}, ${Math.min(alpha, 0.72)})`;
    ctx.moveTo(line.a.x, line.a.y);
    ctx.quadraticCurveTo(
      (line.a.x + line.b.x) / 2 + Math.sin(time * 0.001 + line.pulse) * 18,
      (line.a.y + line.b.y) / 2 + Math.cos(time * 0.0012 + line.pulse) * 18,
      line.b.x,
      line.b.y
    );
    ctx.stroke();
  });

  nodes.forEach(node => {
    const active = node.key === activeSection;
    const hover = hoverNode === node;
    const glow = node.secret && !exploreMode ? 0.42 : active ? 0.45 : 0.18;
    const radius = (node.size + (active ? 2 : 0) + (hover ? 5 : 0) + (node.secret ? Math.sin(time * 0.006) * 1.8 : 0)) * (0.38 + intro * 0.62);

    ctx.beginPath();
    ctx.fillStyle = node.color;
    ctx.shadowColor = node.color;
    ctx.shadowBlur = node.core ? 28 * glow : 15 * glow;
    ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.beginPath();
    ctx.strokeStyle = hexToRgba(node.color, active || hover ? 0.36 : 0.15);
    ctx.lineWidth = 1;
    ctx.arc(node.x, node.y, radius + 13 + Math.sin(time * 0.004) * 2, 0, Math.PI * 2);
    ctx.stroke();

    if (node.core && (!node.secret || hover)) {
      ctx.font = "500 12px JetBrains Mono, monospace";
      ctx.fillStyle = active || hover || node.secret ? "rgba(245, 247, 251, 0.9)" : "rgba(226, 232, 240, 0.5)";
      ctx.fillText(node.label, node.x + 18, node.y - 14);
    }
  });
}

function pointLineDistance(px, py, x1, y1, x2, y2) {
  const a = px - x1;
  const b = py - y1;
  const c = x2 - x1;
  const d = y2 - y1;
  const dot = a * c + b * d;
  const len = c * c + d * d;
  const param = len ? Math.max(0, Math.min(1, dot / len)) : 0;
  return Math.hypot(px - (x1 + param * c), py - (y1 + param * d));
}

function hexToRgba(hex, alpha) {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function updateExplore(delta) {
  if (!exploreMode) return;

  let ax = 0;
  let ay = 0;
  if (keysDown.has("ArrowLeft") || keysDown.has("a")) ax -= 0.42;
  if (keysDown.has("ArrowRight") || keysDown.has("d")) ax += 0.42;
  if (keysDown.has("ArrowUp") || keysDown.has("w")) ay -= 0.42;
  if (keysDown.has("ArrowDown") || keysDown.has("s")) ay += 0.42;

  if (Math.abs(mouse.tx) < 999) {
    ship.tx = mouse.tx;
    ship.ty = mouse.ty;
    ship.vx += (ship.tx - ship.x) * 0.002;
    ship.vy += (ship.ty - ship.y) * 0.002;
  }

  ship.vx += ax;
  ship.vy += ay;
  ship.vx *= 0.92;
  ship.vy *= 0.92;
  ship.x = Math.max(24, Math.min(width - 24, ship.x + ship.vx * delta));
  ship.y = Math.max(92, Math.min(height - 28, ship.y + ship.vy * delta));

  if (Math.random() < 0.025 * delta) {
    asteroids.push({
      x: Math.random() * width,
      y: -40,
      r: 8 + Math.random() * 19,
      vx: (Math.random() - 0.5) * 0.45,
      vy: 0.7 + Math.random() * 1.4,
      spin: Math.random() * Math.PI,
      hit: false
    });
  }

  asteroids.forEach(asteroid => {
    asteroid.x += asteroid.vx * delta;
    asteroid.y += asteroid.vy * delta;
    asteroid.spin += 0.02 * delta;
    const dist = Math.hypot(asteroid.x - ship.x, asteroid.y - ship.y);
    if (!asteroid.hit && dist < asteroid.r + 17) {
      asteroid.hit = true;
      score += 10;
      exploreScore.textContent = String(score);
      for (let i = 0; i < 6; i++) {
        sparks.push({
          x: asteroid.x,
          y: asteroid.y,
          vx: (Math.random() - 0.5) * 1.4,
          vy: (Math.random() - 0.5) * 1.4,
          size: 1 + Math.random() * 2,
          alpha: 0.42,
          red: true
        });
      }
    }
  });
  asteroids = asteroids.filter(asteroid => asteroid.y < height + 60 && !asteroid.hit);
}

function drawExplore() {
  if (!exploreMode) return;

  nodes.filter(node => node.key === "secret" || node.key === activeSection).forEach((node, index) => {
    const angle = time * 0.003 + index;
    const orbit = 34 + (index % 5) * 9;
    ctx.beginPath();
    ctx.fillStyle = "rgba(230, 236, 246, 0.64)";
    ctx.arc(ship.x + Math.cos(angle) * orbit, ship.y + Math.sin(angle) * orbit, 2.2, 0, Math.PI * 2);
    ctx.fill();
  });

  asteroids.forEach(asteroid => {
    ctx.save();
    ctx.translate(asteroid.x, asteroid.y);
    ctx.rotate(asteroid.spin);
    ctx.beginPath();
    ctx.strokeStyle = "rgba(230, 236, 246, 0.62)";
    ctx.fillStyle = "rgba(30, 58, 138, 0.12)";
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      const radius = asteroid.r * (0.72 + Math.sin(i * 1.7 + asteroid.spin) * 0.16);
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  });

  ctx.save();
  ctx.translate(ship.x, ship.y);
  ctx.beginPath();
  ctx.fillStyle = "rgba(245, 247, 251, 0.92)";
  ctx.shadowColor = "#8FAEFF";
  ctx.shadowBlur = 24;
  ctx.moveTo(0, -18);
  ctx.lineTo(-12, 14);
  ctx.lineTo(0, 7);
  ctx.lineTo(12, 14);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();
}

function loop(now) {
  const delta = Math.min(2, (now - time) / 16.67 || 1);
  time = now;
  updateNetwork(delta);
  updateExplore(delta);
  drawNetwork();
  drawExplore();
  document.body.style.cursor = hoverNode ? "pointer" : "default";
  requestAnimationFrame(loop);
}

canvas.addEventListener("mousemove", event => {
  mouse.tx = event.clientX;
  mouse.ty = event.clientY;
});

canvas.addEventListener("mouseleave", () => {
  mouse.tx = -999;
  mouse.ty = -999;
});

canvas.addEventListener("click", () => {
  const target = hoverNode || getClickableNode(mouse.tx, mouse.ty);
  if (!target) return;
  if (target.secret) {
    activateExploreMode();
    return;
  }
  if (target.key && target.key !== "secret") {
    if (activeSection === target.key) closeSection();
    else setActiveSection(target.key);
    mouse.tx = -999;
    mouse.ty = -999;
    hoverNode = null;
  }
});

function getClickableNode(x, y) {
  let picked = null;
  let nearest = Infinity;
  nodes.forEach(node => {
    const hitSize = node.secret ? 60 : node.core ? 74 : 26;
    const dist = Math.hypot(x - node.x, y - node.y);
    if (dist < hitSize && dist < nearest) {
      picked = node;
      nearest = dist;
    }
  });
  return picked;
}

navItems.forEach(item => {
  item.addEventListener("click", () => {
    hoverNode = null;
    mouse.tx = -999;
    mouse.ty = -999;
    if (activeSection === item.dataset.section) closeSection();
    else setActiveSection(item.dataset.section);
    item.blur();
  });
});

document.querySelector(".signal").addEventListener("click", event => {
  event.preventDefault();
  closeSection();
});

panelClose.addEventListener("click", closeSection);

langItems.forEach(item => {
  item.addEventListener("click", () => {
    currentLang = item.dataset.lang;
    langItems.forEach(button => button.classList.toggle("active", button === item));
    document.documentElement.lang = currentLang === "pt" ? "pt-BR" : "en";
    document.querySelector('[data-i18n="heroEyebrow"]').textContent = currentLang === "pt" ? "Engenharia de Software | Sistemas de IA | Comunidade" : "Software Engineer | AI Systems | Community Builder";
    document.querySelector(".identity__copy").textContent = currentLang === "pt"
      ? "Desenvolvedor back-end trabalhando com Python, Java, automação e sistemas inteligentes."
      : "Back-end developer working with Python, Java, automation and intelligent systems.";
    document.querySelector('[data-i18n="hint"]').textContent = currentLang === "pt" ? "Clique em um cluster neural ou use a navegação" : "Click a neural cluster or use the top navigation";
    document.querySelector('[data-i18n="backHome"]').textContent = currentLang === "pt" ? "Voltar para a rede" : "Back to neural map";
    navItems.forEach(nav => { nav.textContent = labelFor(nav.dataset.section); });
    buildNetwork();
    if (activeSection) renderPanel(activeSection);
  });
});

modalClose.addEventListener("click", closeProject);
modal.addEventListener("click", event => {
  if (event.target === modal) closeProject();
});

window.addEventListener("keydown", event => {
  keysDown.add(event.key);
  if (event.key === "Escape") {
    closeProject();
    if (exploreMode) {
      exploreMode = false;
      exploreHud.classList.remove("active");
      exploreHud.setAttribute("aria-hidden", "true");
    }
  }
});

window.addEventListener("keyup", event => {
  keysDown.delete(event.key);
});

window.addEventListener("resize", resize);

resize();
requestAnimationFrame(loop);
