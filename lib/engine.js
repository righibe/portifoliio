"use strict";

import { PORTFOLIO } from "./data";

// Neural-map + spaceship-game engine, ported from the original vanilla build.
// Runs once per page load; all DOM queries happen inside init so the module is
// safe to import during SSR/build (nothing touches `document` at module scope).
export function initEngine() {
  if (typeof window === "undefined" || window.__neuralEngineInit) return;
  window.__neuralEngineInit = true;

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

const sections = PORTFOLIO.sections;
const projects = PORTFOLIO.projects;
const keys = ["skills", "leadership", "projects", "contact", "journey", "about"];
// Silver ink on black with one dark-blue signal — the accent marks only what is live
// (hovered / active cluster, the secret node, the game's shots).
const INK = "#E4E7EB";
const ACCENT = "#5B7FBF";
const BG = "#0B0B0C";
const NAV_ORDER = ["about", "journey", "skills", "leadership", "projects", "contact"];

// ─── 3D map (desktop) ────────────────────────────────────────────────────
// Fine-pointer landscape screens get the three.js scene (lib/neural3d.js),
// loaded on demand so touch devices never download it. Everything else keeps
// the light 2D canvas. ?no3d=1 forces the 2D map for testing.
const canvas3d = document.getElementById("neural-3d");
const clusterLabelsEl = document.getElementById("cluster-labels");
const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
const force2D = new URLSearchParams(window.location.search).get("no3d") === "1";
let scene3d = null;
let scene3dState = "idle"; // idle | loading | ready | failed

let width = 0;
let height = 0;
let dpr = 1;
// Touch devices (any orientation) and portrait screens get the ambient map
// only: no section clusters piling up behind the hero, just drifting sparks,
// and the top nav is the way into each section. Clusters are a desktop thing —
// in 3D, or in 2D as the no-WebGL fallback.
let ambientMap = false;
let activeSection = null;
let currentLang = "en";
let hoverNode = null;
let time = 0;
let mouse = { x: -999, y: -999, tx: -999, ty: -999, down: false };
let camera = { x: 0, y: 0, tx: 0, ty: 0, scale: 1, targetScale: 1, cx: 0, cy: 0 };
let asteroids = [];
let nodes = [];
let filaments = [];
let sparks = [];
let debris = [];
let bosses = [];
let nextBossScore = 100;

let astronauts = [];
let exploreMode = false;
let score = 0;
let ship = { x: 0, y: 0, tx: 0, ty: 0, vx: 0, vy: 0, angle: 0, lastShot: 0 };
let bullets = [];
let keysDown = new Set();
const bootTime = performance.now();
let touchMove = null;   // { id, startX, startY, currentX, currentY }
let touchFire  = false;

// ─── Adaptive Quality System ──────────────────────────────────────────────
// Quality tiers: 3 = high, 2 = medium, 1 = low
let quality = {
  tier: 3,
  sparkCount: 70,
  astronautCount: 3,
  nodeGlow: true      // whether to use shadowBlur on nodes
};

// FPS monitoring for auto-downgrade
let fpsHistory = [];
let lastFpsCheck = 0;
const FPS_CHECK_INTERVAL = 3000; // check every 3 seconds
const FPS_LOW_THRESHOLD = 30;    // below this, downgrade

function detectQuality() {
  const totalPixels = window.innerWidth * window.innerHeight * (window.devicePixelRatio || 1);
  const isHighRes = totalPixels > 4000000; // roughly > 2K
  const is4K = totalPixels > 7000000;      // roughly 4K+

  if (is4K) {
    quality.tier = 1;
  } else if (isHighRes) {
    quality.tier = 2;
  } else {
    quality.tier = 3;
  }
  applyQualityTier();
}

function applyQualityTier() {
  if (quality.tier === 1) {
    quality.sparkCount = 35;
    quality.astronautCount = 2;
    quality.nodeGlow = false;
  } else if (quality.tier === 2) {
    quality.sparkCount = 50;
    quality.astronautCount = 2;
    quality.nodeGlow = true;
  } else {
    quality.sparkCount = 48;
    quality.astronautCount = 2;
    quality.nodeGlow = true;
  }
}

function checkFpsAndDowngrade() {
  if (time - lastFpsCheck < FPS_CHECK_INTERVAL) return;
  lastFpsCheck = time;
  if (fpsHistory.length < 10) return;
  const avgFps = fpsHistory.reduce((a, b) => a + b, 0) / fpsHistory.length;
  fpsHistory = [];
  if (avgFps < FPS_LOW_THRESHOLD && quality.tier > 1) {
    quality.tier--;
    applyQualityTier();
    buildNetwork();         // rebuild with fewer particles
  }
}

const clusterLayout = {
  journey:    { x: 0.40, y: 0.20, r: 102 },
  skills:     { x: 0.60, y: 0.16, r: 108 },
  leadership: { x: 0.80, y: 0.46, r: 104 },
  projects:   { x: 0.62, y: 0.80, r: 112 },
  contact:    { x: 0.42, y: 0.72, r: 96 },
  about:      { x: 0.20, y: 0.44, r: 104 },
  secret:     { x: 0.88, y: 0.84, r: 34 }
};

function getBezierPoint(t, p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y) {
  const cX = 3 * (p1x - p0x), bX = 3 * (p2x - p1x) - cX, aX = p3x - p0x - cX - bX;
  const cY = 3 * (p1y - p0y), bY = 3 * (p2y - p1y) - cY, aY = p3y - p0y - cY - bY;
  const x = (aX * Math.pow(t, 3)) + (bX * Math.pow(t, 2)) + (cX * t) + p0x;
  const y = (aY * Math.pow(t, 3)) + (bY * Math.pow(t, 2)) + (cY * t) + p0y;
  return { x, y };
}

// ─── Fit-to-viewport layout engine ──────────────────────────────────────
// Measures the real rendered size of the hero and section panels and applies
// the exact scale needed so everything is fully visible at ANY resolution,
// with zero page scrolling. Replaces the old hard-coded breakpoint scales.
const topbarEl = document.querySelector(".topbar");
const identityEl = document.querySelector(".identity");
const experienceEl = document.getElementById("experience");
const hintEl = document.getElementById("hint");
const modalBoxEl = document.querySelector(".modal");
const rootStyle = document.documentElement.style;
const PANEL_MIN_SCALE = 0.42;
const MODAL_MIN_SCALE = 0.55;
let lastIdentityScale = 1;
let lastPanelScale = 1;
let panelScaleFloored = false;
let modalScaleFloored = false;

function identityScaleFor() {
  // offsetWidth/offsetHeight ignore transforms → true layout size
  const cs = getComputedStyle(experienceEl);
  const availH = experienceEl.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  const availW = experienceEl.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const naturalH = identityEl.offsetHeight;
  const naturalW = Math.max(identityEl.offsetWidth, identityEl.scrollWidth);
  if (naturalH <= 0 || naturalW <= 0 || availH <= 0 || availW <= 0) return 1;
  return Math.min(1, availH / naturalH, availW / naturalW);
}

function fitIdentity() {
  if (!topbarEl || !identityEl || !experienceEl) return;
  rootStyle.setProperty("--topbar-h", topbarEl.offsetHeight + "px");
  let hintSpace = 16;
  if (hintEl) {
    const hintBottom = parseFloat(getComputedStyle(hintEl).bottom) || 0;
    hintSpace = hintEl.offsetHeight + hintBottom + 10;
  }
  rootStyle.setProperty("--hint-space", Math.ceil(hintSpace) + "px");

  document.body.classList.remove("compact-identity");
  let scale = identityScaleFor();
  if (scale < 0.58) {
    // The terminal is decorative — drop it before the hero text gets too small
    document.body.classList.add("compact-identity");
    scale = identityScaleFor();
  }
  lastIdentityScale = Math.min(1, scale);
  rootStyle.setProperty("--identity-scale", lastIdentityScale.toFixed(4));
}

// Scales a content block down (with width compensation so the visual width
// stays 100%) until it fits inside availH. Returns the applied scale.
// Widening reflows the content shorter, so "fits at scale s" is monotonic in
// s — binary-search the largest scale that still fits.
function fitContentBox(el, availH, minScale) {
  el.style.transform = "";
  el.style.transformOrigin = "";
  el.style.width = "";
  el.style.height = "";
  // Small safety margin: collapsed child margins can leak past scrollHeight
  availH -= 5;
  if (availH <= 0) return 1;

  const fitsAt = scale => {
    el.style.width = scale < 0.999 ? (100 / scale).toFixed(4) + "%" : "";
    return el.scrollHeight * scale <= availH + 1;
  };

  if (fitsAt(1)) {
    el.style.width = "";
    return 1;
  }

  let lo = minScale;
  let hi = 1;
  let best = null;
  for (let i = 0; i < 7; i++) {
    const mid = (lo + hi) / 2;
    if (fitsAt(mid)) {
      best = mid;
      lo = mid;
    } else {
      hi = mid;
    }
  }
  const scale = best === null ? minScale : best;
  fitsAt(scale); // re-apply the chosen width
  const naturalH = el.scrollHeight;
  el.style.transformOrigin = "top left";
  el.style.transform = `scale(${scale.toFixed(4)})`;
  // Transforms don't shrink the layout box — clamp it so the scroll area
  // matches what is actually visible.
  el.style.height = Math.ceil(naturalH * scale) + "px";
  return scale;
}

function fitPanel() {
  if (!panel || !panelContent) return;
  panelScaleFloored = false;
  lastPanelScale = 1;
  // Reset any previous fit BEFORE measuring — the panel hugs its content, so
  // a stale scaled height would feed back into the available-height math.
  panelContent.style.transform = "";
  panelContent.style.transformOrigin = "";
  panelContent.style.width = "";
  panelContent.style.height = "";
  if (!activeSection) return;
  panel.scrollTop = 0;
  const cs = getComputedStyle(panel);
  const availH = panel.clientHeight - panelContent.offsetTop - parseFloat(cs.paddingBottom);
  lastPanelScale = fitContentBox(panelContent, availH, PANEL_MIN_SCALE);
  panelScaleFloored = lastPanelScale <= PANEL_MIN_SCALE && panelContent.scrollHeight > availH + 1;
}

function fitModal() {
  if (!modalBoxEl || !modalContent) return;
  modalScaleFloored = false;
  modalContent.style.transform = "";
  modalContent.style.width = "";
  modalContent.style.height = "";
  if (!modal.classList.contains("open")) return;
  modalBoxEl.scrollTop = 0;
  if (modalBoxEl.scrollHeight <= modalBoxEl.clientHeight + 1) return;
  const cs = getComputedStyle(modalBoxEl);
  const availH = modalBoxEl.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  const applied = fitContentBox(modalContent, availH, MODAL_MIN_SCALE);
  modalScaleFloored = applied <= MODAL_MIN_SCALE && modalContent.scrollHeight > availH + 1;
}

function refitLayout() {
  fitIdentity();
  fitPanel();
  fitModal();
}

function resize() {
  const rawDpr = window.devicePixelRatio || 1;
  // Cap DPR: 1.5 for 4K, 2 for others — saves huge pixel budgets
  dpr = Math.min(rawDpr, rawDpr > 2 ? 1 : 1.5);
  width = window.innerWidth;
  height = window.innerHeight;
  ambientMap = height > width || !finePointer;
  document.body.classList.toggle("ambient-map", ambientMap);
  updateHint();
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = width + "px";
  canvas.style.height = height + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  detectQuality();
  buildNetwork();
  ship.x = ship.tx = width * 0.5;
  ship.y = ship.ty = height * 0.58;
  refitLayout();
  sync3D();
}

function want3D() {
  return finePointer && !force2D && !ambientMap && width >= 900 && scene3dState !== "failed";
}

// True while the map belongs to three.js (also while it is still loading, so
// the 2D clusters never flash in first).
function use3DMap() {
  return want3D();
}

function clusterLabelMap() {
  const map = {};
  NAV_ORDER.forEach(key => {
    map[key] = { name: labelFor(key) };
  });
  return map;
}

// Free area for the constellation: right of the hero, below the topbar.
function heroSafeArea() {
  const heroRight = identityEl ? identityEl.getBoundingClientRect().right : 0;
  const topbarBottom = topbarEl ? topbarEl.getBoundingClientRect().bottom : 0;
  return { safeLeft: heroRight, safeTop: topbarBottom };
}

function load3D() {
  scene3dState = "loading";
  import("./neural3d")
    .then(({ createNeuralScene }) => {
      scene3d = createNeuralScene({
        canvas: canvas3d,
        labelsEl: clusterLabelsEl,
        labels: clusterLabelMap(),
        instant: document.documentElement.classList.contains("nofx"),
      });
      scene3dState = "ready";
      if (activeSection) scene3d.setActive(activeSection, panelRect());
      if (exploreMode) scene3d.setDim(true);
      sync3D();
    })
    .catch(error => {
      // No WebGL (or the chunk failed to load) — fall back to the 2D map
      console.warn("3D map unavailable, using the 2D canvas:", error);
      scene3d = null;
      scene3dState = "failed";
      sync3D();
    });
}

function sync3D() {
  if (!canvas3d) {
    scene3dState = "failed";
    return;
  }
  const want = want3D();
  if (want && scene3dState === "idle") load3D();
  document.body.classList.toggle("map-3d", want);
  if (scene3d) {
    scene3d.setVisible(want);
    if (want) {
      scene3d.resize(width, height, heroSafeArea());
      if (activeSection) scene3d.updateCard(panelRect());
    }
  }
}

function buildNetwork() {
  nodes = [];
  filaments = [];
  sparks = [];
  if (!ambientMap) keys.forEach(key => {
    const cluster = clusterLayout[key];
    const count = 10;
    const cx = cluster.x * width;
    const cy = cluster.y * height;

    nodes.push(makeNode({
      key,
      label: labelFor(key),
      x: cx,
      y: cy,
      size: key === activeSection ? 9 : 7,
      core: true,
      color: INK
    }));

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.34;
      const radius = cluster.r * (0.38 + Math.random() * 0.82);
      nodes.push(makeNode({
        key,
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
        size: 2.1 + Math.random() * 3.5,
        color: INK,
        orbit: angle,
        orbitSpeed: 0.00018 + Math.random() * 0.00028
      }));
    }
  });

  const secret = ambientMap ? ambientSecretSpot() : { x: clusterLayout.secret.x * width, y: clusterLayout.secret.y * height };
  nodes.push(makeNode({
    key: "secret",
    label: "Explore",
    x: secret.x,
    y: secret.y,
    size: 7,
    core: true,
    secret: true,
    color: ACCENT
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
          alpha: sameCluster ? 0.36 : 0.2,
          pulse: Math.random() * Math.PI * 2
        });
      }
    }
  });

  for (let i = 0; i < quality.sparkCount; i++) {
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
  for (let i = 0; i < quality.astronautCount; i++) {
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
    en: { skills: "Skills", leadership: "Leadership", projects: "Projects", contact: "Contact", journey: "Journey", about: "About" },
    pt: { skills: "Skills", leadership: "Liderança", projects: "Projetos", contact: "Contato", journey: "Trajetória", about: "Sobre" }
  };
  return labels[currentLang][key];
}

