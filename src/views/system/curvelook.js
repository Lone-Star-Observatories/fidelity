// Views computed from the spectrum control's transmission curve T(λ) (#66).
//
//   Bodies (curveLook): every real map of the body (src/data/bands.js BODY_BAND) whose bandpass R_i
//     overlaps T contributes, weighted by its overlap ∫T·R_i dlnλ (normalised). The measured fraction
//     is ∫min(T, max_i R̂_i) dlnλ / ∫T dlnλ (R̂: response scaled to peak 1). The best-covered map is
//     the one drawn (blending maps from different instruments and wavelengths on one globe is not
//     meaningful; the others are listed with their weights). What real maps leave uncovered,
//     max(0, T − max R̂), is predicted segment by segment with bandLook() (bandskin.js): reflected light
//     (150 nm–2.6 µm), thermal emission (beyond 2.6 µm), observed high-energy glows (X-ray, gamma);
//     anything else is NOT OBSERVED. The look carries the mix ("62% MEASURED · 38% PREDICTED").
//   Sun (sunCurveLook): SDO frames the same way, the Sun's measured signatures (SUN_SIGNATURES) and
//     its photosphere (a 5,772 K blackbody through T relative to V) for the rest.
//   Stars (curveStarDelta, curveStarRgb): a blackbody integrated through T relative to V, Vega system
//     (COMPUTED); wide curves give a three-band composite colour.
//   Sky (skyLayers): every all-sky survey whose bandpass overlaps T, blended by overlap; with none,
//     catalogue stars re-weighted.
//   Colour: a narrow curve keeps its band's palette; a wide one is a three-band composite (curve.js
//     COMPOSITE_RGB): each component's hue is its share of T in each third of the curve's log range.
//
//   A curve that is exactly one bandpass reproduces the old results: bandLook(body, band, pass).

import { BANDS, BODY_BAND } from '../../data/bands.js';
import { bandLook, SUN_SIGNATURES, paletteIndex } from './bandskin.js';
import { colourIndex, effectiveNm, planck } from '../../astro/bands.js';
import { canonical, describeCurve, logIntegral, clip, union, normalised, remainder, evalT, compositeHue, COMPOSITE_RGB, windowFilter,
  passInfo, uncoveredRanges, fmtRange, breaks, coveredFraction } from '../../data/curve.js';

const pct = (x) => `${Math.round(x * 100)}%`;
export const PAL_RGB = [[1, 1, 1], [1, 0.55, 0.15], [0.3, 0.85, 1], [1, 0.45, 0.2], [1, 1, 1], [0.7, 0.55, 1], [0.4, 0.9, 1], [1, 0.4, 0.9]];

/** Prepared once per curve: the canonical form, the readout and the composed filter. */
const prepCache = new Map();
export function prepare(curve) {
  const key = JSON.stringify(curve ?? null);
  let p = prepCache.get(key);
  if (!p) {
    const can = canonical(curve), desc = describeCurve(curve);
    p = { key, curve, can, desc, f: desc.filter ?? null, tot: desc.filter ? logIntegral([desc.filter]) : 0, stars: new Map() };
    if (prepCache.size > 24) prepCache.clear();
    prepCache.set(key, p);
  }
  return p;
}

// ---- real maps and their bandpasses -----------------------------------------------------------
const identity = (s) => (s.hips ? `hips:${s.hips}` : s.gibs ? `gibs:${s.gibs}` : s.feed ? `feed:${s.feed}` : s.archive ? `archive:${s.archive.id}` : s.disc ? `disc:${s.disc.id}` : JSON.stringify(s));
/**
 * The bandpass of one BODY_BAND entry: its own `range: [nmLo, nmHi]` if given; the filter of the pass
 * it is keyed by; for a band-level key, the pass in that band showing the same map, else the union of
 * the band's passes (the old rule: the map stands in for the whole band).
 */
