// Materials for realistic bodies: spacecraft mosaics for Sol's worlds, individual and generated class skins for
// exoplanets, limb-darkened photospheres for stars. Textures load on demand (backend
// cache, or the standalone snapshot) and swap in over a procedural placeholder.

import * as THREE from 'three';
import { textureUrl } from '../../data/catalog.js';

const loader = new THREE.TextureLoader();
const cache = new Map();

/** Load texture `key` once; resolves to null if it can't be fetched (placeholder stays). */
export function loadTexture(key) {
  if (!key) return Promise.resolve(null);
  if (!cache.has(key)) {
    const url = textureUrl(key);
    cache.set(key, !url ? Promise.resolve(null) : new Promise((resolve) => {
      loader.load(url, (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 8;
        t.wrapS = THREE.RepeatWrapping; // seam-split shape UVs may cross 1.0
        resolve(t);
      }, undefined, () => resolve(null));
    }));
  }
  return cache.get(key);
}

const VERT = /* glsl */`
  #include <common>
  #include <logdepthbuf_pars_vertex>
  varying vec2 vUv; varying vec3 vNormalW; varying vec3 vPosW;
  void main() {
    vUv = uv;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vPosW = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
    #include <logdepthbuf_vertex>
  }`;

// Lambert lighting from the star, a soft terminator, optional night-side emission.
const PLANET_FRAG = /* glsl */`
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform sampler2D uMap; uniform sampler2D uNight; uniform float uHasNight;
  uniform sampler2D uLive; uniform float uHasLive;
  uniform vec3 uTint; uniform vec3 uSunPos; uniform vec3 uSunColor; uniform float uAmbient; uniform float uAlphaFromLuma;
  // Eclipse shadows (#30), in TRUE geometry (km, scene axes, relative to this body's centre) so
  // they are right whatever the display scale: the fraction of the Sun's disc an occluder
  // (the Moon for Earth, Earth for the Moon, a moon for Jupiter…) hides from each point.
  uniform float uOccOn; uniform vec3 uOccRel; uniform float uOccR; uniform vec3 uSunRel; uniform float uSunR;
  uniform float uBodyR; uniform vec3 uCentreW; uniform vec3 uUmbraTint;
  varying vec2 vUv; varying vec3 vNormalW; varying vec3 vPosW;
  float discOverlap(float r1, float r2, float d) { // fraction of disc r1 covered by disc r2 at separation d
    if (d >= r1 + r2) return 0.0;
    if (d <= abs(r1 - r2)) return r2 >= r1 ? 1.0 : (r2 * r2) / (r1 * r1);
    float a1 = r1 * r1 * acos(clamp((d * d + r1 * r1 - r2 * r2) / (2.0 * d * r1), -1.0, 1.0));
    float a2 = r2 * r2 * acos(clamp((d * d + r2 * r2 - r1 * r1) / (2.0 * d * r2), -1.0, 1.0));
    float a3 = 0.5 * sqrt(max(0.0, (-d + r1 + r2) * (d + r1 - r2) * (d - r1 + r2) * (d + r1 + r2)));
    return clamp((a1 + a2 - a3) / (3.14159265 * r1 * r1), 0.0, 1.0);
  }
  void main() {
    #include <logdepthbuf_fragment>
    vec3 N = normalize(vNormalW);
    float ndl = dot(N, normalize(uSunPos - vPosW));
    float lightK = 1.0; float umbraK = 0.0;
    if (uOccOn > 0.5) {
      vec3 p = normalize(vPosW - uCentreW) * uBodyR;
      vec3 toS = uSunRel - p, toO = uOccRel - p;
      if (dot(toS, toO) > 0.0) {
        float ls = length(toS), lo = length(toO);
        float rs = asin(min(1.0, uSunR / ls)), ro = asin(min(1.0, uOccR / lo));
        float d = atan(length(cross(toS, toO)), dot(toS, toO));
        float f = discOverlap(rs, ro, d);
        lightK = 1.0 - f;
        umbraK = smoothstep(0.9, 1.0, f);
      }
    }
    vec4 tex = texture2D(uMap, vUv);
    vec3 base = tex.rgb * uTint;
    if (uHasLive > 0.5) { // today's imagery where it exists; the base map fills swath gaps and polar night
      vec3 lv = texture2D(uLive, vUv).rgb;
      base = mix(base, lv, smoothstep(0.015, 0.06, max(lv.r, max(lv.g, lv.b))));
    }
    // in an atmosphere's umbra (a lunar eclipse) sunlight bent through Earth's air lights the disc red
    vec3 col = base * (uAmbient + max(ndl, 0.0) * (uSunColor * lightK + uUmbraTint * umbraK));
    if (uHasNight > 0.5) {
      float night = 1.0 - smoothstep(-0.12, 0.08, ndl);
      col += texture2D(uNight, vUv).rgb * night * 1.4;
    }
    float a = uAlphaFromLuma > 0.5 ? clamp(dot(tex.rgb, vec3(0.333)) * 1.3, 0.0, 1.0) : 1.0;
    gl_FragColor = vec4(col, a);
    #include <colorspace_fragment>
  }`;

