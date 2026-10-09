// Tiny disk cache: everything fetched on demand is stored under data/cache so the
// ship keeps working offline once a region of space (or time) has been visited.

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from './config.js';

const cacheRoot = path.join(config.dataDir, 'cache');
const inflight = new Map();

const fileFor = (ns, key) => {
  const safe = key.replace(/[^a-z0-9._-]+/gi, '_').slice(0, 80);
  const hash = crypto.createHash('sha1').update(key).digest('hex').slice(0, 10);
  return path.join(cacheRoot, ns, `${safe}-${hash}.json`);
};

/**
 * Return the cached value for (ns, key) if younger than ttlMs, otherwise call
 * `fetcher`, store its result and return it. Concurrent misses share one fetch.
 * If the fetch fails and a stale copy exists, the stale copy is served.
 */
export async function cached(ns, key, ttlMs, fetcher) {
  const file = fileFor(ns, key);
  let stale = null;
  try {
    const raw = JSON.parse(await fs.readFile(file, 'utf8'));
    if (Date.now() - raw.storedAt < ttlMs) return { ...raw, cache: 'hit' };
    stale = raw;
  } catch { /* miss */ }

  if (inflight.has(file)) return inflight.get(file);
  const p = (async () => {
    try {
      const value = await fetcher();
      const entry = { storedAt: Date.now(), value };
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, JSON.stringify(entry));
      return { ...entry, cache: 'miss' };
    } catch (err) {
      if (stale) return { ...stale, cache: 'stale', error: String(err.message || err) };
      throw err;
    } finally {
      inflight.delete(file);
    }
  })();
  inflight.set(file, p);
  return p;
}

/** Summary of what is stored locally, per namespace. */
export async function cacheStats() {
  const out = {};
  let namespaces = [];
  try { namespaces = await fs.readdir(cacheRoot); } catch { return out; }
  for (const ns of namespaces) {
    const files = await fs.readdir(path.join(cacheRoot, ns)).catch(() => []);
    let bytes = 0;
    for (const f of files) bytes += (await fs.stat(path.join(cacheRoot, ns, f))).size;
    out[ns] = { entries: files.length, bytes };
  }
  return out;
}
