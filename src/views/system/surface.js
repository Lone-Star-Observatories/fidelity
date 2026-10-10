// Surface view (#19 / #23): stand on a body at the point you double-clicked and look up.
// Pure helpers (texture latitude/longitude ⇄ mesh direction, the local horizon frame, the
// look direction for an azimuth/altitude) shared by the System and Planet views.

const DEG = Math.PI / 180;

// three.js SphereGeometry: x = −cos(2πu)·sinθ, y = cosθ, z = sin(2πu)·sinθ, with the map's
// left edge (u = 0) at longitude −180° and east to the right (equirectangular maps).
/** Unit direction in a sphere mesh's local frame → { lat, lon } in degrees (east positive). */
export function dirToLatLon([x, y, z]) {
  const r = Math.hypot(x, y, z) || 1;
  const lat = Math.asin(Math.max(-1, Math.min(1, y / r))) / DEG;
  let u = Math.atan2(z, -x) / (2 * Math.PI);
  if (u < 0) u += 1;
  let lon = u * 360 - 180;
  if (lon > 180) lon -= 360;
  return { lat, lon };
}
/** { lat, lon } (deg) → unit direction in a sphere mesh's local frame. */
export function latLonToDir(lat, lon) {
  const phi = ((lon + 180) / 360) * 2 * Math.PI, c = Math.cos(lat * DEG);
  return [-Math.cos(phi) * c, Math.sin(lat * DEG), Math.sin(phi) * c];
}

const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const r = Math.hypot(...a) || 1; return a.map((v) => v / r); };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/**
 * Local horizon frame at a surface point: `up` (outward normal), `north` (towards the body's
 * north pole along the surface) and `east`. `pole` is the body's spin axis (north) in the same frame.
 */
export function horizonFrame(up, pole) {
  const u = norm(up);
  let e = cross(pole, u);
  if (Math.hypot(...e) < 1e-6) e = cross([1, 0, 0], u); // standing on a pole
  e = norm(e);
  return { up: u, east: e, north: cross(u, e) };
}

/** Look direction and camera-up for azimuth (deg from north through east) and altitude (deg). */
export function lookAt(frame, azDeg, altDeg) {
  const a = azDeg * DEG, h = altDeg * DEG;
  const flat = [0, 1, 2].map((k) => Math.cos(a) * frame.north[k] + Math.sin(a) * frame.east[k]);
  const dir = [0, 1, 2].map((k) => Math.cos(h) * flat[k] + Math.sin(h) * frame.up[k]);
  const camUp = [0, 1, 2].map((k) => -Math.sin(h) * flat[k] + Math.cos(h) * frame.up[k]);
  return { dir, camUp };
}

/** Altitude (deg) of direction `d` above the horizon of `frame`, and its azimuth (deg, from north through east). */
export function altAz(frame, d) {
  const v = norm(d);
  const alt = Math.asin(Math.max(-1, Math.min(1, dot(v, frame.up)))) / DEG;
  let az = Math.atan2(dot(v, frame.east), dot(v, frame.north)) / DEG;
  if (az < 0) az += 360;
  return { alt, az };
}

// Daytime skies (MEASURED colours where photographed: Earth, Mars by Curiosity/Perseverance,
// Venus by Venera 13–14, Titan by Huygens). Values are linear RGB at full daylight.
export const DAY_SKY = {
  earth: { rgb: [0.25, 0.45, 0.85], hidesStars: true, note: 'Blue sky: sunlight scattered by air molecules (Rayleigh scattering).' },
  mars: { rgb: [0.62, 0.48, 0.34], hidesStars: true, note: 'Butterscotch by day (dust); sunsets are blue (Curiosity, Perseverance).' },
  venus: { rgb: [0.55, 0.38, 0.16], hidesStars: true, always: true, note: 'Thick cloud: an orange gloom, never a clear sky; the Sun is never seen (Venera 13/14).' },
  titan: { rgb: [0.42, 0.28, 0.1], hidesStars: true, always: true, note: 'Orange haze: the Sun is a dim smudge and Saturn is hidden (Huygens, 2005).' },
};
/** Daylight fraction from the Sun's altitude: 0 below civil twilight (−6°), 1 above +6°. */
export const daylight = (sunAltDeg) => {
  const t = Math.max(0, Math.min(1, (sunAltDeg + 6) / 12));
  return t * t * (3 - 2 * t);
};