export function entryResponse(key, s, map) {
  if (Array.isArray(s.range) && s.range[1] > s.range[0]) return windowFilter(s.range[0], s.range[1]);
  const info = passInfo(key);
  if (info?.band) return info.pass.filter;
  const band = BANDS.find((b) => b.id === key);
  if (!band) return null;
  const same = Object.entries(map).find(([k, x]) => k !== key && passInfo(k)?.band?.id === key && identity(x) === identity(s));
  if (same) return passInfo(same[0]).pass.filter;
  return union(band.passes.map((p) => p.filter));
}
/** A body's real maps, one per distinct image: [{ id, source, keys, response (peak 1) }]. */
export function realSources(bodyId) {
  const map = BODY_BAND[bodyId];
  if (!map) return [];
  const groups = new Map();
  for (const [key, s] of Object.entries(map)) {
    const r = entryResponse(key, s, map);
    if (!r) continue;
    const id = identity(s), g = groups.get(id);
    // prefer the entry keyed by a bandpass (its credit names the exact band) over a band-level one
    if (!g) groups.set(id, { id, source: s, keys: [key], rs: [r] });
    else { g.keys.push(key); g.rs.push(r); if (passInfo(key)?.band && !passInfo(g.keys[0])?.band) g.source = s; }
  }
  return [...groups.values()].map((g) => ({ id: g.id, source: g.source, keys: g.keys, response: normalised(g.rs.length === 1 ? g.rs[0] : union(g.rs)) }));
}
/** Real maps overlapping the curve, best-covered first: [{ …source, overlap, weight }] and the measured fraction. */
export function realOverlap(p, bodyId) {
  if (!p.f || !(p.tot > 0)) return { list: [], measured: 0, cover: null };
  const list = realSources(bodyId).map((s) => ({ ...s, overlap: logIntegral([p.f, s.response]) })).filter((s) => s.overlap > p.tot * 1e-4)
    .sort((a, b) => b.overlap - a.overlap);
  const sum = list.reduce((a, s) => a + s.overlap, 0);
  for (const s of list) s.weight = s.overlap / sum;
  const cover = list.length ? union(list.map((s) => s.response)) : null;
  return { list, cover, measured: coveredFraction(p.f, cover) };
}

// ---- predicted segments -----------------------------------------------------------------------
/** The predicted part of the curve is looked at in these segments (bandLook's own regimes). */
export const SEGMENTS = [
  { id: 'gamma', lo: 1e-6, hi: 5e-3, band: 'gamma', named: true },
  { id: 'xray', lo: 5e-3, hi: 100, band: 'xray', named: true },
  { id: 'fuv', lo: 100, hi: 150, band: 'uv' },
  { id: 'uv', lo: 150, hi: 380, band: 'uv' },
  { id: 'visible', lo: 380, hi: 700, band: 'visible' },
  { id: 'nir', lo: 700, hi: 2600, band: 'ir' },
  { id: 'ir', lo: 2600, hi: 1e6, band: 'ir' },
  { id: 'microwave', lo: 1e6, hi: 3e7, band: 'microwave' },
  { id: 'radio', lo: 3e7, hi: 1e10, band: 'radio' },
];
const bandOf = (id) => BANDS.find((b) => b.id === id);
// Glows are looked up by band id; every other regime gets a band id no BODY_BAND entry uses, so a
// band-level real map is never counted twice (real maps are handled above).
const segBand = (s) => (s.named ? bandOf(s.band) : { ...bandOf(s.band), id: `curve-${s.band}` });
/** [{ seg, g (filter), w (share of ∫T), look }] for what `rest` leaves to prediction. */
function predictedSegments(body, rest, p) {
  if (!rest) return [];
  const out = [];
  for (const seg of SEGMENTS) {
    const g = clip(rest, seg.lo, seg.hi);
    if (!g) continue;
    const w = logIntegral([g]) / p.tot;
    if (w < 1e-4) continue;
    let look = bandLook(body, segBand(seg), { id: `curve-${seg.id}`, label: `the ${fmtRange(seg.lo, seg.hi)} part of the curve`, filter: g });
    if (look.mode === 'real') look = { mode: 'dark', tier: 'computed', label: 'NOT OBSERVED', detail: '' }; // a band-level map is already counted as real
    out.push({ seg, g, w, look });
  }
  return out;
}

/**
 * How `body` looks through `curve`. One bandpass: bandLook()'s own result. Otherwise { mode: 'curve',
 * tier, label, detail, mix: { real, reflected, thermal, glow, dark }, real, sources, reflected,
 * thermalPart, glowPart, palette, composite, hues, uncovered, notObserved, lit }.
 */
