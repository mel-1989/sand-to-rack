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
  widthMm: 505, // width of one port; US 7,648,327, https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/7648327
  heightMm: 1386, // top of the port above the floor; same patent
};

// Automated material handling (AMHS) and the overhead hoist transport (OHT).
export const AMHS = {
  railKm: 10, // "The OHT travel rail can extend up to 10 kilometers"; https://semiengineering.com/battling-fab-cycle-times
  vehicles: "several hundred", // "with up to several hundred cars in large fabs"; same article
  kmPerDay: 100, // one OHT vehicle travels "approximately 100 kilometers per day"; https://news.samsungsemiconductor.com/global/the-invisible-highways-tracing-the-journey-inside-a-semiconductor-fab/
};

// How long a wafer spends in the fab, and how many steps it sees.
export const FLOW = {
  cycleMonths: 3, // "the total cycle time is 3 months, according to KLA-Tencor"; https://semiengineering.com/battling-fab-cycle-times
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
  miniIso: [3, 1], // the tool's minienvironment holds ISO 3, up to ISO 1; same article
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
export const HOIST_DROP = 109; // illustrative: rail height above the port is fab-specific
export const PICK_SLOT = 13; // the wafer the robot takes, counted from the bottom

const fmt = (n) => n.toLocaleString("en-US");

// The wafer's trip, in order. Every step names what the machine does; the live script reads this list.
export const STEPS = [
  { id: "stocker", name: "At the stocker", say: "FOUP picked from the stocker port · 25 wafers on board", sec: 1.6 },
  { id: "travel", name: "OHT travels", say: `OHT drives along the ceiling rail · one vehicle covers ≈${AMHS.kmPerDay} km a day`, sec: 3.6 },
  { id: "lower", name: "Hoist lowers", say: "hoist belts lower the FOUP onto the load port", sec: 3.2 },
  { id: "release", name: "Gripper lets go", say: `FOUP sits on the kinematic pins · datum ${fmt(LOAD_PORT.datumMm)} mm above the floor`, sec: 1.8 },
  { id: "door", name: "Door opens", say: "load port unlatches the door and lowers it into the EFEM", sec: 2.6 },
  { id: "pick", name: "Robot takes a wafer", say: `robot reaches slot ${PICK_SLOT} of ${FOUP.wafers} · ${FOUP.pitchMm} mm slot pitch`, sec: 4.2 },
  { id: "into", name: "Into the tool", say: "through the slit valve onto the tool's load lock", sec: 3.4 },
  { id: "process", name: "Tool processes it", say: `slit valve shut · one of ${FLOW.stepsLogic[0]}–${fmt(FLOW.stepsLogic[1])}+ steps for this wafer`, sec: 2.8 },
  { id: "back", name: "Back to the FOUP", say: `wafer returns to slot ${PICK_SLOT} · the FOUP stays sealed outside the tool`, sec: 5.2 },
  { id: "leave", name: "FOUP leaves", say: "door shut, FOUP lifted, off to the next tool", sec: 4.6 },
];

export const PARTS = {
  oht: { name: "OHT vehicle", say: `rides a ceiling rail · up to ${AMHS.railKm} km of rail, ${AMHS.vehicles} vehicles in a large fab` },
  foup: { name: "FOUP", say: `${FOUP.wafers} × ${FOUP.waferMm} mm wafers at ${FOUP.pitchMm} mm pitch · ${FOUP.massKg[0]}–${FOUP.massKg[1]} kg loaded` },
  port: { name: "Load port", say: `SEMI E15.1 · datum ${fmt(LOAD_PORT.datumMm)} mm · ${LOAD_PORT.widthMm} mm wide` },
  robot: { name: "EFEM robot", say: `works in an ISO ${CLEAN.miniIso[0]}–${CLEAN.miniIso[1]} minienvironment under its own filter unit` },
  tool: { name: "Process tool", say: `a wafer visits tools like this hundreds of times · ${FLOW.stepsLogic[0]}–${fmt(FLOW.stepsLogic[1])}+ steps` },
  bay: { name: "Cleanroom bay", say: `ISO ${CLEAN.bayIso} air (≤${fmt(iso5PerM3)} particles ≥0.1 µm per m³) from ceiling filter units, out through the raised floor` },
};

export const IDLE = `lot of ${FOUP.lot} · ≈${FLOW.cycleMonths} months in the fab`;
