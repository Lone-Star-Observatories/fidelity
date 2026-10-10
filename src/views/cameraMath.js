// Camera maths shared by every 3D view (#39): fill-view distance, zoom slider mapping, real-unit
// readouts, fly speed and the camera bookmark codec. Pure functions (no three.js, no DOM), tested
// in tests/camera.test.js.

const DEG = Math.PI / 180;

/** Metres per scene unit for each view's natural unit. */
export const METERS = {
  m: 1,
  km: 1e3,
  au: 1.495978707e11,
  ly: 9.4607304725808e15,
  kly: 9.4607304725808e18,
  mly: 9.4607304725808e21,
};

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

/** Horizontal half field of view (rad) for a vertical field of view `fovDeg` and an aspect ratio w/h. */
export const halfFovH = (fovDeg, aspect) => Math.atan(Math.tan((fovDeg * DEG) / 2) * aspect);

/**
 * Camera distance at which a sphere of `radius` fills the viewport: the sphere's angular radius
 * equals the narrower half field (vertical on a wide viewport, horizontal on a tall one), times a
 * margin. A sphere seen from distance d subtends asin(r / d), hence d = r / sin(half).
 */
export function fitDistance(radius, fovDeg, aspect = 1, margin = 1.08) {
  const half = Math.min((fovDeg * DEG) / 2, halfFovH(fovDeg, aspect || 1));
  return (radius * margin) / Math.sin(half);
}

/** Width of the view (scene units) across the screen at `distance` from the camera. */
export const viewWidth = (distance, fovDeg, aspect = 1) => 2 * distance * Math.tan((fovDeg * DEG) / 2) * (aspect || 1);

/**
 * Smallest sphere (approximately: centred on the bounding box) holding a set of spheres
 * [{ c: [x, y, z], r }]: the group a FILL VIEW frames.
 */
export function enclosingSphere(list) {
  if (!list.length) return null;
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const { c, r = 0 } of list) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], c[k] - r); hi[k] = Math.max(hi[k], c[k] + r); }
  const c = lo.map((v, k) => (v + hi[k]) / 2);
  let r = 0;
  for (const s of list) r = Math.max(r, Math.hypot(s.c[0] - c[0], s.c[1] - c[1], s.c[2] - c[2]) + (s.r ?? 0));
  return { c, r };
}

// numbers in read-outs: whole numbers from 10 up, one decimal from 1, two significant digits below
function num(x) {
  if (x >= 10) return Math.round(x).toLocaleString('en-US');
  if (x >= 1) return String(Math.round(x * 10) / 10);
  return String(Number(x.toPrecision(2)));
}

/**
 * A length in metres in the unit an astronomer would use at that size: M, KM, MILLION KM, AU,
 * LY, KLY, MLY, GLY.
 */
export function formatLength(m) {
  if (!Number.isFinite(m) || m < 0) return '—';
  const au = m / METERS.au, ly = m / METERS.ly;
  if (m < 1e3) return `${num(m)} M`;
  if (m < 1e9) return `${num(m / 1e3)} KM`;
  if (au < 0.1) return `${num(m / 1e9)} MILLION KM`;
  if (au < 10000) return `${num(au)} AU`;
  if (ly < 1e4) return `${num(ly)} LY`;
  if (ly < 1e6) return `${num(ly / 1e3)} KLY`;
  if (ly < 1e9) return `${num(ly / 1e6)} MLY`;
  return `${num(ly / 1e9)} GLY`;
}

/** ORBIT read-out: how wide the view is at the orbit target, e.g. VIEW 12 AU ACROSS. */
export const spanReadout = (meters) => `VIEW ${formatLength(meters)} ACROSS`;

/** LOOK / FLY / surface read-out: the camera's (vertical) field of view, e.g. 0.6° FIELD. */
export function fieldReadout(fovDeg) {
  if (!Number.isFinite(fovDeg) || fovDeg <= 0) return '—';
  if (fovDeg < 0.1) return `${num(fovDeg * 60)}′ FIELD`;
  return `${num(fovDeg)}° FIELD`;
}

/**
 * FREE MOVE speed (scene units per second): proportional to the distance to the nearest surface,
 * so a second's flight covers `k` of the remaining gap whether that is 100 m or 100 Mly.
 */
export function flySpeed(distance, { k = 0.8, min = 0, max = Infinity } = {}) {
  return clamp(Math.abs(distance) * k, min, max);
}

/** Zoom slider position 0…1 (right = closer) for a distance between min and max (log scale). */
export function sliderFromDistance(d, min, max) {
  if (!(max > min && min > 0)) return 0.5;
  return clamp(1 - Math.log(d / min) / Math.log(max / min), 0, 1);
}
export const distanceFromSlider = (s, min, max) => min * Math.exp((1 - clamp(s, 0, 1)) * Math.log(max / min));

/** One zoom step (+1 in, −1 out) of a distance or field of view, clamped. */
export const zoomed = (x, steps, min = 0, max = Infinity, factor = 1.25) => clamp(x * Math.pow(factor, -steps), min, max);

// ---- camera bookmarks (?cam=…) --------------------------------------------------------------
// mode letter, camera position (3), orientation quaternion (4), field of view, then optionally the
// orbit target (3): o,x,y,z,qx,qy,qz,qw,fov[,tx,ty,tz]. Positions are in the view's own frame
// and unit (the System View: AU relative to the routed body). Surface: s,az,alt,fov.
const LETTER = { orbit: 'o', look: 'l', fly: 'f', surface: 's' };
const MODE = Object.fromEntries(Object.entries(LETTER).map(([k, v]) => [v, k]));
const g7 = (x) => String(Number(x.toPrecision(7)));
const q5 = (x) => String(Number(x.toFixed(5)));

export function encodeCamera(s) {
  if (!s || !LETTER[s.mode]) return null;
  if (s.mode === 'surface') return ['s', q5(s.az), q5(s.alt), q5(s.fov)].join(',');
  const parts = [LETTER[s.mode], ...s.p.map(g7), ...s.q.map(q5), q5(s.fov)];
  if (s.t) parts.push(...s.t.map(g7));
  return parts.join(',');
}

export function decodeCamera(str) {
  if (typeof str !== 'string') return null;
  const [m, ...rest] = str.split(',');
  const mode = MODE[m];
  const n = rest.map(Number);
  if (!mode || !n.every(Number.isFinite)) return null;
  if (mode === 'surface') return n.length === 3 && n[2] > 0 ? { mode, az: n[0], alt: n[1], fov: n[2] } : null;
  if (n.length !== 8 && n.length !== 11) return null;
  const q = n.slice(3, 7), len = Math.hypot(...q);
  if (!(len > 0.5) || !(n[7] > 0 && n[7] < 180)) return null;
  return { mode, p: n.slice(0, 3), q: q.map((v) => v / len), fov: n[7], t: n.length === 11 ? n.slice(8, 11) : null };
}
