import { test } from 'node:test';
import assert from 'node:assert/strict';
import { apparentMag, lightCurve, daysBrighterThan, sunLuminosity, habitableZone, earthLeavesHabitableZone, poleStarSequence, passingStarPull } from '../src/astro/future.js';
import { FUTURE_EVENTS, FUTURE_GROUPS } from '../src/data/future-events.js';
import { parseSentry, parseNeocc } from '../server/risk.js';

test('supernova brightness from distance', () => {
  // Betelgeuse at 548 ly with M = −16.7 peaks near the half Moon (the ticket's −10 to −12)
  const m = apparentMag(-16.7, 548);
  assert.ok(m < -10 && m > -11.5, String(m));
  assert.ok(Math.abs(apparentMag(0, 32.6156) - 0) < 1e-3, '10 pc: apparent = absolute');
  assert.equal(lightCurve(10, 'IIP'), 0);
  assert.ok(lightCurve(400, 'IIP') > lightCurve(100, 'IIP'));
  const day = daysBrighterThan(m, -4);
  assert.ok(day > 200 && day < 800, `daylight days ${day}`);
});

test('the Sun brightens and Earth leaves the habitable zone in ~1 Gyr', () => {
  assert.ok(Math.abs(sunLuminosity(0) - 1) < 1e-12);
  assert.ok(sunLuminosity(1) > 1.08 && sunLuminosity(1) < 1.11); // ~1% per 100 Myr
  const hz = habitableZone(1);
  assert.ok(hz.inner < 1 && hz.outer > 1.5);
  const t = earthLeavesHabitableZone();
  assert.ok(t > 0.9 && t < 1.3, String(t));
});

test('pole stars: Thuban, Polaris, Errai, Vega in their historical order', () => {
  const runs = poleStarSequence(-3000, 15000, 25).filter((r) => r.minSepDeg < 7);
  const names = runs.map((r) => r.name);
  for (const n of ['Thuban', 'Polaris', 'Errai', 'Alderamin', 'Deneb', 'Vega']) assert.ok(names.includes(n), n);
  const byName = Object.fromEntries(runs.map((r) => [r.name, r]));
  assert.ok(Math.abs(byName.Thuban.bestYear - -2800) < 400, 'Thuban ~2800 BCE');
  assert.ok(Math.abs(byName.Polaris.bestYear - 2100) < 100 && byName.Polaris.minSepDeg < 0.6, 'Polaris closest ~2100 at ~0.45°');
  assert.ok(Math.abs(byName.Vega.bestYear - 13800) < 1000, 'Vega ~AD 14,000');
  assert.ok(names.indexOf('Errai') < names.indexOf('Vega'));
});

test('Gliese 710 barely tugs on the planets', () => {
  const p = passingStarPull(0.65, 10600);
  assert.ok(p.direct < 1e-8 && p.tidal < 1e-11);
});

test('catalogue entries are complete and honest', () => {
  const groups = new Set(FUTURE_GROUPS.map(([g]) => g));
  for (const e of FUTURE_EVENTS) {
    assert.ok(groups.has(e.group), e.id);
    assert.ok(['computed', 'modelled', 'reported', 'measured'].includes(e.tier), e.id);
    assert.ok(e.title && e.when && e.summary && e.source && /^https:\/\//.test(e.url), e.id);
    if (e.sn) assert.equal(e.tier, 'modelled', `${e.id}: supernova timing is never COMPUTED`);
    if (e.years != null) assert.ok(Number.isFinite(e.years) && e.years >= 0, e.id);
  }
  assert.ok(FUTURE_EVENTS.find((e) => e.id === 'sirius').impossible);
  assert.equal(new Set(FUTURE_EVENTS.map((e) => e.id)).size, FUTURE_EVENTS.length);
});

test('impact-risk parsers', () => {
  const s = parseSentry({ data: [{ des: '101955', fullname: '101955 Bennu (1999 RQ36)', range: '2178-2290', ip: '5.7e-4', ps_cum: '-1.40', ps_max: '-1.58', ts_max: null, diameter: '0.49', v_inf: '5.99', n_imp: 157, last_obs: '2020-10-03' }] });
  assert.deepEqual([s[0].name, s[0].diameterM, s[0].psCum, s[0].ip], ['101955 Bennu (1999 RQ36)', 490, -1.4, 5.7e-4]);
  const text = ['Last Update: 2026-10-10 18:50 UTC', 'Num/des.           Name       |   m  |   *=Y   |      Date/Time   |  IP max  | PS max |TS  | Vel km/s | Years     | IP cum   | PS cum |',
    '2023VD3                       |   14 |    *    | 2034-11-08 17:08 |  2.35E-3 |  -2.67 |  0 |   21.01  | 2034-2039 |  2.35E-3 |  -2.67 |'].join('\n');
  const n = parseNeocc(text);
  assert.equal(n.length, 1);
  assert.deepEqual([n[0].des, n[0].diameterM, n[0].date, n[0].ipCum, n[0].psCum], ['2023VD3', 14, '2034-11-08 17:08', 2.35e-3, -2.67]);
});
