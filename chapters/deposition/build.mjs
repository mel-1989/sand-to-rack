// A deposition cluster tool: vacuum transfer chamber with a dual-arm robot, two load locks, an equipment front end,
// and four process chambers, one cut open as a showerhead ALD chamber.
// node build.mjs [--fast] [--audit]
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as M from "./model.mjs";
import { RIG, armParts, stateAt } from "./rig.mjs";

import { k, G, A, Tube, kitScript } from "../../site/kit.mjs";
import { writeChapter } from "../../site/shell.mjs";
import { LESSON } from "./lesson.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

// ---- camera and view ----
const W = 640;
const H = 520;
const AZIMUTH = 30;
const ELEVATION = 38;

// ---- layout (plan units of 5 mm; heights illustrative) ----
const AP = 100; // transfer chamber inner apothem
const WALL = 6;
const CH0 = 116; // where a module starts, measured from the hub
const TAN30 = Math.tan(Math.PI / 6);
const Z = { cab: 24, tcFloor: 30, tcTop: 72, slit: [48, 60], body: 80, lid: 86 };

const rad = (deg) => (deg * Math.PI) / 180;
const loc = (deg, u, v) => {
  const c = Math.cos(rad(deg));
  const s = Math.sin(rad(deg));
  return [u * c - v * s, u * s + v * c];
};
const boxRing = (deg, plan, steps = 4) => k.roundedPlan(plan, steps).map(([u, v]) => loc(deg, u, v));
const hexRing = (apothem) => Array.from({ length: 6 }, (_, i) => {
  const a = rad(30 + i * 60);
  const r = apothem / Math.cos(Math.PI / 6);
  return [r * Math.cos(a), r * Math.sin(a)];
});

// facets: 0 ALD (cut open), 60 PECVD, 120 pre-clean, 180 load lock A, 240 load lock B, 300 PVD; front end beyond at 210
const FACETS = { 0: "ald", 60: "pecvd", 120: "clean", 180: "loadlock", 240: "loadlock", 300: "pvd" };
const EFEM_DEG = 210;

// ---- floor bounds from everything that stands on it ----
const footprint = [
  ...[0, 60, 120, 300].flatMap((deg) => boxRing(deg, { x: CH0, y: -60, w: 130, d: 120, r: 4 })),
  ...[180, 240].flatMap((deg) => boxRing(deg, { x: CH0, y: -44, w: 88, d: 88, r: 4 })),
  ...boxRing(EFEM_DEG, { x: 204, y: -150, w: 140, d: 300, r: 6 }),
  [-80, -84], // gas panel corner
];
// the floor is laid square to the tool's axis of symmetry (30°), in local (u, v)
const FD = 22;
const toLocal = ([x, y]) => [x * Math.cos(rad(FD)) + y * Math.sin(rad(FD)), -x * Math.sin(rad(FD)) + y * Math.cos(rad(FD))];
const us = footprint.map((p) => toLocal(p)[0]);
const vs = footprint.map((p) => toLocal(p)[1]);
const FLOOR = { x: Math.floor(Math.min(...us) - 14), y: Math.floor(Math.min(...vs) - 16), r: 10 };
FLOOR.w = Math.ceil(Math.max(...us) + 44) - FLOOR.x;
FLOOR.d = Math.ceil(Math.max(...vs) + 16) - FLOOR.y;
const FLOOR_H = 8;
const FLOOR_RING = boxRing(FD, FLOOR, 8);

const P = k.fitProjection([...FLOOR_RING.flatMap(([x, y]) => [[x, y, -FLOOR_H], [x, y, 0]]), ...footprint.map(([x, y]) => [x, y, 128])], W, H, { pad: 14, azimuth: AZIMUTH, elevation: ELEVATION });
const V = G.viewOf(P);
const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);

const R = A.recorder(P, {});
function put(piece, ref, svg, shapes, { bias = 0, name, attrs = "" } = {}) {
  const id = R.nameFor(name ?? `${piece}.item`);
  shapes.forEach((shape) => (shape.name = shape.name ?? id));
  R.put({ piece, at: ref, bias, svg, move: [0, 0, 0], shapes: shapes.map(R.solid), name: id, attrs });
  return id;
}
const centroid = (ring, z) => [ring.reduce((s, p) => s + p[0], 0) / ring.length, ring.reduce((s, p) => s + p[1], 0) / ring.length, z];

// A box on any facet: plan in (u along the facet normal, v across it).
function block(piece, deg, plan, z, h, { tone = "mid", bevel = 0, steps = 4, seam = null, extra = "", name, crease, attrs } = {}) {
  const ring = boxRing(deg, plan, steps);
  const inner = seam === null ? "" : L([seam].flat().map((zz) => k.ringSeam(ring, zz, P)).join(""), { tone: "faint" });
  const svg = S(k.extrude(ring, z, h, P, { bevel }), { tone, inner, ...(crease ? { crease } : {}) }) + extra;
  put(piece, centroid(ring, z + h / 2), svg, [A.extruded(ring, z, h, {})], { name, attrs });
  return ring;
}
function can(piece, x, y, r, z, h, { tone = "mid", bevel = 0, extra = "", name, steps = 32, inner = "", attrs } = {}) {
  const svg = S(k.cylinder(x, y, r, z, h, P, steps, bevel), { tone, inner }) + extra;
  put(piece, [x, y, z + h / 2], svg, [A.cylinder(x, y, r, z, h, {})], { name, attrs });
}
const topOf = (deg, plan, z, steps = 4) => k.onTop(boxRing(deg, plan, steps), z, P, true);
const screwsOn = (deg, plan, z, inset = 4) => {
  const pts = k.corners(plan, inset).map(([u, v]) => loc(deg, u, v));
  return L(pts.map(([x, y]) => k.ring(x, y, 1.6, z, P, 12)).join(""), { tone: "lo" }) + Dots(pts.map(([x, y]) => at([x, y, z])), { size: 0.42 });
};

