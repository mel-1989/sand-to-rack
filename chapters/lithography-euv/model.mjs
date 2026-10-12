// The facts the figure and lesson show. Every readout, caption number and step reads from here.
// Geometry in build.mjs is illustrative (a schematic cutaway, not to scale); these numbers are not.

// ---- EUV light ----
// https://www.asml.com/en/technology/lithography-principles/light-and-lasers
// https://www.zeiss.com/semiconductor-manufacturing-technology/inspiring-technology/euv-lithography.html
export const LIGHT = {
  wavelengthNm: 13.5, // ASML light-and-lasers; ZEISS EUV page
  duvNm: 193, // the deep-UV wavelength EUV replaced (ZEISS EUV page)
  dropletsPerS: 50_000, // ASML: tin droplets hit "50,000 times per second"; ZEISS: 50,000 per second
  dropletUm: 25, // ASML: "molten tin droplets of around 25 microns in diameter"
  dropletSpeedMs: 70, // ASML: droplets ejected at 70 metres per second
  laserKw: 30, // ZEISS: a 30 kW CO2 laser drives the source
  plasmaC: 220_000, // ZEISS: "nearly 220,000 °C", about 40 times the Sun's surface
};

// ---- optics ----
// ZEISS EUV page: projection optics of 6 mirrors, up to 70% of the light usable per mirror, multilayer of up to 100 layers.
// https://www.asml.com/en/products/euv-lithography-systems/twinscan-nxe3400b : "Zeiss 4x reduction EUV optics with a
// Numerical Aperture (NA) of 0.33" and "a maximum scanned exposure field size of 26 x 33 mm" (the NXE platform the 3800E shares).
export const OPTICS = {
  na: 0.33,
  reduction: 4,
  pobMirrors: 6,
  reflectance: 0.7, // "up to 70%" per mirror (ZEISS)
  layers: 100, // "up to 100 layers" of the multilayer coating (ZEISS)
  fieldMm: [26, 33], // scanned field at the wafer (ASML NXE:3400B page)
};
// Resolution: ASML, the Rayleigh criterion (https://www.asml.com/en/technology/lithography-principles/rayleigh-criterion):
// "CD = k1 • λ / NA"; NA "defining how much light they can collect"; "The physical limit lithography is k1 = 0.25."
export const RAYLEIGH = {
  k1Limit: 0.25, // ASML: the physical limit
  k1Typical: 0.3, // illustrative: a practical k1 a little above the limit, not an ASML number
};
export const HALF_PITCH_NM = (RAYLEIGH.k1Typical * LIGHT.wavelengthNm) / OPTICS.na; // derived: 0.3 × 13.5 / 0.33 ≈ 12 nm
export const HALF_PITCH_LIMIT_NM = (RAYLEIGH.k1Limit * LIGHT.wavelengthNm) / OPTICS.na; // derived: ≈ 10 nm at k1 = 0.25

// ---- deep-UV immersion, which still prints most layers ----
// https://www.asml.com/en/products/duv-lithography-systems/twinscan-nxt2100i : ArF 193 nm, NA 1.35, resolution ≤ 38 nm.
// https://www.asml.com/en/news/stories/2021/twinscan-20-years-innovation : "a pool of ultra-pure water between the lens and the wafer",
// "Immersion made it possible to create systems with an NA up to 1.35", dry NA "about 0.93"; double patterning splits "one complex
// layer pattern into two (or more) simpler patterns" and "requires twice as many exposure steps".
// https://www.asml.com/en/products/duv-lithography-systems : immersion systems "are the workhorses of the industry"; most layers do not need the newest tools.
export const DUV = {
  wavelengthNm: 193,
  na: 1.35,
  dryNa: 0.93,
  resolutionNm: 38, // NXT:2100i, "≤ 38 nm"
};
export const RETICLE_FIELD_MM = OPTICS.fieldMm.map((v) => v * OPTICS.reduction); // derived: 104 x 132 mm on the mask
export const POB_PASS = OPTICS.reflectance ** OPTICS.pobMirrors; // derived: 0.7^6 ≈ 0.118 of the light leaves the six projection mirrors
export const DROPLET_GAP_MM = (LIGHT.dropletSpeedMs / LIGHT.dropletsPerS) * 1000; // derived: 70 m/s ÷ 50 kHz = 1.4 mm between droplets

