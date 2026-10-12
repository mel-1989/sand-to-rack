// Reading text under the figure. Numbers come from model.mjs, which carries the sources.
import * as M from "./model.mjs";

const B = M.SPECIES.B;
const Ph = M.SPECIES.P;
const As = M.SPECIES.As;

export const LESSON = {
  intro: `A transistor works only where the silicon has been seeded with a few foreign atoms: boron makes it p-type, phosphorus or arsenic n-type. An ion implanter fires those atoms into the wafer as a beam, choosing the exact element with a magnet, the depth with the beam energy and the amount by counting charge. A short, very hot anneal then heals the damage and lets the atoms take their place in the crystal.`,
  steps: [
    `<strong>Ionise.</strong> A dopant gas (${B.gas}, ${Ph.gas} or ${As.gas}) flows into the arc chamber, where a hot filament strikes a plasma of charged fragments.`,
    `<strong>Extract.</strong> Electrodes at high voltage pull positive ions out through a slit, forming a beam.`,
    `<strong>Select the mass.</strong> In the analyzer magnet each ion bends on a radius set by its momentum, so at one field strength only one mass (say ${B.ion}, not ¹⁰B⁺ or BF₂⁺) lines up with the resolving slit. The rest strike the walls.`,
    `<strong>Accelerate.</strong> A column of graded electrodes (or an RF linear accelerator for MeV beams) sets the final energy, which sets the depth.`,
    `<strong>Scan.</strong> The beam sweeps side to side while the wafer moves through it, tilted about ${M.TILT_DEG}° so ions cannot slip down the crystal's open channels. A Faraday cup at the edge of the sweep measures beam current; integrating it gives the dose.`,
    `<strong>Stop at depth.</strong> Each ion loses energy in collisions and stops in a spread around a mean depth, the projected range. Heavier ions stop shallower.`,
    `<strong>Anneal.</strong> The implant knocks the crystal about. A spike anneal in a lamp-heated chamber, or a millisecond laser or flash anneal, repairs the lattice and moves the dopants onto lattice sites, where they become electrically active, while letting them diffuse as little as possible.`,
  ],
  numbers: [
    ["Energy range", `${M.TOOLS.mediumKeV[0]} keV to ${M.TOOLS.maxMeV} MeV`, `Axcelis Purion M covers 2 keV–1 MeV; the RF-LINAC Purion XE series reaches ${M.TOOLS.maxMeV} MeV (XEmax)`],
    ["Dose range", `${M.sci(M.TOOLS.doseRange[0])} to ${M.sci(M.TOOLS.doseRange[1])} ions/cm²`, "five orders of magnitude, set by counting charge"],
    ["Tilt", `${M.TILT_DEG}°`, "off the crystal axis, to avoid channelling"],
    ["Projected range at 100 keV", `B ${B.rpNm} · P ${Ph.rpNm} · As ${As.rpNm} nm`, "read from SRIM-2013 curves; approximate"],
    ["Throughput", `up to ${M.TOOLS.wph} wafers/hour`, `a moderate dose can take about ${M.WAFER_SECONDS} s per 300 mm wafer`],
    ["Anneal", `spike ≈${M.ANNEAL.spikeC.toLocaleString("en-US")} °C · ms anneal ${M.ANNEAL.msaC[0].toLocaleString("en-US")}–${M.ANNEAL.msaC[1].toLocaleString("en-US")} °C`, `lamp RTP reaches ${M.ANNEAL.rtpC[1].toLocaleString("en-US")} °C in ${M.ANNEAL.rtpSeconds[0]}–${M.ANNEAL.rtpSeconds[1]} s; ms anneals last hundreds of µs to a few ms`],
  ],
  innovationsTitle: "Why it matters",
  innovations: [
    "Implantation separates the two things a designer needs: how many atoms (the dose, counted precisely from the beam current) and how deep (the energy). Diffusion from a surface source could not do that.",
    "As transistors shrank, junctions had to get shallower, so beams went to lower energies and anneals got shorter: from furnace hours, to lamp spikes of about a second, to millisecond laser and flash anneals that heat only the surface.",
    "Image sensors and power chips need deep wells, which pushed high-energy tools to RF linear accelerators and energies of several MeV.",
    "One modern logic chip goes through many implants (wells, threshold adjusts, source/drain extensions, contacts), each one a separate trip through a machine like this.",
  ],
  sources: [
    ["Axcelis: Purion M medium-current implanter", "https://www.axcelis.com/purion-m-mid-current-ion-implantation/"],
    ["Axcelis: Purion XE high-energy series", "https://www.axcelis.com/products/purion-xe-series-high-energy-ion-implantation/"],
    ["Axcelis at PAC 2013: Purion XE beamline (dose range)", "https://accelconf.web.cern.ch/pac2013/talks/weyb2_talk.pdf"],
    ["Georgia Tech ECE6450: Ion implantation lecture", "https://alan.ece.gatech.edu/ECE6450/Lectures/ECE6450L5-Ion%20Implantation.pdf"],
    ["Coherent: projected range statistics (SRIM-2013)", "https://www.coherent.com/content/dam/coherent/site/en/resources/datasheet/materials/ion-implantation-projected-range-statistics-ds.pdf"],
    ["Laser Focus World: wafer annealing meets the 28 nm node", "https://www.laserfocusworld.com/home/article/16547890/photonics-applied-microelectronics-processing-semiconductor-wafer-annealing-meets-the-28-nm-node"],
  ],
};
