// The facts the figure shows. Every readout, caption number and lesson number reads from here.
// Each number carries its source. Geometry that is not listed here is illustrative.

const S = {
  intel45: "https://doi.org/10.1109/IEDM.2007.4418914", // Mistry et al., IEDM 2007, pp. 247–250: 160 nm gate pitch, 35 nm gate length, high-k + metal gate, third-generation strained silicon, late 2007
  intel90: "https://www.eetimes.com/?p=1145028", // Intel 90 nm (2003): ~50 nm gate length, 1.2 nm oxide, strained silicon
  intel22: "https://doi.org/10.1109/VLSIT.2012.6242496", // DOI of Auth et al., "A 22nm high performance and low-power CMOS technology featuring fully-depleted tri-gate transistors...", VLSI 2012 (resolves to IEEE Xplore 6242496). The landing page is the abstract; the paper's full text gives 90 nm contacted gate pitch, 60 nm fin pitch, 8 nm fin width, 34 nm fin height
  intel22news: "https://www.anandtech.com/show/4313", // Intel announces 22 nm 3D tri-gate, 4 May 2011
  density: "https://faculty-web.msoe.edu/johnsontimoj/EE4980/files4980/Kaizad-Mistry-2017-Manufacturing.pdf", // Intel Technology and Manufacturing Day 2017: 3.3 (45 nm), 15.3 (22 nm) MTr/mm²
  intel18a: "https://www.intel.com/content/www/us/en/newsroom/news/corporate/intel-foundry-details-process-milestones-future-innovation-at-vlsi-symposium.html", // Intel Foundry at VLSI, 18A-P release: "Similar to Intel 18A, Intel 18A-P offers two cell heights (180nm and 160nm), a contacted poly pitch of 50nm"
  intel18aHvm: "https://www.businesswire.com/news/home/20251009013156/en", // Panther Lake, first 18A product; Fab 52 high-volume production, Oct 2025; ~30% density vs Intel 3
  hdDensity: "https://www.tomshardware.com/tech-industry/intels-18a-and-tsmcs-n2-process-nodes-compared-intel-is-faster-but-tsmc-is-denser", // TechInsights HD cell estimates: N2 313, 18A 238 MTr/mm²
  samsung3: "https://news.samsung.com/global/samsung-begins-chip-production-using-3nm-process-technology-with-gaa-architecture", // first GAA (MBCFET) production, 30 June 2022
  tsmcN2: "https://spectrum.ieee.org/tsmc-n2", // TSMC N2 nanosheets, IEDM 2024: >1.15x density vs N3, HVM 2H 2025
  intelCfet2020: "https://www.intel.com/content/www/us/en/newsroom/opinion/iedm-2020-marks-key-process-packaging-innovations.html", // Intel newsroom, 18 Dec 2020: IEDM 2020 paper "3-D Self-aligned Stacked NMOS-on-PMOS Nanoribbon Transistors", monolithic NMOS-on-PMOS stacking (the first stacked CFET Intel showed)
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
    grip: "gate on 1 side",
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
    grip: "gate on 3 sides",
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
    densityEst: true,
    sides: 4,
    grip: "gate on 4 sides",
    note: "first GAA in production: Samsung 3 nm, 2022",
  },
  {
    id: "cfet",
    name: "Complementary FET (CFET)",
    short: "CFET",
    year: 2023, // 60 nm gate-pitch stacked demo, IEDM 2023 (S.intelCfet); first stacked NMOS-on-PMOS shown at IEDM 2020 (S.intelCfet2020); roadmap ~2033 (S.imecCfet)
    yearText: "2023 lab demo",
    node: "Intel research",
    cppNm: 60, // gate pitch of the stacked demo (S.intelCfet)
    density: null, // no production density yet
    sides: 4,
    grip: "n stacked on p",
    note: "imec roadmap: from the A7 node, around 2033",
  },
];

