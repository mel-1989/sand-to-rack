// Reading text under the figure. Numbers come from model.mjs; sources are the ones the model was checked against.
import * as M from "./model.mjs";

const pct = (v) => `${Math.round(v * 100)}%`;

export const LESSON = {
  intro: `Lithography prints a chip's pattern onto the wafer, one layer at a time. A track coats the wafer with a light-sensitive film called resist, and the scanner projects a pattern onto it with ${M.LIGHT.wavelengthNm} nm extreme ultraviolet (EUV) light, ${M.OPTICS.reduction} times smaller than the mask. Press Play to follow one wafer through both machines.`,
  steps: [
    `<strong>Coat and bake.</strong> The track spins the wafer while a nozzle drops resist on its centre; spinning spreads it into a thin, even film. A hot plate then drives out the solvent (the soft bake).`,
    `<strong>Make the light.</strong> In the source vessel, a ${M.LIGHT.laserKw} kW CO2 laser hits ${M.LIGHT.dropletsPerS.toLocaleString("en-US")} tin droplets a second. A weak pre-pulse flattens each droplet and the main pulse turns it into a plasma at about ${M.LIGHT.plasmaC.toLocaleString("en-US")} °C, which glows at ${M.LIGHT.wavelengthNm} nm. A curved collector mirror focuses that light through a small opening, the intermediate focus.`,
    `<strong>Shape it and bounce it off the mask.</strong> EUV light is absorbed by air and by glass, so the scanner works in vacuum and uses only mirrors. The illuminator's facet mirrors turn the light into an even slit, which falls on the reticle: a mirror-like mask with the circuit pattern in an absorbing layer, held face down.`,
    `<strong>Project it 4× smaller.</strong> Six projection mirrors (NA ${M.OPTICS.na}) image the lit slit of the reticle onto the wafer, ${M.OPTICS.reduction} times smaller. The numerical aperture (NA) says how wide a cone of light the optics collect: it is the sine of the cone's half-angle. The smallest printable half-pitch is about k1 × wavelength ÷ NA, where k1 is a process factor that cannot go below ${M.RAYLEIGH.k1Limit}; at a practical k1 of about ${M.RAYLEIGH.k1Typical} (illustrative), ${M.LIGHT.wavelengthNm} nm ÷ ${M.OPTICS.na} gives lines of roughly ${Math.round(M.HALF_PITCH_NM)} nm. The reticle and the wafer scan past the slit in opposite directions, the reticle ${M.OPTICS.reduction} times faster, so one sweep prints a whole ${M.OPTICS.fieldMm[0]} × ${M.OPTICS.fieldMm[1]} mm field. The stage then steps to the next field: ${M.SCANNER.fields} of them per wafer. Meanwhile a second wafer stage maps the next wafer's height and alignment marks, so the two stages swap and exposure never waits for measurement.`,
    `<strong>Bake and develop.</strong> Back in the track, a post-exposure bake finishes the chemistry where the light fell, and a developer puddle dissolves the exposed (or unexposed) resist. The pattern now stands in the resist, ready for etch.`,
  ],
  numbers: [
    ["Wavelength", `${M.LIGHT.wavelengthNm} nm`, `deep UV scanners use ${M.LIGHT.duvNm} nm`],
    ["Numerical aperture", `${M.OPTICS.na}`, `${M.OPTICS.reduction}× reduction · ${M.OPTICS.fieldMm[0]} × ${M.OPTICS.fieldMm[1]} mm field`],
    ["Throughput", `${M.SCANNER.wph} wafers/hour`, `${M.SCANNER.name} at ${M.SCANNER.doseMjCm2} mJ/cm², ${M.SCANNER.fields} fields (ASML 20-F); ≈${M.SECONDS_PER_WAFER.toFixed(1)} s a wafer, derived; later reported at ${M.SCANNER.wphLater} wafers/hour (2026 press)`],
    ["Tin droplets", `${M.LIGHT.dropletsPerS.toLocaleString("en-US")} per second`, `${M.LIGHT.dropletUm} µm across at ${M.LIGHT.dropletSpeedMs} m/s, ${M.DROPLET_GAP_MM.toFixed(1)} mm apart (derived)`],
    ["Mirror reflectance", `up to ${pct(M.OPTICS.reflectance)} each`, `${M.OPTICS.pobMirrors} projection mirrors pass ≈${pct(M.POB_PASS)} of the light (0.7⁶, derived)`],
    ["Price", `≈$${M.SCANNER.price3800eM} M and up`, `${M.SCANNER.name} reported at ≈$${M.SCANNER.price3800eM} M at its 2024 launch, older NXE:3400C/3600D ≈$${M.SCANNER.priceM[0]}–${M.SCANNER.priceM[1]} M; press estimates, ASML publishes no price`],
    ["Deep-UV immersion", `${M.DUV.wavelengthNm} nm · NA ${M.DUV.na}`, `water under the lens lifts NA past the dry limit of ${M.DUV.dryNa}; one exposure resolves ≤${M.DUV.resolutionNm} nm (ASML NXT:2100i)`],
  ],
  innovationsTitle: "Why it matters",
  innovations: [
    `Before EUV, and still for most layers of a 3 nm-class chip, the workhorse is the deep-UV immersion scanner: ${M.DUV.wavelengthNm} nm argon-fluoride laser light shone through a film of ultra-pure water between the last lens and the wafer, which lets the optics reach NA ${M.DUV.na}. One such exposure resolves lines down to about ${M.DUV.resolutionNm} nm. Finer pitches take multipatterning: litho-etch-litho-etch (LELE) splits one layer's pattern into two masks, each exposed and etched in turn; self-aligned double patterning (SADP) prints wide lines, grows a thin film on their sidewalls, then removes the original lines so the sidewall spacers form two lines per printed one, and doing that twice (SAQP) quarters the pitch. EUV takes over only the critical layers, where it replaces such a stack of exposures with one.`,
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
    ["ASML: the Rayleigh criterion (CD = k1 · λ / NA, k1 ≥ 0.25)", "https://www.asml.com/en/technology/lithography-principles/rayleigh-criterion"],
    ["ASML: TWINSCAN NXT:2100i (ArF immersion, 193 nm, NA 1.35, ≤38 nm)", "https://www.asml.com/en/products/duv-lithography-systems/twinscan-nxt2100i"],
    ["ASML: DUV lithography systems (immersion as the industry's workhorse)", "https://www.asml.com/en/products/duv-lithography-systems"],
    ["ASML: TWINSCAN, 20 years of innovation (immersion water, NA 1.35, double patterning)", "https://www.asml.com/en/news/stories/2021/twinscan-20-years-innovation"],
    ["NXE:3800E launch, ≈$180 M each (Tom's Hardware, via SemiWiki, March 2024)", "https://semiwiki.com/forum/threads/asml-delivers-cutting-edge-new-chipmaking-tool-%E2%80%94-third-generation-euv-enables-2nm-processors-and-beyond.19854/"],
    ["Börse Global: NXE:3800E at 230 wafers per hour (May 2026)", "https://www.boerse-global.de/asml-aktie-230-wafer-pro-stunde-mit-nxe3800e/789595"],
    ["Tom's Hardware: low-NA EUV pricing", "https://www.tomshardware.com/tech-industry/semiconductors/asmls-planned-low-na-euv-machine-price-hikes-reportedly-frustrate-tsmc-lithography-machine-maker-comes-knocking-to-make-bank-on-tsmcs-profitable-fabs-potentially-costing-the-taiwanese-chipmaker-billions"],
  ],
};
