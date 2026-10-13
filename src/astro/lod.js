// Tiled level-of-detail globe (#80): the pure parts. Chunks use the same addressing as /api/dem-tile: level z has
// 4·2^z × 2·2^z chunks of 90°/2^z, x from 180° W eastwards, y from 90° N southwards. A chunk of level z draws a
// GRID × GRID cell mesh, so it wants heights from tile level z − 3 (256 px tiles, 32 cells: the same spacing).
// Selection is a quadtree walk from the eight level-0 chunks: a chunk beyond the horizon (plus a pad for the
// tallest relief) is culled; one that looks too big from the camera (its size over its distance above `tau`) is
// split into its four children, down to `maxLevel`. Geo frame: unit vectors [cos φ cos λ, cos φ sin λ, sin φ].

const DEG = Math.PI / 180;
export const GRID = 32;
export const TILE_LEVEL_OFFSET = Math.log2(256 / GRID); // 3

/** Chunk bounds: { west, north, deg } (lon −180…180 east, lat). */
export function chunkBounds(z, x, y) {
  const deg = 90 / 2 ** z;
  return { west: -180 + x * deg, north: 90 - y * deg, deg };
}
/** The chunk of level z holding lat/lon. */
export function chunkAt(z, lat, lon) {
  const deg = 90 / 2 ** z, L = ((((lon + 180) % 360) + 360) % 360);
  return { z, x: Math.min(4 * 2 ** z - 1, Math.floor(L / deg)), y: Math.min(2 * 2 ** z - 1, Math.max(0, Math.floor((90 - lat) / deg))) };
}
export const chunkKey = (z, x, y) => `${z}/${x}/${y}`;
/** The four children (NW, NE, SW, SE) and the parent of a chunk. */
export const chunkChildren = (z, x, y) => [[z + 1, 2 * x, 2 * y], [z + 1, 2 * x + 1, 2 * y], [z + 1, 2 * x, 2 * y + 1], [z + 1, 2 * x + 1, 2 * y + 1]];
export const chunkParent = (z, x, y) => (z > 0 ? [z - 1, x >> 1, y >> 1] : null);
/** Tile level that matches a chunk's cells, clamped to what the body offers (−1: the bundled grid only). */
export const chunkTileLevel = (z, minTile, maxTile) => (maxTile < 0 ? -1 : Math.min(maxTile, z - TILE_LEVEL_OFFSET) < minTile ? -1 : Math.min(maxTile, z - TILE_LEVEL_OFFSET));

export const geoVec = (lat, lon) => [Math.cos(lat * DEG) * Math.cos(lon * DEG), Math.cos(lat * DEG) * Math.sin(lon * DEG), Math.sin(lat * DEG)];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** A chunk's centre direction (geo frame), its angular radius (rad, centre to farthest corner) and its size (rad). */
export function chunkSphere(z, x, y) {
  const b = chunkBounds(z, x, y), latC = b.north - b.deg / 2, lonC = b.west + b.deg / 2, c = geoVec(latC, lonC);
  let a = 0;
  for (const [la, lo] of [[b.north, b.west], [b.north, b.west + b.deg], [b.north - b.deg, b.west], [b.north - b.deg, b.west + b.deg], [b.north, lonC], [b.north - b.deg, lonC]]) {
    a = Math.max(a, Math.acos(Math.max(-1, Math.min(1, dot(c, geoVec(la, lo))))));
  }
  // the larger of its north–south and (widest) east–west extents, as an angle on the sphere
  const latEq = b.north > 0 && b.north - b.deg < 0 ? 0 : Math.min(Math.abs(b.north), Math.abs(b.north - b.deg));
  const size = Math.max(b.deg, b.deg * Math.cos(latEq * DEG)) * DEG;
  return { c, a, size, b };
}

/** Horizon angle (rad) from a camera `dist` body radii from the centre, plus the relief pad (rad). */
export const horizonAngle = (dist, pad = 0) => Math.acos(Math.min(1, 1 / Math.max(dist, 1))) + pad;
/** Pad (rad) that lets a peak `hMax` metres high show over the horizon of a body of radius R km (exaggeration k). */
export const reliefPad = (hMaxM, radiusKm, k = 1) => Math.acos(1 / (1 + Math.max(0, (k * hMaxM) / (radiusKm * 1000))));

