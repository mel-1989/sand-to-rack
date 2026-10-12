// The facts the figure shows. Every readout, caption number and lesson number reads from here.
// Each number carries its source. Geometry that is not listed here is illustrative.

const S = {
  intel45: "https://en.wikipedia.org/wiki/45_nm_process", // Mistry et al., IEDM 2007, as summarised: 160 nm gate pitch, 35 nm gate length, high-k + metal gate, late 2007
  intel90: "https://www.eetimes.com/?p=1145028", // Intel 90 nm (2003): ~50 nm gate length, 1.2 nm oxide, strained silicon
  intel22: "https://docs.ampnuts.ru/eevblog.docs/_Metrology/auth2012.pdf", // Auth et al., VLSI 2012: 90 nm contacted gate pitch, 60 nm fin pitch, 8 nm fin width, 34 nm fin height
  intel22news: "https://www.anandtech.com/show/4313", // Intel announces 22 nm 3D tri-gate, 4 May 2011
  density: "https://faculty-web.msoe.edu/johnsontimoj/EE4980/files4980/Kaizad-Mistry-2017-Manufacturing.pdf", // Intel Technology and Manufacturing Day 2017: 3.3 (45 nm), 15.3 (22 nm) MTr/mm²
  intel18a: "https://www.intel.com/content/www/us/en/newsroom/news/corporate/intel-foundry-details-process-milestones-future-innovation-at-vlsi-symposium.html", // 18A: 50 nm contacted poly pitch, 160/180 nm cell heights
  intel18aHvm: "https://www.businesswire.com/news/home/20251009013156/en", // Panther Lake, first 18A product; Fab 52 high-volume production, Oct 2025; ~30% density vs Intel 3
  hdDensity: "https://www.tomshardware.com/tech-industry/intels-18a-and-tsmcs-n2-process-nodes-compared-intel-is-faster-but-tsmc-is-denser", // TechInsights HD cell estimates: N2 313, 18A 238 MTr/mm²
  samsung3: "https://news.samsung.com/global/samsung-begins-chip-production-using-3nm-process-technology-with-gaa-architecture", // first GAA (MBCFET) production, 30 June 2022
  tsmcN2: "https://spectrum.ieee.org/tsmc-n2", // TSMC N2 nanosheets, IEDM 2024: >1.15x density vs N3, HVM 2H 2025
  intelCfet: "https://www.intel.com/content/www/us/en/newsroom/news/research-advancements-extend-moore-law.html", // IEDM 2023: stacked CFET at 60 nm gate pitch, backside contacts
  imecCfet: "https://spectrum.ieee.org/semiconductor-technology-roadmap", // imec roadmap: CFET from the A7 node, around 2033
  dennard: "https://en.wikipedia.org/wiki/Dennard_scaling", // Dennard scaling broke down around 2005–2007: leakage and threshold voltage stopped scaling
};
export const SOURCES = S;

// Drawing scale along the channel: world units per nanometre. Contacted gate pitch is drawn true to this scale,
// so the four specimens shrink as the real devices did. Heights, widths and sheet counts are illustrative.
export const UNIT = 1;

export const GENS = [
  {
    id: "planar",
    name: "Planar MOSFET",
    short: "Planar",
    year: 2007, // Intel 45 nm in production late 2007 (S.intel45)
    node: "Intel 45 nm",
    cppNm: 160, // contacted gate pitch (S.intel45)
    lgNm: 35, // physical gate length (S.intel45)
    density: 3.3, // MTr/mm² (S.density)
    sides: 1,
    grip: "gate on one side",
    note: "high-k metal gate · strained silicon since 90 nm",
  },
  {
    id: "finfet",
    name: "FinFET (tri-gate)",
    short: "FinFET",
    year: 2011, // announced 4 May 2011, Ivy Bridge (S.intel22news)
    node: "Intel 22 nm",
    cppNm: 90, // contacted gate pitch (S.intel22)
    finPitchNm: 60, // (S.intel22)
    finWidthNm: 8, // (S.intel22)
    finHeightNm: 34, // (S.intel22)
    density: 15.3, // MTr/mm² (S.density)
    sides: 3,
    grip: "gate on three sides",
    note: "fin 8 nm wide, 34 nm tall, 60 nm pitch",
  },
  {
    id: "gaa",
    name: "Gate-all-around nanosheet",
    short: "Nanosheet",
    year: 2025, // Intel 18A high-volume production, Fab 52 (S.intel18aHvm); Samsung first GAA 2022 (S.samsung3)
    node: "Intel 18A",
    cppNm: 50, // contacted poly pitch (S.intel18a)
    density: 238, // MTr/mm², HD cells, TechInsights estimate (S.hdDensity)
    sides: 4,
    grip: "gate on all four sides",
    note: "first GAA in production: Samsung 3 nm, 2022",
  },
  {
    id: "cfet",
    name: "Complementary FET (CFET)",
    short: "CFET",
    year: 2023, // research demo, IEDM 2023 (S.intelCfet); roadmap ~2033 (S.imecCfet)
    yearText: "2023 lab demo",
    node: "Intel research",
    cppNm: 60, // gate pitch of the stacked demo (S.intelCfet)
    density: null, // no production density yet
    sides: 4,
    grip: "nFET stacked on pFET",
    note: "imec roadmap: from the A7 node, around 2033",
  },
];

export const ROADMAP_CFET = 2033; // (S.imecCfet)
export const SAMSUNG_GAA = 2022; // (S.samsung3)
export const TSMC_N2_HD = 313; // MTr/mm² (S.hdDensity)
export const STRAIN_NODE = 90; // nm node that brought strained silicon, 2003 (S.intel90)
export const STRAIN_YEAR = 2003;
export const DENNARD_END = "2005–2007"; // (S.dennard)

const fmt = (value) => (value >= 100 ? value.toFixed(0) : value.toFixed(1));
export const densityText = (g) => (g.density ? `${fmt(g.density)} MTr/mm²` : `roadmap ≈${ROADMAP_CFET}`);
export const yearText = (g) => g.yearText ?? String(g.year);
export const readoutOf = (g) => [g.short, yearText(g), g.node, `CPP ${g.cppNm} nm`, densityText(g)].join(" · ");

// derived. Densities are not one series: 3.3 and 15.3 are Intel's 2017 count (60/40 NAND2 and scan flip-flop),
// 238 is TechInsights' high-density-cell estimate. Only the order of magnitude compares.
export const pitchShrink = GENS[0].cppNm / GENS[2].cppNm; // 3.2×

export const IDLE = `4 generations · CPP ${GENS[0].cppNm} → ${GENS[2].cppNm} nm · ${fmt(GENS[0].density)} → ${fmt(GENS[2].density)} MTr/mm²`;
export const OPEN = "all four cut open · compare the gate grip";
