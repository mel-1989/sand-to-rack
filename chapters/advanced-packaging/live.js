const D = __DATA__;
const root = document.querySelector(".ra");
const stage = root.querySelector(".ra-stage");
const layers = stage.querySelector(".ra-layers");
const live = root.querySelector("[data-live]");
const readout = root.querySelector("[data-readout]");
const partButtons = [...root.querySelectorAll(".ra-part")];
const still = matchMedia("(prefers-reduced-motion: reduce)");

const nodes = [...layers.querySelectorAll(".it")].map((el) => ({
  el,
  piece: el.dataset.piece,
  key: Number(el.dataset.k),
  m: el.dataset.m.split(",").map(Number),
  shown: "",
}));
for (const node of nodes) node.lift = node.m[0] * D.V[0] + node.m[1] * D.V[1] + node.m[2] * D.V[2];
let order = nodes.map((_, index) => index);

const IDS = Object.keys(D.pieces);
const STAGGER = D.stagger;
const SPRING = D.spring;
const piece = Object.fromEntries(IDS.map((id) => [id, { x: 1, v: 0, target: 1, pending: null }]));

let clock = 0;
let apart = true;
let selected = null;
let inside = false;
let leaveTimer = 0;
let touring = !still.matches;
let tourClock = -0.6;
let idleTimer = 0;
let visible = false;
let frame = 0;
let last = 0;
let spoken = "";
let playing = null;
let tookOver = false;

// Assembly order for the slider: the reverse of the explode, the stand never moves.
const JOIN = [...STAGGER].reverse().filter((id) => id !== "stand");
const WINDOW = 1.7;
const scrubInput = root.querySelector("[data-scrub]");
const playButton = root.querySelector("[data-play]");
const playText = root.querySelector("[data-play-text]");
const stepText = root.querySelector("[data-step]");
const ease = (t) => t * t * (3 - 2 * t);
const shareOf = (s, index) => ease(Math.min(1, Math.max(0, (s * (JOIN.length - 1 + WINDOW) - index) / WINDOW)));

function say(text) {
  if (readout.textContent !== text) readout.textContent = text;
}

function describe() {
  const text = selected ? `${D.pieces[selected].name}: ${D.pieces[selected].say}` : apart ? `Taken apart · ${D.idle}` : D.closed;
  if (stage.getAttribute("aria-valuetext") !== text) stage.setAttribute("aria-valuetext", text);
  if (document.activeElement === stage && text !== spoken) {
    spoken = text;
    live.textContent = text;
  }
}

// On a reversal only the assemblies whose target changes are rescheduled, staggered among themselves.
function setApart(on) {
  if (apart === on) return;
  apart = on;
  const goal = on ? 1 : 0;
  let index = 0;
  for (const id of on ? STAGGER : [...STAGGER].reverse()) {
    const state = piece[id];
    if (state.target === goal && !state.pending) continue;
    if (state.target === goal) {
      state.pending = null;
      continue;
    }
    state.pending = { value: goal, at: clock + (still.matches ? 0 : index++ * SPRING.stagger) };
  }
  describe();
  run();
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

function scrubTo(s) {
  for (const [index, id] of JOIN.entries()) {
    const state = piece[id];
    state.x = state.target = 1 - shareOf(s, index);
    state.v = 0;
    state.pending = null;
  }
  apart = s < 0.999;
  scrubInput.value = String(Math.round(s * 1000));
  describe();
}

function progress() {
  return JOIN.reduce((sum, id, index) => sum + (1 - piece[id].x), 0) / JOIN.length;
}

function stepOf(s) {
  if (s <= 0.001) return "apart";
  if (s >= 0.999) return "assembled";
  const index = Math.min(JOIN.length - 1, Math.floor(s * (JOIN.length - 1 + WINDOW) - WINDOW / 2 + 0.5));
  const id = JOIN[Math.max(0, index)];
  return `${String(D.order.indexOf(id) + 1).padStart(2, "0")} · ${D.pieces[id].name}`;
}

function showPlay() {
  const s = Number(scrubInput.value) / 1000;
  playText.textContent = playing ? "Pause" : s >= 0.999 ? "Take apart" : "Assemble";
  playButton.toggleAttribute("data-playing", !!playing);
  playButton.setAttribute("aria-label", playing ? "Pause" : s >= 0.999 ? "Play taking it apart" : "Play the assembly");
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
    const share = piece[node.piece].x;
    const tx = (D.EX[0] * node.m[0] + D.EY[0] * node.m[1] + D.EZ[0] * node.m[2]) * share;
    const ty = (D.EX[1] * node.m[0] + D.EY[1] * node.m[1] + D.EZ[1] * node.m[2]) * share;
    const text = share === 0 ? "" : `translate(${tx.toFixed(2)} ${ty.toFixed(2)})`;
    if (text !== node.shown) {
      node.shown = text;
      if (text) node.el.setAttribute("transform", text);
      else node.el.removeAttribute("transform");
    }
  }
  const next = nodes.map((_, index) => index).sort((a, b) => nodes[a].key + nodes[a].lift * piece[nodes[a].piece].x - (nodes[b].key + nodes[b].lift * piece[nodes[b].piece].x));
  if (next.some((index, at) => index !== order[at])) {
    const fragment = document.createDocumentFragment();
    for (const index of next) fragment.appendChild(nodes[index].el);
    layers.appendChild(fragment);
    order = next;
  }
}

