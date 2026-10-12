const D = __DATA__;
const root = document.querySelector(".pm");
const stage = root.querySelector(".pm-stage");
const layers = stage.querySelector(".pm-layers");
const live = root.querySelector("[data-live]");
const readout = root.querySelector("[data-readout]");
const partButtons = [...root.querySelectorAll(".pm-part")];
const scrubInput = root.querySelector("[data-scrub]");
const playButton = root.querySelector("[data-play]");
const playText = root.querySelector("[data-play-text]");
const stepText = root.querySelector("[data-step]");
const beam = root.querySelector(".pm-beam");
const etch = root.querySelector(".pm-etch");
const dies = [...root.querySelectorAll(".pm-die")].sort((a, b) => Number(a.dataset.n) - Number(b.dataset.n));
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

const N = D.steps.length;
const STEP = 1 / N;
const SECONDS = 3.2 * N; // a full play, tape-out to pellicle
const clamp = (v) => Math.min(1, Math.max(0, v));
const ease = (t) => t * t * (3 - 2 * t);
const shareAt = (id, s) => (D.ramps[id] ? ease(clamp((s - D.ramps[id][0]) / (D.ramps[id][1] - D.ramps[id][0]))) : 0);

let s = 0; // the process position, 0..1
let selected = null; // the part the reader picked
let lit = null; // the part drawn lit
let playing = null;
let touring = !still.matches;
let tookOver = false;
let tourHold = 0;
let leaveTimer = 0;
let inside = false;
let visible = false;
let frame = 0;
let last = 0;
let spoken = "";

const stepIndex = (value) => Math.min(N - 1, Math.floor(value * N + 1e-9));
const stepLabel = (value) => `${String(stepIndex(value) + 1).padStart(2, "0")} · ${D.steps[stepIndex(value)].name}`;

function say(text) {
  if (readout.textContent !== text) readout.textContent = text;
}

function describe() {
  const step = D.steps[stepIndex(s)];
  const text = selected ? `${D.pieces[selected].name}: ${D.pieces[selected].say}` : s <= 0 ? `Ready · ${D.idle}` : s >= 1 ? D.done : `${stepLabel(s)}: ${step.say}`;
  if (stage.getAttribute("aria-valuetext") !== text) stage.setAttribute("aria-valuetext", text);
  stage.setAttribute("aria-valuenow", String(stepIndex(s) + (s >= 1 ? 1 : 0)));
  if (document.activeElement === stage && text !== spoken) {
    spoken = text;
    live.textContent = text;
  }
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
}

function select(id) {
  if (id === "stand") id = null;
  selected = id;
  render();
}