// ---- the scanner ----
// ASML 20-F FY2025 (https://www.sec.gov/Archives/edgar/data/0000937966/000162828026011378/asml-20251231.htm):
// NXE:3800E shipped at full specification with 220 wafers per hour, 37% more than the NXE:3600D.
// ASML SPIE 2023 slides (https://euvlitho.com/2023/P62.pdf): ≥220 wph at 30 mJ/cm² on 96 full fields, 0.9 nm matched overlay.
export const SCANNER = {
  name: "NXE:3800E",
  wph: 220,
  doseMjCm2: 30,
  fields: 96,
  overlayNm: 0.9,
  gainVs3600D: 37, // percent
  // Tom's Hardware (https://www.tomshardware.com/tech-industry/semiconductors/asmls-planned-low-na-euv-machine-price-hikes-reportedly-frustrate-tsmc-lithography-machine-maker-comes-knocking-to-make-bank-on-tsmcs-profitable-fabs-potentially-costing-the-taiwanese-chipmaker-billions):
  // NXE:3400C and 3600D at about $160-195 M, and "the latest NXE:3800E is climbing even further"; trade-press estimates, ASML publishes no price.
  priceM: [160, 195],
  // NXE:3800E: "a price tag of around $180 million each" at its March 2024 launch (Tom's Hardware, reproduced at
  // https://semiwiki.com/forum/threads/asml-delivers-cutting-edge-new-chipmaking-tool-%E2%80%94-third-generation-euv-enables-2nm-processors-and-beyond.19854/);
  // press estimate, not an ASML price.
  price3800eM: 180,
  // Later reported at 230 wph: Börse Global, 26 May 2026, citing ASML management at a Taiwan media briefing
  // (https://www.boerse-global.de/asml-aktie-230-wafer-pro-stunde-mit-nxe3800e/789595). Secondary; the 20-F's 220 stays the headline.
  wphLater: 230,
  // TWINSCAN dual stage, also NA 0.33 and 26 x 33 mm: https://www.asml.com/en/products/euv-lithography-systems/twinscan-nxe-3600d (per-wafer measurements at a
  // metrology position while another, just-measured wafer is exposed)
  waferStages: 2,
};
export const SECONDS_PER_WAFER = 3600 / SCANNER.wph; // derived: ≈16.4 s per wafer

// ---- the process the slider steps through, in order ----
// id, legend name, what the readout says while it runs
export const STEPS = [
  { id: "coat", name: "Coat resist", say: "spin coat · resist spreads into a thin film" },
  { id: "softbake", name: "Soft bake", say: "soft bake · hot plate drives out solvent" },
  { id: "load", name: "Wafer to stage", say: "through the load lock onto the stage, in vacuum" },
  { id: "droplet", name: "Tin droplet hit", say: `${(LIGHT.dropletsPerS / 1000).toFixed(0)},000 droplets/s · laser hit → ${LIGHT.wavelengthNm} nm light` },
  { id: "illuminate", name: "Light to reticle", say: "collector → focus → facet mirrors → reticle" },
  { id: "project", name: "Projected 4× smaller", say: `${OPTICS.pobMirrors} mirrors · NA ${OPTICS.na} · image ${OPTICS.reduction}× smaller` },
  { id: "scan", name: "Scan field by field", say: `${SCANNER.fields} fields · reticle moves ${OPTICS.reduction}× the wafer` },
  { id: "peb", name: "Post-exposure bake", say: "post-exposure bake · exposed resist reacts" },
  { id: "develop", name: "Develop", say: "developer puddle · the pattern appears" },
];

export const IDLE = `${SCANNER.name} · ${LIGHT.wavelengthNm} nm · NA ${OPTICS.na} · ${SCANNER.wph} wph`;
