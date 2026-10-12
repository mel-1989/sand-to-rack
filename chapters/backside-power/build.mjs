// Backside power delivery: two sawn, magnified chip blocks on one bench. Left, a conventional chip that takes
// its power from the top. Right, a backside-power chip on a rotary flip fixture under a cup-wheel grinder; the
// slider builds it: front end, carrier bond, flip, thinning, nano-TSVs, backside power metal, bumps.
// node build.mjs [--fast] [--audit]
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as M from "./model.mjs";
import * as ST from "./stack.mjs";

import { k, G, A, Tube, kitScript } from "../../site/kit.mjs";
import { writeChapter } from "../../site/shell.mjs";
import { LESSON } from "./lesson.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const { BLK, RB, LB, WHEEL } = ST;

// ---- camera ----
const W = 720;
const H = 600;
const AZIMUTH = 56;
const ELEVATION = 30;

// ---- world (illustrative units) ----
const PLATE = { x: -114, y: -76, w: 242, d: 134, r: 10 };
const PLATE_H = 12;
const FOOT_H = 6;
const XR = BLK.right.xc;
const ZC = BLK.right.zc;
const RIGHT = { x: XR - BLK.half, y: BLK.y0, w: BLK.half * 2, d: BLK.y1 - BLK.y0, r: 0 };
const LEFT = { x: BLK.left.xc - BLK.half, y: BLK.y0, w: BLK.half * 2, d: BLK.y1 - BLK.y0, r: 0 };
const FINAL = ST.rightState(1);
const [FV0, FV1] = ST.rightExtent(FINAL);
const RIGHT_Z0 = ZC - (FV1 - BLK.right.vc); // carrier underside once flipped
const RIGHT_TOP = ZC + (BLK.right.vc - FV0); // backside metal top once finished
const LEFT_Z0 = BLK.left.zc;
const LEFT_TOP = LEFT_Z0 + LB.top;

// left plinth, right catch tray
const PLINTH = { x: LEFT.x - 6, y: -26, w: LEFT.w + 12, d: 52, r: 3 };
const TRAY = { x: XR - 32, y: -14, w: 64, d: 40, r: 3 };
const TRAY_H = 4;
const RIM_H = 2.5;

// rotary flip fixture behind the right block
const HEAD = { x: XR - 17, y: -46, w: 34, d: 18, r: 2.5 };
const HEAD_TOP = 62;
const BOSS = { y0: HEAD.y + HEAD.d, y1: HEAD.y + HEAD.d + 2.5, r: 13 };
const PLATE_R = 30;
const FACE = { y0: BOSS.y1, y1: BLK.y0 };

// grinder: column at the back, a carriage, an arm over the block, spindle and cup wheel
const COL = { x: XR - 7, y: -70, w: 14, d: 14, r: 1.5 };
const COL_BASE = { x: XR - 13, y: -75, w: 26, d: 24, r: 2 };
const COL_TOP = 146;
const WHEEL_Z = WHEEL.rest;
const HUB = { z0: WHEEL_Z + WHEEL.h, z1: WHEEL_Z + WHEEL.h + 4, r: 9 };
const SPINDLE = { z0: HUB.z1, z1: HUB.z1 + 20, r: 7 };
const ARM = { x: XR - 7, y: COL.y + COL.d + 6, w: 14, d: -(COL.y + COL.d + 6) + 8, r: 1.5 };
const ARM_Z = [SPINDLE.z1, SPINDLE.z1 + 8];
const CARRIAGE = { x: XR - 10, y: COL.y + COL.d, w: 20, d: 6, r: 1.2 };
const CAR_Z = [ARM_Z[0] - 8, ARM_Z[1] + 10];
const MOTOR = { z0: ARM_Z[1], z1: ARM_Z[1] + 18, r: 8 };

// controller at the front right
const CTRL = { x: 80, y: 4, w: 38, d: 34, r: 3 };
const CTRL_TOP = 20;

