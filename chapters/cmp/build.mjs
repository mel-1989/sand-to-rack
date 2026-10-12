// A single-platen CMP polisher with a brush cleaner, drawn in world units of about 1.25 mm.
// node build.mjs [--audit] [--fast]
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as M from "./model.mjs";
import { k, G, A, Tube } from "../../site/kit.mjs";
import { kitScript } from "../../site/kit.mjs";
import { writeChapter } from "../../site/shell.mjs";
import { LESSON } from "./lesson.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const W = 720;
const H = 500;
const AZIMUTH = 45;
const ELEVATION = 30;

// ---- layout (illustrative; the wafer is 300 mm across, everything else is drawn to look right beside it) ----
const WAFER_R = 40;
const WAFER_T = 1.2;
const PLATE = { x: -290, y: -172, w: 520, d: 404, r: 12 };
const PLATE_H = 14;
const FOOT_H = 7;

const PLATEN = [0, 0];
const PLATEN_R = 100;
const PAD_R = 98;
const PAD_TOP = 19;

const HX = -45; // head centre when it is pressed on the pad
const DX = -140; // carriage travel to the load cup
const LIFT = 30; // head lift
const HEAD = [HX, 0];
const RING_R = 46;
const RING_TOP = 24;
const BODY_R = 44;
const BODY_TOP = 32;
const UPPER_R = 36;
const UPPER_TOP = 42;
const PLATE_R = 26;
const PLATE_TOP = 46;
const HUB_R = 12;
const HUB_TOP = 50;
const ROD_R = 7;
const ROD_TOP = 105;
const HOUSING = { bottom: 104, collar: 112, collarTop: 118, top: 138, r: 16, collarR: 30 };
const CARRIAGE = { x: HX - 24, y: -20, w: 48, d: 40, r: 3 };
const CARRIAGE_Z = [138, 156];
const BEAM = { x: -266, y: -12, w: 484, d: 24, r: 2 };
const BEAM_Z = [160, 176];
const RAIL = { x: -228, y: -5, w: 406, d: 10, r: 1 };
const COLUMNS = [{ x: -262, y: -14, w: 28, d: 28, r: 3 }, { x: 186, y: -14, w: 28, d: 28, r: 3 }];
const VALVE = { x: HX - 12, y: 20, w: 24, d: 9, r: 1.5 };
const LINES_X = [HX - 6, HX, HX + 6];
const LINE_Y = 24.5;

const CUP = [HX + DX, 0];
const CUP_STROKE = 20;
const CUP_POST_TOP = 20;
const PED = { z: 25, top: 29, r: 28 };

const SLURRY_POST = [5, -140];
const ARM = { x: -3, y: -146, w: 16, d: 116, r: 3 };
const ARM_Z = [40, 47];
const BRACKET = { x: -1, y: -31, w: 12, d: 8, r: 1 };
const BRACKET_Z = [33, 40];
const NOZZLES = [1.5, 8.5];
const NOZZLE_Y = -27;
const NOZZLE_TIP = 25;

const PIVOT = [140, -20];
const COND_L = 100;
const COND = { armZ: [40, 48], armW: 12, discR: 12, discTop: 22, carrierTop: 26, neckR: 5, capR: 7, capTop: 55 };
const SWEEP = { park: 122, from: 176, to: 208 };

const CLEAN = { tray: { x: 128, y: 80, w: 76, d: 122, r: 4 }, trayTop: 10, cx: 166, cy: 141, cz: 56, rollR: 10, y0: 93, y1: 189, blockTop: 66 };
const TUB = { x: -118, y: -118, w: 236, d: 236, wall: 6, top: 12 };

const MOVES = { stand: [0, 0, 0], carriage: [DX, 0, 0], head: [DX, 0, LIFT], cup: [0, 0, CUP_STROKE] };

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), ...k.boxCorners(BEAM, BEAM_Z[0], BEAM_Z[1] + 4)],
  W,
  H,
  { pad: 26, azimuth: AZIMUTH, elevation: ELEVATION },
);
const V = G.viewOf(P);
const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const up = (o) => G.frameOf(o, [0, 0, 1], [1, 0, 0], [0, 1, 0]);

const R = A.recorder(P, { order: ["carriage", "head", "cup"], spring: {} });
function put(piece, part, ref, svg, shapes, { bias = 0, name, extra = {} } = {}) {
  const id = name ?? R.nameFor(`${part}.item`);
  shapes.forEach((shape) => (shape.name = shape.name ?? id));
  return R.put({ piece, part, at: ref, bias, svg, move: MOVES[piece], shapes: shapes.map(R.solid), name: id, ...extra });
}
// a round puck standing on the floor axis: drawn and recorded together
function puck(x, y, r, z, h, style = {}, { steps, bevel = 0, inner = "" } = {}) {
  return { svg: S(k.cylinder(x, y, r, z, h, P, steps ?? Math.max(20, Math.round(r * 2.2)), bevel), { tone: "mid", ...style, inner }), shape: A.cylinder(x, y, r, z, h, {}) };
}
function box(plan, z, h, style = {}, { steps = 3, bevel = 0, inner = "" } = {}) {
  return { svg: S(k.slabOf(plan, z, h, P, steps, bevel), { tone: "mid", ...style, inner }), shape: A.slab(plan, z, h, {}, steps) };
}
function tube(piece, part, name, route, r, { tone = "hi", maxLength = 20, ends, rims } = {}) {
  const id = R.nameFor(name);
  R.route(id, route, r, { piece, move: MOVES[piece], ends, rims });
  Tube.tubePieces(route, r, P, { maxLength }).forEach((chunk, index) => put(piece, part, chunk.mid, Tube.tubeSvg(chunk, { tone }), [A.tube(chunk.points, chunk.radii, { owner: id })], { name: `${id}:${index}`, extra: { route: id, chunk: index } }));
}

