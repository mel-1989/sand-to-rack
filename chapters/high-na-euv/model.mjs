// The facts the figure and lesson show. Every readout, caption number and step reads from here.
// Geometry in build.mjs is illustrative (a schematic cutaway, not to scale); these numbers are not.

// ---- optics: what changes from 0.33 NA to 0.55 NA ----
// ASML product pages (spec digits read from the page's data-value markup, since the rendered text is an animated ticker):
// https://www.asml.com/en/products/euv-lithography-systems/twinscan-exe-5200b : 13.5 nm, 8 nm resolution, 0.55 NA, ≥175 wph at 50 mJ/cm²
// https://www.asml.com/en/products/euv-lithography-systems/twinscan-exe-5000 : 13.5 nm, 8 nm, 0.55 NA, ≥110 wph at 50 mJ/cm²
// https://www.asml.com/en/products/euv-lithography-systems/twinscan-nxe-3800e : 13.5 nm, 13 nm resolution, 0.33 NA, ≥220 wph
// ASML, "5 things you should know about High NA EUV lithography" (2024):
// https://www.asml.com/en/news/stories/2024/5-things-high-na-euv : 4x in one direction and 8x in the other, a field half
// the size of NXE's, transistors 1.7x smaller and 2.9x denser, wafer stage 8 g (2x NXE), reticle stage 32 g (4x NXE).
export const LIGHT_NM = 13.5;
export const LOW = { name: "NXE:3800E", na: 0.33, resolutionNm: 13, reduction: [4, 4], wph: 220, doseMjCm2: 30 };
export const HIGH = {
  name: "EXE:5200B",
  first: "EXE:5000",
  na: 0.55,
  resolutionNm: 8,
  reduction: [4, 8], // [across the slit (x), along the scan (y)]
  wph: 175, // ≥175 at 50 mJ/cm² (ASML EXE:5200B page)
  wphFirst: 110, // EXE:5000, ≥110 at 50 mJ/cm² (ASML EXE:5000 page)
  doseMjCm2: 50,
  featureShrink: 1.7,
  densityGain: 2.9,
  contrastGainPct: 40, // "40% more imaging contrast than NXE systems" (ASML EXE pages)
  waferG: 8,
  reticleG: 32,
  waferGainVsNxe: 2,
  reticleGainVsNxe: 4,
};

// The reticle stays the standard 6-inch mask with a 104 x 132 mm image area (4x the NXE field of 26 x 33 mm,
// https://www.asml.com/en/products/euv-lithography-systems/twinscan-nxe3400b ). Derived below: through 4x/8x optics
// that area prints a 26 x 16.5 mm half field; a die bigger than that is printed as two halves and stitched.
export const NXE_FIELD_MM = [26, 33];
export const RETICLE_FIELD_MM = NXE_FIELD_MM.map((v) => v * 4); // derived: 104 x 132 mm
export const HALF_FIELD_MM = [RETICLE_FIELD_MM[0] / HIGH.reduction[0], RETICLE_FIELD_MM[1] / HIGH.reduction[1]]; // derived: 26 x 16.5 mm

// Light-cone half-angle at the wafer: NA = sin(theta) in vacuum. Derived.
const deg = (rad) => (rad * 180) / Math.PI;
export const CONE_DEG = { low: deg(Math.asin(LOW.na)), high: deg(Math.asin(HIGH.na)) }; // ≈19.3° and ≈33.4°

// ---- ZEISS optics ----
// https://www.zeiss.com/semiconductor-manufacturing-technology/inspiring-technology/high-na-euv-lithography.html
// projection optics: more than 40,000 parts, around twelve tons, seven times the volume and weight of today's EUV optics;
// illumination system: more than 25,000 parts, over six tons; mirrors about twice as large and ten times as heavy.
export const ZEISS = { pobParts: 40_000, pobTonnes: 12, pobVsNxe: 7, illParts: 25_000, illTonnes: 6, mirrorSize: 2, mirrorMass: 10 };

// ---- the machine as a whole ----
// Weight: Heise, "High-NA chips: Intel's latest exposure system is up and running" (https://heise.de/-9690285): over 150 tons;
// Intel's own shipment note (as reported by SiliconANGLE, https://siliconangle.com/2024/04/18/intel-completes-assembly-worlds-advanced-euv-lithography-system/):
// more than 250 crates in 43 freight containers. Size: CNBC (2025, mirrored at
// https://www.nbcwashington.com/news/business/money-report/exclusive-look-at-the-making-of-high-na-asmls-new-400-million-chipmaking-colossus/3919541/ ):
// ASML's High NA qualification lead calls the machine "bigger than a double-decker bus"; price "more than $400 million".
// Heise gives €350 million for the EXE:5000. ASML publishes no list price.
export const MACHINE = { tonnes: 150, crates: 250, containers: 43, priceLowM: 350, priceHighM: 400 };

// ---- Intel ----
// Intel newsroom, "Intel Foundry and ASML Accelerate Industry Readiness for High-NA EUV" (7 Sept 2026):
// https://www.intel.com/content/www/us/en/newsroom/news/intel-foundry/intel-foundry-asml-accelerate-industry-readiness-for-high-na-euv.html
// High NA used in volume production on select Intel 18A layers (Panther Lake), more than one million wafers processed,
// and "stitching" lets designers keep today's standard 6-inch masks.
// EXE:5200B acceptance (Dec 2025): 175 wph and 0.7 nm overlay, as reported by HotHardware
// (https://hothardware.com/news/intel-first-high-na-euv-tool). 14A: Intel's first node designed around High NA, risk
// production 2027 and volume 2028 (Intel Foundry Direct Connect 2025, as reported by Bits&Chips,
// https://bits-chips.com/article/intel-confirms-high-na-euv-deployment-for-14a-node ).
export const INTEL = { wafersM: 1, overlayNm: 0.7, acceptWph: 175, risk14A: 2027, hvm14A: 2028 };

// ---- the process the slider steps through, in order ----
const f1 = (v) => v.toFixed(1);
export const STEPS = [
  { id: "source", name: "Light from the source", say: `tin plasma → ${LIGHT_NM} nm light → intermediate focus` },
  { id: "illuminate", name: "Illuminate the reticle", say: "facet mirrors shape a curved slit on the 6-inch reticle" },
  { id: "project", name: "Anamorphic optics", say: `${HIGH.reduction[0]}× across · ${HIGH.reduction[1]}× along the scan · NA ${HIGH.na}` },
  { id: "cone", name: "A wider cone", say: `cone half-angle ${f1(CONE_DEG.high)}° vs ${f1(CONE_DEG.low)}° at NA ${LOW.na}` },
  { id: "half1", name: "Expose half field A", say: `${HALF_FIELD_MM[0]} × ${HALF_FIELD_MM[1]} mm · reticle scans ${HIGH.reduction[1]}× the wafer` },
  { id: "swap", name: "Swap the reticle", say: "reticle A out to the library, reticle B in" },
  { id: "half2", name: "Expose half field B", say: `second ${HALF_FIELD_MM[0]} × ${HALF_FIELD_MM[1]} mm half, butted to the first` },
  { id: "stitch", name: "Stitched die", say: `two halves → one ${NXE_FIELD_MM[0]} × ${NXE_FIELD_MM[1]} mm die` },
];

export const IDLE = `${HIGH.name} · NA ${HIGH.na} · ${HIGH.resolutionNm} nm · ≥${HIGH.wph} wph`;
