// Reading text under the figure. Numbers come from model.mjs; sources are the ones the model was checked against.
import * as M from "./model.mjs";

const fmt = (n) => n.toLocaleString("en-US");

export const LESSON = {
  intro: `A finished GPU package is not useful alone. It goes onto a board, under a cold plate, into a 1U tray, and the tray goes into a rack where ${M.RACK.gpus} GPUs share one network, one coolant loop and one power bus. This chapter follows one NVIDIA GB200 NVL72 compute tray from parts on the bench to a running rack.`,
  steps: [
    `<strong>Packages onto the boards.</strong> Each tray holds ${M.TRAY.superchips} GB200 superchips. A superchip is one Grace CPU and two Blackwell GPUs on one board, so the tray carries ${M.TRAY.gpus} GPUs and ${M.TRAY.grace} CPUs. Each Blackwell GPU is ${M.GPU.dies} dies with ${M.GPU.transistorsB} billion transistors, joined at ${M.GPU.d2dTBs} TB/s.`,
    `<strong>Cold plates clamp down.</strong> Copper cold plates press onto every GPU and CPU, held by spring screws. Hoses link them to a small manifold at the back of the tray. In QCT's cooling design, about ${M.COOL.liquidShare}% of a rack's heat leaves by liquid; the drives, network cards and risers that remain are cooled by fans.`,
    `<strong>The tray closes.</strong> The lid goes on over a 1U chassis (44.45 mm tall). The front holds ${M.TRAY.cx7} ConnectX-7 network cards, ${M.TRAY.bf3} BlueField-3 DPUs and ${M.TRAY.e1s} E1.S drives in NVIDIA's DGX configuration.`,
    `<strong>It slides into the rack.</strong> Pushing the tray home makes three blind connections at once: two ${M.TRAY.uqd} quick-disconnects onto the rack's coolant manifold, a clip onto the ${M.RACK.busbarV} V DC bus bar, and the NVLink connectors into the cable cartridge. At the back, nobody plugs a hose, power lead or NVLink cable by hand; only the front network cables are plugged in.`,
    `<strong>Coolant flows.</strong> The rack manifold feeds every tray in parallel. The design allows water in at up to ${M.COOL.inletMaxC} °C and back at up to ${M.COOL.returnMaxC} °C, with up to ${M.COOL.rackLpm} litres a minute for the rack.`,
    `<strong>The NVLink spine connects.</strong> Each GPU has ${M.GPU.nvlinkPorts} NVLink ports. ${M.RACK.cartridges} cartridges of copper cables (over ${fmt(M.RACK.copperCables)}) run each port to one of ${M.RACK.switchTrays * M.RACK.switchChipsPerTray} NVSwitch chips in the ${M.RACK.switchTrays} switch trays. ${M.RACK.gpus} × ${M.GPU.nvlinkPorts} = ${fmt(M.gpuPorts)} GPU ports meet ${M.RACK.switchTrays} × ${M.RACK.switchChipsPerTray} × ${M.RACK.portsPerSwitch} = ${fmt(M.switchPorts)} switch ports, so every GPU reaches every other in one hop.`,
  ],
  numbers: [
    ["GPUs per rack", `${M.RACK.gpus}`, `${M.RACK.computeTrays} compute trays × ${M.TRAY.gpus}, plus ${M.RACK.cpus} Grace CPUs`],
    ["NVLink bandwidth", `${M.GPU.nvlinkTBs} TB/s per GPU`, `${M.RACK.nvlinkTBs} TB/s across the rack, all-to-all`],
    ["Rack power", `≈${M.RACK.kW} kW`, `${M.RACK.busbarV} V DC bus bar rated ${fmt(M.RACK.busbarA)} A; ${M.RACK.shelfKW} kW power shelves`],
    ["Heat to liquid", `≈${M.COOL.liquidShare}%`, `QCT sizes cooling for ${M.COOL.liquidKW + M.COOL.airKW} kW: ${M.COOL.liquidKW} kW liquid, ${M.COOL.airKW} kW air (above the ≈${M.RACK.kW} kW typical draw)`],
    ["Coolant", `≤${M.COOL.inletMaxC} °C in · ≤${M.COOL.returnMaxC} °C out`, `up to ${M.COOL.rackLpm} L/min a rack (QCT)`],
    ["Copper in the spine", `${fmt(M.RACK.copperCables)}+ cables`, `in ${M.RACK.cartridges} cartridges at the back of the rack`],
  ],
  innovationsTitle: "Why it is built this way",
  innovations: [
    `<strong>Copper, not optics, inside the rack.</strong> Keeping all ${M.RACK.gpus} GPUs in one rack keeps every NVLink run short enough for copper cables, with no optical transceivers and none of the power they draw. That short reach is why the rack is packed so densely.`,
    `<strong>Blind-mate liquid cooling.</strong> Air cannot move about ${M.RACK.kW} kW out of one rack. Cold plates and dripless quick-disconnects that mate as the tray slides in make liquid cooling serviceable like an air-cooled server.`,
    `<strong>A rack-wide DC bus bar.</strong> Power shelves convert AC to about 50 V DC once, and every tray clips onto the same bar, so there are no power supplies inside the trays. NVIDIA's OCP design doubles the bus bar current to ${fmt(M.RACK.busbarA)} A in the same width as ORv3.`,
    `<strong>What comes next.</strong> Later racks such as GB300 NVL72 and Vera Rubin NVL72 keep this 72-GPU layout and swap in newer packages; the Rubin package from the previous chapter goes into the same kind of tray. Links that must leave the rack are where optics, and later co-packaged optics, take over.`,
  ],
  sources: [
    ["NVIDIA DGX GB200 user guide: hardware", "https://docs.nvidia.com/dgx/dgxgb200-user-guide/hardware.html"],
    ["NVIDIA: GB200 NVL72 designs contributed to the Open Compute Project", "https://developer.nvidia.com/blog/nvidia-contributes-nvidia-gb200-nvl72-designs-to-open-compute-project/"],
    ["NVIDIA: GB200 NVL72 product page", "https://www.nvidia.com/en-us/data-center/gb200-nvl72/"],
    ["NVIDIA: GB200 NVL72 for trillion-parameter training and inference", "https://developer.nvidia.com/blog/nvidia-gb200-nvl72-delivers-trillion-parameter-llm-training-and-real-time-inference/"],
    ["NVIDIA: Blackwell architecture", "https://www.nvidia.com/en-us/data-center/technologies/blackwell-architecture/"],
    ["QCT: liquid cooling for GB200 NVL72 (white paper)", "https://blog.qct.io/wp-content/uploads/2025/04/QCT-Qoolrack-Stand-Alone_Advanced-Liquid-Cooling-for-NVIDIA-GB200-NVL72-Systems.pdf"],
  ],
};
