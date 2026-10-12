// The two sawn chip blocks, as pure geometry: what the cut faces show at any point of the process,
// and how the backside block looks while it is flipped. Used by build.mjs (the resting picture) and
// inlined into the page (live.js redraws the backside block from it). No imports: the page has no modules.

// ---- world placement (illustrative units; heights hugely magnified and compressed) ----
export const BLK = {
  half: 28, // half-width along the cut face (u)
  y0: -18,
  y1: 18,
  right: { xc: 40, zc: 46, vc: 12.5 },
  left: { xc: -62, zc: 12, vc: 0 },
};

// backside block, in wafer coordinates v (0 = top of the original silicon, transistors above it)
export const RB = {
  sub0: 12, // drawn silicon before thinning
  sub1: 2.6, // drawn silicon after thinning
  dev: 5,
  beol: [1.8, 1.8, 2.4, 3, 4, 5], // signal layers
  bond: 1,
  carrier: 14,
  back: [2.8, 3.2, 3.8], // backside power layers
  tsvU: [-27, -21, -15, -9, -3, 3, 9, 15, 21, 27],
  carrierLift: 11,
};
RB.beolTop = RB.dev + RB.beol.reduce((a, b) => a + b, 0); // 23
RB.top = RB.beolTop + RB.bond + RB.carrier; // 38
RB.backH = RB.back.reduce((a, b) => a + b, 0); // 7.6

// front-side block, z = left.zc + v
export const LB = {
  sub: 14,
  dev: 4,
  beol: [1.6, 1.6, 2, 2.4, 2.8, 3.4, 4.4, 5.6, 6.2],
  powerU: [-21, -7, 7, 21],
};
LB.top = LB.sub + LB.dev + LB.beol.reduce((a, b) => a + b, 0); // 48

// ---- the process clock: slider position 0..1 to step progress ----
export const SEQ = [
  { id: "front", w: 1.6 },
  { id: "bond", w: 1 },
  { id: "flip", w: 1.2 },
  { id: "thin", w: 1.4 },
  { id: "tsv", w: 1 },
  { id: "metal", w: 1.3 },
  { id: "bumps", w: 0.9 },
];
const TOTAL = SEQ.reduce((a, s) => a + s.w, 0);
const clamp = (x) => Math.max(0, Math.min(1, x));
export const ease = (t) => t * t * (3 - 2 * t);

export function phasesAt(s) {
  const out = { step: 0 };
  let at = 0;
  SEQ.forEach((step, index) => {
    const p = clamp((s * TOTAL - at) / step.w);
    out[step.id] = p;
    if (s * TOTAL > at + 1e-6) out.step = index;
    at += step.w;
  });
  if (s >= 1) out.step = SEQ.length - 1;
  return out;
}

// the backside block's state at slider position s
export function rightState(s) {
  const p = phasesAt(s);
  const thin = ease(clamp((p.thin - 0.12) / 0.74));
  const S = RB.sub0 + (RB.sub1 - RB.sub0) * thin;
  // the wheel comes down to the silicon, follows it while grinding, then lifts away
  let grind = 0;
  const vc = BLK.right.vc;
  const topNow = vc + S; // height of the silicon's back above the axis once flipped
  const restGap = WHEEL.rest - BLK.right.zc;
  if (p.thin > 0 && p.thin < 1) {
    const reach = restGap - (vc + RB.sub0);
    if (p.thin < 0.12) grind = -reach * ease(p.thin / 0.12);
    else if (p.thin < 0.86) grind = -(restGap - topNow);
    else grind = -(restGap - (vc + RB.sub1)) * (1 - ease((p.thin - 0.86) / 0.14));
  }
  // while the fixture turns the block over, the head backs up its column out of the sweep
  if (p.flip > 0 && p.flip < 1) grind = WHEEL.flipLift * ease(clamp(p.flip / 0.2)) * (1 - ease(clamp((p.flip - 0.8) / 0.2)));
  return {
    p,
    S,
    theta: Math.PI * ease(p.flip),
    layers: p.front * (RB.beol.length + 1.2),
    carrier: p.bond > 0 ? (1 - ease(clamp(p.bond / 0.85))) * RB.carrierLift : null,
    bonded: p.bond >= 0.85,
    tsv: ease(p.tsv),
    tsvHot: p.tsv > 0 && p.metal === 0,
    back: p.metal * RB.back.length,
    bumps: ease(p.bumps),
    grind,
    spin: p.thin > 0.08 && p.thin < 0.9,
  };
}