export function curveLook(body, curve) {
  const p = prepare(curve);
  if (p.can.kind === 'full') return null;
  if (p.can.kind === 'pass') return bandLook(body, p.can.band, p.can.pass);
  const pal = paletteIndex(p.desc.palette);
  if (!p.f || !(p.tot > 0)) return { mode: 'dark', tier: 'computed', palette: pal, label: 'NOTHING PASSES', detail: 'The transmission curve is zero everywhere.' };
  const real = realOverlap(p, body.id);
  const rest = remainder(p.f, real.cover);
  const segs = predictedSegments(body, rest, p);
  const th = p.desc.composite ? p.desc.thirds : null;
  const hue = (g) => (th ? compositeHue(g, p.f, th) : null);
  const sum = (mode) => segs.filter((s) => s.look.mode === mode).reduce((a, s) => a + s.w, 0);
  const pick = (mode) => segs.filter((s) => s.look.mode === mode).sort((a, b) => b.w - a.w);
  const mix = { real: real.measured, reflected: sum('reflected'), thermal: sum('thermal'), glow: sum('glow'), dark: sum('dark') };
  // reflected: one gain (weighted), a composite hue that keeps each segment's own gain (Mars stays red)
  const refl = pick('reflected'), therm = pick('thermal'), glow = pick('glow');
  // one gain over all the reflected light (photon-weighted like bandLook), so a single filter keeps its old gain
  const reflAll = refl.length > 1 ? bandLook(body, segBand(SEGMENTS[4]), { id: 'curve-reflected', label: 'the reflected-light part of the curve', filter: union(refl.map((s) => s.g)) }) : refl[0]?.look;
  const reflected = refl.length ? { gain: reflAll?.mode === 'reflected' ? reflAll.gain : refl.reduce((a, s) => a + s.w * s.look.gain, 0) / mix.reflected,
    hue: th ? thirdsHue(body, union(refl.map((s) => s.g)), p.f, th, 'reflected') : null } : null;
  const thermalPart = therm.length ? { thermal: therm[0].look.thermal, um: therm[0].look.um, label: therm[0].look.label, hue: th ? thirdsHue(body, union(therm.map((s) => s.g)), p.f, th, 'thermal') : null } : null;
  const glowPart = glow.length ? { glow: glow[0].look.glow, gain: glow.reduce((a, s) => a + s.w * s.look.gain, 0) / mix.glow, label: glow[0].look.label, detail: glow[0].look.detail,
    hue: th ? mixHues(glow.map((s) => [hue(s.g), s.w])) : null } : null;
  const best = real.list[0] ?? null;
  const overlapF = best ? multiplyF(p.f, best.response) : null; // the part of T the drawn map covers
  const realHue = best && th ? compositeHue(overlapF, p.f, th) : null;
  const realEff = overlapF ? effectiveNm(overlapF) : 0;
  const predicted = mix.reflected + mix.thermal + mix.glow;
  const uncovered = uncoveredRanges(p.f, (nm) => !!real.cover && evalT(real.cover, nm) >= 0.5);
  const notObserved = uncoveredRanges(p.f, (nm) => (real.cover && evalT(real.cover, nm) >= 0.5) || segs.some((s) => s.look.mode !== 'dark' && nm >= s.seg.lo && nm < s.seg.hi));
  const shares = [['measured', mix.real], ['modelled', predicted], ['computed', mix.dark]].sort((a, b) => b[1] - a[1]);
  const label = mix.real + predicted < 1e-3 ? 'NOT OBSERVED THROUGH THIS CURVE'
    : [mix.real > 0.005 ? `${pct(mix.real)} MEASURED` : null, predicted > 0.005 ? `${pct(predicted)} PREDICTED` : null, mix.dark > 0.005 ? `${pct(mix.dark)} NOT OBSERVED` : null].filter(Boolean).join(' · ');
  const detail = [
    real.list.length ? `Real imagery (MEASURED), weighted by overlap with the curve: ${real.list.map((s) => `${s.source.credit} ${pct(s.weight)}${s === best ? ' (drawn)' : ' (listed, not drawn: one map per globe)'}`).join('; ')}.` : 'No real map of this body overlaps the curve.',
    predicted > 0.005 ? `Predicted (MODELLED · PREDICTED) where no real map covers the curve: ${segs.filter((s) => s.look.mode !== 'dark').map((s) => `${fmtRange(s.seg.lo, s.seg.hi)} ${s.look.mode} ${pct(s.w)}`).join(', ')}.` : null,
    notObserved.length ? `NOT OBSERVED: ${notObserved.map((r) => fmtRange(...r)).join(', ')}.` : null,
    p.desc.composite ? `Colour: three-band composite (blue ${fmtRange(...th[0])}, green ${fmtRange(...th[1])}, red ${fmtRange(...th[2])}).` : null,
  ].filter(Boolean).join(' ');
  // a whole-disc image covers only the Earth-facing side (#28)
  const discTag = best?.source.disc ? ` · DISC IMAGE ${best.source.date} · EARTH-FACING SIDE ONLY` : '';
  return { mode: mix.real + predicted < 1e-3 ? 'dark' : 'curve', tier: shares[0][0], palette: pal, composite: !!th, label: label + discTag, detail, mix,
    real: best ? { source: best.source, id: best.id, hue: realHue, palette: best.source.gibs || best.source.disc ? 0 : pal, lit: (realEff < 2600 || !!best.source.lit) && !best.source.gibs && !best.source.unlit && !best.source.disc } : null,
    sources: real.list.map((s) => ({ id: s.id, credit: s.source.credit, note: s.source.note, weight: s.weight, drawn: s === best, partial: !!s.source.partial })),
    reflected, thermalPart, glowPart, segments: segs.map((s) => ({ range: [s.seg.lo, s.seg.hi], mode: s.look.mode, w: s.w, label: s.look.label })),
    uncovered, notObserved };
}
/**
 * A composite hue that keeps how bright the body is in each third of the curve: Σ_k share_k · b_k ·
 * RGB_k, with b_k its reflectance gain (reflected light: a red Mars stays red) or its thermal brightness
 * (B_λ(T) against the shader's own 1.3·T scale) through that third.
 */
