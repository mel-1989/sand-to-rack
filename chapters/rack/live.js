const D = __DATA__;
const root = document.querySelector(".rk");
const stage = root.querySelector(".rk-stage");
const layers = stage.querySelector(".rk-layers");
const live = root.querySelector("[data-live]");
const readout = root.querySelector("[data-readout]");
const partButtons = [...root.querySelectorAll(".rk-part")];
const scrubInput = root.querySelector("[data-scrub]");
const playButton = root.querySelector("[data-play]");
const playText = root.querySelector("[data-play-text]");
const stepText = root.querySelector("[data-step]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const SVGNS = "http://www.w3.org/2000/svg";

// Coolant: round dots, cool supply and warm return. NVLink: faster, sparser lit pulses.
const FLOW_STYLE = { supply: { r: 1.5, spacing: 9, speed: 14 }, return: { r: 1.5, spacing: 9, speed: 14 }, nvlink: { r: 1.7, spacing: 14, speed: 34 } };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const screen = (v) => [D.EX[0] * v[0] + D.EY[0] * v[1] + D.EZ[0] * v[2], D.EX[1] * v[0] + D.EY[1] * v[1] + D.EZ[1] * v[2]];

const nodes = [...layers.querySelectorAll(".it")].map((el) => {
  const m = el.dataset.m.split(",").map(Number);
  const s = el.dataset.s.split(",").map(Number);
  const flowEl = el.querySelector(".rk-flow");
  let flow = null;
  if (flowEl) {
    const lines = flowEl.dataset.flow.split("|").map((line) => line.split(" ").map((p) => p.split(",").map(Number)));
    const kind = flowEl.dataset.kind;
    flow = { el: flowEl, lines, dir: Number(flowEl.dataset.dir), stage: Number(flowEl.dataset.stage), style: FLOW_STYLE[kind] || FLOW_STYLE.supply, dots: [] };
  }
  return { el, piece: el.dataset.piece, group: el.dataset.g, key: Number(el.dataset.k), m, s, lift: dot(m, D.V), slideLift: dot(s, D.V), mScreen: screen(m), sScreen: screen(s), flow, shown: "" };
});
let order = nodes.map((_, index) => index);
const flows = nodes.filter((node) => node.flow).map((node) => node.flow);

// The build: six steps, each owning an equal share of the slider.
const N = D.steps.length;
const ease = (t) => t * t * (3 - 2 * t);
const clamp = (v) => Math.min(1, Math.max(0, v));
const doneOf = (x, i) => ease(clamp(x * N - i));
const PIECE_STEP = { pkg: 0, plates: 1, lid: 2 };
const GLOW = { 0: ["pkg"], 1: ["plates"], 2: ["lid"], 3: ["rack", "busbar"], 4: ["manifold"], 5: ["spine"] };

let x = 0;
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
let playing = null;
let tookOver = false;
let phase = 0;
let glowing = "";

function say(text) {
  if (readout.textContent !== text) readout.textContent = text;
}

function stepIndex(v) {
  if (v <= 0.0005) return -1;
  return Math.min(N - 1, Math.floor(v * N - 1e-6));
}

function stepLabel(v) {
  const i = stepIndex(v);
  if (i < 0) return "parts out";
  if (v >= 0.9995) return "running";
  return `${String(i + 1).padStart(2, "0")} · ${D.steps[i].label}`;
}

function textNow() {
  if (selected) return `${D.groups[selected].name}: ${D.groups[selected].say}`;
  if (x <= 0.0005) return D.idle;
  if (x >= 0.9995) return D.done;
  return D.steps[stepIndex(x)].say;
}

function shortNow() {
  if (selected) return D.groups[selected].say;
  return textNow();
}

function describe() {
  const text = textNow();
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
    if (id !== null && node.group === id) node.el.setAttribute("data-on", "");
    else node.el.removeAttribute("data-on");
  }
  if (id) stage.setAttribute("data-focus", "");
  else stage.removeAttribute("data-focus");
  partButtons.forEach((button) => (button.dataset.part === id ? button.setAttribute("data-on", "") : button.removeAttribute("data-on")));
  stage.setAttribute("aria-valuenow", String(id ? D.order.indexOf(id) + 1 : 0));
  describe();
  say(shortNow());
  glow();
}

// The step under way lights its parts, unless the reader has picked one.
function glow() {
  const i = stepIndex(x);
  const want = selected || i < 0 ? "" : (GLOW[i] || []).join(" ");
  if (want === glowing) return;
  glowing = want;
  const set = new Set(want ? want.split(" ") : []);
  for (const node of nodes) {
    if (set.has(node.group)) node.el.setAttribute("data-glow", "");
    else node.el.removeAttribute("data-glow");
  }
}

function place() {
  const shareOf = (piece) => (piece in PIECE_STEP ? 1 - doneOf(x, PIECE_STEP[piece]) : 0);
  const slide = 1 - doneOf(x, 3);
  for (const node of nodes) {
    const share = shareOf(node.piece);
    const tx = node.mScreen[0] * share + node.sScreen[0] * slide;
    const ty = node.mScreen[1] * share + node.sScreen[1] * slide;
    node.sort = node.key + node.lift * share + node.slideLift * slide;
    const text = Math.abs(tx) < 0.005 && Math.abs(ty) < 0.005 ? "" : `translate(${tx.toFixed(2)} ${ty.toFixed(2)})`;
    if (text !== node.shown) {
      node.shown = text;
      if (text) node.el.setAttribute("transform", text);
      else node.el.removeAttribute("transform");
    }
  }
  const next = nodes.map((_, index) => index).sort((a, b) => nodes[a].sort - nodes[b].sort);
  if (next.some((index, at) => index !== order[at])) {
    const fragment = document.createDocumentFragment();
    for (const index of next) fragment.appendChild(nodes[index].el);
    layers.appendChild(fragment);
    order = next;
  }
  glow();
}

