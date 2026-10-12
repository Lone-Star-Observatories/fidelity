// Elevation models (#80): the pure parts, shared by the browser, the build script and the tests.
//
// Every bundled DEM uses one convention, whatever its source: an equirectangular grid of
// `width` × `height` cells (pixel-is-area), row 0 at the north pole, column 0 starting at 180° W,
// longitude east-positive and planetocentric latitude. Heights are metres above the body's own
// reference surface (MOLA areoid, the LOLA 1737.4 km sphere, mean sea level…), stored as 16-bit
// PNG greyscale: 0 = no data, 1…65535 = min…max metres (min/max kept in public/dem/index.json).
// A body's colour map may start elsewhere (texLon0, e.g. Pluto's starts at 0°): demU() converts.

export const NODATA = 0;
const DEG = Math.PI / 180;

/** Relief settings (the RELIEF control): vertical exaggeration; 0 = off, 1 = true heights. */
export const RELIEF_MODES = [
  { id: 'off', k: 0, label: 'OFF' },
  { id: 'true', k: 1, label: 'TRUE' },
  { id: 'x2', k: 2, label: '×2' },
  { id: 'x5', k: 5, label: '×5' },
  { id: 'x10', k: 10, label: '×10' },
  { id: 'x20', k: 20, label: '×20' },
];
export const reliefK = (id) => RELIEF_MODES.find((m) => m.id === id)?.k ?? 1;
export const reliefLabel = (id) => { const k = reliefK(id); return k === 0 ? 'OFF' : k === 1 ? 'TRUE HEIGHTS' : `HEIGHTS ×${k} (EXAGGERATED)`; };

// ---- 16-bit PNG ---------------------------------------------------------------------------------
const SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const be32 = (b, o) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;

/** Split a PNG into its header and concatenated IDAT bytes (zlib stream). Greyscale 16-bit only. */
export function pngChunks(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < 8; i++) if (b[i] !== SIG[i]) throw new Error('not a PNG');
  let o = 8, width = 0, height = 0, depth = 0, type = 0, interlace = 0;
  const idat = [];
  const text = {};
  while (o < b.length) {
    const len = be32(b, o), kind = String.fromCharCode(b[o + 4], b[o + 5], b[o + 6], b[o + 7]);
    const d = b.subarray(o + 8, o + 8 + len);
    if (kind === 'IHDR') { width = be32(d, 0); height = be32(d, 4); depth = d[8]; type = d[9]; interlace = d[12]; }
    else if (kind === 'IDAT') idat.push(d);
    else if (kind === 'tEXt') { const z = d.indexOf(0); text[String.fromCharCode(...d.subarray(0, z))] = String.fromCharCode(...d.subarray(z + 1)); }
    else if (kind === 'IEND') break;
    o += 12 + len;
  }
  if (depth !== 16 || type !== 0 || interlace) throw new Error(`not a 16-bit greyscale PNG (depth ${depth}, type ${type})`);
  const n = idat.reduce((s, d) => s + d.length, 0), z = new Uint8Array(n);
  let p = 0;
  for (const d of idat) { z.set(d, p); p += d.length; }
  return { width, height, zlib: z, text };
}

/** Undo the PNG row filters of inflated 16-bit greyscale scanlines → Uint16Array (width × height). */
export function unfilter16(raw, width, height) {
  const stride = width * 2, bpp = 2, px = new Uint8Array(stride * height);
  for (let y = 0, r = 0; y < height; y++, r += stride + 1) {
    const f = raw[r], o = y * stride, u = o - stride;
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? px[o + i - bpp] : 0, b = y ? px[u + i] : 0, c = y && i >= bpp ? px[u + i - bpp] : 0;
      let v = raw[r + 1 + i];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const q = a + b - c, pa = Math.abs(q - a), pb = Math.abs(q - b), pc = Math.abs(q - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      px[o + i] = v & 255;
    }
  }
  const out = new Uint16Array(width * height);
  for (let i = 0; i < out.length; i++) out[i] = (px[2 * i] << 8) | px[2 * i + 1];
  return out;
}