function thirdsHue(body, g, f, th, mode) {
  const b = th.map(([lo, hi], k) => {
    const gk = clip(g, lo, hi);
    if (!gk) return 0;
    const l = bandLook(body, segBand(mode === 'reflected' ? SEGMENTS[4] : SEGMENTS[6]), { id: `curve-third-${k}`, label: 'a third of the curve', filter: gk });
    if (mode === 'reflected') return l.mode === 'reflected' ? l.gain : 1;
    if (l.mode !== 'thermal') return 1;
    const T = l.thermal[3] > 0.5 ? l.thermal[0] : l.thermal[2], nm = l.um * 1000;
    return planck(nm, T) / Math.max(1e-300, planck(nm, 1.3 * T));
  });
  return compositeHue(g, f, th, (k) => b[k]);
}
const multiplyF = (f, r) => {
  const xs = [...new Set([...breaks(f), ...breaks(r)])].sort((a, b) => a - b);
  return { points: xs.map((l) => [l, evalT(f, l) * evalT(r, l)]) };
};
function mixHues(list) {
  const rgb = [0, 0, 0];
  for (const [h, w] of list) if (h) for (let c = 0; c < 3; c++) rgb[c] += h[c] * w;
  const m = Math.max(...rgb);
  return m > 0 ? rgb.map((x) => x / m) : [1, 1, 1];
}

// ---- stars ----------------------------------------------------------------------------------
const PHOTO = [90, 3e4]; // where a photosphere's blackbody is worth showing (as starBandDelta)
/** Δmag (brighter in T than in V, Vega system; COMPUTED) of a T_eff blackbody through filter f; −∞ outside 90 nm–30 µm. */
export function curveStarDelta(teff, f) {
  const g = f && clip(f, PHOTO[0], PHOTO[1]);
  if (!g || !(logIntegral([g]) > 0)) return -Infinity;
  return colourIndex(teff, g) - colourIndex(9600, g);
}
/**
 * A star's display colour through a custom curve (prepared): the band's false colour scaled by Δmag,
 * or for a wide curve a three-band composite (each third's Δmag relative to Vega, so Vega is white).
 * Memoised per 25 K.
 */
