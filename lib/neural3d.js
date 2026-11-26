"use strict";

// Desktop-only 3D neural map. engine.js loads this module on demand (dynamic
// import), so phones and touch devices never download three.js — they keep the
// light 2D canvas instead.
//
// Each portfolio section is a geometric "brain region" built out of neurons:
// the particles fly in from deep space and assemble into the shapes, axons with
// travelling signal pulses link the regions, the neurons shy away from the
// cursor, clicks send a shockwave through the network, and opening a section
// makes the region's neurons fly out and draw the section card's outline.
// The engine drives it through the API returned by createNeuralScene().
import {
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  Group,
  BufferGeometry,
  BufferAttribute,
  Float32BufferAttribute,
  DynamicDrawUsage,
  Points,
  LineSegments,
  ShaderMaterial,
  LineBasicMaterial,
  AdditiveBlending,
  NormalBlending,
  Color,
  Vector2,
  Vector3,
  OctahedronGeometry,
  EdgesGeometry,
  QuadraticBezierCurve3,
  CatmullRomCurve3,
} from "three";

const BG = 0x0b0b0c;
const INK = new Color("#E4E7EB");
const ACCENT = new Color("#5B7FBF");
const FOV = 40;
const CAM_Z = 30;
const INTRO_SECONDS = 1.1;
const TAN_HALF_FOV = Math.tan((FOV * Math.PI) / 360);

// Two arrangements of the constellation (world units at scale 1). "wide" fills
// a landscape gap beside the hero, "tall" (2 columns) suits narrow windows; the
// one that fits larger wins. Depth (z) differences are kept small on purpose:
// big ones let a front shape swing over its neighbour when the scene leans.
const PRESETS = {
  wide: {
    pos: {
      journey:    [-5.5, 5.0, -1.4],
      skills:     [3.6, 6.0, 0.6],
      leadership: [9.6, 0.4, -1.0],
      projects:   [4.6, -5.4, 0.9],
      contact:    [-4.0, -4.8, -0.5],
      about:      [0.0, 0.3, 1.3],
    },
    bounds: { minX: -7.6, maxX: 11.8, minY: -7.7, maxY: 8.2 },
  },
  tall: {
    pos: {
      journey:    [-3.2, 6.4, -0.8],
      skills:     [3.4, 6.6, 0.6],
      about:      [-3.0, 0.2, 1.0],
      leadership: [3.4, 0.0, -0.8],
      contact:    [-3.2, -6.4, -0.4],
      projects:   [3.2, -6.6, 0.8],
    },
    bounds: { minX: -5.4, maxX: 5.6, minY: -8.9, maxY: 8.8 },
  },
};

// Icons that read best from the front sway around it ("sway"); the rocket and
// the gear turn on their own axis ("spin"), which is what they'd naturally do.
const CLUSTERS = {
  about:      { r: 2.0, shape: "brain",  base: [0.1, 0, 0],         motion: { type: "sway", amp: 0.55, speed: 0.35 } },
  journey:    { r: 2.1, shape: "rocket", base: [0, 0, -0.42],       motion: { type: "spin", axis: "y", speed: 0.55 } },
  skills:     { r: 2.2, shape: "code",   base: [0.12, 0, 0],        motion: { type: "sway", amp: 0.32, speed: 0.55 } },
  leadership: { r: 2.2, shape: "people", base: [0.08, 0, 0],        motion: { type: "sway", amp: 0.45, speed: 0.45 } },
  projects:   { r: 2.3, shape: "gear",   base: [-0.28, 0.42, 0],    motion: { type: "spin", axis: "z", speed: -0.32 } },
  contact:    { r: 2.0, shape: "plane",  base: [0.95, -0.35, 0.45], motion: { type: "sway", amp: 0.25, speed: 0.6 } },
};

const AXONS = [
  ["about", "journey"], ["about", "skills"], ["about", "leadership"],
  ["about", "projects"], ["about", "contact"],
  ["journey", "skills"], ["skills", "leadership"], ["leadership", "projects"],
  ["projects", "contact"], ["contact", "journey"],
];

// ─── Shape generators (≈ unit radius) → { pts: [[x,y,z]], links: [[i,j]] } ──
// Each region is an icon of what its section is about, drawn in neurons.
function knnLinks(pts, k) {
  const seen = new Set();
  const links = [];
  pts.forEach((a, i) => {
    const near = pts
      .map((b, j) => [j, (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2])
      .filter(([j]) => j !== i)
      .sort((x, y) => x[1] - y[1])
      .slice(0, k);
    near.forEach(([j]) => {
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (!seen.has(key)) {
        seen.add(key);
        links.push([i, j]);
      }
    });
  });
  return links;
}

// Concatenate parts, offsetting each part's link indices
function mergeParts(parts) {
  const pts = [];
  const links = [];
  parts.forEach(part => {
    const offset = pts.length;
    pts.push(...part.pts);
    part.links.forEach(([a, b]) => links.push([a + offset, b + offset]));
  });
  return { pts, links };
}

// Evenly spaced neurons along a polyline, chained together
function sampleLine(verts, step, closed = false) {
  const pts = [];
  const segments = closed ? verts.length : verts.length - 1;
  for (let i = 0; i < segments; i++) {
    const a = verts[i];
    const b = verts[(i + 1) % verts.length];
    const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / step));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
    }
  }
  if (!closed) pts.push(verts[verts.length - 1].slice());
  const links = [];
  for (let i = 0; i < pts.length - 1; i++) links.push([i, i + 1]);
  if (closed) links.push([pts.length - 1, 0]);
  return { pts, links };
}

// Copy a flat part onto several depth layers, laddered together
function extrude(part, depths) {
  const n = part.pts.length;
  const pts = [];
  const links = [];
  depths.forEach((z, layer) => {
    part.pts.forEach(p => pts.push([p[0], p[1], p[2] + z]));
    part.links.forEach(([a, b]) => links.push([a + layer * n, b + layer * n]));
    if (layer > 0) for (let i = 0; i < n; i++) links.push([i + (layer - 1) * n, i + layer * n]);
  });
  return { pts, links };
}

// Fibonacci points on an ellipsoid, optionally filtered on the unit sphere
function ellipsoid(n, [a, b, c], [cx, cy, cz] = [0, 0, 0], keep = () => true) {
  const pts = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const x = Math.cos(golden * i) * r;
    const z = Math.sin(golden * i) * r;
    if (keep(x, y, z)) pts.push([cx + x * a, cy + y * b, cz + z * c]);
  }
  return pts;
}

// 01 About — a brain: two folded hemispheres, cerebellum and stem (side view)
function brainShape() {
  const parts = [];
  [-1, 1].forEach(side => {
    const pts = ellipsoid(150, [1, 1, 1], [0, 0, 0], (x, y, z) => z * side > 0.04).map(([x, y, z]) => {
      const fold = 1 + 0.07 * Math.sin(9 * x + 4 * y) * Math.cos(7 * y - 3 * z); // gyri & sulci
      let Y = y * 0.7 * fold;
      if (Y < -0.36) Y = -0.36 + (Y + 0.36) * 0.35; // flatter underside
      return [x * fold, Y + 0.12, z * 0.6 * fold + side * 0.06];
    });
    parts.push({ pts, links: knnLinks(pts, 3) });
  });
  const cerebellum = ellipsoid(26, [0.3, 0.2, 0.42], [-0.6, -0.36, 0]);
  parts.push({ pts: cerebellum, links: knnLinks(cerebellum, 2) });
  parts.push(sampleLine([[-0.3, -0.38, 0], [-0.42, -0.95, 0]], 0.1));
  return mergeParts(parts);
}

// 02 Journey — a rocket (the timeline already flies one)
function rocketShape() {
  const seg = 10;
  const rings = [[-0.55, 0.27], [-0.33, 0.27], [-0.11, 0.27], [0.11, 0.27], [0.33, 0.27], [0.52, 0.23], [0.68, 0.16], [0.82, 0.08]];
  const hull = { pts: [], links: [] };
  rings.forEach(([y, r], ri) => {
    for (let k = 0; k < seg; k++) {
      const a = (k / seg) * Math.PI * 2;
      hull.pts.push([Math.cos(a) * r, y, Math.sin(a) * r]);
      const i = ri * seg + k;
      hull.links.push([i, ri * seg + ((k + 1) % seg)]);
      if (ri + 1 < rings.length) hull.links.push([i, i + seg]);
    }
  });
  hull.pts.push([0, 1, 0]); // nose tip
  for (let k = 0; k < seg; k++) hull.links.push([(rings.length - 1) * seg + k, hull.pts.length - 1]);

  const parts = [hull];
  for (let f = 0; f < 3; f++) {
    const a = (f / 3) * Math.PI * 2 + Math.PI / 6;
    const at = (r, y) => [Math.cos(a) * r, y, Math.sin(a) * r];
    parts.push(sampleLine([at(0.27, -0.1), at(0.62, -0.62), at(0.62, -0.8), at(0.27, -0.55)], 0.12, true));
  }
  // porthole facing the camera
  const porthole = [];
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    porthole.push([Math.cos(a) * 0.1, 0.14 + Math.sin(a) * 0.1, 0.285]);
  }
  parts.push(sampleLine(porthole, 0.2, true));
  // nozzle + exhaust plume (loose neurons, no links)
  const nozzle = [];
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    nozzle.push([Math.cos(a) * 0.17, -0.68, Math.sin(a) * 0.17]);
  }
  parts.push(sampleLine(nozzle, 0.3, true));
  const plume = [];
  for (let k = 0; k < 10; k++) {
    const t = k / 9;
    const r = 0.14 * (1 - t) * Math.random();
    const a = Math.random() * Math.PI * 2;
    plume.push([Math.cos(a) * r, -0.76 - t * 0.36, Math.sin(a) * r]);
  }
  parts.push({ pts: plume, links: [] });
  return mergeParts(parts);
}

