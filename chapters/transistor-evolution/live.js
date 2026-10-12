const D = __DATA__;
const root = document.querySelector(".tr");
const stage = root.querySelector(".tr-stage");
const layers = stage.querySelector(".tr-layers");
const live = root.querySelector("[data-live]");
const readout = root.querySelector("[data-readout]");
const partButtons = [...root.querySelectorAll(".tr-part")];
const scrubInput = root.querySelector("[data-scrub]");
const playButton = root.querySelector("[data-play]");
const playText = root.querySelector("[data-play-text]");
const stepText = root.querySelector("[data-step]");
const still = matchMedia("(prefers-reduced-motion: reduce)");

const nodes = [...layers.querySelectorAll(".it")].map((el) => ({
  el,
  piece: el.dataset.piece,
  gen: el.dataset.gen || null,
  key: Number(el.dataset.k),
  m: el.dataset.m.split(",").map(Number),
  shown: "",
}));
for (const node of nodes) node.lift = node.m[0] * D.V[0] + node.m[1] * D.V[1] + node.m[2] * D.V[2];
let order = nodes.map((_, index) => index);

const IDS = D.order;
const SPRING = D.spring;
// share of each carriage: 0 closed, 1 slid fully open
const piece = Object.fromEntries(IDS.map((id) => [id, { x: 0, v: 0, target: 0, pending: null }]));
const shareOfPiece = (id) => (piece[id] ? piece[id].x : 0);

let clock = 0;
let selected = null;
let inside = false;
let leaveTimer = 0;
let idleTimer = 0;
let visible = false;
let frame = 0;
let last = 0;
let spoken = "";
let playing = null;
let tookOver = false;
let touring = !still.matches;
let tourClock = -1.4;

// The slider opens the specimens one after another, oldest first, with a small overlap.
const WINDOW = 1.15;
const ease = (t) => t * t * (3 - 2 * t);
const shareAt = (s, index) => ease(Math.min(1, Math.max(0, (s * (IDS.length - 1 + WINDOW) - index) / WINDOW)));
const stepIndex = (s) => Math.min(IDS.length - 1, Math.max(0, Math.floor(s * (IDS.length - 1 + WINDOW) - WINDOW / 2 + 0.5)));
const sliderValue = () => Number(scrubInput.value) / 1000;

function say(text) {
  if (readout.textContent !== text) readout.textContent = text;
}

function describe() {
  const s = sliderValue();
  const text = selected ? `${D.gens[selected].name}: ${D.gens[selected].say}` : s >= 0.999 ? D.open : s <= 0.001 ? `Closed · ${D.idle}` : stepOf(s);
  if (stage.getAttribute("aria-valuetext") !== text) stage.setAttribute("aria-valuetext", text);
  if (document.activeElement === stage && text !== spoken) {
    spoken = text;
    live.textContent = text;
  }
}

function select(id) {
  if (id && !D.gens[id]) id = null;
  if (selected === id) return;
  selected = id;
  for (const node of nodes) {
    if (id !== null && node.gen === id) node.el.setAttribute("data-on", "");
    else node.el.removeAttribute("data-on");
  }
  if (id) stage.setAttribute("data-focus", "");
  else stage.removeAttribute("data-focus");
  partButtons.forEach((button) => (button.dataset.part === id ? button.setAttribute("data-on", "") : button.removeAttribute("data-on")));
  stage.setAttribute("aria-valuenow", String(id ? IDS.indexOf(id) + 1 : 0));
  describe();
}

function scrubTo(s) {
  for (const [index, id] of IDS.entries()) {
    const state = piece[id];
    state.x = state.target = shareAt(s, index);
    state.v = 0;
    state.pending = null;
  }
  scrubInput.value = String(Math.round(s * 1000));
  describe();
}

// Springs only run when one carriage is sent somewhere on its own (Escape closes all, staggered).
function closeAll() {
  let index = 0;
  for (const id of [...IDS].reverse()) {
    const state = piece[id];
    if (state.target === 0 && state.x === 0) continue;
    state.pending = { value: 0, at: clock + (still.matches ? 0 : index++ * SPRING.stagger) };
  }
}