// Photosphere: quadratic limb darkening; other stars use independent procedural illustrations.
const STAR_FRAG = /* glsl */`
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform sampler2D uMap; uniform vec3 uColor; uniform float uRecolour;
  uniform sampler2D uDisk; uniform float uHasDisk; uniform vec3 uEarthDir; uniform vec3 uNorth; uniform float uDiskR;
  varying vec2 vUv; varying vec3 vNormalW; varying vec3 vPosW;
  void main() {
    #include <logdepthbuf_fragment>
    vec3 N = normalize(vNormalW);
    float mu = clamp(dot(N, normalize(cameraPosition - vPosW)), 0.0, 1.0);
    float limb = 1.0 - 0.55 * (1.0 - mu) - 0.25 * (1.0 - mu) * (1.0 - mu);
    vec3 tex = texture2D(uMap, vUv).rgb;
    vec3 c = (uRecolour > 0.5 ? dot(tex, vec3(0.299, 0.587, 0.114)) * 2.2 * uColor : tex * 1.25) * limb * 1.35;
    if (uHasDisk > 0.5) {
      // The live full-disk image (solar north up, as seen from Earth) projected onto the Earth-facing hemisphere.
      float facing = dot(N, uEarthDir);
      vec3 up = normalize(uNorth - uEarthDir * dot(uNorth, uEarthDir));
      vec3 right = normalize(cross(-uEarthDir, up));
      vec2 uvd = vec2(0.5 + dot(N, right) * uDiskR, 0.5 + dot(N, up) * uDiskR);
      // HMI continuum is a brightness image: give the disk and the stand-in far side one colour,
      // so the Sun reads as one star (limb darkening is already in the live image)
      vec3 warm = uColor * 1.9;
      vec3 live = dot(texture2D(uDisk, uvd).rgb, vec3(0.299, 0.587, 0.114)) * warm * 1.1;
      vec3 far = dot(tex, vec3(0.299, 0.587, 0.114)) * warm * limb * 1.6;
      c = mix(far, live, smoothstep(0.08, 0.3, facing));
    }
    gl_FragColor = vec4(c, 1.0);
    #include <colorspace_fragment>
  }`;

const linear = (hexOrArray) => new THREE.Color(hexOrArray).convertSRGBToLinear();