// closed marks on a vertical face of a facet box: face "u" is the plane u = c (coords v, z), face "v" the plane v = c (coords u, z)
const onFace = (deg, face, c, pts) => pts.map(([a, z]) => at([...(face === "u" ? loc(deg, c, a) : loc(deg, a, c)), z]));
const closed = (pts) => `M${pts.map((p) => p.map((n) => n.toFixed(1)).join(" ")).join("L")}Z`;
const faceRect = (deg, face, c, a0, a1, z0, z1, r = 1.5) => closed(onFace(deg, face, c, k.roundedPlan({ x: a0, y: z0, w: a1 - a0, d: z1 - z0, r }, 3)));
const faceCircle = (deg, face, c, a, z, r, n = 28) => closed(onFace(deg, face, c, Array.from({ length: n }, (_, i) => [a + r * Math.cos((2 * Math.PI * i) / n), z + r * Math.sin((2 * Math.PI * i) / n)])));
function viewport(deg, face, c, a, z) {
  const bolts = onFace(deg, face, c, Array.from({ length: 8 }, (_, i) => [a + 7.8 * Math.cos((2 * Math.PI * (i + 0.5)) / 8), z + 7.8 * Math.sin((2 * Math.PI * (i + 0.5)) / 8)]));
  return L(faceCircle(deg, face, c, a, z, 9.6, 36), { tone: "lo" }) + `<path class="dz-glass" d="${faceCircle(deg, face, c, a, z, 6, 32)}"/>` + Dots(bolts, { size: 0.4 });
}
// two service doors with handles on a cabinet face
function doors(deg, face, c, a0, a1, z0, z1) {
  const mid = (a0 + a1) / 2;
  const d = [faceRect(deg, face, c, a0, mid - 1.5, z0, z1), faceRect(deg, face, c, mid + 1.5, a1, z0, z1)];
  const handles = [faceRect(deg, face, c, mid - 6, mid - 4.4, z0 + 5, z1 - 5, 0.6), faceRect(deg, face, c, mid + 4.4, mid + 6, z0 + 5, z1 - 5, 0.6)];
  return L(d.join(""), { tone: "faint" }) + L(handles.join(""), { tone: "lo" });
}

// ---- floor: raised-floor tiles, ruler, label plate ----
function floor() {
  const F = (u, v, z = 0) => at([...loc(FD, u, v), z]);
  const seg = (u0, v0, u1, v1, z = 0) => `M${F(u0, v0, z).join(" ")}L${F(u1, v1, z).join(" ")}`;
  const slab = k.extrude(FLOOR_RING, -FLOOR_H, FLOOR_H, P, { bevel: 1.6 });
  let svg = `<path class="iso-halo" d="${slab.fill}"/>`;
  svg += S(slab, { tone: "lo", inner: L(k.ringSeam(FLOOR_RING, -3, P), { tone: "faint" }) });
  // 600 mm raised-floor tiles: 120 units, edge to edge
  const lines = [];
  const u0 = FLOOR.x, u1 = FLOOR.x + FLOOR.w, v0 = FLOOR.y, v1 = FLOOR.y + FLOOR.d;
  for (let u = Math.ceil((u0 + 12) / 120) * 120; u < u1 - 12; u += 120) lines.push(seg(u, v0, u, v1));
  for (let v = Math.ceil((v0 + 12) / 120) * 120; v < v1 - 12; v += 120) lines.push(seg(u0, v, u1, v));
  svg += L(lines.join(""), { tone: "faint" });
  const screws = k.corners(FLOOR, 12).map(([u, v]) => loc(FD, u, v));
  svg += L(screws.map(([x, y]) => k.ring(x, y, 2.4, 0, P, 16)).join(""), { tone: "lo" }) + Dots(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 });
  // ruler strip along the near edge: ticks every 100 mm, majors every 500 mm
  const strip = { x: u1 - 16, y: v0 + 40, w: 8, d: 300, r: 1 };
  const sRing = boxRing(FD, strip, 3);
  svg += S(k.extrude(sRing, 0, 0.6, P), { tone: "lo", crease: "none" });
  const step = 100 / M.MM_PER_UNIT;
  const minor = [];
  const major = [];
  for (let i = 0, v = strip.y + 4; v <= strip.y + strip.d - 4 + 1e-6; i++, v += step) (i % 5 ? minor : major).push(seg(strip.x + 0.8, v, strip.x + 0.8 + (i % 5 ? 2.4 : 4.4), v, 0.6));
  svg += L(minor.join(""), { tone: "lo" }) + L(major.join(""), { tone: "mid" });
  svg += Dots([F(strip.x + 5, strip.y + 2, 0.6), F(strip.x + 5, strip.y + strip.d - 2, 0.6)], { size: 0.45 });
  // label plate on the near edge
  const label = { x: u1 - 26, y: v1 - 120, w: 16, d: 80, r: 1.5 };
  svg += S(k.extrude(boxRing(FD, label, 4), 0, 0.8, P), { tone: "lo", crease: "none" });
  svg += L(k.onTop(boxRing(FD, k.insetPlan(label, 1.8), 4), 0.8, P, true), { tone: "faint" });
  svg += L([0, 1, 2].map((i) => seg(label.x + 5 + i * 3, label.y + 8, label.x + 5 + i * 3, label.y + 64 - i * 14, 0.8)).join(""), { tone: "lo", free: true });
  svg += Dots([F(label.x + 8, label.y + 4, 0.8), F(label.x + 8, label.y + label.d - 4, 0.8)], { size: 0.45 });
  put("base", [0, 0, -FLOOR_H], svg, [A.extruded(FLOOR_RING, -FLOOR_H, FLOOR_H, { name: "stand.floor" })], { name: "stand.floor", bias: -2000 });
}

