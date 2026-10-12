// Siemens polysilicon reactor with its feed skid, cut away to show the rods growing.
// node build.mjs [--audit] [--fast] [--grown]
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as M from "./model.mjs";
import { hairpin, hairpinShapes } from "./rods.mjs";
import { k, G, A, Tube, kitScript } from "../../site/kit.mjs";
import { writeChapter } from "../../site/shell.mjs";
import { LESSON } from "./lesson.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const DEG = Math.PI / 180;
const GROWN = process.argv.includes("--grown");

// ---- world layout (x, y on the floor, z up; 1 unit ≈ 13.3 mm for the rods, the rest illustrative) ----
const W = 680;
const H = 760;
const AZIMUTH = 45;
const ELEVATION = 30;
const VA = AZIMUTH; // the floor angle that points at the viewer
const NOTCH = 60; // half-width of the cutaway, degrees either side of the viewer

const PLATE = { x: -238, y: -190, w: 352, d: 306, r: 10 };
const PLATE_H = 12;
const FOOT_H = 7;

const LEG_R = 58;
const LEG_AT = [0, 90, 180, 270];
const BP_Z = 36; // baseplate underside
const BP_TOP = 48;
const BP_R = 72;
const FL = { r0: 52, r1: 66, z0: BP_TOP, z1: BP_TOP + 6 }; // bell flange
const R_IN = 52;
const R_OUT = 57;
const JACKET = [53.6, 55.4]; // the cooling-water gap between the bell's two walls (illustrative)
const Z_B = 228; // top of the cutaway
const Z_C = 252; // top of the bell's cylinder
const DOME_H = 40;
const LIFT = 146; // how far the crane lifts the bell at harvest

const RING = 36; // rod circle radius
const CHUCK_Z = BP_TOP + 9; // rods start on the graphite chucks
const ROD_TOP = CHUCK_Z + 120; // bridge axis height (illustrative rod length)
const R_SLIM = M.rodRadius(M.CVD.slimMm);
const R_FINAL = M.rodRadius(M.FINAL_MM);
const R_DRAW = GROWN ? R_FINAL : R_SLIM;

const HOPPER = { x: -220, y: 58, w: 40, d: 34, r: 2 };
const HOP_Z = 16;
const HOP_TOP = 46;
const FBR = { at: [-200, -5], r: 15, z0: 10, z1: 96 };
const SIGHT = { deg: 30, z: 36, r: 5.4, bubbles: 9 }; // illustrative sight glass on the bed
let SIGHT_BOX = null;
const COL = { at: [-200, -100], r: 9, z0: 10, z1: 176 };
const CAB = { x: 34, y: -170, w: 46, d: 30, r: 2 };
const CAB_H = 66;
const TBOX = { x: 34, y: -50, w: 18, d: 14, r: 1.2 };

const PIECES = {
  bell: { name: "Bell jar", say: "bell jar · double steel wall, water cooled", move: [0, 0, LIFT] },
  rods: { name: "Silicon rods", say: "", move: [0, 0, 0] },
  base: { name: "Baseplate and electrodes", say: "baseplate · electrodes, chucks, nozzles", move: [0, 0, 0] },
  hopper: { name: "MG-Si feed bin", say: "", move: [0, 0, 0] },
  fbr: { name: "Hydrochlorinator", say: "", move: [0, 0, 0] },
  column: { name: "Distillation column", say: "", move: [0, 0, 0] },
  power: { name: "Power supply", say: "power supply · current heats the rods", move: [0, 0, 0] },
  stand: { name: "Bench", say: "", move: [0, 0, 0] },
};
const STAGGER = ["bell", "rods", "base", "hopper", "fbr", "column", "power", "stand"];
const SPRING = { stagger: 0.05, stiffness: 64, damping: 14.2, substeps: 4 };
const ORDER = ["hopper", "fbr", "column", "rods", "bell", "base", "power"];

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [0, 0, Z_C + DOME_H + LIFT], [-R_OUT, R_OUT, Z_C + DOME_H + LIFT], [R_OUT, -R_OUT, Z_C + DOME_H + LIFT], [COL.at[0], COL.at[1], COL.z1 + 18]],
  W,
  H,
  { pad: 26, azimuth: AZIMUTH, elevation: ELEVATION },
);
const V = G.viewOf(P);
const KS = G.scaleOf(P);
const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);
const polar = (deg, r, z = 0) => [r * Math.cos(deg * DEG), r * Math.sin(deg * DEG), z];
const UP = (o) => G.frameOf(o, [0, 0, 1], [1, 0, 0], [0, 1, 0]);
const centreOf = (plan, z) => [plan.x + plan.w / 2, plan.y + plan.d / 2, z];
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));

const R = A.recorder(P, { order: STAGGER, spring: SPRING });
const record = R.solid;
function put(piece, ref, svg, shapes, { bias = 0, name, cls } = {}) {
  const id = name ?? R.nameFor(`${piece}.item`);
  shapes.forEach((shape) => (shape.name = shape.name ?? id));
  R.put({ piece, at: ref, bias, svg, move: PIECES[piece].move, shapes: shapes.map(record), name: id, cls });
  return id;
}

// ---- pipe helpers (after the Raptor's pipe(), flangeAt() and padOn()) ----
// Screen length of a 3D polyline, for dash offsets that run on across tube chunks.
const screenLength = (points) => points.map(at).reduce((sum, p, i, all) => (i ? sum + Math.hypot(p[0] - all[i - 1][0], p[1] - all[i - 1][1]) : 0), 0);
const flatPath = (points) => `M${points.map((p) => at(p).map((v) => v.toFixed(1)).join(" ")).join("L")}`;

function tubeItems(piece, route, r, { name, tone = "hi", maxLength = 24, gaps = [], rims, free = [false, false], limp = false, spacing = 1.6, touch, flow } = {}) {
  const id = R.nameFor(name ?? `${piece}.tube`);
  R.route(id, route, r, { owner: id, gaps, rims, free, limp, touch, piece, move: PIECES[piece].move });
  Tube.tubePieces(route, r, P, { maxLength, spacing, gaps }).forEach((part, index) => {
    // flow marks: round dots on the centreline that the slider walks along the pipe (see live.js)
    let marks = "";
    if (flow) {
      const start = Math.max(0, part.from - 0.5);
      const before = start > 0.01 ? screenLength(G.cut(G.resample(route, 1.6), 0, start)) : 0;
      marks = `<path class="pz-flow" data-flow="${flow}" style="--o:${before.toFixed(1)}" d="${flatPath(part.points)}"/>`;
    }
    R.put({ piece, at: part.mid, svg: Tube.tubeSvg(part, { tone }) + marks, move: PIECES[piece].move, name: `${id}:${index}`, route: id, chunk: index, shapes: [A.tube(part.points, part.radii)] });
  });
  return id;
}