export function planetMaterial(placeholder, { tint = [1, 1, 1], ambient = 0.035 } = {}) {
  return new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: PLANET_FRAG,
    uniforms: {
      uMap: { value: placeholder }, uNight: { value: null }, uHasNight: { value: 0 }, uLive: { value: null }, uHasLive: { value: 0 },
      uTint: { value: new THREE.Color(...tint) }, uSunPos: { value: new THREE.Vector3() },
      uSunColor: { value: new THREE.Color(1.3, 1.3, 1.3) }, uAmbient: { value: ambient }, uAlphaFromLuma: { value: 0 },
      uOccOn: { value: 0 }, uOccRel: { value: new THREE.Vector3() }, uOccR: { value: 1 }, uSunRel: { value: new THREE.Vector3() }, uSunR: { value: 696000 },
      uBodyR: { value: 1 }, uCentreW: { value: new THREE.Vector3() }, uUmbraTint: { value: new THREE.Color(0, 0, 0) },
    },
  });
}

export function cloudMaterial(placeholder) {
  const m = planetMaterial(placeholder, { ambient: 0.0 });
  m.uniforms.uAlphaFromLuma.value = 1;
  m.transparent = true;
  m.depthWrite = false;
  return m;
}

export function starMaterial(placeholder, color, recolour) {
  return new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: STAR_FRAG,
    uniforms: { uMap: { value: placeholder }, uColor: { value: linear(color) }, uRecolour: { value: recolour ? 1 : 0 },
      uDisk: { value: null }, uHasDisk: { value: 0 }, uEarthDir: { value: new THREE.Vector3(0, 0, 1) }, uNorth: { value: new THREE.Vector3(0, 1, 0) }, uDiskR: { value: 0.39 } },
  });
}

/** Swap a material's map (and optional night map) in when the textures arrive. */
export function applySkin(material, skin) {
  if (!skin) return;
  loadTexture(skin.map).then((t) => { if (t) material.uniforms.uMap.value = t; });
  if (skin.night) {
    loadTexture(skin.night).then((t) => {
      if (!t) return;
      material.uniforms.uNight.value = t;
      material.uniforms.uHasNight.value = 1;
    });
  }
}

// ---- live skins (#17): today's imagery from the backend's feed cache ----------------------------
const live = new Map(); // feed id → Promise<{ texture, time, credit, disk } | null>
export const liveInfo = new Map(); // feed id → { time, credit } once loaded

/** Load live feed `id` as a texture (null in the standalone preview or if unavailable). */
export function loadLive(id, maxAgeMs = 15 * 60000) {
  const c = live.get(id);
  if (c && Date.now() - c.at < maxAgeMs) return c.p;
  const p = (import.meta.env?.MODE === 'standalone' ? Promise.resolve(null) : fetch(`/api/feed/${id}`).then(async (r) => {
    if (!r.ok) return null;
    const url = URL.createObjectURL(await r.blob());
    const meta = { time: r.headers.get('x-feed-time'), credit: decodeURIComponent(r.headers.get('x-feed-credit') || ''), disk: Number(r.headers.get('x-feed-disk')) || null };
    const texture = await new Promise((res) => loader.load(url, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; res(t); }, undefined, () => res(null)));
    if (!texture) return null;
    liveInfo.set(id, meta);
    return { texture, ...meta };
  }).catch(() => null));
  live.set(id, { p, at: Date.now() });
  return p;
}

/** Apply a body's live skin (Earth: daily global mosaic; Sun: full-disk image) if enabled. */
export function applyLiveSkin(material, skin, enabled) {
  if (!skin?.live) return Promise.resolve(null);
  if (!enabled) { material.uniforms.uHasLive && (material.uniforms.uHasLive.value = 0); material.uniforms.uHasDisk && (material.uniforms.uHasDisk.value = 0); return Promise.resolve(null); }
  return loadLive(skin.live, skin.liveDisk ? 15 * 60000 : 6 * 3600000).then((l) => {
    if (!l) return null;
    if (skin.liveDisk) {
      material.uniforms.uDisk.value = l.texture;
      material.uniforms.uHasDisk.value = 1;
      if (l.disk) material.uniforms.uDiskR.value = l.disk;
    } else {
      material.uniforms.uLive.value = l.texture;
      material.uniforms.uHasLive.value = 1;
    }
    return l;
  });
}
