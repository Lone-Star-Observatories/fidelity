// Local wake word (#21): "Computer" spotted on this machine, so no audio leaves it until the
// wake word fires. The viewer records the word three times; each later utterance (cut out of
// the microphone stream by an energy detector) is compared with those templates by dynamic
// time warping over MFCC features. Small, dependency-free, speaker-dependent by design.

export const RATE = 16000; // feature sample rate
const FRAME = 400, HOP = 160, NFFT = 512, NMEL = 26, NCEP = 13;

// ---- MFCC -----------------------------------------------------------------------------------------
const hamming = Float32Array.from({ length: FRAME }, (_, i) => 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (FRAME - 1)));
const hz2mel = (f) => 2595 * Math.log10(1 + f / 700), mel2hz = (m) => 700 * (10 ** (m / 2595) - 1);
const MEL = (() => { // triangular filters, 20 Hz – 8 kHz
  const lo = hz2mel(20), hi = hz2mel(RATE / 2), pts = Array.from({ length: NMEL + 2 }, (_, i) => mel2hz(lo + ((hi - lo) * i) / (NMEL + 1)));
  const bin = pts.map((f) => Math.floor(((NFFT + 1) * f) / RATE));
  return Array.from({ length: NMEL }, (_, m) => {
    const w = new Float32Array(NFFT / 2 + 1);
    for (let k = bin[m]; k < bin[m + 1]; k++) w[k] = (k - bin[m]) / Math.max(1, bin[m + 1] - bin[m]);
    for (let k = bin[m + 1]; k < bin[m + 2]; k++) w[k] = (bin[m + 2] - k) / Math.max(1, bin[m + 2] - bin[m + 1]);
    return w;
  });
})();
const DCT = Array.from({ length: NCEP }, (_, c) => Float32Array.from({ length: NMEL }, (_, m) => Math.cos((Math.PI * c * (m + 0.5)) / NMEL)));

function fft(re, im) { // in place, radix-2
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const a = (-2 * Math.PI) / len, wr = Math.cos(a), wi = Math.sin(a);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k], ui = im[i + k], vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci, vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ur + vr; im[i + k] = ui + vi; re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
        [cr, ci] = [cr * wr - ci * wi, cr * wi + ci * wr];
      }
    }
  }
}

/** MFCC frames (cepstral-mean normalised, c0 dropped) of 16 kHz samples: array of Float32Array(12). */
export function mfcc(samples) {
  const out = [], re = new Float32Array(NFFT), im = new Float32Array(NFFT);
  for (let s = 0; s + FRAME <= samples.length; s += HOP) {
    re.fill(0); im.fill(0);
    for (let i = 0; i < FRAME; i++) re[i] = (samples[s + i] - 0.97 * (samples[s + i - 1] ?? 0)) * hamming[i];
    fft(re, im);
    const logMel = new Float32Array(NMEL);
    for (let m = 0; m < NMEL; m++) {
      let e = 0;
      const w = MEL[m];
      for (let k = 0; k <= NFFT / 2; k++) if (w[k]) e += w[k] * (re[k] * re[k] + im[k] * im[k]);
      logMel[m] = Math.log(e + 1e-10);
    }
    const c = new Float32Array(NCEP - 1);
    for (let k = 1; k < NCEP; k++) { let v = 0; for (let m = 0; m < NMEL; m++) v += DCT[k][m] * logMel[m]; c[k - 1] = v; }
    out.push(c);
  }
  // cepstral mean normalisation: removes the microphone/room colouring
  if (out.length) for (let k = 0; k < NCEP - 1; k++) { let mean = 0; for (const f of out) mean += f[k]; mean /= out.length; for (const f of out) f[k] -= mean; }
  return out;
}

