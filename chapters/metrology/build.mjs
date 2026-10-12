// CD-SEM: a critical-dimension scanning electron microscope, cut away to show its column, chamber, stage and load lock.
// node build.mjs [--audit] [--fast]
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as M from "./model.mjs";
import { sharesAt } from "./motion.mjs";
import { k, G, A, Tube } from "../../site/kit.mjs";
import { writeChapter } from "../../site/shell.mjs";
import { LESSON } from "./lesson.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

// ---- world layout: x, y on the floor, z up; about 5 mm a unit, illustrative ----
const W = 760;
const H = 600;
const AZIMUTH = 55;
const ELEVATION = 30;

const PLATE = { x: -198, y: -104, w: 360, d: 180, r: 10 };
const PLATE_H = 12;
const FOOT_H = 8;

// column axis; the column, optical head and detector are cut away on the plane y = AY (front half removed)
const AX = -24;
const AY = -24;
// chamber: front panel and the front of its lid removed (lid ends at CUT)
const CH = { x0: -87, x1: 62, y0: -80, y1: 40, t: 5, top: 66, lid: 72 };
const CUT = 4;
// the slot the wafer passes through (chamber wall, gate valve, load-lock wall)
const SLOT = { z0: 26, z1: 33, y0: -55, y1: 8 };
// load lock
const LL = { x0: 72, x1: 146, y0: -62, y1: 14, top: 56, lid: 62 };
// wafer and stage
const WR = 30;
const WZ = 28;
const WT = 1.2;
const SITE = 14; // the measured site, on the wafer's x axis, this far from its centre
const MARK = 4; // the overlay mark
const MX = AX - SITE; // wafer centre while measuring (share 0)
const LX = 22; // wafer centre at the stage's load position
const LLX = 109; // wafer centre in the load lock
const OX = 18; // optical head axis
const MW = [LLX - MX, 0, 0];
const MS = [LX - MX, 0, 0];
const K = { rho: MS[0] / MW[0], opt: (OX - MARK - MX) / MS[0] };

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [AX, AY, 240], [-92, -14, 238], [CH.x1, CH.y1, CH.lid], [-186, -32, 132], [LL.x1, LL.y1, LL.lid]],
  W,
  H,
  { pad: 26, azimuth: AZIMUTH, elevation: ELEVATION },
);
const V = G.viewOf(P);
const KS = G.scaleOf(P);
const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);
const path3 = (points, closed = false) => k.pathOf(points.map(at), closed);
const centreOf = (plan, z) => [plan.x + plan.w / 2, plan.y + plan.d / 2, z];
const box = (x0, x1, y0, y1, r = 0.6) => ({ x: x0, y: y0, w: x1 - x0, d: y1 - y0, r });

// ---- recorder: two moving pieces, everything else static ----
const MOVES = { wafer: MW, stage: MS, static: [0, 0, 0] };
const R = A.recorder(P, { order: ["wafer", "stage"] });
function put(name, part, ref, svg, shapes, { piece = "static", bias = 0 } = {}) {
  const id = R.nameFor(name);
  shapes.forEach((shape) => (shape.name = shape.name ?? id));
  R.put({ piece, at: ref, bias, svg, move: MOVES[piece], shapes: shapes.map(R.solid), name: id, part });
  return id;
}
const slabShape = (plan, z, h, steps = 2) => A.slab(plan, z, h, {}, steps);
const cylShape = (x, y, r, z, h) => A.cylinder(x, y, r, z, h, {});

// a plain box part with a seam and optional extras
function block(name, part, plan, z, h, { tone = "mid", steps = 2, bevel = 0.4, seam = null, extra = "", piece, bias = 0 } = {}) {
  const inner = seam === null ? "" : L((Array.isArray(seam) ? seam : [seam]).map((s) => k.sideSeam(plan, s, P, steps)).join(""), { tone: "faint" });
  put(name, part, centreOf(plan, z + h / 2), S(k.slabOf(plan, z, h, P, steps, bevel), { tone, inner }) + extra, [slabShape(plan, z, h, steps)], { piece, bias });
}

// ---- the cutaway plane: half-cylinders about (cx, AY) keep y <= AY, their cut face faces the viewer ----
function halfRing(cx, r, n) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = (Math.PI * i) / n;
    pts.push([cx + r * Math.cos(t), AY - r * Math.sin(t)]);
  }
  return pts;
}
const onCut = (x, z) => at([x, AY, z]);
const cutPath = (points, closed = false) => k.pathOf(points.map(([x, z]) => onCut(x, z)), closed);
const cutRect = (x0, x1, z0, z1) => cutPath([[x0, z0], [x1, z0], [x1, z1], [x0, z1]], true);
// the beam: one lit-able segment per sectioned part, ending on the part's top and bottom edges
const beamSeg = (x, z0, z1) => L(cutPath([[x, z0], [x, z1]]), { tone: "lo", className: "mt-beam" });

function half(name, part, cx, r, z0, z1, { tone = "mid", face = "", seams = [], bevel = 0, bore = 1.2, beam = true, piece } = {}) {
  const ring = halfRing(cx, r, Math.max(16, Math.round(r * 2.4)));
  const lines = [];
  if (bore) lines.push(L(cutRect(cx - bore, cx + bore, z0, z1), { tone: "faint" }));
  if (face) lines.push(face);
  if (beam && bore) lines.push(beamSeg(cx, z0, z1));
  const inner = seams.length ? L(seams.map((z) => k.ringSeam(ring, z, P)).join(""), { tone: "faint" }) : "";
  const svg = S(k.extrude(ring, z0, z1 - z0, P, { bevel }), { tone, inner }) + lines.join("");
  put(name, part, [cx, AY - r / 2, (z0 + z1) / 2], svg, [A.extruded(ring, z0, z1 - z0, {})], { piece });
}
// a half prism along x (a neck or a detector body), cut on the same plane
function halfAlongX(name, part, origin, dir, r, s0, s1, { tone = "mid", face = "" } = {}) {
  const F = G.frameOf(origin, [dir, 0, 0], [0, 0, 1], [0, -1, 0]);
  const poly = [];
  for (let i = 0; i <= 20; i++) {
    const t = (Math.PI * i) / 20;
    poly.push([r * Math.cos(t), r * Math.sin(t)]);
  }
  const svg = S(G.prismOf(F, poly, s0, s1, P), { tone }) + face;
  put(name, part, [origin[0] + dir * (s0 + s1) / 2, AY - r / 2, origin[2]], svg, [A.prism(F, poly, s0, s1, {})]);
}

