// The facts the figure shows. Every readout, caption number and lesson number reads from here.
// Each number carries its source. Derived values are computed below; illustrative values say so.

// Cerebras WSE-3 and CS-3, March 2024 launch.
// Sean Lie, Cerebras, Hot Chips 2024 (slides): 46,225 mm², 4 trillion transistors, 900,000 cores, 44 GB,
// 21 PByte/s memory bandwidth, 214 Pbit/s fabric bandwidth, 5 nm TSMC, 48 kB SRAM per core.
// https://www.hc2024.hotchips.org/assets/program/conference/day2/72_HC2024.Cerebras.Sean.v03.final.pdf
export const WSE3 = {
  name: "WSE-3",
  areaMm2: 46225, // Hot Chips 2024 slides
  transistorsT: 4, // trillion, Hot Chips 2024 slides
  cores: 900000, // Hot Chips 2024 slides
  sramGB: 44, // Hot Chips 2024 slides
  memPBs: 21, // PB/s on-chip memory bandwidth, Hot Chips 2024 slides
  fabricPbs: 214, // Pb/s core-to-core fabric bandwidth, Hot Chips 2024 slides
  node: "TSMC 5 nm", // Hot Chips 2024 slides
  peakPF: 125, // peak AI petaflops (quoted with sparsity), Hot Chips 2024 slides
  dies: 84, // die sites stitched across scribe lines, Hot Chips 2024 slides ("84 Die"), one stepper exposure each
  waferMm: 300, // cut square from a 300 mm wafer, Synopsys success story (URL at dieMm2 below); its corners run off the wafer's edge (see diagMm)
};

// Each processing element (core) owns 48 kB of SRAM (Hot Chips 2024 slides above, "48kB SRAM per core") and talks
// to its neighbours on a 2D mesh with 32-bit wavelets, one per clock cycle (Cerebras SDK, a conceptual view).
// https://sdk.cerebras.ai/computing-with-cerebras
export const PE = {
  memKB: 48,
  waveletBits: 32,
};

// WSE-1 at Hot Chips 31 (2019): the engine is PCB + custom connector + wafer + cold plate,
// power flows perpendicular to the wafer, water carries the heat away.
// https://old.hotchips.org/hc31/HC31_1.13_Cerebras.SeanLie.v02.pdf
export const WSE1 = { transistorsT: 1.2, cores: 400000, sramGB: 18, node: "TSMC 16 nm" };
// WSE-1 spare silicon: about 1.5 % of the wafer is spare cores and links (HPCwire, Aug 2019).
// https://www.hpcwire.com/2019/08/27/cerebras-debuts-ai-supercomputer-on-a-wafer/
export const SPARE_PCT = 1.5;

// Hot Chips 2026: CS-4 puts AC/DC conversion about 0.5 mm from the wafer, vs about 50 mm on GPU boards;
// CS-6 is to add 3D-stacked DRAM to the wafer. https://www.cerebras.ai/blog/ultrafast-frontier-inference-cerebras-deep-dive-at-hot-chips-2026
export const HC26 = { convertMm: 0.5, gpuConvertMm: 50 };

// CS-4 (Hot Chips 2026) runs the WSE-3T ("Turbo"), the WSE-3 at about twice the clock; the figure still draws the WSE-3.
// Cerebras, same blog post as above: "A single Cerebras WSE-3T provides 53.5 petabytes per second of aggregate on-wafer
// fabric bandwidth" and "Nexus supports three Wafer-Scale Engines" per rack.
// ServeTheHome: "doubled the clockspeeds (and thus performance) of its predecessor", "WSE3-T offers 43,000 TB/second of
// memory bandwidth", "putting 3 WSEs within a single rack".
// https://www.servethehome.com/cerebras-talks-going-rack-scale-with-their-wses-at-hot-chips-2026/
export const WSE3T = { name: "WSE-3T", system: "CS-4", clockX: 2, fabricPBs: 53.5, memPBs: 43, perRack: 3 };
// the WSE-3's 214 Pb/s fabric in bytes, to compare with the WSE-3T's 53.5 PB/s
export const fabricPBsWSE3 = WSE3.fabricPbs / 8;

