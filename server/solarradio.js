// The Sun in microwaves (#28): Nobeyama Radioheliograph (NoRH) full-disc maps at 17 and 34 GHz,
// from NAOJ's public archive of daily snapshot images (FITS, brightness temperature in K). NoRH
// observed from 1992 until it closed on 31 March 2020, so these are archival. The backend decodes
// the FITS (BITPIX −32, one 512×512 plane) and writes a false-colour PNG with no dependencies:
// FITS is 2880-byte header blocks + big-endian floats; PNG is zlib-deflated scanlines with CRCs.
//
// Acknowledgement requested by NAOJ: "Nobeyama Radioheliograph, operated by NAOJ/ICCON".

import zlib from 'node:zlib';

const ARCHIVE = 'https://solar.nro.nao.ac.jp/norh/images/daily';
// A day near the cycle-24 maximum with several active regions, observed in both bands at local noon.
export const NORH_DAY = { y: 2014, m: 1, d: 7 };

/** Parse a simple 2-D FITS image: { header: {KEY: value}, w, h, data: Float32Array (row 0 = bottom) }. */
export function parseFits(buf) {
  const header = {};
  let off = 0, end = false;
  while (!end && off + 2880 <= buf.length) {
    for (let i = 0; i < 36; i++) {
      const card = buf.toString('latin1', off + i * 80, off + i * 80 + 80);
      const key = card.slice(0, 8).trim();
      if (key === 'END') { end = true; break; }
      if (card[8] !== '=') continue;
      let v = card.slice(10).trim();
      if (v.startsWith("'")) v = v.slice(1, v.indexOf("'", 1)).trim();
      else { v = v.split('/')[0].trim(); v = v === 'T' ? true : v === 'F' ? false : Number(v); }
      header[key] = v;
    }
    off += 2880;
  }
  if (!end || header.NAXIS !== 2) throw new Error('not a 2-D FITS image');
  const w = header.NAXIS1, h = header.NAXIS2, bp = header.BITPIX, n = w * h;
  const data = new Float32Array(n), bytes = Math.abs(bp) / 8;
  if (off + n * bytes > buf.length) throw new Error('truncated FITS');
  const scale = header.BSCALE ?? 1, zero = header.BZERO ?? 0;
  for (let i = 0; i < n; i++) {
    const p = off + i * bytes;
    const raw = bp === -32 ? buf.readFloatBE(p) : bp === -64 ? buf.readDoubleBE(p) : bp === 16 ? buf.readInt16BE(p) : bp === 32 ? buf.readInt32BE(p) : buf.readUInt8(p);
    data[i] = raw * scale + zero;
  }
  return { header, w, h, data };
}

const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = (b) => { let c = -1; for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
/** Encode RGB rows (Uint8Array, w×h×3, top row first) as a PNG. */
export function encodePng(rgb, w, h) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; rgb.subarray(y * w * 3, (y + 1) * w * 3).forEach((v, i) => { raw[y * (w * 3 + 1) + 1 + i] = v; }); }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

/**
 * A brightness-temperature map as a false-colour PNG, north up and west right: log scale from
 * 2,000 K (the sky is dark) through the 10,000 K quiet disc to 300,000 K active regions, in the
 * microwave palette (cyan, white at the top). Returns { png, disk } with disk = solar radius as a
 * fraction of the image width.
 */
export function norhToPng(fits) {
  const { header, w, h, data } = parseFits(fits);
  const lo = Math.log10(2000), hi = Math.log10(3e5), rgb = new Uint8Array(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const T = data[(h - 1 - y) * w + x]; // FITS row 0 is the bottom (solar south)
    const v = Number.isFinite(T) && T > 0 ? Math.max(0, Math.min(1, (Math.log10(T) - lo) / (hi - lo))) : 0;
    const white = Math.max(0, (v - 0.75) / 0.25), k = v ** 0.6;
    const o = (y * w + x) * 3;
    rgb[o] = 255 * Math.min(1, 0.3 * k + white * 0.7); rgb[o + 1] = 255 * Math.min(1, 0.85 * k + white * 0.15); rgb[o + 2] = 255 * Math.min(1, k);
  }
  const disk = header.SOLR && header.CDELT1 ? header.SOLR / (Math.abs(header.CDELT1) * w) : null;
  return { png: encodePng(rgb, w, h), disk, time: header['DATE-OBS'] && header['TIME-OBS'] ? `${header['DATE-OBS']}T${header['TIME-OBS'].slice(0, 8)}Z` : null, freq: header['OBS-FREQ'] };
}

/** A feed (server/feeds.js) for NoRH's archived map at 17 GHz ('ifa') or 34 GHz ('ifz'). */
export const norhFeed = (prefix, credit) => ({
  type: 'image', ttl: 365 * 86400000, credit,
  async get() {
    const { y, m, d } = NORH_DAY, mm = String(m).padStart(2, '0'), stamp = `${String(y).slice(2)}${mm}${String(d).padStart(2, '0')}`;
    const ua = { 'user-agent': 'USS-Fidelity/0.3 (local astronomy explorer)' };
    const list = await fetch(`${ARCHIVE}/${y}/${mm}/`, { headers: ua, signal: AbortSignal.timeout(60000) });
    if (!list.ok) throw new Error(`NoRH archive HTTP ${list.status}`);
    const name = (await list.text()).match(new RegExp(`href="(${prefix}${stamp}_\\d{6})"`))?.[1];
    if (!name) throw new Error('NoRH map not in the archive listing');
    const res = await fetch(`${ARCHIVE}/${y}/${mm}/${name}`, { headers: ua, signal: AbortSignal.timeout(90000) });
    if (!res.ok) throw new Error(`NoRH HTTP ${res.status}`);
    const out = norhToPng(Buffer.from(await res.arrayBuffer()));
    return { body: out.png, type: 'image/png', time: out.time, disk: out.disk };
  },
});
