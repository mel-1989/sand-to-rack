const D = __DATA__;
const clampGeo = __CLAMPGEO__;
const clampSvg = __CLAMPSVG__;
const KIT = { extrude, solidSvg, dotsSvg, iso, towardViewer };
const root = document.querySelector(".dc");
const stage = root.querySelector(".dc-stage");
const layers = stage.querySelector(".dc-layers");
const live = root.querySelector("[data-live]");
const readout = root.querySelector("[data-readout]");
const partButtons = [...root.querySelectorAll(".dc-part")];
const scrubInput = root.querySelector("[data-scrub]");
const playButton = root.querySelector("[data-play]");
const playText = root.querySelector("[data-play-text]");
const stepText = root.querySelector("[data-step]");
const thickFill = root.querySelector("[data-thick]");
const thickText = root.querySelector("[data-thick-text]");
const cutFill = root.querySelector("[data-cut]");
const cutText = root.querySelector("[data-cut-text]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const P = D.P;
const GG = D.G;
const SS = D.S;
const TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (t) => {
  const x = clamp(t);
  return x * x * (3 - 2 * x);
};
const f1 = (n) => n.toFixed(1);
const V3 = D.V;

const nodes = [...layers.querySelectorAll(".dc-it")].map((el) => ({
  el,
  piece: el.dataset.piece,
  part: el.dataset.part,
  key: Number(el.dataset.k),
  shown: "",
  probe: !!el.querySelector("#dc-probe"),
  stock: !!el.querySelector("#dc-stock"),
}));
let order = nodes.map((_, i) => i);
const find = (sel) => layers.querySelector(sel);
const el = {
  gspin: find('[data-gspin="chuck"]'),
  wspin: find("[data-wspin]"),
  stockTop: find("[data-stocktop]"),
  bgtape: find("[data-bgtape]"),
  gwafers: [...layers.querySelectorAll("[data-gwafer]")],
  sawframe: [...layers.querySelectorAll("[data-sawframe]")],
  sawwafer: [...layers.querySelectorAll("[data-sawwafer]")],
  over: stage.querySelector("[data-over]"),
  theta: find("[data-theta]"),
  clamps: [...layers.querySelectorAll("[data-clamp]")],
  grid: find("[data-grid]"),
  uv: find("[data-uv]"),
  jets: [...layers.querySelectorAll("[data-jet]")],
  bspin: find("[data-bspin]"),
  cam: find("[data-camlight]"),
};

// ---- the process as a function of the slider position s (0..1) ----
const PH = D.phases;
const phaseAt = (s) => PH.find((p) => s < p.t1) ?? PH[PH.length - 1];
const local = (id, s) => {
  const p = PH.find((q) => q.id === id);
  return clamp((s - p.t0) / (p.t1 - p.t0), -1, 2);
};
const STREETS = SS.streets;
const N = STREETS.length;
const lerp = (a, b, t) => a + (b - a) * t;
// table share that puts the blade at x_rel on the wafer, spindle share that puts it at y_rel
const tableFor = (xRel) => (-xRel - SS.tOff) / SS.tTravel;
const yFor = (yRel) => (SS.y + yRel - SS.y0) / SS.yTravel;
const halfAt = (c) => Math.sqrt(Math.max(0, SS.waferR * SS.waferR - c * c));
const PARK = { t: 0, y: 0, lift: 1 };
const ALIGN = { t: tableFor(-SS.cam[0]), y: yFor(-SS.cam[1]), lift: 1 };

// one set of streets (X before the turn, Y after it): where the blade is and how far each kerf has run
function cutting(u, from, to) {
  // u: 0..1 through the phase: lower onto the first street, cut N streets, lift and park.
  const lead = 0.06;
  const tail = 0.06;
  const startX = -(halfAt(STREETS[0]) + 6);
  if (u <= 0) return { t: from.t, y: from.y, lift: from.lift, done: 0, cur: -1, prog: 0 };
  if (u < lead) {
    // travel to the start of the first street with the blade up, then lower it off the wafer's edge
    const e = ease((u / lead) / 0.65);
    return { t: lerp(from.t, tableFor(startX), e), y: lerp(from.y, yFor(STREETS[0]), e), lift: lerp(from.lift, 0, ease((u / lead - 0.65) / 0.35)), done: 0, cur: -1, prog: 0 };
  }
  if (u >= 1 - tail) {
    // lift clear first, off the wafer's edge, then travel to the park
    const f = (u - (1 - tail)) / tail;
    const e = ease((f - 0.35) / 0.65);
    const lastDir = (N - 1) % 2 ? -1 : 1;
    const endX = lastDir * (halfAt(STREETS[N - 1]) + 6);
    return { t: lerp(tableFor(endX), to.t, e), y: lerp(yFor(STREETS[N - 1]), to.y, e), lift: lerp(0, to.lift, ease(f / 0.35)), done: N, cur: -1, prog: 0 };
  }
  const v = ((u - lead) / (1 - lead - tail)) * N;
  const i = Math.min(N - 1, Math.floor(v));
  const f = v - i;
  const dir = i % 2 ? -1 : 1;
  const half = halfAt(STREETS[i]) + 6;
  const index = 0.16;
  if (f < index && i > 0) {
    // index across to the next street; the table slides to that street's start
    const e = ease(f / index);
    const prevHalf = halfAt(STREETS[i - 1]) + 6;
    return { t: tableFor(lerp(-dir * prevHalf, -dir * half, e)), y: lerp(yFor(STREETS[i - 1]), yFor(STREETS[i]), e), lift: 0, done: i, cur: -1, prog: 0 };
  }
  const g = i > 0 ? (f - index) / (1 - index) : f;
  const x = -dir * half + dir * 2 * half * g;
  return { t: tableFor(x), y: yFor(STREETS[i]), lift: 0, done: i, cur: i, prog: g, dir, x };
}

function poseAt(s) {
  const tape = local("tape", s);
  const grind = local("grind", s);
  const mount = local("mount", s);
  const align = local("align", s);
  const cx = local("cutx", s);
  const rot = local("rotate", s);
  const cy = local("cuty", s);
  const uv = local("uv", s);
  const pick = local("pick", s);
  // grinder
  const hLift = GG.lift / GG.travel;
  let h;
  if (grind < 0) h = 0;
  else if (grind < 0.12) h = hLift * ease(grind / 0.12);
  else if (grind < 0.88) h = hLift + (1 - hLift) * ((grind - 0.12) / 0.76);
  else if (mount < 0) h = 1;
  else h = 1 - ease(mount / 0.45);
  const wb = GG.wb0 - h * GG.travel;
  const g = s >= PH[2].t0 ? 1 : clamp((GG.thick - wb) / GG.stock);
  const spin = ease((grind - 0.04) / 0.1) * (1 - ease(mount / 0.3));
  const tapeA = ease(tape / 0.7);
  // mount: the ring frame and its tape come down onto the saw chuck first, then the thin wafer
  // leaves the grinder and is laid on the tape; the two wafers cross-fade so one is always in view
  const gOut = 1 - ease((mount - 0.3) / 0.35);
  const fIn = ease(mount / 0.35);
  const sIn = ease((mount - 0.28) / 0.37);
  // saw
  // while the grinder works the spindle waits at the front of the beam; it backs off to the park at spark-out
  let st = s < PH[2].t0 ? { t: PARK.t, y: lerp(SS.restY, PARK.y, ease((grind - 0.8) / 0.2)), lift: PARK.lift } : { t: PARK.t, y: PARK.y, lift: PARK.lift };
  let theta = 0;
  let xs = { done: 0, cur: -1, prog: 0 };
  let ys = { done: 0, cur: -1, prog: 0 };
  if (align >= 0 && cx < 0) {
    const e = ease(align / 0.5);
    st = { t: lerp(PARK.t, ALIGN.t, e), y: lerp(PARK.y, ALIGN.y, e), lift: 1 };
    theta = align < 0.5 ? -3 * ease(align / 0.4) : -3 * (1 - ease((align - 0.55) / 0.35));
  } else if (cx >= 0 && rot < 0) {
    const c = cutting(cx, ALIGN, PARK);
    st = c;
    xs = c;
    if (cx >= 1) st = { ...PARK };
  } else if (rot >= 0 && cy < 0) {
    xs = { done: N, cur: -1, prog: 0 };
    theta = 90 * ease(rot);
  } else if (cy >= 0) {
    xs = { done: N, cur: -1, prog: 0 };
    theta = 90;
    const c = cutting(cy, PARK, PARK);
    st = c;
    ys = c;
  }
  const cuttingNow = (xs.cur >= 0 || ys.cur >= 0) && st.lift < 0.01;
  return {
    h,
    g,
    spin,
    tapeA,
    gOut,
    fIn,
    sIn,
    st,
    theta,
    xs,
    ys,
    cuttingNow,
    bladeSpin: s < PH[3].t0 ? 0 : uv < 0 ? ease((align - 0.5) / 0.5) : 1 - ease(uv / 0.5),
    camOn: align >= 0 && align < 1 ? Math.sin(Math.PI * clamp(align)) : 0,
    uv: uv < 0 ? 0 : clamp(uv),
    uvLamp: uv < 0 || uv >= 1 ? 0 : ease(uv / 0.12) * (1 - ease((uv - 0.88) / 0.12)),
    uvDone: uv >= 0.5 || pick >= 0,
    pick: clamp(pick),
    bladeLit: cx >= 0 && uv < 0,
  };
}

// ---- drawing helpers ----
const facing = (nx, ny, nz) => nx * V3[0] + ny * V3[1] + nz * V3[2];
const pathOf2 = (pts, closed) => pts.map((p, i) => `${i ? "L" : "M"}${f1(p[0])} ${f1(p[1])}`).join("") + (closed ? "Z" : "");
function spinTicks(cx, cy, r, z0, z1, count, angle, tone = "lo") {
  let out = "";
  for (let i = 0; i < count; i++) {
    const a = angle + (i * TAU) / count;
    const f = facing(Math.cos(a), Math.sin(a), 0);
    if (f < 0.06) continue;
    const alpha = clamp((f - 0.06) / 0.3);
    const p0 = iso([cx + r * Math.cos(a), cy + r * Math.sin(a), z0], P);
    const p1 = iso([cx + r * Math.cos(a), cy + r * Math.sin(a), z1], P);
    out += `<path class="iso-line" data-tone="${tone}" opacity="${alpha.toFixed(2)}" d="M${f1(p0[0])} ${f1(p0[1])}L${f1(p1[0])} ${f1(p1[1])}"/>`;
  }
  return out;
}
// spokes on the blade's front face (it lies in the x-z plane, facing +y)
function bladeSpokes(by, angle) {
  let out = "";
  const r0 = 13.4;
  const r1 = SS.bladeR - 1.2;
  for (let i = 0; i < 6; i++) {
    const a = angle + (i * TAU) / 6;
    const p0 = iso([SS.x + r0 * Math.cos(a), by + SS.bladeT / 2, SS.axisZ + r0 * Math.sin(a)], P);
    const p1 = iso([SS.x + r1 * Math.cos(a), by + SS.bladeT / 2, SS.axisZ + r1 * Math.sin(a)], P);
    out += `<path class="iso-line" data-tone="lo" d="M${f1(p0[0])} ${f1(p0[1])}L${f1(p1[0])} ${f1(p1[1])}"/>`;
  }
  // the hub's rim and the cutting edge ring, so the spokes end on lines
  const ringAt = (r) => pathOf2(Array.from({ length: 49 }, (_, i) => iso([SS.x + r * Math.cos((i * TAU) / 48), by + SS.bladeT / 2, SS.axisZ + r * Math.sin((i * TAU) / 48)], P)), false);
  return out + `<path class="iso-line" data-tone="lo" d="${ringAt(r0)}"/><path class="iso-line" data-tone="faint" d="${ringAt(r1)}"/>`;
}
// grind marks on the stock's top: arcs of the wheel rim through the centre, turned with the chuck
function grindMarks(angle, alpha) {
  if (alpha < 0.02) return "";
  let out = "";
  const R = GG.waferR;
  for (let i = 0; i < 10; i++) {
    const a = angle + (i * TAU) / 10;
    const c = [GG.x + R * Math.cos(a), GG.y + R * Math.sin(a)];
    const pts = [];
    // the arc inside the wafer runs from -60° to +60° about the direction back to the centre
    const back = a + Math.PI;
    for (let j = 0; j <= 24; j++) {
      const b = back - Math.PI / 3 + ((2 * Math.PI) / 3) * (j / 24);
      pts.push(iso([c[0] + R * Math.cos(b), c[1] + R * Math.sin(b), GG.thick], P));
    }
    out += `<path class="iso-line" data-tone="faint" d="${pathOf2(pts, false)}"/>`;
  }
  return `<g opacity="${alpha.toFixed(2)}">${out}</g>`;
}
// a kerf in wafer coordinates (along x' at y' = c, from x0 to x1), turned by theta onto the table
function kerfPath(c, x0, x1, theta) {
  const a = (theta * Math.PI) / 180;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const p = (x) => iso([SS.tcx + x * ca - c * sa, SS.y + x * sa + c * ca, SS.waferTop], P);
  const q0 = p(x0);
  const q1 = p(x1);
  return `M${f1(q0[0])} ${f1(q0[1])}L${f1(q1[0])} ${f1(q1[1])}`;
}
const BAD = [[-2, 1], [-3, -3], [1, 4], [-4, -1]];
const PICK = [[4, -1], [4, 0], [4, -2], [3, -1], [3, 0], [3, -2], [3, -3], [2, -1], [2, -2], [2, -3]];
function cellPath(i, j, theta) {
  const a = (theta * Math.PI) / 180;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const d = SS.die;
  const x0 = i * d + 0.35;
  const y0 = j * d + 0.35;
  const pts = [[x0, y0], [x0 + d - 0.7, y0], [x0 + d - 0.7, y0 + d - 0.7], [x0, y0 + d - 0.7]].map(([x, y]) => iso([SS.tcx + x * ca - y * sa, SS.y + x * sa + y * ca, SS.waferTop], P));
  return pathOf2(pts, true);
}
function dieAt(i, j, theta, z, lit) {
  const a = (theta * Math.PI) / 180;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const d = SS.die;
  const x0 = i * d + 0.6;
  const y0 = j * d + 0.6;
  const ring = [[x0, y0], [x0 + d - 1.2, y0], [x0 + d - 1.2, y0 + d - 1.2], [x0, y0 + d - 1.2]].map(([x, y]) => [SS.tcx + x * ca - y * sa, SS.y + x * sa + y * ca]);
  return solidSvg(extrude(ring, z, SS.waferTop - 22, P), { tone: "hi", crease: "lo", lit });
}
function gridSvg(pose) {
  const th = pose.theta;
  let out = "";
  const lines = [];
  const liveLines = [];
  // X streets: y' = c, cut in wafer x'. Y streets: x' = c, which after a 90° turn run along world x.
  STREETS.forEach((c, i) => {
    const h = halfAt(c);
    if (i < pose.xs.done) lines.push(kerfPath(c, -h, h, th));
    else if (i === pose.xs.cur) {
      const x = clamp(pose.st.x ?? 0, -h, h);
      const from = pose.xs.dir > 0 ? -h : h;
      if (Math.abs(x - from) > 0.3) liveLines.push(kerfPath(c, from, x, th));
    }
  });
  STREETS.forEach((c, i) => {
    const h = halfAt(c);
    // in wafer coordinates a Y street is x' = c; after the 90° turn it lies at world y = c
    const draw = (x0, x1) => {
      const a = (th * Math.PI) / 180;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      // world position of wafer point (c, y') is (c ca - y' sa, c sa + y' ca); at θ = 90 that is (-y', c)
      const p = (y) => iso([SS.tcx + c * ca - y * sa, SS.y + c * sa + y * ca, SS.waferTop], P);
      const q0 = p(x0);
      const q1 = p(x1);
      return `M${f1(q0[0])} ${f1(q0[1])}L${f1(q1[0])} ${f1(q1[1])}`;
    };
    if (i < pose.ys.done) lines.push(draw(-h, h));
    else if (i === pose.ys.cur) {
      // the blade at world x_rel = x runs over wafer y' = -x
      const x = clamp(-(pose.st.x ?? 0), -h, h);
      const from = pose.ys.dir > 0 ? h : -h;
      if (Math.abs(x - from) > 0.3) liveLines.push(draw(from, x));
    }
  });
  // the street pattern is there before the first cut: the camera aligns to it and the blade follows it
  const lanes = [];
  STREETS.forEach((c) => {
    const h = halfAt(c);
    lanes.push(kerfPath(c, -h, h, th));
    const a = (th * Math.PI) / 180;
    const p = (y) => iso([SS.tcx + c * Math.cos(a) - y * Math.sin(a), SS.y + c * Math.sin(a) + y * Math.cos(a), SS.waferTop], P);
    lanes.push(pathOf2([p(-h), p(h)], false));
  });
  out += `<path class="iso-line dc-lane" data-tone="faint" d="${lanes.join("")}"/>`;
  if (lines.length) out += `<path class="iso-line dc-kerf" data-tone="hi" d="${lines.join("")}"/>`;
  if (liveLines.length) out += `<path class="iso-line dc-kerf-live" data-tone="lit" d="${liveLines.join("")}"/>`;
  // dies flagged bad in the probe map, marked with a dot (illustrative), shown once the wafer is on the saw
  const a = (th * Math.PI) / 180;
  const inks = BAD.map(([i, j]) => [(i + 0.5) * SS.die, (j + 0.5) * SS.die]).map(([x, y]) => iso([SS.tcx + x * Math.cos(a) - y * Math.sin(a), SS.y + x * Math.sin(a) + y * Math.cos(a), SS.waferTop], P));
  out += dotsSvg(inks, { size: 1.1, tone: "lo" });
  // the cured band under the UV lamp, on the wafer's face
  if (pose.uvLamp > 0.01) out += uvBand(pose.uv, SS.waferR - 0.3, SS.waferTop + 0.02, 0.32 * pose.uvLamp);
  // picked dies: the collet takes them one at a time; each leaves its cell of bare tape
  if (pose.pick > 0) {
    const k = pickAt(pose.pick);
    let holes = "";
    PICK.forEach(([i, j], index) => {
      if (index < k.index || (index === k.index && k.u > 0.6)) holes += cellPath(i, j, th);
    });
    if (holes) out += `<path class="dc-hole" d="${holes}"/><path class="iso-line" data-tone="lo" d="${holes}"/>`;
    if (k.carry > 0 && k.fade < 0.999) {
      const [i, j] = PICK[k.index];
      out += `<g opacity="${(1 - k.fade).toFixed(2)}">${dieAt(i, j, th, SS.waferTop + k.carry, true)}</g>`;
    }
  }
  return out;
}
// a cooling-water fan from each nozzle's tip to the blade where it meets the wafer, with a little spray there
function jetAt(i, alpha, by) {
  if (alpha < 0.01) return "";
  const side = i ? 1 : -1;
  const y = by + side * 2.4;
  const yb = by + side * 0.9;
  // a fan of water from the nozzle head's orifice down onto the blade where it enters the wafer
  const t0 = iso([SS.x + 1.4, y, 25], P);
  const t1 = iso([SS.x + 4.6, y, 25], P);
  const e0 = iso([SS.x + 7, yb, SS.waferTop + 0.3], P);
  const e1 = iso([SS.x + 1, yb, SS.waferTop + 0.2], P);
  const e2 = iso([SS.x - 5, yb, SS.waferTop + 0.4], P);
  const out = `<path class="dc-jet" opacity="${alpha.toFixed(2)}" d="${pathOf2([t0, t1, e0, e1, e2], true)}"/>`;
  if (!i) return out;
  // spray thrown off where the blade leaves the cut
  const drops = [];
  const now = ang.blade;
  for (let n = 0; n < 12; n++) {
    const ph = (now * 0.35 + n * 0.37) % 1;
    const x = SS.x - 4 - ph * 9 - (n % 3) * 1.5;
    const yy = by + 1.2 + ((n * 0.61) % 1) * 3.4;
    const z = SS.waferTop + 0.6 + Math.sin(ph * Math.PI) * (2.4 + (n % 2) * 1.4);
    drops.push(iso([x, yy, z], P));
  }
  const dots = drops.map(([x, yy]) => `<circle class="dc-spray" cx="${f1(x)}" cy="${f1(yy)}" r="0.95"/>`).join("");
  return out + `<g opacity="${(0.9 * alpha).toFixed(2)}">${dots}</g>`;
}
// the strip of the plane at height z under the lamp (x within lx ± w), cut to a circle of radius r, centred on the chuck
function stripIn(x0, x1, r, z) {
  const a = Math.max(-r, x0);
  const b = Math.min(r, x1);
  if (b - a < 0.2) return null;
  const pts = [];
  const n = Math.max(6, Math.round((b - a) / 2));
  for (let q = 0; q <= n; q++) {
    const x = a + ((b - a) * q) / n;
    pts.push(iso([SS.tcx + x, SS.y - halfR(r, x), z], P));
  }
  for (let q = n; q >= 0; q--) {
    const x = a + ((b - a) * q) / n;
    pts.push(iso([SS.tcx + x, SS.y + halfR(r, x), z], P));
  }
  return pathOf2(pts, true);
}
const halfR = (r, x) => Math.sqrt(Math.max(0, r * r - x * x));
const LAMP = { x0: -96, x1: 96, w: 6, y0: -34, y1: 104, z: 36, h: 5 };
const lampX = (u) => lerp(LAMP.x0, LAMP.x1, ease((u - 0.08) / 0.84));
function uvBand(u, r, z, alpha) {
  const lx = lampX(u);
  const d = stripIn(lx - 9, lx + 9, r, z);
  return d ? `<path class="dc-uv" opacity="${alpha.toFixed(2)}" d="${d}"/>` : "";
}
// on the tape: the part the lamp has passed is cured (a lasting violet tint), the band under it glows
function uvSvg(pose) {
  if (pose.uv <= 0) return "";
  const lx = pose.uv >= 1 ? LAMP.x1 + 20 : lampX(pose.uv);
  const done = stripIn(-SS.frameIn, lx, SS.frameIn - 0.5, 22);
  let out = done ? `<path class="dc-uv" opacity="0.2" d="${done}"/>` : "";
  if (pose.uvLamp > 0.01) out += uvBand(pose.uv, SS.frameIn - 0.5, 22.01, 0.4 * pose.uvLamp);
  return out;
}
// convex hull of screen points, for the lamp's beam
function hull(pts) {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper = [];
  for (const q of p.reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}
// a carriage on the handling rail at x and a post rising from it to z (the post sits inside plan py0..py1)
function railPost(x, z, py0, py1) {
  const R = SS.prail;
  const car = { x: x - 7, y: R.y - 2.5, w: 14, d: R.d + 5, r: 1.2 };
  const carSvg = solidSvg(slabOf(car, R.top, 5, P, 2, 0.3), { tone: "mid" });
  const bolts = dotsSvg([iso([x - 4.5, R.y + R.d / 2, R.top + 5], P), iso([x + 4.5, R.y + R.d / 2, R.top + 5], P)], { size: 0.45 });
  const post = { x: x - 2.5, y: py0, w: 5, d: py1 - py0, r: 0.8 };
  const postSvg = solidSvg(slabOf(post, R.top + 5, z - R.top - 5, P, 2, 0.3), { tone: "mid" });
  return carSvg + bolts + postSvg;
}
// the UV lamp bar passing over the frame, carried on a post from the handling rail, and its light falling on the wafer
function lampSvg(pose) {
  const a = pose.uvLamp;
  if (a < 0.01) return "";
  const lx = SS.tcx + lampX(pose.uv);
  const plan = { x: lx - LAMP.w, y: SS.y + LAMP.y0, w: LAMP.w * 2, d: LAMP.y1 - LAMP.y0, r: 1.2 };
  const foot = [];
  const top = [];
  for (const y of [SS.y + LAMP.y0 + 6, SS.y + LAMP.y1 - 6]) {
    for (const dx of [-4, 4]) top.push(iso([lx + dx, y, LAMP.z], P));
    for (const dx of [-9, 9]) foot.push(iso([lx + dx, y, SS.waferTop], P));
  }
  const beam = `<path class="dc-uv-beam" opacity="${(0.22 * a).toFixed(2)}" d="${pathOf2(hull([...top, ...foot]), true)}"/>`;
  const body = solidSvg(slabOf(plan, LAMP.z, LAMP.h, P, 3, 0.4), { tone: "mid" });
  const cap0 = solidSvg(slabOf({ x: lx - LAMP.w - 1, y: SS.y + LAMP.y0 - 3, w: LAMP.w * 2 + 2, d: 4, r: 1 }, LAMP.z - 1, LAMP.h + 2, P, 2, 0.3), { tone: "mid" });
  const cap1 = solidSvg(slabOf({ x: lx - LAMP.w - 1, y: SS.y + LAMP.y1 - 1, w: LAMP.w * 2 + 2, d: 4, r: 1 }, LAMP.z - 1, LAMP.h + 2, P, 2, 0.3), { tone: "mid" });
  const hold = railPost(lx, LAMP.z - 1, SS.y + LAMP.y1, SS.y + LAMP.y1 + 2.4);
  return `<g opacity="${a.toFixed(2)}">${beam}${hold}${cap0}${body}${cap1}</g>`;
}
// pick: one die at a time. u runs 0..1 for each die: travel over it, come down, grip, lift, hand it off
function pickAt(pick) {
  const n = PICK.length;
  const v = clamp(pick) * n;
  const index = Math.min(n - 1, Math.floor(v));
  const u = v >= n ? 1 : v - index;
  const descend = ease((u - 0.3) / 0.15) * (1 - ease((u - 0.55) / 0.25));
  const carry = u > 0.55 ? ease((u - 0.55) / 0.25) * 14 : 0;
  const fade = ease((u - 0.84) / 0.14);
  return { index, u, descend, carry, fade, travel: ease(u / 0.3) };
}
function dieCentre(i, j, th) {
  const a = (th * Math.PI) / 180;
  const x = (i + 0.5) * SS.die;
  const y = (j + 0.5) * SS.die;
  return [SS.tcx + x * Math.cos(a) - y * Math.sin(a), SS.y + x * Math.sin(a) + y * Math.cos(a)];
}
// the vacuum collet on its arm (illustrative: a die sorter's pick head, drawn over the saw's chuck)
function colletSvg(pose) {
  if (pose.pick <= 0) return "";
  const k = pickAt(pose.pick);
  const th = pose.theta;
  const home = dieCentre(PICK[0][0] + 2, PICK[0][1] + 1, th);
  const from = k.index ? dieCentre(...PICK[k.index - 1], th) : home;
  const to = dieCentre(...PICK[k.index], th);
  const cx = lerp(from[0], to[0], k.travel);
  const cy = lerp(from[1], to[1], k.travel);
  const zTip = SS.waferTop + 0.4 + (k.u <= 0.55 ? 14 * (1 - k.descend) : k.carry);
  const show = k.index ? 1 : ease(k.u / 0.12);
  // the arm runs in Y from a post on the handling rail; the head slides along it and drives the collet in Z
  const AZ = SS.waferTop + 32;
  const tip = solidSvg(cylinder(cx, cy, 2.4, zTip, 2.2, P, 20, 0.2), { tone: "hi", crease: "lo", lit: k.u > 0.3 && k.u < 0.84 });
  const shank = solidSvg(cylinder(cx, cy, 1.5, zTip + 2.2, AZ - 7 - zTip - 2.2, P, 16), { tone: "mid" });
  const block = { x: cx - 4, y: cy - 4, w: 8, d: 8, r: 1 };
  const body = solidSvg(slabOf(block, AZ - 7, 7, P, 2, 0.4), { tone: "mid" });
  const R = SS.prail;
  const arm = { x: cx - 2.5, y: SS.y + 18, w: 5, d: R.y + 2.4 - (SS.y + 18), r: 1 };
  const armSvg = solidSvg(slabOf(arm, AZ, 4, P, 2, 0.3), { tone: "mid" });
  const endCap = solidSvg(slabOf({ x: cx - 3.5, y: SS.y + 15, w: 7, d: 3, r: 0.8 }, AZ - 0.5, 5, P, 2, 0.2), { tone: "mid" });
  const hold = railPost(cx, AZ, R.y - 0.6, R.y + 2.4);
  return `<g opacity="${show.toFixed(2)}">${endCap}${tip}${shank}${body}${hold}${armSvg}</g>`;
}
function camLight(alpha, by) {
  if (alpha < 0.01) return "";
  const cx = SS.x + SS.cam[0];
  const cy = by + SS.cam[1];
  const pts = [];
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * TAU;
    pts.push(iso([cx + 5.6 * Math.cos(a), cy + 5.6 * Math.sin(a), 35], P));
  }
  return `<path class="dc-cam-light" opacity="${(0.7 * alpha).toFixed(2)}" d="${pathOf2(pts, true)}"/>`;
}

// ---- state ----
let s = 0;
let selected = null;
let playing = false;
let touring = !still.matches;
let tookOver = false;
let inside = false;
let idleTimer = 0;
let leaveTimer = 0;
let visible = false;
let frame = 0;
let last = 0;
let holdUntil = 0;
const ang = { chuck: 0, wheel: 0, blade: 0 };
const SECONDS = 40;
let spoken = "";
let lastTheta = null;
let lastGrid = "";

function say(text) {
  if (readout.textContent !== text) readout.textContent = text;
}
function describe() {
  const text = selected ? `${D.pieces[selected].name}: ${D.pieces[selected].say}` : `${phaseAt(s).label}: ${phaseAt(s).say}`;
  if (stage.getAttribute("aria-description") !== text) stage.setAttribute("aria-description", text);
  if (document.activeElement === stage && text !== spoken) {
    spoken = text;
    live.textContent = text;
  }
}
function select(id) {
  if (id === "stand") id = null;
  if (selected === id) return;
  selected = id;
  for (const node of nodes) node.el.toggleAttribute("data-on", id !== null && node.part === id);
  stage.toggleAttribute("data-focus", !!id);
  partButtons.forEach((b) => b.toggleAttribute("data-on", b.dataset.part === id));
  describe();
}

function place(pose) {
  const off = (node) => {
    if (node.piece === "head") return [0, 0, -D.G.travel * pose.h];
    if (node.piece === "stock") return [0, 0, -GG.stock * pose.g];
    if (node.piece === "table") return [SS.tTravel * pose.st.t, 0, 0];
    if (node.piece === "ycar") return [0, SS.yTravel * pose.st.y, 0];
    if (node.piece === "spindle") return [0, SS.yTravel * pose.st.y, SS.zlift * pose.st.lift];
    return null;
  };
  for (const node of nodes) {
    const o = off(node);
    node.depth = node.key + (o ? o[0] * V3[0] + o[1] * V3[1] + o[2] * V3[2] : 0);
    if (!o) continue;
    const tx = D.EX[0] * o[0] + D.EY[0] * o[1] + D.EZ[0] * o[2];
    const ty = D.EX[1] * o[0] + D.EY[1] * o[1] + D.EZ[1] * o[2];
    const text = Math.abs(tx) + Math.abs(ty) < 0.005 ? "" : `translate(${tx.toFixed(2)} ${ty.toFixed(2)})`;
    if (text !== node.shown) {
      node.shown = text;
      if (text) node.el.setAttribute("transform", text);
      else node.el.removeAttribute("transform");
      if (node.probe || node.stock) holdStill(node.el, [tx, ty]);
    }
  }
  const next = nodes.map((_, i) => i).sort((a, b) => nodes[a].depth - nodes[b].depth);
  if (next.some((index, i) => index !== order[i])) {
    const fragment = document.createDocumentFragment();
    for (const index of next) fragment.appendChild(nodes[index].el);
    layers.appendChild(fragment);
    order = next;
  }
}

const BY0 = SS.y0;
const litStock = [...layers.querySelectorAll("#dc-stock ~ g > .iso-solid, [clip-path='url(#dc-stock)'] > .iso-solid")];
const litBlade = [...layers.querySelectorAll("[data-blade] > .iso-solid")];
function draw(pose) {
  place(pose);
  el.gspin.innerHTML = spinTicks(GG.x, GG.y, GG.chuckR, 6.3, GG.chuckTop - 0.3, 24, ang.chuck);
  el.wspin.innerHTML = spinTicks(GG.wx, GG.wy, GG.wheelR, GG.wb0 + 0.2, GG.wb0 + GG.seg - 0.2, 40, ang.wheel);
  el.stockTop.innerHTML = grindMarks(ang.chuck, pose.g > 0 && pose.g < 1 ? 1 : pose.g >= 1 ? 0.6 : 0);
  el.bgtape.style.opacity = pose.tapeA.toFixed(2);
  el.gwafers.forEach((g) => (g.style.opacity = pose.gOut.toFixed(2)));
  const drop = (g, a, dz) => {
    g.style.opacity = a.toFixed(2);
    const z = (1 - a) * dz;
    const t = z < 0.01 ? "" : `translate(${f1(D.EZ[0] * z)} ${f1(D.EZ[1] * z)})`;
    if (g.getAttribute("transform") !== (t || null)) t ? g.setAttribute("transform", t) : g.removeAttribute("transform");
  };
  el.sawframe.forEach((g) => drop(g, pose.fIn, 18));
  el.sawwafer.forEach((g) => drop(g, pose.sIn, 12));
  if (lastTheta !== pose.theta) {
    lastTheta = pose.theta;
    const ticks = radialTicks(SS.tcx, SS.y, SS.thetaR, 72, 6, SS.thetaTop, [1.4, 3], P, (pose.theta * Math.PI) / 180);
    el.theta.innerHTML = `<path class="iso-line" data-tone="lo" d="${ticks.minor}"/><path class="iso-line" data-tone="mid" d="${ticks.major}"/>`;
    el.clamps.forEach((c) => (c.innerHTML = clampSvg(pose.theta, KIT, P, D.CLAMP, [SS.tcx, SS.y], SS.thetaTop, Number(c.dataset.clamp))));
  }
  const grid = pose.sIn > 0.01 ? gridSvg(pose) : "";
  if (grid !== lastGrid) {
    lastGrid = grid;
    el.grid.innerHTML = grid;
  }
  el.uv.innerHTML = uvSvg(pose);
  el.over.innerHTML = lampSvg(pose) + colletSvg(pose) + jetAt(1, pose.cuttingNow ? 1 : 0, BY0 + SS.yTravel * pose.st.y);
  const jet = pose.cuttingNow ? 1 : 0;
  // the back jet sits behind the blade, in its nozzle's layer; the front one and the spray are drawn over everything
  el.jets.forEach((j) => (j.innerHTML = Number(j.dataset.jet) ? "" : jetAt(0, jet, BY0)));
  el.bspin.innerHTML = bladeSpokes(BY0, ang.blade);
  el.cam.innerHTML = camLight(pose.camOn, BY0);
  const grinding = pose.h > 0.02 && pose.g < 1 && local("grind", s) >= 0;
  litStock.forEach((n) => n.toggleAttribute("data-lit", grinding || (!pose.sIn && pose.g < 1)));
  litBlade.forEach((n) => n.toggleAttribute("data-lit", pose.bladeLit));
}

const um = (pose) => Math.round(D.um.start - pose.g * (D.um.start - D.um.target));
function stepLabel() {
  const index = PH.indexOf(phaseAt(s));
  return `${String(index + 1).padStart(2, "0")} · ${PH[index].label}`;
}
function readoutText(pose) {
  if (selected) return D.pieces[selected].say;
  const p = phaseAt(s);
  if (p.id === "grind") {
    const t = um(pose);
    if (pose.g <= 0) return `wheel feeds down onto the wafer · ${t} µm`;
    if (pose.g >= 1) return `spark-out · ${t} µm reached · gauge stops the feed`;
    return `${t} µm · ${t > D.um.roughTo ? `#${D.grit.rough} rough grind` : `#${D.grit.fine} fine grind`}`;
  }
  if (p.id === "cutx" || p.id === "cuty") {
    const c = p.id === "cutx" ? pose.xs : pose.ys;
    const axis = p.id === "cutx" ? "X" : "Y";
    if (c.cur >= 0) return `street ${c.cur + 1} of ${N} in ${axis} · table feeds under the blade`;
    if (c.done >= N) return `all ${N} ${axis} streets cut`;
    if (c.done > 0) return `index one die pitch in Y · street ${c.done + 1} next`;
    return `blade down · first ${axis} street`;
  }
  if (p.id === "rotate") return `θ table · ${Math.round(pose.theta)}°`;
  return p.say;
}
function gauges(pose) {
  const t = um(pose);
  thickFill.style.width = `${((t / D.um.start) * 100).toFixed(1)}%`;
  const tt = `${t} µm`;
  if (thickText.textContent !== tt) thickText.textContent = tt;
  const done = pose.xs.done + pose.ys.done;
  const prog = pose.xs.cur >= 0 ? pose.xs.prog : pose.ys.cur >= 0 ? pose.ys.prog : 0;
  cutFill.style.width = `${(((done + prog) / (2 * N)) * 100).toFixed(1)}%`;
  const ct = `${done} / ${2 * N}`;
  if (cutText.textContent !== ct) cutText.textContent = ct;
}
function showPlay() {
  playText.textContent = playing ? "Pause" : s >= 0.999 ? "Replay" : "Play";
  playButton.toggleAttribute("data-playing", playing);
  playButton.setAttribute("aria-label", playing ? "Pause the process" : "Play the process");
  const text = stepLabel();
  if (stepText.textContent !== text) stepText.textContent = text;
  const v = String(Math.round(s * 1000));
  if (scrubInput.value !== v) scrubInput.value = v;
  const vt = `Step ${text}`;
  if (scrubInput.getAttribute("aria-valuetext") !== vt) scrubInput.setAttribute("aria-valuetext", vt);
}

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  const calm = still.matches;
  if ((playing || touring) && !calm) {
    if (now < holdUntil) {
      // hold the last frame for a moment before the tour starts again
    } else if (s >= 1) {
      if (touring) s = 0;
      else playing = false;
    } else {
      s = Math.min(1, s + dt / SECONDS);
      if (s >= 1 && touring) holdUntil = now + 2600;
    }
  }
  const pose = poseAt(s);
  if (!calm) {
    ang.chuck += dt * pose.spin * 1.6;
    ang.wheel -= dt * pose.spin * 3.2;
    ang.blade += dt * clamp(pose.bladeSpin) * 9;
  }
  draw(pose);
  showPlay();
  gauges(pose);
  say(readoutText(pose));
  describe();
  const moving = !calm && (playing || touring || pose.spin > 0.001 || pose.bladeSpin > 0.001);
  frame = visible && moving ? requestAnimationFrame(tick) : 0;
}
function run() {
  if (!frame && visible) {
    last = 0;
    frame = requestAnimationFrame(tick);
  }
}
new IntersectionObserver(
  (entries) => {
    visible = entries[entries.length - 1].isIntersecting;
    if (visible) run();
  },
  { rootMargin: "120px 0px" },
).observe(stage);

