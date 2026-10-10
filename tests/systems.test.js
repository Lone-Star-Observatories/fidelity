import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildStarSystem, transitMeanAnomaly, radiusFromMass, discoveryMethod, solSystem } from '../src/data/systems.js';
import { positionAt } from '../src/astro/kepler.js';

const star = (extra = {}) => ({ id: 'x', name: 'Test', x: 10, y: 0, z: 0, distPc: 10, distLy: 32.6, spect: 'M5V', ci: 1.8, lum: 0.001, source: 'HYG v4', ...extra });
const tierOf = (body, group, label) => body.facts[group].find((f) => f.label === label)?.tier;

test('transiting planet: measured radius, transit-timed phase, edge-on plane', () => {
  const m = buildStarSystem({
    star: star(),
    host: { st_teff: 2566, st_rad: 0.119, st_mass: 0.0898, st_lum: -3.26 },
    planets: [{ pl_name: 'T b', pl_letter: 'b', pl_orbper: 1.51, pl_orbsmax: 0.0115, pl_orbeccen: null, tran_flag: 1, pl_tranmid: 2457322.5, pl_rade: 1.1, pl_bmasse: 1.37, pl_bmassprov: 'Mass', pl_eqt: 400, disc_method: 'tran' }],
  });
  const b = m.bodies.find((x) => x.id === 'b');
  assert.equal(m.transiting, true);
  assert.equal(tierOf(b, 'PHYSICAL', 'RADIUS'), 'measured');
  assert.equal(tierOf(b, 'ORBIT', 'POSITION IN ORBIT'), 'computed');
  assert.equal(tierOf(b, 'ORBIT', 'ECCENTRICITY'), 'imagined'); // unknown → assumed circular
  assert.equal(b.facts.DISCOVERY[0].value, 'TRANSIT');
  // the orbit plane contains the line of sight to Sol
  const n = m.planeNormal, s = m.solDirection;
  assert.ok(Math.abs(n[0] * s[0] + n[1] * s[1] + n[2] * s[2]) < 1e-9);
  assert.ok(m.scale < 0.05); // compact system → enhanced sizes scaled down
});

test('radial-velocity planet: minimum mass, modelled radius, unknown phase and plane', () => {
  const m = buildStarSystem({
    star: star(),
    host: { st_mass: 0.12 },
    planets: [{ pl_name: 'R b', pl_letter: 'b', pl_orbper: 11.2, pl_orbsmax: null, tran_flag: 0, pl_rade: 1.0, pl_bmasse: 1.07, pl_bmassprov: 'Msini' }],
  });
  const b = m.bodies.find((x) => x.id === 'b');
  assert.equal(m.transiting, false);
  assert.equal(tierOf(b, 'PHYSICAL', 'RADIUS'), 'modelled');
  assert.ok(b.facts.PHYSICAL.some((f) => f.label === 'MINIMUM MASS'));
  assert.equal(tierOf(b, 'ORBIT', 'POSITION IN ORBIT'), 'imagined');
  assert.equal(tierOf(b, 'ORBIT', 'ORBIT PLANE'), 'imagined');
  // Kepler's third law filled the missing semi-major axis: a³ = M P²
  const a = Math.cbrt(0.12 * (11.2 / 365.25) ** 2);
  assert.ok(Math.abs(b.orbit.a - a) < 1e-12);
});

test('star with no known planets says so', () => {
  const m = buildStarSystem({ star: star(), host: null, planets: [] });
  assert.equal(m.bodies.length, 1);
  assert.match(m.notes[0], /No planets are known/);
});

test('transitMeanAnomaly puts the planet on the +x axis (towards Sol) at mid-transit', () => {
  for (const [e, w] of [[0, 0], [0.2, 1.1], [0.5, -2.3]]) {
    const [x, y] = positionAt({ a: 1, e, I: 0, node: 0, peri: w }, transitMeanAnomaly(e, w));
    assert.ok(x > 0 && Math.abs(Math.atan2(y, x)) < 1e-9, `e=${e} ω=${w}`);
  }
});

test('radiusFromMass follows the Chen & Kipping regimes', () => {
  assert.ok(Math.abs(radiusFromMass(1) - 1) < 1e-12);
  assert.ok(radiusFromMass(17) > 3 && radiusFromMass(17) < 5); // Neptune-ish
  assert.equal(radiusFromMass(300), 12.1);
});

test('discovery method codes are spelled out', () => {
  assert.equal(discoveryMethod('rv'), 'RADIAL VELOCITY');
  assert.equal(discoveryMethod('Transit'), 'TRANSIT');
  assert.equal(discoveryMethod('Something New'), 'SOMETHING NEW');
});

test('Sol model: Sun, nine major bodies, moons on real parents, small bodies', () => {
  const m = solSystem();
  assert.equal(m.bodies.filter((b) => b.orbit?.type === 'sol' || b.kind === 'star').length, 10);
  const ids = new Set(m.bodies.map((b) => b.id));
  const moons = m.bodies.filter((b) => b.kind === 'moon');
  assert.ok(moons.length >= 20 && moons.every((b) => ids.has(b.parent)));
  assert.ok(m.bodies.some((b) => b.id === 'ceres' && b.orbit.type === 'elements'));
  assert.equal(ids.size, m.bodies.length, 'ids are unique');
  assert.equal(m.sector, 'SECTOR 001');
  assert.ok(m.bodies.every((b) => b.facts.PHYSICAL.length));
});
