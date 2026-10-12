// A laser TGV station for glass-core substrate panels, with a section display comparing an organic core and a glass core.
// World units are 2 mm (0.5 units per mm) in plan; thin layers (glass, films, dies) are drawn thicker than true.
// node build.mjs [--audit] [--fast]
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as M from "./model.mjs";
import { k, G, A, Tube } from "../../site/kit.mjs";
import { writeChapter } from "../../site/shell.mjs";
import { LESSON } from "./lesson.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const W = 720;
const H = 480;
const AZIMUTH = 58;
const ELEVATION = 33;
const U = 0.5; // world units per mm, in plan

// ---- layout ----
const PLATE = { x: -206, y: -312, w: 652, d: 628, r: 14 }; // widened on +x to carry the section display
const PLATE_H = 14;
const FOOT_H = 7;

// Y axis: two rails and a linear-motor magnet track; the table rides them
const RAIL_X = [-104, 96];
const RAIL = { y0: -296, y1: 296, w: 8, top: 7 };
const TRACK = { x: -16, y: -288, w: 32, d: 576, r: 2 };
const Y_TRAVEL = 140; // table share 1 moves the panel 140 units (280 mm) toward +y

// table, chuck and panel (at share 0 the panel is centred under the bridge)
const CAR = { x: -150, y: -150, w: 300, d: 300, r: 5 };
const CAR_Z = [13, 21];
const CHUCK = { x: -139, y: -141, w: 278, d: 282, r: 3 };
const CHUCK_TOP = 27;
const PANEL = { x: (-M.PANEL.w * U) / 2, y: (-M.PANEL.d * U) / 2, w: M.PANEL.w * U, d: M.PANEL.d * U, r: 1.2 };
const GLASS_TOP = 29; // the glass is drawn 2 units (4 mm) thick: exaggerated
const SITE = M.INTEL.packageMm * U; // 120 units
const STREET = 2.5;
const SITES = [];
for (const sy of [-1, 1]) for (const sx of [-1, 1]) SITES.push({ x: sx < 0 ? -STREET / 2 - SITE : STREET / 2, y: sy < 0 ? -STREET / 2 - SITE : STREET / 2, w: SITE, d: SITE, r: 0.6 });
const VIA_PITCH = 13; // drawn pitch: illustrative (the real pitch is under 100 µm)
const NV = M.DRAWN.viasPerSide;

// bridge (static): two uprights and a beam along x; the laser head runs on the beam's +y face
const UPRIGHT_X = [-181, 163];
const UPRIGHT = { w: 18, y: -38, d: 30 };
const BEAM = { x: -196, y: -36, w: 392, d: 28, r: 2 };
const BEAM_Z = [104, 128];
const BY = 7; // the laser beam's y; the panel row being written sits here
const HX = 130; // head share 1 moves the head 130 units toward +x
const HEAD_PARK = -1.15;
const NOZZLE_Z = 35;

// controller cabinet (static, back right) and the section display (static, front right)
const CAB = { x: 318, y: -272, w: 74, d: 72, r: 3 };
const CAB_TOP = 96;
const JBOX = { x: 181, y: -30, w: 7, d: 16, r: 1 };
const JBOX_Z = [26, 42];
// enlarged section models, front right: two epoxy-mounted cross-sections on a plinth
const PLINTH = { x: 190, y: 190, w: 242, d: 100, r: 3 };
const PLINTH_TOP = 10;
const COUPON_D = 28;
const COUPON_H = 84;
const COUPONS = [
  { id: "organic", x: 198, y: 200, w: 108, d: COUPON_D, r: 0.6 },
  { id: "glass", x: 316, y: 200, w: 108, d: COUPON_D, r: 0.6 },
];

const MOVES = { stand: [0, 0, 0], table: [0, Y_TRAVEL, 0], head: [HX, 0, 0] };

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), ...k.boxCorners(BEAM, BEAM_Z[0], 160), ...k.boxCorners(CAB, 0, CAB_TOP + 34)],
  W,
  H,
  { pad: 14, azimuth: AZIMUTH, elevation: ELEVATION },
);
const V = G.viewOf(P);
const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const centreOf = (plan, z) => [plan.x + plan.w / 2, plan.y + plan.d / 2, z];
const f1 = (n) => Math.round(n * 100) / 100;

const R = A.recorder(P, { order: ["table", "head"], spring: {} });
function put(piece, part, ref, svg, shapes, { bias = 0, name } = {}) {
  const id = name ?? R.nameFor(`${piece === "stand" ? "stand" : piece}.${part}`);
  shapes.forEach((shape) => (shape.name = shape.name ?? id));
  return R.put({ piece, part, at: ref, bias, svg, move: MOVES[piece], shapes: shapes.map(R.solid), name: id });
}
function puck(x, y, r, z, h, style = {}, { steps, bevel = 0, inner = "" } = {}) {
  return { svg: S(k.cylinder(x, y, r, z, h, P, steps ?? Math.max(20, Math.round(r * 2.4)), bevel), { tone: "mid", ...style, inner }), shape: A.cylinder(x, y, r, z, h, {}) };
}
function box(plan, z, h, style = {}, { steps = 3, bevel = 0, inner = "" } = {}) {
  return { svg: S(k.slabOf(plan, z, h, P, steps, bevel), { tone: "mid", ...style, inner }), shape: A.slab(plan, z, h, {}, steps) };
}
const seam = (plan, z, steps = 3) => L(k.sideSeam(plan, z, P, steps), { tone: "faint" });
const screwDots = (pts, z, size = 0.45) => Dots(pts.map(([x, y]) => at([x, y, z])), { size });

