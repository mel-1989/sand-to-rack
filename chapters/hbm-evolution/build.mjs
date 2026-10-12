// HBM stacks through seven generations, cut open on a measuring bench; a laser height gauge on a rail visits each one.
// node build.mjs [--audit] [--fast]
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as M from "./model.mjs";

import { k, G, A, Tube } from "../../site/kit.mjs";
import { writeChapter } from "../../site/shell.mjs";
import { LESSON } from "./lesson.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

// ---- world layout (x, y on the floor, z up). Plan sizes illustrative; stack heights scaled from µm. ----
const W = 640;
const H = 380;
const AZIMUTH = 64;
const ELEVATION = 34;
const Z_PER_UM = 0.064; // 720 µm -> 46 units (heights exaggerated against the plan)
const DRAW_UM = 720; // drawn height for a generation with no sourced height (illustrative)

const PLATE = { x: -228, y: -106, w: 456, d: 168, r: 10 };
const PLATE_H = 12;
const FOOT_H = 6;
const FIX = { x: -170, y: -28, w: 340, d: 56, r: 3 };
const FIX_TOP = 6;
const PITCH = 48;
const N = M.GENS.length;
const STATION_X = M.GENS.map((_, i) => -PITCH * ((N - 1) / 2) + PITCH * i);
const COUPON_TOP = FIX_TOP + 3;
const INT_TOP = COUPON_TOP + 1.4;
const Z0 = INT_TOP + 0.8; // base die bottom, on its bumps
const BASE_H = 4;
const MOLD_W = 2;
const RAIL = { x: -204, y: -92, w: 408, d: 16, r: 1.5 };
const RAIL_TOP = 8;
const STOPS = [{ x: -212, y: -94, w: 8, d: 20, r: 1.2 }, { x: 204, y: -94, w: 8, d: 20, r: 1.2 }];
const STOP_TOP = 14;
const MOTOR = { x: 212, y: -93, w: 14, d: 18, r: 1.5 };
const MOTOR_TOP = 18;
const BOX = { x: 185, y: -50, w: 40, d: 30, r: 2 };
const BOX_TOP = 24;

// carriage, built at its park position and moved along x
const XP = -184;
const TRAVEL = STATION_X[N - 1] - XP;
const BLOCK = { x: XP - 15, y: -94, w: 30, d: 20, r: 2 };
const BLOCK_TOP = 20;
const COLUMN = { x: XP - 6, y: -90, w: 12, d: 12, r: 1 };
const COLUMN_TOP = 100;
const ARM = { x: XP - 5, y: -78, w: 10, d: 68, r: 0.6 };
const ARM_Z = 86;
const ARM_TOP = 94;
const HEAD = { x: XP - 8, y: -10, w: 16, d: 20, r: 1.5 };
const HEAD_Z = 76;
const HEAD_TOP = 98;

const heightOf = (g) => (g.heightUm ?? DRAW_UM) * Z_PER_UM;
const topOf = (g) => Z0 + heightOf(g);
const basePlan = (x) => ({ x: x - 13, y: -15, w: 26, d: 30, r: 0.4 });
const couponPlan = (x) => ({ x: x - 20, y: -21, w: 40, d: 42, r: 1.2 });
const intPlan = (x) => ({ x: x - 16, y: -18, w: 32, d: 36, r: 0.5 });

const ORDER = ["carriage", "bench", ...M.GENS.map((g) => g.id)];
const SPRING = { stagger: 0.05, stiffness: 64, damping: 16, substeps: 4 };
const MOVES = { carriage: [TRAVEL, 0, 0] };

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), ...k.boxCorners(COLUMN, 0, COLUMN_TOP + 2), ...k.boxCorners({ ...COLUMN, x: COLUMN.x + TRAVEL }, 0, COLUMN_TOP + 2), ...k.boxCorners({ ...HEAD, x: HEAD.x + TRAVEL }, 0, HEAD_TOP)],
  W,
  H,
  { pad: 22, azimuth: AZIMUTH, elevation: ELEVATION },
);
const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);
const centreOf = (plan, z) => [plan.x + plan.w / 2, plan.y + plan.d / 2, z];
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));

