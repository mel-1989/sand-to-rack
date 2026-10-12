const D = __DATA__;
const root = document.querySelector(".ic");
const stage = root.querySelector(".ic-stage");
const layersEl = stage.querySelector(".ic-layers");
const live = root.querySelector("[data-live]");
const readout = root.querySelector("[data-readout]");
const partButtons = [...root.querySelectorAll(".ic-part")];
const scrubInput = root.querySelector("[data-scrub]");
const playButton = root.querySelector("[data-play]");
const playText = root.querySelector("[data-play-text]");
const stepText = root.querySelector("[data-step]");
const psu = root.querySelector("[data-psu]");
const fillClip = root.querySelector("#ic-fill path");
const still = matchMedia("(prefers-reduced-motion: reduce)");

const nodes = [...layersEl.querySelectorAll(".it")].map((el) => ({
  el,
  piece: el.dataset.piece,
  key: Number(el.dataset.k),
  m: el.dataset.m.split(",").map(Number),
  shown: "",
}));
for (const node of nodes) node.lift = node.m[0] * D.V[0] + node.m[1] * D.V[1] + node.m[2] * D.V[2];
let order = nodes.map((_, index) => index);

// ---- the stack's layer groups ----
const LAYER = [...layersEl.querySelectorAll("[data-layer]")].map((g) => ({
  g,
  item: g.closest(".it"),
  index: Number(g.dataset.layer),
  z0: Number(g.dataset.z0),
  h: Number(g.dataset.h),
  part: Object.fromEntries([...g.querySelectorAll(":scope > [data-s]")].map((p) => [p.dataset.s, p])),
  clip: g.querySelector("[data-clip]"),
  topPath: g.querySelector('[data-s="top"] > path'),
  state: "",
}));
LAYER.sort((a, b) => a.index - b.index);
const padItem = layersEl.querySelector("[data-pad]").closest(".it");
const padGroup = layersEl.querySelector("[data-pad]");
const phaseGroups = [...layersEl.querySelectorAll("[data-phase]")];
const ubmFilm = layersEl.querySelector("[data-ubm]");
const ubmItem = ubmFilm.closest(".it");
const BUMPS = [...layersEl.querySelectorAll("[data-bump]")].map((g) => ({
  item: g.closest(".it"),
  disc: g.querySelector('[data-b="disc"]'),
  pillar: [...g.querySelectorAll('[data-b="pillar"]')],
  cap: [...g.querySelectorAll('[data-b="cap"]')],
  dome: g.querySelector('[data-b="dome"]'),
}));
const BUMP_STEPS = new Set(["pad", "ubm", "pillar", "reflow"]);
const PLATING = new Set(["plate", "pillar"]);

// ---- the process timeline ----
const SEQ = D.seq;
const TOTAL = SEQ.reduce((sum, step) => sum + step.weight, 0);
const STARTS = [];
SEQ.reduce((sum, step) => (STARTS.push(sum), sum + step.weight), 0);
function stepAt(s) {
  const u = Math.min(TOTAL, Math.max(0, s * TOTAL));
  let i = SEQ.length - 1;
  while (i > 0 && STARTS[i] > u) i--;
  const t = Math.min(1, (u - STARTS[i]) / SEQ[i].weight);
  return { i, t, ...SEQ[i] };
}
const ease = (t) => t * t * (3 - 2 * t);
const clamp = (v) => Math.min(1, Math.max(0, v));

let s = 1;
let selected = null;
let inside = false;
let leaveTimer = 0;
let touring = !still.matches;
let tourClock = 0;
let idleTimer = 0;
let visible = false;
let frame = 0;
let last = 0;
let spoken = "";
let playing = false;
let tookOver = false;
let headShare = 0;
let shown = null;
let scrubbing = false;

function say(text) {
  if (readout.textContent !== text) readout.textContent = text;
}

function show(el, on) {
  const want = on ? "" : "none";
  if (el.style.display !== want) el.style.display = want;
}

function solidInto(group, z, h, tone, className) {
  const paths = slabOf(D.SP, z, Math.max(0.02, h), D.P, 2, 0);
  group.innerHTML = solidSvg(paths, { tone, crease: "lo", className });
}

function clipTo(zf, z0) {
  const { SP, X1, Y1, P } = D;
  const a = [SP.x, Y1];
  const b = [X1, Y1];
  const c = [X1, SP.y];
  const pts = [[...a, z0 - 1], [...b, z0 - 1], [...c, z0 - 1], [...c, zf], [...b, zf], [...a, zf]].map((p) => iso(p, P));
  fillClip.setAttribute("d", pathOf(pts, true));
}