// 03 Skills — "</>", extruded in three layers
function codeShape() {
  const glyphs = [
    [[-0.42, 0.52, 0], [-0.95, 0, 0], [-0.42, -0.52, 0]],
    [[0.2, 0.66, 0], [-0.2, -0.66, 0]],
    [[0.42, 0.52, 0], [0.95, 0, 0], [0.42, -0.52, 0]],
  ];
  return mergeParts(glyphs.map(g => extrude(sampleLine(g, 0.11), [-0.1, 0, 0.1])));
}

// 04 Leadership — a community: three people, the lead one in front
function peopleShape() {
  // Outlined like the "users" icon: a round head over an arched bust
  const person = (s, [dx, dy, dz]) => {
    const head = [];
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      head.push([dx + Math.cos(a) * 0.2 * s, dy + 0.34 * s + Math.sin(a) * 0.2 * s, dz]);
    }
    const bust = [];
    for (let k = 0; k <= 10; k++) {
      const a = (k / 10) * Math.PI;
      bust.push([dx + Math.cos(a) * 0.4 * s, dy - 0.36 * s + Math.sin(a) * 0.4 * s, dz]);
    }
    const depth = [-0.08 * s, 0.08 * s];
    return mergeParts([extrude(sampleLine(head, 0.2, true), depth), extrude(sampleLine(bust, 0.13, true), depth)]);
  };
  return mergeParts([
    person(0.74, [-0.64, 0.1, -0.22]),
    person(0.74, [0.64, 0.1, -0.22]),
    person(1, [0, -0.06, 0.18]), // the lead one, in front
  ]);
}

// 05 Projects — a gear: building things
function gearShape() {
  const teeth = 9;
  const rIn = 0.7;
  const rOut = 0.95;
  const w = (Math.PI * 2) / teeth;
  const outline = [];
  for (let i = 0; i < teeth; i++) {
    const a = i * w;
    [[rIn, 0], [rOut, 0.22], [rOut, 0.55], [rIn, 0.77]].forEach(([r, f]) => {
      outline.push([Math.cos(a + f * w) * r, Math.sin(a + f * w) * r, 0]);
    });
  }
  const hub = [];
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    hub.push([Math.cos(a) * 0.26, Math.sin(a) * 0.26, 0]);
  }
  const spokes = [0, 1, 2, 3].map(k => {
    const a = Math.PI / 4 + (k * Math.PI) / 2;
    return sampleLine([[Math.cos(a) * 0.32, Math.sin(a) * 0.32, 0], [Math.cos(a) * 0.64, Math.sin(a) * 0.64, 0]], 0.11);
  });
  return mergeParts([
    extrude(sampleLine(outline, 0.12, true), [-0.14, 0.14]),
    extrude(sampleLine(hub, 0.2, true), [-0.14, 0.14]),
    ...spokes,
  ]);
}

// 06 Contact — a paper plane, with a little motion trail
function planeShape() {
  const N = [1, 0, 0];
  const L = [-0.75, 0.12, 0.8];
  const R = [-0.75, 0.12, -0.8];
  const C = [-0.75, 0, 0];
  const K = [-0.75, -0.38, 0];
  const edges = [[N, L], [N, R], [N, C], [L, C], [R, C], [N, K], [C, K]].map(e => sampleLine(e, 0.11));
  // neurons scattered over the wing and keel surfaces
  const fill = (a, b, c, n) => {
    const pts = [];
    for (let i = 0; i < n; i++) {
      let u = Math.random();
      let v = Math.random();
      if (u + v > 1) { u = 1 - u; v = 1 - v; }
      pts.push([0, 1, 2].map(k => a[k] + (b[k] - a[k]) * u + (c[k] - a[k]) * v));
    }
    return { pts, links: knnLinks(pts, 2) };
  };
  const trail = { pts: [], links: [] };
  for (let k = 1; k <= 6; k++) trail.pts.push([-0.8 - k * 0.1, 0.05 - k * k * 0.01, 0]);
  const plane = mergeParts([...edges, fill(N, L, C, 16), fill(N, R, C, 16), fill(N, C, K, 8), trail]);
  // recentre (the trail makes it tail-heavy) so it fits the same radius as the others
  plane.pts = plane.pts.map(([x, y, z]) => [x * 0.85 + 0.22, y * 0.85, z * 0.85]);
  return plane;
}

const SHAPES = { brain: brainShape, rocket: rocketShape, code: codeShape, people: peopleShape, gear: gearShape, plane: planeShape };

// ─── Shaders ─────────────────────────────────────────────────────────────
// Shared by points and links so both fly in, breathe, pulse and dodge the
// cursor in lockstep.
const NEURON = /* glsl */ `
  uniform float uTime;
  uniform float uIntro;
  uniform float uHover;
  uniform float uBurst;
  uniform vec2 uMouse;
  uniform float uMouseOn;
  uniform float uAspect;
  attribute vec3 aStart;
  attribute float aRand;
  float gArrive;
  vec3 neuronPos(vec3 target) {
    float p = clamp((uIntro - aRand * 0.42) / 0.58, 0.0, 1.0);
    gArrive = 1.0 - pow(1.0 - p, 3.0);
    vec3 pos = mix(aStart, target, gArrive);
    float breathe = sin(uTime * 1.1 + aRand * 6.2831) * 0.03;
    // hover swells the shape; a click shockwave makes it ring like a bell
    return pos + target * (breathe + uHover * 0.09 + uBurst * (0.55 + aRand * 0.9));
  }
  // Cursor force field: neurons near the pointer are pushed away in screen
  // space (scaled by depth so the push is the same size on screen everywhere).
  vec4 dodge(vec4 mv) {
    vec4 clip = projectionMatrix * mv;
    vec2 ndc = clip.xy / clip.w;
    vec2 d = (ndc - uMouse) * vec2(uAspect, 1.0);
    float dist = length(d);
    // gentler on the hovered icon, so it stays readable while you look at it
    float f = smoothstep(0.3, 0.0, dist) * uMouseOn * (1.0 - uHover * 0.6);
    vec2 dir = dist > 0.0001 ? d / dist : vec2(0.0);
    mv.xy += dir * f * 0.026 * (-mv.z) * (0.6 + aRand * 0.8);
    return mv;
  }
`;

const POINT_VERT = /* glsl */ `
  ${NEURON}
  uniform float uSize;
  uniform float uPR;
  varying float vAlpha;
  void main() {
    vec4 mv = dodge(modelViewMatrix * vec4(neuronPos(position), 1.0));
    gl_Position = projectionMatrix * mv;
    float twinkle = 0.72 + 0.28 * sin(uTime * 2.2 + aRand * 40.0);
    // clamped + faded up close: when the camera dives into a region its
    // neurons stream past instead of turning into screen-sized blobs
    gl_PointSize = min(uSize * (0.55 + aRand * 0.9) * uPR * (${CAM_Z.toFixed(1)} / -mv.z), 34.0 * uPR);
    vAlpha = gArrive * twinkle * smoothstep(72.0, 20.0, -mv.z) * smoothstep(0.25, 2.2, -mv.z);
  }
`;

const POINT_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uAccent;
  uniform float uHover;
  uniform float uActive;
  uniform float uFocus;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float core = pow(smoothstep(0.5, 0.0, d), 1.7);
    vec3 col = mix(uColor, uAccent, max(uHover, uActive));
    gl_FragColor = vec4(col, core * vAlpha * uFocus);
  }
`;

const LINK_VERT = /* glsl */ `
  ${NEURON}
  varying float vAlpha;
  void main() {
    vec4 mv = dodge(modelViewMatrix * vec4(neuronPos(position), 1.0));
    gl_Position = projectionMatrix * mv;
    vAlpha = smoothstep(0.78, 1.0, uIntro) * smoothstep(72.0, 20.0, -mv.z) * smoothstep(0.25, 2.2, -mv.z);
  }
`;

const LINK_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uAccent;
  uniform float uHover;
  uniform float uActive;
  uniform float uFocus;
  uniform float uLink;
  varying float vAlpha;
  void main() {
    float h = max(uHover, uActive);
    vec3 col = mix(uColor, uAccent, h);
    gl_FragColor = vec4(col, vAlpha * uLink * (1.0 + h * 1.6) * uFocus);
  }
`;

const DUST_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uPR;
  attribute float aRand;
  varying float vAlpha;
  void main() {
    vec3 pos = position;
    pos.y += sin(uTime * 0.12 + aRand * 6.2831) * 0.8;
    pos.x += cos(uTime * 0.09 + aRand * 12.0) * 0.6;
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = min((1.0 + aRand * 1.6) * uPR * (${CAM_Z.toFixed(1)} / -mv.z), 9.0 * uPR);
    vAlpha = (0.18 + aRand * 0.3) * smoothstep(90.0, 25.0, -mv.z) * smoothstep(0.3, 3.0, -mv.z);
  }
`;

const DUST_FRAG = /* glsl */ `
  uniform float uFocus;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    gl_FragColor = vec4(vec3(0.89, 0.9, 0.92), smoothstep(0.5, 0.1, d) * vAlpha * uFocus);
  }
`;

const PULSE_VERT = /* glsl */ `
  uniform float uPR;
  attribute float aHot;
  varying float vHot;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = min((5.0 + aHot * 3.0) * uPR * (${CAM_Z.toFixed(1)} / -mv.z), 22.0 * uPR);
    vHot = aHot;
  }
`;

const PULSE_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uAccent;
  uniform float uAlpha;
  varying float vHot;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float a = pow(smoothstep(0.5, 0.0, d), 2.2);
    gl_FragColor = vec4(mix(uColor, uAccent, vHot), a * uAlpha);
  }
`;

