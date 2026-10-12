// The facts the figure shows. Every readout, caption number and lesson number reads from here.
// Real numbers carry a source comment; values marked ILLUSTRATIVE are invented for the picture and said so in the caption.

// Semiconductor History Museum of Japan, "1984 Critical Dimension-Scanning Electron Microscope (CD-SEM)"
// https://shmj.or.jp/english/pdf/em/exhibi2448E.pdf
export const FIRST = {
  year: 1984, // Hitachi S-6000, the first CD-SEM
  model: "S-6000",
  maker: "Hitachi",
  kev: 1, // "a low acceleration voltage of approximately 1 keV" to prevent charging and damage
  semiInLens: 1989, // semi-in-lens objective: lens field on the wafer side, shorter focal length
  schottky: 1994, // Schottky emission gun, for a stable beam current
  retarding: 1994, // retarding field, higher resolution at low landing energy
};

// NIST / International SEMATECH, NISTIR 7089, Villarrubia, Vladar and Postek, "Shape-Sensitive Linewidth Measurements of Resist Structures"
// https://nvlpubs.nist.gov/nistpubs/Legacy/IR/nistir7089.pdf
export const NIST = {
  landingEv: 500, // top-down images "using a landing energy of 500 eV"
  beamPa: 10, // "and a beam current of 10 pA"
  bloomNm: "tens of", // each bright edge zone "may be tens of nanometers wide"
  regressionBiasNm: 15, // CDs from regression-to-baseline edges were "biased by approximately 15 nm"
};

// Hitachi press release, 12 Dec 2023, GT2000 high-precision electron beam metrology system
// https://www.hitachi.com/en/press/articles/2023/12/1212/
export const GT2000 = {
  year: 2023,
  volts: 100, // "ultra-low acceleration voltage of 100V" for thin High-NA EUV resist
};

// ASML, R. Maas et al., "EUV Industrialization", EUVL / SPIE Advanced Lithography 2023, NXE:3800E slide
// https://euvlitho.com/2023/P62.pdf
export const OVERLAY = {
  scanner: "NXE:3800E",
  mmoNm: 0.9, // matched machine overlay, ASML acceptance test
  wph: 220, // wafers per hour at that overlay, at 30 mJ/cm2
  previousNm: 1.1, // NXE:3600D spec, for comparison
};

// KLA press release, 20 Jul 2020, eSL10 e-beam patterned wafer defect inspection
// https://ir.kla.com/news-events/press-releases/detail/14/kla-introduces-breakthrough-electron-beam-defect-inspection
export const ESL10 = { year: 2020, pixelsB: 10 }; // "10 billion pixels of information per scan", one high current-density beam

// ASML press release, 28 May 2020, first multibeam inspection system eScan 1000
// https://www.asml.com/en/news/press-releases/2020/asml-ships-first-generation-multibeam-inspection-system
export const ESCAN = { year: 2020, beams: 9, gainPct: 600, crosstalkPct: 2 }; // 3 x 3 beams, up to 600% throughput, crosstalk < 2%

// US patent 6,947,805 B1, "Dynamic metrology sampling techniques for identified lots" (an example plan, not a standard)
// https://patents.google.com/patent/US6947805
export const SAMPLING = { sitesFrom: 9, sitesTo: 18, wafersFrom: 4, wafersTo: 2 };

// ILLUSTRATIVE: the measurement the figure plays through. Not from any real tool or product.
export const RUN = {
  targetNm: 24.0, // nominal linewidth of the drawn resist lines
  specNm: 1.0, // +/- spec window
  limitNm: 0.6, // +/- SPC control limits (3 sigma of the drawn history)
  cdNm: 24.3, // the CD this pass measures
  ovlXNm: 1.2, // overlay error read at the box-in-box mark
  ovlYNm: -0.7,
  rows: 512, // scan lines in one SEM frame
  history: [23.9, 24.1, 24.0, 23.8, 24.2, 24.1, 23.9, 24.0, 24.3, 24.2, 24.0, 23.7, 23.9, 24.1, 24.2, 24.0, 23.8, 24.0, 24.1, 24.4, 24.2, 24.0, 23.9, 24.1], // previous lots
};
export const passes = Math.abs(RUN.cdNm - RUN.targetNm) <= RUN.specNm;
export const inControl = Math.abs(RUN.cdNm - RUN.targetNm) <= RUN.limitNm;
export const lot = RUN.history.length + 1;

const f1 = (v) => (v < 0 ? "−" : "") + Math.abs(v).toFixed(1);

// The process the slider steps through, in order. `say` is the readout while that step runs.
export const STEPS = [
  { id: "load", name: "Wafer loads", seconds: 2.4, say: "loading · through the gate valve" },
  { id: "navigate", name: "Navigate to site", seconds: 3.2, say: `overlay · Δx ${f1(RUN.ovlXNm)} Δy ${f1(RUN.ovlYNm)} nm` },
  { id: "scan", name: "E-beam scans", seconds: 1.6, say: `beam on · ${NIST.landingEv} eV landing · ${NIST.beamPa} pA` },
  { id: "image", name: "Image builds line by line", seconds: 3.0, say: "imaging" },
  { id: "edges", name: "Edge detection", seconds: 2.0, say: "line profile · edges at threshold" },
  { id: "spec", name: "Result vs spec", seconds: 1.8, say: `CD ${RUN.cdNm.toFixed(1)} nm · spec ${RUN.targetNm.toFixed(1)} ± ${RUN.specNm.toFixed(1)} · ${passes ? "pass" : "fail"}` },
  { id: "spc", name: "SPC chart point", seconds: 2.2, say: `SPC · lot ${lot} · ${inControl ? "in control" : "out of control"}` },
];

export const PARTS = {
  gun: { name: "Electron gun", say: "field-emission tip under ultra-high vacuum" },
  condenser: { name: "Condenser lenses", say: "two magnetic lenses set the beam current" },
  scan: { name: "Scan coils", say: `sweep the spot · ${RUN.rows} lines a frame` },
  objective: { name: "Objective lens", say: "focuses the beam to a nanometre spot" },
  detector: { name: "Secondary electron detector", say: "counts secondary electrons from the surface" },
  stage: { name: "Stage and wafer", say: "x-y stage · read by a laser interferometer" },
  chamber: { name: "Chamber and load lock", say: "load lock keeps the chamber in vacuum" },
  optical: { name: "Optical head", say: "finds alignment and overlay marks" },
  console: { name: "Monitor", say: "image, line profile and SPC chart" },
};

export const IDLE = `CD-SEM · ${STEPS.length} steps · wafer in the load lock`;
