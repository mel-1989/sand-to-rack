const D = __DATA__;
const root = document.querySelector(".wp");
const stage = root.querySelector(".wp-stage");
const live = root.querySelector("[data-live]");
const readout = root.querySelector("[data-readout]");
const partButtons = [...root.querySelectorAll(".wp-part")];
const scrubInput = root.querySelector("[data-scrub]");
const playButton = root.querySelector("[data-play]");
const playText = root.querySelector("[data-play-text]");
const stepText = root.querySelector("[data-step]");
const still = matchMedia("(prefers-reduced-motion: reduce)");

const items = [...stage.querySelectorAll(".it")];
const movers = { ycar: [], xcar: [], chuck: [], wafer: [], fork: [] };
for (const el of items) if (el.dataset.mv && movers[el.dataset.mv]) movers[el.dataset.mv].push(el);
const cells = [...stage.querySelectorAll(".wp-cell")];
const scr = Object.fromEntries([...stage.querySelectorAll("[data-scr]")].map((el) => [el.dataset.scr, el]));
const lens = Object.fromEntries([...stage.querySelectorAll("[data-lens]")].map((el) => [el.dataset.lens, el]));
const leds = stage.querySelector(".wp-leds");
const probes = stage.querySelector(".wp-probes");

// ---- the process as a timeline of eased segments (seconds at play speed) ----
const FORK_OUT = D.loaderX - D.loadPos[0];
const state = { cx: D.loadPos[0], cy: D.loadPos[1], cz: 0, fx: FORK_OUT, fz: 2.5, onFork: 1 };
const segs = [];
let clockT = 0;
const binAt = new Array(D.dies.length).fill(Infinity);
function go(dur, to, phase, die = -1) {
  const from = { ...state };
  Object.assign(state, to);
  segs.push({ t0: clockT, t1: clockT + dur, from, to: { ...state }, phase, die });
  clockT += dur;
}
const hold = (dur, phase, die = -1) => go(dur, {}, phase, die);
const STEP_IDS = D.steps.map((s) => s.id);

go(2.4, { fx: 0 }, "load");
go(0.8, { fz: 0 }, "load");
go(0.01, { onFork: 0 }, "load");
go(0.4, { fz: 1.5 }, "load");
go(1.5, { fx: FORK_OUT }, "load");
const mark = (m) => ({ cx: D.dcam[0] - m[0], cy: D.dcam[1] - m[1] });
go(1.4, mark(D.marks[0]), "align");
hold(0.6, "align:down");
go(1.1, mark(D.marks[1]), "align");
hold(0.6, "align:down");
go(1.5, { cx: -D.upcam[0], cy: -D.upcam[1] }, "align");
hold(0.8, "align:up");
D.dies.forEach(([x, y], n) => {
  const first = n === 0;
  const second = n === 1;
  const slow = first || second;
  go(first ? 1.3 : second ? 1.0 : 0.11, { cx: -x, cy: -y }, first ? "touch" : slow ? "step" : "map", n);
  go(first ? 0.9 : second ? 0.5 : 0.05, { cz: D.lift }, slow ? "touch" : "map", n);
  hold(first ? 1.9 : second ? 1.0 : 0.09, slow ? "test" : "map:test", n);
  binAt[n] = clockT;
  hold(first ? 0.8 : second ? 0.5 : 0.0, slow ? "bin" : "map", n);
  go(first ? 0.5 : second ? 0.4 : 0.05, { cz: 0 }, slow ? "step" : "map", n);
});
go(1.4, { cx: D.loadPos[0], cy: D.loadPos[1] }, "done");
hold(0.6, "done");
const TOTAL = clockT;

const ease = (t) => t * t * (3 - 2 * t);
function poseAt(t) {
  t = Math.max(0, Math.min(TOTAL, t));
  let lo = 0;
  let hi = segs.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (segs[mid].t1 < t) lo = mid + 1;
    else hi = mid;
  }
  const seg = segs[lo];
  const u = seg.t1 > seg.t0 ? ease(Math.min(1, Math.max(0, (t - seg.t0) / (seg.t1 - seg.t0)))) : 1;
  const pose = {};
  for (const key of Object.keys(seg.to)) pose[key] = key === "onFork" ? (t >= seg.t1 ? seg.to.onFork : seg.from.onFork) : seg.from[key] + (seg.to[key] - seg.from[key]) * u;
  pose.phase = seg.phase;
  pose.die = seg.die;
  return pose;
}
const stepIndexOf = (phase) => {
  const base = phase.split(":")[0];
  if (base === "done") return STEP_IDS.length - 1;
  return Math.max(0, STEP_IDS.indexOf(base));
};
// segment starts of each step, for reduced-motion jumps
const STEP_STARTS = STEP_IDS.map((id) => segs.find((s) => s.phase.split(":")[0] === id)?.t0 ?? 0);

