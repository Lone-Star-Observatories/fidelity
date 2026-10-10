// Celestial events for the weekly feed (#32): eclipses, transits, occultations and alignments from
// the app's own ephemeris (src/astro/eclipses.js, so the feed and the views agree), meteor-shower
// peaks from IMO solar longitudes, bright comets from JPL SBDB, and aurora forecasts from NOAA SWPC.

import { solarEclipses, lunarEclipses, planetTransits, lunarOccultations, alignments, sunMoon, useEarthEphemeris, interpolateDaily } from '../../src/astro/eclipses.js';
import { heliocentric } from '../../src/astro/kepler.js';

const DEG = Math.PI / 180, AU = 149597870.7;
const iso = (jd) => new Date((jd - 2440587.5) * 86400000).toISOString().replace(/\.\d{3}Z$/, 'Z');
const jdOf = (ms) => ms / 86400000 + 2440587.5;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const NAMES = { mercury: 'Mercury', venus: 'Venus', mars: 'Mars', jupiter: 'Jupiter', saturn: 'Saturn', uranus: 'Uranus', neptune: 'Neptune', moon: 'the Moon' };
const nm = (id) => NAMES[id] ?? id;
const len = (v) => Math.hypot(v[0], v[1], v[2]);
const angle = (a, b) => Math.acos(Math.max(-1, Math.min(1, (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (len(a) * len(b)))));

/** Use JPL Horizons daily Earth vectors when the fetcher supplies them (≈10 s eclipse times instead of ~1 min). */
export async function useHorizonsEarth(monthlyVectors, fromJd, toJd) {
  const rows = [];
  const d = new Date((fromJd - 2440587.5) * 86400000), end = new Date((toJd - 2440587.5) * 86400000);
  for (let y = d.getUTCFullYear(), m = d.getUTCMonth(); y < end.getUTCFullYear() || (y === end.getUTCFullYear() && m <= end.getUTCMonth()); m === 11 ? (y++, m = 0) : m++) {
    try { rows.push(...(await monthlyVectors('399', `${y}-${String(m + 1).padStart(2, '0')}`)).value.points); } catch { return false; }
  }
  rows.sort((a, b) => a[0] - b[0]);
  const run = rows.filter((r, i) => i === 0 || r[0] !== rows[i - 1][0]);
  useEarthEphemeris((jd) => interpolateDaily(run, jd));
  return true;
}

/** Moon illumination (0–1) at UT `jd`. */
export function moonIllumination(jd) {
  const { sun, moon } = sunMoon(jd);
  return (1 - Math.cos(Math.PI - angle(sun, moon))) / 2;
}

const base = (o) => ({ category: 'celestial', status: 'computed', tier: 'computed', orgs: [], source: { name: 'Fidelity ephemeris (src/astro/eclipses.js)', url: 'https://github.com/Lone-Star-Observatories/fidelity/blob/main/src/astro/eclipses.js' }, ...o });
const decimate = (pts, n = 80) => { const k = Math.max(1, Math.ceil(pts.length / n)); return pts.filter((_, i) => i % k === 0 || i === pts.length - 1); };
const dur = (s) => (s >= 3600 ? `${Math.floor(s / 3600)} h ${Math.round((s % 3600) / 60)} min` : `${Math.floor(s / 60)} min ${Math.round(s % 60)} s`);

/** Eclipses, transits, occultations and alignments in [from, to] (JD, UT). */
export function ephemerisEvents(from, to, sunSource = 'kepler') {
  const acc = sunSource === 'horizons' ? 'Sun from JPL Horizons vectors (eclipse times ≈10 s)' : 'Sun from Standish elements (eclipse times ≈1 min)';
  const out = [];
  for (const e of solarEclipses(from, to)) {
    const centre = (e.path?.centre ?? []).filter(Boolean).map((g) => [+g.lat.toFixed(2), +g.lon.toFixed(2)]);
    out.push(base({ id: `solar-eclipse-${iso(e.greatest).slice(0, 10)}`, type: 'solar-eclipse', title: `${cap(e.kind)} solar eclipse`,
      description: `${cap(e.kind)} eclipse of the Sun, magnitude ${e.magnitude.toFixed(3)}${e.durationS ? `, ${e.kind === 'annular' ? 'annularity' : 'totality'} up to ${dur(e.durationS)}` : ''}. ${acc}.`,
      time: iso(e.greatest), start: e.contacts?.P1 ? iso(e.contacts.P1) : undefined, end: e.contacts?.P4 ? iso(e.contacts.P4) : undefined, precision: 'second',
      bodies: ['sun', 'moon', 'earth'], location: e.place ? { name: 'Greatest eclipse', lat: +e.place.lat.toFixed(2), lon: +e.place.lon.toFixed(2), body: 'earth', tier: 'computed' } : undefined,
      visibility: { kind: centre.length ? 'path' : 'region', note: centre.length ? `Path of ${e.kind === 'annular' ? 'annularity' : 'totality'}; partial across a much wider region.` : 'Partial eclipse only.', path: decimate(centre) },
      model: { kind: 'eclipse', phases: Object.entries(e.contacts ?? {}).filter(([, v]) => v).map(([k, v]) => ({ name: k, t: Math.round((v - e.greatest) * 86400) })) } }));
  }
  for (const e of lunarEclipses(from, to)) {
    out.push(base({ id: `lunar-eclipse-${iso(e.greatest).slice(0, 10)}`, type: 'lunar-eclipse', title: `${cap(e.kind)} lunar eclipse`,
      description: `${e.kind === 'penumbral' ? `Penumbral magnitude ${e.penumbralMagnitude.toFixed(3)}` : `Umbral magnitude ${e.magnitude.toFixed(3)}`}. Visible wherever the Moon is above the horizon. ${acc}.`,
      time: iso(e.greatest), start: iso(e.contacts.P1), end: iso(e.contacts.P4), precision: 'second', bodies: ['moon', 'earth', 'sun'],
      visibility: { kind: 'hemisphere', note: 'Night side of Earth at mid-eclipse (Moon above the horizon).' },
      model: { kind: 'eclipse', phases: Object.entries(e.contacts).filter(([, v]) => v).map(([k, v]) => ({ name: k, t: Math.round((v - e.greatest) * 86400) })) } }));
  }
  for (const e of planetTransits(from, to)) {
    out.push(base({ id: `transit-${e.body}-${iso(e.greatest).slice(0, 10)}`, type: 'transit', title: `Transit of ${nm(e.body)}`, time: iso(e.greatest),
      start: iso(e.contacts.C1), end: iso(e.contacts.C4), precision: 'minute', bodies: [e.body, 'sun'],
      description: `${nm(e.body)} crosses the Sun's disc, closest ${Math.round(e.separationArcsec)}″ from its centre. Never look at the Sun without a proper solar filter.`,
      visibility: { kind: 'hemisphere', note: 'Day side of Earth.' } }));
  }
  for (const e of lunarOccultations(from, Math.min(to, from + 97))) { // the next ~3 months: there are dozens a year
    out.push(base({ id: `occultation-${e.body.toLowerCase().replace(/[^a-z]+/g, '-')}-${iso(e.greatest).slice(0, 13)}`, type: 'occultation', title: `The Moon occults ${nm(e.body)}`,
      time: iso(e.greatest), precision: 'hour', bodies: ['moon', e.body.toLowerCase()], description: `The Moon passes in front of ${nm(e.body)} as seen from part of Earth (geocentric separation ${e.separationDeg.toFixed(2)}°). Exact region not computed here.`,
      visibility: { kind: 'region', note: 'Visible from a limited band of Earth.' } }));
  }
  for (const e of alignments(from, to)) {
    const type = e.kind === 'planetary parade' ? 'parade' : e.kind === 'greatest elongation' ? 'elongation' : e.kind;
    const title = e.kind === 'conjunction' ? `Conjunction: ${e.body.split('–').map(nm).join(' and ')}` : e.kind === 'planetary parade' ? `Planetary parade (${e.body.split(', ').length} planets)` : `${cap(e.kind)} of ${nm(e.body)}`;
    const desc = e.kind === 'conjunction' ? `${e.separationDeg.toFixed(2)}° apart in the sky.` : e.kind === 'greatest elongation' ? `${e.elongationDeg.toFixed(1)}° ${e.side} of the Sun: best placed to see it.`
      : e.kind === 'opposition' ? `Opposite the Sun, ${e.distanceAu.toFixed(2)} AU from Earth: up all night and at its brightest.` : `${e.body.split(', ').map(nm).join(', ')} within a ${Math.round(e.spanDeg)}° arc of sky, all more than 15° from the Sun.`;
    out.push(base({ id: `${type}-${e.body.toLowerCase().replace(/[^a-z]+/g, '-')}-${iso(e.greatest).slice(0, 10)}`, type, title, description: desc, time: iso(e.greatest),
      start: e.start ? iso(e.start) : undefined, end: e.end ? iso(e.end) : undefined, precision: e.kind === 'planetary parade' ? 'day' : 'hour',
      bodies: e.body.split(/–|, /), visibility: { kind: 'global', note: 'Naked eye or binoculars, weather permitting.' } }));
  }
  return out;
}

// IMO Meteor Shower Calendar: peak solar longitude (J2000), ZHR, radiant (RA, Dec), speed (km/s).
// Southern/northern visibility from the radiant declination.
export const SHOWERS = [
  ['QUA', 'Quadrantids', 283.15, 80, 230, 49, 41], ['LYR', 'Lyrids', 32.32, 18, 271, 34, 49], ['ETA', 'eta Aquariids', 45.5, 50, 338, -1, 66],
  ['SDA', 'Southern delta Aquariids', 127.0, 25, 340, -16, 41], ['PER', 'Perseids', 140.0, 100, 48, 58, 59], ['DRA', 'Draconids', 195.4, 10, 262, 54, 20],
  ['STA', 'Southern Taurids', 197.0, 5, 32, 9, 27], ['ORI', 'Orionids', 208.0, 20, 95, 16, 66], ['NTA', 'Northern Taurids', 230.0, 5, 58, 22, 29],
  ['LEO', 'Leonids', 235.27, 15, 152, 22, 71], ['GEM', 'Geminids', 262.2, 150, 112, 33, 35], ['URS', 'Ursids', 270.7, 10, 217, 76, 33],
];
/** Apparent geocentric solar longitude (deg, J2000 ecliptic) at UT `jd`. */
export const solarLongitude = (jd) => { const { sun } = sunMoon(jd); return ((Math.atan2(sun[1], sun[0]) / DEG) + 360) % 360; };
/** UT JD when the Sun reaches longitude `lambda` in [from, to] (first crossing), or null. */
export function whenSolarLongitude(lambda, from, to) {
  const diff = (jd) => ((solarLongitude(jd) - lambda + 540) % 360) - 180;
  for (let a = from; a < to; a += 1) {
    const b = Math.min(to, a + 1);
    if (diff(a) <= 0 && diff(b) > 0) {
      let lo = a, hi = b;
      for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (diff(m) <= 0) lo = m; else hi = m; }
      return (lo + hi) / 2;
    }
  }
  return null;
}
export function meteorShowers(from, to) {
  const out = [];
  for (const [code, name, lambda, zhr, ra, dec, v] of SHOWERS) {
    const jd = whenSolarLongitude(lambda, from, to);
    if (!jd) continue;
    const moon = Math.round(moonIllumination(jd) * 100);
    out.push(base({ id: `meteor-shower-${code.toLowerCase()}-${iso(jd).slice(0, 4)}`, type: 'meteor-shower', title: `${name} meteor shower peak`,
      description: `Peak at solar longitude ${lambda}° (IMO). ZHR ≈ ${zhr} under ideal dark skies; ${v} km/s meteors from RA ${ra}°, Dec ${dec > 0 ? '+' : ''}${dec}°. The Moon is ${moon}% lit${moon > 60 ? ', washing out fainter meteors' : ''}.`,
      time: iso(jd), precision: 'hour', bodies: ['earth'], tier: 'computed',
      visibility: { kind: 'latitude', note: dec > 30 ? 'Best from the Northern Hemisphere, after midnight.' : dec < -10 ? 'Best from the Southern Hemisphere, after midnight.' : 'Both hemispheres, after midnight.' },
      source: { name: 'IMO Meteor Shower Calendar (peak solar longitudes, ZHR); timing computed', url: 'https://www.imo.net/resources/calendar/' } }));
  }
  return out;
}

