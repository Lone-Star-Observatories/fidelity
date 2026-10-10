// Stellar spectra: the Pickles (1998, PASP 110, 863) UVKLIB library of 131 observed,
// flux-calibrated spectra spanning O5 to M10 and luminosity classes I–V, from the STScI
// CDBS reference atlas. Downloaded once, indexed by the spectral type in each FITS header,
// resampled and cached as JSON in data/catalogs/pickles.json.

import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.js';
import { closestTemplate } from '../src/astro/spectral.js';

const BASE = 'https://archive.stsci.edu/hlsps/reference-atlases/cdbs/grid/pickles/dat_uvk/pickles_uk_';
const COUNT = 131;
const GRID = { from: 300, to: 2500, step: 2 }; // nm

/** Minimal FITS reader for these files: header cards + a BINTABLE of (λ Å, flux) float32 pairs. */
export function parsePicklesFits(buf) {
  const cards = [];
  let off = 0, hdu = 0, rows = 0, width = 0;
  for (;;) {
    const block = buf.subarray(off, off + 2880).toString('latin1');
    off += 2880;
    let end = false;
    for (let i = 0; i < 2880; i += 80) {
      const c = block.slice(i, i + 80);
      if (hdu === 0) cards.push(c);
      if (hdu === 1 && c.startsWith('NAXIS2')) rows = parseInt(c.split('=')[1], 10);
      if (hdu === 1 && c.startsWith('NAXIS1')) width = parseInt(c.split('=')[1], 10);
      if (c.startsWith('END') && c.slice(3).trim() === '') { end = true; break; }
    }
    if (!end) continue;
    if (hdu === 1) break;
    hdu++;
  }
  const type = (cards.find((c) => c.includes('spectral type:')) || '').match(/spectral type:\s*([^']+)/)?.[1]?.trim() ?? null;
  const metal = (cards.find((c) => c.includes('metallicity:')) || '').match(/metallicity:\s*([^']+)/)?.[1]?.trim() ?? null;
  const wl = new Float64Array(rows), fx = new Float64Array(rows);
  for (let r = 0; r < rows; r++) {
    wl[r] = buf.readFloatBE(off + r * width);
    fx[r] = buf.readFloatBE(off + r * width + 4);
  }
  return { type, metallicity: metal, wavelengthA: wl, flux: fx };
}

/** Linear resample onto the nm grid, normalised so the peak is 1. */
function resample({ wavelengthA, flux }) {
  const out = [];
  let j = 0, peak = 0;
  for (let nm = GRID.from; nm <= GRID.to; nm += GRID.step) {
    const a = nm * 10;
    while (j < wavelengthA.length - 2 && wavelengthA[j + 1] < a) j++;
    const t = (a - wavelengthA[j]) / (wavelengthA[j + 1] - wavelengthA[j]);
    const v = Math.max(0, flux[j] + (flux[j + 1] - flux[j]) * Math.min(1, Math.max(0, t)));
    out.push(v);
    if (v > peak) peak = v;
  }
  return out.map((v) => +(v / peak).toFixed(4));
}

// ---- library ----------------------------------------------------------------------------

let libraryPromise = null;

export function library() {
  libraryPromise ??= (async () => {
    const file = path.join(config.dataDir, 'catalogs', 'pickles.json');
    try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { /* build */ }
    const entries = [];
    const ids = Array.from({ length: COUNT }, (_, i) => i + 1);
    for (let k = 0; k < ids.length; k += 8) { // 8 at a time, politely
      await Promise.all(ids.slice(k, k + 8).map(async (n) => {
        const res = await fetch(`${BASE}${n}.fits`, { signal: AbortSignal.timeout(60000) });
        if (!res.ok) throw new Error(`Pickles ${n}: HTTP ${res.status}`);
        const parsed = parsePicklesFits(Buffer.from(await res.arrayBuffer()));
        entries.push({ n, type: parsed.type, metallicity: parsed.metallicity, flux: resample(parsed) });
      }));
    }
    entries.sort((a, b) => a.n - b.n);
    const lib = { source: 'Pickles 1998, PASP 110, 863 (UVKLIB), via STScI CDBS', grid: GRID, entries };
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify(lib));
    return lib;
  })().catch((err) => { libraryPromise = null; throw err; });
  return libraryPromise;
}

/** The best-matching observed template spectrum for a spectral type. */
export async function spectrumFor(type, metallicity) {
  if (!type || type.length > 24) throw Object.assign(new Error('spectral type required'), { status: 400 });
  const lib = await library();
  const t = closestTemplate(lib.entries, type, metallicity == null || metallicity === '' ? null : Number(metallicity));
  if (!t) throw Object.assign(new Error(`no template for ${type}`), { status: 404 });
  return { requested: type, template: t.type, templateMetallicity: t.metallicity, exact: t.score < 0.6, grid: lib.grid, flux: t.flux, source: lib.source };
}
