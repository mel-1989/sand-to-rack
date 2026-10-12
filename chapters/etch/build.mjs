// An inductively coupled plasma (ICP) etch chamber, cut in half on the plane y = 0 so the inside shows.
// node build.mjs [--fast] [--audit]
// World units are about 1 mm, x and y on the floor, z up. Everything the section removes (y > 0) is gone;
// parts wholly behind it (pump, match boxes, generator, gas box) are drawn whole. Geometry is illustrative.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as M from "./model.mjs";
import { k, G, A, Tube } from "../../site/kit.mjs";
import { writeChapter } from "../../site/shell.mjs";
import { LESSON } from "./lesson.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

const W = 640;
const H = 700;
const AZ = 58;
const EL = 32;
const SPLIT = ((AZ - 90) * Math.PI) / 180; // where a bore's inner face turns from facing the viewer to facing away

// ---- plan ----
const PLATE = { x: -350, y: -300, w: 700, d: 470, r: 14 };
const PLATE_H = 14;
const FOOT_H = 8;

const RO = 225; // chamber body half-width (rounded square outside)
const RC = 44; // its corner radius
const RB = 200; // bore
const Z_FLOOR = 250;
const Z_FLOOR_TOP = 272;
const Z_WALL_TOP = 484;
const WIN_R = 216;
const Z_WIN_TOP = 514;
const INJ = 16; // injector half-width
const Z_INJ = [470, 540];
const COIL = [[60, 70], [110, 120], [160, 170]];
const Z_COIL = [518, 530];
const LINER = [186, 192];
const Z_LINER_TOP = 466;
const STEM_R = 56;
const Z_BASE = [330, 364];
const BASE_R = 166;
const PUCK_R = 150;
const Z_PUCK_TOP = 374;
const Z_WAFER_TOP = 377;
const FOCUS = [151, 166];
const Z_FOCUS_TOP = 380;
const EDGE = [166, 178];
const Z_EDGE = [300, 372];
const BAFFLE = [178, 186];
const Z_BAFFLE = [300, 306];
const GLOW_R = 182;
const Z_GLOW = [382, 468];

const PUMP = [0, -120];
const POSTS = [[-195, -195], [195, -195]];
const MATCH = { x: -80, y: -222, w: 160, d: 92, r: 4 };
const Z_MATCH = [600, 662];
const COAX_Z = 704; // the source coax arches over and lands on the match's lid
const MATCH_LEGS = [[-70, -218.5], [70, -218.5]];
const COIL_POSTS = [-80, -100].map((deg) => [165 * Math.cos((deg * Math.PI) / 180), 165 * Math.sin((deg * Math.PI) / 180)]);
const GEN = { x: -330, y: -290, w: 94, d: 140, r: 4 };
const GEN_H = 130;
const GAS = { x: 236, y: -290, w: 90, d: 120, r: 4 };
const GAS_H = 118;
const SPEC = { x: 262, y: -122, w: 76, d: 84, r: 4 };
const SPEC_H = 44;
const BIAS = { x: -200, y: -100, w: 88, d: 70, r: 4 };
const BIAS_H = 80;
const VIEWPORT = [RO, -80, 410];

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), ...k.boxCorners({ x: -RO, y: -RO, w: 2 * RO, d: RO, r: 0 }, Z_FLOOR, Z_WIN_TOP), ...k.boxCorners(MATCH, Z_MATCH[0], Z_MATCH[1]), [GEN.x + 47, -176, COAX_Z + 6]],
  W,
  H,
  { pad: 26, azimuth: AZ, elevation: EL },
);
const V = G.viewOf(P);
const KS = G.scaleOf(P);
const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);
const path3 = (points, closed = false) => k.pathOf(points.map(at), closed);
const cut = (points, closed = true) => path3(points.map(([x, z]) => [x, 0, z]), closed);
// the section: a cut face on the plane y = 0, painted under the part's outline
const SEC = (points) => `<path class="et-cut" d="${cut(points)}"/>`;
const faceY = (y, x0, x1, z0, z1) => path3([[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]], true);
const faceX = (x, y0, y1, z0, z1) => path3([[x, y0, z0], [x, y1, z0], [x, y1, z1], [x, y0, z1]], true);
const secRect = (x0, x1, z0, z1) => SEC([[x0, z0], [x1, z0], [x1, z1], [x0, z1]]);
const centreOf = (plan, z) => [plan.x + plan.w / 2, plan.y + plan.d / 2, z];
const deg = (d) => (d * Math.PI) / 180;

const R = A.recorder(P);
function put(piece, ref, svg, shapes, { bias = 0, name } = {}) {
  const id = name ?? R.nameFor(`${piece}.item`);
  shapes.forEach((shape) => (shape.name = shape.name ?? id));
  return R.put({ piece, at: ref, bias, svg, move: [0, 0, 0], shapes: shapes.map(R.solid), name: id });
}

// ---- outlines on the floor ----
const arcPts = (r, a0, a1, step = deg(2)) => {
  const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) / step));
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / n;
    return [r * Math.cos(a), r * Math.sin(a)];
  });
};
// radius of the rounded square |x|,|y| <= RO with corner radius RC, along angle a
function squareRadius(a) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const inside = (x, y) => {
    if (Math.abs(x) > RO + 1e-9 || Math.abs(y) > RO + 1e-9) return false;
    const dx = Math.max(Math.abs(x) - (RO - RC), 0);
    const dy = Math.max(Math.abs(y) - (RO - RC), 0);
    return dx * dx + dy * dy <= RC * RC + 1e-9;
  };
  let lo = 0;
  let hi = RO * 1.5;
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2;
    if (inside(m * c, m * s)) lo = m;
    else hi = m;
  }
  return lo;
}
const squarePts = (a0, a1) => {
  const n = Math.ceil(Math.abs(a1 - a0) / deg(1));
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / n;
    const r = squareRadius(a);
    return [r * Math.cos(a), r * Math.sin(a)];
  });
};
// a piece of an annulus between angles a0 > a1 (both in [-PI, 0]); outer is a radius or "square"
function sector(rIn, rOut, a0, a1) {
  const outer = rOut === "square" ? squarePts(a0, a1) : arcPts(rOut, a0, a1);
  const inner = arcPts(rIn, a1, a0);
  return [...outer, ...inner];
}
const halfDisc = (r) => arcPts(r, 0, -Math.PI);
const halfSquare = () => squarePts(0, -Math.PI);

