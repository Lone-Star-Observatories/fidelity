import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  METERS, fitDistance, viewWidth, enclosingSphere, formatLength, spanReadout, fieldReadout, flySpeed,
  sliderFromDistance, distanceFromSlider, zoomed, encodeCamera, decodeCamera, halfFovH,
} from '../src/views/cameraMath.js';

const DEG = Math.PI / 180;
const close = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} ≈ ${b}`);

test('fill view: the sphere touches the narrower half field (with margin 1)', () => {
  // wide viewport: limited by the vertical field
  const d = fitDistance(1, 50, 16 / 9, 1);
  close(Math.asin(1 / d), 25 * DEG);
  // tall viewport: limited by the horizontal field
  const t = fitDistance(1, 50, 0.5, 1);
  close(Math.asin(1 / t), halfFovH(50, 0.5));
  assert.ok(t > d, 'a tall, narrow view has to stand further back');
  // linear in radius; the margin backs off proportionally
  close(fitDistance(6371, 50, 1.6), 6371 * fitDistance(1, 50, 1.6));
  close(fitDistance(1, 50, 1, 1.2), 1.2 * fitDistance(1, 50, 1, 1));
  // Earth (r = 4.26e-5 AU) in a 50° field fills it from ~1e-4 AU
  close(fitDistance(4.2635e-5, 50, 1, 1), 4.2635e-5 / Math.sin(25 * DEG));
});

test('view width at a distance', () => {
  close(viewWidth(1, 90, 1), 2);
  close(viewWidth(10, 50, 2), 2 * 10 * Math.tan(25 * DEG) * 2);
});

test('a group of spheres is enclosed', () => {
  const s = enclosingSphere([{ c: [-1, 0, 0], r: 0.5 }, { c: [3, 0, 0], r: 1 }]);
  assert.deepEqual(s.c, [1.25, 0, 0]);
  close(s.r, 2.75);
  assert.equal(enclosingSphere([]), null);
  const one = enclosingSphere([{ c: [5, 5, 5], r: 2 }]);
  assert.deepEqual(one, { c: [5, 5, 5], r: 2 });
});

test('lengths read in the unit an astronomer would use', () => {
  assert.equal(formatLength(120), '120 M');
  assert.equal(formatLength(0.6), '0.6 M');
  assert.equal(formatLength(12742e3), '12,742 KM');
  assert.equal(formatLength(4.5e9), '4.5 MILLION KM');
  assert.equal(formatLength(12 * METERS.au), '12 AU');
  assert.equal(formatLength(0.38 * METERS.au), '0.38 AU');
  assert.equal(formatLength(4.2 * METERS.ly), '4.2 LY');
  assert.equal(formatLength(100 * METERS.kly), '100 KLY');
  assert.equal(formatLength(2.5 * METERS.mly), '2.5 MLY');
  assert.equal(formatLength(13.8e9 * METERS.ly), '14 GLY');
  assert.equal(formatLength(NaN), '—');
  assert.equal(spanReadout(12 * METERS.au), 'VIEW 12 AU ACROSS');
});

test('field of view read-out', () => {
  assert.equal(fieldReadout(0.6), '0.6° FIELD');
  assert.equal(fieldReadout(50), '50° FIELD');
  assert.equal(fieldReadout(6.25), '6.3° FIELD');
  assert.equal(fieldReadout(0.05), '3′ FIELD');
  assert.equal(fieldReadout(0), '—');
});

test('fly speed scales with the distance to the nearest body, 100 m to 100 Mly', () => {
  const m100 = 100 / METERS.au; // 100 m in the System View's AU
  close(flySpeed(m100) * METERS.au, 80, 1e-9); // 80 m/s at 100 m up
  close(flySpeed(100), 80); // 100 Mly away in the Universe View: 80 Mly/s
  // proportional: ten times further, ten times faster
  close(flySpeed(1e3 * m100) / flySpeed(m100), 1e3);
  assert.equal(flySpeed(0, { min: 1e-12 }), 1e-12);
  assert.equal(flySpeed(1e9, { max: 5 }), 5);
  assert.equal(flySpeed(-2), flySpeed(2));
});

test('zoom slider is logarithmic and invertible; zoom steps clamp', () => {
  assert.equal(sliderFromDistance(1, 1, 100), 1);
  assert.equal(sliderFromDistance(100, 1, 100), 0);
  close(sliderFromDistance(10, 1, 100), 0.5);
  for (const d of [1e-9, 3e-5, 0.02, 7]) close(distanceFromSlider(sliderFromDistance(d, 1e-10, 1e3), 1e-10, 1e3), d);
  close(zoomed(10, 1), 8);
  close(zoomed(10, -1), 12.5);
  assert.equal(zoomed(10, 5, 9), 9);
  assert.equal(zoomed(10, -50, 0, 20), 20);
});

test('camera bookmarks round-trip', () => {
  const s = { mode: 'fly', p: [1.234567891e-9, -0.5, 30.1], q: [0, 0.70710678, 0, 0.70710678], fov: 42.5 };
  const str = encodeCamera(s);
  assert.match(str, /^f,/);
  const back = decodeCamera(str);
  assert.equal(back.mode, 'fly');
  back.p.forEach((v, i) => close(v, s.p[i], 1e-6));
  back.q.forEach((v, i) => close(v, s.q[i], 1e-4));
  assert.equal(back.fov, 42.5);
  assert.equal(back.t, null);
  const o = decodeCamera(encodeCamera({ mode: 'orbit', p: [1, 2, 3], q: [0, 0, 0, 1], fov: 50, t: [4, 5, 6] }));
  assert.deepEqual(o.t, [4, 5, 6]);
  assert.deepEqual(decodeCamera(encodeCamera({ mode: 'surface', az: 120.5, alt: 30, fov: 0.6 })), { mode: 'surface', az: 120.5, alt: 30, fov: 0.6 });
  for (const bad of [null, '', 'x,1,2', 'o,1,2,3', 'o,1,2,3,0,0,0,0,50', 'o,1,2,3,0,0,0,1,500', 'o,a,2,3,0,0,0,1,50']) assert.equal(decodeCamera(bad), null, String(bad));
});