// ---- transfer chamber: cabinet, floor, six walls, robot hub ----
function transfer() {
  const cab = hexRing(AP - 4);
  put("robot", [0, 0, 12], S(k.extrude(cab, 0, Z.cab, P), { tone: "mid", inner: L(k.ringSeam(cab, 4, P), { tone: "faint" }) }), [A.extruded(cab, 0, Z.cab, {})], { name: "robot.cabinet" });
  const fl = hexRing(AP + WALL);
  put("robot", [0, 0, Z.cab + 3], S(k.extrude(fl, Z.cab, Z.tcFloor - Z.cab, P, { bevel: 0.6 }), { tone: "mid" }) + L(k.onTop(hexRing(AP - 6), Z.tcFloor, P, true), { tone: "faint" }), [A.extruded(fl, Z.cab, Z.tcFloor - Z.cab, {})], { name: "robot.floor" });
  for (const deg of [0, 60, 120, 180, 240, 300]) {
    const ring = [[AP, -AP * TAN30], [AP + WALL, -(AP + WALL) * TAN30], [AP + WALL, (AP + WALL) * TAN30], [AP, AP * TAN30]].map(([u, v]) => loc(deg, u, v));
    let extra = "";
    const inside = Math.cos(rad(deg - AZIMUTH)) < -0.05;
    if (inside) {
      // the slit seen from inside: a dark closed slot on the inner face
      const slot = [[AP, -40, Z.slit[0]], [AP, 40, Z.slit[0]], [AP, 40, Z.slit[1]], [AP, -40, Z.slit[1]]].map(([u, v, z]) => at([...loc(deg, u, v), z]));
      extra += `<path class="dz-void" d="M${slot.map((p) => p.join(" ")).join("L")}Z"/>`;
    }
    const svg = S(k.extrude(ring, Z.tcFloor, Z.tcTop - Z.tcFloor, P, { bevel: 0.5 }), { tone: "mid" }) + extra + Dots([loc(deg, AP + 3, -40), loc(deg, AP + 3, 0), loc(deg, AP + 3, 40)].map(([x, y]) => at([x, y, Z.tcTop])), { size: 0.4 });
    put("robot", centroid(ring, (Z.tcFloor + Z.tcTop) / 2), svg, [A.extruded(ring, Z.tcFloor, Z.tcTop - Z.tcFloor, {})], { name: `robot.wall${deg}` });
    // slit valve between the wall and the module
    block(FACETS[deg] === "ald" ? "ald" : FACETS[deg], deg, { x: AP + WALL, y: -46, w: CH0 - AP - WALL, d: 92, r: 1 }, 34, 36, { bevel: 0.4, seam: 40, extra: Dots([loc(deg, 111, -38), loc(deg, 111, 38)].map(([x, y]) => at([x, y, 70])), { size: 0.42 }), name: `${FACETS[deg]}.slitvalve${deg}` });
  }
  // robot hub: base drum on the floor, a turning waist with a pointer
  const base = S(k.cylinder(0, 0, 24, Z.tcFloor, 10, P, 48, 0.5), { tone: "mid", inner: L(k.sideArc(0, 0, 24, Z.tcFloor + 3, P, 32), { tone: "faint" }) });
  const bolts = Dots(Array.from({ length: 12 }, (_, i) => at([21.5 * Math.cos((i / 12) * 2 * Math.PI), 21.5 * Math.sin((i / 12) * 2 * Math.PI), Z.tcFloor + 10])), { size: 0.4 });
  put("robot", [0, 0, Z.tcFloor + 5], base + bolts, [A.cylinder(0, 0, 24, Z.tcFloor, 10, {})], { name: "robot.hub" });
  put("robot", [0, 0, 42], S(k.cylinder(0, 0, 19, 40, 4, P, 40, 0.4), { tone: "mid" }), [A.cylinder(0, 0, 19, 40, 4, {})], { name: "robot.waist" });
}

// ---- a closed process chamber on a facet ----
function chamber(deg, piece, top, { cabinet = "", body = "" } = {}) {
  block(piece, deg, { x: CH0 + 2, y: -58, w: 126, d: 116, r: 3 }, 0, Z.cab, { seam: 4, extra: cabinet, name: `${piece}.cabinet` });
  block(piece, deg, { x: CH0, y: -60, w: 130, d: 120, r: 4 }, Z.cab, Z.body - Z.cab, { bevel: 0.8, seam: [Z.cab + 6, Z.body - 8], extra: body, name: `${piece}.body` });
  const lid = { x: CH0 + 1, y: -59, w: 128, d: 118, r: 4 };
  block(piece, deg, lid, Z.body, Z.lid - Z.body, { bevel: 0.6, extra: screwsOn(deg, lid, Z.lid, 5) + L(topOf(deg, k.insetPlan(lid, 9), Z.lid), { tone: "faint" }), name: `${piece}.lid` });
  top();
}

function pecvd() {
  const deg = 60;
  chamber(deg, "pecvd", () => {
    const match = { x: 150, y: -24, w: 48, d: 48, r: 2 };
    const vents = [0, 1, 2, 3, 4].map((i) => topOf(deg, { x: 156 + i * 8, y: -16, w: 3, d: 32, r: 1.4 }, Z.lid + 24, 3)).join("");
    block("pecvd", deg, match, Z.lid, 24, { bevel: 0.6, seam: Z.lid + 4, extra: L(vents, { tone: "lo" }) + screwsOn(deg, match, Z.lid + 24, 3), name: "pecvd.match" });
    const [cx, cy] = loc(deg, 174, 0);
    can("pecvd", cx, cy, 5, Z.lid + 24, 7, { bevel: 0.3, extra: L(k.ring(cx, cy, 2.2, Z.lid + 31, P, 16), { tone: "lo" }), name: "pecvd.rf" });
    const [gx, gy] = loc(deg, 222, -26);
    can("pecvd", gx, gy, 6, Z.lid, 12, { bevel: 0.3, extra: L(k.ring(gx, gy, 3, Z.lid + 12, P, 16), { tone: "lo" }), name: "pecvd.gasfeed" });
  }, { cabinet: doors(deg, "u", CH0 + 128, -50, 50, 7, 21), body: viewport(deg, "u", CH0 + 130, -28, 52) });
}

function pvd() {
  const deg = 300;
  chamber(deg, "pvd", () => {
    const [cx, cy] = loc(deg, 181, 0);
    can("pvd", cx, cy, 50, Z.lid, 5, { steps: 72, name: "pvd.insulator" });
    can("pvd", cx, cy, 46, Z.lid + 5, 20, {
      steps: 72,
      bevel: 0.8,
      inner: L(k.sideArc(cx, cy, 46, Z.lid + 9, P, 48), { tone: "faint" }),
      extra: L(k.ring(cx, cy, 38, Z.lid + 25, P, 64), { tone: "faint" }) + Dots(Array.from({ length: 16 }, (_, i) => at([cx + 42 * Math.cos((i / 16) * 2 * Math.PI), cy + 42 * Math.sin((i / 16) * 2 * Math.PI), Z.lid + 25])), { size: 0.4 }),
      name: "pvd.magnetron",
    });
    can("pvd", cx, cy, 12, Z.lid + 25, 14, { bevel: 0.4, inner: L(k.sideArc(cx, cy, 12, Z.lid + 30, P, 24), { tone: "faint" }), extra: L(k.knurl(cx, cy, 12, Z.lid + 31, Z.lid + 38, 22, P), { tone: "lo" }), name: "pvd.motor" });
    for (const a of [150, 210]) {
      const [x, y] = [cx + 30 * Math.cos(rad(a)), cy + 30 * Math.sin(rad(a))];
      can("pvd", x, y, 3.4, Z.lid + 25, 6, { bevel: 0.3, extra: L(k.ring(x, y, 1.6, Z.lid + 31, P, 12), { tone: "lo" }), name: "pvd.water" });
    }
  }, { cabinet: doors(deg, "v", 58, 130, 236, 7, 21), body: viewport(deg, "v", 60, 214, 52) });
}

