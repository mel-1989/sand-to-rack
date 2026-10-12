// The facts the figure shows. Every readout, caption number and lesson number reads from here.
// Each number carries its source. Geometry (sizes, heights, layout) is illustrative and marked so.

// Kao, Yu and Shen, "Robust operation of copper chemical mechanical polishing",
// Microelectronic Engineering 65 (2003) 61-75, Applied Materials Mirra with Titan heads, 200 mm copper CMP.
// https://scholars.lib.ntu.edu.tw/bitstream/123456789/67318/1/33.pdf
export const MIRRA = {
  platenRpm: [63, 93], // platen speed range studied
  headRpm: [65, 95], // matching head speeds
  psi: [2, 4], // wafer pressure range studied
  slurryMlMin: 200, // slurry flow
  peakAPerMin: 24800, // peak Cu removal rate in Fig. 1 (4 psi, 93 rpm, about 1 wt% H2O2), read off the plot
  endpoint: "ISRM", // in-situ removal monitor stopped every polish
};

// 3M application brief, "3M Diamond Pad Conditioner A165 for Copper CMP with 200mm Applied Materials Mirra
// and 300mm Applied Materials Tools" (Reflexion LK with Profiler head, 300 mm).
// https://multimedia.3m.com/mws/media/464442O/3m-diamond-pad-conditioner-a165.pdf
export const REFLEXION = {
  bulkPsi: 0.8, // platen 1 bulk copper polish pressure
  bulkAPerMin: 5941, // platen 1 average Cu removal rate, 750-wafer marathon
  bulkWiwnu: 2.9, // % within-wafer non-uniformity on platen 1
  clearAPerMin: 1762, // platen 2 final copper clear, stopped on an endpoint signal
  barrierSeconds: 60, // platen 3 barrier and oxide touch-up time
  condLbf: 7, // conditioner downforce, 300 mm recipe, platens 1 and 2
  condRpm: 105, // conditioner disc speed
  sweepsPerMin: 12, // conditioner sweeps per minute
  condZones: 10, // conditioning zones across the pad
  dishingAvgA: 100, // average dishing on 50 um lines is under this
  dishingMaxA: 400, // maximum dishing is under this
  erosionAvgA: 100, // average erosion is under this
};

// Tseng et al. (IBM Research, DuPont), "Optimization of Within-Die Planarity and Defectivity for CMP",
// AVS NCCAVS CMP user group, 2023. https://nccavs-usergroups.avs.org/wp-content/uploads/2023/01/P1-WTTseng.pdf
export const PLANARITY = {
  criticalNm: "a few", // tolerance for within-die and within-wafer topography on critical layers is "on the order of a few nm"
  longRangeUm: [100, 1000], // long-range planarity length scale
  shortRangeUm: [0.1, 1], // short-range planarity length scale
  platens: 3, // their 300 mm commercial polisher
  clean: "two-stage PVA brush scrub, then IPA drying",
};

// Applied Materials, Reflexion LK Prime product page.
// https://www.appliedmaterials.com/us/en/product-library/reflexion-lk-prime-cmp.html
export const PRIME = { pads: 4, heads: 6, cleanChambers: 8, dryChambers: 2 };

// Sun et al. (Applied Materials CMP group), "Low-downforce CMP for copper/low-k structures", Silicon Semiconductor, Nov 2003.
// https://siliconsemiconductor.net/article/66785/Low-downforce_CMP_for_copper_low-k_structures/feature
export const DOWNFORCE = { n130: [3, 5], n90: [2, 2.5], n65Below: 1, lowKFracturePsi: 1.2 }; // psi by node; low-k fractures near 1.2 psi

export const WAFER_MM = 300;

// Derived
export const nm = (aPerMin) => Math.round(aPerMin / 10); // angstrom/min to nm/min
export const BULK_NM = nm(REFLEXION.bulkAPerMin); // 594 nm/min
export const CLEAR_NM = nm(REFLEXION.clearAPerMin); // 176 nm/min
export const PEAK_NM = nm(MIRRA.peakAPerMin); // about 2480 nm/min
export const PLATEN_RPM = MIRRA.platenRpm[1];
export const HEAD_RPM = MIRRA.headRpm[1];

// The process, as the slider plays it. t0..t1 are shares of the slider (0..1).
// Times on screen are compressed: a real bulk-copper step runs on the order of a minute.
export const PHASES = [
  { id: "load", t0: 0.0, t1: 0.14, label: "Load the wafer", say: "load cup lifts the wafer into the head · head carries it to the platen" },
  { id: "slurry", t0: 0.14, t1: 0.25, label: "Slurry on", say: `slurry on · ${MIRRA.slurryMlMin} ml/min · platen spins up to ${PLATEN_RPM} rpm` },
  { id: "press", t0: 0.25, t1: 0.37, label: "Head lowers, both spin", say: `head down · ${REFLEXION.bulkPsi} psi · platen ${PLATEN_RPM} rpm · head ${HEAD_RPM} rpm` },
  { id: "condition", t0: 0.37, t1: 0.49, label: "Conditioner sweeps", say: `diamond disc · ${REFLEXION.condLbf} lbf · ${REFLEXION.condRpm} rpm · ${REFLEXION.sweepsPerMin} sweeps/min` },
  { id: "flatten", t0: 0.49, t1: 0.67, label: "Copper polishes flat", say: `bulk copper · ${BULK_NM} nm/min · ${REFLEXION.bulkWiwnu} % non-uniformity` },
  { id: "endpoint", t0: 0.67, t1: 0.76, label: "Endpoint", say: `window sees the barrier · stop · dishing under ${REFLEXION.dishingAvgA / 10} nm` },
  { id: "rinse", t0: 0.76, t1: 0.87, label: "Rinse", say: "slurry off · DI water rinses the pad · head lifts" },
  { id: "clean", t0: 0.87, t1: 1.0, label: "Brush clean", say: "PVA roller brushes scrub both faces · then dry" },
];

export const PIECES = {
  platen: { name: "Platen and pad", say: `platen and polyurethane pad · ${PLATEN_RPM} rpm · endpoint window in the pad` },
  head: { name: "Carrier head", say: `wafer face down · zoned membrane · ${REFLEXION.bulkPsi} psi on bulk copper` },
  slurry: { name: "Slurry arm", say: `slurry ${MIRRA.slurryMlMin} ml/min and DI rinse nozzles` },
  cond: { name: "Pad conditioner", say: `diamond disc · ${REFLEXION.condLbf} lbf · ${REFLEXION.condRpm} rpm · ${REFLEXION.sweepsPerMin} sweeps/min` },
  cup: { name: "Load cup", say: "load cup lifts the wafer into the head pocket" },
  clean: { name: "Brush cleaner", say: "two PVA roller brushes scrub the wafer, then it is dried" },
};

export const IDLE = `CMP · ${BULK_NM} nm/min · ${REFLEXION.bulkPsi} psi · ${PLATEN_RPM} rpm`;
