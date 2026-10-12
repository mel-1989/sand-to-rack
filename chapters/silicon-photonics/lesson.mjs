// Reading text under the figure. Numbers come from model.mjs; sources are the ones the model was checked against.
import * as M from "./model.mjs";

const f = M.fmt;

export const LESSON = {
  intro: `A big AI cluster is held together by switches, and a large share of their power goes into moving bits from the switch chip to the optics at the front of the box. Co-packaged optics moves the optics onto the chip's own package, so a bit turns into light a few millimetres from where it was made instead of after a long trip across a circuit board.`,
  steps: [
    `<strong>The bit leaves the switch chip.</strong> A SerDes on the ASIC sends it as a ${M.QX.laneGbps} Gb/s PAM4 electrical signal, four voltage levels carrying two bits a symbol, across a few millimetres of package wiring to the electronic chip of an optical engine.`,
    `<strong>Laser light comes in.</strong> The light itself is made off the package, in external laser source modules at the board edge (${M.ELS.lasers} lasers each, NVIDIA's design). Steady, unmodulated light reaches the engine through its own fibres. Keeping the lasers out of the hot package makes them easier to cool and to replace.`,
    `<strong>A micro-ring writes the bit onto the light.</strong> On the photonic chip the light runs along a silicon waveguide past a ring a few tens of micrometres across. The driver pushes charge in and out of the ring, shifting its resonance; when the ring is in tune it pulls light out of the waveguide, when it is out of tune the light passes. Four drive levels give four light levels: PAM4 in light.`,
    `<strong>Out on the fibre.</strong> A glass fibre attach block couples the waveguide into single-mode fibre. At ${M.QX.laneGbps} Gb/s a lane, copper cable reaches about ${M.REACH.copperM} m; single-mode fibre reaches ${M.REACH.smfM} m to ${f(M.REACH.smfLongM / 1000)} km (IEEE 802.3dj).`,
    `<strong>A photodiode turns it back.</strong> At the far end, here the same package through a loopback fibre, light falls on a photodiode (typically germanium) on another engine's photonic chip and becomes a small current.`,
    `<strong>Back to electrical.</strong> A transimpedance amplifier on the electronic chip turns that current into a voltage, and the switch's receiving SerDes recovers the bit.`,
    `<strong>Compare a pluggable.</strong> In a switch with pluggable transceivers the same bit first crosses the board to a module in the front panel, where a DSP cleans it up and an externally modulated laser writes it onto light. NVIDIA's GTC 2025 example, for a 1.6 Tb/s port on its Spectrum-X Photonics switch, put that at ${M.POWER.pluggableW} W and ${M.POWER.pluggableLossDb} dB of electrical loss, against ${M.POWER.cpoW} W and ${M.POWER.cpoLossDb} dB co-packaged. The figure uses those numbers as representative.`,
  ],
  numbers: [
    ["Per optical engine", `${M.QX.engineTbps} Tb/s each way`, `${M.QX.lanesPerEngine} × ${M.QX.laneGbps} Gb/s PAM4; ${M.QX.txFibres} TX, ${M.QX.rxFibres} RX and ${M.QX.laserFibres} laser fibres`],
    ["Per switch ASIC (Quantum-X Photonics)", `${M.QX.asicTbps} Tb/s`, `${M.QX.osas} sub-assemblies × ${M.QX.enginesPerOsa} engines; the Q3450 has ${M.QX.systemAsics} ASICs and ${M.QX.systemPorts} ports of ${M.QX.portGbps}G`],
    ["Power per 1.6 Tb/s port", `${M.POWER.cpoW} W vs ${M.POWER.pluggableW} W`, `CPO (${M.POWER.cpoLaserW} W laser + ${M.POWER.cpoEngineW} W engine) vs pluggable (${M.POWER.pluggableDspW} W DSP + ${M.POWER.pluggableLaserW} W laser), NVIDIA's GTC 2025 Spectrum-X Photonics example; the per-port figures give ${f(M.powerX, 1)}×, NVIDIA's headline claim is ${M.POWER.claimX}×`],
    ["Energy per bit", `${f(M.pjCpo, 1)} vs ${f(M.pjPluggable, 1)} pJ/bit`, "derived: watts divided by 1.6 Tb/s"],
    ["Electrical loss on a 200G lane", `${M.POWER.cpoLossDb} dB vs ${M.POWER.pluggableLossDb} dB`, `${M.lossGap} dB less is about ${Math.round(M.lossRatio)}× the signal, NVIDIA's "${M.POWER.signalX}× signal integrity"`],
    ["One research micro-ring", `${M.RING.radiusUm} µm radius · ${M.RING.fJperBit} fJ/bit`, `${M.RING.gbps} Gb/s PAM4 at ${M.RING.wavelengthNm} nm (Nature Communications, 2024); the modulator alone, not the whole link`],
  ],
  innovationsTitle: "Why it matters",
  innovations: [
    `Network power grows with every GPU added. Cutting a port from ${M.POWER.pluggableW} W to ${M.POWER.cpoW} W frees power for compute, and NVIDIA also counts ${M.ELS.fewerLasers}× fewer lasers, because one external laser feeds many lanes.`,
    `Micro-rings are tiny compared with the Mach-Zehnder modulators that silicon-photonics pluggables use (many pluggables use an externally modulated laser instead, as in step 7), so many lanes fit on a small chip right beside the switch; the price is that a ring's resonance drifts with temperature and has to be held in tune, typically by a small heater under control.`,
    `TSMC's ${M.COUPE.name} stacks the electronic chip on the photonic chip (${M.COUPE.bond}), so driver and modulator are microns apart. TSMC's April 2024 roadmap called for qualifying it in small pluggables in ${M.COUPE.pluggableYear} and in CoWoS packages as co-packaged optics in ${M.COUPE.cpoYear}.`,
    `The next step is optics on the accelerator package itself, replacing copper for GPU-to-GPU links. The Ethernet sibling, Spectrum-X Photonics, already puts ${M.SX.engines} engines of ${M.SX.engineTbps} Tb/s around one switch chip.`,
  ],
  sources: [
    ["NVIDIA Developer: how industry collaboration fosters NVIDIA co-packaged optics", M.URLS.NV_BLOG],
    ["NVIDIA press release: Spectrum-X and Quantum-X Photonics switches (GTC 2025)", M.URLS.NV_PR],
    ["The Next Platform: NVIDIA weaves silicon photonics into InfiniBand and Ethernet", M.URLS.NEXTPLATFORM],
    ["IEEE P802.3dj task force report, Nov 2023 (200 Gb/s per lane objectives)", M.URLS.IEEE_3DJ],
    ["Yuan et al., a 5 × 200 Gbps microring modulator silicon chip, Nature Communications 2024", M.URLS.RING_PAPER],
    ["TSMC press release, April 2024: North America Technology Symposium (COUPE)", M.URLS.TSMC_PR],
  ],
};
