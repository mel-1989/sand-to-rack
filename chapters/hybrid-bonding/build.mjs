// A die-to-wafer bonder: tape frame with ejector, flip unit, gantry bond head with up/down cameras, target wafer on an XY chuck.
// World units are about 2 mm; the layout is illustrative. node build.mjs [--audit] [--fast]
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as M from "./model.mjs";
import { k, G, A, Tube, kitScript } from "../../site/kit.mjs";
import { writeChapter } from "../../site/shell.mjs";
import { LESSON } from "./lesson.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const W = 720;
const H = 520;
const AZIMUTH = 56;
const ELEVATION = 30;

// ---- layout ----
const PLATE = { x: -278, y: -142, w: 552, d: 268, r: 12 };
const PLATE_H = 14;
const FOOT_H = 7;
const ROW_Y = 13; // every pick, hand-off, camera and bond point lies on this line

// tape frame station (source wafer, diced, on tape)
const TAPE = [-150, ROW_Y];
const HOLDER = { rIn: 90, rOut: 100, z: 26, top: 32 };
const FRAME = { rIn: 80, rOut: 92, z: 32.3, top: 33.5 };
const TAPE_R = 92;
const TAPE_Z = [32, 32.3];
const SRC_WAFER = { r: 70, z: 32.3, top: 33.3 };
const DIE = 10; // die edge, illustrative
const DIE_T = 1.5;
const PITCH = 12;
const PICK = [-110, ROW_Y];
const LIFT = 3; // ejector needle travel
const EJECT = { r: 9, top: 28, capR: 5.5 };

// flip unit
const FLIP_POST = [-75, -86];
const PIVOT = [-75, ROW_Y, 0]; // z set below
const ARM_L = 35; // pivot to pad centre
const PAD_T = 2;
const DIE_TOP_TAPE = SRC_WAFER.top + DIE_T; // the die over the needle is drawn standing on the wafer
const PIVOT_Z = DIE_TOP_TAPE + LIFT + PAD_T + 3;
PIVOT[2] = PIVOT_Z;
const ARM_H = 3; // half thickness
const ARM_W = 5; // half width (y)

// up camera
const UPCAM = [20, ROW_Y];
const UPCAM_BOX = { x: 11, y: 30, w: 18, d: 14, r: 1.5 };

// chuck station (target wafer)
const CHUCK = [130, ROW_Y];
const CHUCK_R = 80;
const WAFER_R = 75;
const STAGE = { lowerZ: [7, 15], upperZ: [21, 27], chuckZ: [27, 35], topZ: [35, 36], waferZ: [36, 37] };
const SITES = [0, 1, 2, 3].map((i) => CHUCK[0] - 42 + i * PITCH);

// gantry
const COLS = [{ x: -268, y: -128, w: 24, d: 24, r: 2 }, { x: 230, y: -128, w: 24, d: 24, r: 2 }];
const COL_TOP = 150;
const BEAM = { x: -272, y: -130, w: 530, d: 28, r: 2 };
const BEAM_Z = [COL_TOP, COL_TOP + 22];
const RAIL = { x: -236, y: -102, w: 458, d: 3, r: 0.5 };
const RAIL_Z = [COL_TOP + 7, COL_TOP + 15];

// bond head, built at its home over the pick point
const HX0 = PICK[0];
const TRAVEL = 240; // home to the far bond site and beyond
const CAR = (hx) => ({ x: hx - 20, y: -99, w: 40, d: 6, r: 1 });
const CAR_Z = [COL_TOP + 2, COL_TOP + 20];
const YARM = (hx) => ({ x: hx - 9, y: -93, w: 18, d: 101, r: 1.5 });
const YARM_Z = [COL_TOP + 4, COL_TOP + 16];
const HOUSING = (hx) => ({ x: hx - 13, y: -6, w: 26, d: 14, r: 1.5 });
const HOUSING_Z = [104, YARM_Z[0]];
const SLIDE = (hx) => ({ x: hx - 9, y: 8, w: 18, d: 3, r: 0.5 });
const SLIDE_Z = [96, 150];
const COLLET = { holderZ: [88, 96], bodyZ: [80, 88], tipZ: [76.5, 80], r: 5, tipR: 3.6 };
const DIE_COLLET = COLLET.tipZ[0]; // a carried die hangs under the tip
const DOWNCAM = (hx) => [hx + 26, -1];

const MOVES = { stand: [0, 0, 0], head: [TRAVEL, 0, 0], slide: [TRAVEL, 0, 0], lift: [0, 0, LIFT], flip: [0, 0, 0] };

const P = k.fitProjection([...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), ...k.boxCorners(BEAM, BEAM_Z[0], BEAM_Z[1] + 2)], W, H, { pad: 22, azimuth: AZIMUTH, elevation: ELEVATION });
const V = G.viewOf(P);
const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const up = (o) => G.frameOf(o, [0, 0, 1], [1, 0, 0], [0, 1, 0]);
const along = (o, a) => G.frameAlong(o, a);
const sq = (cx, cy, half, r = 0.4) => ({ x: cx - half, y: cy - half, w: half * 2, d: half * 2, r });

const R = A.recorder(P, { order: ["head", "slide", "lift"], spring: {} });
function put(piece, part, ref, svg, shapes, { bias = 0, name, extra = {} } = {}) {
  const id = name ?? R.nameFor(`${part}.item`);
  shapes.forEach((shape) => (shape.name = shape.name ?? id));
  return R.put({ piece, part, at: ref, bias, svg, move: MOVES[piece], shapes: shapes.map(R.solid), name: id, ...extra });
}
function puck(x, y, r, z, h, style = {}, { steps, bevel = 0, inner = "" } = {}) {
  return { svg: S(k.cylinder(x, y, r, z, h, P, steps ?? Math.max(20, Math.round(r * 2.4)), bevel), { tone: "mid", ...style, inner }), shape: A.cylinder(x, y, r, z, h, {}) };
}
function box(plan, z, h, style = {}, { steps = 3, bevel = 0, inner = "" } = {}) {
  return { svg: S(k.slabOf(plan, z, h, P, steps, bevel), { tone: "mid", ...style, inner }), shape: A.slab(plan, z, h, {}, steps) };
}
function disc(F, s0, s1, r, style = {}) {
  return { svg: S(G.disc(s0, s1, r, F, P), { tone: "mid", ...style }), shape: A.disc(F, s0, s1, r, {}) };
}
function ringB(F, s0, s1, rIn, rOut, style = {}) {
  return { svg: S(G.ringBand(s0, s1, rIn, rOut, F, P), { tone: "mid", ...style }), shape: A.ring(F, s0, s1, rIn, rOut, {}) };
}
function tube(piece, part, name, route, r, { tone = "mid", maxLength = 16 } = {}) {
  const id = R.nameFor(name);
  const pts = G.fillet(route, Math.max(3, r * 3), 7, { P, tube: r });
  R.route(id, pts, r, { piece, move: MOVES[piece] });
  Tube.tubePieces(pts, r, P, { maxLength }).forEach((chunk, index) => put(piece, part, chunk.mid, Tube.tubeSvg(chunk, { tone }), [A.tube(chunk.points, chunk.radii, { owner: id, limp: true })], { name: `${id}:${index}`, extra: { route: id, chunk: index } }));
}
const screwDots = (plan, z, inset, size = 0.45) => Dots(k.corners(plan, inset).map(([x, y]) => at([x, y, z])), { size });

