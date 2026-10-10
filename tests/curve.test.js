// The spectrum control's transmission curve (#66): composition, overlap weights, the exact
// single-bandpass reproduction, and stars in the Vega system.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compose, evalT, normCurve, canonical, curveFromLegacy, presetPass, presetBand, presetEye, describeCurve, parseRange, fmtWave, fmtRange,
  logIntegral, windowFilter, support, uncoveredRanges, union } from '../src/data/curve.js';
import { BANDS, BODY_BAND, bandById, passById } from '../src/data/bands.js';
import { bandLook, starBandDelta } from '../src/views/system/bandskin.js';
import { curveLook, realSources, realOverlap, prepare, skyLayers, curveStarDelta, curveStarRgb, sunCurveLook, entryResponse } from '../src/views/system/curvelook.js';
import { setCurrentBand, setCurrentCurve, currentBand, bandStarColour } from '../src/data/bandstate.js';
import { bandResponse, effectiveNm } from '../src/astro/bands.js';

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);

test('composition: union of windows by max, transmission per part, zero inside exclusions', () => {
  const c = { parts: [{ lo: 3000, hi: 5000 }, { lo: 4000, hi: 8000, t: 0.5 }, { lo: 20000, hi: 30000, t: 0.25 }], excl: [{ lo: 6000, hi: 7000 }] };
  const f = compose(c);
  near(evalT(f, 3500), 1, 1e-12, 'first window');
  near(evalT(f, 4500), 1, 1e-12, 'overlap takes the max');
  near(evalT(f, 5500), 0.5, 1e-12, 'second window at its transmission');
  assert.equal(evalT(f, 6500), 0, 'excluded');
  near(evalT(f, 7500), 0.5, 1e-12, 'after the exclusion');
  assert.equal(evalT(f, 10000), 0, 'between windows');
  near(evalT(f, 25000), 0.25, 1e-12);
  assert.equal(evalT(f, 2999), 0);
  // ∫T dlnλ of a window is t·ln(hi/lo)
  near(logIntegral([windowFilter(3000, 5000)]), Math.log(5 / 3), 1e-4);
  near(logIntegral([compose({ parts: [{ lo: 20000, hi: 30000, t: 0.25 }] })]), 0.25 * Math.log(1.5), 1e-4);
  // a pass can be excluded from a band window, and a stored curve is repaired
  const ex = compose({ parts: [presetBand('ir').parts[0]], excl: [{ lo: 1000, hi: 2000 }] });
  assert.equal(evalT(ex, 1500), 0); near(evalT(ex, 900), 1, 1e-12);
  assert.deepEqual(normCurve({ parts: [{ lo: 5, hi: 3 }, { pass: 'nope' }], excl: [] }).parts, [{ lo: 3, hi: 5 }]);
  assert.deepEqual(normCurve(null), { full: true, parts: [], excl: [] });
});

test('one bandpass reproduces the old single-bandpass results exactly', () => {
  const bodies = ['moon', 'mars', 'venus', 'earth', 'jupiter', 'titan', 'mercury', 'europa', 'iapetus', 'saturn'].map((id) => ({ id, name: id }));
  for (const b of BANDS) for (const p of b.passes) {
    const c = presetPass(p.id);
    assert.equal(compose(c), p.filter, `${p.id}: the pass's own filter`);
    const can = canonical(c);
    assert.equal(can.kind, 'pass'); assert.equal(can.pass, p); assert.equal(can.band, b);
    for (const body of bodies) assert.deepEqual(curveLook(body, c), bandLook(body, b, p), `${body.id} in ${p.id}`);
    assert.deepEqual(skyLayers(c).layers.map((l) => l.sky), [(p.sky ? p : b.passes.find((x) => x.sky))?.sky].filter(Boolean), `${p.id} sky`);
  }
  // the old settings map onto curves, and currentBand() keeps its shape
  assert.deepEqual(curveFromLegacy('ir', null), presetPass('ir-J'));
  assert.deepEqual(curveFromLegacy('full', null).full, true);
  setCurrentBand('uv', 'uv-fuv');
  let cb = currentBand();
  assert.equal(cb.band.id, 'uv'); assert.equal(cb.pass.id, 'uv-fuv'); assert.equal(cb.full, false); assert.equal(cb.custom, false);
  assert.deepEqual(bandStarColour(20000, [1, 1, 1]), (() => { const d = starBandDelta(20000, cb.pass), k = Math.max(0.08, Math.min(1.6, 10 ** (0.4 * Math.max(-6, Math.min(6, d)) * 0.5))); return [0.7 * k, 0.55 * k, 1 * k]; })());
  setCurrentBand('full');
  assert.equal(currentBand().full, true);
});

