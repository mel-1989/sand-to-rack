const D = __DATA__;
const root = document.querySelector(".wf");
const stage = root.querySelector(".wf-stage");
const svgEl = stage.querySelector("svg");
const layers = stage.querySelector(".wf-layers");
const live = root.querySelector("[data-live]");
const readout = root.querySelector("[data-readout]");
const partButtons = [...root.querySelectorAll(".wf-part")];
const scrubInput = root.querySelector("[data-scrub]");
const playButton = root.querySelector("[data-play]");
const playText = root.querySelector("[data-play-text]");
const stepText = root.querySelector("[data-step]");
const still = matchMedia("(prefers-reduced-motion: reduce)");

const nodes = [...layers.querySelectorAll(".it")].map((el) => ({
  el,
  piece: el.dataset.piece,
  part: el.dataset.part,
  key: Number(el.dataset.k),
  m: el.dataset.m.split(",").map(Number),
  shown: "",
}));
for (const node of nodes) node.lift = node.m[0] * D.V[0] + node.m[1] * D.V[1] + node.m[2] * D.V[2];
const dyn = nodes.find((node) => node.el.hasAttribute("data-live-right"));
const sorted = nodes.filter((node) => node !== dyn);
let order = [];

const kerfEl = layers.querySelector("[data-kerf]");
const innerLeftEl = layers.querySelector("[data-inner-left]");

const N = D.steps.length;
const STEP_SECONDS = 3.2;
let s = 0;
let selected = null;
let hovering = null;
let playing = null;
let touring = !still.matches;
let tookOver = false;
let visible = false;
let frame = 0;
let last = 0;
let idleTimer = 0;
let leaveTimer = 0;
let tourHold = 0;
let spoken = "";

// ---- the process table: the same smoothstep interpolation build.mjs samples for the audit ----
function sharesAt(at) {
  const keys = D.keys;
  if (at <= keys[0][0]) return { ...keys[0][1] };
  for (let i = 1; i < keys.length; i++) {
    const [s1, b] = keys[i];
    if (at <= s1) {
      const [s0, a] = keys[i - 1];
      const t = s1 > s0 ? (at - s0) / (s1 - s0) : 1;
      const e = t * t * (3 - 2 * t);
      const out = {};
      for (const id of D.pieces) out[id] = a[id] + (b[id] - a[id]) * e;
      return out;
    }
  }
  return { ...keys[keys.length - 1][1] };
}
const stepIndex = (at) => Math.min(N - 1, Math.floor(at * N + 1e-9));
const within = (at) => at * N - stepIndex(at);
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const smooth = (t) => t * t * (3 - 2 * t);

// ---- live web and kerfs ----
const f2 = (v) => Math.round(v * 100) / 100;
const flat = (p) => iso(p, D.P);
const path = (points) => "M" + points.map((p) => { const q = flat(p); return `${f2(q[0])} ${f2(q[1])}`; }).join("L");
const W = D.web;
const VV = D.V;

function webAt(shares) {
  const off = shares.ingot * W.feed;
  const h = W.zw - off - W.zc0; // the wire plane, measured from the ingot axis
  const left = [];
  const right = [];
  const kerfs = [];
  // the nearest wire runs in the plane of the near end face, always in front of the ingot
  const face = W.ys[W.ys.length - 1];
  right.push(path([[-W.inner, face, W.zw], [W.inner, face, W.zw]]));
  if (h <= -W.r) {
    for (const y of W.ys.slice(0, -1)) left.push(path([[-W.inner, y, W.zw], [W.inner, y, W.zw]]));
  } else {
    const c = h < W.r ? Math.sqrt(W.r * W.r - h * h) : h < W.r + 1.95 ? W.glue : 0;
    for (const y of W.ys) {
      if (c < W.inner && y !== face) {
        left.push(path([[-W.inner, y, W.zw], [-c, y, W.zw]]));
        // below the axis the ingot's bulge hangs over the near run, so it is drawn behind the ingot
        (h < 0 ? left : right).push(path([[c, y, W.zw], [W.inner, y, W.zw]]));
      }
      // the kerf: the visible part of the ring where this wire has already passed, in the ingot's home frame
      if (y === face || y === W.ys[0]) continue;
      const lim = Math.min(1, h / W.r);
      const pts = [];
      const runs = [];
      const steps = 72;
      for (let j = 0; j <= steps; j++) {
        const t = Math.PI / 2 + (j / steps) * Math.PI * 2;
        const sn = Math.sin(t);
        const cs = Math.cos(t);
        const ok = sn <= lim + 1e-9 && cs * VV[0] + sn * VV[2] > 0.02;
        if (ok) pts.push([W.r * cs, y, W.zc0 + W.r * sn]);
        else if (pts.length) runs.push(pts.splice(0));
      }
      if (pts.length) runs.push(pts.splice(0));
      for (const run of runs) if (run.length > 1) kerfs.push(path(run));
    }
  }
  return { left: left.join(""), right: right.join(""), kerfs: kerfs.join("") };
}