export function curveStarRgb(teff, p, rgbVisible) {
  const k = Math.round(teff / 25), hit = p.stars.get(k);
  if (hit) return hit;
  let out;
  const d = curveStarDelta(teff, p.f);
  if (d === -Infinity) out = [0, 0, 0];
  else {
    const kk = Math.max(0.08, Math.min(1.6, 10 ** (0.4 * Math.max(-6, Math.min(6, d)) * 0.5)));
    if (p.desc.composite) {
      const rgb = [0, 0, 0], ref = [0, 0, 0];
      p.desc.thirds.forEach(([lo, hi], i) => {
        const dk = curveStarDelta(teff, clip(p.f, lo, hi));
        if (dk === -Infinity && curveStarDelta(9600, clip(p.f, lo, hi)) === -Infinity) return; // nothing in this third
        const v = dk === -Infinity ? 0 : 10 ** (0.4 * Math.max(-6, Math.min(6, dk)) * 0.5);
        for (let c = 0; c < 3; c++) { rgb[c] += v * COMPOSITE_RGB[i][c]; ref[c] += COMPOSITE_RGB[i][c]; }
      });
      // per channel against Vega's own composite, so a 9,600 K star is white
      out = rgb.map((x, c) => Math.min(1.6, (ref[c] > 0 ? x / ref[c] : 0) * Math.min(1, kk * 1.2)));
    } else {
      const t = p.desc.dominant === 'visible' ? rgbVisible : PAL_RGB[paletteIndex(p.desc.palette)];
      out = [t[0] * kk, t[1] * kk, t[2] * kk];
    }
  }
  if (p.desc.dominant === 'visible' && !p.desc.composite) return out; // depends on the given rgb: don't memoise
  p.stars.set(k, out);
  return out;
}

/** A star (not the Sun) through a custom curve: { tint [r,g,b], look }. */
export function starCurveLook(teff, p, label = 'this star') {
  const d = curveStarDelta(teff, p.f);
  if (d === -Infinity) return { tint: [0.02, 0.02, 0.02], look: { mode: 'dark', tier: 'computed', label: 'NOT OBSERVED THROUGH THIS CURVE', detail: `A ${Math.round(teff)} K photosphere emits almost nothing through ${p.desc.label}; no image or measured flux of ${label} is available here.` } };
  const kk = Math.max(0.05, Math.min(3, 10 ** (0.4 * Math.max(-6, Math.min(6, d)) * 0.35)));
  const hue = p.desc.composite ? curveStarRgb(teff, p, [1, 1, 1]) : PAL_RGB[paletteIndex(p.desc.palette)];
  const m = Math.max(...hue) || 1;
  return { tint: hue.map((x) => (x / m) * kk), look: { mode: 'computed', tier: 'computed', label: `${d >= 0 ? 'BRIGHTER' : 'FAINTER'} BY ${Math.abs(d).toFixed(1)} MAG THAN IN V`,
    detail: `A ${Math.round(teff)} K blackbody integrated through ${p.desc.label}, relative to the V band in the Vega system (COMPUTED). Display brightness compressed.${p.desc.composite ? ' Three-band composite colour.' : ''}` } };
}

/**
 * The Sun through a custom curve: SDO frames where their bands overlap (MEASURED), the Sun's measured
 * signatures (radio, microwave, gamma: SUN_SIGNATURES) and the photosphere (COMPUTED) for the rest.
 * { feed: source | null, realWeight, tint, look }.
 */