// ---- stand: base plate on isolators, ruler, label plate ----
function stand() {
  const out = [];
  out.push(`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`);
  const shapes = [];
  const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
  for (const [x, y] of byDepth(k.corners(PLATE, 26))) {
    const z0 = -PLATE_H - FOOT_H;
    out.push(S(k.cylinder(x, y, 10, z0, 2, P, 36), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 8, z0 + 2, 4, P, 32, 0.3), { tone: "mid", inner: L(k.sideArc(x, y, 8, z0 + 4, P, 24), { tone: "faint" }) }));
    out.push(S(k.cylinder(x, y, 6, z0 + 6, 2, P, 28), { tone: "lo" }));
    shapes.push(A.cylinder(x, y, 10, z0, 2, {}), A.cylinder(x, y, 8, z0 + 2, 4, {}), A.cylinder(x, y, 6, z0 + 6, 2, {}));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid", inner: L(k.sideSeam(PLATE, -PLATE_H + 4, P, 8), { tone: "faint" }) }));
  shapes.push(A.slab(PLATE, -PLATE_H, PLATE_H, {}, 8));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 6), 0, P, 8), { tone: "lo" }));
  const screws = k.corners(PLATE, 12);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.4, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(Dots(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // ruler along the front edge, a tick every 2 units (10 mm), a major every 10
  const strip = { x: -120, y: PLATE.y + PLATE.d - 16, w: 168, d: 7, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 2, 5, strip.y + 0.8, 0.6, [2, 3.8], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(Dots([at([strip.x + 2, strip.y + 3.5, 0.6]), at([strip.x + strip.w - 2, strip.y + 3.5, 0.6])], { size: 0.45 }));
  // label plate
  const label = { x: 72, y: PLATE.y + PLATE.d - 26, w: 70, d: 16, r: 1.5 };
  out.push(S(k.slabOf(label, 0, 0.8, P, 4), { tone: "lo", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.8), 0.8, P, 4), { tone: "faint" }));
  out.push(L([0, 1, 2].map((i) => k.lineOnTop([label.x + 8, label.y + 5 + i * 3], [label.x + 52 - i * 12, label.y + 5 + i * 3], 0.8, P)).join(""), { tone: "lo", free: true }));
  out.push(Dots([at([label.x + 4, label.y + label.d / 2, 0.8]), at([label.x + label.w - 4, label.y + label.d / 2, 0.8])], { size: 0.45 }));
  R.put({ piece: "static", at: [0, 0, -1], bias: -400, svg: out.join(""), move: [0, 0, 0], shapes: shapes.map((s) => R.solid({ ...s, name: "stand.base" })), name: "stand.base", part: "stand" });
}

// ---- chamber: floor, walls with the gate slot, lid ----
function slotted(name, part, x0, x1, y0, y1, top, { tone = "mid", split = null } = {}) {
  // a wall pierced by the slot: below, above, and the two jambs beside it; long walls split where the load lock's back wall meets them
  const spans = (a, b) => (split !== null && split > a && split < b ? [[a, split], [split, b]] : [[a, b]]);
  for (const [a, b] of spans(y0, y1)) block(`${name}.sill`, part, box(x0, x1, a, b, 0.4), 0, SLOT.z0, { tone, seam: 8 });
  for (const [a, b] of spans(y0, y1)) block(`${name}.head`, part, box(x0, x1, a, b, 0.4), SLOT.z1, top - SLOT.z1, { tone });
  for (const [a, b] of spans(y0, SLOT.y0)) block(`${name}.jamb`, part, box(x0, x1, a, b, 0.4), SLOT.z0, SLOT.z1 - SLOT.z0, { tone });
  block(`${name}.jamb`, part, box(x0, x1, SLOT.y1, y1, 0.4), SLOT.z0, SLOT.z1 - SLOT.z0, { tone });
}

function chamber() {
  const { x0, x1, y0, y1, t, top, lid } = CH;
  const floor = box(x0 + t, x1 - t, y0 + t, y1 - t, 0.4);
  // floor with a groove and hold-down bolts
  const bolts = [];
  for (let x = floor.x + 8; x < floor.x + floor.w - 4; x += 22) bolts.push([x, floor.y + floor.d - 4]);
  block("chamber.floor", "chamber", floor, 0, 8, { tone: "lo", extra: Dots(bolts.map(([x, y]) => at([x, y, 8])), { size: 0.45, tone: "lo" }) });
  block("chamber.back", "chamber", box(x0 + t, x1 - t, y0, y0 + t, 0.4), 0, top, { seam: [12] });
  block("chamber.left", "chamber", box(x0, x0 + t, y0, y1, 0.4), 0, top, { seam: [12] });
  slotted("chamber.right", "chamber", x1 - t, x1, y0, y1, top, { split: LL.y0 });
  // the low front sill left where the front panel was taken off
  block("chamber.sill", "chamber", box(x0 + t, x1 - t, y1 - t, y1, 0.4), 0, 14, { extra: Dots([at([x0 + 20, y1, 10]), at([x1 - 20, y1, 10])], { size: 0.45 }) });
  // lid, cut along y = CUT, with its bolt ring
  const lidPlan = box(x0, x1, y0, CUT, 0.6);
  const ring = [];
  for (let x = x0 + 6; x <= x1 - 6; x += 12) ring.push([x, y0 + 4]);
  for (let y = y0 + 16; y <= CUT - 6; y += 12) ring.push([x0 + 4, y], [x1 - 4, y]);
  const lidLines = L(k.planOutline(k.insetPlan(lidPlan, 7), lid, P, 2), { tone: "faint" });
  block("chamber.lid", "chamber", lidPlan, top, lid - top, { bevel: 0.8, extra: lidLines + Dots(ring.map(([x, y]) => at([x, y, lid])), { size: 0.45 }), seam: [] });
}

function gateValve() {
  slotted("gate", "chamber", CH.x1, LL.x0, LL.y0 + 5, LL.y1, 58);
  // pneumatic actuator on top: cylinder, end cap, air fitting
  const cx = (CH.x1 + LL.x0) / 2;
  const cy = -24;
  const svg =
    S(k.cylinder(cx, cy, 4.6, 58, 18, P, 28, 0.3), { tone: "mid", inner: L(k.sideArc(cx, cy, 4.6, 64, P, 20), { tone: "faint" }) }) +
    S(k.cylinder(cx, cy, 3.2, 76, 2.5, P, 24), { tone: "mid" }) +
    S(k.cylinder(cx, cy, 1.4, 78.5, 2, P, 16), { tone: "hi", crease: "lo" });
  put("gate.actuator", "chamber", [cx, cy, 68], svg, [cylShape(cx, cy, 4.6, 58, 18), cylShape(cx, cy, 3.2, 76, 2.5), cylShape(cx, cy, 1.4, 78.5, 2)]);
}

function loadLock() {
  const { x0, x1, y0, y1, top, lid } = LL;
  const t = 5;
  block("ll.floor", "chamber", box(x0 + t, x1 - t, y0 + t, y1 - t, 0.4), 0, 6, { tone: "lo" });
  block("ll.back", "chamber", box(x0, x1, y0, y0 + t, 0.4), 0, top, { seam: [10] });
  block("ll.right", "chamber", box(x1 - t, x1, y0 + t, y1, 0.4), 0, top, { seam: [10] });
  slotted("ll.left", "chamber", x0, x0 + t, y0 + t, y1, top);
  block("ll.sill", "chamber", box(x0 + t, x1 - t, y1 - t, y1, 0.4), 0, 12);
  const lidPlan = box(x0, x1, y0, CUT, 0.6);
  const knob = S(k.cylinder(126, -40, 3, lid, 3, P, 20), { tone: "mid" }) + L(k.knurl(126, -40, 3, lid + 0.4, lid + 2.6, 16, P), { tone: "lo" });
  const screws = k.corners(lidPlan, 4);
  block("ll.lid", "chamber", lidPlan, top, lid - top, { bevel: 0.6, extra: Dots(screws.map(([x, y]) => at([x, y, lid])), { size: 0.45 }) + L(k.planOutline(k.insetPlan(lidPlan, 5), lid, P, 2), { tone: "faint" }) });
  const FG = G.frameAlong([x1, AY, 30], [1, 0, 0]);
  const gauge = S(G.disc(0, 2, 7, FG, P, { bevel: 0.3 }), { tone: "mid" }) + Dots(G.dotsOf(FG, 2, 5.6, 6, P, { all: true }), { size: 0.45 }) + S(G.disc(2, 12, 4.4, FG, P), { tone: "mid", inner: L(G.arcOf(FG, 7, 4.4, P), { tone: "faint" }) }) + S(G.disc(12, 15, 5, FG, P, { bevel: 0.3 }), { tone: "hi", crease: "lo" });
  put("ll.gauge", "chamber", [x1 + 7, AY, 30], gauge, [A.disc(FG, 0, 2, 7, {}), A.disc(FG, 2, 12, 4.4, {}), A.disc(FG, 12, 15, 5, {})]);
  put("ll.vent", "chamber", [126, -40, lid + 1.5], knob, [cylShape(126, -40, 3, lid, 3)]);
  // three lift pins the wafer rests on
  for (const deg of [90, 210, 330]) {
    const a = (deg * Math.PI) / 180;
    const x = LLX + 14 * Math.cos(a);
    const y = AY + 14 * Math.sin(a);
    put("ll.pin", "chamber", [x, y, 17], S(k.cylinder(x, y, 2.6, 6, 2, P, 20), { tone: "mid" }) + S(k.cylinder(x, y, 1.2, 8, WZ - 8, P, 16), { tone: "mid", crease: "none" }), [cylShape(x, y, 2.6, 6, 2), cylShape(x, y, 1.2, 8, WZ - 8)]);
  }
}

// ---- stage: crossed rails, carriage, chuck, interferometer mirror; the wafer ----
function stage() {
  for (const x of [-70, 36]) block("stage.yrail", "stage", box(x, x + 6, -70, 30, 0.6), 8, 3, { tone: "lo" });
  const ybase = box(-78, 54, -66, 22, 1);
  block("stage.ybase", "stage", ybase, 11, 4, { bevel: 0.5, seam: 13 });
  for (const y of [-49, -4]) {
    const rail = box(-76, 52, y, y + 5, 0.6);
    const holes = [];
    for (let x = rail.x + 6; x < rail.x + rail.w; x += 12) holes.push(at([x, y + 2.5, 18]));
    block("stage.xrail", "stage", rail, 15, 3, { tone: "mid", extra: Dots(holes, { size: 0.32, tone: "lo" }) });
  }
  // moving: carriage, chuck, mirror (built at the measuring position)
  const car = box(MX - 34, MX + 28, -54, 6, 1.2);
  const rivets = [];
  for (let x = car.x + 4; x < car.x + car.w - 2; x += 6) rivets.push(at([x, car.y + car.d - 1.6, 24]));
  block("stage.carriage", "stage", car, 18, 6, { bevel: 0.5, seam: 21, piece: "stage", extra: Dots(rivets, { size: 0.35, tone: "lo" }) });
  const chuck = S(k.cylinder(MX, AY, 27, 24, 4, P, 72, 0.5), { tone: "mid", inner: L(k.sideArc(MX, AY, 27, 26, P, 48), { tone: "faint" }) });
  put("stage.chuck", "stage", [MX, AY, 26], chuck, [cylShape(MX, AY, 27, 24, 4)], { piece: "stage" });
  const mirror = box(MX - 34, MX - 31.5, -50, 2, 0.2);
  put("stage.mirror", "stage", centreOf(mirror, 26.5), S(k.slabOf(mirror, 24, 5, P, 2, 0.3), { tone: "hi", crease: "lo" }), [slabShape(mirror, 24, 5)], { piece: "stage" });
  // interferometer head on the chamber's left wall
  const head = box(-82, -76, AY - 6, AY + 6, 0.6);
  put("stage.interferometer", "stage", centreOf(head, 28), S(k.slabOf(head, 24, 8, P, 2, 0.3), { tone: "mid", inner: L(k.sideSeam(head, 26, P, 2), { tone: "faint" }) }), [slabShape(head, 24, 8)]);
  const FL = G.frameAlong([-76, AY, 28], [1, 0, 0]);
  put("stage.interferometer-lens", "stage", [-75, AY, 28], S(G.disc(0, 1.6, 2.6, FL, P, { bevel: 0.2 }), { tone: "mid" }) + L(G.circleOf(FL, 1.6, 1.4, P, 24), { tone: "lo" }), [A.disc(FL, 0, 1.6, 2.6, {})]);

  // the wafer: die grid, the measured site, the overlay mark (both enlarged, illustrative)
  const top = WZ + WT;
  const die = 8;
  const grid = [];
  for (let i = -3; i <= 3; i++) {
    const c = i * die + die / 2;
    if (Math.abs(c) >= WR - 0.5) continue;
    const h = Math.sqrt(WR * WR - c * c);
    grid.push(k.lineOnTop([MX + c, AY - h], [MX + c, AY + h], top, P));
    grid.push(k.lineOnTop([MX - h, AY + c], [MX + h, AY + c], top, P));
  }
  const site = { x: MX + SITE - 1.6, y: AY - 1.6, w: 3.2, d: 3.2, r: 0 };
  const markOuter = { x: MX + MARK - 2, y: AY - 2, w: 4, d: 4, r: 0 };
  const markInner = { x: MX + MARK - 0.9, y: AY - 0.9, w: 1.8, d: 1.8, r: 0 };
  const svg =
    S(k.cylinder(MX, AY, WR, WZ, WT, P, 96, 0.4), { tone: "hi", crease: "lo" }) +
    L(grid.join(""), { tone: "faint" }) +
    L([site, markOuter, markInner].map((plan) => k.planOutline(plan, top, P, 1)).join(""), { tone: "mid" });
  put("wafer", "stage", [MX, AY, WZ + 0.6], svg, [cylShape(MX, AY, WR, WZ, WT)], { piece: "wafer" });
}

// the high-voltage tank and its cable gland
const HV = { x0: -182, x1: -152, y0: 16, y1: 44, h: 22, cy: 30, cz: 9, gapX: -92, down: -14 }; // the cable runs down the gap at (gapX, down), then along the floor to the tank's side

// ---- the column, sectioned: pole piece, objective, scan coils, condensers, gun, HV insulator ----
// the beam's half-width along the column: spreading from the tip, two condenser crossovers, focused by the objective
const KNOTS = [[186, 0], [164, 2.2], [149, 0], [135, 1.6], [127, 0], [103, 1.8], [89, 2.0], [WZ + WT, 0]];
function beamWidth(z) {
  for (let i = 0; i < KNOTS.length - 1; i++) {
    const [za, wa] = KNOTS[i];
    const [zb, wb] = KNOTS[i + 1];
    if (z <= za && z >= zb) return wa + ((wb - wa) * (za - z)) / (za - zb);
  }
  return 0;
}
function envelope(z0, z1) {
  const zs = [z1, ...KNOTS.map(([z]) => z).filter((z) => z < z1 && z > z0), z0];
  const side = (sign) => cutPath(zs.map((z) => [AX + sign * beamWidth(z), z]));
  return L(cutPath([[AX, z0], [AX, z1]]), { tone: "lo", className: "mt-beam" }) + L(side(-1) + side(1), { tone: "faint", className: "mt-beam mt-beam-edge" });
}

function column() {
  const coil = (w0, w1, z0, z1) => L(cutRect(AX - w1, AX - w0, z0, z1) + cutRect(AX + w0, AX + w1, z0, z1), { tone: "lo" });
  const winding = (w0, w1, z0, z1, n) => {
    const out = [];
    for (let i = 1; i < n; i++) {
      const z = z0 + ((z1 - z0) * i) / n;
      out.push(cutPath([[AX - w1, z], [AX - w0, z]]), cutPath([[AX + w0, z], [AX + w1, z]]));
    }
    return L(out.join(""), { tone: "faint" });
  };
  const aperture = (z, w) => L(cutRect(AX - w, AX - 0.9, z - 0.5, z + 0.5) + cutRect(AX + 0.9, AX + w, z - 0.5, z + 0.5), { tone: "mid" });
  // pole piece hanging below the lid, in machined steps
  const steps = [[60, 66, 18], [48, 60, 13], [38, 48, 8], [34, 38, 4.5]];
  for (const [z0, z1, r] of steps) half("col.pole", "objective", AX, r, z0, z1, { bore: 2.6, face: envelope(z0, z1), beam: false });
  const fb = [];
  for (let i = 1; i < 8; i++) {
    const t = (Math.PI * i) / 8;
    fb.push(at([AX + 28 * Math.cos(t), AY - 28 * Math.sin(t), 75]));
  }
  half("col.flange", "objective", AX, 30, 72, 75, { bevel: 0.4, bore: 2.6, beam: false, face: envelope(72, 75) + Dots(fb, { size: 0.45 }) });
  half("col.objective", "objective", AX, 26, 75, 103, { seams: [89], bore: 2.6, beam: false, face: coil(6, 21, 79, 99) + winding(6, 21, 79, 99, 6) + L(cutRect(AX - 23, AX - 4, 77, 101) + cutRect(AX + 4, AX + 23, 77, 101), { tone: "faint" }) + envelope(75, 103) });
  half("col.scan", "scan", AX, 15, 103, 119, { bore: 2.6, beam: false, face: coil(4.5, 11.5, 105, 110.5) + coil(4.5, 11.5, 111.5, 117) + envelope(103, 119) });
  half("col.cond2", "condenser", AX, 21, 119, 135, { bore: 2.6, beam: false, face: coil(5, 17, 121.5, 132.5) + winding(5, 17, 121.5, 132.5, 4) + aperture(120.4, 4.6) + envelope(119, 135) });
  half("col.spacer", "condenser", AX, 13, 135, 141, { bore: 2.6, beam: false, face: envelope(135, 141) });
  half("col.cond1", "condenser", AX, 21, 141, 157, { bore: 2.6, beam: false, face: coil(5, 17, 143.5, 154.5) + winding(5, 17, 143.5, 154.5, 4) + aperture(142.4, 4.6) + envelope(141, 157) });
  half("col.valve", "gun", AX, 14, 157, 164, { seams: [160.5], bore: 2.6, beam: false, face: envelope(157, 164) });
  // gun chamber: anode plates and the field-emission tip on its holder
  const plate = (z) => cutRect(AX - 14, AX - 2.4, z, z + 1.4) + cutRect(AX + 2.4, AX + 14, z, z + 1.4);
  const anode = L(plate(171) + plate(176), { tone: "mid" });
  const holder = L(cutPath([[AX - 4, 198], [AX - 4, 190], [AX - 1.4, 190], [AX, 186], [AX + 1.4, 190], [AX + 4, 190], [AX + 4, 198]]), { tone: "mid" });
  const gunBeam = L(cutPath([[AX, 186], [AX, 164]]), { tone: "lo", className: "mt-beam" }) + L(cutPath([[AX, 186], [AX - 2.2, 164]]) + cutPath([[AX, 186], [AX + 2.2, 164]]), { tone: "faint", className: "mt-beam mt-beam-edge" });
  half("col.gun", "gun", AX, 18, 164, 198, { bore: 0, beam: false, face: anode + holder + gunBeam, seams: [181] });
  // HV insulator: core and sheds, then the connector
  const ins = [[198, 201, 10], [201, 203, 14], [203, 206, 10], [206, 208, 14], [208, 211, 10], [211, 213, 14], [213, 219, 10]];
  for (const [z0, z1, r] of ins) half("col.insulator", "gun", AX, r, z0, z1, { bore: 0, beam: false, tone: "mid" });
  half("col.connector", "gun", AX, 5, 219, 226, { bore: 0, beam: false, seams: [222.5] });
  // ion pump on a neck, sectioned with the gun
  halfAlongX("col.pump-neck", "gun", [AX, AY, 181], 1, 3.5, 17.66, 25);
  const pump = box(AX + 25, AX + 39, AY - 14, AY, 0.4);
  const cells = [];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) cells.push(cutRect(AX + 26.6 + i * 4.2, AX + 29.8 + i * 4.2, 172 + j * 5, 176 + j * 5));
  block("col.ion-pump", "gun", pump, 170, 22, { extra: L(cells.join(""), { tone: "lo" }) });
  // high-voltage supply: an oil-filled tank on the base plate in front of the console
  const tank = box(HV.x0, HV.x1, HV.y0, HV.y1, 1);
  const fins = [];
  for (let z = 6; z <= 18; z += 4) fins.push(k.sideSeam(tank, z, P, 3));
  const tankScrews = k.corners(tank, 2.6);
  block("col.hv-tank", "gun", tank, 0, HV.h, { steps: 3, bevel: 0.6, extra: L(fins.join(""), { tone: "faint" }) + Dots(tankScrews.map(([x, y]) => at([x, y, HV.h])), { size: 0.45 }) });
  const FG = G.frameAlong([HV.x1, HV.cy, HV.cz], [1, 0, 0]);
  put("col.hv-gland", "gun", [HV.x1 + 1.5, HV.cy, HV.cz], S(G.disc(0, 3, 4, FG, P, { bevel: 0.3 }), { tone: "mid" }), [A.disc(FG, 0, 3, 4, {})]);
}

