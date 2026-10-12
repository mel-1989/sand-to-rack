const D = __DATA__;
const root = document.querySelector(".ag");
const stage = root.querySelector(".ag-stage");
const layers = stage.querySelector(".ag-layers");
const live = root.querySelector("[data-live]");
const readout = root.querySelector("[data-readout]");
const partButtons = [...root.querySelectorAll(".ag-part")];
const scrubInput = root.querySelector("[data-scrub]");
const playButton = root.querySelector("[data-play]");
const playText = root.querySelector("[data-play-text]");
const stepText = root.querySelector("[data-step]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const GENS = D.gens;
const N = GENS.length;
const IDS = GENS.map((g) => g.id);
const STEP_SECONDS = 2.6; // one generation per 2.6 s when playing
const SEEK_SECONDS = 0.9; // one generation per 0.9 s when jumping to a pick
const DWELL = 0.55; // where a pick parks inside its step: past the move, mid-dwell
const MOVE = 0.42; // share of each step the gantry spends moving

const nodes = [...layers.querySelectorAll(".it")].map((el) => ({
  el,
  piece: el.dataset.piece,
  part: el.dataset.part,
  key: Number(el.dataset.k),
  m: el.dataset.m.split(",").map(Number),
  shown: "",
}));
for (const node of nodes) node.lift = node.m[0] * D.V[0] + node.m[1] * D.V[1] + node.m[2] * D.V[2];
let order = nodes.map((_, index) => index);

// ---- the terminal's bars: log scale per column, V100 at 12 %, Rubin at 100 % ----
const barEls = [...stage.querySelectorAll("[data-bar]")];
const scrName = stage.querySelector('[data-scr="name"]');
const scrYear = stage.querySelector('[data-scr="year"]');
const cols = D.bars[0].map((_, c) => D.bars.map((row) => row[c]));
const fracOf = (c, v) => {
  const lo = Math.min(...cols[c]);
  const hi = Math.max(...cols[c]);
  return 0.12 + 0.88 * (Math.log(v / lo) / Math.log(hi / lo));
};
const FRAC = D.bars.map((row) => row.map((v, c) => fracOf(c, v)));
let shownBars = "";
function screen(index, from, share) {
  const name = index < 0 ? "READY" : D.gens[index].name.toUpperCase();
  const year = index < 0 ? "" : String(D.gens[index].year);
  if (scrName.textContent !== name) scrName.textContent = name;
  if (scrYear.textContent !== year) scrYear.textContent = year;
  const widths = barEls.map((_, c) => {
    const a = from < 0 ? 0 : FRAC[from][c];
    const b = index < 0 ? 0 : FRAC[index][c];
    return (D.barW * (a + (b - a) * share)).toFixed(2);
  });
  const key = widths.join(",");
  if (key === shownBars) return;
  shownBars = key;
  barEls.forEach((el, c) => el.setAttribute("width", widths[c]));
}

let T = 0; // 0 = ready, i..i+1 = generation i
let goal = 0;
let rate = 0; // steps per second toward goal; 0 = still
let selected = null; // a previewed generation (hover, legend focus)
let lit = null;
let inside = false;
let leaveTimer = 0;
let idleTimer = 0;
let touring = !still.matches;
let tookOver = false;
let tourRest = 1.2;
let visible = false;
let frame = 0;
let last = 0;
let spoken = "";
let replay = false; // after the return to the start, play again

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (t) => t * t * (3 - 2 * t);
const pad = (n) => String(n).padStart(2, "0");
const stepOf = (t) => (t <= 0 ? -1 : Math.min(N - 1, Math.floor(t)));

function shareAt(t) {
  if (t <= 0) return 0;
  if (t >= N) return D.stops[N - 1];
  const i = Math.floor(t);
  const from = D.stops[Math.max(0, i - 1)];
  const to = D.stops[i];
  return from + (to - from) * ease(clamp((t - i) / MOVE));
}

function place(share) {
  for (const node of nodes) {
    const s = node.piece === "gantry" ? share : 0;
    if (!s && !node.shown) continue;
    const tx = (D.EX[0] * node.m[0] + D.EY[0] * node.m[1] + D.EZ[0] * node.m[2]) * s;
    const ty = (D.EX[1] * node.m[0] + D.EY[1] * node.m[1] + D.EZ[1] * node.m[2]) * s;
    const text = Math.abs(s) < 1e-6 ? "" : `translate(${tx.toFixed(2)} ${ty.toFixed(2)})`;
    if (text !== node.shown) {
      node.shown = text;
      if (text) node.el.setAttribute("transform", text);
      else node.el.removeAttribute("transform");
    }
  }
  const keyOf = (index) => nodes[index].key + nodes[index].lift * (nodes[index].piece === "gantry" ? share : 0);
  const next = nodes.map((_, index) => index).sort((a, b) => keyOf(a) - keyOf(b));
  if (next.some((index, at) => index !== order[at])) {
    const fragment = document.createDocumentFragment();
    for (const index of next) fragment.appendChild(nodes[index].el);
    layers.appendChild(fragment);
    order = next;
  }
}

function light(id) {
  if (lit === id) return;
  lit = id;
  for (const node of nodes) {
    if (id !== null && node.part === id) node.el.setAttribute("data-on", "");
    else node.el.removeAttribute("data-on");
  }
  if (id) stage.setAttribute("data-focus", "");
  else stage.removeAttribute("data-focus");
  partButtons.forEach((button) => button.toggleAttribute("data-on", button.dataset.part === id));
}

function moving() {
  return rate > 0 && Math.abs(goal - T) > 1e-4;
}

function readoutText() {
  if (selected) return GENS[IDS.indexOf(selected)].say;
  const i = stepOf(T);
  if (i < 0) return moving() ? "gantry returning" : D.idle;
  const p = T - i;
  if (p < MOVE && i > 0 && T < N && moving()) return `gantry moving to ${GENS[i].name}`;
  return GENS[i].say;
}

function describe() {
  const i = stepOf(T);
  const text = selected ? `${GENS[IDS.indexOf(selected)].name}: ${GENS[IDS.indexOf(selected)].say}` : i < 0 ? D.idle : `${GENS[i].name}: ${GENS[i].say}`;
  if (stage.getAttribute("aria-valuetext") !== text) stage.setAttribute("aria-valuetext", text);
  const now = String(selected ? IDS.indexOf(selected) + 1 : i + 1);
  if (stage.getAttribute("aria-valuenow") !== now) stage.setAttribute("aria-valuenow", now);
  if (document.activeElement === stage && text !== spoken && !moving()) {
    spoken = text;
    live.textContent = text;
  }
}

function render() {
  place(shareAt(T));
  const i = stepOf(T);
  light(selected ?? (i < 0 ? null : GENS[i].id));
  if (selected) screen(IDS.indexOf(selected), IDS.indexOf(selected), 1);
  else if (i < 0) screen(-1, -1, 0);
  else screen(i, i - 1, T >= N ? 1 : ease(clamp((T - i) / MOVE)));
  const text = readoutText();
  if (readout.textContent !== text) readout.textContent = text;
  const playing = replay || (moving() && goal === N && rate === 1 / STEP_SECONDS);
  playText.textContent = playing ? "Pause" : T >= N - 1e-4 ? "Replay" : "Play";
  playButton.toggleAttribute("data-playing", playing);
  playButton.setAttribute("aria-label", playing ? "Pause" : "Play the inspection run");
  const label = i < 0 ? "ready" : `${pad(i + 1)} · ${GENS[i].step}`;
  if (stepText.textContent !== label) stepText.textContent = label;
  const value = String(Math.round((T / N) * 1000));
  if (scrubInput.value !== value && document.activeElement !== scrubInput) scrubInput.value = value;
  describe();
}

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  if (touring) {
    if (!moving()) {
      tourRest -= dt;
      if (tourRest <= 0) {
        if (T >= N - 1e-4) {
          goal = 0;
          rate = 1 / 0.8;
          tourRest = 1.4;
        } else {
          goal = N;
          rate = 1 / STEP_SECONDS;
          tourRest = 3;
        }
      }
    }
  }
  if (replay && !moving()) {
    replay = false;
    goal = N;
    rate = 1 / STEP_SECONDS;
  }
  if (moving()) {
    const stepBy = rate * dt;
    T = Math.abs(goal - T) <= stepBy ? goal : T + Math.sign(goal - T) * stepBy;
  }
  render();
  frame = visible && (moving() || touring) ? requestAnimationFrame(tick) : 0;
}

