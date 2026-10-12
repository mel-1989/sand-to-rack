// The facts the figure and lesson show. Every number carries its source; illustrative values say so.

// FOUP: front-opening unified pod for 300 mm wafers.
export const FOUP = {
  wafers: 25, // slots per FOUP; SEMI E47.1, https://en.wikipedia.org/wiki/FOUP
  waferMm: 300, // wafer diameter; SEMI E47.1 (title: "FOUPs used to transport and store 300 mm wafers"), https://store-us.semi.org/products/e04701-semi-e47-1-mechanical-specification-for-foups-used-to-transport-and-store-300-mm-wafers
  pitchMm: 10, // slot pitch for 25-slot 300 mm FOUPs; https://en.wikipedia.org/wiki/FOUP
  massKg: [7, 9], // fully loaded; https://en.wikipedia.org/wiki/FOUP
  lot: 25, // a lot is typically 25 wafers; https://semiengineering.com/battling-fab-cycle-times
};

// Load port, per SEMI E15.1 as cited in US patents (the standard itself is sold by SEMI).
export const LOAD_PORT = {
  datumMm: 900, // horizontal datum plane above the fab floor; US 9,834,378, https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/9834378
  accessMm: [44, 284], // band above the datum in which a robot reaches every wafer; same patent
  widthMm: 505, // minimum load port pitch under SEMI E15.1 (also the width of the SEMI E63 BOLTS interface plate); US 7,648,327, https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/7648327
  heightMm: 1386, // height of the SEMI E63 (BOLTS) interface plate above the floor, not an E15.1 figure; same patent
};

// Automated material handling (AMHS) and the overhead hoist transport (OHT).
export const AMHS = {
  asOf: 2017, // the rail and vehicle figures are Daifuku's claim as quoted in Feb 2017; today's largest fabs may differ
  railKm: 10, // "The OHT travel rail can extend up to 10 kilometers"; https://semiengineering.com/battling-fab-cycle-times
  vehicles: "several hundred", // "with up to several hundred cars in large fabs"; same article
  // SEMI E84 defines the parallel I/O hand-off between a transport vehicle (AGV, RGV, OHT) and a tool or stocker port; https://store-us.semi.org/products/e08400-semi-e84-specification-for-enhanced-carrier-handoff-parallel-i-o-interface
  // OHT systems carry these signals over optical (infrared) transceivers; e.g. Hokuyo DMS series, https://plantautomation-technology.com/products/hokuyo-automatic-usa-corporation/dms-series-semi-e84
  handoffStd: "SEMI E84",
  kmPerDay: 100, // one OHT vehicle travels "approximately 100 kilometers per day"; https://news.samsungsemiconductor.com/global/the-invisible-highways-tracing-the-journey-inside-a-semiconductor-fab/
};

// How long a wafer spends in the fab, and how many steps it sees.
export const FLOW = {
  cycleWeeksAvg: 12, // SIA: about 12 weeks on average; https://www.semiconductors.org/chipmakers-are-ramping-up-production-to-address-semiconductor-shortage-heres-why-that-takes-time/
  cycleWeeksAdvanced: [14, 20], // SIA: up to 14-20 weeks for advanced processes; same page
  stepsMax: 1400, // SIA: "up to 1,400 process steps"; same page
  stepsLogic: [600, 1000], // "an advanced logic process could have from 600 to 1,000 steps or more"; SemiEngineering, above
  maskLayers7nm: [80, 85], // 7 nm: 80 to 85 mask layers; SemiEngineering, above
  daysPerLayer: [1, 1.5], // "a fab takes 1 to 1.5 days to process a layer"; SemiEngineering, above
};

// Cleanliness: the bay versus the minienvironment around the wafer.
export const CLEAN = {
  bayIso: 5, // tools stand in ISO 5 rooms; https://chemanager-online.com/de/themen/minienvironments-fuer-die-halbleiterproduktion-und-nano-technologie
  miniIso: [3, 1], // the tool's minienvironment holds ISO 3, or even down to ISO 1; same article
  miniText: "ISO 3, down to ISO 1", // reads the pair above in plain words
  // ISO 14644-1 class limits for particles >= 0.1 um per cubic metre: C = 10^N (0.1/D)^2.08, https://en.wikipedia.org/wiki/Cleanroom
  perM3: (iso) => Math.round(10 ** iso),
};
export const iso5PerM3 = CLEAN.perM3(CLEAN.bayIso); // 100,000
export const iso1PerM3 = CLEAN.perM3(1); // 10