// ---- base: plate on feet, groove, screws, ruler, label plate ----
function base() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  const shapes = [];
  for (const [x, y] of byDepth(k.corners(PLATE, 32))) {
    out.push(S(k.cylinder(x, y, 11, -PLATE_H - FOOT_H, 2, P, 32), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 8, -PLATE_H - FOOT_H + 2, FOOT_H - 2, P, 28), { tone: "mid" }));
    shapes.push(A.cylinder(x, y, 11, -PLATE_H - FOOT_H, FOOT_H, {}));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid", inner: L(k.sideSeam(PLATE, -PLATE_H + 4, P, 8), { tone: "faint" }) }));
  shapes.push(A.slab(PLATE, -PLATE_H, PLATE_H, {}));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 7), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 15);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.8, 0, P, 16)).join(""), { tone: "lo" }), screwDots(screws, 0, 0.5));
  // ruler strip along the front (+y) edge: 10 mm minor ticks (5 units), 50 mm majors
  const strip = { x: -196, y: PLATE.y + PLATE.d - 24, w: 186, d: 9, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 3, strip.x + strip.w - 3, 10 * U, 5, strip.y + 0.8, 0.6, [2.4, 4.4], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(Dots([at([strip.x + 1.6, strip.y + 4.5, 0.6]), at([strip.x + strip.w - 1.6, strip.y + 4.5, 0.6])], { size: 0.45 }));
  // label plate
  const label = { x: 4, y: PLATE.y + PLATE.d - 32, w: 88, d: 20, r: 1.5 };
  out.push(S(k.slabOf(label, 0, 0.8, P, 4), { tone: "lo", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.8), 0.8, P, 4), { tone: "faint" }));
  out.push(L([0, 1, 2].map((i) => k.lineOnTop([label.x + 9, label.y + 5.8 + i * 3.8], [label.x + 70 - i * 17, label.y + 5.8 + i * 3.8], 0.8, P)).join(""), { tone: "lo", free: true }));
  out.push(Dots([at([label.x + 4.5, label.y + label.d / 2, 0.8]), at([label.x + label.w - 4.5, label.y + label.d / 2, 0.8])], { size: 0.45 }));
  put("stand", "base", [0, 0, -1], out.join(""), shapes, { name: "stand.base", bias: -4000 });
}

// ---- Y axis: rails with end stops, magnet track, cable duct ----
function yAxis() {
  for (const x of RAIL_X) {
    const plan = { x, y: RAIL.y0, w: RAIL.w, d: RAIL.y1 - RAIL.y0, r: 1 };
    const rail = box(plan, 0, RAIL.top, {}, { steps: 2, bevel: 0.3, inner: seam(plan, 3, 2) });
    const bolts = [];
    for (let y = RAIL.y0 + 10; y < RAIL.y1; y += 24) bolts.push([x + RAIL.w / 2, y]);
    put("stand", "table", [x + 4, 0, 3], rail.svg + screwDots(bolts, RAIL.top, 0.4), [rail.shape], { name: R.nameFor("stand.rail") });
    for (const y of [RAIL.y0 - 8, RAIL.y1]) {
      const stop = box({ x: x - 3, y, w: RAIL.w + 6, d: 8, r: 1 }, 0, 12, {}, { steps: 2, bevel: 0.4 });
      put("stand", "table", [x + 4, y + 4, 6], stop.svg + screwDots([[x + RAIL.w / 2, y + 4]], 12, 0.5), [stop.shape], { name: R.nameFor("stand.stop") });
    }
  }
  const track = box(TRACK, 0, 3, { tone: "lo" }, { steps: 3, bevel: 0.3 });
  const magnets = [];
  for (let y = TRACK.y + 8; y < TRACK.y + TRACK.d - 4; y += 12) magnets.push(k.planOutline({ x: TRACK.x + 4, y, w: TRACK.w - 8, d: 7, r: 1 }, 3, P, 2));
  put("stand", "table", [0, 0, 1.5], track.svg + L(magnets.join(""), { tone: "faint" }), [track.shape], { name: "stand.track" });
}

// ---- the table: bearing blocks, carriage, chuck, locating pins, panel, chiplets ----
function table() {
  for (const x of RAIL_X) {
    for (const y of [-130, 100]) {
      const plan = { x: x - 4, y, w: RAIL.w + 8, d: 30, r: 1.5 };
      const b = box(plan, RAIL.top, CAR_Z[0] - RAIL.top, {}, { steps: 2, bevel: 0.3, inner: seam(plan, RAIL.top + 3, 2) });
      put("table", "table", [x + 4, y + 15, 10], b.svg + screwDots([[x, y + 4], [x + RAIL.w, y + 4]], CAR_Z[0], 0.4), [b.shape], { name: R.nameFor("table.bearing") });
    }
  }
  const coil = { x: -14, y: -40, w: 28, d: 80, r: 2 };
  const c = box(coil, 4, CAR_Z[0] - 4, {}, { steps: 2, bevel: 0.3 });
  put("table", "table", [0, 0, 8], c.svg, [c.shape], { name: "table.forcer" });
  const car = box(CAR, CAR_Z[0], CAR_Z[1] - CAR_Z[0], {}, { steps: 6, bevel: 0.8, inner: seam(CAR, CAR_Z[0] + 3, 6) });
  const carScrews = k.corners(CAR, 6);
  put("table", "table", [0, 0, CAR_Z[0] + 4], car.svg + screwDots(carScrews, CAR_Z[1], 0.5), [car.shape], { name: "table.carriage" });
  // vacuum chuck: a ceramic plate with a porous field and a ring groove
  const chuck = box(CHUCK, CAR_Z[1], CHUCK_TOP - CAR_Z[1], {}, { steps: 4, bevel: 0.5, inner: seam(CHUCK, CAR_Z[1] + 2, 4) });
  const pores = [];
  for (let x = CHUCK.x + 4; x < CHUCK.x + CHUCK.w; x += 6) for (let y = CHUCK.y + 4; y < CHUCK.y + CHUCK.d; y += 6) {
    const inside = x > PANEL.x - 1 && x < PANEL.x + PANEL.w + 1 && y > PANEL.y - 1 && y < PANEL.y + PANEL.d + 1;
    if (!inside) pores.push(at([x, y, CHUCK_TOP]));
  }
  const groove = L(k.planOutline(k.insetPlan(CHUCK, 2.4), CHUCK_TOP, P, 4), { tone: "lo" });
  // vacuum port and hose stub on the carriage's +x face
  put("table", "table", [0, 0, CHUCK_TOP - 3], chuck.svg + groove + Dots(pores, { size: 0.28, tone: "lo" }), [chuck.shape], { name: "table.chuck" });
  const port = box({ x: CAR.x + CAR.w, y: 40, w: 6, d: 14, r: 1 }, CAR_Z[0] + 1, 6, {}, { steps: 2, bevel: 0.2 });
  const valve = puck(CAR.x + CAR.w + 3, 47, 2.6, CAR_Z[0] + 7, 4, {}, { steps: 16 });
  put("table", "table", [CAR.x + CAR.w + 3, 47, CAR_Z[0] + 4], port.svg + valve.svg + L(k.knurl(CAR.x + CAR.w + 3, 47, 2.6, CAR_Z[0] + 7.4, CAR_Z[0] + 10.6, 12, P), { tone: "lo" }), [port.shape, valve.shape], { name: "table.vacport" });
  // three locating pins: two on the -x edge, one on the -y edge, the panel pushed against them
  for (const [x, y] of [[PANEL.x - 2.6, -70], [PANEL.x - 2.6, 70], [-60, PANEL.y - 2.6]]) {
    const pin = puck(x, y, 2.4, CHUCK_TOP, 4, { tone: "mid" }, { steps: 16, bevel: 0.3 });
    put("table", "table", [x, y, CHUCK_TOP + 2], pin.svg, [pin.shape], { name: R.nameFor("table.pin") });
  }
  // two pushers on the +x and +y edges
  for (const [plan, dot] of [[{ x: PANEL.x + PANEL.w + 0.2, y: -12, w: 7, d: 24, r: 1 }, [PANEL.x + PANEL.w + 3.7, 0]], [{ x: 50, y: PANEL.y + PANEL.d + 0.2, w: 24, d: 7, r: 1 }, [62, PANEL.y + PANEL.d + 3.7]]]) {
    const p = box(plan, CHUCK_TOP, 3.4, {}, { steps: 2, bevel: 0.3 });
    put("table", "table", centreOf(plan, CHUCK_TOP + 1.7), p.svg + screwDots([dot], CHUCK_TOP + 3.4, 0.45), [p.shape], { name: R.nameFor("table.pusher") });
  }
}

