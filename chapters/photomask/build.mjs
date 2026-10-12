// A multi-beam mask writer on its isolation table, with a finishing bench for the EUV mask it writes.
// node build.mjs [--fast] [--audit]
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as M from "./model.mjs";

import { k, G, A, Tube } from "../../site/kit.mjs";
import { writeChapter } from "../../site/shell.mjs";
import { LESSON } from "./lesson.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

// ---- world layout: x and y on the floor, z up, illustrative units (not to scale) ----
const W = 720;
const H = 610;
const AZIMUTH = 42;
const ELEVATION = 34;

const PLATE = { x: -224, y: -132, w: 420, d: 396, r: 10 };
const PLATE_H = 12;
const FOOT_H = 6;
const GRAN = { x: -116, y: -104, w: 270, d: 208, r: 5 };
const MOUNT_TOP = 14;
const GRAN_TOP = 30;
const CH = { x: -100, y: -90, w: 200, d: 180, r: 4 };
const FLOOR_TOP = 36;
const WALL = 6;
const WALL_TOP = 120;
const SILL_TOP = 52;
const BRIDGE = { x: -100, y: -24, w: 200, d: 42, r: 2 };
const BRIDGE_TOP = 132;
const AXIS = [0, -3];

// stage: rest (share 0) is the load position at the front, share 1 is under the column
const STAGE_Y = 38;
const STAGE_MOVE = [0, AXIS[1] - STAGE_Y, 0];
const RAIL_TOP = 42;
const CARR_TOP = 48;
const XST_TOP = 52;
const CHUCK_TOP = 56;
const BLANK_TOP = 59;
const MASK_SIDE = 56;

// rack
const RACK = { x: -212, y: 14, w: 50, d: 72, r: 2 };
const RACK_TOP = 156;

// load lock and turbo pump on the right wall
const LL = { x: 100, y: 30, w: 44, d: 50, r: 3 };
const LL_TOP = 74;

// finishing bench, front right
const BENCH = { x: 4, y: 112, w: 168, d: 146, r: 4 };
const BENCH_TOP = 22;
const BM = { x: 46, y: 124, w: 64, d: 64, r: 0.8 };
const SUB_TOP = BENCH_TOP + 6;
const ML_TOP = SUB_TOP + 3.2;
const CAP_TOP = ML_TOP + 0.6;
const ABS_TOP = CAP_TOP + 1.4;
const POSTS_Y = BM.y + BM.d / 2;
const BEAM_Z = 56;
const HEAD_MOVE = [76, 0, 0];
const PEL_MOVE = [0, -66, 0];
const PEL_SIZE = [M.PELLICLE.sizeMm[0] * (BM.w / M.BLANK.sideMm), M.PELLICLE.sizeMm[1] * (BM.d / M.BLANK.sideMm)];

const PIECES = Object.fromEntries(Object.entries(M.PIECES).map(([id, p]) => [id, { ...p, move: [0, 0, 0] }]));
PIECES.stage.move = STAGE_MOVE;
PIECES.inspect.move = HEAD_MOVE;
PIECES.pellicle.move = PEL_MOVE;
const ORDER = ["data", "gun", "aps", "optics", "stage", "chamber", "mask", "inspect", "pellicle"];
const MOVERS = ["stage", "inspect", "pellicle"];

// Each mover's share is a pure function of the slider value s (0..1), shared with the page.
const STEP = 1 / M.STEPS.length;
const RAMPS = {
  stage: [2 * STEP + 0.005, 2 * STEP + 0.05],
  inspect: [4 * STEP + 0.02, 5 * STEP - 0.02],
  pellicle: [5 * STEP + 0.02, 1 - 0.03],
};
const smooth = (t) => t * t * (3 - 2 * t);
const shareAt = (id, s) => smooth(Math.min(1, Math.max(0, (s - RAMPS[id][0]) / (RAMPS[id][1] - RAMPS[id][0]))));

