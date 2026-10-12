// Reading text under the figure. Numbers come from model.mjs.
import * as M from "./model.mjs";

const r = ([a, b]) => `${a}–${b}`;

export const LESSON = {
  intro: `For fifty years every chip took its power the same way as its signals: down from the top, through the whole stack of copper wiring, to the transistors at the bottom. Backside power splits the two. The wafer is flipped, its silicon ground almost away, and a separate power network is built on the back, right under the transistors. Intel ships it as PowerVia on ${M.INTEL_18A.node}; TSMC's version, Super Power Rail, comes with ${M.A16.node}.`,
  steps: [
    `<strong>Front end as usual.</strong> Transistors are made in the top of an ordinary ${M.WAFER_UM} µm wafer, then the fine copper wiring above them. On a backside-power chip these front layers now carry only signals.`,
    `<strong>Bond a carrier.</strong> A blank carrier wafer is bonded face to face onto the wiring (imec uses a SiCN-to-SiCN fusion bond at room temperature, annealed at ${M.IMEC.bondAnnealC} °C). From now on the carrier is what holds the chip.`,
    `<strong>Flip.</strong> The pair is turned over, so the back of the original wafer faces up.`,
    `<strong>Thin.</strong> Grinding, polishing and a selective etch take the silicon from ${M.WAFER_UM} µm down to ${M.IMEC.thinNm} nanometres, held flat to within ${M.IMEC.ttvNm} nm across the wafer.`,
    `<strong>Connect.</strong> Nano-TSVs reach through that last sliver of silicon to the transistors (imec's test vehicle: ${M.IMEC.ntsvDepthNm} nm deep at ${M.IMEC.ntsvPitchNm} nm pitch). Intel forms its nano-TSVs from the front, one in every standard cell, and exposes them when it thins; TSMC's A16 instead lands a contact on each transistor's source from below.`,
    `<strong>Power metal and bumps.</strong> A few thick, wide copper layers are built on the back, then the bumps that bring current in from the package.`,
  ],
  numbers: [
    ["Layers power had to cross", `${r(M.IMEC.beolLayers)} layers`, `front-side delivery; power uses at least ${M.IMEC.powerRoutingPct}% of the routing (imec)`],
    ["Voltage droop, Intel test chip", `>${M.POWERVIA_TEST.droopPct}% better`, `${M.POWERVIA_TEST.chip}, with a ${M.POWERVIA_TEST.freqPct}% frequency gain`],
    ["Cell utilization, Intel test chip", `>${M.POWERVIA_TEST.utilPct}%`, `up to ${M.SPECTRUM.utilPeakPct}% in places (IEEE Spectrum)`],
    ["Worst-case droop, Intel 18A", `up to ${M.INTEL_18A.droopX}× lower`, `and up to ${M.INTEL_18A.areaPct}% block-area compaction from PowerVia`],
    ["IR drop, simulated", `${M.IMEC.irDropX}× lower`, "Arm CPU with imec rules: backside nano-TSVs vs conventional front-side"],
    ["TSMC A16 vs N2P", `+${r(M.A16.speedPct)}% speed or −${r(M.A16.powerPct)}% power`, `up to ${M.A16.densityX.toFixed(2)}× density; projections, production ${M.A16.when}`],
  ],
  innovationsTitle: "Why it matters",
  innovations: [
    "Wires get more resistive as they shrink, so power that drops through 15 or more thin layers loses voltage on the way. Feeding it from a few thick layers directly underneath keeps the supply steady, so the chip can clock higher or run at lower voltage.",
    "With power gone from the front, the fine layers are free for signals: standard cells pack more tightly and the smallest metal pitch can relax, which helps cost and yield.",
    `Two designs compete. Intel's PowerVia drops a nano-TSV into every cell; TSMC's Super Power Rail contacts the source directly, which costs more process steps but saves more area. Intel pairs PowerVia with RibbonFET on ${M.INTEL_18A.node} for up to ${M.INTEL_18A.perfWattPct}% better performance per watt and ${M.INTEL_18A.densityPct}% density over Intel 3.`,
    "For AI accelerators the gain is mostly power: hundreds of amps arrive at well under a volt, and every millivolt lost in the wiring is margin the chip cannot use for speed.",
  ],
  sources: [
    ["Intel: PowerVia test shows industry-leading performance (2023)", "https://www.intel.com/content/www/us/en/newsroom/news/powervia-test-shows-industry-leading-performance.html"],
    ["Intel Foundry: Intel 18A process", "https://www.intel.com/content/www/us/en/foundry/process/18a.html"],
    ["TSMC: 2024 North America Technology Symposium (A16)", "https://pr.tsmc.com/english/news/3136"],
    ["imec: How to power chips from the backside", "https://www.imec-int.com/en/articles/how-power-chips-backside"],
    ["IEEE Spectrum: Intel's backside power delivery", "https://spectrum.ieee.org/backside-power-delivery"],
    ["Semiconductor Engineering: TSMC uncorks A16 with Super Power Rail", "https://semiengineering.com/tsmc-uncorks-a16-with-super-power-rail"],
  ],
};
