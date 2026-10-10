// The published events file (#32): one JSON document, regenerated weekly by
// scripts/events/build-events.js and committed to events/events.json on GitHub. The local
// backend (/api/events) caches it; the standalone preview bundles a copy. Shared by the
// generator, the backend, the app and the tests so all four agree on the shape.
//
// {
//   schema: 'fidelity.events/1', generated, window: { from, to },
//   sources: [{ id, name, url, licence }],
//   channels: [{ id, name, org, channelId, url, embed }],          // 24/7 and agency live channels
//   streams: [{ id, title, url, embed, start, status, publisher, eventId }],  // scheduled/live/recent webcasts
//   events: [Event]
// }
// Event: { id, category, type, title, description, time, end, precision, status, tier, orgs[], bodies[],
//   location: { name, lat, lon, body, tier }, visibility: { kind, note, path[[lat, lon]], minGeomagLat },
//   video: [{ url, embed, title, publisher, start, live }], links: [{ url, title }],
//   vehicle: { rocket, provider, spacecraft, boosters: [{ serial, landing: { type, name, lat, lon, tier } }] },
//   mission: { name, type, orbit, description }, target: { name, norad },
//   model: { kind, phases: [{ name, t }], tracks: [{ id, label, tier, basis, points: [[tS, lat, lon, altKm]] }],
//            relative: { norad, tier, basis, points: [[tS, radialKm, alongKm, crossKm]] } },
//   source: { name, url, id } }
// Track and phase times are seconds relative to the event's `time`.

export const SCHEMA = 'fidelity.events/1';

export const CATEGORIES = {
  celestial: 'CELESTIAL',
  launch: 'LAUNCH',
  station: 'STATION OPS', // docking, undocking, berthing, release, spacewalks, crew handovers
  landing: 'LANDING',
  'deep-space': 'DEEP SPACE', // flybys, orbit insertions, arrivals
  other: 'OTHER',
};

export const TYPES = {
  'solar-eclipse': 'celestial', 'lunar-eclipse': 'celestial', transit: 'celestial', occultation: 'celestial',
  conjunction: 'celestial', opposition: 'celestial', elongation: 'celestial', parade: 'celestial',
  'meteor-shower': 'celestial', comet: 'celestial', aurora: 'celestial',
  launch: 'launch',
  docking: 'station', undocking: 'station', berthing: 'station', release: 'station', eva: 'station', 'station-event': 'station',
  landing: 'landing',
  flyby: 'deep-space', 'orbit-insertion': 'deep-space', 'spacecraft-event': 'deep-space',
  'static-fire': 'other', 'press-event': 'other', other: 'other',
};

// Tiers (src/data/provenance.js): REPORTED is an operator's or agency's published schedule or
// result; COMPUTED is calculated from ephemerides; MODELLED is a forecast or generic flight model.
export const EVENT_TIERS = ['reported', 'measured', 'computed', 'modelled'];

/** Organisation tags used for filtering. */
export const ORGS = ['SpaceX', 'NASA', 'ESA', 'Roscosmos', 'CNSA', 'JAXA', 'ISRO', 'Rocket Lab', 'Blue Origin', 'ULA', 'Arianespace', 'Northrop Grumman', 'private', 'agency'];

const isIso = (s) => typeof s === 'string' && Number.isFinite(Date.parse(s));
const isTrack = (pts, n) => Array.isArray(pts) && pts.every((p) => Array.isArray(p) && p.length === n && p.every(Number.isFinite));