/** Dynamic-time-warping distance between two MFCC sequences, normalised by path length. */
export function dtw(a, b) {
  const n = a.length, m = b.length;
  if (!n || !m) return Infinity;
  const band = Math.max(Math.abs(n - m) + 2, Math.ceil(Math.max(n, m) * 0.25)); // Sakoe–Chiba band
  let prev = new Float64Array(m + 1).fill(Infinity), cur = new Float64Array(m + 1);
  prev[0] = 0;
  for (let i = 1; i <= n; i++) {
    cur.fill(Infinity);
    const jc = Math.round((i * m) / n);
    for (let j = Math.max(1, jc - band); j <= Math.min(m, jc + band); j++) {
      let d = 0;
      const x = a[i - 1], y = b[j - 1];
      for (let k = 0; k < x.length; k++) d += (x[k] - y[k]) ** 2;
      cur[j] = Math.sqrt(d) + Math.min(prev[j], cur[j - 1], prev[j - 1]);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[m] / (n + m);
}

// ---- utterances out of a stream -------------------------------------------------------------------
/**
 * Energy endpointing over 10 ms frames: calls `onUtterance(Float32Array)` for each stretch of speech
 * 0.25–1.6 s long, ended by 250 ms of quiet. The noise floor adapts slowly.
 */
export function createEndpointer(onUtterance, { minS = 0.25, maxS = 1.6 } = {}) {
  let floor = -60, active = false, quiet = 0, buf = [], carry = new Float32Array(0);
  return {
    push(x) {
      const all = new Float32Array(carry.length + x.length); all.set(carry); all.set(x, carry.length);
      let i = 0;
      for (; i + HOP <= all.length; i += HOP) {
        const f = all.subarray(i, i + HOP);
        let e = 0; for (const v of f) e += v * v;
        const db = 10 * Math.log10(e / HOP + 1e-12);
        if (!active) floor = Math.min(db, floor * 0.995 + db * 0.005); else floor = Math.min(floor, db + 30);
        const speech = db > floor + 14 && db > -55;
        if (speech) { active = true; quiet = 0; }
        if (active) {
          buf.push(f.slice());
          if (!speech && ++quiet > 25) { // 250 ms of quiet ends it
            const len = (buf.length - quiet) * HOP / RATE;
            if (len >= minS && len <= maxS) { const out = new Float32Array((buf.length - quiet) * HOP); buf.slice(0, buf.length - quiet).forEach((b, k) => out.set(b, k * HOP)); onUtterance(out); }
            active = false; buf = []; quiet = 0;
          } else if (buf.length * HOP / RATE > maxS + 0.5) { active = false; buf = []; quiet = 0; } // too long: talk, not a wake word
        }
      }
      carry = all.slice(i);
    },
    get speaking() { return active; },
  };
}

// ---- templates ------------------------------------------------------------------------------------
const KEY = 'fidelity.wake.v1';
/** Saved templates { frames: [[...12]], threshold } or null. */
export function loadTemplates() {
  try {
    const t = JSON.parse(localStorage.getItem(KEY) || 'null');
    return t?.templates?.length ? { templates: t.templates.map((s) => s.map((f) => Float32Array.from(f))), threshold: t.threshold } : null;
  } catch { return null; }
}
/** Build and save templates from enrolment recordings (16 kHz). Threshold from how alike they are. */
export function saveTemplates(recordings) {
  const templates = recordings.map(mfcc).filter((t) => t.length > 10);
  if (templates.length < 2) throw new Error('need at least two clear recordings');
  const d = [];
  for (let i = 0; i < templates.length; i++) for (let j = i + 1; j < templates.length; j++) d.push(dtw(templates[i], templates[j]));
  const mean = d.reduce((a, b) => a + b, 0) / d.length;
  const threshold = Math.max(mean * 1.35, mean + 1.5);
  try { localStorage.setItem(KEY, JSON.stringify({ templates: templates.map((t) => t.map((f) => Array.from(f, (v) => +v.toFixed(3)))), threshold })); } catch { /* private mode */ }
  return { templates, threshold, spread: mean };
}
export const clearTemplates = () => { try { localStorage.removeItem(KEY); } catch { /* ignore */ } };
/** Does this utterance match the wake word? { match, distance }. */
export function matchWake(samples, t) {
  const f = mfcc(samples);
  const distance = Math.min(...t.templates.map((x) => dtw(f, x)));
  return { match: distance < t.threshold, distance };
}

/** Streaming linear resampler: push(Float32Array at `from` Hz) → Float32Array at `to` Hz. */
export function resampler(from, to) {
  const step = from / to;
  let pos = 0, last = 0; // next output position in input samples, relative to the next chunk (−1 = the last sample before it)
  return (x) => {
    if (!x.length) return new Float32Array(0);
    const at = (i) => (i < 0 ? last : x[i]), out = [];
    while (pos < x.length - 1) { // the last sample needs the next chunk to interpolate
      const i = Math.floor(pos), f = pos - i;
      out.push(at(i) + (at(i + 1) - at(i)) * f);
      pos += step;
    }
    pos -= x.length; last = x[x.length - 1];
    return Float32Array.from(out);
  };
}