export const CFET_FIRST = 2020; // Intel's first stacked NMOS-on-PMOS nanoribbons, IEDM 2020 (S.intelCfet2020)
export const ROADMAP_CFET = 2033; // (S.imecCfet)
export const SAMSUNG_GAA = 2022; // (S.samsung3)
export const TSMC_N2_HD = 313; // MTr/mm² (S.hdDensity)
export const STRAIN_NODE = 90; // nm node that brought strained silicon, 2003 (S.intel90)
export const STRAIN_YEAR = 2003;
export const DENNARD_END = "2005–2007"; // (S.dennard)

const fmt = (value) => (value >= 100 ? value.toFixed(0) : value.toFixed(1));
export const densityText = (g) => (g.density ? `${g.densityEst ? "≈" : ""}${fmt(g.density)} MTr/mm²${g.densityEst ? " est." : ""}` : `roadmap ≈${ROADMAP_CFET}`);
export const yearText = (g) => g.yearText ?? String(g.year);
export const readoutOf = (g) => [g.short, yearText(g), g.node, `CPP ${g.cppNm} nm`, densityText(g)].join(" · ");
// phone width: the node name drops so the line fits
export const readoutShort = (g) => [g.short, yearText(g), `CPP ${g.cppNm} nm`, densityText(g)].join(" · ");

// derived. Densities are not one series: 3.3 and 15.3 are Intel's 2017 count (60/40 NAND2 and scan flip-flop),
// 238 is TechInsights' high-density-cell estimate. Only the order of magnitude compares.
export const pitchShrink = GENS[0].cppNm / GENS[2].cppNm; // 3.2×

export const IDLE = `4 generations · CPP ${GENS[0].cppNm} → ${GENS[2].cppNm} nm · ${fmt(GENS[0].density)} → ${densityText(GENS[2])}`;
export const IDLE_SHORT = `4 generations · CPP ${GENS[0].cppNm} → ${GENS[2].cppNm} nm`;
export const OPEN = "all four cut open · compare the gate grip";

// What each drawn part is, for the hover / tap readout. Keys are the part names build.mjs gives each item.
const F = GENS[1];
export const PART_TEXT = {
  base: "silicon substrate",
  sti: "shallow trench isolation · oxide between devices",
  oxide: "gate dielectric · high-k insulator under the gate",
  gate: {
    planar: "metal gate · sits on 1 side of the flat channel",
    finfet: "metal gate · wraps 3 sides of each fin",
    gaa: "metal gate · fills in around every sheet",
    cfet: "shared metal gate · around the n and the p sheets",
  },
  cap: "gate cap · insulator on top of the gate",
  spacer: "spacer · insulates the gate from the source/drain contact",
  epi: { planar: "raised {half} · doped silicon", finfet: "{half} epitaxy grown on the fins", gaa: "{half} epitaxy joining the sheet ends" },
  epiP: "p-type {half} epitaxy · bottom device, the stronger tone",
  epiN: "n-type {half} epitaxy · top device",
  isolation: "dielectric between the n and p {half}",
  contact: "trench contact to the {half}",
  gatecontact: "gate contact · via down to the gate",
  backside: "backside power layer · power wires under the transistors",
  pedestal: "pedestal · holds the source half",
  rail: "linear rail",
  stop: "end stop",
  bearing: "bearing block",
  carriage: "carriage · slides the drain half out",
  jaw: "clamp jaw",
  lug: "pull lug",
  knob: "pull knob",
  // section paths drawn on the cut faces
  channel: {
    planar: "channel · flat silicon under the gate",
    finfet: `channel · silicon fin ${F.finWidthNm} nm wide, ${F.finHeightNm} nm tall`,
    gaa: "channel · silicon nanosheets, gate on all 4 sides",
    cfet: "channels · n-type sheets over p-type sheets",
  },
  channelN: "n-type channel sheets · top device",
  channelP: "p-type channel sheets · bottom device, the stronger tone",
  gox: "gate dielectric · lines the channel under the metal",
  root: "fin root · silicon below the gate, in the isolation",
  core: "fin core inside the {half} epitaxy",
  trench: "trench isolation oxide",
  mdi: "middle dielectric · separates the n and p sheet stacks",
  well: "doped {half} region",
  body: "doped well under the channel",
  bench: "bench plate",
};
