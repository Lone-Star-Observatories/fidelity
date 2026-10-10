import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dirToLatLon, latLonToDir, horizonFrame, lookAt, altAz, daylight } from '../src/views/system/surface.js';

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test('lat/lon round-trips through the sphere mapping; texture centre is lon 0', () => {
  for (const [lat, lon] of [[0, 0], [37.4, -122.1], [-33.9, 151.2], [89, 10], [0, 179.5]]) {
    const r = dirToLatLon(latLonToDir(lat, lon));
    close(r.lat, lat, 1e-9); close(r.lon, lon, 1e-9);
  }
  // u = 0.5 (texture centre) is +x in three's sphere: lon 0
  close(dirToLatLon([1, 0, 0]).lon, 0);
  // east of lon 0 is towards −z (counter-clockwise seen from +y north)
  assert.ok(dirToLatLon([0.9, 0, -0.1]).lon > 0);
});

test('horizon frame: looking up is the zenith, north points to the pole, east to the right of north', () => {
  const f = horizonFrame(latLonToDir(45, 0), [0, 1, 0]);
  const up = lookAt(f, 0, 90).dir;
  f.up.forEach((v, k) => close(up[k], v));
  assert.ok(f.north[1] > 0, 'north tilts towards the pole');
  close(altAz(f, f.east).az, 90);
  close(altAz(f, f.up).alt, 90);
  // camera-up is perpendicular to the look direction
  const { dir, camUp } = lookAt(f, 130, 20);
  close(dir[0] * camUp[0] + dir[1] * camUp[1] + dir[2] * camUp[2], 0, 1e-12);
  close(altAz(f, dir).alt, 20, 1e-9); close(altAz(f, dir).az, 130, 1e-9);
});

test('daylight: dark below civil twilight, full above +6°', () => {
  assert.equal(daylight(-10), 0);
  assert.equal(daylight(10), 1);
  close(daylight(0), 0.5);
});
