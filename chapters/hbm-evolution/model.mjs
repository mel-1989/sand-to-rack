// The facts the figure shows. Every readout, caption number and lesson number reads from here.
// Per-stack figures: the JEDEC standard where it sets the peak, the first vendor flagship where a generation
// was defined by product (HBM2E, HBM3E). Each value carries its source.

const SRC = {
  hbm1: "https://www.kitguru.net/components/graphic-cards/anton-shilov/sk-hynix-confirms-mass-production-of-first-gen-hbm-memory/", // SK hynix volume shipments of first-gen HBM (Jun 2015), the JEDEC JESD235 (Oct 2013) part: 4-high of 2 Gb dies, 1 GB, 128 GB/s a stack; 1 Gb/s a pin = 128 x 8 / 1,024 bits; AMD Fiji carries 4 stacks
  hbm2: "https://www.jedec.org/node/5916", // JEDEC JESD235A release (Jan 2016): 1024-bit, 8 channels, up to 8 GB and 256 GB/s per stack, 2/4/8-high
  hbm2e: "https://web.archive.org/web/20200708072037/https://www.anandtech.com/show/15892/sk-hynix-hbm2e-memory-now-in-mass-production", // SK hynix HBM2E mass production (Jul 2020), AnandTech archived (the live URL died with the site): 3.6 Gb/s, 460 GB/s, 8-high 16 GB
  hbm3: "https://www.jedec.org/node/9113", // JEDEC JESD238 release (Jan 2022): 6.4 Gb/s, 819 GB/s, 16 channels, 4/8/12-high, 16 Gb layers
  hbm3e: "https://www.kedglobal.com/newsView/ked202409260013", // SK hynix 12-high HBM3E (Sep 2024): 36 GB, 9.6 Gb/s, MR-MUF
  micron3e: "https://investors.micron.com/news-releases/news-release-details/micron-commences-volume-production-industry-leading-hbm3e-solution", // Micron HBM3E: >9.2 Gb/s, >1.2 TB/s, 24 GB 8-high
  hbm4: "https://www.businesswire.com/news/home/20250416843598/en/", // JEDEC JESD270-4 release (Apr 2025): 2048-bit, up to 8 Gb/s, 2 TB/s, 32 channels; 4/8/12/16-high of 24 Gb or 32 Gb dies, up to 64 GB a stack
  hynix4s: "https://www.kedglobal.com/newsView/ked202503190006", // SK hynix 12-high HBM4 samples (Mar 2025): 36 GB, Advanced MR-MUF, TSMC logic base die; Micron also sampled 36 GB 12-high HBM4 (Jun 2025)
  hynix4: "https://www.tomshardware.com/pc-components/dram/sk-hynix-completes-development-of-hbm4-2-048-bit-interface-and-10-gt-s-speeds-promised", // SK hynix HBM4 (Sep 2025): 2048 I/O, >10 Gb/s, MR-MUF, TSMC base die
  samsung12: "https://news.samsung.com/us/samsung-12-layer-3d-tsv-chip-packaging-technology", // Samsung 12-layer 3D-TSV (Oct 2019): 720 um, >60,000 TSV holes
  samsung4e: "https://www.trendforce.com/news/2025/10/15/news-hbm4-race-heats-up-samsung-targets-13%E2%80%AFgbps-hbm4e-reportedly-revamping-strategy/", // Samsung HBM4E targets at the 2025 OCP Global Summit: over 13 Gb/s a pin, up to 3.25 TB/s, slated for 2027
  rubin: "https://developer.nvidia.com/blog/inside-the-nvidia-rubin-platform-six-new-chips-one-ai-supercomputer/", // NVIDIA Rubin: up to 288 GB of HBM4 per GPU, up to 22 TB/s aggregate
  height: "https://www.trendforce.com/news/2026/07/07/news-samsung-sk-hynix-reportedly-reconsider-hybrid-bonding-timeline-16-high-hbm4e-may-be-earliest-adoption/", // 720 um through HBM3E, 775 um for HBM4; hybrid bonding earliest at 16-high HBM4E; JEDEC discussing ~900 to 1,000 um for next-gen HBM incl. 20-high HBM5
};

