// EUV scanner (NXE:3800E class) in cutaway beside its coat/develop track. The slider walks one wafer through
// coat, bake, exposure (tin plasma, mirrors, reticle, 4x projection, field-by-field scan), post-exposure bake and develop.
// node build.mjs [--audit] [--fast]
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as M from "./model.mjs";

import { k, G, A, Tube } from "../../site/kit.mjs";
import { writeChapter } from "../../site/shell.mjs";
import { LESSON } from "./lesson.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

// ---- camera and world (x along the machine, y toward the viewer, z up; units illustrative, wafer 300 mm = 44 units) ----
const W = 720;
const H = 440;
const AZIMUTH = 60;
const ELEVATION = 30;
const WAFER_R = 22;

const PLATE = { x: -344, y: -114, w: 706, d: 212, r: 10 };
const PLATE_H = 12;
const FOOT_H = 6;

// track (coat / bake / develop), deck top at z 40
const TRK = { x: -330, y: -90, w: 214, d: 152, r: 3 };
const DECK = 40;
const CUP = { coat: [-288, 16], dev: [-206, 16] };
const HP = { soft: [-290, -54], peb: [-226, -54], chill: [-162, -54] };
const ROBOT = [-150, -6];
// robot heights: base, shoulder, link1, elbow, link2, fork; a wafer on the fork sits at FORK_TOP, one in transit at TRANSIT
const RZ = { base: DECK + 7.6, shoulder: DECK + 11.6, link1: DECK + 15.6, elbow: DECK + 18.6, link2: DECK + 21.6, fork: DECK + 23 };
const FORK_TOP = RZ.fork;
const TRANSIT = DECK + 24;
const ROBOT_L = 27;
const HAND = [-146, -42]; // wafer centre on the fork at rest (over the chill plate)
const HAND_OUT = [-124, -2]; // wafer centre on the fork turned toward the tunnel
const POSES = 19;

// scanner
const SB = { x: -100, y: -66, w: 404, d: 130, r: 3 }; // scanner base frame, z 0..10
const SB_TOP = 10;
const WALL_Y = [-62, -56]; // back wall
const WALL_X = [-16, 304];
const WALL_TOP = 262;
const LWALL = { x: -16, y: -56, w: 6, d: 72, r: 0.6 };
const POB_Z = [60, 66];
const DECK_Z = [244, 252];
const CEIL_Z = [262, 268];
const LL = { x: -88, y: -34, w: 56, d: 68, r: 2 }; // load lock
const LL_TOP = 80;
const TUNNEL_Z = [24, 74];
const GATE = { x0: -32, x1: -16, y: 16, z0: 18, z1: 50 }; // gate valve between load lock and vacuum chamber
const POB = { x0: -10, x1: 112, yb: -24, yf: -18, yo: 12, top: [228, 234], rightTop: 150 }; // projection optics box
const ILL_Y = [-56, -18]; // illuminator housing, hanging from the ceiling
const SILL_Z = 22; // the cut-down chamber walls

// wafer stage
const BM = { x: -6, y: -50, w: 192, d: 108, r: 2 }; // balance mass, under both wafer stages
const BM_TOP = 20;
const STAGE = { x: 17, y: -26, w: 56, d: 52, r: 2 };
const STAGE_TOP = 30;
const CHUCK_TOP = 35;
const WC = [45, 0]; // wafer centre on the stage
const STAGE2 = { x: 122, y: -26, w: 56, d: 52, r: 2 }; // the measure-side stage (TWINSCAN: one measures, one exposes)
const WC2 = [150, 0];

// source
const VC = [250, 0];
const AP_OUT = 44;
const AP_IN = 41;
const V_FLOOR = [34, 40];
const V_TOP = 146;
const LID_TOP = 152;
const COL_TOP = 46;
const PL = [250, 0, 72]; // plasma point (first focus of the collector)
const IF = [250, 0, 170]; // intermediate focus, on the flange face
const LASER = { x: 318, y: -72, w: 34, d: 120, r: 2 };
const LASER_TOP = 44;

// the light path in the plane y = 0, [x, z]; mirror radii illustrative
const PATH = {
  IF: [250, 170],
  FF: [275, 232, 12],
  PF: [190, 205, 11],
  GM: [126, 178, 9],
  RET: [70, 252],
  M1: [20, 205, 11],
  M2: [82, 192, 10],
  M3: [10, 145, 10],
  M4: [85, 128, 11],
  M5: [15, 100, 9],
  M6: [72, 85, 8],
  W: [WC[0], CHUCK_TOP + 1],
};
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
  ["M6", "W", "optics"],
];
const P3 = (name) => [PATH[name][0], 0, PATH[name][1]];

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [WALL_X[0], WALL_Y[0], CEIL_Z[1]], [WALL_X[1], WALL_Y[0], CEIL_Z[1]], [WALL_X[0], 22, 274]],
  W,
  H,
  { pad: 22, azimuth: AZIMUTH, elevation: ELEVATION },
);
const V = G.viewOf(P);
const KS = G.scaleOf(P);
const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);
const path3 = (points, closed = false) => k.pathOf(points.map(at), closed);
const centreOf = (plan, z) => [plan.x + plan.w / 2, plan.y + plan.d / 2, z];
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const rad = (deg) => (deg * Math.PI) / 180;

// ---- the recorder: every drawn item records its true shape ----
const R = A.recorder(P);
const putItem = (...args) => put(...args);
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
// a thick C: outer arc a0 → a1 then the inner arc back (degrees, any span under 360)
function arcRing(cx, cy, rIn, rOut, a0, a1, steps = 24) {
  const outer = [];
  const inner = [];
  for (let i = 0; i <= steps; i++) {
    const t = rad(a0 + ((a1 - a0) * i) / steps);
    outer.push([cx + rOut * Math.cos(t), cy + rOut * Math.sin(t)]);
    inner.push([cx + rIn * Math.cos(t), cy + rIn * Math.sin(t)]);
  }
  return [...outer, ...inner.reverse()];
}
// polygon vessel wall: vertices of a 12-gon (apothem a) from vertex angle v0 to v1, stepping 30°
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
function turned(piece, name, F, profile, style = {}, { extra = "", inner = "", bias = 0, bevel = 0, attrs, ghost = false } = {}) {
  const paths = G.solidOf(profile, F, P, { bevel });
  const mid = (profile[0][0] + profile[profile.length - 1][0]) / 2;
  return put(piece, name, G.add3(F.o, G.mul3(F.a, mid)), S(paths, { tone: "mid", ...style, inner }) + extra, [A.solid(F, profile)], { bias, attrs, ghost });
}
const zFrame = (x, y, z = 0) => G.frameOf([x, y, z], [0, 0, 1], [1, 0, 0], [0, 1, 0]);

