// Wafer prober with a docked ATE test head, sectioned at the probe card so the probes and the die can be seen.
// node build.mjs [--audit] [--fast]
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as M from "./model.mjs";
import { k, G, A, Tube } from "../../site/kit.mjs";
import { writeChapter } from "../../site/shell.mjs";
import { LESSON } from "./lesson.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

// ---- world (x, y on the floor, z up). The wafer and its die grid are to scale with each other (SC units a mm);
// the machine around them is illustrative in proportion.
const W = 760;
const H = 580;
const AZIMUTH = 45;
const ELEVATION = 40;
const SC = 0.4;
const WR = (M.WAFER_MM / 2) * SC; // 60
const DW = M.DIE_MM[0] * SC;
const DH = M.DIE_MM[1] * SC;

const CAB = { x: -150, y: -130, w: 300, d: 305, r: 4 };
const BASE_TOP = 14;
const FOOT = 10;
// stage stack
const RAIL_X = [-100, 100];
const RAIL = { y: -116, d: 282, w: 8, z: BASE_TOP, h: 5 };
const YB = 19; // Y bearing blocks 19..22
const YCAR = { x: -130, y: -50, w: 260, d: 100, r: 3, z: 22, h: 5 };
const XRAIL_Y = [-35, 35];
const XR = { x: -126, w: 252, d: 7, z: 27, h: 4 };
const XCAR = { x: -50, y: -46, w: 138, d: 92, r: 3, z: 35, h: 6 };
const ZCOL = { r: 30, z: 41, h: 11 };
const THETA = { r: 40, z: 52, h: 3 };
const CHUCK = { r: 64, z: 55, h: 8 };
const WAFER_Z = 63;
const WAFER_T = 1.2;
const WAFER_TOP = WAFER_Z + WAFER_T;
const UPCAM = [76, 0];
// probe stack
const TIP = 70;
const LIFT = TIP - WAFER_TOP; // chuck rise to first touch
const PH = { x: -7.5, y: -9, w: 15, d: 18, r: 0.6, z: 72.4, h: 6.6 }; // MEMS probe head
const STX = { x: -12, y: -12, w: 24, d: 24, r: 1, z: 79, h: 7 }; // space transformer
const HP0 = 86;
const HP1 = 96;
const BORE = 92;
const RING = { rIn: 46, rOut: 104, z: 82, h: 4 };
const PCB = { r: 80, z: 86, h: 3 };
const STIFF = { rIn: 22, rOut: 42, z: 89, h: 3 };
const POGO = { rIn: 50, rOut: 74, z: 89, h: 15 };
const TH = { half: 115, z: 104, plate: 4, top: 158 };
// alignment camera on an arm from the -x wall
const DCAM = [-50, 10];
const ARM = { x: -59, y: 0, w: 18, d: 18, r: 1, z: 80, h: 6 }; // bracket bolted to the head plate's front edge
// loader, FOUP, monitor
const LOADER = { x: -272, y: -40, w: 122, d: 215, r: 4 };
const LOADER_TOP = 120;
const SLOT = { y0: -66 + 40, y1: 66 + 40, z0: 60, z1: 78 };
const LOADPOS = [-60, 40];
const SHELF = { x: -256, y: 175, w: 92, d: 42, r: 2, z: 66, h: 6 };
const FOUP = { x: -251, y: 178, w: 82, d: 36, r: 6, z: 72, h: 48 };
const MON = { x: -264, y: 44, w: 104, d: 8, r: 2, z: 150, h: 64 };
// tester mainframe
const MAIN = { x: 40, y: -250, w: 130, d: 82, r: 4 };
const MAIN_TOP = 150;

const P = k.fitProjection(
  [...k.boxCorners(CAB, -FOOT, TH.top), ...k.boxCorners(LOADER, -FOOT, MON.z + MON.h), ...k.boxCorners(MAIN, -FOOT, MAIN_TOP), ...k.boxCorners(SHELF, 0, 120), ...k.boxCorners({ x: -150, y: -130, w: 300, d: 360, r: 0 }, -FOOT, -FOOT)],
  W,
  H,
  { pad: 26, azimuth: AZIMUTH, elevation: ELEVATION },
);
const V = G.viewOf(P);
const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);
const centreOf = (plan, z) => [plan.x + plan.w / 2, plan.y + plan.d / 2, z];
const byDepth = (pts) => [...pts].sort((a, b) => k.depthOf([a[0], a[1], a[2] ?? 0], P) - k.depthOf([b[0], b[1], b[2] ?? 0], P));

const R = A.recorder(P, { order: [], spring: {} });
// every drawn item: piece (legend group), mv (which moving group carries it), its svg and true shapes
function put(piece, ref, svg, shapes, { bias = 0, name, mv = "", clip = false, ground = false } = {}) {
  const id = name ?? R.nameFor(`${piece}.item`);
  shapes.forEach((shape) => {
    shape.name = shape.name ?? id;
    if (ground) shape.ground = true;
  });
  R.put({ piece, at: ref, bias, svg, move: [0, 0, 0], shapes: shapes.map(R.solid), name: id, mv, clip });
}
function box(piece, name, plan, z, h, style = {}, { extra = "", inner = "", steps = 3, bevel = 0.6, bias = 0, mv, ground } = {}) {
  put(piece, centreOf(plan, z + h / 2), S(k.slabOf(plan, z, h, P, steps, bevel), { tone: "mid", ...style, inner }) + extra, [A.slab(plan, z, h, {}, steps)], { name: R.nameFor(name), bias, mv, ground });
}
function cyl(piece, name, x, y, r, z, h, style = {}, { extra = "", inner = "", steps = 40, bevel = 0.4, bias = 0, mv, ground } = {}) {
  put(piece, [x, y, z + h / 2], S(k.cylinder(x, y, r, z, h, P, steps, bevel), { tone: "mid", ...style, inner }) + extra, [A.cylinder(x, y, r, z, h, {})], { name: R.nameFor(name), bias, mv, ground });
}
function prism(piece, name, ring, z, h, style = {}, { extra = "", inner = "", bevel = 0, ref, mv } = {}) {
  const paths = k.extrude(ring, z, h, P, { convex: false, bevel });
  const cx = ring.reduce((a, p) => a + p[0], 0) / ring.length;
  const cy = ring.reduce((a, p) => a + p[1], 0) / ring.length;
  put(piece, ref ?? [cx, cy, z + h / 2], S(paths, { tone: "mid", ...style, inner }) + extra, [A.extruded(ring, z, h, {})], { name: R.nameFor(name), mv });
}
const screws = (points, z, ring = 1.8, size = 0.45) => L(points.map(([x, y]) => k.ring(x, y, ring, z, P, 14)).join(""), { tone: "lo" }) + Dots(points.map(([x, y]) => at([x, y, z])), { size });