// bond: how the dies join. Micro-bumps through HBM4; hybrid (Cu-Cu, no bump) expected from 16-high HBM4E (SRC.height).
// fill: what fills the bump gap, set by the vendor, not the generation: SK hynix floods it with MR-MUF (HBM2E onward,
// "Advanced MR-MUF" on HBM4, SRC.hynix4s), Samsung and Micron laminate a non-conductive film under thermo-compression (TC-NCF).
// heightUm: JEDEC package-height LIMIT where sourced (a ceiling, not the stack's measured height); null where we have no primary number (drawn illustrative).
// drawUm (HBM4E/HBM5 only): ILLUSTRATIVE drawn height, between HBM4's 775 um limit and the ~900-1,000 um
// under discussion for 20-high HBM5 (SRC.height); not a spec.
export const GENS = [
  { id: "hbm1", name: "HBM", year: 2013, std: "JESD235", busBits: 1024, pinGbps: 1.0, gbps: 128, high: 4, dieGb: 2, gb: 1, heightUm: null, bond: "micro-bumps", fill: "TC-NCF or MR-MUF", src: SRC.hbm1 },
  { id: "hbm2", name: "HBM2", year: 2016, std: "JESD235A", busBits: 1024, pinGbps: 2.0, gbps: 256, high: 8, dieGb: 8, gb: 8, heightUm: 720, bond: "micro-bumps", fill: "TC-NCF or MR-MUF", src: SRC.hbm2 },
  { id: "hbm2e", name: "HBM2E", year: 2020, std: "SK hynix", busBits: 1024, pinGbps: 3.6, gbps: 460, high: 8, dieGb: 16, gb: 16, heightUm: 720, bond: "micro-bumps", fill: "MR-MUF", src: SRC.hbm2e },
  { id: "hbm3", name: "HBM3", year: 2022, std: "JESD238", busBits: 1024, pinGbps: 6.4, gbps: 819, high: 12, dieGb: 16, gb: 24, heightUm: 720, bond: "micro-bumps", fill: "TC-NCF or MR-MUF", src: SRC.hbm3 },
  { id: "hbm3e", name: "HBM3E", year: 2024, std: "SK hynix", busBits: 1024, pinGbps: 9.6, gbps: null, high: 12, dieGb: 24, gb: 36, heightUm: 720, bond: "micro-bumps", fill: "MR-MUF", src: SRC.hbm3e },
  { id: "hbm4", name: "HBM4", year: 2025, std: "JESD270-4", busBits: 2048, pinGbps: 8.0, gbps: 2048, high: 12, dieGb: 24, gb: 36, heightUm: 775, bond: "micro-bumps", fill: "Advanced MR-MUF", base: "logic", src: SRC.hbm4, srcStack: SRC.hynix4s }, // bus, pin rate, bandwidth, height: JEDEC (SRC.hbm4); 12-high, 24 Gb, 36 GB: the SK hynix stack (SRC.hynix4s)
  { id: "hbm4e", name: "HBM4E / HBM5", year: null, std: "expected", busBits: 2048, pinGbps: null, gbps: null, high: 16, dieGb: null, gb: null, heightUm: null, drawUm: 800, bond: "hybrid", future: true, src: SRC.height },
];

// HBM3E bandwidth is derived from its pin speed (Micron and SK hynix both quote "over 1.2 TB/s").
for (const g of GENS) if (g.gbps === null && g.pinGbps) g.gbps = Math.round((g.busBits * g.pinGbps) / 8);
// a check: every JEDEC peak equals bus x pin / 8 (HBM3: 1024 x 6.4 / 8 = 819.2)
for (const g of GENS) if (g.pinGbps && Math.abs(g.gbps - (g.busBits * g.pinGbps) / 8) > 1) throw new Error(`bandwidth mismatch ${g.name}`);

