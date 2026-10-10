// COMMS receiver maths and protocol (#69): pure helpers shared by the backend relay, the browser and
// the tests. Reception only.
//
// KiwiSDR speaks WebSocket (github.com/jks-prv/kiwiclient is the reference client): the client sends
// text commands ("SET …"); the server sends binary messages tagged by their first three bytes:
//   "MSG" key=value text; "SND" audio: flags u8, sequence u32 LE, S-meter u16 BE (RSSI = 0.1·v − 127
//   dBm), then 16-bit big-endian PCM at ~12 kHz (with compression off); "W/F" waterfall: one pad byte,
//   x_bin u32 LE, flags/zoom u32 LE, sequence u32 LE, then one byte per bin, dBm = value − 255.

const td = new TextDecoder('latin1');

/** Split a Kiwi binary message into { tag, body }. */
export function kiwiTag(buf) {
  const u = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return { tag: td.decode(u.subarray(0, 3)), body: u.subarray(3) };
}

/** "MSG" body → { key: value } (values URI-decoded where they look encoded). */
export function parseKiwiMsg(body) {
  const out = {};
  for (const part of td.decode(body).trim().split(/\s+/)) {
    if (!part) continue;
    const i = part.indexOf('=');
    const k = i < 0 ? part : part.slice(0, i), v = i < 0 ? true : part.slice(i + 1);
    try { out[k] = typeof v === 'string' ? decodeURIComponent(v) : v; } catch { out[k] = v; }
  }
  return out;
}

/** "SND" body → { seq, rssi (dBm), samples: Int16Array } (uncompressed mono audio). */
export function parseKiwiSnd(body) {
  const dv = new DataView(body.buffer, body.byteOffset, body.byteLength);
  if (body.byteLength < 7) return null;
  const seq = dv.getUint32(1, true), smeter = dv.getUint16(5, false);
  const n = Math.floor((body.byteLength - 7) / 2), samples = new Int16Array(n);
  for (let i = 0; i < n; i++) samples[i] = dv.getInt16(7 + i * 2, false);
  return { seq, rssi: 0.1 * smeter - 127, samples };
}

/** "W/F" body → { xBin, zoom, seq, db: Float32Array } (dBm per bin). */
export function parseKiwiWf(body) {
  if (body.byteLength < 13) return null;
  const dv = new DataView(body.buffer, body.byteOffset, body.byteLength);
  const xBin = dv.getUint32(1, true), fz = dv.getUint32(5, true), seq = dv.getUint32(9, true);
  const raw = body.subarray(13), db = new Float32Array(raw.length);
  for (let i = 0; i < raw.length; i++) db[i] = raw[i] - 255;
  return { xBin, zoom: fz & 0xffff, seq, db };
}

/** Demodulator passbands (Hz, relative to the carrier) and labels. */
export const MODES = {
  am: { label: 'AM', low: -4900, high: 4900 },
  usb: { label: 'USB', low: 300, high: 2700 },
  lsb: { label: 'LSB', low: -2700, high: -300 },
  cw: { label: 'CW', low: 300, high: 700 },
  nbfm: { label: 'NBFM', low: -6000, high: 6000 },
};
/** Passband for a mode at a chosen bandwidth (Hz). */
export function passband(mode, bwHz) {
  const m = MODES[mode] ?? MODES.am;
  const bw = Math.max(100, bwHz ?? m.high - m.low);
  if (mode === 'usb') return { low: 300, high: 300 + bw };
  if (mode === 'lsb') return { low: -300 - bw, high: -300 };
  if (mode === 'cw') return { low: 500 - bw / 2, high: 500 + bw / 2 };
  return { low: -bw / 2, high: bw / 2 };
}
/** AGC response presets → Kiwi agc settings. */
export const AGC = { fast: { agc: 1, hang: 0, decay: 200 }, slow: { agc: 1, hang: 1, decay: 2000 }, off: { agc: 0, hang: 0, decay: 1000 } };

