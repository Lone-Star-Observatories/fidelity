// Band imagery for materials (#28): loading with auto-levels, and setting a planet material's
// spectrum-filter uniforms from a body's band look (bandskin.js) or, for a custom transmission curve
// (#66), from its curve look (curvelook.js). Shared by the System and Planet views.
//
// Instant previews (#62): every real map loads as a small preview first (/api/hips?…&size=preview,
// 512×256 for a body, 256×128 for the sky; /api/feed/<sdo>?size=preview, 256×256), then the full
// resolution in the background (requested after a short settle, so rapid switching does not fetch
// every band), cross-faded in. Each look carries `res`: preview → loading → full (or failed). Full
// loads are tracked by the band-load tracker (src/data/bandload.js) for the "Processing" announcer.
import * as THREE from 'three';
import { bandLook } from './bandskin.js';
import { curveLook } from './curvelook.js';
import { effectiveNm } from '../../astro/bands.js';
import { bandLoads } from '../../data/bandload.js';
import { BANDS, BODY_BAND } from '../../data/bands.js';
import { loadLive } from './materials.js';

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
      // in linear light, as the shader samples the (sRGB) texture: levels in sRGB crushed mid-tones to black (#28)
      const lin = (v) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
      for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 128) lum.push((lin(d[i]) + lin(d[i + 1]) + lin(d[i + 2])) / 3);
      lum.sort((a, b) => a - b);
      const lo = lum[Math.floor(lum.length * 0.02)] ?? 0, hi = lum[Math.floor(lum.length * 0.98)] ?? 1;
      levels = [lo, 1 / Math.max(0.02, hi - lo)];
    } catch { /* no canvas */ }
    resolve({ texture: t, levels });
  }, undefined, () => { cache.delete(url); resolve(null); }))); // a failure may be retried later
  return cache.get(url);
}
const sz = (size) => (size === 'preview' ? '&size=preview' : '');
export const hipsUrl = (id, size = '') => (STANDALONE ? null : `/api/hips?id=${encodeURIComponent(id)}${sz(size)}`);
export const gibsUrl = (layers, size = '') => (STANDALONE ? null : `/api/gibs-band?layers=${encodeURIComponent(layers)}${sz(size)}`);
export const archiveUrl = (id, size = '') => (STANDALONE ? null : `/api/band-archive?id=${encodeURIComponent(id)}${sz(size)}`);
export const discUrl = (id, size = '') => (STANDALONE ? null : `/api/band-disc?id=${encodeURIComponent(id)}${sz(size)}`);
/** { preview, full } URLs of a real map (BODY_BAND entry), or null without a backend. */
export function realUrls(src) {
  if (src.hips) return hipsUrl(src.hips) && { preview: hipsUrl(src.hips, 'preview'), full: hipsUrl(src.hips) };
  if (src.gibs) return gibsUrl(src.gibs) && { preview: gibsUrl(src.gibs, 'preview'), full: gibsUrl(src.gibs) };
  if (src.archive) return archiveUrl(src.archive.id) && { preview: archiveUrl(src.archive.id, 'preview'), full: archiveUrl(src.archive.id) };
  if (src.disc) return discUrl(src.disc.id) && { preview: discUrl(src.disc.id, 'preview'), full: discUrl(src.disc.id) };
  return null;
}

