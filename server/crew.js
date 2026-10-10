// Crew cards (#46): everyone in space now, from the community "people in space" feed (corquaid,
// MIT), enriched once a month per person from open data: Wikidata (birth date, citizenship, time
// in space, employer, a one-line description; CC0) through the person's Wikipedia page, and the
// licence of their Commons portrait. Portraits and flags are served (and cached) only when their
// Commons licence is public domain or Creative Commons; otherwise the card shows initials. The
// image routes serve only files named by the current crew list, so the backend is not an open proxy.

import { cached } from './cache.js';

const UA = 'USS-Fidelity/0.3 (local astronomy explorer; https://github.com/Lone-Star-Observatories/fidelity)';
const DAY = 86400e3;
const FEED = 'https://corquaid.github.io/international-space-station-APIs/JSON/people-in-space.json';

async function get(url, as = 'json', tries = 3) {
  for (let i = 0; ; i++) {
    const res = await fetch(url, { headers: { 'user-agent': UA, 'api-user-agent': UA }, signal: AbortSignal.timeout(30000) });
    if (res.ok) return as === 'json' ? res.json() : Buffer.from(await res.arrayBuffer());
    if (res.status !== 429 || i >= tries - 1) throw new Error(`HTTP ${res.status} ${url.split('?')[0]}`);
    await new Promise((r) => setTimeout(r, 2000 * 2 ** i)); // Wikimedia rate limit: back off
  }
}
// one Wikimedia request at a time (their API etiquette)
let queue = Promise.resolve();
const serial = (fn) => { const p = queue.then(fn, fn); queue = p.catch(() => {}); return p; };