// arcs and the sectioned shapes (the quadrant x > 0, y > 0 is cut away above the stage)
const arc = (r, a0, a1, step = Math.PI / 90) => {
  const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) / step));
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / n;
    return [r * Math.cos(a), r * Math.sin(a)];
  });
};
// the front (y > c) of each sectioned part is cut away; c = 0 at the card, further back for the pogo tower and test head
const dOf = (r, c) => Math.asin(Math.min(1, -c / r));
const halfAnnulus = (rIn, rOut, c = 0) => [...arc(rOut, Math.PI + dOf(rOut, c), 2 * Math.PI - dOf(rOut, c)), ...arc(rIn, 2 * Math.PI - dOf(rIn, c), Math.PI + dOf(rIn, c))];
const halfDisc = (r, c = 0) => arc(r, Math.PI + dOf(r, c), 2 * Math.PI - dOf(r, c));
const halfArc = (r, n, c = 0, pad = 0.08) => Array.from({ length: n }, (_, i) => Math.PI + dOf(r, c) + pad + ((Math.PI - 2 * dOf(r, c) - 2 * pad) * i) / (n - 1)).map((a) => [r * Math.cos(a), r * Math.sin(a)]);
// a vertical line on the cut face y = c at x = t, bottom edge to top edge
const cutLine = (t, z0, z1, c = 0) => k.segment([t, c, z0], [t, c, z1], P);

// =====================================================================
function cabinet() {
  const halo = `<path class="iso-halo" d="${k.haloOf(CAB, -FOOT, BASE_TOP + FOOT, P)}"/>`;
  const feet = [];
  const shapes = [];
  for (const [x, y] of byDepth(k.corners(CAB, 22))) {
    feet.push(S(k.cylinder(x, y, 9, -FOOT, 2, P, 28), { tone: "lo" }), S(k.cylinder(x, y, 6.5, -FOOT + 2, FOOT - 2, P, 28), { tone: "mid" }));
    shapes.push(A.cylinder(x, y, 9, -FOOT, FOOT, { name: "stand.foot" }));
  }
  const base = S(k.slabOf(CAB, 0, BASE_TOP, P, 6, 1.2), { tone: "mid", inner: L(k.sideSeam(CAB, 4, P, 6), { tone: "faint" }) });
  shapes.push(A.slab(CAB, 0, BASE_TOP, { name: "stand.base" }, 6));
  const groove = L(k.planOutline(k.insetPlan(CAB, 5), BASE_TOP, P, 4), { tone: "lo" });
  const sc = screws(k.corners(CAB, 10), BASE_TOP, 2.2, 0.5);
  // ruler strip along the front edge, 10 mm wafer ticks (4 units)
  const strip = { x: -86, y: CAB.y + CAB.d - 13, w: 172, d: 7, r: 1 };
  const ruler = S(k.slabOf(strip, BASE_TOP, 0.6, P, 3), { tone: "lo", crease: "none" });
  const t = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 4, 5, strip.y + 0.8, BASE_TOP + 0.6, [1.8, 3.4], P);
  const ticks = L(t.minor, { tone: "lo" }) + L(t.major, { tone: "mid" });
  // label plate in the front-right corner
  const label = { x: 112, y: 142, w: 32, d: 24, r: 1.5 };
  const lp = S(k.slabOf(label, BASE_TOP, 0.8, P, 3), { tone: "lo", crease: "none" }) + L(k.planOutline(k.insetPlan(label, 1.6), BASE_TOP + 0.8, P, 3), { tone: "faint" });
  const rules = L([0, 1, 2].map((i) => k.lineOnTop([label.x + 6 + i * 4, label.y + 5], [label.x + 6 + i * 4, label.y + 19 - i * 4], BASE_TOP + 0.8, P)).join(""), { tone: "lo", free: true });
  put("frame", [0, 0, -1], halo + feet.join("") + base + groove + sc + ruler + ticks + lp + rules, shapes, { name: "stand.base", bias: -2000 });

  // back walls: -y wall full width, -x wall with the transfer slot
  const wallY = { x: CAB.x, y: CAB.y, w: CAB.w, d: 6, r: 0.5 };
  box("frame", "stand.wally", wallY, BASE_TOP, HP0 - BASE_TOP, { tone: "lo" }, { inner: L(k.sideSeam(wallY, 40, P, 2), { tone: "faint" }), steps: 2, bias: -900 });
  const wx = { x: CAB.x, w: 6, r: 0.5 };
  const pieces = [
    { ...wx, y: CAB.y + 6, d: SLOT.y0 - CAB.y - 6, z: BASE_TOP, h: HP0 - BASE_TOP },
    { ...wx, y: SLOT.y0, d: SLOT.y1 - SLOT.y0, z: BASE_TOP, h: SLOT.z0 - BASE_TOP },
    { ...wx, y: SLOT.y0, d: SLOT.y1 - SLOT.y0, z: SLOT.z1, h: HP0 - SLOT.z1 },
    { ...wx, y: SLOT.y1, d: CAB.y + CAB.d - SLOT.y1, z: BASE_TOP, h: HP0 - BASE_TOP },
  ];
  pieces.forEach((p) => box("frame", "stand.wallx", p, p.z, p.h, { tone: "lo" }, { steps: 2, bevel: 0.3, bias: -900 }));
}

