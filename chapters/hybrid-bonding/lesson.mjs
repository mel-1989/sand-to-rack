// Reading text under the figure. Numbers repeat model.mjs; sources are the ones the model was checked against.
import * as M from "./model.mjs";

const [wire, c4, ub, hy] = M.ERAS;
const per = (e) => M.fmt(M.perMm2(e.pitch));
const x = (a, b) => Math.round(M.perMm2(b.pitch) / M.perMm2(a.pitch));

export const LESSON = {
  intro: `A finished die is useless until it is joined to something: a package, an interposer, or another die. A die bonder picks each die off its tape, turns it over and sets it down within a few microns, and for hybrid bonds within a fifth of a micron (${M.BONDER.placeNm} nm), and the newest tools within ${M.BONDER.acNm} nm. What has changed since the first gold wire bonds of ${wire.since} is the joint underneath: from a few hundred wires around the edge to many thousands of copper pads per square millimetre, bonded flat.`,
  steps: [
    `<strong>Eject.</strong> The diced wafer sits on stretched tape in a steel frame. A needle under the tape pushes one die up so a vacuum tool can take it without bending the tape around it.`,
    `<strong>Pick and flip.</strong> The flip unit's pad takes the die face up and turns it over, so its contacts face down. A wire-bonded die skips this: it goes down face up and is wired at its edge afterwards.`,
    `<strong>Align.</strong> The bond head takes the die from the flip unit and stops over an up-looking camera, which reads marks on the die. A down-looking camera on the head reads marks on the target wafer, and the machine corrects the offset.`,
    `<strong>Bond.</strong> The head presses the die down. Solder bumps are reflowed or pressed with a heated collet (thermocompression). A hybrid bond needs no solder: the die is bowed slightly so it touches at the centre first, the oxide surfaces stick at room temperature under at most ${M.BONDER.prebondN} N, and the air is pushed out to the edges.`,
    `<strong>Anneal.</strong> For hybrid bonds the whole wafer then goes to an oven at ${M.BONDER.annealC[0]}–${M.BONDER.annealC[1]} °C. The oxide bond strengthens and the copper pads, recessed by a few nanometres, expand into each other and fuse.`,
  ],
  numbers: [
    ["Wire bond", `${M.pitchText(wire)} µm pad pitch`, `${wire.pitch} µm is the upper bound of fine pitch: Kulicke & Soffa calls under ${wire.pitch} µm "ultra-fine", and ${wire.labPitch} µm was shown in the lab. Pads only on the die's edge.`],
    ["C4 solder bump", `${c4.pitch} µm · ${per(c4)} / mm²`, `IBM, ${c4.since}. Per mm² is 1 ÷ pitch², derived.`],
    ["Cu micro-bump", `${ub.pitch} µm · ${per(ub)} / mm²`, `First 2.5D interposer product in ${ub.since} (Xilinx Virtex-7 2000T on TSMC CoWoS), as in today's GPU packages; in HBM memory stacks from 2015. ${x(c4, ub)}× C4.`],
    ["Hybrid bond", `${hy.pitch} µm · ${per(hy)} / mm²`, `Wafer-to-wafer in image sensors since ${hy.since}; die-to-wafer in AMD 3D V-Cache on TSMC SoIC, 2022. ${x(ub, hy)}× micro-bump by grid (AMD claims over ${M.HYBRID.amdDensityX}×).`],
    ["Hybrid bond, next", `${M.HYBRID.soicNow} → ${M.HYBRID.soic2029} µm · ${M.HYBRID.imecD2W} µm shown · ${M.HYBRID.imecTarget} µm targeted`, `TSMC in volume, TSMC by 2029, imec die-to-wafer demo (${M.fmt(M.perMm2(M.HYBRID.imecD2W))} / mm²), imec's target`],
    ["Bonder placement", `${M.BONDER.placeNm} → ${M.BONDER.acNm} nm · ${M.fmt(M.BONDER.cph)} chips/h`, `Besi CHAMEO ultra plus: ${M.BONDER.placeNm} nm (2022); ultra plus AC: ${M.BONDER.acNm} nm @ 3σ, shipping since ${M.BONDER.acShipping}; ~${M.BONDER.roadmapNm} nm in development`],
  ],
  innovationsTitle: "Key innovations",
  innovations: [
    `<strong>Flip chip (C4).</strong> Turning the die over freed contacts from the edge: bumps can cover the whole face, so the number of connections grows with area instead of perimeter.`,
    `<strong>Copper pillars and thermocompression.</strong> A tall copper post with a small solder cap holds its shape, so bumps could shrink to ${ub.pitch} µm. That made the silicon interposer (CoWoS) and stacked HBM memory possible.`,
    `<strong>Hybrid bonding.</strong> With no solder, there is nothing to squeeze out sideways, so pads can sit a few microns apart. AMD reports under 1/${M.HYBRID.amdEnergyX} of the energy per bit of micro-bumps.`,
    `<strong>From wafer-to-wafer to die-to-wafer.</strong> Hybrid bonding first shipped in ${hy.since}, joining two whole wafers in Sony's phone image sensors. The new step in 2022 was bonding single dies onto a wafer at ${hy.pitch} µm (AMD 3D V-Cache), which lets a tested good die go on each site. That is why the machine on this page is a die-to-wafer bonder.`,
    `<strong>The cost is cleanliness and flatness.</strong> One particle leaves a void, so hybrid bonders sit in front-end cleanrooms, wafers are polished flat to a few nanometres, and placement must stay well under a micron.`,
  ],
  sources: [
    ["Besi & Applied Materials: chip-to-wafer hybrid bonding for HVM (IMAPS 2023)", M.SRC.besi],
    ["Besi: Datacon 8800 CHAMEO ultra plus AC (100 nm)", M.SRC.besiAC],
    ["Besi: order for 26 hybrid bonding systems (May 2024)", M.SRC.besiOrder],
    ["Tom's Hardware: AMD 3D packaging and V-Cache at Hot Chips 33", M.SRC.amd],
    ["Kulicke & Soffa: wire bonding tutorial", M.SRC.ks],
    ["imec: die-to-wafer hybrid bonding at 2 µm pitch (ECTC 2024)", M.SRC.imec],
    ["eeNews Europe: TSMC SoIC roadmap to 2029", M.SRC.tsmc],
    ["Circuits Assembly: IBM updates the C4 flip-chip concept", M.SRC.ibm],
    ["Semiconductor Digest: Xilinx 28 nm multi-die FPGA on micro-bumps", M.SRC.xilinx],
    ["TechInsights: Galaxy S7 teardown, Sony IMX260 hybrid-bonded sensor", M.SRC.sony],
    ["Bell Labs patent US3006067: thermo-compression bonding", M.SRC.bell],
  ],
};