// TSMC SoW-X, named in TSMC's 2025 North America Technology Symposium release: a CoWoS-based wafer-sized system,
// 40× the computing power of current CoWoS, volume production in 2027. https://pr.tsmc.com/english/news/3228
// TSMC's 2027 full-wafer system-on-wafer: more than 40 reticles' worth of silicon and more than 60 HBM stacks
// (IEEE Spectrum, which does not name it SoW-X). https://spectrum.ieee.org/tsmc-advanced-packaging
export const SOWX = { year: 2027, reticles: 40, hbm: 60, vsCowos: 40 };

// AMD 3D V-Cache: SRAM die hybrid-bonded on the CPU die with TSMC SoIC at 9 µm pitch, vs 130 µm C4 bumps and 50 µm microbumps.
// https://www.tomshardware.com/news/amd-unveils-more-ryzen-3d-packaging-and-v-cache-details-at-hot-chips
export const VCACHE = { pitchUm: 9, c4Um: 130, microbumpUm: 50 };

// One lithography exposure field (reticle), mm. Standard 26 × 33 mm full field.
export const RETICLE_MM = [26, 33];

// ---- derived ----
export const sideMm = Math.sqrt(WSE3.areaMm2); // 215 mm square
export const dieGrid = [12, 7]; // 84 = 12 × 7; the layout is illustrative (it gives 550 mm² dies)
// ≈ 550 mm² per die, matching the Synopsys success story's die size for the same 46,225 mm² square:
// https://origin-www.synopsys.com/content/dam/synopsys/solutions/slm/success-stories/cerebras-success-story.pdf
export const dieMm2 = WSE3.areaMm2 / WSE3.dies;
// ≈ 54: an area equivalent only; the stepper prints the 84 die sites one exposure each
export const reticles = WSE3.areaMm2 / (RETICLE_MM[0] * RETICLE_MM[1]);
export const sramFromPE = (WSE3.cores * PE.memKB * 1000) / 1e9; // ≈ 43 GB, consistent with 44 GB
export const coresPerDie = Math.round(WSE3.cores / WSE3.dies); // ≈ 10,700
export const waferMm2 = Math.PI * (WSE3.waferMm / 2) ** 2; // ≈ 70,686 mm²
export const usedPct = (WSE3.areaMm2 / waferMm2) * 100; // ≈ 65 %
export const diagMm = sideMm * Math.SQRT2; // ≈ 304 mm corner to corner, against a 300 mm wafer; drawn as a square only

// Plan sizes are in mm at 1 world unit per mm; heights are exaggerated.
export const UNIT = 1;

const fmt = (value, digits = 0) => value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
export { fmt };

export const PIECES = {
  cold: {
    name: "Cold plate",
    say: "water-cooled, on the wafer's back",
  },
  wafer: {
    name: "WSE-3 wafer",
    say: `${fmt(WSE3.areaMm2)} mm² · ${WSE3.transistorsT} T transistors`,
  },
  connector: {
    name: "Wafer connector",
    say: "absorbs the thermal mismatch",
  },
  pcb: {
    name: "Main board",
    say: "carries power up to the wafer",
  },
  power: {
    name: "Power modules",
    say: "current rises through the board",
  },
  stand: { name: "Assembly fixture", say: "" },
};

export const IDLE = `${WSE3.name} · ${fmt(WSE3.cores)} cores · ${WSE3.sramGB} GB SRAM`;
export const CLOSED = `power and water on · water in, heat out`;
export const SCRIBE = "crossing a scribe line · wires join die to die";
export const SPARE = "spare core off · the route goes round it";
