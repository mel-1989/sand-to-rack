const D = __DATA__;
const root = document.querySelector(".pz");
const stage = root.querySelector(".pz-stage");
const layers = stage.querySelector(".pz-layers");
const live = root.querySelector("[data-live]");
const readout = root.querySelector("[data-readout]");
const partButtons = [...root.querySelectorAll(".pz-part")];
const scrubInput = root.querySelector("[data-scrub]");
const playButton = root.querySelector("[data-play]");
const playText = root.querySelector("[data-play-text]");
const stepText = root.querySelector("[data-step]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const K = { cylinder, solidSvg };

const nodes = [...layers.querySelectorAll(".it")].map((el) => ({
  el,
  piece: el.dataset.piece,
  key: Number(el.dataset.k),
  m: el.dataset.m.split(",").map(Number),
  pin: el.dataset.pin !== undefined ? Number(el.dataset.pin) : -1,
  shown: "",
}));
for (const node of nodes) node.lift = node.m[0] * D.V[0] + node.m[1] * D.V[1] + node.m[2] * D.V[2];
const pinNodes = nodes.filter((node) => node.pin >= 0);
let order = nodes.map((_, index) => index);

const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const clamp = (x) => Math.max(0, Math.min(1, x));
const CVD = D.steps.find((s) => s.id === "cvd");
const HARVEST = D.steps.find((s) => s.id === "harvest");

// Everything the figure shows follows one number, s (0..1 along the process).
const growthOf = (s) => ease((s - CVD.from - 0.02) / (CVD.to - CVD.from - 0.04));
const heatOf = (s) => ease((s - CVD.from) / 0.035) * (1 - ease((s - HARVEST.from) / 0.05));
const liftOf = (s) => ease((s - HARVEST.from - 0.04) / (HARVEST.to - HARVEST.from - 0.06));
const diameterOf = (s) => D.mm.slim + (D.mm.final - D.mm.slim) * growthOf(s);
const stepIndexOf = (s) => {
  for (let i = D.steps.length - 1; i >= 0; i--) if (s >= D.steps[i].from) return i;
  return 0;
};

let s = 0;
let selected = null;
let inside = false;
let leaveTimer = 0;
let touring = !still.matches;
let tourClock = 0;
let idleTimer = 0;
let visible = false;
let frame = 0;
let last = 0;
let playing = false;
let tookOver = false;
let shownRadius = -1;
let shownZoom = "";
let shownStep = -1;
let spoken = "";

function say(text) {
  if (readout.textContent !== text) readout.textContent = text;
}

function announce(text) {
  if (text === spoken) return;
  spoken = text;
  live.textContent = text;
}

function lit() {
  if (selected) return selected;
  if (s > 0.0005) return D.stepPiece[D.steps[stepIndexOf(s)].id];
  return null;
}

let shownLit = undefined;
function paintLit() {
  const id = lit();
  if (id === shownLit) return;
  shownLit = id;
  for (const node of nodes) {
    if (id !== null && node.piece === id) node.el.setAttribute("data-on", "");
    else node.el.removeAttribute("data-on");
  }
  if (id) stage.setAttribute("data-focus", "");
  else stage.removeAttribute("data-focus");
  partButtons.forEach((button) => (button.dataset.part === selected ? button.setAttribute("data-on", "") : button.removeAttribute("data-on")));
}

function stepLabel(index) {
  return `${String(index + 1).padStart(2, "0")} · ${D.steps[index].label}`;
}

function stepSay(index) {
  const step = D.steps[index];
  if (step.id === "cvd") return `deposition · ${D.rodC} °C · Ø ${Math.round(diameterOf(s))} mm`;
  if (step.id === "harvest" && liftOf(s) < 0.99) return liftOf(s) > 0 ? "harvest · lifting the bell" : "harvest · cooling the rods";
  return step.say;
}

// Steps 1-3 happen in the feed skid: dots walk along the pipe being used, bubbles rise in the
// TCS reactor's sight glass, and the column's trays light one after another, bottom to top.
// All of it follows s, so a scrub moves it and a reduced-motion jump simply lands on the next pose.
const bubbles = [...root.querySelectorAll(".pz-bubble")].map((el, i, all) => ({ el, x: ((i * 0.382 + 0.1) % 1) * 0.7 + 0.15, phase: i / all.length }));
const trays = [...root.querySelectorAll(".pz-tray")];
const vapour = [...root.querySelectorAll(".pz-vapour")];
let shownProcess = "";
function drawProcess(index) {
  const step = D.steps[index];
  const u = s <= 0.0005 ? 0 : clamp((s - step.from) / (step.to - step.from));
  const id = s <= 0.0005 && !selected ? "" : step.id;
  if (root.dataset.pzStep !== id) root.dataset.pzStep = id;
  root.style.setProperty("--pz-run", (u * 90).toFixed(1));
  const key = `${id}:${u.toFixed(3)}`;
  if (key === shownProcess) return;
  shownProcess = key;
  if (id === "tcs" && D.sight) {
    const b = D.sight;
    const w = b.x1 - b.x0;
    const h = b.y1 - b.y0;
    for (const bubble of bubbles) {
      const rise = (bubble.phase + u * 4) % 1;
      bubble.el.setAttribute("cx", (b.x0 + bubble.x * w + Math.sin((rise + bubble.phase) * 6.28) * w * 0.05).toFixed(2));
      bubble.el.setAttribute("cy", (b.y1 + 1 - rise * (h + 2)).toFixed(2));
    }
  }
  const hot = id === "dist" ? Math.floor(u * trays.length * 2) % trays.length : -1;
  trays.forEach((tray, i) => {
    tray.toggleAttribute("data-hot", i === hot || i === hot - 1);
    tray.toggleAttribute("data-warm", id === "dist" && i < hot - 1);
  });
  if (id === "dist" && D.vapour) {
    const v = D.vapour;
    vapour.forEach((dot, i) => {
      const rise = (i / vapour.length + u * 3) % 1;
      const sway = Math.sin((rise * 3 + i * 0.7) * 6.28) * v.w * 0.25;
      dot.setAttribute("cx", (v.x0 + (v.x1 - v.x0) * rise + sway).toFixed(2));
      dot.setAttribute("cy", (v.y0 + (v.y1 - v.y0) * rise).toFixed(2));
      dot.style.opacity = (Math.min(1, rise * 6, (1 - rise) * 6) * 0.9).toFixed(2);
    });
  }
}

function draw() {
  const r = D.rSlim + (D.rFinal - D.rSlim) * growthOf(s);
  if (Math.abs(r - shownRadius) > 0.004) {
    shownRadius = r;
    for (const node of pinNodes) node.el.innerHTML = hairpin(K, G, D.P, D.pins[node.pin], r);
  }
  root.style.setProperty("--pz-heat", heatOf(s).toFixed(3));
  const share = liftOf(s);
  for (const node of nodes) {
    if (!node.lift && node.piece !== "bell") continue;
    const k = node.piece === "bell" ? share : 0;
    const tx = (D.EX[0] * node.m[0] + D.EY[0] * node.m[1] + D.EZ[0] * node.m[2]) * k;
    const ty = (D.EX[1] * node.m[0] + D.EY[1] * node.m[1] + D.EZ[1] * node.m[2]) * k;
    const text = k === 0 ? "" : `translate(${tx.toFixed(2)} ${ty.toFixed(2)})`;
    if (text !== node.shown) {
      node.shown = text;
      if (text) node.el.setAttribute("transform", text);
      else node.el.removeAttribute("transform");
    }
  }
  // camera pull-back: once the lifted eye would pass the top margin, scale the scene about the bench's bottom centre
  const Z = D.zoom;
  const reach = Z.cy - (Z.top - Z.lift * share);
  const f = Math.min(1, (Z.cy - Z.margin) / reach);
  const zoom = f > 0.9995 ? "" : `translate(${Z.cx} ${Z.cy}) scale(${f.toFixed(4)}) translate(${-Z.cx} ${-Z.cy})`;
  if (zoom !== shownZoom) {
    shownZoom = zoom;
    if (zoom) layers.setAttribute("transform", zoom);
    else layers.removeAttribute("transform");
  }
  const next = nodes.map((_, index) => index).sort((a, b) => nodes[a].key + nodes[a].lift * (nodes[a].piece === "bell" ? share : 0) - (nodes[b].key + nodes[b].lift * (nodes[b].piece === "bell" ? share : 0)));
  if (next.some((index, at) => index !== order[at])) {
    const fragment = document.createDocumentFragment();
    for (const index of next) fragment.appendChild(nodes[index].el);
    layers.appendChild(fragment);
    order = next;
  }
  const index = stepIndexOf(s);
  drawProcess(index);
  const label = stepLabel(index);
  if (stepText.textContent !== label) stepText.textContent = label;
  if (index !== shownStep) {
    shownStep = index;
    if (!touring) announce(`${label}: ${D.steps[index].say || "deposition on the heated rods"}`);
  }
  const value = String(Math.round(s * 1000));
  if (scrubInput.value !== value) scrubInput.value = value;
  scrubInput.setAttribute("aria-valuetext", `${label}`);
  paintLit();
  if (selected) say(D.pieces[selected].say || stepSay(index));
  else say(s <= 0.0005 && !playing && !touring ? D.idle : stepSay(index));
  playText.textContent = playing ? "Pause" : s >= 0.999 ? "Replay" : "Play";
  playButton.toggleAttribute("data-playing", playing);
  playButton.setAttribute("aria-label", playing ? "Pause the process" : "Play the process");
}

const PLAY_SECONDS = 18;
// Idle tour: play the whole process, hold at the harvest, then ease back to the start.
const TOUR = { play: PLAY_SECONDS, hold: 2.4, back: 2.2, rest: 1.4 };
function tourAt(t) {
  const span = TOUR.play + TOUR.hold + TOUR.back + TOUR.rest;
  const u = t % span;
  if (u < TOUR.play) return u / TOUR.play;
  if (u < TOUR.play + TOUR.hold) return 1;
  if (u < TOUR.play + TOUR.hold + TOUR.back) return 1 - ease((u - TOUR.play - TOUR.hold) / TOUR.back);
  return 0;
}

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  let moving = false;
  if (touring) {
    tourClock += dt;
    s = tourAt(tourClock);
    moving = true;
  } else if (playing) {
    s = Math.min(1, s + dt / PLAY_SECONDS);
    if (s >= 1) playing = false;
    moving = true;
  }
  draw();
  frame = visible && moving ? requestAnimationFrame(tick) : 0;
}

