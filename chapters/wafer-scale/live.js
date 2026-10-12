const D = __DATA__;
const root = document.querySelector(".ws");
const stage = root.querySelector(".ws-stage");
const layers = stage.querySelector(".ws-layers");
const live = root.querySelector("[data-live]");
const readout = root.querySelector("[data-readout]");
const partButtons = [...root.querySelectorAll(".ws-part")];
const scrubInput = root.querySelector("[data-scrub]");
const playButton = root.querySelector("[data-play]");
const playText = root.querySelector("[data-play-text]");
const stepText = root.querySelector("[data-step]");
const still = matchMedia("(prefers-reduced-motion: reduce)");

const nodes = [...layers.querySelectorAll(".it")].map((el) => ({
  el,
  piece: el.dataset.piece,
  key: Number(el.dataset.k),
  m: el.dataset.m.split(",").map(Number),
  shown: "",
}));
for (const node of nodes) node.lift = node.m[0] * D.V[0] + node.m[1] * D.V[1] + node.m[2] * D.V[2];
let order = nodes.map((_, index) => index);

// ---- the camera: the drawing is fitted to the exploded pose at build time; as the stack closes it gets
// shorter, so the group is scaled up and re-centred on the card to keep the engine filling it.
for (const node of nodes) {
  try {
    const box = node.el.getBBox();
    node.box = box.width || box.height ? [box.x, box.y, box.x + box.width, box.y + box.height] : null;
  } catch {
    node.box = null;
  }
}
const slim = matchMedia("(max-width: 520px)");
let cameraShown = "";
function boxOf(shift, only) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const node of nodes) {
    if (!node.box || (only && !only.includes(node.piece))) continue;
    const [tx, ty] = shift(node);
    x0 = Math.min(x0, node.box[0] + tx);
    y0 = Math.min(y0, node.box[1] + ty);
    x1 = Math.max(x1, node.box[2] + tx);
    y1 = Math.max(y1, node.box[3] + ty);
  }
  return x1 > x0 && y1 > y0 ? [x0, y0, x1, y1] : null;
}
function fit([x0, y0, x1, y1], padX, padY, cap) {
  const z = Math.min(cap, (D.W - 2 * padX) / (x1 - x0), (D.H - 2 * padY) / (y1 - y0));
  return [z, D.W / 2 - ((x0 + x1) / 2) * z, D.H / 2 - ((y0 + y1) / 2) * z];
}
// near: 0..1, how far a slim screen has moved in on the wafer (the closed engine is wide and flat, so on a
// phone it would fill under half the plate's height and the mesh traffic would be tiny; the fixture's sides crop)
function camera(shift, near = 0) {
  const all = boxOf(shift);
  if (!all) return "";
  // at narrow widths the svg is drawn wider than the card, so keep more room at the sides
  const padX = slim.matches ? D.W * 0.115 : D.W * 0.05;
  const padY = D.H * 0.05;
  let [z, tx, ty] = fit(all, padX, padY, D.ZOOM);
  if (!slim.matches) z = Math.max(1, z), tx = D.W / 2 - ((all[0] + all[2]) / 2) * z, ty = D.H / 2 - ((all[1] + all[3]) / 2) * z;
  const wafer = near > 0 && slim.matches ? boxOf(shift, ["wafer"]) : null;
  if (wafer) {
    const [wz, wx0, wy] = fit(wafer, D.W * 0.13, padY, 3);
    // bias the crop right so the cold plate's far-left coolant block (where the supply and return plug in) stays in frame
    const wx = wx0 + D.W * 0.07;
    z += (wz - z) * near;
    tx += (wx - tx) * near;
    ty += (wy - ty) * near;
  }
  return `translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${z.toFixed(4)})`;
}