/** Decode a 16-bit greyscale PNG with a zlib `inflate(Uint8Array) → Uint8Array | Promise` of your choice. */
export async function decodePng16(bytes, inflate) {
  const { width, height, zlib, text } = pngChunks(bytes);
  const raw = await inflate(zlib);
  return { width, height, data: unfilter16(raw instanceof Uint8Array ? raw : new Uint8Array(raw), width, height), text };
}

/** Encode Uint16Array grey samples as PNG scanlines (best of the five filters per row), ready for deflate. */
export function filter16(data, width, height) {
  const stride = width * 2, bytes = new Uint8Array(stride * height);
  for (let i = 0; i < data.length; i++) { bytes[2 * i] = data[i] >> 8; bytes[2 * i + 1] = data[i] & 255; }
  const out = new Uint8Array((stride + 1) * height), line = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const o = y * stride, u = o - stride;
    let best = null, bestScore = Infinity, bestF = 0;
    for (let f = 0; f < 5; f++) {
      let score = 0;
      for (let i = 0; i < stride; i++) {
        const a = i >= 2 ? bytes[o + i - 2] : 0, b = y ? bytes[u + i] : 0, c = y && i >= 2 ? bytes[u + i - 2] : 0, x = bytes[o + i];
        let p = 0;
        if (f === 1) p = a; else if (f === 2) p = b; else if (f === 3) p = (a + b) >> 1;
        else if (f === 4) { const q = a + b - c, pa = Math.abs(q - a), pb = Math.abs(q - b), pc = Math.abs(q - c); p = pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
        const v = (x - p) & 255;
        line[i] = v;
        score += v < 128 ? v : 256 - v;
      }
      if (score < bestScore) { bestScore = score; bestF = f; best = line.slice(); }
    }
    out[y * (stride + 1)] = bestF;
    out.set(best, y * (stride + 1) + 1);
  }
  return out;
}

// ---- quantisation ------------------------------------------------------------------------------
/** Heights (metres; NaN = no data) → { data: Uint16Array, min, max } with 0 kept for no data. */
export function quantize(heights) {
  let min = Infinity, max = -Infinity;
  for (const h of heights) if (Number.isFinite(h)) { if (h < min) min = h; if (h > max) max = h; }
  if (!Number.isFinite(min)) { min = 0; max = 1; }
  min = Math.floor(min); max = Math.ceil(max);
  if (max <= min) max = min + 1;
  const data = new Uint16Array(heights.length), k = 65534 / (max - min);
  for (let i = 0; i < heights.length; i++) data[i] = Number.isFinite(heights[i]) ? 1 + Math.round((heights[i] - min) * k) : NODATA;
  return { data, min, max };
}

/** Quantised samples back to metres (Float32Array, NaN = no data). */
export function dequantize(data, min, max) {
  const out = new Float32Array(data.length), k = (max - min) / 65534;
  for (let i = 0; i < data.length; i++) out[i] = data[i] === NODATA ? NaN : min + (data[i] - 1) * k;
  return out;
}

/** One step of the quantisation (metres): the finest height difference the PNG can hold. */
export const quantStep = (min, max) => (max - min) / 65534;

// ---- conventions -------------------------------------------------------------------------------
const wrap360 = (x) => ((x % 360) + 360) % 360;

/** Grid position (fractional column, row; cell centres at integers) of planetocentric lat / east lon. */
export function demXY(width, height, lat, lon) {
  return [wrap360(lon + 180) / 360 * width - 0.5, (90 - lat) / 180 * height - 0.5];
}

/** Cell (column, row) → lat / east lon of its centre, lon in −180…180. */
export function cellLatLon(width, height, x, y) {
  return { lat: 90 - ((y + 0.5) / height) * 180, lon: -180 + ((x + 0.5) / width) * 360 };
}

/** The DEM's u (0…1, canonical) at a body mesh's u: the mesh's colour map starts at texLon0 (default −180°). */
export const demUOffset = (texLon0 = -180) => (texLon0 + 180) / 360;