// the glass panel and everything the process puts on it, drawn in one item so it moves with the table
const VIAS = [];
function panel() {
  const glass = box(PANEL, CHUCK_TOP, GLASS_TOP - CHUCK_TOP, { tone: "hi", crease: "lo" }, { steps: 3, bevel: 0.3 });
  // corner fiducials (laser marks used for alignment at every later step)
  const fids = [[PANEL.x + 4, PANEL.y + 4], [PANEL.x + PANEL.w - 4, PANEL.y + 4], [PANEL.x + 4, PANEL.y + PANEL.d - 4], [PANEL.x + PANEL.w - 4, PANEL.y + PANEL.d - 4]];
  const fidSvg = L(fids.map(([x, y]) => k.ring(x, y, 1.6, GLASS_TOP, P, 16)).join(""), { tone: "lo" }) + Dots(fids.map(([x, y]) => at([x, y, GLASS_TOP])), { size: 0.45, tone: "mid" });
  // vias: every site gets NV x NV, written in rows; each is an ellipse the page restyles by state
  const kk = P.scale * Math.sqrt(1.6);
  const sinE = Math.sin((ELEVATION * Math.PI) / 180);
  const rr = 1.7;
  const viaEls = [];
  SITES.forEach((site, si) => {
    const cx = site.x + site.w / 2;
    const cy = site.y + site.d / 2;
    for (let j = 0; j < NV; j++) for (let i = 0; i < NV; i++) {
      const x = cx + (i - (NV - 1) / 2) * VIA_PITCH;
      const y = cy + (j - (NV - 1) / 2) * VIA_PITCH;
      const [sx, sy] = at([x, y, GLASS_TOP]);
      VIAS.push({ x: f1(x), y: f1(y), site: si });
      viaEls.push(`<ellipse class="gs-via" cx="${f1(sx)}" cy="${f1(sy)}" rx="${f1(rr * kk)}" ry="${f1(rr * kk * sinE)}"/>`);
    }
  });
  // build-up film per site, with RDL traces that end on pads, three layers
  const films = SITES.map((site, si) => {
    const film = k.insetPlan(site, 2);
    const outline = k.planOutline(film, GLASS_TOP, P, 2);
    const layers = [];
    for (let layer = 0; layer < M.INTEL.rdl; layer++) {
      const lines = [];
      const pads = [];
      const n = 7;
      for (let t = 0; t < n; t++) {
        const off = -45 + (t * 90) / (n - 1) + layer * 4;
        const cx = film.x + film.w / 2;
        const cy = film.y + film.d / 2;
        let a;
        let b;
        if (layer === 0) [a, b] = [[cx - 52, cy + off], [cx - 30, cy + off]];
        else if (layer === 1) [a, b] = [[cx + off, cy + 30], [cx + off, cy + 52]];
        else [a, b] = [[cx + 30, cy + off - 2], [cx + 52, cy + off - 2]];
        lines.push(k.lineOnTop(a, b, GLASS_TOP, P));
        pads.push(at([...a, GLASS_TOP]), at([...b, GLASS_TOP]));
      }
      layers.push(`<g class="gs-rdl" data-layer="${layer}">${L(lines.join(""), { tone: "lo" })}${Dots(pads, { size: 0.55, tone: "mid" })}</g>`);
    }
    // the bump field under the chiplets: pads in the middle of the site
    const bumps = [];
    for (let x = -28; x <= 28; x += 4) for (let y = -24; y <= 24; y += 4) bumps.push(at([film.x + film.w / 2 + x, film.y + film.d / 2 + y, GLASS_TOP]));
    return `<g class="gs-film" data-site="${si}"><path class="gs-film-fill" d="${k.pathOf(planRing(film), true)}"/>${L(outline, { tone: "lo" })}${layers.join("")}<g class="gs-bumps">${Dots(bumps, { size: 0.3, tone: "lo" })}</g></g>`;
  });
  // singulation kerfs: two lines per street, edge to edge of the panel
  const kp = (d) => `<path class="iso-line" data-tone="lo" pathLength="1" d="${d}"/>`;
  const kx = [-0.6, 0.6].map((d) => kp(k.lineOnTop([PANEL.x, d], [PANEL.x + PANEL.w, d], GLASS_TOP, P))).join("");
  const ky = [-0.6, 0.6].map((d) => kp(k.lineOnTop([d, PANEL.y], [d, PANEL.y + PANEL.d], GLASS_TOP, P))).join("");
  const kerfSvg = `<g class="gs-kerf" data-kerf="x">${kx}</g><g class="gs-kerf" data-kerf="y">${ky}</g>`;
  // the wet front during etch and fill: a band across the panel, positioned live
  const svg = `<g data-panel>${glass.svg}${fidSvg}<g class="gs-vias" data-vias>${viaEls.join("")}</g>${films.join("")}${kerfSvg}<path class="gs-wet" data-wet d=""/></g>`;
  put("table", "panel", [0, 0, CHUCK_TOP + 1], svg, [glass.shape], { name: "table.panel" });
}
function planRing(plan, steps = 2) {
  // a rounded rectangle on the top face as projected points, for a fill path
  const pts = [];
  const { x, y, w, d, r } = plan;
  const cs = [[x + w - r, y + r, -90], [x + w - r, y + d - r, 0], [x + r, y + d - r, 90], [x + r, y + r, 180]];
  for (const [cx, cy, a0] of cs) for (let i = 0; i <= steps; i++) {
    const a = ((a0 + (90 * i) / steps) * Math.PI) / 180;
    pts.push(at([cx + r * Math.cos(a), cy + r * Math.sin(a), GLASS_TOP]));
  }
  return pts;
}