// ---- the process: one value s from 0 (apart) to 1 (engine running) ----
// 0 .. A_END: power modules, board, connector, wafer and cold plate go on in turn;
// A_END .. ON: power and water on; ON .. 1: wavelets cross the mesh, seen through the cold plate's cutaway.
const A_END = 0.52;
const ON = 0.6;
const JOIN = ["power", "pcb", "connector", "wafer", "cold"];
const WINDOW = 1;
const ease = (t) => t * t * (3 - 2 * t);
const clamp = (v) => Math.min(1, Math.max(0, v));
const joinShare = (s, index) => ease(clamp(((s / A_END) * (JOIN.length - 1 + WINDOW) - index) / WINDOW));
const fabricOf = (s) => clamp((s - ON) / (1 - ON));

function apartOf(id, s) {
  if (id === "stand") return 0;
  return 1 - joinShare(s, JOIN.indexOf(id));
}

// The slider's named steps, numbered as in the lesson. Each assembly step is named while its part moves
// (from the start of its window); reduced-motion play stops at the end of each window, with the part seated.
const joinAt = (index) => (A_END * index) / (JOIN.length - 1 + WINDOW);
const joinEnd = (index) => Math.min(A_END, joinAt(index) + (A_END * WINDOW) / (JOIN.length - 1 + WINDOW));
const JOIN_STEPS = ["seating the power modules", "lowering the main board", "laying the connector on", "setting the wafer down", "clamping the cold plate"];
const FABRIC_STEPS = ["a wavelet leaves its core", "hop by hop on the mesh", "across a scribe line", "round a spare core"];
const STEPS = [
  { s: 0, stop: 0, text: "apart" },
  ...JOIN.map((id, index) => ({ s: joinAt(index) + 0.002, stop: joinEnd(index) - 0.004, text: `${String(index + 1).padStart(2, "0")} · ${JOIN_STEPS[index]}` })),
  { s: A_END + 0.002, stop: A_END + 0.02, text: "05 · power and water on" },
  ...FABRIC_STEPS.map((text, index) => {
    const at = ON + ((1 - ON) * index) / FABRIC_STEPS.length;
    return { s: at + 0.002, stop: ON + ((1 - ON) * (index + 0.75)) / FABRIC_STEPS.length, text: `06 · ${text}` };
  }),
  { s: 1, stop: 1, text: "engine running" },
];

function stepOf(s) {
  if (s <= 0.001) return STEPS[0].text;
  if (s >= 0.999) return STEPS[STEPS.length - 1].text;
  let text = STEPS[1].text;
  for (const step of STEPS.slice(1, -1)) if (s >= step.s - 0.0015) text = step.text;
  return text;
}

// ---- mesh traffic ----
const fabric = D.routes.map((route) => {
  const lengths = [0];
  for (let i = 1; i < route.pts.length; i++) lengths.push(lengths[i - 1] + Math.hypot(route.pts[i][0] - route.pts[i - 1][0], route.pts[i][1] - route.pts[i - 1][1]));
  return {
    ...route,
    lengths,
    total: lengths[lengths.length - 1],
    trail: stage.querySelector(`.ws-trail[data-route="${route.name}"]`),
    scribe: stage.querySelector(`.ws-scribe[data-route="${route.name}"]`),
    scribeShown: "",
    travel: route.travel || 0.62,
    head: stage.querySelector(`.ws-head[data-route="${route.name}"]`),
    shown: "",
  };
});
// the fabric phase's four named parts, as shares of it: leave, hop, cross a scribe line, go round the spare core
// (the same thresholds as the step label, so the label, the readout and the drawing agree)
const subOf = (f) => FABRIC_STEPS.reduce((n, _, i) => (f * (1 - ON) >= ((1 - ON) * i) / FABRIC_STEPS.length + 0.0005 ? i : n), 0);
const HOPS = D.routes.reduce((sum, route) => sum + route.hops, 0);

