// Cerebras WSE-3 engine block on an assembly fixture: power modules, main board, wafer connector,
// the wafer itself and the water-cooled cold plate, stacked and taken apart.
// node build.mjs [--audit] [--fast]
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as M from "./model.mjs";

import { k, G, A, Tube } from "../../site/kit.mjs";
import { writeChapter } from "../../site/shell.mjs";
import { LESSON } from "./lesson.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

// ---- world layout: x, y on the floor in mm, z up; heights exaggerated ----
const W = 640;
const H = 600;
const AZIMUTH = 45;
const ELEVATION = 32;

const PLATE = { x: -176, y: -176, w: 352, d: 352, r: 12 };
const PLATE_H = 14;
const FOOT_H = 7;
const PILLARS = [
  [-156, -156],
  [156, -156],
  [-156, 156],
  [156, 156],
];

// the engine, bottom to top
const MOD = { size: 46, gap: 8, n: 4, z: 0, top: 19, head: 24 };
const MOD0 = -(MOD.n * MOD.size + (MOD.n - 1) * MOD.gap) / 2;
const MODULES = [];
for (let i = 0; i < MOD.n; i++) for (let j = 0; j < MOD.n; j++) MODULES.push({ x: MOD0 + i * (MOD.size + MOD.gap), y: MOD0 + j * (MOD.size + MOD.gap), w: MOD.size, d: MOD.size, r: 2 });
const PCB = { x: -145, y: -145, w: 290, d: 290, r: 4 };
const PCB_Z = MOD.head;
const PCB_TOP = PCB_Z + 6;
const CON = { x: -118, y: -118, w: 236, d: 236, r: 3 };
const CON_TOP = PCB_TOP + 3.5;
const HALF = M.sideMm / 2;
const WAFER = { x: -HALF, y: -HALF, w: M.sideMm, d: M.sideMm, r: 1.2 };
const WAFER_TOP = CON_TOP + 2.5;
const PED = k.insetPlan(WAFER, -1);
const FLANGE_Z = WAFER_TOP + 5;
const PILLAR_TOP = FLANGE_Z;
const FLANGE = { x: -168, y: -168, w: 336, d: 336, r: 14 };
const FLANGE_TOP = FLANGE_Z + 6;
const BODY = { x: -132, y: -132, w: 264, d: 264, r: 10 };
const BODY_TOP = FLANGE_TOP + 18;
const RIB = { x: -96, y: -30, w: 26, d: 60, r: 4 };
const RIB_TOP = BODY_TOP + 4;
const FITTINGS = [
  [-83, -16],
  [-83, 16],
];

const [COLS, ROWS] = M.dieGrid; // 12 dies across x, 7 down y
const DIE_W = M.sideMm / COLS;
const DIE_D = M.sideMm / ROWS;
const CORE_X = 3; // core dots drawn per die across x (each stands for about 1/12 of a die's cores; illustrative)
const CORE_Y = 4;
const GX = COLS * CORE_X;
const GY = ROWS * CORE_Y;
const coreAt = (i, j) => [WAFER.x + ((i + 0.5) * M.sideMm) / GX, WAFER.y + ((j + 0.5) * M.sideMm) / GY];

const PIECES = {
  cold: { ...M.PIECES.cold, move: [-60, 0, 180] },
  wafer: { ...M.PIECES.wafer, move: [0, 0, 128] },
  connector: { ...M.PIECES.connector, move: [0, 0, 66] },
  pcb: { ...M.PIECES.pcb, move: [0, 0, 54] },
  power: { ...M.PIECES.power, move: [0, 0, 12] },
  stand: { ...M.PIECES.stand, move: [0, 0, 0] },
};
const STAGGER = ["cold", "wafer", "connector", "pcb", "power", "stand"];
const SPRING = { stagger: 0.05, stiffness: 64, damping: 14.2, substeps: 4 };
const ORDER = ["power", "pcb", "connector", "wafer", "cold"];
const shifted = (plan, [dx, dy]) => ({ ...plan, x: plan.x + dx, y: plan.y + dy });

const P = k.fitProjection(
  [
    ...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0),
    ...k.boxCorners(shifted(FLANGE, PIECES.cold.move), FLANGE_Z + PIECES.cold.move[2], RIB_TOP + 20 + PIECES.cold.move[2]),
    ...k.boxCorners(WAFER, 0, WAFER_TOP + PIECES.wafer.move[2]),
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
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));

const R = A.recorder(P, { order: STAGGER, spring: SPRING });
function put(piece, ref, svg, shapes, { bias = 0, name, move } = {}) {
  const id = name ?? R.nameFor(`${piece}.item`);
  shapes.forEach((shape) => (shape.name = shape.name ?? id));
  R.put({ piece, at: ref, bias, svg, move: move ?? PIECES[piece].move, shapes: shapes.map(R.solid), name: id });
}
const slabShape = (plan, z, h, steps = 4) => A.slab(plan, z, h, {}, steps);
const cylShape = (x, y, r, z, h) => A.cylinder(x, y, r, z, h, {});
function tube(piece, name, route, r, { tone = "mid", maxLength = 18, rings } = {}) {
  const id = R.nameFor(name);
  R.route(id, route, r, { piece, move: PIECES[piece].move });
  Tube.tubePieces(route, r, P, { maxLength, rings }).forEach((chunk, index) =>
    R.put({ piece, at: chunk.mid, bias: 0, svg: Tube.tubeSvg(chunk, { tone }), move: PIECES[piece].move, shapes: [R.solid(A.tube(chunk.points, chunk.radii, { name: `${id}:${index}`, owner: id }))], name: `${id}:${index}`, route: id, chunk: index }),
  );
}