function stage() {
  // Y rails on the base, with end stops
  for (const x of RAIL_X) {
    const plan = { x: x - RAIL.w / 2, y: RAIL.y, w: RAIL.w, d: RAIL.d, r: 1 };
    const holes = [];
    for (let y = RAIL.y + 12; y < RAIL.y + RAIL.d - 6; y += 24) holes.push([x, y]);
    box("stage", "stand.yrail", plan, RAIL.z, RAIL.h, { tone: "lo" }, { extra: Dots(holes.map(([hx, hy]) => at([hx, hy, RAIL.z + RAIL.h])), { size: 0.4, tone: "lo" }), bias: -800 });
    for (const y of [RAIL.y - 6, RAIL.y + RAIL.d]) box("stage", "stand.ystop", { x: x - 6, y, w: 12, d: 6, r: 1 }, BASE_TOP, 9, { tone: "mid" }, { extra: screws([[x, y + 3]], BASE_TOP + 9, 1.4, 0.4), bias: -700 });
  }
  // Y carriage: bearing blocks and the plate (moves in y)
  for (const x of RAIL_X) for (const y of [-38, 26]) box("stage", "ycar.block", { x: x - 7, y, w: 14, d: 12, r: 1 }, YB, 3, { tone: "mid" }, { mv: "ycar" });
  box("stage", "ycar.plate", YCAR, YCAR.z, YCAR.h, { tone: "mid" }, { inner: L(k.sideSeam(YCAR, YCAR.z + 2, P, 3), { tone: "faint" }), mv: "ycar", bevel: 0.8, extra: screws(k.corners(YCAR, 6), YCAR.z + YCAR.h, 1.6, 0.45) });
  for (const y of XRAIL_Y) box("stage", "ycar.xrail", { x: XR.x, y: y - XR.d / 2, w: XR.w, d: XR.d, r: 1 }, XR.z, XR.h, { tone: "lo" }, { mv: "ycar" });
  // linear-motor magnet track between the rails
  box("stage", "ycar.magnet", { x: -118, y: -6, w: 236, d: 12, r: 1 }, XR.z, 2.2, { tone: "lo" }, { mv: "ycar", extra: L(Array.from({ length: 19 }, (_, i) => k.lineOnTop([-112 + i * 12.4, -6], [-112 + i * 12.4, 6], XR.z + 2.2, P)).join(""), { tone: "faint" }) });
  // X carriage (moves in x and y)
  for (const x of [-38, 62]) for (const y of XRAIL_Y) box("stage", "xcar.block", { x: x - 8, y: y - 6, w: 16, d: 12, r: 1 }, XR.z + XR.h, 4, { tone: "mid" }, { mv: "xcar" });
  box("stage", "xcar.plate", XCAR, XCAR.z, XCAR.h, { tone: "mid" }, { inner: L(k.sideSeam(XCAR, XCAR.z + 2.4, P, 3), { tone: "faint" }), mv: "xcar", bevel: 0.8, extra: screws(k.corners(XCAR, 6), XCAR.z + XCAR.h, 1.6, 0.45) });
  // Z column with bellows seams, theta ring, chuck
  cyl("stage", "xcar.zcol", 0, 0, ZCOL.r, ZCOL.z, ZCOL.h, { tone: "mid" }, { inner: L([44, 46, 48, 50].map((z) => k.sideArc(0, 0, ZCOL.r, z, P, 40)).join(""), { tone: "faint" }), mv: "chuck" });
  cyl("stage", "xcar.theta", 0, 0, THETA.r, THETA.z, THETA.h, { tone: "lo" }, { mv: "chuck" });
  const chuckTop = CHUCK.z + CHUCK.h;
  const grooves = L([62].map((r) => k.ring(0, 0, r, chuckTop, P, 96)).join(""), { tone: "faint" });
  cyl("stage", "chuck", 0, 0, CHUCK.r, CHUCK.z, CHUCK.h, { tone: "mid" }, { inner: L(k.sideArc(0, 0, CHUCK.r, CHUCK.z + 3, P, 64), { tone: "faint" }), extra: grooves, mv: "chuck", steps: 96, bevel: 0.6 });
  // up-looking camera on the X carriage: it finds the probe tips
  const [ux, uy] = UPCAM;
  cyl("cameras", "upcam.body", ux, uy, 6.5, XCAR.z + XCAR.h, 14, { tone: "mid" }, { inner: L(k.sideArc(ux, uy, 6.5, 50, P, 24), { tone: "faint" }), mv: "xcar" });
  cyl("cameras", "upcam.lens", ux, uy, 4.6, XCAR.z + XCAR.h + 14, 4, { tone: "hi" }, { extra: `<g class="wp-lens" data-lens="up">${L(k.ring(ux, uy, 2.6, XCAR.z + XCAR.h + 18, P, 24), { tone: "lo" })}</g>`, mv: "xcar" });
}

function wafer() {
  // the wafer: 300 mm, with its die grid (scribe lines) and the notch; lines run edge to edge.
  // Built where the fork hands it over (LOADPOS); the page moves it from there.
  const [lx, ly] = LOADPOS;
  const z = WAFER_TOP;
  const xs = [...new Set(M.DIES.flatMap((d) => [d.x - M.DIE_MM[0] / 2, d.x + M.DIE_MM[0] / 2]))].map((v) => v * SC);
  const ys = [...new Set(M.DIES.flatMap((d) => [d.y - M.DIE_MM[1] / 2, d.y + M.DIE_MM[1] / 2]))].map((v) => v * SC);
  const r = WR - 0.05;
  const grid = [
    ...xs.filter((x) => Math.abs(x) < r - 1).map((x) => k.lineOnTop([lx + x, ly - Math.sqrt(r * r - x * x)], [lx + x, ly + Math.sqrt(r * r - x * x)], z, P)),
    ...ys.filter((y) => Math.abs(y) < r - 1).map((y) => k.lineOnTop([lx - Math.sqrt(r * r - y * y), ly + y], [lx + Math.sqrt(r * r - y * y), ly + y], z, P)),
  ].join("");
  const notch = L(k.ring(lx, ly - WR + 1.4, 1.2, z, P, 12), { tone: "lo" });
  const svg = S(k.cylinder(lx, ly, WR, WAFER_Z, WAFER_T, P, 120, 0.3), { tone: "hi", crease: "lo" }) + L(grid, { tone: "faint" }) + notch;
  put("stage", [lx, ly, WAFER_Z], svg, [A.cylinder(lx, ly, WR, WAFER_Z, WAFER_T, {})], { name: "wafer", mv: "wafer", clip: true });
}