function drawFabric(s) {
  const f = fabricOf(s);
  let hops = 0;
  for (const route of fabric) {
    const g = clamp((f - route.at) / route.travel);
    hops += Math.round(g * route.hops);
    let text = "";
    if (g > 0) {
      const want = g * route.total;
      const pts = [route.pts[0]];
      for (let i = 1; i < route.pts.length; i++) {
        if (route.lengths[i] <= want) pts.push(route.pts[i]);
        else {
          const t = (want - route.lengths[i - 1]) / (route.lengths[i] - route.lengths[i - 1]);
          pts.push([route.pts[i - 1][0] + (route.pts[i][0] - route.pts[i - 1][0]) * t, route.pts[i - 1][1] + (route.pts[i][1] - route.pts[i - 1][1]) * t]);
          break;
        }
      }
      text = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join("");
    }
    if (text !== route.shown) {
      route.shown = text;
      route.trail.setAttribute("d", text);
      if (text) {
        const last = text.slice(text.lastIndexOf(text.includes("L") ? "L" : "M") + 1).split(" ");
        route.head.setAttribute("cx", last[0]);
        route.head.setAttribute("cy", last[1]);
        route.head.setAttribute("r", "2");
      } else route.head.setAttribute("r", "0");
    }
  }
  // in the scribe-line step, light the die edge each moving wavelet crossed last
  const scribeOn = s > ON && s < 0.999 && subOf(f) === 2;
  for (const route of fabric) {
    const g = clamp((f - route.at) / route.travel);
    let text = "";
    if (scribeOn && g > 0 && g < 1) {
      const crossed = route.crossings.filter((c) => c.g <= g);
      const c = crossed[crossed.length - 1];
      if (c) text = `M${c.seg[0][0]} ${c.seg[0][1]}L${c.seg[1][0]} ${c.seg[1][1]}`;
    }
    if (text !== route.scribeShown) {
      route.scribeShown = text;
      route.scribe.setAttribute("d", text);
    }
  }
  stage.toggleAttribute("data-spare", s > ON && s < 0.999 && subOf(f) === 3);
  stage.toggleAttribute("data-water", s >= A_END && s < ON + 0.02);
  return hops;
}

// ---- state ----
let s = 0;
let target = 0;
let playing = false;
let selected = null;
// a legend click pins its part: hover only previews, and leaving returns to the pin until another pick, Escape or a stage interaction
let pinned = null;
let touring = !still.matches;
let tourClock = 0;
let tookOver = false;
let visible = false;
let frame = 0;
let last = 0;
let spoken = "";
let hops = 0;
const PLAY_SECONDS = 16;

function say(text) {
  if (readout.textContent !== text) readout.textContent = text;
}

function phaseText() {
  if (s <= 0.001) return `Taken apart · ${D.idle}`;
  if (s >= 0.999) return `Engine running · ${D.fabric}`;
  return stepOf(s);
}

function describe() {
  const text = selected ? `${D.pieces[selected].name}: ${D.pieces[selected].say}` : phaseText();
  if (stage.getAttribute("aria-valuetext") !== text) stage.setAttribute("aria-valuetext", text);
  if (document.activeElement === stage && text !== spoken) {
    spoken = text;
    live.textContent = text;
  }
}

function idleText() {
  if (selected) return `${D.pieces[selected].name} · ${D.pieces[selected].say}`;
  if (s <= 0.001) return D.idle;
  if (s < A_END) return stepOf(s).slice(5);
  if (s < ON) return D.closed;
  if (s >= 0.999) return `wavelets · ${hops} of ${HOPS} hops · ${D.fabricPbs} Pb/s fabric`;
  const sub = subOf(fabricOf(s));
  if (sub === 0) return D.wavelet;
  if (sub === 2) return D.scribe;
  if (sub === 3) return D.spare;
  return `wavelets · ${hops} of ${HOPS} hops · ${D.fabricPbs} Pb/s fabric`;
}

function select(id) {
  if (id === "stand") id = null;
  if (selected === id) return;
  selected = id;
  for (const node of nodes) {
    if (id !== null && node.piece === id) node.el.setAttribute("data-on", "");
    else node.el.removeAttribute("data-on");
  }
  if (id) stage.setAttribute("data-focus", "");
  else stage.removeAttribute("data-focus");
  partButtons.forEach((button) => (button.dataset.part === id ? button.setAttribute("data-on", "") : button.removeAttribute("data-on")));
  stage.setAttribute("aria-valuenow", String(id ? D.order.indexOf(id) + 1 : 0));
  describe();
}

