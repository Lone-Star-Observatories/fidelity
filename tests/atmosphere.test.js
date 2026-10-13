import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  venusAtmosphere, earthAtmosphere, atmosphereAt, CLOUD_LAYERS, murk, lightFraction, sunVisible, extinctionPerKm, visibilityKm,
  layerAt, descentAltitude, createDescent, startDescent, stepDescent, descentGauge, GROUND_EYE_KM, cloudColumn, sliceDraws, slicesInColumn, sliceAlpha,
} from '../src/astro/atmosphere.js';

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b} (±${tol})`);

test('Venus at the surface: ~92 bar and ~737 K (465 °C), as the Venera landers measured', () => {
  const s = venusAtmosphere(0);
  close(s.pBar, 92, 1, 'pressure');
  close(s.tK, 737, 5, 'temperature');
  close(atmosphereAt('venus', 0).tC, 462, 6, '°C');
});

test('Venus: ~1 bar (Earth sea-level pressure) near 50 km, in the cloud deck', () => {
  close(venusAtmosphere(50).pBar, 1.066, 1e-6);
  // 1 bar somewhere between 50 and 51 km, about 75 °C
  const z = [49, 50, 51, 52].find((h) => venusAtmosphere(h).pBar < 1);
  assert.ok(z >= 50 && z <= 52, `1 bar crossed near ${z} km`);
  close(venusAtmosphere(50.5).tK - 273.15, 72, 6, '°C at 50.5 km');
});

test('Venus profile: pressure falls monotonically, log-interpolated between table rows', () => {
  let prev = Infinity;
  for (let h = 0; h <= 100; h += 0.5) { const p = venusAtmosphere(h).pBar; assert.ok(p < prev, `p(${h})`); prev = p; }
  // geometric mean between rows (log-linear)
  close(venusAtmosphere(52.5).pBar, Math.sqrt(1.066 * 0.5314), 1e-9);
  // the lowlands below the 6,052 km sphere: higher pressure, extrapolated to −3 km, then clamped
  assert.ok(venusAtmosphere(-1).pBar > 92.1 && venusAtmosphere(-1).pBar < 100);
  assert.ok(venusAtmosphere(-1).tK > 735.3);
  assert.equal(venusAtmosphere(-5).pBar, venusAtmosphere(-3).pBar);
  assert.equal(venusAtmosphere(120).pBar, venusAtmosphere(100).pBar);
});

test('US Standard Atmosphere 1976: 1013.25 hPa and 288.15 K at sea level', () => {
  const s = earthAtmosphere(0);
  close(s.pHpa, 1013.25, 1e-6);
  close(s.tK, 288.15, 1e-9);
});

test('US Standard Atmosphere 1976 reference values (geometric altitude)', () => {
  // NOAA-S/T 76-1562 tables: 5 km 540.48 hPa 255.68 K; 11 km 226.99 hPa 216.77 K; 20 km 55.29 hPa 216.65 K; 32 km 8.89 hPa 228.49 K
  close(earthAtmosphere(5).pHpa, 540.48, 0.3, '5 km');
  close(earthAtmosphere(5).tK, 255.68, 0.05, '5 km T');
  close(earthAtmosphere(11).pHpa, 226.99, 0.3, '11 km');
  close(earthAtmosphere(11).tK, 216.77, 0.05, '11 km T');
  close(earthAtmosphere(20).pHpa, 55.29, 0.1, '20 km');
  close(earthAtmosphere(32).pHpa, 8.89, 0.03, '32 km');
  close(earthAtmosphere(32).tK, 228.49, 0.1, '32 km T');
  // 10 km, the assumed cloud height: 265.00 hPa (the table's 2.6500E+4 Pa), −50 °C
  close(earthAtmosphere(10).pHpa, 265.0, 0.1, '10 km');
});

test('the layers: Venus deck 48–70 km (measured), Earth 2–10 km where not measured (assumed)', () => {
  assert.equal(CLOUD_LAYERS.venus.baseKm, 48);
  assert.equal(CLOUD_LAYERS.venus.topKm, 70);
  assert.equal(CLOUD_LAYERS.venus.assumed, false);
  assert.equal(CLOUD_LAYERS.earth.topKm, 10);
  assert.equal(CLOUD_LAYERS.earth.baseKm, 2);
  assert.equal(CLOUD_LAYERS.earth.assumed, true);
  assert.ok(CLOUD_LAYERS.earth.shellKm >= Math.max(...CLOUD_LAYERS.earth.slicesKm), 'the outer shell holds every slice');
  assert.ok(CLOUD_LAYERS.venus.standKm > CLOUD_LAYERS.venus.topKm, 'double-click stands you on top of the clouds');
  assert.ok(CLOUD_LAYERS.earth.standKm > CLOUD_LAYERS.earth.topKm);
  assert.equal(layerAt('venus', 75), 'above');
  assert.equal(layerAt('venus', 60), 'in');
  assert.equal(layerAt('venus', 10), 'below');
  assert.equal(layerAt('earth', 12), 'above');
  assert.equal(layerAt('earth', 6), 'in');
  assert.equal(layerAt('earth', 1), 'below');
  assert.equal(layerAt('earth', 0.002), 'below');
});

test('descent through Venus: bright tops, murk ~48–70 km, clearing below 30 km; Sun hidden under the deck', () => {
  assert.ok(murk('venus', CLOUD_LAYERS.venus.standKm) < 0.3, 'tops: mostly clear');
  assert.ok(murk('venus', 60) > 0.9, 'in the deck');
  assert.ok(murk('venus', 40) > 0.2 && murk('venus', 40) < 0.9, 'lower haze');
  assert.equal(murk('venus', 20), 0);
  assert.ok(sunVisible('venus', 72));
  assert.ok(!sunVisible('venus', 50));
  assert.ok(!sunVisible('venus', 0));
  // a few % of the light at the ground
  const f = lightFraction('venus', 0);
  assert.ok(f > 0.01 && f < 0.05, `ground light ${f}`);
  assert.equal(lightFraction('venus', 80), 1);
  for (let h = 0; h < 70; h += 1) assert.ok(lightFraction('venus', h) <= lightFraction('venus', h + 1) + 1e-12);
  // a few km of visibility at the surface; tens of km by 30 km
  const v0 = visibilityKm(extinctionPerKm('venus', 0)), v30 = visibilityKm(extinctionPerKm('venus', 30));
  assert.ok(v0 > 2 && v0 < 10, `ground visibility ${v0}`);
  assert.ok(v30 > 15, `30 km visibility ${v30}`);
  assert.ok(visibilityKm(extinctionPerKm('earth', 0)) > 200);
});

test('Earth\'s cloud layer blinds only where there is cloud, through its whole depth', () => {
  for (const h of [2.5, 5, 9.5]) assert.ok(murk('earth', h, 1) > 0.8, `inside the assumed 2–10 km layer at ${h} km`);
  assert.equal(murk('earth', 6, 0), 0);
  assert.equal(murk('earth', CLOUD_LAYERS.earth.standKm, 1), 0, 'the standing point is clear of the tops');
  assert.equal(murk('earth', 0.002, 1), 0);
  // a measured low cloud deck: murk only around it
  const col = cloudColumn('earth', 1.5);
  assert.ok(col.measured && col.topKm === 1.5 && col.baseKm >= 0.3 && col.baseKm < 1.5);
  assert.ok(murk('earth', 1.2, 1, col) > 0.8);
  assert.equal(murk('earth', 5, 1, col), 0);
  assert.equal(layerAt('earth', 5, col), 'above');
});

test('the descent through Earth\'s assumed layer spends several seconds in cloud (not a blink)', () => {
  let st = createDescent('earth');
  st = startDescent(st, 'down', 0, CLOUD_LAYERS.earth.descentS);
  let inCloud = 0;
  for (let t = 0; t <= st.dur; t += 0.05) { if (murk('earth', stepDescent(st, t).altKm, 1) > 0.5) inCloud += 0.05; }
  assert.ok(inCloud > 4, `${inCloud.toFixed(1)} s in the murk`);
});

test('cloud slices: each column fills the slices from its base to its top, at least one, with the column\'s opacity', () => {
  const S = CLOUD_LAYERS.earth.slicesKm;
  assert.equal(slicesInColumn(10, 2, S), S.filter((h) => h >= 2 && h <= 10).length);
  assert.equal(slicesInColumn(0.6, 0.3, S), 1, 'a fog bank still draws the lowest slice');
  assert.ok(sliceDraws(12.5, 13, 9, S) && !sliceDraws(1, 13, 9, S));
  const n = 4, a = 0.7;
  close(1 - (1 - sliceAlpha(a, n)) ** n, a, 1e-12, 'stacked slices add up to the column');
});

test('descent altitude eases in log altitude from the tops to 2 m above the ground', () => {
  const top = CLOUD_LAYERS.venus.standKm;
  close(descentAltitude(top, GROUND_EYE_KM, 0), top, 1e-9);
  close(descentAltitude(top, GROUND_EYE_KM, 1), GROUND_EYE_KM, 1e-12);
  let prev = Infinity;
  for (let f = 0; f <= 1.0001; f += 0.05) { const a = descentAltitude(top, GROUND_EYE_KM, f); assert.ok(a <= prev + 1e-12); prev = a; }
  // halfway in time is the geometric middle of (altitude + 5 km): ~14 km, below the clouds
  close(descentAltitude(top, GROUND_EYE_KM, 0.5), Math.sqrt((top + 5) * (GROUND_EYE_KM + 5)) - 5, 1e-9);
  // the deck and the haze (70 → 30 km) take a fair share of the time (not a blink)
  const tAt = (h) => { let f = 0; while (descentAltitude(top, GROUND_EYE_KM, f) > h) f += 0.001; return f; };
  assert.ok(tAt(30) > 0.2, `haze passed at ${tAt(30)}`);
  assert.ok(1 - tAt(1) > 0.05, 'the last kilometre is not rushed');
});

test('DESCEND / ASCEND state machine', () => {
  let st = createDescent('venus');
  assert.equal(st.phase, 'top');
  close(st.altKm, CLOUD_LAYERS.venus.standKm, 1e-9);
  st = startDescent(st, 'down', 100, 30);
  assert.equal(st.phase, 'down');
  close(st.dur, 30, 1e-9);
  st = stepDescent(st, 115);
  assert.ok(st.altKm < CLOUD_LAYERS.venus.standKm && st.altKm > GROUND_EYE_KM);
  // reverse mid-way: ascending from where we are takes a share of the full time
  const mid = startDescent(st, 'up', 115, 30);
  assert.equal(mid.phase, 'up');
  assert.ok(mid.dur < 30 && mid.dur > 2);
  st = stepDescent(st, 131);
  assert.equal(st.phase, 'ground');
  close(st.altKm, GROUND_EYE_KM, 1e-12);
  assert.equal(startDescent(st, 'down', 140).phase, 'ground', 'already down');
  st = stepDescent(startDescent(st, 'up', 200, 30), 260);
  assert.equal(st.phase, 'top');
  // a world without a cloud layer stands on the ground
  assert.equal(createDescent('mars').phase, 'ground');
  assert.equal(createDescent('earth', { at: 'ground' }).phase, 'ground');
});

test('the descent gauge: full at the cloud tops, empty on the ground, falling (negative speed) all the way down', () => {
  const top = createDescent('earth');
  const g0 = descentGauge(top, 0, { baseKm: 2, topKm: 10 });
  assert.equal(g0.moving, false); close(g0.frac, 1, 1e-9, 'at the tops'); assert.equal(g0.vKmS, 0);
  assert.ok(g0.deck.base < g0.deck.top && g0.deck.top < 1, 'the deck sits below the standing height');
  const st = startDescent(top, 'down', 100, 30);
  let last = 1;
  for (let t = 100.5; t < 100 + st.dur; t += 0.5) {
    const g = descentGauge(stepDescent(st, t), t);
    assert.ok(g.moving && g.vKmS < 0, `falling at ${t}`);
    assert.ok(g.frac <= last + 1e-9, 'the marker only moves down'); last = g.frac;
    close(g.etaS, 100 + st.dur - t, 1e-9, 'seconds left');
  }
  const end = descentGauge(stepDescent(st, 100 + st.dur + 1), 200);
  assert.equal(end.phase, 'ground'); close(end.frac, 0, 1e-9, 'on the ground'); assert.equal(end.etaS, 0);
  const up = startDescent(end.phase === 'ground' ? stepDescent(st, 200) : st, 'up', 300, 30);
  assert.ok(descentGauge(stepDescent(up, 305), 305).vKmS > 0, 'climbing on the way up');
  assert.equal(descentGauge(null, 0), null);
});