function preclean() {
  const deg = 120;
  chamber(deg, "clean", () => {
    const [cx, cy] = loc(deg, 176, 0);
    can("clean", cx, cy, 46, Z.lid, 24, { steps: 72, bevel: 0.8, inner: L([Z.lid + 6, Z.lid + 18].map((z) => k.sideArc(cx, cy, 46, z, P, 48)).join(""), { tone: "faint" }), extra: L(k.ring(cx, cy, 30, Z.lid + 24, P, 48), { tone: "faint" }), name: "clean.bell" });
    can("clean", cx, cy, 16, Z.lid + 24, 5, { bevel: 0.4, extra: Dots(Array.from({ length: 8 }, (_, i) => at([cx + 12.5 * Math.cos((i / 8) * 2 * Math.PI), cy + 12.5 * Math.sin((i / 8) * 2 * Math.PI), Z.lid + 29])), { size: 0.4 }), name: "clean.cap" });
    block("clean", deg, { x: 226, y: -12, w: 14, d: 24, r: 1.5 }, Z.lid, 12, { bevel: 0.4, extra: screwsOn(deg, { x: 226, y: -12, w: 14, d: 24 }, Z.lid + 12, 3), name: "clean.feed" });
  }, { cabinet: doors(deg, "v", -58, 130, 236, 7, 21), body: viewport(deg, "v", -60, 214, 52) });
}

const LL_WIN = 31.5; // load-lock window radius (illustrative)
function loadlocks() {
  for (const deg of [180, 240]) {
    block("loadlock", deg, { x: CH0 + 2, y: -42, w: 76, d: 84, r: 3 }, 0, Z.cab, { seam: 4, name: `loadlock.cabinet${deg}` });
    block("loadlock", deg, { x: CH0, y: -44, w: 80, d: 88, r: 4 }, Z.cab, 46, { bevel: 0.8, seam: Z.cab + 6, name: `loadlock.body${deg}` });
    const lid = { x: CH0 + 2, y: -42, w: 76, d: 84, r: 3 };
    const [cx, cy] = loc(deg, 156, 0);
    // a large glass window over the wafer station: the wafer (and the robot blade reaching in) shows through it
    const bolts = Dots(Array.from({ length: 16 }, (_, i) => at([cx + 34.6 * Math.cos(((i + 0.5) / 16) * 2 * Math.PI), cy + 34.6 * Math.sin(((i + 0.5) / 16) * 2 * Math.PI), 74])), { size: 0.4 });
    const glass = `<path class="dz-glass" d="${k.ring(cx, cy, LL_WIN, 74, P, 64)}"/>`;
    const seen = deg === 180 ? `<use href="#dz-carry" clip-path="url(#dz-clip-ll)"/>` : "";
    const window = glass + seen + L(k.ring(cx, cy, LL_WIN, 74, P, 64), { tone: "lo" }) + L(k.ring(cx, cy, LL_WIN + 1.6, 74, P, 64), { tone: "faint" }) + bolts;
    block("loadlock", deg, lid, 70, 4, { bevel: 0.5, extra: window + screwsOn(deg, lid, 74, 4), name: `loadlock.lid${deg}` });
    const [gx, gy] = loc(deg, 186, 32);
    can("loadlock", gx, gy, 4, 74, 10, { bevel: 0.3, extra: L(k.ring(gx, gy, 2, 84, P, 12), { tone: "lo" }), name: `loadlock.gauge${deg}` });
    block("loadlock", deg, { x: 196, y: -36, w: 8, d: 72, r: 1 }, 30, 34, { bevel: 0.4, seam: 36, name: `loadlock.door${deg}` });
  }
}

function efem() {
  const deg = EFEM_DEG;
  const body = { x: 204, y: -150, w: 70, d: 300, r: 6 };
  const panels = [[-140, -96], [-24, 24], [96, 140]].map(([a, b]) => faceRect(deg, "u", 204, a, b, 14, 78, 2)).join("");
  const latches = [-118, 118].map((a) => faceRect(deg, "u", 204, a - 1, a + 1, 44, 52, 0.6)).join("");
  block("efem", deg, body, 0, 92, { bevel: 1, seam: [8, 84], extra: L(panels, { tone: "faint" }) + L(latches, { tone: "lo" }), name: "efem.body" });
  // atmospheric tunnels from each load-lock door to the front end
  for (const ll of [180, 240]) {
    const uEnd = (v) => (204 - v * Math.sin(rad(deg - ll))) / Math.cos(rad(ll - deg));
    const ring = [[204, -30], [uEnd(-30), -30], [uEnd(30), 30], [204, 30]].map(([u, v]) => loc(ll, u, v));
    put("efem", centroid(ring, 47), S(k.extrude(ring, 32, 30, P, { bevel: 0.4 }), { tone: "mid", inner: L(k.ringSeam(ring, 36, P), { tone: "faint" }) }), [A.extruded(ring, 32, 30, {})], { name: `efem.tunnel${ll}` });
  }
  const ffu = { x: 210, y: -144, w: 58, d: 288, r: 4 };
  const perf = [];
  for (let u = 216; u <= 262; u += 6) for (let v = -136; v <= 136; v += 6) perf.push(at([...loc(deg, u, v), 102]));
  block("efem", deg, ffu, 92, 10, { bevel: 0.6, extra: Dots(perf, { size: 0.3, tone: "lo" }) + L(topOf(deg, k.insetPlan(ffu, 3), 102), { tone: "faint" }), name: "efem.ffu" });
  // signal tower on the near end
  const [tx, ty] = loc(deg, 222, 147);
  can("efem", tx, ty, 1.6, 92, 10, { steps: 12, name: "efem.pole" });
  [0, 1, 2].forEach((i) => can("efem", tx, ty, 3.4, 102 + i * 6, 6, { tone: i === 2 ? "hi" : "mid", inner: L(k.sideArc(tx, ty, 3.4, 102 + i * 6 + 0.01, P, 12), { tone: "faint" }), name: `efem.lamp${i}` }));
  can("efem", tx, ty, 3.8, 120, 1.2, { name: "efem.cap" });
  // two load ports with FOUPs on the outer face
  for (const v of [-70, 70]) {
    block("efem", deg, { x: 274, y: v - 42, w: 10, d: 84, r: 1 }, 0, 50, { bevel: 0.4, seam: 6, name: "efem.port" });
    block("efem", deg, { x: 284, y: v - 40, w: 60, d: 80, r: 2 }, 44, 6, { bevel: 0.4, name: "efem.shelf" });
    const foup = { x: 286, y: v - 38, w: 56, d: 76, r: 6 };
    block("efem", deg, foup, 50, 64, { tone: "hi", bevel: 0.8, seam: [56, 108], name: "efem.foup" });
    block("efem", deg, { x: 306, y: v - 7, w: 6, d: 14, r: 1 }, 114, 4, { name: "efem.neck" });
    block("efem", deg, { x: 300, y: v - 16, w: 20, d: 32, r: 3 }, 118, 4, { bevel: 0.4, name: "efem.flange" });
  }
}

