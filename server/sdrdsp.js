// Local SDR signal processing (#69), plain JS, no dependencies. One IQ stream from the device feeds
// both the waterfall and the audio, so a single process holds the hardware:
//
//   IQ (int16 → ±1 float) ─┬─ spectrum: Hann window, 1024-point FFT, power averaged over up to 16
//                          │  frames per row, ~10 rows/s, DC in the middle → dBFS per bin
//                          └─ demodulator: NCO to the listening offset → decimating FIR low-pass
//                             to ~50 kHz (or ~250 kHz for WFM) → mode filter → AM / USB / LSB / CW /
//                             NBFM / WFM → AGC (fast / slow / off, the Kiwi presets) → Int16 audio
//                             at ~25 kHz (Fs / 40 or Fs / 10 of the intermediate rate)
//
// The demodulator works in the SDR's frequencies relative to the tuned centre; the converter
// mapping (antenna ↔ SDR) happens before the tune request (browser) and on the axis (src/data/sdr.js).

import { passband } from '../src/data/rf.js';

// ---- FFT -----------------------------------------------------------------------------------------

/** An in-place radix-2 complex FFT of a fixed size (a power of two). fft(re, im) transforms the arrays. */
export function createFft(n) {
  if (n < 2 || (n & (n - 1))) throw new Error('FFT size must be a power of two');
  const bits = Math.log2(n), rev = new Uint32Array(n), cos = new Float64Array(n / 2), sin = new Float64Array(n / 2);
  for (let i = 0; i < n; i++) { let r = 0; for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b); rev[i] = r; }
  for (let i = 0; i < n / 2; i++) { cos[i] = Math.cos((2 * Math.PI * i) / n); sin[i] = -Math.sin((2 * Math.PI * i) / n); }
  return function fft(re, im) {
    for (let i = 0; i < n; i++) { const j = rev[i]; if (j > i) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
    for (let size = 2; size <= n; size <<= 1) {
      const half = size >> 1, step = n / size;
      for (let start = 0; start < n; start += size) {
        for (let k = 0, w = 0; k < half; k++, w += step) {
          const a = start + k, b = a + half, wr = cos[w], wi = sin[w];
          const tr = re[b] * wr - im[b] * wi, ti = re[b] * wi + im[b] * wr;
          re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
        }
      }
    }
  };
}

/** Hann window of length n. */
export function hann(n) {
  const w = new Float64Array(n);
  for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n);
  return w;
}

/**
 * Averaged power spectrum rows from a complex stream at rateHz. push(re, im) with Float32 blocks; onRow
 * receives Float32Array dBFS per bin (bin 0 = centre − rate/2, bin n/2 = the centre). A full-scale
 * complex tone (amplitude 1) reads 0 dBFS in its bin.
 */
export function createSpectrum({ size = 1024, rateHz, rowsPerSec = 10, maxAvg = 16, onRow }) {
  const fft = createFft(size), win = hann(size), re = new Float64Array(size), im = new Float64Array(size), acc = new Float64Array(size);
  const rowSamples = Math.max(size, Math.round(rateHz / rowsPerSec)), avgN = Math.max(1, Math.min(maxAvg, Math.floor(rowSamples / size)));
  let wsum = 0; for (const x of win) wsum += x;
  const norm = 1 / (wsum * wsum);
  let pos = 0, fill = 0, frames = 0; // pos: samples into this row's window; fill: samples in the current frame
  function emit() {
    const out = new Float32Array(size), half = size / 2;
    for (let k = 0; k < size; k++) { const p = (acc[k] / frames) * norm; out[(k + half) % size] = 10 * Math.log10(p + 1e-20); }
    acc.fill(0); frames = 0;
    onRow(out);
  }
  return {
    avgN, rowSamples,
    push(xr, xi) {
      for (let i = 0; i < xr.length; i++) {
        if (frames < avgN) {
          re[fill] = xr[i] * win[fill]; im[fill] = xi[i] * win[fill];
          if (++fill === size) {
            fft(re, im);
            for (let k = 0; k < size; k++) acc[k] += re[k] * re[k] + im[k] * im[k];
            fill = 0; frames++;
          }
        }
        if (++pos >= rowSamples) { if (frames) emit(); pos = 0; fill = 0; }
      }
    },
  };
}

// ---- filters -------------------------------------------------------------------------------------

/** Windowed-sinc (Blackman) low-pass taps: cutoff Hz at rate Hz, unity gain at DC. */
export function lowpassTaps(cutoffHz, rateHz, n) {
  const h = new Float64Array(n), fc = cutoffHz / rateHz, m = (n - 1) / 2;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const x = i - m, s = x === 0 ? 2 * fc : Math.sin(2 * Math.PI * fc * x) / (Math.PI * x);
    const w = 0.42 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)) + 0.08 * Math.cos((4 * Math.PI * i) / (n - 1));
    h[i] = s * w; sum += h[i];
  }
  for (let i = 0; i < n; i++) h[i] /= sum;
  return h;
}

