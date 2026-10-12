// Five NVIDIA GPU packages, V100 to Rubin, in nests on one bench plate, to scale, with an inspection gantry
// that travels along the row and stops over each generation.
// node build.mjs [--fast] [--audit]
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as M from "./model.mjs";

import { k, G, A } from "../../site/kit.mjs";
import { writeChapter } from "../../site/shell.mjs";
import { LESSON } from "./lesson.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SLUG = "accelerator-generations";

// ---- world: 1 unit = 1 mm in plan; heights of the packages are exaggerated ----
const W = 720;
const H = 340;
const AZIMUTH = 74;
const ELEVATION = 34;

const PLATE_H = 10;
const FOOT_H = 5;

// package heights (exaggerated, illustrative)
const NEST_TOP = 3.2;
const SUB_TOP = 5.6;
const INT_TOP = 6.6;
const CHIP_Z = 7.0;
const CHIP_TOP = 10.6;

const f2 = (v) => Math.round(v * 100) / 100;
const centreOf = (plan, z) => [plan.x + plan.w / 2, plan.y + plan.d / 2, z];
const shifted = (plan, dx, dy = 0) => ({ ...plan, x: plan.x + dx, y: plan.y + dy });
const bounds = (plans, pad, r) => {
  const x0 = Math.min(...plans.map((p) => p.x)) - pad;
  const y0 = Math.min(...plans.map((p) => p.y)) - pad;
  const x1 = Math.max(...plans.map((p) => p.x + p.w)) + pad;
  const y1 = Math.max(...plans.map((p) => p.y + p.d)) + pad;
  return { x: f2(x0), y: f2(y0), w: f2(x1 - x0), d: f2(y1 - y0), r };
};

// ---- per-generation package layout, centred on its own origin ----
function layoutOf(g) {
  const [hw, hl] = M.HBM_MM[g.hbm.gen];
  const dies = [];
  const hbm = [];
  if (g.dies === 1) {
    const w = M.RETICLE_MM[0];
    const d = f2(g.dieMm2 / w); // true area, illustrative aspect
    dies.push({ x: -w / 2, y: -d / 2, w, d, r: 0.4 });
    const per = g.hbm.sites / 2;
    const gap = 1;
    const col = per * hl + (per - 1) * gap;
    for (const side of [-1, 1]) {
      const x = side < 0 ? -w / 2 - 1 - hw : w / 2 + 1;
      for (let i = 0; i < per; i++) {
        const site = { x, y: f2(-col / 2 + i * (hl + gap)), w: hw, d: hl, r: 0.4 };
        // one site of six is a dummy spacer on A100 and H100: the last on the near column
        site.dummy = g.hbm.sites > g.hbm.stacks && side > 0 && i === per - 1;
        hbm.push(site);
      }
    }
  } else {
    const [w, d] = M.RETICLE_MM;
    const seam = 1.2;
    for (const side of [-1, 1]) dies.push({ x: side < 0 ? -seam / 2 - w : seam / 2, y: -d / 2, w, d, r: 0.4 });
    for (const die of dies) {
      const gap = 1.6;
      const row = 2 * hw + gap;
      for (const y of [-d / 2 - 1 - hl, d / 2 + 1]) for (let i = 0; i < 2; i++) hbm.push({ x: f2(die.x + (w - row) / 2 + i * (hw + gap)), y: f2(y), w: hw, d: hl, r: 0.4, dummy: false });
    }
  }
  const int = bounds([...dies, ...hbm], 1.6, 0.6);
  const sub = bounds([int], 7, 1.6);
  const nest = bounds([sub], 3.4, 2.4);
  return { g, dies, hbm, int, sub, nest };
}

const PKGS = M.GENS.map(layoutOf);
// place the nests in a row along x, 10 mm apart, centred on x = 0; all on one y line
const GAP = 10;
const ROW_Y = 8;
{
  const total = PKGS.reduce((s, p) => s + p.nest.w, 0) + GAP * (PKGS.length - 1);
  let x = -total / 2;
  for (const p of PKGS) {
    p.cx = f2(x - p.nest.x);
    x += p.nest.w + GAP;
  }
}
const at0 = (p, plan) => shifted(plan, p.cx, ROW_Y);
const NESTS = PKGS.map((p) => at0(p, p.nest));
const ROW_X0 = NESTS[0].x;
const TAG_Y = 54;
const ROW_X1 = NESTS[NESTS.length - 1].x + NESTS[NESTS.length - 1].w;