// On the ambient map the game's secret node sits in the one spot the hero never
// covers: the bottom-right corner, level with the hint pill.
function ambientSecretSpot() {
  const hintRect = hintEl && hintEl.getClientRects().length ? hintEl.getBoundingClientRect() : null;
  const y = hintRect ? hintRect.top + hintRect.height / 2 : height - 30;
  return { x: width - 30, y };
}

function updateHint() {
  const hint = document.querySelector('[data-i18n="hint"]');
  if (!hint) return;
  if (ambientMap) {
    hint.textContent = currentLang === "pt" ? "Toque numa seção acima" : "Tap a section above";
  } else {
    hint.textContent = currentLang === "pt" ? "Clique em um cluster neural ou use a navegação" : "Click a neural cluster or use the top navigation";
  }
}

function t(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value[currentLang] || value.en || "";
  return value || "";
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// opts.tour: opened by clicking the figure on the 3D map (camera orbits it first)
function setActiveSection(key, opts = {}) {
  if (!sections[key]) return;
  const switching = panel.classList.contains("active");
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
    core.size = 9;
  }
  clearPanelTimers();
  const in3D = scene3d && use3DMap();

  if (in3D && !switching) {
    // 3D: the camera flies up to the region, which dissolves into particles
    // that build the card piece by piece. Lay the card out first (still
    // invisible) so the particles know exactly where every piece will be.
    panel.classList.remove("is-leaving", "is-entering", "is-settled", "active");
    panel.classList.add("is-built"); // see-through surface while it is being built
    panel.scrollTop = 0;
    renderPanel(key);
    const { lastStart, pieces } = sequencePanelContent();
    const skeleton = pieces.map(piece => ({ kind: piece.kind, d: piece.d / 1000, rects: pieceRects(piece.el, piece.kind) }));
    const plan = scene3d.setActive(key, panelRect(), { tour: !!opts.tour, skeleton });
    if (!plan) return; // this section's card is already up
    laterPanel(plan.enterAt * 1000, () => revealBuiltPanel(lastStart));
    return;
  }

  // 2D / touch (or switching while a card is open): the card comes in at once
  const plan = in3D ? scene3d.setActive(key, panelRect(), { tour: !!opts.tour }) : { enterAt: 0.04 };
  if (!plan) return; // this section's card is already up
  const enterAt = plan.enterAt;
  if (switching) {
    // already inside a card: just open the next one in its place
    enterPanel(key);
  } else {
    laterPanel(enterAt * 1000, () => enterPanel(key));
  }
}

