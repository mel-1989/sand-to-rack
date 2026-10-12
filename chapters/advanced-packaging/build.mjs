// Rubin GPU package on a test socket, taken apart layer by layer.
// node build.mjs [--light] [--audit]
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as M from "./model.mjs";

import { k, G, A } from "../../site/kit.mjs";
import { writeChapter } from "../../site/shell.mjs";
import { LESSON } from "./lesson.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const U = M.UNIT;

// ---- world layout (x, y on the floor, z up; plan in units of 0.5 mm) ----
const W = 640;
const H = 720;
const AZIMUTH = 45;
const ELEVATION = 32;

const PLATE = { x: -176, y: -166, w: 352, d: 332, r: 10 };
const PLATE_H = 12;
const FOOT_H = 6;
const SOCKET = { x: -114, y: -108, w: 228, d: 216, r: 6 };
const SOCKET_TOP = 9;
const PILLARS = [
  [-132, -124],
  [132, -124],
  [-132, 124],
  [132, 124],
];
const PILLAR_TOP = 36;

// the package, in z order
const BALL_TOP = 10.6;
const SUB = { x: -92, y: -88, w: 184, d: 176, r: 3 };
const SUB_TOP = 15.6;
const STIFF = { x: -89, y: -85, w: 178, d: 170, r: 2.5 };
const STIFF_W = 9;
const STIFF_TOP = 21;
const INT = { x: -58, y: -64, w: 116, d: 128, r: 1 };
const INT_Z = 16.6;
const INT_TOP = 19;
const CHIP_Z = 19.8;
const CHIP_TOP = 29.8;
const DIE = [-1, 1].map((side) => ({ x: side < 0 ? -2 - M.RETICLE_MM[0] * U : 2, y: (-M.RETICLE_MM[1] * U) / 2, w: M.RETICLE_MM[0] * U, d: M.RETICLE_MM[1] * U, r: 0.6 }));
const HBM_W = M.HBM.footprintMm[0] * U;
const HBM_D = M.HBM.footprintMm[1] * U;
const HBM_X = [-52, -26, 4, 30];
const HBM_Y = [-35 - HBM_D, 35];
const HBMS = HBM_Y.flatMap((y) => HBM_X.map((x) => ({ x, y, w: HBM_W, d: HBM_D, r: 0.6 })));
const TIM_TOP = 30.4;
const PEDESTAL = { x: -56, y: -62, w: 112, d: 124, r: 2 };
const FLANGE = { x: -146, y: -138, w: 292, d: 276, r: 14 };
const FLANGE_Z = PILLAR_TOP;
const FLANGE_TOP = 42;
const BODY = { x: -96, y: -92, w: 192, d: 184, r: 8 };
const BODY_TOP = 58;
const RIB = { x: -72, y: -48, w: 18, d: 96, r: 3 };
const RIB_TOP = 61;
const FITTINGS = [
  [-63, -30],
  [-63, 30],
];

const PIECES = {
  cold: { ...M.PIECES.cold, move: [-120, -120, 200] },
  dies: { ...M.PIECES.dies, move: [0, 0, 120] },
  hbm: { ...M.PIECES.hbm, move: [0, 0, 100] },
  interposer: { ...M.PIECES.interposer, move: [0, 0, 50] },
  substrate: { ...M.PIECES.substrate, move: [0, 0, 20] },
  stand: { ...M.PIECES.stand, move: [0, 0, 0] },
};
const HBM_OUT = 34; // the stacks pull away from the dies' edges as they lift
const STAGGER = ["cold", "dies", "hbm", "interposer", "substrate", "stand"];
const SPRING = { stagger: 0.05, stiffness: 64, damping: 14.2, substeps: 4 };
const ORDER = ["cold", "dies", "hbm", "interposer", "substrate"];
const shifted = (plan, [dx, dy]) => ({ ...plan, x: plan.x + dx, y: plan.y + dy });

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), ...k.boxCorners(shifted(FLANGE, PIECES.cold.move), FLANGE_Z + PIECES.cold.move[2], 80 + PIECES.cold.move[2]), ...k.boxCorners(DIE[0], 0, CHIP_TOP + PIECES.dies.move[2])],
  W,
  H,
  { pad: 28, azimuth: AZIMUTH, elevation: ELEVATION },
);
const V = G.viewOf(P);
const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);
const centreOf = (plan, z) => [plan.x + plan.w / 2, plan.y + plan.d / 2, z];

