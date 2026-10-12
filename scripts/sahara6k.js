// Regenerate public/paleo/sahara-6k.png (#54): northern Africa and Arabia 6,000 years ago from pollen, lake and
// wetland records gridded at 1° (Hoelzmann et al. 1998, Global Biogeochem. Cycles 12, 35, doi:10.1029/97GB02733;
// data: NOAA/WDS Paleoclimatology "African 6K Land Surface Conditions", contribution 98-012).
//   node scripts/sahara6k.js
// → 360×180 RGBA, equirectangular, north up, longitude −180 at the left: RGB = the cell's mix of steppe, savanna,
//   xerophytic woods/scrub, tropical deciduous and montane forest, lakes and wetlands, in the globe's biome colours;
//   A = the cell's land fraction (0 outside 10–30° N, 17° W–60° E; tapered over the two rows at either edge). The data has no desert class: at 6 ka it is green.
import fs from 'node:fs/promises';
import zlib from 'node:zlib';
import { BIOME_COLOURS } from '../src/data/paleo-biomes.js';

const URL_TXT = 'https://www.ncei.noaa.gov/pub/data/paleo/pollen/africa6k/sah_6k.txt';
const text = process.argv[2] ? await fs.readFile(process.argv[2], 'latin1') : await (await fetch(URL_TXT)).text();
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const B = (code) => hex(BIOME_COLOURS[code]); // BIOME4 class colours, so the proxy map and the model read alike
const VEG = { STEPPE: B(20), SAVANNA: B(12), XERO: B(13), TDFO: B(3), TMEF: B(1) };
const LAKE = [30, 70, 95], WETL = [52, 84, 62];

const lines = text.split(/\r?\n/).filter((l) => l.trim());
const head = lines[0].trim().split(/\s+/), col = (n) => head.indexOf(n);
const W = 360, H = 180, rgba = Buffer.alloc(W * H * 4);
let cells = 0;
for (const l of lines.slice(1)) {
  const f = l.trim().split(/\s+/), num = (n) => Number(String(f[col(n)]).replace(',', '.'));
  const lat = num('LATI'), lon = num('LONG');
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
  const land = 1 - num('SEA_') / 100, lake = num('LAKE') / 100, wet = num('WETL') / 100, terr = Math.max(0, 1 - lake - wet);
  const mix = [0, 0, 0];
  let vegSum = 0;
  for (const [k, c] of Object.entries(VEG)) { const w = num(k) / 100; vegSum += w; for (let i = 0; i < 3; i++) mix[i] += c[i] * w * terr; }
  if (vegSum > 0) for (let i = 0; i < 3; i++) mix[i] /= vegSum; // percentages of the terrain may not sum to exactly 100
  for (let i = 0; i < 3; i++) mix[i] += LAKE[i] * lake + WETL[i] * wet;
  const x = Math.floor(lon + 180), y = Math.floor(90 - lat), p = (y * W + x) * 4;
  // the mapped region ends at 10° and 30° N inside the continent: taper its first and last two rows so the
  // globe blends into the model there instead of showing a ruled line
  const edge = Math.min(1, (Math.min(lat - 10, 30 - lat) + 0.5) / 2.5);
  rgba[p] = Math.round(mix[0]); rgba[p + 1] = Math.round(mix[1]); rgba[p + 2] = Math.round(mix[2]); rgba[p + 3] = Math.round(255 * Math.max(0, Math.min(1, land)) * edge);
  cells++;
}
const crc = (b) => { let c = ~0; for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return ~c >>> 0; };
const chunk = (t, d) => { const len = Buffer.alloc(4), tc = Buffer.concat([Buffer.from(t), d]), cr = Buffer.alloc(4); len.writeUInt32BE(d.length); cr.writeUInt32BE(crc(tc)); return Buffer.concat([len, tc, cr]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
const raw = Buffer.alloc(H * (W * 4 + 1));
for (let y = 0; y < H; y++) rgba.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4);
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
await fs.writeFile(new URL('../public/paleo/sahara-6k.png', import.meta.url), png);
console.log(`sahara-6k.png: ${cells} cells, ${png.length} bytes`);
