// The facts the figure shows. Every readout, caption number and lesson number reads from here.
// Primary sources:
//   [DGX]  NVIDIA DGX GB200 user guide, hardware: https://docs.nvidia.com/dgx/dgxgb200-user-guide/hardware.html
//   [OCP]  NVIDIA technical blog, GB200 NVL72 designs contributed to OCP: https://developer.nvidia.com/blog/nvidia-contributes-nvidia-gb200-nvl72-designs-to-open-compute-project/
//   [NV72] NVIDIA GB200 NVL72 product page: https://www.nvidia.com/en-us/data-center/gb200-nvl72/
//   [BW]   NVIDIA Blackwell architecture page: https://www.nvidia.com/en-us/data-center/technologies/blackwell-architecture/
//   [TB]   NVIDIA technical blog, GB200 NVL72 trillion-parameter training: https://developer.nvidia.com/blog/nvidia-gb200-nvl72-delivers-trillion-parameter-llm-training-and-real-time-inference/
// Secondary:
//   [QCT]  QCT / HPCwire white paper, liquid cooling for GB200 NVL72: https://blog.qct.io/wp-content/uploads/2025/04/QCT-Qoolrack-Stand-Alone_Advanced-Liquid-Cooling-for-NVIDIA-GB200-NVL72-Systems.pdf
//   [REG]  The Register, GTC 2024 report: https://www.theregister.com/2024/03/21/nvidia_dgx_gb200_nvk72
//   [GIG]  Gigabyte DLB2-CB1 (GB200 NVL72 rack) datasheet: https://download.gigabyte.com/FileList/DataSheet/DLB2-CB1_datasheet.pdf
//   [VR]   NVIDIA technical blog, inside the Rubin platform: https://developer.nvidia.com/blog/inside-the-nvidia-rubin-platform-six-new-chips-one-ai-supercomputer/

export const TRAY = {
  ru: 1, // [DGX] compute and switch trays are 1RU each
  grace: 2, // [DGX] 2 Grace CPUs per compute tray
  gpus: 4, // [DGX] 4 Blackwell GPUs per compute tray
  superchips: 2, // [TB] each tray holds two GB200 superchips (1 Grace + 2 Blackwell each)
  cx7: 4, // [DGX] 4x ConnectX-7, single-port 400G OSFP
  bf3: 2, // [DGX] 2x BlueField-3, dual-port
  e1s: 4, // [DGX] 4x 3.84 TB E1.S NVMe (QCT lists 8 bays; the DGX configuration is drawn)
  memTB: 1.7, // [TB] "1.7 TB of fast memory" per compute tray
  pflops: 80, // [TB] "80 petaflops of AI performance" per compute tray; [NV72] lists 40 PF FP4 per superchip, sparse (dense is half), × 2 superchips = 80 PF FP4 sparse
  superchipW: 2700, // [REG] each GB200 superchip rated 2,700 W
  uqd: "UQD04", // [QCT] blind-mate UQD04 liquid inlets on each tray
};

export const GPU = {
  name: "Blackwell",
  transistorsB: 208, // [BW] 208 billion transistors
  dies: 2, // [BW] two reticle-limited dies
  d2dTBs: 10, // [BW] 10 TB/s chip-to-chip link between the dies
  node: "TSMC 4NP", // [BW]
  nvlinkTBs: 1.8, // [OCP] 1.8 TB/s per GPU, NVLink 5
  nvlinkPorts: 18, // [TB] 18 NVLink ports on every GPU
  superchipHbmGB: 372, // [NV72] 372 GB HBM3E per GB200 superchip (two GPUs)
};
export const hbmPerGpu = GPU.superchipHbmGB / 2; // 186 GB, derived

export const RACK = {
  gpus: 72, // [NV72]
  cpus: 36, // [NV72]
  computeTrays: 18, // [OCP] [DGX]
  switchTrays: 9, // [OCP] [DGX]
  switchChipsPerTray: 2, // [DGX] 2 NVSwitch chips per switch tray
  portsPerSwitch: 72, // [DGX] each NVSwitch has 72 NVLink ports
  cartridges: 4, // [OCP] four NVLink cable cartridges at the rear
  copperCables: 5000, // [OCP] "over 5,000 active copper cables"
  nvlinkTBs: 130, // [NV72] [OCP] 130 TB/s all-to-all in one 72-GPU domain
  kW: 120, // [DGX] rack power about 120 kW ([OCP] 120 kW cooling capacity)
  busbarV: "50–51", // [DGX] power shelves output a nominal 50-51 V DC onto the bus bar
  busbarA: 1400, // [OCP] bus bar rated for 1,400 A
  shelfKW: 33, // [DGX] 33 kW input per power shelf, six 5.5 kW PSUs each
  shelves: 8, // [DGX] eight shelves for N+N redundancy (vendors ship 6 or 8)
  layout: [3, 10, 9, 8, 3], // [GIG] power shelves, compute trays, switch trays, compute trays, power shelves
  tonnes: 1.36, // [REG] 1.36 metric tons (3,000 lb)
  matingLbf: 6000, // [OCP] 6,000 lb of mating force between rack components and frame
};
// The next rack, for the lesson's last note.
export const RUBIN = {
  superchipsPerTray: 2, // [VR] "Each tray integrates two superchips ... into a modular, cable-free assembly"
  gpus: 72, // [VR] 72 Rubin GPUs in one NVL72 rack
  assemblyBlackwellH: 1.5, // [VR] "more than 1.5 hours for Blackwell"
  assemblyRubinMin: 5, // [VR] "now takes only ~5 minutes with Vera Rubin"
};
export const switchPorts = RACK.switchTrays * RACK.switchChipsPerTray * RACK.portsPerSwitch; // 1,296, derived
export const gpuPorts = RACK.gpus * GPU.nvlinkPorts; // 1,296, derived: every GPU port meets one switch port