function place() {
  const share = {};
  for (const id of Object.keys(D.pieces)) share[id] = apartOf(id, s);
  for (const node of nodes) {
    const x = share[node.piece];
    const tx = (D.EX[0] * node.m[0] + D.EY[0] * node.m[1] + D.EZ[0] * node.m[2]) * x;
    const ty = (D.EX[1] * node.m[0] + D.EY[1] * node.m[1] + D.EZ[1] * node.m[2]) * x;
    const text = x === 0 ? "" : `translate(${tx.toFixed(2)} ${ty.toFixed(2)})`;
    if (text !== node.shown) {
      node.shown = text;
      if (text) node.el.setAttribute("transform", text);
      else node.el.removeAttribute("transform");
    }
  }
  const view = camera((node) => {
    const x = share[node.piece];
    return [(D.EX[0] * node.m[0] + D.EY[0] * node.m[1] + D.EZ[0] * node.m[2]) * x, (D.EX[1] * node.m[0] + D.EY[1] * node.m[1] + D.EZ[1] * node.m[2]) * x];
  }, ease(clamp((s - A_END) / (ON - A_END))));
  if (view !== cameraShown) {
    cameraShown = view;
    if (view) layers.setAttribute("transform", view);
    else layers.removeAttribute("transform");
  }
  const next = nodes.map((_, index) => index).sort((a, b) => nodes[a].key + nodes[a].lift * share[nodes[a].piece] - (nodes[b].key + nodes[b].lift * share[nodes[b].piece]));
  if (next.some((index, at) => index !== order[at])) {
    const fragment = document.createDocumentFragment();
    for (const index of next) fragment.appendChild(nodes[index].el);
    layers.appendChild(fragment);
    order = next;
  }
  hops = drawFabric(s);
}

function show() {
  scrubInput.value = String(Math.round(s * 1000));
  const scrubText = phaseText();
  if (scrubInput.getAttribute("aria-valuetext") !== scrubText) scrubInput.setAttribute("aria-valuetext", scrubText);
  playText.textContent = playing ? "Pause" : s >= 0.999 ? "Replay" : "Play";
  playButton.toggleAttribute("data-playing", playing);
  playButton.setAttribute("aria-label", playing ? "Pause" : s >= 0.999 ? "Replay the assembly and the mesh traffic" : "Play the assembly and the mesh traffic");
  const text = stepOf(s);
  if (stepText.textContent !== text) stepText.textContent = text;
  place();
  say(idleText());
  describe();
}

// the idle tour: play the whole process slowly, hold closed, ease back apart, hold, repeat
const TOUR = { play: 18, hold: 2.6, back: 2.2, rest: 1.6 };
function tourAt(t) {
  const loop = TOUR.play + TOUR.hold + TOUR.back + TOUR.rest;
  const u = t % loop;
  if (u < TOUR.play) return u / TOUR.play;
  if (u < TOUR.play + TOUR.hold) return 1;
  if (u < TOUR.play + TOUR.hold + TOUR.back) return 1 - ease((u - TOUR.play - TOUR.hold) / TOUR.back);
  return 0;
}

function takeOver() {
  touring = false;
  tookOver = true;
}

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  let moving = false;
  if (touring) {
    tourClock += dt;
    s = target = tourAt(Math.max(0, tourClock - 0.8));
    moving = true;
  } else if (playing) {
    s = target = Math.min(1, s + dt / PLAY_SECONDS);
    if (s >= 1) playing = false;
    moving = true;
  } else if (s !== target) {
    s = still.matches ? target : s + (target - s) * (1 - Math.exp(-dt / 0.35));
    if (Math.abs(target - s) < 5e-4) s = target;
    moving = s !== target;
  }
  show();
  frame = visible && (moving || touring || playing) ? requestAnimationFrame(tick) : 0;
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

