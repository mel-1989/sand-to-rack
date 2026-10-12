const D = __DATA__;
const root = document.querySelector(".tr");
const stage = root.querySelector(".tr-stage");
const layers = stage.querySelector(".tr-layers");
const live = root.querySelector("[data-live]");
const readout = root.querySelector("[data-readout]");
const partButtons = [...root.querySelectorAll(".tr-part")];
const scrubInput = root.querySelector("[data-scrub]");
const playButton = root.querySelector("[data-play]");
const playText = root.querySelector("[data-play-text]");
const stepText = root.querySelector("[data-step]");
const still = matchMedia("(prefers-reduced-motion: reduce)");

const nodes = [...layers.querySelectorAll(".it")].map((el) => ({
  el,
  piece: el.dataset.piece,
  gen: el.dataset.gen || null,
  key: Number(el.dataset.k),
  m: el.dataset.m.split(",").map(Number),
  shown: "",
}));
for (const node of nodes) node.lift = node.m[0] * D.V[0] + node.m[1] * D.V[1] + node.m[2] * D.V[2];
let order = nodes.map((_, index) => index);

const IDS = D.order;
const SPRING = D.spring;
// share of each carriage: 0 closed, 1 slid fully open
const piece = Object.fromEntries(IDS.map((id) => [id, { x: 0, v: 0, target: 0, pending: null }]));
const shareOfPiece = (id) => (piece[id] ? piece[id].x : 0);

let clock = 0;
let selected = null;
let picked = null; // { item, sub, text }: one part of the lit specimen, named in the readout
let inside = false;
let leaveTimer = 0;
let idleTimer = 0;
let visible = false;
let frame = 0;
let last = 0;
let spoken = "";
let playing = null;
let tookOver = false;
let touring = !still.matches;
let tourClock = -1.4;

// The slider opens the specimens one after another, oldest first, with a small overlap.
const WINDOW = 1.15;
const ease = (t) => t * t * (3 - 2 * t);
const shareAt = (s, index) => ease(Math.min(1, Math.max(0, (s * (IDS.length - 1 + WINDOW) - index) / WINDOW)));
const stepIndex = (s) => Math.min(IDS.length - 1, Math.max(0, Math.floor(s * (IDS.length - 1 + WINDOW) - WINDOW / 2 + 0.5)));
const sliderValue = () => Number(scrubInput.value) / 1000;

function say(text) {
  if (readout.textContent !== text) readout.textContent = text;
}

// On a phone the readout drops the node name so it stays on one line.
const panning = matchMedia("(max-width: 520px)");
const sayOf = (id) => (panning.matches ? D.gens[id].sayShort : D.gens[id].say);
const idleSay = () => (panning.matches ? D.idleShort : D.idle);

function partText(item, sub) {
  const role = (sub && sub.dataset.sub) || item.dataset.role;
  let text = D.parts[role];
  if (!text) return null;
  if (typeof text === "object") text = text[item.dataset.gen] || null;
  if (!text) return null;
  return text.replace("{half}", item.dataset.half || "source/drain");
}

function pick(hit) {
  const item = hit && hit.gen === selected ? hit.item : null;
  const sub = item ? hit.sub : null;
  if (picked && picked.item === item && picked.sub === sub) return;
  if (picked) {
    picked.item.removeAttribute("data-pick");
    if (picked.sub) picked.sub.removeAttribute("data-pick");
  }
  const text = item ? partText(item, sub) : null;
  picked = text ? { item, sub, text } : null;
  if (picked) {
    item.setAttribute("data-pick", "");
    if (sub) sub.setAttribute("data-pick", "");
    stage.setAttribute("data-pick", "");
  } else stage.removeAttribute("data-pick");
}

function describe() {
  const s = sliderValue();
  const text = selected ? `${D.gens[selected].name}: ${picked ? picked.text : D.gens[selected].say}` : s >= 0.999 ? D.open : s <= 0.001 ? `Closed · ${D.idle}` : stepOf(s);
  if (stage.getAttribute("aria-valuetext") !== text) stage.setAttribute("aria-valuetext", text);
  if (document.activeElement === stage && text !== spoken) {
    spoken = text;
    live.textContent = text;
  }
}

