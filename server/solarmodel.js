// The Sun at radio wavelengths below the microwave maps (#28).
//
// 1. MEASURED: the Siberian Radioheliograph (SRH, ISTP SB RAS, Badary; Altyntsev et al. 2020, STP 6, 30)
//    publishes CLEANed full-disc maps every few minutes during its day (~00–09 UT): 512×512 float32
//    FITS, 4.9″/px, Stokes I brightness temperature (K), in
//    https://ftp.rao.istp.ac.ru/SRH/<array>/cleanMaps/<yyyymmdd>/. Each array publishes maps at one
//    frequency: SRH0306 3,000 MHz (10 cm, feed `srh-3000`), SRH0612 6,000 MHz (5 cm, `srh-6000`) and
//    SRH1224 12,960 MHz (2.3 cm, `srh-12960`, #72). Nothing above 13 GHz is published as a map.
// 2. MODELLED · PREDICTED, below 3 GHz (no full-disc imager is fetchable there: Nobeyama closed in 2020
//    and was 17/34 GHz; Nançay, MUSER, LOFAR and the MWA publish no fetchable daily disc images;
//    RSTN and DRAO measure the whole-disc flux only). A disc built from measured inputs:
//      quiet Sun: the brightness-temperature spectrum Tb = 140,077 K·f^−2.1 + 10,880 K (f in GHz;
//        Zirin, Baumert & Hurford 1991, ApJ 370, 779, fitted 1.4–18 GHz), saturating towards the
//        ~10⁶ K corona at metre wavelengths, where the corona becomes optically thick (Dulk 1985,
//        ARA&A 23, 169): Tb_qs = 1 / (1/Tb_Zirin + 1/10⁶ K);
//      limb: brightening at decimetre wavelengths (the optically thin corona and transition region
//        seen edge-on), none at metre wavelengths, where the radio Sun is also larger than the
//        optical disc (Shibasaki, Alissandrakis & Pohjolainen 2011, Sol. Phys. 273, 309);
//      active regions: placed from today's SDO HMI line-of-sight magnetogram (strong-field pixels,
//        smoothed more at lower frequency, where the emission comes from higher, larger structures);
//      their total: the measured whole-disc flux minus the quiet Sun. The flux is the RSTN radiometers'
//        measurement at the nearest frequency within 15% (245, 410, 610, 1415, 2695 MHz; NOAA SWPC
//        solar-radio-flux.json) when one is available, else the daily F10.7 (DRAO, 2.8 GHz; NOAA SWPC
//        f107_cm_flux.json) scaled as excess ∝ f (between optically thin free-free, flat, and
//        optically thick emission, ∝ f²; with F10.7 = 126 this predicts 71 sfu at 1.4 GHz against 73
//        measured by RSTN on 10 October 2026).
//    The PNG uses the same log brightness-temperature scale for every frequency (10⁴–3×10⁶ K), so
//    408 MHz looks brighter than 2.4 GHz, as it is.

import zlib from 'node:zlib';
import { parseFits, encodePng } from './solarradio.js';

const UA = { 'user-agent': 'USS-Fidelity/0.3 (local astronomy explorer)' };
const K_B = 1.380649e-23, C = 299792458, SFU = 1e-22;
/** Solid angle of the optical solar disc at 1 au (sr). */
export const OMEGA_SUN = Math.PI * ((959.63 / 206264.806) ** 2);

/** The Sun's angular radius (arcsec) on a date: 959.63″ at 1 au; Earth's orbital eccentricity 0.0167, perihelion ~3 January. */
export const solarRadiusArcsec = (ms) => { const d = (ms - Date.UTC(2000, 0, 3)) / 86400000; return 959.63 / (1 - 0.01671 * Math.cos((2 * Math.PI * d) / 365.256)); };