// ---- base: deck on feet, groove, screws, ruler and label plate ----
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
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.6, 0, P, 16)).join(""), { tone: "lo" }), Dots(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // drain grate in the deck beside the platen: closed slots
  const slots = [];
  for (let i = 0; i < 6; i++) slots.push(k.planOutline({ x: -108 + i * 9, y: 128, w: 5, d: 40, r: 2.4 }, 0, P, 3));
  out.push(L(k.planOutline({ x: -114, y: 122, w: 60, d: 52, r: 3 }, 0, P, 3), { tone: "lo" }), L(slots.join(""), { tone: "faint" }));
  // ruler strip along the front edge: 10 mm minor, 50 mm major (1 unit = 1.25 mm)
  const strip = { x: -262, y: PLATE.y + PLATE.d - 22, w: 200, d: 9, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 8, 5, strip.y + 0.8, 0.6, [2.4, 4.4], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(Dots([at([strip.x + 2, strip.y + 4.5, 0.6]), at([strip.x + strip.w - 2, strip.y + 4.5, 0.6])], { size: 0.45 }));
  // label plate
  const label = { x: -40, y: PLATE.y + PLATE.d - 30, w: 80, d: 18, r: 1.5 };
  out.push(S(k.slabOf(label, 0, 0.8, P, 4), { tone: "lo", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.8), 0.8, P, 4), { tone: "faint" }));
  out.push(L([0, 1, 2].map((i) => k.lineOnTop([label.x + 9, label.y + 5.5 + i * 3.4], [label.x + 62 - i * 15, label.y + 5.5 + i * 3.4], 0.8, P)).join(""), { tone: "lo", free: true }));
  out.push(Dots([at([label.x + 4.5, label.y + label.d / 2, 0.8]), at([label.x + label.w - 4.5, label.y + label.d / 2, 0.8])], { size: 0.45 }));
  put("stand", "stand", [0, 0, -1], out.join(""), shapes, { name: "stand.base", bias: -800 });
}

// ---- bridge: two columns, a beam and a linear rail ----
function bridge() {
  COLUMNS.forEach((col, i) => {
    const foot = k.insetPlan(col, -5);
    const a = box(foot, 0, 4, {}, { steps: 4, bevel: 0.5 });
    const b = box(col, 4, BEAM_Z[0] - 4, {}, { steps: 4, bevel: 0, inner: L([30, 120].map((z) => k.sideSeam(col, z, P, 4)).join(""), { tone: "faint" }) });
    const bolts = Dots(k.corners(foot, 3.2).map(([x, y]) => at([x, y, 4])), { size: 0.5 });
    put("stand", "stand", [col.x + col.w / 2, col.y + col.d / 2, 60], a.svg + bolts + b.svg, [a.shape, b.shape], { name: `stand.column${i}` });
  });
  const beam = box(BEAM, BEAM_Z[0], BEAM_Z[1] - BEAM_Z[0], {}, { steps: 3, bevel: 0.8, inner: L(k.sideSeam(BEAM, BEAM_Z[0] + 5, P, 3), { tone: "faint" }) });
  const caps = COLUMNS.flatMap((c) => k.corners(c, 5)).map(([x, y]) => at([x, y, BEAM_Z[1]]));
  const groove = L(k.planOutline(k.insetPlan(BEAM, 4), BEAM_Z[1], P, 3), { tone: "faint" });
  put("stand", "stand", [-50, 0, BEAM_Z[0]], beam.svg + groove + Dots(caps, { size: 0.5 }), [beam.shape], { name: "stand.beam" });
  const rail = box(RAIL, BEAM_Z[0] - 4, 4, { tone: "lo" }, { steps: 2 });
  put("stand", "stand", [-50, 0, BEAM_Z[0] - 2], rail.svg, [rail.shape], { name: "stand.rail" });
  for (const x of [RAIL.x - 6, RAIL.x + RAIL.w]) { // stops at both rail ends, under the beam
    const stop = box({ x, y: -8, w: 6, d: 16, r: 1 }, BEAM_Z[0] - 9, 9, {}, { steps: 2 });
    put("stand", "stand", [x + 3, 0, BEAM_Z[0] - 5], stop.svg, [stop.shape], { name: R.nameFor("stand.stop") });
  }
}

// ---- carriage: block on the rail, valve block, spindle housing and zone lines ----
function carriage() {
  const c = box(CARRIAGE, CARRIAGE_Z[0], CARRIAGE_Z[1] - CARRIAGE_Z[0], {}, { steps: 3, bevel: 0.6, inner: L(k.sideSeam(CARRIAGE, CARRIAGE_Z[0] + 6, P, 3), { tone: "faint" }) });
  put("carriage", "head", [HX, 0, CARRIAGE_Z[0]], c.svg, [c.shape], { name: "carriage.block" });
  const v = box(VALVE, 140, 14, {}, { steps: 2, bevel: 0.4, inner: L(k.sideSeam(VALVE, 147, P, 2), { tone: "faint" }) });
  const screws = Dots([[VALVE.x + 3, VALVE.y + 4.5], [VALVE.x + VALVE.w - 3, VALVE.y + 4.5]].map(([x, y]) => at([x, y, 154])), { size: 0.45 });
  put("carriage", "head", [HX, 24, 147], v.svg + screws, [v.shape], { name: "carriage.valves" });
  const F = up([HX, 0, 0]);
  const H = HOUSING;
  const housing =
    S(G.disc(H.bottom, H.collar, H.r, F, P), { tone: "mid" }) +
    S(G.disc(H.collar, H.collarTop, H.collarR, F, P, { bevel: 0.5 }), { tone: "mid" }) +
    Dots(G.dotsOf(F, H.collarTop, H.collarR - 3.5, 12, P, { all: true }).filter((p, i) => i % 3 !== 1), { size: 0.45 }) +
    S(G.disc(H.collarTop, H.top, H.r, F, P), { tone: "mid", inner: L(G.arcOf(F, 128, H.r, P), { tone: "faint" }) });
  // one turned body with the spindle bore, closed at the top by the bearing cap
  const bore = ROD_R + 0.6;
  const poly = [[H.bottom, bore], [H.bottom, H.r], [H.collar, H.r], [H.collar, H.collarR], [H.collarTop, H.collarR], [H.collarTop, H.r], [H.top, H.r], [H.top, 0], [H.top - 2, 0], [H.top - 2, bore]];
  put("carriage", "head", [HX, 0, 120], housing, [A.body(F, poly, {})], { name: "carriage.housing" });
  // gland ring on the housing's bottom face, seen from below is hidden; a seal band instead
  LINES_X.forEach((x, i) => {
    const port = puck(x, LINE_Y, 1.8, HOUSING.collarTop, 1.4, {}, { steps: 14 });
    put("carriage", "head", [x, LINE_Y, HOUSING.collarTop + 0.7], port.svg, [port.shape], { name: `carriage.port${i}` });
    tube("carriage", "head", `carriage.zone${i}`, [[x, LINE_Y, 140], [x, LINE_Y, HOUSING.collarTop + 1.4]], 0.9, { tone: "mid", maxLength: 30 });
  });
}

