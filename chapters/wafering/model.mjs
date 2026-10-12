// The facts the wafering figure shows. Every readout, caption and lesson number reads from here.
// Illustrative values (drawn sizes of machine parts, how many wires are drawn) are marked as such.

// ---- the finished 300 mm wafer ----
// Silicon Valley Microelectronics 300 mm prime wafer datasheet SV031 (cites SEMI standard notch and lasermark):
// https://svmi.com/wp-content/uploads/2020/09/SV031.pdf
export const WAFER = {
  diameterMm: 300, // ±0.10 mm
  diameterTolMm: 0.1,
  thicknessUm: 775, // ±25 µm
  thicknessTolUm: 25,
  notchDepthMm: 1.0, // +0.25 / -0.00 mm, SEMI standard notch
  notchAngleDeg: 90, // +5° / -1°
  notchAxis: "<110>", // notch orientation, ±1°
  orientation: "<100>", // crystal orientation of the face, ±1°
  particlesMax: 200, // front-side particles ≥ 0.20 µm per wafer (LPD/COP), the datasheet's limit
  particleSizeUm: 0.2,
};

// ---- the multi-wire saw ----
// Komatsu NTC MWM3050NQ, "a 12-inch wafer wire saw ... in the semiconductor substrate industry":
// https://www.komatsu.com/en-us/products/equipment/machine-tools/wafer-manufacturing-equipment/mwm3050nq
export const SAW = {
  model: "Komatsu NTC MWM3050NQ",
  workDiaMm: 300, // workpiece up to Φ300 mm
  workLenMm: 450, // × L450 mm
  wireDiaMm: 0.14, // Φ0.14 mm steel wire
  wireStoreKm: 500, // Φ0.14 mm × 500 km on the supply spool
  wireSpeedMMin: 1000, // max wire speed, m/min
  tensionN: [15, 34], // wire tension range, N
  feedMmMin: [0.01, 2.5], // cutting feed speed range, mm/min
  method: "slurry", // loose abrasive in a carrier fluid, fed onto the web
  massKg: 14700, // machine weight
  sizeMm: [2000, 3550, 3500], // machine size W × D × H
};
// Takatori MWS-612SD, a downcut multi-wire saw: 700 m/min wire speed, 300 mm ingot length.
// https://takatori-g.co.jp/english/products/products_mws/detail/mws-612sd.html
export const TAKATORI = { wireSpeedMMin: 700, workLenMm: 300 };

// Derived: wire speed in m/s, and the shortest possible cut through a 300 mm ingot at the top feed rate.
export const wireSpeedMs = SAW.wireSpeedMMin / 60; // ≈ 16.7 m/s
export const minCutMin = SAW.workDiaMm / SAW.feedMmMin[1]; // 120 min: a lower bound, real cuts feed slower

// ---- the wafering line ----
// Siltronic, products page (ingot to wafer): cylindrical grinding to diameter and notch, wire slicing into
// "hundreds of silicon wafers in just one step", a wafer "roughly 1 millimeter thick" as cut, edge rounding with
// a profile wheel, lapping "roughly ten micrometers of silicon from each wafer surface", cleaning and etching in
// alkaline or acid solutions, and 300 mm wafers "polished on both sides".
// https://www.siltronic.com/en/products.html
export const LINE = {
  lapUmPerSide: 10,
  asCutMm: 1, // "roughly 1 millimeter thick"
};

// ---- drawing scale ----
// World units per mm for the ingot, wafers and ruler. Machine parts around them are illustrative in size.
export const U = 0.25;
export const R_INGOT = (WAFER.diameterMm / 2) * U; // 37.5
export const L_INGOT = SAW.workLenMm * U; // 112.5, the longest block the MWM3050NQ takes
export const WIRES_DRAWN = 19; // illustrative: one drawn wire for roughly every 25 real ones
export const WIRE_PITCH = L_INGOT / (WIRES_DRAWN - 1); // drawn wires span the block end to end
export const perDrawnWire = Math.round((SAW.workLenMm / LINE.asCutMm) / WIRES_DRAWN / 5) * 5; // ≈ 25 (with ~1 mm per slice)

const fmt = (value, digits = 0) => value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
export { fmt };

// ---- the process, in order: the slider and play button step through these ----
// Each step spans an equal share of the slider. KEYS are the poses of the moving pieces at slider positions;
// between keys every share eases with a smoothstep. A share of 1 is a piece's start (raised, retracted or parked),
// 0 its working position. build.mjs samples these for the audit; live.js interprets the same table.
export const MOUNT_GAP = 10; // world units the ingot sits below its beam before it is glued (illustrative)
export const FEED = 92; // world units the head travels down through the web (illustrative)
const gap = MOUNT_GAP / FEED;