/** The text commands that tune a Kiwi audio channel. */
export function kiwiTuneCommands({ freqHz, mode = 'am', bwHz, agc = 'fast', gain = 50 }) {
  const { low, high } = passband(mode, bwHz), a = AGC[agc] ?? AGC.fast;
  const kiwiMode = mode === 'nbfm' ? 'nbfm' : mode;
  return [
    `SET mod=${kiwiMode} low_cut=${Math.round(low)} high_cut=${Math.round(high)} freq=${(freqHz / 1e3).toFixed(3)}`,
    `SET agc=${a.agc} hang=${a.hang} thresh=-100 slope=6 decay=${a.decay} manGain=${gain}`,
  ];
}
export const KIWI_SND_SETUP = ['SET auth t=kiwi p=', 'SET ident_user=USS%20Fidelity', 'SET compression=0', 'SET AR OK in=12000 out=44100', 'SET squelch=0 max=0'];
export const KIWI_WF_SETUP = ['SET auth t=kiwi p=', 'SET zoom=0 start=0', 'SET maxdb=0 mindb=-100', 'SET wf_speed=2', 'SET wf_comp=0'];

/**
 * Clear signals in a power spectrum: bins standing `snrDb` above the local noise floor (the median
 * of a sliding window), merged into peaks. db: dBm per bin from startHz over spanHz. Returns
 * [{ freqHz, db, snr, widthHz }] strongest first.
 */
export function findSignals(db, { startHz = 0, spanHz, snrDb = 10, window = 64, minGapBins = 3, max = 40 } = {}) {
  const n = db.length, hzPerBin = spanHz / n, floor = new Float32Array(n);
  const half = Math.max(4, Math.floor(window / 2));
  for (let i = 0; i < n; i += 8) { // a median every 8 bins, held between
    const a = Math.max(0, i - half), b = Math.min(n, i + half), w = Array.from(db.subarray ? db.subarray(a, b) : db.slice(a, b)).sort((x, y) => x - y);
    const m = w[Math.floor(w.length / 2)];
    for (let j = i; j < Math.min(n, i + 8); j++) floor[j] = m;
  }
  const out = [];
  let i = 0;
  while (i < n) {
    if (db[i] - floor[i] < snrDb) { i++; continue; }
    let j = i, best = i;
    while (j < n && (db[j] - floor[j] >= snrDb - 3 || (j - i < minGapBins && j + 1 < n && db[j + 1] - floor[j + 1] >= snrDb - 3))) { if (db[j] > db[best]) best = j; j++; }
    out.push({ freqHz: Math.round(startHz + (best + 0.5) * hzPerBin), db: db[best], snr: db[best] - floor[best], widthHz: Math.max(1, j - i) * hzPerBin });
    i = j + 1;
  }
  return out.sort((a, b) => b.snr - a.snr).slice(0, max);
}

/** Read a typed or spoken frequency ("7074", "7.074 MHz", "7074 kHz") → Hz; a bare number is in `defaultUnit`. */
export function parseFrequency(text, { defaultUnit = 'kHz' } = {}) {
  const m = String(text ?? '').trim().toLowerCase().replace(/,/g, '').match(/^(\d+(?:\.\d+)?)\s*(hz|khz|mhz|ghz|k|m|g)?$/);
  if (!m) return null;
  const v = Number(m[1]), u = m[2] ?? defaultUnit.toLowerCase();
  const k = { hz: 1, khz: 1e3, k: 1e3, mhz: 1e6, m: 1e6, ghz: 1e9, g: 1e9 }[u] ?? 1e3;
  return Math.round(v * k);
}

/** Format Hz for the dial: 7.074 000 MHz style. */
export function formatFrequency(hz) {
  if (hz >= 1e6) { const s = (hz / 1e6).toFixed(6); return `${s.slice(0, -3)} ${s.slice(-3)} MHz`; }
  return `${(hz / 1e3).toFixed(3)} kHz`;
}