// ---- base: plate on feet, groove, screws, ruler, label plate ----
function base() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  const shapes = [];
  for (const [x, y] of byDepth(k.corners(PLATE, 26))) {
    out.push(S(k.cylinder(x, y, 8, -PLATE_H - FOOT_H, 1.8, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 6, -PLATE_H - FOOT_H + 1.8, FOOT_H - 1.8, P, 28), { tone: "mid" }));
    shapes.push(A.cylinder(x, y, 8, -PLATE_H - FOOT_H, FOOT_H, { name: "stand.foot" }));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid", inner: L(k.sideSeam(PLATE, -PLATE_H + 4, P, 8), { tone: "faint" }) }));
  shapes.push(A.slab(PLATE, -PLATE_H, PLATE_H, { name: "stand.plate" }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 6), 0, P, 8), { tone: "lo" }));
  const screws = k.corners(PLATE, 12);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.4, 0, P, 16)).join(""), { tone: "lo" }), Dots(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // ruler along the front edge, 2 mm a unit: minor ticks every 10 mm, major every 50 mm
  const strip = { x: -30, y: PLATE.y + PLATE.d - 17, w: 230, d: 8, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 5, 5, strip.y + 0.8, 0.6, [2.2, 4], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(Dots([at([strip.x + 2, strip.y + 4, 0.6]), at([strip.x + strip.w - 2, strip.y + 4, 0.6])], { size: 0.45 }));
  // label plate
  const label = { x: 212, y: PLATE.y + PLATE.d - 28, w: 50, d: 18, r: 1.5 };
  out.push(S(k.slabOf(label, 0, 0.8, P, 4), { tone: "lo", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.8), 0.8, P, 4), { tone: "faint" }));
  out.push(L([0, 1, 2].map((i) => k.lineOnTop([label.x + 7, label.y + 5 + i * 3.5], [label.x + 38 - i * 9, label.y + 5 + i * 3.5], 0.8, P)).join(""), { tone: "lo", free: true }));
  out.push(Dots([at([label.x + 3.5, label.y + label.d / 2, 0.8]), at([label.x + label.w - 3.5, label.y + label.d / 2, 0.8])], { size: 0.45 }));
  put("stand", "stand", [0, 0, -1], out.join(""), shapes, { name: "stand.base", bias: -900 });
  // cable trough along the back edge, between the columns
  const trough = { x: -236, y: PLATE.y + 3, w: 460, d: 9, r: 1.2 };
  const tr = box(trough, 0, 6, {}, { bevel: 0.4, inner: L(k.sideSeam(trough, 4.6, P, 3), { tone: "faint" }) });
  const clips = [];
  for (let x = trough.x + 20; x < trough.x + trough.w - 10; x += 40) clips.push(at([x, trough.y + trough.d / 2, 6]));
  put("stand", "stand", [0, trough.y + 4, 3], tr.svg + Dots(clips, { size: 0.45 }), [tr.shape], { name: "stand.trough" });
  // operator box with an emergency stop at the front left corner
  const ob = { x: -262, y: 82, w: 30, d: 24, r: 2 };
  const o = box(ob, 0, 12, {}, { bevel: 0.5, inner: L(k.sideSeam(ob, 9, P, 3), { tone: "faint" }) });
  const ex = ob.x + 11;
  const ey = ob.y + 12;
  const ring = puck(ex, ey, 6, 12, 1.2, {}, {});
  const neck = puck(ex, ey, 3, 13.2, 2.4, {}, {});
  const head = puck(ex, ey, 5.2, 15.6, 3.2, { tone: "hi" }, { bevel: 0.4 });
  const keyS = puck(ob.x + 24, ob.y + 6, 2, 12, 1.6, {}, {});
  put("stand", "stand", [ob.x + 15, ob.y + 12, 6], o.svg + screwDots(ob, 12, 2.4, 0.4) + ring.svg + neck.svg + head.svg + keyS.svg + L(k.lineOnTop([ob.x + 22.1, ob.y + 6], [ob.x + 25.9, ob.y + 6], 13.6, P), { tone: "lo" }), [o.shape, ring.shape, neck.shape, head.shape, keyS.shape], { name: "stand.estop" });
}

