const D = __DATA__;
const root = document.querySelector(".hb");
const stage = root.querySelector(".hb-stage");
const layers = stage.querySelector(".hb-layers");
const live = root.querySelector("[data-live]");
const readout = root.querySelector("[data-readout]");
const beamEl = stage.querySelector("[data-beam]");
const partButtons = [...root.querySelectorAll(".hb-part")];
const scrubInput = root.querySelector("[data-scrub]");
const playButton = root.querySelector("[data-play]");
const playText = root.querySelector("[data-play-text]");
const stepText = root.querySelector("[data-step]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const N = D.gens.length;
const IDS = D.gens.map((g) => g.id);

const nodes = [...layers.querySelectorAll(".it")].map((el) => ({
  el,
  piece: el.dataset.piece,
  key: Number(el.dataset.k),
  m: el.dataset.m.split(",").map(Number),
  shown: "",
}));
for (const node of nodes) node.lift = node.m[0] * D.V[0] + node.m[1] * D.V[1] + node.m[2] * D.V[2];
let order = nodes.map((_, index) => index);

// The gauge's place in station units: -1 is parked, 0 … N-1 are the stacks.
const pos = { x: -1, v: 0 };
const beam = { x: 0, v: 0 };
let target = -1;
let beamFor = -1;
let dwell = 0;
let playing = false;
let touring = !still.matches;
let tookOver = false;
let inside = false;
let leaveTimer = 0;
let idleTimer = 0;
let visible = false;
let frame = 0;
let last = 0;
let spoken = "";
let lit = null;

const DWELL = 2.6;
const PARK_DWELL = 1.4;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function shareAt(p) {
  if (p <= -1) return 0;
  if (p < 0) return D.shares[0] * (p + 1);
  const i = Math.min(N - 2, Math.floor(p));
  const f = clamp(p - i, 0, 1.2);
  return D.shares[i] + (D.shares[i + 1] - D.shares[i]) * f;
}

// critically damped follow: velocity stays continuous, no overshoot
function follow(state, goal, dt, seconds, calm, vmax = Infinity) {
  if (calm) {
    state.x = goal;
    state.v = 0;
    return false;
  }
  const w = 1 / seconds;
  for (let i = 0; i < 4; i++) {
    const h = dt / 4;
    state.v += (w * w * (goal - state.x) - 2 * w * state.v) * h;
    state.v = clamp(state.v, -vmax, vmax);
    state.x += state.v * h;
  }
  if (Math.abs(goal - state.x) < 1e-4 && Math.abs(state.v) < 1e-4) {
    state.x = goal;
    state.v = 0;
    return false;
  }
  return true;
}

const arrived = () => Math.abs(pos.x - target) < 0.015 && Math.abs(pos.v) < 0.3;
const pad = (i) => String(i + 1).padStart(2, "0");

function setTarget(next) {
  next = clamp(Math.round(next), -1, N - 1);
  if (next === target) return;
  target = next;
  dwell = 0;
  light(target >= 0 ? IDS[target] : null);
  describe();
  run();
}

function light(id) {
  if (lit === id) return;
  lit = id;
  for (const node of nodes) {
    if (id !== null && node.piece === id) node.el.setAttribute("data-on", "");
    else node.el.removeAttribute("data-on");
  }
  if (id) stage.setAttribute("data-focus", "");
  else stage.removeAttribute("data-focus");
  partButtons.forEach((button) => (button.dataset.part === id ? button.setAttribute("data-on", "") : button.removeAttribute("data-on")));
  stage.setAttribute("aria-valuenow", String(target + 1));
}

function valueText() {
  return target < 0 ? `Gauge parked · ${D.idle}` : D.gens[target].say;
}

function describe() {
  const text = valueText();
  if (stage.getAttribute("aria-valuetext") !== text) stage.setAttribute("aria-valuetext", text);
  if (document.activeElement === stage && text !== spoken) {
    spoken = text;
    live.textContent = text;
  }
}

function readoutText() {
  if (target < 0) return Math.abs(pos.x + 1) > 0.01 ? "parking the gauge" : D.idle;
  if (beam.x < 0.5 || beamFor !== target) return `gauge moving · ${D.gens[target].name}`;
  return D.gens[target].short;
}

function stepLabel() {
  if (target < 0) return "parked";
  const g = D.gens[target];
  return `${pad(target)} · ${g.name} · ${g.year ?? "next"}`;
}

function show() {
  const text = readoutText();
  if (readout.textContent !== text) readout.textContent = text;
  const step = stepLabel();
  if (stepText.textContent !== step) stepText.textContent = step;
  playText.textContent = playing ? "Pause" : target === N - 1 && beam.x > 0.5 ? "Replay" : "Play";
  playButton.toggleAttribute("data-playing", playing);
  playButton.setAttribute("aria-label", playing ? "Pause" : "Play through the generations");
  if (document.activeElement !== scrubInput) scrubInput.value = String(Math.round((pos.x + 1) * 100));
  // the beam for the station the gauge is at
  const station = target >= 0 ? target : -1;
  if (station !== beamFor && beam.x < 0.02) {
    beamFor = station;
    beamEl.innerHTML = station >= 0 ? D.beams[station] : "";
  }
  beamEl.style.opacity = beamFor >= 0 ? beam.x.toFixed(3) : "0";
  stage.toggleAttribute("data-measuring", beam.x > 0.5);
}

function place() {
  const share = shareAt(pos.x);
  for (const node of nodes) {
    const s = node.piece === "carriage" ? share : 0;
    const tx = (D.EX[0] * node.m[0] + D.EY[0] * node.m[1] + D.EZ[0] * node.m[2]) * s;
    const ty = (D.EX[1] * node.m[0] + D.EY[1] * node.m[1] + D.EZ[1] * node.m[2]) * s;
    const text = s === 0 ? "" : `translate(${tx.toFixed(2)} ${ty.toFixed(2)})`;
    if (text !== node.shown) {
      node.shown = text;
      if (text) node.el.setAttribute("transform", text);
      else node.el.removeAttribute("transform");
    }
  }
  // the beam has its own layer above every stack; it rides with the carriage
  const beamShift = `translate(${(D.EX[0] * D.travel * share).toFixed(2)} ${(D.EX[1] * D.travel * share).toFixed(2)})`;
  if (beamEl.getAttribute("transform") !== beamShift) beamEl.setAttribute("transform", beamShift);
  const keyOf = (node) => node.key + node.lift * (node.piece === "carriage" ? share : 0);
  const next = nodes.map((_, index) => index).sort((a, b) => keyOf(nodes[a]) - keyOf(nodes[b]));
  if (next.some((index, at) => index !== order[at])) {
    const fragment = document.createDocumentFragment();
    for (const index of next) fragment.appendChild(nodes[index].el);
    layers.appendChild(fragment);
    order = next;
  }
}

// the program a play or the idle tour runs: dwell at each stack, then the next
function program(dt) {
  if (!arrived() || (target >= 0 && beam.x < 0.98)) return;
  dwell += dt;
  if (target < 0) {
    if (dwell > PARK_DWELL) setTarget(0);
    return;
  }
  if (dwell < DWELL) return;
  if (target < N - 1) setTarget(target + 1);
  else if (touring) setTarget(-1);
  else playing = false;
}

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  const calm = still.matches;
  if (playing || touring) program(dt);
  let moving = false;
  const away = Math.abs(pos.x - target) > 0.015;
  if (away && beam.x > 0.02 && !calm) {
    // switch the laser off before the carriage moves
    moving = follow(beam, 0, dt, 0.05, calm) || true;
  } else {
    if (follow(pos, target, dt, 0.16, calm, 4.5)) moving = true;
    if (follow(beam, target >= 0 && arrived() ? 1 : 0, dt, 0.07, calm)) moving = true;
  }
  place();
  show();
  frame = visible && (moving || playing || touring) ? requestAnimationFrame(tick) : 0;
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

function pauseTour() {
  touring = false;
  clearTimeout(idleTimer);
}

function resumeTour() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (inside || tookOver || still.matches) return;
    touring = true;
    run();
  }, 3600);
}

