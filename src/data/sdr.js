// Local SDR waterfall (#69): the row format the backend sends over ws /api/rf/local, and the
// frequency axis seen from the antenna. Pure; shared by server/sdr.js, the receiver console and tests.
//
// A row is one averaged power spectrum of the SDR's IQ stream, DC (the SDR's centre) in the middle
// (bin i is centred on centre − rate/2 + i·rate/bins):
//
//   "LWF" | version u8 (1) | seq u32 LE | centre Hz f64 LE (SDR side) | sample rate Hz u32 LE
//         | bins u16 LE | flags u8 (bit 0: simulated device) | one byte per bin: dBFS + 200
//
// It travels beside the Kiwi-style "SND" audio frames, so the browser tells them apart by the tag.
// The SDR reports its own (device) frequencies; the axis maps them to the antenna through the
// SIGNAL PATH converter (src/data/converter.js): antenna = SDR − LO for an up-converter (Ham It Up).

import { toAntennaHz } from './converter.js';

export const WF_TAG = 'LWF';
export const WF_HEADER = 23;
export const WF_DB_OFFSET = 200; // byte = round(dBFS + 200), clamped 0..255 (−200 … +55 dBFS, 1 dB steps)

/** Encode a row: { seq, centreHz, rateHz, db: dBFS per bin (low → high frequency), fake } → Uint8Array. */
export function encodeWfRow({ seq = 0, centreHz, rateHz, db, fake = false }) {
  const n = db.length, out = new Uint8Array(WF_HEADER + n), dv = new DataView(out.buffer);
  out.set([76, 87, 70], 0); // "LWF"
  dv.setUint8(3, 1);
  dv.setUint32(4, seq >>> 0, true);
  dv.setFloat64(8, centreHz, true);
  dv.setUint32(16, Math.round(rateHz), true);
  dv.setUint16(20, n, true);
  dv.setUint8(22, fake ? 1 : 0);
  for (let i = 0; i < n; i++) out[WF_HEADER + i] = Math.max(0, Math.min(255, Math.round(db[i] + WF_DB_OFFSET)));
  return out;
}

/** Parse a row's body (the bytes after the 3-byte tag, as kiwiTag returns them) → { seq, centreHz, rateHz, bins, fake, db: Float32Array } or null. */
export function parseWfRow(body) {
  if (!body || body.byteLength < WF_HEADER - 3) return null;
  const dv = new DataView(body.buffer, body.byteOffset, body.byteLength);
  if (dv.getUint8(0) !== 1) return null;
  const seq = dv.getUint32(1, true), centreHz = dv.getFloat64(5, true), rateHz = dv.getUint32(13, true), bins = dv.getUint16(17, true), fake = (dv.getUint8(19) & 1) === 1;
  if (body.byteLength < WF_HEADER - 3 + bins) return null;
  const db = new Float32Array(bins);
  for (let i = 0; i < bins; i++) db[i] = body[WF_HEADER - 3 + i] - WF_DB_OFFSET;
  return { seq, centreHz, rateHz, bins, fake, db };
}

/**
 * The frequency axis of a row seen from the antenna. Bin i is centred on start + i·binHz (FFT bins are
 * centred on their frequency), so bin n/2 is the SDR's centre and bin 0 is centre − rate/2.
 * → { startHz (bin 0's centre), endHz, spanHz, binHz, centreHz (antenna), deviceCentreHz, freqOfBin(i), binOfFreq(antennaHz) }.
 */
export function rowAxis({ centreHz, rateHz, bins }, converter = null) {
  const binHz = rateHz / bins, deviceStart = centreHz - rateHz / 2;
  const startHz = toAntennaHz(deviceStart, converter); // a converter only shifts (no inversion): the axis still rises left to right
  return {
    startHz, endHz: startHz + rateHz, spanHz: rateHz, binHz, centreHz: toAntennaHz(centreHz, converter), deviceCentreHz: centreHz,
    freqOfBin: (i) => startHz + i * binHz,
    binOfFreq: (hz) => Math.round((hz - startHz) / binHz),
  };
}

/** Tick marks for an axis: [{ hz, label }] at a round step, about `count` of them. */
export function axisTicks(startHz, spanHz, count = 6) {
  const raw = spanHz / count, mag = 10 ** Math.floor(Math.log10(raw)), step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const out = [];
  for (let f = Math.ceil(startHz / step) * step; f <= startHz + spanHz; f += step) {
    const mhz = f / 1e6, digits = step >= 1e6 ? 0 : step >= 1e5 ? 1 : step >= 1e4 ? 2 : 3;
    out.push({ hz: f, label: f >= 1e6 ? `${mhz.toFixed(digits)}` : `${(f / 1e3).toFixed(step >= 1e3 ? 0 : 1)} k` });
  }
  return out;
}