function quietTour() {
  touring = false;
  tookOver = true;
  clearTimeout(idleTimer);
}
function idleTour() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (inside || tookOver || playing) return;
    touring = !still.matches;
    run();
  }, 3600);
}

function partAt(event) {
  const hit = document.elementFromPoint(event.clientX, event.clientY);
  const item = hit && hit.closest ? hit.closest(".dc-it") : null;
  return item ? item.dataset.part : null;
}
stage.addEventListener("pointermove", (event) => {
  if (event.pointerType === "touch") return;
  inside = true;
  touring = false;
  clearTimeout(idleTimer);
  clearTimeout(leaveTimer);
  select(partAt(event));
  run();
});
stage.addEventListener("pointerleave", () => {
  inside = false;
  clearTimeout(leaveTimer);
  leaveTimer = setTimeout(() => {
    if (inside) return;
    select(null);
    if (!tookOver) idleTour();
    run();
  }, 260);
});
stage.addEventListener("pointerdown", (event) => {
  if (event.pointerType !== "touch") {
    stage.focus({ preventScroll: true });
    return;
  }
  quietTour();
  const id = partAt(event);
  select(id && id !== "stand" && id !== selected ? id : null);
  run();
});
partButtons.forEach((button) => {
  const show = () => {
    quietTour();
    clearTimeout(leaveTimer);
    select(button.dataset.part);
    run();
  };
  const hide = () => {
    clearTimeout(leaveTimer);
    leaveTimer = setTimeout(() => {
      if (inside || partButtons.some((other) => other.matches(":hover, :focus-visible"))) return;
      select(null);
      run();
    }, 260);
  };
  button.addEventListener("pointerenter", show);
  button.addEventListener("focus", show);
  button.addEventListener("pointerleave", hide);
  button.addEventListener("blur", hide);
  button.addEventListener("click", show);
});
stage.addEventListener("focus", () => {
  spoken = "";
  describe();
});

