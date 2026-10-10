import { test } from 'node:test';
import assert from 'node:assert/strict';
import LA from '../src/data/la2004.js';
import { orbitAt, summer65N, insolation, perihelionLongitude, nextPerihelionAtJuneSolstice } from '../src/astro/milankovitch.js';
import { yearsToDrift, leapScenarios, dayLength, impactEnergyMt, craterKm, recurrenceYears } from '../src/astro/earthtime.js';
import { TIMELINE, TIMELINE_GROUPS } from '../src/data/earth-timeline.js';
import { parseCo2 } from '../server/co2.js';

const DEG = 180 / Math.PI;

test('La2004 today: e, obliquity and perihelion match J2000 values', () => {
  const o = orbitAt(LA, 0);
  assert.ok(Math.abs(o.e - 0.016702) < 1e-5);
  assert.ok(Math.abs(o.eps * DEG - 23.439) < 0.01);
  assert.ok(Math.abs(perihelionLongitude(o) - 282.9) < 0.5, 'perihelion in early January');
});

test('65° N June insolation against published values', () => {
  // Berger & Loutre 1991 / Laskar 2004: ~479 W/m² today (S0 ≈ 1365), ~525 at 11 ka, Eemian peak ~550, ~440 at 115 ka
  assert.ok(Math.abs(summer65N(orbitAt(LA, 0)) - 478) < 5);
  assert.ok(Math.abs(summer65N(orbitAt(LA, -11)) - 525) < 8);
  assert.ok(Math.abs(summer65N(orbitAt(LA, -127)) - 550) < 12);
  assert.ok(Math.abs(summer65N(orbitAt(LA, -115)) - 440) < 10);
  // obliquity bounds over the table: 22.1°–24.5°
  let lo = 99, hi = 0;
  for (let k = LA.from; k <= 1000; k += 1) { const e = orbitAt(LA, k).eps * DEG; lo = Math.min(lo, e); hi = Math.max(hi, e); }
  assert.ok(lo > 22 && lo < 22.2 && hi > 24.4 && hi < 24.6, `${lo} ${hi}`);
  // polar day at the solstice: 90° N gets more than the equator
  const o = orbitAt(LA, 0);
  assert.ok(insolation(o, 90, 90) > insolation(o, 0, 90));
  assert.equal(insolation(o, 80, 270), 0, 'polar night');
});

test('perihelion reaches the June solstice in ~10 kyr', () => {
  const k = nextPerihelionAtJuneSolstice(LA, 0);
  assert.ok(k > 8 && k < 12, String(k));
  const last = nextPerihelionAtJuneSolstice(LA, -25);
  assert.ok(last > -14 && last < -9, `last ${last} kyr (the Holocene insolation maximum)`);
});

test('leap minute and leap hour after 2035', () => {
  assert.ok(Math.abs(yearsToDrift(60, 0, 1.7) - 139) < 2);
  const s = leapScenarios();
  assert.ok(s.minute[0] > 50 && s.minute[1] < 200);
  assert.ok(s.hour[0] > 500 && s.hour[1] < 1500);
  assert.ok(Math.abs(dayLength(-7e7) - 23.55) < 0.05, '~23.5 h at 70 Ma (de Winter et al. 2020)');
});

test('impact energies, craters and recurrence', () => {
  assert.ok(Math.abs(impactEnergyMt(0.02, 19, 3300) - 0.5) < 0.2, 'Chelyabinsk ~0.4–0.5 Mt');
  const E1 = impactEnergyMt(1, 20, 3000);
  assert.ok(E1 > 5e4 && E1 < 1e5);
  assert.ok(craterKm(1, 20, 3000) > 10 && craterKm(1, 20, 3000) < 20);
  assert.ok(recurrenceYears(E1) > 3e5 && recurrenceYears(E1) < 1.5e6);
  assert.ok(craterKm(10, 20, 3000) > 80);
});

