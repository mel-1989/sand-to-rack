// A co-packaged optics (CPO) switch package on its test board: a switch ASIC ringed by six detachable optical
// sub-assemblies (three optical engines each, a photonic IC with its electronic IC stacked on top), fibre trunks to
// the board edge, external laser source modules, a loopback fibre, and an OSFP pluggable for comparison.
// node build.mjs [--fast] [--audit]
// World units are illustrative (about 0.5 mm in the package), x and y on the floor, z up.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as M from "./model.mjs";
import { k, G, A, Tube } from "../../site/kit.mjs";
import { writeChapter } from "../../site/shell.mjs";
import { LESSON } from "./lesson.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

const W = 640;
const H = 470;
const AZ = 52;
const EL = 40;

// ---- plan ----
const PLATE = { x: -216, y: -142, w: 432, d: 374, r: 12 };
const PLATE_H = 12;
const FOOT_H = 7;
const BOARD = { x: -186, y: -118, w: 372, d: 288, r: 5 };
const Z_BOARD = [10, 13];
const BT = Z_BOARD[1]; // board top
const FRONT = BOARD.y + BOARD.d; // 170, the board's front edge
const SUB = { x: -112, y: -92, w: 224, d: 184, r: 3 };
const Z_SUB = [15, 20];
const ST = Z_SUB[1]; // substrate top
const DIE = { x: -34, y: -34, w: 68, d: 68, r: 0.8 };
const Z_DIE = [21, 27];
const OSA_ROWS = [-58, 0, 58]; // OSA centres in y
const OSA_D = 52;
const OSA_IN = 44; // inner edge |x|
const OSA_OUT = 108; // outer edge |x| (connector face)
const HOUSE_IN = 95; // connector housing inner edge |x|
const Z_CARRIER = [20, 23];
const Z_LID = [23, 31];
const Z_HOUSE = [23, 33];
const TRUNK_Z = 28;
const LANES = [141, 153, 165]; // |x| of the trunk lanes: front OSA innermost
const ADAPT = { y0: 158, y1: FRONT, z0: BT, z1: 27, w: 10 };
const CORD_Z = 20;
const ELS_X = [-100.7, -68];
const CAGE = { y0: 138, y1: FRONT, z0: BT, z1: 31, w: 28 };
const NOSE = 24; // how far a module sticks out past the board edge
const OSFP_X = 74;
const TX = { side: -1, row: 2 }; // front-left OSA, middle engine: transmit
const RX = { side: 1, row: 2 }; // front-right OSA, middle engine: receive

const P = k.fitProjection([...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), ...k.boxCorners(BOARD, 0, 34)], W, H, { pad: 12, azimuth: AZ, elevation: EL });
const V = G.viewOf(P);
const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);
const centreOf = (plan, z) => [plan.x + plan.w / 2, plan.y + plan.d / 2, z];
const span = (a, b) => [Math.min(a, b), Math.max(a, b)];
const planX = (x0, x1, y0, y1, r = 0.6) => {
  const [a, b] = span(x0, x1);
  const [c, d] = span(y0, y1);
  return { x: a, y: c, w: b - a, d: d - c, r };
};

const R = A.recorder(P);
function put(piece, ref, svg, shapes, { bias = 0, name } = {}) {
  const id = name ?? R.nameFor(`${piece}.item`);
  shapes.forEach((shape) => (shape.name = shape.name ?? id));
  return R.put({ piece, at: ref, bias, svg, move: [0, 0, 0], shapes: shapes.map(R.solid), name: id });
}
function box(piece, name, plan, z, h, style = {}, { extra = "", inner = "", steps = 3, bevel = 0.5, bias = 0 } = {}) {
  return put(piece, centreOf(plan, z + h / 2), S(k.slabOf(plan, z, h, P, steps, bevel), { tone: "mid", ...style, inner }) + extra, [A.slab(plan, z, h, {}, steps)], { name, bias });
}
function cyl(piece, name, x, y, r, z, h, style = {}, { extra = "", inner = "", steps = 24, bevel = 0.3, bias = 0 } = {}) {
  return put(piece, [x, y, z + h / 2], S(k.cylinder(x, y, r, z, h, P, steps, bevel), { tone: "mid", ...style, inner }) + extra, [A.cylinder(x, y, r, z, h, {})], { name, bias });
}
const screwsOnTop = (points, z, size = 0.45, ring = 1.8) => L(points.map(([x, y]) => k.ring(x, y, ring, z, P, 14)).join(""), { tone: "lo" }) + Dots(points.map(([x, y]) => at([x, y, z])), { size });

// ---- fibres and cables (kit tube); each end has a boot or ferrule owned by the line ----
const ROUTES = {};
function line(piece, name, points, r, { tone = "mid", fit = r * 1.9, fitLen = Math.max(2.4, r * 2.2), bend = Math.max(4, r * 3.2), maxLength = 30 } = {}) {
  const route = G.fillet(points, bend, 10, { P, tube: r });
  const total = G.pathLength(route);
  const gaps = [[0, fitLen], [total - fitLen, total]];
  R.route(name, route, r, { gaps, rims: [fit, fit], piece, limp: true });
  Tube.tubePieces(route, r, P, { maxLength, spacing: Math.max(0.6, Math.min(2, r)), gaps }).forEach((pc, index) =>
    R.put({ piece, name: `${name}:${index}`, at: pc.mid, bias: 0.02, svg: Tube.tubeSvg(pc, { tone }), move: [0, 0, 0], shapes: [R.solid(A.tube(pc.points, pc.radii, { name: `${name}:${index}`, owner: name }))] }),
  );
  [0, 1].forEach((index) => {
    const end = index ? route[route.length - 1] : route[0];
    const tangent = G.tangentAlong(route, index ? total : 0);
    const F = G.frameAlong(end, tangent);
    const [s0, s1] = index ? [-fitLen, 0] : [0, fitLen];
    const nut = G.disc(s0, s1, fit, F, P, { steps: 20, bevel: 0.2 });
    const shape = A.disc(F, s0, s1, fit, { name: `${name}.fit${index}`, owner: name });
    R.put({ piece, name: `${name}.fit${index}`, at: G.add3(end, G.mul3(tangent, (s0 + s1) / 2)), bias: 0.06, svg: S(nut, { tone: "mid" }), move: [0, 0, 0], shapes: [R.solid(shape)] });
  });
  ROUTES[name] = route;
  return route;
}

