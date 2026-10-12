// Reading text under the figure. Numbers come from model.mjs; sources are the ones the model was checked against.
import * as M from "./model.mjs";

const range = ([a, b], unit = "") => `${a}–${b}${unit}`;

export const LESSON = {
  intro: `The transistors are finished; now they must be wired together. A chip carries ${M.LAYER_COUNT} or so layers of copper wiring stacked above the transistors, and each layer is made by the same loop: lay down insulating glass, cut grooves and holes into it, fill them with copper in a plating cell, then polish the top flat. On top of the last layer the wafer gets its bumps, the copper pillars the package will be soldered to. Press play to watch the stack build up, one loop per layer, then the bumps.`,
  steps: [
    `<strong>Deposit low-k.</strong> A thin film of carbon-doped oxide (SiCOH) is laid on the wafer. Its dielectric constant is about ${M.DIELECTRIC.sicoh[0]}–${M.DIELECTRIC.sicoh[1]}, against ${range(M.DIELECTRIC.oxide)} for plain oxide, so neighbouring wires couple less and signals run faster.`,
    `<strong>Pattern via and trench.</strong> Lithography and plasma etch open a via (a vertical hole down to the wire below), then a trench above it for the new wire. Filling both at once is the "dual" in dual damascene.`,
    `<strong>Barrier and seed.</strong> A few nanometres of tantalum nitride and tantalum line every surface so copper cannot diffuse into the glass, and a thin sputtered copper seed gives the plating current somewhere to flow.`,
    `<strong>Electroplate.</strong> The wafer goes face-down into the cell, held at its edge by a clamshell that makes contact with the seed. The wafer is the cathode and a copper anode below it dissolves as copper ions plate onto the wafer. Additives in the bath slow plating at the top of each feature, so copper fills from the bottom up without voids: IBM called this "superfilling".`,
    `<strong>CMP.</strong> Plating leaves a blanket of excess copper, the overburden. Chemical mechanical polishing removes it down to the glass, leaving copper only in the trenches and vias. The wafer is flat again and ready for the next layer.`,
    `<strong>Repeat.</strong> Low layers are the finest, ${M.STACK.m0PitchNm} nm pitch at M0 in ${M.STACK.example}. Layers get wider and thicker going up, ending in thick top metal for power and the pads the package connects to.`,
    `<strong>Bump.</strong> Before the wafer is probed and diced it is bumped. A hard passivation layer covers the top metal with an opening over each pad; a sputtered under-bump metallization (a titanium barrier and a copper seed) coats the whole wafer; a thick resist mask opens a hole over each pad; and the wafer goes face-down into a plating cell of the same kind, where a copper pillar and then a tin-silver solder cap grow in the holes, at ${M.BUMP.asd[0]}–${M.BUMP.asd[1]} A/dm² (${M.BUMP_MACM2[0]}–${M.BUMP_MACM2[1]} mA/cm²), far faster than the damascene fill. The resist is stripped, the seed between bumps is etched away, and reflow melts the caps into domes. Bumps to a package substrate (C4) sit at about ${M.BUMP.c4PitchUm} µm pitch; micro-bumps between stacked dies at about ${M.BUMP.microPitchUm} µm.`,
  ],
  numbers: [
    ["Metal layers", `${M.STACK.regular} + ${M.STACK.thick} thick`, `${M.STACK.example}, the exemplar drawn here`],
    ["Tightest pitch in the exemplar", `${M.STACK.m0PitchNm} nm`, `${M.STACK.example} M0 (2022); M1 is ${M.STACK.m1PitchNm} nm`],
    ["Wafer spin while filling", `${range(M.PLATE.rpmFill)} rpm`, `${range(M.PLATE.rpmRange)} rpm across the whole process`],
    ["Plating current density", `${range(M.PLATE.fillRange)} mA/cm² fill`, `${range(M.PLATE.burdenMAcm2)} mA/cm² for the overburden`],
    ["Bath", `${M.PLATE.bath.cuGL} g/L Cu²⁺ · ${M.PLATE.bath.acidGL} g/L acid · ${M.PLATE.bath.chloridePpm} ppm Cl⁻`, "the patent's baseline bath, plus accelerator and suppressor additives"],
    ["Bump pitch", `≈${M.BUMP.c4PitchUm} µm C4 · ≈${M.BUMP.microPitchUm} µm micro-bump`, `AMD, Hot Chips 33; pillars plate at ${range(M.BUMP_MACM2)} mA/cm²`],
    ["Copper resistivity", `≈${M.COPPER.resistivity} µΩ·cm`, `up to ${M.COPPER.lessResistance}% lower wire resistance than aluminium`],
  ],
  innovationsTitle: "Key innovations",
  innovations: [
    `<strong>Copper replaces aluminium (IBM, ${M.COPPER.announced}).</strong> Copper cannot be etched cleanly like aluminium, so the industry turned the process around: etch the glass, fill with copper, polish. Electromigration lifetime improved by more than ${M.COPPER.emLifetime} times.`,
    `<strong>Low-k glass.</strong> Lowering the dielectric constant from about 4 to under 3, and with porosity toward 2, cut the capacitance between tightly packed wires.`,
    `<strong>Cobalt at the bottom.</strong> At the finest pitches the barrier and liner eat most of a copper wire's cross-section. Intel's 10 nm process put cobalt in M0 and M1 for ${M.COBALT.viaResistanceGain}× lower via resistance and ${M.COBALT.emGain} better electromigration. Cobalt is not a better conductor than copper; it wins because it needs a far thinner barrier and liner. Intel 4 went back to copper for M0 to M4, with a cobalt liner and cap.`,
    `<strong>Ruthenium next.</strong> Ruthenium can be etched into lines, as aluminium once was, instead of plated into trenches. ${M.RUTHENIUM.who} has shown two-level ruthenium wiring at ${M.RUTHENIUM.pitchNm} nm pitch, a candidate for the lowest layers after copper runs out.`,
  ],
  sources: [
    ["Andricacos (IBM): Copper On-Chip Interconnections, ECS Interface 1999", "https://www.electrochem.org/dl/interface/spr/spr99/IF3-99-Pages32-37.pdf"],
    ["Novellus Systems (Lam Research) patent US 10,214,826 B2: electroplating for damascene fill", "https://patents.google.com/patent/US10214826B2/en"],
    ["TSMC patent US 8,659,155 B2: mechanisms for forming copper pillar bumps", "https://patents.google.com/patent/US8659155B2/en"],
    ["Rohm and Haas / Dow patent US 10,104,782 B2: electroplating photoresist-defined copper pillars", "https://patents.google.com/patent/US10104782B2/en"],
    ["Tom's Hardware: AMD 3D packaging details at Hot Chips 33 (C4, micro-bump and hybrid bond pitch)", "https://www.tomshardware.com/news/amd-unveils-more-ryzen-3d-packaging-and-v-cache-details-at-hot-chips"],
    ["Real World Tech: Intel 4 interconnect stack", "https://www.realworldtech.com/intel-4/3"],
    ["Semiconductor Digest (TechInsights): Intel 4 drops cobalt, goes with copper with Co liner/cap", "https://semiconductor-digest.com/?p=20581"],
    ["WikiChip: Intel 10 nm switches to cobalt interconnects", "https://fuse.wikichip.org/news/525/iedm-2017-isscc-2018-intels-10nm-switching-to-cobalt-interconnects/2/"],
    ["imec: first two-level semi-damascene module at 18 nm pitch", "https://siliconsemiconductor.net/article/115049/Imec_produces_the_first_fully_self-aligned_two-metal-level_semi-damascene_module"],
  ],
};
