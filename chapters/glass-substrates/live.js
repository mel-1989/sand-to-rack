const D = __DATA__;
const root = document.querySelector(".gs");
const stage = root.querySelector(".gs-stage");
const layers = stage.querySelector(".gs-layers");
const live = root.querySelector("[data-live]");
const readout = root.querySelector("[data-readout]");
const partButtons = [...root.querySelectorAll(".gs-part")];
const scrubInput = root.querySelector("[data-scrub]");
const playButton = root.querySelector("[data-play]");
const playText = root.querySelector("[data-play-text]");
const stepText = root.querySelector("[data-step]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (t) => {
  const x = clamp(t);
  return x * x * (3 - 2 * x);
};
const lerp = (a, b, t) => a + (b - a) * t;
const f1 = (n) => n.toFixed(1);

// ---- nodes, painter's order ----
const nodes = [...layers.querySelectorAll(".gs-it")].map((el) => {
  const m = el.dataset.m.split(",").map(Number);
  return { el, piece: el.dataset.piece, part: el.dataset.part, key: Number(el.dataset.k), m, lift: m[0] * D.V[0] + m[1] * D.V[1] + m[2] * D.V[2], shown: "" };
});
let order = nodes.map((_, i) => i);
const find = (sel) => layers.querySelector(sel);
const el = {
  vias: [...layers.querySelectorAll(".gs-via")],
  films: [...layers.querySelectorAll(".gs-film")],
  kerfX: find('[data-kerf="x"]'),
  kerfY: find('[data-kerf="y"]'),
  wet: find("[data-wet]"),
  beam: find("[data-beam]"),
  chips: [...layers.querySelectorAll("[data-chips]")],
};

// ---- world to screen (the build's projection, as three axis vectors and an origin) ----
const proj = ([x, y, z]) => [D.O[0] + D.EX[0] * x + D.EY[0] * y + D.EZ[0] * z, D.O[1] + D.EX[1] * x + D.EY[1] * y + D.EZ[1] * z];

// ---- the process as a function of the slider position s (0..1) ----
const PH = D.phases;
const phaseIndex = (s) => {
  const i = PH.findIndex((p) => s < p.t1);
  return i < 0 ? PH.length - 1 : i;
};
const local = (id, s) => {
  const p = PH.find((q) => q.id === id);
  return clamp((s - p.t0) / (p.t1 - p.t0), -1, 2);
};
const ROWS = [...new Set(D.vias.map((v) => v.y))].sort((a, b) => a - b);
const rowOf = D.vias.map((v) => ROWS.indexOf(v.y));
const XS = D.vias.map((v) => v.x);
const xMin = Math.min(...XS);
const xMax = Math.max(...XS);
const tableFor = (yLocal) => (D.by - yLocal) / D.yTravel; // table share that puts a panel row under the beam
const headFor = (x) => x / D.hx;
const PARK = { t: 0, h: D.park };
const panelY0 = D.panel.y;
const panelY1 = D.panel.y + D.panel.d;

function laserPose(u) {
  // lead in from park, write every row (serpentine), lead out to park
  const lead = 0.05;
  const N = ROWS.length;
  const start = { t: tableFor(ROWS[0]), h: headFor(xMin - 6) };
  if (u <= 0) return { ...PARK, row: -1, x: -1e9, dir: 1, on: false };
  if (u < lead) {
    const e = ease(u / lead);
    return { t: lerp(PARK.t, start.t, e), h: lerp(PARK.h, start.h, e), row: -1, x: -1e9, dir: 1, on: false };
  }
  if (u >= 1 - lead) {
    const lastDir = (N - 1) % 2 ? -1 : 1;
    const e = ease((u - (1 - lead)) / lead);
    return { t: lerp(tableFor(ROWS[N - 1]), PARK.t, e), h: lerp(headFor(lastDir > 0 ? xMax + 6 : xMin - 6), PARK.h, e), row: N, x: 0, dir: 1, on: false };
  }
  const v = ((u - lead) / (1 - 2 * lead)) * N;
  const i = Math.min(N - 1, Math.floor(v));
  const f = v - i;
  const dir = i % 2 ? -1 : 1;
  const step = 0.14;
  const a = xMin - 6;
  const b = xMax + 6;
  if (f < step && i > 0) {
    // the table steps to the next row while the head waits at the end
    const e = ease(f / step);
    const x = dir > 0 ? a : b;
    return { t: lerp(tableFor(ROWS[i - 1]), tableFor(ROWS[i]), e), h: headFor(x), row: i, x: dir > 0 ? -1e9 : 1e9, dir, on: false };
  }
  const g = i > 0 ? (f - step) / (1 - step) : f;
  const x = dir > 0 ? lerp(a, b, g) : lerp(b, a, g);
  return { t: tableFor(ROWS[i]), h: headFor(x), row: i, x, dir, on: true };
}