// ---- gantry: two columns, beam, linear rail with end stops ----
function gantry() {
  COLS.forEach((col, i) => {
    const foot = k.insetPlan(col, -5);
    const f = box(foot, 0, 4, {}, { bevel: 0.5 });
    const c = box(col, 4, COL_TOP - 4, {}, { inner: L([40, 120].map((z) => k.sideSeam(col, z, P, 3)).join(""), { tone: "faint" }) });
    const bolts = screwDots(foot, 4, 2.4, 0.5);
    put("stand", "stand", [col.x + col.w / 2, col.y + col.d / 2, 80], f.svg + bolts + c.svg, [f.shape, c.shape], { name: `stand.column${i}` });
  });
  const b = box(BEAM, BEAM_Z[0], BEAM_Z[1] - BEAM_Z[0], {}, { bevel: 0.8, inner: L(k.sideSeam(BEAM, BEAM_Z[0] + 6, P, 3), { tone: "faint" }) });
  const caps = [];
  for (let x = BEAM.x + 30; x < BEAM.x + BEAM.w - 20; x += 50) caps.push(at([x, BEAM.y + 5, BEAM_Z[1]]));
  const groove = L(k.planOutline(k.insetPlan(BEAM, 4), BEAM_Z[1], P, 3), { tone: "faint" });
  // cable tray on top of the beam
  const tray = { x: BEAM.x + 40, y: BEAM.y + 10, w: 380, d: 8, r: 1 };
  const t = box(tray, BEAM_Z[1], 3, {}, {});
  // linear encoder scale along the beam's top, read by the carriage: ticks every 10 mm, majors every 50 mm
  const enc = { x: BEAM.x + 44, y: BEAM.y + 20, w: 372, d: 5, r: 0.6 };
  const e = box(enc, BEAM_Z[1], 0.6, { tone: "lo", crease: "none" }, {});
  const et = k.topTicks(enc.x + 3, enc.x + enc.w - 3, 5, 5, enc.y + 0.6, BEAM_Z[1] + 0.6, [1.6, 3], P);
  const limits = [enc.x - 9, enc.x + enc.w + 2].map((x) => box({ x, y: enc.y - 1, w: 7, d: 7, r: 0.8 }, BEAM_Z[1], 4, {}, { bevel: 0.3 }));
  put("stand", "stand", [0, BEAM.y + BEAM.d / 2, BEAM_Z[0]], b.svg + groove + Dots(caps, { size: 0.5 }) + t.svg + e.svg + L(et.minor, { tone: "lo" }) + L(et.major, { tone: "mid" }) + limits.map((l) => l.svg).join(""), [b.shape, t.shape, e.shape, ...limits.map((l) => l.shape)], { name: "stand.beam" });
  // rail on the beam's front face, with an end stop at each end
  const railPlan = RAIL;
  const r = box(railPlan, RAIL_Z[0], RAIL_Z[1] - RAIL_Z[0], {}, {});
  const rDots = [];
  for (let x = RAIL.x + 10; x < RAIL.x + RAIL.w - 5; x += 24) rDots.push(at([x, RAIL.y + RAIL.d, (RAIL_Z[0] + RAIL_Z[1]) / 2]));
  put("stand", "stand", [0, RAIL.y, RAIL_Z[0] - 1], r.svg + Dots(rDots, { size: 0.35, tone: "lo" }), [r.shape], { name: "stand.rail" });
  // signal tower on the beam's right end
  {
    const tx = BEAM.x + BEAM.w - 14;
    const ty = BEAM.y + 14;
    let z = BEAM_Z[1];
    const parts = [];
    const shapes = [];
    const add = (r, h, tone) => {
      const p = puck(tx, ty, r, z, h, { tone }, {});
      parts.push(p.svg);
      shapes.push(p.shape);
      z += h;
    };
    add(6, 2, "mid");
    add(2.2, 6, "mid");
    add(4.2, 1, "mid");
    for (const tone of ["lo", "mid", "hi"]) {
      add(4, 5, tone);
      add(4.2, 0.8, "mid");
    }
    add(3, 1.6, "mid");
    put("stand", "stand", [tx, ty, BEAM_Z[1] + 10], parts.join(""), shapes, { name: "stand.tower" });
  }
  for (const x of [RAIL.x - 8, RAIL.x + RAIL.w]) {
    const stop = box({ x, y: -102, w: 8, d: 7, r: 1 }, RAIL_Z[0] - 3, 14, {}, { bevel: 0.4 });
    put("stand", "stand", [x + 4, -98, RAIL_Z[0]], stop.svg + Dots([at([x + 4, -95, RAIL_Z[0] + 11])], { size: 0.45 }), [stop.shape], { name: R.nameFor("stand.stop") });
  }
}

// ---- tape frame station: holder on posts, frame, tape, diced wafer, ejector ----
const pickDie = sq(PICK[0], PICK[1], DIE / 2);
function tapeStation() {
  const [cx, cy] = TAPE;
  // ejector column under the pick point (seen in the gap under the holder)
  const ej = puck(PICK[0], PICK[1], EJECT.r + 3, 0, 3, { tone: "mid" }, { bevel: 0.4 });
  const ejb = puck(PICK[0], PICK[1], EJECT.r, 3, EJECT.top - 3, { tone: "mid" }, { inner: L([10, 18].map((z) => k.sideArc(PICK[0], PICK[1], EJECT.r, z, P, 24)).join(""), { tone: "faint" }) });
  const cap = puck(PICK[0], PICK[1], EJECT.capR, EJECT.top, TAPE_Z[0] - EJECT.top, { tone: "hi" });
  const ejDots = Dots(G.dotsOf(up([PICK[0], PICK[1], 0]), 3, EJECT.r + 1.5, 6, P, { all: true }), { size: 0.45 });
  put("stand", "tape", [PICK[0], PICK[1], 12], ej.svg + ejDots + ejb.svg + cap.svg, [ej.shape, ejb.shape, cap.shape], { name: "tape.ejector" });
  // four posts carry the holder ring
  const postAt = [45, 135, 225, 315].map((deg) => [cx + 95 * Math.cos((deg * Math.PI) / 180), cy + 95 * Math.sin((deg * Math.PI) / 180)]);
  for (const [x, y] of postAt) {
    const fl = puck(x, y, 7, 0, 2.5, {}, { bevel: 0.3 });
    const post = puck(x, y, 4, 2.5, HOLDER.z - 2.5, {}, { inner: L(k.sideArc(x, y, 4, 14, P, 16), { tone: "faint" }) });
    put("stand", "tape", [x, y, 12], fl.svg + post.svg + Dots([at([x, y, 2.5])], { size: 0.4 }), [fl.shape, post.shape], { name: R.nameFor("tape.post") });
  }
  const F = up([cx, cy, 0]);
  const holder = ringB(F, HOLDER.z, HOLDER.top, HOLDER.rIn, HOLDER.rOut);
  const holderDots = Dots(G.dotsOf(F, HOLDER.top, (HOLDER.rIn + HOLDER.rOut) / 2, 24, P, { all: true }), { size: 0.4 });
  put("stand", "tape", [cx, cy, HOLDER.z], holder.svg + holderDots, [holder.shape], { name: "tape.holder" });
  // tape (a thin film under the frame), frame ring, wafer with saw streets
  const tape = disc(F, TAPE_Z[0], TAPE_Z[1], TAPE_R, { tone: "lo", crease: "none" });
  const frame = ringB(F, FRAME.z, FRAME.top, FRAME.rIn, FRAME.rOut, { tone: "mid" });
  const notches = [0, 90, 180, 270].map((deg) => {
    const a = (deg * Math.PI) / 180;
    return k.ring(cx + (FRAME.rIn + 6) * Math.cos(a), cy + (FRAME.rIn + 6) * Math.sin(a), 1.4, FRAME.top, P, 12);
  });
  const wafer = disc(F, SRC_WAFER.z, SRC_WAFER.top, SRC_WAFER.r, { tone: "hi", crease: "lo" });
  const streets = [];
  const rr = SRC_WAFER.r - 0.2;
  for (let i = -6; i <= 6; i++) {
    const off = PICK[0] - cx + (i + 0.5) * PITCH;
    if (Math.abs(off) >= rr) continue;
    const half = Math.sqrt(rr * rr - off * off);
    streets.push(k.lineOnTop([cx + off, cy - half], [cx + off, cy + half], SRC_WAFER.top, P));
  }
  for (let j = -6; j <= 6; j++) {
    const off = PICK[1] - cy + (j + 0.5) * PITCH;
    if (Math.abs(off) >= rr) continue;
    const half = Math.sqrt(rr * rr - off * off);
    streets.push(k.lineOnTop([cx - half, cy + off], [cx + half, cy + off], SRC_WAFER.top, P));
  }
  const flat = k.lineOnTop([cx - 18, cy + SRC_WAFER.r - 2.3], [cx + 18, cy + SRC_WAFER.r - 2.3], SRC_WAFER.top, P);
  put("stand", "tape", [cx, cy, TAPE_Z[0]], tape.svg, [tape.shape], { name: "tape.film" });
  put("stand", "tape", [cx, cy, FRAME.z], frame.svg + L(notches.join(""), { tone: "lo" }), [frame.shape], { name: "tape.frame" });
  put("stand", "tape", [cx, cy, SRC_WAFER.z], wafer.svg + L(streets.join(""), { tone: "lo" }), [wafer.shape], { name: "tape.wafer" });
  void flat;
  // the die over the ejector: lifted by the needle, then taken
  const d = box(pickDie, SRC_WAFER.top, DIE_T, { tone: "hi", crease: "lo" }, { steps: 2, bevel: 0.3 });
  put("lift", "tape", [PICK[0], PICK[1], SRC_WAFER.top + 0.5], `<g data-die="tape">${d.svg}</g>`, [d.shape], { name: "tape.die" });
}