// state of one layer: "hidden", "done", or the active step with its share t
function setLayer(L, mode, t) {
  const key = mode === "done" || mode === "hidden" ? mode : `${mode}:${t.toFixed(3)}`;
  if (L.state === key) return;
  L.state = key;
  if (mode === "hidden") {
    show(L.item, false);
    return;
  }
  show(L.item, true);
  const p = L.part;
  const z1 = L.z0 + L.h;
  L.item.classList.toggle("ic-active", mode !== "done");
  if (mode === "lowk") {
    solidInto(p.lowk, L.z0, L.h * Math.max(0.02, ease(t)), "mid", "ic-lowk");
    p.lowk.dataset.grown = t >= 1 ? "1" : "0";
  } else if (p.lowk.dataset.grown === "0") {
    solidInto(p.lowk, L.z0, L.h, "mid", "ic-lowk");
    p.lowk.dataset.grown = "1";
  }
  show(p.lowk, true);
  show(p.cut, mode === "cut" || mode === "liner" || mode === "plate");
  show(p.liner, mode !== "lowk" && mode !== "cut");
  const fill = mode === "plate" ? clamp(t / 0.6) : mode === "done" || mode === "cmp" ? 1 : 0;
  show(p.cu, fill > 0);
  if (mode === "plate" && fill < 1) {
    L.clip.setAttribute("clip-path", "url(#ic-fill)");
    clipTo(L.z0 + L.h * ease(fill), L.z0);
  } else L.clip.removeAttribute("clip-path");
  // the top face: open trenches until the copper is polished flat
  const topOpen = mode === "cut" || mode === "liner" || (mode === "plate" && fill < 1);
  show(p.top, mode !== "lowk");
  L.topPath.setAttribute("class", topOpen ? "ic-void" : "ic-cu");
  // overburden grows at the end of plating and is polished off by CMP
  let ob = 0;
  if (mode === "plate") ob = clamp((t - 0.6) / 0.4);
  if (mode === "cmp") ob = 1 - clamp(t / 0.75);
  show(p.burden, ob > 0.001);
  if (ob > 0.001) solidInto(p.burden, z1, D.OB * ob, "hi", "ic-cu-solid");
}

function headAt(step) {
  if (!PLATING.has(step.step)) return 0;
  const t = step.t;
  if (t < 0.18) return ease(t / 0.18);
  if (t > 0.85) return ease((1 - t) / 0.15);
  return 1;
}

function apply() {
  const step = stepAt(s);
  const done = s >= 0.9995;
  const active = done ? D.layers.length : step.layer;
  for (const L of LAYER) {
    if (L.index < active) setLayer(L, "done", 1);
    else if (L.index > active) setLayer(L, "hidden", 0);
    else setLayer(L, step.step, step.t);
  }
  // passivation and pads, then the bumps
  const bumping = !done && BUMP_STEPS.has(step.step);
  const padOn = done || bumping;
  show(padItem, padOn);
  if (!done && step.step === "pad") padGroup.setAttribute("opacity", String(Math.max(0.05, ease(step.t)).toFixed(3)));
  else padGroup.removeAttribute("opacity");
  bumpsAt(done ? "done" : bumping ? step.step : "none", step.t);
  // the cell
  headShare = done ? 0 : headAt(step);
  const spinning = headShare > 0.98;
  const phase = spinning ? Math.floor(step.t * 70) % D.phases : 0;
  for (const g of phaseGroups) show(g, Number(g.dataset.phase) === phase);
  stage.toggleAttribute("data-flowing", spinning && !still.matches);
  const amps = ampsAt(step);
  const text = ampsText(amps);
  if (psu.textContent !== text) psu.textContent = text;
  stage.dataset.active = done ? "" : step.step;
  return { step, done };
}

// the plating current: one value feeds both the supply's display and the readout
function ampsAt(step) {
  if (headShare <= 0.98) return 0;
  if (step.step === "pillar") return D.amps.pillar;
  return step.t < 0.6 ? D.amps.fill : D.amps.burden;
}
const ampsText = (amps) => `${amps.toFixed(amps < 10 ? 1 : 0)}\u00a0mA/cm²`;

