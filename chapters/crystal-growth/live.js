const D = __DATA__;
const root = document.querySelector(".cz");
const stage = root.querySelector(".cz-stage");
const layers = stage.querySelector(".cz-layers");
const live = root.querySelector("[data-live]");
const readout = root.querySelector("[data-readout]");
const partButtons = [...root.querySelectorAll(".cz-part")];
const scrubInput = root.querySelector("[data-scrub]");
const playButton = root.querySelector("[data-play]");
const playText = root.querySelector("[data-play-text]");
const stepText = root.querySelector("[data-step]");
const meltLayer = layers.querySelector('[data-layer="melt"]');
const crystalLayer = layers.querySelector('[data-layer="crystal"]');
const chunkLayers = [...layers.querySelectorAll(".cz-chunks")].map((g) => ({ g, z: Number(g.dataset.chunk), shown: "" }));
const still = matchMedia("(prefers-reduced-motion: reduce)");
const SVGNS = "http://www.w3.org/2000/svg";
const DEG = Math.PI / 180;

// ---- projection, the kit's camera ----
const iso = (p) => [D.O[0] + p[0] * D.EX[0] + p[1] * D.EY[0] + p[2] * D.EZ[0], D.O[1] + p[0] * D.EX[1] + p[1] * D.EY[1] + p[2] * D.EZ[1]];
const f1 = (v) => (Math.round(v * 10) / 10).toString();
const pathOf = (pts, closed) => pts.map((p, i) => `${i ? "L" : "M"}${f1(p[0])} ${f1(p[1])}`).join("") + (closed ? "Z" : "");
const P3 = (r, deg, z) => [r * Math.cos(deg * DEG), r * Math.sin(deg * DEG), z];
const isoAt = (r, deg, z) => iso(P3(r, deg, z));
const BANDS = [0, 0.2, 0.42, 0.62];
const bandOf = (score) => {
  let tone = 0;
  while (tone < BANDS.length && score >= BANDS[tone]) tone++;
  return tone;
};
const unit = (v) => {
  const l = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / l, v[1] / l, v[2] / l];
};
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const ease = (t) => t * t * (3 - 2 * t);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const tanE = Math.tan(D.el * DEG);
const cosE = Math.cos(D.el * DEG);
const sinE = Math.sin(D.el * DEG);

// ---- the painter's order with moving pieces ----
const nodes = [...layers.querySelectorAll(".it")].map((el) => ({
  el,
  part: el.dataset.part,
  piece: el.dataset.piece,
  key: Number(el.dataset.k),
  lift: Number(el.dataset.l),
  m: el.dataset.m.split(",").map(Number),
  hold: el.querySelector("[data-hold]"),
  melt: !!el.querySelector('[data-layer="melt"]'),
  shown: "",
}));
let order = nodes.map((_, i) => i);
const share = { fixed: 0, crucible: 0, gate: 0 };
let meltFirst = false; // while the charge melts, the pool lies under the chunks
const chunkKey = Math.min(...[...layers.querySelectorAll(".cz-chunks")].map((g) => Number(g.closest(".it").dataset.k)));
// while melting, the pool sits just under the first chunk layer and above everything drawn before it (the crucible floor)
const belowChunks = Math.max(...nodes.filter((node) => !node.melt && node.key < chunkKey).map((node) => node.key));
const meltKey = (belowChunks + chunkKey) / 2;
const keyOf = (node) => (node.melt && meltFirst ? meltKey : node.key + node.lift * (share[node.piece] || 0));