// ─── Section card entrance / exit ────────────────────────────────────────
// The card rises in with a slight 3D tilt, then its content arrives one piece
// at a time: back button, kicker, the title word by word, the intro, then each
// item as its own little card. Leaving, the card drops away before the next.
const CARD_LEAVE = 0.28; // s
const panelMeta = document.querySelector(".section-panel__meta");
let panelTimers = [];

function laterPanel(ms, fn) {
  panelTimers.push(window.setTimeout(fn, ms));
}

function clearPanelTimers() {
  panelTimers.forEach(id => window.clearTimeout(id));
  panelTimers = [];
}

// Stagger every piece of the card's content (delays in ms, via --d).
// Returns when the last piece starts and the pieces in order (for the 3D
// build, whose particles land on each piece as it appears).
function sequencePanelContent() {
  let at = 90; // the card itself leads
  const pieces = [];
  const place = (el, gap, kind) => {
    if (!el) return;
    el.style.setProperty("--d", `${at}ms`);
    pieces.push({ el, d: at, kind });
    at += gap;
  };
  place(panelClose, 40, "box");
  place(panelMeta, 50, "text");
  panelContent.querySelectorAll(".panel-title .w").forEach(word => place(word, 28, "text"));
  at += 20;
  place(panelContent.querySelector(".panel-text"), 70, "text");
  panelContent.querySelectorAll(".stagger-item").forEach(item => place(item, 55, "box"));
  return { lastStart: at, pieces };
}

// Where a piece sits on screen: one box per text line, or the element's box
function pieceRects(el, kind) {
  const toRect = r => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });
  if (kind === "text") {
    const range = document.createRange();
    range.selectNodeContents(el);
    const lines = [...range.getClientRects()].filter(r => r.width > 4 && r.height > 4);
    if (lines.length) return lines.map(toRect);
  }
  return [toRect(el.getBoundingClientRect())];
}

// 3D build: the (already laid-out) card appears over the particles, its
// pieces fading in as the particles land; the solid surface comes last.
function revealBuiltPanel(lastStart) {
  panel.classList.remove("is-leaving", "is-entering", "is-settled");
  void panel.offsetWidth; // restart the entrance animations
  panel.classList.add("active", "is-entering");
  laterPanel(lastStart + 560, () => {
    panel.classList.remove("is-entering", "is-built");
    panel.classList.add("is-settled");
  });
}

function enterPanel(key) {
  panel.scrollTop = 0;
  renderPanel(key);
  const { lastStart } = sequencePanelContent();
  panel.classList.remove("is-leaving", "is-entering", "is-settled", "is-built");
  void panel.offsetWidth; // restart the entrance animations
  panel.classList.add("active", "is-entering");
  // Once everything has landed, drop the animations entirely: a held
  // transform / filter keeps text on a GPU layer, which loses ClearType and
  // looks soft. Settled = plain, crisp text.
  laterPanel(lastStart + 560, () => {
    panel.classList.remove("is-entering");
    panel.classList.add("is-settled");
  });
}

function leavePanel() {
  if (!panel.classList.contains("active")) return;
  panel.classList.remove("is-entering", "is-settled", "is-built");
  panel.classList.add("is-leaving");
  laterPanel(CARD_LEAVE * 1000, () => panel.classList.remove("active", "is-leaving"));
}

// Where the section card sits (position: fixed, so its box is known even
// while hidden; offsets ignore the entrance transform)
function panelRect() {
  return {
    left: panel.offsetLeft,
    top: panel.offsetTop,
    right: panel.offsetLeft + panel.offsetWidth,
    bottom: panel.offsetTop + panel.offsetHeight,
  };
}