// ---- brightness temperature <-> flux -------------------------------------------------------------
/** Zirin, Baumert & Hurford (1991) quiet-Sun brightness temperature (K) at f GHz. */
export const zirinTb = (fGHz) => 140077 * fGHz ** -2.1 + 10880;
/** Quiet-Sun disc brightness temperature (K): Zirin's spectrum saturating to the ~10⁶ K corona at metre wavelengths. */
export const quietTb = (fGHz) => 1 / (1 / zirinTb(fGHz) + 1 / 1e6);
/** Flux density (sfu) of brightness temperature T (K) over solid angle omega (Rayleigh–Jeans). */
export const tbToSfu = (T, fGHz, omega = OMEGA_SUN) => (2 * K_B * T * (fGHz * 1e9) ** 2 / C ** 2) * omega / SFU;
export const sfuToTb = (S, fGHz, omega = OMEGA_SUN) => (S * SFU * C ** 2) / (2 * K_B * (fGHz * 1e9) ** 2 * omega);
/** The radio Sun's radius (optical radii): larger at metre wavelengths (Shibasaki et al. 2011). */
export const radioRadius = (fGHz) => 1 + 0.12 * fGHz ** -0.8;
/** Limb-brightening amplitude: ~0.35 at decimetre wavelengths, none at metre wavelengths. */
export const limbBrightening = (fGHz) => 0.35 * Math.max(0, Math.min(1, (fGHz - 0.3) / 1.2));

/**
 * Whole-disc flux (sfu) at f GHz: { sfu, from: 'rstn' | 'f107', at? (MHz of the RSTN reading) }.
 * `rstn`: [[MHz, sfu], …] measured today (optional); `f107`: the daily 10.7 cm flux (sfu).
 */
export function discFlux(fGHz, { f107, rstn = [] } = {}) {
  const near = rstn.filter(([mhz, s]) => s > 0 && Math.abs(mhz / 1000 / fGHz - 1) <= 0.15).sort((a, b) => Math.abs(a[0] / 1000 - fGHz) - Math.abs(b[0] / 1000 - fGHz))[0];
  if (near) return { sfu: near[1] * (fGHz / (near[0] / 1000)) ** 0.5, from: 'rstn', at: near[0] }; // a small step to the exact frequency (S ∝ f^0.5 locally)
  const qs = tbToSfu(quietTb(fGHz), fGHz), excess = Math.max(0, (f107 ?? tbToSfu(quietTb(2.8), 2.8)) - tbToSfu(quietTb(2.8), 2.8)) * (fGHz / 2.8);
  return { sfu: qs + excess, from: 'f107' };
}

/**
 * The modelled disc: { tb: Float32Array (size², top row first, K), size, disk (R☉ / width), meanTb (K, flux over the
 * optical disc's solid angle), quietTb, sfu, from }. `mag`: { w, h, rgba, disk } an HMI magnetogram image (grey 50% = 0 G),
 * or null for a quiet Sun with no active regions placed (the excess then spreads over the disc).
 */
export function modelDisc(fGHz, { f107, rstn, mag = null, size = 256, disk = 0.38 } = {}) {
  const R = disk * size, c = (size - 1) / 2, Rr = radioRadius(fGHz), a = limbBrightening(fGHz), w = Math.max(0.02, Rr - 1);
  const qs = new Float32Array(size * size);
  let sum = 0;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const r = Math.hypot(x - c, y - c) / R;
    const b = r <= 1 ? 1 + a * r ** 8 : (1 + a) * Math.exp(-(((r - 1) / w) ** 2));
    qs[y * size + x] = b; sum += b;
  }
  const Tq = quietTb(fGHz), Sq = tbToSfu(Tq, fGHz), flux = discFlux(fGHz, { f107, rstn });
  // scale so the quiet disc's flux over the optical disc's solid angle is Tq (Σ Tb = Tq · πR² in pixel units)
  const kq = (Tq * Math.PI * R * R) / sum;
  const ar = activeRegions(mag, size, R, fGHz);
  const arSum = ar.reduce((s, v) => s + v, 0);
  const excessSum = Math.max(0, flux.sfu - Sq) / Sq * Tq * Math.PI * R * R; // Σ ΔTb over the image
  const tb = new Float32Array(size * size);
  for (let i = 0; i < tb.length; i++) tb[i] = qs[i] * kq + (arSum > 0 ? (ar[i] / arSum) * excessSum : (qs[i] / sum) * excessSum);
  const total = tb.reduce((s, v) => s + v, 0);
  return { tb, size, disk, meanTb: total / (Math.PI * R * R), quietTb: Tq, sfu: flux.sfu, from: flux.from, at: flux.at ?? null, arPlaced: arSum > 0 };
}

