const D = __DATA__;
const root = document.querySelector(".ii");
const stage = root.querySelector(".ii-stage");
const live = root.querySelector("[data-live]");
const readout = root.querySelector("[data-readout]");
const partButtons = [...root.querySelectorAll(".ii-part")];
const spButtons = [...root.querySelectorAll(".ii-sp")];
const scrubInput = root.querySelector("[data-scrub]");
const playButton = root.querySelector("[data-play]");
const playText = root.querySelector("[data-play-text]");
const stepText = root.querySelector("[data-step]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const items = [...stage.querySelectorAll(".it")];
const N = D.steps.length;

const pt = (x, y, z) => [D.O[0] + x * D.EX[0] + y * D.EY[0] + z * D.EZ[0], D.O[1] + x * D.EX[1] + y * D.EY[1] + z * D.EZ[1]];
const f1 = (v) => v.toFixed(1);
const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const ease = (t) => t * t * (3 - 2 * t);
const sup = (n) => String(n).replace(/\d/g, (d) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[d]);

// ---- refs ----
const beamItems = items.filter((el) => el.hasAttribute("data-beam")).map((el) => ({ el, s0: Number(el.dataset.s0), s1: Number(el.dataset.s1), paths: [...el.querySelectorAll("path")], dots: [...el.querySelectorAll("circle")] }));
for (const b of beamItems) for (const p of b.paths) (p.setAttribute("pathLength", "1"), p.setAttribute("stroke-dasharray", "1 1"));
const rejectItems = items.filter((el) => el.hasAttribute("data-reject"));
for (const el of rejectItems) for (const p of el.querySelectorAll("path")) (p.setAttribute("pathLength", "1"), p.setAttribute("stroke-dasharray", "1 1"));
const movers = items.filter((el) => el.dataset.move === "platen");
const ringsHot = items.filter((el) => el.hasAttribute("data-ring")).sort((a, b) => a.dataset.ring - b.dataset.ring);
const fanItem = items.find((el) => el.hasAttribute("data-fanitem"));
const fan = fanItem.querySelector("[data-fan]");
const fanGlow = fanItem.querySelector("[data-fan-glow]");
const spot = fanItem.querySelector("[data-spot]");
const exitDot = fanItem.querySelector("[data-exit]");
const dose = stage.querySelector(".ii-dose");
const heat = stage.querySelector(".ii-heat");
const lamps = stage.querySelector(".ii-lamps");
const cupGlow = stage.querySelector(".ii-cupglow");
const lampItem = items.find((el) => el.hasAttribute("data-lamps"));
const hotWafer = items.find((el) => el.hasAttribute("data-hot-wafer"));
const plasma = items.find((el) => el.hasAttribute("data-plasma"));
const cupItem = items.find((el) => el.hasAttribute("data-cup"));
const depths = [...stage.querySelectorAll(".ii-depth")];
const speciesItems = items.filter((el) => el.dataset.species);

// ---- state ----
let s = 0;
let species = "B";
let selected = null;
let playing = false;
let touring = !still.matches;
let tookOver = false;
let tourHold = 0;
let visible = false;
let frame = 0;
let last = 0;
let clock = 0;
let spoken = "";
const PLAY_SECONDS = 21;

function stepAt(value) {
  if (value <= 0) return { index: -1, t: 0 };
  if (value >= 1) return { index: N, t: 1 };
  const x = value * N;
  const index = Math.min(N - 1, Math.floor(x));
  return { index, t: x - index };
}

function setHot(el, on) {
  if (!el) return;
  if (on) el.setAttribute("data-hot", "");
  else el.removeAttribute("data-hot");
}

function setGlow(el, on) {
  if (el) el.toggleAttribute("data-glow", on);
}

function reveal(paths, frac) {
  for (const p of paths) p.setAttribute("stroke-dashoffset", String(1 - clamp(frac)));
}

let shownMove = "";
function place(dz) {
  const text = Math.abs(dz) < 1e-3 ? "" : `translate(${f1(D.EZ[0] * dz)} ${f1(D.EZ[1] * dz)})`;
  if (text === shownMove) return;
  shownMove = text;
  for (const el of movers) (text ? el.setAttribute("transform", text) : el.removeAttribute("transform"));
}

function targetY(u, dz) {
  const sc = D.scan;
  const x = D.BX + u;
  const tan = Math.tan(sc.tilt);
  const hw = Math.abs(dz) < sc.waferR ? Math.sqrt(sc.waferR ** 2 - dz ** 2) : -1;
  const hp = Math.abs(dz) < sc.platenR ? Math.sqrt(sc.platenR ** 2 - dz ** 2) : -1;
  if (Math.abs(u) <= hw) return { y: sc.platenY - u * tan + sc.waferS / Math.cos(sc.tilt), on: "wafer" };
  if (Math.abs(u) <= hp) return { y: sc.platenY - u * tan, on: "platen" };
  if (Math.abs(x - sc.cupX) <= sc.cupMouth) return { y: sc.cupY, on: "cup" };
  if (Math.abs(u) <= sc.railHalf) return { y: sc.railY, on: "rail" };
  return { y: sc.wallY, on: "wall" };
}

const fmtDose = (v) => {
  const e = Math.floor(Math.log10(Math.max(v, 1)));
  return `${(v / 10 ** e).toFixed(1)}×10${sup(e)}`;
};

let stepWords = "";
function render() {
  const { index, t } = stepAt(s);
  const sp = D.species[species];
  const beamOn = index >= 1 && index <= 4;
  // gas, plasma
  for (const el of speciesItems) setHot(el, index >= 0 && index <= 4 && el.dataset.species === species);
  setHot(plasma, index >= 0 && index <= 4);
  // kept beam
  let front = 0;
  if (index === 1) front = ease(t) * D.beam.entry;
  else if (index === 2) front = D.beam.entry + ease(t) * (D.beam.exit - D.beam.entry);
  else if (index === 3) front = D.beam.exit + ease(t) * (D.beam.length - D.beam.exit);
  else if (index === 4) front = D.beam.length;
  for (const b of beamItems) {
    const show = (beamOn || (index === 0 && b.s0 === 0)) && front >= b.s0 - 1e-6;
    b.el.toggleAttribute("hidden", !show);
    if (show) reveal(b.paths, b.s1 > b.s0 ? (front - b.s0) / (b.s1 - b.s0) : 1);
    b.dots.forEach((dot, i) => (dot.style.opacity = index >= 0 && index <= 4 ? String(index === 0 ? (i === 0 && b.s0 === 0 ? ease(t) : 0) : front >= (i === 0 ? b.s0 : b.s1) - 1e-6 ? 1 : 0) : "0"));
  }
  if (index === 0) for (const b of beamItems) if (b.s0 === 0) (b.el.toggleAttribute("hidden", false), reveal(b.paths, 0));
  // rejected ions
  const rej = index === 2 ? ease(t) : index > 2 && index <= 4 ? 1 : 0;
  for (const el of rejectItems) {
    const show = rej > 0 && el.dataset.reject === species;
    el.toggleAttribute("hidden", !show);
    if (show) reveal(el.querySelectorAll("path"), rej * 2 - (el.dataset.half === "1" ? 1 : 0));
  }
  // column rings light in turn
  ringsHot.forEach((el, i) => setHot(el, index === 3 ? t * ringsHot.length > i : false));
  // scan
  let dz = 0;
  let doseFrac = index > 4 ? 1 : 0;
  let on = "";
  if (index === 4) {
    const tr = D.scan.travel;
    if (t < 0.12) dz = tr * ease(t / 0.12);
    else if (t < 0.88) dz = tr * (1 - 2 * ease((t - 0.12) / 0.76));
    else dz = -tr * (1 - ease((t - 0.88) / 0.12));
    const sweeps = 9;
    const ph = (t * sweeps) % 1;
    const tri = ph < 0.5 ? ph * 2 : 2 - ph * 2;
    const u = D.scan.uMin + (D.scan.uMax - D.scan.uMin) * (0.5 - 0.5 * Math.cos(Math.PI * tri));
    const hit = targetY(u, dz);
    on = hit.on;
    const a = pt(D.BX + u, D.scan.y0, D.ZB);
    const b = pt(D.BX + u, hit.y, D.ZB);
    const d = `M${f1(a[0])} ${f1(a[1])}L${f1(b[0])} ${f1(b[1])}`;
    fan.setAttribute("d", d);
    fanGlow.setAttribute("d", d);
    spot.setAttribute("cx", f1(b[0]));
    spot.setAttribute("cy", f1(b[1]));
    exitDot.setAttribute("cx", f1(a[0]));
    exitDot.setAttribute("cy", f1(a[1]));
    fanItem.removeAttribute("hidden");
    doseFrac = clamp((t - 0.1) / 0.8);
  } else {
    fan.setAttribute("d", "");
    fanGlow.setAttribute("d", "");
    fanItem.setAttribute("hidden", "");
  }
  place(dz);
  dose.style.opacity = String(0.5 * doseFrac);
  cupGlow.style.opacity = on === "cup" ? "0.9" : "0";
  setGlow(cupItem, on === "cup");
  // depth coupon
  for (const g of depths) g.toggleAttribute("data-show", index >= 5 && g.dataset.species === species);
  // anneal: a spike up and back down
  let temp = 0;
  if (index === 6) temp = t < 0.55 ? ease(t / 0.55) : 1 - ease((t - 0.55) / 0.45) * 0.75;
  else if (index > 6) temp = 0.25;
  const glow = index === 6 ? temp : 0;
  heat.style.opacity = String(0.85 * glow);
  lamps.style.opacity = String(glow);
  setGlow(lampItem, index === 6 && t < 0.6);
  setGlow(hotWafer, index === 6 && glow > 0.4);
  // words
  const T = Math.round(25 + (D.anneal.spikeC - 25) * temp);
  const words = [
    `ionising ${sp.gas} · ${sp.name.toLowerCase()} plasma`,
    `extracting at ${D.recipe.extractKeV} keV · all fragments`,
    `magnet keeps ${sp.ion} · Bρ ${sp.rho.toFixed(3)} T·m · drops ${sp.rejects.join(" ")}`,
    `accelerating · ${Math.round(D.recipe.extractKeV + (D.recipe.finalKeV - D.recipe.extractKeV) * ease(t))} keV`,
    `${on === "cup" ? "Faraday cup" : `tilt ${D.tiltDeg}°`} · ${fmtDose(D.recipe.dose * doseFrac)} of ${D.doseText} cm⁻²`,
    `${sp.ion} at ${D.recipe.finalKeV} keV stops ≈${sp.rp} nm deep`,
    `spike anneal · ${T.toLocaleString("en-US")} °C`,
  ];
  stepWords = index < 0 ? D.idle : index >= N ? `annealed · ${sp.name.toLowerCase()} active, lattice repaired` : words[index];
  return { index, t };
}

function say(text) {
  if (readout.textContent !== text) readout.textContent = text;
}

function describe() {
  const text = selected ? `${D.pieces[selected].name}: ${D.pieces[selected].say}` : stepLabel();
  if (stage.getAttribute("aria-valuetext") !== text) stage.setAttribute("aria-valuetext", text);
  if (document.activeElement === stage && text !== spoken) {
    spoken = text;
    live.textContent = text;
  }
}

function stepLabel() {
  const { index } = stepAt(s);
  if (index < 0) return "idle";
  if (index >= N) return "done · annealed";
  return `${index + 1}/${N} · ${D.steps[index].name}`;
}

function select(id) {
  if (id === "stand" || id === "beam") id = null;
  if (selected === id) return;
  selected = id;
  for (const el of items) el.toggleAttribute("data-on", id !== null && el.dataset.piece === id);
  stage.toggleAttribute("data-focus", !!id);
  partButtons.forEach((button) => button.toggleAttribute("data-on", button.dataset.part === id));
  stage.setAttribute("aria-valuenow", String(id ? D.order.indexOf(id) + 1 : 0));
  describe();
}

function setSpecies(id) {
  species = id;
  spButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.sp === id)));
  draw();
}

