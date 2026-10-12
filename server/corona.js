// Where today's corona is structured (#79): a small JSON summary measured on today's Helioviewer images,
// for the 3D corona the System and Star views draw around the Sun (src/views/system/corona.js).
//
//   streamers  SOHO LASCO C2 (2–6 R☉) or, when C2 is stale, C3 (4–30 R☉) white-light coronagraph:
//              brightness round an annulus by position angle (PA, degrees counter-clockwise from solar
//              north through east), each ring divided by its own median so the radial fall-off cancels;
//              the peaks are the streamers (PA, width, contrast). The coronagraph sees them projected on
//              the sky, so the views place them in the plane of the sky (the classic assumption).
//   regions    SDO AIA 193 Å (1.5 MK): bright patches on the disc (active regions, their loops);
//   holes      the dark ones (coronal holes, where the fast wind and polar plumes come from).
//              Both in image coordinates: x towards solar west (right), y towards solar north (up), in
//              disc radii, so the views can put them exactly where the disc image shows them.
//
// Helioviewer screenshots are rotated to solar north up and centred on the Sun, so position angle and
// disc coordinates come straight from pixel positions. No image is passed on, only the numbers.

import { decodePng } from './solarmodel.js';

const RSUN_ARCSEC = 959.63;
const DAY = 86400000;
const lum = (d, k) => 0.299 * d[k] + 0.587 * d[k + 1] + 0.114 * d[k + 2];
const median = (a) => { if (!a.length) return 0; const s = Float64Array.from(a).sort(); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

/**
 * Brightness by position angle round a coronagraph image: `img` { w, h, rgba }, `rsunPx` the solar radius in
 * pixels, rings from r0 to r1 (R☉). Returns { profile: contrast per bin (1 = the ring median), bins }.
 * Black pixels (occulter, pylon, outside the field) are ignored, and each bin takes the median so stars drop out.
 */
export function paProfile(img, rsunPx, { r0 = 2.5, r1 = 4, rings = 6, bins = 72 } = {}) {
  const { w, h, rgba } = img, cx = (w - 1) / 2, cy = (h - 1) / 2;
  const perRing = [];
  for (let i = 0; i < rings; i++) {
    const ra = r0 + ((r1 - r0) * i) / rings, rb = r0 + ((r1 - r0) * (i + 1)) / rings;
    const cells = Array.from({ length: bins }, () => []);
    const pa = rb * rsunPx, pb = ra * rsunPx;
    for (let y = Math.max(0, Math.floor(cy - pa)); y <= Math.min(h - 1, Math.ceil(cy + pa)); y++) {
      for (let x = Math.max(0, Math.floor(cx - pa)); x <= Math.min(w - 1, Math.ceil(cx + pa)); x++) {
        const dx = x - cx, dy = cy - y, rr = Math.hypot(dx, dy);
        if (rr < pb || rr >= pa) continue;
        const k = (y * w + x) * 4, v = lum(rgba, k);
        if (v < 2 || rgba[k + 3] < 128) continue; // occulter, pylon, no data
        // PA: from north (up), counter-clockwise on the sky, i.e. towards east = image left
        const ang = (Math.atan2(-dx, dy) * 180) / Math.PI;
        cells[Math.floor((((ang % 360) + 360) % 360) / (360 / bins)) % bins].push(v);
      }
    }
    const vals = cells.map((c) => (c.length >= 2 ? median(c) : null));
    const m = median(vals.filter((v) => v != null));
    if (m > 0) perRing.push(vals.map((v) => (v == null ? null : v / m)));
  }
  const profile = Array.from({ length: bins }, (_, b) => { const v = perRing.map((r) => r[b]).filter((x) => x != null); return v.length ? median(v) : null; });
  // fill gaps (the pylon) from the neighbours, so it neither makes nor hides a streamer
  for (let b = 0; b < bins; b++) if (profile[b] == null) {
    let l = 1, r = 1;
    while (l < bins && profile[(b - l + bins) % bins] == null) l++;
    while (r < bins && profile[(b + r) % bins] == null) r++;
    const a = profile[(b - l + bins) % bins], c = profile[(b + r) % bins];
    profile[b] = a == null || c == null ? 1 : a + ((c - a) * l) / (l + r);
  }
  return { profile, bins };
}

/** Streamers: local maxima of the (circularly smoothed) PA profile above `min` contrast; { pa, width (deg, FWHM), strength }. */
export function findStreamers(profile, { min = 1.12, max = 8 } = {}) {
  const n = profile.length, step = 360 / n, at = (i) => profile[((i % n) + n) % n];
  const s = profile.map((_, i) => 0.25 * at(i - 1) + 0.5 * at(i) + 0.25 * at(i + 1));
  const sa = (i) => s[((i % n) + n) % n];
  const base = median(s);
  const out = [];
  for (let i = 0; i < n; i++) {
    if (!(s[i] > sa(i - 1) && s[i] >= sa(i + 1) && s[i] / base >= min)) continue;
    const half = base + (s[i] - base) / 2;
    let l = 0, r = 0;
    while (l < n / 4 && sa(i - l - 1) > half) l++;
    while (r < n / 4 && sa(i + r + 1) > half) r++;
    // sub-bin peak position from a parabola through the three samples
    const y0 = sa(i - 1), y1 = s[i], y2 = sa(i + 1), den = y0 - 2 * y1 + y2;
    const off = den < 0 ? Math.max(-0.5, Math.min(0.5, (0.5 * (y0 - y2)) / den)) : 0;
    out.push({ pa: Math.round((((i + 0.5 + off) * step) % 360) * 10) / 10, width: Math.max(step, (l + r + 1) * step), strength: Math.round((s[i] / base - 1) * 1000) / 1000 });
  }
  return out.sort((a, b) => b.strength - a.strength).slice(0, max);
}

/** The streamer belt's two limb crossings: the strongest streamer within 50° of the equator on each limb (latitude, degrees). */
export function beltFromStreamers(streamers) {
  const lat = (pa) => (pa <= 180 ? 90 - pa : pa - 270); // east limb: PA 90 is the equator; west limb: PA 270
  const east = streamers.find((s) => s.pa > 0 && s.pa < 180 && Math.abs(lat(s.pa)) <= 50);
  const west = streamers.find((s) => s.pa > 180 && s.pa < 360 && Math.abs(lat(s.pa)) <= 50);
  return east || west ? { east: east ? lat(east.pa) : null, west: west ? lat(west.pa) : null } : null;
}

/**
 * Bright (active regions) and dark (coronal holes) patches on an EUV disc image: `img` { w, h, rgba }, `diskFrac`
 * the solar radius as a fraction of the image width. The disc inside 0.98 R☉ is cut into cells; cells above
 * `bright` × the median of their ring (so limb brightening cancels) are regions, below `dark` × it holes;
 * neighbouring cells join.
 * Returns { regions: [{ x, y, size, strength }], holes: [{ x, y, size, depth }] } (x west, y north, disc radii).
 */
export function discPatches(img, diskFrac, { cell = 0.1, bright = 1.7, dark = 0.5, maxRegions = 8, maxHoles = 6 } = {}) {
  const { w, h, rgba } = img, R = diskFrac * w, cx = (w - 1) / 2, cy = (h - 1) / 2;
  const n = Math.ceil(2 / cell), grid = new Float64Array(n * n).fill(NaN);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x0 = -1 + i * cell, y0 = 1 - (j + 1) * cell, xc = x0 + cell / 2, yc = y0 + cell / 2;
    if (Math.hypot(xc, yc) > 0.98) continue;
    let sum = 0, cnt = 0;
    for (let py = Math.floor(cy - (y0 + cell) * R); py < cy - y0 * R; py++) for (let px = Math.floor(cx + x0 * R); px < cx + (x0 + cell) * R; px++) {
      if (px < 0 || py < 0 || px >= w || py >= h) continue;
      sum += lum(rgba, (py * w + px) * 4); cnt++;
    }
    if (cnt) grid[j * n + i] = sum / cnt;
  }
  // EUV limb brightening: each cell against the median of its own ring (0.2 R☉ wide), so limb regions count too
  const ringOf = (c) => { const i = c % n, j = (c - i) / n; return Math.min(4, Math.floor(Math.hypot(-1 + (i + 0.5) * cell, 1 - (j + 0.5) * cell) / 0.2)); };
  const ringMed = [0, 1, 2, 3, 4].map((r) => median([...grid.keys()].filter((c) => !Number.isNaN(grid[c]) && ringOf(c) === r).map((c) => grid[c])));
  for (let c = 0; c < n * n; c++) if (!Number.isNaN(grid[c])) grid[c] /= ringMed[ringOf(c)] || 1;
  const m = 1;
  const blobs = (test) => {
    const seen = new Uint8Array(n * n), out = [];
    for (let s = 0; s < n * n; s++) {
      if (seen[s] || Number.isNaN(grid[s]) || !test(grid[s])) continue;
      const stack = [s], cells = [];
      seen[s] = 1;
      while (stack.length) {
        const c = stack.pop(); cells.push(c);
        const ci = c % n, cj = (c - ci) / n;
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const ni = ci + di, nj = cj + dj, k = nj * n + ni;
          if (ni < 0 || nj < 0 || ni >= n || nj >= n || seen[k] || Number.isNaN(grid[k]) || !test(grid[k])) continue;
          seen[k] = 1; stack.push(k);
        }
      }
      let x = 0, y = 0, v = 0;
      for (const c of cells) { const i = c % n, j = (c - i) / n; x += -1 + (i + 0.5) * cell; y += 1 - (j + 0.5) * cell; v += grid[c]; }
      out.push({ x: x / cells.length, y: y / cells.length, size: Math.sqrt(cells.length) * cell, level: v / cells.length / m, cells: cells.length });
    }
    return out;
  };
  const r3 = (v) => Math.round(v * 1000) / 1000;
  const regions = blobs((v) => v >= bright * m).sort((a, b) => b.level * b.cells - a.level * a.cells).slice(0, maxRegions)
    .map((b) => ({ x: r3(b.x), y: r3(b.y), size: r3(b.size), strength: r3(b.level) }));
  const holes = blobs((v) => v <= dark * m).filter((b) => b.cells >= 2).sort((a, b) => b.cells - a.cells).slice(0, maxHoles)
    .map((b) => ({ x: r3(b.x), y: r3(b.y), size: r3(b.size), depth: r3(1 - b.level) }));
  return { regions, holes };
}

