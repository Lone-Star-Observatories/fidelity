// Magnetic fields (#38): dipole tilts and strengths against published models, the Shue 1998
// magnetopause, and the geometry of dipole field lines.
import test from 'node:test';
import assert from 'node:assert/strict';
import { MAGNETIC, CRUSTAL, dipoleFromGauss, dipoleStrength, shue, dynamicPressure, magnetopauseR, bowShockR, fieldLines } from '../src/astro/magnetic.js';
import { DIPOLE_POLE } from '../src/views/system/zones.js';

const close = (a, b, tol, msg = '') => assert.ok(Math.abs(a - b) <= tol, `${msg} ${a} vs ${b} (±${tol})`);

test('Earth: IGRF-14 (2025) dipole: ~29,700 nT, tilt ~9.2°, pole near 80.8°N 72.7°W', () => {
  const e = MAGNETIC.earth;
  close(e.B0, 29733, 5, 'B0'); close(e.tiltDeg, 9.21, 0.02, 'tilt');
  close(e.poleLat, DIPOLE_POLE.lat, 0.1, 'pole latitude'); close(e.poleLon, DIPOLE_POLE.lon, 0.3, 'pole longitude');
  assert.equal(e.momentNorth, false, "Earth's moment points south");
});

test('giants and Mercury: published tilts and strengths', () => {
  const j = MAGNETIC.jupiter; // Connerney et al. 2018: 10.31° towards System III 196.61° W, ~4.17 G
  close(j.tiltDeg, 10.31, 0.01); close(360 - j.poleLon, 196.61, 0.01); close(j.B0 / 1e5, 4.17, 0.01); assert.ok(j.momentNorth);
  assert.ok(MAGNETIC.saturn.tiltDeg < 0.01); close(MAGNETIC.saturn.B0, 21191, 1);
  close(MAGNETIC.uranus.tiltDeg, 58.6, 0.05); close(MAGNETIC.uranus.offset[2], 0.31, 0.01); close(MAGNETIC.uranus.B0, 22800, 1);
  close(MAGNETIC.neptune.tiltDeg, 46.9, 0.05); close(MAGNETIC.neptune.offset[2], 0.55, 0.01); close(MAGNETIC.neptune.B0, 14200, 1);
  close(MAGNETIC.mercury.B0, 195, 1); close(MAGNETIC.mercury.offset[2], 0.196, 0.01); assert.equal(MAGNETIC.mercury.offset[0], 90, 'offset northwards');
  close(MAGNETIC.ganymede.B0, 719, 1); assert.equal(MAGNETIC.ganymede.upstream, 'flow');
  for (const [id, s] of Object.entries(MAGNETIC)) { assert.ok(s.source, id); assert.ok(s.standoff > 1, id); if (s.bowShock) assert.ok(s.bowShock > s.standoff, id); }
  assert.ok(CRUSTAL.mars.loops.every(([lat]) => lat < 0), 'Mars crustal field is in the south');
});

test('dipoleFromGauss: sign conventions', () => {
  const north = dipoleFromGauss(1000, 0, 0), south = dipoleFromGauss(-1000, 0, 0);
  assert.ok(north.momentNorth); assert.ok(!south.momentNorth);
  close(north.tiltDeg, 0, 1e-9); close(south.poleLat, 90, 1e-9);
});

test('Shue et al. 1998: ~10.2 R_E for 2 nPa and Bz = 0; compressed by pressure and southward IMF', () => {
  const nom = shue(2, 0);
  close(nom.r0, 10.25, 0.02); close(nom.alpha, 0.59, 0.01);
  close(shue(10, 0).r0, 8.03, 0.01, 'storm-time compression (10 nPa)');
  assert.ok(shue(2, -10).r0 < nom.r0, 'southward IMF erodes the dayside');
  close(dynamicPressure(5, 400), 1.338, 0.001);
  close(magnetopauseR(10, 0.6, 0), 10, 1e-9); close(magnetopauseR(10, 0.6, Math.PI / 2), 10 * 2 ** 0.6, 1e-9);
  close(bowShockR(13, 0), 13, 1e-9);
});

test('dipole field lines: r = L sin²θ, footpoints on the surface, |B| = B0 at the equator and 2 B0 at the pole', () => {
  close(dipoleStrength(1000, 1, Math.PI / 2), 1000, 1e-9); close(dipoleStrength(1000, 1, 0), 2000, 1e-9);
  const lines = fieldLines(30000, { shells: [2, 4], nPhi: 4, steps: 40 });
  assert.equal(lines.length, 8);
  for (const ln of lines) {
    const r = (p) => Math.hypot(p[0], p[1], p[2]);
    close(r(ln.points[0]), 1, 1e-9); close(r(ln.points.at(-1)), 1, 1e-9);
    const apex = ln.points[20]; close(r(apex), ln.L, 1e-9); close(apex[2], 0, 1e-9); close(apex[3], 30000 / ln.L ** 3, 1e-6);
  }
  assert.equal(fieldLines(1, { maxL: 5 }).every((l) => l.L <= 5), true);
});