// ---- stand: base plate on feet, ruler, label plate, guide pillars, handles ----
function stand() {
  const back = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  const shapes = [];
  for (const [x, y] of byDepth(k.corners(PLATE, 30))) {
    back.push(S(k.cylinder(x, y, 10, -PLATE_H - FOOT_H, 2, P, 32), { tone: "lo" }));
    back.push(S(k.cylinder(x, y, 7.6, -PLATE_H - FOOT_H + 2, FOOT_H - 2, P, 28), { tone: "mid" }));
    shapes.push(A.cylinder(x, y, 10, -PLATE_H - FOOT_H, FOOT_H, { name: "stand.foot" }));
  }
  back.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid", inner: L(k.sideSeam(PLATE, -PLATE_H + 4, P, 8), { tone: "faint" }) }));
  shapes.push(A.slab(PLATE, -PLATE_H, PLATE_H, { name: "stand.plate" }));
  back.push(L(k.planOutline(k.insetPlan(PLATE, 6), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 13);
  back.push(L(screws.map(([x, y]) => k.ring(x, y, 2.6, 0, P, 16)).join(""), { tone: "lo" }));
  back.push(Dots(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // module bay: a recessed outline under the power modules, with locating dowels
  const bay = k.insetPlan({ x: MOD0, y: MOD0, w: -2 * MOD0, d: -2 * MOD0, r: 4 }, -6);
  back.push(L(k.planOutline(bay, 0, P, 4), { tone: "lo" }));
  back.push(Dots(k.corners(bay, 3).map(([x, y]) => at([x, y, 0])), { size: 0.45 }));
  // ruler strip along the near (+y) edge: 5 mm ticks, a major every 50 mm
  const strip = { x: -128, y: PLATE.y + PLATE.d - 20, w: 170, d: 9, r: 1 };
  back.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 5, strip.x + strip.w - 5, 5, 10, strip.y + 0.8, 0.6, [2.4, 4.4], P);
  back.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  back.push(Dots([at([strip.x + 2.4, strip.y + 4.5, 0.6]), at([strip.x + strip.w - 2.4, strip.y + 4.5, 0.6])], { size: 0.45 }));
  // label plate
  const label = { x: 58, y: PLATE.y + PLATE.d - 28, w: 80, d: 18, r: 1.5 };
  back.push(S(k.slabOf(label, 0, 0.8, P, 4), { tone: "lo", crease: "none" }));
  back.push(L(k.planOutline(k.insetPlan(label, 1.8), 0.8, P, 4), { tone: "faint" }));
  back.push(L([0, 1, 2].map((i) => k.lineOnTop([label.x + 9, label.y + 5.5 + i * 3.5], [label.x + 66 - i * 15, label.y + 5.5 + i * 3.5], 0.8, P)).join(""), { tone: "lo", free: true }));
  back.push(Dots([at([label.x + 4.5, label.y + label.d / 2, 0.8]), at([label.x + label.w - 4.5, label.y + label.d / 2, 0.8])], { size: 0.45 }));
  put("stand", [0, 0, -1], back.join(""), shapes, { name: "stand.base", bias: -400 });

  // guide pillars: collar, post with seams, shoulder the cold plate flange lands on
  for (const [x, y] of PILLARS) {
    const svg =
      S(k.cylinder(x, y, 13, 0, 3, P, 40), { tone: "mid" }) +
      S(k.cylinder(x, y, 8, 3, PILLAR_TOP - 7, P, 36), { tone: "mid", crease: "none", inner: L([12, 26].map((z) => k.sideArc(x, y, 8, z, P, 20)).join(""), { tone: "faint" }) }) +
      S(k.cylinder(x, y, 10, PILLAR_TOP - 4, 4, P, 36, 0.4), { tone: "mid" }) +
      L(k.ring(x, y, 3.6, PILLAR_TOP, P, 20), { tone: "lo" });
    put("stand", [x, y, PILLAR_TOP / 2], svg, [cylShape(x, y, 13, 0, 3), cylShape(x, y, 8, 3, PILLAR_TOP - 7), cylShape(x, y, 10, PILLAR_TOP - 4, 4)], { name: R.nameFor("stand.pillar") });
  }
}

// ---- power modules: DC-DC bricks in a 4 x 4 grid, each with a contact header on top ----
function power() {
  MODULES.forEach((plan, index) => {
    const lid = L(k.sideSeam(plan, MOD.top - 3, P, 2), { tone: "faint" });
    const body = S(k.slabOf(plan, MOD.z, MOD.top - MOD.z, P, 2, 0.5), { tone: "mid", inner: lid });
    const vents = L([0, 1, 2].map((i) => k.planOutline({ x: plan.x + 5, y: plan.y + 7 + i * 6, w: 14, d: 2.2, r: 1 }, MOD.top, P, 2)).join(""), { tone: "lo" });
    const screws = [[plan.x + 4, plan.y + plan.d - 4], [plan.x + plan.w - 4, plan.y + 4]];
    const screwSvg = L(screws.map(([x, y]) => k.ring(x, y, 1.6, MOD.top, P, 12)).join(""), { tone: "lo" }) + Dots(screws.map(([x, y]) => at([x, y, MOD.top])), { size: 0.42 });
    const head = { x: plan.x + 24, y: plan.y + 6, w: 16, d: 34, r: 1 };
    const headSvg = S(k.slabOf(head, MOD.top, MOD.head - MOD.top, P, 2, 0.3), { tone: "hi", crease: "lo" });
    const pins = [];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 8; j++) pins.push(at([head.x + 3 + i * 5, head.y + 3.4 + j * 3.9, MOD.head]));
    const pinSvg = Dots(pins, { size: 0.3, tone: "mid" });
    put("power", centreOf(plan, MOD.z), body + vents + screwSvg + headSvg + pinSvg, [slabShape(plan, MOD.z, MOD.top - MOD.z, 2), slabShape(head, MOD.top, MOD.head - MOD.top, 2)], { name: `power.module${index}` });
  });
}

// ---- main board: layers, mounting holes, decoupling caps, I/O connectors ----
function pcb() {
  const layers = L([PCB_Z + 2, PCB_Z + 4].map((z) => k.sideSeam(PCB, z, P, 4)).join(""), { tone: "faint" });
  const slab = S(k.slabOf(PCB, PCB_Z, PCB_TOP - PCB_Z, P, 4, 0.6), { tone: "mid", inner: layers });
  const holes = k.corners(PCB, 9);
  const holeSvg = L(holes.map(([x, y]) => k.ring(x, y, 3.4, PCB_TOP, P, 18) + k.ring(x, y, 1.8, PCB_TOP, P, 14)).join(""), { tone: "lo" });
  const keep = L(k.planOutline(k.insetPlan(CON, -3), PCB_TOP, P, 4), { tone: "faint" });
  const fid = [[PCB.x + 20, PCB.y + 20], [PCB.x + PCB.w - 20, PCB.y + PCB.d - 20]];
  const fidSvg = L(fid.map(([x, y]) => k.ring(x, y, 2.2, PCB_TOP, P, 16)).join(""), { tone: "lo" }) + Dots(fid.map(([x, y]) => at([x, y, PCB_TOP])), { size: 0.55, tone: "mid" });
  // a laser-marked 2D code by the near-left corner
  const code = [];
  const cx = PCB.x + 30;
  const cy = PCB.y + PCB.d - 22;
  for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) if ((i * 5 + j * 3 + i * j) % 3 !== 0 || i === 0 || j === 6) code.push(at([cx + i * 1.3, cy + j * 1.3, PCB_TOP]));
  const codeSvg = Dots(code, { size: 0.34, tone: "lo" }) + L(k.planOutline({ x: cx - 1.4, y: cy - 1.4, w: 10.6, d: 10.6, r: 0.4 }, PCB_TOP, P, 2), { tone: "faint" });
  put("pcb", centreOf(PCB, PCB_Z), slab + holeSvg + keep + fidSvg + codeSvg, [A.slab(PCB, PCB_Z, PCB_TOP - PCB_Z, {}, 4)], { name: "pcb.board" });

  // decoupling capacitors in the moat between connector and board edge, one row per side
  const ring = k.insetPlan(CON, -6);
  const sides = {
    w: Array.from({ length: 11 }, (_, i) => ({ x: ring.x - 2, y: -100 + i * 20 - 1, w: 4, d: 2.4, r: 0.3 })),
    e: Array.from({ length: 11 }, (_, i) => ({ x: ring.x + ring.w - 2, y: -100 + i * 20 - 1, w: 4, d: 2.4, r: 0.3 })),
    n: Array.from({ length: 11 }, (_, i) => ({ x: -100 + i * 20 - 1, y: ring.y - 2, w: 2.4, d: 4, r: 0.3 })),
    s: Array.from({ length: 11 }, (_, i) => ({ x: -100 + i * 20 - 1, y: ring.y + ring.d - 2, w: 2.4, d: 4, r: 0.3 })),
  };
  for (const [side, list] of Object.entries(sides)) {
    const sorted = [...list].sort((a, b) => k.depthOf(centreOf(a, PCB_TOP), P) - k.depthOf(centreOf(b, PCB_TOP), P));
    const svg = sorted.map((cap) => S(k.slabOf(cap, PCB_TOP, 2, P, 2), { tone: "hi", crease: "lo" })).join("");
    const xs = list.flatMap((c) => [c.x, c.x + c.w]);
    const ys = list.flatMap((c) => [c.y, c.y + c.d]);
    const bounds = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), d: Math.max(...ys) - Math.min(...ys), r: 0 };
    put("pcb", centreOf(bounds, PCB_TOP), svg, list.map((cap) => slabShape(cap, PCB_TOP, 2, 2)), { name: `pcb.caps-${side}` });
  }

  // I/O connectors along the near (+x) edge: shells with a mating slot on top
  for (let i = 0; i < 4; i++) {
    const shell = { x: PCB.x + PCB.w - 17, y: -78 + i * 42, w: 14, d: 30, r: 1.2 };
    const svg =
      S(k.slabOf(shell, PCB_TOP, 9, P, 3, 0.4), { tone: "mid", inner: L(k.sideSeam(shell, PCB_TOP + 3, P, 3), { tone: "faint" }) }) +
      L(k.planOutline(k.insetPlan(shell, 3), PCB_TOP + 9, P, 2), { tone: "lo" }) +
      Dots([at([shell.x + shell.w / 2, shell.y + 1.8, PCB_TOP + 9]), at([shell.x + shell.w / 2, shell.y + shell.d - 1.8, PCB_TOP + 9])], { size: 0.42 });
    put("pcb", centreOf(shell, PCB_TOP), svg, [slabShape(shell, PCB_TOP, 9, 3)], { name: `pcb.io${i}` });
  }
}

