// The wafer's trip as a pure function of the slider: poseAt(s, T) with s in 0..1.
// T = { steps: [{ sec }], drop, foupReach, toolReach }. Shared by build.mjs (sampled for depth order) and live.js (inlined).
// Offsets are world units (10 mm); the build pose is: vehicle over the port, FOUP seated, gripper on its flange, door shut.
function poseAt(s, T) {
  const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
  const span = (u, a, b) => ease((u - a) / (b - a));
  const lerp = (a, b, f) => a + (b - a) * f;
  const total = T.steps.reduce((sum, step) => sum + step.sec, 0);
  let t = Math.min(Math.max(s, 0), 1) * total;
  let index = 0;
  while (index < T.steps.length - 1 && t > T.steps[index].sec) t -= T.steps[index++].sec;
  const u = Math.min(1, t / T.steps[index].sec);
  const id = T.steps[index].id;
  const D = T.drop;
  const P = { index, u, vy: 0, fz: 0, gz: 0, carried: false, dx: 0, dz: 0, th: 0, r: 0, lift: 0, wafer: "foup", gate: 0, lamp: 0 };
  const HOME = 0;
  const FOUP = Math.PI;
  const TOOL = 1.5 * Math.PI;
  if (id === "stocker") Object.assign(P, { vy: 80, fz: D, gz: D, carried: true });
  else if (id === "travel") Object.assign(P, { vy: lerp(80, 0, span(u, 0, 1)), fz: D, gz: D, carried: true });
  else if (id === "lower") Object.assign(P, { fz: lerp(D, 0, span(u, 0, 1)), gz: lerp(D, 0, span(u, 0, 1)), carried: true });
  else if (id === "release") Object.assign(P, { gz: lerp(0, D, span(u, 0.15, 1)) });
  else P.gz = D;
  if (id === "door") Object.assign(P, { dx: 6 * span(u, 0, 0.35), dz: -34 * span(u, 0.4, 1) });
  if (["pick", "into", "process", "back"].includes(id)) Object.assign(P, { dx: 6, dz: -34 });
  if (id === "pick") {
    P.th = lerp(HOME, FOUP, span(u, 0, 0.22));
    P.r = lerp(0, T.foupReach, span(u, 0.24, 0.5)) * (1 - span(u, 0.62, 0.88));
    P.lift = 0.6 * span(u, 0.52, 0.6);
    P.wafer = u > 0.56 ? "arm" : "foup";
  } else if (id === "into") {
    P.th = lerp(FOUP, TOOL, span(u, 0, 0.3));
    P.r = lerp(0, T.toolReach, span(u, 0.3, 0.62)) * (1 - span(u, 0.76, 1));
    P.lift = 0.6 * (1 - span(u, 0.64, 0.74));
    P.wafer = u > 0.7 ? "tool" : "arm";
  } else if (id === "process") {
    P.th = TOOL;
    P.wafer = "tool";
    P.gate = span(u, 0, 0.22) * (1 - span(u, 0.78, 1));
    P.lamp = span(u, 0.2, 0.32) * (1 - span(u, 0.7, 0.82));
  } else if (id === "back") {
    const out = span(u, 0, 0.14) * (1 - span(u, 0.22, 0.36));
    const back = span(u, 0.52, 0.66) * (1 - span(u, 0.75, 0.88));
    P.th = u < 0.4 ? TOOL : u < 0.88 ? lerp(TOOL, FOUP, span(u, 0.37, 0.51)) : lerp(FOUP, HOME, span(u, 0.88, 1));
    P.r = T.toolReach * out + T.foupReach * back;
    P.lift = 0.6 * span(u, 0.15, 0.21) * (1 - span(u, 0.67, 0.73));
    P.wafer = u < 0.18 ? "tool" : u < 0.7 ? "arm" : "foup";
  } else if (id === "leave") {
    Object.assign(P, { dx: 6 * (1 - span(u, 0.16, 0.26)), dz: -34 * (1 - span(u, 0, 0.16)) });
    P.gz = D * (1 - span(u, 0.28, 0.46)) + D * span(u, 0.5, 0.74);
    P.fz = D * span(u, 0.5, 0.74);
    P.carried = u >= 0.5;
    P.vy = -60 * span(u, 0.78, 1);
  }
  return P;
}

// World offsets of each moving group for a pose.
function offsetsOf(p) {
  const fy = p.carried ? p.vy : 0;
  return {
    vehicle: [0, p.vy, 0],
    gripper: [0, p.vy, p.gz],
    foup: [0, fy, p.fz],
    door: [p.dx, fy, p.fz + p.dz],
  };
}