// =====================================================================
// stand: bench plate, feet, ruler, label plate
function stand() {
  const out = [];
  out.push(`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`);
  const shapes = [];
  const byDepth = (pts) => [...pts].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
  for (const [x, y] of byDepth(k.corners(PLATE, 26))) {
    out.push(S(k.cylinder(x, y, 8, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 6, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
    shapes.push(A.cylinder(x, y, 8, -PLATE_H - FOOT_H, FOOT_H, {}));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.4), { tone: "mid", inner: L(k.sideSeam(PLATE, -PLATE_H + 3, P, 8), { tone: "faint" }) }));
  shapes.push(A.slab(PLATE, -PLATE_H, PLATE_H, {}));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 6), 0, P), { tone: "lo" }));
  out.push(screwsOnTop(k.corners(PLATE, 12), 0, 0.5, 2.4));
  // ruler strip along the near edge, ticks every 5, majors every 25
  const strip = { x: -186, y: PLATE.y + PLATE.d - 20, w: 200, d: 8, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 5, 5, strip.y + 0.8, 0.6, [2.2, 4], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(Dots([at([strip.x + 2, strip.y + 4, 0.6]), at([strip.x + strip.w - 2, strip.y + 4, 0.6])], { size: 0.45 }));
  // label plate
  const label = { x: 90, y: PLATE.y + PLATE.d - 24, w: 100, d: 16, r: 1.5 };
  out.push(S(k.slabOf(label, 0, 0.8, P, 4), { tone: "lo", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.8), 0.8, P, 4), { tone: "faint" }));
  out.push(L([0, 1, 2].map((i) => k.lineOnTop([label.x + 9, label.y + 5 + i * 3], [label.x + 78 - i * 18, label.y + 5 + i * 3], 0.8, P)).join(""), { tone: "lo", free: true }));
  out.push(Dots([at([label.x + 4, label.y + label.d / 2, 0.8]), at([label.x + label.w - 4, label.y + label.d / 2, 0.8])], { size: 0.45 }));
  put("board", [0, 0, -1], out.join(""), shapes, { name: "stand.base", bias: -800 });
}

// =====================================================================
// the switch test board on standoffs
function board() {
  const posts = [[BOARD.x + 12, BOARD.y + 12], [BOARD.x + BOARD.w - 12, BOARD.y + 12], [BOARD.x + 12, BOARD.y + BOARD.d - 12], [BOARD.x + BOARD.w - 12, BOARD.y + BOARD.d - 12], [0, BOARD.y + 12], [0, BOARD.y + BOARD.d - 12]];
  for (const [x, y] of posts) cyl("board", R.nameFor("stand.standoff"), x, y, 5, 0, Z_BOARD[0], { tone: "mid" }, { steps: 6, bevel: 0 });
  const traces = [];
  // power entry traces to the back connector
  for (const dx of [-6, 0, 6]) traces.push(k.onTop([[146 + dx, -100], [146 + dx, -66 - dx], [SUB.x + SUB.w + 10, -66 - dx]], BT, P));
  const extra =
    L(k.planOutline(k.insetPlan(BOARD, 5), BT, P, 4), { tone: "faint" }) +
    L(traces.join(""), { tone: "lo" }) +
    screwsOnTop(posts, BT, 0.5, 2.6) +
    L(k.planOutline({ x: SUB.x - 14, y: SUB.y - 14, w: SUB.w + 28, d: SUB.d + 28, r: 4 }, BT, P, 3), { tone: "faint" });
  box("board", "board.pcb", BOARD, Z_BOARD[0], Z_BOARD[1] - Z_BOARD[0], { tone: "mid" }, { steps: 4, bevel: 0.6, extra, inner: L(k.sideSeam(BOARD, 11.5, P, 4), { tone: "faint" }), bias: -400 });
  // power connector at the back
  const pwr = { x: 128, y: -114, w: 36, d: 14, r: 1 };
  box("board", "board.power", pwr, BT, 12, { tone: "mid" }, { extra: L([0, 1, 2, 3].map((i) => k.planOutline({ x: pwr.x + 4 + i * 7.6, y: pwr.y + 4, w: 5, d: 8, r: 1 }, BT + 12, P, 2)).join(""), { tone: "lo" }), inner: L(k.sideSeam(pwr, BT + 3, P, 3), { tone: "faint" }) });
  // the long copper path a pluggable needs: package edge to the OSFP cage, its own item so it lights with the module
  const copper = [-9, -3, 3, 9].map((dx) => k.lineOnTop([OSFP_X + dx, SUB.y + SUB.d + 10], [OSFP_X + dx, CAGE.y0], BT, P)).join("");
  const band = { x: OSFP_X - 10, y: SUB.y + SUB.d + 10, w: 20, d: CAGE.y0 - SUB.y - SUB.d - 10, r: 0 };
  put("osfp", centreOf(band, BT), L(copper, { tone: "mid" }), [A.slab(band, BT - 0.2, 0.2, {}, 1)], { name: "osfp.traces" });
  // power stages along the back edge: a row of inductors feeding the package
  for (let i = 0; i < 9; i++) {
    const x = -84 + i * 19;
    const ind = { x: x - 5, y: -114, w: 10, d: 9, r: 1 };
    box("board", R.nameFor("board.inductor"), ind, BT, 7, { tone: "mid" }, { bevel: 0.4, inner: L(k.sideSeam(ind, BT + 1.5, P, 3), { tone: "faint" }), extra: L(k.planOutline(k.insetPlan(ind, 2), BT + 7, P, 2), { tone: "faint" }) });
  }
  // a status LED and a small clock chip near the package
  box("board", "board.clock", { x: -160, y: -110, w: 18, d: 18, r: 0.8 }, BT, 3, { tone: "mid" }, { extra: Dots([at([-157, -107, BT + 3])], { size: 0.45, tone: "lo" }) });
}

