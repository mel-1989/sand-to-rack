// Reading text under the figure. Numbers come from model.mjs.
import * as M from "./model.mjs";

const pct = (v) => `${Math.round(v * 100)} %`;

export const LESSON = {
  intro: `Not every die on a finished wafer works, and packaging a bad one wastes everything stacked around it. So before the wafer is cut, a prober presses a card of microscopic springs onto each die in turn while a tester the size of a wardrobe runs it, and the result goes into a map of good and bad dies. Press play to watch one wafer go through.`,
  steps: [
    `<strong>Load.</strong> A robot takes the wafer from its FOUP, pre-aligns it by its notch and lays it on a vacuum chuck that can be held anywhere from about ${M.CHUCK_C[0]} to +${M.CHUCK_C[1]}${M.NB}°C on a low/high temperature prober (a figure from prober maker Plum Five), so parts are tested cold and hot.`,
    `<strong>Align.</strong> A camera looking down finds marks on the wafer and a camera on the stage looks up at the probe tips. With both positions known, the stage can put any pad under any probe, repeating to about ±${M.STAGE_REPEAT_UM} µm.`,
    `<strong>Touch down.</strong> The chuck rises until the probes touch the die's pads, then keeps going about ${M.OVERDRIVE_UM} µm (cards are specified anywhere from ${M.OVERDRIVE_RANGE_UM[0]} to ${M.OVERDRIVE_RANGE_UM[1]} µm). The overdrive makes every one of thousands of springs press hard enough to scrub through the pad's oxide.`,
    `<strong>Test.</strong> The test head, docked on the card through a ring of pogo pins, drives the die through scan, memory and functional patterns and measures currents and timing. On an Advantest V93000, ordinary digital pins run at up to ${M.DIGITAL_GBPS}${M.NB}Gb/s, and a separate high-speed card reaches ${M.PAM4_GBPS}${M.NB}Gb/s (PAM4) for fast serial links.`,
    `<strong>Bin and step.</strong> The die is binned pass or fail (often into several speed or repair bins), the chuck drops, steps one die pitch and rises again. A full wafer of ${M.GROSS} large dies is a map like the one on the monitor.`,
    `<strong>After the wafer.</strong> Good dies are cut out and packaged, then tested again: <em>final test</em> in a socket on the same kind of tester, often <em>burn-in</em> at raised temperature and voltage to shake out weak parts early, and for AI accelerators <em>system-level test</em> in a board that runs real workloads at full power. One Blackwell-class part can spend well over ${M.AI_TEST_MIN} minutes on a tester, against ${M.PHONE_TEST_S[0]}-${M.PHONE_TEST_S[1]} s for a phone chip.`,
  ],
  numbers: [
    ["Dies on a 300 mm wafer", `${M.GROSS}`, `${M.DIE_MM[0]} × ${M.DIE_MM[1]} mm reticle-sized dies inside a ${M.EDGE_EXCLUSION_MM} mm edge exclusion; derived`],
    ["Expected good dies", `${M.GOOD} (${pct(M.POISSON_YIELD)})`, `Poisson model at D0 = ${M.D0_PER_CM2}/cm² (TSMC N5, 2020); real accelerators recover many more through spare cores; illustrative`],
    ["Probes on one card", `${M.PROBES_LOGIC} to ${M.PROBES_HBM}`, `FormFactor; the largest cards reach about ${M.PROBES_MAX_K},000`],
    ["Overdrive", `${M.OVERDRIVE_UM} µm`, `typical; ${M.OVERDRIVE_RANGE_UM[0]}-${M.OVERDRIVE_RANGE_UM[1]} µm across card designs`],
    ["Probe card price", "hundreds of thousands of dollars", `the largest full-wafer-contact cards, per Rudolph Technologies (undated); Aehr Test puts an HBM wafer-level burn-in card at $${M.HBM_CARD_K},000, which sacrificial pads can cut by up to ${M.SAC_PAD_SAVE}${M.NB}%`],
    ["Fastest high-speed I/O card", `${M.PAM4_GBPS}${M.NB}Gb/s`, `Advantest Pin Scale Multilevel Serial, PAM4, for SerDes-type links; general digital pins run at up to ${M.DIGITAL_GBPS}${M.NB}Gb/s`],
    ["Advantest + Teradyne", `about ${M.ATE_SHARE} %`, "combined share of the tester market, per a Wing VC estimate"],
  ],
  innovationsTitle: "Why it matters now",
  innovations: [
    `<strong>Known good die.</strong> A GPU package carries ${M.HBM_PER_GPU} HBM stacks around the compute dies; one bad die found after assembly scraps the whole package, so every die is tested before it is bonded.`,
    `<strong>HBM is tested many times.</strong> DRAM wafers are probed ${M.HBM_SITES[0]}-${M.HBM_SITES[1]} dies at a time, and a 12-high stack sees ${M.HBM_INSERTIONS[0]} to ${M.HBM_INSERTIONS[1]} test insertions as it is built, because one bad base die can take ${M.HBM_DRAM_PER_BASE} DRAM dies with it.`,
    `<strong>MEMS probe cards.</strong> Lithographically made springs replaced hand-placed tungsten needles, which is what makes cards of tens of thousands of probes at fine pitch possible, and multi-site cards test several dies per touchdown.`,
    `<strong>Test moves left and right.</strong> More testing at the wafer (hot and cold, burn-in on the wafer) and more after packaging (system-level test) both grow, because escapes are so costly at the package and rack level.`,
  ],
  sources: [
    ["FormFactor: wafer test at the heart of the AI era (2026)", "https://www.formfactor.com/blog/2026/from-commodity-to-enabler-wafer-test-at-the-heart-of-the-ai-era/"],
    ["Semiconductor Engineering: HBM shifts testing left", "https://semiengineering.com/hbm-shifts-testing-left-to-preserve-ai-chip-yield/"],
    ["Advantest: Pin Scale Multilevel Serial for V93000 EXA Scale", "https://www.advantest.com/news/2023/20231114.html"],
    ["Advantest: Pin Scale 5000B digital card", "https://www.advantest.com/news/2026/20260422.html"],
    ["Rudolph Technologies (Solid State Technology): probe card analysis and cost", "https://sst.semiconductor-digest.com/?p=35397"],
    ["Plum Five: 300 mm production prober chuck temperature options", "https://plumfive.co.jp/semicon/en/product/wafer_prober/list/index.html"],
    ["Electronic Design: probe-card metrology and overdrive", "https://www.electronicdesign.com/home/article/21200247/measurement-repeatability-key-to-probe-card-metrology"],
    ["AnandTech: TSMC N5 defect density", "https://adminnet.anandtech.com/print/16028/better-yield-on-5nm-than-7nm-tsmc-update-on-defect-rates-for-n5"],
    ["Wing VC: the chip testing bottleneck (test times, tester market)", "https://wing.vc/content/the-chip-testing-bottleneck"],
  ],
};