function cutPose(u) {
  // first the street along x (head sweeps), then the street along y (table sweeps)
  const e0 = 0.08;
  const yRow = 0;
  const xa = D.panel.x - 6;
  const xb = D.panel.x + D.panel.w + 6;
  if (u <= 0) return { ...PARK, kx: 0, ky: 0, on: false };
  if (u < e0) {
    const e = ease(u / e0);
    return { t: lerp(PARK.t, tableFor(yRow), e), h: lerp(PARK.h, headFor(xa), e), kx: 0, ky: 0, on: false };
  }
  if (u < 0.46) {
    const g = (u - e0) / (0.46 - e0);
    const x = lerp(xa, xb, g);
    return { t: tableFor(yRow), h: headFor(x), kx: clamp((x - D.panel.x) / D.panel.w), ky: 0, on: x > D.panel.x && x < D.panel.x + D.panel.w };
  }
  if (u < 0.54) {
    const e = ease((u - 0.46) / 0.08);
    return { t: lerp(tableFor(yRow), tableFor(panelY0 - 6), e), h: lerp(headFor(xb), 0, e), kx: 1, ky: 0, on: false };
  }
  if (u < 0.92) {
    const g = (u - 0.54) / 0.38;
    const y = lerp(panelY0 - 6, panelY1 + 6, g);
    return { t: tableFor(y), h: 0, kx: 1, ky: clamp((y - panelY0) / D.panel.d), on: y > panelY0 && y < panelY1 };
  }
  const e = ease((u - 0.92) / 0.08);
  return { t: lerp(tableFor(panelY1 + 6), PARK.t, e), h: lerp(0, PARK.h, e), kx: 1, ky: 1, on: false };
}

function poseAt(s) {
  const laser = local("laser", s);
  const etch = local("etch", s);
  const fillU = local("fill", s);
  const rdl = local("rdl", s);
  const cut = local("cut", s);
  const attach = local("attach", s);
  let mech = { ...PARK, on: false };
  let lz = null;
  if (laser >= 0 && laser < 1) mech = lz = laserPose(laser);
  let ck = { kx: 0, ky: 0 };
  if (cut >= 0) {
    ck = cut >= 1 ? { kx: 1, ky: 1 } : cutPose(cut);
    if (cut < 1) mech = ck;
  }
  const front = (u) => lerp(panelY0 - 10, panelY1 + 10, clamp(u));
  return {
    t: mech.t,
    h: mech.h,
    beam: !!mech.on,
    written: laser >= 1 ? Infinity : lz ? lz : null,
    etchFront: etch < 0 ? -Infinity : etch >= 1 ? Infinity : front(etch),
    fillFront: fillU < 0 ? -Infinity : fillU >= 1 ? Infinity : front(fillU),
    wet: etch >= 0 && etch < 1 ? front(etch) : fillU >= 0 && fillU < 1 ? front(fillU) : null,
    film: rdl >= 0.05,
    layers: rdl < 0 ? 0 : Math.min(D.rdl, Math.floor((rdl - 0.15) / 0.25) + 1),
    bumps: rdl >= 0.92,
    kx: ck.kx,
    ky: ck.ky,
    chips: D.sites.map((_, i) => (attach < 0 ? 0 : ease((attach - i * 0.17) / 0.4))),
  };
}