// ---- carrier head: retaining ring, base, housing, plate, hub and spindle ----
let ROD_CLIP = "";
function head() {
  const F = up([HX, 0, 0]);
  const parts = [
    [PAD_TOP, RING_TOP, RING_R, "head.ring", "mid"],
    [RING_TOP, BODY_TOP, BODY_R, "head.body", "hi"],
    [BODY_TOP, UPPER_TOP, UPPER_R, "head.upper", "mid"],
    [UPPER_TOP, PLATE_TOP, PLATE_R, "head.plate", "hi"],
    [PLATE_TOP, HUB_TOP, HUB_R, "head.hub", "mid"],
  ];
  for (const [s0, s1, r, name, tone] of parts) {
    let extra = "";
    if (name === "head.ring") extra = L(G.arcOf(F, 21.5, r, P), { tone: "faint" });
    if (name === "head.upper") extra = L(G.arcOf(F, 37, r, P), { tone: "faint" });
    const svg = S(G.disc(s0, s1, r, F, P, { bevel: name === "head.body" ? 0.6 : 0 }), { tone, crease: tone === "hi" ? "lo" : "faint", inner: extra });
    let top = "";
    if (name === "head.plate") top = L(k.ring(HX, 0, PLATE_R - 3, PLATE_TOP, P, 64), { tone: "lo" });
    if (name === "head.hub") top = L(k.ring(HX, 0, ROD_R + 1.6, HUB_TOP, P, 32), { tone: "lo" });
    const live = name === "head.body" || name === "head.plate" ? `<g data-spin="${name}"></g>` : "";
    const shapes = name === "head.ring" ? [A.ring(F, s0, s1, WAFER_R + 2, r, {}), A.disc(F, PAD_TOP + WAFER_T, s1, WAFER_R + 2, {})] : [A.disc(F, s0, s1, r, {})];
    put("head", "head", [HX, 0, (s0 + s1) / 2], svg + top + live, shapes, { name });
  }
  // spindle: drawn at full length, clipped where it enters the housing; the clip moves with the carriage
  const rod = S(G.disc(HUB_TOP, ROD_TOP, ROD_R, F, P), { tone: "hi", crease: "lo", inner: L(G.arcOf(F, 60, ROD_R, P), { tone: "faint" }) });
  const lo = at([HX, 0, HOUSING.bottom]);
  const half = (ROD_R + 2) * P.scale;
  ROD_CLIP = `M${(lo[0] - half - 4).toFixed(1)} ${(lo[1] + 0).toFixed(1)}L${(lo[0] + half + 4).toFixed(1)} ${lo[1].toFixed(1)}L${(lo[0] + half + 4).toFixed(1)} ${(lo[1] + 400).toFixed(1)}L${(lo[0] - half - 4).toFixed(1)} ${(lo[1] + 400).toFixed(1)}Z`;
  const svg = `<clipPath id="cmp-rod"><path data-hold d="${ROD_CLIP}"/></clipPath><g clip-path="url(#cmp-rod)">${rod}</g>`;
  put("head", "head", [HX, 0, 78], svg, [A.disc(F, HUB_TOP, ROD_TOP, ROD_R, {})], { name: "head.rod" });
}

// ---- platen: drive collar, platen, pad with grooves and endpoint window ----
function platen() {
  const [x, y] = PLATEN;
  const collar = puck(x, y, 64, 0, 5, { tone: "lo" }, { steps: 80 });
  put("stand", "platen", [x, y, 2], collar.svg + Dots(G.dotsOf(up([x, y, 0]), 5, 58, 16, P, { all: true }), { size: 0.5 }), [collar.shape], { name: "platen.collar" });
  const body = puck(x, y, PLATEN_R, 5, 11, {}, { steps: 120, bevel: 0.8, inner: L(k.sideArc(x, y, PLATEN_R, 9, P, 96), { tone: "faint" }) });
  put("stand", "platen", [x, y, 10], body.svg + `<g data-spin="platen.side"></g>`, [body.shape], { name: "platen.body" });
  const grooves = [];
  for (let r = 16; r < PAD_R - 4; r += 9) grooves.push(k.ring(x, y, r, PAD_TOP, P, Math.round(r * 1.4)));
  const pad = puck(x, y, PAD_R, 16, PAD_TOP - 16, { tone: "hi", crease: "lo" }, { steps: 120 });
  const hub = L(k.ring(x, y, 5, PAD_TOP, P, 24), { tone: "lo" });
  put("stand", "platen", [x, y, 17], pad.svg + L(grooves.join(""), { tone: "faint" }) + hub + `<g data-wet></g><g data-spin="pad"></g>`, [pad.shape], { name: "platen.pad" });
}

