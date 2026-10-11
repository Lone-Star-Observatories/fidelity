// Line-art world map decoding (COMMS): coastlines vs borders, country lookup.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { decodeWorld, countryAt } from '../src/data/worldmap.js';

const world = decodeWorld(JSON.parse(fs.readFileSync(new URL('../public/shapes/world-50m.json', import.meta.url))));

test('coastlines and borders are split by how many countries share an arc', () => {
  assert.ok(world.countries.length > 200);
  assert.ok(world.coast.length > 100 && world.borders.length > 100);
  assert.equal(new Set([...world.coast, ...world.borders]).size, world.coast.length + world.borders.length);
});

test('countryAt finds the country under a point, and none at sea', () => {
  assert.equal(countryAt(world, 48.86, 2.35)?.name, 'France'); // Paris
  assert.equal(countryAt(world, -33.87, 151.21)?.name, 'Australia'); // Sydney
  assert.equal(countryAt(world, 30.27, -97.74)?.name, 'United States of America'); // Austin
  assert.equal(countryAt(world, 0, -30), null); // mid-Atlantic
});

test('a tiny hand-made topology decodes delta-quantized arcs and reversed refs', () => {
  const topo = { type: 'Topology', transform: { scale: [1, 1], translate: [0, 0] },
    arcs: [[[0, 0], [10, 0], [0, 10]], [[10, 10], [-10, 0], [0, -10]]],
    objects: { countries: { type: 'GeometryCollection', geometries: [{ type: 'Polygon', arcs: [[0, 1]], properties: { name: 'Square' } }] } } };
  const w = decodeWorld(topo);
  assert.deepEqual(w.arcs[0], [[0, 0], [10, 0], [10, 10]]);
  assert.deepEqual(w.countries[0].polys[0][0], [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]);
  assert.equal(countryAt(w, 5, 5)?.name, 'Square');
  assert.deepEqual(w.coast, [0, 1]);
});

test('outlines crossing the antimeridian are unwrapped (no 360° jumps), and still found', () => {
  const jumps = world.arcs.filter((a) => a.some((p, i) => i && Math.abs(p[0] - a[i - 1][0]) > 180));
  assert.equal(jumps.length, 0);
  assert.equal(countryAt(world, 65, 177)?.name, 'Russia'); // Chukotka, east of 180°… west of it in longitude
  assert.equal(countryAt(world, -17.8, 178.0)?.name, 'Fiji');
});