// chiplets on each site: reticle-sized compute dies (Intel's ">8x reticle Si") and HBM stacks (count illustrative),
// footprints from model.mjs at 0.5 units per mm
const DIE = { w: M.RETICLE_MM[0] * U, d: M.RETICLE_MM[1] * U };
const HBMF = { w: M.HBM_MM[0] * U, d: M.HBM_MM[1] * U };
const DIES_PER_ROW = M.INTEL.reticles / 2;
const HBM_PER_ROW = M.DRAWN.hbmPerSite / 2;
function chiplets() {
  SITES.forEach((site, si) => {
    const cx = site.x + site.w / 2;
    const cy = site.y + site.d / 2;
    const parts = [];
    for (let i = 0; i < DIES_PER_ROW; i++) for (const row of [-1, 1]) {
      const x = cx - 29 + i * 15;
      const y = row < 0 ? cy - 1 - DIE.d : cy + 1;
      parts.push({ plan: { x, y, w: DIE.w, d: DIE.d, r: 0.4 }, h: 2.2, tone: "hi" });
    }
    for (let i = 0; i < HBM_PER_ROW; i++) for (const row of [-1, 1]) {
      const x = cx - 29 + i * 7.36 + 0.3;
      const y = row < 0 ? cy - 1 - DIE.d - 1.6 - HBMF.d : cy + 1 + DIE.d + 1.6;
      parts.push({ plan: { x, y, w: HBMF.w, d: HBMF.d, r: 0.3 }, h: 2.8, tone: "mid" });
    }
    const z = GLASS_TOP + 0.6;
    const sorted = [...parts].sort((a, b) => k.depthOf(centreOf(a.plan, z), P) - k.depthOf(centreOf(b.plan, z), P));
    let svg = "";
    const shapes = [];
    for (const p of sorted) {
      const under = S(k.slabOf(k.insetPlan(p.plan, -0.3), GLASS_TOP, 0.6, P, 2), { tone: "lo", crease: "none" });
      const body = S(k.slabOf(p.plan, z, p.h, P, 2, 0.25), { tone: p.tone, crease: "lo" });
      svg += under + body;
      shapes.push(A.slab(k.insetPlan(p.plan, -0.3), GLASS_TOP, 0.6, {}, 2), A.slab(p.plan, z, p.h, {}, 2));
    }
    put("table", "panel", [cx, cy, z + 1], `<g class="gs-chips" data-chips="${si}">${svg}</g>`, shapes, { name: `table.chips${si}` });
  });
}

// ---- bridge: uprights on foot blocks, beam, X rails, linear scale, laser source, signal tower ----
function bridge() {
  for (const x of UPRIGHT_X) {
    const foot = { x: x - 6, y: UPRIGHT.y - 6, w: UPRIGHT.w + 12, d: UPRIGHT.d + 12, r: 2 };
    const f = box(foot, 0, 6, {}, { steps: 3, bevel: 0.5 });
    const plan = { x, y: UPRIGHT.y, w: UPRIGHT.w, d: UPRIGHT.d, r: 1.5 };
    const u = box(plan, 6, BEAM_Z[0] - 6, {}, { steps: 3, bevel: 0.4, inner: L([12, 96].map((z) => k.sideSeam(plan, z, P, 3)).join(""), { tone: "faint" }) });
    const pm = k.sideMatrix([x, UPRIGHT.y + UPRIGHT.d], BEAM_Z[0], P, "left");
    const panelSvg = `<g transform="${pm}">${line(rect(3, 40, UPRIGHT.w - 6, 50), "faint")}${[[5, 42], [UPRIGHT.w - 5, 42], [5, 88], [UPRIGHT.w - 5, 88]].map(([cx, cy]) => `<circle class="gs-screw" cx="${cx}" cy="${cy}" r="0.55"/>`).join("")}</g>`;
    put("stand", "bridge", [x + 9, UPRIGHT.y + 15, 50], f.svg + screwDots(k.corners(foot, 3), 6, 0.5) + u.svg + panelSvg, [f.shape, u.shape], { name: R.nameFor("stand.upright") });
  }
  const beam = box(BEAM, BEAM_Z[0], BEAM_Z[1] - BEAM_Z[0], {}, { steps: 3, bevel: 0.8, inner: seam(BEAM, BEAM_Z[0] + 6, 3) });
  // linear scale on the beam top: ticks every 10 mm, majors every 50 mm
  const strip = { x: -150, y: BEAM.y + BEAM.d - 8, w: 300, d: 6, r: 0.6 };
  const ticks = k.topTicks(strip.x + 2, strip.x + strip.w - 2, 10 * U, 5, strip.y + 0.6, BEAM_Z[1] + 0.5, [1.6, 3], P);
  const scale = S(k.slabOf(strip, BEAM_Z[1], 0.5, P, 2), { tone: "lo", crease: "none" }) + L(ticks.minor, { tone: "lo" }) + L(ticks.major, { tone: "mid" });
  const caps = screwDots(UPRIGHT_X.flatMap((x) => [[x + 4, BEAM.y + 5], [x + UPRIGHT.w - 4, BEAM.y + 5]]), BEAM_Z[1], 0.5);
  put("stand", "bridge", [0, BEAM.y + 14, BEAM_Z[0] + 6], beam.svg + scale + caps, [beam.shape], { name: "stand.beam" });
  // two X rails on the beam's +y face
  for (const z of [BEAM_Z[0] + 4, BEAM_Z[1] - 8]) {
    const plan = { x: BEAM.x + 8, y: BEAM.y + BEAM.d, w: BEAM.w - 16, d: 2, r: 0.3 };
    const rail = box(plan, z, 4, {}, { steps: 2 });
    put("stand", "bridge", [0, plan.y + 1, z + 2], rail.svg, [rail.shape], { name: R.nameFor("stand.xrail") });
  }
  // laser source on the beam: housing, cooling fins, beam port block
  const lz = { x: -176, y: BEAM.y + 2, w: 96, d: 22, r: 2 };
  const lh = box(lz, BEAM_Z[1], 20, {}, { steps: 3, bevel: 0.6, inner: seam(lz, BEAM_Z[1] + 14, 3) });
  const fins = [];
  for (let i = 0; i < 9; i++) fins.push(k.planOutline({ x: lz.x + 8 + i * 9, y: lz.y + 4, w: 4, d: lz.d - 8, r: 1.2 }, BEAM_Z[1] + 20, P, 2));
  const lplate = { x: lz.x + lz.w, y: lz.y + 5, w: 10, d: 12, r: 1 };
  const lp = box(lplate, BEAM_Z[1], 12, {}, { steps: 2, bevel: 0.3 });
  const name = k.faceTextSvg(k.topMatrix([lz.x + 52, lz.y + 3.5], BEAM_Z[1] + 20, P, "x"), "LIDE", { size: 2.8, tone: "lo", anchor: "middle" });
  put("stand", "bridge", [lz.x + 50, lz.y + 11, BEAM_Z[1] + 10], lh.svg + L(fins.join(""), { tone: "faint" }) + screwDots(k.corners(lz, 3), BEAM_Z[1] + 20) + lp.svg + name, [lh.shape, lp.shape], { name: "stand.laser" });
  // signal tower on the right end of the beam
  {
    const [lx, ly] = [150, BEAM.y + 10];
    let z = BEAM_Z[1];
    const lamp = [];
    const shapes = [];
    for (const [r, h, tone, extra] of [[4.6, 1.6, "mid", {}], [1.6, 7, "mid", { crease: "none" }], [3.6, 4.4, "lo", {}], [3.6, 4.4, "mid", {}], [3.6, 4.4, "hi", { crease: "lo" }], [3.9, 1.4, "mid", {}]]) {
      const p = puck(lx, ly, r, z, h, { tone, ...extra }, { steps: 20 });
      lamp.push(p.svg);
      shapes.push(p.shape);
      z += h;
    }
    put("stand", "bridge", [lx, ly, BEAM_Z[1] + 10], `<g data-lamp>${lamp.join("")}</g>`, shapes, { name: "stand.lamp" });
  }
  // junction box on the right upright, fed from the cabinet
  const jb = box(JBOX, JBOX_Z[0], JBOX_Z[1] - JBOX_Z[0], {}, { steps: 2, bevel: 0.3, inner: seam(JBOX, JBOX_Z[1] - 3, 2) });
  put("stand", "bridge", centreOf(JBOX, 34), jb.svg + screwDots([[JBOX.x + JBOX.w / 2, JBOX.y + 3], [JBOX.x + JBOX.w / 2, JBOX.y + JBOX.d - 3]], JBOX_Z[1], 0.4), [jb.shape], { name: "stand.jbox" });
}

