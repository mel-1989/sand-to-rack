const D = __DATA__;
const root = document.querySelector(".hb");
const stage = root.querySelector(".hb-stage");
const layers = stage.querySelector(".hb-layers");
const live = root.querySelector("[data-live]");
const readout = root.querySelector("[data-readout]");
const partButtons = [...root.querySelectorAll(".hb-part")];
const joints = [...root.querySelectorAll(".hb-joint")];
const scrubInput = root.querySelector("[data-scrub]");
const playButton = root.querySelector("[data-play]");
const playText = root.querySelector("[data-play-text]");
const stepText = root.querySelector("[data-step]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const P = D.P;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const E = (t) => {
  const x = clamp(t);
  return x * x * (3 - 2 * x);
};
const fmt = (n) => Math.round(n).toLocaleString("en-US");

const nodes = [...layers.querySelectorAll(".hb-it")].map((el) => ({
  el,
  piece: el.dataset.piece,
  part: el.dataset.part,
  key: Number(el.dataset.k),
  shown: "",
}));
let order = nodes.map((_, i) => i);
const q = (sel) => layers.querySelector(sel);
const flipEl = q("[data-flip]");
const tapeDie = q('[data-die="tape"]');
const colletDie = q('[data-die="collet"]');
const collet = q("[data-collet]");
const glowUp = q('[data-glow="up"]');
const glowDown = q('[data-glow="down"]');
const sites = [...layers.querySelectorAll("[data-site]")];
const STEPS = D.eras.length * D.phases.length;

// ---- the process as a pure function of the slider position s (0..1) ----
function phaseLabel(c, ph) {
  const e = D.eras[c];
  if (ph === 2 && e.faceUp) return "no flip";
  if (ph === 4) return { wire: "bond · die attach", c4: "place on flux", ubump: "thermocompression", hybrid: "pre-bond, room temp" }[e.id];
  if (ph === 5 && e.id === "hybrid") return "index, anneal later";
  return D.phases[ph].label;
}
function stepOf(s) {
  const qn = clamp(s) * STEPS;
  const step = Math.min(STEPS - 1, Math.floor(qn));
  const c = Math.floor(step / D.phases.length);
  const ph = step % D.phases.length;
  return { step, c, ph, u: s >= 1 ? 1 : qn - step };
}
function poseAt(s) {
  const { c, ph, u } = stepOf(s);
  const e = D.eras[c];
  const flipE = !e.faceUp;
  const xs = c === 0 ? D.PICK[0] : D.HANDOFF;
  const site = D.SITES[c];
  const p = { hx: xs, hz: 0, theta: 180, lift: 0, dieAt: "tape", placed: c, hot: 0, up: 0, down: 0, c, ph };
  if (ph === 0) {
    if (flipE) {
      p.theta = 180 - 180 * E(u / 0.5);
      p.lift = D.LIFT * E((u - 0.55) / 0.35);
    } else p.lift = D.LIFT * E((u - 0.2) / 0.5);
    return p;
  }
  if (ph === 1) {
    if (flipE) {
      p.theta = 0;
      p.dieAt = u < 0.3 ? "tape" : "pad";
      p.lift = D.LIFT * (1 - E((u - 0.35) / 0.4));
    } else {
      const drop = D.STROKE.tape;
      p.hz = u < 0.35 ? drop * E(u / 0.35) : drop * (1 - E((u - 0.42) / 0.4));
      p.dieAt = u < 0.36 ? "tape" : "collet";
      p.lift = u < 0.36 ? D.LIFT : D.LIFT * (1 - E((u - 0.4) / 0.4));
    }
    return p;
  }
  if (ph === 2) {
    if (flipE) {
      p.theta = 180 * E(u);
      p.dieAt = "pad";
    } else {
      p.dieAt = "collet";
      p.hx = xs + (D.UPCAM[0] - xs) * E(u);
    }
    return p;
  }
  if (ph === 3) {
    p.dieAt = "collet";
    if (flipE) {
      const drop = D.STROKE.flip;
      if (u < 0.3) p.hz = u < 0.15 ? drop * E(u / 0.15) : drop * (1 - E((u - 0.15) / 0.15));
      if (u < 0.15) p.dieAt = "pad";
      p.hx = xs + (D.UPCAM[0] - xs) * E((u - 0.3) / 0.35);
      p.up = u > 0.68 && u < 0.98 ? 1 : 0;
    } else {
      p.hx = D.UPCAM[0];
      p.up = u > 0.1 && u < 0.9 ? 1 : 0;
    }
    return p;
  }
  if (ph === 4) {
    p.dieAt = "collet";
    p.hx = D.UPCAM[0] + (site - D.UPCAM[0]) * E(u / 0.35);
    p.down = u > 0.36 && u < 0.52 ? 1 : 0;
    p.hz = D.STROKE.bond * E((u - 0.52) / 0.28);
    if (u >= 0.8) {
      p.dieAt = "none";
      p.placed = c + 1;
    }
    p.hot = e.id === "ubump" ? E((u - 0.55) / 0.2) : 0;
    return p;
  }
  // index: lift off the bonded die and go back for the next one
  p.dieAt = "none";
  p.placed = c + 1;
  p.hx = site + (D.HANDOFF - site) * E((u - 0.3) / 0.7);
  p.hz = D.STROKE.bond * (1 - E(u / 0.3));
  p.hot = e.id === "ubump" ? 1 - E(u / 0.3) : 0;
  return p;
}