// ---- sampling ----------------------------------------------------------------------------------
/** Bilinear height (metres) at lat / east lon; longitude wraps, latitude clamps; NaN-aware (no-data cells skipped). */
export function sampleDem(dem, lat, lon) {
  const { width: W, height: H, heights } = dem;
  const [fx, fy] = demXY(W, H, lat, lon);
  const y0 = Math.floor(fy), x0 = Math.floor(fx), ty = fy - y0, tx = fx - x0;
  let s = 0, w = 0;
  for (let j = 0; j < 2; j++) {
    const y = Math.max(0, Math.min(H - 1, y0 + j)), wy = j ? ty : 1 - ty;
    for (let i = 0; i < 2; i++) {
      const x = (((x0 + i) % W) + W) % W, wt = wy * (i ? tx : 1 - tx), h = heights[y * W + x];
      if (wt > 0 && Number.isFinite(h)) { s += h * wt; w += wt; }
    }
  }
  return w > 1e-9 ? s / w : NaN;
}

/** Highest and lowest cells within `radiusDeg` (great-circle) of lat/lon: { max: {h,lat,lon}, min: {h,lat,lon} }. */
export function extremaNear(dem, lat, lon, radiusDeg) {
  const { width: W, height: H, heights } = dem;
  const [, cy] = demXY(W, H, lat, lon);
  const dy = Math.ceil((radiusDeg / 180) * H) + 1;
  let max = { h: -Infinity }, min = { h: Infinity };
  const c = Math.cos(radiusDeg * DEG);
  const p = latLonVec(lat, lon);
  for (let y = Math.max(0, Math.floor(cy) - dy); y <= Math.min(H - 1, Math.ceil(cy) + dy); y++) {
    for (let x = 0; x < W; x++) {
      const ll = cellLatLon(W, H, x, y), q = latLonVec(ll.lat, ll.lon);
      if (p[0] * q[0] + p[1] * q[1] + p[2] * q[2] < c) continue;
      const h = heights[y * W + x];
      if (!Number.isFinite(h)) continue;
      if (h > max.h) max = { h, ...ll };
      if (h < min.h) min = { h, ...ll };
    }
  }
  return { max, min };
}
const latLonVec = (lat, lon) => [Math.cos(lat * DEG) * Math.cos(lon * DEG), Math.cos(lat * DEG) * Math.sin(lon * DEG), Math.sin(lat * DEG)];

// ---- geometry ----------------------------------------------------------------------------------
/**
 * Radius of the drawn surface in units of the body's radius: 1 + k·h / R, for height h (m) above the
 * DEM's reference, exaggeration k and body radius R (km). No data or relief off → the plain sphere.
 */
export function heightToRadius(hM, radiusKm, k = 1) {
  return Number.isFinite(hM) && k > 0 ? 1 + (k * hM) / (radiusKm * 1000) : 1;
}

/**
 * Surface slope and normal at lat/lon from central differences over `stepCells` cells: the east and
 * north gradients (dimensionless, rise over run on the body's sphere, ×k) and the unit normal in the
 * local east-north-up frame, (−sE, −sN, 1) normalised. This is the normal map the globe's shader
 * derives on the GPU from the same heights.
 */
export function slopeNormal(dem, lat, lon, radiusKm, k = 1, stepCells = 1) {
  const R = radiusKm * 1000, dLon = (360 / dem.width) * stepCells, dLat = (180 / dem.height) * stepCells;
  const c = Math.max(Math.cos(lat * DEG), 1e-3);
  const hE = sampleDem(dem, lat, lon + dLon), hW = sampleDem(dem, lat, lon - dLon);
  const hN = sampleDem(dem, Math.min(90, lat + dLat), lon), hS = sampleDem(dem, Math.max(-90, lat - dLat), lon);
  const sE = Number.isFinite(hE - hW) ? (k * (hE - hW)) / (2 * dLon * DEG * R * c) : 0;
  const sN = Number.isFinite(hN - hS) ? (k * (hN - hS)) / (2 * dLat * DEG * R) : 0;
  const n = Math.hypot(sE, sN, 1);
  return { sE, sN, normal: [-sE / n, -sN / n, 1 / n], slopeDeg: Math.atan(Math.hypot(sE, sN)) / DEG };
}

