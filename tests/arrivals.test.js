// Navigation deep time: stars that arrive (#29).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coverageKms, needOuter, completeness, badgeLines, brightLimit, spanFor, INNER_LY, OUTER_LY } from '../src/views/navigation/drift.js';
import { applyGaia, densityProfile } from '../server/stars.js';
import { parseHipMotions } from '../server/gaia.js';
import { spaceMotion } from '../src/astro/spacemotion.js';

test('coverage: the loaded shell accounts for stars slower than (loaded − radius) / time', () => {
  assert.equal(coverageKms(1000, 100, 0), Infinity);
  // 900 ly in 3 Myr = 300 ly/Myr ≈ 90 km/s
  assert.ok(Math.abs(coverageKms(1000, 100, -3e6) - 89.9) < 0.2);
  assert.equal(needOuter(10, 1e5), false);
  assert.equal(needOuter(10, 1e6), true); // 240 ly in 1 Myr covers only ~72 km/s
  assert.equal(spanFor(4e6).spanMyr, 5);
  assert.equal(spanFor(-6e6).spanMyr, 50);
  assert.ok(INNER_LY < OUTER_LY);
});

test('completeness and the bright-star limit', () => {
  const rho = 3.5e-3; // HYG within 20 ly of Sol, stars per ly³
  assert.ok(Math.abs(completeness(14.66, 10, rho) - 1) < 0.01);
  assert.equal(completeness(5, 10, null), null);
  // Hipparcos complete to V ≈ 7.5: at 1,000 ly only stars brighter than M ≈ 0.1 are all there
  assert.ok(Math.abs(brightLimit(1000) - 0.07) < 0.05);
  assert.ok(brightLimit(250) > 3 && brightLimit(250) < 3.2);
});

test('badge: nothing now; in deep time counts, completeness, coverage and velocity sources', () => {
  assert.deepEqual(badgeLines({ epoch: 0 }), []);
  const base = { epoch: 2e7, radiusLy: 25, shown: 12, arrived: 9, departed: 40, gaia: 7, hyg: 5, loadedLy: 1000, density: { rho0PerLy3: 3.5e-3, halfLy: 60 } };
  const lines = badgeLines(base).map((l) => l.text);
  assert.match(lines[0], /12 STARS WITHIN 25 LY · 9 ARRIVED .* 40 LEFT/);
  assert.match(lines[1], /BRIGHT STARS ONLY BEYOND ~60 LY · CATALOGUE INCOMPLETE · ~5% /);
  assert.ok(lines.some((t) => /FASTER THAN 15 KM\/S ARRIVING FROM BEYOND 1,000 LY ARE NOT LOADED/.test(t)), lines.join('\n'));
  assert.match(lines.at(-1), /7 GAIA DR3 · 5 HYG/);
  // while loading, say so instead of looking empty
  assert.ok(badgeLines({ ...base, loading: 'LOADING ARRIVALS 250–1,000 LY…' }).some((l) => l.warn && /LOADING/.test(l.text)));
  // the preview only has its 100 ly snapshot
  assert.ok(badgeLines({ ...base, preview: true, previewLy: 100, loadedLy: 100 }).some((l) => /PREVIEW/.test(l.text)));
  // like for like, once there are enough bright stars to compare
  assert.ok(badgeLines({ ...base, like: { mag: 0.1, today: 20, now: 18 } }).some((l) => /20 TODAY · 18 NOW/.test(l.text)));
});

test('Gaia DR3 motions replace HYG where the parallax is good; catalogue RV kept when Gaia has none', () => {
  const csv = 'hip,ra,dec,parallax,parallax_error,pmra,pmdec,radial_velocity,radial_velocity_error\n'
    + '89825,274.96183629691126,-1.938612759804832,52.396292205290564,0.0171099,-0.4140637404226508,-0.10847507667730025,-14.419985,0.2563099\n'
    + '1,10,10,4,0.1,5,5,,\n'
    + '2,20,20,4,1.5,5,5,10,0.5\n'; // parallax/error < 10: ignored
  const rows = parseHipMotions(csv);
  assert.equal(rows.length, 3);
  assert.equal(rows[1][7], null);
  const stars = [
    { id: 'hyg-89547', hip: 89825, rvKnown: true, rv: -13.3 },
    { id: 'a', hip: 1, rvKnown: true, rv: 7 },
    { id: 'b', hip: 2, rvKnown: false, rv: null },
    { id: 'c', hip: null },
  ];
  assert.equal(applyGaia(stars, rows), 2);
  const g = stars[0].motion;
  assert.equal(g.vSrc, 1);
  assert.ok(g.rvKnown);
  const want = spaceMotion({ raDeg: 274.96183629691126, decDeg: -1.938612759804832, plxMas: 52.396292205290564, pmraMasYr: -0.4140637404226508, pmdecMasYr: -0.10847507667730025, rvKms: -14.419985 });
  for (let k = 0; k < 3; k++) assert.ok(Math.abs(g.v[k] - want.vel[k]) < 0.01);
  assert.ok(Math.abs(Math.hypot(g.x, g.y, g.z) - 1000 / 52.3963) < 0.01);
  assert.equal(stars[1].motion.vSrc, 2); // Gaia astrometry + the catalogue's RV
  const r = stars[1].motion, d = [r.x, r.y, r.z], u = d.map((x) => x / Math.hypot(...d));
  assert.ok(Math.abs(r.v[0] * u[0] + r.v[1] * u[1] + r.v[2] * u[2] - 7) < 1e-6);
  assert.equal(stars[2].motion, undefined);
});

test('density profile finds where the catalogue thins out', () => {
  const stars = [];
  // uniform 3 per 1000 ly³ inside 50 ly, a tenth of that beyond
  let seed = 1;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 40000; i++) {
    const r = 120 * Math.cbrt(rnd());
    if (r > 50 && rnd() > 0.1) continue;
    stars.push({ distPc: r / 3.26156 });
  }
  const p = densityProfile(stars);
  assert.equal(p.halfLy, 50);
  assert.ok(p.rho0PerLy3 > 0.004 && p.rho0PerLy3 < 0.007, String(p.rho0PerLy3));
});
