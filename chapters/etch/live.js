const D = __DATA__;
const root = document.querySelector(".et");
const stage = root.querySelector(".et-stage");
const layers = stage.querySelector(".et-layers");
const live = root.querySelector("[data-live]");
const readout = root.querySelector("[data-readout]");
const partButtons = [...root.querySelectorAll(".et-part")];
const scrubInput = root.querySelector("[data-scrub]");
const playButton = root.querySelector("[data-play]");
const playText = root.querySelector("[data-play-text]");
const stepText = root.querySelector("[data-step]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const SVGNS = "http://www.w3.org/2000/svg";

const items = [...layers.querySelectorAll(".it")];
const plasma = root.querySelector("[data-plasma]");
const glow = plasma.querySelector(".et-glow");
const core = plasma.querySelector(".et-glow-core");
const pool = plasma.querySelector("[data-particles]");
const film = root.querySelector("[data-film]");
const mask = root.querySelector("[data-mask]");
const pass = root.querySelector("[data-pass]");
const ionBox = root.querySelector("[data-ions]");
const trace = root.querySelector("[data-trace]");
const head = root.querySelector("[data-head]");
const arText = root.querySelector("[data-ar]");
const passLabel = root.querySelector("[data-pass-label]");

const N = D.steps.length;
const SECONDS = 4.2; // per step while playing
const G = D.glow;

let s = 0; // process position 0..1
let selected = null;
let playing = false;
let touring = !still.matches;
let tourHold = -1.4; // the tour waits a moment before it starts
let visible = false;
let frame = 0;
let last = 0;
let clock = 0;
let spokenStep = -1;

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const proj = (x, y, z) => [D.O[0] + D.EX[0] * x + D.EY[0] * y + D.EZ[0] * z, D.O[1] + D.EX[1] * x + D.EY[1] * y + D.EZ[1] * z];

// fixed pseudo-random seeds so every visit looks the same
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
function makeDots(count, cls, r) {
  return Array.from({ length: count }, () => {
    const el = document.createElementNS(SVGNS, "circle");
    el.setAttribute("class", cls);
    el.setAttribute("r", r);
    el.setAttribute("opacity", "0");
    pool.appendChild(el);
    return { el, a: -Math.PI * (0.04 + 0.92 * rnd()), q: Math.sqrt(rnd()), p: rnd(), shown: -1 };
  });
}
const air = makeDots(36, "et-gasdot", 1.1);
const gas = makeDots(30, "et-gasdot", 1.1);
const ions = makeDots(40, "et-ion", 0.9);

const insetIons = Array.from({ length: 9 }, (_, i) => {
  const el = document.createElementNS(SVGNS, "circle");
  el.setAttribute("class", "et-in-ion");
  el.setAttribute("r", "1.2");
  el.setAttribute("opacity", "0");
  ionBox.appendChild(el);
  return { el, x: [58, 110, 162][i % 3] + ((i * 5) % 9) - 4, p: (i * 0.37) % 1 };
});

function stepIndex(v) {
  return Math.min(N - 1, Math.floor(v * N));
}

function phases(v) {
  const u = v * N;
  return {
    u,
    air: u < 1 ? Math.exp(-4.2 * u) : 0,
    gas: smooth(1, 1.35, u) * (1 - smooth(6.85, 7, u)),
    plasma: smooth(2, 2.35, u) * (1 - smooth(6.85, 7, u)),
    bias: smooth(3, 3.2, u) * (1 - smooth(5.9, 6, u)),
    depth: clamp((u - 3.2) / 1.8),
    strip: smooth(6, 6.8, u),
  };
}

function pressureText(u) {
  if (u < 1) {
    // illustrative: from transfer-module pressure down to base, log-linear, settling in the last fifth of the step
    const mt = D.transfer * Math.pow(D.base / D.transfer, Math.min(1, u / 0.8));
    return `${mt.toFixed(mt >= 10 ? 0 : mt >= 1 ? 1 : 2)} mTorr`;
  }
  return `${D.setpoint} mTorr`;
}

function say(text) {
  if (readout.textContent !== text) readout.textContent = text;
}

function select(id) {
  if (id === "stand") id = null;
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

const RUN = { pump: "pump", gas: "window", strike: "coil", bias: "chuck", etch: "chuck.wafer", endpoint: "oes", strip: "chuck.wafer" };
let running = "";
function markRun(key) {
  if (key === running) return;
  running = key;
  for (const el of items) {
    const on = key && (el.dataset.piece === key || el.dataset.name === key);
    if (on) el.setAttribute("data-run", "");
    else el.removeAttribute("data-run");
  }
}

function drawParticles(ph) {
  const calm = still.matches;
  const t = clock;
  const place = (d, x, y, z, o) => {
    const [sx, sy] = proj(x, y, z);
    d.el.setAttribute("cx", sx.toFixed(1));
    d.el.setAttribute("cy", sy.toFixed(1));
    const op = Math.round(o * 100) / 100;
    if (op !== d.shown) {
      d.shown = op;
      d.el.setAttribute("opacity", String(op));
    }
  };
  const hide = (d) => {
    if (d.shown !== 0) {
      d.shown = 0;
      d.el.setAttribute("opacity", "0");
    }
  };
  // air: drifts outward and down to the baffle and is pumped away
  air.forEach((d, i) => {
    const alive = i / air.length < ph.air;
    if (calm || !alive) return hide(d);
    const p = (d.p + t * 0.22) % 1;
    const r = G.r * (0.15 + 0.8 * d.q + 0.1 * p);
    const z = G.z1 - 4 - p * (G.z1 - G.z0 - 6);
    place(d, Math.min(G.r - 2, r) * Math.cos(d.a), Math.min(G.r - 2, r) * Math.sin(d.a), z, 0.85 * Math.sin(Math.PI * p));
  });
  // gas: leaves the injector and spreads down toward the wafer
  const gasSeen = ph.gas * (1 - 0.55 * ph.plasma);
  gas.forEach((d) => {
    if (calm || gasSeen <= 0.01) return hide(d);
    const p = (d.p + t * 0.3) % 1;
    const r = (G.r - 4) * d.q * Math.min(1, p * 1.6);
    const z = G.z1 - 1 - p * (G.z1 - G.z0 - 4);
    place(d, r * Math.cos(d.a), r * Math.sin(d.a) - 8 * (1 - p), z, gasSeen * Math.sin(Math.PI * p));
  });
  // ions: fall straight down through the sheath onto the wafer
  ions.forEach((d) => {
    if (calm || ph.bias <= 0.01) return hide(d);
    const p = (d.p + t * 1.1) % 1;
    const r = (G.r - 30) * d.q;
    const z = G.z0 + 22 - p * 21;
    place(d, r * Math.cos(d.a), r * Math.sin(d.a), z, ph.bias * Math.min(1, (1 - p) * 4) * Math.min(1, p * 5));
  });
}

function drawInset(ph) {
  const d = 48 * ph.depth;
  const xs = [58, 110, 162];
  const hw = 9;
  let f = "M14 108V60";
  for (const x of xs) f += `H${x - hw}V${(60 + d).toFixed(1)}H${x + hw}V60`;
  film.setAttribute("d", `${f}H206V108Z`);
  const mt = 12 * (1 - ph.strip);
  if (mt < 0.2) mask.setAttribute("d", "");
  else {
    const edges = [14, ...xs.flatMap((x) => [x - hw, x + hw]), 206];
    let m = "";
    for (let i = 0; i < edges.length; i += 2) m += `M${edges[i]} 60V${(60 - mt).toFixed(1)}H${edges[i + 1]}V60Z`;
    mask.setAttribute("d", m);
  }
  const pw = 1.8 * (1 - ph.strip);
  const ph2 = Math.max(0, d - 3);
  if (pw < 0.1 || ph2 < 0.5) pass.setAttribute("d", "");
  else pass.setAttribute("d", xs.map((x) => `M${x - hw} 60h${pw.toFixed(2)}v${ph2.toFixed(1)}h${(-pw).toFixed(2)}ZM${x + hw} 60h${(-pw).toFixed(2)}v${ph2.toFixed(1)}h${pw.toFixed(2)}Z`).join(""));
  const ar = d / (2 * hw);
  arText.textContent = d > 0.5 ? `depth : width ${ar.toFixed(1)} : 1` : "";
  passLabel.setAttribute("opacity", pw >= 0.1 && ph2 >= 6 ? "1" : "0");
  // ions into the openings
  insetIons.forEach((ion) => {
    if (still.matches || ph.bias <= 0.01) return ion.el.setAttribute("opacity", "0");
    const p = (ion.p + clock * 0.9) % 1;
    const y = 41 + p * (19 + d);
    ion.el.setAttribute("cx", String(ion.x));
    ion.el.setAttribute("cy", y.toFixed(1));
    ion.el.setAttribute("opacity", (ph.bias * Math.min(1, (1 - p) * 5)).toFixed(2));
  });
  // OES trace: the product line (Si), recorded from plasma-on to the end of the etch
  const level = (u) => 0.18 * smooth(2, 2.3, u) + 0.72 * smooth(3.1, 3.5, u) * (1 - smooth(5, 5.3, u));
  const xOf = (u) => 18 + ((u - 2) / 4) * 186;
  const yOf = (u) => 186 - level(u) * 34;
  const end = Math.min(ph.u, 6);
  if (end <= 2) {
    trace.setAttribute("d", "M18 186");
    head.setAttribute("cx", "18");
    head.setAttribute("cy", "186");
    return;
  }
  let t = "M18 186";
  for (let u = 2.02; u < end; u += 0.02) t += `L${xOf(u).toFixed(1)} ${yOf(u).toFixed(1)}`;
  t += `L${xOf(end).toFixed(1)} ${yOf(end).toFixed(1)}`;
  trace.setAttribute("d", t);
  head.setAttribute("cx", xOf(end).toFixed(1));
  head.setAttribute("cy", yOf(end).toFixed(1));
}

function draw() {
  const ph = phases(s);
  const i = stepIndex(s);
  const step = D.steps[i];
  const show = Math.max(ph.plasma, selected === "plasma" ? 0.6 : 0);
  glow.style.opacity = show.toFixed(3);
  core.style.opacity = (show * (0.55 + 0.45 * ph.strip)).toFixed(3);
  drawParticles(ph);
  drawInset(ph);
  markRun(selected ? "" : RUN[step.id]);
  const done = s >= 0.999;
  let text;
  if (selected) text = D.parts[selected].say;
  else if (s <= 0.0005 && !playing && !touring) text = D.idle;
  else if (step.id === "pump") text = `pumping to base · ${pressureText(ph.u)}`;
  else if (done) text = "resist stripped · wafer ready to leave";
  else text = step.say;
  say(text);
  const label = `${String(i + 1).padStart(2, "0")} · ${step.name}`;
  if (stepText.textContent !== label) stepText.textContent = label;
  playText.textContent = playing ? "Pause" : done ? "Replay" : "Play";
  playButton.toggleAttribute("data-playing", playing);
  playButton.setAttribute("aria-label", playing ? "Pause the etch" : "Play the etch");
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
  const ph = phases(s);
  if (playing || touring) return true;
  return s > 0.0005 && (ph.air > 0.01 || ph.gas > 0.01 || ph.bias > 0.01);
}

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  clock += dt;
  if (touring && tourHold < 0) tourHold = Math.min(0, tourHold + dt);
  else if (touring) {
    if (s >= 1) {
      tourHold += dt;
      if (tourHold > 2.4) {
        s = 0;
        tourHold = 0;
      }
    } else s = Math.min(1, s + dt / (SECONDS * N));
  } else if (playing) {
    s = Math.min(1, s + dt / (SECONDS * N));
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
    s = Math.min(1, (stepIndex(s) + 1) / N);
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
  return item ? item.dataset.piece : null;
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
  const show = () => {
    takeOver();
    clearTimeout(leaveTimer);
    select(button.dataset.part);
    draw();
    run();
  };
  const hide = () => {
    clearTimeout(leaveTimer);
    leaveTimer = setTimeout(() => {
      if (partButtons.some((other) => other.matches(":hover, :focus-visible"))) return;
      select(null);
      draw();
    }, 260);
  };
  button.addEventListener("pointerenter", show);
  button.addEventListener("focus", show);
  button.addEventListener("pointerleave", hide);
  button.addEventListener("blur", hide);
  button.addEventListener("click", show);
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
const hint = root.querySelector(".et-hint");
const wording = () => hint && (hint.textContent = narrow.matches ? "Tap a part · drag the slider" : "Hover a part · Space plays the etch");
wording();
narrow.addEventListener("change", wording);
draw();
