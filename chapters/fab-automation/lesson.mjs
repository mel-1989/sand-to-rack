// Reading text under the figure. Numbers come from model.mjs; sources are the ones the model cites.
import * as M from "./model.mjs";

const fmt = (n) => n.toLocaleString("en-US");

export const LESSON = {
  intro: `A wafer never travels alone and never touches open air. It rides with ${M.FOUP.lot - 1} others in a sealed pod called a FOUP, carried by vehicles that run on rails under the cleanroom ceiling, from tool to tool, for ${M.CYCLE_TEXT.replace("≈", "about ")} at the leading edge. Press Play to follow one wafer through one visit to one tool.`,
  steps: [
    `<strong>Stocker to rail.</strong> Between tools, lots wait in a stocker. An overhead hoist transport (OHT) vehicle picks up the FOUP from the stocker's port and drives along a ceiling rail. Daifuku said in ${M.AMHS.asOf} that a large fab could have up to ${M.AMHS.railKm} km of rail and ${M.AMHS.vehicles} vehicles; Samsung says one vehicle covers about ${M.AMHS.kmPerDay} km a day.`,
    `<strong>Hoist down.</strong> Above the tool, the vehicle stops and lowers the FOUP on belts onto the load port's kinematic pins, ${fmt(M.LOAD_PORT.datumMm)} mm above the floor, the height SEMI E15.1 fixes for every tool. A hand-off signal link defined by ${M.AMHS.handoffStd}, usually carried by infrared transceivers on OHT systems, lets vehicle and port agree when it is safe to let go.`,
    `<strong>Door opens.</strong> The hoist sets the FOUP down just short of the port. The load port slides it forward against its plate, unlatches the FOUP door, pulls it inside and lowers it, so the wafers face the tool's clean front end without ever meeting the room air.`,
    `<strong>Robot to tool.</strong> Inside the equipment front end module (EFEM), a robot slides a thin fork under one wafer, lifts it from its slot (slots are ${M.FOUP.pitchMm} mm apart), turns and passes it through a slit valve into the tool's load lock.`,
    `<strong>Process and return.</strong> The slit valve shuts while the tool works. Then the robot brings the wafer back to its slot, the door closes, the port slides the FOUP back off its plate, and an OHT lifts it away to the next tool.`,
    `<strong>Around and around.</strong> A wafer repeats this loop of deposit, pattern, etch, implant, polish and inspect hundreds of times, layer on layer: an advanced logic flow has ${M.FLOW.stepsLogic[0]} to ${fmt(M.FLOW.stepsLogic[1])} steps or more, and SemiEngineering projected 7 nm at ${M.FLOW.maskLayers7nm[0]} to ${M.FLOW.maskLayers7nm[1]} mask layers.`,
  ],
  numbers: [
    ["Wafers per FOUP", `${M.FOUP.wafers} × ${M.FOUP.waferMm} mm`, `${M.FOUP.pitchMm} mm slot pitch · ${M.FOUP.massKg[0]}–${M.FOUP.massKg[1]} kg loaded`],
    ["Time in the fab", `${M.FLOW.cycleWeeksAdvanced[0]}–${M.FLOW.cycleWeeksAdvanced[1]} weeks`, `SIA: advanced processes, ${M.CYCLE_TEXT.replace("≈", "about ")}; ${M.FLOW.cycleWeeksAvg} weeks on average across all chips`],
    ["Process steps", `${M.FLOW.stepsLogic[0]}–${fmt(M.FLOW.stepsLogic[1])}+`, `advanced logic; SIA counts up to ${fmt(M.FLOW.stepsMax)}`],
    ["Time per layer", `${M.FLOW.daysPerLayer[0]}–${M.FLOW.daysPerLayer[1]} days`, `7 nm: ${M.FLOW.maskLayers7nm[0]}–${M.FLOW.maskLayers7nm[1]} mask layers (2017 projection)`],
    ["Load port height", `${fmt(M.LOAD_PORT.datumMm)} mm`, `SEMI E15.1 datum; robot reach ${M.LOAD_PORT.accessMm[0]}–${M.LOAD_PORT.accessMm[1]} mm above it`],
    ["Air cleanliness", `ISO ${M.CLEAN.bayIso} bay · ISO ${M.CLEAN.miniIso[0]} or better inside`, `ISO ${M.CLEAN.bayIso} allows ${fmt(M.iso5PerM3)} particles ≥0.1 µm per m³, ISO 1 only ${M.iso1PerM3}`],
    ["OHT rail", `up to ${M.AMHS.railKm} km`, `Daifuku, ${M.AMHS.asOf}: ${M.AMHS.vehicles} vehicles in a large fab; ≈${M.AMHS.kmPerDay} km a day each`],
  ],
  innovationsTitle: "Why it is built this way",
  innovations: [
    `<strong>Clean where it counts.</strong> Sealing the wafers in FOUPs and opening them only inside small filtered minienvironments lets the bay run at ISO ${M.CLEAN.bayIso} while the wafer sees ISO ${M.CLEAN.miniIso[0]} or better.`,
    `<strong>Standards make it a system.</strong> Because SEMI fixes the FOUP, the port height and the hand-off signals, a vehicle from one maker can serve a tool from any other, and a fab can mix hundreds of tools from dozens of vendors.`,
    `<strong>300 mm wafers need machines, not people.</strong> A full FOUP weighs ${M.FOUP.massKg[0]}–${M.FOUP.massKg[1]} kg, so automated handling is essential in all but the smallest fabs, and moving it on ceiling rails keeps the floor free for tools.`,
    `<strong>Cycle time is money.</strong> Each extra patterning layer adds another lap of the loop, about ${M.FLOW.daysPerLayer[0]}–${M.FLOW.daysPerLayer[1]} days each, so automation that cuts waiting at every tool shortens the months a chip takes to make.`,
  ],
  sources: [
    ["SemiEngineering: Battling fab cycle times", "https://semiengineering.com/battling-fab-cycle-times"],
    ["SIA: why ramping chip production takes time", "https://www.semiconductors.org/chipmakers-are-ramping-up-production-to-address-semiconductor-shortage-heres-why-that-takes-time/"],
    ["Samsung Semiconductor: the invisible highways inside a fab", "https://news.samsungsemiconductor.com/global/the-invisible-highways-tracing-the-journey-inside-a-semiconductor-fab/"],
    ["Wikipedia: FOUP (SEMI E47.1 sizes, pitch and weight)", "https://en.wikipedia.org/wiki/FOUP"],
    ["US patent 9,834,378, citing SEMI E15.1 load port dimensions", "https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/9834378"],
    ["SEMI E84: enhanced carrier handoff parallel I/O interface", "https://store-us.semi.org/products/e08400-semi-e84-specification-for-enhanced-carrier-handoff-parallel-i-o-interface"],
    ["CHEManager: minienvironments for semiconductor production (German)", "https://chemanager-online.com/de/themen/minienvironments-fuer-die-halbleiterproduktion-und-nano-technologie"],
  ],
};