function closeSection() {
  clearPanelTimers();
  const in3D = scene3d && use3DMap();
  // 3D: under the leaving card, a particle mosaic breaks up and is pulled
  // back into its region while the camera pulls out of it
  if (in3D) scene3d.setActive(null, panelRect());
  leavePanel();
  activeSection = null;
  // the hero comes back once the card has fallen apart, not on top of it
  if (in3D) laterPanel(700, () => { if (!activeSection) document.body.classList.remove("content-open"); });
  else document.body.classList.remove("content-open");
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
  const titleWords = t(data.title).split(" ").map(word => `<span class="w"><span>${word}</span></span>`).join(" ");
  let html = `<h2 class="panel-title">${titleWords}</h2>`;
  html += `<p class="panel-text">${t(data.text)}</p>`;

  // ── Journey: spaceship timeline ────────────────────────────────────────────
  if (data.timeline) {
    const trip = (data.timeline.length - 1) * 0.9 + 1.8; // ship travel duration
    html += `
      <div class="timeline" style="--tl-trip:${trip}s">
        <div class="timeline__rail">
          <span class="timeline__progress"></span>
          <span class="timeline__ship"><i class="fa-solid fa-rocket"></i><span class="timeline__flame"></span></span>
        </div>
        <div class="timeline__events">
          ${data.timeline.map((ev, i) => `
            <div class="tl-event stagger-item" style="animation-delay:${260 + i * 220}ms">
              <div class="tl-node"><i class="${ev.icon}"></i><span class="tl-node__ring"></span></div>
              <div class="tl-card">
                <span class="tl-date">${t(ev.date)}</span>
                <strong>${t(ev.title)}</strong>
                <p>${t(ev.desc)}</p>
              </div>
            </div>`).join("")}
        </div>
      </div>`;
  }

  // ── About: pinned-notes / scrapbook board ────────────────────────────────
  if (key === "about" && data.cards) {
    // 4-point ninja star (hira-shuriken) — the "this is Naruto" tell. The inner
    // subpath + evenodd punches a transparent hole through the center.
    const shuriken = `
      <span class="quote-shuriken" aria-hidden="true">
        <svg viewBox="0 0 100 100">
          <path fill-rule="evenodd" d="M50 4 C56 30 70 44 96 50 C70 56 56 70 50 96 C44 70 30 56 4 50 C30 44 44 30 50 4Z M50 41 a9 9 0 1 0 0.01 0Z"/>
        </svg>
      </span>`;

    html += `<div class="note-board">${data.cards.map((card, index) => {
      const pin = card.pin ? `<span class="note-pin">${t(card.pin)}</span>` : "";
      const delay = `animation-delay: ${140 + index * 70}ms`;

      if (card.type === "quote") {
        // On hover a cut-out image (card.holder, set in data.js) rises from
        // behind the card, as if holding it. No holder = plain card.
        const holder = card.holder
          ? `<img class="quote-holder" src="${card.holder}" alt="" aria-hidden="true" onerror="this.remove()">`
          : "";
        return `
          <div class="quote-wrap stagger-item" style="${delay}">
            ${holder}
            <figure class="note note--quote">
              ${pin}
              ${shuriken}
              <blockquote>${t(card.quote)}</blockquote>
              <figcaption>${card.author}<span class="quote-src">${card.source}</span></figcaption>
            </figure>
          </div>`;
      }

      const link = card.link
        ? `<a class="note-link" href="${card.link.href}" target="_blank" rel="noopener">${t(card.link.label)} <i class="fa-solid fa-arrow-up-right"></i></a>`
        : "";
      return `
        <div class="note note--${card.type} stagger-item" style="${delay}">
          ${pin}
          <strong>${t(card.title)}</strong>
          <p>${t(card.desc)} ${link}</p>
        </div>`;
    }).join("")}</div>`;
  }

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
          <img src="community.png" alt="Servidor dos Programadores community">
        </div>
        <div class="community-info">
          <div class="community-badge">20k+ ${membersLabel}</div>
          <h3>Servidor dos Programadores</h3>
          <p>${communityDesc}</p>
          <a href="https://discord.gg/programador" target="_blank" rel="noopener" class="community-invite">
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
            ? `<span class="row-ico"><img src="${matchingIcon.url}" alt="${matchingIcon.name}" loading="lazy"></span>`
            : `<span class="row-ico fa"><i class="${matchingIcon.fa}"></i></span>`;
        }
      } else if (key === "leadership") {
        if (titleText.toLowerCase().includes(currentLang === "pt" ? "arquitetura" : "architecture")) {
           iconHtml = `<span class="row-ico fa"><i class="fa-solid fa-sitemap"></i></span>`;
        } else if (titleText.toLowerCase().includes(currentLang === "pt" ? "mentoria" : "mentorship")) {
           iconHtml = `<span class="row-ico fa"><i class="fa-solid fa-users-rays"></i></span>`;
        } else if (titleText.toLowerCase().includes(currentLang === "pt" ? "parcerias" : "partnerships")) {
           iconHtml = `<span class="row-ico fa"><i class="fa-solid fa-handshake"></i></span>`;
        }
      }

      const isPartnerships = key === "leadership" && titleText.toLowerCase().includes(currentLang === "pt" ? "parcerias" : "partnerships");
      const partners = isPartnerships && data.links
        ? `<div class="partner-row">${data.links.map(([label, href, subtitle]) =>
            `<a class="partner" href="${href}" target="_blank" rel="noopener"><span class="partner-name">${label}</span><span class="partner-sub">${t(subtitle)}</span><i class="fa-solid fa-arrow-up-right"></i></a>`
          ).join("")}</div>`
        : "";

      const idx = String(index + 1).padStart(2, "0");
      return `<div class="orbital-item stagger-item" style="animation-delay: ${baseDelay + index * 50}ms"><span class="row-idx">${idx}</span>${iconHtml}<div class="orbital-item-content"><strong>${titleText}</strong><span>${t(desc)}</span>${partners}</div></div>`;
    }).join("")}</div>`;
  }

  if (data.projects) {
    const viewLabel = currentLang === "pt" ? "Ver detalhes" : "View details";
    html += `<div class="project-flow">${data.projects.map((projectKey, index) => {
      const project = projects[projectKey];
      const idx = String(index + 1).padStart(2, "0");
      const tags = project.tech.map(x => `<span>${x}</span>`).join("");
      const badge = project.featured ? `<span class="work-badge">${currentLang === "pt" ? "no ar" : "live"}</span>` : "";
      return `<button class="project-card stagger-item${project.featured ? " is-featured" : ""}" style="animation-delay: ${100 + index * 50}ms" data-project="${projectKey}"><span class="work-idx">${idx}</span><i class="work-ico ${project.icon}"></i><strong>${t(project.title)}${badge}</strong><p class="work-tagline">${t(project.tagline || project.desc)}</p><div class="work-tags">${tags}</div><span class="work-more">${viewLabel} <i class="fa-solid fa-arrow-right"></i></span></button>`;
    }).join("")}</div>`;
  }

  // ── Contact: profile card ─────────────────────────────────────────────────
  if (key === "contact") {
    const availableLabel = currentLang === "pt" ? "Disponível para projetos" : "Available for projects";
    const roleLine = currentLang === "pt"
      ? "Desenvolvedor back-end · Automação & IA"
      : "Back-end developer · Automation & AI";
    html += `
      <div class="contact-card stagger-item" style="animation-delay: 80ms">
        <div class="contact-card__photo">
          <img src="avatar.png" alt="Bernardo Righi">
        </div>
        <div class="contact-card__info">
          <div class="contact-card__badge">${availableLabel}</div>
          <h3>Bernardo Righi</h3>
          <p>${roleLine}</p>
        </div>
      </div>`;
  }

  if (data.links && key === "contact") {
    html += `<div class="contact-flow">${data.links.map(([label, value, href, icon], index) =>
      `<a class="contact-link stagger-item" style="animation-delay: ${100 + index * 50}ms" href="${href}" target="_blank" rel="noopener"><span class="contact-icon-wrapper"><i class="${icon}"></i></span><span class="contact-info"><span>${t(label)}</span><strong>${value}</strong></span><i class="contact-arrow fa-solid fa-arrow-up-right"></i></a>`
    ).join("")}</div>`;
  }

  panelContent.innerHTML = html;
  panelContent.querySelectorAll("[data-project]").forEach(button => {
    button.addEventListener("click", () => openProject(button.dataset.project));
  });
  fitPanel();
}

function openProject(key) {
  const project = projects[key];
  if (!project) return;
  modalContent.innerHTML = `
    <div class="modal-heading">
      <i class="${project.icon}"></i>
      <h2 id="modal-title">${t(project.title)}</h2>
    </div>
    <p>${t(project.desc)}</p>
    <div class="modal-impact"><strong>${currentLang === "pt" ? "Impacto" : "Impact"}:</strong> ${t(project.impact)}</div>
    <div class="modal-tech">${project.tech.map(item => `<span>${item}</span>`).join("")}</div>
    ${project.live ? `<a class="modal-link" href="${project.live}" target="_blank" rel="noopener"><i class="fa-solid fa-arrow-up-right-from-square"></i> ${currentLang === "pt" ? "Abrir o app" : "Open the app"}</a>` : ""}
    <a class="modal-link${project.live ? " modal-link--secondary" : ""}" href="${project.link}" target="_blank" rel="noopener"><i class="fa-brands fa-github"></i> ${currentLang === "pt" ? "Ver no GitHub" : "View on GitHub"}</a>
  `;
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  fitModal();
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
  bosses = [];
  nextBossScore = 100;
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
  if (scene3d) scene3d.setDim(true);
}

function exitExploreMode() {
  if (!exploreMode) return;
  exploreMode = false;
  exploreHud.classList.remove("active");
  exploreHud.setAttribute("aria-hidden", "true");
  if (exploreExitBtn) {
    exploreExitBtn.classList.remove("active");
    exploreExitBtn.setAttribute("aria-hidden", "true");
  }
  if (!activeSection) document.body.classList.remove("content-open");
  if (scene3d) scene3d.setDim(false);
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
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  if (camera.scale !== 1) {
    const pivotX = width * 0.65;
    const pivotY = height * 0.5;
    ctx.translate(pivotX, pivotY);
    ctx.scale(camera.scale, camera.scale);
    ctx.translate(-pivotX, -pivotY);
  }

  // Draw floating astronauts
  drawAstronauts();

  sparks.forEach(spark => {
    ctx.beginPath();
    const redSpark = "228, 231, 235";
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
    const alpha = (line.alpha + (active ? 0.2 : 0) + (nearMouse ? 0.24 : 0) + (secretLine ? 0.3 : 0) + pulse * 0.06) * intro;
    const stroke = active ? "91, 127, 191" : nearMouse ? "228, 231, 235" : "150, 150, 144";

    ctx.beginPath();
    ctx.lineWidth = active ? 1.25 : 0.9;
    ctx.strokeStyle = `rgba(${stroke}, ${Math.min(alpha, 0.9)})`;
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
    // A hovered/active cluster lights up as a whole in the signal color
    const lit = active || (hoverNode && !node.secret && hoverNode.key === node.key);
    const color = lit ? ACCENT : node.color;
    const radius = (node.size + (active ? 2 : 0) + (hover ? 5 : 0) + (node.secret ? Math.sin(time * 0.006) * 1.8 : 0)) * (0.38 + intro * 0.62);

    ctx.beginPath();
    ctx.fillStyle = color;
    // Glow (shadowBlur) is the pricey part — only for what is live: the lit
    // cluster's core and the secret node.
    if (quality.nodeGlow && node.core && (lit || node.secret)) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 14;
    }
    ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.beginPath();
    ctx.strokeStyle = hexToRgba(color, active || hover ? 0.5 : 0.22);
    ctx.lineWidth = 1;
    ctx.arc(node.x, node.y, radius + 14 + Math.sin(time * 0.004 + node.baseX) * 3, 0, Math.PI * 2);
    ctx.stroke();

    if (node.core && (!node.secret || hover)) {
      ctx.beginPath();
      ctx.strokeStyle = hexToRgba(color, active || hover ? 0.3 : 0.12);
      ctx.arc(node.x, node.y, radius + 22 + Math.cos(time * 0.002 + node.baseY) * 5, 0, Math.PI * 2);
      ctx.stroke();

      ctx.font = "500 12px JetBrains Mono, monospace";
      ctx.fillStyle = lit || hover || node.secret ? "rgba(228, 231, 235, 0.92)" : "rgba(228, 231, 235, 0.5)";
      // Flip the label to the left when it would run off the right edge
      const labelW = ctx.measureText(node.label).width;
      const labelX = node.x + 18 + labelW > width - 4 ? node.x - 18 - labelW : node.x + 18;
      ctx.fillText(node.label, labelX, node.y - 14);
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
  if (keysDown.has("a") || keysDown.has("ArrowLeft"))  ax -= 0.42;
  if (keysDown.has("d") || keysDown.has("ArrowRight")) ax += 0.42;
  if (keysDown.has("w") || keysDown.has("ArrowUp"))    ay -= 0.42;
  if (keysDown.has("s") || keysDown.has("ArrowDown"))  ay += 0.42;

  // Touch joystick
  if (touchMove) {
    const tdx = touchMove.currentX - touchMove.startX;
    const tdy = touchMove.currentY - touchMove.startY;
    const tlen = Math.hypot(tdx, tdy);
    if (tlen > 10) { ax += (tdx / tlen) * 0.42; ay += (tdy / tlen) * 0.42; }
  }

  ship.vx += ax;
  ship.vy += ay;
  ship.vx *= 0.92;
  ship.vy *= 0.92;
  ship.x = Math.max(24, Math.min(width - 24, ship.x + ship.vx * delta));
  ship.y = Math.max(92, Math.min(height - 28, ship.y + ship.vy * delta));

  // Rotate ship smoothly
  if (Math.abs(ship.vx) > 0.1 || Math.abs(ship.vy) > 0.1) {
    ship.angle = Math.atan2(ship.vy, ship.vx) + Math.PI / 2;
  }

  // Make astronauts drift more naturally using slight random acceleration
  astronauts.forEach(a => {
    a.vx += (Math.random() - 0.5) * 0.02;
    a.vy += (Math.random() - 0.5) * 0.02;
    a.vx *= 0.995;
    a.vy *= 0.995;
    a.spin += (Math.random() - 0.5) * 0.001;
  });

  if (keysDown.has(" ") || keysDown.has("Enter") || touchFire) {
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

  // Difficulty scaling — increases every 60 pts
  const diffMult = 1 + Math.floor(Math.max(0, score) / 60) * 0.14;

  if (Math.random() < Math.min(0.065, 0.020 * diffMult) * delta) {
    // At higher scores asteroids come from all sides
    const side = score > 150 ? Math.floor(Math.random() * 4) : 0;
    let ax2, ay2, avx, avy;
    const spd = (0.8 + Math.random() * 1.4) * Math.min(diffMult, 3.0);
    if (side === 0) {
      ax2 = Math.random() * width; ay2 = -40;
      avx = (Math.random() - 0.5) * 1.5; avy = spd;
    } else if (side === 1) {
      ax2 = width + 40; ay2 = Math.random() * height;
      avx = -spd; avy = (Math.random() - 0.5) * 1.5;
    } else if (side === 2) {
      ax2 = Math.random() * width; ay2 = height + 40;
      avx = (Math.random() - 0.5) * 1.5; avy = -spd;
    } else {
      ax2 = -40; ay2 = Math.random() * height;
      avx = spd; avy = (Math.random() - 0.5) * 1.5;
    }
    asteroids.push({ x: ax2, y: ay2, r: 11 + Math.random() * 5, vx: avx, vy: avy, hit: false });
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
  asteroids = asteroids.filter(e => !e.hit && e.x > -100 && e.x < width + 100 && e.y > -100 && e.y < height + 100);

  // ── Boss spawning every 100 points ───────────────────────────────────
  if (score >= nextBossScore && bosses.length === 0) {
    const tier = Math.floor((nextBossScore - 100) / 100);
    nextBossScore += 100;
    const side = Math.floor(Math.random() * 4);
    let bx, by;
    if (side === 0) { bx = Math.random() * width; by = -80; }
    else if (side === 1) { bx = width + 80; by = Math.random() * height; }
    else if (side === 2) { bx = Math.random() * width; by = height + 80; }
    else { bx = -80; by = Math.random() * height; }
    const bossHp = 5 + tier * 3;
    bosses.push({
      x: bx, y: by,
      r: 28 + tier * 5,
      hp: bossHp, maxHp: bossHp,
      vx: 0, vy: 0,
      angle: 0, spin: 0.009 + tier * 0.003,
      hit: false, pulse: 0,
      tier
    });
  }

  // ── Boss update ───────────────────────────────────────────────────────
  bosses.forEach(boss => {
    const dx = ship.x - boss.x;
    const dy = ship.y - boss.y;
    const dist = Math.hypot(dx, dy) || 1;
    const bossDiff = 1 + boss.tier * 0.18;
    boss.vx += (dx / dist) * 0.10 * bossDiff;
    boss.vy += (dy / dist) * 0.10 * bossDiff;
    const maxSpd = 2.2 + boss.tier * 0.4;
    const spd = Math.hypot(boss.vx, boss.vy);
    if (spd > maxSpd) { boss.vx *= maxSpd / spd; boss.vy *= maxSpd / spd; }
    boss.x += boss.vx * delta;
    boss.y += boss.vy * delta;
    boss.angle += boss.spin * delta;
    boss.pulse += 0.045 * delta;

    bullets.forEach(b => {
      if (!b.hit && !boss.hit) {
        if (Math.hypot(b.x - boss.x, b.y - boss.y) < boss.r + 6) {
          b.hit = true;
          boss.hp--;
          for (let i = 0; i < 5; i++) {
            debris.push({ x: b.x, y: b.y, vx: (Math.random()-0.5)*2.2, vy: (Math.random()-0.5)*2.2,
              size: 1.5 + Math.random()*2, alpha: 0.75, fade: 0.02 + Math.random()*0.02 });
          }
          if (boss.hp <= 0) {
            boss.hit = true;
            score += 100;
            exploreScore.textContent = String(score);
            for (let i = 0; i < 22; i++) {
              debris.push({ x: boss.x + (Math.random()-0.5)*boss.r, y: boss.y + (Math.random()-0.5)*boss.r,
                vx: (Math.random()-0.5)*4, vy: (Math.random()-0.5)*4,
                size: 2 + Math.random()*4, alpha: 0.95, fade: 0.005 + Math.random()*0.012 });
            }
          }
        }
      }
    });

    if (!boss.hit && Math.hypot(boss.x - ship.x, boss.y - ship.y) < boss.r + 17) {
      boss.hit = true;
      score -= 100;
      exploreScore.textContent = String(score);
      for (let i = 0; i < 14; i++) {
        debris.push({ x: boss.x, y: boss.y, vx: (Math.random()-0.5)*3, vy: (Math.random()-0.5)*3,
          size: 2 + Math.random()*3, alpha: 0.85, fade: 0.007 + Math.random()*0.014 });
      }
    }
  });
  bosses = bosses.filter(b => !b.hit && b.x > -250 && b.x < width+250 && b.y > -250 && b.y < height+250);
}

function drawExplore() {
  if (!exploreMode) return;

  nodes.filter(node => node.key === "secret" || node.key === activeSection).forEach((node, index) => {
    const angle = time * 0.003 + index;
    const orbit = 34 + (index % 5) * 9;
    ctx.beginPath();
    ctx.fillStyle = "rgba(228, 231, 235, 0.64)";
    ctx.arc(ship.x + Math.cos(angle) * orbit, ship.y + Math.sin(angle) * orbit, 2.2, 0, Math.PI * 2);
    ctx.fill();
  });

  bullets.forEach(b => {
    ctx.beginPath();
    ctx.fillStyle = ACCENT;
    ctx.shadowColor = ACCENT;
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
    ctx.fillStyle = "rgba(150, 150, 144, 0.9)";
    ctx.moveTo(0, -12);
    ctx.lineTo(-10, 10);
    ctx.lineTo(0, 4);
    ctx.lineTo(10, 10);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    
    ctx.beginPath();
    ctx.fillStyle = ACCENT;
    ctx.arc(0, -13, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  // ── Draw bosses ───────────────────────────────────────────────────────
  bosses.forEach(boss => {
    const pulse = Math.sin(boss.pulse) * 0.14 + 1;
    const hpFrac = boss.hp / boss.maxHp;
    // Grey ink that charges up to the signal color as the boss takes damage
    const bR = hpFrac > 0.6 ? "150,150,144" : hpFrac > 0.3 ? "170,186,214" : "91,127,191";

    ctx.save();
    ctx.translate(boss.x, boss.y);
    ctx.rotate(boss.angle);

    // Outer glow
    ctx.beginPath();
    ctx.arc(0, 0, boss.r * 1.7 * pulse, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${bR}, 0.07)`;
    ctx.fill();

    // Spiky body
    const spikes = 8 + boss.tier * 2;
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const ang = (i / (spikes * 2)) * Math.PI * 2;
      const r = i % 2 === 0 ? boss.r * pulse : boss.r * 0.55 * pulse;
      if (i === 0) ctx.moveTo(Math.cos(ang) * r, Math.sin(ang) * r);
      else ctx.lineTo(Math.cos(ang) * r, Math.sin(ang) * r);
    }
    ctx.closePath();
    ctx.fillStyle = `rgba(${bR}, 0.90)`;
    ctx.shadowColor = `rgba(${bR}, 0.65)`;
    ctx.shadowBlur = 20;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Inner core
    ctx.beginPath();
    ctx.arc(0, 0, boss.r * 0.40 * pulse, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(11, 11, 12, 0.92)";
    ctx.fill();

    ctx.restore();

    // Health bar above boss
    const barW = boss.r * 2.8;
    const barH = 5;
    const barX = boss.x - barW / 2;
    const barY = boss.y - boss.r * 1.9;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.beginPath(); ctx.roundRect(barX, barY, barW, barH, 3); ctx.fill();
    ctx.fillStyle = hpFrac > 0.3 ? INK : ACCENT;
    ctx.beginPath(); ctx.roundRect(barX, barY, barW * hpFrac, barH, 3); ctx.fill();

    // BOSS label
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "bold 9px JetBrains Mono, monospace";
    ctx.textAlign = "center";
    ctx.fillText(`BOSS ${boss.tier > 0 ? "★".repeat(Math.min(boss.tier,4)) : ""}`, boss.x, barY - 4);
    ctx.textAlign = "left";
  });

  ctx.save();
  ctx.translate(ship.x, ship.y);
  ctx.rotate(ship.angle);
  ctx.beginPath();
  ctx.fillStyle = "rgba(228, 231, 235, 0.95)";
  ctx.shadowColor = ACCENT;
  ctx.shadowBlur = 14;
  
  ctx.moveTo(0, -20);
  ctx.lineTo(-14, 14);
  ctx.lineTo(-6, 8);
  ctx.lineTo(0, 12);
  ctx.lineTo(6, 8);
  ctx.lineTo(14, 14);
  ctx.closePath();
  ctx.fill();
  
  ctx.beginPath();
  ctx.fillStyle = ACCENT;
  ctx.moveTo(0, -10);
  ctx.lineTo(-4, 0);
  ctx.lineTo(4, 0);
  ctx.closePath();
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.restore();
}