// =====================================================================
// the package: loading frame, substrate, capacitors, the switch ASIC and its stiffener
function packageBody() {
  const F = 9; // frame bar width
  const bars = [
    { x: SUB.x - 1 - F, y: SUB.y - 1 - F, w: F, d: SUB.d + 2 + 2 * F, r: 1 },
    { x: SUB.x + SUB.w + 1, y: SUB.y - 1 - F, w: F, d: SUB.d + 2 + 2 * F, r: 1 },
    { x: SUB.x - 1, y: SUB.y - 1 - F, w: SUB.w + 2, d: F, r: 0.2 },
    { x: SUB.x - 1, y: SUB.y + SUB.d + 1, w: SUB.w + 2, d: F, r: 0.2 },
  ];
  bars.forEach((bar, i) => {
    const screws = i < 2 ? [[bar.x + F / 2, bar.y + 6], [bar.x + F / 2, bar.y + bar.d - 6]] : [];
    box("asic", `asic.frame${i}`, bar, BT, 5, { tone: "mid" }, { extra: screwsOnTop(screws, BT + 5, 0.45, 2.2), bevel: 0.3 });
  });
  // BGA field under the substrate, then the substrate itself
  const layers = L([ST - 1.4, ST - 3].map((z) => k.sideSeam(SUB, z, P, 3)).join(""), { tone: "faint" });
  const balls = S(k.slabOf(k.insetPlan(SUB, 1.5), BT, Z_SUB[0] - BT, P, 3), { tone: "lo", crease: "none" });
  const fid = [[SUB.x + 6, SUB.y + 6], [SUB.x + SUB.w - 6, SUB.y + SUB.d - 6]];
  const marks = L(fid.map(([x, y]) => k.ring(x, y, 1.6, ST, P, 14)).join(""), { tone: "lo" }) + Dots(fid.map(([x, y]) => at([x, y, ST])), { size: 0.45 });
  put("asic", centreOf(SUB, Z_SUB[0]), balls + S(k.slabOf(SUB, Z_SUB[0], ST - Z_SUB[0], P, 3, 0.5), { tone: "mid", inner: layers }) + marks, [A.slab(k.insetPlan(SUB, 1.5), BT, Z_SUB[0] - BT, {}, 3), A.slab(SUB, Z_SUB[0], ST - Z_SUB[0], {}, 3)], { name: "asic.substrate" });

  // decoupling capacitors in the strips in front of and behind the die
  for (const side of [-1, 1]) {
    const caps = [];
    for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) caps.push({ x: -33 + i * 12, y: side * (52 + j * 12) - 1, w: 4, d: 2.2, r: 0.2 });
    caps.sort((a, b) => k.depthOf(centreOf(a, ST), P) - k.depthOf(centreOf(b, ST), P));
    const svg = caps.map((c) => S(k.slabOf(c, ST, 1.6, P, 2), { tone: "hi", crease: "lo" })).join("");
    put("asic", [0, side * 64, ST + 0.8], svg, caps.map((c) => A.slab(c, ST, 1.6, {}, 2)), { name: `asic.caps${side < 0 ? "B" : "F"}` });
  }

  // stiffener ring round the die, four bars
  const S0 = 42;
  const SW = 5;
  const ring = [
    { x: -S0, y: -S0, w: SW, d: 2 * S0, r: 0.6 },
    { x: S0 - SW, y: -S0, w: SW, d: 2 * S0, r: 0.6 },
    { x: -S0 + SW, y: -S0, w: 2 * S0 - 2 * SW, d: SW, r: 0.1 },
    { x: -S0 + SW, y: S0 - SW, w: 2 * S0 - 2 * SW, d: SW, r: 0.1 },
  ];
  ring.forEach((bar, i) => box("asic", `asic.stiffener${i}`, bar, ST, 4, { tone: "mid" }, { bevel: 0.3 }));

  // the die: underfill fillet, body, seal ring, floorplan, SerDes bands facing each OSA
  const fill = k.insetPlan(DIE, -0.8);
  const under = S(k.slabOf(fill, ST, Z_DIE[0] - ST, P, 2), { tone: "lo", crease: "none" });
  const body = S(k.slabOf(DIE, Z_DIE[0], Z_DIE[1] - Z_DIE[0], P, 2, 0.5), { tone: "hi", crease: "lo", inner: L(k.sideSeam(DIE, Z_DIE[0] + 1.2, P, 2), { tone: "faint" }) });
  const seal = k.insetPlan(DIE, 1.4);
  const core = { x: seal.x + 9, y: seal.y + 2, w: seal.w - 18, d: seal.d - 4, r: 0.2 };
  const lines = [k.planOutline(seal, Z_DIE[1], P, 2), k.planOutline(core, Z_DIE[1], P, 2)];
  for (let i = 1; i < 4; i++) lines.push(k.lineOnTop([core.x + (core.w * i) / 4, core.y], [core.x + (core.w * i) / 4, core.y + core.d], Z_DIE[1], P));
  for (let j = 1; j < 4; j++) lines.push(k.lineOnTop([core.x, core.y + (core.d * j) / 4], [core.x + core.w, core.y + (core.d * j) / 4], Z_DIE[1], P));
  const serdes = [];
  for (const sx of [-1, 1]) for (const yc of OSA_ROWS) serdes.push(k.planOutline({ x: sx < 0 ? seal.x + 1.2 : seal.x + seal.w - 6.2, y: yc * 0.5 - 8, w: 5, d: 16, r: 0.3 }, Z_DIE[1], P, 2));
  put("asic", centreOf(DIE, Z_DIE[0]), under + body + L(lines.join(""), { tone: "lo" }) + L(serdes.join(""), { tone: "faint" }), [A.slab(fill, ST, Z_DIE[0] - ST, {}, 2), A.slab(DIE, Z_DIE[0], Z_DIE[1] - Z_DIE[0], {}, 2)], { name: "asic.die" });
}

