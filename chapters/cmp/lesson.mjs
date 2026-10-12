// Reading text under the figure. Numbers come from model.mjs, where each carries its source.
import * as M from "./model.mjs";

const R = M.REFLEXION;

export const LESSON = {
  intro: `Every deposit leaves the wafer a little lumpy, and critical layers must be flat to within a few nanometres, or the wires come out at different heights and resistances, and later layers print poorly. Chemical mechanical polishing gets it there: the wafer is pressed face down on a spinning pad soaked in a reactive slurry, which softens the top of the film while fine abrasive wipes it away, highest points first.`,
  steps: [
    `<strong>Load.</strong> A load cup lifts the wafer into the carrier head, which holds it face down inside a retaining ring and carries it to the platen.`,
    `<strong>Slurry on.</strong> The platen spins up and the arm drips slurry onto the pad, about ${M.MIRRA.slurryMlMin} ml a minute in a published copper study: an oxidiser that softens the copper surface plus fine abrasive particles.`,
    `<strong>Press and spin.</strong> The head lowers and spins at nearly the platen's speed (${M.PLATEN_RPM} and ${M.HEAD_RPM} rpm in that 200 mm Mirra study, which pressed at ${M.MIRRA.psi[0]}–${M.MIRRA.psi[1]} psi). A flexible membrane behind the wafer is split into pressure zones, so the edge and the centre can be pushed slightly differently to even out the removal. On bulk copper a newer 300 mm Applied Reflexion LK runs about ${R.bulkPsi} psi.`,
    `<strong>Condition.</strong> A disc studded with diamonds sweeps across the pad (${R.condLbf} lbf, ${R.condRpm} rpm, ${R.sweepsPerMin} sweeps a minute) to keep it rough and open; without it the pad glazes and the removal rate falls.`,
    `<strong>Flatten.</strong> Bumps touch the pad first and are removed fastest, so the surface levels out as the copper overburden comes off, about ${M.BULK_NM} nm a minute on the first platen.`,
    `<strong>Endpoint.</strong> A window in the pad lets a sensor under the platen look at the film each time it passes under the wafer (the Mirra study used Applied's in-situ removal monitor, ISRM). The first platen removes the bulk copper fast and stops on time or on an endpoint signal shortly before the barrier; a second platen clears the last copper slowly (about ${M.CLEAR_NM} nm a minute) and stops when the window sees the barrier; a third removes the barrier in about ${R.barrierSeconds} s.`,

    `<strong>Rinse and clean.</strong> Water rinses the pad and wafer, the head sets the wafer back on the load cup, and a robot hands it to the cleaner, where soft PVA roller brushes scrub both faces before it is dried.`,
  ],
  numbers: [
    ["Bulk copper pressure", `${R.bulkPsi} psi`, `Reflexion LK, platen 1; older tools ran ${M.MIRRA.psi[0]}–${M.MIRRA.psi[1]} psi`],
    ["Platen / head speed", `${M.PLATEN_RPM} / ${M.HEAD_RPM} rpm`, `200 mm Mirra copper study at ${M.MIRRA.psi[0]}–${M.MIRRA.psi[1]} psi; range ${M.MIRRA.platenRpm[0]}–${M.MIRRA.platenRpm[1]} rpm`],
    ["Removal rate, bulk copper", `${M.BULK_NM} nm/min`, `${R.bulkWiwnu} % within-wafer non-uniformity, 750-wafer run`],
    ["Removal rate, final clear", `${M.CLEAR_NM} nm/min`, "stopped on an endpoint signal"],
    ["Dishing after polish", `under ${R.dishingAvgA / 10} nm average`, `after all three platens; under ${R.dishingMaxA / 10} nm worst case, 50 µm lines`],
    ["Flatness needed", `${M.PLANARITY.criticalNm} nm`, "within-die and within-wafer tolerance on critical layers"],
    ["Reflexion LK Prime", `${M.PRIME.pads} pads · ${M.PRIME.heads} heads`, `${M.PRIME.cleanChambers} cleaning and ${M.PRIME.dryChambers} drying chambers`],
  ],
  innovationsTitle: "Why it matters",
  innovations: [
    "Copper cannot be etched cleanly into fine lines, so chips are wired by the damascene method: etch trenches in the insulator, overfill them with copper, then polish the excess away. Without CMP there is no copper wiring.",
    "Each metal layer is polished flat before the next is built on it, and lithography can only print sharply on a surface that is flat to within its narrow depth of focus, so errors would otherwise pile up layer on layer.",
    `Downforce came down from ${M.DOWNFORCE.n130[0]}–${M.DOWNFORCE.n130[1]} psi at the 130 nm node and had to drop below ${M.DOWNFORCE.n65Below} psi for 65 nm (Applied, 2003), because above about ${M.DOWNFORCE.lowKFracturePsi} psi the shear on fragile low-k films with conventional pads and slurries reaches the point where they peel or crack; in-situ endpoint sensing is what lets a tool polish that gently and still stop within nanometres.`,
    "Planarity is now specified to a few nanometres for critical layers, so pad material, conditioning and slurry chemistry are tuned together as one system.",
  ],
  sources: [
    ["Kao, Yu, Shen: Robust operation of copper CMP (Microelectronic Engineering, 2003)", "https://scholars.lib.ntu.edu.tw/bitstream/123456789/67318/1/33.pdf"],
    ["3M: Diamond Pad Conditioner A165 for copper CMP on Applied Mirra and Reflexion LK", "https://multimedia.3m.com/mws/media/464442O/3m-diamond-pad-conditioner-a165.pdf"],
    ["Tseng et al. (IBM, DuPont): within-die planarity and defectivity for CMP (AVS, 2023)", "https://nccavs-usergroups.avs.org/wp-content/uploads/2023/01/P1-WTTseng.pdf"],
    ["Sun et al. (Applied Materials): low-downforce CMP for copper/low-k (Silicon Semiconductor, 2003)", "https://siliconsemiconductor.net/article/66785/Low-downforce_CMP_for_copper_low-k_structures/feature"],
    ["Applied Materials: Reflexion LK Prime CMP", "https://www.appliedmaterials.com/us/en/product-library/reflexion-lk-prime-cmp.html"],
  ],
};
