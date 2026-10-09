import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const splitDirs = (v) => (v || '').split(path.delimiter).map((s) => s.trim()).filter(Boolean);

export const config = {
  root,
  // Local only: the backend binds to loopback so nothing is exposed to the network.
  host: process.env.FIDELITY_HOST || '127.0.0.1',
  port: Number(process.env.FIDELITY_PORT || 4011),
  // On-demand downloads are cached here (JSON, one file per request).
  dataDir: path.resolve(process.env.FIDELITY_DATA_DIR || path.join(root, 'data')),
  // Directories holding catalogs you have already downloaded (e.g. on a RAID volume).
  // Separate several with ':' (macOS/Linux) or ';' (Windows) — path.delimiter.
  catalogDirs: splitDirs(process.env.FIDELITY_CATALOG_DIRS),
  distDir: path.join(root, 'dist'),
};