// a prism item: ring on the floor, from z up h
function prism(piece, name, ring, z, h, style = {}, { extra = "", inner = "", bias = 0, convex = true, bevel = 0, ref, sec = [] } = {}) {
  const paths = k.extrude(ring, z, h, P, { convex, bevel });
  inner = sec.map(([x0, x1]) => secRect(x0, x1, z, z + h)).join("") + inner;
  const cx = ring.reduce((a, p) => a + p[0], 0) / ring.length;
  const cy = ring.reduce((a, p) => a + p[1], 0) / ring.length;
  return put(piece, ref ?? [cx, cy, z + h / 2], S(paths, { tone: "mid", ...style, inner }) + extra, [A.extruded(ring, z, h, {})], { name, bias });
}
// an annulus cut in half, in two pieces so neither hides part of itself
function halfRing(piece, name, rIn, rOut, z, h, style = {}, { extraBack = "", extraFront = "", bevel = 0 } = {}) {
  prism(piece, `${name}.back`, sector(rIn, rOut, -Math.PI, SPLIT), z, h, style, { convex: false, extra: extraBack, bevel, sec: [[-rOut, -rIn]] });
  prism(piece, `${name}.front`, sector(rIn, rOut, SPLIT, 0), z, h, style, { convex: false, extra: extraFront, bevel, sec: [[rIn, rOut]] });
}
function box(piece, name, plan, z, h, style = {}, { extra = "", inner, steps = 3, bevel = 0.6, bias = 0 } = {}) {
  const seam = inner ?? "";
  return put(piece, centreOf(plan, z + h / 2), S(k.slabOf(plan, z, h, P, steps, bevel), { tone: "mid", ...style, inner: seam }) + extra, [A.slab(plan, z, h, {}, steps)], { name, bias });
}
function cyl(piece, name, x, y, r, z, h, style = {}, { extra = "", inner = "", steps = 32, bevel = 0.4, bias = 0 } = {}) {
  return put(piece, [x, y, z + h / 2], S(k.cylinder(x, y, r, z, h, P, steps, bevel), { tone: "mid", ...style, inner }) + extra, [A.cylinder(x, y, r, z, h, {})], { name, bias });
}
const screwsOnTop = (points, z, size = 0.5) => L(points.map(([x, y]) => k.ring(x, y, 2.6, z, P, 14)).join(""), { tone: "lo" }) + Dots(points.map(([x, y]) => at([x, y, z])), { size });

// ---- lines and cables (kit tube), each end on a fitting owned by the line ----
function line(piece, name, points, r, { tone = "mid", fit = r * 1.9, fitLen = Math.max(3, r * 2.2), bend = Math.max(6, r * 3), maxLength = 40 } = {}) {
  const route = G.fillet(points, bend, 10, { P, tube: r });
  const total = G.pathLength(route);
  const gaps = [[0, fitLen], [total - fitLen, total]];
  R.route(name, route, r, { gaps, rims: [fit, fit], piece, limp: r < 3 });
  Tube.tubePieces(route, r, P, { maxLength, spacing: Math.max(0.8, Math.min(2, r)), gaps }).forEach((pc, index) =>
    R.put({ piece, name: `${name}:${index}`, at: pc.mid, bias: 0.02, svg: Tube.tubeSvg(pc, { tone }), move: [0, 0, 0], shapes: [R.solid(A.tube(pc.points, pc.radii, { name: `${name}:${index}`, owner: name }))] }),
  );
  [0, 1].forEach((index) => {
    const end = index ? route[route.length - 1] : route[0];
    const tangent = G.tangentAlong(route, index ? total : 0);
    const F = G.frameAlong(end, tangent);
    const [s0, s1] = index ? [-fitLen, 0] : [0, fitLen];
    const nut = G.disc(s0, s1, fit, F, P, { steps: 24, bevel: 0.3 });
    const shape = A.disc(F, s0, s1, fit, { name: `${name}.fit${index}`, owner: name });
    R.put({ piece, name: `${name}.fit${index}`, at: G.add3(end, G.mul3(tangent, (s0 + s1) / 2)), bias: 0.06, svg: S(nut, { tone: "mid" }), move: [0, 0, 0], shapes: [R.solid(shape)] });
  });
  return route;
}

