import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { geocentric, describe, apparentMagnitude, constellation, subObserverLatitude, equatorialRadiusKm, riseTransitSet,
  ofDate, eclToEq, precess, fromRaDec, toRaDec, formatRa, formatDec, bestMonth, horizontal, gmst } from '../src/astro/observe.js';
import { heliocentric } from '../src/astro/kepler.js';
import { moonGeocentric } from '../src/astro/moons.js';
import { PLANETS, SUN, AU_KM } from '../src/data/sol.js';
import { MOONS, SMALL_BODIES } from '../src/data/moons.js';

// JPL Horizons, 2026-10-10 00:00 UT: geocentric observer quantities and heliocentric state vectors
const fx = JSON.parse(fs.readFileSync(new URL('./fixtures/horizons-observer-2026-10-10.json', import.meta.url)));
const jd0 = fx.jdUT;
const lin = (b) => (jd) => b.pos.map((p, i) => p + b.vel[i] * (jd - jd0)); // light-time is minutes: linear is enough
const ALL = [SUN, ...PLANETS, ...MOONS, ...SMALL_BODIES];
const sep = (ra1, dec1, ra2, dec2) => Math.hypot(((ra1 - ra2 + 540) % 360 - 180) * Math.cos(dec2 * Math.PI / 180), dec1 - dec2) * 3600;

function view(id) {
  const h = fx.bodies[id], b = ALL.find((x) => x.id === id);
  const d = describe(geocentric(lin(h), lin(fx.bodies.earth), jd0), { radiusKm: equatorialRadiusKm(id, b?.radiusKm) });
  const lat = b?.pole ? subObserverLatitude(d.eq, b.pole) : 0;
  return { h, d, mag: apparentMagnitude(id, d, { ringTilt: lat, subLat: lat }) };
}
const observed = Object.keys(fx.bodies).filter((id) => fx.bodies[id].ra != null);

test('astrometric RA/Dec match JPL Horizons to an arcsecond (planets, Sun, Moon, small bodies)', () => {
  for (const id of observed) {
    const { h, d } = view(id);
    // satellites: linear motion over the light-time bends a little for the fast inner moons
    const tol = MOONS.some((m) => m.id === id && m.id !== 'moon') ? 4 : 0.5;
    assert.ok(sep(d.ra, d.dec, h.ra, h.dec) < tol, `${id}: ${sep(d.ra, d.dec, h.ra, h.dec).toFixed(2)}″`);
  }
});

test('distance, phase, illumination, elongation and size match Horizons', () => {
  for (const id of observed) {
    const { h, d } = view(id);
    assert.ok(Math.abs(d.delta - h.delta) < 2e-5 * h.delta, `${id} Δ`);
    assert.ok(Math.abs(d.phase - h.phase) < 0.02, `${id} phase ${d.phase} vs ${h.phase}`);
    assert.ok(Math.abs(d.illuminated * 100 - h.illum) < 0.02, `${id} illuminated`);
    assert.ok(Math.abs(d.elongation - h.elong) < 0.02, `${id} elongation ${d.elongation} vs ${h.elong}`);
  }
  for (const id of ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'titan', 'ganymede']) {
    const { h, d } = view(id);
    assert.ok(Math.abs(d.angularDiameterArcsec / h.angDiam - 1) < 0.003, `${id} diameter ${d.angularDiameterArcsec} vs ${h.angDiam}`);
  }
});

test('apparent magnitudes match Horizons (planets ±0.02, Moon, moons and small bodies)', () => {
  for (const id of observed) {
    const { h, mag } = view(id);
    // Saturn's ring term and the Moon's phase law differ slightly from Horizons' own models
    const tol = id === 'moon' ? 0.05 : id === 'saturn' ? 0.03 : 0.02;
    assert.ok(Math.abs(mag - h.mag) < tol, `${id}: ${mag.toFixed(3)} vs ${h.mag}`);
  }
});