/** A streaming FIR with decimation by d (real taps). run(re, im?) → [re, im?] at rate / d. */
export function createFir(taps, d = 1) {
  const L = taps.length;
  let hr = new Float64Array(L - 1), hi = new Float64Array(L - 1), skip = 0;
  return function run(xr, xi) {
    const n = xr.length, br = new Float64Array(L - 1 + n), bi = xi ? new Float64Array(L - 1 + n) : null;
    br.set(hr); br.set(xr, L - 1);
    if (bi) { bi.set(hi); bi.set(xi, L - 1); }
    const outN = skip < n ? Math.ceil((n - skip) / d) : 0, or = new Float32Array(outN), oi = bi ? new Float32Array(outN) : null;
    let k = 0, s = skip;
    for (; s < n; s += d, k++) {
      let ar = 0, ai = 0;
      if (bi) for (let t = 0; t < L; t++) { const c = taps[t]; ar += c * br[s + t]; ai += c * bi[s + t]; }
      else for (let t = 0; t < L; t++) ar += taps[t] * br[s + t];
      or[k] = ar; if (oi) oi[k] = ai;
    }
    skip = s - n;
    hr = br.slice(n); if (bi) hi = bi.slice(n);
    return [or, oi];
  };
}

/** A numerically controlled oscillator: mix(re, im) multiplies by e^{j2π f t} in place. */
export function createNco(freqHz, rateHz) {
  let c = 1, s = 0, k = 0;
  const dc = Math.cos((2 * Math.PI * freqHz) / rateHz), ds = Math.sin((2 * Math.PI * freqHz) / rateHz);
  return {
    get freqHz() { return freqHz; },
    mix(re, im) {
      for (let i = 0; i < re.length; i++) {
        const r = re[i], q = im[i];
        re[i] = r * c - q * s; im[i] = r * s + q * c;
        const nc = c * dc - s * ds; s = c * ds + s * dc; c = nc;
        if (++k === 4096) { const m = 1 / Math.hypot(c, s); c *= m; s *= m; k = 0; }
      }
    },
  };
}

// ---- demodulator ---------------------------------------------------------------------------------

/** Kiwi AGC presets as time constants: decay (s), hang. "off" is a fixed gain. */
export const AGC_TIMES = { fast: { decay: 0.2, hang: 0 }, slow: { decay: 2, hang: 0.5 }, off: null };

/** Peak-tracking AGC to ~−10 dBFS audio: fast attack (2 ms), decay per preset, optional hang. */
export function createAgc(rateHz, agc = 'fast', { target = 0.3, fixedGain = 100, maxGain = 1e5 } = {}) {
  const t = AGC_TIMES[agc] ?? AGC_TIMES.fast;
  if (!t) return (x) => { for (let i = 0; i < x.length; i++) x[i] *= fixedGain; return x; };
  const att = 1 - Math.exp(-1 / (0.002 * rateHz)), dec = 1 - Math.exp(-1 / (t.decay * rateHz)), hangN = Math.round(t.hang * rateHz);
  let env = 1e-4, hold = 0;
  return (x) => {
    for (let i = 0; i < x.length; i++) {
      const a = Math.abs(x[i]);
      if (a > env) { env += (a - env) * att; hold = hangN; } else if (hold > 0) hold--; else env += (a - env) * dec;
      x[i] *= Math.min(maxGain, target / Math.max(env, 1e-6));
    }
    return x;
  };
}

/** Rates for a device sample rate and mode: { d0, midRate, d1, audioRate } (integer decimations). */
export function demodRates(rateHz, mode) {
  const midTarget = mode === 'wbfm' ? 250e3 : 50e3;
  const d0 = Math.max(1, Math.round(rateHz / midTarget)), midRate = rateHz / d0;
  const d1 = Math.max(1, Math.round(midRate / 25e3)); // WFM reaches it in two real stages after the discriminator
  return { d0, midRate, d1, audioRate: midRate / d1 };
}

/**
 * Demodulate one channel of a complex stream at rateHz, `offsetHz` from the SDR's centre.
 * push(re, im) → { audio: Float32Array (≈ ±1), power: mean channel power (linear, full scale = 1) }.
 */
