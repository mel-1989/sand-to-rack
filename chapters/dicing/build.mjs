// A back-grinder and a dicing saw on one bench, drawn in world units of about 2.5 mm (heights of thin layers exaggerated).
// node build.mjs [--audit] [--fast]
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as M from "./model.mjs";
import { k, G, A, Tube, kitScript } from "../../site/kit.mjs";
import { writeChapter } from "../../site/shell.mjs";
import { LESSON } from "./lesson.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const W = 720;
const H = 540;
const AZIMUTH = 60;
const ELEVATION = 36;

// ---- layout (illustrative; the wafer is 300 mm across, everything else drawn to look right beside it) ----
const WAFER_R = 60;
const PLATE = { x: -285, y: -206, w: 610, d: 356, r: 14 };
const PLATE_H = 14;
const FOOT_H = 7;

// grinder
const GX = -176;
const GY = 34;
const WX = GX; // the wheel's rim passes through the chuck centre: in-feed grinding
const WY = GY - WAFER_R;
const TURN_R = 84;
const TURN_TOP = 6;
const CHUCK_R = 68;
const CHUCK_TOP = 15;
const POROUS_R = 62;
const BG_TAPE = [15, 15.5];
const THIN_TOP = 15.9; // 50 µm, drawn 0.4
const STOCK = 6.0 * (M.WAFER.um - M.TARGET_UM) / M.WAFER.um; // 775 µm drawn 6 units; this much comes off
const THICK_TOP = THIN_TOP + STOCK;
const LIFT = 14;
const WHEEL = { r: WAFER_R, seg: 3.4, hub: 9, hubR: 55, flangeR: 30, flangeH: 4, shaftR: 11, shaft: 16 };
const HEAD_TRAVEL = LIFT + STOCK;
const WB0 = THICK_TOP + LIFT; // wheel bottom with the head lifted (share 0)
const BRK_Z = WB0 + WHEEL.seg + WHEEL.hub + WHEEL.flangeH + WHEEL.shaft; // bracket underside at rest
const BRK_H = 10;
const MOTOR = { r: 28, h: 46 };
const GCOL = { x: GX - 40, y: -194, w: 80, d: 30, r: 3 };
const GCOL_TOP = 200;
const GRAIL_Y = [-164, -160];
const GCAR = { x: GX - 32, y: -160, w: 64, d: 10, r: 1.5 };
const BRK = { x: GX - 34, y: -150, w: 68, d: (WY + MOTOR.r + 3) + 150, r: 3 };
const GAUGE = { post: [GX + 92, GY + 40], armZ: [38, 43], chuckProbe: [GX + 50, GY + 40], waferProbe: [GX + 38, GY + 40], r: 1.3 };

// dicing saw
const SX = 150;
const SY = 22;
const T_OFF = 0; // the table is drawn centred under the blade; it moves ±X by T_TRAVEL (shares -1..1)
const T_TRAVEL = 63;
const TCX = SX + T_OFF;
const TABLE = { x: TCX - 100, y: SY - 100, w: 200, d: 200, r: 6 };
const TABLE_Z = [5, 13];
const THETA_R = 95;
const THETA_TOP = 19;
const SCHUCK_R = 66;
const SCHUCK_TOP = 21.6;
const DTAPE_R = 86;
const DTAPE_TOP = 22;
const FRAME = { rIn: 74, rOut: 86, top: 22.5 };
const SW_TOP = 22.4; // thinned wafer on the dicing tape
const CLAMP = { r0: 87, r1: 93, top: 24.3, half: 5 };
const RAIL_Y = [SY - 72, SY + 68];
const RAIL = { x0: SX - 166, x1: SX + 166, top: 5, d: 4 };
const BLADE = { r: 22, t: 1.2, hubR: 12, flangeR: 9, cut: 0.5 };
const AXIS_Z = SW_TOP - BLADE.cut + BLADE.r;
const HOUSING_R = 13;
const Y0 = SY - 70; // blade y at share 0 (parked off the back of the wafer)
const Y_TRAVEL = 130;
const ZLIFT = 6;
const REST_Y = 1; // Y share of the spindle's rest at the front end of the beam
// a die-handling rail along the bench front: carries the UV lamp and the pick head (illustrative)
const PRAIL = { x0: TCX - 112, x1: TCX + 112, y: 127, d: 4, top: 4 };
const SCOL = { x: SX - 24, y: -196, w: 48, d: 30, r: 3 };
const BEAM = { x: SX - 15, y: -196, w: 30, d: 66 + 196, r: 2 };
const BEAM_Z = [100, 116];
const YCAR = (by) => ({ x: SX - 20, y: by - 62, w: 40, d: 46, r: 2 });
const ZGUIDE = (by) => ({ x: SX - 14, y: by - 62, w: 28, d: 6, r: 1 });
const ZBLOCK = (by) => ({ x: SX - 18, y: by - 56, w: 36, d: 34, r: 2.5 });
const ZB_Z = [AXIS_Z + HOUSING_R, 89];
const COVER = (by) => ({ x: SX - 26, y: by - 4, w: 52, d: 8, r: 2 });
const COVER_Z = [AXIS_Z + 5, AXIS_Z + BLADE.r + 3];

const MOVES = {
  stand: [0, 0, 0],
  head: [0, 0, -HEAD_TRAVEL],
  stock: [0, 0, -STOCK],
  table: [T_TRAVEL, 0, 0],
  ycar: [0, Y_TRAVEL, 0],
  spindle: [0, Y_TRAVEL, 0],
};

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), ...k.boxCorners(GCOL, 0, GCOL_TOP + 14), ...k.boxCorners(BEAM, BEAM_Z[0], BEAM_Z[1] + 14)],
  W,
  H,
  { pad: 24, azimuth: AZIMUTH, elevation: ELEVATION },
);
const V = G.viewOf(P);
const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const up = (o) => G.frameOf(o, [0, 0, 1], [1, 0, 0], [0, 1, 0]);
const alongY = (o) => G.frameOf(o, [0, 1, 0], [1, 0, 0], [0, 0, 1]);
const alongX = (o) => G.frameOf(o, [1, 0, 0], [0, 1, 0], [0, 0, 1]);
const centreOf = (plan, z) => [plan.x + plan.w / 2, plan.y + plan.d / 2, z];
const shift = (plan, dx, dy) => ({ ...plan, x: plan.x + dx, y: plan.y + dy });
const circlePts = (cx, cy, r, z, n, phase = 0) => Array.from({ length: n }, (_, i) => [cx + r * Math.cos(phase + (i * 2 * Math.PI) / n), cy + r * Math.sin(phase + (i * 2 * Math.PI) / n), z]);

const R = A.recorder(P, { order: ["head", "stock", "table", "ycar", "spindle"], spring: {} });
function put(piece, part, ref, svg, shapes, { bias = 0, name, extra = {} } = {}) {
  // fixed frames (columns, beam, rails) belong to the bench, not to the part they carry
  if (piece === "stand" && ["wheel", "blade", "table"].includes(part)) part = "stand";
  const id = name ?? R.nameFor(`${part}.item`);
  shapes.forEach((shape) => (shape.name = shape.name ?? id));
  return R.put({ piece, part, at: ref, bias, svg, move: MOVES[piece], shapes: shapes.map(R.solid), name: id, ...extra });
}
function puck(x, y, r, z, h, style = {}, { steps, bevel = 0, inner = "", meta = {} } = {}) {
  return { svg: S(k.cylinder(x, y, r, z, h, P, steps ?? Math.max(20, Math.round(r * 2.2)), bevel), { tone: "mid", ...style, inner }), shape: A.cylinder(x, y, r, z, h, { ...meta }) };
}
function box(plan, z, h, style = {}, { steps = 3, bevel = 0, inner = "", meta = {} } = {}) {
  return { svg: S(k.slabOf(plan, z, h, P, steps, bevel), { tone: "mid", ...style, inner }), shape: A.slab(plan, z, h, { ...meta }, steps) };
}
function tube(piece, part, name, route, r, { tone = "mid", maxLength = 20, ends } = {}) {
  const id = R.nameFor(name);
  R.route(id, route, r, { piece, move: MOVES[piece], ends });
  Tube.tubePieces(route, r, P, { maxLength }).forEach((chunk, index) => put(piece, part, chunk.mid, Tube.tubeSvg(chunk, { tone }), [A.tube(chunk.points, chunk.radii, { owner: id })], { name: `${id}:${index}`, extra: { route: id, chunk: index } }));
}
const seam = (plan, z, steps = 3) => L(k.sideSeam(plan, z, P, steps), { tone: "faint" });
const screwDots = (pts, z, size = 0.45) => Dots(pts.map(([x, y]) => at([x, y, z])), { size });