// ---- secondary electron detector on the objective, sectioned: collector, scintillator, light guide, preamp ----
function detector() {
  const z = 89;
  halfAlongX("det.neck", "detector", [AX, AY, z], -1, 4, 25.69, 36, { face: L(cutRect(AX - 35, AX - 28, z - 2.6, z + 2.6), { tone: "lo" }) });
  halfAlongX("det.body", "detector", [AX, AY, z], -1, 7, 36, 48, { face: L(cutRect(AX - 46.5, AX - 38, z - 5, z + 5) + cutRect(AX - 40, AX - 38.8, z - 5, z + 5), { tone: "lo" }) });
  const amp = box(AX - 64, AX - 48, AY - 9, AY, 0.4);
  block("det.preamp", "detector", amp, 82, 14, { extra: L(cutRect(AX - 62, AX - 50, 84, 94), { tone: "faint" }) });
}

// ---- optical head: barrel through the lid, camera, LED illuminator ----
function optical() {
  const lens = (z, w) => L(cutPath([[OX - w, z], [OX + w, z], [OX + w, z + 1.2], [OX - w, z + 1.2]], true), { tone: "lo" });
  half("opt.nose", "optical", OX, 3.5, 40, 44, { bore: 0, beam: false, face: lens(41, 2.2) });
  half("opt.barrel", "optical", OX, 5, 44, CH.top, { bore: 0, beam: false, face: lens(50, 3.6) + lens(58, 3.6) });
  half("opt.flange", "optical", OX, 9, CH.lid, CH.lid + 2, { bore: 0, beam: false });
  half("opt.tube", "optical", OX, 6, CH.lid + 2, 94, { bore: 0, beam: false, seams: [84], face: lens(78, 4.4) + lens(88, 4.4) });
  halfAlongX("opt.led-neck", "optical", [OX, AY, 84], 1, 2.2, 5.58, 12);
  block("opt.led", "optical", box(OX + 12, OX + 18, AY - 5, AY, 0.4), 80, 8, {});
  const cam = box(OX - 8, OX + 8, AY - 12, AY, 0.8);
  block("opt.camera", "optical", cam, 94, 10, { bevel: 0.4, extra: L(cutRect(OX - 5, OX + 5, 96, 102), { tone: "faint" }) });
}

