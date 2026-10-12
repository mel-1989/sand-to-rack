// Reading text under the figure. Numbers come from model.mjs; sources are the ones the model was checked against.
import * as M from "./model.mjs";

const [P, F, N, C] = M.GENS;
const S = M.SOURCES;

export const LESSON = {
  intro: `A transistor is a switch: a voltage on the gate lets current flow from source to drain through the channel below it, or stops it. Every generation since 2007 has changed the shape of that channel so the gate can grip it from more sides, because a gate that only touches one side cannot fully shut a very short channel off. Slide each specimen open to see the cut through its gate.`,
  steps: [
    `<strong>Planar MOSFET.</strong> The channel is the flat top of the silicon, and the gate sits on it through a thin insulator. Intel's ${P.node} process (${P.year}) had a ${P.lgNm} nm gate and a ${P.cppNm} nm contacted gate pitch. Strained silicon from the ${M.STRAIN_NODE} nm node (${M.STRAIN_YEAR}) sped the carriers up; a high-k dielectric with a metal gate cut the current that leaked straight through an oxide only a few atoms thick.`,
    `<strong>FinFET.</strong> In ${F.year} Intel stood the channel up as a fin, ${F.finWidthNm} nm wide and ${F.finHeightNm} nm tall, so the gate wraps three sides of it. Fins sit ${F.finPitchNm} nm apart, the contacted gate pitch fell to ${F.cppNm} nm, and density went from ${P.density} to ${F.density} million transistors per mm².`,
    `<strong>Gate-all-around nanosheets.</strong> The fin is replaced by a stack of thin horizontal sheets with gate material filling the gaps, so the gate surrounds each sheet on four sides. Samsung shipped the first in ${M.SAMSUNG_GAA}; TSMC's N2 and ${N.node} (RibbonFET, ${N.cppNm} nm contacted poly pitch) followed in ${N.year}.`,
    `<strong>CFET.</strong> A logic gate needs an n-type and a p-type transistor side by side. A complementary FET stacks the n-type sheets directly on the p-type sheets under one gate, so the pair takes the floor space of one. Intel showed a stacked CFET at a ${C.cppNm} nm gate pitch in ${C.year}; imec's roadmap puts it in production around ${M.ROADMAP_CFET}.`,
    `<strong>Play the slider.</strong> It cuts each specimen open in turn, oldest first, and the readout shows the year, process, contacted gate pitch and density of the one being opened.`,
  ],
  numbers: [
    ["Contacted gate pitch", `${P.cppNm} → ${F.cppNm} → ${N.cppNm} nm`, `${P.node} → ${F.node} → ${N.node}; ${M.pitchShrink.toFixed(1)}× shorter`],
    ["Planar gate length", `${P.lgNm} nm`, `${P.node}, ${P.year}`],
    ["FinFET fin", `${F.finWidthNm} × ${F.finHeightNm} nm, ${F.finPitchNm} nm pitch`, `${F.node}, ${F.year}`],
    ["Logic density", `${P.density} → ${F.density} MTr/mm²`, `Intel's own figures for ${P.node} and ${F.node}`],
    ["Nanosheet density", `${N.density} MTr/mm² (${N.node}), ${M.TSMC_N2_HD} (TSMC N2)`, "TechInsights estimates for high-density cells, a different counting method"],
    ["CFET in production", `about ${M.ROADMAP_CFET}`, "imec roadmap, from its A7 node"],
  ],
  innovationsTitle: "Why the gate had to wrap around",
  innovations: [
    `Until the mid-2000s, shrinking a transistor also lowered its voltage, so power per area stayed flat (Dennard scaling). That stopped around ${M.DENNARD_END}: leakage current and threshold voltage do not shrink with size, so voltage could no longer fall with each node.`,
    "With a very short channel, the drain's electric field reaches under the gate and lets current leak even when the gate says off. Every side the gate adds gives it more control over the channel, so it can switch off cleanly at a lower voltage.",
    "Wider fins or wider sheets carry more current in the same footprint. Nanosheets let designers choose the sheet width per cell, which fins, fixed in width, could not.",
    "CFET is mostly a floor-space trick: stacking n over p halves the width of a logic cell, and it pairs naturally with backside power delivery, which moves the power wires under the transistors.",
  ],
  sources: [
    ["Intel 45 nm high-k metal gate process (Mistry et al., IEDM 2007, summarised)", S.intel45],
    ["Auth et al., Intel 22 nm tri-gate technology, VLSI 2012", S.intel22],
    ["Intel Technology and Manufacturing Day 2017: transistor density by node", S.density],
    ["Intel Foundry at VLSI: 18A contacted poly pitch and cell heights", S.intel18a],
    ["Tom's Hardware: Intel 18A and TSMC N2 compared (TechInsights density)", S.hdDensity],
    ["Intel at IEDM 2023: stacked CFET at 60 nm gate pitch", S.intelCfet],
  ],
};