// ---- wafer connector: a carrier frame with one contact tile under each die ----
function connector() {
  const body = S(k.slabOf(CON, PCB_TOP, CON_TOP - PCB_TOP, P, 4, 0.5), { tone: "mid", inner: L(k.sideSeam(CON, PCB_TOP + 1.6, P, 4), { tone: "faint" }) });
  const tiles = [];
  const contacts = [];
  for (let i = 0; i < COLS; i++)
    for (let j = 0; j < ROWS; j++) {
      const tile = { x: WAFER.x + i * DIE_W + 1.6, y: WAFER.y + j * DIE_D + 1.6, w: DIE_W - 3.2, d: DIE_D - 3.2, r: 0.8 };
      tiles.push(k.planOutline(tile, CON_TOP, P, 2));
      for (let a = 0; a < 3; a++) for (let b = 0; b < 6; b++) contacts.push(at([tile.x + 2.6 + (a * (tile.w - 5.2)) / 2, tile.y + 2.4 + (b * (tile.d - 4.8)) / 5, CON_TOP]));
    }
  const tileSvg = L(tiles.join(""), { tone: "lo" });
  const contactSvg = Dots(contacts, { size: 0.28, tone: "mid" });
  const frame = L(k.planOutline(k.insetPlan(CON, 3.4), CON_TOP, P, 4), { tone: "faint" });
  const screws = k.corners(CON, 5);
  const screwSvg = L(screws.map(([x, y]) => k.ring(x, y, 1.8, CON_TOP, P, 14)).join(""), { tone: "lo" }) + Dots(screws.map(([x, y]) => at([x, y, CON_TOP])), { size: 0.45 });
  put("connector", centreOf(CON, PCB_TOP), body + frame + tileSvg + contactSvg + screwSvg, [A.slab(CON, PCB_TOP, CON_TOP - PCB_TOP, {}, 4)], { name: "connector.frame" });
}