function togglePlay() {
  takeOver();
  pinned = null;
  if (playing) {
    playing = false;
    target = s;
    show();
    return;
  }
  if (still.matches) {
    // reduced motion: jump to the next named step instead of animating
    const next = STEPS.find((step) => step.stop > s + 0.0005);
    s = target = next ? next.stop : 0;
    show();
    return;
  }
  if (s >= 0.999) s = target = 0;
  playing = true;
  run();
}

function reset() {
  takeOver();
  pinned = null;
  playing = false;
  select(null);
  target = 0;
  if (still.matches) s = 0;
  show();
  run();
}

function pieceAt(event) {
  const hit = document.elementFromPoint(event.clientX, event.clientY);
  const item = hit && hit.closest ? hit.closest(".it") : null;
  return item ? item.dataset.piece : null;
}

let leaveTimer = 0;
stage.addEventListener("pointermove", (event) => {
  if (event.pointerType === "touch") return;
  clearTimeout(leaveTimer);
  if (touring) takeOver();
  select(pieceAt(event));
  show();
  run();
});

stage.addEventListener("pointerleave", (event) => {
  if (event.pointerType === "touch") return;
  clearTimeout(leaveTimer);
  leaveTimer = setTimeout(() => {
    select(pinned);
    show();
  }, 260);
});

stage.addEventListener("pointerdown", (event) => {
  pinned = null;
  if (event.pointerType !== "touch") {
    stage.focus({ preventScroll: true });
    return;
  }
  takeOver();
  const id = pieceAt(event);
  if (!id || id === "stand") {
    select(null);
    togglePlay();
  } else select(id === selected ? null : id);
  show();
});

let lastX = NaN, lastY = NaN;
document.addEventListener("pointermove", (event) => {
  lastX = event.clientX;
  lastY = event.clientY;
});
partButtons.forEach((button) => {
  const preview = () => {
    clearTimeout(leaveTimer);
    select(button.dataset.part);
    show();
  };
  const hide = () => {
    clearTimeout(leaveTimer);
    leaveTimer = setTimeout(() => {
      if (partButtons.some((other) => other.matches(":hover, :focus-visible"))) return;
      select(pinned);
      show();
    }, 260);
  };
  // preview only on real movement: a resting cursor gets synthetic pointer events when the layout shifts under it
  button.addEventListener("pointermove", (event) => {
    if (event.clientX === lastX && event.clientY === lastY) return;
    if (selected !== button.dataset.part) preview();
  });
  button.addEventListener("focus", preview);
  button.addEventListener("pointerleave", hide);
  button.addEventListener("blur", hide);
  button.addEventListener("click", () => {
    // a click also takes the stack apart so the picked layer can be seen
    takeOver();
    playing = false;
    pinned = button.dataset.part;
    select(pinned);
    target = 0;
    if (still.matches) s = 0;
    show();
    run();
  });
});

stage.addEventListener("focus", () => {
  spoken = "";
  describe();
});

document.addEventListener("keydown", (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey || !visible) return;
  const t = event.target;
  if (t !== document.body && t !== stage && !root.contains(t)) return;
  if (t === scrubInput && event.key !== " " && event.key !== "Escape") return;
  if (t instanceof HTMLButtonElement && (event.key === " " || event.key === "Enter")) return;
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
  pinned = null;
  select(D.order[next]);
  show();
});

scrubInput.addEventListener("input", () => {
  takeOver();
  pinned = null;
  playing = false;
  select(null);
  s = target = Number(scrubInput.value) / 1000;
  show();
});

playButton.addEventListener("click", () => {
  select(null);
  togglePlay();
});

document.addEventListener("themechange", () => show());
slim.addEventListener("change", () => {
  cameraShown = "";
  show();
});

const narrow = matchMedia("(hover: none), (max-width: 480px)");
const hint = root.querySelector(".ws-hint");
const wording = () => hint && (hint.textContent = narrow.matches ? "Tap a layer · tap the base to play" : "Hover a layer · Space plays");
wording();
narrow.addEventListener("change", wording);
show();
