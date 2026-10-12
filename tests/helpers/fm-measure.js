// Measurement helpers for the FM transmitter tests (#69): decimate and demodulate IQ, power spectrum,
// occupied bandwidth. Test-only (not a *.test.js file, so the runner does not execute it).

/** Interleaved IQ (int8 or SC16 Q11) → complex baseband decimated by `dec` (boxcar average). */
export function decimateIq(buf, dec = 50, format = 'int8') {
  const bytes = format === 'int8' ? 2 : 4, n = Math.floor(buf.length / bytes / dec), re = new Float64Array(n), im = new Float64Array(n);
  const i8 = new Int8Array(buf.buffer, buf.byteOffset, buf.length), dv = new DataView(buf.buffer, buf.byteOffset, buf.length);
  for (let k = 0; k < n; k++) {
    let a = 0, b = 0;
    for (let j = 0; j < dec; j++) {
      const s = (k * dec + j) * bytes;
      if (bytes === 2) { a += i8[s]; b += i8[s + 1]; } else { a += dv.getInt16(s, true); b += dv.getInt16(s + 2, true); }
    }
    re[k] = a / dec; im[k] = b / dec;
  }
  return { re, im };
}

/** Instantaneous frequency (Hz) of complex samples at rate fs (phase difference of neighbours). */
export function instFreq({ re, im }, fs) {
  const f = new Float64Array(re.length - 1);
  for (let k = 1; k < re.length; k++) {
    const r = re[k] * re[k - 1] + im[k] * im[k - 1], i = im[k] * re[k - 1] - re[k] * im[k - 1];
    f[k - 1] = (Math.atan2(i, r) * fs) / (2 * Math.PI);
  }
  return f;
}

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const a = (-2 * Math.PI) / len, wr = Math.cos(a), wi = Math.sin(a), h = len / 2;
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let j = 0; j < h; j++) {
        const xr = re[i + j + h], xi = im[i + j + h], vr = xr * cr - xi * ci, vi = xr * ci + xi * cr;
        re[i + j + h] = re[i + j] - vr; im[i + j + h] = im[i + j] - vi; re[i + j] += vr; im[i + j] += vi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}

/** Averaged Hann-windowed power spectrum, centred (bin n/2 is 0 Hz). */
export function powerSpectrum({ re, im }, n = 4096) {
  const p = new Float64Array(n);
  for (let s = 0; s + n <= re.length; s += n / 2) {
    const a = new Float64Array(n), b = new Float64Array(n);
    for (let i = 0; i < n; i++) { const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n); a[i] = re[s + i] * w; b[i] = im[s + i] * w; }
    fft(a, b);
    for (let i = 0; i < n; i++) p[(i + n / 2) % n] += a[i] * a[i] + b[i] * b[i];
  }
  return p;
}

/** Bandwidth (Hz) holding `frac` of the power, (1 − frac)/2 left out each side (ITU-R SM.328 occupied bandwidth). */
export function occupiedBandwidth(p, fs, frac = 0.99) {
  const total = p.reduce((a, b) => a + b, 0), cut = (total * (1 - frac)) / 2;
  let lo = 0, acc = 0;
  while (acc + p[lo] < cut) acc += p[lo++];
  let hi = p.length - 1;
  acc = 0;
  while (acc + p[hi] < cut) acc += p[hi--];
  return ((hi - lo + 1) * fs) / p.length;
}

/** A repeatable pseudo-random source in [−1, 1). */
export function lcg(seed = 1) {
  let s = seed;
  return () => { s = (s * 1103515245 + 12345) % 2147483648; return (s / 2147483648) * 2 - 1; };
}