const R = A.recorder(P, { order: STAGGER, spring: SPRING });
function put(piece, ref, svg, shapes, { bias = 0, name, move } = {}) {
  const id = name ?? R.nameFor(`${piece}.item`);
  shapes.forEach((shape) => (shape.name = shape.name ?? id));
  R.put({ piece, at: ref, bias, svg, move: move ?? PIECES[piece].move, shapes: shapes.map(R.solid), name: id });
}
const slabShape = (plan, z, h, steps = 4) => A.slab(plan, z, h, {}, steps);
const cylShape = (x, y, r, z, h) => A.cylinder(x, y, r, z, h, {});

// ---- stand: base plate, socket, guide pillars ----
function stand() {
  const out = [];
  out.push(`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`);
  const feet = k.corners(PLATE, 26);
  const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
  const back = [];
  const baseShapes = [];
  for (const [x, y] of byDepth(feet)) {
    back.push(S(k.cylinder(x, y, 8, -PLATE_H - FOOT_H, 1.8, P, 28), { tone: "lo" }));
    back.push(S(k.cylinder(x, y, 6.2, -PLATE_H - FOOT_H + 1.8, FOOT_H - 1.8, P, 28), { tone: "mid" }));
    baseShapes.push(A.cylinder(x, y, 8, -PLATE_H - FOOT_H, FOOT_H, { name: "stand.foot" }));
  }
  back.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid", inner: L(k.sideSeam(PLATE, -PLATE_H + 3, P, 8), { tone: "faint" }) }));
  baseShapes.push(A.slab(PLATE, -PLATE_H, PLATE_H, { name: "stand.plate" }));
  back.push(L(k.planOutline(k.insetPlan(PLATE, 6), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 12);
  back.push(L(screws.map(([x, y]) => k.ring(x, y, 2.4, 0, P, 16)).join(""), { tone: "lo" }));
  back.push(Dots(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // ruler strip along the near (+y) edge, ticks every 2 mm, majors every 10 mm
  const strip = { x: -150, y: PLATE.y + PLATE.d - 18, w: 200, d: 8, r: 1 };
  back.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 2 * U, 5, strip.y + 0.8, 0.6, [2.2, 4], P);
  back.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  back.push(Dots([at([strip.x + 2, strip.y + 4, 0.6]), at([strip.x + strip.w - 2, strip.y + 4, 0.6])], { size: 0.45 }));
  // label plate beside the ruler
  const label = { x: 70, y: PLATE.y + PLATE.d - 26, w: 74, d: 16, r: 1.5 };
  back.push(S(k.slabOf(label, 0, 0.8, P, 4), { tone: "lo", crease: "none" }));
  back.push(L(k.planOutline(k.insetPlan(label, 1.8), 0.8, P, 4), { tone: "faint" }));
  back.push(L([0, 1, 2].map((i) => k.lineOnTop([label.x + 8, label.y + 5 + i * 3], [label.x + 56 - i * 14, label.y + 5 + i * 3], 0.8, P)).join(""), { tone: "lo", free: true }));
  back.push(Dots([at([label.x + 4, label.y + label.d / 2, 0.8]), at([label.x + label.w - 4, label.y + label.d / 2, 0.8])], { size: 0.45 }));
  // socket body: frame, pocket groove, pogo field, alignment pins, screws
  back.push(S(k.slabOf(SOCKET, 0, SOCKET_TOP, P, 6, 0.8), { tone: "mid", inner: L(k.sideSeam(SOCKET, 3, P, 6), { tone: "faint" }) }));
  baseShapes.push(A.slab(SOCKET, 0, SOCKET_TOP, { name: "stand.socket" }, 6));
  const pocket = k.insetPlan(SUB, -2.5);
  back.push(L(k.planOutline(pocket, SOCKET_TOP, P, 4), { tone: "lo" }));
  const pogo = [];
  for (let x = SUB.x + 6; x <= SUB.x + SUB.w - 6; x += 8) for (let y = SUB.y + 6; y <= SUB.y + SUB.d - 6; y += 8) pogo.push(at([x, y, SOCKET_TOP]));
  back.push(Dots(pogo, { size: 0.32, tone: "lo" }));
  const sockScrews = k.corners(SOCKET, 6);
  back.push(L(sockScrews.map(([x, y]) => k.ring(x, y, 2, SOCKET_TOP, P, 16)).join(""), { tone: "lo" }));
  back.push(Dots(sockScrews.map(([x, y]) => at([x, y, SOCKET_TOP])), { size: 0.45 }));
  const backSvg = back.join("");
  put("stand", [0, 0, -1], backSvg, baseShapes, { name: "stand.base", bias: -400 });

  for (const [x, y] of [[-102, 72], [102, -72]]) {
    const svg = S(k.cylinder(x, y, 2.6, SOCKET_TOP, 4, P, 20), { tone: "mid" }) + S(k.cylinder(x, y, 1.8, SOCKET_TOP + 4, 1.2, P, 16), { tone: "mid" });
    put("stand", [x, y, SOCKET_TOP + 2], svg, [cylShape(x, y, 2.6, SOCKET_TOP, 5.2)], { name: R.nameFor("stand.pin") });
  }
  // carry handles at both ends of the plate
  for (const hx of [PLATE.x + 14, PLATE.x + PLATE.w - 14]) {
    const posts = [-38, 38].map((dy) => [hx, dy]);
    const bar = { x: hx - 4, y: -44, w: 8, d: 88, r: 3.5 };
    let svg = "";
    const shapes = [];
    for (const [x, y] of [...posts].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P))) {
      svg += S(k.cylinder(x, y, 5.5, 0, 1.4, P, 28), { tone: "mid" }) + S(k.cylinder(x, y, 3.4, 1.4, 14.6, P, 24), { tone: "mid", crease: "none" });
      shapes.push(cylShape(x, y, 5.5, 0, 1.4), cylShape(x, y, 3.4, 1.4, 14.6));
    }
    svg += S(k.slabOf(bar, 16, 6, P, 4, 0.6), { tone: "mid", inner: L(k.sideSeam(bar, 19, P, 4), { tone: "faint" }) });
    svg += Dots(posts.map(([x, y]) => at([x, y, 22])), { size: 0.5 });
    shapes.push(slabShape(bar, 16, 6, 4));
    put("stand", [hx, 0, 10], svg, shapes, { name: R.nameFor("stand.handle") });
  }
  // guide pillars with collars and shoulders; the cold plate's flange rests on them
  for (const [x, y] of PILLARS) {
    const svg =
      S(k.cylinder(x, y, 11, 0, 3, P, 40), { tone: "mid" }) +
      S(k.cylinder(x, y, 7, 3, PILLAR_TOP - 6, P, 36), { tone: "mid", crease: "none", inner: L([12, 22].map((z) => k.sideArc(x, y, 7, z, P, 20)).join(""), { tone: "faint" }) }) +
      S(k.cylinder(x, y, 9, PILLAR_TOP - 3, 3, P, 36, 0.4), { tone: "mid" }) +
      L(k.ring(x, y, 3.2, PILLAR_TOP, P, 20), { tone: "lo" });
    put("stand", [x, y, PILLAR_TOP / 2], svg, [cylShape(x, y, 11, 0, 3), cylShape(x, y, 7, 3, PILLAR_TOP - 6), cylShape(x, y, 9, PILLAR_TOP - 3, 3)], { name: R.nameFor("stand.pillar") });
  }
}

// ---- substrate: BGA balls, build-up layers, stiffener, capacitors ----
function substrate() {
  const balls = [];
  const ballZ = (SOCKET_TOP + BALL_TOP) / 2;
  const ballR = 0.75;
  for (let y = SUB.y + 2; y <= SUB.y + SUB.d - 2 + 1e-6; y += U) balls.push([SUB.x + SUB.w - 2, y]);
  for (let x = SUB.x + 2; x < SUB.x + SUB.w - 2 - 1e-6; x += U) balls.push([x, SUB.y + SUB.d - 2]);
  const ballSvg = balls.map(([x, y]) => S(G.sphereOf([x, y, ballZ], ballR, P, { steps: 12 }), { tone: "mid", crease: "none" })).join("");
  const layers = L([SUB_TOP - 1.4, SUB_TOP - 3.6].map((z) => k.sideSeam(SUB, z, P, 4)).join(""), { tone: "faint" });
  const slab = S(k.slabOf(SUB, BALL_TOP, SUB_TOP - BALL_TOP, P, 4, 0.6), { tone: "mid", inner: layers });
  const fid = [[SUB.x + 7, SUB.y + 7], [SUB.x + SUB.w - 7, SUB.y + SUB.d - 7]];
  const marks = L(fid.map(([x, y]) => k.ring(x, y, 1.6, SUB_TOP, P, 16)).join(""), { tone: "lo" }) + Dots(fid.map(([x, y]) => at([x, y, SUB_TOP])), { size: 0.5, tone: "mid" });
  put("substrate", centreOf(SUB, BALL_TOP), ballSvg + slab + marks, [A.slab(k.insetPlan(SUB, 1.2), SOCKET_TOP, BALL_TOP - SOCKET_TOP, {}, 4), slabShape(SUB, BALL_TOP, SUB_TOP - BALL_TOP)], { name: "substrate.body" });

  // stiffener ring as four bars, so each can sort against what it surrounds
  const bars = [
    { x: STIFF.x, y: STIFF.y, w: STIFF_W, d: STIFF.d, r: 1.2 },
    { x: STIFF.x + STIFF.w - STIFF_W, y: STIFF.y, w: STIFF_W, d: STIFF.d, r: 1.2 },
    { x: STIFF.x + STIFF_W, y: STIFF.y, w: STIFF.w - 2 * STIFF_W, d: STIFF_W, r: 0.2 },
    { x: STIFF.x + STIFF_W, y: STIFF.y + STIFF.d - STIFF_W, w: STIFF.w - 2 * STIFF_W, d: STIFF_W, r: 0.2 },
  ];
  bars.forEach((bar, index) => {
    let extra = "";
    if (index === 1) {
      // laser-marked 2D code on the near bar
      const code = [];
      const cx = bar.x + 1.4;
      const cy = 40;
      for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) if ((i * 7 + j * 3 + i * j) % 3 !== 0 || i === 0 || j === 0) code.push(at([cx + i * 1.1, cy + j * 1.1, STIFF_TOP]));
      extra += Dots(code, { size: 0.32, tone: "lo" });
      extra += L(k.planOutline({ x: cx - 1, y: cy - 1, w: 7.6, d: 7.6, r: 0.3 }, STIFF_TOP, P, 2), { tone: "faint" });
    }
    const screwAt = index < 2 ? [[bar.x + STIFF_W / 2, bar.y + 6], [bar.x + STIFF_W / 2, bar.y + bar.d - 6]] : [];
    extra += Dots(screwAt.map(([x, y]) => at([x, y, STIFF_TOP])), { size: 0.45 });
    put("substrate", centreOf(bar, SUB_TOP), S(k.slabOf(bar, SUB_TOP, STIFF_TOP - SUB_TOP, P, 3, 0.4), { tone: "mid" }) + extra, [slabShape(bar, SUB_TOP, STIFF_TOP - SUB_TOP, 3)], { name: `substrate.stiffener${index}` });
  });

  // decoupling capacitors in the moat between interposer and stiffener
  const caps = [];
  for (const x of [INT.x - 12, INT.x + INT.w + 8]) for (let y = -56; y <= 56; y += 10) caps.push({ x, y: y - 0.8, w: 3.2, d: 1.6, r: 0.2 });
  for (const y of [INT.y - 8, INT.y + INT.d + 6]) for (let x = -50; x <= 50; x += 10) caps.push({ x: x - 0.8, y, w: 1.6, d: 3.2, r: 0.2 });
  const groups = new Map();
  for (const cap of caps) {
    const side = cap.x < INT.x ? "w" : cap.x > INT.x + INT.w ? "e" : cap.y < INT.y ? "n" : "s";
    if (!groups.has(side)) groups.set(side, []);
    groups.get(side).push(cap);
  }
  for (const [side, list] of groups) {
    const sorted = [...list].sort((a, b) => k.depthOf(centreOf(a, SUB_TOP), P) - k.depthOf(centreOf(b, SUB_TOP), P));
    const svg = sorted.map((cap) => S(k.slabOf(cap, SUB_TOP, 1.4, P, 2), { tone: "hi", crease: "lo" }) + L(k.lineOnTop([cap.x + (cap.w > cap.d ? 0.8 : 0), cap.y + (cap.w > cap.d ? 0 : 0.8)], [cap.x + (cap.w > cap.d ? 0.8 : cap.w), cap.y + (cap.w > cap.d ? cap.d : 0.8)], SUB_TOP + 1.4, P), { tone: "faint" })).join("");
    const xs = list.map((c) => [c.x, c.x + c.w]).flat();
    const ys = list.map((c) => [c.y, c.y + c.d]).flat();
    const bounds = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), d: Math.max(...ys) - Math.min(...ys), r: 0 };
    put("substrate", centreOf(bounds, SUB_TOP), svg, list.map((cap) => slabShape(cap, SUB_TOP, 1.4, 2)), { name: `substrate.caps-${side}` });
  }
}

