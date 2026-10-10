// UCS Satellite Database (Union of Concerned Scientists): purpose, operator, users, contractor,
// launch mass, power and expected lifetime for ~7,500 satellites, joined to SATCAT by NORAD id.
// The 1 May 2023 edition is the last one UCS published, so satellites launched later have no
// record. https://www.ucs.org/resources/satellite-database (tab-separated text, Latin-1).

import { cached } from './cache.js';

const URL = 'https://www.ucs.org/media/11493';
export const UCS_EDITION = '2023-05-01';
const YEAR = 365 * 86400000;

// cells may be quoted ("2,710") and padded
const clean = (s) => String(s ?? '').replace(/^\s*"|"\s*$/g, '').replace(/\s+/g, ' ').trim();
const num = (s) => { const t = clean(s).replace(/,/g, ''); const v = Number(t); return t !== '' && Number.isFinite(v) ? v : null; };
const str = (s) => { const v = clean(s); return v && !/^(NR|N\/A)$/i.test(v) ? v : null; };
/** UCS dates are M/D/YY. */
function date(s) {
  const m = String(s ?? '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return null;
  const y = m[3].length === 2 ? (Number(m[3]) > 50 ? 1900 : 2000) + Number(m[3]) : Number(m[3]);
  return `${y}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
}

/** Parse the UCS tab-separated text into records keyed by NORAD id. */
export function parseUcs(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const head = lines[0].split('\t').map((h) => h.replace(/"/g, '').trim());
  const col = (name) => head.findIndex((h) => h.toLowerCase().startsWith(name.toLowerCase()));
  const c = {
    name: col('Name of Satellite'), official: col('Current Official Name'), unReg: col('Country/Org of UN'), country: col('Country of Operator'),
    operator: col('Operator/Owner'), users: col('Users'), purpose: col('Purpose'), detail: col('Detailed Purpose'), orbitClass: col('Class of Orbit'),
    orbitType: col('Type of Orbit'), geoLon: col('Longitude of GEO'), launchMass: col('Launch Mass'), dryMass: col('Dry Mass'), power: col('Power'),
    launched: col('Date of Launch'), lifetime: col('Expected Lifetime'), contractor: col('Contractor'), contractorCountry: col('Country of Contractor'),
    site: col('Launch Site'), vehicle: col('Launch Vehicle'), cospar: col('COSPAR'), norad: col('NORAD'), comments: col('Comments'),
  };
  const firstSource = head.findIndex((h) => h === 'Source');
  const out = {};
  for (const line of lines.slice(1)) {
    const f = line.split('\t');
    const norad = num(f[c.norad]);
    if (!norad) continue;
    const links = [...new Set(f.slice(firstSource).map((s) => s.trim()).filter((s) => /^https?:\/\//.test(s)))].slice(0, 4);
    out[norad] = {
      name: str(f[c.name]), official: str(f[c.official]), countryUn: str(f[c.unReg]), country: str(f[c.country]), operator: str(f[c.operator]),
      users: str(f[c.users]), purpose: str(f[c.purpose]), detail: str(f[c.detail]), orbitClass: str(f[c.orbitClass]), orbitType: str(f[c.orbitType]),
      geoLonDeg: num(f[c.geoLon]) || null, launchMassKg: num(f[c.launchMass]), dryMassKg: num(f[c.dryMass]), powerW: num(f[c.power]),
      launched: date(f[c.launched]), lifetimeYears: num(f[c.lifetime]), contractor: str(f[c.contractor]), contractorCountry: str(f[c.contractorCountry]),
      site: str(f[c.site]), vehicle: str(f[c.vehicle]), cospar: str(f[c.cospar]), comments: str(f[c.comments]), links,
    };
  }
  return out;
}

/** All UCS records by NORAD id (downloaded once, kept a year: the database is no longer updated). */
export async function ucsDatabase() {
  const { value } = await cached('ucs', `satellites-v2-${UCS_EDITION}`, YEAR, async () => {
    const res = await fetch(URL, { headers: { 'user-agent': 'USS-Fidelity/0.3 (local astronomy explorer)' }, signal: AbortSignal.timeout(120000) });
    if (!res.ok) throw new Error(`UCS HTTP ${res.status}`);
    const text = new TextDecoder('latin1').decode(await res.arrayBuffer());
    return { edition: UCS_EDITION, source: 'UCS Satellite Database (Union of Concerned Scientists)', records: parseUcs(text) };
  });
  return value;
}

/** One satellite's UCS record, or null when it has none. */
export async function ucsRecord(norad) {
  const db = await ucsDatabase();
  return db.records[norad] ? { ...db.records[norad], edition: db.edition, source: db.source } : null;
}