// ---- base: deck on feet, groove, screws, drain grate, ruler and label plate ----
function base() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  const shapes = [];
  for (const [x, y] of byDepth(k.corners(PLATE, 30))) {
    out.push(S(k.cylinder(x, y, 10, -PLATE_H - FOOT_H, 2, P, 32), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 7.6, -PLATE_H - FOOT_H + 2, FOOT_H - 2, P, 28), { tone: "mid" }));
    shapes.push(A.cylinder(x, y, 10, -PLATE_H - FOOT_H, FOOT_H, {}));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid", inner: L(k.sideSeam(PLATE, -PLATE_H + 4, P, 8), { tone: "faint" }) }));
  shapes.push(A.slab(PLATE, -PLATE_H, PLATE_H, {}));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 7), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 14);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.6, 0, P, 16)).join(""), { tone: "lo" }), screwDots(screws, 0, 0.5));
  // seam where the two machines' decks meet
  
  // drain grate under the saw table: closed slots
  const grate = { x: SX - 150, y: SY - 52, w: 300, d: 100, r: 3 };
  const slots = [];
  for (let i = 0; i < 18; i++) slots.push(k.planOutline({ x: grate.x + 6 + i * 16.2, y: grate.y + 8, w: 7, d: grate.d - 16, r: 3.4 }, 0, P, 3));
  out.push(L(k.planOutline(grate, 0, P, 3), { tone: "lo" }), L(slots.join(""), { tone: "faint" }));
  // ruler strip along the front edge: 10 mm minor (4 units), 50 mm major
  const strip = { x: -262, y: PLATE.y + PLATE.d - 22, w: 128, d: 9, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 4, 5, strip.y + 0.8, 0.6, [2.4, 4.4], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(Dots([at([strip.x + 2, strip.y + 4.5, 0.6]), at([strip.x + strip.w - 2, strip.y + 4.5, 0.6])], { size: 0.45 }));
  // label plate
  const label = { x: -122, y: PLATE.y + PLATE.d - 30, w: 84, d: 19, r: 1.5 };
  out.push(S(k.slabOf(label, 0, 0.8, P, 4), { tone: "lo", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.8), 0.8, P, 4), { tone: "faint" }));
  out.push(L([0, 1, 2].map((i) => k.lineOnTop([label.x + 9, label.y + 5.6 + i * 3.6], [label.x + 66 - i * 16, label.y + 5.6 + i * 3.6], 0.8, P)).join(""), { tone: "lo", free: true }));
  out.push(Dots([at([label.x + 4.5, label.y + label.d / 2, 0.8]), at([label.x + label.w - 4.5, label.y + label.d / 2, 0.8])], { size: 0.45 }));
  put("stand", "stand", [0, 0, -1], out.join(""), shapes, { name: "stand.base", bias: -2000 });
}

// ---- grinder: index table, chuck, tape, wafer, column, Z slide, spindle and cup wheel, thickness gauge ----
function grinderTable() {
  const t = puck(GX, GY, TURN_R, 0, TURN_TOP, {}, { steps: 96, bevel: 0.8, inner: L(k.sideArc(GX, GY, TURN_R, 2.4, P, 72), { tone: "faint" }) });
  const bolts = Dots(G.dotsOf(up([GX, GY, 0]), TURN_TOP, TURN_R - 7, 24, P, { all: true }), { size: 0.45 });
  const ticks = k.radialTicks(GX, GY, TURN_R, 72, 6, TURN_TOP, [1.4, 3], P);
  put("stand", "chuck", [GX, GY, 3], t.svg + bolts + L(ticks.minor, { tone: "lo" }) + L(ticks.major, { tone: "mid" }), [t.shape], { name: "chuck.index" });
  const c = puck(GX, GY, CHUCK_R, TURN_TOP, CHUCK_TOP - TURN_TOP, {}, { steps: 96, bevel: 0.6, inner: L(k.sideArc(GX, GY, CHUCK_R, 10, P, 72), { tone: "faint" }) });
  const porous = L(k.ring(GX, GY, POROUS_R, CHUCK_TOP, P, 96), { tone: "lo" });
  const pores = [];
  for (let x = -54; x <= 54; x += 6) for (let y = -54; y <= 54; y += 6) if (x * x + y * y < 56 * 56) pores.push(at([GX + x, GY + y, CHUCK_TOP]));
  put("stand", "chuck", [GX, GY, 10], c.svg + porous + Dots(pores, { size: 0.3, tone: "lo" }) + `<g data-gspin="chuck"></g>`, [c.shape], { name: "chuck.table" });
  // back-grind tape (front side protection) and the thinned wafer face down on it
  const tape = puck(GX, GY, WAFER_R + 1.2, BG_TAPE[0], BG_TAPE[1] - BG_TAPE[0], { tone: "lo", crease: "none" }, { steps: 96 });
  const thin = puck(GX, GY, WAFER_R, BG_TAPE[1], THIN_TOP - BG_TAPE[1], { tone: "hi", crease: "lo" }, { steps: 96 });
  put("stand", "chuck", [GX, GY, 15.4], `<g data-gwafer><g data-bgtape>${tape.svg}</g>${thin.svg}</g>`, [tape.shape, thin.shape], { name: "chuck.wafer" });
  // the stock still to be ground: slides down into the thin wafer as the wheel feeds
  const F = up([GX, GY, 0]);
  const rod = G.rodOut(F, THIN_TOP, THICK_TOP, WAFER_R, P, { stroke: STOCK });
  const svg = `<g data-gwafer><clipPath id="dc-stock"><path data-hold d="${rod.clip}"/></clipPath><g clip-path="url(#dc-stock)">${S(rod.paths, { tone: "hi", crease: "lo", lit: true })}<g data-stocktop></g></g></g>`;
  put("stock", "chuck", [GX, GY, THIN_TOP + 1], svg, [A.slide(F, THIN_TOP, THICK_TOP, WAFER_R, {})], { name: "chuck.stock" });
}