// ---- the flip arm, rebuilt as it turns ----
function flipSvg(theta, withDie) {
  const t = (theta * Math.PI) / 180;
  const F = GL.frameOf(D.PIVOT, [-Math.cos(t), 0, Math.sin(t)], [0, 1, 0], [Math.sin(t), 0, Math.cos(t)]);
  const rect = (u0, u1, v0, v1) => [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
  const h = D.DIE / 2;
  const parts = [
    { poly: rect(-D.ARM_W, D.ARM_W, -D.ARM_H, D.ARM_H), s: [-6, D.ARM_L + 5], tone: "mid" },
    { poly: rect(-h + 0.6, h - 0.6, -D.ARM_H - D.PAD_T, -D.ARM_H), s: [D.ARM_L - h + 0.6, D.ARM_L + h - 0.6], tone: "mid" },
  ];
  if (withDie) parts.push({ poly: rect(-h, h, -D.ARM_H - D.PAD_T - D.DIE_T, -D.ARM_H - D.PAD_T), s: [D.ARM_L - h, D.ARM_L + h], tone: "hi", die: true });
  return parts
    .map((part) => ({ ...part, depth: GL.dot3(GL.pointOf(F, (part.s[0] + part.s[1]) / 2, 0, part.poly[0][1]), D.V) }))
    .sort((a, b) => a.depth - b.depth)
    .map((part) => solidSvg(GL.prismOf(F, part.poly, part.s[0], part.s[1], P), { tone: part.tone, crease: part.die ? "lo" : "faint" }))
    .join("");
}

let drawn = { theta: 180, pad: false };
function apply(p) {
  const dx = p.hx - D.HX0;
  for (const node of nodes) {
    let tx = 0;
    let ty = 0;
    if (node.piece === "head" || node.piece === "slide") {
      tx = D.EX[0] * dx;
      ty = D.EX[1] * dx;
      if (node.piece === "slide") {
        tx -= D.EZ[0] * p.hz;
        ty -= D.EZ[1] * p.hz;
      }
    } else if (node.piece === "lift") {
      tx = D.EZ[0] * p.lift;
      ty = D.EZ[1] * p.lift;
    }
    const text = tx === 0 && ty === 0 ? "" : `translate(${tx.toFixed(2)} ${ty.toFixed(2)})`;
    if (text !== node.shown) {
      node.shown = text;
      if (text) node.el.setAttribute("transform", text);
      else node.el.removeAttribute("transform");
    }
  }
  const lift = D.V[0] * dx;
  const next = nodes
    .map((_, i) => i)
    .sort((a, b) => keyOf(nodes[a], lift) - keyOf(nodes[b], lift));
  if (next.some((index, i) => index !== order[i])) {
    const fragment = document.createDocumentFragment();
    for (const index of next) fragment.appendChild(nodes[index].el);
    layers.appendChild(fragment);
    order = next;
  }
  const pad = p.dieAt === "pad";
  if (Math.abs(p.theta - drawn.theta) > 0.01 || pad !== drawn.pad) {
    flipEl.innerHTML = flipSvg(p.theta, pad);
    drawn = { theta: p.theta, pad };
  }
  tapeDie.style.display = p.dieAt === "tape" ? "" : "none";
  colletDie.style.display = p.dieAt === "collet" ? "" : "none";
  sites.forEach((el, i) => (el.style.display = i < p.placed ? "" : "none"));
  collet.toggleAttribute("data-hot", p.hot > 0.5);
  glowUp.toggleAttribute("data-on", !!p.up);
  glowDown.toggleAttribute("data-on", !!p.down);
  joints.forEach((el, i) => el.toggleAttribute("data-on", i === p.c));
}
const keyOf = (node, lift) => node.key + (node.piece === "head" || node.piece === "slide" ? lift : 0);

// ---- state, selection, readout ----
let s = 0;
let selected = null;
let playing = null;
let touring = !still.matches;
let tookOver = false;
let inside = false;
let leaveTimer = 0;
let idleTimer = 0;
let visible = false;
let frame = 0;
let last = 0;
let spoken = "";
let restUntil = 0;

function say(text) {
  if (readout.textContent !== text) readout.textContent = text;
}
function processText() {
  const { c, ph } = stepOf(s);
  const e = D.eras[c];
  const dens = e.area ? `${fmt(e.per)} /mm²` : "edge pads";
  return `${e.short} · ${e.pitchText} µm · ${dens} · ${phaseLabel(c, ph)}`;
}
function readoutText() {
  if (selected) return D.pieces[selected].say;
  if (s <= 0.0005 && !playing && !touring) return D.idle;
  return processText();
}
function describe() {
  const text = selected ? `${D.pieces[selected].name}: ${D.pieces[selected].say}` : processText();
  if (stage.getAttribute("aria-valuetext") !== text) stage.setAttribute("aria-valuetext", text);
  if (document.activeElement === stage && text !== spoken) {
    spoken = text;
    live.textContent = text;
  }
}
function showStep() {
  const { step, c, ph } = stepOf(s);
  const text = `${D.eras[c].short} · ${phaseLabel(c, ph)}`;
  if (stepText.textContent !== text) stepText.textContent = text;
  scrubInput.value = String(Math.round(s * 1000));
  playText.textContent = playing ? "Pause" : s >= 0.999 ? "Replay" : "Play";
  playButton.toggleAttribute("data-playing", !!playing);
  playButton.setAttribute("aria-label", playing ? "Pause" : "Play the bond cycles");
}
let lastStep = -1;
function render() {
  apply(poseAt(s));
  showStep();
  say(readoutText());
  const { step } = stepOf(s);
  if (step !== lastStep) {
    lastStep = step;
    describe();
  }
}

function select(id) {
  if (id === "stand") id = null;
  if (selected === id) return;
  selected = id;
  for (const node of nodes) node.el.toggleAttribute("data-on", id !== null && node.part === id);
  stage.toggleAttribute("data-focus", !!id);
  partButtons.forEach((b) => b.toggleAttribute("data-on", b.dataset.part === id));
  describe();
  say(readoutText());
}

// ---- loop ----
const SECONDS = 1.15 * STEPS;
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  let moving = false;
  if (touring) {
    if (now < restUntil) moving = true;
    else if (s >= 1) {
      s = 0;
      restUntil = now + 1400;
      moving = true;
    } else {
      s = Math.min(1, s + dt / SECONDS);
      if (s >= 1) restUntil = now + 2600;
      moving = true;
    }
  } else if (playing) {
    s = Math.min(1, s + dt / SECONDS);
    if (s >= 1) playing = null;
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
function setPlaying(on) {
  quietTour();
  if (!on) {
    playing = null;
    render();
    return;
  }
  if (s >= 0.999) s = 0;
  if (still.matches) {
    // reduced motion: jump step by step instead of animating
    s = Math.min(1, (stepOf(s).step + 1) / STEPS + 1e-6);
    render();
    return;
  }
  playing = { from: s };
  run();
}
function reset() {
  quietTour();
  playing = null;
  s = 0;
  select(null);
  render();
}

// ---- input ----
function partAt(event) {
  const hit = document.elementFromPoint(event.clientX, event.clientY);
  const item = hit && hit.closest ? hit.closest(".hb-it") : null;
  return item ? item.dataset.part : null;
}
stage.addEventListener("pointermove", (event) => {
  if (event.pointerType === "touch") return;
  inside = true;
  clearTimeout(leaveTimer);
  select(partAt(event));
});
stage.addEventListener("pointerleave", () => {
  inside = false;
  clearTimeout(leaveTimer);
  leaveTimer = setTimeout(() => {
    if (inside || partButtons.some((b) => b.matches(":hover, :focus-visible"))) return;
    select(null);
  }, 260);
});
stage.addEventListener("pointerdown", (event) => {
  if (event.pointerType !== "touch") {
    stage.focus({ preventScroll: true });
    return;
  }
  const id = partAt(event);
  quietTour();
  if (!id || id === "stand") {
    select(null);
    setPlaying(!playing);
  } else select(selected === id ? null : id);
});
stage.addEventListener("focus", () => {
  spoken = "";
  describe();
});
partButtons.forEach((button) => {
  const show = () => {
    clearTimeout(leaveTimer);
    select(button.dataset.part);
  };
  const hide = () => {
    clearTimeout(leaveTimer);
    leaveTimer = setTimeout(() => {
      if (inside || partButtons.some((b) => b.matches(":hover, :focus-visible"))) return;
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
document.addEventListener("keydown", (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey || !visible) return;
  const target = event.target;
  if (target !== document.body && target !== stage && !root.contains(target)) return;
  if (target === scrubInput && event.key !== " " && event.key !== "Escape") return;
  if (target instanceof HTMLButtonElement && (event.key === " " || event.key === "Enter")) return;
  if (event.key === " ") {
    event.preventDefault();
    setPlaying(!playing);
    return;
  }
  if (event.key === "Escape") {
    event.preventDefault();
    reset();
    return;
  }
  if (target !== stage && !root.contains(target)) return;
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
});
scrubInput.addEventListener("input", () => {
  quietTour();
  playing = null;
  s = Number(scrubInput.value) / 1000;
  render();
});
playButton.addEventListener("click", () => setPlaying(!playing));

const narrow = matchMedia("(hover: none), (max-width: 480px)");
const hint = root.querySelector(".hb-hint");
const wording = () => hint && (hint.textContent = narrow.matches ? "Tap a part · tap the base to play" : "Hover a part · Space plays");
wording();
narrow.addEventListener("change", wording);
if (still.matches) touring = false;
render();
say(D.idle);
