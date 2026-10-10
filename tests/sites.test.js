import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SITES, SITE_KINDS, sitesFor } from '../src/data/sites.js';
import { siteDir } from '../src/views/system/sites.js';
import { dirToLatLon } from '../src/views/system/surface.js';
import { flattenTraverse } from '../server/traverse.js';
import { solSystem } from '../src/data/systems.js';

const close = (a, b, eps, what = '') => assert.ok(Math.abs(a - b) < eps, `${what} ${a} ≉ ${b}`);

test('Apollo 11 LM is at 0.6741° N, 23.4730° E (LROC) and lands there on the globe', () => {
  const a11 = sitesFor('moon').find((s) => s.id === 'apollo11-lm');
  close(a11.lat, 0.6741, 1e-3, 'lat'); close(a11.lon, 23.4730, 1e-3, 'lon');
  const back = dirToLatLon(siteDir({ id: 'moon' }, a11.lat, a11.lon));
  close(back.lat, a11.lat, 1e-9); close(back.lon, a11.lon, 1e-9);
});

test('a texture offset (Pluto, texLon0 = 0) shifts the mesh longitude by 180°', () => {
  const { lon } = dirToLatLon(siteDir({ texLon0: 0 }, 10, 30));
  close(lon, -150, 1e-9);
});

test('the 2022 rocket-body double crater is at LROC\'s 5.226° N, 234.486° E; its owner is badged as disputed', () => {
  const s = sitesFor('moon').find((x) => x.id === 'rocket-body-2022');
  close(s.lat, 5.226, 0.01); close(s.lon + 360, 234.486, 0.01);
  assert.match(s.identity, /Chang'e 5-T1/);
});

test('every site is well formed, on a body that exists, and planned sites never pass as landings', () => {
  const ids = new Set(solSystem().bodies.map((b) => b.id));
  const seen = new Set();
  for (const s of SITES) {
    assert.ok(!seen.has(s.id), `duplicate ${s.id}`); seen.add(s.id);
    assert.ok(ids.has(s.body), `${s.id}: unknown body ${s.body}`);
    assert.ok(SITE_KINDS[s.kind], `${s.id}: kind ${s.kind}`);
    assert.ok(s.lat >= -90 && s.lat <= 90 && s.lon >= -180 && s.lon <= 180, `${s.id}: ${s.lat}, ${s.lon}`);
    assert.ok(s.source, `${s.id}: no source`);
    assert.equal(s.tier === 'planned', s.kind === 'planned', `${s.id}: tier ${s.tier}`);
  }
});

test('traverses: GeoJSON lines flatten into one path, thinned but keeping the current position', () => {
  const geo = { features: [
    { properties: { sol: 3 }, geometry: { type: 'LineString', coordinates: [[77, 18, -2500], [77, 18, -2500], [77.001, 18]] } },
    { properties: { sol: 9 }, geometry: { type: 'MultiLineString', coordinates: [[[77.001, 18], [77.002, 18.001], [77.003, 18.002]]] } },
  ] };
  const t = flattenTraverse(geo, 2);
  assert.equal(t.rawPoints, 4); // duplicates dropped
  assert.equal(t.sol, 9);
  assert.deepEqual(t.points.at(-1), [77.003, 18.002]);
  assert.ok(t.points.length <= 3);
  close(t.distanceKm, 0.059 + 0.0837 * 2, 0.01, 'km'); // 0.001° of longitude at 18° N on Mars ≈ 56 m
});

test('every observatory webcam a site offers is on the backend allowlist', async () => {
  const { FEEDS } = await import('../server/feeds.js');
  const ids = SITES.flatMap((s) => s.feeds ?? []).filter((f) => f.kind === 'image').map((f) => f.id);
  assert.ok(ids.length > 30);
  for (const id of ids) assert.ok(FEEDS[id], `${id} is not a backend feed`);
});