const STAGGER = ["tools"];
const SPRING = { stagger: 0.05, stiffness: 64, damping: 16, substeps: 4 };
const MOVE0 = [0, 0, 0];

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), ...k.boxCorners(COL, 0, COL_TOP + 4), ...k.boxCorners({ x: XR - 10, y: -8, w: 20, d: 16, r: 0 }, 0, MOTOR.z1 + 4)],
  W,
  H,
  { pad: 30, azimuth: AZIMUTH, elevation: ELEVATION },
);
const V = G.viewOf(P);
const L = G.lightOf(P);
const KS = G.scaleOf(P);
const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const Ln = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);
const centreOf = (plan, z) => [plan.x + plan.w / 2, plan.y + plan.d / 2, z];
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const FY = (x, y, z) => G.frameAlong([x, y, z], [0, 1, 0]);
const FZ = (x, y) => G.frameOf([x, y, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);

const R = A.recorder(P, { order: STAGGER, spring: SPRING });
function put(piece, ref, svg, shapes, { bias = 0, name, attrs = "" } = {}) {
  const id = name ?? R.nameFor(`${piece}.item`);
  shapes.forEach((shape) => (shape.name = shape.name ?? id));
  R.put({ piece, at: ref, bias, svg, move: MOVE0, shapes: shapes.map(R.solid), name: id, attrs });
  return id;
}
const slabShape = (plan, z, h, meta = {}, steps = 4) => A.slab(plan, z, h, meta, steps);
const cylShape = (x, y, r, z, h, meta = {}) => A.cylinder(x, y, r, z, h, meta);

// ---- cables (after the interconnect chapter's helpers) ----
function tubeItems(piece, route, r, { name, tone = "mid", maxLength = 18, gaps = [], rims, limp = false } = {}) {
  const id = R.nameFor(name);
  R.route(id, route, r, { owner: id, limp, gaps, rims, piece, move: MOVE0 });
  Tube.tubePieces(route, r, P, { maxLength, spacing: Math.max(0.8, Math.min(2.4, r * 0.18)), gaps }).forEach((part, index) =>
    R.put({ piece, at: part.mid, svg: Tube.tubeSvg(part, { tone }), move: MOVE0, shapes: [A.tube(part.points, part.radii)], name: `${id}:${index}`, route: id, chunk: index }),
  );
  return id;
}
function stud(piece, base, axis, r, len, { name, owner } = {}) {
  const F = G.frameAlong(base, axis);
  const id = R.nameFor(name ?? `${piece}.stud`);
  const ring = G.dot3(F.a, V) > 0.12 ? Ln(G.circleOf(F, len, r * 0.45, P), { tone: "lo" }) : "";
  R.put({ piece, at: G.add3(base, G.mul3(axis, len / 2)), svg: S(G.disc(0, len, r, F, P, { bevel: 0.2 }), { tone: "mid" }) + ring, move: MOVE0, name: id, shapes: [R.solid(A.disc(F, 0, len, r, { name: id, owner }))] });
  return G.add3(base, G.mul3(axis, len));
}
function cable(piece, points, { r = 0.62, bend = 3.2, name } = {}) {
  const route = G.fillet(points, bend, 12, { P, tube: r });
  const id = tubeItems(piece, route, r, { name, tone: "mid", maxLength: 14, limp: true, rims: [r, r] });
  for (const end of [route[0], route[route.length - 1]]) R.put({ piece, at: end, bias: 0.15, svg: Dots([at(end)], { size: 0.5, tone: "hi" }), move: MOVE0, name: R.nameFor(`${id}.end`), shapes: [A.ball(end, 0.5 / KS)] });
  return route;
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
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid", inner: Ln(k.sideSeam(PLATE, -PLATE_H + 3, P, 8), { tone: "faint" }) }));
  shapes.push(A.slab(PLATE, -PLATE_H, PLATE_H, { name: "stand.plate" }));
  out.push(Ln(k.planOutline(k.insetPlan(PLATE, 6), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 12);
  out.push(Ln(screws.map(([x, y]) => k.ring(x, y, 2.4, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(Dots(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // ruler strip along the near (+y) edge
  const strip = { x: -100, y: PLATE.y + PLATE.d - 17, w: 140, d: 8, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 2, 5, strip.y + 0.8, 0.6, [2.2, 4], P);
  out.push(Ln(ticks.minor, { tone: "lo" }), Ln(ticks.major, { tone: "mid" }));
  out.push(Dots([at([strip.x + 2, strip.y + 4, 0.6]), at([strip.x + strip.w - 2, strip.y + 4, 0.6])], { size: 0.45 }));
  // label plate at the near left corner
  const label = { x: -104, y: PLATE.y + 14, w: 30, d: 30, r: 1.5 };
  out.push(S(k.slabOf(label, 0, 0.8, P, 4), { tone: "lo", crease: "none" }));
  out.push(Ln(k.planOutline(k.insetPlan(label, 1.8), 0.8, P, 4), { tone: "faint" }));
  out.push(Ln([0, 1, 2, 3].map((i) => k.lineOnTop([label.x + 5 + i * 5, label.y + 5], [label.x + 5 + i * 5, label.y + 25 - i * 4], 0.8, P)).join(""), { tone: "lo", free: true }));
  out.push(Dots([at([label.x + label.w / 2, label.y + 2.6, 0.8]), at([label.x + label.w / 2, label.y + label.d - 2.6, 0.8])], { size: 0.45 }));
  put("stand", [0, 0, -2], out.join(""), shapes, { name: "stand.bench", bias: -800 });
}

// ======================= left: the front-side chip on its plinth =======================
function plinth() {
  const svg = S(k.slabOf(PLINTH, 0, LEFT_Z0, P, 4, 0.6), { tone: "mid", inner: Ln(k.sideSeam(PLINTH, 4, P, 4), { tone: "faint" }) });
  const groove = Ln(k.planOutline(k.insetPlan(LEFT, -2), LEFT_Z0, P, 2), { tone: "lo" });
  const sc = [[PLINTH.x + 3.2, PLINTH.y + 3.2], [PLINTH.x + PLINTH.w - 3.2, PLINTH.y + 3.2], [PLINTH.x + 3.2, PLINTH.y + PLINTH.d - 3.2], [PLINTH.x + PLINTH.w - 3.2, PLINTH.y + PLINTH.d - 3.2]];
  const screws = Ln(sc.map(([x, y]) => k.ring(x, y, 1.6, LEFT_Z0, P, 16)).join(""), { tone: "lo" }) + Dots(sc.map(([x, y]) => at([x, y, LEFT_Z0])), { size: 0.45 });
  put("stand", centreOf(PLINTH, 0), svg + groove + screws, [slabShape(PLINTH, 0, LEFT_Z0, {}, 4)], { name: "stand.plinth" });
  // a fence behind the block keeps it square
  const fence = { x: LEFT.x, y: LEFT.y - 5, w: LEFT.w, d: 5, r: 0.8 };
  const fsvg = S(k.slabOf(fence, LEFT_Z0, 10, P, 3, 0.4), { tone: "mid" }) + Dots([at([fence.x + 6, fence.y + 2.5, LEFT_Z0 + 10]), at([fence.x + fence.w - 6, fence.y + 2.5, LEFT_Z0 + 10])], { size: 0.45 });
  put("stand", centreOf(fence, LEFT_Z0), fsvg, [slabShape(fence, LEFT_Z0, 10, {}, 3)], { name: "stand.fence" });
}

function leftBlock() {
  put("fs", centreOf(LEFT, LEFT_Z0), `<g class="bp-block">${ST.leftSvg(P, V, L)}</g>`, [slabShape(LEFT, LEFT_Z0, LB.top, {}, 2)], { name: "fs.block" });
}

// bumps: a copper pillar with a solder cap, in a 4 x 3 grid on the top of a block
function bumps(piece, xc, top, name, attrs = "") {
  const cells = [];
  for (const dx of [-21, -7, 7, 21]) for (const y of [-12, 0, 12]) cells.push([xc + dx, y]);
  let svg = "";
  const shapes = [];
  for (const [x, y] of byDepth(cells)) {
    svg += S(k.cylinder(x, y, 2.4, top, 0.6, P, 24), { tone: "mid" });
    svg += S(k.cylinder(x, y, 1.7, top + 0.6, 1.4, P, 24), { tone: "hi", crease: "lo" });
    svg += S(G.sphereOf([x, y, top + 2.0 + 1.5], 1.9, P, { steps: 24 }), { tone: "hi", crease: "none" });
    shapes.push(cylShape(x, y, 2.4, top, 0.6), cylShape(x, y, 1.7, top + 0.6, 1.4));
  }
  put(piece, [xc, 0, top + 2], `<g ${attrs}>${svg}</g>`, shapes, { name });
}

// ======================= right: the backside block, its tray and the flip fixture =======================
function tray() {
  const base = S(k.slabOf(TRAY, 0, TRAY_H, P, 4, 0.5), { tone: "mid" });
  put("stand", centreOf(TRAY, 0), base + Dots(k.corners(TRAY, 3).map(([x, y]) => at([x, y, TRAY_H])), { size: 0.45 }), [slabShape(TRAY, 0, TRAY_H, {}, 4)], { name: "stand.tray" });
  const t = 2;
  const rims = [
    { x: TRAY.x, y: TRAY.y + t, w: t, d: TRAY.d - 2 * t, r: 0.4 },
    { x: TRAY.x + TRAY.w - t, y: TRAY.y + t, w: t, d: TRAY.d - 2 * t, r: 0.4 },
    { x: TRAY.x + 2, y: TRAY.y + TRAY.d - t, w: TRAY.w - 4, d: t, r: 0.4 },
  ];
  rims.forEach((rim, i) => put("stand", centreOf(rim, TRAY_H), S(k.slabOf(rim, TRAY_H, RIM_H, P, 2, 0.3), { tone: "mid" }), [slabShape(rim, TRAY_H, RIM_H, {}, 2)], { name: `stand.rim${i}` }));
}

function rightBlock() {
  const svg = `<g class="bp-block" data-block>${ST.rightSvg(FINAL, P, V, L)}</g>`;
  put("block", centreOf(RIGHT, RIGHT_Z0), svg, [slabShape(RIGHT, RIGHT_Z0, RIGHT_TOP - RIGHT_Z0, {}, 2)], { name: "block.right" });
}

function fixture() {
  // headstock housing with a lid seam, a nameplate slot and corner screws
  const body = S(k.slabOf(HEAD, 0, HEAD_TOP, P, 5, 0.8), { tone: "mid", inner: Ln([10, HEAD_TOP - 8].map((z) => k.sideSeam(HEAD, z, P, 5)).join(""), { tone: "faint" }) });
  const top = Ln(k.planOutline(k.insetPlan(HEAD, 3.5), HEAD_TOP, P, 4), { tone: "lo" }) + Dots(k.corners(HEAD, 2).map(([x, y]) => at([x, y, HEAD_TOP])), { size: 0.45 });
  put("tools", centreOf(HEAD, 0), body + top, [slabShape(HEAD, 0, HEAD_TOP, {}, 5)], { name: "tools.head" });
  // indexing motor on top, with fins and an encoder cap
  const mx = XR + 5;
  const my = HEAD.y + HEAD.d / 2;
  const F = FZ(mx, my);
  const ribs = G.ribsOf(F, HEAD_TOP + 2, HEAD_TOP + 13, 7, 24, P, { fade: [0.1, 0.55], seams: true });
  const motor = S(k.cylinder(mx, my, 7, HEAD_TOP, 15, P, 48, 0.4), { tone: "mid", inner: k.fadedSvg(ribs, { tone: "lo" }) }) + S(k.cylinder(mx, my, 5, HEAD_TOP + 15, 3, P, 32, 0.3), { tone: "mid" }) + Ln(k.ring(mx, my, 2, HEAD_TOP + 18, P, 16), { tone: "lo" });
  put("tools", [mx, my, HEAD_TOP + 8], motor, [cylShape(mx, my, 7, HEAD_TOP, 15), cylShape(mx, my, 5, HEAD_TOP + 15, 3)], { name: "tools.indexer" });
  // bearing boss and the face plate that holds the block by its back
  const Fb = FY(XR, 0, ZC);
  const boss = S(G.disc(BOSS.y0, BOSS.y1, BOSS.r, Fb, P), { tone: "mid" });
  put("tools", [XR, (BOSS.y0 + BOSS.y1) / 2, ZC], boss, [A.disc(Fb, BOSS.y0, BOSS.y1, BOSS.r)], { name: "tools.boss" });
  const face = S(G.disc(FACE.y0, FACE.y1, PLATE_R, Fb, P, { bevel: 0.4 }), { tone: "mid" });
  const bolts = Dots(G.dotsOf(Fb, FACE.y1, PLATE_R - 4, 16, P, { all: true }), { size: 0.45, tone: "mid" });
  const ring = Ln(G.circleOf(Fb, FACE.y1, PLATE_R - 7, P, 96), { tone: "faint" });
  put("tools", [XR, (FACE.y0 + FACE.y1) / 2, ZC], face + ring + bolts, [A.disc(Fb, FACE.y0, FACE.y1, PLATE_R)], { name: "tools.faceplate" });
}

function grinder() {
  const base = S(k.slabOf(COL_BASE, 0, 5, P, 4, 0.5), { tone: "mid" }) + Dots(k.corners(COL_BASE, 3).map(([x, y]) => at([x, y, 5])), { size: 0.45 });
  put("tools", centreOf(COL_BASE, 0), base, [slabShape(COL_BASE, 0, 5, {}, 4)], { name: "tools.colbase" });
  const seams = [50, 100, 140].map((z) => k.sideSeam(COL, z, P, 3)).join("");
  const post = S(k.slabOf(COL, 5, COL_TOP - 5, P, 3, 0.5), { tone: "mid", inner: Ln(seams, { tone: "faint" }) });
  // the lead-screw slot the carriage rides in, on the front face, closed
  const fy = COL.y + COL.d;
  const slot = k.pathOf([[XR - 1.4, fy, 14], [XR + 1.4, fy, 14], [XR + 1.4, fy, COL_TOP - 8], [XR - 1.4, fy, COL_TOP - 8]].map(at), true);
  put("tools", centreOf(COL, 60), post + Ln(slot, { tone: "lo" }), [slabShape(COL, 5, COL_TOP - 5, {}, 3)], { name: "tools.column" });
  const cap = S(k.slabOf(k.insetPlan(COL, -1.5), COL_TOP, 3, P, 3, 0.4), { tone: "mid" }) + Ln(k.ring(XR, COL.y + COL.d / 2, 2.4, COL_TOP + 3, P, 16), { tone: "lo" });
  put("tools", [XR, COL.y + COL.d / 2, COL_TOP + 1.5], cap, [slabShape(k.insetPlan(COL, -1.5), COL_TOP, 3, {}, 3)], { name: "tools.colcap" });

  // the moving head: carriage, arm, spindle, hub, wheel, motor (live.js moves [data-grind] together)
  const g = 'data-grind=""';
  const car = S(k.slabOf(CARRIAGE, CAR_Z[0], CAR_Z[1] - CAR_Z[0], P, 3, 0.5), { tone: "mid", inner: Ln(k.sideSeam(CARRIAGE, (CAR_Z[0] + CAR_Z[1]) / 2, P, 3), { tone: "faint" }) });
  const carDots = Dots([[CARRIAGE.x + 3, CAR_Z[0] + 3], [CARRIAGE.x + 17, CAR_Z[0] + 3], [CARRIAGE.x + 3, CAR_Z[1] - 3], [CARRIAGE.x + 17, CAR_Z[1] - 3]].map(([x, z]) => at([x, CARRIAGE.y + CARRIAGE.d, z])), { size: 0.45 });
  put("tools", centreOf(CARRIAGE, CAR_Z[0]), car + carDots, [slabShape(CARRIAGE, CAR_Z[0], CAR_Z[1] - CAR_Z[0], {}, 3)], { name: "tools.carriage", attrs: g });
  const arm = S(k.slabOf(ARM, ARM_Z[0], ARM_Z[1] - ARM_Z[0], P, 3, 0.5), { tone: "mid", inner: Ln(k.sideSeam(ARM, ARM_Z[0] + 4, P, 3), { tone: "faint" }) });
  const armDots = Dots([at([ARM.x + 3.5, ARM.y + 4, ARM_Z[1]]), at([ARM.x + ARM.w - 3.5, ARM.y + 4, ARM_Z[1]])], { size: 0.45 });
  put("tools", centreOf(ARM, ARM_Z[0]), arm + armDots, [slabShape(ARM, ARM_Z[0], ARM_Z[1] - ARM_Z[0], {}, 3)], { name: "tools.arm", attrs: g });
  const F = FZ(XR, 0);
  const sp = S(k.cylinder(XR, 0, SPINDLE.r, SPINDLE.z0, SPINDLE.z1 - SPINDLE.z0, P, 40, 0.4), { tone: "mid", inner: Ln([SPINDLE.z0 + 6, SPINDLE.z0 + 13].map((z) => k.sideArc(XR, 0, SPINDLE.r, z, P, 24)).join(""), { tone: "faint" }) });
  put("tools", [XR, 0, SPINDLE.z0 + 8], sp, [cylShape(XR, 0, SPINDLE.r, SPINDLE.z0, SPINDLE.z1 - SPINDLE.z0)], { name: "tools.spindle", attrs: g });
  const hub = S(k.cylinder(XR, 0, HUB.r, HUB.z0, HUB.z1 - HUB.z0, P, 48, 0.3), { tone: "mid" }) + Dots(G.dotsOf(F, HUB.z1, HUB.r - 2, 6, P, { all: true }), { size: 0.4 });
  put("tools", [XR, 0, HUB.z0 + 2], hub, [cylShape(XR, 0, HUB.r, HUB.z0, HUB.z1 - HUB.z0)], { name: "tools.hub", attrs: g });
  // cup wheel: diamond segments round the rim, drawn in phases so it can turn
  const PH = 6;
  const segs = [];
  for (let p = 0; p < PH; p++) {
    const list = G.ribsOf(F, WHEEL_Z, WHEEL_Z + WHEEL.h * 0.55, WHEEL.r, 36, P, { phase: (p / PH) * ((2 * Math.PI) / 36), fade: [0.1, 0.55] });
    segs.push(`<g data-phase="${p}"${p ? ' style="display:none"' : ""}>${k.fadedSvg(list, { tone: "lo" })}</g>`);
  }
  const wheel = S(k.cylinder(XR, 0, WHEEL.r, WHEEL_Z, WHEEL.h, P, 72, 0.4), { tone: "hi", crease: "lo", inner: Ln(k.sideArc(XR, 0, WHEEL.r, WHEEL_Z + WHEEL.h * 0.55, P, 48), { tone: "lo" }) + segs.join("") });
  put("tools", [XR, 0, WHEEL_Z + 2], wheel, [cylShape(XR, 0, WHEEL.r, WHEEL_Z, WHEEL.h)], { name: "tools.wheel", attrs: g });
  const ribs = G.ribsOf(FZ(XR, 0), MOTOR.z0 + 2.5, MOTOR.z1 - 3.5, MOTOR.r, 28, P, { fade: [0.1, 0.55], seams: true });
  const motor = S(k.cylinder(XR, 0, MOTOR.r, MOTOR.z0, MOTOR.z1 - MOTOR.z0, P, 56, 0.4), { tone: "mid", inner: k.fadedSvg(ribs, { tone: "lo" }) }) + S(k.cylinder(XR, 0, 5.5, MOTOR.z1, 2.5, P, 32, 0.3), { tone: "mid" }) + Ln(k.ring(XR, 0, 2.2, MOTOR.z1 + 2.5, P, 16), { tone: "lo" });
  put("tools", [XR, 0, MOTOR.z0 + 8], motor, [cylShape(XR, 0, MOTOR.r, MOTOR.z0, MOTOR.z1 - MOTOR.z0), cylShape(XR, 0, 5.5, MOTOR.z1, 2.5)], { name: "tools.motor", attrs: g });
}

// ======================= controller and its leads =======================
function controller() {
  const box = S(k.slabOf(CTRL, 0, CTRL_TOP, P, 4, 0.8), { tone: "mid", inner: Ln(k.sideSeam(CTRL, 5, P, 4), { tone: "faint" }) });
  const vents = [];
  for (let i = 0; i < 5; i++) vents.push(k.planOutline({ x: CTRL.x + 5 + i * 5, y: CTRL.y + 5, w: 2.2, d: 16, r: 1 }, CTRL_TOP, P, 3));
  const top = Ln(vents.join(""), { tone: "lo" }) + Dots(k.corners(CTRL, 2.4).map(([x, y]) => at([x, y, CTRL_TOP])), { size: 0.45 });
  const kx = CTRL.x + CTRL.w - 7;
  const ky = CTRL.y + CTRL.d - 7;
  const knob = S(k.cylinder(kx, ky, 3.4, CTRL_TOP, 3, P, 32, 0.3), { tone: "mid", inner: Ln(k.knurl(kx, ky, 3.4, CTRL_TOP + 0.4, CTRL_TOP + 2.6, 20, P), { tone: "lo" }) }) + Ln(k.lineOnTop([kx, ky], [kx + 2.6, ky], CTRL_TOP + 3, P), { tone: "hi", free: "end" });
  // display window on the front (+y) face with the step number
  const fy = CTRL.y + CTRL.d;
  const x0 = CTRL.x + 5;
  const x1 = CTRL.x + 27;
  const win = k.pathOf([[x0, fy, 7], [x1, fy, 7], [x1, fy, 15], [x0, fy, 15]].map(at), true);
  const display = `<path class="bp-screen" d="${win}"/>` + Ln(win, { tone: "lo" });
  const text = `<g transform="${k.sideMatrix([x0 + 1.6, fy], 9.4, P, "left")}"><text class="bp-readout" data-ctrl font-size="4.2" x="0" y="0">STEP 7</text></g>`;
  const leds = Dots([at([x1 + 3, fy, 13]), at([x1 + 6, fy, 13])], { size: 0.55, tone: "hi" });
  put("tools", centreOf(CTRL, 0), box + top + knob + display + text + leds, [slabShape(CTRL, 0, CTRL_TOP, { name: "tools.ctrl" }), cylShape(kx, ky, 3.4, CTRL_TOP, 3, { owner: "tools.ctrl" })], { name: "tools.ctrl" });
}

function leads() {
  // controller back face to the headstock's right side (indexer), and to the grinder column base
  const a0 = stud("tools", [CTRL.x + 8, CTRL.y, 8], [0, -1, 0], 1.8, 1.6, { name: "tools.ctrlstud" });
  const a1 = stud("tools", [CTRL.x + 18, CTRL.y, 8], [0, -1, 0], 1.8, 1.6, { name: "tools.ctrlstud" });
  const h1 = stud("tools", [HEAD.x + HEAD.w, HEAD.y + 9, 14], [1, 0, 0], 1.8, 1.6, { name: "tools.headstud" });
  const c1 = stud("tools", [COL_BASE.x + COL_BASE.w, COL_BASE.y + 15, 2.6], [1, 0, 0], 1.8, 1.6, { name: "tools.colstud" });
  cable("tools", [a0, [a0[0], a0[1] - 4, 8], [a0[0], a0[1] - 4, 1.1], [a0[0], h1[1], 1.1], [h1[0] + 6, h1[1], 1.1], [h1[0] + 6, h1[1], h1[2]], h1], { name: "tools.indexlead" });
  cable("tools", [a1, [a1[0], a1[1] - 8, 8], [a1[0], a1[1] - 8, 1.1], [a1[0], c1[1], 1.1], [c1[0] + 4, c1[1], 1.1], [c1[0] + 4, c1[1], c1[2]], c1], { name: "tools.grindlead" });
}

bench();
plinth();
leftBlock();
bumps("fs", BLK.left.xc, LEFT_TOP, "fs.bumps");
tray();
fixture();
rightBlock();
bumps("bumps", XR, RIGHT_TOP, "bumps.right", 'data-bumps=""');
grinder();
controller();
leads();

if (!process.argv.includes("--fast")) A.settle(R, P);
R.items.sort((a, b) => a.key - b.key);
const groups = R.items.map((item, index) => `<g class="it" data-piece="${item.piece}" data-k="${item.key.toFixed(2)}" data-i="${index}"${item.attrs ? " " + item.attrs : ""}>${item.svg}</g>`);

const LABEL = `Two sawn, magnified chip blocks on one bench. Left: a conventional chip, power and signal wiring sharing every layer above the transistors, bumps on top. Right: a backside-power chip held on a rotary flip fixture under a cup-wheel grinder: a carrier wafer at the bottom, the fine signal wiring, the transistors, a sliver of silicon pierced by nano-TSVs, thick backside power layers and bumps on top. A controller with a step display drives the fixture and the grinder.`;
const svg = k.figureSvg({ width: W, height: H, label: LABEL, body: [`<g class="bp-layers">${groups.join("")}</g>`], className: "bp-svg" });

const unit = (vector) => {
  const o = at([0, 0, 0]);
  const p = at(vector);
  return [p[0] - o[0], p[1] - o[1]];
};
const DATA = {
  P,
  V,
  L,
  EZ: unit([0, 0, 1]),
  steps: M.STEPS,
  pieces: Object.fromEntries(Object.entries(M.PIECES).map(([id, p]) => [id, { name: p.name, say: p.say }])),
  order: M.ORDER,
  idle: M.IDLE,
  done: M.DONE,
  waferUm: M.WAFER_UM,
  thinNm: M.IMEC.thinNm,
};

const PARTS = M.ORDER.map((id, index) => `<button type="button" class="bp-part" data-part="${id}"><span class="bp-num">${String(index + 1).padStart(2, "0")}</span>${M.PIECES[id].name}</button>`).join("");
const corners = `<div class="iso-plate-corners" aria-hidden="true"><span class="iso-plate-corner" data-corner="fig">Fig 1</span><span class="iso-plate-corner" data-corner="title">Front-side vs backside power</span><span class="iso-plate-corner" data-corner="readout" data-readout>${M.DONE}</span></div>`;
const controls = `<div class="bp-controls"><span class="bp-hint">Hover a layer · Space plays the build</span><span class="bp-live" aria-live="polite" data-live></span></div>`;
const stageEl = `<div class="bp-stage" tabindex="0" role="slider" aria-label="Two chip blocks: front-side power on the left, backside power on the right on a flip fixture under a grinder. Hover, or use the arrow keys, to pick a part; Space plays or pauses the backside-power build; Escape stops it and shows the finished chip; the slider below steps through the build." aria-valuemin="0" aria-valuemax="${M.ORDER.length}" aria-valuenow="0" aria-valuetext="${M.DONE}">${svg}</div>`;
const caption = `Left, the usual chip: current enters at the bumps on top and has to climb down through every wiring layer, ${M.IMEC.beolLayers[0]} to ${M.IMEC.beolLayers[1]} of them on a modern chip, where power lines take at least ${M.IMEC.powerRoutingPct}% of the routing (imec). Right, backside power as Intel builds it for ${M.INTEL_18A.node} (PowerVia) and TSMC for ${M.A16.node} (Super Power Rail): the front keeps only signal wiring, a carrier wafer is bonded on and the stack flipped, the original silicon is ground from ${M.WAFER_UM} µm to ${M.IMEC.thinNm} nanometres, and nano-TSVs carry current from thick power layers on the back straight to the transistors. Lighter copper is power, darker is signal. The blocks are illustrative: hugely magnified, heights compressed, layer and wire counts reduced, and the flip fixture and grinder stand in for the separate bonding, flipping and back-grinding tools a fab uses on whole 300 mm wafers.`;
const scrub = `<span class="bp-scrub"><button type="button" class="bp-play" data-play aria-label="Play the backside-power build"><span class="bp-play-icon" aria-hidden="true"></span><span data-play-text>Play</span></button><input type="range" class="bp-range" data-scrub min="0" max="1000" step="1" value="1000" aria-label="Build: 0 is a wafer with transistors starting, 1000 is the finished backside-power chip"><span class="bp-step" data-step>07 · Bumps on the back</span></span>`;
const body = `<figure class="iso-figure bp"><div class="iso-plate">${corners}${stageEl}${controls}</div><figcaption class="iso-legend">${scrub}<span class="bp-parts">${PARTS}</span><span class="iso-caption">${caption}</span></figcaption></figure>`;

const CSS = readFileSync(join(HERE, "backside-power.css"), "utf8");
const STACK = readFileSync(join(HERE, "stack.mjs"), "utf8").replace(/^export /gm, "");
const LIVE = readFileSync(join(HERE, "live.js"), "utf8").replace("__DATA__", JSON.stringify(DATA));
const out = writeChapter({ slug: "backside-power", figure: body, css: CSS, script: STACK + LIVE, lesson: LESSON });
console.log("wrote", out.file, `${out.kb} KB`, `${R.items.length} items`, `${R.solids.length} solids`);

A.auditOrExit(R, P);
