const D = __DATA__;
const root = document.querySelector(".euv");
const stage = root.querySelector(".euv-stage");
const svg = stage.querySelector("svg");
const live = root.querySelector("[data-live]");
const readout = root.querySelector("[data-readout]");
const partButtons = [...root.querySelectorAll(".euv-part")];
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
// a circle of radius r on a wafer's top face, as a screen path
const ellipse = (c, r, n = 48) => {
  let d = "";
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = c[0] + (D.EX[0] * Math.cos(a) + D.EY[0] * Math.sin(a)) * r;
    const y = c[1] + (D.EX[1] * Math.cos(a) + D.EY[1] * Math.sin(a)) * r;
    d += `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return d + "Z";
};
const onTop = (c, r, a) => [c[0] + (D.EX[0] * Math.cos(a) + D.EY[0] * Math.sin(a)) * r, c[1] + (D.EX[1] * Math.cos(a) + D.EY[1] * Math.sin(a)) * r];

// ---- refs ----
const wafers = Object.fromEntries(Object.keys(D.centres).map((id) => [id, $(`[data-wafer="${id}"]`)]));
const films = Object.fromEntries(Object.keys(D.centres).map((id) => [id, $(`[data-film="${id}"]`)]));
const notches = Object.fromEntries(Object.keys(D.centres).map((id) => [id, wafers[id] && wafers[id].querySelector(".iso-solid ~ .iso-line")]));
const cells = Object.fromEntries(["stage", "peb", "dev"].map((id) => [id, wafers[id] ? [...wafers[id].querySelectorAll(".euv-field")] : []]));
const arms = { coat: $('[data-arm="coat"]'), dev: $('[data-arm="dev"]') };
const lids = { soft: $('[data-lid="soft"]'), peb: $('[data-lid="peb"]') };
const plates = { soft: $('[data-name="track.soft.plate"]'), peb: $('[data-name="track.peb.plate"]') };
const waferMovers = [...$$('[data-move="wafer"]'), wafers.stage];
const reticleMovers = $$('[data-move="reticle"]');
const drops = $("[data-drops]");
const co2 = $(".euv-co2");
const flash = $(".euv-flash");
const cone = $(".euv-cone");
const legs = $$(".euv-beam").sort((a, b) => a.dataset.leg - b.dataset.leg);
const rays = legs.map((leg) => {
  const path = leg.querySelector(".euv-ray");
  const length = path.getTotalLength ? path.getTotalLength() : 100;
  return { leg, path, length, dots: leg.querySelector(".iso-dots"), shown: -1 };
});
const slit = $(".euv-slit");
const nodes = $$(".it");
const dropFrom = D.drops.from;
const dropTo = D.drops.to;
const dropHit = D.drops.hit;
const DROP_COUNT = 12;
const dropCircles = [];
for (let i = 0; i < DROP_COUNT; i++) {
  const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  c.setAttribute("class", "euv-drop");
  c.setAttribute("r", "0.9");
  drops.appendChild(c);
  dropCircles.push(c);
}

// ---- the process as a pure function of T ----
const N = D.fields.length;
function fieldAt(u) {
  // a slow start so the first fields can be followed, then the rest at speed
  const v = clamp((u - 0.08) / 0.84);
  return v < 0.4 ? (v / 0.4) * 4 : 4 + ((v - 0.4) / 0.6) * (N - 4);
}
function scanPose(T) {
  // returns the wafer's offset [x, y], the reticle's y, and how many fields are exposed
  const half = D.field[1] / 2;
  const centre = (i) => D.fields[Math.max(0, Math.min(N - 1, i))];
  const dir = (i) => (i % 2 ? -1 : 1);
  const before = T < t0("scan");
  const after = T >= t1("scan");
  if (before || after) {
    const done = after ? N : 0;
    const back = after ? ramp(local("peb", T), 0, 0.3) : 0;
    const last = centre(N - 1);
    const endY = dir(N - 1) * half;
    if (after) return { wafer: [-last[0] * (1 - back), -(last[1] + endY) * (1 - back)], reticle: endY * D.reticleGain * (1 - back), exposed: done, i: N - 1 };
    return { wafer: [0, 0], reticle: 0, exposed: 0, i: 0 };
  }
  const u = local("scan", T);
  if (u < 0.08) {
    const k = ease(u / 0.08);
    const c = centre(0);
    return { wafer: [-c[0] * k, -(c[1] - half) * k], reticle: -half * D.reticleGain * k, exposed: 0, i: 0 };
  }
  const f = Math.min(N - 1e-6, fieldAt(u));
  const i = Math.floor(f);
  const frac = f - i;
  const c = centre(i);
  if (frac < 0.72) {
    const y = dir(i) * half * (-1 + 2 * ease(frac / 0.72));
    return { wafer: [-c[0], -(c[1] + y)], reticle: y * D.reticleGain, exposed: i + ease(frac / 0.72), i };
  }
  const k = ease((frac - 0.72) / 0.28);
  const n = centre(i + 1);
  const yEnd = dir(i) * half;
  const yNext = -dir(i + 1) * half;
  const y = yEnd + (yNext - yEnd) * k;
  return { wafer: [-(c[0] + (n[0] - c[0]) * k), -(c[1] + (n[1] - c[1]) * k + y)], reticle: y * D.reticleGain, exposed: i + 1, i };
}

function waferShown(id, T) {
  const u = (s) => local(s, T);
  switch (id) {
    case "coat":
      return T < t1("coat") ? 1 : 1 - ramp(u("softbake"), 0, 0.15);
    case "soft":
      return T < t0("softbake") ? 0 : T < t1("softbake") ? ramp(u("softbake"), 0, 0.15) : 1 - ramp(u("load"), 0.05, 0.4);
    case "stage":
      return T < t0("load") ? 0 : T < t1("scan") ? ramp(u("load"), 0.45, 0.85) : 1 - ramp(u("peb"), 0.15, 0.35);
    case "peb":
      return T < t0("peb") ? 0 : T < t1("peb") ? ramp(u("peb"), 0.3, 0.5) : 1 - ramp(u("develop"), 0, 0.15);
    case "dev":
      return T < t0("develop") ? 0 : ramp(u("develop"), 0.1, 0.25);
  }
  return 0;
}

let spin = { coat: 0, dev: 0 };
let clock = 0;
let lastStep = -1;
function render(T, calm) {
  const u = (s) => local(s, T);
  // wafers at their stations
  for (const id of Object.keys(wafers)) fade(wafers[id], waferShown(id, T));
  // coat: the arm swings in, resist lands and spreads while the wafer spins, the arm parks
  const coatU = u("coat");
  const coatArm = T < t1("coat") ? ramp(coatU, 0.04, 0.2) * (1 - ramp(coatU, 0.74, 0.9)) : 0;
  move(arms.coat, [D.armTravel * coatArm, 0, 0]);
  const resist = T >= t1("coat") ? 1 : ramp(coatU, 0.22, 0.75);
  films.coat?.setAttribute("d", resist > 0.01 ? ellipse(D.centres.coat, Math.max(1.2, D.waferR * resist)) : "");
  for (const id of ["soft", "stage", "peb"]) if (films[id] && !films[id].getAttribute("d")) films[id].setAttribute("d", ellipse(D.centres[id], D.waferR));
  // develop: the arm comes in, a puddle spreads, the pattern appears
  const devU = u("develop");
  const devArm = T >= t0("develop") ? ramp(devU, 0.2, 0.34) * (1 - ramp(devU, 0.8, 0.94)) : 0;
  move(arms.dev, [D.armTravel * devArm, 0, 0]);
  const puddle = T >= t0("develop") ? ramp(devU, 0.34, 0.6) : 0;
  films.dev?.setAttribute("d", ellipse(D.centres.dev, D.waferR * Math.max(0.05, puddle)));
  fade(films.dev, T >= t0("develop") ? 0.35 + 0.65 * (1 - ramp(devU, 0.75, 1)) * Math.max(0.2, puddle) : 1);
  // spin: the notch turns while a cup spins the wafer
  const spinning = { coat: T < t1("coat") ? ramp(coatU, 0.15, 0.3) * (1 - ramp(coatU, 0.85, 1)) : 0, dev: T >= t0("develop") ? ramp(devU, 0.3, 0.4) * (1 - ramp(devU, 0.85, 1)) : 0 };
  for (const id of ["coat", "dev"]) {
    const notch = notches[id];
    if (!notch) continue;
    const a = -Math.PI / 2 + (calm ? 0 : spin[id]);
    const c = D.centres[id];
    const p0 = onTop(c, D.waferR, a);
    const p1 = onTop(c, D.waferR - 2.6, a);
    notch.setAttribute("d", `M${p0[0].toFixed(1)} ${p0[1].toFixed(1)}L${p1[0].toFixed(1)} ${p1[1].toFixed(1)}`);
    spin[id + "Rate"] = spinning[id];
  }
  // bakes: the lid comes down onto the plate, the plate glows
  const softU = u("softbake");
  const softLid = T >= t0("softbake") && T < t1("softbake") ? ramp(softU, 0.15, 0.3) * (1 - ramp(softU, 0.82, 0.97)) : 0;
  move(lids.soft, [0, 0, -D.lidDrop * softLid]);
  const pebU = u("peb");
  const pebLid = T >= t0("peb") && T < t1("peb") ? ramp(pebU, 0.48, 0.62) * (1 - ramp(pebU, 0.88, 1)) : 0;
  move(lids.peb, [0, 0, -D.lidDrop * pebLid]);
  plates.soft?.toggleAttribute("data-hot", softLid > 0.6);
  plates.peb?.toggleAttribute("data-hot", pebLid > 0.6);

  // the source: droplets stream; once the laser fires, each one is hit at the plasma point
  const sourceOn = T >= t0("droplet") && T < t0("peb") + 0.6;
  const firing = T >= t0("droplet") + STEPS[indexOf("droplet")].seconds * 0.3 && T < t0("peb");
  const dropOn = T >= t0("droplet") - 0.2 && T < t0("peb") + 0.8;
  const span = dropTo[0] - dropFrom[0];
  const hitAt = (dropHit[0] - dropFrom[0]) / span;
  const phase = calm ? 0.37 : (clock * 0.55) % 1;
  dropCircles.forEach((c, i) => {
    const s = (phase + i / DROP_COUNT) % 1;
    const visible = dropOn && (!firing || s < hitAt - 0.01);
    c.setAttribute("cx", (dropFrom[0] + (dropTo[0] - dropFrom[0]) * s).toFixed(1));
    c.setAttribute("cy", (dropFrom[1] + (dropTo[1] - dropFrom[1]) * s).toFixed(1));
    c.setAttribute("opacity", visible ? (firing && s > hitAt - 0.08 ? "0.5" : "1") : "0");
  });
  const pulse = calm ? 1 : 0.5 + 0.5 * Math.cos(clock * 21);
  fade(co2, firing ? 0.25 + 0.75 * pulse : 0);
  fade(flash, firing ? 0.35 + 0.65 * pulse : 0);
  flash?.setAttribute("r", firing ? (2.2 + 2.6 * pulse).toFixed(2) : "2");
  const coneOn = T < t0("droplet") ? 0 : T < t0("peb") ? ramp(u("droplet"), 0.45, 0.8) : 1 - ramp(u("peb"), 0, 0.15);
  fade(cone, coneOn);
  fade(drops, sourceOn || dropOn ? 1 : 0);

  // the light path, leg by leg: four through the illuminator to the reticle, seven down to the wafer
  const lightOff = T >= t0("peb") ? 1 - ramp(u("peb"), 0, 0.15) : 1;
  rays.forEach((ray, index) => {
    let p;
    if (index < D.illumLegs) p = T < t0("illuminate") ? 0 : clamp((u("illuminate") * 1.15 - index / D.illumLegs) * D.illumLegs);
    else p = T < t0("project") ? 0 : clamp((u("project") * 1.15 - (index - D.illumLegs) / (D.legs - D.illumLegs)) * (D.legs - D.illumLegs));
    const length = ray.length;
    const dash = p >= 0.999 ? "" : `${(length * p).toFixed(2)} ${length.toFixed(2)}`;
    if (ray.dash !== dash) {
      ray.dash = dash;
      if (dash) ray.path.setAttribute("stroke-dasharray", dash);
      else ray.path.removeAttribute("stroke-dasharray");
    }
    fade(ray.leg, p > 0 ? lightOff : 0);
    fade(ray.dots, p >= 0.999 ? 1 : 0);
  });
  const lastLeg = rays[rays.length - 1];
  const slitOn = T >= t0("project") && T < t0("peb") ? (u("project") * 1.15 >= 1 - 0.001 || T >= t0("scan") ? 1 : 0) : T >= t0("peb") ? lightOff : 0;
  fade(slit, slitOn);

  // scanning: the wafer steps field by field; the reticle sweeps 4x the wafer's travel, the other way
  const pose = scanPose(T);
  for (const el of waferMovers) move(el, [pose.wafer[0], pose.wafer[1], 0]);
  for (const el of reticleMovers) move(el, [0, pose.reticle, 0]);
  const exposed = pose.exposed;
  cells.stage.forEach((cell, i) => fade(cell, clamp(exposed - i) * 0.55));
  cells.peb.forEach((cell) => fade(cell, 0.3));
  const developed = T >= t0("develop") ? ramp(devU, 0.45, 0.8) : 0;
  cells.dev.forEach((cell) => fade(cell, 0.15 + 0.6 * developed));
  return pose;
}

// ---- readout, step label, selection ----
let T = 0;
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
  if (step.id === "scan") {
    const n = Math.min(D.fieldCount, Math.max(1, Math.ceil((pose.exposed / D.fields.length) * D.fieldCount)));
    return `field ${n} / ${D.fieldCount} · reticle moves ${D.reticleGain}× the wafer`;
  }
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
  if (!still.matches) {
    spin.coat += dt * 9 * (spin.coatRate || 0);
    spin.dev += dt * 9 * (spin.devRate || 0);
  }
  if (playing) {
    T = Math.min(TOTAL, T + dt);
    if (T >= TOTAL) {
      if (touring) T = 0;
      else playing = false;
    }
  }
  show();
  const busy = playing || (T >= t0("droplet") && T < t0("peb") + 1) || (spin.coatRate || 0) > 0 || (spin.devRate || 0) > 0;
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
const hint = root.querySelector(".euv-hint");
const wording = () => hint && (hint.textContent = narrow.matches ? "Tap a module · Play below" : "Hover a module · Space plays the wafer through");
wording();
narrow.addEventListener("change", wording);
show();