function fork() {
  // edge-grip end effector of the loader robot, built at the hand-off over the chuck's load position
  const [lx, ly] = LOADPOS;
  const z = 66;
  const bar = { x: CAB.x + 4, y: ly - 4, w: lx + 64 - (CAB.x + 4), d: 8, r: 2 };
  const cross = { x: lx - 56, y: ly - 36, w: 10, d: 72, r: 2 };
  const fingers = [Math.PI * 0.82, -Math.PI * 0.82, 0].map((a) => [lx + 62.8 * Math.cos(a), ly + 62.8 * Math.sin(a)]);
  let svg = "";
  const shapes = [];
  for (const [fx, fy] of byDepth(fingers.filter((p, i) => i < 2))) {
    svg += S(k.slabOf({ x: fx - 2.5, y: fy - 2.5, w: 5, d: 5, r: 0.8 }, WAFER_Z + 0.6, z - WAFER_Z - 0.6, P, 2), { tone: "mid" });
    shapes.push(A.slab({ x: fx - 2.5, y: fy - 2.5, w: 5, d: 5, r: 0.8 }, WAFER_Z + 0.6, z - WAFER_Z - 0.6, {}, 2));
  }
  svg += S(k.slabOf(cross, z + 2.5, 2.5, P, 2, 0.3), { tone: "mid" });
  shapes.push(A.slab(cross, z + 2.5, 2.5, {}, 2));
  svg += S(k.slabOf(bar, z, 2.5, P, 2, 0.3), { tone: "mid", inner: "" }) + Dots([at([lx - 51, ly - 30, z + 5]), at([lx - 51, ly + 30, z + 5])], { size: 0.4 });
  shapes.push(A.slab(bar, z, 2.5, {}, 2));
  const [fx, fy] = fingers[2];
  svg += S(k.slabOf({ x: fx - 2.5, y: fy - 2.5, w: 5, d: 5, r: 0.8 }, WAFER_Z + 0.6, z - WAFER_Z - 0.6, P, 2), { tone: "mid" });
  shapes.push(A.slab({ x: fx - 2.5, y: fy - 2.5, w: 5, d: 5, r: 0.8 }, WAFER_Z + 0.6, z - WAFER_Z - 0.6, {}, 2));
  put("loader", [lx, ly, z], svg, shapes, { name: "fork", mv: "fork", clip: true, ground: true });
}

function cameraArm() {
  box("cameras", "dcam.arm", ARM, ARM.z, ARM.h, { tone: "mid" }, { inner: L(k.sideSeam(ARM, ARM.z + 3, P, 2), { tone: "faint" }), steps: 2, extra: screws([[ARM.x + 4, ARM.y + 4], [ARM.x + ARM.w - 4, ARM.y + 4]], ARM.z + ARM.h, 1.2, 0.4) });
  const [cx, cy] = DCAM;
  cyl("cameras", "dcam.body", cx, cy, 7.5, 73, 7, { tone: "mid" }, { inner: L(k.sideArc(cx, cy, 7.5, 76.5, P, 28), { tone: "faint" }) });
  cyl("cameras", "dcam.lens", cx, cy, 5, 71, 2, { tone: "hi" }, { extra: `<g class="wp-lens" data-lens="down">${L(k.sideArc(cx, cy, 5, 72, P, 24), { tone: "lo" })}</g>` });
}

const POGO_CUT = -14;
const TH_CUT = -30;
function probeCard() {
  // insert ring in the head plate, card PCB, stiffener: sectioned at y = 0
  prism("card", "card.ring", halfAnnulus(RING.rIn, RING.rOut), RING.z, RING.h, { tone: "lo" }, { ref: [0, -60, RING.z], inner: L(cutLine(-70, RING.z, RING.z + RING.h) + cutLine(70, RING.z, RING.z + RING.h), { tone: "faint" }) });
  put("card", [0, -60, RING.z + RING.h + 0.1], screws(byDepth(halfArc(86, 9)), RING.z + RING.h, 1.4, 0.42), [A.extruded(halfAnnulus(83, 89), RING.z + RING.h, 0.05, {})], { name: "card.clamps" });
  // PCB with its rings of pads where the pogo pins land, and the stiffener
  const pads = [];
  for (let r = 52; r <= 72; r += 4) for (let a = Math.PI + 0.03; a < 2 * Math.PI - 0.02; a += 4.2 / r) pads.push(at([r * Math.cos(a), r * Math.sin(a), PCB.z + PCB.h]));
  prism("card", "card.pcb", halfDisc(PCB.r), PCB.z, PCB.h, { tone: "hi", crease: "lo" }, { ref: [0, -40, PCB.z], extra: Dots(pads, { size: 0.28, tone: "lo" }), inner: L([-60, -30, 30, 60].map((t) => cutLine(t, PCB.z, PCB.z + PCB.h)).join(""), { tone: "faint" }) });
  prism("card", "card.stiffener", halfAnnulus(STIFF.rIn, STIFF.rOut), STIFF.z, STIFF.h, { tone: "mid" }, { ref: [0, -30, STIFF.z], extra: screws(byDepth(halfArc(32, 5)), STIFF.z + STIFF.h, 1.2, 0.4), bevel: 0.3 });
  // space transformer and the MEMS probe head with its probe field
  box("card", "card.st", STX, STX.z, STX.h, { tone: "mid" }, { inner: L(k.sideSeam(STX, STX.z + 3, P, 2) + k.sideSeam(STX, STX.z + 6, P, 2), { tone: "faint" }), steps: 2 });
  const needles = [];
  const tips = [];
  for (let i = 0; i < 6; i++)
    for (let j = 0; j < 7; j++) {
      const x = PH.x + 1.5 + i * 2.4;
      const y = PH.y + 1.5 + j * 2.5;
      needles.push(k.segment([x, y, PH.z], [x + 0.5, y, TIP], P));
      tips.push(at([x + 0.5, y, TIP]));
    }
  const field = L(needles.join(""), { tone: "mid" }) + Dots(tips, { size: 0.32, tone: "hi" });
  const head = S(k.slabOf(PH, PH.z, PH.h, P, 2, 0.4), { tone: "hi", lit: true, inner: L(k.sideSeam(PH, PH.z + 2.2, P, 2), { tone: "lo" }) });
  put("card", [0, 0, PH.z], `<g class="wp-probes">${field}</g>` + head, [A.slab(PH, PH.z, PH.h, {}, 2), A.slab({ ...PH, x: PH.x + 1, y: PH.y + 1, w: PH.w - 1, d: PH.d - 2 }, TIP, PH.z - TIP, {}, 2)], { name: "card.probehead" });
}

