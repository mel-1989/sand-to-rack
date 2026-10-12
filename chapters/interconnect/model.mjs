// The facts the figure shows. Every readout, caption number and lesson number reads from here.
// Geometry sizes in build.mjs are illustrative (the stack is drawn hugely magnified, heights compressed);
// only the numbers below are claims, each with its source.

const fmt = (value, digits = 0) => value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });

// ---- the exemplar stack: Intel 4 (2022) ----
// 16 metal layers in the VLSI 2022 paper abstract:
//   https://scholars.ncu.edu.tw/en/publications/intel-4-cmos-technology-featuring-advanced-finfet-transistors-opt/
// "16 regular layers plus two thick upper layers", M0 at 30 nm and M1 at 50 nm pitch:
//   https://www.realworldtech.com/intel-4/3
// M0 30 nm, "Enhanced Copper" (copper clad with cobalt) in the lowest layers:
//   https://www.anandtech.com/show/17448
export const STACK = {
  example: "Intel 4",
  regular: 16, // M0 to M15
  thick: 2, // two thick top layers
  m0PitchNm: 30,
  m1PitchNm: 50,
  lowMetal: "copper clad in cobalt",
};
export const LAYER_COUNT = STACK.regular + STACK.thick; // 18

// ---- cobalt and ruthenium for the smallest lines ----
// Intel 10 nm: cobalt in M0 and M1 (40 and 36 nm pitch), 2x lower line resistance and 5-10x better electromigration at those layers:
//   https://fuse.wikichip.org/news/525/iedm-2017-isscc-2018-intels-10nm-switching-to-cobalt-interconnects/2/
export const COBALT = { node: "Intel 10 nm", m1PitchNm: 36, resistanceGain: 2, emGain: "5-10x" };
// imec: two-level semi-damascene ruthenium module at 18 nm metal pitch (VLSI 2022), etched rather than plated:
//   https://siliconsemiconductor.net/article/115049/Imec_produces_the_first_fully_self-aligned_two-metal-level_semi-damascene_module
export const RUTHENIUM = { pitchNm: 18, who: "imec" };

// ---- the plating cell (Lam Research patent US 10,214,826 B2, an electroplating bath and process for damascene fill) ----
//   https://patents.google.com/patent/US10214826B2/en
export const PLATE = {
  rpmRange: [5, 125], // apparatus range
  rpmFill: [12, 30], // during bottom-up fill
  rpmBurden: [60, 120], // while plating the overburden
  fillMAcm2: 3, // about 3 mA/cm2 or less while filling
  burdenMAcm2: [10, 15], // overburden stage
  flowFillLpm: 6,
  flowBurdenLpm: [12, 20],
  bath: { cuGL: 40, acidGL: 10, chloridePpm: 50 }, // the high-copper baseline bath in the patent's examples
};
export const WAFER_MM = 300; // standard leading-edge wafer diameter

// ---- copper itself (P. C. Andricacos, IBM, "Copper On-Chip Interconnections", ECS Interface, Spring 1999) ----
//   https://www.electrochem.org/dl/interface/spr/spr99/IF3-99-Pages32-37.pdf
export const COPPER = {
  resistivity: 1.7, // µΩ·cm, bulk copper
  lessResistance: 45, // % lower wire resistance than Al(Cu), up to
  emLifetime: 100, // electromigration T50 more than 100x Ti/Al(Cu)/Ti
  announced: "September 1997",
  shipped: "June 1998",
};

// ---- dielectric constants (V. N. Sekhar, "Mechanical Characterization of Black Diamond (Low-k) Structures", IntechOpen 2012, table 1) ----
//   https://www.intechopen.com/chapters/40033
// Applied Materials' Black Diamond SiCOH at k 2.7 (EE Times, 2000): https://www.eetimes.com/?p=1184052
export const DIELECTRIC = { oxide: [3.9, 4.5], sicoh: [2.7, 3.3], blackDiamond: 2.7, porous: [1.7, 2.2] };

// ---- the dual damascene loop, one pass per metal layer ----
export const STEPS = [
  { id: "lowk", name: "deposit low-k", say: `SiCOH low-k glass · k ≈ ${DIELECTRIC.blackDiamond} vs ${DIELECTRIC.oxide[0]} oxide` },
  { id: "cut", name: "pattern via + trench", say: "etch the via, then the trench above it" },
  { id: "liner", name: "barrier + seed", say: "Ta/TaN barrier, then a thin Cu seed" },
  { id: "plate", name: "electroplate copper", say: `${PLATE.rpmFill[0]}–${PLATE.rpmFill[1]} rpm · ≈${PLATE.fillMAcm2} mA/cm² · fills bottom up` },
  { id: "cmp", name: "CMP flat", say: "CMP polishes the overburden off" },
];

// The drawn layers, bottom to top. Tier sizes are illustrative: real pitch grows from 30 nm to microns.
const tier = (names, kind) => names.map((name) => ({ name, kind }));
export const LAYERS = [
  ...tier(["M0", "M1", "M2", "M3", "M4"], "local"),
  ...tier(["M5", "M6", "M7", "M8", "M9", "M10"], "intermediate"),
  ...tier(["M11", "M12", "M13", "M14", "M15"], "semi-global"),
  ...tier(["TM0", "TM1"], "thick top"),
];
export const PITCH_NOTE = { M0: `${STACK.m0PitchNm} nm pitch`, M1: `${STACK.m1PitchNm} nm pitch` };

export const PIECES = {
  head: { name: "Clamshell head", say: `${WAFER_MM} mm wafer face-down · ${PLATE.rpmRange[0]}–${PLATE.rpmRange[1]} rpm · edge contacts` },
  cell: { name: "Plating cell", say: `Cu anode · membrane · ${PLATE.bath.cuGL} g/L Cu²⁺ · ${PLATE.bath.chloridePpm} ppm Cl⁻` },
  loop: { name: "Electrolyte loop", say: `pump + filter · ≈${PLATE.flowFillLpm} L/min fill · ${PLATE.flowBurdenLpm[0]}–${PLATE.flowBurdenLpm[1]} overburden` },
  power: { name: "Plating supply", say: `wafer is the cathode · ≈${PLATE.fillMAcm2} → ${PLATE.burdenMAcm2[0]}–${PLATE.burdenMAcm2[1]} mA/cm²` },
  stack: { name: "Metal stack", say: `${LAYER_COUNT} layers · M0 ${STACK.m0PitchNm} nm pitch to thick top metal` },
  stand: { name: "Bench", say: "" },
};

export const IDLE = `${LAYER_COUNT} metal layers · ${STACK.example} · M0 ${STACK.m0PitchNm} nm`;
export const fmtN = fmt;