// ---- the ALD chamber, cut open ----
const PX = RIG.PED_X;
const pin = (i) => [PX + RIG.PIN_R * Math.cos(rad(90 + i * 120)), RIG.PIN_R * Math.sin(rad(90 + i * 120))];
const VALVES = [
  { id: "A", x: 166, label: M.ALD.precursor },
  { id: "N", x: 181, label: M.ALD.purge },
  { id: "B", x: 196, label: M.ALD.coreactant },
];
const SHOWER = { r: 36, z0: 66, z1: 72, cut: 4 }; // the faceplate is cut a little in front of centre (y = cut)
const LID_CUT = -18; // the lid is cut further back, so the faceplate and backing plate show as steps below it

function ald() {
  const cabinet = { x: 118, y: -58, w: 126, d: 116, r: 3 };
  block("ald", 0, cabinet, 0, Z.cab, { seam: 4, extra: doors(0, "u", cabinet.x + cabinet.w, -50, 50, 7, 21) + doors(0, "v", cabinet.y + cabinet.d, 124, 184, 7, 21), name: "ald.cabinet" });
  block("ald", 0, { x: CH0, y: -60, w: 130, d: 120, r: 4 }, Z.cab, Z.tcFloor - Z.cab, { bevel: 0.6, name: "ald.floor" });
  // back wall, with the pumping port seen from inside
  const port = [];
  for (let i = 0; i <= 32; i++) {
    const a = (i / 32) * 2 * Math.PI;
    port.push(at([204 + 8 * Math.cos(a), -54, 50 + 8 * Math.sin(a)]));
  }
  const portSvg = `<path class="dz-void" d="M${port.map((p) => p.join(" ")).join("L")}Z"/>`;
  block("ald", 0, { x: CH0, y: -60, w: 130, d: 6, r: 1 }, Z.tcFloor, Z.body - Z.tcFloor, { bevel: 0.5, extra: portSvg, name: "ald.backwall" });
  const slot = [[122, -40, Z.slit[0]], [122, 40, Z.slit[0]], [122, 40, Z.slit[1]], [122, -40, Z.slit[1]]].map(at);
  block("ald", 0, { x: CH0, y: -54, w: 6, d: 108, r: 0.5 }, Z.tcFloor, Z.body - Z.tcFloor, { bevel: 0.5, extra: `<path class="dz-void" d="M${slot.map((p) => p.join(" ")).join("L")}Z"/>`, name: "ald.endwall" });
  // the walls nearest the viewer are cut down to show the inside
  block("ald", 0, { x: 240, y: -54, w: 6, d: 108, r: 0.5 }, Z.tcFloor, 10, { name: "ald.cutfar" });
  block("ald", 0, { x: CH0, y: 54, w: 130, d: 6, r: 1 }, Z.tcFloor, 10, { name: "ald.cutnear" });
  // heated pedestal on its shaft
  can("ald", PX, 0, 14, Z.tcFloor, 2, { name: "ald.pedfoot" });
  can("ald", PX, 0, 7, Z.tcFloor + 2, 8, { inner: L(k.sideArc(PX, 0, 7, 35, P, 16), { tone: "faint" }), name: "ald.shaft" });
  const pedTop = L(k.ring(PX, 0, 31.5, RIG.PED_TOP, P, 64), { tone: "faint" }) + L([0, 1, 2].map((i) => k.ring(...pin(i), 1.8, RIG.PED_TOP, P, 12)).join(""), { tone: "lo" });
  can("ald", PX, 0, 34, 40, RIG.PED_TOP - 40, { steps: 72, bevel: 0.6, inner: L(k.sideArc(PX, 0, 34, 42, P, 48), { tone: "faint" }), extra: pedTop, name: "ald.pedestal" });
  // showerhead faceplate, backing plate and stem hung from the lid: a stepped section, each cut further forward than the one above
  const chord = (r, yc, n = 44) => {
    const a0 = Math.asin(yc / r);
    return Array.from({ length: n + 1 }, (_, i) => {
      const a = Math.PI - a0 + ((Math.PI + 2 * a0) * i) / n;
      return [PX + r * Math.cos(a), r * Math.sin(a)];
    });
  };
  const cutSolid = (name, r, yc, z0, z1, { extra = "", inner = "", lit = false } = {}) => {
    const ring = chord(r, yc);
    put("ald", [PX, (yc - r) / 2, (z0 + z1) / 2], S(k.extrude(ring, z0, z1 - z0, P, { bevel: 0.4 }), { tone: "mid", inner, lit }) + extra, [A.extruded(ring, z0, z1 - z0, {})], { name });
  };
  // cut face of the faceplate: the gas plenum and the holes from it down to the face
  const yc = SHOWER.cut;
  const half = Math.sqrt(SHOWER.r ** 2 - yc ** 2);
  const face = (x, z, y = yc) => at([x, y, z]);
  const plenum = [face(PX - half + 5, SHOWER.z0 + 2.6), face(PX + half - 5, SHOWER.z0 + 2.6), face(PX + half - 5, SHOWER.z1 - 1.4), face(PX - half + 5, SHOWER.z1 - 1.4)];
  let holes = "";
  for (let x = PX - 28; x <= PX + 28.1; x += 4) holes += `M${face(x, SHOWER.z0).join(" ")}L${face(x, SHOWER.z0 + 2.6).join(" ")}`;
  const cut = `<path class="dz-void" d="M${plenum.map((p) => p.join(" ")).join("L")}Z"/>` + L(holes, { tone: "lo" });
  // the faceplate's exposed top rim, outside the backing plate, carries its clamp screws
  const rimScrews = Array.from({ length: 13 }, (_, i) => Math.PI * (0.96 + (i * 1.08) / 12)).map((a) => [PX + 32 * Math.cos(a), 32 * Math.sin(a)]).filter(([, y]) => y < yc - 2);
  const rim = L(rimScrews.map(([x, y]) => k.ring(x, y, 1.3, SHOWER.z1, P, 12)).join(""), { tone: "lo" }) + Dots(rimScrews.map(([x, y]) => at([x, y, SHOWER.z1])), { size: 0.4 });
  cutSolid("ald.showerhead", SHOWER.r, yc, SHOWER.z0, SHOWER.z1, { extra: cut + rim, lit: true });
  const backBolts = Array.from({ length: 9 }, (_, i) => Math.PI * (1.06 + (i * 0.88) / 8)).map((a) => [PX + 24 * Math.cos(a), 24 * Math.sin(a)]).filter(([, y]) => y > LID_CUT + 2 || y < -60);
  cutSolid("ald.backing", 28, 0, SHOWER.z1, SHOWER.z1 + 4, { extra: Dots(backBolts.map(([x, y]) => at([x, y, SHOWER.z1 + 4])), { size: 0.4 }) });
  cutSolid("ald.stem", 10, 0, SHOWER.z1 + 4, Z.lid, { extra: `<path class="dz-void" d="M${[face(PX - 4, SHOWER.z1 + 4, 0), face(PX + 4, SHOWER.z1 + 4, 0), face(PX + 4, Z.lid, 0), face(PX - 4, Z.lid, 0)].map((p) => p.join(" ")).join("L")}Z"/>` });
  // gas inlet flange on top of the stem, bolted down onto the lid's cut edge
  const flangeBolts = Array.from({ length: 7 }, (_, i) => Math.PI * (1.08 + (i * 0.84) / 6)).map((a) => [PX + 17 * Math.cos(a), 17 * Math.sin(a)]);
  cutSolid("ald.inlet", 20, 0, Z.lid, Z.lid + 2.4, { extra: L(flangeBolts.map(([x, y]) => k.ring(x, y, 1.2, Z.lid + 2.4, P, 12)).join(""), { tone: "lo" }) + Dots(flangeBolts.map(([x, y]) => at([x, y, Z.lid + 2.4])), { size: 0.38 }) });
  // lid, kept over the back of the chamber
  const lid = { x: CH0, y: -60, w: 130, d: 60 + LID_CUT, r: 1 };
  const lidScrews = [];
  for (let x = CH0 + 5; x <= CH0 + 125; x += 15) lidScrews.push([x, -56]);
  for (let y = -44; y <= LID_CUT - 4; y += 12) lidScrews.push([CH0 + 4, y]);
  block("ald", 0, lid, Z.body, Z.lid - Z.body, { bevel: 0.6, steps: 3, extra: L(lidScrews.map(([x, y]) => k.ring(x, y, 1.4, Z.lid, P, 12)).join(""), { tone: "lo" }) + Dots(lidScrews.map(([x, y]) => at([x, y, Z.lid])), { size: 0.4 }), name: "ald.lid" });
  // valve manifold with three ALD valves
  const mani = { x: 154, y: -40, w: 54, d: 16, r: 1.5 };
  block("ald", 0, mani, Z.lid, 8, { bevel: 0.4, seam: Z.lid + 2, name: "ald.manifold" });
  for (const v of VALVES) {
    const y = -32;
    const body = S(k.cylinder(v.x, y, 5, Z.lid + 8, 5, P, 28), { tone: "mid" });
    const act = S(k.cylinder(v.x, y, 6.2, Z.lid + 13, 11, P, 32, 0.4), { tone: "hi", inner: L(k.sideArc(v.x, y, 6.2, Z.lid + 16, P, 20), { tone: "faint" }) });
    const cap = S(k.cylinder(v.x, y, 3.6, Z.lid + 24, 2, P, 20), { tone: "mid" }) + L(k.ring(v.x, y, 1.6, Z.lid + 26, P, 12), { tone: "lo" });
    put("ald", [v.x, y, Z.lid + 16], body + act + cap, [A.cylinder(v.x, y, 5, Z.lid + 8, 5, {}), A.cylinder(v.x, y, 6.2, Z.lid + 13, 11, {}), A.cylinder(v.x, y, 3.6, Z.lid + 24, 2, {})], { name: `ald.valve${v.id}`, attrs: ` data-valve="${v.id}"` });
  }
  // capacitance manometer
  can("ald", 228, -40, 6.5, Z.lid, 16, { bevel: 0.4, inner: L(k.sideArc(228, -40, 6.5, Z.lid + 4, P, 20), { tone: "faint" }), extra: L(k.ring(228, -40, 3, Z.lid + 16, P, 16), { tone: "lo" }), name: "ald.gauge" });
  // gas panel behind the chamber and the three feed lines
  const panel = { x: 150, y: -78, w: 62, d: 14, r: 1.5 };
  block("ald", 0, panel, 0, 52, { bevel: 0.5, seam: [6, 46], name: "ald.gaspanel" });
  // dry pump on the floor in front, its foreline into the chamber cabinet
  const pump = { x: 186, y: 100, w: 50, d: 34, r: 3 };
  const fins = [];
  for (let x = 192; x <= 230; x += 4) fins.push(k.segment([x, pump.y + pump.d, 4], [x, pump.y + pump.d, 22], P));
  block("ald", 0, pump, 0, 26, { bevel: 0.6, seam: [4, 22], extra: L(fins.join(""), { tone: "faint" }) + screwsOn(0, pump, 26, 4), name: "ald.pump" });
  can("ald", 222, 117, 9, 26, 14, { bevel: 0.4, inner: L(k.sideArc(222, 117, 9, 30, P, 24), { tone: "faint" }), extra: L(k.knurl(222, 117, 9, 31, 39, 26, P), { tone: "lo" }), name: "ald.pumpmotor" });
  pipe("ald.foreline", [[204, pump.y, 15], [204, 58, 15]], 3.2);
  for (const v of VALVES) feedLine(`ald.feed${v.id}`, [[v.x, -40, Z.lid + 4], [v.x, -70, Z.lid + 4], [v.x, -70, 52]], 1.5);
}