function grinderColumn() {
  const foot = k.insetPlan(GCOL, -5);
  const f = box(foot, 0, 4, {}, { steps: 4, bevel: 0.5 });
  const c = box(GCOL, 4, GCOL_TOP - 4, {}, { steps: 4, inner: L([40, 120, 180].map((z) => k.sideSeam(GCOL, z, P, 4)).join(""), { tone: "faint" }) });
  const bolts = screwDots(k.corners(foot, 3), 4, 0.5);
  // service panel on the column side
  const panelX = GCOL.x + GCOL.w;
  put("stand", "wheel", [GX, GCOL.y + 15, 100], f.svg + bolts + c.svg, [f.shape, c.shape], { name: "stand.gcolumn" });
  // two linear rails on the column front, with end stops
  GRAIL_Y.length;
  for (const x of [GX - 28, GX + 20]) {
    const rail = box({ x, y: GRAIL_Y[0], w: 8, d: GRAIL_Y[1] - GRAIL_Y[0], r: 0.6 }, 30, 160, { tone: "mid" }, { steps: 2 });
    put("stand", "wheel", [x + 4, -162, 110], rail.svg, [rail.shape], { name: R.nameFor("stand.grail") });
  }
  // Z servo on top of the column, with a coupling housing
  const cap = box(k.insetPlan(GCOL, 6), GCOL_TOP, 6, {}, { steps: 3, bevel: 0.4 });
  const m = puck(GX, GCOL.y + 15, 11, GCOL_TOP + 6, 22, {}, { steps: 32, inner: L([4, 10, 16].map((dz) => k.sideArc(GX, GCOL.y + 15, 11, GCOL_TOP + 6 + dz, P, 24)).join(""), { tone: "faint" }) });
  const mc = puck(GX, GCOL.y + 15, 8, GCOL_TOP + 28, 3, {}, { steps: 24, bevel: 0.3 });
  put("stand", "wheel", [GX, GCOL.y + 15, GCOL_TOP + 10], cap.svg + screwDots(k.corners(k.insetPlan(GCOL, 6), 3), GCOL_TOP + 6) + m.svg + mc.svg, [cap.shape, m.shape, mc.shape], { name: "stand.gservo" });
  // signal tower on the column's right shoulder
  const [lx, ly] = [GCOL.x + 66, GCOL.y + 12];
  let z = GCOL_TOP + 6;
  const lamp = [];
  const shapes = [];
  const seg = (r, h, tone, extra = {}) => {
    const p = puck(lx, ly, r, z, h, { tone, ...extra }, { steps: 20 });
    lamp.push(p.svg);
    shapes.push(p.shape);
    z += h;
  };
  seg(4.6, 1.6, "mid");
  seg(1.6, 6, "mid", { crease: "none" });
  seg(3.6, 4, "lo");
  seg(3.6, 4, "mid");
  seg(3.6, 4, "hi", { crease: "lo" });
  seg(3.9, 1.4, "mid");
  put("stand", "wheel", [lx, ly, GCOL_TOP + 10], `<g data-lamp>${lamp.join("")}</g>`, shapes, { name: "stand.glamp" });
  void panelX;
}

function grinderHead() {
  // Z slide carriage on the rails, the cantilever bracket, the spindle motor
  const car = box(GCAR, BRK_Z - 10, 54, {}, { steps: 2, bevel: 0.4, inner: seam(GCAR, BRK_Z + 20, 2) });
  put("head", "wheel", [GX, GCAR.y + 5, BRK_Z + 17], car.svg + screwDots([[GX - 26, GCAR.y + 5], [GX + 26, GCAR.y + 5]], BRK_Z + 44), [car.shape], { name: "head.carriage" });
  const brk = box(BRK, BRK_Z, BRK_H, {}, { steps: 3, bevel: 0.6, inner: seam(BRK, BRK_Z + 4, 3) });
  const brkScrews = screwDots([[BRK.x + 5, BRK.y + 6], [BRK.x + BRK.w - 5, BRK.y + 6], [BRK.x + 5, BRK.y + 40], [BRK.x + BRK.w - 5, BRK.y + 40]], BRK_Z + BRK_H);
  put("head", "wheel", [GX, -80, BRK_Z + 5], brk.svg + brkScrews, [brk.shape], { name: "head.bracket" });
  const z0 = BRK_Z + BRK_H;
  const m = puck(WX, WY, MOTOR.r, z0 + 3, MOTOR.h - 3, {}, { steps: 72, inner: L([8, 18, 28, 38].map((dz) => k.sideArc(WX, WY, MOTOR.r, z0 + dz, P, 56)).join(""), { tone: "faint" }) });
  const flange = puck(WX, WY, MOTOR.r + 3, z0, 3, {}, { steps: 72, bevel: 0.4 });
  const cap = puck(WX, WY, MOTOR.r - 6, z0 + MOTOR.h, 4, {}, { steps: 56, bevel: 0.4 });
  const capBolts = Dots(G.dotsOf(up([WX, WY, 0]), z0 + MOTOR.h, MOTOR.r - 3, 12, P, { all: true }), { size: 0.45 });
  const plug = box({ x: WX + MOTOR.r - 6, y: WY - 6, w: 12, d: 12, r: 1.4 }, z0 + MOTOR.h, 6, {}, { steps: 2 });
  put("head", "wheel", [WX, WY, z0 + 20], flange.svg + m.svg + capBolts + cap.svg + plug.svg, [flange.shape, m.shape, cap.shape, plug.shape], { name: "head.motor" });
  // shaft, wheel mount flange and the cup wheel (hub plus a rim of diamond segments)
  const F = up([WX, WY, 0]);
  const wb = WB0;
  const shaft = S(G.disc(wb + WHEEL.seg + WHEEL.hub + WHEEL.flangeH, BRK_Z, WHEEL.shaftR, F, P), { tone: "mid", crease: "none" });
  const fl = S(G.disc(wb + WHEEL.seg + WHEEL.hub, wb + WHEEL.seg + WHEEL.hub + WHEEL.flangeH, WHEEL.flangeR, F, P, { bevel: 0.4 }), { tone: "mid" });
  const flBolts = Dots(G.dotsOf(F, wb + WHEEL.seg + WHEEL.hub + WHEEL.flangeH, WHEEL.flangeR - 4, 8, P, { all: true }), { size: 0.45 });
  const hub = S(G.disc(wb + WHEEL.seg, wb + WHEEL.seg + WHEEL.hub, WHEEL.r - 1, F, P, { bevel: 0.6 }), { tone: "mid", inner: L(G.arcOf(F, wb + WHEEL.seg + 4, WHEEL.r - 1, P), { tone: "faint" }) });
  const hubRing = L(k.ring(WX, WY, WHEEL.hubR - 14, wb + WHEEL.seg + WHEEL.hub, P, 64), { tone: "lo" });
  const hubBolts = Dots(G.dotsOf(F, wb + WHEEL.seg + WHEEL.hub, WHEEL.r - 8, 16, P, { all: true }), { size: 0.45 });
  const segs = S(G.disc(wb, wb + WHEEL.seg, WHEEL.r, F, P), { tone: "hi", crease: "lo" });
  put("head", "wheel", [WX, WY, wb + 8], segs + `<g data-wspin></g>` + hub + hubRing + hubBolts, [A.disc(F, wb, wb + WHEEL.seg, WHEEL.r, {}), A.disc(F, wb + WHEEL.seg, wb + WHEEL.seg + WHEEL.hub, WHEEL.r - 1, {})], { name: "head.wheel" });
  put("head", "wheel", [WX, WY, wb + WHEEL.seg + WHEEL.hub + 8], fl + flBolts + shaft, [A.disc(F, wb + WHEEL.seg + WHEEL.hub, wb + WHEEL.seg + WHEEL.hub + WHEEL.flangeH, WHEEL.flangeR, {}), A.disc(F, wb + WHEEL.seg + WHEEL.hub + WHEEL.flangeH, BRK_Z, WHEEL.shaftR, {})], { name: "head.shaft" });
}