// ---- the wafer: 84 die sites stitched across the scribe lines, cores as a dot field ----
// Mesh traffic for the slider: routes run along core rows and columns, X then Y, one detours round a spare core.
// They run in the near half (x > 0), which the cold plate's cutaway leaves open.
const DEFECT = [27, 21];
const ROUTES = [
  { name: "a", cells: [[19, 3], [33, 3], [33, 12]], at: 0.0 },
  // b sets off late so that its detour round the spare core falls in the slider's last step
  { name: "b", cells: [[19, 21], [26, 21], [26, 20], [28, 20], [28, 21], [34, 21], [34, 26]], at: 0.64, travel: 0.355 },
  { name: "c", cells: [[32, 16], [22, 16], [22, 7]], at: 0.24 },
  { name: "d", cells: [[20, 26], [30, 26], [30, 23]], at: 0.36 },
];
function wafer() {
  const body = S(k.slabOf(WAFER, CON_TOP, WAFER_TOP - CON_TOP, P, 2, 0.4), { tone: "hi", crease: "lo" });
  const seal = k.insetPlan(WAFER, 1.4);
  const lines = [k.planOutline(seal, WAFER_TOP, P, 2)];
  for (let i = 1; i < COLS; i++) lines.push(k.lineOnTop([WAFER.x + i * DIE_W, seal.y], [WAFER.x + i * DIE_W, seal.y + seal.d], WAFER_TOP, P));
  for (let j = 1; j < ROWS; j++) lines.push(k.lineOnTop([seal.x, WAFER.y + j * DIE_D], [seal.x + seal.w, WAFER.y + j * DIE_D], WAFER_TOP, P));
  const grid = L(lines.join(""), { tone: "lo" });
  const cores = [];
  for (let i = 0; i < GX; i++) for (let j = 0; j < GY; j++) if (i !== DEFECT[0] || j !== DEFECT[1]) cores.push(at([...coreAt(i, j), WAFER_TOP]));
  const coreSvg = Dots(cores, { size: 0.34, tone: "mid" });
  const [dx, dy] = coreAt(...DEFECT);
  const defect = L(k.ring(dx, dy, 1.6, WAFER_TOP, P, 14), { tone: "mid" });
  // the spare core's switched-off mark: a cross whose arms end on its ring, lit in the slider's last step
  const arm = (a) => at([dx + 2.8 * Math.cos(a), dy + 2.8 * Math.sin(a), WAFER_TOP]);
  const cross = [[Math.PI / 4, (5 * Math.PI) / 4], [(3 * Math.PI) / 4, (7 * Math.PI) / 4]].map(([a, b]) => {
    const [p, q] = [arm(a), arm(b)];
    return `M${p[0].toFixed(2)} ${p[1].toFixed(2)}L${q[0].toFixed(2)} ${q[1].toFixed(2)}`;
  });
  const ringPts = [];
  for (let i = 0; i <= 28; i++) ringPts.push(arm((i / 28) * 2 * Math.PI));
  const spare = `<g class="ws-spare"><path class="ws-spare-ring" d="${ringPts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join("")}Z"/><path class="ws-spare-x" d="${cross.join("")}"/></g>`;
  const scribe = ROUTES.map((route) => `<path class="ws-scribe" data-route="${route.name}" d=""/>`).join("");
  // the fabric overlay, driven by live.js: a trail and a head per route
  const fabric = ROUTES.map((route) => {
    const [sx, sy] = at([...coreAt(...route.cells[0]), WAFER_TOP]).map((v) => v.toFixed(2));
    return `<path class="iso-line ws-trail" data-tone="lit" data-route="${route.name}" d="M${sx} ${sy}"/><circle class="ws-head" data-route="${route.name}" cx="${sx}" cy="${sy}" r="0"/>`;
  }).join("");
  put("wafer", centreOf(WAFER, CON_TOP), body + grid + coreSvg + defect + `<g class="ws-fabric">${scribe}${spare}${fabric}</g>`, [A.slab(WAFER, CON_TOP, WAFER_TOP - CON_TOP, {}, 2)], { name: "wafer.engine" });
}

