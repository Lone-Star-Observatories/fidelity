import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createShipCalc, evaluate, elementsFromState, durationWords, CALC_TOOLS } from '../src/voice/shipcalc.js';
import { heliocentric } from '../src/astro/kepler.js';
import { SUN, PLANETS } from '../src/data/sol.js';
import { MOONS, SMALL_BODIES } from '../src/data/moons.js';

// JPL Horizons, 2026-10-10 00:00 UT: heliocentric states and geocentric observer quantities
const fx = JSON.parse(fs.readFileSync(new URL('./fixtures/horizons-observer-2026-10-10.json', import.meta.url)));
const jd0 = fx.jdUT;
const BODIES = [SUN, ...PLANETS, ...MOONS.map((m) => ({ ...m, kind: m.kind ?? 'moon' })), ...SMALL_BODIES];
const lin = (id) => (jd) => (id === 'sun' ? [0, 0, 0] : fx.bodies[id].pos.map((p, i) => p + fx.bodies[id].vel[i] * (jd - jd0)));
const horizonsCalc = createShipCalc({ bodies: () => BODIES, posAU: (id, jd) => lin(id)(jd), jd: () => jd0, source: () => 'JPL Horizons (fixture)',
  stars: () => [{ name: 'Proxima Centauri', x: -0.4721, y: -0.3615, z: -1.1504 }] });
const keplerCalc = createShipCalc({ bodies: () => BODIES, posAU: (id, jd) => (id === 'sun' ? [0, 0, 0] : heliocentric(id, jd)), jd: () => jd0, source: () => 'Kepler' });

test('body_state matches JPL Horizons: distance, light time, sky position, phase and magnitude', () => {
  for (const id of ['mars', 'jupiter', 'saturn', 'venus']) {
    const h = fx.bodies[id], s = horizonsCalc.run('body_state', { name: id });
    assert.equal(s.ok, true, id);
    assert.ok(Math.abs(s.distance_from_earth_au / h.delta - 1) < 2e-5, `${id} Δ ${s.distance_from_earth_au} vs ${h.delta}`);
    assert.ok(Math.abs(s.distance_from_sun_au / h.r - 1) < 2e-5, `${id} r`);
    assert.ok(Math.abs(s.elongation_from_sun_deg - h.elong) < 0.02, `${id} elongation`);
    assert.ok(Math.abs(s.illuminated_percent - h.illum) < 0.05, `${id} illumination`);
    assert.ok(Math.abs(s.apparent_magnitude - h.mag) < 0.03, `${id} mag ${s.apparent_magnitude} vs ${h.mag}`);
    assert.equal(s.tier, 'COMPUTED');
  }
  const mars = horizonsCalc.run('body_state', { name: 'Mars' });
  assert.equal(mars.constellation, 'Cancer');
  assert.match(mars.light_time_from_earth, /^13 min \d+ s$/, mars.light_time_from_earth); // 1.602 AU ≈ 13.3 light-minutes
  assert.match(mars.sky, /morning/); // Horizons: 69.9° west of the Sun
});

test('orbit gives the osculating elements: Mars about the Sun, the Moon about Earth', () => {
  const m = keplerCalc.run('orbit', { name: 'Mars' });
  assert.ok(Math.abs(parseFloat(m.semi_major_axis) - 1.5237) < 0.002, m.semi_major_axis);
  assert.ok(Math.abs(m.eccentricity - 0.0934) < 0.002, String(m.eccentricity));
  assert.ok(Math.abs(m.inclination_to_ecliptic_deg - 1.85) < 0.02);
  assert.match(m.period, /^68[67] days$/, m.period);
  const moon = horizonsCalc.run('orbit', { name: 'Moon' });
  assert.equal(moon.about, 'Earth');
  const a = parseFloat(moon.semi_major_axis);
  assert.ok(a > 370000 && a < 400000, `Moon a ${a} km`); // osculating: mean 384,400 km, varies a few %
  assert.ok(moon.eccentricity > 0.02 && moon.eccentricity < 0.09);
  assert.match(moon.period, /^2[6-8]\.\d+ days$/, moon.period);
  // a circular orbit's elements from its state, exactly
  const mu = 398600.4418, r = 7000, el = elementsFromState([r, 0, 0], [0, Math.sqrt(mu / r), 0], mu);
  assert.ok(Math.abs(el.a_km - r) < 1e-6 && el.e < 1e-9 && Math.abs(el.period_s - 2 * Math.PI * Math.sqrt(r ** 3 / mu)) < 1e-6);
  assert.equal(elementsFromState([r, 0, 0], [0, 1.5 * Math.sqrt((2 * mu) / r), 0], mu).bound, false, 'faster than escape: hyperbolic');
});

