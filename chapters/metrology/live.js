const D = __DATA__;
const root = document.querySelector(".mt");
const stage = root.querySelector(".mt-stage");
const layers = stage.querySelector(".mt-layers");
const live = root.querySelector("[data-live]");
const readout = root.querySelector("[data-readout]");
const partButtons = [...root.querySelectorAll(".mt-part")];
const scrubInput = root.querySelector("[data-scrub]");
const playButton = root.querySelector("[data-play]");
const playText = root.querySelector("[data-play-text]");
const stepText = root.querySelector("[data-step]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const STEPS = D.steps;
const END = STEPS.length;

// ---- items, their move vectors and depth keys ----
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

// ---- the monitor ----
const screen = stage.querySelector(".mt-screen");
const modes = [...screen.querySelectorAll("[data-mode]")];
const q = (name) => screen.querySelector(`[data-part="${name}"]`);
const rowsClip = q("rows");
const scanline = q("scanline");
const cross = q("cross");
const edgeMarks = q("edges");
const sweep = q("sweep");
const pedges = q("pedges");
const newpoint = q("newpoint");
const rowcount = q("rowcount");
const crossY = cross.getAttribute("transform").match(/translate\(([-\d.]+) ([-\d.]+)\)/);
const crossV = Number(crossY[2]);
const crossU0 = Number(crossY[1]);
const beamLine = stage.querySelector(".mt-wafer-beam .iso-line");
const spotDot = stage.querySelector(".mt-wafer-beam circle");

let T = 0;
let shown = null;
let selected = null;
let inside = false;
let leaveTimer = 0;
let touring = !still.matches;
let tookOver = false;
let tourRest = 0;
let playing = false;
let visible = false;
let frame = 0;
let last = 0;
let clock = 0;
let spoken = "";

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (t) => t * t * (3 - 2 * t);
const stepIndex = (t) => Math.min(END - 1, Math.floor(t));
const pad = (n) => String(n).padStart(2, "0");

function say(text) {
  if (readout.textContent !== text) readout.textContent = text;
}

function describe() {
  const text = selected ? `${D.parts[selected].name}: ${D.parts[selected].say}` : T <= 0 ? D.idle : `${pad(stepIndex(T) + 1)} ${STEPS[stepIndex(T)].name}`;
  if (stage.getAttribute("aria-valuetext") !== text) stage.setAttribute("aria-valuetext", text);
  if (document.activeElement === stage && text !== spoken) {
    spoken = text;
    live.textContent = text;
  }
}

function setMode(names) {
  for (const el of modes) {
    const on = names.includes(el.dataset.mode);
    const value = on ? "" : "none";
    if (el.style.display !== value) el.style.display = value;
  }
}

function place(shares) {
  for (const node of nodes) {
    const share = shares[node.piece] ?? 0;
    const tx = (D.EX[0] * node.m[0] + D.EY[0] * node.m[1] + D.EZ[0] * node.m[2]) * share;
    const ty = (D.EX[1] * node.m[0] + D.EY[1] * node.m[1] + D.EZ[1] * node.m[2]) * share;
    const text = Math.abs(share) < 1e-6 ? "" : `translate(${tx.toFixed(2)} ${ty.toFixed(2)})`;
    if (text !== node.shown) {
      node.shown = text;
      if (text) node.el.setAttribute("transform", text);
      else node.el.removeAttribute("transform");
    }
  }
  const keyOf = (index) => nodes[index].key + nodes[index].lift * (shares[nodes[index].piece] ?? 0);
  const next = nodes.map((_, index) => index).sort((a, b) => keyOf(a) - keyOf(b));
  if (next.some((index, at) => index !== order[at])) {
    const fragment = document.createDocumentFragment();
    for (const index of next) fragment.appendChild(nodes[index].el);
    layers.appendChild(fragment);
    order = next;
  }
}

// ---- one frame of the process at T ----
function render() {
  const shares = sharesAt(Math.min(T, 2), D.K);
  place(shares);
  const i = stepIndex(T);
  const p = clamp(T - i);
  const id = T <= 0 ? "rest" : STEPS[i].id;
  let text = D.idle;
  // beam on while scanning and imaging
  const beamOn = T > 2 && T < 4;
  stage.toggleAttribute("data-beam", beamOn);
  if (beamOn) {
    const row = id === "image" ? p : (p * 6) % 1;
    const calm = still.matches;
    const du = calm ? 0 : Math.sin(clock * 40) * 0.8;
    const dv = calm ? 0 : (row - 0.5) * 1.6;
    const sx = D.spot.at[0] + D.spot.u[0] * du + D.spot.v[0] * dv;
    const sy = D.spot.at[1] + D.spot.u[1] * du + D.spot.v[1] * dv;
    beamLine.setAttribute("d", `M${D.spot.tip[0].toFixed(2)} ${D.spot.tip[1].toFixed(2)}L${sx.toFixed(2)} ${sy.toFixed(2)}`);
    spotDot.setAttribute("cx", sx.toFixed(2));
    spotDot.setAttribute("cy", sy.toFixed(2));
  }
  // the monitor
  if (id === "rest" || id === "load") {
    setMode(["map", "t-load"]);
    cross.setAttribute("transform", `translate(${crossU0} ${crossV})`);
    text = id === "rest" ? D.idle : STEPS[0].say;
  } else if (id === "navigate") {
    if (shares.hold > 0.5) {
      setMode(["overlay", "t-align", "t-ovl"]);
      text = STEPS[1].say;
    } else {
      setMode(["map", "t-align"]);
      const toSite = clamp((p - 0.65) / 0.35);
      const u = crossU0 + (D.map.to - D.map.from) * ease(toSite);
      cross.setAttribute("transform", `translate(${u.toFixed(2)} ${crossV})`);
      text = p < 0.4 ? "stage to the overlay mark" : "stage to the measurement site";
    }
  } else if (id === "scan") {
    setMode(["sem", "t-scan"]);
    rowsClip.setAttribute("height", "0");
    scanline.setAttribute("y", (D.img.v + ((p * 6) % 1) * (D.img.h - 0.5)).toFixed(2));
    scanline.style.opacity = "1";
    edgeMarks.style.opacity = "0";
    text = STEPS[2].say;
  } else if (id === "image") {
    setMode(["sem", "t-image", "t-rows"]);
    const h = D.img.h * p;
    rowsClip.setAttribute("height", h.toFixed(2));
    scanline.setAttribute("y", (D.img.v + Math.min(h, D.img.h - 0.5)).toFixed(2));
    scanline.style.opacity = "1";
    edgeMarks.style.opacity = "0";
    const line = Math.round(p * D.rows);
    rowcount.textContent = `${line}/${D.rows}`;
    text = `${STEPS[3].say} · line ${line} of ${D.rows}`;
  } else {
    rowsClip.setAttribute("height", String(D.img.h));
    scanline.style.opacity = "0";
    if (id === "edges") {
      setMode(["sem", "profile"]);
      sweep.setAttribute("width", (D.img.plot.w * clamp(p / 0.6)).toFixed(2));
      const on = clamp((p - 0.6) / 0.2);
      pedges.style.opacity = on.toFixed(2);
      edgeMarks.style.opacity = on.toFixed(2);
      text = STEPS[4].say;
    } else if (id === "spec") {
      setMode(["sem", "result"]);
      edgeMarks.style.opacity = "1";
      text = STEPS[5].say;
    } else {
      setMode(["sem", "spc"]);
      edgeMarks.style.opacity = "1";
      newpoint.style.opacity = clamp((p - 0.25) / 0.2).toFixed(2);
      text = STEPS[6].say;
    }
  }
  if (id !== "spc") newpoint.style.opacity = "0";
  shown = text;
}

function showPlay() {
  playText.textContent = playing ? "Pause" : T >= END ? "Replay" : "Play";
  playButton.toggleAttribute("data-playing", playing);
  playButton.setAttribute("aria-label", playing ? "Pause" : "Play the measurement");
  const i = stepIndex(T);
  const label = `${pad(i + 1)} · ${STEPS[i].name}`;
  if (stepText.textContent !== label) stepText.textContent = label;
  const value = String(Math.round((T / END) * 1000));
  if (scrubInput.value !== value && document.activeElement !== scrubInput) scrubInput.value = value;
}

function readoutText() {
  if (selected) return D.parts[selected].say;
  return shown ?? D.idle;
}

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  clock += dt;
  if (touring && !playing) {
    tourRest -= dt;
    if (tourRest <= 0) {
      if (T >= END) T = 0;
      playing = true;
    }
  }
  if (playing) {
    const i = stepIndex(T);
    T = Math.min(END, T + dt / STEPS[i].seconds);
    if (T >= END) {
      playing = false;
      tourRest = 3.2;
    }
  }
  render();
  showPlay();
  say(readoutText());
  describe();
  const moving = playing || touring || (stage.hasAttribute("data-beam") && !still.matches);
  frame = visible && moving ? requestAnimationFrame(tick) : 0;
}