// ---- cold plate, near half cut away (everything with x > 0) ----
// A rounded outline from a list of corners [x, y, r]; r = 0 keeps a corner square.
function roundRing(corners, steps = 8) {
  const out = [];
  corners.forEach(([x, y, radius], index) => {
    if (!radius) return out.push([x, y]);
    const [px, py] = corners[(index + corners.length - 1) % corners.length];
    const [nx, ny] = corners[(index + 1) % corners.length];
    const d1 = [Math.sign(px - x), Math.sign(py - y)];
    const d2 = [Math.sign(nx - x), Math.sign(ny - y)];
    const c = [x + radius * (d1[0] + d2[0]), y + radius * (d1[1] + d2[1])];
    const a0 = Math.atan2(y + radius * d1[1] - c[1], x + radius * d1[0] - c[0]);
    let a1 = Math.atan2(y + radius * d2[1] - c[1], x + radius * d2[0] - c[0]);
    while (a1 - a0 > Math.PI) a1 -= 2 * Math.PI;
    while (a0 - a1 > Math.PI) a1 += 2 * Math.PI;
    for (let i = 0; i <= steps; i++) {
      const a = a0 + ((a1 - a0) * i) / steps;
      out.push([c[0] + radius * Math.cos(a), c[1] + radius * Math.sin(a)]);
    }
  });
  return out;
}
// the far half of a plan: x from plan.x to CUT, far corners rounded, the cut corners square
const CUT = 0;
const halfRing = (x0, y0, x1, y1, r, steps = 8) => roundRing([[x0, y0, r], [x1, y0, 0], [x1, y1, 0], [x0, y1, r]], steps);
const hOf = (plan, steps) => halfRing(plan.x, plan.y, CUT, plan.y + plan.d, plan.r, steps);
const hSolid = (plan, z, h, bevel, steps = 8) => k.extrude(hOf(plan, steps), z, h, P, { convex: false, bevel });
const hShape = (plan, z, h, steps = 8) => A.extruded(hOf(plan, steps), z, h, {});
const hSeam = (plan, z, steps = 8) => k.ringSeam(hOf(plan, steps), z, P);
const halfPlan = (plan) => ({ x: plan.x, y: plan.y, w: CUT - plan.x, d: plan.d, r: 0 });
// closed slots on the cut face (x = CUT): the coolant channels inside the plate, seen in section
function channels(from, to, z0, z1, count) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const a = from + ((to - from) * (i + 0.5)) / count - 2.6;
    const b = a + 5.2;
    out.push(k.pathOf([[CUT, a, z0], [CUT, b, z0], [CUT, b, z1], [CUT, a, z1]].map((p) => at(p)), true));
  }
  return out.join("");
}
// a quick-disconnect coupling standing on a face at z0: hex nut, neck, knurled sleeve, nose with its valve
function qdSvg(x, y, z0) {
  return {
    svg:
      S(k.cylinder(x, y, 9, z0, 4.6, P, 6, 0.4), { tone: "mid" }) +
      S(k.cylinder(x, y, 5.8, z0 + 4.6, 2.4, P, 28), { tone: "mid" }) +
      S(k.cylinder(x, y, 8, z0 + 7, 8, P, 36, 0.4), { tone: "hi", crease: "lo" }) +
      L(k.knurl(x, y, 8, z0 + 8.2, z0 + 13.8, 40, P), { tone: "lo" }) +
      S(k.cylinder(x, y, 5, z0 + 15, 3.4, P, 28, 0.3), { tone: "mid" }) +
      L(k.ring(x, y, 2.6, z0 + 18.4, P, 20), { tone: "lo" }) +
      S(k.cylinder(x, y, 1.7, z0 + 18.4, 0.01, P, 16), { tone: "lo", crease: "none" }),
    shapes: [cylShape(x, y, 9, z0, 4.6), cylShape(x, y, 5.8, z0 + 4.6, 2.4), cylShape(x, y, 8, z0 + 7, 8), cylShape(x, y, 5, z0 + 15, 3.4)],
    top: z0 + 18.4,
  };
}

