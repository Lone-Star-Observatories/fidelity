// Elevation models in the browser (#80): the bundled global grids (public/dem, 0.25°) decoded from
// their 16-bit PNGs (DecompressionStream; an <img> would round them to 8 bits), a GPU height texture
// per body for relief shading and displacement, and finer tiles from /api/dem-tile close up.
// The standalone preview has no DEMs (size budget): globes stay smooth there.

import * as THREE from 'three';
import { decodePng16, dequantize, sampleDem, fillGaps, NODATA } from '../astro/dem.js';

const STANDALONE = import.meta.env?.MODE === 'standalone';
const inflate = async (z) => new Uint8Array(await new Response(new Blob([z]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer());

let indexP = null;
/** public/dem/index.json (null in the standalone preview or if it is missing). */
export function demIndex() {
  indexP ??= STANDALONE || typeof DecompressionStream === 'undefined' ? Promise.resolve(null)
    : fetch('/dem/index.json').then((r) => (r.ok ? r.json() : null)).catch(() => null);
  return indexP;
}
let indexNow = null;
demIndex().then((i) => { indexNow = i; });
/** The index entry for a body, if its DEM is bundled (sync; null until the index has loaded). */
export const demMeta = (id) => indexNow?.bodies?.[id] ?? null;

// Bodies with no global DEM, and why (mirrors server/dem.js NO_DEM for the panel without a round trip).
export const NO_DEM = {
  titan: 'Cassini radar and altimetry cover strips only (~9% at high resolution); no open global grid.',
  ganymede: 'No global stereo DEM: Galileo and Voyager stereo of small areas; JUICE maps it from 2034.',
  europa: 'No global DEM: Galileo stereo of small areas only; Europa Clipper maps it from 2030.',
  callisto: 'No global DEM: limb profiles and local Galileo stereo only.',
  io: 'No global DEM: local Galileo/Voyager stereo only (e.g. Tvashtar Paterae).',
};

const loaded = new Map(); // id → { meta, dem, texture } once decoded
const pending = new Map(); // id → Promise

/** Decode a body's DEM: → { meta, dem: { width, height, heights (m, NaN = none) }, texture } or null. */
export function loadDem(id) {
  if (loaded.has(id)) return Promise.resolve(loaded.get(id));
  if (!pending.has(id)) {
    pending.set(id, (async () => {
      const index = await demIndex();
      const meta = index?.bodies?.[id];
      if (!meta) return null;
      const r = await fetch(`/dem/${meta.file}`);
      if (!r.ok) return null;
      const png = await decodePng16(new Uint8Array(await r.arrayBuffer()), inflate);
      const dem = { width: png.width, height: png.height, heights: dequantize(png.data, meta.min, meta.max) };
      // what is drawn over gaps: a smooth fill back to the reference surface (read-outs still say NO DATA)
      const drawn = { ...dem, heights: meta.coverage < 0.9999 ? fillGaps(dem) : dem.heights };
      const out = { id, meta, dem, drawn, texture: heightTexture(drawn, meta) };
      loaded.set(id, out);
      return out;
    })().catch((err) => { console.warn(`DEM ${id} unavailable`, err); return null; }));
  }
  return pending.get(id);
}
/** The decoded DEM if it has already loaded (sync; for per-frame use). */
export const demNow = (id) => loaded.get(id) ?? null;

/**
 * Half-float height texture (metres), rows flipped so v = 1 is north like the sphere's UVs, with a
 * box-filtered mip chain so distant globes do not sparkle. No data → 0 (the reference surface);
 * Earth's sea floor is flattened to sea level: the ocean surface carries no relief.
 */
function heightTexture({ width: W, height: H, heights }, meta) {
  const toHalf = THREE.DataUtils.toHalfFloat;
  let level = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let h = heights[(H - 1 - y) * W + x];
      if (!Number.isFinite(h)) h = 0;
      if (meta.shading === 'land' && h < 0) h = 0;
      level[y * W + x] = h;
    }
  }
  const mipmaps = [];
  let w = W, hgt = H;
  for (;;) {
    const half = new Uint16Array(w * hgt);
    for (let i = 0; i < half.length; i++) half[i] = toHalf(level[i]);
    mipmaps.push({ data: half, width: w, height: hgt });
    if (w === 1 && hgt === 1) break;
    const nw = Math.max(1, w >> 1), nh = Math.max(1, hgt >> 1), next = new Float32Array(nw * nh);
    for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) {
      const x0 = Math.min(w - 1, 2 * x), x1 = Math.min(w - 1, 2 * x + 1), y0 = Math.min(hgt - 1, 2 * y), y1 = Math.min(hgt - 1, 2 * y + 1);
      next[y * nw + x] = (level[y0 * w + x0] + level[y0 * w + x1] + level[y1 * w + x0] + level[y1 * w + x1]) / 4;
    }
    level = next; w = nw; hgt = nh;
  }
  const t = new THREE.DataTexture(mipmaps[0].data, W, H, THREE.RedFormat, THREE.HalfFloatType);
  t.mipmaps = mipmaps;
  t.generateMipmaps = false;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.needsUpdate = true;
  return t;
}

