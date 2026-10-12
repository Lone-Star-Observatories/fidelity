// The operator's station location for COMMS (and FROM EARTH, which shares the `observer` setting):
// Maidenhead grid squares, the amateur-radio way to give a location ("EM12kx"), and a parser for
// what people type: a grid square, "32.78, -96.80", or "32.78 N 96.80 W".

const A = 'A'.charCodeAt(0);

/** Maidenhead locator for a point: 4, 6 or 8 characters (field, square, subsquare, extended square). */
export function toGrid(lat, lon, chars = 6) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  let x = ((((lon + 180) % 360) + 360) % 360), y = Math.min(179.9999999, Math.max(0, lat + 90));
  let s = String.fromCharCode(A + Math.floor(x / 20), A + Math.floor(y / 10));
  x %= 20; y %= 10;
  s += `${Math.floor(x / 2)}${Math.floor(y)}`;
  x %= 2; y %= 1;
  if (chars >= 6) { s += String.fromCharCode(A + 32 + Math.floor(x * 12), A + 32 + Math.floor(y * 24)); x = (x * 12) % 1; y = (y * 24) % 1; }
  if (chars >= 8) s += `${Math.floor(x * 10)}${Math.floor(y * 10)}`;
  return s;
}

/** Centre of a Maidenhead locator (2–8 characters), or null if it isn't one. */
export function fromGrid(grid) {
  const g = String(grid ?? '').trim();
  if (!/^[A-R]{2}(\d\d([A-X]{2}(\d\d)?)?)?$/i.test(g)) return null;
  const u = g.toUpperCase();
  let lon = (u.charCodeAt(0) - A) * 20 - 180, lat = (u.charCodeAt(1) - A) * 10 - 90, w = 20, h = 10;
  if (u.length >= 4) { lon += Number(u[2]) * 2; lat += Number(u[3]); w = 2; h = 1; }
  if (u.length >= 6) { lon += (u.charCodeAt(4) - A) * (2 / 24); lat += (u.charCodeAt(5) - A) * (1 / 24); w = 2 / 24; h = 1 / 24; }
  if (u.length >= 8) { lon += Number(u[6]) * (2 / 240); lat += Number(u[7]) * (1 / 240); w = 2 / 240; h = 1 / 240; }
  return { lat: lat + h / 2, lon: lon + w / 2 };
}

/**
 * What an operator types for their location → { lat, lon, grid, label } or null: a grid square
 * ("EM12kx"), decimal degrees ("32.78, -96.80") or hemispheres ("32.78N 96.80W", "32.78 N, 96.80 W").
 */
export function parseLocation(text) {
  const t = String(text ?? '').trim();
  const g = fromGrid(t);
  if (g) return station(g.lat, g.lon);
  const m = t.match(/^\s*([-+]?\d+(?:\.\d+)?)\s*°?\s*([NS])?\s*[,;\s]\s*([-+]?\d+(?:\.\d+)?)\s*°?\s*([EW])?\s*$/i);
  if (!m) return null;
  let lat = Number(m[1]), lon = Number(m[3]);
  if (m[2]?.toUpperCase() === 'S') lat = -Math.abs(lat);
  if (m[4]?.toUpperCase() === 'W') lon = -Math.abs(lon);
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return station(lat, lon);
}

/** A station location as stored in the `observer` setting, with its grid square. */
export function station(lat, lon, label = null) {
  const r = (v) => Math.round(v * 1e4) / 1e4;
  const grid = toGrid(lat, lon, 6);
  return { lat: r(lat), lon: r(lon), grid, label: label ?? `${Math.abs(lat).toFixed(3)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(3)}°${lon >= 0 ? 'E' : 'W'}` };
}

/**
 * Why no local receiver shows up, from /api/rf/devices' tool probe: one line per thing to fix.
 * `d` = { rx, tools }.
 */
export function sdrDiagnosis(d) {
  if (!d) return ['The local backend is not answering (run npm start on the machine with the radio).'];
  if (d.rx?.length) return [];
  const t = d.tools ?? {}, out = [];
  if (!t.bladeRF_cli && !t.SoapySDRUtil) out.push('bladeRF: bladeRF-cli was not found. Install libbladeRF (it provides bladeRF-cli), then RESCAN.');
  else if (t.bladeRF_cli) out.push('bladeRF: bladeRF-cli is installed but found no board. Check the USB cable and port (USB 3 for full speed); `bladeRF-cli -p` should list a serial number.');
  if (!t.rtl_test) out.push('RTL-SDR: rtl_test was not found (install rtl-sdr) — only needed for an RTL-SDR dongle.');
  else out.push('RTL-SDR: rtl-sdr is installed but no dongle was found.');
  if (t.hackrf_info) out.push('HackRF: hackrf_info found no board.');
  out.push('Another program holding the radio (SDR#, GQRX, SDR++) stops it being detected: close it, then RESCAN.');
  return out;
}