function place() {
  for (const node of nodes) {
    const s = share[node.piece] || 0;
    const tx = (D.EX[0] * node.m[0] + D.EY[0] * node.m[1] + D.EZ[0] * node.m[2]) * s;
    const ty = (D.EX[1] * node.m[0] + D.EY[1] * node.m[1] + D.EZ[1] * node.m[2]) * s;
    const text = s === 0 ? "" : `translate(${tx.toFixed(2)} ${ty.toFixed(2)})`;
    if (text !== node.shown) {
      node.shown = text;
      if (text) node.el.setAttribute("transform", text);
      else node.el.removeAttribute("transform");
      if (node.hold) {
        if (text) node.hold.setAttribute("transform", `translate(${(-tx).toFixed(2)} ${(-ty).toFixed(2)})`);
        else node.hold.removeAttribute("transform");
      }
    }
  }
  const next = nodes.map((_, i) => i).sort((a, b) => keyOf(nodes[a]) - keyOf(nodes[b]));
  if (next.some((index, at) => index !== order[at])) {
    const fragment = document.createDocumentFragment();
    for (const index of next) fragment.appendChild(nodes[index].el);
    layers.appendChild(fragment);
    order = next;
  }
}

// ---- the process: slider position to machine state ----
const BOUNDS = [];
{
  let acc = 0;
  const total = D.span.reduce((a, b) => a + b, 0);
  for (const s of D.span) {
    BOUNDS.push([acc / total, (acc + s) / total]);
    acc += s;
  }
}
const phaseOf = (p) => {
  for (let i = 0; i < BOUNDS.length; i++) if (p < BOUNDS[i][1] || i === BOUNDS.length - 1) return { i, t: clamp((p - BOUNDS[i][0]) / (BOUNDS[i][1] - BOUNDS[i][0])) };
  return { i: 0, t: 0 };
};
const SEG = D.seg;
const GROWN = D.grown;
const massAt = (g) => {
  const x = clamp(g / GROWN) * 100;
  const i = Math.min(99, Math.floor(x));
  return D.massTable[i] + (D.massTable[i + 1] - D.massTable[i]) * (x - i);
};

function stateAt(p) {
  const { i, t } = phaseOf(p);
  const s = { phase: i, t, melted: 1, dip: 0, grown: 0, out: 0, gate: 0, heat: 0.8 };
  if (i === 0) {
    s.melted = ease(clamp(t / 0.92));
    s.dip = 1;
    s.heat = 1;
  } else if (i === 1) s.dip = 1 - ease(clamp(t / 0.85));
  else if (i === 2) s.grown = t * SEG.neck;
  else if (i === 3) s.grown = SEG.neck + ease(t) * SEG.shoulder;
  else if (i === 4) s.grown = SEG.neck + SEG.shoulder + t * SEG.body;
  else if (i === 5) s.grown = SEG.neck + SEG.shoulder + SEG.body + t * SEG.tail;
  if (i >= 6) {
    s.grown = GROWN;
    s.out = ease(clamp(t / 0.62));
    s.gate = ease(clamp((t - 0.62) / 0.3));
    s.heat = 0.8 * (1 - ease(clamp(t / 0.9)));
  }
  s.kg = massAt(s.grown);
  const left = D.kg.charge - s.kg;
  const depth = (D.depth0 * left) / D.kg.charge;
  s.lift = clamp((D.depth0 - depth) / D.lift);
  return s;
}

// ---- drawing the melt ----
let spinCrystal = 0;
let spinCrucible = 0;
const el = (tag, attrs) => {
  const node = document.createElementNS(SVGNS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
};
const meltParts = {
  side: el("path", { class: "cz-melt-side" }),
  top: el("path", { class: "cz-melt-top" }),
  edge: el("path", { class: "iso-line iso-edge", "data-tone": "lo" }),
  ring: el("path", { class: "cz-meniscus" }),
  marks: el("g", { class: "iso-dots" }),
};
for (const part of Object.values(meltParts)) meltLayer.appendChild(part);
const markDots = Array.from({ length: 6 }, () => {
  const c = el("circle", { r: "0.6" });
  meltParts.marks.appendChild(c);
  return c;
});

function arc(r, z, a0, a1, step = 4) {
  const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) / step));
  return Array.from({ length: n + 1 }, (_, i) => isoAt(r, a0 + ((a1 - a0) * i) / n, z));
}