function cold() {
  const ped = S(hSolid(PED, WAFER_TOP, FLANGE_Z - WAFER_TOP, 0.4, 3), { tone: "mid", inner: L(hSeam(PED, WAFER_TOP + 1.2, 3), { tone: "faint" }) });
  put("cold", centreOf(halfPlan(PED), WAFER_TOP), ped, [hShape(PED, WAFER_TOP, FLANGE_Z - WAFER_TOP, 3)], { name: "cold.pedestal" });

  const flange = S(hSolid(FLANGE, FLANGE_Z, FLANGE_TOP - FLANGE_Z, 0.8), { tone: "mid", inner: L(hSeam(FLANGE, FLANGE_Z + 2.4), { tone: "faint" }) });
  const bolts = [];
  for (let t = -130; t <= 130; t += 20) bolts.push([t, -150], [-150, t], [t, 150]);
  const flangeBolts = bolts.filter(([x, y]) => x < -4 && !(x < -128 && Math.abs(y) < 48));
  const boltSvg = L(flangeBolts.map(([x, y]) => k.ring(x, y, 2.1, FLANGE_TOP, P, 12)).join(""), { tone: "lo" }) + Dots(flangeBolts.map(([x, y]) => at([x, y, FLANGE_TOP])), { size: 0.45 });
  put("cold", centreOf(halfPlan(FLANGE), FLANGE_Z), flange + boltSvg, [hShape(FLANGE, FLANGE_Z, FLANGE_TOP - FLANGE_Z)], { name: "cold.flange" });

  const cut = L(channels(BODY.y + 8, BODY.y + BODY.d - 8, FLANGE_TOP + 5, BODY_TOP - 8, 17), { tone: "lo" });
  const body = S(hSolid(BODY, FLANGE_TOP, BODY_TOP - FLANGE_TOP, 1.2), { tone: "mid", inner: L(hSeam(BODY, BODY_TOP - 6), { tone: "faint" }) });
  const lidScrews = [];
  const e0 = BODY.x + 4.4;
  const e1 = BODY.y + BODY.d - 4.4;
  for (let t = -120; t <= 120; t += 20) lidScrews.push([e0, t], [-4.4, t]);
  for (let t = -110; t <= -10; t += 20) lidScrews.push([t, BODY.y + 4.4], [t, e1]);
  const screwSvg = L(lidScrews.map(([x, y]) => k.ring(x, y, 1.7, BODY_TOP, P, 12)).join(""), { tone: "lo" }) + Dots(lidScrews.map(([x, y]) => at([x, y, BODY_TOP])), { size: 0.42 });
  const lid = L(k.onTop(halfRing(BODY.x + 9, BODY.y + 9, CUT - 9, BODY.y + BODY.d - 9, 4, 6), BODY_TOP, P, true), { tone: "lo" });
  const name = k.faceTextSvg(k.topMatrix([-36, -64], BODY_TOP, P, "y"), "WSE-3", { size: 5, tone: "lo", anchor: "middle" });
  put("cold", centreOf(halfPlan(BODY), FLANGE_TOP), body + cut + lid + screwSvg + name, [hShape(BODY, FLANGE_TOP, BODY_TOP - FLANGE_TOP)], { name: "cold.body" });

  const rib = S(k.slabOf(RIB, BODY_TOP, RIB_TOP - BODY_TOP, P, 3, 0.4), { tone: "mid" });
  put("cold", centreOf(RIB, BODY_TOP), rib, [slabShape(RIB, BODY_TOP, RIB_TOP - BODY_TOP, 3)], { name: "cold.rib" });

  for (const [x, y] of FITTINGS) {
    const qd = qdSvg(x, y, RIB_TOP);
    put("cold", [x, y, RIB_TOP + 9], qd.svg, qd.shapes, { name: R.nameFor("cold.qd") });
  }

  // the facility block on the flange's far-left wing: the plate's hoses come in on its inner ports,
  // and the building's supply and return lines plug into the two couplings on its outer edge
  // (no IN/OUT engraving: the near hose hid it, and the lid already carries the figure's one engraved label)
  const MAN = { x: -168, y: -42, w: 35.5, d: 84, r: 3 };
  const manTop = FLANGE_TOP + 16;
  const portX = MAN.x + MAN.w - 7;
  const feedX = MAN.x + 9;
  const manSvg =
    S(k.slabOf(MAN, FLANGE_TOP, manTop - FLANGE_TOP, P, 3, 0.6), { tone: "mid", inner: L(k.sideSeam(MAN, FLANGE_TOP + 5, P, 3), { tone: "faint" }) }) +
    L(k.planOutline(k.insetPlan(MAN, 3), manTop, P, 3), { tone: "faint" }) +
    Dots(k.corners(MAN, 4.5).map(([x, y]) => at([x, y, manTop])), { size: 0.45 });
  put("cold", centreOf(MAN, FLANGE_TOP), manSvg, [slabShape(MAN, FLANGE_TOP, manTop - FLANGE_TOP, 3)], { name: "cold.manifold" });
  const qdTop = RIB_TOP + 18.4;
  FITTINGS.forEach(([x, y], index) => {
    const port = S(k.cylinder(portX, y, 5.4, manTop, 3.2, P, 28, 0.3), { tone: "mid" }) + S(k.cylinder(portX, y, 4.2, manTop + 3.2, 3, P, 24), { tone: "hi", crease: "lo" });
    put("cold", [portX, y, manTop + 3], port, [cylShape(portX, y, 5.4, manTop, 3.2), cylShape(portX, y, 4.2, manTop + 3.2, 3)], { name: R.nameFor("cold.port") });
    const lift = index === 0 ? 26 : 36;
    const route = G.fillet([[x, y, qdTop], [x, y, qdTop + lift], [portX, y, qdTop + lift], [portX, y, manTop + 6.2]], 9, 12, { P, tube: 3 });
    tube("cold", `cold.hose${index}`, route, 3, { tone: "mid", maxLength: 16, rings: { pitch: 3, twist: 1.2, cross: true } });
    // the facility coupling for this line, on the block's outer column
    const feed = qdSvg(feedX, y, manTop);
    put("cold", [feedX, y, manTop + 9], feed.svg, feed.shapes, { name: R.nameFor("cold.feed") });
  });

  // lifting handles on the lid: two posts and a bar each, running along x
  for (const [hx, hy] of [[-62, -102], [-62, 102]]) {
    const posts = [-28, 28].map((t) => [hx + t, hy]);
    const bar = { x: hx - 34, y: hy - 3.5, w: 68, d: 7, r: 3 };
    let svg = "";
    const shapes = [];
    for (const [x, y] of byDepth(posts)) {
      svg += S(k.cylinder(x, y, 5, BODY_TOP, 1.4, P, 28), { tone: "mid" }) + S(k.cylinder(x, y, 3, BODY_TOP + 1.4, 10.6, P, 24), { tone: "mid", crease: "none" });
      shapes.push(cylShape(x, y, 5, BODY_TOP, 1.4), cylShape(x, y, 3, BODY_TOP + 1.4, 10.6));
    }
    svg += S(k.slabOf(bar, BODY_TOP + 12, 5, P, 4, 0.6), { tone: "mid", inner: L(k.sideSeam(bar, BODY_TOP + 14.5, P, 4), { tone: "faint" }) });
    svg += Dots(posts.map(([x, y]) => at([x, y, BODY_TOP + 17])), { size: 0.5 });
    shapes.push(slabShape(bar, BODY_TOP + 12, 5, 4));
    put("cold", [hx, hy, BODY_TOP + 8], svg, shapes, { name: R.nameFor("cold.handle") });
  }

  // spring-loaded clamp screws over the two far pillars: a Belleville stack under each head
  PILLARS.forEach(([x, y]) => {
    if (x > CUT) return;
    let z = FLANGE_TOP;
    const parts = [S(k.cylinder(x, y, 10, z, 1, P, 36), { tone: "mid" })];
    const shapes = [cylShape(x, y, 10, z, 1)];
    z += 1;
    for (let i = 0; i < 4; i++) {
      const r = i % 2 ? 8 : 9;
      parts.push(S(k.cylinder(x, y, r, z, 1.3, P, 32), { tone: "mid" }));
      shapes.push(cylShape(x, y, r, z, 1.3));
      z += 1.3;
    }
    parts.push(S(k.cylinder(x, y, 6.6, z, 4.6, P, 32, 0.4), { tone: "hi", crease: "lo" }));
    shapes.push(cylShape(x, y, 6.6, z, 4.6));
    parts.push(L(k.knurl(x, y, 6.6, z + 0.6, z + 4, 28, P), { tone: "lo" }));
    parts.push(L(k.ring(x, y, 2.8, z + 4.6, P, 6), { tone: "mid" }));
    put("cold", [x, y, z], parts.join(""), shapes, { name: R.nameFor("cold.screw") });
  });
}