const PLATE = { x: f2(ROW_X0 - 84), y: -84, w: f2(ROW_X1 - ROW_X0 + 102), d: 166, r: 8 };
// the station's display terminal at the left end; its screen is drawn in the plane of the front face
const CONSOLE = { x: PLATE.x + 10, y: -34, w: 48, d: 18, r: 1.6 };
const CONSOLE_TOP = 40;
const SCREEN = { x0: CONSOLE.x + 4, x1: CONSOLE.x + CONSOLE.w - 4, z0: 9, z1: CONSOLE_TOP - 4, y: CONSOLE.y + CONSOLE.d };
const SW = SCREEN.x1 - SCREEN.x0;
const SH = SCREEN.z1 - SCREEN.z0;
// linear guide rails along the back, with the ball screw between them
const RAIL_Y = [-72, -50];
const RAIL_H = 4;
const RAIL = (y) => ({ x: PLATE.x + 30, y: y - 3, w: PLATE.w - 46, d: 6, r: 0.8 });
const SCREW_Y = -61;
const SCREW_Z = 5.4;
const SCREW_R = 2;
const MOTOR = { x: PLATE.x + 3, y: -70, w: 18, d: 18, r: 1.6 };
const MOTOR_TOP = 20;

// gantry, built over the first package; it travels to the last
const STOPS = PKGS.map((p) => p.cx);
const TRAVEL = f2(STOPS[STOPS.length - 1] - STOPS[0]);
const GX = STOPS[0];
const CAR = { x: GX - 15, y: -78, w: 30, d: 34, r: 2 };
const BLOCK_TOP = 9.4;
const CAR_TOP = 13.4;
const COLUMN = { x: GX - 8, y: -70, w: 16, d: 16, r: 1.6 };
const COL_TOP = 86;
const ARM = { x: GX - 6, y: -68, w: 12, d: 76 + ROW_Y, r: 1.4 };
const ARM_Z = COL_TOP;
const ARM_TOP = ARM_Z + 8;
const HEAD = [GX, ROW_Y];
const MOVE = [TRAVEL, 0, 0];

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), ...k.boxCorners(shifted(ARM, TRAVEL), ARM_Z, ARM_TOP), ...k.boxCorners(ARM, ARM_Z, ARM_TOP)],
  W,
  H,
  { pad: 18, azimuth: AZIMUTH, elevation: ELEVATION },
);
const V = G.viewOf(P);
const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);

const SPRING = { stagger: 0.05, stiffness: 64, damping: 14.2, substeps: 4 };
const R = A.recorder(P, { order: ["gantry"], spring: SPRING });
function put(name, part, ref, svg, shapes, { piece = "static", bias = 0 } = {}) {
  const id = R.nameFor(name);
  shapes.forEach((shape) => (shape.name = shape.name ?? id));
  R.put({ piece, at: ref, bias, svg, move: piece === "gantry" ? MOVE : [0, 0, 0], shapes: shapes.map(R.solid), name: id, part });
}
const slabShape = (plan, z, h, steps = 4) => A.slab(plan, z, h, {}, steps);
const cylShape = (x, y, r, z, h) => A.cylinder(x, y, r, z, h, {});
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));

