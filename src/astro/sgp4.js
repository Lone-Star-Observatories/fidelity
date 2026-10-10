// Earth satellites with SGP4 (satellite.js, the Vallado reference implementation) from
// CelesTrak OMM elements. SGP4 works in TEME (true equator, mean equinox of date); we rotate
// to J2000 with IAU 1976 precession (nutation, < 20″, is ignored) and then to the ecliptic.

import { json2satrec, propagate, gstime, eciToGeodetic, degreesLat, degreesLong } from 'satellite.js';

const AS = Math.PI / (180 * 3600);
const J2000 = 2451545.0;

/** Rebuild an OMM record from a compact /api/satellites row and make a satrec. */
export function satrecFromRow(r) {
  const [NORAD_CAT_ID, OBJECT_NAME, , epochMs, MEAN_MOTION, ECCENTRICITY, INCLINATION, RA_OF_ASC_NODE, ARG_OF_PERICENTER, MEAN_ANOMALY, BSTAR, MEAN_MOTION_DOT, MEAN_MOTION_DDOT, OBJECT_ID] = r;
  return json2satrec({ NORAD_CAT_ID, OBJECT_NAME, OBJECT_ID, EPOCH: new Date(epochMs).toISOString().slice(0, -1),
    MEAN_MOTION, ECCENTRICITY, INCLINATION, RA_OF_ASC_NODE, ARG_OF_PERICENTER, MEAN_ANOMALY, BSTAR, MEAN_MOTION_DOT, MEAN_MOTION_DDOT,
    EPHEMERIS_TYPE: 0, CLASSIFICATION_TYPE: 'U', ELEMENT_SET_NO: 999, REV_AT_EPOCH: 0 });
}

/** Rotation matrix (row-major 3×3) from the mean equator & equinox of date to J2000 (IAU 1976). */
export function precessionToJ2000(jd) {
  const T = (jd - J2000) / 36525;
  const zeta = (2306.2181 * T + 0.30188 * T * T + 0.017998 * T ** 3) * AS;
  const z = (2306.2181 * T + 1.09468 * T * T + 0.018203 * T ** 3) * AS;
  const th = (2004.3109 * T - 0.42665 * T * T - 0.041833 * T ** 3) * AS;
  const [cz, sz, cZ, sZ, ct, st] = [Math.cos(zeta), Math.sin(zeta), Math.cos(z), Math.sin(z), Math.cos(th), Math.sin(th)];
  // P (J2000 → date) = Rz(−z)·Ry(θ)·Rz(−ζ); we need its transpose.
  const P = [
    [cZ * ct * cz - sZ * sz, -cZ * ct * sz - sZ * cz, -cZ * st],
    [sZ * ct * cz + cZ * sz, -sZ * ct * sz + cZ * cz, -sZ * st],
    [st * cz, -st * sz, ct],
  ];
  return [[P[0][0], P[1][0], P[2][0]], [P[0][1], P[1][1], P[2][1]], [P[0][2], P[1][2], P[2][2]]];
}

const EPS = 23.4392911 * Math.PI / 180, CE = Math.cos(EPS), SE = Math.sin(EPS);
/** TEME km → J2000 ecliptic km, given the precession matrix for the date. */
export function temeToEcliptic(v, Pm) {
  const x = Pm[0][0] * v.x + Pm[0][1] * v.y + Pm[0][2] * v.z;
  const y = Pm[1][0] * v.x + Pm[1][1] * v.y + Pm[1][2] * v.z;
  const z = Pm[2][0] * v.x + Pm[2][1] * v.y + Pm[2][2] * v.z;
  return [x, CE * y + SE * z, -SE * y + CE * z];
}

const dateOf = (jd) => new Date((jd - 2440587.5) * 86400000);

/** Position & velocity (TEME, km, km/s) or null if SGP4 fails (decayed, bad elements). */
export function stateAt(satrec, jd) {
  const s = propagate(satrec, dateOf(jd));
  return s && s.position && Number.isFinite(s.position.x) ? s : null;
}

/** Geodetic latitude/longitude (deg) and altitude (km) of a TEME position at `jd`. */
export function subPoint(position, jd) {
  const g = eciToGeodetic(position, gstime(dateOf(jd)));
  return { lat: degreesLat(g.latitude), lon: degreesLong(g.longitude), altKm: g.height };
}