// ---- interposer: underfill, silicon bridges, seal ring ----
function interposer() {
  const fillet = k.insetPlan(INT, -1.4);
  const under = S(k.slabOf(fillet, SUB_TOP, INT_Z - SUB_TOP, P, 4), { tone: "lo", crease: "none" });
  const body = S(k.slabOf(INT, INT_Z, INT_TOP - INT_Z, P, 3, 0.4), { tone: "mid" });
  const seal = L(k.planOutline(k.insetPlan(INT, 1.6), INT_TOP, P, 3), { tone: "faint" });
  // LSI bridges: under every die-to-HBM edge and across the die-to-die seam
  const bridges = HBMS.map((h) => ({ x: h.x + 4, y: h.y < 0 ? -37 : 31, w: h.w - 8, d: 6, r: 0.4 }));
  bridges.push({ x: -5, y: -24, w: 10, d: 48, r: 0.4 });
  const lsi = L(bridges.map((b) => k.planOutline(b, INT_TOP, P, 2)).join(""), { tone: "lo" });
  const lsiDots = Dots(bridges.flatMap((b) => {
    const pts = [];
    const along = b.w > b.d;
    const n = Math.floor((along ? b.w : b.d) / 2.2);
    for (let i = 1; i < n; i++) for (const off of [0.32, 0.68]) pts.push(at(along ? [b.x + (i * b.w) / n, b.y + b.d * off, INT_TOP] : [b.x + b.w * off, b.y + (i * b.d) / n, INT_TOP]));
    return pts;
  }), { size: 0.26, tone: "lo" });
  put("interposer", centreOf(INT, INT_Z), under + body + seal + lsi + lsiDots, [slabShape(fillet, SUB_TOP, INT_Z - SUB_TOP), slabShape(INT, INT_Z, INT_TOP - INT_Z, 3)], { name: "interposer.body" });
}