function drawMelt(s, interfaceR) {
  const lifted = s.lift * D.lift;
  const floor = D.cruFloor + lifted;
  const top = s.phase === 0 ? D.cruFloor + Math.max(0.01, D.depth0 * s.melted) : D.melt;
  const r = D.cruIn;
  const show = s.phase > 0 || s.melted > 0.002;
  const vis = show ? "" : "none";
  for (const part of [meltParts.side, meltParts.top, meltParts.edge]) part.style.display = vis;
  if (!show) {
    meltParts.ring.style.display = "none";
    return;
  }
  const faceA = [iso([0, 0, floor]), iso([0, r, floor]), iso([0, r, top]), iso([0, 0, top])];
  const faceB = [iso([0, 0, floor]), iso([r, 0, floor]), iso([r, 0, top]), iso([0, 0, top])];
  meltParts.side.setAttribute("d", pathOf(faceA, true) + pathOf(faceB, true));
  const surface = [iso([0, 0, top]), ...arc(r, top, 90, 360)];
  meltParts.top.setAttribute("d", pathOf(surface, true));
  meltParts.edge.setAttribute("d", pathOf([iso([0, r, top]), iso([0, 0, top]), iso([r, 0, top])]) + pathOf([iso([0, 0, top]), iso([0, 0, floor])]));
  if (interfaceR > 0) {
    meltParts.ring.style.display = "";
    meltParts.ring.setAttribute("d", pathOf(arc(interfaceR + 0.9, D.melt, 0, 360, 6), true));
  } else meltParts.ring.style.display = "none";
  // marks on the crucible rim, turning with it
  const rim = D.cruFloor + 56 + lifted;
  markDots.forEach((dotEl, index) => {
    const deg = spinCrucible + index * 60;
    const a = ((deg % 360) + 360) % 360;
    const seen = a > 140 && a < 310;
    const [x, y] = isoAt(D.cruIn + 1, a, rim);
    dotEl.setAttribute("cx", f1(x));
    dotEl.setAttribute("cy", f1(y));
    dotEl.style.display = seen ? "" : "none";
  });
}

// ---- drawing the crystal: a turned body shaded like the kit's lathe ----
const crystalParts = {
  cable: el("path", { class: "cz-cable" }),
  body: el("g", { class: "iso-solid cz-ingot", "data-seamless": "" }),
  ridges: el("g", {}),
  edge: el("path", { class: "iso-line iso-edge", "data-tone": "lit" }),
  chuck: el("g", { class: "iso-solid", "data-seamless": "" }),
  chuckEdge: el("path", { class: "iso-line iso-edge", "data-tone": "mid" }),
  key: el("path", { class: "iso-line", "data-tone": "lo" }),
};
for (const part of Object.values(crystalParts)) crystalLayer.appendChild(part);
const tonePaths = (group) => {
  const list = [0, 1, 2, 3, 4].map((tone) => {
    const path = el("path", tone === 4 ? { class: "iso-top" } : { class: "iso-shade", "data-shade": String(tone) });
    group.appendChild(path);
    return path;
  });
  return list;
};
const bodyTones = tonePaths(crystalParts.body);
const chuckTones = tonePaths(crystalParts.chuck);

function rDraw(s) {
  const seed = SEG.seed;
  if (s <= seed) return D.draw.seed;
  if (s <= seed + SEG.neck) return D.draw.neck;
  if (s <= seed + SEG.neck + SEG.shoulder) return D.draw.neck + (D.draw.body - D.draw.neck) * Math.sin((Math.PI / 2) * ((s - seed - SEG.neck) / SEG.shoulder));
  if (s <= seed + SEG.neck + SEG.shoulder + SEG.body) return D.draw.body;
  const u = clamp((s - seed - SEG.neck - SEG.shoulder - SEG.body) / SEG.tail);
  return D.draw.body - (D.draw.body - D.draw.tail) * u * u;
}

