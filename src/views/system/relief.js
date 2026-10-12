// Relief on the globes (#80). Each body with a bundled DEM (public/dem) gets:
//  · a normal map derived from its heights in the globe's shader (lighting reveals terrain at any distance),
//  · vertex displacement by the same heights (TRUE or exaggerated), on a denser sphere when the camera is close,
//  · close up (within a few radii) and in the surface view, a tiled level-of-detail globe: a quadtree of chunks in
//    the /api/dem-tile addressing (src/astro/lod.js), finer wherever the camera is near, each a 32 × 32 cell mesh
//    built on the CPU from the finest heights loaded (tiles at the matching level, else coarser ones, else the
//    bundled grid) with skirts that hide the cracks between levels, lit by its own geometry with the globe's shared
//    uniforms. The globe itself is discarded while the chunks draw. Chunks and tiles are both bounded (LRU); tiles
//    load asynchronously, six at a time, and chunks rebuild when finer heights arrive.
//  · On Venus (#83) chunks close to the ground carry Magellan SAR detail tiles (/api/sar-tile, 225 m / 75 m mosaics).
// Pure helpers live in src/astro/dem.js and src/astro/lod.js; the DEMs and tiles in src/data/dem.js.

import * as THREE from 'three';
import { loadDem, demNow, heightAt, tileMaxLevel, tileMinLevel, onTileLoaded, tileTick, tileCount } from '../../data/dem.js';
import { demUOffset, heightToRadius, reliefK } from '../../astro/dem.js';
import { GRID, chunkBounds, chunkAt, chunkKey, chunkParent, chunkTileLevel, selectChunks, chunksToShow, reliefPad, gridSurface } from '../../astro/lod.js';
import { dirToLatLon, latLonToDir } from './surface.js';

const SEG_FAR = [96, 48], SEG_NEAR = [384, 192];
const LOD_DIST = 3; // body radii from the centre: inside this the tiled globe replaces the sphere
const MAX_CHUNKS = 420, BUILDS_PER_FRAME = 8;
// detail imagery close to the ground (Venus' Magellan SAR, #83): tile levels the backend serves
const DETAIL = { venus: { url: (z, x, y) => `/api/sar-tile/venus/${z}/${x}/${y}`, min: 3, max: 8 } };
const MAX_DETAIL = 96;

/** Planetocentric lat / east lon of a mesh-frame direction, honouring the colour map's offset (texLon0). */
export function meshDirToLatLon(body, dir) {
  const { lat, lon } = dirToLatLon(dir);
  let L = lon + ((body.texLon0 ?? -180) + 180);
  if (L > 180) L -= 360;
  return { lat, lon: L };
}

/** Point a DEM-enabled globe material at a decoded DEM `d` (src/data/dem.js) with exaggeration k (0 = off). */
export function setDemUniforms(material, body, d, k) {
  const u = material?.uniforms;
  if (!u?.uDem || !d) return false;
  const on = k > 0 && d.meta.shading !== 'none';
  u.uDem.value = d.texture;
  u.uDemU0.value = demUOffset(body.texLon0);
  u.uDemTexel.value.set(1 / d.dem.width, 1 / d.dem.height);
  u.uDemOn.value = on ? 1 : 0;
  u.uDemDisp.value = on ? 1 : 0;
  u.uDemK.value = k / (body.radiusKm * 1000);
  return on;
}

