import { test } from 'node:test';
import assert from 'node:assert/strict';
import { earthPole, moonAxes, poleStar, nutation, earthAxes } from '../src/astro/orientation.js';
import { moonGeocentric } from '../src/astro/moons.js';
import { gmstDeg } from '../src/astro/rotation.js';

const DEG = Math.PI / 180, E = 23.4392911 * DEG;
const eclToEq = ([x, y, z]) => [x, y * Math.cos(E) - z * Math.sin(E), y * Math.sin(E) + z * Math.cos(E)];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const jdOf = (y) => 2451545 + (y - 2000) * 365.25;

test('Moon IAU 2009: the near side faces Earth, librating about ±8° in longitude and ±7° in latitude', () => {
  let maxLon = 0, maxLat = 0, sumLon = 0, n = 0;
  for (let jd = 2461300; jd < 2461300 + 360; jd += 0.5) {
    const g = moonGeocentric(jd), r = Math.hypot(...g);
    const d = eclToEq(g.map((v) => -v / r)); // Moon → Earth
    const ax = moonAxes(jd);
    const lat = Math.asin(dot(d, ax.y)) / DEG, lon = Math.atan2(-dot(d, ax.z), dot(d, ax.x)) / DEG;
    maxLon = Math.max(maxLon, Math.abs(lon)); maxLat = Math.max(maxLat, Math.abs(lat)); sumLon += lon; n++;
  }
  assert.ok(maxLon > 6.5 && maxLon < 9, `lon ${maxLon}`);
  assert.ok(maxLat > 5.8 && maxLat < 7.5, `lat ${maxLat}`);
  assert.ok(Math.abs(sumLon / n) < 1.5, `mean lon ${sumLon / n}`);
});

test("Earth's pole precesses: Polaris now, Thuban in Egypt's pyramid age, Vega in ~14,000 AD", () => {
  const now = poleStar(jdOf(2026));
  assert.equal(now.name, 'Polaris'); assert.ok(now.sep < 0.8, String(now.sep));
  const pyramids = poleStar(jdOf(-2700));
  assert.equal(pyramids.name, 'Thuban'); assert.ok(pyramids.sep < 2.5, String(pyramids.sep));
  const vega = poleStar(jdOf(14000));
  assert.equal(vega.name, 'Vega'); assert.ok(vega.sep < 6, String(vega.sep));
  // the J2000 pole is ẑ to within nutation (~20″)
  const p = earthPole(2451545);
  assert.ok(Math.acos(p[2]) / DEG * 3600 < 25);
});

test('nutation is arcseconds; Earth axes keep sidereal time', () => {
  const { dpsi, deps } = nutation(2461300);
  assert.ok(Math.abs(dpsi) / DEG * 3600 < 20 && Math.abs(deps) / DEG * 3600 < 10);
  // at J2000 the prime meridian (x) is GMST from the equinox
  const ax = earthAxes(2451545);
  const g = Math.atan2(ax.x[1], ax.x[0]) / DEG;
  assert.ok(Math.abs(((g - gmstDeg(2451545) + 540) % 360) - 180) < 0.1, String(g));
});
