// Inside the fab: an OHT vehicle lowers a FOUP onto a load port, the EFEM robot carries one wafer into a tool and back.
// node build.mjs [--fast] [--audit]
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as M from "./model.mjs";

import { k, G, A, Tube, kitScript } from "../../site/kit.mjs";
import { writeChapter } from "../../site/shell.mjs";
import { LESSON } from "./lesson.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const POSE_SRC = readFileSync(join(HERE, "pose.js"), "utf8");
const { poseAt, offsetsOf } = new Function(`${POSE_SRC}; return { poseAt, offsetsOf };`)();

// ---- world (1 unit = 10 mm; x, y on the floor, z up) ----
const W = 640;
const H = 760;
const AZIMUTH = 45;
const ELEVATION = 36;

const FLOOR = { x: -160, y: -170, w: 270, d: 290, r: 0 };
const TILE = 60; // illustrative 600 mm raised-floor tile
const FLOOR_T = 4;
const PLENUM = 30;
const SUB_T = 6;

const XF = -59.5; // FOUP, rail and hoist centre line
const DROP = M.HOIST_DROP;
const DATUM = M.DATUM; // 90
const FOUP = { x: -77, y: -20, w: 34.8, d: 40, r: 3 }; // shell, front face at x = -42.2 (illustrative size)
const FOUP_Z = DATUM + 0.6;
const FOUP_TOP = 124;
const DOOR = { x: -42.2, y: -16.5, w: 2.7, d: 33, r: 1 };
const DOOR_Z = 92.5;
const DOOR_H = 30;
const HOLE = { y0: -17, y1: 17, z0: 92, z1: 123 };
const PLATE_X = [-41, -38];
const PW = M.PORT_W / 2;
const WAFER_X = -60;
const SLOT = (i) => M.SLOT0 + i * M.PITCH;
const PICK = M.PICK_SLOT - 1;

const EFEM = { x: -38, y: -42, w: 90, d: 84, r: 0 };
const BASE_TOP = 6;
const WALL_Y = [-45, -42];
const SLIT = { x0: -9, x1: 29, z0: 103, z1: 111 };
const EFEM_TOP = 196;
const SHOULDER = [10, 0];
const LINK = 26;
const FORK = 28; // wrist to wafer centre
const FORK_Z = 105.6;
const FOUP_REACH = Math.abs(WAFER_X - SHOULDER[0]) - FORK; // 42
const TOOL_Y = -60;
const TOOL_REACH = Math.abs(TOOL_Y - SHOULDER[1]) - FORK; // 32

const TOOL = { x: -36, y: -140, w: 136, d: 95, r: 2 };
const TOOL_H = 130;
const STOCKER = { x: -158, y: 50, w: 54, d: 66, r: 2 };
const STOCKER_H = 196;
const SPORT_Y = 80;

const CEIL = 290;
const RAIL = { x: XF - 7.5, y: -156, w: 15, d: 266, r: 0.6 };
const RAIL_Z = 260;
const RAIL_TOP = 274;
const HOUSE = { x: XF - 14.5, y: -26, w: 29, d: 52, r: 2 };
const HOUSE_Z = 243;
const COVER_Z = 192;
const GRIP = { x: XF - 8.5, y: -11, w: 17, d: 22, r: 1.2 };
const GRIP_Z = 129;
const GRIP_TOP = 133;

const T = { steps: M.STEPS.map(({ id, sec }) => ({ id, sec })), drop: DROP, foupReach: FOUP_REACH, toolReach: TOOL_REACH };

const P = k.fitProjection(
  [
    ...k.boxCorners(FLOOR, -FLOOR_T - PLENUM - SUB_T, 0),
    ...k.boxCorners(FLOOR, CEIL, CEIL + 26),
  ],
  W,
  H,
  { pad: 18, azimuth: AZIMUTH, elevation: ELEVATION },
);
const V = G.viewOf(P);
const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);
const centreOf = (plan, z) => [plan.x + plan.w / 2, plan.y + plan.d / 2, z];
const quad = (pts) => `M${pts.map((p) => at(p).map((v) => v.toFixed(2)).join(" ")).join("L")}Z`;

const R = A.recorder(P);
function put(piece, ref, svg, shapes, { bias = 0, name, mv = "" } = {}) {
  const id = name ?? R.nameFor(`${piece}.item`);
  shapes.forEach((shape) => (shape.name = shape.name ?? id));
  R.put({ piece, at: ref, bias, svg, move: [0, 0, 0], shapes: shapes.map(R.solid), name: id, mv });
}
const slabShape = (plan, z, h, steps = 4) => A.slab(plan, z, h, {}, steps);
const cylShape = (x, y, r, z, h) => A.cylinder(x, y, r, z, h, {});
const box = (plan, z, h, style = {}, steps = 3, bevel = 0.4) => S(k.slabOf(plan, z, h, P, steps, bevel), style);
const seam = (plan, z, steps = 3) => k.sideSeam(plan, z, P, steps);
const screws = (pts, z, size = 0.45) => Dots(pts.map(([x, y]) => at([x, y, z])), { size });
const ringScrews = (pts, z, r = 1.4) => L(pts.map(([x, y]) => k.ring(x, y, r, z, P, 12)).join(""), { tone: "lo" });
const byDepth = (pts, z = 0) => [...pts].sort((a, b) => k.depthOf([a[0], a[1], z], P) - k.depthOf([b[0], b[1], z], P));
const plan = (x0, x1, y0, y1, r = 0.4) => ({ x: x0, y: y0, w: x1 - x0, d: y1 - y0, r });
// a vertical slot or panel line on the +y face (y fixed) or +x face (x fixed), closed so it has no ends
const slotY = (y, x0, x1, z0, z1) => quad([[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]]);
const slotX = (x, y0, y1, z0, z1) => quad([[x, y0, z0], [x, y1, z0], [x, y1, z1], [x, y0, z1]]);

