// The facts the figure shows. Every readout, caption number and part count reads from here.
// Sources: NVIDIA CES / GTC 2026 Rubin disclosures as reported by Guru3D, Introl and others;
// JEDEC JESD270-4 (HBM4) as reported by TrendForce and All About Circuits. See README.md.

export const GPU = {
  name: "Rubin",
  dies: 2, // two reticle-limited compute dies
  transistorsB: 336, // both dies together, billions
  node: "TSMC N3P",
  link: "NV-HBI", // die-to-die interface
  packaging: "CoWoS-L",
  nvfp4Inference: 50, // PFLOPS, "Transformer Engine compute" (adaptive compression), NVIDIA Table 2: https://developer.nvidia.com/blog/inside-the-nvidia-rubin-platform-six-new-chips-one-ai-supercomputer/
  nvfp4Dense: 35, // PFLOPS, "Dense compute" (training), same table
  nvlinkTBs: 3.6, // NVLink 6, per GPU
};

export const HBM = {
  gen: "HBM4",
  stacks: 8,
  high: 12, // DRAM core dies per stack, on one base logic die
  gbPerStack: 36,
  busBits: 2048, // per stack
  totalTBs: 22, // peak, all stacks
  heightUm: 775, // JEDEC nominal package height, 12-high and 16-high
  footprintMm: [11, 12.4], // approximate; vendors differ
};

export const total = HBM.stacks * HBM.gbPerStack; // 288 GB
export const perStackTBs = HBM.totalTBs / HBM.stacks; // 2.75 TB/s
export const pinGbps = (perStackTBs * 1e12 * 8) / (HBM.busBits * 1e9); // about 10.7 Gb/s per pin
export const bitsWide = HBM.stacks * HBM.busBits; // 16,384 data lines to memory

// Plan sizes are in mm, drawn at UNIT world units per mm. Heights are not to scale.
export const UNIT = 2;
export const RETICLE_MM = [26, 33];

const fmt = (value, digits = 0) => value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const PIECES = {
  cold: {
    name: "Cold plate",
    say: "cold plate · liquid in and out · pressed flat on dies and HBM",
  },
  dies: {
    name: "Compute dies",
    say: `${GPU.dies} compute dies · ${GPU.transistorsB} B transistors · ${GPU.node} · ${GPU.link}`,
  },
  hbm: {
    name: "HBM4 stacks",
    say: `${HBM.stacks} × ${HBM.high}-high ${HBM.gen} · ${total} GB · ${fmt(HBM.busBits)}-bit · ≈${fmt(pinGbps, 1)} Gb/s a pin`,
  },
  interposer: {
    name: "CoWoS-L interposer",
    say: `${GPU.packaging} · silicon bridges carry ${fmt(bitsWide)} memory data lines`,
  },
  substrate: {
    name: "Package substrate",
    say: `substrate · power in · NVLink 6 out at ${GPU.nvlinkTBs} TB/s`,
  },
  stand: { name: "Test socket", say: "" },
};

export const IDLE = `${GPU.name} · ${total} GB ${HBM.gen} · ${HBM.totalTBs} TB/s`;
export const CLOSED = "assembled · cold plate clamped";
