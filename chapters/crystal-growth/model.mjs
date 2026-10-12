// The facts the figure shows. Every readout, caption number and drawn size reads from here.
// Values marked "illustrative" are chosen to draw a plausible machine; everything else carries its source.

export const SRC = {
  rsc: "https://periodic-table.rsc.org/element/14/silicon",
  tu: "https://www.electrochem.org/dl/ma/201/pdfs/0564.pdf", // Tu et al., Growth of 300 mm Si single crystals in a 24-inch hot zone (ECS Meeting Abstracts 201)
  ekz: "https://pdf.directindustry.com/pdf/pva-tepla-group/ekz-3500/54259-341859.html", // PVA TePla EKZ 3500 catalogue
  siltronic: "https://www.siltronic.com/en/press/press-releases/siltronic-inaugurates-extension-to-crystal-pulling-hall-at-freiberg-site.html",
  dashPatent: "https://patents.google.com/patent/US6670036", // seed 8-20 mm, Dash neck 3-5 mm at its narrowest; growth with or without necking
  dash: "https://doi.org/10.1063/1.1735186", // W. C. Dash, Growth of silicon crystals free from dislocations, J. Appl. Phys. 30, 459 (1959)
  ohsaka: "https://authors.library.caltech.edu/5430/", // Ohsaka et al. 1997, liquid Si density at Tm
  hmcz: "https://patents.justia.com/patent/8460462", // HMCZ, oxygen below 5e17 /cm3
  field: "https://patents.google.com/patent/US5968264", // "The intensity of the applied magnetic field is not less than 2000 G"; a horizontal field is preferred
  purge: "https://patents.google.com/patent/US8187383", // SiO evaporated from the melt surface is entrained in the inert purge gas and discharged at the chamber bottom
};

export const SI = {
  meltC: 1414, // melting point, deg C. SRC.rsc
  solidDensity: 2.329, // g/cm3 at room temperature. SRC.rsc
  liquidDensity: 2.58, // g/cm3 at the melting point. SRC.ohsaka
};

// The process the figure follows: a 300 mm crystal in a 24-inch hot zone (Tu et al., SRC.tu).
export const RUN = {
  crystalMm: 300, // SRC.tu, SRC.siltronic
  hotZoneIn: 24, // crucible / hot zone size, inches. SRC.tu
  hotZoneMainIn: 32, // "most of the 300 mm crystals are now produced in 32-inch hot zones" (as of 2002). SRC.tu
  hotZoneMainYear: 2002, // year of the Tu et al. abstract. SRC.tu
  chargeKg: 140, // SRC.tu
  crystalRpm: [5, 14], // SRC.tu
  crucibleRpm: [6, 12], // SRC.tu
  oxygenPpma: [23, 33], // controlled range with a cusp field. SRC.tu
  days: [5, 7], // a pulling run at Siltronic Freiberg, for ~300 mm ingots of "several hundred kilograms" (larger than the 140 kg Tu et al. run drawn). SRC.siltronic
  seedMm: [8, 20], // conventional seed diameter. SRC.dashPatent
  neckMm: 3, // Dash neck diameter drawn and quoted, the low end of the range. SRC.dashPatent, SRC.dash
  neckRangeMm: [3, 5], // minimum neck diameter. SRC.dashPatent
  residualKg: 8, // melt left in the crucible at the end, illustrative
  spinCrystal: 10, // rpm drawn, inside SRC.tu's range
  spinCrucible: 8, // rpm drawn, opposite direction, inside SRC.tu's range
};

// A 24-inch puller for 300 mm crystals (PVA TePla EKZ 3500, SRC.ekz).
export const PULLER = {
  crucibleMm: 610, // 24 inches. SRC.ekz
  vesselMm: 940, // chamber diameter. SRC.ekz
  vesselHeightMm: 1680, // SRC.ekz
  gateMm: 360, // gate valve bore. SRC.ekz
  crystalLengthMm: 2500, // longest crystal it can pull. SRC.ekz
  chargeMaxKg: 200, // SRC.ekz
  massKg: 9000, // puller, without its power cabinet. SRC.ekz
};

// MCZ: a magnetic field across the melt damps convection, which carries oxygen from the quartz to the crystal.
export const MCZ = {
  fieldG: 2000, // at least, horizontal field preferred. SRC.field (US 5968264)
  oxygenBelow: 5e17, // atoms/cm3, HMCZ result. SRC.hmcz
};

