// /api/events (#32): the weekly events feed published to GitHub (events/events.json, built by
// scripts/events/build-events.js), cached on disk for 3 hours. Offline, or before the first
// publish, it falls back to the copy bundled in this checkout; whichever was generated last wins.
// Between weekly publishes, broadcast-like videos from the curated YouTube channels' RSS feeds
// (refreshed every 15 minutes) are merged into `streams`.

import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.js';
import { cached } from './cache.js';
import { validateFeed } from '../src/data/events-schema.js';
import { rssStreams, mergeStreams } from './youtube.js';

const UA = 'USS-Fidelity/0.3 (local astronomy explorer)';
const FEED_URL = process.env.FIDELITY_EVENTS_URL || 'https://raw.githubusercontent.com/Lone-Star-Observatories/fidelity/main/events/events.json';
const BUNDLED = path.join(config.root, 'events', 'events.json');
const HOUR = 3600e3;

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function bundled() {
  try { return JSON.parse(await fs.readFile(BUNDLED, 'utf8')); } catch { return null; }
}

/** The feed, plus { origin: 'github' | 'bundled', url, cache, error }. */
export async function eventsFeed() {
  let remote = null, error = null;
  try {
    remote = await cached('events', 'feed', 3 * HOUR, async () => {
      const feed = JSON.parse(await fetchText(FEED_URL));
      const v = validateFeed(feed);
      if (!v.ok) throw new Error(`published feed is invalid: ${v.problems.slice(0, 3).join('; ')}`);
      return feed;
    });
  } catch (err) { error = String(err.message || err); }
  const local = await bundled();
  const useRemote = remote && (!local || Date.parse(remote.value.generated) >= Date.parse(local.generated));
  const feed = useRemote ? remote.value : local;
  if (!feed) throw Object.assign(new Error(`events feed unavailable (${error ?? 'no bundled copy'})`), { status: 503 });
  let live = [];
  try { live = (await cached('events', 'youtube-rss', 15 * 60e3, () => rssStreams(fetchText))).value; } catch { /* offline: the published streams stand */ }
  return { ...feed, streams: mergeStreams(feed.streams ?? [], live), origin: useRemote ? 'github' : 'bundled', url: FEED_URL,
    cache: useRemote ? remote.cache : 'bundled', error: error ?? remote?.error ?? null };
}
