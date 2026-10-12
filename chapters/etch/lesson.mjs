// Reading text under the figure. Numbers come from model.mjs; sources are the ones the model was checked against.
import * as M from "./model.mjs";

export const LESSON = {
  intro: `Lithography only draws the pattern in a thin layer of resist. Etching carves it into the film underneath, and it has to cut straight down, not sideways. A plasma etcher does this with a glowing gas of ions and reactive fragments, inside a vacuum chamber like this one.`,
  steps: [
    `<strong>Pump to base.</strong> The chamber never opens to the air. Wafers come in from a vacuum transfer module, and only the load lock in front of the tool vents to atmosphere. The robot sets the wafer on the electrostatic chuck, the slit valve shuts, and the turbo pump, backed by a dry pump in the subfab below, pulls the chamber down to its base pressure. The throttle valve then holds the working pressure, ${M.ICP.pressureMTorr[0]} to ${M.ICP.pressureMTorr[1]} mTorr on a typical ICP tool, while gas flows in.`,
    `<strong>Gas in.</strong> Flow controllers in the gas box meter the etch gases (fluorocarbons for oxide, chlorine or HBr for silicon and metals) through the injector in the window's centre.`,
    `<strong>Strike the plasma.</strong> RF at ${M.ICP.rfMHz} MHz in the flat coil on top induces a current in the gas through the ceramic window. Electrons gain energy, split molecules into reactive radicals and ionise them: a dense plasma, about ${M.densityText}.`,
    `<strong>Bias on.</strong> A second RF supply on the chuck makes the wafer charge negative, so a thin dark sheath forms just above it. Ions fall through it and hit the wafer almost straight down. The coil sets how many ions there are; the bias sets how hard they hit.`,
    `<strong>The trench deepens.</strong> Radicals react with the exposed film; the ion bombardment drives that reaction on the trench floor. On the walls, where few ions land, a thin polymer or oxide layer builds up and protects them, so the cut stays vertical (anisotropic).`,
    `<strong>Endpoint.</strong> The spectrometer watches the plasma's light through the viewport. When the film clears, the products of that reaction stop forming and their emission lines fade. In a ${M.ENDPOINT.film} gate etch in ${M.ENDPOINT.gas}, a silicon-product emission line (${M.ENDPOINT.species}) at ${M.ENDPOINT.nm} nm drops as the etch reaches the oxide underneath, and the tool stops.`,
    `<strong>Strip.</strong> An oxygen plasma ashes the remaining resist and the sidewall polymer, often in the same chamber or a neighbouring one, before the wafer goes on to clean.`,
  ],
  numbers: [
    ["Coil RF", `${M.ICP.rfMHz} MHz`, `up to ${M.ICP.sourceW.toLocaleString("en-US")} W on a lab ICP tool (OIST)`],
    ["Working pressure", `${M.ICP.pressureMTorr[0]}–${M.ICP.pressureMTorr[1]} mTorr`, "a few millionths to about a ten-thousandth of an atmosphere"],
    ["Plasma density", M.densityText, "ICP at a few to tens of mTorr (US 5,846,883; NIST GEC cell)"],
    ["Endpoint line", `${M.ENDPOINT.species} at ${M.ENDPOINT.nm} nm`, `${M.ENDPOINT.film} etch in ${M.ENDPOINT.gas}; other films use other lines`],
    ["Wafer", `${M.WAFER.diameterMm} mm · ${M.WAFER.thicknessUm} µm thick`, "nominal"],
    ["Deepest holes (3D NAND)", `>${M.HAR.ratio}:1, up to ${M.HAR.depthUm} µm deep`, "Lam Cryo 3.0, on its dielectric etch line, a different reactor class from this conductor-etch chamber"],
  ],
  innovationsTitle: "Why it matters",
  innovations: [
    "Two RF supplies, one for density and one for ion energy, let engineers tune how fast and how straight a tool etches almost independently. That split is what made ICP the workhorse for gates, fins and shallow trenches.",
    `Memory pushes etch hardest: 3D NAND channel holes now run more than ${M.HAR.ratio} times deeper than they are wide. Lam's third-generation cryogenic etch, which etches at very low temperature, claims less than ${M.HAR.deviationPct}% profile deviation from top to bottom and ${M.HAR.rateX}× the rate of conventional dielectric etch.`,
    "At the newest nodes, atomic layer etching removes material in self-limiting cycles of a few atoms each, trading speed for control. Lam lists plasma-enhanced ALE on its Kiyo conductor etch line.",
    "The edge of the wafer is where yield is lost: replaceable focus rings and sheath tuning at the wafer edge keep the ions vertical all the way out.",
  ],
  sources: [
    ["Lam Research: Kiyo conductor etch product family", "https://www.lamresearch.com/product/kiyo-product-family/"],
    ["OIST: ICP-RIE tool specification (13.56 MHz, 2–100 mTorr)", "https://www.oist.jp/node/41134"],
    ["Miller et al., J. Res. NIST (1995): an ICP source for the GEC reference cell, densities near 10¹² cm⁻³", "https://pmc.ncbi.nlm.nih.gov/articles/PMC4887237/"],
    ["US 6,242,350: Cl₂/HBr polysilicon etch, endpoint on the silicon peak at 405 nm (SiClx in its WSix step)", "https://patents.google.com/patent/US6242350B1/en"],
    ["Pfeiffer Vacuum: Working with Turbopumps (why a turbo needs a backing pump)", "https://mmrc.caltech.edu/Vacuum/Pfeiffer%20Turbo/Turbos.pdf"],
    ["EMSNow: Lam Cryo 3.0 cryogenic etch for 3D NAND", "https://www.emsnow.com/?p=42504"],
  ],
};
