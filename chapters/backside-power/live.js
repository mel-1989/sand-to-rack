const D = __DATA__;
const root = document.querySelector(".bp");
const stage = root.querySelector(".bp-stage");
const blockEl = stage.querySelector("[data-block]");
const bumpEl = stage.querySelector("[data-bumps]");
const grindEls = [...stage.querySelectorAll(".it[data-grind]")];
const wheelPhases = [...stage.querySelectorAll("[data-phase]")];
const ctrlText = stage.querySelector("[data-ctrl]");
const live = root.querySelector("[data-live]");
const readout = root.querySelector("[data-readout]");
const partButtons = [...root.querySelectorAll(".bp-part")];
const scrubInput = root.querySelector("[data-scrub]");
const playButton = root.querySelector("[data-play]");
const playText = root.querySelector("[data-play-text]");
const stepText = root.querySelector("[data-step]");
const hint = root.querySelector(".bp-hint");
const still = matchMedia("(prefers-reduced-motion: reduce)");

const PLAY_SECONDS = 16;
let s = 1; // build position, 0..1 (1 = finished chip)
let shownS = -1;
let selected = null;
let playing = null; // { from, to, t, seconds }
let touring = !still.matches;
let tourClock = 0;
let tookOver = false;
let inside = false;
let leaveTimer = 0;
let idleTimer = 0;
let visible = false;
let frame = 0;
let last = 0;
let spoken = "";
let wheelAngle = 0;

const pad2 = (n) => String(n).padStart(2, "0");

function say(text) {
  if (readout.textContent !== text) readout.textContent = text;
}

function stepIndex(st) {
  return st.p.step;
}

function stepLabel(st) {
  if (s <= 0.0005) return "00 · Bare wafer";
  const i = stepIndex(st);
  return `${pad2(i + 1)} · ${D.steps[i].name}`;
}

function siliconText(st) {
  // drawn thickness runs 12 -> 2 units; show the real thickness on a log scale from 775 um to ~0.3 um
  const t = Math.max(0, Math.min(1, (12 - st.S) / (12 - 2)));
  if (t <= 0.001) return `silicon ${D.waferUm} µm`;
  if (t >= 0.999) return `silicon ${D.thinNm} nm`;
  const um = Math.exp(Math.log(D.waferUm) + (Math.log(0.3) - Math.log(D.waferUm)) * t);
  return `silicon ≈ ${um >= 10 ? Math.round(um) : um.toFixed(1)} µm`;
}

function processText(st) {
  if (s >= 0.9995) return D.done;
  if (s <= 0.0005) return `bare wafer · ${D.waferUm} µm of silicon`;
  const step = D.steps[stepIndex(st)];
  if (step.id === "flip") return `flipping · ${Math.round((st.theta * 180) / Math.PI)}°`;
  if (step.id === "thin") return `${siliconText(st)} · ${step.say.split(" · ")[1] ?? ""}`.replace(/ · $/, "");
  return step.say;
}

function describe() {
  const st = rightState(s);
  const text = selected ? `${D.pieces[selected].name}: ${D.pieces[selected].say}` : `${stepLabel(st)}. ${processText(st)}`;
  if (stage.getAttribute("aria-valuetext") !== text) stage.setAttribute("aria-valuetext", text);
  if (document.activeElement === stage && text !== spoken) {
    spoken = text;
    live.textContent = text;
  }
}

function markSelection() {
  for (const el of stage.querySelectorAll(".it, .bp-sec")) {
    if (selected && el.dataset.piece === selected) el.setAttribute("data-on", "");
    else el.removeAttribute("data-on");
  }
  if (selected) stage.setAttribute("data-focus", "");
  else stage.removeAttribute("data-focus");
}

function select(id) {
  if (id === "stand" || id === "block") id = null;
  if (selected === id) return;
  selected = id;
  markSelection();
  partButtons.forEach((b) => (b.dataset.part === id ? b.setAttribute("data-on", "") : b.removeAttribute("data-on")));
  stage.setAttribute("aria-valuenow", String(id ? D.order.indexOf(id) + 1 : 0));
  describe();
}

function draw() {
  const st = rightState(s);
  if (s !== shownS) {
    shownS = s;
    blockEl.innerHTML = rightSvg(st, D.P, D.V, D.L);
    if (selected) markSelection();
    // bumps rise into place at the last step
    bumpEl.style.opacity = st.bumps.toFixed(3);
    const lift = 4 * (1 - st.bumps);
    if (lift > 0) bumpEl.setAttribute("transform", `translate(${(D.EZ[0] * lift).toFixed(2)} ${(D.EZ[1] * lift).toFixed(2)})`);
    else bumpEl.removeAttribute("transform");
    // the grinding head rides its column
    const t = st.grind ? `translate(${(D.EZ[0] * st.grind).toFixed(2)} ${(D.EZ[1] * st.grind).toFixed(2)})` : "";
    for (const el of grindEls) t ? el.setAttribute("transform", t) : el.removeAttribute("transform");
    scrubInput.value = String(Math.round(s * 1000));
    const label = stepLabel(st);
    if (stepText.textContent !== label) stepText.textContent = label;
    if (ctrlText) ctrlText.textContent = `STEP ${s <= 0.0005 ? 0 : stepIndex(st) + 1}`;
    describe();
  }
  if (!selected) say(processText(st));
  else say(D.pieces[selected].say);
  showPlay();
  return st;
}

