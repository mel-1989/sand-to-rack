// The facts the figure shows. Every readout, caption number and lesson number reads from here.
// Geometry sizes in build.mjs are illustrative (the stack is drawn hugely magnified, heights compressed);
// only the numbers below are claims, each with its source.

const fmt = (value, digits = 0) => value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });

// ---- the exemplar stack: Intel 4 (2022) ----
// 16 metal layers in the VLSI 2022 paper abstract:
//   https://scholars.ncu.edu.tw/en/publications/intel-4-cmos-technology-featuring-advanced-finfet-transistors-opt/
// "16 regular layers plus two thick upper layers", M0 at 30 nm and M1 at 50 nm pitch:
//   https://www.realworldtech.com/intel-4/3
// "M0 – M4 now uses eCu (enhanced copper)": reflowed copper with a Ta barrier and a cobalt liner and cap
// (Dick James, TechInsights, Semiconductor Digest 2022):
//   https://semiconductor-digest.com/?p=20581
export const STACK = {
  example: "Intel 4",
  regular: 16, // M0 to M15
  thick: 2, // two thick top layers
  m0PitchNm: 30,
  m1PitchNm: 50,
  lowMetal: "copper with a cobalt liner and cap",
};
export const LAYER_COUNT = STACK.regular + STACK.thick; // 18

// ---- cobalt and ruthenium for the smallest lines ----
// Intel 10 nm (IEDM 2017): cobalt in M0 and M1 (40 and 36 nm pitch), 2x lower VIA resistance and 5-10x better
// electromigration at those layers. The gain comes from cobalt's much thinner barrier/liner, not a better bulk metal:
//   https://fuse.wikichip.org/news/525/iedm-2017-isscc-2018-intels-10nm-switching-to-cobalt-interconnects/2/
// "using cobalt for M0/M1 reduced via resistance by 2x": https://semiconductor-digest.com/?p=20581
export const COBALT = { node: "Intel 10 nm", m1PitchNm: 36, viaResistanceGain: 2, emGain: "5-10x" };
// imec: two-level semi-damascene ruthenium module at 18 nm metal pitch (VLSI 2022), etched rather than plated:
//   https://siliconsemiconductor.net/article/115049/Imec_produces_the_first_fully_self-aligned_two-metal-level_semi-damascene_module
export const RUTHENIUM = { pitchNm: 18, who: "imec" };

// ---- the plating cell (Novellus Systems (Lam Research) patent US 10,214,826 B2, electroplating for damascene fill) ----
//   https://patents.google.com/patent/US10214826B2/en
export const PLATE = {
  rpmRange: [5, 125], // apparatus range
  rpmFill: [12, 30], // during bottom-up fill
  rpmBurden: [60, 120], // while plating the overburden
  fillRange: [0.5, 5], // "between about 0.5-5 mA/cm2 during this fill stage"
  fillMAcm2: 3, // illustrative: the supply display's value, a point inside the patent's 0.5-5 mA/cm2 fill window
  burdenMAcm2: [10, 15], // overburden stage
  flowFillLpm: 6,
  flowBurdenLpm: [12, 20],
  bath: { cuGL: 40, acidGL: 10, chloridePpm: 50 }, // "a baseline solution of 40 g/L Cu2+, 10 g/L acid, and 50 ppm Cl" (the patent's comparison bath)
};
// ---- wafer bumping: copper pillars with a solder cap, plated after the last metal layer ----
// TSMC patent US 8,659,155 B2 ("Mechanisms for forming copper pillar bumps"): open the passivation over the top pad,
// sputter (PVD) a Ti barrier and a Cu seed (the UBM), pattern a resist mask, electroplate the Cu pillar, plate an optional
// Ni cap and a SnAg solder layer, strip the resist, flash-etch the exposed UBM, then reflow to round the solder:
//   https://patents.google.com/patent/US8659155B2/en
// Rohm and Haas / Dow patent US 10,104,782 B2 (plating resist-defined pillars): "Current densities may range from 0.25 ASD
// to 40 ASD, preferably 1 ASD to 20 ASD, more preferably from 4 ASD to 18 ASD" (ASD = A/dm2 = 10 mA/cm2); pillars
// typically 10-75 um across; tops plated with tin/silver solder in the same resist apertures:
//   https://patents.google.com/patent/US10104782B2/en
// Pitches from AMD's Hot Chips 33 slide (2021), as reported: C4 130 um, micro-bump 3D 50 um, hybrid bond 9 um:
//   https://www.tomshardware.com/news/amd-unveils-more-ryzen-3d-packaging-and-v-cache-details-at-hot-chips
export const BUMP = {
  asd: [4, 18], // A/dm2, the patent's "more preferably" range
  pillarDiamUm: [10, 75],
  c4PitchUm: 130,
  microPitchUm: 50,
  hybridPitchUm: 9,
};
export const BUMP_MACM2 = BUMP.asd.map((a) => a * 10); // 40-180 mA/cm2
export const BUMP_DISPLAY = BUMP_MACM2[0]; // illustrative: the supply display's value while plating pillars
export const BUMP_STEPS = [
  { id: "pad", name: "passivation + pad openings", say: "passivation · an opening over each pad" },
  { id: "ubm", name: "UBM sputter", say: "sputtered Ti + Cu seed over the wafer" },
  { id: "pillar", name: "plate Cu pillar + SnAg", say: `resist mask · Cu pillar then SnAg cap · ${BUMP.asd[0]}–${BUMP.asd[1]} A/dm²` },
  { id: "reflow", name: "strip · etch · reflow", say: "strip resist · etch seed · reflow solder" },
];

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
  { id: "plate", name: "electroplate copper", say: `${PLATE.rpmFill[0]}–\u2060${PLATE.rpmFill[1]}\u00a0rpm · ${PLATE.fillRange[0]}–\u2060${PLATE.fillRange[1]}\u00a0mA/cm² · bottom-up fill` },
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
  power: { name: "Plating supply", say: `wafer is the cathode · ${PLATE.fillRange[0]}–${PLATE.fillRange[1]} → ${PLATE.burdenMAcm2[0]}–${PLATE.burdenMAcm2[1]} mA/cm²` },
  stack: { name: "Metal stack", say: `${LAYER_COUNT} layers · M0 ${STACK.m0PitchNm} nm pitch to thick top metal · Cu pillar bumps` },
  stand: { name: "Bench", say: "" },
};

export const IDLE = `${LAYER_COUNT} metal layers · ${STACK.example} · M0 ${STACK.m0PitchNm} nm`;
export const fmtN = fmt;
