// The spectrum control's transmission curve (#66): T(λ) ∈ [0, 1] from gamma rays to radio.
//
//   A curve is { full?: true, parts: [part…], excl: [range…] }:
//     part  { key, pass: '<bandpass id>' | 'eye', t? }   an instrument filter (src/data/bands.js) or
//                                                         the CIE 1924 photopic eye, scaled by t;
//           { key, lo, hi, t?, label?, band? }           a window lo–hi nm with transmission t;
//     range { key, lo, hi, label? }                      excluded: T = 0 there, whatever the parts say.
//   T(λ) = max over parts of t·F(λ), then 0 inside every excluded range (union of windows, minus
//   exclusions). FULL SPECTRUM is the ordinary view, not a curve that passes everything.
//
//   Integrals over the curve are in log wavelength (dλ/λ: every octave counts the same), the measure
//   the axis is drawn in; overlap weights, band shares and measured/predicted fractions all use it.
//   The old single-bandpass results are reproduced exactly: a curve that is one bandpass at full
//   transmission canonicalises to that band and pass (canonical()), and compose() returns the pass's
//   own filter.

import { BANDS } from './bands.js';
import { effectiveNm } from '../astro/bands.js';

/** The control's axis: 10⁻⁶ nm (1 fm, ~1 GeV) to 10 m (30 MHz). */
export const AXIS = [1e-6, 1e10];
/** Conventional band boundaries on the axis (nm). The app's X-RAY band includes the EUV (SDO 94–335 Å). */
export const BAND_RANGES = [
  { id: 'gamma', label: 'GAMMA', lo: 1e-6, hi: 5e-3 },
  { id: 'xray', label: 'X-RAY / EUV', lo: 5e-3, hi: 100 },
  { id: 'uv', label: 'ULTRAVIOLET', lo: 100, hi: 380 },
  { id: 'visible', label: 'VISIBLE', lo: 380, hi: 700 },
  { id: 'ir', label: 'INFRARED', lo: 700, hi: 1e6 },
  { id: 'microwave', label: 'MICROWAVE', lo: 1e6, hi: 3e7 },
  { id: 'radio', label: 'RADIO', lo: 3e7, hi: 1e10 },
];
export const bandRange = (id) => BAND_RANGES.find((b) => b.id === id) ?? null;
const PALETTE_OF = { radio: 'radio', microwave: 'microwave', ir: 'infrared', visible: 'visible', uv: 'ultraviolet', xray: 'xray', gamma: 'gamma' };
export const paletteOfBand = (id) => PALETTE_OF[id] ?? 'visible';

// CIE 1924 photopic luminosity function V(λ) (the CIE standard table), 380–780 nm.
const V_LAMBDA = [[380, 0.000039], [390, 0.00012], [400, 0.000396], [410, 0.00121], [420, 0.004], [430, 0.0116], [440, 0.023], [450, 0.038], [460, 0.06],
  [470, 0.09098], [480, 0.13902], [490, 0.208], [500, 0.323], [510, 0.503], [520, 0.71], [530, 0.862], [540, 0.954], [550, 0.99495], [555, 1], [560, 0.995],
  [570, 0.952], [580, 0.87], [590, 0.757], [600, 0.631], [610, 0.503], [620, 0.381], [630, 0.265], [640, 0.175], [650, 0.107], [660, 0.061], [670, 0.032],
  [680, 0.017], [690, 0.00821], [700, 0.004102], [710, 0.002091], [720, 0.001047], [730, 0.00052], [740, 0.000249], [750, 0.00012], [760, 0.00006], [770, 0.00003], [780, 0.000015]];
export const EYE = { id: 'eye', label: 'HUMAN EYE (CIE PHOTOPIC)', filter: { points: V_LAMBDA } };

const PASSES = new Map(BANDS.flatMap((b) => b.passes.map((p) => [p.id, { band: b, pass: p }])));
/** { band, pass } for a bandpass id ('eye' gives the eye with no band). */
export const passInfo = (id) => (id === 'eye' ? { band: null, pass: EYE } : PASSES.get(id) ?? null);