// ---- turbo pump on the chamber's right wall, foreline to the floor ----
const TZ = 42;
function vacuum() {
  const F = G.frameAlong([CH.x1, 27, TZ], [1, 0, 0]);
  const flange = S(G.disc(0, 3, 12, F, P, { bevel: 0.3 }), { tone: "mid" }) + Dots(G.dotsOf(F, 3, 10, 12, P, { fade: [0.04, 0.42] }), { size: 0.45 });
  put("vac.flange", "chamber", [CH.x1 + 1.5, 27, TZ], flange, [A.disc(F, 0, 3, 12, {})]);
  const ribs = G.ribsOf(F, 6, 24, 10, 40, P, { fade: [0.1, 0.55], seams: true });
  const body = S(G.disc(3, 27, 10, F, P), { tone: "mid", inner: k.fadedSvg(ribs, { tone: "faint" }) });
  put("vac.turbo", "chamber", [CH.x1 + 15, 27, TZ], body, [A.disc(F, 3, 27, 10, {})]);
  put("vac.cap", "chamber", [CH.x1 + 29, 27, TZ], S(G.disc(27, 31, 6, F, P, { bevel: 0.3 }), { tone: "mid" }), [A.disc(F, 27, 31, 6, {})]);
  // foreline: out of the cap, down to a floor feedthrough
  const boss = [CH.x1 + 40, 31];
  put("vac.boss", "chamber", [boss[0], boss[1], 1], S(k.cylinder(boss[0], boss[1], 5, 0, 2.4, P, 28, 0.3), { tone: "mid" }), [cylShape(boss[0], boss[1], 5, 0, 2.4)]);
  pipe("vac.foreline", "chamber", [[CH.x1 + 31, 27, TZ], [boss[0], 27, TZ], [boss[0], boss[1], TZ - 8], [boss[0], boss[1], 2.4]], 2.4, { limp: false });
}

