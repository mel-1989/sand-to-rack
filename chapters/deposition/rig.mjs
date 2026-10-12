// The moving parts of the cluster tool as pure functions of slider time. The build imports this to draw the
// rest pose; live.js gets the same source inlined (with "export" stripped), so page and build always agree.
// Plan units are 5 mm; heights are not to scale.

export const RIG = {
  L1: 74, // upper arm, hub to elbow
  L2: 74, // forearm, elbow to wrist
  BLADE: 40, // wrist to wafer centre
  D_RET: 20, // wrist radius when retracted
  D_LL: 116, // wrist radius with the wafer centred in the load lock (x = -156)
  D_CH: 141, // wrist radius with the wafer centred over the pedestal (x = 181)
  HUB_TOP: 44,
  Z_UP: [44, 47],
  Z_FORE: [47, 50],
  Z_BLADE: [50, 51.2],
  PED_X: 181,
  PED_TOP: 46,
  PIN_R: 20, // pin circle radius
  PIN_UP: 8, // how far the lift pins rise above the pedestal
  WAFER_R: 30,
  WAFER_T: 1, // drawn thickness (exaggerated)
  FILM_PER: 0.5, // drawn film per ALD cycle (hugely exaggerated)
  LL_X: -156,
  GAP_TOP: 64, // showerhead underside
};

const ease = (p) => {
  const c = Math.min(1, Math.max(0, p));
  return c * c * (3 - 2 * c);
};
const lerp = (a, b, p) => a + (b - a) * p;

// Segments: [{ id, label, say, cycle, from, to }] with from/to in 0..1, built in build.mjs from the model.
export function segmentAt(t, segs) {
  for (const seg of segs) if (t < seg.to) return seg;
  return segs[segs.length - 1];
}

export function stateAt(t, segs) {
  const seg = segmentAt(t, segs);
  const p = seg.to > seg.from ? Math.min(1, Math.max(0, (t - seg.from) / (seg.to - seg.from))) : 1;
  const index = segs.indexOf(seg);
  const before = (id) => segs.findIndex((s) => s.id === id) < index;
  const s = { seg, p, theta: Math.PI, d: RIG.D_RET, wafer: "ll", waferZ: RIG.Z_BLADE[1] + 0.8, lift: 0, temp: 25, cycles: 0, growth: 0, phase: null };
  const blade = RIG.Z_BLADE[1];
  if (seg.id === "pick") {
    if (p < 0.45) s.d = lerp(RIG.D_RET, RIG.D_LL, ease(p / 0.45));
    else if (p < 0.55) {
      s.d = RIG.D_LL;
      s.wafer = p < 0.5 ? "ll" : "blade";
    } else {
      s.d = lerp(RIG.D_LL, RIG.D_RET, ease((p - 0.55) / 0.45));
      s.wafer = "blade";
    }
    if (s.wafer === "blade") s.waferZ = blade;
  } else if (seg.id === "swing") {
    s.theta = Math.PI + Math.PI * ease(p);
    s.wafer = "blade";
    s.waferZ = blade;
  } else if (seg.id === "place") {
    s.theta = 2 * Math.PI;
    s.d = lerp(RIG.D_RET, RIG.D_CH, ease(p));
    s.wafer = "blade";
    s.waferZ = blade;
  } else if (seg.id === "pins") {
    s.theta = 2 * Math.PI;
    if (p < 0.3) {
      s.d = RIG.D_CH;
      s.lift = RIG.PIN_UP * ease(p / 0.3);
    } else if (p < 0.7) {
      s.d = lerp(RIG.D_CH, RIG.D_RET, ease((p - 0.3) / 0.4));
      s.lift = RIG.PIN_UP;
    } else {
      s.d = RIG.D_RET;
      s.lift = RIG.PIN_UP * (1 - ease((p - 0.7) / 0.3));
    }
    const pinTop = RIG.PED_TOP + s.lift;
    s.wafer = pinTop > blade ? "pins" : s.d > RIG.D_CH - 1 ? "blade" : "ped";
    s.waferZ = Math.max(pinTop, s.wafer === "blade" ? blade : pinTop);
    if (p >= 0.3) s.wafer = "pins";
  } else if (before("pins")) {
    s.theta = 2 * Math.PI;
    s.wafer = "ped";
    s.waferZ = RIG.PED_TOP;
  }
  if (seg.id === "heat") s.temp = lerp(25, 300, ease(p));
  else if (before("heat")) s.temp = 300;
  if (seg.cycle) {
    s.cycles = seg.cycle - 1;
    s.phase = seg.id;
    if (seg.id === "pulseA") s.growth = 0.5 * ease(p);
    else if (seg.id === "purgeA") s.growth = 0.5;
    else if (seg.id === "pulseB") s.growth = 0.5 + 0.5 * ease(p);
    else s.growth = 1;
    if (seg.id === "purgeB" && p >= 0.999) s.cycles += 1;
  }
  if (seg.id === "done") s.cycles = segs.filter((x) => x.id === "purgeB").length;
  return s;
}

