// WebSDR receivers in the main viewer (#69). Pure helpers shared by the backend and the browser.
//
// WebSDR (PA3FWM's software, websdr.org) has no open audio API, and we do not reverse-engineer or
// relay its audio. Instead the operator's own page opens in an iframe, tuned by the URL parameter the
// page itself reads: ?tune=<kHz><mode>, e.g. ?tune=7074usb (websdr-base.js: setfreqtune → set_mode
// for usb / lsb / am / cw / fm, then setfreqif in kHz). Before embedding, the backend checks once
// (cached) whether the page allows framing (X-Frame-Options, CSP frame-ancestors); if not, the
// console links out to the operator's page instead.

/** Our demodulator → the WebSDR mode word. NBFM and WFM both map to the page's "fm". */
export const WEBSDR_MODES = { am: 'am', usb: 'usb', lsb: 'lsb', cw: 'cw', nbfm: 'fm', wbfm: 'fm', fm: 'fm' };

/** "7074usb": frequency in kHz (up to 3 decimals, trailing zeros dropped) and the mode word. */
export function websdrTuneParam({ freqHz, mode = 'am' }) {
  const khz = Math.round(Number(freqHz)) / 1000;
  if (!(khz > 0)) return null;
  return `${Number(khz.toFixed(3))}${WEBSDR_MODES[mode] ?? 'am'}`;
}

/** The operator's page tuned: base URL + ?tune=… (other query parameters kept, a fragment dropped). */
export function websdrTuneUrl(base, { freqHz, mode }) {
  let u;
  try { u = new URL(base); } catch { return null; }
  if (!/^https?:$/.test(u.protocol)) return null;
  const p = websdrTuneParam({ freqHz, mode });
  u.hash = '';
  if (p) u.searchParams.set('tune', p);
  return u.href;
}

/** The receiver's band (from its list entry: { l, h } in MHz) containing a frequency, or null. */
export const websdrBandFor = (bands, freqHz) => (bands ?? []).find((b) => freqHz >= b.l * 1e6 && freqHz <= b.h * 1e6) ?? null;

/**
 * May this page be framed by another site (our http://127.0.0.1 app)? From its response headers
 * ({ name: value }, any case; repeated headers joined with ", "). → { embeddable, reason }.
 *   X-Frame-Options: DENY / SAMEORIGIN / ALLOW-FROM (obsolete, unsupported by browsers: treated as a refusal)
 *   Content-Security-Policy: frame-ancestors — 'none', 'self' or a host list without * refuses us
 * (CSP frame-ancestors overrides X-Frame-Options in browsers; either refusal is enough here.)
 */
export function framingVerdict(headers) {
  const h = {};
  for (const [k, v] of Object.entries(headers ?? {})) h[k.toLowerCase()] = String(v ?? '');
  const csp = (h['content-security-policy'] ?? '').split(/[;,]/).map((d) => d.trim()).find((d) => /^frame-ancestors\b/i.test(d));
  if (csp) {
    const sources = csp.split(/\s+/).slice(1).map((s) => s.toLowerCase());
    const ours = (s) => s === '*' || /^(https?:\/\/)?(127\.0\.0\.1|localhost)(:\d+|:\*)?\/?$/.test(s) || s === 'http:' || s === 'http://*';
    if (!sources.some(ours)) return { embeddable: false, reason: `CSP frame-ancestors ${sources.join(' ') || "'none'"}` };
    return { embeddable: true, reason: `CSP frame-ancestors ${sources.join(' ')}` };
  }
  const xfo = (h['x-frame-options'] ?? '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
  if (xfo.length) {
    if (xfo.includes('DENY')) return { embeddable: false, reason: 'X-Frame-Options DENY' };
    if (xfo.includes('SAMEORIGIN')) return { embeddable: false, reason: 'X-Frame-Options SAMEORIGIN' };
    if (xfo.some((x) => x.startsWith('ALLOW-FROM'))) return { embeddable: false, reason: 'X-Frame-Options ALLOW-FROM' };
  }
  return { embeddable: true, reason: 'no framing restriction' };
}
