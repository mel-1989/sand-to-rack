// The facts the figure and the lesson show. Every readout, caption and lesson number reads from here.
// The package layout, board, cages, trunk routes and the bench in build.mjs are illustrative: drawn to read clearly,
// not taken from a drawing. Counts and rates below are sourced.

const NV_BLOG = "https://developer.nvidia.com/blog/how-industry-collaboration-fosters-nvidia-co-packaged-optics";
const NV_PR = "https://investor.nvidia.com/news/press-release-details/2025/NVIDIA-Announces-Spectrum-X-Photonics-Co-Packaged-Optics-Networking-Switches-to-Scale-AI-Factories-to-Millions-of-GPUs/default.aspx";
const NEXTPLATFORM = "https://www.nextplatform.com/2025/03/18/nvidia-weaves-silicon-photonics-into-infiniband-and-ethernet/";
const IEEE_3DJ = "https://grouper.ieee.org/groups/802/3/minutes/nov23/2311_3dj_closed_report.pdf";
const RING_PAPER = "https://pmc.ncbi.nlm.nih.gov/articles/PMC10831040/";
const TSMC_PR = "https://www.businesswire.com/news/home/20240424190528/de";

export const URLS = { NV_BLOG, NV_PR, NEXTPLATFORM, IEEE_3DJ, RING_PAPER, TSMC_PR };

// NVIDIA Quantum-X Photonics, per switch ASIC (NVIDIA developer blog, NV_BLOG)
export const QX = {
  osas: 6, // "six" detachable optical sub-assemblies per switch ASIC
  enginesPerOsa: 3, // three COUPE-based optical engines per sub-assembly
  engineTbps: 1.6, // each engine 1.6 Tb/s transmit and 1.6 Tb/s receive
  lanesPerEngine: 8, // eight 200 Gb/s PAM4 lanes per direction
  laneGbps: 200, // "direct 200Gbps PAM4 modulation per wavelength" (micro-ring modulator)
  txFibres: 8, // per engine: eight transmit fibres
  rxFibres: 8, // eight receive fibres
  laserFibres: 2, // two laser input fibres
  asicTbps: 28.8, // "28.8 Tb/s" full duplex per ASIC
  systemAsics: 4, // Q3450: four Quantum-X chips
  systemPorts: 144, // 144 ports at 800 Gb/s (also NVIDIA press release, NV_PR)
  portGbps: 800,
  systemTbps: 115.2, // full duplex, Q3450
};
export const engines = QX.osas * QX.enginesPerOsa; // 18 engines per ASIC
export const osaTbps = QX.enginesPerOsa * QX.engineTbps; // 4.8 Tb/s per sub-assembly (stated in NV_BLOG)

// External laser source (NV_BLOG)
export const ELS = {
  lasers: 8, // "Each ELS has eight lasers"
  txLanes: 32, // each ELS powers 32 of the Q3450's 576 transmit lanes
  systemTxLanes: 576,
  fewerLasers: 4, // "4x fewer lasers" (NV_PR; NV_BLOG: reduces lasers by a factor of four)
};

// Spectrum-X Photonics, the Ethernet sibling (NV_BLOG)
export const SX = {
  engines: 32, // 32 silicon photonics engines in one multi-chip module
  engineTbps: 3.2, // 16 TX + 16 RX lanes, 3.2 Tb/s per engine
  lanes: 512, // 512 lanes of 200 Gb/s
  els: 16, // 16 ELS modules for the single-ASIC version
};

// Power and signal loss. NVIDIA GTC 2025 figures as reported by The Next Platform (NEXTPLATFORM),
// whose article notes the math "was shown for 1.6 Tb/sec ports".
export const POWER = {
  portTbps: 1.6,
  pluggableW: 30, // DSP "burns 20 watts" + externally modulated laser "runs at 10 watts"
  pluggableDspW: 20,
  pluggableLaserW: 10,
  cpoW: 9, // continuous-wave laser 2 W per port + optical engine 7 W: "down to 9 watts per port"
  cpoLaserW: 2,
  cpoEngineW: 7,
  pluggableLossDb: 22, // 200 Gb/s channel, five transitions
  cpoLossDb: 4, // one transition
  claimX: 3.5, // "3.5x more power efficiency" (NVIDIA press release, NV_PR)
  signalX: 63, // "63x greater signal integrity" (NV_PR)
};
// derived: energy per bit at 1.6 Tb/s (1 W per Tb/s = 1 pJ/bit)
export const pjPluggable = POWER.pluggableW / POWER.portTbps; // 18.75 pJ/bit
export const pjCpo = POWER.cpoW / POWER.portTbps; // 5.625 pJ/bit
export const lossGap = POWER.pluggableLossDb - POWER.cpoLossDb; // 18 dB
export const lossRatio = Math.pow(10, lossGap / 10); // about 63x, matching NVIDIA's "63x"

