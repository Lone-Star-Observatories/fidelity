// Shrink a huge uncompressed 8-bit greyscale GeoTIFF (USGS planetary mosaics) to a small PNG
// without downloading it all: read the strip table, then fetch only the rows we sample with
// HTTP range requests. Dependency-free: TIFF parsing by hand, PNG via node:zlib.

import zlib from 'node:zlib';

const UA = 'USS-Fidelity/0.3 (local astronomy explorer)';

async function range(url, start, end) {
  const res = await fetch(url, { headers: { range: `bytes=${start}-${end}`, 'user-agent': UA }, signal: AbortSignal.timeout(60000) });
  if (res.status !== 206 && res.status !== 200) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return res.status === 200 ? buf.subarray(start, end + 1) : buf;
}

/** Parse the first IFD's tags we need. `read(start, end)` returns bytes of the file. */
export async function readTiffLayout(read) {
  const head = await read(0, 15);
  const le = head.toString('latin1', 0, 2) === 'II';
  const u16 = (b, o) => (le ? b.readUInt16LE(o) : b.readUInt16BE(o));
  const u32 = (b, o) => (le ? b.readUInt32LE(o) : b.readUInt32BE(o));
  if (u16(head, 2) !== 42) throw new Error('not a classic TIFF');
  const ifd = u32(head, 4);
  const n = u16(await read(ifd, ifd + 1), 0);
  const entries = await read(ifd + 2, ifd + 2 + n * 12 - 1);
  const tags = {};
  for (let k = 0; k < n; k++) {
    const o = k * 12, tag = u16(entries, o), type = u16(entries, o + 2), count = u32(entries, o + 4);
    const size = type === 3 ? 2 : 4;
    const inline = count * size <= 4;
    tags[tag] = { type, count, value: inline ? (type === 3 ? u16(entries, o + 8) : u32(entries, o + 8)) : null, offset: inline ? null : u32(entries, o + 8) };
  }
  const array = async (t) => {
    if (!t) return null;
    if (t.offset == null) return [t.value];
    const size = t.type === 3 ? 2 : 4, b = await read(t.offset, t.offset + t.count * size - 1);
    return Array.from({ length: t.count }, (_, i) => (size === 2 ? u16(b, i * 2) : u32(b, i * 4)));
  };
  const W = tags[256].value, H = tags[257].value;
  const bits = tags[258]?.value ?? 1, spp = tags[277]?.value ?? 1, compression = tags[259]?.value ?? 1;
  if (bits !== 8 || spp !== 1 || compression !== 1) throw new Error(`unsupported TIFF (bits ${bits}, samples ${spp}, compression ${compression})`);
  return { W, H, rowsPerStrip: tags[278]?.value ?? H, stripOffsets: await array(tags[273]) };
}

const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = (buf) => { let c = -1; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

/** 8-bit greyscale PNG from `pixels` (Uint8Array, w×h). */
export function greyPng(pixels, w, h) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 0; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc((w + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w + 1)] = 0; raw.set(pixels.subarray(y * w, (y + 1) * w), y * (w + 1) + 1); }
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

/** Download-free shrink of a remote TIFF to `outW` pixels wide (box-averaged across, point-sampled down). */
export async function sampleTiff(url, outW = 2048, concurrency = 12) {
  const layout = await readTiffLayout((a, b) => range(url, a, b));
  const { W, H, rowsPerStrip, stripOffsets } = layout;
  const w = Math.min(outW, W), h = Math.round((H * w) / W);
  const out = new Uint8Array(w * h);
  const rowOffset = (r) => stripOffsets[Math.floor(r / rowsPerStrip)] + (r % rowsPerStrip) * W;
  let next = 0;
  const worker = async () => {
    while (next < h) {
      const y = next++;
      const r = Math.min(H - 1, Math.floor(((y + 0.5) * H) / h));
      const o = rowOffset(r);
      const row = await range(url, o, o + W - 1);
      for (let x = 0; x < w; x++) {
        const a = Math.floor((x * W) / w), b = Math.max(a + 1, Math.floor(((x + 1) * W) / w));
        let s = 0;
        for (let k = a; k < b; k++) s += row[k];
        out[y * w + x] = Math.round(s / (b - a));
      }
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  return greyPng(out, w, h);
}