export function sunCurveLook(p, teff = 5772) {
  const real = realOverlap(p, 'sun');
  const rest = remainder(p.f, real.cover);
  const th = p.desc.composite ? p.desc.thirds : null;
  const tint = [0, 0, 0], parts = [];
  let wSig = 0, wPhoto = 0, wDark = 0;
  for (const seg of rest ? SEGMENTS : []) {
    const g = clip(rest, seg.lo, seg.hi);
    if (!g) continue;
    const w = logIntegral([g]) / p.tot;
    if (w < 1e-4) continue;
    const hue = th ? compositeHue(g, p.f, th) : PAL_RGB[paletteIndex(p.desc.palette)];
    const sig = SUN_SIGNATURES[seg.band];
    if (sig) { wSig += w; for (let c = 0; c < 3; c++) tint[c] += w * hue[c] * sig.gain; parts.push(`${fmtRange(seg.lo, seg.hi)}: ${sig.label}`); continue; }
    // the photosphere only where a blackbody is worth showing (90 nm–30 µm); the rest of the segment is dark
    const gp = clip(g, PHOTO[0], PHOTO[1]), wp = gp ? Math.min(w, logIntegral([gp]) / p.tot) : 0;
    wDark += w - wp;
    if (wp < 1e-4) continue;
    const d = curveStarDelta(teff, gp);
    if (d === -Infinity) { wDark += wp; continue; }
    wPhoto += wp;
    const k = Math.max(0.05, Math.min(3, 10 ** (0.4 * Math.max(-6, Math.min(6, d)) * 0.35)));
    for (let c = 0; c < 3; c++) tint[c] += wp * hue[c] * k;
    parts.push(`${fmtRange(Math.max(seg.lo, PHOTO[0]), Math.min(seg.hi, PHOTO[1]))}: photosphere ${d >= 0 ? 'brighter' : 'fainter'} by ${Math.abs(d).toFixed(1)} mag than in V`);
  }
  const norm = wSig + wPhoto;
  const t = norm > 0 ? tint.map((x) => x / norm) : [0.02, 0.02, 0.02];
  const best = real.list[0] ?? null;
  const predicted = wSig, computed = wPhoto;
  const label = [real.measured > 0.005 ? `${pct(real.measured)} MEASURED` : null, predicted > 0.005 ? `${pct(predicted)} MEASURED SIGNATURE · SKETCH` : null,
    computed > 0.005 ? `${pct(computed)} COMPUTED` : null, wDark > 0.005 ? `${pct(wDark)} NOT OBSERVED` : null].filter(Boolean).join(' · ') || 'NOT OBSERVED THROUGH THIS CURVE';
  const tier = [['measured', real.measured], ['modelled', predicted], ['computed', computed + wDark]].sort((a, b) => b[1] - a[1])[0][0];
  const detail = [real.list.length ? `SDO frames overlapping the curve: ${real.list.map((s) => `${s.source.credit} ${pct(s.weight)}${s === best ? ' (drawn)' : ''}`).join('; ')}.` : null,
    parts.length ? `${parts.join('; ')}.` : null].filter(Boolean).join(' ');
  // the disc shows the SDO frame when real imagery outweighs the predicted parts (the dark parts show nothing either way)
  const realShare = real.measured > 0 ? real.measured / (real.measured + norm) : 0;
  return { feed: best?.source ?? null, realWeight: real.measured, realShare, tint: t, look: { mode: best && realShare >= 0.5 ? 'real' : norm > 0 ? 'curve' : 'dark', tier, label, detail,
    sources: real.list.map((s) => ({ id: s.id, credit: s.source.credit, weight: s.weight, drawn: s === best })) } };
}

// ---- the sky ----------------------------------------------------------------------------------
/** Every all-sky survey once, with the union of the bandpasses that show it: [{ sky, credit, response }]. */
export const SKY_SURVEYS = (() => {
  const m = new Map();
  for (const b of BANDS) for (const p of b.passes) if (p.sky) {
    const g = m.get(p.sky) ?? { sky: p.sky, credit: p.skyCredit, fs: [], band: b.id };
    g.fs.push(p.filter); m.set(p.sky, g);
  }
  return [...m.values()].map((g) => ({ sky: g.sky, credit: g.credit, band: g.band, response: normalised(g.fs.length === 1 ? g.fs[0] : union(g.fs)) }));
})();
/**
 * Sky layers for a curve: [{ sky, skyCredit, weight }] (weights sum to 1) and the measured fraction.
 * One bandpass: the old rule (its own survey, else the band's first). Custom: every overlapping survey.
 */
export function skyLayers(curve) {
  const p = prepare(curve);
  if (p.can.kind === 'full') return { layers: [], measured: 0 };
  if (p.can.kind === 'pass') {
    const sp = p.can.pass.sky ? p.can.pass : p.can.band.passes.find((x) => x.sky);
    return { layers: sp ? [{ sky: sp.sky, skyCredit: sp.skyCredit, weight: 1 }] : [], measured: sp ? 1 : 0 };
  }
  if (!p.f || !(p.tot > 0)) return { layers: [], measured: 0 };
  const list = SKY_SURVEYS.map((s) => ({ ...s, overlap: logIntegral([p.f, s.response]) })).filter((s) => s.overlap > p.tot * 1e-3).sort((a, b) => b.overlap - a.overlap);
  const sum = list.reduce((a, s) => a + s.overlap, 0);
  const layers = list.map((s) => ({ sky: s.sky, skyCredit: s.credit, weight: s.overlap / sum })).filter((s) => s.weight >= 0.02);
  const n = layers.reduce((a, s) => a + s.weight, 0);
  for (const l of layers) l.weight /= n;
  const cover = list.length ? union(list.map((s) => s.response)) : null;
  return { layers, measured: coveredFraction(p.f, cover) };
}