// ---- piecewise-linear filters ---------------------------------------------------------------
/** T at `nm` of a filter { points: [[nm, T], …] } (linear between points, 0 outside). */
export function evalT(f, nm) {
  const p = f.points, n = p.length;
  if (!n || nm < p[0][0] || nm > p[n - 1][0]) return 0;
  let a = 0, b = n - 1;
  while (b - a > 1) { const m = (a + b) >> 1; if (p[m][0] <= nm) a = m; else b = m; }
  const [l0, t0] = p[a], [l1, t1] = p[b];
  return l1 === l0 ? Math.max(t0, t1) : t0 + ((t1 - t0) * (nm - l0)) / (l1 - l0);
}
/** Where a filter passes more than `frac` of its peak: [lo, hi] nm, or null. */
export function support(f, frac = 0.01) {
  const p = f?.points ?? [];
  const peak = Math.max(0, ...p.map((x) => x[1]));
  if (!(peak > 0)) return null;
  const on = p.filter((x) => x[1] >= peak * frac);
  return [on[0][0], on.at(-1)[0]];
}
const EDGE = 1e-6; // window edges are this steep (relative), so every filter stays piecewise linear
const win = (lo, hi, t = 1) => ({ points: [[lo * (1 - EDGE), 0], [lo, t], [hi, t], [hi * (1 + EDGE), 0]] });
/** A part's own filter (scaled by its transmission), or null. */
export function partFilter(part) {
  const t = Math.max(0, Math.min(1, part.t ?? 1));
  if (part.pass) {
    const f = passInfo(part.pass)?.pass.filter;
    if (!f) return null;
    return t === 1 ? f : { points: f.points.map(([l, v]) => [l, v * t]) };
  }
  if (part.lo > 0 && part.hi > part.lo) return win(part.lo, part.hi, t);
  return null;
}

/** Normalise a stored curve (settings, Computer, tests): drop broken parts, fix order. */
export function normCurve(c) {
  if (!c || typeof c !== 'object' || c.full) return { full: true, parts: [], excl: [] };
  const fix = (x) => (x.lo > x.hi ? { ...x, lo: x.hi, hi: x.lo } : x);
  const parts = (Array.isArray(c.parts) ? c.parts : []).map(fix).filter((p) => partFilter(p));
  const excl = (Array.isArray(c.excl) ? c.excl : []).map(fix).filter((r) => r.lo > 0 && r.hi > r.lo);
  return { parts, excl };
}
export const FULL = Object.freeze({ full: true, parts: [], excl: [] });

/** The curve as one filter { points } (union of the parts by max, zero inside exclusions). */
export function compose(curve) {
  const c = normCurve(curve);
  if (c.full) return null;
  const fs = c.parts.map(partFilter).filter(Boolean);
  if (fs.length === 1 && !c.excl.length && (c.parts[0].t ?? 1) === 1) return fs[0]; // exact: one bandpass as it is
  return union(fs, c.excl);
}
/** max(f₁, f₂, …)(λ) as one filter, zero inside the `excl` ranges ([{ lo, hi }]). */
export function union(fs, excl = []) {
  const xs = new Set();
  for (const f of fs) for (const l of breaks(f)) xs.add(l);
  for (const r of excl) { xs.add(r.lo * (1 - EDGE)); xs.add(r.lo); xs.add(r.hi); xs.add(r.hi * (1 + EDGE)); }
  const sorted = [...xs].sort((a, b) => a - b);
  const inExcl = (l) => excl.some((r) => l >= r.lo && l <= r.hi);
  const raw = sorted.map((l) => [l, inExcl(l) ? 0 : Math.max(0, ...fs.map((f) => evalT(f, l)))]);
  // drop the inside of zero runs (keep the zeros that bound a non-zero stretch)
  const points = raw.filter((p, i) => p[1] > 0 || (raw[i - 1]?.[1] > 0) || (raw[i + 1]?.[1] > 0));
  return { points };
}
/** A filter's breakpoints plus just outside its ends (top-hats end at T = 1, then drop to 0). */
export function breaks(f) {
  const p = f.points;
  return p.length ? [p[0][0] * (1 - EDGE), ...p.map((x) => x[0]), p.at(-1)[0] * (1 + EDGE)] : [];
}
/** A filter scaled to peak 1. */
export function normalised(f) {
  const peak = Math.max(0, ...f.points.map((p) => p[1]));
  return peak > 0 && peak !== 1 ? { points: f.points.map(([l, v]) => [l, v / peak]) } : f;
}
/**
 * max(0, T(λ) − R(λ)): what of curve `f` a coverage `r` (peak 1) leaves uncovered. The covered part is
 * min(T, R), so a curve equal to an instrument's filter is fully covered by that instrument's map.
 */
