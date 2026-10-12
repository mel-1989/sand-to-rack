// The facts the figure and lesson show. Every number carries its source; illustrative values say so.

// ---- ALD: trimethylaluminium (TMA, AlMe3) + water -> Al2O3 ----
// Puurunen, "Surface chemistry of atomic layer deposition: a case study for the trimethylaluminum/water process",
// J. Appl. Phys. 97, 121301 (2005), https://doi.org/10.1063/1.1940727 (open copy: https://sarjaweb.vtt.fi/julkaisut/muut/2010/Puurunen.pdf):
// "the GPC in the AlMe3/H2O process at 300 °C is about 0.09 nm ... corresponding to about 30% of a monolayer of Al2O3."
export const ALD = {
  film: "Al₂O₃",
  precursor: "TMA",
  precursorLong: "trimethylaluminium",
  coreactant: "H₂O",
  purge: "N₂",
  gpcNm: 0.09, // nm per cycle at 300 °C (Puurunen 2005)
  tempC: 300, // the temperature that GPC is quoted at (Puurunen 2005)
  monolayerShare: 0.3, // "about 30% of a monolayer" (Puurunen 2005)
  byproduct: "CH₄", // methane leaves with the purge (Puurunen 2005, reaction by-products of alkyls with H2O are saturated hydrocarbons)
};
export const cyclesPerNm = 1 / ALD.gpcNm; // about 11 cycles for each nanometre, derived
export const cyclesFor10nm = Math.round(10 / ALD.gpcNm); // derived

// ---- the slider: one wafer into the ALD chamber, then CYCLES full ALD cycles ----
export const CYCLES = 8; // cycles shown on the slider (illustrative count; a real recipe runs tens to hundreds)
// Step weights are illustrative proportions of slider travel, not seconds.
export const TRANSFER = [
  { id: "vent", label: "Load lock pumped", say: "load lock pumped down · slit valve opens" },
  { id: "pick", label: "Robot picks wafer", say: "vacuum robot reaches into the load lock" },
  { id: "swing", label: "Robot turns 180°", say: "arm retracts · robot turns to the ALD chamber" },
  { id: "place", label: "Into the ALD chamber", say: "blade carries the wafer through the slit valve" },
  { id: "pins", label: "Lift pins take it", say: "lift pins take the wafer · blade withdraws" },
  { id: "heat", label: `Heat to ${ALD.tempC} °C`, say: `slit closes · heated pedestal brings the wafer to ${ALD.tempC} °C` },
];
export const WEIGHTS = { vent: 0.9, pick: 1.4, swing: 1.5, place: 1.3, pins: 1.6, heat: 0.9, pulseA: 0.55, purgeA: 0.45, pulseB: 0.55, purgeB: 0.45, done: 0.8 };
export const HALF = [
  { id: "pulseA", label: `${ALD.precursor} pulse`, say: `${ALD.precursor} pulse · bonds to OH sites until no room is left` },
  { id: "purgeA", label: `${ALD.purge} purge`, say: `${ALD.purge} purge · spare ${ALD.precursor} and ${ALD.byproduct} pumped away` },
  { id: "pulseB", label: `${ALD.coreactant} pulse`, say: `${ALD.coreactant} pulse · turns the surface back to Al–OH` },
  { id: "purgeB", label: `${ALD.purge} purge`, say: `${ALD.purge} purge · one layer done` },
];

// ---- wet clean (RCA): UBC Nanofab RCA-1 and RCA-2 procedures ----
// https://www.nanofab.ubc.ca/?p=744 : 5 DI water : 1 NH4OH (27%) : 1 H2O2 (30%), 70 ± 5 °C, 15 min soak, removes organics
// https://www.nanofab.ubc.ca/?p=747 : 6 DI water : 1 HCl (27%) : 1 H2O2 (30%), 70 ± 5 °C, 10 min soak, removes metal ions
export const RCA = {
  sc1: { mix: "5 H₂O : 1 NH₄OH : 1 H₂O₂", tempC: 70, minutes: 15 },
  sc2: { mix: "6 H₂O : 1 HCl : 1 H₂O₂", tempC: 70, minutes: 10 },
};

