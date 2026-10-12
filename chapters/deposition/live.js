const D = __DATA__;
const P = D.P;
const root = document.querySelector(".dz");
const stage = root.querySelector(".dz-stage");
const live = root.querySelector("[data-live]");
const readout = root.querySelector("[data-readout]");
const partButtons = [...root.querySelectorAll(".dz-part")];
const scrubInput = root.querySelector("[data-scrub]");
const playButton = root.querySelector("[data-play]");
const playText = root.querySelector("[data-play-text]");
const stepText = root.querySelector("[data-step]");
const still = matchMedia("(prefers-reduced-motion: reduce)");

const nodes = [...stage.querySelectorAll(".it")];
const armsEl = stage.querySelector('[data-dyn="arms"]');
const carryEl = stage.querySelector("#dz-carry");
const pinsEl = stage.querySelector('[data-dyn="pins"]');
const gasEl = stage.querySelector('[data-dyn="gas"]');
const valveEls = Object.fromEntries([...stage.querySelectorAll("[data-valve]")].map((el) => [el.dataset.valve, el]));

const SEGS = D.segs;
const RUN_SECONDS = 30;
let t = 0;
let selected = null;
let inside = false;
let leaveTimer = 0;
let idleTimer = 0;
let touring = !still.matches;
let tookOver = false;
let playing = false;
let hold = 0;
let visible = false;
let frame = 0;
let last = 0;
let spoken = "";
let drawn = -1;

// ---- drawing the moving parts ----
const solid = (ring, z, h, style) => solidSvg(extrude(ring, z, h, P), style);
const byDepth = (a, b) => a.z + a.h - (b.z + b.h) || depthOf([a.at[0], a.at[1], 0], P) - depthOf([b.at[0], b.at[1], 0], P);

// gas columns: one under each showerhead hole along the cut, in three rows reaching forward over the wafer
const COLUMNS = [];
for (let x = -28; x <= 28.1; x += 4) for (const [row, y] of [-3, 3, 9].entries()) if (Math.hypot(x, y) < 29) COLUMNS.push({ x: RIG.PED_X + x, y, off: ((x + 28) * 0.137 + row * 0.33) % 1 });

function filmHeight(s) {
  if (s.seg.id === "done") return D.cycles * RIG.FILM_PER;
  if (!s.seg.cycle) return 0;
  return (s.seg.cycle - 1 + s.growth) * RIG.FILM_PER;
}