const TOUR_STEP = 1.9;
function tourAt(time) {
  const listFrom = 1.2;
  const listTo = listFrom + D.order.length * TOUR_STEP;
  const closeTo = listTo + 3.2;
  const restTo = closeTo + 1.6;
  const t = time % restTo;
  if (t < listFrom) return { apart: true, part: null };
  if (t < listTo) return { apart: true, part: D.order[Math.floor((t - listFrom) / TOUR_STEP)] };
  if (t < closeTo) return { apart: false, part: null };
  return { apart: true, part: null };
}

function quietTour() {
  touring = false;
  tookOver = true;
  clearTimeout(idleTimer);
}

function idleTour() {
  touring = false;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (inside || tookOver) return;
    touring = !still.matches;
    tourClock = -0.6;
    run();
  }, 3600);
}

function idleText() {
  if (selected) return D.pieces[selected].say;
  const moving = IDS.some((id) => Math.abs(piece[id].x - piece[id].target) > 0.002 || piece[id].pending);
  if (moving) return apart ? "lifting apart" : "closing up";
  const s = Number(scrubInput.value) / 1000;
  if (s > 0.001 && s < 0.999) return `assembling · ${stepOf(s).slice(5)} going on`;
  return apart ? D.idle : D.closed;
}

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  clock += dt;
  const calm = still.matches;
  if (touring) {
    tourClock += dt;
    const step = tourAt(Math.max(0, tourClock));
    setApart(step.apart);
    select(step.part);
  }
  let moving = false;
  if (playing) {
    playing.t = Math.min(1, playing.t + dt / playing.seconds);
    scrubTo(playing.from + (playing.to - playing.from) * playing.t);
    if (playing.t >= 1) playing = null;
    moving = true;
  } else {
    for (const id of IDS) if (steerSpring(piece[id], dt, calm)) moving = true;
    scrubInput.value = String(Math.round(progress() * 1000));
  }
  showPlay();
  place();
  say(idleText());
  frame = visible && (moving || touring) ? requestAnimationFrame(tick) : 0;
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

function pieceAt(event) {
  const hit = document.elementFromPoint(event.clientX, event.clientY);
  const item = hit && hit.closest ? hit.closest(".it") : null;
  return item ? item.dataset.piece : null;
}

stage.addEventListener("pointermove", (event) => {
  if (event.pointerType === "touch") return;
  inside = true;
  clearTimeout(leaveTimer);
  touring = false;
  select(pieceAt(event));
  run();
});

stage.addEventListener("pointerleave", () => {
  inside = false;
  clearTimeout(leaveTimer);
  leaveTimer = setTimeout(() => {
    if (inside) return;
    select(null);
    if (!tookOver) idleTour();
  }, 260);
});

stage.addEventListener("pointerdown", (event) => {
  if (event.pointerType !== "touch") {
    stage.focus({ preventScroll: true });
    return;
  }
  playing = null;
  quietTour();
  const id = pieceAt(event);
  if (!id || id === "stand") {
    select(null);
    setApart(!apart);
  } else {
    setApart(true);
    select(id);
  }
  run();
});

partButtons.forEach((button) => {
  const show = () => {
    quietTour();
    playing = null;
    clearTimeout(leaveTimer);
    setApart(true);
    select(button.dataset.part);
    run();
  };
  const hide = () => {
    clearTimeout(leaveTimer);
    leaveTimer = setTimeout(() => {
      if (inside || partButtons.some((other) => other.matches(":hover, :focus-visible"))) return;
      select(null);
      setApart(true);
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

document.addEventListener("keydown", (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey || !visible) return;
  const target = event.target;
  if (target !== document.body && target !== stage && !root.contains(target)) return;
  if (target === scrubInput && event.key !== " " && event.key !== "Escape") return;
  if (target instanceof HTMLButtonElement && (event.key === " " || event.key === "Enter")) return;
  playing = null;
  const index = selected ? D.order.indexOf(selected) : -1;
  let next = null;
  if (event.key === "ArrowRight" || event.key === "ArrowDown") next = Math.min(D.order.length - 1, index + 1);
  else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = Math.max(0, index - 1);
  else if (event.key === "Home") next = 0;
  else if (event.key === "End") next = D.order.length - 1;
  else if (event.key === "Escape") {
    event.preventDefault();
    quietTour();
    select(null);
    setApart(true);
    run();
    return;
  } else if (event.key === " " || event.key === "Enter") {
    event.preventDefault();
    quietTour();
    setApart(Number(scrubInput.value) >= 999 ? true : false);
    if (!apart) select(null);
    run();
    return;
  }
  if (next === null) return;
  event.preventDefault();
  quietTour();
  setApart(true);
  select(D.order[next]);
  run();
});

scrubInput.addEventListener("input", () => {
  quietTour();
  playing = null;
  select(null);
  scrubTo(Number(scrubInput.value) / 1000);
  showPlay();
  place();
});

playButton.addEventListener("click", () => {
  quietTour();
  select(null);
  if (playing) {
    playing = null;
    showPlay();
    return;
  }
  const from = Number(scrubInput.value) / 1000;
  const to = from >= 0.999 ? 0 : 1;
  if (still.matches) {
    scrubTo(to);
    showPlay();
    place();
    return;
  }
  playing = { from, to, t: 0, seconds: 5.5 * Math.abs(to - from) };
  run();
});

if (still.matches) touring = false;
const narrow = matchMedia("(hover: none), (max-width: 480px)");
const hint = root.querySelector(".ra-hint");
const wording = () => hint && (hint.textContent = narrow.matches ? "Tap a layer · tap the base to assemble" : "Hover a layer · Space assembles it");
wording();
narrow.addEventListener("change", wording);
place();
say(idleText());
showPlay();