function viaState(i, pose) {
  const v = D.vias[i];
  if (pose.film) return 0;
  if (pose.fillFront !== -Infinity && v.y < pose.fillFront) return 3;
  if (pose.etchFront !== -Infinity && v.y < pose.etchFront) return 2;
  const w = pose.written;
  if (w === Infinity) return 1;
  if (!w) return 0;
  const r = rowOf[i];
  if (r < w.row) return 1;
  if (r > w.row) return 0;
  // the current row: sites just behind the head flash lit, then settle to the modified tone
  const behind = w.dir > 0 ? w.x - v.x : v.x - w.x;
  if (behind < 0) return 0;
  if (!w.on) return 1;
  return behind < 6 ? 4 : behind < 18 ? 5 : 1;
}

// ---- writing the pose to the page ----
const share = { stand: 0, table: 0, head: D.park };
const viaShown = new Array(D.vias.length).fill(-1);
let shownPose = null;

function setOn(node, on) {
  if (!node) return;
  if (on) node.setAttribute("data-on", "");
  else node.removeAttribute("data-on");
}

function draw(pose) {
  share.table = pose.t;
  share.head = pose.h;
  for (let i = 0; i < D.vias.length; i++) {
    const st = viaState(i, pose);
    if (st !== viaShown[i]) {
      viaShown[i] = st;
      el.vias[i].setAttribute("data-s", String(st));
    }
  }
  el.films.forEach((g) => {
    setOn(g, pose.film);
    g.querySelectorAll(".gs-rdl").forEach((layer) => setOn(layer, Number(layer.dataset.layer) < pose.layers));
    setOn(g.querySelector(".gs-bumps"), pose.bumps);
  });
  for (const [g, p] of [[el.kerfX, pose.kx], [el.kerfY, pose.ky]]) {
    setOn(g, p > 0);
    g.querySelectorAll("path").forEach((path) => path.setAttribute("stroke-dasharray", p >= 1 ? "none" : `${p.toFixed(4)} 2`));
  }
  setOn(el.beam, pose.beam);
  if (pose.wet === null) el.wet.setAttribute("d", "");
  else {
    const y0 = clamp(pose.wet - 14, panelY0, panelY1);
    const y1 = clamp(pose.wet, panelY0, panelY1);
    const x0 = D.panel.x;
    const x1 = D.panel.x + D.panel.w;
    const z = D.glassTop;
    const pts = [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]].map(proj);
    el.wet.setAttribute("d", y1 > y0 ? `M${pts.map((p) => `${f1(p[0])} ${f1(p[1])}`).join("L")}Z` : "");
  }
  pose.chips.forEach((c, i) => {
    setOn(el.chips[i], c > 0.001);
    const lift = (1 - c) * 26;
    el.chips[i].setAttribute("transform", c >= 1 ? "" : `translate(0 ${(-lift * Math.abs(D.EZ[1])).toFixed(2)})`);
    el.chips[i].style.opacity = c >= 1 ? "" : String(clamp(c * 1.6));
  });
  place();
}

function place() {
  for (const node of nodes) {
    const sh = share[node.piece] ?? 0;
    const tx = (D.EX[0] * node.m[0] + D.EY[0] * node.m[1] + D.EZ[0] * node.m[2]) * sh;
    const ty = (D.EX[1] * node.m[0] + D.EY[1] * node.m[1] + D.EZ[1] * node.m[2]) * sh;
    const text = Math.abs(tx) < 1e-3 && Math.abs(ty) < 1e-3 ? "" : `translate(${tx.toFixed(2)} ${ty.toFixed(2)})`;
    if (text !== node.shown) {
      node.shown = text;
      if (text) node.el.setAttribute("transform", text);
      else node.el.removeAttribute("transform");
    }
  }
  const keyOf = (n) => n.key + n.lift * (share[n.piece] ?? 0);
  const next = nodes.map((_, i) => i).sort((a, b) => keyOf(nodes[a]) - keyOf(nodes[b]));
  if (next.some((index, i) => index !== order[i])) {
    const fragment = document.createDocumentFragment();
    for (const index of next) fragment.appendChild(nodes[index].el);
    layers.appendChild(fragment);
    order = next;
  }
}

