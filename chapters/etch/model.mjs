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
  densityCm3: 1e11, // high density ~1e11 cm^-3 at < tens of mTorr, Hoekstra & Kushner, J. Appl. Phys. 79, 2275 (1996): https://cpseg.eecs.umich.edu/pub/articles/jap_79_2275_1996.pdf
  densityHiCm3: 1e12, // > 1e11 to 1e12 cm^-3 at 1-20 mTorr, Ventzek et al., Appl. Phys. Lett. 63, 605 (1993): https://cpseg.eecs.umich.edu/pub/articles/aphl_63_605_1993.pdf
  setpointMTorr: 10, // illustrative setpoint inside the 2-100 mTorr window above, not a recipe
};

export const ENDPOINT = {
  species: "CO",
  nm: 451, // "CO emits light at a wavelength of 451 nm ... the CO peak at 451 nm decreases, thus signaling an etch endpoint" (oxide etch), US 6,238,937: https://patents.google.com/patent/US6238937B1/en
};

export const HAR = {
  // Lam Cryo 3.0 (2024), a cryogenic etch on Lam's dielectric etch line (a different reactor class from the Kiyo conductor-etch chamber drawn here):
  depthUm: 10, // "memory channels with depths of up to 10 microns": https://www.emsnow.com/?p=42504
  ratio: 50, // "more than 50 times deeper than their width" (Counterpoint, same article)
  deviationPct: 0.1, // "less than 0.1%" profile deviation (same article)
  rateX: 2.5, // "etches two-and-a-half times faster" than conventional dielectric processes (same article)
};

export const KIYO = {
  // Lam's Kiyo family is its conductor etch line (STI, gates, FinFET, multi-patterning, 3D NAND): https://www.lamresearch.com/product/kiyo-product-family/
  name: "Kiyo",
  kind: "conductor etch",
};

// Pressures shown while pumping down are illustrative (atmosphere, then falling); 760 Torr is one atmosphere by definition.
export const ATM_TORR = 760;

const exp = (v) => {
  const e = Math.floor(Math.log10(v));
  return `10${["⁰", "¹", "²", "³", "⁴", "⁵", "⁶", "⁷", "⁸", "⁹", "¹⁰", "¹¹", "¹²"][e]}`;
};
export const densityText = `${exp(ICP.densityCm3)}–${exp(ICP.densityHiCm3)} cm⁻³`;

// The process the slider steps through, in order. `say` is the readout while that step runs.
export const STEPS = [
  { id: "pump", name: "Pump down", say: "pumping down · turbo pulls the chamber to vacuum" },
  { id: "gas", name: "Gas in", say: `etch gas in · held near ${ICP.setpointMTorr} mTorr` },
  { id: "strike", name: "Strike plasma", say: `coil on · ${ICP.rfMHz} MHz · plasma lit` },
  { id: "bias", name: "Bias on", say: "chuck bias on · ions pulled straight down" },
  { id: "etch", name: "Trench deepens", say: "ions + radicals etch · sidewalls passivated" },
  { id: "endpoint", name: "Endpoint", say: `${ENDPOINT.species} ${ENDPOINT.nm} nm line falls · stop` },
  { id: "strip", name: "Strip resist", say: "oxygen plasma ashes the resist mask" },
];

// Legend parts, in order. Each `say` is the readout when the part is picked.
export const PARTS = {
  coil: { name: "TCP coil and RF match", say: `flat RF coil · ${ICP.rfMHz} MHz · makes the plasma` },
  window: { name: "Dielectric window and gas injector", say: "ceramic window passes RF · gas enters at its centre" },
  plasma: { name: "Plasma", say: `dense plasma · ${densityText} at a few mTorr` },
  chuck: { name: "Electrostatic chuck and focus ring", say: `${WAFER.diameterMm} mm wafer held by charge · its own RF bias` },
  pump: { name: "Throttle valve and turbo pump", say: `holds ${ICP.pressureMTorr[0]}–${ICP.pressureMTorr[1]} mTorr while gas flows` },
  oes: { name: "Viewport and OES spectrometer", say: `watches the plasma's light · ${ENDPOINT.species} at ${ENDPOINT.nm} nm` },
  body: { name: "Chamber body and liner", say: "machined aluminium · replaceable liner" },
};

export const IDLE = `ICP etch · ${WAFER.diameterMm} mm wafer · ${ICP.rfMHz} MHz coil`;