// =====================================================================
// optical sub-assemblies: carrier, lid or open engines, connector housing
function engine(prefix, side, yc, tone = "hi") {
  const s = side;
  const pic = planX(s * 48, s * HOUSE_IN, yc - 7, yc + 7, 0.4);
  const eic = planX(s * 50, s * 66, yc - 5, yc + 5, 0.3);
  const fau = planX(s * 85, s * HOUSE_IN, yc - 6, yc + 6, 0.3);
  const zp = [Z_CARRIER[1], Z_CARRIER[1] + 2.4];
  const ze = [zp[1], zp[1] + 2];
  const zf = [zp[1], zp[1] + 4];
  // waveguides on the PIC top, from the EIC edge to the fibre attach face; rings on the transmit lanes, photodiodes on receive
  const wg = [];
  const marks = [];
  const pd = [];
  [-3.6, -1.2, 1.2, 3.6].forEach((dy, i) => {
    wg.push(k.lineOnTop([s * 66, yc + dy], [s * 85, yc + dy], zp[1], P));
    const x = s * (70 + i * 3.4);
    if (i < 2) marks.push(k.ring(x, yc + dy - 1.25, 0.95, zp[1], P, 16));
    else pd.push(k.planOutline(planX(x - 1.2, x + 1.2, yc + dy + 0.35, yc + dy + 1.15, 0.1), zp[1], P, 1));
  });
  const picSvg = S(k.slabOf(pic, zp[0], zp[1] - zp[0], P, 2, 0.3), { tone, crease: "lo", inner: L(k.sideSeam(pic, zp[0] + 0.8, P, 2), { tone: "faint" }) }) + L(wg.join(""), { tone: "lo" }) + L(marks.join(""), { tone: "mid" }) + L(pd.join(""), { tone: "mid" });
  put("pic", centreOf(pic, zp[0]), picSvg, [A.slab(pic, zp[0], zp[1] - zp[0], {}, 2)], { name: `${prefix}.pic` });
  // the EIC hybrid-bonded on top (COUPE): driver and TIA
  const eicSvg = S(k.slabOf(eic, ze[0], ze[1] - ze[0], P, 2, 0.3), { tone, crease: "lo" }) + L(k.planOutline(k.insetPlan(eic, 1.2), ze[1], P, 2), { tone: "faint" });
  put("pic", centreOf(eic, ze[0]), eicSvg, [A.slab(eic, ze[0], ze[1] - ze[0], {}, 2)], { name: `${prefix}.eic` });
  // fibre attach unit: a glass block with a V-groove lid
  const fauSvg = S(k.slabOf(fau, zf[0], zf[1] - zf[0], P, 2, 0.3), { tone: "mid", inner: L(k.sideSeam(fau, zf[0] + 2, P, 2), { tone: "faint" }) });
  put("pic", centreOf(fau, zf[0]), fauSvg, [A.slab(fau, zf[0], zf[1] - zf[0], {}, 2)], { name: `${prefix}.fau` });
}