// =====================================================================
// stand: display plate, feet, ruler, label plate
function stand() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  const byDepth = (pts) => [...pts].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
  const shapes = [];
  for (const [x, y] of byDepth(k.corners(PLATE, 30))) {
    out.push(S(k.cylinder(x, y, 10, -PLATE_H - FOOT_H, 2, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 7.5, -PLATE_H - FOOT_H + 2, FOOT_H - 2, P, 28), { tone: "mid" }));
    shapes.push(A.cylinder(x, y, 10, -PLATE_H - FOOT_H, FOOT_H, { name: "stand.foot" }));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid", inner: L(k.sideSeam(PLATE, -PLATE_H + 4, P, 8), { tone: "faint" }) }));
  shapes.push(A.slab(PLATE, -PLATE_H, PLATE_H, { name: "stand.plate" }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 7), 0, P), { tone: "lo" }));
  out.push(screwsOnTop(k.corners(PLATE, 14), 0));
  // ruler strip along the near edge: 10 mm ticks, 50 mm majors
  const strip = { x: -320, y: PLATE.y + PLATE.d - 22, w: 380, d: 10, r: 1.2 };
  out.push(S(k.slabOf(strip, 0, 0.8, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 5, strip.x + strip.w - 5, 10, 5, strip.y + 0.8, 0.8, [3, 6], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(Dots([at([strip.x + 2.5, strip.y + 6, 0.8]), at([strip.x + strip.w - 2.5, strip.y + 6, 0.8])], { size: 0.45 }));
  // label plate
  const label = { x: 160, y: PLATE.y + PLATE.d - 44, w: 120, d: 26, r: 2 };
  out.push(S(k.slabOf(label, 0, 1, P, 4), { tone: "lo", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(label, 2.4), 1, P, 4), { tone: "faint" }));
  out.push(L([0, 1, 2].map((i) => k.lineOnTop([label.x + 12, label.y + 7 + i * 6], [label.x + 92 - i * 22, label.y + 7 + i * 6], 1, P)).join(""), { tone: "lo", free: true }));
  out.push(Dots([at([label.x + 5, label.y + label.d / 2, 1]), at([label.x + label.w - 5, label.y + label.d / 2, 1])], { size: 0.45 }));
  put("stand", [0, 0, -40], out.join(""), shapes, { name: "stand.base", bias: -2000 });

  // chamber posts with foot plates and top brackets
  for (const [x, y] of POSTS) {
    const foot = { x: x - 22, y: y - 22, w: 44, d: 44, r: 3 };
    box("stand", R.nameFor("stand.postfoot"), foot, 0, 5, { tone: "mid" }, { extra: screwsOnTop(k.corners(foot, 6), 5, 0.42) });
    const post = { x: x - 12, y: y - 12, w: 24, d: 24, r: 2 };
    box("stand", R.nameFor("stand.post"), post, 5, Z_FLOOR - 15, { tone: "mid" }, { inner: L([60, 160].map((z) => k.sideSeam(post, z, P, 3)).join(""), { tone: "faint" }) });
    const cap = { x: x - 20, y: y - 20, w: 40, d: 40, r: 3 };
    box("stand", R.nameFor("stand.postcap"), cap, Z_FLOOR - 10, 10, { tone: "mid" });
  }
}

// =====================================================================
// chamber body: floor, walls (cut), liner, slit port, viewport
function body() {
  const floorRing = halfSquare();
  prism("body", "body.floor", floorRing, Z_FLOOR, Z_FLOOR_TOP - Z_FLOOR, { tone: "mid" }, { sec: [[-RO, RO]] });
  // walls with the lid flange machined in, two pieces
  const wallH = Z_WALL_TOP - Z_FLOOR_TOP;
  const cornerBolts = [[-RO + 18, -RO + 18], [RO - 18, -RO + 18]];
  const boltRing = squarePts(-Math.PI, 0).length;
  void boltRing;
  // the transfer slit in the back of the bore, at wafer height: a rounded slot on the inner wall
  const slot = [];
  const slotZ = [378, 400];
  for (let i = 0; i <= 24; i++) {
    const a = deg(-112 + (44 * i) / 24);
    slot.push([(RB - 0.3) * Math.cos(a), (RB - 0.3) * Math.sin(a), slotZ[0]]);
  }
  for (let i = 0; i <= 24; i++) {
    const a = deg(-68 - (44 * i) / 24);
    slot.push([(RB - 0.3) * Math.cos(a), (RB - 0.3) * Math.sin(a), slotZ[1]]);
  }
  const slotSvg = `<path class="et-void" d="${path3(slot, true)}"/>` + L(path3(slot, true), { tone: "lo" });
  const backTop = screwsOnTop(cornerBolts.slice(0, 1), Z_WALL_TOP) + screwsOnTop(cornerBolts.slice(1), Z_WALL_TOP);
  prism("body", "body.wall.back", sector(RB, "square", -Math.PI, SPLIT), Z_FLOOR_TOP, wallH, { tone: "mid" }, { convex: false, bevel: 0.8, extra: slotSvg + backTop + L([300, 360, 420].map((z) => cut([[-216, z], [-209, z], [-209, z + 7], [-216, z + 7]])).join(""), { tone: "lo" }), sec: [[-RO, -RB]] });
  // near piece: carries the viewport on its +x face
  prism("body", "body.wall.front", sector(RB, "square", SPLIT, 0), Z_FLOOR_TOP, wallH, { tone: "mid" }, { convex: false, bevel: 0.8, sec: [[RB, RO]], extra: L([300, 360, 420].map((z) => cut([[209, z], [216, z], [216, z + 7], [209, z + 7]])).join(""), { tone: "lo" }) });
  // section edges of the o-ring groove under the window, on both cut faces
  const groove = [-1, 1].map((side) => cut([[side * 206, Z_WALL_TOP], [side * 206, Z_WALL_TOP - 3], [side * 210, Z_WALL_TOP - 3], [side * 210, Z_WALL_TOP]], true)).join("");
  put("body", [0, 0.5, Z_WALL_TOP - 2], L(groove, { tone: "lo" }), [A.box([-212, -0.5, Z_WALL_TOP - 4], [212, 0, Z_WALL_TOP])], { name: "body.groove", bias: 0.5 });
  // liner (anodised, replaceable)
  halfRing("body", "body.liner", LINER[0], LINER[1], Z_FLOOR_TOP, Z_LINER_TOP - Z_FLOOR_TOP, { tone: "lo" });
  // pumping baffle: slotted ring between the edge ring and the liner
  const slots = [];
  for (let a = -176; a <= -4; a += 8) {
    const a0 = deg(a - 2.2);
    const a1 = deg(a + 2.2);
    const r0 = BAFFLE[0] + 2;
    const r1 = BAFFLE[1] - 2;
    slots.push(path3([[r0 * Math.cos(a0), r0 * Math.sin(a0), Z_BAFFLE[1]], [r1 * Math.cos(a0), r1 * Math.sin(a0), Z_BAFFLE[1]], [r1 * Math.cos(a1), r1 * Math.sin(a1), Z_BAFFLE[1]], [r0 * Math.cos(a1), r0 * Math.sin(a1), Z_BAFFLE[1]]], true));
  }
  const back = slots.filter((_, i) => -176 + 8 * i < (SPLIT * 180) / Math.PI);
  const front = slots.filter((_, i) => -176 + 8 * i >= (SPLIT * 180) / Math.PI);
  halfRing("body", "body.baffle", BAFFLE[0], BAFFLE[1], Z_BAFFLE[0], Z_BAFFLE[1] - Z_BAFFLE[0], { tone: "lo" }, { extraBack: L(back.join(""), { tone: "faint" }), extraFront: L(front.join(""), { tone: "faint" }) });

  // capacitance manometer on the +x face: port flange, can, cable gland
  const MF = G.frameAlong([RO, -100, 320], [1, 0, 0]);
  put("pump", [RO + 4, -100, 320], S(G.disc(0, 6, 13, MF, P, { bevel: 0.3 }), { tone: "mid" }) + Dots(G.dotsOf(MF, 6, 10, 4, P, { all: true, phase: 0.5 }), { size: 0.42 }), [A.disc(MF, 0, 6, 13)], { name: "pump.gaugeport" });
  put("pump", [RO + 12, -100, 320], S(G.disc(6, 16, 6, MF, P), { tone: "mid" }), [A.disc(MF, 6, 16, 6)], { name: "pump.gaugeneck" });
  put("pump", [RO + 30, -100, 320], S(G.disc(16, 46, 22, MF, P, { bevel: 0.6 }), { tone: "mid", inner: L(G.arcOf(MF, 24, 22, P) + G.arcOf(MF, 38, 22, P), { tone: "faint" }) }) + L(G.circleOf(MF, 46, 15, P, 40), { tone: "lo" }) + Dots([at([RO + 46, -100, 320])], { size: 0.5 }), [A.disc(MF, 16, 46, 22)], { name: "pump.gauge" });
  // viewport on the flat +x face: flange, quartz window, clamp bolts, fibre adapter
  const F = G.frameAlong(VIEWPORT, [1, 0, 0]);
  const flange = G.disc(0, 7, 21, F, P, { bevel: 0.4 });
  const glass = G.disc(7, 8, 12, F, P);
  const bolts = Dots(G.dotsOf(F, 7, 16.5, 6, P, { all: true, phase: 0.5 }), { size: 0.45 });
  put("oes", G.add3(VIEWPORT, [4, 0, 0]), S(flange, { tone: "mid" }) + S(glass, { tone: "hi", crease: "lo" }) + bolts, [A.disc(F, 0, 7, 21), A.disc(F, 7, 8, 12)], { name: "oes.viewport" });
  const adapter = G.disc(8, 22, 6, F, P, { bevel: 0.3 });
  put("oes", G.add3(VIEWPORT, [15, 0, 0]), S(adapter, { tone: "mid" }) + L(G.circleOf(F, 22, 2.4, P, 16), { tone: "lo" }), [A.disc(F, 8, 22, 6)], { name: "oes.adapter" });
}

// =====================================================================
// lid: dielectric window, gas injector, TCP coil on standoffs, RF match on legs
function lid() {
  // the injector's middle runs through a bore in the window: in the section it shows as the injector's own outline and bore
  const injSection = L(cut([[-INJ, Z_WALL_TOP], [INJ, Z_WALL_TOP], [INJ, Z_WIN_TOP], [-INJ, Z_WIN_TOP]]), { tone: "mid" }) + L(cut([[-3, Z_WALL_TOP], [3, Z_WALL_TOP], [3, Z_WIN_TOP], [-3, Z_WIN_TOP]]), { tone: "lo" });
  prism("window", "window.ceramic", halfDisc(WIN_R), Z_WALL_TOP, Z_WIN_TOP - Z_WALL_TOP, { tone: "mid" }, { bevel: 0.6, sec: [[-WIN_R, WIN_R]], extra: injSection });
  // injector: a ceramic block through the window centre, its bore shown in section
  const injRing = [[INJ, 0], [INJ, -INJ], [-INJ, -INJ], [-INJ, 0]];
  const injPart = (name, z0, z1, extra) => prism("window", name, injRing, z0, z1 - z0, { tone: "mid" }, { sec: [[-INJ, INJ]], extra: L(extra, { tone: "lo" }) });
  const jets = cut([[-10, Z_INJ[0]], [-8, Z_INJ[0]], [-8, Z_INJ[0] + 6], [-10, Z_INJ[0] + 6]]) + cut([[8, Z_INJ[0]], [10, Z_INJ[0]], [10, Z_INJ[0] + 6], [8, Z_INJ[0] + 6]]);
  injPart("window.injector.tip", Z_INJ[0], Z_WALL_TOP, jets + cut([[-3, Z_INJ[0] + 8], [3, Z_INJ[0] + 8], [3, Z_WALL_TOP], [-3, Z_WALL_TOP]]));
  injPart("window.injector.head", Z_WIN_TOP, Z_INJ[1], cut([[-3, Z_WIN_TOP], [3, Z_WIN_TOP], [3, Z_INJ[1] - 4], [-3, Z_INJ[1] - 4]]));

  // coil standoffs (ceramic)
  for (const [ri, ro] of COIL) {
    for (const a of [-15, -75, -135]) {
      const rm = (ri + ro) / 2;
      const x = rm * Math.cos(deg(a));
      const y = rm * Math.sin(deg(a));
      box("coil", R.nameFor("coil.standoff"), { x: x - 5, y: y - 5, w: 10, d: 10, r: 1.5 }, Z_WIN_TOP, Z_COIL[0] - Z_WIN_TOP, { tone: "lo" }, { bevel: 0 });
    }
  }
  // the coil: three flat copper turns, water-cooled (bore in section)
  COIL.forEach(([ri, ro], index) => {
    const tube = [-1, 1].map((side) => cut([[side * (ri + 3), Z_COIL[0] + 3], [side * (ro - 3), Z_COIL[0] + 3], [side * (ro - 3), Z_COIL[1] - 3], [side * (ri + 3), Z_COIL[1] - 3]])).join("");
    prism("coil", `coil.turn${index}.back`, sector(ri, ro, -Math.PI, SPLIT), Z_COIL[0], Z_COIL[1] - Z_COIL[0], { tone: "hi", crease: "lo" }, { convex: false, sec: [[-ro, -ri]], extra: L(cut([[-(ri + 3), Z_COIL[0] + 3], [-(ro - 3), Z_COIL[0] + 3], [-(ro - 3), Z_COIL[1] - 3], [-(ri + 3), Z_COIL[1] - 3]]), { tone: "lo" }) });
    prism("coil", `coil.turn${index}.front`, sector(ri, ro, SPLIT, 0), Z_COIL[0], Z_COIL[1] - Z_COIL[0], { tone: "hi", crease: "lo" }, { convex: false, sec: [[ri, ro]], extra: L(cut([[ri + 3, Z_COIL[0] + 3], [ro - 3, Z_COIL[0] + 3], [ro - 3, Z_COIL[1] - 3], [ri + 3, Z_COIL[1] - 3]]), { tone: "lo" }) });
    void tube;
  });
  // RF feed posts from the outer turn up to the match
  for (const [x, y] of COIL_POSTS) {
    cyl("coil", R.nameFor("coil.post"), x, y, 4.5, Z_COIL[1], Z_MATCH[0] - Z_COIL[1], { tone: "mid" }, { steps: 20, bevel: 0 });
  }
  // match legs on the wall top, and the match box
  for (const [x, y] of MATCH_LEGS) {
    cyl("coil", R.nameFor("coil.leg"), x, y, 6.5, Z_WALL_TOP, 4, { tone: "mid" }, { steps: 24 });
    cyl("coil", R.nameFor("coil.leg"), x, y, 4.2, Z_WALL_TOP + 4, Z_MATCH[0] - Z_WALL_TOP - 4, { tone: "mid" }, { steps: 20, bevel: 0, inner: L(k.sideArc(x, y, 4.2, 540, P, 14), { tone: "faint" }) });
  }
  const lidZ = Z_MATCH[1] - 8;
  const vents = [];
  for (let i = 0; i < 6; i++) vents.push(k.planOutline({ x: MATCH.x + 40 + i * 14, y: MATCH.y + 18, w: 6, d: 40, r: 3 }, Z_MATCH[1], P, 3));
  const ext = L(vents.join(""), { tone: "lo" }) + screwsOnTop(k.corners(MATCH, 7), Z_MATCH[1], 0.45) + L(k.planOutline({ x: MATCH.x + 10, y: MATCH.y + 66, w: 20, d: 14, r: 1 }, Z_MATCH[1], P, 2), { tone: "faint" });
  box("coil", "coil.match", MATCH, Z_MATCH[0], Z_MATCH[1] - Z_MATCH[0], { tone: "mid" }, { inner: L(k.sideSeam(MATCH, lidZ, P, 3), { tone: "faint" }), extra: ext, bevel: 0.8 });
  // tuning knob on the lid
  cyl("coil", "coil.knob", MATCH.x + 128, MATCH.y + 70, 7, Z_MATCH[1], 6, { tone: "mid" }, { extra: L(k.knurl(MATCH.x + 128, MATCH.y + 70, 7, Z_MATCH[1] + 0.6, Z_MATCH[1] + 5.4, 28, P), { tone: "lo" }) + L(k.lineOnTop([MATCH.x + 128, MATCH.y + 70], [MATCH.x + 128 + 5, MATCH.y + 70], Z_MATCH[1] + 6, P), { tone: "hi" }) });
}

// =====================================================================
// chuck: stem, cooled baseplate, ceramic puck, wafer, focus ring, edge ring
function chuck() {
  const stemCut = cut([[-8, Z_FLOOR_TOP], [8, Z_FLOOR_TOP], [8, Z_BASE[0]], [-8, Z_BASE[0]]]) + cut([[-36, Z_FLOOR_TOP], [-28, Z_FLOOR_TOP], [-28, Z_BASE[0]], [-36, Z_BASE[0]]]) + cut([[28, Z_FLOOR_TOP], [36, Z_FLOOR_TOP], [36, Z_BASE[0]], [28, Z_BASE[0]]]);
  prism("chuck", "chuck.stem", halfDisc(STEM_R), Z_FLOOR_TOP, Z_BASE[0] - Z_FLOOR_TOP, { tone: "mid" }, { sec: [[-STEM_R, STEM_R]], extra: L(stemCut, { tone: "lo" }) });
  // baseplate with its coolant channels in section
  const chans = [];
  for (const x of [-140, -104, -68, -32, 32, 68, 104, 140]) chans.push(cut([[x - 7, 340], [x + 7, 340], [x + 7, 352], [x - 7, 352]]));
  const rod = cut([[-8, Z_BASE[0]], [8, Z_BASE[0]], [8, Z_BASE[1] - 8], [-8, Z_BASE[1] - 8]]) + [-86, 86].map((x) => cut([[x - 2, Z_BASE[0]], [x + 2, Z_BASE[0]], [x + 2, Z_BASE[1]], [x - 2, Z_BASE[1]]])).join("");
  prism("chuck", "chuck.base", halfDisc(BASE_R), Z_BASE[0], Z_BASE[1] - Z_BASE[0], { tone: "mid" }, { sec: [[-BASE_R, BASE_R]], extra: L(chans.join("") + rod, { tone: "lo" }), bevel: 0.6 });
  // ceramic puck with the clamp electrode buried in it
  const electrode = cut([[-138, 368], [-88, 368], [-88, 369.5], [-138, 369.5]]) + cut([[-84, 368], [84, 368], [84, 369.5], [-84, 369.5]]) + cut([[88, 368], [138, 368], [138, 369.5], [88, 369.5]]) + [-86, 86].map((x) => cut([[x - 2, Z_BASE[1]], [x + 2, Z_BASE[1]], [x + 2, Z_PUCK_TOP], [x - 2, Z_PUCK_TOP]])).join("");
  const holes = [];
  for (const r of [40, 80, 120]) for (let a = -170; a <= -10; a += 20) holes.push(at([r * Math.cos(deg(a)), r * Math.sin(deg(a)), Z_PUCK_TOP]));
  prism("chuck", "chuck.puck", halfDisc(PUCK_R), Z_BASE[1], Z_PUCK_TOP - Z_BASE[1], { tone: "mid" }, { sec: [[-PUCK_R, PUCK_R]], extra: L(electrode, { tone: "lo" }) });
  // the wafer: the subject
  prism("chuck", "chuck.wafer", halfDisc(PUCK_R - 1), Z_PUCK_TOP, Z_WAFER_TOP - Z_PUCK_TOP, { tone: "hi", crease: "lo" }, { bias: 0.2, sec: [[-(PUCK_R - 1), PUCK_R - 1]] });
  void holes;
  halfRing("chuck", "chuck.focus", FOCUS[0], FOCUS[1], Z_BASE[1], Z_FOCUS_TOP - Z_BASE[1], { tone: "hi", crease: "lo" });
  halfRing("chuck", "chuck.edge", EDGE[0], EDGE[1], Z_EDGE[0], Z_EDGE[1] - Z_EDGE[0], { tone: "lo" });
}

// =====================================================================
// pump stack under the floor: adapter, throttle valve, turbo, pedestal
function pump() {
  const [px, py] = PUMP;
  cyl("pump", "pump.pedestal", px, py, 78, 0, 10, { tone: "mid" }, { steps: 64, extra: screwsOnTop([0, 90, 180, 270].map((a) => [px + 70 * Math.cos(deg(a + 45)), py + 70 * Math.sin(deg(a + 45))]), 10, 0.45) });
  cyl("pump", "pump.motor", px, py, 62, 10, 52, { tone: "mid" }, { steps: 64, inner: L(k.knurl(px, py, 62, 16, 56, 44, P, 1.5) + k.sideArc(px, py, 62, 16, P, 48) + k.sideArc(px, py, 62, 56, P, 48), { tone: "faint" }) });
  cyl("pump", "pump.body", px, py, 84, 62, 124, { tone: "mid" }, { steps: 72, inner: L([96, 150].map((z) => k.sideArc(px, py, 84, z, P, 48)).join(""), { tone: "faint" }) });
  cyl("pump", "pump.flange", px, py, 98, 186, 10, { tone: "mid" }, { steps: 72, extra: Dots(Array.from({ length: 16 }, (_, i) => at([px + 92 * Math.cos(deg(i * 22.5)), py + 92 * Math.sin(deg(i * 22.5)), 196])), { size: 0.45 }) });
  // pendulum throttle valve: body and its motor can
  const valve = { x: px - 104, y: py - 92, w: 208, d: 184, r: 10 };
  box("pump", "pump.valve", valve, 196, 36, { tone: "mid" }, { inner: L(k.sideSeam(valve, 214, P, 6), { tone: "faint" }), steps: 6, bevel: 0.8 });
  cyl("pump", "pump.actuator", px + 118, py - 30, 14, 200, 30, { tone: "mid" }, { steps: 28, extra: L(k.ring(px + 118, py - 30, 7, 230, P, 16), { tone: "lo" }) });
  cyl("pump", "pump.adapter", px, py, 98, 232, Z_FLOOR - 232, { tone: "mid" }, { steps: 72, inner: L(k.sideArc(px, py, 98, 241, P, 48), { tone: "faint" }) });
}

// =====================================================================
// RF generator, bias match, gas box, spectrometer, and their lines
function services() {
  // RF generator (source and bias outputs)
  const genVents = [];
  for (let i = 0; i < 5; i++) genVents.push(k.planOutline({ x: GEN.x + 14, y: GEN.y + 18 + i * 14, w: 50, d: 6, r: 3 }, GEN_H, P, 3));
  box("coil", "coil.generator", GEN, 0, GEN_H, { tone: "mid" }, { inner: L([GEN_H - 10, 12].map((z) => k.sideSeam(GEN, z, P, 3)).join(""), { tone: "faint" }), extra: L(genVents.join(""), { tone: "lo" }) + screwsOnTop(k.corners(GEN, 6), GEN_H, 0.42) + L(faceY(GEN.y + GEN.d, GEN.x + 12, GEN.x + 56, 74, 104) + faceY(GEN.y + GEN.d, GEN.x + 16, GEN.x + 52, 80, 98), { tone: "lo" }) + L([30, 44, 58].map((z) => faceX(GEN.x + GEN.w, GEN.y + 20, GEN.y + 70, z, z + 5)).join(""), { tone: "lo" }) + Dots([at([GEN.x + 72, GEN.y + GEN.d, 92]), at([GEN.x + 80, GEN.y + GEN.d, 92])], { size: 0.7, tone: "hi" }), bevel: 0.8 });
  // bias match on the plate, rigid RF feed up into the chamber floor
  box("chuck", "chuck.biasmatch", BIAS, 0, BIAS_H, { tone: "mid" }, { inner: L(k.sideSeam(BIAS, BIAS_H - 8, P, 3), { tone: "faint" }), extra: screwsOnTop(k.corners(BIAS, 6), BIAS_H, 0.42), bevel: 0.6 });
  const feedX = BIAS.x + BIAS.w / 2;
  const feedY = BIAS.y + BIAS.d / 2;
  cyl("chuck", "chuck.feedcollar", feedX, feedY, 13, BIAS_H, 6, { tone: "mid" }, { steps: 28 });
  cyl("chuck", "chuck.feed", feedX, feedY, 8, BIAS_H + 6, Z_FLOOR - BIAS_H - 18, { tone: "mid" }, { steps: 24, bevel: 0, inner: L([140, 200].map((z) => k.sideArc(feedX, feedY, 8, z, P, 16)).join(""), { tone: "faint" }) });
  cyl("chuck", "chuck.feedflange", feedX, feedY, 14, Z_FLOOR - 12, 12, { tone: "mid" }, { steps: 28 });
  // gas box with three mass-flow controllers and an outlet
  box("window", "window.gasbox", GAS, 0, GAS_H, { tone: "mid" }, { inner: L(k.sideSeam(GAS, GAS_H - 10, P, 3), { tone: "faint" }), extra: screwsOnTop(k.corners(GAS, 6), GAS_H, 0.42) + L(faceY(GAS.y + GAS.d, GAS.x + 10, GAS.x + 80, 16, 90) + faceY(GAS.y + GAS.d, GAS.x + 16, GAS.x + 40, 70, 82), { tone: "lo" }) + Dots([at([GAS.x + 14, GAS.y + GAS.d, 20]), at([GAS.x + 76, GAS.y + GAS.d, 20]), at([GAS.x + 14, GAS.y + GAS.d, 86]), at([GAS.x + 76, GAS.y + GAS.d, 86])], { size: 0.42 }), bevel: 0.8 });
  [0, 1, 2].forEach((i) => {
    const mfc = { x: GAS.x + 8 + i * 27, y: GAS.y + 12, w: 22, d: 70, r: 2 };
    box("window", R.nameFor("window.mfc"), mfc, GAS_H, 22, { tone: "mid" }, { extra: L(k.planOutline(k.insetPlan(mfc, 3), GAS_H + 22, P, 2), { tone: "faint" }) });
    cyl("window", R.nameFor("window.valve"), mfc.x + 11, mfc.y + 20, 6, GAS_H + 22, 8, { tone: "mid" }, { steps: 20, extra: L(k.knurl(mfc.x + 11, mfc.y + 20, 6, GAS_H + 23, GAS_H + 29, 20, P), { tone: "lo" }) });
  });
  const outlet = [GAS.x + 46, GAS.y + 104];
  cyl("window", "window.outlet", outlet[0], outlet[1], 8, GAS_H, 6, { tone: "mid" }, { steps: 24 });
  // spectrometer
  box("oes", "oes.spectrometer", SPEC, 0, SPEC_H, { tone: "mid" }, { inner: L(k.sideSeam(SPEC, 10, P, 3), { tone: "faint" }), extra: screwsOnTop(k.corners(SPEC, 6), SPEC_H, 0.42) + L([0, 1, 2].map((i) => k.planOutline({ x: SPEC.x + 10, y: SPEC.y + 52 + i * 9, w: 30, d: 4, r: 2 }, SPEC_H, P, 2)).join(""), { tone: "lo" }), bevel: 0.6 });
  const sma = [SPEC.x + 50, -80];
  cyl("oes", "oes.sma", sma[0], sma[1], 6, SPEC_H, 6, { tone: "mid" }, { steps: 20 });

  // lines
  line("window", "window.gasline", [[outlet[0], outlet[1], GAS_H + 6], [outlet[0], outlet[1], 576], [outlet[0], -8, 576], [0, -8, 576], [0, -8, Z_INJ[1]]], 3.6, { tone: "mid", bend: 14 });
  line("coil", "coil.coax", [[GEN.x + 47, -176, GEN_H], [GEN.x + 47, -176, COAX_Z], [MATCH.x + 30, -176, COAX_Z], [MATCH.x + 30, -176, Z_MATCH[1]]], 4.5, { tone: "mid", bend: 18 });
  line("chuck", "chuck.biascoax", [[GEN.x + GEN.w, -165, 24], [feedX, -165, 24], [feedX, BIAS.y, 24]], 4.5, { tone: "mid", bend: 18 });
  line("oes", "oes.fibre", [[VIEWPORT[0] + 22, VIEWPORT[1], VIEWPORT[2]], [sma[0], VIEWPORT[1], VIEWPORT[2]], [sma[0], sma[1], SPEC_H + 6]], 2.2, { tone: "mid", bend: 12 });
}

// =====================================================================
// the plasma: a reserved slot the live code paints (glow and particles), ordered by its true volume
function plasmaSlot() {
  const ring = halfDisc(GLOW_R);
  const top = ring.map(([x, y]) => at([x, y, Z_GLOW[1]]));
  const bottom = ring.map(([x, y]) => at([x, y, Z_GLOW[0]]));
  const hull = hullOf([...top, ...bottom]);
  const d = k.pathOf(hull, true);
  const svg = `<g class="et-plasma" data-plasma><path class="et-glow" d="${d}" fill="url(#et-glow-grad)"/><path class="et-glow-core" d="${d}" fill="url(#et-core-grad)"/><g data-particles></g></g>`;
  put("plasma", [0, -GLOW_R / 2, (Z_GLOW[0] + Z_GLOW[1]) / 2], svg, [A.extruded(ring, Z_GLOW[0], Z_GLOW[1] - Z_GLOW[0], { ground: true })], { name: "plasma.volume" });
  return { hull };
}
function hullOf(points) {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (const p of [...pts].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

stand();
body();
lid();
chuck();
pump();
services();
plasmaSlot();

if (!process.argv.includes("--fast")) A.settle(R, P);
R.items.sort((a, b) => a.key - b.key);
const groups = R.items.map((item, index) => `<g class="it" data-piece="${item.piece}" data-name="${item.name}" data-i="${index}">${item.svg}</g>`);

// gradients for the glow: colours come from CSS tokens so the theme can flip at runtime
const gTop = at([0, 0, Z_GLOW[1]]);
const gBot = at([0, 0, Z_GLOW[0]]);
const defs = `<defs><linearGradient id="et-glow-grad" gradientUnits="userSpaceOnUse" x1="${gTop[0].toFixed(1)}" y1="${(gTop[1] - 40).toFixed(1)}" x2="${gBot[0].toFixed(1)}" y2="${gBot[1].toFixed(1)}"><stop offset="0" class="et-s0"/><stop offset="0.55" class="et-s1"/><stop offset="0.93" class="et-s2"/><stop offset="1" class="et-s3"/></linearGradient><radialGradient id="et-core-grad" gradientUnits="userSpaceOnUse" cx="${gTop[0].toFixed(1)}" cy="${(gTop[1] - 20).toFixed(1)}" r="${(GLOW_R * KS).toFixed(1)}"><stop offset="0" class="et-c0"/><stop offset="1" class="et-c1"/></radialGradient></defs>`;

const LABEL = `An inductively coupled plasma etch chamber cut in half so its inside shows. From the top: an RF match box on two legs, feeding a flat three-turn copper coil on a thick ceramic window, with a gas injector through the window's centre; the chamber body with a liner and a slotted pumping baffle; inside, an electrostatic chuck holding a ${M.WAFER.diameterMm} mm wafer, ringed by a focus ring and an edge ring; below, a throttle valve and turbo pump. Around it: an RF generator, a bias match with a rigid feed into the chamber, a gas box with three flow controllers and its line to the injector, and a viewport whose fibre runs to a spectrometer.`;
const svg = k.figureSvg({ width: W, height: H, label: LABEL, body: [defs, `<g class="et-layers">${groups.join("")}</g>`], className: "et-svg" });

const basis = (v) => {
  const o = at([0, 0, 0]);
  const p = at(v);
  return [p[0] - o[0], p[1] - o[1]];
};
const DATA = {
  O: at([0, 0, 0]),
  EX: basis([1, 0, 0]),
  EY: basis([0, 1, 0]),
  EZ: basis([0, 0, 1]),
  glow: { r: GLOW_R, z0: Z_GLOW[0], z1: Z_GLOW[1], wafer: Z_WAFER_TOP, inj: Z_INJ[0], baffle: (BAFFLE[0] + BAFFLE[1]) / 2 },
  steps: M.STEPS,
  parts: M.PARTS,
  order: Object.keys(M.PARTS),
  idle: M.IDLE,
  setpoint: M.ICP.setpointMTorr,
  atm: M.ATM_TORR,
  nm: M.ENDPOINT.nm,
};

const PARTS = DATA.order.map((id, index) => `<button type="button" class="et-part" data-part="${id}"><span class="et-num">${String(index + 1).padStart(2, "0")}</span>${M.PARTS[id].name}</button>`).join("");
const corners = `<div class="iso-plate-corners" aria-hidden="true"><span class="iso-plate-corner" data-corner="fig">Fig 1</span><span class="iso-plate-corner" data-corner="title">ICP etch chamber · section</span><span class="iso-plate-corner" data-corner="readout" data-readout>${M.IDLE}</span></div>`;

// inset: the trench forming under the mask, and the endpoint trace (2D detail, illustrative)
const inset = `<div class="et-inset" aria-hidden="true"><span class="et-inset-label">Detail · the trench</span><svg viewBox="0 0 220 200" class="et-inset-svg">
<rect class="et-in-frame" x="0.5" y="0.5" width="219" height="199" rx="6"/>
<rect class="et-in-sub" x="14" y="108" width="192" height="26"/>
<path class="et-in-film" data-film d=""/>
<path class="et-in-pass" data-pass d=""/>
<path class="et-in-mask" data-mask d=""/>
<g data-ions></g>
<path class="et-in-axis" d="M18 150V186H204"/>
<path class="et-in-trace" data-trace d="M18 186"/>
<circle class="et-in-head" data-head cx="18" cy="186" r="2"/>
<text class="et-in-text" x="24" y="156">${M.ENDPOINT.species} ${M.ENDPOINT.nm} nm</text>
<text class="et-in-text et-in-ar" data-ar x="204" y="20" text-anchor="end"></text>
</svg></div>`;

const controls = `<div class="et-controls"><span class="et-hint">Hover a part · Space plays the etch</span><span class="et-live" aria-live="polite" data-live></span></div>`;
const stage = `<div class="et-stage" tabindex="0" role="group" aria-label="ICP etch chamber, cut in half. Hover, or use the arrow keys, to pick a part; Space plays or pauses the etch; Escape resets it; the slider below steps through the process.">${svg}</div>`;
const caption = `An ICP etch chamber of the class of Lam's ${M.KIYO.name} (its ${M.KIYO.kind} line), cut in half. RF at ${M.ICP.rfMHz} MHz in the flat coil drives current through the ceramic window and sustains a dense plasma (about ${M.densityText} at a few mTorr); a second RF supply on the chuck sets how hard ions hit the ${M.WAFER.diameterMm} mm wafer. The turbo pump and throttle valve hold the pressure in the ${M.ICP.pressureMTorr[0]}–${M.ICP.pressureMTorr[1]} mTorr window while gas flows; the spectrometer watches the plasma's light through the viewport and calls the endpoint when a product line, here CO at ${M.ENDPOINT.nm} nm for an oxide etch, fades. Chamber, chuck and pump dimensions, the pressures shown during pump-down, the ${M.ICP.setpointMTorr} mTorr setpoint and the trench detail are illustrative.`;
const scrub = `<span class="et-scrub"><button type="button" class="et-play" data-play aria-label="Play the etch"><span class="et-play-icon" aria-hidden="true"></span><span data-play-text>Play</span></button><input type="range" class="et-range" data-scrub min="0" max="1000" step="1" value="0" aria-label="Process: 0 is the start of pump-down, 1000 is the resist stripped"><span class="et-step" data-step>01 · Pump down</span></span>`;
const figure = `<figure class="iso-figure et"><div class="iso-plate">${corners}${inset}${stage}${controls}</div><figcaption class="iso-legend">${scrub}<span class="et-parts">${PARTS}</span><span class="iso-caption">${caption}</span></figcaption></figure>`;

const CSS = readFileSync(join(HERE, "etch.css"), "utf8");
const LIVE = readFileSync(join(HERE, "live.js"), "utf8").replace("__DATA__", JSON.stringify(DATA));
const out = writeChapter({ slug: "etch", figure, css: CSS, script: LIVE, lesson: LESSON });
console.log("wrote", out.file, `${out.kb} KB`, `${R.items.length} items`, `${R.solids.length} solids`);

A.auditOrExit(R, P);
