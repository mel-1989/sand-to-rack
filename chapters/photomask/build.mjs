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

// aperture plate system housing (illustrative proportions)
const APS_HALF = 30;
const APS_FLOOR = 211;
const APS_LID = 223;
const APS_PLATE = 40;
const APS_PLATE_Z = 213.4;
const APS_PLATE_H = 1.2;
const APS_N = 16;

// rack
const RACK = { x: -212, y: 14, w: 50, d: 72, r: 2 };
const RACK_TOP = 156;

// load lock and turbo pump on the right wall
const LL = { x: 100, y: 30, w: 44, d: 50, r: 3 };
const LL_TOP = 74;

// finishing bench, front right
const BENCH = { x: 4, y: 112, w: 168, d: 146, r: 4 };
const BENCH_TOP = 22;
const BM = { x: 40, y: 126, w: 66, d: 66, r: 0.8 };
// the EUV stack, drawn far thicker than it is (nm-thin layers on a 6.35 mm blank) so each layer reads at 1x
const SUB_BOT = BENCH_TOP + 2;
const SUB_TOP = SUB_BOT + 6;
const ML_BANDS = 10; // ten bands stand for the 40 Mo/Si pairs
const ML_BAND = 2.2;
const ML_TOP = SUB_TOP + ML_BANDS * ML_BAND;
const CAP_TOP = ML_TOP + 1.6;
const ABS_TOP = CAP_TOP + 5;
// the near (+x, +y) corner is cut away: each layer above the glass is notched a little deeper, so the stack reads as a staircase
const NOTCH_ML = 15;
const NOTCH_CAP = 30;
const NOTCH_ABS = 37;
const POSTS_Y = BM.y - 8; // the inspection bridge stands behind the mask, clear of the staircase
const BEAM_Z = ABS_TOP + 22;
const HEAD_MOVE = [56, 0, 0];
const PEL_MOVE = [0, -68, 0];
const PEL_SIZE = [M.PELLICLE.sizeMm[0] * (BM.w / M.BLANK.sideMm), M.PELLICLE.sizeMm[1] * (BM.d / M.BLANK.sideMm)];

const PIECES = Object.fromEntries(Object.entries(M.PIECES).map(([id, p]) => [id, { ...p, move: [0, 0, 0] }]));
PIECES.stage.move = STAGE_MOVE;
PIECES.inspect.move = HEAD_MOVE;
PIECES.pellicle.move = PEL_MOVE;
const ORDER = ["data", "gun", "aps", "optics", "stage", "chamber", "mask", "inspect", "pellicle"];
const MOVERS = ["stage", "inspect", "pellicle"];

