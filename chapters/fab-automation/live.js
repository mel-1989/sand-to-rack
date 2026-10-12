const D = __DATA__;
const root = document.querySelector(".fa");
const stage = root.querySelector(".fa-stage");
const layers = stage.querySelector(".fa-layers");
const live = root.querySelector("[data-live]");
const readout = root.querySelector("[data-readout]");
const partButtons = [...root.querySelectorAll(".fa-part")];
const scrubInput = root.querySelector("[data-scrub]");
const playButton = root.querySelector("[data-play]");
const playText = root.querySelector("[data-play-text]");
const stepText = root.querySelector("[data-step]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const PJ = D.P;

const nodes = [...layers.querySelectorAll(".it")].map((el) => ({ el, piece: el.dataset.piece, mv: el.dataset.mv || "", key: Number(el.dataset.k), shown: "" }));
let order = nodes.map((_, index) => index);
const dyn = (name) => layers.querySelector(`[data-dyn="${name}"]`);
const armG = dyn("arm");
const waferA = dyn("waferA");
const beltG = dyn("belts");
const slotWafer = layers.querySelector("[data-slot]");
const inside = layers.querySelector("[data-inside]");
const gateG = layers.querySelector("[data-gate]");
const lamps = [...layers.querySelectorAll("[data-lamp]")];

const TOTAL = D.T.steps.reduce((sum, step) => sum + step.sec, 0);
let s = 0; // slider position 0..1
let playing = !still.matches;
let touring = playing;
let selected = null;
let visible = false;
let frame = 0;
let last = 0;
let inside_ = false;
let leaveTimer = 0;
let shownPose = "";
let spoken = "";
let hoverPaused = false;

// ---- the robot arm, rebuilt from the kit each frame ----
const A = D.arm;
function stadium(a, b, w, steps = 10) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const ang = Math.atan2(dy, dx);
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = ang + Math.PI / 2 + (i / steps) * Math.PI;
    pts.push([a[0] + w * Math.cos(t), a[1] + w * Math.sin(t)]);
  }
  for (let i = 0; i <= steps; i++) {
    const t = ang - Math.PI / 2 + (i / steps) * Math.PI;
    pts.push([b[0] + w * Math.cos(t), b[1] + w * Math.sin(t)]);
  }
  return pts;
}
function forkRing(w, u) {
  const n = [-u[1], u[0]];
  const p = (along, side) => [w[0] + u[0] * along + n[0] * side, w[1] + u[1] * along + n[1] * side];
  return [p(-3, -5), p(16, -5), p(A.fork + 9, -6.5), p(A.fork + 11, -5.2), p(A.fork + 11, -2.6), p(18, -2.2), p(18, 2.2), p(A.fork + 11, 2.6), p(A.fork + 11, 5.2), p(A.fork + 9, 6.5), p(16, 5), p(-3, 5)];
}
const solid = (paths, style) => solidSvg(paths, style);
function armPose(p) {
  const [bx, by] = A.shoulder;
  const u = [Math.cos(p.th), Math.sin(p.th)];
  const n = [-u[1], u[0]];
  const half = p.r / 2;
  const h = Math.sqrt(Math.max(0, A.link * A.link - half * half));
  const elbow = [bx + u[0] * half + n[0] * h, by + u[1] * half + n[1] * h];
  const wrist = [bx + u[0] * p.r, by + u[1] * p.r];
  const z = 99 + p.lift;
  const link1 = solid(extrude(stadium([bx, by], elbow, 4.6), z, 3.4, PJ, { bevel: 0.3 }), { tone: "mid" });
  const hub1 = solid(cylinder(elbow[0], elbow[1], 2.4, z + 3.4, 0.4, PJ, 16), { tone: "mid" });
  const link2 = solid(extrude(stadium(elbow, wrist, 3.8), z + 3.4, 3.2, PJ, { bevel: 0.3 }), { tone: "mid" });
  const fork = solid(extrude(forkRing(wrist, u), A.forkZ + p.lift, 0.4, PJ, { convex: false }), { tone: "hi", crease: "lo" });
  const wc = [wrist[0] + u[0] * A.fork, wrist[1] + u[1] * A.fork];
  const wafer = p.wafer === "arm" ? solid(cylinder(wc[0], wc[1], A.waferR, A.forkZ + 0.4 + p.lift, 0.4, PJ, 64), { tone: "hi", lit: true }) : "";
  const pads = [-5.6, 5.6].map((side) => [wrist[0] + u[0] * (A.fork + 9.6) + n[0] * side, wrist[1] + u[1] * (A.fork + 9.6) + n[1] * side]);
  const padDots = p.wafer === "arm" ? "" : dotsSvg(pads.map(([x, y]) => iso([x, y, A.forkZ + 0.4 + p.lift], PJ)), { size: 0.45 });
  const front = fork + padDots + wafer;
  return { links: link1 + hub1 + link2, front };
}