export function remainder(f, r) {
  if (!r) return f;
  const lo = f.points[0][0], hi = f.points.at(-1)[0];
  const xs = [...new Set([...f.points.map((p) => p[0]), ...breaks(r).filter((l) => l >= lo && l <= hi)])].sort((a, b) => a - b);
  const vals = xs.map((l) => [l, evalT(f, l), evalT(r, l)]), pts = [];
  // add the crossings of T and R, so max(0, T − R) stays piecewise linear between points
  for (let i = 0; i < vals.length; i++) {
    if (i) {
      const [l0, t0, r0] = vals[i - 1], [l1, t1, r1] = vals[i], d0 = t0 - r0, d1 = t1 - r1;
      if (d0 * d1 < 0) pts.push([l0 + ((l1 - l0) * d0) / (d0 - d1), 0]);
    }
    pts.push([vals[i][0], Math.max(0, vals[i][1] - vals[i][2])]);
  }
  return pts.some((p) => p[1] > 1e-9) ? { points: pts } : null;
}
/** ∫ min(T, R) dlnλ / ∫ T dlnλ: the fraction of curve `f` covered by `r` (0…1). */
export function coveredFraction(f, r) {
  const tot = logIntegral([f]);
  if (!r || !(tot > 0)) return 0;
  const rest = remainder(f, r);
  return Math.max(0, Math.min(1, 1 - (rest ? logIntegral([rest]) : 0) / tot));
}
/** A top-hat window lo–hi nm with steep edges. */
export const windowFilter = (lo, hi, t = 1) => win(lo, hi, t);
/** T(λ) of a curve (1 everywhere in FULL SPECTRUM). */
export const transmission = (curve, nm) => { const f = compose(curve); return f ? evalT(f, nm) : 1; };

// ---- integrals in log wavelength --------------------------------------------------------------
/**
 * ∫ Π fᵢ(λ) dλ/λ over [lo, hi] for piecewise-linear filters (and optional plain functions `extra`),
 * with Simpson's rule in ln λ on every interval between their breakpoints (geometrically subdivided).
 */