// ---- drawing ----
const shown = new Map();
function shift(list, dx, dy, dz) {
  const tx = D.EX[0] * dx + D.EY[0] * dy + D.EZ[0] * dz;
  const ty = D.EX[1] * dx + D.EY[1] * dy + D.EZ[1] * dz;
  const text = Math.abs(tx) < 0.005 && Math.abs(ty) < 0.005 ? "" : `translate(${tx.toFixed(2)} ${ty.toFixed(2)})`;
  for (const el of list) {
    if (shown.get(el) === text) continue;
    shown.set(el, text);
    if (text) el.setAttribute("transform", text);
    else el.removeAttribute("transform");
  }
}
const flag = (el, on) => el && (on ? el.setAttribute("data-on", "") : el.removeAttribute("data-on"));

let t = 0;
let lastText = "";
function render() {
  const p = poseAt(t);
  shift(movers.ycar, 0, p.cy, 0);
  shift(movers.xcar, p.cx, p.cy, 0);
  shift(movers.chuck, p.cx, p.cy, p.cz);
  if (p.onFork) shift(movers.wafer, p.fx, 0, p.fz);
  else shift(movers.wafer, p.cx - D.loadPos[0], p.cy - D.loadPos[1], p.cz);
  shift(movers.fork, p.fx, 0, p.fz);
  const testing = p.phase === "test" || p.phase === "map:test";
  flag(lens.down, p.phase === "align:down");
  flag(lens.up, p.phase === "align:up");
  flag(leds, testing);
  flag(probes, testing || (p.die >= 0 && p.cz > D.lift - 0.05));
  let pass = 0;
  let fail = 0;
  cells.forEach((cell, n) => {
    const done = t >= binAt[n];
    if (done) D.dies[n][2] ? pass++ : fail++;
    if (done !== cell.hasAttribute("data-done")) cell.toggleAttribute("data-done", done);
    const cur = !done && n === p.die && p.phase !== "step";
    if (cur !== cell.hasAttribute("data-cur")) cell.toggleAttribute("data-cur", cur);
  });
  const tested = pass + fail;
  const setScr = (key, value) => scr[key] && scr[key].textContent !== value && (scr[key].textContent = value);
  setScr("die", `${Math.min(D.gross, Math.max(tested, p.die + 1))}/${D.gross}`);
  setScr("pass", String(pass));
  setScr("fail", String(fail));
  setScr("yield", tested ? `${Math.round((pass / tested) * 100)}%` : "--");
  const index = stepIndexOf(p.phase);
  const label = `${String(index + 1).padStart(2, "0")} · ${D.steps[index].name}`;
  const stepLabel = index === STEP_IDS.length - 1 && p.die >= 0 && p.phase !== "done" ? `${label} · ${p.die + 1}/${D.gross}` : p.phase === "done" ? `${label} · done` : label;
  if (stepText.textContent !== stepLabel) stepText.textContent = stepLabel;
  scrubInput.value = String(Math.round((t / TOTAL) * 1000));
  lastText = phaseText(p, pass, fail);
  say(selected ? `${D.pieces[selected].name}: ${D.pieces[selected].say}` : lastText);
}

function phaseText(p, pass, fail) {
  const n = p.die + 1;
  switch (p.phase.split(":")[0]) {
    case "load":
      return t <= 0.001 ? D.idle : "load · the fork lays the wafer on the chuck · vacuum on";
    case "align":
      return p.phase === "align:up" ? "align · the stage camera looks up at the probe tips" : "align · the down camera finds the wafer's marks";
    case "touch":
      return `touch down · die ${n} · ${D.overdrive} µm overdrive`;
    case "test":
      return `run patterns · die ${n} of ${D.gross}`;
    case "bin":
      return `bin · die ${n} ${D.dies[p.die][2] ? "passes" : "fails"}`;
    case "step":
      return "step · the chuck drops and moves one die pitch";
    case "map":
      return `die ${n} of ${D.gross} · ${pass} good · ${fail} bad`;
    default:
      return `map complete · ${pass} good of ${D.gross}`;
  }
}

function say(text) {
  if (readout.textContent !== text) readout.textContent = text;
  if (stage.getAttribute("aria-valuetext") !== text) stage.setAttribute("aria-valuetext", text);
  if (document.activeElement === stage && text !== spoken) {
    spoken = text;
    live.textContent = text;
  }
}

// ---- selection ----
let selected = null;
let spoken = "";
function select(id) {
  if (selected === id) return;
  selected = id;
  for (const el of items) (id !== null && el.dataset.piece === id ? el.setAttribute("data-on", "") : el.removeAttribute("data-on"));
  if (id) stage.setAttribute("data-focus", "");
  else stage.removeAttribute("data-focus");
  partButtons.forEach((b) => (b.dataset.part === id ? b.setAttribute("data-on", "") : b.removeAttribute("data-on")));
  render();
}

