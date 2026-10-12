// COMMS transmission (#69): the rules a hailing frequency must pass before anything is keyed.
// Pure (no DOM, no Node APIs): the browser uses it to explain a refusal, the backend
// (server/tx.js) enforces it again before it starts a transmitter.
//
//   Band plan: amateur allocations only, by ITU region (Region 2 default). 2 m and 70 cm.
//   Mode: narrowband FM, ±2.5 kHz peak deviation, audio 300–3000 Hz. Carson's rule gives the
//     occupied bandwidth: 2 × (2.5 kHz + 3.0 kHz) = 11 kHz, i.e. the usual "≈10 kHz" NFM channel
//     (the measured 99 % power bandwidth of speech-like audio is under that; tests/tx.test.js).
//   Signal path: no receive converter (Ham It Up) in line unless it is bypassed (src/data/converter.js).
//   Antenna: the operator's antenna list (name, bands, directional); the one in use must be marked
//     for the band of the requested frequency.
//   Licence: the operator's own callsign and an attestation that they are licensed for the band
//     where they are. This app cannot verify a licence; it refuses to transmit without one.
//   Station ID: the callsign in Morse (CW, 20 wpm, 800 Hz tone, sent as FM) at the end of every
//     transmission and at least every 10 minutes during one (FCC §97.119 and its equivalents).

import { converterAllowsTx } from './converter.js';

export const TX = {
  audioRate: 16000,       // mic audio the browser sends (Int16 mono)
  iqRate: 2_000_000,      // IQ samples per second to the SDR (HackRF's lowest well-filtered rate)
  deviationHz: 2500,      // narrowband FM peak deviation
  audioLoHz: 300,
  audioHiHz: 3000,
  get carsonHz() { return 2 * (this.deviationHz + this.audioHiHz); }, // 11 kHz
  idIntervalMs: 10 * 60 * 1000,
  defaultTimeoutS: 180,
  minTimeoutS: 30,
  maxTimeoutS: 1800,      // 30 min: long enough that the 10-minute periodic ID matters
  defaultGainDb: 0,       // lowest: HackRF TX VGA 0 dB with the RF amp off
  maxGainDb: 20,          // cap on the operator's setting (HackRF TX VGA allows 47; the amp is never enabled)
  cwWpm: 20,
  cwToneHz: 800,
};

/** Amateur allocations a hailing frequency may use, per ITU region (MHz edges). */
export const BAND_PLANS = {
  1: [{ name: '2 m', lo: 144e6, hi: 146e6 }, { name: '70 cm', lo: 430e6, hi: 440e6 }],
  2: [{ name: '2 m', lo: 144e6, hi: 148e6 }, { name: '70 cm', lo: 420e6, hi: 450e6 }],
  3: [{ name: '2 m', lo: 144e6, hi: 148e6 }, { name: '70 cm', lo: 430e6, hi: 440e6 }],
};
// Segments the voluntary band plans keep free of FM voice (weak-signal CW/SSB, satellites). Not
// refused (the allocation allows it) but the operator is told.
const QUIET = {
  1: [[144.0e6, 144.4e6, 'the CW/SSB weak-signal segment'], [145.8e6, 146.0e6, 'the satellite segment'], [432.0e6, 432.4e6, 'the weak-signal segment'], [435.0e6, 438.0e6, 'the satellite segment']],
  2: [[144.0e6, 144.3e6, 'the CW/SSB weak-signal segment'], [145.8e6, 146.0e6, 'the satellite segment'], [432.0e6, 432.3e6, 'the weak-signal segment'], [435.0e6, 438.0e6, 'the satellite segment']],
  3: [[144.0e6, 144.3e6, 'the CW/SSB weak-signal segment'], [145.8e6, 146.0e6, 'the satellite segment'], [432.0e6, 432.3e6, 'the weak-signal segment'], [435.0e6, 438.0e6, 'the satellite segment']],
};
export const regionOf = (r) => (BAND_PLANS[Number(r)] ? Number(r) : 2);
const mhz = (hz) => (hz / 1e6).toFixed(3).replace(/\.?0+$/, '');
/** "144–148 MHz (2 m), 420–450 MHz (70 cm)" */
export const formatBands = (region = 2) => BAND_PLANS[regionOf(region)].map((b) => `${mhz(b.lo)}–${mhz(b.hi)} MHz (${b.name})`).join(', ');