export function logIntegral(filters, lo = AXIS[0], hi = AXIS[1], extra = null) {
  let a = lo, b = hi;
  for (const f of filters) { const p = f.points; if (!p.length) return 0; a = Math.max(a, p[0][0]); b = Math.min(b, p.at(-1)[0]); }
  if (!(b > a)) return 0;
  const xs = new Set([a, b]);
  for (const f of filters) for (const l of breaks(f)) if (l > a && l < b) xs.add(l);
  const s = [...xs].sort((x, y) => x - y);
  const val = (l) => { let v = 1; for (const f of filters) { v *= evalT(f, l); if (!v) return 0; } return extra ? v * extra(l) : v; };
  let sum = 0;
  for (let i = 1; i < s.length; i++) {
    const u0 = Math.log(s[i - 1]), u1 = Math.log(s[i]), du = u1 - u0;
    if (!(du > 0)) continue;
    const m = Math.min(400, Math.max(1, Math.ceil(du / 0.05))), h = du / m;
    for (let k = 0; k < m; k++) {
      const x0 = u0 + k * h, x1 = x0 + h, xm = x0 + h / 2;
      // pull the ends just inside the interval so a step edge counts once
      const y0 = val(Math.exp(x0) * (k === 0 ? 1 + 1e-12 : 1)), y1 = val(Math.exp(x1) * (k === m - 1 ? 1 - 1e-12 : 1)), ym = val(Math.exp(xm));
      sum += (h / 6) * (y0 + 4 * ym + y1);
    }
  }
  return sum;
}
/** Restrict a filter to [lo, hi] nm (steep edges), or null when nothing is left. */
export function clip(f, lo, hi) {
  if (!f) return null;
  const pts = [];
  const inside = f.points.filter(([l]) => l > lo && l < hi);
  const tl = evalT(f, lo), th = evalT(f, hi);
  if (tl > 0) pts.push([lo * (1 - EDGE), 0], [lo, tl]);
  pts.push(...inside);
  if (th > 0) pts.push([hi, th], [hi * (1 + EDGE), 0]);
  if (!pts.some((p) => p[1] > 0)) return null;
  return { points: pts };
}
/** T(λ)·w(λ) as a new filter on T's breakpoints (w a filter: multiplied; densified where w varies). */
export function multiply(f, w) {
  const xs = new Set();
  for (const [l] of f.points) xs.add(l);
  for (const l of breaks(w)) if (l >= f.points[0][0] && l <= f.points.at(-1)[0]) xs.add(l);
  const s = [...xs].sort((a, b) => a - b);
  const pts = s.map((l) => [l, evalT(f, l) * evalT(w, l)]);
  return pts.some((p) => p[1] > 0) ? { points: pts } : null;
}

// ---- describing a curve --------------------------------------------------------------------
/** Share of ∫T dlnλ in each conventional band: [{ id, label, share }] (largest first). */
export function bandShares(f) {
  const tot = logIntegral([f]);
  if (!(tot > 0)) return [];
  return BAND_RANGES.map((b) => ({ id: b.id, label: b.label, share: logIntegral([f], b.lo, b.hi) / tot }))
    .filter((x) => x.share >= 0.005).sort((a, b) => b.share - a.share);
}
/** Geometric centre exp(∫T lnλ dlnλ / ∫T dlnλ) (nm): the middle of the curve on the log axis. */
export function logCentreNm(f) {
  const tot = logIntegral([f]);
  return tot > 0 ? Math.exp(logIntegral([f], AXIS[0], AXIS[1], Math.log) / tot) : 0;
}
/** Equivalent width ∫T dλ / max T (nm). */
export function equivalentWidthNm(f) {
  const p = f.points, peak = Math.max(...p.map((x) => x[1]));
  let s = 0;
  for (let i = 1; i < p.length; i++) s += 0.5 * (p[i][0] - p[i - 1][0]) * (p[i][1] + p[i - 1][1]);
  return peak > 0 ? s / peak : 0;
}
/**
 * Wide curves are shown as a three-band false-colour composite: the log range of the curve's support
 * split into thirds, short → blue, middle → green, long → red. Wide means: at least two bands with
 * 10% of the curve each, or more than a factor 3 in wavelength (where T > 10% of its peak), or in the
 * visible more than a factor 1.33 (the eye, a visible window: a natural-colour composite; one
 * broadband filter such as Johnson V stays monochrome). Narrow curves keep their band's palette.
 */
export const COMPOSITE_RGB = [[0, 0, 1], [0, 1, 0], [1, 0, 0]]; // blue, green, red: a classic three-filter composite
export function isComposite(f) {
  const s = support(f, 0.1);
  if (!s) return false;
  const shares = bandShares(f), r = s[1] / s[0];
  return shares.filter((x) => x.share >= 0.1).length >= 2 || r >= 3 || (shares[0]?.id === 'visible' && r >= 1.33);
}
/** The composite's thirds: [[lo, hi] blue, [lo, hi] green, [lo, hi] red] in nm. */
export function thirds(f) {
  const [lo, hi] = support(f) ?? [500, 600], a = Math.log(lo), d = (Math.log(hi) - a) / 3;
  return [0, 1, 2].map((k) => [Math.exp(a + k * d), Math.exp(a + (k + 1) * d)]);
}
/**
 * Composite hue of `g` (a part of curve `f` with thirds `th`), white-balanced like an RGB composite: in
 * each third k, a_k = (∫g / ∫f over the third) · b(k) (b: the body's relative brightness there, 1 by
 * default), and hue = Σ a_k·RGB_k / Σ RGB_k over the thirds `f` passes, scaled to max channel 1. Something
 * equally bright through the whole curve is white; a red Mars stays red.
 */