const R = A.recorder(P, { order: ORDER, spring: SPRING });
function put(piece, ref, svg, shapes, { bias = 0, name } = {}) {
  const id = name ?? R.nameFor(`${piece}.item`);
  shapes.forEach((shape) => (shape.name = shape.name ?? id));
  R.put({ piece, at: ref, bias, svg, move: MOVES[piece] ?? [0, 0, 0], shapes: shapes.map(R.solid), name: id });
}
const slab = (plan, z, h, steps = 3) => A.slab(plan, z, h, {}, steps);

// ---- bench: plate on feet, ruler, label plate, fixture strip with seven pockets, rail, stops, motor, controller ----
function bench() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
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
  // ruler strip along the near edge, ticks every 4 units, majors every 20
  const strip = { x: -204, y: 44, w: 260, d: 8, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 4, 5, strip.y + 0.8, 0.6, [2.2, 4], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(Dots([at([strip.x + 2, strip.y + 4, 0.6]), at([strip.x + strip.w - 2, strip.y + 4, 0.6])], { size: 0.45 }));
  // label plate
  const label = { x: 76, y: 40, w: 84, d: 16, r: 1.5 };
  out.push(S(k.slabOf(label, 0, 0.8, P, 4), { tone: "lo", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.8), 0.8, P, 4), { tone: "faint" }));
  out.push(L([0, 1, 2].map((i) => k.lineOnTop([label.x + 8, label.y + 5 + i * 3], [label.x + 62 - i * 14, label.y + 5 + i * 3], 0.8, P)).join(""), { tone: "lo", free: true }));
  out.push(Dots([at([label.x + 4, label.y + label.d / 2, 0.8]), at([label.x + label.w - 4, label.y + label.d / 2, 0.8])], { size: 0.45 }));
  put("bench", [0, 0, -6], out.join(""), shapes, { name: "stand.base", bias: -400 });

  // rail with its screw row and centre slot, and the two end stops
  const railSvg =
    S(k.slabOf(RAIL, 0, RAIL_TOP, P, 3, 0.5), { tone: "mid", inner: L(k.sideSeam(RAIL, 3, P, 3), { tone: "faint" }) }) +
    L(k.planOutline({ x: RAIL.x + 6, y: RAIL.y + RAIL.d / 2 - 1, w: RAIL.w - 12, d: 2, r: 1 }, RAIL_TOP, P, 3), { tone: "lo" }) +
    Dots(Array.from({ length: 11 }, (_, i) => at([RAIL.x + 14 + i * 38, RAIL.y + 3.5, RAIL_TOP])), { size: 0.45 });
  put("bench", centreOf(RAIL, 0), railSvg, [A.slab(RAIL, 0, RAIL_TOP, { name: "stand.rail" }, 3)], { name: "stand.rail" });
  STOPS.forEach((stop, i) => {
    const svg = S(k.slabOf(stop, 0, STOP_TOP, P, 3, 0.5), { tone: "mid" }) + Dots([at([stop.x + stop.w / 2, stop.y + 4, STOP_TOP]), at([stop.x + stop.w / 2, stop.y + stop.d - 4, STOP_TOP])], { size: 0.5 });
    put("bench", centreOf(stop, 0), svg, [A.slab(stop, 0, STOP_TOP, { name: "stand.stop" }, 3)], { name: `stand.stop${i}` });
  });

  // fixture strip with seven coupon pockets
  const pockets = STATION_X.map((x) => k.insetPlan(couponPlan(x), -1.2));
  const fixSvg =
    S(k.slabOf(FIX, 0, FIX_TOP, P, 4, 0.6), { tone: "mid", inner: L(k.sideSeam(FIX, 2.2, P, 4), { tone: "faint" }) }) +
    L(pockets.map((p) => k.planOutline(p, FIX_TOP, P, 3)).join(""), { tone: "lo" }) +
    L(STATION_X.map((x) => k.ring(x + 23.6, 23.6, 1.3, FIX_TOP, P, 14) + k.ring(x - 23.6, -23.6, 1.3, FIX_TOP, P, 14)).join(""), { tone: "lo" }) +
    Dots(STATION_X.flatMap((x) => [at([x + 23.6, 23.6, FIX_TOP]), at([x - 23.6, -23.6, FIX_TOP])]), { size: 0.4 });
  put("bench", centreOf(FIX, 0), fixSvg, [A.slab(FIX, 0, FIX_TOP, { name: "stand.fixture" }, 4)], { name: "stand.fixture" });

  // stepper motor behind the right stop: body with cooling seams, screws, connector on its front face
  const motorSeams = L([4, 8, 12].map((z) => k.sideSeam(MOTOR, z, P, 3)).join(""), { tone: "faint" });
  const motorSvg =
    S(k.slabOf(MOTOR, 0, MOTOR_TOP, P, 3, 0.5), { tone: "mid", inner: motorSeams }) +
    L(k.planOutline(k.insetPlan(MOTOR, 2.4), MOTOR_TOP, P, 3), { tone: "lo" }) +
    Dots(k.corners(MOTOR, 2.6).map(([x, y]) => at([x, y, MOTOR_TOP])), { size: 0.45 });
  put("bench", centreOf(MOTOR, 0), motorSvg, [A.slab(MOTOR, 0, MOTOR_TOP, { name: "stand.motor" }, 3)], { name: "stand.motor" });

  // controller box: lid groove, vents, two buttons, status dot, engraved name
  const vents = [0, 1, 2, 3].map((i) => k.planOutline({ x: BOX.x + 6, y: BOX.y + 5 + i * 3.2, w: 16, d: 1.4, r: 0.7 }, BOX_TOP, P, 3)).join("");
  const boxSvg =
    S(k.slabOf(BOX, 0, BOX_TOP, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(BOX, BOX_TOP - 4, P, 4), { tone: "faint" }) }) +
    L(k.planOutline(k.insetPlan(BOX, 2.4), BOX_TOP, P, 4) + vents, { tone: "lo" }) +
    Dots(k.corners(BOX, 3.6).map(([x, y]) => at([x, y, BOX_TOP])), { size: 0.45 }) +
    k.faceTextSvg(k.topMatrix([BOX.x + 30, BOX.y + 22.5], BOX_TOP, P, "x"), "HBM", { size: 2.6, tone: "lo", anchor: "middle" });
  put("bench", centreOf(BOX, 0), boxSvg, [A.slab(BOX, 0, BOX_TOP, { name: "stand.box" }, 4)], { name: "stand.box" });
  for (const [i, [x, y]] of [[BOX.x + 30, BOX.y + 7], [BOX.x + 30, BOX.y + 14]].entries()) {
    const svg = S(k.cylinder(x, y, 2.6, BOX_TOP, 1.6, P, 20, 0.3), { tone: "hi", crease: "lo" }) + L(k.ring(x, y, 1.2, BOX_TOP + 1.6, P, 14), { tone: "faint" });
    put("bench", [x, y, BOX_TOP + 1], svg, [A.cylinder(x, y, 2.6, BOX_TOP, 1.6, {})], { name: `stand.button${i}` });
  }

  // motor cable: connector shells on both faces, a cable between them
  const shells = [
    { x: MOTOR.x + 3, y: MOTOR.y + MOTOR.d, w: 8, d: 3, r: 0.6 },
    { x: MOTOR.x + 3, y: BOX.y - 3, w: 8, d: 3, r: 0.6 },
  ];
  shells.forEach((shell, i) => {
    const svg = S(k.slabOf(shell, 5, 8, P, 2, 0.3), { tone: "mid" }) + Dots([at([shell.x + 1.4, shell.y + 1.5, 13]), at([shell.x + shell.w - 1.4, shell.y + 1.5, 13])], { size: 0.4 });
    put("bench", centreOf(shell, 5), svg, [A.slab(shell, 5, 8, { name: "stand.shell" }, 2)], { name: `stand.shell${i}` });
  });
  const cx = MOTOR.x + 7;
  const route = [[cx, shells[0].y + shells[0].d, 9], [cx, shells[1].y, 9]];
  const r = 1.3;
  Tube.tubePieces(route, r, P, { maxLength: 30 }).forEach((piece, chunk) => {
    const name = R.nameFor("stand.cable");
    R.put({ piece: "bench", at: piece.mid, svg: Tube.tubeSvg(piece, { tone: "mid" }), move: [0, 0, 0], shapes: [A.tube(piece.points, r, { name: "stand.cable", limp: true })], name, route: "stand.cable", chunk });
  });
  R.route("stand.cable", route, r, { piece: "bench", limp: true });
}

