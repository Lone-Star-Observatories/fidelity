// Earth through time on the globe (#54). With the ship's clock in the past, Earth shows that
// time's sea level (Spratt & Lisiecki 2016, anchored so today reads 0 m) against ETOPO1, and for the
// last 30,000 years the PaleoMIST ice-sheet margins (Gowan et al. 2021), blended between 2,500-year
// slices. A chosen scenario overrides the clock: a future sea level, or GPlates coastlines millions
// of years ago. Layers come from scripts/paleoearth.js (public/paleo/) and load on first use.

import * as THREE from 'three';

const ICE_STEP = 2500, ICE_MAX = 30000, SEA_MAX_KA = 798;
const loader = new THREE.TextureLoader();
const cache = new Map();
function tex(url) {
  if (!cache.has(url)) cache.set(url, new Promise((ok) => loader.load(url, (t) => { t.colorSpace = THREE.NoColorSpace; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; ok(t); }, undefined, () => ok(null))));
  return cache.get(url);
}
let seaRows = null;
const loadSea = () => (seaRows ??= import('../../data/paleo.js').then((m) => m.SEA_LEVEL));

/** Sea level (m vs today) `ka` thousand years ago from the stack, anchored to 0 at the present. */
export function seaLevelAt(rows, ka) {
  if (!rows || ka < 0 || ka > SEA_MAX_KA) return null;
  const i = rows.findIndex((r) => r[0] >= ka), b = rows[Math.max(0, i)], a = rows[Math.max(0, i - 1)];
  const f = b[0] === a[0] ? 0 : (ka - a[0]) / (b[0] - a[0]), v = a[1] + (b[1] - a[1]) * f;
  return v - rows[0][1] * Math.max(0, 1 - ka / 10); // the stack reads ~+9 m at 0 ka (its spread): taper that to zero over 10 kyr
}
/** Which two ice slices to blend for `yearsAgo` (0–30,000), and how far between them. */
export function iceSlices(yearsAgo) {
  if (yearsAgo < 0 || yearsAgo > ICE_MAX) return null;
  const a = Math.floor(yearsAgo / ICE_STEP) * ICE_STEP, b = Math.min(ICE_MAX, a + ICE_STEP);
  return { a, b, mix: b === a ? 0 : (yearsAgo - a) / (b - a) };
}
const fmt = (y) => (y >= 1e6 ? `${+(y / 1e6).toFixed(1)} MILLION YEARS` : y >= 1e4 ? `${Math.round(y / 1e3)},000 YEARS` : `${Math.round(y).toLocaleString()} YEARS`);

/**
 * The paleo-Earth controller for one Earth material: update(yearsFromNow) each frame; setScenario(s)
 * with { sea, label } (m, a future level), { years } (Earth at that time, − past), { ma } (GPlates coastlines) or null; banner() describes what is shown.
 */
export function createPaleoEarth(material, { fetchCoastlines }) {
  const u = material.uniforms;
  let scenario = null, landFor = null, text = null, lastKey = null;
  // today's live imagery and city lights do not belong on another epoch: park them while it is shown
  let parked = null;
  const park = () => { if (!parked) { parked = { live: u.uHasLive.value, night: u.uHasNight.value }; } u.uHasLive.value = 0; u.uHasNight.value = 0; };
  const unpark = () => { if (parked) { u.uHasLive.value = parked.live; u.uHasNight.value = parked.night; parked = null; } };
  const off = () => { u.uPaleo.value = 0; u.uIceOn.value = 0; u.uLandOn.value = 0; text = null; unpark(); };
  async function landTexture(ma) {
    const j = await fetchCoastlines(ma);
    const c = document.createElement('canvas'); c.width = 2048; c.height = 1024;
    const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height); g.fillStyle = '#fff';
    g.beginPath();
    for (const poly of j.polygons) for (const ring of poly) ring.forEach(([lo, la], k) => { const x = ((lo + 180) / 360) * c.width, y = ((90 - la) / 180) * c.height; if (k) g.lineTo(x, y); else g.moveTo(x, y); });
    g.fill('evenodd');
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace;
    return t;
  }
  return {
    get banner() { return text; },
    setScenario(s) { scenario = s; lastKey = null; },
    async update(yearsFromNow) {
      if (parked && (u.uHasLive.value || u.uHasNight.value)) park(); // a live-imagery refresh while an epoch is shown
      const key = scenario ? JSON.stringify(scenario) : Math.round(yearsFromNow / 50);
      if (key === lastKey) return;
      lastKey = key;
      if (scenario?.ma) {
        if (landFor?.ma !== scenario.ma) { landFor = { ma: scenario.ma, t: null }; landFor.t = await landTexture(scenario.ma).catch(() => null); }
        if (!landFor.t) { off(); text = 'PAST COASTLINES NEED THE LOCAL BACKEND'; return; }
        u.uLand.value = landFor.t; u.uLandOn.value = 1; u.uIceOn.value = 0; u.uPaleo.value = 1; park();
        text = `EARTH ${fmt(scenario.ma * 1e6)} AGO · COASTLINES RECONSTRUCTED BY GPLATES (MÜLLER ET AL. 2019) · MODELLED · COLOURS ILLUSTRATIVE`;
        return;
      }
      u.uLandOn.value = 0;
      const elev = await tex('/paleo/earth-elev.png');
      if (!elev) { off(); return; }
      u.uElev.value = elev;
      if (scenario?.sea != null) {
        u.uSea.value = scenario.sea; u.uIceOn.value = 0; u.uPaleo.value = 1; park();
        text = `${scenario.label ?? `SEA LEVEL ${scenario.sea > 0 ? '+' : ''}${scenario.sea} M`} · MODELLED (ETOPO1 FLOODED; ICE NOT REDRAWN)`;
        return;
      }
      const yearsAgo = -(scenario?.years ?? yearsFromNow);
      if (yearsAgo < 500) { off(); return; } // the recent past and the future: today's Earth
      const sea = seaLevelAt(await loadSea(), yearsAgo / 1000);
      if (sea == null) { off(); return; }
      u.uSea.value = sea; u.uPaleo.value = 1; park();
      const sl = iceSlices(yearsAgo);
      if (sl) {
        const [A, B] = await Promise.all([tex(`/paleo/ice-${sl.a}.png`), tex(`/paleo/ice-${sl.b}.png`)]);
        u.uIceA.value = A; u.uIceB.value = B; u.uIceMix.value = sl.mix; u.uIceOn.value = A && B ? 1 : 0;
      } else u.uIceOn.value = 0;
      text = `${scenario?.years != null ? 'THE GLOBE: ' : ''}EARTH ${fmt(yearsAgo)} AGO · SEA LEVEL ${sea > 0 ? '+' : ''}${sea.toFixed(0)} M (SPRATT & LISIECKI 2016)${sl ? ' · ICE SHEETS: PALEOMIST (GOWAN ET AL. 2021)' : ' · ICE SHEETS SHOWN FOR THE LAST 30,000 YEARS ONLY'} · MEASURED RECORD, MODELLED MAP${scenario?.years != null ? ' · THE PLANETS STAY AT THE SHIP\'S CLOCK' : ''}`;
    },
  };
}