function flangeAt(piece, centre, axis, r, thick, { bolts = 6, tone = "hi", name, owner } = {}) {
  const F = G.frameAlong(centre, axis);
  const faces = [];
  const towards = G.dot3(F.a, V) > 0 ? thick / 2 : -thick / 2;
  if (Math.abs(G.dot3(F.a, V)) > 0.12 && bolts) faces.push(Dots(G.dotsOf(F, towards, r * 0.74, bolts, P, { all: true }), { size: 0.42, tone: "mid" }));
  put(piece, centre, S(G.disc(-thick / 2, thick / 2, r, F, P), { tone }) + faces.join(""), [A.disc(F, -thick / 2, thick / 2, r, { owner })], { name: R.nameFor(name ?? `${piece}.flange`) });
}

function pipe(piece, control, r, { bend = 2.8, tone = "hi", flangeR = 1.6, name, bands = [], flow } = {}) {
  const line = G.fillet(control, Math.max(r * bend, 4), 12, { P, tube: r });
  const total = G.pathLength(line);
  const thick = Math.max(1.2, r * 0.6);
  const collars = [];
  [[0, -1], [total, 1]].forEach(([along, sign]) => {
    const tangent = G.tangentAlong(line, along);
    collars.push({ centre: G.add3(G.pointAlong(line, along), G.mul3(tangent, (-sign * thick) / 2)), tangent, radius: r * flangeR, thick, gap: sign < 0 ? [0, thick] : [total - thick, total], bolts: 6 });
  });
  for (const share of bands) {
    const along = total * share;
    const t = Math.max(0.9, r * 0.6);
    collars.push({ centre: G.pointAlong(line, along), tangent: G.tangentAlong(line, along), radius: r * 1.2, thick: t, gap: [along - t / 2, along + t / 2], bolts: 0 });
  }
  const owner = tubeItems(piece, line, r, { name: name ?? `${piece}.pipe`, tone, gaps: collars.map((c) => c.gap), rims: [r * flangeR, r * flangeR], flow });
  for (const c of collars) flangeAt(piece, c.centre, c.tangent, c.radius, c.thick, { bolts: c.bolts, tone: c.bolts ? tone : "mid", name: `${owner}.collar`, owner });
  return line;
}

// A short boss whose base follows a curved host, so a flange can land flat on its face.
function padOn(piece, host, point, outward, a, h, { name, tone = "hi" } = {}) {
  const hosts = [host].flat();
  const inside = (p) => hosts.some((shape) => A.sdf(shape, p) < 0);
  const axis = G.unit3(outward);
  const F = G.frameAlong(point, axis);
  const start = (angle) => {
    let lo = -2.5 * a;
    let hi = h;
    if (!inside(G.pointOf(F, lo, a, angle))) return 0;
    for (let step = 0; step < 40; step++) {
      const mid = (lo + hi) / 2;
      if (inside(G.pointOf(F, mid, a, angle))) lo = mid;
      else hi = mid;
    }
    return hi;
  };
  const low = Math.min(...Array.from({ length: 48 }, (_, index) => start((index / 48) * Math.PI * 2)));
  const face = G.dot3(axis, V) > 0.15 ? L(G.circleOf(F, h, a * 0.55, P, 16), { tone: "faint" }) : "";
  put(piece, G.add3(point, G.mul3(axis, h / 2)), S(G.saddleOf(F, a, start, h, P), { tone }) + face, [A.disc(F, low - 0.05, h, a, { seated: true, cut: hosts })], { bias: 0.1, name: R.nameFor(name ?? `${piece}.pad`) });
  return G.add3(point, G.mul3(axis, h));
}

// A vessel: ellipsoidal heads on a straight shell, turned about z. Analytic radius and slope.
function vesselCurve(Rv, length, head, { top = true, bottom = true } = {}) {
  const hb = bottom ? head : 0;
  const ht = top ? head : 0;
  const radius = (s) => {
    if (s < hb) {
      const t = (hb - s) / hb;
      return Rv * Math.sqrt(Math.max(0, 1 - t * t));
    }
    if (s > length - ht) {
      const t = (s - (length - ht)) / ht;
      return Rv * Math.sqrt(Math.max(0, 1 - t * t));
    }
    return Rv;
  };
  const slope = (s) => {
    if (s < hb) {
      const t = Math.min(0.995, (hb - s) / hb);
      return (Rv * t) / (hb * Math.sqrt(1 - t * t));
    }
    if (s > length - ht) {
      const t = Math.min(0.995, (s - (length - ht)) / ht);
      return (-Rv * t) / (ht * Math.sqrt(1 - t * t));
    }
    return 0;
  };
  const knots = [];
  const n = 14;
  if (bottom) for (let i = 0; i <= n; i++) {
    const s = hb * (1 - Math.cos(((i / n) * Math.PI) / 2));
    knots.push([s, radius(s), i > 0 ? 1 : 0]);
  }
  else knots.push([0, Rv]);
  if (top) for (let i = length - ht <= knots[knots.length - 1][0] + 1e-9 ? 1 : 0; i <= n; i++) {
    const s = length - ht + ht * Math.sin(((i / n) * Math.PI) / 2);
    knots.push([s, radius(s), i < n ? 1 : 0]);
  }
  else knots.push([length, Rv]);
  return { knots, radius, slope };
}

function vessel(piece, o, Rv, length, head, { tone = "hi", inner = "", extra = "", name, top = true, bottom = true } = {}) {
  const F = UP(o);
  const c = vesselCurve(Rv, length, head, { top, bottom });
  const paths = G.solidOf(c.knots, F, P, { smooth: { slope: c.slope, radius: c.radius, rows: 6 } });
  const shape = A.solid(F, c.knots, { radius: c.radius });
  const id = put(piece, [o[0], o[1], o[2] + length / 2], S(paths, { tone, inner }) + extra, [shape], { name: R.nameFor(name ?? `${piece}.vessel`) });
  return { F, shape, curve: c, id };
}

const arcRing = (r0, r1, a0, a1, steps = 40) => {
  const out = [];
  for (let i = 0; i <= steps; i++) out.push([r1 * Math.cos((a0 + ((a1 - a0) * i) / steps) * DEG), r1 * Math.sin((a0 + ((a1 - a0) * i) / steps) * DEG)]);
  for (let i = steps; i >= 0; i--) out.push([r0 * Math.cos((a0 + ((a1 - a0) * i) / steps) * DEG), r0 * Math.sin((a0 + ((a1 - a0) * i) / steps) * DEG)]);
  return out;
};


