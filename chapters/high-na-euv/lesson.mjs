// Reading text under the figure. Numbers come from model.mjs; sources are the ones the model was checked against.
import * as M from "./model.mjs";

const f1 = (v) => v.toFixed(1);

export const LESSON = {
  intro: `High-NA EUV keeps the same ${M.LIGHT_NM} nm light as today's EUV scanners but collects it in a much wider cone, which lets it print features about ${M.HIGH.featureShrink} times smaller in one exposure. The price is a bigger, heavier, costlier machine and an exposure field half the usual size. Press Play to follow the light down to the wafer and watch two half fields become one die.`,
  steps: [
    `<strong>Make the light.</strong> As in every EUV scanner, a CO2 laser turns tin droplets into a plasma that glows at ${M.LIGHT_NM} nm, and a collector mirror focuses it into the machine. ASML's ${M.HIGH.name} gets more power to the wafer from an improved source.`,
    `<strong>Light the reticle.</strong> Facet mirrors in the illuminator shape the light into an even slit on the reticle, which is still the standard 6-inch mask with a ${M.RETICLE_FIELD_MM[0]} × ${M.RETICLE_FIELD_MM[1]} mm pattern area.`,
    `<strong>Shrink it unevenly.</strong> The projection optics are anamorphic: they shrink the pattern ${M.HIGH.reduction[0]}× across the slit and ${M.HIGH.reduction[1]}× along the scan, instead of ${M.LOW.reduction[0]}× both ways. A wider cone of light would otherwise strike the reticle at angles its multilayer mirror coating handles badly; the extra shrink along the scan keeps those angles small.`,
    `<strong>A wider cone.</strong> Numerical aperture is the sine of the cone's half-angle. At NA ${M.HIGH.na} the light arrives at up to ${f1(M.CONE_DEG.high)}° from vertical, against ${f1(M.CONE_DEG.low)}° at NA ${M.LOW.na}, so the image carries finer detail: ${M.HIGH.resolutionNm} nm instead of ${M.LOW.resolutionNm} nm.`,
    `<strong>Half fields.</strong> The ${M.HIGH.reduction[1]}× shrink along the scan halves the printed field to ${M.HALF_FIELD_MM[0]} × ${M.HALF_FIELD_MM[1]} mm, so a wafer takes twice as many exposures. The reticle stage now accelerates at ${M.HIGH.reticleG} g and the wafer stage at ${M.HIGH.waferG} g (${M.HIGH.reticleGainVsNxe}× and ${M.HIGH.waferGainVsNxe}× an NXE) to win back the time.`,
    `<strong>Stitch.</strong> A die larger than a half field, such as a reticle-sized AI accelerator, is printed in two exposures from two reticles whose halves meet along a seam. Intel calls this stitching and says it lets designers keep standard masks.`,
  ],
  numbers: [
    ["Numerical aperture", `${M.HIGH.na}`, `${M.LOW.na} on NXE scanners`],
    ["Resolution", `${M.HIGH.resolutionNm} nm`, `${M.LOW.resolutionNm} nm on the ${M.LOW.name}; features ${M.HIGH.featureShrink}× smaller, density ${M.HIGH.densityGain}× higher (ASML)`],
    ["Exposure field", `${M.HALF_FIELD_MM[0]} × ${M.HALF_FIELD_MM[1]} mm`, `half of ${M.NXE_FIELD_MM[0]} × ${M.NXE_FIELD_MM[1]} mm, from ${M.HIGH.reduction[0]}×/${M.HIGH.reduction[1]}× optics (derived)`],
    ["Throughput", `≥${M.HIGH.wph} wafers/hour`, `${M.HIGH.name} at ${M.HIGH.doseMjCm2} mJ/cm²; the ${M.HIGH.first} is rated ≥${M.HIGH.wphFirst}`],
    ["Projection optics", `≈${M.ZEISS.pobTonnes} t, ${M.ZEISS.pobParts.toLocaleString("en-US")}+ parts`, `ZEISS: ${M.ZEISS.pobVsNxe}× the volume and weight of today's EUV optics`],
    ["Whole machine", `over ${M.MACHINE.tonnes} t`, `Heise, for Intel's first ${M.HIGH.first}`],
    ["Price", `≈€${M.MACHINE.priceLowM} M`, "Heise's figure for the EXE:5000; other press reports run to $400 M, and ASML publishes no list price"],
  ],
  innovationsTitle: "Why it matters",
  innovations: [
    `One High-NA exposure can replace several low-NA exposures on the finest layers, cutting process steps, mask count and the overlay errors that come with each extra pass.`,
    `Intel was the first buyer. By September 2026 it reported more than ${M.INTEL.wafersM} million wafers through its High-NA tools and volume use on select Intel 18A layers; its EXE:5200B passed acceptance at ${M.INTEL.acceptWph} wafers an hour and ${M.INTEL.overlayNm} nm overlay (as reported). Intel 14A is its first node designed around High-NA, with risk production planned for ${M.INTEL.risk14A}.`,
    `The cost is size and speed: a field half as large means twice the exposures, so throughput depends on much faster stages and a stronger source, and a reticle-sized die must be stitched.`,
  ],
  sources: [
    ["ASML: TWINSCAN EXE:5200B (0.55 NA, 8 nm, ≥175 wph at 50 mJ/cm²)", "https://www.asml.com/en/products/euv-lithography-systems/twinscan-exe-5200b"],
    ["ASML: 5 things you should know about High NA EUV (4×/8×, half field, 8 g and 32 g stages)", "https://www.asml.com/en/news/stories/2024/5-things-high-na-euv"],
    ["ASML: TWINSCAN NXE:3800E (0.33 NA, 13 nm)", "https://www.asml.com/en/products/euv-lithography-systems/twinscan-nxe-3800e"],
    ["ZEISS: High-NA EUV optics (12 t, 40,000 parts, mirrors 2× larger)", "https://www.zeiss.com/semiconductor-manufacturing-technology/inspiring-technology/high-na-euv-lithography.html"],
    ["Intel: Intel Foundry and ASML accelerate readiness for High-NA EUV (Sept 2026)", "https://www.intel.com/content/www/us/en/newsroom/news/intel-foundry/intel-foundry-asml-accelerate-industry-readiness-for-high-na-euv.html"],
    ["Heise: Intel's High-NA system is up and running (over 150 t, €350 M)", "https://heise.de/-9690285"],
    ["Bits&Chips: Intel confirms High-NA EUV for its 14A node", "https://bits-chips.com/article/intel-confirms-high-na-euv-deployment-for-14a-node"],
  ],
};
