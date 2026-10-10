// Materials for realistic bodies: spacecraft mosaics for Sol's worlds, analog skins for
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
  uniform vec3 uTint; uniform vec3 uSunPos; uniform vec3 uSunColor; uniform float uAmbient; uniform float uAlphaFromLuma;
  varying vec2 vUv; varying vec3 vNormalW; varying vec3 vPosW;
  void main() {
    #include <logdepthbuf_fragment>
    vec3 N = normalize(vNormalW);
    float ndl = dot(N, normalize(uSunPos - vPosW));
    vec4 tex = texture2D(uMap, vUv);
    vec3 base = tex.rgb * uTint;
    vec3 col = base * (uAmbient + max(ndl, 0.0) * uSunColor);
    if (uHasNight > 0.5) {
      float night = 1.0 - smoothstep(-0.12, 0.08, ndl);
      col += texture2D(uNight, vUv).rgb * night * 1.4;
    }
    float a = uAlphaFromLuma > 0.5 ? clamp(dot(tex.rgb, vec3(0.333)) * 1.3, 0.0, 1.0) : 1.0;
    gl_FragColor = vec4(col, a);
    #include <colorspace_fragment>
  }`;

// Photosphere: quadratic limb darkening; other stars reuse the Sun's granulation recoloured.
const STAR_FRAG = /* glsl */`
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform sampler2D uMap; uniform vec3 uColor; uniform float uRecolour;
  varying vec2 vUv; varying vec3 vNormalW; varying vec3 vPosW;
  void main() {
    #include <logdepthbuf_fragment>
    float mu = clamp(dot(normalize(vNormalW), normalize(cameraPosition - vPosW)), 0.0, 1.0);
    float limb = 1.0 - 0.55 * (1.0 - mu) - 0.25 * (1.0 - mu) * (1.0 - mu);
    vec3 tex = texture2D(uMap, vUv).rgb;
    vec3 c = uRecolour > 0.5 ? dot(tex, vec3(0.299, 0.587, 0.114)) * 2.2 * uColor : tex * 1.25;
    gl_FragColor = vec4(c * limb * 1.35, 1.0);
    #include <colorspace_fragment>
  }`;

const linear = (hexOrArray) => new THREE.Color(hexOrArray).convertSRGBToLinear();

export function planetMaterial(placeholder, { tint = [1, 1, 1], ambient = 0.035 } = {}) {
  return new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: PLANET_FRAG,
    uniforms: {
      uMap: { value: placeholder }, uNight: { value: null }, uHasNight: { value: 0 },
      uTint: { value: new THREE.Color(...tint) }, uSunPos: { value: new THREE.Vector3() },
      uSunColor: { value: new THREE.Color(1.3, 1.3, 1.3) }, uAmbient: { value: ambient }, uAlphaFromLuma: { value: 0 },
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
    uniforms: { uMap: { value: placeholder }, uColor: { value: linear(color) }, uRecolour: { value: recolour ? 1 : 0 } },
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
