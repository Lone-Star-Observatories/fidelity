import test from 'node:test';
import assert from 'node:assert/strict';
import { raDecToUnit, skyBasis, imageAxes, paAxes, angularSizeArcmin, galToRaDec, MILKY_WAY } from '../src/data/skylayers.js';
import { GALAXY_IMAGES } from '../src/data/galaxy-images.js';
import { CONSTELLATION_LINES, CONSTELLATION_LABELS } from '../src/data/constellation-lines.js';

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const near = (a, b, t = 1e-9) => a.every((v, i) => Math.abs(v - b[i]) < t);

test('sky basis is orthonormal and north points to the pole', () => {
  for (const [ra, dec] of [[0, 0], [83.8, -5.4], [266.4, -29], [10.68, 41.27]]) {
    const u = raDecToUnit(ra, dec), { north, east } = skyBasis(ra, dec);
    assert.ok(Math.abs(dot(u, north)) < 1e-12 && Math.abs(dot(u, east)) < 1e-12 && Math.abs(dot(north, east)) < 1e-12);
    // stepping north raises the declination, east raises the RA
    const n = raDecToUnit(ra, dec + 0.01), e = raDecToUnit(ra + 0.01 / Math.cos((dec * Math.PI) / 180), dec);
    assert.ok(dot(n.map((v, i) => v - u[i]), north) > 0 && dot(e.map((v, i) => v - u[i]), east) > 0);
  }
});

test('image axes: north up, east left as seen from inside; AVM north angle turns the image', () => {
  const { up, right } = imageAxes(83.8, -5.4, 0), { north, east } = skyBasis(83.8, -5.4);
  assert.ok(near(up, north) && near(right, east.map((v) => -v)));
  const r90 = imageAxes(83.8, -5.4, 90); // north 90° left of vertical: the image's up is west
  assert.ok(near(r90.up, east.map((v) => -v)));
});

test('position angle measures from north through east', () => {
  const { north, east } = skyBasis(10.68, 41.27);
  assert.ok(near(paAxes(10.68, 41.27, 0).major, north) && near(paAxes(10.68, 41.27, 90).major, east));
});

test('galactic centre and pole land where they should', () => {
  const [ra, dec] = galToRaDec(0, 0); // Sgr A* region: RA 266.40°, Dec −28.94°
  assert.ok(Math.abs(ra - 266.405) < 0.01 && Math.abs(dec + 28.936) < 0.01, `${ra} ${dec}`);
  const [rp, dp] = galToRaDec(0, 90);
  assert.ok(Math.abs(rp - 192.859) < 0.01 && Math.abs(dp - 27.128) < 0.01);
});

test('angular sizes and the galaxy table', () => {
  assert.ok(Math.abs(angularSizeArcmin(46.6, 0.78) - 205) < 3); // M31's ~47 kpc disc at 0.78 Mpc is ~3.4°
  const m31 = GALAXY_IMAGES.find((g) => g.ungc === 'MESSIER031');
  assert.equal(m31.orient, 'measured');
  assert.ok(Math.abs(m31.axisRatio - 0.30) < 0.03); // i = 77° → b/a ≈ 0.30 (RC3: 190′ × 60′)
  for (const g of GALAXY_IMAGES) {
    assert.ok(g.img.key.startsWith('gal-') && /^[a-z0-9-]{1,32}$/.test(g.img.key), g.img.key);
    assert.ok(g.img.fov > g.d25, g.name);
    assert.ok(['measured', 'modelled'].includes(g.orient));
  }
  assert.equal(new Set(GALAXY_IMAGES.map((g) => g.img.key)).size, GALAXY_IMAGES.length);
  assert.match(MILKY_WAY.licence, /CC BY-SA/);
});

test('constellation data: all 88, polylines in range', () => {
  assert.equal(Object.keys(CONSTELLATION_LINES).length, 88);
  assert.equal(Object.keys(CONSTELLATION_LABELS).length, 88);
  for (const segs of Object.values(CONSTELLATION_LINES)) for (const s of segs) {
    assert.ok(s.length >= 4 && s.length % 2 === 0);
    for (let i = 0; i < s.length; i += 2) assert.ok(s[i] >= 0 && s[i] < 360 && Math.abs(s[i + 1]) <= 90);
  }
});