// the cup wheel's rest height (its underside), above everything the flip sweeps
export const WHEEL = { rest: 104, r: 16, h: 4, flipLift: 14 };

// ---- projection (the kit's iso, repeated so this file needs nothing) ----
function isoOf([x, y, z], P) {
  const a = (P.azimuth * Math.PI) / 180;
  const e = (P.elevation * Math.PI) / 180;
  const k = P.scale * Math.sqrt(1.6);
  return [P.origin[0] + (x * Math.sin(a) - y * Math.cos(a)) * k, P.origin[1] + ((x * Math.cos(a) + y * Math.sin(a)) * Math.sin(e) - z * Math.cos(e)) * k];
}
const r1 = (v) => Math.round(v * 10) / 10;
const pathOf = (pts, closed) => pts.map(([x, y], i) => `${i ? "L" : "M"}${r1(x)} ${r1(y)}`).join("") + (closed ? "Z" : "");

function hull(points) {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (const p of pts.reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

const BANDS = [0, 0.2, 0.42, 0.62];
const bandOf = (score) => {
  let tone = 0;
  while (tone < BANDS.length && score >= BANDS[tone]) tone++;
  return tone;
};
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// a block placement: world point of (u along the face, y, v up the wafer) at flip angle theta
function placer(place, theta) {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return (u, y, v) => [place.xc + u * c + (v - place.vc) * s, y, place.zc - u * s + (v - place.vc) * c];
}

export const JAW = { w: 3, h: 12, d: 7 };
const az = (P) => (P.azimuth * Math.PI) / 180;
const at3 = (place, theta, u, y, v) => placer(place, theta)(u, y, v);

// one box of the block, shaded like the kit's prismOf: { body, edges }
function boxOf(place, theta, v0, v1, P, V, L, { u0 = -BLK.half, u1 = BLK.half, y0 = BLK.y0, y1 = BLK.y1, tone = "mid" } = {}) {
  const at = placer(place, theta);
  const ring = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]]; // counter-clockwise in (u, v)
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const U = [c, 0, -s];
  const W = [s, 0, c];
  const low = ring.map(([u, v]) => isoOf(at(u, y0, v), P));
  const high = ring.map(([u, v]) => isoOf(at(u, y1, v), P));
  const buckets = [[], [], [], [], []];
  const seen = [];
  for (let j = 0; j < 4; j++) {
    const [ua, va] = ring[j];
    const [ub, vb] = ring[(j + 1) % 4];
    const du = ub - ua;
    const dv = vb - va;
    const len = Math.hypot(du, dv) || 1;
    const n = [(U[0] * dv - W[0] * du) / len, 0, (U[2] * dv - W[2] * du) / len];
    const visible = dot(n, V) > 1e-6;
    seen.push(visible);
    if (visible) buckets[bandOf(dot(n, L))].push(pathOf([low[j], low[(j + 1) % 4], high[(j + 1) % 4], high[j]], true));
  }
  buckets[bandOf(L[1])].push(pathOf(high, true)); // the cut face (+y) always shows
  const creases = [];
  for (let j = 0; j < 4; j++) {
    const prev = (j + 3) % 4;
    if (seen[j] && seen[prev]) creases.push(pathOf([low[j], high[j]]));
    if (seen[j]) creases.push(pathOf([high[j], high[(j + 1) % 4]]));
  }
  const outline = pathOf(hull([...low, ...high]), true);
  const shades = buckets.slice(0, 4).map((list) => list.join(""));
  const body = `<path class="iso-fill" d="${outline}"/>` + shades.map((d, i) => (d ? `<path class="iso-shade" data-shade="${i}" d="${d}"/>` : "")).join("") + `<path class="iso-top" d="${buckets[4].join("")}"/>`;
  const edges = `<path class="iso-line iso-crease" data-tone="lo" d="${creases.join("")}"/><path class="iso-line iso-edge" data-tone="${tone}" d="${outline}"/>`;
  return { body, edges, seen, at };
}

const hash = (a, b) => {
  let x = (a * 374761393 + b * 668265263) | 0;
  x = (x ^ (x >>> 13)) * 1274126177;
  return ((x ^ (x >>> 16)) >>> 0) / 4294967295;
};