// ---- flip unit: post, bracket, rotary actuator, arm with vacuum pad ----
function flipParts(theta) {
  const t = (theta * Math.PI) / 180;
  const d = [-Math.cos(t), 0, Math.sin(t)];
  const n = [Math.sin(t), 0, Math.cos(t)];
  const F = G.frameOf(PIVOT, d, [0, 1, 0], n);
  const rect = (u0, u1, v0, v1) => [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
  return [
    { id: "arm", F, poly: rect(-ARM_W, ARM_W, -ARM_H, ARM_H), s: [-6, ARM_L + 5], tone: "mid" },
    { id: "pad", F, poly: rect(-DIE / 2 + 0.6, DIE / 2 - 0.6, -ARM_H - PAD_T, -ARM_H), s: [ARM_L - DIE / 2 + 0.6, ARM_L + DIE / 2 - 0.6], tone: "mid" },
    { id: "die", F, poly: rect(-DIE / 2, DIE / 2, -ARM_H - PAD_T - DIE_T, -ARM_H - PAD_T), s: [ARM_L - DIE / 2, ARM_L + DIE / 2], tone: "hi" },
  ].map((part) => ({ ...part, centre: G.pointOf(part.F, (part.s[0] + part.s[1]) / 2, 0, 0) }));
}
function flipUnit() {
  const [px, py] = FLIP_POST;
  const fl = puck(px, py, 10, 0, 3, {}, { bevel: 0.4 });
  const post = puck(px, py, 6, 3, 57, {}, { inner: L([20, 40].map((z) => k.sideArc(px, py, 6, z, P, 20)).join(""), { tone: "faint" }) });
  const bolts = Dots(G.dotsOf(up([px, py, 0]), 3, 8, 6, P, { all: true }), { size: 0.45 });
  put("stand", "flip", [px, py, 30], fl.svg + bolts + post.svg, [fl.shape, post.shape], { name: "flip.post" });
  const armPlan = { x: px - 7, y: py - 6, w: 14, d: 62, r: 1.5 };
  const arm = box(armPlan, 60, 8, {}, { bevel: 0.4 });
  put("stand", "flip", [px, py + 30, 64], arm.svg + Dots([at([px, py, 68]), at([px, py + 50, 68])], { size: 0.45 }), [arm.shape], { name: "flip.bracket" });
  const hanger = { x: px - 7, y: -30, w: 14, d: 6, r: 0.8 };
  const h = box(hanger, PIVOT_Z - 7, 60 - (PIVOT_Z - 7), {}, {});
  put("stand", "flip", [px, -27, PIVOT_Z + 4], h.svg, [h.shape], { name: "flip.hanger" });
  // rotary actuator: a can along +y from the hanger, a shaft, then the arm hub
  const FY = G.frameOf([px, -24, PIVOT_Z], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
  const can = disc(FY, 0, 26, 7, { tone: "mid" });
  const ribs = G.ribsOf(FY, 4, 22, 7, 24, P, { fade: [0.1, 0.55], seams: true });
  const capRing = disc(FY, 26, 28, 5.6, { tone: "mid" });
  const shaft = disc(FY, 28, 32, 3, { tone: "mid" });
  put("stand", "flip", [px, -11, PIVOT_Z], can.svg + k.fadedSvg(ribs, { tone: "faint" }) + capRing.svg + shaft.svg, [can.shape, capRing.shape, shaft.shape], { name: "flip.actuator" });
  // the arm itself is redrawn live as it turns; built here at 180°, parked flipped
  const parts = flipParts(180);
  const svg = parts
    .sort((a, b) => G.dot3(a.centre, V) - G.dot3(b.centre, V))
    .filter((p) => p.id !== "die")
    .map((p) => S(G.prismOf(p.F, p.poly, p.s[0], p.s[1], P), { tone: p.tone }))
    .join("");
  const poses = [180, 0].map((theta) => flipParts(theta).find((p) => p.id === "arm"));
  put("flip", "flip", PIVOT, `<g data-flip>${svg}</g>`, poses.map((arm) => A.prism(arm.F, arm.poly, arm.s[0], arm.s[1], { owner: "flip.arm" })), { name: "flip.arm" });
  // vacuum line from the hanger's side down to a valve block on the plate
  const vb = { x: -58, y: -34, w: 14, d: 14, r: 1.2 };
  const blk = box(vb, 0, 9, {}, { bevel: 0.4 });
  const FX = G.frameOf([px + 7, -27, PIVOT_Z + 6], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
  const fit = disc(FX, 0, 3, 2.4, {});
  const FZ = up([vb.x + 7, vb.y + 7, 9]);
  const fit2 = disc(FZ, 0, 3, 2.4, {});
  put("stand", "flip", [vb.x + 7, vb.y + 7, 5], blk.svg + Dots([at([vb.x + 2.5, vb.y + 2.5, 9]), at([vb.x + vb.w - 2.5, vb.y + vb.d - 2.5, 9])], { size: 0.45 }) + fit2.svg, [blk.shape, fit2.shape], { name: "flip.valve" });
  put("stand", "flip", [px + 8.5, -27, PIVOT_Z + 6], fit.svg, [fit.shape], { name: "flip.fitting" });
  tube("stand", "flip", "flip.vac", [[px + 10, -27, PIVOT_Z + 6], [vb.x + 7, -27, PIVOT_Z + 6], [vb.x + 7, vb.y + 7, PIVOT_Z + 6], [vb.x + 7, vb.y + 7, 12]], 1.1);
}

// ---- up-looking camera with ring light ----
function upCamera() {
  const [x, y] = UPCAM;
  const foot = box(sq(x, y, 10, 1.2), 0, 4, {}, { bevel: 0.4 });
  const body = puck(x, y, 7, 4, 20, {}, { inner: L(k.sideArc(x, y, 7, 14, P, 24), { tone: "faint" }) });
  const lens = puck(x, y, 5, 24, 3, { tone: "mid" });
  const ringL = disc(up([x, y, 0]), 27, 30, 9.5, { tone: "hi", crease: "lo" });
  const glass = L(k.ring(x, y, 3.4, 30, P, 24) + k.ring(x, y, 6.2, 30, P, 32), { tone: "lo" });
  put("stand", "cams", [x, y, 14], foot.svg + screwDots(sq(x, y, 10), 4, 2.2) + body.svg + lens.svg, [foot.shape, body.shape, lens.shape], { name: "cams.up" });
  put("stand", "cams", [x, y, 29], `<g data-glow="up">${ringL.svg}</g>` + glass, [ringL.shape], { name: "cams.ring" });
  const Fy = G.frameOf([x, y + 7, 15], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
  const conn = disc(Fy, -0.3, 3, 2.4, {});
  put("stand", "cams", [x, y + 8.5, 15], conn.svg, [conn.shape], { name: "cams.conn" });
  const jb = box(UPCAM_BOX, 0, 10, {}, { bevel: 0.4, inner: L(k.sideSeam(UPCAM_BOX, 7.5, P, 3), { tone: "faint" }) });
  const FZ = up([x, UPCAM_BOX.y + 7, 10]);
  const gland = disc(FZ, 0, 2.6, 2.4, {});
  put("stand", "cams", [x, UPCAM_BOX.y + 7, 5], jb.svg + screwDots(UPCAM_BOX, 10, 2.4, 0.4) + gland.svg, [jb.shape, gland.shape], { name: "cams.box" });
  tube("stand", "cams", "cams.cable", [[x, y + 10, 15], [x, UPCAM_BOX.y + 7, 15], [x, UPCAM_BOX.y + 7, 12.6]], 1);
}

// ---- XY stage, chuck and the target wafer ----
function chuckStation() {
  const [cx, cy] = CHUCK;
  // lower rails along x, lower carriage, upper rails along y, upper carriage
  for (const ry of [cy - 58, cy + 50]) {
    const rail = box({ x: cx - 92, y: ry, w: 184, d: 8, r: 1 }, 0, STAGE.lowerZ[0], {}, {});
    const dots = [];
    for (let x = cx - 84; x < cx + 90; x += 20) dots.push(at([x, ry + 4, STAGE.lowerZ[0]]));
    put("stand", "chuck", [cx, ry + 4, 3], rail.svg + Dots(dots, { size: 0.4 }), [rail.shape], { name: R.nameFor("chuck.rail") });
  }
  const lower = { x: cx - 82, y: cy - 62, w: 164, d: 124, r: 3 };
  const lo = box(lower, STAGE.lowerZ[0], STAGE.lowerZ[1] - STAGE.lowerZ[0], {}, { bevel: 0.6, inner: L(k.sideSeam(lower, STAGE.lowerZ[0] + 3, P, 3), { tone: "faint" }) });
  put("stand", "chuck", [cx, cy, STAGE.lowerZ[0]], lo.svg + screwDots(lower, STAGE.lowerZ[1], 6), [lo.shape], { name: "chuck.lower" });
  for (const rx of [cx - 70, cx + 62]) {
    const rail = box({ x: rx, y: cy - 60, w: 8, d: 120, r: 1 }, STAGE.lowerZ[1], STAGE.upperZ[0] - STAGE.lowerZ[1], {}, {});
    put("stand", "chuck", [rx + 4, cy, STAGE.lowerZ[1] + 2], rail.svg, [rail.shape], { name: R.nameFor("chuck.yrail") });
  }
  const upper = { x: cx - 78, y: cy - 66, w: 156, d: 132, r: 3 };
  const upS = box(upper, STAGE.upperZ[0], STAGE.upperZ[1] - STAGE.upperZ[0], {}, { bevel: 0.6 });
  put("stand", "chuck", [cx, cy, STAGE.upperZ[0]], upS.svg + screwDots(upper, STAGE.upperZ[1], 5), [upS.shape], { name: "chuck.upper" });
  // linear motor covers on the near side of each stage
  const motorX = { x: cx - 60, y: cy + 62, w: 120, d: 8, r: 1 };
  const mx = box(motorX, STAGE.lowerZ[0] + 1, 6, {}, { inner: L(k.sideSeam(motorX, STAGE.lowerZ[0] + 4, P, 3), { tone: "faint" }) });
  put("stand", "chuck", [cx, cy + 66, STAGE.lowerZ[0] + 4], mx.svg, [mx.shape], { name: "chuck.motor" });
  const F = up([cx, cy, 0]);
  const body = disc(F, STAGE.chuckZ[0], STAGE.chuckZ[1], CHUCK_R, { tone: "mid", inner: L(G.arcOf(F, STAGE.chuckZ[0] + 4, CHUCK_R, P), { tone: "faint" }) });
  const top = disc(F, STAGE.topZ[0], STAGE.topZ[1], CHUCK_R - 2, { tone: "mid" });
  const grooves = L([30, 52, CHUCK_R - 6].map((r) => k.ring(cx, cy, r, STAGE.topZ[1], P, 72)).join(""), { tone: "faint" });
  put("stand", "chuck", [cx, cy, STAGE.chuckZ[0]], body.svg + top.svg + grooves, [body.shape, top.shape], { name: "chuck.body" });
  const wafer = disc(F, STAGE.waferZ[0], STAGE.waferZ[1], WAFER_R, { tone: "hi", crease: "lo" });
  const notch = k.ring(cx, cy + WAFER_R - 2.6, 1.2, STAGE.waferZ[1], P, 12);
  // the target wafer carries its own dies: saw streets on the same pitch as the bond sites
  const streets = [];
  const wr = WAFER_R - 0.2;
  for (let i = -8; i <= 8; i++) {
    const off = SITES[0] - cx + (i + 0.5) * PITCH;
    if (Math.abs(off) >= wr) continue;
    const half = Math.sqrt(wr * wr - off * off);
    streets.push(k.lineOnTop([cx + off, cy - half], [cx + off, cy + half], STAGE.waferZ[1], P));
  }
  for (let j = -8; j <= 8; j++) {
    const off = ROW_Y - cy + (j + 0.5) * PITCH;
    if (Math.abs(off) >= wr) continue;
    const half = Math.sqrt(wr * wr - off * off);
    streets.push(k.lineOnTop([cx - half, cy + off], [cx + half, cy + off], STAGE.waferZ[1], P));
  }
  put("stand", "chuck", [cx, cy, STAGE.waferZ[0]], wafer.svg + L(streets.join(""), { tone: "faint" }) + L(notch, { tone: "lo" }), [wafer.shape], { name: "chuck.wafer" });
  // dies already bonded: rows behind the current one, and the current row up to the first site
  const placed = [];
  const rr = WAFER_R - 3;
  for (let j = -6; j <= 0; j++) {
    for (let i = -6; i <= 6; i++) {
      const x = SITES[0] + i * PITCH;
      const y = ROW_Y + j * PITCH;
      if (j === 0 && i >= 0) continue;
      const far = Math.hypot(Math.abs(x - cx) + DIE / 2, Math.abs(y - cy) + DIE / 2);
      if (far > rr) continue;
      placed.push([x, y]);
    }
  }
  const dieSvg = byDepth(placed)
    .map(([x, y]) => S(k.slabOf(sq(x, y, DIE / 2), STAGE.waferZ[1], DIE_T, P, 2, 0.3), { tone: "hi", crease: "lo" }))
    .join("");
  put("stand", "chuck", [cx, cy - 30, STAGE.waferZ[1]], dieSvg, placed.map(([x, y]) => A.slab(sq(x, y, DIE / 2), STAGE.waferZ[1], DIE_T, {}, 2)), { name: "chuck.bonded" });
  SITES.forEach((x, i) => {
    const d = box(sq(x, ROW_Y, DIE / 2), STAGE.waferZ[1], DIE_T, { tone: "hi", crease: "lo" }, { steps: 2, bevel: 0.3 });
    put("stand", "chuck", [x, ROW_Y, STAGE.waferZ[1]], `<g data-site="${i}">${d.svg}</g>`, [d.shape], { name: `chuck.site${i}` });
  });
}

// ---- bond head: carriage on the rail, Y arm, Z housing, slide, heated collet, down camera ----
function bondHead() {
  const hx = HX0;
  const car = CAR(hx);
  const c = box(car, CAR_Z[0], CAR_Z[1] - CAR_Z[0], {}, { bevel: 0.4 });
  const cDots = [];
  for (const dx of [-15, 15]) for (const z of [CAR_Z[0] + 3, CAR_Z[1] - 3]) cDots.push(at([hx + dx, car.y + car.d, z]));
  put("head", "head", [hx, car.y, CAR_Z[0]], c.svg + Dots(cDots, { size: 0.45 }), [c.shape], { name: "head.carriage" });
  const ya = YARM(hx);
  const y = box(ya, YARM_Z[0], YARM_Z[1] - YARM_Z[0], {}, { bevel: 0.6, inner: L(k.sideSeam(ya, YARM_Z[0] + 4, P, 3), { tone: "faint" }) });
  const yRail = L(k.planOutline({ x: hx - 4, y: ya.y + 6, w: 8, d: ya.d - 12, r: 0.6 }, YARM_Z[1], P, 2), { tone: "lo" });
  put("head", "head", [hx, -40, YARM_Z[0]], y.svg + yRail + Dots([at([hx, ya.y + 3, YARM_Z[1]]), at([hx, ya.y + ya.d - 3, YARM_Z[1]])], { size: 0.45 }), [y.shape], { name: "head.yarm" });
  const ho = HOUSING(hx);
  const h = box(ho, HOUSING_Z[0], HOUSING_Z[1] - HOUSING_Z[0], {}, { bevel: 0.5, inner: L([HOUSING_Z[0] + 6, HOUSING_Z[1] - 8].map((z) => k.sideSeam(ho, z, P, 3)).join(""), { tone: "faint" }) });
  // a vent grille on the +x face: closed slots
  const slots = [];
  for (let i = 0; i < 5; i++) {
    const z0 = HOUSING_Z[0] + 14 + i * 5;
    slots.push(k.segment([ho.x + ho.w, ho.y + 3, z0], [ho.x + ho.w, ho.y + ho.d - 3, z0], P) + k.segment([ho.x + ho.w, ho.y + ho.d - 3, z0], [ho.x + ho.w, ho.y + ho.d - 3, z0 + 1.6], P) + k.segment([ho.x + ho.w, ho.y + ho.d - 3, z0 + 1.6], [ho.x + ho.w, ho.y + 3, z0 + 1.6], P) + k.segment([ho.x + ho.w, ho.y + 3, z0 + 1.6], [ho.x + ho.w, ho.y + 3, z0], P));
  }
  put("head", "head", [hx, 1, HOUSING_Z[0]], h.svg + L(slots.join(""), { tone: "lo" }), [h.shape], { name: "head.housing" });
  // down-looking camera on a bracket off the housing's +x face
  const [dcx, dcy] = DOWNCAM(hx);
  const br = box({ x: ho.x + ho.w, y: dcy - 4, w: dcx - 5 - (ho.x + ho.w), d: 8, r: 0.5 }, 140, 8, {}, {});
  const cam = puck(dcx, dcy, 5, 124, 26, {}, { inner: L(k.sideArc(dcx, dcy, 5, 136, P, 20), { tone: "faint" }) });
  const lens = puck(dcx, dcy, 3.4, 116, 8, {});
  const capTop = puck(dcx, dcy, 3, 150, 3, {});
  put("head", "cams", [dcx, dcy, 132], br.svg + cam.svg + lens.svg + capTop.svg, [br.shape, cam.shape, lens.shape, capTop.shape], { name: "cams.down" });
  put("head", "cams", [dcx, dcy, 115], `<g data-glow="down">${S(k.cylinder(dcx, dcy, 2.4, 115.4, 0.6, P, 20), { tone: "lo", crease: "none" })}</g>`, [A.cylinder(dcx, dcy, 2.4, 115.4, 0.6, {})], { name: "cams.downlens" });
  // the Z slide and everything under it
  const sl = SLIDE(hx);
  const s = box(sl, SLIDE_Z[0], SLIDE_Z[1] - SLIDE_Z[0], {}, { bevel: 0.4 });
  const sDots = [];
  for (const z of [SLIDE_Z[0] + 4, SLIDE_Z[1] - 4]) for (const dx of [-5, 5]) sDots.push(at([hx + dx, sl.y + sl.d, z]));
  put("slide", "head", [hx, sl.y, 130], s.svg + Dots(sDots, { size: 0.45 }), [s.shape], { name: "head.slide" });
  const holder = { x: hx - 7, y: 6, w: 14, d: 14, r: 1 };
  const ho2 = box(holder, COLLET.holderZ[0], COLLET.holderZ[1] - COLLET.holderZ[0], {}, { bevel: 0.4 });
  const body = puck(hx, ROW_Y, COLLET.r, COLLET.bodyZ[0], COLLET.bodyZ[1] - COLLET.bodyZ[0], {}, {});
  put("slide", "head", [hx, ROW_Y, 90], ho2.svg + screwDots(holder, COLLET.holderZ[1], 2.2, 0.4), [ho2.shape], { name: "head.holder" });
  const tip = puck(hx, ROW_Y, COLLET.tipR, COLLET.tipZ[0], COLLET.tipZ[1] - COLLET.tipZ[0], { tone: "hi" }, {});
  put("slide", "head", [hx, ROW_Y, 82], `<g data-collet>${tip.svg}${body.svg}</g>`, [tip.shape, body.shape], { name: "head.collet" });
  const carry = box(sq(hx, ROW_Y, DIE / 2), DIE_COLLET - DIE_T, DIE_T, { tone: "hi", crease: "lo" }, { steps: 2, bevel: 0.3 });
  put("slide", "head", [hx, ROW_Y, DIE_COLLET - 1], `<g data-die="collet">${carry.svg}</g>`, [carry.shape], { name: "head.die" });
  // the down camera's cable climbs to a long connector on the Y arm's side; it rides the carriage with both ends
  const FX = G.frameOf([hx + 9, -1, 161], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
  const conn = disc(FX, 0, 4, 2.4, {});
  const nut = disc(FX, 4, 7, 1.7, {});
  put("head", "cams", [hx + 12.5, -1, 161], conn.svg + nut.svg, [conn.shape, nut.shape], { name: "cams.conn2" });
  tube("head", "cams", "cams.cable2", [[dcx, dcy, 153], [dcx, dcy, 161], [hx + 16, dcy, 161]], 0.9);
}

base();
gantry();
tapeStation();
flipUnit();
upCamera();
chuckStation();
bondHead();

// the poses the head takes: anywhere along its travel, the needle up or down
const STATES = [];
for (let i = 0; i <= 24; i++) STATES.push({ label: `travel ${i / 24}`, shares: { head: i / 24, slide: i / 24, lift: 0 } });
STATES.push({ label: "lift", shares: { head: 0.3, slide: 0.3, lift: 1 } });

if (!process.argv.includes("--fast")) A.settle(R, P, { states: STATES });
R.items.sort((a, b) => a.key - b.key);
const groups = R.items.map((item, index) => {
  const [mx, my, mz] = item.move;
  return `<g class="hb-it" data-piece="${item.piece}" data-part="${item.part}" data-k="${item.key.toFixed(2)}" data-m="${mx},${my},${mz}" data-i="${index}" data-name="${item.name}">${item.svg}</g>`;
});

const LABEL = "A die-to-wafer bonder. On the left a diced wafer sits on tape in a frame, with an ejector needle under the pick point; a flip unit's arm takes each die face up and turns it face down. A bond head on a gantry picks it, passes over an up-looking camera, and a down-looking camera on the head finds the target wafer's marks; the head then presses the die onto a wafer held on an XY chuck on the right.";
const svg = k.figureSvg({ width: W, height: H, label: LABEL, body: [`<g class="hb-layers">${groups.join("")}</g>`], className: "hb-svg" });

const vec = (v) => {
  const o = at([0, 0, 0]);
  const p = at(v);
  return [p[0] - o[0], p[1] - o[1]];
};
const PARTS_ORDER = ["tape", "flip", "head", "cams", "chuck"];
const DATA = {
  P,
  V,
  EX: vec([1, 0, 0]),
  EZ: vec([0, 0, 1]),
  HX0,
  TRAVEL,
  PICK,
  HANDOFF: PICK[0] + 2 * ARM_L,
  UPCAM,
  SITES,
  LIFT,
  PIVOT,
  ARM_L,
  ARM_H,
  ARM_W,
  PAD_T,
  DIE,
  DIE_T,
  STROKE: {
    tape: DIE_COLLET - (DIE_TOP_TAPE + LIFT),
    flip: DIE_COLLET - (PIVOT_Z + ARM_H + PAD_T + DIE_T),
    bond: DIE_COLLET - (STAGE.waferZ[1] + DIE_T),
  },
  eras: M.ERAS.map((e) => ({ id: e.id, name: e.name, short: e.short, pitch: e.pitch, pitchText: M.pitchText(e), since: e.since, faceUp: e.faceUp, area: e.area, collet: e.collet, per: Math.round(M.perMm2(e.pitch)) })),
  phases: M.PHASES,
  pieces: M.PIECES,
  order: PARTS_ORDER,
  idle: M.IDLE,
};

const legend = PARTS_ORDER.map((id, index) => `<button type="button" class="hb-part" data-part="${id}"><span class="hb-num">${String(index + 1).padStart(2, "0")}</span>${M.PIECES[id].name}</button>`).join("");
const corners = `<div class="iso-plate-corners" aria-hidden="true"><span class="iso-plate-corner" data-corner="fig">Fig 1</span><span class="iso-plate-corner" data-corner="title">Die-to-wafer bonder</span><span class="iso-plate-corner" data-corner="readout" data-readout>${M.IDLE}</span></div>`;
const controls = `<div class="hb-controls"><span class="hb-hint">Hover a part · Space plays</span><span class="hb-live" aria-live="polite" data-live></span></div>`;
const stage = `<div class="hb-stage" tabindex="0" role="group" aria-label="Die-to-wafer bonder. Hover, or use the arrow keys, to pick a part; Space plays or pauses; Escape resets; the slider below runs one bond cycle for each of four generations of chip joint, from wire bond to hybrid bond.">${svg}</div>`;

// ---- Fig 1b: the four joints in section, all at one scale (µm) ----
function joints() {
  const Wp = 260;
  const Hp = 170;
  const rect = (x, y, w, h, cls) => `<rect class="${cls}" x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}"/>`;
  const out = {};
  // wire bond: die face up on epoxy, ball bond on an edge pad, loop to a substrate finger
  {
    const e = M.ERAS[0];
    let s = rect(0, 146, Wp, 24, "hb-sub") + rect(0, 138, 150, 8, "hb-glue") + rect(0, 58, 150, 80, "hb-si");
    s += rect(112, 54, 30, 4, "hb-cu") + rect(206, 142, 34, 4, "hb-cu");
    s += `<path class="hb-wire" d="M127 50 C127 6, 200 4, 222 142"/>`;
    s += `<ellipse class="hb-ball" cx="127" cy="49" rx="${(27 / 2).toFixed(1)}" ry="6"/>`;
    out.wire = { svg: s, note: `${M.pitchText(e)} µm pad pitch, edge only` };
  }
  // C4: flipped die on solder balls over the substrate, with underfill
  {
    let s = rect(0, 0, Wp, 50, "hb-si") + rect(0, 50, Wp, 92, "hb-fill") + rect(0, 142, Wp, 28, "hb-sub");
    for (let x = 65 - 130; x < Wp + 60; x += M.ERAS[1].pitch) s += rect(x - 45, 50, 90, 5, "hb-cu") + `<ellipse class="hb-solder" cx="${x}" cy="96" rx="52" ry="45"/>` + rect(x - 45, 137, 90, 5, "hb-cu");
    out.c4 = { svg: s, note: `${M.ERAS[1].pitch} µm pitch` };
  }
  // micro-bump: Cu pillar with a solder cap onto a pad on the die below
  {
    const p = M.ERAS[2].pitch;
    let s = rect(0, 0, Wp, 60, "hb-si") + rect(0, 60, Wp, 48, "hb-fill") + rect(0, 108, Wp, 62, "hb-si");
    for (let x = p / 2 - 20; x < Wp + p; x += p) s += rect(x - 12.5, 60, 25, 30, "hb-cu") + `<rect class="hb-solder" x="${x - 12.5}" y="90" width="25" height="14" rx="5"/>` + rect(x - 14, 104, 28, 4, "hb-cu");
    out.ubump = { svg: s, note: `${p} µm pitch` };
  }
  // hybrid: two dies meet flat; Cu pads in oxide on both sides of one plane
  {
    const p = M.ERAS[3].pitch;
    let s = rect(0, 0, Wp, 72, "hb-si") + rect(0, 72, Wp, 16, "hb-ox") + rect(0, 88, Wp, 16, "hb-ox") + rect(0, 104, Wp, 66, "hb-si");
    for (let x = p / 2; x < Wp; x += p) s += rect(x - 2.25, 84, 4.5, 4, "hb-cu") + rect(x - 2.25, 88, 4.5, 4, "hb-cu");
    s += `<line class="hb-plane" x1="0" y1="88" x2="${Wp}" y2="88"/>`;
    out.hybrid = { svg: s, note: `${p} µm pitch` };
  }
  const bar = `<g class="hb-bar"><line x1="10" y1="${Hp - 8}" x2="60" y2="${Hp - 8}"/><line x1="10" y1="${Hp - 12}" x2="10" y2="${Hp - 4}"/><line x1="60" y1="${Hp - 12}" x2="60" y2="${Hp - 4}"/></g>`;
  return M.ERAS.map((e, i) => {
    const j = out[e.id];
    const per = e.area ? `${M.fmt(M.perMm2(e.pitch))} / mm²` : "edge pads only";
    return `<div class="hb-joint" data-era="${i}"><svg viewBox="0 0 ${Wp} ${Hp}" class="hb-sec" role="img" aria-label="${e.name} in section, ${j.note}"><defs><clipPath id="hb-clip${i}"><rect x="0" y="0" width="${Wp}" height="${Hp}"/></clipPath></defs><g clip-path="url(#hb-clip${i})">${j.svg}</g>${i === 0 ? bar : ""}<rect class="hb-frame" x="0.5" y="0.5" width="${Wp - 1}" height="${Hp - 1}"/></svg><span class="hb-jname"><span class="hb-num">${String(i + 1).padStart(2, "0")}</span>${e.name}<small>${e.since}</small></span><span class="hb-jval">${M.pitchText(e)} µm · ${per}</span></div>`;
  }).join("");
}
const inset = `<div class="hb-inset"><span class="hb-inset-title">Fig 1b · the joint under the die, in section, all four at one scale, with the year each first shipped <span class="hb-unit">(bar: 50 µm)</span></span><div class="hb-joints">${joints()}</div></div>`;

const h = M.HYBRID;
const caption = `A die-to-wafer bonder, drawn as a composite of the high-volume tools (Besi's ${M.BONDER.model.replace("Besi ", "")} places dies to ${M.BONDER.placeNm} nm at ${M.fmt(M.BONDER.cph)} chips an hour, about ${M.secondsPerChip.toFixed(1)} s each). The slider runs one bond cycle for each generation of joint. A wire-bonded die goes down face up and needs no flip (it really lands on a lead frame or substrate, drawn on the same wafer here for comparison); every later kind is flipped face down. C4 solder bumps at ${M.ERAS[1].pitch} µm pitch and copper micro-bumps at ${M.ERAS[2].pitch} µm (AMD's figures) are melted or pressed with a heated collet; a hybrid bond at ${M.ERAS[3].pitch} µm (AMD 3D V-Cache on TSMC SoIC, the first die-to-wafer hybrid bond in volume, 2022) is pressed at room temperature with at most ${M.BONDER.prebondN} N, and the copper joins later in a ${M.BONDER.annealC[0]}–${M.BONDER.annealC[1]} °C anneal. TSMC is at ${h.soicNow} µm and plans ${h.soic2029} µm by 2029; imec has shown ${h.imecD2W} µm die to wafer. Connections per mm² are 1 ÷ pitch², a square grid; the wire-bond pitch is drawn at the ${M.pitchText(M.ERAS[0])} µm fine-pitch bound. Machine layout, die size and heights are illustrative; Fig 1b is to scale except the oxide bond layer, and the copper recess (under ${h.recessNm} nm) is too small to draw.`;
const scrub = `<span class="hb-scrub"><button type="button" class="hb-play" data-play aria-label="Play the bond cycles"><span class="hb-play-icon" aria-hidden="true"></span><span data-play-text>Play</span></button><input type="range" class="hb-range" data-scrub min="0" max="1000" step="1" value="0" aria-label="Process: four bond cycles, wire bond, C4, micro-bump, hybrid bond"><span class="hb-step" data-step>01 · wire bond · ${M.PHASES[0].label}</span></span>`;
const body = `<figure class="iso-figure hb"><div class="iso-plate">${corners}${stage}${controls}</div><figcaption class="iso-legend">${scrub}${inset}<span class="hb-parts">${legend}</span><span class="iso-caption">${caption}</span></figcaption></figure>`;

// the live page needs the prism builder from lathe.mjs; wrap it so its helpers can't collide with the kit's
const LATHE = readFileSync(join(HERE, "../../vendor/anatomy/kit/lathe.mjs"), "utf8").replace(/^import[^\n]*\n/m, "").replace(/^export /gm, "");
const LATHE_NS = `const GL = (() => {\n${LATHE}\nreturn { prismOf, frameOf, pointOf, dot3 };\n})();\n`;
const CSS = readFileSync(join(HERE, "hybrid-bonding.css"), "utf8");
const LIVE = readFileSync(join(HERE, "live.js"), "utf8").replace("__DATA__", JSON.stringify(DATA));
const out = writeChapter({ slug: "hybrid-bonding", figure: body, css: CSS, script: kitScript() + LATHE_NS + LIVE, lesson: LESSON });
console.log("wrote", out.file, `${out.kb} KB`, `${R.items.length} items`, `${R.solids.length} solids`);

A.auditOrExit(R, P, { frames: STATES });