/**
 * A hailing frequency as typed or spoken: three digits 100–999 are MHz ("146" → 146.000 MHz),
 * decimals allowed ("146.52", "146 point 52", "146.520 MHz"). Anything else → null.
 */
export function parseHailingFrequency(text) {
  const t = String(text ?? '').toLowerCase().replace(/mega ?hertz|mhz/g, '').replace(/\s+point\s+/g, '.').replace(/[\s,]+/g, '');
  const m = t.match(/^(\d{3})(?:\.(\d{1,6}))?$/);
  if (!m) return null;
  const v = Number(`${m[1]}.${m[2] ?? '0'}`);
  return v >= 100 && v < 1000 ? Math.round(v * 1e6) : null;
}

/** Is an FM signal centred on `hz` (half its occupied bandwidth either side) inside an amateur allocation? */
export function checkBand(hz, region = 2) {
  const r = regionOf(region), half = TX.carsonHz / 2;
  if (!Number.isFinite(hz)) return { ok: false, reason: `I did not catch the frequency. Allowed in ITU Region ${r}: ${formatBands(r)}.` };
  const band = BAND_PLANS[r].find((b) => hz >= b.lo && hz <= b.hi);
  if (!band) return { ok: false, reason: `${mhz(hz)} MHz is outside the amateur bands I may transmit on. Allowed in ITU Region ${r}: ${formatBands(r)}.` };
  if (hz - half < band.lo || hz + half > band.hi) return { ok: false, reason: `${(hz / 1e6).toFixed(3)} MHz is too close to the ${band.name} band edge: an FM signal ${TX.carsonHz / 1000} kHz wide would spill outside ${mhz(band.lo)}–${mhz(band.hi)} MHz.` };
  const q = QUIET[r].find(([lo, hi]) => hz + half > lo && hz - half < hi);
  return { ok: true, band, note: q ? `${(hz / 1e6).toFixed(3)} MHz is in ${q[2]} of the usual ${band.name} band plan; FM voice normally goes elsewhere.` : null };
}

/** Upper-case, trimmed callsign. */
export const normalizeCallsign = (s) => String(s ?? '').trim().toUpperCase();
/**
 * Plausible amateur callsign (ITU form: prefix, a digit, a suffix ending in a letter; optional
 * "/P"-style portable parts): W1AW, G4ABC, VK2XYZ, 2E0ABC, 3DA0RS, DL/W1AW, M0ABC/P. Not a licence check.
 */
export function validCallsign(s) {
  const c = normalizeCallsign(s), m = c.match(/^(?:[A-Z0-9]{1,4}\/)?([A-Z0-9]{1,3}[0-9][A-Z0-9]{0,3}[A-Z])(?:\/[A-Z0-9]{1,4})?$/);
  return !!m && /[A-Z]/.test(m[1].slice(0, -1));
}

/**
 * May this transmission start? Checks in order: a transmit-capable device with its tool, no receive
 * converter in the path (unless bypassed), the operator's callsign, the licence attestation, the band
 * plan, the device's own tuning range, the antenna in use. The first ready device is used (bladeRF is listed first).
 * { ok, device, band, note } or { ok: false, code, reason }.
 */