const AXON_VERT = /* glsl */ `
  attribute float aT;
  varying float vT;
  void main() {
    vT = aT;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const AXON_FRAG = /* glsl */ `
  uniform float uAlpha;
  varying float vT;
  void main() {
    // fade toward both ends so axons read as fibres, not wires
    float ends = smoothstep(0.0, 0.25, vT) * smoothstep(1.0, 0.75, vT);
    gl_FragColor = vec4(vec3(0.89, 0.9, 0.92), uAlpha * (0.35 + ends * 0.65));
  }
`;

// Card-assembly swarm: positions are written on the CPU every frame
const SWARM_VERT = /* glsl */ `
  uniform float uPR;
  attribute float aAlpha;
  varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    // 3.4 px on the card plane (12 units away), bigger up close — so a
    // region's neurons keep their size when they turn into the swarm
    gl_PointSize = 3.4 * uPR * clamp(12.0 / -mv.z, 1.0, 9.0);
    vAlpha = aAlpha * smoothstep(0.2, 1.4, -mv.z);
  }
`;

const SWARM_FRAG = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    gl_FragColor = vec4(uColor, pow(smoothstep(0.5, 0.0, d), 1.4) * vAlpha);
  }
`;

const SWARM_LINE_VERT = /* glsl */ `
  attribute float aAlpha;
  varying float vAlpha;
  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    vAlpha = aAlpha;
  }
`;

const SWARM_LINE_FRAG = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    gl_FragColor = vec4(uColor, vAlpha);
  }
`;

// Card-building particles. Each one flies out of a region as a glowing dot,
// lands on its cell of the card and grows into a square tile; side by side the
// tiles become the card's actual surface (a mosaic assembling in a wave).
const FIELD_VERT = /* glsl */ `
  uniform float uPR;
  attribute float aSize;
  attribute float aTile;
  attribute float aMix;
  attribute float aAlpha;
  attribute vec2 aRect;
  varying float vTile;
  varying float vMix;
  varying float vAlpha;
  varying vec2 vRect;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    // 1x on the card plane (tiles stay pixel-exact), bigger while still close
    gl_PointSize = aSize * uPR * clamp(12.0 / -mv.z, 0.6, 7.0);
    vTile = aTile;
    vMix = aMix;
    vAlpha = aAlpha * smoothstep(0.2, 1.4, -mv.z);
    vRect = aRect;
  }
`;

const FIELD_FRAG = /* glsl */ `
  uniform vec3 uGlow;
  uniform vec3 uInk;
  uniform vec3 uSurface;
  varying float vTile;
  varying float vMix;
  varying float vAlpha;
  varying vec2 vRect;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    // morph a round dot (tile = 0) into the cell's rectangle (tile = 1)
    vec2 halfSize = 0.5 * mix(vec2(1.0), vRect, vTile);
    vec2 q = abs(c) / halfSize;
    float box = max(q.x, q.y);
    float dotR = length(c) * 2.0;
    float shape = mix(dotR, box, vTile);
    if (shape > 1.0) discard;
    float soft = mix(pow(max(0.0, 1.0 - dotR), 1.4), 1.0, vTile);
    // a flying dot is pure signal glow; as it opens into a tile the body goes
    // dark (a tinted surface) and the glow gathers on its edges — the seams of
    // the mosaic light up, then everything cools to the card's surface colour
    vec3 hot = mix(mix(uGlow, uInk, 0.2), uSurface + uGlow * 0.16, vTile);
    vec3 col = mix(hot, uSurface, vMix);
    col += uGlow * smoothstep(0.78, 1.0, box) * vTile * (1.0 - vMix) * 0.75;
    gl_FragColor = vec4(col, soft * vAlpha);
  }