function select(id) {
  if (id && !D.gens[id]) id = null;
  if (selected === id) return;
  selected = id;
  pick(null);
  for (const node of nodes) {
    const mine = id !== null && node.gen === id;
    node.el.toggleAttribute("data-mine", mine);
    node.el.toggleAttribute("data-on", mine && !node.el.hasAttribute("data-host"));
  }
  if (id) follow(id);
  if (id) stage.setAttribute("data-focus", "");
  else stage.removeAttribute("data-focus");
  partButtons.forEach((button) => (button.dataset.part === id ? button.setAttribute("data-on", "") : button.removeAttribute("data-on")));
  stage.setAttribute("aria-valuenow", String(id ? IDS.indexOf(id) + 1 : 0));
  describe();
}

// On a phone the bench is wider than the card: the stage pans, and follows the specimen in play.
// A swipe by the reader forgets which specimen was followed, so the next pick pans back to it.
let followed = null;
let followedAt = -1e9;
// Edge fades show that the strip goes on past the card edge: data-more-left / data-more-right drive a CSS mask.
function edges() {
  const room = stage.scrollWidth - stage.clientWidth;
  stage.toggleAttribute("data-more-left", panning.matches && stage.scrollLeft > 2);
  stage.toggleAttribute("data-more-right", panning.matches && room > 2 && stage.scrollLeft < room - 2);
}
stage.addEventListener("scroll", () => {
  if (performance.now() - followedAt > 900) followed = null;
  edges();
}, { passive: true });
addEventListener("resize", edges);
panning.addEventListener("change", edges);
function follow(id, force = false) {
  if (!panning.matches || !id || (id === followed && !force)) return;
  followed = id;
  followedAt = performance.now();
  const svgEl = stage.querySelector("svg");
  const left = D.centres[id] * svgEl.clientWidth - stage.clientWidth / 2;
  stage.scrollTo({ left: Math.max(0, left), behavior: still.matches ? "auto" : "smooth" });
}

function scrubTo(s) {
  for (const [index, id] of IDS.entries()) {
    const state = piece[id];
    state.x = state.target = shareAt(s, index);
    state.v = 0;
    state.pending = null;
  }
  scrubInput.value = String(Math.round(s * 1000));
  if (s > 0.001 && s < 0.999) follow(IDS[stepIndex(s)]);
  describe();
}

// Escape rewinds the slider to closed in about a second (newest specimen first), or jumps under reduced motion.
const REWIND = 1;
function closeAll() {
  const from = Math.max(sliderValue(), progress());
  if (from <= 0.001 || still.matches) {
    scrubTo(0);
    return;
  }
  playing = { from, to: 0, t: 0, seconds: REWIND };
}

function progress() {
  // the slider value whose shares best match the carriages: invert the last carriage that has moved
  let s = 0;
  for (const [index, id] of IDS.entries()) {
    const x = piece[id].x;
    if (x <= 1e-4) break;
    const t = 0.5 - Math.sin(Math.asin(1 - 2 * Math.min(1, x)) / 3); // inverse of ease
    s = Math.min(1, (index + WINDOW * t) / (IDS.length - 1 + WINDOW));
  }
  return s;
}

function stepOf(s) {
  if (s <= 0.001) return "closed";
  if (s >= 0.999) return "all four open";
  const id = IDS[stepIndex(s)];
  return `${String(IDS.indexOf(id) + 1).padStart(2, "0")} · ${D.gens[id].short} · ${D.gens[id].grip}`;
}

function showPlay() {
  const s = sliderValue();
  playText.textContent = playing ? "Pause" : s >= 0.999 ? "Close" : "Cut open";
  playButton.toggleAttribute("data-playing", !!playing);
  playButton.setAttribute("aria-label", playing ? "Pause" : s >= 0.999 ? "Play closing the specimens" : "Play the sectioning");
  const text = stepOf(s);
  if (stepText.textContent !== text) stepText.textContent = text;
}