// ---------------------------------------------------------------------------------------------
// bay: raised floor with its plenum, the ceiling filter units and the rail that hangs from them
function floor() {
  const z0 = -FLOOR_T - PLENUM - SUB_T;
  let svg = `<path class="iso-halo" d="${k.haloOf(FLOOR, z0, SUB_T, P)}"/>`;
  svg += box(FLOOR, z0, SUB_T, { tone: "lo", inner: L(seam(FLOOR, z0 + 2, 2), { tone: "faint" }) }, 2, 0.6);
  put("bay", centreOf(FLOOR, z0), svg, [A.slab(FLOOR, z0, SUB_T, { name: "stand.subfloor" }, 2)], { name: "stand.subfloor", bias: -900 });
  // pedestals along the two cut edges, under every tile corner
  const pz = z0 + SUB_T;
  const peds = [];
  for (let x = FLOOR.x + TILE; x < FLOOR.x + FLOOR.w; x += TILE) peds.push([x, FLOOR.y + FLOOR.d - 3]);
  for (let y = FLOOR.y + TILE; y < FLOOR.y + FLOOR.d; y += TILE) peds.push([FLOOR.x + FLOOR.w - 3, y]);
  peds.push([FLOOR.x + FLOOR.w - 3, FLOOR.y + FLOOR.d - 3]);
  for (const [x, y] of byDepth(peds)) {
    const s =
      S(k.cylinder(x, y, 3.2, pz, 1, P, 20), { tone: "lo" }) +
      S(k.cylinder(x, y, 1.3, pz + 1, PLENUM - 3, P, 14), { tone: "mid", crease: "none" }) +
      S(k.cylinder(x, y, 1.9, pz + PLENUM - 6, 2, P, 6), { tone: "mid" }) +
      S(k.cylinder(x, y, 3, pz + PLENUM - 2, 2, P, 20), { tone: "mid" });
    put("bay", [x, y, pz + 10], s, [A.cylinder(x, y, 3.2, pz, PLENUM, { name: "stand.pedestal" })], { name: R.nameFor("stand.pedestal") });
  }
  // tile layer
  const tz = -FLOOR_T;
  let tiles = box(FLOOR, tz, FLOOR_T, { tone: "mid", inner: L(seam(FLOOR, tz + 1.4, 2), { tone: "faint" }) }, 2, 0.6);
  const lines = [];
  const perf = [];
  for (let x = FLOOR.x; x < FLOOR.x + FLOOR.w - 1; x += TILE)
    for (let y = FLOOR.y; y < FLOOR.y + FLOOR.d - 1; y += TILE) {
      const cell = plan(x + 0.6, Math.min(x + TILE, FLOOR.x + FLOOR.w) - 0.6, y + 0.6, Math.min(y + TILE, FLOOR.y + FLOOR.d) - 0.6, 0.8);
      lines.push(k.planOutline(cell, 0, P, 2));
      const i = Math.round((x - FLOOR.x) / TILE);
      const j = Math.round((y - FLOOR.y) / TILE);
      if (cell.w > 40 && cell.d > 40 && (i + j) % 2 === 0 && !(i <= 1 && j <= 1)) {
        lines.push(k.planOutline(k.insetPlan(cell, 6), 0, P, 2));
        for (let a = cell.x + 9; a < cell.x + cell.w - 8; a += 3.4) for (let b = cell.y + 9; b < cell.y + cell.d - 8; b += 3.4) perf.push(at([a, b, 0]));
      }
    }
  tiles += L(lines.join(""), { tone: "faint" }) + Dots(perf, { size: 0.42, tone: "lo" });
  // tile-lifter label plate and ruler near the front edge
  const strip = { x: 70, y: FLOOR.y + FLOOR.d - 11, w: 62, d: 6, r: 0.8 };
  tiles += box(strip, 0, 0.5, { tone: "lo", crease: "none" }, 2, 0);
  const t = k.topTicks(strip.x + 2, strip.x + strip.w - 2, 2, 5, strip.y + 0.6, 0.5, [1.8, 3.2], P);
  tiles += L(t.minor, { tone: "lo" }) + L(t.major, { tone: "mid" });
  const label = { x: 20, y: FLOOR.y + FLOOR.d - 14, w: 40, d: 10, r: 1 };
  tiles += box(label, 0, 0.6, { tone: "lo", crease: "none" }, 2, 0) + L(k.planOutline(k.insetPlan(label, 1.2), 0.6, P, 2), { tone: "faint" });
  tiles += L([0, 1, 2].map((i) => k.lineOnTop([label.x + 5, label.y + 3 + i * 2.2], [label.x + 30 - i * 8, label.y + 3 + i * 2.2], 0.6, P)).join(""), { tone: "lo", free: true });
  tiles += screws([[label.x + 2.4, label.y + 5], [label.x + label.w - 2.4, label.y + 5]], 0.6, 0.4);
  put("bay", centreOf(FLOOR, tz), tiles, [A.slab(FLOOR, tz, FLOOR_T, { name: "stand.floor" }, 2)], { name: "stand.floor", bias: -800 });
}

const CEIL_BACK = plan(-160, 110, -170, -156, 0);
const CEIL_LEFT = plan(-160, -126, -156, 120, 0);
function ceiling() {
  for (const [cname, strip, along] of [["back", CEIL_BACK, "x"], ["left", CEIL_LEFT, "y"]]) {
    // T-bar grid and the filter units that sit in it
    let svg = box(strip, CEIL, 4, { tone: "lo", inner: L(seam(strip, CEIL + 2, 2), { tone: "faint" }) }, 2, 0.4);
    const shapes = [A.slab(strip, CEIL, 4, {}, 2)];
    put("bay", centreOf(strip, CEIL), svg, shapes, { name: `stand.ceiling-${cname}` });
    const n = along === "x" ? 4 : 4;
    const len = along === "x" ? strip.w : strip.d;
    const cells = [];
    for (let i = 0; i < n; i++) {
      const a = (len / n) * i + 1.5;
      const b = (len / n) * (i + 1) - 1.5;
      cells.push(along === "x" ? plan(strip.x + a, strip.x + b, strip.y + 1.5, strip.y + strip.d - 1.5, 1) : plan(strip.x + 1.5, strip.x + strip.w - 1.5, strip.y + a, strip.y + b, 1));
    }
    for (const cell of [...cells].sort((p, q) => k.depthOf(centreOf(p, 0), P) - k.depthOf(centreOf(q, 0), P))) {
      const fz = CEIL + 4;
      const hood = k.insetPlan(cell, 3);
      const [cx, cy] = [cell.x + cell.w / 2, cell.y + cell.d / 2];
      let f = box(cell, fz, 8, { tone: "mid", inner: L(seam(cell, fz + 2.2, 3), { tone: "faint" }) }, 3, 0.5);
      f += box(hood, fz + 8, 3, { tone: "mid" }, 3, 0.4);
      f += S(k.cylinder(cx, cy, 6, fz + 11, 4, P, 28, 0.3), { tone: "mid" });
      f += L(k.knurl(cx, cy, 6, fz + 11.6, fz + 14.4, 24, P), { tone: "lo" });
      f += L(k.ring(cx, cy, 2, fz + 15, P, 14), { tone: "lo" });
      const box2 = along === "x" ? plan(cell.x + 4, cell.x + 12, cell.y + 3, cell.y + 8, 0.5) : plan(cell.x + 3, cell.x + 8, cell.y + 4, cell.y + 12, 0.5);
      f += box(box2, fz + 11, 3, { tone: "lo" }, 2, 0.2);
      f += screws(k.corners(cell, 2.2), fz + 8, 0.42);
      put("bay", [cx, cy, fz + 6], f, [A.slab(cell, fz, 8, {}, 3), A.slab(hood, fz + 8, 3, {}, 3), A.cylinder(cx, cy, 6, fz + 11, 4, {}), A.slab(box2, fz + 11, 3, {}, 2)], { name: R.nameFor(`stand.ffu-${cname}`) });
    }
  }
  // the rail and its hangers
  for (const hy of [-140, -66, 8, 96]) {
    const beam = plan(-126, XF + 10, hy - 2.5, hy + 2.5, 0.4);
    let svg = box(beam, CEIL, 4, { tone: "mid" }, 2, 0.3);
    const shapes = [A.slab(beam, CEIL, 4, {}, 2)];
    for (const rx of [XF - 4.5, XF + 4.5]) {
      svg += S(k.cylinder(rx, hy, 0.9, RAIL_TOP + 2, CEIL - RAIL_TOP - 2, P, 10), { tone: "mid", crease: "none" });
      svg += S(k.cylinder(rx, hy, 1.7, CEIL - 3, 1.2, P, 6), { tone: "mid" });
      shapes.push(A.cylinder(rx, hy, 0.9, RAIL_TOP + 2, CEIL - RAIL_TOP - 2, {}));
    }
    const clamp = plan(XF - 8.5, XF + 8.5, hy - 3, hy + 3, 0.4);
    svg = box(clamp, RAIL_TOP, 2, { tone: "mid" }, 2, 0.3) + svg;
    shapes.push(A.slab(clamp, RAIL_TOP, 2, {}, 2));
    put("oht", [XF, hy, RAIL_TOP + 8], svg, shapes, { name: R.nameFor("stand.hanger") });
  }
  // rail: a closed box track with joints every 60 cm and the non-contact power feeder along its side
  const joints = [];
  for (let y = RAIL.y + 60; y < RAIL.y + RAIL.d; y += 60) joints.push(slotX(RAIL.x + RAIL.w, y - 0.3, y + 0.3, RAIL_Z, RAIL_TOP));
  const feeder = seam(RAIL, RAIL_Z + 4, 2);
  let rail = box(RAIL, RAIL_Z, RAIL_TOP - RAIL_Z, { tone: "mid", inner: L(seam(RAIL, RAIL_Z + 9, 2), { tone: "faint" }) + L(joints.join(""), { tone: "faint" }) + L(feeder, { tone: "lo" }) }, 2, 0.5);
  const codes = [];
  for (let y = RAIL.y + 8; y < RAIL.y + RAIL.d - 4; y += 12) codes.push(at([RAIL.x + RAIL.w / 2, y, RAIL_TOP]));
  rail += L(k.lineOnTop([RAIL.x + RAIL.w / 2, RAIL.y], [RAIL.x + RAIL.w / 2, RAIL.y + RAIL.d], RAIL_TOP, P), { tone: "faint" }) + Dots(codes, { size: 0.42, tone: "lo" });
  put("oht", centreOf(RAIL, RAIL_Z), rail, [A.slab(RAIL, RAIL_Z, RAIL_TOP - RAIL_Z, {}, 2)], { name: "stand.rail" });
}

