// The facts the ion-implant figure and lesson show. Every number carries its source.
// Illustrative values (recipe, geometry) are marked "illustrative" and said so in the caption.

// ---- physical constants (CODATA 2018, https://physics.nist.gov/cuu/Constants/) ----
export const AMU = 1.66053906660e-27; // kg
export const E_CHARGE = 1.602176634e-19; // C (exact)

// ---- machine envelope ----
export const TOOLS = {
  // Axcelis Purion M (medium current): "industry's broadest energy range (2KeV – 1 MeV)", "throughput of up to 500 WPH" (no dose condition given)
  // https://www.axcelis.com/purion-m-mid-current-ion-implantation/
  mediumKeV: [2, 1000],
  wph: 500,
  // Axcelis Purion XE family: 12-stage RF LINAC up to 4.5 MeV; XEmax up to 15 MeV
  // https://www.axcelis.com/products/purion-xe-series-high-energy-ion-implantation/
  linacStages: 12,
  maxMeV: 15,
  // Axcelis talk at PAC 2013: Purion XE / medium-current dose range 1E11 to 1E16 per cm²;
  // high-current AMAT/VSE VIISta Trident HC: 200 eV – 60 keV, dose 1E13 – 5E16 per cm²
  // https://accelconf.web.cern.ch/pac2013/talks/weyb2_talk.pdf
  doseRange: [1e11, 1e16],
  highCurrentEV: [200, 60e3],
  highCurrentDose: [1e13, 5e16],
};
export const MIN_KEV = TOOLS.highCurrentEV[0] / 1000; // 0.2 keV, the low end across tool classes (PAC 2013)

// Wafer tilt off the beam to keep ions from channelling down crystal rows.
// Georgia Tech ECE6450 lecture 5: "Most implants are done at 7.4 degree angles ... to minimize the channeling effect."
// https://alan.ece.gatech.edu/ECE6450/Lectures/ECE6450L5-Ion%20Implantation.pdf
export const TILT_DEG = 7.4;
// Same lecture: "1 12\" wafer can take as little as 25 seconds for a moderate dose"
export const WAFER_SECONDS = 25;

// ---- dopants: source gas, the ion the magnet keeps, the ions it throws away ----
// Projected range Rp in silicon at 100 keV, read from SRIM-2013 curves (Coherent, "Ion Implantation Projected Range Statistics"):
// boron about 3,100 Å, phosphorus about 1,300 Å, arsenic about 650 Å.
// https://www.coherent.com/content/dam/coherent/site/en/resources/datasheet/materials/ion-implantation-projected-range-statistics-ds.pdf
// Masses are the nominal isotope masses in u. Feed gases: BF3, PH3, AsH3 (GT lecture above names arsine and phosphine).
export const SPECIES = {
  B: { name: "Boron", type: "p-type", gas: "BF₃", ion: "¹¹B⁺", mass: 11, rpNm: 310, rejects: [["¹⁰B⁺", 10], ["F⁺", 19], ["BF₂⁺", 49]] },
  P: { name: "Phosphorus", type: "n-type", gas: "PH₃", ion: "³¹P⁺", mass: 31, rpNm: 130, rejects: [["H⁺", 1], ["PH⁺", 32], ["P₂⁺", 62]] },
  As: { name: "Arsenic", type: "n-type", gas: "AsH₃", ion: "⁷⁵As⁺", mass: 75, rpNm: 65, rejects: [["H⁺", 1], ["AsH⁺", 76], ["As₂⁺", 150]] },
};
export const SPECIES_ORDER = ["B", "P", "As"];

// ---- the recipe the figure runs (illustrative, inside the tool's range above) ----
export const RECIPE = {
  extractKeV: 40, // illustrative extraction voltage: what the magnet sees
  finalKeV: 100, // illustrative final energy after the column; Rp above is for 100 keV
  dose: 5e14, // illustrative, per cm², inside 1e11–1e16
};

// Magnetic rigidity B·ρ = √(2 m E) / q for a singly charged ion: physics, not a spec.
export const rigidity = (massU, keV) => Math.sqrt(2 * massU * AMU * keV * 1e3 * E_CHARGE) / E_CHARGE; // T·m
// At a fixed field, the bend radius scales with √m: lighter ions curl inside, heavier ones swing wide.
export const radiusRatio = (massU, keptU) => Math.sqrt(massU / keptU);

// ---- anneal ----
// Laser Focus World, "Semiconductor wafer annealing meets the 28 nm node": RTP heats one wafer with tungsten-halogen lamps
// to 300–1050 °C over 1–30 s; millisecond anneal takes the surface to 1100–1350 °C for hundreds of µs to a few ms.
// https://www.laserfocusworld.com/home/article/16547890/photonics-applied-microelectronics-processing-semiconductor-wafer-annealing-meets-the-28-nm-node
export const ANNEAL = {
  rtpC: [300, 1050],
  rtpSeconds: [1, 30],
  msaC: [1100, 1350],
  spikeC: 1050, // illustrative spike peak, set at the top of the lamp-RTP range above (not a quoted spike figure)
};

const fmt = (value, digits = 0) => value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
export const sci = (value) => {
  const e = Math.floor(Math.log10(value));
  const m = value / 10 ** e;
  return `${m === 1 ? "" : `${fmt(m, m % 1 ? 1 : 0)}×`}10${String(e).replace(/\d/g, (d) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[d]).replace("-", "⁻")}`;
};

export const PIECES = {
  gas: { name: "Gas box", say: "BF₃, PH₃, AsH₃ bottles · one valve open", short: "BF₃ · PH₃ · AsH₃ bottles" },
  source: { name: "Ion source", say: "arc chamber · a filament strikes a plasma", short: "arc chamber · plasma" },
  extract: { name: "Extraction electrodes", say: `${RECIPE.extractKeV} kV pulls the ions out (illustrative)`, short: `${RECIPE.extractKeV} kV pulls ions out` },
  magnet: { name: "Analyzer magnet", say: "bends ions by mass · one fits the slit", short: "bends by mass · one fits slit" },
  column: { name: "Acceleration column", say: `graded rings add energy · tools: ${MIN_KEV} keV–${TOOLS.maxMeV} MeV`, short: `rings add energy · ${MIN_KEV} keV–${TOOLS.maxMeV} MeV` },
  scanner: { name: "Scanner", say: "sweeps the beam, then makes it parallel", short: "sweeps beam, makes it parallel" },
  station: { name: "End station", say: `platen tilted ${TILT_DEG}° · Faraday cup counts dose`, short: `tilt ${TILT_DEG}° · cup counts dose` },
  anneal: { name: "Anneal chamber", say: `lamp RTP · spike to ~${fmt(ANNEAL.spikeC)} °C (illustrative)`, short: `lamp RTP · ~${fmt(ANNEAL.spikeC)} °C spike` },
  stand: { name: "Bed", say: "" },
};
export const ORDER = ["gas", "source", "extract", "magnet", "column", "scanner", "station", "anneal"];

export const STEPS = [
  { id: "ionize", name: "Ionise the gas" },
  { id: "extract", name: "Extract a beam" },
  { id: "select", name: "Select the mass" },
  { id: "accelerate", name: "Accelerate" },
  { id: "scan", name: "Scan the wafer" },
  { id: "stop", name: "Stop at depth" },
  { id: "anneal", name: "Anneal and activate" },
];

export { fmt };