function osa(side, row, open) {
  const s = side;
  const yc = OSA_ROWS[row];
  const id = `${s < 0 ? "L" : "R"}${row}`;
  const carrier = planX(s * OSA_IN, s * OSA_OUT, yc - OSA_D / 2, yc + OSA_D / 2, 1);
  const cs = k.corners(carrier, 3.2);
  box("osa", `osa.${id}.carrier`, carrier, Z_CARRIER[0], Z_CARRIER[1] - Z_CARRIER[0], { tone: "mid" }, { bevel: 0.3, extra: open ? screwsOnTop(cs.filter(([x]) => Math.abs(x) < 60), Z_CARRIER[1], 0.42, 1.4) : "" });
  if (open) {
    const isTx = s === TX.side && row === TX.row;
    const isRx = s === RX.side && row === RX.row;
    [-17, 0, 17].forEach((dy, i) => engine(i === 1 && isTx ? "pic.tx" : i === 1 && isRx ? "pic.rx" : `pic.${id}e${i}`, s, yc + dy));
  } else {
    const lid = planX(s * (OSA_IN + 2), s * HOUSE_IN, yc - OSA_D / 2 + 2, yc + OSA_D / 2 - 2, 1.4);
    const slots = [];
    for (let i = 0; i < 3; i++) slots.push(k.planOutline(planX(s * 62, s * 86, yc - 14 + i * 12, yc - 12 + i * 12, 1), Z_LID[1], P, 2));
    box("osa", `osa.${id}.lid`, lid, Z_LID[0], Z_LID[1] - Z_LID[0], { tone: "mid" }, { bevel: 0.6, inner: L(k.sideSeam(lid, Z_LID[0] + 2.4, P, 3), { tone: "faint" }), extra: L(slots.join(""), { tone: "lo" }) + screwsOnTop([[s * 52, yc - 18], [s * 52, yc + 18]], Z_LID[1], 0.45, 1.6) });
  }
  // connector housing: the detachable, sealed fibre interface
  const house = planX(s * HOUSE_IN, s * OSA_OUT, yc - 20, yc + 20, 1);
  const latch = L(k.planOutline(planX(s * 98, s * 105, yc - 14, yc + 14, 1.2), Z_HOUSE[1], P, 2), { tone: "lo" });
  box("osa", `osa.${id}.house`, house, Z_HOUSE[0], Z_HOUSE[1] - Z_HOUSE[0], { tone: "mid" }, { bevel: 0.5, inner: L(k.sideSeam(house, Z_HOUSE[0] + 3, P, 3), { tone: "faint" }), extra: latch + screwsOnTop([[s * 101.5, yc - 17], [s * 101.5, yc + 17]], Z_HOUSE[1], 0.42, 1.2) });
}

// =====================================================================
// board edge: MPO adapters, laser-source cages, the pluggable for comparison
function edge() {
  for (const s of [-1, 1]) {
    for (const lane of LANES) {
      const x = s * lane;
      const a = planX(x - ADAPT.w / 2, x + ADAPT.w / 2, ADAPT.y0, ADAPT.y1, 0.8);
      const live = lane === LANES[0];
      box(live ? "fibre" : "board", `${live ? "fibre" : "board"}.mpo${s < 0 ? "L" : "R"}${lane}`, a, ADAPT.z0, ADAPT.z1 - ADAPT.z0, { tone: "mid" }, { bevel: 0.4, inner: L(k.sideSeam(a, ADAPT.z0 + 3, P, 2), { tone: "faint" }), extra: screwsOnTop([[x, ADAPT.y0 + 3]], ADAPT.z1, 0.4, 1.1) });
      if (!live) {
        // dust cap on the unused front port
        const F = G.frameAlong([x, FRONT, CORD_Z], [0, 1, 0]);
        put("board", [x, FRONT + 2, CORD_Z], S(G.disc(0, 4, 3.2, F, P, { steps: 20, bevel: 0.2 }), { tone: "lo" }), [A.disc(F, 0, 4, 3.2, {})], { name: `board.cap${s < 0 ? "L" : "R"}${lane}` });
      }
    }
  }
  // external laser source modules in their cages
  ELS_X.forEach((cx, i) => {
    const cage = planX(cx - CAGE.w / 2, cx + CAGE.w / 2, CAGE.y0, CAGE.y1, 1);
    const vents = [];
    for (let j = 0; j < 4; j++) vents.push(k.planOutline(planX(cx - 9, cx + 9, CAGE.y0 + 5 + j * 6, CAGE.y0 + 7.4 + j * 6, 1), CAGE.z1, P, 2));
    box("els", `els.cage${i}`, cage, CAGE.z0, CAGE.z1 - CAGE.z0, { tone: "mid" }, { bevel: 0.4, inner: L(k.sideSeam(cage, CAGE.z0 + 4, P, 3), { tone: "faint" }), extra: L(vents.join(""), { tone: "lo" }) });
    const nose = planX(cx - 11, cx + 11, FRONT, FRONT + NOSE, 1.2);
    box("els", `els.module${i}`, nose, 15, 13, { tone: "hi", crease: "lo" }, { bevel: 0.5, inner: L(k.sideSeam(nose, 19, P, 3), { tone: "faint" }), extra: L(k.planOutline(planX(cx - 7, cx + 7, FRONT + 5, FRONT + 16, 0.8), 28, P, 2), { tone: "faint" }) + Dots([at([cx + 6, FRONT + 20, 28])], { size: 0.55, tone: "lo" }) });
    const tab = planX(cx - 5, cx + 5, FRONT + NOSE, FRONT + NOSE + 6, 1.4);
    box("els", `els.tab${i}`, tab, 17, 2.4, { tone: "mid" }, { bevel: 0.2 });
  });
  // OSFP pluggable transceiver, for comparison: cage, module nose with its heat-sink fins, pull tab
  const cage = planX(OSFP_X - 17, OSFP_X + 17, CAGE.y0, CAGE.y1, 1);
  box("osfp", "osfp.cage", cage, CAGE.z0, CAGE.z1 - CAGE.z0, { tone: "mid" }, { bevel: 0.4, inner: L(k.sideSeam(cage, CAGE.z0 + 4, P, 3), { tone: "faint" }), extra: screwsOnTop([[OSFP_X - 13, CAGE.y0 + 4], [OSFP_X + 13, CAGE.y0 + 4]], CAGE.z1, 0.4, 1.2) });
  const nose = planX(OSFP_X - 15, OSFP_X + 15, FRONT, FRONT + NOSE + 2, 1.2);
  box("osfp", "osfp.module", nose, 15, 11, { tone: "hi", crease: "lo" }, { bevel: 0.4, inner: L(k.sideSeam(nose, 18, P, 3), { tone: "faint" }) });
  for (let j = 0; j < 5; j++) {
    const fin = planX(OSFP_X - 13 + j * 6.2, OSFP_X - 11 + j * 6.2, FRONT + 2, FRONT + NOSE, 0.3);
    box("osfp", `osfp.fin${j}`, fin, 26, 5, { tone: "mid" }, { bevel: 0, steps: 2 });
  }
  const tab = planX(OSFP_X - 6, OSFP_X + 6, FRONT + NOSE + 2, FRONT + NOSE + 8, 1.4);
  box("osfp", "osfp.tab", tab, 17, 2.4, { tone: "mid" }, { bevel: 0.2 });
}