// samples down the crystal, s from the seed's top, with both sides of the seed shoulder step
function samplesTo(end) {
  const marks = [0, SEG.seed, SEG.seed + 0.001];
  const add = (from, to, n) => {
    for (let i = 1; i <= n; i++) marks.push(from + ((to - from) * i) / n);
  };
  const a = SEG.seed;
  const b = a + SEG.neck;
  const c = b + SEG.shoulder;
  const d = c + SEG.body;
  const e = d + SEG.tail;
  add(a + 0.001, b, 2);
  add(b, c, 40);
  add(c, d, 8);
  add(d, e, 28);
  const out = marks.filter((s) => s < end - 0.05);
  out.push(end);
  return out;
}

// cells of one turned band from (za, ra) to (zb, rb), sorted into tone buckets
function band(buckets, za, ra, zb, rb, from = 0, to = 360, step = 6) {
  const m = (rb - ra) / (zb - za || 1e-6);
  for (let a = from; a < to - 1e-6; a += step) {
    const b = Math.min(to, a + step);
    const mid = (a + b) / 2;
    const n = unit([Math.cos(mid * DEG), Math.sin(mid * DEG), -m]);
    if (dot(n, D.V) <= 1e-6) continue;
    buckets[bandOf(dot(n, D.L))].push(pathOf([isoAt(ra, a, za), isoAt(ra, b, za), isoAt(rb, b, zb), isoAt(rb, a, zb)], true));
  }
}

// tone runs across the visible half of a ring whose surface has slope m (dr/dz), sampled every degree
function runsAt(m) {
  const off = Math.acos(clamp(m * tanE, -1, 1)) / DEG;
  const a0 = D.az - off;
  const a1 = D.az + off;
  const n = Math.max(2, Math.ceil(a1 - a0));
  const runs = [];
  let prev = a0;
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    const tone = bandOf(dot(unit([Math.cos(a * DEG), Math.sin(a * DEG), -m]), D.L));
    const last = runs[runs.length - 1];
    if (!last || last.t !== tone) {
      const edge = i ? (prev + a) / 2 : a0;
      if (last) last.b = edge;
      runs.push({ t: tone, a: edge, b: a });
    } else last.b = a;
    prev = a;
  }
  runs[runs.length - 1].b = a1;
  return runs;
}

// one band between two rings: matched tone runs give smooth tone edges; otherwise cells
function bandSmooth(buckets, A0, B0) {
  if (A0.z - B0.z < 1e-4) return;
  const ra = runsAt(A0.m);
  const rb = runsAt(B0.m);
  if (ra.length === rb.length && ra.every((run, i) => run.t === rb[i].t)) {
    ra.forEach((run, i) => {
      const other = rb[i];
      buckets[run.t].push(pathOf([...arc(A0.r, A0.z, run.a, run.b, 3), ...arc(B0.r, B0.z, other.b, other.a, 3)], true));
    });
  } else band(buckets, A0.z, A0.r, B0.z, B0.r, D.az - 92, D.az + 92, 1);
}

function limbs(list) {
  // list: [{z, r, m}] top to bottom; the two side edges where the surface turns away
  const left = [];
  const right = [];
  for (const { z, r, m } of list) {
    const c = clamp(m * tanE, -1, 1);
    const off = Math.acos(c) / DEG;
    left.push(isoAt(r, D.az + off, z));
    right.push(isoAt(r, D.az - off, z));
  }
  return pathOf(left) + pathOf(right);
}

const fadeOf = (x, lo, hi) => {
  const t = clamp((x - lo) / (hi - lo));
  return t * t * (3 - 2 * t);
};