// ---- thermal oxidation: Deal & Grove, J. Appl. Phys. 36, 3770 (1965), https://doi.org/10.1063/1.1713945 ----
// abstract (via Crossref, https://api.crossref.org/works/10.1063/1.1713945): the model is "in excellent agreement with oxidation
// data obtained over a wide range of temperature (700°–1300°C), partial pressure (0.1–1.0 atm) and oxide thickness (300–20 000 Å)"
export const OXIDATION = { fromC: 700, toC: 1300 };

// ---- CVD temperatures: Plasma-Therm, "LPCVD vs PECVD" white paper ----
// https://www.plasmatherm.com/wp-content/uploads/2022/04/Plasma-Therm-LPCVD-vs-PECVD-Whitepaper.pdf
// "LPCVD ... over 100 wafers per run at 600°C to 800°C versus PECVD ... single wafer or relatively small batch operating between 200°C to 400°C"
export const CVD = { lpcvd: [600, 800], pecvd: [200, 400], lpcvdBatch: 100 };

// ---- high-k gate dielectric: Intel 45 nm (2007) ----
// https://www.intel.com/pressroom/archive/releases/2007/20071111comp.htm : first hafnium-based high-k metal gate processors
// https://www.edn.com/?p=4005680 : HfO2 gate dielectric at 1.0 nm EOT
export const HIGHK = { year: 2007, node: "45 nm", eotNm: 1.0 };

// ---- the cluster tool ----
// ASM XP4 Pulsar: "Up to four Pulsar modules can be configured to the XP4 cluster platform" (300 mm XP series)
// https://www.asm.com/our-technology-products/ald/xp4-pulsar
// Applied Materials dual load lock patent US6558509: process chambers, a buffer (transfer) chamber with a robot, a pair of load locks
// https://patents.google.com/patent/US6558509
export const TOOL = { processChambers: 4, loadLocks: 2, waferMm: 300 };

// Drawing scale: 1 world unit = 5 mm in plan. Heights, the chamber gap and the film are not to scale (illustrative).
export const MM_PER_UNIT = 5;
export const WAFER_R = TOOL.waferMm / 2 / MM_PER_UNIT; // 30 units

const fmt = (value, digits = 2) => value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
export const filmNm = (cycles) => fmt(cycles * ALD.gpcNm, 2);

// The legend: pieces of the tool, with what each does.
export const PIECES = {
  ald: { name: "ALD chamber", say: `ALD · ${ALD.precursor} + ${ALD.coreactant} → ${ALD.film} · ≈${ALD.gpcNm} nm a cycle at ${ALD.tempC} °C` },
  robot: { name: "Transfer chamber and robot", say: "vacuum transfer chamber · dual-arm robot moves wafers between chambers" },
  loadlock: { name: "Load locks", say: `${TOOL.loadLocks} load locks · pump from air to vacuum so the transfer chamber never vents` },
  pecvd: { name: "PECVD chamber", say: `PECVD · plasma lets CVD run at ${CVD.pecvd[0]}–${CVD.pecvd[1]} °C` },
  pvd: { name: "PVD chamber", say: "PVD · argon ions sputter metal atoms off a target onto the wafer" },
  clean: { name: "Pre-clean chamber", say: "pre-clean · strips native oxide in vacuum before deposition" },
  efem: { name: "Front end and FOUPs", say: `front end · ${TOOL.waferMm} mm wafers arrive in FOUPs, in clean air` },
};
export const ORDER = ["ald", "robot", "loadlock", "pecvd", "pvd", "clean", "efem"];

export const IDLE = `cluster tool · ${TOOL.processChambers} chambers · ${TOOL.loadLocks} load locks`;
