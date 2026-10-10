// Space live streams on YouTube (#32), shared by the weekly generator and /api/events: official
// agency and launch-provider channels plus established space-video channels. No API key needed: each channel's public RSS feed lists its
// newest uploads *and* its scheduled live streams, which we keep when the title reads like a
// broadcast (launch, docking, spacewalk…). With YOUTUBE_API_KEY set, the Data API's live and
// upcoming search fills in exact broadcast state and start times.

import { youtubeEmbed, channelEmbed } from '../src/data/events-schema.js';

// Channel ids verified against each channel's RSS title.
export const CHANNELS = [
  { id: 'nasa', name: 'NASA', org: 'NASA', channelId: 'UCLA_DiR1FfKNvjuUpBHmylQ', note: 'Launches, dockings, spacewalks; ISS Earth views between events.' },
  { id: 'spacex', name: 'SpaceX', org: 'SpaceX', channelId: 'UCtI0Hodo5o5dUb67FeUjDeA', note: 'Starship flight tests and selected launches.' },
  { id: 'esa', name: 'European Space Agency, ESA', org: 'ESA', channelId: 'UCIBaDdAbGlFDeS33shmlD0A', note: 'ESA launches, arrivals and briefings.' },
  { id: 'nasa-jpl', name: 'NASA Jet Propulsion Laboratory', org: 'NASA', channelId: 'UCryGec9PdUCLjpJW2mgCuLw', note: 'Planetary missions: landings, flybys, arrivals.' },
  { id: 'arianespace', name: 'Arianespace', org: 'Arianespace', channelId: 'UCRn9F2D9j-t4A-HgudM7aLQ', note: 'Ariane 6 and Vega launches from Kourou.' },
  { id: 'rocketlab', name: 'Rocket Lab', org: 'Rocket Lab', channelId: 'UCsWq7LZaizhIi-c-Yo_bcpw', note: 'Electron and Neutron launches.' },
  { id: 'blueorigin', name: 'Blue Origin', org: 'Blue Origin', channelId: 'UCVxTHEKKLxNjGcvVaZindlg', note: 'New Shepard and New Glenn flights.' },
  { id: 'nsf', name: 'NASASpaceflight', org: 'private', channelId: 'UCSUu1lih2RifWkKtDOJdsBA', note: 'Independent 24/7 Starbase cameras and launch coverage of every provider.' },
  { id: 'spaceflightnow', name: 'Spaceflight Now', org: 'private', channelId: 'UCXaTKkfXpF7xzT-03TafhEQ', note: 'Independent launch coverage.' },
  { id: 'everydayastronaut', name: 'Everyday Astronaut', org: 'private', channelId: 'UC6uKrU_WqJ1R2HMTY3LIx5Q', note: 'Launch broadcasts with commentary.' },
  { id: 'videofromspace', name: 'VideoFromSpace', org: 'private', channelId: 'UCVTomc35agH1SM6kCKzwW_g', note: 'Space.com rebroadcasts of agency feeds.' },
].map((c) => ({ ...c, url: `https://www.youtube.com/channel/${c.channelId}/live`, embed: channelEmbed(c.channelId) }));

const BROADCAST = /\blive\b|webcast|replay|\blaunch(es)?\b|liftoff|\bdock|undock|berth|spacewalk|\bEVA\b|splashdown|landing|re-?entry|flyby|arrival|eclipse|flight test|static fire|countdown/i;
const NOT_BROADCAST = /career|hiring|merch|#\w+[^#]*#\w+/i; // recruitment, shop and hashtag clips
const unescape = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

/** Parse a channel RSS feed into [{ videoId, title, published }]. */
export function parseRss(xml) {
  const out = [];
  for (const m of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const e = m[1];
    const videoId = /<yt:videoId>([^<]+)<\/yt:videoId>/.exec(e)?.[1], title = /<title>([^<]*)<\/title>/.exec(e)?.[1], published = /<published>([^<]+)<\/published>/.exec(e)?.[1];
    if (videoId && title) out.push({ videoId, title: unescape(title), published });
  }
  return out;
}

/**
 * Broadcast-like videos from every channel's RSS published within `sinceDays`. Scheduled streams
 * appear in RSS as soon as they are announced (their `published` date is when they were posted).
 */
export async function rssStreams(fetchText, { sinceDays = 7, now = Date.now() } = {}) {
  const out = [];
  for (const c of CHANNELS) {
    let items = [];
    try { items = parseRss(await fetchText(`https://www.youtube.com/feeds/videos.xml?channel_id=${c.channelId}`)); } catch { continue; }
    for (const it of items) {
      if (!BROADCAST.test(it.title) || NOT_BROADCAST.test(it.title)) continue;
      if (Date.parse(it.published) < now - sinceDays * 86400e3) continue;
      const url = `https://www.youtube.com/watch?v=${it.videoId}`;
      out.push({ id: it.videoId, title: it.title, url, embed: youtubeEmbed(url), start: it.published, publisher: c.name, channel: c.id, status: 'posted' });
    }
  }
  return out;
}

/** Live and upcoming broadcasts from the YouTube Data API (only with a key). */
export async function apiStreams(fetchJson, key) {
  if (!key) return [];
  const out = [];
  for (const c of CHANNELS) {
    for (const eventType of ['live', 'upcoming']) {
      try {
        const q = new URLSearchParams({ part: 'snippet', channelId: c.channelId, eventType, type: 'video', maxResults: '10', key });
        const j = await fetchJson(`https://www.googleapis.com/youtube/v3/search?${q}`);
        for (const it of j.items ?? []) {
          const url = `https://www.youtube.com/watch?v=${it.id.videoId}`;
          out.push({ id: it.id.videoId, title: unescape(it.snippet.title), url, embed: youtubeEmbed(url), start: it.snippet.publishedAt, publisher: c.name, channel: c.id, status: eventType });
        }
      } catch { /* quota or network: keyless RSS still covers it */ }
    }
  }
  return out;
}

/** Merge stream lists, preferring the most specific status (live > upcoming > recent > posted). */
export function mergeStreams(...lists) {
  const rank = { live: 0, upcoming: 1, recent: 2, posted: 3 }, out = new Map();
  for (const s of lists.flat()) {
    const old = out.get(s.id);
    if (!old) out.set(s.id, s);
    else out.set(s.id, { ...s, ...old, eventId: old.eventId ?? s.eventId, channel: old.channel ?? s.channel, status: rank[s.status] < rank[old.status] ? s.status : old.status });
  }
  return [...out.values()].sort((a, b) => (rank[a.status] - rank[b.status]) || (Date.parse(b.start) - Date.parse(a.start)));
}