// ---------------------------------------------------------------------------------------------
// stocker with its OHT port, at the far end of the rail
function stocker() {
  const s = STOCKER;
  const panels = [];
  for (const z of [60, 120, 180]) panels.push(seam(s, z, 3));
  let svg = box(s, 0, STOCKER_H, { tone: "mid", inner: L(panels.join(""), { tone: "faint" }) }, 3, 0.8);
  // window on the +x face showing shelves of FOUPs, and vents on +y
  const wx = s.x + s.w;
  svg += L(slotX(wx, s.y + 12, s.y + s.d - 12, 130, 172), { tone: "lo" });
  const shelf = [];
  for (const z of [144, 158]) shelf.push(k.segment([wx, s.y + 12, z], [wx, s.y + s.d - 12, z], P));
  svg += L(shelf.join(""), { tone: "faint" });
  const vents = [];
  for (let i = 0; i < 6; i++) vents.push(slotY(s.y + s.d, s.x + 10, s.x + s.w - 10, 196 + i * 4, 197.6 + i * 4));
  svg += L(vents.join(""), { tone: "lo" });
  svg += box(k.insetPlan(s, 4), STOCKER_H, 3, { tone: "mid" }, 3, 0.4);
  svg += screws(k.corners(s, 2.5), STOCKER_H, 0.45);
  put("stocker", centreOf(s, 0), svg, [A.slab(s, 0, STOCKER_H, { name: "stand.stocker" }, 3), A.slab(k.insetPlan(s, 4), STOCKER_H, 3, {}, 3)], { name: "stand.stocker" });
  // port unit: conveyor neck, cabinet, stage with kinematic pins
  const neck = plan(s.x + s.w, -79, SPORT_Y - 14, SPORT_Y + 14, 0.6);
  const cab = plan(-79, -45, SPORT_Y - 18, SPORT_Y + 18, 1);
  const stage = plan(-79, -41, SPORT_Y - 21, SPORT_Y + 21, 1.2);
  let port = box(neck, 58, 26, { tone: "mid", inner: L(seam(neck, 70, 2), { tone: "faint" }) }, 2, 0.4);
  port += box(cab, 0, DATUM - 4, { tone: "mid", inner: L(seam(cab, 30, 2), { tone: "faint" }) }, 2, 0.6);
  port += box(stage, DATUM - 4, 4, { tone: "mid" }, 3, 0.5);
  const pins = [[-70, SPORT_Y - 12], [-70, SPORT_Y + 12], [-50, SPORT_Y]];
  for (const [x, y] of byDepth(pins)) port += S(k.cylinder(x, y, 1.6, DATUM, 0.6, P, 12), { tone: "hi", crease: "lo" });
  port += ringScrews(k.corners(stage, 2.6), DATUM, 1) + screws(k.corners(stage, 2.6), DATUM, 0.38);
  port += L(slotY(SPORT_Y + 18, -74, -54, 50, 72), { tone: "lo" });
  put("stocker", [-60, SPORT_Y, 40], port, [A.slab(neck, 58, 26, {}, 2), A.slab(cab, 0, DATUM - 4, {}, 2), A.slab(stage, DATUM - 4, 4, {}, 3), ...pins.map(([x, y]) => A.cylinder(x, y, 1.6, DATUM, 0.6, {}))], { name: "stand.stocker-port" });
}

