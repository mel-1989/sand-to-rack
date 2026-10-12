const D = __DATA__;
const condParts = __COND__;
const KIT = { cylinder, extrude, solidSvg, lineSvg, dotsSvg, ring, iso };
const root = document.querySelector(".cmp");
const stage = root.querySelector(".cmp-stage");
const layers = stage.querySelector(".cmp-layers");
const live = root.querySelector("[data-live]");
const readout = root.querySelector("[data-readout]");
const partButtons = [...root.querySelectorAll(".cmp-part")];
const scrubInput = root.querySelector("[data-scrub]");
const playButton = root.querySelector("[data-play]");
const playText = root.querySelector("[data-play-text]");
const stepText = root.querySelector("[data-step]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const P = D.P;
const TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (t) => {
  const x = clamp(t);
  return x * x * (3 - 2 * x);
};
const f1 = (n) => n.toFixed(1);

const nodes = [...layers.querySelectorAll(".cmp-it")].map((el) => ({
  el,
  piece: el.dataset.piece,
  part: el.dataset.part,
  key: Number(el.dataset.k),
  shown: "",
}));
let order = nodes.map((_, i) => i);
const find = (sel) => layers.querySelector(sel);
const spin = {
  pad: find('[data-spin="pad"]'),
  side: find('[data-spin="platen.side"]'),
  body: find('[data-spin="head.body"]'),
  plate: find('[data-spin="head.plate"]'),
};
const wet = find("[data-wet]");
const streams = [...layers.querySelectorAll("[data-stream]")];
const condEl = find("[data-cond]");
const rolls = [...layers.querySelectorAll("[data-roll]")];
const cupWafer = find('[data-wafer="cup"]');
const cleanWafer = find('[data-wafer="clean"]');
const rodClip = layers.querySelector("#cmp-rod [data-hold]");
const cupRodNode = nodes.find((n) => n.el.querySelector("#cmp-cuprod"));
const headCut = root.querySelector("[data-headcut]");
const section = {
  cu: root.querySelector("[data-cu]"),
  barrier: root.querySelector("[data-barrier]"),
  surf: root.querySelector("[data-surf]"),
  note: root.querySelector("[data-inset-note]"),
};

// ---- the process as a function of the slider position s (0..1) ----
const PH = D.phases;
const phaseAt = (s) => PH.find((p) => s < p.t1) ?? PH[PH.length - 1];
const local = (id, s) => {
  const p = PH.find((q) => q.id === id);
  return clamp((s - p.t0) / (p.t1 - p.t0), -1, 2);
};
function poseAt(s) {
  const load = local("load", s);
  const press = local("press", s);
  const rinse = local("rinse", s);
  const clean = local("clean", s);
  const slurry = local("slurry", s);
  const cond = local("condition", s);
  const flat = local("flatten", s);
  const end = local("endpoint", s);
  // after the rinse the head carries the wafer back over the load cup, the cup takes it, and the robot hands it to the cleaner
  const back = clean > 0;
  const u = back
    ? clean < 0.28 ? 0 : clean < 0.38 ? ease((clean - 0.28) / 0.1) : clean < 0.44 ? 1 : 1 - ease((clean - 0.44) / 0.14)
    : load < 0.3 ? ease(load / 0.3) : load < 0.42 ? 1 : 1 - ease((load - 0.42) / 0.2);
  const c = back ? ease(clean / 0.26) : 1 - ease((load - 0.5) / 0.5);
  // the robot lifts the wafer off the cup and sets it between the brushes in one hand-off: never half there
  const cupWafer = back ? (clean < 0.36 || clean >= 0.66 ? 0 : 1) : load > 0.36 ? 0 : 1;
  const h = s < PH[2].t0 ? 1 : rinse < 0.45 ? 1 - ease(press) : ease((rinse - 0.45) / 0.5);
  const platen = ease(slurry / 0.6) * (1 - ease(clean / 0.5));
  const headSpin = ease(press / 0.8) * (1 - ease((rinse - 0.3) / 0.3));
  const slurryOn = ease(slurry / 0.4) * (1 - ease((end - 0.5) / 0.4));
  const water = ease(rinse / 0.25) * (1 - ease((rinse - 0.8) / 0.2));
  const sweep = ease(cond / 0.5) * (1 - ease((rinse - 0.05) / 0.4));
  const flatten = ease(flat);
  const endpoint = end >= 0 && rinse < 0.2 ? ease(end / 0.3) * (1 - ease(rinse / 0.2)) : 0;
  const brush = ease((clean - 0.68) / 0.25);
  return { u, c, h, platen, headSpin, slurryOn, water, sweep, flatten, dish: ease((end - 0.6) / 0.4), endpoint, brush, cupWafer, waferClean: clean >= 0.66 ? 1 : 0, wetLevel: ease(slurry / 2) };
}

// ---- drawing helpers for the parts that turn ----
const V3 = D.V;
const facing = (nx, ny, nz) => nx * V3[0] + ny * V3[1] + nz * V3[2];
const pathOf2 = (pts, closed) => pts.map((p, i) => `${i ? "L" : "M"}${f1(p[0])} ${f1(p[1])}`).join("") + (closed ? "Z" : "");
function spinTicks(cx, cy, r, z0, z1, count, angle) {
  let out = "";
  for (let i = 0; i < count; i++) {
    const a = angle + (i * TAU) / count;
    const f = facing(Math.cos(a), Math.sin(a), 0);
    if (f < 0.06) continue;
    const alpha = clamp((f - 0.06) / 0.3);
    const p0 = iso([cx + r * Math.cos(a), cy + r * Math.sin(a), z0 + 0.15], P);
    const p1 = iso([cx + r * Math.cos(a), cy + r * Math.sin(a), z1 - 0.15], P);
    out += `<path class="iso-line" data-tone="lo" opacity="${alpha.toFixed(2)}" d="M${f1(p0[0])} ${f1(p0[1])}L${f1(p1[0])} ${f1(p1[1])}"/>`;
  }
  return out;
}
function windowAt(angle, glow) {
  const lit = glow > 0.02;
  const [cx, cy] = D.PLATEN;
  const pts = [];
  const r0 = 52;
  const r1 = 74;
  const half = 0.085;
  for (let i = 0; i <= 8; i++) pts.push([r0 + ((r1 - r0) * i) / 8, -half]);
  for (let i = 0; i <= 8; i++) pts.push([r1 - ((r1 - r0) * i) / 8, half]);
  const screen = pts.map(([r, t]) => iso([cx + r * Math.cos(angle + t * (64 / r)), cy + r * Math.sin(angle + t * (64 / r)), D.PAD_TOP], P));
  const d = pathOf2(screen, true);
  return `<path class="cmp-window${lit ? " cmp-window-lit" : ""}"${lit ? ` style="fill-opacity:${(0.55 * glow).toFixed(2)}"` : ""} d="${d}"/><path class="iso-line" data-tone="${glow > 0.4 ? "lit" : "lo"}" d="${d}"/>`;
}
function spinDots(cx, cy, r, z, count, angle) {
  const pts = [];
  for (let i = 0; i < count; i++) {
    const a = angle + (i * TAU) / count;
    pts.push(iso([cx + r * Math.cos(a), cy + r * Math.sin(a), z], P));
  }
  return dotsSvg(pts, { size: 0.5 });
}
function rollerRibs(side, angle) {
  const C = D.CLEAN;
  const x = C.cx + side * (C.rollR + 0.7);
  let out = "";
  const n = 14;
  for (let i = 0; i < n; i++) {
    const a = angle * side + (i * TAU) / n;
    const nx = Math.cos(a);
    const nz = Math.sin(a);
    const f = facing(nx, 0, nz);
    if (f < 0.08) continue;
    const alpha = clamp((f - 0.08) / 0.35) * 0.9;
    const r = C.rollR;
    const p0 = iso([x + r * nx, C.y0 + 0.2, C.cz + r * nz], P);
    const p1 = iso([x + r * nx, C.y1 - 0.2, C.cz + r * nz], P);
    out += `<path class="iso-line" data-tone="lo" opacity="${alpha.toFixed(2)}" d="M${f1(p0[0])} ${f1(p0[1])}L${f1(p1[0])} ${f1(p1[1])}"/>`;
  }
  return out;
}
function streamAt(i, alpha, kind) {
  if (alpha < 0.01) return "";
  const x = D.NOZZLES[i];
  const y = D.NOZZLE_Y;
  const w = 1.1 * Math.min(1, alpha * 1.4);
  const a = iso([x - w, y, D.NOZZLE_TIP], P);
  const b = iso([x + w, y, D.NOZZLE_TIP], P);
  const c = iso([x + w, y, D.PAD_TOP], P);
  const d = iso([x - w, y, D.PAD_TOP], P);
  return `<path class="cmp-stream cmp-${kind}" opacity="${alpha.toFixed(2)}" d="${pathOf2([a, b, c, d], true)}"/>`;
}
function puddle(level, water) {
  if (level < 0.01) return "";
  const [cx, cy] = D.PLATEN;
  const nx = D.NOZZLES[0];
  const ny = D.NOZZLE_Y;
  const r0 = Math.hypot(nx - cx, ny - cy);
  const a0 = Math.atan2(ny - cy, nx - cx);
  // the pad carries the slurry round from the drip point and spreads it outward as it turns
  const sweep = Math.min(TAU - 0.02, 0.6 + TAU * 1.3 * level);
  const inner = Math.max(6, r0 - 8 - 10 * level);
  const outer = Math.min(D.PAD_R - 3, r0 + 8 + 62 * level);
  const n = 64;
  const rim = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = a0 + sweep * t;
    // the leading tip thins out where the newest slurry has not spread yet
    const grow = Math.min(1, (1 - t) * 3 + 0.25);
    rim.push(iso([cx + (inner + (outer - inner) * (1 - grow) * 0.5) * Math.cos(a), cy + (inner + (outer - inner) * (1 - grow) * 0.5) * Math.sin(a), D.PAD_TOP], P));
  }
  const out = [];
  for (let i = n; i >= 0; i--) {
    const t = i / n;
    const a = a0 + sweep * t;
    const grow = Math.min(1, (1 - t) * 3 + 0.25);
    out.push(iso([cx + (outer - (outer - inner) * (1 - grow) * 0.5) * Math.cos(a), cy + (outer - (outer - inner) * (1 - grow) * 0.5) * Math.sin(a), D.PAD_TOP], P));
  }
  const band = sweep >= TAU - 0.03 ? ring(inner, outer) : pathOf2([...rim, ...out], true);
  function ring(a, b) {
    const one = (r) => {
      const pts = [];
      for (let i = 0; i < 72; i++) {
        const t = (i / 72) * TAU;
        pts.push(iso([cx + r * Math.cos(t), cy + r * Math.sin(t), D.PAD_TOP], P));
      }
      return pts;
    };
    return pathOf2(one(b), true) + pathOf2(one(a).reverse(), true);
  }
  const spot = [];
  for (let i = 0; i < 24; i++) {
    const t = (i / 24) * TAU;
    spot.push(iso([nx + 3 + 7 * Math.cos(t), ny + 7 * Math.sin(t), D.PAD_TOP], P));
  }
  const kind = water > 0.5 ? " cmp-wet-water" : "";
  return `<path class="cmp-wet${kind}" fill-rule="evenodd" opacity="${(0.7 * Math.min(1, level * 1.6)).toFixed(2)}" d="${band}"/><path class="cmp-wet cmp-wet-spot${kind}" opacity="${(0.9 * Math.min(1, level * 3)).toFixed(2)}" d="${pathOf2(spot, true)}"/>`;
}

