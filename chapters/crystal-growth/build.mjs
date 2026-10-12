// A Czochralski crystal puller with its front quarter cut away, growing a 300 mm silicon crystal.
// node build.mjs [--fast] [--audit]
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as M from "./model.mjs";
import { k, G, A, Tube } from "../../site/kit.mjs";
import { writeChapter } from "../../site/shell.mjs";
import { LESSON } from "./lesson.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const U = 0.2; // world units per mm: one unit is 5 mm
const DEG = Math.PI / 180;

// ---- world layout, z up, units of 5 mm ----
const W = 640;
const H = 940;
const AZIMUTH = 45;
const ELEVATION = 30;

const PLATE = { x: -184, y: -186, w: 334, d: 336, r: 12 };
const PLATE_H = 10;
const FOOT_H = 6;

const MELT = 196; // melt surface: the crucible rises to hold it here
const R_VESSEL = (M.PULLER.vesselMm / 2) * U; // 94
const R_CRUCIBLE = (M.PULLER.crucibleMm / 2) * U; // 61
const R_GATE = (M.PULLER.gateMm / 2) * U; // 36
const DEPTH0 = M.meltDepthMm(M.RUN.chargeKg) * U; // melt depth with the whole charge molten
const DEPTH1 = M.meltDepthMm(M.RUN.residualKg) * U; // what is left at the end
const LIFT = DEPTH0 - DEPTH1; // the crucible rises this far while the crystal grows
const CRU_IN = 60; // quartz wall 2 units (10 mm) thick, outer at the 610 mm size
const CRU_OUT = R_CRUCIBLE + 1;
const CRU_FLOOR = MELT - DEPTH0; // inner floor at rest
const CRU_RIM = CRU_FLOOR + 56;
const SUS_IN = CRU_OUT;
const SUS_OUT = SUS_IN + 4;
const SUS_FLOOR = CRU_FLOOR - 2; // susceptor inner floor = crucible underside
const SUS_BASE = SUS_FLOOR - 5;
const SUS_RIM = CRU_FLOOR + 48;
const PED_TOP = SUS_BASE;
const PED_BASE = PED_TOP - 6;

const FLOOR = [60, 66];
const WALL_TOP = 284;
const FLANGE_TOP = 290;
const DOME0 = 290;
const DOME_A = 94;
const DOME_C = 56;
const DOME1 = DOME0 + DOME_C * Math.sqrt(1 - (44 / 94) ** 2);
const NECK = [DOME1, 360];
const GATE = [366, 392];
const PULL = [398, 684];
const HEAD0 = 690;

const INS = { rIn: 78, rOut: 88, z0: 76, z1: 262 };
const HEATER = { rIn: 70, rOut: 73, z0: 118, z1: 232 };
const SHIELD = { z0: MELT + 8, z1: 262, r0: 38, r1: 52 };

const SEED_TOP_PARK = MELT + 150 + 20;
const GROWN = M.GROWN_MM * U;
const SEG = Object.fromEntries(Object.entries(M.SEG).map(([key, mm]) => [key, mm * U]));
const LIFT_OUT = GATE[1] + 10 - MELT; // the finished crystal is lifted until its tail clears the gate

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [0, 0, HEAD0 + 60], [-150, -55, HEAD0 + 64]],
  W,
  H,
  { pad: 26, azimuth: AZIMUTH, elevation: ELEVATION },
);
const V = G.viewOf(P);
const LIGHT = G.lightOf(P);
const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);
const AXIS = G.frameOf([0, 0, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
const up = (x, y, z = 0) => G.frameOf([x, y, z], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
const pathOf = (points, closed = false) => k.pathOf(points.map(at), closed);

// ---- recorder ----
// the charge is only ever drawn at rest: once the crucible moves it has melted, so its states send it out of the picture
const MOVES = { fixed: [0, 0, 0], charge: [3000, 0, 0], crucible: [0, 0, LIFT], gate: [-100 * Math.SQRT1_2, 100 * Math.SQRT1_2, 0] };
const R = A.recorder(P, {});
const LIVE_ITEMS = [];
function put(part, ref, svg, shapes, { piece = "fixed", bias = 0, name, live = false } = {}) {
  const id = name ?? R.nameFor(`${part}.item`);
  shapes.forEach((shape) => {
    shape.name = shape.name ?? id;
    shape.owner = shape.owner ?? id;
  });
  const item = R.put({ piece, at: ref, bias, svg, move: MOVES[piece], shapes: shapes.map(R.solid), name: id, part });
  if (live) LIVE_ITEMS.push(id);
  return item;
}
const BIG = 4000;
const half = { xp: A.box([0, -BIG, -BIG], [BIG, BIG, BIG]), xn: A.box([-BIG, -BIG, -BIG], [0, BIG, BIG]), yp: A.box([-BIG, 0, -BIG], [BIG, BIG, BIG]), yn: A.box([-BIG, -BIG, -BIG], [BIG, 0, BIG]) };
// the removed side of the plane through the axis at angle deg: below it (side -1) or above it (side +1)
const beyond = (deg, side) => {
  const n = [-Math.sin(deg * DEG) * side, Math.cos(deg * DEG) * side, 0];
  return A.orientedBox([(-n[0] * BIG) / 2, (-n[1] * BIG) / 2, 0], [n, [-n[1], n[0], 0], [0, 0, 1]], [BIG / 2, BIG, BIG]);
};
// sectors of the kept arc, split where the outer wall turns away, so each can be ordered on its own
function sectorsFor([k0, k1] = [90, 360]) {
  const marks = [...new Set([k0, ...[90, 135, 180, 270, 315, 360].filter((a) => a > k0 && a < k1), k1])];
  const out = [];
  for (let i = 0; i < marks.length - 1; i++) {
    const a0 = marks[i];
    const a1 = marks[i + 1];
    const faces = [];
    if (a0 === k0) faces.push({ deg: a0, n: [Math.sin(a0 * DEG), -Math.cos(a0 * DEG), 0] });
    if (a1 === k1) faces.push({ deg: a1, n: [-Math.sin(a1 * DEG), Math.cos(a1 * DEG), 0] });
    out.push({ id: `s${a0}`, a0, a1, cut: [beyond(a0, 1), beyond(a1, -1)], faces });
  }
  return out;
}
const QUADS = sectorsFor([90, 360]);
const HALF = sectorsFor([135, 315]);

// ---- cutaway shells: a turned wall with the quarter facing the viewer removed ----
const toneOf = (normal) => G.bandOf(G.dot3(G.unit3(normal), LIGHT));
const ptc = (r, deg, z) => [r * Math.cos(deg * DEG), r * Math.sin(deg * DEG), z];
const rOf = (spec) => (typeof spec === "function" ? spec : () => spec);
function arcPts(r, z, a0, a1, step = 2) {
  const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) / step));
  return Array.from({ length: n + 1 }, (_, i) => ptc(r, a0 + ((a1 - a0) * i) / n, z));
}
// angle ranges in [a0, a1] where f(angle) > 0
function runsWhere(a0, a1, f, step = 1) {
  const out = [];
  let start = null;
  const n = Math.ceil((a1 - a0) / step);
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    const ok = f(a) > 0;
    if (ok && start === null) start = a;
    if (!ok && start !== null) {
      out.push([start, a - (a1 - a0) / n]);
      start = null;
    }
  }
  if (start !== null) out.push([start, a1]);
  return out.filter(([x, y]) => y - x > 0.5);
}
const facesOut = (deg, slope = 0) => Math.cos((deg - AZIMUTH) * DEG) * Math.cos(ELEVATION * DEG) - slope * Math.sin(ELEVATION * DEG);

