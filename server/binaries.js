// Visual binary orbits: the USNO/GSU Sixth Catalog of Orbits of Visual Binary Stars (ORB6,
// Hartkopf, Mason & Worley). Downloaded once into data/catalogs/ and refreshed monthly.
// https://www.astro.gsu.edu/wds/orb6.html

import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.js';

const ORB6_URL = 'https://www.astro.gsu.edu/wds/orb6/orb6orbits.txt';
const MONTH = 30 * 86400000;

const col = (l, a, b) => l.slice(a - 1, b).trim();
const num = (s) => (s === '' || s === '.' ? null : Number(s));

/** Parse one ORB6 data line (fixed columns, see orb6format.txt). Returns null if unusable. */
export function parseOrb6Line(l) {
  if (l.length < 215 || !/^\d{6}/.test(l)) return null;
  let P = num(col(l, 82, 92)); const pUnit = col(l, 93, 93);
  let a = num(col(l, 106, 114)); const aUnit = col(l, 115, 115);
  let T = num(col(l, 163, 174)); const tUnit = col(l, 175, 175);
  const i = num(col(l, 126, 133)), node = num(col(l, 144, 151)), e = num(col(l, 188, 195)), omega = num(col(l, 206, 213));
  if ([P, a, T, i, node, e, omega].some((v) => v == null || !Number.isFinite(v))) return null;
  P = pUnit === 'd' ? P / 365.25 : pUnit === 'c' ? P * 100 : P; // → years
  a = aUnit === 'm' ? a / 1000 : aUnit === 'M' ? a * 60 : aUnit === 'u' ? a / 1e6 : a; // → arcsec
  // → Besselian year
  if (tUnit === 'd') T = 1900 + (T + 2400000 - 2415020.31352) / 365.242198781;
  else if (tUnit === 'm') T = 1900 + (T + 2400000.5 - 2415020.31352) / 365.242198781;
  else if (tUnit === 'c') T *= 100;
  const ra = col(l, 1, 9), dec = col(l, 10, 18);
  return {
    wds: col(l, 20, 29),
    designation: col(l, 31, 44),
    components: (col(l, 31, 44).match(/([A-Z][a-z]?(?:,[A-Z][a-z]?)?|[A-Z]{2,3})$/) || [''])[0].replace(',', ''),
    hd: num(col(l, 52, 57)), hip: num(col(l, 59, 64)),
    v1: num(col(l, 67, 71)), v2: num(col(l, 74, 78)),
    raDeg: (Number(ra.slice(0, 2)) + Number(ra.slice(2, 4)) / 60 + Number(ra.slice(4)) / 3600) * 15,
    decDeg: (dec[0] === '-' ? -1 : 1) * (Number(dec.slice(1, 3)) + Number(dec.slice(3, 5)) / 60 + Number(dec.slice(5)) / 3600),
    periodYears: P, aArcsec: a, i, node, periastronYear: T, e, omega,
    grade: num(col(l, 234, 234)), ref: col(l, 238, 245),
  };
}

export function parseOrb6(text) {
  return text.split(/\r?\n/).map(parseOrb6Line).filter(Boolean);
}

let orbitsPromise = null;

/** All ORB6 orbits (cached on disk). */
export function orbits() {
  orbitsPromise ??= (async () => {
    const file = path.join(config.dataDir, 'catalogs', 'orb6orbits.txt');
    let text = null;
    try {
      const st = await fs.stat(file);
      if (Date.now() - st.mtimeMs < MONTH) text = await fs.readFile(file, 'latin1');
    } catch { /* download */ }
    if (!text) {
      try {
        const res = await fetch(ORB6_URL, { signal: AbortSignal.timeout(60000) });
        if (!res.ok) throw new Error(`ORB6 HTTP ${res.status}`);
        text = Buffer.from(await res.arrayBuffer()).toString('latin1');
        await fs.mkdir(path.dirname(file), { recursive: true });
        await fs.writeFile(file, text, 'latin1');
      } catch (err) {
        text = await fs.readFile(file, 'latin1').catch(() => { throw err; }); // stale copy beats nothing
      }
    }
    return parseOrb6(text);
  })().catch((err) => { orbitsPromise = null; throw err; });
  return orbitsPromise;
}

// Measured component masses (M☉) and properties for well-studied systems, keyed by WDS
// designation and component letter, so hierarchical systems (α Cen A+B with C around the
// pair) split their centres of mass correctly. Everything else falls back to estimates.
export const MEASURED = {
  '06451-1643': { ref: 'Bond et al. 2017', mass: { A: 2.063, B: 1.018 },
    props: { A: { radiusSun: 1.711, teff: 9940 }, B: { radiusSun: 0.0084, teff: 25000, spect: 'DA2', whiteDwarf: true } } },
  '07393+0514': { ref: 'Bond et al. 2015', mass: { A: 1.478, B: 0.592 },
    props: { A: { radiusSun: 2.048, teff: 6530 }, B: { radiusSun: 0.01232, teff: 7740, spect: 'DQZ', whiteDwarf: true } } },
  '14396-6050': { ref: 'Akeson et al. 2021; Kervella et al. 2017', mass: { A: 1.0788, B: 0.9092, C: 0.1221 },
    props: { A: { radiusSun: 1.2175, teff: 5790 }, B: { radiusSun: 0.8591, teff: 5178 }, C: { radiusSun: 0.1542, teff: 2900 } } },
  // Luhman 16 AB: astrometric masses (Lazorenko & Sahlmann 2018) in M☉; ORB6 orbit Bedin et al. 2024.
  '10493-5319': { ref: 'Lazorenko & Sahlmann 2018; Bedin et al. 2024', mass: { A: 34.2 / 1047.57, B: 27.9 / 1047.57 },
    props: { A: { radiusSun: 0.1, teff: 1350, spect: 'L7.5', brownDwarf: true, massJup: 34.2 },
      B: { radiusSun: 0.1, teff: 1210, spect: 'T0.5', brownDwarf: true, massJup: 27.9,
        note: 'Weather has been mapped on it: patchy clouds that change within hours (Crossfield et al. 2014, Doppler imaging).' } } },
  '18055+0230': { ref: 'Eggenberger et al. 2008', mass: { A: 0.89, B: 0.73 } },
  '21069+3845': { ref: 'Kervella et al. 2008', mass: { A: 0.70, B: 0.63 } },
};

/** The two component letters of an orbit, e.g. 'AB' → ['A','B'], 'AaAb' → ['Aa','Ab']. */
export function componentLetters(components) {
  const parts = (components || '').match(/[A-Z][a-z]?/g) || [];
  if (parts.length >= 2) return [parts[0], parts[1]];
  if (parts.length === 1) return [`${parts[0]}a`, `${parts[0]}b`]; // e.g. 'A' = an orbit within A
  return ['A', 'B'];
}
