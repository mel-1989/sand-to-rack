// High-NA EUV scanner (EXE:5000/5200 class) in cutaway. The slider follows the light from the tin plasma through the
// illuminator to the reticle, down the anamorphic projection optics in a cone 0.55 NA wide, then exposes two half fields
// (with a reticle swap between them) and stitches them into one full-size die.
// node build.mjs [--audit] [--fast]
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as M from "./model.mjs";

import { k, G, A, Tube } from "../../site/kit.mjs";
import { writeChapter } from "../../site/shell.mjs";
import { LESSON } from "./lesson.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

// ---- camera and world (x along the machine, y toward the viewer, z up; layout illustrative) ----
const W = 720;
const H = 470;
const AZIMUTH = 58;
const ELEVATION = 30;

// wafer scale: a 300 mm wafer is 2 * WAFER_R units
const WAFER_R = 36;
const MM = (2 * WAFER_R) / 300;
const HALF = M.HALF_FIELD_MM.map((v) => v * MM); // one half field at wafer scale
const DIE = [HALF[0], HALF[1] * 2]; // a stitched die (26 x 33 mm)

const PLATE = { x: -214, y: -112, w: 548, d: 204, r: 10 };
const PLATE_H = 12;
const FOOT_H = 6;

// frame
const SB = { x: -196, y: -70, w: 326, d: 134, r: 3 }; // scanner base frame
const SB_TOP = 10;
const WALL_Y = [-64, -58];
const WALL_X = [-96, 304];
const WALL_TOP = 270;
const POB_X = [-92, 76]; // projection optics box
const POB_FLOOR = [58, 64];
const POB_TOP = 240;
const DECK_Z = [244, 252];
const CEIL_Z = [264, 270];

// wafer stages: one exposing under the optics, one measuring the next wafer
const BM = { x: -184, y: -54, w: 290, d: 108, r: 2 };
const BM_TOP = 20;
const WC = [10, 0]; // exposure chuck centre
const MC = [-128, 0]; // measure chuck centre
const STAGE_TOP = 29;
const CHUCK_TOP = 35;
const WAFER_TOP = CHUCK_TOP + 1;

// source (right)
const VC = [252, 0];
const AP_OUT = 40;
const AP_IN = 37;
const V_FLOOR = [34, 40];
const V_TOP = 136;
const LID_TOP = 142;
const COL_TOP = 46;
const PL = [252, 0, 70];
const IF = [252, 0, 168];

// the light path in the plane y = 0, [x, z, mirror radius]; layout and mirror count illustrative
const PATH = {
  IF: [252, 168],
  FF: [278, 228, 13],
  PF: [192, 206, 12],
  GM: [118, 192, 10],
  RET: [60, 252],
  M1: [16, 214, 12],
  M2: [-52, 228, 12],
  M3: [44, 178, 14],
  M4: [-56, 160, 14],
  M5: [42, 128, 14],
  M6: [-36, 118, 12],
  M7: [-66, 80, 12],
  M8: [-25, 88],
};
const M8 = { x: WC[0], z: 88, r: 37, t: 6 }; // the big last mirror, face down over the wafer
const LEGS = [
  ["IF", "FF", "illuminator"],
  ["FF", "PF", "illuminator"],
  ["PF", "GM", "illuminator"],
  ["GM", "RET", "illuminator"],
  ["RET", "M1", "optics"],
  ["M1", "M2", "optics"],
  ["M2", "M3", "optics"],
  ["M3", "M4", "optics"],
  ["M4", "M5", "optics"],
  ["M5", "M6", "optics"],
  ["M6", "M7", "optics"],
  ["M7", "M8", "optics"],
];
const P3 = (name) => [PATH[name][0], 0, PATH[name][1]];

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [WALL_X[0], WALL_Y[0], CEIL_Z[1] + 4], [WALL_X[1], WALL_Y[0], CEIL_Z[1]], [POB_X[0], 20, DECK_Z[1] + 26]],
  W,
  H,
  { pad: 20, azimuth: AZIMUTH, elevation: ELEVATION },
);
const V = G.viewOf(P);
const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);
const path3 = (points, closed = false) => k.pathOf(points.map(at), closed);
const centreOf = (plan, z) => [plan.x + plan.w / 2, plan.y + plan.d / 2, z];
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const rad = (deg) => (deg * Math.PI) / 180;
const zFrame = (x, y, z = 0) => G.frameOf([x, y, z], [0, 0, 1], [1, 0, 0], [0, 1, 0]);

// ---- the recorder: every drawn item records its true shape ----
const R = A.recorder(P);
function put(piece, name, ref, svg, shapes, { bias = 0, ghost = false, attrs = "" } = {}) {
  const id = R.nameFor(name);
  shapes.forEach((shape) => (shape.name = shape.name ?? id));
  return R.put({ piece, at: ref, bias, svg, shapes: ghost ? shapes : shapes.map(R.solid), name: id, attrs });
}
function box(piece, name, [x0, y0, z0], [x1, y1, z1], style = {}, { r = 0.5, steps = 2, bevel = 0, extra = "", inner = "", bias = 0, attrs } = {}) {
  const plan = { x: x0, y: y0, w: x1 - x0, d: y1 - y0, r };
  return put(piece, name, [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], S(k.slabOf(plan, z0, z1 - z0, P, steps, bevel), { tone: "mid", ...style, inner }) + extra, [A.slab(plan, z0, z1 - z0, {}, steps)], { bias, attrs });
}
function cyl(piece, name, cx, cy, r, z0, h, style = {}, { steps = 32, bevel = 0, extra = "", inner = "", bias = 0, attrs } = {}) {
  return put(piece, name, [cx, cy, z0 + h / 2], S(k.cylinder(cx, cy, r, z0, h, P, steps, bevel), { tone: "mid", ...style, inner }) + extra, [A.cylinder(cx, cy, r, z0, h)], { bias, attrs });
}
function ringPrism(piece, name, ring, z0, h, style = {}, { extra = "", inner = "", bias = 0, ref, attrs } = {}) {
  const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length;
  const cy = ring.reduce((s, p) => s + p[1], 0) / ring.length;
  return put(piece, name, ref ?? [cx, cy, z0 + h / 2], S(k.extrude(ring, z0, h, P, { convex: false }), { tone: "mid", ...style, inner }) + extra, [A.extruded(ring, z0, h)], { bias, attrs });
}
function polyArc(cx, cy, aIn, aOut, v0, v1) {
  const outer = [];
  const inner = [];
  const cIn = aIn / Math.cos(rad(15));
  const cOut = aOut / Math.cos(rad(15));
  for (let v = v0; v <= v1 + 1e-6; v += 30) {
    outer.push([cx + cOut * Math.cos(rad(v)), cy + cOut * Math.sin(rad(v))]);
    inner.push([cx + cIn * Math.cos(rad(v)), cy + cIn * Math.sin(rad(v))]);
  }
  return [...outer, ...inner.reverse()];
}
function turned(piece, name, F, profile, style = {}, { extra = "", inner = "", bias = 0, bevel = 0, attrs } = {}) {
  const paths = G.solidOf(profile, F, P, { bevel });
  const mid = (profile[0][0] + profile[profile.length - 1][0]) / 2;
  return put(piece, name, G.add3(F.o, G.mul3(F.a, mid)), S(paths, { tone: "mid", ...style, inner }) + extra, [A.solid(F, profile)], { bias, attrs });
}