function headPlate() {
  const ring = [[CAB.x, 0], [CAB.x, CAB.y], [CAB.x + CAB.w, CAB.y], [CAB.x + CAB.w, 0], ...arc(BORE, 0, -Math.PI, Math.PI / 120)];
  const cuts = L([-128, -110, 110, 128].map((t) => cutLine(t, HP0, HP1)).join(""), { tone: "faint" });
  prism("frame", "stand.headplate", ring, HP0, HP1 - HP0, { tone: "mid" }, { ref: [0, -80, HP0], inner: cuts, bevel: 0.8, extra: screws(byDepth(halfArc(102, 11)), HP1, 2, 0.5) + screws([[-140, -120], [140, -120], [-140, -8], [140, -8]], HP1, 2.2, 0.5) });
}

function testHead() {
  // pogo tower, cut a little further back so the card's pad rings show in front of it; pins on its cut face
  const pins = [];
  const xi = Math.sqrt(POGO.rIn ** 2 - POGO_CUT ** 2);
  const xo = Math.sqrt(POGO.rOut ** 2 - POGO_CUT ** 2);
  for (let t = xi + 1.6; t < xo - 1; t += 2.6) pins.push(cutLine(t, POGO.z, POGO.z + POGO.h, POGO_CUT), cutLine(-t, POGO.z, POGO.z + POGO.h, POGO_CUT));
  prism("head", "head.pogo", halfAnnulus(POGO.rIn, POGO.rOut, POGO_CUT), POGO.z, POGO.h, { tone: "mid" }, { ref: [0, -50, POGO.z], inner: L(pins.join(""), { tone: "faint" }) });
  // DUT interface plate and the test head, cut further back again; the cut face shows the pin-electronics boards
  const h = TH.half;
  const dib = { x: -h + 6, y: -h + 6, w: 2 * h - 12, d: h - 6 + TH_CUT, r: 0 };
  box("head", "head.dib", dib, TH.z, TH.plate, { tone: "lo" }, { steps: 2, bevel: 0.3 });
  const body = { x: -h, y: -h, w: 2 * h, d: h + TH_CUT, r: 0 };
  const boards = [];
  for (let t = -h + 7; t < h - 3; t += 6.5) boards.push(cutLine(t, TH.z + TH.plate, TH.top - 12, TH_CUT));
  const band = k.sideSeam(body, TH.top - 12, P, 2);
  box("head", "head.body", body, TH.z + TH.plate, TH.top - TH.z - TH.plate, { tone: "mid" }, { inner: L(boards.join(""), { tone: "lo" }) + L(band, { tone: "faint" }), steps: 2, bevel: 1 });
  // fans and lid screws on top, status LEDs and handles on the faces
  for (const [fx, fy] of [[-60, -72], [10, -72]]) {
    const blades = [];
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      blades.push(k.lineOnTop([fx + 5 * Math.cos(a), fy + 5 * Math.sin(a)], [fx + 18 * Math.cos(a + 0.5), fy + 18 * Math.sin(a + 0.5)], TH.top + 2, P));
    }
    cyl("head", "head.fan", fx, fy, 18, TH.top, 2, { tone: "mid" }, { extra: L(blades.join(""), { tone: "lo" }) + L(k.ring(fx, fy, 5, TH.top + 2, P, 24), { tone: "lo" }) });
  }
  put("head", [0, -60, TH.top], screws([[-h + 7, -h + 7], [h - 7, -h + 7], [-h + 7, TH_CUT - 7], [h - 7, TH_CUT - 7]], TH.top, 1.6, 0.48) + L(k.planOutline({ x: 40, y: -100, w: 64, d: 50, r: 2 }, TH.top, P, 2), { tone: "faint" }), [A.slab({ x: -h + 2, y: -h + 2, w: 2 * h - 4, d: h + TH_CUT - 4, r: 0 }, TH.top, 0.05, {}, 2)], { name: "head.lid" });
  for (const y of [-90, -50]) box("head", "head.handle", { x: h, y: y - 5, w: 5, d: 10, r: 1.5 }, TH.top - 30, 6, { tone: "mid" });
  const ledAt = [56, 64, 72, 80].map((x) => at([x, TH_CUT + 1, TH.top - 6]));
  put("head", [68, TH_CUT, TH.top - 6], S(k.slabOf({ x: 50, y: TH_CUT, w: 36, d: 1, r: 0.4 }, TH.top - 10, 8, P, 2), { tone: "lo" }) + `<g class="wp-leds">${Dots(ledAt, { size: 0.9, tone: "lo" })}</g>`, [A.slab({ x: 50, y: TH_CUT, w: 36, d: 1, r: 0.4 }, TH.top - 10, 8, {}, 2)], { name: "head.leds" });
}

