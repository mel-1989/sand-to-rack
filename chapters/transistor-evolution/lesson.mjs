// Reading text under the figure. Numbers come from model.mjs; sources are the ones the model was checked against.
import * as M from "./model.mjs";

const [P, F, N, C] = M.GENS;
const S = M.SOURCES;

export const LESSON = {
  intro: `A transistor is a switch: a voltage on the gate lets current flow from source to drain through the channel below it, or stops it. The planar transistor, with its gate on top of a flat channel, ran from the 1960s to 2011; its last big upgrade was the high-k metal gate of the ${P.node} process in ${P.year}. Since 2011 every generation has changed the shape of the channel so the gate can grip it from more sides, because a gate that only touches one side cannot fully shut a very short channel off. Slide each specimen open to see the cut through its gate, and hover or tap any block to name it.`,
  steps: [
    `<strong>Reading a specimen.</strong> Each block is one transistor, cut through the middle of its gate. Read the cut face from the bottom up: the silicon substrate, the trench oxide that isolates it from its neighbours, then the channel in the brightest outline, wrapped by a thin gate dielectric and the metal gate. Beside the gate stand the spacers, thin insulating walls. Past them sit the source and drain, silicon grown on the channel ends, and on top of those the trench contacts that carry current in and out. The small post on the gate is the gate contact.`,
    `<strong>Planar MOSFET.</strong> The channel is the flat top of the silicon, and the gate sits on it through a thin insulator. The ${P.node} process (${P.year}) had a ${P.lgNm} nm gate and a ${P.cppNm} nm contacted gate pitch. Strained silicon from the ${M.STRAIN_NODE} nm node (${M.STRAIN_YEAR}) sped the carriers up; a high-k dielectric with a metal gate cut the current that leaked straight through an oxide only a few atoms thick.`,
    `<strong>FinFET.</strong> In ${F.year} Intel stood the channel up as a fin, ${F.finWidthNm} nm wide and ${F.finHeightNm} nm tall, so the gate wraps three sides of it. Fins sit ${F.finPitchNm} nm apart, the contacted gate pitch fell to ${F.cppNm} nm, and density went from ${P.density} to ${F.density} million transistors per mm².`,
    `<strong>Gate-all-around nanosheets.</strong> The fin is replaced by a stack of thin horizontal sheets with gate material filling the gaps, so the gate surrounds each sheet on four sides. Samsung shipped the first (MBCFET, 3 nm) in ${M.SAMSUNG_GAA}. TSMC's N2 and ${N.node} followed in ${N.year}; Intel's version, RibbonFET, comes with backside power delivery (PowerVia) and a ${N.cppNm} nm contacted poly pitch.`,
    `<strong>CFET.</strong> A logic gate needs an n-type and a p-type transistor side by side. A complementary FET stacks the n-type sheets directly on the p-type sheets under one gate, so the pair takes the floor space of one. Intel showed its first stacked NMOS-on-PMOS nanoribbons in ${M.CFET_FIRST} and a working stacked CFET at a ${C.cppNm} nm gate pitch in ${C.year}; imec's roadmap puts it in production around ${M.ROADMAP_CFET}.`,
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
    "CFET is mostly a floor-space trick: stacking n over p shrinks the height of a standard cell (fewer tracks), close to halving the area of an n/p pair, and it pairs naturally with backside power delivery, which moves the power wires under the transistors.",
  ],
  sources: [
    ["Mistry et al., A 45nm logic technology with high-k + metal gate transistors, strained silicon, IEDM 2007", S.intel45],
    ["EE Times: Intel 90 nm process with strained silicon (2003)", S.intel90],
    ["Auth et al., A 22nm CMOS technology featuring fully-depleted tri-gate transistors, VLSI Symposium 2012 (DOI)", S.intel22],
    ["Intel Technology and Manufacturing Day 2017: transistor density by node", S.density],
    ["Intel Foundry at VLSI: Intel 18A-P, 'similar to Intel 18A', 50 nm contacted poly pitch and 160/180 nm cell heights", S.intel18a],
    ["Samsung: 3 nm production with GAA (MBCFET) begins, June 2022", S.samsung3],
    ["IEEE Spectrum: TSMC N2 nanosheets at IEDM 2024", S.tsmcN2],
    ["Tom's Hardware: Intel 18A and TSMC N2 compared (TechInsights density)", S.hdDensity],
    ["Intel at IEDM 2020: stacked NMOS-on-PMOS nanoribbon transistors", S.intelCfet2020],
    ["Intel at IEDM 2023: stacked CFET at 60 nm gate pitch", S.intelCfet],
    ["IEEE Spectrum: imec's roadmap, CFET from the A7 node around 2033", S.imecCfet],
    ["Dennard scaling and its breakdown (overview)", S.dennard],
  ],
};