// ---------------------------------------------------------------------------------------------
// process tool behind the EFEM: panels, chamber lids, a touch screen and a signal tower
function tool() {
  const t = TOOL;
  const fy = t.y + t.d;
  const rx = t.x + t.w;
  const lines = [seam(t, 22, 3), seam(t, 108, 3)];
  lines.push(slotY(fy, 80, 80.6, 0, 108), slotX(rx, -108, -107.4, 0, 108), slotX(rx, -74, -73.4, 0, 108));
  let svg = `<path class="iso-halo" d="${k.haloOf(t, 0, 4, P)}"/>` + box(t, 0, TOOL_H, { tone: "mid", inner: L(lines.join(""), { tone: "faint" }) }, 3, 0.9);
  // service doors on +x with handles and louvres
  const louvres = [];
  for (let i = 0; i < 7; i++) louvres.push(slotX(rx, -132, -114, 30 + i * 4.2, 31.6 + i * 4.2), slotX(rx, -100, -82, 30 + i * 4.2, 31.6 + i * 4.2));
  svg += L(louvres.join(""), { tone: "lo" });
  // touch screen on the +y face, recessed
  const scr = [[58, fy, 84], [76, fy, 84], [76, fy, 100], [58, fy, 100]];
  svg += `<path class="iso-face fa-screen" d="${quad(scr)}"/>` + L(quad(scr), { tone: "lo" });
  svg += L(slotY(fy, 60, 74, 86, 98), { tone: "faint" });
  // label plate on the +y face
  svg += L(slotY(fy, 84, 96, 56, 64), { tone: "lo" }) + L([58.4, 60.4, 62.2].map((z, i) => k.segment([85.5, fy, z], [94 - i * 3, fy, z], P)).join(""), { tone: "lo", free: true });
  svg += screws([[t.x + 4, t.y + 4], [rx - 4, t.y + 4], [rx - 4, fy - 4], [t.x + 4, fy - 4]], TOOL_H, 0.45);
  put("tool", centreOf(t, 0), svg, [A.slab(t, 0, TOOL_H, { name: "stand.tool" }, 3)], { name: "stand.tool" });
  // chamber lids on top, each with a hinge block and lift handle
  const lids = [[14, -112, 18], [56, -110, 18], [62, -70, 13]];
  for (const [x, y, r] of lids) {
    let l = S(k.cylinder(x, y, r, TOOL_H, 4, P, 56, 0.5), { tone: "mid", inner: L(k.sideArc(x, y, r, TOOL_H + 1.6, P, 40), { tone: "faint" }) });
    l += S(k.cylinder(x, y, r - 5, TOOL_H + 4, 3, P, 48, 0.4), { tone: "mid" });
    l += L(k.ring(x, y, r - 8, TOOL_H + 7, P, 40), { tone: "lo" });
    const bolts = [];
    for (let i = 0; i < 12; i++) bolts.push([x + (r - 2.2) * Math.cos((i / 12) * 2 * Math.PI), y + (r - 2.2) * Math.sin((i / 12) * 2 * Math.PI)]);
    l += screws(bolts, TOOL_H + 4, 0.4);
    l += S(k.cylinder(x, y, 3, TOOL_H + 7, 3, P, 16), { tone: "mid" });
    put("tool", [x, y, TOOL_H + 3], l, [A.cylinder(x, y, r, TOOL_H, 4, {}), A.cylinder(x, y, r - 5, TOOL_H + 4, 3, {}), A.cylinder(x, y, 3, TOOL_H + 7, 3, {})], { name: R.nameFor("tool.lid") });
  }
  // gas box on top at the back-left
  const gas = plan(-32, -10, -136, -100, 1);
  let g = box(gas, TOOL_H, 20, { tone: "mid", inner: L(seam(gas, TOOL_H + 10, 3), { tone: "faint" }) }, 3, 0.5);
  g += L(slotX(-10, -130, -106, TOOL_H + 4, TOOL_H + 8), { tone: "lo" }) + screws(k.corners(gas, 2), TOOL_H + 20, 0.4);
  put("tool", centreOf(gas, TOOL_H), g, [A.slab(gas, TOOL_H, 20, {}, 3)], { name: "tool.gasbox" });
  // signal tower: base, three lamp segments, cap; the top lamp lights while the tool runs
  const [sx, sy] = [92, -53];
  let st = S(k.cylinder(sx, sy, 3.6, TOOL_H, 2, P, 20), { tone: "mid" }) + S(k.cylinder(sx, sy, 1.2, TOOL_H + 2, 6, P, 12), { tone: "mid" });
  const segs = [TOOL_H + 8, TOOL_H + 13, TOOL_H + 18];
  segs.forEach((z, i) => {
    st += `<g${i === 2 ? ' class="fa-lamp" data-lamp' : ""}>${S(k.cylinder(sx, sy, 2.8, z, 5, P, 20), { tone: i === 2 ? "hi" : "mid", inner: L(k.sideArc(sx, sy, 2.8, z + 0.01, P, 14), { tone: "faint" }) })}</g>`;
  });
  st += S(k.cylinder(sx, sy, 2.4, TOOL_H + 23, 1.6, P, 18), { tone: "mid" });
  put("tool", [sx, sy, TOOL_H + 12], st, [A.cylinder(sx, sy, 3.6, TOOL_H, 2, {}), A.cylinder(sx, sy, 1.2, TOOL_H + 2, 6, {}), A.cylinder(sx, sy, 2.8, TOOL_H + 8, 16.6, {})], { name: "tool.tower" });
}


// exhaust duct from the tool roof up into the ceiling: flanged at both ends, one clamp band
function duct(name, control, r) {
  const line = G.fillet(control, Math.max(r * 2.6, 3), 12, { P, tube: r });
  const total = G.pathLength(line);
  const thick = Math.max(0.9, r * 0.55);
  const collars = [];
  [[0, -1], [total, 1]].forEach(([along, sign]) => {
    const tangent = G.tangentAlong(line, along);
    collars.push({ centre: G.add3(G.pointAlong(line, along), G.mul3(tangent, (-sign * thick) / 2)), tangent, radius: r * 1.55, thick, gap: sign < 0 ? [0, thick] : [total - thick, total], bolts: 8 });
  });
  const bandAt = total * 0.22;
  collars.push({ centre: G.pointAlong(line, bandAt), tangent: G.tangentAlong(line, bandAt), radius: r * 1.18, thick: Math.max(0.8, r * 0.7), gap: [bandAt - r * 0.35, bandAt + r * 0.35], bolts: 0 });
  const gaps = collars.map(({ gap }) => gap);
  R.route(name, line, r, { owner: name, gaps, rims: [r * 1.55, r * 1.55], piece: "tool", move: [0, 0, 0] });
  Tube.tubePieces(line, r, P, { maxLength: 30, spacing: 1.6, gaps }).forEach((part, index) =>
    R.put({ piece: "tool", at: part.mid, bias: 0, svg: Tube.tubeSvg(part, { tone: "mid" }), move: [0, 0, 0], name: `${name}:${index}`, route: name, chunk: index, shapes: [R.solid(A.tube(part.points, part.radii, { name: `${name}:${index}`, owner: name }))] }),
  );
  collars.forEach((c, index) => {
    const F = G.frameAlong(c.centre, c.tangent);
    const id = `${name}.collar${index}`;
    let svgc = S(G.disc(-c.thick / 2, c.thick / 2, c.radius, F, P), { tone: "mid" });
    const towards = G.dot3(F.a, V) > 0 ? c.thick / 2 : -c.thick / 2;
    if (c.bolts && Math.abs(G.dot3(F.a, V)) > 0.12) svgc += Dots(G.dotsOf(F, towards, c.radius * 0.78, c.bolts, P, { all: true }), { size: 0.42, tone: "mid" });
    R.put({ piece: "tool", at: c.centre, bias: 0, svg: svgc, move: [0, 0, 0], name: id, shapes: [R.solid(A.disc(F, -c.thick / 2, c.thick / 2, c.radius, { name: id, owner: name }))] });
  });
}