// ---- comets -------------------------------------------------------------------------------------
const GAUSS = 0.01720209895; // AU^1.5 / day
/** Heliocentric J2000 ecliptic position (AU) from perihelion elements (any eccentricity). */
export function cometPosition({ q, e, i, om, w, tp }, jd) {
  const dt = jd - tp;
  let nu, r;
  if (Math.abs(e - 1) < 1e-6) { // parabola: Barker's equation
    const W = (3 * GAUSS / Math.sqrt(2 * q ** 3)) * dt, y = Math.cbrt(W / 2 + Math.sqrt(W * W / 4 + 1));
    const s = y - 1 / y; nu = 2 * Math.atan(s); r = q * (1 + s * s);
  } else if (e < 1) {
    const a = q / (1 - e), M = (GAUSS / a ** 1.5) * dt;
    let E = M; for (let k = 0; k < 50; k++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2)); r = a * (1 - e * Math.cos(E));
  } else {
    const a = q / (e - 1), M = (GAUSS / a ** 1.5) * dt;
    let H = Math.asinh(M / e); for (let k = 0; k < 60; k++) H -= (e * Math.sinh(H) - H - M) / (e * Math.cosh(H) - 1);
    nu = 2 * Math.atan2(Math.sqrt(e + 1) * Math.sinh(H / 2), Math.sqrt(e - 1) * Math.cosh(H / 2)); r = a * (e * Math.cosh(H) - 1);
  }
  const u = w * DEG + nu, O = om * DEG, I = i * DEG;
  return [r * (Math.cos(O) * Math.cos(u) - Math.sin(O) * Math.sin(u) * Math.cos(I)), r * (Math.sin(O) * Math.cos(u) + Math.cos(O) * Math.sin(u) * Math.cos(I)), r * Math.sin(u) * Math.sin(I)];
}
/** Peak predicted brightness of each SBDB comet row in [from, to]; those brighter than `limit`. */
export function cometEvents(rows, from, to, limit = 12) {
  const out = [];
  for (const c of rows) {
    if (!Number.isFinite(c.M1)) continue;
    let best = null;
    for (let jd = from; jd <= to; jd += 1) {
      const p = cometPosition(c, jd), E = heliocentric('earth', jd);
      const g = [p[0] - E[0], p[1] - E[1], p[2] - E[2]], r = len(p), delta = len(g);
      const mag = c.M1 + 5 * Math.log10(delta) + (c.K1 ?? 10) * Math.log10(r);
      const elong = angle(g, E.map((x) => -x)) / DEG;
      if (!best || mag < best.mag) best = { jd, mag, r, delta, elong };
    }
    if (!best || best.mag > limit) continue;
    const name = c.name.trim();
    out.push(base({ id: `comet-${c.pdes.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${iso(best.jd).slice(0, 7)}`, type: 'comet', title: `Comet ${name} at its brightest`,
      description: `Predicted peak around magnitude ${best.mag.toFixed(1)} (${best.mag < 6 ? 'naked eye' : best.mag < 9 ? 'binoculars' : 'small telescope'}): ${best.r.toFixed(2)} AU from the Sun, ${best.delta.toFixed(2)} AU from Earth, ${Math.round(best.elong)}° from the Sun in the sky. Perihelion ${iso(c.tp).slice(0, 10)} at q = ${c.q.toFixed(2)} AU. Comet brightness forecasts are notoriously uncertain.`,
      time: iso(best.jd), precision: 'day', bodies: [name], tier: 'computed',
      visibility: { kind: 'global', note: best.elong < 30 ? 'Close to the Sun in the sky: low in twilight.' : 'Dark-sky object; check finder charts.' },
      source: { name: 'JPL Small-Body Database (orbit, M1/K1); brightness computed (MODELLED magnitude law)', url: `https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=${encodeURIComponent(c.pdes)}` } }));
  }
  return out;
}
/** SBDB query: comets with perihelion within ±120 days of the window and total absolute magnitude M1 < 11. */
export async function fetchComets(fetchJson, from, to) {
  const q = new URLSearchParams({ fields: 'full_name,pdes,tp,q,e,i,om,w,M1,K1', 'sb-kind': 'c', 'sb-cdata': JSON.stringify({ AND: [`tp|RG|${Math.floor(from - 120)}|${Math.ceil(to + 120)}`, 'M1|LT|11'] }) });
  const j = await fetchJson(`https://ssd-api.jpl.nasa.gov/sbdb_query.api?${q}`);
  return (j.data ?? []).map((r) => Object.fromEntries(j.fields.map((f, k) => [f === 'full_name' ? 'name' : f, f === 'full_name' || f === 'pdes' ? r[k] : Number(r[k])])));
}