function run() {
  if (!frame && visible) {
    last = 0;
    frame = requestAnimationFrame(tick);
  }
}

function quietTour() {
  if (touring) announce(stepLabel(stepIndexOf(s)));
  touring = false;
  tookOver = true;
  clearTimeout(idleTimer);
}

function setPlaying(on) {
  quietTour();
  if (on && s >= 0.999) s = 0;
  playing = on;
  if (on && still.matches) {
    // reduced motion: jump to the end of the next step instead of animating
    playing = false;
    const index = stepIndexOf(s);
    s = index >= D.steps.length - 1 ? 1 : D.steps[index + 1].from + 0.001;
    if (index === D.steps.length - 2) s = 1;
  }
  draw();
  run();
}

function reset() {
  quietTour();
  playing = false;
  selected = null;
  s = 0;
  draw();
}

new IntersectionObserver(
  (entries) => {
    visible = entries[entries.length - 1].isIntersecting;
    if (visible) run();
  },
  { rootMargin: "120px 0px" },
).observe(stage);

function pieceAt(event) {
  const hit = document.elementFromPoint(event.clientX, event.clientY);
  const item = hit && hit.closest ? hit.closest(".it") : null;
  const id = item ? item.dataset.piece : null;
  return id === "stand" ? null : id;
}