// ---- HBM4: a base logic die and twelve DRAM dies, ground to the compute dies' height ----
function hbm() {
  HBMS.forEach((plan, index) => {
    const fill = k.insetPlan(plan, -0.6);
    const under = S(k.slabOf(fill, INT_TOP, CHIP_Z - INT_TOP, P, 2), { tone: "lo", crease: "none" });
    const baseTop = CHIP_Z + 1.4;
    const step = 0.65;
    const seams = [L(k.sideSeam(plan, baseTop, P, 2), { tone: "lo" })];
    const core = [];
    for (let i = 1; i <= M.HBM.high; i++) core.push(k.sideSeam(plan, baseTop + i * step, P, 2));
    seams.push(L(core.join(""), { tone: "faint" }));
    const body = S(k.slabOf(plan, CHIP_Z, CHIP_TOP - CHIP_Z, P, 2, 0.4), { tone: "hi", crease: "lo", inner: seams.join("") });
    const top = L(k.planOutline(k.insetPlan(plan, 1.6), CHIP_TOP, P, 2), { tone: "faint" });
    const pin1 = Dots([at([plan.x + 3.4, plan.y + 3.4, CHIP_TOP])], { size: 0.5, tone: "mid" });
    put("hbm", centreOf(plan, CHIP_Z), under + body + top + pin1, [slabShape(fill, INT_TOP, CHIP_Z - INT_TOP, 2), slabShape(plan, CHIP_Z, CHIP_TOP - CHIP_Z, 2)], { name: `hbm.stack${index}`, move: [0, plan.y < 0 ? -HBM_OUT : HBM_OUT, PIECES.hbm.move[2]] });
  });
}

