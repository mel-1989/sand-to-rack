// Four transistor generations as sectioning specimens on one bench: planar, FinFET, nanosheet, CFET.
// Each specimen is one contacted gate pitch long (to scale, 1 unit = 1 nm along the channel); its drain half rides a
// carriage that slides out along the channel to show the cut through the gate.
// node build.mjs [--audit] [--fast]
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as M from "./model.mjs";

import { k, G, A } from "../../site/kit.mjs";
import { writeChapter } from "../../site/shell.mjs";
import { LESSON } from "./lesson.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const U = M.UNIT;

const W = 720;
const H = 272;
const AZIMUTH = 45;
const ELEVATION = 30;

// ---- layout: specimens in a row along (1, -1), which runs left to right on screen; channels along x;
// drain halves slide +x, so each cut face looks out past its own carriage with nothing in front of it ----
const IDS = M.GENS.map((g) => g.id);
const STEP = 108;
const SLIDE = 86;
const Z0 = 10; // specimen base sits on its pedestal and carriage at this height
const HW = 44; // half width of every specimen block (y)
const PLANAR_OX = 3.2; // planar gate dielectric, drawn thick (illustrative)

// Illustrative device geometry (heights, widths, gate lengths except the planar one); x lengths follow CPP.
const SPEC = {
  planar: { g: (M.GENS[0].lgNm * U) / 2, sp: 8, base: 20, gateTop: 42, cap: 0, ct: 56 },
  finfet: { g: 13, sp: 6, base: 14, sti: 22, finTop: 22 + M.GENS[1].finHeightNm * U, gateTop: 70, cap: 3, ct: 86 },
  gaa: { g: 8, sp: 4, base: 14, sti: 22, sheets: [26, 39, 52], sheetH: 5, gateTop: 68, cap: 3, ct: 86 },
  cfet: { g: 9, sp: 4, base: 14, sti: 22, sheets: [26, 39, 52, 73, 86, 99], sheetH: 5, mdi: [61, 69], gateTop: 115, cap: 3, ct: 128 },
};
M.GENS.forEach((gen, i) => {
  SPEC[gen.id].half = (gen.cppNm * U) / 2;
  SPEC[gen.id].X = (i - 1.5) * STEP;
  SPEC[gen.id].Y = -(i - 1.5) * STEP;
  SPEC[gen.id].index = i;
});

// The bench plate is a rounded rectangle laid along the row: u along (1, -1), n along (1, 1), toward the viewer.
const RT = Math.SQRT1_2;
const toXY = (u, n) => [(u + n) * RT, (n - u) * RT];
const toUN = (x, y) => [(x - y) * RT, (x + y) * RT];
const P0 = SPEC[IDS[0]];
const P3 = SPEC[IDS[3]];
const RULER = { x: P0.X - 84, y: P0.Y + HW + 16, w: 168, d: 9, r: 1 };
const LABEL_PLATE = { x: P3.X + 22, y: P3.Y + HW + 16, w: 50, d: 18, r: 1.5 };
const FOOTPRINT = [
  ...IDS.flatMap((id) => {
    const s = SPEC[id];
    const x0 = s.X - s.half - 6;
    const x1 = s.X + s.half + SLIDE + 17;
    return [[x0, s.Y - HW - 5], [x1, s.Y - HW - 5], [x0, s.Y + HW + 5], [x1, s.Y + HW + 5]];
  }),
  ...k.boxCorners(RULER, 0, 0).map(([x, y]) => [x, y]),
  ...k.boxCorners(LABEL_PLATE, 0, 0).map(([x, y]) => [x, y]),
].map(([x, y]) => toUN(x, y));
const UN = (() => {
  const us = FOOTPRINT.map(([u]) => u);
  const ns = FOOTPRINT.map(([, n]) => n);
  const u0 = Math.min(...us) - 14;
  const n0 = Math.min(...ns) - 14;
  return { x: u0, y: n0, w: Math.max(...us) + 14 - u0, d: Math.max(...ns) + 14 - n0, r: 14 };
})();
const ringUN = (plan, steps = 8) => k.roundedPlan(plan, steps).map(([u, n]) => toXY(u, n));
const PLATE_RING = ringUN(UN);
const PLATE_H = 12;
const FOOT_H = 6;

const SPRING = { stagger: 0.12, stiffness: 40, damping: 12.6, substeps: 4 };
const STAGGER = [...IDS, "stand"];