// Depth and clearance states: every slider pose the page can show, plus a grid of combinations.
const STATES = [0, 1];
for (let i = 0; i <= 60; i++) {
  const s = i / 60;
  STATES.push({ label: `s ${s.toFixed(3)}`, shares: Object.fromEntries(MOVERS.map((id) => [id, shareAt(id, s)])) });
}
for (const a of [0, 0.5, 1]) for (const b of [0, 0.5, 1]) for (const c of [0, 0.5, 1]) STATES.push({ label: `grid ${a}/${b}/${c}`, shares: { stage: a, inspect: b, pellicle: c } });

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [AXIS[0], AXIS[1], 318], [RACK.x, RACK.y, RACK_TOP + 40]],
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
const centreOf = (plan, z) => [plan.x + plan.w / 2, plan.y + plan.d / 2, z];
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], a[2] ?? 0], P) - k.depthOf([b[0], b[1], b[2] ?? 0], P));
const up = (x, y, z = 0) => G.frameOf([x, y, z], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
const pathOf = (points, closed = true) => points.map((p, i) => `${i ? "L" : "M"}${at(p).map((v) => v.toFixed(1)).join(" ")}`).join("") + (closed ? "Z" : "");
// a closed rectangle on a vertical face: x = const (axis "x") or y = const (axis "y")
const faceRect = (axis, c, a0, a1, z0, z1) => pathOf(axis === "x" ? [[c, a0, z0], [c, a1, z0], [c, a1, z1], [c, a0, z1]] : [[a0, c, z0], [a1, c, z0], [a1, c, z1], [a0, c, z1]]);

const R = A.recorder(P, { order: MOVERS, spring: { stagger: 0.05, stiffness: 64, damping: 14.2, substeps: 4 } });
function put(piece, ref, svg, shapes, { bias = 0, name, cls } = {}) {
  const id = name ?? R.nameFor(`${piece}.item`);
  shapes.forEach((shape) => (shape.name = shape.name ?? id));
  R.put({ piece, at: ref, bias, svg, move: PIECES[piece].move, shapes: shapes.map(R.solid), name: id, cls });
}
function slab(piece, plan, z, h, { tone = "mid", steps = 4, bevel = 0, seams = [], extra = "", name, crease, bias = 0, cls } = {}) {
  const inner = seams.length ? L(seams.map((sz) => k.sideSeam(plan, sz, P, steps)).join(""), { tone: "faint" }) : "";
  const svg = S(k.slabOf(plan, z, h, P, steps, bevel), { tone, inner, ...(crease ? { crease } : {}) }) + extra;
  put(piece, centreOf(plan, z + h / 2), svg, [A.slab(plan, z, h, {}, steps)], { name: name ?? R.nameFor(`${piece}.slab`), bias, cls });
}
function cyl(piece, x, y, r, z, h, { tone = "mid", steps = 32, bevel = 0, extra = "", name, crease, bias = 0 } = {}) {
  const svg = S(k.cylinder(x, y, r, z, h, P, steps, bevel), { tone, ...(crease ? { crease } : {}) }) + extra;
  put(piece, [x, y, z + h / 2], svg, [A.cylinder(x, y, r, z, h)], { name: name ?? R.nameFor(`${piece}.cyl`), bias });
}
function turned(piece, F, profile, { tone = "hi", inner = "", extra = "", bevel = 0, name, bias = 0 } = {}) {
  const smoothing = profile.some((p) => p[2]);
  const paths = G.solidOf(profile, F, P, { bevel, smooth: smoothing ? { rows: 4 } : false });
  const mid = (profile[0][0] + profile[profile.length - 1][0]) / 2;
  const id = name ?? R.nameFor(`${piece}.turned`);
  const shape = A.solid(F, profile, { name: id, curve: smoothing ? profile : undefined });
  put(piece, G.add3(F.o, G.mul3(F.a, mid)), S(paths, { tone, inner: inner ? L(inner, { tone: "faint" }) : "" }) + extra, [shape], { name: id, bias });
}
function tube(piece, route, r, { tone = "mid", name, maxLength = 16, bias = 0, rims } = {}) {
  const id = R.nameFor(name ?? `${piece}.cable`);
  R.route(id, route, r, { owner: id, limp: true, piece, move: PIECES[piece].move, rims: rims ?? [r, r] });
  Tube.tubePieces(route, r, P, { maxLength, spacing: 1 }).forEach((part, index) =>
    R.put({ piece, at: part.mid, bias, svg: Tube.tubeSvg(part, { tone }), move: PIECES[piece].move, name: `${id}:${index}`, route: id, chunk: index, shapes: [A.tube(part.points, part.radii)] }),
  );
  return id;
}

// ---- stand: base plate, feet, isolation mounts, granite table, ruler and label plate ----
function stand() {
  const back = [];
  back.push(`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`);
  const shapes = [];
  for (const [x, y] of byDepth(k.corners(PLATE, 26))) {
    back.push(S(k.cylinder(x, y, 9, -PLATE_H - FOOT_H, 1.8, P, 28), { tone: "lo" }));
    back.push(S(k.cylinder(x, y, 7, -PLATE_H - FOOT_H + 1.8, FOOT_H - 1.8, P, 28), { tone: "mid" }));
    shapes.push(A.cylinder(x, y, 9, -PLATE_H - FOOT_H, FOOT_H, { name: "stand.foot" }));
  }
  back.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid", inner: L(k.sideSeam(PLATE, -PLATE_H + 3.5, P, 8), { tone: "faint" }) }));
  shapes.push(A.slab(PLATE, -PLATE_H, PLATE_H, { name: "stand.plate" }));
  back.push(L(k.planOutline(k.insetPlan(PLATE, 6), 0, P, 8), { tone: "lo" }));
  const screws = k.corners(PLATE, 13);
  back.push(L(screws.map(([x, y]) => k.ring(x, y, 2.6, 0, P, 16)).join(""), { tone: "lo" }));
  back.push(Dots(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // ruler strip along the near (+y) edge, left of the bench
  const strip = { x: -196, y: PLATE.y + PLATE.d - 20, w: 176, d: 9, r: 1 };
  back.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 4, 5, strip.y + 0.8, 0.6, [2.4, 4.4], P);
  back.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  back.push(Dots([at([strip.x + 2, strip.y + 4.5, 0.6]), at([strip.x + strip.w - 2, strip.y + 4.5, 0.6])], { size: 0.45 }));
  // label plate in front of the rack
  const label = { x: -200, y: 104, w: 60, d: 22, r: 1.5 };
  back.push(S(k.slabOf(label, 0, 0.8, P, 4), { tone: "lo", crease: "none" }));
  back.push(L(k.planOutline(k.insetPlan(label, 2), 0.8, P, 4), { tone: "faint" }));
  back.push(L([0, 1, 2].map((i) => k.lineOnTop([label.x + 8, label.y + 6 + i * 4], [label.x + 46 - i * 10, label.y + 6 + i * 4], 0.8, P)).join(""), { tone: "lo", free: true }));
  back.push(Dots([at([label.x + 4, label.y + label.d / 2, 0.8]), at([label.x + label.w - 4, label.y + label.d / 2, 0.8])], { size: 0.45 }));
  put("stand", [0, 0, -1], back.join(""), shapes, { name: "stand.base", bias: -800 });

  // active isolation mounts under the granite
  for (const [x, y] of k.corners(GRAN, 24)) {
    const svg =
      S(k.cylinder(x, y, 14, 0, 2.4, P, 36), { tone: "lo" }) +
      S(k.cylinder(x, y, 11, 2.4, MOUNT_TOP - 4.4, P, 36), { tone: "mid", inner: L(k.sideArc(x, y, 11, 7, P, 28), { tone: "faint" }) }) +
      S(k.cylinder(x, y, 12.5, MOUNT_TOP - 2, 2, P, 36), { tone: "mid" });
    put("stand", [x, y, MOUNT_TOP / 2], svg, [A.cylinder(x, y, 14, 0, 2.4), A.cylinder(x, y, 11, 2.4, MOUNT_TOP - 4.4), A.cylinder(x, y, 12.5, MOUNT_TOP - 2, 2)], { name: R.nameFor("stand.mount") });
  }
  // the granite table the chamber stands on
  const gscrews = k.corners(GRAN, 7);
  slab("stand", GRAN, MOUNT_TOP, GRAN_TOP - MOUNT_TOP, { tone: "mid", steps: 6, bevel: 1.2, seams: [MOUNT_TOP + 4], name: "stand.granite", extra: L(gscrews.map(([x, y]) => k.ring(x, y, 2, GRAN_TOP, P, 14)).join(""), { tone: "lo" }) + Dots(gscrews.map(([x, y]) => at([x, y, GRAN_TOP])), { size: 0.45 }), bias: -200 });
}

// ---- vacuum chamber: floor, far walls, cut-away near walls, bridge, load lock, turbo pump ----
function chamber() {
  slab("chamber", CH, GRAN_TOP, FLOOR_TOP - GRAN_TOP, { tone: "mid", steps: 4, bevel: 0.6, name: "chamber.floor" });
  const back = { x: CH.x, y: CH.y, w: CH.w, d: WALL, r: 1 };
  const left = { x: CH.x, y: CH.y + WALL, w: WALL, d: CH.d - WALL, r: 1 };
  const rightBack = { x: CH.x + CH.w - WALL, y: CH.y + WALL, w: WALL, d: 110 - WALL, r: 1 };
  const rightFront = { x: CH.x + CH.w - WALL, y: CH.y + 110, w: WALL, d: CH.d - 110, r: 1 };
  const front = { x: CH.x + WALL, y: CH.y + CH.d - WALL, w: CH.w - 2 * WALL, d: WALL, r: 1 };
  // inner face ribs on the back wall: vertical stiffeners run floor to top
  const ribs = [-60, -20, 20, 60].map((x) => faceRect("y", back.y + WALL, x - 3, x + 3, FLOOR_TOP, WALL_TOP)).join("");
  slab("chamber", back, FLOOR_TOP, WALL_TOP - FLOOR_TOP, { tone: "mid", steps: 2, bevel: 0.5, name: "chamber.back", extra: L(ribs, { tone: "faint" }), bias: -50 });
  const ix = left.x + WALL;
  const port = faceRect("x", ix, -40, 30, 64, 104) + faceRect("x", ix, -34, 24, 70, 98);
  const portDots = [[-37, 67], [27, 67], [-37, 101], [27, 101]].map(([y, z]) => at([ix, y, z]));
  const leftRibs = [-70, 50].map((y) => faceRect("x", ix, y - 3, y + 3, FLOOR_TOP, WALL_TOP)).join("");
  slab("chamber", left, FLOOR_TOP, WALL_TOP - FLOOR_TOP, { tone: "mid", steps: 2, bevel: 0.5, name: "chamber.left", bias: -40, extra: L(port, { tone: "lo" }) + L(leftRibs, { tone: "faint" }) + Dots(portDots, { size: 0.42 }) });
  slab("chamber", rightBack, FLOOR_TOP, WALL_TOP - FLOOR_TOP, { tone: "mid", steps: 2, bevel: 0.5, name: "chamber.right" });
  // cut walls: their tops are the cut, drawn in the low tone
  slab("chamber", rightFront, FLOOR_TOP, SILL_TOP + 4 - FLOOR_TOP, { tone: "lo", steps: 2, name: "chamber.cutRight" });
  slab("chamber", front, FLOOR_TOP, SILL_TOP - FLOOR_TOP, { tone: "lo", steps: 2, name: "chamber.cutFront" });

  // the bridge that carries the column (the rest of the lid is cut away)
  const bs = [];
  for (const x of [-92, -78, 78, 92]) for (const y of [BRIDGE.y + 6, BRIDGE.y + BRIDGE.d - 6]) bs.push([x, y]);
  slab("chamber", BRIDGE, WALL_TOP, BRIDGE_TOP - WALL_TOP, { tone: "mid", steps: 3, bevel: 0.8, seams: [WALL_TOP + 4], name: "chamber.bridge", extra: L(bs.map(([x, y]) => k.ring(x, y, 1.8, BRIDGE_TOP, P, 12)).join(""), { tone: "lo" }) + Dots(bs.map(([x, y]) => at([x, y, BRIDGE_TOP])), { size: 0.42 }) });

  // load lock outside the right wall, with a gate valve body, a viewport lid and a reticle pod on top
  const gate = { x: CH.x + CH.w, y: LL.y + 8, w: 4, d: LL.d - 16, r: 0.8 };
  slab("chamber", gate, GRAN_TOP, 36 - GRAN_TOP + 22, { tone: "mid", steps: 2, name: "chamber.gate" });
  const llb = { ...LL, x: LL.x + 4, w: LL.w - 4 };
  const lscrews = k.corners(llb, 4);
  slab("chamber", llb, GRAN_TOP, LL_TOP - GRAN_TOP, { tone: "mid", steps: 4, bevel: 0.8, seams: [LL_TOP - 6], name: "chamber.loadlock", extra: L(lscrews.map(([x, y]) => k.ring(x, y, 1.6, LL_TOP, P, 12)).join(""), { tone: "lo" }) + Dots(lscrews.map(([x, y]) => at([x, y, LL_TOP])), { size: 0.4 }) });
  const cx = llb.x + llb.w / 2;
  const cy = llb.y + llb.d / 2;
  cyl("chamber", cx, cy, 13, LL_TOP, 2, { tone: "mid", steps: 40, name: "chamber.viewport", extra: L(k.ring(cx, cy, 9.5, LL_TOP + 2, P, 40), { tone: "lo" }) + Dots(G.dotsOf(up(cx, cy), LL_TOP + 2, 11.3, 8, P, { all: true }), { size: 0.38 }) });
  const pod = { x: cx - 9, y: cy - 9, w: 18, d: 18, r: 3 };
  slab("chamber", pod, LL_TOP + 2, 9, { tone: "hi", steps: 5, bevel: 0.6, seams: [LL_TOP + 6], name: "chamber.pod", crease: "lo" });
  cyl("chamber", cx, cy, 3, LL_TOP + 11, 2.4, { tone: "mid", steps: 20, name: "chamber.podHandle" });

  // turbo pump on the right wall, axis +x: flange, body, fan housing
  const F = G.frameOf([CH.x + CH.w, -50, 82], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
  turned("chamber", F, [[0, 0], [0, 15], [3, 15], [3, 0]], { tone: "mid", name: "chamber.turboFlange", extra: Dots(G.dotsOf(F, 3, 13.5, 10, P, { all: true }), { size: 0.38 }) });
  turned("chamber", F, [[3, 0], [3, 12], [26, 12], [26, 0]], { tone: "mid", name: "chamber.turbo", inner: G.arcOf(F, 12, 12, P) + G.arcOf(F, 19, 12, P) });
  turned("chamber", F, [[26, 0], [26, 13.5], [30, 13.5], [30, 0]], { tone: "mid", name: "chamber.turboFan", extra: L(G.circleOf(F, 30, 9, P, 40), { tone: "lo" }) + Dots([at([CH.x + CH.w + 30, -50, 82])], { size: 0.5 }) });
  // ribs and a viewport on the right wall's outer face
  const outer = CH.x + CH.w;
  slab("chamber", { x: outer, y: -20, w: 3, d: 30, r: 0.8 }, 92, 22, { tone: "mid", steps: 2, name: "chamber.portFrame", extra: L(faceRect("x", outer + 3, -16, 6, 96, 110), { tone: "lo" }) + Dots([[outer + 3, -18, 94], [outer + 3, 8, 94], [outer + 3, -18, 112], [outer + 3, 8, 112]].map(at), { size: 0.4 }) });
  for (const y of [-80, 16]) slab("chamber", { x: outer, y, w: 3, d: 4, r: 0.6 }, FLOOR_TOP, WALL_TOP - FLOOR_TOP, { tone: "mid", steps: 2, name: R.nameFor("chamber.rib") });
  // vacuum gauge on the load lock
  cyl("chamber", LL.x + 10, LL.y + 8, 3.4, LL_TOP, 6, { tone: "mid", steps: 20, name: "chamber.gauge", extra: L(k.ring(LL.x + 10, LL.y + 8, 2, LL_TOP + 6, P, 16), { tone: "lo" }) });
}

// ---- stage: rails, carriage, fine stage, chuck, mask blank with resist; moves to the column ----
const DIES = [];
function stage() {
  for (const x of [-46, 38]) {
    const rail = { x, y: -74, w: 8, d: 152, r: 1 };
    const ends = [rail.y + 5, rail.y + rail.d - 5].map((y) => [x + 4, y]);
    slab("chamber", rail, FLOOR_TOP, RAIL_TOP - FLOOR_TOP, { tone: "mid", steps: 2, bevel: 0.4, name: R.nameFor("chamber.rail"), extra: Dots(ends.map(([a, b]) => at([a, b, RAIL_TOP])), { size: 0.42 }) });
  }
  const carr = { x: -54, y: STAGE_Y - 34, w: 108, d: 68, r: 3 };
  const blocks = [];
  slab("stage", carr, RAIL_TOP, CARR_TOP - RAIL_TOP, { tone: "mid", steps: 4, bevel: 0.6, seams: [RAIL_TOP + 2.2], name: "stage.carriage", extra: Dots(k.corners(carr, 5).map(([x, y]) => at([x, y, CARR_TOP])), { size: 0.42 }) });
  const mirror = { x: -50, y: carr.y + 0.4, w: 100, d: 2.2, r: 0.4 };
  slab("stage", mirror, CARR_TOP, 8, { tone: "hi", steps: 2, crease: "lo", name: "stage.mirror" });
  for (const x of [-34, 22]) {
    const head = { x, y: CH.y + WALL, w: 12, d: 9, r: 1 };
    slab("chamber", head, CARR_TOP - 2, 10, { tone: "mid", steps: 2, bevel: 0.3, name: R.nameFor("chamber.interferometer"), extra: L(faceRect("y", head.y + head.d, x + 3, x + 9, CARR_TOP + 1, CARR_TOP + 5), { tone: "lo" }) });
  }
  const xs = { x: -44, y: STAGE_Y - 30, w: 88, d: 60, r: 2.5 };
  slab("stage", xs, CARR_TOP, XST_TOP - CARR_TOP, { tone: "mid", steps: 4, bevel: 0.5, name: "stage.fine" });
  const chuck = { x: -MASK_SIDE / 2 - 3, y: STAGE_Y - MASK_SIDE / 2 - 3, w: MASK_SIDE + 6, d: MASK_SIDE + 6, r: 2 };
  slab("stage", chuck, XST_TOP, CHUCK_TOP - XST_TOP, { tone: "mid", steps: 4, bevel: 0.5, name: "stage.chuck", extra: L(k.planOutline(k.insetPlan(chuck, 2.2), CHUCK_TOP, P, 3), { tone: "faint" }) });
  // the blank: resist-coated, with die fields that light up as they are written
  const blank = { x: -MASK_SIDE / 2, y: STAGE_Y - MASK_SIDE / 2, w: MASK_SIDE, d: MASK_SIDE, r: 0.8 };
  const fields = [];
  const n = 4;
  const gap = 2.4;
  const cell = (MASK_SIDE - 10 - gap * (n - 1)) / n;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const ii = j % 2 ? n - 1 - i : i; // serpentine, as the stage writes stripe by stripe
      const plan = { x: blank.x + 5 + ii * (cell + gap), y: blank.y + 5 + j * (cell + gap), w: cell, d: cell, r: 0.3 };
      fields.push(`<path class="pm-die" data-n="${j * n + i}" d="${k.planOutline(plan, BLANK_TOP, P, 2)}"/>`);
      DIES.push(plan);
    }
  }
  const frame = L(k.planOutline(k.insetPlan(blank, 3), BLANK_TOP, P, 2), { tone: "faint" });
  slab("stage", blank, CHUCK_TOP, BLANK_TOP - CHUCK_TOP, { tone: "hi", steps: 2, bevel: 0.4, crease: "lo", name: "stage.blank", extra: frame + `<g class="pm-dies">${fields.join("")}</g>` });
  // three clamp pins
  for (const [x, y] of [[blank.x - 2.6, blank.y + 12], [blank.x - 2.6, blank.y + blank.d - 12], [blank.x + blank.w / 2, blank.y - 2.6]]) cyl("stage", x, y, 2, CHUCK_TOP, 3.4, { tone: "mid", steps: 16, name: R.nameFor("stage.pin") });
}

// ---- column: projection optics (inside and above the bridge), aperture plate system, condenser, gun ----
const COL = up(AXIS[0], AXIS[1]);
function column() {
  const seam = (s, r) => G.arcOf(COL, s, r, P);
  turned("optics", COL, [[64, 0], [64, 3.4], [68, 3.4], [68, 10], [73, 17], [WALL_TOP, 17], [WALL_TOP, 0]], { name: "optics.final", inner: seam(84, 17) + seam(102, 17) });
  turned("optics", COL, [[BRIDGE_TOP, 0], [BRIDGE_TOP, 34], [BRIDGE_TOP + 6, 34], [BRIDGE_TOP + 6, 0]], { tone: "mid", name: "optics.flange", extra: Dots(G.dotsOf(COL, BRIDGE_TOP + 6, 30.5, 16, P, { all: true }), { size: 0.42 }) });
  turned("optics", COL, [[BRIDGE_TOP + 6, 0], [BRIDGE_TOP + 6, 25], [176, 25], [176, 0]], { name: "optics.lens2", inner: seam(150, 25) + seam(164, 25) });
  turned("optics", COL, [[176, 0], [176, 29], [180, 29], [180, 0]], { tone: "mid", name: "optics.ring", extra: Dots(G.dotsOf(COL, 180, 26.5, 12, P, { all: true }), { size: 0.38 }) });
  turned("optics", COL, [[180, 0], [180, 22], [206, 22], [206, 0]], { name: "optics.lens1", inner: seam(193, 22) });
  // aperture plate system: a wider drum with the plate stack inside, data port on the -x side
  turned("aps", COL, [[206, 0], [206, 30], [209, 30], [209, 0]], { tone: "mid", name: "aps.ringLow" });
  turned("aps", COL, [[209, 0], [209, 28], [223, 28], [223, 0]], { name: "aps.drum", inner: seam(214, 28) + seam(218, 28) });
  turned("aps", COL, [[223, 0], [223, 30], [226, 30], [226, 0]], { tone: "mid", name: "aps.ringHigh", extra: Dots(G.dotsOf(COL, 226, 27.5, 12, P, { all: true }), { size: 0.38 }) });
  const portF = G.frameOf([AXIS[0] - 28, AXIS[1], 216], [-1, 0, 0], [0, 1, 0], [0, 0, 1]);
  turned("aps", portF, [[0, 0], [0, 5], [6, 5], [6, 6.4], [8, 6.4], [8, 0]], { tone: "mid", name: "aps.port" });
  turned("gun", COL, [[226, 0], [226, 19], [250, 19], [250, 0]], { name: "gun.condenser", inner: seam(238, 19) });
  turned("gun", COL, [[250, 0], [250, 23], [254, 23], [254, 0]], { tone: "mid", name: "gun.flange", extra: Dots(G.dotsOf(COL, 254, 21, 10, P, { all: true }), { size: 0.38 }) });
  turned("gun", COL, [[254, 0], [254, 16], [276, 16], [276, 0]], { name: "gun.chamber", inner: seam(265, 16) });
  // HV insulator: ribbed ceramic, then the cable connector
  const dome = [[276, 0], [276, 13]];
  for (let i = 0; i < 4; i++) dome.push([279 + i * 4, 11 - i * 0.8], [280.6 + i * 4, 12.4 - i * 0.8], [282.4 + i * 4, 11 - i * 0.8]);
  dome.push([294, 7], [294, 0]);
  turned("gun", COL, dome, { tone: "hi", name: "gun.insulator" });
  turned("gun", COL, [[294, 0], [294, 5.5], [302, 5.5], [302, 4], [304, 4], [304, 0]], { tone: "mid", name: "gun.connector" });
  // ion pump on the gun chamber, axis -y
  const ipF = G.frameOf([AXIS[0], AXIS[1] - 16, 265], [0, -1, 0], [1, 0, 0], [0, 0, 1]);
  turned("gun", ipF, [[0, 0], [0, 5], [5, 5], [5, 9], [16, 9], [16, 0]], { tone: "mid", name: "gun.ionpump" });
}

// ---- data path: rack, cables to the aperture plate and the gun ----
function data() {
  const plinth = { ...k.insetPlan(RACK, -1.5) };
  slab("data", plinth, 0, 6, { tone: "lo", steps: 3, name: "data.plinth" });
  const body = RACK;
  const doorX = body.x + body.w;
  // door outline, vents and LED row on the +x face
  const vents = [];
  for (let i = 0; i < 6; i++) vents.push(faceRect("x", doorX, body.y + 12, body.y + body.d - 12, 20 + i * 5, 22 + i * 5));
  const door = faceRect("x", doorX, body.y + 4, body.y + body.d - 4, 10, RACK_TOP - 6);
  const panels = [0, 1, 2, 3].map((i) => faceRect("x", doorX, body.y + 10, body.y + body.d - 10, 70 + i * 18, 84 + i * 18)).join("");
  const leds = [];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 8; j++) leds.push(at([doorX, body.y + 14 + j * 5.6, 78 + i * 18]));
  const handle = faceRect("x", doorX, body.y + 6, body.y + 8.4, 40, 64);
  slab("data", body, 6, RACK_TOP - 6, { tone: "mid", steps: 3, bevel: 0.8, name: "data.rack", extra: L(door + panels, { tone: "lo" }) + L(vents.join("") + handle, { tone: "faint" }) + `<g class="pm-leds">${Dots(leds, { size: 0.5, tone: "lo" })}</g>` });
  // cable glands on the rack roof
  const g1 = [body.x + 32, body.y + 22];
  const g2 = [body.x + 32, body.y + 48];
  for (const [x, y] of [g1, g2]) cyl("data", x, y, 4.2, RACK_TOP, 3, { tone: "mid", steps: 24, name: R.nameFor("data.gland") });
  // data fibre bundle: up from the rack, across to the aperture port
  const portEnd = [AXIS[0] - 36, AXIS[1], 216];
  const route1 = G.fillet([[g1[0], g1[1], RACK_TOP + 3], [g1[0], g1[1], 200], [-120, AXIS[1], 216], portEnd], 14, 10, { P, tube: 1.6 });
  tube("data", route1, 1.6, { name: "data.fibre", tone: "mid" });
  // high-voltage cable: up, over, down onto the gun connector
  const hvEnd = [AXIS[0], AXIS[1], 304];
  const route2 = G.fillet([[g2[0], g2[1], RACK_TOP + 3], [g2[0], g2[1], 316], [AXIS[0] - 30, AXIS[1], 322], [AXIS[0], AXIS[1], 322], hvEnd], 12, 10, { P, tube: 2.2 });
  tube("gun", route2, 2.2, { name: "gun.hv", tone: "mid" });
}

