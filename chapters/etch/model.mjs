// The facts the figure and the lesson show. Every readout, caption and lesson number reads from here.
// Chamber, chuck and pump dimensions in build.mjs are illustrative (drawn near real scale around a 300 mm wafer, not taken from a drawing).

export const WAFER = {
  diameterMm: 300, // SEMI 3D10 reference wafer, nominal 300 mm (SEMI M1 family): https://store-us.semi.org/products/3d01000-semi-3d10-guide-to-describing-materials-properties-for-intermediate-wafers-for-use-in-a-300-mm-3ds-ic-wafer-stack-1
  thicknessUm: 775, // same source, nominal 775 µm
};

export const ICP = {
  rfMHz: 13.56, // ICP source frequency; example ICP-RIE tool spec, OIST: https://www.oist.jp/node/41134
  sourceW: 3000, // "ICP power source: up to 3000 W at 13.56 MHz", OIST lab tool (an example, not a Lam spec): https://www.oist.jp/node/41134
  pressureMTorr: [2, 100], // "Process pressure: 2 to 100 mTorr", OIST: https://www.oist.jp/node/41134
  // "ICP sources can provide high-density (n_p values ranging from 1x10^11 cm^-3 to over 5x10^12 cm^-3) plasmas", US 5,846,883: https://patents.google.com/patent/US5846883A/en
  densityCm3: 1e11,
  // "electron densities approaching 10^12/cm3 were obtained in 1.33 Pa [10 mTorr] argon at 300 W input", Miller et al., NIST GEC reference cell ICP, J. Res. NIST 100 (1995): https://pmc.ncbi.nlm.nih.gov/articles/PMC4887237/
  // (consistent with the Kushner-group ICP models, e.g. Hoekstra & Kushner, J. Appl. Phys. 79, 2275 (1996), scanned: https://cpseg.eecs.umich.edu/pub/articles/jap_79_2275_1996.pdf)
  densityHiCm3: 1e12,
  setpointMTorr: 10, // illustrative setpoint inside the 2-100 mTorr window above, not a recipe
};

export const ENDPOINT = {
  // A conductor (polysilicon gate) etch in Cl2/HBr, the work a Kiyo-class chamber does.
  // "The endpoint is determined by optical emission spectroscopy by observing the decline of a silicon peak at 405 nm",
  // with Cl2 70-90 sccm and HBr 110-130 sccm, US 6,242,350: https://patents.google.com/patent/US6242350B1/en
  // The same patent calls the 405 nm peak "SiClx" for its WSix step ("the change of the SiClx peak at 405 nm"), so the line is
  // named as a silicon-product emission (Si/SiClx), not a bare atomic-Si line.
  species: "Si/SiClₓ",
  nm: 405,
  film: "polysilicon",
  gas: "Cl₂/HBr",
};

export const HAR = {
  // Lam Cryo 3.0 (2024), a cryogenic etch on Lam's dielectric etch line (a different reactor class from the Kiyo conductor-etch chamber drawn here):
  depthUm: 10, // "memory channels with depths of up to 10 microns": https://www.emsnow.com/?p=42504
  ratio: 50, // "more than 50 times deeper than their width" (Counterpoint, same article)
  deviationPct: 0.1, // "with less than 0.1% deviation in the feature's critical dimension from the top to the bottom" (Lam release, same article)
  rateX: 2.5, // "etches two-and-a-half times faster" than conventional dielectric processes (same article)
};

export const KIYO = {
  // Lam's Kiyo family is its conductor etch line (STI, gates, FinFET, multi-patterning, 3D NAND): https://www.lamresearch.com/product/kiyo-product-family/
  name: "Kiyo",
  kind: "conductor etch",
};

// The chamber never vents per wafer. Wafers reach it from a vacuum transfer module; only the load lock cycles to atmosphere.
// "the load lock chambers LLC1, LLC2 each communicate with atmospheric pressure" and "The transfer chamber is held at a low
// vacuum pressure", US 8,082,741: https://patents.google.com/patent/US8082741
// "A turbopump cannot expel against atmosphere and requires, therefore, a vacuum on the exhaust side (the forevacuum)",
// Pfeiffer Vacuum, Working with Turbopumps: https://mmrc.caltech.edu/Vacuum/Pfeiffer%20Turbo/Turbos.pdf
// The two pressures the pump-down readout runs between are illustrative, not from a spec:
export const TRANSFER_MTORR = 100; // illustrative: transfer-module pressure when the slit valve shuts
export const BASE_MTORR = 0.1; // illustrative: base pressure reached before gas goes in

const exp = (v) => {
  const e = Math.floor(Math.log10(v));
  return `10${["⁰", "¹", "²", "³", "⁴", "⁵", "⁶", "⁷", "⁸", "⁹", "¹⁰", "¹¹", "¹²"][e]}`;
};
export const densityText = `${exp(ICP.densityCm3)}–${exp(ICP.densityHiCm3)} cm⁻³`;

// The process the slider steps through, in order. `say` is the readout while that step runs.
export const STEPS = [
  { id: "pump", name: "Pump to base", say: "slit valve shut · turbo pumps to base" },
  { id: "gas", name: "Gas in", say: `etch gas in · held near ${ICP.setpointMTorr} mTorr` },
  { id: "strike", name: "Strike plasma", say: `coil on · ${ICP.rfMHz} MHz · plasma lit` },
  { id: "bias", name: "Bias on", say: "chuck bias on · ions pulled straight down" },
  { id: "etch", name: "Trench deepens", say: "etching · sidewalls passivated" },
  { id: "endpoint", name: "Endpoint", say: `${ENDPOINT.species} ${ENDPOINT.nm} nm line falls · stop` },
  { id: "strip", name: "Strip resist", say: "oxygen plasma ashes the resist mask" },
];

// Legend parts, in order. Each `say` is the readout when the part is picked.
export const PARTS = {
  coil: { name: "TCP coil and RF match", say: `flat RF coil · ${ICP.rfMHz} MHz · makes the plasma` },
  window: { name: "Dielectric window and gas injector", say: "ceramic window passes RF · gas enters at its centre" },
  plasma: { name: "Plasma", say: `dense plasma · ${densityText} at a few mTorr` },
  chuck: { name: "Electrostatic chuck and focus ring", say: `${WAFER.diameterMm} mm wafer held by charge · its own RF bias` },
  pump: { name: "Throttle valve, turbo and foreline", say: `holds ${ICP.pressureMTorr[0]}–${ICP.pressureMTorr[1]} mTorr · exhausts to a dry pump` },
  oes: { name: "Viewport and OES spectrometer", say: `watches the plasma's light · ${ENDPOINT.species} at ${ENDPOINT.nm} nm` },
  body: { name: "Chamber body and liner", say: "machined aluminium · replaceable liner" },
};

export const IDLE = `ICP etch · ${WAFER.diameterMm} mm wafer · ${ICP.rfMHz} MHz coil`;
