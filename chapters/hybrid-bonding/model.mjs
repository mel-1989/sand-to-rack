// The facts the figure shows. Every readout, caption number and inset dimension reads from here.
// Derived values (connections per mm², density ratios) are computed below from the sourced pitches.

const SRC = {
  amd: "https://www.tomshardware.com/news/amd-unveils-more-ryzen-3d-packaging-and-v-cache-details-at-hot-chips", // AMD Hot Chips 33 slide, as reported: C4 130 µm, micro-bump 3D 50 µm, hybrid bond 9 µm, ">15x" density and "<1/3" energy per bit vs micro-bump
  amdQuote: "https://wccftech.com/amd-discloses-multi-layer-chip-design-era-starting-with-zen-3-with-3d-stacked-v-cache-technology/amp/", // "the Hybrid bond has a 9u pitch"; >15x density vs micro-bump 3D
  ks: "https://sst.semiconductor-digest.com/?p=36970", // Kulicke & Soffa wire bonding tutorial: ultra-fine pitch <60 µm, 35 µm lab, 15 µm wire, 150-240 °C, >90 % of chip interconnects
  ibm: "https://circuitsassembly.com/ca/news/290-news/2005-news/10921-ibm-updates-c4-flip-chip-concept.html", // C4 first introduced by IBM in 1964
  besi: "https://imapsource.org/article/90682.pdf", // Besi & Applied Materials, "Chip to Wafer Hybrid Bonding Development for HVM", IMAPS Device Packaging 2023
  imec: "https://www.eejournal.com/industry_news/imec-demonstrates-die-to-wafer-hybrid-bonding-with-a-cu-interconnect-pad-pitch-of-2%C2%B5m", // imec ECTC 2024: 2 µm Cu/SiCN D2W, <350 nm overlay, <2.5 nm Cu recess, target 1 µm
  tsmc: "https://www.eenewseurope.com/en/tsmc-soic-roadmap-2029-chip-stacking", // TSMC 2026 symposium, as reported: SoIC at 6 µm today, 4.5 µm by 2029
  bell: "https://patents.google.com/patent/US3006067A", // Bell Telephone Laboratories, thermo-compression bonding of gold wire to semiconductors, filed 31 Oct 1956, granted 1961
  xilinx: "https://sst.semiconductor-digest.com/insights-from-leading-edge/2010/11/iftle-23-xilinx-28-nm-multidie-fpga-copper-pillar-advances-at-amkor-and-intel-looking-at-foundry-options", // Xilinx Virtex-7 2000T: four FPGA slices on micro-bumps on a TSMC silicon interposer; first shipped 25 Oct 2011
  sony: "https://www.techinsights.com/blog/samsung-galaxy-s7-edge-teardown", // Sony IMX260 image sensor in the Galaxy S7 (2016): first Cu-Cu hybrid bonding in high volume, wafer-to-wafer
  besiAC: "https://www.besi.com/products-technology/product-details/product/datacon-8800-chameo-ultra-plus-ac/", // Besi product page: Datacon 8800 CHAMEO ultra plus AC, 100 nm @ 3σ alignment worst corner, up to 2,000 CPH
  besiOrder: "https://www.besi.com/events/events-shows/details/be-semiconductor-industries-nv-announces-order-for-26-hybrid-bonding-systems/", // Besi, 9 May 2024: order for 26 hybrid bonding systems with 100 nm placement accuracy from a leading logic maker, delivery Q4-24 and Q1-25
  hbm: "https://anysilicon.com/high-bandwidth-memory-white-paper/", // first HBM product: AMD Fiji, June 2015, DRAM dies joined by TSVs and micro-bumps
};
export { SRC };

// Per square-grid joint: one connection per pitch × pitch cell. Derived, not quoted.
export const pitchText = (e) => e.pitchLabel || String(e.pitch);
export const perMm2 = (pitchUm) => 1e6 / (pitchUm * pitchUm);

// The four ways a die has been joined to what is under it, oldest first.
export const ERAS = [
  {
    id: "wire",
    name: "Wire bond",
    short: "wire bond",
    pitch: 60, // µm, upper bound of fine pitch; production fine-pitch wire bonding runs at about 35-50 µm. Pad pitch along the die edge; K&S calls <60 µm "ultra-fine pitch" (SRC.ks)
    pitchLabel: "≤60", // shown as an upper bound, not a typical value
    labPitch: 35, // µm, demonstrated in the lab (SRC.ks)
    wireUm: 15, // µm gold wire used at 35 µm pitch (SRC.ks)
    bondC: [150, 240], // °C stage temperature for Au/Cu ball bonding (SRC.ks)
    example: "",
    since: "1956", // Bell Labs thermocompression gold-wire bond, patent filed 31 Oct 1956 (SRC.bell); still >90 % of chip interconnects in 2005 (SRC.ks)
    faceUp: true, // the die goes down face up and is wired at its edge afterwards
    area: false, // pads only on the edge, so connections per mm² of die area is not a grid number
    how: "die attached face up, wires stitched from edge pads",
    collet: "die attach · epoxy",
  },
  {
    id: "c4",
    name: "C4 solder bump",
    short: "C4 solder",
    pitch: 130, // µm (SRC.amd)
    since: "1964", // IBM (SRC.ibm)
    example: "",
    faceUp: false,
    area: true,
    how: "flipped onto solder bumps, reflowed in an oven",
    collet: "flip-chip place · flux · reflow after",
  },
  {
    id: "ubump",
    name: "Cu micro-bump",
    short: "micro-bump",
    pitch: 50, // µm, micro-bump 3D (SRC.amd)
    since: "2011", // first 2.5D silicon-interposer product: Xilinx Virtex-7 2000T on TSMC CoWoS (SRC.xilinx); the year it entered 2.5D/3D stacking, not the first micro-bump ever
    example: "HBM 2015", // first HBM stacks, AMD Fiji (SRC.hbm)
    faceUp: false,
    area: true,
    how: "copper pillar with solder cap, thermocompression bond",
    collet: "thermocompression · heated collet",
  },
  {
    id: "hybrid",
    name: "Hybrid bond",
    short: "hybrid",
    pitch: 9, // µm, AMD 3D V-Cache on TSMC SoIC (SRC.amd, SRC.amdQuote)
    since: "2016", // first high volume, wafer-to-wafer: Sony IMX260 image sensor (SRC.sony)
    example: "die-to-wafer 2022", // Ryzen 7 5800X3D (AMD 3D V-Cache); Besi Chameo Ultra Plus in production since 2022 (SRC.besi)
    faceUp: false,
    area: true,
    how: "Cu pads in oxide meet flat, no solder; anneal joins the copper",
    collet: "room-temperature pre-bond · ≤15 N",
  },
];