// Drawing scale: one world unit is 10 mm. Sizes not listed above are illustrative.
export const UNIT_MM = 10;
export const U = (mm) => mm / UNIT_MM;
export const WAFER_R = U(FOUP.waferMm / 2); // 15
export const PITCH = U(FOUP.pitchMm); // 1
export const DATUM = U(LOAD_PORT.datumMm); // 90
export const SLOT0 = DATUM + U(LOAD_PORT.accessMm[0]); // first slot, 94.4
export const SLOT_TOP = DATUM + U(LOAD_PORT.accessMm[1]); // 25th slot, 118.4
export const PORT_W = U(LOAD_PORT.widthMm); // 50.5
export const PORT_H = U(LOAD_PORT.heightMm); // 138.6
export const HOIST_DROP = 110; // illustrative: rail height above the port is fab-specific
export const PICK_SLOT = 13; // the wafer the robot takes, counted from the bottom

const fmt = (n) => n.toLocaleString("en-US");

// Leading-edge cycle time in months, from SIA's 14-20 weeks for advanced processes (weeks to months at 7/30.44).
const months = (weeks) => (weeks * 7) / 30.44;
export const CYCLE_MONTHS = [Math.floor(months(FLOW.cycleWeeksAdvanced[0])), Math.floor(months(FLOW.cycleWeeksAdvanced[1]))]; // [3, 4]: 3.2 to 4.6 months
export const CYCLE_TEXT = `≈${CYCLE_MONTHS[0]}–${CYCLE_MONTHS[1]}+ months`;

// The wafer's trip, in order. Every step names what the machine does; the live script reads this list.
// Readouts stay short (about 70 characters) so they fit one line at 900 px and two at 390 px.
export const STEPS = [
  { id: "stocker", name: "At the stocker", say: `hoist picks the FOUP off the stocker port · ${FOUP.wafers} wafers on board`, sec: 3.2 },
  { id: "travel", name: "OHT travels", say: `OHT runs the ceiling rail · ≈${AMHS.kmPerDay} km a day per vehicle`, sec: 3.6 },
  { id: "lower", name: "Hoist lowers", say: "hoist belts lower the FOUP onto the load port", sec: 3.2 },
  { id: "release", name: "Gripper lets go", say: `FOUP on the kinematic pins · datum ${fmt(LOAD_PORT.datumMm)} mm above the floor`, sec: 1.8 },
  { id: "door", name: "Door opens", say: "port docks the FOUP, unlatches its door, lowers it into the EFEM", sec: 3.4 },
  { id: "pick", name: "Robot takes a wafer", say: `robot reaches slot ${PICK_SLOT} of ${FOUP.wafers} · ${FOUP.pitchMm} mm slot pitch`, sec: 4.2 },
  { id: "into", name: "Into the tool", say: "through the slit valve into the tool's load lock", sec: 3.4 },
  { id: "process", name: "Tool processes it", say: `slit valve shut · one of ${FLOW.stepsLogic[0]}–${fmt(FLOW.stepsLogic[1])}+ steps for this wafer`, sec: 2.8 },
  { id: "back", name: "Back to the FOUP", say: `wafer back in slot ${PICK_SLOT} · the FOUP never opens to room air`, sec: 5.2 },
  { id: "leave", name: "FOUP leaves", say: "FOUP lifted to the next tool · this was one visit of hundreds", sec: 5.2 },
];

export const PARTS = {
  stocker: { name: "Stocker", say: "shelves of FOUPs that buffer lots between tools until an OHT collects them" },
  oht: { name: "OHT vehicle", say: `rides the ceiling rail · Daifuku, ${AMHS.asOf}: up to ${AMHS.railKm} km of rail, ${AMHS.vehicles} vehicles` },
  foup: { name: "FOUP", say: `${FOUP.wafers} × ${FOUP.waferMm} mm wafers · ${FOUP.pitchMm} mm pitch · ${FOUP.massKg[0]}–${FOUP.massKg[1]} kg loaded` },
  port: { name: "Load port", say: `SEMI E15.1 · datum ${fmt(LOAD_PORT.datumMm)} mm · ${LOAD_PORT.widthMm} mm port pitch (E15.1 minimum)` },
  robot: { name: "EFEM robot", say: `${CLEAN.miniText} minienvironment under its own filter unit` },
  tool: { name: "Process tool", say: `visited hundreds of times · ${FLOW.stepsLogic[0]}–${fmt(FLOW.stepsLogic[1])}+ steps per wafer` },
  bay: { name: "Cleanroom bay", say: `ISO ${CLEAN.bayIso} air · ≤${fmt(iso5PerM3)} particles ≥0.1 µm/m³ · out through the floor` },
};

export const IDLE = `lot of ${FOUP.lot} · ${CYCLE_TEXT} in the fab`;
