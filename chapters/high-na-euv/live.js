const D = __DATA__;
const root = document.querySelector(".hna");
const stage = root.querySelector(".hna-stage");
const svg = stage.querySelector("svg");
const live = root.querySelector("[data-live]");
const readout = root.querySelector("[data-readout]");
const partButtons = [...root.querySelectorAll(".hna-part")];
const scrubInput = root.querySelector("[data-scrub]");
const playButton = root.querySelector("[data-play]");
const playText = root.querySelector("[data-play-text]");
const stepText = root.querySelector("[data-step]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const $ = (sel) => svg.querySelector(sel);
const $$ = (sel) => [...svg.querySelectorAll(sel)];

// ---- timeline: every step has a duration; T runs from 0 to TOTAL seconds ----
const STEPS = D.steps;
const START = [];
let TOTAL = 0;
for (const step of STEPS) {
  START.push(TOTAL);
  TOTAL += step.seconds;
}
const indexOf = (id) => STEPS.findIndex((s) => s.id === id);
const t0 = (id) => START[indexOf(id)];
const t1 = (id) => START[indexOf(id)] + STEPS[indexOf(id)].seconds;
const local = (id, T) => Math.min(1, Math.max(0, (T - t0(id)) / STEPS[indexOf(id)].seconds));
const clamp = (v) => Math.min(1, Math.max(0, v));
const ease = (v) => {
  const t = clamp(v);
  return t * t * (3 - 2 * t);
};
const ramp = (u, a, b) => ease((u - a) / (b - a));
const stepAt = (T) => {
  let i = 0;
  while (i < STEPS.length - 1 && T >= START[i + 1]) i++;
  return i;
};

// screen offset of a world vector
const screen = ([x, y, z]) => [D.EX[0] * x + D.EY[0] * y + D.EZ[0] * z, D.EX[1] * x + D.EY[1] * y + D.EZ[1] * z];
const move = (el, v) => {
  if (!el) return;
  const [sx, sy] = screen(v);
  const text = Math.abs(sx) + Math.abs(sy) < 0.01 ? "" : `translate(${sx.toFixed(2)} ${sy.toFixed(2)})`;
  if (el.__t === text) return;
  el.__t = text;
  if (text) el.setAttribute("transform", text);
  else el.removeAttribute("transform");
};
const fade = (el, v) => {
  if (!el) return;
  const text = v >= 0.999 ? "" : v.toFixed(3);
  if (el.__o === text) return;
  el.__o = text;
  if (text) el.style.opacity = text;
  else el.style.removeProperty("opacity");
};
// ---- refs ----
const waferMovers = $$('[data-move="wafer"]');
const reticleMovers = $$('[data-move="reticle"]');
const masks = { A: $('[data-mask="A"]'), B: $('[data-mask="B"]') };
const drops = $("[data-drops]");
const co2 = $(".hna-co2");
const flash = $(".hna-flash");
const srcCone = $(".hna-srccone");
const cones = { high: $('[data-cone="high"]'), low: $('[data-cone="low"]') };
const slit = $(".hna-slit");
const seam = $(".hna-seam");
const dieLine = $(".hna-die");
const legs = $$(".hna-beam").sort((a, b) => a.dataset.leg - b.dataset.leg);
const rays = legs.map((leg) => {
  const path = leg.querySelector(".hna-ray");
  const length = path.getTotalLength ? path.getTotalLength() : 100;
  return { leg, path, length, dots: leg.querySelector(".iso-dots") };
});
const cellsOf = (die, half) => $$(`.hna-field[data-die="${die}"][data-half="${half}"]`);
const DIES = D.dies.length;
const cellA = cellsOf(0, "A");
const cellB = cellsOf(0, "B");
const rest = [];
for (let i = 1; i < DIES; i++) rest.push([...cellsOf(i, "A"), ...cellsOf(i, "B")]);
const nodes = $$(".it");
const dropFrom = D.drops.from;
const dropTo = D.drops.to;
const dropHit = D.drops.hit;
const DROP_COUNT = 12;
const dropCircles = [];
for (let i = 0; i < DROP_COUNT; i++) {
  const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  c.setAttribute("class", "hna-drop");
  c.setAttribute("r", "0.9");
  drops.appendChild(c);
  dropCircles.push(c);
}

// ---- the process as a pure function of T ----
const H = D.half[1];
// scan pose: the wafer's offset along y (world units) and the scan position s within the half field
function scanPose(T) {
  const u = (s) => local(s, T);
  const A0 = -H / 2; // centre of half A on the wafer
  const B0 = H / 2;
  if (T < t0("half1")) return { wafer: 0, s: 0, a: 0, b: 0 };
  if (T < t1("half1")) {
    const v = u("half1");
    if (v < 0.15) return { wafer: -(A0 - H / 2) * ease(v / 0.15), s: -H / 2, a: 0, b: 0 };
    const p = ease((v - 0.15) / 0.75);
    const s = -H / 2 + H * p;
    return { wafer: -(A0 + s), s, a: p, b: 0 };
  }
  if (T < t1("swap")) {
    // the wafer steps to the start of half B (scanning back the other way) while the reticles change
    const p = ease(u("swap"));
    const from = -(A0 + H / 2);
    const to = -(B0 + H / 2);
    return { wafer: from + (to - from) * p, s: H / 2, a: 1, b: 0 };
  }
  if (T < t1("half2")) {
    const v = u("half2");
    const p = ease(clamp((v - 0.05) / 0.8));
    const s = H / 2 - H * p;
    return { wafer: -(B0 + s), s, a: 1, b: p };
  }
  const back = ease(local("stitch", T) / 0.2);
  const from = -(B0 - H / 2);
  return { wafer: from * (1 - back), s: 0, a: 1, b: 1 };
}

let clock = 0;
function render(T, calm) {
  const u = (s) => local(s, T);
  // the source runs from the first step on: droplets stream, the laser fires, the collected light converges
  const on = T > 0.001;
  const firing = T >= t0("source") + STEPS[0].seconds * 0.3;
  const span = dropTo[0] - dropFrom[0];
  const hitAt = (dropHit[0] - dropFrom[0]) / span;
  const phase = calm ? 0.37 : (clock * 0.55) % 1;
  dropCircles.forEach((c, i) => {
    const s = (phase + i / DROP_COUNT) % 1;
    const visible = on && (!firing || s < hitAt - 0.01);
    c.setAttribute("cx", (dropFrom[0] + span * s).toFixed(1));
    c.setAttribute("cy", (dropFrom[1] + (dropTo[1] - dropFrom[1]) * s).toFixed(1));
    c.setAttribute("opacity", visible ? (firing && s > hitAt - 0.08 ? "0.5" : "1") : "0");
  });
  fade(drops, on ? 1 : 0);
  const pulse = calm ? 1 : 0.5 + 0.5 * Math.cos(clock * 21);
  fade(co2, firing ? 0.25 + 0.75 * pulse : 0);
  fade(flash, firing ? 0.35 + 0.65 * pulse : 0);
  flash?.setAttribute("r", firing ? (2 + 2.2 * pulse).toFixed(2) : "2");
  fade(srcCone, T < t0("source") ? 0 : ramp(u("source"), 0.45, 0.8));

  // the light path, leg by leg: four through the illuminator to the reticle, eight down the projection optics
  rays.forEach((ray, index) => {
    let p;
    if (index < D.illumLegs) p = T < t0("illuminate") ? 0 : clamp((u("illuminate") * 1.15 - index / D.illumLegs) * D.illumLegs);
    else p = T < t0("project") ? 0 : clamp((u("project") * 1.25 - (index - D.illumLegs) / (D.legs - D.illumLegs)) * (D.legs - D.illumLegs));
    const dash = p >= 0.999 ? "" : `${(ray.length * p).toFixed(2)} ${ray.length.toFixed(2)}`;
    if (ray.dash !== dash) {
      ray.dash = dash;
      if (dash) ray.path.setAttribute("stroke-dasharray", dash);
      else ray.path.removeAttribute("stroke-dasharray");
    }
    fade(ray.leg, p > 0 ? 1 : 0);
    fade(ray.dots, p >= 0.999 ? 1 : 0);
  });
  // the exit cones: the 0.55 cone forms as the last leg lands; the 0.33 cone appears for comparison
  fade(cones.high, T < t0("project") ? 0 : ramp(u("project"), 0.8, 1));
  const lowOn = T < t0("cone") ? 0 : ramp(u("cone"), 0.1, 0.4);
  fade(cones.low, lowOn);
  cones.low?.toggleAttribute("data-near", T >= t0("cone") && T < t1("cone"));

  // exposure: the wafer scans under the slit; the reticle sweeps 8x the wafer's travel, the other way
  const pose = scanPose(T);
  for (const el of waferMovers) move(el, [0, pose.wafer, 0]);
  const reticleY = pose.s * D.reticleGain;
  const exposing = (T >= t0("half1") + STEPS[indexOf("half1")].seconds * 0.15 && T < t1("half1")) || (T >= t0("half2") && T < t1("half2"));
  fade(slit, exposing ? 1 : T >= t0("stitch") ? 0.0 : 0);
  // the reticle swap: A slides out to the library, B slides in from it
  const sw = T < t0("swap") ? 0 : T >= t1("swap") ? 1 : u("swap");
  const outA = ramp(sw, 0.05, 0.45);
  const inB = ramp(sw, 0.55, 0.95);
  for (const el of reticleMovers) move(el, [0, reticleY, 0]);
  move(masks.A, [D.swapX * outA, reticleY, 0]);
  move(masks.B, [D.swapX * (1 - inB), reticleY, 0]);
  fade(masks.A, 1 - ramp(sw, 0.3, 0.45));
  fade(masks.B, ramp(sw, 0.55, 0.7));

  // the fields: half A fills as it scans, then half B, then the seam and the die outline light; the rest of the wafer follows
  for (const cell of cellA) fade(cell, pose.a * 0.6);
  for (const cell of cellB) fade(cell, pose.b * 0.6);
  const st = T >= t0("stitch") ? u("stitch") : 0;
  fade(seam, T >= t0("stitch") ? ramp(st, 0.15, 0.3) * (1 - ramp(st, 0.55, 0.7)) : 0);
  fade(dieLine, T >= t0("stitch") ? ramp(st, 0.25, 0.4) : 0);
  const done = T >= t0("stitch") ? clamp((st - 0.45) / 0.5) * rest.length : 0;
  rest.forEach((group, i) => {
    const v = clamp(done - i) * 0.32;
    for (const cell of group) fade(cell, v);
  });
  return { pose, stitched: Math.min(rest.length + 1, 1 + Math.floor(done)) };
}
// ---- readout, step label, selection ----
let T = 0;
let lastStep = -1;
let playing = false;
let selected = null;
let touring = !still.matches;
let tookOver = false;
let inside = false;
let visible = false;
let frame = 0;
let last = 0;
let spoken = "";
let leaveTimer = 0;
let tourTimer = 0;

function stepLabel(i) {
  return `${String(i + 1).padStart(2, "0")} · ${STEPS[i].name}`;
}
function say(text) {
  if (readout.textContent !== text) readout.textContent = text;
}
function announce(text) {
  if (text === spoken) return;
  spoken = text;
  live.textContent = text;
}
function readoutText(pose) {
  if (selected) return D.pieces[selected].say;
  if (T <= 0.001 && !playing) return D.idle;
  const i = stepAt(T);
  const step = STEPS[i];
  if (step.id === "stitch" && pose.stitched > 1) return `die ${pose.stitched} / ${D.dies.length} · each from two stitched half fields`;
  return step.say;
}
function select(id) {
  if (id === "frame" || id === "wafer") id = null;
  if (selected === id) return;
  selected = id;
  for (const node of nodes) node.toggleAttribute("data-on", id !== null && node.dataset.piece === id);
  stage.toggleAttribute("data-focus", id !== null);
  partButtons.forEach((button) => button.toggleAttribute("data-on", button.dataset.part === id));
  if (id) announce(`${D.pieces[id].name}: ${D.pieces[id].say}`);
}
function show() {
  const pose = render(T, still.matches);
  const i = stepAt(T);
  const label = stepLabel(i);
  if (stepText.textContent !== label) stepText.textContent = label;
  if (i !== lastStep) {
    lastStep = i;
    if (playing || T > 0) announce(`${label}: ${STEPS[i].say}`);
  }
  scrubInput.value = String(Math.round((T / TOTAL) * 1000));
  playText.textContent = playing ? "Pause" : T >= TOTAL - 0.001 ? "Replay" : "Play";
  playButton.toggleAttribute("data-playing", playing);
  playButton.setAttribute("aria-label", playing ? "Pause" : "Play the process");
  say(readoutText(pose));
}

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  clock += dt;
  if (playing) {
    T = Math.min(TOTAL, T + dt);
    if (T >= TOTAL) {
      if (touring) T = 0;
      else playing = false;
    }
  }
  show();
  const busy = playing || T > 0.001;
  frame = visible && busy && !still.matches ? requestAnimationFrame(tick) : 0;
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

// ---- control ----
function takeOver() {
  tookOver = true;
  touring = false;
  clearTimeout(tourTimer);
}
function play(on) {
  if (on && T >= TOTAL - 0.001) T = 0;
  if (on && still.matches) {
    // reduced motion: jump to the end of the next step instead of animating
    const i = stepAt(T);
    const end = START[i] + STEPS[i].seconds;
    const j = i + 1;
    T = T < end - 0.01 ? end - 0.001 : j < STEPS.length ? START[j] + STEPS[j].seconds - 0.001 : TOTAL;
    playing = false;
    show();
    return;
  }
  playing = on;
  show();
  run();
}
function reset() {
  playing = false;
  T = 0;
  select(null);
  show();
  run();
}

function pieceAt(event) {
  const hit = document.elementFromPoint(event.clientX, event.clientY);
  const item = hit && hit.closest ? hit.closest(".it") : null;
  return item ? item.dataset.piece : null;
}

stage.addEventListener("pointermove", (event) => {
  if (event.pointerType === "touch") return;
  inside = true;
  clearTimeout(leaveTimer);
  select(pieceAt(event));
  show();
});
stage.addEventListener("pointerleave", () => {
  inside = false;
  clearTimeout(leaveTimer);
  leaveTimer = setTimeout(() => {
    if (inside) return;
    select(null);
    show();
  }, 260);
});
stage.addEventListener("pointerdown", (event) => {
  if (event.pointerType !== "touch") {
    stage.focus({ preventScroll: true });
    return;
  }
  takeOver();
  const id = pieceAt(event);
  select(id && id !== "frame" && id !== "wafer" && id !== selected ? id : null);
  show();
});

partButtons.forEach((button) => {
  const pick = () => {
    clearTimeout(leaveTimer);
    select(button.dataset.part);
    show();
  };
  const drop = () => {
    clearTimeout(leaveTimer);
    leaveTimer = setTimeout(() => {
      if (inside || partButtons.some((other) => other.matches(":hover, :focus-visible"))) return;
      select(null);
      show();
    }, 260);
  };
  button.addEventListener("pointerenter", pick);
  button.addEventListener("focus", pick);
  button.addEventListener("pointerleave", drop);
  button.addEventListener("blur", drop);
  button.addEventListener("click", () => {
    takeOver();
    pick();
  });
});

stage.addEventListener("focus", () => {
  spoken = "";
  announce(selected ? `${D.pieces[selected].name}: ${D.pieces[selected].say}` : `${stepLabel(stepAt(T))}: ${STEPS[stepAt(T)].say}`);
});

document.addEventListener("keydown", (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey || !visible) return;
  const target = event.target;
  if (target !== document.body && target !== stage && !root.contains(target)) return;
  if (target === scrubInput && event.key !== " " && event.key !== "Escape") return;
  if (target instanceof HTMLButtonElement && (event.key === " " || event.key === "Enter")) return;
  if (event.key === " ") {
    event.preventDefault();
    takeOver();
    play(!playing);
    return;
  }
  if (event.key === "Escape") {
    event.preventDefault();
    takeOver();
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
  takeOver();
  select(D.order[next]);
  show();
});

scrubInput.addEventListener("input", () => {
  takeOver();
  playing = false;
  T = (Number(scrubInput.value) / 1000) * TOTAL;
  show();
  run();
});

playButton.addEventListener("click", () => {
  takeOver();
  play(!playing);
});

// idle tour: the process plays on a loop until the reader first acts
if (touring) {
  tourTimer = setTimeout(() => {
    if (tookOver || still.matches) return;
    touring = true;
    playing = true;
    run();
  }, 1400);
}

const narrow = matchMedia("(hover: none), (max-width: 480px)");
const hint = root.querySelector(".hna-hint");
const wording = () => hint && (hint.textContent = narrow.matches ? "Tap a module · Play below" : "Hover a module · Space plays the exposure");
wording();
narrow.addEventListener("change", wording);
show();