`;

function randomShellPoint(minR, maxR) {
  const u = Math.random() * 2 - 1;
  const a = Math.random() * Math.PI * 2;
  const r = minR + Math.random() * (maxR - minR);
  const s = Math.sqrt(1 - u * u);
  return [Math.cos(a) * s * r, u * r, Math.sin(a) * s * r];
}

const damp = (current, target, rate, dt) => current + (target - current) * (1 - Math.exp(-rate * dt));
const easeInOutCubic = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
const easeInCubic = t => t * t * t;
const smoothstepJs = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Motion is deliberately NOT tied to prefers-reduced-motion: the OS-level
// "animation effects" switch (off on many Windows machines) used to strip every
// effect out of the site. instant = skip the intro (layout tests, ?nofx=1).
export function createNeuralScene({ canvas, labelsEl, labels, instant = false }) {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.setClearColor(BG, 1);
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.75);
  renderer.setPixelRatio(pixelRatio);

  const scene = new Scene();
  const camera = new PerspectiveCamera(FOV, 1, 0.1, 220);
  camera.position.set(0, 0, CAM_Z);
  scene.add(camera); // the card swarm is parented to the camera

  const world = new Group(); // constellation — positioned/scaled to sit beside the hero
  const tilt = new Group();  // gentle pointer parallax, kept small so shapes never cross
  world.add(tilt);
  scene.add(world);

  const shared = {
    uTime: { value: 0 },
    uIntro: { value: instant ? 1 : 0 },
    uPR: { value: pixelRatio },
    uMouse: { value: new Vector2(9, 9) },
    uMouseOn: { value: 0 },
    uAspect: { value: 1 },
  };
  const clusters = [];
  let presetName = "wide";

  Object.entries(CLUSTERS).forEach(([key, cfg], index) => {
    const { pts, links } = SHAPES[cfg.shape]();
    // A few loose satellite neurons keep the geometry from looking too CAD-clean
    for (let i = 0; i < 8; i++) pts.push(randomShellPoint(1.05, 1.4));

    const home = PRESETS.wide.pos[key];
    const positions = [];
    const starts = [];
    const rands = [];
    pts.forEach(p => {
      positions.push(p[0] * cfg.r, p[1] * cfg.r, p[2] * cfg.r);
      // start far away, scattered all around the camera
      const s = randomShellPoint(18, 42);
      starts.push(s[0] - home[0], s[1] - home[1], s[2] * 0.5 - home[2]);
      rands.push(Math.random());
    });

    const uniforms = {
      uTime: shared.uTime,
      uIntro: shared.uIntro,
      uPR: shared.uPR,
      uMouse: shared.uMouse,
      uMouseOn: shared.uMouseOn,
      uAspect: shared.uAspect,
      uHover: { value: 0 },
      uActive: { value: 0 },
      uFocus: { value: 1 },
      uBurst: { value: 0 },
      uSize: { value: 5.2 },
      uLink: { value: 0.16 },
      uColor: { value: INK.clone() },
      uAccent: { value: ACCENT.clone() },
    };
    const material = (vertexShader, fragmentShader) => new ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });

    const pGeo = new BufferGeometry();
    pGeo.setAttribute("position", new Float32BufferAttribute(positions, 3));
    pGeo.setAttribute("aStart", new Float32BufferAttribute(starts, 3));
    pGeo.setAttribute("aRand", new Float32BufferAttribute(rands, 1));
    const pointsMesh = new Points(pGeo, material(POINT_VERT, POINT_FRAG));

    const lPos = [];
    const lStart = [];
    const lRand = [];
    links.forEach(([a, b]) => {
      [a, b].forEach(i => {
        lPos.push(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
        lStart.push(starts[i * 3], starts[i * 3 + 1], starts[i * 3 + 2]);
        lRand.push(rands[i]);
      });
    });
    const lGeo = new BufferGeometry();
    lGeo.setAttribute("position", new Float32BufferAttribute(lPos, 3));
    lGeo.setAttribute("aStart", new Float32BufferAttribute(lStart, 3));
    lGeo.setAttribute("aRand", new Float32BufferAttribute(lRand, 1));
    const linkMesh = new LineSegments(lGeo, material(LINK_VERT, LINK_FRAG));

    // group = placement, body = base pose, spinner = the
    // icon's own motion (sway or spin)
    const group = new Group();
    const body = new Group();
    const spinner = new Group();
    spinner.add(linkMesh, pointsMesh);
    body.add(spinner);
    group.add(body);
    tilt.add(group);

    const label = document.createElement("div");
    label.className = "cluster-label";
    label.dataset.key = key;
    label.style.setProperty("--d", `${0.12 * index}s`); // staggered first reveal
    label.innerHTML = `<span class="cluster-label__name"></span>`;
    labelsEl.appendChild(label);

    clusters.push({
      key,
      cfg,
      group,
      body,
      spinner,
      pointsMesh,
      localPts: positions,
      base: cfg.base || [0, 0, 0],
      uniforms,
      label,
      labelW: 0, // measured lazily (0 = needs measuring)
      hover: 0,
      phase: Math.random() * Math.PI * 2,
      spinBoost: 0,
      burst: { t: 0, amp: 0 },
      hidden: false, // its neurons are out drawing the section card
      screen: { x: -999, y: -999, r: 0, visible: false },
    });
  });
  const byKey = Object.fromEntries(clusters.map(c => [c.key, c]));

  // ── Axons between regions + travelling signal pulses ─────────────────
  const SEG = 36;
  const axons = AXONS.map(([a, b]) => ({ a, b, curve: new QuadraticBezierCurve3(new Vector3(), new Vector3(), new Vector3()) }));
  const axonGeo = new BufferGeometry();
  axonGeo.setAttribute("position", new Float32BufferAttribute(new Float32Array(axons.length * SEG * 6), 3));
  const axonT = [];
  axons.forEach(() => {
    for (let i = 0; i < SEG; i++) axonT.push(i / SEG, (i + 1) / SEG);
  });
  axonGeo.setAttribute("aT", new Float32BufferAttribute(axonT, 1));
  const axonUniforms = { uAlpha: { value: 0 } };
  const axonMesh = new LineSegments(axonGeo, new ShaderMaterial({
    uniforms: axonUniforms,
    vertexShader: AXON_VERT,
    fragmentShader: AXON_FRAG,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  }));
  tilt.add(axonMesh);

  const pulses = [];
  axons.forEach((axon, i) => {
    for (let k = 0; k < 2; k++) {
      pulses.push({ axon, t: Math.random(), speed: 0.1 + Math.random() * 0.12, dir: (i + k) % 2 ? 1 : -1 });
    }
  });
  const pulseGeo = new BufferGeometry();
  pulseGeo.setAttribute("position", new Float32BufferAttribute(new Float32Array(pulses.length * 3), 3));
  pulseGeo.setAttribute("aHot", new Float32BufferAttribute(new Float32Array(pulses.length), 1));
  const pulseUniforms = { uPR: shared.uPR, uColor: { value: INK.clone() }, uAccent: { value: ACCENT.clone() }, uAlpha: { value: 0 } };
  const pulseMesh = new Points(pulseGeo, new ShaderMaterial({
    uniforms: pulseUniforms,
    vertexShader: PULSE_VERT,
    fragmentShader: PULSE_FRAG,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  }));
  pulseMesh.frustumCulled = false; // positions change every frame
  tilt.add(pulseMesh);

  // Place the regions for a preset and re-route the axons between them
  function applyPreset(name) {
    presetName = name;
    const pos = PRESETS[name].pos;
    clusters.forEach(c => c.group.position.set(...pos[c.key]));
    const arr = axonGeo.attributes.position.array;
    axons.forEach((axon, ai) => {
      const A = new Vector3(...pos[axon.a]);
      const B = new Vector3(...pos[axon.b]);
      const dir = B.clone().sub(A).normalize();
      axon.curve.v0.copy(A).addScaledVector(dir, CLUSTERS[axon.a].r * 0.9);
      axon.curve.v2.copy(B).addScaledVector(dir, -CLUSTERS[axon.b].r * 0.9);
      axon.curve.v1.copy(axon.curve.v0).add(axon.curve.v2).multiplyScalar(0.5)
        .add(new Vector3(-dir.y, dir.x, 0).multiplyScalar(1.4)).add(new Vector3(0, 0, 1.6));
      const pts = axon.curve.getPoints(SEG);
      for (let i = 0; i < SEG; i++) {
        const o = (ai * SEG + i) * 6;
        arr[o] = pts[i].x; arr[o + 1] = pts[i].y; arr[o + 2] = pts[i].z;
        arr[o + 3] = pts[i + 1].x; arr[o + 4] = pts[i + 1].y; arr[o + 5] = pts[i + 1].z;
      }
    });
    axonGeo.attributes.position.needsUpdate = true;
    axonGeo.computeBoundingSphere();
  }
  applyPreset("wide");

  // ── Deep-space dust (depth cue for the parallax) ─────────────────────
  const dustPos = [];
  const dustRand = [];
  for (let i = 0; i < 650; i++) {
    dustPos.push((Math.random() - 0.5) * 110, (Math.random() - 0.5) * 70, -60 + Math.random() * 75);
    dustRand.push(Math.random());
  }
  const dustGeo = new BufferGeometry();
  dustGeo.setAttribute("position", new Float32BufferAttribute(dustPos, 3));
  dustGeo.setAttribute("aRand", new Float32BufferAttribute(dustRand, 1));
  const dustUniforms = { uTime: shared.uTime, uPR: shared.uPR, uFocus: { value: 1 } };
  scene.add(new Points(dustGeo, new ShaderMaterial({
    uniforms: dustUniforms,
    vertexShader: DUST_VERT,
    fragmentShader: DUST_FRAG,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  })));

  // ── Secret node (spaceship game) — fixed to a screen corner, not the map ─
  const secret = new Group();
  const secretMat = new LineBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.85 });
  const secretShape = new LineSegments(new EdgesGeometry(new OctahedronGeometry(0.42)), secretMat);
  secret.add(secretShape);
  scene.add(secret);
  const secretLabel = document.createElement("div");
  secretLabel.className = "cluster-label cluster-label--secret";
  secretLabel.innerHTML = `<span class="cluster-label__name">Explore</span>`;
  labelsEl.appendChild(secretLabel);

  // ── Card swarm: a region's neurons fly out and draw the section card ──
  const SWARM_MAX = 200;
  const SWARM_DEPTH = 12;     // camera-space distance of the card plane
  const swarmPos = new Float32Array(SWARM_MAX * 3);
  const swarmAlpha = new Float32Array(SWARM_MAX);
  const swarmGeo = new BufferGeometry();
  // BufferAttribute (not Float32BufferAttribute, which copies) — these arrays
  // are rewritten on the CPU every frame
  swarmGeo.setAttribute("position", new BufferAttribute(swarmPos, 3).setUsage(DynamicDrawUsage));
  swarmGeo.setAttribute("aAlpha", new BufferAttribute(swarmAlpha, 1).setUsage(DynamicDrawUsage));
  const swarmColor = { value: ACCENT.clone() };
  const swarmPoints = new Points(swarmGeo, new ShaderMaterial({
    uniforms: { uPR: shared.uPR, uColor: swarmColor },
    vertexShader: SWARM_VERT,
    fragmentShader: SWARM_FRAG,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: AdditiveBlending,
  }));
  const swarmLinePos = new Float32Array(SWARM_MAX * 6);
  const swarmLineAlpha = new Float32Array(SWARM_MAX * 2);
  const swarmLineGeo = new BufferGeometry();
  swarmLineGeo.setAttribute("position", new BufferAttribute(swarmLinePos, 3).setUsage(DynamicDrawUsage));
  swarmLineGeo.setAttribute("aAlpha", new BufferAttribute(swarmLineAlpha, 1).setUsage(DynamicDrawUsage));
  const swarmLines = new LineSegments(swarmLineGeo, new ShaderMaterial({
    uniforms: { uColor: swarmColor },
    vertexShader: SWARM_LINE_VERT,
    fragmentShader: SWARM_LINE_FRAG,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: AdditiveBlending,
  }));
  swarmPoints.frustumCulled = false;
  swarmLines.frustumCulled = false;
  swarmPoints.renderOrder = 10;
  swarmLines.renderOrder = 10;
  camera.add(swarmLines, swarmPoints);

  const swarm = {
    mode: "idle", // idle | toCard | card | toShape
    cluster: null,
    n: 0,
    t: 0,
    from: new Float32Array(SWARM_MAX * 3),
    to: new Float32Array(SWARM_MAX * 3),
    ctrl: new Float32Array(SWARM_MAX * 3),
    delay: new Float32Array(SWARM_MAX),
    pointOf: new Int32Array(SWARM_MAX), // swarm particle → cluster point index
    ring: new Int32Array(SWARM_MAX),    // particles in walk order around the card
    progress: new Float32Array(SWARM_MAX),
    rect: null,
  };
  const SWARM_FLIGHT = 0.72; // seconds per particle
  const SWARM_SPREAD = 0.3;  // stagger across the ring

  // Card building: particles burst out of the region, land on a grid over the
  // card and grow into tiles that form its surface; the DOM card (same colour)
  // fades in on top once the mosaic is complete. Breaking a card runs it
  // backwards: tiles shrink back into particles and get pulled into a region.
  const FILL_MAX = 1800;
  // Building a card: the region's particles fly to where each piece of the
  // card will be — every text line, every item's outline — landing right as
  // that piece appears, then fade out under it.
  const SK_PANEL_AT = 0.5;   // s after the build starts, the card begins to appear
  const SK_FLIGHT = 0.55;    // s, a particle's flight to its piece
  const SK_HOLD = 0.1;       // s, it lingers on the piece once landed…
  const SK_FADE = 0.35;      // s, …then fades as the real piece fades in
  const BREAK_DELAY = 0.22;  // s, DOM card fades off the mosaic first
  const COLLAPSE = 0.4;      // s, breaking wave across the card
  const BREAK_FLIGHT = 0.45; // s, a tile's flight into the region
  const SURFACE = new Color("#121214"); // = the DOM card's background over the page

  function createField() {
    const geo = new BufferGeometry();
    const f = {
      geo,
      mode: "idle", // idle | skeleton | break
      n: 0,
      t: 0,
      hold: 0,
      pos: new Float32Array(FILL_MAX * 3),
      size: new Float32Array(FILL_MAX),
      tile: new Float32Array(FILL_MAX),
      mix: new Float32Array(FILL_MAX),
      alpha: new Float32Array(FILL_MAX),
      rect: new Float32Array(FILL_MAX * 2),
      from: new Float32Array(FILL_MAX * 3),
      to: new Float32Array(FILL_MAX * 3),
      ctrl: new Float32Array(FILL_MAX * 3),
      start: new Float32Array(FILL_MAX),
      dur: new Float32Array(FILL_MAX),     // skeleton: per-particle flight time
      dot: new Float32Array(FILL_MAX),
      tileSize: new Float32Array(FILL_MAX),
      off: new Float32Array(FILL_MAX * 3), // per-particle offset around a live target
      target: null,                       // region the particles are pulled into
    };
    // BufferAttribute (no copy) — rewritten on the CPU every frame
    geo.setAttribute("position", new BufferAttribute(f.pos, 3).setUsage(DynamicDrawUsage));
    geo.setAttribute("aSize", new BufferAttribute(f.size, 1).setUsage(DynamicDrawUsage));
    geo.setAttribute("aTile", new BufferAttribute(f.tile, 1).setUsage(DynamicDrawUsage));
    geo.setAttribute("aMix", new BufferAttribute(f.mix, 1).setUsage(DynamicDrawUsage));
    geo.setAttribute("aAlpha", new BufferAttribute(f.alpha, 1).setUsage(DynamicDrawUsage));
    geo.setAttribute("aRect", new BufferAttribute(f.rect, 2).setUsage(DynamicDrawUsage));
    f.mesh = new Points(geo, new ShaderMaterial({
      uniforms: {
        uPR: shared.uPR,
        uGlow: { value: ACCENT.clone() },
        uInk: { value: INK.clone() },
        uSurface: { value: SURFACE.clone() },
      },
      vertexShader: FIELD_VERT,
      fragmentShader: FIELD_FRAG,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: NormalBlending, // tiles are an opaque surface, not light
    }));
    f.mesh.frustumCulled = false;
    f.mesh.renderOrder = 9; // over the map, under the card outline
    f.mesh.visible = false;
    camera.add(f.mesh);
    return f;
  }
  const buildField = createField();
  const breakField = createField();
  let pendingBuild = null; // { at, key, rect } — rebuild after a break
  let sceneTime = 0;

  // ── State ────────────────────────────────────────────────────────────
  let width = 1;
  let height = 1;
  let visible = true;
  let lastNow = 0;
  let introStart = -1;
  let activeKey = null;
  let hoverKey = null;
  let dimmed = false;
  let worldScale = 1;
  const pointer = { px: -999, py: -999, on: false }; // only drives the neurons' cursor field
  // Camera flight: opening a section flies the camera up to that region (a
  // random swing round it when the figure itself is clicked), closing pulls
  // back out to the overview. It never dives inside: the region dissolves and
  // its particles build the card instead.
  const HOME = new Vector3(0, 0, CAM_Z);
  const TOUR = 1.4;     // s, random swing around a region before its card builds
  const DIVE = 0.6;     // s, quick straight approach (opening from the nav menu)
  const VIEW_DIST = 2.6; // camera's resting distance from a region, in region radii
  const FLY_OUT = 0.9;  // s
  const cam = {
    mode: "idle",            // idle | fly (straight line) | tour (orbit path)
    pos: HOME.clone(),
    look: new Vector3(),     // point the camera is aimed at right now
    from: new Vector3(),
    to: HOME.clone(),
    lookFrom: new Vector3(),
    lookTo: new Vector3(),   // fixed aim point (when not framing a region)
    lookCluster: null,       // region to keep framed, if any
    curve: null,
    t: 1,
    dur: 1,
    warp: 0,
  };
  const tmpLook = new Vector3();
  const tmp = new Vector3();
  const tmp2 = new Vector3();
  const liveCentre = new Vector3();
  const secretScreen = { x: -999, y: -999 };

  function setLabels(map) {
    clusters.forEach(c => {
      c.label.querySelector(".cluster-label__name").textContent = map[c.key].name;
      c.labelW = 0;
    });
  }
  setLabels(labels);

  function worldPerPixel(distance) {
    return (2 * TAN_HALF_FOV * distance) / height;
  }

  // Fit the constellation into the free area right of the hero, picking the
  // arrangement (wide / tall) that can be drawn largest.
  function layout({ safeLeft = 0, safeTop = 0 } = {}) {
    const visH = 2 * TAN_HALF_FOV * CAM_Z;
    const visW = visH * (width / height);
    const unitsPerPx = visW / width;
    const leftEdge = -visW / 2 + (safeLeft + width * 0.03) * unitsPerPx;
    const rightEdge = visW / 2 - width * 0.035 * unitsPerPx;
    // leave room above the top shapes for their labels
    const topEdge = visH / 2 - (safeTop + 40 + height * 0.02) * unitsPerPx;
    const bottomEdge = -visH / 2 + height * 0.09 * unitsPerPx;

    const fit = b => Math.min((rightEdge - leftEdge) / (b.maxX - b.minX), (topEdge - bottomEdge) / (b.maxY - b.minY));
    const name = fit(PRESETS.tall.bounds) > fit(PRESETS.wide.bounds) * 1.12 ? "tall" : "wide";
    if (name !== presetName) applyPreset(name);
    const b = PRESETS[name].bounds;

    worldScale = Math.max(0.5, Math.min(1.2, fit(b)));
    world.scale.setScalar(worldScale);
    world.position.set(
      rightEdge - b.maxX * worldScale,
      (topEdge + bottomEdge) / 2 - ((b.maxY + b.minY) / 2) * worldScale,
      0
    );

    // Secret octahedron: bottom-right corner, on the z=0 plane
    secret.position.set(visW / 2 - 52 * unitsPerPx, -visH / 2 + 64 * unitsPerPx, 0);
    secret.scale.setScalar(Math.max(0.7, Math.min(1.2, worldScale)));

    // Smaller constellation → smaller neurons, so shapes stay airy instead of
    // clumping; when it is tight the labels drop to their index ("01") and
    // reveal the name on hover.
    const sizeK = Math.max(0.65, Math.min(1.15, worldScale / 0.85));
    clusters.forEach(c => {
      c.uniforms.uSize.value = 5.2 * sizeK;
      c.labelW = 0;
    });
    labelsEl.classList.toggle("is-compact", worldScale < 0.68);
  }

  function resize(w, h, safe) {
    width = Math.max(1, w);
    height = Math.max(1, h);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    shared.uAspect.value = camera.aspect;
    layout(safe);
  }

  function setPointer(x, y) {
    if (x === null || x === undefined) {
      pointer.on = false;
      return;
    }
    pointer.on = true;
    pointer.px = x;
    pointer.py = y;
  }

  function project(v) {
    tmp2.copy(v).project(camera);
    return { x: (tmp2.x + 1) * 0.5 * width, y: (1 - tmp2.y) * 0.5 * height, behind: tmp2.z > 1 };
  }

  function pick(x, y) {
    if (!visible || shared.uIntro.value < 0.6) return null;
    if (Math.hypot(x - secretScreen.x, y - secretScreen.y) < 38) return "secret";
    let best = null;
    let bestD = Infinity;
    clusters.forEach(c => {
      if (!c.screen.visible) return;
      const d = Math.hypot(x - c.screen.x, y - c.screen.y);
      if (d < Math.max(44, c.screen.r * 1.08) && d < bestD) {
        best = c.key;
        bestD = d;
      }
    });
    return best;
  }

  function setHover(key) {
    hoverKey = key;
  }

  // Click shockwave: every region rings, stronger and sooner near the click
  function ripple(x, y, strength = 0.28) {
    clusters.forEach(c => {
      if (c.hidden) return;
      const d = Math.hypot(x - c.screen.x, y - c.screen.y);
      const falloff = 1 - Math.min(1, d / Math.max(width, height)) * 0.6;
      c.burst.t = -d / 1600; // the wave travels outward from the click
      c.burst.amp = strength * falloff;
      c.spinBoost = Math.max(c.spinBoost, 2.4 * falloff * (strength / 0.28));
    });
  }

  // ── Card swarm helpers ───────────────────────────────────────────────
  // Screen px → camera space on the card plane
  function pxToCam(px, py, out) {
    const halfH = SWARM_DEPTH * TAN_HALF_FOV;
    out.set(((px / width) * 2 - 1) * halfH * camera.aspect, (1 - (py / height) * 2) * halfH, -SWARM_DEPTH);
    return out;
  }

  // Current camera-space position of a cluster's i-th neuron
  function neuronInCamera(c, i, out) {
    out.set(c.localPts[i * 3], c.localPts[i * 3 + 1], c.localPts[i * 3 + 2]);
    out.applyMatrix4(c.pointsMesh.matrixWorld).applyMatrix4(camera.matrixWorldInverse);
    return out;
  }

  // n evenly spaced points walking clockwise around the card's border
  function perimeterTargets(rect, n) {
    const w = rect.right - rect.left;
    const h = rect.bottom - rect.top;
    const total = 2 * (w + h);
    const out = [];
    for (let k = 0; k < n; k++) {
      let s = (k / n) * total;
      let px;
      let py;
      if (s < w) { px = rect.left + s; py = rect.top; }
      else if ((s -= w) < h) { px = rect.right; py = rect.top + s; }
      else if ((s -= h) < w) { px = rect.right - s; py = rect.bottom; }
      else { s -= w; px = rect.left; py = rect.bottom - s; }
      out.push(pxToCam(px, py, new Vector3()));
    }
    return out;
  }

  function startCardSwarm(c, rect) {
    camera.updateMatrixWorld();
    c.group.updateMatrixWorld(true);
    const n = Math.min(SWARM_MAX, c.localPts.length / 3);
    swarm.n = n;
    swarm.cluster = c;
    swarm.rect = rect;
    swarm.t = 0;
    swarm.mode = "toCard";

    // Current neuron positions, sorted by angle around the shape's centre…
    const from = [];
    const centre = new Vector3();
    for (let i = 0; i < n; i++) {
      const v = neuronInCamera(c, i, new Vector3());
      from.push(v);
      centre.add(v);
    }
    centre.multiplyScalar(1 / n);
    const order = from.map((v, i) => [i, Math.atan2(v.y - centre.y, v.x - centre.x)]).sort((a, b) => b[1] - a[1]);
    // …paired with border slots sorted the same way, so neighbours stay
    // neighbours and the outline unrolls instead of tangling.
    const targets = perimeterTargets(rect, n);
    const rc = pxToCam((rect.left + rect.right) / 2, (rect.top + rect.bottom) / 2, new Vector3());
    const slotOrder = targets.map((v, k) => [k, Math.atan2(v.y - rc.y, v.x - rc.x)]).sort((a, b) => b[1] - a[1]);

    for (let j = 0; j < n; j++) {
      const p = j; // swarm particle index
      const src = from[order[j][0]];
      const slot = slotOrder[j][0];
      const dst = targets[slot];
      swarm.pointOf[p] = order[j][0];
      swarm.ring[slot] = p;
      swarm.from.set([src.x, src.y, src.z], p * 3);
      swarm.to.set([dst.x, dst.y, dst.z], p * 3);
      const mid = src.clone().lerp(dst, 0.5);
      mid.x += (Math.random() - 0.5) * 3;
      mid.y += (Math.random() - 0.5) * 3;
      mid.z += 2 + Math.random() * 2;
      swarm.ctrl.set([mid.x, mid.y, mid.z], p * 3);
      // the border draws itself clockwise from the top-left corner
      swarm.delay[p] = (slot / n) * SWARM_SPREAD + Math.random() * 0.08;
    }
    c.hidden = true;
    c.uniforms.uFocus.value = 0; // hand-off: the swarm takes over this very frame
  }

  function startShapeSwarm() {
    if (swarm.mode === "idle" || !swarm.cluster) return;
    // fly from wherever the particles are right now back into the shape
    for (let p = 0; p < swarm.n; p++) {
      swarm.from[p * 3] = swarmPos[p * 3];
      swarm.from[p * 3 + 1] = swarmPos[p * 3 + 1];
      swarm.from[p * 3 + 2] = swarmPos[p * 3 + 2];
      swarm.delay[p] = Math.random() * 0.22;
    }
    swarm.t = 0;
    swarm.mode = "toShape";
  }

  function updateCard(rect) {
    if (!rect || !swarm.cluster || (swarm.mode !== "card" && swarm.mode !== "toCard")) return;
    swarm.rect = rect;
    const targets = perimeterTargets(rect, swarm.n);
    for (let slot = 0; slot < swarm.n; slot++) {
      const p = swarm.ring[slot];
      swarm.to.set([targets[slot].x, targets[slot].y, targets[slot].z], p * 3);
    }
  }

  // Camera-space centre of a region (where its particles burst from / fall into)
  function clusterInCamera(c, out) {
    c.group.updateMatrixWorld(true);
    c.group.getWorldPosition(out);
    return out.applyMatrix4(camera.matrixWorldInverse);
  }

  function randomInBall(centre, r, out) {
    const p = randomShellPoint(0, r);
    return out.set(centre.x + p[0], centre.y + p[1], centre.z + p[2]);
  }

  // Grid cells covering the card (no gaps: tiles must join into a surface)
  function cardCells(rect, ox, oy) {
    const w = rect.right - rect.left;
    const h = rect.bottom - rect.top;
    const spacing = Math.max(20, Math.min(44, Math.sqrt((w * h) / 1300)));
    const cols = Math.max(2, Math.round(w / spacing));
    let rows = Math.max(2, Math.round(h / spacing));
    while (cols * rows > FILL_MAX) rows--;
    const cw = w / cols;
    const ch = h / rows;
    const tile = Math.max(cw, ch) + 1.2; // a hair of overlap hides the seams
    const cells = [];
    for (let r = 0; r < rows; r++) {
      for (let q = 0; q < cols; q++) {
        const px = rect.left + (q + 0.5) * cw;
        const py = rect.top + (r + 0.5) * ch;
        cells.push({ px, py, d: Math.hypot(px - ox, py - oy) });
      }
    }
    const reach = Math.max(
      Math.hypot(rect.left - ox, rect.top - oy), Math.hypot(rect.right - ox, rect.top - oy),
      Math.hypot(rect.left - ox, rect.bottom - oy), Math.hypot(rect.right - ox, rect.bottom - oy)
    );
    return { cells, reach, tile, rx: (cw + 1.2) / tile, ry: (ch + 1.2) / tile };
  }

  // Screen-space targets for every piece of the card: dots along each text line
  // and around each item's outline, each tagged with when it should land.
  function skeletonTargets(skeleton) {
    const targets = [];
    skeleton.forEach(piece => {
      const land = SK_PANEL_AT + piece.d;
      piece.rects.forEach(rc => {
        const w = rc.right - rc.left;
        const h = rc.bottom - rc.top;
        if (w < 2 || h < 2) return;
        if (piece.kind === "text") {
          const rows = Math.max(1, Math.round(h / 18));
          for (let row = 0; row < rows; row++) {
            const py = rc.top + (h * (row + 0.5)) / rows;
            for (let px = rc.left + 3; px <= rc.right - 3; px += 9) targets.push({ px, py, land });
          }
        } else {
          const perimeter = 2 * (w + h);
          const n = Math.max(8, Math.round(perimeter / 12));
          for (let k = 0; k < n; k++) {
            let t = (k / n) * perimeter;
            let px;
            let py;
            if (t < w) { px = rc.left + t; py = rc.top; }
            else if ((t -= w) < h) { px = rc.right; py = rc.top + t; }
            else if ((t -= h) < w) { px = rc.right - t; py = rc.bottom; }
            else { t -= w; px = rc.left; py = rc.bottom - t; }
            targets.push({ px, py, land });
          }
        }
      });
    });
    // stay within the particle budget by thinning evenly
    if (targets.length <= FILL_MAX) return targets;
    const keep = FILL_MAX / targets.length;
    return targets.filter((_, i) => Math.floor(i * keep) !== Math.floor((i - 1) * keep));
  }

  // Region c dissolves: its particles fly out and build the card's pieces
  function buildSkeleton(c, skeleton) {
    camera.updateMatrixWorld();
    const f = buildField;
    const centre = clusterInCamera(c, new Vector3());
    const r = c.cfg.r * worldScale * 0.8;
    const targets = skeletonTargets(skeleton);
    f.n = targets.length;
    f.t = 0;
    f.mode = "skeleton";
    const src = new Vector3();
    const dst = new Vector3();
    targets.forEach((tg, i) => {
      randomInBall(centre, r, src);
      pxToCam(tg.px, tg.py, dst);
      f.from.set([src.x, src.y, src.z], i * 3);
      f.to.set([dst.x, dst.y, dst.z], i * 3);
      const mid = src.clone().lerp(dst, 0.5);
      mid.x += (Math.random() - 0.5) * 2;
      mid.y += (Math.random() - 0.5) * 2;
      mid.z += 0.5 + Math.random() * 1.5;
      f.ctrl.set([mid.x, mid.y, mid.z], i * 3);
      // leave the region so as to land exactly when the piece appears
      f.start[i] = Math.max(0, tg.land - SK_FLIGHT - Math.random() * 0.12);
      f.dur[i] = Math.max(0.2, tg.land - f.start[i]);
      f.dot[i] = 2.2 + Math.random() * 1.6;
      f.tileSize[i] = f.dot[i];
      f.rect[i * 2] = 1;
      f.rect[i * 2 + 1] = 1;
    });
  }

  // The card (as a solid mosaic) breaks from its far edge inward into region c
  function breakCard(c, rect) {
    camera.updateMatrixWorld();
    const f = breakField;
    buildField.mode = "idle"; // whatever was still assembling is now this mosaic
    const ox = c.screen.x;
    const oy = c.screen.y;
    const centre = clusterInCamera(c, new Vector3());
    const r = c.cfg.r * worldScale * 0.6;
    const { cells, reach, tile, rx, ry } = cardCells(rect, ox, oy);
    f.n = cells.length;
    f.t = 0;
    f.mode = "break";
    const src = new Vector3();
    const dst = new Vector3();
    f.target = c;
    cells.forEach((cell, i) => {
      pxToCam(cell.px, cell.py, src);
      randomInBall(centre, r, dst);
      f.off.set([dst.x - centre.x, dst.y - centre.y, dst.z - centre.z], i * 3);
      f.from.set([src.x, src.y, src.z], i * 3);
      f.to.set([dst.x, dst.y, dst.z], i * 3);
      const mid = src.clone().lerp(dst, 0.45);
      mid.x += (Math.random() - 0.5) * 1.6;
      mid.y += (Math.random() - 0.5) * 1.6;
      mid.z += 0.5 + Math.random();
      f.ctrl.set([mid.x, mid.y, mid.z], i * 3);
      f.start[i] = BREAK_DELAY + (1 - cell.d / reach) * COLLAPSE + Math.random() * 0.05;
      f.dot[i] = 3 + Math.random() * 3;
      f.tileSize[i] = tile;
      f.rect[i * 2] = rx;
      f.rect[i * 2 + 1] = ry;
    });
  }

  function startBuild(c, rect, skeleton) {
    const ox = c.screen.x;
    const oy = c.screen.y;
    startCardSwarm(c, rect); // the region's own neurons draw the card's outline
    buildSkeleton(c, skeleton || []);
    c.burst.t = 0;
    c.burst.amp = 0.3;
    ripple(ox, oy, 0.2);
  }

  function clusterWorld(c, out) {
    c.group.updateMatrixWorld(true);
    return c.group.getWorldPosition(out);
  }

  // Straight flight; aim either at a region (kept framed) or straight ahead
  function flyTo(target, dur, delay = 0, warp = 10, lookCluster = null) {
    cam.mode = "fly";
    cam.from.copy(cam.pos);
    cam.to.copy(target);
    cam.lookFrom.copy(cam.look);
    cam.lookCluster = lookCluster;
    if (!lookCluster) cam.lookTo.set(target.x, target.y, target.z - 30);
    cam.t = -delay;
    cam.dur = dur;
    cam.warp = warp;
  }

  // One random swing around region c — from the side facing you, arcing over
  // OR under it (coin flip) and round to one side (coin flip) — ending at a
  // viewing distance with the region in full view. Every click draws a new
  // path; the camera keeps the region framed while the rest slides past.
  function tourAround(c) {
    const C = clusterWorld(c, new Vector3());
    const r = c.cfg.r * worldScale;
    const deg = Math.PI / 180;
    const jitter = d => (Math.random() - 0.5) * 2 * d * deg;
    const a0 = jitter(30);                          // start on the side facing the viewer
    const turn = Math.random() < 0.5 ? -1 : 1;      // swing left or right
    const up = Math.random() < 0.5 ? -1 : 1;        // arc over or under
    const sweep = 80 * deg + Math.random() * 50 * deg;
    const sph = (el, az, dist) => new Vector3(
      C.x + dist * Math.cos(el) * Math.sin(az),
      C.y + dist * Math.sin(el),
      C.z + dist * Math.cos(el) * Math.cos(az)
    );
    cam.curve = new CatmullRomCurve3([
      cam.pos.clone(),
      sph(up * (35 * deg + jitter(10)), a0 + turn * sweep * 0.5, r * 3.4), // over / under
      sph(up * (12 * deg + jitter(6)), a0 + turn * sweep, r * VIEW_DIST),  // rest, in full view
    ], false, "centripetal");
    cam.mode = "tour";
    cam.lookFrom.copy(cam.look);
    cam.lookCluster = c;
    cam.t = 0;
    cam.dur = TOUR;
    cam.warp = 5;
  }

  // In front of a region, at viewing distance
  function viewPoint(c, out) {
    clusterWorld(c, out);
    out.z += c.cfg.r * worldScale * VIEW_DIST;
    return out;
  }

  // Opens / switches / closes a section. The camera flies up to the region,
  // which then dissolves into the particles that build the card's pieces
  // (skeleton: [{ kind: "text"|"box", rects: [{left,top,right,bottom}], d }],
  // d = seconds after the card appears that the piece fades in).
  // Returns { enterAt }: seconds until the engine should bring the card in.
  // null = nothing to do.
  function setActive(key, rect, { tour = false, skeleton = null } = {}) {
    const prev = activeKey;
    activeKey = key;
    pendingBuild = null;

    if (!key) {
      // the card falls apart back into the region around us, then we pull out
      const c = prev ? byKey[prev] : null;
      if (c && rect) breakCard(c, rect);
      startShapeSwarm();
      flyTo(HOME, FLY_OUT, BREAK_DELAY + COLLAPSE * 0.5, 8); // aim straight ahead again
      return { enterAt: 0 };
    }

    const c = byKey[key];
    if (!c || !rect) return null;
    if (prev === key && swarm.mode === "card") return null;

    if (prev && prev !== key) {
      // Switching while a card is open: the card simply re-opens with the new
      // content (no second mosaic / card layered over the first). Behind it
      // the old region's neurons go home and the camera glides into the new
      // region, so closing later pulls out of the right one.
      buildField.mode = "idle";
      breakField.mode = "idle";
      startShapeSwarm();
      flyTo(viewPoint(c, new Vector3()), 0.8, 0, 0, c);
      return { enterAt: 0 };
    }

    // Clicking the figure itself swings the camera round it first; opening from
    // the nav menu is a quick straight approach. Then the region builds the card.
    let buildAt;
    if (tour) {
      tourAround(c);
      buildAt = TOUR * 0.82;
    } else {
      flyTo(viewPoint(c, new Vector3()), DIVE, 0, 8, c);
      buildAt = DIVE * 0.6;
    }
    ripple(c.screen.x, c.screen.y, 0.2); // the others shudder as we set off
    pendingBuild = { at: sceneTime + buildAt, key, rect, skeleton };
    return { enterAt: buildAt + SK_PANEL_AT };
  }

  function updateField(f, dt) {
    if (f.mode === "idle") {
      f.mesh.visible = false;
      return;
    }
    f.mesh.visible = true;
    f.t += dt;
    let busy = 0;
    const chase = f.mode === "break" && f.target;
    if (chase) clusterInCamera(f.target, liveCentre);
    for (let i = 0; i < f.n; i++) {
      const o = i * 3;
      if (chase) {
        // the camera is flying, so aim at where the region is right now
        f.to[o] = liveCentre.x + f.off[o];
        f.to[o + 1] = liveCentre.y + f.off[o + 1];
        f.to[o + 2] = liveCentre.z + f.off[o + 2];
      }
      let e = 0;
      let size = f.dot[i];
      let tile = 0;
      let mix = 0;
      let alpha = 0;
      if (f.mode === "skeleton") {
        const k = (f.t - f.start[i]) / f.dur[i];
        if (k <= 0) {
          busy++; // still part of the region, waiting its turn
        } else if (k < 1) {
          busy++;
          e = easeOutCubic(k);
          alpha = smoothstepJs(0, 0.2, k);
        } else {
          // landed on its piece: linger, then fade as the real piece appears
          const after = (k - 1) * f.dur[i];
          e = 1;
          alpha = 1 - smoothstepJs(SK_HOLD, SK_HOLD + SK_FADE, after);
          if (after < SK_HOLD + SK_FADE) busy++;
        }
      } else {
        // break: solid tile until released, then shrinks to a dot and is pulled in
        const k = (f.t - f.start[i]) / BREAK_FLIGHT;
        if (k <= 0) {
          busy++;
          size = f.tileSize[i];
          tile = 1;
          mix = 1;
          alpha = 1;
        } else if (k < 1) {
          busy++;
          const sh = smoothstepJs(0, 0.3, k);
          e = easeInCubic(k);
          size = f.tileSize[i] + (f.dot[i] - f.tileSize[i]) * sh;
          tile = 1 - sh;
          mix = 1 - sh;
          alpha = 1 - smoothstepJs(0.7, 1, k);
        }
      }
      const u = 1 - e;
      f.pos[o] = u * u * f.from[o] + 2 * u * e * f.ctrl[o] + e * e * f.to[o];
      f.pos[o + 1] = u * u * f.from[o + 1] + 2 * u * e * f.ctrl[o + 1] + e * e * f.to[o + 1];
      f.pos[o + 2] = u * u * f.from[o + 2] + 2 * u * e * f.ctrl[o + 2] + e * e * f.to[o + 2];
      f.size[i] = size;
      f.tile[i] = tile;
      f.mix[i] = mix;
      f.alpha[i] = alpha;
    }
    f.geo.setDrawRange(0, f.n);
    ["position", "aSize", "aTile", "aMix", "aAlpha", "aRect"].forEach(name => {
      f.geo.attributes[name].needsUpdate = true;
    });
    if (!busy) f.mode = "idle";
  }

  function updateFields(dt) {
    updateField(buildField, dt);
    updateField(breakField, dt);
  }

  function setDim(on) {
    dimmed = on;
  }

  function setVisible(on) {
    visible = on;
    canvas.style.visibility = on ? "visible" : "hidden";
    labelsEl.style.visibility = on ? "visible" : "hidden";
  }

  function updateSwarm(dt, t) {
    if (swarm.mode === "idle") {
      swarmPoints.visible = false;
      swarmLines.visible = false;
      return;
    }
    swarmPoints.visible = true;
    swarmLines.visible = true;
    swarm.t += dt;
    const c = swarm.cluster;
    let done = 0;
    const flight = SWARM_FLIGHT;
    for (let p = 0; p < swarm.n; p++) {
      const k = Math.min(1, Math.max(0, (swarm.t - swarm.delay[p]) / flight));
      const e = easeInOutCubic(k);
      swarm.progress[p] = e;
      if (k >= 1) done++;
      let x;
      let y;
      let z;
      if (swarm.mode === "card") {
        // settled on the border: a faint shimmer keeps it alive
        x = swarm.to[p * 3] + Math.sin(t * 2 + p) * 0.012;
        y = swarm.to[p * 3 + 1] + Math.cos(t * 1.7 + p * 1.3) * 0.012;
        z = swarm.to[p * 3 + 2];
        swarmAlpha[p] = damp(swarmAlpha[p], 0.55 + Math.sin(t * 3 + p * 0.7) * 0.25, 4, dt);
      } else {
        let dx;
        let dy;
        let dz;
        if (swarm.mode === "toShape") {
          // the shape keeps turning, so chase the neuron's live position
          c.group.updateMatrixWorld(true);
          neuronInCamera(c, swarm.pointOf[p], tmp);
          dx = tmp.x; dy = tmp.y; dz = tmp.z;
        } else {
          dx = swarm.to[p * 3]; dy = swarm.to[p * 3 + 1]; dz = swarm.to[p * 3 + 2];
        }
        const fx = swarm.from[p * 3];
        const fy = swarm.from[p * 3 + 1];
        const fz = swarm.from[p * 3 + 2];
        // bezier on the way out; a straight return reads as being pulled home
        if (swarm.mode === "toCard") {
          const cx = swarm.ctrl[p * 3];
          const cy = swarm.ctrl[p * 3 + 1];
          const cz = swarm.ctrl[p * 3 + 2];
          const u = 1 - e;
          x = u * u * fx + 2 * u * e * cx + e * e * dx;
          y = u * u * fy + 2 * u * e * cy + e * e * dy;
          z = u * u * fz + 2 * u * e * cz + e * e * dz;
          swarmAlpha[p] = 1;
        } else {
          x = fx + (dx - fx) * e;
          y = fy + (dy - fy) * e;
          z = fz + (dz - fz) * e;
          swarmAlpha[p] = 1 - smoothstepJs(0.75, 1, e);
        }
      }
      swarmPos[p * 3] = x;
      swarmPos[p * 3 + 1] = y;
      swarmPos[p * 3 + 2] = z;
    }

    // Threads between ring neighbours tighten into the card outline
    for (let slot = 0; slot < swarm.n; slot++) {
      const a = swarm.ring[slot];
      const b = swarm.ring[(slot + 1) % swarm.n];
      swarmLinePos.set([swarmPos[a * 3], swarmPos[a * 3 + 1], swarmPos[a * 3 + 2], swarmPos[b * 3], swarmPos[b * 3 + 1], swarmPos[b * 3 + 2]], slot * 6);
      // A thread only lights once both ends have (nearly) landed, so the border
      // reads as one line being drawn; on the way home they let go at once.
      let alpha;
      if (swarm.mode === "toShape") alpha = (1 - smoothstepJs(0, 0.18, swarm.t)) * 0.32;
      else if (swarm.mode === "card") alpha = 0.32;
      else alpha = smoothstepJs(0.8, 1, Math.min(swarm.progress[a], swarm.progress[b])) * 0.45;
      swarmLineAlpha[slot * 2] = alpha;
      swarmLineAlpha[slot * 2 + 1] = alpha;
    }
    for (let i = swarm.n; i < SWARM_MAX; i++) swarmAlpha[i] = 0;
    swarmGeo.setDrawRange(0, swarm.n);
    swarmLineGeo.setDrawRange(0, swarm.n * 2);
    swarmGeo.attributes.position.needsUpdate = true;
    swarmGeo.attributes.aAlpha.needsUpdate = true;
    swarmLineGeo.attributes.position.needsUpdate = true;
    swarmLineGeo.attributes.aAlpha.needsUpdate = true;

    if (swarm.mode === "toCard" && done === swarm.n) swarm.mode = "card";
    if (swarm.mode === "toShape") {
      if (done > swarm.n * 0.8) c.hidden = false; // shape fades back in as the last ones land
      if (done === swarm.n) {
        swarm.mode = "idle";
        swarm.cluster = null;
      }
    }
  }

  function frame(now) {
    if (!visible) {
      lastNow = now;
      return;
    }
    const dt = Math.min(0.05, lastNow ? (now - lastNow) / 1000 : 0.016);
    lastNow = now;
    if (introStart < 0) introStart = now;
    const t = now / 1000;
    shared.uTime.value = t;
    if (shared.uIntro.value < 1) {
      shared.uIntro.value = Math.min(1, (now - introStart) / 1000 / INTRO_SECONDS);
    }
    const intro = shared.uIntro.value;
    const motion = 1;

    // A slow ambient drift of the whole map. The shapes do NOT follow the
    // cursor: turning toward it left them edge-on (hard to read) whenever the
    // mouse sat to one side.
    const lean = activeKey ? 0.3 : 1;
    tilt.rotation.y = Math.sin(t * 0.07) * 0.04 * motion * lean;
    tilt.rotation.x = Math.cos(t * 0.05) * 0.02 * motion * lean;

    // Cursor force field (NDC, smoothed so the "hole" glides behind the mouse)
    const mx = (pointer.px / width) * 2 - 1;
    const my = 1 - (pointer.py / height) * 2;
    shared.uMouse.value.x = damp(shared.uMouse.value.x, mx, 10, dt);
    shared.uMouse.value.y = damp(shared.uMouse.value.y, my, 10, dt);
    shared.uMouseOn.value = damp(shared.uMouseOn.value, pointer.on && !activeKey && !dimmed ? motion : 0, 4, dt);

    // Camera: straight flight or orbit tour, with a little FOV "warp" mid-move
    let fov = FOV;
    if (cam.mode !== "idle" && cam.t < cam.dur) {
      cam.t += dt;
      const k = Math.min(1, Math.max(0, cam.t / cam.dur));
      const e = easeInOutCubic(k);
      if (cam.mode === "tour") {
        cam.curve.getPoint(e, cam.pos);
      } else {
        cam.pos.lerpVectors(cam.from, cam.to, e);
      }
      fov = FOV + cam.warp * Math.sin(Math.PI * k);
      // turn smoothly from the old aim point to the new one
      const aim = cam.lookCluster ? clusterWorld(cam.lookCluster, tmpLook) : cam.lookTo;
      cam.look.lerpVectors(cam.lookFrom, aim, smoothstepJs(0, cam.mode === "tour" ? 0.18 : 0.6, k));
    } else if (cam.lookCluster) {
      clusterWorld(cam.lookCluster, cam.look); // keep the region framed
    } else {
      cam.look.copy(cam.lookTo);
    }
    camera.position.copy(cam.pos);
    camera.lookAt(cam.look);
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }

    const focusAll = dimmed ? 0.3 : 1;
    clusters.forEach(c => {
      const isHover = c.key === hoverKey && !activeKey;
      const isActive = c.key === activeKey;
      c.hover = damp(c.hover, isHover ? 1 : 0, 7, dt);
      c.uniforms.uHover.value = c.hover;
      c.uniforms.uActive.value = damp(c.uniforms.uActive.value, isActive ? 1 : 0, 4, dt);
      const focus = c.hidden ? 0 : (activeKey && !isActive ? 0.18 : 1) * focusAll;
      c.uniforms.uFocus.value = damp(c.uniforms.uFocus.value, focus, c.hidden ? 30 : 5, dt);

      // The icon's own motion (livelier on hover / after a shockwave)
      c.spinBoost = damp(c.spinBoost, 0, 1.6, dt);
      const m = c.cfg.motion;
      c.phase += dt * Math.abs(m.speed) * motion * (1 + c.hover * 2.5 + c.spinBoost * 4);
      if (m.type === "spin") {
        c.spinner.rotation.set(0, 0, 0);
        c.spinner.rotation[m.axis] = c.phase * Math.sign(m.speed);
      } else {
        c.spinner.rotation.set(0, m.amp * Math.sin(c.phase), 0);
      }
      c.body.rotation.set(c.base[0], c.base[1], c.base[2]);

      // Shockwave: a damped "bell" oscillation after the wave reaches the shape
      c.burst.t += dt;
      c.uniforms.uBurst.value = c.burst.t > 0 && c.burst.amp > 0
        ? c.burst.amp * Math.exp(-2.6 * c.burst.t) * Math.sin(11 * c.burst.t)
        : 0;

      c.group.getWorldPosition(tmp);
      const s = project(tmp);
      const dist = camera.position.distanceTo(tmp);
      c.screen.x = s.x;
      c.screen.y = s.y;
      c.screen.r = (c.cfg.r * worldScale * (1 + c.hover * 0.09)) / worldPerPixel(dist);
      c.screen.visible = !s.behind && !activeKey && !dimmed;
    });

    // Labels: measure first (no layout thrash), then position
    clusters.forEach(c => {
      if (!c.labelW) c.labelW = c.label.offsetWidth + 36; // + room for the hover arrow
    });
    // Each label rides just above its shape, nudged left only as far as needed
    // to stay on screen; a label that would collide with one already placed
    // steps up above it.
    const placed = [];
    clusters
      .map(c => ({ c, x: Math.min(c.screen.x + c.screen.r * 0.3, width - 16 - c.labelW), y: c.screen.y - c.screen.r * 1.08 - 16 }))
      .sort((a, b) => b.y - a.y)
      .forEach(l => {
        for (const o of placed) {
          const overlapX = l.x < o.x + o.c.labelW + 8 && l.x + l.c.labelW + 8 > o.x;
          if (overlapX && Math.abs(l.y - o.y) < 20) l.y = o.y - 22;
        }
        placed.push(l);
        const c = l.c;
        c.label.classList.toggle("is-visible", c.screen.visible && intro > 0.85);
        c.label.classList.toggle("is-hover", c.key === hoverKey && !activeKey);
        c.label.style.transform = `translate3d(${l.x.toFixed(1)}px, ${l.y.toFixed(1)}px, 0)`;
      });

    axonUniforms.uAlpha.value = smoothstepJs(0.7, 1, intro) * 0.11 * (activeKey ? 0.3 : 1) * focusAll;
    pulseUniforms.uAlpha.value = smoothstepJs(0.85, 1, intro) * (activeKey ? 0.3 : 1) * focusAll;
    dustUniforms.uFocus.value = dimmed ? 0.5 : 1;

    const pPos = pulseGeo.attributes.position.array;
    const pHot = pulseGeo.attributes.aHot.array;
    pulses.forEach((p, i) => {
      p.t = (p.t + dt * p.speed * motion * p.dir + 1) % 1;
      p.axon.curve.getPoint(p.t, tmp);
      pPos[i * 3] = tmp.x;
      pPos[i * 3 + 1] = tmp.y;
      pPos[i * 3 + 2] = tmp.z;
      pHot[i] = hoverKey && !activeKey && (p.axon.a === hoverKey || p.axon.b === hoverKey) ? 1 : 0;
    });
    pulseGeo.attributes.position.needsUpdate = true;
    pulseGeo.attributes.aHot.needsUpdate = true;

    secretShape.rotation.x += dt * 0.6 * motion;
    secretShape.rotation.y += dt * 0.9 * motion;
    secretMat.opacity = (0.55 + Math.sin(t * 3) * 0.25) * smoothstepJs(0.6, 1, intro) * (activeKey ? 0 : 1);
    secret.getWorldPosition(tmp);
    const ss = project(tmp);
    secretScreen.x = activeKey ? -999 : ss.x;
    secretScreen.y = activeKey ? -999 : ss.y;
    secretLabel.classList.toggle("is-visible", hoverKey === "secret" && !dimmed);
    secretLabel.style.transform = `translate3d(${(ss.x - 86).toFixed(1)}px, ${(ss.y - 34).toFixed(1)}px, 0)`;

    // matrices must be current before the swarm reads neuron positions
    scene.updateMatrixWorld();
    sceneTime += dt;
    if (pendingBuild && sceneTime >= pendingBuild.at) {
      const pending = pendingBuild;
      pendingBuild = null;
      const c = byKey[pending.key];
      if (c && activeKey === c.key) startBuild(c, pending.rect, pending.skeleton);
    }
    updateSwarm(dt, t);
    updateFields(dt);

    renderer.render(scene, camera);
  }

  // Screen-space cluster positions (layout tests / ?debug=1)
  function screens() {
    return clusters.map(c => ({ key: c.key, x: c.screen.x, y: c.screen.y, r: c.screen.r }))
      .concat([{ key: "secret", x: secretScreen.x, y: secretScreen.y, r: 0 }]);
  }

  return { resize, layout, setPointer, pick, setHover, setActive, updateCard, ripple, setDim, setVisible, setLabels, frame, screens };
}
