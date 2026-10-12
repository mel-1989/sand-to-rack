const D = __DATA__;
const root = document.querySelector(".sp");
const stage = root.querySelector(".sp-stage");
const layers = stage.querySelector(".sp-layers");
const live = root.querySelector("[data-live]");
const readout = root.querySelector("[data-readout]");
const partButtons = [...root.querySelectorAll(".sp-part")];
const scrubInput = root.querySelector("[data-scrub]");
const playButton = root.querySelector("[data-play]");
const playText = root.querySelector("[data-play-text]");
const stepText = root.querySelector("[data-step]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const SVGNS = "http://www.w3.org/2000/svg";

const items = [...layers.querySelectorAll(".it")];
const dotBox = root.querySelector("[data-dots]");
const ringGlow = root.querySelector("[data-ringglow]");
const pdGlow = root.querySelector("[data-pdglow]");
const lane = root.querySelector("[data-lane]");
const compare = root.querySelector("[data-compare]");
const insetLabel = root.querySelector("[data-inset-label]");
const inPhoton = root.querySelector("[data-in-photon]");
const inTrace = root.querySelector("[data-in-trace]");
const inRing = root.querySelector("[data-in-ring]");
const inParts = { eic: root.querySelector("[data-in-eic]"), ring: inRing, pd: root.querySelector("[data-in-pd]"), tia: root.querySelector("[data-in-tia]"), wg: root.querySelector("[data-in-wg]") };

const N = D.steps.length;
const WEIGHT = [1, 1, 1.2, 2, 1, 1, 1.4]; // how long each step lasts while playing, relative
const TOTAL = WEIGHT.reduce((a, b) => a + b, 0);
const EDGES = WEIGHT.reduce((list, w) => [...list, list[list.length - 1] + w / TOTAL], [0]);
const SECONDS = 3.4 * TOTAL; // the whole trip while playing
const PAM = [3, 1, 0, 2, 3, 2, 0, 1, 3, 0, 2, 1, 3, 1, 2, 0]; // an example PAM4 symbol sequence, levels 0..3

let s = 0; // position on the path 0..1
let selected = null;
let playing = false;
let touring = !still.matches;
let tourHold = -1.4;
let visible = false;
let frame = 0;
let last = 0;
let clock = 0;
let spokenStep = -1;

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (t) => t * t * (3 - 2 * t);

function make(cls, r) {
  const el = document.createElementNS(SVGNS, "circle");
  el.setAttribute("class", cls);
  el.setAttribute("r", r);
  el.setAttribute("opacity", "0");
  dotBox.appendChild(el);
  return el;
}
const stream = Array.from({ length: 9 }, () => make("sp-photon", 1.5));
const bit = make("sp-bit", 4.2);
bit.setAttribute("fill", "url(#sp-dot-grad)");
const core = make("sp-bit-core", 1.4);
// at phone width the drawing is about 0.45x: grow the bit, the photons and the glows so they stay visible
const small = matchMedia("(max-width: 480px)");
function sizeLight() {
  const k = small.matches ? 1.6 : 1;
  bit.setAttribute("r", (4.2 * k).toFixed(1));
  core.setAttribute("r", (1.4 * k).toFixed(1));
  stream.forEach((el) => el.setAttribute("r", (1.5 * k).toFixed(1)));
  [ringGlow, pdGlow].forEach((el) => el.setAttribute("r", (7 * k).toFixed(1)));
}
sizeLight();
small.addEventListener("change", sizeLight);

function along(path, t) {
  const { pts, cum } = D.screen[path];
  const total = cum[cum.length - 1];
  const want = clamp(t) * total;
  let i = 1;
  while (i < cum.length - 1 && cum[i] < want) i++;
  const seg = cum[i] - cum[i - 1] || 1;
  const u = clamp((want - cum[i - 1]) / seg);
  // seen: 0 inside a housing or glass block, ramping over 5 px at each edge so the dot fades rather than pops
  let seen = 1;
  for (const [a, b] of D.screen[path].hide) seen = Math.min(seen, 1 - Math.min(clamp((want - a + 5) / 5), clamp((b + 5 - want) / 5)));
  return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * u, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * u, seen];
}