// ---------------------------------------------------------------------------------------------
// EFEM: base frame, back wall with the slit valve, the left wall stub, the roof filter unit, the robot
function efem() {
  const base = EFEM;
  let svg = box(base, 0, BASE_TOP, { tone: "mid", inner: L(seam(base, 2, 2), { tone: "faint" }) }, 2, 0.6);
  svg += L(k.planOutline(k.insetPlan(base, 4), BASE_TOP, P, 2), { tone: "lo" });
  svg += ringScrews(k.corners(base, 7), BASE_TOP, 1.4) + screws(k.corners(base, 7), BASE_TOP, 0.45);
  put("robot", centreOf(base, 0), svg, [A.slab(base, 0, BASE_TOP, { name: "stand.efem-base" }, 2)], { name: "stand.efem-base" });

  // back wall in four pieces around the slit
  const wy0 = WALL_Y[0];
  const wy1 = WALL_Y[1];
  const pieces = [
    ["l", plan(-41, SLIT.x0, wy0, wy1, 0), 0, EFEM_TOP],
    ["r", plan(SLIT.x1, 52, wy0, wy1, 0), 0, EFEM_TOP],
    ["b", plan(SLIT.x0, SLIT.x1, wy0, wy1, 0), 0, SLIT.z0],
    ["t", plan(SLIT.x0, SLIT.x1, wy0, wy1, 0), SLIT.z1, EFEM_TOP],
  ];
  for (const [id, p, z0, z1] of pieces) {
    let w = box(p, z0, z1 - z0, { tone: "mid" }, 2, 0);
    if (id === "r") w += L(k.segment([40, wy1, 0], [40, wy1, EFEM_TOP], P), { tone: "faint" });
    if (id === "l") {
      w += L(k.segment([-24, wy1, 0], [-24, wy1, EFEM_TOP], P), { tone: "faint" });
      w += L(slotY(wy1, -36, -28, 150, 170), { tone: "lo" });
    }
    put("robot", centreOf(p, z0), w, [A.slab(p, z0, z1 - z0, {}, 2)], { name: `stand.efem-wall-${id}` });
  }
  // slit valve guides and gate (the gate lifts to close the slit while the tool runs)
  for (const gx of [SLIT.x0 - 2.6, SLIT.x1 + 0.6]) {
    const g = plan(gx, gx + 2, wy1, wy1 + 1.6, 0.3);
    put("robot", centreOf(g, 86), box(g, 86, 30, { tone: "mid" }, 2, 0.2), [A.slab(g, 86, 30, {}, 2)], { name: R.nameFor("stand.slit-guide") });
  }
  const gate = plan(SLIT.x0 - 0.6, SLIT.x1 + 0.6, wy1, wy1 + 1.2, 0.3);
  const gateSvg = box(gate, 88, 12, { tone: "mid", inner: L(seam(gate, 94, 2), { tone: "faint" }) }, 2, 0.3);
  put("robot", centreOf(gate, 88), `<g data-gate>${gateSvg}</g>`, [A.slab(gate, 88, 12, {}, 2)], { name: "robot.gate" });
  // the slit's dark throat
  const throat = [[SLIT.x0, wy1, SLIT.z0], [SLIT.x1, wy1, SLIT.z0], [SLIT.x1, wy1, SLIT.z1], [SLIT.x0, wy1, SLIT.z1]];
  put("robot", [10, wy1 - 1, 107], `<path class="iso-face fa-throat" d="${quad(throat)}"/>`, [A.slab(plan(SLIT.x0, SLIT.x1, wy0, wy1, 0), SLIT.z0, SLIT.z1 - SLIT.z0, {}, 2)], { name: "robot.slit", bias: -0.4 });

  // left wall stub behind the load port
  const stub = plan(-41, -38, wy1, -PW, 0);
  put("robot", centreOf(stub, 0), box(stub, 0, EFEM_TOP, { tone: "mid" }, 2, 0), [A.slab(stub, 0, EFEM_TOP, {}, 2)], { name: "stand.efem-stub" });

  // roof filter unit over the back half
  const roof = plan(-38, 52, wy0, -16, 0.6);
  let r = box(roof, EFEM_TOP, 14, { tone: "mid", inner: L(seam(roof, EFEM_TOP + 4, 2), { tone: "faint" }) }, 2, 0.6);
  r += box(plan(-28, 40, -40, -22, 1), EFEM_TOP + 14, 3, { tone: "mid" }, 2, 0.4);
  r += S(k.cylinder(5, -31, 6.5, EFEM_TOP + 17, 4, P, 28, 0.3), { tone: "mid" }) + L(k.knurl(5, -31, 6.5, EFEM_TOP + 17.6, EFEM_TOP + 20.4, 24, P), { tone: "lo" });
  const grille = [];
  for (let i = 0; i < 9; i++) grille.push(slotY(-16, -36 + i * 9.4, -30 + i * 9.4, EFEM_TOP + 2, EFEM_TOP + 3.6));
  r += L(grille.join(""), { tone: "lo" }) + screws(k.corners(roof, 2.4), EFEM_TOP + 14, 0.45);
  put("robot", centreOf(roof, EFEM_TOP), r, [A.slab(roof, EFEM_TOP, 14, {}, 2), A.slab(plan(-28, 40, -40, -22, 1), EFEM_TOP + 14, 3, {}, 2), A.cylinder(5, -31, 6.5, EFEM_TOP + 17, 4, {})], { name: "stand.efem-roof" });

  // front kick rail along the cut edges
  const kick = plan(-38, 52, 39, 42, 0.3);
  const kick2 = plan(49, 52, -42, 39, 0.3);
  put("robot", centreOf(kick, BASE_TOP), box(kick, BASE_TOP, 6, { tone: "mid" }, 2, 0.3) + screws([[-20, 40.5], [10, 40.5], [40, 40.5]], BASE_TOP + 6, 0.4), [A.slab(kick, BASE_TOP, 6, {}, 2)], { name: "robot.kick" });
  put("robot", centreOf(kick2, BASE_TOP), box(kick2, BASE_TOP, 6, { tone: "mid" }, 2, 0.3) + screws([[50.5, -30], [50.5, 0], [50.5, 28]], BASE_TOP + 6, 0.4), [A.slab(kick2, BASE_TOP, 6, {}, 2)], { name: "robot.kick2" });

  // robot column: base flange, lift column with seams, turret
  const [bx, by] = SHOULDER;
  let col = S(k.cylinder(bx, by, 13, BASE_TOP, 2, P, 40, 0.4), { tone: "mid" });
  const boltRing = [];
  for (let i = 0; i < 8; i++) boltRing.push([bx + 11 * Math.cos((i / 8) * 2 * Math.PI), by + 11 * Math.sin((i / 8) * 2 * Math.PI)]);
  col += screws(boltRing, BASE_TOP + 2, 0.42);
  col += S(k.cylinder(bx, by, 9, BASE_TOP + 2, 84, P, 40), { tone: "mid", crease: "none", inner: L([30, 60].map((z) => k.sideArc(bx, by, 9, z, P, 30)).join(""), { tone: "faint" }) });
  col += S(k.cylinder(bx, by, 9.6, 80, 3, P, 40), { tone: "mid" });
  col += S(k.cylinder(bx, by, 8, 92, 7, P, 40, 0.4), { tone: "hi", crease: "lo" });
  put("robot", [bx, by, 50], col, [A.cylinder(bx, by, 13, BASE_TOP, 2, {}), A.cylinder(bx, by, 9.6, BASE_TOP + 2, 84, {}), A.cylinder(bx, by, 8, 92, 7, {})], { name: "robot.column" });
}