// ---- compute dies: seal ring, floorplan, NV-HBI bump field, HBM PHYs ----
function dies() {
  DIE.forEach((plan, index) => {
    const fill = k.insetPlan(plan, -0.6);
    const under = S(k.slabOf(fill, INT_TOP, CHIP_Z - INT_TOP, P, 2), { tone: "lo", crease: "none" });
    const body = S(k.slabOf(plan, CHIP_Z, CHIP_TOP - CHIP_Z, P, 2, 0.5), { tone: "hi", crease: "lo", inner: L(k.sideSeam(plan, CHIP_Z + 1.2, P, 2), { tone: "faint" }) });
    const seal = k.insetPlan(plan, 1.4);
    const inner = { x: seal.x + 1.2, y: seal.y + 7, w: seal.w - 2.4, d: seal.d - 14, r: 0.2 };
    const lines = [k.planOutline(seal, CHIP_TOP, P, 2)];
    // core floorplan: 4 x 6 compute clusters between the two PHY bands
    const hbi = index === 0 ? inner.x + inner.w - 6 : inner.x + 6;
    const coreFrom = index === 0 ? inner.x : hbi;
    const coreTo = index === 0 ? hbi : inner.x + inner.w;
    lines.push(k.planOutline(inner, CHIP_TOP, P, 2));
    lines.push(k.lineOnTop([hbi, inner.y], [hbi, inner.y + inner.d], CHIP_TOP, P));
    for (let i = 1; i < 4; i++) {
      const x = coreFrom + ((coreTo - coreFrom) * i) / 4;
      lines.push(k.lineOnTop([x, inner.y], [x, inner.y + inner.d], CHIP_TOP, P));
    }
    for (let j = 1; j < 6; j++) {
      const y = inner.y + (inner.d * j) / 6;
      lines.push(k.lineOnTop([coreFrom, y], [coreTo, y], CHIP_TOP, P));
    }
    const grid = L(lines.join(""), { tone: "lo" });
    // HBM PHY bands top and bottom, one per stack
    const phys = [];
    for (const h of HBMS.filter((h) => h.x >= plan.x && h.x + h.w <= plan.x + plan.w)) {
      const y = h.y < 0 ? seal.y + 1.2 : seal.y + seal.d - 5.8;
      phys.push(k.planOutline({ x: h.x + 2, y, w: h.w - 4, d: 4.6, r: 0.3 }, CHIP_TOP, P, 2));
    }
    const phy = L(phys.join(""), { tone: "faint" });
    const bumps = [];
    for (let y = inner.y + 2; y <= inner.y + inner.d - 2; y += 1.6) for (const dx of [1.5, 3, 4.5]) bumps.push(at([index === 0 ? hbi + dx : hbi - dx, y, CHIP_TOP]));
    const hbiDots = Dots(bumps, { size: 0.28, tone: "mid" });
    put("dies", centreOf(plan, CHIP_Z), under + body + grid + phy + hbiDots, [slabShape(fill, INT_TOP, CHIP_Z - INT_TOP, 2), slabShape(plan, CHIP_Z, CHIP_TOP - CHIP_Z, 2)], { name: `dies.die${index}` });
  });
}