function steerSpring(state, dt, calm) {
  if (state.pending && clock >= state.pending.at) {
    state.target = state.pending.value;
    state.pending = null;
  }
  if (calm) {
    state.x = state.target;
    state.v = 0;
    return state.pending !== null;
  }
  for (let index = 0; index < SPRING.substeps; index++) {
    const h = dt / SPRING.substeps;
    state.v += ((state.target - state.x) * SPRING.stiffness - state.v * SPRING.damping) * h;
    state.x += state.v * h;
  }
  if (Math.abs(state.target - state.x) < 2e-4 && Math.abs(state.v) < 2e-4) {
    state.x = state.target;
    state.v = 0;
    return state.pending !== null;
  }
  return true;
}

function place() {
  for (const node of nodes) {
    const share = shareOfPiece(node.piece);
    const tx = (D.EX[0] * node.m[0] + D.EY[0] * node.m[1] + D.EZ[0] * node.m[2]) * share;
    const ty = (D.EX[1] * node.m[0] + D.EY[1] * node.m[1] + D.EZ[1] * node.m[2]) * share;
    const text = share === 0 ? "" : `translate(${tx.toFixed(2)} ${ty.toFixed(2)})`;
    if (text !== node.shown) {
      node.shown = text;
      if (text) node.el.setAttribute("transform", text);
      else node.el.removeAttribute("transform");
    }
  }
  const keyOf = (node) => node.key + node.lift * shareOfPiece(node.piece);
  const next = nodes.map((_, index) => index).sort((a, b) => keyOf(nodes[a]) - keyOf(nodes[b]));
  if (next.some((index, at) => index !== order[at])) {
    const fragment = document.createDocumentFragment();
    for (const index of next) fragment.appendChild(nodes[index].el);
    layers.appendChild(fragment);
    order = next;
  }
}

// Idle tour: cut each specimen open in turn, light it, hold all four open, close them again.
const TOUR_OPEN = 10;
const TOUR_HOLD = 3.5;
const TOUR_CLOSE = 2.4;
const TOUR_REST = 1.8;
function tourAt(time) {
  const length = TOUR_OPEN + TOUR_HOLD + TOUR_CLOSE + TOUR_REST;
  const t = time % length;
  if (t < TOUR_OPEN) {
    const s = t / TOUR_OPEN;
    return { s, part: IDS[stepIndex(s)] };
  }
  if (t < TOUR_OPEN + TOUR_HOLD) return { s: 1, part: null };
  if (t < TOUR_OPEN + TOUR_HOLD + TOUR_CLOSE) return { s: 1 - ease((t - TOUR_OPEN - TOUR_HOLD) / TOUR_CLOSE), part: null };
  return { s: 0, part: null };
}

function quietTour() {
  touring = false;
  tookOver = true;
  clearTimeout(idleTimer);
}

function idleText() {
  if (selected) return picked ? `${D.gens[selected].short} · ${picked.text}` : sayOf(selected);
  const s = sliderValue();
  if (s > 0.001 && s < 0.999) return sayOf(IDS[stepIndex(s)]);
  const moving = IDS.some((id) => Math.abs(piece[id].x - piece[id].target) > 0.002 || piece[id].pending);
  if (moving) return "closing the specimens";
  return s >= 0.999 ? D.open : idleSay();
}

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  clock += dt;
  const calm = still.matches;
  let moving = false;
  if (touring) {
    tourClock += dt;
    const step = tourAt(Math.max(0, tourClock));
    scrubTo(step.s);
    select(step.part);
    moving = true;
  } else if (playing) {
    playing.t = Math.min(1, playing.t + dt / playing.seconds);
    const s = playing.from + (playing.to - playing.from) * playing.t;
    scrubTo(s);
    if (playing.t >= 1) playing = null;
    moving = true;
  } else {
    for (const id of IDS) if (steerSpring(piece[id], dt, calm)) moving = true;
    if (moving || IDS.some((id) => piece[id].x !== shareAt(sliderValue(), IDS.indexOf(id)))) scrubInput.value = String(Math.round(progress() * 1000));
  }
  showPlay();
  place();
  say(idleText());
  describe();
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