/** Active-region weights from an HMI magnetogram image: strong-field pixels on the disc, Gaussian-smoothed (wider at lower f). */
export function activeRegions(mag, size, R, fGHz) {
  const out = new Float32Array(size * size);
  if (!mag?.rgba) return out;
  const c = (size - 1) / 2, mc = (mag.w - 1) / 2, mR = (mag.disk ?? 0.39) * mag.w, k = mR / R;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const r = Math.hypot(x - c, y - c) / R;
    if (r > 0.98) continue;
    const mx = Math.round(mc + (x - c) * k), my = Math.round(mc + (y - c) * k);
    if (mx < 0 || my < 0 || mx >= mag.w || my >= mag.h) continue;
    const o = (my * mag.w + mx) * 4, g = (mag.rgba[o] + mag.rgba[o + 1] + mag.rgba[o + 2]) / 765;
    const b = Math.abs(g - 0.5) * 2; // |B| proxy, 0…1 (Helioviewer's HMI scaling is clipped; it places regions, the flux sets their brightness)
    out[y * size + x] = Math.max(0, b - 0.25);
  }
  return blur(out, size, 2.5 * (2.8 / fGHz) ** 0.5 * (R / 97));
}
function blur(a, n, sigma) {
  const r = Math.ceil(sigma * 3), k = Array.from({ length: 2 * r + 1 }, (_, i) => Math.exp(-(((i - r) / sigma) ** 2) / 2));
  const ks = k.reduce((s, v) => s + v, 0), tmp = new Float32Array(n * n), out = new Float32Array(n * n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { let s = 0; for (let i = -r; i <= r; i++) { const xx = x + i; if (xx >= 0 && xx < n) s += a[y * n + xx] * k[i + r]; } tmp[y * n + x] = s / ks; }
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { let s = 0; for (let i = -r; i <= r; i++) { const yy = y + i; if (yy >= 0 && yy < n) s += tmp[yy * n + x] * k[i + r]; } out[y * n + x] = s / ks; }
  return out;
}

// ---- false colour ------------------------------------------------------------------------------
/** Radio palette on a log scale (v 0…1): orange, white at the top (the app's RADIO band). */
const radioRgb = (v) => { const white = Math.max(0, (v - 0.75) / 0.25), k = v ** 0.6; return [Math.min(1, k), Math.min(1, 0.55 * k + white * 0.45), Math.min(1, 0.15 * k + white * 0.85)]; };
/** Brightness temperatures (K, top row first) as a log-scaled radio-palette PNG between lo and hi K. */
export function tbPng(tb, w, h, lo = 1e4, hi = 3e6) {
  const l0 = Math.log10(lo), l1 = Math.log10(hi), rgb = new Uint8Array(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    const T = tb[i], v = Number.isFinite(T) && T > 0 ? Math.max(0, Math.min(1, (Math.log10(T) - l0) / (l1 - l0))) : 0, c = radioRgb(v);
    rgb[i * 3] = 255 * c[0]; rgb[i * 3 + 1] = 255 * c[1]; rgb[i * 3 + 2] = 255 * c[2];
  }
  return encodePng(rgb, w, h);
}

// ---- SRH: 3.0 GHz (SRH0306), 6.0 GHz (SRH0612), 12.96 GHz (SRH1224) ------------------------------
const SRH_ROOT = 'https://ftp.rao.istp.ac.ru/SRH';
/**
 * The arrays and the one frequency each publishes as daily CLEAN maps in <array>/cleanMaps/<yyyymmdd>/ (checked
 * 2026-10-11): SRH0306 3,000 MHz (srh_I_<iso>_3000.fit), SRH0612 6,000 MHz and SRH1224 12,960 MHz
 * (srh_<yyyymmddThhmmss>_<MHz>_I.fit; SRH1224 was 12,200 MHz until early 2026; 7.0/9.4/11.8 GHz maps exist only
 * for January 2022). The arrays' other frequencies (to 24 GHz) are only raw correlator data
 * (<array>/<yyyy>/<mm>/<dd>/srh_*.fit), which would need calibrating and imaging.
 */
export const SRH_ARRAYS = { 3000: 'SRH0306', 6000: 'SRH0612', 12960: 'SRH1224' };
/** Stokes I map file names for `mhz` in a cleanMaps day listing (either naming scheme). */
export function srhMapNames(html, mhz) {
  const re = new RegExp(`href="\\./(srh_I_\\d{4}-\\d\\d-\\d\\dT\\d\\d:\\d\\d:\\d\\d_${mhz}\\.fit|srh_\\d{8}T\\d{6}_${mhz}_I\\.fit)"`, 'g');
  return [...new Set([...html.matchAll(re)].map((m) => m[1]))];
}
/** UT hour of an SRH map file name. */
export const srhHour = (n) => { const m = n.match(/T(\d\d):?(\d\d):?\d\d/); return Number(m[1]) + Number(m[2]) / 60; };
/** An SRH clean map → { png, disk, time, freq }, on a log brightness-temperature scale lo…hi K. */
export function srhToPng(fits, { lo = 3e3, hi = 3e5 } = {}) {
  const { header, w, h, data } = parseFits(fits);
  const top = new Float32Array(w * h);
  for (let y = 0; y < h; y++) top.set(data.subarray((h - 1 - y) * w, (h - y) * w), y * w); // FITS row 0 is solar south
  // DATE-OBS is a date (3 GHz maps, time in T-OBS) or a full date-time (6 and 12.96 GHz maps)
  const d = String(header['DATE-OBS'] ?? '');
  const time = d.includes('T') ? `${d.slice(0, 19)}Z` : d && header['T-OBS'] ? `${d}T${String(header['T-OBS']).slice(0, 8)}Z` : null;
  const disk = header.CDELT1 ? solarRadiusArcsec(time ? Date.parse(time) : Date.now()) / (Math.abs(header.CDELT1) * w) : null;
  const freq = Number(header.FREQUENC) || null;
  // smoothed to the beam and binned 2×2 to 256×256: the CLEAN residual pits read as speckle at full sampling and the
  // binned map keeps all the resolution the beam has. 3 GHz: σ = 2.5 px = 12″ (the beam's minor axis is ~24″); the
  // beam shrinks as 1/f, so σ = 2.5 px × 3 GHz / f, at least 1 px (4.9″)
  const s = blur(top, w, Math.max(1, (2.5 * 3000) / (freq ?? 3000))), half = w >> 1, bin = new Float32Array(half * half);
  for (let y = 0; y < half; y++) for (let x = 0; x < half; x++) bin[y * half + x] = (s[2 * y * w + 2 * x] + s[2 * y * w + 2 * x + 1] + s[(2 * y + 1) * w + 2 * x] + s[(2 * y + 1) * w + 2 * x + 1]) / 4;
  // log scale, 3×10³–3×10⁵ K by default (3 and 6 GHz). The 12.96 GHz maps sit on a ~7×10³ K CLEAN plateau filling the
  // imaged square around the disc (the quiet disc is ~2×10⁴ K there), so that feed uses 8×10³–10⁵ K: the plateau dark
  return { png: tbPng(bin, half, half, lo, hi), disk, time, freq };
}
/**
 * Is this SRH map usable? Early and late in Badary's day (low Sun) the CLEAN maps can fail: a negative or flat disc.
 * Usable: the inner disc (r < 0.8 R☉) averages 3,000–200,000 K and the sky beyond 1.4 R☉ is under a third of it.
 */
export function srhUsable(fits) {
  const { header, w, h, data } = parseFits(fits);
  const R = solarRadiusArcsec(Date.now()) / Math.abs(header.CDELT1 || 4.9), cx = (header.CRPIX1 ?? w / 2) - 1, cy = (header.CRPIX2 ?? h / 2) - 1;
  let d = 0, nd = 0, s = 0, ns = 0;
  for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) {
    const r = Math.hypot(x - cx, y - cy) / R, v = data[y * w + x];
    if (!Number.isFinite(v)) continue;
    if (r < 0.8) { d += v; nd++; } else if (r > 1.4) { s += Math.abs(v); ns++; }
  }
  const disc = d / Math.max(1, nd), sky = s / Math.max(1, ns);
  return disc > 3000 && disc < 2e5 && sky < disc / 3;
}
/** Today's (or the last two days') SRH map at `mhz` (a key of SRH_ARRAYS) nearest Badary's local noon (04:00 UT) that passes srhUsable. */
export const srhFeed = (credit, mhz = 3000, scale = {}) => ({
  type: 'image', ttl: 60 * 60000, credit,
  async get() {
    const base = `${SRH_ROOT}/${SRH_ARRAYS[mhz]}/cleanMaps`;
    for (let back = 0; back <= 2; back++) {
      const day = new Date(Date.now() - back * 86400000).toISOString().slice(0, 10).replaceAll('-', '');
      const list = await fetch(`${base}/${day}/`, { headers: UA, signal: AbortSignal.timeout(60000) }).catch(() => null);
      if (!list?.ok) continue;
      const names = srhMapNames(await list.text(), mhz);
      for (const name of names.sort((a, b) => Math.abs(srhHour(a) - 4) - Math.abs(srhHour(b) - 4)).slice(0, 4)) {
        const res = await fetch(`${base}/${day}/${name}`, { headers: UA, signal: AbortSignal.timeout(90000) }).catch(() => null);
        if (!res?.ok) continue;
        const fits = Buffer.from(await res.arrayBuffer());
        try { if (!srhUsable(fits)) continue; } catch { continue; } // a truncated or odd file: try the next
        const out = srhToPng(fits, scale);
        return { body: out.png, type: 'image/png', time: out.time, disk: out.disk, credit: `${credit} · ${out.time ?? name}` };
      }
    }
    throw new Error(`no usable SRH ${mhz / 1000} GHz map in the last three days`);
  },
});