// ---- the bench: plate, feet, ruler, label plate, rails, screw, motor, end stops ----
function bench() {
  const out = [];
  const shapes = [];
  out.push(`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`);
  for (const [x, y] of byDepth(k.corners(PLATE, 22))) {
    out.push(S(k.cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.4, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
    shapes.push(A.cylinder(x, y, 7, -PLATE_H - FOOT_H, FOOT_H, { name: "bench.foot", ground: true }));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.4), { tone: "mid", inner: L(k.sideSeam(PLATE, -PLATE_H + 3, P, 8), { tone: "faint" }) }));
  shapes.push(A.slab(PLATE, -PLATE_H, PLATE_H, { name: "bench.plate" }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 11);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(Dots(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // ruler strip along the near edge: 1 mm = 1 unit, ticks every 2 mm, majors every 10 mm
  const strip = { x: ROW_X0, y: PLATE.y + PLATE.d - 16, w: Math.floor((ROW_X1 - ROW_X0 - 70) / 10) * 10 + 8, d: 7, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 2, 5, strip.y + 0.8, 0.6, [2, 3.6], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(Dots([at([strip.x + 2, strip.y + 3.5, 0.6]), at([strip.x + strip.w - 2, strip.y + 3.5, 0.6])], { size: 0.45 }));
  // label plate at the near right corner
  const label = { x: ROW_X1 - 56, y: PLATE.y + PLATE.d - 21, w: 54, d: 13, r: 1.4 };
  out.push(S(k.slabOf(label, 0, 0.8, P, 4), { tone: "lo", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.6), 0.8, P, 4), { tone: "faint" }));
  out.push(L([0, 1, 2].map((i) => k.lineOnTop([label.x + 7, label.y + 4 + i * 2.6], [label.x + 42 - i * 10, label.y + 4 + i * 2.6], 0.8, P)).join(""), { tone: "lo", free: true }));
  out.push(Dots([at([label.x + 3.5, label.y + label.d / 2, 0.8]), at([label.x + label.w - 3.5, label.y + label.d / 2, 0.8])], { size: 0.45 }));
  put("bench.base", "bench", [0, 0, -1], out.join(""), shapes, { bias: -600 });

  // rails with screw dots and end stops
  for (const y of RAIL_Y) {
    const rail = RAIL(y);
    const holes = [];
    for (let x = rail.x + 8; x <= rail.x + rail.w - 8; x += 20) holes.push([x, y]);
    const svg =
      S(k.slabOf(rail, 0, RAIL_H, P, 3, 0.4), { tone: "mid", inner: L(k.sideSeam(rail, 2.2, P, 3), { tone: "faint" }) }) +
      L(holes.map(([x, yy]) => k.ring(x, yy, 1.3, RAIL_H, P, 12)).join(""), { tone: "lo" }) +
      Dots(holes.map(([x, yy]) => at([x, yy, RAIL_H])), { size: 0.35, tone: "lo" });
    put("bench.rail", "bench", centreOf(rail, 0), svg, [slabShape(rail, 0, RAIL_H, 3)]);
    for (const x of [rail.x - 6, rail.x + rail.w]) {
      const stop = { x, y: y - 5, w: 6, d: 10, r: 1 };
      const sv = S(k.slabOf(stop, 0, 8, P, 3, 0.5), { tone: "mid" }) + Dots([at([x + 3, y - 2.4, 8]), at([x + 3, y + 2.4, 8])], { size: 0.45 });
      put("bench.stop", "bench", centreOf(stop, 0), sv, [slabShape(stop, 0, 8, 3)]);
    }
  }

  // motor at the left end, coupling, ball screw, bearing block at the right end
  const motorSvg =
    S(k.slabOf(MOTOR, 0, MOTOR_TOP, P, 4, 0.8), { tone: "mid", inner: L([4, 16].map((z) => k.sideSeam(MOTOR, z, P, 4)).join(""), { tone: "faint" }) }) +
    L(k.planOutline(k.insetPlan(MOTOR, 3), MOTOR_TOP, P, 4), { tone: "lo" }) +
    Dots(k.corners(MOTOR, 3).map(([x, y]) => at([x, y, MOTOR_TOP])), { size: 0.5 });
  put("bench.motor", "bench", centreOf(MOTOR, 0), motorSvg, [slabShape(MOTOR, 0, MOTOR_TOP, 4)]);
  const FX = G.frameAlong([0, SCREW_Y, SCREW_Z], [1, 0, 0]);
  const x0 = MOTOR.x + MOTOR.w;
  const coup = S(G.disc(x0, x0 + 6, 3.6, FX, P, { bevel: 0.3 }), { tone: "mid" });
  put("bench.coupling", "bench", [x0 + 3, SCREW_Y, SCREW_Z], coup, [A.disc(FX, x0, x0 + 6, 3.6, {})]);
  const rail = RAIL(RAIL_Y[0]);
  const bearX = rail.x + rail.w - 12;
  const screwSvg = S(G.disc(x0 + 6, bearX, SCREW_R, FX, P), { tone: "mid", crease: "none" });
  put("bench.screw", "bench", [(x0 + bearX) / 2, SCREW_Y, SCREW_Z], screwSvg, [A.disc(FX, x0 + 6, bearX, SCREW_R, {})]);
  const bear = { x: bearX, y: SCREW_Y - 6, w: 10, d: 12, r: 1.2 };
  put("bench.bearing", "bench", centreOf(bear, 0), S(k.slabOf(bear, 0, 11, P, 3, 0.5), { tone: "mid" }) + Dots([at([bearX + 5, SCREW_Y - 3.5, 11]), at([bearX + 5, SCREW_Y + 3.5, 11])], { size: 0.45 }), [slabShape(bear, 0, 11, 3)]);
}

// ---- one nest with its package ----
function nest(p, index) {
  const part = p.g.id;
  const N = at0(p, p.nest);
  const SUB = at0(p, p.sub);
  const INT = at0(p, p.int);
  // nest block: pocket groove, alignment pins at two corners, screws
  const nestSvg =
    S(k.slabOf(N, 0, NEST_TOP, P, 4, 0.4), { tone: "mid", inner: L(k.sideSeam(N, 1.4, P, 4), { tone: "faint" }) }) +
    L(k.planOutline(k.insetPlan(SUB, -0.8), NEST_TOP, P, 4), { tone: "lo" }) +
    Dots(k.corners(N, 1.7).map(([x, y]) => at([x, y, NEST_TOP])), { size: 0.4 });
  put(`nest.${part}`, "bench", centreOf(N, 0), nestSvg, [slabShape(N, 0, NEST_TOP)], { bias: -0.5 });
  // year tag in front of the nest, engraved rule lines standing for text
  const tag = { x: N.x + N.w / 2 - 11, y: TAG_Y, w: 22, d: 7, r: 1 };
  const tagSvg = S(k.slabOf(tag, 0, 0.6, P, 3), { tone: "lo", crease: "none" }) + L([0, 1].map((i) => k.lineOnTop([tag.x + 4, tag.y + 2.6 + i * 2], [tag.x + 17 - i * 6, tag.y + 2.6 + i * 2], 0.6, P)).join(""), { tone: "lo", free: true });
  put(`tag.${part}`, "bench", centreOf(tag, 0), tagSvg, [slabShape(tag, 0, 0.6, 3)]);

  // substrate with build-up layer seams, fiducials and capacitors in the moat
  const subSvg =
    S(k.slabOf(SUB, NEST_TOP, SUB_TOP - NEST_TOP, P, 4, 0.3), { tone: "mid", inner: L(k.sideSeam(SUB, NEST_TOP + 1, P, 4), { tone: "faint" }) }) +
    L([[SUB.x + 3, SUB.y + 3], [SUB.x + SUB.w - 3, SUB.y + SUB.d - 3]].map(([x, y]) => k.ring(x, y, 1, SUB_TOP, P, 12)).join(""), { tone: "lo" });
  put(`sub.${part}`, part, centreOf(SUB, NEST_TOP), subSvg, [slabShape(SUB, NEST_TOP, SUB_TOP - NEST_TOP)]);
  const caps = [];
  for (const x of [INT.x - 4.4, INT.x + INT.w + 2]) for (let y = INT.y + 3; y <= INT.y + INT.d - 4; y += 5) caps.push({ x, y, w: 2.4, d: 1.2, r: 0.15 });
  const capSvg = [...caps].sort((a, b) => k.depthOf(centreOf(a, 0), P) - k.depthOf(centreOf(b, 0), P)).map((c) => S(k.slabOf(c, SUB_TOP, 0.9, P, 2), { tone: "mid", crease: "none" })).join("");
  put(`caps.${part}`, part, centreOf(INT, SUB_TOP), capSvg, caps.map((c) => slabShape(c, SUB_TOP, 0.9, 2)));
  // interposer
  const intSvg = S(k.slabOf(INT, SUB_TOP, INT_TOP - SUB_TOP, P, 3, 0.2), { tone: "mid" }) + L(k.planOutline(k.insetPlan(INT, 0.7), INT_TOP, P, 3), { tone: "faint" });
  put(`int.${part}`, part, centreOf(INT, SUB_TOP), intSvg, [slabShape(INT, SUB_TOP, INT_TOP - SUB_TOP, 3)]);

  // HBM stacks: base die plus core dies as side seams; a dummy site is plain silicon
  p.hbm.forEach((h0, i) => {
    const h = at0(p, h0);
    const highs = M.HBM_HIGH[p.g.hbm.gen];
    let inner = "";
    if (!h0.dummy) {
      const base = CHIP_Z + 0.6;
      const step = (CHIP_TOP - 0.3 - base) / highs;
      inner = L(k.sideSeam(h, base, P, 2), { tone: "lo" }) + L(Array.from({ length: highs - 1 }, (_, j) => k.sideSeam(h, base + (j + 1) * step, P, 2)).join(""), { tone: "faint" });
    }
    const svg = S(k.slabOf(h, CHIP_Z, CHIP_TOP - CHIP_Z, P, 2, 0.2), { tone: h0.dummy ? "mid" : "hi", crease: "lo", inner }) + (h0.dummy ? "" : Dots([at([h.x + 1.6, h.y + 1.6, CHIP_TOP])], { size: 0.4, tone: "mid" }));
    const fill = k.insetPlan(h, -0.3);
    put(`hbm.${part}`, part, centreOf(h, CHIP_Z), S(k.slabOf(fill, INT_TOP, CHIP_Z - INT_TOP, P, 2), { tone: "lo", crease: "none" }) + svg, [slabShape(fill, INT_TOP, CHIP_Z - INT_TOP, 2), slabShape(h, CHIP_Z, CHIP_TOP - CHIP_Z, 2)]);
  });

  // compute dies: seal ring, a floorplan grid, PHY bands toward the HBM, die-to-die bumps on two-die parts
  p.dies.forEach((d0, i) => {
    const d = at0(p, d0);
    const fill = k.insetPlan(d, -0.3);
    const seal = k.insetPlan(d, 0.9);
    const lines = [k.planOutline(seal, CHIP_TOP, P, 2)];
    const two = p.dies.length === 2;
    const grid = { x: seal.x + (two ? 0.8 : 4.2), y: seal.y + (two ? 4.2 : 0.8), w: seal.w - (two ? 1.6 : 8.4), d: seal.d - (two ? 8.4 : 1.6), r: 0 };
    lines.push(k.planOutline(grid, CHIP_TOP, P, 2));
    const cols = two ? 3 : 4;
    const rows = two ? 5 : 6;
    for (let c = 1; c < cols; c++) lines.push(k.lineOnTop([grid.x + (grid.w * c) / cols, grid.y], [grid.x + (grid.w * c) / cols, grid.y + grid.d], CHIP_TOP, P));
    for (let r = 1; r < rows; r++) lines.push(k.lineOnTop([grid.x, grid.y + (grid.d * r) / rows], [grid.x + grid.w, grid.y + (grid.d * r) / rows], CHIP_TOP, P));
    let extra = "";
    if (two) {
      const sx = i === 0 ? seal.x + seal.w - 1.6 : seal.x + 1.6;
      const bumps = [];
      for (let y = grid.y + 1.5; y <= grid.y + grid.d - 1.5; y += 1.5) bumps.push(at([sx, y, CHIP_TOP]));
      extra = Dots(bumps, { size: 0.26, tone: "mid" });
    }
    const svg = S(k.slabOf(fill, INT_TOP, CHIP_Z - INT_TOP, P, 2), { tone: "lo", crease: "none" }) + S(k.slabOf(d, CHIP_Z, CHIP_TOP - CHIP_Z, P, 2, 0.3), { tone: "hi", crease: "lo" }) + L(lines.join(""), { tone: "lo" }) + extra;
    put(`die.${part}`, part, centreOf(d, CHIP_Z), svg, [slabShape(fill, INT_TOP, CHIP_Z - INT_TOP, 2), slabShape(d, CHIP_Z, CHIP_TOP - CHIP_Z, 2)]);
  });
}

// ---- the gantry: carriage on four rail blocks, column, arm, camera head with ring light ----
function gantry() {
  const opts = { piece: "gantry" };
  for (const y of RAIL_Y) {
    for (const dx of [-9, 9]) {
      const b = { x: GX + dx - 5, y: y - 4.5, w: 10, d: 9, r: 1 };
      const svg = S(k.slabOf(b, RAIL_H, BLOCK_TOP - RAIL_H, P, 3, 0.4), { tone: "mid", inner: L(k.sideSeam(b, RAIL_H + 1.4, P, 3), { tone: "faint" }) });
      put("gantry.block", "bench", centreOf(b, RAIL_H), svg, [slabShape(b, RAIL_H, BLOCK_TOP - RAIL_H, 3)], opts);
    }
  }
  const carScrews = k.corners(CAR, 3);
  const carSvg =
    S(k.slabOf(CAR, BLOCK_TOP, CAR_TOP - BLOCK_TOP, P, 4, 0.5), { tone: "mid" }) +
    L(carScrews.map(([x, y]) => k.ring(x, y, 1.3, CAR_TOP, P, 12)).join(""), { tone: "lo" }) +
    Dots(carScrews.map(([x, y]) => at([x, y, CAR_TOP])), { size: 0.4 });
  put("gantry.carriage", "bench", centreOf(CAR, BLOCK_TOP), carSvg, [slabShape(CAR, BLOCK_TOP, CAR_TOP - BLOCK_TOP)], opts);
  const colSvg = S(k.slabOf(COLUMN, CAR_TOP, COL_TOP - CAR_TOP, P, 4, 0.6), { tone: "mid", inner: L([CAR_TOP + 6, COL_TOP - 14].map((z) => k.sideSeam(COLUMN, z, P, 4)).join(""), { tone: "faint" }) });
  put("gantry.column", "bench", centreOf(COLUMN, CAR_TOP), colSvg, [slabShape(COLUMN, CAR_TOP, COL_TOP - CAR_TOP)], opts);
  const armSvg =
    S(k.slabOf(ARM, ARM_Z, ARM_TOP - ARM_Z, P, 4, 0.5), { tone: "mid", inner: L(k.sideSeam(ARM, ARM_Z + 4, P, 4), { tone: "faint" }) }) +
    L(k.planOutline(k.insetPlan(ARM, 2.4), ARM_TOP, P, 4), { tone: "faint" });
  put("gantry.arm", "bench", centreOf(ARM, ARM_Z), armSvg, [slabShape(ARM, ARM_Z, ARM_TOP - ARM_Z)], opts);
  // camera head hanging under the arm tip
  const [hx, hy] = HEAD;
  const parts = [];
  const shapes = [];
  const stack = [
    [5, 44, 4, "mid"], // objective
    [12, 48, 3.2, "hi"], // ring light
    [8, 51.2, 9, "mid"], // tube
    [9.6, 60.2, 2.4, "mid"], // focus collar
    [8, 62.6, ARM_Z - 62.6, "mid"], // camera body up to the arm
  ];
  for (const [r, z, h, tone] of stack) {
    parts.push(S(k.cylinder(hx, hy, r, z, h, P, 36, 0.3), { tone, crease: tone === "hi" ? "lo" : "faint" }));
    shapes.push(cylShape(hx, hy, r, z, h));
  }
  parts.push(L(k.knurl(hx, hy, 9.6, 60.4, 62.4, 40, P), { tone: "lo" }));
  parts.push(L(k.sideArc(hx, hy, 8, 74, P, 24), { tone: "faint" }));
  put("gantry.head", "bench", [hx, hy, 64], parts.join(""), shapes, opts);
}

// ---- the terminal: case on a plinth, bezel, status lamp, and the bar display ----
function planeMatrix(origin, u, v) {
  const o = at(origin);
  const pu = at([origin[0] + u[0], origin[1] + u[1], origin[2] + u[2]]);
  const pv = at([origin[0] + v[0], origin[1] + v[1], origin[2] + v[2]]);
  const t = (n) => Math.round(n * 1000) / 1000;
  return `matrix(${t(pu[0] - o[0])} ${t(pu[1] - o[1])} ${t(pv[0] - o[0])} ${t(pv[1] - o[1])} ${t(o[0])} ${t(o[1])})`;
}
const BARS = [
  ["XTR", (g) => g.transistorsB],
  ["MEM", (g) => g.memGB],
  ["BW", (g) => g.bwTBs],
  ["FLOP", (g) => g.flops.dense],
  ["PWR", (g) => g.watts],
];
const BAR = { u: 9, w: SW - 11, v0: 7.4, step: 3.6, h: 1.8 };
function screenContent() {
  const out = [`<rect class="ag-glass" x="0" y="0" width="${SW}" height="${SH}"/>`];
  out.push(`<text class="ag-scr-head" x="2" y="4.4" data-scr="name">READY</text><text class="ag-scr-dim" x="${SW - 2}" y="4.4" text-anchor="end" data-scr="year"></text>`);
  out.push(`<path class="ag-scr-rule" d="M1.4 5.6H${SW - 1.4}"/>`);
  BARS.forEach(([label], i) => {
    const v = BAR.v0 + i * BAR.step;
    out.push(`<text class="ag-scr-dim" x="2" y="${f2(v + 1.5)}">${label}</text>`);
    out.push(`<rect class="ag-scr-track" x="${BAR.u}" y="${f2(v)}" width="${f2(BAR.w)}" height="${BAR.h}"/>`);
    out.push(`<rect class="ag-scr-bar" data-bar="${i}" x="${BAR.u}" y="${f2(v)}" width="0" height="${BAR.h}"/>`);
  });
  return out.join("");
}
function terminal() {
  const plinth = k.insetPlan(CONSOLE, -2);
  put("bench.plinth", "bench", centreOf(plinth, 0), S(k.slabOf(plinth, 0, 2.4, P, 4, 0.4), { tone: "mid" }), [slabShape(plinth, 0, 2.4)]);
  const m = planeMatrix([SCREEN.x0, SCREEN.y + 0.02, SCREEN.z1], [1, 0, 0], [0, 0, -1]);
  const bezel = k.pathOf([[SCREEN.x0 - 1.4, SCREEN.z0 - 1.4], [SCREEN.x1 + 1.4, SCREEN.z0 - 1.4], [SCREEN.x1 + 1.4, SCREEN.z1 + 1.4], [SCREEN.x0 - 1.4, SCREEN.z1 + 1.4]].map(([x, z]) => at([x, SCREEN.y, z])), true);
  const lamp = Dots([at([SCREEN.x1 - 1.5, SCREEN.y, SCREEN.z0 - 3.4])], { size: 0.6, tone: "mid" });
  const vents = L([0, 1, 2, 3].map((i) => k.planOutline({ x: CONSOLE.x + 8 + i * 8, y: CONSOLE.y + 5, w: 5, d: 1.2, r: 0.6 }, CONSOLE_TOP, P, 2)).join(""), { tone: "lo" });
  const screws = Dots(k.corners(CONSOLE, 2.4).map(([x, y]) => at([x, y, CONSOLE_TOP])), { size: 0.45 });
  const screen = `<g transform="${m}"><clipPath id="ag-clip-screen"><rect x="0" y="0" width="${f2(SW)}" height="${f2(SH)}"/></clipPath><g clip-path="url(#ag-clip-screen)" class="ag-screen">${screenContent()}</g></g>`;
  const svg = S(k.slabOf(CONSOLE, 2.4, CONSOLE_TOP - 2.4, P, 4, 0.6), { tone: "mid", inner: L(k.sideSeam(CONSOLE, 5, P, 4), { tone: "faint" }) }) + L(bezel, { tone: "lo" }) + screen + lamp + vents + screws;
  put("bench.terminal", "bench", centreOf(CONSOLE, 2.4), svg, [slabShape(CONSOLE, 2.4, CONSOLE_TOP - 2.4)]);
  // stop switch box at the near left corner: housing, guard collar and mushroom button
  const box = { x: PLATE.x + 14, y: 30, w: 22, d: 22, r: 2 };
  const [bx, by] = [box.x + box.w / 2, box.y + box.d / 2];
  const boxSvg =
    S(k.slabOf(box, 0, 12, P, 4, 0.6), { tone: "mid", inner: L(k.sideSeam(box, 9, P, 4), { tone: "faint" }) }) +
    Dots(k.corners(box, 2.2).map(([x, y]) => at([x, y, 12])), { size: 0.45 });
  put("bench.stopbox", "bench", centreOf(box, 0), boxSvg, [slabShape(box, 0, 12)]);
  const btn =
    S(k.cylinder(bx, by, 8, 12, 2, P, 40, 0.3), { tone: "mid" }) +
    S(k.cylinder(bx, by, 4.2, 14, 3, P, 32), { tone: "mid", crease: "none" }) +
    S(k.cylinder(bx, by, 7, 17, 3, P, 40, 0.8), { tone: "hi", crease: "lo" }) +
    L(k.ring(bx, by, 4.6, 20, P, 32), { tone: "lo" });
  put("bench.button", "bench", [bx, by, 16], btn, [cylShape(bx, by, 8, 12, 2), cylShape(bx, by, 4.2, 14, 3), cylShape(bx, by, 7, 17, 3)]);
}

bench();
terminal();
PKGS.forEach(nest);
gantry();

if (!process.argv.includes("--fast")) A.settle(R, P);
R.items.sort((a, b) => a.key - b.key);
const groups = R.items.map((item, index) => {
  const [mx, my, mz] = item.move;
  return `<g class="it" data-piece="${item.piece}" data-part="${item.part}" data-k="${item.key.toFixed(2)}" data-m="${mx.toFixed(1)},${my.toFixed(1)},${mz.toFixed(1)}" data-i="${index}">${item.svg}</g>`;
});

const LABEL = `Five NVIDIA data-center GPU packages in nests on one bench plate, to scale, oldest at the left: V100, A100, H100, B200 and Rubin. An inspection gantry rides two linear rails behind them, driven by a motor and ball screw, and its camera head stops over each package in turn.`;
const svg = k.figureSvg({ width: W, height: H, label: LABEL, body: [`<g class="ag-layers">${groups.join("")}</g>`], className: "ag-svg" });

const unit = (v) => {
  const o = at([0, 0, 0]);
  const p = at(v);
  return [p[0] - o[0], p[1] - o[1]];
};
const DATA = {
  V,
  EX: unit([1, 0, 0]),
  EY: unit([0, 1, 0]),
  EZ: unit([0, 0, 1]),
  stops: STOPS.map((x) => (x - STOPS[0]) / TRAVEL),
  gens: M.GENS.map((g) => ({ id: g.id, name: g.name, year: g.year, say: M.sayOf(g), step: `${g.name} · ${g.year}` })),
  idle: M.IDLE,
  bars: M.GENS.map((g) => BARS.map(([, of]) => of(g))),
  barW: BAR.w,
  // phone camera: the gantry head's screen point at the first and last stop, and the full view
  cam: [at([STOPS[0], ROW_Y, CHIP_TOP]), at([STOPS[STOPS.length - 1], ROW_Y, CHIP_TOP])].map(([x, y]) => [f2(x), f2(y)]),
  view: [W, H],
};

const pad = (n) => String(n).padStart(2, "0");
const PARTS = M.GENS.map((g, i) => `<button type="button" class="ag-part" data-part="${g.id}"><span class="ag-num">${pad(i + 1)}</span>${g.name} <span class="ag-year">${g.year}</span></button>`).join("");
const corners = `<div class="iso-plate-corners" aria-hidden="true"><span class="iso-plate-corner" data-corner="fig">Fig 1</span><span class="iso-plate-corner" data-corner="title">Five generations · to scale</span><span class="iso-plate-corner" data-corner="readout" data-readout>${M.IDLE}</span></div>`;
const controls = `<div class="ag-controls"><span class="ag-hint">Hover a package · Space runs the gantry</span><span class="ag-live" aria-live="polite" data-live></span></div>`;
const stage = `<div class="ag-stage" tabindex="0" role="slider" aria-label="Five NVIDIA GPU packages on a bench, V100 to Rubin. Hover, or use the arrow keys, to pick a generation; Space plays or pauses the inspection gantry; Escape returns it to the start; the slider below steps through the generations." aria-valuemin="0" aria-valuemax="${M.GENS.length}" aria-valuenow="0" aria-valuetext="${M.IDLE}">${svg}</div>`;
const [v, a, h, b, r] = M.GENS;
const caption = `Each package sits in its own nest on a ruled plate (ruler ticks every 2 mm); the silicon is drawn at true size. ${v.name} (${v.year}): one ${v.dieMm2} mm² die and ${v.hbm.stacks} ${v.hbm.gen} stacks. ${a.name} and ${h.name}: one ${a.dieMm2} and ${h.dieMm2} mm² die with six memory sites, ${a.hbm.stacks} of them live; the sixth is drawn as an inactive dummy (NVIDIA says only that five are enabled). ${b.name} and ${r.name}: two reticle-limited dies (drawn at ${M.RETICLE_MM.join(" × ")} mm, since NVIDIA does not publish per-die area) working as one GPU, with ${b.hbm.stacks} stacks each. B200 memory, bandwidth and FLOPS are per-GPU shares of NVIDIA's DGX B200 totals. Die areas are NVIDIA's; die aspect, HBM footprints, substrate outlines and all heights are illustrative. FLOPS are dense, in the lowest-precision format each generation supports (Rubin: ${M.flopsText(r)} ${r.flops.fmt} dense, ${M.flopsText(r, r.sparse)} sparse). The Rubin power figure (≈) is an analyst estimate, not an NVIDIA spec; Rubin's process variant (N3P) is reported, not confirmed.`;
const scrub = `<span class="ag-scrub"><button type="button" class="ag-play" data-play aria-label="Play the inspection run"><span class="ag-play-icon" aria-hidden="true"></span><span data-play-text>Play</span></button><input type="range" class="ag-range" data-scrub min="0" max="1000" step="1" value="0" aria-label="Generations: the gantry visits each package from 2017 to 2026"><span class="ag-step" data-step>ready</span></span>`;
const body = `<figure class="iso-figure ag"><div class="iso-plate">${corners}${stage}${controls}</div><figcaption class="iso-legend">${scrub}<span class="ag-parts">${PARTS}</span><span class="iso-caption">${caption}</span></figcaption></figure>`;

const CSS = readFileSync(join(HERE, `${SLUG}.css`), "utf8");
const LIVE = readFileSync(join(HERE, "live.js"), "utf8").replace("__DATA__", JSON.stringify(DATA));
const out = writeChapter({ slug: SLUG, figure: body, css: CSS, script: LIVE, lesson: LESSON });
console.log("wrote", out.file, `${out.kb} KB`, `${R.items.length} items`, `${R.solids.length} solids`);

A.auditOrExit(R, P);