// ---- preview → full -------------------------------------------------------------------------
const resListeners = new Set();
/** Called whenever a look's `res` changes (PREVIEW / LOADING / FULL / FAILED). */
export const onBandRes = (fn) => (resListeners.add(fn), () => resListeners.delete(fn));
const notify = () => { for (const fn of resListeners) fn(); };
export const FULL_DELAY_MS = 350;
const later = (ms) => new Promise((r) => setTimeout(r, ms));
function fadeIn(u, ms = 600) {
  const t0 = performance.now();
  u.uBandFade.value = 0;
  const step = () => { const k = Math.min(1, (performance.now() - t0) / ms); u.uBandFade.value = k; if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
/**
 * Show a real map on material uniforms `u` for `look`: preview at once (when it exists), full
 * resolution after a short settle, cross-faded. `onShow` runs when any image is first on screen.
 * Never shows an image under a newer look (u.__look guards every step).
 */
function progressive(u, look, urls, onShow) {
  let shown = null;
  look.res = 'loading';
  const current = () => u.__look === look;
  bandTexture(urls.preview).then((r) => {
    if (!r || !current() || shown === 'full') return;
    u.uBandTex.value = r.texture; u.uBandLevels.value.set(...r.levels); u.uBandFade.value = 1;
    shown = 'preview'; look.res = 'preview'; onShow(); notify();
    performance.mark?.('fidelity:band-preview'); // for timing the instant switch (#62)
  });
  const full = later(FULL_DELAY_MS).then(() => (!current() ? true : bandTexture(urls.full).then((r) => {
    if (!current()) return true;
    if (!r) { look.res = shown ? 'failed-preview' : 'failed'; notify(); return null; }
    if (shown === 'preview' && u.uBandTexPrev) { u.uBandTexPrev.value = u.uBandTex.value; fadeIn(u); } else if (u.uBandFade) u.uBandFade.value = 1;
    u.uBandTex.value = r.texture; u.uBandLevels.value.set(...r.levels);
    shown = 'full'; look.res = 'full'; onShow(); notify();
    performance.mark?.('fidelity:band-full');
    return true;
  })));
  bandLoads.track(full, look.detail ?? look.label);
}
/** A live feed's 256×256 preview (#62), e.g. an SDO frame. */
const feedPreviews = new Map();
export function loadFeedPreview(id) {
  if (STANDALONE) return Promise.resolve(null);
  if (!feedPreviews.has(id)) feedPreviews.set(id, fetch(`/api/feed/${id}?size=preview`).then(async (r) => {
    if (!r.ok) return null;
    const url = URL.createObjectURL(await r.blob()), disk = Number(r.headers.get('x-feed-disk')) || null;
    const texture = await new Promise((res) => loader.load(url, (t) => { t.colorSpace = THREE.SRGBColorSpace; res(t); }, undefined, () => res(null)));
    return texture ? { texture, disk } : null;
  }).catch(() => null).then((v) => { if (!v) feedPreviews.delete(id); return v; }));
  return feedPreviews.get(id);
}
/** A feed (SDO) on a star disc: preview, then full; `apply(l)` while `current()` holds. */
export function progressiveFeed(id, look, current, apply) {
  let shown = null;
  look.res = 'loading';
  loadFeedPreview(id).then((l) => { if (!l || !current() || shown) return; apply(l); shown = 'preview'; look.res = 'preview'; notify(); });
  const full = later(FULL_DELAY_MS).then(() => (!current() ? true : loadLive(id).then((l) => {
    if (!current()) return true;
    if (!l) { look.res = shown ? 'failed-preview' : 'failed'; notify(); return null; }
    apply(l); shown = 'full'; look.res = 'full'; notify();
    return true;
  })));
  bandLoads.track(full, look.detail ?? look.label);
}

/**
 * Set planet-material uniforms `u` for `body` in this band/pass; returns the look (its mode may
 * change to 'dark' when a real map needs the backend). `full` resets to the normal skin. A custom
 * curve (band.id 'custom', see bandstate.js) goes to applyCurveToMaterial.
 */
/** Point the shader at a whole-disc image's geometry (#28), or switch disc projection off. */
export function setDisc(u, src) {
  if (!u?.uDiscOn) return;
  const d = src?.disc;
  u.uDiscOn.value = d ? 1 : 0;
  if (!d) return;
  u.uDiscC.value.set(d.cx / d.w, 1 - d.cy / d.h); u.uDiscR.value.set(d.re, d.rp); u.uDiscWH.value.set(d.w, d.h);
  u.uDiscPA.value = ((d.pa ?? 0) * Math.PI) / 180;
}
const MIX_CH = { reflected: 1, thermal: 2, glow: 3 };
/** The predicted skin under a disc image (its far side): one look's part on the mix channels, weight `w`. */
function predictedUnder(u, look, w, mix) {
  const ch = MIX_CH[look?.mode];
  if (!ch) return;
  mix.setComponent(ch, w);
  u.uMixPal.value.setComponent(ch, look.palette ?? 4);
  if (look.mode === 'reflected') u.uBandGain.value = look.gain ?? 1;
  if (look.mode === 'thermal') { u.uThermal.value.set(...look.thermal); u.uBandUm.value = look.um; }
  if (look.mode === 'glow') { u.uGlow.value = look.glow; u.uGlowGain.value = look.gain ?? 1; }
}
/**
 * A disc image in one bandpass: drawn through the curve mix (mode 6) so the hemisphere it does not
 * cover shows the predicted look (`${id}~` asks bandLook for the look without the real image).
 */
function applyDisc(u, body, band, pass, look) {
  const under = bandLook({ ...body, id: `${body.id}~` }, band, pass);
  u.uMixHue.value.multiplyScalar(0);
  u.uMixPal.value.set(0, 4, 4, 4); // the image in its own colours
  u.uMix.value.set(0, 0, 0, 0);
  predictedUnder(u, under, 1e-3, u.uMix.value); // tiny: wherever the image is, it wins
  u.uBandLit.value = 0; // the image carries its own lighting
  u.uBandMode.value = 6;
  u.__look = look;
  look.under = under;
  const urls = realUrls(look.source);
  if (urls) progressive(u, look, urls, () => { u.uMix.value.x = 1; });
  else { look.label += ' · NEEDS THE LOCAL BACKEND'; }
  return look;
}

export function applyBandToMaterial(u, body, band, pass) {
  if (!u?.uBandMode) return null;
  setDisc(u, null);
  if (band.id === 'full') { u.uBandMode.value = 0; u.__look = null; return null; }
  if (band.id === 'custom' && pass?.curve) return applyCurveToMaterial(u, body, pass.curve);
  const look = bandLook(body, band, pass);
  u.uPalette.value = look.palette;
  if (look.thermal) u.uThermal.value.set(...look.thermal); else u.uThermal.value.set(0, 0, 0, 0);
  if (look.um) u.uBandUm.value = look.um;
  if (look.mode === 'real' && look.source.disc && u.uMix) { setDisc(u, look.source); return applyDisc(u, body, band, pass, look); }
  if (look.mode === 'real') {
    const src = look.source, nm = pass?.filter ? effectiveNm(pass.filter) : 550;
    u.uBandLit.value = (nm < 2600 || src.lit) && !src.gibs && !src.unlit && !src.disc ? 1 : 0;
    // the predicted thermal look stands in under gaps in partial maps and sets the night side
    const t = bandLook({ ...body, id: `${body.id}~` }, band, pass);
    if (t.thermal) { u.uThermal.value.set(...t.thermal); u.uBandUm.value = t.um; }
    const urls = realUrls(src);
    u.uBandMode.value = 4; // dark until the preview (or the full map) arrives
    u.__look = look;
    if (urls) progressive(u, look, urls, () => { u.uBandMode.value = 1; });
    else { look.mode = 'dark'; look.label = 'REAL MAP NEEDS THE LOCAL BACKEND'; }
  } else {
    u.uBandMode.value = { reflected: 2, thermal: 3, dark: 4, glow: 5 }[look.mode];
    u.uBandGain.value = look.gain ?? 1; // thermal looks dim the disc when non-thermal belts carry most of the flux (#61)
    if (look.glow) u.uGlow.value = look.glow;
  }
  u.__look = look;
  return look;
}

/** Material uniforms for a custom transmission curve (#66): mode 6, the curve look's weights and colours. */
export function applyCurveToMaterial(u, body, curve) {
  if (!u?.uBandMode) return null;
  setDisc(u, null);
  const look = curveLook(body, curve);
  if (!look) { u.uBandMode.value = 0; u.__look = null; return null; }
  if (look.mode !== 'curve' || !u.uMix) { // a plain look (dark), or an old material without mode 6
    u.uBandMode.value = 4; u.__look = look; return look;
  }
  const pal = look.palette, hue = (h) => (look.composite && h ? [...h, 1] : [0, 0, 0, 0]);
  const m = look.mix;
  u.uMixPal.value.set(look.real?.palette ?? pal, pal, pal, pal);
  u.uMixHue.value.fromArray([...hue(look.real?.hue), ...hue(look.reflected?.hue), ...hue(look.thermalPart?.hue), ...hue(look.glowPart?.hue)]);
  u.uBandGain.value = look.reflected?.gain ?? 1;
  if (look.thermalPart) { u.uThermal.value.set(...look.thermalPart.thermal); u.uBandUm.value = look.thermalPart.um; } else u.uThermal.value.set(0, 0, 0, 0);
  if (look.glowPart) { u.uGlow.value = look.glowPart.glow; u.uGlowGain.value = look.glowPart.gain; }
  u.uBandLit.value = look.real?.lit ? 1 : 0;
  u.uPalette.value = pal;
  // the real map joins the mix when its preview (or full map) is on screen
  u.uMix.value.set(0, look.reflected ? m.reflected : 0, look.thermalPart ? m.thermal : 0, look.glowPart ? m.glow : 0);
  if (look.real?.source.disc) { // a disc image: its far side shows the predicted skin (#28)
    setDisc(u, look.real.source);
    u.uMixPal.value.x = 0; u.uMixHue.value.elements[3] = 0; // the image in its own colours
    if (u.uMix.value.y + u.uMix.value.z + u.uMix.value.w < 1e-3) {
      const under = curveLook({ ...body, id: `${body.id}~` }, curve);
      if (under?.mode === 'curve') for (const [part, mode] of [[under.reflected, 'reflected'], [under.thermalPart, 'thermal'], [under.glowPart, 'glow']]) {
        if (part) predictedUnder(u, { mode, palette: pal, gain: part.gain, thermal: part.thermal, um: part.um, glow: part.glow }, 1e-3 * (under.mix[mode] || 1), u.uMix.value);
      } else predictedUnder(u, under, 1e-3, u.uMix.value);
    }
  }
  u.uBandMode.value = 6;
  u.__look = look;
  if (look.real) {
    const urls = realUrls(look.real.source);
    if (urls) progressive(u, look, urls, () => { u.uMix.value.x = m.real; });
    else look.label += ' · REAL MAP NEEDS THE LOCAL BACKEND';
  }
  return look;
}

// ---- prefetch ---------------------------------------------------------------------------------
/** Every preview URL: each all-sky survey, each body's real map, each SDO frame. */
export function previewUrls() {
  if (STANDALONE) return [];
  const out = new Set();
  for (const b of BANDS) for (const p of b.passes) if (p.sky) out.add(hipsUrl(p.sky, 'preview'));
  for (const m of Object.values(BODY_BAND)) for (const s of Object.values(m)) { const u = realUrls(s); if (u) out.add(u.preview); }
  return [...out];
}
export const previewFeeds = () => (STANDALONE ? [] : [...new Set(Object.values(BODY_BAND).flatMap((m) => Object.values(m)).map((s) => s.feed).filter(Boolean))]);
let prefetching = false;
/** Warm every preview, one at a time (the backend queues upstream fetches too). */
export async function prefetchPreviews() {
  if (prefetching) return;
  prefetching = true;
  for (const url of previewUrls()) await bandTexture(url);
  for (const id of previewFeeds()) await loadFeedPreview(id);
}
