// Reading text under the figure. Numbers repeat model.mjs; sources are the ones the model was checked against.
import * as M from "./model.mjs";

export const LESSON = {
  intro: `A modern AI accelerator is not one chip but a small city of them. NVIDIA's Rubin GPU puts ${M.GPU.dies} reticle-sized compute dies and ${M.HBM.stacks} stacks of ${M.HBM.gen} memory side by side on a silicon-bridged interposer, all under one cold plate. Pull it apart layer by layer, or press Assemble.`,
  steps: [
    `<strong>Substrate.</strong> An organic build-up substrate with a ball grid underneath carries power in and NVLink 6 out at ${M.GPU.nvlinkTBs} TB/s. A stiffener ring keeps the large package flat.`,
    `<strong>Interposer.</strong> ${M.GPU.packaging} embeds small local silicon bridges in a redistribution layer, so only the short, dense die-to-memory and die-to-die wires run in silicon: ${(M.HBM.stacks * M.HBM.busBits).toLocaleString("en-US")} memory data lines in all.`,
    `<strong>HBM4.</strong> Each stack is a base logic die plus ${M.HBM.high} DRAM dies joined by through-silicon vias: ${M.HBM.gbPerStack} GB and a ${M.HBM.busBits.toLocaleString("en-US")}-bit interface per stack.`,
    `<strong>Compute dies.</strong> Two dies at the reticle limit, about the largest area one lithography exposure can print, joined by ${M.GPU.link} so software sees one GPU.`,
    `<strong>Cold plate.</strong> The stacks are ${M.HBM.heightUm} µm tall, the compute dies are thinned to match, and one liquid cold plate presses on all ten.`,
  ],
  numbers: [
    ["Transistors", `${M.GPU.transistorsB} billion`, `${M.GPU.node}`],
    ["HBM4 capacity", `${M.total} GB`, `${M.HBM.stacks} × ${M.HBM.high}-high × ${M.HBM.gbPerStack} GB`],
    ["Memory bandwidth", `${M.HBM.totalTBs} TB/s`, `≈${M.pinGbps.toFixed(1)} Gb/s per pin, derived`],
    ["NVLink 6", `${M.GPU.nvlinkTBs} TB/s`, "per GPU"],
    ["NVFP4", `${M.GPU.nvfp4Dense} PF dense · ${M.GPU.nvfp4Sparse} PF sparse`],
  ],
  innovationsTitle: "Why it is built this way",
  innovations: [
    "One die cannot be larger than the reticle (about 26 × 33 mm), so more compute means more dies, and the dies must talk over very short, very wide links.",
    "Memory bandwidth, not arithmetic, limits most AI workloads; stacking DRAM right beside the compute dies is what makes terabytes per second possible.",
    "Bridges instead of a full silicon interposer let the package grow past the size a single silicon interposer can be made.",
  ],
  sources: [
    ["Guru3D: NVIDIA details Rubin GPU architecture", "https://www.guru3d.com/story/nvidia-details-rubin-gpu-architecture-with-hbm4-nvlink-6-and-336-billion-transistors/"],
    ["Introl: Rubin in full production (CES 2026)", "https://introl.com/blog/nvidia-rubin-full-production-ces-2026-ai-infrastructure"],
    ["All About Circuits: JEDEC releases HBM4", "https://www.allaboutcircuits.com/news/jedec-officially-releases-hbm4-memory-standard"],
    ["TrendForce: HBM4 after the JEDEC standard", "https://www.trendforce.com/news/2025/04/28/news-following-jedecs-hbm4-standard-whats-next-for-sk-hynix-samsung-and-micron/"],
  ],
};