function stepAt(v) {
  for (let i = 0; i < N; i++) if (v < EDGES[i + 1]) return { i, t: (v - EDGES[i]) / (EDGES[i + 1] - EDGES[i]) };
  return { i: N - 1, t: 1 };
}

function say(text) {
  if (readout.textContent !== text) readout.textContent = text;
}

function select(id) {
  if (selected === id) return;
  selected = id;
  for (const el of items) {
    if (id !== null && el.dataset.piece === id) el.setAttribute("data-on", "");
    else el.removeAttribute("data-on");
  }
  if (id) stage.setAttribute("data-focus", "");
  else stage.removeAttribute("data-focus");
  partButtons.forEach((b) => (b.dataset.part === id ? b.setAttribute("data-on", "") : b.removeAttribute("data-on")));
  if (id && document.activeElement && root.contains(document.activeElement)) live.textContent = `${D.parts[id].name}: ${D.parts[id].say}`;
}

let running = "";
function markRun(key) {
  if (key === running) return;
  running = key;
  const list = key ? D.run[key] : [];
  for (const el of items) {
    const name = el.dataset.name;
    const on = list.some((p) => name === p || name.startsWith(p.endsWith(".") ? p : `${p}:`) || name.startsWith(`${p}.fit`));
    if (on) el.setAttribute("data-run", "");
    else el.removeAttribute("data-run");
  }
}

function show(el, x, y, o) {
  el.setAttribute("cx", x.toFixed(1));
  el.setAttribute("cy", y.toFixed(1));
  el.setAttribute("opacity", (Math.round(o * 100) / 100).toString());
}
const hide = (el) => el.getAttribute("opacity") !== "0" && el.setAttribute("opacity", "0");

function drawLight(i, t, idle) {
  const calm = still.matches;
  const id = D.steps[i].id;
  // the steady laser light: a stream along the laser fibre into the engine while it is on
  const laserOn = !idle && i >= 1 && i <= 3 ? (i === 1 ? ease(clamp(t * 3)) : i === 3 ? 1 - ease(clamp((t - 0.6) * 2.5)) : 1) : 0;
  stream.forEach((el, k) => {
    if (laserOn < 0.02) return hide(el);
    const p = calm ? k / stream.length : (k / stream.length + clock * 0.35) % 1;
    const reach = i === 1 ? t : 1;
    if (p > reach) return hide(el);
    const [x, y, seen] = along("laser", p);
    show(el, x, y, seen * laserOn * Math.min(1, p * 8) * Math.min(1, (1 - p) * 8) * 0.9);
  });
  // the bit itself
  let pos = null;
  if (!idle) {
    if (id === "serdes") pos = along("serdes", ease(t));
    else if (id === "laser") pos = along("driver", ease(clamp(t * 1.2)));
    else if (id === "ring") pos = along("driver", 1);
    else if (id === "fibre") pos = along("fibre", calm ? t : ease(t));
    else if (id === "detect") pos = along("back", 0);
    else if (id === "back") pos = along("back", ease(t));
    else pos = along("plug", ease(t));
  }
  if (pos) {
    const fade = (id === "compare" ? 1 - clamp((t - 0.9) * 10) : 1) * pos[2];
    show(bit, pos[0], pos[1], fade);
    show(core, pos[0], pos[1], fade);
  } else {
    hide(bit);
    hide(core);
  }
  // the ring flickers through four levels while it modulates; the photodiode glows as light arrives
  const sym = PAM[Math.floor((calm ? 0.5 : clock) * 6) % PAM.length];
  const ringOn = idle ? 0 : id === "ring" ? 0.35 + 0.2 * sym : id === "fibre" ? (1 - clamp(t * 4)) * 0.6 : 0;
  ringGlow.setAttribute("opacity", ringOn.toFixed(2));
  const pdOn = idle ? 0 : id === "detect" ? 0.45 + 0.45 * ease(clamp(t * 2)) : id === "fibre" ? clamp((t - 0.92) * 12) * 0.5 : id === "back" ? 0.9 * (1 - clamp(t * 3)) : 0;
  pdGlow.setAttribute("opacity", pdOn.toFixed(2));
}