function loader() {
  const halo = `<path class="iso-halo" d="${k.haloOf(LOADER, -FOOT, LOADER_TOP + FOOT, P)}"/>`;
  let svg = halo;
  const shapes = [];
  for (const [x, y] of byDepth(k.corners(LOADER, 16))) {
    svg += S(k.cylinder(x, y, 7, -FOOT, FOOT, P, 24), { tone: "lo" });
    shapes.push(A.cylinder(x, y, 7, -FOOT, FOOT, {}));
  }
  const seams = L(k.sideSeam(LOADER, 30, P, 4) + k.sideSeam(LOADER, LOADER_TOP - 6, P, 4), { tone: "faint" });
  svg += S(k.slabOf(LOADER, 0, LOADER_TOP, P, 4, 1), { tone: "mid", inner: seams });
  shapes.push(A.slab(LOADER, 0, LOADER_TOP, {}, 4));
  svg += screws(k.corners(LOADER, 8), LOADER_TOP, 1.8, 0.45) + L(k.planOutline(k.insetPlan(LOADER, 5), LOADER_TOP, P, 3), { tone: "lo" });
  // load-port door outline on the front face, behind the FOUP
  put("loader", centreOf(LOADER, 0), svg, shapes, { name: "stand.loader", ground: true });
  // shelf, bracket and the FOUP
  box("loader", "loader.shelf", SHELF, SHELF.z, SHELF.h, { tone: "mid" }, { extra: screws([[SHELF.x + 10, SHELF.y + 30], [SHELF.x + SHELF.w - 10, SHELF.y + 30]], SHELF.z + SHELF.h, 1.4, 0.42) });
  box("loader", "loader.bracket", { x: SHELF.x + SHELF.w / 2 - 4, y: SHELF.y, w: 8, d: 30, r: 1 }, 30, SHELF.z - 30, { tone: "lo" });
  const ribs = L([86, 100].map((z) => k.sideSeam(FOUP, z, P, 6)).join(""), { tone: "faint" });
  box("loader", "loader.foup", FOUP, FOUP.z, FOUP.h, { tone: "hi", crease: "lo" }, { inner: ribs, steps: 6, bevel: 1 });
  const flange = { x: FOUP.x + FOUP.w / 2 - 16, y: FOUP.y + FOUP.d / 2 - 10, w: 32, d: 20, r: 2 };
  box("loader", "loader.foupneck", { x: flange.x + 10, y: flange.y + 5, w: 12, d: 10, r: 1 }, FOUP.z + FOUP.h, 4, { tone: "mid" });
  box("loader", "loader.foupflange", flange, FOUP.z + FOUP.h + 4, 2.4, { tone: "mid" });
  // signal tower on the loader's top: base, three lamp segments, cap
  const [tx, ty] = [LOADER.x + 18, LOADER.y + LOADER.d - 22];
  cyl("loader", "loader.towerbase", tx, ty, 5, LOADER_TOP, 3, { tone: "mid" });
  cyl("loader", "loader.towerpole", tx, ty, 2, LOADER_TOP + 3, 10, { tone: "mid" }, { bevel: 0 });
  ["red", "amber", "green"].forEach((c, i) => cyl("loader", `loader.lamp`, tx, ty, 3.6, LOADER_TOP + 13 + i * 6, 6, { tone: i === 2 ? "hi" : "mid" }, { extra: i === 2 ? `<g class="wp-lamp" data-lamp="green">${L(k.sideArc(tx, ty, 3.6, LOADER_TOP + 16 + i * 6, P, 16), { tone: "lo" })}</g>` : "", bevel: 0.2 }));
  cyl("loader", "loader.towercap", tx, ty, 3, LOADER_TOP + 31, 1.4, { tone: "mid" });
  // service door and vents on the loader's front face, emergency stop beside them
  const face = LOADER.y + LOADER.d;
  const slot = (x0, x1, z) => `M${at([x0, face, z]).join(" ")}L${at([x1, face, z]).join(" ")}L${at([x1, face, z + 2]).join(" ")}L${at([x0, face, z + 2]).join(" ")}Z`;
  put("loader", [LOADER.x + 60, face, 20], L([0, 1, 2, 3].map((i) => slot(LOADER.x + 10, LOADER.x + 52, 14 + i * 5)).join(""), { tone: "lo" }), [A.slab({ x: LOADER.x + 10, y: face - 0.2, w: 42, d: 0.2, r: 0 }, 14, 18, {}, 1)], { name: "loader.vents" });
  const EF = G.frameAlong([LOADER.x + 113, face, 92], [0, 1, 0]);
  put("loader", [LOADER.x + 113, face + 2, 92], S(G.disc(0, 2.2, 6, EF, P, { steps: 32, bevel: 0.3 }), { tone: "mid" }) + S(G.disc(2.2, 5.4, 4.2, EF, P, { steps: 28, bevel: 0.3 }), { tone: "hi", crease: "lo" }), [A.disc(EF, 0, 2.2, 6), A.disc(EF, 2.2, 5.4, 4.2)], { name: "loader.estop" });
}

function monitor() {
  cyl("map", "monitor.post", -212, 48, 4, LOADER_TOP + 2, MON.z - LOADER_TOP - 2, { tone: "mid" }, { inner: L(k.sideArc(-212, 48, 4, LOADER_TOP + 12, P, 16), { tone: "faint" }) });
  cyl("map", "monitor.foot", -212, 48, 10, LOADER_TOP, 2, { tone: "lo" });
  // the bezel, a recessed screen in the plane of its front face, the wafer map drawn in that plane
  const face = MON.y + MON.d;
  const sx0 = MON.x + 6;
  const sx1 = MON.x + MON.w - 6;
  const sz1 = MON.z + MON.h - 6;
  const sz0 = MON.z + 7;
  const sw = sx1 - sx0;
  const sh = sz1 - sz0;
  const T = k.sideMatrix([sx0, face], sz1, P, "left");
  const cols = [...new Set(M.DIES.map((d) => d.i))].sort((a, b) => a - b);
  const rows = [...new Set(M.DIES.map((d) => d.j))].sort((a, b) => a - b);
  const cell = Math.min((sh - 6) / rows.length / M.DIE_MM[1], (sw * 0.56) / cols.length / M.DIE_MM[0]);
  const cw = M.DIE_MM[0] * cell;
  const ch = M.DIE_MM[1] * cell;
  const mapW = cw * cols.length;
  const mapH = ch * rows.length;
  const ox = 4;
  const oy = (sh - mapH) / 2;
  const cx = ox + mapW / 2;
  const cy = oy + mapH / 2;
  const cells = M.DIES.map((d, n) => {
    const x = ox + (d.i - cols[0]) * cw;
    const y = oy + (rows[rows.length - 1] - d.j) * ch;
    return `<rect class="wp-cell" data-n="${n}" data-pass="${d.pass ? 1 : 0}" x="${(x + 0.25).toFixed(2)}" y="${(y + 0.25).toFixed(2)}" width="${(cw - 0.5).toFixed(2)}" height="${(ch - 0.5).toFixed(2)}"/>`;
  }).join("");
  const rWafer = (M.WAFER_MM / 2) * cell;
  const outline = `<circle class="wp-mapedge" cx="${(cx + (12 - 13) * cell).toFixed(2)}" cy="${cy.toFixed(2)}" r="${rWafer.toFixed(2)}"/>`;
  const tx = ox + mapW + 5;
  const text = (y, key, value, cls = "") => `<text class="wp-scr ${cls}" x="${tx.toFixed(1)}" y="${y.toFixed(1)}">${key}</text><text class="wp-scr wp-num ${cls}" data-scr="${value}" x="${(sw - 4).toFixed(1)}" y="${y.toFixed(1)}" text-anchor="end">0</text>`;
  const screenSvg = `<g transform="${T}"><clipPath id="wp-screen"><rect x="0" y="0" width="${sw}" height="${sh}" rx="1.2"/></clipPath><g clip-path="url(#wp-screen)"><rect class="wp-glass" x="0" y="0" width="${sw}" height="${sh}"/>${outline}${cells}<text class="wp-scr wp-title" x="${tx.toFixed(1)}" y="9">WAFER 01</text>${text(19, "DIE", "die")}${text(28, "PASS", "pass", "wp-p")}${text(37, "FAIL", "fail", "wp-f")}${text(46, "YIELD", "yield")}</g><rect class="wp-bezel-in" x="0" y="0" width="${sw}" height="${sh}" rx="1.2"/></g>`;
  const bezel = S(k.slabOf(MON, MON.z, MON.h, P, 3, 0.8), { tone: "mid", inner: "" });
  const stand = Dots([at([MON.x + MON.w - 4, face, MON.z + 3.5])], { size: 0.7, tone: "hi" });
  put("map", centreOf(MON, MON.z + MON.h / 2), bezel + screenSvg + stand, [A.slab(MON, MON.z, MON.h, {}, 3)], { name: "monitor" });
  return { sw, sh };
}