function spinWheel(st, dt) {
  if (!st.spin || still.matches) return false;
  wheelAngle = (wheelAngle + dt * 9) % wheelPhases.length;
  const n = Math.floor(wheelAngle);
  wheelPhases.forEach((el, i) => (el.style.display = i === n ? "" : "none"));
  return true;
}

function showPlay() {
  const done = s >= 0.9995;
  const text = playing ? "Pause" : done ? "Replay" : "Play";
  if (playText.textContent !== text) playText.textContent = text;
  playButton.toggleAttribute("data-playing", !!playing);
  playButton.setAttribute("aria-label", playing ? "Pause" : done ? "Replay the backside-power build" : "Play the backside-power build");
}

// idle tour: rewind through the build, play it forward, hold the finished chip, then walk the parts
const TOUR = { rewind: 3, forward: PLAY_SECONDS, hold: 2.5, part: 1.6 };
function tourAt(t) {
  const total = TOUR.rewind + TOUR.forward + TOUR.hold + D.order.length * TOUR.part + 1.5;
  t %= total;
  if (t < TOUR.rewind) return { s: 1 - t / TOUR.rewind, part: null };
  t -= TOUR.rewind;
  if (t < TOUR.forward) return { s: t / TOUR.forward, part: null };
  t -= TOUR.forward;
  if (t < TOUR.hold) return { s: 1, part: null };
  t -= TOUR.hold;
  const i = Math.floor(t / TOUR.part);
  return { s: 1, part: i < D.order.length ? D.order[i] : null };
}

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  let moving = false;
  if (touring) {
    tourClock += dt;
    if (tourClock > 1.4) {
      const step = tourAt(tourClock - 1.4);
      s = step.s;
      select(step.part);
    }
    moving = true;
  } else if (playing) {
    playing.t = Math.min(1, playing.t + dt / playing.seconds);
    s = playing.from + (playing.to - playing.from) * playing.t;
    if (playing.t >= 1) playing = null;
    moving = true;
  }
  const st = draw();
  if (spinWheel(st, dt)) moving = true;
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

function quietTour() {
  touring = false;
  tookOver = true;
  clearTimeout(idleTimer);
}

function pieceAt(event) {
  const hit = document.elementFromPoint(event.clientX, event.clientY);
  const el = hit && hit.closest ? hit.closest("[data-piece]") : null;
  return el && stage.contains(el) ? el.dataset.piece : null;
}

function play() {
  quietTour();
  select(null);
  if (playing) {
    playing = null;
    draw();
    return;
  }
  const from = s >= 0.9995 ? 0 : s;
  if (still.matches) {
    s = 1;
    draw();
    return;
  }
  playing = { from, to: 1, t: 0, seconds: PLAY_SECONDS * (1 - from) };
  run();
}

function reset() {
  quietTour();
  playing = null;
  select(null);
  s = 1;
  draw();
}

stage.addEventListener("pointermove", (event) => {
  if (event.pointerType === "touch") return;
  inside = true;
  clearTimeout(leaveTimer);
  if (touring) quietTour();
  select(pieceAt(event));
  draw();
});

stage.addEventListener("pointerleave", () => {
  inside = false;
  clearTimeout(leaveTimer);
  leaveTimer = setTimeout(() => {
    if (!inside) {
      select(null);
      draw();
    }
  }, 260);
});

stage.addEventListener("pointerdown", (event) => {
  if (event.pointerType !== "touch") {
    stage.focus({ preventScroll: true });
    return;
  }
  quietTour();
  const id = pieceAt(event);
  select(id && id !== selected ? id : null);
  draw();
});

partButtons.forEach((button) => {
  const show = () => {
    quietTour();
    clearTimeout(leaveTimer);
    select(button.dataset.part);
    draw();
  };
  const hide = () => {
    clearTimeout(leaveTimer);
    leaveTimer = setTimeout(() => {
      if (inside || partButtons.some((other) => other.matches(":hover, :focus-visible"))) return;
      select(null);
      draw();
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
  if (event.key === " ") {
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
  draw();
});

scrubInput.addEventListener("input", () => {
  quietTour();
  playing = null;
  select(null);
  s = Number(scrubInput.value) / 1000;
  draw();
});

playButton.addEventListener("click", play);

// for headless checks: window.__scrub(0..1000) sets the build position and stops the tour
window.__scrub = (value) => {
  quietTour();
  playing = null;
  select(null);
  s = value / 1000;
  draw();
  return stepText.textContent;
};

const narrow = matchMedia("(hover: none), (max-width: 480px)");
const wording = () => hint && (hint.textContent = narrow.matches ? "Tap a layer · Play builds it" : "Hover a layer · Space plays the build");
wording();
narrow.addEventListener("change", wording);
if (still.matches) touring = false;
draw();