function showControls() {
  playText.textContent = playing ? "Pause" : s >= 1 ? "Replay" : "Play";
  playButton.toggleAttribute("data-playing", playing);
  playButton.setAttribute("aria-label", playing ? "Pause" : s >= 1 ? "Replay the implant" : "Play the implant");
  const label = stepLabel();
  if (stepText.textContent !== label) stepText.textContent = label;
  const v = String(Math.round(s * 1000));
  if (scrubInput.value !== v) scrubInput.value = v;
}

function draw() {
  render();
  say(selected ? D.pieces[selected].say : stepWords);
  showControls();
  describe();
}

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  clock += dt;
  if (touring) {
    if (s >= 1) {
      tourHold += dt;
      if (tourHold > 2.4) {
        tourHold = 0;
        s = 0;
      }
    } else s = Math.min(1, s + dt / PLAY_SECONDS);
  } else if (playing) {
    s = Math.min(1, s + dt / PLAY_SECONDS);
    if (s >= 1) playing = false;
  }
  draw();
  frame = visible && (playing || touring) ? requestAnimationFrame(tick) : 0;
}

function run() {
  if (!frame && visible) {
    last = 0;
    frame = requestAnimationFrame(tick);
  }
}

function takeOver() {
  touring = false;
  tookOver = true;
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
  if (touring) takeOver();
  select(pieceAt(event));
  draw();
});