function loop(now) {
  const rawDelta = now - time;
  const delta = Math.min(2, rawDelta / 16.67 || 1);

  // Track FPS for auto-downgrade
  if (rawDelta > 0) fpsHistory.push(1000 / rawDelta);
  if (fpsHistory.length > 60) fpsHistory.shift();
  checkFpsAndDowngrade();

  time = now;
  if (use3DMap()) {
    // three.js draws the map; the 2D canvas is a transparent layer that only
    // carries the spaceship game on top of it.
    updateHover3D();
    updateExplore(delta);
    if (canvasDirty) ctx.clearRect(0, 0, width, height);
    canvasDirty = exploreMode;
    drawExplore();
    if (scene3d) scene3d.frame(now);
  } else {
    updateNetwork(delta);
    updateExplore(delta);
    drawNetwork();
    drawExplore();
    canvasDirty = true;
  }
  document.body.style.cursor = hoverNode || hover3DKey ? "pointer" : "default";
  requestAnimationFrame(loop);
}

let hover3DKey = null;
let canvasDirty = true;

function updateHover3D() {
  hoverNode = null;
  const canHover = scene3d && !activeSection && !exploreMode && mouse.tx > -900;
  const key = canHover ? scene3d.pick(mouse.tx, mouse.ty) : null;
  if (key !== hover3DKey) {
    hover3DKey = key;
    if (scene3d) scene3d.setHover(key);
  }
}