// =====================================================================
// fibre: one trunk per OSA to its adapter, the laser fibres, the loopback cord
function fibres() {
  for (const s of [-1, 1]) {
    OSA_ROWS.forEach((yc, row) => {
      const lane = s * LANES[2 - row];
      const name = s === TX.side && row === TX.row ? "fibre.tx" : s === RX.side && row === RX.row ? "fibre.rx" : `fibre.t${s < 0 ? "L" : "R"}${row}`;
      line("fibre", name, [[s * OSA_OUT, yc, TRUNK_Z], [lane, yc, TRUNK_Z], [lane, yc + 50, CORD_Z], [lane, ADAPT.y0, CORD_Z]], 1.7, { fit: 3.1, fitLen: 4, bend: 7 });
    });
  }
  // laser fibres from the two ELS cages into the transmit OSA's housing (its near face)
  const txY = OSA_ROWS[TX.row];
  const port = txY + 20;
  line("els", "els.fibre0", [[ELS_X[0], CAGE.y0, 27], [ELS_X[0], port, 27]], 0.75, { fit: 1.35, fitLen: 2.6, bend: 4 });
  line("els", "els.fibre1", [[ELS_X[1], CAGE.y0, 27], [ELS_X[1], 106, 27], [-97.3, 106, 27], [-97.3, port, 27]], 0.75, { fit: 1.35, fitLen: 2.6, bend: 4 });
  // loopback: from the transmit trunk's adapter, down to the bench, across, and up into the receive trunk's adapter
  const x0 = -LANES[0];
  const x1 = LANES[0];
  line("fibre", "fibre.loop", [[x0, FRONT, CORD_Z], [x0, FRONT + 14, CORD_Z], [x0, FRONT + 34, 2.6], [x1, FRONT + 34, 2.6], [x1, FRONT + 14, CORD_Z], [x1, FRONT, CORD_Z]], 1.5, { fit: 2.9, fitLen: 4, bend: 8, maxLength: 24 });
}

stand();
board();
packageBody();
for (const s of [-1, 1]) OSA_ROWS.forEach((_, row) => osa(s, row, row === 2));
edge();
fibres();

// ---- the light layer: a reserved slot above everything, painted by the live code ----
if (!process.argv.includes("--fast")) A.settle(R, P);
R.items.sort((a, b) => a.key - b.key);
const groups = R.items.map((item, index) => `<g class="it" data-piece="${item.piece}" data-name="${item.name}" data-i="${index}">${item.svg}</g>`);

// the bit's path through the machine, in world space, then on screen
const txY = OSA_ROWS[TX.row];
const rxY = OSA_ROWS[RX.row];
const zp = Z_CARRIER[1] + 2.4;
const chain = (...parts) => parts.flat();
const rev = (list) => [...list].reverse();
const PATHS = {
  serdes: [[-18, txY * 0.5, Z_DIE[1]], [-34, txY * 0.5, Z_DIE[1]], [-50, txY, zp + 2]],
  driver: [[-50, txY, zp + 2], [-66, txY - 3.6, zp], [-70, txY - 3.6, zp]],
  laser: chain(ROUTES["els.fibre0"], [[-100, txY + 12, zp + 3], [-90, txY - 3.6, zp + 2], [-85, txY - 3.6, zp], [-70, txY - 3.6, zp]]),
  fibre: chain([[-70, txY - 3.6, zp], [-85, txY - 3.6, zp], [-95, txY, zp + 2], [-OSA_OUT, txY, TRUNK_Z]], ROUTES["fibre.tx"], ROUTES["fibre.loop"], rev(ROUTES["fibre.rx"]), [[OSA_OUT, rxY, TRUNK_Z], [95, rxY, zp + 2], [85, rxY + 1.2, zp], [77, rxY + 1.2, zp]]),
  back: [[77, rxY + 1.2, zp], [66, rxY, zp + 1], [50, rxY, zp + 2], [34, rxY * 0.5, Z_DIE[1]], [18, rxY * 0.5, Z_DIE[1]]],
  plug: [[18, 20, Z_DIE[1]], [34, 34, Z_DIE[1]], [OSFP_X, SUB.y + SUB.d + 9, BT], [OSFP_X, CAGE.y0, BT], [OSFP_X, FRONT + NOSE, 22]],
};
// where light runs inside a housing or a glass block, the dot is hidden: spans of points, by index
const n = (key) => PATHS[key].length;
const HIDDEN = {
  laser: [[ROUTES["els.fibre0"].length - 1, ROUTES["els.fibre0"].length + 2]],
  fibre: [[1, 3], [n("fibre") - 4, n("fibre") - 2]],
};
const screenPath = (points, hidden = []) => {
  const pts = points.map((p) => at(p).map((v) => Math.round(v * 10) / 10));
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, cum, hide: hidden.map(([i0, i1]) => [cum[i0], cum[i1]]) };
};
const SCREEN = Object.fromEntries(Object.entries(PATHS).map(([key, pts]) => [key, screenPath(pts, HIDDEN[key])]));
const ringAt = at([-70, txY - 3.6 - 1.25, zp]);
const pdAt = at([77, rxY + 1.2 + 0.75, zp]);
const light = `<g class="sp-light" data-light aria-hidden="true"><circle class="sp-ring-glow" data-ringglow cx="${ringAt[0].toFixed(1)}" cy="${ringAt[1].toFixed(1)}" r="7" fill="url(#sp-dot-grad)" opacity="0"/><circle class="sp-ring-glow" data-pdglow cx="${pdAt[0].toFixed(1)}" cy="${pdAt[1].toFixed(1)}" r="7" fill="url(#sp-dot-grad)" opacity="0"/><g data-dots></g></g>`;
const defs = `<defs><radialGradient id="sp-dot-grad"><stop offset="0" class="sp-d0"/><stop offset="0.35" class="sp-d1"/><stop offset="1" class="sp-d2"/></radialGradient></defs>`;

