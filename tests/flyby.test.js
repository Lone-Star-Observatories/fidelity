// Gravity-assist routes (#45): the patched-conic model against flown missions (published values), the
// powered-flyby join, and the route search re-finding New Horizons' Jupiter window.
import test from 'node:test';
import assert from 'node:assert/strict';
import { flybyJoin, routeCost, searchSequence, sequencesFor, routePath, FLYBY } from '../src/astro/flyby.js';
import { planetPos } from '../src/astro/transfer.js';

const jd = (s) => Date.parse(s) / 864e5 + 2440587.5;
const close = (a, b, tol, msg = '') => assert.ok(Math.abs(a - b) <= tol, `${msg} ${a} vs ${b} (±${tol})`);
const pluto = { pos: planetPos('pluto'), massKg: 1.303e22, radiusKm: 1188 };
const mercury = { pos: planetPos('mercury'), massKg: 3.301e23, radiusKm: 2439.7 };

test('flyby join: an unpowered pass keeps |v∞| and finds the periapsis for the turn; bigger turns cost', () => {
  const v = 6, turn = (40 * Math.PI) / 180;
  const vin = [v, 0, 0], vout = [v * Math.cos(turn), v * Math.sin(turn), 0];
  const f = flybyJoin(vin, vout, 'jupiter');
  assert.ok(f.ok); close(f.turnDeg, 40, 1e-9); assert.ok(f.dv < 1e-9, 'no speed change, no burn');
  const mu = 6.6743e-20 * FLYBY.jupiter.massKg, e = 1 + (f.rp * v * v) / mu; // single-hyperbola check: δ = 2 asin(1/e)
  close(2 * Math.asin(1 / e) * 180 / Math.PI, 40, 1e-6);
  const g = flybyJoin([8, 0, 0], [0, 8.5, 0], 'mars'); // Mars cannot turn 8 km/s through 90°
  assert.equal(g.ok, false); assert.ok(g.dv > 1);
});

test('New Horizons (Earth → Jupiter → Pluto, flown dates): C3, Jupiter pass and Pluto speed match the mission', () => {
  const d0 = jd('2006-01-19T19:00Z'), j = jd('2007-02-28T05:43Z'), p = jd('2015-07-14T11:49Z');
  const r = routeCost(pluto, ['jupiter'], d0, [j - d0, p - j]);
  close(r.c3, 157.75, 3, 'launch C3 km²/s² (Guo & Farquhar 2008: 157.75)');
  close(r.flybys[0].rp / 69911, 32, 3, 'Jupiter closest approach in RJ (~2.3 million km, 32 RJ)');
  assert.ok(r.flybys[0].dv < 0.1, `Jupiter flyby essentially unpowered: ${r.flybys[0].dv}`);
  close(r.vinfArr, 13.78, 0.15, 'speed relative to Pluto at the encounter, km/s');
});

test('Mariner 10 (Earth → Venus → Mercury, flown dates): the Venus pass height matches', () => {
  const m0 = jd('1973-11-03T17:45Z'), mv = jd('1974-02-05T17:01Z'), mm = jd('1974-03-29T20:47Z');
  const r = routeCost(mercury, ['venus'], m0, [mv - m0, mm - mv]);
  close(r.flybys[0].altKm, 5768, 200, 'Venus closest approach altitude, km (NSSDC: 5,768 km)');
  assert.ok(r.flybys[0].dv < 0.1);
});

test('route search re-finds New Horizons\' window: a Jupiter assist launching in January 2006', async () => {
  const s = await searchSequence(pluto, 39.48, ['jupiter'], jd('2005-06-01T00:00Z'), { years: 2, stepDays: 10, maxDays: 10 * 365.25 });
  assert.ok(s.length >= 1);
  const best = s[0];
  close(best.depJd, jd('2006-01-19T19:00Z'), 30, 'departure (days)');
  close(best.flybys[0].jd, jd('2007-02-28T05:43Z'), 30, 'Jupiter flyby (days)');
  assert.ok(best.tofDays <= 10 * 365.25);
  const path = routePath(best, 20);
  assert.equal(path.length, 41); // two legs, shared joint
  const pj = planetPos('jupiter')(best.flybys[0].jd), atJ = path[20].slice(1);
  close(Math.hypot(pj[0] - atJ[0], pj[1] - atJ[1], pj[2] - atJ[2]), 0, 1e-6, 'the path meets Jupiter at the flyby (AU)');
});

test('sequences offered per target distance', () => {
  assert.deepEqual(sequencesFor(0.39, 'mercury'), [['venus']]);
  assert.deepEqual(sequencesFor(1.0, 'venus'), []);
  assert.deepEqual(sequencesFor(9.5, 'saturn'), [['jupiter'], ['venus', 'earth'], ['mars', 'jupiter']]);
  assert.ok(sequencesFor(39.5, 'pluto').some((s) => s.join() === 'jupiter,saturn'));
  assert.ok(!sequencesFor(5.2, 'jupiter').some((s) => s.includes('jupiter')));
});