// a straight line with a bolted flange on each end
function pipe(name, control, r) {
  const total = G.pathLength(control);
  const thick = 1.4;
  const flanges = [[0, 1], [total, -1]].map(([along, sign]) => {
    const tangent = G.tangentAlong(control, along);
    return { centre: G.add3(G.pointAlong(control, along), G.mul3(tangent, (sign * thick) / 2)), tangent };
  });
  R.route(name, control, r, { owner: name, piece: "ald", move: [0, 0, 0], gaps: [[0, thick], [total - thick, total]], rims: [r * 1.6, r * 1.6] });
  Tube.tubePieces(control, r, P, { maxLength: 14, gaps: [[0, thick], [total - thick, total]] }).forEach((part, index) => {
    R.put({ piece: "ald", at: part.mid, bias: 0, svg: Tube.tubeSvg(part, { tone: "mid" }), move: [0, 0, 0], name: `${name}:${index}`, route: name, chunk: index, shapes: [R.solid(A.tube(part.points, part.radii, { name: `${name}:${index}`, owner: name }))] });
  });
  flanges.forEach(({ centre, tangent }, index) => {
    const F = G.frameAlong(centre, tangent);
    const towards = G.dot3(F.a, V) > 0 ? thick / 2 : -thick / 2;
    const bolts = Math.abs(G.dot3(F.a, V)) > 0.12 ? Dots(G.dotsOf(F, towards, r * 1.25, 6, P, { all: true }), { size: 0.4 }) : "";
    put("ald", centre, S(G.disc(-thick / 2, thick / 2, r * 1.6, F, P), { tone: "mid" }) + bolts, [A.disc(F, -thick / 2, thick / 2, r * 1.6, { owner: name })], { name: `${name}.flange${index}` });
  });
}