// ---- aurora -------------------------------------------------------------------------------------
/** Equatorward edge of the auroral oval (geomagnetic latitude, deg) for a Kp value: NOAA's rule of thumb. */
export const auroraLatitude = (kp) => Math.round(66.5 - 2 * kp);
const G = (kp) => (kp >= 9 ? 'G5' : kp >= 8 ? 'G4' : kp >= 7 ? 'G3' : kp >= 6 ? 'G2' : kp >= 5 ? 'G1' : null);
/**
 * Aurora events from SWPC's 3-hourly Kp forecast (next ~3 days) and the 27-day outlook (largest
 * daily Kp), for days reaching storm level (Kp ≥ 5). Forecasts: MODELLED.
 */
export function auroraEvents({ kpForecast = [], outlookText = '' }, from, to) {
  const days = new Map(); // YYYY-MM-DD → { kp, t, src }
  for (const r of kpForecast) {
    if (r.observed === 'observed') continue;
    const t = Date.parse(`${r.time_tag}Z`), kp = Number(r.kp), d = new Date(t).toISOString().slice(0, 10);
    if (!Number.isFinite(kp) || jdOf(t) < from || jdOf(t) > to) continue;
    if (!days.has(d) || kp > days.get(d).kp) days.set(d, { kp, t, src: '3-day Kp forecast' });
  }
  for (const line of outlookText.split('\n')) {
    const m = /^(\d{4}) (\w{3}) (\d{2})\s+\d+\s+\d+\s+(\d+)/.exec(line);
    if (!m) continue;
    const t = Date.parse(`${m[3]} ${m[2]} ${m[1]} 12:00 UTC`), d = new Date(t).toISOString().slice(0, 10), kp = Number(m[4]);
    if (jdOf(t) < from || jdOf(t) > to || days.has(d)) continue;
    days.set(d, { kp, t, src: '27-day outlook' });
  }
  const out = [];
  for (const [d, { kp, t, src }] of [...days].sort()) {
    if (kp < 5) continue;
    const lat = auroraLatitude(kp);
    out.push({ id: `aurora-${d}`, category: 'celestial', type: 'aurora', title: `Geomagnetic storm watch (${G(kp)}, Kp ${kp.toFixed(kp % 1 ? 1 : 0)})`,
      description: `NOAA SWPC ${src} predicts Kp ${kp.toFixed(kp % 1 ? 1 : 0)}. Aurora may reach about ${lat}° geomagnetic latitude in both hemispheres (overhead) and be visible on the horizon from a few degrees further equatorward.`,
      time: new Date(t).toISOString().replace(/\.\d{3}Z$/, 'Z'), precision: src === '27-day outlook' ? 'day' : 'hour', status: 'forecast', tier: 'modelled', orgs: ['NOAA'], bodies: ['earth', 'sun'],
      visibility: { kind: 'latitude', minGeomagLat: lat, note: `Poleward of ~${lat}° geomagnetic latitude, dark clear skies.` },
      links: [{ url: 'https://www.swpc.noaa.gov/products/aurora-30-minute-forecast', title: 'SWPC aurora forecast' }],
      source: { name: `NOAA SWPC ${src}`, url: 'https://www.swpc.noaa.gov/' } });
  }
  return out;
}
