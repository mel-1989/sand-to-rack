// The process timeline, shared by the build (audit states) and the page (its source is inlined).
// T runs from 0 to the number of steps; step i occupies [i, i + 1).
// Shares follow the explode convention: 0 is where a part is drawn (wafer on the chuck under the beam),
// 1 is its full move away (wafer in the load lock, stage at its load position).
// K = { rho, opt }: rho is the stage move over the wafer move, opt the stage share where the overlay mark sits under the optical head.
export function sharesAt(T, K) {
  const clamp = (v) => Math.min(1, Math.max(0, v));
  const ease = (t) => t * t * (3 - 2 * t);
  if (T <= 1) {
    const u = ease(clamp(T));
    return { wafer: 1 - u * (1 - K.rho), stage: 1, hold: 0 };
  }
  if (T <= 2) {
    const v = T - 1;
    let s = 0;
    let hold = 0;
    if (v < 0.4) s = 1 - (1 - K.opt) * ease(v / 0.4);
    else if (v < 0.65) {
      s = K.opt;
      hold = ease(clamp((v - 0.4) / 0.04)) * (1 - ease(clamp((v - 0.61) / 0.04)));
    } else s = K.opt * (1 - ease((v - 0.65) / 0.35));
    return { wafer: K.rho * s, stage: s, hold };
  }
  return { wafer: 0, stage: 0, hold: 0 };
}
