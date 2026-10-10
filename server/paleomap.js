// Past coastlines (#54): continental outlines reconstructed to `time` million years ago by the GPlates
// Web Service (Müller et al. 2019 plate model), cached for a year. https://gws.gplates.org

import { cached } from './cache.js';

/** GeoJSON polygons of the coastlines at `ma` million years ago (whole numbers 1–250). */
export async function paleoCoastlines(maText) {
  const ma = Number(maText);
  if (!Number.isInteger(ma) || ma < 1 || ma > 250) throw Object.assign(new Error('time must be a whole number of Ma, 1–250'), { status: 400 });
  const r = await cached('paleomap', `muller2019-${ma}`, 365 * 86400000, async () => {
    const res = await fetch(`https://gws.gplates.org/reconstruct/coastlines/?time=${ma}&model=MULLER2019`, { headers: { 'user-agent': 'USS-Fidelity/0.3 (local astronomy explorer)' }, signal: AbortSignal.timeout(120000) });
    if (!res.ok) throw new Error(`GPlates HTTP ${res.status}`);
    const j = await res.json();
    // keep the rings only, rounded to 0.01° (about 1 km): enough for a 0.25° globe layer
    return j.features.filter((f) => f.geometry?.type === 'Polygon').map((f) => f.geometry.coordinates.map((ring) => ring.map(([lo, la]) => [Math.round(lo * 100) / 100, Math.round(la * 100) / 100])));
  });
  return { ma, model: 'Müller et al. 2019 (GPlates Web Service)', fetched: new Date(r.storedAt).toISOString(), polygons: r.value };
}