// ---- what each cut face shows: rectangles in (u, v), each with a part and a material ----
function wiringLayer(out, piece, index, z0, h, { power = [], vias = true } = {}) {
  const z1 = z0 + h;
  const half = BLK.half;
  out.push({ piece, m: "ox", u0: -half, u1: half, v0: z0, v1: z1 });
  const wireLow = z0 + h * 0.38;
  const pitch = Math.max(1.9, h * 1.25);
  const w = pitch * 0.5;
  const wp = Math.min(4.2, Math.max(1.6, h * 0.75));
  const busy = (u, pad) => power.some((pu) => Math.abs(pu - u) < wp / 2 + pad);
  for (const pu of power) {
    out.push({ piece, m: "pw", u0: pu - wp / 2, u1: pu + wp / 2, v0: wireLow, v1: z1 });
    out.push({ piece, m: "pw", u0: pu - wp * 0.3, u1: pu + wp * 0.3, v0: z0, v1: wireLow });
  }
  if (index % 2 === 0) {
    for (let u = -half + pitch * 0.5 + 0.3; u + w / 2 <= half - 0.3; u += pitch) {
      if (busy(u, w / 2 + 0.4)) continue;
      out.push({ piece, m: "cu", u0: u - w / 2, u1: u + w / 2, v0: wireLow, v1: z1 });
      if (vias && hash(index, Math.round(u * 10)) < 0.35) out.push({ piece, m: "cu", u0: u - w * 0.3, u1: u + w * 0.3, v0: z0, v1: wireLow });
    }
  } else {
    // a layer whose lines run along the face: long runs between the power columns
    const stops = [-half + 0.6, ...power.flatMap((pu) => [pu - wp / 2 - 0.6, pu + wp / 2 + 0.6]), half - 0.6];
    for (let i = 0; i < stops.length; i += 2) {
      let a = stops[i];
      const b = stops[i + 1];
      let n = 0;
      while (b - a > 2) {
        const len = Math.min(b - a, 3 + hash(index, n) * 9);
        out.push({ piece, m: "cu", u0: a, u1: a + len, v0: wireLow, v1: z1 });
        if (vias && len > 3) {
          const vu = a + 1 + hash(index + 7, n) * (len - 2);
          out.push({ piece, m: "cu", u0: vu - 0.5, u1: vu + 0.5, v0: z0, v1: wireLow });
        }
        a += len + 1.1;
        n++;
      }
    }
  }
}

function deviceLayer(out, piece, z0, h) {
  const half = BLK.half;
  out.push({ piece, m: "ox", u0: -half, u1: half, v0: z0, v1: z0 + h });
  for (let u = -half + 1.5; u <= half - 1.5 + 1e-6; u += 3) {
    out.push({ piece, m: "gate", u0: u - 0.6, u1: u + 0.6, v0: z0 + 0.9, v1: z0 + h * 0.72 });
  }
  for (let u = -half + 3; u <= half - 3 + 1e-6; u += 3) out.push({ piece, m: "cu", u0: u - 0.35, u1: u + 0.35, v0: z0 + 0.5, v1: z0 + h });
}

export function leftRects() {
  const out = [];
  out.push({ piece: "fs", m: "si", u0: -BLK.half, u1: BLK.half, v0: 0, v1: LB.sub });
  deviceLayer(out, "fs", LB.sub, LB.dev);
  let z = LB.sub + LB.dev;
  LB.beol.forEach((h, i) => {
    wiringLayer(out, "fs", i, z, h, { power: i >= LB.beol.length - 2 ? [-21, -14, -7, 0, 7, 14, 21] : LB.powerU });
    z += h;
  });
  return out;
}