function beltSvg(gz) {
  // the gripper group is recorded hoisted (gz = lift); belts run from its plate up to the housing
  const drop = gz - D.belts.lift;
  const len = D.belts.top - D.belts.grip - drop;
  if (len < 0.6) return "";
  return D.belts.at
    .map(([x, y]) => {
      const a = iso([x, y, D.belts.grip - 0.5], PJ);
      const b = iso([x, y, D.belts.top - drop + 0.5], PJ);
      return `<path class="fa-belt" d="M${a[0].toFixed(2)} ${a[1].toFixed(2)}L${b[0].toFixed(2)} ${b[1].toFixed(2)}"/>`;
    })
    .join("");
}

function screenOf([x, y, z]) {
  return [D.EX[0] * x + D.EY[0] * y + D.EZ[0] * z, D.EX[1] * x + D.EY[1] * y + D.EZ[1] * z];
}

function render() {
  const p = poseAt(s, D.T);
  const off = offsetsOf(p, D.T);
  // groups that move with the OHT and the port door
  for (const node of nodes) {
    if (!node.mv) continue;
    const o = off[node.mv];
    const [tx, ty] = screenOf(o);
    const text = Math.abs(tx) + Math.abs(ty) < 0.005 ? "" : `translate(${tx.toFixed(2)} ${ty.toFixed(2)})`;
    if (text !== node.shown) {
      node.shown = text;
      if (text) node.el.setAttribute("transform", text);
      else node.el.removeAttribute("transform");
    }
  }
  const keyOf = (node) => node.key + (node.mv ? off[node.mv][0] * D.V[0] + off[node.mv][1] * D.V[1] + off[node.mv][2] * D.V[2] : 0);
  const next = nodes.map((_, index) => index).sort((a, b) => keyOf(nodes[a]) - keyOf(nodes[b]) || a - b);
  if (next.some((index, at) => index !== order[at])) {
    const fragment = document.createDocumentFragment();
    for (const index of next) fragment.appendChild(nodes[index].el);
    layers.appendChild(fragment);
    order = next;
  }
  const key = [p.th, p.r, p.lift, p.wafer, p.gz, p.gate, p.lamp, off.foup[0], off.foup[1], off.foup[2]].map((v) => (typeof v === "number" ? v.toFixed(3) : v)).join("|");
  if (key !== shownPose) {
    shownPose = key;
    const arm = armPose(p);
    armG.innerHTML = `${arm.links}<g clip-path="url(#fa-front)">${arm.front}</g>`;
    waferA.innerHTML = arm.front;
    beltG.innerHTML = beltSvg(p.gz);
    slotWafer.style.visibility = p.wafer === "foup" ? "" : "hidden";
    inside.style.visibility = Math.abs(off.foup[0]) + Math.abs(off.foup[1]) + Math.abs(off.foup[2]) < 0.01 ? "" : "hidden";
    const [gx, gy] = screenOf([0, 0, D.gate.close * p.gate]);
    if (p.gate > 0.001) gateG.setAttribute("transform", `translate(${gx.toFixed(2)} ${gy.toFixed(2)})`);
    else gateG.removeAttribute("transform");
    for (const lamp of lamps) lamp.toggleAttribute("data-on", p.lamp > 0.5);
  }
  return p;
}

function stepLabel(index) {
  return `${String(index + 1).padStart(2, "0")} · ${D.steps[index].name}`;
}

function say(text) {
  if (readout.textContent !== text) readout.textContent = text;
}

function describe(p) {
  const text = selected ? `${D.parts[selected].name}: ${D.parts[selected].say}` : `${D.steps[p.index].name}: ${D.steps[p.index].say}`;
  if (stage.getAttribute("aria-valuetext") !== text) stage.setAttribute("aria-valuetext", text);
  if (document.activeElement === stage && text !== spoken && !playing) {
    spoken = text;
    live.textContent = text;
  }
}

function show() {
  const p = render();
  const label = stepLabel(p.index);
  if (stepText.textContent !== label) stepText.textContent = label;
  scrubInput.value = String(Math.round(s * 1000));
  playText.textContent = playing ? "Pause" : s >= 0.999 ? "Replay" : "Play";
  playButton.toggleAttribute("data-playing", playing);
  playButton.setAttribute("aria-label", playing ? "Pause the trip" : "Play the trip");
  say(selected ? D.parts[selected].say : D.steps[p.index].say);
  describe(p);
}