// ---- operator console with the monitor that shows the image forming ----
const SCREEN = { x0: -182, x1: -118, z0: 84, z1: 126, y: -32 };
const SW = SCREEN.x1 - SCREEN.x0;
const SH = SCREEN.z1 - SCREEN.z0;
function planeMatrix(o, ex, ey) {
  const p0 = at(o);
  const px = at(G.add3(o, ex));
  const py = at(G.add3(o, ey));
  const v = (x) => x.toFixed(4);
  return `matrix(${v(px[0] - p0[0])} ${v(px[1] - p0[1])} ${v(py[0] - p0[0])} ${v(py[1] - p0[1])} ${p0[0].toFixed(2)} ${p0[1].toFixed(2)})`;
}

function console_() {
  const cab = box(-186, -118, -70, -14, 1);
  const vents = [];
  for (let i = 0; i < 5; i++) vents.push(k.pathOf([[-176 + i * 6, 46], [-172 + i * 6, 46], [-172 + i * 6, 54], [-176 + i * 6, 54]].map(([x, z]) => at([x, -14, z])), true));
  const drawer = k.pathOf([[-180, 8], [-124, 8], [-124, 34], [-180, 34]].map(([x, z]) => at([x, -14, z])), true);
  block("console.cabinet", "console", cab, 0, 62, { steps: 2, bevel: 0.6, seam: [40], extra: L(vents.join(""), { tone: "lo" }) + L(drawer, { tone: "faint" }) + Dots([at([-152, -14, 24])], { size: 0.8, tone: "mid" }) });
  const desk = box(-190, -114, -74, 10, 1.4);
  block("console.desk", "console", desk, 62, 4, { steps: 3, bevel: 0.8 });
  const kb = box(-176, -134, -26, -12, 1);
  const keys = [];
  for (let i = 0; i < 12; i++) for (let j = 0; j < 3; j++) keys.push(at([kb.x + 3 + i * 3.3, kb.y + 3 + j * 4, 67.6]));
  block("console.keyboard", "console", box(-176, -134, -26, -12, 1), 66, 1.6, { tone: "mid", extra: Dots(keys, { size: 0.42, tone: "lo" }) });
  put("console.trackball", "console", [-124, -18, 67], S(k.cylinder(-124, -18, 5, 66, 2.4, P, 32, 0.3), { tone: "mid" }) + S(G.sphereOf([-124, -18, 70.4], 2.4, P, { steps: 28 }), { tone: "hi" }), [cylShape(-124, -18, 5, 66, 2.4), A.ball([-124, -18, 70.4], 2.4, {})]);
  const foot = box(-160, -140, -44, -30, 1.4);
  block("console.foot", "console", foot, 66, 2, { bevel: 0.3 });
  put("console.neck", "console", [-150, -36, 74], S(k.cylinder(-150, -36, 3, 68, 12, P, 24), { tone: "mid", crease: "none" }), [cylShape(-150, -36, 3, 68, 12)]);
  // monitor case; the screen is drawn in the plane of its front face
  const caseP = box(-186, -114, -40, -32, 1.2);
  const m = planeMatrix([SCREEN.x0, SCREEN.y + 0.02, SCREEN.z1], [1, 0, 0], [0, 0, -1]);
  const bezel = k.pathOf([[SCREEN.x0 - 1.6, SCREEN.z0 - 1.6], [SCREEN.x1 + 1.6, SCREEN.z0 - 1.6], [SCREEN.x1 + 1.6, SCREEN.z1 + 1.6], [SCREEN.x0 - 1.6, SCREEN.z1 + 1.6]].map(([x, z]) => at([x, SCREEN.y, z])), true);
  const lamp = Dots([at([SCREEN.x1 - 2, SCREEN.y, SCREEN.z0 - 2.4])], { size: 0.6, tone: "mid" });
  const screen = `<g transform="${m}"><clipPath id="mt-clip-screen"><rect x="0" y="0" width="${SW}" height="${SH}"/></clipPath><g clip-path="url(#mt-clip-screen)" class="mt-screen" id="mt-screen-live">${screenContent()}</g></g>`;
  put("console.monitor", "console", centreOf(caseP, 105), S(k.slabOf(caseP, 80, 50, P, 3, 0.6), { tone: "mid" }) + L(bezel, { tone: "lo" }) + screen + lamp, [slabShape(caseP, 80, 50, 3)]);
}