export function compositeHue(g, f, th, b = () => 1) {
  const rgb = [0, 0, 0], ref = [0, 0, 0];
  th.forEach(([lo, hi], k) => {
    const sf = logIntegral([f], lo, hi);
    if (!(sf > 0)) return;
    const a = (g ? logIntegral([g], lo, hi) / sf : 0) * b(k);
    for (let c = 0; c < 3; c++) { rgb[c] += a * COMPOSITE_RGB[k][c]; ref[c] += COMPOSITE_RGB[k][c]; }
  });
  const out = rgb.map((x, c) => (ref[c] > 0 ? x / ref[c] : 0)), m = Math.max(...out);
  return m > 0 ? out.map((x) => x / m) : [1, 1, 1];
}
/** How a curve maps onto the app: FULL, exactly one bandpass (the old behaviour), or custom. */
export function canonical(curve) {
  const c = normCurve(curve);
  if (c.full) return { kind: 'full' };
  if (c.parts.length === 1 && c.parts[0].pass && c.parts[0].pass !== 'eye' && (c.parts[0].t ?? 1) === 1 && !c.excl.length) {
    const info = passInfo(c.parts[0].pass);
    if (info) return { kind: 'pass', band: info.band, pass: info.pass };
  }
  return { kind: 'custom' };
}
/** Old settings (band, bandPass) as a curve: FULL, or the band's chosen (default) bandpass. */
export function curveFromLegacy(bandId, passId) {
  const b = BANDS.find((x) => x.id === bandId);
  if (!b || b.id === 'full' || !b.passes.length) return { full: true, parts: [], excl: [] };
  const p = b.passes.find((x) => x.id === passId) ?? b.passes[0];
  return { parts: [{ key: `pass:${p.id}`, pass: p.id }], excl: [] };
}
/** One-click presets: FULL SPECTRUM, the human eye, each band (a window over its range), and every bandpass. */
export const presetFull = () => ({ full: true, parts: [], excl: [] });
export const presetEye = () => ({ parts: [{ key: 'pass:eye', pass: 'eye' }], excl: [] });
export const presetBand = (id) => { const r = bandRange(id); return { parts: [{ key: `band:${id}`, lo: r.lo, hi: r.hi, band: id, label: r.label }], excl: [] }; };
export const presetPass = (id) => ({ parts: [{ key: `pass:${id}`, pass: id }], excl: [] });