function run() {
  if (!frame && visible) {
    last = 0;
    frame = requestAnimationFrame(tick);
  }
}

function seek(to, seconds, cap = 0) {
  goal = clamp(to, 0, N);
  if (still.matches) {
    T = goal;
    rate = 0;
    render();
    return;
  }
  rate = cap ? Math.max(1 / seconds, Math.abs(goal - T) / cap) : 1 / seconds;
  run();
}

function quietTour() {
  touring = false;
  tookOver = true;
  clearTimeout(idleTimer);
}

function goTo(index) {
  quietTour();
  replay = false;
  selected = null;
  seek(index + DWELL, SEEK_SECONDS, 2.4);
  render();
}

function togglePlay() {
  quietTour();
  selected = null;
  if ((moving() && goal === N) || replay) {
    replay = false;
    goal = T;
    rate = 0;
    render();
    return;
  }
  if (T >= N - 1e-4 && !still.matches) {
    replay = true;
    seek(0, 0.8, 1.4);
    render();
    return;
  }
  if (T >= N - 1e-4) T = 0;
  seek(N, STEP_SECONDS);
  render();
}

function reset() {
  quietTour();
  replay = false;
  selected = null;
  seek(0, 0.8, 1.6);
  render();
}

new IntersectionObserver(
  (entries) => {
    visible = entries[entries.length - 1].isIntersecting;
    if (visible) run();
  },
  { rootMargin: "120px 0px" },
).observe(stage);

