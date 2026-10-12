// ELEVATION section of a body's panel (#80): which measured DEM draws the relief, its resolution,
// range and reference surface, the height under the cursor (live), and the RELIEF control
// (OFF · TRUE · ×2 … ×20, exaggerations labelled as such). Bodies without a DEM say so.

import { demMeta, demIndex, NO_DEM } from '../data/dem.js';
import { RELIEF_MODES, fmtElevation, reliefLabel } from '../astro/dem.js';
import { SHAPES } from '../data/shapes.js';

const GIANTS = new Set(['jupiter', 'saturn', 'uranus', 'neptune']);
const solid = (b) => !b.marker && !GIANTS.has(b.id) && !(b.starLike || b.kind === 'star' || b.kind === 'spacecraft' || b.kind === 'satellite' || b.kind === 'region' || b.kind === 'lagrange point' || b.kind === 'comet');
const km = (x) => (x >= 10 ? `${Math.round(x)} KM` : x >= 1 ? `${x.toFixed(1)} KM` : `${Math.round(x * 1000)} M`);

export function createElevationPanel({ h, pill, row, settings, isStandalone }) {
  let cursorDd = null, cursorFor = null;

  /** The section for body `b` of a Sol model, or []. */
  function section(b, rerender) {
    cursorDd = null; cursorFor = null;
    if (!solid(b)) return [];
    const meta = demMeta(b.id);
    const dl = h('dl');
    if (!meta) {
      if (!demIndexLoaded) { demIndex().then(() => { demIndexLoaded = true; rerender?.(); }); }
      if (SHAPES[b.id]) {
        row(dl, 'ELEVATION MODEL', 'NONE · 3D SHAPE MODEL INSTEAD', 'measured', 'This body is drawn with its measured 3D shape (see the shape credit); no separate elevation grid.');
      } else if (isStandalone) {
        row(dl, 'ELEVATION MODEL', 'NOT IN THIS PREVIEW', 'computed', 'The offline preview leaves the elevation models out to stay under its size budget; run `npm start` for relief.');
      } else {
        row(dl, 'ELEVATION MODEL', 'NO ELEVATION DATA', 'computed', NO_DEM[b.id] ?? 'No global digital elevation model has been published for this body: drawn as a smooth sphere.');
      }
      return [h('h3', { textContent: 'ELEVATION' }), dl,
        h('p', { className: 'note', textContent: NO_DEM[b.id] ?? (SHAPES[b.id] ? 'The shape model carries its relief.' : 'The globe is a smooth sphere: no height data to draw.') })];
    }
    row(dl, 'ELEVATION MODEL', meta.name.toUpperCase(), 'measured', `${meta.instrument}. ${meta.credit}. ${meta.licence}.`);
    const zmax = Math.max(0, Math.floor(Math.log2((meta.sourcePpd * 90) / 256))), tileKm = (2 * Math.PI * meta.refRadiusKm * (90 / 2 ** zmax / 256)) / 360;
    row(dl, 'GRID', `${(360 / meta.width).toFixed(2)}° · ${km(meta.cellKm)} CELLS`, 'computed', `Box-averaged from the ${meta.sourcePpd} px/° source to ${meta.width} × ${meta.height} for the globe (public/dem/${meta.file}, ${(meta.bytes / 1e6).toFixed(1)} MB). Close up and in the surface view, tiles down to ${km(tileKm)} cells come from the local backend (/api/dem-tile).`);
    row(dl, 'RANGE', `${fmtElevation(meta.min, { km: true })} … ${fmtElevation(meta.max, { km: true })}`, 'measured', `Lowest and highest grid cells, metres above the ${meta.ref}. Single points reach further (cells average them).`);
    row(dl, 'ZERO', meta.ref.toUpperCase(), 'measured', 'The reference surface the heights are measured from.');
    if (meta.partial) row(dl, 'COVERAGE', `${Math.round(meta.coverage * 100)}% OF THE SURFACE`, 'measured', meta.partial);
    cursorDd = row(dl, 'AT CURSOR', 'HOVER THE GLOBE', 'measured', `Height under the pointer from ${meta.name}, interpolated from the finest grid loaded.`);
    cursorFor = b.id;
    const cur = settings.get('relief') ?? 'true';
    const pills = h('div', { className: 'body-list relief-modes' }, ...RELIEF_MODES.map((m) => {
      const p = pill(m.label, () => { settings.set('relief', m.id); rerender?.(); });
      p.classList.toggle('on', m.id === cur);
      p.title = m.k === 0 ? 'A smooth sphere' : m.k === 1 ? 'True heights' : `Heights multiplied by ${m.k}: exaggerated`;
      return p;
    }));
    const notes = [
      `RELIEF · ${reliefLabel(cur)}. Lighting follows the terrain at every distance (a normal map derived from the heights); close up the ground itself rises and falls${cur === 'off' ? '' : ', and the surface view stands on it'}.`,
      b.id === 'venus' ? 'Venus\' clouds hide its ground: the globe shows the cloud tops, so the relief appears only in the surface view and in the height read-outs.' : null,
      b.id === 'earth' ? 'The ocean surface is drawn flat; read-outs give the sea floor (bathymetry).' : null,
      meta.partial ? `Partial: ${meta.partial} Where there is no data the globe stays a smooth sphere.` : null,
    ].filter(Boolean);
    return [h('h3', { textContent: 'ELEVATION' }), dl, h('div', { className: 'ctl-label', textContent: 'RELIEF' }), pills, ...notes.map((t) => h('p', { className: 'note', textContent: t }))];
  }
  let demIndexLoaded = false;

  /** Live read-out from the System View's pointer (null when off the globe). */
  function cursor(e) {
    if (!cursorDd?.isConnected) return;
    if (!e || e.id !== cursorFor) { cursorDd.textContent = 'HOVER THE GLOBE'; return; }
    const lat = `${Math.abs(e.lat).toFixed(2)}°${e.lat >= 0 ? 'N' : 'S'}`, lon = `${Math.abs(e.lon).toFixed(2)}°${e.lon >= 0 ? 'E' : 'W'}`;
    cursorDd.textContent = `${fmtElevation(e.h)} · ${lat} ${lon}${e.res && e.res !== 'global' ? ` · ${km(e.cellKm)} TILE` : ''}`;
  }

  return { section, cursor };
}