function gauge() {
  const [px, py] = GAUGE.post;
  const f = puck(px, py, 9, 0, 3, {}, { steps: 28, bevel: 0.4 });
  const p = puck(px, py, 4.4, 3, GAUGE.armZ[0] - 3, {}, { steps: 20, inner: L(k.sideArc(px, py, 4.4, 18, P, 16), { tone: "faint" }) });
  const bolts = Dots([0, 1, 2, 3].map((i) => at([px + 6.6 * Math.cos(i * Math.PI / 2 + 0.78), py + 6.6 * Math.sin(i * Math.PI / 2 + 0.78), 3])), { size: 0.45 });
  put("stand", "gauge", [px, py, 18], f.svg + bolts + p.svg, [f.shape, p.shape], { name: "gauge.post" });
  const arm = { x: GAUGE.waferProbe[0] - 5, y: py - 4, w: px + 5 - (GAUGE.waferProbe[0] - 5), d: 8, r: 2 };
  const a = box(arm, GAUGE.armZ[0], GAUGE.armZ[1] - GAUGE.armZ[0], {}, { steps: 3, bevel: 0.4, inner: seam(arm, GAUGE.armZ[0] + 2, 3) });
  const head = box({ x: px - 7, y: py - 6, w: 14, d: 12, r: 2 }, GAUGE.armZ[1], 7, {}, { steps: 2, bevel: 0.4 });
  const knob = puck(px, py, 3.2, GAUGE.armZ[1] + 7, 3, { tone: "mid" }, { steps: 18 });
  put("stand", "gauge", [arm.x + arm.w / 2, py, GAUGE.armZ[0]], a.svg + head.svg + L(k.knurl(px, py, 3.2, GAUGE.armZ[1] + 7.3, GAUGE.armZ[1] + 9.7, 14, P), { tone: "lo" }) + knob.svg + screwDots([[px - 4, py], [px + 4, py]], GAUGE.armZ[1] + 7), [a.shape, head.shape, knob.shape], { name: "gauge.arm" });
  // fixed probe on the chuck ring
  const [cx, cy] = GAUGE.chuckProbe;
  const cp = puck(cx, cy, GAUGE.r, CHUCK_TOP, GAUGE.armZ[0] - 4 - CHUCK_TOP, { tone: "hi", crease: "lo" }, { steps: 12 });
  const gl = puck(cx, cy, 2.6, GAUGE.armZ[0] - 4, 4, {}, { steps: 16 });
  put("stand", "gauge", [cx, cy, 26], cp.svg + gl.svg, [cp.shape, gl.shape], { name: "gauge.chuckprobe" });
  // the probe on the wafer slides down with the wafer's top
  const [wx, wy] = GAUGE.waferProbe;
  const gl2 = puck(wx, wy, 2.6, GAUGE.armZ[0] - 4, 4, {}, { steps: 16 });
  put("stand", "gauge", [wx, wy, GAUGE.armZ[0] - 2], gl2.svg, [gl2.shape], { name: "gauge.gland" });
  const F = up([wx, wy, 0]);
  const rod = G.rodOut(F, GAUGE.armZ[0] - 4, THICK_TOP, GAUGE.r, P, { stroke: STOCK });
  // the rod points down: build it in a frame whose axis points down so the gland is at the top
  const Fd = G.frameOf([wx, wy, 0], [0, 0, -1], [1, 0, 0], [0, -1, 0]);
  const rodD = G.rodOut(Fd, -(GAUGE.armZ[0] - 4), -THICK_TOP, GAUGE.r, P, { stroke: STOCK });
  void rod;
  const svg = `<clipPath id="dc-probe"><path data-hold d="${rodD.clip}"/></clipPath><g clip-path="url(#dc-probe)">${S(rodD.paths, { tone: "hi", crease: "lo" })}</g>`;
  put("stock", "gauge", [wx, wy, 26], svg, [A.slide(Fd, -(GAUGE.armZ[0] - 4), -THICK_TOP, GAUGE.r, {})], { name: "gauge.probe" });
}

// ---- dicing saw: X rails, table, θ chuck, tape frame, clamps, wafer ----
function sawBase() {
  for (const y of RAIL_Y) {
    const rail = box({ x: RAIL.x0, y, w: RAIL.x1 - RAIL.x0, d: RAIL.d, r: 0.8 }, 0, RAIL.top, {}, { steps: 2, bevel: 0.3 });
    const bolts = [];
    for (let x = RAIL.x0 + 8; x < RAIL.x1; x += 20) bolts.push([x, y + RAIL.d / 2]);
    put("stand", "table", [SX, y + 2, 2], rail.svg + screwDots(bolts, RAIL.top, 0.4), [rail.shape], { name: R.nameFor("stand.xrail") });
    for (const x of [RAIL.x0 - 6, RAIL.x1]) {
      const stop = box({ x, y: y - 3, w: 6, d: RAIL.d + 6, r: 1 }, 0, 9, {}, { steps: 2, bevel: 0.3 });
      put("stand", "table", [x + 3, y + 2, 4], stop.svg, [stop.shape], { name: R.nameFor("stand.xstop") });
    }
  }
  // the handling rail in front of the table, with an end block at each end
  {
    const pr = box({ x: PRAIL.x0, y: PRAIL.y, w: PRAIL.x1 - PRAIL.x0, d: PRAIL.d, r: 0.8 }, 0, PRAIL.top, {}, { steps: 2, bevel: 0.3 });
    const bolts = [];
    for (let x = PRAIL.x0 + 10; x < PRAIL.x1; x += 22) bolts.push([x, PRAIL.y + PRAIL.d / 2]);
    put("stand", "stand", [TCX, PRAIL.y + 2, 2], pr.svg + screwDots(bolts, PRAIL.top, 0.4), [pr.shape], { name: "stand.prail" });
    for (const x of [PRAIL.x0 - 7, PRAIL.x1]) {
      const e = box({ x, y: PRAIL.y - 3, w: 7, d: PRAIL.d + 6, r: 1 }, 0, 8, {}, { steps: 2, bevel: 0.3 });
      put("stand", "stand", [x + 3.5, PRAIL.y + 2, 4], e.svg + screwDots([[x + 3.5, PRAIL.y + 2]], 8), [e.shape], { name: R.nameFor("stand.pstop") });
    }
  }
  // X drive: motor block at the rail's left end
  const mb = { x: RAIL.x0 - 30, y: SY - 12, w: 22, d: 24, r: 2 };
  const m = box(mb, 0, 16, {}, { steps: 3, bevel: 0.5, inner: seam(mb, 6, 3) });
  const Fm = alongX([mb.x + mb.w, SY, 9]);
  const cap = S(G.disc(0, 3, 6.5, Fm, P, { bevel: 0.3 }), { tone: "mid" });
  put("stand", "table", [mb.x + 11, SY, 8], m.svg + screwDots(k.corners(mb, 3), 16) + cap, [m.shape, A.disc(Fm, 0, 3, 6.5, {})], { name: "stand.xmotor" });
  // ball screw from the motor to a support block at the far end, under the table
  const Fs = alongX([0, SY, 2.4]);
  const bb = { x: RAIL.x1 + 2, y: SY - 7, w: 10, d: 14, r: 1.4 };
  const blk = box(bb, 0, 4.8, {}, { steps: 2, bevel: 0.3 });
  const screwRod = S(G.disc(mb.x + mb.w + 3, bb.x, 2, Fs, P), { tone: "mid", crease: "none", inner: L([0.2, 0.4, 0.6, 0.8].map((f) => G.arcOf(Fs, mb.x + mb.w + 3 + (bb.x - mb.x - mb.w - 3) * f, 2, P)).join(""), { tone: "faint" }) });
  put("stand", "table", [SX, SY, 2.4], screwRod, [A.disc(Fs, mb.x + mb.w + 3, bb.x, 2, {})], { name: "stand.xscrew", bias: -1 });
  put("stand", "table", [bb.x + 5, SY, 2.4], blk.svg + screwDots([[bb.x + 5, bb.y + 3], [bb.x + 5, bb.y + bb.d - 3]], 4.8), [blk.shape], { name: "stand.xbearing" });
}