canvas.addEventListener("mousemove", event => {
  mouse.tx = event.clientX;
  mouse.ty = event.clientY;
  if (scene3d) scene3d.setPointer(event.clientX, event.clientY);
});

canvas.addEventListener("mouseleave", () => {
  mouse.tx = -999;
  mouse.ty = -999;
  if (scene3d) scene3d.setPointer(null);
});

canvas.addEventListener("click", event => {
  let key = null;
  if (use3DMap()) {
    key = scene3d && !exploreMode ? scene3d.pick(event.clientX, event.clientY) : null;
  } else {
    const target = hoverNode || getClickableNode(mouse.tx, mouse.ty);
    key = target ? (target.secret ? "secret" : target.key) : null;
  }
  if (!key) {
    if (activeSection) closeSection();
    // a click on empty space sends a shockwave through the network
    else if (scene3d && use3DMap() && !exploreMode) scene3d.ripple(event.clientX, event.clientY);
    return;
  }
  if (key === "secret") {
    activateExploreMode();
    return;
  }
  if (activeSection === key) closeSection();
  else setActiveSection(key, { tour: true });
  mouse.tx = -999;
  mouse.ty = -999;
  hoverNode = null;
  hover3DKey = null;
  if (scene3d) scene3d.setHover(null);
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
      ? "Desenvolvedor Back-End | Machine Learning & Análise de Dados"
      : "Back-End Developer | Machine Learning & Data Analysis";

    const identityCopy = document.querySelector(".identity__copy");
    if (identityCopy) identityCopy.textContent = currentLang === "pt"
      ? "Desenvolvedor back-end criando APIs, automações e sistemas inteligentes com Python e Java — com forte interesse em Machine Learning, dados e em como os sistemas realmente funcionam por baixo."
      : "Back-end developer building APIs, automations and intelligent systems with Python and Java — with a strong pull toward Machine Learning, data and how systems really work underneath.";

    const statYears = document.querySelector('[data-i18n="statYears"]');
    if (statYears) statYears.textContent = currentLang === "pt" ? "anos construindo" : "years building";
    const statProjects = document.querySelector('[data-i18n="statProjects"]');
    if (statProjects) statProjects.textContent = currentLang === "pt" ? "projetos realizados" : "projects realized";
    const statCommunity = document.querySelector('[data-i18n="statCommunity"]');
    if (statCommunity) statCommunity.textContent = currentLang === "pt" ? "comunidade dev no Brasil" : "Brazil dev community";

    const downloadCv = document.querySelector('[data-i18n="downloadCv"]');
    if (downloadCv) {
      const cvFile = currentLang === "pt" ? "bernardo-righi-curriculo.pdf" : "bernardo-righi-resume.pdf";
      downloadCv.setAttribute("href", cvFile);
      downloadCv.setAttribute("download", cvFile);
      downloadCv.setAttribute("aria-label", currentLang === "pt" ? "Baixar currículo" : "Download CV");
    }

    const cvPromo = document.querySelector('[data-i18n="cvPromo"]');
    if (cvPromo) {
      cvPromo.querySelector(".cv-promo__tag").textContent = currentLang === "pt" ? "NOVO" : "NEW";
      cvPromo.querySelector(".cv-promo__text").textContent = currentLang === "pt" ? "Avalie seu currículo com o cvlint" : "Check your resume with cvlint";
    }

    updateHint();
    const backHome = document.querySelector('[data-i18n="backHome"]');
    if (backHome) backHome.textContent = currentLang === "pt" ? "Voltar para a rede" : "Back to neural map";
    const exploreExit = document.querySelector('[data-i18n="exploreExit"]');
    if (exploreExit) exploreExit.textContent = currentLang === "pt" ? "Parar / Sair" : "Stop / Exit";

    navItems.forEach(nav => { nav.textContent = labelFor(nav.dataset.section); });
    if (scene3d) scene3d.setLabels(clusterLabelMap());
    nodes.forEach(node => {
      if (node.core && node.key !== "secret") {
        node.label = labelFor(node.key);
      }
    });
    if (activeSection) renderPanel(activeSection);
    fitIdentity();
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
    exitExploreMode();
  }
});