function drawCrystal(s) {
  const dipH = s.dip * (D.seedTopPark - D.melt - SEG.seed);
  const lift = s.out * D.liftOut;
  const end = SEG.seed + s.grown; // s of the growing face
  const zTop = D.melt + end + dipH + lift;
  const zAt = (sv) => zTop - sv;
  const list = samplesTo(end).map((sv) => ({ s: sv, z: zAt(sv), r: rDraw(Math.min(sv, end - 1e-4)) }));
  // slopes dr/dz at each sample from its neighbours
  list.forEach((item, i) => {
    const a = list[Math.max(0, i - 1)];
    const b = list[Math.min(list.length - 1, i + 1)];
    item.m = Math.abs(b.z - a.z) > 1e-6 ? (b.r - a.r) / (b.z - a.z) : 0;
  });
  const buckets = [[], [], [], [], []];
  for (let i = 0; i < list.length - 1; i++) bandSmooth(buckets, list[i], list[i + 1]);
  bodyTones.forEach((path, tone) => path.setAttribute("d", buckets[tone].join("")));
  // edges: the two limbs, the growing face's front arc, the seed's step
  const bottom = list[list.length - 1];
  let edges = limbs(list.filter((item, i) => !(i > 0 && Math.abs(item.z - list[i - 1].z) < 1e-3 && item.r === list[i - 1].r)));
  edges += pathOf(arc(bottom.r, bottom.z, D.az - 90, D.az + 90, 6));
  if (bottom.r < 4 && lift <= 0 && s.grown > 0) edges += "";
  crystalParts.edge.setAttribute("d", edges);
  // growth ridges: four lines along a <100> crystal, turning with it
  crystalParts.ridges.replaceChildren();
  const ridgeFrom = SEG.seed + SEG.neck;
  if (end > ridgeFrom + 1) {
    const pts = list.filter((item) => item.s >= ridgeFrom);
    for (let k = 0; k < 4; k++) {
      const deg = spinCrystal + 45 + k * 90;
      const segments = [];
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i];
        const b = pts[i + 1];
        const facing = Math.cos(((deg - D.az) * DEG)) * cosE - ((a.m + b.m) / 2) * sinE;
        const alpha = Math.round(fadeOf(facing, 0.12, 0.55) * 10) / 10;
        if (alpha < 0.05) continue;
        segments.push({ d: pathOf([isoAt(a.r, deg, a.z), isoAt(b.r, deg, b.z)]), alpha });
      }
      const byAlpha = new Map();
      for (const seg of segments) byAlpha.set(seg.alpha, (byAlpha.get(seg.alpha) || "") + seg.d);
      for (const [alpha, d] of byAlpha) crystalParts.ridges.appendChild(el("path", { class: "iso-line cz-ridge", d, opacity: String(alpha * 0.8) }));
    }
  }
  // chuck: a short turned block above the seed, with a key line that turns
  const c0 = zTop;
  const c1 = zTop + 10;
  const cb = [[], [], [], [], []];
  bandSmooth(cb, { z: c1, r: 6, m: 0 }, { z: c0, r: 6, m: 0 });
  const cap = arc(6, c1, 0, 360, 10);
  cb[4].push(pathOf(cap, true));
  chuckTones.forEach((path, tone) => path.setAttribute("d", cb[tone].join("")));
  crystalParts.chuckEdge.setAttribute("d", limbs([{ z: c1, r: 6, m: 0 }, { z: c0, r: 6, m: 0 }]) + pathOf(cap, true) + pathOf(arc(6, c0, D.az - 90, D.az + 90, 10)));
  const keyDeg = ((spinCrystal % 360) + 360) % 360;
  const keyFacing = Math.cos((keyDeg - D.az) * DEG);
  crystalParts.key.setAttribute("d", keyFacing > 0.15 ? pathOf([isoAt(6, keyDeg, c0), isoAt(6, keyDeg, c1)]) : "");
  crystalParts.cable.setAttribute("d", pathOf([iso([0, 0, c1]), iso([0, 0, D.head])]));
  return s.out > 0 ? 0 : bottom.r;
}