// A nozzle on a vessel wall: a saddle pad, a bolted flange and a blind cover.
function nozzle(piece, host, [cx, cy], deg, rv, z, a, { tag = "nozzle", length = 3, cover = true } = {}) {
  const n = polar(deg, 1, 0);
  const p = [cx + n[0] * (rv - 0.6), cy + n[1] * (rv - 0.6), z];
  const end = padOn(piece, host, p, n, a, length, { name: `${piece}.${tag}`, tone: "mid" });
  const F = G.frameAlong(end, n);
  const t = Math.max(1.2, a * 0.3);
  let svg = S(G.disc(0, t, a * 1.45, F, P), { tone: "mid" });
  const face = G.dot3(n, V) > 0.12;
  if (face) svg += Dots(G.dotsOf(F, t, a * 1.2, 8, P, { all: true }), { size: 0.4, tone: "mid" });
  if (cover && face) svg += L(G.circleOf(F, t, a * 0.8, P, 24), { tone: "faint" });
  put(piece, G.add3(end, G.mul3(n, t / 2)), svg, [A.disc(F, 0, t, a * 1.45, {})], { name: `${piece}.${tag}-flange`, bias: 0.2 });
  return G.add3(end, G.mul3(n, t));
}

// A pressure gauge on a vessel: pad, stem, a dial facing out with ticks and a needle.
function gauge(piece, host, [cx, cy], deg, rv, z, { tag = "gauge", reading = 0.35 } = {}) {
  const n = polar(deg, 1, 0);
  const p = [cx + n[0] * (rv - 0.4), cy + n[1] * (rv - 0.4), z];
  const end = padOn(piece, host, p, n, 1.6, 1.4, { name: `${piece}.${tag}-pad`, tone: "mid" });
  const F = G.frameAlong(end, n);
  const stem = S(G.disc(0, 2.2, 0.7, F, P), { tone: "mid" });
  put(piece, G.add3(end, G.mul3(n, 1.1)), stem, [A.disc(F, 0, 2.2, 0.7, {})], { name: `${piece}.${tag}-stem`, bias: 0.1 });
  const FD = G.frameOf(G.add3(end, G.mul3(n, 2.2)), n, [0, 0, 1], G.unit3(G.cross3(n, [0, 0, 1])));
  let dial = S(G.disc(0, 1.6, 3.6, FD, P), { tone: "mid" });
  dial += L(G.circleOf(FD, 1.6, 2.9, P, 32), { tone: "lo" });
  const ticks = [];
  for (let i = 0; i <= 8; i++) {
    const ang = Math.PI * (1.25 - (1.5 * i) / 8);
    ticks.push(at(G.pointOf(FD, 1.6, 2.5, ang)));
  }
  dial += Dots(ticks, { size: 0.32, tone: "mid" });
  const needleAng = Math.PI * (1.25 - 1.5 * reading);
  const hub = at(G.pointOf(FD, 1.6, 0, 0));
  const tip = at(G.pointOf(FD, 1.6, 2.2, needleAng));
  dial += `<path class="iso-line" data-tone="hi" data-free="end" d="M${hub[0].toFixed(1)} ${hub[1].toFixed(1)}L${tip[0].toFixed(1)} ${tip[1].toFixed(1)}"/>` + Dots([hub], { size: 0.5, tone: "hi" });
  put(piece, G.add3(end, G.mul3(n, 3)), dial, [A.disc(FD, 0, 1.6, 3.6, {})], { name: `${piece}.${tag}`, bias: 0.2 });
}

