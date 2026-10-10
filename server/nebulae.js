// Real images of the Quadrant View's nebulae (#24), fetched once and kept under data/nebulae/.
// Only the images listed in src/data/nebula3d.js can be fetched (this is not an open proxy), and a
// download is kept only if it really is a JPEG or PNG. Credits, licences, dates and orientations
// live in that table too.

import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.js';
import { download } from './textures.js';
import { NEBULA_3D, CLUSTER_NEBULOSITY } from '../src/data/nebula3d.js';

/** key → image record, for every allowlisted image. */
export const NEBULA_IMAGES = Object.fromEntries([...Object.values(NEBULA_3D), ...Object.values(CLUSTER_NEBULOSITY)].map((v) => [v.img.key, v.img]));

const inflight = new Map();
const fileFor = (key) => path.join(config.dataDir, 'nebulae', `${key}.jpg`);

/** GET /api/nebula-image/:key → the cached JPEG (downloaded on first use). */
export async function nebulaImage(key) {
  const img = NEBULA_IMAGES[key];
  if (!img) throw Object.assign(new Error(`unknown nebula image ${key}`), { status: 404 });
  const file = fileFor(key);
  try { return { body: await fs.readFile(file), type: 'image/jpeg', maxAge: 30 * 86400, headers: { 'x-credit': encodeURIComponent(img.credit) } }; } catch { /* first use */ }
  if (!inflight.has(key)) {
    inflight.set(key, (async () => {
      const buf = await download(img.url);
      if (!buf) throw Object.assign(new Error(`nebula image ${key}: download failed`), { status: 502 });
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(`${file}.part`, buf);
      await fs.rename(`${file}.part`, file);
      return buf;
    })().finally(() => inflight.delete(key)));
  }
  const body = await inflight.get(key);
  return { body, type: body[0] === 0x89 ? 'image/png' : 'image/jpeg', maxAge: 30 * 86400, headers: { 'x-credit': encodeURIComponent(img.credit) } };
}
