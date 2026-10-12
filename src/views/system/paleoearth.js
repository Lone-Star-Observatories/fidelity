// Earth through time on the globe (#54). With the ship's clock in the past, Earth shows that
// time's sea level (Spratt & Lisiecki 2016, anchored so today reads 0 m) against ETOPO1, and for the
// last 30,000 years the PaleoMIST ice-sheet margins (Gowan et al. 2021), blended between 2,500-year
// slices. A chosen scenario overrides the clock: a future sea level, or GPlates coastlines millions
// of years ago. Layers come from scripts/paleoearth.js (public/paleo/) and load on first use.

import * as THREE from 'three';
import { BIOME_YEARS, BIOME_COLOURS } from '../../data/paleo-biomes.js';

const ICE_STEP = 2500, ICE_MAX = 30000, SEA_MAX_KA = 798;
/** The Messinian drawdown at its peak (m below the Atlantic): Aloisi et al. 2024, Nat. Commun. 15, 10.1038/s41467-024-53781-6. */
export const MESSINIAN = { westM: 850, eastM: 1900 };
const loader = new THREE.TextureLoader();
const cache = new Map();
/** A layer texture: data (no colour space) unless `srgb` (a colour image the shader paints with). */
function tex(url, srgb = false) {
  if (!cache.has(url)) cache.set(url, new Promise((ok) => loader.load(url, (t) => { t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; ok(t); }, undefined, () => ok(null))));
  return cache.get(url);
}
let palette = null;
/** BIOME4 class colours as a 32×1 texture indexed by the biome PNG value (class + 1; 0 = no land data, transparent). */
function biomePalette() {
  if (palette) return palette;
  const d = new Uint8Array(32 * 4);
  BIOME_COLOURS.forEach((c, i) => { if (!c) return; const k = (i + 1) * 4; d[k] = parseInt(c.slice(1, 3), 16); d[k + 1] = parseInt(c.slice(3, 5), 16); d[k + 2] = parseInt(c.slice(5, 7), 16); d[k + 3] = 255; });
  palette = new THREE.DataTexture(d, 32, 1);
  palette.colorSpace = THREE.SRGBColorSpace; palette.magFilter = palette.minFilter = THREE.NearestFilter; palette.needsUpdate = true;
  return palette;
}
/** The two biome slices around `yearsAgo` and how far between them, or null beyond the record (120 ka). */
export function biomeSlices(yearsAgo, years = BIOME_YEARS) {
  if (!(yearsAgo >= 0) || yearsAgo > years.at(-1)) return null;
  let i = years.findIndex((y) => y >= yearsAgo);
  if (years[i] === yearsAgo) return { a: years[i], b: years[i], mix: 0 };
  const a = years[i - 1], b = years[i];
  return { a, b, mix: (yearsAgo - a) / (b - a) };
}
/** Weight of the 6 ka North Africa proxy map: full at 6 ka, gone 1,500 years either side (it is one snapshot). */
export const saharaWeight = (yearsAgo) => Math.max(0, 1 - Math.abs(yearsAgo - 6000) / 1500);
/** The model biomes fade in over the first 3,000 years back, so today's imagery does not jump to the model's present. */
export const biomeWeight = (yearsAgo) => Math.max(0, Math.min(1, (yearsAgo - 500) / 2500));
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
  const off = () => { u.uPaleo.value = 0; u.uIceOn.value = 0; u.uLandOn.value = 0; u.uMedOn.value = 0; u.uBiomeOn.value = 0; u.uAfrW.value = 0; text = null; unpark(); };
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
      u.uLandOn.value = 0; u.uBiomeOn.value = 0; u.uAfrW.value = 0;
      const elev = await tex('/paleo/earth-elev.png');
      if (!elev) { off(); return; }
      u.uElev.value = elev;
      u.uMedOn.value = 0;
      if (scenario?.messinian) {
        // the Mediterranean east of the Gibraltar sill (the elevation layer's alpha: west/east of the Sicily sill and
        // depth). The peak drawdown from halite chlorine isotopes: ~0.85 km in the west, 1.7–2.1 km in the east, with
        // brine left in the deep basins (Aloisi et al. 2024). Other studies argue for far less, so the banner says so.
        u.uSea.value = 0; u.uIceOn.value = 0; u.uMedOn.value = 1; u.uMedLevel.value.set(MESSINIAN.westM, MESSINIAN.eastM); u.uPaleo.value = 1; park();
        text = 'THE MESSINIAN SALINITY CRISIS, ~5.6 MILLION YEARS AGO (KRIJGSMAN ET AL. 1999) · AT ITS PEAK THE MEDITERRANEAN FELL ~0.85 KM IN THE WEST AND ~1.9 KM IN THE EAST, LEAVING BRINE IN THE DEEP BASINS (ALOISI ET AL. 2024) · ESTIMATES RANGE FROM A FEW HUNDRED METRES TO OVER 2 KM · DRAWN ON TODAY\'S SEA FLOOR · MODELLED';
        return;
      }
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
      // vegetation: the model's biomes, and the 6 ka proxy map of northern Africa where it applies
      const bs = biomeSlices(yearsAgo), bw = bs ? biomeWeight(yearsAgo) : 0, aw = saharaWeight(yearsAgo);
      if (bs && bw > 0) {
        const [A, B] = await Promise.all([tex(`/paleo/biome-${bs.a}.png`), tex(`/paleo/biome-${bs.b}.png`)]);
        if (A && B) { u.uBiomeA.value = A; u.uBiomeB.value = B; u.uBiomeMix.value = bs.mix; u.uBiomePal.value = biomePalette(); u.uBiomeOn.value = bw; } else u.uBiomeOn.value = 0;
      } else u.uBiomeOn.value = 0;
      if (aw > 0) { const t = await tex('/paleo/sahara-6k.png', true); u.uAfr.value = t; u.uAfrW.value = t ? aw : 0; } else u.uAfrW.value = 0;
      const veg = u.uBiomeOn.value > 0 ? ` · VEGETATION: BIOME4 ON HADCM3 CLIMATE (BEYER ET AL. 2020), MODELLED${u.uAfrW.value > 0 ? ' · NORTH AFRICA: POLLEN AND LAKE RECORDS FOR 6,000 YEARS AGO (HOELZMANN ET AL. 1998)'
        : yearsAgo >= 5500 && yearsAgo <= 14800 ? ' · THE MODEL LEAVES THE SAHARA TOO DRY: RECORDS SHOW IT GREEN 14,800–5,500 YEARS AGO (DEMENOCAL ET AL. 2000)' : ''}` : '';
      text = `${scenario?.years != null ? 'THE GLOBE: ' : ''}EARTH ${fmt(yearsAgo)} AGO · SEA LEVEL ${sea > 0 ? '+' : ''}${sea.toFixed(0)} M (SPRATT & LISIECKI 2016)${sl ? ' · ICE SHEETS: PALEOMIST (GOWAN ET AL. 2021)' : u.uBiomeOn.value > 0 ? ' · ICE SHEETS: THE BIOME MODEL\'S LAND ICE' : ' · ICE SHEETS SHOWN FOR THE LAST 120,000 YEARS ONLY'}${veg} · MEASURED RECORD, MODELLED MAP${scenario?.years != null ? ' · THE PLANETS STAY AT THE SHIP\'S CLOCK' : ''}`;
    },
  };
}