function run() {
  if (!frame && visible) {
    last = 0;
    frame = requestAnimationFrame(tick);
  }
}

function paint() {
  render();
  showPlay();
  say(readoutText());
  describe();
}

new IntersectionObserver(
  (entries) => {
    visible = entries[entries.length - 1].isIntersecting;
    if (visible) run();
  },
  { rootMargin: "120px 0px" },
).observe(stage);

function takeOver() {
  if (touring) {
    touring = false;
    playing = false;
  }
  tookOver = true;
}

function select(id) {
  if (id === "stand" || id === undefined) id = null;
  if (selected === id) return;
  selected = id;
  for (const node of nodes) {
    if (id !== null && node.part === id) node.el.setAttribute("data-on", "");
    else node.el.removeAttribute("data-on");
  }
  if (id) stage.setAttribute("data-focus", "");
  else stage.removeAttribute("data-focus");
  partButtons.forEach((button) => (button.dataset.part === id ? button.setAttribute("data-on", "") : button.removeAttribute("data-on")));
  stage.setAttribute("aria-valuenow", String(id ? D.order.indexOf(id) + 1 : 0));
  say(readoutText());
  describe();
}

function partAt(event) {
  const hit = document.elementFromPoint(event.clientX, event.clientY);
  const item = hit && hit.closest ? hit.closest(".it") : null;
  return item ? item.dataset.part : null;
}