function draw(s) {
  // two arms: A carries, B waits opposite
  const parts = [];
  for (const [index, theta] of [s.theta, s.theta + Math.PI].entries()) {
    const arm = armParts(theta, index === 0 ? s.d : RIG.D_RET);
    parts.push(...arm.parts);
    if (index === 1) parts.push({ ...arm.blade, tone: "mid" });
  }
  parts.sort(byDepth);
  armsEl.innerHTML = parts.map((p) => solid(p.ring, p.z, p.h, { tone: p.tone })).join("");

  // blade A and the wafer with its film
  const bladeA = armParts(s.theta, s.d).blade;
  const [wx, wy] = waferAt(s);
  const film = filmHeight(s);
  const done = Math.floor(film / RIG.FILM_PER + 1e-6);
  let carry = solid(bladeA.ring, bladeA.z, bladeA.h, { tone: "mid" });
  const waferBottom = s.waferZ;
  const wafer = solidSvg(cylinder(wx, wy, RIG.WAFER_R, waferBottom, RIG.WAFER_T, P, 64), { tone: "hi", crease: "lo" });
  const onBlade = s.wafer === "blade" || s.wafer === "ll";
  if (onBlade) carry += wafer;
  else carry = wafer + carry;
  if (film > 0.01) {
    const z0 = waferBottom + RIG.WAFER_T;
    const seams = [];
    for (let i = 1; i <= done && i * RIG.FILM_PER < film - 0.05; i++) seams.push(sideArc(wx, wy, RIG.WAFER_R - 0.6, z0 + i * RIG.FILM_PER, P, 48));
    carry += solidSvg(cylinder(wx, wy, RIG.WAFER_R - 0.6, z0, film, P, 64), { tone: "hi", lit: true, crease: "lo", inner: seams.length ? lineSvg(seams.join(""), { tone: "mid" }) : "" });
  }
  carryEl.innerHTML = carry;

  // lift pins rising out of the pedestal
  pinsEl.innerHTML = s.lift > 0.05 ? D.pins.map(([x, y]) => solidSvg(cylinder(x, y, 1.3, RIG.PED_TOP, s.lift, P, 12), { tone: "mid" })).join("") : "";

  // gas: precursor falls as dots, co-reactant as rings, purge sweeps sideways to the pumping port
  const top = D.shower.z0 - 0.5;
  const floorZ = RIG.PED_TOP + RIG.WAFER_T + film + 0.6;
  let gas = "";
  const phase = s.seg.id;
  if (phase === "pulseA" || phase === "pulseB") {
    const ring = phase === "pulseB";
    const fade = Math.min(1, s.p * 6, (1 - s.p) * 6);
    for (const c of COLUMNS) {
      const f = (s.p * 2.2 + c.off) % 1;
      const z = top - f * (top - floorZ);
      const [x, y] = iso([c.x, c.y, z], P);
      gas += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${ring ? 1.05 : 0.95}" opacity="${(fade * (0.35 + 0.65 * Math.sin(Math.PI * f))).toFixed(2)}"${ring ? " data-ring" : ""}/>`;
    }
  } else if (phase === "purgeA" || phase === "purgeB") {
    const fade = Math.min(1, s.p * 6, (1 - s.p) * 6);
    for (const c of COLUMNS) {
      const f = (s.p * 1.6 + c.off) % 1;
      const y = 26 - f * 78;
      const z = floorZ + 3 + c.off * (top - floorZ - 5);
      const [sx, sy] = iso([c.x, y, z], P);
      gas += `<circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="0.8" data-purge opacity="${(fade * (0.4 + 0.6 * Math.sin(Math.PI * f))).toFixed(2)}"/>`;
    }
  }
  gasEl.innerHTML = gas;

  const open = phase === "pulseA" ? "A" : phase === "pulseB" ? "B" : phase === "purgeA" || phase === "purgeB" ? "N" : null;
  for (const [id, el] of Object.entries(valveEls)) el.toggleAttribute("data-open", id === open);
}

// ---- words ----
function say(text) {
  if (readout.textContent !== text) readout.textContent = text;
}

function processText(s) {
  const id = s.seg.id;
  if (s.seg.cycle) return `cycle ${s.seg.cycle} of ${D.cycles} · ${s.seg.say.split(" · ")[0]} · ${((s.seg.cycle - 1) * D.gpc).toFixed(2)} → ${(s.seg.cycle * D.gpc).toFixed(2)} nm`;
  if (id === "done") return s.seg.say;
  if (id === "heat") return `heated pedestal · ${Math.round(s.temp)} °C`;
  return s.seg.say;
}

function readoutText() {
  if (selected) return D.pieces[selected].say;
  if (t <= 0.0005 && !playing) return D.idle;
  return processText(stateAt(t, SEGS));
}

function describe() {
  const s = stateAt(t, SEGS);
  const text = selected ? `${D.pieces[selected].name}: ${D.pieces[selected].say}` : t <= 0.0005 ? D.idle : `${s.seg.label}`;
  if (stage.getAttribute("aria-valuetext") !== text) stage.setAttribute("aria-valuetext", text);
  if (document.activeElement === stage && text !== spoken) {
    spoken = text;
    live.textContent = text;
  }
}

function showPlay() {
  playText.textContent = playing ? "Pause" : t >= 0.999 ? "Replay" : t > 0.0005 ? "Resume" : "Play";
  playButton.toggleAttribute("data-playing", playing);
  playButton.setAttribute("aria-label", playing ? "Pause" : "Play the run");
  const text = stateAt(t, SEGS).seg.label;
  if (stepText.textContent !== text) stepText.textContent = text;
  const value = String(Math.round(t * 1000));
  if (scrubInput.value !== value && document.activeElement !== scrubInput) scrubInput.value = value;
}

function render() {
  if (t !== drawn) {
    draw(stateAt(t, SEGS));
    drawn = t;
  }
  showPlay();
  say(readoutText());
}