// ---- one coupon per station: test substrate in its pocket, caps, silicon interposer, bumps under the base die ----
function coupon(index) {
  const x = STATION_X[index];
  const cp = couponPlan(x);
  const ip = intPlan(x);
  const base = basePlan(x);
  let svg = S(k.slabOf(cp, FIX_TOP, COUPON_TOP - FIX_TOP, P, 3, 0.4), { tone: "lo", crease: "faint", inner: L(k.sideSeam(cp, FIX_TOP + 1.4, P, 3), { tone: "faint" }) });
  const code = [];
  for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) if ((i * 7 + j * 3 + i * j + index) % 3 !== 0 || i === 0 || j === 0) code.push(at([cp.x + 2.4 + i * 0.9, cp.y + 2.4 + j * 0.9, COUPON_TOP]));
  svg += Dots(code, { size: 0.28, tone: "lo" }) + Dots([at([cp.x + cp.w - 3, cp.y + 3, COUPON_TOP])], { size: 0.5 });
  svg += S(k.slabOf(ip, COUPON_TOP, INT_TOP - COUPON_TOP, P, 2, 0.3), { tone: "mid" });
  svg += L(k.planOutline(k.insetPlan(ip, 1), INT_TOP, P, 2), { tone: "faint" });
  // underfill under the base die, with its bump row on the two faces we see
  const fill = k.insetPlan(base, 0.6);
  svg += S(k.slabOf(fill, INT_TOP, Z0 - INT_TOP, P, 2), { tone: "lo", crease: "none" });
  const bumpZ = (INT_TOP + Z0) / 2;
  const bumps = [];
  for (let bx = fill.x + 1.6; bx < fill.x + fill.w - 1; bx += 1.6) bumps.push(at([bx, fill.y + fill.d, bumpZ]));
  for (let by = fill.y + 1.6; by < fill.y + fill.d - 1; by += 1.6) bumps.push(at([fill.x + fill.w, by, bumpZ]));
  svg += Dots(bumps, { size: 0.3, tone: "mid" });
  // decoupling capacitors on the coupon's front margin
  const caps = [-10, -4, 4, 10].map((dx) => ({ x: x + dx - 1.6, y: ip.y + ip.d + 0.8, w: 3.2, d: 1.6, r: 0.2 }));
  for (const cap of byDepth(caps.map((c) => [c.x, c.y])).map(([cxp, cyp]) => caps.find((c) => c.x === cxp && c.y === cyp))) svg += S(k.slabOf(cap, COUPON_TOP, 1.2, P, 2), { tone: "hi", crease: "lo" });
  const shapes = [A.slab(cp, FIX_TOP, COUPON_TOP - FIX_TOP, { name: "stand.coupon" }, 3), slab(ip, COUPON_TOP, INT_TOP - COUPON_TOP), slab(fill, INT_TOP, Z0 - INT_TOP), ...caps.map((c) => slab(c, COUPON_TOP, 1.2, 2))];
  put("bench", centreOf(cp, FIX_TOP), svg, shapes, { name: `stand.coupon${index}` });
}