// ---- Fig 1b: the copper section flattening ----
const SEC = { w: 300, ox: 30, depth: 14, trench: [[22, 46], [70, 82], [100, 110], [150, 226], [252, 262], [276, 286]] };
const trenchAt = (x) => SEC.trench.find(([a, b]) => x > a && x < b);
const startAt = (x) => {
  // electroplated overburden: humped over the dense narrow lines, dipped over the wide trench
  let y = 12;
  y -= 5 * Math.exp(-(((x - 92) / 26) ** 2));
  y -= 4 * Math.exp(-(((x - 270) / 18) ** 2));
  y += 6 * Math.exp(-(((x - 188) / 34) ** 2));
  y += 1.4 * Math.sin(x / 6);
  return y;
};
function drawSection(p, dish) {
  const level = 4 + (SEC.ox - 4) * p;
  const xs = [];
  for (let x = 0; x <= SEC.w; x += 2) xs.push(x);
  for (const [a, b] of SEC.trench) xs.push(a + 0.01, b - 0.01);
  xs.sort((a, b) => a - b);
  const floor = (x) => (trenchAt(x) ? SEC.ox + SEC.depth : SEC.ox);
  const surf = xs.map((x) => {
    let y = Math.max(startAt(x), level);
    const tr = trenchAt(x);
    if (tr && p >= 0.999) y = SEC.ox + dish * (tr[1] - tr[0] > 40 ? 2.2 : 0.5) * Math.sin((Math.PI * (x - tr[0])) / (tr[1] - tr[0]));
    return [x, Math.min(y, floor(x))];
  });
  const top = surf.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`).join("");
  let bottom = `L${SEC.w} ${SEC.ox}`;
  for (const [a, b] of [...SEC.trench].reverse()) bottom += `L${b} ${SEC.ox}L${b} ${SEC.ox + SEC.depth}L${a} ${SEC.ox + SEC.depth}L${a} ${SEC.ox}`;
  bottom += `L0 ${SEC.ox}`;
  section.cu.setAttribute("d", top + bottom + "Z");
  section.surf.setAttribute("d", p >= 0.999 ? "" : top);
  const bar = [];
  for (const [a, b] of SEC.trench) bar.push(`M${a} ${SEC.ox}L${a} ${SEC.ox + SEC.depth}L${b} ${SEC.ox + SEC.depth}L${b} ${SEC.ox}`);
  bar.push(`M0 ${SEC.ox}` + SEC.trench.map(([a, b]) => `L${a} ${SEC.ox}M${b} ${SEC.ox}`).join("") + `L${SEC.w} ${SEC.ox}`);
  section.barrier.setAttribute("d", bar.join(""));
  const text = p < 0.02 ? "copper overburden over the trenches: lumpy" : p < 0.999 ? `polishing · high points go first · ${Math.round(p * 100)} %` : dish > 0.5 ? "flat · copper left only in the trenches, slightly dished" : "barrier exposed · endpoint";
  if (section.note.textContent !== text) section.note.textContent = text;
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
const ang = { platen: 0, head: 0, cond: 0, sweep: 0, roll: 0 };
const SECONDS = 26;
// where inside each step a reduced-motion jump lands: cup up, slurry spreading, head down, conditioner on the pad, part-polished, window lit, water on, wafer in the brushes
const STILL_AT = { load: 0.4, slurry: 0.7, press: 0.9, condition: 0.7, flatten: 0.7, endpoint: 0.7, rinse: 0.7, clean: 0.85 };
let lastCond = "";
let litAt = -Infinity;
let spoken = "";

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
    if (node.piece === "carriage") return [D.DX * pose.c, 0, 0];
    if (node.piece === "head") return [D.DX * pose.c, 0, D.LIFT * pose.h];
    if (node.piece === "cup") return [0, 0, D.CUP_STROKE * pose.u];
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
      if (node.piece === "cup" && node === cupRodNode) holdStill(node.el, [tx, ty]);
    }
  }
  if (rodClip) {
    const zx = D.EZ[0] * D.LIFT * pose.h;
    const zy = D.EZ[1] * D.LIFT * pose.h;
    rodClip.setAttribute("transform", `translate(${(-zx).toFixed(2)} ${(-zy).toFixed(2)})`);
  }
  const next = nodes.map((_, i) => i).sort((a, b) => nodes[a].depth - nodes[b].depth);
  if (next.some((index, i) => index !== order[i])) {
    const fragment = document.createDocumentFragment();
    for (const index of next) fragment.appendChild(nodes[index].el);
    layers.appendChild(fragment);
    order = next;
  }
}

function draw(pose) {
  place(pose);
  const [px, py] = D.PLATEN;
  const [hx, hy] = D.HEAD;
  // the sensor reads the film only while the window passes under the wafer: it blinks once a revolution
  const wx = px + 63 * Math.cos(ang.platen) - hx;
  const wy = py + 63 * Math.sin(ang.platen) - hy;
  const under = pose.h < 0.2 && Math.hypot(wx, wy) < D.WAFER_R + 10;
  // the head hides the window while it reads, so it keeps glowing on a short decaying arc as it comes out from under the ring
  if (pose.endpoint > 0.5 && under) litAt = ang.platen;
  // with motion reduced the platen stands still, so the window simply shows lit for the whole endpoint step
  const glow = pose.endpoint > 0.5 ? (under || still.matches ? 1 : clamp(1 - (ang.platen - litAt) / 2.2)) : 0;
  spin.pad.innerHTML = windowAt(ang.platen, glow);
  spin.side.innerHTML = spinTicks(px, py, D.PLATEN_R, 5, 16, 12, ang.platen);
  spin.body.innerHTML = spinTicks(hx, hy, D.BODY_R, 24, D.BODY_TOP, 10, ang.head);
  spin.plate.innerHTML = spinDots(hx, hy, D.PLATE_R - 6.5, D.PLATE_TOP, 8, ang.head);
  wet.innerHTML = puddle(pose.wetLevel * (1 - pose.brush * 0.6), pose.water);
  streams[0].innerHTML = streamAt(0, pose.slurryOn, "slurry");
  streams[1].innerHTML = streamAt(1, pose.water, "water");
  const deg = D.SWEEP.park + (D.SWEEP.from - D.SWEEP.park + (D.SWEEP.to - D.SWEEP.from) * (0.5 - 0.5 * Math.cos(ang.sweep))) * pose.sweep;
  const condKey = `${deg.toFixed(2)}|${(ang.cond % TAU).toFixed(2)}`;
  if (condKey !== lastCond) {
    lastCond = condKey;
    const part = condParts(deg, KIT, P, D.COND, D.PIVOT, D.COND_L);
    condEl.innerHTML = part.svg + spinDots(part.d[0], part.d[1], D.COND.capR - 4, D.COND.capTop, 3, ang.cond);
  }
  rolls.forEach((el) => (el.innerHTML = rollerRibs(Number(el.dataset.roll), ang.roll)));
  cupWafer.style.opacity = pose.cupWafer.toFixed(2);
  cleanWafer.style.opacity = pose.waferClean.toFixed(2);
  stage.toggleAttribute("data-endpoint", pose.endpoint > 0.5);
  if (headCut) {
    const pressed = pose.h < 0.25 && pose.headSpin > 0.2;
    headCut.toggleAttribute("data-pressed", pressed);
    headCut.style.setProperty("--cmp-lift", `${(pose.h * 8).toFixed(2)}px`);
  }
  drawSection(pose.flatten, pose.dish);
}

function stepLabel() {
  const index = PH.indexOf(phaseAt(s));
  return `${String(index + 1).padStart(2, "0")} · ${PH[index].label}`;
}
function readoutText(pose) {
  if (selected) return D.pieces[selected].say;
  const p = phaseAt(s);
  if (p.id === "flatten") return `${p.say} · ${Math.round(pose.flatten * 100)} % of overburden removed`;
  return p.say;
}
function showPlay() {
  playText.textContent = playing ? "Pause" : s >= 0.999 ? "Replay" : "Play";
  playButton.toggleAttribute("data-playing", playing);
  playButton.setAttribute("aria-label", playing ? "Pause the polish" : "Play the polish");
  const text = stepLabel();
  if (stepText.textContent !== text) {
    stepText.textContent = text;
    scrubInput.setAttribute("aria-valuetext", text);
  }
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
      if (touring) {
        s = 0;
      } else playing = false;
    } else {
      s = Math.min(1, s + dt / SECONDS);
      if (s >= 1 && touring) holdUntil = now + 2600;
    }
  }
  const pose = poseAt(s);
  if (!calm) {
    ang.platen += dt * pose.platen * 2.4;
    ang.head += dt * pose.headSpin * 2.5;
    ang.cond += dt * pose.sweep * 3.2;
    ang.sweep += dt * pose.sweep * 1.3;
    ang.roll += dt * pose.brush * 3;
  }
  draw(pose);
  showPlay();
  say(readoutText(pose));
  describe();
  const moving = !calm && (playing || touring || pose.platen > 0.001 || pose.headSpin > 0.001 || pose.sweep > 0.001 || pose.brush > 0.001);
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
  const item = hit && hit.closest ? hit.closest(".cmp-it") : null;
  return item ? item.dataset.part : null;
}
stage.addEventListener("pointermove", (event) => {
  if (event.pointerType === "touch") return;
  inside = true;
  touring = false;
  clearTimeout(leaveTimer);
  select(partAt(event));
  run();
});
stage.addEventListener("pointerleave", (event) => {
  // a finger "leaves" on every lift: only a hovering pointer clears the selection
  if (event.pointerType === "touch") return;
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
    if (still.matches) {
      // reduced motion: jump to the next step instead of animating, landing where that step's pose says what its label says
      const index = s >= 0.999 ? 0 : PH.indexOf(phaseAt(s)) + 1;
      const p = PH[index];
      s = p ? p.t0 + (STILL_AT[p.id] ?? 0.7) * (p.t1 - p.t0) : 1;
    } else {
      if (s >= 0.999) s = 0;
      playing = true;
    }
  }
  showPlay();
  run();
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
    return;
  }
  const index = selected ? D.order.indexOf(selected) : -1;
  let next = null;
  if (event.key === "ArrowRight" || event.key === "ArrowDown") next = Math.min(D.order.length - 1, index + 1);
  else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = Math.max(0, index - 1);
  else if (event.key === "Home") next = 0;
  else if (event.key === "End") next = D.order.length - 1;
  else if (/^[1-9]$/.test(event.key) && Number(event.key) <= D.order.length) next = Number(event.key) - 1;
  if (next === null) return;
  event.preventDefault();
  quietTour();
  select(D.order[next]);
  run();
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
const hint = root.querySelector(".cmp-hint");
const wording = () => hint && (hint.textContent = narrow.matches ? "Tap a part · Play below" : "Hover a part · Space plays");
wording();
narrow.addEventListener("change", wording);
const pose0 = poseAt(s);
draw(pose0);
showPlay();
say(readoutText(pose0));