stand();
power();
pcb();
connector();
wafer();
cold();

if (!process.argv.includes("--fast")) A.settle(R, P);
R.items.sort((a, b) => a.key - b.key);
const groups = R.items.map((item, index) => {
  const [mx, my, mz] = item.move;
  const flow = /^cold\.(port|hose|feed|qd)/.test(item.name || "") ? " data-flow" : "";
  return `<g class="it"${flow} data-piece="${item.piece}" data-k="${item.key.toFixed(2)}" data-m="${mx.toFixed(1)},${my.toFixed(1)},${mz.toFixed(1)}" data-i="${index}">${item.svg}</g>`;
});

const LABEL = `The engine block of a Cerebras WSE-3 on an assembly fixture. From the bottom: a base plate with a ruler and four guide pillars; sixteen power modules; the main board with capacitors and I/O connectors; the wafer connector with one contact tile per die site; the WSE-3 wafer, a ${M.sideMm} mm square with ${M.WSE3.dies} die sites; and the water-cooled cold plate, its near half cut away, with two quick-disconnect fittings whose hoses run to a block on the flange where the supply and return lines plug in, two lifting handles and two spring-loaded screws.`;
const svg = k.figureSvg({ width: W, height: H, label: LABEL, body: [`<g class="ws-layers">${groups.join("")}</g>`], className: "ws-svg" });