// ---- argon: drawn on the two cut planes, down the shield cone, out over the melt, over the rim and down past the heater ----
const flowLayer = stage.querySelector("[data-flow]");
const flowPaths = [90, 0].map(() => {
  const line = el("path", { class: "cz-flow-line", "data-free": "" });
  const head = el("path", { class: "cz-flow-head", "data-free": "" });
  flowLayer.appendChild(line);
  flowLayer.appendChild(head);
  return { line, head };
});
let flowShift = 0;
function drawFlow(s) {
  let show = 0;
  if (s.phase >= 1 && s.phase <= 5) show = s.phase === 1 ? ease(clamp(s.t / 0.3)) : 1;
  else if (s.phase === 6) show = 1 - ease(clamp(s.t / 0.25));
  flowLayer.style.opacity = show.toFixed(2);
  flowLayer.style.display = show < 0.01 ? "none" : "";
  if (show < 0.01) return;
  const F = D.flow;
  const rim = D.cruFloor + s.lift * D.lift + F.rimOver;
  const rIn = 35;
  const rOver = D.cruIn - 3;
  const pts = [
    [rIn, F.cone], [rIn, D.melt + 12], [rIn + 3, D.melt + 4], [rIn + 8, D.melt + 3], [rOver - 3, D.melt + 3], [rOver, D.melt + 6],
    [rOver, rim + 1], [rOver + 2, rim + 4], [F.gap - 2, rim + 4], [F.gap, rim + 1], [F.gap, F.end],
  ];
  flowPaths.forEach(({ line, head }, index) => {
    const deg = index ? 0 : 90;
    line.setAttribute("d", pathOf(pts.map(([r, z]) => isoAt(r, deg, z))));
    line.style.strokeDashoffset = (-flowShift).toFixed(2);
    // chevrons in the cut plane: down the cone, out over the melt, down past the heater
    const chevron = ([r, z], [dr, dz]) => {
      const l = Math.hypot(dr, dz);
      const u = [dr / l, dz / l];
      const n = [-u[1], u[0]];
      const tip = isoAt(r, deg, z);
      const a = isoAt(r - u[0] * 2 + n[0] * 1.5, deg, z - u[1] * 2 + n[1] * 1.5);
      const b = isoAt(r - u[0] * 2 - n[0] * 1.5, deg, z - u[1] * 2 - n[1] * 1.5);
      return pathOf([a, tip, b]);
    };
    head.setAttribute("d", chevron([rIn, (F.cone + D.melt) / 2], [0, -1]) + chevron([(rIn + rOver) / 2 + 2, D.melt + 3], [1, 0]) + chevron([F.gap, F.end - 1], [0, -1]));
  });
}

// ---- readout and step label ----
const fmt = (v, d = 0) => v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
function processText(s) {
  const step = D.steps[s.phase];
  const pulledMm = (s.grown / 0.2) | 0;
  if (s.phase === 0) return `${step.label} · ${fmt(D.kg.charge * s.melted)} of ${D.kg.charge} kg molten · ${D.meltC} °C`;
  if (s.phase === 1) return `${step.label} · ${step.say}`;
  if (s.phase === 6) return `${step.label} · ${fmt(D.kg.ingot)} kg crystal · ${s.gate > 0.5 ? "gate valve shut" : "lifting into the pull chamber"}`;
  return `${step.label} · ${fmt(s.kg, 1)} kg grown · ${fmt(pulledMm)} mm pulled · crucible up ${fmt(s.lift * D.lift * 5)} mm`;
}
const stepLabel = (s) => `${s.phase + 1} / 7 · ${D.steps[s.phase].label}`;

// ---- interaction state ----
let progress = 0;
let selected = null;
let inside = false;
let leaveTimer = 0;
let idleTimer = 0;
let visible = false;
let frame = 0;
let last = 0;
let spoken = "";
let playing = null;
let tookOver = false;
let touring = !still.matches;
let tourClock = 0;
const TOUR = { run: 26, hold: 3 };
const PLAY_SECONDS = 26;

// numbers keep their units, and short phrases stay together, so a wrapped readout never leaves a unit alone on a line
const nb = (text) =>
  text
    .replace(/(\d) (?=(mm|kg|rpm|°C|ppma|m)(\b|$| ))/g, "$1\u00a0")
    .replace(/kg (charge|grown|crystal|polysilicon)/g, "kg\u00a0$1")
    .replace(/mm (pulled|bore|crystals?)/g, "mm\u00a0$1")
    .replace(/crucible up /g, "crucible\u00a0up\u00a0")
    .replace(/pull chamber/g, "pull\u00a0chamber");