// ---- readout and step label ----
let s = 0;
let selected = null;
function stepLabel(x) {
  const i = phaseIndex(x);
  return `${String(i + 1).padStart(2, "0")} · ${PH[i].label}`;
}
function detail(x, pose) {
  const id = PH[phaseIndex(x)].id;
  if (id === "laser") {
    const w = pose.written;
    const row = w && w !== Infinity ? Math.max(0, Math.min(ROWS.length, w.row + (w.on ? 1 : 0))) : w === Infinity ? ROWS.length : 0;
    return `laser · row ${row} / ${ROWS.length} · ${D.facts.pulses} pulse a via`;
  }
  if (id === "rdl") return `build-up · layer ${Math.max(1, pose.layers)} / ${D.rdl} both faces`;
  if (id === "cut") return `singulate · street ${pose.ky > 0 ? 2 : 1} / 2 · ${D.facts.sites} × ${D.facts.pkg} mm`;
  if (id === "attach") return `attach · ${pose.chips.filter((c) => c >= 0.999).length} / ${D.facts.sites} packages`;
  return PH[phaseIndex(x)].short || PH[phaseIndex(x)].say;
}
function say(text) {
  if (readout.textContent !== text) readout.textContent = text;
}
let spoken = "";
function describe() {
  const text = selected ? `${D.pieces[selected].name}: ${D.pieces[selected].say}` : `${stepLabel(s)}: ${PH[phaseIndex(s)].say}`;
  if (stage.getAttribute("aria-valuetext") !== text) stage.setAttribute("aria-valuetext", text);
  const step = stepLabel(s);
  if (scrubInput.getAttribute("aria-valuetext") !== step) scrubInput.setAttribute("aria-valuetext", step);
  if (document.activeElement === stage && text !== spoken) {
    spoken = text;
    live.textContent = text;
  }
}
let lastPose = null;
function render() {
  const pose = poseAt(s);
  lastPose = pose;
  draw(pose);
  const label = stepLabel(s);
  if (stepText.textContent !== label) stepText.textContent = label;
  scrubInput.value = String(Math.round(s * 1000));
  say(selected ? D.pieces[selected].say : s <= 0.0005 ? D.idle : detail(s, pose));
  playText.textContent = playing ? "Pause" : s >= 0.999 ? "Replay" : "Play";
  playButton.toggleAttribute("data-playing", !!playing);
  playButton.setAttribute("aria-label", playing ? "Pause the process" : "Play the process");
}

// ---- selection ----
function select(id) {
  if (id === "base") id = null;
  if (selected === id) return;
  selected = id;
  for (const node of nodes) setOn(node.el, id !== null && node.part === id);
  if (id) stage.setAttribute("data-focus", "");
  else stage.removeAttribute("data-focus");
  partButtons.forEach((b) => {
    setOn(b, b.dataset.part === id);
    b.setAttribute("aria-pressed", b.dataset.part === id ? "true" : "false");
  });
  root.toggleAttribute("data-coupons", id === "coupons");
  render();
  describe();
}

// ---- loop: play, tour ----
const SECONDS = 30; // a full pass, compressed
let playing = false;
let touring = !still.matches;
let tourHold = 0;
let idleTimer = 0;
let visible = false;
let frame = 0;
let last = 0;
let lastPhase = -1;

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  if (touring) {
    if (s >= 1) {
      tourHold += dt;
      if (tourHold > 2.6) {
        s = 0;
        tourHold = 0;
      }
    } else s = Math.min(1, s + dt / SECONDS);
  } else if (playing) {
    s = Math.min(1, s + dt / SECONDS);
    if (s >= 1) playing = false;
  }
  render();
  const ph = phaseIndex(s);
  if (ph !== lastPhase) {
    lastPhase = ph;
    describe();
  }
  frame = visible && (playing || touring) ? requestAnimationFrame(tick) : 0;
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

function takeOver() {
  touring = false;
  clearTimeout(idleTimer);
}

function jumpTo(x) {
  s = clamp(x);
  render();
  describe();
}