// Flows: dots that travel along hoses, manifold pipes and NVLink runs at their 3D speed.
function drawFlow() {
  for (const flow of flows) {
    const level = doneOf(x, flow.stage);
    const { spacing, speed, r } = flow.style;
    const want = [];
    if (level > 0.01) {
      const shift = (((phase * speed * flow.dir) % spacing) + spacing) % spacing;
      for (const pts of flow.lines) {
        const a0 = pts[0][2];
        const a1 = pts[pts.length - 1][2];
        let a = Math.ceil((a0 - shift) / spacing) * spacing + shift;
        for (; a <= a1; a += spacing) {
          let j = 1;
          while (j < pts.length - 1 && pts[j][2] < a) j++;
          const p = pts[j - 1];
          const q = pts[j];
          const t = q[2] > p[2] ? (a - p[2]) / (q[2] - p[2]) : 0;
          want.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
        }
      }
    }
    while (flow.dots.length < want.length) {
      const c = document.createElementNS(SVGNS, "circle");
      c.setAttribute("r", String(r));
      flow.el.appendChild(c);
      flow.dots.push(c);
    }
    flow.dots.forEach((c, i) => {
      if (i < want.length) {
        c.setAttribute("cx", want[i][0].toFixed(1));
        c.setAttribute("cy", want[i][1].toFixed(1));
        c.removeAttribute("display");
      } else c.setAttribute("display", "none");
    });
    const op = level.toFixed(2);
    if (flow.el.getAttribute("opacity") !== op) flow.el.setAttribute("opacity", op);
  }
}

function showPlay() {
  playText.textContent = playing ? "Pause" : x >= 0.9995 ? "Replay" : "Play";
  playButton.toggleAttribute("data-playing", !!playing);
  playButton.setAttribute("aria-label", playing ? "Pause" : x >= 0.9995 ? "Play the build again" : "Play the build");
  const text = stepLabel(x);
  if (stepText.textContent !== text) stepText.textContent = text;
  const v = String(Math.round(x * 1000));
  if (scrubInput.value !== v) scrubInput.value = v;
}

function setX(v) {
  x = clamp(v);
  place();
  drawFlow();
  showPlay();
  describe();
  say(shortNow());
}

// Idle tour: play the whole build, rest on the running rack, then start again from parts.
const TOUR_PLAY = 15;
const TOUR_HOLD = 4;
function tourAt(t) {
  const cycle = 1.2 + TOUR_PLAY + TOUR_HOLD;
  const u = t % cycle;
  if (u < 1.2) return 0;
  if (u < 1.2 + TOUR_PLAY) return (u - 1.2) / TOUR_PLAY;
  return 1;
}

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
    tourClock = x * TOUR_PLAY + 1.2;
    run();
  }, 3600);
}

const SECONDS = 13;
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  let moving = false;
  if (touring) {
    tourClock += dt;
    setX(tourAt(tourClock));
    moving = true;
  } else if (playing) {
    x = clamp(x + dt / SECONDS);
    if (x >= 1) playing = null;
    setX(x);
    moving = true;
  }
  const flowing = doneOf(x, 4) > 0.01 && !still.matches;
  if (flowing) {
    phase += dt;
    drawFlow();
    moving = true;
  }
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

function groupAt(event) {
  const hit = document.elementFromPoint(event.clientX, event.clientY);
  const item = hit && hit.closest ? hit.closest(".it") : null;
  return item ? item.dataset.g : null;
}

function play(toggle = true) {
  quietTour();
  if (playing && toggle) {
    playing = null;
    showPlay();
    return;
  }
  select(null);
  if (x >= 0.9995) x = 0;
  if (still.matches) {
    setX(1);
    return;
  }
  playing = { from: x };
  run();
}

function reset() {
  quietTour();
  playing = null;
  select(null);
  setX(0);
}

stage.addEventListener("pointermove", (event) => {
  if (event.pointerType === "touch") return;
  inside = true;
  clearTimeout(leaveTimer);
  if (touring) quietTourSoft();
  select(groupAt(event));
});

// Hovering pauses the tour where it is; it resumes after the pointer leaves.
function quietTourSoft() {
  touring = false;
  clearTimeout(idleTimer);
}

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
  const id = groupAt(event);
  if (!id || id === "stand") {
    select(null);
    play();
  } else {
    quietTour();
    playing = null;
    select(selected === id ? null : id);
    say(shortNow());
  }
});

partButtons.forEach((button) => {
  const show = () => {
    quietTour();
    clearTimeout(leaveTimer);
    select(button.dataset.part);
    say(shortNow());
  };
  const hide = () => {
    clearTimeout(leaveTimer);
    leaveTimer = setTimeout(() => {
      if (inside || partButtons.some((other) => other.matches(":hover, :focus-visible"))) return;
      select(null);
      say(shortNow());
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
  say(shortNow());
});

scrubInput.addEventListener("input", () => {
  quietTour();
  playing = null;
  select(null);
  setX(Number(scrubInput.value) / 1000);
  run();
});

playButton.addEventListener("click", () => play());

if (still.matches) touring = false;
const narrow = matchMedia("(hover: none), (max-width: 480px)");
const hint = root.querySelector(".rk-hint");
const wording = () => hint && (hint.textContent = narrow.matches ? "Tap a part · tap the base to play" : "Hover a part · Space plays the build");
wording();
narrow.addEventListener("change", wording);
setX(0);