// A stadium: the hull of two circles of radius r at a and b, as a floor ring.
export function stadium(a, b, r, steps = 9) {
  const phi = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const ring = [];
  for (let i = 0; i <= steps; i++) {
    const t = phi - Math.PI / 2 + (Math.PI * i) / steps;
    ring.push([b[0] + r * Math.cos(t), b[1] + r * Math.sin(t)]);
  }
  for (let i = 0; i <= steps; i++) {
    const t = phi + Math.PI / 2 + (Math.PI * i) / steps;
    ring.push([a[0] + r * Math.cos(t), a[1] + r * Math.sin(t)]);
  }
  return ring;
}

// One SCARA arm: links and joint caps as { ring, z, h, tone }, plus its blade ring.
export function armParts(theta, d) {
  const alpha = Math.acos(Math.min(1, d / (RIG.L1 + RIG.L2)));
  const elbow = [RIG.L1 * Math.cos(theta + alpha), RIG.L1 * Math.sin(theta + alpha)];
  const wrist = [d * Math.cos(theta), d * Math.sin(theta)];
  const tip = [(d + RIG.BLADE + 16) * Math.cos(theta), (d + RIG.BLADE + 16) * Math.sin(theta)];
  const circle = (c, r, n = 20) => Array.from({ length: n }, (_, i) => [c[0] + r * Math.cos((i / n) * 2 * Math.PI), c[1] + r * Math.sin((i / n) * 2 * Math.PI)]);
  const parts = [
    { ring: stadium([0, 0], elbow, 9), z: RIG.Z_UP[0], h: RIG.Z_UP[1] - RIG.Z_UP[0], tone: "mid", at: [elbow[0] / 2, elbow[1] / 2] },
    { ring: stadium(elbow, wrist, 7), z: RIG.Z_FORE[0], h: RIG.Z_FORE[1] - RIG.Z_FORE[0], tone: "mid", at: [(elbow[0] + wrist[0]) / 2, (elbow[1] + wrist[1]) / 2] },
    { ring: circle(elbow, 4.2), z: RIG.Z_FORE[1], h: 0.8, tone: "mid", at: elbow },
    { ring: circle(wrist, 5), z: RIG.Z_FORE[1], h: 0.01, tone: "mid", at: wrist },
    { ring: circle([0, 0], 11, 28), z: RIG.Z_UP[1], h: 1.6, tone: "mid", at: [0, 0] },
  ];
  return { parts, blade: { ring: stadium(wrist, tip, 6), z: RIG.Z_BLADE[0], h: RIG.Z_BLADE[1] - RIG.Z_BLADE[0], at: [(wrist[0] + tip[0]) / 2, (wrist[1] + tip[1]) / 2] }, wrist, elbow };
}

// Where the wafer centre is.
export function waferAt(s) {
  if (s.wafer === "ll") return [RIG.LL_X, 0];
  if (s.wafer === "blade") {
    const r = s.d + RIG.BLADE;
    return [r * Math.cos(s.theta), r * Math.sin(s.theta)];
  }
  return [RIG.PED_X, 0];
}