// ---- play, tour, loop ----
let playing = false;
let touring = !still.matches;
let tookOver = false;
let visible = false;
let frame = 0;
let last = 0;
let inside = false;
let leaveTimer = 0;

function showPlay() {
  const done = t >= TOTAL - 1e-3;
  const on = playing || touring;
  playText.textContent = on ? "Pause" : done ? "Replay" : t > 0 ? "Resume" : "Play";
  playButton.toggleAttribute("data-playing", on);
  playButton.setAttribute("aria-label", on ? "Pause the test sequence" : "Play the test sequence");
}

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  if (playing || touring) {
    t += dt;
    if (t >= TOTAL) {
      if (touring) t = 0;
      else {
        t = TOTAL;
        playing = false;
      }
    }
    render();
  }
  showPlay();
  frame = visible && (playing || touring) ? requestAnimationFrame(tick) : 0;
}

function run() {
  if (!frame && visible && (playing || touring)) {
    last = 0;
    frame = requestAnimationFrame(tick);
  }
  showPlay();
}

function quietTour() {
  touring = false;
  tookOver = true;
}

function togglePlay() {
  quietTour();
  if (still.matches) {
    // jump to the start of the next step instead of animating
    const next = STEP_STARTS.find((s) => s > t + 0.01);
    t = next === undefined ? (t >= TOTAL - 1e-3 ? 0 : TOTAL) : next + 0.005;
    playing = false;
    render();
    showPlay();
    return;
  }
  if (playing) playing = false;
  else {
    if (t >= TOTAL - 1e-3) t = 0;
    playing = true;
  }
  run();
}

function reset() {
  quietTour();
  playing = false;
  t = 0;
  select(null);
  render();
  showPlay();
}

new IntersectionObserver(
  (entries) => {
    visible = entries[entries.length - 1].isIntersecting;
    if (visible) run();
  },
  { rootMargin: "120px 0px" },
).observe(stage);

// ---- input ----
function pieceAt(event) {
  const hit = document.elementFromPoint(event.clientX, event.clientY);
  const item = hit && hit.closest ? hit.closest(".it") : null;
  const id = item ? item.dataset.piece : null;
  return id && D.pieces[id] ? id : null;
}

stage.addEventListener("pointermove", (event) => {
  if (event.pointerType === "touch") return;
  inside = true;
  clearTimeout(leaveTimer);
  touring = false;
  select(pieceAt(event));
});
stage.addEventListener("pointerleave", () => {
  inside = false;
  clearTimeout(leaveTimer);
  leaveTimer = setTimeout(() => {
    if (inside) return;
    select(null);
    if (!tookOver && !still.matches)
      leaveTimer = setTimeout(() => {
        if (inside || tookOver) return;
        touring = true;
        run();
      }, 3600);
  }, 260);
});
stage.addEventListener("pointerdown", (event) => {
  if (event.pointerType !== "touch") {
    stage.focus({ preventScroll: true });
    return;
  }
  const id = pieceAt(event);
  if (id) {
    quietTour();
    select(selected === id ? null : id);
  } else togglePlay();
});

partButtons.forEach((button) => {
  const show = () => {
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
  button.addEventListener("click", () => {
    quietTour();
    show();
  });
});

stage.addEventListener("focus", () => {
  spoken = "";
  say(readout.textContent);
});

document.addEventListener("keydown", (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey || !visible) return;
  const target = event.target;
  if (target !== document.body && target !== stage && !root.contains(target)) return;
  if (target === scrubInput && event.key !== " " && event.key !== "Escape") return;
  if (target instanceof HTMLButtonElement && (event.key === " " || event.key === "Enter")) return;
  const index = selected ? D.order.indexOf(selected) : -1;
  let next = null;
  if (event.key === "ArrowRight" || event.key === "ArrowDown") next = Math.min(D.order.length - 1, index + 1);
  else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = Math.max(0, index - 1);
  else if (event.key === "Home") next = 0;
  else if (event.key === "End") next = D.order.length - 1;
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
  quietTour();
  select(D.order[next]);
});

scrubInput.addEventListener("input", () => {
  quietTour();
  playing = false;
  t = (Number(scrubInput.value) / 1000) * TOTAL;
  render();
  showPlay();
});

playButton.addEventListener("click", togglePlay);

const narrow = matchMedia("(hover: none), (max-width: 480px)");
const hint = root.querySelector(".wp-hint");
const wording = () => hint && (hint.textContent = narrow.matches ? "Tap a part · tap empty space to play" : "Hover a part · Space plays the test");
wording();
narrow.addEventListener("change", wording);
if (still.matches) touring = false;
render();
showPlay();