// ---- the modelled disc as a feed ---------------------------------------------------------------
/** Today's F10.7 (sfu) and RSTN readings from NOAA SWPC: { f107, f107Time, rstn: [[MHz, sfu]], rstnTime, station }. */
export async function radioInputs() {
  const get = async (u) => { const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(45000) }); if (!r.ok) throw new Error(`SWPC HTTP ${r.status}`); return r.json(); };
  const f = await get('https://services.swpc.noaa.gov/json/f107_cm_flux.json');
  const last = f.filter((r) => r.flux > 0).sort((a, b) => String(a.time_tag).localeCompare(String(b.time_tag))).at(-1);
  let rstn = [], rstnTime = null, station = null;
  try {
    const rows = await get('https://services.swpc.noaa.gov/json/solar-radio-flux.json');
    // the newest report per frequency (good quality only), any station
    const best = new Map();
    for (const r of rows) for (const d of r.details ?? []) {
      if (!(d.flux > 0) || !/good/i.test(d.observed_quality ?? '')) continue;
      const b = best.get(d.frequency);
      if (!b || String(r.time_tag) > b.time) best.set(d.frequency, { sfu: d.flux, time: String(r.time_tag), station: r.common_name });
    }
    rstn = [...best].map(([mhz, b]) => [mhz, b.sfu, b.time, b.station]);
    const newest = [...best.values()].sort((a, b) => b.time.localeCompare(a.time))[0];
    rstnTime = newest?.time ?? null; station = newest?.station ?? null;
  } catch { /* RSTN optional: F10.7 alone */ }
  if (!last) throw new Error('no F10.7 value');
  return { f107: last.flux, f107Time: last.time_tag, rstn, rstnTime, station };
}