// Each mover's share is a pure function of the slider value s (0..1), shared with the page.
const STEP = 1 / M.STEPS.length;
// a ramp is [up0, up1] or [up0, up1, down0, down1]: the stage goes under the column and comes back after the write
const RAMPS = {
  stage: [2 * STEP + 0.005, 2 * STEP + 0.05, 3 * STEP + 0.005, 3 * STEP + 0.05],
  inspect: [4 * STEP + 0.02, 5 * STEP - 0.02],
  pellicle: [5 * STEP + 0.02, 1 - 0.03],
};
const smooth = (t) => t * t * (3 - 2 * t);
const rampOf = (a, b, s) => smooth(Math.min(1, Math.max(0, (s - a) / (b - a))));
const shareAt = (id, s) => {
  const r = RAMPS[id];
  return rampOf(r[0], r[1], s) - (r.length > 2 ? rampOf(r[2], r[3], s) : 0);
};

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
function slab(piece, plan, z, h, { tone = "mid", steps = 4, bevel = 0, seams = [], extra = "", name, crease, bias = 0, cls, className } = {}) {
  const inner = seams.length ? L(seams.map((sz) => k.sideSeam(plan, sz, P, steps)).join(""), { tone: "faint" }) : "";
  const svg = S(k.slabOf(plan, z, h, P, steps, bevel), { tone, inner, className, ...(crease ? { crease } : {}) }) + extra;
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
  // aperture plate system: a square housing with its near walls and lid cut away, the aperture plate on its floor
  turned("aps", COL, [[206, 0], [206, 30], [209, 30], [209, 0]], { tone: "mid", name: "aps.ringLow" });
  const [ax, ay] = AXIS;
  const hs = APS_HALF;
  const floor = { x: ax - hs, y: ay - hs, w: 2 * hs, d: 2 * hs, r: 2 };
  const fscrews = k.corners(floor, 3);
  slab("aps", floor, 209, APS_FLOOR - 209, { tone: "mid", steps: 4, bevel: 0.4, name: "aps.floor", extra: L(fscrews.map(([x, y]) => k.ring(x, y, 1.1, APS_FLOOR, P, 10)).join(""), { tone: "lo" }) });
  slab("aps", { x: ax - hs, y: ay - hs, w: 2 * hs, d: 3, r: 0.6 }, APS_FLOOR, APS_LID - APS_FLOOR, { tone: "mid", steps: 2, name: "aps.wallBack", bias: -20 });
  slab("aps", { x: ax - hs, y: ay - hs + 3, w: 3, d: 2 * hs - 3, r: 0.6 }, APS_FLOOR, APS_LID - APS_FLOOR, { tone: "mid", steps: 2, name: "aps.wallLeft", bias: -20 });
  // cut walls on the two near sides: their tops are the cut, in the low tone
  slab("aps", { x: ax - hs + 3, y: ay + hs - 3, w: 2 * hs - 3, d: 3, r: 0.6 }, APS_FLOOR, 2.2, { tone: "lo", steps: 2, name: "aps.cutFront" });
  slab("aps", { x: ax + hs - 3, y: ay - hs + 3, w: 3, d: 2 * hs - 6, r: 0.6 }, APS_FLOOR, 2.2, { tone: "lo", steps: 2, name: "aps.cutRight" });
  // the aperture plate on four standoffs; its 16 x 16 hole field stands for 512 x 512
  const ph = APS_PLATE / 2;
  const plate = { x: ax - ph, y: ay - ph, w: APS_PLATE, d: APS_PLATE, r: 0.8 };
  for (const [x, y] of k.corners(plate, 2.4)) cyl("aps", x, y, 1.4, APS_FLOOR, APS_PLATE_Z - APS_FLOOR, { tone: "mid", steps: 14, name: R.nameFor("aps.standoff") });
  const holes = [];
  const pitch = (APS_PLATE - 6) / (APS_N - 1);
  for (let j = 0; j < APS_N; j++) for (let i = 0; i < APS_N; i++) {
    const [hx, hy] = at([ax - ph + 3 + i * pitch, ay - ph + 3 + j * pitch, APS_PLATE_Z + APS_PLATE_H]);
    holes.push(`<circle class="pm-ap" data-n="${j * APS_N + i}" cx="${hx.toFixed(2)}" cy="${hy.toFixed(2)}" r="0.55"/>`);
  }
  const frame = L(k.planOutline(k.insetPlan(plate, 1.6), APS_PLATE_Z + APS_PLATE_H, P, 2), { tone: "lo" });
  slab("aps", plate, APS_PLATE_Z, APS_PLATE_H, { tone: "hi", steps: 2, bevel: 0.2, crease: "lo", name: "aps.plate", extra: frame + `<g class="pm-aps">${holes.join("")}</g>` });
  // the lid survives only as a bridge over the back half; the condenser neck stands on it
  const lid = { x: ax - hs, y: ay - hs, w: 2 * hs, d: hs + 8, r: 1 };
  const lscrews = [[ax - hs + 4, ay - hs + 4], [ax + hs - 4, ay - hs + 4], [ax - hs + 4, ay + 4], [ax + hs - 4, ay + 4]];
  slab("aps", lid, APS_LID, 3, { tone: "mid", steps: 3, bevel: 0.5, name: "aps.lid", extra: L(lscrews.map(([x, y]) => k.ring(x, y, 1.2, APS_LID + 3, P, 10)).join(""), { tone: "lo" }) + Dots(lscrews.map(([x, y]) => at([x, y, APS_LID + 3])), { size: 0.38 }) });
  const portF = G.frameOf([ax - hs, ay - 6, APS_FLOOR + 8], [-1, 0, 0], [0, 1, 0], [0, 0, 1]);
  turned("aps", portF, [[0, 0], [0, 5], [6, 5], [6, 6.4], [8, 6.4], [8, 0]], { tone: "mid", name: "aps.port" });
  turned("gun", COL, [[APS_LID + 3, 0], [APS_LID + 3, 8], [APS_LID + 8, 8], [APS_LID + 12, 19], [250, 19], [250, 0]], { name: "gun.condenser", inner: seam(238, 19) });
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
const FIBRE = [];
function data() {
  const plinth = { ...k.insetPlan(RACK, -1.5) };
  slab("data", plinth, 0, 6, { tone: "lo", steps: 3, name: "data.plinth" });
  const body = RACK;
  const doorX = body.x + body.w;
  // door outline, vents and LED row on the +x face
  const vents = [];
  for (let i = 0; i < 6; i++) vents.push(faceRect("x", doorX, body.y + 12, body.y + body.d - 12, 20 + i * 5, 22 + i * 5));
  const door = faceRect("x", doorX, body.y + 4, body.y + body.d - 4, 10, RACK_TOP - 6);
  const panels = [0, 1].map((i) => faceRect("x", doorX, body.y + 10, body.y + body.d - 10, 70 + i * 18, 84 + i * 18)).join("");
  const leds = [];
  for (let i = 0; i < 2; i++) for (let j = 0; j < 8; j++) leds.push(at([doorX, body.y + 14 + j * 5.6, 78 + i * 18]));
  const handle = faceRect("x", doorX, body.y + 6, body.y + 8.4, 40, 64);
  // a display on the door: the drawn layout polygon, then the same shape after OPC/ILT (curved, with assist features)
  const scr = { y0: body.y + 10, y1: body.y + body.d - 10, z0: 108, z1: 140 };
  const screen = faceRect("x", doorX, scr.y0, scr.y1, scr.z0, scr.z1);
  const onFace = (pts) => pathOf(pts.map(([y, z]) => [doorX, y, z]));
  const cy = (scr.y0 + scr.y1) / 2;
  const cz = (scr.z0 + scr.z1) / 2;
  // a T-shaped wire end: (u, v) in screen units around the centre
  const tee = [[-14, 7], [14, 7], [14, 2], [4, 2], [4, -9], [-4, -9], [-4, 2], [-14, 2]];
  const design = onFace(tee.map(([u, v]) => [cy + u, cz + v]));
  // ILT: corner-cut the outline three times, pushing the outer corners out (serifs) and the inner corners in
  let curve = tee.map(([u, v]) => [u * 1.04, v * 1.04]);
  for (let pass = 0; pass < 3; pass++) {
    const next = [];
    curve.forEach((p, i) => {
      const q = curve[(i + 1) % curve.length];
      next.push([0.75 * p[0] + 0.25 * q[0], 0.75 * p[1] + 0.25 * q[1]], [0.25 * p[0] + 0.75 * q[0], 0.25 * p[1] + 0.75 * q[1]]);
    });
    curve = next;
  }
  const ilt = onFace(curve.map(([u, v]) => [cy + u, cz + v]));
  const assists = [[-14, 10.5, 28, 1.4], [-13, -1, 7, 1.2], [6, -1, 7, 1.2], [-8, -12.5, 16, 1.2]].map(([u, v, w, h]) => onFace([[cy + u, cz + v], [cy + u + w, cz + v], [cy + u + w, cz + v + h], [cy + u, cz + v + h]])).join("");
  const display = `<g class="pm-screen"><path class="pm-screen-face" d="${screen}"/><path class="pm-design" d="${design}"/><g class="pm-ilt"><path d="${ilt}"/><path d="${assists}"/></g></g>`;
  slab("data", body, 6, RACK_TOP - 6, { tone: "mid", steps: 3, bevel: 0.8, name: "data.rack", extra: L(door + panels + screen, { tone: "lo" }) + L(vents.join("") + handle, { tone: "faint" }) + display + `<g class="pm-leds">${Dots(leds, { size: 0.5, tone: "lo" })}</g>` });
  // cable glands on the rack roof
  const g1 = [body.x + 32, body.y + 22];
  const g2 = [body.x + 32, body.y + 48];
  for (const [x, y] of [g1, g2]) cyl("data", x, y, 4.2, RACK_TOP, 3, { tone: "mid", steps: 24, name: R.nameFor("data.gland") });
  // data fibre bundle: up from the rack, across to the aperture port
  const portEnd = [AXIS[0] - APS_HALF - 8, AXIS[1] - 6, APS_FLOOR + 8];
  const route1 = G.fillet([[g2[0], g2[1], RACK_TOP + 3], [g2[0], g2[1], 172], [-120, AXIS[1] - 6, APS_FLOOR + 8], portEnd], 14, 10, { P, tube: 1.6 });
  FIBRE.push(...route1);
  tube("data", route1, 1.6, { name: "data.fibre", tone: "mid" });
  // high-voltage cable: up, over, down onto the gun connector
  const hvEnd = [AXIS[0], AXIS[1], 304];
  const route2 = G.fillet([[g1[0], g1[1], RACK_TOP + 3], [g1[0], g1[1], 258], [AXIS[0] - 40, AXIS[1] + 4, 258], [AXIS[0] - 40, AXIS[1] + 4, 314], [AXIS[0] - 14, AXIS[1], 322], [AXIS[0], AXIS[1], 322], hvEnd], 12, 10, { P, tube: 2.2 });
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
  for (const [x, y] of [[BM.x + 8, BM.y + 8], [BM.x + BM.w - 8, BM.y + 8], [BM.x + BM.w / 2, BM.y + BM.d - 8]]) cyl("stand", x, y, 2.6, BENCH_TOP, SUB_BOT - BENCH_TOP, { tone: "mid", steps: 16, name: R.nameFor("stand.kpin") });
  // the mask: LTEM glass substrate, Mo/Si multilayer, Ru cap, TaBN absorber; the near corner cut away as a staircase
  const x1 = BM.x + BM.w;
  const y1 = BM.y + BM.d;
  const notched = (n) => [[BM.x, BM.y], [x1, BM.y], [x1, y1 - n], [x1 - n, y1 - n], [x1 - n, y1], [BM.x, y1]];
  // the visible vertical faces of a notched layer: outer +x, inner +y, inner +x, outer +y
  const facesOf = (n, z0, z1, inset = 0) => [
    faceRect("x", x1, BM.y + inset, y1 - n, z0, z1),
    faceRect("y", y1 - n, x1 - n, x1 - inset, z0, z1),
    faceRect("x", x1 - n, y1 - n, y1, z0, z1),
    faceRect("y", y1, BM.x + inset, x1 - n - 0, z0, z1),
  ].join("");
  const corner = (n, z0, z1) => L(k.segment([x1 - n, y1 - n, z0], [x1 - n, y1 - n, z1], P), { tone: "lo" });
  function layer(name, n, z0, z1, cls, extra = "", tone = "hi") {
    const ring = notched(n);
    const svg = S(k.extrude(ring, z0, z1 - z0, P, { convex: false }), { tone, crease: "lo", className: cls }) + corner(n, z0, z1) + extra;
    put("mask", [BM.x + BM.w / 2, BM.y + BM.d / 2, (z0 + z1) / 2], svg, [A.extruded(ring, z0, z1 - z0, {})], { name });
  }
  slab("mask", BM, SUB_BOT, SUB_TOP - SUB_BOT, { tone: "hi", steps: 2, bevel: 0.4, crease: "lo", name: "mask.substrate", className: "pm-l-sub" });
  // alternating Mo bands painted over the Si-toned multilayer on every face that looks at the viewer
  const bands = [];
  for (let i = 0; i < ML_BANDS; i += 2) bands.push(facesOf(NOTCH_ML, SUB_TOP + i * ML_BAND, SUB_TOP + (i + 1) * ML_BAND));
  layer("mask.multilayer", NOTCH_ML, SUB_TOP, ML_TOP, "pm-l-si", `<path class="pm-mo" d="${bands.join("")}"/>`);
  layer("mask.cap", NOTCH_CAP, ML_TOP, CAP_TOP, "pm-l-cap", "", "hi");
  // absorber openings, etched down to the cap: a line pattern that runs out through the cut faces
  const xn = x1 - NOTCH_ABS;
  const yn = y1 - NOTCH_ABS;
  const trenches = [];
  const clips = [];
  const TW = 4.2;
  const trench = (xa, xb, ya, yb, face) => {
    const id = `pm-tr${trenches.length}`;
    const top = pathOf([[xa, ya, ABS_TOP], [xb, ya, ABS_TOP], [xb, yb, ABS_TOP], [xa, yb, ABS_TOP]]);
    const mouth = face === "y" ? faceRect("y", yb, xa, xb, CAP_TOP, ABS_TOP) : face === "x" ? faceRect("x", xb, ya, yb, CAP_TOP, ABS_TOP) : "";
    clips.push(`<clipPath id="${id}"><path d="${top}${mouth}"/></clipPath>`);
    const floor = pathOf([[xa, ya, CAP_TOP], [xb, ya, CAP_TOP], [xb, yb, CAP_TOP], [xa, yb, CAP_TOP]]);
    const walls = faceRect("x", xa, ya, yb, CAP_TOP, ABS_TOP) + faceRect("y", ya, xa, xb, CAP_TOP, ABS_TOP);
    trenches.push(`<g clip-path="url(#${id})"><path class="pm-floor" d="${floor}"/><path class="pm-wall" d="${walls}"/></g>` + L(top + mouth, { tone: "lo" }));
  };
  for (let x = BM.x + 5; x + TW <= x1 - 4; x += 8.4) {
    if (x >= xn + 1) trench(x, x + TW, BM.y + 5, yn, "y");
    else if (x + TW <= xn - 1) trench(x, x + TW, BM.y + 5, yn - 4, "");
  }
  for (let y = yn + 4; y + TW <= y1 - 4; y += 8.4) trench(BM.x + 5, xn, y, y + TW, "x");
  layer("mask.absorber", NOTCH_ABS, CAP_TOP, ABS_TOP, "pm-l-abs", `<defs>${clips.join("")}</defs><g class="pm-etch">${trenches.join("")}</g>`, "hi");

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
  const oy = POSTS_Y + 20;
  const arm = { x: hx + 2, y: POSTS_Y + 7, w: 8, d: 18, r: 1 };
  slab("inspect", arm, BEAM_Z - 8, 6, { tone: "hi", steps: 2, crease: "lo", name: "inspect.arm" });
  const objF = up(ox, oy);
  turned("inspect", objF, [[ABS_TOP + 3, 0], [ABS_TOP + 3, 1.6], [ABS_TOP + 6, 2.8], [ABS_TOP + 6, 4], [BEAM_Z - 8, 4], [BEAM_Z - 8, 0]], { tone: "hi", name: "inspect.objective", inner: G.arcOf(objF, ABS_TOP + 14, 4, P) });

  // pellicle: a frame with a membrane, resting on its cradle; it slides onto the mask
  const pel = { x: BM.x + (BM.w - PEL_SIZE[0]) / 2, y: BM.y + (BM.d - PEL_SIZE[1]) / 2 - PEL_MOVE[1], w: PEL_SIZE[0], d: PEL_SIZE[1], r: 1 };
  // four slim posts hold the pellicle frame at the mask's height until it slides on
  for (const [x, y] of k.corners(pel, 1.8)) cyl("stand", x, y, 1.1, BENCH_TOP, ABS_TOP - BENCH_TOP, { tone: "mid", steps: 14, name: R.nameFor("stand.cradle") });
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

// the electron beam: a narrow cone of beamlets from the final pole piece to a gridded spot on the blank, drawn over everything while writing
const tip = [AXIS[0], AXIS[1], 64];
const side = G.unit3(G.cross3([0, 0, 1], V));
const SPOT = 2.4; // half-size of the drawn beam-array spot (illustrative: 81.92 µm is far too small to see)
const spotGrid = [];
for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) spotGrid.push([AXIS[0] - SPOT + 0.6 + (i * (2 * SPOT - 1.2)) / 3, AXIS[1] - SPOT + 0.6 + (j * (2 * SPOT - 1.2)) / 3, BLANK_TOP]);
const fan = [-1, -0.5, 0, 0.5, 1].map((t) => {
  const top = at(G.add3(tip, G.mul3(side, 3.2 * t)));
  const foot = at(G.add3([AXIS[0], AXIS[1], BLANK_TOP], G.mul3(side, SPOT * 0.8 * t)));
  return `M${(top[0] - 0.22).toFixed(2)} ${top[1].toFixed(2)}L${(top[0] + 0.22).toFixed(2)} ${top[1].toFixed(2)}L${(foot[0] + 0.12).toFixed(2)} ${foot[1].toFixed(2)}L${(foot[0] - 0.12).toFixed(2)} ${foot[1].toFixed(2)}Z`;
});
const spotSquare = pathOf([[AXIS[0] - SPOT, AXIS[1] - SPOT, BLANK_TOP], [AXIS[0] + SPOT, AXIS[1] - SPOT, BLANK_TOP], [AXIS[0] + SPOT, AXIS[1] + SPOT, BLANK_TOP], [AXIS[0] - SPOT, AXIS[1] + SPOT, BLANK_TOP]]);
const beam = `<g class="pm-beam" aria-hidden="true"><path class="pm-beam-fan" d="${fan.join("")}"/><path class="pm-beam-spot" d="${spotSquare}"/>${spotGrid.map((p, i) => {
  const [cx, cy] = at(p);
  return `<circle class="pm-beamlet" data-n="${i}" cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="0.42"/>`;
}).join("")}</g>`;

// data packets that run along the fibre during tape-out and fracture, drawn over everything (the fibre is above the chamber)
const FIBRE_PATH = FIBRE.slice(0, -2).map((p) => at(p).map((v) => Number(v.toFixed(2))));
const pulse = `<g class="pm-pulse" aria-hidden="true">${[0, 1, 2].map((i) => `<circle class="pm-packet" data-n="${i}" cx="0" cy="0" r="1.5"/>`).join("")}</g>`;

const LABEL = `A multi-beam mask writer on an isolation table, with the chamber's near walls and lid cut away. A rack, whose display shows a layout shape before and after OPC/ILT correction, streams pattern data to the electron column, which stands on a bridge over the vacuum chamber: electron gun, an aperture plate system cut open to show the plate and its grid of holes, and projection optics down to a pole piece just above the stage. The stage carries a resist-coated mask blank from the load position under the column and back after the write. A load lock with a reticle pod and a turbo pump sit on the right wall. On a bench in front, the EUV mask has its near corner cut away as a staircase that shows its layers (glass substrate, Mo/Si multilayer in alternating bands, Ru cap, TaBN absorber, with the etched openings running down to the cap), with an inspection head on a bridge behind it and a pellicle on its cradle in front.`;
const svg = k.figureSvg({ width: W, height: H, label: LABEL, body: [`<g class="pm-layers">${groups.join("")}</g>${beam}${pulse}`], className: "pm-svg" });

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
  stripes: 4,
  fibre: FIBRE_PATH,
  holes: APS_N * APS_N,
  idle: M.IDLE,
  done: M.DONE,
};