// ---- finishing bench: table, EUV mask stack, inspection bridge and head, pellicle on its cradle ----
function bench() {
  const bscrews = k.corners(BENCH, 6);
  const tag = { x: BENCH.x + 12, y: BENCH.y + BENCH.d - 30, w: 26, d: 18, r: 1 };
  const tagLines = [0, 1, 2].map((i) => k.lineOnTop([tag.x + 5, tag.y + 5 + i * 4], [tag.x + 20 - i * 5, tag.y + 5 + i * 4], BENCH_TOP + 0.6, P)).join("");
  const benchExtra = L(bscrews.map(([x, y]) => k.ring(x, y, 1.8, BENCH_TOP, P, 12)).join(""), { tone: "lo" }) + Dots(bscrews.map(([x, y]) => at([x, y, BENCH_TOP])), { size: 0.42 }) + L(k.planOutline(k.insetPlan(BENCH, 4), BENCH_TOP, P, 4), { tone: "faint" });
  slab("stand", BENCH, 0, BENCH_TOP, { tone: "mid", steps: 4, bevel: 1, seams: [5], name: "stand.bench", extra: benchExtra });
  slab("stand", tag, BENCH_TOP, 0.6, { tone: "lo", steps: 3, crease: "none", name: "stand.tag", extra: L(tagLines, { tone: "lo", free: true }) + Dots([at([tag.x + 2.5, tag.y + tag.d / 2, BENCH_TOP + 0.6]), at([tag.x + tag.w - 2.5, tag.y + tag.d / 2, BENCH_TOP + 0.6])], { size: 0.4 }) });
  // three kinematic pins under the mask
  for (const [x, y] of [[BM.x + 8, BM.y + 8], [BM.x + BM.w - 8, BM.y + 8], [BM.x + BM.w / 2, BM.y + BM.d - 8]]) cyl("stand", x, y, 2.6, BENCH_TOP, SUB_TOP - 4 - BENCH_TOP, { tone: "mid", steps: 16, name: R.nameFor("stand.kpin") });
  // the mask: LTEM substrate, Mo/Si multilayer, Ru cap, TaBN absorber; each layer stepped back at the near corner
  const sub = BM;
  slab("mask", sub, SUB_TOP - 4, 4, { tone: "hi", steps: 2, bevel: 0.4, crease: "lo", name: "mask.substrate" });
  const ml = { x: BM.x, y: BM.y, w: BM.w - 3, d: BM.d, r: 0.6 };
  const pairs = [];
  for (let i = 1; i < 10; i++) pairs.push(SUB_TOP + ((ML_TOP - SUB_TOP) * i) / 10);
  slab("mask", ml, SUB_TOP, ML_TOP - SUB_TOP, { tone: "hi", steps: 2, crease: "lo", seams: pairs, name: "mask.multilayer" });
  const cap = { x: BM.x, y: BM.y, w: BM.w - 5, d: BM.d, r: 0.5 };
  slab("mask", cap, ML_TOP, CAP_TOP - ML_TOP, { tone: "mid", steps: 2, name: "mask.cap" });
  const abs = { x: BM.x, y: BM.y, w: BM.w - 7, d: BM.d, r: 0.4 };
  const etched = [];
  const n = 3;
  const gap = 2;
  const cell = (abs.w - 8 - gap * (n - 1)) / n;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const plan = { x: abs.x + 4 + i * (cell + gap), y: abs.y + 4 + j * (cell + gap), w: cell, d: cell, r: 0.2 };
    etched.push(k.planOutline(plan, ABS_TOP, P, 2));
    for (let m = 1; m < 4; m++) etched.push(k.planOutline({ x: plan.x + 1.2, y: plan.y + (m * cell) / 4 - 0.5, w: cell - 2.4, d: 1, r: 0.1 }, ABS_TOP, P, 1));
  }
  slab("mask", abs, CAP_TOP, ABS_TOP - CAP_TOP, { tone: "hi", steps: 2, crease: "lo", name: "mask.absorber", extra: `<g class="pm-etch">${L(etched.join(""), { tone: "lo" })}</g>` });

  // inspection bridge: two posts and a beam; the head slides along it
  const postA = { x: BM.x - 22, y: POSTS_Y - 5, w: 10, d: 10, r: 1.5 };
  const postB = { x: BM.x + BM.w + 18, y: POSTS_Y - 5, w: 10, d: 10, r: 1.5 };
  for (const post of [postA, postB]) slab("stand", post, BENCH_TOP, BEAM_Z - BENCH_TOP, { tone: "mid", steps: 3, bevel: 0.5, seams: [BENCH_TOP + 4], name: R.nameFor("stand.post") });
  const beam = { x: postA.x, y: POSTS_Y - 4, w: postB.x + postB.w - postA.x, d: 8, r: 1 };
  const bends = [beam.x + 5, beam.x + beam.w - 5].map((x) => at([x, POSTS_Y, BEAM_Z + 6]));
  slab("stand", beam, BEAM_Z, 6, { tone: "mid", steps: 3, bevel: 0.5, name: "stand.beam", extra: Dots(bends, { size: 0.42 }) });
  // head carriage wraps the beam: drawn as a block above it and a slide plate in front, with the objective below
  const hx = postA.x + postA.w + 1;
  const carriage = { x: hx, y: POSTS_Y - 7, w: 12, d: 14, r: 1.5 };
  slab("inspect", carriage, BEAM_Z + 6, 6, { tone: "hi", steps: 3, bevel: 0.5, crease: "lo", name: "inspect.carriage" });
  const plate = { x: hx, y: POSTS_Y + 4, w: 12, d: 3, r: 0.6 };
  slab("inspect", plate, ABS_TOP + 10, BEAM_Z + 6 - ABS_TOP - 10, { tone: "hi", steps: 2, crease: "lo", name: "inspect.plate" });
  const ox = hx + 6;
  const oy = POSTS_Y + 12;
  const arm = { x: hx + 2, y: POSTS_Y + 7, w: 8, d: 10, r: 1 };
  slab("inspect", arm, BEAM_Z - 8, 6, { tone: "hi", steps: 2, crease: "lo", name: "inspect.arm" });
  const objF = up(ox, oy);
  turned("inspect", objF, [[ABS_TOP + 3, 0], [ABS_TOP + 3, 1.6], [ABS_TOP + 6, 2.8], [ABS_TOP + 6, 4], [BEAM_Z - 8, 4], [BEAM_Z - 8, 0]], { tone: "hi", name: "inspect.objective", inner: G.arcOf(objF, ABS_TOP + 14, 4, P) });

  // pellicle: a frame with a membrane, resting on its cradle; it slides onto the mask
  const pel = { x: BM.x + (BM.w - 7 - PEL_SIZE[0]) / 2, y: BM.y + (BM.d - PEL_SIZE[1]) / 2 - PEL_MOVE[1], w: PEL_SIZE[0], d: PEL_SIZE[1], r: 1 };
  for (const x of [pel.x + 1, pel.x + pel.w - 7]) {
    const rail = { x, y: pel.y + 3, w: 6, d: pel.d - 6, r: 1 };
    slab("stand", rail, BENCH_TOP, ABS_TOP - BENCH_TOP, { tone: "mid", steps: 2, bevel: 0.3, seams: [BENCH_TOP + 2], name: R.nameFor("stand.cradle"), extra: Dots([[x + 3, rail.y + 3, ABS_TOP], [x + 3, rail.y + rail.d - 3, ABS_TOP]].map(at), { size: 0.4 }) });
  }
  const frameH = 2.4;
  // a hollow frame of four bars, and a membrane you can see the pattern through
  const bar = 2.4;
  const inside = k.insetPlan(pel, bar);
  const membrane = `<path class="pm-membrane" d="${k.planOutline({ ...inside, r: 0.3 }, ABS_TOP + frameH, P, 2)}"/>`;
  const vents = [0.25, 0.5, 0.75].map((f) => [pel.x + pel.w * f, pel.y + pel.d]);
  const bars = [
    { x: pel.x, y: pel.y, w: bar, d: pel.d, r: 0.4 },
    { x: pel.x + pel.w - bar, y: pel.y, w: bar, d: pel.d, r: 0.4 },
    { x: pel.x + bar, y: pel.y, w: pel.w - 2 * bar, d: bar, r: 0.2 },
    { x: pel.x + bar, y: pel.y + pel.d - bar, w: pel.w - 2 * bar, d: bar, r: 0.2 },
  ];
  bars.forEach((plan, i) => slab("pellicle", plan, ABS_TOP, frameH, { tone: "hi", steps: 2, crease: "lo", name: `pellicle.bar${i}`, extra: i === 3 ? Dots(vents.map(([x, y]) => at([x, y, ABS_TOP + 1.2])), { size: 0.36, tone: "mid" }) : "" }));
  put("pellicle", centreOf(inside, ABS_TOP + frameH), membrane + L(k.planOutline({ ...inside, r: 0.3 }, ABS_TOP + frameH, P, 2), { tone: "lo" }), [A.slab({ ...inside, r: 0.3 }, ABS_TOP + frameH - 0.1, 0.1, {}, 2)], { name: "pellicle.membrane" });
}

