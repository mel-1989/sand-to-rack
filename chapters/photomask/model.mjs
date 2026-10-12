// The facts the figure and the lesson show. Every number carries its source.
// Geometry sizes (world units) live in build.mjs and are illustrative unless marked here.

// IMS Nanofabrication multi-beam mask writer, as described in IMS's own patent EP3070528 ([0003]-[0005]):
// https://data.epo.org/publication-server/rest/v1.2/patents/EP3070528NWA1/document.html
// and the IMS product page for the MBMW-101: https://www.ims.co.at/en/products/
export const WRITER = {
  name: "Multi-beam mask writer",
  beamsSide: 512, // 512 x 512 programmable beamlets (EP3070528 [0003]; IMS product page)
  keV: 50, // electron energy at the mask (EP3070528 [0003]; IMS product page)
  beamNm: 20, // beamlet size at the mask (EP3070528 [0003])
  fieldUm: 81.92, // beam array field at the mask, per side (EP3070528 [0003])
  reduction: 200, // 200:1 demagnifying projection optics (EP3070528, projection system description)
  currentDensity: 1, // A/cm2, no higher than (EP3070528 [0004])
  maxCurrentUA: 1.05, // µA with all beamlets on (EP3070528 [0004])
  blurNm: 5, // 1-sigma column blur (EP3070528 [0004])
  writeHours: 10, // "less than 10 hours" per mask, MBMW-101 at the 7 nm node (IMS product page)
  writeHoursHigh: 12, // about 12 h for the maximum die size (IMS CEO Platzgummer to Semiconductor Engineering, 2018, link below)
  dataGbps: 120, // datapath rate after the 2016 upgrade (IMS product page)
};
export const BEAMLETS = WRITER.beamsSide * WRITER.beamsSide; // 262,144
export const APERTURE_UM = (WRITER.beamNm / 1000) * WRITER.reduction; // 4 µm aperture opening on the plate, derived

// Single-beam (VSB) writers on dense layers: "like 30 hours or even higher" (IMS's Platzgummer to Semiconductor Engineering, 2018)
// https://semiengineering.com/multi-beam-mask-writing-finally-comes-of-age
export const VSB_HOURS = 30;
export const MASKS_PER_CHIP = [50, 100]; // "50 to 100 masks" for a new chip (same article)

// Later generations. IMS MBMW-201 for the 5 nm node, in the market from Q1 2019 (IMS history page https://www.ims.co.at/en/?p=4311);
// IMS MBMW-301 for 2 nm-class and High-NA EUV masks, released 2023 (SPIE PC12751, "MBMW-301: paving the way towards the angstrom era")
// https://opticalengineering.spiedigitallibrary.org/conference-proceedings-of-spie/PC12751/PC127510R/MBMW-301--paving-the-way-towards-the-angstrom-era/10.1117/12.2688204.full
// NuFlare MBM-3000, launched 2023: twice the beam count of its MBM-2000PLUS, beams 16 nm -> 12 nm, 3.6 A/cm2 (SPIE 13273, EMLC 2024)
// https://nanophotonics.spiedigitallibrary.org/conference-proceedings-of-spie/13273/132730O/Recent-progress-of-multi-beam-mask-writer-MBM-3000/10.1117/12.3028706.full
export const LATER = { mbmw201Year: 2019, mbmw201Node: 5, mbmw301Year: 2023, nuflareBeamNm: [16, 12], nuflareJ: 3.6 };

// Mask substrate: 152 mm square, 6.35 mm thick (the "6025" format: 6 x 6 x 0.25 inch)
// https://www.lasertec.co.jp/en/products/glossary/3550.html and EP3070528 [0003] (6" x 6" = 152.4 mm)
export const BLANK = { sideMm: 152.4, thickMm: 6.35 };

// EUV mask blank stack
// Mo/Si: "typically 40 bi-layers", resonant reflectivity up to 70 % at 13.5 nm (University of Kassel, INA)
// https://www.uni-kassel.de/forschung/en/ina/technological-electronics/research/past-projects/multilayer-structures-for-the-lithography-in-extreme-uv-euvl
// Period about 6.8 nm, reflectance above 65 % for 40-50 bilayers (Bielefeld University, D4 multilayer group)
// https://www.physik.uni-bielefeld.de/experi/d4/ml/index.html
// Ru capping layer about 2-4 nm preferred (US 11204545); TaBN absorber, example 45 nm + 30 nm (US 8168352, Example 7)
// https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/11204545
// https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/8168352
export const STACK = {
  pairs: 40,
  periodNm: 6.8,
  reflect: 70, // % peak, upper bound
  wavelengthNm: 13.5,
  capNm: [2, 4],
  capMat: "Ru",
  absorber: "TaBN",
  absorberNm: 75, // example: 45 nm TaBN + 30 nm (US 8168352), an example not a standard
};
export const MULTILAYER_NM = STACK.pairs * STACK.periodNm; // about 272 nm, derived

