// Reading text under the figure. Numbers come from model.mjs; sources are the ones the model was checked against.
import * as M from "./model.mjs";

const f = M.fmt;

export const LESSON = {
  intro: `Every other chip in this course is cut out of its wafer. Cerebras keeps the wafer whole: the WSE-3 is one ${M.sideMm} mm square of silicon with ${f(M.WSE3.cores)} cores, and the hard part is no longer the chip but the block that feeds it power, carries its heat away and holds it flat. Press Play to build the engine and watch data cross it; the steps below follow the slider.`,
  steps: [
    `<strong>Seat the power modules.</strong> Power conversion sits under the board, so current can come up through it, perpendicular to the wafer: no copper plane could spread that much current sideways across ${M.sideMm} mm.`,
    `<strong>Lower the main board.</strong> The board carries current and signals up to the wafer through its thickness, with decoupling capacitors close to the connector and I/O connectors at its edge.`,
    `<strong>Lay the connector on.</strong> Silicon and circuit board expand at different rates as they heat, so a custom connector sits between them and absorbs the movement while keeping every contact made.`,
    `<strong>Set the wafer down.</strong> Before this, the stepper printed the wafer one die site per exposure, and Cerebras and TSMC added wires across the scribe lines so its ${M.WSE3.dies} die sites form one array. Spare cores and links are designed in (about ${M.SPARE_PCT}% of the area on the first WSE), so a bad core is switched off and the mesh routes round it. Then it is cut to a ${M.sideMm} mm square, ${f(M.WSE3.areaMm2)} mm² or about ${Math.round(M.usedPct)}% of the wafer's area; the square's diagonal is ${Math.round(M.diagMm)} mm, so its corners run just off the ${M.WSE3.waferMm} mm wafer's edge and are clipped.`,
    `<strong>Clamp the cold plate, turn on power and water.</strong> Water carries the heat out through a cold plate pressed on the wafer's back.`,
    `<strong>Run the mesh.</strong> Each core owns ${M.PE.memKB} kB of SRAM and sends or receives a ${M.PE.waveletBits}-bit message (a wavelet) to or from a neighbour in a single clock cycle. Data streams from core to core; nothing goes off-chip to fetch weights held on the wafer.`,
  ],
  numbers: [
    ["Silicon area", `${f(M.WSE3.areaMm2)} mm²`, `${M.sideMm} mm square · the area of about ${Math.round(M.reticles)} full 26 × 33 mm reticle fields, derived; in practice the stepper prints the ${M.WSE3.dies} die sites one exposure each`],
    ["Transistors", `${M.WSE3.transistorsT} trillion`, `${M.WSE3.node}; WSE-1 had ${M.WSE1.transistorsT} trillion on ${M.WSE1.node}`],
    ["Cores", f(M.WSE3.cores), `about ${f(M.coresPerDie)} per die site, derived`],
    ["On-chip SRAM", `${M.WSE3.sramGB} GB`, `${M.PE.memKB} kB per core × ${f(M.WSE3.cores)} cores ≈ ${M.sramFromPE.toFixed(1)} GB, derived`],
    ["Memory bandwidth", `${M.WSE3.memPBs} PB/s`, "SRAM next to every core (Hot Chips 2024)"],
    ["Fabric bandwidth", `${M.WSE3.fabricPbs} Pb/s`, "core to core, across the whole wafer (Hot Chips 2024)"],
    ["Peak AI compute", `${M.WSE3.peakPF} PFLOPS`, "peak, as quoted by Cerebras (Hot Chips 2024)"],
    [`${M.WSE3T.system} wafer (2026)`, M.WSE3T.name, `the WSE-3 at about ${M.WSE3T.clockX}× the clock: ${M.WSE3T.fabricPBs} PB/s on-wafer fabric (Cerebras; the WSE-3's ${M.WSE3.fabricPbs} Pb/s is ${M.fabricPBsWSE3.toFixed(1)} PB/s), about ${M.WSE3T.memPBs} PB/s memory bandwidth (ServeTheHome), ${M.WSE3T.perRack} wafers per Nexus rack (Hot Chips 2026)`],
  ],
  innovationsTitle: "Where wafer-scale and 3D compute go next",
  innovations: [
    `<strong>The same wafer, run faster.</strong> The ${M.WSE3T.system}, shown at Hot Chips 2026, keeps the WSE-3's silicon but runs it as the ${M.WSE3T.name} ("Turbo") at about ${M.WSE3T.clockX}× the clock: ${M.WSE3T.fabricPBs} PB/s of on-wafer fabric bandwidth (Cerebras) and about ${M.WSE3T.memPBs} PB/s of memory bandwidth (ServeTheHome), with ${M.WSE3T.perRack} wafers in each Nexus rack. The figure draws the WSE-3 and its March 2024 numbers.`,
    `<strong>Power right at the silicon.</strong> At Hot Chips 2026 Cerebras said its CS-4 places power conversion about ${M.HC26.convertMm} mm from the wafer, against about ${M.HC26.gpuConvertMm} mm on GPU boards, with no circuit board in the last step.`,
    `<strong>System-on-wafer packaging.</strong> TSMC's 2024 roadmap for a ${M.SOWX.year} full-wafer system (since named SoW-X) promised more than ${M.SOWX.reticles} reticles of silicon and room for more than ${M.SOWX.hbm} HBM stacks (IEEE Spectrum); TSMC's 2025 release quotes ${M.SOWX.vsCowos}× the compute of current CoWoS. It is built from separately tested dies rather than one uncut wafer.`,
    `<strong>Memory stacked on logic.</strong> Hybrid bonding joins copper pads directly, with no solder: AMD's 3D V-Cache stacks an SRAM die on a CPU die at a ${M.VCACHE.pitchUm} µm pitch, against ${M.VCACHE.microbumpUm} µm for microbumps. Cerebras plans 3D-stacked DRAM on the wafer for its CS-6.`,
    "<strong>Why bother.</strong> Moving data between chips costs far more time and energy than moving it across one piece of silicon. Wafer-scale and 3D stacking both shorten that distance.",
  ],
  sources: [
    ["Sean Lie, Cerebras, Hot Chips 2024 (WSE-3: 84 dies, 21 PB/s, 214 Pb/s, 48 kB per core)", "https://www.hc2024.hotchips.org/assets/program/conference/day2/72_HC2024.Cerebras.Sean.v03.final.pdf"],
    ["Cerebras SDK: a conceptual view of the wafer (2D mesh, 32-bit wavelets, one per clock)", "https://sdk.cerebras.ai/computing-with-cerebras"],
    ["Sean Lie, Wafer-Scale Deep Learning, Hot Chips 31 (2019)", "https://old.hotchips.org/hc31/HC31_1.13_Cerebras.SeanLie.v02.pdf"],
    ["Cerebras: deep dive at Hot Chips 2026 (CS-4, WSE-3T: 53.5 PB/s on-wafer fabric, three wafers per Nexus rack, power 0.5 mm from the wafer)", "https://www.cerebras.ai/blog/ultrafast-frontier-inference-cerebras-deep-dive-at-hot-chips-2026"],
    ["ServeTheHome: Cerebras goes rack-scale at Hot Chips 2026 (WSE-3T: about 2× clock, 43 PB/s memory bandwidth)", "https://www.servethehome.com/cerebras-talks-going-rack-scale-with-their-wses-at-hot-chips-2026/"],
    ["Tom's Hardware: AMD 3D V-Cache packaging at Hot Chips (9 µm hybrid bonds)", "https://www.tomshardware.com/news/amd-unveils-more-ryzen-3d-packaging-and-v-cache-details-at-hot-chips"],
    ["IEEE Spectrum: Expect a wave of wafer-scale computers (40 reticles of silicon, 60 HBM)", "https://spectrum.ieee.org/tsmc-advanced-packaging"],
    ["TSMC: 2025 North America Technology Symposium release (SoW-X, 40× CoWoS compute, 2027)", "https://pr.tsmc.com/english/news/3228"],
  ],
};