/** Problems with one event (empty when valid). */
export function eventProblems(e) {
  const p = [];
  if (!e || typeof e !== 'object') return ['not an object'];
  if (!e.id || typeof e.id !== 'string') p.push('id');
  if (!TYPES[e.type]) p.push(`type ${e.type}`);
  if (e.category !== TYPES[e.type]) p.push(`category ${e.category} for ${e.type}`);
  if (!e.title) p.push('title');
  if (!isIso(e.time)) p.push('time');
  if (e.end != null && !isIso(e.end)) p.push('end');
  if (!EVENT_TIERS.includes(e.tier)) p.push(`tier ${e.tier}`);
  if (e.location && (e.location.lat != null) !== (e.location.lon != null)) p.push('location lat/lon');
  for (const v of e.video ?? []) if (!/^https:\/\//.test(v.url ?? '')) p.push('video url');
  for (const t of e.model?.tracks ?? []) {
    if (!isTrack(t.points, 4)) p.push(`track ${t.id}`);
    if (!EVENT_TIERS.includes(t.tier)) p.push(`track tier ${t.id}`);
  }
  if (e.model?.relative && !isTrack(e.model.relative.points, 4)) p.push('relative track');
  return p;
}

/** Validate a whole feed: { ok, problems: [string] }. */
export function validateFeed(feed) {
  const problems = [];
  if (feed?.schema !== SCHEMA) problems.push(`schema ${feed?.schema}`);
  if (!isIso(feed?.generated)) problems.push('generated');
  if (!Array.isArray(feed?.events)) problems.push('events');
  const ids = new Set();
  for (const e of feed?.events ?? []) {
    for (const q of eventProblems(e)) problems.push(`${e?.id ?? '?'}: ${q}`);
    if (ids.has(e.id)) problems.push(`${e.id}: duplicate id`);
    ids.add(e.id);
  }
  for (const s of feed?.streams ?? []) if (!/^https:\/\//.test(s.url ?? '')) problems.push(`stream ${s.id}: url`);
  return { ok: problems.length === 0, problems };
}

/** YouTube video id from a watch / youtu.be / live / embed URL (null otherwise). */
export function youtubeId(url) {
  const m = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|live\/|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/.exec(url ?? '');
  return m ? m[1] : null;
}
/** Privacy-enhanced embed URL for a YouTube link, or null. */
export const youtubeEmbed = (url) => { const id = youtubeId(url); return id ? `https://www.youtube-nocookie.com/embed/${id}` : null; };
/** Embed URL for a channel's current live stream. */
export const channelEmbed = (channelId) => `https://www.youtube.com/embed/live_stream?channel=${channelId}`;

/** Times (JD) during which an event's model is on screen: its tracks/profile, padded. `e.jd`/`e.endJd` are set by the client. */
export function modelSpan(e) {
  const m = e.model;
  if (!m) return null;
  let t0 = 0, t1 = 0;
  for (const t of m.tracks ?? []) { t0 = Math.min(t0, t.points[0][0]); t1 = Math.max(t1, t.points.at(-1)[0]); }
  if (m.relative) { t0 = Math.min(t0, m.relative.points[0][0]); t1 = Math.max(t1, m.relative.points.at(-1)[0]); }
  if (m.kind === 'eva' && e.endJd) t1 = (e.endJd - e.jd) * 86400;
  const pre = m.kind === 'launch' ? 900 : 300, post = m.kind === 'launch' ? 600 : 900;
  return { from: e.jd + (t0 - pre) / 86400, to: e.jd + (t1 + post) / 86400 };
}

// How long after its nominal time an event of each date precision may still be under way.
const SLACK_S = { second: 0, minute: 60, hour: 3600, day: 86400, week: 7 * 86400, month: 31 * 86400, quarter: 92 * 86400, 'half-year': 183 * 86400, year: 366 * 86400, decade: 3653 * 86400 };
/** True once an event is over at `nowMs`: past its end, its modelled flight and its date's precision. */
export function elapsed(e, nowMs = Date.now()) {
  const t = Date.parse(e.time);
  let end = Math.max(e.end ? Date.parse(e.end) : t, t + (SLACK_S[e.precision] ?? 0) * 1000);
  for (const tr of e.model?.tracks ?? []) end = Math.max(end, t + tr.points.at(-1)[0] * 1000);
  if (e.model?.relative) end = Math.max(end, t + e.model.relative.points.at(-1)[0] * 1000);
  return end < nowMs;
}