// Pellicle: transmittance above 90 % is the requirement, reflectivity below 0.04 %, membrane tens of nm (Lee et al., ZrSi2 study, PMC10456829)
// https://pmc.ncbi.nlm.nih.gov/articles/PMC10456829/
// "at least 90% for a single pass and 81% for a double pass" (US 9140975 B2, background)
// https://patents.google.com/patent/US9140975B2/en
// Full-size pellicle 110 x 144 mm (SPIE PC12292, 2022)
// https://journals.spiedigitallibrary.org/conference-proceedings-of-spie/0/PC122920/Full-size-EUV-pellicle-development-for-high-power/10.1117/12.2641755.full
// An EUV pellicle's total height (its stand-off above the mask) must be 2.5 mm or less; the frame itself 1.5 mm or more (US 10859909, Shin-Etsu)
// https://patents.google.com/patent/US10859909B2/en
export const PELLICLE = { transmit: 90, transmitDouble: 81, reflect: 0.04, sizeMm: [110, 144], standoffMm: 2.5 };

// Scanner: 4x reduction, 26 x 33 mm field (ASML NXE:3400B product page)
// https://asml.com/en/products/euv-lithography-systems/twinscan-nxe3400b
export const SCANNER = { reduction: 4, fieldMm: [26, 33] };
export const MASK_FIELD_MM = SCANNER.fieldMm.map((v) => v * SCANNER.reduction); // 104 x 132 mm, derived

const fmt = (value, digits = 0) => value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
export { fmt };

// Parts the reader can pick, in legend order.
export const PIECES = {
  data: { name: "Data path", say: `GDSII/OASIS in · fractured to pixels · ${WRITER.dataGbps} Gbit/s to the column` },
  gun: { name: "Electron gun", say: `one cathode · ${WRITER.keV} keV electrons` },
  aps: { name: "Aperture plate", say: `${WRITER.beamsSide} × ${WRITER.beamsSide} = ${fmt(BEAMLETS)} beamlets · each switched on or off` },
  optics: { name: "Projection optics", say: `${WRITER.reduction}:1 reduction · ${WRITER.beamNm} nm beamlets · ≤${WRITER.currentDensity} A/cm² at the mask` },
  stage: { name: "Stage and blank", say: `${BLANK.sideMm} mm blank · ${BLANK.thickMm} mm thick · resist on top` },
  chamber: { name: "Vacuum chamber", say: "high vacuum · load lock · turbo pump" },
  mask: { name: "EUV mask stack", say: `${STACK.pairs} Mo/Si pairs · ${STACK.capMat} cap · ${STACK.absorber} absorber` },
  inspect: { name: "Inspect and repair", say: "every defect found, mapped and fixed" },
  pellicle: { name: "Pellicle", say: `≥${PELLICLE.transmit} % EUV per pass · ${PELLICLE.sizeMm[0]} × ${PELLICLE.sizeMm[1]} mm` },
  stand: { name: "Isolation table", say: "" },
};

// The six process steps of the slider, in order.
export const STEPS = [
  { id: "tapeout", piece: "data", name: "Tape-out data", say: "GDSII/OASIS layout after OPC/ILT · one file per layer" },
  { id: "fracture", piece: "data", name: "Fracture", say: `polygons cut into pixel data for ${fmt(BEAMLETS)} beamlets` },
  { id: "write", piece: "stage", name: "E-beam write", say: `${WRITER.beamNm} nm beamlets · about ${WRITER.writeHours}-${WRITER.writeHoursHigh} h a mask` },
  { id: "etch", piece: "mask", name: "Develop and etch", say: `resist developed · ${STACK.absorber} etched down to the ${STACK.capMat} cap` },
  { id: "inspect", piece: "inspect", name: "Inspect and repair", say: "pattern checked against the data · defects repaired" },
  { id: "pellicle", piece: "pellicle", name: "Pellicle mount", say: `pellicle ≤${PELLICLE.standoffMm} mm tall · ≥${PELLICLE.transmit} % EUV per pass` },
];

export const IDLE = `${fmt(BEAMLETS)} beamlets · ${WRITER.keV} keV · ${WRITER.beamNm} nm`;
export const DONE = `finished EUV mask · pellicle on · ${SCANNER.reduction}× reduction in the scanner`;