// What the process shows at s: mover positions, die fields written, beam, etch, data lights.
function render() {
  const index = stepIndex(s);
  const active = s > 0 && s < 1;
  light(selected ?? (active ? D.steps[index].piece : null));

  const share = Object.fromEntries(D.movers.map((id) => [id, shareAt(id, s)]));
  for (const node of nodes) {
    const k = share[node.piece] ?? 0;
    const tx = (D.EX[0] * node.m[0] + D.EY[0] * node.m[1] + D.EZ[0] * node.m[2]) * k;
    const ty = (D.EX[1] * node.m[0] + D.EY[1] * node.m[1] + D.EZ[1] * node.m[2]) * k;
    const text = k === 0 ? "" : `translate(${tx.toFixed(2)} ${ty.toFixed(2)})`;
    if (text !== node.shown) {
      node.shown = text;
      if (text) node.el.setAttribute("transform", text);
      else node.el.removeAttribute("transform");
    }
  }
  const next = nodes.map((_, i) => i).sort((a, b) => nodes[a].key + nodes[a].lift * (share[nodes[a].piece] ?? 0) - (nodes[b].key + nodes[b].lift * (share[nodes[b].piece] ?? 0)));
  if (next.some((i, at) => i !== order[at])) {
    const fragment = document.createDocumentFragment();
    for (const i of next) fragment.appendChild(nodes[i].el);
    layers.appendChild(fragment);
    order = next;
  }

  // writing: from the stage's arrival to the end of step 3, die fields appear in serpentine order
  const from = D.ramps.stage[1];
  const to = 3 * STEP - 0.01;
  const written = s >= to ? D.dies : Math.floor(clamp((s - from) / (to - from)) * D.dies + 0.0001);
  dies.forEach((die, i) => (i < written ? die.setAttribute("data-w", "") : die.removeAttribute("data-w")));
  const beamOn = s > from && s < 3 * STEP ? Math.min(clamp((s - from) / 0.006), clamp((3 * STEP - s) / 0.006)) : 0;
  beam.style.opacity = beamOn.toFixed(3);
  etch.style.opacity = clamp((s - 3 * STEP) / (STEP * 0.7)).toFixed(3);
  root.toggleAttribute("data-run", s > 0 && s < 3 * STEP);

  scrubInput.value = String(Math.round(s * 1000));
  const label = s >= 1 ? "06 · Finished mask" : stepLabel(s);
  if (stepText.textContent !== label) stepText.textContent = label;
  playText.textContent = playing ? "Pause" : s >= 1 ? "Replay" : "Play";
  playButton.toggleAttribute("data-playing", !!playing);
  playButton.setAttribute("aria-label", playing ? "Pause" : s >= 1 ? "Replay the process" : "Play the process");

  if (selected) say(D.pieces[selected].say);
  else if (s <= 0) say(D.idle);
  else if (s >= 1) say(D.done);
  else if (index === 2 && written > 0 && written < D.dies) say(`writing field ${written} of ${D.dies} · ${D.steps[2].say}`);
  else say(D.steps[index].say);
  describe();
}

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  let moving = false;
  if (playing) {
    s = Math.min(1, s + dt / SECONDS);
    if (s >= 1) {
      playing = null;
      if (touring) tourHold = 2.6;
    }
    moving = true;
  } else if (touring) {
    tourHold -= dt;
    if (tourHold <= 0) {
      s = 0;
      playing = { touring: true };
    }
    moving = true;
  }
  render();
  frame = visible && moving ? requestAnimationFrame(tick) : 0;
}

function run() {
  if (!frame && visible) {
    last = 0;
    frame = requestAnimationFrame(tick);
  }
}

function quietTour() {
  if (touring && playing && playing.touring) playing = null;
  touring = false;
  tookOver = true;
}

function play() {
  quietTour();
  select(null);
  if (playing) {
    playing = null;
    render();
    return;
  }
  if (s >= 1) s = 0;
  if (still.matches) {
    // reduced motion: jump a whole step at a time
    const next = s <= 0 ? 0 : stepIndex(s) + 1;
    s = next >= N ? 1 : next * STEP + STEP * 0.95;
    render();
    return;
  }
  playing = {};
  run();
}

function reset() {
  quietTour();
  playing = null;
  selected = null;
  s = 0;
  render();
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
  const id = pieceAt(event);
  if (id && id !== "stand" && touring) quietTour();
  if ((id === "stand" ? null : id) !== selected) select(id);
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
  if (!id || id === "stand") {
    select(null);
    play();
  } else {
    select(selected === id ? null : id);
  }
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
  describe();
});

document.addEventListener("keydown", (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey || !visible) return;
  const target = event.target;
  if (target !== document.body && target !== stage && !root.contains(target)) return;
  if (target === scrubInput && event.key !== " " && event.key !== "Escape") return;
  if (target instanceof HTMLButtonElement && (event.key === " " || event.key === "Enter")) return;
  if (event.key === " " || event.key === "Enter") {
    event.preventDefault();
    play();
    return;
  }
  if (event.key === "Escape") {
    event.preventDefault();
    reset();
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
});

scrubInput.addEventListener("input", () => {
  quietTour();
  playing = null;
  selected = null;
  s = Number(scrubInput.value) / 1000;
  render();
});

playButton.addEventListener("click", play);

// The idle tour plays the whole process, rests on the finished mask, and starts again, until the reader acts.
if (touring) {
  tourHold = 1.4;
}
const narrow = matchMedia("(hover: none), (max-width: 480px)");
const hint = root.querySelector(".pm-hint");
const wording = () => hint && (hint.textContent = narrow.matches ? "Tap a part · tap the base to play" : "Hover a part · Space plays the process");
wording();
narrow.addEventListener("change", wording);
render();
