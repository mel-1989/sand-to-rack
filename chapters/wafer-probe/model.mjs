// The facts the figure shows. Every readout, caption and lesson number reads from here.
// Each number carries its source; derived values are computed below; illustrative values say so.

// ---- the wafer and the die ----
export const WAFER_MM = 300; // standard leading-edge wafer diameter (SEMI M1); https://www.semi.org/en/products-services/standards
export const EDGE_EXCLUSION_MM = 3; // assumption for the gross-die count; illustrative, typical of published die-per-wafer calculators
export const DIE_MM = [26, 33]; // one reticle-limited AI accelerator die, the reticle field: see chapters/advanced-packaging (RETICLE_MM)
export const D0_PER_CM2 = 0.1; // TSMC N5 defect density, about 0.10-0.11 /cm² in August 2020 (AnandTech; the original /show/16028 URL now redirects, this is its surviving print copy); https://adminnet.anandtech.com/print/16028/better-yield-on-5nm-than-7nm-tsmc-update-on-defect-rates-for-n5
export const DIE_CM2 = (DIE_MM[0] * DIE_MM[1]) / 100; // 8.58 cm²
export const POISSON_YIELD = Math.exp(-DIE_CM2 * D0_PER_CM2); // simple Poisson yield model, derived: about 42 %

// ---- the probe card ----
export const PROBES_LOGIC = "tens of thousands"; // logic SoC cards; https://www.formfactor.com/blog/2026/from-commodity-to-enabler-wafer-test-at-the-heart-of-the-ai-era/
export const PROBES_HBM = "100,000 or more"; // HBM cards, "a hundred thousand pins or more"; same FormFactor source
export const PROBES_MAX_K = 200; // FormFactor: up to roughly 150,000-200,000 pins per card; https://finance.yahoo.com/sectors/technology/articles/formfactor-targets-revenue-doubling-2030-180507795.html
export const OVERDRIVE_UM = 75; // typical overdrive past first touch; https://www.electronicdesign.com/home/article/21200247/measurement-repeatability-key-to-probe-card-metrology
export const OVERDRIVE_RANGE_UM = [25, 150]; // range cited in US patent 5,909,121; https://patents.google.com/patent/US5909121
// Price: no vendor lists one. Applies to the largest full-wafer-contact cards, undated article. Rudolph Technologies (Darren James, Solid State Technology): "The most advanced cards, designed to test
// all die on a 300-mm wafer at the same time, can cost hundreds of thousands of dollars each"; https://sst.semiconductor-digest.com/?p=35397
export const CARD_COST = "hundreds of thousands of dollars";
// Context only, about an HBM wafer-level burn-in card, not a logic sort card: Aehr Test's Vernon Rodgers, "You don't need to go spend
// $500,000 on a probe card", and sacrificial pads "can save up to 80% on the cost of a probe card";
// https://semiengineering.com/hbm-shifts-testing-left-to-preserve-ai-chip-yield/
export const HBM_CARD_K = 500;
export const SAC_PAD_SAVE = 80;

// ---- the prober ----
export const PROBER = "Tokyo Electron Prexa, Accretech AP3000 class"; // https://www.eejournal.com/industry_news/tokyo-electron-introduces-prexa-the-next-generation-300mm-wafer-prober/ ; https://www.accretech.com/en/product/semicon/semi/probe_semi/probingmachine_ap3000ap3000e.html
export const STAGE_REPEAT_UM = 1; // linear-motor XY stage repeat accuracy, prober maker Plum Five; https://plumfive.co.jp/semicon/en/product/wafer_prober/comparison/index.html
export const CHUCK_C = [-50, 180]; // low/high temperature chuck option listed for Plum Five's 300 mm production probers (a prober maker's own page; not TEL/Accretech); https://plumfive.co.jp/semicon/en/product/wafer_prober/list/index.html

// ---- the tester ----
export const ATE_SHARE = 90; // Advantest + Teradyne combined share, "~90%+" (Wing VC analysis); https://wing.vc/content/the-chip-testing-bottleneck
export const AI_TEST_MIN = 20; // a Blackwell-class accelerator "can spend well over 20 minutes" on the tester vs 30-60 s for a phone SoC; same source
export const PHONE_TEST_S = [30, 60]; // same source
export const PAM4_GBPS = 32; // fastest high-speed serial I/O card (PAM4, for SerDes-type interfaces), not general pins: Advantest Pin Scale Multilevel Serial for V93000 EXA Scale; https://www.advantest.com/news/2023/20231114.html
export const DIGITAL_GBPS = 5; // general digital pins, Advantest Pin Scale 5000B card; https://www.advantest.com/news/2026/20260422.html