export function createRelief({ settings }) {
  const k = () => reliefK(settings.get('relief') ?? 'true');
  const states = new Map(); // body id → { node, dem, near, lod }

  /** Start loading a node's DEM; uniforms are set when it arrives. */
  function attach(node) {
    const u = node.mesh?.material?.uniforms;
    if (!u?.uDem) return;
    loadDem(node.body.id).then((d) => {
      if (!d || !node.mesh?.material?.uniforms?.uDem) return;
      const st = { node, dem: d, near: false, lod: null, k: null };
      states.set(node.body.id, st);
      setDemUniforms(node.mesh.material, node.body, d, k());
      apply(st);
    });
  }

  /** Globe relief drawn? Venus' clouds hide its ground: readouts and the surface view only. */
  const globeShaded = (st) => st.dem.meta.shading !== 'none';

  function apply(st) {
    const kk = k(), u = st.node.mesh.material.uniforms;
    if (!u?.uDem) return;
    const on = kk > 0 && globeShaded(st) && st.node.mesh.isMesh && st.node.mesh.geometry?.type === 'SphereGeometry';
    u.uDemOn.value = on ? 1 : 0;
    u.uDemDisp.value = on ? 1 : 0;
    u.uDemK.value = kk / (st.node.body.radiusKm * 1000);
    if (st.k !== kk) { st.k = kk; st.node.sites?.setRelief?.(radiusFn(st.node.body.id)); st.node.features?.setRelief?.(radiusFn(st.node.body.id)); if (st.lod) st.lod.dirtyAll = true; }
  }

  /** Drawn radius (body radii) at true lat/lon: the finest heights already loaded (no new requests). */
  function radiusFn(id) {
    const st = states.get(id);
    if (!st) return null;
    const kk = st.k ?? k(), R = st.node.body.radiusKm;
    if (kk === 0 || !globeShaded(st)) return null;
    return (lat, lon) => heightToRadius(drawH(st, heightAt(id, lat, lon, 99, { request: false })?.hDraw), R, kk);
  }
  /** The drawn height: Earth's sea is a flat surface (read-outs keep the bathymetry). */
  const drawH = (st, h) => (st.dem.meta.shading === 'land' && h < 0 ? 0 : h);

  /** Height (m, true) and its source at a mesh-frame direction on body `id`: { h, lat, lon, meta, res, cellKm } or null. */
  function elevationAtDir(id, dir, z = 99, request = false) {
    const st = states.get(id);
    if (!st) return null;
    const ll = meshDirToLatLon(st.node.body, dir);
    const r = heightAt(id, ll.lat, ll.lon, z, { request });
    return r ? { ...r, ...ll, meta: st.dem.meta } : null;
  }

  /** Drawn surface radius (body radii) at a mesh-frame direction: what the camera stands on and the helm avoids. */
  function groundAtDir(id, dir, { surface = false } = {}) {
    const st = states.get(id);
    if (!st) return 1;
    const kk = k();
    if (kk === 0 || (!globeShaded(st) && !surface)) return 1;
    const e = elevationAtDir(id, dir, 99, false);
    return heightToRadius(drawH(st, e?.hDraw), st.node.body.radiusKm, kk);
  }

  // ---- the tiled level-of-detail globe -----------------------------------------------------------
  function makeLod(st) {
    const mat = st.node.mesh.material;
    // same shader and shared uniform objects (lighting, band mode, eclipses, clouds' shadows follow the globe), but lit
    // by the chunks' own geometry: no normal map on top, no displacement, no discard
    const base = new THREE.ShaderMaterial({
      vertexShader: mat.vertexShader, fragmentShader: mat.fragmentShader, defines: { ...mat.defines },
      uniforms: { ...mat.uniforms, uDemOn: { value: 0 }, uDemDisp: { value: 0 }, uDemClip: { value: new THREE.Vector4(0, 1, 0, 2) } },
    });
    base.userData = { ...mat.userData };
    const group = new THREE.Group();
    group.userData.terrain = true;
    return { base, group, chunks: new Map(), shown: new Set(), dirtyAll: false, surfaceDir: null, detail: new Map(), stats: { built: 0 } };
  }

  // index buffer shared by every chunk: the (GRID+1)² grid, two triangles per cell, then the skirts
  const N1 = GRID + 1, SKIRT0 = N1 * N1;
  const edge = [];
  for (let j = 0; j <= GRID; j++) edge.push(j); // north row, west → east
  for (let i = 1; i <= GRID; i++) edge.push(i * N1 + GRID); // east column, north → south
  for (let j = GRID - 1; j >= 0; j--) edge.push(GRID * N1 + j); // south row, east → west
  for (let i = GRID - 1; i >= 1; i--) edge.push(i * N1); // west column, south → north
  const INDEX = (() => {
    const idx = [];
    for (let i = 0; i < GRID; i++) for (let j = 0; j < GRID; j++) {
      const a = i * N1 + j, b = a + 1, c = a + N1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    for (let e = 0; e < edge.length; e++) { // skirt quads, both faces (seen from either side of a crack)
      const p = edge[e], q = edge[(e + 1) % edge.length], ps = SKIRT0 + e, qs = SKIRT0 + ((e + 1) % edge.length);
      idx.push(p, ps, q, q, ps, qs, p, q, ps, q, qs, ps);
    }
    return idx;
  })();

  const tv = new THREE.Vector3(), tc = new THREE.Vector3();
  /** (Re)build chunk (z, x, y) of body `st`: positions relative to its centre, normals from the grid (with an apron). */
  function buildChunk(st, lod, z, x, y, old) {
    const body = st.node.body, id = body.id, R = body.radiusKm;
    const kDraw = k(); // relief OFF: the chunks are pieces of the plain sphere
    const b = chunkBounds(z, x, y), cell = b.deg / GRID, off = (body.texLon0 ?? -180) + 180;
    const tl = chunkTileLevel(z, tileMinLevel(st.dem.meta), tileMaxLevel(st.dem.meta));
    let pending = false;
    // heights on a (GRID+3)² grid: one cell of apron round the chunk for the normals
    const A = GRID + 3, rad = new Float32Array(A * A), dirs = new Float32Array(A * A * 3);
    for (let i = 0; i < A; i++) {
      const lat = Math.max(-90, Math.min(90, b.north - (i - 1) * cell));
      for (let j = 0; j < A; j++) {
        const lon = b.west + (j - 1) * cell;
        const r = heightAt(id, lat, lon, tl, { request: tl >= 0 && i > 0 && i < A - 1 && j > 0 && j < A - 1 });
        if (tl >= 0 && r && r.res !== `tile ${tl}`) pending = true;
        rad[i * A + j] = heightToRadius(drawH(st, r?.hDraw), R, kDraw);
        const d = latLonToDir(lat, lon - off);
        dirs.set(d, (i * A + j) * 3);
      }
    }
    const ci = (A >> 1) * A + (A >> 1), rc = rad[ci];
    tc.fromArray(dirs, ci * 3);
    const centre = tc.clone().multiplyScalar(rc);
    const n = SKIRT0 + edge.length;
    const geo = old?.mesh.geometry ?? new THREE.BufferGeometry();
    const pos = geo.attributes.position?.array ?? new Float32Array(n * 3), nor = geo.attributes.normal?.array ?? new Float32Array(n * 3), uv = geo.attributes.uv?.array ?? new Float32Array(n * 2);
    const surf = new Float32Array(N1 * N1); // drawn radius at each vertex (the ground under the surface camera)
    const P = (i, j, out) => { const q = i * A + j; return out.set(dirs[q * 3] * rad[q], dirs[q * 3 + 1] * rad[q], dirs[q * 3 + 2] * rad[q]); };
    const pE = new THREE.Vector3(), pW = new THREE.Vector3(), pN = new THREE.Vector3(), pS = new THREE.Vector3(), nn = new THREE.Vector3();
    const u0 = (b.west - off + 180) / 360;
    for (let i = 0; i <= GRID; i++) for (let j = 0; j <= GRID; j++) {
      const v = i * N1 + j, ii = i + 1, jj = j + 1;
      P(ii, jj, tv);
      pos[v * 3] = tv.x - centre.x; pos[v * 3 + 1] = tv.y - centre.y; pos[v * 3 + 2] = tv.z - centre.z;
      P(ii, jj + 1, pE); P(ii, jj - 1, pW); P(ii - 1, jj, pN); P(ii + 1, jj, pS);
      nn.copy(pE.sub(pW)).cross(pN.sub(pS));
      if (nn.lengthSq() < 1e-30 || nn.dot(tv) < 0) nn.copy(tv); // poles (degenerate rows): the radial direction
      nn.normalize();
      nor[v * 3] = nn.x; nor[v * 3 + 1] = nn.y; nor[v * 3 + 2] = nn.z;
      uv[v * 2] = u0 + (j * cell) / 360; uv[v * 2 + 1] = (Math.max(-90, Math.min(90, b.north - i * cell)) + 90) / 180;
      surf[v] = rad[ii * A + jj];
    }
    // skirts: each rim vertex again, dropped by a depth that covers the step to a coarser neighbour
    const hr = (st.dem.meta.max - st.dem.meta.min) * kDraw / (R * 1000);
    const depth = Math.min((b.deg * Math.PI) / 180 * 0.02, hr * 0.5 + 1e-6) + 2e-7;
    for (let e = 0; e < edge.length; e++) {
      const v = edge[e], s = SKIRT0 + e;
      const x0 = pos[v * 3] + centre.x, y0 = pos[v * 3 + 1] + centre.y, z0 = pos[v * 3 + 2] + centre.z, L = Math.hypot(x0, y0, z0), f = (L - depth) / L;
      pos[s * 3] = x0 * f - centre.x; pos[s * 3 + 1] = y0 * f - centre.y; pos[s * 3 + 2] = z0 * f - centre.z;
      nor[s * 3] = nor[v * 3]; nor[s * 3 + 1] = nor[v * 3 + 1]; nor[s * 3 + 2] = nor[v * 3 + 2];
      uv[s * 2] = uv[v * 2]; uv[s * 2 + 1] = uv[v * 2 + 1];
    }
    if (!old) {
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      geo.setIndex(INDEX);
    } else {
      geo.attributes.position.needsUpdate = true; geo.attributes.normal.needsUpdate = true; geo.attributes.uv.needsUpdate = true;
    }
    geo.computeBoundingSphere();
    const mesh = old?.mesh ?? new THREE.Mesh(geo, lod.base);
    mesh.position.copy(centre);
    mesh.renderOrder = -1;
    mesh.userData.terrain = true;
    mesh.raycast = () => {}; // picking uses the globe's sphere (cheap); the chunks are for drawing
    lod.stats.built++;
    return { mesh, z, x, y, key: chunkKey(z, x, y), pending, built: performance.now(), surf, b, used: 0, k: kDraw, detail: old?.detail ?? null };
  }

  /** Venus' SAR detail for a chunk: a texture from the backend tile at the chunk's level (or the finest offered). */
  function detailFor(st, lod, c) {
    const spec = DETAIL[st.node.body.id];
    if (!spec || c.z < spec.min) return null;
    const zt = Math.min(spec.max, c.z), sh = c.z - zt, x = c.x >> sh, y = c.y >> sh, key = `${zt}/${x}/${y}`;
    let d = lod.detail.get(key);
    if (!d) {
      d = { key, tex: null, used: 0, failed: false };
      lod.detail.set(key, d);
      new THREE.TextureLoader().load(spec.url(zt, x, y), (t) => {
        t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.generateMipmaps = true; d.tex = t;
      }, undefined, () => { d.failed = true; });
      if (lod.detail.size > MAX_DETAIL) { // least recently used first
        const old = [...lod.detail.values()].filter((v) => v !== d).sort((a, b) => a.used - b.used).slice(0, lod.detail.size - MAX_DETAIL);
        for (const o of old) { o.tex?.dispose(); lod.detail.delete(o.key); }
      }
    }
    d.used = performance.now();
    if (!d.tex) return null;
    const b = chunkBounds(zt, x, y), off = (st.node.body.texLon0 ?? -180) + 180;
    return { tex: d.tex, rect: [(b.west - off + 180) / 360, (b.north - b.deg + 90) / 180, b.deg / 360, b.deg / 180] };
  }
  function applyDetail(st, lod, c) {
    const det = detailFor(st, lod, c);
    if (!det) { if (c.mesh.material !== lod.base) { c.mesh.material.dispose(); c.mesh.material = lod.base; } return; }
    if (c.mesh.material === lod.base) {
      const m = lod.base.clone();
      m.uniforms = { ...lod.base.uniforms, uDetail: { value: det.tex }, uDetailOn: { value: 1 }, uDetailRect: { value: new THREE.Vector4(...det.rect) } };
      c.mesh.material = m;
    } else if (c.mesh.material.uniforms.uDetail.value !== det.tex) {
      c.mesh.material.uniforms.uDetail.value = det.tex; c.mesh.material.uniforms.uDetailRect.value.set(...det.rect);
    }
  }

  function dropChunk(lod, c) {
    c.mesh.removeFromParent();
    c.mesh.geometry.dispose();
    if (c.mesh.material !== lod.base) c.mesh.material.dispose();
    lod.chunks.delete(c.key);
  }
  function disposeLod(st) {
    const lod = st.lod;
    if (!lod) return;
    for (const c of [...lod.chunks.values()]) dropChunk(lod, c);
    for (const d of lod.detail.values()) d.tex?.dispose();
    lod.group.removeFromParent();
    lod.base.dispose();
    st.lod = null;
  }

  const geoCam = [0, 0, 0];
  /** Per frame: choose, build and show the chunks for a camera at `camLocal` (mesh frame, body radii). */
  function updateLod(st, camLocal, surfaceDir) {
    const node = st.node, body = node.body;
    const lod = (st.lod ??= makeLod(st));
    if (lod.group.parent !== node.mesh) node.mesh.add(lod.group);
    lod.surface = !!surfaceDir;
    lod.surfaceDir = surfaceDir ? surfaceDir.clone() : null;
    const now = performance.now();
    tileTick();
    // the camera in the geo frame (true lat/lon), at its distance in radii
    const dist = Math.max(camLocal.length(), 1 + 1e-9);
    const ll = meshDirToLatLon(body, camLocal.toArray());
    const c = Math.cos(ll.lat * Math.PI / 180);
    geoCam[0] = dist * c * Math.cos(ll.lon * Math.PI / 180); geoCam[1] = dist * c * Math.sin(ll.lon * Math.PI / 180); geoCam[2] = dist * Math.sin(ll.lat * Math.PI / 180);
    const R = body.radiusKm, kk = Math.max(k(), 1);
    // finest level: cells of ~20 m standing, else as fine as the tiles (and a little finer, to keep the shape smooth)
    const zTiles = Math.max(0, tileMaxLevel(st.dem.meta)) + 3;
    const zCell = Math.floor(Math.log2((90 / GRID) * (Math.PI / 180) * R / 0.02)); // level whose cells are ~20 m
    const maxLevel = Math.max(4, Math.min(surfaceDir ? zCell : zTiles + 2, zCell));
    const fovK = 70 / (lod.fov ?? 70);
    const leaves = selectChunks(geoCam, { maxLevel, tau: 0.32 / fovK, pad: reliefPad(Math.max(0, st.dem.meta.max), R, kk) + 0.002, maxChunks: MAX_CHUNKS - 40 });
    lod.dbg = { maxLevel, dist, leaves: leaves.length, top: leaves.reduce((m, l) => Math.max(m, l.z), 0) };
    // build what is missing (coarse first: an ancestor always covers the gap), rebuild what finer tiles improved
    const want = [];
    for (const l of leaves) {
      const ex = lod.chunks.get(l.key);
      if (!ex) {
        // make sure the ancestors exist first, down from level 0
        let p = [l.z, l.x, l.y];
        const chain = [];
        while (p) { const kk2 = chunkKey(...p); if (lod.chunks.has(kk2)) break; chain.push(p); p = chunkParent(...p); }
        // what looks biggest first; each chain coarse to fine (its ancestors cover the gap until it is built)
        for (let i = chain.length - 1; i >= 0; i--) want.push({ z: chain[i][0], x: chain[i][1], y: chain[i][2], pri: -l.score + 1e-6 * chain[i][0], old: null });
      } else if (lod.dirtyAll || ex.k !== k() || (ex.pending && lod.tilesAt > ex.built && now - ex.built > 400)) {
        want.push({ z: l.z, x: l.x, y: l.y, pri: -l.score + 1, old: ex }); // refinements after what is missing
      }
    }
    lod.dirtyAll = false;
    const seen = new Set();
    want.sort((a, b) => a.pri - b.pri);
    let builds = 0;
    const t0 = performance.now();
    for (const w of want) {
      const key = chunkKey(w.z, w.x, w.y);
      if (seen.has(key)) continue;
      seen.add(key);
      // level 0 always (it covers everything); the rest within a frame budget of ~8 ms (at least two builds)
      if (!(w.z === 0 && !lod.chunks.has(key)) && builds >= 2 && (builds >= BUILDS_PER_FRAME * 3 || performance.now() - t0 > 8)) continue;
      builds++;
      const ch = buildChunk(st, lod, w.z, w.x, w.y, w.old ?? lod.chunks.get(key));
      lod.chunks.set(key, ch);
    }
    const show = chunksToShow(leaves, (key) => lod.chunks.has(key));
    for (const c2 of lod.chunks.values()) {
      const on = show.has(c2.key);
      if (on) {
        c2.used = now;
        if (c2.mesh.parent !== lod.group) lod.group.add(c2.mesh);
        if (DETAIL[body.id]) applyDetail(st, lod, c2);
      } else if (c2.mesh.parent) c2.mesh.removeFromParent();
    }
    lod.shown = show;
    // bounded: least recently shown chunks go first (ancestors of what is shown are kept, they cover the gaps)
    if (lod.chunks.size > MAX_CHUNKS) {
      const keep = new Set();
      for (const key of show) { let p = key.split('/').map(Number); while (p) { keep.add(chunkKey(...p)); p = chunkParent(...p); } }
      for (const l of leaves) { let p = [l.z, l.x, l.y]; while (p) { keep.add(chunkKey(...p)); p = chunkParent(...p); } }
      const old = [...lod.chunks.values()].filter((c3) => !keep.has(c3.key)).sort((a, b) => a.used - b.used);
      for (const c3 of old.slice(0, lod.chunks.size - MAX_CHUNKS)) dropChunk(lod, c3);
    }
    // the globe is discarded wherever the chunks draw: everywhere
    node.mesh.material.uniforms.uDemClip.value.set(0, 1, 0, -2);
  }

  /** The drawn ground (mesh-frame radius) under mesh-frame direction `dir`, from the finest chunk shown there. */
  function lodGround(st, dir) {
    const lod = st.lod;
    if (!lod || !lod.shown.size) return null;
    const ll = meshDirToLatLon(st.node.body, dir);
    for (let z = 22; z >= 0; z--) {
      const c = chunkAt(z, ll.lat, ll.lon), ch = lod.chunks.get(chunkKey(z, c.x, c.y));
      if (!ch || !lod.shown.has(ch.key)) continue;
      const cell = ch.b.deg / GRID, L = ((((ll.lon - ch.b.west) % 360) + 360) % 360);
      return gridSurface(ch.surf, L / cell, (ch.b.north - ll.lat) / cell);
    }
    return null;
  }

  /**
   * Per frame for a node: camera position in the mesh frame (`camLocal`, body radii), whether we stand
   * on it (`surface`: { dir } in the mesh frame), whether it is focused, and the camera's field of view.
   */
  function update(node, { camLocal, surface = null, focused = false, fov = 70 }) {
    const st = states.get(node.body.id);
    if (!st) return;
    if (st.k !== k()) apply(st);
    const dist = camLocal.length();
    // denser sphere when close, so displacement shows mountains on the limb
    const near = dist < 4 && node.mesh.isMesh && node.mesh.geometry?.type === 'SphereGeometry';
    if (near !== st.near && node.mesh.geometry?.type === 'SphereGeometry') {
      st.near = near;
      const [a, b] = near ? SEG_NEAR : SEG_FAR;
      node.mesh.geometry.dispose();
      node.mesh.geometry = new THREE.SphereGeometry(1, a, b);
    }
    // tiled globe: standing on the body, or close to it with relief on (Venus: only under its cloud deck)
    const deck = node.clouds?.userData?.opaque ? (node.clouds.userData.layer?.shellKm ?? 0) / node.body.radiusKm : 0;
    const want = !!surface || (focused && dist < LOD_DIST && k() > 0 && globeShaded(st) && !(deck && dist - 1 > deck));
    const u = node.mesh.material.uniforms;
    if (!want) {
      if (st.lod) disposeLod(st);
      if (u.uDemClip) u.uDemClip.value.w = 2;
      return;
    }
    if (st.lod) st.lod.fov = fov;
    updateLod(st, surface ? surface.dir.clone().multiplyScalar(Math.max(dist, 1)) : camLocal, surface ? surface.dir : null);
    if (surface) st.lod.ground = lodGround(st, surface.dir.toArray());
  }

  let tilesSince = 0;
  onTileLoaded((id) => { tilesSince = performance.now(); const st = states.get(id); if (st?.lod) st.lod.tilesAt = tilesSince; });

  return {
    attach, update, elevationAtDir, groundAtDir, radiusFn,
    has: (id) => states.has(id),
    meta: (id) => states.get(id)?.dem.meta ?? null,
    get k() { return k(); },
    /** Mesh-frame radius of the drawn ground under the surface camera (the finest chunk there), or null. */
    patchGround: (id) => states.get(id)?.lod?.ground ?? null,
    /** The tiled globe's state, for browser checks: chunks held and shown, levels, tiles held. */
    lodStats(id) {
      const lod = states.get(id)?.lod;
      if (!lod) return null;
      const levels = {};
      for (const key of lod.shown) { const z = key.split('/')[0]; levels[z] = (levels[z] ?? 0) + 1; }
      return { held: lod.chunks.size, shown: lod.shown.size, levels, select: lod.dbg, built: lod.stats.built, tiles: tileCount(), detail: lod.detail.size };
    },
    refresh() { for (const st of states.values()) apply(st); },
  };
}

export { demNow };
