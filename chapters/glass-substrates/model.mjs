// The facts the figure shows. Every readout, caption number and lesson number reads from here.
// Each number carries its source. Geometry (layout, heights, via counts drawn) is illustrative and marked so.

// Intel, "Intel Unveils Industry-Leading Glass Substrates" (18 Sept 2023), and the briefing slides released with it
// (hosted by Igor's Lab): https://www.intc.com/news-events/press-releases/detail/1647/intel-unveils-industry-leading-glass-substrates-to-meet
// https://www.igorslab.de/wp-content/uploads/2023/09/Glass-Core-Substrate.pdf
export const INTEL = {
  densityX: 10, // "Up to 10x increase in interconnect density possible with glass" / "High (~10x) through-hole density"
  distortionPct: 50, // "Tolerance for higher temperatures offers 50% less pattern distortion"
  tgvPitchUm: 100, // "<5/5um Line/Space & <100um TGV pitch" (an upper bound: under 100 µm)
  lineSpaceUm: 5, // "<5/5um Line/Space"
  packageMm: 240, // "package size up to 240x240 mm"
  organicMaxMm: 120, // FCBGA today: "Support to 120x120mm"
  reticles: 8, // ">8x reticle Si"
  tgvUm: 75, // "Electrically functional assembled MCP test vehicle with 3 layers of RDL and TGV of 75um"
  rdl: 3, // same bullet: 3 layers of RDL on the test vehicle
  aspect: 20, // "Filled through glass vias with ~20:1 aspect ratio for 1mm core thickness" (a separate bullet)
  coreMm: 1, // same bullet
  trillion: 2030, // "1 trillion transistors on a package by 2030"
  investB: 1, // "Fully integrated glass R&D line with over $1B investment in Chandler, AZ"
};

// DNP, "DNP Develops TGV Glass Core Substrate for Semiconductor Packages" (March 2023): aspect ratio 9+,
// scaling the conformal type to a 510 × 515 mm panel. https://www.global.dnp/en/news/detail/2023/03/0320_20169052/
export const PANEL = { w: 510, d: 515 };
export const DNP = { aspect: 9 };

// LPKF Laser & Electronics, investor deck (Berenberg conference 2024): LIDE, laser induced deep etching.
// "glass of up to 1mm can be structured by a single laser pulse"; "the laser-modified regions display a much higher
// etch rate than the bulk material"; "hourglass shaped holes with a tunable taper"; aspect ratios "1:10 to 1:50";
// glass core substrate "Glass CTE≈7 · Typical thickness: 800 µm"; glass interposer "CTE≈3 · 400 µm".
// https://www.lpkf.com/fileadmin/mediafiles/user_upload/company/investor-relations/financial-reports/2024/Berenberg_Conference_2024_LPKF_Website.pdf
export const LIDE = { pulses: 1, maxMm: 1, aspect: [10, 50], coreCte: 7, coreUm: 800, interposerCte: 3, accuracyUm: 5 };

// Corning (A. B. Shorey), "Leveraging Glass Properties for Advanced Packaging", IMAPS 2015: panels "up to 515 x 515 mm";
// "Glass with CTE in the range of ~ 3-9 ppm/C is available" (the composition sets it).
// https://imapsource.org/api/v1/articles/56082-leveraging-glass-properties-for-advanced-packaging.pdf
// The figure uses LPKF's two packaging glasses from the deck above: about 3 for an interposer, about 7 for a substrate core.
export const GLASS_CTE = [LIDE.interposerCte, LIDE.coreCte];

// Silicon die: Georgia Tech patent US12315787, "a silicon die can have a CTE of around 3 ppm/° C."
// https://patents.google.com/patent/US12315787B2/en
export const SILICON_CTE = 3;
// Corning (IMAPS 2015, above): glass CTE "in the range of ~ 3-9 ppm/C" is available, set by the composition.
export const GLASS_CTE_RANGE = [3, 9];

// Intel's reasons for glass, from the same briefing slides (verbatim bullets): "Tolerance for higher temperatures offers
// 50% less pattern distortion"; "Glass substrates have ultra-low flatness for improved depth of focus for lithography";
// "Dimensional stability needed for extremely tight layer to layer interconnect overlay"; "Up to 10x increase in
// interconnect density possible with glass". https://www.igorslab.de/wp-content/uploads/2023/09/Glass-Core-Substrate.pdf

// Footprints for the drawn chiplets. Reticle field 26 x 33 mm, the industry-standard exposure field:
// https://bits-chips.com/article/asml-throws-weight-behind-bigger-euv-masks/
export const RETICLE_MM = [26, 33];
// HBM4 package about 11 x 12.4-12.8 mm (approximate; the article gives both 12.4 and 12.8 mm; only sets drawn proportions), per ServeTheHome on SK hynix at Hot Chips 2026:
// https://www.servethehome.com/sk-hynix-hbm-packaging-at-hot-chips-2026/
export const HBM_MM = [11, 12.4];

