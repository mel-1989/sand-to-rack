// Reading text under the figure. Numbers come from model.mjs; sources are the ones the model was checked against.
import * as M from "./model.mjs";

export const LESSON = {
  intro: `A grown crystal is a long cylinder of single-crystal silicon. To become wafers it is cut into blocks, ground round, glued to a beam and pushed through a web of fine wire that cuts it into hundreds of slices at once. Each slice is then rounded at the edge, etched and polished on both faces until it is flat and clean enough to build chips on. Press Play to watch it happen.`,
  steps: [
    `<strong>Grind and notch.</strong> The crystal is cut into blocks and ground to the finished diameter, ${M.WAFER.diameterMm} mm. A groove ground along its length becomes the ${M.fmt(M.WAFER.notchDepthMm, 1)} mm notch on every wafer, marking the ${M.WAFER.notchAxis} crystal direction so later tools can line the wafer up.`,
    `<strong>Mount.</strong> The block is glued to a sacrificial beam on a work plate, and the plate is clamped into the saw's feed head. The wire finishes each cut in the beam, so the slices stay hanging from it.`,
    `<strong>Slice.</strong> One steel wire, ${M.fmt(M.SAW.wireDiaMm, 2)} mm thick, is wound hundreds of times round grooved guide rollers to make a web. It runs at up to ${M.fmt(M.SAW.wireSpeedMMin)} m/min while slurry, an abrasive carried in fluid, flows onto it, and the head feeds the block down through the web at ${M.SAW.feedMmMin[0]}–${M.SAW.feedMmMin[1]} mm/min. Every wire cuts at once.`,
    `<strong>Edge grind.</strong> A grooved profile wheel rounds each wafer's sharp edge so it does not chip in later handling.`,
    `<strong>Lap and etch.</strong> Lapping takes off roughly ${M.LINE.lapUmPerSide} µm from each face to make them parallel and remove saw marks, and an alkaline or acid etch strips the damaged layer that is left.`,
    `<strong>Double-side polish.</strong> Wafers sit in thin toothed carriers between two padded platens. The carriers turn like planet gears while slurry polishes both faces at once.`,
    `<strong>Clean and inspect.</strong> After cleaning, each wafer is measured and checked for particles before it ships: ${M.WAFER.diameterMm} ± ${M.WAFER.diameterTolMm} mm across and ${M.WAFER.thicknessUm} ± ${M.WAFER.thicknessTolUm} µm thick.`,
  ],
  numbers: [
    ["Wafer", `${M.WAFER.diameterMm} ± ${M.WAFER.diameterTolMm} mm · ${M.WAFER.thicknessUm} ± ${M.WAFER.thicknessTolUm} µm`, "A typical 300 mm prime wafer specification"],
    ["Notch", `${M.fmt(M.WAFER.notchDepthMm, 1)} mm deep · ${M.WAFER.notchAngleDeg}°`, `Marks the ${M.WAFER.notchAxis} direction, SEMI standard`],
    ["Saw wire", `${M.fmt(M.SAW.wireDiaMm, 2)} mm · ${M.SAW.wireStoreKm} km a spool`, `${M.SAW.model}, a 300 mm slurry wire saw`],
    ["Wire speed", `up to ${M.fmt(M.SAW.wireSpeedMMin)} m/min`, `About ${M.fmt(M.wireSpeedMs, 1)} m/s; Takatori's MWS-612SD runs ${M.TAKATORI.wireSpeedMMin} m/min`],
    ["Feed through the web", `${M.SAW.feedMmMin[0]}–${M.SAW.feedMmMin[1]} mm/min`, `So a ${M.WAFER.diameterMm} mm cut takes at least ${M.minCutMin} minutes, derived`],
    ["Block size", `Φ${M.SAW.workDiaMm} × ${M.SAW.workLenMm} mm`, "Largest block the MWM3050NQ takes; hundreds of wafers a cut"],
  ],
  innovationsTitle: "Why it is done this way",
  innovations: [
    `One pass of the saw cuts hundreds of wafers at once, and each cut is only a little wider than the ${M.fmt(M.SAW.wireDiaMm, 2)} mm wire, so little of the costly crystal turns to dust.`,
    "The notch replaced the flat edge of smaller wafers. It wastes far less area and still tells every tool which way the crystal faces.",
    "300 mm wafers are polished on both sides at once. A double-side polisher makes the two faces flat and parallel together, which lithography needs across the whole wafer.",
    "Each step leaves a little damage that the next one removes: saw marks, then lapping marks, then a chemically damaged layer, until the surface is a near-perfect crystal.",
  ],
  sources: [
    ["Komatsu NTC MWM3050NQ 12-inch wafer wire saw: specifications", "https://www.komatsu.com/en-us/products/equipment/machine-tools/wafer-manufacturing-equipment/mwm3050nq"],
    ["Takatori MWS-612SD multi-wire saw", "https://takatori-g.co.jp/english/products/products_mws/detail/mws-612sd.html"],
    ["Siltronic: how wafers are made, from crystal to polished wafer", "https://www.siltronic.com/en/products.html"],
    ["Silicon Valley Microelectronics: 300 mm wafer specification SV031", "https://svmi.com/wp-content/uploads/2020/09/SV031.pdf"],
  ],
};