// ---------------------------------------------------------------------------------------------
// load port: plate with the port opening, stage with kinematic pins, cabinet, door opener rail
function loadPort() {
  const [x0, x1] = PLATE_X;
  const pieces = [
    ["below", plan(x0, x1, -PW, PW, 0), 0, HOLE.z0],
    ["above", plan(x0, x1, -PW, PW, 0), HOLE.z1, M.PORT_H],
    ["left", plan(x0, x1, -PW, HOLE.y0, 0), HOLE.z0, HOLE.z1],
    ["right", plan(x0, x1, HOLE.y1, PW, 0), HOLE.z0, HOLE.z1],
  ];
  for (const [id, p, z0, z1] of pieces) {
    let svg = box(p, z0, z1 - z0, { tone: "mid", inner: id === "below" ? L(seam(p, 46, 2), { tone: "faint" }) : "" }, 2, 0);
    if (id === "below") svg += L(slotX(x1, -20, -8, 20, 36), { tone: "lo" });
    if (id === "above") svg += screws([[x0 + 1.5, -PW + 3], [x0 + 1.5, PW - 3]], M.PORT_H, 0.42);
    put("port", centreOf(p, z0), svg, [A.slab(p, z0, z1 - z0, {}, 2)], { name: `stand.plate-${id}` });
  }
  // E84 optical hand-off sensor on top of the plate, facing the OHT
  const e84 = plan(x0 - 4, x1, 12, 20, 0.6);
  put("port", centreOf(e84, M.PORT_H), box(e84, M.PORT_H, 4, { tone: "mid" }, 2, 0.3) + L(k.ring(x0 - 2, 16, 1.4, M.PORT_H + 4, P, 12), { tone: "lo" }), [A.slab(e84, M.PORT_H, 4, {}, 2)], { name: "port.e84" });
  // door opener rail inside the EFEM, below the opening
  const rail = plan(x1, x1 + 2, -4, 4, 0.3);
  put("port", centreOf(rail, 50), box(rail, 50, HOLE.z0 - 50, { tone: "mid" }, 2, 0.2) + screws([[x1 + 1, 0]], HOLE.z0, 0.4), [A.slab(rail, 50, HOLE.z0 - 50, {}, 2)], { name: "port.opener-rail" });
  // cabinet and stage outside
  const cab = plan(-73, x0, -18, 18, 1);
  let c = box(cab, 0, DATUM - 4, { tone: "mid", inner: L(seam(cab, 28, 2), { tone: "faint" }) }, 2, 0.6);
  const leds = [[-66, 18, 70], [-61, 18, 70], [-56, 18, 70]];
  c += L(slotY(18, -69, -52, 66, 74), { tone: "lo" }) + Dots(leds.map(at), { size: 0.7, tone: "mid" });
  c += L(slotY(18, -69, -52, 10, 22), { tone: "lo" });
  put("port", centreOf(cab, 0), c, [A.slab(cab, 0, DATUM - 4, {}, 2)], { name: "port.cabinet" });
  const stage = plan(-79, x0, -21, 21, 1.2);
  let s = box(stage, DATUM - 4, 4, { tone: "mid" }, 3, 0.5);
  const pins = [[-70, -12], [-70, 12], [-50, 0]];
  for (const [x, y] of byDepth(pins)) s += S(k.cylinder(x, y, 1.6, DATUM, 0.6, P, 12), { tone: "hi", crease: "lo" });
  put("port", centreOf(stage, DATUM - 4), s, [A.slab(stage, DATUM - 4, 4, {}, 3), ...pins.map(([x, y]) => A.cylinder(x, y, 1.6, DATUM, 0.6, {}))], { name: "port.stage" });
}

// ---------------------------------------------------------------------------------------------
// FOUP: shell, top flange, handles, the wafers seen through the open port, and its door
function holeClip(id) {
  const face = (x) => quad([[x, HOLE.y0, HOLE.z0], [x, HOLE.y1, HOLE.z0], [x, HOLE.y1, HOLE.z1], [x, HOLE.y0, HOLE.z1]]);
  return `<clipPath id="${id}-a"><path d="${face(PLATE_X[0])}"/></clipPath><clipPath id="${id}-b"><path d="${face(PLATE_X[1])}"/></clipPath>`;
}
const waferSvg = (z, style = {}) => S(k.cylinder(WAFER_X, 0, M.WAFER_R, z, 0.4, P, 64), { tone: "hi", crease: "lo", ...style });

function foup() {
  const shell = FOUP;
  let svg = box(shell, FOUP_Z, FOUP_TOP - FOUP_Z, { tone: "hi", crease: "lo", inner: L(seam(shell, FOUP_Z + 3, 3) + seam(shell, FOUP_TOP - 4, 3), { tone: "faint" }) }, 3, 0.8);
  // ID tag and label on the +y side, and the side handle
  const fy = shell.y + shell.d;
  svg += L(slotY(fy, -72, -62, 97, 103), { tone: "lo" }) + L([99, 101].map((z, i) => k.segment([-71, fy, z], [-64 - i * 2, fy, z], P)).join(""), { tone: "lo", free: true });
  put("foup", centreOf(shell, FOUP_Z), svg, [A.slab(shell, FOUP_Z, FOUP_TOP - FOUP_Z, {}, 3)], { name: "foup.shell", mv: "foup" });
  const handle = plan(-66, -50, fy, fy + 2.4, 0.6);
  put("foup", centreOf(handle, 108), box(handle, 106, 6, { tone: "hi", crease: "lo" }, 2, 0.3), [A.slab(handle, 106, 6, {}, 2)], { name: "foup.handle", mv: "foup" });
  // top robotic flange: post and plate
  const post = plan(XF - 4, XF + 4, -4, 4, 1);
  const flange = plan(XF - 8.5, XF + 8.5, -9, 9, 1.2);
  let f = box(post, FOUP_TOP, 3, { tone: "mid" }, 2, 0.2) + box(flange, FOUP_TOP + 3, 2, { tone: "hi", crease: "lo" }, 3, 0.4);
  f += L(k.planOutline(k.insetPlan(flange, 2), FOUP_TOP + 5, P, 2), { tone: "faint" });
  put("foup", [XF, 0, FOUP_TOP + 2], f, [A.slab(post, FOUP_TOP, 3, {}, 2), A.slab(flange, FOUP_TOP + 3, 2, {}, 3)], { name: "foup.flange", mv: "foup" });

  // inside, seen only through the opening: cavity walls, slot ribs, the wafer stack around the moving wafer
  const ix0 = shell.x + 1.6;
  const ix1 = -42.2;
  const iy = shell.y + 1.6;
  const back = `<path class="iso-face fa-cavity" d="${quad([[ix0, iy, 92], [ix0, -iy, 92], [ix0, -iy, 123], [ix0, iy, 123]])}"/>`;
  const side = `<path class="iso-face fa-cavity fa-cavity-side" d="${quad([[ix0, iy, 92], [ix1, iy, 92], [ix1, iy, 123], [ix0, iy, 123]])}"/>`;
  const bottom = `<path class="iso-face fa-cavity fa-cavity-floor" d="${quad([[ix0, iy, 92], [ix1, iy, 92], [ix1, -iy, 92], [ix0, -iy, 92]])}"/>`;
  const ribs = [];
  for (let i = 0; i < M.FOUP.wafers; i++) ribs.push(k.segment([ix0, iy, SLOT(i) - 0.3], [ix1, iy, SLOT(i) - 0.3], P));
  const lower = [];
  const upper = [];
  for (let i = 0; i < M.FOUP.wafers; i++) (i <= PICK ? lower : upper).push(i === PICK ? `<g data-slot>${waferSvg(SLOT(i))}</g>` : waferSvg(SLOT(i)));
  const inside = `${holeClip("fa-hole")}<g clip-path="url(#fa-hole-a)"><g clip-path="url(#fa-hole-b)">${back}${side}${bottom}${L(ribs.join(""), { tone: "faint" })}${lower.join("")}<g data-dyn="waferA"></g>${upper.join("")}</g></g>`;
  const window = plan(-42.4, -42.2, HOLE.y0, HOLE.y1, 0);
  put("foup", [-42.3, 0, 107], `<g data-inside>${inside}</g>`, [A.slab(window, HOLE.z0, HOLE.z1 - HOLE.z0, {}, 2)], { name: "foup.inside", mv: "foup" });

  // door: FOUP door mated to the port door, with latch keys and registration pins on its inner face
  let d = box(DOOR, DOOR_Z, DOOR_H, { tone: "hi", crease: "lo", inner: L(seam(DOOR, DOOR_Z + 2, 2), { tone: "faint" }) }, 2, 0.3);
  const dx = DOOR.x + DOOR.w;
  for (const ky of [-9, 9]) d += L(k.sideRing([dx, ky, DOOR_Z + 15], 2.4, "x", P, 16), { tone: "lo" }) + L(k.segment([dx, ky - 1.6, DOOR_Z + 15], [dx, ky + 1.6, DOOR_Z + 15], P), { tone: "mid" });
  d += Dots([[dx, -13, DOOR_Z + 4], [dx, 13, DOOR_Z + 26], [dx, 0, DOOR_Z + 26]].map(at), { size: 0.6, tone: "mid" });
  d += L(slotX(dx, -4, 4, DOOR_Z + 5, DOOR_Z + 8), { tone: "lo" });
  put("foup", centreOf(DOOR, DOOR_Z), `<g data-doorface>${d}</g>`, [A.slab(DOOR, DOOR_Z, DOOR_H, {}, 2)], { name: "foup.door", mv: "door" });
}