/** How a chunk looks from the camera: null over the horizon, else { score: its size over its nearest distance }. */
export function chunkView(z, x, y, dist, dir, hz) {
  const s = chunkSphere(z, x, y);
  const ang = Math.acos(Math.max(-1, Math.min(1, dot(dir, s.c))));
  if (ang - s.a > hz) return null; // over the horizon
  const g = Math.max(0, ang - s.a);
  const d = Math.sqrt(Math.max(1e-18, dist * dist + 1 - 2 * dist * Math.cos(g))); // to the nearest point of the chunk
  return { z, x, y, key: chunkKey(z, x, y), score: s.size / Math.max(d, 1e-12) };
}

/**
 * Choose the leaf chunks to draw for a camera at `cam` (geo frame, body radii). Returns [{ z, x, y, key, score }],
 * at most `maxChunks`. The chunk that looks biggest is split first, so if the budget runs out it is the far, small
 * ones that stay coarse; every visible part of the globe has a leaf (no holes).
 */
export function selectChunks(cam, { maxLevel = 12, tau = 0.35, pad = 0, maxChunks = 320 } = {}) {
  const dist = Math.hypot(cam[0], cam[1], cam[2]), dir = cam.map((v) => v / dist), hz = horizonAngle(dist, pad);
  const leaves = [];
  for (let y = 0; y < 2; y++) for (let x = 0; x < 4; x++) { const v = chunkView(0, x, y, dist, dir, hz); if (v) leaves.push(v); }
  for (;;) {
    let best = -1;
    for (let i = 0; i < leaves.length; i++) {
      const l = leaves[i];
      if (l.z < maxLevel && l.score > tau && (best < 0 || l.score > leaves[best].score)) best = i;
    }
    if (best < 0 || leaves.length + 3 > maxChunks) break;
    const l = leaves[best];
    const kids = chunkChildren(l.z, l.x, l.y).map(([z, x, y]) => chunkView(z, x, y, dist, dir, hz)).filter(Boolean);
    leaves.splice(best, 1, ...kids);
  }
  return leaves;
}

/**
 * Which drawn chunk covers each selected leaf: the leaf itself once built (`ready(key)`), else its nearest built
 * ancestor, and never a chunk together with one of its ancestors (no overlaps). → Set of keys to show.
 */
export function chunksToShow(leaves, ready) {
  const chosen = new Set();
  for (const l of leaves) {
    let c = [l.z, l.x, l.y];
    while (c && !ready(chunkKey(...c))) c = chunkParent(...c);
    if (c) chosen.add(chunkKey(...c));
  }
  // drop any chosen chunk that has a chosen ancestor (the ancestor already covers it)
  for (const k of [...chosen]) {
    let p = chunkParent(...k.split('/').map(Number));
    while (p) { if (chosen.has(chunkKey(...p))) { chosen.delete(k); break; } p = chunkParent(...p); }
  }
  return chosen;
}

/**
 * Height on a chunk's drawn surface at fractional grid position (fx, fy) (0…GRID), from its (GRID+1)² vertex
 * values `r` (row-major from the north-west), on the same two triangles per cell the mesh draws (a, c, b and b, c, d;
 * a = NW, b = NE, c = SW, d = SE).
 */
export function gridSurface(r, fx, fy, n = GRID) {
  const x0 = Math.max(0, Math.min(n - 1, Math.floor(fx))), y0 = Math.max(0, Math.min(n - 1, Math.floor(fy)));
  const u = Math.max(0, Math.min(1, fx - x0)), v = Math.max(0, Math.min(1, fy - y0)), w = n + 1;
  const a = r[y0 * w + x0], b = r[y0 * w + x0 + 1], c = r[(y0 + 1) * w + x0], d = r[(y0 + 1) * w + x0 + 1];
  return u + v <= 1 ? a + (b - a) * u + (c - a) * v : d + (c - d) * (1 - u) + (b - d) * (1 - v);
}
