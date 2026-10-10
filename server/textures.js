// Surface imagery, fetched on first use and kept under data/textures/.
//
// Each body lists sources in order of preference: NASA originals first where a global
// map exists (public domain), then the Solar System Scope set (CC BY 4.0, equirectangular
// maps built from NASA mission imagery). Only these keys can be fetched — the backend is
// not an open proxy — and a download is kept only if it really is a JPEG or PNG.

import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { config } from './config.js';

const run = promisify(execFile);
const SSS = 'https://www.solarsystemscope.com/textures/download/';
const NASA = 'https://images-assets.nasa.gov/image/';
const EO = 'https://eoimages.gsfc.nasa.gov/images/imagerecords/';
const SSS_CREDIT = 'Solar System Scope (CC BY 4.0), from NASA mission imagery';

const src = (url, credit) => ({ url, credit });

export const TEXTURES = {
  sun: [src(`${SSS}2k_sun.jpg`, `${SSS_CREDIT} (SDO)`)],
  mercury: [src(`${SSS}2k_mercury.jpg`, `${SSS_CREDIT} (MESSENGER)`)],
  venus: [src(`${SSS}2k_venus_atmosphere.jpg`, `${SSS_CREDIT}: the cloud tops you would see`)],
  venusSurface: [src(`${SSS}2k_venus_surface.jpg`, `${SSS_CREDIT} (Magellan radar)`)],
  earth: [src(`${EO}73000/73909/world.topo.bathy.200412.3x5400x2700.jpg`, 'NASA Earth Observatory, Blue Marble Next Generation (Dec 2004)'),
    src(`${SSS}4k_earth_daymap.jpg`, `${SSS_CREDIT} (Blue Marble)`)],
  earthClouds: [src(`${EO}57000/57747/cloud_combined_2048.jpg`, 'NASA Earth Observatory, Blue Marble clouds (MODIS)'),
    src(`${SSS}2k_earth_clouds.jpg`, `${SSS_CREDIT} (Blue Marble clouds)`)],
  earthNight: [src(`${EO}144000/144898/BlackMarble_2016_01deg.jpg`, 'NASA Earth Observatory, Black Marble 2016 (Suomi NPP VIIRS)'),
    src(`${SSS}2k_earth_nightmap.jpg`, `${SSS_CREDIT} (Black Marble)`)],
  moon: [src(`${SSS}2k_moon.jpg`, `${SSS_CREDIT} (LRO)`)],
  mars: [src(`${SSS}2k_mars.jpg`, `${SSS_CREDIT} (Viking / MGS)`)],
  jupiter: [src(`${NASA}PIA07782/PIA07782~orig.jpg`, 'NASA/JPL/SSI Cassini cylindrical map of Jupiter, Dec 2000 (PIA07782)'),
    src(`${SSS}2k_jupiter.jpg`, `${SSS_CREDIT} (Cassini)`)],
  saturn: [src(`${SSS}2k_saturn.jpg`, `${SSS_CREDIT} (Cassini)`)],
  saturnRing: [src(`${SSS}2k_saturn_ring_alpha.png`, `${SSS_CREDIT} (Cassini ring brightness and transparency)`)],
  uranus: [src(`${SSS}2k_uranus.jpg`, `${SSS_CREDIT} (Voyager 2)`)],
  neptune: [src(`${SSS}2k_neptune.jpg`, `${SSS_CREDIT} (Voyager 2)`)],
  pluto: [src(`${NASA}PIA11707/PIA11707~orig.jpg`, 'NASA/JHUAPL/SwRI New Horizons global colour mosaic (PIA11707); the black band was in polar night and never imaged')],
  milkyWay: [src(`${NASA}PIA10748/PIA10748~orig.jpg`, "NASA/JPL-Caltech/R. Hurt (SSC/Caltech), PIA10748: artist's concept from Spitzer data")],
};

// Smaller variants for the standalone preview, which embeds every image in one HTML file.
export const PREVIEW = {
  earth: `${SSS}2k_earth_daymap.jpg`, earthClouds: `${SSS}2k_earth_clouds.jpg`, earthNight: `${SSS}2k_earth_nightmap.jpg`,
  jupiter: `${NASA}PIA07782/PIA07782~large.jpg`, pluto: `${NASA}PIA11707/PIA11707~large.jpg`, milkyWay: `${NASA}PIA10748/PIA10748~large.jpg`,
};

const MIME = { '.jpg': 'image/jpeg', '.png': 'image/png' };
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) USS-Fidelity/0.2 (local astronomy explorer)';

/** True if `buf` starts like a JPEG or PNG (some hosts answer bots with an HTML page). */
export const isImage = (buf) => buf.length > 1024 &&
  ((buf[0] === 0xff && buf[1] === 0xd8) || (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47));

export async function download(url) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(120000) });
      const buf = Buffer.from(await res.arrayBuffer());
      if (res.ok && isImage(buf)) return buf;
    } catch { /* retry / fall through */ }
  }
  // Some hosts challenge Node's HTTP client but serve curl normally.
  try {
    const { stdout } = await run('curl', ['-sSL', '--max-time', '120', '-A', UA, url], { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 });
    if (isImage(stdout)) return stdout;
  } catch { /* no curl, or it failed */ }
  return null;
}

const inflight = new Map();
const fileFor = (key, url) => path.join(config.dataDir, 'textures', key + path.extname(new URL(url).pathname));

/** Path to the cached file for `key` (and which source it came from), downloading on first use. */
export async function texturePath(key) {
  const sources = TEXTURES[key];
  if (!sources) throw Object.assign(new Error(`unknown texture ${key}`), { status: 404 });
  for (const s of sources) {
    try { await fs.access(fileFor(key, s.url)); return { file: fileFor(key, s.url), credit: s.credit }; } catch { /* next */ }
  }
  if (!inflight.has(key)) {
    inflight.set(key, (async () => {
      for (const s of sources) {
        const buf = await download(s.url);
        if (!buf) continue;
        const file = fileFor(key, s.url);
        await fs.mkdir(path.dirname(file), { recursive: true });
        await fs.writeFile(`${file}.part`, buf);
        await fs.rename(`${file}.part`, file);
        return { file, credit: s.credit };
      }
      throw new Error(`texture ${key}: every source failed`);
    })().finally(() => inflight.delete(key)));
  }
  return inflight.get(key);
}

export async function textureResponse(key) {
  const { file } = await texturePath(key);
  return { body: await fs.readFile(file), type: MIME[path.extname(file)] || 'application/octet-stream' };
}

/** Credit for each texture: the source actually cached, else the preferred one. */
export async function textureCredits() {
  const out = {};
  for (const [key, sources] of Object.entries(TEXTURES)) {
    out[key] = sources[0].credit;
    for (const s of sources) {
      try { await fs.access(fileFor(key, s.url)); out[key] = s.credit; break; } catch { /* not cached */ }
    }
  }
  return out;
}
