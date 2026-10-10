// GET /api/star-search?q= (#63): stars and exoplanets in the Navigation catalogue by any
// designation — proper name, Bayer (α Cen, Alpha Cen, Alpha Centauri), Flamsteed (61 Cyg),
// Gliese, HIP, HD — and exoplanets by name (Proxima b, TRAPPIST-1 e). The index is built once
// from the loaded catalogue; answers are memoised per query.

import { catalog } from './stars.js';
import { indexEntries, search, fold } from '../src/data/search.js';

const LY_PER_PC = 3.261563777;
let indexPromise = null;
const memo = new Map();

function buildIndex(cat) {
  const entries = [];
  for (const s of cat.stars) {
    const p = cat.planetsOf.get(s.id);
    const distLy = s.distPc * LY_PER_PC;
    entries.push({
      kind: p ? 'exoplanet host' : 'star', id: s.id, name: s.name, aliases: [...(s.alt ?? []), ...(p ? [p.host.hostname] : [])],
      system: s.id, distLy: +distLy.toFixed(2), planets: p ? p.planets.length : 0, spect: s.spect ?? null,
      // nearer, named and planet-hosting stars first among equal matches
      boost: (s.alt?.[0] && s.alt[0] === s.name && !/^(HIP|HD|Gl|GJ) /.test(s.name) ? 3 : 0) + (p ? 2 : 0) + (distLy < 20 ? 2 : distLy < 100 ? 1 : 0),
    });
    if (p) for (const pl of p.planets) entries.push({
      kind: 'exoplanet', id: `${s.id}:${pl.pl_letter ?? pl.pl_name}`, name: pl.pl_name,
      aliases: pl.pl_letter ? [s.name, ...(s.alt ?? []).filter((x) => !/^(HIP|HD) /.test(x))].map((x) => `${x} ${pl.pl_letter}`) : [],
      system: s.id, host: s.name, body: (pl.pl_letter || pl.pl_name).toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      distLy: +distLy.toFixed(2), year: pl.disc_year ?? null, boost: distLy < 50 ? 1 : 0,
    });
  }
  return indexEntries(entries);
}

export async function starSearch(q) {
  const key = fold(q);
  if (key.length < 2) return { q, hits: [] };
  if (memo.has(key)) return memo.get(key);
  indexPromise ??= catalog().then(buildIndex).catch((err) => { indexPromise = null; throw err; });
  const index = await indexPromise;
  const hits = search(index, q, { limit: 24 }).map(({ _keys, boost, ...h }) => h);
  const out = { q, hits, source: 'HYG v4.4 designations + NASA Exoplanet Archive' };
  if (memo.size > 500) memo.delete(memo.keys().next().value);
  memo.set(key, out);
  return out;
}