// ---- what the monitor shows, in screen units (u right, v down, 64 x 42) ----
const IMG = { u: 2, v: 2, w: 36, h: 36, rows: 72 };
const PLOT = { u: 40, v: 4, w: 22, h: 16 };
const LINES = 4;
function noise(i, j) {
  const s = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453;
  return s - Math.floor(s) - 0.5;
}
const cdScreen = (IMG.w / LINES) * 0.5; // a line is half its pitch wide on screen
function lineEdges(line, row) {
  const c = IMG.u + (IMG.w * (line + 0.5)) / LINES;
  const rough = 0.32;
  return [c - cdScreen / 2 + rough * noise(line, row), c + cdScreen / 2 + rough * noise(line + 9, row)];
}
const MID_ROW = Math.floor(IMG.rows / 2);
// intensity across the image along one row, 0..1: dark ground, grey resist, bright edges
function profileAt(u, row = MID_ROW) {
  let value = 0.16;
  for (let l = 0; l < LINES; l++) {
    const [a, b] = lineEdges(l, row);
    if (u > a && u < b) value = 0.42;
    value += 0.55 * Math.exp(-(((u - a) / 0.55) ** 2)) + 0.55 * Math.exp(-(((u - b) / 0.55) ** 2));
  }
  return Math.min(1, value);
}
const f = (v) => (Math.round(v * 100) / 100).toString();
function screenContent() {
  const out = [];
  out.push(`<rect class="mt-glass" x="0" y="0" width="${SW}" height="${SH}"/>`);
  // wafer map (load, navigate)
  const mapR = 15;
  const mc = [IMG.u + IMG.w / 2, IMG.v + IMG.h / 2];
  const dies = [];
  const step = (2 * mapR) / 7.5;
  for (let i = -3; i <= 3; i++) {
    const c = i * step + step / 2;
    if (Math.abs(c) >= mapR) continue;
    const h = Math.sqrt(mapR * mapR - c * c);
    dies.push(`M${f(mc[0] + c)} ${f(mc[1] - h)}V${f(mc[1] + h)}M${f(mc[0] - h)} ${f(mc[1] + c)}H${f(mc[0] + h)}`);
  }
  const mapScale = mapR / WR;
  const siteU = mc[0] + SITE * mapScale;
  const markU = mc[0] + MARK * mapScale;
  out.push(`<g data-mode="map"><circle class="mt-ink" cx="${f(mc[0])}" cy="${f(mc[1])}" r="${mapR}"/><path class="mt-ink mt-thin" d="${dies.join("")}"/>`);
  out.push(`<rect class="mt-ink" x="${f(siteU - 1.2)}" y="${f(mc[1] - 1.2)}" width="2.4" height="2.4"/><rect class="mt-ink" x="${f(markU - 1.2)}" y="${f(mc[1] - 1.2)}" width="2.4" height="2.4"/>`);
  out.push(`<g data-mode="defects">${M.DEFECTS.map(([u, v]) => `<circle class="mt-defect" data-part="defect" cx="${f(mc[0] + u)}" cy="${f(mc[1] + v)}" r="0.9"/>`).join("")}</g>`);
  out.push(`<g data-part="cross" transform="translate(${f(markU)} ${f(mc[1])})"><path class="mt-cursor" d="M-4 0H-1.6M1.6 0H4M0 -4V-1.6M0 1.6V4"/><circle class="mt-cursor" r="1.6"/></g></g>`);
  // optical image of the overlay mark: outer box from layer 1, inner box from layer 2, offset by the overlay error
  const oc = [IMG.u + IMG.w / 2, IMG.v + IMG.h / 2];
  const shift = [M.RUN.ovlXNm * 0.9, -M.RUN.ovlYNm * 0.9];
  out.push(`<g data-mode="overlay" style="display:none"><rect class="mt-fill-lo" x="${f(oc[0] - 13)}" y="${f(oc[1] - 13)}" width="26" height="26"/><rect class="mt-glass" x="${f(oc[0] - 9)}" y="${f(oc[1] - 9)}" width="18" height="18"/>`);
  out.push(`<rect class="mt-fill-hi" x="${f(oc[0] - 4.5 + shift[0])}" y="${f(oc[1] - 4.5 + shift[1])}" width="9" height="9"/><path class="mt-cursor" d="M${f(oc[0])} ${f(oc[1] - 15)}V${f(oc[1] + 15)}M${f(oc[0] - 15)} ${f(oc[1])}H${f(oc[0] + 15)}"/></g>`);
  // SEM image, revealed row by row
  const rowH = IMG.h / IMG.rows;
  const bodies = [];
  const edges = [];
  for (let r = 0; r < IMG.rows; r++) {
    const v0 = IMG.v + r * rowH;
    for (let l = 0; l < LINES; l++) {
      const [a, b] = lineEdges(l, r);
      bodies.push(`M${f(a)} ${f(v0)}H${f(b)}v${f(rowH + 0.02)}H${f(a)}z`);
      edges.push(`M${f(a - 0.5)} ${f(v0)}h1v${f(rowH + 0.02)}h-1z`, `M${f(b - 0.5)} ${f(v0)}h1v${f(rowH + 0.02)}h-1z`);
    }
  }
  out.push(`<g data-mode="sem" style="display:none"><clipPath id="mt-clip-rows"><rect data-part="rows" x="${IMG.u}" y="${IMG.v}" width="${IMG.w}" height="0"/></clipPath>`);
  out.push(`<rect class="mt-frame" x="${IMG.u}" y="${IMG.v}" width="${IMG.w}" height="${IMG.h}"/>`);
  out.push(`<g clip-path="url(#mt-clip-rows)"><rect class="mt-fill-ground" x="${IMG.u}" y="${IMG.v}" width="${IMG.w}" height="${IMG.h}"/><path class="mt-fill-lo" d="${bodies.join("")}"/><path class="mt-fill-hi" d="${edges.join("")}"/></g>`);
  out.push(`<rect class="mt-scanline" data-part="scanline" x="${IMG.u}" y="${IMG.v}" width="${IMG.w}" height="0.5"/>`);
  // edge markers on the measured line, the mid row
  const [ea, eb] = lineEdges(1, MID_ROW);
  const mv = IMG.v + (MID_ROW + 0.5) * rowH;
  out.push(`<g data-part="edges" style="opacity:0"><path class="mt-cursor" d="M${f(IMG.u)} ${f(mv)}H${f(IMG.u + IMG.w)}"/><path class="mt-mark" d="M${f(ea)} ${f(mv - 4)}V${f(mv + 4)}M${f(eb)} ${f(mv - 4)}V${f(mv + 4)}M${f(ea)} ${f(mv + 3)}H${f(eb)}"/></g></g>`);
  // right panel: status words
  const label = (mode, text) => `<text class="mt-text" data-mode="${mode}" x="${PLOT.u}" y="${PLOT.v + 5}" style="display:none">${text}</text>`;
  out.push(label("t-load", "LOAD"), label("t-align", "ALIGN"), label("t-inspect", "INSPECT"), label("t-ovlh", "OVERLAY"), label("t-scan", "SCAN"), label("t-image", "IMAGE"));
  out.push(`<text class="mt-text mt-small" data-mode="t-ovl" x="${PLOT.u}" y="${PLOT.v + 12}" style="display:none">dx ${M.RUN.ovlXNm.toFixed(1)}</text><text class="mt-text mt-small" data-mode="t-ovl" x="${PLOT.u}" y="${PLOT.v + 18}" style="display:none">dy ${M.RUN.ovlYNm.toFixed(1)}</text><text class="mt-text mt-small" data-mode="t-ovl" x="${PLOT.u}" y="${PLOT.v + 24}" style="display:none">nm</text>`);
  out.push(`<text class="mt-text mt-small" data-mode="t-defects" data-part="defcount" x="${PLOT.u}" y="${PLOT.v + 12}" style="display:none">0 DEFECTS</text>`);
  out.push(`<text class="mt-text mt-small" data-mode="t-rows" data-part="rowcount" x="${PLOT.u}" y="${PLOT.v + 12}" style="display:none">0/${M.RUN.rows}</text>`);
  // right panel: the line profile with its threshold and the two edges
  const pts = [];
  for (let i = 0; i <= 120; i++) {
    const u = IMG.u + (IMG.w * i) / 120;
    pts.push(`${f(PLOT.u + (PLOT.w * i) / 120)} ${f(PLOT.v + PLOT.h - profileAt(u) * PLOT.h)}`);
  }
  const thr = PLOT.v + PLOT.h - 0.5 * (0.16 + 0.97) * PLOT.h * 0.92;
  const toPlot = (u) => PLOT.u + ((u - IMG.u) / IMG.w) * PLOT.w;
  out.push(`<g data-mode="profile" style="display:none"><clipPath id="mt-clip-plot"><rect data-part="sweep" x="${PLOT.u}" y="${PLOT.v - 1}" width="0" height="${PLOT.h + 2}"/></clipPath><rect class="mt-frame" x="${PLOT.u}" y="${PLOT.v}" width="${PLOT.w}" height="${PLOT.h}"/><path class="mt-dash" d="M${PLOT.u} ${f(thr)}H${PLOT.u + PLOT.w}"/><path class="mt-trace" clip-path="url(#mt-clip-plot)" d="M${pts.join("L")}"/><path class="mt-mark" data-part="pedges" style="opacity:0" d="M${f(toPlot(ea))} ${PLOT.v}V${PLOT.v + PLOT.h}M${f(toPlot(eb))} ${PLOT.v}V${PLOT.v + PLOT.h}"/></g>`);
  // right panel: the result against its spec window
  const lo = M.RUN.targetNm - 2 * M.RUN.specNm;
  const hi = M.RUN.targetNm + 2 * M.RUN.specNm;
  const gx = (nm) => PLOT.u + ((nm - lo) / (hi - lo)) * PLOT.w;
  out.push(`<g data-mode="result" style="display:none"><text class="mt-text mt-big" data-part="cd" x="${PLOT.u}" y="${PLOT.v + 8}">${M.RUN.cdNm.toFixed(1)}</text><text class="mt-text mt-small" x="${PLOT.u}" y="${PLOT.v + 13}">CD · nm</text>`);
  out.push(`<rect class="mt-frame" x="${PLOT.u}" y="${PLOT.v + 16}" width="${PLOT.w}" height="4"/><rect class="mt-fill-lo" x="${f(gx(M.RUN.targetNm - M.RUN.specNm))}" y="${PLOT.v + 16}" width="${f(gx(M.RUN.targetNm + M.RUN.specNm) - gx(M.RUN.targetNm - M.RUN.specNm))}" height="4"/><path class="mt-mark" d="M${f(gx(M.RUN.cdNm))} ${PLOT.v + 14.5}V${PLOT.v + 21.5}"/>`);
  out.push(`<text class="mt-text mt-small" x="${PLOT.u}" y="${PLOT.v + 28}">${M.passes ? "PASS" : "FAIL"}</text></g>`);
  // right panel: SPC chart, history and the new point
  const C = { u: PLOT.u, v: PLOT.v, w: PLOT.w, h: 30 };
  const span = M.RUN.specNm * 1.2;
  const cy = (nm) => C.v + C.h / 2 - ((nm - M.RUN.targetNm) / span) * (C.h / 2);
  const n = M.RUN.history.length + 1;
  const cx = (i) => C.u + 1.5 + ((C.w - 3) * i) / (n - 1);
  const hist = M.RUN.history.map((nm, i) => `<circle class="mt-dot" cx="${f(cx(i))}" cy="${f(cy(nm))}" r="0.55"/>`).join("");
  const trend = M.RUN.history.map((nm, i) => `${f(cx(i))} ${f(cy(nm))}`).join("L");
  out.push(`<g data-mode="spc" style="display:none"><rect class="mt-frame" x="${C.u}" y="${C.v}" width="${C.w}" height="${C.h}"/><path class="mt-dash" d="M${C.u} ${f(cy(M.RUN.targetNm + M.RUN.limitNm))}H${C.u + C.w}M${C.u} ${f(cy(M.RUN.targetNm - M.RUN.limitNm))}H${C.u + C.w}"/><path class="mt-thin-line" d="M${C.u} ${f(cy(M.RUN.targetNm))}H${C.u + C.w}"/><path class="mt-trace" d="M${trend}"/>${hist}`);
  out.push(`<g data-part="newpoint" style="opacity:0"><path class="mt-trace" d="M${f(cx(n - 2))} ${f(cy(M.RUN.history[n - 2]))}L${f(cx(n - 1))} ${f(cy(M.RUN.cdNm))}"/><circle class="mt-new" cx="${f(cx(n - 1))}" cy="${f(cy(M.RUN.cdNm))}" r="1.1"/></g>`);
  out.push(`<text class="mt-text mt-small" x="${C.u}" y="${C.v + C.h + 6}">LOT ${M.lot}</text></g>`);
  return out.join("");
}