function say(raw) {
  const text = nb(raw);
  if (readout.textContent !== text) readout.textContent = text;
}
function describe(text) {
  if (stage.getAttribute("aria-valuetext") !== text) stage.setAttribute("aria-valuetext", text);
  if (document.activeElement === stage && text !== spoken) {
    spoken = text;
    live.textContent = text;
  }
}

function select(id) {
  if (!id || !D.parts[id]) id = null;
  if (selected === id) return;
  selected = id;
  for (const node of nodes) {
    if (id !== null && node.part === id) node.el.setAttribute("data-on", "");
    else node.el.removeAttribute("data-on");
  }
  if (id) stage.setAttribute("data-focus", "");
  else stage.removeAttribute("data-focus");
  partButtons.forEach((button) => (button.dataset.part === id ? button.setAttribute("data-on", "") : button.removeAttribute("data-on")));
  stage.setAttribute("aria-valuenow", String(id ? D.order.indexOf(id) + 1 : 0));
}

function render() {
  const s = stateAt(progress);
  share.crucible = s.lift;
  meltFirst = s.phase === 0;
  share.gate = s.gate;
  place();
  const r = drawCrystal(s);
  drawFlow(s);
  drawMelt(s, s.phase >= 2 && s.phase <= 5 ? r : s.phase === 1 && s.dip < 0.02 ? r : 0);
  root.style.setProperty("--cz-heat", s.heat.toFixed(3));
  const top = D.cruFloor + D.depth0 * s.melted;
  for (const layer of chunkLayers) {
    const high = layer.z > D.melt - 8 ? clamp((0.98 - s.melted) / 0.2) : 1;
    const op = s.phase > 0 ? 0 : clamp((layer.z + 5 - top) / 6) * high;
    const text = op >= 0.999 ? "" : op <= 0.001 ? "0" : op.toFixed(2);
    if (text !== layer.shown) {
      layer.shown = text;
      if (text === "") layer.g.removeAttribute("opacity");
      else layer.g.setAttribute("opacity", text);
      layer.g.style.display = text === "0" ? "none" : "";
    }
  }
  const text = selected ? `${D.parts[selected].name}: ${D.parts[selected].say}` : progress <= 0.0005 && !playing && !touring ? D.idle : processText(s);
  say(text);
  describe(text);
  const label = progress <= 0.0005 ? "ready" : progress >= 0.9995 ? "7 / 7 · done" : stepLabel(s);
  if (stepText.textContent !== label) stepText.textContent = label;
  const value = String(Math.round(progress * 1000));
  if (scrubInput.value !== value) scrubInput.value = value;
  playText.textContent = playing ? "Pause" : progress >= 0.9995 ? "Replay" : "Play";
  playButton.toggleAttribute("data-playing", !!playing);
  playButton.setAttribute("aria-label", playing ? "Pause the growth run" : "Play the growth run");
  return s;
}

const spinning = (s) => s.phase >= 1 && s.phase <= 5;
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  if (touring) {
    tourClock += dt;
    const cycle = TOUR.run + TOUR.hold;
    const t = tourClock % cycle;
    progress = Math.min(1, t / TOUR.run);
  } else if (playing) {
    progress = Math.min(1, progress + dt / PLAY_SECONDS);
    if (progress >= 1) playing = null;
  }
  const s = stateAt(progress);
  if (!still.matches && (spinning(s) || s.phase === 0)) {
    spinCrucible += (D.rpm[1] * 360 * dt) / 60;
    if (spinning(s)) spinCrystal -= (D.rpm[0] * 360 * dt) / 60;
    if (spinning(s)) flowShift = (flowShift + dt * 9) % 1000;
  }
  render();
  const moving = touring || playing || (!still.matches && (spinning(s) || s.phase === 0));
  frame = visible && moving ? requestAnimationFrame(tick) : 0;
}

function run() {
  if (!frame && visible) {
    last = 0;
    frame = requestAnimationFrame(tick);
  }
}