const LABEL = `A co-packaged optics switch package on its test board, cold plate removed. In the middle, the switch ASIC on its substrate, inside a stiffener ring with capacitors in front and behind. Around it, six detachable optical sub-assemblies, three a side; the two nearest have their lids off to show three optical engines each: a photonic chip with waveguides, micro-ring modulators and photodiodes, an electronic chip stacked on it, and a glass fibre attach block. Each sub-assembly has a sealed connector housing and a fibre trunk that runs in a lane to an adapter at the board edge. Two external laser source modules sit in cages at the board edge with thin fibres into the front-left housing; an OSFP pluggable transceiver sits in its cage for comparison, with the long copper traces it needs; a loopback fibre on the bench joins the front-left and front-right adapters.`;
const svg = k.figureSvg({ width: W, height: H, label: LABEL, body: [defs, `<g class="sp-layers">${groups.join("")}</g>`, light], className: "sp-svg" });

const RUN = {
  serdes: ["asic.die", "pic.tx.eic"],
  laser: ["els.", "pic.tx.fau"],
  ring: ["pic.tx.pic", "pic.tx.eic"],
  fibre: ["fibre.tx", "fibre.loop", "fibre.rx", `fibre.mpoL${LANES[0]}`, `fibre.mpoR${LANES[0]}`],
  detect: ["pic.rx.pic", "pic.rx.fau"],
  back: ["pic.rx.eic", "asic.die"],
  compare: ["osfp."],
};
const DATA = {
  screen: SCREEN,
  run: RUN,
  steps: M.STEPS.map(({ id, name, say }) => ({ id, name, say })),
  parts: M.PARTS,
  order: Object.keys(M.PARTS),
  idle: M.IDLE,
  done: M.DONE,
};

const PARTS = DATA.order.map((id, index) => `<button type="button" class="sp-part" data-part="${id}"><span class="sp-num">${String(index + 1).padStart(2, "0")}</span>${M.PARTS[id].name}</button>`).join("");
const corners = `<div class="iso-plate-corners" aria-hidden="true"><span class="iso-plate-corner" data-corner="fig">Fig 1</span><span class="iso-plate-corner" data-corner="title">CPO switch · one bit's path</span><span class="iso-plate-corner" data-corner="readout" data-readout>${M.IDLE}</span></div>`;

