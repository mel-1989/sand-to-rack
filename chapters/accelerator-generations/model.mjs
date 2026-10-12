// The facts the figure shows. Every readout, caption number and lesson number reads from here.
// One entry per NVIDIA data-center GPU package, oldest first. FLOPS are dense unless a field says sparse.

const SRC = {
  volta: "https://images.nvidia.com/content/volta-architecture/pdf/volta-architecture-whitepaper.pdf",
  ampere: "https://images.nvidia.com/aem-dam/en-zz/Solutions/data-center/nvidia-ampere-architecture-whitepaper.pdf",
  a100: "https://www.nvidia.com/en-us/data-center/a100/",
  hopper: "https://developer.nvidia.com/blog/nvidia-hopper-architecture-in-depth/",
  h100: "https://www.nvidia.com/en-us/data-center/h100/",
  blackwell: "https://nvidianews.nvidia.com/news/nvidia-blackwell-platform-arrives-to-power-a-new-era-of-computing",
  dgxb200: "https://www.nvidia.com/en-us/data-center/dgx-b200/",
  b200power: "https://glennklockwood.com/garden/processors/b200",
  rubin: "https://www.guru3d.com/story/nvidia-details-rubin-gpu-architecture-with-hbm4-nvlink-6-and-336-billion-transistors/",
  rubinPower: "https://www.cudocompute.com/products/nvidia-vera-rubin",
  hbm4: "https://www.servethehome.com/sk-hynix-hbm-packaging-at-hot-chips-2026/",
};
export { SRC };

export const GENS = [
  {
    id: "v100",
    name: "V100",
    arch: "Volta",
    year: 2017, // Volta whitepaper, GTC 2017
    node: "TSMC 12 nm FFN", // Volta whitepaper: "TSMC 12 nm FFN"
    dies: 1,
    dieMm2: 815, // Volta whitepaper: "die size of 815 mm2"
    transistorsB: 21.1, // Volta whitepaper: "21.1 billion transistors"
    hbm: { gen: "HBM2", stacks: 4, sites: 4 }, // Volta whitepaper: "four stacks"
    memGB: 16, // Volta whitepaper (16 GB at launch; a 32 GB version followed in 2018)
    bwTBs: 0.9, // Volta whitepaper: "900 GB/sec peak memory bandwidth"
    flops: { fmt: "FP16", dense: 125, unit: "TF" }, // Volta whitepaper: "up to 125 TFLOPS" Tensor Core FP16
    sparse: null, // no sparsity support
    watts: 300, // Volta whitepaper: 300 W TDP (SXM2)
    nvlinkGBs: 300, // Volta whitepaper: six NVLink links, 300 GB/s total
    packaging: "CoWoS-S",
    new: "Tensor Cores: 640 small matrix units that multiply FP16 tiles", // Volta whitepaper: 640 Tensor Cores
    src: [SRC.volta],
  },
  {
    id: "a100",
    name: "A100",
    arch: "Ampere",
    year: 2020, // Ampere whitepaper, GTC 2020
    node: "TSMC N7", // Ampere whitepaper: "TSMC 7nm N7"
    dies: 1,
    dieMm2: 826, // Ampere whitepaper: "die size of 826 mm2"
    transistorsB: 54.2, // Ampere whitepaper: "54.2 billion transistors"
    hbm: { gen: "HBM2e", stacks: 5, sites: 6 }, // Ampere whitepaper: GA100 has 6 HBM2 stacks, A100 enables 5; 80 GB part uses HBM2e (a100 page)
    memGB: 80, // A100 product page: "80GB HBM2e"
    bwTBs: 2.039, // A100 product page: "2,039 GB/s" (SXM)
    flops: { fmt: "FP16", dense: 312, unit: "TF" }, // A100 product page: FP16 Tensor Core 312 TF dense
    sparse: 624, // A100 product page: 624 TF with sparsity
    watts: 400, // A100 product page: 400 W (SXM)
    nvlinkGBs: 600, // A100 product page: NVLink 600 GB/s
    packaging: "CoWoS-S",
    new: "TF32 and 2:4 structured sparsity, which skips half the weights for twice the math",
    src: [SRC.ampere, SRC.a100],
  },
  {
    id: "h100",
    name: "H100",
    arch: "Hopper",
    year: 2022, // Hopper in-depth blog, GTC 2022
    node: "TSMC 4N", // Hopper blog: "4N customized for NVIDIA"
    dies: 1,
    dieMm2: 814, // Hopper blog: 814 mm2
    transistorsB: 80, // Hopper blog: 80 billion
    hbm: { gen: "HBM3", stacks: 5, sites: 6 }, // Hopper blog: GH100 has 6 HBM3 sites, H100 SXM5 enables 5
    memGB: 80, // H100 product page
    bwTBs: 3.35, // H100 product page: 3.35 TB/s (SXM)
    flops: { fmt: "FP8", dense: 1979, unit: "TF" }, // H100 product page: 3,958 TF FP8 with sparsity, dense is half
    sparse: 3958, // H100 product page
    watts: 700, // H100 product page: up to 700 W
    nvlinkGBs: 900, // H100 product page: NVLink 900 GB/s
    packaging: "CoWoS-S",
    new: "Transformer Engine: picks FP8 or 16-bit per layer and rescales on the fly",
    src: [SRC.hopper, SRC.h100],
  },
  {
    id: "b200",
    name: "B200",
    arch: "Blackwell",
    year: 2024, // NVIDIA Blackwell press release, GTC 2024
    node: "TSMC 4NP", // Blackwell press release: "custom-built 4NP TSMC process"
    dies: 2, // Blackwell press release: two reticle-limit dies
    dieMm2: null, // per-die area not disclosed; drawn at the reticle limit
    transistorsB: 208, // Blackwell press release: 208 billion
    hbm: { gen: "HBM3e", stacks: 8, sites: 8 }, // Blackwell technical overview via glennklockwood: 8 stacks
    memGB: 180, // DGX B200 page: 1,440 GB for 8 GPUs = 180 GB usable each (other sources quote 186 or 192 GB)
    bwTBs: 8, // DGX B200 page: 64 TB/s for 8 GPUs, derived per GPU
    flops: { fmt: "FP4", dense: 9000, unit: "TF" }, // DGX B200 page: 72 PF FP4 dense for 8 GPUs, derived per GPU
    sparse: 18000, // DGX B200 page: 144 PF FP4 sparse for 8 GPUs, derived per GPU
    watts: 1000, // HGX B200 configuration, per NVIDIA technical brief via glennklockwood (up to 1,200 W in GB200)
    nvlinkGBs: 1800, // Blackwell press release: 1.8 TB/s per GPU
    dieLinkTBs: 10, // Blackwell press release: 10 TB/s chip-to-chip link (NV-HBI)
    packaging: "CoWoS-L",
    new: "two dies as one GPU over a 10 TB/s link; FP4 with micro-tensor scaling",
    src: [SRC.blackwell, SRC.dgxb200, SRC.b200power],
  },
  {
    id: "rubin",
    name: "Rubin",
    arch: "Rubin",
    year: 2026, // NVIDIA CES 2026, as in chapters/advanced-packaging/model.mjs
    node: "TSMC N3P", // same source as chapters/advanced-packaging/model.mjs (Guru3D)
    dies: 2,
    dieMm2: null, // not disclosed; reticle-limited
    transistorsB: 336, // Guru3D
    hbm: { gen: "HBM4", stacks: 8, sites: 8 }, // Guru3D
    memGB: 288, // Guru3D: 8 x 36 GB
    bwTBs: 22, // Guru3D
    flops: { fmt: "NVFP4", dense: 35000, unit: "TF" }, // Guru3D: 35 PF NVFP4 (training figure)
    sparse: 50000, // Guru3D: up to 50 PF NVFP4 (inference figure)
    watts: 2300, // NOT an NVIDIA spec: reported by a cloud vendor (cudocompute.com); shown as "reported"
    wattsReported: true,
    nvlinkGBs: 3600, // Guru3D: NVLink 6, 3.6 TB/s
    packaging: "CoWoS-L",
    new: "HBM4 with a 2,048-bit interface per stack; NVFP4; NVLink 6",
    src: [SRC.rubin, SRC.rubinPower],
  },
];