function genAt(event) {
  const hit = document.elementFromPoint(event.clientX, event.clientY);
  const item = hit && hit.closest ? hit.closest(".it") : null;
  const index = item ? IDS.indexOf(item.dataset.piece) : -1;
  return index;
}

stage.addEventListener("pointermove", (event) => {
  if (event.pointerType === "touch") return;
  inside = true;
  clearTimeout(leaveTimer);
  const index = genAt(event);
  if (index < 0) return;
  pauseTour();
  playing = false;
  setTarget(index);
});

stage.addEventListener("pointerleave", () => {
  inside = false;
  clearTimeout(leaveTimer);
  leaveTimer = setTimeout(() => {
    if (!inside && !tookOver) resumeTour();
  }, 260);
});

stage.addEventListener("pointerdown", (event) => {
  if (event.pointerType !== "touch") {
    stage.focus({ preventScroll: true });
    return;
  }
  quietTour();
  const index = genAt(event);
  if (index >= 0) {
    playing = false;
    setTarget(index);
  } else togglePlay();
  run();
});

partButtons.forEach((button, index) => {
  const pick = () => {
    quietTour();
    playing = false;
    setTarget(index);
  };
  button.addEventListener("pointerenter", (event) => event.pointerType !== "touch" && pick());
  button.addEventListener("focus", pick);
  button.addEventListener("click", pick);
});

stage.addEventListener("focus", () => {
  spoken = "";
  describe();
});

function togglePlay() {
  quietTour();
  if (playing) {
    playing = false;
    show();
    return;
  }
  if (target >= N - 1) setTarget(0);
  else if (target < 0) setTarget(0);
  dwell = 0;
  playing = true;
  run();
}

document.addEventListener("keydown", (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey || !visible) return;
  const t = event.target;
  if (t !== document.body && t !== stage && !root.contains(t)) return;
  if (t === scrubInput && event.key !== " " && event.key !== "Escape") return;
  if (t instanceof HTMLButtonElement && (event.key === " " || event.key === "Enter")) return;
  let next = null;
  if (event.key === "ArrowRight" || event.key === "ArrowDown") next = Math.min(N - 1, target + 1);
  else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = Math.max(0, target - 1);
  else if (event.key === "Home") next = 0;
  else if (event.key === "End") next = N - 1;
  else if (event.key === "Escape") {
    event.preventDefault();
    quietTour();
    playing = false;
    setTarget(-1);
    run();
    return;
  } else if (event.key === " ") {
    event.preventDefault();
    togglePlay();
    return;
  }
  if (next === null) return;
  event.preventDefault();
  quietTour();
  playing = false;
  setTarget(next);
});

scrubInput.addEventListener("input", () => {
  quietTour();
  playing = false;
  const p = clamp(Number(scrubInput.value) / 100 - 1, -1, N - 1);
  pos.x = p;
  pos.v = 0;
  beam.x = 0;
  beam.v = 0;
  setTarget(Math.round(p));
  place();
  show();
  run();
});

playButton.addEventListener("click", togglePlay);

const narrow = matchMedia("(hover: none), (max-width: 480px)");
const hint = root.querySelector(".hb-hint");
const wording = () => hint && (hint.textContent = narrow.matches ? "Tap a stack · tap the bench to play" : "Hover a stack · Space plays");
wording();
narrow.addEventListener("change", wording);
light(null);
place();
show();