// Tone sheets for a turned wall r(z) over the angles [a0, a1]: at every level the visible tone runs are found
// (every half degree); where two levels have the same runs, each run becomes one quad, so tone edges follow
// the true light curve instead of stepping facet by facet. sign is +1 for the outer face, -1 for the inner.
function wallTones(rf, levels, a0, a1, sign) {
  const slopes = levels.map((z, i) => {
    const za = levels[Math.max(0, i - 1)];
    const zb = levels[Math.min(levels.length - 1, i + 1)];
    return (rf(zb) - rf(za)) / (zb - za || 1);
  });
  const keyAt = (deg, m) => {
    const normal = [sign * Math.cos(deg * DEG), sign * Math.sin(deg * DEG), -sign * m];
    return G.dot3(normal, V) > 1e-6 ? toneOf(normal) : -1;
  };
  const runsAt = (m) => {
    const n = Math.max(2, Math.ceil((a1 - a0) / 0.5));
    const runs = [];
    let prev = a0;
    for (let i = 0; i <= n; i++) {
      const deg = a0 + ((a1 - a0) * i) / n;
      const key = keyAt(deg, m);
      const last = runs[runs.length - 1];
      if (!last || last.k !== key) {
        const edge = i ? (prev + deg) / 2 : a0;
        if (last) last.b = edge;
        runs.push({ k: key, a: edge, b: deg });
      } else last.b = deg;
      prev = deg;
    }
    runs[runs.length - 1].b = a1;
    return runs;
  };
  const out = [[], [], [], [], []];
  const ring = levels.map((z, i) => runsAt(slopes[i]));
  for (let i = 0; i < levels.length - 1; i++) {
    const za = levels[i];
    const zb = levels[i + 1];
    const A0 = ring[i];
    const B0 = ring[i + 1];
    if (A0.length === B0.length && A0.every((run, j) => run.k === B0[j].k)) {
      A0.forEach((run, j) => {
        if (run.k < 0) return;
        const other = B0[j];
        out[run.k].push(pathOf([...arcPts(rf(za), za, run.a, run.b, 1.5), ...arcPts(rf(zb), zb, other.b, other.a, 1.5)], true));
      });
    } else {
      const m = (rf(zb) - rf(za)) / (zb - za);
      for (let deg = a0; deg < a1 - 1e-6; deg += 0.75) {
        const e = Math.min(a1, deg + 0.75);
        const key = keyAt((deg + e) / 2, m);
        if (key >= 0) out[key].push(pathOf([ptc(rf(za), deg, za), ptc(rf(za), e, za), ptc(rf(zb), e, zb), ptc(rf(zb), deg, zb)], true));
      }
    }
  }
  return out.map((list) => list.join(""));
}

function shell(part, { name, owner, piece = "fixed", z0, z1, rIn, rOut, zs = null, tone = "mid", step = 3, quads = QUADS, inner = () => "", top = true, bias = 0 }) {
  const ri = rOf(rIn);
  const ro = rOf(rOut);
  const levels = zs ?? [z0, z1];
  const slopeOf = (f, z) => (f(Math.min(z1, z + 0.05)) - f(Math.max(z0, z - 0.05))) / (Math.min(z1, z + 0.05) - Math.max(z0, z - 0.05));
  const poly = [...levels.map((z) => [z, ri(z)]), ...[...levels].reverse().map((z) => [z, ro(z)])];
  for (const q of quads) {
    const shadeIn = ri(z0) > 0.01 || ri(z1) > 0.01 ? wallTones(ri, levels, q.a0, q.a1, -1) : ["", "", "", "", ""];
    const shadeOut = wallTones(ro, levels, q.a0, q.a1, 1);
    const group = (list) => list.map((d, tone) => (d ? (tone === 4 ? `<path class="iso-top" d="${d}"/>` : `<path class="iso-shade" data-shade="${tone}" d="${d}"/>`) : "")).join("");
    const parts = [];
    const edges = [];
    parts.push(`<g class="iso-solid" data-seamless="">${group(shadeIn)}</g>`);
    parts.push(`<g class="iso-solid" data-seamless="">${group(shadeOut)}</g>`);
    // the cut face, in the plane of the cut
    for (const { deg, n: normal } of q.faces) {
      const face = [...levels.map((z) => ptc(ri(z), deg, z)), ...[...levels].reverse().map((z) => ptc(ro(z), deg, z))];
      parts.push(`<path class="iso-shade cz-cut" data-shade="${Math.min(3, toneOf(normal))}" d="${pathOf(face, true)}"/>`);
      edges.push(pathOf(face, true));
    }
    if (top && ro(z1) - ri(z1) > 0.01) {
      const ring = [...arcPts(ro(z1), z1, q.a0, q.a1), ...arcPts(ri(z1), z1, q.a1, q.a0)];
      parts.push(`<path class="iso-top" d="${pathOf(ring, true)}"/>`);
    }
    // edges: top rims, bottom rims where the wall shows, outer limbs
    edges.push(pathOf(arcPts(ro(z1), z1, q.a0, q.a1)));
    if (ri(z1) > 0.01) edges.push(pathOf(arcPts(ri(z1), z1, q.a0, q.a1)));
    for (const [a, b] of runsWhere(q.a0, q.a1, (deg) => facesOut(deg, slopeOf(ro, z0)))) edges.push(pathOf(arcPts(ro(z0), z0, a, b)));
    if (ri(z0) > 0.01) for (const [a, b] of runsWhere(q.a0, q.a1, (deg) => -facesOut(deg, slopeOf(ri, z0)))) edges.push(pathOf(arcPts(ri(z0), z0, a, b)));
    for (const sign of [1, -1]) {
      const limb = [];
      for (const z of levels.length > 2 ? levels : [z0, z1]) {
        const c = (slopeOf(ro, z) * Math.tan(ELEVATION * DEG));
        if (Math.abs(c) > 1) continue;
        let deg = AZIMUTH + sign * Math.acos(c) / DEG;
        deg = ((deg % 360) + 360) % 360;
        if (deg < q.a0 - 1e-6 || deg > q.a1 + 1e-6) continue;
        limb.push(ptc(ro(z), deg, z));
      }
      if (limb.length > 1) edges.push(pathOf(limb));
    }
    const extra = inner(q, { ri, ro });
    parts.push(extra);
    parts.push(`<path class="iso-line iso-edge" data-tone="${tone}" d="${edges.join("")}"/>`);
    const midA = (q.a0 + q.a1) / 2;
    const rm = (ri((z0 + z1) / 2) + ro((z0 + z1) / 2)) / 2;
    const shape = A.body(AXIS, poly, { cut: q.cut, ...(owner ? { owner } : {}) });
    put(part, ptc(rm, midA, (z0 + z1) / 2), `<g class="cz-shell">${parts.join("")}</g>`, [shape], { piece, name: `${name}.${q.id}`, bias });
  }
}

// lines on a cut shell: an arc on the outer wall, clipped to the visible, kept part of a quadrant
function wallArc(q, r, z, slope = 0) {
  return runsWhere(q.a0, q.a1, (deg) => facesOut(deg, slope))
    .map(([a, b]) => pathOf(arcPts(r, z, a, b)))
    .join("");
}
function topDots(q, r, z, every) {
  const out = [];
  for (let deg = q.a0 + every / 2; deg < q.a1; deg += every) out.push(at(ptc(r, deg, z)));
  return out;
}