// inset: one lane at chip scale, and the comparison with a pluggable (2D detail, schematic)
const barMax = Math.max(M.POWER.pluggableW, M.POWER.pluggableLossDb, M.pjPluggable);
const bar = (y, value, max, cls) => `<rect class="${cls}" x="70" y="${y}" width="${((value / max) * 118).toFixed(1)}" height="7" rx="1.5"/>`;
const inset = `<div class="sp-inset" aria-hidden="true"><span class="sp-inset-label" data-inset-label>Detail · one lane</span><svg viewBox="0 0 220 132" class="sp-inset-svg">
<rect class="sp-in-frame" x="0.5" y="0.5" width="219" height="131" rx="6"/>
<g data-lane>
<rect class="sp-in-chip" x="10" y="16" width="200" height="50" rx="3"/>
<path class="sp-in-wg" data-in-wg d="M10 48H210"/>
<circle class="sp-in-ring" data-in-ring cx="70" cy="34" r="11"/>
<rect class="sp-in-box" data-in-eic x="54" y="4" width="32" height="9" rx="2"/>
<path class="sp-in-wire" d="M70 13V23"/>
<rect class="sp-in-box" data-in-pd x="150" y="43" width="12" height="10" rx="1.5"/>
<rect class="sp-in-box" data-in-tia x="140" y="4" width="32" height="9" rx="2"/>
<path class="sp-in-wire" d="M156 13V43"/>
<circle class="sp-in-photon" data-in-photon cx="10" cy="48" r="2.4" opacity="0"/>
<text class="sp-in-text" x="14" y="62">laser in</text>
<text class="sp-in-text" x="62" y="62">ring</text>
<text class="sp-in-text" x="104" y="62">fibre</text>
<text class="sp-in-text" x="148" y="62">photodiode</text>
<text class="sp-in-text" x="88" y="11">driver</text>
<text class="sp-in-text" x="176" y="11">TIA</text>
<path class="sp-in-axis" d="M10 80V122H210"/>
<path class="sp-in-level" d="M10 84H210M10 96H210M10 108H210M10 120H210"/>
<path class="sp-in-trace" data-in-trace d="M10 120"/>
<text class="sp-in-text" x="14" y="77">light out · PAM4 · 4 levels</text>
</g>
<g data-compare opacity="0">
<text class="sp-in-text" x="10" y="14">one 1.6 Tb/s port</text>
<rect class="sp-in-bar-cpo" x="118" y="7" width="9" height="7" rx="1.5"/><text class="sp-in-key" x="131" y="14">CPO</text>
<rect class="sp-in-bar-plug" x="160" y="7" width="9" height="7" rx="1.5"/><text class="sp-in-key" x="173" y="14">pluggable</text>
<text class="sp-in-text" x="10" y="36">power, W</text>${bar(28, M.POWER.cpoW, barMax, "sp-in-bar-cpo")}${bar(37, M.POWER.pluggableW, barMax, "sp-in-bar-plug")}
<text class="sp-in-val" x="212" y="35" text-anchor="end">${M.POWER.cpoW}</text><text class="sp-in-val" x="212" y="44" text-anchor="end">${M.POWER.pluggableW}</text>
<text class="sp-in-text" x="10" y="66">pJ per bit</text>${bar(58, M.pjCpo, barMax, "sp-in-bar-cpo")}${bar(67, M.pjPluggable, barMax, "sp-in-bar-plug")}
<text class="sp-in-val" x="212" y="65" text-anchor="end">${M.fmt(M.pjCpo, 1)}</text><text class="sp-in-val" x="212" y="74" text-anchor="end">${M.fmt(M.pjPluggable, 1)}</text>
<text class="sp-in-text" x="10" y="96">loss, dB</text>${bar(88, M.POWER.cpoLossDb, barMax, "sp-in-bar-cpo")}${bar(97, M.POWER.pluggableLossDb, barMax, "sp-in-bar-plug")}
<text class="sp-in-val" x="212" y="95" text-anchor="end">${M.POWER.cpoLossDb}</text><text class="sp-in-val" x="212" y="104" text-anchor="end">${M.POWER.pluggableLossDb}</text>
<text class="sp-in-text" x="10" y="124">copper reach ${M.REACH.copperM} m · fibre ${M.REACH.smfM} m to ${M.fmt(M.REACH.smfLongM / 1000)} km</text>
</g>
</svg></div>`;

const controls = `<div class="sp-controls"><span class="sp-hint">Hover a part · Space plays the bit</span><span class="sp-live" aria-live="polite" data-live></span></div>`;
const stage = `<div class="sp-stage" tabindex="0" role="group" aria-label="Co-packaged optics switch package on a test board. Hover, or use the arrow keys, to pick a part; Space plays or pauses one bit's trip through it; Escape resets; the slider below steps through the path.">${svg}</div>`;
const caption = `A switch package of the class of NVIDIA's Quantum-X Photonics: one switch ASIC with ${M.QX.osas} detachable optical sub-assemblies of ${M.QX.enginesPerOsa} engines each, ${M.engines} engines at ${M.QX.engineTbps} Tb/s (${M.QX.lanesPerEngine} lanes of ${M.QX.laneGbps} Gb/s PAM4 each way), ${M.QX.asicTbps} Tb/s in all. Each engine is a photonic chip with an electronic chip stacked on it (TSMC ${M.COUPE.name}); micro-ring modulators write each bit onto steady light from the external laser sources (${M.ELS.lasers} lasers a module, ${M.ELS.txLanes} transmit lanes each), and photodiodes read it back. Each engine really has ${M.QX.txFibres} transmit, ${M.QX.rxFibres} receive and ${M.QX.laserFibres} laser fibres; one trunk per sub-assembly stands in for them. The layout, sizes, the number of laser modules, the loopback and the light's colour are illustrative (the light is infrared; the research ring in the lesson works near ${M.RING.wavelengthNm} nm). Power per 1.6 Tb/s port, from NVIDIA's GTC 2025 example for Spectrum-X Photonics, used here as representative: pluggable ${M.POWER.pluggableW} W, CPO ${M.POWER.cpoW} W; pJ/bit derived.`;
const scrub = `<span class="sp-scrub"><button type="button" class="sp-play" data-play aria-label="Play one bit"><span class="sp-play-icon" aria-hidden="true"></span><span data-play-text>Play</span></button><input type="range" class="sp-range" data-scrub min="0" max="1000" step="1" value="0" aria-label="One bit's path: 0 is the bit leaving the switch chip, 1000 is the comparison with a pluggable"><span class="sp-step" data-step>01 · ${M.STEPS[0].name}</span></span>`;
const figure = `<figure class="iso-figure sp"><div class="iso-plate">${corners}${inset}${stage}${controls}</div><figcaption class="iso-legend">${scrub}<span class="sp-parts">${PARTS}</span><span class="iso-caption">${caption}</span></figcaption></figure>`;

const CSS = readFileSync(join(HERE, "silicon-photonics.css"), "utf8");
const LIVE = readFileSync(join(HERE, "live.js"), "utf8").replace("__DATA__", JSON.stringify(DATA));
const out = writeChapter({ slug: "silicon-photonics", figure, css: CSS, script: LIVE, lesson: LESSON });
console.log("wrote", out.file, `${out.kb} KB`, `${R.items.length} items`, `${R.solids.length} solids`);

A.auditOrExit(R, P);