function quietTour() {
  if (touring) progress = progress;
  touring = false;
  tookOver = true;
  clearTimeout(idleTimer);
}

new IntersectionObserver(
  (entries) => {
    visible = entries[entries.length - 1].isIntersecting;
    if (visible) run();
  },
  { rootMargin: "120px 0px" },
).observe(stage);

function partAt(event) {
  const hit = document.elementFromPoint(event.clientX, event.clientY);
  const item = hit && hit.closest ? hit.closest(".it") : null;
  return item ? item.dataset.part : null;
}

stage.addEventListener("pointermove", (event) => {
  if (event.pointerType === "touch") return;
  inside = true;
  clearTimeout(leaveTimer);
  if (touring) quietTour();
  select(partAt(event));
  render();
});
stage.addEventListener("pointerleave", () => {
  inside = false;
  clearTimeout(leaveTimer);
  leaveTimer = setTimeout(() => {
    if (inside) return;
    select(null);
    render();
  }, 260);
});
stage.addEventListener("pointerdown", (event) => {
  if (event.pointerType !== "touch") {
    stage.focus({ preventScroll: true });
    return;
  }
  quietTour();
  const id = partAt(event);
  select(id && id !== selected ? id : null);
  render();
  run();
});

partButtons.forEach((button) => {
  const show = () => {
    quietTour();
    clearTimeout(leaveTimer);
    select(button.dataset.part);
    render();
    run();
  };
  const hide = () => {
    clearTimeout(leaveTimer);
    leaveTimer = setTimeout(() => {
      if (inside || partButtons.some((other) => other.matches(":hover, :focus-visible"))) return;
      select(null);
      render();
    }, 260);
  };
  button.addEventListener("pointerenter", show);
  button.addEventListener("focus", show);
  button.addEventListener("pointerleave", hide);
  button.addEventListener("blur", hide);
  button.addEventListener("click", show);
});

stage.addEventListener("focus", () => {
  spoken = "";
  render();
});

function nextBoundary(p) {
  for (const [, to] of BOUNDS) if (to > p + 1e-4) return to;
  return 1;
}

function togglePlay() {
  quietTour();
  if (playing) {
    playing = null;
    render();
    return;
  }
  if (progress >= 0.9995) progress = 0;
  if (still.matches) {
    progress = nextBoundary(progress);
    render();
    return;
  }
  playing = { from: progress };
  run();
}

function reset() {
  quietTour();
  playing = null;
  progress = 0;
  select(null);
  render();
  run();
}

document.addEventListener("keydown", (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey || !visible) return;
  const target = event.target;
  if (target !== document.body && target !== stage && !root.contains(target)) return;
  if (target === scrubInput && event.key !== " " && event.key !== "Escape") return;
  if (target instanceof HTMLButtonElement && (event.key === " " || event.key === "Enter")) return;
  if (event.key === " ") {
    event.preventDefault();
    togglePlay();
    return;
  }
  if (event.key === "Escape") {
    event.preventDefault();
    reset();
    return;
  }
  const index = selected ? D.order.indexOf(selected) : -1;
  let next = null;
  if (event.key === "ArrowRight" || event.key === "ArrowDown") next = Math.min(D.order.length - 1, index + 1);
  else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = Math.max(0, index - 1);
  else if (event.key === "Home") next = 0;
  else if (event.key === "End") next = D.order.length - 1;
  if (next === null) return;
  event.preventDefault();
  quietTour();
  select(D.order[next]);
  render();
  run();
});

scrubInput.addEventListener("input", () => {
  quietTour();
  playing = null;
  select(null);
  progress = Number(scrubInput.value) / 1000;
  render();
  run();
});
playButton.addEventListener("click", togglePlay);

if (still.matches) touring = false;
const narrow = matchMedia("(hover: none), (max-width: 480px)");
const hint = root.querySelector(".cz-hint");
const wording = () => hint && (hint.textContent = narrow.matches ? "Tap a part · Play runs the pull" : "Hover a part · Space runs the pull");
wording();
narrow.addEventListener("change", wording);
render();