export function createDemodulator({ rateHz, offsetHz = 0, mode = 'am', bwHz, agc = 'fast' }) {
  const { d0, midRate, d1, audioRate } = demodRates(rateHz, mode);
  const nco = createNco(-offsetHz, rateHz);
  const wide = mode === 'wbfm';
  // stage 0: the device rate down to the intermediate rate; keep ±100 kHz (WFM) or ±10 kHz clean
  const pass0 = wide ? 100e3 : 10e3, stop0 = midRate - pass0;
  const taps0 = d0 > 1 ? Math.min(255, Math.max(15, Math.ceil((5.5 * rateHz) / Math.max(1, stop0 - pass0)) | 1)) : 0;
  const fir0 = d0 > 1 ? createFir(lowpassTaps((pass0 + stop0) / 2 < midRate / 2 ? (pass0 + stop0) / 2 : midRate * 0.45, rateHz, taps0), d0) : null;
  const out = { mode, offsetHz, audioRate, midRate };
  if (wide) {
    const a1 = createFir(lowpassTaps(15e3, midRate, 63), Math.max(1, Math.round(midRate / 50e3)));
    const r1 = midRate / Math.max(1, Math.round(midRate / 50e3));
    const a2 = createFir(lowpassTaps(10e3, r1, 47), Math.max(1, Math.round(r1 / 25e3)));
    const rate2 = r1 / Math.max(1, Math.round(r1 / 25e3));
    const deemph = Math.exp(-1 / (75e-6 * rate2)); // 75 µs (Americas); 50 µs elsewhere is a little brighter
    let pr = 1, pi = 0, y = 0;
    out.audioRate = rate2;
    out.push = (xr, xi) => {
      const r = Float32Array.from(xr), q = Float32Array.from(xi);
      nco.mix(r, q);
      const [mr, mi] = fir0 ? fir0(r, q) : [r, q];
      const f = new Float32Array(mr.length), k = midRate / (2 * Math.PI * 75e3);
      let pow = 0;
      for (let i = 0; i < mr.length; i++) {
        const a = mr[i], b = mi[i];
        f[i] = Math.atan2(b * pr - a * pi, a * pr + b * pi) * k; // arg(z·conj(z₋₁)) → ±1 at ±75 kHz
        pr = a; pi = b; pow += a * a + b * b;
      }
      const [s1] = a1(f), [s2] = a2(s1);
      for (let i = 0; i < s2.length; i++) { y = s2[i] + (y - s2[i]) * deemph; s2[i] = y * 0.9; }
      return { audio: s2, power: mr.length ? pow / mr.length : 0 };
    };
    return out;
  }
  // narrow modes: to ~25 kHz complex, then the mode's passband
  const fir1 = createFir(lowpassTaps(6.5e3, midRate, 31), d1);
  const bfo = mode === 'cw' ? 500 : 0; // a CW carrier on the dial is heard at 500 Hz
  const { low, high } = passband(mode === 'nbfm' ? 'nbfm' : mode, bwHz);
  const centre = (low + high) / 2, half = Math.min((high - low) / 2, audioRate * 0.48);
  const down = createNco(bfo - centre, audioRate), up = createNco(centre, audioRate);
  const chan = createFir(lowpassTaps(half, audioRate, 63), 1);
  const gain = createAgc(audioRate, agc);
  let dc = 0, pr = 1, pi = 0;
  const dcA = 1 / (audioRate * 0.1);
  out.push = (xr, xi) => {
    const r = Float32Array.from(xr), q = Float32Array.from(xi);
    nco.mix(r, q);
    const [mr, mi] = fir0 ? fir0(r, q) : [r, q];
    const [ar, ai] = fir1(mr, mi);
    down.mix(ar, ai);
    const [cr, ci] = chan(ar, ai);
    const audio = new Float32Array(cr.length);
    let pow = 0;
    for (let i = 0; i < cr.length; i++) pow += cr[i] * cr[i] + ci[i] * ci[i];
    if (mode === 'am') {
      for (let i = 0; i < cr.length; i++) { const e = Math.hypot(cr[i], ci[i]); dc += (e - dc) * dcA; audio[i] = e - dc; }
      gain(audio);
    } else if (mode === 'nbfm') {
      const k = audioRate / (2 * Math.PI * 5e3); // ±5 kHz → ±1
      for (let i = 0; i < cr.length; i++) { const a = cr[i], b = ci[i]; audio[i] = Math.atan2(b * pr - a * pi, a * pr + b * pi) * k * 0.8; pr = a; pi = b; }
    } else { // usb, lsb, cw: shift the passband back and take the real part
      up.mix(cr, ci);
      for (let i = 0; i < cr.length; i++) audio[i] = cr[i];
      gain(audio);
    }
    return { audio, power: cr.length ? pow / cr.length : 0 };
  };
  return out;
}

/** Interleaved little-endian int16 IQ bytes → [re, im] Float32 at ±1 for `scale` = full scale. Returns the unused tail bytes too. */
export function iqFromBytes(buf, scale) {
  const n = Math.floor(buf.length / 4), re = new Float32Array(n), im = new Float32Array(n), k = 1 / scale;
  for (let i = 0; i < n; i++) { re[i] = buf.readInt16LE(i * 4) * k; im[i] = buf.readInt16LE(i * 4 + 2) * k; }
  return { re, im, rest: buf.subarray(n * 4) };
}

/** Float audio (≈ ±1) → Int16 LE PCM bytes (clipped). */
export function audioToPcm(audio) {
  const b = Buffer.alloc(audio.length * 2);
  for (let i = 0; i < audio.length; i++) b.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(audio[i] * 32767))), i * 2);
  return b;
}