const PARTS = ORDER.map((id, index) => `<button type="button" class="pm-part" data-part="${id}"><span class="pm-num">${String(index + 1).padStart(2, "0")}</span>${PIECES[id].name}</button>`).join("");
const corners = `<div class="iso-plate-corners" aria-hidden="true"><span class="iso-plate-corner" data-corner="fig">Fig 1</span><span class="iso-plate-corner" data-corner="title">Mask writer · design to mask</span><span class="iso-plate-corner" data-corner="readout" data-readout>${M.IDLE}</span></div>`;
const controls = `<div class="pm-controls"><span class="pm-hint">Hover a part · Space plays the process</span><span class="pm-live" aria-live="polite" data-live></span></div>`;
const stage_ = `<div class="pm-stage" tabindex="0" role="slider" aria-label="Multi-beam mask writer and finishing bench. Hover, or use the arrow keys, to pick a part; Space plays or pauses the six process steps; Escape resets to tape-out; the slider below steps through the process." aria-valuemin="0" aria-valuemax="${M.STEPS.length}" aria-valuenow="0" aria-valuetext="${M.IDLE}">${svg}</div>`;
const caption = `An IMS-class multi-beam mask writer, with the published specs of the first production generation, the MBMW-101 (2016). One electron source lights an aperture plate of ${M.WRITER.beamsSide} × ${M.WRITER.beamsSide} holes (${M.fmt(M.BEAMLETS)} beamlets, each switched on or off by the data path), and ${M.WRITER.reduction}:1 projection optics shrink the array to an ${M.WRITER.fieldUm} µm field of ${M.WRITER.beamNm} nm beams at ${M.WRITER.keV} keV on a ${M.BLANK.sideMm} mm blank. The bench in front stands in for the separate develop, etch, inspection, repair and pellicle tools. The cut-away aperture plate shows a 16 × 16 field of holes standing for the real ${M.WRITER.beamsSide} × ${M.WRITER.beamsSide}, the gridded spot on the blank stands for the ${M.WRITER.fieldUm} µm beam array, and the 4 × 4 fields that light up on the blank show the stage writing it in four stripes (illustrative). The rack's display shows one T-shaped layout feature before and after OPC/ILT (illustrative). The EUV mask's near corner is cut away to show its layers, drawn far thicker than they are, and its ${M.STACK.pairs} Mo/Si pairs as ten alternating bands; the pellicle is drawn to scale with the mask (${M.PELLICLE.sizeMm[0]} × ${M.PELLICLE.sizeMm[1]} mm). Machine proportions, the rack, cabling and bench are illustrative.`;
const scrub = `<span class="pm-scrub"><button type="button" class="pm-play" data-play aria-label="Play the process"><span class="pm-play-icon" aria-hidden="true"></span><span data-play-text>Play</span></button><input type="range" class="pm-range" data-scrub min="0" max="1000" step="1" value="0" aria-label="Process: 0 is tape-out, 1000 is the finished mask"><span class="pm-step" data-step>01 · ${M.STEPS[0].name}</span></span>`;
const body = `<figure class="iso-figure pm"><div class="iso-plate">${corners}${stage_}${controls}</div><figcaption class="iso-legend">${scrub}<span class="pm-parts">${PARTS}</span><span class="iso-caption">${caption}</span></figcaption></figure>`;

const CSS = readFileSync(join(HERE, "photomask.css"), "utf8");
const LIVE = readFileSync(join(HERE, "live.js"), "utf8").replace("__DATA__", JSON.stringify(DATA));
const out = writeChapter({ slug: "photomask", figure: body, css: CSS, script: LIVE, lesson: LESSON });
console.log("wrote", out.file, `${out.kb} KB`, `${R.items.length} items`, `${R.solids.length} solids`);

A.auditOrExit(R, P, { frames: STATES.filter((st) => typeof st !== "number") });