const P = k.fitProjection(
  [
    ...PLATE_RING.flatMap(([x, y]) => [[x, y, -PLATE_H - FOOT_H], [x, y, 0]]),
    ...IDS.flatMap((id) => {
      const s = SPEC[id];
      return k.boxCorners({ x: s.X - s.half, y: s.Y - HW, w: 2 * s.half + SLIDE, d: 2 * HW, r: 0 }, 0, Z0 + s.ct + 3);
    }),
  ],
  W,
  H,
  { pad: 10, azimuth: AZIMUTH, elevation: ELEVATION },
);
const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);
const box = (x0, x1, y0, y1, r = 0.3) => ({ x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0), d: Math.abs(y1 - y0), r });
const centreOf = (plan, z) => [plan.x + plan.w / 2, plan.y + plan.d / 2, z];

const R = A.recorder(P, { order: STAGGER, spring: SPRING });
const MOVE = [SLIDE, 0, 0];
let HOST = false; // set while drawing a specimen's stage: hover finds the specimen, but only the specimen lights
function put(piece, gen, ref, svg, shapes, { bias = 0, name } = {}) {
  const id = name ?? R.nameFor(`${piece === "stand" ? "stand" : piece}.item`);
  shapes.forEach((shape) => (shape.name = shape.name ?? id));
  R.put({ piece, gen, host: HOST, at: ref, bias, svg, move: piece === "stand" ? [0, 0, 0] : MOVE, shapes: shapes.map(R.solid), name: id });
}
const slabShape = (plan, z, h, steps = 2) => A.slab(plan, z, h, {}, steps);

// ---- section drawings on a face x = xf (points are [y, z]) ----
const pathYZ = (xf, pts) => `M${pts.map(([y, z]) => at([xf, y, z]).map((n) => n.toFixed(2)).join(" ")).join("L")}Z`;
function rrect(y0, y1, z0, z1, r = 0, steps = 4) {
  if (r <= 0) return [[y0, z0], [y1, z0], [y1, z1], [y0, z1]];
  const pts = [];
  const arc = (cy, cz, a0) => {
    for (let i = 0; i <= steps; i++) {
      const a = a0 + (i / steps) * (Math.PI / 2);
      pts.push([cy + r * Math.cos(a), cz + r * Math.sin(a)]);
    }
  };
  arc(y1 - r, z0 + r, -Math.PI / 2);
  arc(y1 - r, z1 - r, 0);
  arc(y0 + r, z1 - r, Math.PI / 2);
  arc(y0 + r, z0 + r, Math.PI);
  return pts;
}
// a fin: trapezoid with a rounded top, open bottom at z0
function finPts(yc, z0, z1, w0, w1, round = 2.4, grow = 0) {
  const pts = [[yc - w0 / 2 - grow, z0], [yc + w0 / 2 + grow, z0]];
  const top = z1 + grow;
  const half = w1 / 2 + grow;
  pts.push([yc + half, top - round]);
  for (let i = 1; i < 8; i++) {
    const a = (i / 8) * Math.PI;
    pts.push([yc + half * Math.cos(a), top - round + round * Math.sin(a)]);
  }
  pts.push([yc - half, top - round]);
  return pts;
}
// material classes: tr-si silicon channel, tr-ox gate dielectric, tr-iso isolation dielectric, tr-sd doped silicon
const mat = (cls, d, tone, sub) => `<path class="tr-mat ${cls}" data-sub="${sub}" d="${d}"/><path class="iso-line tr-edge ${cls}-edge" data-tone="${tone}" d="${d}"/>`;

