import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planck, rayleighJeans, planckBand, bandResponse, filter, ghz, effectiveNm, topHat } from '../src/astro/bands.js';
import { BANDS, bandById, passById } from '../src/data/bands.js';
import { bandLook, starBandDelta, SUN_SIGNATURES } from '../src/views/system/bandskin.js';

test('band-averaged Planck flux: a flat spectrum averages to itself, a blackbody to its in-band mean', () => {
  const V = filter('johnson-V');
  assert.ok(Math.abs(bandResponse(() => 3, V) - 3) < 1e-9);
  const avg = planckBand(5772, V), atCentre = planck(effectiveNm(V), 5772);
  assert.ok(Math.abs(avg / atCentre - 1) < 0.03, `${(avg / atCentre).toFixed(4)}`);
  assert.ok(Math.abs(effectiveNm(V) - 551) < 6, `V effective ${effectiveNm(V).toFixed(1)} nm`);
});

test('Vega-system zero point: a 9,600 K Vega (3.28 mas) gives F_V ≈ 3.6e-9 erg s⁻¹ cm⁻² Å⁻¹ (Bessell 1998)', () => {
  const th = 3.28e-3 / 206265 / 2;
  const flux = Math.PI * th * th * planckBand(9600, filter('johnson-V')) * 1e-7; // W m⁻² m⁻¹ → erg s⁻¹ cm⁻² Å⁻¹
  assert.ok(Math.abs(flux / 3.63e-9 - 1) < 0.15, `${flux.toExponential(3)}`);
});

test('Rayleigh–Jeans limit at radio wavelengths', () => {
  const f = ghz(0.38, 0.44);
  for (const T of [3, 30, 300, 1e4]) assert.ok(Math.abs(planckBand(T, f) / bandResponse((nm) => rayleighJeans(nm, T), f) - 1) < 0.005, `T ${T}`);
  assert.ok(planck(500, 5772) > rayleighJeans(500, 5772) * 0 && planck(500, 5772) < rayleighJeans(500, 5772), 'RJ overshoots at short wavelengths');
});

test('every bandpass has a transmission curve, and the SVO filters loaded', () => {
  for (const b of BANDS) for (const p of b.passes) assert.ok(p.filter?.points?.length > 1, p.id);
  assert.ok(filter('2mass-Ks') && filter('galex-FUV') && filter('miri-F2100W'));
});

test('the look rule: real image, else predicted from a signature, else not observed', () => {
  const at = (b, p) => { const band = bandById(b); return [band, passById(band, p)]; };
  assert.equal(bandLook({ id: 'mars', name: 'Mars' }, ...at('ir', 'ir-12')).mode, 'real');
  assert.equal(bandLook({ id: 'venus', name: 'Venus' }, ...at('radio', 'radio-s')).mode, 'real');
  const j = bandLook({ id: 'jupiter', name: 'Jupiter' }, ...at('ir', 'ir-Ks'));
  assert.equal(j.mode, 'reflected'); assert.ok(j.gain < 0.2, 'methane makes Jupiter dark at 2.2 µm');
  const v = bandLook({ id: 'venus', name: 'Venus' }, ...at('uv', 'uv-nuv'));
  assert.ok(v.gain < 0.5, 'the UV absorber darkens Venus');
  assert.equal(bandLook({ id: 'moon', name: 'Moon' }, ...at('ir', 'ir-W4')).mode, 'thermal');
  assert.equal(bandLook({ id: 'moon', name: 'Moon' }, ...at('gamma')).mode, 'glow');
  // every solid body and atmosphere glows under cosmic rays: detections are cited, the rest predicted
  assert.match(bandLook({ id: 'moon', name: 'Moon' }, ...at('gamma')).label, /DETECTED/);
  assert.match(bandLook({ id: 'mars', name: 'Mars' }, ...at('gamma')).label, /DETECTED/);
  const sat = bandLook({ id: 'saturn', name: 'Saturn' }, ...at('gamma'));
  assert.equal(sat.mode, 'glow'); assert.match(sat.label, /PREDICTED/); assert.equal(sat.glow, 4, 'an atmosphere glows at the limb');
  assert.equal(bandLook({ id: 'iapetus', name: 'Iapetus' }, ...at('gamma')).glow, 1, 'an airless surface glows across its disc');
  assert.equal(bandLook({ id: 'juno', name: 'Juno', kind: 'spacecraft' }, ...at('gamma')).mode, 'dark');
});

test('stars: cool ones brighten in the infrared, hot ones in the ultraviolet (Vega system)', () => {
  const Ks = passById(bandById('ir'), 'ir-Ks'), FUV = passById(bandById('uv'), 'uv-fuv');
  assert.ok(starBandDelta(3500, Ks) > 2.5 && starBandDelta(20000, Ks) < 0);
  assert.ok(starBandDelta(20000, FUV) > 0 && starBandDelta(4000, FUV) < -5);
  assert.ok(Math.abs(starBandDelta(9600, Ks)) < 1e-9, 'Vega is colour 0');
  assert.equal(starBandDelta(5772, passById(bandById('gamma'))), -Infinity); // a photosphere alone; the Sun's measured signatures are separate
  for (const b of ['gamma', 'radio', 'microwave']) assert.ok(SUN_SIGNATURES[b], `the Sun is a measured ${b} source`);
  assert.ok(topHat(500, 600).points.length > 2);
});
