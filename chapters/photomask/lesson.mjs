// Reading text under the figure. Numbers come from model.mjs; sources are the ones the model was checked against.
import * as M from "./model.mjs";

const n = M.fmt;

export const LESSON = {
  intro: `Before a fab can print a chip it needs a stencil for every layer: a photomask. A finished design is turned into data, the data is written onto a glass blank by ${n(M.BEAMLETS)} electron beams at once, and the blank is etched, checked and sealed. Press Play to follow one mask from tape-out to pellicle.`,
  steps: [
    `<strong>Design to tape-out.</strong> Engineers describe the chip in RTL (Verilog). Synthesis maps it to a netlist of standard cells, place and route lays out the cells and wires, and sign-off checks timing, power and the foundry's design rules (DRC, LVS). The result is tape-out: a GDSII or OASIS file of polygons, one set per layer.`,
    `<strong>Correct and fracture.</strong> Light bends round features smaller than its wavelength, so optical proximity correction (OPC) or inverse lithography (ILT) reshapes every polygon until the printed result matches the design; ILT often produces curves. The corrected data is then fractured into the writer's own format, here pixel data for ${n(M.BEAMLETS)} beamlets, streamed at up to ${M.WRITER.dataGbps} Gbit/s.`,
    `<strong>Write.</strong> One cathode lights an aperture plate with ${M.WRITER.beamsSide} × ${M.WRITER.beamsSide} holes; each beamlet is switched on or off per pixel, and ${M.WRITER.reduction}:1 optics shrink the array to an ${M.WRITER.fieldUm} µm field of ${M.WRITER.beamNm} nm beams at ${M.WRITER.keV} keV. The stage carries the resist-coated blank under the column in vacuum, stripe by stripe.`,
    `<strong>Develop and etch.</strong> The exposed resist is developed, and the pattern is etched into the ${M.STACK.absorber} absorber down to the ${M.STACK.capMat} capping layer. Where absorber is removed, the ${M.STACK.pairs}-pair Mo/Si mirror below reflects EUV light; where it stays, the light is absorbed.`,
    `<strong>Inspect and repair.</strong> The finished pattern is compared against the design data. Defects are mapped and fixed, for example with a focused electron beam that adds or removes material.`,
    `<strong>Pellicle.</strong> A thin membrane on a frame is mounted over the pattern so dust lands out of focus instead of on the mask. EUV pellicles must pass more than ${M.PELLICLE.transmit} % of the light both ways.`,
  ],
  numbers: [
    ["Beamlets", `${n(M.BEAMLETS)}`, `${M.WRITER.beamsSide} × ${M.WRITER.beamsSide} array, each ${M.WRITER.beamNm} nm at the mask, ${M.WRITER.keV} keV`],
    ["Write time", `< ${M.WRITER.writeHours} h a mask`, `IMS MBMW-101 at the 7 nm node; single-beam writers can take ${M.VSB_HOURS} h or more on dense layers`],
    ["Mask blank", `${M.BLANK.sideMm} × ${M.BLANK.sideMm} × ${M.BLANK.thickMm} mm`, "the 6 × 6 × 0.25 inch format"],
    ["EUV mirror", `${M.STACK.pairs} Mo/Si pairs`, `period about ${M.STACK.periodNm} nm, so about ${n(M.MULTILAYER_NM)} nm in all; up to ${M.STACK.reflect} % reflectivity at ${M.STACK.wavelengthNm} nm`],
    ["Scanner reduction", `${M.SCANNER.reduction}×`, `a ${M.SCANNER.fieldMm[0]} × ${M.SCANNER.fieldMm[1]} mm wafer field is ${M.MASK_FIELD_MM[0]} × ${M.MASK_FIELD_MM[1]} mm on the mask (derived)`],
    ["Masks per chip", `${M.MASKS_PER_CHIP[0]} to ${M.MASKS_PER_CHIP[1]}`, "one per patterned layer, for a leading-edge chip"],
  ],
  innovationsTitle: "Why it is built this way",
  innovations: [
    `A single shaped beam writes one rectangle at a time, so dense, curvy ILT patterns could take ${M.VSB_HOURS} hours or more. Writing all ${n(M.BEAMLETS)} pixels of a field at once makes write time almost independent of pattern complexity.`,
    "EUV light is absorbed by every material, including glass, so an EUV mask is a mirror, not a transparent stencil: a Bragg stack of molybdenum and silicon layers each a few nanometres thick, with the pattern in an absorber on top.",
    `The scanner shrinks the mask ${M.SCANNER.reduction}×, so a mask error is also shrunk, but every defect on a mask is printed in every die of every wafer; that is why each mask is inspected, repaired and sealed under a pellicle.`,
  ],
  sources: [
    ["IMS Nanofabrication: multi-beam mask writer products", "https://www.ims.co.at/en/products/"],
    ["IMS patent EP3070528: multi-beam writer column (262,144 beamlets, 50 keV, 20 nm, 200:1)", "https://data.epo.org/publication-server/rest/v1.2/patents/EP3070528NWA1/document.html"],
    ["Semiconductor Engineering: Multi-beam mask writing finally comes of age", "https://semiengineering.com/multi-beam-mask-writing-finally-comes-of-age"],
    ["University of Kassel: Mo/Si multilayers for EUV lithography", "https://www.uni-kassel.de/forschung/en/ina/technological-electronics/research/past-projects/multilayer-structures-for-the-lithography-in-extreme-uv-euvl"],
    ["Lee et al.: ZrSi2 as a candidate EUV pellicle material (requirements)", "https://pmc.ncbi.nlm.nih.gov/articles/PMC10456829/"],
    ["ASML: TWINSCAN NXE:3400B (4× reduction, 26 × 33 mm field)", "https://asml.com/en/products/euv-lithography-systems/twinscan-nxe3400b"],
  ],
};
