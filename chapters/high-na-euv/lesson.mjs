// Reading text under the figure. Numbers come from model.mjs; sources are the ones the model was checked against.
import * as M from "./model.mjs";

const f1 = (v) => v.toFixed(1);

export const LESSON = {
  intro: `High-NA EUV keeps the same ${M.LIGHT_NM} nm light as today's EUV scanners but collects it in a much wider cone, which lets it print features about ${M.HIGH.featureShrink} times smaller in one exposure. The price is a bigger, heavier, costlier machine and an exposure field half the usual size. Press Play to follow the light down to the wafer and watch two half fields become one die.`,
  steps: [
    `<strong>Make the light.</strong> As in every EUV scanner, a CO2 laser turns tin droplets into a plasma that glows at ${M.LIGHT_NM} nm, and a collector mirror focuses it into the machine. ASML's ${M.HIGH.name} gets more power to the wafer from an improved source.`,
    `<strong>Light the reticle.</strong> Facet mirrors in the illuminator shape the light into an even slit on the reticle, which is still the standard 6-inch mask with a ${M.RETICLE_FIELD_MM[0]} × ${M.RETICLE_FIELD_MM[1]} mm pattern area.`,
    `<strong>Shrink it unevenly.</strong> The projection optics are anamorphic: they shrink the pattern ${M.HIGH.reduction[0]}× across the slit and ${M.HIGH.reduction[1]}× along the scan, instead of ${M.LOW.reduction[0]}× both ways. The bigger mirrors a higher NA needs make light strike the reticle at a steeper angle, where its mirror coating stops reflecting. Shrinking 8× both ways would fix that but needs a larger reticle; shrinking 8× only along the scan keeps the standard one (ASML).`,
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
    ["Whole machine", `over ${M.MACHINE.tonnes} t`, `Heise, for Intel's first ${M.HIGH.first}; ASML's qualification lead calls it bigger than a double-decker bus (CNBC)`],
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
    ["CNBC: inside the making of High NA (bigger than a double-decker bus)", "https://www.nbcwashington.com/news/business/money-report/exclusive-look-at-the-making-of-high-na-asmls-new-400-million-chipmaking-colossus/3919541/"],
    ["Bits&Chips: Intel confirms High-NA EUV for its 14A node", "https://bits-chips.com/article/intel-confirms-high-na-euv-deployment-for-14a-node"],
  ],
};

// A flat side-by-side under the figure: the two light cones, and one full field against two stitched half fields.
// Angles are true (NA = sin of the half-angle); fields are drawn at 2 px per mm.
function compare() {
  const col = (cx, na, label, fields) => {
    const h = 92;
    const apex = [cx, 126];
    const half = h * Math.tan(Math.asin(na));
    const top = apex[1] - h;
    const deg = ((Math.asin(na) * 180) / Math.PI).toFixed(1);
    const arcR = 30;
    const a = Math.asin(na);
    const ax = apex[0] + arcR * Math.sin(a);
    const ay = apex[1] - arcR * Math.cos(a);
    const cone = `<path class="hna-cmp-glow" d="M${apex[0]} ${apex[1]}L${cx - half} ${top}L${cx + half} ${top}Z"/><path class="hna-cmp-ray" d="M${cx - half} ${top}L${apex[0]} ${apex[1]}L${cx + half} ${top}"/>`;
    const mirror = `<path class="hna-cmp-mirror" d="M${cx - half - 8} ${top - 4}Q${cx} ${top + 8} ${cx + half + 8} ${top - 4}"/>`;
    const axis = `<path class="hna-cmp-axis" d="M${cx} ${top + 6}L${cx} ${apex[1]}"/>`;
    const arc = `<path class="hna-cmp-axis" d="M${cx} ${apex[1] - arcR}A${arcR} ${arcR} 0 0 1 ${ax.toFixed(1)} ${ay.toFixed(1)}"/>`;
    const text = `<text x="${cx}" y="${apex[1] + 18}" class="hna-cmp-t">${label}</text><text x="${cx + 34}" y="${apex[1] - 34}" class="hna-cmp-s" text-anchor="start">${deg}°</text>`;
    return mirror + cone + axis + arc + `<circle cx="${apex[0]}" cy="${apex[1]}" r="2" class="hna-cmp-dot"/>` + text + fields;
  };
  const S = 2; // px per mm
  const [fw, fh] = M.NXE_FIELD_MM.map((v) => v * S);
  const fy = 170;
  const full = (cx) => `<rect x="${cx - fw / 2}" y="${fy}" width="${fw}" height="${fh}" class="hna-cmp-field"/><text x="${cx + fw / 2 + 10}" y="${fy + fh / 2 + 4}" class="hna-cmp-s" text-anchor="start">${M.NXE_FIELD_MM[0]} × ${M.NXE_FIELD_MM[1]} mm · one scan</text>`;
  const halves = (cx) => `<rect x="${cx - fw / 2}" y="${fy}" width="${fw}" height="${fh / 2}" class="hna-cmp-field"/><rect x="${cx - fw / 2}" y="${fy + fh / 2}" width="${fw}" height="${fh / 2}" class="hna-cmp-field hna-cmp-b"/><path class="hna-cmp-seam" d="M${cx - fw / 2} ${fy + fh / 2}L${cx + fw / 2} ${fy + fh / 2}"/><text x="${cx + fw / 2 + 10}" y="${fy + fh / 4 + 4}" class="hna-cmp-s" text-anchor="start">${M.HALF_FIELD_MM[0]} × ${M.HALF_FIELD_MM[1]} mm · scan A</text><text x="${cx + fw / 2 + 10}" y="${fy + (3 * fh) / 4 + 4}" class="hna-cmp-s" text-anchor="start">scan B, stitched</text>`;
  const left = col(150, M.LOW.na, `NA ${M.LOW.na} · ${M.LOW.resolutionNm} nm`, full(110));
  const right = col(470, M.HIGH.na, `NA ${M.HIGH.na} · ${M.HIGH.resolutionNm} nm`, halves(430));
  return `<section class="hna-cmp"><h2>0.33 NA and 0.55 NA, side by side</h2><svg viewBox="0 0 640 250" role="img" aria-label="Left: the 0.33 NA light cone, half-angle ${M.CONE_DEG.low.toFixed(1)} degrees, printing one ${M.NXE_FIELD_MM[0]} by ${M.NXE_FIELD_MM[1]} mm field. Right: the 0.55 NA cone, half-angle ${M.CONE_DEG.high.toFixed(1)} degrees, printing two ${M.HALF_FIELD_MM[0]} by ${M.HALF_FIELD_MM[1]} mm half fields stitched into the same area.">${left}${right}</svg><p>Same light, wider cone: the larger angle lets finer detail through the optics. The price is a field half as tall, so a full-size die takes two scans and a stitch.</p></section>`;
}
LESSON.more = compare();
