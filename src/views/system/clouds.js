// Clouds and ground (#83): Venus and Earth get a cloud shell at its height above a ground you can descend to.
//  · Venus: an opaque deck at 70 km (the cloud-top map, super-rotating westward every ~4 days) over the
//    Magellan radar ground on the DEM, coloured after the Venera 13/14 lander images (MODELLED).
//  · Earth: today's GIBS clouds (picked out of the true-colour mosaic by their whiteness; the 2004 Blue Marble
//    clouds without live imagery) on a shell at an ASSUMED 10 km, casting shadows on the ground.
//  · The look of each layer from inside the surface view (sky, light, murk, fog) comes from `layerLook`
//    (pure); the murk is a full-screen veil drawn over the scene (so postcards keep it).
// The atmosphere tables and the descent state machine are in src/astro/atmosphere.js.

import * as THREE from 'three';
import { cloudLayer, murk, lightFraction, sunVisible, extinctionPerKm, layerAt, atmosphereAt } from '../../astro/atmosphere.js';
import { DAY_SKY, daylight } from './surface.js';

const J2000 = 2451545.0;

/** Rotation (rad about the mesh's y) of a cloud deck against its ground at `jd`: Venus' westward super-rotation. */
export function superRotation(layer, jd) {
  if (!layer?.superRotationDays) return 0;
  const turns = ((jd - J2000) / layer.superRotationDays) % 1;
  return -2 * Math.PI * turns; // westward: features slide to decreasing longitude (u) over the ground
}

/** Whiteness (0…1) of an sRGB colour (0…255): the GPU's cloud mask, for the CPU read-outs. */
export function whiteness(r, g, b) {
  const lin = (c) => (c / 255) ** 2.2;
  const R = lin(r), G = lin(g), B = lin(b), lo = Math.min(R, G, B), hi = Math.max(R, G, B);
  const s = (a, z, x) => { const t = Math.max(0, Math.min(1, (x - a) / (z - a))); return t * t * (3 - 2 * t); };
  return s(0.2, 0.55, lo) * (1 - s(0.12, 0.3, hi - lo));
}

const coverCache = new WeakMap(); // image → { data, w, h }
/** Cloud cover (0…1) at texture coordinates (u, v; v = 0 south) of a cloud map: brightness (mode 1) or whiteness (mode 2). */
export function cloudCoverAt(texture, u, v, mode) {
  const img = texture?.image;
  if (!img || !mode || typeof document === 'undefined') return 0;
  let c = coverCache.get(img);
  if (!c) {
    try {
      const w = 512, h = 256, cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      const ctx = cv.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, w, h);
      c = { data: ctx.getImageData(0, 0, w, h).data, w, h };
    } catch { c = { data: null }; }
    coverCache.set(img, c);
  }
  if (!c.data) return 0;
  // average a few texels around the spot (~10 km at Earth)
  let sum = 0, n = 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const x = ((Math.floor((((u % 1) + 1) % 1) * c.w) + dx) % c.w + c.w) % c.w;
    const y = Math.max(0, Math.min(c.h - 1, Math.floor((1 - v) * c.h) + dy));
    const k = (y * c.w + x) * 4, r = c.data[k], g = c.data[k + 1], b = c.data[k + 2];
    sum += mode > 1.5 ? whiteness(r, g, b) : Math.min(1, ((r + g + b) / 765) * 1.3);
    n++;
  }
  return sum / n;
}

// sky colours (linear RGB at full daylight) from inside each layer
const VENUS_ABOVE = [0.32, 0.3, 0.26]; // over the deck: thin haze lit from below by the bright clouds
const VENUS_MURK_TOP = [0.95, 0.88, 0.7], VENUS_MURK_BASE = [0.5, 0.35, 0.18];
const EARTH_MURK = [0.78, 0.8, 0.83];
const ORANGE = [1.0, 0.56, 0.24]; // light under Venus' clouds: the blue is scattered and absorbed on the way down (Venera 13/14)

/**
 * The look from `altKm` above the body's reference (layers' heights) and `aboveGroundKm` over the ground, with
 * daylight `day` (0…1) and cloud `cover` over the spot (Earth). Returns sky colour (linear, × day), whether the
 * Sun and the other bodies can be seen, star fade, lighting for the ground (sun colour scale, sky ambient), fog
 * extinction (per km) and colour, the murk veil and the share of the light that gets here.
 */
