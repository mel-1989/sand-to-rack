// Copper interconnect: a copper electroplating cell in half section beside a sawn cross-section of the metal stack it builds.
// node build.mjs [--fast] [--audit]
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as M from "./model.mjs";

import { k, G, A, Tube, kitScript } from "../../site/kit.mjs";
import { writeChapter } from "../../site/shell.mjs";
import { LESSON } from "./lesson.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

// ---- camera ----
const W = 720;
const H = 540;
const AZIMUTH = 50;
const ELEVATION = 30;
const RAD = Math.PI / 180;

// ---- world (x, y floor, z up; illustrative units: the cell at about 5 mm a unit, the stack hugely magnified) ----
const PLATE = { x: -196, y: -96, w: 392, d: 192, r: 10 };
const PLATE_H = 12;
const FOOT_H = 6;

// plating cell
const CX = -104;
const CY = 8;
const BLOCK = { x: CX - 24, y: CY - 24, w: 48, d: 48, r: 3 };
const BLOCK_TOP = 14;
const FLOOR_TOP = 18;
const R_IN = 36;
const R_WALL = 39;
const LEVEL = 57; // electrolyte level = weir top
const TROUGH_Z = 42;
const TROUGH_FLOOR = 44;
const R_TROUGH_IN = 45;
const R_TROUGH = 47;
const TROUGH_TOP = 59;
// the section plane keeps the back half: angles from A0 to A1 (degrees, from +x toward +y)
const A0 = AZIMUTH + 90;
const A1 = AZIMUTH + 270;
const U = [Math.cos(A0 * RAD), Math.sin(A0 * RAD)]; // along the cut, positive to screen-left

// clamshell head (built raised; the slider lowers it by LIFT into the bath)
const LIFT = 28;
const WAFER_R = 30;
const HEAD = { wafer: [LEVEL, LEVEL + 0.5], spindle: [LEVEL + 14, LEVEL + 23], motor: [LEVEL + 23, LEVEL + 41], cap: [LEVEL + 41, LEVEL + 44] };
const COL = { x: CX - 68, y: CY - 6, w: 12, d: 12, r: 1.5 };
const COL_TOP = 142;
const ARM_Z = [LEVEL + 28, LEVEL + 36];

// pump and filter skid, behind and between the two objects
const TANK = { x: -40, y: -84, w: 56, d: 40, r: 4 };
const TANK_TOP = 26;
// plating supply
const PSU = { x: -32, y: 36, w: 44, d: 30, r: 3 };
const PSU_TOP = 22;

// metal stack specimen on a stage
const STAGE = { x: 62, y: -44, w: 96, d: 92, r: 5 };
const STAGE_TOP = 10;
const SP = { x: 84, y: -24, w: 56, d: 56, r: 0.2 };
const X1 = SP.x + SP.w;
const Y1 = SP.y + SP.d;
const FEOL_TOP = STAGE_TOP + 9;
const TIER = {
  local: { h: 2.8, pitch: 3.2 },
  intermediate: { h: 3.8, pitch: 4.6 },
  "semi-global": { h: 5.2, pitch: 7 },
  "thick top": { h: 9, pitch: 14 },
};
const PAD_H = 6.5;
let zRun = FEOL_TOP;
const LAYERS = M.LAYERS.map((layer, index) => {
  const t = TIER[layer.kind];
  const out = { ...layer, index, z0: zRun, h: t.h, pitch: t.pitch, along: index % 2 === 0 ? "x" : "y" };
  zRun += t.h;
  return out;
});
const PAD = { z0: zRun, h: PAD_H };
const STACK_TOP = zRun + PAD_H;
const OVERBURDEN = 0.9;
// wafer bumps on the pads (drawn size illustrative: a real C4 pillar is tens of microns, the wiring tens of nanometres)
const UBM_H = 0.5;
const PILLAR = { r: 4.4, h: 6, cap: 2.6, ubmR: 5.4 };
const PILLAR_PHASES = 8;
const BUMP_TOP = STACK_TOP + UBM_H + PILLAR.h + PILLAR.cap;
const BUMPS = [[SP.x + 16, SP.y + 16], [SP.x + 40, SP.y + 16], [SP.x + 16, SP.y + 40], [SP.x + 40, SP.y + 40]];

// ---- process steps: weights set how long each step plays ----
const WEIGHTS = { lowk: 1, cut: 1, liner: 0.8, plate: 2, cmp: 1.2 };
const SEQ = [];
for (const layer of LAYERS) for (const step of M.STEPS) SEQ.push({ layer: layer.index, step: step.id, weight: WEIGHTS[step.id] });
const BUMP_WEIGHTS = { pad: 1.2, ubm: 1, pillar: 2.2, reflow: 1.4 };
for (const step of M.BUMP_STEPS) SEQ.push({ layer: LAYERS.length, step: step.id, weight: BUMP_WEIGHTS[step.id] });