// ---------------------------------------------------------------------------------------------
// OHT vehicle: hoist housing, end covers, sensors; the gripper on its belts
function vehicle() {
  const h = HOUSE;
  const neck = plan(XF - 3, XF + 3, -16, 16, 0.6);
  let svg = box(neck, HOUSE_Z + 15, RAIL_Z - HOUSE_Z - 15, { tone: "mid" }, 2, 0.2);
  svg += box(h, HOUSE_Z, 15, { tone: "mid", inner: L(seam(h, HOUSE_Z + 5, 3), { tone: "faint" }) }, 3, 0.6);
  svg += L(slotX(h.x + h.w, -18, -6, HOUSE_Z + 8, HOUSE_Z + 12), { tone: "lo" }) + L(slotX(h.x + h.w, 6, 18, HOUSE_Z + 8, HOUSE_Z + 12), { tone: "lo" });
  svg += screws(k.corners(h, 2.4), HOUSE_Z + 15, 0.42);
  put("oht", centreOf(h, HOUSE_Z), svg, [A.slab(neck, HOUSE_Z + 15, RAIL_Z - HOUSE_Z - 15, {}, 2), A.slab(h, HOUSE_Z, 15, {}, 3)], { name: "oht.housing", mv: "vehicle" });
  for (const side of [-1, 1]) {
    const c = plan(h.x, h.x + h.w, side > 0 ? h.y + h.d - 3 : h.y, side > 0 ? h.y + h.d : h.y + 3, 0.6);
    let cs = box(c, COVER_Z, HOUSE_Z - COVER_Z, { tone: "mid", inner: L(seam(c, COVER_Z + 6, 2), { tone: "faint" }) }, 2, 0.4);
    if (side > 0) {
      const fy = c.y + c.d;
      cs += L(slotY(fy, XF - 9, XF + 9, COVER_Z + 30, COVER_Z + 40), { tone: "lo" }) + L([COVER_Z + 33, COVER_Z + 36.5].map((z, i) => k.segment([XF - 7, fy, z], [XF + 3 - i * 5, fy, z], P)).join(""), { tone: "lo", free: true });
      cs += L(k.sideRing([XF + 6, fy, COVER_Z + 18], 2.2, "y", P, 16), { tone: "lo" }) + L(k.sideRing([XF - 6, fy, COVER_Z + 18], 2.2, "y", P, 16), { tone: "lo" });
      cs += Dots([at([XF, fy, COVER_Z + 46])], { size: 0.8, tone: "mid" });
    }
    put("oht", centreOf(c, COVER_Z), cs, [A.slab(c, COVER_Z, HOUSE_Z - COVER_Z, {}, 2)], { name: `oht.cover${side > 0 ? "F" : "B"}`, mv: "vehicle" });
  }
  // gripper: plate, two fingers hooking under the FOUP flange, belts up into the housing
  const fingers = [plan(GRIP.x - 2, GRIP.x, -6, 6, 0.3), plan(GRIP.x + GRIP.w, GRIP.x + GRIP.w + 2, -6, 6, 0.3)];
  let g = `<g data-dyn="belts"></g>`;
  for (const f of fingers) g += box(f, FOUP_TOP + 2.6, GRIP_TOP - FOUP_TOP - 2.6, { tone: "mid" }, 2, 0.2);
  g += box(GRIP, GRIP_Z, GRIP_TOP - GRIP_Z, { tone: "mid", inner: L(seam(GRIP, GRIP_Z + 1.4, 2), { tone: "faint" }) }, 3, 0.4);
  g += screws(k.corners(GRIP, 2), GRIP_TOP, 0.4) + L(k.ring(XF, 0, 2.4, GRIP_TOP, P, 16), { tone: "lo" });
  put("oht", [XF, 0, GRIP_Z + 2], g, [A.slab(GRIP, GRIP_Z, GRIP_TOP - GRIP_Z, {}, 3), ...fingers.map((f) => A.slab(f, FOUP_TOP + 2.6, GRIP_TOP - FOUP_TOP - 2.6, {}, 2))], { name: "oht.gripper", mv: "gripper" });
}

// ---------------------------------------------------------------------------------------------
function arm() {
  // the arm is rebuilt in the page; record it at home (pointing +x, folded)
  const [bx, by] = SHOULDER;
  const shape = A.slab(plan(bx - 6, bx + FORK + M.WAFER_R, by - 30, by + 6, 3), 99, FORK_Z + 0.4 - 99, {}, 2);
  put("robot", [bx + 14, by, 102], `<g data-dyn="arm"></g>`, [shape], { name: "robot.arm" });
}

floor();
ceiling();
stocker();
tool();
duct("tool.exhaust", [[86, -125, TOOL_H], [86, -125, 205], [86, -163, 205], [86, -163, CEIL]], 4);
efem();
loadPort();
foup();
vehicle();
arm();

