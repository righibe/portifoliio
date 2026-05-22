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
const exploreExitBtn = document.getElementById("explore-exit");

const sections = window.PORTFOLIO.sections;
const projects = window.PORTFOLIO.projects;
const keys = ["skills", "leadership", "projects", "contact"];
const colors = ["#8FAEFF", "#D1D5DB", "#BFC7D5", "#8F1D2C"];

let width = 0;
let height = 0;
let dpr = 1;
let activeSection = null;
let currentLang = "en";
let hoverNode = null;
let time = 0;
let mouse = { x: -999, y: -999, tx: -999, ty: -999, down: false };
let camera = { x: 0, y: 0, tx: 0, ty: 0, scale: 1, targetScale: 1, cx: 0, cy: 0 };
let nodes = [];
let filaments = [];
let sparks = [];
let debris = [];

let debris = [];
let astronauts = [];
let exploreMode = false;
let score = 0;
let ship = { x: 0, y: 0, tx: 0, ty: 0, vx: 0, vy: 0, angle: 0, lastShot: 0 };
let bullets = [];
let keysDown = new Set();
const bootTime = performance.now();

const clusterLayout = {
  skills:     { x: 0.55, y: 0.22, r: 110 },
  leadership: { x: 0.75, y: 0.45, r: 105 },
  projects:   { x: 0.60, y: 0.80, r: 115 },
  contact:    { x: 0.45, y: 0.55, r: 95 },
  secret:     { x: 0.35, y: 0.25, r: 35 }
};

