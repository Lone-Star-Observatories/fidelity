// A frequency converter in the local SDR's signal path (#69), e.g. a Nooelec Ham It Up: a passive
// receive upconverter with a 125.000 MHz local oscillator that moves HF up into the SDR's range.
// Pure: the setting is { kind: 'none' | 'hamitup' | 'custom', loHz, direction: 'up' | 'down', bypass }.
//
//   up:   the SDR tunes antenna + LO (Ham It Up: 7.074 MHz on the antenna → 132.074 MHz at the SDR)
//   down: the SDR tunes antenna − LO (a downconverter for microwave bands)
// Everything shown is the antenna-side (true) frequency; only the SDR command uses the device frequency.
// Bypass (the Ham It Up's switch) passes the antenna straight through: no conversion.

export const HAM_IT_UP_LO = 125e6;
export const CONVERTER_DEFAULT = { kind: 'none', loHz: HAM_IT_UP_LO, direction: 'up', bypass: false };

/** The setting, filled in and checked. */
export function normalizeConverter(c) {
  const s = { ...CONVERTER_DEFAULT, ...(c ?? {}) };
  if (!['none', 'hamitup', 'custom'].includes(s.kind)) s.kind = 'none';
  if (s.kind === 'hamitup') { s.loHz = HAM_IT_UP_LO; s.direction = 'up'; }
  s.loHz = Number(s.loHz) > 0 ? Math.round(Number(s.loHz)) : HAM_IT_UP_LO;
  s.direction = s.direction === 'down' ? 'down' : 'up';
  s.bypass = s.bypass === true;
  return s;
}
/** Is a converter in the path and converting (configured, not bypassed)? */
export const converting = (c) => { const s = normalizeConverter(c); return s.kind !== 'none' && !s.bypass; };
/** Antenna-side frequency → the frequency the SDR must tune. */
export function toDeviceHz(antennaHz, c) {
  if (!converting(c)) return antennaHz;
  const s = normalizeConverter(c);
  return s.direction === 'up' ? antennaHz + s.loHz : antennaHz - s.loHz;
}
/** SDR frequency → antenna-side frequency. */
export function toAntennaHz(deviceHz, c) {
  if (!converting(c)) return deviceHz;
  const s = normalizeConverter(c);
  return s.direction === 'up' ? deviceHz - s.loHz : deviceHz + s.loHz;
}
/** The SDR's tuning range [lo, hi] seen from the antenna (never below 0). */
export function antennaRange([lo, hi], c) {
  return [Math.max(0, toAntennaHz(lo, c)), Math.max(0, toAntennaHz(hi, c))];
}
/** "HAM IT UP · LO 125.000 MHz ↑" / "… · BYPASS" / null for none. */
export function converterLabel(c) {
  const s = normalizeConverter(c);
  if (s.kind === 'none') return null;
  const name = s.kind === 'hamitup' ? 'HAM IT UP' : 'CONVERTER';
  return s.bypass ? `${name} · BYPASS` : `${name} · LO ${(s.loHz / 1e6).toFixed(3)} MHz ${s.direction === 'up' ? 'UP' : 'DOWN'}`;
}

/** The refusal when a converter would be driven backwards by the transmitter. */
export const CONVERTER_TX_REASON = 'TX through the Ham It Up is not supported: set it to BYPASS or connect the transmitter directly. HF transmit needs a proper transverter and low-pass filter.';
/**
 * May the transmitter feed this signal path? A receive converter (a passive mixer) driven backwards
 * radiates its LO feedthrough, the image and mixing products unfiltered (FCC §97.307 spurious
 * limits) and can be damaged. { ok } or { ok: false, reason }.
 */
export function converterAllowsTx(c) {
  if (!converting(c)) return { ok: true };
  const s = normalizeConverter(c);
  return { ok: false, reason: s.kind === 'hamitup' ? CONVERTER_TX_REASON : CONVERTER_TX_REASON.replace('the Ham It Up', 'a receive converter').replace('set it to BYPASS', 'bypass it') };
}