export const HYBRID = {
  soicNow: 6, // µm, TSMC SoIC in volume, press coverage of 2026 symposium (SRC.tsmc)
  soic2029: 4.5, // µm, TSMC roadmap for 2029 (SRC.tsmc)
  imecD2W: 2, // µm, imec die-to-wafer demo, ECTC 2024 (SRC.imec)
  imecTarget: 1, // µm, imec stated target (SRC.imec)
  imecOverlayNm: 350, // nm, < this overlay at 2 µm (SRC.imec)
  recessNm: 2.5, // nm, < this Cu pad recess after CMP (SRC.imec)
  amdDensityX: 15, // ">15x" interconnect density vs micro-bump 3D, AMD's claim (SRC.amd)
  amdEnergyX: 3, // ">3x" interconnect efficiency (energy per bit) vs micro-bump 3D, AMD's claim (SRC.amd)
};

export const BONDER = {
  model: "Besi Datacon 8800 CHAMEO ultra plus", // first high-volume die-to-wafer hybrid bonder, in production since 2022 (SRC.besi)
  placeNm: 200, // nm placement accuracy (SRC.besi)
  cph: 2000, // chips per hour (SRC.besi)
  overlayNm: 160, // nm @ 3σ worst-case corner, measured on test bond (SRC.besi)
  hybridOverlayNm: 316, // nm @ 3σ worst-case corner, Cu-Cu hybrid bonding (SRC.besi)
  acModel: "Datacon 8800 CHAMEO ultra plus AC", // the next generation (SRC.besiAC)
  acNm: 100, // nm @ 3σ alignment, worst corner (SRC.besiAC)
  acShipping: "late 2024", // 26 systems ordered May 2024 for delivery Q4-24 to Q1-25 (SRC.besiOrder)
  roadmapNm: 50, // nm, about this next on the roadmap (SRC.besi)
  prebondN: 15, // N, pre-bond force up to this at room temperature (SRC.besi)
  annealC: [150, 400], // °C anneal window that joins the copper (SRC.besi)
  dieUm: [50, 100], // µm die thicknesses tested with die shaping (SRC.besi)
};

// Fig 1b section sizes, in µm (1 drawing unit = 1 µm). Pitches above are sourced; these bump, pad and layer
// sizes are typical values chosen to draw a believable section. ILLUSTRATIVE, not quoted from a source.
export const JOINT = {
  wire: { ballUm: 27 }, // ball ≈ 1.8 × the 15 µm wire (SRC.ks gives the wire only); die and loop heights in that pane are drawn, not measured
  c4: { ballUm: 80, ballHUm: 86, padUm: 70 }, // ball ≈ 0.6 × the 130 µm pitch
  ubump: { pillarUm: 25, pillarHUm: 30, capHUm: 14, padUm: 28 },
  hybrid: { padUm: 4.5, oxideUm: 16 }, // oxide drawn far thicker than real (about 1 µm) so it shows
};

export const secondsPerChip = 3600 / BONDER.cph; // 1.8 s, derived
export const ratio = (a, b) => perMm2(b.pitch) / perMm2(a.pitch);

const fmt = (value, digits = 0) => value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
export { fmt };

// What the bonder does in one cycle, in order. Each era segment of the slider runs these.
export const PHASES = [
  { id: "eject", label: "eject from tape" },
  { id: "pick", label: "pick" },
  { id: "flip", label: "flip" },
  { id: "align", label: "align · cameras" },
  { id: "bond", label: "bond" },
  { id: "index", label: "index next die" },
];

export const PIECES = {
  tape: { name: "Tape frame and ejector", say: "diced wafer on tape · a needle pushes one die up from below" },
  flip: { name: "Flip unit", say: "picks the die face up and turns it over, face down" },
  head: { name: "Bond head", say: `gantry bond head · ${BONDER.placeNm} nm placement · ${fmt(BONDER.cph)} chips an hour` },
  cams: { name: "Alignment cameras", say: "up camera reads the die's marks · down camera reads the wafer's" },
  chuck: { name: "Target wafer chuck", say: "the wafer the dies land on, held flat by vacuum" },
};

export const IDLE = `die-to-wafer bonder · ${BONDER.placeNm} nm · ${fmt(BONDER.cph)} chips/h`;