// ---- cold plate: TIM, pedestal, flange on the pillars, manifold, quick disconnects, load screws ----
function cold() {
  const tim = S(k.slabOf(k.insetPlan(PEDESTAL, 1), CHIP_TOP, TIM_TOP - CHIP_TOP, P, 3), { tone: "lo", crease: "none" });
  const ped = S(k.slabOf(PEDESTAL, TIM_TOP, FLANGE_Z - TIM_TOP, P, 3, 0.4), { tone: "mid" });
  put("cold", centreOf(PEDESTAL, CHIP_TOP), tim + ped, [slabShape(k.insetPlan(PEDESTAL, 1), CHIP_TOP, TIM_TOP - CHIP_TOP, 3), slabShape(PEDESTAL, TIM_TOP, FLANGE_Z - TIM_TOP, 3)], { name: "cold.pedestal" });

  const flange = S(k.slabOf(FLANGE, FLANGE_Z, FLANGE_TOP - FLANGE_Z, P, 8, 0.8), { tone: "mid" });
  const groove = L(k.planOutline(k.insetPlan(FLANGE, 5), FLANGE_TOP, P, 8), { tone: "faint" });
  put("cold", centreOf(FLANGE, FLANGE_Z), flange + groove, [A.slab(FLANGE, FLANGE_Z, FLANGE_TOP - FLANGE_Z, {}, 8)], { name: "cold.flange" });

  const lid = L(k.sideSeam(BODY, 50, P, 8), { tone: "faint" });
  const body = S(k.slabOf(BODY, FLANGE_TOP, BODY_TOP - FLANGE_TOP, P, 8, 1.2), { tone: "mid", inner: lid });
  const lidGroove = L(k.planOutline(k.insetPlan(BODY, 7), BODY_TOP, P, 6), { tone: "lo" });
  const lidScrews = [];
  const ring = k.insetPlan(BODY, 3.6);
  for (let i = 0; i <= 6; i++) {
    const x = ring.x + 6 + ((ring.w - 12) * i) / 6;
    lidScrews.push([x, ring.y + 0.6], [x, ring.y + ring.d - 0.6]);
  }
  for (let j = 1; j < 6; j++) {
    const y = ring.y + 6 + ((ring.d - 12) * j) / 6;
    lidScrews.push([ring.x + 0.6, y], [ring.x + ring.w - 0.6, y]);
  }
  const screwSvg = L(lidScrews.map(([x, y]) => k.ring(x, y, 1.5, BODY_TOP, P, 12)).join(""), { tone: "lo" }) + Dots(lidScrews.map(([x, y]) => at([x, y, BODY_TOP])), { size: 0.4 });
  const name = k.faceTextSvg(k.topMatrix([40, 60], BODY_TOP, P, "x"), "RUBIN", { size: 3.2, tone: "lo", anchor: "middle" });
  put("cold", centreOf(BODY, FLANGE_TOP), body + lidGroove + screwSvg + name, [A.slab(BODY, FLANGE_TOP, BODY_TOP - FLANGE_TOP, {}, 8)], { name: "cold.body" });

  const rib = S(k.slabOf(RIB, BODY_TOP, RIB_TOP - BODY_TOP, P, 3, 0.4), { tone: "mid" });
  put("cold", centreOf(RIB, BODY_TOP), rib, [slabShape(RIB, BODY_TOP, RIB_TOP - BODY_TOP, 3)], { name: "cold.rib" });

  for (const [x, y] of FITTINGS) {
    const z0 = RIB_TOP;
    const svg =
      S(k.cylinder(x, y, 8.4, z0, 4.6, P, 6, 0.4), { tone: "mid" }) +
      S(k.cylinder(x, y, 5.4, z0 + 4.6, 2.4, P, 28), { tone: "mid" }) +
      S(k.cylinder(x, y, 7.4, z0 + 7, 8, P, 36, 0.4), { tone: "hi", crease: "lo" }) +
      L(k.knurl(x, y, 7.4, z0 + 8.2, z0 + 13.8, 40, P), { tone: "lo" }) +
      S(k.cylinder(x, y, 4.6, z0 + 15, 3.4, P, 28, 0.3), { tone: "mid" }) +
      L(k.ring(x, y, 2.4, z0 + 18.4, P, 20), { tone: "lo" }) +
      S(k.cylinder(x, y, 1.6, z0 + 18.4, 0.01, P, 16), { tone: "lo", crease: "none" });
    put("cold", [x, y, z0 + 9], svg, [cylShape(x, y, 8.4, z0, 4.6), cylShape(x, y, 5.4, z0 + 4.6, 2.4), cylShape(x, y, 7.4, z0 + 7, 8), cylShape(x, y, 4.6, z0 + 15, 3.4)], { name: R.nameFor("cold.qd") });
  }

  // spring-loaded retention screws over each pillar: a Belleville stack under each head
  for (const [x, y] of PILLARS) {
    let z = FLANGE_TOP;
    const parts = [S(k.cylinder(x, y, 9, z, 1, P, 36), { tone: "mid" })];
    const shapes = [cylShape(x, y, 9, z, 1)];
    z += 1;
    for (let i = 0; i < 4; i++) {
      const r = i % 2 ? 7.2 : 8;
      parts.push(S(k.cylinder(x, y, r, z, 1.2, P, 32), { tone: "mid" }));
      shapes.push(cylShape(x, y, r, z, 1.2));
      z += 1.2;
    }
    parts.push(S(k.cylinder(x, y, 6, z, 4.2, P, 32, 0.4), { tone: "hi", crease: "lo" }));
    shapes.push(cylShape(x, y, 6, z, 4.2));
    parts.push(L(k.knurl(x, y, 6, z + 0.6, z + 3.6, 28, P), { tone: "lo" }));
    parts.push(L(k.ring(x, y, 2.6, z + 4.2, P, 6), { tone: "mid" }));
    put("cold", [x, y, z], parts.join(""), shapes, { name: R.nameFor("cold.screw") });
  }
}