function sawTable() {
  const t = box(TABLE, TABLE_Z[0], TABLE_Z[1] - TABLE_Z[0], {}, { steps: 6, bevel: 0.8, inner: seam(TABLE, TABLE_Z[0] + 3, 6) });
  const groove = L(k.planOutline(k.insetPlan(TABLE, 5), TABLE_Z[1], P, 6), { tone: "lo" });
  put("table", "table", [TCX, SY, 8], t.svg + groove + screwDots(k.corners(TABLE, 9), TABLE_Z[1], 0.5), [t.shape], { name: "table.x" });
  const th = puck(TCX, SY, THETA_R, TABLE_Z[1], THETA_TOP - TABLE_Z[1], {}, { steps: 120, bevel: 0.6, inner: L(k.sideArc(TCX, SY, THETA_R, 15.5, P, 96), { tone: "faint" }) });
  put("table", "table", [TCX, SY, 15], th.svg + `<g data-theta></g>`, [th.shape], { name: "table.theta" });
  const ch = puck(TCX, SY, SCHUCK_R, THETA_TOP, SCHUCK_TOP - THETA_TOP, {}, { steps: 96, bevel: 0.4 });
  const pores = [];
  for (let x = -60; x <= 60; x += 6) for (let y = -60; y <= 60; y += 6) if (x * x + y * y < 62 * 62) pores.push(at([TCX + x, SY + y, SCHUCK_TOP]));
  put("table", "table", [TCX, SY, 20], ch.svg + L(k.ring(TCX, SY, SCHUCK_R - 3, SCHUCK_TOP, P, 96), { tone: "lo" }) + Dots(pores, { size: 0.3, tone: "lo" }), [ch.shape], { name: "table.chuck" });
  // dicing tape across the frame, the steel ring frame, the thinned wafer on it
  const tp = puck(TCX, SY, DTAPE_R, SCHUCK_TOP, DTAPE_TOP - SCHUCK_TOP, { tone: "lo", crease: "none" }, { steps: 120 });
  put("table", "table", [TCX, SY, 21.8], `<g data-sawframe><g data-dtape>${tp.svg}</g><g data-uv></g></g>`, [tp.shape], { name: "table.tape" });
  const F = up([TCX, SY, 0]);
  const fr = S(G.ringBand(DTAPE_TOP, FRAME.top, FRAME.rIn, FRAME.rOut, F, P, { hole: [FRAME.top, FRAME.rIn] }), { tone: "mid" });
  put("table", "table", [TCX, SY, 22.2], `<g data-sawframe class="dc-frame">${fr}</g>`, [A.ring(F, DTAPE_TOP, FRAME.top, FRAME.rIn, FRAME.rOut, {})], { name: "table.frame" });
  const w = puck(TCX, SY, WAFER_R, DTAPE_TOP, SW_TOP - DTAPE_TOP, { tone: "hi", crease: "lo" }, { steps: 120 });
  put("table", "table", [TCX, SY, 22.2], `<g data-sawwafer>${w.svg}<g data-grid></g></g>`, [w.shape], { name: "table.wafer" });
  // four frame clamps on the θ table, each rebuilt live as it turns and recorded over its quarter turn
  for (let i = 0; i < 4; i++) {
    const shapes = [];
    for (let deg = -3; deg <= 90; deg += 7.75) {
      const g = clampGeo(deg, CLAMP, [TCX, SY])[i];
      shapes.push(A.extruded(g.post, THETA_TOP, CLAMP.top - THETA_TOP, { owner: "table.clamps" }));
    }
    const a = ((45 + 90 * i + 45) * Math.PI) / 180;
    put("table", "table", [TCX + 90 * Math.cos(a), SY + 90 * Math.sin(a), 21], `<g data-clamp="${i}">${clampSvg(0, k, P, CLAMP, [TCX, SY], THETA_TOP, i)}</g>`, shapes, { name: `table.clamp${i}` });
  }
}
// shared with the page: the clamps' floor outlines at a θ angle
function clampGeo(deg, C, c) {
  const out = [];
  for (let i = 0; i < 4; i++) {
    const a = ((deg + 45 + i * 90) * Math.PI) / 180;
    const u = [Math.cos(a), Math.sin(a)];
    const v = [-u[1], u[0]];
    const rect = (r0, r1, h) => [[r0, -h], [r1, -h], [r1, h], [r0, h]].map(([s, t]) => [c[0] + s * u[0] + t * v[0], c[1] + s * u[1] + t * v[1]]);
    out.push({ a, post: rect(C.r0, C.r1, C.half), pad: rect(C.r0 + 0.8, C.r0 + 2.4, C.half * 0.6) });
  }
  return out;
}
function clampSvg(deg, k, P, C, c, base, only) {
  const p = clampGeo(deg, C, c)[only];
  let svg = k.solidSvg(k.extrude(p.post, base, C.top - base, P, { bevel: 0.3 }), { tone: "mid" });
  const m = [c[0] + (C.r0 + C.r1 * 1.0) / 2 * Math.cos(p.a), c[1] + (C.r0 + C.r1) / 2 * Math.sin(p.a), C.top];
  svg += k.dotsSvg([k.iso(m, P)], { size: 0.5 });
  return svg;
}

// ---- saw column, cantilever beam, Y carriage, Z block, spindle, blade, cover, nozzles, camera ----
function sawFrame() {
  const foot = k.insetPlan(SCOL, -5);
  const f = box(foot, 0, 4, {}, { steps: 4, bevel: 0.5 });
  const c = box(SCOL, 4, BEAM_Z[0] - 4, {}, { steps: 4, inner: L([30, 70].map((z) => k.sideSeam(SCOL, z, P, 4)).join(""), { tone: "faint" }) });
  put("stand", "blade", [SX, SCOL.y + 15, 50], f.svg + screwDots(k.corners(foot, 3), 4, 0.5) + c.svg, [f.shape, c.shape], { name: "stand.scolumn" });
  const b = box(BEAM, BEAM_Z[0], BEAM_Z[1] - BEAM_Z[0], {}, { steps: 3, bevel: 0.8, inner: seam(BEAM, BEAM_Z[0] + 5, 3) });
  const groove = L(k.planOutline(k.insetPlan(BEAM, 4), BEAM_Z[1], P, 3), { tone: "faint" });
  const caps = screwDots(k.corners({ x: SCOL.x, y: SCOL.y, w: SCOL.w, d: SCOL.d, r: 2 }, 5).filter(([x]) => x > BEAM.x && x < BEAM.x + BEAM.w), BEAM_Z[1], 0.5);
  put("stand", "blade", [SX, -60, BEAM_Z[0]], b.svg + groove + Dots([at([SX, BEAM.y + 8, BEAM_Z[1]]), at([SX, BEAM.y + 22, BEAM_Z[1]])], { size: 0.5 }) + caps, [b.shape], { name: "stand.beam" });
  // Y servo at the back end of the beam
  const Fy = alongY([SX, BEAM.y, (BEAM_Z[0] + BEAM_Z[1]) / 2]);
  const motor = S(G.disc(-2, 0, 9, Fy, P), { tone: "mid" }) + S(G.disc(-20, -2, 7.6, Fy, P), { tone: "mid", inner: L([-6, -11, -16].map((s) => G.arcOf(Fy, s, 7.6, P)).join(""), { tone: "faint" }) }) + S(G.disc(-22, -20, 5.4, Fy, P), { tone: "mid" });
  put("stand", "blade", [SX, BEAM.y - 11, 108], motor, [A.disc(Fy, -2, 0, 9, {}), A.disc(Fy, -20, -2, 7.6, {}), A.disc(Fy, -22, -20, 5.4, {})], { name: "stand.yservo" });
  // signal tower on the beam over the column
  {
    const [lx, ly] = [SX, SCOL.y + 6];
    let z = BEAM_Z[1];
    const lamp = [];
    const shapes = [];
    for (const [r, h, tone, extra] of [[4.6, 1.6, "mid", {}], [1.6, 6, "mid", { crease: "none" }], [3.6, 4, "lo", {}], [3.6, 4, "mid", {}], [3.6, 4, "hi", { crease: "lo" }], [3.9, 1.4, "mid", {}]]) {
      const p = puck(lx, ly, r, z, h, { tone, ...extra }, { steps: 20 });
      lamp.push(p.svg);
      shapes.push(p.shape);
      z += h;
    }
    put("stand", "blade", [lx, ly, BEAM_Z[1] + 10], lamp.join(""), shapes, { name: "stand.slamp" });
  }
  // a gusset under the beam where it leaves the column
  const gus = { x: SX - 8, y: SCOL.y + SCOL.d, w: 16, d: 18, r: 1 };
  const g = box(gus, BEAM_Z[0] - 14, 14, {}, { steps: 2, bevel: 0.3 });
  put("stand", "blade", [SX, gus.y + 9, BEAM_Z[0] - 7], g.svg, [g.shape], { name: "stand.gusset" });
}