// ---- load cup: base, post, piston, pedestal and the incoming wafer ----
function cup() {
  const [x, y] = CUP;
  const b = puck(x, y, 34, 0, 4, {}, { steps: 48, bevel: 0.5 });
  const p = puck(x, y, 12, 4, CUP_POST_TOP - 4, {}, { steps: 32, inner: L(k.sideArc(x, y, 12, 12, P, 24), { tone: "faint" }) });
  const ring = L(k.ring(x, y, 7, CUP_POST_TOP, P, 24), { tone: "lo" });
  const screws = Dots([0, 1, 2, 3, 4, 5].map((i) => at([x + 28 * Math.cos((i * Math.PI) / 3), y + 28 * Math.sin((i * Math.PI) / 3), 4])), { size: 0.45 });
  put("stand", "cup", [x, y, 8], b.svg + screws + p.svg + ring, [b.shape, p.shape], { name: "cup.post" });
  const F = up([x, y, 0]);
  const rod = G.rodOut(F, CUP_POST_TOP, PED.z, 5, P, { stroke: CUP_STROKE });
  const rodSvg = `<clipPath id="cmp-cuprod"><path data-hold d="${rod.clip}"/></clipPath><g clip-path="url(#cmp-cuprod)">${S(rod.paths, { tone: "hi", crease: "lo" })}</g>`;
  put("cup", "cup", [x, y, CUP_POST_TOP + 2], rodSvg, [A.slide(F, CUP_POST_TOP, PED.z, 5, {})], { name: "cup.rod" });
  const ped = puck(x, y, PED.r, PED.z, PED.top - PED.z, {}, { steps: 56, bevel: 0.5 });
  const pads = Dots([0, 1, 2].map((i) => at([x + 22 * Math.cos((i * 2 * Math.PI) / 3 + 0.5), y + 22 * Math.sin((i * 2 * Math.PI) / 3 + 0.5), PED.top])), { size: 0.6 });
  put("cup", "cup", [x, y, PED.z + 2], ped.svg + L(k.ring(x, y, PED.r - 4, PED.top, P, 48), { tone: "faint" }) + pads, [ped.shape], { name: "cup.pedestal" });
  const wafer = puck(x, y, WAFER_R, PED.top, WAFER_T, { tone: "hi", crease: "lo", lit: true }, { steps: 96 });
  const notch = L(k.ring(x, y, WAFER_R - 3, PED.top + WAFER_T, P, 72), { tone: "faint" });
  put("cup", "cup", [x, y, PED.top + 0.6], `<g data-wafer="cup">${wafer.svg}${notch}</g>`, [wafer.shape], { name: "cup.wafer" });
}

// ---- slurry arm: post, arm, feed block, two lines and nozzles ----
function slurry() {
  const [x, y] = SLURRY_POST;
  const f = puck(x, y, 11, 0, 3, {}, { steps: 32, bevel: 0.4 });
  const p = puck(x, y, 6, 3, ARM_Z[0] - 3, {}, { steps: 24, inner: L(k.sideArc(x, y, 6, 20, P, 16), { tone: "faint" }) });
  const bolts = Dots([0, 1, 2, 3].map((i) => at([x + 8.4 * Math.cos(i * Math.PI / 2 + 0.78), y + 8.4 * Math.sin(i * Math.PI / 2 + 0.78), 3])), { size: 0.45 });
  put("stand", "slurry", [x, y, 10], f.svg + bolts + p.svg, [f.shape, p.shape], { name: "slurry.post" });
  const arm = box(ARM, ARM_Z[0], ARM_Z[1] - ARM_Z[0], {}, { steps: 3, bevel: 0.5, inner: L(k.sideSeam(ARM, ARM_Z[0] + 2.4, P, 3), { tone: "faint" }) });
  const feed = { x: -2, y: -142, w: 14, d: 9, r: 1.2 };
  const front = { x: -2, y: -38, w: 14, d: 8, r: 1.2 };
  arm.shape.owner = "slurry.arm";
  put("stand", "slurry", [ARM.x + 8, ARM.y + 58, ARM_Z[0]], arm.svg + Dots([at([x, y, ARM_Z[1]]), at([x, ARM.y + ARM.d - 14, ARM_Z[1]])], { size: 0.5 }), [arm.shape], { name: "slurry.arm" });
  for (const [plan, name] of [[feed, "slurry.feed"], [front, "slurry.manifold"]]) {
    const blk = box(plan, ARM_Z[1], 8, {}, { steps: 2, bevel: 0.3, inner: L(k.sideSeam(plan, ARM_Z[1] + 4, P, 2), { tone: "faint" }) });
    blk.shape.owner = "slurry.arm";
    put("stand", "slurry", [5, plan.y + plan.d / 2, ARM_Z[1] + 4], blk.svg + Dots([at([plan.x + 3, plan.y + plan.d / 2, ARM_Z[1] + 8]), at([plan.x + plan.w - 3, plan.y + plan.d / 2, ARM_Z[1] + 8])], { size: 0.45 }), [blk.shape], { name });
  }
  const br = box(BRACKET, BRACKET_Z[0], BRACKET_Z[1] - BRACKET_Z[0], {}, { steps: 2, bevel: 0.3 });
  put("stand", "slurry", [5, -27, 36], br.svg, [br.shape], { name: "slurry.bracket" });
  NOZZLES.forEach((nx, i) => {
    const body = puck(nx, NOZZLE_Y, 2, 28, BRACKET_Z[0] - 28, {}, { steps: 16 });
    const tip = puck(nx, NOZZLE_Y, 1.1, NOZZLE_TIP, 3, { tone: "hi", crease: "lo" }, { steps: 12 });
    put("stand", "slurry", [nx, NOZZLE_Y, 29], tip.svg + body.svg + `<g data-stream="${i}"></g>`, [tip.shape, body.shape], { name: `slurry.nozzle${i}` });
    const zc = ARM_Z[1] + 4;
    tube("stand", "slurry", `slurry.line${i}`, [[nx, feed.y + feed.d, zc], [nx, front.y, zc]], 1.4, { tone: i ? "mid" : "hi", maxLength: 24 });
  });
}