export const HYNIX_HBM4_PIN = 10; // Gb/s, "over 10 Gbps" (SRC.hynix4)
export const TSV_HOLES_12H = 60000; // more than, Samsung 12-layer 3D-TSV (SRC.samsung12)
export const HEIGHT_12H_UM = 720; // SRC.samsung12, SRC.height
export const HEIGHT_HBM4_UM = 775; // SRC.height
export const HBM4_MAX_HIGH = 16; // JEDEC JESD270-4 allows up to 16-high (SRC.hbm4)
export const HBM4_MAX_GB = 64; // JEDEC: 16-high of 32 Gb dies (SRC.hbm4)
export const HBM3E_8H_GB = 24; // Micron 8-high HBM3E (SRC.micron3e)
export const FIJI_STACKS = 4; // AMD Radeon R9 Fury X: 4 x HBM, 4 GB, 512 GB/s (SRC.hbm1)
// HBM4E vendor targets, quoted as Samsung gave them (not derived from each other, so kept out of GENS' bandwidth check)
export const SAMSUNG_HBM4E = { pinGbps: 13, tbs: 3.25, year: 2027 }; // ">13 Gb/s", "3.25 TB/s" (SRC.samsung4e)
export const HBM5_HEIGHT_UM = [900, 1000]; // under discussion at JEDEC for next-gen HBM incl. 20-high HBM5 (SRC.height)
// Rubin, two chapters earlier: 288 GB and 22 TB/s per GPU (SRC.rubin); at 36 GB a 12-high HBM4 stack (SRC.hynix4s) that is 8 stacks
export const RUBIN = { gb: 288, tbs: 22 };
export const SOURCES = SRC;

export const first = GENS[0];
export const hbm4 = GENS[5];
export const growth = Math.round(hbm4.gbps / first.gbps); // 16x per stack, HBM to HBM4 (JEDEC peaks)
export const rubinStacks = Math.round(RUBIN.gb / hbm4.gb); // 8
export const rubinPerStack = RUBIN.tbs / rubinStacks; // 2.75 TB/s
export const rubinPin = (rubinPerStack * 1000 * 8) / hbm4.busBits; // ≈10.7 Gb/s
export const capGrowth = Math.round(hbm4.gb / first.gb); // 36x

const fmt = (value, digits = 0) => value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
// decimal TB/s, as the other chapters use (2,048 GB/s = 2.05, shown "2 TB/s" as JEDEC rounds it; 1,229 GB/s = "1.2 TB/s")
export const bw = (g) => (g.gbps >= 1000 ? `${(g.gbps / 1000).toFixed(1).replace(/\.0$/, "")} TB/s` : `${g.gbps} GB/s`);
export const bwShort = (g) => (g.gbps ? bw(g) : "—");

// the short readout under the card
export function shortOf(g) {
  if (g.future) return `${g.name} · ${g.high}-high · hybrid · Samsung target >${SAMSUNG_HBM4E.pinGbps} Gb/s, ≈${SAMSUNG_HBM4E.tbs} TB/s`;
  const height = g.heightUm ? ` · ≤${g.heightUm} µm` : "";
  return `${g.name} · ${g.busBits.toLocaleString("en-US")}-bit · ${g.high}-high${height} · ${g.gb} GB · ${bw(g)} · ${fmt(g.pinGbps, 1)} Gb/s/pin`;
}

export function sayOf(g) {
  if (g.future) return `${g.name} · expected · ${g.high}-high · hybrid bonds, no bumps · ${g.busBits.toLocaleString("en-US")}-bit · vendor targets only: Samsung HBM4E over ${SAMSUNG_HBM4E.pinGbps} Gb/s a pin, about ${SAMSUNG_HBM4E.tbs} TB/s a stack (${SAMSUNG_HBM4E.year}); JEDEC is discussing a ${HBM5_HEIGHT_UM[0]} to ${HBM5_HEIGHT_UM[1].toLocaleString("en-US")} µm height limit for 20-high HBM5`;
  if (g.id === "hbm4") return `${g.name} · ${g.year} · ${g.busBits.toLocaleString("en-US")}-bit · ${g.high}-high · height limit ${g.heightUm} µm · ${g.gb} GB (SK hynix; JEDEC allows up to ${HBM4_MAX_HIGH}-high, ${HBM4_MAX_GB} GB) · ${bw(g)} · ${fmt(g.pinGbps, 1)} Gb/s a pin · in Rubin, ${rubinStacks} stacks give ${RUBIN.tbs} TB/s, about ${rubinPerStack} TB/s each`;
  const height = g.heightUm ? ` · height limit ${g.heightUm} µm` : "";
  return `${g.name} · ${g.year} · ${g.busBits.toLocaleString("en-US")}-bit · ${g.high}-high${height} · ${g.gb} GB · ${bw(g)} · ${fmt(g.pinGbps, 1)} Gb/s a pin`;
}

export const IDLE = `${GENS.length} generations · ${bw(first)} → ${bw(hbm4)} a stack`;