// ---- pipes and cables ----
function pipe(name, part, points, r, { limp = true, shells = [false, false], bend = 6, tone = "mid" } = {}) {
  const route = G.fillet(points, Math.max(bend, r * 2.6), 10, { P, tube: r });
  const total = G.pathLength(route);
  const SHELL = Math.max(2, r * 2.4);
  const gaps = [...(shells[0] ? [[0, SHELL]] : []), ...(shells[1] ? [[total - SHELL, total]] : [])];
  R.route(name, route, r, { gaps, limp, rims: shells.map((on) => (on ? r * 1.8 : r)), piece: "static" });
  Tube.tubePieces(route, r, P, { maxLength: 14, spacing: Math.max(0.6, Math.min(1.6, r)), gaps }).forEach((piece, index) =>
    R.put({ piece: "static", at: piece.mid, bias: 0.05, svg: tubeSvgOf(piece, tone), move: [0, 0, 0], shapes: [A.tube(piece.points, piece.radii, { name: `${name}:${index}` })], name: `${name}:${index}`, route: name, chunk: index, part }),
  );
  [0, 1].forEach((index) => {
    if (!shells[index]) return;
    const end = index ? route[route.length - 1] : route[0];
    const tangent = G.tangentAlong(route, index ? total : 0);
    const F = G.frameAlong(end, tangent);
    const [s0, s1] = index ? [-SHELL, 0] : [0, SHELL];
    put(`${name}.shell`, part, G.add3(end, G.mul3(tangent, (s0 + s1) / 2)), S(G.disc(s0, s1, r * 1.8, F, P, { bevel: 0.2 }), { tone: "mid" }), [A.disc(F, s0, s1, r * 1.8, { owner: name })], { bias: 0.15 });
  });
}
const tubeSvgOf = (piece, tone) => Tube.tubeSvg(piece, { tone });

function cables() {
  // high voltage from the gun's connector, down the gap beside the chamber and along the base plate to the tank's gland
  pipe("cable.hv", "gun", [[AX, AY - 3, 226], [AX, AY - 3, 234], [HV.gapX, HV.down, 234], [HV.gapX, HV.down, HV.cz], [HV.gapX, HV.cy, HV.cz], [HV.x1 + 3, HV.cy, HV.cz]], 1.3, { shells: [false, true], bend: 7 });
  // detector signal from the preamp to the monitor case
  pipe("cable.signal", "detector", [[AX - 64, AY - 4.5, 89], [-98, AY - 4.5, 89], [-106, -36, 104], [-114, -36, 104]], 0.9, { shells: [true, true], bend: 6 });
}

// ---- the beam under the pole piece and its spot on the wafer ----
function beam() {
  const tip = [AX, AY, 34];
  const spot = [AX, AY, WZ + WT];
  const svg = `<g class="mt-wafer-beam">${L(path3([tip, spot]), { tone: "lo", className: "mt-beam mt-beam-low" })}${Dots([at(spot)], { size: 1.1, tone: "hi" }).replace("iso-dots", "iso-dots mt-spot")}</g>`;
  put("beam", "objective", [AX, AY, 31], svg, [A.cylinder(AX, AY, 0.3, WZ + WT, 34 - WZ - WT, {})], { bias: 0.4 });
}

stand();
chamber();
gateValve();
loadLock();
stage();
column();
detector();
optical();
vacuum();
console_();
cables();
beam();

