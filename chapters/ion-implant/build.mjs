// Ion implanter and spike-anneal chamber on one bed: source, extraction, analyzer magnet, column, scanner,
// end station with a tilted platen and Faraday cup, and an RTP lamp chamber.
// node build.mjs [--audit] [--fast]
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as M from "./model.mjs";
import { k, G, A, Tube } from "../../site/kit.mjs";
import { writeChapter } from "../../site/shell.mjs";
import { LESSON } from "./lesson.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const DEG = Math.PI / 180;

// ---- world layout (illustrative units; x, y on the bed, z up) ----
const W = 720;
const H = 470;
const AZIMUTH = 45;
const ELEVATION = 36;

const ZB = 52; // beam height
const Y1 = 90; // first leg of the beamline runs along +x at this y
const RHO = 70; // bend radius of the kept ion in the analyzer
const DR = RHO - 64; // the magnet's rings grow with the bend radius
const MX = 20; // magnet entrance plane
const C = [MX, Y1 - RHO]; // bend centre
const BX = C[0] + RHO; // second leg runs along -y at this x
const CY = C[1];

const BED = { x: -242, y: -174, w: 432, d: 312, r: 10 };
const BED_H = 12;
const FOOT_H = 7;

const TILT = M.TILT_DEG * DEG;
const PLATEN_C = [BX, -144, ZB];
const PLATEN_N = [Math.sin(TILT), Math.cos(TILT), 0];
const PLATEN_R = 24;
const WAFER_R = 20;
const SCAN_Z = 22; // platen travel each way (illustrative)
const CUP = [46, -144, ZB];
const CUP_R = 5;
const CUP_MOUTH = 3.4;
const SCANNER = { y0: -51, y1: -94, w0: 11, w1: 42, z0: 40, z1: 64 };
const SLIT = 1.2; // resolving slit half-width (illustrative)
const WALL_IN = 53.5 + DR; // beam chamber walls inside the magnet
const WALL_OUT = 74.5 + DR;
const NEAR_X = 4; // near-mass paths are drawn this many times wider apart than true

const RTP = [-150, -96];
const COUPON = { x: 134, y: 72, w: 48, d: 5, r: 0.4 };
const COUPON_Z = [8, 64];

const P = k.fitProjection([...k.boxCorners(BED, -BED_H - FOOT_H, 0), [-206, 40, 96], [BX, -164, 100], [RTP[0], RTP[1], 66], [28, -164, 100]], W, H, { pad: 22, azimuth: AZIMUTH, elevation: ELEVATION });
const V = G.viewOf(P);
const KS = G.scaleOf(P);
const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const ptsPath = (points, close = false) => points.map((p, i) => `${i ? "L" : "M"}${at(p)[0].toFixed(1)} ${at(p)[1].toFixed(1)}`).join("") + (close ? "Z" : "");
const AX = (o) => G.frameOf(o, [1, 0, 0], [0, 1, 0], [0, 0, 1]);
const AYn = (o) => G.frameOf(o, [0, -1, 0], [1, 0, 0], [0, 0, 1]);
const AZ = (o) => G.frameOf(o, [0, 0, 1], [1, 0, 0], [0, 1, 0]);

const R = A.recorder(P);
function put(piece, ref, svg, shapes, { bias = 0, name, attrs = "", record = true } = {}) {
  const id = name ? R.nameFor(name) : R.nameFor(`${piece}.item`);
  shapes.forEach((shape) => (shape.name = shape.name ?? id));
  if (record) shapes.forEach(R.solid);
  return R.put({ piece, at: ref, bias, svg, shapes, name: id, attrs });
}
const centreOf = (plan, z) => [plan.x + plan.w / 2, plan.y + plan.d / 2, z];

// ---- small builders ----
function box(piece, plan, z, h, { tone = "mid", steps = 3, bevel = 0.5, extra = "", name, seam, attrs, owner } = {}) {
  const inner = seam !== undefined ? L(k.sideSeam(plan, seam, P, steps), { tone: "faint" }) : "";
  return put(piece, centreOf(plan, z + h / 2), S(k.slabOf(plan, z, h, P, steps, bevel), { tone, inner }) + extra, [A.slab(plan, z, h, { owner }, steps)], { name, attrs });
}
function turned(piece, F, profile, { tone = "mid", extra = "", name, bevel = 0, owner, attrs, inner = "" } = {}) {
  const mid = (profile[0][0] + profile[profile.length - 1][0]) / 2;
  const svg = S(G.lathe(profile, F, P, { bevel }), { tone, inner }) + extra;
  return put(piece, G.add3(F.o, G.mul3(F.a, mid)), svg, [A.lathe(F, profile, { owner })], { name, attrs });
}
const discP = (s0, s1, r) => [[s0, 0], [s0, r], [s1, r], [s1, 0]];
const ringP = (s0, s1, rIn, rOut) => [[s0, rIn], [s0, rOut], [s1, rOut], [s1, rIn]];
function sectorRing(r0, r1, a0, a1, n = 40) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = (a0 + ((a1 - a0) * i) / n) * DEG;
    pts.push([C[0] + r1 * Math.cos(a), C[1] + r1 * Math.sin(a)]);
  }
  for (let i = n; i >= 0; i--) {
    const a = (a0 + ((a1 - a0) * i) / n) * DEG;
    pts.push([C[0] + r0 * Math.cos(a), C[1] + r0 * Math.sin(a)]);
  }
  return pts;
}
function sector(piece, r0, r1, a0, a1, z, h, { tone = "mid", name, extra = "", seams = [] } = {}) {
  const ring = sectorRing(r0, r1, a0, a1);
  const inner = seams.length ? L(seams.map((zz) => k.ringSeam(ring, zz, P)).join(""), { tone: "faint" }) : "";
  const mid = (a0 + a1) / 2;
  const rm = (r0 + r1) / 2;
  return put(piece, [C[0] + rm * Math.cos(mid * DEG), C[1] + rm * Math.sin(mid * DEG), z + h / 2], S(k.extrude(ring, z, h, P, { convex: false }), { tone, inner }) + extra, [A.extruded(ring, z, h)], { name });
}
function pipe(piece, control, r, { name, bend = 3.2 } = {}) {
  const line = G.fillet(control, bend, 10, { P, tube: r });
  const id = R.nameFor(name);
  R.route(id, line, r, { piece });
  Tube.tubePieces(line, r, P, { maxLength: 16, spacing: 1 }).forEach((part, index) => R.put({ piece, at: part.mid, svg: Tube.tubeSvg(part, { tone: "mid" }), name: `${id}:${index}`, route: id, chunk: index, shapes: [A.tube(part.points, part.radii)] }));
}