/** A feed of the modelled disc at f GHz; `inputs()` gives the SWPC values, `magnetogram()` the HMI image { body, time, disk }. */
export const sunModelFeed = (fGHz, label, { inputs = radioInputs, magnetogram } = {}) => ({
  type: 'image', ttl: 3 * 60 * 60000, predicted: true,
  credit: `MODELLED · PREDICTED solar ${label} disc (USS Fidelity model: Zirin et al. 1991 quiet Sun, limb from Shibasaki et al. 2011, active regions from SDO HMI, total from NOAA SWPC F10.7/RSTN)`,
  async get() {
    const inp = await inputs();
    let mag = null, magTime = null;
    try { const m = await magnetogram(); mag = { ...decodePng(m.body), disk: m.disk }; magTime = m.time; } catch { /* no magnetogram: no regions placed */ }
    const d = modelDisc(fGHz, { f107: inp.f107, rstn: inp.rstn, mag });
    const rstnUsed = d.from === 'rstn' ? inp.rstn.find((r) => r[0] === d.at) : null;
    const credit = `MODELLED · PREDICTED solar ${label} disc, not an observation. Inputs: F10.7 = ${Math.round(inp.f107)} sfu (DRAO via NOAA SWPC, ${String(inp.f107Time).slice(0, 10)})`
      + (rstnUsed ? `; whole-disc flux ${rstnUsed[1]} sfu at ${rstnUsed[0]} MHz (USAF RSTN ${rstnUsed[3]}, ${String(rstnUsed[2]).slice(0, 16)} UT) sets the total` : '; total from F10.7 (excess ∝ f)')
      + `; active regions placed from the SDO HMI magnetogram of ${magTime ? magTime.slice(0, 16).replace('T', ' ') + ' UT' : '— (unavailable: none placed)'}`
      + `; quiet Sun ${Math.round(d.quietTb).toLocaleString('en')} K (Zirin, Baumert & Hurford 1991), limb from Shibasaki et al. 2011. Disc mean ${Math.round(d.meanTb).toLocaleString('en')} K, ${d.sfu.toFixed(0)} sfu.`;
    return { body: tbPng(d.tb, d.size, d.size), type: 'image/png', time: magTime ?? new Date().toISOString(), disk: d.disk, credit };
  },
});