/** What is usually heard around a frequency (a broad guide, ITU allocations). */
export function bandName(hz) {
  const B = [[148.5e3, 283.5e3, 'LW BROADCAST'], [526.5e3, 1606.5e3, 'MW BROADCAST'], [1.8e6, 2e6, '160 m AMATEUR'], [3.5e6, 4e6, '80 m AMATEUR'],
    [5.9e6, 6.2e6, '49 m BROADCAST'], [7e6, 7.3e6, '40 m AMATEUR'], [7.2e6, 7.45e6, '41 m BROADCAST'], [9.4e6, 9.9e6, '31 m BROADCAST'], [10.1e6, 10.15e6, '30 m AMATEUR'],
    [11.6e6, 12.1e6, '25 m BROADCAST'], [13.57e6, 13.87e6, '22 m BROADCAST'], [14e6, 14.35e6, '20 m AMATEUR'], [15.1e6, 15.8e6, '19 m BROADCAST'], [17.48e6, 17.9e6, '16 m BROADCAST'],
    [18.068e6, 18.168e6, '17 m AMATEUR'], [21e6, 21.45e6, '15 m AMATEUR'], [24.89e6, 24.99e6, '12 m AMATEUR'], [26.965e6, 27.405e6, 'CB'], [28e6, 29.7e6, '10 m AMATEUR'],
    [87.5e6, 108e6, 'FM BROADCAST'], [108e6, 137e6, 'AIRBAND'], [144e6, 148e6, '2 m AMATEUR'], [156e6, 162.1e6, 'MARINE VHF'], [162.4e6, 162.55e6, 'NOAA WEATHER'],
    [430e6, 440e6, '70 cm AMATEUR'], [446e6, 446.2e6, 'PMR446'], [462.5e6, 467.8e6, 'FRS / GMRS']];
  return B.find(([a, b]) => hz >= a && hz <= b)?.[2] ?? null;
}

/** Suggest a demodulator for a frequency. */
export function suggestMode(hz) {
  if (hz >= 87.5e6 && hz <= 108e6) return 'wbfm';
  if (hz >= 108e6 && hz <= 137e6) return 'am';
  if (hz >= 30e6) return 'nbfm';
  if (hz < 1.7e6) return 'am';
  const n = bandName(hz) ?? '';
  if (/AMATEUR/.test(n)) return hz < 10e6 ? 'lsb' : 'usb';
  return 'am';
}

/**
 * ICY (SHOUTcast) metadata: strip the metadata blocks from a stream and report titles. A stateful
 * splitter: feed it chunks; it returns the audio bytes and calls onTitle when StreamTitle changes.
 */
export function icySplitter(metaint, onTitle) {
  let toAudio = metaint, metaLeft = -1, meta = [];
  return (chunk) => {
    const out = [];
    let i = 0;
    while (i < chunk.length) {
      if (metaLeft < 0 && toAudio > 0) { const n = Math.min(toAudio, chunk.length - i); out.push(chunk.subarray(i, i + n)); i += n; toAudio -= n; continue; }
      if (metaLeft < 0) { metaLeft = chunk[i++] * 16; meta = []; if (metaLeft === 0) { metaLeft = -1; toAudio = metaint; } continue; }
      const n = Math.min(metaLeft, chunk.length - i);
      meta.push(chunk.subarray(i, i + n)); i += n; metaLeft -= n;
      if (metaLeft === 0) {
        const text = td.decode(concat(meta)).replace(/\0+$/, '');
        const t = text.match(/StreamTitle='((?:[^']|'(?!;))*)';/);
        if (t) onTitle?.(t[1].trim());
        metaLeft = -1; toAudio = metaint;
      }
    }
    return concat(out);
  };
}
function concat(parts) {
  if (parts.length === 1) return parts[0];
  const n = parts.reduce((s, p) => s + p.length, 0), out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

/** What a SubSpace station can put on screen: { video: 'mp4'|'image'|'youtube'|null, audio: bool }. */
export function stationMedia(layer, marker) {
  const [, , , href, , extra] = marker;
  if (layer === 'radio') return { video: null, audio: !!extra, stream: extra ?? null };
  if (layer === 'radiogarden') return { video: null, audio: !!extra, stream: extra ?? null, place: marker[6]?.rg ?? null, choices: marker[6]?.n ?? 1 };
  if (layer === 'traffic') {
    if (extra && /\.mp4(\?|$)/i.test(extra)) return { video: 'mp4', src: extra, still: href, audio: false };
    return { video: 'image', src: href, audio: false };
  }
  if (layer === 'windy') return extra ? { video: 'iframe', src: extra, audio: false } : { video: null, audio: false };
  if (layer === 'video') return marker[6]?.youtube ? { video: 'youtube', src: marker[6].youtube, audio: true } : { video: null, audio: false };
  return { video: null, audio: false };
}