function feedLine(name, control, r) {
  const line = G.fillet(control, Math.max(r * 2.6, 4), 12, { P, tube: r });
  R.route(name, line, r, { owner: name, piece: "ald", move: [0, 0, 0] });
  Tube.tubePieces(line, r, P, { maxLength: 18 }).forEach((part, index) => {
    R.put({ piece: "ald", at: part.mid, bias: 0, svg: Tube.tubeSvg(part, { tone: "mid" }), move: [0, 0, 0], name: `${name}:${index}`, route: name, chunk: index, shapes: [R.solid(A.tube(part.points, part.radii, { name: `${name}:${index}`, owner: name }))] });
  });
}

// ---- the moving parts, drawn at rest; live.js redraws them ----
function arms(s) {
  const out = [];
  for (const [index, theta] of [s.theta, s.theta + Math.PI].entries()) {
    const arm = armParts(theta, index === 0 ? s.d : RIG.D_RET);
    out.push(...arm.parts.map((p) => ({ ...p, arm: index })));
    if (index === 1) out.push({ ...arm.blade, tone: "mid", arm: 1 });
  }
  return out;
}

floor();
transfer();
ald();
pecvd();
pvd();
preclean();
loadlocks();
efem();

// segments of the slider
const SEGS = [];
{
  const list = [...M.TRANSFER.map((s) => ({ ...s }))];
  for (let c = 1; c <= M.CYCLES; c++) for (const h of M.HALF) list.push({ ...h, cycle: c, label: `Cycle ${c} · ${h.label}` });
  list.push({ id: "done", label: `${M.CYCLES} cycles · film done`, say: `${M.CYCLES} cycles · ${M.filmNm(M.CYCLES)} nm of ${M.ALD.film}` });
  const total = list.reduce((s, x) => s + M.WEIGHTS[x.id], 0);
  let acc = 0;
  for (const s of list) {
    const w = M.WEIGHTS[s.id] / total;
    SEGS.push({ ...s, from: acc, to: acc + w });
    acc += w;
  }
  SEGS[SEGS.length - 1].to = 1;
}
const REST = stateAt(0, SEGS);

// the robot arms at rest, recorded so settle can place their slot
const armList = arms(REST);
put("robot", [0, 0, 47], `<g data-dyn="arms" clip-path="url(#dz-clip-tc)">${armList.map((p) => S(k.extrude(p.ring, p.z, p.h, P), { tone: p.tone })).join("")}</g>`, armList.map((p) => A.extruded(p.ring, p.z, p.h, { owner: "robot.arms" })), { name: "robot.arms" });
// the carried blade and wafer: one group in <defs>, shown through two clipped copies
const bladeRest = armParts(REST.theta, REST.d).blade;
put("robot", [-50, 0, 51], `<use href="#dz-carry" clip-path="url(#dz-clip-tc)"/>`, [A.extruded(bladeRest.ring, bladeRest.z, bladeRest.h, {})], { name: "robot.carry" });
put("ald", [PX, 0, 47], `<use href="#dz-carry" clip-path="url(#dz-clip-ch)"/>`, [A.cylinder(PX, 0, RIG.WAFER_R, RIG.PED_TOP, RIG.WAFER_T, {})], { name: "ald.carry" });

if (!process.argv.includes("--fast")) A.settle(R, P);
R.items.sort((a, b) => a.key - b.key);
// the carried wafer always paints just after the arms that hold it
{
  const carry = R.items.findIndex((item) => item.name === "robot.carry");
  const [item] = R.items.splice(carry, 1);
  R.items.splice(R.items.findIndex((x) => x.name === "robot.arms") + 1, 0, item);
}