let shownWeb = "";
function drawWeb(shares) {
  const web = webAt(shares);
  const sig = web.left.length + "|" + web.right.length + "|" + web.kerfs.length + "|" + shares.ingot.toFixed(4);
  if (sig === shownWeb) return;
  shownWeb = sig;
  innerLeftEl.innerHTML = web.left ? lineSvg(web.left, { tone: "mid", className: "wf-wire" }) : "";
  dyn.el.innerHTML = web.right ? lineSvg(web.right, { tone: "mid", className: "wf-wire" }) : "";
  kerfEl.innerHTML = web.kerfs ? lineSvg(web.kerfs, { tone: "mid" }) : "";
}

// ---- placing and depth-sorting the moving pieces ----
function place(shares) {
  for (const node of sorted) {
    const share = shares[node.piece] ?? 0;
    const tx = (D.EX[0] * node.m[0] + D.EY[0] * node.m[1] + D.EZ[0] * node.m[2]) * share;
    const ty = (D.EX[1] * node.m[0] + D.EY[1] * node.m[1] + D.EZ[1] * node.m[2]) * share;
    const text = share === 0 || (tx === 0 && ty === 0) ? "" : `translate(${tx.toFixed(2)} ${ty.toFixed(2)})`;
    if (text !== node.shown) {
      node.shown = text;
      if (text) node.el.setAttribute("transform", text);
      else node.el.removeAttribute("transform");
    }
  }
  const keyOf = (node) => node.key + node.lift * (shares[node.piece] ?? 0);
  const next = [...sorted].sort((a, b) => keyOf(a) - keyOf(b));
  // the near half of the inner web goes straight after the ingot while it cuts
  const at = next.findIndex((node) => node.piece === "ingot");
  next.splice(at + 1, 0, dyn);
  if (next.length !== order.length || next.some((node, i) => node !== order[i])) {
    const fragment = document.createDocumentFragment();
    for (const node of next) fragment.appendChild(node.el);
    layers.appendChild(fragment);
    order = next;
  }
}

// ---- what the process shows at each moment ----
function render() {
  const shares = sharesAt(s);
  place(shares);
  drawWeb(shares);
  const index = stepIndex(s);
  const t = within(s);
  const grind = index > 0 ? 1 : smooth(clamp01((t - 0.1) / 0.75));
  svgEl.style.setProperty("--wf-ridges", (1 - grind).toFixed(3));
  svgEl.style.setProperty("--wf-notch", grind.toFixed(3));
  svgEl.toggleAttribute("data-cutting", index === 2 && t > 0.04 && t < 0.97);
  svgEl.toggleAttribute("data-etching", index === 4 && t > 0.35 && t < 0.7);
  svgEl.toggleAttribute("data-mirror", index === 6 && t > 0.35);
  if (!hovering) highlight(s > 0.0005 || playing || touring ? D.steps[index].part : null);
  scrubInput.value = String(Math.round(s * 1000));
  const label = `${String(index + 1).padStart(2, "0")} · ${D.steps[index].name}`;
  if (stepText.textContent !== label) stepText.textContent = label;
  playText.textContent = playing ? "Pause" : s >= 0.999 ? "Replay" : "Play";
  playButton.toggleAttribute("data-playing", !!playing);
  playButton.setAttribute("aria-label", playing ? "Pause" : s >= 0.999 ? "Play the process again" : "Play the process");
  say();
}

