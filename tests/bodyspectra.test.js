import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePsg, parseXp, parseIpac, psgConfig, psgBodies } from '../server/bodyspectra.js';
import { SURVEYS, surveyList } from '../server/imagery.js';
import { FEEDS } from '../server/feeds.js';

test('PSG output parses into named columns', () => {
  const out = parsePsg(`# Radiance unit: Spectral radiance [W/sr/m2/um]
# Wave/freq Total Reflected Thermal
3.000000000e-01  6.58e-02  6.58e-02  1.6e-61
3.010000000e-01  7.38e-02  7.38e-02  2.6e-61
`);
  assert.deepEqual(out.wavelengthUm, [0.3, 0.301]);
  assert.deepEqual(out.total, [0.0658, 0.0738]);
  assert.equal(out.thermal.length, 2);
  // PSG sometimes names the object column after the body and gives no split
  const two = parsePsg('# Wave/freq Total Jupiter\n1 2 2\n');
  assert.equal(two.reflected, null);
  assert.deepEqual(two.total, [2]);
});

test('PSG configurations: Earth is seen from the Moon, everything else from Earth', () => {
  assert.match(psgConfig('earth', '2026-10'), /<GEOMETRY-REF>Moon/);
  assert.match(psgConfig('titan', '2026-10'), /<OBJECT>Moon\n<OBJECT-NAME>Titan\n<OBJECT-DATE>2026\/10\/15 00:00/);
  assert.ok(psgBodies().includes('ceres'));
});

test('Gaia XP sampled CSV parses', () => {
  const xp = parseXp('source_id,solution_id,ra,dec,wavelength,flux,flux_error\n1,2,3,4,336.0,1.04E-15,3.1E-16\n1,2,3,4,338.0,1.02E-15,2.4E-16\n');
  assert.deepEqual(xp.nm, [336, 338]);
  assert.equal(xp.flux[1], 1.02e-15);
});

test('IPAC tables from the Exoplanet Archive parse', () => {
  const t = parseIpac(`\\PL_NAME='WASP-39 b'
\\SPEC_TYPE='Eclipse'
|CENTRALWAVELNG|BANDWIDTH|ESPECLIPDEP|ESPECLIPDEPERR1|ESPECLIPDEPERR2|ESPECLIPDEPLIM|
|        double|   double|     double|         double|         double|          long|
|       microns|  microns|          %|               |               |              |
|          null|     null|       null|           null|           null|          null|
            3.6      null       0.088           0.015          -0.015              0
            4.5      null       0.096           0.018          -0.018              0
`);
  assert.equal(t.meta.SPEC_TYPE, 'Eclipse');
  assert.equal(t.rows.length, 2);
  assert.equal(t.rows[1].CENTRALWAVELNG, 4.5);
  assert.equal(t.rows[0].BANDWIDTH, null);
  assert.equal(t.rows[0].ESPECLIPDEPERR2, -0.015);
});

test('sky surveys span the spectrum and new live feeds are allowlisted', () => {
  const bands = new Set(Object.values(SURVEYS).map((s) => s.band));
  for (const b of ['gamma', 'x-ray', 'uv', 'visible', 'near-ir', 'mid-ir', 'far-ir', 'microwave', 'radio']) assert.ok(bands.has(b), b);
  // hidden surveys (single-band UV maps for the spectrum filter's Magellanic Clouds, #28) stay out of the cards' list
  assert.equal(Object.keys(surveyList()).length, Object.values(SURVEYS).filter((s) => !s.hidden).length);
  assert.ok(!surveyList().galexnuv && SURVEYS.galexnuv.format === 'png');
  for (const f of ['gong-halpha', 'moon-now', 'sdo-171', 'sdo-131', 'sdo-1600', 'sdo-hmimag', 'lasco-c2', 'lasco-c3']) assert.ok(FEEDS[f], f);
});
