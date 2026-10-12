// COMMS transmission (#69): narrowband FM modulator in plain JavaScript (no dependencies).
//
//   mic audio (16 kHz) → high-pass 300 Hz (4th order) → low-pass 3 kHz (4th order)
//     → pre-emphasis (+6 dB/octave from 212 Hz, 750 µs) scaled so a full-scale 1 kHz tone is
//       exactly full deviation → limiter (hard clip at full deviation) → splatter filter (3 kHz
//       low-pass, 4th order, removes the clipper's harmonics) → final clip (the filter's overshoot
//       can never over-deviate)
//   → frequency modulation at ±2.5 kHz peak deviation, the message interpolated linearly up to the
//     IQ rate (2 Msps) and integrated into phase → interleaved IQ: int8 (HackRF, hackrf_transfer -t)
//     or SC16 Q11 little-endian int16 (bladeRF-cli "format=bin").
// The CW station ID bypasses the speech chain (it is already a clean tone) but not the final clip.

import { TX } from '../src/data/tx.js';

// ---- biquads (RBJ audio-EQ cookbook) ------------------------------------------------------------
function biquad(type, f0, fs, q) {
  const w = (2 * Math.PI * f0) / fs, c = Math.cos(w), a = Math.sin(w) / (2 * q);
  const b = type === 'lp' ? [(1 - c) / 2, 1 - c, (1 - c) / 2] : [(1 + c) / 2, -(1 + c), (1 + c) / 2];
  const a0 = 1 + a;
  return { b0: b[0] / a0, b1: b[1] / a0, b2: b[2] / a0, a1: (-2 * c) / a0, a2: (1 - a) / a0 };
}
/** First-order section from an analogue (1 + s·t1) / (1 + s·t2) by the bilinear transform. */
function firstOrder(t1, t2, fs) {
  const k = 2 * fs, a0 = 1 + k * t2;
  return { b0: (1 + k * t1) / a0, b1: (1 - k * t1) / a0, b2: 0, a1: (1 - k * t2) / a0, a2: 0 };
}
const BUTTER4_Q = [0.5411961, 1.3065630]; // 4th-order Butterworth as two biquads
/** |H(f)| of a cascade of sections. */
function gainAt(sections, f, fs) {
  const w = (2 * Math.PI * f) / fs, z1 = [Math.cos(w), -Math.sin(w)], z2 = [Math.cos(2 * w), -Math.sin(2 * w)];
  let g = 1;
  for (const s of sections) {
    const nr = s.b0 + s.b1 * z1[0] + s.b2 * z2[0], ni = s.b1 * z1[1] + s.b2 * z2[1];
    const dr = 1 + s.a1 * z1[0] + s.a2 * z2[0], di = s.a1 * z1[1] + s.a2 * z2[1];
    g *= Math.hypot(nr, ni) / Math.hypot(dr, di);
  }
  return g;
}
/** Run samples through a cascade in place (Direct Form I state kept per section). */
function runCascade(sections, state, x) {
  for (let k = 0; k < sections.length; k++) {
    const s = sections[k], st = state[k];
    for (let i = 0; i < x.length; i++) {
      const y = s.b0 * x[i] + s.b1 * st[0] + s.b2 * st[1] - s.a1 * st[2] - s.a2 * st[3];
      st[1] = st[0]; st[0] = x[i]; st[3] = st[2]; st[2] = y; x[i] = y;
    }
  }
}

/**
 * The speech chain: band-limit, pre-emphasise, limit. process(Float32Array) → Float32Array of the
 * modulating signal in [−1, 1] (1 = full deviation). A full-scale 1 kHz tone comes out at 1.0.
 */
export function createAudioChain({ rate = TX.audioRate, loHz = TX.audioLoHz, hiHz = TX.audioHiHz, preEmphasisUs = 750 } = {}) {
  const shape = [
    ...BUTTER4_Q.map((q) => biquad('hp', loHz, rate, q)),
    ...BUTTER4_Q.map((q) => biquad('lp', hiHz, rate, q)),
    firstOrder(preEmphasisUs * 1e-6, 1 / (2 * Math.PI * 6000), rate), // +6 dB/oct from 212 Hz, levelling off above the audio band
  ];
  const splatter = BUTTER4_Q.map((q) => biquad('lp', hiHz, rate, q));
  const norm = 1 / gainAt(shape, 1000, rate); // full-scale 1 kHz → exactly full deviation
  const sState = shape.map(() => [0, 0, 0, 0]), pState = splatter.map(() => [0, 0, 0, 0]);
  return {
    norm,
    /** |gain| of the linear part at f (before the limiter), relative to 1 kHz. */
    response: (f) => gainAt(shape, f, rate) * norm,
    process(input) {
      const x = Float32Array.from(input);
      runCascade(shape, sState, x);
      for (let i = 0; i < x.length; i++) x[i] = Math.max(-1, Math.min(1, x[i] * norm)); // limiter
      runCascade(splatter, pState, x);
      for (let i = 0; i < x.length; i++) x[i] = Math.max(-1, Math.min(1, x[i]));
      return x;
    },
  };
}

/**
 * FM modulator. modulate(Float32Array audio at audioRate, { raw }) → Buffer of interleaved IQ in
 * `format` ('int8' or 'sc16q11'). raw: skip the speech chain (CW ID). Phase is continuous across calls.
 */
export function createFmModulator({ audioRate = TX.audioRate, iqRate = TX.iqRate, deviationHz = TX.deviationHz, format = 'int8', level = 0.9 } = {}) {
  const R = iqRate / audioRate;
  if (!Number.isInteger(R)) throw new Error('IQ rate must be a whole multiple of the audio rate');
  const chain = createAudioChain({ rate: audioRate });
  const k = (2 * Math.PI * deviationHz) / iqRate, bytes = format === 'int8' ? 2 : 4, scale = format === 'int8' ? 127 * level : 2047 * level;
  let phase = 0, prev = 0;
  return {
    chain,
    format,
    iqPerAudio: R,
    bytesPerAudioSample: R * bytes,
    modulate(audio, { raw = false } = {}) {
      const m = raw ? Float32Array.from(audio, (v) => Math.max(-1, Math.min(1, v))) : chain.process(audio);
      const out = Buffer.alloc(m.length * R * bytes), i8 = new Int8Array(out.buffer, out.byteOffset, out.length), dv = new DataView(out.buffer, out.byteOffset, out.length);
      let o = 0;
      for (let i = 0; i < m.length; i++) {
        const d = (m[i] - prev) / R;
        let v = prev;
        for (let j = 0; j < R; j++) {
          v += d;
          phase += k * v;
          if (phase > Math.PI) phase -= 2 * Math.PI; else if (phase < -Math.PI) phase += 2 * Math.PI;
          const I = Math.round(scale * Math.cos(phase)), Q = Math.round(scale * Math.sin(phase));
          if (bytes === 2) { i8[o] = I; i8[o + 1] = Q; o += 2; }
          else { dv.setInt16(o, I, true); dv.setInt16(o + 2, Q, true); o += 4; }
        }
        prev = m[i];
      }
      return out;
    },
  };
}

/** Int16 little-endian PCM (the browser's mic frames) → Float32 in [−1, 1). */
export function pcm16ToFloat(buf) {
  const n = buf.length >> 1, out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = buf.readInt16LE(2 * i) / 32768;
  return out;
}