// ---- laser head (built at x = 0): carriage on the X rails, Z block, servo, optics, nozzle, camera ----
function head() {
  const carPlan = { x: -22, y: BEAM.y + BEAM.d + 2, w: 44, d: 5, r: 1 };
  const car = box(carPlan, 92, BEAM_Z[1] - 92, {}, { steps: 2, bevel: 0.4, inner: seam(carPlan, 116, 2) });
  put("head", "head", [0, carPlan.y + 2.5, 110], car.svg + screwDots([[-18, carPlan.y + 2.5], [18, carPlan.y + 2.5]], BEAM_Z[1], 0.45), [car.shape], { name: "head.carriage" });
  const zb = { x: -14, y: carPlan.y + carPlan.d, w: 28, d: 17, r: 2 };
  const zbH = box(zb, 64, 36, {}, { steps: 3, bevel: 0.5, inner: L([72, 92].map((z) => k.sideSeam(zb, z, P, 3)).join(""), { tone: "faint" }) });
  const zTop = L(k.planOutline(k.insetPlan(zb, 3), 100, P, 3), { tone: "lo" });
  put("head", "head", centreOf(zb, 82), zbH.svg + zTop + screwDots(k.corners(zb, 2.6), 100), [zbH.shape], { name: "head.zblock" });
  // focus servo on top of the Z block
  const [ox, oy] = [0, BY];
  const servo = puck(ox, oy, 6.2, 100, 12, {}, { steps: 28, bevel: 0.4, inner: L([104, 108].map((z) => k.sideArc(ox, oy, 6.2, z, P, 20)).join(""), { tone: "faint" }) });
  const servoCap = puck(ox, oy, 4.2, 112, 2, {}, { steps: 20, bevel: 0.3 });
  put("head", "head", [ox, oy, 106], servo.svg + servoCap.svg, [servo.shape, servoCap.shape], { name: "head.servo" });
  // optics: lens tube, knurled focus ring, objective, nozzle
  const tubeLo = puck(ox, oy, 6.4, 44, 4, {}, { steps: 32 });
  const tube = puck(ox, oy, 6.4, 53, 11, {}, { steps: 32, inner: L(k.sideArc(ox, oy, 6.4, 58, P, 24), { tone: "faint" }) });
  const ring = puck(ox, oy, 8, 48, 5, { tone: "mid" }, { steps: 36, bevel: 0.4 });
  const obj = puck(ox, oy, 4.6, 39, 5, { tone: "hi", crease: "lo" }, { steps: 24, bevel: 0.3 });
  const tip = puck(ox, oy, 2.4, NOZZLE_Z, 4, { tone: "mid" }, { steps: 16 });
  // the beam and its spot, shown live while the laser fires
  const beam = `<g class="gs-beam" data-beam><path class="iso-line" data-tone="lit" stroke-width="1.4" d="M${f1(at([ox, oy, NOZZLE_Z])[0])} ${f1(at([ox, oy, NOZZLE_Z])[1])}L${f1(at([ox, oy, GLASS_TOP])[0])} ${f1(at([ox, oy, GLASS_TOP])[1])}"/>${Dots([at([ox, oy, GLASS_TOP])], { size: 1.1, tone: "lit" })}</g>`;
  put("head", "head", [ox, oy, 50], beam + tip.svg + obj.svg + tubeLo.svg + ring.svg + L(k.knurl(ox, oy, 8, 48.4, 52.6, 36, P), { tone: "lo" }) + tube.svg, [tip.shape, obj.shape, tubeLo.shape, ring.shape, tube.shape], { name: "head.optics" });
  // alignment camera beside the optics, on a bracket from the Z block
  const brk = { x: 14, y: oy - 3, w: 8, d: 6, r: 0.8 };
  const b = box(brk, 66, 6, {}, { steps: 2, bevel: 0.2 });
  const cam = puck(18, oy, 3.6, 50, 16, {}, { steps: 20, inner: L(k.sideArc(18, oy, 3.6, 60, P, 16), { tone: "faint" }) });
  const lens = puck(18, oy, 2.8, 47, 3, { tone: "hi", crease: "lo" }, { steps: 16 });
  put("head", "head", [18, oy, 58], lens.svg + cam.svg + b.svg, [lens.shape, cam.shape, b.shape], { name: "head.camera" });
}

