// The facts the figure and lesson show. Every readout, caption number and step label reads from here.
// Primary source: Fraunhofer ISE, "Analysis of the electricity consumption for the production of
// electronic-grade polysilicon" (for Wacker Chemie AG), 18 Aug 2025:
//   ISE = https://www.ise.fraunhofer.de/content/dam/ise/en/documents/publications/studies/25_en_ISE_Report_Analysis-of-the-Electricity-Consumption-for-the-Production-of-Electronic-Grade-Polysilicon.pdf
// Trade press: Bernreuter Research, "Polysilicon production processes":
//   BR = https://www.bernreuter.com/polysilicon/production-processes/
// Arc furnace: NTNU, Karin Fjeldstad Jusnes research page:
//   NTNU = https://ntnu.edu/metpro/karin-fjeldstad-jusnes

export const SRC = {
  ise: "https://www.ise.fraunhofer.de/content/dam/ise/en/documents/publications/studies/25_en_ISE_Report_Analysis-of-the-Electricity-Consumption-for-the-Production-of-Electronic-Grade-Polysilicon.pdf",
  br: "https://www.bernreuter.com/polysilicon/production-processes/",
  ntnu: "https://ntnu.edu/metpro/karin-fjeldstad-jusnes",
};

// Step 1: quartz + carbon in a submerged electric arc furnace -> metallurgical-grade silicon.
export const MGSI = {
  furnaceC: 2000, // furnace runs "above 2000 °C" (NTNU)
  puritySoG: 98.5, // % Si, MG-Si used for solar-grade poly (ISE Table 4)
  purityEG: 99.5, // % Si, MG-Si used for electronic-grade poly (ISE Table 4)
};

// Step 2: MG-Si + HCl in a fluidised bed -> trichlorosilane (TCS).
export const TCS = {
  synthesisC: 300, // "approximately 300°C", fluidized bed (ISE Table 1 and p. 9)
  reaction: "Si + 3.1 HCl → 0.9 SiHCl₃ + 0.1 SiCl₄ + 1.1 H₂", // ISE Table 1
  boilC: 31.8, // TCS boiling point (ISE Table 2, from NIST; also BR)
  stcBoilC: 56.8, // SiCl4 boiling point (ISE Table 2)
};

// Step 3: multi-stage distillation.
export const DIST = {
  tempC: [30, 60], // "30–60°C, multi-stage" (ISE Table 1)
  passesEG: 5, // distillation cycles for EG polysilicon (ISE Table 4)
  passesSoG: 3, // for solar grade (ISE Table 4)
};

// Step 4: Siemens CVD in a steel bell-jar reactor.
export const CVD = {
  rodC: 1100, // "typically around 1100°C" (ISE p. 9)
  rodMaxC: 1150, // "up to 1,150 °C in a steel bell-jar reactor" (BR)
  reaction: "SiHCl₃ + H₂ → Si + 3 HCl", // ISE Table 1
  slimMm: 20, // slim rods start at 20 mm diameter (ISE p. 9)
  finalMm: [150, 180], // final rod diameter set between 150 and 180 mm (ISE p. 9)
  growEG: 1, // mm/h growth rate plausible for EG rods (ISE p. 17); ISE does not say diameter or radius
  growSoG: 1.9, // mm/h for solar grade (ISE p. 9, p. 19)
  kWhPerKgCvdEG: 66, // CVD step electricity, EG polysilicon (ISE p. 19)
  kWhPerKgEG: [92, 124], // whole-plant electricity, EG polysilicon, 2025 estimate (ISE p. 20)
  heatRecovered: [70, 85], // % of CVD energy recovered as useful heat (ISE p. 19)
};

// Step 5: harvest, crush, etch. Grades by purity (BR).
export const GRADE = {
  egNines: [10, 11], // "electronic grade for semiconductors: 10N to 11N" (BR)
  solarMonoNines: [9, 10], // mono-grade solar (BR)
};

// Drawing scale. Rod diameters follow the model at DRAW_MM per world unit; the rod count, rod
// length, bell and feed skid sizes are illustrative (the rod count is not sourced, real reactors vary).
export const DRAW_MM = 13.3;
export const FINAL_MM = 160; // inside ISE's 150-180 mm range
export const ROD_PAIRS = 6; // illustrative

export const rodRadius = (mm) => mm / 2 / DRAW_MM;

// Slider: five steps over 0..1. Deposition (step 4) takes the longest share.
export const STEPS = [
  { id: "mgsi", from: 0, to: 0.16, label: "metallurgical silicon", say: `arc furnace >${MGSI.furnaceC} °C · MG-Si ${MGSI.puritySoG}–${MGSI.purityEG} %` },
  { id: "tcs", from: 0.16, to: 0.32, label: "hydrochlorination", say: `MG-Si + HCl · ${TCS.synthesisC} °C → SiHCl₃` },
  { id: "dist", from: 0.32, to: 0.48, label: "distillation", say: `SiHCl₃ boils at ${TCS.boilC} °C · ${DIST.passesEG} passes` },
  { id: "cvd", from: 0.48, to: 0.84, label: "deposition", say: "" },
  { id: "harvest", from: 0.84, to: 1, label: "harvest", say: `rods out · ${GRADE.egNines[0]}N–${GRADE.egNines[1]}N pure` },
];

export const IDLE = `Siemens reactor · ${CVD.rodC} °C · Ø ${CVD.slimMm} → ${FINAL_MM} mm`;