// ---- the stack: base die, core dies with TSV columns, bumps or hybrid bonds between them, mold on the far sides ----
function stack(index) {
  const g = M.GENS[index];
  const x = STATION_X[index];
  const base = basePlan(x);
  const core = k.insetPlan(base, MOLD_W);
  const top = topOf(g);
  const zb = Z0 + BASE_H;
  const n = g.high;
  const pitch = (top - zb) / n;
  const gap = g.bond === "hybrid" ? 0 : Math.min(0.7, pitch * 0.25);
  const t = pitch - gap;
  // TSV columns on the cut faces: four on the near y face, two on the near x face
  const colsY = [0.3, 0.42, 0.58, 0.7].map((f) => core.x + core.w * f);
  const colsX = [0.38, 0.62].map((f) => core.y + core.d * f);
  const tsvAt = (z, face) => [...colsY.map((cx) => at([cx, face.y + face.d, z])), ...colsX.map((cy) => at([face.x + face.w, cy, z]))];

  const parts = [];
  // base die: a logic die from a foundry on HBM4 and later, a DRAM-process buffer die before
  const logic = g.base || g.future;
  const baseInner = L(k.sideSeam(base, Z0 + 1.2, P, 2), { tone: "faint" }) + (logic ? L(k.sideSeam(base, Z0 + 2.6, P, 2), { tone: "faint" }) : "");
  parts.push(S(k.slabOf(base, Z0, BASE_H, P, 2, 0.3), { tone: "mid", crease: "lo", inner: baseInner }));
  parts.push(Dots(tsvAt(Z0 + BASE_H / 2, base), { size: 0.5, tone: "lo" }));
  // PHY bumps along the base die's exposed front margin
  const phy = [];
  for (let px = core.x + 2; px < core.x + core.w; px += 2.2) phy.push(at([px, core.y + core.d + MOLD_W / 2, zb]));
  parts.push(Dots(phy, { size: 0.28, tone: "lo" }));
  // mold compound on the two far sides (cut away on the near sides)
  const moldY = { x: base.x, y: base.y, w: base.w, d: MOLD_W, r: 0.3 };
  const moldX = { x: base.x, y: base.y + MOLD_W, w: MOLD_W, d: base.d - MOLD_W, r: 0.3 };
  parts.push(S(k.slabOf(moldY, zb, top - zb, P, 2), { tone: "lo", crease: "faint" }));
  parts.push(S(k.slabOf(moldX, zb, top - zb, P, 2), { tone: "lo", crease: "faint" }));
  // core dies, bottom to top
  for (let i = 0; i < n; i++) {
    const z = zb + i * pitch;
    if (gap > 0) {
      const uf = k.insetPlan(core, 0.4);
      parts.push(S(k.slabOf(uf, z, gap, P, 2), { tone: "lo", crease: "none" }));
      const bz = z + gap / 2;
      parts.push(Dots([...colsY.map((cx) => at([cx, uf.y + uf.d, bz])), ...colsX.map((cy) => at([uf.x + uf.w, cy, bz]))], { size: Math.min(0.55, gap * 0.8), tone: "hi" }));
    }
    parts.push(S(k.slabOf(core, z + gap, t, P, 2, 0), { tone: "hi", crease: "lo" }));
    parts.push(Dots(tsvAt(z + gap + t / 2, core), { size: Math.min(0.5, t * 0.24), tone: "mid" }));
  }
  // top face: pin-1 dot and the die's seal-ring groove
  parts.push(L(k.planOutline(k.insetPlan(core, 1.4), top, P, 2), { tone: "faint" }));
  parts.push(Dots([at([core.x + 2.6, core.y + 2.6, top])], { size: 0.5, tone: "mid" }));
  put(g.id, centreOf(base, Z0), parts.join(""), [A.slab(base, Z0, top - Z0, { name: `${g.id}.stack` }, 2)], { name: `${g.id}.stack` });
}

