// Reading text under the figure. Numbers come from model.mjs, where each carries its source.
import * as M from "./model.mjs";

const fmt = (n) => n.toLocaleString("en-US");

export const LESSON = {
  intro: `A finished wafer is ${M.WAFER.um} µm thick, far thicker than a chip needs to be, and it holds dozens to hundreds of chips that are still joined together. Two machines fix that: a grinder wears the back of the wafer away until only a thin skin of silicon under the circuits is left, and a dicing saw cuts along the narrow streets between the chips so each one can be picked off on its own.`,
  steps: [
    `<strong>Tape the front.</strong> A protective tape is laminated over the circuit side. The wafer is then laid face down on the grinder's porous ceramic chuck, which holds it by vacuum through the tape.`,
    `<strong>Back-grind.</strong> A diamond cup wheel (Φ${M.GRINDER.wheelMm} mm on a DISCO DGP8761) spins with its rim crossing the wafer centre while the chuck turns underneath, and feeds slowly downward. A coarse wheel takes most of the stock, a fine wheel the last tens of microns, and a contact gauge stops the feed at the target: here ${M.TARGET_UM} µm, so about ${M.removedPct} % of the silicon is ground away. Grinding leaves a thin layer of cracked, strained silicon behind, so the same tool then polishes it away (dry polish or CMP); without that step a die this thin cracks easily. Tools of this class go below ${M.GRINDER.minUm} µm.`,
    `<strong>Mount on a frame.</strong> A wafer that thin is as flexible as paper, so it is laminated onto dicing tape stretched across a steel ring frame, and the front tape is peeled off. From here on the frame is what the machines handle.`,
    `<strong>Align.</strong> On the dicing saw a camera finds the pattern of streets, the empty lanes left between chips, and the θ table turns the wafer until they run exactly along the X axis.`,
    `<strong>Cut X, turn, cut Y.</strong> A hub blade a few tens of microns thick spins at tens of thousands of rpm while the table feeds the wafer under it; water jets cool the blade and wash away the slurry. After each street the spindle indexes across by one die pitch (the axis can step by ${M.SAW.indexUm} µm). When every X street is cut the table turns 90° and the Y streets are cut the same way.`,
    `<strong>UV release and pick.</strong> UV light cures the tape's adhesive so it lets go of the dies. A vacuum collet then lifts the good dies off the tape, helped by an ejector needle pushing up from underneath; dies flagged bad in the wafer probe map are left behind. In a fab this is done on a separate die sorter or bonder, after the tape is stretched to open gaps between the dies.`,
  ],
  numbers: [
    ["Wafer as it leaves the fab", `${M.WAFER.um} µm`, `${M.WAFER.mm} mm wafer, ±${M.WAFER.tolUm} µm (SEMI nominal)`],
    ["Thickness after grinding", `${M.TARGET_UM} µm in this example`, `${M.removedUm} µm ground away; DGP8761 class tools go below ${M.GRINDER.minUm} µm`],
    ["HBM DRAM dies", `${M.HBM.thinnerPct} % thinner`, `SK hynix, so ${M.HBM.high} dies fit the height of the old ${M.HBM.was}-high stack`],
    ["Saw spindle speed", `${fmt(M.SAW.rpm[0])} to ${fmt(M.SAW.rpm[1])} rpm`, `DISCO DFD6362, 1.2/1.8 kW spindle; a ${fmt(M.BLADE.testRpm)} rpm silicon test in DISCO's blade data`],
    ["Blade width", `${M.BLADE.commonKerfUm[0]} to ${M.BLADE.commonKerfUm[1]} µm`, `common blade widths (the kerf is about the blade width); DISCO's ZHZZ hub blades can cut a ${M.BLADE.thinKerfUm} µm kerf`],
    ["Y index step", `${M.SAW.indexUm} µm`, `θ table turns up to ${M.SAW.thetaDeg}°`],
  ],
  innovationsTitle: "Why it matters",
  innovations: [
    `Thin dies are what make stacking possible. An HBM stack piles ${M.HBM.high} or more DRAM dies inside a fixed package height, so each die has to be ground to a few tens of microns; SK hynix made its dies ${M.HBM.thinnerPct} % thinner to go from ${M.HBM.was} to ${M.HBM.high} high.`,
    "Through-silicon vias are buried in the front of the wafer. Grinding brings the back to within a few microns of the vias, and an etch or polish then reveals them, so the stacked dies can connect through their backs.",
    `Every street is silicon that is thrown away. Thinner blades and narrower streets fit more dies on a wafer; common blades are ${M.BLADE.commonKerfUm[0]} to ${M.BLADE.commonKerfUm[1]} µm wide, and DISCO's ZHZZ hub blades can cut a ${M.BLADE.thinKerfUm} µm kerf.`,
    `Stealth dicing replaces the blade with a laser focused inside the wafer. It leaves a weakened layer along each street, then the tape is stretched and the dies snap apart: no kerf loss, no water, no chipping. Done before grinding (SDBG), it is aimed at dies under ${M.TARGET_UM} µm, which a blade struggles to cut without cracking.`,
  ],
  sources: [
    ["DISCO: DGP8761 fully automatic grinder/polisher", "https://disco.co.jp/eg/products/polisher_etcher/dgp8761.html"],
    ["DISCO: DFD6362 dicing saw catalog", "https://www.disco.co.jp/eg/products/catalog/pdf/dfd6362.pdf"],
    ["DISCO: ZHZZ hub blades for narrow streets", "https://disco.co.jp/eg/products/blade/zhzz.html"],
    ["DISCO: Stealth Dicing", "https://disco.co.jp/eg/solution/library/laser/stealth.html"],
    ["Hamamatsu: Stealth dicing technology", "https://www.hamamatsu.com/us/en/product/lasers/laser-related-products/stealth-dicing-technology.html"],
    ["HPCwire: SK hynix begins mass production of 12-layer HBM3E", "https://hpcwire.com/off-the-wire/sk-hynix-begins-mass-production-of-12-layer-hbm3e"],
  ],
};
