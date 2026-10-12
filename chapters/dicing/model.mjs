// The facts the figure shows. Every readout, caption number and lesson number reads from here.
// Each number carries its source. Geometry (sizes, heights, layout) is illustrative and marked so.

// SEMI 3D10 guide (300 mm wafers for 3D stacks): "nominal diameter of 300 mm and nominal thickness of 775 µm".
// https://store-us.semi.org/products/3d01000-semi-3d10-guide-to-describing-materials-properties-for-intermediate-wafers-for-use-in-a-300-mm-3ds-ic-wafer-stack-1
// A 300 mm prime wafer datasheet gives the same: 775 ± 25 µm. https://svmi.com/wp-content/uploads/2020/09/SV031.pdf
export const WAFER = { mm: 300, um: 775, tolUm: 25 };

// Example target thickness for a thinned logic or memory die. Hamamatsu's SDBG process is aimed at
// "ultra-thin chips less than 50 µm". https://www.hamamatsu.com/us/en/product/lasers/laser-related-products/stealth-dicing-technology.html
export const TARGET_UM = 50;

// DISCO DGP8761 grinder/polisher catalog and product page.
// https://www.disco.co.jp/eg/products/catalog/pdf/dgp8761.pdf
// https://disco.co.jp/eg/products/polisher_etcher/dgp8761.html
export const GRINDER = {
  model: "DISCO DGP8761",
  wheelMm: 300, // grinding axis: "Φ300 mm Diamond wheel"
  axes: 3, // "3 axes, 4 chuck tables"
  chucks: 4,
  minUm: 25, // "stable thin grinding to thicknesses less than 25 µm"
  method: "in-feed grinding with wafer rotation", // Z1/Z2 axes
};

// Rough then fine grinding with two wheels (Z1 rough, Z2 fine): DISCO in-feed wheel page and patent literature
// (rough grindstone about #320 to #600, finishing #2000 or finer).
// https://disco.co.jp/eg/products/grinding_wheel/if.html
// https://patents.google.com/patent/US7758402
export const GRIT = { rough: 320, fine: 2000 };

// DISCO DFD6362 and DFD6361 dicing saw catalogs (300 mm, facing dual spindle).
// https://www.disco.co.jp/eg/products/catalog/pdf/dfd6362.pdf
// https://www.disco.co.jp/jp/products/catalog/pdf/dfd6361.pdf
export const SAW = {
  model: "DISCO DFD6362",
  rpm: [6000, 60000], // 1.2 kW / 1.8 kW spindle, min⁻¹ (same in both catalogs)
  indexUm: 0.1, // Y-axis index step 0.0001 mm
  zUm: 0.05, // Z-axis movement resolution 0.00005 mm
  thetaDeg: 380, // θ-axis maximum rotation angle
  maxMm: 300, // maximum workpiece size
  spindles: "facing dual spindle",
};

// DISCO ZHZZ hub blade page: "can produce a 10 µm kerf", thin "compared to 20 to 40 µm blades" (the common widths);
// its 8-inch silicon test ran the spindle at 35,000 min⁻¹. https://disco.co.jp/eg/products/blade/zhzz.html
// commonKerfUm holds common blade widths; the kerf is about the blade width (slightly wider).
export const BLADE = { thinKerfUm: 10, commonKerfUm: [20, 40], testRpm: 35000 };

// DISCO Stealth Dicing page: laser focused inside the wafer, dies separated by tape expansion, a dry process;
// a heat stage shrinks the tape at "higher than 200 deg. C". https://disco.co.jp/eg/solution/library/laser/stealth.html
export const STEALTH = { shrinkC: 200 };

// SK hynix, 12-high HBM3E in mass production (Sept 2024): each DRAM die made about 40 % thinner so 12 dies fit the
// height of the earlier 8-high stack. https://hpcwire.com/off-the-wire/sk-hynix-begins-mass-production-of-12-layer-hbm3e
export const HBM = { thinnerPct: 40, high: 12, was: 8 };

// Derived
export const removedUm = WAFER.um - TARGET_UM; // 725 µm ground away
export const removedPct = Math.round((removedUm / WAFER.um) * 100); // about 94 %
export const DIE_MM = 25; // illustrative die pitch on the drawn wafer (a reticle-sized die is about 26 × 33 mm)

// Rough-grind share of the stock (illustrative: most stock goes with the coarse wheel, the last tens of µm with the fine one).
export const ROUGH_TO_UM = 80;

// The process, as the slider plays it. t0..t1 are shares of the slider (0..1). Time on screen is compressed.
export const PHASES = [
  { id: "tape", t0: 0.0, t1: 0.08, label: "Tape the front", say: `front taped · wafer face down on the chuck` },
  { id: "grind", t0: 0.08, t1: 0.3, label: "Back-grind", say: `cup wheel feeds down · chuck and wheel both spin` },
  { id: "mount", t0: 0.3, t1: 0.38, label: "Mount on frame", say: `ring frame and dicing tape arrive · thin wafer laid on` },
  { id: "align", t0: 0.38, t1: 0.46, label: "Align streets", say: `camera finds the streets · θ table squares them to X` },
  { id: "cutx", t0: 0.46, t1: 0.64, label: "Cut along X", say: `table feeds in X · spindle indexes in Y` },
  { id: "rotate", t0: 0.64, t1: 0.7, label: "Rotate 90°", say: `θ table turns the wafer 90°` },
  { id: "cuty", t0: 0.7, t1: 0.86, label: "Cut along Y", say: `second set of streets · the grid of dies is complete` },
  { id: "uv", t0: 0.86, t1: 0.92, label: "UV release", say: `UV lamp cures the tape · its grip on the dies drops` },
  { id: "pick", t0: 0.92, t1: 1.0, label: "Pick good dies", say: `collet lifts good dies · rejects stay on the tape` },
];

export const PIECES = {
  wheel: { name: "Grinding wheel", say: `Φ${GRINDER.wheelMm} mm diamond cup wheel · #${GRIT.rough} rough then #${GRIT.fine} fine` },
  chuck: { name: "Grinder chuck", say: `porous vacuum chuck · spins under the wheel` },
  gauge: { name: "Thickness gauge", say: `two-probe contact gauge · stops the feed at ${TARGET_UM} µm` },
  blade: { name: "Spindle and blade", say: `hub blade ${BLADE.commonKerfUm[0]}–${BLADE.commonKerfUm[1]} µm wide (kerf ≈ blade) · ${(SAW.rpm[0] / 1000).toFixed(0)}–${(SAW.rpm[1] / 1000).toFixed(0)}k rpm` },
  camera: { name: "Alignment camera", say: `microscope finds the streets before the first cut` },
  table: { name: "X table and frame", say: `θ chuck on X table · frame on dicing tape · θ to ${SAW.thetaDeg}°` },
};

export const IDLE = `${WAFER.mm} mm · ${WAFER.um} → ${TARGET_UM} µm · then diced`;