// ---- pad conditioner: sweep housing, arm, disc head (the arm is redrawn live as it sweeps) ----
const condAt = (deg) => {
  const a = (deg * Math.PI) / 180;
  return [PIVOT[0] + COND_L * Math.cos(a), PIVOT[1] + COND_L * Math.sin(a)];
};
// Shared with the page: builds the moving part of the conditioner at a sweep angle.
function condParts(deg, k, P, C, piv, len) {
  const a = (deg * Math.PI) / 180;
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  const d = [piv[0] + len * ux, piv[1] + len * uy];
  const hw = C.armW / 2;
  const tail = -8;
  const head = len + 9;
  const ring = [[tail, -hw], [head, -hw], [head, hw], [tail, hw]].map(([s, t]) => [piv[0] + s * ux - t * uy, piv[1] + s * uy + t * ux]);
  const S = (p, o) => k.solidSvg(p, o);
  const disc = S(k.cylinder(d[0], d[1], C.discR, 19, C.discTop - 19, P, 40), { tone: "hi", crease: "lo" });
  const carrier = S(k.cylinder(d[0], d[1], C.discR + 0.6, C.discTop, C.carrierTop - C.discTop, P, 40, 0.4), { tone: "mid" });
  const neck = S(k.cylinder(d[0], d[1], C.neckR, C.carrierTop, C.armZ[0] - C.carrierTop, P, 20), { tone: "mid", crease: "none" });
  const arm = S(k.extrude(ring, C.armZ[0], C.armZ[1] - C.armZ[0], P, { bevel: 0.5 }), { tone: "mid" });
  const cap = S(k.cylinder(d[0], d[1], C.capR, C.armZ[1], C.capTop - C.armZ[1], P, 24, 0.4), { tone: "mid" });
  const capRing = k.lineSvg(k.ring(d[0], d[1], C.capR - 2.2, C.capTop, P, 20), { tone: "lo" });
  const dots = k.dotsSvg([piv, [piv[0] + (len - 14) * ux, piv[1] + (len - 14) * uy]].map(([x, y]) => k.iso([x, y, C.armZ[1]], P)), { size: 0.5 });
  return { d, ring, svg: disc + carrier + neck + arm + dots + cap + capRing };
}
function conditioner() {
  const [x, y] = PIVOT;
  const f = puck(x, y, 19, 0, 3, {}, { steps: 40, bevel: 0.4 });
  const b = puck(x, y, 14, 3, 31, {}, { steps: 36, inner: L([12, 26].map((z) => k.sideArc(x, y, 14, z, P, 28)).join(""), { tone: "faint" }) });
  const c = puck(x, y, 10, 34, COND.armZ[0] - 34, {}, { steps: 28 });
  const bolts = Dots([0, 1, 2, 3, 4, 5].map((i) => at([x + 16.5 * Math.cos((i * Math.PI) / 3), y + 16.5 * Math.sin((i * Math.PI) / 3), 3])), { size: 0.45 });
  put("stand", "cond", [x, y, 16], f.svg + bolts + b.svg + c.svg, [f.shape, b.shape, c.shape], { name: "cond.housing" });
  // the swept arm: recorded at every 6 degrees of its travel so depth and clearance hold at any angle
  const shapes = [];
  for (let deg = SWEEP.park; deg <= SWEEP.to + 0.01; deg += 4) {
    const p = condParts(deg, k, P, COND, PIVOT, COND_L);
    const own = { owner: "cond.arm" };
    shapes.push(A.extruded(p.ring, COND.armZ[0], COND.armZ[1] - COND.armZ[0], { ...own }));
    shapes.push(A.cylinder(p.d[0], p.d[1], COND.discR + 0.6, 19, COND.carrierTop - 19, { ...own }));
    shapes.push(A.cylinder(p.d[0], p.d[1], COND.neckR, COND.carrierTop, COND.armZ[0] - COND.carrierTop, { ...own }));
    shapes.push(A.cylinder(p.d[0], p.d[1], COND.capR, COND.armZ[1], COND.capTop - COND.armZ[1], { ...own }));
  }
  const rest = condParts(SWEEP.park, k, P, COND, PIVOT, COND_L);
  const [dx, dy] = condAt((SWEEP.park + SWEEP.to) / 2);
  put("stand", "cond", [dx, dy, 30], `<g data-cond>${rest.svg}</g>`, shapes, { name: "cond.arm" });
}

