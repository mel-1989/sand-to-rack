// Reading text under the figure. Numbers come from model.mjs; sources are the ones the model was checked against.
import * as M from "./model.mjs";

export const LESSON = {
  intro: `Most of a chip is built by adding thin films to a wafer and then carving them. Before each film the surface must be spotless, and some films are grown from the silicon itself while others are laid down from a gas, a plasma or a metal target. The figure is a cluster tool, a ring of vacuum chambers around a robot, with one atomic layer deposition (ALD) chamber cut open: press Play to carry a wafer in and grow a film one layer at a time.`,
  steps: [
    `<strong>Wet clean.</strong> The classic RCA clean dips wafers in two hot baths. SC-1 (${M.RCA.sc1.mix}, about ${M.RCA.sc1.tempC} °C) lifts organic residue and particles; SC-2 (${M.RCA.sc2.mix}) dissolves metal ions. A dilute HF dip can then strip the thin oxide these leave. Many fabs now clean one wafer at a time on a spinning chuck, spraying the chemicals on and rinsing them off.`,
    `<strong>Thermal oxidation.</strong> In a hot furnace, oxygen or steam turns the top of the silicon itself into silicon dioxide. Dry oxygen grows slowly and gives the best oxide; steam grows thicker oxide faster. The Deal–Grove model (1965), fitted to data from ${M.OXIDATION.fromC} to ${M.OXIDATION.toC} °C, still describes how thickness grows with time.`,
    `<strong>Chemical vapour deposition (CVD).</strong> Gases react on a hot wafer and leave a solid film. Low-pressure CVD in a furnace runs ${M.CVD.lpcvd[0]}–${M.CVD.lpcvd[1]} °C with ${M.CVD.lpcvdBatch}+ wafers per load; plasma-enhanced CVD (PECVD) lets a plasma supply the energy instead, so it runs at ${M.CVD.pecvd[0]}–${M.CVD.pecvd[1]} °C, cool enough to go over finished transistors and wiring.`,
    `<strong>Physical vapour deposition (PVD).</strong> In a sputter chamber, argon ions from a plasma knock atoms off a metal target, and they land on the wafer facing it. A rotating magnet behind the target (the magnetron) holds the plasma close to it. PVD lays down barrier and seed metals for copper wiring.`,
    `<strong>Atomic layer deposition (ALD).</strong> Two gases are never let in together. A pulse of ${M.ALD.precursorLong} (${M.ALD.precursor}) bonds to the reactive OH sites on the surface until no room is left, then stops, because it cannot bond to itself. Its bulky methyl groups shade neighbouring sites, so one cycle adds less than a full atomic layer. A ${M.ALD.purge} purge sweeps away the excess. A ${M.ALD.coreactant} pulse turns the surface back into a fresh layer of sites, and a second purge ends the cycle. Each cycle adds the same thin slice of ${M.ALD.film}, so thickness is set by counting cycles.`,
    `<strong>Why a cluster tool.</strong> Load locks pump down from air to vacuum, so the central transfer chamber never vents. The robot can then pre-clean a wafer, deposit one film, then another, in different chambers without exposing the surface to air in between.`,
  ],
  numbers: [
    ["ALD growth per cycle", `≈${M.ALD.gpcNm} nm`, `${M.ALD.precursor} + ${M.ALD.coreactant} at ${M.ALD.tempC} °C, about ${Math.round(M.ALD.monolayerShare * 100)}% of a monolayer (Puurunen 2005)`],
    ["Cycles for 10 nm of Al₂O₃", `≈${M.cyclesFor10nm}`, "derived from the growth per cycle"],
    ["SC-1 clean", `${M.RCA.sc1.mix}`, `${M.RCA.sc1.tempC} ± 5 °C for ${M.RCA.sc1.minutes} min (UBC Nanofab procedure)`],
    ["Thermal oxidation", `${M.OXIDATION.fromC}–${M.OXIDATION.toC} °C`, "temperatures the Deal–Grove model was fitted to (Deal and Grove 1965)"],
    ["LPCVD vs PECVD", `${M.CVD.lpcvd[0]}–${M.CVD.lpcvd[1]} °C vs ${M.CVD.pecvd[0]}–${M.CVD.pecvd[1]} °C`, "the plasma replaces heat (Plasma-Therm)"],
    ["Hafnium oxide gate dielectric", `${M.HIGHK.eotNm.toFixed(1)} nm EOT`, `Intel ${M.HIGHK.node}, ${M.HIGHK.year}: equivalent oxide thickness`],
  ],
  innovationsTitle: "Why it matters",
  innovations: [
    `ALD made the high-k gate possible. When silicon dioxide gates thinned to a few atoms and leaked, Intel's ${M.HIGHK.node} chips (${M.HIGHK.year}) switched to a hafnium-based dielectric, a film that has to be uniform to a fraction of a nanometre.`,
    "ALD coats every surface it can reach to the same thickness, including the sides and undersides of the fins and stacked nanosheets in today's transistors, which line-of-sight PVD cannot do.",
    "Because the gases never meet in the chamber, growth is set by surface chemistry rather than by gas flow, so a whole 300 mm wafer gets the same film. The cost is speed: a film grows a fraction of an atom per cycle.",
    "Clustering chambers around one vacuum robot keeps sensitive surfaces from oxidising between steps, which matters more as films shrink to a few atoms.",
  ],
  sources: [
    ["Puurunen, Surface chemistry of ALD: the trimethylaluminum/water process, J. Appl. Phys. 97, 121301 (2005)", "https://doi.org/10.1063/1.1940727"],
    ["UBC Nanofab: RCA-1 silicon wafer cleaning", "https://www.nanofab.ubc.ca/?p=744"],
    ["Deal and Grove, General relationship for the thermal oxidation of silicon, J. Appl. Phys. 36, 3770 (1965)", "https://doi.org/10.1063/1.1713945"],
    ["Plasma-Therm: LPCVD vs PECVD white paper", "https://www.plasmatherm.com/wp-content/uploads/2022/04/Plasma-Therm-LPCVD-vs-PECVD-Whitepaper.pdf"],
    ["UBC Nanofab: RCA-2 silicon wafer cleaning", "https://www.nanofab.ubc.ca/?p=747"],
    ["EDN: Intel 45 nm high-k metal gate, HfO2 at 1.0 nm EOT", "https://www.edn.com/?p=4005680"],
    ["Intel press release (2007): first 45 nm hafnium-based high-k metal gate processors", "https://www.intel.com/pressroom/archive/releases/2007/20071111comp.htm"],
    ["ASM XP4 Pulsar: up to four ALD modules on one cluster platform", "https://www.asm.com/our-technology-products/ald/xp4-pulsar"],
  ],
};
