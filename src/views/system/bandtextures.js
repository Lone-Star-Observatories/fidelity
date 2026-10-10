// Band imagery for materials (#28): loading with auto-levels, and setting a planet material's
// spectrum-filter uniforms from a body's band look (bandskin.js). Shared by the System and
// Planet views.
import * as THREE from 'three';
import { bandLook } from './bandskin.js';
import { effectiveNm } from '../../astro/bands.js';

const STANDALONE = import.meta.env?.MODE === 'standalone';
const loader = new THREE.TextureLoader();
const cache = new Map(); // url → Promise<{ texture, levels } | null>

/** Load a band image once, with auto-levels (2nd–98th percentile of luminance over its data). */
export function bandTexture(url) {
  if (!cache.has(url)) cache.set(url, new Promise((resolve) => loader.load(url, (t) => {
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    let levels = [0, 1];
    try {
      const c = document.createElement('canvas'); c.width = 256; c.height = 128;
      const g = c.getContext('2d'); g.drawImage(t.image, 0, 0, 256, 128);
      const d = g.getImageData(0, 0, 256, 128).data, lum = [];
      for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 128) lum.push((d[i] + d[i + 1] + d[i + 2]) / 765);
      lum.sort((a, b) => a - b);
      const lo = lum[Math.floor(lum.length * 0.02)] ?? 0, hi = lum[Math.floor(lum.length * 0.98)] ?? 1;
      levels = [lo, 1 / Math.max(0.02, hi - lo)];
    } catch { /* no canvas */ }
    resolve({ texture: t, levels });
  }, undefined, () => resolve(null))));
  return cache.get(url);
}
export const hipsUrl = (id) => (STANDALONE ? null : `/api/hips?id=${encodeURIComponent(id)}`);
export const gibsUrl = (layers) => (STANDALONE ? null : `/api/gibs-band?layers=${encodeURIComponent(layers)}`);

/**
 * Set planet-material uniforms `u` for `body` in this band/pass; returns the look (its mode may
 * change to 'dark' when a real map needs the backend). `full` resets to the normal skin.
 */
export function applyBandToMaterial(u, body, band, pass) {
  if (!u?.uBandMode) return null;
  if (band.id === 'full') { u.uBandMode.value = 0; return null; }
  const look = bandLook(body, band, pass);
  u.uPalette.value = look.palette;
  if (look.thermal) u.uThermal.value.set(...look.thermal); else u.uThermal.value.set(0, 0, 0, 0);
  if (look.um) u.uBandUm.value = look.um;
  if (look.mode === 'real') {
    const src = look.source, nm = pass?.filter ? effectiveNm(pass.filter) : 550;
    u.uBandLit.value = nm < 2600 && !src.gibs ? 1 : 0;
    // the predicted thermal look stands in under gaps in partial maps and sets the night side
    const t = bandLook({ ...body, id: `${body.id}~` }, band, pass);
    if (t.thermal) { u.uThermal.value.set(...t.thermal); u.uBandUm.value = t.um; }
    const url = src.hips ? hipsUrl(src.hips) : src.gibs ? gibsUrl(src.gibs) : null;
    u.uBandMode.value = 4; // dark until it arrives
    if (url) bandTexture(url).then((r) => { if (!r || u.__look !== look) return; u.uBandTex.value = r.texture; u.uBandLevels.value.set(...r.levels); u.uBandMode.value = 1; });
    else { look.mode = 'dark'; look.label = 'REAL MAP NEEDS THE LOCAL BACKEND'; }
  } else {
    u.uBandMode.value = { reflected: 2, thermal: 3, dark: 4, glow: 5 }[look.mode];
    if (look.gain != null) u.uBandGain.value = look.gain;
    if (look.glow) u.uGlow.value = look.glow;
  }
  u.__look = look;
  return look;
}