export const STEPS = [
  {
    id: "grind",
    name: "Grind and notch",
    part: "ingot",
    say: `ground to ${WAFER.diameterMm} mm · a ${WAFER.notchDepthMm.toFixed(1)} mm notch groove marks ${WAFER.notchAxis}`,
  },
  {
    id: "mount",
    name: "Glue on the beam",
    part: "beam",
    say: "glued to a beam on the work plate · the cut ends in the beam",
  },
  {
    id: "slice",
    name: "Wire-saw slicing",
    part: "web",
    say: `${fmt(SAW.wireDiaMm, 2)} mm wire at up to ${fmt(SAW.wireSpeedMMin)} m/min · fed ${SAW.feedMmMin[0]}–${SAW.feedMmMin[1]} mm/min`,
  },
  {
    id: "edge",
    name: "Edge grind",
    part: "edger",
    say: "a grooved wheel rounds the edge so it will not chip",
  },
  {
    id: "etch",
    name: "Lap and etch",
    part: "etcher",
    say: `lapped ~${LINE.lapUmPerSide} µm a side · etched to strip saw damage`,
  },
  {
    id: "polish",
    name: "Double-side polish",
    part: "dsp",
    say: "both faces polished at once · carriers turn like planet gears",
  },
  {
    id: "inspect",
    name: "Clean and inspect",
    part: "wafers",
    say: `${WAFER.diameterMm} mm · ${WAFER.thicknessUm} ± ${WAFER.thicknessTolUm} µm · ≤ ${WAFER.particlesMax} particles ≥ ${WAFER.particleSizeUm} µm`,
  },
];

const n = STEPS.length;
const at = (step, frac) => (step + frac) / n;
// shares: head (work plate, beam), ingot, edger (wheel slide), etch (nozzle arm), dsp (upper platen)
export const KEYS = [
  [at(0, 0), { head: 1, ingot: 1 - gap, edger: 1, etch: 1, dsp: 1 }],
  [at(1, 0.15), { head: 1, ingot: 1 - gap, edger: 1, etch: 1, dsp: 1 }],
  [at(1, 0.85), { head: 1, ingot: 1, edger: 1, etch: 1, dsp: 1 }],
  [at(2, 0.05), { head: 1, ingot: 1, edger: 1, etch: 1, dsp: 1 }],
  [at(2, 0.95), { head: 0, ingot: 0, edger: 1, etch: 1, dsp: 1 }],
  [at(3, 0.1), { head: 0, ingot: 0, edger: 1, etch: 1, dsp: 1 }],
  [at(3, 0.45), { head: 0, ingot: 0, edger: 0, etch: 1, dsp: 1 }],
  [at(3, 0.65), { head: 0, ingot: 0, edger: 0, etch: 1, dsp: 1 }],
  [at(3, 0.95), { head: 0, ingot: 0, edger: 1, etch: 1, dsp: 1 }],
  [at(4, 0.1), { head: 0, ingot: 0, edger: 1, etch: 1, dsp: 1 }],
  [at(4, 0.4), { head: 0, ingot: 0, edger: 1, etch: 0, dsp: 1 }],
  [at(4, 0.65), { head: 0, ingot: 0, edger: 1, etch: 0, dsp: 1 }],
  [at(4, 0.95), { head: 0, ingot: 0, edger: 1, etch: 1, dsp: 1 }],
  [at(5, 0.1), { head: 0, ingot: 0, edger: 1, etch: 1, dsp: 1 }],
  [at(5, 0.5), { head: 0, ingot: 0, edger: 1, etch: 1, dsp: 0 }],
  [at(6, 0.0), { head: 0, ingot: 0, edger: 1, etch: 1, dsp: 0 }],
  [at(6, 0.45), { head: 0, ingot: 0, edger: 1, etch: 1, dsp: 1 }],
  [at(7, 0), { head: 0, ingot: 0, edger: 1, etch: 1, dsp: 1 }],
];
export const PIECE_IDS = ["head", "ingot", "edger", "etch", "dsp"];

export function sharesAt(s) {
  if (s <= KEYS[0][0]) return { ...KEYS[0][1] };
  for (let i = 1; i < KEYS.length; i++) {
    const [s1, b] = KEYS[i];
    if (s <= s1) {
      const [s0, a] = KEYS[i - 1];
      const t = s1 > s0 ? (s - s0) / (s1 - s0) : 1;
      const e = t * t * (3 - 2 * t);
      return Object.fromEntries(PIECE_IDS.map((id) => [id, a[id] + (b[id] - a[id]) * e]));
    }
  }
  return { ...KEYS[KEYS.length - 1][1] };
}

export const IDLE = `${WAFER.diameterMm} mm wafers · ${WAFER.thicknessUm} µm · sliced hundreds at a time`;

// Drawing only: the angle round the ingot (0 = +x, 90° = up) where the notch groove is drawn, turned to face the reader.
export const NOTCH_ANGLE = 0.35;