// ---- carriage: block on the rail, column, arm, laser head; built at park and moved along x ----
function carriage() {
  const blockSvg =
    S(k.slabOf(BLOCK, RAIL_TOP, BLOCK_TOP - RAIL_TOP, P, 3, 0.6), { tone: "mid", inner: L(k.sideSeam(BLOCK, RAIL_TOP + 3, P, 3), { tone: "faint" }) }) +
    Dots(k.corners(BLOCK, 2.6).map(([x, y]) => at([x, y, BLOCK_TOP])), { size: 0.45 });
  put("carriage", centreOf(BLOCK, RAIL_TOP), blockSvg, [slab(BLOCK, RAIL_TOP, BLOCK_TOP - RAIL_TOP)], { name: "carriage.block" });
  // lock knob on the block's top beside the column
  const kx = XP + 10.5;
  const ky = BLOCK.y + 10;
  const knob = S(k.cylinder(kx, ky, 2.4, BLOCK_TOP, 1.4, P, 20), { tone: "mid" }) + S(k.cylinder(kx, ky, 3.4, BLOCK_TOP + 1.4, 4, P, 28, 0.3), { tone: "hi", crease: "lo" }) + L(k.knurl(kx, ky, 3.4, BLOCK_TOP + 1.8, BLOCK_TOP + 5, 22, P), { tone: "lo" });
  put("carriage", [kx, ky, BLOCK_TOP + 2], knob, [A.cylinder(kx, ky, 2.4, BLOCK_TOP, 1.4, {}), A.cylinder(kx, ky, 3.4, BLOCK_TOP + 1.4, 4, {})], { name: "carriage.knob" });
  const colSeams = L([40, 60, 80].map((z) => k.sideSeam(COLUMN, z, P, 3)).join(""), { tone: "faint" });
  const colSvg = S(k.slabOf(COLUMN, BLOCK_TOP, COLUMN_TOP - BLOCK_TOP, P, 3, 0.4), { tone: "mid", inner: colSeams }) + S(k.slabOf(k.insetPlan(COLUMN, -1), COLUMN_TOP, 2, P, 3, 0.4), { tone: "mid" }) + Dots([at([COLUMN.x + 6, COLUMN.y + 6, COLUMN_TOP + 2])], { size: 0.5 });
  put("carriage", centreOf(COLUMN, BLOCK_TOP), colSvg, [slab(COLUMN, BLOCK_TOP, COLUMN_TOP - BLOCK_TOP), slab(k.insetPlan(COLUMN, -1), COLUMN_TOP, 2)], { name: "carriage.column" });
  const armSvg = S(k.slabOf(ARM, ARM_Z, ARM_TOP - ARM_Z, P, 2, 0.4), { tone: "mid", inner: L(k.sideSeam(ARM, ARM_Z + 2.4, P, 2), { tone: "faint" }) }) + Dots([at([ARM.x + 5, ARM.y + 4, ARM_TOP]), at([ARM.x + 5, ARM.y + ARM.d - 4, ARM_TOP])], { size: 0.45 });
  put("carriage", centreOf(ARM, ARM_Z), armSvg, [slab(ARM, ARM_Z, ARM_TOP - ARM_Z, 2)], { name: "carriage.arm" });
  // head: the beam is drawn first so the head's body covers its upper end
  const beam = `<g class="hb-beam" data-beam></g>`;
  const headSvg =
    beam +
    S(k.slabOf(HEAD, HEAD_Z, HEAD_TOP - HEAD_Z, P, 3, 0.6), { tone: "hi", crease: "lo", inner: L(k.sideSeam(HEAD, HEAD_Z + 4, P, 3) + k.sideSeam(HEAD, HEAD_TOP - 4, P, 3), { tone: "faint" }) }) +
    L(k.planOutline(k.insetPlan(HEAD, 2.4), HEAD_TOP, P, 3), { tone: "lo" }) +
    L(k.sideRing([XP, HEAD.y + HEAD.d, HEAD_Z + 11], 2.2, "y", P, 20), { tone: "lo" }) +
    `<g class="hb-led">${Dots([at([XP, HEAD.y + HEAD.d, HEAD_Z + 11])], { size: 1.1, tone: "lo" })}</g>` +
    Dots(k.corners(HEAD, 2.4).map(([x, y]) => at([x, y, HEAD_TOP])), { size: 0.45 });
  put("carriage", centreOf(HEAD, HEAD_Z), headSvg, [slab(HEAD, HEAD_Z, HEAD_TOP - HEAD_Z)], { name: "carriage.head" });
}

