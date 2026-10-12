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
  sawload: [...layers.querySelectorAll("[data-sawload]")],
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
    const e = ease(u / lead);
    return { t: lerp(from.t, tableFor(startX), e), y: lerp(from.y, yFor(STREETS[0]), e), lift: lerp(from.lift, 0, e), done: 0, cur: -1, prog: 0 };
  }
  if (u >= 1 - tail) {
    const e = ease((u - (1 - tail)) / tail);
    const lastDir = (N - 1) % 2 ? -1 : 1;
    const endX = lastDir * (halfAt(STREETS[N - 1]) + 6);
    return { t: lerp(tableFor(endX), to.t, e), y: lerp(yFor(STREETS[N - 1]), to.y, e), lift: lerp(0, to.lift, e), done: N, cur: -1, prog: 0 };
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
  const gOut = 1 - ease((mount - 0.25) / 0.4);
  const sIn = ease((mount - 0.45) / 0.45);
  // saw
  let st = { t: PARK.t, y: PARK.y, lift: PARK.lift };
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
    sIn,
    st,
    theta,
    xs,
    ys,
    cuttingNow,
    bladeSpin: s < PH[3].t0 ? 0 : uv < 0 ? ease((align - 0.5) / 0.5) : 1 - ease(uv / 0.5),
    camOn: align >= 0 && align < 1 ? Math.sin(Math.PI * clamp(align)) : 0,
    uv: uv < 0 ? 0 : uv < 1 ? Math.sin((Math.PI * uv) / 1) * 0.9 : 0,
    uvDone: uv >= 0.5 || pick >= 0,
    pick: clamp(pick),
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
  if (lines.length) out += `<path class="iso-line" data-tone="mid" d="${lines.join("")}"/>`;
  if (liveLines.length) out += `<path class="iso-line" data-tone="lit" d="${liveLines.join("")}"/>`;
  // inked dies from wafer probe, shown once the wafer is on the saw
  const a = (th * Math.PI) / 180;
  const inks = BAD.map(([i, j]) => [(i + 0.5) * SS.die, (j + 0.5) * SS.die]).map(([x, y]) => iso([SS.tcx + x * Math.cos(a) - y * Math.sin(a), SS.y + x * Math.sin(a) + y * Math.cos(a), SS.waferTop], P));
  out += dotsSvg(inks, { size: 1.1, tone: "lo" });
  // picked dies: each lifts off in turn and is carried away, leaving its cell of bare tape
  if (pose.pick > 0) {
    const n = PICK.length;
    let holes = "";
    let lifted = "";
    PICK.forEach(([i, j], index) => {
      const t0 = (index / n) * 0.85;
      const u = clamp((pose.pick - t0) / 0.22);
      if (u <= 0) return;
      if (u > 0.12) holes += cellPath(i, j, th);
      const rise = ease(u / 0.45) * 9;
      const gone = ease((u - 0.55) / 0.45);
      if (gone >= 0.999) return;
      lifted += `<g opacity="${(1 - gone).toFixed(2)}">${dieAt(i, j, th, SS.waferTop + rise + gone * 8, u < 0.6)}</g>`;
    });
    if (holes) out += `<path class="dc-hole" d="${holes}"/><path class="iso-line" data-tone="lo" d="${holes}"/>`;
    out += lifted;
  }
  return out;
}
function jetAt(i, alpha, by) {
  if (alpha < 0.01) return "";
  const y = i ? by + 2.7 : by - 2.7;
  const tip = iso([SS.x + 6, y, 29], P);
  const a = iso([SS.x + 6, y, 30.6], P);
  const b = iso([SS.x + 2.5, y > by ? by + 0.8 : by - 0.8, SS.waferTop + 0.1], P);
  const c = iso([SS.x - 2, y > by ? by + 0.8 : by - 0.8, SS.waferTop + 0.1], P);
  return `<path class="dc-jet" opacity="${(0.55 * alpha).toFixed(2)}" d="${pathOf2([a, tip, b, c], true)}"/>`;
}
function uvSvg(alpha) {
  if (alpha < 0.01) return "";
  const pts = [];
  for (let i = 0; i < 96; i++) {
    const a = (i / 96) * TAU;
    pts.push(iso([SS.tcx + (SS.frameIn - 0.5) * Math.cos(a), SS.y + (SS.frameIn - 0.5) * Math.sin(a), 22], P));
  }
  return `<path class="dc-uv" opacity="${(0.24 * alpha).toFixed(2)}" d="${pathOf2(pts, true)}"/>`;
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
  el.sawload.forEach((g) => (g.style.opacity = pose.sIn.toFixed(2)));
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
  el.uv.innerHTML = uvSvg(pose.uv);
  const jet = pose.cuttingNow ? 1 : 0;
  el.jets.forEach((j) => (j.innerHTML = jetAt(Number(j.dataset.jet), jet, BY0)));
  el.bspin.innerHTML = bladeSpokes(BY0, ang.blade);
  el.cam.innerHTML = camLight(pose.camOn, BY0);
  const grinding = pose.h > 0.02 && pose.g < 1 && local("grind", s) >= 0;
  litStock.forEach((n) => n.toggleAttribute("data-lit", grinding || (!pose.sIn && pose.g < 1)));
  litBlade.forEach((n) => n.toggleAttribute("data-lit", pose.sIn > 0.5));
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
      // reduced motion: jump to the next step instead of animating
      const p = phaseAt(s);
      s = p.t1 >= 1 ? 1 : p.t1 + 0.001;
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
