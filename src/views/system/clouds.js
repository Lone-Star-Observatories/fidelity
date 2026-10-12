// Clouds and ground (#83): Venus and Earth get a cloud shell at its height above a ground you can descend to.
//  · Venus: an opaque deck at 70 km (the cloud-top map, super-rotating westward every ~4 days) over the
//    Magellan radar ground on the DEM, coloured after the Venera 13/14 lander images (MODELLED).
//  · Earth: today's GIBS clouds (picked out of the true-colour mosaic by their whiteness; the 2004 Blue Marble
//    clouds without live imagery) on a shell at an ASSUMED 10 km, casting shadows on the ground.
//  · The look of each layer from inside the surface view (sky, light, murk, fog) comes from `layerLook`
//    (pure); the murk is a full-screen veil drawn over the scene (so postcards keep it).
// The atmosphere tables and the descent state machine are in src/astro/atmosphere.js.

import * as THREE from 'three';
import { cloudLayer, cloudColumn, murk, lightFraction, sunVisible, extinctionPerKm, layerAt, atmosphereAt } from '../../astro/atmosphere.js';
import { DAY_SKY } from './surface.js';
import { demNow } from '../../data/dem.js';
import { sampleDem } from '../../astro/dem.js';

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
export function layerLook(id, altKm, { day = 1, cover = 1, col = null } = {}) {
  const L = cloudLayer(id);
  if (!L) return null;
  const where = layerAt(id, altKm, col), light = lightFraction(id, altKm), sun = sunVisible(id, altKm);
  const m = murk(id, altKm, cover, col), beta = extinctionPerKm(id, altKm);
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
export function layerReadout(id, altKm, aboveGroundKm, col = null) {
  const L = cloudLayer(id), a = atmosphereAt(id, altKm);
  if (!L || !a) return null;
  return { layer: L, col: col ?? cloudColumn(id), where: layerAt(id, altKm, col), altKm, aboveGroundKm, ...a, light: lightFraction(id, altKm) };
}

// ---- Earth's cloud volume (#83) -----------------------------------------------------------------
// The shell is drawn as stacked slices (CLOUD_LAYERS.earth.slicesKm), children of the outer shell sharing its
// uniforms; each fragment draws if its column of cloud (from its base to its top) reaches the slice, with the
// column's opacity split between the slices it fills (sliceAlpha). Tops come from the measured cloud-top heights
// (uCth) where they are loaded, else the assumed 2–10 km layer (uAssumed). The cloud mask: the measured product says
// where there is cloud at all (a VIIRS cloud-top retrieval), whiteness says how much; without it a MODELLED prior
// keeps persistent ice and high snow from reading as cloud (uSnowMask).

/** The cloud gate (0…1) of a pixel: cloud-top code `cth` (0 none, null = product not loaded) and ice prior `ice` (0…1). */
export function cloudGate(cth, ice = 0) {
  if (cth != null) return cth > 0 ? 1 : 0; // the product decides where cloud is (snow and ice have no cloud top)
  return 1 - Math.max(0, Math.min(1, ice));
}
/** Cloud-top height (km) from the 8-bit code of /api/earth-clouds/heights (null for 0: no cloud). */
export const cthKm = (v) => (v > 0 ? ((v - 1) * 50 + 25) / 1000 : null);

/**
 * MODELLED prior for persistent ice and snow (W × H, row 0 north, 0…255) from the DEM (metres, NaN = none):
 * Antarctica's ice sheet (south of 60° S, above sea level), Greenland's (59–84° N, 75–10° W, above sea level) and
 * high snow above 4,500 m (the Himalaya, Tibet, the Andes' peaks), feathered over a few cells.
 */
export function icePriorMask(heightAt, W = 512, H = 256) {
  const m = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    const lat = 90 - ((y + 0.5) / H) * 180;
    for (let x = 0; x < W; x++) {
      const lon = -180 + ((x + 0.5) / W) * 360, h = heightAt(lat, lon);
      if (!Number.isFinite(h)) continue;
      const ant = lat < -60 && h > 0, grl = lat > 59 && lat < 84 && lon > -75 && lon < -10 && h > 0;
      const high = Math.max(0, Math.min(1, (h - 4000) / 1000));
      m[y * W + x] = Math.round(255 * Math.max(ant || grl ? 1 : 0, high));
    }
  }
  return m;
}

let iceTex = null;
/** The ice prior as a texture (built once Earth's DEM has loaded; null until then). */
export function icePriorTexture() {
  if (iceTex) return iceTex;
  const d = demNow('earth');
  if (!d) return null;
  const W = 512, H = 256, m = icePriorMask((lat, lon) => sampleDem(d.dem, lat, lon), W, H);
  const flipped = new Uint8Array(W * H); // DataTexture rows run south → north (v = 0 south)
  for (let y = 0; y < H; y++) flipped.set(m.subarray((H - 1 - y) * W, (H - y) * W), y * W);
  iceTex = new THREE.DataTexture(flipped, W, H, THREE.RedFormat, THREE.UnsignedByteType);
  iceTex.magFilter = THREE.LinearFilter; iceTex.minFilter = THREE.LinearFilter; iceTex.wrapS = THREE.RepeatWrapping;
  iceTex.needsUpdate = true;
  return iceTex;
}