bench();
M.GENS.forEach((_, i) => coupon(i));
M.GENS.forEach((_, i) => stack(i));
carriage();

if (!process.argv.includes("--fast")) A.settle(R, P);
R.items.sort((a, b) => a.key - b.key);
const groups = R.items.map((item, index) => {
  const [mx, my, mz] = item.move;
  return `<g class="it" data-piece="${item.piece}" data-k="${item.key.toFixed(2)}" data-m="${mx.toFixed(1)},${my.toFixed(1)},${mz.toFixed(1)}" data-i="${index}">${item.svg}</g>`;
});

// the laser beam for each station, drawn in the carriage's home frame
const beams = M.GENS.map((g) => {
  const zTop = topOf(g);
  const spot = [XP, 0, zTop];
  return L(k.segment([XP, 0, HEAD_Z], spot, P), { tone: "lit" }) + L(k.ring(XP, 0, 1.6, zTop, P, 16), { tone: "lit" }) + Dots([at(spot)], { size: 0.8, tone: "hi" });
});

const unit = (vector) => {
  const o = at([0, 0, 0]);
  const p = at(vector);
  return [p[0] - o[0], p[1] - o[1]];
};
const DATA = {
  EX: unit([1, 0, 0]),
  EY: unit([0, 1, 0]),
  EZ: unit([0, 0, 1]),
  V: G.viewOf(P),
  travel: TRAVEL,
  shares: STATION_X.map((x) => (x - XP) / TRAVEL),
  gens: M.GENS.map((g) => ({ id: g.id, name: g.name, year: g.year, say: M.sayOf(g), short: M.shortOf(g), future: !!g.future })),
  beams,
  idle: M.IDLE,
};

