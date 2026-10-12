// Slicing and polishing wafers: a multi-wire saw cutting a 300 mm ingot, with an edge grinder,
// a spin etcher and a double-side polisher in front of it.
// node build.mjs [--fast] [--audit]
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as M from "./model.mjs";

import { k, G, A, Tube, kitScript } from "../../site/kit.mjs";
import { writeChapter } from "../../site/shell.mjs";
import { LESSON } from "./lesson.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const FAST = process.argv.includes("--fast");

// ---- world (x, y on the floor, z up). Ingot, wafers and ruler are to scale at M.U units per mm. ----
const W = 660;
const H = 700;
const AZIMUTH = 66;
const ELEVATION = 30;

const BED = { x: -222, y: -116, w: 460, d: 414, r: 12 };
const BED_H = 12;
const FOOT_H = 7;
const PLINTH = { x: -132, y: -106, w: 352, d: 188, r: 6 };
const PLINTH_TOP = 18;
const WALL = { x: -126, y: -102, w: 342, d: 25, r: 3 };
const WALL_FACE = WALL.y + WALL.d; // -77, the face the rollers and head hang from
const WALL_TOP = 304;

// wire guide rollers (axes along y), cantilevered from the wall
const RO = { L: [-66, 125], R: [66, 125], B: [0, 47] };
const RR = { L: 22, R: 22, B: 20 };
const ZW = RO.L[1] + RR.L; // 147, the cutting web
const ROLL_S = { flange: 4, body0: 5, body1: 137, cap: 140 }; // along y from the wall face

const R = M.R_INGOT;
const LI = M.L_INGOT;
const ZC0 = ZW - R - 0.8; // ingot centre at the end of the cut: the wire has passed into the glue line
const TOP0 = ZC0 + R;
// the drawn wires span the block end to end, so the nearest one runs across the near end face
const WIRE_Y = Array.from({ length: M.WIRES_DRAWN }, (_, i) => -LI / 2 + i * M.WIRE_PITCH);
const INNER = R + 1; // static web runs stop this far from the ingot axis; the rest is drawn live

const MOVES = {
  stand: [0, 0, 0],
  head: [0, 0, M.FEED],
  ingot: [0, 0, M.FEED],
  edger: [0, 30, 0],
  etch: [-50, 0, 0],
  dsp: [0, 0, 58],
};

const P = k.fitProjection(
  [...k.boxCorners(BED, -BED_H - FOOT_H, 0), [WALL.x, WALL.y, WALL_TOP + 18], [WALL.x + WALL.w, WALL.y, WALL_TOP + 18], [WALL.x, WALL.y + WALL.d, WALL_TOP]],
  W,
  H,
  { pad: 26, azimuth: AZIMUTH, elevation: ELEVATION },
);
const V = G.viewOf(P);
const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);
const path3 = (points, closed = false) => k.pathOf(points.map(at), closed);
const centreOf = (plan, z) => [plan.x + plan.w / 2, plan.y + plan.d / 2, z];
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));

const R_ = A.recorder(P, { order: M.PIECE_IDS });
function put(piece, part, name, ref, svg, shapes, { bias = 0, loose = false } = {}) {
  const id = R_.nameFor(name);
  shapes.forEach((shape) => (shape.name = shape.name ?? id));
  return R_.put({ piece, part, at: ref, bias, svg, move: MOVES[piece], shapes: loose ? shapes : shapes.map(R_.solid), name: id });
}