// ---- plan geometry, in mm. Die areas are sourced; outlines, aspect and spacing are illustrative ----
export const RETICLE_MM = [26, 33]; // lithography field limit, as in chapters/advanced-packaging/model.mjs
// HBM package footprints, approximate (vendors differ): widths after Chip Scale Review (HBM2 7.8, HBM2E 10, HBM3 11 mm);
// lengths illustrative; HBM4 12.4 x 11 mm per ServeTheHome (Hot Chips 2026).
export const HBM_MM = {
  HBM2: [7.8, 11.9],
  HBM2e: [10, 11.9],
  HBM3: [11, 11],
  HBM3e: [11, 11],
  HBM4: [11, 12.4],
};

const fmt = (v, d = 0) => v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
export const flopsText = (g, v = g.flops.dense) => (v >= 5000 ? `${fmt(v / 1000)} PF` : `${fmt(v)} TF`);
export const bwText = (g) => (g.bwTBs < 1 ? `${fmt(g.bwTBs * 1000)} GB/s` : `${fmt(g.bwTBs, Number.isInteger(g.bwTBs) ? 0 : 2)} TB/s`);
export const wattText = (g) => (g.wattsReported ? `≈${fmt(g.watts / 1000, 1)} kW reported` : `${fmt(g.watts)} W`);
export const transText = (g) => `${fmt(g.transistorsB, g.transistorsB % 1 ? 1 : 0)} B`;

// The readout while a package is lit: short enough to wrap to two lines at 390 px.
export const sayOf = (g) => `${g.name} ${g.year} · ${transText(g)} transistors · ${g.memGB} GB ${g.hbm.gen} · ${bwText(g)} · ${flopsText(g)} ${g.flops.fmt} · ${wattText(g)}`;

const first = GENS[0];
const last = GENS[GENS.length - 1];
export const GROWTH = {
  transistors: last.transistorsB / first.transistorsB, // ≈ 16x
  bandwidth: last.bwTBs / first.bwTBs, // ≈ 24x
  memory: last.memGB / first.memGB, // 18x
  flops: last.flops.dense / first.flops.dense, // 280x, but FP16 vs FP4
  years: last.year - first.year,
};
export const IDLE = `${first.name} to ${last.name} · ${GROWTH.years} years · ${Math.round(GROWTH.transistors)}× transistors · ${Math.round(GROWTH.bandwidth)}× bandwidth`;

// DRAM core dies per stack, drawn as seams on each stack's side.
export const HBM_HIGH = {
  HBM2: 4, // Volta whitepaper: "four memory dies per HBM2 stack"
  HBM2e: 8, // Ampere whitepaper: "eight memory dies per stack" (16 GB stacks on the 80 GB part)
  HBM3: 8, // derived: 80 GB over 5 stacks = 16 GB, eight 16 Gb dies
  HBM3e: 8, // derived: 24 GB stacks, eight 24 Gb dies
  HBM4: 12, // as chapters/advanced-packaging/model.mjs: 12-high, 36 GB
};