// a pipe between two real ports, flanged at both ends
function pipe(piece, name, points, r, { flange = r * 1.8, ft = 1.6, tone = "hi", maxLength = 16, bias = 0 } = {}) {
  const route = G.fillet(points, Math.max(3, r * 2.6), 8, { P, tube: r });
  const total = G.pathLength(route);
  const gaps = [[0, ft], [total - ft, total]];
  R.route(name, route, r, { piece, gaps, rims: [flange, flange] });
  Tube.tubePieces(route, r, P, { maxLength, gaps }).forEach((chunk, index) =>
    R.put({ piece, name: `${name}:${index}`, at: chunk.mid, bias, route: name, chunk: index, svg: Tube.tubeSvg(chunk, { tone }), shapes: [A.tube(chunk.points, chunk.radii)] }),
  );
  [0, 1].forEach((end) => {
    const p = end ? route[route.length - 1] : route[0];
    const tangent = G.tangentAlong(route, end ? total : 0);
    const F = G.frameAlong(p, tangent);
    const [s0, s1] = end ? [-ft, 0] : [0, ft];
    put(piece, `${name}.flange`, G.add3(p, G.mul3(tangent, (s0 + s1) / 2)), S(G.disc(s0, s1, flange, F, P, { bevel: 0.3 }), { tone: "mid" }), [A.disc(F, s0, s1, flange, { owner: name })], { bias: bias + 0.05 });
  });
  return route;
}

