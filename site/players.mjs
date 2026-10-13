// Who makes and who buys each chapter's machine or material: a short, non-exhaustive list of the major players as of 2026.
// Each entry is [name, what they supply or buy]. The shell renders it as "Who makes it, who buys it" on every chapter.
const FABS = ["TSMC", "Samsung", "Intel", "SK hynix", "Micron"];
const fabs = (note) => FABS.map((n) => [n, note]);

export const PLAYERS = {
  polysilicon: {
    makers: [["Wacker Chemie", "Germany; hyperpure polysilicon"], ["Hemlock Semiconductor", "US"], ["Tokuyama", "Japan"], ["Mitsubishi Materials", "Japan"], ["OCI", "Korea"]],
    buyers: [["Shin-Etsu Handotai", "wafers"], ["SUMCO", "wafers"], ["GlobalWafers", "wafers"], ["Siltronic", "wafers"], ["SK siltron", "wafers"]],
  },
  "crystal-growth": {
    makers: [["PVA TePla", "Germany; crystal pullers"], ["Linton Crystal Technologies", "US; crystal pullers"], ["Shin-Etsu, SUMCO", "also design pullers in house"], ["Ferrotec", "quartz crucibles and parts"]],
    buyers: [["Shin-Etsu Handotai", "grows its own ingots"], ["SUMCO", ""], ["GlobalWafers", ""], ["Siltronic", ""], ["SK siltron", ""]],
  },
  wafering: {
    makers: [["Shin-Etsu Handotai", "largest wafer maker"], ["SUMCO", ""], ["GlobalWafers", ""], ["Siltronic", ""], ["SK siltron", "the five hold most of the 300 mm market"], ["Takatori, Komatsu NTC", "wire saws"]],
    buyers: fabs("prime 300 mm wafers"),
  },
  photomask: {
    makers: [["NuFlare Technology", "multi-beam and single-beam mask writers"], ["IMS Nanofabrication", "multi-beam mask writers"], ["Hoya, AGC", "EUV mask blanks"], ["Photronics, Tekscend (ex-Toppan), DNP", "merchant mask shops"]],
    buyers: [["TSMC, Intel, Samsung", "captive mask shops for leading-edge layers"], ["NVIDIA, AMD, Apple, Qualcomm", "pay for mask sets through their foundry"]],
  },
  "fab-automation": {
    makers: [["Daifuku", "overhead hoist transport"], ["Murata Machinery", "overhead hoist transport"], ["SEMES", "Samsung's in-house tools"], ["Entegris, Shin-Etsu Polymer, Miraial", "FOUPs"], ["Rorze, TDK, Brooks", "load ports and wafer handling robots"]],
    buyers: fabs("every 300 mm fab"),
  },
  deposition: {
    makers: [["Applied Materials", "CVD, PVD, ALD, epitaxy"], ["Lam Research", "CVD and ALD"], ["Tokyo Electron", "CVD, ALD, furnaces"], ["ASM International", "single-wafer ALD leader"], ["Kokusai Electric", "batch furnaces and ALD"]],
    buyers: fabs("logic and memory fabs"),
  },
  "lithography-euv": {
    makers: [["ASML", "the only EUV scanner maker"], ["Nikon, Canon", "deep-UV scanners"], ["Tokyo Electron, SCREEN", "resist coat and develop tracks"], ["ZEISS", "EUV optics, for ASML"], ["JSR, TOK, Shin-Etsu", "photoresists"]],
    buyers: [["TSMC", "largest EUV fleet"], ["Samsung", ""], ["Intel", ""], ["SK hynix, Micron", "EUV for DRAM layers"]],
  },
  etch: {
    makers: [["Lam Research", "largest etch supplier"], ["Tokyo Electron", ""], ["Applied Materials", ""], ["Hitachi High-Tech", ""]],
    buyers: fabs("high-aspect-ratio etch is heaviest in 3D NAND and DRAM"),
  },
  "ion-implant": {
    makers: [["Applied Materials", "VIISta implanters"], ["Axcelis", "Purion implanters"], ["Sumitomo Heavy Industries Ion Technology", "implanters"], ["Applied Materials, SCREEN", "anneal: spike, laser and flash"]],
    buyers: [...fabs("logic and memory fabs"), ["Wolfspeed, onsemi, Infineon", "silicon carbide power chips"]],
  },
  cmp: {
    makers: [["Applied Materials", "CMP polishers"], ["Ebara", "CMP polishers"], ["Entegris (CMC Materials), Fujifilm, Resonac", "slurries"], ["DuPont", "polishing pads"]],
    buyers: fabs("logic and memory fabs"),
  },
  interconnect: {
    makers: [["Lam Research", "copper electroplating (SABRE)"], ["Applied Materials", "barrier and seed deposition, plating"], ["MacDermid Enthone, DuPont", "plating chemistry"]],
    buyers: [["TSMC, Samsung, Intel", "15 or more metal layers on leading-edge logic"], ["SK hynix, Micron", "DRAM metal layers"]],
  },
  metrology: {
    makers: [["KLA", "largest supplier: inspection, overlay, metrology"], ["Hitachi High-Tech", "CD-SEM leader"], ["Applied Materials", "e-beam inspection and review"], ["ASML", "e-beam inspection and overlay"], ["Onto Innovation, Nova", "optical metrology"]],
    buyers: fabs("every fab, at every critical step"),
  },
  "wafer-probe": {
    makers: [["Advantest", "testers; largest for AI chips"], ["Teradyne", "testers"], ["FormFactor, Technoprobe, MJC", "probe cards"], ["Tokyo Electron, Accretech", "wafer probers"]],
    buyers: [["TSMC", "probe before CoWoS"], ["ASE, Amkor", "outsourced test (OSATs)"], ["NVIDIA, AMD", "own test programs"], ["SK hynix, Samsung, Micron", "known-good HBM dies"]],
  },
  dicing: {
    makers: [["DISCO", "dominant in grinders and dicing saws"], ["Accretech (Tokyo Seimitsu)", "grinders and saws"], ["Hamamatsu", "stealth laser dicing engines"]],
    buyers: [["TSMC", "CoWoS and SoIC lines"], ["SK hynix, Samsung, Micron", "thinning HBM dies"], ["ASE, Amkor", "OSATs"]],
  },
  "hybrid-bonding": {
    makers: [["BESI", "die-to-wafer hybrid bonders; Applied Materials holds a stake"], ["Hanmi Semiconductor", "TC bonders for HBM"], ["ASMPT", "TC and hybrid bonders"], ["Hanwha Semitech", "TC bonders"], ["EV Group, Tokyo Electron", "wafer-to-wafer bonders"]],
    buyers: [["SK hynix, Samsung, Micron", "HBM stacking"], ["TSMC", "SoIC hybrid bonding"], ["Intel", "Foveros"]],
  },
  "advanced-packaging": {
    makers: [["TSMC", "CoWoS packaging"], ["ASE (SPIL), Amkor", "OSAT partners for part of the flow"], ["Ibiden, Unimicron", "ABF substrates"], ["Ajinomoto", "ABF build-up film"], ["SK hynix, Samsung, Micron", "HBM stacks"]],
    buyers: [["NVIDIA", "largest CoWoS customer"], ["AMD", "Instinct"], ["Broadcom", "Google TPU, custom accelerators"], ["AWS", "Trainium"]],
  },
  rack: {
    makers: [["Foxconn (Hon Hai)", "largest NVL72 builder"], ["Quanta", ""], ["Wistron, Wiwynn", ""], ["Dell, Supermicro, HPE", "branded servers"], ["Vertiv, CoolIT", "liquid cooling"]],
    buyers: [["Microsoft", ""], ["Meta", ""], ["Google", ""], ["Amazon", ""], ["Oracle", ""], ["CoreWeave, xAI", "neoclouds and labs"]],
  },
  "transistor-evolution": {
    makers: [["TSMC", "N2 nanosheets"], ["Samsung", "gate-all-around since 3 nm"], ["Intel", "RibbonFET on 18A"], ["Applied Materials, Lam, Tokyo Electron", "the tools that build gate-all-around"]],
    buyers: [["Apple", "first on each new TSMC node"], ["NVIDIA, AMD", ""], ["Qualcomm, MediaTek", ""]],
  },
  "hbm-evolution": {
    makers: [["SK hynix", "HBM market leader"], ["Samsung", ""], ["Micron", ""], ["TSMC", "HBM4 logic base dies"]],
    buyers: [["NVIDIA", "largest buyer"], ["AMD", ""], ["Google, via Broadcom", "TPU"], ["AWS", "Trainium"]],
  },
  "accelerator-generations": {
    makers: [["NVIDIA", "V100 to Rubin"], ["AMD", "Instinct MI series"], ["Google with Broadcom", "TPU"], ["AWS (Annapurna Labs)", "Trainium"], ["TSMC", "fabricates and packages all of these"]],
    buyers: [["Microsoft, Meta, Google, Amazon, Oracle", "hyperscalers"], ["CoreWeave, Nebius", "neoclouds"], ["OpenAI, xAI, Anthropic", "AI labs, directly or through clouds"]],
  },
  "backside-power": {
    makers: [["Intel", "PowerVia on 18A, first in volume"], ["TSMC", "Super Power Rail on A16"], ["Samsung", "on its 2 nm roadmap"], ["EV Group, Tokyo Electron, DISCO", "wafer bonding and thinning tools"]],
    buyers: [["Intel products", "Panther Lake"], ["High-power AI and HPC chip designers", "the expected first A16 customers"]],
  },
  "high-na-euv": {
    makers: [["ASML", "EXE:5000 and EXE:5200"], ["ZEISS", "anamorphic optics"], ["TRUMPF", "CO2 drive lasers for the EUV source"]],
    buyers: [["Intel", "first to buy; planned for 14A"], ["TSMC", "R&D tools"], ["Samsung", ""], ["SK hynix", "first High-NA for memory"]],
  },
  "silicon-photonics": {
    makers: [["Broadcom", "co-packaged optics Ethernet switches"], ["NVIDIA", "Spectrum-X and Quantum-X Photonics switches"], ["TSMC", "COUPE photonic engine"], ["GlobalFoundries, Tower", "silicon photonics foundries"], ["Lumentum, Coherent", "lasers"], ["Corning", "fibre"]],
    buyers: [["Meta, Microsoft, Google", "early co-packaged optics trials"], ["AI cluster builders", "scale-out networks"]],
  },
  "glass-substrates": {
    makers: [["Intel", "glass-core research and pilot line"], ["Absolics (SKC)", "glass substrate fab in Georgia, US"], ["Samsung Electro-Mechanics, LG Innotek", "development lines"], ["Corning, AGC, Schott", "glass panels"], ["LPKF", "laser through-glass vias"]],
    buyers: [["Intel", "own products, later in the decade"], ["AI chip designers", "evaluating; no volume product yet"]],
  },
  "wafer-scale": {
    makers: [["Cerebras", "WSE-3, made by TSMC"], ["TSMC", "SoW system-on-wafer packaging"], ["Tesla", "Dojo training tile (ended 2025)"]],
    buyers: [["G42", "Cerebras' largest early customer"], ["OpenAI", "750 MW of inference capacity, 2026 to 2028"], ["US national labs, Mayo Clinic", "research"]],
  },
};
