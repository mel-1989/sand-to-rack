// The course, in order. Every chapter page, the index and the prev/next links read this list.
export const PARTS = [
  { id: "materials", n: "I", title: "Materials", blurb: "From quartz sand to a mirror-polished, near-perfect single-crystal wafer." },
  { id: "masks", n: "II", title: "Design and masks", blurb: "A finished design becomes a set of glass-and-chrome stencils." },
  { id: "front", n: "III", title: "Front end: the wafer fab", blurb: "Hundreds of steps of deposit, pattern, etch, dope and polish build billions of transistors and their wiring." },
  { id: "back", n: "IV", title: "Back end: test, cut, bond, package", blurb: "Good dies are found, cut free, stacked and packaged, then built into systems." },
  { id: "generations", n: "V", title: "Generations and key innovations", blurb: "How the transistor, the memory and the accelerator package changed, generation by generation." },
  { id: "frontier", n: "VI", title: "Frontier", blurb: "Deep-tech bets where the next gains are expected to come from." },
];

export const CHAPTERS = [
  { slug: "polysilicon", part: "materials", title: "Sand to polysilicon", machine: "Siemens CVD reactor" },
  { slug: "crystal-growth", part: "materials", title: "Growing the crystal", machine: "Czochralski crystal puller" },
  { slug: "wafering", part: "materials", title: "Slicing and polishing wafers", machine: "Multi-wire saw" },
  { slug: "photomask", part: "masks", title: "Writing the photomask", machine: "Multi-beam mask writer" },
  { slug: "fab-automation", part: "front", title: "Inside the fab", machine: "FOUP, overhead hoist transport and load port" },
  { slug: "deposition", part: "front", title: "Deposition: ALD and CVD", machine: "Cluster tool with ALD chambers" },
  { slug: "lithography-euv", part: "front", title: "EUV lithography", machine: "EUV scanner" },
  { slug: "etch", part: "front", title: "Plasma etch", machine: "Inductively coupled plasma etch chamber" },
  { slug: "ion-implant", part: "front", title: "Ion implantation", machine: "Ion implanter" },
  { slug: "cmp", part: "front", title: "Chemical mechanical polishing", machine: "CMP polisher" },
  { slug: "interconnect", part: "front", title: "Copper interconnect", machine: "Electroplating cell and the metal stack" },
  { slug: "metrology", part: "front", title: "Metrology and inspection", machine: "CD-SEM" },
  { slug: "wafer-probe", part: "back", title: "Wafer probe test", machine: "Wafer prober and probe card" },
  { slug: "dicing", part: "back", title: "Dicing", machine: "Dicing saw" },
  { slug: "hybrid-bonding", part: "back", title: "Die bonding: bumps to hybrid bonds", machine: "Die-to-wafer bonder" },
  { slug: "advanced-packaging", part: "back", title: "2.5D packaging: the Rubin package", machine: "CoWoS-L package on a test socket" },
  { slug: "rack", part: "back", title: "From package to rack", machine: "Liquid-cooled compute tray" },
  { slug: "transistor-evolution", part: "generations", title: "The transistor, generation by generation", machine: "Planar, FinFET, nanosheet and CFET transistors" },
  { slug: "hbm-evolution", part: "generations", title: "Stacked memory: HBM1 to HBM4", machine: "HBM stacks through the generations" },
  { slug: "accelerator-generations", part: "generations", title: "Accelerator packages, V100 to Rubin", machine: "Five GPU packages side by side" },
  { slug: "backside-power", part: "generations", title: "Backside power delivery", machine: "Front-side vs backside power cutaway" },
  { slug: "high-na-euv", part: "frontier", title: "High-NA EUV", machine: "Anamorphic 0.55 NA projection optics" },
  { slug: "silicon-photonics", part: "frontier", title: "Co-packaged optics", machine: "Switch package with optical engines and fibre" },
  { slug: "glass-substrates", part: "frontier", title: "Glass-core substrates", machine: "Glass core panel with through-glass vias" },
  { slug: "wafer-scale", part: "frontier", title: "Wafer-scale and 3D compute", machine: "Wafer-scale engine with its cooling stack" },
];

export const partOf = (id) => PARTS.find((p) => p.id === id);
export const indexOf = (slug) => CHAPTERS.findIndex((c) => c.slug === slug);