stage.addEventListener("pointerleave", () => {
  select(null);
  draw();
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
});

partButtons.forEach((button) => {
  const show = () => {
    takeOver();
    select(button.dataset.part);
    draw();
  };
  button.addEventListener("pointerenter", show);
  button.addEventListener("focus", show);
  button.addEventListener("click", show);
  button.addEventListener("pointerleave", () => {
    if (document.activeElement !== button) (select(null), draw());
  });
  button.addEventListener("blur", () => (select(null), draw()));
});

spButtons.forEach((button) =>
  button.addEventListener("click", () => {
    takeOver();
    setSpecies(button.dataset.sp);
  }),
);

stage.addEventListener("focus", () => {
  spoken = "";
  describe();
});

function togglePlay() {
  takeOver();
  select(null);
  if (playing) {
    playing = false;
    draw();
    return;
  }
  if (s >= 1) s = 0;
  if (still.matches) {
    const { index } = stepAt(s);
    s = Math.min(1, (index + 1.5) / N);
    if (s > (N - 0.5) / N) s = 1;
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
}

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
  } else if (event.key === " ") {
    event.preventDefault();
    togglePlay();
    return;
  }
  if (next === null) return;
  event.preventDefault();
  takeOver();
  select(D.order[next]);
  draw();
});

scrubInput.addEventListener("input", () => {
  takeOver();
  playing = false;
  select(null);
  s = Number(scrubInput.value) / 1000;
  draw();
});

playButton.addEventListener("click", togglePlay);

if (still.matches) touring = false;
const narrow = matchMedia("(hover: none), (max-width: 480px)");
const hint = root.querySelector(".ii-hint");
const wording = () => hint && (hint.textContent = narrow.matches ? "Tap a part · Play runs it" : "Hover a part · Space plays");
wording();
narrow.addEventListener("change", wording);
draw();