// ---- simple parts ----
const slabShape = (plan, z, h, steps = 4) => A.slab(plan, z, h, {}, steps);
const cylShape = (x, y, r, z, h) => A.cylinder(x, y, r, z, h, {});
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
function rotRect(cx, cy, deg, along0, along1, across) {
  const c = Math.cos(deg * DEG);
  const s = Math.sin(deg * DEG);
  const pts = [
    [along0, -across],
    [along1, -across],
    [along1, across],
    [along0, across],
  ];
  return pts.map(([a, b]) => [cx + a * c - b * s, cy + a * s + b * c]);
}
const boxAlong = (deg, along0, along1, across, z, h, P2 = P) => k.extrude(rotRect(0, 0, deg, along0, along1, across), z, h, P2);
const boxAlongShape = (deg, along0, along1, across, z, h, meta = {}) => A.extruded(rotRect(0, 0, deg, along0, along1, across), z, h, meta);

// ===================== stand =====================
function stand() {
  const back = [];
  const shapes = [];
  back.push(`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`);
  for (const [x, y] of byDepth(k.corners(PLATE, 26))) {
    back.push(S(k.cylinder(x, y, 9, -PLATE_H - FOOT_H, 2, P, 28), { tone: "lo" }));
    back.push(S(k.cylinder(x, y, 7, -PLATE_H - FOOT_H + 2, FOOT_H - 2, P, 28), { tone: "mid" }));
    shapes.push(A.cylinder(x, y, 9, -PLATE_H - FOOT_H, FOOT_H, { name: "stand.foot" }));
  }
  back.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid", inner: L(k.sideSeam(PLATE, -PLATE_H + 3, P, 8), { tone: "faint" }) }));
  shapes.push(A.slab(PLATE, -PLATE_H, PLATE_H, { name: "stand.plate" }));
  back.push(L(k.planOutline(k.insetPlan(PLATE, 6), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 12);
  back.push(L(screws.map(([x, y]) => k.ring(x, y, 2.6, 0, P, 16)).join(""), { tone: "lo" }));
  back.push(Dots(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // ruler strip along the near +x edge: 50 mm ticks, majors every 250 mm
  const strip = { x: PLATE.x + PLATE.w - 18, y: -160, w: 8, d: 220, r: 1 };
  back.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.y + 4, strip.y + strip.d - 4, 50 * U, 5, strip.x + 0.8, 0.6, [2.2, 4], P, "y");
  back.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  back.push(Dots([at([strip.x + 4, strip.y + 2, 0.6]), at([strip.x + 4, strip.y + strip.d - 2, 0.6])], { size: 0.45 }));
  // label plate on the near +y edge
  const label = { x: -30, y: PLATE.y + PLATE.d - 26, w: 96, d: 16, r: 1.5 };
  back.push(S(k.slabOf(label, 0, 0.8, P, 4), { tone: "lo", crease: "none" }));
  back.push(L(k.planOutline(k.insetPlan(label, 1.8), 0.8, P, 4), { tone: "faint" }));
  back.push(L([0, 1, 2].map((i) => k.lineOnTop([label.x + 8, label.y + 5 + i * 3], [label.x + 78 - i * 18, label.y + 5 + i * 3], 0.8, P)).join(""), { tone: "lo", free: true }));
  back.push(Dots([at([label.x + 4, label.y + label.d / 2, 0.8]), at([label.x + label.w - 4, label.y + label.d / 2, 0.8])], { size: 0.45 }));
  put("stand", [0, 0, -1], back.join(""), shapes, { name: "stand.base", bias: -800 });

  // mast: the column that carries the pull chamber and head, with a lift carriage
  const MAST_DEG = 200;
  const foot = rotRect(0, 0, MAST_DEG, 143, 177, 17);
  const column = rotRect(0, 0, MAST_DEG, 148, 172, 12);
  const mastSvg =
    S(k.extrude(foot, 0, 4, P, { bevel: 0.6 }), { tone: "mid" }) +
    S(k.extrude(column, 4, HEAD0 + 56, P, { bevel: 0.6 }), { tone: "mid", inner: L([120, 300, 420].map((z) => k.ringSeam(column, z, P)).join(""), { tone: "faint" }) }) +
    Dots(rotRect(0, 0, MAST_DEG, 145.5, 174.5, 14.5).map(([x, y]) => at([x, y, 4])), { size: 0.45 });
  put("stand", [...ptc(160, MAST_DEG, 0).slice(0, 2), 300], mastSvg, [A.extruded(foot, 0, 4), A.extruded(column, 4, HEAD0 + 56)], { name: "stand.mast" });
}

// ===================== furnace chamber =====================
function furnace() {
  // legs under the floor flange
  for (const deg of [190, 255, 330]) {
    const [x, y] = ptc(97, deg, 0);
    const svg =
      S(k.cylinder(x, y, 9, 0, 2, P, 28), { tone: "lo" }) +
      S(k.cylinder(x, y, 5, 2, FLOOR[0] - 6, P, 24), { tone: "mid", crease: "none", inner: L(k.sideArc(x, y, 5, 24, P, 16), { tone: "faint" }) }) +
      S(k.cylinder(x, y, 7, FLOOR[0] - 4, 4, P, 28), { tone: "mid" }) +
      Dots([at([x, y, 0])], { size: 0 });
    put("furnace", [x, y, 30], svg, [cylShape(x, y, 9, 0, 2), cylShape(x, y, 5, 2, FLOOR[0] - 6), cylShape(x, y, 7, FLOOR[0] - 4, 4)], { name: R.nameFor("furnace.leg") });
  }
  // floor plate with its flange
  shell("furnace", {
    name: "furnace.floor",
    z0: FLOOR[0],
    z1: FLOOR[1],
    rIn: 9,
    rOut: 100,
    inner: (q) => Dots(topDots(q, 96, FLOOR[1], 10), { size: 0.45 }),
  });
  // double wall, water jacket seam bands
  shell("furnace", {
    name: "furnace.wall",
    z0: FLOOR[1],
    z1: WALL_TOP,
    rIn: 90,
    rOut: R_VESSEL,
    inner: (q) => L([100, 180, 250].map((z) => wallArc(q, R_VESSEL, z)).join(""), { tone: "faint" }),
  });
  shell("furnace", {
    name: "furnace.flange",
    z0: WALL_TOP,
    z1: FLANGE_TOP,
    rIn: 88,
    rOut: 100,
    inner: (q) => Dots(topDots(q, 96, FLANGE_TOP, 9), { size: 0.45 }),
  });
  // dome: an elliptical head up to the neck
  const domeOut = (z) => DOME_A * Math.sqrt(Math.max(0, 1 - ((z - DOME0) / DOME_C) ** 2));
  const domeIn = (z) => Math.max(0, domeOut(z) - 3.4);
  const zs = Array.from({ length: 25 }, (_, i) => DOME0 + (DOME1 - DOME0) * (1 - (1 - i / 24) ** 1.6));
  shell("furnace", {
    name: "furnace.dome",
    z0: DOME0,
    z1: DOME1,
    rIn: domeIn,
    rOut: domeOut,
    zs,
    step: 2,
    inner: (q) => L(wallArc(q, domeOut(DOME0 + 22), DOME0 + 22, (domeOut(DOME0 + 22.05) - domeOut(DOME0 + 21.95)) / 0.1), { tone: "faint" }),
  });
  shell("furnace", { name: "furnace.neck", z0: NECK[0], z1: NECK[1], rIn: R_GATE, rOut: 42 });
  shell("furnace", {
    name: "furnace.neckflange",
    z0: NECK[1],
    z1: GATE[0],
    rIn: R_GATE,
    rOut: 52,
    inner: (q) => Dots(topDots(q, 48, GATE[0], 15), { size: 0.45 }),
  });
}

// ===================== hot zone =====================
function hotZone() {
  shell("shield", { name: "shield.felt-floor", z0: FLOOR[1], z1: INS.z0, rIn: 9, rOut: INS.rOut, tone: "lo" });
  shell("shield", {
    name: "shield.felt",
    z0: INS.z0,
    z1: INS.z1,
    rIn: INS.rIn,
    rOut: INS.rOut,
    tone: "lo",
  });
  // heat shield: a cone that hangs from the felt to just above the melt
  const coneOut = (z) => SHIELD.r0 + 4 + ((SHIELD.r1 - SHIELD.r0) * (z - SHIELD.z0)) / (SHIELD.z1 - SHIELD.z0);
  const coneIn = (z) => coneOut(z) - 3;
  shell("shield", { name: "shield.cone", z0: SHIELD.z0, z1: SHIELD.z1, rIn: coneIn, rOut: coneOut, tone: "mid", quads: HALF });
  shell("shield", {
    name: "shield.lid",
    quads: HALF,
    z0: SHIELD.z1,
    z1: SHIELD.z1 + 4,
    rIn: coneIn(SHIELD.z1),
    rOut: INS.rOut,
    tone: "mid",
  });
  // heater: slotted graphite cylinder, its slots seen on the inner wall
  shell("heater", {
    name: "heater.body",
    z0: HEATER.z0,
    z1: HEATER.z1,
    rIn: HEATER.rIn,
    rOut: HEATER.rOut,
    tone: "mid",
    inner: (q) => {
      const slots = [];
      for (let deg = q.a0 + 7.5; deg < q.a1; deg += 15) {
        const fromTop = Math.round((deg - 7.5) / 15) % 2 === 0;
        const z0 = fromTop ? HEATER.z0 + 14 : HEATER.z0;
        const z1 = fromTop ? HEATER.z1 : HEATER.z1 - 14;
        const facing = -Math.cos((deg - AZIMUTH) * DEG);
        if (facing < 0.25) continue;
        const a = deg - 1.4;
        const b = deg + 1.4;
        const pts = [...arcPts(HEATER.rIn, z0, a, b, 1), ...arcPts(HEATER.rIn, z1, b, a, 1)];
        slots.push(pathOf(fromTop ? [ptc(HEATER.rIn, a, z1), ptc(HEATER.rIn, a, z0), ...arcPts(HEATER.rIn, z0, a, b, 1), ptc(HEATER.rIn, b, z1)] : [ptc(HEATER.rIn, a, z0), ptc(HEATER.rIn, a, z1), ...arcPts(HEATER.rIn, z1, a, b, 1), ptc(HEATER.rIn, b, z0)]));
        void pts;
      }
      return `<path class="iso-line cz-glow" data-tone="lo" d="${slots.join("")}"/>`;
    },
  });
  // electrodes: two graphite posts carry the heater down through the floor
  for (const deg of [205, 245]) {
    const [x, y] = ptc((HEATER.rIn + HEATER.rOut) / 2, deg, 0);
    const svg = S(k.cylinder(x, y, 3.4, FLOOR[1] + 10, HEATER.z0 - FLOOR[1] - 10, P, 20), { tone: "mid", crease: "none" }) + S(k.cylinder(x, y, 5, INS.z0, 4, P, 24), { tone: "mid" });
    const below = S(k.cylinder(x, y, 6, FLOOR[0] - 4, 4, P, 28), { tone: "mid" }) + S(k.cylinder(x, y, 3.4, FLOOR[0] - 16, 12, P, 20), { tone: "mid", crease: "none" }) + S(k.slabOf({ x: x - 5, y: y - 5, w: 10, d: 10, r: 1 }, FLOOR[0] - 24, 8, P, 3, 0.4), { tone: "mid" }) + Dots([at([x - 2.5, y + 2.5, FLOOR[0] - 16]), at([x + 2.5, y - 2.5, FLOOR[0] - 16])], { size: 0.4 });
    put("heater", [x, y, FLOOR[0] - 12], below, [cylShape(x, y, 6, FLOOR[0] - 4, 4), cylShape(x, y, 3.4, FLOOR[0] - 16, 12), slabShape({ x: x - 5, y: y - 5, w: 10, d: 10, r: 1 }, FLOOR[0] - 24, 8, 3)], { name: R.nameFor("heater.feedthrough") });
    put("heater", [x, y, 96], svg, [cylShape(x, y, 3.4, FLOOR[1] + 10, HEATER.z0 - FLOOR[1] - 10), cylShape(x, y, 5, INS.z0, 4)], { name: R.nameFor("heater.electrode") });
  }
}

// ===================== crucible group (rises as the melt is used) =====================
function crucible() {
  // pedestal plate under the susceptor
  shell("crucible", { name: "crucible.pedestal", piece: "crucible", z0: PED_BASE, z1: PED_TOP, rIn: 0, rOut: 40, tone: "mid" });
  shell("crucible", { name: "crucible.susfloor", piece: "crucible", z0: SUS_BASE, z1: SUS_FLOOR, rIn: 0, rOut: SUS_OUT, tone: "mid", top: true });
  shell("crucible", {
    name: "crucible.susceptor",
    piece: "crucible",
    z0: SUS_FLOOR,
    z1: SUS_RIM,
    rIn: SUS_IN,
    rOut: SUS_OUT,
    tone: "mid",
    inner: (q) => L(wallArc(q, SUS_OUT, SUS_FLOOR + 22), { tone: "faint" }),
  });
  shell("crucible", { name: "crucible.quartzfloor", piece: "crucible", z0: CRU_FLOOR - 2, z1: CRU_FLOOR, rIn: 0, rOut: CRU_IN, tone: "hi", top: true });
  shell("crucible", { name: "crucible.quartz", piece: "crucible", z0: CRU_FLOOR - 2, z1: CRU_RIM, rIn: CRU_IN, rOut: CRU_OUT, tone: "hi" });
  // shaft: one rod out of the floor gland, rising with the crucible
  const F = G.frameOf([0, 0, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
  const ROD = G.rodOut(F, INS.z0, PED_BASE, 9, P, { stroke: LIFT });
  const svg = `<clipPath id="cz-shaft"><path data-hold d="${ROD.clip}"/></clipPath><g clip-path="url(#cz-shaft)">${S(ROD.paths, { tone: "mid", crease: "none" })}</g>`;
  put("crucible", [0, 0, (INS.z0 + PED_BASE) / 2], svg, [A.slide(F, INS.z0, PED_BASE, 9, { name: "crucible.shaft" })], { piece: "crucible", name: "crucible.shaft" });
}

// ===================== gate valve =====================
const SLOT = [376, 379];
function gate() {
  // the valve body in two rings, with the slot between them that the gate plate slides through
  shell("gate", { name: "gate.lower", owner: "gate", z0: GATE[0], z1: SLOT[0], rIn: R_GATE, rOut: 56 });
  shell("gate", {
    name: "gate.body",
    owner: "gate",
    z0: SLOT[1],
    z1: GATE[1],
    rIn: R_GATE,
    rOut: 56,
    inner: (q) => Dots(topDots(q, 52, GATE[1], 15), { size: 0.45 }),
  });
  // bonnet: the box the gate plate parks in, toward screen right
  const deg = -45;
  const from = 56;
  const to = 140;
  const bonnet = S(boxAlong(deg, from, to, 44, GATE[0] + 3, 20), { tone: "mid", inner: L(k.ringSeam(rotRect(0, 0, deg, from, to, 44), GATE[0] + 13, P), { tone: "faint" }) });
  const coverRing = rotRect(0, 0, deg, from + 6, to - 6, 36);
  const cover = S(k.extrude(coverRing, GATE[0] + 23, 1.2, P, { bevel: 0.4 }), { tone: "mid" });
  const screws = [];
  for (const t of [0.08, 0.36, 0.64, 0.92]) for (const side of [-32, 32]) {
    const a = from + 6 + (to - from - 12) * t;
    screws.push(at([a * Math.cos(deg * DEG) - side * Math.sin(deg * DEG), a * Math.sin(deg * DEG) + side * Math.cos(deg * DEG), GATE[0] + 24.2]));
  }
  put("gate", [98 * Math.SQRT1_2, -98 * Math.SQRT1_2, GATE[0] + 13], bonnet + cover + Dots(screws, { size: 0.45 }), [A.extruded(coverRing, GATE[0] + 23, 1.2, { owner: "gate" }), boxAlongShape(deg, from, to, 44, GATE[0] + 3, SLOT[0] - GATE[0] - 3, { owner: "gate" }), boxAlongShape(deg, from, to, 44, SLOT[1], GATE[0] + 23 - SLOT[1], { owner: "gate" }), boxAlongShape(deg, to - 4, to, 44, SLOT[0], 3, { owner: "gate" })], { name: "gate.bonnet" });
  // actuator: a pneumatic cylinder on the bonnet's end
  const Fa = G.frameAlong([140 * Math.SQRT1_2, -140 * Math.SQRT1_2, GATE[0] + 13], [Math.SQRT1_2, -Math.SQRT1_2, 0]);
  const cyl = S(G.disc(0, 3, 12, Fa, P), { tone: "mid" }) + S(G.disc(3, 34, 9, Fa, P), { tone: "mid" }) + S(G.disc(17, 19, 9.6, Fa, P), { tone: "mid" }) + S(G.disc(34, 37, 11, Fa, P), { tone: "mid" });
  put("gate", [158 * Math.SQRT1_2, -158 * Math.SQRT1_2, GATE[0] + 13], cyl, [A.disc(Fa, 0, 3, 12), A.disc(Fa, 3, 34, 9), A.disc(Fa, 17, 19, 9.6), A.disc(Fa, 34, 37, 11)], { name: "gate.actuator" });
  // the gate plate itself, parked in the bonnet; it slides to the axis to close
  const plateAt = 100;
  const cx = plateAt * Math.SQRT1_2;
  const cy = -plateAt * Math.SQRT1_2;
  const plate = S(k.cylinder(cx, cy, 34.6, SLOT[0], 3, P, 64, 0.4), { tone: "hi", crease: "lo" }) + L(k.ring(cx, cy, 28, SLOT[1], P, 48), { tone: "faint" });
  put("gate", [cx, cy, SLOT[0] + 1.5], plate, [cylShape(cx, cy, 34.6, SLOT[0], 3)], { piece: "gate", name: "gate.plate" });
}

// ===================== pull chamber and head =====================
function pullChamber() {
  shell("pull", { name: "pull.lowflange", z0: GATE[1], z1: PULL[0], rIn: R_GATE, rOut: 50, inner: (q) => Dots(topDots(q, 46, PULL[0], 15), { size: 0.45 }) });
  shell("pull", {
    name: "pull.tube",
    z0: PULL[0],
    z1: PULL[1],
    rIn: R_GATE,
    rOut: 40,
    inner: (q) => L([470, 560, 630].map((z) => wallArc(q, 40, z)).join(""), { tone: "faint" }),
  });
  shell("pull", { name: "pull.topflange", z0: PULL[1], z1: HEAD0, rIn: R_GATE, rOut: 50, inner: (q) => Dots(topDots(q, 46, HEAD0, 15), { size: 0.45 }) });
  // arm from the mast to a clamp collar on the tube
  for (const z of [470, 600]) {
    shell("pull", { name: `pull.collar${z}`, owner: `pull.collar${z}`, z0: z - 6, z1: z + 6, rIn: 40, rOut: 46 });
    const deg = 200;
    const reach = 160;
    const along0 = Math.sqrt(46 * 46 - 8 * 8);
    const arm = S(boxAlong(deg, along0, reach - 12, 8, z - 5, 10), { tone: "mid" });
    put("pull", ptc(110, deg, z), arm, [boxAlongShape(deg, along0, reach - 12, 8, z - 5, 10, { owner: `pull.collar${z}` })], { name: `pull.arm${z}` });
  }
  // head: base plate, winch housing, cap, two motors
  const head =
    S(k.cylinder(0, 0, 50, HEAD0, 6, P, 72, 0.6), { tone: "mid" }) +
    S(k.cylinder(0, 0, 40, HEAD0 + 6, 30, P, 72, 0.6), { tone: "mid", inner: L(k.sideArc(0, 0, 40, HEAD0 + 20, P, 48), { tone: "faint" }) }) +
    S(k.cylinder(0, 0, 26, HEAD0 + 36, 8, P, 56, 0.5), { tone: "mid" }) +
    L(k.knurl(0, 0, 26, HEAD0 + 37, HEAD0 + 43, 40, P), { tone: "lo" }) +
    S(k.cylinder(0, 0, 12, HEAD0 + 44, 5, P, 32, 0.4), { tone: "mid" }) +
    L(k.ring(0, 0, 5, HEAD0 + 49, P, 20), { tone: "lo" }) +
    Dots(Array.from({ length: 12 }, (_, i) => at(ptc(46, i * 30 + 15, HEAD0 + 6))), { size: 0.45 });
  put("head", [0, 0, HEAD0 + 20], head, [cylShape(0, 0, 50, HEAD0, 6), cylShape(0, 0, 40, HEAD0 + 6, 30), cylShape(0, 0, 26, HEAD0 + 36, 8), cylShape(0, 0, 12, HEAD0 + 44, 5)], { name: "head.body" });
  for (const deg of [-20, 110]) {
    const Fm = G.frameAlong(ptc(40, deg, HEAD0 + 21), [Math.cos(deg * DEG), Math.sin(deg * DEG), 0]);
    const svg = S(G.disc(0, 4, 10, Fm, P), { tone: "mid" }) + S(G.disc(4, 26, 9, Fm, P), { tone: "mid", inner: L([10, 16, 22].map((s) => G.arcOf(Fm, s, 9, P)).join(""), { tone: "faint" }) }) + S(G.disc(26, 29, 6, Fm, P), { tone: "mid" });
    put("head", ptc(56, deg, HEAD0 + 21), svg, [A.disc(Fm, -0.4, 4, 10, { owner: "head" }), A.disc(Fm, 4, 26, 9), A.disc(Fm, 26, 29, 6)], { name: R.nameFor("head.motor") });
  }
}

// ===================== cusp magnet =====================
function magnet() {
  const coils = [
    [138, 172],
    [220, 254],
  ];
  coils.forEach(([z0, z1], index) => {
    shell("magnet", {
      name: `magnet.coil${index}`,
      z0,
      z1,
      rIn: 102,
      rOut: 128,
      tone: "mid",
      inner: (q) => {
        let out = L(wallArc(q, 128, (z0 + z1) / 2), { tone: "faint" }) + Dots(topDots(q, 115, z1, 12), { size: 0.45 });
        for (const { deg } of q.faces) {
          const pack = [ptc(106, deg, z0 + 4), ptc(124, deg, z0 + 4), ptc(124, deg, z1 - 4), ptc(106, deg, z1 - 4)];
          out += L(pathOf(pack, true), { tone: "lo" });
        }
        return out;
      },
    });
  });
  for (const deg of [160, 225, 290]) {
    const [x, y] = ptc(115, deg, 0);
    const svg = S(k.cylinder(x, y, 9, 0, 2, P, 28), { tone: "lo" }) + S(k.cylinder(x, y, 5, 2, 136 - 2, P, 24), { tone: "mid", crease: "none" }) + S(k.cylinder(x, y, 8, 136, 2, P, 28), { tone: "mid" });
    put("magnet", [x, y, 68], svg, [cylShape(x, y, 9, 0, 2), cylShape(x, y, 5, 2, 134), cylShape(x, y, 8, 136, 2)], { name: R.nameFor("magnet.post") });
    const block = { x: x - 6, y: y - 6, w: 12, d: 12, r: 1.5 };
    put("magnet", [x, y, 196], S(k.slabOf(block, 172, 48, P, 3, 0.4), { tone: "mid" }), [slabShape(block, 172, 48, 3)], { name: R.nameFor("magnet.spacer") });
  }
}

// ===================== crucible drive, pump, argon =====================
function services() {
  const base = { x: -30, y: -30, w: 60, d: 60, r: 4 };
  const svg =
    S(k.slabOf(base, 0, 6, P, 4, 0.6), { tone: "mid" }) +
    Dots(k.corners(base, 5).map(([x, y]) => at([x, y, 6])), { size: 0.45 }) +
    S(k.cylinder(0, 0, 22, 6, 18, P, 56, 0.6), { tone: "mid", inner: L(k.sideArc(0, 0, 22, 15, P, 40), { tone: "faint" }) });
  put("drive", [0, 0, 12], svg, [slabShape(base, 0, 6), cylShape(0, 0, 22, 6, 18)], { name: "drive.body" });
  // bellows and gland between drive and floor
  let bel = "";
  const belShapes = [];
  for (let i = 0; i < 9; i++) {
    const z = 24 + i * 3;
    bel += S(k.cylinder(0, 0, i % 2 ? 12 : 14, z, 3, P, 40), { tone: "mid" });
    belShapes.push(cylShape(0, 0, i % 2 ? 12 : 14, z, 3));
  }
  bel += S(k.cylinder(0, 0, 16, 51, 3, P, 40, 0.4), { tone: "mid" }) + S(k.cylinder(0, 0, 9, 54, FLOOR[0] - 54, P, 32), { tone: "mid" });
  belShapes.push(cylShape(0, 0, 16, 51, 3), cylShape(0, 0, 9, 54, FLOOR[0] - 54));
  put("drive", [0, 0, 40], bel, belShapes, { name: "drive.bellows" });
  // drive motor on the drive's side, toward screen right
  const Fm = G.frameAlong(ptc(22, -45, 15), [Math.SQRT1_2, -Math.SQRT1_2, 0]);
  const motor = S(G.disc(-0.6, 4, 9, Fm, P), { tone: "mid" }) + S(G.disc(4, 30, 8, Fm, P), { tone: "mid" }) + S(G.disc(16, 18, 8.6, Fm, P), { tone: "mid" }) + S(G.disc(30, 33, 5, Fm, P), { tone: "mid" });
  put("drive", ptc(40, -45, 15), motor, [A.disc(Fm, -0.6, 4, 9, { owner: "drive.body" }), A.disc(Fm, 4, 30, 8), A.disc(Fm, 16, 18, 8.6), A.disc(Fm, 30, 33, 5)], { name: "drive.motor" });

  // vacuum pump at the back right, its inlet facing +y
  const pump = { x: -12, y: -172, w: 60, d: 42, r: 3 };
  const pumpSvg =
    S(k.slabOf(pump, 0, 40, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(pump, 30, P, 4), { tone: "faint" }) }) +
    L(k.planOutline(k.insetPlan(pump, 5), 40, P, 4), { tone: "lo" }) +
    Dots(k.corners(pump, 3).map(([x, y]) => at([x, y, 40])), { size: 0.45 });
  put("services", [18, -151, 20], pumpSvg, [slabShape(pump, 0, 40)], { name: "services.pump" });
  // inlet boss and exhaust duct from the floor
  const portX = 18;
  const inlet = G.frameAlong([portX, pump.y + pump.d, 30], [0, 1, 0]);
  const boss = S(G.disc(0, 4, 9, inlet, P), { tone: "mid" }) + Dots(G.dotsOf(inlet, 4, 7, 6, P, { all: true }), { size: 0.4 });
  put("services", [portX, pump.y + pump.d + 2, 30], boss, [A.disc(inlet, -0.3, 4, 9, { owner: "services.pump" })], { name: "services.inlet" });
  const top = G.frameAlong([portX, -54, FLOOR[0]], [0, 0, -1]);
  const flange = S(G.disc(0, 3, 8.5, top, P), { tone: "mid" });
  put("services", [portX, -54, FLOOR[0] - 1.5], flange, [A.disc(top, -0.3, 3, 8.5, { owner: "services.duct" })], { name: "services.port" });
  const route = G.fillet(
    [
      [portX, -54, FLOOR[0]],
      [portX, -54, 30],
      [portX, pump.y + pump.d + 4, 30],
    ],
    14,
    9,
    { P, tube: 5 },
  );
  const pieces = Tube.tubePieces(route, 5, P, { maxLength: 30 });
  pieces.forEach((piece, index) => {
    R.put({ piece: "fixed", at: piece.mid, svg: Tube.tubeSvg(piece, { tone: "mid" }), shapes: [A.tube(piece.points, piece.radii, { name: `services.duct:${index}` })], name: `services.duct:${index}`, route: "services.duct", chunk: index, part: "services", move: [0, 0, 0] });
  });
  R.route("services.duct", route, 5, { piece: "fixed", owner: "services.duct" });
}

// ===================== ports, camera, argon =====================
const domeOutR = (z) => DOME_A * Math.sqrt(Math.max(0, 1 - ((z - DOME0) / DOME_C) ** 2));
function ports() {
  // diameter camera: a viewport on the dome aimed at the bright ring where crystal meets melt
  const deg = 330;
  const z = DOME0 + 26;
  const r = domeOutR(z);
  const n = G.unit3([(Math.cos(deg * DEG) * r) / DOME_A ** 2, (Math.sin(deg * DEG) * r) / DOME_A ** 2, (z - DOME0) / DOME_C ** 2]);
  const F = G.frameAlong(ptc(r, deg, z), n);
  const view =
    S(G.disc(-0.4, 3, 7, F, P), { tone: "mid" }) +
    S(G.disc(3, 5, 5, F, P), { tone: "mid" }) +
    S(G.prismOf(F, [[-5, -4], [5, -4], [5, 4], [-5, 4]], 5, 21, P), { tone: "mid" }) +
    S(G.disc(21, 24, 3, F, P), { tone: "mid" }) +
    Dots(G.dotsOf(F, 3, 5.6, 6, P, { all: true }), { size: 0.4 });
  put("furnace", G.add3(F.o, G.mul3(n, 10)), view, [A.disc(F, -0.4, 3, 7), A.disc(F, 3, 5, 5), A.prism(F, [[-5, -4], [5, -4], [5, 4], [-5, 4]], 5, 21), A.disc(F, 21, 24, 3)], { name: "furnace.camera" });
  // sight glasses on the chamber wall and the pull chamber
  for (const [deg2, z2, R2, part] of [[118, 236, R_VESSEL, "furnace"], [330, 430, 40, "pull"]]) {
    const Fw = G.frameAlong(ptc(R2, deg2, z2), [Math.cos(deg2 * DEG), Math.sin(deg2 * DEG), 0]);
    const svg = S(G.disc(-0.4, 3, 8, Fw, P), { tone: "mid" }) + S(G.disc(3, 4.4, 5.4, Fw, P), { tone: "hi", crease: "lo" }) + Dots(G.dotsOf(Fw, 3, 6.7, 6, P, { all: true }), { size: 0.4 });
    put(part, ptc(R2 + 3, deg2, z2), svg, [A.disc(Fw, -0.4, 3, 8), A.disc(Fw, 3, 4.4, 5.4)], { name: R.nameFor(`${part}.window`) });
  }
  // argon: a mass-flow controller on the mast feeds the head
  const MAST = 200;
  const zA = 711;
  const boxRing = rotRect(0, 0, MAST, 126, 148, 9);
  const box = S(k.extrude(boxRing, zA - 10, 20, P, { bevel: 0.5 }), { tone: "mid", inner: L(k.ringSeam(boxRing, zA + 4, P), { tone: "faint" }) }) + Dots(rotRect(0, 0, MAST, 129, 145, 6).map(([x, y]) => at([x, y, zA + 10])), { size: 0.4 });
  put("services", ptc(137, MAST, zA), box, [A.extruded(boxRing, zA - 10, 20)], { name: "services.mfc" });
  const Fb = G.frameAlong(ptc(40, MAST, zA), [Math.cos(MAST * DEG), Math.sin(MAST * DEG), 0]);
  put("services", ptc(42, MAST, zA), S(G.disc(-0.2, 5, 3.2, Fb, P), { tone: "mid" }), [A.disc(Fb, -0.2, 5, 3.2, { owner: "head.body" })], { name: "services.argon-port" });
  const route = [ptc(45, MAST, zA), ptc(126, MAST, zA)];
  Tube.tubePieces(route, 1.4, P, { maxLength: 30 }).forEach((piece, index) => {
    R.put({ piece: "fixed", at: piece.mid, svg: Tube.tubeSvg(piece, { tone: "mid" }), shapes: [A.tube(piece.points, piece.radii, { name: `services.argon:${index}` })], name: `services.argon:${index}`, route: "services.argon", chunk: index, part: "services", move: [0, 0, 0] });
  });
  R.route("services.argon", route, 1.4, { piece: "fixed", owner: "services.argon" });
}

// ===================== the charge: polysilicon chunks, in layers that melt from the bottom up =====================
function charge() {
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const layers = [
    [CRU_FLOOR, 13, 57],
    [CRU_FLOOR + 13, 13, 57],
    [CRU_FLOOR + 26, 13, 55],
    [CRU_FLOOR + 39, 12, 36],
    [CRU_FLOOR + 51, 10, 26],
  ];
  layers.forEach(([z0, h, rMax], index) => {
    const chunks = [];
    const count = Math.round(rMax * 0.42);
    for (let i = 0; i < count; i++) {
      const deg = 98 + rand() * 254;
      const rr = Math.sqrt(rand()) * (rMax - 6);
      const [cx, cy] = ptc(rr, deg, 0);
      const size = 4.2 + rand() * 3;
      const sides = 5 + Math.floor(rand() * 2);
      const turn = rand() * 360;
      const ring = Array.from({ length: sides }, (_, j) => {
        const a = turn + (j * 360) / sides + rand() * 20;
        const rad = size * (0.75 + rand() * 0.35);
        return [cx + rad * Math.cos(a * DEG), cy + rad * Math.sin(a * DEG)];
      });
      const zc = z0 + rand() * (h - 5);
      chunks.push({ ring, z: zc, h: 3 + rand() * 2.5, c: [cx, cy] });
    }
    chunks.sort((a, b) => k.depthOf([a.c[0], a.c[1], a.z], P) - k.depthOf([b.c[0], b.c[1], b.z], P));
    const svg = chunks.map((c) => S(k.extrude(c.ring, c.z, c.h, P), { tone: "hi", crease: "lo" })).join("");
    const shape = A.body(AXIS, [[z0, 0], [z0, rMax], [z0 + h, rMax], [z0 + h, 0]], { cut: [A.box([0, 0, -BIG], [BIG, BIG, BIG])] });
    put("crucible", [0, 0, z0 + h / 2], `<g class="cz-chunks" data-chunk="${(z0 + h / 2).toFixed(1)}">${svg}</g>`, [shape], { piece: "charge", name: `crucible.charge${index}` });
  });
}

stand();
furnace();
hotZone();
crucible();
gate();
pullChamber();
magnet();
services();
ports();
charge();

// ---- live layers: the melt and the crystal, drawn by the page; envelopes place them in the painter's order ----
const meltEnvelope = A.body(AXIS, [[MELT - 2, 0], [MELT - 2, CRU_IN], [MELT, CRU_IN], [MELT, 0]], { cut: [A.box([0, 0, -BIG], [BIG, BIG, BIG])] });
put("crucible", [0, 0, MELT - 6], `<g data-layer="melt"></g>`, [meltEnvelope], { name: "live.melt", live: true });
put("crystal", [0, 0, 420], `<g data-layer="crystal"></g>`, [A.cylinder(0, 0, 31, MELT, HEAD0 - MELT, {})], { name: "live.crystal", live: true });

// ---- order ----
const STATES = [
  { label: "rest", shares: { crucible: 0, gate: 0, charge: 0 } },
  { label: "half lift", shares: { crucible: 0.5, gate: 0, charge: 1 } },
  { label: "full lift", shares: { crucible: 1, gate: 0, charge: 1 } },
  { label: "gate shut", shares: { crucible: 1, gate: 1, charge: 1 } },
];
if (!process.argv.includes("--fast")) A.settle(R, P, { states: STATES });
R.items.sort((a, b) => a.key - b.key);

// the crucible drive answers to the "Drive and vacuum" button
for (const item of R.items) if (item.part === "drive") item.part = "services";
const lift = (item) => G.dot3(item.move ?? [0, 0, 0], V);
const groups = R.items.map((item, index) => {
  const [mx, my, mz] = item.move ?? [0, 0, 0];
  return `<g class="it" data-part="${item.part}" data-piece="${item.piece}" data-k="${item.key.toFixed(2)}" data-l="${lift(item).toFixed(2)}" data-m="${mx.toFixed(1)},${my.toFixed(1)},${mz.toFixed(1)}" data-i="${index}"${item.name === "crucible.shaft" ? " data-rod" : ""}>${item.svg}</g>`;
});

const LABEL = `A Czochralski crystal puller with the front quarter cut away. From the bottom: a base plate on feet with a ruler and a label plate; the crucible drive, its bellows and motor; a vacuum pump and exhaust duct; the water-cooled furnace chamber on three legs, with two cusp-magnet coils around it; inside, graphite felt, a slotted graphite heater on two electrodes, a heat shield cone, and a quartz crucible in a graphite susceptor on a rising shaft; above, the dome, the gate valve with its bonnet and actuator, the long pull chamber held by a mast, and the pull head with its winch and rotation motors. The silicon crystal hangs from a cable and grows from the melt.`;
const svg = k.figureSvg({ width: W, height: H, label: LABEL, body: [`<g class="cz-layers">${groups.join("")}</g>`], className: "cz-svg" });

// ---- data for the page ----
const cam = k.cameraOf(P);
const screenOf = (vector) => {
  const o = at([0, 0, 0]);
  const p = at(vector);
  return [p[0] - o[0], p[1] - o[1]];
};
const PARTS = {
  head: { name: "Pull head", say: `winch and seed-rotation motors · the cable lifts and turns the crystal (${M.RUN.crystalRpm[0]}–${M.RUN.crystalRpm[1]} rpm)` },
  pull: { name: "Pull chamber", say: `holds the finished crystal · this puller pulls up to ${M.PULLER.crystalLengthMm / 1000} m` },
  gate: { name: "Gate valve", say: `${M.PULLER.gateMm} mm bore · shuts the furnace off from the pull chamber` },
  furnace: { name: "Furnace chamber", say: `water-cooled steel · Ø ${M.PULLER.vesselMm} mm · argon at reduced pressure` },
  shield: { name: "Heat shield and felt", say: "graphite felt holds the heat in · the cone steers argon past the crystal and cools it" },
  heater: { name: "Graphite heater", say: `resistance heater · keeps the melt just above ${M.SI.meltC} °C` },
  crucible: { name: "Crucible and susceptor", say: `${M.RUN.hotZoneIn}-inch quartz crucible in graphite · rises as the melt is used · ${M.RUN.crucibleRpm[0]}–${M.RUN.crucibleRpm[1]} rpm` },
  crystal: { name: "Silicon crystal", say: `Ø ${M.RUN.crystalMm} mm · ${M.ingotKg} kg · one single crystal, dislocation-free` },
  magnet: { name: "Cusp magnet", say: `two coils with opposed fields · damp melt convection to set oxygen (${M.RUN.oxygenPpma[0]}–${M.RUN.oxygenPpma[1]} ppma)` },
  services: { name: "Drive and vacuum", say: "crucible lift and rotation drive · vacuum pump draws the argon out" },
};
const ORDER = ["crystal", "crucible", "heater", "shield", "magnet", "furnace", "gate", "pull", "head", "services"];

const DATA = {
  O: at([0, 0, 0]),
  EX: screenOf([1, 0, 0]),
  EY: screenOf([0, 1, 0]),
  EZ: screenOf([0, 0, 1]),
  V,
  L: LIGHT,
  az: AZIMUTH,
  el: ELEVATION,
  melt: MELT,
  cruIn: CRU_IN,
  cruFloor: CRU_FLOOR,
  lift: LIFT,
  depth0: DEPTH0,
  depth1: DEPTH1,
  seedTopPark: SEED_TOP_PARK,
  liftOut: LIFT_OUT,
  head: HEAD0,
  seg: SEG,
  grown: GROWN,
  draw: { seed: 3, neck: 1.5, body: (M.RUN.crystalMm / 2) * U, tail: 2 },
  gateMove: MOVES.gate,
  steps: M.STEPS,
  span: M.SPAN,
  rpm: [M.RUN.spinCrystal, M.RUN.spinCrucible],
  parts: PARTS,
  order: ORDER,
  idle: M.IDLE,
  kg: { charge: M.RUN.chargeKg, ingot: M.ingotKg },
  massTable: Array.from({ length: 101 }, (_, i) => Math.round(M.grownKg((M.GROWN_MM * i) / 100) * 10) / 10),
  scale: cam.k,
  meltC: M.SI.meltC,
};
void cam;

const legend = ORDER.map((id, index) => `<button type="button" class="cz-part" data-part="${id}"><span class="cz-num">${String(index + 1).padStart(2, "0")}</span>${PARTS[id].name}</button>`).join("");
const corners = `<div class="iso-plate-corners" aria-hidden="true"><span class="iso-plate-corner" data-corner="fig">Fig 2</span><span class="iso-plate-corner" data-corner="title">Czochralski puller · cutaway</span><span class="iso-plate-corner" data-corner="readout" data-readout>${M.IDLE}</span></div>`;
const controls = `<div class="cz-controls"><span class="cz-hint">Hover a part · Space runs the pull</span><span class="cz-live" aria-live="polite" data-live></span></div>`;
const stage = `<div class="cz-stage" tabindex="0" role="slider" aria-label="Czochralski crystal puller, front quarter cut away. Hover, or use the arrow keys, to pick a part; Space plays or pauses the growth run; Escape resets it; the slider below steps through the seven stages." aria-valuemin="0" aria-valuemax="${ORDER.length}" aria-valuenow="0" aria-valuetext="${M.IDLE}">${svg}</div>`;
const caption = `A ${M.RUN.crystalMm} mm crystal grown the way Tu et al. describe it: a ${M.RUN.chargeKg} kg charge in a ${M.RUN.hotZoneIn}-inch quartz crucible, crystal and crucible turning in opposite directions (${M.RUN.crystalRpm[0]}–${M.RUN.crystalRpm[1]} and ${M.RUN.crucibleRpm[0]}–${M.RUN.crucibleRpm[1]} rpm; drawn at ${M.RUN.spinCrystal} and ${M.RUN.spinCrucible}, in real time), and a cusp magnetic field to hold oxygen at ${M.RUN.oxygenPpma[0]}–${M.RUN.oxygenPpma[1]} ppma. The chamber is sized after a 24-inch puller for 300 mm crystals (Ø ${M.PULLER.vesselMm} mm vessel, ${M.PULLER.gateMm} mm gate valve). The crucible rises as the melt is used, so the melt surface stays at the same height against the heater and shield; the drawn rise follows from the charge and the density of liquid silicon (${M.SI.liquidDensity} g/cm³). Crystal length and mass come from the charge less ${M.RUN.residualKg} kg left behind (${M.ingotKg} kg, so a body of about ${Math.round(M.bodyMm / 10) * 10} mm). Illustrative: the seed and neck are drawn about five times too thick to be seen, the shoulder and tail heights, the internal layout, and the slider's pacing; a real run takes ${M.RUN.days[0]}–${M.RUN.days[1]} days, most of it the body. Ruler ticks 50 mm.`;
const scrub = `<span class="cz-scrub"><button type="button" class="cz-play" data-play aria-label="Play the growth run"><span class="cz-play-icon" aria-hidden="true"></span><span data-play-text>Play</span></button><input type="range" class="cz-range" data-scrub min="0" max="1000" step="1" value="0" aria-label="Growth run: 0 is the start, 1000 is the crystal removed"><span class="cz-step" data-step>ready</span></span>`;
const body = `<figure class="iso-figure cz"><div class="iso-plate">${corners}${stage}${controls}</div><figcaption class="iso-legend">${scrub}<span class="cz-parts">${legend}</span><span class="iso-caption">${caption}</span></figcaption></figure>`;

const CSS = readFileSync(join(HERE, "crystal-growth.css"), "utf8");
const LIVE = readFileSync(join(HERE, "live.js"), "utf8").replace("__DATA__", JSON.stringify(DATA));
const out = writeChapter({ slug: "crystal-growth", figure: body, css: CSS, script: LIVE, lesson: LESSON });
console.log("wrote", out.file, `${out.kb} KB`, `${R.items.length} items`, `${R.solids.length} solids`);

// The live layers (and the charge, gone before the crucible moves) carry shapes so the painter's order can place them; the audit checks the drawn geometry.
R.items.splice(0, R.items.length, ...R.items.filter((item) => !LIVE_ITEMS.includes(item.name)));
R.solids.splice(0, R.solids.length, ...R.solids.filter((shape) => !LIVE_ITEMS.includes(shape.name)));
// the gate only shuts once the crystal is above it, so the shut plate never meets the crystal below it
// the charge has melted before the seed comes down, and the melt rises through it
// the argon line ends on the flow controller, which stands in front of the mast; looked at at 8x
A.auditOrExit(R, P, { frames: STATES, apart: false, crowd: [["services.argon*", "stand.mast*"]], allow: [["gate.plate", "live.crystal"], ["crucible.charge*", "live.crystal"], ["crucible.charge*", "live.melt"]] });