/** A Commons file name from an upload.wikimedia.org URL (thumb or original), or null. */
export function commonsFile(url) {
  const m = /upload\.wikimedia\.org\/wikipedia\/commons\/(?:thumb\/)?[0-9a-f]\/[0-9a-f]{2}\/([^/?#]+)/.exec(url ?? '');
  return m ? decodeURIComponent(m[1]) : null;
}
/** Licences we may show: public domain and Creative Commons (CC0, BY, BY-SA). */
export const allowedLicence = (short) => /public domain|^pd\b|cc0|cc[ -]by/i.test(short ?? '');
const strip = (html) => String(html ?? '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

/** Commons licence, author and a 240 px thumbnail URL for a file. */
async function commonsInfo(file) {
  return (await cached('crew', `commons-${file}`, 30 * DAY, () => serial(async () => {
    const q = new URLSearchParams({ action: 'query', titles: `File:${file}`, prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: '240',
      iiextmetadatafilter: 'LicenseShortName|Artist|Credit|UsageTerms', format: 'json', formatversion: '2' });
    const j = await get(`https://commons.wikimedia.org/w/api.php?${q}`);
    const ii = j.query?.pages?.[0]?.imageinfo?.[0];
    if (!ii) return { file, licence: null };
    const md = ii.extmetadata ?? {};
    return { file, licence: md.LicenseShortName?.value ?? null, artist: strip(md.Artist?.value), credit: strip(md.Credit?.value), thumb: ii.thumburl ?? ii.url, page: ii.descriptionurl };
  }))).value;
}

const claim = (e, p) => (e?.claims?.[p] ?? []).filter((c) => c.rank !== 'deprecated').map((c) => c.mainsnak?.datavalue?.value).filter((v) => v != null);
async function entity(qid) {
  return (await cached('crew', `wd-${qid}`, 30 * DAY, () => serial(async () => (await get(`https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`)).entities?.[qid] ?? null))).value;
}
const label = (e) => e?.labels?.en?.value ?? null;

/** Open-data facts for one person: Wikidata via their Wikipedia page; portrait licence from Commons. */
async function enrich(p) {
  const out = { wikidata: null, portrait: null, flag: null };
  try {
    const title = decodeURIComponent((p.url ?? '').split('/wiki/')[1] ?? '');
    if (title) {
      const qid = (await cached('crew', `qid-${title}`, 30 * DAY, () => serial(async () => {
        const j = await get(`https://en.wikipedia.org/w/api.php?action=query&prop=pageprops&ppprop=wikibase_item&redirects=1&format=json&formatversion=2&titles=${encodeURIComponent(title)}`);
        return j.query?.pages?.[0]?.pageprops?.wikibase_item ?? null;
      }))).value;
      if (qid) {
        const e = await entity(qid);
        const birth = claim(e, 'P569')[0]?.time?.slice(1, 11) ?? null;
        const minutes = Number(claim(e, 'P2873')[0]?.amount);
        const citizenships = [];
        for (const c of claim(e, 'P27').slice(0, 2)) {
          const ce = await entity(c.id).catch(() => null);
          citizenships.push({ qid: c.id, name: label(ce), flagFile: claim(ce, 'P41')[0] ?? null });
        }
        const employers = [];
        for (const c of claim(e, 'P108').slice(0, 2)) employers.push(label(await entity(c.id).catch(() => null)));
        out.wikidata = { qid, url: `https://www.wikidata.org/wiki/${qid}`, description: e?.descriptions?.en?.value ?? null, birth,
          timeInSpaceDays: Number.isFinite(minutes) ? +(minutes / 1440).toFixed(1) : null, citizenships, employers: employers.filter(Boolean) };
        const flagFile = citizenships[0]?.flagFile;
        if (flagFile) {
          const fi = await commonsInfo(flagFile).catch(() => null);
          if (fi && allowedLicence(fi.licence)) out.flag = { file: flagFile, licence: fi.licence, url: `/api/crew/image?file=${encodeURIComponent(flagFile)}&kind=flag` };
        }
      }
    }
  } catch (err) { out.error = String(err.message || err); }
  const file = commonsFile(p.image);
  if (file) {
    try {
      const ci = await commonsInfo(file);
      out.portrait = { file, licence: ci.licence, artist: ci.artist, credit: ci.credit, page: ci.page, allowed: allowedLicence(ci.licence),
        url: allowedLicence(ci.licence) ? `/api/crew/image?file=${encodeURIComponent(file)}` : null };
    } catch (err) { out.portrait = { file, licence: null, allowed: false, url: null, error: String(err.message || err) }; }
  }
  return out;
}

let allowed = new Map(); // file → { thumb | kind } served by /api/crew/image

/** GET /api/crew: the people in space now, with their open-data facts. */
export async function crew() {
  const feed = await cached('crew', 'feed', 6 * 3600e3, () => get(FEED));
  const j = feed.value;
  const people = [];
  for (const p of j.people ?? []) {
    const extra = await cached('crew', `person-${p.name}`, 30 * DAY, () => enrich(p)).then((r) => r.value).catch((err) => ({ error: String(err.message || err) }));
    people.push({ name: p.name, country: p.country, flagCode: p.flag_code, agency: p.agency, position: p.position, spacecraft: p.spacecraft, iss: !!p.iss,
      launched: p.launched ? new Date(p.launched * 1000).toISOString() : null, priorDaysInSpace: p.days_in_space ?? null, wikipedia: p.url || null, ...extra });
  }
  allowed = new Map();
  for (const p of people) {
    if (p.portrait?.url) allowed.set(p.portrait.file, { kind: 'portrait' });
    if (p.flag?.url) allowed.set(p.flag.file, { kind: 'flag' });
  }
  const byCraft = {};
  for (const p of people) byCraft[p.spacecraft] = (byCraft[p.spacecraft] ?? 0) + 1;
  return { time: new Date(feed.storedAt).toISOString(), cache: feed.cache, number: people.length, expedition: j.iss_expedition ?? null, byCraft, people,
    credit: 'People in space: corquaid/international-space-station-APIs (MIT). Facts: Wikidata (CC0). Portraits and flags: Wikimedia Commons, licence per file.' };
}

/** GET /api/crew/image?file=…: a portrait thumbnail or flag the current crew list allows, cached. */
export async function crewImage(file) {
  if (!allowed.size) await crew();
  const a = allowed.get(file);
  if (!a) throw Object.assign(new Error('not a current crew image'), { status: 404 });
  const v = (await cached('crew-images', file, 90 * DAY, async () => {
    const info = await commonsInfo(file);
    const url = a.kind === 'flag' ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}` : info.thumb;
    const body = await serial(() => get(url, 'bin'));
    return { type: a.kind === 'flag' || /\.svg$/i.test(file) ? 'image/svg+xml' : /\.png$/i.test(file) ? 'image/png' : 'image/jpeg', b64: body.toString('base64'), licence: info.licence, artist: info.artist };
  })).value;
  return { body: Buffer.from(v.b64, 'base64'), type: v.type, maxAge: 7 * 86400, headers: { 'x-licence': encodeURIComponent(v.licence ?? ''), 'x-artist': encodeURIComponent(v.artist ?? '') } };
}
