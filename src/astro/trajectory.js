// Modelled flight paths for the events feed (#32): ascent to orbit, booster return, payload coast,
// re-entry to a landing site, and the last hours of a rendezvous with a station. Shared by the
// weekly generator (scripts/events/build-events.js) and the app; pure maths, no DOM.
//
// These are MODELLED, not flight data: a generic gravity-turn-like profile flown along the great
// circle set by the launch azimuth, which is the classic sin(Az) = cos(i) / cos(lat) corrected for
// the Earth's rotation. Operators rarely publish trajectories ahead of a flight; what is real here
// is the pad, the landing zone, the target orbit class and the published timeline (MECO, landing,
// deploy), which pin the profile's key moments. Spherical Earth (R = 6371 km) throughout.

export const R_KM = 6371.0;
export const MU = 398600.4418; // km³/s²
export const OMEGA = 7.2921159e-5; // Earth's rotation, rad/s
const DEG = Math.PI / 180;

const unit = (lat, lon) => [Math.cos(lat * DEG) * Math.cos(lon * DEG), Math.cos(lat * DEG) * Math.sin(lon * DEG), Math.sin(lat * DEG)];
const toLatLon = ([x, y, z]) => [Math.atan2(z, Math.hypot(x, y)) / DEG, Math.atan2(y, x) / DEG];
const rotZ = ([x, y, z], a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a), z];
const norm = (v) => { const l = Math.hypot(...v) || 1; return v.map((c) => c / l); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const round = (v, d) => Math.round(v * 10 ** d) / 10 ** d;
const wrapLon = (l) => ((((l + 180) % 360) + 360) % 360) - 180;

/** Local east and north unit vectors at a point. */
function enu(lat, lon) {
  const e = [-Math.sin(lon * DEG), Math.cos(lon * DEG), 0];
  const n = [-Math.sin(lat * DEG) * Math.cos(lon * DEG), -Math.sin(lat * DEG) * Math.sin(lon * DEG), Math.cos(lat * DEG)];
  return { e, n };
}

/** Point `distKm` along the great circle leaving (lat, lon) on heading `azDeg` (from north, clockwise). */
export function destination(lat, lon, azDeg, distKm) {
  const r0 = unit(lat, lon), { e, n } = enu(lat, lon);
  const d = [0, 1, 2].map((k) => Math.cos(azDeg * DEG) * n[k] + Math.sin(azDeg * DEG) * e[k]);
  const th = distKm / R_KM;
  return toLatLon([0, 1, 2].map((k) => r0[k] * Math.cos(th) + d[k] * Math.sin(th)));
}
/** Great-circle distance (km) and initial heading (deg) from a to b. */
export function inverse([lat1, lon1], [lat2, lon2]) {
  const a = unit(lat1, lon1), b = unit(lat2, lon2);
  const dist = Math.atan2(Math.hypot(...cross(a, b)), dot(a, b)) * R_KM;
  const { e, n } = enu(lat1, lon1);
  const t = norm(cross(cross(a, b), a)); // tangent towards b
  return { distKm: dist, azDeg: ((Math.atan2(dot(t, e), dot(t, n)) / DEG) + 360) % 360 };
}

/**
 * Launch azimuth (deg) for inclination `incDeg` from latitude `latDeg`, in the rotating Earth's
 * frame. `branch` 'north' heads poleward-east (or north-west for retrograde orbits), 'south'
 * the mirror image. Inclinations below the latitude are unreachable directly: due east is used.
 */
export function launchAzimuth(latDeg, incDeg, branch = 'north', vOrbit = 7.8) {
  const c = Math.cos(incDeg * DEG) / Math.cos(latDeg * DEG);
  let azI = Math.abs(c) >= 1 ? (c > 0 ? 90 : 270) : Math.asin(c) / DEG; // inertial
  if (branch === 'south') azI = 180 - azI;
  const vEq = (OMEGA * R_KM) * Math.cos(latDeg * DEG); // ground speed of the pad, km/s
  const ve = vOrbit * Math.sin(azI * DEG) - vEq, vn = vOrbit * Math.cos(azI * DEG);
  return ((Math.atan2(ve, vn) / DEG) + 360) % 360;
}

/** Inclination (deg) of the orbit through (lat) heading `azDeg` inertially: cos i = cos(lat) sin(Az). */
export const inclinationOf = (latDeg, azInertialDeg) => Math.acos(Math.cos(latDeg * DEG) * Math.sin(azInertialDeg * DEG)) / DEG;

/** Ground-fixed point → inertial (aligned with ground-fixed at t = 0), and back. */
const fixedToInertial = (p, t) => rotZ(p, OMEGA * t);
const inertialToFixed = (p, t) => rotZ(p, -OMEGA * t);

/**
 * Ascent to orbit, then a circular coast.
 * opts: { lat, lon, incDeg, branch, insertionS, insertionAltKm, mecoS, coastToS, stepS, coastStepS }
 * Returns { points: [[tS, lat, lon, altKm]], azimuthDeg, meco: [tS, lat, lon, altKm], insertion: [...] }.
 */
export function ascentTrack({ lat, lon, incDeg, branch = 'north', insertionS = 540, insertionAltKm = 210, mecoS = null, coastToS = null, stepS = 10, coastStepS = 60 }) {
  const T = insertionS, r = R_KM + insertionAltKm, vOrb = Math.sqrt(MU / r);
  const az = launchAzimuth(lat, incDeg, branch, vOrb);
  const sIns = (vOrb * T) / 2.5; // horizontal speed grows as (t/T)^1.5 up to orbital speed
  const ground = (t) => sIns * Math.pow(t / T, 2.5);
  const alt = (t) => insertionAltKm * (1 - Math.exp(-3.2 * Math.pow(t / T, 1.6))) / (1 - Math.exp(-3.2));
  const at = (t) => { const [la, lo] = destination(lat, lon, az, ground(t)); return [t, la, wrapLon(lo), alt(t)]; };
  const points = [];
  for (let t = 0; t < T; t += stepS) points.push(at(t));
  const ins = at(T);
  points.push(ins);
  // circular coast in the inertial frame from the insertion point, on the requested inclination
  if (coastToS && coastToS > T) {
    const p0 = fixedToInertial(unit(ins[1], ins[2]), T);
    const azI = headingForInclination(ins[1], incDeg, branch);
    const [laI, loI] = toLatLon(p0), { e, n } = enu(laI, loI);
    const d = [0, 1, 2].map((k) => Math.cos(azI * DEG) * n[k] + Math.sin(azI * DEG) * e[k]);
    const w = vOrb / r; // rad/s
    for (let t = T + coastStepS; t <= coastToS + 1e-6; t += coastStepS) {
      const th = w * (t - T);
      const pI = [0, 1, 2].map((k) => p0[k] * Math.cos(th) + d[k] * Math.sin(th));
      const [la, lo] = toLatLon(inertialToFixed(pI, t));
      points.push([t, la, wrapLon(lo), insertionAltKm]);
    }
  }
  const m = mecoS ?? T * 0.29;
  return { points, azimuthDeg: az, meco: at(Math.min(m, T)), insertion: ins };
}

/** Inertial heading (deg) at latitude `lat` on an orbit of inclination `inc`, on the given branch. */
export function headingForInclination(lat, inc, branch = 'north') {
  const c = Math.cos(inc * DEG) / Math.cos(lat * DEG);
  const a = Math.abs(c) >= 1 ? (c > 0 ? 90 : 270) : Math.asin(c) / DEG;
  return branch === 'south' ? 180 - a : a;
}

/**
 * First-stage return: from its state at stage separation to a landing zone (return to launch
 * site, drone ship downrange, or a land pad). A climb to a modest apogee, then the fall.
 * opts: { from: [tS, lat, lon, altKm], to: [lat, lon], landS, stepS }
 */
export function boosterReturn({ from, to, landS, stepS = 15 }) {
  const [t0, la0, lo0, h0] = from, { distKm, azDeg } = inverse([la0, lo0], to);
  const pts = [];
  const N = Math.max(2, Math.ceil((landS - t0) / stepS));
  for (let i = 0; i <= N; i++) {
    const u = i / N, t = t0 + u * (landS - t0);
    const f = u * u * (3 - 2 * u); // eased ground progress
    const [la, lo] = destination(la0, lo0, azDeg, distKm * f);
    const h = h0 * Math.pow(1 - u, 1.5) + 0.9 * h0 * Math.sin(Math.PI * u) * Math.sqrt(1 - u);
    pts.push([t, la, wrapLon(lo), Math.max(0, h)]);
  }
  return pts;
}

/** Suborbital hop (e.g. New Shepard): straight up and back down near the pad. */
export function suborbitalHop({ lat, lon, apogeeKm = 107, apogeeS = 240, landS = 600, stepS = 15, driftKm = 2 }) {
  const pts = [];
  for (let t = 0; t <= landS; t += stepS) {
    const h = t <= apogeeS ? apogeeKm * Math.sin((Math.PI / 2) * (t / apogeeS)) : apogeeKm * Math.cos((Math.PI / 2) * ((t - apogeeS) / (landS - apogeeS)));
    const [la, lo] = destination(lat, lon, 90, driftKm * (t / landS));
    pts.push([t, la, wrapLon(lo), Math.max(0, h)]);
  }
  return pts;
}

/**
 * Re-entry to a landing or splashdown site: the last ~45 minutes, from a circular orbit through
 * the deorbit burn, entry interface (120 km) and parachutes, ending at the site at t = 0.
 * opts: { lat, lon, incDeg = 51.64, branch = 'north', orbitAltKm = 400, fromS = 2700, stepS = 30 }
 */
export function reentryTrack({ lat, lon, incDeg = 51.64, branch = 'north', orbitAltKm = 400, fromS = 2700, stepS = 30 }) {
  const az = launchAzimuth(lat, incDeg, branch, 7.6); // heading of the ground track through the site
  const back = (az + 180) % 360;
  const dist = (tau) => {
    if (tau <= 300) return 30 * (tau / 300);
    if (tau <= 900) { const u = (tau - 300) / 600; return 30 + 600 * (0.1 * u + 7.3 * u * u / 2); }
    return 30 + 600 * (0.1 + 3.65) + 7.6 * (tau - 900);
  };
  const alt = (tau) => (tau <= 300 ? 10 * (tau / 300) : tau <= 900 ? 10 + 110 * Math.pow((tau - 300) / 600, 1.6) : Math.min(orbitAltKm, 120 + (orbitAltKm - 120) * Math.pow((tau - 900) / 1500, 0.8)));
  const pts = [];
  for (let tau = fromS; tau >= 0; tau -= stepS) {
    const [la, lo] = destination(lat, lon, back, dist(tau));
    pts.push([-tau, la, wrapLon(lo), alt(tau)]);
  }
  return pts;
}

/**
 * Last hours of a rendezvous, or the first of a departure, relative to the station in its local
 * orbital frame (LVLH): [tS, radialKm (up), alongKm (+velocity), crossKm]. `port` picks the
 * final approach axis: 'forward' (+V-bar, e.g. Dragon to Harmony), 'aft' (−V-bar, Progress/Soyuz to
 * Zvezda), 'zenith'/'nadir' (R-bar), or 'berth' (captured by the arm ~10 m below).
 */
export function proximityProfile({ kind = 'docking', port = 'forward' } = {}) {
  const axis = { forward: [0, 1], aft: [0, -1], zenith: [1, 0], nadir: [-1, 0], berth: [-1, 0] }[port] ?? [0, 1];
  const fin = port === 'berth' ? 0.01 : 0; // berthing: grappled ~10 m away
  const w = (km) => [axis[0] * km, axis[1] * km];
  const approach = [ // seconds before contact: far behind and below, closing to the port axis
    [-7200, -12, -45], [-5400, -5, -18], [-3600, -1.5, -4], [-2400, -0.4, -1.0],
    [-1800, ...w(0.4)], [-1200, ...w(0.22)], [-600, ...w(0.06)], [-180, ...w(0.012 + fin)], [0, ...w(fin)],
  ];
  const rows = kind === 'docking' ? approach
    : [[0, ...w(fin)], [300, ...w(0.2)], [900, ...w(0.5).map((v, i) => v + (i === 0 ? -0.2 : 0))], [1800, -1.5, axis[1] >= 0 ? 4 : -4], [3600, -6, axis[1] >= 0 ? 30 : -30], [5400, -14, axis[1] >= 0 ? 90 : -90]];
  return rows.map(([t, rr, al]) => [t, round(rr, 3), round(al, 3), 0]);
}

/** Interpolate a [[t, ...values]] track at time t (null outside it). Longitudes unwrap. */
export function sampleTrack(points, t, lonIndex = 2) {
  if (!points?.length || t < points[0][0] || t > points.at(-1)[0]) return null;
  let i = 1;
  while (i < points.length - 1 && points[i][0] < t) i++;
  const a = points[i - 1], b = points[i], u = b[0] === a[0] ? 0 : (t - a[0]) / (b[0] - a[0]);
  return a.map((v, k) => {
    if (k === 0) return t;
    let w = b[k];
    if (k === lonIndex && Math.abs(w - v) > 180) w += w > v ? -360 : 360;
    const x = v + (w - v) * u;
    return k === lonIndex ? wrapLon(x) : x;
  });
}

/** Round a [[t, lat, lon, alt]] track for publishing. */
export const compactTrack = (pts) => pts.map(([t, la, lo, h]) => [Math.round(t), round(la, 3), round(lo, 3), round(h, 1)]);