test('timeline catalogue', () => {
  const groups = new Set(TIMELINE_GROUPS.map(([g]) => g));
  for (const e of TIMELINE) {
    assert.ok(groups.has(e.group), e.id);
    assert.ok(['measured', 'computed', 'modelled', 'reported'].includes(e.tier), e.id);
    assert.ok(e.title && e.when && e.summary && e.source && /^https:\/\//.test(e.url), e.id);
    for (const f of e.facts) assert.ok(['measured', 'computed', 'modelled', 'reported'].includes(f[2]), `${e.id}: ${f[0]}`);
  }
  for (const e of TIMELINE.filter((x) => x.group === 'deep')) assert.equal(e.tier, 'modelled', `${e.id}: the deep future is modelled`);
  assert.equal(new Set(TIMELINE.map((e) => e.id)).size, TIMELINE.length);
});

test('NOAA Mauna Loa parser', () => {
  const rows = parseCo2('# comment\n 1958    3   1958.2027      315.71      314.44     -1   -9.99   -0.99\n 2026    9   2026.7083      426.07      429.55     18    0.51    0.23\n 1960 1 1960.04 -99.99 -99.99 -1 -9.99 -0.99\n');
  assert.deepEqual(rows, [[1958.2027, 315.71, 314.44], [2026.7083, 426.07, 429.55]]);
});

test('paleoclimate records: LGM, ice-core CO₂ range, ice volume', async () => {
  const { LR04, CO2, SEA_LEVEL } = await import('../src/data/paleo.js');
  const at = (rows, ka) => rows.find((r) => r[0] >= ka);
  assert.ok(at(SEA_LEVEL, 21)[1] < -100 && at(SEA_LEVEL, 21)[1] > -140, 'LGM sea level ~ −120 m');
  assert.ok(Math.abs(at(SEA_LEVEL, 125)[1]) < 20, 'Eemian near today');
  const ppm = CO2.map((r) => r[1]);
  assert.ok(Math.min(...ppm) > 165 && Math.min(...ppm) < 185 && Math.max(...ppm) < 305, '800 kyr range 172–300 ppm');
  assert.ok(Math.abs(at(CO2, 20)[1] - 190) < 15, 'LGM CO₂ ~190 ppm');
  assert.ok(at(LR04, 20)[1] > at(LR04, 0)[1] + 1, 'more ice (heavier δ¹⁸O) at the LGM');
  assert.ok(LR04.at(-1)[0] >= 2990 && SEA_LEVEL.at(-1)[0] >= 790);
});

test('Mars La2004: today and the 5 Myr range', async () => {
  const M = (await import('../src/data/la2004-mars.js')).default;
  const o = orbitAt(M, 0);
  assert.ok(Math.abs(o.eps * DEG - 25.19) < 0.05 && Math.abs(o.e - 0.0933) < 0.001);
  let lo = 99, hi = 0;
  for (let k = -5000; k <= 1000; k += 2) { const e = orbitAt(M, k).eps * DEG; lo = Math.min(lo, e); hi = Math.max(hi, e); }
  assert.ok(lo > 13 && lo < 17 && hi > 38 && hi < 46, `${lo} ${hi}`);
});

test('MIST solar track: phases, red-giant tip and white dwarf', async () => {
  const T = (await import('../src/data/sun-track.js')).default;
  const phases = new Set(T.map((r) => r[5]));
  for (const p of [0, 2, 3, 5, 6]) assert.ok(phases.has(p), `phase ${p}`);
  const tip = T.filter((r) => r[5] === 2).reduce((m, r) => (r[4] > m[4] ? r : m));
  assert.ok(10 ** tip[4] > 150 && 10 ** tip[4] < 260, 'RGB tip radius ~170–250 R☉');
  assert.ok(Math.abs(T.at(-1)[1] - 0.54) < 0.03, 'white dwarf ~0.54 M☉');
  for (let i = 1; i < T.length; i++) assert.ok(T[i][0] >= T[i - 1][0], 'ages increase');
});