function tester() {
  const halo = `<path class="iso-halo" d="${k.haloOf(MAIN, -FOOT, MAIN_TOP + FOOT, P)}"/>`;
  let svg = halo;
  const shapes = [];
  for (const [x, y] of byDepth(k.corners(MAIN, 12))) {
    svg += S(k.cylinder(x, y, 6, -FOOT, FOOT, P, 24), { tone: "lo" });
    shapes.push(A.cylinder(x, y, 6, -FOOT, FOOT, {}));
  }
  const doors = [MAIN.x + MAIN.w / 3, MAIN.x + (MAIN.w * 2) / 3].map((x) => k.segment([x, MAIN.y + MAIN.d, 0], [x, MAIN.y + MAIN.d, MAIN_TOP], P));
  svg += S(k.slabOf(MAIN, 0, MAIN_TOP, P, 4, 1), { tone: "mid", inner: L(doors.join("") + k.sideSeam(MAIN, MAIN_TOP - 12, P, 4), { tone: "faint" }) });
  shapes.push(A.slab(MAIN, 0, MAIN_TOP, {}, 4));
  // vents on the doors: closed slots in the face plane
  const face = MAIN.y + MAIN.d;
  const slots = [];
  for (let i = 0; i < 3; i++)
    for (let r = 0; r < 6; r++) {
      const x0 = MAIN.x + 8 + (i * MAIN.w) / 3;
      const z = 20 + r * 6;
      slots.push(`M${at([x0, face, z]).join(" ")}L${at([x0 + MAIN.w / 3 - 16, face, z]).join(" ")}L${at([x0 + MAIN.w / 3 - 16, face, z + 2.4]).join(" ")}L${at([x0, face, z + 2.4]).join(" ")}Z`);
    }
  svg += L(slots.join(""), { tone: "lo" });
  svg += k.faceTextSvg(k.sideMatrix([MAIN.x + 10, face], MAIN_TOP - 20, P, "left"), "ATE", { size: 7, tone: "lo" });
  svg += Dots([at([MAIN.x + MAIN.w - 10, face, MAIN_TOP - 18])], { size: 1, tone: "hi" });
  svg += screws(k.corners(MAIN, 8), MAIN_TOP, 1.8, 0.45);
  put("tester", centreOf(MAIN, 0), svg, shapes, { name: "stand.tester", ground: true });
  box("tester", "tester.cap", k.insetPlan(MAIN, 14), MAIN_TOP, 4, { tone: "mid" });
}

// cables from the test head's back face to the mainframe, each end on a connector shell
function cable(piece, name, points, r, { tone = "mid" } = {}) {
  const fit = r * 1.7;
  const fitLen = 6;
  const route = G.fillet(points, Math.max(8, r * 3), 10, { P, tube: r });
  const total = G.pathLength(route);
  const gaps = [[0, fitLen], [total - fitLen, total]];
  R.route(name, route, r, { gaps, rims: [fit, fit], piece });
  Tube.tubePieces(route, r, P, { maxLength: 40, spacing: 1.6, gaps }).forEach((pc, index) =>
    R.put({ piece, name: `${name}:${index}`, at: pc.mid, bias: 0.02, svg: Tube.tubeSvg(pc, { tone }), move: [0, 0, 0], route: name, chunk: index, mv: "", shapes: [R.solid(A.tube(pc.points, pc.radii, { name: `${name}:${index}`, owner: name }))] }),
  );
  [0, 1].forEach((index) => {
    const end = index ? route[route.length - 1] : route[0];
    const tangent = G.tangentAlong(route, index ? total : 0);
    const F = G.frameAlong(end, tangent);
    const [s0, s1] = index ? [-fitLen, 0] : [0, fitLen];
    const shell = G.disc(s0, s1, fit, F, P, { steps: 28, bevel: 0.3 });
    R.put({ piece, name: `${name}.shell${index}`, at: G.add3(end, G.mul3(tangent, (s0 + s1) / 2)), bias: 0.06, svg: S(shell, { tone: "mid" }), move: [0, 0, 0], mv: "", shapes: [R.solid(A.disc(F, s0, s1, fit, { name: `${name}.shell${index}`, owner: name }))] });
  });
}

cabinet();
stage();
wafer();
fork();
cameraArm();
probeCard();
headPlate();
testHead();
loader();
const screen = monitor();
tester();
const face = MAIN.y + MAIN.d;
cable("tester", "cable.a", [[64, -TH.half, 142], [64, face, 142]], 4.2);
cable("tester", "cable.b", [[96, -TH.half, 128], [96, face, 128]], 4.2);

if (!process.argv.includes("--fast")) A.settle(R, P);
// The stage moves far from where settle measured it, so its order is fixed by structure: everything on the floor,
// then the moving stack bottom to top, then everything at or above the head plate. Each band keeps its settled order.
const ABOVE = /^(card|head|stand\.headplate|dcam|cable|tester|monitor|stand\.tester|loader)/;
const MOVE_RANK = { ycar: 0, xcar: 1, chuck: 2, wafer: 3, fork: 5 };
const bandOf = (item) => (item.mv ? 1 : ABOVE.test(item.name) ? 2 : 0);
const rankOf = (item) => (item.name.startsWith("upcam") ? 4 : MOVE_RANK[item.mv] ?? 0);
R.items.sort((a, b) => bandOf(a) - bandOf(b) || (bandOf(a) === 1 ? rankOf(a) - rankOf(b) : 0) || a.key - b.key);