// bump stage: "none", "done", or the active bump step with its share t
let bumpKey = "";
function bumpsAt(mode, t) {
  const key = mode === "pad" || mode === "none" || mode === "done" ? mode : `${mode}:${t.toFixed(3)}`;
  if (key === bumpKey) return;
  bumpKey = key;
  // the blanket film: sputtered in, kept through plating, etched away between the bumps
  let film = 0;
  if (mode === "ubm") film = ease(clamp(t / 0.8));
  else if (mode === "pillar") film = 1;
  else if (mode === "reflow") film = 1 - ease(clamp((t - 0.15) / 0.3));
  show(ubmItem, film > 0.001);
  if (film > 0.001 && film < 1) ubmFilm.setAttribute("opacity", film.toFixed(3));
  else ubmFilm.removeAttribute("opacity");
  show(ubmFilm, film > 0.001);
  // pillar then cap grow while the head is down; reflow turns the flat cap into a dome
  let pillar = 0;
  let cap = 0;
  if (mode === "pillar") {
    pillar = clamp((t - 0.18) / 0.45);
    cap = clamp((t - 0.63) / 0.22);
  } else if (mode === "reflow" || mode === "done") {
    pillar = 1;
    cap = 1;
  }
  const domed = mode === "done" || (mode === "reflow" && t >= 0.6);
  const n = D.pillarPhases;
  const pj = Math.round(pillar * n);
  const cj = Math.round(cap * n);
  for (const b of BUMPS) {
    show(b.item, pj > 0);
    show(b.disc, film < 0.999 && pj > 0);
    b.pillar.forEach((g, i) => show(g, i + 1 === pj));
    b.cap.forEach((g, i) => show(g, !domed && i + 1 === cj));
    show(b.dome, domed);
  }
}

function layerName(step) {
  return BUMP_STEPS.has(step.step) ? "Bumps" : D.layers[step.layer].name;
}

function stepLabel() {
  if (s >= 0.9995) return "finished stack";
  if (s <= 0.0005) return "bare transistors";
  const step = stepAt(s);
  if (BUMP_STEPS.has(step.step)) return `bumps · ${D.steps[step.step].name}`;
  return `${layerName(step)} · ${D.steps[step.step].name}`;
}

function readoutText() {
  if (selected) return D.pieces[selected].say;
  if (s >= 0.9995) return D.idle;
  if (s <= 0.0005) return "transistors done · no wiring yet";
  const step = stepAt(s);
  const name = layerName(step);
  if (PLATING.has(step.step)) {
    // words from the same instant as the supply: no current while the head travels
    if (headShare < 0.98) return step.t < 0.5 ? `${name} · wafer entering bath · current off` : `${name} · lift · rinse/spin dry`;
    const amps = ampsText(ampsAt(step));
    if (step.step === "pillar") return step.t < 0.63 ? `${name} · Cu pillar in resist · ${amps}` : `${name} · SnAg cap · ${amps}`;
    if (step.t >= 0.6) return `${name} · overburden · ${amps}`;
    return `${name} · ${D.rpm[0]}–\u2060${D.rpm[1]}\u00a0rpm · ${amps} · bottom-up fill`;
  }
  return `${name} · ${D.steps[step.step].say}`;
}

function describe() {
  const text = selected ? `${D.pieces[selected].name}: ${D.pieces[selected].say}` : `${stepLabel()}`;
  if (stage.getAttribute("aria-valuetext") !== text) stage.setAttribute("aria-valuetext", text);
  if (document.activeElement === stage && text !== spoken) {
    spoken = text;
    live.textContent = text;
  }
}

function select(id) {
  if (id === "stand") id = null;
  if (selected === id) return;
  selected = id;
  for (const node of nodes) {
    if (id !== null && node.piece === id) node.el.setAttribute("data-on", "");
    else node.el.removeAttribute("data-on");
  }
  if (id) stage.setAttribute("data-focus", "");
  else stage.removeAttribute("data-focus");
  partButtons.forEach((button) => (button.dataset.part === id ? button.setAttribute("data-on", "") : button.removeAttribute("data-on")));
  stage.setAttribute("aria-valuenow", String(id ? D.order.indexOf(id) + 1 : 0));
  describe();
}

function place() {
  const tx = D.EZ[0] * -D.lift * headShare;
  const ty = D.EZ[1] * -D.lift * headShare;
  const text = headShare === 0 ? "" : `translate(${tx.toFixed(2)} ${ty.toFixed(2)})`;
  for (const node of nodes) {
    if (node.piece !== "head") continue;
    if (text !== node.shown) {
      node.shown = text;
      if (text) node.el.setAttribute("transform", text);
      else node.el.removeAttribute("transform");
    }
  }
  const share = (node) => (node.piece === "head" ? headShare : 0);
  const next = nodes.map((_, index) => index).sort((a, b) => nodes[a].key + nodes[a].lift * share(nodes[a]) - (nodes[b].key + nodes[b].lift * share(nodes[b])));
  if (next.some((index, at) => index !== order[at])) {
    const fragment = document.createDocumentFragment();
    for (const index of next) fragment.appendChild(nodes[index].el);
    layersEl.appendChild(fragment);
    order = next;
  }
}