export function txGate({ devices = [], driver = null, callsign, attested, freqHz, region = 2, converter = null, antennas = [], antennaId = null } = {}) {
  const usable = devices.filter((d) => d.ready);
  const device = usable.find((d) => !driver || d.driver === driver) ?? null;
  if (!devices.length) return { ok: false, code: 'no-device', reason: 'No transmit-capable SDR is connected (a HackRF One or bladeRF; an RTL-SDR only receives). Nothing can transmit.' };
  if (!device) return { ok: false, code: 'no-tool', reason: devices[0].note ?? 'The transmit tool for this SDR is not installed (bladeRF-cli or hackrf_transfer).' };
  const conv = converterAllowsTx(converter);
  if (!conv.ok) return { ok: false, code: 'converter', reason: conv.reason };
  if (!normalizeCallsign(callsign)) return { ok: false, code: 'no-callsign', reason: 'Transmitting needs an amateur radio licence: enter your callsign in TRANSMIT SETUP (COMMS, RF) first.' };
  if (!validCallsign(callsign)) return { ok: false, code: 'bad-callsign', reason: `${normalizeCallsign(callsign)} does not look like an amateur callsign. Check TRANSMIT SETUP.` };
  if (attested !== true) return { ok: false, code: 'no-attestation', reason: `Tick the licence attestation in TRANSMIT SETUP: ${normalizeCallsign(callsign)} must hold a licence valid for this band where you are.` };
  const b = checkBand(freqHz, region);
  if (!b.ok) return { ok: false, code: 'out-of-band', reason: b.reason };
  const [lo, hi] = device.rangeHz ?? [0, Infinity];
  if (freqHz < lo || freqHz > hi) return { ok: false, code: 'device-range', reason: `The ${device.label} tunes ${mhz(lo)}–${mhz(hi)} MHz, so it cannot transmit on ${(freqHz / 1e6).toFixed(3)} MHz.${device.driver === 'bladerf' && lo >= 300e6 ? ' 2 m on a bladeRF x40/x115 needs the XB-200 transverter board.' : ''}` };
  const ant = antennaCheck({ antennas, antennaId, freqHz, region });
  if (!ant.ok) return ant;
  return { ok: true, device, band: b.band, note: b.note, antenna: ant.antenna };
}

// ---- antennas ---------------------------------------------------------------------------------------
/** Band keys an antenna can be marked for. No key at all = unknown (never transmits). */
export const ANTENNA_BANDS = [['2m', '2 m'], ['70cm', '70 cm'], ['hf-rx', 'HF receive only']];
/** The owner's antennas as editable defaults (settings.txSetup.antennas). */
export const DEFAULT_ANTENNAS = [
  { id: 'arrow', name: 'Arrow (dual-band Yagi)', bands: ['2m', '70cm'], directional: true },
  { id: 'small-arrow', name: 'Small arrow', bands: [], directional: true },
  { id: 'donut', name: 'Donut', bands: [], directional: false },
  { id: 'loop', name: 'Small loop', bands: ['hf-rx'], directional: false },
  { id: 'wire', name: 'Wire', bands: ['hf-rx'], directional: false },
];
/** '2 m' (a band plan name) → '2m' (an antenna band key). */
export const bandKey = (name) => String(name).replace(/\s+/g, '');
/** "2 m and 70 cm" / "HF receive only" / "an unknown band" */
export function describeAntennaBands(bands = []) {
  const tx = ANTENNA_BANDS.filter(([k]) => k !== 'hf-rx' && bands.includes(k)).map(([, l]) => l);
  if (tx.length) return tx.join(' and ') + (bands.includes('hf-rx') ? ' (and HF receive)' : '');
  return bands.includes('hf-rx') ? 'HF receive only' : 'an unknown band (mark its bands in TRANSMIT SETUP)';
}
/**
 * Is the antenna in use marked for the band of `freqHz`? { ok, antenna } or { ok: false, code, reason },
 * the reason naming the selected antenna, what it covers, and an antenna from the list that would do.
 */