// Reach at 200 Gb/s per lane: IEEE P802.3dj objectives (IEEE_3DJ)
export const REACH = {
  copperM: 1, // "copper twin-axial cables ... reach of up to at least 1.0 meter"
  smfM: 500, // "SMF with lengths up to at least 500 m" (1.6TBASE-DR8)
  smfLongM: 2000, // "at least 2 km" (1.6TBASE-DR8-2)
};

// One published micro-ring modulator, for scale (Yuan et al., Nature Communications 15, 918, 2024; RING_PAPER).
// A research device, not NVIDIA's part.
export const RING = {
  radiusUm: 12, // "The nominal radius of the MRM is 12 μm"
  wavelengthNm: 1310, // O-band, 1305.43 to 1309.71 nm channels
  fJperBit: 6.3, // "~6.3 fJ/bit for 200 Gb/s PAM4 modulation"
  gbps: 200,
};

// TSMC COUPE (Compact Universal Photonic Engine), announced April 2024 (TSMC_PR); the electronic IC is
// stacked on the photonic IC with SoIC hybrid bonding. Roadmap from trade press (Tom's Hardware / AnandTech, 2024):
// 1.6 Tb/s engine in an OSFP pluggable first, then co-packaged with the switch or processor.
export const COUPE = { name: "COUPE", bond: "SoIC hybrid bonding" };

const fmt = (v, d = 0) => v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
export { fmt };

// The path of one bit, in order. `say` is the readout while that step runs.
export const STEPS = [
  { id: "serdes", name: "Bit leaves the switch", say: `SerDes · ${QX.laneGbps} Gb/s PAM4 · a few mm of copper to the engine`, run: ["asic", "eic"] },
  { id: "laser", name: "Laser light in", say: `ELS · ${ELS.lasers} lasers · steady light down the laser fibre`, run: ["els"] },
  { id: "ring", name: "Ring encodes the bit", say: `micro-ring · ${RING.gbps} Gb/s PAM4 · four light levels`, run: ["pic"] },
  { id: "fibre", name: "Out on the fibre", say: `single-mode fibre · ${REACH.smfM} m or ${fmt(REACH.smfLongM / 1000)} km reach`, run: ["fibre"] },
  { id: "detect", name: "Photodetector", say: "germanium photodiode · light back to current", run: ["rx"] },
  { id: "back", name: "Back to electrical", say: "TIA amplifies · SerDes receives · bit delivered", run: ["asic", "rxeic"] },
  { id: "compare", name: "Compare a pluggable", say: `pluggable ${POWER.pluggableW} W · ${POWER.pluggableLossDb} dB  vs  CPO ${POWER.cpoW} W · ${POWER.cpoLossDb} dB`, run: ["osfp"] },
];

// Legend parts, in order. Each `say` is the readout when the part is picked.
export const PARTS = {
  asic: { name: "Switch ASIC", say: `Quantum-X class · ${QX.asicTbps} Tb/s · ${QX.osas} optical sub-assemblies` },
  osa: { name: "Optical sub-assemblies", say: `${QX.osas} per ASIC · ${QX.enginesPerOsa} engines each · ${fmt(osaTbps, 1)} Tb/s · detachable` },
  pic: { name: "Optical engines (PIC + EIC)", say: `${engines} engines · ${QX.engineTbps} Tb/s each · ${QX.lanesPerEngine} × ${QX.laneGbps} Gb/s lanes` },
  fibre: { name: "Fibre trunks", say: `per engine ${QX.txFibres} TX + ${QX.rxFibres} RX + ${QX.laserFibres} laser fibres` },
  els: { name: "External laser sources", say: `${ELS.lasers} lasers each · feeds ${ELS.txLanes} transmit lanes · field-replaceable` },
  osfp: { name: "Pluggable, for comparison", say: `OSFP · ${POWER.pluggableW} W a 1.6T port · ${POWER.pluggableLossDb} dB electrical loss` },
  board: { name: "Switch board and bench", say: "the test board the package sits on" },
};

export const IDLE = `CPO switch · ${QX.osas} × ${fmt(osaTbps, 1)} Tb/s optics · ${QX.asicTbps} Tb/s`;
export const DONE = `CPO ${fmt(pjCpo, 1)} pJ/bit vs pluggable ${fmt(pjPluggable, 1)} pJ/bit`;