// ---- units --------------------------------------------------------------------------------
const C_NM_HZ = 299792458e9; // ν(Hz) = c / λ
const HC_EV_NM = 1239.841984; // E(eV) = hc / λ
const num = (x, d = 3) => { const s = Number(x.toPrecision(d)); return Math.abs(s) >= 1e4 || (Math.abs(s) < 1e-3 && s) ? s.toExponential(1).replace('e+', 'e') : String(s); };
/** A wavelength in its natural unit: pm, nm, µm, mm, cm, m. */
export function fmtWave(nm) {
  if (!(nm > 0)) return '—';
  if (nm < 1e-4) return `${num(nm * 1e6)} fm`;
  if (nm < 1e-3) return `${num(nm * 1e3)} pm`;
  if (nm < 1e3) return `${num(nm)} nm`;
  if (nm < 1e6) return `${num(nm / 1e3)} µm`;
  if (nm < 1e7) return `${num(nm / 1e6)} mm`;
  if (nm < 1e9) return `${num(nm / 1e7)} cm`;
  return `${num(nm / 1e9)} m`;
}
export function fmtFreq(nm) {
  const v = C_NM_HZ / nm, U = [[1e18, 'EHz'], [1e15, 'PHz'], [1e12, 'THz'], [1e9, 'GHz'], [1e6, 'MHz'], [1e3, 'kHz'], [1, 'Hz']];
  const [k, u] = U.find(([x]) => v >= x) ?? U.at(-1);
  return `${num(v / k)} ${u}`;
}
export function fmtEnergy(nm) {
  const e = HC_EV_NM / nm, U = [[1e12, 'TeV'], [1e9, 'GeV'], [1e6, 'MeV'], [1e3, 'keV'], [1, 'eV'], [1e-3, 'meV'], [1e-6, 'µeV']];
  const [k, u] = U.find(([x]) => e >= x) ?? U.at(-1);
  return `${num(e / k)} ${u}`;
}
/** A range in the unit astronomers use there: energy for X/γ, frequency for microwave/radio, else wavelength. */
export function fmtRange(lo, hi) {
  const mid = Math.sqrt(lo * hi);
  if (mid < 5e-3 || (mid < 10 && hi < 50)) return `${fmtEnergy(hi)}–${fmtEnergy(lo)}`;
  if (mid > 1e6) return `${fmtFreq(hi)}–${fmtFreq(lo)}`;
  const a = fmtWave(lo), b = fmtWave(hi), ua = a.split(' ')[1], ub = b.split(' ')[1];
  return ua === ub ? `${a.split(' ')[0]}–${b}` : `${a}–${b}`;
}
/** All three: "3–5 µm · 60–100 THz · 0.25–0.41 eV". */
export const fmtRangeAll = (lo, hi) => `${fmtWave(lo)}–${fmtWave(hi)} · ${fmtFreq(hi)}–${fmtFreq(lo)} · ${fmtEnergy(hi)}–${fmtEnergy(lo)}`;

const UNIT = { pm: ['l', 1e-3], nm: ['l', 1], 'å': ['l', 0.1], a: ['l', 0.1], um: ['l', 1e3], 'µm': ['l', 1e3], micron: ['l', 1e3], microns: ['l', 1e3], mm: ['l', 1e6], cm: ['l', 1e7], m: ['l', 1e9],
  hz: ['f', 1], khz: ['f', 1e3], mhz: ['f', 1e6], ghz: ['f', 1e9], thz: ['f', 1e12], phz: ['f', 1e15],
  ev: ['e', 1], kev: ['e', 1e3], mev: ['e', 1e6], gev: ['e', 1e9], tev: ['e', 1e12] };
const toNm = (v, u) => { const [k, s] = UNIT[u]; return k === 'l' ? v * s : k === 'f' ? C_NM_HZ / (v * s) : HC_EV_NM / (v * s); };
/** Parse "3–5 µm", "1.4 GHz to 1.43 GHz", "0.1-2.4 keV", "21 cm": [loNm, hiNm] or null. */
export function parseRange(text) {
  const s = String(text).toLowerCase().replace(/μ/g, 'µ').replace(/\s+/g, ' ').trim();
  const m = s.match(/^([\d.]+(?:e-?\d+)?)\s*([a-zµå]+)?\s*(?:-|–|—|to|\.\.)\s*([\d.]+(?:e-?\d+)?)\s*([a-zµå]+)?$/) ?? s.match(/^([\d.]+(?:e-?\d+)?)\s*([a-zµå]+)$/);
  if (!m) return null;
  const single = m.length === 3 || m[3] == null;
  const u2 = single ? m[2] : m[4] ?? m[2], u1 = m[2] ?? u2;
  if (!UNIT[u1] || !UNIT[u2]) return null;
  const a = toNm(Number(m[1]), u1), b = single ? a : toNm(Number(m[3]), u2);
  if (!(a > 0 && b > 0)) return null;
  let lo = Math.min(a, b), hi = Math.max(a, b);
  if (single) { lo *= 0.95; hi *= 1.05; } // one value: a ±5% window around it
  return [lo, hi];
}