test('the composition path agrees with the single-bandpass rule (a pass plus a far-away exclusion)', () => {
  for (const [bodyId, passId] of [['jupiter', 'ir-Ks'], ['venus', 'uv-nuv'], ['mars', 'vis-B'], ['moon', 'ir-W4']]) {
    const info = BANDS.flatMap((b) => b.passes.map((p) => [b, p])).find(([, p]) => p.id === passId);
    const old = bandLook({ id: bodyId, name: bodyId }, ...info);
    const c = { parts: [{ pass: passId }], excl: [{ lo: 1e8, hi: 1e9 }] }; // not one bandpass any more, same T(λ)
    assert.equal(canonical(c).kind, 'custom');
    const l = curveLook({ id: bodyId, name: bodyId }, c);
    if (old.mode === 'reflected') { near(l.mix.reflected, 1, 1e-3, `${bodyId} ${passId} all reflected`); near(l.reflected.gain / old.gain, 1, 1e-3, `${bodyId} ${passId} gain`); }
    if (old.mode === 'thermal') { near(l.mix.thermal, 1, 1e-3); assert.deepEqual(l.thermalPart.thermal, old.thermal); near(l.thermalPart.um, old.um, 1e-3); }
  }
  // the filter itself survives composition (to the edge slivers)
  const Ks = passById(bandById('ir'), 'ir-Ks').filter, f = compose({ parts: [{ pass: 'ir-Ks' }], excl: [{ lo: 1e8, hi: 1e9 }] });
  near(effectiveNm(f), effectiveNm(Ks), 1e-6);
  near(bandResponse((nm) => nm ** -2, f), bandResponse((nm) => nm ** -2, Ks), 1e-15);
});

test('real maps contribute by overlap ∫T·R dlnλ, normalised; the rest is predicted, and uncovered ranges are reported', () => {
  // Earth's 10.3 µm GOES/Himawari map (its audited range: ABI/AHI band 13, 10.1–10.6 µm): a window exactly on it is all measured
  const on = curveLook({ id: 'earth', name: 'Earth' }, { parts: [{ lo: 10100, hi: 10600 }] });
  near(on.mix.real, 1, 1e-3, 'exactly covered'); assert.equal(on.sources.length, 1); near(on.sources[0].weight, 1, 1e-12);
  assert.equal(on.tier, 'measured'); assert.match(on.label, /^100% MEASURED/);
  // 8–14 µm: measured = ln(10.6/10.1)/ln(14/8), the rest predicted thermal
  const wide = curveLook({ id: 'earth', name: 'Earth' }, { parts: [{ lo: 8000, hi: 14000 }] });
  near(wide.mix.real, Math.log(10.6 / 10.1) / Math.log(14 / 8), 2e-3, 'measured fraction');
  near(wide.mix.thermal, 1 - wide.mix.real, 2e-3, 'predicted thermal');
  assert.match(wide.label, /\d+% MEASURED · \d+% PREDICTED/);
  assert.equal(wide.uncovered.length, 2, 'below and above the map'); near(wide.uncovered[0][1], 10100, 200); near(wide.uncovered[1][0], 10600, 200);
  // two maps (Titan: Cassini ISS 938 nm in Johnson I, Cassini RADAR 2.2 cm): weights ∝ overlap
  const c = { parts: [{ pass: 'vis-I' }, { pass: 'mw-ku' }], excl: [] }, p = prepare(c), r = realOverlap(p, 'titan');
  assert.equal(r.list.length, 2);
  const o = r.list.map((s) => logIntegral([p.f, s.response]));
  near(r.list[0].weight, o[0] / (o[0] + o[1]), 1e-12); near(r.list[0].weight + r.list[1].weight, 1, 1e-12);
  // the audit (#61) gives each map its own channel width (ISS 928–948 nm, RADAR 2.2 cm), narrower than the passes
  assert.ok(r.measured > 0 && r.measured < 1, `partly covered by real maps: ${r.measured}`);
  const tl = curveLook({ id: 'titan', name: 'Titan' }, c);
  assert.equal(tl.sources.filter((s) => s.drawn).length, 1, 'one map drawn, the other listed');
  // nothing overlaps: all predicted (or not observed)
  const none = curveLook({ id: 'neptune', name: 'Neptune' }, { parts: [{ lo: 100, hi: 150 }] });
  assert.equal(none.mode, 'dark'); assert.equal(none.notObserved.length, 1);
  // an audit-supplied `range` on a BODY_BAND entry is honoured
  BODY_BAND.__test = { ir: { hips: 'X', credit: 'test', range: [1000, 2000] } };
  try { assert.deepEqual(support(realSources('__test')[0].response), [1000, 2000]); } finally { delete BODY_BAND.__test; }
  // a band-level entry takes the bandpass that shows the same map (as Mars 'ir' → THEMIS at ir-12 did before the #61 audit gave every entry a range)
  const themis = { hips: 'THEMIS', credit: 'test' }, map = { 'ir-12': themis, ir: themis };
  assert.equal(entryResponse('ir', map.ir, map), passById(bandById('ir'), 'ir-12').filter);
});