function showPlay() {
  playText.textContent = playing ? "Pause" : s >= 0.9995 ? "Play" : "Resume";
  playButton.toggleAttribute("data-playing", playing);
  playButton.setAttribute("aria-label", playing ? "Pause" : "Play the damascene loop");
  const text = stepLabel();
  if (stepText.textContent !== text) stepText.textContent = text;
  const value = String(Math.round(s * 1000));
  if (scrubInput.value !== value && !scrubbing) scrubInput.value = value;
}

function render() {
  apply();
  place();
  showPlay();
  say(readoutText());
  describe();
}

// 2.2 weight units a second: about three seconds a layer
const RATE = 2.2 / TOTAL;
const TOUR_HOLD = 4;
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  if (touring) {
    tourClock += dt;
    const run = 1 / RATE;
    const t = tourClock % (run + TOUR_HOLD);
    s = t < TOUR_HOLD ? 1 : (t - TOUR_HOLD) / run;
  } else if (playing) {
    s = Math.min(1, s + dt * RATE);
    if (s >= 1) playing = false;
  }
  render();
  frame = visible && (touring || playing) ? requestAnimationFrame(tick) : 0;
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
    if (inside || tookOver) return;
    touring = !still.matches;
    run();
  }, 3600);
}

function play(on) {
  quietTour();
  if (on && s >= 0.9995) s = 0;
  playing = on;
  if (on && still.matches) {
    // reduced motion: jump straight to the finished stack, no animation
    s = 1;
    playing = false;
  }
  render();
  run();
}

function reset() {
  quietTour();
  playing = false;
  select(null);
  s = 1;
  render();
}

function pieceAt(event) {
  const hit = document.elementFromPoint(event.clientX, event.clientY);
  const item = hit && hit.closest ? hit.closest(".it") : null;
  return item ? item.dataset.piece : null;
}

stage.addEventListener("pointermove", (event) => {
  if (event.pointerType === "touch") return;
  inside = true;
  touring = false;
  clearTimeout(leaveTimer);
  clearTimeout(idleTimer);
  select(pieceAt(event));
  render();
});

stage.addEventListener("pointerleave", () => {
  inside = false;
  clearTimeout(leaveTimer);
  leaveTimer = setTimeout(() => {
    if (inside) return;
    select(null);
    render();
    if (!tookOver) idleTour();
  }, 260);
});

stage.addEventListener("pointerdown", (event) => {
  if (event.pointerType !== "touch") {
    stage.focus({ preventScroll: true });
    return;
  }
  quietTour();
  const id = pieceAt(event);
  select(id && id !== "stand" ? (selected === id ? null : id) : null);
  render();
});

partButtons.forEach((button) => {
  const on = () => {
    quietTour();
    clearTimeout(leaveTimer);
    select(button.dataset.part);
    render();
  };
  const off = () => {
    clearTimeout(leaveTimer);
    leaveTimer = setTimeout(() => {
      if (inside || partButtons.some((other) => other.matches(":hover, :focus-visible"))) return;
      select(null);
      render();
    }, 260);
  };
  button.addEventListener("pointerenter", on);
  button.addEventListener("focus", on);
  button.addEventListener("pointerleave", off);
  button.addEventListener("blur", off);
  button.addEventListener("click", on);
});

stage.addEventListener("focus", () => {
  spoken = "";
  describe();
});

document.addEventListener("keydown", (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey || !visible) return;
  const target = event.target;
  if (target !== document.body && target !== stage && !root.contains(target)) return;
  if (target === scrubInput && event.key !== " " && event.key !== "Escape") return;
  if (target instanceof HTMLButtonElement && (event.key === " " || event.key === "Enter")) return;
  if (event.key === "Escape") {
    event.preventDefault();
    reset();
    return;
  }
  if (event.key === " ") {
    event.preventDefault();
    play(!playing);
    return;
  }
  if (target === document.body) return;
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
  render();
});

// only hold the thumb still while the reader is dragging or keying it, not merely while it has focus
const scrubKeys = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"]);
scrubInput.addEventListener("pointerdown", () => (scrubbing = true));
scrubInput.addEventListener("keydown", (event) => {
  if (scrubKeys.has(event.key)) scrubbing = true;
});
for (const type of ["pointerup", "pointercancel", "change", "keyup", "blur"]) scrubInput.addEventListener(type, () => (scrubbing = false));
window.addEventListener("pointerup", () => (scrubbing = false));

scrubInput.addEventListener("input", () => {
  quietTour();
  playing = false;
  select(null);
  s = Number(scrubInput.value) / 1000;
  render();
});

playButton.addEventListener("click", () => play(!playing));

if (still.matches) touring = false;
const narrow = matchMedia("(hover: none), (max-width: 480px)");
const hint = root.querySelector(".ic-hint");
const wording = () => hint && (hint.textContent = narrow.matches ? "Tap a part · play below" : "Hover a part · Space plays the loop");
wording();
narrow.addEventListener("change", wording);
render();
