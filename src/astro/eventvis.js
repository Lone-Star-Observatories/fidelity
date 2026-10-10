// "Visible from my location" (#33): can an event in the feed be seen (or watched) from one place
// on Earth? Each answer carries the reason shown on the event's row and a provenance tier.
//
//   Solar eclipses: the topocentric Sun and Moon from src/astro/eclipses.js, scanned from first to
//     last contact for this place's own maximum: inside the umbra (the path of totality or
//     annularity), the penumbra (partial) or neither, and whether the Sun is up then.
//   Lunar eclipses: whether the Moon is above the horizon at maximum, or at least during the
//     eclipse.
//   Occultations, conjunctions, oppositions, elongations, parades and transits: whether the
//     bodies are above the horizon at the event time (in a dark sky for the night-sky events;
//     the Sun up for transits). Slow events also get the dark hours of that night. Occultations
//     add whether the Moon actually covers the target from here.
//   Meteor showers: the radiant up in a dark sky around the peak. Aurora watches: the place's
//     geomagnetic latitude against the forecast edge (MODELLED, like the forecast).
//   Launches, landings, dockings, spacewalks and webcasts: always "visible" in the sense of
//     watchable; the reason says whether a webcast is listed.
//
// The location never leaves the browser: callers pass { lat, lon } in, nothing here fetches.
// Geometric altitudes (no refraction); a body counts as up above 0°, a sky as dark with the Sun
// below −6° (civil twilight).

import { sunMoon, planetGeo, localCircumstances, surfacePoint, inertialPoint, fixedToInertial, OCCULTABLE_STARS, R_MOON } from './eclipses.js';

const DEG = Math.PI / 180, DAY_MIN = 1440;
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const angle = (a, b) => Math.acos(Math.max(-1, Math.min(1, dot(a, b) / (len(a) * len(b)))));
const OBL = 23.4392911 * DEG;
const eqToEcl = ([x, y, z]) => [x, y * Math.cos(OBL) + z * Math.sin(OBL), -y * Math.sin(OBL) + z * Math.cos(OBL)];
const starVec = (raDeg, decDeg) => eqToEcl([Math.cos(decDeg * DEG) * Math.cos(raDeg * DEG), Math.cos(decDeg * DEG) * Math.sin(raDeg * DEG), Math.sin(decDeg * DEG)]);
const jdOfIso = (iso) => Date.parse(iso) / 86400000 + 2440587.5;
/** "14:32 UTC" for a JD. */
export const hhmm = (jd) => `${new Date((jd - 2440587.5) * 86400000 + 30000).toISOString().slice(11, 16)} UTC`;

export const SUN_DARK = -6; // deg: a sky dark enough for planets and bright stars
const PLANETS = new Set(['mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune']);
const STARS = new Map(OCCULTABLE_STARS.map(([name, ra, dec]) => [name.toLowerCase(), starVec(ra, dec)]));
// Earth's dipole axis (IGRF-14, epoch 2025): the north geomagnetic pole
export const GEOMAG_POLE = { lat: 80.8, lon: -72.8 };