test('wide curves: band shares, a three-band composite, and the sky blended by overlap', () => {
  const d = describeCurve({ parts: [{ lo: 300, hi: 3000 }] });
  assert.ok(d.composite); assert.equal(d.thirds.length, 3); near(d.thirds[0][0], 300, 1e-6); near(d.thirds[2][1], 3000, 1e-6);
  near(d.bands.reduce((a, b) => a + b.share, 0), 1, 0.01);
  assert.deepEqual(d.bands.map((b) => b.id).sort(), ['ir', 'uv', 'visible']);
  assert.match(d.text, /EFFECTIVE WAVELENGTH/); assert.match(d.text, /BANDS INCLUDED/);
  assert.equal(describeCurve(presetPass('vis-V')).composite, false, 'a narrow filter keeps its palette');
  assert.equal(describeCurve(presetEye()).dominant, 'visible');
  // the composite keeps each third's own brightness: Mars red, Neptune blue through the eye
  const mars = curveLook({ id: 'mars', name: 'Mars' }, presetEye()).reflected.hue, nep = curveLook({ id: 'neptune', name: 'Neptune' }, presetEye()).reflected.hue;
  assert.ok(mars[0] > mars[2] * 1.5, `Mars ${mars}`); assert.ok(nep[2] > nep[0], `Neptune ${nep}`);
  const sky = skyLayers(presetBand('ir'));
  assert.ok(sky.layers.length >= 3); near(sky.layers.reduce((a, l) => a + l.weight, 0), 1, 1e-9);
  assert.equal(skyLayers({ parts: [{ pass: 'uv-fuv', t: 0.5 }] }).layers.length, 0, 'no UV survey: catalogue stars');
  // a custom curve gives a synthetic band and pass that pass-based consumers can use
  setCurrentCurve({ parts: [{ lo: 3000, hi: 5000 }] });
  const cb = currentBand();
  assert.equal(cb.band.id, 'custom'); assert.equal(cb.band.palette, 'infrared'); assert.equal(cb.pass.id, 'custom');
  assert.ok(cb.pass.filter.points.length >= 4); near(effectiveNm(cb.pass.filter), 4000, 1);
  assert.ok(bandStarColour(3000, [1, 1, 1]).every(Number.isFinite));
  setCurrentCurve(null);
  assert.equal(currentBand().full, true);
});

test('stars through a curve: Vega-system colours (COMPUTED)', () => {
  const Ks = passById(bandById('ir'), 'ir-Ks');
  for (const t of [3000, 5772, 9600, 20000]) assert.equal(curveStarDelta(t, Ks.filter), starBandDelta(t, Ks), `${t} K`);
  near(curveStarDelta(9600, compose({ parts: [{ lo: 300, hi: 3000 }] })), 0, 1e-9, 'Vega is colour 0 through any curve');
  assert.equal(curveStarDelta(5772, compose({ parts: [{ lo: 1e7, hi: 1e9 }] })), -Infinity, 'no photosphere at radio wavelengths');
  const vis = prepare(presetBand('visible'));
  const vega = curveStarRgb(9600, vis, [1, 1, 1]), m = curveStarRgb(3200, vis, [1, 1, 1]), b = curveStarRgb(25000, vis, [1, 1, 1]);
  near(vega[0], vega[2], 1e-9, 'Vega is white in the composite'); near(vega[0], vega[1], 1e-9);
  assert.ok(m[0] > m[2] * 1.3, 'a cool star is red'); assert.ok(b[2] > b[0], 'a hot star is blue');
  // the Sun through a wide curve: its measured signatures fill radio/microwave, SDO the EUV
  const sun = sunCurveLook(prepare({ parts: [{ lo: 5, hi: 1e9 }] }));
  assert.ok(sun.look.sources.length > 3); assert.match(sun.look.label, /MEASURED/); assert.match(sun.look.detail, /F10\.7|ALMA/);
});

test('units: parsing typed windows and formatting ranges', () => {
  assert.deepEqual(parseRange('3–5 µm'), [3000, 5000]);
  assert.deepEqual(parseRange('3 to 5 um'), [3000, 5000]);
  const ghz = parseRange('1.4-1.43 GHz'); near(ghz[0], 299792458 / 1.43, 1e-3); near(ghz[1], 299792458 / 1.4, 1e-3);
  const kev = parseRange('0.1–2.4 keV'); near(kev[0], 1.23984 / 2.4, 1e-4); near(kev[1], 12.3984, 1e-3);
  assert.ok(parseRange('21 cm')[0] < 2.1e8 && parseRange('21 cm')[1] > 2.1e8);
  assert.equal(parseRange('banana'), null);
  assert.equal(fmtWave(2160), '2.16 µm'); assert.equal(fmtWave(2.1e8), '21 cm'); assert.equal(fmtWave(1e-6), '1 fm');
  assert.match(fmtRange(1, 10), /keV/); assert.match(fmtRange(2e8, 2.2e8), /GHz|MHz/); assert.equal(fmtRange(3000, 5000), '3–5 µm');
  assert.deepEqual(uncoveredRanges(windowFilter(10, 20), () => false).length, 1);
  assert.ok(union([windowFilter(1, 2), windowFilter(3, 4)]).points.length >= 8);
});

test('uncovered ranges ignore zero-width slivers at band edges', () => {
  const f = { points: [[1e6, 1], [3e7, 1]] }; // 1 mm – 3 cm
  assert.deepEqual(uncoveredRanges(f, (nm) => nm < 2.9999e7), []);
  assert.equal(uncoveredRanges(f, (nm) => nm < 1e7).length, 1);
});