function spindle() {
  const by = Y0;
  const yc = YCAR(by);
  const c = box(yc, 96, BEAM_Z[0] - 96, {}, { steps: 2, bevel: 0.4 });
  const zg = ZGUIDE(by);
  const g = box(zg, ZB_Z[1] - 18, 96 - (ZB_Z[1] - 18), {}, { steps: 2, bevel: 0.3, inner: seam(zg, 84, 2) });
  put("ycar", "blade", [SX, by - 40, 98], c.svg, [c.shape], { name: "ycar.body" });
  put("ycar", "blade", [SX, by - 59, 84], g.svg, [g.shape], { name: "ycar.zguide" });
  // Z block with the spindle hanging under it
  const zb = ZBLOCK(by);
  const b = box(zb, ZB_Z[0], ZB_Z[1] - ZB_Z[0], {}, { steps: 3, bevel: 0.6, inner: L([ZB_Z[0] + 6, ZB_Z[1] - 8].map((z) => k.sideSeam(zb, z, P, 3)).join(""), { tone: "faint" }) });
  const top = L(k.planOutline(k.insetPlan(zb, 4), ZB_Z[1], P, 3), { tone: "lo" });
  put("spindle", "blade", [SX, by - 39, 70], b.svg + top + screwDots(k.corners(zb, 3), ZB_Z[1]), [b.shape], { name: "spindle.zblock" });
  // Z servo on the block's -x face
  const Fz = G.frameOf([zb.x, by - 40, 74], [-1, 0, 0], [0, 1, 0], [0, 0, 1]);
  const zm = S(G.disc(0, 2, 7.6, Fz, P), { tone: "mid" }) + S(G.disc(2, 15, 6.4, Fz, P), { tone: "mid", inner: L([6, 10].map((sx) => G.arcOf(Fz, sx, 6.4, P)).join(""), { tone: "faint" }) }) + S(G.disc(15, 17, 4.6, Fz, P), { tone: "mid" });
  put("spindle", "blade", [zb.x - 8, by - 40, 74], zm, [A.disc(Fz, 0, 2, 7.6, {}), A.disc(Fz, 2, 15, 6.4, {}), A.disc(Fz, 15, 17, 4.6, {})], { name: "spindle.zmotor" });
  // spindle housing along y
  const F = alongY([SX, 0, AXIS_Z]);
  const hs0 = by - 50;
  const hs1 = by - 4;
  const housing = S(G.disc(hs0, hs1, HOUSING_R, F, P), { tone: "mid", inner: L([hs0 + 8, hs0 + 30, hs1 - 6].map((s) => G.arcOf(F, s, HOUSING_R, P)).join(""), { tone: "faint" }) });
  const endCap = S(G.disc(hs0 - 3, hs0, HOUSING_R - 3, F, P), { tone: "mid" });
  const conn = box({ x: SX + HOUSING_R, y: hs0 + 4, w: 6, d: 8, r: 1 }, AXIS_Z - 3, 6, {}, { steps: 2 });
  put("spindle", "blade", [SX, by - 27, AXIS_Z], endCap + housing + conn.svg, [A.disc(F, hs0 - 3, hs0, HOUSING_R - 3, {}), A.disc(F, hs0, hs1, HOUSING_R, {}), conn.shape], { name: "spindle.housing" });
  // flange, hub blade, nut
  const fl = S(G.disc(hs1, by - BLADE.t / 2 - 0.8, BLADE.flangeR, F, P, { bevel: 0.3 }), { tone: "mid" });
  const hub = S(G.disc(by - BLADE.t / 2 - 0.8, by - BLADE.t / 2, BLADE.hubR, F, P), { tone: "mid" });
  const blade = S(G.disc(by - BLADE.t / 2, by + BLADE.t / 2, BLADE.r, F, P), { tone: "hi", crease: "lo", lit: true });
  const nut = S(G.disc(by + BLADE.t / 2, by + BLADE.t / 2 + 2, 5.5, F, P, { bevel: 0.3 }), { tone: "mid" });
  put("spindle", "blade", [SX, by, AXIS_Z], fl + hub + `<g data-blade>${blade}<g data-bspin></g></g>` + nut, [A.disc(F, hs1, by - BLADE.t / 2 - 0.8, BLADE.flangeR, { owner: "spindle.blade" }), A.disc(F, by - BLADE.t / 2 - 0.8, by - BLADE.t / 2, BLADE.hubR, { owner: "spindle.blade" }), A.disc(F, by - BLADE.t / 2, by + BLADE.t / 2, BLADE.r, { owner: "spindle.blade" }), A.disc(F, by + BLADE.t / 2, by + BLADE.t / 2 + 2, 5.5, { owner: "spindle.blade" })], { name: "spindle.blade" });
  // blade cover over the top half of the blade, hinged lid line, screws
  const cv = COVER(by);
  const cover = box(cv, COVER_Z[0], COVER_Z[1] - COVER_Z[0], {}, { steps: 3, bevel: 0.5, inner: seam(cv, COVER_Z[1] - 5, 3), meta: { owner: "spindle.blade" } });
  const hose = box({ x: SX - 6, y: by - 3, w: 12, d: 6, r: 1 }, COVER_Z[1], 4, {}, { steps: 2 });
  put("spindle", "blade", [SX, by, (COVER_Z[0] + COVER_Z[1]) / 2], cover.svg + screwDots([[cv.x + 4, by], [cv.x + cv.w - 4, by]], COVER_Z[1]) + hose.svg, [cover.shape, hose.shape], { name: "spindle.cover", bias: 0.4 });
  // cutting water: a hose from the cover's fitting back to a port on the Z block
  const hoseTop = COVER_Z[1] + 4;
  const port = { x: SX - 4, y: zb.y + zb.d, w: 8, d: 2, r: 0.6 };
  const pt = box(port, 78, 8, {}, { steps: 2 });
  put("spindle", "blade", [SX, port.y + 1, 82], pt.svg, [pt.shape], { name: "spindle.waterport" });
  tube("spindle", "blade", "spindle.hose", G.fillet([[SX, by, hoseTop], [SX, by, 82], [SX, port.y + port.d, 82]], 4, 8, { P, tube: 1.3 }), 1.3, { tone: "mid", maxLength: 12 });
  // two shower nozzles beside the blade, hung from the cover
  for (const [i, y0] of [[0, by - 3.6], [1, by + 1.8]]) {
    const bar = { x: SX - 26, y: y0, w: 32, d: 1.8, r: 0.6 };
    const strut = { x: SX - 26, y: y0, w: 3, d: 1.8, r: 0.4 };
    const b2 = box(bar, 29, 2, {}, { steps: 2 });
    const s2 = box(strut, 31, COVER_Z[0] - 31, {}, { steps: 2 });
    // the nozzle head at the bar's end, aimed down at the blade's edge, with its orifice
    const hp = { x: SX - 1, y: i ? by + 1.8 : by - 6.8, w: 8, d: 5, r: 0.8 };
    const hd = box(hp, 25, 4, {}, { steps: 2, bevel: 0.3, inner: seam(hp, 27.6, 2) });
    const orifice = Dots([at([SX + 3, i ? by + 2.4 : by - 2.4, 25])], { size: 0.6 });
    // the front head also takes a short feed pipe from the cover above it
    const pp = box({ x: SX + 3.6, y: by + 2.7, w: 1.8, d: 1.4, r: 0.4 }, 31, COVER_Z[0] - 31, {}, { steps: 2 });
    const parts = i ? [pp] : [];
    put("spindle", "blade", [SX, y0 + 1, AXIS_Z], s2.svg + b2.svg + parts.map((q) => q.svg).join("") + hd.svg + orifice + `<g data-jet="${i}"></g>`, [b2.shape, s2.shape, hd.shape, ...parts.map((q) => q.shape)], { name: `spindle.nozzle${i}` });
  }
  // alignment camera on the Z block's +x side: body, lens tube, ring light
  const camX = SX + 25;
  const camY = by - 39;
  const body = box({ x: zb.x + zb.w, y: camY - 7, w: 14, d: 14, r: 2 }, 58, 22, {}, { steps: 3, bevel: 0.4, inner: seam({ x: zb.x + zb.w, y: camY - 7, w: 14, d: 14, r: 2 }, 74, 3) });
  const lens = puck(camX, camY, 4.4, 38, 20, {}, { steps: 24, inner: L([44, 51].map((z) => k.sideArc(camX, camY, 4.4, z, P, 20)).join(""), { tone: "faint" }) });
  const ringL = puck(camX, camY, 7, 35, 3, { tone: "hi", crease: "lo" }, { steps: 28 });
  put("spindle", "camera", [camX, camY, 60], ringL.svg + lens.svg + body.svg + `<g data-camlight></g>`, [ringL.shape, lens.shape, body.shape], { name: "spindle.camera" });
}