// ---------------------------------------------------------------------------------------------
// depth order: settle at the build pose, then add the rules of every pose the slider passes through
const MOVERS = ["vehicle", "gripper", "foup", "door"];
const POSES = [];
for (let i = 0; i <= 120; i++) {
  const p = poseAt(i / 120, T);
  const off = offsetsOf(p);
  const id = MOVERS.map((m) => off[m].map((v) => v.toFixed(0)).join(",")).join("|");
  if (!POSES.some((q) => q.id === id)) POSES.push({ id, off, label: `${M.STEPS[p.index].id} ${p.u.toFixed(2)}` });
}
let poseReport = "";
if (!process.argv.includes("--fast")) {
  A.settle(R, P, { states: [0] });
  const items = R.items;
  const rules = [];
  const dot = (a) => a[0] * V[0] + a[1] * V[1] + a[2] * V[2];
  for (const pose of POSES) {
    items.forEach((item) => (item.move = item.mv ? pose.off[item.mv] : [0, 0, 0]));
    const state = { label: pose.label, shares: Object.fromEntries(items.map((item) => [item.piece, 1])) };
    const over = A.overlapsOf(items, P, { states: [state], skip: A.sameRun });
    for (const pair of over.pairs) {
      const aFront = pair.front[0].area >= over.least;
      const bFront = pair.front[1].area >= over.least;
      if (aFront === bFront) continue;
      const [front, back] = aFront ? [pair.a, pair.b] : [pair.b, pair.a];
      rules.push({ front, back, need: 0.02 + dot(items[back].move) - dot(items[front].move), pose: pose.label });
    }
  }
  items.forEach((item) => (item.move = [0, 0, 0]));
  const keys = items.map((item) => item.key);
  for (let round = 0; round < items.length + 2; round++) {
    let changed = false;
    for (const rule of rules) if (keys[rule.front] - keys[rule.back] < rule.need - 1e-9) ((keys[rule.front] = keys[rule.back] + rule.need), (changed = true));
    if (!changed) break;
  }
  const broken = rules.filter((rule) => keys[rule.front] - keys[rule.back] < rule.need - 1e-6);
  items.forEach((item, index) => (item.key = keys[index]));
  poseReport = `poses: ${POSES.length} · ${rules.length} rules · ${broken.length} broken${broken.length ? "\n" + broken.slice(0, 12).map((r) => `  ${items[r.front].name} over ${items[r.back].name} @ ${r.pose}`).join("\n") : ""}`;
}
R.items.sort((a, b) => a.key - b.key);

const PIECE_OF = { oht: "oht", stocker: "oht", foup: "foup", port: "port", robot: "robot", tool: "tool", bay: "bay" };
for (const item of R.items) item.piece = PIECE_OF[item.piece] ?? item.piece;
const groups = R.items.map((item, index) => `<g class="it" data-piece="${item.piece}" data-k="${item.key.toFixed(2)}"${item.mv ? ` data-mv="${item.mv}"` : ""} data-i="${index}">${item.svg}</g>`);

// clip for the front copy of the moving wafer: in front of the plate (x > -38) and of the back wall (y > -42)
const FZ = FORK_Z + 0.3;
const frontClip = quad([[PLATE_X[1], WALL_Y[1], FZ], [400, WALL_Y[1], FZ], [400, 400, FZ], [PLATE_X[1], 400, FZ]]);
const defs = `<defs><clipPath id="fa-front"><path d="${frontClip}"/></clipPath></defs>`;

const LABEL = `A cleanroom bay cut away to show one tool. An overhead hoist transport vehicle runs on a rail hung from the ceiling filter units and lowers a FOUP of ${M.FOUP.wafers} wafers onto a load port. The port opens the FOUP door into the EFEM, whose robot carries one wafer through a slit valve into the process tool and back. The bay stands on a raised floor of perforated tiles; a stocker sits at the far end of the rail.`;
const svg = k.figureSvg({ width: W, height: H, label: LABEL, body: [defs, `<g class="fa-layers">${groups.join("")}</g>`], className: "fa-svg" });

const unit = (vector) => {
  const o = at([0, 0, 0]);
  const p = at(vector);
  return [p[0] - o[0], p[1] - o[1]];
};
const DATA = {
  V,
  P,
  EX: unit([1, 0, 0]),
  EY: unit([0, 1, 0]),
  EZ: unit([0, 0, 1]),
  T,
  steps: M.STEPS.map(({ id, name, say }) => ({ id, name, say })),
  parts: M.PARTS,
  order: Object.keys(M.PARTS),
  idle: M.IDLE,
  arm: { shoulder: SHOULDER, link: LINK, fork: FORK, forkZ: FORK_Z, waferR: M.WAFER_R, waferX: WAFER_X, slotZ: SLOT(PICK), toolY: TOOL_Y, frontX: PLATE_X[1], wallY: WALL_Y[1] },
  belts: { top: HOUSE_Z, grip: GRIP_TOP, at: [[XF - 5, -6], [XF + 5, -6], [XF, 7]] },
  gate: { z: 88, close: 14 },
};

const PARTS = DATA.order.map((id, index) => `<button type="button" class="fa-part" data-part="${id}"><span class="fa-num">${String(index + 1).padStart(2, "0")}</span>${M.PARTS[id].name}</button>`).join("");
const corners = `<div class="iso-plate-corners" aria-hidden="true"><span class="iso-plate-corner" data-corner="fig">Fig 5</span><span class="iso-plate-corner" data-corner="title">Fab bay · one wafer's trip</span><span class="iso-plate-corner" data-corner="readout" data-readout>${M.IDLE}</span></div>`;
const controls = `<div class="fa-controls"><span class="fa-hint">Hover a part · Space plays the trip</span><span class="fa-live" aria-live="polite" data-live></span></div>`;
const stage = `<div class="fa-stage" tabindex="0" role="slider" aria-label="A fab bay with an overhead hoist transport, a FOUP on a load port, an EFEM robot and a process tool. Hover, or use the arrow keys, to pick a part; Space plays or pauses the wafer's trip; Escape resets it; the slider below steps through the trip." aria-valuemin="0" aria-valuemax="${DATA.order.length}" aria-valuenow="0" aria-valuetext="${M.IDLE}">${svg}</div>`;
const caption = `One lot of ${M.FOUP.lot} wafers travels sealed in a FOUP (${M.FOUP.waferMm} mm wafers at ${M.FOUP.pitchMm} mm pitch, ${M.FOUP.massKg[0]}–${M.FOUP.massKg[1]} kg loaded). The OHT vehicle lowers it onto a SEMI E15.1 load port, whose datum sits ${M.LOAD_PORT.datumMm} mm above the floor, with every slot ${M.LOAD_PORT.accessMm[0]}–${M.LOAD_PORT.accessMm[1]} mm above that datum so any tool's robot can reach it. The port opens the door into the EFEM, a box of ISO ${M.CLEAN.miniIso[0]}–${M.CLEAN.miniIso[1]} air under its own filter unit, while the bay around it is ISO ${M.CLEAN.bayIso}. Wafer, FOUP and port are to scale (ruler ticks 20 mm); the hoist height, ceiling, tool, stocker, robot and the tool's position behind the EFEM are illustrative, and the ceiling and EFEM walls are cut away.`;
const scrub = `<span class="fa-scrub"><button type="button" class="fa-play" data-play aria-label="Play the trip"><span class="fa-play-icon" aria-hidden="true"></span><span data-play-text>Play</span></button><input type="range" class="fa-range" data-scrub min="0" max="1000" step="1" value="0" aria-label="The wafer's trip, from the stocker (0) to leaving the tool (1000)"><span class="fa-step" data-step>01 · At the stocker</span></span>`;
const body = `<figure class="iso-figure fa"><div class="iso-plate">${corners}${stage}${controls}</div><figcaption class="iso-legend">${scrub}<span class="fa-parts">${PARTS}</span><span class="iso-caption">${caption}</span></figcaption></figure>`;

const CSS = readFileSync(join(HERE, "fab-automation.css"), "utf8");
const LIVE = POSE_SRC + "\n" + readFileSync(join(HERE, "live.js"), "utf8").replace("__DATA__", JSON.stringify(DATA));
const out = writeChapter({ slug: "fab-automation", figure: body, css: CSS, script: kitScript() + LIVE, lesson: LESSON });
console.log("wrote", out.file, `${out.kb} KB`, `${R.items.length} items`, `${R.solids.length} solids`);
if (poseReport) console.log(poseReport);

A.auditOrExit(R, P);