export function antennaCheck({ antennas = [], antennaId = null, freqHz, region = 2 }) {
  const band = BAND_PLANS[regionOf(region)].find((b) => freqHz >= b.lo && freqHz <= b.hi);
  const a = antennas.find((x) => x.id === antennaId);
  const fit = band && antennas.find((x) => (x.bands ?? []).includes(bandKey(band.name)));
  const suggest = !band ? '' : fit ? ` Select the ${fit.name} for ${mhz(freqHz)} MHz.` : ` No antenna in your list is marked for ${band.name}: mark one in TRANSMIT SETUP.`;
  if (!a) return { ok: false, code: 'no-antenna', reason: `Unable to comply: select the antenna in use in TRANSMIT SETUP.${suggest}` };
  if (!band || !(a.bands ?? []).includes(bandKey(band.name))) return { ok: false, code: 'antenna', reason: `Unable to comply: the ${a.name} is set for ${describeAntennaBands(a.bands)}.${suggest}` };
  return { ok: true, antenna: a };
}

/** Clamp the operator's TX gain and timeout to the safe ranges. */
export const clampGain = (g) => Math.max(0, Math.min(TX.maxGainDb, Math.round(Number(g) || 0)));
export const clampTimeoutS = (s) => Math.max(TX.minTimeoutS, Math.min(TX.maxTimeoutS, Math.round(Number(s) || TX.defaultTimeoutS)));

/**
 * The transmit clock: how long it has run, how long until the timeout, and whether a station ID
 * is due. Times in ms.
 */
export function txClock({ startedAt, lastIdAt = startedAt, timeoutMs, now }) {
  const elapsedMs = Math.max(0, now - startedAt);
  return { elapsedMs, remainingMs: Math.max(0, timeoutMs - elapsedMs), timedOut: elapsedMs >= timeoutMs, idDue: now - lastIdAt >= TX.idIntervalMs };
}

// ---- Morse (station ID) ----------------------------------------------------------------------------
export const MORSE = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..', M: '--',
  N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
  0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-', 5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.', '/': '-..-.',
};
/** Dot length in ms at `wpm` (PARIS standard: 50 units per word). */
export const dotMs = (wpm = TX.cwWpm) => 1200 / wpm;
/**
 * Keying of a text as [on, units] runs: dot 1, dash 3, gap inside a letter 1, between letters 3,
 * between words 7 (a trailing word gap ends the message, as in the PARIS timing standard).
 */
export function cwKeying(text) {
  const out = [], words = normalizeCallsign(text).split(/\s+/).filter(Boolean);
  const off = (u) => { if (out.length && !out.at(-1)[0]) out.at(-1)[1] = Math.max(out.at(-1)[1], u); else out.push([false, u]); };
  words.forEach((w) => {
    [...w].forEach((ch) => {
      const code = MORSE[ch];
      if (!code) return;
      [...code].forEach((s) => { out.push([true, s === '.' ? 1 : 3]); off(1); });
      off(3);
    });
    off(7);
  });
  return out;
}
/** Total units of a keying. */
export const cwUnits = (keying) => keying.reduce((n, [, u]) => n + u, 0);

/**
 * The CW ID as audio: an 800 Hz tone keyed at 20 wpm, with 5 ms raised-cosine edges so the keying
 * does not click. Float32 at `rate`, peak `level`.
 */
export function cwAudio(text, { wpm = TX.cwWpm, toneHz = TX.cwToneHz, rate = TX.audioRate, level = 0.6, rampMs = 5 } = {}) {
  const keying = cwKeying(text), unit = (dotMs(wpm) / 1000) * rate, n = Math.round(cwUnits(keying) * unit);
  const out = new Float32Array(n), ramp = Math.max(1, Math.round((rampMs / 1000) * rate));
  let pos = 0;
  for (const [on, u] of keying) {
    const len = Math.round((pos + u * unit)) - Math.round(pos), s0 = Math.round(pos);
    if (on) for (let i = 0; i < len && s0 + i < n; i++) {
      const edge = Math.min(i, len - 1 - i), env = edge < ramp ? 0.5 - 0.5 * Math.cos((Math.PI * edge) / ramp) : 1;
      out[s0 + i] = level * env * Math.sin((2 * Math.PI * toneHz * (s0 + i)) / rate);
    }
    pos += u * unit;
  }
  return out;
}