/** A feed (server/feeds.js) of the structure: `c2()`, `c3()`, `euv()` give { body, time, disk, credit } images. */
export const coronaFeed = ({ c2, c3, euv, now = () => Date.now() }) => ({
  type: 'json', ttl: 60 * 60000, credit: 'Corona structure measured on ESA/NASA SOHO LASCO and NASA SDO AIA 193 Å images, via Helioviewer',
  async get() {
    const body = { streamers: [], belt: null, profile: null, regions: [], holes: [], sources: {} };
    // the coronagraph: C2 (closer in) if it is fresh, else C3; either if within 10 days
    const age = (t) => (t ? (now() - Date.parse(t)) / DAY : Infinity);
    const tryImg = async (get) => { try { const f = await get(); return { ...f, img: decodePng(f.body) }; } catch { return null; } };
    let cg = await tryImg(c2), which = 'C2';
    if (!cg || age(cg.time) > 3) { const g3 = await tryImg(c3); if (g3 && (!cg || age(g3.time) < age(cg.time))) { cg = g3; which = 'C3'; } }
    if (cg && age(cg.time) <= 10) {
      // C2: 11.9″/px at 1024 px, rings 2.5–4 R☉; C3: 56″/px, rings 5.5–9 R☉ (outside its larger occulter)
      const scale = (which === 'C2' ? 11.9 : 56) * (1024 / cg.img.w), rsunPx = RSUN_ARCSEC / scale;
      const { profile } = paProfile(cg.img, rsunPx, which === 'C2' ? { r0: 2.5, r1: 4 } : { r0: 5.5, r1: 9 });
      body.profile = profile.map((v) => Math.round(v * 1000) / 1000);
      body.streamers = findStreamers(profile);
      body.belt = beltFromStreamers(body.streamers);
      body.sources.coronagraph = { instrument: `SOHO LASCO ${which}`, time: cg.time, credit: cg.credit };
    }
    const e = await tryImg(euv);
    if (e && e.disk) {
      Object.assign(body, discPatches(e.img, e.disk));
      body.sources.euv = { instrument: 'SDO AIA 193 Å', time: e.time, credit: e.credit };
    }
    if (!body.sources.coronagraph && !body.sources.euv) throw new Error('no corona images available');
    return { body, time: body.sources.euv?.time ?? body.sources.coronagraph?.time ?? new Date(now()).toISOString() };
  },
});