// the wafer and fork are clipped at the slot in the -x wall: inside the loader they are hidden
const zc = 68;
const a0 = at([CAB.x + 6, -2000, zc]);
const a1 = at([CAB.x + 6, 2000, zc]);
const nx = a1[1] - a0[1];
const ny = -(a1[0] - a0[0]);
const len = Math.hypot(nx, ny);
const inward = at([0, 0, zc]);
const sgn = Math.sign((inward[0] - a0[0]) * nx + (inward[1] - a0[1]) * ny);
const far = 4000;
const off = (p) => [p[0] + (sgn * nx * far) / len, p[1] + (sgn * ny * far) / len];
const clipPoly = [a0, a1, off(a1), off(a0)].map((p) => p.map((v) => v.toFixed(1)).join(" "));
const defs = `<defs><clipPath id="wp-slot"><path d="M${clipPoly.join("L")}Z"/></clipPath></defs>`;

const groups = R.items.map((item, index) => {
  const g = `<g class="it" data-piece="${item.piece}"${item.mv ? ` data-mv="${item.mv}"` : ""} data-i="${index}">${item.svg}</g>`;
  return item.clip ? `<g clip-path="url(#wp-slot)">${g}</g>` : g;
});

const unit = (vector) => {
  const o = at([0, 0, 0]);
  const p = at(vector);
  return [p[0] - o[0], p[1] - o[1]];
};

const ORDER = ["loader", "cameras", "stage", "card", "head", "tester", "map"];
const LABEL = `A 300 mm wafer prober with its ATE test head docked on top, cut open at the probe card. A loader with a FOUP and an operator monitor stands at the left, the tester mainframe at the back right. Inside the prober a vacuum chuck rides an X, Y, Z and theta stage under the probe card, a bracket on the head plate holds the down-looking alignment camera, and the test head sits on the card through a pogo tower.`;
const svg = k.figureSvg({ width: W, height: H, label: LABEL, body: [defs, `<g class="wp-layers">${groups.join("")}</g>`], className: "wp-svg" });

const DATA = {
  EX: unit([1, 0, 0]),
  EY: unit([0, 1, 0]),
  EZ: unit([0, 0, 1]),
  sc: SC,
  lift: LIFT,
  loadPos: LOADPOS,
  dcam: DCAM,
  upcam: UPCAM,
  loaderX: CAB.x - 90,
  dies: M.DIES.map((d) => [Math.round(d.x * SC * 100) / 100, Math.round(d.y * SC * 100) / 100, d.pass ? 1 : 0]),
  marks: [[-20, 0], [20, 0]],
  gross: M.GROSS,
  good: M.GOOD,
  steps: M.STEPS,
  pieces: Object.fromEntries(Object.entries(M.PIECES).map(([id, p]) => [id, { name: p.name, say: p.say }])),
  order: ORDER,
  idle: M.IDLE,
  overdrive: M.OVERDRIVE_UM,
};

const PARTS = ORDER.map((id, index) => `<button type="button" class="wp-part" data-part="${id}"><span class="wp-num">${String(index + 1).padStart(2, "0")}</span>${M.PIECES[id].name}</button>`).join("");
const corners = `<div class="iso-plate-corners" aria-hidden="true"><span class="iso-plate-corner" data-corner="fig">Fig 13</span><span class="iso-plate-corner" data-corner="title">Wafer prober · test cell</span><span class="iso-plate-corner" data-corner="readout" data-readout>${M.IDLE}</span></div>`;
const controls = `<div class="wp-controls"><span class="wp-hint">Hover a part · Space plays the test</span><span class="wp-live" aria-live="polite" data-live></span></div>`;
const stageHtml = `<div class="wp-stage" tabindex="0" role="group" aria-roledescription="figure" aria-label="Wafer prober and tester. Hover, or use the arrow keys, to pick a part; Space plays or pauses the test sequence; Escape resets it; the slider below steps through it.">${svg}</div>`;
const caption = `A ${M.WAFER_MM} mm wafer of ${M.GROSS} reticle-sized dies (${M.DIE_MM[0]} × ${M.DIE_MM[1]} mm, the count that fits inside a ${M.EDGE_EXCLUSION_MM} mm edge exclusion) is probed one die per touchdown. The loader's robot lays the wafer on the vacuum chuck; a camera on a bracket under the head plate finds two marks on the wafer and a camera on the stage looks up at the probe tips, so the stage knows where both are. The chuck then rises until the MEMS probes press ${M.OVERDRIVE_UM} µm past first touch, the test head runs its patterns through the pogo tower, and the result is binned on the map. The good/bad pattern is illustrative; its count, ${M.GOOD} good, is the simple Poisson estimate e<sup>−A·D0</sup> for a ${M.DIE_CM2.toFixed(2)} cm² die at D0 = ${M.D0_PER_CM2}/cm². The wafer, die grid and ruler (10 mm ticks) are to scale with each other; the machine's proportions, the probe count and probe length are illustrative. The head plate and card are cut open through the card's centre, and the pogo tower and test head a little behind it, so the card's pad rings show.`;
const scrub = `<span class="wp-scrub"><button type="button" class="wp-play" data-play aria-label="Play the test sequence"><span class="wp-play-icon" aria-hidden="true"></span><span data-play-text>Play</span></button><input type="range" class="wp-range" data-scrub min="0" max="1000" step="1" value="0" aria-label="Test sequence: 0 is the wafer still in the FOUP, 1000 is the finished map"><span class="wp-step" data-step>01 · Load wafer</span></span>`;
const body = `<figure class="iso-figure wp"><div class="iso-plate">${corners}${stageHtml}${controls}</div><figcaption class="iso-legend">${scrub}<span class="wp-parts">${PARTS}</span><span class="iso-caption">${caption}</span></figcaption></figure>`;

const CSS = readFileSync(join(HERE, "wafer-probe.css"), "utf8");
const LIVE = readFileSync(join(HERE, "live.js"), "utf8").replace("__DATA__", JSON.stringify(DATA));
const out = writeChapter({ slug: "wafer-probe", figure: body, css: CSS, script: LIVE, lesson: LESSON });
console.log("wrote", out.file, `${out.kb} KB`, `${R.items.length} items`, `${R.solids.length} solids`, `screen ${screen.sw.toFixed(1)}×${screen.sh.toFixed(1)}`);

A.auditOrExit(R, P);