stand();
substrate();
interposer();
hbm();
dies();
cold();

if (!process.argv.includes("--fast")) A.settle(R, P);
R.items.sort((a, b) => a.key - b.key);
const groups = R.items.map((item, index) => {
  const [mx, my, mz] = item.move;
  return `<g class="it" data-piece="${item.piece}" data-k="${item.key.toFixed(2)}" data-m="${mx.toFixed(1)},${my.toFixed(1)},${mz.toFixed(1)}" data-i="${index}">${item.svg}</g>`;
});

const LABEL = `NVIDIA Rubin GPU package in a test socket, under its liquid cold plate. From the bottom: a base plate with a ruler, a socket with a pogo-pin field and four guide pillars; the organic substrate on its ball grid with a stiffener ring and capacitors; the CoWoS-L interposer with its silicon bridges; eight 12-high HBM4 stacks; two reticle-sized compute dies; and the cold plate with two quick-disconnect fittings and four spring-loaded screws.`;
const svg = k.figureSvg({ width: W, height: H, label: LABEL, body: [`<g class="ra-layers">${groups.join("")}</g>`], className: "ra-svg" });

const unit = (vector) => {
  const o = at([0, 0, 0]);
  const p = at(vector);
  return [p[0] - o[0], p[1] - o[1]];
};
const DATA = {
  V,
  EX: unit([1, 0, 0]),
  EY: unit([0, 1, 0]),
  EZ: unit([0, 0, 1]),
  pieces: Object.fromEntries(Object.entries(PIECES).map(([id, p]) => [id, { name: p.name, say: p.say }])),
  stagger: STAGGER,
  spring: SPRING,
  order: ORDER,
  idle: M.IDLE,
  closed: M.CLOSED,
};