// ---- finer tiles close up (/api/dem-tile) -------------------------------------------------------
const TILE = 256;
const tiles = new Map(); // `${id}/${z}/${x}/${y}` → { heights, deg, west, north } | null (failed) | Promise
let tilesOk = !STANDALONE;
const tileListeners = new Set();
/** Call `fn(id, tile)` whenever a tile arrives (terrain patches rebuild with the finer heights). */
export const onTileLoaded = (fn) => (tileListeners.add(fn), () => tileListeners.delete(fn));

/** Finest tile level for a body (server/dem.js maxLevel: tile px/° no finer than the source's). */
export const tileMaxLevel = (meta) => (meta?.sourcePpd ? Math.max(0, Math.floor(Math.log2((meta.sourcePpd * 90) / TILE))) : 0);

/** Load tile (z, x, y) of a body; resolves to the tile or null. */
export function loadTile(id, z, x, y) {
  const key = `${id}/${z}/${x}/${y}`;
  const t = tiles.get(key);
  if (t !== undefined) return t instanceof Promise ? t : Promise.resolve(t);
  if (!tilesOk) return Promise.resolve(null);
  const p = fetch(`/api/dem-tile/${key}`).then(async (r) => {
    if (!r.ok) { if (r.status === 404 && r.headers.get('content-type')?.includes('text/html')) tilesOk = false; return null; }
    const png = await decodePng16(new Uint8Array(await r.arrayBuffer()), inflate);
    const min = Number(png.text.min), max = Number(png.text.max), deg = 90 / 2 ** z;
    return { heights: dequantize(png.data, min, max), deg, west: -180 + x * deg, north: 90 - y * deg, z };
  }).catch(() => null).then((v) => { tiles.set(key, v); if (v) for (const fn of tileListeners) fn(id, v); return v; });
  tiles.set(key, p);
  return p;
}

/** Tile indices holding lat/lon at level z. */
export function tileAt(z, lat, lon) {
  const deg = 90 / 2 ** z, L = ((((lon + 180) % 360) + 360) % 360);
  return { x: Math.min(4 * 2 ** z - 1, Math.floor(L / deg)), y: Math.min(2 * 2 ** z - 1, Math.max(0, Math.floor((90 - lat) / deg))) };
}

/** Bilinear height from a loaded tile (NaN outside it or where it has no data). */
function sampleTile(t, lat, lon) {
  const cell = t.deg / TILE, L = ((((lon - t.west) % 360) + 360) % 360);
  const fx = L / cell - 0.5, fy = (t.north - lat) / cell - 0.5;
  if (fx < -0.5 || fy < -0.5 || fx > TILE - 0.5 || fy > TILE - 0.5) return NaN;
  const x0 = Math.max(0, Math.min(TILE - 2, Math.floor(fx))), y0 = Math.max(0, Math.min(TILE - 2, Math.floor(fy)));
  const tx = Math.max(0, Math.min(1, fx - x0)), ty = Math.max(0, Math.min(1, fy - y0));
  const h = t.heights, a = h[y0 * TILE + x0], b = h[y0 * TILE + x0 + 1], c = h[(y0 + 1) * TILE + x0], d = h[(y0 + 1) * TILE + x0 + 1];
  return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
}

/**
 * Height (m) at lat/lon from the finest tile already loaded at or below level `z` (requesting the
 * level-z tile if missing and `request`), else the bundled global grid:
 * { h (NaN = no data), hDraw (the drawn surface: the gap fill where there is no data), res: 'tile z' | 'global', cellKm }.
 */
export function heightAt(id, lat, lon, z = -1, { request = true } = {}) {
  const g = demNow(id);
  if (!g) return null;
  for (let level = Math.min(z, tileMaxLevel(g.meta)); level >= 0; level--) {
    const { x, y } = tileAt(level, lat, lon), t = tiles.get(`${id}/${level}/${x}/${y}`);
    if (t === undefined && request && level === Math.min(z, tileMaxLevel(g.meta))) loadTile(id, level, x, y);
    if (t && !(t instanceof Promise)) {
      const h = sampleTile(t, lat, lon);
      if (Number.isFinite(h)) return { h, hDraw: h, res: `tile ${level}`, cellKm: (2 * Math.PI * g.meta.refRadiusKm * t.deg) / 360 / TILE };
    }
  }
  const h = sampleDem(g.dem, lat, lon);
  return { h, hDraw: Number.isFinite(h) ? h : sampleDem(g.drawn, lat, lon), res: 'global', cellKm: g.meta.cellKm };
}

export { NODATA };