function progress() {
  // the slider value whose shares best match the carriages: invert the last carriage that has moved
  let s = 0;
  for (const [index, id] of IDS.entries()) {
    const x = piece[id].x;
    if (x <= 1e-4) break;
    s = Math.min(1, (index + WINDOW * Math.min(1, x)) / (IDS.length - 1 + WINDOW));
  }
  return s;
}

function stepOf(s) {
  if (s <= 0.001) return "closed";
  if (s >= 0.999) return "all four open";
  const id = IDS[stepIndex(s)];
  return `${String(IDS.indexOf(id) + 1).padStart(2, "0")} · ${D.gens[id].short} · ${D.gens[id].grip}`;
}

function showPlay() {
  const s = sliderValue();
  playText.textContent = playing ? "Pause" : s >= 0.999 ? "Close" : "Cut open";
  playButton.toggleAttribute("data-playing", !!playing);
  playButton.setAttribute("aria-label", playing ? "Pause" : s >= 0.999 ? "Play closing the specimens" : "Play the sectioning");
  const text = stepOf(s);
  if (stepText.textContent !== text) stepText.textContent = text;
}

function steerSpring(state, dt, calm) {
  if (state.pending && clock >= state.pending.at) {
    state.target = state.pending.value;
    state.pending = null;
  }
  if (calm) {
    state.x = state.target;
    state.v = 0;
    return state.pending !== null;
  }
  for (let index = 0; index < SPRING.substeps; index++) {
    const h = dt / SPRING.substeps;
    state.v += ((state.target - state.x) * SPRING.stiffness - state.v * SPRING.damping) * h;
    state.x += state.v * h;
  }
  if (Math.abs(state.target - state.x) < 2e-4 && Math.abs(state.v) < 2e-4) {
    state.x = state.target;
    state.v = 0;
    return state.pending !== null;
  }
  return true;
}

function place() {
  for (const node of nodes) {
    const share = shareOfPiece(node.piece);
    const tx = (D.EX[0] * node.m[0] + D.EY[0] * node.m[1] + D.EZ[0] * node.m[2]) * share;
    const ty = (D.EX[1] * node.m[0] + D.EY[1] * node.m[1] + D.EZ[1] * node.m[2]) * share;
    const text = share === 0 ? "" : `translate(${tx.toFixed(2)} ${ty.toFixed(2)})`;
    if (text !== node.shown) {
      node.shown = text;
      if (text) node.el.setAttribute("transform", text);
      else node.el.removeAttribute("transform");
    }
  }
  const keyOf = (node) => node.key + node.lift * shareOfPiece(node.piece);
  const next = nodes.map((_, index) => index).sort((a, b) => keyOf(nodes[a]) - keyOf(nodes[b]));
  if (next.some((index, at) => index !== order[at])) {
    const fragment = document.createDocumentFragment();
    for (const index of next) fragment.appendChild(nodes[index].el);
    layers.appendChild(fragment);
    order = next;
  }
}

// Idle tour: cut each specimen open in turn, light it, hold all four open, close them again.
const TOUR_OPEN = 10;
const TOUR_HOLD = 3.5;
const TOUR_CLOSE = 2.4;
const TOUR_REST = 1.8;
function tourAt(time) {
  const length = TOUR_OPEN + TOUR_HOLD + TOUR_CLOSE + TOUR_REST;
  const t = time % length;
  if (t < TOUR_OPEN) {
    const s = t / TOUR_OPEN;
    return { s, part: IDS[stepIndex(s)] };
  }
  if (t < TOUR_OPEN + TOUR_HOLD) return { s: 1, part: null };
  if (t < TOUR_OPEN + TOUR_HOLD + TOUR_CLOSE) return { s: 1 - ease((t - TOUR_OPEN - TOUR_HOLD) / TOUR_CLOSE), part: null };
  return { s: 0, part: null };
}

function quietTour() {
  touring = false;
  tookOver = true;
  clearTimeout(idleTimer);
}