// ---- controller cabinet, its cable to the bridge ----
function cabinet() {
  const plinth = { x: CAB.x - 3, y: CAB.y - 3, w: CAB.w + 6, d: CAB.d + 6, r: 4 };
  const pl = box(plinth, 0, 5, { tone: "mid" }, { steps: 3, bevel: 0.5 });
  const body = box(CAB, 5, CAB_TOP - 5, {}, { steps: 3, bevel: 0.6, inner: L([20, CAB_TOP - 14].map((z) => k.sideSeam(CAB, z, P, 3)).join(""), { tone: "faint" }) });
  // vent slots on the top
  const slots = [];
  for (let i = 0; i < 6; i++) slots.push(k.planOutline({ x: CAB.x + 10 + i * 9, y: CAB.y + 14, w: 4, d: 42, r: 1.6 }, CAB_TOP, P, 2));
  // door, HMI screen and buttons on the +y face; a vent grille on the +x face (all closed outlines, in the face planes)
  const doorM = k.sideMatrix([CAB.x, CAB.y + CAB.d], CAB_TOP, P, "left");
  const btns = [0, 1, 2].map((i) => `<circle class="iso-line" data-tone="lo" cx="${50 + i * 6}" cy="22" r="1.6"/>`).join("");
  const door = `<g transform="${doorM}">${line(rect(4, 9, CAB.w - 8, CAB_TOP - 22), "faint")}${line(rect(9, 14, 34, 21), "lo")}${fill(rect(11, 16, 30, 17), "gs-screen")}${btns}</g>`;
  const sideM = k.sideMatrix([CAB.x + CAB.w, CAB.y + CAB.d], CAB_TOP, P, "right");
  const vents = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) vents.push(line(`M${12 + c * 18} ${44 + r * 7}h12a1 1 0 0 1 0 2h-12a1 1 0 0 1 0 -2Z`, "faint"));
  const side = `<g transform="${sideM}">${vents.join("")}</g>`;
  put("stand", "cabinet", centreOf(CAB, 40), pl.svg + body.svg + door + side + L(slots.join(""), { tone: "faint" }) + screwDots(k.corners(CAB, 4), CAB_TOP, 0.45), [pl.shape, body.shape], { name: "stand.cabinet" });
  // door handle on the +y face
  const hp = { x: CAB.x + CAB.w - 14, y: CAB.y + CAB.d, w: 6, d: 3, r: 0.8 };
  const handle = box(hp, 40, 26, {}, { steps: 2, bevel: 0.3 });
  put("stand", "cabinet", centreOf(hp, 53), handle.svg, [handle.shape], { name: "stand.handle" });
  // emergency stop on top
  const es = puck(CAB.x + CAB.w - 14, CAB.y + 8, 4.6, CAB_TOP, 2.4, {}, { steps: 24, bevel: 0.3 });
  const knob = puck(CAB.x + CAB.w - 14, CAB.y + 8, 3.4, CAB_TOP + 2.4, 3, { tone: "hi", crease: "lo" }, { steps: 24, bevel: 0.4 });
  put("stand", "cabinet", [CAB.x + CAB.w - 14, CAB.y + 8, CAB_TOP + 2], es.svg + knob.svg, [es.shape, knob.shape], { name: "stand.estop" });
  // cable gland on the -x face and the cable along the floor to the junction box
  const glandY = CAB.y + 40;
  const Fg = G.frameOf([CAB.x, glandY, 12], [-1, 0, 0], [0, 1, 0], [0, 0, 1]);
  const gland = S(G.disc(0, 3, 3.2, Fg, P, { bevel: 0.3 }), { tone: "mid" });
  put("stand", "cabinet", [CAB.x - 1.5, glandY, 12], gland, [A.disc(Fg, 0, 3, 3.2, {})], { name: "stand.gland" });
  const jx = JBOX.x + JBOX.w / 2;
  const jy = JBOX.y + JBOX.d / 2;
  const route = G.fillet([[CAB.x - 3, glandY, 12], [jx + 14, glandY, 12], [jx + 14, jy, 12], [jx, jy, 12], [jx, jy, JBOX_Z[0]]], 5, 8, { P, tube: 1.2 });
  const id = "stand.cable";
  R.route(id, route, 1.2, { piece: "stand", move: [0, 0, 0], limp: true });
  Tube.tubePieces(route, 1.2, P, { maxLength: 30 }).forEach((chunk, index) => put("stand", "cabinet", chunk.mid, Tube.tubeSvg(chunk, { tone: "mid" }), [A.tube(chunk.points, chunk.radii, { owner: id, limp: true })], { name: `${id}:${index}` }));
}

