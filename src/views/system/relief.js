// Relief on the globes (#80). Each body with a bundled DEM (public/dem) gets:
//  · a normal map derived from its heights in the globe's shader (lighting reveals terrain at any distance),
//  · vertex displacement by the same heights (TRUE or exaggerated), on a denser sphere when the camera is close,
//  · close up and in the surface view, a terrain patch around the point below the camera: a polar grid,
//    finest at its centre, built on the CPU from the finest heights available (/api/dem-tile tiles, else the
//    global grid), lit by its own geometry; the globe is discarded underneath it.
// Pure helpers live in src/astro/dem.js; the DEMs and tiles in src/data/dem.js.

import * as THREE from 'three';
import { loadDem, demNow, heightAt, tileMaxLevel, onTileLoaded } from '../../data/dem.js';
import { demUOffset, heightToRadius, reliefK } from '../../astro/dem.js';
import { dirToLatLon } from './surface.js';

// globe tessellation by camera distance (body radii): far, mid (the helm's standoff), near (mountains on the limb);
// shared, cached geometries (#42: rebuilding a 74k-vertex sphere for every approach stalled a slow GPU)
const SEGS = [[96, 48], [192, 96], [384, 192]];
const TIER_IN = [Infinity, 4, 1.6]; // enter tier i below this distance
const sphereCache = new Map();
const sphereGeo = (tier) => { if (!sphereCache.has(tier)) sphereCache.set(tier, new THREE.SphereGeometry(1, ...SEGS[tier])); return sphereCache.get(tier); };
/** The globe's tessellation tier at camera distance `dist` (radii), with 10% hysteresis around the current tier `cur`. */
export function globeTier(dist, cur = 0) {
  let t = 0;
  for (let i = 1; i < TIER_IN.length; i++) if (dist < TIER_IN[i] * (i <= cur ? 1.1 : 1)) t = i;
  return t;
}
const RINGS = 96, SPOKES = 192;

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
  const states = new Map(); // body id → { node, dem, near, patch }

  /** Start loading a node's DEM; uniforms are set when it arrives. */
  function attach(node) {
    const u = node.mesh?.material?.uniforms;
    if (!u?.uDem) return;
    loadDem(node.body.id).then((d) => {
      if (!d || !node.mesh?.material?.uniforms?.uDem) return;
      const st = { node, dem: d, near: false, patch: null, k: null };
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
    if (st.k !== kk) { st.k = kk; st.node.sites?.setRelief?.(radiusFn(st.node.body.id)); st.node.features?.setRelief?.(radiusFn(st.node.body.id)); if (st.patch) st.patch.dirty = true; }
  }

  /** Drawn radius (body radii) at true lat/lon: the finest heights already loaded (no new requests). */
  function radiusFn(id) {
    const st = states.get(id);
    if (!st) return null;
    const kk = st.k ?? k(), R = st.node.body.radiusKm;
    if (kk === 0 || !globeShaded(st)) return null;
    return (lat, lon) => heightToRadius(heightAt(id, lat, lon, 99, { request: false })?.hDraw, R, kk);
  }

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
    return heightToRadius(e?.hDraw, st.node.body.radiusKm, kk);
  }

  // ---- terrain patch -----------------------------------------------------------------------------
  function makePatch(st) {
    const mat = st.node.mesh.material;
    // same shader and shared uniform objects (lighting, band mode, eclipses follow the globe), but lit by its
    // own geometry: no normal map on top, no displacement, no discard
    const pm = new THREE.ShaderMaterial({
      vertexShader: mat.vertexShader, fragmentShader: mat.fragmentShader, defines: { ...mat.defines },
      uniforms: { ...mat.uniforms, uDemOn: { value: 0 }, uDemDisp: { value: 0 }, uDemClip: { value: new THREE.Vector4(0, 1, 0, 2) } },
    });
    pm.userData = { ...mat.userData };
    const n = (RINGS + 1) * SPOKES;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    const idx = [];
    for (let i = 0; i < RINGS; i++) for (let j = 0; j < SPOKES; j++) {
      const a = i * SPOKES + j, b = i * SPOKES + ((j + 1) % SPOKES), c = a + SPOKES, d = b + SPOKES;
      idx.push(a, c, b, b, c, d);
    }
    geo.setIndex(idx);
    const mesh = new THREE.Mesh(geo, pm);
    mesh.frustumCulled = false;
    mesh.renderOrder = -1;
    mesh.userData.terrain = true;
    return { mesh, centre: new THREE.Vector3(), alpha: 0, built: null, dirty: true, z: 0 };
  }

  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), d = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  /** (Re)build the patch around mesh-frame direction `c`, angular radius `alpha` (rad). */
  function buildPatch(st, p, c, alpha, surface) {
    const body = st.node.body, id = body.id, R = body.radiusKm, kk = surface && !globeShaded(st) ? Math.max(1, k()) : Math.max(k(), 0);
    const kDraw = kk === 0 ? 0 : kk;
    p.centre.copy(c).normalize(); p.alpha = alpha;
    e1.copy(Math.abs(p.centre.y) > 0.99 ? new THREE.Vector3(1, 0, 0) : up).cross(p.centre).normalize();
    e2.copy(p.centre).cross(e1).normalize();
    const pos = p.mesh.geometry.attributes.position.array, uv = p.mesh.geometry.attributes.uv.array;
    const zmax = tileMaxLevel(st.dem.meta);
    const llc = dirToLatLon(p.centre.toArray());
    const uc = (llc.lon + 180) / 360;
    const rc = heightToRadius(elevationAtDir(id, p.centre.toArray(), zmax, true)?.hDraw, R, kDraw);
    let pending = false;
    for (let i = 0; i <= RINGS; i++) {
      const t = i / RINGS, th = alpha * t * t; // rings packed towards the centre
      // tile level for this ring: cells no larger than the ring spacing
      const spacingDeg = Math.max((2 * alpha * Math.max(t, 1 / RINGS)) / RINGS, 1e-6) * 180 / Math.PI;
      const z = Math.max(0, Math.min(zmax, Math.floor(Math.log2(90 / (256 * spacingDeg)))));
      const ct = Math.cos(th), sn = Math.sin(th);
      for (let j = 0; j < SPOKES; j++) {
        const ph = (j / SPOKES) * 2 * Math.PI;
        d.copy(p.centre).multiplyScalar(ct).addScaledVector(e1, Math.cos(ph) * sn).addScaledVector(e2, Math.sin(ph) * sn);
        const dir = d.toArray();
        const ll = meshDirToLatLon(body, dir);
        const r = heightAt(id, ll.lat, ll.lon, i === 0 ? zmax : z, { request: true });
        if (r && r.res === 'global' && z > 0) pending = true;
        const rad = heightToRadius(r?.hDraw, R, kDraw);
        const k3 = (i * SPOKES + j) * 3;
        // relative to the patch centre (float precision close to the ground)
        pos[k3] = d.x * rad - p.centre.x * rc; pos[k3 + 1] = d.y * rad - p.centre.y * rc; pos[k3 + 2] = d.z * rad - p.centre.z * rc;
        const m = dirToLatLon(dir);
        let u = (m.lon + 180) / 360;
        if (u - uc > 0.5) u -= 1; else if (uc - u > 0.5) u += 1; // continuous across the map's seam
        uv[(i * SPOKES + j) * 2] = u; uv[(i * SPOKES + j) * 2 + 1] = (m.lat + 90) / 180;
      }
    }
    p.mesh.position.copy(p.centre).multiplyScalar(rc);
    const g = p.mesh.geometry;
    g.attributes.position.needsUpdate = true; g.attributes.uv.needsUpdate = true;
    g.computeVertexNormals();
    g.computeBoundingSphere();
    p.dirty = false; p.pending = pending; p.builtK = kDraw;
    p.built = performance.now();
    p.groundRc = rc;
  }

  /**
   * Per frame for a node: camera position in the mesh frame (`camLocal`, body radii), whether we stand
   * on it (`surface`: { dir } in the mesh frame), and whether it is focused.
   */
  function update(node, { camLocal, surface = null, focused = false }) {
    const st = states.get(node.body.id);
    if (!st) return;
    if (st.k !== k()) apply(st);
    const dist = camLocal.length();
    // denser sphere when close, so displacement shows mountains on the limb
    if (node.mesh.isMesh && node.mesh.geometry?.type === 'SphereGeometry') {
      const tier = globeTier(dist, st.tier ?? 0);
      if (tier !== (st.tier ?? 0) || (tier > 0 && node.mesh.geometry !== sphereGeo(tier))) {
        const old = node.mesh.geometry;
        node.mesh.geometry = sphereGeo(tier);
        if (![...sphereCache.values()].includes(old)) old.dispose();
        st.tier = tier;
      }
      st.near = tier === 2;
    }
    // terrain patch: standing on the body, or within ~0.25 radii of the ground with relief on
    const alt = dist - 1;
    const want = !!surface || (focused && alt < 0.25 && k() > 0 && globeShaded(st));
    const u = node.mesh.material.uniforms;
    if (!want) {
      if (st.patch) { st.patch.mesh.removeFromParent(); st.patch.mesh.geometry.dispose(); st.patch.mesh.material.dispose(); st.patch = null; }
      if (u.uDemClip) u.uDemClip.value.w = 2;
      return;
    }
    const p = (st.patch ??= makePatch(st));
    if (p.mesh.parent !== node.mesh) node.mesh.add(p.mesh);
    const R = node.body.radiusKm;
    const c = surface ? surface.dir : camLocal;
    // the patch reaches the horizon of what can be seen: standing, ~350 km (mountains far off);
    // in flight, a few times the altitude
    const alpha = surface ? Math.min(0.5, 350 / R) : Math.min(0.5, Math.max(20 / R, 3 * alt));
    const moved = p.built == null ? Infinity : Math.acos(Math.min(1, d.copy(c).normalize().dot(p.centre)));
    const rebuild = p.dirty || p.built == null || moved > p.alpha * (surface ? 0.02 : 0.2) || Math.abs(Math.log(alpha / p.alpha)) > 0.4
      || (p.pending && performance.now() - p.built > 600 && tilesSince > p.built);
    if (rebuild) buildPatch(st, p, c, alpha, !!surface);
    // discard the globe under the patch, just inside its rim (the rim joins the globe's displaced surface)
    if (u.uDemClip) u.uDemClip.value.set(p.centre.x, p.centre.y, p.centre.z, Math.cos(p.alpha * 0.97));
  }

  let tilesSince = 0;
  onTileLoaded(() => { tilesSince = performance.now(); for (const st of states.values()) if (st.patch) st.patch.pending = true; });

  return {
    attach, update, elevationAtDir, groundAtDir, radiusFn,
    has: (id) => states.has(id),
    meta: (id) => states.get(id)?.dem.meta ?? null,
    get k() { return k(); },
    /** Mesh-frame radius of the patch surface at its centre (what the surface camera stands on), or null. */
    patchGround: (id) => states.get(id)?.patch?.groundRc ?? null,
    refresh() { for (const st of states.values()) apply(st); },
  };
}

export { demNow };