function hitAt(event) {
  const hit = document.elementFromPoint(event.clientX, event.clientY);
  const item = hit && hit.closest ? hit.closest(".it") : null;
  if (!item || !item.dataset.gen) return { gen: null, item: null, sub: null };
  const sub = hit.closest("[data-sub]");
  return { gen: item.dataset.gen, item, sub: sub && item.contains(sub) ? sub : null };
}

function refresh() {
  showPlay();
  place();
  say(idleText());
  describe();
}

stage.addEventListener("pointermove", (event) => {
  if (event.pointerType === "touch") return;
  inside = true;
  clearTimeout(leaveTimer);
  if (touring) quietTour();
  const hit = hitAt(event);
  select(hit.gen);
  pick(hit);
  refresh();
});

stage.addEventListener("pointerleave", () => {
  inside = false;
  clearTimeout(leaveTimer);
  leaveTimer = setTimeout(() => {
    if (inside) return;
    select(null);
    refresh();
  }, 260);
});

stage.addEventListener("pointerdown", (event) => {
  if (event.pointerType !== "touch") {
    stage.focus({ preventScroll: true });
    return;
  }
  quietTour();
  playing = null;
  // first tap lights a specimen and names the part tapped; tapping that same part again lets go
  const hit = hitAt(event);
  const again = hit.gen && hit.gen === selected && picked && picked.item === hit.item && picked.sub === hit.sub;
  if (again || !hit.gen) select(null);
  else {
    select(hit.gen);
    pick(hit);
  }
  refresh();
});

partButtons.forEach((button) => {
  const show = () => {
    quietTour();
    clearTimeout(leaveTimer);
    select(button.dataset.part);
    pick(null);
    follow(button.dataset.part, true);
    refresh();
  };
  const hide = () => {
    clearTimeout(leaveTimer);
    leaveTimer = setTimeout(() => {
      if (inside || partButtons.some((other) => other.matches(":hover, :focus-visible"))) return;
      select(null);
      refresh();
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

function togglePlay() {
  quietTour();
  select(null);
  if (playing) {
    playing = null;
    showPlay();
    return;
  }
  const from = sliderValue();
  const to = from >= 0.999 ? 0 : 1;
  if (still.matches) {
    scrubTo(to);
    refresh();
    return;
  }
  playing = { from, to, t: 0, seconds: (to ? 9 : 3) * Math.abs(to - from) };
  run();
}

document.addEventListener("keydown", (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey || !visible) return;
  const target = event.target;
  if (target !== document.body && target !== stage && !root.contains(target)) return;
  if (target === scrubInput && event.key !== " " && event.key !== "Escape") return;
  if (target instanceof HTMLButtonElement && (event.key === " " || event.key === "Enter")) return;
  const index = selected ? IDS.indexOf(selected) : -1;
  let next = null;
  if (event.key === "ArrowRight" || event.key === "ArrowDown") next = Math.min(IDS.length - 1, index + 1);
  else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = Math.max(0, index - 1);
  else if (event.key === "Home") next = 0;
  else if (event.key === "End") next = IDS.length - 1;
  else if (event.key === "Escape") {
    event.preventDefault();
    quietTour();
    playing = null;
    select(null);
    closeAll();
    run();
    refresh();
    return;
  } else if (event.key === " ") {
    event.preventDefault();
    togglePlay();
    refresh();
    return;
  }
  if (next === null) return;
  event.preventDefault();
  quietTour();
  select(IDS[next]);
  refresh();
});

scrubInput.addEventListener("input", () => {
  quietTour();
  playing = null;
  const s = sliderValue();
  scrubTo(s);
  select(s > 0.001 && s < 0.999 ? IDS[stepIndex(s)] : null);
  refresh();
});

playButton.addEventListener("click", () => {
  togglePlay();
  refresh();
});

if (still.matches) touring = false;
const narrow = matchMedia("(hover: none), (max-width: 480px)");
const hint = root.querySelector(".tr-hint");
const wording = () => hint && (hint.textContent = panning.matches ? "Tap a part · swipe · play below" : narrow.matches ? "Tap a part · play below" : "Hover a part · Space plays");
wording();
narrow.addEventListener("change", wording);
panning.addEventListener("change", wording);
edges();
refresh();