function drawInset(i, t, idle) {
  const id = D.steps[i].id;
  const cmp = !idle && id === "compare" ? ease(clamp(t * 4)) : 0;
  compare.setAttribute("opacity", cmp.toFixed(2));
  lane.setAttribute("opacity", (1 - cmp).toFixed(2));
  insetLabel.textContent = cmp > 0.5 ? "Detail · CPO vs pluggable" : "Detail · one lane";
  const hot = idle ? "" : { serdes: "eic", laser: "wg", ring: "ring", fibre: "wg", detect: "pd", back: "tia", compare: "" }[id];
  for (const [key, el] of Object.entries(inParts)) el.toggleAttribute("data-on", key === hot);
  // the photon in the lane: laser in to the ring, then ring to the photodiode
  let px = null;
  if (!idle && id === "laser") px = 10 + 60 * t;
  else if (!idle && id === "ring") px = 70;
  else if (!idle && id === "fibre") px = 70 + 86 * t;
  else if (!idle && id === "detect") px = 156;
  if (px === null) inPhoton.setAttribute("opacity", "0");
  else {
    inPhoton.setAttribute("cx", px.toFixed(1));
    inPhoton.setAttribute("opacity", "1");
  }
  // the PAM4 trace written by the ring: grows through the ring step and keeps scrolling out on the fibre step
  const grow = idle ? 0 : id === "ring" ? t * 0.5 : id === "fibre" ? 0.5 + t * 0.5 : i > 3 ? 1 : 0;
  const width = 200 * grow;
  let d = "M10 120";
  const symW = 200 / PAM.length;
  for (let k = 0; k < PAM.length; k++) {
    const x0 = 10 + k * symW;
    if (x0 >= 10 + width) break;
    const y = 120 - PAM[k] * 12;
    d += `L${x0.toFixed(1)} ${y}L${Math.min(x0 + symW, 10 + width).toFixed(1)} ${y}`;
  }
  inTrace.setAttribute("d", d);
}

function draw() {
  const { i, t } = stepAt(s);
  const step = D.steps[i];
  const idle = s <= 0.0005 && !playing && !touring;
  drawLight(i, t, idle);
  drawInset(i, t, idle);
  markRun(selected || idle ? "" : step.id);
  const done = s >= 0.999;
  let text;
  if (selected) text = D.parts[selected].say;
  else if (idle) text = D.idle;
  else if (done) text = D.done;
  else text = step.say;
  say(text);
  const label = `${String(i + 1).padStart(2, "0")} · ${step.name}`;
  if (stepText.textContent !== label) stepText.textContent = label;
  playText.textContent = playing ? "Pause" : done ? "Replay" : "Play";
  playButton.toggleAttribute("data-playing", playing);
  playButton.setAttribute("aria-label", playing ? "Pause the bit" : "Play one bit");
  const v = String(Math.round(s * 1000));
  if (scrubInput.value !== v) scrubInput.value = v;
  scrubInput.setAttribute("aria-valuetext", `${label}: ${step.say}`);
  if (i !== spokenStep) {
    spokenStep = i;
    if (!touring && root.contains(document.activeElement)) live.textContent = `${step.name}: ${step.say}`;
  }
}

function animating() {
  if (still.matches) return false;
  if (playing || touring) return true;
  if (s <= 0.0005 || s >= 0.999) return false;
  const { i } = stepAt(s);
  return i >= 1 && i <= 4; // laser stream and ring flicker keep moving while the slider rests there
}

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  clock += dt;
  if (touring && tourHold < 0) tourHold = Math.min(0, tourHold + dt);
  else if (touring) {
    if (s >= 1) {
      tourHold += dt;
      if (tourHold > 2.6) {
        s = 0;
        tourHold = 0;
      }
    } else s = Math.min(1, s + dt / SECONDS);
  } else if (playing) {
    s = Math.min(1, s + dt / SECONDS);
    if (s >= 1) playing = false;
  }
  draw();
  frame = visible && animating() ? requestAnimationFrame(tick) : 0;
}

