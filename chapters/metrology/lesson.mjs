// Reading text under the figure. Numbers come from model.mjs; sources are the ones the model was checked against.
import * as M from "./model.mjs";

export const LESSON = {
  intro: `A fab cannot see its own work with the naked eye, so it measures it. After key steps a sample of wafers visits metrology tools that check sizes and alignment, and inspection tools that hunt for defects. The workhorse for size is the CD-SEM, a scanning electron microscope built to measure the width of lines a few tens of nanometres wide, thousands of times a day.`,
  steps: [
    `<strong>Wafer loads.</strong> A robot sets the wafer in a small load lock, which is pumped down before the gate valve opens, so the main chamber stays under vacuum. The wafer passes through onto the chuck of an x-y stage.`,
    `<strong>Navigate to site.</strong> The stage, tracked by a laser interferometer, carries the wafer under an optical head that finds alignment marks. Overlay marks, such as a box printed in one layer inside a box printed in the next, show how far two layers have shifted against each other.`,
    `<strong>E-beam scans.</strong> A field-emission gun makes the electrons, two condenser lenses set the beam current, the objective focuses it to a tiny spot, and scan coils sweep that spot across the site line by line. The beam energy is kept low, ${M.NIST.landingEv} eV landing energy in a NIST study and about ${M.FIRST.kev} kV on the first CD-SEM of ${M.FIRST.year}, so the resist does not charge or shrink.`,
    `<strong>Image builds.</strong> Each spot knocks low-energy secondary electrons out of the surface. More escape from steep edges, so line edges show up bright. The detector's count at each point becomes one pixel, and the image fills in one scan line at a time.`,
    `<strong>Edge detection.</strong> Software takes the brightness along a line across the pattern, finds where it crosses a threshold on each edge, and reports the distance between them as the critical dimension (CD). Each bright edge zone can be ${M.NIST.bloomNm} nanometres wide, so the choice of algorithm matters.`,
    `<strong>Result and SPC.</strong> The CD is compared with its spec, then plotted on a statistical process control chart. A point outside the control limits, or a run drifting one way, stops the lot and flags the tool that printed it.`,
  ],
  numbers: [
    ["First CD-SEM", `${M.FIRST.year}`, `${M.FIRST.maker} ${M.FIRST.model}, about ${M.FIRST.kev} keV, when lines got too small for optical microscopes`],
    ["Landing energy, NIST study", `${M.NIST.landingEv} eV · ${M.NIST.beamPa} pA`, "low energy to keep resist from charging and shrinking"],
    ["Lowest voltage, GT2000", `${M.GT2000.volts} V`, `Hitachi, ${M.GT2000.year}, for the thin resist of High-NA EUV`],
    ["Scanner overlay, NXE:3800E", `${M.OVERLAY.mmoNm} nm`, `matched machine overlay at ${M.OVERLAY.wph} wafers an hour (ASML acceptance test); the NXE:3600D spec is ${M.OVERLAY.previousNm} nm`],
    ["Multibeam inspection, eScan 1000", `${M.ESCAN.beams} beams`, `ASML, ${M.ESCAN.year}, up to ${M.ESCAN.gainPct}% more throughput than one beam`],
  ],
  innovationsTitle: "Metrology, inspection and yield",
  innovations: [
    `<strong>Metrology measures, inspection searches.</strong> A CD-SEM or overlay tool measures a known feature at chosen sites very precisely. An inspection tool scans large areas looking for anything unexpected: particles, bridges, missing patterns. Fast optical inspection covers whole wafers; slower e-beam inspection, now with ${M.ESCAN.beams} beams at once, sees defects too small for light.`,
    `<strong>Overlay is as tight as the lines.</strong> Each layer must land on the one below to within about a nanometre: ASML's NXE:3800E reaches ${M.OVERLAY.mmoNm} nm between matched scanners, so overlay marks are measured on every lithography layer.`,
    `<strong>Sampling is a budget.</strong> Measuring takes time, so fabs measure a few wafers a lot and a few sites a wafer, and move the effort to where the variation is. One patented plan moves from ${M.SAMPLING.sitesFrom} to ${M.SAMPLING.sitesTo} sites a wafer while cutting from ${M.SAMPLING.wafersFrom} to ${M.SAMPLING.wafersTo} wafers a lot when wafer-to-wafer drift dominates.`,
    `<strong>Yield learning runs on this data.</strong> Defect maps, CDs and overlay from every step are matched against the electrical test results at the end, so engineers can trace a failing die back to the step and the tool that caused it. A new process starts with low yield and climbs as this loop finds and removes the causes.`,
  ],
  sources: [
    ["Semiconductor History Museum of Japan: the CD-SEM (1984)", "https://shmj.or.jp/english/pdf/em/exhibi2448E.pdf"],
    ["NIST, NISTIR 7089: Shape-sensitive linewidth measurements of resist structures", "https://nvlpubs.nist.gov/nistpubs/Legacy/IR/nistir7089.pdf"],
    ["Hitachi: GT2000 high-precision electron beam metrology system (2023)", "https://www.hitachi.com/en/press/articles/2023/12/1212/"],
    ["ASML, EUVL 2023: EUV industrialization (NXE:3800E overlay)", "https://euvlitho.com/2023/P62.pdf"],
    ["US patent 6,947,805: dynamic metrology sampling for identified lots", "https://patents.google.com/patent/US6947805"],
    ["ASML: eScan 1000 multibeam inspection (2020)", "https://www.asml.com/en/news/press-releases/2020/asml-ships-first-generation-multibeam-inspection-system"],
  ],
};