// ---- memory and chiplets ----
export const HBM_SITES = [64, 128]; // DRAM wafer test sites in parallel; https://semiengineering.com/hbm-shifts-testing-left-to-preserve-ai-chip-yield/
export const HBM_INSERTIONS = [3, 12]; // test insertions for a 12-high stack; same source
export const HBM_PER_GPU = 8; // stacks around one GPU; same source
export const HBM_DRAM_PER_BASE = 16; // one bad base die can scrap up to 16 DRAM dies; same source

// ---- derived: the die map ----
// Dies on a 26 × 33 mm grid that fit wholly inside the wafer less the edge exclusion; the grid offset that fits the most.
function dieMap() {
  const [w, h] = DIE_MM;
  const r = WAFER_MM / 2 - EDGE_EXCLUSION_MM;
  let best = null;
  for (let ox = 0; ox < w; ox += 0.5)
    for (let oy = 0; oy < h; oy += 0.5) {
      const dies = [];
      for (let j = -6; j <= 6; j++)
        for (let i = -6; i <= 6; i++) {
          const x0 = i * w + ox - w / 2;
          const y0 = j * h + oy - h / 2;
          const corners = [[x0, y0], [x0 + w, y0], [x0, y0 + h], [x0 + w, y0 + h]];
          if (corners.every(([x, y]) => x * x + y * y <= r * r)) dies.push({ i, j, x: x0 + w / 2, y: y0 + h / 2 });
        }
      if (!best || dies.length > best.dies.length) best = { dies, ox, oy };
    }
  return best;
}
const MAP = dieMap();
export const GROSS = MAP.dies.length; // 64
export const GOOD = Math.round(GROSS * POISSON_YIELD); // 27, the expected good count under the Poisson model

// Probe order: a serpentine raster, row by row, the way a prober steps to save travel.
const rows = [...new Set(MAP.dies.map((d) => d.j))].sort((a, b) => a - b);
export const DIES = rows.flatMap((j, n) => {
  const row = MAP.dies.filter((d) => d.j === j).sort((a, b) => a.i - b.i);
  return n % 2 ? row.reverse() : row;
});

// Which dies fail: illustrative. Defects land at random, a little more often toward the edge; exactly GROSS - GOOD fail.
const hash = (i, j) => {
  let h = (i * 374761393 + j * 668265263) ^ 0x5bd1e995;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const score = DIES.map((d, n) => ({ n, s: hash(d.i + 11, d.j + 7) + (Math.hypot(d.x, d.y) / (WAFER_MM / 2)) * 0.55 }));
const failing = new Set(score.sort((a, b) => b.s - a.s).slice(0, GROSS - GOOD).map((x) => x.n));
DIES.forEach((d, n) => (d.pass = !failing.has(n)));

const NB = "\u00a0"; // no-break space between a number and its unit
const fmt = (v, d = 0) => v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

// The process the slider steps through, in order.
export const STEPS = [
  { id: "load", name: "Load wafer", say: "fork carries the wafer from the FOUP onto the chuck · vacuum on" },
  { id: "align", name: "Align", say: `cameras find the wafer's marks and the probe tips · stage repeat ±${STAGE_REPEAT_UM}${NB}µm` },
  { id: "touch", name: "Touch down", say: `chuck rises · ${OVERDRIVE_UM}${NB}µm overdrive past first touch` },
  { id: "test", name: "Run patterns", say: `tester drives scan and functional patterns through the pogo tower · digital pins up to ${DIGITAL_GBPS}${NB}Gb/s` },
  { id: "bin", name: "Bin", say: "pass or fail is written to the wafer map" },
  { id: "step", name: "Step to next die", say: `chuck drops, steps ${DIE_MM[0]}${NB}mm, rises again` },
  { id: "map", name: "Map fills", say: `${GROSS} dies probed · ${GOOD} good` },
];

export const FOUP_WAFERS = 25; // a 300 mm FOUP carries 25 wafers (SEMI E47.1); https://www.semi.org/en/products-services/standards
export const PIECES = {
  loader: { name: "Loader and FOUP", say: `FOUP of ${FOUP_WAFERS} wafers · robot fork` },
  cameras: { name: "Alignment cameras", say: "one finds the wafer, one the probe tips" },
  stage: { name: "Chuck on XYZ-θ stage", say: `${CHUCK_C[0]} to +${CHUCK_C[1]}${NB}°C · ±${STAGE_REPEAT_UM}${NB}µm repeat` },
  card: { name: "Probe card", say: `MEMS probes · up to ~${PROBES_MAX_K}${NB}k probes · price: six figures` },
  head: { name: "Test head", say: "pin electronics on a pogo tower" },
  tester: { name: "ATE mainframe", say: `Advantest or Teradyne · ~${ATE_SHARE}${NB}% share` },
  map: { name: "Wafer map", say: `${GROSS} dies · ${GOOD} expected good` },
};

export const IDLE = `${GROSS} dies · ${DIE_MM[0]}${NB}×${NB}${DIE_MM[1]}${NB}mm · ~${fmt(POISSON_YIELD * 100)}${NB}% est. yield`;
export { fmt, NB };
