// Atmospheric CO₂ at Mauna Loa (#54): NOAA GML monthly means (the Keeling curve, 1958–), cached a day.
//   https://gml.noaa.gov/ccgg/trends/data.html (co2_mm_mlo.txt: year, month, decimal date, monthly
//   mean, de-seasonalized, days, st.dev of days, uncertainty of the monthly mean; −99.99 = missing).

import { cached } from './cache.js';

const URL = 'https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_mm_mlo.txt';

/** The NOAA text → [[decimal year, ppm, de-seasonalized ppm], …]. */
export function parseCo2(text) {
  const out = [];
  for (const line of String(text).split('\n')) {
    if (line.startsWith('#')) continue;
    const f = line.trim().split(/\s+/).map(Number);
    if (f.length >= 5 && f[3] > 0) out.push([f[2], f[3], f[4] > 0 ? f[4] : null]);
  }
  return out;
}

export async function co2() {
  const r = await cached('co2', 'mlo-monthly', 86400000, async () => {
    const res = await fetch(URL, { headers: { 'user-agent': 'USS-Fidelity/0.3 (local astronomy explorer)' }, signal: AbortSignal.timeout(60000) });
    if (!res.ok) throw new Error(`NOAA GML HTTP ${res.status}`);
    return parseCo2(await res.text());
  });
  return { source: 'NOAA GML, Mauna Loa monthly means', url: 'https://gml.noaa.gov/ccgg/trends/', fetched: new Date(r.storedAt).toISOString(), cache: r.cache, rows: r.value };
}