// a pipe between two real ports, flanged at both ends
const PIPES = [];
function pipe(piece, name, points, r, { flange = r * 1.8, ft = 1.6, tone = "hi", maxLength = 16, bias = 0 } = {}) {
  const route = G.fillet(points, Math.max(3, r * 2.6), 8, { P, tube: r });
  const total = G.pathLength(route);
  const gaps = [[0, ft], [total - ft, total]];
  R.route(name, route, r, { piece, gaps, rims: [flange, flange] });
  PIPES.push(name);
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
  // raised-floor tiles: seams from groove to groove, a perforated tile here and there
  const inner = k.insetPlan(PLATE, 6);
  const seams = [];
  const TILE = 44;
  for (let x = inner.x + TILE; x < inner.x + inner.w - 8; x += TILE) seams.push(k.lineOnTop([x, inner.y], [x, inner.y + inner.d], 0, P));
  for (let y = inner.y + TILE; y < inner.y + inner.d - 8; y += TILE) seams.push(k.lineOnTop([inner.x, y], [inner.x + inner.w, y], 0, P));
  out.push(L(seams.join(""), { tone: "faint" }));
  const holes = [];
  for (const [tx, ty] of [[inner.x + TILE * 9, inner.y + TILE * 4], [inner.x + TILE * 11, inner.y + TILE * 4]]) {
    for (let i = 0; i < 7; i++) for (let j = 0; j < 4; j++) holes.push(at([tx + 6 + i * 5, ty + 5 + j * 5, 0]));
  }
  out.push(Dots(holes, { size: 0.45, tone: "lo" }));
  const screws = k.corners(PLATE, 12);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.4, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(Dots(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // ruler along the near edge: one tick per 10 mm at wafer scale (wafer 300 mm = 44 units), majors every 50 mm
  const strip = { x: -300, y: PLATE.y + PLATE.d - 17, w: 300, d: 8, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const unit = 44 / 30;
  const ticks = k.topTicks(strip.x + 4, strip.x + 4 + unit * 200, unit, 5, strip.y + 0.8, 0.6, [2.2, 4], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(Dots([at([strip.x + 2, strip.y + 4, 0.6]), at([strip.x + strip.w - 2, strip.y + 4, 0.6])], { size: 0.45 }));
  // label plate
  const label = { x: 190, y: PLATE.y + PLATE.d - 28, w: 92, d: 18, r: 1.5 };
  out.push(S(k.slabOf(label, 0, 0.8, P, 4), { tone: "lo", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.8), 0.8, P, 4), { tone: "faint" }));
  out.push(L([0, 1, 2].map((i) => k.lineOnTop([label.x + 8, label.y + 5 + i * 3.6], [label.x + 70 - i * 16, label.y + 5 + i * 3.6], 0.8, P)).join(""), { tone: "lo", free: true }));
  out.push(Dots([at([label.x + 4, label.y + label.d / 2, 0.8]), at([label.x + label.w - 4, label.y + label.d / 2, 0.8])], { size: 0.45 }));
  put("frame", "stand.base", [0, 0, -1], out.join(""), shapes, { bias: -2000 });
}

// ---- the track: cabinet, two cups with nozzle arms, three bake plates, a robot ----
function track() {
  const cab = S(k.slabOf(TRK, 0, DECK, P, 3, 0.8), { tone: "mid", inner: L(k.sideSeam(TRK, 6, P, 3) + k.sideSeam(TRK, DECK - 4, P, 3), { tone: "faint" }) });
  const panels = [];
  for (const x of [-276, -222, -168]) panels.push(k.segment([x, TRK.y + TRK.d, 6], [x, TRK.y + TRK.d, DECK - 4], P));
  const pan = L(panels.join(""), { tone: "faint" });
  const knobs = Dots([-303, -249, -195, -141].map((x) => at([x, TRK.y + TRK.d, 23])), { size: 0.6, tone: "mid" });
  const groove = L(k.planOutline(k.insetPlan(TRK, 4), DECK, P, 3), { tone: "lo" });
  const deckScrews = k.corners(TRK, 7);
  const screws = L(deckScrews.map(([x, y]) => k.ring(x, y, 1.8, DECK, P, 12)).join(""), { tone: "lo" }) + Dots(deckScrews.map(([x, y]) => at([x, y, DECK])), { size: 0.45 });
  const name = k.faceTextSvg(k.topMatrix([-152, 50], DECK, P, "x"), "COAT · DEVELOP", { size: 3, tone: "lo", anchor: "middle" });
  put("track", "track.cabinet", centreOf(TRK, 0), cab + pan + knobs + groove + screws + name, [A.slab(TRK, 0, DECK, {}, 3)], { bias: -60 });

  for (const [id, [cx, cy]] of Object.entries(CUP)) {
    cyl("track", `track.${id}.floor`, cx, cy, 30, DECK, 2, { tone: "lo" }, { steps: 48 });
    ringPrism("track", `track.${id}.cupback`, arcRing(cx, cy, 27, 30, 150, 330, 30), DECK + 2, 12, { tone: "mid" });
    cyl("track", `track.${id}.motor`, cx, cy, 4, DECK + 2, 5, { tone: "mid" }, { steps: 20 });
    cyl("track", `track.${id}.chuck`, cx, cy, 9, DECK + 7, 2, { tone: "mid" }, { steps: 28, bevel: 0.3 });
    ringPrism("track", `track.${id}.cupfront`, arcRing(cx, cy, 27, 30, 330, 510, 30), DECK + 2, 12, { tone: "mid" }, {
      inner: L(k.sideArc(cx, cy, 30, DECK + 9, P, 40), { tone: "faint" }),
      extra: Dots([0, 1, 2, 3, 4, 5].map((i) => { const t = rad(345 + i * 30); return at([cx + 28.5 * Math.cos(t), cy + 28.5 * Math.sin(t), DECK + 14]); }), { size: 0.4, tone: "lo" }),
    });
    // nozzle scan arm: rail behind the cup, carriage, arm, nozzle (carriage parked left of the cup)
    const rail = { x0: cx - 42, x1: cx + 38, y0: cy - 41, y1: cy - 35 };
    box("track", `track.${id}.rail`, [rail.x0, rail.y0, DECK], [rail.x1, rail.y1, DECK + 7], { tone: "mid" }, {
      r: 0.8,
      extra: L(k.lineOnTop([rail.x0 + 1.6, (rail.y0 + rail.y1) / 2], [rail.x1 - 1.6, (rail.y0 + rail.y1) / 2], DECK + 7, P), { tone: "faint" }) + Dots([at([rail.x0 + 1.2, rail.y0 + 1.5, DECK + 7]), at([rail.x1 - 1.2, rail.y1 - 1.5, DECK + 7])], { size: 0.4 }),
    });
    const px = cx - 36;
    const carriage = { x: px - 5, y: rail.y0 - 0.5, w: 10, d: 7, r: 0.8 };
    const beam = { x: px - 2, y: rail.y1 + 0.5, w: 4, d: cy - rail.y1 + 1.5, r: 0.5 };
    const armSvg =
      S(k.slabOf(carriage, DECK + 7, 16, P, 2, 0.3), { tone: "mid", inner: L(k.sideSeam(carriage, DECK + 12, P, 2), { tone: "faint" }) }) +
      S(k.slabOf(beam, DECK + 19, 3, P, 2, 0.2), { tone: "hi", crease: "lo" }) +
      S(k.cylinder(px, cy, 1.6, DECK + 16, 3, P, 16), { tone: "hi", crease: "lo" }) +
      Dots([at([px - 3, rail.y0 + 3, DECK + 23]), at([px + 3, rail.y0 + 3, DECK + 23])], { size: 0.4 });
    const owner = `track.${id}.arm`;
    put("track", owner, [px, cy - 18, DECK + 18], armSvg, [A.slab(carriage, DECK + 7, 16, { owner }, 2), A.slab(beam, DECK + 19, 3, { owner }, 2), A.cylinder(px, cy, 1.6, DECK + 16, 3, { owner })], { attrs: ` data-arm="${id}"` });
  }

  for (const [id, [cx, cy]] of Object.entries(HP)) {
    const basePlan = { x: cx - 30, y: cy - 33, w: 60, d: 62, r: 2 };
    box("track", `track.${id}.base`, [basePlan.x, basePlan.y, DECK], [basePlan.x + basePlan.w, basePlan.y + basePlan.d, DECK + 10], { tone: "mid" }, {
      r: 2,
      steps: 4,
      bevel: 0.5,
      inner: L(k.sideSeam(basePlan, DECK + 3, P, 4), { tone: "faint" }),
      extra: Dots(k.corners(basePlan, 3.5).map(([x, y]) => at([x, y, DECK + 10])), { size: 0.45 }),
    });
    const hot = id !== "chill";
    cyl("track", `track.${id}.plate`, cx, cy, 25, DECK + 10, 3, { tone: hot ? "hi" : "mid", crease: "lo" }, {
      steps: 56,
      bevel: 0.4,
      extra: L(k.ring(cx, cy, 21, DECK + 13, P, 48), { tone: "faint" }) + Dots([0, 120, 240].map((a) => at([cx + 12 * Math.cos(rad(a)), cy + 12 * Math.sin(rad(a)), DECK + 13])), { size: 0.45, tone: "lo" }),
    });
    if (!hot) continue;
    // lid on a lift arm that slides down its post during the bake
    cyl("track", `track.${id}.post`, cx, cy - 28.5, 2.5, DECK + 10, 34, { tone: "mid" }, { steps: 16, inner: L(k.sideArc(cx, cy - 28.5, 2.5, DECK + 30, P, 12), { tone: "faint" }) });
    const lidZ = DECK + 26;
    const lidSvg =
      S(k.cylinder(cx, cy, 26, lidZ, 4, P, 56, 0.5), { tone: "mid", inner: L(k.sideArc(cx, cy, 26, lidZ + 1.4, P, 40), { tone: "faint" }) }) +
      L(k.ring(cx, cy, 20, lidZ + 4, P, 48), { tone: "faint" }) +
      S(k.slabOf({ x: cx - 3, y: cy - 26, w: 6, d: 16, r: 0.6 }, lidZ + 4, 3, P, 2, 0.2), { tone: "mid" }) +
      Dots([at([cx, cy - 22, lidZ + 7]), at([cx, cy - 13, lidZ + 7])], { size: 0.4 });
    put("track", `track.${id}.lid`, [cx, cy, lidZ + 3], lidSvg, [A.cylinder(cx, cy, 26, lidZ, 4), A.slab({ x: cx - 3, y: cy - 26, w: 6, d: 16, r: 0.6 }, lidZ + 4, 3, {}, 2)], { attrs: ` data-lid="${id}"` });
  }

  // transfer robot: base, shoulder, two links, a fork. The arm is drawn in POSES poses from "waiting over the chill plate"
  // (pose 0, the one at rest) to "turned toward the tunnel"; the runtime shows one pose at a time, so it swings.
  const [rx, ry] = ROBOT;
  cyl("track", "track.robot.base", rx, ry, 11, DECK, RZ.base - DECK, { tone: "mid" }, { steps: 40, bevel: 0.5, inner: L(k.sideArc(rx, ry, 11, DECK + 3, P, 30), { tone: "faint" }) });
  cyl("track", "track.robot.shoulder", rx, ry, 7, RZ.base, RZ.shoulder - RZ.base, { tone: "mid" }, { steps: 28, extra: Dots([at([rx, ry, RZ.shoulder])], { size: 0.5 }) });
  ROBOT_POSES.forEach((pose, index) => robotPose(pose, index));
}

const link = (x0, y0, x1, y1, w) => {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const l = Math.hypot(dx, dy);
  const [nx, ny] = [(-dy / l) * w, (dx / l) * w];
  return [[x0 + nx, y0 + ny], [x1 + nx, y1 + ny], [x1 - nx, y1 - ny], [x0 - nx, y0 - ny]];
};
// the poses: the wafer centre swings round the robot on a polar path while the fork turns from -y to +x; elbow by two-link IK
const ROBOT_POSES = (() => {
  const [bx, by] = ROBOT;
  const polar = ([x, y]) => [Math.hypot(x - bx, y - by), Math.atan2(y - by, x - bx)];
  const [r0, a0] = polar(HAND);
  const [r1, a1] = polar(HAND_OUT);
  const list = [];
  for (let i = 0; i < POSES; i++) {
    const t = i / (POSES - 1);
    const s = t * t * (3 - 2 * t);
    const rr = r0 + (r1 - r0) * s;
    const aa = a0 + (a1 - a0) * s;
    const theta = rad(-90 + 90 * s);
    const c = [bx + rr * Math.cos(aa), by + rr * Math.sin(aa)];
    const dir = [Math.cos(theta), Math.sin(theta)];
    const wrist = [c[0] - 6 * dir[0], c[1] - 6 * dir[1]];
    const d = Math.hypot(wrist[0] - bx, wrist[1] - by);
    const base = Math.atan2(wrist[1] - by, wrist[0] - bx);
    const off = Math.acos(Math.min(1, d / (2 * ROBOT_L)));
    const elbow = [bx + ROBOT_L * Math.cos(base - off), by + ROBOT_L * Math.sin(base - off)];
    list.push({ c, dir, wrist, elbow });
  }
  return list;
})();
// poses after the first are not recorded: they are drawn into the rest pose's slot, and only one pose is ever shown
const ALT_POSES = {};
function robotPose({ dir, wrist, elbow }, index) {
  const [rx, ry] = ROBOT;
  const ghost = false;
  const put = (piece, name, ref, svg, shapes, options) => {
    if (!index) return putItem(piece, name, ref, svg, shapes, options);
    const base = name.replace(/\.p\d+$/, "");
    (ALT_POSES[base] ??= []).push(`<g class="it" data-piece="${piece}" data-name="${name}"${options.attrs}>${svg}</g>`);
  };
  const attrs = index ? ` data-pose="${index}" data-away` : ` data-pose="0"`;
  const tag = (name) => (index ? `${name}.p${index}` : name);
  const ringOf = (points) => points;
  const l1 = ringOf(link(rx, ry, elbow[0], elbow[1], 4));
  put("track", tag("track.robot.link1"), [(rx + elbow[0]) / 2, (ry + elbow[1]) / 2, (RZ.shoulder + RZ.link1) / 2], S(k.extrude(l1, RZ.shoulder, RZ.link1 - RZ.shoulder, P, { convex: false }), { tone: "mid" }) + Dots([at([rx, ry, RZ.link1])], { size: 0.5 }), [A.extruded(l1, RZ.shoulder, RZ.link1 - RZ.shoulder)], { ghost, attrs });
  put("track", tag("track.robot.elbow"), [elbow[0], elbow[1], (RZ.link1 + RZ.elbow) / 2], S(k.cylinder(elbow[0], elbow[1], 4.5, RZ.link1, RZ.elbow - RZ.link1, P, 24), { tone: "mid" }) + Dots([at([elbow[0], elbow[1], RZ.elbow])], { size: 0.5 }), [A.cylinder(elbow[0], elbow[1], 4.5, RZ.link1, RZ.elbow - RZ.link1)], { ghost, attrs });
  const l2 = link(elbow[0], elbow[1], wrist[0], wrist[1], 3.2);
  put("track", tag("track.robot.link2"), [(elbow[0] + wrist[0]) / 2, (elbow[1] + wrist[1]) / 2, (RZ.elbow + RZ.link2) / 2], S(k.extrude(l2, RZ.elbow, RZ.link2 - RZ.elbow, P, { convex: false }), { tone: "mid" }), [A.extruded(l2, RZ.elbow, RZ.link2 - RZ.elbow)], { ghost, attrs });
  const [ux, uy] = dir;
  const [vx, vy] = [-uy, ux];
  const pt = (s, t) => [wrist[0] + ux * s + vx * t, wrist[1] + uy * s + vy * t];
  const fork = [pt(-2, -3), pt(12, -3), pt(12, 3), pt(-2, 3)];
  put("track", tag("track.robot.fork"), [wrist[0] + ux * 5, wrist[1] + uy * 5, (RZ.link2 + RZ.fork) / 2], S(k.extrude(fork, RZ.link2, RZ.fork - RZ.link2, P, { convex: false }), { tone: "hi", crease: "lo" }), [A.extruded(fork, RZ.link2, RZ.fork - RZ.link2)], { ghost, attrs });
}

// ---- wafers: one at each station, shown by the step that holds it ----
const WAFERS = [];
function wafer(id, cx, cy, z, { grid = false } = {}) {
  const top = z + 1;
  let extra = "";
  // notch at -y: a short line from the rim
  extra += L(k.lineOnTop([cx, cy - WAFER_R], [cx, cy - WAFER_R + 2.6], top, P), { tone: "lo" });
  if (grid) extra += fieldGrid(id, cx, cy, top);
  extra += `<path class="euv-film" data-film="${id}" d=""/>`;
  const svg = S(k.cylinder(cx, cy, WAFER_R, z, 1, P, 72, 0.3), { tone: "hi", crease: "lo" }) + extra;
  WAFERS.push(id);
  return put("wafer", `wafer.${id}`, [cx, cy, z + 0.5], svg, [A.cylinder(cx, cy, WAFER_R, z, 1)], { attrs: ` data-wafer="${id}"` });
}

// exposure fields 26 x 33 mm at the wafer scale; the fields whose centre lies on the wafer, in serpentine order
const FIELD = M.OPTICS.fieldMm.map((mm) => (mm * 44) / 300);
const FIELDS = (() => {
  const list = [];
  for (let i = -7; i <= 6; i++) {
    const rows = [];
    for (let j = -6; j <= 5; j++) {
      const fx = (i + 0.5) * FIELD[0];
      const fy = (j + 0.5) * FIELD[1];
      if (Math.hypot(fx, fy) <= WAFER_R + 2) rows.push([fx, fy]);
    }
    if ((i + 7) % 2) rows.reverse();
    list.push(...rows);
  }
  return list;
})();
function fieldGrid(id, cx, cy, z) {
  const lines = [];
  const chord = (axis, v) => {
    const h = Math.sqrt(Math.max(0, WAFER_R * WAFER_R - v * v));
    return axis === "x" ? [[cx + v, cy - h], [cx + v, cy + h]] : [[cx - h, cy + v], [cx + h, cy + v]];
  };
  for (let i = -6; i <= 6; i++) if (Math.abs(i * FIELD[0]) < WAFER_R - 1) lines.push(k.lineOnTop(...chord("x", i * FIELD[0]), z, P));
  for (let j = -5; j <= 5; j++) if (Math.abs(j * FIELD[1]) < WAFER_R - 1) lines.push(k.lineOnTop(...chord("y", j * FIELD[1]), z, P));
  const cells = FIELDS.map(([fx, fy], index) => {
    const [x0, y0, x1, y1] = [cx + fx - FIELD[0] / 2, cy + fy - FIELD[1] / 2, cx + fx + FIELD[0] / 2, cy + fy + FIELD[1] / 2];
    return `<path class="euv-field" data-f="${index}" d="${path3([[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], true)}"/>`;
  });
  const disc = path3(Array.from({ length: 72 }, (_, i) => [cx + WAFER_R * Math.cos((i / 72) * Math.PI * 2), cy + WAFER_R * Math.sin((i / 72) * Math.PI * 2), z]), true);
  return `<clipPath id="euv-clip-${id}"><path d="${disc}"/></clipPath><g class="euv-cells" clip-path="url(#euv-clip-${id})">${cells.join("")}</g><g class="euv-grid">${L(lines.join(""), { tone: "faint" })}</g>`;
}

// ---- scanner frame: base, back wall, end wall, the POB floor, the reticle deck, the illuminator ceiling, the load lock ----
function frame() {
  box("frame", "frame.base", [SB.x, SB.y, 0], [SB.x + SB.w, SB.y + SB.d, SB_TOP], { tone: "mid" }, {
    r: 3,
    steps: 3,
    bevel: 0.6,
    inner: L(k.sideSeam(SB, 4, P, 3), { tone: "faint" }),
    extra: Dots(k.corners(SB, 5).map(([x, y]) => at([x, y, SB_TOP])), { size: 0.5 }) + L(k.corners(SB, 5).map(([x, y]) => k.ring(x, y, 2, SB_TOP, P, 12)).join(""), { tone: "lo" }),
    bias: -50,
  });
  // the back wall: panels with stiffener seams floor to top, bolt rows along the top
  const wall = { x: WALL_X[0], y: WALL_Y[0], w: WALL_X[1] - WALL_X[0], d: WALL_Y[1] - WALL_Y[0], r: 0.6 };
  const face = WALL_Y[1];
  const joints = [];
  for (const x of [120, 210]) joints.push(k.segment([x, face, SB_TOP], [x, face, WALL_TOP], P));
  const seams = L([66, 182].map((z) => k.sideSeam(wall, z, P, 2)).join(""), { tone: "faint" });
  const bolts = [];
  for (let x = WALL_X[0] + 14; x < WALL_X[1] - 4; x += 12) bolts.push(at([x, face, WALL_TOP - 4]));
  box("frame", "frame.backwall", [wall.x, wall.y, SB_TOP], [wall.x + wall.w, wall.y + wall.d, WALL_TOP], { tone: "lo" }, { r: 0.6, inner: seams, extra: L(joints.join(""), { tone: "faint" }) + Dots(bolts, { size: 0.4, tone: "lo" }), bias: -40 });
  const lj = [k.segment([LWALL.x + LWALL.w, LWALL.y + LWALL.d / 2, SB_TOP], [LWALL.x + LWALL.w, LWALL.y + LWALL.d / 2, WALL_TOP], P)];
  box("frame", "frame.endwall", [LWALL.x, LWALL.y, SB_TOP], [LWALL.x + LWALL.w, LWALL.y + LWALL.d, WALL_TOP], { tone: "lo" }, { r: 0.6, extra: L(lj.join(""), { tone: "faint" }), bias: -30 });

  // POB floor: a U of three bars round the exit slot
  const floorBars = [
    [[-10, -56], [48, 12]],
    [[72, -56], [112, 12]],
    [[48, -56], [72, -12]],
  ];
  floorBars.forEach(([[x0, y0], [x1, y1]], i) => box("optics", "optics.floor", [x0, y0, POB_Z[0]], [x1, y1, POB_Z[1]], { tone: "mid" }, { r: 0.6, bevel: 0.3, extra: i < 2 ? Dots([at([x0 + 4, y1 - 3, POB_Z[1]]), at([x1 - 4, y1 - 3, POB_Z[1]])], { size: 0.45 }) : "" }));
  // reticle deck: a U round the slot the light passes through
  const deckBars = [
    [[-10, -56], [48, 18]],
    [[92, -56], [118, 18]],
    [[48, -56], [92, -18]],
  ];
  deckBars.forEach(([[x0, y0], [x1, y1]], i) => box("reticle", "reticle.deck", [x0, y0, DECK_Z[0]], [x1, y1, DECK_Z[1]], { tone: "mid" }, { r: 0.6, bevel: 0.3, extra: i < 2 ? Dots([at([x0 + 4, y1 - 3, DECK_Z[1]]), at([x1 - 4, y1 - 3, DECK_Z[1]])], { size: 0.45 }) : "" }));
  // illuminator ceiling
  const ceil = { x: 118, y: -56, w: WALL_X[1] - 118, d: 72, r: 0.6 };
  const vents = [];
  for (let i = 0; i < 8; i++) vents.push(k.planOutline({ x: 140 + i * 18, y: -40, w: 4, d: 36, r: 2 }, CEIL_Z[1], P, 3));
  box("illuminator", "illuminator.ceiling", [ceil.x, ceil.y, CEIL_Z[0]], [ceil.x + ceil.w, ceil.y + ceil.d, CEIL_Z[1]], { tone: "mid" }, { r: 0.6, bevel: 0.4, extra: L(vents.join(""), { tone: "faint" }) + Dots(k.corners(ceil, 4).map(([x, y]) => at([x, y, CEIL_Z[1]])), { size: 0.45 }) });

  // load lock with its window, and the tunnel from the track
  box("wstage", "wstage.loadlock", [LL.x, LL.y, SB_TOP], [LL.x + LL.w, LL.y + LL.d, LL_TOP], { tone: "mid" }, {
    r: 2,
    steps: 3,
    bevel: 0.6,
    inner: L(k.sideSeam(LL, LL_TOP - 8, P, 3), { tone: "faint" }),
    extra:
      L(k.planOutline(k.insetPlan(LL, 8), LL_TOP, P, 3), { tone: "lo" }) +
      L(k.ring(LL.x + LL.w / 2, LL.y + LL.d / 2, 11, LL_TOP, P, 40) + k.ring(LL.x + LL.w / 2, LL.y + LL.d / 2, 9, LL_TOP, P, 40), { tone: "lo" }) +
      Dots(Array.from({ length: 8 }, (_, i) => at([LL.x + LL.w / 2 + 13.5 * Math.cos((i * Math.PI) / 4), LL.y + LL.d / 2 + 13.5 * Math.sin((i * Math.PI) / 4), LL_TOP])), { size: 0.45 }),
  });
  const tun = { x: TRK.x + TRK.w, y: -14, w: LL.x - TRK.x - TRK.w, d: 28, r: 0.6 };
  box("wstage", "wstage.tunnel", [tun.x, tun.y, TUNNEL_Z[0]], [tun.x + tun.w, tun.y + tun.d, TUNNEL_Z[1]], { tone: "mid" }, {
    r: 0.6,
    inner: L(k.sideSeam(tun, 32, P, 2) + k.sideSeam(tun, TUNNEL_Z[1] - 6, P, 2), { tone: "faint" }),
    extra: Dots([at([tun.x + 4, tun.y + tun.d, 50]), at([tun.x + tun.w - 4, tun.y + tun.d, 50])], { size: 0.45 }),
  });
  // gate valve between the load lock and the vacuum chamber, its door blade rising out of the top when it opens
  box("wstage", "wstage.gate", [GATE.x0, -GATE.y, GATE.z0], [GATE.x1, GATE.y, GATE.z1], { tone: "mid" }, {
    r: 0.8,
    steps: 2,
    bevel: 0.4,
    inner: L(k.sideSeam({ x: GATE.x0, y: -GATE.y, w: GATE.x1 - GATE.x0, d: 2 * GATE.y, r: 0.8 }, GATE.z0 + 4, P, 2), { tone: "faint" }),
    extra: Dots([at([GATE.x0 + 3, GATE.y, GATE.z1 - 4]), at([GATE.x1 - 3, GATE.y, GATE.z1 - 4]), at([GATE.x0 + 3, GATE.y, GATE.z0 + 8]), at([GATE.x1 - 3, GATE.y, GATE.z0 + 8])], { size: 0.45 }),
  });
  box("wstage", "wstage.door", [-26, -13, GATE.z1], [-22, 13, GATE.z1 + 8], { tone: "hi", crease: "lo" }, { r: 0.4, attrs: " data-gate" });
  // the port in the chamber's end wall, behind the gate valve
  const ex = LWALL.x + LWALL.w;
  const port = path3([[ex, -14, 22], [ex, 14, 22], [ex, 14, 48], [ex, -14, 48]], true) + path3([[ex, -11, 25], [ex, 11, 25], [ex, 11, 45], [ex, -11, 45]], true);
  put("frame", "frame.port", [ex, 0, 35], L(port, { tone: "lo" }) + Dots([[-12, 24], [12, 24], [-12, 46], [12, 46]].map(([y, z]) => at([ex, y, z])), { size: 0.4 }), [A.box([ex - 0.1, -14, 22], [ex, 14, 48])], { bias: 0.5, ghost: true });

  // the vacuum chamber, cut down to a sill at the front and the right so the stages and optics show
  const sillTop = SILL_Z;
  box("frame", "frame.chamber.end", [LWALL.x, LWALL.y + LWALL.d, SB_TOP], [LWALL.x + LWALL.w, SB.y + SB.d, sillTop], { tone: "lo" }, { r: 0.6 });
  const sill = { x: LWALL.x + LWALL.w, y: SB.y + SB.d - 5, w: 197, d: 5, r: 0.6 };
  box("frame", "frame.chamber.sill", [sill.x, sill.y, SB_TOP], [sill.x + sill.w, sill.y + sill.d, sillTop], { tone: "lo" }, {
    r: 0.6,
    extra: k.faceTextSvg(k.topMatrix([sill.x + 100, sill.y + 2.5], sillTop, P, "x"), "VACUUM CHAMBER · CUT AWAY", { size: 3, tone: "mid", anchor: "middle" }) + Dots([20, 60, 140, 180].map((x) => at([sill.x + x, sill.y + 2.5, sillTop])), { size: 0.4 }),
  });
  box("frame", "frame.chamber.side", [sill.x + sill.w, WALL_Y[1], SB_TOP], [sill.x + sill.w + 6, SB.y + SB.d, sillTop], { tone: "lo" }, { r: 0.6 });

  // the projection optics box: back panel with two frame rails, a side wall, a side wall cut low, a top plate round the slot
  const backPanel = { x: POB.x0, y: POB.yb, w: POB.x1 - POB.x0, d: POB.yf - POB.yb, r: 0.6 };
  const panelBolts = [];
  for (let x = POB.x0 + 6; x < POB.x1 - 2; x += 10) panelBolts.push(at([x, POB.yf, POB.top[0] - 4]), at([x, POB.yf, POB_Z[1] + 4]));
  box("optics", "optics.housing.back", [backPanel.x, backPanel.y, POB_Z[1]], [backPanel.x + backPanel.w, POB.yf, POB.top[0]], { tone: "lo" }, {
    r: 0.6,
    inner: L([112, 170].map((z) => k.sideSeam(backPanel, z, P, 2)).join(""), { tone: "faint" }),
    extra: Dots(panelBolts, { size: 0.4, tone: "lo" }),
    bias: -1,
  });
  box("optics", "optics.housing.left", [POB.x0, POB.yf, POB_Z[1]], [POB.x0 + 4, POB.yo, POB.top[0]], { tone: "mid" }, { r: 0.4 });
  box("optics", "optics.housing.right", [POB.x1 - 6, POB.yf, POB_Z[1]], [POB.x1, POB.yo, POB.rightTop], { tone: "mid" }, {
    r: 0.4,
    inner: L(k.sideSeam({ x: POB.x1 - 6, y: POB.yf, w: 6, d: POB.yo - POB.yf, r: 0.4 }, 108, P, 2), { tone: "faint" }),
    extra: Dots([at([POB.x1, POB.yo - 4, 80]), at([POB.x1, POB.yf + 4, 80]), at([POB.x1, POB.yo - 4, 136]), at([POB.x1, POB.yf + 4, 136])], { size: 0.4 }),
  });
  for (const x0 of [38, 56]) box("optics", "optics.rail", [x0, POB.yf, POB_Z[1]], [x0 + 6, POB.yf + 4, POB.top[0]], { tone: "mid" }, { r: 0.4, extra: Dots([90, 130, 170, 210].map((z) => at([x0 + 3, POB.yf + 4, z])), { size: 0.4 }) });
  const topBars = [
    [[POB.x0, POB.yb], [34, POB.yo]],
    [[98, POB.yb], [POB.x1, POB.yo]],
    [[34, POB.yb], [98, -16]],
  ];
  topBars.forEach(([[x0, y0], [x1, y1]], i) => box("optics", "optics.housing.top", [x0, y0, POB.top[0]], [x1, y1, POB.top[1]], { tone: "mid" }, { r: 0.6, bevel: 0.3, extra: i < 2 ? Dots([at([x0 + 3, y1 - 3, POB.top[1]]), at([x1 - 3, y1 - 3, POB.top[1]])], { size: 0.45 }) : "" }));
  // isolation mounts between the box and the reticle deck
  for (const [x, y] of byDepth([[2, -12], [104, -12], [2, 4], [104, 4]])) cyl("optics", "optics.isolator", x, y, 3.2, POB.top[1], DECK_Z[0] - POB.top[1], { tone: "mid" }, { steps: 20, inner: L(k.sideArc(x, y, 3.2, POB.top[1] + 5, P, 16), { tone: "faint" }) });

  // illuminator housing under the ceiling: a low part over the stage side, a shorter one over the source
  for (const [x0, x1, z0] of [[118, 216, 164], [216, 300, 186]]) {
    const plan = { x: x0, y: ILL_Y[0], w: x1 - x0, d: ILL_Y[1] - ILL_Y[0], r: 0.6 };
    const bolts = [];
    for (let x = x0 + 5; x < x1 - 2; x += 10) bolts.push(at([x, ILL_Y[1], z0 + 3]));
    const vents = [];
    for (let i = 0; i < Math.floor((x1 - x0 - 20) / 14); i++) vents.push(path3([[x0 + 12 + i * 14, ILL_Y[1], CEIL_Z[0] - 16], [x0 + 16 + i * 14, ILL_Y[1], CEIL_Z[0] - 16], [x0 + 16 + i * 14, ILL_Y[1], CEIL_Z[0] - 6], [x0 + 12 + i * 14, ILL_Y[1], CEIL_Z[0] - 6]], true));
    box("illuminator", "illuminator.housing", [x0, ILL_Y[0], z0], [x1, ILL_Y[1], CEIL_Z[0]], { tone: "lo" }, { r: 0.6, inner: L(k.sideSeam(plan, z0 + 7, P, 2), { tone: "faint" }), extra: Dots(bolts, { size: 0.4, tone: "lo" }) + L(vents.join(""), { tone: "faint" }), bias: -1 });
  }
}

// ---- wafer stage: balance mass, long-stroke block, chuck ----
function waferStage() {
  box("wstage", "wstage.mass", [BM.x, BM.y, SB_TOP], [BM.x + BM.w, BM.y + BM.d, BM_TOP], { tone: "lo" }, {
    r: 2,
    steps: 3,
    bevel: 0.5,
    extra: L(k.planOutline(k.insetPlan(BM, 5), BM_TOP, P, 3), { tone: "faint" }) + L([0, 1, 2, 3, 4, 5, 6, 7].map((i) => k.lineOnTop([BM.x + 5, BM.y + 12 + i * 12], [BM.x + BM.w - 5, BM.y + 12 + i * 12], BM_TOP, P)).join(""), { tone: "faint" }),
  });
  const pads = k.corners(STAGE, 4);
  box("wstage", "wstage.block", [STAGE.x, STAGE.y, BM_TOP], [STAGE.x + STAGE.w, STAGE.y + STAGE.d, STAGE_TOP], { tone: "mid" }, {
    r: 2,
    steps: 3,
    bevel: 0.5,
    inner: L(k.sideSeam(STAGE, BM_TOP + 3, P, 3), { tone: "faint" }),
    extra: L(pads.map(([x, y]) => k.ring(x, y, 1.8, STAGE_TOP, P, 12)).join(""), { tone: "lo" }) + Dots(pads.map(([x, y]) => at([x, y, STAGE_TOP])), { size: 0.45 }),
    attrs: ' data-move="wafer"',
  });
  cyl("wstage", "wstage.chuck", WC[0], WC[1], 24, STAGE_TOP, CHUCK_TOP - STAGE_TOP, { tone: "mid" }, { steps: 64, bevel: 0.5, inner: L(k.sideArc(WC[0], WC[1], 24, STAGE_TOP + 2, P, 40), { tone: "faint" }), attrs: ' data-move="wafer"' });
  // the second stage, at the measure position: it maps the next wafer while this one is exposed
  const pads2 = k.corners(STAGE2, 4);
  box("wstage", "wstage.block2", [STAGE2.x, STAGE2.y, BM_TOP], [STAGE2.x + STAGE2.w, STAGE2.y + STAGE2.d, STAGE_TOP], { tone: "mid" }, {
    r: 2,
    steps: 3,
    bevel: 0.5,
    inner: L(k.sideSeam(STAGE2, BM_TOP + 3, P, 3), { tone: "faint" }),
    extra: L(pads2.map(([x, y]) => k.ring(x, y, 1.8, STAGE_TOP, P, 12)).join(""), { tone: "lo" }) + Dots(pads2.map(([x, y]) => at([x, y, STAGE_TOP])), { size: 0.45 }),
  });
  cyl("wstage", "wstage.chuck2", WC2[0], WC2[1], 24, STAGE_TOP, CHUCK_TOP - STAGE_TOP, { tone: "mid" }, { steps: 64, bevel: 0.5, inner: L(k.sideArc(WC2[0], WC2[1], 24, STAGE_TOP + 2, P, 40), { tone: "faint" }) });
  // metrology bridge over it: two posts, a beam, level-sensor projector and detector, alignment sensor with its lens
  for (const x0 of [124, 170]) box("wstage", "wstage.bridge.post", [x0, -48, BM_TOP], [x0 + 6, -40, 70], { tone: "mid" }, { r: 0.6, inner: L(k.sideSeam({ x: x0, y: -48, w: 6, d: 8, r: 0.6 }, 26, P, 2), { tone: "faint" }) });
  box("wstage", "wstage.bridge.beam", [124, -48, 70], [176, -34, 78], { tone: "mid" }, { r: 0.6, bevel: 0.3, extra: Dots([128, 138, 162, 172].map((x) => at([x, -34, 74])), { size: 0.4 }) + Dots([at([127, -41, 78]), at([173, -41, 78])], { size: 0.45 }) });
  for (const [x0, label] of [[128, "LS"], [162, "LS"]]) box("wstage", "wstage.levelsensor", [x0, -34, 62], [x0 + 10, -16, 74], { tone: "mid" }, { r: 0.6, bevel: 0.3, inner: L(k.sideSeam({ x: x0, y: -34, w: 10, d: 18, r: 0.6 }, 66, P, 2), { tone: "faint" }), extra: k.faceTextSvg(k.topMatrix([x0 + 5, -25], 74, P, "x"), label, { size: 2.2, tone: "lo", anchor: "middle" }) });
  box("wstage", "wstage.align", [144, -34, 60], [156, -12, 74], { tone: "mid" }, { r: 0.6, bevel: 0.3, inner: L(k.sideSeam({ x: 144, y: -34, w: 12, d: 22, r: 0.6 }, 64, P, 2), { tone: "faint" }), extra: Dots([at([147, -15, 74]), at([153, -15, 74])], { size: 0.4 }) });
  cyl("wstage", "wstage.align.lens", 150, -20, 3, 54, 6, { tone: "hi", crease: "lo" }, { steps: 20, extra: L(k.ring(150, -20, 1.6, 54, P, 14), { tone: "lo" }) });
  // metrology block on the back wall beside the stage: position sensors that follow the chuck
  const metro = { x: 10, y: WALL_Y[1], w: 70, d: 5, r: 0.6 };
  box("wstage", "wstage.metro", [metro.x, metro.y, 32], [metro.x + metro.w, metro.y + metro.d, 52], { tone: "mid" }, { r: 0.6, inner: L(k.sideSeam(metro, 36, P, 2), { tone: "faint" }), extra: Dots([at([14, metro.y + metro.d, 48]), at([76, metro.y + metro.d, 48])], { size: 0.45 }) });
  for (const x of [25, 45, 65]) box("wstage", "wstage.metro.port", [x - 3, metro.y + metro.d, 39], [x + 3, metro.y + metro.d + 1, 45], { tone: "hi", crease: "lo" }, { r: 0.4, extra: Dots([at([x, metro.y + metro.d + 1, 42])], { size: 0.6, tone: "lo" }) });
}

// ---- reticle stage: rails on the deck, air-bearing pads, carriage, chuck, reticle ----
function reticleStage() {
  for (const x0 of [40, 94]) box("reticle", "reticle.rail", [x0, -50, DECK_Z[1]], [x0 + 6, 18, DECK_Z[1] + 4], { tone: "mid" }, { r: 0.6, extra: L(k.lineOnTop([x0 + 3, -48.6], [x0 + 3, 16.6], DECK_Z[1] + 4, P), { tone: "faint" }) });
  const top = DECK_Z[1] + 4;
  const move = ' data-move="reticle"';
  for (const x0 of [39, 93]) box("reticle", "reticle.pad", [x0, -12, top], [x0 + 8, 12, top + 4], { tone: "mid" }, { r: 0.6, attrs: move });
  box("reticle", "reticle.chuck", [57, -13, top], [83, 13, top + 4], { tone: "mid" }, { r: 0.6, attrs: move });
  box("reticle", "reticle.mask", [59, -11, DECK_Z[1]], [81, 11, top], { tone: "hi", crease: "lo" }, { r: 0.4, attrs: move });
  const car = { x: 36, y: -14, w: 68, d: 28, r: 1.5 };
  box("reticle", "reticle.carriage", [car.x, car.y, top + 4], [car.x + car.w, car.y + car.d, top + 13], { tone: "mid" }, {
    r: 1.5,
    steps: 3,
    bevel: 0.5,
    inner: L(k.sideSeam(car, top + 8, P, 3), { tone: "faint" }),
    extra: L(k.planOutline(k.insetPlan(car, 4), top + 13, P, 3), { tone: "lo" }) + Dots(k.corners(car, 2.4).map(([x, y]) => at([x, y, top + 13])), { size: 0.45 }) + k.faceTextSvg(k.topMatrix([70, 0], top + 13, P, "x"), "RETICLE", { size: 2.6, tone: "lo", anchor: "middle" }),
    attrs: move,
  });
}

// ---- mirrors: a disc whose face is at the path point, normal bisecting the two legs, held on a pad bolted to its housing ----
function mirrorNormal(name) {
  const names = LEGS.flatMap(([a, b]) => [a, b]);
  const p = P3(name);
  const before = LEGS.find(([, b]) => b === name)[0];
  const after = LEGS.find(([a]) => a === name)[1];
  const din = G.unit3(G.sub3(P3(before), p));
  const dout = G.unit3(G.sub3(P3(after), p));
  return names.length ? G.unit3(G.add3(din, dout)) : null;
}
function mirror(piece, name, { faceted = false, backY = POB.yf } = {}) {
  const [x, z, r] = PATH[name];
  const p = [x, 0, z];
  const n = mirrorNormal(name);
  const T = 5;
  const F = G.frameOf(p, n, [0, 1, 0], G.cross3(n, [0, 1, 0]));
  const facing = G.dot3(n, V) > 0.05;
  let extra = "";
  if (facing) {
    extra += L(G.circleOf(F, 0, r * 0.82, P), { tone: "faint" });
    if (faceted) {
      const pts = [];
      for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) if (Math.hypot(i, j) * r * 0.22 < r * 0.76) pts.push(at(G.pointOf(F, 0, Math.hypot(i, j) * r * 0.22, Math.atan2(j, i))));
      extra += Dots(pts, { size: 0.35, tone: "lo" });
    }
  }
  const seam = L(G.arcOf(F, -T + 1.2, r, P), { tone: "faint" });
  put(piece, `${piece}.mirror.${name}`, G.add3(p, G.mul3(n, -T / 2)), S(G.disc(-T, 0, r, F, P, { bevel: 0.4 }), { tone: "hi", crease: "lo", inner: seam, lit: true }) + extra, [A.disc(F, -T, 0, r)]);
  // mount: a pad bolted to the housing face behind it, and a short arm from the pad to the mirror's rim, along +y
  const c = G.add3(p, G.mul3(n, -T / 2));
  const t = G.cross3(n, [0, 1, 0]);
  const pad = 5;
  box(piece, `${piece}.mount.${name}`, [c[0] - pad, backY, c[2] - pad], [c[0] + pad, backY + 2, c[2] + pad], { tone: "mid" }, {
    r: 0.6,
    extra: Dots([[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([i, j]) => at([c[0] + i * (pad - 1.6), backY + 2, c[2] + j * (pad - 1.6)])), { size: 0.4 }),
  });
  const y0 = backY + 2;
  const Fa = G.frameOf([c[0], y0, c[2]], [0, 1, 0], n, t);
  const poly = [[-2.2, -2.4], [2.2, -2.4], [2.2, 2.4], [-2.2, 2.4]];
  const len = -r - y0 + 0.05;
  const Fc = G.frameOf([c[0], y0, c[2]], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
  const owner = `${piece}.arm.${name}`;
  put(piece, owner, [c[0], (y0 - r) / 2, c[2]], S(G.disc(0, 1.2, 3.4, Fc, P), { tone: "mid" }) + S(G.prismOf(Fa, poly, 0, len, P), { tone: "mid" }), [A.disc(Fc, 0, 1.2, 3.4, { owner }), A.prism(Fa, poly, 0, len, { owner })]);
}

// ---- light: beam legs dot to dot, lit; revealed by the slider ----
function beams() {
  LEGS.forEach(([a, b, piece], index) => {
    const pa = P3(a);
    const pb = P3(b);
    const last = index === LEGS.length - 1;
    const z = pb[2] + 0.05;
    const slit = last ? `<path class="euv-slit" d="${path3([[pb[0] - FIELD[0] / 2, -0.7, z], [pb[0] + FIELD[0] / 2, -0.7, z], [pb[0] + FIELD[0] / 2, 0.7, z], [pb[0] - FIELD[0] / 2, 0.7, z]], true)}"/>` : "";
    const svg = `<g class="euv-beam" data-leg="${index}">${slit}${L(path3([pa, pb]), { tone: "lit", className: "euv-ray" })}${Dots([at(pa), at(pb)], { size: 1.1, tone: "lit" })}</g>`;
    const mid = G.lerp3(pa, pb, 0.5);
    // the leg up to the reticle passes under the deck and the optics box top: sort it from behind them
    put(piece, `${piece}.beam`, b === "RET" ? [mid[0], -60, mid[2]] : mid, svg, [A.tube([pa, pb], 0.5)], { ghost: true });
  });
}

// ---- the tin plasma source: vessel (cut open), collector, droplet generator and catcher, neck and intermediate focus ----
function source() {
  const [vx, vy] = VC;
  // legs and floor
  for (const [dx, dy] of byDepth([[-28, -28], [28, -28], [-28, 28], [28, 28]]).map(([a, b]) => [a, b])) cyl("source", "source.leg", vx + dx, vy + dy, 4, SB_TOP, V_FLOOR[0] - SB_TOP, { tone: "mid" }, { steps: 20 });
  const floorRing = Array.from({ length: 12 }, (_, i) => [vx + (46 / Math.cos(rad(15))) * Math.cos(rad(15 + i * 30)), vy + (46 / Math.cos(rad(15))) * Math.sin(rad(15 + i * 30))]);
  ringPrism("source", "source.floor", floorRing, V_FLOOR[0], V_FLOOR[1] - V_FLOOR[0], { tone: "mid" }, { inner: L(k.ringSeam(floorRing, V_FLOOR[0] + 2, P), { tone: "faint" }) });
  // shell: the far half (inner faces seen) and the right lip (outer faces seen)
  ringPrism("source", "source.shell", polyArc(vx, vy, AP_IN, AP_OUT, 165, 315), V_FLOOR[1], V_TOP - V_FLOOR[1], { tone: "mid" }, { bias: -1 });
  ringPrism("source", "source.lip", polyArc(vx, vy, AP_IN, AP_OUT, 315, 375), V_FLOOR[1], V_TOP - V_FLOOR[1], { tone: "mid" });
  // lid over the far part, the neck and the IF flange
  const lidRing = [];
  for (let v = 165; v <= 375; v += 30) lidRing.push([vx + (46 / Math.cos(rad(15))) * Math.cos(rad(v)), vy + (46 / Math.cos(rad(15))) * Math.sin(rad(v))]);
  // the lid has a slot cut in front of the neck, and neck and flange are cut in half, so the light can be seen converging
  const chordY = lidRing[lidRing.length - 1][1];
  const slotted = [...lidRing, [vx + 10, chordY], [vx + 10, vy - 1], [vx - 10, vy - 1], [vx - 10, chordY]];
  ringPrism("source", "source.lid", slotted, V_TOP, LID_TOP - V_TOP, { tone: "mid" }, { ref: [vx, vy - 20, (V_TOP + LID_TOP) / 2], extra: Dots(lidRing.slice(1, -1).map(([x, y]) => at([vx + (x - vx) * 0.93, vy + (y - vy) * 0.93, LID_TOP])), { size: 0.45 }) });
  ringPrism("source", "source.neck", arcRing(vx, vy, 7, 9, 180, 360, 16), LID_TOP, IF[2] - 4 - LID_TOP, { tone: "mid" }, { ref: [vx, vy - 6, (LID_TOP + IF[2] - 4) / 2] });
  const halfArc = (r, z) => path3(Array.from({ length: 17 }, (_, i) => [vx + r * Math.cos(rad(180 + i * 11.25)), vy + r * Math.sin(rad(180 + i * 11.25)), z]));
  ringPrism("source", "source.ifflange", arcRing(vx, vy, 3, 13, 180, 360, 24), IF[2] - 4, 4, { tone: "mid" }, {
    ref: [vx, vy - 6, IF[2] - 2],
    extra: L(halfArc(8, IF[2]), { tone: "faint" }) + Dots([202.5, 247.5, 292.5, 337.5].map((a) => at([vx + 10.5 * Math.cos(rad(a)), vy + 10.5 * Math.sin(rad(a)), IF[2]])), { size: 0.4 }),
  });
  // collector: a multilayer mirror dish on the floor, with a hole for the laser
  const rings = [10, 16, 22, 27].map((r) => k.ring(vx, vy, r, COL_TOP, P, 56)).join("");
  cyl("source", "source.collector", vx, vy, 30, V_FLOOR[1], COL_TOP - V_FLOOR[1], { tone: "hi", crease: "lo" }, { steps: 64, bevel: 0.5, extra: L(rings, { tone: "faint" }) + L(k.ring(vx, vy, 3, COL_TOP, P, 20), { tone: "lo" }) });
  // droplet generator (on the -x face) and catcher (on the +x face)
  const gen = G.frameOf([vx - AP_OUT, vy, PL[2]], [-1, 0, 0], [0, 1, 0], [0, 0, 1]);
  turned("source", "source.generator", gen, [[0, 9], [3, 9], [3, 6], [11, 6], [11, 6.8], [13, 6.8], [13, 6], [21, 6], [21, 6.8], [23, 6.8], [23, 6], [30, 6], [30, 7.5], [34, 7.5], [34, 4], [38, 4]], { tone: "mid" });
  const cat = G.frameOf([vx + AP_OUT, vy, PL[2]], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
  turned("source", "source.catcher", cat, [[0, 9], [3, 9], [3, 7], [9, 7], [9, 7.8], [11, 7.8], [11, 7], [18, 7], [18, 5], [22, 5]], { tone: "mid" });
  // droplets, laser line, plasma, and the converging light (live)
  const d0 = [vx - AP_IN, 0, PL[2]];
  const d1 = [vx + AP_IN, 0, PL[2]];
  const hole = [vx, 0, COL_TOP];
  // one item for what lives in the vessel's light plane: the converging cone, the droplet stream, the plasma flash
  // the collector images the plasma onto the intermediate focus: a cone from the mirror's rim ring to a point on the flange
  // drawn in two parts: inside the vessel (with the droplets and plasma), and from the lid up through the cut neck
  const half = (z) => (27 * (IF[2] - z)) / (IF[2] - COL_TOP);
  const sheetOf = (poly) => A.prism(G.frameOf([0, -0.25, 0], [0, 1, 0], [1, 0, 0], [0, 0, 1]), poly.map(([x, , z]) => [x, z]), 0, 0.5);
  const low = [[vx - 27, 0, COL_TOP], [vx + 27, 0, COL_TOP], [vx + half(V_TOP), 0, V_TOP], [vx - half(V_TOP), 0, V_TOP]];
  const high = [[vx - half(V_TOP), 0, V_TOP], [vx + half(V_TOP), 0, V_TOP], IF];
  const sheet = sheetOf(low);
  const conesvg = `<g class="euv-cone"><path class="euv-glow" d="${path3(low, true)}"/>${L(path3([low[0], low[3]]) + path3([low[1], low[2]]), { tone: "lit", className: "euv-ray" })}</g>`;
  const neckconesvg = `<g class="euv-cone"><path class="euv-glow" d="${path3(high, true)}"/>${L(path3([high[0], high[2]]) + path3([high[1], high[2]]), { tone: "lit", className: "euv-ray" })}${Dots([at(IF)], { size: 1.1, tone: "lit" })}</g>`;
  const dropsvg = `${L(path3([d0, d1]), { tone: "faint", className: "euv-dropline" })}<g data-drops=""></g>`;
  const [fx, fy] = at(PL).map((v) => v.toFixed(1));
  const flashsvg = `<g class="euv-plasma"><ellipse class="euv-pancake" cx="${fx}" cy="${fy}" rx="2.6" ry="0.8"/><circle class="euv-preflash" cx="${fx}" cy="${fy}" r="1.8"/><circle class="euv-flash" cx="${fx}" cy="${fy}" r="5"/></g>`;
  const beamTo = path3([hole, PL]);
  const co2svg = `<g class="euv-pre">${L(beamTo, { tone: "hi", className: "euv-preline" })}${Dots([at(hole), at(PL)], { size: 0.6, tone: "hi" })}</g><g class="euv-co2">${L(beamTo, { tone: "hi", className: "euv-co2line" })}${Dots([at(hole), at(PL)], { size: 0.9, tone: "hi" })}</g>`;
  put("source", "source.light", PL, conesvg + dropsvg + co2svg + flashsvg, [sheet, A.tube([d0, d1], 0.9), A.tube([hole, PL], 0.6), A.ball(PL, 5 / KS)], { ghost: true });
  put("source", "source.cone", [vx, 1, (V_TOP + IF[2]) / 2], neckconesvg, [sheetOf(high)], { ghost: true });
}

// ---- the CO2 laser, with the beam tube to the vessel floor ----
function laser() {
  const L0 = LASER;
  const vents = [];
  for (let i = 0; i < 9; i++) vents.push(k.planOutline({ x: L0.x + 6, y: L0.y + 30 + i * 8, w: 22, d: 3, r: 1.5 }, LASER_TOP, P, 3));
  box("laser", "laser.body", [L0.x, L0.y, 0], [L0.x + L0.w, L0.y + L0.d, LASER_TOP], { tone: "mid" }, {
    r: 2,
    steps: 3,
    bevel: 0.6,
    inner: L(k.sideSeam(L0, 8, P, 3) + k.sideSeam(L0, LASER_TOP - 6, P, 3), { tone: "faint" }),
    extra: L(vents.join(""), { tone: "lo" }) + Dots(k.corners(L0, 4).map(([x, y]) => at([x, y, LASER_TOP])), { size: 0.5 }) + k.faceTextSvg(k.topMatrix([L0.x + L0.w / 2, L0.y + 16], LASER_TOP, P, "y"), "CO2", { size: 3.4, tone: "lo", anchor: "middle" }),
  });
  pipe("laser", "laser.tube", [[LASER.x, 0, 16], [VC[0], 0, 16], [VC[0], 0, V_FLOOR[0]]], 3, { flange: 6, ft: 1.6 });
}

// ---- the parts that serve the modules: ribs, pumps, a gas line, a coolant hose, a cabinet, signal towers ----
function signalTower(piece, name, x, y, z) {
  cyl(piece, `${name}.post`, x, y, 1.4, z, 14, { tone: "mid" }, { steps: 12 });
  const tones = ["lo", "mid", "lit"];
  let zz = z + 14;
  cyl(piece, `${name}.base`, x, y, 3.2, zz, 1.4, { tone: "mid" }, { steps: 20 });
  zz += 1.4;
  tones.forEach((tone, i) => {
    cyl(piece, `${name}.lamp`, x, y, 2.8, zz, 3.4, tone === "lit" ? { tone: "hi", lit: true } : { tone: "mid" }, { steps: 20 });
    zz += 3.4;
  });
  cyl(piece, `${name}.cap`, x, y, 3.2, zz, 1, { tone: "mid" }, { steps: 20 });
}
function details() {
  // stiffener ribs on the back wall
  for (const [x, top] of [[178, 164], [232, 186]]) box("frame", "frame.rib", [x, WALL_Y[1], SB_TOP], [x + 5, WALL_Y[1] + 4, top], { tone: "lo" }, { r: 0.4, extra: Dots([30, 90, 150].map((z) => at([x + 2.5, WALL_Y[1] + 4, z])), { size: 0.4, tone: "lo" }) });
  // cable tray along the bottom of the back wall
  box("frame", "frame.tray", [-10, WALL_Y[1], 22], [118, WALL_Y[1] + 5, 28], { tone: "mid" }, { r: 0.4, extra: L(k.lineOnTop([-9, WALL_Y[1] + 2.5], [117, WALL_Y[1] + 2.5], 28, P), { tone: "faint" }) });
  // reticle library box on the deck
  box("reticle", "reticle.library", [-4, -44, DECK_Z[1]], [30, -8, DECK_Z[1] + 12], { tone: "mid" }, {
    r: 1,
    steps: 3,
    bevel: 0.4,
    inner: L(k.sideSeam({ x: -4, y: -44, w: 34, d: 36, r: 1 }, DECK_Z[1] + 4, P, 3), { tone: "faint" }),
    extra: L(k.planOutline({ x: 0, y: -40, w: 26, d: 28, r: 1 }, DECK_Z[1] + 12, P, 3), { tone: "lo" }) + Dots(k.corners({ x: -4, y: -44, w: 34, d: 36 }, 2).map(([x, y]) => at([x, y, DECK_Z[1] + 12])), { size: 0.4 }),
  });
  // turbo pumps on the vessel lid
  for (const [x, y] of [[226, -22], [276, -22]]) {
    cyl("source", "source.turbo.flange", x, y, 9, LID_TOP, 2, { tone: "mid" }, { steps: 36, extra: Dots(Array.from({ length: 6 }, (_, i) => at([x + 7.6 * Math.cos((i * Math.PI) / 3), y + 7.6 * Math.sin((i * Math.PI) / 3), LID_TOP + 2])), { size: 0.4 }) });
    cyl("source", "source.turbo", x, y, 7.5, LID_TOP + 2, 16, { tone: "mid" }, { steps: 36, bevel: 0.4, inner: L(k.sideArc(x, y, 7.5, LID_TOP + 6, P, 24) + k.sideArc(x, y, 7.5, LID_TOP + 14, P, 24), { tone: "faint" }) });
    cyl("source", "source.turbo.cap", x, y, 4.5, LID_TOP + 18, 3, { tone: "mid" }, { steps: 24, extra: L(k.ring(x, y, 2, LID_TOP + 21, P, 16), { tone: "lo" }) });
  }
  // hydrogen line from the back wall to the vessel lid (the gas that protects the collector)
  pipe("source", "source.h2", [[262, -34, 186], [262, -34, LID_TOP]], 1.6, { flange: 3, ft: 1.2 });
  // coolant hose from the laser to the end of the back wall
  pipe("laser", "laser.coolant", [[328, -59, LASER_TOP], [328, -59, 64], [WALL_X[1], -59, 64]], 1.4, { flange: 2.3, ft: 1.2 });
  // cable lane: a junction box on the back wall above the metrology bridge, three cables in a clamp up into the illuminator housing
  const jb = { x: 126, y: WALL_Y[1], w: 30, d: 8, r: 1 };
  box("frame", "frame.junction", [jb.x, jb.y, 86], [jb.x + jb.w, jb.y + jb.d, 108], { tone: "mid" }, {
    r: 1,
    steps: 3,
    bevel: 0.4,
    inner: L(k.sideSeam(jb, 92, P, 3), { tone: "faint" }),
    extra: Dots(k.corners(jb, 2.2).map(([x, y]) => at([x, y, 108])), { size: 0.4 }) + Dots([at([132, jb.y + jb.d, 97]), at([138, jb.y + jb.d, 97])], { size: 0.6, tone: "mid" }) + k.faceTextSvg(k.topMatrix([141, jb.y + 4], 108, P, "x"), "SENSORS", { size: 2, tone: "lo", anchor: "middle" }),
  });
  for (const x of [132, 141, 150]) pipe("frame", `frame.cable${x}`, [[x, -51, 108], [x, -51, 164]], 1.3, { flange: 2.2, ft: 1, maxLength: 30 });
  box("frame", "frame.clamp", [128, -48.2, 134], [154, -46, 139], { tone: "mid" }, { r: 0.4, extra: Dots([at([129.2, -46, 136.5]), at([152.8, -46, 136.5])], { size: 0.4 }) });
  for (const x0 of [126, 154]) box("frame", "frame.clamp.foot", [x0, WALL_Y[1], 134], [x0 + 2, -46, 139], { tone: "mid" }, { r: 0.3 });
  // signal towers on the track and on the scanner
  signalTower("track", "track.tower", -124, -82, DECK);
  signalTower("wstage", "wstage.tower", -94, 52, SB_TOP);
  // vents on the track's front panels
  const fy = TRK.y + TRK.d;
  const slots = [];
  for (const x0 of [-322, -268, -214, -160]) for (let i = 0; i < 4; i++) slots.push(path3([[x0 + 6 + i * 4, fy, 10], [x0 + 8 + i * 4, fy, 10], [x0 + 8 + i * 4, fy, 18], [x0 + 6 + i * 4, fy, 18]], true));
  put("track", "track.vents", [-220, fy, 14], L(slots.join(""), { tone: "lo" }), [A.box([-322, fy - 0.1, 10], [-140, fy, 18])], { bias: 0.5, ghost: true });
}

base();
track();
frame();
waferStage();
reticleStage();
source();
laser();
details();
for (const [name, piece] of [["FF", "illuminator"], ["PF", "illuminator"], ["GM", "illuminator"], ["M1", "optics"], ["M2", "optics"], ["M3", "optics"], ["M4", "optics"], ["M5", "optics"], ["M6", "optics"]]) mirror(piece, name, { faceted: name === "FF" || name === "PF", backY: piece === "illuminator" ? ILL_Y[1] : POB.yf });
beams();
wafer("coat", ...CUP.coat, DECK + 9);
wafer("soft", ...HP.soft, DECK + 13);
wafer("stage", WC[0], WC[1], CHUCK_TOP, { grid: true });
wafer("peb", ...HP.peb, DECK + 13, { grid: true });
wafer("dev", ...CUP.dev, DECK + 9, { grid: true });
wafer("next", WC2[0], WC2[1], CHUCK_TOP);

if (!process.argv.includes("--fast")) A.settle(R, P);
R.items.sort((a, b) => a.key - b.key);
const groups = R.items.map((item) => `<g class="it" data-piece="${item.piece}" data-name="${item.name}"${item.attrs ?? ""}>${item.svg}</g>` + (ALT_POSES[item.name] ?? []).join(""));

const ORDER = ["track", "laser", "source", "illuminator", "reticle", "optics", "wstage"];
const PIECES = {
  track: { name: "Coat/develop track", say: "spin cups, hot plates, chill plate, robot" },
  laser: { name: "CO2 drive laser", say: `${M.LIGHT.laserKw} kW CO2 · pre-pulse, then main pulse` },
  source: { name: "Tin plasma source", say: `${M.LIGHT.dropletUm} µm tin at ${M.LIGHT.dropletSpeedMs} m/s · plasma ≈${M.LIGHT.plasmaC.toLocaleString("en-US")} °C` },
  illuminator: { name: "Illuminator", say: "facet mirrors make an even slit of light" },
  reticle: { name: "Reticle stage", say: `mask face down · scans ${M.OPTICS.reduction}× faster than wafer` },
  optics: { name: "Projection optics", say: `${M.OPTICS.pobMirrors} mirrors · NA ${M.OPTICS.na} · ≈${Math.round(M.POB_PASS * 100)}% of light gets through` },
  wstage: { name: "Wafer stages", say: `two stages: one exposes, one measures · ${M.SCANNER.fields} fields · ${M.SCANNER.wph} wafers/h` },
};
const LABEL = "An EUV lithography scanner cut open beside its coat and develop track. On the left, the track: two spin cups with nozzle arms, two hot plates with lids, a chill plate and a transfer robot. A tunnel leads to the scanner's load lock, and a gate valve opens from it into the vacuum chamber, whose walls are cut down to a sill. In the scanner, from the right: a CO2 laser whose beam tube rises into a cut-open source vessel, where a droplet generator fires tin droplets across a collector mirror toward a catcher; a cut-open neck carries the converging light up to the intermediate focus. Above, three illuminator mirrors bolted to the illuminator housing send the light up to a reticle held face down on a scanning stage. Below the reticle, a cut-open projection optics box holds six mirrors on its back panel; they zig-zag the light down onto a wafer on the wafer stage. Beside it, a second stage sits under a metrology bridge with level and alignment sensors.";
const svg = k.figureSvg({ width: W, height: H, label: LABEL, body: [`<g class="euv-layers">${groups.join("")}</g>`], className: "euv-svg" });

const unit = (vector) => {
  const o = at([0, 0, 0]);
  const p = at(vector);
  return [p[0] - o[0], p[1] - o[1]];
};
const STEP_SECONDS = { coat: 5, softbake: 5, load: 7.5, droplet: 6, illuminate: 4, project: 3.5, scan: 9, peb: 8, develop: 7 };
const DATA = {
  EX: unit([1, 0, 0]),
  EY: unit([0, 1, 0]),
  EZ: unit([0, 0, 1]),
  steps: M.STEPS.map((s) => ({ ...s, seconds: STEP_SECONDS[s.id] })),
  pieces: PIECES,
  order: ORDER,
  idle: M.IDLE,
  waferR: WAFER_R,
  wafers: { coat: [...CUP.coat, DECK + 10], soft: [...HP.soft, DECK + 14], stage: [WC[0], WC[1], CHUCK_TOP + 1], peb: [...HP.peb, DECK + 14], dev: [...CUP.dev, DECK + 10] }.valueOf(),
  centres: Object.fromEntries(Object.entries({ coat: [...CUP.coat, DECK + 10], soft: [...HP.soft, DECK + 14], stage: [WC[0], WC[1], CHUCK_TOP + 1], peb: [...HP.peb, DECK + 14], dev: [...CUP.dev, DECK + 10] }).map(([id, p]) => [id, at(p)])),
  fields: FIELDS,
  field: FIELD,
  fieldCount: M.SCANNER.fields,
  drops: { from: at([VC[0] - AP_IN, 0, PL[2]]), to: at([VC[0] + AP_IN, 0, PL[2]]), hit: at(PL) },
  armTravel: 36,
  // wafer trips between stations, in world units: each wafer's own rest (centre, bottom z), the robot's hand positions
  rest: { coat: [...CUP.coat, DECK + 9], soft: [...HP.soft, DECK + 13], stage: [WC[0], WC[1], CHUCK_TOP], peb: [...HP.peb, DECK + 13], dev: [...CUP.dev, DECK + 9] },
  cups: { coat: CUP.coat, dev: CUP.dev },
  lids: { soft: HP.soft, peb: HP.peb },
  transit: TRANSIT,
  forkTop: FORK_TOP,
  poses: ROBOT_POSES.map((pose) => pose.c),
  tunnelIn: 26,
  gateSlide: 30,
  gateLift: 14,
  wavelength: M.LIGHT.wavelengthNm,
  lidDrop: 13,
  reticleGain: M.OPTICS.reduction,
  legs: LEGS.length,
  illumLegs: 4,
};

const PARTS = ORDER.map((id, index) => `<button type="button" class="euv-part" data-part="${id}"><span class="euv-num">${String(index + 1).padStart(2, "0")}</span>${PIECES[id].name}</button>`).join("");
const corners = `<div class="iso-plate-corners" aria-hidden="true"><span class="iso-plate-corner" data-corner="fig">Fig 1</span><span class="iso-plate-corner" data-corner="title">EUV scanner · cutaway</span><span class="iso-plate-corner" data-corner="readout" data-readout>${M.IDLE}</span></div>`;
const controls = `<div class="euv-controls"><span class="euv-hint">Hover a module · Space plays the wafer through</span><span class="euv-live" aria-live="polite" data-live></span></div>`;
const stage = `<div class="euv-stage" tabindex="0" role="group" aria-label="EUV scanner and coat/develop track. Hover, or use the arrow keys, to pick a module; Space plays or pauses the wafer's trip through the machines; Escape resets; the slider below steps through the process.">${svg}</div>`;
const caption = `An ${M.SCANNER.name}-class EUV scanner, cut open, beside its coat/develop track. A ${M.LIGHT.laserKw} kW CO2 laser hits ${M.LIGHT.dropletsPerS.toLocaleString("en-US")} tin droplets a second (${M.LIGHT.dropletUm} µm, ${M.LIGHT.dropletSpeedMs} m/s, so ${M.DROPLET_GAP_MM.toFixed(1)} mm apart): a pre-pulse flattens each one and the main pulse turns it into plasma at about ${M.LIGHT.plasmaC.toLocaleString("en-US")} °C that glows at ${M.LIGHT.wavelengthNm} nm. Air and glass absorb that light, so everything runs in vacuum and every optic is a multilayer mirror reflecting at most ${Math.round(M.OPTICS.reflectance * 100)}%: after the six projection mirrors alone about ${Math.round(M.POB_PASS * 100)}% is left. The projection optics (NA ${M.OPTICS.na}) shrink the reticle's ${M.RETICLE_FIELD_MM[0]} × ${M.RETICLE_FIELD_MM[1]} mm pattern ${M.OPTICS.reduction}× onto a ${M.OPTICS.fieldMm[0]} × ${M.OPTICS.fieldMm[1]} mm field, scanning reticle and wafer in opposite directions, ${M.SCANNER.fields} fields a wafer, ${M.SCANNER.wph} wafers an hour at ${M.SCANNER.doseMjCm2} mJ/cm². Layout, sizes and mirror angles are illustrative (the real laser sits in the sub-fab below, and the real light path folds in three dimensions); between the hot plates the wafer glides on its own, where a real track's robots carry it the whole way. The NXE is a TWINSCAN: a second stage on the right measures the next wafer while this one is exposed. Ruler ticks are 10 mm at wafer scale.`;
const scrub = `<span class="euv-scrub"><button type="button" class="euv-play" data-play aria-label="Play the process"><span class="euv-play-icon" aria-hidden="true"></span><span data-play-text>Play</span></button><input type="range" class="euv-range" data-scrub min="0" max="1000" step="1" value="0" aria-label="Process step: 0 is the start of coating, 1000 is the end of develop"><span class="euv-step" data-step>01 · Coat resist</span></span>`;
const body = `<figure class="iso-figure euv"><div class="iso-plate">${corners}${stage}${controls}</div><figcaption class="iso-legend">${scrub}<span class="euv-parts">${PARTS}</span><span class="iso-caption">${caption}</span></figcaption></figure>`;

const CSS = readFileSync(join(HERE, "lithography-euv.css"), "utf8");
const LIVE = readFileSync(join(HERE, "live.js"), "utf8").replace("__DATA__", JSON.stringify(DATA));
const out = writeChapter({ slug: "lithography-euv", figure: body, css: CSS, script: LIVE, lesson: LESSON });
console.log("wrote", out.file, `${out.kb} KB`, `${R.items.length} items`, `${R.solids.length} solids`, `${FIELDS.length} fields`);

// the leg up to the reticle passes under the deck's edge and the optics box top: a sliver of under 3 px² where the
// one-piece beam sorts after them (checked at 4x)
A.auditOrExit(R, P, { allow: [["reticle.deck#2", "illuminator.beam#4"], ["optics.housing.top#2", "illuminator.beam#4"]] });