function select(id) {
  if (selected === id) return;
  selected = id;
  for (const node of nodes) {
    if (id && node.piece === id) node.el.setAttribute("data-on", "");
    else node.el.removeAttribute("data-on");
  }
  if (id) stage.setAttribute("data-focus", "");
  else stage.removeAttribute("data-focus");
  partButtons.forEach((button) => button.toggleAttribute("data-on", button.dataset.part === id));
  stage.setAttribute("aria-valuenow", String(id ? D.order.indexOf(id) + 1 : 0));
  show();
}

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  if (playing) {
    s += dt / TOTAL;
    if (s >= 1) {
      if (touring) s = 0;
      else {
        s = 1;
        playing = false;
      }
    }
  }
  show();
  frame = visible && playing ? requestAnimationFrame(tick) : 0;
}

function run() {
  if (!frame && visible && playing) {
    last = 0;
    frame = requestAnimationFrame(tick);
  }
}

function takeOver() {
  // the first interaction ends the idle tour, and the tour's playback with it
  if (touring && playing) playing = false;
  hoverPaused = false;
  touring = false;
}

function setPlaying(on) {
  playing = on;
  if (on && s >= 0.999) s = 0;
  if (on && still.matches) {
    // reduced motion: jump to the middle of the next step (a moment that shows the step at work) instead of animating
    playing = false;
    let acc = 0;
    let next = 1;
    for (const step of D.T.steps) {
      const mid = acc + (0.5 * step.sec) / TOTAL;
      acc += step.sec / TOTAL;
      if (mid > s + 1e-4) {
        next = mid;
        break;
      }
    }
    s = next;
  }
  show();
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
  return item ? item.dataset.piece : null;
}

stage.addEventListener("pointermove", (event) => {
  if (event.pointerType === "touch") return;
  inside_ = true;
  clearTimeout(leaveTimer);
  if (touring && playing) {
    // the idle tour pauses under the pointer and resumes when it leaves
    playing = false;
    hoverPaused = true;
  }
  select(pieceAt(event));
  show();
});

stage.addEventListener("pointerleave", () => {
  inside_ = false;
  clearTimeout(leaveTimer);
  leaveTimer = setTimeout(() => {
    if (inside_) return;
    select(null);
    if (hoverPaused && touring) {
      hoverPaused = false;
      playing = true;
      run();
    }
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
});

partButtons.forEach((button) => {
  const on = () => {
    takeOver();
    clearTimeout(leaveTimer);
    select(button.dataset.part);
  };
  const off = () => {
    clearTimeout(leaveTimer);
    leaveTimer = setTimeout(() => {
      if (inside_ || partButtons.some((other) => other.matches(":hover, :focus-visible"))) return;
      select(null);
    }, 260);
  };
  button.addEventListener("pointerenter", on);
  button.addEventListener("focus", on);
  button.addEventListener("pointerleave", off);
  button.addEventListener("blur", off);
  button.addEventListener("click", on);
});

stage.addEventListener("focus", () => {
  spoken = "";
  describe(poseAt(s, D.T));
});

document.addEventListener("keydown", (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey || !visible) return;
  const target = event.target;
  if (target !== document.body && target !== stage && !root.contains(target)) return;
  if (target === scrubInput && event.key !== " " && event.key !== "Escape") return;
  if (target instanceof HTMLButtonElement && (event.key === " " || event.key === "Enter")) return;
  if (event.key === " ") {
    event.preventDefault();
    const was = playing;
    takeOver();
    setPlaying(!was);
    return;
  }
  if (event.key === "Escape") {
    event.preventDefault();
    takeOver();
    playing = false;
    s = 0;
    select(null);
    show();
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
  s = Number(scrubInput.value) / 1000;
  show();
});

playButton.addEventListener("click", () => {
  const was = playing;
  takeOver();
  setPlaying(!was);
});

const narrow = matchMedia("(hover: none), (max-width: 480px)");
const hint = root.querySelector(".fa-hint");
const wording = () => hint && (hint.textContent = narrow.matches ? "Tap a part · Play runs the trip" : "Hover a part · Space plays the trip");
wording();
narrow.addEventListener("change", wording);
if (still.matches) s = 0.56; // reduced motion rests on a representative moment: the wafer on its way into the tool
show();