// ---- PNG decoding (dependency-free): 8-bit grey / RGB / palette / grey+alpha / RGBA, Adam7 or not ----
const ADAM7 = [[0, 0, 8, 8], [4, 0, 8, 8], [0, 4, 4, 8], [2, 0, 4, 4], [0, 2, 2, 4], [1, 0, 2, 2], [0, 1, 1, 2]];
/** Decode a PNG to { w, h, rgba: Uint8Array (w×h×4, top row first) }. */
export function decodePng(buf) {
  if (!Buffer.from(buf.subarray(0, 8)).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error('not a PNG');
  let off = 8, w = 0, h = 0, depth = 0, type = 0, interlace = 0, plte = null, trns = null;
  const idat = [];
  while (off + 8 <= buf.length) {
    const n = buf.readUInt32BE(off), t = buf.toString('latin1', off + 4, off + 8), d = buf.subarray(off + 8, off + 8 + n);
    if (t === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); depth = d[8]; type = d[9]; interlace = d[12]; }
    else if (t === 'PLTE') plte = d; else if (t === 'tRNS') trns = d; else if (t === 'IDAT') idat.push(d); else if (t === 'IEND') break;
    off += 12 + n;
  }
  if (depth !== 8) throw new Error(`PNG bit depth ${depth} not supported`);
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type];
  if (!ch) throw new Error(`PNG colour type ${type} not supported`);
  const raw = zlib.inflateSync(Buffer.concat(idat)), rgba = new Uint8Array(w * h * 4);
  let at = 0;
  const pass = (x0, y0, dx, dy) => {
    const pw = Math.ceil((w - x0) / dx), ph = Math.ceil((h - y0) / dy);
    if (pw <= 0 || ph <= 0) return;
    const stride = pw * ch;
    let prev = new Uint8Array(stride);
    for (let r = 0; r < ph; r++) {
      const f = raw[at++], line = new Uint8Array(raw.subarray(at, at + stride));
      at += stride;
      for (let i = 0; i < stride; i++) {
        const a = i >= ch ? line[i - ch] : 0, b = prev[i], c = i >= ch ? prev[i - ch] : 0;
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        const pred = f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1 : f === 4 ? (pa <= pb && pa <= pc ? a : pb <= pc ? b : c) : 0;
        line[i] = (line[i] + pred) & 255;
      }
      for (let x = 0; x < pw; x++) {
        const o = ((y0 + r * dy) * w + x0 + x * dx) * 4, s = x * ch;
        if (type === 0 || type === 4) { rgba[o] = rgba[o + 1] = rgba[o + 2] = line[s]; rgba[o + 3] = type === 4 ? line[s + 1] : 255; }
        else if (type === 2 || type === 6) { rgba[o] = line[s]; rgba[o + 1] = line[s + 1]; rgba[o + 2] = line[s + 2]; rgba[o + 3] = type === 6 ? line[s + 3] : 255; }
        else { const k = line[s]; rgba[o] = plte[k * 3]; rgba[o + 1] = plte[k * 3 + 1]; rgba[o + 2] = plte[k * 3 + 2]; rgba[o + 3] = trns && k < trns.length ? trns[k] : 255; }
      }
      prev = line;
    }
  };
  if (interlace) for (const p of ADAM7) pass(...p); else pass(0, 0, 1, 1);
  return { w, h, rgba };
}
