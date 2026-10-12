// The facts the figure shows. Every readout, caption number and lesson number reads from here.
// Company figures are company claims (test chips, projections); each one says which.

// Intel PowerVia test chip ("Blue Sky Creek", E-cores on an internal Intel 4-based test node), VLSI 2023.
// https://www.intel.com/content/www/us/en/newsroom/news/powervia-test-shows-industry-leading-performance.html
export const POWERVIA_TEST = {
  chip: "Blue Sky Creek",
  droopPct: 30, // "more than 30% platform voltage droop improvement"
  freqPct: 6, // "6% frequency benefit"
  utilPct: 90, // "standard cell utilization of more than 90%" over large areas of the die
};
// IEEE Spectrum on the same chip: some areas up to 95% filled; "30 percent less power loss".
// https://spectrum.ieee.org/backside-power-delivery
export const SPECTRUM = { utilPeakPct: 95, m0RelaxNm: 6 }; // M0 lines "could be six nanometers further apart"

// Intel 18A, PowerVia in production: https://www.intel.com/content/www/us/en/foundry/process/18a.html
// Intel 18A technology brief (June 2026), Figure 4 and the PowerVia list:
// https://www.intel.com/content/dam/www/central-libraries/us/en/documents/2026-06/foundry-18a-technology-brief.pdf
export const INTEL_18A = {
  node: "Intel 18A",
  droopX: 10, // brief: "~10x reduction in worst-case dynamic voltage droop compared to frontside power delivery"
  areaPct: 11, // brief: "6–11% block-level area compaction, depending on power-grid assumptions"
  perfWattPct: 18, // brief, Fig. 4: RibbonFET + PowerVia, "18% performance per watt increase (at same power) vs. Intel 3"
  densityX: 1.3, // brief, Fig. 4: "1.3x chip density improvement vs. Intel 3"
};

// TSMC A16 with Super Power Rail, projections vs N2P. The 2024 release planned production for H2 2026.
// TSMC's 2026 symposium release gives no A16 date (only A12, 2029, also with Super Power Rail): https://pr.tsmc.com/english/news/3302
// Coverage of that symposium reports A16 volume production slipped to 2027:
// https://www.trendforce.com/news/2026/04/23/news-tsmc-unveils-latest-roadmap-a12-a13-set-for-2029-without-high-na-euv-a16-volume-production-delayed-to-2027/
// https://pr.tsmc.com/english/news/3136 ; contact to source/drain: https://semiengineering.com/tsmc-uncorks-a16-with-super-power-rail
export const A16 = {
  node: "TSMC A16",
  speedPct: [8, 10], // at the same Vdd
  powerPct: [15, 20], // lower power at the same speed
  densityX: 1.1, // "up to 1.10X chip density" for data-centre products
  when: "originally H2 2026; volume production reported as 2027 after TSMC's April 2026 symposium",
  volumeYear: 2027, // TrendForce, 2026-04-23 (above)
};

// imec: how backside power is made, and what it buys. https://www.imec-int.com/en/articles/how-power-chips-backside
export const IMEC = {
  beolLayers: [15, 20], // frontside power must traverse "all 15-to-20 layers of the BEOL stack"
  powerRoutingPct: 20, // power takes "at least 20% of the routing resources"
  thinNm: "a few hundred", // wafer thinned to "a few 100nm of Si"
  ttvNm: 40, // total thickness variation must stay below 40 nm
  ntsvDepthNm: 320, // test vehicle: 320 nm deep nTSVs landing on buried power rails
  ntsvPitchNm: 200, // at 200 nm pitch
  bondAnnealC: 250, // SiCN-to-SiCN fusion bond at room temperature, post-bond anneal at 250 C
  irDropX: 7, // Arm simulation: backside delivery with BPRs cuts IR drop 7x vs conventional frontside
};

// A 300 mm wafer starts at a nominal 775 um (SEMI 3D10 describes 300 mm wafers "with nominal thickness of 775 µm").
// https://store-us.semi.org/products/3d01000-semi-3d10-guide-to-describing-materials-properties-for-intermediate-wafers-for-use-in-a-300-mm-3ds-ic-wafer-stack-1
export const WAFER_UM = 775;

const range = ([a, b]) => `${a}–${b}`;

export const STEPS = [
  { id: "front", name: "Transistors and signal wiring", say: "transistors, then fine signal wiring" },
  { id: "bond", name: "Bond a carrier wafer", say: `carrier bonded face to face · ${IMEC.bondAnnealC} °C anneal` },
  { id: "flip", name: "Flip", say: "flipped · the carrier now holds the chip" },
  { id: "thin", name: "Thin the silicon", say: `grinding · TTV < ${IMEC.ttvNm} nm` },
  { id: "tsv", name: "Nano-TSVs", say: `nano-TSVs · ${IMEC.ntsvDepthNm} nm deep, ${IMEC.ntsvPitchNm} nm pitch` },
  { id: "metal", name: "Backside power metal", say: "thick power layers built on the back" },
  { id: "bumps", name: "Bumps on the back", say: `bumps on the back · >${POWERVIA_TEST.droopPct}% less droop (Intel)` },
];

export const PIECES = {
  fs: { name: "Front-side chip", say: `front-side power · down ${range(IMEC.beolLayers)} layers with signals` },
  carrier: { name: "Carrier wafer", say: "carrier wafer · holds the chip once thinned" },
  signal: { name: "Signal wiring", say: `signals only · cells pack >${POWERVIA_TEST.utilPct}% (Intel)` },
  devices: { name: "Transistors", say: `transistors on ${IMEC.thinNm} nm of silicon` },
  ntsv: { name: "Nano-TSVs", say: "nano-TSVs · Intel: per cell · TSMC: S/D" },
  bspdn: { name: "Backside power", say: `backside power · IR drop ÷${IMEC.irDropX} (imec/Arm sim)` },
  bumps: { name: "Bumps", say: "bumps on the back · power enters here" },
  tools: { name: "Flip fixture and grinder", say: "flip fixture and back-grinder (stand-ins)" },
};
export const ORDER = ["fs", "carrier", "signal", "devices", "ntsv", "bspdn", "bumps", "tools"];

export const IDLE = `${INTEL_18A.node} PowerVia · ${A16.node} Super Power Rail`;
// at rest the readout quotes Intel, whose nano-TSV scheme is the one the right block shows
export const DONE = `${INTEL_18A.node} PowerVia: up to ${INTEL_18A.droopX}× less droop`;