window.addEventListener("keyup", event => {
  keysDown.delete(event.key);
});

// ─── Touch controls for explore mode ────────────────────────────────────
canvas.addEventListener("touchstart", e => {
  if (!exploreMode) return;
  e.preventDefault();
  for (const touch of e.changedTouches) {
    if (touch.clientX < width * 0.6 && !touchMove) {
      touchMove = { id: touch.identifier, startX: touch.clientX, startY: touch.clientY,
                    currentX: touch.clientX, currentY: touch.clientY };
    } else {
      touchFire = true;
    }
  }
}, { passive: false });

canvas.addEventListener("touchmove", e => {
  if (!exploreMode) return;
  e.preventDefault();
  for (const touch of e.changedTouches) {
    if (touchMove && touch.identifier === touchMove.id) {
      touchMove.currentX = touch.clientX;
      touchMove.currentY = touch.clientY;
    }
  }
}, { passive: false });

canvas.addEventListener("touchend", e => {
  for (const touch of e.changedTouches) {
    if (touchMove && touch.identifier === touchMove.id) touchMove = null;
    else touchFire = false;
  }
});

window.addEventListener("resize", resize);

resize();
requestAnimationFrame(loop);

// Text metrics change once webfonts/images arrive — re-measure the layout.
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(refitLayout);
}
// In Next.js, init runs from useEffect — the load event may already have fired.
if (document.readyState === "complete") {
  window.setTimeout(refitLayout, 50);
} else {
  window.addEventListener("load", refitLayout);
}