// Status, both secondhand: TrendForce (citing ETNews, Aug 2025) reports Intel has begun licensing its glass-substrate
// technology: https://www.trendforce.com/news/2025/08/22/news-intel-reportedly-starts-glass-substrate-licensing-offering-potential-boost-to-samsung-and-absolics/
// Tom's Hardware: Intel's own deployment now points at around 2030; Absolics' Covington plant is in final qualification:
// https://tomshardware.com/tech-industry/manufacturing/glass-substrate-roadmap-examined
export const STATUS = { intelUse: 2030 };

// Absolics (SKC), Covington, Georgia: first glass-substrate plant, 12,000 m² a year; US CHIPS funding of $75 M
// (production) and up to $100 M (NAPMP R&D grants, a ceiling). https://www.kedglobal.com/korean-chipmakers/newsView/ked202411220005
export const ABSOLICS = { m2: 12000, chipsM: 75, napmpM: 100 };

// Samsung Electro-Mechanics (5 Nov 2025): prototypes on the Sejong pilot line; a joint venture with Sumitomo Chemical
// Group to mass-produce "after 2027". https://www.samsungsem.com/global/newsroom/news/view.do?id=9850
export const SEMCO = { after: 2027 };

// Derived
export const pitchRatio = Math.sqrt(INTEL.densityX); // 10x more holes per area is about 3.2x tighter pitch
export const panelM2 = (PANEL.w / 1000) * (PANEL.d / 1000); // 0.263 m²
export const panelsPerYear = Math.round(ABSOLICS.m2 / panelM2); // about 45,700 panels at Absolics' first-phase capacity
export const sitesPerPanel = Math.floor(PANEL.w / INTEL.packageMm) * Math.floor(PANEL.d / INTEL.packageMm); // 4 of the largest packages
export const aspectFor1mm = Math.round((INTEL.coreMm * 1000) / INTEL.tgvUm); // a 75 µm via through 1 mm would be about 13:1

// Drawing (illustrative): via grid per package site, drawn at a pitch far coarser than real so it reads.
export const DRAWN = { viasPerSide: 8, organicVias: 3, glassVias: 10, hbmPerSite: 16 };

const fmt = (v) => v.toLocaleString("en-US");

// The process, as the slider plays it. t0..t1 are shares of the slider (0..1). Time on screen is compressed.
export const PHASES = [
  { id: "load", t0: 0.0, t1: 0.06, label: "Bare glass panel", short: `bare glass · ${PANEL.w} × ${PANEL.d} mm on the chuck`, say: `${PANEL.w} × ${PANEL.d} mm glass panel held flat on the vacuum chuck` },
  { id: "laser", t0: 0.06, t1: 0.46, label: "Laser modify", short: "", say: `${LIDE.pulses} pulse per via changes the glass through its whole thickness · nothing is removed yet` },
  { id: "etch", t0: 0.46, t1: 0.57, label: "Wet etch", short: "wet etch · laser-modified glass dissolves", say: `modified glass etches far faster than the rest · hourglass holes open (wet bench)` },
  { id: "fill", t0: 0.57, t1: 0.67, label: "Seed + Cu fill", short: "seed metal, then copper plated into each via", say: `seed layer, then copper plated into every hole (plating line)` },
  { id: "rdl", t0: 0.67, t1: 0.8, label: "Build-up RDL", short: "", say: `wiring layers built up on both faces · <${INTEL.lineSpaceUm}/${INTEL.lineSpaceUm} µm lines (laminators, litho)` },
  { id: "cut", t0: 0.8, t1: 0.9, label: "Singulate", short: "", say: `laser cuts the panel into ${sitesPerPanel} substrates of up to ${INTEL.packageMm} × ${INTEL.packageMm} mm` },
  { id: "attach", t0: 0.9, t1: 1.0, label: "Attach chiplets", short: "", say: `compute dies and HBM placed on each substrate (assembly)` },
];

export const PIECES = {
  head: { name: "Laser head", say: `X-axis optics · ${LIDE.pulses} pulse a via · glass up to ${LIDE.maxMm} mm` },
  bridge: { name: "Bridge and laser", say: `bridge carries the X axis · laser source on top` },
  panel: { name: "Glass panel", say: `${PANEL.w} × ${PANEL.d} mm · glass CTE set by its mix, ${GLASS_CTE_RANGE[0]}–${GLASS_CTE_RANGE[1]} ppm/°C` },
  table: { name: "Y table and chuck", say: `steps the panel under the beam, row by row` },
  coupons: { name: "Organic vs glass", say: `glass: flat · up to ~${pitchRatio.toFixed(1)}× tighter pitch · ${INTEL.distortionPct}% less distortion` },
  cabinet: { name: "Controller", say: `motion and laser control · cable to the bridge` },
};

export const IDLE = `${PANEL.w} × ${PANEL.d} mm glass · TGV pitch <${INTEL.tgvPitchUm} µm`;
export { fmt };
