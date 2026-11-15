export const ENGINE_PROFILES = {
  allies_airplane_ww2: {
    engines: 1,
    pitch: 0.94,
    body: 0.29,
    air: 0.16,
    filter: 0.88,
    harmonics: [1, 0.8, 0.42, 0.32, 0.16, 0.12, 0.06, 0.04],
  },
  curtiss_p40_airplane: {
    engines: 1,
    pitch: 1.16,
    body: 0.25,
    air: 0.2,
    filter: 1.15,
    harmonics: [1, 0.3, 0.7, 0.13, 0.33, 0.08, 0.14, 0.04],
  },
  german_ww2_bomber_henschel: {
    engines: 2,
    pitch: 0.72,
    body: 0.32,
    air: 0.23,
    filter: 0.72,
    harmonics: [1, 0.9, 0.28, 0.22, 0.09, 0.08, 0.04, 0.03],
  },
  ww2_aircraft_lowpoly: {
    engines: 4,
    pitch: 0.6,
    body: 0.34,
    air: 0.27,
    filter: 0.65,
    harmonics: [1, 0.95, 0.18, 0.3, 0.08, 0.12, 0.03, 0.05],
  },
  zirkus_rosarius_spitfire: {
    engines: 1,
    pitch: 1.32,
    body: 0.24,
    air: 0.17,
    filter: 1.25,
    harmonics: [1, 0.48, 0.23, 0.42, 0.12, 0.2, 0.07, 0.1],
  },
  "p-100_avenger_-_free": {
    engines: 1,
    pitch: 1.04,
    body: 0.28,
    air: 0.3,
    filter: 1.4,
    harmonics: [1, 0.15, 0.8, 0.1, 0.6, 0.08, 0.28, 0.05],
  },
};
const clamp = (v, min, max) => Math.max(min, Math.min(max, Number(v) || 0));
export function engineParameters(speed, volume, aircraft, motion = {}) {
  const profile =
    ENGINE_PROFILES[aircraft] || ENGINE_PROFILES.allies_airplane_ww2;
  const throttle = clamp((speed - 1) / 7, 0, 1);
  const turn = clamp(
    Math.abs(motion.turnRate || 0) / 0.7 + Math.abs(motion.bank || 0) * 0.3,
    0,
    1,
  );
  const climb = clamp((motion.climbRate || 0) / 3, -1, 1),
    pitch = clamp(motion.pitch, -0.7, 0.7);
  const load = clamp(turn * 0.6 + Math.max(0, climb) * 0.4, 0, 1);
  const wind = clamp(
    throttle * 0.55 + Math.max(0, -climb) * 0.4 + turn * 0.15,
    0,
    1,
  );
  return {
    engines: profile.engines,
    profile,
    frequency:
      (46 + throttle * 30) * profile.pitch * (1 + load * 0.09 + pitch * 0.035),
    cutoff: (550 + throttle * 1200 + wind * 500) * profile.filter,
    volume: clamp(volume, 0, 1) * 0.55 * (1 + load * 0.08),
    body: profile.body * (1 + load * 0.16),
    air: profile.air * (0.7 + wind * 0.6),
    pan: clamp(
      -(motion.bank || 0) * 0.3 - (motion.turnRate || 0) * 0.12,
      -0.35,
      0.35,
    ),
  };
}
// Locally synthesized piston-engine pulse and air noise; no network assets.
export function engineNoise(sampleRate, seconds = 2) {
  const samples = new Float32Array(Math.floor(sampleRate * seconds));
  let seed = 73013,
    low = 0;
  for (let i = 0; i < samples.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    low = low * 0.7 + ((seed / 4294967296) * 2 - 1) * 0.3;
    samples[i] = low;
  }
  return samples;
}
class AircraftEngine {
  context = null;
  graph = null;
  async enable() {
    const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Context)
      throw new Error("O áudio não está disponível neste navegador.");
    if (!this.context || this.context.state === "closed") {
      const ctx = new Context();
      this.context = ctx;
      const master = ctx.createGain(),
        filter = ctx.createBiquadFilter(),
        compressor = ctx.createDynamicsCompressor();
      master.gain.value = 0;
      filter.type = "lowpass";
      filter.frequency.value = 1000;
      compressor.threshold.value = -18;
      compressor.ratio.value = 4;
      filter.connect(master);
      const panner = ctx.createStereoPanner?.();
      if (panner) {
        master.connect(panner);
        panner.connect(compressor);
      } else master.connect(compressor);
      compressor.connect(ctx.destination);
      const waves = Object.fromEntries(
        Object.entries(ENGINE_PROFILES).map(([id, p]) => [
          id,
          ctx.createPeriodicWave(
            new Float32Array(9),
            new Float32Array([0, ...p.harmonics]),
          ),
        ]),
      );
      const voices = [];
      for (let i = 0; i < 4; i++) {
        const osc = ctx.createOscillator(),
          gain = ctx.createGain();
        osc.setPeriodicWave(waves.allies_airplane_ww2);
        osc.frequency.value = 55 * (1 + (i - 1.5) * 0.009);
        gain.gain.value = 0;
        osc.connect(gain);
        gain.connect(filter);
        osc.start();
        voices.push({ osc, gain, profileId: "allies_airplane_ww2" });
      }
      const noise = ctx.createBufferSource(),
        data = engineNoise(ctx.sampleRate),
        buffer = ctx.createBuffer(1, data.length, ctx.sampleRate),
        noiseGain = ctx.createGain();
      buffer.copyToChannel(data, 0);
      noise.buffer = buffer;
      noise.loop = true;
      noiseGain.gain.value = 0.2;
      noise.connect(noiseGain);
      noiseGain.connect(filter);
      noise.start();
      this.graph = {
        master,
        filter,
        voices,
        noise,
        noiseGain,
        compressor,
        panner,
        waves,
      };
    }
    await this.context.resume();
    if (this.context.state !== "running")
      throw new Error("Toca novamente para ativar o som.");
  }
  update({
    enabled,
    active,
    volume,
    speed,
    aircraft,
    pitch = 0,
    bank = 0,
    turnRate = 0,
    climbRate = 0,
  }) {
    if (!this.graph || this.context.state === "closed") return;
    const p = engineParameters(speed, volume, aircraft, {
        pitch,
        bank,
        turnRate,
        climbRate,
      }),
      time = this.context.currentTime;
    this.graph.master.gain.setTargetAtTime(
      enabled && active ? p.volume : 0,
      time,
      0.12,
    );
    this.graph.filter.frequency.setTargetAtTime(p.cutoff, time, 0.15);
    this.graph.noiseGain.gain.setTargetAtTime(p.air, time, 0.15);
    this.graph.panner?.pan.setTargetAtTime(p.pan, time, 0.2);
    this.graph.voices.forEach((voice, i) => {
      const { osc, gain } = voice;
      const profileId = ENGINE_PROFILES[aircraft]
        ? aircraft
        : "allies_airplane_ww2";
      if (voice.profileId !== profileId) {
        osc.setPeriodicWave(this.graph.waves[profileId]);
        voice.profileId = profileId;
      }
      gain.gain.setTargetAtTime(
        i < p.engines ? p.body / Math.sqrt(p.engines) : 0,
        time,
        0.15,
      );
      osc.frequency.setTargetAtTime(
        p.frequency * (1 + (i - 1.5) * 0.009),
        time,
        0.15,
      );
    });
  }
  dispose() {
    if (this.graph) {
      this.graph.voices.forEach((v) => v.osc.stop());
      this.graph.noise.stop();
    }
    this.context?.close().catch(() => {});
    this.context = null;
    this.graph = null;
  }
}
export const aircraftEngine = new AircraftEngine();