stand();
chamber();
stage();
column();
data();
bench();

if (!process.argv.includes("--fast")) A.settle(R, P, { states: STATES });
R.items.sort((a, b) => a.key - b.key);
const groups = R.items.map((item, index) => {
  const [mx, my, mz] = item.move;
  return `<g class="it" data-piece="${item.piece}" data-k="${item.key.toFixed(2)}" data-m="${mx.toFixed(1)},${my.toFixed(1)},${mz.toFixed(1)}" data-i="${index}">${item.svg}</g>`;
});

// the electron beam: a narrow cone from the final pole piece to the blank, drawn over everything while writing
const tip = [AXIS[0], AXIS[1], 64];
const spot = [AXIS[0], AXIS[1], BLANK_TOP];
const side = G.unit3(G.cross3([0, 0, 1], V));
const [l, r] = [-1, 1].map((sgn) => at(G.add3(tip, G.mul3(side, 3.4 * sgn))));
const s = at(spot);
const beam = `<g class="pm-beam" aria-hidden="true"><path d="M${l[0].toFixed(1)} ${l[1].toFixed(1)}L${r[0].toFixed(1)} ${r[1].toFixed(1)}L${(s[0] + 0.8).toFixed(1)} ${s[1].toFixed(1)}L${(s[0] - 0.8).toFixed(1)} ${s[1].toFixed(1)}Z"/><circle cx="${s[0].toFixed(1)}" cy="${s[1].toFixed(1)}" r="1.4"/></g>`;