const LABEL = `A measuring bench with seven HBM memory stacks cut open side by side, oldest on the left: HBM, HBM2, HBM2E, HBM3, HBM3E, HBM4 and an expected hybrid-bonded HBM4E. Each stack sits on a test coupon and interposer in a pocket of a fixture strip; each shows its base die, its DRAM dies with through-silicon vias as columns of dots, the micro-bumps between dies, and mold on its far sides. A laser height gauge on a carriage runs along a rail behind them and measures each stack in turn.`;
const svg = k.figureSvg({ width: W, height: H, label: LABEL, body: [`<g class="hb-layers">${groups.join("")}</g>`], className: "hb-svg" });

const PARTS = M.GENS.map((g, i) => `<button type="button" class="hb-part" data-part="${g.id}"><span class="hb-num">${String(i + 1).padStart(2, "0")}</span>${g.name}</button>`).join("");
const corners = `<div class="iso-plate-corners" aria-hidden="true"><span class="iso-plate-corner" data-corner="fig">Fig 1</span><span class="iso-plate-corner" data-corner="title">HBM · seven generations</span><span class="iso-plate-corner" data-corner="readout" data-readout>${M.IDLE}</span></div>`;
const controls = `<div class="hb-controls"><span class="hb-hint">Hover a stack · Space plays</span><span class="hb-live" aria-live="polite" data-live></span></div>`;
const stage = `<div class="hb-stage" tabindex="0" role="slider" aria-label="Seven generations of HBM stacks on a bench. Hover a stack, or use the arrow keys, to send the height gauge to it and read its numbers; Space plays through the generations; Escape parks the gauge." aria-valuemin="0" aria-valuemax="${N}" aria-valuenow="0" aria-valuetext="Gauge parked · ${M.IDLE}">${svg}</div>`;
const g = (id) => M.GENS.find((x) => x.id === id);
const caption = `Seven HBM stacks cut open, oldest on the left, with the per-stack peak of each generation: ${M.GENS.filter((x) => !x.future).map((x) => `${x.name} ${M.bw(x)}`).join(", ")}. The interface stayed ${(1024).toLocaleString("en-US")} bits wide for five generations while the pin speed rose from ${M.first.pinGbps} to ${g("hbm3e").pinGbps} Gb/s; HBM4 doubles it to ${(2048).toLocaleString("en-US")} bits. The stacks grew from ${M.first.high} to ${g("hbm4").high} DRAM dies yet stayed within ${M.HEIGHT_12H_UM} µm until HBM4 (${M.HEIGHT_HBM4_UM} µm), because the dies were thinned. Dots in columns are through-silicon vias; dots between dies are micro-bumps in underfill. The last stack is an expected hybrid-bonded HBM4E or HBM5 with no bumps; it has no published numbers. Footprints, die thicknesses, via and bump counts are illustrative, heights are exaggerated against the plan, and the first HBM's height is drawn, not sourced.`;
const scrub = `<span class="hb-scrub"><button type="button" class="hb-play" data-play aria-label="Play through the generations"><span class="hb-play-icon" aria-hidden="true"></span><span data-play-text>Play</span></button><input type="range" class="hb-range" data-scrub min="0" max="${N * 100}" step="1" value="0" aria-label="Generation: 0 is the gauge parked, then one step per generation"><span class="hb-step" data-step>parked</span></span>`;
const body = `<figure class="iso-figure hb"><div class="iso-plate">${corners}${stage}${controls}</div><figcaption class="iso-legend">${scrub}<span class="hb-parts">${PARTS}</span><span class="iso-caption">${caption}</span></figcaption></figure>`;

const CSS = readFileSync(join(HERE, "hbm-evolution.css"), "utf8");
const LIVE = readFileSync(join(HERE, "live.js"), "utf8").replace("__DATA__", JSON.stringify(DATA));
const out = writeChapter({ slug: "hbm-evolution", figure: body, css: CSS, script: LIVE, lesson: LESSON });
console.log("wrote", out.file, `${out.kb} KB`, `${R.items.length} items`, `${R.solids.length} solids`);

// the motor cable leaves the motor face beside the rail's end on screen, 18 units nearer: looked at 4x, a clear crossing
A.auditOrExit(R, P, { crowd: [["stand.cable*", "stand.rail*"]] });
