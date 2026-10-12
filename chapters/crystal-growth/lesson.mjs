// Reading text under the figure. Numbers come from model.mjs; sources are the ones the model was checked against.
import * as M from "./model.mjs";

const kg = (value) => Math.round(value);

export const LESSON = {
  intro: `A chip starts as one perfect crystal of silicon. In a Czochralski puller, ${M.RUN.chargeKg} kg of ultra-pure polysilicon is melted in a quartz crucible, a small seed crystal is dipped into the melt, and the seed is turned and drawn slowly upward so the melt freezes onto it atom by atom in the same crystal order. Press Play to watch one run, from melting to lifting out a ${M.RUN.crystalMm} mm crystal.`,
  steps: [
    `<strong>Melt.</strong> Chunks of polysilicon and a measured pinch of dopant (boron for p-type) are melted in the quartz crucible by a graphite heater, under argon. Silicon melts at ${M.SI.meltC} °C.`,
    `<strong>Dip the seed.</strong> A seed crystal ${M.RUN.seedMm[0]}–${M.RUN.seedMm[1]} mm across, cut along the chosen crystal direction, is lowered on a cable, warmed above the melt, and touched to its surface.`,
    `<strong>Dash neck.</strong> The touch shocks the seed and creates dislocations. Pulling fast makes a thin neck ${M.RUN.neckRangeMm[0]}–${M.RUN.neckRangeMm[1]} mm across, and the dislocations run out of its sides, so what grows below is dislocation-free.`,
    `<strong>Shoulder.</strong> The pull slows down, so the crystal grows outward as well as down. It widens in a rounded crown from the thin neck to the full ${M.RUN.crystalMm} mm.`,
    `<strong>Body.</strong> Most of the run is spent here. The diameter is held at ${M.RUN.crystalMm} mm by adjusting heater power and pull speed while a camera watches the bright ring where crystal meets melt. Crystal and crucible turn in opposite directions, and the crucible rises so the melt surface stays at the same height. Argon flows down past the crystal and out over the melt, sweeping away the silicon monoxide that evaporates from it, and leaves through exhaust ports in the chamber floor.`,
    `<strong>Tail.</strong> At the end the crystal is pulled faster so it narrows to a cone. Lifting a full-width crystal off the melt would shock it and send dislocations back up the body.`,
    `<strong>Cool and remove.</strong> The crystal is lifted into the pull chamber, the gate valve closes, and it cools before it is taken out and sent to be ground, sliced and polished into wafers.`,
  ],
  numbers: [
    ["Melting point of silicon", `${M.SI.meltC} °C`],
    ["Charge in a 24-inch hot zone", `${M.RUN.chargeKg} kg`, `${M.RUN.hotZoneIn}-inch crucible, the run drawn here; by ${M.RUN.hotZoneMainYear} most 300 mm crystals already came from ${M.RUN.hotZoneMainIn}-inch hot zones`],
    ["Neck diameter", `${M.RUN.neckRangeMm[0]}–${M.RUN.neckRangeMm[1]} mm`, `Dash necking; the seed itself is ${M.RUN.seedMm[0]}–${M.RUN.seedMm[1]} mm`],
    ["Rotation", `crystal ${M.RUN.crystalRpm[0]}–${M.RUN.crystalRpm[1]} rpm · crucible ${M.RUN.crucibleRpm[0]}–${M.RUN.crucibleRpm[1]} rpm`, "in opposite directions"],
    ["One metre of 300 mm body", `≈ ${kg(M.bodyKgPerM)} kg`, `derived from silicon's density, ${M.SI.solidDensity} g/cm³`],
    ["A run", `${M.RUN.days[0]}–${M.RUN.days[1]} days`, `per pulling run at Siltronic Freiberg, for 300 mm crystals larger than the ${M.RUN.chargeKg} kg Tu et al. run drawn here`],
  ],
  innovationsTitle: "Why it matters",
  innovations: [
    `Dash necking (1959) is why crystals can be grown dislocation-free at all. Nearly every crystal grown for chips today still starts with a thin Dash neck (neck-free seeding exists but is rare).`,
    `Oxygen from the quartz crucible dissolves into the melt and ends up in the crystal. A little is useful, since it traps metal impurities, but it must be controlled. A magnetic field across the melt (MCZ) damps the convection that carries it; horizontal fields of ${M.MCZ.fieldG / 1e4} T and more are used. One horizontal-field process grows crystals below ${M.MCZ.oxygenBelow / 1e17}×10¹⁷ oxygen atoms/cm³, and the cusp field drawn here holds it in a set range along the length.`,
    "The ratio of pull speed to the temperature gradient at the growth surface decides whether leftover vacancies or extra atoms freeze into the crystal. Holding it at a critical value over the whole wafer grows near-perfect silicon with almost no voids, which the finest transistors need.",
    `Bigger crystals mean bigger wafers and cheaper chips: a 300 mm wafer has 2.25 times the area of a 200 mm one. A 24-inch puller such as the EKZ 3500 holds crystals up to ${M.PULLER.crystalLengthMm / 1000} m long and weighs about ${M.PULLER.massKg / 1000} tonnes.`,
  ],
  sources: [
    ["Tu et al., Growth of 300 mm silicon single crystals in a 24-inch hot zone (ECS)", M.SRC.tu],
    ["PVA TePla EKZ 3500 Czochralski puller, technical data", M.SRC.ekz],
    ["Siltronic: crystal pulling at Freiberg (300 mm ingots of several hundred kilograms, five to seven days)", M.SRC.siltronic],
    ["US 6670036: seed crystal and Dash necking", M.SRC.dashPatent],
    ["Royal Society of Chemistry: silicon (melting point, density)", M.SRC.rsc],
    ["US 8460462: horizontal-field MCZ and low-oxygen silicon", M.SRC.hmcz],
    ["US 5968264: horizontal magnetic field of at least 2000 G across the melt", M.SRC.field],
    ["US 8187383: purge gas carries the SiO evaporated from the melt out of the chamber", M.SRC.purge],
  ],
};
