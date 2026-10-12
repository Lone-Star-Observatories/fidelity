import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moonOffsetKm, moonGeocentric } from '../src/astro/moons.js';
import { MOONS, SMALL_BODIES } from '../src/data/moons.js';
import { smallBodyPosition } from '../src/astro/smallbodies.js';
import { bodyVisualFor } from '../src/data/bespoke.js';

test('Nix is selectable with its own dossier and a nonsynchronous pending globe', () => {
  const nix = MOONS.find((m) => m.id === 'nix');
  assert.equal(nix.parent, 'pluto');
  assert.equal(bodyVisualFor(nix).id, 'nix');
  assert.equal(nix.surfacePending, true);
  assert.equal(nix.skin?.map, undefined);
  assert.equal(nix.locked, false);
  assert.notEqual(nix.rotationHours, nix.elements.P * 24);
  for (const jd of [2451545, 2461323.5]) {
    const position = moonOffsetKm(nix, jd);
    assert.ok(position.every(Number.isFinite));
    assert.ok(Math.hypot(...position) > 48000 && Math.hypot(...position) < 51000);
  }
});

test('Hydra resolves its own dossier without adopting another moon globe or synchronous spin', () => {
  const hydra = MOONS.find((m) => m.id === 'hydra');
  assert.equal(hydra.parent, 'pluto');
  assert.equal(bodyVisualFor(hydra).id, 'hydra');
  assert.equal(hydra.surfacePending, true);
  assert.equal(hydra.skin?.map, undefined);
  assert.equal(hydra.locked, false);
  assert.notEqual(hydra.rotationHours, hydra.elements.P * 24);
  for (const jd of [2451545, 2461323.5]) {
    const position = moonOffsetKm(hydra, jd);
    assert.ok(position.every(Number.isFinite));
    assert.ok(Math.hypot(...position) > 64000 && Math.hypot(...position) < 67000);
  }
});

// JPL Horizons vectors (DE441 + satellite ephemerides), J2000 ecliptic, 2026-10-10 00:00 TDB.
const JD = 2461323.5;
const HORIZONS_KM = {
  moon: [-3.804776331243345e5, -5.576748595162506e4, -2.202698759293144e4],
  io: [-1.812843286971416e5, 3.809940922551955e5, 1.118566670222863e4],
  ganymede: [-7.027541243850542e5, 8.103367773523524e5, 2.069799954001408e4],
  titan: [-8.815369352522208e5, -7.374122445313381e5, 4.679208942852982e5],
  iapetus: [2.218518651824504e6, -2.715421743022095e6, 1.788322187279101e5],
  triton: [-2.923903927662128e5, -5.791267339899929e4, 1.923402024902377e5],
  phobos: [8.070843916127465e3, -2.11158242129006e3, -3.973235004689258e3],
  titania: [-4.230481497277358e5, 8.380081770184654e4, -6.359737163708486e4],
  charon: [-2.340012699265188e3, -1.20642418877887e4, -1.526602751814425e4],
};
const HORIZONS_AU = {
  ceres: [0.1866051193173301, 2.659507306047761, 0.04981779317762139],
  eris: [85.07819882627396, 39.70440728720079, -17.23511185021151],
};
const angleDeg = (a, b) => Math.acos(Math.min(1, (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (Math.hypot(...a) * Math.hypot(...b)))) * 180 / Math.PI;
const byId = Object.fromEntries([...MOONS, ...SMALL_BODIES].map((m) => [m.id, m]));

test('the Moon (truncated ELP) matches Horizons to < 0.05° and 50 km', () => {
  const p = moonGeocentric(JD), h = HORIZONS_KM.moon;
  assert.ok(angleDeg(p, h) < 0.05, `angle ${angleDeg(p, h)}`);
  assert.ok(Math.abs(Math.hypot(...p) - Math.hypot(...h)) < 50);
});

// JPL mean-element geometry + phase fitted to Horizons (scripts/fit-moons.js); resonances and
// short-period terms remain, so allow a couple of degrees along the orbit.
const TOLERANCE = { io: 1, ganymede: 1, titan: 2.5, iapetus: 1.5, triton: 1, phobos: 3, titania: 1, charon: 1 };
for (const [id, tol] of Object.entries(TOLERANCE)) {
  test(`${id} mean-element position is within ${tol}° of Horizons`, () => {
    const p = moonOffsetKm(byId[id], JD), h = HORIZONS_KM[id];
    assert.ok(angleDeg(p, h) < tol, `angle ${angleDeg(p, h).toFixed(2)}°`);
    assert.ok(Math.abs(Math.hypot(...p) / Math.hypot(...h) - 1) < 0.06);
  });
}

test('small bodies from SBDB osculating elements match Horizons', () => {
  for (const id of ['ceres', 'eris']) {
    const p = smallBodyPosition(byId[id].elements, JD), h = HORIZONS_AU[id];
    assert.ok(angleDeg(p, h) < 0.1, `${id} angle ${angleDeg(p, h)}`);
    assert.ok(Math.abs(Math.hypot(...p) - Math.hypot(...h)) < 0.01 * Math.hypot(...h));
  }
});