function partAt(event) {
  const hit = document.elementFromPoint(event.clientX, event.clientY);
  const item = hit && hit.closest ? hit.closest(".it") : null;
  const part = item ? item.dataset.part : null;
  return IDS.includes(part) ? part : null;
}

stage.addEventListener("pointermove", (event) => {
  if (event.pointerType === "touch") return;
  inside = true;
  clearTimeout(leaveTimer);
  if (touring) {
    touring = false;
    if (moving() && goal === N) {
      goal = T;
      rate = 0;
    }
  }
  const part = partAt(event);
  if (part !== selected) {
    selected = part;
    render();
  }
});

stage.addEventListener("pointerleave", () => {
  inside = false;
  clearTimeout(leaveTimer);
  leaveTimer = setTimeout(() => {
    if (inside) return;
    selected = null;
    render();
    if (!tookOver) {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        if (inside || tookOver || still.matches) return;
        touring = true;
        tourRest = 0.6;
        run();
      }, 3600);
    }
  }, 260);
});

stage.addEventListener("pointerdown", (event) => {
  const part = partAt(event);
  if (event.pointerType !== "touch") {
    stage.focus({ preventScroll: true });
    if (part) goTo(IDS.indexOf(part));
    return;
  }
  if (part) goTo(IDS.indexOf(part));
  else togglePlay();
});

partButtons.forEach((button) => {
  const index = IDS.indexOf(button.dataset.part);
  button.addEventListener("pointerenter", () => {
    clearTimeout(leaveTimer);
    if (touring) quietTour();
    selected = button.dataset.part;
    render();
  });
  button.addEventListener("pointerleave", () => {
    selected = null;
    render();
  });
  button.addEventListener("focus", () => {
    selected = button.dataset.part;
    render();
  });
  button.addEventListener("blur", () => {
    selected = null;
    render();
  });
  button.addEventListener("click", () => goTo(index));
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
  const at = moving() ? Math.floor(goal - 1e-6) : stepOf(T);
  let next = null;
  if (event.key === "ArrowRight" || event.key === "ArrowDown") next = Math.min(N - 1, at + 1);
  else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = Math.max(0, at - 1);
  else if (event.key === "Home") next = 0;
  else if (event.key === "End") next = N - 1;
  else if (event.key === "Escape") {
    event.preventDefault();
    reset();
    return;
  } else if (event.key === " " || event.key === "Enter") {
    event.preventDefault();
    togglePlay();
    return;
  }
  if (next === null) return;
  event.preventDefault();
  goTo(next);
});

scrubInput.addEventListener("input", () => {
  quietTour();
  selected = null;
  rate = 0;
  replay = false;
  T = (Number(scrubInput.value) / 1000) * N;
  goal = T;
  render();
});

playButton.addEventListener("click", togglePlay);

if (still.matches) touring = false;
const narrow = matchMedia("(hover: none), (max-width: 480px)");
const hint = root.querySelector(".ag-hint");
const wording = () => hint && (hint.textContent = narrow.matches ? "Tap a package · tap the bench to play" : "Hover a package · Space runs the gantry");
wording();
narrow.addEventListener("change", wording);
render();