const PARTS = ORDER.map((id, index) => `<button type="button" class="ra-part" data-part="${id}"><span class="ra-num">${String(index + 1).padStart(2, "0")}</span>${PIECES[id].name}</button>`).join("");
const corners = `<div class="iso-plate-corners" aria-hidden="true"><span class="iso-plate-corner" data-corner="fig">Fig 1</span><span class="iso-plate-corner" data-corner="title">Rubin · package anatomy</span><span class="iso-plate-corner" data-corner="readout" data-readout>${M.IDLE}</span></div>`;
const controls = `<div class="ra-controls"><span class="ra-hint">Hover a layer · Space assembles it</span><span class="ra-live" aria-live="polite" data-live></span></div>`;
const stage = `<div class="ra-stage" tabindex="0" role="slider" aria-label="Rubin GPU package. The layers rest lifted apart. Hover, or use the arrow keys, to pick a layer; Space assembles the package or lifts it apart again; Escape returns to the apart view; the Assemble slider below steps through the build." aria-valuemin="0" aria-valuemax="${ORDER.length}" aria-valuenow="0" aria-valuetext="Taken apart · ${M.IDLE}">${svg}</div>`;
const caption = `NVIDIA's Rubin GPU, the accelerator in Vera Rubin NVL72: ${M.GPU.dies} reticle-sized compute dies on ${M.GPU.node} (${M.GPU.transistorsB} billion transistors), joined by ${M.GPU.link}, beside ${M.HBM.stacks} ${M.HBM.high}-high ${M.HBM.gen} stacks of ${M.HBM.gbPerStack} GB (${M.total} GB, ${M.HBM.totalTBs} TB/s, so ${M.perStackTBs} TB/s a stack, or about ${M.pinGbps.toFixed(1)} Gb/s on each of its ${M.HBM.busBits.toLocaleString("en-US")} data pins). All ten sit on a ${M.GPU.packaging} interposer whose embedded silicon bridges carry the short, dense wires between them; the organic substrate below brings power in and sends NVLink 6 out at ${M.GPU.nvlinkTBs} TB/s. The HBM4 stacks may stand up to ${M.HBM.heightUm} µm tall (the JEDEC HBM4 limit), and the compute dies are set level with them so one cold plate presses on all ten (illustrative; NVIDIA publishes no die thickness). Die and HBM footprints match the ruler (2 mm ticks); heights are exaggerated and the substrate and layout are illustrative. NVFP4: ${M.GPU.nvfp4Dense} PF dense (training), ${M.GPU.nvfp4Inference} PF for inference with the Transformer Engine.`;
const scrub = `<span class="ra-scrub"><button type="button" class="ra-play" data-play aria-label="Play the assembly"><span class="ra-play-icon" aria-hidden="true"></span><span data-play-text>Assemble</span></button><input type="range" class="ra-range" data-scrub min="0" max="1000" step="1" value="0" aria-label="Assembly: 0 is taken apart, 1000 is fully assembled"><span class="ra-step" data-step>apart</span></span>`;
const body = `<figure class="iso-figure ra"><div class="iso-plate">${corners}${stage}${controls}</div><figcaption class="iso-legend">${scrub}<span class="ra-parts">${PARTS}</span><span class="iso-caption">${caption}</span></figcaption></figure>`;

const CSS = readFileSync(join(HERE, "rubin.css"), "utf8");
const LIVE = readFileSync(join(HERE, "live.js"), "utf8").replace("__DATA__", JSON.stringify(DATA));
const out = writeChapter({ slug: "advanced-packaging", figure: body, css: CSS, script: LIVE, lesson: LESSON });
console.log("wrote", out.file, `${out.kb} KB`, `${R.items.length} items`, `${R.solids.length} solids`);

A.auditOrExit(R, P);