// ---- bench ----
function bench() {
  const back = [];
  back.push(`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`);
  const shapes = [];
  for (const [x, y] of byDepth(k.corners(PLATE, 22))) {
    back.push(S(k.cylinder(x, y, 8, -PLATE_H - FOOT_H, 1.8, P, 28), { tone: "lo" }));
    back.push(S(k.cylinder(x, y, 6.2, -PLATE_H - FOOT_H + 1.8, FOOT_H - 1.8, P, 28), { tone: "mid" }));
    shapes.push(A.cylinder(x, y, 8, -PLATE_H - FOOT_H, FOOT_H, { name: "stand.foot" }));
  }
  back.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid", inner: L(k.sideSeam(PLATE, -PLATE_H + 3, P, 8), { tone: "faint" }) }));
  shapes.push(A.slab(PLATE, -PLATE_H, PLATE_H, { name: "stand.plate" }));
  back.push(L(k.planOutline(k.insetPlan(PLATE, 6), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 12);
  back.push(L(screws.map(([x, y]) => k.ring(x, y, 2.4, 0, P, 16)).join(""), { tone: "lo" }));
  back.push(Dots(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // ruler strip along the near edge, ticks every 5 units (≈67 mm of rod), majors every 25
  const strip = { x: -208, y: PLATE.y + PLATE.d - 18, w: 150, d: 8, r: 1 };
  back.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 5, strip.x + strip.w - 5, 5, 5, strip.y + 0.8, 0.6, [2.2, 4], P);
  back.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  back.push(Dots([at([strip.x + 2.4, strip.y + 4, 0.6]), at([strip.x + strip.w - 2.4, strip.y + 4, 0.6])], { size: 0.45 }));
  // label plate
  const label = { x: 38, y: PLATE.y + PLATE.d - 28, w: 66, d: 18, r: 1.5 };
  back.push(S(k.slabOf(label, 0, 0.8, P, 4), { tone: "lo", crease: "none" }));
  back.push(L(k.planOutline(k.insetPlan(label, 1.8), 0.8, P, 4), { tone: "faint" }));
  back.push(L([0, 1, 2].map((i) => k.lineOnTop([label.x + 8, label.y + 5 + i * 3.6], [label.x + 54 - i * 12, label.y + 5 + i * 3.6], 0.8, P)).join(""), { tone: "lo", free: true }));
  back.push(Dots([at([label.x + 4, label.y + label.d / 2, 0.8]), at([label.x + label.w - 4, label.y + label.d / 2, 0.8])], { size: 0.45 }));
  put("stand", [0, 0, -1], back.join(""), shapes, { name: "stand.bench", bias: -800 });
}

// ---- reactor stand, baseplate, electrodes, nozzles ----
let BASEPLATE;
function base() {
  for (const deg of LEG_AT) {
    const [x, y] = polar(deg, LEG_R);
    const svg = S(k.cylinder(x, y, 9, 0, 2.4, P, 32), { tone: "mid" }) + Dots(byDepth([0, 90, 180, 270].map((d) => polar(d + 45, 6.6))).map(([dx, dy]) => at([x + dx, y + dy, 2.4])), { size: 0.45 }) + S(k.cylinder(x, y, 5, 2.4, BP_Z - 6.4, P, 28), { tone: "mid", crease: "none", inner: L(k.sideArc(x, y, 5, 14, P, 20), { tone: "faint" }) }) + S(k.cylinder(x, y, 7, BP_Z - 4, 4, P, 28), { tone: "mid" });
    put("base", [x, y, BP_Z / 2], svg, [A.cylinder(x, y, 9, 0, 2.4, {}), A.cylinder(x, y, 5, 2.4, BP_Z - 6.4, {}), A.cylinder(x, y, 7, BP_Z - 4, 4, {})], { name: R.nameFor("base.leg") });
  }
  // feedthroughs under the plate, one per rod
  const feeds = [];
  for (let i = 0; i < M.ROD_PAIRS * 2; i++) feeds.push(polar(15 + i * 30, RING));
  for (const [x, y] of feeds) {
    const svg = S(k.cylinder(x, y, 3.4, BP_Z - 7, 7, P, 24), { tone: "mid", inner: L(k.sideArc(x, y, 3.4, BP_Z - 3.5, P, 16), { tone: "faint" }) }) + S(k.cylinder(x, y, 1.6, BP_Z - 10, 3, P, 16), { tone: "mid" });
    put("base", [x, y, BP_Z - 5], svg, [A.cylinder(x, y, 3.4, BP_Z - 7, 7, {}), A.cylinder(x, y, 1.6, BP_Z - 10, 3, {})], { name: R.nameFor("base.feedthrough") });
  }
  // the baseplate: a thick water-cooled steel disc
  const ringSeam = L(k.sideArc(0, 0, BP_R, BP_Z + 4, P, 72) + k.sideArc(0, 0, BP_R, BP_Z + 8, P, 72), { tone: "faint" });
  let svg = S(k.cylinder(0, 0, BP_R, BP_Z, BP_TOP - BP_Z, P, 120, 1), { tone: "mid", inner: ringSeam });
  // bolt circle outside the bell flange
  const bolts = [];
  for (let i = 0; i < 36; i++) bolts.push(polar(i * 10 + 5, 69.2, BP_TOP));
  svg += Dots(bolts.map(at), { size: 0.4, tone: "mid" });
  // nozzles in the floor: TCS + H2 inlets on a small circle, off-gas ports near the wall
  svg += L(k.ring(0, 0, 47, BP_TOP, P, 96), { tone: "faint" });
  BASEPLATE = A.cylinder(0, 0, BP_R, BP_Z, BP_TOP - BP_Z, {});
  put("base", [0, 0, BP_Z], svg, [BASEPLATE], { name: "base.plate", bias: -2 });
  for (const [x, y] of [[0, 0], ...[0, 120, 240].map((d) => polar(d + 75, 16))]) {
    const n = S(k.cylinder(x, y, 3.2, BP_TOP, 2, P, 24), { tone: "mid" }) + S(k.cylinder(x, y, 2, BP_TOP + 2, 3.2, P, 20, 0.3), { tone: "mid" }) + L(k.ring(x, y, 1, BP_TOP + 5.2, P, 12), { tone: "lo" });
    put("base", [x, y, BP_TOP + 2], n, [A.cylinder(x, y, 3.2, BP_TOP, 2, {}), A.cylinder(x, y, 2, BP_TOP + 2, 3.2, {})], { name: R.nameFor("base.inlet") });
  }
  for (const d of [100, 220, 340]) {
    const [x, y] = polar(d, 46);
    const n = S(k.cylinder(x, y, 3.6, BP_TOP, 1.2, P, 24), { tone: "mid" }) + S(k.cylinder(x, y, 2.2, BP_TOP + 1.2, 0.01, P, 20), { tone: "lo", crease: "none" });
    put("base", [x, y, BP_TOP + 0.6], n, [A.cylinder(x, y, 3.6, BP_TOP, 1.2, {})], { name: R.nameFor("base.offgas") });
  }
  // electrodes: a water-cooled copper post and a graphite chuck per rod
  for (const [x, y] of feeds) {
    const e = S(k.cylinder(x, y, 4.6, BP_TOP, 1.4, P, 28), { tone: "lo" }) + S(k.cylinder(x, y, 3.4, BP_TOP + 1.4, 3, P, 24), { tone: "mid", crease: "none" }) + S(k.cylinder(x, y, 2.6, BP_TOP + 4.4, CHUCK_Z - BP_TOP - 4.4, P, 24, 0.3), { tone: "mid" });
    put("base", [x, y, BP_TOP + 4], e, [A.cylinder(x, y, 4.6, BP_TOP, 1.4, {}), A.cylinder(x, y, 3.4, BP_TOP + 1.4, 3, {}), A.cylinder(x, y, 2.6, BP_TOP + 4.4, CHUCK_Z - BP_TOP - 4.4, {})], { name: R.nameFor("base.electrode") });
  }
  // terminal box hung under the plate's rim, fed from the power cabinet
  const tb = S(k.slabOf(TBOX, BP_Z - 14, 14, P, 2, 0.4), { tone: "mid", inner: L(k.sideSeam(TBOX, BP_Z - 3, P, 2), { tone: "faint" }) });
  put("power", centreOf(TBOX, BP_Z - 7), tb, [A.slab(TBOX, BP_Z - 14, 14, {}, 2)], { name: "power.tbox" });
}

// ---- rods: six hairpins ----
// Shapes are recorded at the final diameter, the envelope the rods fill by the end of the run, so the
// painter's keys and every clearance hold at every thickness the page draws.
const HAIRPINS = [];
function rods() {
  for (let j = 0; j < M.ROD_PAIRS; j++) {
    const a = polar(15 + j * 60, RING);
    const b = polar(45 + j * 60, RING);
    const u = { feet: [a, b], zBase: CHUCK_Z, zTop: ROD_TOP };
    HAIRPINS.push(u);
    const id = `rods.pin${j}`;
    put("rods", [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (CHUCK_Z + ROD_TOP) / 2], hairpin(k, G, P, u, R_DRAW), hairpinShapes(A, G, u, R_FINAL, { owner: id }), { name: id });
  }
}

// ---- bell jar, cut away at the front ----
function bell() {
  const front = VA;
  const lo = front - NOTCH;
  const hi = front + NOTCH;
  // flange ring: back half and two front lips
  const flange = (a0, a1, tag) => {
    const ring = arcRing(FL.r0, FL.r1, a0, a1, 48);
    const boltsOn = [];
    for (let d = 5; d < 360; d += 10) {
      const rel = ((d - a0) % 360 + 360) % 360;
      if (rel > 0.5 && rel < ((a1 - a0 + 360) % 360 || 360) - 0.5) boltsOn.push(at(polar(d, 61.4, FL.z1)));
    }
    const bolts = Dots(boltsOn, { size: 0.5, tone: "mid" });
    put("bell", [Math.cos(((a0 + a1) / 2) * DEG) * 59, Math.sin(((a0 + a1) / 2) * DEG) * 59, FL.z0], S(k.extrude(ring, FL.z0, FL.z1 - FL.z0, P, { convex: false }), { tone: "mid" }) + bolts, [A.extruded(ring, FL.z0, FL.z1 - FL.z0, {})], { name: `bell.flange-${tag}` });
  };
  flange(front + 90, front + 270, "back");
  flange(hi, front + 90, "lipL");
  flange(front - 90, lo, "lipR");
  // wall: back half (the cavity) and two lips whose cut faces show the double wall
  const wallH = Z_B - FL.z1;
  const backRing = arcRing(R_IN, R_OUT, front + 90, front + 270, 72);
  const glow = `<path class="pz-glow" d="${k.extrude(backRing, FL.z1, wallH, P, { convex: false }).fill}"/>`;
  put("bell", [Math.cos((front + 180) * DEG) * 54, Math.sin((front + 180) * DEG) * 54, FL.z1], `<g class="pz-cavity">${S(k.extrude(backRing, FL.z1, wallH, P, { convex: false }), { tone: "mid", crease: "none" })}${glow}</g>`, [A.extruded(backRing, FL.z1, wallH, {})], { name: "bell.wall-back", bias: -1 });
  const lip = (a0, a1, cutAt, tag) => {
    const ring = arcRing(R_IN, R_OUT, a0, a1, 16);
    const cut = JACKET.map((r) => k.segment(polar(cutAt, r, FL.z1), polar(cutAt, r, Z_B), P)).join("");
    const water = [polar(cutAt, JACKET[0], FL.z1), polar(cutAt, JACKET[1], FL.z1), polar(cutAt, JACKET[1], Z_B), polar(cutAt, JACKET[0], Z_B)].map(at);
    const waterPath = `<path class="pz-water" d="M${water.map((p) => p.map((v) => v.toFixed(1)).join(" ")).join("L")}Z"/>`;
    put("bell", polar((a0 + a1) / 2, 54.5, (FL.z1 + Z_B) / 2), S(k.extrude(ring, FL.z1, wallH, P, { convex: false }), { tone: "mid", inner: waterPath + L(cut, { tone: "lo" }) }), [A.extruded(ring, FL.z1, wallH, {})], { name: `bell.wall-${tag}` });
  };
  lip(hi, front + 90, hi, "lipL");
  lip(front - 90, lo, lo, "lipR");
  // upper band: full shell above the cutaway, with a stiffening seam
  const band = S(k.cylinder(0, 0, R_OUT, Z_B, Z_C - Z_B, P, 120), { tone: "mid", inner: L(k.sideArc(0, 0, R_OUT, Z_B + 4, P, 72), { tone: "faint" }) });
  const BAND = A.cylinder(0, 0, R_OUT, Z_B, Z_C - Z_B, {});
  put("bell", [0, 0, (Z_B + Z_C) / 2], band, [BAND], { name: "bell.band" });
  // dome
  const domeO = [0, 0, Z_C];
  const dome = vesselCurve(R_OUT, DOME_H, DOME_H, { bottom: false });
  const F = UP(domeO);
  const seam = G.arcOf(F, 6, dome.radius(6), P, { slope: dome.slope(6) });
  const DOME = A.solid(F, dome.knots, { radius: dome.radius });
  put("bell", [0, 0, Z_C + DOME_H / 3], S(G.solidOf(dome.knots, F, P, { smooth: { slope: dome.slope, radius: dome.radius, rows: 8 } }), { tone: "mid", inner: L(seam, { tone: "faint" }) }), [DOME], { name: "bell.dome" });
  // lifting eye on top
  const padTop = padOn("bell", DOME, [0, 0, Z_C + DOME_H - 0.6], [0, 0, 1], 6, 2.6, { name: "bell.eye-pad", tone: "mid" })[2];
  const eyeF = G.frameAlong([0, -1.6, padTop + 6], [0, 1, 0]);
  put("bell", [0, 0, padTop + 4], S(k.slabOf({ x: -4, y: -1.6, w: 8, d: 3.2, r: 0.6 }, padTop, 6, P, 2, 0.3), { tone: "mid" }) + S(G.disc(0, 3.2, 4, eyeF, P), { tone: "mid" }) + L(G.circleOf(eyeF, 3.2, 1.8, P, 20), { tone: "lo" }), [A.slab({ x: -4, y: -1.6, w: 8, d: 3.2, r: 0.6 }, padTop, 6, { owner: "bell.eye" }, 2), A.disc(eyeF, 0, 3.2, 4, { owner: "bell.eye" })], { name: "bell.eye" });
  // viewport on the front-right of the band, and two cooling-water nozzles on the left
  const port = (deg, z, r, h, tag, glass) => {
    const n = polar(deg, 1, 0);
    const p = polar(deg, R_OUT - 1.2, z);
    const end = padOn("bell", BAND, p, n, r, h + 1.2, { name: `bell.${tag}`, tone: "mid" });
    const F2 = G.frameAlong(end, n);
    let svg = S(G.disc(0, 1.6, r * 1.35, F2, P), { tone: "mid" }) + Dots(G.dotsOf(F2, 1.6, r * 1.12, 8, P, { all: true }), { size: 0.4, tone: "mid" });
    if (glass) svg += `<path class="pz-glass" d="${G.circleOf(F2, 1.6, r * 0.7, P, 24)}"/>` + L(G.circleOf(F2, 1.6, r * 0.7, P, 24), { tone: "lo" });
    else svg += L(G.circleOf(F2, 1.6, r * 0.5, P, 16), { tone: "lo" });
    put("bell", G.add3(end, G.mul3(n, 0.8)), svg, [A.disc(F2, 0, 1.6, r * 1.35, {})], { name: `bell.${tag}-flange`, bias: 0.2 });
  };
  port(VA - 38, (Z_B + Z_C) / 2, 5.4, 4, "viewport", true);
  port(VA + 30, Z_B + 8, 3, 5, "water-in", false);
  port(VA + 52, Z_C - 6, 3, 5, "water-out", false);
}

// ---- feed skid: MG-Si bin, hydrochlorinator, distillation column ----
let FBR_SHELL, COL_SHELL;
let TRAYS = 0;
function hopper() {
  const legs = k.corners(HOPPER, 3);
  for (const [x, y] of byDepth(legs)) put("hopper", [x, y, HOP_Z / 2], S(k.cylinder(x, y, 3.4, 0, 1.4, P, 20), { tone: "mid" }) + S(k.cylinder(x, y, 2, 1.4, HOP_Z - 1.4, P, 20), { tone: "mid", crease: "none" }), [A.cylinder(x, y, 3.4, 0, 1.4, {}), A.cylinder(x, y, 2, 1.4, HOP_Z - 1.4, {})], { name: R.nameFor("hopper.leg") });
  const body = S(k.slabOf(HOPPER, HOP_Z, HOP_TOP - HOP_Z, P, 3, 0.6), { tone: "hi", inner: L(k.sideSeam(HOPPER, HOP_Z + 6, P, 3) + k.sideSeam(HOPPER, HOP_TOP - 6, P, 3), { tone: "faint" }) });
  put("hopper", centreOf(HOPPER, HOP_Z), body, [A.slab(HOPPER, HOP_Z, HOP_TOP - HOP_Z, {}, 3)], { name: "hopper.bin" });
  // lumps of metallurgical silicon heaped on the fill level
  const lumps = [];
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 60; i++) {
    const cx = HOPPER.x + 4.5 + rnd() * (HOPPER.w - 9);
    const cy = HOPPER.y + 4.5 + rnd() * (HOPPER.d - 9);
    const rr = 2 + rnd() * 1.3;
    const sides = 5 + Math.floor(rnd() * 2);
    const ring = Array.from({ length: sides }, (_, s) => {
      const t = (s / sides) * Math.PI * 2 + rnd() * 0.5;
      const q = rr * (0.75 + rnd() * 0.35);
      return [cx + q * Math.cos(t), cy + q * Math.sin(t)];
    });
    const hgt = 1.6 + rnd() * 2.4;
    lumps.push({ ring, hgt, c: [cx, cy] });
  }
  lumps.sort((a, b) => k.depthOf([...a.c, 0], P) - k.depthOf([...b.c, 0], P));
  // keep lumps from touching each other
  const kept = [];
  for (const l of lumps) if (kept.every((o) => Math.hypot(o.c[0] - l.c[0], o.c[1] - l.c[1]) > 5.2)) kept.push(l);
  put("hopper", centreOf(HOPPER, HOP_TOP + 1), kept.map((l) => S(k.extrude(l.ring, HOP_TOP, l.hgt, P), { tone: "hi", crease: "lo" })).join(""), kept.map((l) => A.extruded(l.ring, HOP_TOP, l.hgt, { owner: "hopper.lumps" })), { name: "hopper.lumps" });
}

function fbr() {
  const [x, y] = FBR.at;
  const length = FBR.z1 - FBR.z0;
  const c = vesselCurve(FBR.r, length, 9);
  const F = UP([x, y, FBR.z0]);
  const seams = [24, 46, 68].map((s) => G.arcOf(F, s, FBR.r, P)).join("");
  const v = vessel("fbr", [x, y, FBR.z0], FBR.r, length, 9, { inner: L(seams, { tone: "faint" }), name: "fbr.shell" });
  FBR_SHELL = v.shape;
  put("fbr", [x, y, FBR.z0 / 2], S(k.cylinder(x, y, FBR.r + 2, 0, 2, P, 48), { tone: "mid" }) + S(k.cylinder(x, y, FBR.r - 2, 2, FBR.z0 + 4 - 2, P, 48), { tone: "mid", crease: "none" }), [A.cylinder(x, y, FBR.r + 2, 0, 2, {}), A.cylinder(x, y, FBR.r - 2, 2, FBR.z0 + 2, { seated: true, cut: v.shape })], { name: "fbr.skirt" });
  void c;
  nozzle("fbr", v.shape, [x, y], 45, FBR.r, 52, 5.2, { tag: "manway", length: 2.4 });
  nozzle("fbr", v.shape, [x, y], 12, FBR.r, 20, 2.4, { tag: "hcl-in", length: 4 });
  gauge("fbr", v.shape, [x, y], 5, FBR.r, 74, { reading: 0.4 });
  // sight glass onto the fluidised bed; live.js lifts bubbles through it during hydrochlorination
  const n = polar(SIGHT.deg, 1, 0);
  const end = padOn("fbr", v.shape, [x + n[0] * (FBR.r - 0.6), y + n[1] * (FBR.r - 0.6), SIGHT.z], n, SIGHT.r, 2.6, { name: "fbr.sight-pad", tone: "mid" });
  const F2 = G.frameAlong(end, n);
  const ring = G.circleOf(F2, 1.6, SIGHT.r * 0.74, P, 32);
  const pts = Array.from({ length: 32 }, (_, i) => at(G.pointOf(F2, 1.6, SIGHT.r * 0.74, (i / 32) * Math.PI * 2)));
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  SIGHT_BOX = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  const bubbles = Array.from({ length: SIGHT.bubbles }, (_, i) => `<circle class="pz-bubble" data-b="${i}" r="${(0.5 + (i % 3) * 0.22).toFixed(2)}" cx="0" cy="0"/>`).join("");
  let svg = S(G.disc(0, 1.6, SIGHT.r * 1.3, F2, P), { tone: "mid" }) + Dots(G.dotsOf(F2, 1.6, SIGHT.r * 1.08, 8, P, { all: true }), { size: 0.4, tone: "mid" });
  svg += `<clipPath id="pz-sight-clip"><path d="${ring}"/></clipPath><path class="pz-glass" d="${ring}"/><g class="pz-bubbles" clip-path="url(#pz-sight-clip)">${bubbles}</g>` + L(ring, { tone: "lo" });
  put("fbr", G.add3(end, G.mul3(n, 0.8)), svg, [A.disc(F2, 0, 1.6, SIGHT.r * 1.3, {})], { name: "fbr.sight-flange", bias: 0.2 });
}

function column() {
  const [x, y] = COL.at;
  const length = COL.z1 - COL.z0;
  const F = UP([x, y, COL.z0]);
  const trays = [];
  for (let s = 18; s < length - 12; s += 11) trays.push(G.arcOf(F, s, COL.r, P));
  // a copy of each tray seam that live.js lights in turn, bottom to top, while the column runs
  const hot = trays.map((d, i) => `<path class="pz-tray" data-tray="${i}" d="${d}"/>`).join("");
  TRAYS = trays.length;
  const v = vessel("column", [x, y, COL.z0], COL.r, length, 6, { inner: L(trays.join(""), { tone: "faint" }) + hot, name: "column.shell" });
  COL_SHELL = v.shape;
  put("column", [x, y, COL.z0 / 2], S(k.cylinder(x, y, COL.r + 3, 0, 2, P, 40), { tone: "mid" }) + S(k.cylinder(x, y, COL.r - 1, 2, COL.z0 + 3 - 2, P, 40), { tone: "mid", crease: "none" }), [A.cylinder(x, y, COL.r + 3, 0, 2, {}), A.cylinder(x, y, COL.r - 1, 2, COL.z0 + 1, { seated: true, cut: v.shape })], { name: "column.skirt" });
  gauge("column", v.shape, [x, y], 75, COL.r, 150, { reading: 0.25 });
  nozzle("column", v.shape, [x, y], 60, COL.r, 64, 2.2, { tag: "sample", length: 2.4 });
  // caged ladder up the front-left of the column
  const rail = (deg) => polar(deg, COL.r + 4.6);
  const rails = [24, 56].map(rail).map(([dx, dy]) => [x + dx, y + dy]);
  const near = byDepth(rails);
  const z0 = 0;
  const z1 = COL.z1 - 14;
  let svg = S(k.cylinder(near[0][0], near[0][1], 0.6, z0, z1 - z0, P, 12), { tone: "mid", crease: "none" });
  const shapes = [A.cylinder(near[0][0], near[0][1], 0.6, z0, z1 - z0, { owner: "column.ladder" })];
  const along = G.unit3([near[1][0] - near[0][0], near[1][1] - near[0][1], 0]);
  const span = Math.hypot(near[1][0] - near[0][0], near[1][1] - near[0][1]) - 1.2;
  for (let z = z0 + 6; z < z1 - 2; z += 6) {
    const F2 = G.frameAlong([near[0][0] + along[0] * 0.6, near[0][1] + along[1] * 0.6, z], along);
    svg += S(G.disc(0, span, 0.42, F2, P, { steps: 10 }), { tone: "mid", crease: "none" });
    shapes.push(A.disc(F2, 0, span, 0.42, { owner: "column.ladder" }));
  }
  svg += S(k.cylinder(near[1][0], near[1][1], 0.6, z0, z1 - z0, P, 12), { tone: "mid", crease: "none" });
  shapes.push(A.cylinder(near[1][0], near[1][1], 0.6, z0, z1 - z0, { owner: "column.ladder" }));
  // stand-off brackets from the shell to each rail
  for (const zb of [40, 100, z1 - 6]) for (const [rx, ry] of near) {
    const dir = G.unit3([rx - x, ry - y, 0]);
    const from = [x + dir[0] * (COL.r - 0.3), y + dir[1] * (COL.r - 0.3), zb];
    const len = Math.hypot(rx - from[0], ry - from[1]) - 0.6;
    const F3 = G.frameAlong(from, dir);
    svg += S(G.disc(0, len, 0.5, F3, P, { steps: 10 }), { tone: "mid", crease: "none" });
    shapes.push(A.disc(F3, 0, len, 0.5, { owner: "column.ladder", seated: true, cut: v.shape }));
  }
  put("column", [x + (near[0][0] + near[1][0]) / 2 - x, (near[0][1] + near[1][1]) / 2, (z0 + z1) / 2], svg, shapes, { name: "column.ladder", bias: 0.3 });
}

function power() {
  const body = S(k.slabOf(CAB, 0, CAB_H, P, 3, 0.8), { tone: "mid", inner: L(k.sideSeam(CAB, 8, P, 3), { tone: "faint" }) });
  // door seam, louvres and a handle on the near (+y) face
  const fy = CAB.y + CAB.d;
  const face = (x0, z0, x1, z1) => k.segment([x0, fy, z0], [x1, fy, z1], P);
  const door = face(CAB.x + CAB.w / 2, 8, CAB.x + CAB.w / 2, CAB_H);
  const slots = [];
  for (let i = 0; i < 5; i++) {
    const z = 44 + i * 3.6;
    const pts = [[CAB.x + 4, z], [CAB.x + 18, z], [CAB.x + 18, z + 1.4], [CAB.x + 4, z + 1.4]].map(([px, pz]) => at([px, fy, pz]));
    slots.push(`M${pts.map((p) => p.map((v) => v.toFixed(1)).join(" ")).join("L")}Z`);
  }
  const top = L(k.planOutline(k.insetPlan(CAB, 4), CAB_H, P, 3), { tone: "faint" });
  const screws = Dots(k.corners(CAB, 2.4).map(([x, y]) => at([x, y, CAB_H])), { size: 0.45 });
  const handle = S(k.slabOf({ x: CAB.x + CAB.w / 2 + 3, y: fy, w: 2, d: 1.6, r: 0.4 }, 26, 12, P, 2), { tone: "mid" });
  const plate = { x: CAB.x + 28, z: 48, w: 12, h: 8 };
  const pp = [[plate.x, plate.z], [plate.x + plate.w, plate.z], [plate.x + plate.w, plate.z + plate.h], [plate.x, plate.z + plate.h]].map(([px, pz]) => at([px, fy, pz]));
  const lamp = `<circle class="pz-lamp" cx="${at([CAB.x + 34, fy, 40])[0].toFixed(1)}" cy="${at([CAB.x + 34, fy, 40])[1].toFixed(1)}" r="${(1.6 * KS).toFixed(2)}"/>`;
  const svg = body + L(door, { tone: "lo" }) + L(slots.join(""), { tone: "lo" }) + top + screws + L(`M${pp.map((p) => p.map((v) => v.toFixed(1)).join(" ")).join("L")}Z`, { tone: "faint" }) + lamp + handle;
  put("power", centreOf(CAB, 0), svg, [A.slab(CAB, 0, CAB_H, {}, 3), A.slab({ x: CAB.x + CAB.w / 2 + 3, y: fy, w: 2, d: 1.6, r: 0.4 }, 26, 12, {}, 2)], { name: "power.cabinet" });
}

function plumbing() {
  // MG-Si screw feeder: bin to the hydrochlorinator's lower nozzle
  const [fx, fy] = FBR.at;
  const p1 = padOn("fbr", FBR_SHELL, [fx, fy + FBR.r - 0.6, 26], [0, 1, 0], 4.6, 4, { name: "fbr.feed-pad", tone: "mid" });
  pipe("hopper", [[fx, HOPPER.y, 26], p1], 2.8, { name: "hopper.feeder", bands: [0.5], flow: "feeder" });
  // hydrochlorinator top to the column's feed tray
  const [cx, cy] = COL.at;
  const topS = FBR.z1;
  const p2a = padOn("fbr", FBR_SHELL, [fx, fy, topS - 0.6], [0, 0, 1], 3.6, 3, { name: "fbr.top-pad", tone: "mid" });
  const p2b = padOn("column", COL_SHELL, [cx, cy + COL.r - 0.5, 120], [0, 1, 0], 3.6, 3.5, { name: "column.feed-pad", tone: "mid" });
  pipe("fbr", [p2a, [fx, fy, 120], p2b], 2.2, { name: "fbr.crude", flow: "crude" });
  // purified TCS from the column foot to the reactor's inlet, under the baseplate
  const p3a = padOn("column", COL_SHELL, [cx + COL.r - 0.5, cy, 18], [1, 0, 0], 3.6, 3.5, { name: "column.draw-pad", tone: "mid" });
  pipe("column", [p3a, [-12, cy, 18], [-12, -12, 18], [-12, -12, BP_Z]], 2.2, { name: "column.tcs", bands: [0.3, 0.62], flow: "tcs" });
  // off-gas: H2, HCl and chlorosilanes leave through the baseplate to the recovery plant under the floor
  const SLEEVE = { x: 4, y: 12, w: 14, d: 14, r: 2 };
  put("base", centreOf(SLEEVE, 0), S(k.slabOf(SLEEVE, 0, 3, P, 3, 0.4), { tone: "mid" }) + Dots(k.corners(SLEEVE, 2.2).map(([x, y]) => at([x, y, 3])), { size: 0.42 }), [A.slab(SLEEVE, 0, 3, {}, 3)], { name: "base.floor-sleeve" });
  pipe("base", [[11, 19, BP_Z], [11, 19, 3]], 2.6, { name: "base.offgas", bands: [0.5] });
  // power: two cables from the cabinet to the terminal box, each through a gland at both ends
  const GL = 1.8;
  for (const dx of [5, 13]) {
    const x = CAB.x + dx;
    const y0 = CAB.y + CAB.d;
    for (const [ya, sign] of [[y0, 1], [TBOX.y, -1]]) {
      const F = G.frameAlong([x, ya, 26], [0, sign, 0]);
      put("power", [x, ya + (sign * GL) / 2, 26], S(G.disc(0, GL, 1.7, F, P, { steps: 20 }), { tone: "mid" }), [A.disc(F, 0, GL, 1.7, {})], { name: R.nameFor("power.gland") });
    }
    tubeItems("power", [[x, y0 + GL, 26], [x, TBOX.y - GL, 26]], 0.9, { name: "power.cable", tone: "mid", limp: true, maxLength: 20, spacing: 1 });
  }
}

bench();
base();
rods();
bell();
hopper();
fbr();
column();
power();
plumbing();

// cable entry and exit sit on box faces; ends recorded as terminal dots
if (!process.argv.includes("--fast")) A.settle(R, P);
R.items.sort((a, b) => a.key - b.key);
const groups = R.items.map((item, index) => {
  const [mx, my, mz] = item.move;
  const extra = item.piece === "rods" && !item.route ? ` data-pin="${item.name.replace("rods.pin", "")}"` : "";
  return `<g class="it${item.piece === "rods" ? " pz-rod" : ""}" data-piece="${item.piece}" data-k="${item.key.toFixed(2)}" data-m="${mx.toFixed(1)},${my.toFixed(1)},${mz.toFixed(1)}" data-i="${index}"${extra}>${item.svg}</g>`;
});

const LABEL = `A Siemens polysilicon reactor, cut away at the front, on a bench beside its feed skid. Left to right: a bin of metallurgical silicon lumps feeding a fluidised-bed hydrochlorinator, a distillation column, and the reactor: a steel bell jar with a double, water-cooled wall, bolted to a baseplate that carries ${M.ROD_PAIRS * 2} electrodes holding ${M.ROD_PAIRS} U-shaped silicon rods. A power cabinet feeds the electrodes.`;
const svg = k.figureSvg({ width: W, height: H, label: LABEL, body: [`<g class="pz-layers">${groups.join("")}</g>`], className: "pz-svg" });

const unit = (vector) => {
  const o = at([0, 0, 0]);
  const p = at(vector);
  return [p[0] - o[0], p[1] - o[1]];
};
const DATA = {
  P,
  V,
  EX: unit([1, 0, 0]),
  EY: unit([0, 1, 0]),
  EZ: unit([0, 0, 1]),
  pins: HAIRPINS,
  rSlim: R_SLIM,
  rFinal: R_FINAL,
  mm: { slim: M.CVD.slimMm, final: M.FINAL_MM, draw: M.DRAW_MM },
  rodC: M.CVD.rodC,
  steps: M.STEPS.map((s) => ({ ...s })),
  pieces: Object.fromEntries(Object.entries(PIECES).map(([id, p]) => [id, { name: p.name, say: p.say }])),
  order: ORDER,
  stepPiece: { mgsi: "hopper", tcs: "fbr", dist: "column", cvd: "rods", harvest: "rods" },
  idle: M.IDLE,
  sight: SIGHT_BOX,
  trays: TRAYS,
};
DATA.pieces.hopper.say = M.STEPS[0].say;
DATA.pieces.fbr.say = M.STEPS[1].say;
DATA.pieces.column.say = M.STEPS[2].say;
DATA.pieces.rods.say = `${M.ROD_PAIRS} hairpins · Ø ${M.CVD.slimMm} → ${M.FINAL_MM} mm · ~${M.CVD.rodC} °C`;

const PARTS = ORDER.map((id, index) => `<button type="button" class="pz-part" data-part="${id}"><span class="pz-num">${String(index + 1).padStart(2, "0")}</span>${PIECES[id].name}</button>`).join("");
const corners = `<div class="iso-plate-corners" aria-hidden="true"><span class="iso-plate-corner" data-corner="fig">Fig 1</span><span class="iso-plate-corner" data-corner="title">Siemens reactor · cutaway</span><span class="iso-plate-corner" data-corner="readout" data-readout>${M.IDLE}</span></div>`;
const controls = `<div class="pz-controls"><span class="pz-hint">Hover a part · Space plays the process</span><span class="pz-live" aria-live="polite" data-live></span></div>`;
const stage = `<div class="pz-stage" tabindex="0" role="group" aria-label="Siemens polysilicon reactor and feed skid. Hover a part, or use the arrow keys, to pick it; Space plays the process from sand to rods or pauses it; Escape resets; the slider below steps through the five stages.">${svg}</div>`;
const caption = `Polysilicon for chips is made in about five stages. Quartz is reduced with carbon in an arc furnace running above ${M.MGSI.furnaceC} °C to metallurgical-grade silicon of ${M.MGSI.puritySoG}–${M.MGSI.purityEG} % (the bin). Ground silicon reacts with HCl at about ${M.TCS.synthesisC} °C in a fluidised bed to give trichlorosilane, SiHCl₃ (the hydrochlorinator). SiHCl₃ boils at ${M.TCS.boilC} °C, so it is distilled to purity, ${M.DIST.passesEG} times for electronic grade (the column). In the Siemens reactor, current heats thin silicon rods to about ${M.CVD.rodC} °C under a steel bell jar, and SiHCl₃ with hydrogen deposits silicon on them (${M.CVD.reaction}) until they grow from ${M.CVD.slimMm} mm to ${M.CVD.finalMm[0]}–${M.CVD.finalMm[1]} mm across. Then the bell is lifted and the rods are harvested, crushed and etched: ${M.GRADE.egNines[0]}N–${M.GRADE.egNines[1]}N pure. Rod diameters follow the ruler (small ticks ≈ ${((M.DRAW_MM * 5) / 10).toFixed(1)} cm, large ticks ≈ ${((M.DRAW_MM * 25) / 10).toFixed(0)} cm); the rod count, rod length, vessel sizes and the skid beside the reactor are illustrative and not to scale.`;
const scrub = `<span class="pz-scrub"><button type="button" class="pz-play" data-play aria-label="Play the process"><span class="pz-play-icon" aria-hidden="true"></span><span data-play-text>Play</span></button><input type="range" class="pz-range" data-scrub min="0" max="1000" step="1" value="0" aria-label="Process: 0 is the raw silicon, 1000 is the harvested rods"><span class="pz-step" data-step>01 · metallurgical silicon</span></span>`;
const body = `<figure class="iso-figure pz"><div class="iso-plate">${corners}${stage}${controls}</div><figcaption class="iso-legend">${scrub}<span class="pz-parts">${PARTS}</span><span class="iso-caption">${caption}</span></figcaption></figure>`;

const CSS = readFileSync(join(HERE, "polysilicon.css"), "utf8");
const lathe = readFileSync(join(HERE, "../../vendor/anatomy/kit/lathe.mjs"), "utf8").replace(/^import .*$/m, "").replace(/^export /gm, "");
const rodsSrc = readFileSync(join(HERE, "rods.mjs"), "utf8").replace(/^export /gm, "");
const LIVE = readFileSync(join(HERE, "live.js"), "utf8").replace("__DATA__", JSON.stringify(DATA));
const script = `${kitScript()}\nconst G = (() => {${lathe}\nreturn { disc, sphereOf, frameAlong, viewOf, dot3, sub3, unit3, len3 };})();\n${rodsSrc}\n${LIVE}`;
const out = writeChapter({ slug: "polysilicon", figure: body, css: CSS, script, lesson: LESSON });
console.log("wrote", out.file, `${out.kb} KB`, `${R.items.length} items`, `${R.solids.length} solids`);

A.auditOrExit(R, P);