// ---- section display: two enlarged, epoxy-mounted cross-sections of finished substrates, read on their +y faces ----
// Organic (left): a woven glass-cloth core with a few wide plated holes; it bows (exaggerated) against the straight datum,
// and its build-up vias drift off the core vias layer by layer. Glass (right): flat on the datum, ten filled hourglass
// TGVs in the same width, build-up vias stacked true. All geometry here is illustrative.
const SEC = { margin: 13, layer: 5, layers: 3, core: 36, bow: 6.5, drift: 1.7, f: 1.5 }; // f scales via widths
function coupons() {
  const pl = box(PLINTH, 0, PLINTH_TOP, {}, { steps: 4, bevel: 0.6, inner: seam(PLINTH, 4, 4) });
  const groove = L(k.planOutline(k.insetPlan(PLINTH, 3), PLINTH_TOP, P, 4), { tone: "lo" });
  // name strips on the plinth front, one under each mount
  const strips = COUPONS.map((c) => {
    const lab = { x: c.x + 14, y: c.y + COUPON_D + 12, w: c.w - 28, d: 12, r: 1 };
    const text = k.faceTextSvg(k.topMatrix([lab.x + lab.w / 2, lab.y + 8.2], PLINTH_TOP + 0.6, P, "x"), c.id === "glass" ? "GLASS CORE" : "ORGANIC CORE", { size: 6, tone: "mid", anchor: "middle" });
    return S(k.slabOf(lab, PLINTH_TOP, 0.6, P, 2), { tone: "lo", crease: "none" }) + text + screwDots([[lab.x + 2.4, lab.y + lab.d / 2], [lab.x + lab.w - 2.4, lab.y + lab.d / 2]], PLINTH_TOP + 0.6, 0.4);
  }).join("");
  put("stand", "coupons", centreOf(PLINTH, 5), pl.svg + groove + strips + screwDots(k.corners(PLINTH, 4), PLINTH_TOP, 0.45), [pl.shape], { name: "stand.plinth" });
  const faceY = COUPONS[0].y + COUPON_D;
  const z0 = PLINTH_TOP;
  const z1 = z0 + COUPON_H;
  for (const c of COUPONS) {
    const body = box(c, z0, COUPON_H, { tone: "mid", crease: "lo" }, { steps: 2, bevel: 0.3 });
    const face = sectionFace(c.w, c.id === "organic");
    const m = k.sideMatrix([c.x, faceY], z1, P, "left");
    put("stand", "coupons", centreOf(c, z0 + COUPON_H / 2), body.svg + `<g transform="${m}" class="gs-face" data-face="${c.id}">${face}</g>`, [body.shape], { name: `stand.coupon-${c.id}` });
  }
}
// face-plane helpers: local u along x (0..w), v down from the top (0..COUPON_H); every mark is a closed shape
const rect = (u, v, w, h) => `M${f1(u)} ${f1(v)}h${f1(w)}v${f1(h)}h${f1(-w)}Z`;
const line = (d, tone, cls = "") => `<path class="iso-line ${cls}" data-tone="${tone}" d="${d}"/>`;
const fill = (d, cls) => `<path class="${cls}" d="${d}"/>`;
// a band between v0 and v1 that sags by `sag` at mid-width (a quadratic, control point at twice the sag)
const band = (w, v0, v1, sag) => (sag ? `M0 ${f1(v0)}Q${f1(w / 2)} ${f1(v0 + 2 * sag)} ${f1(w)} ${f1(v0)}L${f1(w)} ${f1(v1)}Q${f1(w / 2)} ${f1(v1 + 2 * sag)} 0 ${f1(v1)}Z` : rect(0, v0, w, v1 - v0));
function sectionFace(w, organic) {
  const bowAt = (u) => (organic ? SEC.bow * (1 - ((2 * u) / w - 1) ** 2) : 0);
  const sag = organic ? SEC.bow : 0;
  const bt = SEC.layer * SEC.layers; // one build-up stack
  const top = SEC.margin; // top of the sample at its edges
  const coreTop = top + bt;
  const coreBot = coreTop + SEC.core;
  const bottom = coreBot + bt;
  let s = "";
  // the datum: a straight reference bar along the top of the mount, the same on both, so the bow reads against it
  s += fill(rect(0, top - 3.2, w, 1.6), "gs-datum") + line(rect(0, top - 3.2, w, 1.6), "mid");
  // build-up stacks top and bottom, one band per layer
  for (const v0 of [top, coreBot]) for (let i = 0; i < SEC.layers; i++) {
    const a = v0 + i * SEC.layer;
    s += fill(band(w, a, a + SEC.layer, sag), "gs-film-sec") + line(band(w, a, a + SEC.layer, sag), "faint");
  }
  // the core
  s += fill(band(w, coreTop, coreBot, sag), organic ? "gs-core-org" : "gs-core-gl") + line(band(w, coreTop, coreBot, sag), "lo");
  if (organic) {
    // woven glass-cloth bundles: three plies of closed ellipses riding the bow
    for (const [ply, v] of [[0, coreTop + 7], [1, coreTop + 18], [2, coreTop + 29]]) for (let u = 4 + (ply % 2) * 3.8; u < w - 3.5; u += 7.6) s += `<ellipse class="iso-line gs-fibre" data-tone="faint" cx="${f1(u)}" cy="${f1(v + bowAt(u))}" rx="3" ry="1.4"/>`;
  }
  // core vias: plated through-holes on organic at sqrt(10) times the glass pitch, hourglass TGVs on glass
  const n = organic ? M.DRAWN.organicVias : M.DRAWN.glassVias;
  const glassPitch = (w - 12) / (M.DRAWN.glassVias - 1);
  const pitch = organic ? glassPitch * M.pitchRatio : glassPitch;
  const start = (w - (n - 1) * pitch) / 2;
  for (let i = 0; i < n; i++) {
    const u = start + i * pitch;
    const b = bowAt(u);
    const t = coreTop + b;
    const d = coreBot + b;
    if (organic) {
      const F = SEC.f;
      s += fill(rect(u - 2.6 * F, t, 5.2 * F, SEC.core), "gs-cu") + fill(rect(u - 1.4 * F, t, 2.8 * F, SEC.core), "gs-plug") + line(rect(u - 2.6 * F, t, 5.2 * F, SEC.core), "mid");
    } else {
      const m = (t + d) / 2;
      const [a, b2] = [1.4 * SEC.f, 0.8 * SEC.f];
      const hg = `M${f1(u - a)} ${f1(t)}L${f1(u + a)} ${f1(t)}L${f1(u + b2)} ${f1(m)}L${f1(u + a)} ${f1(d)}L${f1(u - a)} ${f1(d)}L${f1(u - b2)} ${f1(m)}Z`;
      s += fill(hg, "gs-cu") + line(hg, "mid");
    }
    // capture pads on both core faces, then a stacked microvia per build-up layer: on organic each layer lands a
    // little further off (overlay drift as the core moves), on glass they stack straight
    const padW = (organic ? 7.4 : 3.6) * SEC.f;
    for (const side of [-1, 1]) {
      const face = side < 0 ? t : d;
      s += fill(rect(u - padW / 2, side < 0 ? face - 1 : face, padW, 1), "gs-cu");
      for (let L1 = 0; L1 < SEC.layers; L1++) {
        const off = organic ? SEC.drift * (L1 + 1) : 0;
        const vv = side < 0 ? face - (L1 + 1) * SEC.layer : face + L1 * SEC.layer;
        const vw = (organic ? 2.6 : 1.8) * SEC.f;
        s += fill(rect(u + off - vw / 2, vv + 0.6, vw, SEC.layer - 1.2), "gs-cu");
      }
    }
  }
  // gap marker on the organic: a short closed bracket from the datum down to the sagging top at mid-width
  if (organic) s += fill(rect(w / 2 - 0.6, top - 1.6, 1.2, SEC.bow + 1.6), "gs-gap") + line(rect(w / 2 - 0.6, top - 1.6, 1.2, SEC.bow + 1.6), "lo");
  return s;
}

base();
yAxis();
table();
panel();
chiplets();
bridge();
head();
cabinet();
coupons();

// the poses the machine really takes: the table across its travel, the head across its travel and parked
const STATES = [];
for (const t of [-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1]) for (const h of [HEAD_PARK, -1.05, -0.9, -0.45, 0, 0.45, 0.9, 1.05]) STATES.push({ label: `t${t} h${h}`, shares: { table: t, head: h, stand: 0 } });

if (!process.argv.includes("--fast")) A.settle(R, P, { states: STATES });
R.items.sort((a, b) => a.key - b.key);
const groups = R.items.map((item, index) => {
  const [mx, my, mz] = item.move;
  return `<g class="gs-it" data-piece="${item.piece}" data-part="${item.part}" data-k="${item.key.toFixed(2)}" data-m="${mx},${my},${mz}" data-i="${index}">${item.svg}</g>`;
});

