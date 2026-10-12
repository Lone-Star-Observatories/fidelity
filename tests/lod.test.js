// The tiled level-of-detail globe (#80): chunk addressing, selection, coverage without overlaps, the drawn surface.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GRID, chunkBounds, chunkAt, chunkKey, chunkChildren, chunkParent, chunkTileLevel, chunkSphere, geoVec,
  horizonAngle, reliefPad, selectChunks, chunksToShow, gridSurface,
} from '../src/astro/lod.js';
import { tileBounds } from '../server/dem.js';

const close = (a, b, eps, what = '') => assert.ok(Math.abs(a - b) <= eps, `${what} ${a} ≉ ${b} (±${eps})`);

test('chunks use /api/dem-tile addressing; children tile their parent', () => {
  for (const [z, x, y] of [[0, 0, 0], [3, 17, 5], [7, 400, 211]]) assert.deepEqual(chunkBounds(z, x, y), tileBounds(z, x, y));
  const p = chunkBounds(2, 5, 3), kids = chunkChildren(2, 5, 3).map((c) => chunkBounds(...c));
  assert.equal(kids.length, 4);
  for (const k of kids) { close(k.deg, p.deg / 2, 1e-12); assert.ok(k.west >= p.west && k.north <= p.north); }
  for (const c of chunkChildren(4, 9, 7)) assert.deepEqual(chunkParent(...c), [4, 9, 7]);
  assert.equal(chunkParent(0, 1, 1), null);
  assert.deepEqual(chunkAt(3, 10, 20), { z: 3, x: Math.floor(200 / 11.25), y: Math.floor(80 / 11.25) });
  assert.equal(chunkKey(5, 1, 2), '5/1/2');
});

test('a chunk wants heights from the tile level that matches its 32-cell grid, within what the body serves', () => {
  assert.equal(GRID, 32);
  assert.equal(chunkTileLevel(7, 1, 4), 4, 'tile level z − 3, capped at the finest');
  assert.equal(chunkTileLevel(5, 1, 4), 2);
  assert.equal(chunkTileLevel(3, 1, 4), -1, 'coarser than any tile worth loading: the bundled grid');
  assert.equal(chunkTileLevel(9, 1, -1), -1, 'no tiles at all (Titan)');
});

test('chunk spheres and horizon angles', () => {
  const s = chunkSphere(1, 2, 0); // 0…45° E, 90…45° N
  close(Math.hypot(...s.c), 1, 1e-12);
  assert.ok(s.a > 0 && s.a < Math.PI / 2);
  close(horizonAngle(2), Math.PI / 3, 1e-12, 'from 2 radii the horizon is 60° away');
  close(horizonAngle(1), 0, 1e-12);
  assert.ok(reliefPad(8848, 6371) > 0.05 && reliefPad(8848, 6371) < 0.06, 'Everest shows over the horizon from ~330 km');
});

test('selection refines where the camera is and stays coarse far away, within the budget', () => {
  const cam = geoVec(20, 10).map((v) => v * (1 + 2 / 6371000 * 1000)); // 2 m above Earth's sphere, in radii (approximately)
  const leaves = selectChunks(cam, { maxLevel: 13, tau: 0.32, pad: reliefPad(6000, 6371), maxChunks: 380 });
  assert.ok(leaves.length <= 380 && leaves.length > 8);
  const under = chunkAt(13, 20, 10), finest = leaves.reduce((m, l) => Math.max(m, l.z), 0);
  assert.equal(finest, 13, 'the finest level under the camera');
  assert.ok(leaves.some((l) => l.z === 13 && l.x === under.x && l.y === under.y), 'the chunk under the camera is a leaf at the finest level');
  // far away from the camera the leaves are coarse; the far side of the planet is culled
  const opposite = leaves.filter((l) => { const b = chunkBounds(l.z, l.x, l.y); return Math.abs(b.west + b.deg / 2 - (-170)) < 20; });
  assert.equal(opposite.length, 0);
  // from far out, the whole visible hemisphere at a coarse level
  const far = selectChunks([5, 0, 0], { maxLevel: 13, tau: 0.32 });
  assert.ok(far.every((l) => l.z <= 2) && far.length >= 4);
});

test('chunks to show: built leaves, else their nearest built ancestor, never a chunk with its ancestor', () => {
  const leaves = [{ z: 2, x: 0, y: 0 }, { z: 2, x: 1, y: 0 }, { z: 2, x: 0, y: 1 }, { z: 2, x: 1, y: 1 }, { z: 1, x: 1, y: 0 }];
  const built = new Set(['0/0/0', '1/0/0', '2/0/0', '1/1/0']);
  const show = chunksToShow(leaves, (k) => built.has(k));
  // 2/1/0 etc. are missing → 1/0/0 covers that quadrant, and 2/0/0 (inside 1/0/0) is dropped to avoid an overlap
  assert.deepEqual([...show].sort(), ['1/0/0', '1/1/0']);
});

test('the drawn surface interpolates on the mesh\'s own triangles', () => {
  const n = 2, r = Float32Array.from([0, 1, 2, 1, 2, 3, 2, 3, 4]); // a plane z = x + y on a 3×3 grid
  close(gridSurface(r, 0.5, 0.5, n), 1, 1e-6);
  close(gridSurface(r, 1.7, 0.2, n), 1.9, 1e-6);
  close(gridSurface(r, 2, 2, n), 4, 1e-6);
  const bump = Float32Array.from([0, 0, 0, 0, 1, 0, 0, 0, 0]);
  close(gridSurface(bump, 1, 1, n), 1, 1e-6, 'vertices are exact');
  close(gridSurface(bump, 0.75, 0.75, n), 0.5, 1e-6, 'between, on the triangle b–c–d');
  close(gridSurface(bump, 0.25, 0.25, n), 0, 1e-6, 'on the triangle a–c–b');
});