// ---- selection ----
function select(id) {
  if (id === "base") id = null;
  if (selected === id) return;
  selected = id;
  for (const node of nodes) {
    if (id !== null && node.dataset.piece === id) node.setAttribute("data-on", "");
    else node.removeAttribute("data-on");
  }
  if (id) stage.setAttribute("data-focus", "");
  else stage.removeAttribute("data-focus");
  partButtons.forEach((button) => button.toggleAttribute("data-on", button.dataset.part === id));
  stage.setAttribute("aria-valuenow", String(id ? D.order.indexOf(id) + 1 : 0));
  describe();
  say(readoutText());
}

// ---- loop ----
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  let moving = false;
  if (touring || playing) {
    if (hold > 0) {
      hold -= dt;
      if (hold <= 0) t = 0;
    } else {
      t = Math.min(1, t + dt / RUN_SECONDS);
      if (t >= 1) {
        if (touring) hold = 2.4;
        else playing = false;
      }
    }
    moving = true;
    describe();
  }
  render();
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

function quietTour() {
  touring = false;
  tookOver = true;
  hold = 0;
  clearTimeout(idleTimer);
}

function idleTour() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (inside || tookOver || still.matches) return;
    touring = true;
    run();
  }, 3600);
}

function setPlaying(on) {
  quietTour();
  if (on && t >= 0.999) t = 0;
  if (on && still.matches) {
    t = 1;
    playing = false;
  } else playing = on;
  describe();
  render();
  run();
}

function reset() {
  quietTour();
  playing = false;
  select(null);
  t = 0;
  describe();
  render();
}

// ---- input ----
function pieceAt(event) {
  const hit = document.elementFromPoint(event.clientX, event.clientY);
  const item = hit && hit.closest ? hit.closest(".it") : null;
  return item ? item.dataset.piece : null;
}

stage.addEventListener("pointermove", (event) => {
  if (event.pointerType === "touch") return;
  inside = true;
  clearTimeout(leaveTimer);
  if (touring) touring = false;
  select(pieceAt(event));
});

stage.addEventListener("pointerleave", () => {
  inside = false;
  clearTimeout(leaveTimer);
  leaveTimer = setTimeout(() => {
    if (inside) return;
    select(null);
    if (!tookOver) idleTour();
  }, 260);
});

stage.addEventListener("pointerdown", (event) => {
  if (event.pointerType !== "touch") {
    stage.focus({ preventScroll: true });
    return;
  }
  const id = pieceAt(event);
  quietTour();
  if (!id || id === "base" || id === selected) {
    select(null);
    setPlaying(!playing);
  } else select(id);
});

partButtons.forEach((button) => {
  const show = () => {
    quietTour();
    clearTimeout(leaveTimer);
    select(button.dataset.part);
  };
  const hide = () => {
    clearTimeout(leaveTimer);
    leaveTimer = setTimeout(() => {
      if (inside || partButtons.some((other) => other.matches(":hover, :focus-visible"))) return;
      select(null);
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

document.addEventListener("keydown", (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey || !visible) return;
  const target = event.target;
  if (target !== document.body && target !== stage && !root.contains(target)) return;
  if (target === scrubInput && event.key !== " " && event.key !== "Escape") return;
  if (target instanceof HTMLButtonElement && (event.key === " " || event.key === "Enter")) return;
  if (event.key === "Escape") {
    event.preventDefault();
    reset();
    return;
  }
  if (event.key === " ") {
    event.preventDefault();
    setPlaying(!playing);
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
  select(D.order[next]);
});

scrubInput.addEventListener("input", () => {
  quietTour();
  playing = false;
  select(null);
  t = Number(scrubInput.value) / 1000;
  describe();
  render();
});

playButton.addEventListener("click", () => {
  select(null);
  setPlaying(!playing);
});

document.addEventListener("themechange", () => {
  drawn = -1;
  render();
});

const narrow = matchMedia("(hover: none), (max-width: 480px)");
const hint = root.querySelector(".dz-hint");
const wording = () => hint && (hint.textContent = narrow.matches ? "Tap a chamber · tap the floor to play" : "Hover a chamber · Space plays the run");
wording();
narrow.addEventListener("change", wording);
render();