function run() {
  if (!frame && visible) {
    last = 0;
    frame = requestAnimationFrame(tick);
  }
}

function takeOver() {
  touring = false;
}

function togglePlay() {
  takeOver();
  if (playing) {
    playing = false;
    draw();
    return;
  }
  if (s >= 0.999) s = 0;
  if (still.matches) {
    // reduced motion: jump to the middle of the next step
    const { i, t } = stepAt(s);
    if (t < 0.5) s = (EDGES[i] + EDGES[i + 1]) / 2;
    else s = i + 1 >= N ? 1 : (EDGES[i + 1] + EDGES[i + 2]) / 2;
    draw();
    return;
  }
  playing = true;
  run();
}

function reset() {
  takeOver();
  playing = false;
  s = 0;
  select(null);
  draw();
  run();
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
  // the bench and board are the background: hovering them clears the pick; the legend button and keys still pick them
  const piece = item ? item.dataset.piece : null;
  return piece === "board" || piece === "bench" ? null : piece;
}

let leaveTimer = 0;
stage.addEventListener("pointermove", (event) => {
  if (event.pointerType === "touch") return;
  clearTimeout(leaveTimer);
  takeOver();
  select(pieceAt(event));
  draw();
  run();
});
stage.addEventListener("pointerleave", () => {
  clearTimeout(leaveTimer);
  leaveTimer = setTimeout(() => {
    select(null);
    draw();
  }, 260);
});
stage.addEventListener("pointerdown", (event) => {
  if (event.pointerType !== "touch") {
    stage.focus({ preventScroll: true });
    return;
  }
  takeOver();
  const id = pieceAt(event);
  select(id && id !== selected ? id : null);
  draw();
  run();
});

partButtons.forEach((button) => {
  const showPart = () => {
    takeOver();
    clearTimeout(leaveTimer);
    select(button.dataset.part);
    draw();
    run();
  };
  const hidePart = () => {
    clearTimeout(leaveTimer);
    leaveTimer = setTimeout(() => {
      if (partButtons.some((other) => other.matches(":hover, :focus-visible"))) return;
      select(null);
      draw();
    }, 260);
  };
  button.addEventListener("pointerenter", showPart);
  button.addEventListener("focus", showPart);
  button.addEventListener("pointerleave", hidePart);
  button.addEventListener("blur", hidePart);
  button.addEventListener("click", showPart);
});

document.addEventListener("keydown", (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey || !visible) return;
  const target = event.target;
  if (target !== document.body && target !== stage && !root.contains(target)) return;
  if (target === scrubInput && event.key !== " " && event.key !== "Escape") return;
  if (target instanceof HTMLButtonElement && (event.key === " " || event.key === "Enter")) return;
  if (event.key === " ") {
    event.preventDefault();
    togglePlay();
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
  else if (/^[1-9]$/.test(event.key) && Number(event.key) <= D.order.length) next = Number(event.key) - 1;
  if (next === null) return;
  event.preventDefault();
  takeOver();
  select(D.order[next]);
  draw();
  run();
});

scrubInput.addEventListener("input", () => {
  takeOver();
  playing = false;
  s = Number(scrubInput.value) / 1000;
  draw();
  run();
});

playButton.addEventListener("click", togglePlay);

if (still.matches) touring = false;
const narrow = matchMedia("(hover: none), (max-width: 480px)");
const hint = root.querySelector(".sp-hint");
const wording = () => hint && (hint.textContent = narrow.matches ? "Tap a part · drag the slider" : "Hover a part · Space plays the bit");
wording();
narrow.addEventListener("change", wording);
draw();
