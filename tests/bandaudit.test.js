// #61 spectrum-filter audit: measured values pinned per body and band, and the audit file's shape.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { bandById, passById, BODY_BAND, BANDS } from '../src/data/bands.js';
import { bandLook, ringBandLook, reflectanceOf, SUN_SIGNATURES } from '../src/views/system/bandskin.js';
import { brightnessTempK, subsurfaceTemps, synchrotron, discFluxJy, SYNCHROTRON, BRIGHTNESS_T, REFS, diurnalDamping } from '../src/data/band-physics.js';
import { curve } from '../src/astro/bands.js';

const at = (b, p) => { const band = bandById(b); return [band, passById(band, p)]; };
const nmAt = (GHz) => 299792458 / GHz;
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} ± ${tol}`);

test('Jupiter: disc brightness temperature follows the VLA and WMAP spectra (de Pater et al. 2019; Weiland et al. 2011)', () => {
  near(brightnessTempK('jupiter', nmAt(4.52)).T, 233.1, 0.5, '4.52 GHz');
  near(brightnessTempK('jupiter', nmAt(13.18)).T, 164.0, 0.5, '13.18 GHz');
  near(brightnessTempK('jupiter', nmAt(22.49)).T, 136.0, 0.5, '22.49 GHz (NH₃ band minimum)');
  near(brightnessTempK('jupiter', nmAt(93.25)).T, 173.0, 0.5, 'WMAP W');
  assert.ok(brightnessTempK('jupiter', nmAt(4.52)).verified);
  // the look through WMAP K (20–26 GHz) is the measured ~136 K, not the old single 350 K
  const k = bandLook({ id: 'jupiter', name: 'Jupiter' }, ...at('microwave', 'mw-23'));
  assert.equal(k.mode, 'thermal'); near(k.thermal[2], 136.2, 3, 'WMAP K look'); assert.match(k.label, /MEASURED/);
  // deeper (longer λ) is warmer
  assert.ok(brightnessTempK('jupiter', nmAt(3.04)).T > brightnessTempK('jupiter', nmAt(10.46)).T);
});

test('Jupiter: synchrotron belts dominate below ~3 GHz, the thermal disc above ~5 GHz', () => {
  const lo = synchrotron('jupiter', nmAt(0.408)), mid = synchrotron('jupiter', nmAt(2.4)), hi = synchrotron('jupiter', nmAt(13.8));
  assert.ok(lo.fraction > 0.9 && mid.fraction > 0.5, 'belts dominate at 408 MHz and 2.4 GHz');
  assert.ok(hi.fraction < 0.1, 'thermal dominates at 13.8 GHz');
  assert.ok(lo.syncJy > 2 && lo.syncJy < 7, 'a few Jy at 4.04 AU');
  // disc flux sanity: 164 K at 13.18 GHz on a 4.04 AU disc is tens of Jy
  near(discFluxJy(164, 13.18, SYNCHROTRON.jupiter.discSr), 36, 4, 'thermal disc flux');
  const look = bandLook({ id: 'jupiter', name: 'Jupiter' }, ...at('radio', 'radio-408'));
  assert.ok(look.belts > 0.9); assert.match(look.label, /BELTS/); assert.match(look.detail, /synchrotron/i);
  assert.equal(bandLook({ id: 'jupiter', name: 'Jupiter' }, ...at('microwave', 'mw-94')).belts, undefined);
});

test('Saturn and its rings in the microwave (WMAP): disc 134–146 K, rings 7–20 K', () => {
  near(brightnessTempK('saturn', nmAt(93.5)).T, 146.0, 0.5, 'W disc');
  const r = ringBandLook({ id: 'saturn' }, ...at('microwave', 'mw-94'));
  assert.ok(r.visible); near(r.gain, 19.8 / 146.0, 0.02, 'ring/disc at W');
  assert.ok(ringBandLook({ id: 'saturn' }, ...at('microwave', 'mw-23')).gain < 0.06);
  assert.ok(ringBandLook({ id: 'saturn' }, ...at('xray', 'x-soft')).visible, 'O Kα rings (Chandra)');
  assert.ok(!ringBandLook({ id: 'saturn' }, ...at('gamma')).visible, 'no gamma detection');
});

test('Venus: hot surface at cm wavelengths, cooler atmosphere at mm (Butler 2001; Mohan 2019; Dahal 2023)', () => {
  near(brightnessTempK('venus', nmAt(4.86)).T, 680, 1, '4.86 GHz');
  near(brightnessTempK('venus', nmAt(1.298)).T, 622, 1, '1.3 GHz');
  near(brightnessTempK('venus', nmAt(93.7)).T, 355.6, 0.5, '93.7 GHz');
  near(brightnessTempK('venus', nmAt(217.5)).T, 294.7, 0.5, '217.5 GHz');
  const w = bandLook({ id: 'venus', name: 'Venus' }, ...at('microwave', 'mw-94'));
  assert.equal(w.mode, 'thermal', 'no longer the 12.6 cm emissivity map'); near(w.thermal[2], 356, 6, 'W band');
  assert.equal(bandLook({ id: 'venus', name: 'Venus' }, ...at('radio', 'radio-408')).mode, 'thermal', 'radar image not on 408 MHz');
  assert.match(bandLook({ id: 'venus', name: 'Venus' }, ...at('radio', 'radio-s')).source.hips, /Emissivity/, '12.6 cm passive radiometry is the emission map');
  assert.equal(bandLook({ id: 'venus', name: 'Venus' }, ...at('ir', 'ir-H')).glow, 7, 'night-side windows');
});

test('Uranus and Neptune: WMAP means', () => {
  near(brightnessTempK('uranus', nmAt(93.5)).T, 121, 1, 'Uranus W');
  near(brightnessTempK('neptune', nmAt(93.5)).T, 143, 1, 'Neptune W');
});

test('Mars in the microwave is the subsurface (WMAP 178–204 K), not the 290 K noon surface', () => {
  for (const p of ['mw-23', 'mw-94']) {
    const l = bandLook({ id: 'mars', name: 'Mars' }, ...at('microwave', p));
    assert.ok(l.thermal[0] < 260 && l.thermal[1] > 170, `${p} ${l.thermal}`);
    const mean = (l.thermal[0] + l.thermal[1]) / 2;
    assert.ok(mean > 178 - 10 && mean < 204 + 15, `${p} mean ${mean}`);
  }
});

test('the Moon at cm wavelengths: the diurnal swing is damped (Piddington & Minnett 1949)', () => {
  assert.ok(diurnalDamping(nmAt(1.4), 6, 10) < 0.05 && diurnalDamping(nmAt(94), 6, 10) > 0.3);
  const r = bandLook({ id: 'moon', name: 'Moon' }, ...at('radio', 'radio-hi'));
  assert.ok(r.thermal[0] - r.thermal[1] < 15, `21 cm swing ${r.thermal}`);
  assert.ok(r.thermal[0] > 200 && r.thermal[0] < 260);
  const ir = bandLook({ id: 'moon', name: 'Moon' }, ...at('ir', 'ir-W4'));
  assert.equal(ir.thermal[0], 390, 'the IR still sees the 390 K surface');
});

test('Europa and Ganymede are microwave-colder than their surfaces; Europa warms with frequency, Ganymede cools (Juno MWR)', () => {
  const t = (id, GHz) => subsurfaceTemps(id, nmAt(GHz), { airless: true, tss: id === 'europa' ? 132 : 152, night: 85 });
  for (const id of ['europa', 'ganymede']) for (const f of [0.6, 1.2, 2.5, 5.2, 10, 22]) assert.ok(t(id, f).day < (id === 'europa' ? 132 : 152), `${id} ${f} GHz`);
  assert.ok(t('europa', 0.6).day < t('europa', 22).day, 'Europa rises with frequency');
  assert.ok(t('ganymede', 0.6).day > t('ganymede', 22).day, 'Ganymede falls with frequency');
  const l = bandLook({ id: 'europa', name: 'Europa' }, ...at('microwave', 'mw-23'));
  assert.equal(l.mode, 'thermal'); assert.match(l.label, /SUBSURFACE/); assert.match(l.detail, /colder than its surface/);
  // Callisto's ALMA disc temperature (116 ± 5 K at 343 GHz) lies between the modelled night and day
  const c = subsurfaceTemps('callisto', nmAt(343), { airless: true, tss: 165, night: 80 });
  assert.ok(c.night < 116 && c.day > 116, `${c.night}–${c.day}`);
});

test('reflectance: the giants use the measured Karkoschka (1998) spectra', () => {
  const R = curve(reflectanceOf('jupiter'));
  near(R(890) / R(550), 0.084, 0.02, 'Jupiter 890 nm methane band');
  assert.ok(R(1000) / R(550) < 0.3, 'Jupiter at 1 µm is dark (the old table said ×0.82)');
  const U = curve(reflectanceOf('uranus'));
  assert.ok(U(1000) / U(550) < 0.05);
  const j = bandLook({ id: 'jupiter', name: 'Jupiter' }, ...at('visible', 'vis-ha'));
  assert.match(j.detail, /Karkoschka/);
  // the look under a real map (bandtextures asks for `${id}~`) keeps the body's own model
  assert.equal(bandLook({ id: 'mars~', name: 'Mars' }, ...at('ir', 'ir-12')).thermal[0], 290);
});

test('X-ray: cited detections and honest non-detections', () => {
  for (const id of ['uranus', 'pluto', 'io', 'europa', 'saturn', 'mercury']) {
    const l = bandLook({ id, name: id }, ...at('xray', 'x-soft'));
    assert.equal(l.mode, 'glow', id); assert.match(l.label, /DETECTED/, id);
  }
  assert.match(bandLook({ id: 'neptune', name: 'Neptune' }, ...at('xray', 'x-soft')).label, /PREDICTED/);
  assert.match(bandLook({ id: 'halley', name: '1P/Halley', comet: {} }, ...at('xray', 'x-soft')).label, /PREDICTED/, 'comet class known, this comet unobserved');
  assert.ok(SUN_SIGNATURES.xray, 'hard X-rays from flares');
  assert.equal(BODY_BAND.sun.xray, undefined, 'no 94 Å map on hard X-rays');
});

test('UV: aurorae in the far-UV, Lyman-α coronae', () => {
  assert.equal(bandLook({ id: 'ganymede', name: 'Ganymede' }, ...at('uv', 'uv-fuv')).glow, 5);
  assert.equal(bandLook({ id: 'jupiter', name: 'Jupiter' }, ...at('uv', 'uv-fuv')).glow, 5);
  assert.match(bandLook({ id: 'mars', name: 'Mars' }, ...at('uv', 'uv-lya')).label, /DETECTED/);
  assert.match(bandLook({ id: 'vesta', name: 'Vesta' }, ...at('uv', 'uv-lya')).label, /PREDICTED/, 'no longer NOT OBSERVED, and not claimed');
});

test('Io at 3–5 µm: volcanic hot spots, not a 130 K surface', () => {
  const l = bandLook({ id: 'io', name: 'Io' }, ...at('ir', 'ir-5'));
  assert.equal(l.glow, 6); assert.match(l.label, /DETECTED/);
});

test('BODY_BAND: every map has a credit and a wavelength range, and no thermal map stands in for reflected light', () => {
  for (const [body, m] of Object.entries(BODY_BAND)) for (const [key, s] of Object.entries(m)) {
    assert.ok(s.credit && Array.isArray(s.range) && s.range[0] < s.range[1], `${body}.${key}`);
  }
  assert.equal(bandLook({ id: 'mars', name: 'Mars' }, ...at('ir', 'ir-J')).mode, 'reflected', 'THEMIS 12.6 µm no longer on 2MASS J');
  assert.equal(bandLook({ id: 'titan', name: 'Titan' }, ...at('ir', 'ir-W4')).mode, 'thermal', 'ISS 938 nm no longer on 22 µm');
  assert.match(bandLook({ id: 'moon', name: 'Moon' }, ...at('visible', 'vis-R')).source.hips, /LROC-WAC/);
  assert.match(bandLook({ id: 'mercury', name: 'Mercury' }, ...at('visible', 'vis-i')).source.hips, /MDIS-LOI/);
});

test('tables cite real references, and only verified points are labelled MEASURED', () => {
  for (const [id, t] of Object.entries(BRIGHTNESS_T)) for (const [f, T, ref] of t) assert.ok(REFS[ref] && f > 0 && T > 0, `${id} ${f} ${ref}`);
  const est = bandLook({ id: 'uranus', name: 'Uranus' }, ...at('radio', 'radio-hi'));
  assert.match(est.label, /ESTIMATED/);
  for (const b of BANDS) for (const p of b.passes) for (const id of ['jupiter', 'saturn', 'venus', 'europa', 'moon']) {
    assert.notEqual(bandLook({ id, name: id }, b, p).tier === 'measured' && !bandLook({ id, name: id }, b, p).source, true, `${id} ${p.id}: only real maps are MEASURED`);
  }
});

test('the audit covers every body × band with a verdict and resolvable sources', () => {
  const a = JSON.parse(fs.readFileSync(new URL('../docs/research/band-audit.json', import.meta.url), 'utf8'));
  assert.equal(a.schema, 'fidelity.band-audit/1');
  const cells = new Set(a.rows.map((r) => `${r.body}|${r.band}`));
  for (const id of ['sun', 'jupiter', 'europa', 'io', 'rings', 'halley', '67p', 'arrokoth']) for (const b of BANDS.filter((x) => x.id !== 'full')) assert.ok(cells.has(`${id}|${b.id}`), `${id}|${b.id}`);
  for (const r of a.rows) {
    assert.ok(r.observed?.status && r.app?.after?.length, `${r.body}|${r.band}`);
    for (const s of r.sources) assert.ok(a.sources[s], `${r.body}|${r.band}: ${s}`);
  }
  for (const s of Object.values(a.sources)) assert.ok(s.doi ? /^10\.\d{4,}\//.test(s.doi) : true, s.cite);
  assert.ok(a.rows.find((r) => r.body === 'europa' && r.band === 'microwave').sources.includes('L25'));
});