// ---- the crystal, real millimetres from the seed's top downward ----
// Seed and neck lengths, shoulder and tail heights are illustrative; diameters are sourced.
const SEED_LEN = 100;
const NECK_LEN = 200;
const SHOULDER_LEN = 150;
const TAIL_LEN = 200;
const R_SEED = 6; // 12 mm seed, inside 8-20 mm
export const SEED_MM = R_SEED * 2;
const R_NECK = RUN.neckMm / 2;
const R_BODY = RUN.crystalMm / 2;
const R_TAIL_END = 10;

const shoulderR = (t) => R_NECK + (R_BODY - R_NECK) * Math.sin((Math.PI / 2) * t); // rounded crown
const tailR = (t) => R_BODY - (R_BODY - R_TAIL_END) * t * t;

const volumeMm3 = (r, len, n = 400) => {
  let v = 0;
  for (let i = 0; i < n; i++) v += Math.PI * r((i + 0.5) / n) ** 2 * (len / n);
  return v;
};
const KG_PER_MM3 = SI.solidDensity / 1e6;
const shoulderKg = volumeMm3(shoulderR, SHOULDER_LEN) * KG_PER_MM3;
const tailKg = volumeMm3(tailR, TAIL_LEN) * KG_PER_MM3;
export const bodyKgPerM = Math.PI * R_BODY * R_BODY * 1000 * KG_PER_MM3; // about 165 kg per metre of 300 mm body
export const ingotKg = RUN.chargeKg - RUN.residualKg;
export const bodyMm = Math.round(((ingotKg - shoulderKg - tailKg) / bodyKgPerM) * 1000);

// Growth length runs from the seed tip (dipped) downward: neck, shoulder, body, tail.
export const SEG = { seed: SEED_LEN, neck: NECK_LEN, shoulder: SHOULDER_LEN, body: bodyMm, tail: TAIL_LEN };
export const GROWN_MM = NECK_LEN + SHOULDER_LEN + bodyMm + TAIL_LEN;

// Real radius at growth length g (mm below the seed tip).
export function realRadius(g) {
  if (g < 0) return R_SEED;
  if (g < NECK_LEN) return R_NECK;
  if (g < NECK_LEN + SHOULDER_LEN) return shoulderR((g - NECK_LEN) / SHOULDER_LEN);
  if (g < NECK_LEN + SHOULDER_LEN + bodyMm) return R_BODY;
  return tailR(Math.min(1, (g - NECK_LEN - SHOULDER_LEN - bodyMm) / TAIL_LEN));
}

export function grownKg(g) {
  const n = 300;
  let v = 0;
  const to = Math.min(g, GROWN_MM);
  for (let i = 0; i < n; i++) v += Math.PI * realRadius(((i + 0.5) / n) * to) ** 2 * (to / n);
  return v * KG_PER_MM3;
}

// melt depth in a flat-bottomed 24-inch crucible (illustrative: real crucibles have a rounded bottom)
export const meltDepthMm = (kg) => (kg / SI.liquidDensity) * 1e6 / (Math.PI * (PULLER.crucibleMm / 2) ** 2);

// ---- the process the slider steps through ----
export const STEPS = [
  { id: "melt", label: "Melt the charge", say: `${RUN.chargeKg} kg polysilicon and a boron dopant melt at ${SI.meltC} °C` },
  { id: "dip", label: "Dip the seed", say: `a ${R_SEED * 2} mm seed lowers, warms, and touches the melt` },
  { id: "neck", label: "Dash neck", say: `pulled fast to a ${RUN.neckMm} mm neck, so dislocations grow out` },
  { id: "shoulder", label: "Shoulder", say: `slowed down, the crystal widens to ${RUN.crystalMm} mm` },
  { id: "body", label: "Body", say: `${RUN.crystalMm} mm held constant by heater power and pull speed` },
  { id: "tail", label: "Tail", say: "pulled faster, it narrows to a cone so no dislocations run back up" },
  { id: "cool", label: "Cool and remove", say: "lifted into the pull chamber, gate closed, cooled for removal" },
];

// slider share of each step (illustrative pacing, not true time: the body takes most of a multi-day run)
export const SPAN = [0.14, 0.1, 0.1, 0.12, 0.3, 0.1, 0.14];

export const IDLE = `Czochralski puller · ${RUN.crystalMm}\u00a0mm · ${RUN.hotZoneIn}"\u00a0hot\u00a0zone · ${RUN.chargeKg}\u00a0kg\u00a0charge`;
