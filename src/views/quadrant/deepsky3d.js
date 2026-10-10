// 3D nebulae and cluster star swarms for the Quadrant View (#24).
//
// Nebulae: each real image (src/data/nebula3d.js) is a stack of parallel slices in the plane of
// the sky at the nebula's distance, north aligned with equatorial north there, at its true
// physical size (angular size × distance). A model profile spreads each pixel's light along the
// line of sight over the slices and the weights along every sightline sum to one, so from Sol the
// stack reproduces the image exactly (MEASURED) while from elsewhere it shows the modelled shape.
// Dark clouds add a dust layer whose opacity comes from how dark the image is.
//
// Clusters: the brightest Gaia DR3 members (Hunt & Reffert 2023) of a cluster, loaded when it is
// selected or large on screen, drawn at their measured directions, colours (BP−RP) and
// brightnesses; depth along the line of sight from parallax where it is precise, modelled
// otherwise (`memberDistance`).

import * as THREE from 'three';
import { eqToGal, frameToScene, blackbodyRGB, LY_PER_PC } from '../../astro/frames.js';
import { skyBasis, physicalSize, planeOffset, radecVec, memberDistance, teffFromBpRp } from '../../astro/skyplane.js';
import { NEBULA_3D, CLUSTER_NEBULOSITY, NEBULA_STARS } from '../../data/nebula3d.js';
import { ageTeff } from '../../data/deepsky.js';
import { pickPoint } from '../pick.js';

const STEPS = 48; // ray-march samples through each nebula's volume
const KINDS = { blister: 0, cloud: 1, shell: 2, filled: 3, barrel: 4 };
const sceneVec = (eq) => new THREE.Vector3(...frameToScene(eqToGal(eq)));

