// Reading text under the figure. Numbers come from model.mjs; sources are the ones the model was checked against.
import * as M from "./model.mjs";

export const LESSON = {
  intro: `Every accelerator package sits on a substrate: a thick board that carries power and signals from the circuit board up to the chiplets. Today its core is a glass-fibre and resin laminate. The next step is a core of solid glass, which stays flat and keeps its size when hot, and can be given holes (laser-modified, then etched) up to about ${M.pitchRatio.toFixed(1)} times closer together, so much bigger packages become possible. Press Play to follow one ${M.PANEL.w} × ${M.PANEL.d} mm panel from bare glass to finished packages.`,
  steps: [
    `<strong>Bare panel.</strong> A thin sheet of glass, ${M.PANEL.w} × ${M.PANEL.d} mm (the panel size DNP is scaling to), is held flat on a vacuum chuck. Glass is very flat to begin with, which Intel says improves depth of focus for lithography, and its thermal expansion is set by its composition (about ${M.GLASS_CTE_RANGE[0]} to ${M.GLASS_CTE_RANGE[1]} ppm/°C), so it can be tuned toward silicon (about ${M.SILICON_CTE}) or toward the board.`,
    `<strong>Laser modify.</strong> The table steps the panel under a laser head row by row. ${M.LIDE.pulses === 1 ? "A single pulse" : `${M.LIDE.pulses} pulses`} at each via site changes the glass through its whole thickness (up to ${M.LIDE.maxMm} mm) without cutting it, so no cracks or chips form.`,
    `<strong>Wet etch.</strong> In a wet bath the laser-changed glass dissolves much faster than the rest, and every site opens into an hourglass-shaped through-glass via (TGV). LPKF quotes aspect ratios of 1:${M.LIDE.aspect[0]} to 1:${M.LIDE.aspect[1]}.`,
    `<strong>Seed and fill.</strong> A thin seed metal coats the hole walls and copper is plated in, turning each hole into a vertical wire through the core.`,
    `<strong>Build-up layers.</strong> Fine wiring layers are built up on both faces. Because glass stays flat and does not shrink, the layers line up better: Intel targets lines and spaces under ${M.INTEL.lineSpaceUm} µm.`,
    `<strong>Singulate and attach.</strong> The panel is cut into substrates (four of the largest, ${M.INTEL.packageMm} mm, fit on one panel) and the compute dies and memory stacks are bonded on top. In a factory these last steps run on other machines; the figure keeps the panel on one stage.`,
  ],
  numbers: [
    ["Through-hole density", `up to ${M.INTEL.densityX}×`, `Intel, glass vs organic core; about ${M.pitchRatio.toFixed(1)}× tighter pitch, derived`],
    ["TGV pitch", `<${M.INTEL.tgvPitchUm} µm`, `Intel target, with <${M.INTEL.lineSpaceUm}/${M.INTEL.lineSpaceUm} µm line and space`],
    ["Package size", `up to ${M.INTEL.packageMm} × ${M.INTEL.packageMm} mm`, `vs ${M.INTEL.organicMaxMm} × ${M.INTEL.organicMaxMm} mm on organic today (Intel); more than ${M.INTEL.reticles} reticles of silicon`],
    ["Pattern distortion", `${M.INTEL.distortionPct}% less`, "Intel, from glass tolerating higher temperatures"],
    ["Thermal expansion", `${M.GLASS_CTE_RANGE[0]}–${M.GLASS_CTE_RANGE[1]} ppm/°C, tunable`, `Corning; set by the glass mix, so it can be matched toward silicon (about ${M.SILICON_CTE}) or the board. LPKF uses about ${M.GLASS_CTE[1]} for a substrate core`],
    ["Intel test vehicle", `${M.INTEL.tgvUm} µm TGVs · ${M.INTEL.rdl} RDL layers`, `and filled vias at about ${M.INTEL.aspect}:1 in a ${M.INTEL.coreMm} mm core (a separate result)`],
    ["First factory", `${M.ABSOLICS.m2.toLocaleString("en-US")} m² a year`, `Absolics, Covington, Georgia; about ${M.panelsPerYear.toLocaleString("en-US")} panels of this size, derived`],
  ],
  innovationsTitle: "Why glass, and who is building it",
  innovations: [
    `Organic cores bow and shift as they heat, which caps how fine the wiring can be and how big a package can get. Intel gives four reasons for glass: higher temperature tolerance with ${M.INTEL.distortionPct}% less pattern distortion, ultra-low flatness for lithography depth of focus, dimensional stability for tight layer-to-layer overlay, and up to ${M.INTEL.densityX}× interconnect density. The section display in front of the machine shows the first three side by side.`,
    `The laser-then-etch trick (LIDE, from LPKF) is what makes glass practical: drilling glass mechanically or by ablation cracks it, while one pulse plus a wet etch leaves clean, tapered holes in the millions.`,
    `Intel built a glass R&D line in Chandler, Arizona for over $${M.INTEL.investB} billion (2023). Since then it has reportedly begun licensing its glass-core technology and pushed its own use toward ${M.STATUS.intelUse} (trade press reports, not an Intel statement). SKC's Absolics has the first plant, in Covington, Georgia, backed by $${M.ABSOLICS.chipsM} M of CHIPS production funding plus up to $${M.ABSOLICS.napmpM} M in R&D grants (NAPMP); it is still in customer qualification rather than volume shipping. Samsung Electro-Mechanics plans volume after ${M.SEMCO.after} through a joint venture with Sumitomo Chemical.`,
    `Glass is brittle and its edges can chip, and filling deep, narrow holes evenly is hard. These, and cost, are why organic and glass substrates are expected to coexist for years.`,
  ],
  sources: [
    ["Intel briefing slides: glass core substrate, Sept 2023 (via Igor's Lab)", "https://www.igorslab.de/wp-content/uploads/2023/09/Glass-Core-Substrate.pdf"],
    ["LPKF: LIDE process and glass core requirements (2024)", "https://www.lpkf.com/fileadmin/mediafiles/user_upload/company/investor-relations/financial-reports/2024/Berenberg_Conference_2024_LPKF_Website.pdf"],
    ["DNP: TGV glass core substrate, 510 × 515 mm panel", "https://www.global.dnp/en/news/detail/2023/03/0320_20169052/"],
    ["KED Global: Absolics plant and US CHIPS grants", "https://www.kedglobal.com/korean-chipmakers/newsView/ked202411220005"],
    ["Samsung Electro-Mechanics: glass substrate JV (Nov 2025)", "https://www.samsungsem.com/global/newsroom/news/view.do?id=9850"],
    ["Tom's Hardware: glass substrate roadmaps and Intel licensing (2026)", "https://tomshardware.com/tech-industry/manufacturing/glass-substrate-roadmap-examined"],
  ],
};