const LABEL = `A laser station for glass-core substrate panels. A ${M.PANEL.w} by ${M.PANEL.d} millimetre glass panel lies on a vacuum chuck on a table that slides on two rails under a granite bridge; a laser head runs along the bridge and writes one pulse at each via site. Behind on the right, a controller cabinet. In front on a small stand, two enlarged substrate sections: an organic core that bows below a straight datum bar, with a few wide plated holes and build-up vias that drift off target, and a flat glass core with ten fine hourglass-shaped vias stacked straight.`;
const svg = k.figureSvg({ width: W, height: H, label: LABEL, body: [`<g class="gs-layers">${groups.join("")}</g>`], className: "gs-svg" });

const vec = (v) => {
  const o = at([0, 0, 0]);
  const p = at(v);
  return [p[0] - o[0], p[1] - o[1]];
};
const PARTS_ORDER = ["head", "bridge", "panel", "table", "coupons", "cabinet"];
const DATA = {
  V,
  EX: vec([1, 0, 0]),
  EY: vec([0, 1, 0]),
  EZ: vec([0, 0, 1]),
  O: at([0, 0, 0]),
  yTravel: Y_TRAVEL,
  hx: HX,
  park: HEAD_PARK,
  by: BY,
  panel: PANEL,
  glassTop: GLASS_TOP,
  vias: VIAS,
  nv: NV,
  sites: SITES.map((s) => [s.x, s.y, s.w, s.d]),
  phases: M.PHASES,
  pieces: M.PIECES,
  order: PARTS_ORDER,
  idle: M.IDLE,
  rdl: M.INTEL.rdl,
  facts: { pulses: M.LIDE.pulses, density: M.INTEL.densityX, pitch: M.INTEL.tgvPitchUm, sites: M.sitesPerPanel, pkg: M.INTEL.packageMm, ls: M.INTEL.lineSpaceUm },
};

const legend = PARTS_ORDER.map((id, index) => `<button type="button" class="gs-part" data-part="${id}"><span class="gs-num">${String(index + 1).padStart(2, "0")}</span>${M.PIECES[id].name}</button>`).join("");
const corners = `<div class="iso-plate-corners" aria-hidden="true"><span class="iso-plate-corner" data-corner="fig">Fig 1</span><span class="iso-plate-corner" data-corner="title">Glass core · TGV laser station</span><span class="iso-plate-corner" data-corner="readout" data-readout>${M.IDLE}</span></div>`;
const controls = `<div class="gs-controls"><span class="gs-hint">Hover a part · Space plays</span><span class="gs-live" aria-live="polite" data-live></span></div>`;
const stage = `<div class="gs-stage" tabindex="0" role="group" aria-label="Glass substrate laser station. Hover, or use the arrow keys, to pick a part; Space plays or pauses the process; Escape resets it; the slider below steps through it.">${svg}</div>`;
const caption = `A laser station of the LIDE kind (laser-induced deep etching): the ${M.PANEL.w} × ${M.PANEL.d} mm glass panel lies on a vacuum chuck on a Y table under a bridge, and the head on the bridge's X axis puts ${M.LIDE.pulses === 1 ? "one pulse" : `${M.LIDE.pulses} pulses`} into each via site. Only that step happens on this machine: the wet etch, seed and copper plating, build-up lamination, singulation and chiplet attach run on other tools, and the figure keeps the panel on one stage so you can watch the whole sequence. The panel carries ${M.sitesPerPanel} sites of Intel's largest planned package (${M.INTEL.packageMm} mm), each with an illustrative layout of ${M.INTEL.reticles} reticle-sized dies (Intel quotes more than ${M.INTEL.reticles} reticles of silicon) and ${M.DRAWN.hbmPerSite} HBM stacks. In front, on the small stand (and drawn flat under the machine): enlarged sections of a finished organic-core substrate (left) and a glass-core one (right), the same width, against the same straight datum bar. The organic core bows (exaggerated) and its build-up vias drift off the core vias layer by layer; the glass core stays flat, its vias stack true, and it holds up to about ${M.pitchRatio.toFixed(1)}× more holes along a line, ${M.INTEL.densityX}× more per area (Intel). The vias are drawn far larger and sparser than real (real pitch under ${M.INTEL.tgvPitchUm} µm); layer thicknesses are exaggerated; the machine layout is illustrative and the motion is compressed.`;
const scrub = `<span class="gs-scrub"><button type="button" class="gs-play" data-play aria-label="Play the process"><span class="gs-play-icon" aria-hidden="true"></span><span data-play-text>Play</span></button><input type="range" class="gs-range" data-scrub min="0" max="1000" step="1" value="0" aria-label="Process: 0 is a bare glass panel, 1000 is chiplets attached"><span class="gs-step" data-step>01 · ${M.PHASES[0].label}</span></span>`;
// the same two sections drawn flat and large under the machine, so the comparison reads on a phone
const secBox = (() => {
  const v0 = SEC.margin - 5;
  const v1 = SEC.margin + 2 * SEC.layer * SEC.layers + SEC.core + SEC.bow + 4;
  return `-3 ${v0} ${COUPONS[0].w + 6} ${v1 - v0}`;
})();
const secPanel = (id, title, notes) => `<div class="gs-sec" data-sec="${id}"><svg class="gs-sec-svg" viewBox="${secBox}" role="img" aria-label="${title} section: ${notes.join(", ")}">${sectionFace(COUPONS[0].w, id === "organic")}</svg><div class="gs-sec-cap"><span class="gs-sec-title">${title}</span><span class="gs-sec-notes">${notes.join(" · ")}</span></div></div>`;
const sections = `<div class="gs-sections" data-sections>${secPanel("organic", "Organic core", ["bows (exaggerated)", `${M.DRAWN.organicVias} wide holes`, "vias drift off"])}${secPanel("glass", "Glass core", ["flat on the datum", `${M.DRAWN.glassVias} TGVs, up to ~${M.pitchRatio.toFixed(1)}× tighter pitch`, "vias stack true"])}</div>`;
const body = `<figure class="iso-figure gs"><div class="iso-plate">${corners}${stage}${sections}${controls}</div><figcaption class="iso-legend">${scrub}<span class="gs-parts">${legend}</span><span class="iso-caption">${caption}</span></figcaption></figure>`;

const CSS = readFileSync(join(HERE, "glass-substrates.css"), "utf8");
const LIVE = readFileSync(join(HERE, "live.js"), "utf8").replace("__DATA__", JSON.stringify(DATA));
const out = writeChapter({ slug: "glass-substrates", figure: body, css: CSS, script: LIVE, lesson: LESSON });
console.log("wrote", out.file, `${out.kb} KB`, `${R.items.length} items`, `${R.solids.length} solids`);

A.auditOrExit(R, P, { frames: STATES, apart: false });