/** A short name for a curve: "FULL SPECTRUM", "2MASS Ks 2.16 µm", "3–5 µm + HUMAN EYE − 5.5–7 µm". */
export function curveLabel(curve) {
  const c = normCurve(curve);
  if (c.full) return 'FULL SPECTRUM';
  if (!c.parts.length) return 'NOTHING PASSES';
  const one = (p) => {
    const t = (p.t ?? 1) < 1 ? ` ×${Math.round((p.t ?? 1) * 100)}%` : '';
    if (p.pass) return `${passInfo(p.pass)?.pass.label ?? p.pass}${t}`;
    return `${p.label ?? fmtRange(p.lo, p.hi)}${t}`;
  };
  const s = c.parts.map(one).join(' + ') + c.excl.map((r) => ` − ${r.label ?? fmtRange(r.lo, r.hi)}`).join('');
  return s.length > 64 ? `${s.slice(0, 62)}…` : s;
}

/**
 * The readout: { full, label, filter, effNm, centreNm, widthNm, span, bands, dominant, palette,
 * composite, thirds, text }. `text` is what the Computer (#21) reads back.
 */
export function describeCurve(curve) {
  const c = normCurve(curve);
  if (c.full) return { full: true, label: 'FULL SPECTRUM', bands: [], text: 'SPECTRUM: FULL (the ordinary view, no filter).' };
  const f = compose(c), label = curveLabel(c);
  if (!f || !f.points.some((p) => p[1] > 0)) return { full: false, empty: true, label, bands: [], text: 'SPECTRUM: NOTHING PASSES (every part excluded).' };
  const bands = bandShares(f), dominant = bands[0]?.id ?? 'visible';
  const span = support(f), effNm = effectiveNm(f), centreNm = logCentreNm(f), widthNm = equivalentWidthNm(f), composite = isComposite(f);
  const th = composite ? thirds(f) : null;
  const text = [`SPECTRUM: ${label}`,
    `EFFECTIVE WAVELENGTH ${fmtWave(effNm)} (log centre ${fmtWave(centreNm)}), equivalent width ${fmtWave(widthNm)}, passing ${fmtRange(...span)}`,
    `BANDS INCLUDED: ${bands.map((b) => `${b.label} ${Math.round(b.share * 100)}%`).join(', ')}`,
    composite ? `COLOUR: three-band composite, blue ${fmtRange(...th[0])}, green ${fmtRange(...th[1])}, red ${fmtRange(...th[2])}` : `COLOUR: ${bandRange(dominant)?.label ?? dominant} false-colour palette`].join('\n');
  return { full: false, label, filter: f, effNm, centreNm, widthNm, span, bands, dominant, palette: paletteOfBand(dominant), composite, thirds: th, text };
}

/** Merge [lo, hi] nm intervals that touch (within 0.1% in log). */
export function mergeRanges(rs) {
  const s = rs.filter((r) => r[1] > r[0]).sort((a, b) => a[0] - b[0]), out = [];
  for (const r of s) { const last = out.at(-1); if (last && r[0] <= last[1] * 1.001) last[1] = Math.max(last[1], r[1]); else out.push([...r]); }
  return out;
}
/** Where T > 1% of its peak but `covered(λ)` is false, sampled on a log grid: merged [lo, hi] ranges. */
export function uncoveredRanges(f, covered, perDecade = 40) {
  const s = support(f);
  if (!s) return [];
  const peak = Math.max(...f.points.map((p) => p[1])), a = Math.log10(s[0]), b = Math.log10(s[1]);
  const n = Math.max(8, Math.ceil((b - a) * perDecade)), out = [];
  // also visit every breakpoint, so narrow windows are never skipped
  const xs = [...new Set([...Array.from({ length: n + 1 }, (_, i) => 10 ** (a + ((b - a) * i) / n)), ...f.points.map((p) => p[0]).filter((l) => l >= s[0] && l <= s[1])])].sort((x, y) => x - y);
  for (let i = 1; i < xs.length; i++) {
    const m = Math.sqrt(xs[i - 1] * xs[i]);
    if (evalT(f, m) > peak * 0.01 && !covered(m)) out.push([xs[i - 1], xs[i]]);
  }
  // drop slivers (under 0.1% of a decade) left at band edges where coverage meets end to end
  return mergeRanges(out).filter(([lo, hi]) => Math.log10(hi / lo) > 1e-3);
}
