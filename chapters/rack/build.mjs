// A GB200 NVL72 compute tray on its slide rails at a slice of the rack, beside a scale model of the whole rack.
// The slider assembles it: packages onto the boards, cold plates down, lid on, tray slides in, coolant flows, NVLink connects.
// node build.mjs [--fast] [--audit]
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as M from "./model.mjs";

import { k, G, A, Tube } from "../../site/kit.mjs";
import { writeChapter } from "../../site/shell.mjs";
import { LESSON } from "./lesson.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

// ---- world layout: x across the tray, y front (+) to back (−), z up; 1 unit = 2 mm on the tray ----
const W = 760;
const H = 650;
const AZIMUTH = 52;
const ELEVATION = 38;

const BASE = { x: -208, y: -228, w: 360, d: 486, r: 10 };
const BASE_H = 10;
const FOOT_H = 6;

const TRAY = { x: -110, y: -150, w: 220, d: 300, r: 1.2 };
const T0 = 4; // tray floor bottom, on the rails
const FLOOR = 5.5;
const TOP = T0 + M.U_UNITS; // 1U tall: 26.2
const WALL = 2;
const MID_Y = 16; // cross wall the lid's back edge rests on

const SLIDE = [0, 90, 0]; // the tray starts pulled out along its rails
const PIECES = {
  lid: { move: [0, 0, 46] },
  plates: { move: [0, 0, 74] },
  pkg: { move: [0, 0, 36] },
};
const STAGGER = ["lid", "plates", "pkg"];
const SPRING = { stagger: 0.05, stiffness: 64, damping: 17, substeps: 4 };

// boards, packages and plates (left board; the right one mirrors in x)
const BOARD = { x: -104, y: -128, w: 98, d: 142, r: 1.5 };
const PCB_Z = 7;
const PCB_TOP = 8.6;
const SUB_TOP = 10.2;
const CHIP_TOP = 12;
const PLATE_TOP = 18;
const GPU_C = [[-79, -99], [-31, -99]];
const GRACE_C = [-55, -30];
const BAR = { x: -63, y: -121, w: 16, d: 104, r: 1.5 };
const BAR_TOP = 23;
const FIT_TOP = 25;

// tray manifold block at the rear centre, and the rack slot fixture behind the tray
const TMAN = { x: -26, y: -148, w: 52, d: 17, r: 1.2 };
const TMAN_TOP = 16;
const UQD_X = [-11, 11];
const UQD_Z = 15;
const SILL = { x: -134, y: -222, w: 268, d: 58, r: 2 };
const SILL_TOP = 6;
const BEAM = { x: -134, y: -222, w: 268, d: 46, r: 2 };
const BEAM_Z = 80;
const BEAM_TOP = 88;
const PIPE_Y = -190;
const BALL_R = 7;
const CART = { x: -112, y: -206, w: 70, d: 26, r: 1.2 };
const NV_X = [-104, -88, -72, -56];
const BUS = { x: 74, y: -197, w: 12, d: 6, r: 0.6 };

// the scale model of the whole rack: 1U = 4.4 units here
const MINI_U = 4.4;
const MINI = { x: -196, y: -160, w: 54, d: 108, r: 1 };
const MINI_IN = { x: MINI.x + 4, y: MINI.y + 1, w: MINI.w - 8, d: MINI.d - 2, r: 0.4 };
const MINI_Z = 6;
const MINI_SLOTS = [];
M.RACK.layout.forEach((count, block) => {
  for (let i = 0; i < count; i++) MINI_SLOTS.push(block === 0 || block === 4 ? "power" : block === 2 ? "switch" : "compute");
});
const OURS = M.RACK.layout[4] + M.RACK.layout[3] + M.RACK.layout[2] + 6; // slot index from the bottom: the 7th tray of the upper compute block
MINI_SLOTS.reverse(); // the list runs top to bottom; slots count from the bottom
const MINI_TOP = MINI_Z + MINI_SLOTS.length * MINI_U;
const MINI_SLIDE = [0, 30, 0];

const P = k.fitProjection(
  [
    ...k.boxCorners(BASE, -BASE_H - FOOT_H, 0),
    ...k.boxCorners(BEAM, 0, BEAM_TOP),
    ...k.boxCorners(MINI, 0, MINI_TOP + 4),
    ...k.boxCorners({ ...TRAY, y: TRAY.y + SLIDE[1] }, 0, 42 + PIECES.plates.move[2]),
  ],
  W,
  H,
  { pad: 26, azimuth: AZIMUTH, elevation: ELEVATION },
);
const V = G.viewOf(P);
const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);
const centreOf = (plan, z) => [plan.x + plan.w / 2, plan.y + plan.d / 2, z];
const mirror = (plan) => ({ ...plan, x: -plan.x - plan.w });
const poly = (points) => `M${points.map((p) => at(p).map((v) => v.toFixed(1)).join(" ")).join("L")}Z`;
const faceRect = (x0, x1, y, z0, z1) => poly([[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]]);
const sideRect = (x, y0, y1, z0, z1) => poly([[x, y0, z0], [x, y1, z0], [x, y1, z1], [x, y0, z1]]);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));

// ---- recorder ----
const R = A.recorder(P, { order: STAGGER, spring: SPRING });
const ZERO = [0, 0, 0];
function put(piece, group, ref, svg, shapes, { bias = 0, name, slide = false, flow = null, owner, route, chunk } = {}) {
  const id = name ?? R.nameFor(`${group}.item`);
  shapes.forEach((shape) => {
    shape.name = shape.name ?? id;
    if (owner) shape.owner = owner;
  });
  R.put({ piece, group, at: ref, bias, svg, move: PIECES[piece]?.move ?? ZERO, shapes: shapes.map(R.solid), name: id, slide: slide === true ? SLIDE : slide || ZERO, flow, route, chunk });
}
const slab = (plan, z, h, steps = 3) => A.slab(plan, z, h, {}, steps);
const cyl = (x, y, r, z, h) => A.cylinder(x, y, r, z, h, {});
const box = (plan, z, h, tone = "mid", { bevel = 0.4, steps = 3, inner = "", crease } = {}) => S(k.slabOf(plan, z, h, P, steps, bevel), { tone, inner, ...(crease ? { crease } : {}) });