stage.addEventListener("pointermove", (event) => {
  if (event.pointerType === "touch") return;
  inside = true;
  clearTimeout(leaveTimer);
  takeOver();
  select(partAt(event));
  run();
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
  takeOver();
  const id = partAt(event);
  select(id && id !== selected ? id : null);
  run();
});

partButtons.forEach((button) => {
  const show = () => {
    takeOver();
    clearTimeout(leaveTimer);
    select(button.dataset.part);
    run();
  };
  const hide = () => {
    clearTimeout(leaveTimer);
    leaveTimer = setTimeout(() => {
      if (inside || partButtons.some((other) => other.matches(":hover, :focus-visible"))) return;
      select(null);
    }, 260);
  };
  button.addEventListener("pointerenter", (event) => {
    if (event.pointerType !== "touch") show();
  });
  button.addEventListener("focus", show);
  button.addEventListener("pointerleave", hide);
  button.addEventListener("blur", hide);
  button.addEventListener("click", show);
});

stage.addEventListener("focus", () => {
  spoken = "";
  describe();
});

function togglePlay() {
  takeOver();
  select(null);
  if (playing) {
    playing = false;
    paint();
    return;
  }
  if (T >= END) T = 0;
  if (still.matches) {
    // reduced motion: jump one whole step at a time
    T = Math.min(END, Math.floor(T) + 1);
    paint();
    return;
  }
  playing = true;
  run();
}

function reset() {
  takeOver();
  playing = false;
  select(null);
  T = 0;
  paint();
}

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
  if (next === null) return;
  event.preventDefault();
  takeOver();
  select(D.order[next]);
});

scrubInput.addEventListener("input", () => {
  takeOver();
  playing = false;
  select(null);
  T = (Number(scrubInput.value) / 1000) * END;
  paint();
  run();
});

playButton.addEventListener("click", togglePlay);

const narrow = matchMedia("(hover: none), (max-width: 480px)");
const hint = root.querySelector(".mt-hint");
const wording = () => hint && (hint.textContent = narrow.matches ? "Tap a part · Play runs the measurement" : "Hover a part · Space plays the measurement");
wording();
narrow.addEventListener("change", wording);
tourRest = 1.4;
paint();