const LABEL = `A multi-beam mask writer on an isolation table, with the chamber's near walls and lid cut away. A rack streams pattern data to the electron column, which stands on a bridge over the vacuum chamber: electron gun, aperture plate system, and projection optics down to a pole piece just above the stage. The stage carries a resist-coated mask blank from the load position under the column. A load lock with a reticle pod and a turbo pump sit on the right wall. On a bench in front, the finished EUV mask shows its layers stepped back along one edge, an inspection head on a bridge, and a pellicle on its cradle.`;
const svg = k.figureSvg({ width: W, height: H, label: LABEL, body: [`<g class="pm-layers">${groups.join("")}</g>${beam}`], className: "pm-svg" });

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
  order: ORDER,
  movers: MOVERS,
  ramps: RAMPS,
  steps: M.STEPS,
  dies: DIES.length,
  idle: M.IDLE,
  done: M.DONE,
};

const PARTS = ORDER.map((id, index) => `<button type="button" class="pm-part" data-part="${id}"><span class="pm-num">${String(index + 1).padStart(2, "0")}</span>${PIECES[id].name}</button>`).join("");
const corners = `<div class="iso-plate-corners" aria-hidden="true"><span class="iso-plate-corner" data-corner="fig">Fig 1</span><span class="iso-plate-corner" data-corner="title">Mask writer · design to mask</span><span class="iso-plate-corner" data-corner="readout" data-readout>${M.IDLE}</span></div>`;
const controls = `<div class="pm-controls"><span class="pm-hint">Hover a part · Space plays the process</span><span class="pm-live" aria-live="polite" data-live></span></div>`;
const stage_ = `<div class="pm-stage" tabindex="0" role="slider" aria-label="Multi-beam mask writer and finishing bench. Hover, or use the arrow keys, to pick a part; Space plays or pauses the six process steps; Escape resets to tape-out; the slider below steps through the process." aria-valuemin="0" aria-valuemax="${M.STEPS.length}" aria-valuenow="0" aria-valuetext="${M.IDLE}">${svg}</div>`;
const caption = `An IMS-class multi-beam mask writer. One electron source lights an aperture plate of ${M.WRITER.beamsSide} × ${M.WRITER.beamsSide} holes (${M.fmt(M.BEAMLETS)} beamlets, each switched on or off by the data path), and ${M.WRITER.reduction}:1 projection optics shrink the array to an ${M.WRITER.fieldUm} µm field of ${M.WRITER.beamNm} nm beams at ${M.WRITER.keV} keV on a ${M.BLANK.sideMm} mm blank. The bench in front stands in for the separate develop, etch, inspection, repair and pellicle tools. The EUV mask's layers are drawn far thicker than they are, and its ${M.STACK.pairs} Mo/Si pairs as ten seams; the pellicle is drawn to scale with the mask (${M.PELLICLE.sizeMm[0]} × ${M.PELLICLE.sizeMm[1]} mm). Machine proportions, the rack, cabling and bench are illustrative.`;
const scrub = `<span class="pm-scrub"><button type="button" class="pm-play" data-play aria-label="Play the process"><span class="pm-play-icon" aria-hidden="true"></span><span data-play-text>Play</span></button><input type="range" class="pm-range" data-scrub min="0" max="1000" step="1" value="0" aria-label="Process: 0 is tape-out, 1000 is the finished mask"><span class="pm-step" data-step>01 · ${M.STEPS[0].name}</span></span>`;
const body = `<figure class="iso-figure pm"><div class="iso-plate">${corners}${stage_}${controls}</div><figcaption class="iso-legend">${scrub}<span class="pm-parts">${PARTS}</span><span class="iso-caption">${caption}</span></figcaption></figure>`;

const CSS = readFileSync(join(HERE, "photomask.css"), "utf8");
const LIVE = readFileSync(join(HERE, "live.js"), "utf8").replace("__DATA__", JSON.stringify(DATA));
const out = writeChapter({ slug: "photomask", figure: body, css: CSS, script: LIVE, lesson: LESSON });
console.log("wrote", out.file, `${out.kb} KB`, `${R.items.length} items`, `${R.solids.length} solids`);

A.auditOrExit(R, P, { frames: STATES.filter((st) => typeof st !== "number") });