export const COOL = {
  inletMaxC: 45, // [QCT] maximum liquid inlet temperature
  returnMaxC: 65, // [QCT] maximum liquid return temperature
  rackLpm: 130, // [QCT] up to 130 L/min per rack
  liquidKW: 115, // [QCT] "the liquid cooling requires 115 kW"
  airKW: 17, // [QCT] "the air cooling requires 17 kW" (SSDs, NICs, risers)
  regInC: 25, // [REG] one GTC 2024 description: water in at 25 °C ...
  regLps: 2, // [REG] ... at two litres a second, leaving about 20 °C warmer
  regRiseC: 20, // [REG]
  liquidShare: 0, // derived below
};

// Drawing scale: the tray is drawn at 1 unit = 2 mm across and in height (1U = 44.45 mm = 22 units).
// Its depth, the board layout and the rack slot fixture are illustrative.
export const MM = 0.5;
COOL.liquidShare = Math.round((COOL.liquidKW / (COOL.liquidKW + COOL.airKW)) * 100); // 87 %, derived: QCT's 115 kW liquid over its 115 + 17 kW

const NB = "\u00a0"; // non-breaking space between a number and its unit in readouts
export const U_UNITS = 44.45 * MM;

const fmt = (value, digits = 0) => value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const PIECES = {
  pkg: {
    name: "GB200 packages",
    say: `${TRAY.gpus} Blackwell GPUs · ${GPU.transistorsB} B transistors each · ${TRAY.grace} Grace CPUs`,
  },
  plates: {
    name: "Cold plate loop",
    say: `${TRAY.gpus + TRAY.grace} cold plates · ≈${COOL.liquidShare}% of the heat leaves by liquid`,
  },
  lid: {
    name: "Tray and front I/O",
    say: `1U · ${TRAY.cx7} × ConnectX-7 · ${TRAY.bf3} × BlueField-3 · ${TRAY.e1s} × E1.S`,
  },
  manifold: {
    name: "Rack manifold",
    say: `${TRAY.uqd} blind-mate · ≤${COOL.inletMaxC} °C in · ≤${COOL.rackLpm} L/min a rack`,
  },
  busbar: {
    name: "Bus bar",
    say: `${RACK.busbarV} V DC · ${fmt(RACK.busbarA)} A bus bar · ≈${RACK.kW} kW a rack`,
  },
  spine: {
    name: "NVLink spine",
    say: `${RACK.cartridges} cartridges · ${fmt(RACK.copperCables)}+ copper cables · ${RACK.nvlinkTBs} TB/s`,
  },
  rack: {
    name: "The rack",
    say: `${RACK.computeTrays} compute + ${RACK.switchTrays} switch trays · ${RACK.gpus} GPUs · ≈${RACK.kW} kW`,
  },
};

// The process the slider steps through, in order.
export const STEPS = [
  { id: "pkg", label: "packages onto the boards", say: `${TRAY.superchips} superchips · ${TRAY.gpus} GPUs + ${TRAY.grace} CPUs onto the boards` },
  { id: "plates", label: "cold plates clamp down", say: `cold plates on all ${TRAY.gpus + TRAY.grace} chips · hoses to the tray manifold` },
  { id: "lid", label: "the tray closes", say: `lid on · ${TRAY.memTB} TB fast memory · ${TRAY.pflops} PF FP4 (sparse)` },
  { id: "tray", label: "slides into the rack", say: `blind-mate · 2 × ${TRAY.uqd} · bus bar · NVLink` },
  { id: "flow", label: "coolant flows", say: `≤${COOL.inletMaxC} °C in · ≤${COOL.returnMaxC} °C out · ≤${COOL.rackLpm} L/min` },
  { id: "spine", label: "NVLink spine connects", say: `${fmt(gpuPorts)} links · ${GPU.nvlinkTBs} TB/s a GPU · ${RACK.nvlinkTBs} TB/s` },
];


// Keep each quantity on one line when the readout wraps at phone width: a non-breaking space after
// every number, after "×" and "≤"/"≈", and inside the short phrases below.
const KEEP = ["PF FP4 (sparse)", "tray manifold", "one NVLink domain", "of the heat", "by liquid"];
const tidy = (text) => {
  let out = text;
  for (const phrase of KEEP) out = out.split(phrase).join(phrase.replace(/ /g, NB));
  return out.replace(/(\d[\d,.]*\+?%?) (?=\S)/g, `$1${NB}`).replace(/([×]) /g, `$1${NB}`);
};
for (const piece of Object.values(PIECES)) piece.say = tidy(piece.say);
for (const step of STEPS) step.say = tidy(step.say);

export const IDLE = tidy(`${TRAY.gpus} GPUs · ${TRAY.grace} CPUs a tray · ${RACK.gpus} GPUs a rack`);
export const DONE = tidy(`${RACK.gpus} GPUs · one NVLink domain · ≈${RACK.kW} kW`);
