// Reading text under the figure. Every number comes from model.mjs.
import * as M from "./model.mjs";

const [V, A, H, B, R] = M.GENS;
const n = (v, d = 0) => v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

export const LESSON = {
  intro: `Nine years of NVIDIA's data-center GPUs, laid side by side to scale. A single die barely grew, because no die can be larger than the lithography field; what changed is everything around it: denser transistors, more and faster stacked memory, smaller number formats, and finally two dies working as one. Press Play and the inspection gantry visits each package in turn.`,
  steps: [
    `<strong>${V.name} (${V.year}, ${V.arch}).</strong> One ${V.dieMm2} mm² die on ${V.node} with ${V.transistorsB} billion transistors, beside ${V.hbm.stacks} ${V.hbm.gen} stacks on a ${V.packaging} interposer. New: <strong>Tensor Cores</strong>, small units that multiply whole 4 × 4 tiles of FP16 numbers at once, for ${V.flops.dense} TFLOPS. NVLink 2 links GPUs at ${V.nvlinkGBs} GB/s.`,
    `<strong>${A.name} (${A.year}, ${A.arch}).</strong> Almost the same die area (${A.dieMm2} mm²) on ${A.node}, but ${A.transistorsB} billion transistors. Six memory sites, five of them live; NVIDIA says only that five stacks are enabled, and the figure draws the sixth as an inactive dummy (illustrative). New: <strong>TF32</strong>, so FP32 code runs on Tensor Cores unchanged, and <strong>2:4 structured sparsity</strong>, which skips two of every four weights to double throughput (${A.flops.dense} → ${A.sparse} TFLOPS FP16).`,
    `<strong>${H.name} (${H.year}, ${H.arch}).</strong> ${H.dieMm2} mm² on ${H.node}, ${H.transistorsB} billion transistors, ${H.hbm.stacks} live ${H.hbm.gen} stacks at ${H.bwTBs} TB/s. New: the <strong>Transformer Engine</strong>, which chooses between FP8 and 16-bit math layer by layer and rescales values so 8-bit numbers keep enough accuracy: ${n(H.flops.dense)} TFLOPS dense FP8.`,
    `<strong>${B.name} (${B.year}, ${B.arch}).</strong> A single die had hit the reticle limit, so ${B.name} uses <strong>two reticle-sized dies</strong> joined by a ${B.dieLinkTBs} TB/s die-to-die link (NV-HBI) and presented to software as one GPU: ${B.transistorsB} billion transistors on ${B.node}, ${B.hbm.stacks} ${B.hbm.gen} stacks, ${B.bwTBs} TB/s, on ${B.packaging}; memory, bandwidth and FLOPS here are per-GPU shares of NVIDIA's DGX B200 totals. New: <strong>FP4</strong> with fine-grained (micro-tensor) scaling, about ${n(B.flops.dense / 1000)} PFLOPS dense.`,
    `<strong>${R.name} (${R.year}).</strong> Two dies again, now on ${R.node} with ${R.transistorsB} billion transistors, and ${R.hbm.stacks} ${R.hbm.gen} stacks with twice the interface width per stack: ${R.memGB} GB at ${R.bwTBs} TB/s. NVLink 6 reaches ${n(R.nvlinkGBs / 1000, 1)} TB/s per GPU and NVIDIA quotes NVFP4 throughput as ${n(R.flops.dense / 1000)} PFLOPS dense (its training figure) and ${n(R.sparse / 1000)} PFLOPS for inference, which Guru3D's NVIDIA-sourced spec table lists as sparse.`,
  ],
  numbers: [
    ["Transistors", `${V.transistorsB} B → ${R.transistorsB} B`, `${Math.round(M.GROWTH.transistors)}× in ${M.GROWTH.years} years, while die area stayed near 815 mm² until the split into two dies`],
    ["Memory bandwidth", `${n(V.bwTBs * 1000)} GB/s → ${R.bwTBs} TB/s`, `${Math.round(M.GROWTH.bandwidth)}×: more stacks, wider stacks and faster pins`],
    ["Memory capacity", `${V.memGB} GB → ${R.memGB} GB`, `${V.hbm.gen} (${V.hbm.stacks} stacks, 4-high) to ${R.hbm.gen} (${R.hbm.stacks} stacks, 12-high)`],
    ["Low-precision math", `${V.flops.dense} TF FP16 → ${n(R.flops.dense / 1000)} PF NVFP4`, `${Math.round(M.GROWTH.flops)}× on paper, dense to dense, but the number format shrank from 16 to 4 bits along the way (B200 ${n(B.flops.dense / 1000)} PF FP4, DGX B200 ÷ 8). With sparsity: B200 ${n(B.sparse / 1000)} PF FP4, Rubin ${n(R.sparse / 1000)} PF NVFP4, about ${n(R.sparse / B.sparse, 1)}×`],
    ["Power per GPU", `${V.watts} W → ${n(B.watts)} W`, `${B.name} in the HGX configuration (up to 1,200 W in GB200); Rubin is reported near ${n(R.watts / 1000, 1)} kW (a J.P. Morgan estimate via TechNews), not an NVIDIA spec`],
    ["GPU-to-GPU link (NVLink)", `${V.nvlinkGBs} GB/s → ${n(R.nvlinkGBs / 1000, 1)} TB/s`, "per GPU, doubling almost every generation"],
  ],
  innovationsTitle: "Key innovations",
  innovations: [
    "<strong>Matrix units (Tensor Cores, 2017).</strong> Neural networks are mostly matrix multiplies, so dedicated tile multipliers gave far more math per watt than general-purpose cores.",
    "<strong>Smaller numbers (FP16 → FP8 → FP4).</strong> Halving the bits per number roughly doubles the math per cycle and halves memory traffic. TF32 (2020) went the other way: a 19-bit format that lets ordinary FP32 code run on Tensor Cores. Scaling tricks (the Transformer Engine, micro-tensor scaling) keep training and inference accurate. This is also why the FLOPS line is not a like-for-like comparison.",
    "<strong>Sparsity (2020).</strong> A fixed 2:4 pattern of zero weights lets the hardware skip half the work without irregular memory access.",
    "<strong>Memory beside the die.</strong> Every generation added HBM bandwidth because most AI work waits on memory, not arithmetic. Stacks grew from 4 to 12 DRAM dies, and HBM4 doubled the interface to 2,048 bits.",
    "<strong>Two dies as one (2024).</strong> At the reticle limit, the only way to grow is more dies with a link so fast (10 TB/s on B200) that software sees one GPU. NVLink then joins many such GPUs into one rack-scale system.",
  ],
  sources: [
    ["NVIDIA Tesla V100 (Volta) architecture whitepaper", M.SRC.volta],
    ["NVIDIA A100 (Ampere) architecture whitepaper", M.SRC.ampere],
    ["NVIDIA A100 product specifications", M.SRC.a100],
    ["NVIDIA Hopper architecture in depth (developer blog)", M.SRC.hopper],
    ["NVIDIA H100 product specifications", M.SRC.h100],
    ["NVIDIA: Blackwell platform announcement (GTC 2024)", M.SRC.blackwell],
    ["NVIDIA DGX B200 specifications", M.SRC.dgxb200],
    ["Glenn Lockwood: B200 notes, citing NVIDIA's Blackwell technical brief", M.SRC.b200power],
    ["NVIDIA developer blog: Inside the NVIDIA Rubin platform", M.SRC.rubinBlog],
    ["Guru3D: NVIDIA details Rubin GPU architecture", M.SRC.rubin],
    ["TrendForce: HBM4 after the JEDEC standard (stack height and capacity)", M.SRC.hbm4Jedec],
    ["HPCwire: NVIDIA says Rubin will deliver 5x AI inference boost over Blackwell (CES 2026)", M.SRC.rubinCES],
    ["SiliconANGLE: NVIDIA debuts Rubin chip (CES 2026)", M.SRC.rubinCES2],
    ["Igor's Lab: Rubin enters production on TSMC 3 nm (N3P reported)", M.SRC.rubinNode],
    ["TechNews: Rubin power may reach 2,300 W (J.P. Morgan estimate, not an NVIDIA figure)", M.SRC.rubinPower],
  ],
};
