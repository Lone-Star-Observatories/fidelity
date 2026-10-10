// Regenerate the paleo-Earth layers for the globe (#54):
//   node scripts/paleoearth.js
// → public/paleo/earth-elev.png  (1440×720, 0.25°, equirectangular, north up, longitude −180 at the left)
//     R: elevation (m), G: the sea level at which this point floods from the open ocean (priority flood,
//     so basins below sea level such as the Caspian or Death Valley only flood once the sea reaches them),
//     B: 255 where it is open ocean today. R and G encode −400…+400 m as 0…255 (clamped).
//     From ETOPO1 Ice Surface (Amante & Eakins 2009) via NOAA CoastWatch ERDDAP (dataset etopo180).
// → public/paleo/ice-<years>.png (1440×720, 255 = ice) for 0, 2,500 … 30,000 years ago: ice-sheet margins
//     from PaleoMIST 1.0 (Gowan et al. 2021; data Gowan 2019, doi:10.1594/PANGAEA.905800, CC BY 4.0),
//     read straight out of the 3.7 GB archive with HTTP range requests (only the margin files are fetched).

import fs from 'node:fs/promises';
import zlib from 'node:zlib';

const W = 1440, H = 720, OUT = new URL('../public/paleo/', import.meta.url);
const UA = { 'user-agent': 'USS-Fidelity data script' };