const unit = (vector) => {
  const o = at([0, 0, 0]);
  const p = at(vector);
  return [p[0] - o[0], p[1] - o[1]];
};
// each route as screen points on the wafer's top face, in its seated pose
const hopsOf = (cells) => cells.slice(1).reduce((sum, c, i) => sum + Math.abs(c[0] - cells[i][0]) + Math.abs(c[1] - cells[i][1]), 0);
const r2 = (p) => p.map((v) => Math.round(v * 100) / 100);
// every scribe line a route crosses: where along the route (share of its screen length) and the die edge it crosses
function crossingsOf(cells) {
  const steps = [cells[0]];
  for (let n = 1; n < cells.length; n++) {
    let [i, j] = steps[steps.length - 1];
    const [ti, tj] = cells[n];
    while (i !== ti || j !== tj) {
      if (i !== ti) i += Math.sign(ti - i);
      else j += Math.sign(tj - j);
      steps.push([i, j]);
    }
  }
  const pts = steps.map(([i, j]) => at([...coreAt(i, j), WAFER_TOP]));
  const lengths = [0];
  for (let n = 1; n < pts.length; n++) lengths.push(lengths[n - 1] + Math.hypot(pts[n][0] - pts[n - 1][0], pts[n][1] - pts[n - 1][1]));
  const total = lengths[lengths.length - 1];
  const out = [];
  for (let n = 1; n < steps.length; n++) {
    const [i0, j0] = steps[n - 1];
    const [i1, j1] = steps[n];
    const g = (lengths[n - 1] + lengths[n]) / 2 / total;
    if (Math.floor(i0 / CORE_X) !== Math.floor(i1 / CORE_X)) {
      const x = WAFER.x + Math.max(i0, i1) / CORE_X * DIE_W;
      const row = Math.floor(j0 / CORE_Y);
      out.push({ g, seg: [r2(at([x, WAFER.y + row * DIE_D, WAFER_TOP])), r2(at([x, WAFER.y + (row + 1) * DIE_D, WAFER_TOP]))] });
    } else if (Math.floor(j0 / CORE_Y) !== Math.floor(j1 / CORE_Y)) {
      const y = WAFER.y + Math.max(j0, j1) / CORE_Y * DIE_D;
      const col = Math.floor(i0 / CORE_X);
      out.push({ g, seg: [r2(at([WAFER.x + col * DIE_W, y, WAFER_TOP])), r2(at([WAFER.x + (col + 1) * DIE_W, y, WAFER_TOP]))] });
    }
  }
  return out;
}
const routes = ROUTES.map((route) => ({ name: route.name, at: route.at, travel: route.travel, hops: hopsOf(route.cells), crossings: crossingsOf(route.cells), pts: route.cells.map(([i, j]) => r2(at([...coreAt(i, j), WAFER_TOP]))) }));
const DATA = {
  W,
  H,
  ZOOM: 1.5,
  V,
  EX: unit([1, 0, 0]),
  EY: unit([0, 1, 0]),
  EZ: unit([0, 0, 1]),
  pieces: Object.fromEntries(Object.entries(PIECES).map(([id, p]) => [id, { name: p.name, say: p.say }])),
  order: ORDER,
  routes,
  idle: M.IDLE,
  closed: M.CLOSED,
  scribe: M.SCRIBE,
  spare: M.SPARE,
  wavelet: `a wavelet leaves its core · ${M.PE.waveletBits} bits per clock`,
  fabricPbs: M.WSE3.fabricPbs,
  fabric: `${M.fmt(M.WSE3.cores)} cores on one 2D mesh · ${M.PE.waveletBits}-bit wavelets · ${M.WSE3.fabricPbs} Pb/s`,
};

const PARTS = ORDER.map((id, index) => `<button type="button" class="ws-part" data-part="${id}"><span class="ws-num">${String(index + 1).padStart(2, "0")}</span>${PIECES[id].name}</button>`).join("");
const corners = `<div class="iso-plate-corners" aria-hidden="true"><span class="iso-plate-corner" data-corner="fig">Fig 1</span><span class="iso-plate-corner" data-corner="title">WSE-3 · engine block</span><span class="iso-plate-corner" data-corner="readout" data-readout>${M.IDLE}</span></div>`;
const controls = `<div class="ws-controls"><span class="ws-hint">Hover a layer · Space plays</span><span class="ws-live" aria-live="polite" data-live></span></div>`;
const stage = `<div class="ws-stage" tabindex="0" role="slider" aria-label="Cerebras WSE-3 engine block. The layers rest lifted apart. Hover, or use the arrow keys, to pick a layer; Space plays or pauses the assembly and the mesh traffic; Escape resets; the slider below steps through it." aria-valuemin="0" aria-valuemax="${ORDER.length}" aria-valuenow="0" aria-valuetext="Taken apart · ${M.IDLE}">${svg}</div>`;
const caption = `Cerebras WSE-3: one ${M.sideMm} × ${M.sideMm} mm square cut from a ${M.WSE3.waferMm} mm wafer (${M.fmt(M.WSE3.areaMm2)} mm², about ${Math.round(M.reticles)} reticle fields), with ${M.WSE3.transistorsT} trillion transistors on ${M.WSE3.node}, ${M.fmt(M.WSE3.cores)} cores and ${M.WSE3.sramGB} GB of SRAM; its ${M.WSE3.dies} die sites are wired across the scribe lines into one 2D mesh. Illustrative: the fixture, the power modules' number and layout, the connector tiles, the coolant fittings and the board details; the wafer's clipped corners are drawn square, heights are exaggerated (plan sizes match the 5 mm ruler), and each dot stands for about ${M.fmt(Math.round(M.coresPerDie / (CORE_X * CORE_Y) / 100) * 100)} cores. The cold plate's near half is cut away to show the wafer; coolant enters and leaves at its far-left block. Mesh traffic is drawn on the visible face; the real transistors face the connector.`;
const scrub = `<span class="ws-scrub"><button type="button" class="ws-play" data-play aria-label="Play the assembly and the mesh traffic"><span class="ws-play-icon" aria-hidden="true"></span><span data-play-text>Play</span></button><input type="range" class="ws-range" data-scrub min="0" max="1000" step="1" value="0" aria-label="Process: 0 is taken apart, 1000 is the closed engine"><span class="ws-step" data-step>apart</span></span>`;
const body = `<figure class="iso-figure ws"><div class="iso-plate">${corners}${stage}${controls}</div><figcaption class="iso-legend">${scrub}<span class="ws-parts">${PARTS}</span><span class="iso-caption">${caption}</span></figcaption></figure>`;

const CSS = readFileSync(join(HERE, "wafer-scale.css"), "utf8");
const LIVE = readFileSync(join(HERE, "live.js"), "utf8").replace("__DATA__", JSON.stringify(DATA));
const out = writeChapter({ slug: "wafer-scale", figure: body, css: CSS, script: LIVE, lesson: LESSON });
console.log("wrote", out.file, `${out.kb} KB`, `${R.items.length} items`, `${R.solids.length} solids`);

A.auditOrExit(R, P);