// ---- 1. bed ----
function bed() {
  const out = [];
  out.push(`<path class="iso-halo" d="${k.haloOf(BED, -BED_H - FOOT_H, BED_H, P)}"/>`);
  const shapes = [];
  const feet = [...k.corners(BED, 24), [BED.x + BED.w / 2, BED.y + 24], [BED.x + BED.w / 2, BED.y + BED.d - 24]];
  for (const [x, y] of byDepth(feet)) {
    out.push(S(k.cylinder(x, y, 9, -BED_H - FOOT_H, 2, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 7, -BED_H - FOOT_H + 2, FOOT_H - 2, P, 28), { tone: "mid" }));
    shapes.push(A.cylinder(x, y, 9, -BED_H - FOOT_H, FOOT_H));
  }
  out.push(S(k.slabOf(BED, -BED_H, BED_H, P, 8, 1.6), { tone: "mid", inner: L(k.sideSeam(BED, -BED_H + 3.5, P, 8), { tone: "faint" }) }));
  shapes.push(A.slab(BED, -BED_H, BED_H));
  out.push(L(k.planOutline(k.insetPlan(BED, 6), 0, P), { tone: "lo" }));
  // raised-floor tile seams, groove to groove
  const g = k.insetPlan(BED, 6);
  const seams = [];
  for (let x = g.x + 48; x < g.x + g.w - 20; x += 48) seams.push(k.lineOnTop([x, g.y], [x, g.y + g.d], 0, P));
  for (let y = g.y + 48; y < g.y + g.d - 20; y += 48) seams.push(k.lineOnTop([g.x, y], [g.x + g.w, y], 0, P));
  out.push(L(seams.join(""), { tone: "faint" }));
  const screws = k.corners(BED, 12);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.4, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(Dots(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // ruler along the near (+y) edge
  const strip = { x: -200, y: BED.y + BED.d - 17, w: 210, d: 8, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 4, 5, strip.y + 0.8, 0.6, [2.2, 4], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(Dots([at([strip.x + 2, strip.y + 4, 0.6]), at([strip.x + strip.w - 2, strip.y + 4, 0.6])], { size: 0.45 }));
  // label plate
  const label = { x: -20, y: BED.y + BED.d - 26, w: 70, d: 16, r: 1.5 };
  out.push(S(k.slabOf(label, 0, 0.8, P, 4), { tone: "lo", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.8), 0.8, P, 4), { tone: "faint" }));
  out.push(L([0, 1, 2].map((i) => k.lineOnTop([label.x + 8, label.y + 5 + i * 3], [label.x + 54 - i * 13, label.y + 5 + i * 3], 0.8, P)).join(""), { tone: "lo", free: true }));
  out.push(Dots([at([label.x + 4, label.y + label.d / 2, 0.8]), at([label.x + label.w - 4, label.y + label.d / 2, 0.8])], { size: 0.45 }));
  put("stand", [0, 0, -BED_H], out.join(""), shapes, { name: "stand.bed", bias: -900 });
}

// ---- 2. gas box: three bottles behind the source, a strap, three lines to a valve manifold ----
const BOTTLES = M.SPECIES_ORDER.map((id, index) => ({ id, x: -206 + index * 14 }));
const BOTTLE_Y = 40;
const MANIFOLD = { x: -212, y: Y1 - 7, w: 40, d: 14, r: 1.4 };
function gas() {
  const base = { x: -220, y: 27, w: 56, d: 26, r: 2 };
  box("gas", base, 0, 4, { tone: "mid", bevel: 0.6, extra: Dots(k.corners(base, 3).map(([x, y]) => at([x, y, 4])), { size: 0.45 }), name: "gas.base" });
  for (const b of byDepth(BOTTLES.map((b) => [b.x, BOTTLE_Y, b])).map((p) => p[2])) {
    const F = AZ([b.x, BOTTLE_Y, 4]);
    const shoulder = (t) => 6 * Math.sqrt(Math.max(0, 1 - t * t));
    const prof = [[0, 0], [0, 6], [46, 6], ...Array.from({ length: 8 }, (_, i) => { const t = (i + 1) / 9; return [46 + 8 * t, Math.max(2.2, shoulder(t)), 1]; }), [54, 2.2], [54, 0]];
    const bands = L([12, 38].map((s) => G.arcOf(F, s, 6, P)).join(""), { tone: "faint" });
    turned("gas", F, prof, { tone: "hi", name: `gas.bottle-${b.id}`, inner: bands, attrs: `data-species="${b.id}"` });
    turned("gas", F, ringP(54, 58, 0, 2), { tone: "mid", name: `gas.neck-${b.id}` });
    turned("gas", F, discP(58, 64, 2.8), { tone: "mid", bevel: 0.3, name: `gas.valve-${b.id}`, extra: L(k.knurl(b.x, BOTTLE_Y, 2.8, 4 + 59, 4 + 63, 14, P), { tone: "lo" }), attrs: `data-species="${b.id}"` });
    turned("gas", F, discP(64, 66, 1.6), { tone: "mid", name: `gas.port-${b.id}` });
  }
  // strap across the bottles on two posts
  const bar = { x: -214, y: BOTTLE_Y + 6, w: 44, d: 2.4, r: 0.6 };
  for (const x of byDepth([[-212, BOTTLE_Y + 7.2], [-172, BOTTLE_Y + 7.2]]).map((p) => p[0])) turned("gas", AZ([x, BOTTLE_Y + 7.2, 4]), discP(0, 32, 1.6), { tone: "mid", name: "gas.post" });
  box("gas", bar, 36, 4, { tone: "mid", bevel: 0.3, extra: Dots([at([-212, BOTTLE_Y + 7.2, 40]), at([-172, BOTTLE_Y + 7.2, 40])], { size: 0.45 }), name: "gas.strap" });
}

// ---- 3. ion source: housing on a pedestal, back plate, terminal box, valve manifold, insulator ----
const SRC = { back: -224, x0: -220, x1: -172, r: 20 };
function source() {
  const ped = { x: -216, y: Y1 - 14, w: 40, d: 28, r: 2 };
  box("source", ped, 0, ZB - SRC.r, { tone: "mid", seam: 6, extra: Dots([at([ped.x + 4, ped.y + ped.d, 26]), at([ped.x + ped.w - 4, ped.y + ped.d, 26])].map((p) => p), { size: 0.45 }), name: "source.pedestal" });
  const F = AX([0, Y1, ZB]);
  turned("source", F, discP(SRC.back, SRC.x0, 23), { tone: "mid", bevel: 0.4, name: "source.backplate" });
  const ribs = G.ribsOf(F, SRC.x0, SRC.x1, SRC.r, 36, P, { fade: [0.1, 0.55], seams: true });
  turned("source", F, discP(SRC.x0, SRC.x1, SRC.r), { tone: "hi", name: "source.housing", extra: k.fadedSvg(ribs, { tone: "faint" }) + [16, 32].map((x) => `<path class="ii-ringglow" d="${G.arcOf(F, SRC.x0 + x, SRC.r, P)}"/>`).join(""), attrs: `data-plasma` });
  turned("source", F, discP(SRC.x1, SRC.x1 + 4, 25), { tone: "mid", bevel: 0.4, name: "source.flange", extra: Dots(G.dotsOf(F, SRC.x1 + 4, 22.6, 12, P, { all: true }), { size: 0.42 }) });
  // insulator bushing: sheds and core as stacked discs
  let s = SRC.x1 + 4;
  for (let i = 0; i < 5; i++) {
    turned("source", F, ringP(s, s + 2.6, 5, 13.5), { tone: "mid", name: "source.core" });
    s += 2.6;
    turned("source", F, ringP(s, s + 1.4, 5, 18), { tone: "hi", name: "source.shed" });
    s += 1.4;
  }
  turned("source", F, ringP(s, s + 2, 4, 13.5), { tone: "mid", name: "source.nose" });
  // terminal box on the near side of the housing: filament and arc supplies
  const term = { x: -208, y: Y1 + SRC.r, w: 20, d: 6, r: 1 };
  box("source", term, ZB - 7, 14, { tone: "mid", bevel: 0.4, name: "source.terminals" });
  for (const x of [-202, -194]) turned("source", G.frameOf([x, Y1 + SRC.r + 6, ZB], [0, 1, 0], [1, 0, 0], [0, 0, 1]), discP(0, 3, 1.4), { tone: "mid", name: "source.terminal" });
  // valve manifold on top of the housing, one air-operated valve per gas
  box("source", MANIFOLD, ZB + SRC.r, 6, { tone: "mid", bevel: 0.4, name: "source.manifold" });
  for (const b of BOTTLES) turned("source", AZ([b.x, Y1 + 3.5, ZB + SRC.r + 6]), discP(0, 6, 2.2), { tone: "mid", bevel: 0.3, name: `source.valve-${b.id}`, attrs: `data-species="${b.id}"` });
  return s + 2;
}

// ---- 4. extraction electrodes on insulating posts ----
// three electrodes spaced wide enough that the beam can be seen in the gaps between them (illustrative spacing)
const ELECTRODES = [-140, -123, -106];
const ELECTRODE_R = 11;
const FLIGHT_X0 = -98;
function extraction() {
  const rail = { x: -145, y: Y1 - 5, w: 44, d: 10, r: 1 };
  box("extract", rail, 0, 6, { tone: "mid", seam: 2, extra: Dots([at([rail.x + 3, Y1, 6]), at([rail.x + rail.w - 3, Y1, 6])], { size: 0.45 }), name: "extract.rail" });
  // each electrode carries a glow on its rim and one round its aperture: they switch on in turn as the beam is drawn out
  const F = AX([0, Y1, ZB]);
  ELECTRODES.forEach((x, i) => {
    turned("extract", AZ([x, Y1, 6]), discP(0, ZB - ELECTRODE_R - 6, 1.8), { tone: "mid", name: "extract.post" });
    const glow = `<path class="ii-ringglow" d="${G.arcOf(F, x + 0.8, ELECTRODE_R, P)}"/><path class="ii-aperture" d="${G.circleOf(F, x + 0.8, 3.2, P)}"/>`;
    turned("extract", F, ringP(x - 0.8, x + 0.8, 3.2, ELECTRODE_R), { tone: "hi", name: "extract.electrode", attrs: `data-xring="${i}"`, extra: glow });
  });
}

// ---- 5. flight tube to the magnet ----
function flightTube(x0) {
  const F = AX([0, Y1, ZB]);
  turned("extract", F, ringP(x0, x0 + 3, 7, 13), { tone: "mid", name: "extract.flange", attrs: `data-xring="${ELECTRODES.length}"`, extra: Dots(G.dotsOf(F, x0, 10.5, 8, P, { fade: [0.04, 0.42] }), { size: 0.4 }) + `<path class="ii-ringglow" d="${G.arcOf(F, x0 + 3, 13, P)}"/>` });
  const end = MX - 3;
  turned("magnet", F, ringP(x0 + 3, end - 3, 7, 9), { tone: "mid", name: "magnet.tube", inner: L([-80, -20].map((x) => G.arcOf(F, x, 9, P)).join(""), { tone: "faint" }) });
  turned("magnet", F, ringP(end - 3, end, 7, 13), { tone: "mid", name: "magnet.tube-flange" });
  for (const x of [-80, -20]) box("magnet", { x: x - 5, y: Y1 - 6, w: 10, d: 12, r: 1 }, 0, ZB - 9, { tone: "mid", seam: 4, name: "magnet.saddle" });
  // turbo pump on its own stand beside the tube, joined by a short foreline
  return end;
}

// ---- 6. analyzer magnet, upper pole and lid removed ----
function magnet() {
  const yokeTop = 38;
  sector("magnet", 28 + DR, 100 + DR, -8, 98, 0, yokeTop, { tone: "mid", name: "magnet.yoke", seams: [8, 30] });
  sector("magnet", 34 + DR, 46 + DR, 0, 90, yokeTop, 7, { tone: "hi", name: "magnet.coil-in", seams: [yokeTop + 2.4, yokeTop + 4.8] });
  sector("magnet", 82 + DR, 94 + DR, 0, 90, yokeTop, 7, { tone: "hi", name: "magnet.coil-out", seams: [yokeTop + 2.4, yokeTop + 4.8] });
  sector("magnet", 47 + DR, 81 + DR, 0, 90, yokeTop, 8, { tone: "mid", name: "magnet.pole" });
  sector("magnet", WALL_IN - 1.5, WALL_OUT + 1.5, 0, 90, 46, 2, { tone: "lo", name: "magnet.floor" });
  sector("magnet", WALL_IN - 1.5, WALL_IN, 0, 90, 48, 6, { tone: "mid", name: "magnet.wall-in" });
  // the near (outer) chamber wall is cut low so the beam's arc stays in view above it
  sector("magnet", WALL_OUT, WALL_OUT + 1.5, 0, 90, 48, 2, { tone: "mid", name: "magnet.wall-out" });
  // bolts on the yoke top outside the coils
  const bolts = [];
  for (let a = 4; a <= 86; a += 10) for (const r of [31 + DR, 97 + DR]) bolts.push(at([C[0] + r * Math.cos(a * DEG), C[1] + r * Math.sin(a * DEG), yokeTop]));
  put("magnet", [C[0] + 60 + DR, C[1] + 60 + DR, yokeTop], Dots(bolts, { size: 0.45 }), [A.box([C[0] + (28 + DR) * 0.7, C[1] + (28 + DR) * 0.7, yokeTop], [C[0] + 98 + DR, C[1] + 98 + DR, yokeTop + 0.1])], { name: "magnet.bolts", record: false });
  // entrance plate (beam port) and exit plate with the resolving slit: recorded as the solid around the opening
  const ent = { x: MX - 3, y: Y1 - 14, w: 3, d: 28, r: 0.4 };
  const entPaths = S(k.slabOf(ent, yokeTop, 28, P, 2, 0.3), { tone: "mid" });
  const port = L(k.sideRing ? k.sideRing([MX, Y1, ZB], 3, "x", P) : "", { tone: "lo" });
  put("magnet", centreOf(ent, yokeTop + 14), entPaths + port, [A.box([ent.x, ent.y, yokeTop], [MX, ent.y + ent.d, ZB - 3]), A.box([ent.x, ent.y, ZB + 3], [MX, ent.y + ent.d, yokeTop + 28]), A.box([ent.x, ent.y, ZB - 3], [MX, Y1 - 3, ZB + 3]), A.box([ent.x, Y1 + 3, ZB - 3], [MX, ent.y + ent.d, ZB + 3])], { name: "magnet.entrance" });
  const ex = { x: BX - 14, y: CY - 3, w: 28, d: 3, r: 0.4 };
  const slitLine = L(ptsPath([[BX - SLIT, CY, ZB - 4], [BX + SLIT, CY, ZB - 4], [BX + SLIT, CY, ZB + 4], [BX - SLIT, CY, ZB + 4]], true), { tone: "lo" });
  put("magnet", centreOf(ex, yokeTop + 14), S(k.slabOf(ex, yokeTop, 28, P, 2, 0.3), { tone: "mid" }) + slitLine, [A.box([ex.x, ex.y, yokeTop], [ex.x + ex.w, CY, ZB - 4]), A.box([ex.x, ex.y, ZB + 4], [ex.x + ex.w, CY, yokeTop + 28]), A.box([ex.x, ex.y, ZB - 4], [BX - SLIT, CY, ZB + 4]), A.box([BX + SLIT, ex.y, ZB - 4], [ex.x + ex.w, CY, ZB + 4])], { name: "magnet.exit" });
}

// ---- 7. acceleration column ----
const COL = { y0: CY - 3, y1: -51 };
function column() {
  const F = AYn([BX, 0, ZB]); // s runs along -y: s = -y
  let s = -COL.y0;
  turned("column", F, ringP(s, s + 3, 7, 13), { tone: "mid", name: "column.flange" });
  s += 3;
  turned("column", F, ringP(s, s + 8, 7, 9), { tone: "mid", name: "column.tube" });
  s += 8;
  turned("column", F, ringP(s, s + 3, 7, 22), { tone: "mid", bevel: 0.3, name: "column.flange-in", extra: Dots(G.dotsOf(F, s, 19.5, 12, P, { fade: [0.04, 0.42] }), { size: 0.4 }) });
  s += 3;
  const end = -COL.y1 - 3;
  const n = 10;
  const step = (end - s) / n;
  for (let i = 0; i < n; i++) {
    turned("column", F, ringP(s, s + step - 1.6, 7, 16.5), { tone: "mid", name: "column.insulator" });
    turned("column", F, ringP(s + step - 1.6, s + step, 7, 20), { tone: "hi", name: "column.electrode", attrs: `data-ring="${i}"`, extra: `<path class="ii-ringglow" d="${G.arcOf(F, s + step - 0.8, 20, P)}"/>` });
    s += step;
  }
  turned("column", F, ringP(s, s + 3, 7, 22), { tone: "mid", bevel: 0.3, name: "column.flange-out" });
  const cradle = { x: BX - 8, y: -(end), w: 16, d: end - (-COL.y0 + 14), r: 1 };
  box("column", cradle, 0, ZB - 20, { tone: "mid", seam: 4, name: "column.cradle" });
  return -(s + 3);
}

// ---- 8. scanner and corrector housing ----
function scanner(y0) {
  const { y1, w0, w1, z0, z1 } = SCANNER;
  const ring = [[BX - w0, y0], [BX + w0, y0], [BX + w1, y1], [BX - w1, y1]];
  const stand = { x: BX - 14, y: y1 + 4, w: 28, d: y0 - y1 - 8, r: 1 };
  box("scanner", stand, 0, z0, { tone: "mid", seam: 5, name: "scanner.stand" });
  const lid = ring.map(([x, y]) => [x + Math.sign(x - BX) * -2.5, y + Math.sign(y - (y0 + y1) / 2) * -2.5]);
  const extra = L(k.onTop(lid, z1, P, true), { tone: "lo" }) + Dots(lid.map(([x, y]) => at([x, y, z1])), { size: 0.45 }) + L(k.ringSeam(ring, z0 + 6, P), { tone: "faint" });
  put("scanner", [BX, (y0 + y1) / 2, (z0 + z1) / 2], S(k.extrude(ring, z0, z1 - z0, P, { bevel: 0.4 }), { tone: "hi", inner: L(k.ringSeam(ring, z1 - 4, P), { tone: "faint" }) }) + extra, [A.extruded(ring, z0, z1 - z0)], { name: "scanner.body" });
  // deflection-plate feedthroughs on the lid: ceramic stack, cap, HV contact
  for (const [x, y] of byDepth([[BX - 9, -72], [BX + 9, -72]])) {
    turned("scanner", AZ([x, y, z1]), discP(0, 1.2, 5), { tone: "mid", name: "scanner.boss", extra: Dots(G.dotsOf(AZ([x, y, z1]), 1.2, 4, 6, P, { all: true }), { size: 0.35 }) });
    for (let i = 0; i < 3; i++) turned("scanner", AZ([x, y, z1 + 1.2 + i * 2.4]), [[0, 0], [0, i % 2 ? 2.6 : 3.4], [2.4, i % 2 ? 2.6 : 3.4], [2.4, 0]], { tone: "hi", name: "scanner.ceramic" });
    turned("scanner", AZ([x, y, z1 + 8.4]), discP(0, 2, 1.6), { tone: "mid", name: "scanner.contact", extra: L(k.ring(x, y, 0.8, z1 + 10.4, P, 12), { tone: "lo" }) });
  }
}

// ---- 9. end station: open chamber, rail, platen, wafer, Faraday cup ----
function station() {
  const floor = { x: 28, y: -164, w: 100, d: 70, r: 2 };
  box("station", floor, 0, 6, { tone: "mid", seam: 2, name: "station.floor" });
  box("station", { x: 28, y: -164, w: 100, d: 6, r: 0.6 }, 6, 94, { tone: "mid", name: "station.back", extra: Dots(Array.from({ length: 11 }, (_, i) => at([34 + i * 8.8, -161, 100])), { size: 0.4 }) });
  box("station", { x: 28, y: -158, w: 6, d: 64, r: 0.6 }, 6, 94, { tone: "mid", name: "station.side", extra: Dots(Array.from({ length: 7 }, (_, i) => at([31, -152 + i * 9, 100])), { size: 0.4 }) });
  box("station", { x: 34, y: -100, w: 94, d: 6, r: 0.6 }, 6, 10, { tone: "mid", name: "station.sill-front" });
  box("station", { x: 122, y: -158, w: 6, d: 58, r: 0.6 }, 6, 10, { tone: "mid", name: "station.sill-side" });
  const rail = { x: BX - 5, y: -158, w: 10, d: 3, r: 0.4 };
  box("station", rail, 6, 90, { tone: "mid", name: "station.rail" });
  // the moving carriage: hub, platen, wafer
  const F = G.frameOf(PLATEN_C, PLATEN_N, [Math.cos(TILT), -Math.sin(TILT), 0], [0, 0, 1]);
  const hubS = (-155 - PLATEN_C[1]) / Math.cos(TILT);
  const mv = 'data-move="platen"';
  turned("station", F, discP(hubS, -4, 3.5), { tone: "mid", name: "station.hub", attrs: mv });
  turned("station", F, discP(-4, 0, PLATEN_R), { tone: "mid", bevel: 0.4, name: "station.platen", attrs: mv, extra: Dots(G.dotsOf(F, 0, PLATEN_R - 2, 16, P, { all: true }), { size: 0.4 }) });
  const face = G.circleOf(F, 0.8, WAFER_R, P);
  const notch = Dots([at(G.pointOf(F, 0.8, WAFER_R - 1.4, -Math.PI / 2))], { size: 0.5, tone: "lo" });
  turned("station", F, discP(0, 0.8, WAFER_R), { tone: "hi", name: "station.wafer", attrs: `${mv} data-pwafer`, extra: `<path class="ii-dose" d="${face}"/>` + notch });
  // Faraday cup on a bracket from the side wall, mouth facing the beam
  const CF = G.frameOf(CUP, [0, 1, 0], [1, 0, 0], [0, 0, 1]);
  box("station", { x: 34, y: -148, w: 41 - 34, d: 6, r: 0.4 }, ZB - 3, 6, { tone: "mid", name: "station.bracket" });
  turned("station", CF, discP(-8, -6, CUP_R), { tone: "mid", name: "station.cup-back" });
  turned("station", CF, ringP(-6, 5, CUP_MOUTH, CUP_R), { tone: "hi", name: "station.cup", attrs: "data-cup", extra: `<path class="ii-cupglow" d="${G.circleOf(CF, 5, CUP_MOUTH, P)}"/>` });
  turned("station", G.frameOf([34, -155, 74], [1, 0, 0], [0, 1, 0], [0, 0, 1]), discP(0, 2, 2.4), { tone: "mid", name: "station.feedthrough", extra: L(k.sideRing([36, -155, 74], 1.3, "x", P), { tone: "lo" }) });
  const cable = G.fillet([[46, -152, ZB], [46, -155, ZB], [46, -155, 74], [36, -155, 74]], 2.4, 10, { P, tube: 0.7 });
  const cid = R.nameFor("station.cup-cable");
  R.route(cid, cable, 0.7, { piece: "station", limp: true });
  Tube.tubePieces(cable, 0.7, P, { maxLength: 10, spacing: 1 }).forEach((part, index) => R.put({ piece: "station", at: part.mid, svg: Tube.tubeSvg(part, { tone: "mid" }), name: `${cid}:${index}`, route: cid, chunk: index, shapes: [A.tube(part.points, part.radii)] }));
}

// ---- 10. witness piece: a cleaved strip of an implanted wafer beside the end station. Its front face is split
// into three lanes (B, P, As) with a depth ruler down the left edge; depths are scaled, not to the figure's units ----
const NM_PER_UNIT = 10;
function coupon() {
  const holder = { x: COUPON.x - 5, y: COUPON.y - 7, w: COUPON.w + 10, d: COUPON.d + 12, r: 1.2 };
  const hf = holder.y + holder.d;
  const feet = [[holder.x + 3, hf - 3], [holder.x + holder.w - 3, hf - 3], [holder.x + 3, holder.y + 3], [holder.x + holder.w - 3, holder.y + 3]];
  box("station", holder, 0, COUPON_Z[0], { tone: "mid", seam: 3, name: "station.holder", extra: Dots(feet.map(([x, y]) => at([x, y, COUPON_Z[0]])), { size: 0.45 }) });
  // clamp jaws either side of the strip
  for (const x of [COUPON.x - 4, COUPON.x + COUPON.w]) box("station", { x, y: COUPON.y - 2, w: 4, d: COUPON.d + 4, r: 0.4 }, COUPON_Z[0], 10, { tone: "mid", bevel: 0.3, name: "station.jaw" });
  const top = COUPON_Z[1];
  const yF = COUPON.y + COUPON.d;
  const lane = COUPON.w / 3;
  const x0 = COUPON.x;
  // lane dividers and the depth ruler: ticks every 100 nm from the surface, a longer tick each 200 nm
  let marks = "";
  for (let i = 1; i < 3; i++) marks += ptsPath([[x0 + lane * i, yF, top], [x0 + lane * i, yF, COUPON_Z[0] + 10]]);
  const ticks = [];
  for (let nm = 100; top - nm / NM_PER_UNIT > COUPON_Z[0] + 10.5; nm += 100) ticks.push(ptsPath([[x0, yF, top - nm / NM_PER_UNIT], [x0 + (nm % 200 ? 1.6 : 3), yF, top - nm / NM_PER_UNIT]]));
  const ruler = L(marks, { tone: "faint" }) + L(ticks.join(""), { tone: "lo" });
  const bands = M.SPECIES_ORDER.map((id, i) => {
    const depth = M.SPECIES[id].rpNm / NM_PER_UNIT;
    const spread = depth * 0.45;
    const zTop = Math.min(top - 0.3, top - depth + spread);
    const zBot = Math.max(COUPON_Z[0] + 10.5, top - depth - spread);
    const xa = x0 + lane * i + (i ? 0.4 : 3.4);
    const xb = x0 + lane * (i + 1) - 0.4;
    const band = ptsPath([[xa, yF, zTop], [xb, yF, zTop], [xb, yF, zBot], [xa, yF, zBot]], true);
    // the projected-range marker runs the lane's full width, face edge or divider to divider, so both ends land on lines
    const peak = ptsPath([[x0 + lane * i, yF, top - depth], [x0 + lane * (i + 1), yF, top - depth]]);
    return `<g class="ii-depth" data-species="${id}"><path class="ii-band" d="${band}"/>${L(peak, { tone: "lit" })}</g>`;
  }).join("");
  const names = M.SPECIES_ORDER.map((id, i) => `<g transform="${k.sideMatrix([x0 + lane * i + lane / 2 - (id === "As" ? 2.4 : 1.3), yF], COUPON_Z[0] + 4, P, "left")}"><text class="ii-lane" data-species="${id}" font-size="4.2" x="0" y="0">${id}</text></g>`).join("");
  const rule = L(ptsPath([[x0, yF, COUPON_Z[0] + 10], [x0 + COUPON.w, yF, COUPON_Z[0] + 10]]), { tone: "lo" });
  box("station", COUPON, COUPON_Z[0], top - COUPON_Z[0], { tone: "hi", steps: 2, bevel: 0.3, name: "station.coupon", extra: rule + ruler + bands + names });
}

// ---- 11. RTP spike-anneal chamber ----
function anneal() {
  const [cx, cy] = RTP;
  box("anneal", { x: cx - 50, y: cy - 50, w: 100, d: 100, r: 8 }, 0, 6, { tone: "mid", seam: 2, steps: 6, name: "anneal.plinth", extra: Dots(k.corners({ x: cx - 50, y: cy - 50, w: 100, d: 100, r: 8 }, 8).map(([x, y]) => at([x, y, 6])), { size: 0.45 }) });
  const open = 45; // the cut faces the viewer
  for (let piece = 0; piece < 4; piece++) {
    const a0 = open + 58 + (244 * piece) / 4;
    const a1 = a0 + 61;
    const ring = [];
    for (let i = 0; i <= 14; i++) ring.push([cx + 42 * Math.cos((a0 + ((a1 - a0) * i) / 14) * DEG), cy + 42 * Math.sin((a0 + ((a1 - a0) * i) / 14) * DEG)]);
    for (let i = 14; i >= 0; i--) ring.push([cx + 36 * Math.cos((a0 + ((a1 - a0) * i) / 14) * DEG), cy + 36 * Math.sin((a0 + ((a1 - a0) * i) / 14) * DEG)]);
    const am = ((a0 + a1) / 2) * DEG;
    put("anneal", [cx + 39 * Math.cos(am), cy + 39 * Math.sin(am), 20], S(k.extrude(ring, 6, 28, P, { convex: false }), { tone: "mid", inner: L(k.ringSeam(ring, 20, P), { tone: "faint" }) }), [A.extruded(ring, 6, 28)], { name: "anneal.wall" });
  }
  const F = AZ([cx, cy, 0]);
  turned("anneal", F, discP(6, 8, 36), { tone: "lo", name: "anneal.reflector", extra: Dots([[cx - 12, cy + 6], [cx + 4, cy - 14], [cx + 14, cy + 10], [cx - 4, cy + 18]].map(([x, y]) => at([x, y, 8])), { size: 0.55, tone: "hi" }) });
  turned("anneal", F, ringP(8, 16, 24.6, 26), { tone: "mid", name: "anneal.support" });
  turned("anneal", F, ringP(16, 17.4, 22, 28), { tone: "mid", name: "anneal.edgering" });
  turned("anneal", F, discP(17.4, 18.2, 25), { tone: "hi", name: "anneal.wafer", extra: `<path class="ii-dose ii-adose" d="${G.circleOf(F, 18.2, 25, P)}"/><path class="ii-heat" d="${G.circleOf(F, 18.2, 25, P)}"/>`, attrs: "data-hot-wafer" });
  // lamphead on three posts
  const posts = [open + 180, open + 100, open + 260].map((a) => [cx + 39 * Math.cos(a * DEG), cy + 39 * Math.sin(a * DEG)]);
  for (const [x, y] of byDepth(posts)) turned("anneal", AZ([x, y, 34]), discP(0, 16, 2.4), { tone: "mid", name: "anneal.post" });
  // quartz window hung under the lamp head: the lamps sit above it, the wafer below
  turned("anneal", F, discP(47.2, 50, 34), { tone: "lo", name: "anneal.window", extra: `<path class="ii-lamps" d="${G.arcOf(F, 47.2, 34, P)}"/>` });
  // lamp head: the lamps (a honeycomb of tungsten-halogen bulbs in reflector cells) sit in its underside and shine
  // down through the quartz window; from above you see only its closed, water-cooled lid: a bolted cover plate,
  // the lamp-power connector in the middle and the two cooling-water fittings
  const lid = L(G.circleOf(F, 64, 34, P), { tone: "faint" }) + Dots(G.dotsOf(F, 64, 31, 12, P, { all: true }), { size: 0.45 });
  turned("anneal", F, discP(50, 64, 44), { tone: "hi", bevel: 0.6, name: "anneal.lamphead", attrs: "data-lamps", inner: L(G.arcOf(F, 56, 44, P), { tone: "faint" }), extra: lid });
  turned("anneal", F, discP(64, 67, 7), { tone: "mid", bevel: 0.4, name: "anneal.connector", extra: Dots(G.dotsOf(F, 67, 5, 6, P, { all: true }), { size: 0.38 }) });
  for (const [x, y] of byDepth([[cx + 30, cy - 30], [cx + 36, cy - 14]])) turned("anneal", AZ([x, y, 64]), discP(0, 5, 2.6), { tone: "mid", bevel: 0.3, name: "anneal.water" });
}

// ---- 12. the beam: kept ions as a lit line where it can be seen (gaps and the open magnet), rejected ions, the scanned fan ----
const BEAM_START = -146; // the insulator nose face
const ENTRY_S = MX - BEAM_START;
const EXIT_S = ENTRY_S + (RHO * Math.PI) / 2;
const BEAM_LENGTH = EXIT_S + (CY - SCANNER.y0);
function beam() {
  const segs = [];
  const gaps = [[BEAM_START, ELECTRODES[0] - 0.8], ...ELECTRODES.slice(0, -1).map((x, i) => [x + 0.8, ELECTRODES[i + 1] - 0.8]), [ELECTRODES[2] + 0.8, FLIGHT_X0]];
  for (const [x0, x1] of gaps) segs.push({ points: [[x0, Y1, ZB], [x1, Y1, ZB]], s0: x0 - BEAM_START, s1: x1 - BEAM_START, dots: [true, true] });
  const n = 12;
  for (let i = 0; i < n; i++) {
    const pts = [];
    for (let j = 0; j <= 4; j++) {
      const a = (90 - (90 * (i + j / 4)) / n) * DEG;
      pts.push([C[0] + RHO * Math.cos(a), C[1] + RHO * Math.sin(a), ZB]);
    }
    segs.push({ points: pts, s0: ENTRY_S + ((EXIT_S - ENTRY_S) * i) / n, s1: ENTRY_S + ((EXIT_S - ENTRY_S) * (i + 1)) / n, dots: [i === 0, i === n - 1] });
  }
  segs.forEach((c, index) => {
    const d = ptsPath(c.points);
    const ends = [c.points[0], c.points[c.points.length - 1]].filter((_, i) => c.dots[i]).map(at);
    const dots = ends.map((e) => `<circle class="ii-spark${index === 0 && e === ends[0] ? " ii-meniscus" : ""}" cx="${e[0].toFixed(1)}" cy="${e[1].toFixed(1)}" r="0.8"/>`).join("");
    put("beam", G.lerp3(c.points[0], c.points[c.points.length - 1], 0.5), `<path class="ii-beamglow" d="${d}"/>` + L(d, { tone: "lit", className: "ii-beam" }) + dots, [A.tube(c.points, 0.5)], { name: "beam.kept", record: false, attrs: `data-beam data-s0="${c.s0.toFixed(1)}" data-s1="${c.s1.toFixed(1)}"` });
  });
  return BEAM_LENGTH;
}

function rejected() {
  for (const id of M.SPECIES_ORDER) {
    const sp = M.SPECIES[id];
    for (const [ion, mass] of sp.rejects) {
      const ratio = M.radiusRatio(mass, sp.mass);
      const shown = Math.abs(ratio - 1) < 0.1 ? 1 + NEAR_X * (ratio - 1) : ratio;
      const rr = RHO * shown;
      const pts = [];
      let end = null;
      let hit = "";
      for (let phi = 0; phi < Math.PI; phi += 0.004) {
        const p = [MX + rr * Math.sin(phi), Y1 - rr + rr * Math.cos(phi), ZB];
        const d = Math.hypot(p[0] - C[0], p[1] - C[1]);
        if (p[1] <= CY) {
          // left the field at the exit plate: straight on is the plate face (the slit only passes the kept ion)
          end = [p[0], CY, ZB];
          hit = "plate";
          break;
        }
        if (d <= WALL_IN || d >= WALL_OUT) {
          end = p;
          hit = d <= WALL_IN ? "inner" : "outer";
          break;
        }
        if (!pts.length || G.len3(G.sub3(p, pts[pts.length - 1])) > 1.5) pts.push(p);
      }
      pts.push(end);
      const e = at(end);
      const spark = `<circle class="ii-spark ii-rspark" cx="${e[0].toFixed(1)}" cy="${e[1].toFixed(1)}" r="1.2"/>`; // where it strikes a wall or the exit plate
      // split the path so each part sorts on its own against the walls
      const half = Math.max(2, Math.floor(pts.length / 2));
      [pts.slice(0, half + 1), pts.slice(half)].forEach((part, index) => {
        if (part.length < 2) return;
        const svg = L(ptsPath(part), { tone: "hi", className: "ii-reject" }) + (index === 1 ? spark : "");
        put("beam", G.lerp3(part[0], part[part.length - 1], 0.5), svg, [A.tube(part, 0.4)], { name: `beam.reject-${id}`, record: false, attrs: `data-reject="${id}" data-ion="${ion}" data-half="${index}"` });
      });
    }
  }
}

function fan() {
  // the scanned beam between scanner and target: drawn by the page each frame, sorted as a thin sheet
  const sheet = A.box([CUP[0] - 4, -135.5, ZB - 0.4], [BX + 32, SCANNER.y1 - 0.5, ZB + 0.4]);
  put("beam", [BX, -116, ZB], (() => { const a = at([BX, SCANNER.y1, ZB]); const b = at([BX, PLATEN_C[1] + 0.8, ZB]); const d = `M${a[0].toFixed(1)} ${a[1].toFixed(1)}L${b[0].toFixed(1)} ${b[1].toFixed(1)}`; return `<path class="ii-beamglow" data-fan-glow d="${d}"/><path class="iso-line ii-beam" data-tone="lit" data-fan d="${d}"/><circle class="ii-spark" data-spot r="1.2" cx="${b[0].toFixed(1)}" cy="${b[1].toFixed(1)}"/><circle class="ii-spark" data-exit r="1" cx="${a[0].toFixed(1)}" cy="${a[1].toFixed(1)}"/>`; })(), [sheet], { name: "beam.fan", record: false, attrs: "data-fanitem" });
}

// ---- 13. source power cabinet with its HV cable, and the wafer load lock with a FOUP ----
function cabinet() {
  const cab = { x: -120, y: -20, w: 46, d: 34, r: 1.5 };
  const top = 58;
  const yF = cab.y + cab.d;
  const slots = [0, 1, 2, 3, 4].map((i) => {
    const z0 = 14 + i * 7;
    return ptsPath([[cab.x + 8, yF, z0], [cab.x + 30, yF, z0], [cab.x + 30, yF, z0 + 2.4], [cab.x + 8, yF, z0 + 2.4]], true);
  }).join("");
  const door = ptsPath([[cab.x + cab.w, cab.y + 4, 6], [cab.x + cab.w, cab.y + cab.d - 4, 6], [cab.x + cab.w, cab.y + cab.d - 4, top - 6], [cab.x + cab.w, cab.y + 4, top - 6]], true);
  const lid = L(k.planOutline(k.insetPlan(cab, 3), top, P, 3), { tone: "faint" }) + Dots(k.corners(cab, 3).map(([x, y]) => at([x, y, top])), { size: 0.45 });
  const meter = L(k.sideRing([cab.x + 38, yF, 44], 4, "y", P), { tone: "lo" }) + L(k.sideRing([cab.x + 38, yF, 44], 2.6, "y", P), { tone: "faint" });
  box("source", cab, 0, top, { tone: "mid", bevel: 0.6, seam: 4, name: "source.cabinet", extra: L(slots, { tone: "lo" }) + L(door, { tone: "faint" }) + lid + meter });
  box("source", { x: cab.x + cab.w, y: cab.y + 10, w: 2, d: 12, r: 0.5 }, 30, 4, { tone: "mid", bevel: 0.2, name: "source.handle" });
  turned("source", G.frameOf([cab.x, -2, 10], [-1, 0, 0], [0, 1, 0], [0, 0, 1]), discP(0, 2, 2.2), { tone: "mid", name: "source.gland" });
  const route = G.fillet([[cab.x - 2, -2, 10], [-130, -2, 10], [-136, -2, 1.6], [-160, -2, 1.6], [-160, Y1 + 40, 1.6], [-194, Y1 + 40, 1.6], [-194, Y1 + 40, ZB], [-194, Y1 + SRC.r + 9, ZB]], 5, 10, { P, tube: 0.8 });
  const id = R.nameFor("source.hv-cable");
  R.route(id, route, 0.8, { piece: "source", limp: true });
  Tube.tubePieces(route, 0.8, P, { maxLength: 14, spacing: 1 }).forEach((part, index) => R.put({ piece: "source", at: part.mid, svg: Tube.tubeSvg(part, { tone: "mid" }), name: `${id}:${index}`, route: id, chunk: index, shapes: [A.tube(part.points, part.radii)] }));
}

// wafer handling: the load lock on the end station, the atmospheric wafer handler (EFEM) behind it with its
// fan-filter unit, two load ports with FOUPs, and the operator console. A wafer leaves the end station the same way
// it came, back to its FOUP, which then travels to the separate anneal tool.
function loadLock() {
  const ll = { x: 132, y: -156, w: 26, d: 44, r: 1.5 };
  const vp = L(k.sideRing([145, ll.y + ll.d, 24], 6, "y", P), { tone: "lo" }) + L(k.sideRing([145, ll.y + ll.d, 24], 4.4, "y", P), { tone: "faint" });
  box("station", ll, 0, 40, { tone: "mid", bevel: 0.5, seam: 6, name: "station.loadlock", extra: L(k.planOutline(k.insetPlan(ll, 3), 40, P, 3), { tone: "faint" }) + Dots(k.corners(ll, 3).map(([x, y]) => at([x, y, 40])), { size: 0.45 }) + vp });
  turned("station", AZ([145, -134, 40]), discP(0, 8, 5), { tone: "mid", bevel: 0.3, name: "station.ll-actuator", extra: L(k.ring(145, -134, 2.4, 48, P, 16), { tone: "lo" }) });
  // EFEM: a tall box along the right edge; its near face carries a window and seams, its top a fan-filter unit
  const ef = { x: 158, y: -156, w: 28, d: 132, r: 1.5 };
  const xF = ef.x + ef.w;
  const win = ptsPath([[xF, -146, 18], [xF, -40, 18], [xF, -40, 44], [xF, -146, 44]], true);
  const panels = [-112, -78].map((y) => ptsPath([[xF, y, 6], [xF, y, 50]])).join("");
  box("station", ef, 0, 50, { tone: "mid", bevel: 0.5, seam: 6, name: "station.efem", extra: L(win, { tone: "lo" }) + L(panels, { tone: "faint" }) + Dots([at([xF, -150, 47]), at([xF, -30, 47])], { size: 0.45 }) });
  const ffu = { x: 161, y: -153, w: 22, d: 126, r: 1.2 };
  const grille = [];
  const gi = k.insetPlan(ffu, 3.5);
  for (let y = gi.y + 4; y < gi.y + gi.d - 2; y += 6) grille.push(k.lineOnTop([gi.x, y], [gi.x + gi.w, y], 56, P));
  box("station", ffu, 50, 6, { tone: "hi", bevel: 0.4, name: "station.ffu", extra: L(k.planOutline(gi, 56, P, 3), { tone: "lo" }) + L(grille.join(""), { tone: "faint" }) + Dots(k.corners(ffu, 2.4).map(([x, y]) => at([x, y, 56])), { size: 0.45 }) });
  // two load ports docked to the handler's inboard face, a FOUP on each
  for (const y0 of [-104, -64]) {
    const port = { x: 134, y: y0, w: 24, d: 32, r: 1.2 };
    box("station", port, 0, 30, { tone: "mid", bevel: 0.5, seam: 4, name: "station.loadport" });
    const foup = { x: 136, y: y0 + 2, w: 20, d: 28, r: 3 };
    box("station", foup, 30, 24, { tone: "hi", bevel: 0.6, steps: 5, name: "station.foup", seam: 36, attrs: "data-foup", extra: L(k.planOutline(k.insetPlan(foup, 3), 54, P, 4), { tone: "faint" }) });
    box("station", { x: 142, y: y0 + 10, w: 8, d: 12, r: 1 }, 54, 3, { tone: "mid", bevel: 0.3, name: "station.foup-handle" });
  }
  // operator console: pedestal, keyboard shelf, monitor on a post
  const ped = { x: 160, y: 6, w: 20, d: 18, r: 1.2 };
  box("station", ped, 0, 38, { tone: "mid", bevel: 0.5, seam: 4, name: "station.console", extra: Dots(k.corners(ped, 2.4).map(([x, y]) => at([x, y, 38])), { size: 0.45 }) });
  const shelf = { x: 160, y: 24, w: 20, d: 8, r: 0.8 };
  const keys = [];
  for (let i = 0; i < 3; i++) keys.push(k.lineOnTop([shelf.x + 3, shelf.y + 2 + i * 2], [shelf.x + shelf.w - 3, shelf.y + 2 + i * 2], 33.6, P));
  box("station", shelf, 32, 1.6, { tone: "hi", bevel: 0.2, name: "station.shelf", extra: L(keys.join(""), { tone: "faint", free: true }) });
  turned("station", AZ([170, 12, 38]), discP(0, 6, 1.6), { tone: "mid", name: "station.monitor-post" });
  const mon = { x: 156, y: 10, w: 28, d: 3, r: 0.6 };
  const yM = mon.y + mon.d;
  const screen = ptsPath([[mon.x + 2, yM, 46], [mon.x + mon.w - 2, yM, 46], [mon.x + mon.w - 2, yM, 60], [mon.x + 2, yM, 60]], true);
  box("station", mon, 44, 18, { tone: "mid", bevel: 0.3, name: "station.monitor", extra: L(screen, { tone: "lo" }) });
}

bed();
gas();
source();
// gas lines: valve port up, forward over the source, down onto the manifold
for (const b of BOTTLES) pipe("gas", [[b.x, BOTTLE_Y, 70], [b.x, BOTTLE_Y, 92], [b.x, Y1 - 3, 92], [b.x, Y1 - 3, ZB + SRC.r + 6]], 1.1, { name: `gas.line-${b.id}` });
extraction();
flightTube(FLIGHT_X0);
magnet();
column();
scanner(SCANNER.y0);
station();
coupon();
anneal();
cabinet();
loadLock();
beam();
rejected();
fan();

if (!process.argv.includes("--fast")) A.settle(R, P);
R.items.sort((a, b) => a.key - b.key);
const groups = R.items.map((item, index) => `<g class="it" data-piece="${item.piece}" data-i="${index}" ${item.attrs ?? ""}>${item.svg}</g>`);

const LABEL = `An ion implanter and a rapid thermal anneal chamber on one bed. From the back left: three dopant gas bottles feeding a valve manifold on the ion source; an insulator bushing and three extraction electrodes; a flight tube into the analyzer magnet, shown with its upper pole removed so the beam can be seen bending; the exit plate with the resolving slit; a ten-ring acceleration column; the scanner housing; and the end station, its vacuum chamber cut away, where a tilted platen carries the wafer up and down through the scanned beam beside a Faraday cup. Behind it are the load lock, the wafer handler with two FOUPs on load ports, and the operator console, with a cleaved witness piece in front. At the back sits the lamp-heated anneal chamber, a separate tool, cut open to show its wafer under a quartz window; the lamp head above it has a closed, water-cooled lid, and its lamps face down through the window onto the wafer.`;
const svg = k.figureSvg({ width: W, height: H, label: LABEL, body: [`<g class="ii-layers">${groups.join("")}</g>`], className: "ii-svg" });

const O = at([0, 0, 0]);
const unit = (v) => {
  const p = at(v);
  return [p[0] - O[0], p[1] - O[1]];
};
const DATA = {
  O,
  EX: unit([1, 0, 0]),
  EY: unit([0, 1, 0]),
  EZ: unit([0, 0, 1]),
  BX,
  ZB,
  scan: { y0: SCANNER.y1, platenY: PLATEN_C[1], tilt: TILT, platenR: PLATEN_R, waferR: WAFER_R, travel: SCAN_Z, cupX: CUP[0], cupMouth: CUP_MOUTH, cupY: CUP[1] + 5, wallY: -158, railY: -155, railHalf: 5, uMin: CUP[0] - BX, uMax: 30, waferS: 0.8 },
  beam: { length: BEAM_LENGTH, entry: ENTRY_S, exit: EXIT_S },
  pieces: Object.fromEntries(Object.entries(M.PIECES).map(([id, p]) => [id, { name: p.name, say: p.say, short: p.short ?? p.say }])),
  order: M.ORDER,
  steps: M.STEPS,
  species: Object.fromEntries(M.SPECIES_ORDER.map((id) => {
    const s = M.SPECIES[id];
    return [id, { name: s.name, ion: s.ion, gas: s.gas, type: s.type, rp: s.rpNm, rho: M.rigidity(s.mass, M.RECIPE.extractKeV), rejects: s.rejects.map(([ion]) => ion) }];
  })),
  recipe: M.RECIPE,
  tiltDeg: M.TILT_DEG,
  anneal: M.ANNEAL,
  idle: `${M.RECIPE.finalKeV} keV · ${M.sci(M.RECIPE.dose)} cm⁻² · illustrative recipe`,
  idleShort: `${M.RECIPE.finalKeV} keV · ${M.sci(M.RECIPE.dose)} cm⁻² (illustrative)`,
  doseText: M.sci(M.RECIPE.dose),
};

const PARTS = M.ORDER.map((id, index) => `<button type="button" class="ii-part" data-part="${id}"><span class="ii-num">${String(index + 1).padStart(2, "0")}</span>${M.PIECES[id].name}</button>`).join("");
const SPECIES_BUTTONS = M.SPECIES_ORDER.map((id) => `<button type="button" class="ii-sp" data-sp="${id}" aria-pressed="${id === "B"}">${id === "As" ? "As" : id} <span>${M.SPECIES[id].gas}</span></button>`).join("");
const corners = `<div class="iso-plate-corners" aria-hidden="true"><span class="iso-plate-corner" data-corner="fig">Fig 9</span><span class="iso-plate-corner" data-corner="title">Ion implanter · anatomy</span><span class="iso-plate-corner" data-corner="readout" data-readout>${DATA.idle}</span></div>`;
const controls = `<div class="ii-controls"><span class="ii-hint">Hover a part · Space plays</span><span class="ii-live" aria-live="polite" data-live></span></div>`;
const stage = `<div class="ii-stage" tabindex="0" role="slider" aria-label="Ion implanter and anneal chamber. Hover, or use the arrow keys, to pick a part; Space plays or pauses the implant; Escape resets it; the slider below steps through the process." aria-valuemin="0" aria-valuemax="${M.ORDER.length}" aria-valuenow="0" aria-valuetext="${DATA.idle}">${svg}</div>`;
const caption = `An ion implanter, then a lamp anneal. The source turns ${M.SPECIES.B.gas}, ${M.SPECIES.P.gas} or ${M.SPECIES.As.gas} into a plasma; the electrodes pull ions out; the analyzer magnet bends each ion on a radius that grows with the square root of its mass, so only the chosen ion lines up with the slit. The column then raises the energy (real tools span about ${M.MIN_KEV} keV to ${M.TOOLS.maxMeV} MeV across high-current, medium-current and high-energy classes), the scanner sweeps the beam side to side while the platen, tilted ${M.TILT_DEG}° to stop channelling, slides the wafer up and down through it, and a Faraday cup at the edge of the sweep counts the charge that sets the dose (about ${M.sci(M.TOOLS.doseRange[0])} to ${M.sci(M.TOOLS.highCurrentDose[1])} ions per cm² across tool classes). At ${M.RECIPE.finalKeV} keV boron stops about ${M.SPECIES.B.rpNm} nm deep, phosphorus ${M.SPECIES.P.rpNm} nm and arsenic ${M.SPECIES.As.rpNm} nm (SRIM), as the cleaved witness piece at the front right shows: its face carries a depth ruler and all three bands, the chosen dopant lit. The implanted wafer then goes back through the load lock to its FOUP and on to a separate anneal tool, drawn at the back of the bed, where lamps in the underside of the water-cooled head shine down through the quartz window and a spike anneal (peak shown as about ${M.ANNEAL.spikeC.toLocaleString("en-US")} °C, illustrative, at the top of the ${M.ANNEAL.rtpC[0]}–${M.ANNEAL.rtpC[1].toLocaleString("en-US")} °C lamp-RTP window) repairs the lattice and switches the dopants on. Layout, sizes, the ${M.RECIPE.extractKeV} keV extraction and the recipe are illustrative; the magnet's upper pole is removed and the end-station chamber is cut away, near-mass paths are drawn ${NEAR_X}× further apart than true, and coupon depths are scaled.`;
const scrub = `<span class="ii-scrub"><button type="button" class="ii-play" data-play aria-label="Play the implant"><span class="ii-play-icon" aria-hidden="true"></span><span data-play-text>Play</span></button><input type="range" class="ii-range" data-scrub min="0" max="1000" step="1" value="0" aria-label="Process: 0 is idle, 1000 is annealed"><span class="ii-step" data-step>idle</span></span>`;
const pick = `<span class="ii-species" role="group" aria-label="Dopant">${SPECIES_BUTTONS}</span>`;
const body = `<figure class="iso-figure ii"><div class="iso-plate">${corners}${stage}${controls}</div><figcaption class="iso-legend">${scrub}${pick}<span class="ii-parts">${PARTS}</span><span class="iso-caption">${caption}</span></figcaption></figure>`;

const CSS = readFileSync(join(HERE, "ion-implant.css"), "utf8");
const LIVE = readFileSync(join(HERE, "live.js"), "utf8").replace("__DATA__", JSON.stringify(DATA));
const out = writeChapter({ slug: "ion-implant", figure: body, css: CSS, script: LIVE, lesson: LESSON });
console.log("wrote", out.file, `${out.kb} KB`, `${R.items.length} items`, `${R.solids.length} solids`);

A.auditOrExit(R, P);
