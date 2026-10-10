// LOOK AT (#43): how big, how lit and how far one body looks from another. Pure functions, so the
// System View and the tests share them. Distances in km, vectors as [x, y, z] in any common frame.

const DEG = 180 / Math.PI;
export const C_KM_S = 299792.458;
/** The full Moon from Earth, the yardstick for apparent sizes (mean angular diameter, degrees). */
export const FULL_MOON_DEG = 0.518;
/** A typical naked-eye field, for magnification readouts. */
export const NAKED_EYE_FOV = 60;

const len = (v) => Math.hypot(v[0], v[1], v[2]);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Angular diameter (degrees) of a sphere of `radiusKm` seen from `distKm` (centre to centre). */
export const angularDiameterDeg = (radiusKm, distKm) => 2 * Math.asin(Math.min(1, radiusKm / distKm)) * DEG;

/** Phase angle (Sun–target–observer, degrees) and illuminated fraction of the disc. */
export function phase(targetToSun, targetToObserver) {
  const c = Math.max(-1, Math.min(1, dot(targetToSun, targetToObserver) / (len(targetToSun) * len(targetToObserver))));
  return { angleDeg: Math.acos(c) * DEG, illuminated: (1 + c) / 2 };
}

export const lightTimeSec = (distKm) => distKm / C_KM_S;
export const magnification = (fovDeg) => NAKED_EYE_FOV / fovDeg;

/** "1.90°", "31.6′", "4.2″" */
export function fmtAngle(deg) {
  if (deg >= 1) return `${deg.toFixed(deg < 10 ? 2 : 1)}°`;
  if (deg >= 1 / 60) return `${(deg * 60).toFixed(1)}′`;
  return `${(deg * 3600).toFixed(deg * 3600 < 10 ? 2 : 1)}″`;
}

/** "1.90° · 3.7 × THE FULL MOON" / "31.6′ · 1.0 × THE FULL MOON" / "4.2″ · A POINT TO THE EYE" */
export function describeSize(deg) {
  const r = deg / FULL_MOON_DEG;
  const cmp = deg * 60 < 1 ? 'A POINT TO THE EYE' : r >= 0.1 ? `${r.toFixed(r < 10 ? 1 : 0)} × THE FULL MOON` : `1/${Math.round(1 / r)} OF THE FULL MOON`;
  return `${fmtAngle(deg)} · ${cmp}`;
}

/** "1.3 S", "43 MIN", "5.5 H" */
export function fmtLightTime(sec) {
  return sec < 120 ? `${sec.toFixed(sec < 10 ? 2 : 0)} S` : sec < 7200 ? `${(sec / 60).toFixed(0)} MIN` : `${(sec / 3600).toFixed(1)} H`;
}

/** Fit a target of `deg` into a field: about four diameters, never narrower than 0.05° or wider than naked eye. */
export const fitFov = (deg) => Math.max(0.05, Math.min(NAKED_EYE_FOV, deg * 4));