export function layerLook(id, altKm, { day = 1, cover = 1 } = {}) {
  const L = cloudLayer(id);
  if (!L) return null;
  const where = layerAt(id, altKm), light = lightFraction(id, altKm), sun = sunVisible(id, altKm);
  const m = murk(id, altKm, cover), beta = extinctionPerKm(id, altKm);
  const mix = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t);
  if (id === 'venus') {
    // the display exposure adapts (as an eye would) but not fully: the gloom stays a gloom
    const expo = Math.pow(light, 0.25);
    const sky = where === 'above' ? VENUS_ABOVE.map((x) => x * day) : DAY_SKY.venus.rgb.map((x) => x * Math.max(0.15, day) * expo * 1.1);
    const t = Math.max(0, Math.min(1, (L.topKm - altKm) / (L.topKm - L.lowerHazeKm)));
    const murkRgb = mix(VENUS_MURK_TOP, VENUS_MURK_BASE, t).map((x) => x * Math.max(0.15, day) * (0.35 + 0.65 * expo));
    return {
      where, light, sunVisible: sun, bodiesVisible: sun, starFade: sun ? null : 0, sky,
      sunScale: sun ? 1 : 0.3 * expo, sunTint: sun ? [1, 1, 1] : ORANGE,
      skyAmb: sun ? [0, 0, 0] : ORANGE.map((x) => x * 0.85 * expo * Math.max(0.15, day)),
      fogK: where === 'above' ? 0 : beta, fogRgb: sky, murk: m, murkRgb, hideShell: where === 'below',
    };
  }
  // Earth: a thin shell; above it the sky darkens (less air overhead), below it the usual blue
  const air = DAY_SKY.earth.rgb, k = where === 'above' ? 0.55 : 1;
  return {
    where, light, sunVisible: true, bodiesVisible: true, starFade: null, sky: air.map((x) => x * k * day * 0.9),
    sunScale: 1, sunTint: [1, 1, 1], skyAmb: [0, 0, 0], fogK: beta, fogRgb: air.map((x) => x * day * 0.9),
    murk: m, murkRgb: EARTH_MURK.map((x) => x * Math.max(0.05, day)), hideShell: false,
  };
}

/**
 * The helm under an opaque deck (#42, #83): the surface view's look for a ship `altKm` above the body's reference
 * radius with the Sun `sunAltDeg` above its local horizon, or null where the deck is not overhead (above it, or a
 * body whose clouds do not hide the sky). Same light, sky, murk and fog as standing there.
 */
export function helmLayerLook(id, altKm, sunAltDeg) {
  const L = cloudLayer(id);
  if (!L || layerAt(id, altKm) === 'above') return null;
  const look = layerLook(id, altKm, { day: daylight(sunAltDeg), cover: 1 });
  return look && !look.sunVisible ? look : null; // Earth's thin shell leaves the Sun and the sky in view
}

/** A full-screen veil (clip-space quad) for the murk inside a cloud deck. */
export function createMurkVeil(scene) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color() }, uAlpha: { value: 0 } },
    vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: 'uniform vec3 uColor; uniform float uAlpha; void main() { gl_FragColor = vec4(uColor, uAlpha); \n#include <colorspace_fragment>\n }',
    transparent: true, depthTest: false, depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 10000;
  mesh.visible = false;
  scene.add(mesh);
  return {
    set(alpha, rgb) {
      mesh.visible = alpha > 0.003;
      mat.uniforms.uAlpha.value = alpha;
      if (rgb) mat.uniforms.uColor.value.setRGB(rgb[0], rgb[1], rgb[2], THREE.LinearSRGBColorSpace);
    },
    hide() { mesh.visible = false; },
  };
}

/** The read-out values for the HUD at `altKm` above the reference: atmosphere (with its source) and the layer. */
export function layerReadout(id, altKm, aboveGroundKm) {
  const L = cloudLayer(id), a = atmosphereAt(id, altKm);
  if (!L || !a) return null;
  return { layer: L, where: layerAt(id, altKm), altKm, aboveGroundKm, ...a, light: lightFraction(id, altKm) };
}