// clip half-planes at blade height: the transfer chamber strip and the ALD chamber interior
function halfPlane(x0, x1) {
  const zb = RIG.Z_BLADE[1];
  const a0 = at([x0, -400, zb]);
  const b0 = at([x0, 400, zb]);
  const a1 = at([x1, -400, zb]);
  const b1 = at([x1, 400, zb]);
  return `M${a0.join(" ")}L${b0.join(" ")}L${b1.join(" ")}L${a1.join(" ")}Z`;
}
const DEFS = `<defs><clipPath id="dz-clip-tc"><path d="${halfPlane(-AP, CH0)}"/></clipPath><clipPath id="dz-clip-ch"><path d="${halfPlane(122, 600)}"/></clipPath><clipPath id="dz-clip-ll"><path d="${k.ring(RIG.LL_X, 0, LL_WIN, 74, P, 64)}"/></clipPath><g id="dz-carry" data-dyn="carry"></g></defs>`;

const groups = [];
for (const item of R.items) {
  if (item.name === "ald.carry") groups.push(`<g class="it" data-piece="ald" data-dyn="pins"></g>`);
  groups.push(`<g class="it" data-piece="${item.piece}" data-name="${item.name}"${item.attrs ?? ""}>${item.svg}</g>`);
  if (item.name === "ald.carry") groups.push(`<g class="it dz-gas" data-piece="ald" data-dyn="gas"></g>`);
}

const LABEL = `A deposition cluster tool seen from above. A hexagonal vacuum transfer chamber, its lid removed, holds a dual-arm wafer robot. Around it sit two load locks fed by an equipment front end with two FOUPs, a PECVD chamber, a PVD chamber with its magnetron, a pre-clean chamber, and an ALD chamber cut open to show its heated pedestal, lift pins, showerhead and three fast valves on the lid. The slider carries one wafer from a load lock into the ALD chamber and runs ${M.CYCLES} ALD cycles.`;
const svg = k.figureSvg({ width: W, height: H, label: LABEL, body: [DEFS, `<g class="dz-layers">${groups.join("")}</g>`], className: "dz-svg" });

const DATA = {
  P,
  segs: SEGS.map(({ id, label, say, cycle, from, to }) => ({ id, label, say, cycle: cycle ?? 0, from: +from.toFixed(5), to: +to.toFixed(5) })),
  pieces: Object.fromEntries(Object.entries(M.PIECES).map(([id, p]) => [id, { name: p.name, say: p.say }])),
  order: M.ORDER,
  idle: M.IDLE,
  gpc: M.ALD.gpcNm,
  cycles: M.CYCLES,
  film: M.ALD.film,
  valves: VALVES.map((v) => v.id),
  shower: SHOWER,
  lidCut: LID_CUT,
  pins: [0, 1, 2].map(pin),
};

const PARTS = M.ORDER.map((id, index) => `<button type="button" class="dz-part" data-part="${id}"><span class="dz-num">${String(index + 1).padStart(2, "0")}</span>${M.PIECES[id].name}</button>`).join("");
const corners = `<div class="iso-plate-corners" aria-hidden="true"><span class="iso-plate-corner" data-corner="fig">Fig 6</span><span class="iso-plate-corner" data-corner="title">Cluster tool · ALD</span><span class="iso-plate-corner" data-corner="readout" data-readout>${M.IDLE}</span></div>`;
const controls = `<div class="dz-controls"><span class="dz-hint">Hover a chamber · Space plays the run</span><span class="dz-live" aria-live="polite" data-live></span></div>`;
const stage = `<div class="dz-stage" tabindex="0" role="slider" aria-label="Deposition cluster tool. Hover, or use the arrow keys, to pick a chamber; Space plays or pauses the run, which carries one wafer from a load lock into the ALD chamber and grows a film one atomic layer per cycle; Escape resets; the slider below steps through it." aria-valuemin="0" aria-valuemax="${M.ORDER.length}" aria-valuenow="0" aria-valuetext="${M.IDLE}">${svg}</div>`;
const caption = `A single-wafer cluster tool keeps every chamber under vacuum and moves wafers between them with a robot, so a film stack can be built without the wafer ever meeting air. Here a ${M.TOOL.waferMm} mm wafer comes through a load lock, the robot carries it into the ALD chamber, lift pins lower it onto a pedestal heated to ${M.ALD.tempC} °C, and the valves pulse ${M.ALD.precursor} (filled dots), purge with ${M.ALD.purge}, pulse ${M.ALD.coreactant} (rings) and purge again. Each cycle adds about ${M.ALD.gpcNm} nm of ${M.ALD.film}, roughly ${Math.round(M.ALD.monolayerShare * 100)}% of a monolayer, so about ${Math.round(M.cyclesPerNm)} cycles make a nanometre. Plan sizes follow the ruler (100 mm ticks); heights, the showerhead gap and the film thickness are exaggerated, chamber layout is illustrative, and the slider's step lengths are proportions, not seconds.`;
const scrub = `<span class="dz-scrub"><button type="button" class="dz-play" data-play aria-label="Play the run"><span class="dz-play-icon" aria-hidden="true"></span><span data-play-text>Play</span></button><input type="range" class="dz-range" data-scrub min="0" max="1000" step="1" value="0" aria-label="Process: 0 is the wafer in the load lock, 1000 is ${M.CYCLES} ALD cycles done"><span class="dz-step" data-step>${SEGS[0].label}</span></span>`;
const body = `<figure class="iso-figure dz"><div class="iso-plate">${corners}${stage}${controls}</div><figcaption class="iso-legend">${scrub}<span class="dz-parts">${PARTS}</span><span class="iso-caption">${caption}</span></figcaption></figure>`;

const CSS = readFileSync(join(HERE, "deposition.css"), "utf8");
const RIG_SRC = readFileSync(join(HERE, "rig.mjs"), "utf8").replace(/^export /gm, "");
const LIVE = kitScript() + "\n" + RIG_SRC + "\n" + readFileSync(join(HERE, "live.js"), "utf8").replace("__DATA__", JSON.stringify(DATA));
const out = writeChapter({ slug: "deposition", figure: body, css: CSS, script: LIVE, lesson: LESSON });
console.log("wrote", out.file, `${out.kb} KB`, `${R.items.length} items`, `${R.solids.length} solids`);

A.auditOrExit(R, P);