// ---- stand: base plate, feet, slide rails with stops, ruler and label plate ----
function stand() {
  const out = [`<path class="iso-halo" d="${k.haloOf(BASE, -BASE_H - FOOT_H, BASE_H, P)}"/>`];
  const shapes = [];
  for (const [x, y] of byDepth(k.corners(BASE, 28))) {
    out.push(S(k.cylinder(x, y, 9, -BASE_H - FOOT_H, 1.8, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 7, -BASE_H - FOOT_H + 1.8, FOOT_H - 1.8, P, 28), { tone: "mid" }));
    shapes.push(A.cylinder(x, y, 9, -BASE_H - FOOT_H, FOOT_H, { name: "stand.foot" }));
  }
  out.push(S(k.slabOf(BASE, -BASE_H, BASE_H, P, 8, 1.6), { tone: "mid", inner: L(k.sideSeam(BASE, -BASE_H + 3, P, 8), { tone: "faint" }) }));
  shapes.push(A.slab(BASE, -BASE_H, BASE_H, { name: "stand.plate" }));
  out.push(L(k.planOutline(k.insetPlan(BASE, 6), 0, P, 8), { tone: "lo" }));
  const screws = k.corners(BASE, 13);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.6, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(Dots(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // ruler along the near edge: ticks every 10 mm (5 units), majors every 50 mm
  const strip = { x: -190, y: BASE.y + BASE.d - 19, w: 320, d: 9, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 5, strip.x + strip.w - 5, 5, 5, strip.y + 0.8, 0.6, [2.4, 4.4], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(Dots([at([strip.x + 2.4, strip.y + 4.5, 0.6]), at([strip.x + strip.w - 2.4, strip.y + 4.5, 0.6])], { size: 0.45 }));
  // label plate in the free corner
  const label = { x: -196, y: 150, w: 72, d: 22, r: 1.6 };
  out.push(S(k.slabOf(label, 0, 0.8, P, 4), { tone: "lo", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(label, 2), 0.8, P, 4), { tone: "faint" }));
  out.push(L([0, 1, 2].map((i) => k.lineOnTop([label.x + 9, label.y + 6 + i * 4.5], [label.x + 54 - i * 14, label.y + 6 + i * 4.5], 0.8, P)).join(""), { tone: "lo", free: true }));
  out.push(Dots([at([label.x + 4.5, label.y + label.d / 2, 0.8]), at([label.x + label.w - 4.5, label.y + label.d / 2, 0.8])], { size: 0.45 }));
  put("stand", "stand", [0, 0, -2], out.join(""), shapes, { name: "stand.base", bias: -900 });

  // two slide rails under the tray, screwed down, with end stops at the front
  for (const x of [-86, 74]) {
    const rail = { x, y: -160, w: 12, d: 398, r: 1 };
    let svg = box(rail, 0, T0, "mid", { bevel: 0.4 });
    svg += L(k.planOutline(k.insetPlan(rail, 2.6), T0, P, 2), { tone: "faint" });
    const holes = [];
    for (let y = rail.y + 14; y < rail.y + rail.d - 10; y += 36) holes.push([x + 6, y]);
    svg += L(holes.map(([hx, hy]) => k.ring(hx, hy, 1.5, T0, P, 12)).join(""), { tone: "lo" }) + Dots(holes.map(([hx, hy]) => at([hx, hy, T0])), { size: 0.4 });
    put("stand", "rack", [x + 6, 60, 2], svg, [slab(rail, 0, T0, 3)], { name: R.nameFor("stand.rail"), bias: -400 });
    const stop = { x: x - 2, y: rail.y + rail.d, w: 16, d: 6, r: 1 };
    put("stand", "rack", centreOf(stop, 5), box(stop, 0, 10, "mid", { bevel: 0.4 }) + Dots([at([x + 2, stop.y + 3, 10]), at([x + 10, stop.y + 3, 10])], { size: 0.45 }), [slab(stop, 0, 10, 3)], { name: R.nameFor("stand.stop") });
  }
}

// ---- the rack slot fixture: sill, posts, beam, manifold, bus bar, NVLink cartridge ----
function fixture() {
  put("stand", "rack", centreOf(SILL, 3), box(SILL, 0, SILL_TOP, "mid", { bevel: 0.6, steps: 4, inner: L(k.sideSeam(SILL, 2, P, 4), { tone: "faint" }) }) + Dots(k.corners(SILL, 6).map(([x, y]) => at([x, y, SILL_TOP])), { size: 0.5 }), [A.slab(SILL, 0, SILL_TOP, { name: "stand.sill" }, 4)], { name: "stand.sill", bias: -300 });
  for (const x of [-134, 124]) {
    const post = { x, y: -222, w: 10, d: 10, r: 0.8 };
    const holes = [];
    for (let z = 12; z < BEAM_Z - 4; z += M.U_UNITS / 3) holes.push(z);
    const face = holes.map((z) => sideRect(x + 10, -219.5, -217, z - 1, z + 1)).join("");
    const svg = box(post, SILL_TOP, BEAM_Z - SILL_TOP, "mid", { bevel: 0.4 }) + L(face, { tone: "lo" });
    put("stand", "rack", [x + 5, -217, 40], svg, [slab(post, SILL_TOP, BEAM_Z - SILL_TOP)], { name: R.nameFor("stand.post") });
  }
  const beamSvg = box(BEAM, BEAM_Z, BEAM_TOP - BEAM_Z, "mid", { bevel: 0.6, steps: 4, inner: L(k.sideSeam(BEAM, BEAM_Z + 3, P, 4), { tone: "faint" }) });
  const beamScrews = [-129, -100, -60, -11, 11, 60, 80, 129].map((x) => [x, -199]);
  put("stand", "rack", centreOf(BEAM, BEAM_Z), beamSvg + Dots(beamScrews.map(([x, y]) => at([x, y, BEAM_TOP])), { size: 0.45 }) + L(k.planOutline(k.insetPlan(BEAM, 4), BEAM_TOP, P, 4), { tone: "faint" }), [A.slab(BEAM, BEAM_Z, BEAM_TOP - BEAM_Z, { name: "stand.beam" }, 4)], { name: "stand.beam" });

  // vertical manifold pipes: supply and return, each with a tee ball and a blind-mate UQD socket at tray height
  UQD_X.forEach((x, index) => {
    const owner = `manifold.pipe${index}`;
    const ballC = [x, PIPE_Y, UQD_Z];
    const rimZ = UQD_Z + Math.sqrt(BALL_R ** 2 - 4.5 ** 2);
    const pedZ = UQD_Z - Math.sqrt(BALL_R ** 2 - 5 ** 2);
    put("manifold", "manifold", [x, PIPE_Y, 8], S(k.cylinder(x, PIPE_Y, 8, SILL_TOP, 1.6, P, 32), { tone: "mid" }) + S(k.cylinder(x, PIPE_Y, 5, SILL_TOP + 1.6, pedZ - SILL_TOP - 1.6, P, 28), { tone: "mid" }), [cyl(x, PIPE_Y, 8, SILL_TOP, 1.6), cyl(x, PIPE_Y, 5, SILL_TOP + 1.6, pedZ - SILL_TOP - 1.6)], { name: `${owner}.foot`, owner });
    put("manifold", "manifold", ballC, S(G.sphereOf(ballC, BALL_R, P, { steps: 40 }), { tone: "hi" }), [A.ball(ballC, BALL_R, {})], { name: `${owner}.tee`, owner });
    const flowLine = [[x, PIPE_Y, rimZ + 1], [x, PIPE_Y, BEAM_Z - 4]];
    put("manifold", "manifold", [x, PIPE_Y, (rimZ + BEAM_Z) / 2], S(k.cylinder(x, PIPE_Y, 4.5, rimZ, BEAM_Z - 3 - rimZ, P, 32), { tone: "hi", crease: "lo", inner: L([40, 62].map((z) => k.sideArc(x, PIPE_Y, 4.5, z, P, 20)).join(""), { tone: "faint" }) }), [cyl(x, PIPE_Y, 4.5, rimZ, BEAM_Z - 3 - rimZ)], { name: `${owner}.pipe`, owner, flow: { pts: flowLine, dir: index ? 1 : -1, kind: index ? "return" : "supply", stage: 4 } });
    put("manifold", "manifold", [x, PIPE_Y, BEAM_Z - 1.5], S(k.cylinder(x, PIPE_Y, 8, BEAM_Z - 3, 3, P, 32, 0.3), { tone: "mid" }) + Dots(G.dotsOf(G.frameAlong([x, PIPE_Y, BEAM_Z - 3], [0, 0, 1]), 0, 6.2, 6, P, { all: true }), { size: 0.38 }), [cyl(x, PIPE_Y, 8, BEAM_Z - 3, 3)], { name: `${owner}.flange`, owner });
    // socket: a turned body along +y from the ball rim to the coupler face at y = −160
    const F = G.frameAlong([x, PIPE_Y, UQD_Z], [0, 1, 0]);
    const rimS = Math.sqrt(BALL_R ** 2 - 4 ** 2);
    const prof = [[rimS, 4], [16, 4], [16, 6.6], [21, 6.6], [21, 5.4], [30, 5.4]];
    put("manifold", "manifold", [x, PIPE_Y + 20, UQD_Z], S(G.solidOf(prof, F, P, { steps: 40 }), { tone: "hi", inner: L(G.arcOf(F, 25.5, 5.4, P), { tone: "faint" }) }), [A.solid(F, prof, {})], { name: `${owner}.socket`, owner });
  });

  // the bus bar: one copper bar, sill to beam, on two insulator blocks
  for (const z of [SILL_TOP, BEAM_Z - 6]) {
    const block = { x: BUS.x - 3, y: BUS.y - 6, w: BUS.w + 6, d: 6, r: 0.6 };
    put("busbar", "busbar", centreOf(block, z + 3), box(block, z, 6, "lo"), [slab(block, z, 6)], { name: R.nameFor("busbar.insulator") });
  }
  const busInner = L([20, 40, 60].map((z) => k.sideSeam(BUS, z, P, 2)).join(""), { tone: "faint" });
  put("busbar", "busbar", centreOf(BUS, 40), box(BUS, SILL_TOP, BEAM_Z - SILL_TOP, "hi", { bevel: 0.3, steps: 2, inner: busInner, crease: "lo" }), [slab(BUS, SILL_TOP, BEAM_Z - SILL_TOP, 2)], { name: "busbar.bar" });

  // NVLink cartridge: a tall box of copper cables, with four blind-mate receptacles facing the tray
  const cables = [];
  for (let x = CART.x + 3; x < CART.x + CART.w - 1; x += 3.2) cables.push(k.segment([x, CART.y + CART.d, SILL_TOP], [x, CART.y + CART.d, BEAM_Z], P));
  const cartInner = L(cables.join(""), { tone: "faint" });
  const cartFace = CART.y + CART.d;
  const pulses = NV_X.map((x) => [[x, cartFace, 23], [x, cartFace, BEAM_Z - 1]]);
  put("spine", "spine", centreOf(CART, 40), box(CART, SILL_TOP, BEAM_Z - SILL_TOP, "mid", { bevel: 0.4, steps: 2, inner: cartInner }), [slab(CART, SILL_TOP, BEAM_Z - SILL_TOP, 2)], { name: "spine.cartridge", flow: { lines: pulses, dir: 1, kind: "nvlink", stage: 5 } });
  NV_X.forEach((x) => {
    const rec = { x: x - 6, y: CART.y + CART.d, w: 12, d: 18, r: 0.6 };
    const face = faceRect(x - 4, x + 4, rec.y + rec.d, 10.5, 19.5);
    put("spine", "spine", centreOf(rec, 15), box(rec, 8, 14, "hi", { bevel: 0.3, crease: "lo" }) + L(face, { tone: "lo" }) + Dots([at([x - 3.5, rec.y + 9, 22]), at([x + 3.5, rec.y + 9, 22])], { size: 0.4 }), [slab(rec, 8, 14)], { name: R.nameFor("spine.receptacle") });
  });
}

// ---- the tray chassis: floor, walls, cross wall, front panel with ports and ears ----
function chassis() {
  const floor = S(k.slabOf(TRAY, T0, FLOOR - T0, P, 2, 0.3), { tone: "mid" });
  const rivets = [];
  for (let y = TRAY.y + 12; y < TRAY.y + TRAY.d - 6; y += 24) rivets.push(at([TRAY.x + TRAY.w - 4, y, FLOOR]));
  put("stand", "lid", centreOf(TRAY, T0), floor + Dots(rivets, { size: 0.35, tone: "lo" }), [slab(TRAY, T0, FLOOR - T0, 2)], { name: "tray.floor", slide: true, bias: -200 });
  const walls = [
    { plan: { x: TRAY.x, y: TRAY.y, w: WALL, d: TRAY.d - 4, r: 0.3 }, name: "tray.wallL" },
    { plan: { x: TRAY.x + TRAY.w - WALL, y: TRAY.y, w: WALL, d: TRAY.d - 4, r: 0.3 }, name: "tray.wallR" },
    { plan: { x: TRAY.x + WALL, y: TRAY.y, w: TRAY.w - 2 * WALL, d: WALL, r: 0.2 }, name: "tray.wallB" },
    { plan: { x: TRAY.x + WALL, y: MID_Y, w: TRAY.w - 2 * WALL, d: WALL, r: 0.2 }, name: "tray.wallM" },
  ];
  for (const { plan, name } of walls) {
    let extra = "";
    if (name === "tray.wallR") {
      // vent slots on the near side wall, in front of the boards
      const slots = [];
      for (let y = -118; y < 4; y += 9) slots.push(sideRect(plan.x + plan.w, y, y + 5, 10, 21));
      extra = L(slots.join(""), { tone: "lo" });
    }
    put("stand", "lid", centreOf(plan, FLOOR), box(plan, FLOOR, TOP - FLOOR, "mid", { bevel: 0.2, steps: 2 }) + extra, [slab(plan, FLOOR, TOP - FLOOR, 2)], { name, slide: true });
  }
  // front panel: 4 OSFP cages (ConnectX-7), 2 dual BlueField-3 cages, 4 E1.S bays, a pull handle and RJ45s
  const FP = { x: TRAY.x, y: TRAY.y + TRAY.d - 4, w: TRAY.w, d: 4, r: 0.4 };
  const fy = FP.y + FP.d;
  const ports = [];
  [12, 34, 56, 78].forEach((x) => ports.push(faceRect(x, x + 16, fy, 9, 21), faceRect(x + 2.5, x + 13.5, fy, 11.5, 18.5)));
  [-48, -26].forEach((x) => ports.push(faceRect(x, x + 18, fy, 8, 23), faceRect(x + 2, x + 16, fy, 10, 14.5), faceRect(x + 2, x + 16, fy, 16.5, 21)));
  [-102, -91, -80, -69].forEach((x) => ports.push(faceRect(x, x + 9, fy, 7.5, 23.5), faceRect(x + 2, x + 7, fy, 20, 21.6)));
  ports.push(faceRect(-4, 6, fy, 9, 17), faceRect(96, 104, fy, 9, 17));
  const vents = [];
  for (let x = -102; x < -64; x += 4) vents.push(faceRect(x, x + 2, fy, 24.2, 25.4));
  put("stand", "lid", centreOf(FP, FLOOR), box(FP, FLOOR, TOP - FLOOR, "mid", { bevel: 0.3, steps: 2 }) + L(ports.join(""), { tone: "lo" }) + L(vents.join(""), { tone: "faint" }), [slab(FP, FLOOR, TOP - FLOOR, 2)], { name: "tray.front", slide: true });
  // rack ears with captive thumb screws
  for (const side of [-1, 1]) {
    const ear = side < 0 ? { x: TRAY.x - 7, y: FP.y, w: 7, d: 4, r: 0.4 } : { x: TRAY.x + TRAY.w, y: FP.y, w: 7, d: 4, r: 0.4 };
    const cx = ear.x + ear.w / 2;
    const F = G.frameAlong([cx, fy, 15], [0, 1, 0]);
    const prof = [[0, 2.4], [2, 2.4], [2, 3.2], [7, 3.2]];
    const knurl = G.ribsOf(F, 2, 7, 3.2, 18, P, { fade: [0.1, 0.55], seams: "last" });
    const svg = box(ear, T0, TOP - T0, "mid", { bevel: 0.3, steps: 2 }) + S(G.solidOf(prof, F, P, { steps: 28 }), { tone: "hi", crease: "lo" }) + k.fadedSvg(knurl, { tone: "lo" }) + L(G.circleOf(F, 7, 1.4, P, 16), { tone: "lo" });
    put("stand", "lid", [cx, fy + 2, 15], svg, [slab(ear, T0, TOP - T0, 2), A.solid(F, prof, {})], { name: R.nameFor("tray.ear"), slide: true });
  }
}

// ---- inside the tray, static: boards, DC-SCM, fans, NICs, E1.S cage, manifold block, rear plugs ----
function inside() {
  for (const side of [-1, 1]) {
    const flip = (plan) => (side < 0 ? plan : mirror(plan));
    const fx = (x) => (side < 0 ? x : -x);
    const board = flip(BOARD);
    const parts = [];
    const shapes = [];
    const offs = k.corners(board, 5);
    for (const [x, y] of byDepth(offs)) {
      parts.push(S(k.cylinder(x, y, 2.2, FLOOR, PCB_Z - FLOOR, P, 16), { tone: "mid" }));
      shapes.push(cyl(x, y, 2.2, FLOOR, PCB_Z - FLOOR));
    }
    parts.push(box(board, PCB_Z, PCB_TOP - PCB_Z, "lo", { bevel: 0.3, steps: 2 }));
    shapes.push(slab(board, PCB_Z, PCB_TOP - PCB_Z, 2));
    parts.push(Dots(offs.map(([x, y]) => at([x, y, PCB_TOP])), { size: 0.45 }));
    parts.push(L(offs.map(([x, y]) => k.ring(x, y, 1.8, PCB_TOP, P, 12)).join(""), { tone: "faint" }));
    // footprints the packages land on
    for (const [cx, cy] of [...GPU_C, GRACE_C]) {
      const big = cx !== GRACE_C[0] || cy !== GRACE_C[1];
      const hw = big ? 21 : 14;
      const hd = big ? 23 : 14;
      parts.push(L(k.planOutline({ x: fx(cx) - hw - 1, y: cy - hd - 1, w: 2 * hw + 2, d: 2 * hd + 2, r: 0.5 }, PCB_TOP, P, 2), { tone: "faint" }));
    }
    put("stand", "lid", centreOf(board, PCB_Z), parts.join(""), shapes, { name: `tray.board${side}`, slide: true, bias: -50 });
    // LPDDR5X beside each Grace and a row of VRM inductors along the board's front edge
    const mem = [];
    for (const dx of [-25, 18]) for (let i = 0; i < 4; i++) mem.push({ x: fx(GRACE_C[0] + dx) - (side < 0 ? 0 : 7), y: GRACE_C[1] - 15 + i * 7.6, w: 7, d: 6, r: 0.3 });
    const memSorted = [...mem].sort((a, b) => k.depthOf(centreOf(a, 9), P) - k.depthOf(centreOf(b, 9), P));
    put("stand", "lid", [fx(GRACE_C[0]), GRACE_C[1], 9], memSorted.map((m) => box(m, PCB_TOP, 1.4, "mid", { bevel: 0, steps: 2 })).join(""), mem.map((m) => slab(m, PCB_TOP, 1.4, 2)), { name: `tray.lpddr${side}`, slide: true });
    const vrm = [];
    for (let x = -98; x <= -16; x += 9) vrm.push({ x: fx(x) - (side < 0 ? 0 : 6), y: 2, w: 6, d: 6, r: 0.4 });
    const vrmSorted = [...vrm].sort((a, b) => k.depthOf(centreOf(a, 9), P) - k.depthOf(centreOf(b, 9), P));
    put("stand", "lid", [fx(-57), 5, 10], vrmSorted.map((m) => box(m, PCB_TOP, 4, "mid", { bevel: 0.3, steps: 2 }) + L(k.planOutline(k.insetPlan(m, 1.4), PCB_TOP + 4, P, 2), { tone: "faint" })).join(""), vrm.map((m) => slab(m, PCB_TOP, 4, 2)), { name: `tray.vrm${side}`, slide: true });
  }
  // fans in front of the cross wall: they move air over the NICs and drives, which are not liquid-cooled
  const fans = [-80, -40, 0, 40, 80].map((cx) => ({ x: cx - 9, y: 20, w: 18, d: 14, r: 1 }));
  for (const fan of byDepth(fans.map((f) => [f.x + 9, f.y + 7])).map(([x]) => fans.find((f) => f.x + 9 === x))) {
    const cx = fan.x + 9;
    const face = fan.y + fan.d;
    const svg = box(fan, FLOOR, 18, "mid", { bevel: 0.3, steps: 2 }) + L(k.sideRing([cx, face, FLOOR + 9], 7.4, "y", P, 36), { tone: "lo" }) + L(k.sideRing([cx, face, FLOOR + 9], 2.4, "y", P, 20), { tone: "lo" }) + Dots([at([fan.x + 2, face, FLOOR + 2]), at([fan.x + 16, face, FLOOR + 16])], { size: 0.38 }) + L(k.ring(cx, fan.y + 7, 5.6, FLOOR + 18, P, 28), { tone: "faint" });
    put("stand", "lid", [cx, fan.y + 7, FLOOR + 9], svg, [slab(fan, FLOOR, 18, 2)], { name: R.nameFor("tray.fan"), slide: true });
  }
  // ConnectX-7 cards: PCB on standoffs with a finned heatsink, behind their OSFP cages
  [12, 34, 56, 78].forEach((x, i) => {
    const pcb = { x: x - 1, y: 66, w: 18, d: 78, r: 0.6 };
    const sink = { x: x + 1, y: 84, w: 14, d: 22, r: 0.6 };
    const cage = { x, y: 128, w: 16, d: 16, r: 0.4 };
    const fins = [];
    for (let fy = sink.y + 2; fy < sink.y + sink.d - 1; fy += 2.4) fins.push(k.lineOnTop([sink.x, fy], [sink.x + sink.w, fy], 15.5, P));
    const svg = box(pcb, 7, 1.4, "lo", { bevel: 0, steps: 2 }) + box(sink, 8.4, 7.1, "mid", { bevel: 0, steps: 2, inner: "" }) + L(fins.join(""), { tone: "lo" }) + box(cage, 8.4, 12.6, "mid", { bevel: 0.3, steps: 2 }) + Dots([at([pcb.x + 2, pcb.y + 3, 8.4]), at([pcb.x + pcb.w - 2, pcb.y + 3, 8.4])], { size: 0.38 });
    const posts = [cyl(pcb.x + 4, pcb.y + 10, 1.4, FLOOR, 1.5), cyl(pcb.x + pcb.w - 4, pcb.y + 10, 1.4, FLOOR, 1.5)];
    put("stand", "lid", [x + 8, 100, 10], S(k.cylinder(pcb.x + 4, pcb.y + 10, 1.4, FLOOR, 1.5, P, 12), { tone: "mid" }) + S(k.cylinder(pcb.x + pcb.w - 4, pcb.y + 10, 1.4, FLOOR, 1.5, P, 12), { tone: "mid" }) + svg, [...posts, slab(pcb, 7, 1.4, 2), slab(sink, 8.4, 7.1, 2), slab(cage, 8.4, 12.6, 2)], { name: `tray.cx7_${i}`, slide: true });
  });
  // BlueField-3 DPUs: two cards with a larger heatsink
  [-48, -26].forEach((x, i) => {
    const pcb = { x: x - 1, y: 40, w: 20, d: 104, r: 0.6 };
    const sink = { x: x + 1, y: 60, w: 16, d: 30, r: 0.6 };
    const cage = { x, y: 124, w: 18, d: 20, r: 0.4 };
    const fins = [];
    for (let fy = sink.y + 2; fy < sink.y + sink.d - 1; fy += 2.4) fins.push(k.lineOnTop([sink.x, fy], [sink.x + sink.w, fy], 17.5, P));
    const svg = S(k.cylinder(pcb.x + 4, pcb.y + 8, 1.4, FLOOR, 1.5, P, 12), { tone: "mid" }) + S(k.cylinder(pcb.x + pcb.w - 4, pcb.y + 8, 1.4, FLOOR, 1.5, P, 12), { tone: "mid" }) + box(pcb, 7, 1.4, "lo", { bevel: 0, steps: 2 }) + box(sink, 8.4, 9.1, "mid", { bevel: 0, steps: 2 }) + L(fins.join(""), { tone: "lo" }) + box(cage, 8.4, 15, "mid", { bevel: 0.3, steps: 2 });
    put("stand", "lid", [x + 9, 90, 10], svg, [cyl(pcb.x + 4, pcb.y + 8, 1.4, FLOOR, 1.5), cyl(pcb.x + pcb.w - 4, pcb.y + 8, 1.4, FLOOR, 1.5), slab(pcb, 7, 1.4, 2), slab(sink, 8.4, 9.1, 2), slab(cage, 8.4, 15, 2)], { name: `tray.bf3_${i}`, slide: true });
  });
  // E1.S cage with four drive sleds, and the DC-SCM management card behind it
  const cageP = { x: -104, y: 92, w: 46, d: 54, r: 0.6 };
  const sleds = [];
  for (let i = 0; i < 4; i++) sleds.push(k.lineOnTop([-102 + i * 11 + 10.5, cageP.y], [-102 + i * 11 + 10.5, cageP.y + cageP.d], TOP - 1.5, P));
  put("stand", "lid", centreOf(cageP, 14), box(cageP, FLOOR, TOP - 1.5 - FLOOR, "mid", { bevel: 0.3, steps: 2 }) + L(sleds.join(""), { tone: "lo" }) + Dots([at([cageP.x + 3, cageP.y + 4, TOP - 1.5]), at([cageP.x + cageP.w - 3, cageP.y + 4, TOP - 1.5])], { size: 0.4 }), [slab(cageP, FLOOR, TOP - 1.5 - FLOOR, 2)], { name: "tray.e1s", slide: true });
  const scm = { x: -104, y: 40, w: 46, d: 44, r: 0.6 };
  const chip = { x: -92, y: 52, w: 14, d: 14, r: 0.4 };
  const chip2 = { x: -72, y: 50, w: 8, d: 10, r: 0.3 };
  put("stand", "lid", centreOf(scm, 8), S(k.cylinder(scm.x + 5, scm.y + 5, 1.4, FLOOR, 1.5, P, 12), { tone: "mid" }) + box(scm, 7, 1.4, "lo", { bevel: 0, steps: 2 }) + box(chip, 8.4, 1.6, "hi", { bevel: 0, steps: 2, crease: "lo" }) + box(chip2, 8.4, 1.2, "mid", { bevel: 0, steps: 2 }) + Dots([at([scm.x + scm.w - 3, scm.y + scm.d - 3, 8.4])], { size: 0.4 }), [cyl(scm.x + 5, scm.y + 5, 1.4, FLOOR, 1.5), slab(scm, 7, 1.4, 2), slab(chip, 8.4, 1.6, 2), slab(chip2, 8.4, 1.2, 2)], { name: "tray.scm", slide: true });

  // tray coolant manifold at the rear, with four hose fittings on top and two UQD plugs out the back
  const ports = [];
  for (const side of [-1, 1]) ports.push([side * 8, -143], [side * 18, -136]);
  const tops = ports.map(([x, y]) => S(k.cylinder(x, y, 2.9, TMAN_TOP, 2, P, 20), { tone: "mid" }) + L(k.ring(x, y, 1.6, TMAN_TOP + 2, P, 14), { tone: "lo" })).join("");
  put("manifold", "manifold", centreOf(TMAN, 10), box(TMAN, FLOOR, TMAN_TOP - FLOOR, "mid", { bevel: 0.4, steps: 2, inner: L(k.sideSeam(TMAN, 11, P, 2), { tone: "faint" }) }) + tops, [slab(TMAN, FLOOR, TMAN_TOP - FLOOR, 2), ...ports.map(([x, y]) => cyl(x, y, 2.9, TMAN_TOP, 2))], { name: "tray.manifold", slide: true });
  for (const x of UQD_X) {
    const F = G.frameAlong([x, TRAY.y, UQD_Z], [0, -1, 0]);
    const prof = [[0, 6], [2.4, 6], [2.4, 4.6], [10, 4.6]];
    put("manifold", "manifold", [x, TRAY.y - 5, UQD_Z], S(G.solidOf(prof, F, P, { steps: 36 }), { tone: "hi", inner: L(G.arcOf(F, 6, 4.6, P), { tone: "faint" }) }) + Dots(G.dotsOf(F, 0, 5.2, 6, P, { all: true }), { size: 0.35 }), [A.solid(F, prof, {})], { name: R.nameFor("tray.uqd"), slide: true });
  }
  // NVLink plugs on the rear wall, one per GPU in this drawing (illustrative count)
  NV_X.forEach((x) => {
    const plug = { x: x - 5.5, y: TRAY.y - 12, w: 11, d: 12, r: 0.5 };
    put("spine", "spine", centreOf(plug, 15), box(plug, 9, 12, "hi", { bevel: 0.3, steps: 2, crease: "lo" }) + Dots([at([x, plug.y + 6, 21])], { size: 0.4 }), [slab(plug, 9, 12, 2)], { name: R.nameFor("tray.nvplug"), slide: true });
  });
  // bus bar clip: a body on the rear wall with two fingers that straddle the copper bar
  const clip = { x: BUS.x - 4, y: TRAY.y - 14, w: BUS.w + 8, d: 14, r: 0.6 };
  const fingers = [{ x: BUS.x - 3, y: BUS.y, w: 3, d: clip.y - BUS.y, r: 0.4 }, { x: BUS.x + BUS.w, y: BUS.y, w: 3, d: clip.y - BUS.y, r: 0.4 }];
  put("busbar", "busbar", centreOf(clip, 15), box(clip, 9, 12, "mid", { bevel: 0.3, steps: 2 }) + Dots([at([clip.x + 3, clip.y + 7, 21]), at([clip.x + clip.w - 3, clip.y + 7, 21])], { size: 0.4 }), [slab(clip, 9, 12, 2)], { name: "tray.busclip", slide: true });
  fingers.forEach((f, i) => put("busbar", "busbar", centreOf(f, 15), box(f, 10, 10, "hi", { bevel: 0.2, steps: 2, crease: "lo" }), [slab(f, 10, 10, 2)], { name: `tray.busfinger${i}`, slide: true }));
}

// ---- GB200 packages: per board two Blackwell GPUs (two dies, eight HBM3E stacks) and one Grace ----
function packages() {
  for (const side of [-1, 1]) {
    const fx = (x) => (side < 0 ? x : -x);
    GPU_C.forEach(([cx0, cy], index) => {
      const cx = fx(cx0);
      const sub = { x: cx - 21, y: cy - 23, w: 42, d: 46, r: 0.8 };
      const dies = [{ x: cx - 13, y: cy - 15, w: 12, d: 30, r: 0.3 }, { x: cx + 1, y: cy - 15, w: 12, d: 30, r: 0.3 }];
      const hbm = [];
      for (const hx of [cx - 19.5, cx + 14.5]) for (let i = 0; i < 4; i++) hbm.push({ x: hx, y: cy - 15 + i * 7.7, w: 5, d: 6.5, r: 0.2 });
      const caps = [];
      for (let x = sub.x + 4; x < sub.x + sub.w - 2; x += 3.2) caps.push(at([x, sub.y + 3, SUB_TOP]), at([x, sub.y + sub.d - 3, SUB_TOP]));
      const tops = [...dies, ...hbm].sort((a, b) => k.depthOf(centreOf(a, 11), P) - k.depthOf(centreOf(b, 11), P));
      const svg = box(sub, PCB_TOP, SUB_TOP - PCB_TOP, "mid", { bevel: 0.3, steps: 2 }) + Dots(caps, { size: 0.3, tone: "lo" }) + tops.map((d) => box(d, SUB_TOP, CHIP_TOP - SUB_TOP, "hi", { bevel: 0.2, steps: 2, crease: "lo" })).join("") + L(dies.map((d) => k.planOutline(k.insetPlan(d, 1.2), CHIP_TOP, P, 2)).join(""), { tone: "faint" });
      put("pkg", "pkg", [cx, cy, 10], svg, [slab(sub, PCB_TOP, SUB_TOP - PCB_TOP, 2), ...dies.map((d) => slab(d, SUB_TOP, CHIP_TOP - SUB_TOP, 2)), ...hbm.map((d) => slab(d, SUB_TOP, CHIP_TOP - SUB_TOP, 2))], { name: `pkg.gpu${side}_${index}`, slide: true });
    });
    const cx = fx(GRACE_C[0]);
    const cy = GRACE_C[1];
    const sub = { x: cx - 14, y: cy - 14, w: 28, d: 28, r: 0.8 };
    const die = { x: cx - 9, y: cy - 9, w: 18, d: 18, r: 0.4 };
    const svg = box(sub, PCB_TOP, SUB_TOP - PCB_TOP, "mid", { bevel: 0.3, steps: 2 }) + box(die, SUB_TOP, CHIP_TOP - SUB_TOP, "hi", { bevel: 0.2, steps: 2, crease: "lo" }) + L(k.planOutline(k.insetPlan(die, 1.4), CHIP_TOP, P, 2), { tone: "faint" }) + Dots([at([sub.x + 2.5, sub.y + 2.5, SUB_TOP])], { size: 0.45, tone: "mid" });
    put("pkg", "pkg", [cx, cy, 10], svg, [slab(sub, PCB_TOP, SUB_TOP - PCB_TOP, 2), slab(die, SUB_TOP, CHIP_TOP - SUB_TOP, 2)], { name: `pkg.grace${side}`, slide: true });
  }
}

// ---- cold plate loop: six plates, two distribution bars, four hoses to the tray manifold ----
const ROUTES = [];
function plates() {
  for (const side of [-1, 1]) {
    const fx = (x) => (side < 0 ? x : -x);
    const list = [...GPU_C.map(([cx, cy]) => ({ cx: fx(cx), cy, hw: 20, hd: 22 })), { cx: fx(GRACE_C[0]), cy: GRACE_C[1], hw: 13, hd: 13 }];
    const bar = side < 0 ? BAR : mirror(BAR);
    const barX = [bar.x, bar.x + bar.w];
    // one rigid assembly per board: three plates, their spring screws, and the distribution bar that ties them
    const shapes = [];
    let plateSvg = "";
    const near = [];
    const far = [];
    for (const { cx, cy, hw, hd } of [...list].sort((a, b) => k.depthOf([a.cx, a.cy, 0], P) - k.depthOf([b.cx, b.cy, 0], P))) {
      const plate = { x: cx - hw, y: cy - hd, w: 2 * hw, d: 2 * hd, r: 1.6 };
      plateSvg += box(plate, CHIP_TOP, PLATE_TOP - CHIP_TOP, "hi", { bevel: 0.5, steps: 3, crease: "lo", inner: L(k.sideSeam(plate, CHIP_TOP + 2.2, P, 3), { tone: "faint" }) });
      plateSvg += L(k.planOutline(k.insetPlan(plate, 6.5), PLATE_TOP, P, 3), { tone: "faint" });
      shapes.push(slab(plate, CHIP_TOP, PLATE_TOP - CHIP_TOP, 3));
      for (const [x, y] of k.corners(plate, hw < 15 ? 2.6 : 3.6)) {
        if (x + 2.3 > barX[0] - 0.05 && x - 2.3 < barX[1] + 0.05) continue;
        (x > barX[1] ? near : far).push([x, y]);
      }
    }
    const screwSvg = (list) => byDepth(list).map(([x, y]) => S(k.cylinder(x, y, 2.3, PLATE_TOP, 1.2, P, 18), { tone: "mid" }) + S(k.cylinder(x, y, 1.6, PLATE_TOP + 1.2, 2, P, 16), { tone: "mid" }) + L(k.ring(x, y, 0.8, PLATE_TOP + 3.2, P, 8), { tone: "lo" })).join("");
    for (const [x, y] of [...near, ...far]) shapes.push(cyl(x, y, 2.3, PLATE_TOP, 1.2), cyl(x, y, 1.6, PLATE_TOP + 1.2, 2));
    const portX = [fx(-59), fx(-51)];
    let svg = plateSvg + screwSvg(far) + box(bar, PLATE_TOP, BAR_TOP - PLATE_TOP, "mid", { bevel: 0.4, steps: 2, inner: L(k.sideSeam(bar, PLATE_TOP + 2.5, P, 2), { tone: "faint" }) });
    const bolts = [-110, -64, -30].map((y) => [fx(-55), y]);
    svg += L(bolts.map(([x, y]) => k.ring(x, y, 1.4, BAR_TOP, P, 12)).join(""), { tone: "lo" }) + Dots(bolts.map(([x, y]) => at([x, y, BAR_TOP])), { size: 0.4 });
    const fits = byDepth(portX.map((x) => [x, -116]));
    svg += fits.map(([x, y]) => S(k.cylinder(x, y, 2.9, BAR_TOP, FIT_TOP - BAR_TOP, P, 20), { tone: "mid" })).join("");
    svg += screwSvg(near);
    shapes.push(slab(bar, PLATE_TOP, BAR_TOP - PLATE_TOP, 2), ...portX.map((x) => cyl(x, -116, 2.9, BAR_TOP, FIT_TOP - BAR_TOP)));
    put("plates", "plates", [fx(-55), -70, 18], svg, shapes, { name: `plates.loop${side}`, slide: true });
    // hoses: supply runs high and far, return low and near, so they never cross
    const supply = [[side * 8, -143, TMAN_TOP + 2], [side * 8, -143, 42], [portX[0], -143, 42], [portX[0], -116, 42], [portX[0], -116, FIT_TOP]];
    const ret = [[side * 18, -136, TMAN_TOP + 2], [side * 18, -136, 33], [portX[1], -136, 33], [portX[1], -116, 33], [portX[1], -116, FIT_TOP]];
    hose(`plates.hoseS${side}`, supply, 1);
    hose(`plates.hoseR${side}`, ret, -1);
  }
}

function hose(name, control, dir) {
  const r = 2;
  const line = G.fillet(control, 6, 10, { P, tube: r });
  R.route(name, line, r, { owner: name, limp: true, piece: "plates", move: PIECES.plates.move, free: [true, false] });
  const total = G.pathLength(line);
  ROUTES.push({ name, total, dir });
  const parts = Tube.tubePieces(line, r, P, { maxLength: 14, spacing: 1.2 });
  parts.forEach((part, index) => {
    put("plates", "plates", part.mid, Tube.tubeSvg(part, { tone: "hi" }), [A.tube(part.points, part.radii)], { name: `${name}:${index}`, route: name, chunk: index, owner: name, slide: true, flow: { pts: part.points, from: part.from, dir, route: name, total, kind: dir > 0 ? "supply" : "return", stage: 4 } });
  });
}

// ---- the tray lid: closes over the front bay (drawn over the front only, so the cold plates stay in view) ----
function lid() {
  const plan = { x: TRAY.x, y: MID_Y, w: TRAY.w, d: TRAY.y + TRAY.d - 4 - MID_Y, r: 0.6 };
  const h = 1.6;
  const z1 = TOP + h;
  const slots = [];
  for (let x = -100; x < 100; x += 8) slots.push(k.planOutline({ x, y: MID_Y + 6, w: 4, d: 18, r: 1.8 }, z1, P, 3));
  const screws = [];
  for (let y = MID_Y + 6; y < plan.y + plan.d - 2; y += 24) screws.push([TRAY.x + 3, y], [TRAY.x + TRAY.w - 3, y]);
  const recess = { x: 20, y: 70, w: 70, d: 36, r: 1.5 };
  const svg = box(plan, TOP, h, "mid", { bevel: 0.5, steps: 2 }) + L(slots.join(""), { tone: "lo" }) + L(k.planOutline(recess, z1, P, 3), { tone: "faint" }) + L([0, 1, 2].map((i) => k.lineOnTop([recess.x + 8, recess.y + 9 + i * 7], [recess.x + 52 - i * 12, recess.y + 9 + i * 7], z1, P)).join(""), { tone: "lo", free: true }) + Dots(screws.map((p) => at([p[0], p[1], z1])), { size: 0.4 });
  put("lid", "lid", centreOf(plan, TOP), svg, [slab(plan, TOP, h, 2)], { name: "lid.cover", slide: true });
}

// ---- the whole rack, as a scale model ----
function miniRack() {
  const plinth = { x: MINI.x - 2, y: MINI.y - 2, w: MINI.w + 4, d: MINI.d + 4, r: 1.2 };
  put("stand", "rack", centreOf(plinth, 3), `<path class="iso-halo" d="${k.haloOf(plinth, 0, MINI_Z, P)}"/>` + box(plinth, 0, MINI_Z, "mid", { bevel: 0.4, steps: 2 }) + Dots(k.corners(plinth, 3).map(([x, y]) => at([x, y, MINI_Z])), { size: 0.4 }), [slab(plinth, 0, MINI_Z, 2)], { name: "stand.miniplinth", bias: -100 });
  const slotPlan = MINI_IN;
  const slab1 = (index, tone, plan = slotPlan) => {
    const z = MINI_Z + index * MINI_U;
    const face = plan.y + plan.d;
    const kind = MINI_SLOTS[index];
    const mark = kind === "power" ? faceRect(plan.x + 4, plan.x + 16, face, z + 1.1, z + 3.1) : kind === "switch" ? faceRect(plan.x + 6, plan.x + plan.w - 6, face, z + 1.3, z + 2.9) : faceRect(plan.x + 3, plan.x + 12, face, z + 1.1, z + 3.1);
    return box(plan, z, MINI_U, tone, { bevel: 0, steps: 2 }) + L(mark, { tone: "lo" });
  };
  const lowEnd = M.RACK.layout[4] + M.RACK.layout[3];
  const groupsAll = [
    { name: "mini.low", from: 0, to: lowEnd, tone: "mid", group: "rack" },
    { name: "mini.switch", from: lowEnd, to: lowEnd + M.RACK.layout[2], tone: "mid", group: "spine" },
    { name: "mini.mid", from: lowEnd + M.RACK.layout[2], to: OURS, tone: "mid", group: "rack" },
    { name: "mini.high", from: OURS + 1, to: MINI_SLOTS.length, tone: "mid", group: "rack" },
  ];
  for (const g of groupsAll) {
    let svg = "";
    const shapes = [];
    for (let i = g.from; i < g.to; i++) {
      svg += slab1(i, MINI_SLOTS[i] === "power" ? "lo" : g.tone);
      shapes.push(slab(slotPlan, MINI_Z + i * MINI_U, MINI_U, 2));
    }
    let flow = null;
    if (g.group === "spine") {
      const face = slotPlan.y + slotPlan.d;
      const lines = [];
      for (let i = g.from; i < g.to; i += 2) lines.push([[slotPlan.x + 3, face, MINI_Z + (i + 0.5) * MINI_U], [slotPlan.x + slotPlan.w - 3, face, MINI_Z + (i + 0.5) * MINI_U]]);
      flow = { lines, dir: 1, kind: "nvlink", stage: 5 };
    }
    put("stand", g.group, centreOf(slotPlan, MINI_Z + ((g.from + g.to) / 2) * MINI_U), svg, shapes, { name: g.name, flow });
  }
  put("stand", "rack", centreOf(slotPlan, MINI_Z + (OURS + 0.5) * MINI_U), slab1(OURS, "hi"), [slab(slotPlan, MINI_Z + OURS * MINI_U, MINI_U, 2)], { name: "mini.ours", slide: MINI_SLIDE });
  // posts and cap
  const posts = [
    { x: MINI.x, y: MINI.y, w: 4, d: 2, r: 0.3 },
    { x: MINI.x + MINI.w - 4, y: MINI.y, w: 4, d: 2, r: 0.3 },
    { x: MINI.x, y: MINI.y + MINI.d - 2, w: 4, d: 2, r: 0.3 },
    { x: MINI.x + MINI.w - 4, y: MINI.y + MINI.d - 2, w: 4, d: 2, r: 0.3 },
  ];
  posts.forEach((post, i) => put("stand", "rack", centreOf(post, MINI_TOP / 2), box(post, MINI_Z, MINI_TOP - MINI_Z, "mid", { bevel: 0, steps: 2 }), [slab(post, MINI_Z, MINI_TOP - MINI_Z, 2)], { name: `mini.post${i}` }));
  const cap = { x: MINI.x, y: MINI.y, w: MINI.w, d: MINI.d, r: 1 };
  put("stand", "rack", centreOf(cap, MINI_TOP), box(cap, MINI_TOP, 3, "mid", { bevel: 0.4, steps: 2 }) + L(k.planOutline(k.insetPlan(cap, 4), MINI_TOP + 3, P, 2), { tone: "faint" }), [slab(cap, MINI_TOP, 3, 2)], { name: "mini.cap" });
}

stand();
fixture();
chassis();
inside();
packages();
plates();
lid();
miniRack();

if (!process.argv.includes("--fast")) A.settle(R, P);
R.items.sort((a, b) => a.key - b.key);

// flow paths: screen points of each tube chunk's centreline, with 3D arc length along its route
// A flow is one polyline (pts) or several (lines, joined by "|"); kind sets its tint, stage the step that starts it.
function flowData(flow) {
  if (!flow) return "";
  const one = (pts, from = 0) => {
    let along = from;
    return pts.map((p, i) => {
      if (i) along += G.len3(G.sub3(p, pts[i - 1]));
      const [sx, sy] = at(p);
      return `${sx.toFixed(1)},${sy.toFixed(1)},${along.toFixed(1)}`;
    }).join(" ");
  };
  const text = flow.lines ? flow.lines.map((pts) => one(pts)).join("|") : one(flow.pts, flow.from ?? 0);
  return ` data-flow="${text}" data-dir="${flow.dir}" data-kind="${flow.kind}" data-stage="${flow.stage}"`;
}
const groups = R.items.map((item, index) => {
  const [mx, my, mz] = item.move;
  const [sx, sy, sz] = item.slide;
  const flow = item.flow ? `<g class="rk-flow"${flowData(item.flow)}></g>` : "";
  return `<g class="it" data-piece="${item.piece}" data-g="${item.group}" data-k="${item.key.toFixed(2)}" data-m="${mx.toFixed(1)},${my.toFixed(1)},${mz.toFixed(1)}" data-s="${sx.toFixed(1)},${sy.toFixed(1)},${sz.toFixed(1)}" data-i="${index}">${item.svg}${flow}</g>`;
});

const LABEL = `An NVIDIA GB200 NVL72 compute tray on slide rails at a slice of its rack, beside a scale model of the whole rack. Inside the 1U tray: two boards, each with two Blackwell GPU packages and a Grace CPU under liquid cold plates, hoses to a manifold with two blind-mate quick-disconnects at the back, NVLink connectors and a bus bar clip; at the front, fans, network cards and drive bays under a lid. Behind it the rack slice holds the coolant manifold, the copper bus bar and an NVLink cable cartridge.`;
const svg = k.figureSvg({ width: W, height: H, label: LABEL, body: [`<g class="rk-layers">${groups.join("")}</g>`], className: "rk-svg" });

const unit = (vector) => {
  const o = at([0, 0, 0]);
  const p = at(vector);
  return [p[0] - o[0], p[1] - o[1]];
};
const GROUPS = ["pkg", "plates", "lid", "manifold", "busbar", "spine", "rack"];
const DATA = {
  V,
  EX: unit([1, 0, 0]),
  EY: unit([0, 1, 0]),
  EZ: unit([0, 0, 1]),
  groups: Object.fromEntries(GROUPS.map((id) => [id, M.PIECES[id]])),
  order: GROUPS,
  steps: M.STEPS,
  idle: M.IDLE,
  done: M.DONE,
};

const fmt = (n) => n.toLocaleString("en-US");
const PARTS = GROUPS.map((id, index) => `<button type="button" class="rk-part" data-part="${id}"><span class="rk-num">${String(index + 1).padStart(2, "0")}</span>${M.PIECES[id].name}</button>`).join("");
const corners = `<div class="iso-plate-corners" aria-hidden="true"><span class="iso-plate-corner" data-corner="fig">Fig 1</span><span class="iso-plate-corner" data-corner="title">GB200 NVL72 · compute tray</span><span class="iso-plate-corner" data-corner="readout" data-readout>${M.IDLE}</span></div>`;
const controls = `<div class="rk-controls"><span class="rk-hint">Hover a part · Space plays the build</span><span class="rk-live" aria-live="polite" data-live></span></div>`;
const stage = `<div class="rk-stage" tabindex="0" role="slider" aria-label="GB200 NVL72 compute tray and rack. Hover, or use the arrow keys, to pick a part; Space plays or pauses the build from parts to a running rack; Escape resets it; the slider below steps through it." aria-valuemin="0" aria-valuemax="${GROUPS.length}" aria-valuenow="0" aria-valuetext="${M.IDLE}">${svg}</div>`;
const caption = `One of the ${M.RACK.computeTrays} compute trays of an NVIDIA GB200 NVL72 rack. The 1U tray carries ${M.TRAY.superchips} GB200 superchips: ${M.TRAY.gpus} Blackwell GPUs (${M.GPU.dies} dies and ${M.GPU.transistorsB} billion transistors each, about ${M.hbmPerGpu} GB of HBM3E each, derived from ${M.GPU.superchipHbmGB} GB a superchip) and ${M.TRAY.grace} Grace CPUs, all under liquid cold plates. At the back it meets the rack three ways at once: two blind-mate ${M.TRAY.uqd} couplers on the coolant manifold (inlet up to ${M.COOL.inletMaxC} °C, return up to ${M.COOL.returnMaxC} °C, up to ${M.COOL.rackLpm} L/min a rack), a clip on the ${M.RACK.busbarV} V DC bus bar, and NVLink connectors into one of ${M.RACK.cartridges} cable cartridges that hold over ${fmt(M.RACK.copperCables)} copper cables. The scale model shows the whole rack: ${M.RACK.layout[0]} power shelves, ${M.RACK.layout[1]} compute trays, ${M.RACK.layout[2]} NVLink switch trays (they light, with signal pulses running through them and up the cable cartridge, when the spine connects), ${M.RACK.layout[3]} compute trays and ${M.RACK.layout[4]} power shelves (one vendor's layout). Tray width and height are to scale (ruler ticks 10 mm); its depth, board layout, connector count and the rack slice are illustrative, and the lid is drawn over the front bay only so the cold plates stay in view.`;
const scrub = `<span class="rk-scrub"><button type="button" class="rk-play" data-play aria-label="Play the build"><span class="rk-play-icon" aria-hidden="true"></span><span data-play-text>Play</span></button><input type="range" class="rk-range" data-scrub min="0" max="1000" step="1" value="0" aria-label="Build: 0 is parts on the bench, 1000 is a running rack"><span class="rk-step" data-step>parts out</span></span>`;
const body = `<figure class="iso-figure rk"><div class="iso-plate">${corners}${stage}${controls}</div><figcaption class="iso-legend">${scrub}<span class="rk-parts">${PARTS}</span><span class="iso-caption">${caption}</span></figcaption></figure>`;

const CSS = readFileSync(join(HERE, "rack.css"), "utf8");
const LIVE = readFileSync(join(HERE, "live.js"), "utf8").replace("__DATA__", JSON.stringify(DATA));
const out = writeChapter({ slug: "rack", figure: body, css: CSS, script: LIVE, lesson: LESSON });
console.log("wrote", out.file, `${out.kb} KB`, `${R.items.length} items`, `${R.solids.length} solids`);

// Looked at 8x: the hoses rise in front of the tray's rear wall (a wall, not a rod), and in the audit's apart pose the
// lifted hoses pass far in front of the rack's manifold pipes, a pose the page never shows (the tray is pulled out then).
A.auditOrExit(R, P, { crowd: [["plates.hose*", "tray.wallB"], ["plates.hose*", "manifold.pipe*"]] });
if (process.env.RK_P) console.log("P=" + JSON.stringify(P));