function idleText() {
  if (selected) return D.gens[selected].say;
  const s = sliderValue();
  if (s > 0.001 && s < 0.999) return D.gens[IDS[stepIndex(s)]].say;
  const moving = IDS.some((id) => Math.abs(piece[id].x - piece[id].target) > 0.002 || piece[id].pending);
  if (moving) return "closing the specimens";
  return s >= 0.999 ? D.open : D.idle;
}

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  clock += dt;
  const calm = still.matches;
  let moving = false;
  if (touring) {
    tourClock += dt;
    const step = tourAt(Math.max(0, tourClock));
    scrubTo(step.s);
    select(step.part);
    moving = true;
  } else if (playing) {
    playing.t = Math.min(1, playing.t + dt / playing.seconds);
    const s = playing.from + (playing.to - playing.from) * playing.t;
    scrubTo(s);
    if (playing.t >= 1) playing = null;
    moving = true;
  } else {
    for (const id of IDS) if (steerSpring(piece[id], dt, calm)) moving = true;
    scrubInput.value = String(Math.round(progress() * 1000));
  }
  showPlay();
  place();
  say(idleText());
  describe();
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

function genAt(event) {
  const hit = document.elementFromPoint(event.clientX, event.clientY);
  const item = hit && hit.closest ? hit.closest(".it") : null;
  return item ? item.dataset.gen || null : null;
}

function refresh() {
  showPlay();
  place();
  say(idleText());
  describe();
}

stage.addEventListener("pointermove", (event) => {
  if (event.pointerType === "touch") return;
  inside = true;
  clearTimeout(leaveTimer);
  if (touring) quietTour();
  select(genAt(event));
  refresh();
});

stage.addEventListener("pointerleave", () => {
  inside = false;
  clearTimeout(leaveTimer);
  leaveTimer = setTimeout(() => {
    if (inside) return;
    select(null);
    refresh();
  }, 260);
});

stage.addEventListener("pointerdown", (event) => {
  if (event.pointerType !== "touch") {
    stage.focus({ preventScroll: true });
    return;
  }
  quietTour();
  playing = null;
  const id = genAt(event);
  select(id === selected ? null : id);
  refresh();
});

partButtons.forEach((button) => {
  const show = () => {
    quietTour();
    clearTimeout(leaveTimer);
    select(button.dataset.part);
    refresh();
  };
  const hide = () => {
    clearTimeout(leaveTimer);
    leaveTimer = setTimeout(() => {
      if (inside || partButtons.some((other) => other.matches(":hover, :focus-visible"))) return;
      select(null);
      refresh();
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
    playing = null;
    showPlay();
    return;
  }
  const from = sliderValue();
  const to = from >= 0.999 ? 0 : 1;
  if (still.matches) {
    scrubTo(to);
    refresh();
    return;
  }
  playing = { from, to, t: 0, seconds: (to ? 9 : 3) * Math.abs(to - from) };
  run();
}

document.addEventListener("keydown", (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey || !visible) return;
  const target = event.target;
  if (target !== document.body && target !== stage && !root.contains(target)) return;
  if (target === scrubInput && event.key !== " " && event.key !== "Escape") return;
  if (target instanceof HTMLButtonElement && (event.key === " " || event.key === "Enter")) return;
  const index = selected ? IDS.indexOf(selected) : -1;
  let next = null;
  if (event.key === "ArrowRight" || event.key === "ArrowDown") next = Math.min(IDS.length - 1, index + 1);
  else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = Math.max(0, index - 1);
  else if (event.key === "Home") next = 0;
  else if (event.key === "End") next = IDS.length - 1;
  else if (event.key === "Escape") {
    event.preventDefault();
    quietTour();
    playing = null;
    select(null);
    closeAll();
    run();
    refresh();
    return;
  } else if (event.key === " ") {
    event.preventDefault();
    togglePlay();
    refresh();
    return;
  }
  if (next === null) return;
  event.preventDefault();
  quietTour();
  select(IDS[next]);
  refresh();
});

scrubInput.addEventListener("input", () => {
  quietTour();
  playing = null;
  const s = sliderValue();
  scrubTo(s);
  select(s > 0.001 && s < 0.999 ? IDS[stepIndex(s)] : null);
  refresh();
});

playButton.addEventListener("click", () => {
  togglePlay();
  refresh();
});

if (still.matches) touring = false;
const narrow = matchMedia("(hover: none), (max-width: 480px)");
const hint = root.querySelector(".tr-hint");
const wording = () => hint && (hint.textContent = narrow.matches ? "Tap a specimen · play below" : "Hover a specimen · Space plays");
wording();
narrow.addEventListener("change", wording);
refresh();