export function rightRects(st) {
  const out = [];
  const half = BLK.half;
  const S = st.S;
  out.push({ piece: "devices", m: "si", u0: -half, u1: half, v0: -S, v1: 0 });
  if (st.layers > 0) deviceLayer(out, "devices", 0, RB.dev);
  let z = RB.dev;
  RB.beol.forEach((h, i) => {
    if (st.layers >= i + 1.2) wiringLayer(out, "signal", i + 1, z, h);
    z += h;
  });
  if (st.bonded) {
    out.push({ piece: "carrier", m: "bond", u0: -half, u1: half, v0: RB.beolTop, v1: RB.beolTop + RB.bond });
    out.push({ piece: "carrier", m: "si2", u0: -half, u1: half, v0: RB.beolTop + RB.bond, v1: RB.top });
  }
  if (st.tsv > 0) {
    // each pillar runs from the exposed back surface up through the silicon into the transistor row;
    // while its step runs it is drawn in the lit tone so the reader sees the step happen
    const reach = (S + RB.dev * 0.55) * st.tsv;
    const m = st.tsvHot ? "nt" : "pw";
    for (const u of RB.tsvU) out.push({ piece: "ntsv", m, u0: u - 0.9, u1: u + 0.9, v0: -S, v1: -S + reach });
  }
  let b = -S;
  RB.back.forEach((h, j) => {
    const grow = Math.max(0, Math.min(1, st.back - j));
    if (grow <= 0) return;
    const hh = h * grow;
    const z1 = b;
    const z0 = b - hh;
    out.push({ piece: "bspdn", m: "ox", u0: -half, u1: half, v0: z0, v1: z1 });
    if (j === 0) for (const u of RB.tsvU) out.push({ piece: "bspdn", m: "pw", u0: u - 1.6, u1: u + 1.6, v0: z0, v1: z1 - hh * 0.25 });
    if (j === 1) {
      for (const u of [-21, -7, 7, 21]) out.push({ piece: "bspdn", m: "pw", u0: u - 4.2, u1: u + 4.2, v0: z0, v1: z1 - hh * 0.4 });
      for (const u of [-24, -18, -10, -4, 4, 10, 18, 24]) out.push({ piece: "bspdn", m: "pw", u0: u - 0.7, u1: u + 0.7, v0: z1 - hh * 0.4, v1: z1 });
    }
    if (j === 2) {
      for (const u of [-14, 14]) out.push({ piece: "bspdn", m: "pw", u0: u - 11, u1: u + 11, v0: z0, v1: z1 - hh * 0.4 });
      for (const u of [-21, -7, 7, 21]) out.push({ piece: "bspdn", m: "pw", u0: u - 1, u1: u + 1, v0: z1 - hh * 0.4, v1: z1 });
    }
    b = z0;
  });
  return out;
}

// the material bands along the side face that turns toward the viewer
function rightBands(st) {
  const out = [{ piece: "devices", m: "si", v0: -st.S, v1: 0 }];
  if (st.layers > 0) out.push({ piece: "devices", m: "ox", v0: 0, v1: RB.dev });
  let z = RB.dev;
  RB.beol.forEach((h, i) => {
    if (st.layers >= i + 1.2) out.push({ piece: "signal", m: "ox", v0: z, v1: z + h });
    z += h;
  });
  if (st.bonded) out.push({ piece: "carrier", m: "bond", v0: RB.beolTop, v1: RB.beolTop + RB.bond }, { piece: "carrier", m: "si2", v0: RB.beolTop + RB.bond, v1: RB.top });
  let b = -st.S;
  RB.back.forEach((h, j) => {
    const grow = Math.max(0, Math.min(1, st.back - j));
    if (grow <= 0) return;
    out.push({ piece: "bspdn", m: "bk", v0: b - h * grow, v1: b });
    b -= h * grow;
  });
  return out;
}

export function leftBands() {
  const out = [{ piece: "fs", m: "si", v0: 0, v1: LB.sub }, { piece: "fs", m: "ox", v0: LB.sub, v1: LB.sub + LB.dev }];
  let z = LB.sub + LB.dev;
  for (const h of LB.beol) {
    out.push({ piece: "fs", m: "ox", v0: z, v1: z + h });
    z += h;
  }
  return out;
}

// extent of the stack (v range) the block's box covers
export function rightExtent(st) {
  let v0 = -st.S;
  RB.back.forEach((h, j) => (v0 -= h * Math.max(0, Math.min(1, st.back - j))));
  const v1 = st.bonded ? RB.top : st.layers > 0 ? Math.min(RB.beolTop, RB.dev + RB.beol.slice(0, Math.max(0, Math.floor(st.layers - 0.2))).reduce((a, b) => a + b, 0)) : 0;
  return [v0, v1];
}

const MAT = { si: "bp-si", si2: "bp-si2", ox: "bp-ox", cu: "bp-cu", pw: "bp-pw", nt: "bp-nt", gate: "bp-gate", bond: "bp-bond", bk: "bp-bk" };