function getBezierPoint(t, p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y) {
  const cX = 3 * (p1x - p0x), bX = 3 * (p2x - p1x) - cX, aX = p3x - p0x - cX - bX;
  const cY = 3 * (p1y - p0y), bY = 3 * (p2y - p1y) - cY, aY = p3y - p0y - cY - bY;
  const x = (aX * Math.pow(t, 3)) + (bX * Math.pow(t, 2)) + (cX * t) + p0x;
  const y = (aY * Math.pow(t, 3)) + (bY * Math.pow(t, 2)) + (cY * t) + p0y;
  return { x, y };
}

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
    const count = 14;
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
      red: false
    });
  }

  astronauts = [];
  for (let i = 0; i < 3; i++) {
    astronauts.push({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.15,
      vy: (Math.random() - 0.5) * 0.15,
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.015,
      size: 0.5 + Math.random() * 0.4
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
    en: { skills: "Skills", leadership: "Leadership", projects: "Projects", contact: "Contact" },
    pt: { skills: "Skills", leadership: "Liderança", projects: "Projetos", contact: "Contato" }
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
    camera.tx = (width * 0.65 - core.baseX);
    camera.ty = (height * 0.5 - core.baseY);
    camera.targetScale = 2.2;
    camera.cx = core.baseX;
    camera.cy = core.baseY;
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
  camera.targetScale = 1;
  mouse.tx = -999;
  mouse.ty = -999;
  hoverNode = null;
}

// ─── Skill icons list ──────────────────────────────────────────────────────
const skillIconsList = [
  { name: "Python",        url: "https://cdn.jsdelivr.net/gh/devicons/devicon@v2.16.0/icons/python/python-original.svg" },
  { name: "Java",          url: "https://cdn.jsdelivr.net/gh/devicons/devicon@v2.16.0/icons/java/java-original.svg" },
  { name: "Spring Boot",   url: "https://cdn.jsdelivr.net/gh/devicons/devicon@v2.16.0/icons/spring/spring-original.svg" },
  { name: "AI, ML & LLMs", url: null, fa: "fa-solid fa-brain" },
  { name: "Databases",     url: "https://cdn.jsdelivr.net/gh/devicons/devicon@v2.16.0/icons/postgresql/postgresql-original.svg" },
  { name: "REST APIs",     url: "https://cdn.jsdelivr.net/gh/devicons/devicon@v2.16.0/icons/fastapi/fastapi-original.svg" },
  { name: "Docker",        url: "https://cdn.jsdelivr.net/gh/devicons/devicon@v2.16.0/icons/docker/docker-original.svg" },
  { name: "GitHub Actions",url: "https://cdn.jsdelivr.net/gh/devicons/devicon@v2.16.0/icons/github/github-original.svg" },
  { name: "Linux",         url: "https://cdn.jsdelivr.net/gh/devicons/devicon@v2.16.0/icons/linux/linux-original.svg" }
];

function renderPanel(key) {
  const data = sections[key];
  panelKicker.textContent = t(data.kicker);
  let html = `<h2 class="panel-title">${t(data.title)}</h2>`;
  html += `<p class="panel-text">${t(data.text)}</p>`;

  // ── Leadership: community card ───────────────────────────────────────────
  if (key === "leadership") {
    const membersLabel = currentLang === "pt" ? "membros" : "members";
    const communityDesc = currentLang === "pt"
      ? "Uma das maiores comunidades de programadores do Brasil no Discord — mais de 20 mil membros ativos."
      : "One of the largest programming communities in Brazil on Discord — over 20,000 active members.";
    const inviteLabel = currentLang === "pt" ? "Entrar na comunidade" : "Join the community";
    html += `
      <div class="community-card stagger-item" style="animation-delay: 100ms">
        <div class="community-img">
          <img src="community.png" alt="Programadores community">
        </div>
        <div class="community-info">
          <div class="community-badge">20k+ ${membersLabel}</div>
          <h3>Programadores</h3>
          <p>${communityDesc}</p>
          <a href="https://discord.gg/programadores" target="_blank" rel="noopener" class="community-invite">
            <i class="fa-brands fa-discord"></i> ${inviteLabel}
          </a>
        </div>
      </div>`;
  }

  if (data.groups) {
    const listClass = key === "leadership" ? "leadership-list" : "orbital-list";
    const baseDelay = key === "leadership" ? 160 : 100;
    html += `<div class="${listClass}">${data.groups.map(([title, desc], index) => {
      const titleText = t(title);
      
      let iconHtml = "";
      if (key === "skills") {
        const englishName = typeof title === 'object' ? title.en : title;
        const matchingIcon = skillIconsList.find(s => s.name === englishName);
        if (matchingIcon) {
          iconHtml = matchingIcon.url 
            ? `<div class="orbital-icon"><img src="${matchingIcon.url}" alt="${matchingIcon.name}" loading="lazy"></div>`
            : `<div class="orbital-icon fa-icon"><i class="${matchingIcon.fa}"></i></div>`;
        }
      } else if (key === "leadership") {
        if (titleText.toLowerCase().includes(currentLang === "pt" ? "arquitetura" : "architecture")) {
           iconHtml = `<div class="orbital-icon fa-icon"><i class="fa-solid fa-sitemap"></i></div>`;
        } else if (titleText.toLowerCase().includes(currentLang === "pt" ? "mentoria" : "mentorship")) {
           iconHtml = `<div class="orbital-icon fa-icon"><i class="fa-solid fa-users-rays"></i></div>`;
        } else if (titleText.toLowerCase().includes(currentLang === "pt" ? "parcerias" : "partnerships")) {
           iconHtml = `<div class="orbital-icon fa-icon"><i class="fa-solid fa-handshake"></i></div>`;
        }
      }

      const isPartnerships = key === "leadership" && titleText.toLowerCase().includes(currentLang === "pt" ? "parcerias" : "partnerships");
      const partners = isPartnerships && data.links
        ? `<div class="partner-cards">${data.links.map(([label, href, subtitle]) =>
            `<a class="partner-card-item" href="${href}" target="_blank" rel="noopener">
              <div class="partner-card-info"><strong>${label}</strong><span class="lang-badge" data-i18n="lang_pt"><small data-i18n="lang_pt_level"></small></span>
        <span class="lang-badge" data-i18n="lang_en"><small data-i18n="lang_en_level"></small></span>
        <span class="lang-badge" data-i18n="lang_es"><small data-i18n="lang_es_level"></small></span>${t(subtitle)}</span></div>
              <div class="partner-card-arrow"><i class="fa-solid fa-arrow-up-right-from-square"></i></div>
            </a>`
          ).join("")}</div>`
        : "";
      return `<div class="orbital-item stagger-item ${iconHtml ? 'has-icon' : ''}" style="animation-delay: ${baseDelay + index * 50}ms">${iconHtml}<div class="orbital-item-content"><strong>${titleText}</strong><span>${t(desc)}</span>${partners}</div></div>`;
    }).join("")}</div>`;
  }

  if (data.projects) {
    html += `<div class="project-flow">${data.projects.map((projectKey, index) => {
      const project = projects[projectKey];
      return `<button class="project-card stagger-item" style="animation-delay: ${100 + index * 50}ms" data-project="${projectKey}"><i class="${project.icon}"></i><strong>${project.title}</strong><span>${project.tech.join(" / ")}</span><p>${t(project.desc)}</p><small>${t(project.impact)}</small></button>`;
    }).join("")}</div>`;
  }

  if (data.links && key === "contact") {
    html += `<div class="contact-flow">${data.links.map(([label, value, href, icon], index) =>
      `<a class="contact-link stagger-item" style="animation-delay: ${100 + index * 50}ms" href="${href}" target="_blank" rel="noopener"><div class="contact-icon-wrapper"><i class="${icon}"></i></div><div class="contact-info"><span>${t(label)}:</span><strong>${value}</strong></div></a>`
    ).join("")}</div>`;
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
  bullets = [];
  debris = [];
  ship.angle = 0;
  ship.lastShot = 0;
  document.body.classList.add("content-open");
  exploreHud.classList.add("active");
  exploreHud.setAttribute("aria-hidden", "false");
  exploreScore.textContent = "0";
  if (exploreExitBtn) {
    exploreExitBtn.classList.add("active");
    exploreExitBtn.setAttribute("aria-hidden", "false");
  }
}

function updateNetwork(delta) {
  mouse.x += (mouse.tx - mouse.x) * 0.12;
  mouse.y += (mouse.ty - mouse.y) * 0.12;
  camera.x += (camera.tx - camera.x) * 0.045;
  camera.y += (camera.ty - camera.y) * 0.045;
  camera.scale += (camera.targetScale - camera.scale) * 0.045;

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

  astronauts.forEach(astro => {
    astro.x += astro.vx * delta;
    astro.y += astro.vy * delta;
    astro.angle += astro.spin * delta;
    if (astro.x < -100) astro.x = width + 100;
    if (astro.x > width + 100) astro.x = -100;
    if (astro.y < -100) astro.y = height + 100;
    if (astro.y > height + 100) astro.y = -100;
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

  ctx.save();
  if (camera.scale !== 1) {
    const pivotX = width * 0.65;
    const pivotY = height * 0.5;
    ctx.translate(pivotX, pivotY);
    ctx.scale(camera.scale, camera.scale);
    ctx.translate(-pivotX, -pivotY);
  }

  // Draw the Black Hole in the center background
  drawBlackHole(width * 0.85, height * 0.15, time);
  
  // Draw floating astronauts
  drawAstronauts();

  sparks.forEach(spark => {
    ctx.beginPath();
    const redSpark = "230, 236, 246";
    const px = camera.scale > 1 ? spark.x + (width/2 - spark.x) * (1 - 1/camera.scale) * 0.6 : spark.x;
    const py = camera.scale > 1 ? spark.y + (height/2 - spark.y) * (1 - 1/camera.scale) * 0.6 : spark.y;
    
    ctx.moveTo(px - spark.vx * 16, py - spark.vy * 16);
    ctx.lineTo(px, py);
    ctx.strokeStyle = `rgba(${redSpark}, ${spark.alpha * 0.8})`;
    ctx.lineWidth = spark.size / (camera.scale > 1 ? (camera.scale * 0.7) : 1);
    ctx.stroke();

    ctx.beginPath();
    ctx.fillStyle = `rgba(${redSpark}, ${spark.alpha * 1.2})`;
    ctx.arc(px, py, spark.size / (camera.scale > 1 ? (camera.scale * 0.7) : 1), 0, Math.PI * 2);
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
    
    const midX1 = line.a.x + (line.b.x - line.a.x) * 0.3 + Math.sin(time * 0.0015 + line.pulse) * 35;
    const midY1 = line.a.y + (line.b.y - line.a.y) * 0.3 + Math.cos(time * 0.001 + line.pulse) * 35;
    const midX2 = line.a.x + (line.b.x - line.a.x) * 0.7 - Math.cos(time * 0.0012 + line.pulse) * 35;
    const midY2 = line.a.y + (line.b.y - line.a.y) * 0.7 - Math.sin(time * 0.0018 + line.pulse) * 35;
    
    ctx.bezierCurveTo(midX1, midY1, midX2, midY2, line.b.x, line.b.y);
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
    ctx.strokeStyle = hexToRgba(node.color, active || hover ? 0.45 : 0.2);
    ctx.lineWidth = 1;
    ctx.arc(node.x, node.y, radius + 14 + Math.sin(time * 0.004 + node.baseX) * 3, 0, Math.PI * 2);
    ctx.stroke();

    if (node.core && (!node.secret || hover)) {
      ctx.beginPath();
      ctx.strokeStyle = hexToRgba(node.color, active || hover ? 0.3 : 0.15);
      ctx.arc(node.x, node.y, radius + 22 + Math.cos(time * 0.002 + node.baseY) * 5, 0, Math.PI * 2);
      ctx.stroke();

      ctx.font = "500 12px JetBrains Mono, monospace";
      ctx.fillStyle = active || hover || node.secret ? "rgba(245, 247, 251, 0.9)" : "rgba(226, 232, 240, 0.5)";
      ctx.fillText(node.label, node.x + 18, node.y - 14);
    }
  });

  ctx.restore();
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
  if (keysDown.has("a")) ax -= 0.42;
  if (keysDown.has("d")) ax += 0.42;
  if (keysDown.has("w")) ay -= 0.42;
  if (keysDown.has("s")) ay += 0.42;

  ship.vx += ax;
  ship.vy += ay;
  ship.vx *= 0.92;
  ship.vy *= 0.92;
  ship.x = Math.max(24, Math.min(width - 24, ship.x + ship.vx * delta));
  ship.y = Math.max(92, Math.min(height - 28, ship.y + ship.vy * delta));

  if (Math.abs(ship.vx) > 0.1 || Math.abs(ship.vy) > 0.1) {
    ship.angle = Math.atan2(ship.vy, ship.vx) + Math.PI / 2;
  }

  if (keysDown.has(" ")) {
    if (time - ship.lastShot > 180) {
      const speed = 16;
      bullets.push({
        x: ship.x + Math.cos(ship.angle - Math.PI / 2) * 16,
        y: ship.y + Math.sin(ship.angle - Math.PI / 2) * 16,
        vx: Math.cos(ship.angle - Math.PI / 2) * speed,
        vy: Math.sin(ship.angle - Math.PI / 2) * speed,
        hit: false
      });
      ship.lastShot = time;
    }
  }

  bullets.forEach(b => {
    b.x += b.vx * delta;
    b.y += b.vy * delta;
  });
  bullets = bullets.filter(b => b.x > -50 && b.x < width + 50 && b.y > -50 && b.y < height + 50 && !b.hit);

  if (Math.random() < 0.025 * delta) {
    asteroids.push({
      x: Math.random() * width,
      y: -40,
      r: 14,
      vx: (Math.random() - 0.5) * 1.5,
      vy: 1.0 + Math.random() * 1.5,
      hit: false
    });
  }

  // Update debris positions and fade out
  debris.forEach(d => {
    d.x += d.vx * delta;
    d.y += d.vy * delta;
    d.alpha -= d.fade * delta;
  });
  debris = debris.filter(d => d.alpha > 0);

  asteroids.forEach(enemy => {
    enemy.x += enemy.vx * delta;
    enemy.y += enemy.vy * delta;

    bullets.forEach(b => {
      if (!b.hit && !enemy.hit) {
        const dist = Math.hypot(b.x - enemy.x, b.y - enemy.y);
        if (dist < enemy.r + 6) {
          enemy.hit = true;
          b.hit = true;
          score += 20;
          exploreScore.textContent = String(score);
          for (let i = 0; i < 8; i++) {
            debris.push({
              x: enemy.x,
              y: enemy.y,
              vx: (Math.random() - 0.5) * 2,
              vy: (Math.random() - 0.5) * 2,
              size: 1 + Math.random() * 2,
              alpha: 0.8,
              fade: 0.01 + Math.random() * 0.02
            });
          }
        }
      }
    });

    const dist = Math.hypot(enemy.x - ship.x, enemy.y - ship.y);
    if (!enemy.hit && dist < enemy.r + 17) {
      enemy.hit = true;
      score -= 50;
      exploreScore.textContent = String(score);
      for (let i = 0; i < 6; i++) {
        debris.push({
          x: enemy.x,
          y: enemy.y,
          vx: (Math.random() - 0.5) * 1.4,
          vy: (Math.random() - 0.5) * 1.4,
          size: 1 + Math.random() * 2,
          alpha: 0.6,
          fade: 0.01 + Math.random() * 0.02
        });
      }
    }
  });
  asteroids = asteroids.filter(enemy => enemy.y < height + 60 && !enemy.hit);
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

  bullets.forEach(b => {
    ctx.beginPath();
    ctx.fillStyle = "#8FAEFF";
    ctx.shadowColor = "#8FAEFF";
    ctx.shadowBlur = 10;
    ctx.arc(b.x, b.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  });

  // Draw debris
  debris.forEach(d => {
    ctx.beginPath();
    ctx.fillStyle = `rgba(255, 255, 255, ${d.alpha})`;
    ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2);
    ctx.fill();
  });

  asteroids.forEach(enemy => {
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    let angle = Math.atan2(enemy.vy, enemy.vx) + Math.PI / 2;
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.fillStyle = "rgba(143, 29, 44, 0.9)";
    ctx.shadowColor = "rgba(143, 29, 44, 0.4)";
    ctx.shadowBlur = 12;
    ctx.moveTo(0, -12);
    ctx.lineTo(-10, 10);
    ctx.lineTo(0, 4);
    ctx.lineTo(10, 10);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    
    ctx.beginPath();
    ctx.fillStyle = "rgba(255, 180, 50, 0.9)";
    ctx.arc(0, -13, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  ctx.save();
  ctx.translate(ship.x, ship.y);
  ctx.rotate(ship.angle);
  ctx.beginPath();
  ctx.fillStyle = "rgba(245, 247, 251, 0.92)";
  ctx.shadowColor = "#8FAEFF";
  ctx.shadowBlur = 20;
  
  ctx.moveTo(0, -20);
  ctx.lineTo(-14, 14);
  ctx.lineTo(-6, 8);
  ctx.lineTo(0, 12);
  ctx.lineTo(6, 8);
  ctx.lineTo(14, 14);
  ctx.closePath();
  ctx.fill();
  
  ctx.beginPath();
  ctx.fillStyle = "rgba(30, 58, 138, 0.8)";
  ctx.moveTo(0, -10);
  ctx.lineTo(-4, 0);
  ctx.lineTo(4, 0);
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
  if (!target) {
    if (activeSection) closeSection();
    return;
  }
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

    const heroEyebrow = document.querySelector('[data-i18n="heroEyebrow"]');
    if (heroEyebrow) heroEyebrow.textContent = currentLang === "pt"
      ? "Engenharia de Software | Sistemas de IA | Comunidade"
      : "Software Engineer | AI Systems | Community Builder";

    const identityCopy = document.querySelector(".identity__copy");
    if (identityCopy) identityCopy.textContent = currentLang === "pt"
      ? "Desenvolvedor back-end trabalhando com Python, Java, automação e sistemas inteligentes."
      : "Back-end developer working with Python, Java, automation and intelligent systems.";

    const statYears = document.querySelector('[data-i18n="statYears"]');
    if (statYears) statYears.textContent = currentLang === "pt" ? "anos construindo" : "years building";
    const statProjects = document.querySelector('[data-i18n="statProjects"]');
    if (statProjects) statProjects.textContent = currentLang === "pt" ? "projetos realizados" : "projects realized";
    const statCommunity = document.querySelector('[data-i18n="statCommunity"]');
    if (statCommunity) statCommunity.textContent = currentLang === "pt" ? "comunidade dev no Brasil" : "Brazil dev community";

    const hint = document.querySelector('[data-i18n="hint"]');
    if (hint) hint.textContent = currentLang === "pt" ? "Clique em um cluster neural ou use a navegação" : "Click a neural cluster or use the top navigation";
    const backHome = document.querySelector('[data-i18n="backHome"]');
    if (backHome) backHome.textContent = currentLang === "pt" ? "Voltar para a rede" : "Back to neural map";
    const exploreExit = document.querySelector('[data-i18n="exploreExit"]');
    if (exploreExit) exploreExit.textContent = currentLang === "pt" ? "Parar / Sair" : "Stop / Exit";

    navItems.forEach(nav => { nav.textContent = labelFor(nav.dataset.section); });
    nodes.forEach(node => {
      if (node.core && node.key !== "secret") {
        node.label = labelFor(node.key);
      }
    });
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
      if (exploreExitBtn) {
        exploreExitBtn.classList.remove("active");
        exploreExitBtn.setAttribute("aria-hidden", "true");
      }
    }
  }
});

window.addEventListener("keyup", event => {
  keysDown.delete(event.key);
});

window.addEventListener("resize", resize);

resize();
requestAnimationFrame(loop);

// ─── Explore Mode Exit Button ────────────────────────────────────────────
if (exploreExitBtn) {
  exploreExitBtn.addEventListener("click", () => {
    exploreMode = false;
    exploreHud.classList.remove("active");
    exploreHud.setAttribute("aria-hidden", "true");
    exploreExitBtn.classList.remove("active");
    exploreExitBtn.setAttribute("aria-hidden", "true");
  });
}

// ─── Interstellar Elements ────────────────────────────────────────────────
function drawBlackHole(cx, cy, t) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-12 * Math.PI / 180);

  const radius = (width < 768 ? 55 : 90) * 0.6;
  
  const glow = ctx.createRadialGradient(0, 0, radius, 0, 0, radius * 4.5);
  glow.addColorStop(0, "rgba(255, 180, 80, 0.15)");
  glow.addColorStop(0.4, "rgba(150, 50, 10, 0.05)");
  glow.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, radius * 4.5, 0, Math.PI * 2);
  ctx.fill();

  const diskGrad = ctx.createRadialGradient(0, 0, radius * 0.9, 0, 0, radius * 3.8);
  diskGrad.addColorStop(0, "rgba(255, 255, 255, 1)");
  diskGrad.addColorStop(0.15, "rgba(255, 220, 120, 1)");
  diskGrad.addColorStop(0.35, "rgba(255, 120, 30, 0.8)");
  diskGrad.addColorStop(0.7, "rgba(80, 10, 0, 0.3)");
  diskGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
  
  ctx.beginPath();
  ctx.ellipse(0, 0, radius * 3.8, radius * 0.45, 0, Math.PI, Math.PI * 2);
  ctx.fillStyle = diskGrad;
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(0, -radius * 0.1, radius * 1.45, radius * 1.5, 0, Math.PI, Math.PI * 2);
  ctx.lineWidth = radius * 0.3;
  const topGrad = ctx.createLinearGradient(0, -radius * 1.7, 0, 0);
  topGrad.addColorStop(0, "rgba(255, 220, 150, 0.85)");
  topGrad.addColorStop(0.3, "rgba(255, 150, 40, 0.7)");
  topGrad.addColorStop(1, "rgba(200, 50, 0, 0)");
  ctx.strokeStyle = topGrad;
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(0, radius * 0.1, radius * 1.45, radius * 1.5, 0, 0, Math.PI);
  ctx.lineWidth = radius * 0.2;
  const botGrad = ctx.createLinearGradient(0, radius * 1.7, 0, 0);
  botGrad.addColorStop(0, "rgba(255, 150, 50, 0.5)");
  botGrad.addColorStop(0.3, "rgba(200, 70, 10, 0.3)");
  botGrad.addColorStop(1, "rgba(100, 20, 0, 0)");
  ctx.strokeStyle = botGrad;
  ctx.stroke();

  ctx.beginPath();
  ctx.fillStyle = "#000000";
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "rgba(255, 240, 200, 0.3)";
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(0, 0, radius * 3.8, radius * 0.45, 0, 0, Math.PI);
  ctx.fillStyle = diskGrad;
  ctx.shadowColor = "rgba(255, 200, 100, 0.5)";
  ctx.shadowBlur = 20;
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.beginPath();
  ctx.ellipse(0, 0, radius * 3.4, radius * 0.08, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
  ctx.shadowColor = "rgba(255, 255, 255, 1)";
  ctx.shadowBlur = 15;
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.restore();
}

const translations = {
  en: {
    lang_pt: "Portuguese",
    lang_pt_level: "Native",
    lang_en: "English",
    lang_en_level: "Fluent",
    lang_es: "Spanish",
    lang_es_level: "Intermediate"
  },
  pt: {
    lang_pt: "Português",
    lang_pt_level: "Nativo",
    lang_en: "Inglês",
    lang_en_level: "Fluente",
    lang_es: "Espanhol",
    lang_es_level: "Intermediário"
  }
};

function changeLanguage(lang) {
  const dict = translations[lang] || translations.en;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (dict[key]) {
      el.textContent = dict[key];
    }
  });
}

const langButtons = document.querySelectorAll('.lang-switch');
langButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const lang = btn.dataset.lang;
    changeLanguage(lang);
  });
});