function select(id) {
  if (selected === id) return;
  selected = id;
  draw();
}

stage.addEventListener("pointermove", (event) => {
  if (event.pointerType === "touch") return;
  inside = true;
  clearTimeout(leaveTimer);
  if (touring) quietTour();
  select(pieceAt(event));
});

stage.addEventListener("pointerleave", () => {
  inside = false;
  clearTimeout(leaveTimer);
  leaveTimer = setTimeout(() => {
    if (!inside) select(null);
  }, 260);
});

stage.addEventListener("pointerdown", (event) => {
  if (event.pointerType !== "touch") {
    stage.focus({ preventScroll: true });
    return;
  }
  quietTour();
  const id = pieceAt(event);
  select(id === selected ? null : id);
});

partButtons.forEach((button) => {
  const show = () => {
    quietTour();
    clearTimeout(leaveTimer);
    select(button.dataset.part);
  };
  const hide = () => {
    clearTimeout(leaveTimer);
    leaveTimer = setTimeout(() => {
      if (inside || partButtons.some((other) => other.matches(":hover, :focus-visible"))) return;
      select(null);
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
  announce(`${stepLabel(stepIndexOf(s))}${selected ? ` · ${D.pieces[selected].name}` : ""}`);
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
    setPlaying(!playing);
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
  announce(`${D.pieces[D.order[next]].name}: ${D.pieces[D.order[next]].say}`);
});

scrubInput.addEventListener("input", () => {
  quietTour();
  playing = false;
  s = Number(scrubInput.value) / 1000;
  draw();
});

playButton.addEventListener("click", () => setPlaying(!playing));

document.addEventListener("themechange", () => draw());

if (still.matches) touring = false;
const narrow = matchMedia("(hover: none), (max-width: 480px)");
const hint = root.querySelector(".pz-hint");
const wording = () => hint && (hint.textContent = narrow.matches ? "Tap a part · the slider runs the process" : "Hover a part · Space plays the process");
wording();
narrow.addEventListener("change", wording);
draw();