// The nebula is a box in its own frame (x: image right, y: image up, z: toward Sol), ray-marched:
// each sample takes the image pixel straight behind it along our line of sight and weights it by
// the model profile f(ρ, z) / ∫f dz, so the integral along any sightline from Sol is the image.
const VERT = `
  varying vec3 vPos;
  void main() { vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FRAG = `
  uniform sampler2D map; uniform vec2 uFov, uC, uSize; uniform vec3 uCam;
  uniform float uR, uRly, uZbox, uDepth, uW, uBlack, uGain, uMean, uPix, uTexW, uLodBias;
  uniform int uKind, uDust; uniform vec3 uTint;
  varying vec3 vPos;
  const float SQPI = 1.7724539;
  float erf1(float x) { float t = 1.0 / (1.0 + 0.47047 * abs(x)); float y = 1.0 - t * (0.3480242 - t * (0.0958798 - t * 0.7478556)) * exp(-x * x); return sign(x) * y; }
  float prof(float rho, float z) {
    float az = abs(z);
    if (uKind == 0) { float zs = -uDepth + uDepth * min(rho * rho, 2.0); float t = (z - zs) / uW; return exp(-t * t); }
    if (uKind == 1) { float t = z / uDepth; return exp(-t * t); }
    if (uKind == 2) { float d = uDepth * sqrt(max(0.0, 1.0 - rho * rho)); float t = (az - d) / uW; return exp(-t * t); }
    if (uKind == 3) { float d = max(uDepth * sqrt(max(0.0, 1.0 - rho * rho)), uW); return 1.0 - smoothstep(d - uW, d + uW, az); }
    float H = rho < 1.15 ? uDepth : uW; return 1.0 - smoothstep(H - uW, H + uW, az);
  }
  // ∫ prof dz over the box, in units of R
  float norm(float rho) {
    if (uKind == 0) return uW * SQPI;
    if (uKind == 1) return uDepth * SQPI * erf1(uZbox / uRly / uDepth);
    if (uKind == 2) { float d = uDepth * sqrt(max(0.0, 1.0 - rho * rho)); return uW * SQPI * (1.0 + erf1(d / uW)); }
    if (uKind == 3) return 2.0 * max(uDepth * sqrt(max(0.0, 1.0 - rho * rho)), uW);
    return 2.0 * (rho < 1.15 ? uDepth : uW);
  }
  void main() {
    vec3 ro = uCam, rd = normalize(vPos - uCam);
    vec3 bmin = vec3(-0.5 * uSize, -uZbox), bmax = vec3(0.5 * uSize, uZbox);
    vec3 inv = 1.0 / rd, t0 = (bmin - ro) * inv, t1 = (bmax - ro) * inv;
    vec3 tmin = min(t0, t1), tmax = max(t0, t1);
    float tn = max(max(max(tmin.x, tmin.y), tmin.z), 0.0), tf = min(min(tmax.x, tmax.y), tmax.z);
    if (tf <= tn) discard;
    float dt = (tf - tn) / float(${STEPS});
    float t = tn + dt * fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453); // jitter: no banding
    vec3 acc = vec3(0.0); float tau = 0.0;
    for (int i = 0; i < ${STEPS}; i++) {
      vec3 q = ro + rd * t; t += dt;
      vec2 uv = q.xy / uSize + 0.5;
      vec2 p = ((uv - 0.5) * uFov - uC) / uR; float rho = length(p);
      float f = prof(rho, q.z / uRly);
      if (f < 1e-4) continue;
      float w = f / max(norm(rho), 1e-4) * dt / uRly;
      float edge = smoothstep(0.0, 0.1, uv.x) * smoothstep(1.0, 0.9, uv.x) * smoothstep(0.0, 0.1, uv.y) * smoothstep(1.0, 0.9, uv.y);
      float lod = max(0.0, log2(max(t, 1e-6) * uPix * uTexW / uSize.x)) + uLodBias;
      if (uDust == 1) {
        vec3 b = textureLod(map, uv, max(lod, 4.0)).rgb; float lum = dot(b, vec3(0.3, 0.59, 0.11));
        tau += smoothstep(0.2, 0.85, clamp(1.0 - lum / max(uMean, 0.02), 0.0, 1.0)) * w * edge * 3.0;
      } else {
        vec3 c = textureLod(map, uv, lod).rgb * uTint; c = max(c - uBlack, 0.0) / (1.0 - uBlack);
        acc += c * w * edge;
      }
    }
    if (uDust == 1) gl_FragColor = vec4(0.045, 0.032, 0.024, 1.0 - exp(-tau));
    else { // identity below 0.8 (the view from Sol is the image); a soft knee above it, where sightlines graze a thin shell
      acc *= uGain; vec3 k = 0.8 + 0.2 * (1.0 - exp(-(acc - 0.8) / 0.2));
      gl_FragColor = vec4(mix(acc, k, step(0.8, acc)), 1.0);
    }
  }`;

/** Mean luminance of an image (for the dust layer's darkness reference). */
function meanLum(img) {
  try {
    const c = document.createElement('canvas'); c.width = c.height = 24;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0, 24, 24);
    const d = g.getImageData(0, 0, 24, 24).data;
    let s = 0;
    for (let i = 0; i < d.length; i += 4) s += (0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]) / 255;
    return s / (d.length / 4);
  } catch { return 0.25; }
}

let glowTex = null;
function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  for (let i = 0; i <= 10; i++) { const r = i / 10; grad.addColorStop(r, `rgba(255,255,255,${Math.exp(-r * r * 9).toFixed(3)})`); }
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}

/**
 * @param scene THREE.Scene; makePoints(rows) → THREE.Points (rows [x, y, z, size, r, g, b]);
 * fetchMembers(name) → members payload or null; imageUrl(key) → URL or null (standalone).
 */
export function createDeepSky3D({ scene, makePoints, fetchMembers, imageUrl }) {
  const loader = new THREE.TextureLoader();
  const nebulae = new Map(); // id → handle

  /** A stack of image slices for one nebula (or a cluster's nebulosity) at `distLy`. */
  function addImageStack(id, spec, distLy, ownerPos) {
    const { img, model } = spec;
    const basis = skyBasis(img.ra, img.dec, img.north);
    const right = sceneVec(basis.right), up = sceneVec(basis.up), normal = new THREE.Vector3().crossVectors(right, up);
    const W = physicalSize(img.fov[0], distLy), H = physicalSize(img.fov[1], distLy);
    const Rly = physicalSize(2 * model.R, distLy) / 2;
    const [cRa, cDec] = model.centre ?? [img.ra, img.dec];
    const uC = planeOffset(basis, cRa, cDec);
    const w = model.w ?? (model.kind === 'blister' ? 0.18 : 0.15);
    const zbox = (model.kind === 'cloud' ? 2 * model.depth : model.depth + 2 * w) * Rly; // half-depth of the volume, ly
    const geo = new THREE.BoxGeometry(W, H, 2 * zbox);
    const uniforms = {
      map: { value: null }, uFov: { value: new THREE.Vector2(img.fov[0], img.fov[1]) }, uC: { value: new THREE.Vector2(uC[0], uC[1]) },
      uSize: { value: new THREE.Vector2(W, H) }, uCam: { value: new THREE.Vector3() }, uRly: { value: Rly }, uZbox: { value: zbox },
      uR: { value: model.R }, uDepth: { value: model.depth }, uW: { value: w }, uBlack: { value: img.black ?? 0.03 }, uPix: { value: 0.001 }, uTexW: { value: 1280 }, uLodBias: { value: img.survey ? 1 : 0 }, // survey star fields: soften stars that would streak
      uGain: { value: 1 }, uMean: { value: 0.25 }, uKind: { value: KINDS[model.kind] ?? 1 }, uDust: { value: 0 }, uTint: { value: new THREE.Vector3(...(img.tint ?? [1, 1, 1])) },
    };
    const group = new THREE.Group();
    group.position.copy(sceneVec(basis.r).multiplyScalar(distLy));
    group.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, normal));
    const glow = new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, side: THREE.BackSide }));
    glow.frustumCulled = false; glow.renderOrder = 1;
    // a dark cloud's image is the star field behind it: draw only its dust (the image still sets its density)
    if (!model.dust) group.add(glow);
    let dust = null;
    if (model.dust) {
      dust = new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms: { ...uniforms, uDust: { value: 1 } }, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, depthTest: false, side: THREE.BackSide }));
      dust.frustumCulled = false; dust.renderOrder = 2;
      group.add(dust);
    }
    group.visible = false;
    scene.add(group);
    group.updateMatrixWorld(true);
    const h = { id, spec, distLy, group, uniforms, state: 'idle', sizeLy: Math.max(W, H), objectLy: 2 * Rly, widthLy: W, heightLy: H, pos: ownerPos ?? group.position.clone() };
    h.load = () => {
      if (h.state !== 'idle') return;
      const url = imageUrl(img.key);
      if (!url) { h.state = 'unavailable'; return; }
      h.state = 'loading';
      loader.load(url, (tex) => {
        tex.colorSpace = THREE.NoColorSpace; // shown as published (no conversion)
        tex.anisotropy = 4;
        uniforms.map.value = tex;
        uniforms.uTexW.value = tex.image?.width ?? 1280;
        if (dust) dust.material.uniforms.uMean.value = meanLum(tex.image);
        if (dust) dust.material.uniforms.map.value = tex;
        group.visible = true; h.state = 'ready'; onChange?.();
      }, undefined, () => { h.state = 'failed'; onChange?.(); });
    };
    nebulae.set(id, h);
    return h;
  }

  // ---- notable stars inside nebulae: clickable into the star card --------------------------
  const starMeta = [];
  function addNebulaStars(distOf) {
    const rows = [];
    for (const [name, neb, ra, dec, note] of NEBULA_STARS) {
      const d = distOf(neb);
      if (!d) continue;
      const v = sceneVec(radecVec(ra, dec)).multiplyScalar(d);
      starMeta.push({ name, nebula: neb, ra, dec, distLy: d, note, pos: v });
      rows.push([v.x, v.y, v.z, 4.5, 0.75, 0.85, 1]);
    }
    const p = makePoints(rows);
    p.renderOrder = 3;
    return p;
  }
  let starPts = null;

  // ---- cluster member swarms -----------------------------------------------------------------
  const swarms = new Map(); // name → { state, points, members: [{ ra, dec, g, plx, ePlx, gaia, distPc, measured }], data, glow }
  let onChange = null;
  async function loadCluster(name, row) {
    if (swarms.has(name)) return swarms.get(name);
    const s = { state: 'loading', name, row };
    swarms.set(name, s);
    const d = await fetchMembers(name);
    if (!d?.rows?.length) { s.state = d ? 'empty' : 'unavailable'; onChange?.(); return s; }
    const av = d.av ?? 0, r50 = d.r50pc ?? row?.[7] ?? 2, cPc = d.distPc ?? row?.[3];
    const rows = [];
    s.members = d.rows.map(([ra, dec, plx, ePlx, g, bpRp, prob, gaia, inTidal = 1]) => {
      const m = memberDistance(cPc, r50, plx, ePlx, gaia);
      const v = sceneVec(radecVec(ra, dec)).multiplyScalar(m.pc * LY_PER_PC);
      const absG = g - 5 * Math.log10(m.pc / 10) - 0.83 * av;
      const t = teffFromBpRp((bpRp ?? 0.8) - 0.43 * av), c = blackbodyRGB(t);
      // brighter stars bigger and whiter; members beyond the tidal radius (corona, tails) fainter
      const k = Math.max(0.15, Math.min(1.1, 1.2 - 0.1 * absG)) * (inTidal ? 1 : 0.4);
      rows.push([v.x, v.y, v.z, Math.max(1.1, Math.min(7, 4.5 - absG * 0.55)) * (inTidal ? 1 : 0.75), c[0] * k, c[1] * k, c[2] * k]);
      return { ra, dec, g, plx, ePlx, prob, gaia, bpRp, distPc: m.pc, measured: m.measured, pos: v };
    });
    s.points = makePoints(rows);
    s.points.renderOrder = 3;
    s.data = d;
    s.measured = s.members.filter((m) => m.measured).length;
    if (d.type === 'g') { // the unresolved light of a globular's dense core (MODELLED glow)
      const c = blackbodyRGB(ageTeff(d.logAge ?? 10));
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: new THREE.Color(c[0], c[1], c[2]), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false }));
      glow.position.copy(sceneVec(radecVec(...centreOf(s.members))).multiplyScalar(cPc * LY_PER_PC));
      glow.scale.setScalar(4 * r50 * LY_PER_PC);
      glow.renderOrder = 1;
      scene.add(glow);
      s.glow = glow;
    }
    s.state = 'ready';
    onChange?.();
    return s;
  }
  function centreOf(members) { // mean direction of the brightest 200
    const v = [0, 0, 0];
    for (const m of members.slice(0, 200)) { const u = radecVec(m.ra, m.dec); v[0] += u[0]; v[1] += u[1]; v[2] += u[2]; }
    const r = Math.hypot(...v);
    return [((Math.atan2(v[1], v[0]) * 180) / Math.PI + 360) % 360, (Math.asin(v[2] / r) * 180) / Math.PI];
  }
  function dropCluster(name) {
    const s = swarms.get(name);
    if (!s || s.state !== 'ready') return;
    scene.remove(s.points); s.points.geometry.dispose(); s.points.material.dispose();
    if (s.glow) { scene.remove(s.glow); s.glow.material.dispose(); }
    swarms.delete(name);
  }

  /** Nearest member star or nebula star to the cursor: a star-card pick (#23) or null. */
  function pick(camera, rect, x, y, radius) {
    let best = null;
    const tryIt = (positions, n, fn) => {
      const hit = pickPoint(positions, n, null, camera, rect, x, y, 8);
      if (hit && (!best || hit.px < best.px)) best = { px: hit.px, ...fn(hit.index) };
    };
    for (const s of swarms.values()) {
      if (s.state !== 'ready' || !s.points.visible) continue;
      tryIt((i) => s.members[i].pos, s.members.length, (i) => {
        const m = s.members[i];
        return { pick: { kind: 'gaia', eq: radecVec(m.ra, m.dec), distLy: (m.plx > 0 && m.plx / m.ePlx > 5 ? 1000 / m.plx : s.data.distPc) * LY_PER_PC, name: `Gaia DR3 ${m.gaia}`, cluster: s.name } };
      });
    }
    if (starPts) tryIt((i) => starMeta[i].pos, starMeta.length, (i) => ({ pick: { kind: 'gaia', eq: radecVec(starMeta[i].ra, starMeta[i].dec), distLy: starMeta[i].distLy, name: starMeta[i].name } }));
    if (best && best.pick.distLy > radius * 1.02) return null;
    return best;
  }

  return {
    nebulae, swarms, starMeta,
    set onChange(fn) { onChange = fn; },
    /** Build every nebula stack (images load lazily); `nebulaDist(name)` gives its distance in ly. */
    init(nebulaRows) {
      for (const [name, , , , ly] of nebulaRows) if (NEBULA_3D[name]) addImageStack(`neb-${name}`, NEBULA_3D[name], ly);
      const dist = new Map(nebulaRows.map((r) => [r[0], r[4]]));
      starPts = addNebulaStars((n) => dist.get(n));
    },
    /** Real nebulosity around clusters (the Pleiades), at the cluster's distance. */
    addClusterNebulosity(rows) {
      for (const r of rows) if (CLUSTER_NEBULOSITY[r[0]] && !nebulae.has(`cl-${r[0]}`)) addImageStack(`cl-${r[0]}`, CLUSTER_NEBULOSITY[r[0]], r[3] * LY_PER_PC);
    },
    loadCluster, dropCluster, pick,
    /** Per frame: the camera in each visible volume's frame (the ray-march starts there). */
    tick(camera, viewportH) {
      const pix = (camera.fov * Math.PI / 180) / Math.max(1, viewportH);
      for (const h of nebulae.values()) {
        if (!h.group.visible) continue;
        h.uniforms.uCam.value.copy(camera.position);
        h.group.worldToLocal(h.uniforms.uCam.value);
        h.uniforms.uPix.value = pix;
      }
    },
    /** Lazy loading: images and member lists of what is large on screen (or selected). */
    update(camera, viewportH, radius, selectedId, clusterRows, clusterPos) {
      const pxPerRad = viewportH / (camera.fov * Math.PI / 180);
      for (const h of nebulae.values()) {
        const d = Math.max(1e-6, camera.position.distanceTo(h.group.position));
        h.px = (h.objectLy / d) * pxPerRad;
        h.group.visible = h.state === 'ready' && h.distLy <= radius * 1.02;
        if (h.state === 'idle' && h.distLy <= radius * 1.02 && (h.px > 10 || h.id === selectedId)) h.load();
      }
      if (starPts) starPts.visible = true;
      // clusters: members of those looking bigger than ~40 px (at most 3 loading at once, 30 kept)
      if (clusterRows) {
        let loading = [...swarms.values()].filter((s) => s.state === 'loading').length;
        const big = [];
        clusterRows.forEach((r, i) => {
          if (r[3] * LY_PER_PC > radius * 1.02 || !(r[7] > 0)) return;
          const d = Math.max(1e-6, camera.position.distanceTo(clusterPos[i]));
          const px = ((r[7] * LY_PER_PC) / d) * pxPerRad;
          if (px > 40 || `cl-${r[0]}` === selectedId) big.push([px, r]);
        });
        big.sort((a, b) => b[0] - a[0]);
        for (const [, r] of big) { if (loading >= 3) break; if (!swarms.has(r[0])) { loading++; loadCluster(r[0], r); } }
        if (swarms.size > 30) {
          const keep = new Set(big.slice(0, 20).map(([, r]) => r[0]));
          for (const name of [...swarms.keys()]) if (!keep.has(name) && `cl-${name}` !== selectedId && swarms.size > 30) dropCluster(name);
        }
        for (const s of swarms.values()) if (s.points) s.points.visible = (s.data.distPc ?? 0) * LY_PER_PC <= radius * 1.02;
      }
    },
  };
}