/** Geocentric vector (km, or a unit vector for stars) of a body the feed names, at UT `jd`; null if unknown. */
export function bodyVector(id, jd) {
  const k = String(id).toLowerCase();
  if (k === 'sun') return sunMoon(jd).sun;
  if (k === 'moon') return sunMoon(jd).moon;
  if (PLANETS.has(k)) return planetGeo(k, jd);
  return STARS.get(k) ?? null;
}
/** Geometric altitude (deg) of a body at UT `jd` from geodetic lat/lon (deg); parallax included (stars: direction only). */
export function altitude(id, jd, lat, lon) {
  const v = bodyVector(id, jd);
  if (!v) return null;
  const P = inertialPoint(jd, lat, lon), up = fixedToInertial(jd, [Math.cos(lat * DEG) * Math.cos(lon * DEG), Math.cos(lat * DEG) * Math.sin(lon * DEG), Math.sin(lat * DEG)]);
  const d = len(v) < 2 ? v : sub(v, P); // unit vectors are stars: no parallax
  return Math.asin(dot(d, up) / (len(d) * len(up))) / DEG;
}
/** Geomagnetic (dipole) latitude, deg. */
export function geomagneticLat(lat, lon) {
  const p = GEOMAG_POLE.lat * DEG, l = lat * DEG;
  return Math.asin(Math.sin(l) * Math.sin(p) + Math.cos(l) * Math.cos(p) * Math.cos((lon - GEOMAG_POLE.lon) * DEG)) / DEG;
}
const dist = (a, b) => { // great-circle km
  const h = Math.sin((b.lat - a.lat) * DEG / 2) ** 2 + Math.cos(a.lat * DEG) * Math.cos(b.lat * DEG) * Math.sin((b.lon - a.lon) * DEG / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
};
/** Runs of times in [t0, t1] (step in minutes) where `ok(t)` holds: [[from, to], …]. */
function runs(t0, t1, stepMin, ok) {
  const out = [];
  let open = null;
  for (let t = t0; t <= t1 + 1e-9; t += stepMin / DAY_MIN) {
    if (ok(t)) { if (open == null) open = t; } else if (open != null) { out.push([open, t - stepMin / DAY_MIN]); open = null; }
  }
  if (open != null) out.push([open, t1]);
  return out;
}
const fmtDeg = (x) => `${Math.round(x)}°`;
const result = (visible, reason, tier = 'computed', extra = {}) => ({ visible, reason, tier, ...extra });
const span = (e, padDays) => ({ from: e.start ? jdOfIso(e.start) : e.jd - padDays, to: e.endJd ?? (e.end ? jdOfIso(e.end) : e.jd + padDays) });

// ---- solar eclipses ---------------------------------------------------------------------------------
/**
 * This place's own maximum of a solar eclipse: scanned every 2 min between the contacts, refined
 * to ~1 s. Returns { jd, magnitude, obscuration, central: 'total' | 'annular' | null, sunAlt }.
 */
export function solarEclipseAt(e, lat, lon) {
  const fixed = surfacePoint(lat, lon), { from, to } = span(e, 0.15);
  const lc = (t) => localCircumstances(t, fixed);
  let best = null;
  for (let t = from; t <= to; t += 2 / DAY_MIN) { const c = lc(t); if (!best || c.sep - c.ss - c.sm < best.v) best = { t, v: c.sep - c.ss - c.sm }; }
  let a = best.t - 2 / DAY_MIN, b = best.t + 2 / DAY_MIN; // golden-section on the separation
  const r = (Math.sqrt(5) - 1) / 2;
  for (let i = 0; i < 40; i++) { const c = b - r * (b - a), d = a + r * (b - a); if (lc(c).sep < lc(d).sep) b = d; else a = c; }
  const t = (a + b) / 2, c = lc(t);
  const central = c.sep < Math.abs(c.sm - c.ss) ? (c.sm > c.ss ? 'total' : 'annular') : null;
  return { jd: t, magnitude: c.magnitude, obscuration: c.obscuration, central, sunAlt: altitude('sun', t, lat, lon), from, to, lc };
}
function solarEclipseVis(e, lat, lon) {
  const m = solarEclipseAt(e, lat, lon);
  if (!(m.magnitude > 0)) return result(false, 'OUTSIDE THE PENUMBRA: NO ECLIPSE HERE', 'computed', { max: m });
  const what = m.central === 'total' ? 'IN THE PATH OF TOTALITY' : m.central === 'annular' ? 'IN THE PATH OF ANNULARITY'
    : `PARTIAL HERE, ${Math.round(m.obscuration * 100)}% OF THE SUN COVERED`;
  if (m.sunAlt > 0) return result(true, `${what} · MAXIMUM ${hhmm(m.jd)}, SUN ${fmtDeg(m.sunAlt)} UP`, 'computed', { max: m, inPath: !!m.central });
  // the Sun is down at this place's maximum: is any of the eclipse above the horizon?
  const up = runs(m.from, m.to, 3, (t) => m.lc(t).magnitude > 0 && altitude('sun', t, lat, lon) > 0);
  const lead = m.central ? `THE PATH OF ${m.central === 'total' ? 'TOTALITY' : 'ANNULARITY'} CROSSES HERE WITH THE SUN DOWN` : `MAXIMUM (${Math.round(m.obscuration * 100)}%) AT ${hhmm(m.jd)} WITH THE SUN DOWN`;
  if (up.length) return result(true, `${lead} · PARTIAL WITH THE SUN UP ${hhmm(up[0][0])}–${hhmm(up.at(-1)[1])}`, 'computed', { max: m, inPath: false });
  // (the topocentric discs can overlap through the Earth; the shadow itself only falls on the day side)
  return result(false, 'NO ECLIPSE TO SEE: THE SUN IS BELOW THE HORIZON HERE WHILE IT HAPPENS', 'computed', { max: m });
}

// ---- lunar eclipses ---------------------------------------------------------------------------------
function lunarEclipseVis(e, lat, lon) {
  const alt = altitude('moon', e.jd, lat, lon);
  if (alt > 0) return result(true, `MOON ${fmtDeg(alt)} UP AT MAXIMUM (${hhmm(e.jd)})`);
  const { from, to } = span(e, 0.1);
  const up = runs(from, to, 3, (t) => altitude('moon', t, lat, lon) > 0);
  if (up.length) return result(true, `MOON BELOW THE HORIZON AT MAXIMUM (${hhmm(e.jd)}) · UP ${hhmm(up[0][0])}–${hhmm(up.at(-1)[1])}, PART OF THE ECLIPSE`);
  return result(false, 'MOON BELOW THE HORIZON THROUGHOUT THE ECLIPSE');
}

// ---- bodies on the sky --------------------------------------------------------------------------------
/** Are all `ids` above the horizon at `t`, and is the sky dark? { up, dark, alts, sunAlt }. */
function skyAt(ids, t, lat, lon) {
  const alts = ids.map((id) => altitude(id, t, lat, lon));
  const sunAlt = altitude('sun', t, lat, lon);
  return { up: alts.every((a) => a > 0), alts, sunAlt, dark: sunAlt < SUN_DARK };
}
const altList = (ids, alts) => ids.map((id, i) => `${id.toUpperCase()} ${fmtDeg(alts[i])}`).join(', ');
/**
 * Night-sky event: the bodies up in a dark sky at the event time; failing that (for slow events),
 * the dark hours of that night (±`windowH` hours) when they are all up.
 */
function nightSkyVis(e, ids, lat, lon, windowH) {
  if (!ids.length || ids.some((id) => !bodyVector(id, e.jd))) return result(null, 'NOT COMPUTED FOR THIS EVENT');
  const s = skyAt(ids, e.jd, lat, lon);
  if (s.up && s.dark) return result(true, `UP IN A DARK SKY AT ${hhmm(e.jd)}: ${altList(ids, s.alts)}`);
  const why = !s.up ? `BELOW THE HORIZON AT ${hhmm(e.jd)}` : `ABOVE THE HORIZON AT ${hhmm(e.jd)} BUT IN DAYLIGHT`;
  if (windowH) {
    const w = runs(e.jd - windowH / 24, e.jd + windowH / 24, 10, (t) => { const q = skyAt(ids, t, lat, lon); return q.up && q.dark; });
    if (w.length) {
      const best = w.reduce((a, b) => (b[1] - b[0] > a[1] - a[0] ? b : a));
      return result(true, `${why} · UP IN A DARK SKY ${hhmm(best[0])}–${hhmm(best[1])}`);
    }
  }
  return result(false, why);
}
function transitVis(e, lat, lon) {
  const { from, to } = span(e, 0.2);
  const up = runs(from, to, 5, (t) => altitude('sun', t, lat, lon) > 0);
  return up.length ? result(true, `SUN UP ${hhmm(up[0][0])}–${hhmm(up.at(-1)[1])} DURING THE TRANSIT · SOLAR FILTER ONLY`)
    : result(false, 'SUN BELOW THE HORIZON THROUGHOUT THE TRANSIT');
}
/**
 * Occultation by the Moon: the bodies above the horizon at the event time, plus whether the Moon
 * covers the target from here (topocentric separation within ±3 h under the Moon's semi-diameter).
 */
function occultationVis(e, lat, lon) {
  const target = (e.bodies ?? []).find((b) => b !== 'moon');
  if (!target || !bodyVector(target, e.jd)) return result(null, 'NOT COMPUTED FOR THIS TARGET');
  let best = null;
  for (let t = e.jd - 3 / 24; t <= e.jd + 3 / 24; t += 2 / DAY_MIN) {
    const P = inertialPoint(t, lat, lon), m = sub(sunMoon(t).moon, P), v = bodyVector(target, t), d = len(v) < 2 ? v : sub(v, P);
    const sep = angle(m, d) - Math.asin(R_MOON / len(m));
    if (!best || sep < best.sep) best = { t, sep };
  }
  const covered = best.sep < 0;
  const at = covered ? best.t : e.jd;
  const s = skyAt(['moon', target], at, lat, lon);
  const gap = best.sep / DEG < 1 ? `${Math.max(1, Math.round(best.sep / DEG * 60))}′` : `${(best.sep / DEG).toFixed(1)}°`;
  const pass = covered ? `OCCULTED FROM HERE AROUND ${hhmm(best.t)}` : `NOT OCCULTED FROM HERE: CLOSEST ${gap} FROM THE MOON'S LIMB AT ${hhmm(best.t)}`;
  if (!s.up) return result(false, `${pass} · BELOW THE HORIZON THEN`);
  return result(true, `${pass} · ${altList(['moon', target], s.alts)} UP${s.dark ? '' : ' (DAYLIGHT: TELESCOPE)'}`, 'computed', { covered });
}
function meteorVis(e, lat, lon) {
  const m = /RA (\d+(?:\.\d+)?)°, Dec ([+−-]?\d+(?:\.\d+)?)°/.exec(e.description ?? '');
  if (!m) return result(null, (e.visibility?.note ?? 'NOT COMPUTED').toUpperCase());
  const radiant = starVec(Number(m[1]), Number(m[2].replace('−', '-')));
  const P = (t) => fixedToInertial(t, [Math.cos(lat * DEG) * Math.cos(lon * DEG), Math.cos(lat * DEG) * Math.sin(lon * DEG), Math.sin(lat * DEG)]);
  const radAlt = (t) => Math.asin(dot(radiant, P(t)) / len(P(t))) / DEG;
  const w = runs(e.jd - 0.5, e.jd + 0.5, 15, (t) => radAlt(t) > 10 && altitude('sun', t, lat, lon) < -12);
  if (!w.length) return result(false, 'RADIANT NOT UP IN A DARK SKY AROUND THE PEAK');
  const best = w.reduce((a, b) => (b[1] - b[0] > a[1] - a[0] ? b : a));
  return result(true, `RADIANT UP IN A DARK SKY ${hhmm(best[0])}–${hhmm(best[1])} AROUND THE PEAK`);
}
function auroraVis(e, lat, lon) {
  const edge = e.visibility?.minGeomagLat, gm = geomagneticLat(lat, lon);
  if (edge == null) return result(null, 'NO FORECAST EDGE GIVEN', 'modelled');
  const a = Math.abs(gm);
  if (a >= edge) return result(true, `GEOMAGNETIC LATITUDE ${fmtDeg(a)}: POLEWARD OF THE FORECAST ~${edge}° EDGE · NEEDS A DARK, CLEAR SKY`, 'modelled');
  if (a >= edge - 5) return result(true, `GEOMAGNETIC LATITUDE ${fmtDeg(a)}: JUST EQUATORWARD OF THE ~${edge}° EDGE, MAYBE LOW ON THE ${gm >= 0 ? 'NORTHERN' : 'SOUTHERN'} HORIZON`, 'modelled');
  return result(false, `GEOMAGNETIC LATITUDE ${fmtDeg(a)}: TOO FAR FROM THE FORECAST ~${edge}° EDGE`, 'modelled');
}
function watchable(e, lat, lon) {
  const cast = e.video?.length ? 'WATCHABLE · WEBCAST LISTED' : 'WATCHABLE ONLINE · NO WEBCAST LISTED YET';
  const loc = e.location?.lat != null && e.category === 'launch' ? dist({ lat, lon }, e.location) : null;
  return result(true, loc != null && loc < 250 ? `${cast} · PAD ${Math.round(loc)} KM AWAY: THE ASCENT MAY BE IN VIEW` : cast, 'reported');
}

/**
 * Can event `e` (a feed event with `jd`, `endJd` set by the client) be seen from { lat, lon }?
 * → { visible: true | false | null (not computed), reason, tier, … }.
 */
export function eventVisibility(e, { lat, lon }) {
  if (!(Math.abs(lat) <= 90 && Math.abs(lon) <= 180)) return result(null, 'NO LOCATION');
  const bodies = (e.bodies ?? []).map((b) => String(b).toLowerCase());
  switch (e.type) {
    case 'solar-eclipse': return solarEclipseVis(e, lat, lon);
    case 'lunar-eclipse': return lunarEclipseVis(e, lat, lon);
    case 'occultation': return occultationVis({ ...e, bodies }, lat, lon);
    case 'transit': return transitVis(e, lat, lon);
    case 'conjunction': return nightSkyVis(e, bodies, lat, lon, bodies.includes('moon') ? 6 : 12);
    case 'opposition': case 'elongation': return nightSkyVis(e, bodies.filter((b) => b !== 'sun'), lat, lon, 12);
    case 'parade': return nightSkyVis(e, bodies, lat, lon, 12);
    case 'meteor-shower': return meteorVis(e, lat, lon);
    case 'aurora': return auroraVis(e, lat, lon);
    case 'comet': return result(null, 'NOT COMPUTED: THE FEED GIVES NO SKY POSITION FOR THIS COMET');
    default: return e.category === 'celestial' ? result(null, 'NOT COMPUTED FOR THIS KIND OF EVENT') : watchable(e, lat, lon);
  }
}