// ---- brush cleaner: tray, end blocks, two PVA rollers, the wafer standing between them ----
function cleaner() {
  const C = CLEAN;
  const tray = box(C.tray, 0, C.trayTop, {}, { steps: 4, bevel: 0.6, inner: L(k.sideSeam(C.tray, 4, P, 4), { tone: "faint" }) });
  const drain = L(k.planOutline(k.insetPlan(C.tray, 4), C.trayTop, P, 4), { tone: "lo" });
  put("stand", "clean", [C.cx, C.cy, 5], tray.svg + drain + Dots(k.corners(C.tray, 4).map(([x, y]) => at([x, y, C.trayTop])), { size: 0.45 }), [tray.shape], { name: "clean.tray" });
  const blocks = [{ x: C.cx - 18, y: C.y0 - 7, w: 36, d: 7, r: 1.2 }, { x: C.cx - 18, y: C.y1, w: 36, d: 7, r: 1.2 }];
  blocks.forEach((plan, i) => {
    const b = box(plan, C.trayTop, C.blockTop - C.trayTop, {}, { steps: 2, bevel: 0.5, inner: L(k.sideSeam(plan, 20, P, 2), { tone: "faint" }) });
    put("stand", "clean", [C.cx, plan.y + 3.5, 38], b.svg + Dots([at([plan.x + 4, plan.y + 3.5, C.blockTop]), at([plan.x + plan.w - 4, plan.y + 3.5, C.blockTop])], { size: 0.45 }), [b.shape], { name: `clean.block${i}` });
  });
  for (const side of [-1, 1]) {
    const x = C.cx + side * (C.rollR + 0.7);
    const F = G.frameOf([x, 0, C.cz], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
    const svg = S(G.disc(C.y0, C.y1, C.rollR, F, P), { tone: "hi", crease: "lo" });
    put("stand", "clean", [x, C.cy, C.cz], svg + `<g data-roll="${side}"></g>`, [A.disc(F, C.y0, C.y1, C.rollR, {})], { name: `clean.roller${side < 0 ? 0 : 1}` });
  }
  // drive wheels under the wafer edge, on small posts
  for (const dy of [-22, 22]) {
    const zc = C.cz - Math.sqrt((WAFER_R + 5) ** 2 - dy * dy);
    const F = G.frameOf([C.cx - 1.5, C.cy + dy, zc], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
    const wheel = S(G.disc(0, 3, 5, F, P), { tone: "mid" });
    const post = box({ x: C.cx - 3, y: C.cy + dy - 2, w: 6, d: 4, r: 0.8 }, C.trayTop, zc - 5 - C.trayTop, {}, { steps: 2 });
    put("stand", "clean", [C.cx, C.cy + dy, zc], post.svg + wheel, [post.shape, A.disc(F, 0, 3, 5, {})], { name: R.nameFor("clean.wheel") });
  }
  const F = G.frameOf([C.cx - WAFER_T / 2, C.cy, C.cz], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
  const wafer = S(G.disc(0, WAFER_T, WAFER_R, F, P), { tone: "hi", crease: "lo", lit: true });
  put("stand", "clean", [C.cx, C.cy, C.cz], `<g data-wafer="clean">${wafer}</g>`, [A.disc(F, 0, WAFER_T, WAFER_R, {})], { name: "clean.wafer" });
}


// ---- splash basin round the platen: four walls, so the far ones sort behind the platen and the near ones in front ----
function basin() {
  const T = TUB;
  const walls = [
    ["north", { x: T.x, y: T.y, w: T.w, d: T.wall, r: 1.2 }],
    ["south", { x: T.x, y: T.y + T.d - T.wall, w: T.w, d: T.wall, r: 1.2 }],
    ["west", { x: T.x, y: T.y + T.wall, w: T.wall, d: T.d - 2 * T.wall, r: 0.4 }],
    ["east", { x: T.x + T.w - T.wall, y: T.y + T.wall, w: T.wall, d: T.d - 2 * T.wall, r: 0.4 }],
  ];
  for (const [side, plan] of walls) {
    const w = box(plan, 0, T.top, {}, { steps: 2, bevel: 0.4, inner: L(k.sideSeam(plan, 4, P, 2), { tone: "faint" }) });
    const long = plan.w > plan.d;
    const bolts = [0.2, 0.5, 0.8].map((f) => at(long ? [plan.x + plan.w * f, plan.y + plan.d / 2, T.top] : [plan.x + plan.w / 2, plan.y + plan.d * f, T.top]));
    put("stand", "platen", [plan.x + plan.w / 2, plan.y + plan.d / 2, 6], w.svg + Dots(bolts, { size: 0.45 }), [w.shape], { name: `platen.basin-${side}` });
  }
}

// ---- front-end load port with a closed FOUP: wafers arrive dry and leave dry ----
function loadPort() {
  const stagePlan = { x: -244, y: 104, w: 84, d: 76, r: 3 };
  const st = box(stagePlan, 0, 6, {}, { steps: 3, bevel: 0.6, inner: L(k.sideSeam(stagePlan, 3, P, 3), { tone: "faint" }) });
  const pins = Dots([[-222, 128], [-182, 128], [-202, 162]].map(([x, y]) => at([x, y, 6])), { size: 0.6 });
  put("stand", "port", [-202, 142, 3], st.svg + pins + Dots(k.corners(stagePlan, 3).map(([x, y]) => at([x, y, 6])), { size: 0.45 }), [st.shape], { name: "port.port" });
  const shell = { x: -234, y: 112, w: 64, d: 62, r: 6 };
  const f = box(shell, 6, 50, { tone: "mid" }, { steps: 6, bevel: 0.8, inner: L([16, 46].map((z) => k.sideSeam(shell, z, P, 6)).join(""), { tone: "faint" }) });
  const flangePlan = { x: -212, y: 133, w: 20, d: 20, r: 2 };
  const neck = box({ x: -206, y: 139, w: 8, d: 8, r: 1 }, 56, 4, {}, { steps: 2 });
  const flange = box(flangePlan, 60, 3, {}, { steps: 2, bevel: 0.4 });
  const groove = L(k.planOutline(k.insetPlan(flangePlan, 3), 63, P, 2), { tone: "faint" });
  put("stand", "port", [-202, 143, 30], f.svg + L(k.planOutline(k.insetPlan(shell, 5), 56, P, 6), { tone: "lo" }), [f.shape], { name: "port.foup" });
  put("stand", "port", [-202, 143, 60], neck.svg + flange.svg + groove, [neck.shape, flange.shape], { name: "port.foup-flange" });
  const door = { x: -170, y: 118, w: 2, d: 50, r: 0.6 };
  const d = box(door, 12, 38, {}, { steps: 2, bevel: 0.3 });
  const keys = L([131, 155].map((y) => k.sideRing([-168, y, 31], 2.4, "x", P, 20)).join(""), { tone: "lo" });
  put("stand", "port", [-169, 143, 31], d.svg + keys, [d.shape], { name: "port.door" });
}

// ---- around the machine: slurry supply, signal tower, travel motor ----
function extras() {
  const cab = { x: -16, y: -168, w: 42, d: 15, r: 2 };
  const c = box(cab, 0, 24, {}, { steps: 3, bevel: 0.6, inner: L(k.sideSeam(cab, 8, P, 3), { tone: "faint" }) });
  const top = L(k.planOutline(k.insetPlan(cab, 3), 24, P, 3), { tone: "faint" });
  const screws = Dots(k.corners(cab, 2.4).map(([x, y]) => at([x, y, 24])), { size: 0.45 });
  put("stand", "slurry", [5, -158, 12], c.svg + top + screws, [c.shape], { name: "slurry.cabinet" });
  NOZZLES.forEach((x, i) => {
    const fit = puck(x, -156, 2.4, 24, 2, {}, { steps: 16 });
    put("stand", "slurry", [x, -156, 25], fit.svg, [fit.shape], { name: `slurry.fitting${i}` });
    const route = G.fillet([[x, -142, 51], [x, -156, 51], [x, -156, 26]], 4, 10, { P, tube: 1.4 });
    tube("stand", "slurry", `slurry.hose${i}`, route, 1.4, { tone: "lo", maxLength: 16 });
  });
  // stack light on the beam's right end; its top lamp lights at endpoint
  const [lx, ly] = [200, 0];
  let z = BEAM_Z[1];
  const lamp = [];
  const shapes = [];
  const seg = (r, h, tone, extra = {}) => {
    const p = puck(lx, ly, r, z, h, { tone, ...extra }, { steps: 24 });
    lamp.push(p.svg);
    shapes.push(p.shape);
    z += h;
  };
  seg(6, 2.4, "mid");
  seg(2, 6, "mid", { crease: "none" });
  seg(4.4, 5, "lo");
  seg(4.4, 5, "mid");
  seg(4.4, 5, "hi", { crease: "lo" });
  seg(4.8, 1.6, "mid");
  put("stand", "stand", [lx, ly, BEAM_Z[1] + 12], lamp.join(""), shapes, { name: "stand.lamp" });
  // travel motor on the beam's end face
  const F = G.frameOf([BEAM.x + BEAM.w, 0, (BEAM_Z[0] + BEAM_Z[1]) / 2], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
  const motor =
    S(G.disc(0, 2, 9.5, F, P), { tone: "mid" }) +
    S(G.disc(2, 20, 8, F, P), { tone: "mid", inner: L([6, 10, 14].map((sx) => G.arcOf(F, sx, 8, P)).join(""), { tone: "faint" }) }) +
    S(G.disc(20, 22, 6, F, P), { tone: "mid" });
  put("stand", "stand", [BEAM.x + BEAM.w + 11, 0, 168], motor, [A.disc(F, 0, 2, 9.5, {}), A.disc(F, 2, 20, 8, {}), A.disc(F, 20, 22, 6, {})], { name: "stand.motor" });
}

base();
bridge();
extras();
basin();
loadPort();
platen();
cup();
slurry();
conditioner();
cleaner();
carriage();
head();

// the poses the machine really takes: the head travels lifted and lowers over the pad; the cup rises only under the lifted head
const STATES = [];
for (let i = 0; i <= 20; i++) STATES.push({ label: `travel ${i / 20}`, shares: { carriage: i / 20, head: i / 20, cup: 0 } });
for (let i = 1; i <= 10; i++) STATES.push({ label: `cup ${i / 10}`, shares: { carriage: 1, head: 1, cup: i / 10 } });

if (!process.argv.includes("--fast")) A.settle(R, P, { states: STATES });
R.items.sort((a, b) => a.key - b.key);
const groups = R.items.map((item, index) => {
  const [mx, my, mz] = item.move;
  return `<g class="cmp-it" data-piece="${item.piece}" data-part="${item.part}" data-k="${item.key.toFixed(2)}" data-m="${mx},${my},${mz}" data-i="${index}">${item.svg}</g>`;
});

const LABEL = "A chemical mechanical polisher. A carrier head hangs from a carriage on an overhead beam; it picks a wafer off a load cup, carries it to a rotating platen covered with a polishing pad, and presses it face down while a slurry arm drips abrasive slurry and a diamond conditioner disc sweeps the pad. A load port with a closed wafer pod sits at the left. Beside the platen, a brush cleaner holds a wafer upright between two roller brushes.";
const svg = k.figureSvg({ width: W, height: H, label: LABEL, body: [`<g class="cmp-layers">${groups.join("")}</g>`], className: "cmp-svg" });

const vec = (v) => {
  const o = at([0, 0, 0]);
  const p = at(v);
  return [p[0] - o[0], p[1] - o[1]];
};
const PARTS_ORDER = ["platen", "head", "slurry", "cond", "cup", "port", "clean"];
const DATA = {
  P,
  V,
  EX: vec([1, 0, 0]),
  EY: vec([0, 1, 0]),
  EZ: vec([0, 0, 1]),
  DX,
  LIFT,
  CUP_STROKE,
  PLATEN,
  PAD_R,
  PAD_TOP,
  PLATEN_R,
  HEAD,
  BODY_R,
  BODY_TOP,
  PLATE_R,
  PLATE_TOP,
  WAFER_R,
  NOZZLES,
  NOZZLE_Y,
  NOZZLE_TIP,
  PIVOT,
  COND_L,
  COND,
  SWEEP,
  CLEAN,
  phases: M.PHASES,
  pieces: M.PIECES,
  order: PARTS_ORDER,
  idle: M.IDLE,
  rpm: { platen: M.PLATEN_RPM, head: M.HEAD_RPM, cond: M.REFLEXION.condRpm },
  bulkNm: M.BULK_NM,
  psi: M.REFLEXION.bulkPsi,
};

const legend = PARTS_ORDER.map((id, index) => `<button type="button" class="cmp-part" data-part="${id}"><span class="cmp-num">${String(index + 1).padStart(2, "0")}</span>${M.PIECES[id].name}</button>`).join("");
const corners = `<div class="iso-plate-corners" aria-hidden="true"><span class="iso-plate-corner" data-corner="fig">Fig 1</span><span class="iso-plate-corner" data-corner="title">CMP polisher · one platen</span><span class="iso-plate-corner" data-corner="readout" data-readout>${M.IDLE}</span></div>`;
const controls = `<div class="cmp-controls"><span class="cmp-hint">Hover a part · Space plays</span><span class="cmp-live" aria-live="polite" data-live></span></div>`;
const stage = `<div class="cmp-stage" tabindex="0" role="group" aria-label="CMP polisher. Hover, or use the arrow keys, to pick a part; Space plays or pauses the polish; Escape resets it; the slider below steps through the process.">${svg}</div>`;
const HEAD_CUT = `<svg viewBox="0 -16 300 60" class="cmp-cut" data-headcut><rect class="cmp-cut-pad" x="0" y="34" width="300" height="10"/><g class="cmp-cut-head"><rect class="cmp-cut-body" x="136" y="-6" width="28" height="8"/><rect class="cmp-cut-body" x="28" y="2" width="244" height="16" rx="2"/><rect class="cmp-cut-ring" x="28" y="18" width="14" height="16"/><rect class="cmp-cut-ring" x="258" y="18" width="14" height="16"/><rect class="cmp-cut-zone" data-zone="1" x="131" y="19.5" width="38" height="10" rx="1"/><path class="cmp-cut-arrow" d="M147.0 22.5L153.0 22.5L150.0 27Z"/><rect class="cmp-cut-zone" data-zone="2" x="107" y="19.5" width="22" height="10" rx="1"/><path class="cmp-cut-arrow" d="M115.0 22.5L121.0 22.5L118.0 27Z"/><rect class="cmp-cut-zone" data-zone="2" x="171" y="19.5" width="22" height="10" rx="1"/><path class="cmp-cut-arrow" d="M179.0 22.5L185.0 22.5L182.0 27Z"/><rect class="cmp-cut-zone" data-zone="3" x="85" y="19.5" width="20" height="10" rx="1"/><path class="cmp-cut-arrow" d="M92.0 22.5L98.0 22.5L95.0 27Z"/><rect class="cmp-cut-zone" data-zone="3" x="195" y="19.5" width="20" height="10" rx="1"/><path class="cmp-cut-arrow" d="M202.0 22.5L208.0 22.5L205.0 27Z"/><rect class="cmp-cut-zone" data-zone="4" x="65" y="19.5" width="18" height="10" rx="1"/><path class="cmp-cut-arrow" d="M71.0 22.5L77.0 22.5L74.0 27Z"/><rect class="cmp-cut-zone" data-zone="4" x="217" y="19.5" width="18" height="10" rx="1"/><path class="cmp-cut-arrow" d="M223.0 22.5L229.0 22.5L226.0 27Z"/><rect class="cmp-cut-zone" data-zone="5" x="47" y="19.5" width="16" height="10" rx="1"/><path class="cmp-cut-arrow" d="M52.0 22.5L58.0 22.5L55.0 27Z"/><rect class="cmp-cut-zone" data-zone="5" x="237" y="19.5" width="16" height="10" rx="1"/><path class="cmp-cut-arrow" d="M242.0 22.5L248.0 22.5L245.0 27Z"/><rect class="cmp-cut-membrane" x="44" y="29.5" width="212" height="1.6"/><rect class="cmp-cut-wafer" x="46" y="31.1" width="208" height="2.9"/></g></svg>`;
const inset = `<div class="cmp-inset" aria-hidden="true"><span class="cmp-inset-title">Fig 1b · carrier head, cut away</span>${HEAD_CUT}<span class="cmp-inset-note">retaining ring round the wafer; the membrane behind it is split into pressure zones, so the edge and centre can be pressed differently (five zones here, illustrative)</span><span class="cmp-inset-title cmp-inset-sub">Fig 1c · section under the head</span><svg viewBox="0 0 300 52" class="cmp-section"><rect class="cmp-oxide" x="0" y="30" width="300" height="22"/><path class="cmp-cu" data-cu d=""/><path class="cmp-barrier" data-barrier d=""/><path class="cmp-surf" data-surf d=""/></svg><span class="cmp-inset-note" data-inset-note>copper overburden</span></div>`;
const caption = `One platen of a CMP polisher, drawn as a single station, with the brush cleaner that follows. The head holds a ${M.WAFER_MM} mm wafer face down on a polyurethane pad; in 3M's 750-wafer copper run on an Applied Reflexion LK, the first platen ran ${M.REFLEXION.bulkPsi} psi and removed about ${M.BULK_NM} nm/min with ${M.REFLEXION.bulkWiwnu} % within-wafer non-uniformity, then a second platen clears the last copper at about ${M.CLEAR_NM} nm/min and stops on an endpoint signal. The diamond conditioner runs ${M.REFLEXION.condLbf} lbf at ${M.REFLEXION.condRpm} rpm, ${M.REFLEXION.sweepsPerMin} sweeps a minute. Platen and head speeds (${M.PLATEN_RPM} and ${M.HEAD_RPM} rpm) and the ${M.MIRRA.slurryMlMin} ml/min slurry flow are from a published 200 mm Mirra copper study that ran ${M.MIRRA.psi[0]}–${M.MIRRA.psi[1]} psi, a different tool and recipe from the Reflexion numbers. Wafers arrive in a sealed pod at the load port on the left; the robot that moves them is not drawn. The gantry stands in for the carousel or swing arms real tools use; sizes, the layout, the head cut-away in Fig 1b and the section in Fig 1c are illustrative, and the motion is slowed.`;
const scrub = `<span class="cmp-scrub"><button type="button" class="cmp-play" data-play aria-label="Play the polish"><span class="cmp-play-icon" aria-hidden="true"></span><span data-play-text>Play</span></button><input type="range" class="cmp-range" data-scrub min="0" max="1000" step="1" value="0" aria-label="Process: 0 is loading, 1000 is the brush clean" aria-valuetext="01 · ${M.PHASES[0].label}"><span class="cmp-step" data-step>01 · ${M.PHASES[0].label}</span></span>`;
const body = `<figure class="iso-figure cmp"><div class="iso-plate">${corners}${stage}${controls}</div><figcaption class="iso-legend">${scrub}${inset}<span class="cmp-parts">${legend}</span><span class="iso-caption">${caption}</span></figcaption></figure>`;

const CSS = readFileSync(join(HERE, "cmp.css"), "utf8");
const LIVE = readFileSync(join(HERE, "live.js"), "utf8").replace("__DATA__", JSON.stringify(DATA)).replace("__COND__", condParts.toString());
const out = writeChapter({ slug: "cmp", figure: body, css: CSS, script: kitScript() + LIVE, lesson: LESSON });
console.log("wrote", out.file, `${out.kb} KB`, `${R.items.length} items`, `${R.solids.length} solids`);

A.auditOrExit(R, P, { frames: STATES });