/** A Lambertian hillshade (0…1) for a sun at azimuth/altitude (deg) over the local normal [e, n, u]. */
export function hillshade(normal, azDeg, altDeg) {
  const a = azDeg * DEG, h = altDeg * DEG;
  const s = [Math.sin(a) * Math.cos(h), Math.cos(a) * Math.cos(h), Math.sin(h)];
  return Math.max(0, normal[0] * s[0] + normal[1] * s[1] + normal[2] * s[2]);
}

/** Box-average a DEM's heights down by an integer-or-not factor to (W × H), skipping no-data cells. */
export function downsample({ width: w, height: h, heights }, W, H) {
  const out = new Float32Array(W * H);
  for (let Y = 0; Y < H; Y++) {
    const y0 = Math.floor((Y * h) / H), y1 = Math.max(y0 + 1, Math.floor(((Y + 1) * h) / H));
    for (let X = 0; X < W; X++) {
      const x0 = Math.floor((X * w) / W), x1 = Math.max(x0 + 1, Math.floor(((X + 1) * w) / W));
      let s = 0, n = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const v = heights[y * w + x]; if (Number.isFinite(v)) { s += v; n++; } }
      out[Y * W + X] = n ? s / n : NaN;
    }
  }
  return { width: W, height: H, heights: out };
}

/**
 * Heights for drawing where a DEM has gaps (Venus' altimetry strips, Pluto's and Charon's unseen
 * hemispheres): no-data cells take a smooth fill that eases from the surrounding data back to the
 * reference surface (0) with distance, so the globe and the terrain patches have no cliffs at the edge of
 * the data. Solved on a coarse grid (diffusion, `decay` per pass) and interpolated back. Read-outs keep
 * the true NaN ("no data"); this is only what is drawn there.
 */
export function fillGaps({ width: W, height: H, heights }, { coarse = 360, passes = 600, decay = 0.9995 } = {}) {
  let gaps = 0;
  for (const h of heights) if (!Number.isFinite(h)) gaps++;
  if (!gaps) return heights;
  const cw = Math.min(coarse, W), ch = Math.round((cw * H) / W);
  const c = downsample({ width: W, height: H, heights }, cw, ch).heights;
  const known = Uint8Array.from(c, (v) => (Number.isFinite(v) ? 1 : 0));
  let cur = Float32Array.from(c, (v) => (Number.isFinite(v) ? v : 0)), next = new Float32Array(cur.length);
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      const i = y * cw + x;
      if (known[i]) { next[i] = cur[i]; continue; }
      const e = cur[y * cw + (x + 1) % cw], w = cur[y * cw + (x + cw - 1) % cw];
      const n = cur[Math.max(0, y - 1) * cw + x], s = cur[Math.min(ch - 1, y + 1) * cw + x];
      next[i] = ((e + w + n + s) / 4) * decay;
    }
    [cur, next] = [next, cur];
  }
  const coarseDem = { width: cw, height: ch, heights: cur }, out = new Float32Array(heights.length);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, h = heights[i];
    if (Number.isFinite(h)) { out[i] = h; continue; }
    const { lat, lon } = cellLatLon(W, H, x, y);
    out[i] = sampleDem(coarseDem, lat, lon);
  }
  return out;
}

/** Elevation for the panel: "+21,229 M" / "−8,180 M", or km above 10 km when asked. */
export function fmtElevation(hM, { km = false } = {}) {
  if (!Number.isFinite(hM)) return 'NO DATA';
  const sign = hM < 0 ? '−' : '+';
  if (km && Math.abs(hM) >= 10000) return `${sign}${(Math.abs(hM) / 1000).toFixed(2)} KM`;
  return `${sign}${Math.round(Math.abs(hM)).toLocaleString('en')} M`;
}