function stepSay() {
  const index = stepIndex(s);
  const step = D.steps[index];
  if (index === 2) {
    const shares = sharesAt(s);
    const depth = clamp01((W.zw - shares.ingot * W.feed - (W.zc0 - W.r)) / (2 * W.r));
    if (depth > 0 && depth < 1) return `${Math.round(depth * 100)}% through · ${step.say}`;
  }
  if (s <= 0.0005 && !playing && !touring) return D.idle;
  return step.say;
}

function say() {
  const text = selected && hovering ? `${D.parts[selected].name}: ${D.parts[selected].say}` : stepSay();
  if (readout.textContent !== text) readout.textContent = text;
  if (stage.getAttribute("aria-valuetext") !== text) stage.setAttribute("aria-valuetext", text);
  if (document.activeElement === stage && text !== spoken) {
    spoken = text;
    live.textContent = text;
  }
}

function highlight(part) {
  if (selected === part) return;
  selected = part;
  for (const node of nodes) {
    if (part && node.part === part) node.el.setAttribute("data-on", "");
    else node.el.removeAttribute("data-on");
  }
  if (part) stage.setAttribute("data-focus", "");
  else stage.removeAttribute("data-focus");
  partButtons.forEach((button) => (button.dataset.part === part ? button.setAttribute("data-on", "") : button.removeAttribute("data-on")));
  stage.setAttribute("aria-valuenow", String(part ? D.order.indexOf(part) + 1 : 0));
}

function pick(part) {
  hovering = part;
  if (part) highlight(part);
  render();
}

// ---- loop ----
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  let moving = false;
  if (playing) {
    s = Math.min(1, s + dt / (STEP_SECONDS * N));
    if (s >= 1) playing = null;
    moving = true;
  } else if (touring) {
    if (s >= 1) {
      tourHold += dt;
      if (tourHold > 2.4) {
        s = 0;
        tourHold = 0;
      }
    } else s = Math.min(1, s + dt / (STEP_SECONDS * N));
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
  if (touring) {
    touring = false;
    if (!playing && s > 0) highlight(D.steps[stepIndex(s)].part);
  }
  tookOver = true;
  clearTimeout(idleTimer);
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
  return item && item.dataset.part ? item.dataset.part : null;
}

stage.addEventListener("pointermove", (event) => {
  if (event.pointerType === "touch") return;
  clearTimeout(leaveTimer);
  quietTour();
  pick(partAt(event));
});

stage.addEventListener("pointerleave", () => {
  clearTimeout(leaveTimer);
  leaveTimer = setTimeout(() => {
    hovering = null;
    highlight(null);
    render();
  }, 260);
});

stage.addEventListener("pointerdown", (event) => {
  if (event.pointerType !== "touch") {
    stage.focus({ preventScroll: true });
    return;
  }
  quietTour();
  const part = partAt(event);
  pick(part && part !== selected ? part : null);
});

partButtons.forEach((button) => {
  const show = () => {
    quietTour();
    clearTimeout(leaveTimer);
    pick(button.dataset.part);
  };
  const hide = () => {
    clearTimeout(leaveTimer);
    leaveTimer = setTimeout(() => {
      if (partButtons.some((other) => other.matches(":hover, :focus-visible"))) return;
      hovering = null;
      highlight(null);
      render();
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
  say();
});

function togglePlay() {
  quietTour();
  hovering = null;
  if (playing) {
    playing = null;
    render();
    return;
  }
  if (s >= 0.999) s = 0;
  if (still.matches) {
    // reduced motion: jump to the end of the current step
    const next = Math.min(N, Math.floor((s + 0.001) * N) + 1);
    s = next >= N ? 1 : next / N - 0.0005;
    render();
    return;
  }
  playing = { from: s };
  run();
}

function reset() {
  quietTour();
  playing = null;
  hovering = null;
  s = 0;
  highlight(null);
  render();
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
  quietTour();
  pick(D.order[next]);
});

scrubInput.addEventListener("input", () => {
  quietTour();
  playing = null;
  hovering = null;
  s = Number(scrubInput.value) / 1000;
  render();
});

playButton.addEventListener("click", togglePlay);

const narrow = matchMedia("(hover: none), (max-width: 480px)");
const hint = root.querySelector(".wf-hint");
const wording = () => hint && (hint.textContent = narrow.matches ? "Tap a part · Play runs the process" : "Hover a part · Space plays the process");
wording();
narrow.addEventListener("change", wording);
if (still.matches) touring = false;
render();