// face content of one block: rectangles on the cut face, bands on the side face that faces the viewer
function faceSvg(rects, bands, box, sideU, flows = []) {
  const { at } = box;
  const groups = new Map();
  const add = (piece, m, d) => {
    const key = `${piece}|${m}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(d);
  };
  return (P) => {
    const cl = (u) => Math.max(-BLK.half, Math.min(BLK.half, u));
    for (const r0 of rects) {
      const r = { ...r0, u0: cl(r0.u0), u1: cl(r0.u1) };
      if (r.u1 - r.u0 < 0.05) continue;
      add(r.piece, r.m, pathOf([at(r.u0, BLK.y1, r.v0), at(r.u1, BLK.y1, r.v0), at(r.u1, BLK.y1, r.v1), at(r.u0, BLK.y1, r.v1)].map((p) => isoOf(p, P)), true));
    }
    if (sideU !== null) for (const b of bands) add(b.piece, b.m, pathOf([at(sideU, BLK.y0, b.v0), at(sideU, BLK.y1, b.v0), at(sideU, BLK.y1, b.v1), at(sideU, BLK.y0, b.v1)].map((p) => isoOf(p, P)), true));
    const byPiece = new Map();
    for (const [key, list] of groups) {
      const [piece, m] = key.split("|");
      const d = list.join("");
      const tone = m === "pw" || m === "nt" || m === "cu" || m === "gate" ? "lo" : "faint";
      if (!byPiece.has(piece)) byPiece.set(piece, []);
      byPiece.get(piece).push(`<path class="${MAT[m]}" d="${d}"/><path class="iso-line" data-tone="${tone}" d="${d}"/>`);
    }
    // current: dashes running from the bumps down to the transistors
    const flow = flows.map((f) => pathOf([isoOf(at(f.u, BLK.y1, f.v0), P), isoOf(at(f.u, BLK.y1, f.v1), P)])).join("");
    const current = flow ? `<path class="iso-line bp-flow" data-tone="lit" data-flow="" d="${flow}"/>` : "";
    return [...byPiece].map(([piece, parts]) => `<g class="bp-sec" data-piece="${piece}">${parts.join("")}</g>`).join("") + current;
  };
}

// the whole backside block (and the carrier while it comes down) at state st
export function rightSvg(st, P, V, L) {
  const place = BLK.right;
  const [v0, v1] = rightExtent(st);
  let svg = "";
  if (v1 - v0 > 0.01) {
    const box = boxOf(place, st.theta, v0, v1, P, V, L);
    // the side face that looks at the viewer: index 1 is u = +half, index 3 is u = -half
    const sideU = box.seen[1] ? BLK.half : box.seen[3] ? -BLK.half : null;
    // the fixture's two clamp jaws grip the block's ends and turn with it
    // jaws stay on the block: centred on the axis once the stack is tall enough, on the stack before that
    const jh = Math.min(JAW.h, v1 - v0);
    const jc = Math.max(v0 + jh / 2, Math.min(v1 - jh / 2, place.vc));
    const jaws = [-1, 1].map((side) => {
      const u0 = side < 0 ? -BLK.half - JAW.w : BLK.half;
      const j = boxOf(place, st.theta, jc - jh / 2, jc + jh / 2, P, V, L, { u0, u1: u0 + JAW.w, y0: BLK.y0, y1: BLK.y0 + JAW.d });
      const c = at3(place, st.theta, u0 + JAW.w / 2, BLK.y0 + JAW.d / 2, jc);
      return { side, svg: `<g class="bp-jaw" data-piece="tools">${j.body}${j.edges}</g>`, depth: c[0] * Math.cos(az(P)) + c[1] * Math.sin(az(P)) };
    });
    jaws.sort((a, b) => a.depth - b.depth);
    const flows = st.bumps > 0.5 ? [-21, -9, 9, 21].map((u) => ({ u, v0: v0, v1: 0 })) : [];
    svg += jaws[0].svg + box.body + faceSvg(rightRects(st), rightBands(st), box, sideU, flows)(P) + box.edges + jaws[1].svg;
  }
  if (st.carrier !== null && !st.bonded) {
    const off = st.carrier;
    const c0 = RB.beolTop + RB.bond + off;
    const c1 = RB.top + off;
    const box = boxOf(place, 0, c0, c1, P, V, L);
    const rects = [{ piece: "carrier", m: "si2", u0: -BLK.half, u1: BLK.half, v0: c0, v1: c1 }];
    svg += `<g class="bp-carrier">${box.body + faceSvg(rects, [{ piece: "carrier", m: "si2", v0: c0, v1: c1 }], box, BLK.half)(P) + box.edges}</g>`;
  }
  return svg;
}

export function leftSvg(P, V, L) {
  const box = boxOf(BLK.left, 0, 0, LB.top, P, V, L);
  const flows = LB.powerU.map((u) => ({ u, v0: LB.top, v1: LB.sub + LB.dev }));
  return box.body + faceSvg(leftRects(), leftBands(), box, BLK.half, flows)(P) + box.edges;
}
