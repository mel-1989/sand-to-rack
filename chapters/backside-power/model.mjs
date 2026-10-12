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
export const SPECTRUM = { utilPeakPct: 95 };

// Intel 18A, PowerVia in production: https://www.intel.com/content/www/us/en/foundry/process/18a.html
export const INTEL_18A = {
  node: "Intel 18A",
  droopX: 10, // "reduces worst-case dynamic voltage droop by as much as 10x"
  areaPct: 11, // "up to 11% block-level area compaction in routed designs"
  perfWattPct: 15, // RibbonFET + PowerVia together, vs Intel 3, "up to 15 percent better performance per watt"
  densityPct: 30, // RibbonFET + PowerVia together, vs Intel 3, "up to 30 percent better chip density"
  product: "Panther Lake", // Core Ultra series 3, the first 18A product
};

// TSMC A16 with Super Power Rail, projections vs N2P, production planned for H2 2026.
// https://pr.tsmc.com/english/news/3136 ; contact to source/drain: https://semiengineering.com/tsmc-uncorks-a16-with-super-power-rail
export const A16 = {
  node: "TSMC A16",
  speedPct: [8, 10], // at the same Vdd
  powerPct: [15, 20], // lower power at the same speed
  densityX: 1.1, // "up to 1.10X chip density" for data-centre products
  when: "H2 2026",
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

// A standard 300 mm wafer starts about 775 um thick (SEMI M1); the device silicon left after thinning is a few hundred nm.
// https://www.imec-int.com/en/articles/how-power-chips-backside (thinning) ; 775 um is the SEMI M1 nominal for 300 mm.
export const WAFER_UM = 775;

// ---- the drawing (illustrative: a sawn block of a chip, heights compressed, layer counts reduced) ----
export const DRAWN = {
  frontLayers: 9, // front-side block: signal and power share these
  signalLayers: 6, // backside block: signal only on the front
  backLayers: 3, // backside power layers
  bumps: 12,
};

const range = ([a, b]) => `${a}–${b}`;

export const STEPS = [
  { id: "front", name: "Transistors and signal wiring", say: `front end as usual · transistors, then fine signal layers · ${WAFER_UM} µm wafer` },
  { id: "bond", name: "Bond a carrier wafer", say: `carrier wafer bonded face to face · SiCN fusion bond, ${IMEC.bondAnnealC} °C anneal` },
  { id: "flip", name: "Flip", say: "flip the pair · the carrier now holds the chip" },
  { id: "thin", name: "Thin the silicon", say: `grind and polish ${WAFER_UM} µm down to ${IMEC.thinNm} nm · TTV < ${IMEC.ttvNm} nm` },
  { id: "tsv", name: "Nano-TSVs", say: `nano-TSVs etched and filled · ${IMEC.ntsvDepthNm} nm deep, ${IMEC.ntsvPitchNm} nm pitch (imec)` },
  { id: "metal", name: "Backside power metal", say: "thick, wide power layers on the back · power off the signal stack" },
  { id: "bumps", name: "Bumps on the back", say: `bumps on the back · power in, ${POWERVIA_TEST.droopPct}%+ less droop (Intel test chip)` },
];

export const PIECES = {
  fs: { name: "Front-side chip", say: `front-side power · power climbs down ${range(IMEC.beolLayers)} layers shared with signals · ≥${IMEC.powerRoutingPct}% of routing` },
  carrier: { name: "Carrier wafer", say: "carrier wafer · a blank wafer bonded on, holds the chip once its silicon is gone" },
  signal: { name: "Signal wiring", say: "front: signals only · freed of power, cells pack to >90% (Intel)" },
  devices: { name: "Transistors", say: `transistor layer · ${IMEC.thinNm} nm of silicon left under it` },
  ntsv: { name: "Nano-TSVs", say: `nano-TSVs · ${IMEC.ntsvPitchNm} nm pitch · Intel PowerVia: one in every cell; TSMC A16: contact straight to source` },
  bspdn: { name: "Backside power", say: `backside power network · IR drop ÷${IMEC.irDropX} (imec/Arm sim) · droop ÷${INTEL_18A.droopX} worst case (Intel 18A)` },
  bumps: { name: "Bumps", say: "bumps on the back · power arrives a few layers from the transistors" },
  tools: { name: "Flip fixture and grinder", say: "rotary flip fixture and cup-wheel grinder · stand-ins for the bonder, flipper and back-grinder" },
};
export const ORDER = ["fs", "carrier", "signal", "devices", "ntsv", "bspdn", "bumps", "tools"];

export const IDLE = `${INTEL_18A.node} PowerVia · ${A16.node} Super Power Rail`;
export const DONE = `A16 vs N2P: +${range(A16.speedPct)}% speed or −${range(A16.powerPct)}% power`;