test('distance and travel time, to planets and to stars', () => {
  const d = horizonsCalc.run('distance', { from: 'Earth', to: 'Jupiter' });
  assert.ok(Math.abs(d.distance_au / fx.bodies.jupiter.delta - 1) < 0.003, 'geometric vs light-time-corrected: within a few light-minutes of motion');
  const p = horizonsCalc.run('distance', { to: 'Proxima Centauri', fraction_of_c: 0.1 });
  assert.ok(Math.abs(p.distance_ly - 4.24) < 0.02, `${p.distance_ly} ly`);
  assert.match(p.travel_time_straight_line, /^42\.\d+ years$/);
  assert.equal(horizonsCalc.run('distance', { to: 'Vulcan' }).ok, false, 'unknown bodies are refused, not invented');
});

test('transfer: the 2026 Mars window opens around November 2026', () => {
  const t = keplerCalc.run('transfer', { to: 'Mars', windows: 1 });
  assert.equal(t.ok, true);
  assert.match(t.hohmann_flight_time, /^2[45]\d\.?\d* days$/, t.hohmann_flight_time); // 259 days
  const w = t.next_windows[0];
  assert.ok(w.depart >= '2026-10-01' && w.depart <= '2027-01-31', w.depart);
  assert.ok(w.c3_km2_s2 > 7 && w.c3_km2_s2 < 16, `C3 ${w.c3_km2_s2}`);
  assert.ok(w.dv_depart_km_s > 3.4 && w.dv_depart_km_s < 4.1, `TMI ${w.dv_depart_km_s}`);
});

test('sky_events: the next eclipses after 2026-10-10 are those of the Five Millennium Canon', () => {
  const s = keplerCalc.run('sky_events', { kind: 'solar eclipse', count: 2 });
  assert.match(s.events[0].event, /annular solar eclipse/);
  assert.equal(s.events[0].when.slice(0, 10), '2027-02-06');
  assert.equal(s.events[1].when.slice(0, 10), '2027-08-02'); // the long total eclipse over Egypt
  const l = keplerCalc.run('sky_events', { kind: 'lunar eclipse', count: 1 });
  assert.equal(l.events[0].when.slice(0, 10), '2027-02-20');
});

test('calculate: SI arithmetic with constants, and nothing but arithmetic', () => {
  assert.ok(Math.abs(evaluate('au / c') - 499.004784) < 1e-5);
  assert.ok(Math.abs(evaluate('sqrt(G*mearth/rearth)') - 7905.4) < 0.5, 'first cosmic velocity');
  assert.equal(evaluate('2^10'), 1024); assert.equal(evaluate('-2^2'), -4); assert.equal(evaluate('3 km'), 3000);
  assert.ok(Math.abs(evaluate('sin(deg(30))') - 0.5) < 1e-12);
  for (const bad of ['process.exit()', 'constructor', 'alert(1)', '1/0', '(1']) assert.throws(() => evaluate(bad), bad);
  assert.equal(horizonsCalc.run('calculate', { expression: 'window' }).ok, false);
});

test('every calculator is offered to the Computer as a tool, and durations read naturally', () => {
  assert.deepEqual(CALC_TOOLS.map((t) => t.name).sort(), Object.keys(horizonsCalc.tools).sort());
  assert.equal(durationWords(499), '8 min 19 s');
  assert.equal(durationWords(5 * 3600), '5 h');
});