test('constellations match Horizons (Roman 1987 boundaries)', () => {
  for (const id of observed) {
    const { h, d } = view(id);
    assert.equal(constellation(d.ra, d.dec).abbr, h.cnst, id);
  }
  // fixed checks: Betelgeuse, Polaris, Sirius, α Cen, a point on the far southern pole
  assert.equal(constellation(88.7929, 7.4071).abbr, 'Ori');
  assert.equal(constellation(37.9546, 89.2641).abbr, 'UMi');
  assert.equal(constellation(101.2872, -16.7161).abbr, 'CMa');
  assert.equal(constellation(219.9021, -60.8340).abbr, 'Cen');
  assert.equal(constellation(0, -89.9).abbr, 'Oct');
});

test('precession J2000 → date is a rotation and matches the standard rate', () => {
  const v = fromRaDec(0, 0);
  const p = toRaDec(precess(v, 2451545 + 36525)); // one century
  // 1 century of general precession in RA at the equinox ≈ 4612″ (m + n·sinα·tanδ with α = δ = 0)
  assert.ok(Math.abs(p.ra * 3600 - 4612.4) < 2, `${p.ra * 3600}`);
  assert.ok(Math.abs(Math.hypot(...precess([0.3, -0.4, 0.866], 2400000)) - Math.hypot(0.3, -0.4, 0.866)) < 1e-12);
});

test('rise, transit and set at Auckland match Horizons within 3 minutes (offline Kepler + lunar theory)', () => {
  const { lat, lon } = fx.rts.site;
  const earth = (jd) => heliocentric('earth', jd);
  const sources = {
    sun: (jd) => [0, 0, 0],
    jupiter: (jd) => heliocentric('jupiter', jd),
    saturn: (jd) => heliocentric('saturn', jd),
    moon: (jd) => earth(jd).map((x, i) => x + moonGeocentric(jd)[i] / AU_KM),
  };
  const jdOf = (s) => Date.parse(`${s.replace(/^(\d{4})-(\w{3})-(\d{2}) /, (_, y, m, d) => `${y}-${String('JanFebMarAprMayJunJulAugSepOctNovDec'.indexOf(m) / 3 + 1).padStart(2, '0')}-${d}T`)}:00Z`) / 86400000 + 2440587.5;
  for (const [id, events] of Object.entries(fx.rts.events)) {
    const raDecAt = (jd) => {
      const g = geocentric(sources[id], earth, jd);
      return ofDate(eclToEq(g.geo), jd);
    };
    // Horizons' events are for the target's centre with refraction (listed to the minute); the Moon's parallax lowers it
    const parallax = id === 'moon' ? Math.asin(6378.137 / (Math.hypot(...moonGeocentric(jd0)))) * 180 / Math.PI : 0;
    const r = riseTransitSet(raDecAt, jd0, lat, lon, { h0: -0.5667 - (id === 'moon' ? -parallax : 0) });
    for (const e of events) {
      const key = { r: 'rise', s: 'set', t: 'transit' }[e.type];
      assert.ok(r[key] != null, `${id} ${key} missing`);
      const dtMin = (r[key] - jdOf(e.time)) * 1440;
      assert.ok(Math.abs(dtMin) < 3, `${id} ${key}: ${dtMin.toFixed(2)} min`);
    }
  }
});

test('horizontal coordinates and helpers', () => {
  // at the north pole, altitude equals declination
  assert.ok(Math.abs(horizontal(123, 45, 2461000.3, 90, 0).alt - 45) < 1e-9);
  assert.ok(gmst(2451545.0) > 280.46 && gmst(2451545.0) < 280.47);
  assert.equal(formatRa(83.633), '05h 34m 32s');
  assert.equal(formatDec(-16.7161), '−16° 42′ 58″');
  assert.equal(bestMonth(88.79), 11); // Orion: December
  assert.equal(bestMonth(297.70), 6); // Altair: July
});