// ─── URL params: deep-link sections/projects + layout debug ──────────────
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get("nofx") === "1") {
  document.documentElement.classList.add("nofx");
}
{
  const qsLang = urlParams.get("lang");
  if (qsLang && qsLang !== currentLang) {
    const langBtn = langItems.find(button => button.dataset.lang === qsLang);
    if (langBtn) langBtn.click();
  }
  const qsSection = urlParams.get("section");
  if (qsSection && sections[qsSection]) setActiveSection(qsSection);
  const qsProject = urlParams.get("project");
  if (qsProject && projects[qsProject]) window.setTimeout(() => openProject(qsProject), 300);
}

// ─── Hero stats count up once, after the hero has emerged ────────────────
{
  const statEls = [...document.querySelectorAll(".istat strong[data-count]")];
  if (statEls.length && !document.documentElement.classList.contains("nofx")) {
    const start = performance.now() + 900;
    const duration = 1400;
    const render = progress => statEls.forEach(el => {
      const n = Math.round(Number(el.dataset.count) * progress);
      el.textContent = `${el.dataset.prefix || ""}${n}${el.dataset.suffix || ""}`;
    });
    render(0);
    const step = now => {
      const t = Math.min(1, Math.max(0, (now - start) / duration));
      render(1 - Math.pow(1 - t, 3));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
}

// ─── Layout audit (?debug=1) — asserts nothing is clipped or scrollable ──
function auditIsRendered(el) {
  if (!el || !el.getClientRects().length) return false;
  let node = el;
  while (node && node !== document.documentElement) {
    if (parseFloat(getComputedStyle(node).opacity) < 0.05) return false;
    node = node.parentElement;
  }
  return true;
}

function auditRect(issues, el, name, bounds) {
  if (!auditIsRendered(el)) return;
  const r = el.getBoundingClientRect();
  const tol = 2.5;
  if (r.left < bounds.left - tol || r.right > bounds.right + tol ||
      r.top < bounds.top - tol || r.bottom > bounds.bottom + tol) {
    issues.push(`${name} clipped [${Math.round(r.left)},${Math.round(r.top)} → ${Math.round(r.right)},${Math.round(r.bottom)}] outside [${Math.round(bounds.left)},${Math.round(bounds.top)} → ${Math.round(bounds.right)},${Math.round(bounds.bottom)}]`);
  }
}

function runLayoutAudit() {
  const issues = [];
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const viewport = { left: 0, top: 0, right: vw, bottom: vh };
  const de = document.documentElement;

  if (de.scrollWidth > vw + 1) issues.push(`page h-overflow ${de.scrollWidth}>${vw}`);
  if (de.scrollHeight > vh + 1) issues.push(`page v-overflow ${de.scrollHeight}>${vh}`);
  if (window.scrollX || window.scrollY) issues.push(`page scrolled ${window.scrollX},${window.scrollY}`);

  auditRect(issues, document.querySelector(".signal"), "signal", viewport);
  document.querySelectorAll(".signal-social").forEach((el, i) => auditRect(issues, el, `social#${i}`, viewport));
  auditRect(issues, document.querySelector(".cv-download"), "cv-download", viewport);
  auditRect(issues, document.querySelector(".lang-toggle"), "lang-toggle", viewport);
  const navEl = document.querySelector(".nav");
  if (navEl && navEl.scrollWidth > navEl.clientWidth + 2) {
    issues.push(`nav items clipped ${navEl.scrollWidth}>${navEl.clientWidth}`);
  }
  document.querySelectorAll(".nav__item").forEach(el => auditRect(issues, el, `nav:${el.textContent}`, viewport));

  const modalOpen = modal.classList.contains("open");
  if (modalOpen) {
    auditRect(issues, modalBoxEl, "modal", viewport);
    if (!modalScaleFloored && modalBoxEl.scrollHeight > modalBoxEl.clientHeight + 2) {
      issues.push(`modal overflows ${modalBoxEl.scrollHeight}>${modalBoxEl.clientHeight}`);
    }
  } else if (activeSection) {
    auditRect(issues, panel, "panel", viewport);
    if (!auditIsRendered(panelContent)) issues.push("panel content not rendered");
    if (!panelScaleFloored && panel.scrollHeight > panel.clientHeight + 2) {
      issues.push(`panel overflows ${panel.scrollHeight}>${panel.clientHeight} (scale=${lastPanelScale.toFixed(2)})`);
    }
    const timelineEl = panelContent.querySelector(".timeline");
    if (timelineEl && timelineEl.scrollWidth > timelineEl.clientWidth + 2) {
      issues.push(`timeline h-overflow ${timelineEl.scrollWidth}>${timelineEl.clientWidth}`);
    }
    if (!panelScaleFloored) {
      // When the scale floor is hit the panel scrolls by design — element
      // clipping below the fold is expected there, not a layout bug.
      const panelBounds = panel.getBoundingClientRect();
      panelContent.querySelectorAll(".project-card, .orbital-item, .contact-link, .tl-event, .community-card, .contact-card").forEach((el, i) => {
        auditRect(issues, el, `${el.className.split(" ")[0]}#${i}`, panelBounds);
      });
    }
  } else {
    const identityInner = document.querySelector(".identity__inner") || identityEl;
    if (!auditIsRendered(identityInner)) {
      issues.push("identity not rendered");
    } else {
      const topbarBottom = topbarEl.getBoundingClientRect().bottom;
      const hintTop = (hintEl && auditIsRendered(hintEl)) ? hintEl.getBoundingClientRect().top : vh;
      const heroBounds = { left: 0, top: topbarBottom - 4, right: vw, bottom: hintTop + 4 };
      [".identity__photo", ".identity__eyebrow", ".identity h1", ".identity__copy",
       ".identity__stats", ".identity__languages", ".cv-promo", ".terminal"].forEach(sel => {
        auditRect(issues, document.querySelector(sel), sel, heroBounds);
      });
      auditRect(issues, hintEl, "hint", viewport);
    }
  }

  let banner = document.getElementById("layout-audit");
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "layout-audit";
    document.body.appendChild(banner);
  }
  banner.style.cssText =
    "position:fixed;left:0;bottom:0;z-index:99999;font:600 11px/1.35 Consolas,monospace;" +
    "padding:4px 8px;max-width:70vw;pointer-events:none;white-space:pre-wrap;" +
    (issues.length ? "background:rgba(127,29,29,.92);color:#fff" : "background:rgba(20,83,45,.88);color:#d1fae5");
  const floorNote = (panelScaleFloored || modalScaleFloored) ? " FLOOR-SCROLL" : "";
  banner.textContent = issues.length
    ? `AUDIT FAIL ${vw}x${vh} idScale=${lastIdentityScale.toFixed(2)} panelScale=${lastPanelScale.toFixed(2)}${floorNote} (${issues.length})\n` + issues.join("\n")
    : `AUDIT OK ${vw}x${vh} idScale=${lastIdentityScale.toFixed(2)} panelScale=${lastPanelScale.toFixed(2)}${floorNote}`;
  window.__auditResult = { vw, vh, issues };
  if (window.parent !== window) {
    try { window.parent.postMessage("__audit:" + banner.textContent, "*"); } catch (e) { /* cross-origin */ }
  }
}

if (urlParams.get("debug") === "1") {
  window.__map3d = () => (scene3d && use3DMap() ? scene3d.screens() : null);
  window.setTimeout(runLayoutAudit, 2600);
  window.addEventListener("resize", () => window.setTimeout(runLayoutAudit, 800));
}

// ─── Explore Mode Exit Button ────────────────────────────────────────────
if (exploreExitBtn) {
  exploreExitBtn.addEventListener("click", () => {
    exitExploreMode();
  });
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
    ctx.fillStyle = "rgba(91, 127, 191, 0.45)";
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

} // end initEngine