// frames: along y (rollers, spools, ingot) with angle 0 = +x and 90° = +z; along z (posts, chucks)
const FY = (x, y0, z) => G.frameOf([x, y0, z], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
const FZ = (x, y, z0) => G.frameOf([x, y, z0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
const turned = (F, profile, style, options = {}) => ({ svg: S(G.solidOf(profile, F, P, options), style), shape: A.solid(F, profile) });
const slab = (plan, z, h, style, { steps = 4, bevel = 0, inner } = {}) => ({ svg: S(k.slabOf(plan, z, h, P, steps, bevel), { ...style, inner }), shape: A.slab(plan, z, h, {}, steps) });
const cyl = (x, y, r, z, h, style, { steps = 32, bevel = 0, inner } = {}) => ({ svg: S(k.cylinder(x, y, r, z, h, P, steps, bevel), { ...style, inner }), shape: A.cylinder(x, y, r, z, h) });
const screwsOn = (points, z, ring = 1.6) => L(points.map(([x, y]) => k.ring(x, y, ring, z, P, 14)).join(""), { tone: "lo" }) + Dots(points.map(([x, y]) => at([x, y, z])), { size: 0.45 });

// 2D belt tangent between two circles in the x-z plane. Signed radius: negative keeps the wire on the right of travel.
function tangent(c1, r1, c2, r2) {
  const D = [c2[0] - c1[0], c2[1] - c1[1]];
  const dist = Math.hypot(D[0], D[1]);
  const d = [D[0] / dist, D[1] / dist];
  const p = [-d[1], d[0]];
  const kk = (r1 - r2) / dist;
  const h = Math.sqrt(1 - kk * kk);
  const n = [kk * d[0] + h * p[0], kk * d[1] + h * p[1]];
  return [[c1[0] + r1 * n[0], c1[1] + r1 * n[1]], [c2[0] + r2 * n[0], c2[1] + r2 * n[1]]];
}
const angleOf = (c, t) => Math.atan2(t[1] - c[1], t[0] - c[0]);
const TAU = Math.PI * 2;
const ccw = (from, to) => [from, to <= from ? to + TAU * Math.ceil((from - to) / TAU + 1e-9) : to];

// ---- the bed, the plinth and the spindle wall ----
function stand() {
  const out = [];
  const shapes = [];
  out.push(`<path class="iso-halo" d="${k.haloOf(BED, -BED_H - FOOT_H, BED_H, P)}"/>`);
  for (const [x, y] of byDepth(k.corners(BED, 26))) {
    out.push(S(k.cylinder(x, y, 9, -BED_H - FOOT_H, 2, P, 28), { tone: "lo" }), S(k.cylinder(x, y, 7, -BED_H - FOOT_H + 2, FOOT_H - 2, P, 28), { tone: "mid" }));
    shapes.push(A.cylinder(x, y, 9, -BED_H - FOOT_H, FOOT_H, { name: "stand.foot" }));
  }
  out.push(S(k.slabOf(BED, -BED_H, BED_H, P, 8, 1.6), { tone: "mid", inner: L(k.sideSeam(BED, -BED_H + 3.5, P, 8), { tone: "faint" }) }));
  shapes.push(A.slab(BED, -BED_H, BED_H, { name: "stand.bed" }));
  out.push(L(k.planOutline(k.insetPlan(BED, 6), 0, P), { tone: "lo" }));
  out.push(screwsOn(k.corners(BED, 13), 0, 2.4));
  // ruler along the near edge: 1 mm = M.U units, minor ticks every 10 mm, majors every 50 mm
  const strip = { x: -150, y: BED.y + BED.d - 19, w: 252, d: 9, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 1, strip.x + 1 + 1000 * M.U, 10 * M.U, 5, strip.y + 0.8, 0.6, [2.4, 4.4], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(Dots([at([strip.x + strip.w - 3, strip.y + 4.5, 0.6])], { size: 0.45 }));
  // label plate
  const label = { x: 124, y: BED.y + BED.d - 25, w: 82, d: 17, r: 1.5 };
  out.push(S(k.slabOf(label, 0, 0.8, P, 4), { tone: "lo", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.8), 0.8, P, 4), { tone: "faint" }));
  out.push(L([0, 1, 2].map((i) => k.lineOnTop([label.x + 9, label.y + 5 + i * 3.2], [label.x + 62 - i * 15, label.y + 5 + i * 3.2], 0.8, P)).join(""), { tone: "lo", free: true }));
  out.push(Dots([at([label.x + 4.5, label.y + label.d / 2, 0.8]), at([label.x + label.w - 4.5, label.y + label.d / 2, 0.8])], { size: 0.45 }));
  put("stand", "", "stand.bed", [0, 0, -1], out.join(""), shapes, { bias: -1000 });

  // plinth: the saw's cast base
  const plinth = slab(PLINTH, 0, PLINTH_TOP, { tone: "mid" }, { steps: 6, bevel: 0.8, inner: L(k.sideSeam(PLINTH, 4, P, 6), { tone: "faint" }) });
  const pScrews = screwsOn(k.corners(PLINTH, 8), PLINTH_TOP);
  // levelling pads along the plinth foot
  put("stand", "", "stand.plinth", centreOf(PLINTH, 0), plinth.svg + pScrews, [plinth.shape], { bias: -500 });

  // the wall that carries the roller spindles, the feed column and the supply spool
  const seams = [60, 196].map((z) => k.sideSeam(WALL, z, P, 3)).join("");
  const wall = slab(WALL, PLINTH_TOP, WALL_TOP - PLINTH_TOP, { tone: "mid" }, { steps: 3, bevel: 1, inner: L(seams, { tone: "faint" }) });
  // panel joints on the front face run floor to top; vent slots are closed outlines
  const face = WALL_FACE;
  const joints = [-100, 104, 190].map((x) => k.segment([x, face, PLINTH_TOP], [x, face, WALL_TOP], P)).join("");
  const vents = [];
  for (let i = 0; i < 6; i++) {
    const z0 = 34 + i * 6;
    vents.push(path3([[-118, face, z0], [-106, face, z0], [-106, face, z0 + 2.4], [-118, face, z0 + 2.4]], true));
  }
  for (let i = 0; i < 5; i++) {
    const z0 = 254 + i * 6;
    vents.push(path3([[196, face, z0], [210, face, z0], [210, face, z0 + 2.4], [196, face, z0 + 2.4]], true));
  }
  const bolts = [];
  for (const x of [-118, 96, 112, 182, 198]) for (const z of [26, WALL_TOP - 8]) bolts.push(at([x, face, z]));
  const wallTopScrews = Dots([-110, -40, 40, 110, 180].map((x) => at([x, WALL.y + WALL.d / 2, WALL_TOP])), { size: 0.45 });
  put("stand", "", "stand.wall", [WALL.x + WALL.w / 2, WALL.y, PLINTH_TOP], wall.svg + L(joints, { tone: "faint" }) + L(vents.join(""), { tone: "lo" }) + Dots(bolts, { size: 0.5 }) + wallTopScrews, [wall.shape], { bias: -300 });

  // nameplate on the wall
  const plate = { x: -118, y: face, z: 210, w: 52, h: 26 };
  const pp = (u, v, off = 0) => [plate.x + u, face + off, plate.z + v];
  const nameSvg =
    `<path class="iso-fill" d="${path3([pp(0, 0, 0.8), pp(plate.w, 0, 0.8), pp(plate.w, plate.h, 0.8), pp(0, plate.h, 0.8)], true)}"/>` +
    `<path class="iso-top" d="${path3([pp(0, 0, 0.8), pp(plate.w, 0, 0.8), pp(plate.w, plate.h, 0.8), pp(0, plate.h, 0.8)], true)}"/>` +
    L(path3([pp(0, 0, 0.8), pp(plate.w, 0, 0.8), pp(plate.w, plate.h, 0.8), pp(0, plate.h, 0.8)], true), { tone: "lo" }) +
    L(path3([pp(2, 2, 0.8), pp(plate.w - 2, 2, 0.8), pp(plate.w - 2, plate.h - 2, 0.8), pp(2, plate.h - 2, 0.8)], true), { tone: "faint" }) +
    L([0, 1, 2].map((i) => path3([pp(7, plate.h - 8 - i * 4, 0.8), pp(plate.w - 10 - i * 9, plate.h - 8 - i * 4, 0.8)])).join(""), { tone: "lo", free: true }) +
    Dots([pp(3.6, 3.6, 0.8), pp(plate.w - 3.6, 3.6, 0.8), pp(3.6, plate.h - 3.6, 0.8), pp(plate.w - 3.6, plate.h - 3.6, 0.8)].map(at), { size: 0.45 });
  put("stand", "", "stand.nameplate", [plate.x + plate.w / 2, face + 0.4, plate.z], nameSvg, [A.box([plate.x, face, plate.z], [plate.x + plate.w, face + 0.8, plate.z + plate.h])]);

  // control pendant box on the wall's right end, with a cable gland and two lamps
  const box = { x: 196, y: face, w: 16, d: 12, r: 1.5 };
  const cb = slab(box, 120, 46, { tone: "mid" }, { steps: 3, bevel: 0.6, inner: L(k.sideSeam(box, 158, P, 3), { tone: "faint" }) });
  const lamps = [cyl(200, face + 12.6, 2, 166, 2.4, { tone: "hi" }, { steps: 16 }), cyl(207, face + 12.6, 2, 166, 2.4, { tone: "mid" }, { steps: 16 })];
  // lamps sit on the box top
  put("stand", "", "stand.controlbox", centreOf(box, 120), cb.svg + screwsOn([[199, face + 3], [209, face + 3]], 166, 1) + lamps.map((l) => l.svg).join(""), [cb.shape, ...lamps.map((l) => l.shape)]);
}

// ---- guide rollers, with grooves and the wire wrapped round them ----
const BELT = (() => {
  const cL = RO.L;
  const cR = RO.R;
  const cB = RO.B;
  const top = tangent(cR, -RR.R, cL, -RR.L);
  const left = tangent(cL, -RR.L, cB, -RR.B);
  const right = tangent(cB, -RR.B, cR, -RR.R);
  return { top, left, right };
})();

// supply (far end, first wire) and take-up (near end, last wire) paths, each in its own x-z plane
const SUPPLY = { spool: { c: [150, 205], r: 24 }, dancer: { c: [128, 148], r: 6 }, guide: { c: [100, 92], r: 6 } };
const TAKEUP = { spool: { c: [-150, 90], r: 22 } };
const SUP_PATH = [tangent(SUPPLY.spool.c, -SUPPLY.spool.r, SUPPLY.dancer.c, -SUPPLY.dancer.r), tangent(SUPPLY.dancer.c, -SUPPLY.dancer.r, SUPPLY.guide.c, SUPPLY.guide.r), tangent(SUPPLY.guide.c, SUPPLY.guide.r, RO.R, -RR.R)];
const TAK_PATH = [tangent(RO.L, -RR.L, TAKEUP.spool.c, -TAKEUP.spool.r)];
const Y0 = WIRE_Y[0];
const YN = WIRE_Y[WIRE_Y.length - 1];

function rollers() {
  for (const id of ["L", "R", "B"]) {
    const [x, z] = RO[id];
    const r = RR[id];
    const F = FY(x, WALL_FACE, z);
    const housing = turned(FY(x, WALL_FACE - 0.01, z), [[0, r + 8], [3.2, r + 8], [3.2, r + 6], [4, r + 6], [4, r + 4], [ROLL_S.body0, r + 4]], { tone: "mid" });
    const profile = [[ROLL_S.body0, r], [ROLL_S.body1, r], [ROLL_S.body1, r - 6], [ROLL_S.cap, r - 6]];
    const body = turned(F, profile, { tone: "hi", crease: "lo" });
    // coating seams near both ends, grooves at every drawn wire, and the wire itself where it wraps
    const seamArcs = [ROLL_S.body0 + 3, ROLL_S.body1 - 3].map((s) => G.arcOf(F, s, r, P)).join("");
    const grooves = WIRE_Y.map((y) => G.arcOf(F, y - WALL_FACE, r, P)).join("");
    const wraps = [];
    WIRE_Y.forEach((y, i) => {
      const s = y - WALL_FACE;
      let span = null;
      if (id === "R") span = i === 0 ? ccw(angleOf(RO.R, SUP_PATH[2][1]), Math.PI / 2) : ccw(angleOf(RO.R, BELT.right[1]), angleOf(RO.R, BELT.top[0]));
      if (id === "L") span = ccw(angleOf(RO.L, BELT.top[1]), i === WIRE_Y.length - 1 ? angleOf(RO.L, TAK_PATH[0][0]) : angleOf(RO.L, BELT.left[0]));
      if (id === "B") {
        if (i === WIRE_Y.length - 1) return;
        span = ccw(angleOf(RO.B, BELT.left[1]), angleOf(RO.B, BELT.right[0]));
      }
      wraps.push(G.arcOf(F, s, r + 0.15, P, { from: span[0], to: span[1], trim: 0 }));
    });
    const capFace = G.circleOf(F, ROLL_S.cap, r - 9, P);
    const bolts = G.dotsOf(F, ROLL_S.cap, r - 9, 8, P, { all: true });
    const hubBolts = G.dotsOf(F, ROLL_S.body0, r + 2.6, 12, P, { fade: [0.04, 0.42] });
    const svg =
      housing.svg +
      S(G.solidOf(profile, F, P), { tone: "hi", crease: "lo", inner: L(seamArcs, { tone: "faint" }) + L(grooves, { tone: "faint" }) }) +
      L(wraps.join(""), { tone: "mid", className: "wf-wire" }) +
      L(capFace, { tone: "lo" }) +
      Dots(bolts, { size: 0.45 }) +
      Dots(hubBolts, { size: 0.4 }) +
      Dots([at(G.pointOf(F, ROLL_S.cap, 0, 0))], { size: 0.9, tone: "lo" });
    put("stand", "web", `stand.roller-${id}`, [x, 0, z], svg, [housing.shape, body.shape]);
  }
}

// ---- the static runs of the web: everything outside the ingot's reach ----
function web() {
  const wireShape = (points) => A.tube(points, 0.3);
  const topL = WIRE_Y.map((y) => path3([[BELT.top[1][0], y, ZW], [-INNER, y, ZW]])).join("");
  const topR = WIRE_Y.map((y) => path3([[INNER, y, ZW], [BELT.top[0][0], y, ZW]])).join("");
  const lft = WIRE_Y.slice(0, -1).map((y) => path3([[BELT.left[0][0], y, BELT.left[0][1]], [BELT.left[1][0], y, BELT.left[1][1]]])).join("");
  const rgt = WIRE_Y.slice(1).map((y) => path3([[BELT.right[0][0], y, BELT.right[0][1]], [BELT.right[1][0], y, BELT.right[1][1]]])).join("");
  const ya = WIRE_Y[0];
  const yb = WIRE_Y[WIRE_Y.length - 1];
  const sheet = (x0, z0, x1, z1, from = ya, to = yb) => {
    const c = [(x0 + x1) / 2, (from + to) / 2, (z0 + z1) / 2];
    const ax = G.unit3([x1 - x0, 0, z1 - z0]);
    const len = Math.hypot(x1 - x0, z1 - z0);
    return A.orientedBox(c, [ax, [0, 1, 0], G.cross3(ax, [0, 1, 0])], [len / 2, (to - from) / 2 + 0.3, 0.3]);
  };
  put("stand", "web", "stand.web-top-left", [-(RO.R[0] + INNER) / 2, 0, ZW], `<g class="wf-web">${L(topL, { tone: "mid", className: "wf-wire" })}<g data-inner-left></g></g>`, [sheet(BELT.top[1][0], ZW, -INNER, ZW)], { loose: true });
  put("stand", "web", "stand.web-top-right", [(RO.R[0] + INNER) / 2, 0, ZW], `<g class="wf-web">${L(topR, { tone: "mid", className: "wf-wire" })}</g>`, [sheet(INNER, ZW, BELT.top[0][0], ZW)], { loose: true });
  put("stand", "web", "stand.web-left", [-33, 0, 80], L(lft, { tone: "mid", className: "wf-wire" }), [sheet(BELT.left[0][0], BELT.left[0][1], BELT.left[1][0], BELT.left[1][1], ya, WIRE_Y[WIRE_Y.length - 2])], { loose: true });
  put("stand", "web", "stand.web-right", [33, 0, 80], L(rgt, { tone: "mid", className: "wf-wire" }), [sheet(BELT.right[0][0], BELT.right[0][1], BELT.right[1][0], BELT.right[1][1], WIRE_Y[1], yb)], { loose: true });
  void wireShape;
}

// ---- slurry nozzles over the web ----
function nozzles() {
  for (const x of [-50, 50]) {
    const F = FY(x, WALL_FACE, 164);
    // a wall flange, the spray pipe and its end cap, as three turned solids so each outline is its own
    const flange = turned(F, [[0, 6.5], [3, 6.5]], { tone: "mid" });
    const pipe = [[3, 3.6], [128, 3.6]];
    const capP = [[128, 4.6], [132, 4.6], [132, 2.4], [134, 2.4]];
    const cap = turned(F, capP, { tone: "mid" });
    const bands = [40, 84].map((s) => G.arcOf(F, s, 3.6, P)).join("");
    const flangeBolts = G.dotsOf(F, 3, 5.2, 6, P, { all: true });
    put("stand", "web", "stand.nozzle", [x, 0, 164], flange.svg + Dots(flangeBolts, { size: 0.4 }) + S(G.solidOf(pipe, F, P), { tone: "mid", inner: L(bands, { tone: "faint" }) }) + cap.svg, [flange.shape, A.solid(F, pipe), cap.shape]);
    // slurry curtain from the nozzle onto the web: lines from the pipe's underside to the wires, shown while cutting
    const curtain = WIRE_Y.filter((_, i) => i % 3 === 1).map((y) => path3([[x, y, 164], [x, y, ZW]])).join("");
    put("stand", "web", "stand.curtain", [x, 0, (164 + ZW) / 2 - 2], `<g class="wf-slurry">${L(curtain, { tone: "faint", flow: true })}</g>`, [A.box([x - 0.3, WIRE_Y[1] - 0.3, ZW], [x + 0.3, WIRE_Y[WIRE_Y.length - 2] + 0.3, 164 - 3.6])], { loose: true });
  }
}

// ---- the feed head: rails on the wall, carriage, arm, work plate, beam and glue ----
function head() {
  // rails and the feed screw housing stay with the wall
  for (const x of [-27, 27]) {
    const rail = slab({ x: x - 3, y: WALL_FACE, w: 6, d: 4, r: 0.6 }, 150, WALL_TOP - 8 - 150, { tone: "mid" }, { steps: 2 });
    const stops = [slab({ x: x - 4, y: WALL_FACE, w: 8, d: 5, r: 0.8 }, 146, 4, { tone: "mid" }, { steps: 2 }), slab({ x: x - 4, y: WALL_FACE, w: 8, d: 5, r: 0.8 }, WALL_TOP - 8, 4, { tone: "mid" }, { steps: 2 })];
    const screws = Dots([160, 190, 220, 250, 280].map((z) => at([x, WALL_FACE + 4, z])), { size: 0.35, tone: "lo" });
    put("stand", "", "stand.rail", [x, WALL_FACE + 2, 220], stops[0].svg + rail.svg + screws + stops[1].svg, [rail.shape, ...stops.map((s) => s.shape)]);
  }
  // feed motor on the wall top
  const motor = cyl(0, WALL.y + 12, 11, WALL_TOP, 20, { tone: "mid" }, { steps: 40, bevel: 0.5, inner: L([WALL_TOP + 6, WALL_TOP + 18].map((z) => k.sideArc(0, WALL.y + 12, 11, z, P, 24)).join(""), { tone: "faint" }) });
  const cap = cyl(0, WALL.y + 12, 7, WALL_TOP + 20, 3, { tone: "mid" }, { steps: 28 });
  const fins = L(k.knurl(0, WALL.y + 12, 11, WALL_TOP + 6, WALL_TOP + 18, 30, P, 0), { tone: "lo" });
  put("stand", "", "stand.feedmotor", [0, WALL.y + 12, WALL_TOP], motor.svg + fins + cap.svg + Dots([at([0, WALL.y + 12, WALL_TOP + 23])], { size: 0.6 }), [motor.shape, cap.shape]);

  const carriage = { x: -34, y: WALL_FACE + 4, w: 68, d: 6, r: 1 };
  const cz = TOP0 + 10;
  const car = slab(carriage, cz, 38, { tone: "mid" }, { steps: 2, bevel: 0.5 });
  const carScrews = Dots([-30, -24, 24, 30].flatMap((x) => [cz + 5, cz + 33].map((z) => at([x, carriage.y + carriage.d, z]))), { size: 0.45 });
  put("head", "beam", "head.carriage", centreOf(carriage, cz), car.svg + carScrews, [car.shape]);

  const arm = { x: -16, y: carriage.y + carriage.d, w: 32, d: 52 - (carriage.y + carriage.d), r: 1.5 };
  const az = TOP0 + 24;
  const armS = slab(arm, az, 12, { tone: "mid" }, { steps: 3, bevel: 0.6, inner: L(k.sideSeam(arm, az + 6, P, 3), { tone: "faint" }) });
  const armTop = L(k.planOutline(k.insetPlan(arm, 4), az + 12, P, 3), { tone: "faint" }) + Dots([[-10, 40], [10, 40], [-10, -40], [10, -40]].map(([x, y]) => at([x, y, az + 12])), { size: 0.5 });
  put("head", "beam", "head.arm", centreOf(arm, az), armS.svg + armTop, [armS.shape]);

  // dovetail clamp, work plate, beam and glue line
  const dove = { x: -14, y: -60, w: 28, d: 120, r: 1 };
  const dv = slab(dove, TOP0 + 18, 6, { tone: "mid" }, { steps: 2 });
  const knobs = [-46, 46].map((y) => cyl(15.5, y, 2.4, TOP0 + 19.5, 3, { tone: "mid" }, { steps: 16 }));
  put("head", "beam", "head.dovetail", centreOf(dove, TOP0 + 18), dv.svg + Dots([-50, -25, 0, 25, 50].map((y) => at([0, y, TOP0 + 24])), { size: 0.4, tone: "lo" }), [dv.shape]);
  void knobs;

  const plate = { x: -34, y: -64, w: 68, d: 128, r: 2 };
  const pl = slab(plate, TOP0 + 11, 7, { tone: "mid" }, { steps: 3, bevel: 0.6, inner: L(k.sideSeam(plate, TOP0 + 14.5, P, 3), { tone: "faint" }) });
  const plScrews = screwsOn([[-28, -58], [28, -58], [-28, 58], [28, 58], [-28, 0], [28, 0]], TOP0 + 18, 1.4);
  put("head", "beam", "head.plate", centreOf(plate, TOP0 + 11), pl.svg + plScrews, [pl.shape]);

  const beam = { x: -17, y: -LI / 2 - 1.5, w: 34, d: LI + 3, r: 0.8 };
  const bm = slab(beam, TOP0 + 1.5, 9.5, { tone: "hi", crease: "lo" }, { steps: 2, inner: L(k.sideSeam(beam, TOP0 + 7.5, P, 2), { tone: "faint" }) });
  put("head", "beam", "head.beam", centreOf(beam, TOP0 + 1.5), bm.svg, [bm.shape]);

  const glue = { x: -6, y: -LI / 2, w: 12, d: LI, r: 0.3 };
  const gl = slab(glue, TOP0 - 0.45, 1.95, { tone: "lo", crease: "none" }, { steps: 2 });
  put("head", "beam", "head.glue", centreOf(glue, TOP0), gl.svg, [gl.shape]);
}

// ---- the ingot: kerfs are drawn live in its own coordinates ----
function ingot() {
  const F = FY(0, -LI / 2, ZC0);
  const profile = [[0, R], [LI, R]];
  const body = turned(F, profile, { tone: "hi", crease: "lo" });
  // four growth ridges of an as-grown <100> crystal, ground away in step 1
  const ridges = [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4].map((t) => {
    const n = G.radialOf(F, t);
    if (G.dot3(n, V) < 0.05) return "";
    return path3([G.pointOf(F, 0, R, t), G.pointOf(F, LI, R, t)]);
  }).join("");
  // the notch: a groove along the length at the <110> mark, and its V on the near face
  const tn = M.NOTCH_ANGLE;
  const groove = [tn - 0.012, tn + 0.012].map((t) => path3([G.pointOf(F, 0, R, t), G.pointOf(F, LI, R, t)])).join("");
  const vee = path3([G.pointOf(F, LI, R, tn - 0.03), G.pointOf(F, LI, R - 1.2, tn), G.pointOf(F, LI, R, tn + 0.03)]);
  const face = G.circleOf(F, LI, R - 1.6, P);
  // the near end face reads as bare silicon, the face the last wafer will have
  const svg =
    S(G.solidOf(profile, F, P), { tone: "hi", crease: "lo" }) +
    `<path class="iso-top wf-face" d="${G.circleOf(F, LI, R, P)}"/>` +
    L(G.circleOf(F, LI, R, P), { tone: "lo" }) +
    `<g class="wf-ridges">${L(ridges, { tone: "mid" })}</g>` +
    `<g class="wf-notch">${L(groove, { tone: "lo" })}${L(vee, { tone: "mid" })}</g>` +
    L(face, { tone: "faint" }) +
    `<g data-kerf></g>`;
  put("ingot", "ingot", "ingot.body", [0, 0, ZC0], svg, [body.shape]);
}

// ---- wire spools, dancers and guide pulleys ----
function pulleyAt(c, r, y, piece = "stand", part = "spools", name) {
  const F = FY(c[0], y - 2.8, c[1]);
  const profile = [[0, r + 1.2], [1, r + 1.2], [2.4, r], [3.2, r], [4.6, r + 1.2], [5.6, r + 1.2]];
  const body = turned(F, profile, { tone: "hi", crease: "lo" });
  const hub = G.circleOf(F, 5.6, r * 0.45, P);
  return { svg: body.svg + L(hub, { tone: "lo" }) + Dots([at(G.pointOf(F, 5.6, 0, 0))], { size: 0.6, tone: "lo" }), shape: body.shape, F };
}

// a flanged spool along its frame: the back flange and wound pack, then the front flange as its own item,
// so the wire that winds on between them sorts between the two
function spoolAt(name, F, { hub, flange, pack, s0, s1, nut }) {
  const back = [[0, hub], [s0, hub], [s0, flange], [s0 + 3, flange], [s0 + 3, pack], [s1, pack]];
  const front = [[s1, flange], [s1 + 3, flange], [s1 + 3, nut], [s1 + 7, nut]];
  const windings = [];
  for (let at = s0 + 6; at <= s1 - 3; at += 4) windings.push(G.arcOf(F, at, pack, P));
  const centre = (sAt) => G.pointOf(F, sAt, 0, 0);
  put("stand", "spools", name, centre((s0 + s1) / 2), S(G.solidOf(back, F, P), { tone: "mid", inner: L(windings.join(""), { tone: "lo" }) }), [A.solid(F, back)]);
  put("stand", "spools", `${name}-flange`, centre(s1 + 2), S(G.solidOf(front, F, P), { tone: "mid" }) + L(G.circleOf(F, s1 + 3, flange - 5, P), { tone: "faint" }) + Dots(G.dotsOf(F, s1 + 3, flange - 10, 8, P, { all: true }), { size: 0.45 }) + Dots([at(G.pointOf(F, s1 + 7, 0, 0))], { size: 0.9, tone: "lo" }), [A.solid(F, front)]);
}

function spools() {
  // supply spool on the wall
  const s = SUPPLY;
  const yA = WALL_FACE;
  const FA = FY(s.spool.c[0], yA, s.spool.c[1]);
  spoolAt("stand.spool-supply", FA, { hub: 13, flange: 31, pack: s.spool.r, s0: 3, s1: 40, nut: 8 });

  // dancer arm on a pivot boss, guide pulley on a stud, both in the supply plane
  const pivot = [s.dancer.c[0] + 22, s.dancer.c[1] + 8];
  const boss = turned(FY(pivot[0], WALL_FACE, pivot[1]), [[0, 7], [Y0 - 4 - WALL_FACE, 7]], { tone: "mid" });
  put("stand", "spools", "stand.dancer-boss", [pivot[0], (WALL_FACE + Y0) / 2, pivot[1]], boss.svg, [boss.shape]);
  const armF = G.frameOf([pivot[0], Y0 - 4, pivot[1]], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
  const dx = s.dancer.c[0] - pivot[0];
  const dz = s.dancer.c[1] - pivot[1];
  const len = Math.hypot(dx, dz);
  const ang = Math.atan2(dz, dx);
  const poly = G.stadium(4.5, 3.5, len).map(([u, v]) => [u * Math.cos(ang) - v * Math.sin(ang), u * Math.sin(ang) + v * Math.cos(ang)]);
  const armSvg = S(G.prismOf(armF, poly, 0, 1.2, P), { tone: "mid" });
  put("stand", "spools", "stand.dancer-arm", [pivot[0] + dx / 2, Y0 - 3.4, pivot[1] + dz / 2], armSvg + Dots([at([pivot[0], Y0 - 2.8, pivot[1]])], { size: 0.8, tone: "lo" }), [A.prism(armF, poly, 0, 1.2)]);
  const dp = pulleyAt(s.dancer.c, s.dancer.r, Y0);
  const dWrap = wrapOn(s.dancer.c, s.dancer.r, Y0, angleOf(s.dancer.c, SUP_PATH[0][1]), angleOf(s.dancer.c, SUP_PATH[1][0]), -1);
  put("stand", "spools", "stand.dancer-pulley", [s.dancer.c[0], Y0, s.dancer.c[1]], dp.svg + dWrap, [dp.shape]);
  const stud = turned(FY(s.guide.c[0], WALL_FACE, s.guide.c[1]), [[0, 4], [2, 4], [2, 2], [Y0 - 2.8 - WALL_FACE, 2]], { tone: "mid" });
  put("stand", "spools", "stand.guide-stud", [s.guide.c[0], (WALL_FACE + Y0) / 2, s.guide.c[1]], stud.svg, [stud.shape]);
  const gp = pulleyAt(s.guide.c, s.guide.r, Y0);
  const gWrap = wrapOn(s.guide.c, s.guide.r, Y0, angleOf(s.guide.c, SUP_PATH[1][1]), angleOf(s.guide.c, SUP_PATH[2][0]), 1);
  put("stand", "spools", "stand.guide-pulley", [s.guide.c[0], Y0, s.guide.c[1]], gp.svg + gWrap, [gp.shape]);

  // take-up spool on a bearing pedestal standing on the bed beside the plinth
  const t = TAKEUP;
  const ped = { x: t.spool.c[0] - 12, y: 12, w: 24, d: 8, r: 1 };
  const pedS = slab(ped, 3, t.spool.c[1] + 7, { tone: "mid" }, { steps: 2, bevel: 0.5, inner: L(k.sideSeam(ped, 8, P, 2), { tone: "faint" }) });
  const pedFoot = slab(k.insetPlan(ped, -4), 0, 3, { tone: "mid" }, { steps: 2 });
  put("stand", "spools", "stand.takeup-pedestal", centreOf(ped, 0), pedFoot.svg + pedS.svg + screwsOn([[ped.x + 4, ped.y + 4], [ped.x + ped.w - 4, ped.y + 4]], t.spool.c[1] + 10, 1), [pedFoot.shape, pedS.shape]);
  const yB = ped.y + ped.d;
  const FB = FY(t.spool.c[0], yB, t.spool.c[1]);
  spoolAt("stand.spool-takeup", FB, { hub: 11, flange: 29, pack: t.spool.r, s0: 3, s1: YN + 6 - yB, nut: 7 });

  // the wire runs between them: one item per straight run, each ending on a pulley, roller or spool
  const flanges = [{ c: s.spool.c, r: 31.5 }, { c: t.spool.c, r: 29.5 }];
  const runItems = (y, pairs, name) =>
    pairs.forEach(([a, b], i) => {
      // a run that winds onto a spool is cut where it passes inside the spool's flanges
      let cuts = [[a, b]];
      for (const f of flanges) {
        const inside = (p) => Math.hypot(p[0] - f.c[0], p[1] - f.c[1]) < f.r;
        if (!inside(a) && !inside(b)) continue;
        const [pin, pout] = inside(a) ? [a, b] : [b, a];
        let lo = 0;
        let hi = 1;
        for (let n = 0; n < 40; n++) {
          const m = (lo + hi) / 2;
          const q = [pin[0] + (pout[0] - pin[0]) * m, pin[1] + (pout[1] - pin[1]) * m];
          if (inside(q)) lo = m;
          else hi = m;
        }
        const q = [pin[0] + (pout[0] - pin[0]) * hi, pin[1] + (pout[1] - pin[1]) * hi];
        cuts = [[pin, q], [q, pout]];
      }
      cuts.forEach(([p0, p1], j) => {
        const pts = [[p0[0], y, p0[1]], [p1[0], y, p1[1]]];
        put("stand", "spools", `${name}${i}${j ? "b" : ""}`, [(p0[0] + p1[0]) / 2, y + 0.4, (p0[1] + p1[1]) / 2], L(path3(pts), { tone: "mid", className: "wf-wire" }), [A.tube(pts, 0.3)], { loose: true });
      });
    });
  runItems(Y0, SUP_PATH, "stand.wire-supply");
  runItems(YN, TAK_PATH, "stand.wire-takeup");
}

// the wire's wrap round a pulley, drawn on the pulley's own face of the groove
function wrapOn(c, r, y, a, b, sign) {
  const F = FY(c[0], 0, c[1]);
  const [from, to] = sign < 0 ? ccw(a, b) : ccw(b, a);
  return L(G.arcOf(F, y, r + 0.15, P, { from, to, trim: 0 }), { tone: "mid", className: "wf-wire" });
}

// ---- edge grinder: vacuum chuck and a profile wheel on a slide ----
const EDGE = { c: [-160, 150], wheelR: 11 };
const WAFER_T = 1.2; // drawn thickness, exaggerated about six times
function edger() {
  const [cx, cy] = EDGE.c;
  const base = { x: cx - 46, y: cy - 42, w: 92, d: 140, r: 4 };
  const b = slab(base, 0, 10, { tone: "mid" }, { steps: 4, bevel: 0.8, inner: L(k.sideSeam(base, 4, P, 4), { tone: "faint" }) });
  put("stand", "edger", "stand.edger-base", centreOf(base, 0), b.svg + screwsOn(k.corners(base, 6), 10), [b.shape], { bias: -10 });
  const spindle = cyl(cx, cy, 15, 10, 14, { tone: "mid" }, { steps: 40, inner: L(k.sideArc(cx, cy, 15, 16, P, 30), { tone: "faint" }) });
  const chuck = cyl(cx, cy, 24, 24, 5, { tone: "mid" }, { steps: 56, bevel: 0.5 });
  const wafer = cyl(cx, cy, M.R_INGOT, 29, WAFER_T, { tone: "hi", crease: "lo" }, { steps: 96 });
  const notch = notchSvg(cx, cy, 29 + WAFER_T, M.R_INGOT, -Math.PI / 2 - 0.5);
  put("stand", "edger", "stand.edger-chuck", [cx, cy, 10], spindle.svg + chuck.svg, [spindle.shape, chuck.shape]);
  put("stand", "edger", "stand.edger-wafer", [cx, cy, 29], wafer.svg + notch + L(k.ring(cx, cy, M.R_INGOT - 2.4, 29 + WAFER_T, P, 96), { tone: "faint" }), [wafer.shape]);
  // slide rails along y and the wheel carriage
  for (const x of [cx - 9, cx + 9]) {
    const rail = slab({ x: x - 2.5, y: 184, w: 5, d: 72, r: 0.6 }, 10, 3, { tone: "mid" }, { steps: 2 });
    put("stand", "edger", "stand.edger-rail", [x, 220, 10], rail.svg + Dots([190, 220, 250].map((y) => at([x, y, 13])), { size: 0.35, tone: "lo" }), [rail.shape]);
  }
  const wy = cy + M.R_INGOT + EDGE.wheelR;
  const car = { x: cx - 14, y: wy - 10, w: 28, d: 26, r: 1.5 };
  const c = slab(car, 13, 5, { tone: "mid" }, { steps: 3, bevel: 0.5 });
  put("edger", "edger", "edger.carriage", centreOf(car, 13), c.svg + screwsOn(k.corners(car, 3.5), 18, 1), [c.shape]);
  const motor = cyl(cx, wy + 6, 9, 18, 8, { tone: "mid" }, { steps: 32 });
  const neck = cyl(cx, wy, 5, 18, 8, { tone: "mid" }, { steps: 24 });
  void motor;
  const wheel = cyl(cx, wy, EDGE.wheelR, 26, 9, { tone: "hi", crease: "lo" }, { steps: 48, inner: L(k.sideArc(cx, wy, EDGE.wheelR, 29 + WAFER_T / 2, P, 30), { tone: "lo" }) });
  const nut = cyl(cx, wy, 4, 35, 2, { tone: "mid" }, { steps: 16 });
  put("edger", "edger", "edger.wheel", [cx, wy, 18], neck.svg + wheel.svg + nut.svg + L(k.knurl(cx, wy, EDGE.wheelR, 31, 35, 36, P), { tone: "faint" }), [neck.shape, wheel.shape, nut.shape]);
}

function notchSvg(cx, cy, z, r, a) {
  const p = (rad, t) => [cx + rad * Math.cos(t), cy + rad * Math.sin(t), z];
  return L(path3([p(r, a - 0.035), p(r - 1.6, a), p(r, a + 0.035)]), { tone: "lo" });
}

// ---- spin etcher: a tray, a spin chuck, a nozzle carriage on a gantry ----
const ETCH = { c: [-50, 172] };
function etcher() {
  const [cx, cy] = ETCH.c;
  const tray = { x: cx - 44, y: cy - 44, w: 88, d: 88, r: 4 };
  const floor = slab(tray, 0, 3, { tone: "lo" }, { steps: 4 });
  put("stand", "etcher", "stand.etch-floor", centreOf(tray, 0), floor.svg + L(k.planOutline(k.insetPlan(tray, 6), 3, P, 4), { tone: "faint" }), [floor.shape], { bias: -10 });
  const t = 3;
  const walls = [
    { x: tray.x, y: tray.y, w: t, d: tray.d, r: 0.6 },
    { x: tray.x + tray.w - t, y: tray.y, w: t, d: tray.d, r: 0.6 },
    { x: tray.x + t, y: tray.y, w: tray.w - 2 * t, d: t, r: 0.2 },
    { x: tray.x + t, y: tray.y + tray.d - t, w: tray.w - 2 * t, d: t, r: 0.2 },
  ];
  walls.forEach((w, i) => {
    const s = slab(w, 3, 14, { tone: "mid" }, { steps: 2 });
    put("stand", "etcher", `stand.etch-wall${i}`, centreOf(w, 3), s.svg, [s.shape]);
  });
  const spindle = cyl(cx, cy, 7, 3, 19, { tone: "mid" }, { steps: 28 });
  const chuck = cyl(cx, cy, 16, 22, 3, { tone: "mid" }, { steps: 48 });
  put("stand", "etcher", "stand.etch-chuck", [cx, cy, 3], spindle.svg + chuck.svg, [spindle.shape, chuck.shape]);
  const wafer = cyl(cx, cy, M.R_INGOT, 25, WAFER_T, { tone: "hi", crease: "lo" }, { steps: 96 });
  put("stand", "etcher", "stand.etch-wafer", [cx, cy, 25], wafer.svg + notchSvg(cx, cy, 25 + WAFER_T, M.R_INGOT, -Math.PI / 2 - 0.5) + `<g class="wf-wet">${L(k.ring(cx, cy, 22, 25 + WAFER_T, P, 72), { tone: "faint" })}${L(k.ring(cx, cy, 12, 25 + WAFER_T, P, 48), { tone: "faint" })}</g>`, [wafer.shape]);
  // gantry
  const gy = cy - 8;
  for (const x of [cx - 54, cx + 49]) {
    const post = slab({ x: x - 4, y: gy - 4, w: 8, d: 8, r: 1 }, 0, 64, { tone: "mid" }, { steps: 2, bevel: 0.4 });
    put("stand", "etcher", "stand.etch-post", [x, gy, 0], post.svg, [post.shape]);
  }
  const beam = { x: cx - 58, y: gy - 4, w: 111, d: 8, r: 1 };
  const bm = slab(beam, 64, 6, { tone: "mid" }, { steps: 2, bevel: 0.5 });
  put("stand", "etcher", "stand.etch-beam", centreOf(beam, 64), bm.svg + Dots([cx - 54, cx + 49].map((x) => at([x, gy, 70])), { size: 0.5 }), [bm.shape]);
  const carr = { x: cx - 8, y: gy + 4, w: 16, d: 6, r: 1 };
  const cr = slab(carr, 58, 14, { tone: "mid" }, { steps: 2, bevel: 0.4 });
  const nozzle = cyl(cx, gy + 7, 1.6, 40, 18, { tone: "hi", crease: "lo" }, { steps: 16 });
  const spray = `<g class="wf-spray">${L([-6, 0, 6].map((dx) => path3([[cx, gy + 7, 40], [cx + dx, gy + 7 + Math.abs(dx) * 0.2, 25 + WAFER_T]])).join(""), { tone: "mid", flow: true })}</g>`;
  put("etch", "etcher", "etch.carriage", centreOf(carr, 58), cr.svg + nozzle.svg + Dots([at([cx - 5, gy + 10, 66]), at([cx + 5, gy + 10, 66])], { size: 0.4 }) + spray, [cr.shape, nozzle.shape]);
}

// ---- double-side polisher: lower platen, sun gear, three carriers, upper platen on a lift column ----
const DSP = { c: [130, 190], r: 98 };
const PLATEN_TOP = 22;
function polisher() {
  const [cx, cy] = DSP.c;
  const base = { x: cx - 104, y: cy - 104, w: 208, d: 208, r: 10 };
  const b = slab(base, 0, 12, { tone: "mid" }, { steps: 8, bevel: 0.8, inner: L(k.sideSeam(base, 5, P, 8), { tone: "faint" }) });
  put("stand", "dsp", "stand.dsp-base", centreOf(base, 0), b.svg + screwsOn(k.corners(base, 7), 12), [b.shape], { bias: -10 });
  const platen = cyl(cx, cy, DSP.r, 12, PLATEN_TOP - 12, { tone: "mid" }, { steps: 128, bevel: 0.6, inner: L(k.sideArc(cx, cy, DSP.r, 16, P, 64), { tone: "faint" }) });
  const pins = [];
  for (let i = 0; i < 96; i++) {
    const a = (i / 96) * TAU;
    pins.push(at([cx + 94.5 * Math.cos(a), cy + 94.5 * Math.sin(a), PLATEN_TOP]));
  }
  put("stand", "dsp", "stand.dsp-platen", [cx, cy, 12], platen.svg + L(k.ring(cx, cy, 92, PLATEN_TOP, P, 128), { tone: "faint" }) + Dots(pins, { size: 0.35, tone: "lo" }), [platen.shape]);
  const sun = cyl(cx, cy, 8, PLATEN_TOP, 0.8, { tone: "mid" }, { steps: 32 });
  put("stand", "dsp", "stand.dsp-sun", [cx, cy, PLATEN_TOP], sun.svg, [sun.shape]);
  const cr = 42;
  const carriers = [Math.PI / 2 + 0.2, Math.PI / 2 + 0.2 + TAU / 3, Math.PI / 2 + 0.2 + (2 * TAU) / 3].map((a) => [cx + 51 * Math.cos(a), cy + 51 * Math.sin(a)]);
  carriers.forEach(([x, y], i) => {
    const disc = cyl(x, y, cr, PLATEN_TOP, 0.8, { tone: "lo", crease: "none" }, { steps: 80 });
    const teeth = [];
    for (let j = 0; j < 60; j++) {
      const a = (j / 60) * TAU;
      teeth.push(at([x + (cr - 0.9) * Math.cos(a), y + (cr - 0.9) * Math.sin(a), PLATEN_TOP + 0.8]));
    }
    const holes = [0, 1, 2, 3, 4, 5].map((j) => {
      const a = (j / 6) * TAU + 0.3;
      return [x + 39.6 * Math.cos(a), y + 39.6 * Math.sin(a)];
    });
    put("stand", "dsp", `stand.dsp-carrier${i}`, [x, y, PLATEN_TOP], disc.svg + Dots(teeth, { size: 0.3, tone: "mid" }) + Dots(holes.map(([hx, hy]) => at([hx, hy, PLATEN_TOP + 0.8])), { size: 0.5, tone: "lo" }), [disc.shape]);
    const w = cyl(x, y, M.R_INGOT, PLATEN_TOP + 0.8, 1.0, { tone: "hi", crease: "lo" }, { steps: 96 });
    const a0 = Math.atan2(y - cy, x - cx);
    put("stand", "wafers", `stand.dsp-wafer${i}`, [x, y, PLATEN_TOP + 1.3], w.svg + notchSvg(x, y, PLATEN_TOP + 1.8, M.R_INGOT, a0 + Math.PI) + `<g class="wf-shine">${L(path3([[x - 20, y + 14, PLATEN_TOP + 1.8], [x + 8, y - 16, PLATEN_TOP + 1.8]]), { tone: "faint", free: true })}</g>`, [w.shape]);
  });
  // lift column with its carriage and arm, and the upper platen
  const col = { x: cx - 122, y: cy - 8, w: 14, d: 16, r: 1.5 };
  const cl = slab(col, 4, 140, { tone: "mid" }, { steps: 3, bevel: 0.6, inner: L(k.sideSeam(col, 128, P, 3), { tone: "faint" }) });
  const colFoot = slab(k.insetPlan(col, -4), 0, 4, { tone: "mid" }, { steps: 3 });
  put("stand", "dsp", "stand.dsp-column", centreOf(col, 0), colFoot.svg + cl.svg + Dots([at([col.x + col.w / 2, col.y + col.d / 2, 144])], { size: 0.6 }), [colFoot.shape, cl.shape]);
  const upZ = PLATEN_TOP + 1.8; // upper platen rests on the wafers when lowered
  const car = { x: col.x + col.w, y: col.y - 2, w: 6, d: 20, r: 0.8 };
  const carS = slab(car, upZ + 22, 24, { tone: "mid" }, { steps: 2, bevel: 0.4 });
  const arm = { x: car.x + car.w, y: cy - 7, w: cx - (car.x + car.w) + 7, d: 14, r: 1.5 };
  const armS = slab(arm, upZ + 36, 9, { tone: "mid" }, { steps: 3, bevel: 0.6, inner: L(k.sideSeam(arm, upZ + 40.5, P, 3), { tone: "faint" }) });
  const hanger = cyl(cx, cy, 7, upZ + 16, 20, { tone: "mid" }, { steps: 28 });
  const hub = cyl(cx, cy, 22, upZ + 11, 5, { tone: "mid" }, { steps: 56, bevel: 0.4 });
  const top = cyl(cx, cy, DSP.r - 3, upZ, 11, { tone: "mid" }, { steps: 128, bevel: 0.8, inner: L(k.sideArc(cx, cy, DSP.r - 3, upZ + 4, P, 64), { tone: "faint" }) });
  const topLines = L([84, 62, 40].map((rr) => k.ring(cx, cy, rr, upZ + 11, P, 112)).join(""), { tone: "faint" }) + screwsOn([0, 1, 2, 3, 4, 5].map((j) => [cx + 15 * Math.cos((j / 6) * TAU), cy + 15 * Math.sin((j / 6) * TAU)]), upZ + 16, 0.9);
  put("dsp", "dsp", "dsp.upper", [cx, cy, upZ], top.svg + topLines, [top.shape]);
  put("dsp", "dsp", "dsp.hub", [cx, cy, upZ + 11], hub.svg + hanger.svg + Dots([0, 1, 2, 3, 4, 5].map((j) => at([cx + 15 * Math.cos((j / 6) * TAU), cy + 15 * Math.sin((j / 6) * TAU), upZ + 16])), { size: 0.45 }), [hub.shape, hanger.shape]);
  put("dsp", "dsp", "dsp.arm", centreOf(arm, upZ + 36), armS.svg + Dots([at([cx - 3, cy, upZ + 45]), at([cx + 3, cy, upZ + 45])], { size: 0.45 }), [armS.shape]);
  put("dsp", "dsp", "dsp.carriage", centreOf(car, upZ + 22), carS.svg + Dots([at([car.x + car.w, car.y + 3, upZ + 26]), at([car.x + car.w, car.y + car.d - 3, upZ + 26]), at([car.x + car.w, car.y + 3, upZ + 42]), at([car.x + car.w, car.y + car.d - 3, upZ + 42])], { size: 0.4 }), [carS.shape]);
}

// ---- cables: a connector shell at each end, drawn in depth-sorted chunks ----
const CABLES = [];
function cable(name, points, { r = 0.9, bend = 5 } = {}) {
  const route = G.fillet(points, bend, 12, { P, tube: r });
  const total = G.pathLength(route);
  const SHELL = 3;
  const id = R_.nameFor(name);
  CABLES.push(id);
  R_.route(id, route, r, { limp: true, gaps: [[0, SHELL], [total - SHELL, total]], rims: [r * 2, r * 2], piece: "stand" });
  Tube.tubePieces(route, r, P, { maxLength: 14, spacing: 1, gaps: [[0, SHELL], [total - SHELL, total]] }).forEach((part, index) =>
    R_.put({ piece: "stand", part: "", at: part.mid, svg: Tube.tubeSvg(part, { tone: "mid" }), move: [0, 0, 0], name: `${id}:${index}`, route: id, chunk: index, shapes: [A.tube(part.points, part.radii)] }),
  );
  [0, 1].forEach((index) => {
    const end = index ? route[route.length - 1] : route[0];
    const tangent = G.tangentAlong(route, index ? total : 0);
    const F = G.frameAlong(end, tangent);
    const [s0, s1] = index ? [-SHELL, 0] : [0, SHELL];
    const outer = index ? s0 : s1;
    const face = G.dot3(G.mul3(F.a, index ? -1 : 1), V) > 0.2 ? L(G.circleOf(F, outer, r * 1.1, P, 12), { tone: "faint" }) : "";
    R_.put({ piece: "stand", part: "", at: G.add3(end, G.mul3(tangent, (s0 + s1) / 2)), svg: S(G.disc(s0, s1, r * 2, F, P, { bevel: 0.25 }), { tone: "mid" }) + face, move: [0, 0, 0], name: `${id}.shell${index}`, shapes: [R_.solid(A.disc(F, s0, s1, r * 2, { name: `${id}.shell${index}`, owner: id }))] });
  });
}

function cables() {
  // control box to the feed motor: up the wall face, over the top edge, along the top
  cable("stand.cable-motor", [[204, WALL_FACE + 6, 166], [204, WALL_FACE + 6, 309], [204, WALL.y + 12, 309], [11, WALL.y + 12, 309]]);
  // control box down to a gland on the plinth
  const gland = cyl(204, WALL_FACE + 6, 3.2, PLINTH_TOP, 4, { tone: "mid" }, { steps: 20 });
  put("stand", "", "stand.gland", [204, WALL_FACE + 6, PLINTH_TOP], gland.svg, [gland.shape]);
  cable("stand.cable-power", [[204, WALL_FACE + 6, 120], [204, WALL_FACE + 6, PLINTH_TOP + 4]]);
}

stand();
cables();
rollers();
web();
nozzles();
head();
ingot();
spools();
edger();
etcher();
polisher();

// ---- states for the audit and the painter's keys: the real process, sampled along the slider ----
const STATES = [];
for (let i = 0; i <= 140; i++) {
  const s = i / 140;
  STATES.push({ label: `slider ${s.toFixed(3)}`, shares: M.sharesAt(s) });
}
if (!FAST) A.settle(R_, P, { states: STATES });
R_.items.sort((a, b) => a.key - b.key);

const groups = R_.items.map((item, index) => {
  const [mx, my, mz] = item.move;
  return `<g class="it" data-piece="${item.piece}" data-part="${item.part}" data-name="${item.name}" data-k="${item.key.toFixed(3)}" data-m="${mx.toFixed(1)},${my.toFixed(1)},${mz.toFixed(1)}" data-i="${index}">${item.svg}</g>`;
});
// the near half of the web inside the ingot's reach, drawn live in front of the ingot while it cuts
groups.push(`<g class="it wf-dyn" data-piece="stand" data-part="web" data-name="web.inner-right" data-k="0" data-m="0,0,0" data-live-right></g>`);

const PARTS = [
  ["ingot", "Ingot"],
  ["beam", "Beam and work plate"],
  ["web", "Wire web and guide rollers"],
  ["spools", "Spools and tension arm"],
  ["edger", "Edge grinder"],
  ["etcher", "Spin etcher"],
  ["dsp", "Double-side polisher"],
  ["wafers", "Finished wafers"],
];
const PART_SAY = {
  ingot: `${M.WAFER.diameterMm} mm × up to ${M.SAW.workLenMm} mm silicon block · ${M.WAFER.orientation} · notch marks ${M.WAFER.notchAxis}`,
  beam: "glue line, sacrificial beam, work plate and dovetail · the head feeds it down",
  web: `${M.fmt(M.SAW.wireDiaMm, 2)} mm wire wound hundreds of times round grooved rollers · ${M.SAW.tensionN[0]}–${M.SAW.tensionN[1]} N`,
  spools: `${M.SAW.wireStoreKm} km of wire on the supply spool · a dancer arm holds the tension`,
  edger: "a grooved profile wheel rounds the wafer edge",
  etcher: "spin chuck under a nozzle: chemicals strip the damaged layer",
  dsp: "lower and upper platens with pads · planetary carriers hold the wafers",
  wafers: `${M.WAFER.diameterMm} mm · ${M.WAFER.thicknessUm} µm · both faces mirror polished`,
};

const LABEL = `A multi-wire saw slicing a ${M.WAFER.diameterMm} mm silicon ingot, with the steps that turn the slices into polished wafers. At the back, a spindle wall carries three grooved guide rollers with a web of wire wound round them, a supply spool with a dancer arm and guide pulleys, and a feed head on rails that lowers the ingot, glued to a beam on a work plate, down through the web between two slurry nozzles. A take-up spool stands at the near end. In front: an edge grinder with a profile wheel on a slide, a spin etcher under a nozzle gantry, and a double-side polisher with three planetary carriers under an upper platen on a lift column. A ruler runs along the front of the bed.`;
const svg = k.figureSvg({ width: W, height: H, label: LABEL, body: [`<g class="wf-layers">${groups.join("")}</g>`], className: "wf-svg" });

const unit = (vector) => {
  const o = at([0, 0, 0]);
  const p = at(vector);
  return [p[0] - o[0], p[1] - o[1]];
};
const DATA = {
  P,
  V,
  EX: unit([1, 0, 0]),
  EY: unit([0, 1, 0]),
  EZ: unit([0, 0, 1]),
  keys: M.KEYS,
  pieces: M.PIECE_IDS,
  steps: M.STEPS.map(({ id, name, part, say }) => ({ id, name, part, say })),
  parts: Object.fromEntries(PARTS.map(([id, name]) => [id, { name, say: PART_SAY[id] }])),
  order: PARTS.map(([id]) => id),
  idle: M.IDLE,
  web: { ys: WIRE_Y, zw: ZW, inner: INNER, r: R, zc0: ZC0, li: LI, glue: 6, feed: M.FEED },
};

const PART_BUTTONS = PARTS.map(([id, name], index) => `<button type="button" class="wf-part" data-part="${id}"><span class="wf-num">${String(index + 1).padStart(2, "0")}</span>${name}</button>`).join("");
const corners = `<div class="iso-plate-corners" aria-hidden="true"><span class="iso-plate-corner" data-corner="fig">Fig 3</span><span class="iso-plate-corner" data-corner="title">Multi-wire saw · wafering</span><span class="iso-plate-corner" data-corner="readout" data-readout>${M.IDLE}</span></div>`;
const controls = `<div class="wf-controls"><span class="wf-hint">Hover a part · Space plays the process</span><span class="wf-live" aria-live="polite" data-live></span></div>`;
const stage = `<div class="wf-stage" tabindex="0" role="slider" aria-label="Multi-wire saw and wafer finishing. Hover, or use the arrow keys, to pick a part; Space plays or pauses the process; Escape returns to the start; the slider below steps through the process." aria-valuemin="0" aria-valuemax="${PARTS.length}" aria-valuenow="0" aria-valuetext="${M.IDLE}">${svg}</div>`;
const caption = `A slurry multi-wire saw of the kind that slices ${M.WAFER.diameterMm} mm silicon (Komatsu NTC's MWM3050NQ takes a block up to ${M.SAW.workDiaMm} mm across and ${M.SAW.workLenMm} mm long and runs ${M.fmt(M.SAW.wireDiaMm, 2)} mm wire at up to ${M.fmt(M.SAW.wireSpeedMMin)} m/min under ${M.SAW.tensionN[0]}–${M.SAW.tensionN[1]} N, from ${M.SAW.wireStoreKm} km on the supply spool). One wire is wound hundreds of times round grooved guide rollers to make the web; the head feeds the glued ingot down through it at ${M.SAW.feedMmMin[0]}–${M.SAW.feedMmMin[1]} mm/min, so even at the top rate a ${M.WAFER.diameterMm} mm cut takes at least ${M.minCutMin} minutes. Drawn here: one wire for roughly every ${M.perDrawnWire} real ones, spaced end to end along the block so the nearest runs across its end face, and wafer thickness exaggerated about six times. The ingot, wafers and ruler (10 mm ticks) are to scale; machine sizes, the three-roller layout and the finishing stations are illustrative. The finished wafer: ${M.WAFER.diameterMm} ± ${M.WAFER.diameterTolMm} mm, ${M.WAFER.thicknessUm} ± ${M.WAFER.thicknessTolUm} µm thick, a ${M.fmt(M.WAFER.notchDepthMm, 1)} mm notch, both faces polished.`;
const scrub = `<span class="wf-scrub"><button type="button" class="wf-play" data-play aria-label="Play the process"><span class="wf-play-icon" aria-hidden="true"></span><span data-play-text>Play</span></button><input type="range" class="wf-range" data-scrub min="0" max="1000" step="1" value="0" aria-label="Process: 0 is the raw ingot, 1000 is the finished wafer"><span class="wf-step" data-step>01 · ${M.STEPS[0].name}</span></span>`;
const body = `<figure class="iso-figure wf"><div class="iso-plate">${corners}${stage}${controls}</div><figcaption class="iso-legend">${scrub}<span class="wf-parts">${PART_BUTTONS}</span><span class="iso-caption">${caption}</span></figcaption></figure>`;

const CSS = readFileSync(join(HERE, "wafering.css"), "utf8");
const LIVE = readFileSync(join(HERE, "live.js"), "utf8").replace("__DATA__", JSON.stringify(DATA));
const out = writeChapter({ slug: "wafering", figure: body, css: CSS, script: kitScript() + LIVE, lesson: LESSON });
console.log("wrote", out.file, `${out.kb} KB`, `${R_.items.length} items`, `${R_.solids.length} solids`);

A.auditOrExit(R_, P, { frames: STATES, apart: false });