function togglePlay() {
  quietTour();
  select(null);
  if (playing) {
    playing = false;
  } else {
    if (s >= 0.999) s = 0;
    if (still.matches) {
      // reduced motion: jump to a late point of the next step, so each step shows its result
      const late = (q) => q.t0 + 0.85 * (q.t1 - q.t0);
      const p = phaseAt(s);
      if (s < late(p) - 0.001) s = late(p);
      else if (p.t1 >= 1) s = 1;
      else s = late(phaseAt(p.t1 + 0.001));
    } else playing = true;
  }
  showPlay();
  run();
  if (!frame) tick(performance.now());
}

document.addEventListener("keydown", (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey || !visible) return;
  const target = event.target;
  if (target !== document.body && target !== stage && !root.contains(target)) return;
  if (target === scrubInput && event.key !== " " && event.key !== "Escape") return;
  if (target instanceof HTMLButtonElement && (event.key === " " || event.key === "Enter")) return;
  if (event.key === " ") {
    event.preventDefault();
    togglePlay();
    return;
  }
  if (event.key === "Escape") {
    event.preventDefault();
    quietTour();
    playing = false;
    select(null);
    s = 0;
    run();
    if (!frame) tick(performance.now());
    return;
  }
  const index = selected ? D.order.indexOf(selected) : -1;
  let next = null;
  if (event.key === "ArrowRight" || event.key === "ArrowDown") next = Math.min(D.order.length - 1, index + 1);
  else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = Math.max(0, index - 1);
  else if (event.key === "Home") next = 0;
  else if (event.key === "End") next = D.order.length - 1;
  if (next === null) return;
  event.preventDefault();
  quietTour();
  select(D.order[next]);
  run();
  if (!frame) tick(performance.now());
});

scrubInput.addEventListener("input", () => {
  quietTour();
  playing = false;
  select(null);
  s = Number(scrubInput.value) / 1000;
  run();
  if (!frame) tick(performance.now());
});
playButton.addEventListener("click", togglePlay);

if (still.matches) touring = false;
const narrow = matchMedia("(hover: none), (max-width: 480px)");
const hint = root.querySelector(".dc-hint");
const wording = () => hint && (hint.textContent = narrow.matches ? "Tap a part · Play below" : "Hover a part · Space plays");
wording();
narrow.addEventListener("change", wording);
const pose0 = poseAt(s);
draw(pose0);
showPlay();
gauges(pose0);
say(readoutText(pose0));