const PIECES = {
  head: { ...M.PIECES.head, move: [0, 0, -LIFT] },
  cell: { ...M.PIECES.cell, move: [0, 0, 0] },
  loop: { ...M.PIECES.loop, move: [0, 0, 0] },
  power: { ...M.PIECES.power, move: [0, 0, 0] },
  stack: { ...M.PIECES.stack, move: [0, 0, 0] },
  stand: { ...M.PIECES.stand, move: [0, 0, 0] },
};
const ORDER = ["head", "cell", "loop", "power", "stack"];
const STAGGER = ["head"];
const SPRING = { stagger: 0.05, stiffness: 64, damping: 16, substeps: 4 };

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), ...k.boxCorners(COL, 0, COL_TOP + 6), ...k.boxCorners(SP, 0, BUMP_TOP + 1)],
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
const pathOf = (points, closed = true) => k.pathOf(points.map(at), closed);
const centreOf = (plan, z) => [plan.x + plan.w / 2, plan.y + plan.d / 2, z];
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const FZ = (x, y) => G.frameOf([x, y, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);

const R = A.recorder(P, { order: STAGGER, spring: SPRING });
function put(piece, ref, svg, shapes, { bias = 0, name } = {}) {
  const id = name ?? R.nameFor(`${piece}.item`);
  shapes.forEach((shape) => (shape.name = shape.name ?? id));
  R.put({ piece, at: ref, bias, svg, move: PIECES[piece].move, shapes: shapes.map(R.solid), name: id });
  return id;
}
const slabShape = (plan, z, h, meta = {}, steps = 4) => A.slab(plan, z, h, meta, steps);
const cylShape = (x, y, r, z, h, meta = {}) => A.cylinder(x, y, r, z, h, meta);

// an arc ring of points
const arcRing = (cx, cy, r, a0, a1, steps) => Array.from({ length: steps + 1 }, (_, i) => {
  const a = (a0 + ((a1 - a0) * i) / steps) * RAD;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
});
// an annular sector (or a sector when rIn is 0) as a floor ring
function sector(cx, cy, rIn, rOut, a0, a1, steps = 16) {
  const outer = arcRing(cx, cy, rOut, a0, a1, steps);
  if (rIn <= 0) return [[cx, cy], ...outer];
  return [...outer, ...arcRing(cx, cy, rIn, a1, a0, steps)];
}
// a point on the section plane of the cell: r along the cut (positive to screen-left), z up
const sec = (r, z) => [CX + r * U[0], CY + r * U[1], z];
const secRect = (r0, r1, z0, z1) => pathOf([sec(r0, z0), sec(r1, z0), sec(r1, z1), sec(r0, z1)]);
const secLine = (pts) => k.pathOf(pts.map(([r, z]) => at(sec(r, z))));


// ---- pipes and cables (after the Raptor's helpers) ----
function tubeItems(piece, route, r, { name, tone = "mid", maxLength = 18, gaps = [], rims, limp = false } = {}) {
  const id = R.nameFor(name);
  R.route(id, route, r, { owner: id, limp, gaps, rims, piece, move: PIECES[piece].move });
  Tube.tubePieces(route, r, P, { maxLength, spacing: Math.max(0.8, Math.min(2.4, r * 0.18)), gaps }).forEach((part, index) =>
    R.put({ piece, at: part.mid, svg: Tube.tubeSvg(part, { tone }), move: PIECES[piece].move, shapes: [A.tube(part.points, part.radii)], name: `${id}:${index}`, route: id, chunk: index }),
  );
  return id;
}
function flangeAt(piece, centre, axis, r, thick, { owner, name, bolts = 6 } = {}) {
  const F = G.frameAlong(centre, axis);
  const id = R.nameFor(name ?? `${piece}.flange`);
  const towards = G.dot3(F.a, V) > 0 ? thick / 2 : -thick / 2;
  const face = Math.abs(G.dot3(F.a, V)) > 0.12 && bolts ? Dots(G.dotsOf(F, towards, r * 0.72, bolts, P, { all: true }), { size: 0.38, tone: "mid" }) : "";
  R.put({ piece, at: centre, svg: S(G.disc(-thick / 2, thick / 2, r, F, P), { tone: "mid" }) + face, move: PIECES[piece].move, name: id, shapes: [R.solid(A.disc(F, -thick / 2, thick / 2, r, { name: id, owner }))] });
}
function pipe(piece, control, r, { name, flangeR = 1.55, bands = [] } = {}) {
  const line = G.fillet(control, Math.max(r * 2.6, 3), 12, { P, tube: r });
  const total = G.pathLength(line);
  const thick = Math.max(0.9, r * 0.55);
  const collars = [];
  [[0, -1], [total, 1]].forEach(([along, sign]) => {
    const tangent = G.tangentAlong(line, along);
    collars.push({ centre: G.add3(G.pointAlong(line, along), G.mul3(tangent, (-sign * thick) / 2)), tangent, radius: r * flangeR, thick, gap: sign < 0 ? [0, thick] : [total - thick, total] });
  });
  for (const share of bands) {
    const along = total * share;
    const bt = Math.max(0.8, r * 0.7);
    collars.push({ centre: G.pointAlong(line, along), tangent: G.tangentAlong(line, along), radius: r * 1.2, thick: bt, gap: [along - bt / 2, along + bt / 2], band: true });
  }
  const owner = tubeItems(piece, line, r, { name, gaps: collars.map((c) => c.gap), rims: [r * flangeR, r * flangeR] });
  for (const c of collars) flangeAt(piece, c.centre, c.tangent, c.radius, c.thick, { owner, name: `${owner}.${c.band ? "band" : "flange"}`, bolts: c.band ? 0 : 6 });
  return line;
}
function cable(piece, points, { r = 0.62, bend = 3.2, name } = {}) {
  const route = G.fillet(points, bend, 12, { P, tube: r });
  const id = tubeItems(piece, route, r, { name, tone: "mid", maxLength: 14, limp: true, rims: [r, r] });
  for (const end of [route[0], route[route.length - 1]]) R.put({ piece, at: end, bias: 0.15, svg: Dots([at(end)], { size: 0.5, tone: "hi" }), move: PIECES[piece].move, name: R.nameFor(`${id}.end`), shapes: [A.ball(end, 0.5 / KS)] });
  return route;
}
// a short round stud standing out of a flat face (terminals, ports)
function stud(piece, base, axis, r, len, { name, owner } = {}) {
  const F = G.frameAlong(base, axis);
  const id = R.nameFor(name ?? `${piece}.stud`);
  const ring = G.dot3(F.a, V) > 0.12 ? L(G.circleOf(F, len, r * 0.45, P), { tone: "lo" }) : "";
  R.put({ piece, at: G.add3(base, G.mul3(axis, len / 2)), svg: S(G.disc(0, len, r, F, P, { bevel: 0.2 }), { tone: "mid" }) + ring, move: PIECES[piece].move, name: id, shapes: [R.solid(A.disc(F, 0, len, r, { name: id, owner }))] });
  return G.add3(base, G.mul3(axis, len));
}

// ======================= plumbing and leads =======================
function plumbing() {
  // feed: pump outlet boss on the tank lid, over and down into the cell block's inlet
  const boss = stud("loop", [-30, -52, TANK_TOP], [0, 0, 1], 3.6, 3, { name: "loop.outlet" });
  pipe("loop", [boss, [-30, -52, 38], [-64, -52, 38], [-64, 0, 38], [-64, 0, 7], [BLOCK.x + BLOCK.w, 0, 7]], 2, { name: "loop.feed", bands: [0.42] });
  // drain: from under the overflow trough back to the tank
  const da = 262 * RAD;
  const d0 = [CX + 43 * Math.cos(da), CY + 43 * Math.sin(da), TROUGH_Z];
  pipe("loop", [d0, [d0[0], d0[1], 12], [-6, d0[1], 12], [-6, TANK.y + TANK.d, 12]], 2, { name: "loop.drain" });
  // leads: anode to the cell block, cathode to the head through the lift column
  const fy = PSU.y + PSU.d;
  const anodeStud = stud("power", [-96, BLOCK.y + BLOCK.d, 6], [0, 1, 0], 1.8, 1.6, { name: "power.anodestud" });
  const box = { x: COL.x + 1, y: COL.y + COL.d, w: 10, d: 6, r: 1 };
  R.put({ piece: "power", at: centreOf(box, 8), svg: S(k.slabOf(box, 8, 12, P, 3, 0.4), { tone: "mid" }) + Dots([at([box.x + 2, box.y + 3, 20]), at([box.x + 8, box.y + 3, 20])], { size: 0.4 }), move: [0, 0, 0], name: "power.junction", shapes: [R.solid(slabShape(box, 8, 12, { name: "power.junction" }, 3))] });
  const cathodeStud = stud("power", [box.x + 5, box.y + box.d, 14], [0, 1, 0], 1.8, 1.6, { name: "power.cathodestud" });
  const t0 = [PSU.x + 10, fy + 1.6, 6];
  const t1 = [PSU.x + 20, fy + 1.6, 6];
  cable("power", [t0, [t0[0], 74, 6], [t0[0], 74, 1.1], [cathodeStud[0], 74, 1.1], [cathodeStud[0], 28, 1.1], [cathodeStud[0], 28, 14], cathodeStud], { name: "power.cathode" });
  cable("power", [t1, [t1[0], 71, 6], [t1[0], 71, 1.1], [anodeStud[0], 71, 1.1], [anodeStud[0], 40, 1.1], [anodeStud[0], 40, 6], anodeStud], { name: "power.anode" });
}

// ======================= bench =======================
function bench() {
  const out = [];
  out.push(`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`);
  const shapes = [];
  for (const [x, y] of byDepth(k.corners(PLATE, 26))) {
    out.push(S(k.cylinder(x, y, 8, -PLATE_H - FOOT_H, 1.8, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 6.2, -PLATE_H - FOOT_H + 1.8, FOOT_H - 1.8, P, 28), { tone: "mid" }));
    shapes.push(A.cylinder(x, y, 8, -PLATE_H - FOOT_H, FOOT_H, { name: "stand.foot" }));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid", inner: L(k.sideSeam(PLATE, -PLATE_H + 3, P, 8), { tone: "faint" }) }));
  shapes.push(A.slab(PLATE, -PLATE_H, PLATE_H, { name: "stand.plate" }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 6), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 12);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.4, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(Dots(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // ruler strip along the near (+y) edge, 5 mm ticks at the cell's scale
  const strip = { x: -150, y: PLATE.y + PLATE.d - 14.5, w: 196, d: 8, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 2, 5, strip.y + 0.8, 0.6, [2.2, 4], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(Dots([at([strip.x + 2, strip.y + 4, 0.6]), at([strip.x + strip.w - 2, strip.y + 4, 0.6])], { size: 0.45 }));
  // label plate
  const label = { x: 92, y: PLATE.y + PLATE.d - 24, w: 74, d: 14, r: 1.5 };
  out.push(S(k.slabOf(label, 0, 0.8, P, 4), { tone: "lo", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.8), 0.8, P, 4), { tone: "faint" }));
  out.push(L([0, 1, 2].map((i) => k.lineOnTop([label.x + 8, label.y + 4.4 + i * 2.8], [label.x + 56 - i * 14, label.y + 4.4 + i * 2.8], 0.8, P)).join(""), { tone: "lo", free: true }));
  out.push(Dots([at([label.x + 4, label.y + label.d / 2, 0.8]), at([label.x + label.w - 4, label.y + label.d / 2, 0.8])], { size: 0.45 }));
  put("stand", [0, 0, -2], out.join(""), shapes, { name: "stand.bench", bias: -600 });
}

// ======================= plating cell =======================
function cell() {
  // pedestal block with the inlet boss on its back face
  const block = S(k.slabOf(BLOCK, 0, BLOCK_TOP, P, 4, 0.6), { tone: "mid", inner: L(k.sideSeam(BLOCK, 4, P, 4), { tone: "faint" }) });
  const bolts = k.corners(BLOCK, 3.4);
  const marks = Dots(bolts.map(([x, y]) => at([x, y, BLOCK_TOP])), { size: 0.45 });
  put("cell", centreOf(BLOCK, 0), block + marks, [slabShape(BLOCK, 0, BLOCK_TOP, { name: "cell.block" })], { name: "cell.block" });

  // bowl floor (half disc)
  const floorRing = sector(CX, CY, 0, R_WALL, A0, A1, 36);
  put("cell", [CX, CY, BLOCK_TOP], S(k.extrude(floorRing, BLOCK_TOP, FLOOR_TOP - BLOCK_TOP, P, { convex: true, bevel: 0.4 }), { tone: "mid" }), [A.extruded(floorRing, BLOCK_TOP, FLOOR_TOP - BLOCK_TOP, { name: "cell.floor", owner: "cell.bowl" })], { name: "cell.floor" });

  // electrolyte: a half disc of liquid, its section face carries everything submerged
  const liquidRing = sector(CX, CY, 0, R_IN, A0, A1, 40);
  const liquid = S(k.extrude(liquidRing, FLOOR_TOP, LEVEL - FLOOR_TOP, P, { convex: true }), { tone: "lo", crease: "none", className: "ic-liquid" });
  const parts = [];
  // anode on two standoffs, with the central feed through it
  parts.push(`<path class="ic-sec" d="${secRect(-20, -16, FLOOR_TOP, 21) + secRect(16, 20, FLOOR_TOP, 21)}"/>`);
  parts.push(L(secRect(-20, -16, FLOOR_TOP, 21) + secRect(16, 20, FLOOR_TOP, 21), { tone: "lo" }));
  const anode = secRect(-29, -4.5, 21, 26.5) + secRect(4.5, 29, 21, 26.5);
  parts.push(`<path class="ic-cu" data-anode d="${anode}"/>`, L(anode, { tone: "mid" }));
  const feed = secRect(-3.2, -2.2, FLOOR_TOP, 31) + secRect(2.2, 3.2, FLOOR_TOP, 31);
  parts.push(`<path class="ic-sec" d="${feed}"/>`, L(feed, { tone: "lo" }));
  // membrane in its frame
  const frame = secRect(-R_IN, -32, 30, 33) + secRect(32, R_IN, 30, 33);
  parts.push(`<path class="ic-sec" d="${frame}"/>`, L(frame, { tone: "lo" }));
  parts.push(L(secLine([[-32, 31.5], [32, 31.5]]), { tone: "mid" }));
  // diffuser plate with holes
  const holes = [];
  for (let r = -32; r <= 32.01; r += 4) holes.push(r);
  let plate = "";
  for (let i = 0; i < holes.length - 1; i++) plate += secRect(holes[i] + 0.7, holes[i + 1] - 0.7, 44, 47);
  plate += secRect(-R_IN, holes[0] - 0.7, 44, 47) + secRect(holes[holes.length - 1] + 0.7, R_IN, 44, 47);
  parts.push(`<path class="ic-sec" d="${plate}"/>`, L(plate, { tone: "lo" }));
  // flow: up through the diffuser, out across the wafer, over the weir (shown while plating)
  const flows = [];
  // each stream starts on the diffuser's solid top (between holes), so its end is rooted on the plate's outline
  for (const side of [-1, 1]) for (const r0 of [6, 14, 22]) {
    const r1 = r0 + 3;
    flows.push(secLine([[side * r0, 47], [side * r0, 51], [side * r1, 54.2], [side * 35.6, 56.2]]));
  }
  parts.push(`<g data-flow-lines>${L(flows.join(""), { tone: "hi", flow: true })}</g>`);
  const shapes = [A.extruded(liquidRing, FLOOR_TOP, LEVEL - FLOOR_TOP, { name: "cell.liquid", owner: "cell.bowl" })];
  put("cell", [CX, CY, (FLOOR_TOP + LEVEL) / 2], liquid + parts.join(""), shapes, { name: "cell.liquid" });

  // bowl wall: a half annulus, in four sectors so each depth-sorts on its own
  const wallStep = (A1 - A0) / 4;
  for (let i = 0; i < 4; i++) {
    const a0 = A0 + i * wallStep;
    const ring = sector(CX, CY, R_IN, R_WALL, a0, a0 + wallStep, 10);
    const svg = S(k.extrude(ring, FLOOR_TOP, LEVEL - FLOOR_TOP, P, { convex: false }), { tone: "mid" });
    const mid = (a0 + wallStep / 2) * RAD;
    put("cell", [CX + 37.5 * Math.cos(mid), CY + 37.5 * Math.sin(mid), 38], svg, [A.extruded(ring, FLOOR_TOP, LEVEL - FLOOR_TOP, { name: `cell.wall${i}`, owner: "cell.bowl" })], { name: `cell.wall${i}` });
  }
  // overflow trough: floor ring and outer wall
  for (let i = 0; i < 4; i++) {
    const a0 = A0 + i * wallStep;
    const floor = sector(CX, CY, R_WALL, R_TROUGH, a0, a0 + wallStep, 10);
    const wall = sector(CX, CY, R_TROUGH_IN, R_TROUGH, a0, a0 + wallStep, 10);
    const svg = S(k.extrude(floor, TROUGH_Z, TROUGH_FLOOR - TROUGH_Z, P, { convex: false }), { tone: "mid" }) + S(k.extrude(wall, TROUGH_FLOOR, TROUGH_TOP - TROUGH_FLOOR, P, { convex: false }), { tone: "mid" });
    const mid = (a0 + wallStep / 2) * RAD;
    put("cell", [CX + 44 * Math.cos(mid), CY + 44 * Math.sin(mid), 50], svg, [A.extruded(floor, TROUGH_Z, TROUGH_FLOOR - TROUGH_Z, { name: `cell.trough${i}`, owner: "cell.bowl" }), A.extruded(wall, TROUGH_FLOOR, TROUGH_TOP - TROUGH_FLOOR, { name: `cell.troughwall${i}`, owner: "cell.bowl" })], { name: `cell.trough${i}` });
  }
}

// ======================= clamshell head on its lift =======================
const RIB_PHASES = 6;
function head() {
  const lift = (z) => z + LIFT;
  // the wafer holder is cut in half with the cell, so the wafer shows in section
  const half = (rIn, rOut, steps = 24) => sector(CX, CY, rIn, rOut, A0, A1, steps);
  const hz = (z) => lift(z);
  const z0 = HEAD.wafer[0];
  // lip seal under the wafer's edge
  const lipRing = half(28.4, 32.5, 32);
  put("head", [CX, CY, hz(z0)], S(k.extrude(lipRing, hz(z0), 0.5, P, { convex: false }), { tone: "mid" }), [A.extruded(lipRing, hz(z0), 0.5, { owner: "head" })], { name: "head.lip" });
  // the wafer: the lit subject of the cell
  const waferRing = half(0, WAFER_R, 48);
  put("head", [CX, CY, hz(z0 + 0.5)], S(k.extrude(waferRing, hz(z0 + 0.5), 0.8, P, { convex: true }), { tone: "hi", crease: "lo", lit: true }), [A.extruded(waferRing, hz(z0 + 0.5), 0.8, { owner: "head" })], { name: "head.wafer" });
  // cup wall in four sectors
  const cupZ = hz(z0 + 0.5);
  const cupH = 6.5;
  const step = (A1 - A0) / 4;
  for (let i = 0; i < 4; i++) {
    const ring = sector(CX, CY, 30.5, 32.5, A0 + i * step, A0 + (i + 1) * step, 8);
    const mid = (A0 + (i + 0.5) * step) * RAD;
    put("head", [CX + 31.5 * Math.cos(mid), CY + 31.5 * Math.sin(mid), cupZ + 3], S(k.extrude(ring, cupZ, cupH, P, { convex: false }), { tone: "mid" }), [A.extruded(ring, cupZ, cupH, { owner: "head" })], { name: `head.cup${i}` });
  }
  // roof plate with the contact screws round it (drawn in phases so the head visibly turns)
  const roofZ = cupZ + cupH;
  const roofRing = half(0, 32.5, 48);
  const screws = [];
  for (let p = 0; p < RIB_PHASES; p++) {
    const pts = [];
    for (let j = 0; j < 36; j++) {
      const a = (j / 36) * 360 + (p / RIB_PHASES) * 10;
      const aa = ((a % 360) + 360) % 360;
      if (aa < A0 + 3 || aa > A1 - 3) continue;
      pts.push(at([CX + 30 * Math.cos(aa * RAD), CY + 30 * Math.sin(aa * RAD), roofZ + 1.4]));
    }
    screws.push(`<g data-phase="${p}"${p ? ' style="display:none"' : ""}>${Dots(pts, { size: 0.42, tone: "mid" })}</g>`);
  }
  const roofArc = k.pathOf(arcRing(CX, CY, 27.5, A0, A1, 40).map(([x, y]) => at([x, y, roofZ + 1.4])));
  put("head", [CX, CY, roofZ], S(k.extrude(roofRing, roofZ, 1.4, P, { convex: true, bevel: 0.4 }), { tone: "mid" }) + L(roofArc, { tone: "faint" }) + screws.join(""), [A.extruded(roofRing, roofZ, 1.4, { owner: "head" })], { name: "head.roof" });
  // backing hub in two steps
  const hub1 = half(0, 22, 40);
  const hub2 = half(0, 12, 32);
  put("head", [CX, CY, roofZ + 2], S(k.extrude(hub1, roofZ + 1.4, 3, P, { convex: true, bevel: 0.4 }), { tone: "mid" }) + S(k.extrude(hub2, roofZ + 4.4, 2.6, P, { convex: true, bevel: 0.3 }), { tone: "mid" }), [A.extruded(hub1, roofZ + 1.4, 3, { owner: "head" }), A.extruded(hub2, roofZ + 4.4, 2.6, { owner: "head" })], { name: "head.hub" });
  const F = FZ(CX, CY);
  // spindle with a collar
  const sp = S(k.cylinder(CX, CY, 4.5, lift(HEAD.spindle[0]), HEAD.spindle[1] - HEAD.spindle[0], P, 32), { tone: "mid", crease: "none", inner: L(k.sideArc(CX, CY, 4.5, lift(HEAD.spindle[0] + 5), P, 20), { tone: "faint" }) });
  const collar = S(k.cylinder(CX, CY, 6.5, lift(HEAD.spindle[1] - 3), 3, P, 32, 0.3), { tone: "mid" });
  put("head", [CX, CY, lift(HEAD.spindle[0] + 4)], sp + collar, [cylShape(CX, CY, 4.5, lift(HEAD.spindle[0]), HEAD.spindle[1] - HEAD.spindle[0] - 3, { owner: "head" }), cylShape(CX, CY, 6.5, lift(HEAD.spindle[1] - 3), 3, { owner: "head" })], { name: "head.spindle" });
  // spin motor with cooling ribs (drawn in phases so it turns) and a cap
  const mz0 = lift(HEAD.motor[0]);
  const mz1 = lift(HEAD.motor[1]);
  const ribs = [];
  for (let p = 0; p < RIB_PHASES; p++) {
    const list = G.ribsOf(F, mz0 + 2.5, mz1 - 2.5, 11, 28, P, { phase: (p / RIB_PHASES) * ((2 * Math.PI) / 28), fade: [0.1, 0.55], seams: true });
    ribs.push(`<g data-phase="${p}"${p ? ' style="display:none"' : ""}>${k.fadedSvg(list, { tone: "lo" })}</g>`);
  }
  const motor = S(k.cylinder(CX, CY, 11, mz0, mz1 - mz0, P, 64, 0.5), { tone: "mid", inner: ribs.join("") });
  const cap = S(k.cylinder(CX, CY, 8.5, mz1, HEAD.cap[1] - HEAD.cap[0], P, 48, 0.4), { tone: "mid" }) + L(k.ring(CX, CY, 3, lift(HEAD.cap[1]), P, 20), { tone: "lo" }) + Dots(G.dotsOf(F, lift(HEAD.cap[1]), 6, 6, P, { all: true }), { size: 0.4 });
  put("head", [CX, CY, mz0 + 6], motor + cap, [cylShape(CX, CY, 11, mz0, mz1 - mz0, { owner: "head" }), cylShape(CX, CY, 8.5, mz1, HEAD.cap[1] - HEAD.cap[0], { owner: "head" })], { name: "head.motor" });
  // arm to the lift carriage
  const arm = { x: COL.x + COL.w + 8, y: CY - 5, w: CX - 11 - (COL.x + COL.w + 8), d: 10, r: 1 };
  const armZ0 = lift(ARM_Z[0]);
  const armSvg = S(k.slabOf(arm, armZ0, ARM_Z[1] - ARM_Z[0], P, 3, 0.5), { tone: "mid", inner: L(k.sideSeam(arm, armZ0 + 4, P, 3), { tone: "faint" }) }) + Dots([at([arm.x + 4, arm.y + 2.5, armZ0 + 8]), at([arm.x + 4, arm.y + 7.5, armZ0 + 8])], { size: 0.45 });
  put("head", centreOf(arm, armZ0), armSvg, [slabShape(arm, armZ0, ARM_Z[1] - ARM_Z[0], { owner: "head" }, 3)], { name: "head.arm" });
  const car = { x: COL.x + COL.w, y: CY - 9, w: 8, d: 18, r: 1.2 };
  const carZ0 = armZ0 - 6;
  const carSvg = S(k.slabOf(car, carZ0, 20, P, 3, 0.5), { tone: "mid", inner: L(k.sideSeam(car, carZ0 + 10, P, 3), { tone: "faint" }) }) + Dots([[car.x + 8, car.y + 3], [car.x + 8, car.y + 15]].flatMap(([x, y]) => [at([x, y, carZ0 + 3]), at([x, y, carZ0 + 17])]), { size: 0.45 });
  put("head", centreOf(car, carZ0), carSvg, [slabShape(car, carZ0, 20, { owner: "head" }, 3)], { name: "head.carriage" });
}

// ======================= lift column =======================
function column() {
  const base = { x: COL.x - 6, y: COL.y - 6, w: COL.w + 12, d: COL.d + 12, r: 3 };
  const svgBase = S(k.slabOf(base, 0, 4, P, 4, 0.5), { tone: "mid" }) + Dots(k.corners(base, 3).map(([x, y]) => at([x, y, 4])), { size: 0.45 });
  put("stand", centreOf(base, 0), svgBase, [slabShape(base, 0, 4, {}, 4)], { name: "stand.colbase" });
  const seams = [40, 80, 120].map((z) => k.sideSeam(COL, z, P, 3)).join("");
  const post = S(k.slabOf(COL, 4, COL_TOP - 4, P, 3, 0.5), { tone: "mid", inner: L(seams, { tone: "faint" }) });
  // a lead screw slot on the face the carriage rides
  const slot = { x: COL.x + COL.w - 0.01, y: CY - 1.4, w: 0.01, d: 2.8 };
  const slotLine = pathOf([[slot.x, CY - 1.4, 10], [slot.x, CY + 1.4, 10], [slot.x, CY + 1.4, COL_TOP - 6], [slot.x, CY - 1.4, COL_TOP - 6]]);
  put("stand", centreOf(COL, 60), post + L(slotLine, { tone: "lo" }), [slabShape(COL, 4, COL_TOP - 4, {}, 3)], { name: "stand.column" });
  // lift motor on top
  const mx = COL.x + COL.w / 2;
  const my = COL.y + COL.d / 2;
  const motor = S(k.cylinder(mx, my, 7, COL_TOP, 12, P, 40, 0.4), { tone: "mid", inner: L(k.sideArc(mx, my, 7, COL_TOP + 4, P, 24), { tone: "faint" }) }) + L(k.ring(mx, my, 3, COL_TOP + 12, P, 20), { tone: "lo" });
  put("stand", [mx, my, COL_TOP + 6], motor, [cylShape(mx, my, 7, COL_TOP, 12)], { name: "stand.liftmotor" });
}

// ======================= pump and filter skid =======================
function skid() {
  const tank = S(k.slabOf(TANK, 0, TANK_TOP, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(TANK, 8, P, 4), { tone: "faint" }) });
  const lid = L(k.planOutline(k.insetPlan(TANK, 4), TANK_TOP, P, 4), { tone: "lo" }) + Dots(k.corners(TANK, 2.2).map(([x, y]) => at([x, y, TANK_TOP])), { size: 0.45 });
  // sight glass on the near face with the electrolyte level in it
  const gy = TANK.y + TANK.d;
  const gx0 = TANK.x + 38;
  const glass = pathOf([[gx0, gy, 5], [gx0 + 5, gy, 5], [gx0 + 5, gy, 21], [gx0, gy, 21]]);
  const level = k.pathOf([at([gx0, gy, 15]), at([gx0 + 5, gy, 15])]);
  const sight = `<path class="ic-screen" d="${glass}"/>` + `<path class="ic-sec" d="${pathOf([[gx0, gy, 5], [gx0 + 5, gy, 5], [gx0 + 5, gy, 15], [gx0, gy, 15]])}"/>` + L(level, { tone: "mid" }) + L(glass, { tone: "lo" }) + Dots([at([gx0 + 2.5, gy, 3]), at([gx0 + 2.5, gy, 23])], { size: 0.4 });
  put("loop", centreOf(TANK, 0), tank + lid + sight, [slabShape(TANK, 0, TANK_TOP, { name: "loop.tank" })], { name: "loop.tank" });
  // filter canister
  const fx = TANK.x + 40;
  const fy = TANK.y + 20;
  const can = S(k.cylinder(fx, fy, 9, TANK_TOP, 26, P, 48, 0.4), { tone: "mid", inner: L([TANK_TOP + 6, TANK_TOP + 20].map((z) => k.sideArc(fx, fy, 9, z, P, 32)).join(""), { tone: "faint" }) });
  const canCap = S(k.cylinder(fx, fy, 10, TANK_TOP + 26, 3, P, 48, 0.4), { tone: "mid" }) + S(k.cylinder(fx, fy, 3.5, TANK_TOP + 29, 3, P, 24), { tone: "mid" }) + L(k.knurl(fx, fy, 3.5, TANK_TOP + 29.4, TANK_TOP + 31.6, 16, P), { tone: "lo" });
  put("loop", [fx, fy, TANK_TOP + 12], can + canCap, [cylShape(fx, fy, 9, TANK_TOP, 26), cylShape(fx, fy, 10, TANK_TOP + 26, 3), cylShape(fx, fy, 3.5, TANK_TOP + 29, 3)], { name: "loop.filter" });
  // pump with motor
  const px = TANK.x + 15;
  const py = TANK.y + 20;
  const F = FZ(px, py);
  const pump = S(k.cylinder(px, py, 8, TANK_TOP, 9, P, 48, 0.4), { tone: "mid" });
  const ribs = G.ribsOf(F, TANK_TOP + 11, TANK_TOP + 25, 7.5, 22, P, { fade: [0.1, 0.55], seams: true });
  const mot = S(k.cylinder(px, py, 7.5, TANK_TOP + 9, 18, P, 48, 0.4), { tone: "mid", inner: k.fadedSvg(ribs, { tone: "lo" }) }) + S(k.cylinder(px, py, 5, TANK_TOP + 27, 2, P, 32), { tone: "mid" });
  put("loop", [px, py, TANK_TOP + 10], pump + mot, [cylShape(px, py, 8, TANK_TOP, 9), cylShape(px, py, 7.5, TANK_TOP + 9, 18), cylShape(px, py, 5, TANK_TOP + 27, 2)], { name: "loop.pump" });
}

// ======================= plating supply =======================
function supply() {
  const box = S(k.slabOf(PSU, 0, PSU_TOP, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(PSU, 4, P, 4), { tone: "faint" }) });
  const vents = [];
  for (let i = 0; i < 5; i++) vents.push(k.planOutline({ x: PSU.x + 6 + i * 6, y: PSU.y + 5, w: 2.4, d: 20, r: 1.1 }, PSU_TOP, P, 3));
  const top = L(vents.join(""), { tone: "lo" }) + Dots(k.corners(PSU, 2.4).map(([x, y]) => at([x, y, PSU_TOP])), { size: 0.45 });
  const kx = PSU.x + PSU.w - 6;
  const ky = PSU.y + PSU.d - 6;
  const knob = S(k.cylinder(kx, ky, 3.4, PSU_TOP, 3, P, 32, 0.3), { tone: "mid", inner: L(k.knurl(kx, ky, 3.4, PSU_TOP + 0.4, PSU_TOP + 2.6, 20, P), { tone: "lo" }) }) + L(k.lineOnTop([kx, ky], [kx + 2.6, ky], PSU_TOP + 3, P), { tone: "hi", free: "end" });
  // display window on the +x face
  const dz0 = 9;
  const dz1 = 17;
  const dy0 = PSU.y + 3;
  const dy1 = PSU.y + 27;
  const fx = PSU.x + PSU.w;
  const win = pathOf([[fx, dy0, dz0], [fx, dy1, dz0], [fx, dy1, dz1], [fx, dy0, dz1]]);
  const display = `<path class="ic-screen" d="${win}"/>` + L(win, { tone: "lo" });
  const text = `<g transform="${k.sideMatrix([fx, dy1 - 1.6], dz0 + 2.2, P, "right")}"><text class="ic-readout" data-psu font-size="3.4" x="0" y="0">0.0 mA/cm²</text></g>`;
  // two output terminals on the +y face
  const fy = PSU.y + PSU.d;
  const TERMS = [[PSU.x + 10, 6], [PSU.x + 20, 6]];
  const terms = TERMS.map(([x, z]) => S(G.disc(0, 1.6, 1.8, G.frameAlong([x, fy, z], [0, 1, 0]), P), { tone: "mid" })).join("");
  put("power", centreOf(PSU, 0), box + top + knob + display + text + terms, [slabShape(PSU, 0, PSU_TOP, { name: "power.box" }), cylShape(kx, ky, 3.4, PSU_TOP, 3, { owner: "power.box" }), ...TERMS.map(([x, z]) => A.disc(G.frameAlong([x, fy, z], [0, 1, 0]), 0, 1.6, 1.8, { owner: "power.box" }))], { name: "power.box" });
}

// ======================= metal stack specimen =======================
const hash = (a, b) => {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};
// a polygon on one visible face: face "x" is the plane x = X1 (coordinate a runs along y), face "y" the plane y = Y1 (a runs along x)
const onFace = (face, a, z) => (face === "x" ? [X1, a, z] : [a, Y1, z]);
const faceRect = (face, a0, a1, z0, z1) => pathOf([onFace(face, a0, z0), onFace(face, a1, z0), onFace(face, a1, z1), onFace(face, a0, z1)]);
const faceU = (face, pts) => k.pathOf(pts.map(([a, z]) => at(onFace(face, a, z))));
// a damascene feature: line on top, via below, as a closed outline
const featureOf = (a, w, wv, z0, vz, z1, via) =>
  via
    ? [[a - w / 2, z1], [a - w / 2, vz], [a - wv / 2, vz], [a - wv / 2, z0], [a + wv / 2, z0], [a + wv / 2, vz], [a + w / 2, vz], [a + w / 2, z1]]
    : [[a - w / 2, z1], [a - w / 2, vz], [a + w / 2, vz], [a + w / 2, z1]];

function layerArt(layer) {
  const { z0, h, pitch, along } = layer;
  const z1 = z0 + h;
  const vz = z0 + h * 0.42;
  const w = pitch * 0.5;
  const wv = w * 0.62;
  const cutFace = along === "x" ? "x" : "y"; // the face that cuts across the lines
  const runFace = along === "x" ? "y" : "x"; // the face parallel to the lines
  const span = along === "x" ? [SP.y, Y1] : [SP.x, X1];
  const cross = [];
  for (let a = span[0] + pitch / 2; a + w / 2 <= span[1] - 0.6; a += pitch) cross.push(a);
  const voids = [];
  const liner = [];
  // cross-cut face: one square section per line, some with a via under them
  cross.forEach((a, j) => {
    const via = hash(layer.index, j) < 0.4;
    voids.push({ face: cutFace, pts: featureOf(a, w, wv, z0, vz, z1, via) });
  });
  // parallel face: the line nearest the face runs along it in segments, with vias under it
  const runSpan = along === "x" ? [SP.x, X1] : [SP.y, Y1];
  let a = runSpan[0] + 3 + hash(layer.index, 99) * pitch * 2;
  let n = 0;
  while (a < runSpan[1] - pitch * 1.5) {
    const len = pitch * (2 + Math.floor(hash(layer.index, 200 + n) * 5));
    const b = Math.min(runSpan[1] - pitch * 0.8, a + len);
    if (b - a > pitch) {
      const vias = [];
      const viaAt = a + wv / 2 + 0.6 + hash(layer.index, 300 + n) * Math.max(0, b - a - wv - 1.2);
      const pts = [[a, z1], [a, vz], ...(hash(layer.index, 400 + n) < 0.75 ? [[viaAt - wv / 2, vz], [viaAt - wv / 2, z0], [viaAt + wv / 2, z0], [viaAt + wv / 2, vz]] : []), [b, vz], [b, z1]];
      voids.push({ face: runFace, pts });
      vias.push(viaAt);
    }
    a = b + pitch * (0.8 + hash(layer.index, 500 + n));
    n++;
  }
  const voidD = voids.map(({ face, pts }) => faceU(face, pts) + "Z").join("");
  const linerD = voids.map(({ face, pts }) => faceU(face, pts)).join("");
  // the top face once polished: copper stripes along the lines
  const stripes = [];
  for (const c of cross) {
    const r = along === "x" ? [[SP.x, c - w / 2], [X1, c - w / 2], [X1, c + w / 2], [SP.x, c + w / 2]] : [[c - w / 2, SP.y], [c + w / 2, SP.y], [c + w / 2, Y1], [c - w / 2, Y1]];
    stripes.push(k.onTop(r, z1, P, true));
  }
  // trench openings on the top face before filling
  return { z0, z1, voidD, linerD, stripes: stripes.join("") };
}

function stage() {
  const svg = S(k.slabOf(STAGE, 0, STAGE_TOP, P, 6, 0.8), { tone: "mid", inner: L(k.sideSeam(STAGE, 3.5, P, 6), { tone: "faint" }) });
  const groove = L(k.planOutline(k.insetPlan(STAGE, 5), STAGE_TOP, P, 6), { tone: "lo" });
  const screws = k.corners(STAGE, 8);
  const sc = L(screws.map(([x, y]) => k.ring(x, y, 2, STAGE_TOP, P, 16)).join(""), { tone: "lo" }) + Dots(screws.map(([x, y]) => at([x, y, STAGE_TOP])), { size: 0.45 });
  put("stand", centreOf(STAGE, 0), svg + groove + sc, [slabShape(STAGE, 0, STAGE_TOP, {}, 6)], { name: "stand.stage" });
  // two fences behind the specimen hold it square
  const fences = [
    { x: SP.x - 7, y: SP.y - 7, w: 7, d: SP.d + 7, r: 1 },
    { x: SP.x, y: SP.y - 7, w: SP.w, d: 7, r: 1 },
  ];
  fences.forEach((f, i) => {
    const s = S(k.slabOf(f, STAGE_TOP, 16, P, 3, 0.5), { tone: "mid", inner: L(k.sideSeam(f, STAGE_TOP + 8, P, 3), { tone: "faint" }) });
    const pts = i === 0 ? [[f.x + 3.5, f.y + 8], [f.x + 3.5, f.y + f.d - 8]] : [[f.x + 8, f.y + 3.5], [f.x + f.w - 8, f.y + 3.5]];
    const marks = L(pts.map(([x, y]) => k.ring(x, y, 1.6, STAGE_TOP + 16, P, 16)).join(""), { tone: "lo" }) + Dots(pts.map(([x, y]) => at([x, y, STAGE_TOP + 16])), { size: 0.45 });
    put("stand", centreOf(f, STAGE_TOP), s + marks, [slabShape(f, STAGE_TOP, 16, {}, 3)], { name: `stand.fence${i}` });
  });
}

function stack() {
  // silicon with the transistors (front end) at its top
  const si = S(k.slabOf(SP, STAGE_TOP, FEOL_TOP - STAGE_TOP, P, 2, 0.3), { tone: "mid", crease: "lo" });
  const gates = [];
  for (const face of ["x", "y"]) {
    const span = face === "x" ? [SP.y, Y1] : [SP.x, X1];
    for (let a = span[0] + 2; a + 1.2 <= span[1] - 1; a += 3.2) gates.push(faceRect(face, a, a + 1.2, FEOL_TOP - 2.6, FEOL_TOP - 0.6));
    gates.push(faceRect(face, span[0] + 0.01, span[1] - 0.01, FEOL_TOP - 4.4, FEOL_TOP - 3.6));
  }
  const feol = `<path class="ic-sec" d="${gates.join("")}"/>` + L(gates.join(""), { tone: "lo" });
  put("stack", centreOf(SP, STAGE_TOP), si + feol, [slabShape(SP, STAGE_TOP, FEOL_TOP - STAGE_TOP, { owner: "stack" }, 2)], { name: "stack.feol" });

  LAYERS.forEach((layer) => {
    const art = layerArt(layer);
    const slab = S(k.slabOf(SP, layer.z0, layer.h, P, 2, 0), { tone: "mid", crease: "lo", className: "ic-lowk" });
    const ob = S(k.slabOf(SP, art.z1, OVERBURDEN, P, 2, 0), { tone: "hi", crease: "lo", className: "ic-cu-solid" });
    const svg =
      `<g data-s="lowk">${slab}</g>` +
      `<g data-s="cut" style="display:none"><path class="ic-void" d="${art.voidD}"/></g>` +
      `<g data-s="cu"><g data-clip><path class="ic-cu" d="${art.voidD}"/></g></g>` +
      `<g data-s="liner">${L(art.linerD, { tone: "hi", className: "ic-liner" })}</g>` +
      `<g data-s="top"><path class="ic-cu" d="${art.stripes}"/>${L(art.stripes, { tone: "lo" })}</g>` +
      `<g data-s="burden" style="display:none">${ob}</g>`;
    put("stack", centreOf(SP, layer.z0), `<g data-layer="${layer.index}" data-z0="${layer.z0}" data-h="${layer.h}">${svg}</g>`, [slabShape(SP, layer.z0, layer.h, { owner: "stack" }, 2)], { name: `stack.${layer.name}` });
  });

  // passivation with aluminium bond pads
  const pas = S(k.slabOf(SP, PAD.z0, PAD.h, P, 2, 0.3), { tone: "mid", crease: "lo", className: "ic-lowk" });
  const pads = [];
  const padTops = [];
  for (const [px, py] of [[SP.x + 8, SP.y + 8], [SP.x + 32, SP.y + 8], [SP.x + 8, SP.y + 32], [SP.x + 32, SP.y + 32]]) {
    const plan = { x: px, y: py, w: 16, d: 16, r: 0.6 };
    pads.push(S(k.slabOf(plan, PAD.z0 + PAD.h - 1.2, 1.2, P, 2, 0.3), { tone: "hi", crease: "lo", className: "ic-pad" }));
    padTops.push(k.planOutline(k.insetPlan(plan, 2.4), PAD.z0 + PAD.h, P, 2));
  }
  // pad opening cut by the two faces: the via from the top metal up to the pad
  const pv = [faceRect("x", SP.y + 38, SP.y + 46, PAD.z0, PAD.z0 + PAD.h - 1.2), faceRect("y", SP.x + 38, SP.x + 46, PAD.z0, PAD.z0 + PAD.h - 1.2)].join("");
  const padSvg = `<g data-pad>${pas}<path class="ic-cu" d="${pv}"/>${L(pv, { tone: "mid" })}${pads.join("")}${L(padTops.join(""), { tone: "faint" })}</g>`;
  put("stack", centreOf(SP, PAD.z0), padSvg, [slabShape(SP, PAD.z0, PAD.h, { owner: "stack" }, 2)], { name: "stack.pad" });

  // under-bump metallization: a sputtered blanket over the whole wafer until the etch clears it between the bumps
  const film = S(k.slabOf(SP, STACK_TOP, UBM_H, P, 2, 0), { tone: "hi", crease: "lo", className: "ic-cu-solid" });
  put("stack", centreOf(SP, STACK_TOP), `<g data-ubm style="display:none">${film}</g>`, [slabShape(SP, STACK_TOP, UBM_H, { owner: "stack" }, 2)], { name: "stack.ubm" });
  // copper pillars with a SnAg cap, one item each so they sort among themselves
  const zp = STACK_TOP + UBM_H;
  BUMPS.forEach(([bx, by], i) => {
    const parts = [];
    parts.push(`<g data-b="disc">${S(k.cylinder(bx, by, PILLAR.ubmR, STACK_TOP, UBM_H, P, 36), { tone: "hi", crease: "lo", className: "ic-cu-solid" })}</g>`);
    for (let j = 1; j <= PILLAR_PHASES; j++) {
      const h = (PILLAR.h * j) / PILLAR_PHASES;
      parts.push(`<g data-b="pillar" data-j="${j}" style="display:none">${S(k.cylinder(bx, by, PILLAR.r, zp, h, P, 36), { tone: "hi", crease: "lo", className: "ic-cu-solid" })}</g>`);
    }
    const zc = zp + PILLAR.h;
    for (let j = 1; j <= PILLAR_PHASES; j++) {
      const h = (PILLAR.cap * j) / PILLAR_PHASES;
      parts.push(`<g data-b="cap" data-j="${j}" style="display:none">${S(k.cylinder(bx, by, PILLAR.r, zc, h, P, 36), { tone: "hi", crease: "lo", className: "ic-solder" })}</g>`);
    }
    // reflowed: the solder pulls into a dome
    const dome = S(k.cylinder(bx, by, PILLAR.r, zc, 1.1, P, 36, 0.5), { tone: "hi", crease: "lo", className: "ic-solder" }) + S(k.cylinder(bx, by, PILLAR.r * 0.72, zc + 1.1, 1.3, P, 36, 0.7), { tone: "hi", crease: "lo", className: "ic-solder" });
    parts.push(`<g data-b="dome" style="display:none">${dome}</g>`);
    put("stack", [bx, by, zp + PILLAR.h / 2], `<g data-bump>${parts.join("")}</g>`, [cylShape(bx, by, PILLAR.r, zp, PILLAR.h + PILLAR.cap, { owner: "stack" })], { name: `stack.bump${i}` });
  });
}

bench();
column();
cell();
head();
skid();
supply();
stage();
stack();
plumbing();

if (!process.argv.includes("--fast")) A.settle(R, P);
R.items.sort((a, b) => a.key - b.key);
const groups = R.items.map((item, index) => {
  const [mx, my, mz] = item.move;
  return `<g class="it" data-piece="${item.piece}" data-k="${item.key.toFixed(2)}" data-m="${mx.toFixed(1)},${my.toFixed(1)},${mz.toFixed(1)}" data-i="${index}">${item.svg}</g>`;
});

const LABEL = `A copper electroplating cell and the metal stack it builds, on one bench. Left: the plating cell cut in half, showing the copper anode, membrane, diffuser plate and electrolyte, with the clamshell head that lowers the wafer face-down into the bath; a lift column, a pump and filter skid and the plating supply stand beside it. Right: a sawn, magnified cross-section of ${M.LAYER_COUNT} copper wiring layers over the transistors, with vias, barrier liners and low-k glass, topped by bond pads and copper pillar bumps with solder caps.`;
const svg = k.figureSvg({ width: W, height: H, label: LABEL, body: [`<defs><clipPath id="ic-fill"><path d=""/></clipPath></defs><g class="ic-layers">${groups.join("")}</g>`], className: "ic-svg" });

const unit = (vector) => {
  const o = at([0, 0, 0]);
  const p = at(vector);
  return [p[0] - o[0], p[1] - o[1]];
};
const DATA = {
  V,
  EZ: unit([0, 0, 1]),
  P,
  SP,
  OB: OVERBURDEN,
  X1,
  Y1,
  lift: LIFT,
  phases: RIB_PHASES,
  layers: LAYERS.map((l) => ({ name: l.name, kind: l.kind, z0: l.z0, h: l.h })),
  pad: PAD,
  steps: Object.fromEntries([...M.STEPS, ...M.BUMP_STEPS].map((s) => [s.id, { name: s.name, say: s.say }])),
  rpm: M.PLATE.rpmFill,
  seq: SEQ,
  pieces: Object.fromEntries(Object.entries(PIECES).map(([id, p]) => [id, { name: p.name, say: p.say }])),
  order: ORDER,
  idle: M.IDLE,
  pitch: M.PITCH_NOTE,
  amps: { fill: M.PLATE.fillMAcm2, burden: M.PLATE.burdenMAcm2[0], pillar: M.BUMP_DISPLAY },
  pillarPhases: PILLAR_PHASES,
};

const PARTS = ORDER.map((id, index) => `<button type="button" class="ic-part" data-part="${id}"><span class="ic-num">${String(index + 1).padStart(2, "0")}</span>${PIECES[id].name}</button>`).join("");
const corners = `<div class="iso-plate-corners" aria-hidden="true"><span class="iso-plate-corner" data-corner="fig">Fig 1</span><span class="iso-plate-corner" data-corner="title">Dual damascene · copper wiring</span><span class="iso-plate-corner" data-corner="readout" data-readout>${M.IDLE}</span></div>`;
const controls = `<div class="ic-controls"><span class="ic-hint">Hover a part · Space plays the loop</span><span class="ic-live" aria-live="polite" data-live></span></div>`;
const stageEl = `<div class="ic-stage" tabindex="0" role="slider" aria-label="Copper electroplating cell and metal stack. Hover, or use the arrow keys, to pick a part; Space plays or pauses the dual damascene loop; Escape stops it and shows the finished stack; the slider below steps through every layer." aria-valuemin="0" aria-valuemax="${ORDER.length}" aria-valuenow="0" aria-valuetext="${M.IDLE}">${svg}</div>`;
const caption = `The dual damascene loop, once per metal layer: deposit low-k glass, etch a via and a trench into it, line them with a Ta/TaN barrier and a copper seed, electroplate copper with the wafer face-down in the cell, then polish the overburden off by CMP. The stack drawn follows ${M.STACK.example}: ${M.STACK.regular} metal layers from M0 at ${M.STACK.m0PitchNm} nm pitch, plus ${M.STACK.thick} thick top layers, then the bond pads. Last comes bumping: passivation with openings over the pads, a sputtered Ti/Cu under-bump metallization, a resist mask, a copper pillar and SnAg cap plated in the same kind of cell, then resist strip, seed etch and reflow (TSMC patent flow); real C4 bumps sit at about ${M.BUMP.c4PitchUm} µm pitch and micro-bumps at about ${M.BUMP.microPitchUm} µm, so the four drawn are not to scale. Adjacent metal layers route at right angles, so each sawn face shows one layer's wires lengthwise and the next layer's cut across. The cell spins the wafer at ${M.PLATE.rpmFill[0]}–${M.PLATE.rpmFill[1]} rpm while copper fills the features bottom up at ${M.PLATE.fillRange[0]}–${M.PLATE.fillRange[1]} mA/cm², then faster for the overburden (Novellus Systems (Lam Research) patent example); the supply's display value is illustrative. The stack cross-section is hugely magnified with heights compressed and line counts illustrative; real pitch grows from tens of nanometres at the bottom to microns at the top. The cell is drawn at about 10 mm a ruler tick (the wafer is 300 mm across), its internal layout simplified.`;
const scrub = `<span class="ic-scrub"><button type="button" class="ic-play" data-play aria-label="Play the damascene loop"><span class="ic-play-icon" aria-hidden="true"></span><span data-play-text>Play</span></button><input type="range" class="ic-range" data-scrub min="0" max="1000" step="1" value="1000" aria-label="Process: 0 is bare transistors, 1000 is the finished, bumped stack"><span class="ic-step" data-step>finished stack</span></span>`;
const body = `<figure class="iso-figure ic"><div class="iso-plate">${corners}${stageEl}${controls}</div><figcaption class="iso-legend">${scrub}<span class="ic-parts">${PARTS}</span><span class="iso-caption">${caption}</span></figcaption></figure>`;

const CSS = readFileSync(join(HERE, "interconnect.css"), "utf8");
const LIVE = readFileSync(join(HERE, "live.js"), "utf8").replace("__DATA__", JSON.stringify(DATA));
const out = writeChapter({ slug: "interconnect", figure: body, css: CSS, script: kitScript() + LIVE, lesson: LESSON });
console.log("wrote", out.file, `${out.kb} KB`, `${R.items.length} items`, `${R.solids.length} solids`);

A.auditOrExit(R, P);
