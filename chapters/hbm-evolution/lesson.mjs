// Reading text under the figure. Numbers come from model.mjs; sources are the ones the model was checked against.
import * as M from "./model.mjs";

const g = (id) => M.GENS.find((x) => x.id === id);
const n = (v) => v.toLocaleString("en-US");

export const LESSON = {
  intro: `An AI accelerator spends much of its time waiting for memory, so the memory sits right beside it as stacks of DRAM dies joined by vertical wires. Each generation of this high-bandwidth memory (HBM) has stacked more dies, run each pin faster and, with HBM4, doubled the number of pins. At the bottom of every stack sits a base die that holds the interface circuits driving the 1,024 (in HBM4, 2,048) wires to the processor across the silicon interposer. Press Play to send the height gauge along the bench, one generation at a time.`,
  steps: [
    `<strong>HBM (${g("hbm1").year}).</strong> JEDEC's first standard stacks ${g("hbm1").high} DRAM dies on a base die and gives each stack a ${n(g("hbm1").busBits)}-bit interface at ${g("hbm1").pinGbps} Gb/s a pin: ${g("hbm1").gbps} GB/s and ${g("hbm1").gb} GB. AMD's Fury X carried ${M.FIJI_STACKS} of them in 2015.`,
    `<strong>HBM2 (${g("hbm2").year}).</strong> JEDEC's second standard allows eight-high stacks and doubles the pin rate to ${g("hbm2").pinGbps} Gb/s: ${g("hbm2").gbps} GB/s and ${g("hbm2").gb} GB a stack, from eight ${g("hbm2").dieGb} Gb dies.`,
    `<strong>HBM2E (${g("hbm2e").year}).</strong> Still eight dies on the same 1,024-bit interface, but each die doubles to ${g("hbm2e").dieGb} Gb and the pins run at ${g("hbm2e").pinGbps} Gb/s: ${g("hbm2e").gbps} GB/s and ${g("hbm2e").gb} GB a stack in SK hynix's part.`,
    `<strong>HBM3 (${g("hbm3").year}).</strong> The pin rate nearly doubles to ${g("hbm3").pinGbps} Gb/s (${g("hbm3").gbps} GB/s a stack), the channels go from 8 to 16, and stacks reach ${g("hbm3").high} dies. Twelve dies fit in the same ${M.HEIGHT_12H_UM} µm as eight because each die is ground thinner.`,
    `<strong>HBM3E (${g("hbm3e").year}).</strong> ${g("hbm3e").pinGbps} Gb/s a pin, about ${M.bw(g("hbm3e"))} a stack, and ${g("hbm3e").gb} GB in a 12-high stack of ${g("hbm3e").dieGb} Gb dies. Eight-high stacks of the same dies hold ${M.HBM3E_8H_GB} GB (Micron).`,
    `<strong>HBM4 (${g("hbm4").year}).</strong> The interface doubles to ${n(g("hbm4").busBits)} bits for the first time since HBM began, so ${g("hbm4").pinGbps} Gb/s a pin gives ${M.bw(g("hbm4"))} a stack. The base die becomes a logic die made in a foundry, and the height limit rises to ${M.HEIGHT_HBM4_UM} µm. The first 12-high stacks hold ${g("hbm4").gb} GB (SK hynix, Micron); the standard allows up to ${M.HBM4_MAX_HIGH}-high and ${M.HBM4_MAX_GB} GB.`,
    `<strong>Next: HBM4E and HBM5.</strong> 16 and then 20 dies are expected. At 16 dies (HBM4E) and above, hybrid bonding is expected to begin replacing micro-bumps; makers have so far stayed with thermo-compression and MR-MUF. In hybrid bonding, copper pads on facing dies fuse directly with no bump and no gap.`,
  ],
  numbers: [
    ["Bandwidth per stack", `${M.bw(g("hbm1"))} → ${M.bw(g("hbm4"))}`, `HBM (${g("hbm1").year}) to HBM4 (${g("hbm4").year}), JEDEC peaks: ${M.growth}×`],
    ["Pin speed", `${g("hbm1").pinGbps} → ${g("hbm3e").pinGbps} Gb/s`, `HBM to HBM3E; SK hynix HBM4 runs over ${M.HYNIX_HBM4_PIN} Gb/s against the ${g("hbm4").pinGbps} Gb/s JEDEC rate`],
    ["Interface width", `${n(1024)} → ${n(2048)} bits`, "unchanged from HBM to HBM3E, doubled in HBM4"],
    ["Capacity per stack", `${g("hbm1").gb} → ${g("hbm4").gb} GB`, `${g("hbm1").high}-high with ${g("hbm1").dieGb} Gb dies to a 12-high HBM4 of ${g("hbm4").dieGb} Gb dies: ${M.capGrowth}×; JEDEC HBM4 allows up to ${M.HBM4_MAX_GB} GB`],
    ["Stack height limit", `${M.HEIGHT_12H_UM} µm → ${M.HEIGHT_HBM4_UM} µm`, "JEDEC, HBM2 to HBM3E, then HBM4 (12- and 16-high)"],
    ["Through-silicon vias", `over ${n(M.TSV_HOLES_12H)}`, "in Samsung's first 12-die stack (2019)"],
  ],
  innovationsTitle: "Key innovations",
  innovations: [
    "<strong>Through-silicon vias.</strong> Copper-filled holes run straight through each thinned die, so every die in the stack reaches the base die over thousands of short vertical wires instead of long bond wires.",
    "<strong>Thinner dies, same height.</strong> Grinding each DRAM die thinner is what lets 8, then 12, then 16 dies fit under one height limit, so a stack sits level with the compute die beside it under one cold plate.",
    "<strong>Gap fill.</strong> SK hynix's mass reflow molded underfill (MR-MUF) floods the gaps between all dies at once; Samsung and Micron laminate a film between dies and bond each one under heat and pressure. Both remove heat and keep thin dies from warping.",
    "<strong>A logic base die.</strong> In HBM4 the bottom die is built on a foundry logic process (SK hynix uses TSMC), with faster, smaller transistors that drive twice as many pins at lower power.",
    "<strong>Hybrid bonding next.</strong> Bonding copper pad to copper pad with no bump removes the gap between dies, which saves height for 16 to 20 dies and shortens the path heat must cross.",
  ],
  sources: [
    ["KitGuru: SK hynix ships first-generation HBM, JESD235 (2015)", M.SOURCES.hbm1],
    ["AnandTech: SK hynix HBM2E in mass production, 3.6 Gb/s (2020)", M.SOURCES.hbm2e],
    ["JEDEC: HBM2 update to the HBM standard, JESD235A (2016)", M.SOURCES.hbm2],
    ["JEDEC: HBM3 standard, JESD238 (2022)", M.SOURCES.hbm3],
    ["JEDEC: HBM4 standard, JESD270-4 (2025), via Business Wire", M.SOURCES.hbm4],
    ["Samsung: 12-layer 3D-TSV packaging, 720 µm, 60,000 TSVs (2019)", M.SOURCES.samsung12],
    ["SK hynix 12-high HBM4 samples, 36 GB, via KED Global (2025)", M.SOURCES.hynix4s],
    ["SK hynix 12-high HBM3E, 36 GB at 9.6 Gb/s, via KED Global (2024)", M.SOURCES.hbm3e],
    ["Micron: HBM3E volume production, over 1.2 TB/s (2024)", M.SOURCES.micron3e],
    ["TrendForce: HBM height limits and the hybrid-bonding timeline (2026)", M.SOURCES.height],
  ],
};