// ---- utilities between the two tools: DI water and coolant cabinet with two pressure gauges, lines to each column ----
function utilities() {
  const cab = { x: -62, y: -196, w: 64, d: 26, r: 3 };
  const top = 58;
  const c = box(cab, 0, top, {}, { steps: 4, bevel: 0.6, inner: L([8, 30, top - 6].map((z) => k.sideSeam(cab, z, P, 4)).join(""), { tone: "faint" }) });
  const lid = L(k.planOutline(k.insetPlan(cab, 4), top, P, 4), { tone: "lo" });
  const vents = [];
  for (let i = 0; i < 6; i++) vents.push(k.planOutline({ x: cab.x + 10 + i * 8, y: cab.y + 8, w: 4, d: 10, r: 1.8 }, top, P, 3));
  put("stand", "stand", [cab.x + 32, cab.y + 13, 29], c.svg + lid + L(vents.join(""), { tone: "faint" }) + screwDots(k.corners(cab, 3.5), top), [c.shape], { name: "stand.cabinet" });
  // two dial gauges on the front face (+y)
  const faceY = cab.y + cab.d;
  for (const [i, gx] of [[0, cab.x + 18], [1, cab.x + 46]]) {
    const gz = 38;
    const F = alongY([gx, 0, gz]);
    const bezel = S(G.disc(faceY, faceY + 2.4, 8.4, F, P, { bevel: 0.3 }), { tone: "mid" });
    const ticks = [];
    const tickMajor = [];
    for (let t = 0; t <= 20; t++) {
      const a = Math.PI * 1.25 - (t / 20) * Math.PI * 1.5;
      const r1 = 6.6;
      const r0 = t % 5 ? 5.6 : 4.8;
      const seg = k.segment([gx + r0 * Math.cos(a), faceY + 2.4, gz + r0 * Math.sin(a)], [gx + r1 * Math.cos(a), faceY + 2.4, gz + r1 * Math.sin(a)], P);
      (t % 5 ? ticks : tickMajor).push(seg);
    }
    const rim = G.circleOf(F, faceY + 2.4, 6.6, P);
    const na = Math.PI * 1.25 - (i ? 0.62 : 0.48) * Math.PI * 1.5;
    const needle = k.segment([gx - 1.4 * Math.cos(na), faceY + 2.4, gz - 1.4 * Math.sin(na)], [gx + 5.2 * Math.cos(na), faceY + 2.4, gz + 5.2 * Math.sin(na)], P);
    const hub = Dots([at([gx, faceY + 2.4, gz])], { size: 0.8 });
    put("stand", "stand", [gx, faceY + 1.2, gz], bezel + L(rim, { tone: "lo" }) + L(ticks.join(""), { tone: "lo" }) + L(tickMajor.join(""), { tone: "mid" }) + L(needle, { tone: "hi", free: "end" }) + hub, [A.disc(F, faceY, faceY + 2.4, 8.4, {})], { name: `stand.dial${i}` });
  }
  // supply lines along the deck's back edge to each column, with a fitting at each end
  const lineY = -183;
  const lineZ = 8;
  const fit = (x, dir) => {
    const F = alongX([x, lineY, lineZ]);
    const a = dir > 0 ? 0 : -4;
    return { svg: S(G.disc(a, a + 4, 3, F, P), { tone: "mid" }), shape: A.disc(F, a, a + 4, 3, {}) };
  };
  const ends = [[cab.x, GCOL.x + GCOL.w], [cab.x + cab.w, SCOL.x]];
  ends.forEach(([from, to], i) => {
    const dir = to > from ? 1 : -1;
    const f0 = fit(from, dir);
    const f1 = fit(to, -dir);
    put("stand", "stand", [from + dir * 2, lineY, lineZ], f0.svg, [f0.shape], { name: `stand.fit${i}a` });
    put("stand", "stand", [to - dir * 2, lineY, lineZ], f1.svg, [f1.shape], { name: `stand.fit${i}b` });
    tube("stand", "stand", `stand.line${i}`, [[from + dir * 4, lineY, lineZ], [to - dir * 4, lineY, lineZ]], 1.6, { tone: "mid", maxLength: 40 });
  });
}

base();
utilities();
grinderTable();
grinderColumn();
grinderHead();
gauge();
sawBase();
sawTable();
sawFrame();
spindle();

// the poses the machines really take
const streetYs = []; // street y positions relative to the wafer centre
for (let y = -50; y <= 50; y += 10) streetYs.push(y);
const STATES = [];
for (let i = 0; i <= 8; i++) {
  const h = i / 8;
  const wb = WB0 - h * HEAD_TRAVEL;
  const g = Math.max(0, Math.min(1, (THICK_TOP - wb) / STOCK));
  STATES.push({ label: `grind ${h.toFixed(2)}`, shares: { head: h, stock: g, table: 0, ycar: 0, spindle: 0 } });
}
const tableShareFor = (xRel) => (-xRel - T_OFF) / T_TRAVEL; // blade at x_rel on the wafer
for (const yRel of [-70, ...streetYs]) {
  const ys = (SY + yRel - Y0) / Y_TRAVEL;
  const half = Math.abs(yRel) < WAFER_R ? Math.sqrt(WAFER_R * WAFER_R - yRel * yRel) + 5 : 6;
  for (let j = 0; j <= 6; j++) {
    const xRel = -half + (2 * half * j) / 6;
    STATES.push({ label: `cut y${yRel} x${xRel.toFixed(0)}`, shares: { head: 1, stock: 1, table: tableShareFor(xRel), ycar: ys, spindle: ys } });
  }
}
// parked: the blade off the back of the wafer, the table anywhere along its travel
STATES.push({ label: "park", shares: { head: 0, stock: 1, table: 0, ycar: 0, spindle: 0 } });
// at rest the spindle waits at the front of the beam, clear of it, while the grinder works
for (const h of [0, 0.5, 1]) STATES.push({ label: `rest ${h}`, shares: { head: h, stock: h, table: 0, ycar: REST_Y, spindle: REST_Y } });

