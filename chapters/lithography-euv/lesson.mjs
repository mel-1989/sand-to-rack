// Reading text under the figure. Numbers come from model.mjs; sources are the ones the model was checked against.
import * as M from "./model.mjs";

const pct = (v) => `${Math.round(v * 100)}%`;

export const LESSON = {
  intro: `Lithography prints a chip's pattern onto the wafer, one layer at a time. A track coats the wafer with a light-sensitive film called resist, and the scanner projects a pattern onto it with ${M.LIGHT.wavelengthNm} nm extreme ultraviolet (EUV) light, ${M.OPTICS.reduction} times smaller than the mask. Press Play to follow one wafer through both machines.`,
  steps: [
    `<strong>Coat and bake.</strong> The track spins the wafer while a nozzle drops resist on its centre; spinning spreads it into a thin, even film. A hot plate then drives out the solvent (the soft bake).`,
    `<strong>Make the light.</strong> In the source vessel, a ${M.LIGHT.laserKw} kW CO2 laser hits ${M.LIGHT.dropletsPerS.toLocaleString("en-US")} tin droplets a second. A weak pre-pulse flattens each droplet and the main pulse turns it into a plasma at about ${M.LIGHT.plasmaC.toLocaleString("en-US")} °C, which glows at ${M.LIGHT.wavelengthNm} nm. A curved collector mirror focuses that light through a small opening, the intermediate focus.`,
    `<strong>Shape it and bounce it off the mask.</strong> EUV light is absorbed by air and by glass, so the scanner works in vacuum and uses only mirrors. The illuminator's facet mirrors turn the light into an even slit, which falls on the reticle: a mirror-like mask with the circuit pattern in an absorbing layer, held face down.`,
    `<strong>Project it 4× smaller.</strong> Six projection mirrors (NA ${M.OPTICS.na}) image the lit slit of the reticle onto the wafer, ${M.OPTICS.reduction} times smaller. The reticle and the wafer scan past the slit in opposite directions, the reticle ${M.OPTICS.reduction} times faster, so one sweep prints a whole ${M.OPTICS.fieldMm[0]} × ${M.OPTICS.fieldMm[1]} mm field. The stage then steps to the next field: ${M.SCANNER.fields} of them per wafer. Meanwhile a second wafer stage maps the next wafer's height and alignment marks, so the two stages swap and exposure never waits for measurement.`,
    `<strong>Bake and develop.</strong> Back in the track, a post-exposure bake finishes the chemistry where the light fell, and a developer puddle dissolves the exposed (or unexposed) resist. The pattern now stands in the resist, ready for etch.`,
  ],
  numbers: [
    ["Wavelength", `${M.LIGHT.wavelengthNm} nm`, `deep UV scanners use ${M.LIGHT.duvNm} nm`],
    ["Numerical aperture", `${M.OPTICS.na}`, `${M.OPTICS.reduction}× reduction · ${M.OPTICS.fieldMm[0]} × ${M.OPTICS.fieldMm[1]} mm field`],
    ["Throughput", `${M.SCANNER.wph} wafers/hour`, `${M.SCANNER.name} at ${M.SCANNER.doseMjCm2} mJ/cm², ${M.SCANNER.fields} fields; ≈${M.SECONDS_PER_WAFER.toFixed(1)} s a wafer, derived`],
    ["Tin droplets", `${M.LIGHT.dropletsPerS.toLocaleString("en-US")} per second`, `${M.LIGHT.dropletUm} µm across at ${M.LIGHT.dropletSpeedMs} m/s, ${M.DROPLET_GAP_MM.toFixed(1)} mm apart (derived)`],
    ["Mirror reflectance", `up to ${pct(M.OPTICS.reflectance)} each`, `${M.OPTICS.pobMirrors} projection mirrors pass ≈${pct(M.POB_PASS)} of the light (0.7⁶, derived)`],
    ["Price", `≈$${M.SCANNER.priceM[0]}–${M.SCANNER.priceM[1]} M and up`, "trade-press estimates for NXE scanners; the 3800E costs more, and ASML publishes no list price"],
  ],
  innovationsTitle: "Why it matters",
  innovations: [
    `Shorter light prints smaller features. Moving from ${M.LIGHT.duvNm} nm to ${M.LIGHT.wavelengthNm} nm let a single exposure print layers that once needed several deep-UV exposures and extra mask steps.`,
    `Every optic is a mirror coated with up to ${M.OPTICS.layers} alternating ultra-thin layers; a single layer would reflect about 1%. Losses multiply at each bounce, which is why source power sets the scanner's speed.`,
    `The ${M.SCANNER.name} reached ${M.SCANNER.wph} wafers an hour, ${M.SCANNER.gainVs3600D}% more than the NXE:3600D, with layer-to-layer overlay of ${M.SCANNER.overlayNm} nm between matched machines.`,
    "The next step, High-NA EUV (NA 0.55), keeps the 13.5 nm light and enlarges the optics to print finer still; it has its own chapter.",
  ],
  sources: [
    ["ASML: light and lasers (tin droplets, pre-pulse and main pulse)", "https://www.asml.com/en/technology/lithography-principles/light-and-lasers"],
    ["ZEISS: EUV lithography optics (6 mirrors, ≤70% reflectance, 30 kW laser)", "https://www.zeiss.com/semiconductor-manufacturing-technology/inspiring-technology/euv-lithography.html"],
    ["ASML: TWINSCAN NXE:3600D (NA 0.33, 26 × 33 mm field, one wafer measured while another is exposed)", "https://www.asml.com/en/products/euv-lithography-systems/twinscan-nxe-3600d"],
    ["ASML Form 20-F, FY2025 (NXE:3800E at 220 wafers per hour)", "https://www.sec.gov/Archives/edgar/data/0000937966/000162828026011378/asml-20251231.htm"],
    ["ASML at SPIE 2023: NXE:3800E specification (96 fields, 0.9 nm overlay)", "https://euvlitho.com/2023/P62.pdf"],
    ["Tom's Hardware: low-NA EUV pricing", "https://www.tomshardware.com/tech-industry/semiconductors/asmls-planned-low-na-euv-machine-price-hikes-reportedly-frustrate-tsmc-lithography-machine-maker-comes-knocking-to-make-bank-on-tsmcs-profitable-fabs-potentially-costing-the-taiwanese-chipmaker-billions"],
  ],
};