/** Add the lower slices of Earth's cloud volume as children of the outer shell `shell` (radius 1 + shellKm / R). */
export function addCloudSlices(shell, layer, radiusKm) {
  const outer = 1 + layer.shellKm / radiusKm, mat = shell.material;
  mat.uniforms.uSliceOn = { value: 1 };
  mat.uniforms.uSliceKm = { value: layer.shellKm };
  const slices = [];
  for (const h of layer.slicesKm) {
    if (Math.abs(h - layer.shellKm) < 1e-6) { slices.push(shell); continue; }
    const m = mat.clone();
    m.uniforms = { ...mat.uniforms, uSliceKm: { value: h } }; // every other uniform object is shared with the shell
    m.userData = { ...mat.userData };
    const s = new THREE.Mesh(shell.geometry, m);
    s.scale.setScalar((1 + h / radiusKm) / outer);
    s.userData.slice = h;
    shell.add(s);
    slices.push(s);
  }
  shell.userData.slices = slices;
  return slices;
}

const SEG = { far: [96, 48], near: [512, 256] };
/**
 * Fine geometry for a cloud shell when the camera is near (a coarse sphere's flat facets sag several km below the
 * nominal height between vertices: 3.4 km at 96 × 48 on Earth, 0.12 km at 512 × 256): one geometry shared by its slices.
 */
export function cloudDetail(shell, near) {
  const want = near ? 'near' : 'far';
  if (shell.userData.seg === want) return;
  const old = shell.geometry, geo = new THREE.SphereGeometry(1 + (shell.userData.layer?.shellKm ?? 0) / (shell.userData.radiusKm ?? 1), ...SEG[want]);
  shell.geometry = geo;
  for (const s of shell.userData.slices ?? []) s.geometry = geo;
  old.dispose();
  shell.userData.seg = want;
}

/**
 * Which faces of a cloud shell of radius `shellR` (body radii) a camera `camR` from the centre sees: from outside only
 * its outer faces (the far side's inner faces lie behind the planet), from inside only its inner faces. Drawing both
 * let the far side's faces through any gap in the ground (#83: the speckles seen through Earth's clouds from the
 * tops; with a logarithmic depth buffer the fragment shader also runs before the depth test, so it costs double).
 */
export const shellSide = (camR, shellR) => (camR >= shellR ? THREE.FrontSide : THREE.BackSide);
/** Set each slice's side for the camera (`camR` body radii from the centre). */
export function cloudSides(shell, camR) {
  const R0 = shell.geometry.parameters?.radius ?? 1;
  for (const s of shell.userData.slices ?? [shell]) {
    const side = shellSide(camR, R0 * (s === shell ? 1 : s.scale.x));
    if (s.material.side !== side) { s.material.side = side; s.material.needsUpdate = true; }
  }
}

let earthCloudsP = null;
/**
 * Today's measured Earth clouds (/api/earth-clouds): the cloud-top heights and the true-colour mosaic of the same
 * day and satellite → { date, heights: Texture (nearest, linear values), colour: Texture, codes: { data, w, h } } or null.
 */
export function loadEarthClouds() {
  earthCloudsP ??= (async () => {
    if (import.meta.env?.MODE === 'standalone') return null;
    const r = await fetch('/api/earth-clouds/heights');
    if (!r.ok) return null;
    const date = r.headers.get('x-cloud-date');
    const blob = await r.blob();
    const img = await createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
    const heights = new THREE.Texture(img);
    heights.colorSpace = THREE.NoColorSpace; heights.flipY = false; heights.generateMipmaps = false;
    heights.minFilter = THREE.NearestFilter; heights.magFilter = THREE.NearestFilter; heights.wrapS = THREE.RepeatWrapping;
    heights.needsUpdate = true;
    // a CPU copy for the surface view's read-outs (the top over the spot)
    const cv = document.createElement('canvas');
    cv.width = 1024; cv.height = 512;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, 1024, 512);
    const codes = { data: ctx.getImageData(0, 0, 1024, 512).data, w: 1024, h: 512 };
    const colour = await new Promise((res) => new THREE.TextureLoader().load(`/api/earth-clouds/colour?date=${date}`, (t) => res(t), undefined, () => res(null)));
    if (!colour) return null;
    colour.colorSpace = THREE.SRGBColorSpace; colour.anisotropy = 8; colour.wrapS = THREE.RepeatWrapping;
    return { date, heights, colour, codes };
  })().catch(() => null);
  return earthCloudsP;
}

/** Measured cloud-top (km) and its code at texture coordinates (u, v; v = 0 south) of the heights grid, or null. */
export function cloudTopAt(ec, u, v) {
  if (!ec?.codes) return null;
  const { data, w, h } = ec.codes;
  let best = 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { // the highest top among the nearest cells (~10 km)
    const x = ((Math.floor((((u % 1) + 1) % 1) * w) + dx) % w + w) % w, y = Math.max(0, Math.min(h - 1, Math.floor((1 - v) * h) + dy));
    best = Math.max(best, data[(y * w + x) * 4]);
  }
  return cthKm(best);
}