if (!process.argv.includes("--fast")) A.settle(R, P, { states: STATES });
R.items.sort((a, b) => a.key - b.key);
const groups = R.items.map((item, index) => {
  const [mx, my, mz] = item.move;
  return `<g class="dc-it" data-piece="${item.piece}" data-part="${item.part}" data-k="${item.key.toFixed(2)}" data-m="${mx},${my},${mz}" data-i="${index}">${item.svg}</g>`;
});

const LABEL = "A back-grinder and a dicing saw on one bench. Left: a wafer lies face down on a porous vacuum chuck while a diamond cup wheel on a vertical spindle grinds its back away, watched by a two-probe thickness gauge. Right: the thinned wafer, on dicing tape in a ring frame, sits on a rotating chuck on an X table; a thin blade on a horizontal spindle, under a cover with water nozzles and beside an alignment camera, cuts the streets between the dies.";
const svg = k.figureSvg({ width: W, height: H, label: LABEL, body: [`<g class="dc-layers">${groups.join("")}</g>`, `<g class="dc-over" data-over></g>`], className: "dc-svg" });

const vec = (v) => {
  const o = at([0, 0, 0]);
  const p = at(v);
  return [p[0] - o[0], p[1] - o[1]];
};
const PARTS_ORDER = ["wheel", "chuck", "gauge", "blade", "camera", "table"];
const DATA = {
  P,
  V,
  EX: vec([1, 0, 0]),
  EY: vec([0, 1, 0]),
  EZ: vec([0, 0, 1]),
  G: { x: GX, y: GY, wx: WX, wy: WY, chuckR: CHUCK_R, chuckTop: CHUCK_TOP, wheelR: WHEEL.r, seg: WHEEL.seg, wb0: WB0, travel: HEAD_TRAVEL, lift: LIFT, stock: STOCK, thick: THICK_TOP, thin: THIN_TOP, waferR: WAFER_R },
  S: { x: SX, y: SY, tcx: TCX, tOff: T_OFF, tTravel: T_TRAVEL, y0: Y0, yTravel: Y_TRAVEL, zlift: ZLIFT, thetaR: THETA_R, thetaTop: THETA_TOP, waferTop: SW_TOP, waferR: WAFER_R, frameIn: FRAME.rIn, frameOut: FRAME.rOut, frameTop: FRAME.top, axisZ: AXIS_Z, bladeR: BLADE.r, bladeT: BLADE.t, cam: [25, -39], streets: streetYs, die: 10, restY: REST_Y, prail: PRAIL },
  CLAMP,
  phases: M.PHASES,
  pieces: M.PIECES,
  order: PARTS_ORDER,
  idle: M.IDLE,
  um: { start: M.WAFER.um, target: M.TARGET_UM, roughTo: M.ROUGH_TO_UM },
  grit: M.GRIT,
};

const legend = PARTS_ORDER.map((id, index) => `<button type="button" class="dc-part" data-part="${id}"><span class="dc-num">${String(index + 1).padStart(2, "0")}</span>${M.PIECES[id].name}</button>`).join("");
const corners = `<div class="iso-plate-corners" aria-hidden="true"><span class="iso-plate-corner" data-corner="fig">Fig 1</span><span class="iso-plate-corner" data-corner="title">Back-grinder · dicing saw</span><span class="iso-plate-corner" data-corner="readout" data-readout>${M.IDLE}</span></div>`;
const controls = `<div class="dc-controls"><span class="dc-hint">Hover a part · Space plays</span><span class="dc-live" aria-live="polite" data-live></span></div>`;
const stage = `<div class="dc-stage" tabindex="0" role="group" aria-label="Back-grinder and dicing saw. Hover, or use the arrow keys, to pick a part; Space plays or pauses the process; Escape resets it; the slider below steps through it.">${svg}</div>`;
const caption = `Two machines drawn side by side on one bench; in a fab they are separate tools, and the frame is carried between them. Left, a back-grinder of the DISCO DGP8761 class: the wafer lies face down on its protective tape on a porous vacuum chuck, and a Φ${M.GRINDER.wheelMm} mm diamond cup wheel, its rim crossing the wafer centre, feeds down while both turn, until a contact gauge reads the target (${M.TARGET_UM} µm here, from ${M.WAFER.um} µm). Right, a dicing saw of the DISCO DFD6362 class: the thinned wafer on dicing tape in a ring frame sits on a θ chuck on the X table; a hub blade under its cover, with a water nozzle on each side aimed at the blade's edge, cuts every street in X, the table turns 90° and it cuts every street in Y. Real saws carry two facing spindles; one is drawn. UV release and picking are shown on the saw's chuck to keep one wafer in view, with the UV lamp and the pick head riding a rail along the bench front (illustrative): in a fab the frame goes to a separate UV unit, and the dies are picked on a die sorter or bonder after the tape is stretched; the dots mark dies flagged bad in the probe map (illustrative). The streets on the drawn wafer are illustrative (${M.DIE_MM} mm pitch, ${streetYs.length} each way); layer thicknesses are exaggerated (the ${M.WAFER.um} µm wafer is drawn about 15 mm thick), the layout is illustrative and the motion is compressed.`;
const scrub = `<span class="dc-scrub"><button type="button" class="dc-play" data-play aria-label="Play the process"><span class="dc-play-icon" aria-hidden="true"></span><span data-play-text>Play</span></button><input type="range" class="dc-range" data-scrub min="0" max="1000" step="1" value="0" aria-label="Process: 0 is taping, 1000 is picking dies"><span class="dc-step" data-step>01 · ${M.PHASES[0].label}</span></span>`;
const meter = (title, fill, value, mark = "") => `<span class="dc-meter"><span class="dc-gauge-title">${title}</span><span class="dc-gauge-track"><span class="dc-gauge-fill" ${fill}></span>${mark}</span><span class="dc-gauge-value" ${value[0]}>${value[1]}</span></span>`;
const gaugeBar = `<div class="dc-gauge" aria-hidden="true">${meter("Wafer thickness", "data-thick", ["data-thick-text", `${M.WAFER.um} µm`], `<span class="dc-gauge-mark" style="left:${((M.TARGET_UM / M.WAFER.um) * 100).toFixed(1)}%"></span>`)}${meter("Streets cut", "data-cut", ["data-cut-text", `0 / ${streetYs.length * 2}`])}</div>`;
const body = `<figure class="iso-figure dc"><div class="iso-plate">${corners}${stage}${controls}</div><figcaption class="iso-legend">${scrub}${gaugeBar}<span class="dc-parts">${legend}</span><span class="iso-caption">${caption}</span></figcaption></figure>`;

const CSS = readFileSync(join(HERE, "dicing.css"), "utf8");
const LIVE = readFileSync(join(HERE, "live.js"), "utf8").replace("__DATA__", JSON.stringify(DATA)).replace("__CLAMPGEO__", clampGeo.toString()).replace("__CLAMPSVG__", clampSvg.toString());
const out = writeChapter({ slug: "dicing", figure: body, css: CSS, script: kitScript() + LIVE, lesson: LESSON });
console.log("wrote", out.file, `${out.kb} KB`, `${R.items.length} items`, `${R.solids.length} solids`);

// the four clamps are recorded over their whole quarter turn, so their swept shapes meet; at any one angle they are 90° apart
A.auditOrExit(R, P, { frames: STATES, apart: false, allow: [["table.clamp*", "table.clamp*"]] });