// ---- base plate (the fab floor) ----
function base() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  const shapes = [];
  for (const [x, y] of byDepth([...k.corners(PLATE, 26), [PLATE.x + PLATE.w / 2, PLATE.y + 26], [PLATE.x + PLATE.w / 2, PLATE.y + PLATE.d - 26]])) {
    out.push(S(k.cylinder(x, y, 8, -PLATE_H - FOOT_H, 1.8, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 6.2, -PLATE_H - FOOT_H + 1.8, FOOT_H - 1.8, P, 28), { tone: "mid" }));
    shapes.push(A.cylinder(x, y, 8, -PLATE_H - FOOT_H, FOOT_H, { name: "stand.foot" }));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid", inner: L(k.sideSeam(PLATE, -PLATE_H + 3.5, P, 8), { tone: "faint" }) }));
  shapes.push(A.slab(PLATE, -PLATE_H, PLATE_H, { name: "stand.plate" }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 6), 0, P), { tone: "lo" }));
  // raised-floor tiles, groove to groove
  const inner = k.insetPlan(PLATE, 6);
  const seams = [];
  const TILE = 48;
  for (let x = inner.x + TILE; x < inner.x + inner.w - 8; x += TILE) seams.push(k.lineOnTop([x, inner.y], [x, inner.y + inner.d], 0, P));
  for (let y = inner.y + TILE; y < inner.y + inner.d - 8; y += TILE) seams.push(k.lineOnTop([inner.x, y], [inner.x + inner.w, y], 0, P));
  out.push(L(seams.join(""), { tone: "faint" }));
  const holes = [];
  for (const [tx, ty] of [[inner.x + TILE * 9, inner.y + TILE * 3]]) for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) holes.push(at([tx + 6 + i * 5, ty + 6 + j * 5, 0]));
  out.push(Dots(holes, { size: 0.45, tone: "lo" }));
  const screws = k.corners(PLATE, 12);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.4, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(Dots(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // ruler along the near edge, at wafer scale: a tick every 10 mm, a major every 50 mm
  const strip = { x: -190, y: PLATE.y + PLATE.d - 17, w: 300 * MM + 12, d: 8, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 6, strip.x + 6 + 300 * MM, 10 * MM, 5, strip.y + 0.8, 0.6, [2.2, 4], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(Dots([at([strip.x + 2.5, strip.y + 4, 0.6]), at([strip.x + strip.w - 2.5, strip.y + 4, 0.6])], { size: 0.45 }));
  // label plate
  const label = { x: 214, y: PLATE.y + PLATE.d - 30, w: 96, d: 18, r: 1.5 };
  out.push(S(k.slabOf(label, 0, 0.8, P, 4), { tone: "lo", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.8), 0.8, P, 4), { tone: "faint" }));
  out.push(L([0, 1, 2].map((i) => k.lineOnTop([label.x + 8, label.y + 5 + i * 3.6], [label.x + 74 - i * 16, label.y + 5 + i * 3.6], 0.8, P)).join(""), { tone: "lo", free: true }));
  out.push(Dots([at([label.x + 4, label.y + label.d / 2, 0.8]), at([label.x + label.w - 4, label.y + label.d / 2, 0.8])], { size: 0.45 }));
  put("frame", "stand.base", [0, 0, -1], out.join(""), shapes, { bias: -2000 });
}

// ---- frame: base, back wall, the optics box, the reticle deck, the illuminator ceiling ----
function frame() {
  box("frame", "frame.base", [SB.x, SB.y, 0], [SB.x + SB.w, SB.y + SB.d, SB_TOP], { tone: "mid" }, {
    r: 3,
    steps: 3,
    bevel: 0.6,
    inner: L(k.sideSeam(SB, 4, P, 3), { tone: "faint" }),
    extra: Dots(k.corners(SB, 5).map(([x, y]) => at([x, y, SB_TOP])), { size: 0.5 }) + L(k.corners(SB, 5).map(([x, y]) => k.ring(x, y, 2, SB_TOP, P, 12)).join(""), { tone: "lo" }),
    bias: -50,
  });
  // back wall: the optics box's back panel is a separate, heavier slab on it
  const wall = { x: WALL_X[0], y: WALL_Y[0], w: WALL_X[1] - WALL_X[0], d: WALL_Y[1] - WALL_Y[0], r: 0.6 };
  const face = WALL_Y[1];
  const joints = [];
  for (const x of [POB_X[1] + 8, 210]) joints.push(k.segment([x, face, SB_TOP], [x, face, WALL_TOP], P));
  const bolts = [];
  for (let x = WALL_X[0] + 10; x < WALL_X[1] - 4; x += 12) bolts.push(at([x, face, WALL_TOP - 4]));
  box("frame", "frame.backwall", [wall.x, wall.y, SB_TOP], [wall.x + wall.w, wall.y + wall.d, WALL_TOP], { tone: "lo" }, { r: 0.6, inner: L(k.sideSeam(wall, 40, P, 2), { tone: "faint" }), extra: L(joints.join(""), { tone: "faint" }) + Dots(bolts, { size: 0.4, tone: "lo" }), bias: -40 });

  // projection optics box: back panel with bolt rows, an end wall cut open at the front, a floor round the exit
  const panel = { x: POB_X[0], y: face, w: POB_X[1] - POB_X[0], d: 3, r: 0.4 };
  const pbolts = [];
  for (let x = POB_X[0] + 6; x <= POB_X[1] - 5; x += 10) pbolts.push(at([x, face + 3, POB_TOP - 4]), at([x, face + 3, POB_FLOOR[1] + 4]));
  const pseams = [k.segment([-10, face + 3, POB_FLOOR[1]], [-10, face + 3, POB_TOP], P)];
  box("optics", "optics.panel", [panel.x, panel.y, POB_FLOOR[1]], [panel.x + panel.w, panel.y + panel.d, POB_TOP], { tone: "lo" }, { r: 0.4, inner: L(k.sideSeam(panel, 150, P, 2), { tone: "faint" }), extra: Dots(pbolts, { size: 0.42, tone: "mid" }) + L(pseams.join(""), { tone: "faint" }), bias: -20 });
  const endw = { x: POB_X[0] - 6, y: face, w: 6, d: 72, r: 0.6 };
  box("optics", "optics.endwall", [endw.x, endw.y, POB_FLOOR[0]], [endw.x + endw.w, endw.y + endw.d, POB_TOP], { tone: "mid" }, {
    r: 0.6,
    inner: L(k.sideSeam(endw, 150, P, 2), { tone: "faint" }),
    extra: Dots([90, 120, 180, 210].map((z) => at([endw.x + endw.w, endw.y + endw.d - 4, z])), { size: 0.4 }) + L(k.segment([endw.x + endw.w, endw.y + 36, POB_FLOOR[0]], [endw.x + endw.w, endw.y + 36, POB_TOP], P), { tone: "faint" }),
  });
  // floor: three bars round the exit opening the light cone passes through
  const slot = { x0: -18, x1: 38, y1: 26 };
  const floorBars = [
    [[POB_X[0], face], [slot.x0, 14]],
    [[slot.x1, face], [POB_X[1], 14]],
    [[slot.x0, face], [slot.x1, -26]],
  ];
  floorBars.forEach(([[x0, y0], [x1, y1]], i) =>
    box("optics", "optics.floor", [x0, y0, POB_FLOOR[0]], [x1, y1, POB_FLOOR[1]], { tone: "mid" }, { r: 0.6, bevel: 0.3, extra: i < 2 ? Dots([at([x0 + 4, y1 - 3, POB_FLOOR[1]]), at([x1 - 4, y1 - 3, POB_FLOOR[1]])], { size: 0.45 }) : "" }),
  );
  // the one engraved label, on the floor bar
  put("optics", "optics.mark", [-60, 4, POB_FLOOR[1]], k.faceTextSvg(k.topMatrix([-56, 6], POB_FLOOR[1], P, "x"), "NA 0.55", { size: 3, tone: "lo", anchor: "middle" }), [A.box([-70, 2, POB_FLOOR[1]], [-42, 10, POB_FLOOR[1] + 0.05])], { ghost: true, bias: 0.5 });

  // reticle deck: a U round the slot the light passes through
  const deckBars = [
    [[POB_X[0] - 6, face], [30, 20]],
    [[90, face], [112, 20]],
    [[30, face], [90, -20]],
  ];
  deckBars.forEach(([[x0, y0], [x1, y1]], i) => box("reticle", "reticle.deck", [x0, y0, DECK_Z[0]], [x1, y1, DECK_Z[1]], { tone: "mid" }, { r: 0.6, bevel: 0.3, extra: i < 2 ? Dots([at([x0 + 4, y1 - 3, DECK_Z[1]]), at([x1 - 4, y1 - 3, DECK_Z[1]])], { size: 0.45 }) : "" }));
  // illuminator ceiling with vent slots
  const ceil = { x: 120, y: face, w: WALL_X[1] - 120, d: 70, r: 0.6 };
  const vents = [];
  for (let i = 0; i < 8; i++) vents.push(k.planOutline({ x: 138 + i * 18, y: -44, w: 4, d: 38, r: 2 }, CEIL_Z[1], P, 3));
  box("illuminator", "illuminator.ceiling", [ceil.x, ceil.y, CEIL_Z[0]], [ceil.x + ceil.w, ceil.y + ceil.d, CEIL_Z[1]], { tone: "mid" }, { r: 0.6, bevel: 0.4, extra: L(vents.join(""), { tone: "faint" }) + Dots(k.corners(ceil, 4).map(([x, y]) => at([x, y, CEIL_Z[1]])), { size: 0.45 }) });
  // two posts carry the deck's free end
  for (const [x, y] of byDepth([[110, 12], [110, -48]])) cyl("frame", "frame.post", x, y, 3.5, SB_TOP, DECK_Z[0] - SB_TOP, { tone: "mid" }, { steps: 20, inner: L(k.sideArc(x, y, 3.5, 60, P, 16) + k.sideArc(x, y, 3.5, 200, P, 16), { tone: "faint" }) });
}

// ---- wafer stages: balance mass, two stage blocks, two chucks; a metrology bridge over the measure side ----
function waferStages() {
  box("wstage", "wstage.mass", [BM.x, BM.y, SB_TOP], [BM.x + BM.w, BM.y + BM.d, BM_TOP], { tone: "lo" }, {
    r: 2,
    steps: 3,
    bevel: 0.5,
    extra: L(k.planOutline(k.insetPlan(BM, 5), BM_TOP, P, 3), { tone: "faint" }) + L([0, 1, 2, 3, 4, 5, 6, 7].map((i) => k.lineOnTop([BM.x + 5, BM.y + 12 + i * 12], [BM.x + BM.w - 5, BM.y + 12 + i * 12], BM_TOP, P)).join(""), { tone: "faint" }),
  });
  for (const [id, [cx, cy]] of [["measure", MC], ["expose", WC]]) {
    const blk = { x: cx - 32, y: cy - 30, w: 64, d: 60, r: 2 };
    const pads = k.corners(blk, 4);
    const move = id === "expose" ? ' data-move="wafer"' : "";
    box("wstage", `wstage.${id}.block`, [blk.x, blk.y, BM_TOP], [blk.x + blk.w, blk.y + blk.d, STAGE_TOP], { tone: "mid" }, {
      r: 2,
      steps: 3,
      bevel: 0.5,
      inner: L(k.sideSeam(blk, BM_TOP + 3, P, 3), { tone: "faint" }),
      extra: L(pads.map(([x, y]) => k.ring(x, y, 1.8, STAGE_TOP, P, 12)).join(""), { tone: "lo" }) + Dots(pads.map(([x, y]) => at([x, y, STAGE_TOP])), { size: 0.45 }),
      attrs: move,
    });
    cyl("wstage", `wstage.${id}.chuck`, cx, cy, WAFER_R + 2, STAGE_TOP, CHUCK_TOP - STAGE_TOP, { tone: "mid" }, { steps: 72, bevel: 0.5, inner: L(k.sideArc(cx, cy, WAFER_R + 2, STAGE_TOP + 2, P, 48), { tone: "faint" }), attrs: move });
  }
  // metrology bridge: two columns and a beam with the alignment and level sensor heads
  const bx = MC[0];
  for (const y of [-48, 46]) box("wstage", "wstage.bridge.col", [bx - 5, y - 4, BM_TOP], [bx + 5, y + 4, 74], { tone: "mid" }, { r: 0.8, inner: L(k.sideSeam({ x: bx - 5, y: y - 4, w: 10, d: 8, r: 0.8 }, 30, P, 2), { tone: "faint" }) });
  const beam = { x: bx - 7, y: -52, w: 14, d: 102, r: 1 };
  box("wstage", "wstage.bridge.beam", [beam.x, beam.y, 74], [beam.x + beam.w, beam.y + beam.d, 82], { tone: "mid" }, { r: 1, bevel: 0.4, inner: L(k.sideSeam(beam, 78, P, 2), { tone: "faint" }), extra: Dots([-44, -20, 20, 44].map((y) => at([bx, y, 82])), { size: 0.45 }) });
  for (const [y, r] of [[-12, 4.6], [12, 3.6]]) {
    cyl("wstage", "wstage.sensor", bx, y, r, 56, 18, { tone: "hi", crease: "lo" }, { steps: 24, inner: L(k.sideArc(bx, y, r, 64, P, 16), { tone: "faint" }) });
    cyl("wstage", "wstage.sensor.tip", bx, y, r * 0.55, 50, 6, { tone: "mid" }, { steps: 16 });
  }
}

// ---- reticle stage: rails on the deck, pads, carriage, chuck; two reticles and a library ----
function reticleStage() {
  const top = DECK_Z[1] + 4;
  for (const x0 of [24, 90]) box("reticle", "reticle.rail", [x0, -52, DECK_Z[1]], [x0 + 6, 18, top], { tone: "mid" }, { r: 0.6, extra: L(k.lineOnTop([x0 + 3, -50.6], [x0 + 3, 16.6], top, P), { tone: "faint" }) });
  const move = ' data-move="reticle"';
  for (const x0 of [23, 89]) box("reticle", "reticle.pad", [x0, -12, top], [x0 + 8, 12, top + 4], { tone: "mid" }, { r: 0.6, attrs: move });
  const car = { x: 20, y: -15, w: 80, d: 30, r: 1.5 };
  box("reticle", "reticle.carriage", [car.x, car.y, top + 4], [car.x + car.w, car.y + car.d, top + 14], { tone: "mid" }, {
    r: 1.5,
    steps: 3,
    bevel: 0.5,
    inner: L(k.sideSeam(car, top + 9, P, 3), { tone: "faint" }),
    extra: L(k.planOutline(k.insetPlan(car, 4), top + 14, P, 3), { tone: "lo" }) + Dots(k.corners(car, 2.4).map(([x, y]) => at([x, y, top + 14])), { size: 0.45 }),
    attrs: move,
  });
  // the clamp the reticle hangs from, face down, under the carriage
  box("reticle", "reticle.chuck", [44, -13, top], [76, 13, top + 4], { tone: "mid" }, { r: 0.6, attrs: move });
  // reticles: A on the stage, B in the library; each carries its own fiducials (one dot, two dots)
  const mask = (id, cx, dots) => {
    const plan = { x: cx - 13, y: -11, w: 26, d: 22, r: 0.4 };
    const pat = { x: cx - 9, y: -8, w: 18, d: 16, r: 0.2 };
    const lines = [];
    for (let i = 1; i < 6; i++) lines.push(k.lineOnTop([pat.x + i * 3, pat.y], [pat.x + i * 3, pat.y + pat.d], DECK_Z[1] + 0.02, P));
    const fid = Dots(Array.from({ length: dots }, (_, i) => at([plan.x + 2.4 + i * 2, plan.y + 2.2, DECK_Z[1] + 4])), { size: 0.5, tone: "mid" });
    return put("reticle", `reticle.mask${id}`, [cx, 0, DECK_Z[1] + 2], S(k.slabOf(plan, DECK_Z[1] + 0.6, 3.4, P, 2, 0.3), { tone: "hi", crease: "lo", inner: L(k.sideSeam(plan, DECK_Z[1] + 2, P, 2), { tone: "faint" }) }) + fid, [A.slab(plan, DECK_Z[1] + 0.6, 3.4, {}, 2)], { attrs: ` data-mask="${id}"` });
  };
  mask("A", 60, 1);
  mask("B", 60, 2);
  // reticle library at the left end of the deck, its door toward the stage
  const lib = { x: -84, y: -44, w: 40, d: 40, r: 1 };
  box("reticle", "reticle.library", [lib.x, lib.y, DECK_Z[1]], [lib.x + lib.w, lib.y + lib.d, DECK_Z[1] + 16], { tone: "mid" }, {
    r: 1,
    steps: 3,
    bevel: 0.4,
    inner: L(k.sideSeam(lib, DECK_Z[1] + 5, P, 3) + k.sideSeam(lib, DECK_Z[1] + 10, P, 3), { tone: "faint" }),
    extra: L(k.planOutline(k.insetPlan(lib, 4), DECK_Z[1] + 16, P, 3), { tone: "lo" }) + Dots(k.corners(lib, 2).map(([x, y]) => at([x, y, DECK_Z[1] + 16])), { size: 0.4 }),
  });
  // a handler rail from the library to the stage
  box("reticle", "reticle.handler", [-44, -30, DECK_Z[1]], [20, -24, DECK_Z[1] + 3], { tone: "mid" }, { r: 0.5, extra: L(k.lineOnTop([-42.6, -27], [18.6, -27], DECK_Z[1] + 3, P), { tone: "faint" }) });
}

// ---- mirrors: a disc whose face is at the path point, normal bisecting the two legs, held by an arm from the back wall ----
function mirrorNormal(name) {
  const p = P3(name);
  const before = LEGS.find(([, b]) => b === name)[0];
  const after = LEGS.find(([a]) => a === name)[1];
  return G.unit3(G.add3(G.unit3(G.sub3(P3(before), p)), G.unit3(G.sub3(P3(after), p))));
}
function arm(piece, name, c, n, r, wallY) {
  const t = G.cross3(n, [0, 1, 0]);
  const Fa = G.frameOf([c[0], wallY, c[2]], [0, 1, 0], n, t);
  const poly = [[-2.2, -2.4], [2.2, -2.4], [2.2, 2.4], [-2.2, 2.4]];
  const len = c[1] - r - wallY + 0.05;
  const Fc = G.frameOf([c[0], wallY, c[2]], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
  const owner = `${piece}.arm.${name}`;
  put(piece, owner, [c[0], (wallY + c[1] - r) / 2, c[2]], S(G.disc(0, 2, 4.2, Fc, P), { tone: "mid" }) + S(G.prismOf(Fa, poly, 0, len, P), { tone: "mid" }), [A.disc(Fc, 0, 2, 4.2, { owner }), A.prism(Fa, poly, 0, len, { owner })]);
}
function mirror(piece, name, { faceted = false } = {}) {
  const [x, z, r] = PATH[name];
  const p = [x, 0, z];
  const n = mirrorNormal(name);
  const T = 5;
  const F = G.frameOf(p, n, [0, 1, 0], G.cross3(n, [0, 1, 0]));
  let extra = "";
  if (G.dot3(n, V) > 0.05) {
    extra += L(G.circleOf(F, 0, r * 0.82, P), { tone: "faint" });
    if (faceted) {
      const pts = [];
      for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) if (Math.hypot(i, j) * r * 0.22 < r * 0.76) pts.push(at(G.pointOf(F, 0, Math.hypot(i, j) * r * 0.22, Math.atan2(j, i))));
      extra += Dots(pts, { size: 0.35, tone: "lo" });
    }
  }
  const seam = L(G.arcOf(F, -T + 1.2, r, P), { tone: "faint" });
  put(piece, `${piece}.mirror.${name}`, G.add3(p, G.mul3(n, -T / 2)), S(G.disc(-T, 0, r, F, P, { bevel: 0.4 }), { tone: "hi", crease: "lo", inner: seam }) + extra, [A.disc(F, -T, 0, r)]);
  arm(piece, name, G.add3(p, G.mul3(n, -T / 2)), n, r, WALL_Y[1] + (piece === "optics" ? 3 : 0));
}
// the last mirror: twice the others' size, face down over the wafer, hung from a yoke on the back panel
function lastMirror() {
  const F = G.frameOf([M8.x, 0, M8.z], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
  const seam = L(G.arcOf(F, 2, M8.r, P) + G.arcOf(F, 4.2, M8.r, P), { tone: "faint" });
  const ribs = Dots(Array.from({ length: 12 }, (_, i) => at(G.pointOf(F, M8.t, M8.r - 3, (i / 12) * Math.PI * 2))), { size: 0.45, tone: "lo" });
  put("optics", "optics.mirror.M8", [M8.x, 0, M8.z + M8.t / 2], S(G.disc(0, M8.t, M8.r, F, P, { bevel: 0.6 }), { tone: "hi", crease: "lo", inner: seam }) + L(G.circleOf(F, M8.t, M8.r - 6, P), { tone: "faint" }) + ribs, [A.disc(F, 0, M8.t, M8.r)]);
  // three mounts on top of the mirror, carried by a yoke from the back panel
  const yokeZ = M8.z + M8.t + 8;
  const face = WALL_Y[1] + 3;
  box("optics", "optics.yoke", [M8.x - 5, face, yokeZ], [M8.x + 5, 14, yokeZ + 6], { tone: "mid" }, { r: 0.8, bevel: 0.3, extra: Dots([at([M8.x, 8, yokeZ + 6]), at([M8.x, -30, yokeZ + 6])], { size: 0.45 }) });
  for (const y of [-24, 8]) cyl("optics", "optics.m8mount", M8.x, y, 2.6, M8.z + M8.t, 8, { tone: "mid" }, { steps: 16 });
}

// ---- light: beam legs dot to dot, lit; the two exit cones; revealed by the slider ----
function beams() {
  LEGS.forEach(([a, b, piece], index) => {
    const pa = P3(a);
    const pb = P3(b);
    const svg = `<g class="hna-beam" data-leg="${index}">${L(path3([pa, pb]), { tone: "lit", className: "hna-ray" })}${Dots([at(pa), at(pb)], { size: 1.1, tone: "lit" })}</g>`;
    put(piece, `${piece}.beam`, G.lerp3(pa, pb, 0.5), svg, [A.tube([pa, pb], 0.5)], { ghost: true });
  });
}
// a cone from the wafer point up to a circle on the last mirror's face: a glow, two edge lines and the apex dot
function cone(id, na, cls) {
  const apex = [WC[0], 0, WAFER_TOP];
  const h = M8.z - WAFER_TOP;
  const r = h * Math.tan(Math.asin(na));
  const rim = Array.from({ length: 96 }, (_, i) => at([WC[0] + r * Math.cos((i / 96) * Math.PI * 2), r * Math.sin((i / 96) * Math.PI * 2), M8.z]));
  const a = at(apex);
  // tangent points: the rim points with the smallest and largest angle seen from the apex
  const ang = rim.map(([x, y]) => Math.atan2(x - a[0], -(y - a[1])));
  const lo = rim[ang.indexOf(Math.min(...ang))];
  const hi = rim[ang.indexOf(Math.max(...ang))];
  const hull = [a, ...rim.filter((p, i) => true)];
  // glow: apex, then the rim's near half between the two tangent points
  const iLo = ang.indexOf(Math.min(...ang));
  const iHi = ang.indexOf(Math.max(...ang));
  const arc = [];
  for (let i = iLo; ; i = (i + 1) % 96) {
    arc.push(rim[i]);
    if (i === iHi) break;
  }
  const arc2 = [];
  for (let i = iHi; ; i = (i + 1) % 96) {
    arc2.push(rim[i]);
    if (i === iLo) break;
  }
  // the half of the rim that lies further down the screen is the near half, it bounds the glow with the edges
  const lower = (pts) => pts.reduce((s, p) => s + p[1], 0) / pts.length;
  const near = lower(arc) > lower(arc2) ? arc : arc2;
  const glowPts = [a, ...(near[0] === lo ? near : near.slice().reverse())];
  void hull;
  const glow = `<path class="hna-glow" d="M${glowPts.map((p) => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join("L")}Z"/>`;
  const edges = L(`M${a[0].toFixed(2)} ${a[1].toFixed(2)}L${lo[0].toFixed(2)} ${lo[1].toFixed(2)}M${a[0].toFixed(2)} ${a[1].toFixed(2)}L${hi[0].toFixed(2)} ${hi[1].toFixed(2)}`, { tone: id === "high" ? "lit" : "hi", className: "hna-ray" });
  const z = WAFER_TOP + 0.05;
  const sx = HALF[0] / 2;
  const slit = id === "high" ? `<path class="hna-slit" d="${path3([[WC[0] - sx, -0.7, z], [WC[0] + sx, -0.7, z], [WC[0] + sx, 0.7, z], [WC[0] - sx, 0.7, z]], true)}"/>` : "";
  const svg = `<g class="${cls}" data-cone="${id}">${slit}${glow}${edges}${Dots([a], { size: 1.1, tone: id === "high" ? "lit" : "hi" })}</g>`;
  const Fc = G.frameOf(apex, [0, 0, 1], [1, 0, 0], [0, 1, 0]);
  put("optics", `optics.cone.${id}`, [WC[0], 0, (WAFER_TOP + M8.z) / 2], svg, [A.solid(Fc, [[0, 0.01], [h, r]])], { ghost: true, bias: id === "low" ? 0.02 : 0 });
  return r;
}

// ---- the tin plasma source (compact): vessel cut open, collector, droplet generator and catcher, neck and IF ----
function source() {
  const [vx, vy] = VC;
  for (const [dx, dy] of byDepth([[-26, -26], [26, -26], [-26, 26], [26, 26]])) cyl("source", "source.leg", vx + dx, vy + dy, 4, SB_TOP, V_FLOOR[0] - SB_TOP, { tone: "mid" }, { steps: 20 });
  const floorRing = Array.from({ length: 12 }, (_, i) => [vx + (42 / Math.cos(rad(15))) * Math.cos(rad(15 + i * 30)), vy + (42 / Math.cos(rad(15))) * Math.sin(rad(15 + i * 30))]);
  ringPrism("source", "source.floor", floorRing, V_FLOOR[0], V_FLOOR[1] - V_FLOOR[0], { tone: "mid" }, { inner: L(k.ringSeam(floorRing, V_FLOOR[0] + 2, P), { tone: "faint" }) });
  ringPrism("source", "source.shell", polyArc(vx, vy, AP_IN, AP_OUT, 165, 315), V_FLOOR[1], V_TOP - V_FLOOR[1], { tone: "mid" }, { bias: -1 });
  ringPrism("source", "source.lip", polyArc(vx, vy, AP_IN, AP_OUT, 315, 375), V_FLOOR[1], V_TOP - V_FLOOR[1], { tone: "mid" });
  const lidRing = [];
  for (let v = 165; v <= 375; v += 30) lidRing.push([vx + (42 / Math.cos(rad(15))) * Math.cos(rad(v)), vy + (42 / Math.cos(rad(15))) * Math.sin(rad(v))]);
  ringPrism("source", "source.lid", lidRing, V_TOP, LID_TOP - V_TOP, { tone: "mid" }, { extra: Dots(lidRing.slice(1, -1).map(([x, y]) => at([vx + (x - vx) * 0.93, vy + (y - vy) * 0.93, LID_TOP])), { size: 0.45 }) });
  cyl("source", "source.neck", vx, vy, 9, LID_TOP, IF[2] - 4 - LID_TOP, { tone: "mid" }, { steps: 32, inner: L(k.sideArc(vx, vy, 9, LID_TOP + 8, P, 20), { tone: "faint" }) });
  cyl("source", "source.ifflange", vx, vy, 13, IF[2] - 4, 4, { tone: "mid" }, { steps: 40, bevel: 0.4, extra: L(k.ring(vx, vy, 3, IF[2], P, 20), { tone: "lo" }) + Dots(Array.from({ length: 8 }, (_, i) => at([vx + 10.5 * Math.cos((i * Math.PI) / 4), vy + 10.5 * Math.sin((i * Math.PI) / 4), IF[2]])), { size: 0.4 }) });
  const rings = [9, 15, 21, 26].map((r) => k.ring(vx, vy, r, COL_TOP, P, 56)).join("");
  cyl("source", "source.collector", vx, vy, 29, V_FLOOR[1], COL_TOP - V_FLOOR[1], { tone: "hi", crease: "lo" }, { steps: 64, bevel: 0.5, extra: L(rings, { tone: "faint" }) + L(k.ring(vx, vy, 3, COL_TOP, P, 20), { tone: "lo" }) });
  const gen = G.frameOf([vx - AP_OUT, vy, PL[2]], [-1, 0, 0], [0, 1, 0], [0, 0, 1]);
  turned("source", "source.generator", gen, [[0, 9], [3, 9], [3, 6], [11, 6], [11, 6.8], [13, 6.8], [13, 6], [21, 6], [21, 6.8], [23, 6.8], [23, 6], [28, 6], [28, 7.5], [32, 7.5], [32, 4], [36, 4]], { tone: "mid" });
  const cat = G.frameOf([vx + AP_OUT, vy, PL[2]], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
  turned("source", "source.catcher", cat, [[0, 9], [3, 9], [3, 7], [9, 7], [9, 7.8], [11, 7.8], [11, 7], [17, 7], [17, 5], [21, 5]], { tone: "mid" });
  // what lives in the vessel's light plane: the converging cone, the droplet stream, the laser and the flash
  const d0 = [vx - AP_IN, 0, PL[2]];
  const d1 = [vx + AP_IN, 0, PL[2]];
  const hole = [vx, 0, COL_TOP];
  const half = (z) => (27 * (IF[2] - z)) / (IF[2] - COL_TOP);
  const cn = [[vx - 27, 0, COL_TOP], [vx + 27, 0, COL_TOP], [vx + half(V_TOP), 0, V_TOP], [vx - half(V_TOP), 0, V_TOP]];
  const sheet = A.prism(G.frameOf([0, -0.25, 0], [0, 1, 0], [1, 0, 0], [0, 0, 1]), cn.map(([x, , z]) => [x, z]), 0, 0.5);
  const conesvg = `<g class="hna-srccone"><path class="hna-glow" d="${path3(cn, true)}"/>${L(path3([cn[0], cn[3]]) + path3([cn[1], cn[2]]), { tone: "lit", className: "hna-ray" })}</g>`;
  const dropsvg = `${L(path3([d0, d1]), { tone: "faint", className: "hna-dropline" })}${Dots([at(d0), at(d1)], { size: 0.6, tone: "lo" })}<g data-drops=""></g>`;
  const flashsvg = `<g class="hna-plasma"><circle class="hna-flash" cx="${at(PL)[0].toFixed(1)}" cy="${at(PL)[1].toFixed(1)}" r="4"/></g>`;
  const co2svg = `<g class="hna-co2">${L(path3([hole, PL]), { tone: "hi", className: "hna-co2line" })}${Dots([at(PL)], { size: 0.8, tone: "hi" })}</g>`;
  put("source", "source.light", PL, conesvg + dropsvg + co2svg + flashsvg, [sheet, A.tube([d0, d1], 0.9), A.tube([hole, PL], 0.6), A.ball(PL, 4 / G.scaleOf(P))], { ghost: true });
  // turbo pumps on the lid
  for (const [x, y] of [[230, -22], [276, -22]]) {
    cyl("source", "source.turbo.flange", x, y, 9, LID_TOP, 2, { tone: "mid" }, { steps: 36, extra: Dots(Array.from({ length: 6 }, (_, i) => at([x + 7.6 * Math.cos((i * Math.PI) / 3), y + 7.6 * Math.sin((i * Math.PI) / 3), LID_TOP + 2])), { size: 0.4 }) });
    cyl("source", "source.turbo", x, y, 7.5, LID_TOP + 2, 16, { tone: "mid" }, { steps: 36, bevel: 0.4, inner: L(k.sideArc(x, y, 7.5, LID_TOP + 6, P, 24) + k.sideArc(x, y, 7.5, LID_TOP + 14, P, 24), { tone: "faint" }) });
    cyl("source", "source.turbo.cap", x, y, 4.5, LID_TOP + 18, 3, { tone: "mid" }, { steps: 24, extra: L(k.ring(x, y, 2, LID_TOP + 21, P, 16), { tone: "lo" }) });
  }
  // the drive laser comes up from the sub-fab: a floor feedthrough and the beam tube to the vessel floor
  box("source", "source.feed", [vx - 9, -9, 0], [vx + 9, 9, 6], { tone: "mid" }, { r: 1, bevel: 0.4, extra: Dots(k.corners({ x: vx - 9, y: -9, w: 18, d: 18 }, 2.2).map(([x, y]) => at([x, y, 6])), { size: 0.4 }) });
  pipe("source", "source.beamtube", [[vx, 0, 6], [vx, 0, V_FLOOR[0]]], 3, { flange: 6, ft: 1.6 });
}

// ---- services: a hydrogen line, a coolant line to the optics, a cabinet, signal tower ----
function signalTower(piece, name, x, y, z) {
  cyl(piece, `${name}.post`, x, y, 1.4, z, 14, { tone: "mid" }, { steps: 12 });
  let zz = z + 14;
  cyl(piece, `${name}.base`, x, y, 3.2, zz, 1.4, { tone: "mid" }, { steps: 20 });
  zz += 1.4;
  for (const tone of ["lo", "mid", "lit"]) {
    cyl(piece, `${name}.lamp`, x, y, 2.8, zz, 3.4, tone === "lit" ? { tone: "hi", lit: true } : { tone: "mid" }, { steps: 20 });
    zz += 3.4;
  }
  cyl(piece, `${name}.cap`, x, y, 3.2, zz, 1, { tone: "mid" }, { steps: 20 });
}
function services() {
  for (const x of [150, 214]) box("frame", "frame.rib", [x, WALL_Y[1], SB_TOP], [x + 5, WALL_Y[1] + 4, CEIL_Z[0]], { tone: "lo" }, { r: 0.4, extra: Dots([30, 120, 210].map((z) => at([x + 2.5, WALL_Y[1] + 4, z])), { size: 0.4, tone: "lo" }) });
  pipe("source", "source.h2", [[262, WALL_Y[1], 200], [262, -32, 200], [262, -32, LID_TOP]], 1.6, { flange: 3, ft: 1.2 });
  // cabinet between the stages and the source
  const cab = { x: 136, y: -50, w: 54, d: 46, r: 1.2 };
  const front = cab.y + cab.d;
  const vents = [];
  for (let i = 0; i < 5; i++) vents.push(k.planOutline({ x: 142 + i * 9, y: cab.y + 8, w: 3, d: 28, r: 1.5 }, 60, P, 3));
  box("wstage", "wstage.cabinet", [cab.x, cab.y, 0], [cab.x + cab.w, front, 60], { tone: "mid" }, {
    r: 1.2,
    steps: 3,
    bevel: 0.5,
    inner: L(k.sideSeam(cab, 4, P, 3) + k.sideSeam(cab, 57, P, 3), { tone: "faint" }),
    extra: L(k.segment([163, front, 4], [163, front, 57], P), { tone: "faint" }) + L(vents.join(""), { tone: "lo" }) + Dots([at([159, front, 36]), at([167, front, 36])], { size: 0.7, tone: "mid" }) + Dots(k.corners(cab, 3).map(([x, y]) => at([x, y, 60])), { size: 0.45 }),
  });
  signalTower("wstage", "wstage.tower", -186, 54, SB_TOP);
}

// ---- wafers: the one being exposed (with its half-field grid) and the next one on the measure chuck ----
// half fields: dies of 26 x 33 mm (two halves of 26 x 16.5 mm) whose four corners lie on the wafer, in serpentine order
const DIES = (() => {
  const list = [];
  for (let i = -6; i <= 6; i++) {
    const col = [];
    for (let j = -5; j <= 5; j++) {
      const cx = i * DIE[0];
      const cy = j * DIE[1];
      const ok = [[-1, -1], [1, -1], [1, 1], [-1, 1]].every(([sx, sy]) => Math.hypot(cx + (sx * DIE[0]) / 2, cy + (sy * DIE[1]) / 2) <= WAFER_R - 1.2);
      if (ok) col.push([cx, cy]);
    }
    if ((i + 6) % 2) col.reverse();
    list.push(...col);
  }
  // the die at the centre goes first: it is the one the steps follow
  const first = list.findIndex(([x, y]) => x === 0 && y === 0);
  return [list[first], ...list.slice(0, first), ...list.slice(first + 1)];
})();
function waferSvg(cx, cy, live) {
  const top = WAFER_TOP;
  let extra = L(k.lineOnTop([cx, cy - WAFER_R], [cx, cy - WAFER_R + 2.6], top, P), { tone: "lo" });
  const lines = [];
  const chord = (axis, v) => {
    const h = Math.sqrt(Math.max(0, WAFER_R * WAFER_R - v * v));
    return axis === "x" ? [[cx + v, cy - h], [cx + v, cy + h]] : [[cx - h, cy + v], [cx + h, cy + v]];
  };
  for (let i = -6; i <= 6; i++) {
    const v = (i + 0.5) * DIE[0];
    if (Math.abs(v) < WAFER_R - 1) lines.push(k.lineOnTop(...chord("x", v), top, P));
  }
  for (let j = -10; j <= 10; j++) {
    const v = (j + 0.5) * HALF[1];
    if (Math.abs(v) < WAFER_R - 1) lines.push(k.lineOnTop(...chord("y", v), top, P));
  }
  extra += L(lines.join(""), { tone: "faint" });
  if (live) {
    const disc = path3(Array.from({ length: 96 }, (_, i) => [cx + WAFER_R * Math.cos((i / 96) * Math.PI * 2), cy + WAFER_R * Math.sin((i / 96) * Math.PI * 2), top]), true);
    const cells = DIES.flatMap(([dx, dy], index) =>
      [-1, 1].map((side) => {
        const x0 = cx + dx - DIE[0] / 2;
        const x1 = cx + dx + DIE[0] / 2;
        const y0 = cy + dy + (side < 0 ? -HALF[1] : 0);
        const y1 = y0 + HALF[1];
        return `<path class="hna-field" data-die="${index}" data-half="${side < 0 ? "A" : "B"}" d="${path3([[x0, y0, top], [x1, y0, top], [x1, y1, top], [x0, y1, top]], true)}"/>`;
      }),
    );
    const d0 = DIES[0];
    const seam = `<g class="hna-seam">${L(path3([[cx + d0[0] - DIE[0] / 2, cy + d0[1], top], [cx + d0[0] + DIE[0] / 2, cy + d0[1], top]]), { tone: "lit", className: "hna-ray" })}</g>`;
    const outline = `<path class="hna-die" d="${path3([[cx + d0[0] - DIE[0] / 2, cy + d0[1] - DIE[1] / 2, top], [cx + d0[0] + DIE[0] / 2, cy + d0[1] - DIE[1] / 2, top], [cx + d0[0] + DIE[0] / 2, cy + d0[1] + DIE[1] / 2, top], [cx + d0[0] - DIE[0] / 2, cy + d0[1] + DIE[1] / 2, top]], true)}"/>`;
    extra = `<clipPath id="hna-clip"><path d="${disc}"/></clipPath>` + extra.replace(/^/, "") + `<g class="hna-cells" clip-path="url(#hna-clip)">${cells.join("")}</g>${outline}${seam}`;
  }
  return S(k.cylinder(cx, cy, WAFER_R, CHUCK_TOP, 1, P, 96, 0.3), { tone: "hi", crease: "lo" }) + extra;
}
function wafers() {
  put("wafer", "wafer.expose", [WC[0], WC[1], CHUCK_TOP + 0.5], waferSvg(WC[0], WC[1], true), [A.cylinder(WC[0], WC[1], WAFER_R, CHUCK_TOP, 1)], { attrs: ' data-move="wafer" data-wafer="expose"' });
  put("wafer", "wafer.measure", [MC[0], MC[1], CHUCK_TOP + 0.5], waferSvg(MC[0], MC[1], false), [A.cylinder(MC[0], MC[1], WAFER_R, CHUCK_TOP, 1)], { attrs: ' data-wafer="measure"' });
}

base();
frame();
waferStages();
reticleStage();
source();
services();
for (const [name, piece] of [["FF", "illuminator"], ["PF", "illuminator"], ["GM", "illuminator"], ["M1", "optics"], ["M2", "optics"], ["M3", "optics"], ["M4", "optics"], ["M5", "optics"], ["M6", "optics"], ["M7", "optics"]]) mirror(piece, name, { faceted: name === "FF" || name === "PF" });
lastMirror();
beams();
const RIM = { high: cone("high", M.HIGH.na, "hna-cone"), low: cone("low", M.LOW.na, "hna-cone hna-cone-low") };
wafers();

if (!process.argv.includes("--fast")) A.settle(R, P);
R.items.sort((a, b) => a.key - b.key);
const groups = R.items.map((item) => `<g class="it" data-piece="${item.piece}" data-name="${item.name}"${item.attrs ?? ""}>${item.svg}</g>`);

const ORDER = ["source", "illuminator", "reticle", "optics", "wstage"];
const f1 = (v) => v.toFixed(1);
const PIECES = {
  source: { name: "Tin plasma source", say: `tin droplets hit by a CO2 laser · ${M.LIGHT_NM} nm light` },
  illuminator: { name: "Illuminator", say: `ZEISS: ${M.ZEISS.illParts.toLocaleString("en-US")}+ parts · over ${M.ZEISS.illTonnes} t` },
  reticle: { name: "Reticle stage", say: `standard 6-inch reticle · ${M.HIGH.reticleG} g, ${M.HIGH.reticleGainVsNxe}× NXE` },
  optics: { name: "Anamorphic projection optics", say: `NA ${M.HIGH.na} · ${M.HIGH.reduction[0]}×/${M.HIGH.reduction[1]}× · ≈${M.ZEISS.pobTonnes} t, ${M.ZEISS.pobParts.toLocaleString("en-US")}+ parts` },
  wstage: { name: "Dual wafer stage", say: `measure one wafer, expose the other · ${M.HIGH.waferG} g, ${M.HIGH.waferGainVsNxe}× NXE` },
};
const LABEL = "A High-NA EUV scanner cut open. On the right, a laser beam tube rises from the floor into a cut-open source vessel, where a droplet generator fires tin droplets across a collector mirror toward a catcher; a neck carries the light up to the intermediate focus. Three illuminator mirrors on arms send the light up to a reticle held face down on a scanning stage, beside a reticle library. In the projection optics box below, seven mirrors zig-zag the light down to a large last mirror that focuses it onto the wafer in a wide cone, with the narrower cone of a 0.33 NA scanner drawn inside it. Under the optics a dual wafer stage carries the exposing wafer and, under a sensor bridge on the left, the next wafer being measured.";
const svg = k.figureSvg({ width: W, height: H, label: LABEL, body: [`<g class="hna-layers">${groups.join("")}</g>`], className: "hna-svg" });

const unit = (vector) => {
  const o = at([0, 0, 0]);
  const p = at(vector);
  return [p[0] - o[0], p[1] - o[1]];
};
const STEP_SECONDS = { source: 4.5, illuminate: 3.5, project: 4.5, cone: 4, half1: 5, swap: 4, half2: 5, stitch: 7 };
const DATA = {
  EX: unit([1, 0, 0]),
  EY: unit([0, 1, 0]),
  EZ: unit([0, 0, 1]),
  steps: M.STEPS.map((s) => ({ ...s, seconds: STEP_SECONDS[s.id] })),
  pieces: PIECES,
  order: ORDER,
  idle: M.IDLE,
  dies: DIES,
  half: HALF,
  slitPoint: at([WC[0], 0, WAFER_TOP]),
  waferCentre: at([WC[0], WC[1], WAFER_TOP]),
  drops: { from: at([VC[0] - AP_IN, 0, PL[2]]), to: at([VC[0] + AP_IN, 0, PL[2]]), hit: at(PL) },
  reticleGain: M.HIGH.reduction[1],
  swapX: -104,
  legs: LEGS.length,
  illumLegs: 4,
  cone: { high: f1(M.CONE_DEG.high), low: f1(M.CONE_DEG.low), na: [M.HIGH.na, M.LOW.na] },
  fieldMm: M.HALF_FIELD_MM,
  dieMm: M.NXE_FIELD_MM,
};
void RIM;

const PARTS = ORDER.map((id, index) => `<button type="button" class="hna-part" data-part="${id}"><span class="hna-num">${String(index + 1).padStart(2, "0")}</span>${PIECES[id].name}</button>`).join("");
const corners = `<div class="iso-plate-corners" aria-hidden="true"><span class="iso-plate-corner" data-corner="fig">Fig 1</span><span class="iso-plate-corner" data-corner="title">High-NA EUV · cutaway</span><span class="iso-plate-corner" data-corner="readout" data-readout>${M.IDLE}</span></div>`;
const controls = `<div class="hna-controls"><span class="hna-hint">Hover a module · Space plays the exposure</span><span class="hna-live" aria-live="polite" data-live></span></div>`;
const stage = `<div class="hna-stage" tabindex="0" role="group" aria-label="High-NA EUV scanner. Hover, or use the arrow keys, to pick a module; Space plays or pauses the exposure; Escape resets; the slider below steps through the process.">${svg}</div>`;
const caption = `A High-NA EUV scanner (${M.HIGH.first} and ${M.HIGH.name} class), cut open. The light is the same ${M.LIGHT_NM} nm as before; what changes is the projection optics. Their numerical aperture rises from ${M.LOW.na} to ${M.HIGH.na}, so the cone of light that lands on the wafer widens from a half-angle of ${f1(M.CONE_DEG.low)}° (the faint inner cone) to ${f1(M.CONE_DEG.high)}° (the lit one), and the smallest printable feature shrinks from ${M.LOW.resolutionNm} nm to ${M.HIGH.resolutionNm} nm. Wider light needs bigger mirrors: ZEISS says they are about ${M.ZEISS.mirrorSize}× as large and ${M.ZEISS.mirrorMass}× as heavy. To keep the standard 6-inch reticle, the optics shrink its ${M.RETICLE_FIELD_MM[0]} × ${M.RETICLE_FIELD_MM[1]} mm pattern ${M.HIGH.reduction[0]}× across and ${M.HIGH.reduction[1]}× along the scan, printing a ${M.HALF_FIELD_MM[0]} × ${M.HALF_FIELD_MM[1]} mm half field; a die as big as an old full field (${M.NXE_FIELD_MM[0]} × ${M.NXE_FIELD_MM[1]} mm) is printed as two halves from two reticles and stitched. On the wafer, the grid is drawn to scale (ruler ticks are 10 mm). The machine's layout, sizes, mirror count and mirror angles are illustrative; the real light path folds in three dimensions.`;
const scrub = `<span class="hna-scrub"><button type="button" class="hna-play" data-play aria-label="Play the process"><span class="hna-play-icon" aria-hidden="true"></span><span data-play-text>Play</span></button><input type="range" class="hna-range" data-scrub min="0" max="1000" step="1" value="0" aria-label="Process step: 0 is the light leaving the source, 1000 is the stitched die"><span class="hna-step" data-step>01 · Light from the source</span></span>`;
const body = `<figure class="iso-figure hna"><div class="iso-plate">${corners}${stage}${controls}</div><figcaption class="iso-legend">${scrub}<span class="hna-parts">${PARTS}</span><span class="iso-caption">${caption}</span></figcaption></figure>`;

const CSS = readFileSync(join(HERE, "high-na-euv.css"), "utf8");
const LIVE = readFileSync(join(HERE, "live.js"), "utf8").replace("__DATA__", JSON.stringify(DATA));
const out = writeChapter({ slug: "high-na-euv", figure: body, css: CSS, script: LIVE, lesson: LESSON });
console.log("wrote", out.file, `${out.kb} KB`, `${R.items.length} items`, `${R.solids.length} solids`, `${DIES.length} dies`);

A.auditOrExit(R, P);