// ---- input ----
function partAt(event) {
  const hit = document.elementFromPoint(event.clientX, event.clientY);
  const item = hit && hit.closest ? hit.closest(".gs-it") : null;
  return item ? item.dataset.part : null;
}
let leaveTimer = 0;
stage.addEventListener("pointermove", (event) => {
  if (event.pointerType === "touch") return;
  clearTimeout(leaveTimer);
  const id = partAt(event);
  if (id && id !== "base" && touring) takeOver();
  select(id);
});
stage.addEventListener("pointerleave", (event) => {
  // a touch tap fires pointerleave right after pointerup: keep the tapped part lit
  if (event.pointerType === "touch") return;
  clearTimeout(leaveTimer);
  leaveTimer = setTimeout(() => select(null), 240);
});
stage.addEventListener("pointerdown", (event) => {
  if (event.pointerType !== "touch") {
    takeOver();
    stage.focus({ preventScroll: true });
    return;
  }
  takeOver();
  const id = partAt(event);
  select(id && id !== selected ? id : null);
});
partButtons.forEach((button) => {
  const show = () => {
    takeOver();
    clearTimeout(leaveTimer);
    select(button.dataset.part);
  };
  const hide = () => {
    clearTimeout(leaveTimer);
    leaveTimer = setTimeout(() => {
      if (partButtons.some((b) => b.matches(":hover, :focus-visible"))) return;
      select(null);
    }, 240);
  };
  button.addEventListener("pointerenter", show);
  button.addEventListener("focus", show);
  button.addEventListener("pointerleave", (event) => {
    if (event.pointerType !== "touch") hide();
  });
  button.addEventListener("blur", hide);
  button.addEventListener("click", show);
});
const sectionsBox = root.querySelector("[data-sections]");
if (sectionsBox) {
  sectionsBox.addEventListener("pointerenter", (event) => {
    if (event.pointerType === "touch") return;
    takeOver();
    clearTimeout(leaveTimer);
    select("coupons");
  });
  sectionsBox.addEventListener("pointerleave", (event) => {
    if (event.pointerType === "touch") return;
    clearTimeout(leaveTimer);
    leaveTimer = setTimeout(() => select(null), 240);
  });
  sectionsBox.addEventListener("click", () => {
    takeOver();
    select(selected === "coupons" ? null : "coupons");
  });
}
stage.addEventListener("focus", () => {
  spoken = "";
  describe();
});

// a still that shows a step doing its work: the laser step once every row is written, the others mid-step
function stillOf(i) {
  const p = PH[i];
  return p.id === "laser" ? p.t1 - 0.002 : (p.t0 + p.t1) / 2;
}
function togglePlay() {
  takeOver();
  if (playing) {
    playing = false;
    render();
    return;
  }
  if (s >= 0.999) s = 0;
  if (still.matches) {
    // reduced motion: jump to a still of the next step instead of animating
    const i = phaseIndex(s);
    jumpTo(i + 1 < PH.length ? stillOf(i + 1) : 1);
    return;
  }
  playing = true;
  render();
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
    takeOver();
    playing = false;
    select(null);
    jumpTo(0);
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
  takeOver();
  select(D.order[next]);
});

scrubInput.addEventListener("input", () => {
  // read the value first: select(null) re-renders, and render() writes scrubInput.value from s,
  // which would overwrite a track click made while a part is selected
  const x = Number(scrubInput.value) / 1000;
  clearTimeout(leaveTimer);
  takeOver();
  playing = false;
  s = clamp(x);
  select(null);
  jumpTo(x);
});
// arrow keys on the slider step from one process step to the next (0.1% a press was too fine to use)
scrubInput.addEventListener("keydown", (event) => {
  const dir = event.key === "ArrowRight" || event.key === "ArrowUp" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowDown" ? -1 : 0;
  if (!dir || event.metaKey || event.ctrlKey || event.altKey) return;
  event.preventDefault();
  clearTimeout(leaveTimer);
  takeOver();
  playing = false;
  // forward: this step's still if short of it, else the next step's; back: mirror image
  const i = phaseIndex(s);
  const here = stillOf(i);
  const x = dir > 0 ? (s < here - 0.003 ? here : i + 1 < PH.length ? stillOf(i + 1) : 1) : s > here + 0.003 ? here : i > 0 ? stillOf(i - 1) : 0;
  select(null);
  jumpTo(x);
});
playButton.addEventListener("click", togglePlay);

document.addEventListener("themechange", () => render());
const narrow = matchMedia("(hover: none), (max-width: 480px)");
const hint = root.querySelector(".gs-hint");
const wording = () => hint && (hint.textContent = narrow.matches ? "Tap a part · Play steps the process" : "Hover a part · Space plays");
wording();
narrow.addEventListener("change", wording);
if (still.matches) touring = false;
partButtons.forEach((b) => b.setAttribute("aria-pressed", "false"));
render();
describe();