// ---- the bench: plate, feet, ruler, label plate ----
function bench() {
  const out = [];
  out.push(`<path class="iso-halo" d="${k.extrude(PLATE_RING, -PLATE_H - FOOT_H, PLATE_H, P).fill}"/>`);
  const shapes = [];
  const feet = k.corners(UN, 26).map(([u, n]) => toXY(u, n)).sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
  for (const [x, y] of feet) {
    out.push(S(k.cylinder(x, y, 8, -PLATE_H - FOOT_H, 1.8, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 6.2, -PLATE_H - FOOT_H + 1.8, FOOT_H - 1.8, P, 28), { tone: "mid" }));
    shapes.push(A.cylinder(x, y, 8, -PLATE_H - FOOT_H, FOOT_H, { name: "stand.foot" }));
  }
  out.push(S(k.extrude(PLATE_RING, -PLATE_H, PLATE_H, P, { bevel: 1.6 }), { tone: "mid", inner: L(k.ringSeam(PLATE_RING, -PLATE_H + 3, P), { tone: "faint" }) }));
  shapes.push(A.extruded(PLATE_RING, -PLATE_H, PLATE_H, { name: "stand.plate" }));
  out.push(L(k.onTop(ringUN(k.insetPlan(UN, 6)), 0, P, true), { tone: "lo" }));
  const screws = k.corners(UN, 12).map(([u, n]) => toXY(u, n));
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.4, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(Dots(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // ruler along x beside the planar specimen: 1 unit = 1 nm, ticks every 10 nm, majors every 50 nm
  const strip = RULER;
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(P0.X - 80, P0.X + 80, 10 * U, 5, strip.y + 0.8, 0.6, [2.4, 4.4], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(Dots([at([strip.x + 2, strip.y + 6.5, 0.6]), at([strip.x + strip.w - 2, strip.y + 6.5, 0.6])], { size: 0.45 }));
  // label plate
  const label = LABEL_PLATE;
  out.push(S(k.slabOf(label, 0, 0.8, P, 4), { tone: "lo", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.8), 0.8, P, 4), { tone: "faint" }));
  out.push(L([0, 1, 2].map((i) => k.lineOnTop([label.x + 8, label.y + 5 + i * 4], [label.x + 40 - i * 9, label.y + 5 + i * 4], 0.8, P)).join(""), { tone: "lo", free: true }));
  out.push(Dots([at([label.x + 4, label.y + label.d / 2, 0.8]), at([label.x + label.w - 4, label.y + label.d / 2, 0.8])], { size: 0.45 }));
  put("stand", null, [0, 0, -1], out.join(""), shapes, { name: "stand.base", bias: -400 });
}

// ---- per specimen: pedestal, rails, carriage, knob ----
function stage(id) {
  const s = SPEC[id];
  const Y = s.Y;
  const X = s.X;
  // pedestal under the source half
  const ped = box(X - s.half - 6, X, Y - HW - 5, Y + HW + 5, 1);
  const marks = [];
  for (let i = 0; i <= s.index; i++) marks.push(at([X - s.half - 3, Y - 6 + i * 4, Z0]));
  const pedScrews = [[X - s.half - 3, Y - HW - 2.5], [X - s.half - 3, Y + HW + 2.5], [X - 3, Y - HW - 2.5], [X - 3, Y + HW + 2.5]];
  const pedSvg =
    S(k.slabOf(ped, 0, Z0, P, 3, 0.5), { tone: "mid", inner: L(k.sideSeam(ped, 3, P, 3), { tone: "faint" }) }) +
    L(pedScrews.map(([x, y]) => k.ring(x, y, 1.4, Z0, P, 12)).join(""), { tone: "lo" }) +
    Dots(pedScrews.map(([x, y]) => at([x, y, Z0])), { size: 0.4 }) +
    Dots(marks, { size: 0.55, tone: "hi" });
  put("stand", id, centreOf(ped, 0), pedSvg, [slabShape(ped, 0, Z0, 3)], { name: `stand.${id}.pedestal` });

  // rails, end stops
  const railEnd = X + s.half + 4 + SLIDE + 3;
  for (const dy of [-28, 28]) {
    const rail = box(X + 1, railEnd, Y + dy - 2.5, Y + dy + 2.5, 0.8);
    const railSvg = S(k.slabOf(rail, 0, 4, P, 2, 0.3), { tone: "mid" }) + Dots([at([X + 8, Y + dy, 4]), at([railEnd - 6, Y + dy, 4])], { size: 0.35 });
    put("stand", id, centreOf(rail, 0), railSvg, [slabShape(rail, 0, 4)], { name: `stand.${id}.rail${dy < 0 ? "L" : "R"}` });
    const stop = box(railEnd, railEnd + 6, Y + dy - 5, Y + dy + 5, 1);
    const stopSvg = S(k.slabOf(stop, 0, 9, P, 3, 0.4), { tone: "mid" }) + Dots([at([railEnd + 3, Y + dy, 9])], { size: 0.45 });
    put("stand", id, centreOf(stop, 0), stopSvg, [slabShape(stop, 0, 9, 3)], { name: `stand.${id}.stop${dy < 0 ? "L" : "R"}` });
  }
  // carriage: four bearing blocks on the rails, a plate, a lug and a knurled pull knob
  const bx = [X + 4, X + s.half - 8];
  for (const x of bx) for (const dy of [-28, 28]) {
    const b = box(x - 4, x + 4, Y + dy - 4.5, Y + dy + 4.5, 0.8);
    const bSvg = S(k.slabOf(b, 4, 3, P, 2, 0.3), { tone: "mid" });
    put(id, id, centreOf(b, 4), bSvg, [slabShape(b, 4, 3)], { name: R.nameFor(`${id}.bearing`) });
  }
  const car = box(X + 0.5, X + s.half + 4, Y - HW - 5, Y + HW + 5, 1);
  const carScrews = [[X + s.half + 1.5, Y - HW - 2.5], [X + s.half + 1.5, Y + HW + 2.5], [X + 3, Y - HW - 2.5], [X + 3, Y + HW + 2.5]];
  const carSvg =
    S(k.slabOf(car, 7, 3, P, 3, 0.5), { tone: "mid" }) +
    L(carScrews.map(([x, y]) => k.ring(x, y, 1.4, Z0, P, 12)).join(""), { tone: "lo" }) +
    Dots(carScrews.map(([x, y]) => at([x, y, Z0])), { size: 0.4 });
  put(id, id, centreOf(car, 7), carSvg, [slabShape(car, 7, 3, 3)], { name: `${id}.carriage` });
  // clamp jaws hold each half against the ledge: a jaw on each side, a knurled thumb screw on the near one
  for (const [piece, cx] of [["stand", X - s.half / 2], [id, X + s.half / 2]]) {
    for (const sy of [-1, 1]) {
      const jaw = box(cx - 6, cx + 6, Y + sy * HW, Y + sy * (HW + 4), 0.6);
      let svg = S(k.slabOf(jaw, Z0, 8, P, 2, 0.4), { tone: "mid" }) + L(k.ring(cx, Y + sy * (HW + 2), 1.2, Z0 + 8, P, 12), { tone: "lo" }) + Dots([at([cx, Y + sy * (HW + 2), Z0 + 8])], { size: 0.4 });
      const shapes = [slabShape(jaw, Z0, 8)];
      if (sy > 0) {
        const F = G.frameOf([cx, Y + HW + 4, Z0 + 4], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
        const prof = [[0, 1.3], [1.6, 1.3], [1.6, 3], [5.6, 3]];
        svg += S(G.solidOf(prof, F, P), { tone: "hi", crease: "lo" }) + k.fadedSvg(G.ribsOf(F, 2, 5.2, 3, 18, P, { fade: [0.1, 0.55], seams: true }), { tone: "lo" });
        shapes.push(A.solid(F, prof, {}));
      }
      put(piece, id, centreOf(jaw, Z0), svg, shapes, { name: piece === "stand" ? R.nameFor(`stand.${id}.jaw`) : R.nameFor(`${id}.jaw`) });
    }
  }
  const lug = box(X + s.half + 4, X + s.half + 8, Y - 7, Y + 7, 0.6);
  put(id, id, centreOf(lug, 4), S(k.slabOf(lug, 4, 6, P, 2, 0.3), { tone: "mid" }), [slabShape(lug, 4, 6)], { name: `${id}.lug` });
  const F = G.frameOf([X + s.half + 8, Y, 7], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
  const knobProfile = [[0, 2.2], [3, 2.2], [3, 4.6], [9, 4.6]];
  const knob = G.solidOf(knobProfile, F, P);
  const ribs = G.ribsOf(F, 3.6, 8.4, 4.6, 28, P, { fade: [0.1, 0.55], seams: true });
  const knobSvg = S(knob, { tone: "hi", crease: "lo" }) + k.fadedSvg(ribs, { tone: "lo" }) + L(G.circleOf(F, 9, 1.6, P, 20), { tone: "lo" });
  put(id, id, [X + s.half + 13, Y, 7], knobSvg, [A.solid(F, knobProfile, {})], { name: `${id}.knob` });
}

// ---- the specimen itself: two halves cut through the gate ----
function specimen(id) {
  const s = SPEC[id];
  const Y = s.Y;
  const X = s.X;
  const sti = s.sti ?? s.base;
  const capTop = s.gateTop + s.cap;
  for (const side of [-1, 1]) {
    const piece = side < 0 ? "stand" : id;
    const tag = side < 0 ? `stand.${id}.src` : `${id}.drn`;
    const xs = (a, b) => [X + side * a, X + side * b];
    const face = X + (side < 0 ? 0 : s.half); // the visible +x face of this half
    const xr = xs(0, s.half);
    const z = (v) => Z0 + v;

    // substrate (and the backside power layer under the CFET)
    let baseFrom = 0;
    if (id === "cfet") {
      const bp = box(...xr, Y - HW, Y + HW);
      put(piece, id, centreOf(bp, z(0)), S(k.slabOf(bp, z(0), 4, P, 2), { tone: "lo", inner: L(k.sideSeam(bp, z(2), P, 2), { tone: "faint" }) }), [slabShape(bp, z(0), 4)], { name: `${tag}.backside` });
      baseFrom = 4;
    }
    const base = box(...xr, Y - HW, Y + HW);
    let baseFace = "";
    if (id === "planar") {
      for (const [a, b] of [[-HW, -32], [32, HW]]) baseFace += mat("tr-iso", pathYZ(face, rrect(Y + a, Y + b, z(11), z(s.base))), "lo", "trench");
      // source half, cut through the gate: the channel strip under the oxide, the doped well around it;
      // drain half, its outer end cut through the drain: the doped drain region under the raised drain
      if (side < 0) {
        baseFace += mat("tr-sd", pathYZ(face, rrect(Y - 31, Y + 31, z(s.base - 9), z(s.base), 0)), "lo", "body");
        baseFace += mat("tr-sib", pathYZ(face, rrect(Y - 30, Y + 30, z(s.base - 5.5), z(s.base))), "hi", "channel");
      } else baseFace += mat("tr-sd", pathYZ(face, rrect(Y - 30, Y + 30, z(s.base - 7), z(s.base), 0)), "hi", "well");
    }
    const well = L(k.sideSeam(base, z(s.base - (id === "planar" ? 11 : 7)), P, 2), { tone: "faint" });
    put(piece, id, centreOf(base, z(baseFrom)), S(k.slabOf(base, z(baseFrom), s.base - baseFrom, P, 2, 0.3), { tone: "mid", inner: well }) + baseFace, [slabShape(base, z(baseFrom), s.base - baseFrom)], { name: `${tag}.base` });

    // shallow trench isolation with the fin roots in it
    if (s.sti) {
      const plan = box(...xr, Y - HW, Y + HW);
      let roots = "";
      if (id === "finfet") for (const yc of [-30, 30]) roots += mat("tr-si", pathYZ(face, [[Y + yc - 5, z(s.base)], [Y + yc + 5, z(s.base)], [Y + yc + 4.7, z(sti)], [Y + yc - 4.7, z(sti)]]), "mid", "root");
      else {
        const stacks = id === "gaa" ? [[-22, 13], [22, 13]] : [[0, 14]];
        for (const [yc, hw] of stacks) roots += mat("tr-si", pathYZ(face, rrect(Y + yc - hw, Y + yc + hw, z(s.base), z(sti))), "mid", "root");
      }
      put(piece, id, centreOf(plan, z(s.base)), S(k.slabOf(plan, z(s.base), sti - s.base, P, 2), { tone: "lo" }) + roots, [slabShape(plan, z(s.base), sti - s.base)], { name: `${tag}.sti` });
    }

    // gate: oxide, metal, cap, with the cut section drawn on the source half's face at x = 0
    const gy0 = Y - HW + 4;
    const gy1 = Y + HW - 4;
    const gate = box(...xs(0, s.g), gy0, gy1);
    let gateBottom = sti;
    if (id === "planar") {
      // drawn thicker than the real ~1 nm high-k film (illustrative) so the one-sided grip reads at 1x
      const ox = box(...xs(0, s.g), Y - 32, Y + 32);
      const oxCut = side < 0 ? mat("tr-oxb", pathYZ(X, rrect(Y - 32, Y + 32, z(s.base), z(s.base + PLANAR_OX))), "hi", "gox") : "";
      put(piece, id, centreOf(ox, z(s.base)), S(k.slabOf(ox, z(s.base), PLANAR_OX, P, 2), { tone: "hi", crease: "none" }) + oxCut, [slabShape(ox, z(s.base), PLANAR_OX)], { name: `${tag}.oxide` });
      gateBottom = s.base + PLANAR_OX;
    }
    let cut = "";
    if (side < 0) {
      const ox = 1.6;
      if (id === "finfet") {
        for (const yc of [-30, 30]) {
          cut += L(pathYZ(X, finPts(Y + yc, z(sti), z(s.finTop), 9.4, 6, 3, ox + 2.2)), { tone: "faint" });
          cut += mat("tr-ox", pathYZ(X, finPts(Y + yc, z(sti), z(s.finTop), 9.4, 6, 3, ox)), "lo", "gox");
          cut += mat("tr-si", pathYZ(X, finPts(Y + yc, z(sti), z(s.finTop), 9.4, 6, 3)), "hi", "channel");
        }
      } else if (s.sheets) {
        const stacks = id === "gaa" ? [[-22, 13], [22, 13]] : [[0, 14]];
        for (const [yc, hw] of stacks) {
          cut += mat("tr-ox", pathYZ(X, rrect(Y + yc - hw, Y + yc + hw, z(sti), z(sti + ox))), "lo", "gox");
          if (s.mdi) cut += mat("tr-iso", pathYZ(X, rrect(Y + yc - hw - 2, Y + yc + hw + 2, z(s.mdi[0]), z(s.mdi[1]), 1)), "lo", "mdi");
          for (const z0 of s.sheets) {
            cut += L(pathYZ(X, rrect(Y + yc - hw - ox - 1.6, Y + yc + hw + ox + 1.6, z(z0 - ox - 1.6), z(z0 + s.sheetH + ox + 1.6), 3.4)), { tone: "faint" });
            cut += mat("tr-ox", pathYZ(X, rrect(Y + yc - hw - ox, Y + yc + hw + ox, z(z0 - ox), z(z0 + s.sheetH + ox), 2.4)), "lo", "gox");
            // CFET: the p-type sheets (under the middle dielectric) get their own lighter tone, the n-type sheets the plain one
            const [cls, sub] = s.mdi ? (z0 < s.mdi[0] ? ["tr-sip", "channelP"] : ["tr-sin", "channelN"]) : ["tr-si", "channel"];
            cut += mat(cls, pathYZ(X, rrect(Y + yc - hw, Y + yc + hw, z(z0), z(z0 + s.sheetH), 1.6)), "hi", sub);
          }
        }
      }
    }
    const gateSeams = L([gateBottom + 3, s.gateTop - 4].map((h) => k.sideSeam(gate, z(h), P, 2)).join(""), { tone: "faint" });
    put(piece, id, centreOf(gate, z(gateBottom)), S(k.slabOf(gate, z(gateBottom), s.gateTop - gateBottom, P, 2, 0.3), { tone: "mid", inner: gateSeams }) + cut, [slabShape(gate, z(gateBottom), s.gateTop - gateBottom)], { name: `${tag}.gate` });
    if (s.cap) put(piece, id, centreOf(gate, z(s.gateTop)), S(k.slabOf(gate, z(s.gateTop), s.cap, P, 2), { tone: "lo" }), [slabShape(gate, z(s.gateTop), s.cap)], { name: `${tag}.cap` });

    // spacer beside the gate
    const sp = box(...xs(s.g, s.g + s.sp), gy0, gy1);
    const spFrom = id === "planar" ? s.base : sti;
    put(piece, id, centreOf(sp, z(spFrom)), S(k.slabOf(sp, z(spFrom), capTop - spFrom, P, 2), { tone: "lo" }), [slabShape(sp, z(spFrom), capTop - spFrom)], { name: `${tag}.spacer` });

    // source / drain epitaxy
    const ex = xs(s.g + s.sp, s.half);
    let epiTop;
    if (id === "planar") {
      const epi = box(...ex, Y - 30, Y + 30);
      epiTop = s.base + 5;
      put(piece, id, centreOf(epi, z(s.base)), S(k.slabOf(epi, z(s.base), 5, P, 2, 0.3), { tone: "hi", crease: "lo" }), [slabShape(epi, z(s.base), 5)], { name: `${tag}.epi` });
    } else if (id === "finfet") {
      epiTop = 58;
      const poly = [[-4, z(sti)], [4, z(sti)], [11, z(40)], [4, z(epiTop)], [-4, z(epiTop)], [-11, z(40)]];
      for (const yc of [-30, 30]) {
        const F = G.frameOf([Math.min(...ex), Y + yc, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
        const len = Math.abs(ex[1] - ex[0]);
        const core = side > 0 ? mat("tr-si", pathYZ(face, finPts(Y + yc, z(sti), z(46), 9.4, 7, 3)), "mid", "core") : "";
        put(piece, id, [Math.min(...ex) + len / 2, Y + yc, z(40)], S(G.prismOf(F, poly, 0, len, P), { tone: "hi", crease: "lo" }) + core, [A.prism(F, poly, 0, len)], { name: `${tag}.epi${yc < 0 ? "L" : "R"}` });
      }
    } else if (id === "gaa") {
      epiTop = 60;
      for (const yc of [-22, 22]) {
        const epi = box(...ex, Y + yc - 15, Y + yc + 15, 1.5);
        put(piece, id, centreOf(epi, z(sti)), S(k.slabOf(epi, z(sti), epiTop - sti, P, 3, 0.4), { tone: "hi", crease: "lo" }) + L(k.planOutline(k.insetPlan(epi, 3), z(epiTop), P, 3), { tone: "faint" }), [slabShape(epi, z(sti), epiTop - sti, 3)], { name: `${tag}.epi${yc < 0 ? "L" : "R"}` });
      }
    } else {
      const pe = box(...ex, Y - 17, Y + 17, 1.5);
      put(piece, id, centreOf(pe, z(sti)), `<g class="tr-ptype">${S(k.slabOf(pe, z(sti), 58 - sti, P, 3, 0.4), { tone: "hi", crease: "lo" })}</g>`, [slabShape(pe, z(sti), 58 - sti, 3)], { name: `${tag}.epiP` });
      const iso = box(...ex, Y - 17, Y + 17, 1.5);
      put(piece, id, centreOf(iso, z(58)), S(k.slabOf(iso, z(58), 10, P, 3), { tone: "lo" }), [slabShape(iso, z(58), 10, 3)], { name: `${tag}.isolation` });
      const ne = box(...ex, Y - 17, Y + 17, 1.5);
      epiTop = 104;
      put(piece, id, centreOf(ne, z(68)), S(k.slabOf(ne, z(68), epiTop - 68, P, 3, 0.4), { tone: "hi", crease: "lo" }), [slabShape(ne, z(68), epiTop - 68, 3)], { name: `${tag}.epiN` });
    }

    // trench contact on the source/drain, with its landing pad
    const cx0 = Math.max(s.g + s.sp + 3, s.half - 16);
    const cw = id === "cfet" ? 13 : id === "planar" ? 22 : 36;
    const ct = box(...xs(cx0, s.half), Y - cw, Y + cw, 0.6);
    const pad = box(...xs(cx0 + 1, s.half), Y - cw + 1, Y + cw - 1, 0.6);
    const ctSvg = S(k.slabOf(ct, z(epiTop), s.ct - epiTop, P, 2, 0.3), { tone: "hi", crease: "lo", inner: L(k.sideSeam(ct, z(epiTop + 3), P, 2), { tone: "faint" }) }) + S(k.slabOf(pad, z(s.ct), 3, P, 2, 0.3), { tone: "mid" });
    put(piece, id, centreOf(ct, z(epiTop)), ctSvg, [slabShape(ct, z(epiTop), s.ct - epiTop), slabShape(pad, z(s.ct), 3)], { name: `${tag}.contact` });

    // gate contact on the source half, over the isolation
    if (side < 0) {
      const r = Math.min(3.2, s.g / 2 - 0.4);
      const gx = X - s.g / 2;
      const gy = Y - HW + 10;
      const svg = S(k.cylinder(gx, gy, r, z(capTop), s.ct - capTop, P, 20), { tone: "hi", crease: "lo" }) + S(k.cylinder(gx, gy, r + 0.8, z(s.ct), 3, P, 20), { tone: "mid" });
      put(piece, id, [gx, gy, z(capTop)], svg, [A.cylinder(gx, gy, r, z(capTop), s.ct - capTop, {}), A.cylinder(gx, gy, r + 0.8, z(s.ct), 3, {})], { name: `${tag}.gatecontact` });
    }
  }
}

bench();
for (const id of IDS) {
  HOST = true;
  stage(id);
  HOST = false;
  specimen(id);
}

if (!process.argv.includes("--fast")) A.settle(R, P);
R.items.sort((a, b) => a.key - b.key);
// part key for the hover readout: "stand.finfet.src.gate" -> gate (source half), "planar.bearing#2" -> bearing
function roleOf(item) {
  if (!item.gen) return { role: "bench", half: "" };
  const bits = item.name.replace(/#\d+$/, "").split(".");
  const half = bits.includes("src") ? "source" : bits.includes("drn") ? "drain" : "";
  return { role: bits[bits.length - 1].replace(/^(epi|rail|stop)[LR]$/, "$1"), half };
}
const groups = R.items.map((item, index) => {
  const [mx, my, mz] = item.move;
  const { role, half } = roleOf(item);
  if (!(role in M.PART_TEXT)) throw new Error(`no part text for ${item.name}`);
  return `<g class="it" data-piece="${item.piece}"${item.gen ? ` data-gen="${item.gen}"` : ""}${item.host ? " data-host" : ""} data-k="${item.key.toFixed(2)}" data-m="${mx.toFixed(1)},${my.toFixed(1)},${mz.toFixed(1)}" data-i="${index}" data-role="${role}"${half ? ` data-half="${half}"` : ""}>${item.svg}</g>`;
});

const g = M.GENS;
const LABEL = `Four transistors as sectioning specimens on one bench, oldest at the back: a planar MOSFET, a FinFET with two fins, a gate-all-around nanosheet transistor with two stacks of three sheets, and a CFET with three n-type sheets stacked over three p-type sheets. Each specimen is one contacted gate pitch long, drawn to the same scale. Its drain half sits on a carriage that slides out along the channel to show the cut through the gate.`;
const svg = k.figureSvg({ width: W, height: H, label: LABEL, body: [`<g class="tr-layers">${groups.join("")}</g>`], className: "tr-svg" });

const unit = (vector) => {
  const o = at([0, 0, 0]);
  const p = at(vector);
  return [p[0] - o[0], p[1] - o[1]];
};
const DATA = {
  V: G.viewOf(P),
  EX: unit([1, 0, 0]),
  EY: unit([0, 1, 0]),
  EZ: unit([0, 0, 1]),
  gens: Object.fromEntries(g.map((gen) => [gen.id, { name: gen.name, short: gen.short, say: M.readoutOf(gen), sayShort: M.readoutShort(gen), grip: gen.grip, note: gen.note }])),
  parts: M.PART_TEXT,
  idleShort: M.IDLE_SHORT,
  order: IDS,
  centres: Object.fromEntries(IDS.map((id) => [id, at([SPEC[id].X + SLIDE / 2, SPEC[id].Y, Z0 + 40])[0] / W])),
  stagger: STAGGER,
  spring: SPRING,
  idle: M.IDLE,
  open: M.OPEN,
};

const PARTS = g.map((gen, index) => `<button type="button" class="tr-part" data-part="${gen.id}"><span class="tr-num">${String(index + 1).padStart(2, "0")}</span>${gen.short}</button>`).join("");
const corners = `<div class="iso-plate-corners" aria-hidden="true"><span class="iso-plate-corner" data-corner="fig">Fig 1</span><span class="iso-plate-corner" data-corner="title">Four gates, cut open</span><span class="iso-plate-corner" data-corner="readout" data-readout>${M.IDLE}</span></div>`;
const controls = `<div class="tr-controls"><span class="tr-hint">Hover a part · Space plays</span><span class="tr-live" aria-live="polite" data-live></span></div>`;
const stage2 = `<div class="tr-stage" tabindex="0" role="slider" aria-label="Four transistor generations on a sectioning bench. Hover, or use the arrow keys, to pick a generation; Space plays the sectioning; Escape closes every specimen again; the slider below cuts them open one by one." aria-valuemin="0" aria-valuemax="${g.length}" aria-valuenow="0" aria-valuetext="${M.IDLE}">${svg}</div>`;
const caption = `The same switch, four ways. A gate voltage turns the channel under the gate on or off; the more sides of the channel the gate touches, the better it can shut off leakage. Planar (${g[0].node}, ${g[0].year}): gate on one side of a flat channel, ${g[0].lgNm} nm long, on a high-k dielectric. FinFET (${g[1].node}, ${g[1].year}): the channel is a fin ${g[1].finWidthNm} nm wide and ${g[1].finHeightNm} nm tall, gated on three sides. Nanosheet (${g[2].node}, ${g[2].year}; Samsung was first in ${M.SAMSUNG_GAA}): stacked sheets with the gate all around each. CFET (lab demos since ${M.CFET_FIRST}, a ${g[3].cppNm} nm gate-pitch version in ${g[3].year}; roadmap about ${M.ROADMAP_CFET}): the n-type stack sits on the p-type stack, under one gate, so the pair takes the footprint of one, with power and some contacts from the back side. Specimen lengths are one contacted gate pitch (${g.map((gen) => gen.cppNm).join(", ")} nm) on the ruler's 10 nm ticks; heights, widths, sheet counts and all but the planar gate length are illustrative. Densities: ${g[0].density} and ${g[1].density} MTr/mm² are Intel's figures, ${g[2].density} is an analyst estimate for dense cells, so compare only orders of magnitude.`;
const scrub = `<span class="tr-scrub"><button type="button" class="tr-play" data-play aria-label="Play the sectioning"><span class="tr-play-icon" aria-hidden="true"></span><span data-play-text>Cut open</span></button><input type="range" class="tr-range" data-scrub min="0" max="1000" step="1" value="0" aria-label="Sectioning: 0 is every specimen closed, 1000 is all four cut open"><span class="tr-step" data-step>closed</span></span>`;
const body = `<figure class="iso-figure tr"><div class="iso-plate">${corners}${stage2}${controls}</div><figcaption class="iso-legend">${scrub}<span class="tr-parts">${PARTS}</span><span class="iso-caption">${caption}</span></figcaption></figure>`;

const CSS = readFileSync(join(HERE, "transistor-evolution.css"), "utf8");
const LIVE = readFileSync(join(HERE, "live.js"), "utf8").replace("__DATA__", JSON.stringify(DATA));
const out = writeChapter({ slug: "transistor-evolution", figure: body, css: CSS, script: LIVE, lesson: LESSON });
console.log("wrote", out.file, `${out.kb} KB`, `${R.items.length} items`, `${R.solids.length} solids`);

A.auditOrExit(R, P);