// the states the slider passes through, for the depth solver and the clearance replay
const T_SAMPLES = [];
for (let i = 0; i <= 80; i++) T_SAMPLES.push((2 * i) / 80);
const SLIDER_STATES = T_SAMPLES.map((T) => {
  const s = sharesAt(T, K);
  return { label: `T ${T.toFixed(3)}`, shares: { wafer: s.wafer, stage: s.stage } };
});
if (!process.argv.includes("--fast")) {
  const settled = A.settle(R, P, { states: [0, ...SLIDER_STATES] });
  if (process.env.MT_DEBUG) {
    const nm = (i) => settled.items[i].name;
    for (const rule of settled.solved.dropped) console.log("dropped", nm(rule.front), "over", nm(rule.back), rule.weight.toFixed(2), A.labelOf(rule.pair.state));
    for (const pair of settled.solved.cycles.slice(0, 20)) console.log("cycle", nm(pair.a), nm(pair.b), A.labelOf(pair.state));
  }
}
R.items.sort((a, b) => (a.key ?? 0) - (b.key ?? 0));
const groups = R.items.map((item, index) => {
  const key = item.key ?? G.dot3(item.at, V) + (item.bias ?? 0);
  const [mx, my, mz] = item.move;
  return `<g class="it" data-piece="${item.piece}" data-part="${item.part}" data-k="${key.toFixed(3)}" data-m="${mx.toFixed(1)},${my.toFixed(1)},${mz.toFixed(1)}" data-i="${index}">${item.svg}</g>`;
});

const unit = (vector) => {
  const o = at([0, 0, 0]);
  const p = at(vector);
  return [p[0] - o[0], p[1] - o[1]];
};
const ORDER = ["gun", "condenser", "scan", "objective", "detector", "stage", "chamber", "optical", "console"];
const DATA = {
  V,
  EX: unit([1, 0, 0]),
  EY: unit([0, 1, 0]),
  EZ: unit([0, 0, 1]),
  K,
  parts: M.PARTS,
  order: ORDER,
  steps: M.STEPS.map(({ id, name, seconds, say, inspect }) => ({ id, name, seconds, say, inspect })),
  rows: M.RUN.rows,
  idle: M.IDLE,
  spot: { at: at([AX, AY, WZ + WT]), tip: at([AX, AY, 34]), u: unit([1, 0, 0]), v: unit([0, 1, 0]) },
  img: { v: IMG.v, h: IMG.h, plot: PLOT },
  map: { from: 4 * (15 / WR), to: SITE * (15 / WR) },
};

const LABEL = `A CD-SEM cut away along the column's axis. On a base plate on isolators: the vacuum chamber with its front panel and the front of its lid removed, an x-y stage carrying the wafer on its chuck, a laser interferometer, a gate valve and a load lock with three lift pins, and a turbo pump. Above the lid, the sectioned electron column: field-emission gun with its ion pump and high-voltage insulator, two condenser lenses, scan coils, the objective lens and pole piece, the secondary electron detector, and beside it an optical head that finds alignment marks and makes a defect-inspection pass. On the base plate between console and chamber, the high-voltage tank, cabled to the gun. At left, the operator console whose monitor shows the image forming.`;
const svg = k.figureSvg({ width: W, height: H, label: LABEL, body: [`<g class="mt-layers">${groups.join("")}</g>`], className: "mt-svg" });

const PARTS = ORDER.map((id, index) => `<button type="button" class="mt-part" data-part="${id}"><span class="mt-num">${String(index + 1).padStart(2, "0")}</span>${M.PARTS[id].name}</button>`).join("");
const corners = `<div class="iso-plate-corners" aria-hidden="true"><span class="iso-plate-corner" data-corner="fig">Fig 1</span><span class="iso-plate-corner" data-corner="title">CD-SEM · cut away</span><span class="iso-plate-corner" data-corner="readout" data-readout>${M.IDLE}</span></div>`;
const controls = `<div class="mt-controls"><span class="mt-hint">Hover a part · Space plays the measurement</span><span class="mt-live" aria-live="polite" data-live></span></div>`;
const stageEl = `<div class="mt-stage" tabindex="0" role="slider" aria-label="CD-SEM, cut away. Hover, or use the arrow keys, to pick a part; Space plays or pauses the measurement; Escape returns the wafer to the load lock; the slider below steps through the measurement." aria-valuemin="0" aria-valuemax="${ORDER.length}" aria-valuenow="0" aria-valuetext="${M.IDLE}">${svg}</div>`;
const caption = `A critical-dimension SEM measures the width of printed lines by scanning a low-energy electron beam across them and counting the secondary electrons that come back up through the objective lens to the detector. The wafer enters through a load lock and gate valve so the chamber never loses its vacuum, an optical head finds the alignment marks, and the stage, read by a laser interferometer, brings the measured site under the column. The beam is kept at low energy so it charges and shrinks the delicate resist as little as possible: about ${M.FIRST.kev} kV acceleration on the first CD-SEM in ${M.FIRST.year}, ${M.NIST.landingEv} eV landing energy in the NIST study cited below, and down to ${M.GT2000.volts} V on Hitachi's ${M.GT2000.year} GT2000. The monitor plays one illustrative measurement: lines of ${M.RUN.targetNm.toFixed(0)} nm target width, a result of ${M.RUN.cdNm.toFixed(1)} nm against a ±${M.RUN.specNm.toFixed(1)} nm spec, an overlay reading of ${M.f1(M.RUN.ovlXNm)} and ${M.f1(M.RUN.ovlYNm)} nm and a defect map of ${M.DEFECTS.length} dots. In a fab, defect inspection and overlay run on their own dedicated tools; the one optical head stands in for both here. Those values, the wafer's die grid, the enlarged site and box-in-box mark, and all sizes and proportions are illustrative, not to scale.`;
const scrub = `<span class="mt-scrub"><button type="button" class="mt-play" data-play aria-label="Play the measurement"><span class="mt-play-icon" aria-hidden="true"></span><span data-play-text>Play</span></button><input type="range" class="mt-range" data-scrub min="0" max="1000" step="1" value="0" aria-label="Measurement progress, in ${M.STEPS.length} steps: the arrow keys move one step, Shift with an arrow a tenth of a step"><span class="mt-step" data-step>01 · ${M.STEPS[0].name}</span></span>`;
const inset = `<svg class="mt-inset" viewBox="-1.5 -1.5 ${SW + 3} ${SH + 3}" aria-hidden="true" focusable="false"><rect class="mt-inset-frame" x="-0.75" y="-0.75" width="${SW + 1.5}" height="${SH + 1.5}" rx="1"/><use href="#mt-screen-live"/></svg>`;
const insetTag = `<span class="mt-inset-tag" aria-hidden="true">Monitor · enlarged</span>`;
const body = `<figure class="iso-figure mt"><div class="iso-plate">${corners}${stageEl}${insetTag}${inset}${controls}</div><figcaption class="iso-legend">${scrub}<span class="mt-parts">${PARTS}</span><span class="iso-caption">${caption}</span></figcaption></figure>`;

const CSS = readFileSync(join(HERE, "metrology.css"), "utf8");
const LIVE = `const sharesAt = ${sharesAt.toString()};\n` + readFileSync(join(HERE, "live.js"), "utf8").replace("__DATA__", JSON.stringify(DATA));
const out = writeChapter({ slug: "metrology", figure: body, css: CSS, script: LIVE, lesson: LESSON });
console.log("wrote", out.file, `${out.kb} KB`, `${R.items.length} items`, `${R.solids.length} solids`);

A.auditOrExit(R, P, { frames: SLIDER_STATES, apart: false });
