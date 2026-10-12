// Minimal PNG codec, dependency-free (node:zlib): decodes the 8-bit PNGs that map and solar image services
// send (greyscale, grey+alpha, RGB, RGBA, palette; plain or Adam7-interlaced, as Helioviewer sends them) to
// RGBA, and encodes RGBA. Used to mosaic NASA Trek WMTS tiles (#28), to read SDO/SOHO images for the corona
// (#79) and the radio-disc model (server/solarmodel.js), and to write archive maps as images.

import zlib from 'node:zlib';

const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
export const isPng = (b) => b?.length > 8 && b.subarray(0, 8).equals(SIG);

// Adam7 passes: [x0, y0, dx, dy] (Helioviewer and some map servers send interlaced PNGs)
const ADAM7 = [[0, 0, 8, 8], [4, 0, 8, 8], [0, 4, 4, 8], [2, 0, 4, 4], [0, 2, 2, 4], [1, 0, 2, 2], [0, 1, 1, 2]];

/** Decode a PNG (8-bit; Adam7-interlaced or not) to { width, height, data: RGBA Uint8Array }. Throws on what it does not support. */
export function decodePng(buf) {
  if (!isPng(buf)) throw new Error('not a PNG');
  let o = 8, width = 0, height = 0, depth = 0, type = 0, interlace = 0, palette = null, trns = null;
  const idat = [];
  while (o + 8 <= buf.length) {
    const len = buf.readUInt32BE(o), kind = buf.toString('latin1', o + 4, o + 8), d = buf.subarray(o + 8, o + 8 + len);
    if (kind === 'IHDR') { width = d.readUInt32BE(0); height = d.readUInt32BE(4); depth = d[8]; type = d[9]; interlace = d[12]; }
    else if (kind === 'PLTE') palette = d;
    else if (kind === 'tRNS') trns = d;
    else if (kind === 'IDAT') idat.push(d);
    else if (kind === 'IEND') break;
    o += 12 + len;
  }
  if (depth !== 8 || interlace > 1) throw new Error(`unsupported PNG (depth ${depth}, interlace ${interlace})`);
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type];
  if (!ch) throw new Error(`unsupported PNG colour type ${type}`);
  if (type === 3 && !palette) throw new Error('PNG palette missing');
  const raw = zlib.inflateSync(Buffer.concat(idat)), data = new Uint8Array(width * height * 4);
  const greyKey = type === 0 && trns && trns.length >= 2 ? trns.readUInt16BE(0) : -1;
  let at = 0;
  // one (sub)image: rows of pw pixels starting at (x0, y0), every dx-th pixel of every dy-th row
  const pass = (x0, y0, dx, dy) => {
    const pw = Math.ceil((width - x0) / dx), ph = Math.ceil((height - y0) / dy);
    if (pw <= 0 || ph <= 0) return; // an empty Adam7 pass has no rows (not even filter bytes)
    const stride = pw * ch;
    let up = null;
    for (let r = 0; r < ph; r++) {
      if (at + 1 + stride > raw.length) throw new Error('PNG data truncated');
      const f = raw[at], line = raw.subarray(at + 1, at + 1 + stride);
      at += 1 + stride;
      for (let i = 0; i < stride; i++) {
        const a = i >= ch ? line[i - ch] : 0, b = up ? up[i] : 0, c = up && i >= ch ? up[i - ch] : 0;
        let v = line[i];
        if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
        else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
        line[i] = v & 255; // unfiltered in place (raw is our own inflated copy)
      }
      for (let x = 0; x < pw; x++) {
        const k = ((y0 + r * dy) * width + x0 + x * dx) * 4, j = x * ch;
        if (type === 0) { data[k] = data[k + 1] = data[k + 2] = line[j]; data[k + 3] = greyKey === line[j] ? 0 : 255; }
        else if (type === 4) { data[k] = data[k + 1] = data[k + 2] = line[j]; data[k + 3] = line[j + 1]; }
        else if (type === 2) { data[k] = line[j]; data[k + 1] = line[j + 1]; data[k + 2] = line[j + 2]; data[k + 3] = 255; }
        else if (type === 6) { data[k] = line[j]; data[k + 1] = line[j + 1]; data[k + 2] = line[j + 2]; data[k + 3] = line[j + 3]; }
        else { const p = line[j]; data[k] = palette[p * 3]; data[k + 1] = palette[p * 3 + 1]; data[k + 2] = palette[p * 3 + 2]; data[k + 3] = trns && p < trns.length ? trns[p] : 255; }
      }
      up = line;
    }
  };
  if (interlace) for (const p of ADAM7) pass(...p); else pass(0, 0, 1, 1);
  return { width, height, data };
}

const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = (b) => { let c = -1; for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
function chunk(kind, d) {
  const len = Buffer.alloc(4), crc = Buffer.alloc(4), body = Buffer.concat([Buffer.from(kind, 'latin1'), d]);
  len.writeUInt32BE(d.length); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
/** Encode RGBA pixels as a PNG. */
export function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4).copy(raw, y * (width * 4 + 1) + 1);
  return Buffer.concat([SIG, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

/** Box-resample RGBA (w×h) to (W×H), averaging colour over opaque pixels only. */
export function resample({ width: w, height: h, data }, W, H) {
  const out = new Uint8Array(W * H * 4);
  for (let Y = 0; Y < H; Y++) {
    const y0 = Math.floor((Y * h) / H), y1 = Math.max(y0 + 1, Math.floor(((Y + 1) * h) / H));
    for (let X = 0; X < W; X++) {
      const x0 = Math.floor((X * w) / W), x1 = Math.max(x0 + 1, Math.floor(((X + 1) * w) / W));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const k = (y * w + x) * 4, al = data[k + 3];
        r += data[k] * al; g += data[k + 1] * al; b += data[k + 2] * al; a += al; n++;
      }
      const k = (Y * W + X) * 4;
      if (a > 0) { out[k] = r / a; out[k + 1] = g / a; out[k + 2] = b / a; }
      out[k + 3] = n ? a / n : 0;
    }
  }
  return { width: W, height: H, data: out };
}
