// Reading text under the figure. Numbers come from model.mjs.
import * as M from "./model.mjs";

export const LESSON = {
  intro: `Every chip starts as sand. Quartz is turned into silicon that is about ${M.MGSI.purityEG} % pure on the chip-grade route, then into a liquid that can be distilled, then back into solid silicon so clean that only about one atom in ten billion is something else. The last step happens in a Siemens reactor, where silicon grows on glowing rods under a steel bell.`,
  steps: [
    `<strong>Metallurgical silicon.</strong> Quartz and carbon are heated in an electric arc furnace running above ${M.MGSI.furnaceC} °C. The carbon pulls the oxygen off the silica and leaves silicon that is ${M.MGSI.puritySoG}–${M.MGSI.purityEG} % pure: fine for aluminium alloys, far too dirty for a transistor.`,
    `<strong>TCS synthesis (direct chlorination).</strong> The silicon is ground and blown with hydrogen chloride through a fluidised bed at about ${M.TCS.synthesisC} °C. It leaves as trichlorosilane, SiHCl₃, with some silicon tetrachloride beside it (${M.TCS.reaction}).`,
    `<strong>Distillation.</strong> SiHCl₃ boils at ${M.TCS.boilC} °C, so the metals, boron and phosphorus that would spoil a chip can be separated from it by their different boiling points: lighter compounds boil off first, and the metal chlorides stay behind in the bottom of the column. Electronic grade runs it through about ${M.DIST.passesEG} distillation passes; solar grade about ${M.DIST.passesSoG}.`,
    `<strong>Deposition.</strong> In the reactor, thin silicon rods stand in pairs on graphite chucks, bridged at the top into hairpins. Current through the rods heats them to about ${M.CVD.rodC} °C. SiHCl₃ and hydrogen flow in through the baseplate and silicon deposits on the hot rods (${M.CVD.reaction}). The rods grow from ${M.CVD.slimMm} mm to ${M.CVD.finalMm[0]}–${M.CVD.finalMm[1]} mm across. Fraunhofer ISE, citing Yang et al. (2025), considers about ${M.CVD.growEG} mm an hour plausible for electronic grade. The double steel wall is water cooled so silicon does not deposit on it.`,
    `<strong>Harvest.</strong> The reactor is cooled, the bell jar is lifted off and the rods are pulled out. They are crushed into chunks, etched in acid to clean the surface, and sent to the crystal pullers of the next chapter.`,
  ],
  numbers: [
    ["MG-Si purity", `${M.MGSI.puritySoG}–${M.MGSI.purityEG} %`, "solar-grade and electronic-grade feed"],
    ["TCS synthesis", `≈${M.TCS.synthesisC} °C`, "fluidised bed, MG-Si + HCl"],
    ["Distillation passes", `${M.DIST.passesEG} (EG) vs ${M.DIST.passesSoG} (solar)`, `SiHCl₃ boils at ${M.TCS.boilC} °C`],
    ["Rod temperature", `≈${M.CVD.rodC} °C`, `up to ${M.CVD.rodMaxC.toLocaleString("en-US")} °C`],
    ["Rod diameter", `${M.CVD.slimMm} → ${M.CVD.finalMm[0]}–${M.CVD.finalMm[1]} mm`, `growth ≈${M.CVD.growEG} mm/h plausible for electronic grade (ISE, after Yang et al. 2025)`],
    ["Electricity", `≈${M.CVD.kWhPerKgCvdEG} kWh/kg in the reactor`, `${M.CVD.kWhPerKgEG[0]}–${M.CVD.kWhPerKgEG[1]} kWh/kg for the whole plant, 2025 estimate`],
    ["Electronic-grade purity", `${M.GRADE.egNines[0]}N–${M.GRADE.egNines[1]}N`, `99.99999999 % or better; solar mono grade is ${M.GRADE.solarMonoNines[0]}N–${M.GRADE.solarMonoNines[1]}N`],
  ],
  innovationsTitle: "Why it is built this way",
  innovations: [
    "Silicon cannot be distilled, but trichlorosilane can. Turning the metal into a low-boiling liquid is what makes purification to parts per trillion possible.",
    `The rods are heated by their own current while the bell wall is cooled, so silicon lands only where it is wanted. The price is energy: about ${M.CVD.kWhPerKgCvdEG} kWh for every kilogram in the reactor alone, and producers recover ${M.CVD.heatRecovered[0]}–${M.CVD.heatRecovered[1]} % of it as heat to run the distillation columns.`,
    `Electronic grade grows more slowly than solar grade (about ${M.CVD.growEG} mm/h against ${M.CVD.growSoG}, per Fraunhofer ISE) in smaller reactors, because slow, even growth keeps the rod dense and the impurity count low.`,
    "Hydrogen, HCl and silicon tetrachloride leaving the reactor are recovered and fed back into the earlier steps: the SiCl₄ is turned back into trichlorosilane by hydrochlorination, so the plant runs as a closed chlorine loop.",
  ],
  sources: [
    ["Fraunhofer ISE (2025): Electricity consumption for the production of electronic-grade polysilicon", M.SRC.ise],
    ["Bernreuter Research: Polysilicon production processes", M.SRC.br],
    ["NTNU: Quartz and carbon in the silicon furnace (K. F. Jusnes)", M.SRC.ntnu],
  ],
};
