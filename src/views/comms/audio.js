// COMMS audio (#69): one chain for every received signal.
//   PCM from a receiver (12 kHz, in irregular network chunks) → a jitter buffer (scheduled ~300 ms
//   ahead, re-synced if it drifts) → high-pass (rumble) → low-pass at the passband (hiss above the
//   voice) → automatic notch (a steady heterodyne whistle or squeal is found in the spectrum and
//   notched out) → compressor (levels fades and wails) → volume → analyser → speakers.
// Internet radio uses the same chain through a media element.

export function createCommsAudio() {
  let ctx = null, chain = null, nextTime = 0, notchState = { bin: -1, hits: 0, misses: 0 }, timer = null, mediaSrc = null;
  const status = { notchHz: null, level: 0, buffered: 0, lowpassHz: 3000 };

  function ensure() {
    if (ctx) return ctx;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 150;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3000; lp.Q.value = 0.7;
    const notch = ctx.createBiquadFilter(); notch.type = 'notch'; notch.frequency.value = 20000; notch.Q.value = 25;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -30; comp.knee.value = 12; comp.ratio.value = 8; comp.attack.value = 0.005; comp.release.value = 0.25;
    const vol = ctx.createGain(); vol.gain.value = 0.9;
    const an = ctx.createAnalyser(); an.fftSize = 2048; an.smoothingTimeConstant = 0.6;
    hp.connect(lp); lp.connect(notch); notch.connect(comp); comp.connect(vol); vol.connect(an); an.connect(ctx.destination);
    chain = { input: hp, hp, lp, notch, comp, vol, an };
    timer = setInterval(autoNotch, 300);
    return ctx;
  }

  /** Find a steady narrow tone (≥ 22 dB above the median, same bin three looks running) and notch it. */
  function autoNotch() {
    if (!chain) return;
    const an = chain.an, n = an.frequencyBinCount, f = new Float32Array(n);
    an.getFloatFrequencyData(f);
    const hz = ctx.sampleRate / 2 / n, lo = Math.ceil(300 / hz), hi = Math.min(n - 1, Math.floor(Math.min(4000, status.lowpassHz) / hz));
    let best = lo; for (let i = lo; i <= hi; i++) if (f[i] > f[best]) best = i;
    const sorted = Array.from(f.subarray(lo, hi + 1)).sort((a, b) => a - b), med = sorted[Math.floor(sorted.length / 2)];
    status.level = Math.max(0, Math.min(1, (f[best] + 100) / 70));
    const tone = f[best] - med > 22 && f[best] > -70;
    if (tone && Math.abs(best - notchState.bin) <= 1) notchState.hits++;
    else if (tone) { notchState = { bin: best, hits: 1, misses: 0 }; }
    else notchState.misses++;
    if (notchState.hits >= 3) { chain.notch.frequency.setTargetAtTime(notchState.bin * hz, ctx.currentTime, 0.05); status.notchHz = Math.round(notchState.bin * hz); }
    if (notchState.misses > 12) { chain.notch.frequency.setTargetAtTime(20000, ctx.currentTime, 0.1); status.notchHz = null; notchState = { bin: -1, hits: 0, misses: 0 }; }
  }

  return {
    status,
    /** Start audio (must follow a user gesture the first time). */
    resume() { ensure(); return ctx.resume(); },
    /** Set the voice band: low-pass just above the passband to cut hiss. */
    setBand(widthHz) { ensure(); status.lowpassHz = Math.max(1500, Math.min(10000, widthHz)); chain.lp.frequency.setTargetAtTime(status.lowpassHz, ctx.currentTime, 0.05); },
    setVolume(v) { ensure(); chain.vol.gain.value = v; },
    /** Queue received PCM (Int16Array) at `rate` Hz. */
    pcm(samples, rate) {
      ensure();
      const buf = ctx.createBuffer(1, samples.length, rate), ch = buf.getChannelData(0);
      for (let i = 0; i < samples.length; i++) ch[i] = samples[i] / 32768;
      const now = ctx.currentTime;
      if (nextTime < now + 0.05 || nextTime > now + 1.5) nextTime = now + 0.3; // underrun or drift: re-buffer
      const src = ctx.createBufferSource(); src.buffer = buf; src.connect(chain.input); src.start(nextTime);
      nextTime += buf.duration;
      status.buffered = nextTime - now;
    },
    /** Route an <audio> element (internet radio) through the chain. */
    media(el) { ensure(); if (mediaSrc?.mediaElement !== el) { try { mediaSrc?.disconnect(); } catch { /* none */ } mediaSrc = ctx.createMediaElementSource(el); mediaSrc.connect(chain.input); } },
    /** Spectrum for a visualiser: Uint8Array. */
    spectrum() { if (!chain) return null; const a = new Uint8Array(chain.an.frequencyBinCount); chain.an.getByteFrequencyData(a); return a; },
    flush() { nextTime = 0; },
    close() { clearInterval(timer); timer = null; try { ctx?.close(); } catch { /* gone */ } ctx = null; chain = null; mediaSrc = null; },
  };
}