// ---- a minimal PNG writer ------------------------------------------------------------------------
const CRC = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); };
function png(width, height, channels, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = channels === 3 ? 2 : 0; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc((width * channels + 1) * height);
  for (let y = 0; y < height; y++) { raw[y * (width * channels + 1)] = 0; pixels.copy?.(raw, y * (width * channels + 1) + 1, y * width * channels, (y + 1) * width * channels) ?? raw.set(pixels.subarray(y * width * channels, (y + 1) * width * channels), y * (width * channels + 1) + 1); }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
const enc = (m) => Math.max(0, Math.min(255, Math.round(((m + 400) / 800) * 255)));

// ---- ETOPO1 at 0.25° -----------------------------------------------------------------------------
async function etopo() {
  const url = 'https://coastwatch.pfeg.noaa.gov/erddap/griddap/etopo180.csv?altitude%5B(-90):15:(90)%5D%5B(-180):15:(180)%5D';
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(600000) });
  if (!res.ok) throw new Error(`ERDDAP HTTP ${res.status}`);
  const nodes = new Map(); // "lat,lon" → m
  for (const line of (await res.text()).split('\n').slice(2)) {
    const [la, lo, al] = line.split(',').map(Number);
    if (Number.isFinite(al)) nodes.set(`${la.toFixed(2)},${lo.toFixed(2)}`, al);
  }
  const node = (la, lo) => nodes.get(`${la.toFixed(2)},${lo.toFixed(2)}`) ?? 0;
  const e = new Float32Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const la = 90 - j * 0.25, lo = -180 + i * 0.25; // the pixel's north-west node; average its four corners
    e[j * W + i] = (node(la, lo) + node(la, lo + 0.25) + node(la - 0.25, lo) + node(la - 0.25, lo + 0.25)) / 4;
  }
  return e;
}
const nbrs = (p) => { const j = Math.floor(p / W), i = p % W, out = []; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { if (!di && !dj) continue; const jj = j + dj; if (jj < 0 || jj >= H) continue; out.push(jj * W + ((i + di + W) % W)); } return out; };
/** Open ocean today (connected to the deep sea) and, for every point, the sea level at which it floods. */
function flood(e) {
  const ocean = new Uint8Array(W * H), spill = new Float32Array(W * H).fill(Infinity), done = new Uint8Array(W * H);
  const stack = [];
  for (let p = 0; p < W * H; p++) if (e[p] < -3000) { ocean[p] = 1; stack.push(p); }
  while (stack.length) for (const q of nbrs(stack.pop())) if (!ocean[q] && e[q] < 0) { ocean[q] = 1; stack.push(q); }
  // priority flood (Barnes et al. 2014) from the open ocean
  const heap = [], push = (p, v) => { heap.push([v, p]); let k = heap.length - 1; while (k) { const u = (k - 1) >> 1; if (heap[u][0] <= heap[k][0]) break; [heap[u], heap[k]] = [heap[k], heap[u]]; k = u; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const a = 2 * k + 1, b = a + 1; let m = k; if (a < heap.length && heap[a][0] < heap[m][0]) m = a; if (b < heap.length && heap[b][0] < heap[m][0]) m = b; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
  for (let p = 0; p < W * H; p++) if (ocean[p]) { spill[p] = e[p]; done[p] = 1; for (const q of nbrs(p)) if (!ocean[q] && !done[q]) { done[q] = 1; spill[q] = Math.max(e[q], e[p]); push(q, spill[q]); } }
  while (heap.length) { const [v, p] = pop(); for (const q of nbrs(p)) if (!done[q]) { done[q] = 1; spill[q] = Math.max(e[q], v); push(q, spill[q]); } }
  return { ocean, spill };
}

// ---- PaleoMIST margins through range requests ------------------------------------------------------
const ZIP = 'https://hs.pangaea.de/Maps/Global_Ice_Sheets/Gowan_ice_reconstruction.zip';
async function zipEntries() {
  const range = async (a, b) => { const r = await fetch(ZIP, { headers: { ...UA, range: `bytes=${a}-${b}` } }); if (r.status !== 206) throw new Error(`PANGAEA HTTP ${r.status}`); return Buffer.from(await r.arrayBuffer()); };
  const probe = await fetch(ZIP, { headers: { ...UA, range: 'bytes=0-0' } });
  const size = Number(probe.headers.get('content-range')?.split('/')[1]);
  await probe.arrayBuffer();
  if (!size) throw new Error('PANGAEA: no archive size');
  const tail = await range(size - 65558, size - 1);
  const z = tail.lastIndexOf(Buffer.from([0x50, 0x4b, 0x06, 0x06])), e = tail.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const [cdSize, cdOff] = z >= 0 ? [Number(tail.readBigUInt64LE(z + 40)), Number(tail.readBigUInt64LE(z + 48))] : [tail.readUInt32LE(e + 12), tail.readUInt32LE(e + 16)]; // ZIP64 or plain
  const cd = await range(cdOff, cdOff + cdSize - 1), map = new Map();
  for (let p = 0; p < cd.length;) {
    if (cd.readUInt32LE(p) !== 0x02014b50) break;
    let csize = cd.readUInt32LE(p + 20), off = cd.readUInt32LE(p + 42);
    const method = cd.readUInt16LE(p + 10), fl = cd.readUInt16LE(p + 28), xl = cd.readUInt16LE(p + 30), cl = cd.readUInt16LE(p + 32), usize = cd.readUInt32LE(p + 24);
    const name = cd.toString('utf8', p + 46, p + 46 + fl);
    for (let x = p + 46 + fl; x < p + 46 + fl + xl;) { const id = cd.readUInt16LE(x), len = cd.readUInt16LE(x + 2); if (id === 1) { let q = x + 4; if (usize === 0xffffffff) q += 8; if (csize === 0xffffffff) { csize = Number(cd.readBigUInt64LE(q)); q += 8; } if (off === 0xffffffff) off = Number(cd.readBigUInt64LE(q)); } x += 4 + len; }
    map.set(name, { method, csize, off });
    p += 46 + fl + xl + cl;
  }
  return { map, async read(name) { const en = map.get(name); if (!en) return null; const lh = await range(en.off, en.off + 29); const s = en.off + 30 + lh.readUInt16LE(26) + lh.readUInt16LE(28); const data = await range(s, s + en.csize - 1); return (en.method === 8 ? zlib.inflateRawSync(data) : data).toString('utf8'); } };
}
/** GMT polygon text → rings of [lon, lat] (perimeters and holes alike: filled even-odd). */
function rings(text) {
  const out = []; let cur = null;
  for (const line of text.split('\n')) {
    if (line.startsWith('>') || line.startsWith('# @P') || line.startsWith('# @H')) { if (cur?.length > 2) out.push(cur); cur = []; continue; }
    if (line.startsWith('#') || !line.trim()) continue;
    const [lo, la] = line.trim().split(/\s+/).map(Number);
    if (Number.isFinite(lo) && Number.isFinite(la)) (cur ??= []).push([lo, la]);
  }
  if (cur?.length > 2) out.push(cur);
  return out;
}
/** Even-odd scanline fill of rings in a projection onto an N×N grid; returns sample(lat, lon) → 0/1. */
function rasterise(rs, project, N = 2048, extent = 2) {
  const grid = new Uint8Array(N * N), toPix = ([u, v]) => [((u + extent) / (2 * extent)) * N, ((v + extent) / (2 * extent)) * N];
  const edges = [];
  for (const r of rs) { const pts = r.map(([lo, la]) => toPix(project(la, lo))); for (let k = 0; k < pts.length; k++) { const a = pts[k], b = pts[(k + 1) % pts.length]; if (a[1] !== b[1]) edges.push(a[1] < b[1] ? [a[0], a[1], b[0], b[1]] : [b[0], b[1], a[0], a[1]]); } }
  edges.sort((a, b) => a[1] - b[1]);
  let start = 0; const active = [];
  for (let y = 0; y < N; y++) {
    const yc = y + 0.5;
    while (start < edges.length && edges[start][1] <= yc) active.push(edges[start++]);
    for (let k = active.length - 1; k >= 0; k--) if (active[k][3] <= yc) active.splice(k, 1);
    const xs = active.filter((e) => e[1] <= yc && e[3] > yc).map(([x0, y0, x1, y1]) => x0 + ((yc - y0) / (y1 - y0)) * (x1 - x0)).sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.max(0, Math.ceil(xs[k] - 0.5)); x <= Math.min(N - 1, Math.floor(xs[k + 1] - 0.5)); x++) grid[y * N + x] = 1;
  }
  return (la, lo) => { const [px, py] = toPix(project(la, lo)); const x = Math.floor(px), y = Math.floor(py); return x >= 0 && y >= 0 && x < N && y < N ? grid[y * N + x] : 0; };
}
const D = Math.PI / 180;
const north = (la, lo) => { const r = 2 * Math.tan(((90 - la) / 2) * D); return [r * Math.sin(lo * D), -r * Math.cos(lo * D)]; };
const south = (la, lo) => { const r = 2 * Math.tan(((90 + la) / 2) * D); return [r * Math.sin(lo * D), r * Math.cos(lo * D)]; };
const REGIONS = [['North_America', north, (la) => la > 25], ['Eurasia', north, (la) => la > 25], ['Antarctica', south, (la) => la < -45], ['Patagonia', south, (la) => la < -30]];

await fs.mkdir(OUT, { recursive: true });
const e = await etopo();
const { ocean, spill } = flood(e);
const rgb = Buffer.alloc(W * H * 3);
for (let p = 0; p < W * H; p++) { rgb[p * 3] = enc(e[p]); rgb[p * 3 + 1] = enc(spill[p]); rgb[p * 3 + 2] = ocean[p] ? 255 : 0; }
await fs.writeFile(new URL('earth-elev.png', OUT), png(W, H, 3, rgb));
console.log('earth-elev.png', (await fs.stat(new URL('earth-elev.png', OUT))).size, 'bytes');

const zip = await zipEntries();
for (let t = 0; t <= 30000; t += 2500) {
  const ice = Buffer.alloc(W * H);
  for (const [region, proj, inBand] of REGIONS) {
    const text = await zip.read(`ice_reconstruction/margins/${region}/${t}.gmt`);
    if (!text) continue;
    const sample = rasterise(rings(text), proj, 2048, region === 'Patagonia' ? 1.2 : 2);
    for (let j = 0; j < H; j++) { const la = 90 - (j + 0.5) * 0.25; if (!inBand(la)) continue; for (let i = 0; i < W; i++) if (sample(la, -180 + (i + 0.5) * 0.25)) ice[j * W + i] = 255; }
  }
  await fs.writeFile(new URL(`ice-${t}.png`, OUT), png(W, H, 1, ice));
  console.log(`ice-${t}.png`, (await fs.stat(new URL(`ice-${t}.png`, OUT))).size, 'bytes');
}