function drawAstronauts() {
  astronauts.forEach(astro => {
    ctx.save();
    ctx.translate(astro.x, astro.y);
    ctx.scale(astro.size, astro.size);
    ctx.rotate(astro.angle);
    
    ctx.strokeStyle = "rgba(240, 245, 255, 0.5)";
    ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
    ctx.lineWidth = 1.5;
    
    ctx.beginPath();
    ctx.arc(0, -10, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    ctx.beginPath();
    ctx.fillStyle = "rgba(255, 180, 60, 0.4)";
    ctx.arc(2, -10, 3, -Math.PI/4, Math.PI/1.5);
    ctx.fill();
    
    ctx.beginPath();
    ctx.rect(-7, -4, 14, 16);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.rect(-10, -2, 3, 12);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(-7, 0); ctx.lineTo(-12, 4); ctx.lineTo(-10, 10);
    ctx.moveTo(7, 0); ctx.lineTo(12, 2); ctx.lineTo(14, -4);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(-4, 12); ctx.lineTo(-6, 20); ctx.lineTo(-4, 24);
    ctx.moveTo(4, 12); ctx.lineTo(5, 22); ctx.lineTo(8, 23);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.setLineDash([4, 4]);
    ctx.moveTo(0, 6);
    ctx.quadraticCurveTo(-20, 25, -40, 10);
    ctx.stroke();
    ctx.setLineDash([]);
    
    ctx.restore();
  });
}
