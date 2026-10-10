// Materials for realistic bodies: spacecraft mosaics for Sol's worlds, individual and generated class skins for
// exoplanets, limb-darkened photospheres for stars. Textures load on demand (backend
// cache, or the standalone snapshot) and swap in over a procedural placeholder.

import * as THREE from 'three';
import { textureUrl } from '../../data/catalog.js';
import { bakedFeed } from '../../data/bandbake.js';

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
  // Earth through time (#54): sea level (m) against ETOPO1 (R elevation, G flood level from the open ocean,
  // B open ocean today; ±400 m in 0–1), PaleoMIST ice-sheet masks blended between two time slices, or a
  // reconstructed land mask (GPlates coastlines) in place of today's continents.
  uniform float uPaleo; uniform sampler2D uElev; uniform float uSea; uniform sampler2D uIceA; uniform sampler2D uIceB; uniform float uIceMix; uniform float uIceOn;
  uniform sampler2D uLand; uniform float uLandOn;
  uniform vec3 uTint; uniform vec3 uSunPos; uniform vec3 uSunColor; uniform float uAmbient; uniform float uAlphaFromLuma;
  // Eclipse shadows (#30), in TRUE geometry (km, scene axes, relative to this body's centre) so
  // they are right whatever the display scale: the fraction of the Sun's disc an occluder
  // (the Moon for Earth, Earth for the Moon, a moon for Jupiter…) hides from each point.
  uniform float uOccOn; uniform vec3 uOccRel; uniform float uOccR; uniform vec3 uSunRel; uniform float uSunR;
  uniform float uBodyR; uniform vec3 uCentreW; uniform vec3 uUmbraTint;
  // Planetshine (#49): the parent planet's reflected light on a moon's night side (colour × display exposure)
  uniform vec3 uPsPos; uniform vec3 uPsCol;
  // The spectrum filter (#28): 0 normal; 1 real band map; 2 predicted reflected; 3 predicted thermal;
  // 4 not observed; 5 modelled high-energy glow. Non-visible bands are false colour (palette).
  uniform float uBandMode; uniform sampler2D uBandTex; uniform vec2 uBandLevels; uniform float uBandGain; uniform float uPalette;
  uniform vec4 uThermal; uniform float uBandUm; uniform float uGlow; uniform vec3 uPoleW; uniform float uBandLit;
  // 6: a transmission curve (#66): weights uMix (real map, reflected, thermal, glow), each with its
  // palette (uMixPal) or, in a three-band composite, its hue (uMixHue column, w = 1). uBandTexPrev and
  // uBandFade cross-fade a band map's preview into its full resolution (#62).
  uniform vec4 uMix; uniform vec4 uMixPal; uniform mat4 uMixHue; uniform float uGlowGain;
  uniform sampler2D uBandTexPrev; uniform float uBandFade;
  varying vec2 vUv; varying vec3 vNormalW; varying vec3 vPosW;
  vec3 pal(float t, float p) {
    t = clamp(t, 0.0, 1.0);
    vec3 a = vec3(0.0), b, c, d = vec3(1.0);
    if (p < 1.5) { b = vec3(0.45, 0.0, 0.0); c = vec3(1.0, 0.55, 0.0); d = vec3(1.0, 1.0, 0.85); }
    else if (p < 2.5) { b = vec3(0.0, 0.05, 0.35); c = vec3(0.0, 0.7, 0.9); d = vec3(0.9, 1.0, 1.0); }
    else if (p < 3.5) { b = vec3(0.3, 0.0, 0.45); c = vec3(0.95, 0.25, 0.1); d = vec3(1.0, 0.95, 0.45); }
    else if (p < 4.5) { b = vec3(0.33); c = vec3(0.66); }
    else if (p < 5.5) { b = vec3(0.15, 0.0, 0.4); c = vec3(0.55, 0.3, 1.0); d = vec3(0.92, 0.88, 1.0); }
    else if (p < 6.5) { b = vec3(0.0, 0.2, 0.3); c = vec3(0.2, 0.75, 0.85); d = vec3(0.9, 1.0, 1.0); }
    else { b = vec3(0.35, 0.0, 0.35); c = vec3(1.0, 0.3, 0.8); d = vec3(1.0, 0.9, 1.0); }
    return t < 0.333 ? mix(a, b, t * 3.0) : t < 0.666 ? mix(b, c, (t - 0.333) * 3.0) : mix(c, d, (t - 0.666) * 3.0);
  }
  vec3 colz(float x, float p, vec4 hue) { return hue.w > 0.5 ? clamp(x, 0.0, 1.0) * hue.rgb : pal(x, p); }
  vec4 bandSample() { vec4 c = texture2D(uBandTex, vUv); return uBandFade < 0.999 ? mix(texture2D(uBandTexPrev, vUv), c, uBandFade) : c; }
  float planckRel(float um, float T, float Tref) { // B_λ(T) / B_λ(Tref)
    float x = min(14387.77 / (um * max(T, 1.0)), 80.0), xr = min(14387.77 / (um * max(Tref, 1.0)), 80.0);
    return (exp(xr) - 1.0) / (exp(x) - 1.0);
  }
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
    if (uPaleo > 0.5) {
      vec3 seaCol = vec3(0.012, 0.035, 0.09), shelfCol = vec3(0.31, 0.29, 0.2), iceCol = vec3(0.86, 0.9, 0.95);
      if (uLandOn > 0.5) base = mix(seaCol, vec3(0.34, 0.32, 0.21), step(0.5, texture2D(uLand, vUv).r));
      else {
        vec3 el = texture2D(uElev, vUv).rgb;
        float e = el.r * 800.0 - 400.0, spill = el.g * 800.0 - 400.0;
        if (el.b > 0.5) { if (e > uSea) base = shelfCol; }      // today's sea floor, exposed when the sea falls
        else if (spill < uSea) base = seaCol;                   // land the rising sea reaches
      }
      if (uIceOn > 0.5) base = mix(base, iceCol, mix(texture2D(uIceA, vUv).r, texture2D(uIceB, vUv).r, uIceMix));
    }
    if (uBandMode > 0.5) {
      float lit = max(ndl, 0.0) * lightK;
      float dayK = uAmbient + lit * 1.3;
      // thermal model (also the fallback where a real map has no data)
      float T = uThermal.w > 0.5 ? (ndl > 0.0 ? max(uThermal.y, uThermal.x * pow(max(ndl, 0.0), 0.25)) : uThermal.y) : uThermal.z * (1.0 + 0.04 * (max(ndl, 0.0) - 0.5));
      // false-colour scale: full brightness at 1.3× the body's hottest modelled temperature
      vec3 thermal = pal(pow(clamp(planckRel(uBandUm, T, 1.3 * max(uThermal.x, uThermal.z)), 0.0, 1.0), 0.35), uPalette);
      vec3 bc;
      if (uBandMode > 5.5) {
        vec3 acc = vec3(0.0); float ws = 0.0;
        if (uMix.x > 0.0) {
          vec4 t = bandSample();
          float l = pow(clamp((dot(t.rgb, vec3(0.333)) - uBandLevels.x) * uBandLevels.y, 0.0, 1.0), 1.4);
          vec3 rc = uMixPal.x < 0.5 && uMixHue[0].w < 0.5 ? t.rgb : colz(l * 0.92, uMixPal.x, uMixHue[0]);
          if (uBandLit > 0.5) rc *= dayK;
          acc += uMix.x * t.a * rc; ws += uMix.x * t.a; // gaps in a partial map: the predicted parts fill in
        }
        if (uMix.y > 0.0) { acc += uMix.y * colz(clamp(dot(base, vec3(0.299, 0.587, 0.114)) * uBandGain * dayK * 1.4, 0.0, 1.0), uMixPal.y, uMixHue[1]); ws += uMix.y; }
        if (uMix.z > 0.0) { acc += uMix.z * colz(pow(clamp(planckRel(uBandUm, T, 1.3 * max(uThermal.x, uThermal.z)), 0.0, 1.0), 0.35), uMixPal.z, uMixHue[2]); ws += uMix.z; }
        if (uMix.w > 0.0) {
          vec3 V = normalize(cameraPosition - vPosW);
          float g = uGlow < 1.5 ? 0.5 : uGlow < 2.5 ? lit : uGlow < 3.5 ? smoothstep(0.8, 0.96, abs(dot(N, uPoleW))) : pow(1.0 - abs(dot(N, V)), 4.0);
          acc += uMix.w * colz(g * uGlowGain, uMixPal.w, uMixHue[3]); ws += uMix.w;
        }
        bc = ws > 0.0 ? acc / ws : vec3(0.012) + base * 0.012;
      } else if (uBandMode < 1.5) {
        vec4 t = bandSample();
        float l = pow(clamp((dot(t.rgb, vec3(0.333)) - uBandLevels.x) * uBandLevels.y, 0.0, 1.0), 1.4);
        // a thermal map of an airless body is a daytime mosaic: the night side is far colder now
        if (uBandLit < 0.5 && uThermal.w > 0.5) l *= mix(0.2, 1.0, pow(clamp(planckRel(uBandUm, T, uThermal.x), 0.0, 1.0), 0.35)); // vs its own day side
        bc = uPalette < 0.5 ? t.rgb : pal(l * 0.92, uPalette);
        if (uBandLit > 0.5) bc *= dayK;
        bc = mix(vec3(dot(uThermal.w + uThermal.z > 0.0 ? thermal : bc, vec3(0.333))) * 0.3, bc, t.a); // gaps in partial maps: dim grey, so they read as no data
      } else if (uBandMode < 2.5) {
        bc = pal(clamp(dot(base, vec3(0.299, 0.587, 0.114)) * uBandGain * dayK * 1.4, 0.0, 1.0), uPalette);
      } else if (uBandMode < 3.5) {
        bc = thermal * uBandGain;
      } else if (uBandMode < 4.5) {
        bc = vec3(0.012) + base * 0.012;
      } else {
        vec3 V = normalize(cameraPosition - vPosW);
        float g = uGlow < 1.5 ? 0.5 : uGlow < 2.5 ? lit : uGlow < 3.5 ? smoothstep(0.8, 0.96, abs(dot(N, uPoleW))) : pow(1.0 - abs(dot(N, V)), 4.0);
        float pz = abs(dot(N, uPoleW));
        if (uGlow > 4.5 && uGlow < 5.5) g = 0.16 * lit + smoothstep(0.86, 0.91, pz) * (1.0 - smoothstep(0.94, 0.985, pz)); // auroral ovals ~15–25° from the poles over a faint disc (#61)
        else if (uGlow > 5.5 && uGlow < 6.5) { // volcanic hot spots: a sketch, scattered over a cold disc (Io, #61)
          vec2 cell = vUv * vec2(40.0, 20.0), cid = floor(cell);
          float h = fract(sin(dot(cid, vec2(12.9898, 78.233))) * 43758.5453);
          g = 0.05 + 0.08 * lit + step(0.9, h) * smoothstep(0.42, 0.0, length(fract(cell) - 0.5)) * (0.4 + 0.6 * fract(h * 37.0));
        } else if (uGlow > 6.5) { // Venus near-IR: sunlit cloud tops by day; heat through the windows by night, clouds in silhouette (#61)
          vec2 q = vUv * vec2(9.0, 6.0);
          float m = 0.5 + 0.25 * sin(q.x * 3.1 + sin(q.y * 2.3) * 2.0) + 0.25 * sin(q.y * 4.7 + sin(q.x * 1.7) * 3.0);
          g = lit * 0.85 + (1.0 - smoothstep(-0.05, 0.12, ndl)) * 0.45 * m;
        }
        bc = pal(g * uBandGain, uPalette);
      }
      gl_FragColor = vec4(bc, uAlphaFromLuma > 0.5 ? 0.0 : 1.0);
      #include <colorspace_fragment>
      return;
    }
    // in an atmosphere's umbra (a lunar eclipse) sunlight bent through Earth's air lights the disc red
    vec3 col = base * (uAmbient + max(ndl, 0.0) * (uSunColor * lightK + uUmbraTint * umbraK));
    if (uPsCol.r + uPsCol.g + uPsCol.b > 0.0) col += base * uPsCol * max(dot(N, normalize(uPsPos - vPosW)), 0.0) * (1.0 - smoothstep(-0.05, 0.2, ndl * lightK));
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
  uniform vec3 uBandTint; uniform float uBandDisk; // spectrum filter (#28): tint, and 1 when uDisk is a band image shown as-is
  uniform float uBandMix; // its weight over the tinted photosphere (a custom curve that the map covers only in part; 1 otherwise)
  varying vec2 vUv; varying vec3 vNormalW; varying vec3 vPosW;
  void main() {
    #include <logdepthbuf_fragment>
    vec3 N = normalize(vNormalW);
    float mu = clamp(dot(N, normalize(cameraPosition - vPosW)), 0.0, 1.0);
    float limb = 1.0 - 0.55 * (1.0 - mu) - 0.25 * (1.0 - mu) * (1.0 - mu);
    vec3 tex = texture2D(uMap, vUv).rgb;
    vec3 c = (uRecolour > 0.5 ? dot(tex, vec3(0.299, 0.587, 0.114)) * 2.2 * uColor : tex * 1.25) * limb * 1.35;
    vec3 under = c * uBandTint; // the predicted look under a partly weighted band map
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
      if (uBandDisk > 0.5) { // SDO (or NoRH, SRH, a modelled radio disc) in its own colours, weighted over the predicted look
        c = mix(under, mix(c * 0.15, texture2D(uDisk, uvd).rgb * 1.2, smoothstep(0.08, 0.3, facing)), uBandMix);
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
        return;
      }
    }
    c *= uBandTint;
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
      uPsPos: { value: new THREE.Vector3() }, uPsCol: { value: new THREE.Color(0, 0, 0) },
      uBandMode: { value: 0 }, uBandTex: { value: null }, uBandLevels: { value: new THREE.Vector2(0, 1) }, uBandGain: { value: 1 }, uPalette: { value: 4 },
      uThermal: { value: new THREE.Vector4(0, 0, 0, 0) }, uBandUm: { value: 10 }, uGlow: { value: 0 }, uPoleW: { value: new THREE.Vector3(0, 1, 0) }, uBandLit: { value: 1 },
      uMix: { value: new THREE.Vector4(0, 0, 0, 0) }, uMixPal: { value: new THREE.Vector4(4, 4, 4, 4) }, uMixHue: { value: new THREE.Matrix4().multiplyScalar(0) }, uGlowGain: { value: 1 },
      uBandTexPrev: { value: null }, uBandFade: { value: 1 },
      uPaleo: { value: 0 }, uElev: { value: null }, uSea: { value: 0 }, uIceA: { value: null }, uIceB: { value: null }, uIceMix: { value: 0 }, uIceOn: { value: 0 }, uLand: { value: null }, uLandOn: { value: 0 },
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
      uDisk: { value: null }, uHasDisk: { value: 0 }, uEarthDir: { value: new THREE.Vector3(0, 0, 1) }, uNorth: { value: new THREE.Vector3(0, 1, 0) }, uDiskR: { value: 0.39 },
      uBandTint: { value: new THREE.Color(1, 1, 1) }, uBandDisk: { value: 0 }, uBandMix: { value: 1 } },
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
  const p = (import.meta.env?.MODE === 'standalone' ? loadBakedFeed(id) : fetch(`/api/feed/${id}`).then(async (r) => {
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

/** The standalone preview: a feed's baked copy (src/data/bandbake.js, #28), with its real date and size; null if none was baked. */
function loadBakedFeed(id) {
  const b = bakedFeed(id);
  if (!b) return Promise.resolve(null);
  return new Promise((res) => loader.load(b.src, (t) => { t.colorSpace = THREE.SRGBColorSpace; res(t); }, undefined, () => res(null))).then((texture) => {
    if (!texture) return null;
    const meta = { time: b.time ?? null, credit: b.credit ?? '', disk: b.disk ?? null, baked: b };
    liveInfo.set(id, meta);
    return { texture, ...meta };
  });
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
