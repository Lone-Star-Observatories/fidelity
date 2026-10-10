// COMMS (#35): who can talk to this body or craft right now, and how.
// Every entry shows its source, its age ("12 S AGO"), a provenance badge and whether the link is
// up now. Sections appear only where something live exists:
//   spacecraft   NASA DSN Now: band, data rate, received power, antenna and complex (+ last seen)
//   satellites   SatNOGS transmitters and observations (waterfalls, audio); the ISS's ham radio
//   Earth        the three DSN complexes now, and the live-signals map (signalsmap.js)
//   Moon, Mars   DSN links to the craft there; for Mars the rovers' newest raw images and weather,
//                and the one-way light time.

import '../styles/comms.css';
import { badge } from '../data/provenance.js';
import { BODY_CRAFT, contactsFor, lastSeenFor, DSN_COMPLEX, dishSize, dsnRate, ago, lightSeconds, formatLight, ISS_RADIO } from '../data/comms.js';
import { createSignalsMap } from './signalsmap.js';

const STANDALONE = import.meta.env.MODE === 'standalone';
const NEEDS_BACKEND = 'Live communications need the local backend (npm start); the single-file preview carries none.';
const el = (tag, props = {}, ...kids) => {
  const e = Object.assign(document.createElement(tag), props);
  for (const k of kids.flat()) if (k != null && k !== false) e.append(k);
  return e;
};
const link = (label, href) => el('a', { className: 'pill cm-link', href, target: '_blank', rel: 'noopener noreferrer', textContent: label });

// ages tick once a second wherever they are on screen
let ager = null;
function startAger() {
  ager ??= setInterval(() => { for (const n of document.querySelectorAll('.cm-age[data-t]')) n.textContent = ago(n.dataset.t); }, 1000);
}
function age(t) {
  if (!t) return null;
  startAger();
  const n = el('span', { className: 'cm-age mono', textContent: ago(t) });
  n.dataset.t = t;
  return n;
}

/**
 * One COMMS entry. { name, value, source, time, tier, detail, up: true | false | null, status, links: [[label, href]] }
 */
export function commsEntry({ name, value, source, time, tier = 'measured', detail = '', up = null, status, links = [] }) {
  return el('div', { className: `cm-entry${up === true ? ' cm-up' : up === false ? ' cm-down' : ''}` },
    el('div', { className: 'cm-head' }, el('span', { className: 'cm-dot', title: up === true ? 'Link up now' : up === false ? 'Not reachable now' : '' }),
      el('span', { className: 'cm-name', textContent: name }), badge(tier, detail)),
    value ? el('div', { className: 'cm-val mono', textContent: value }) : null,
    el('div', { className: 'cm-meta' },
      el('span', { className: 'cm-status', textContent: status ?? (up === true ? 'LINK UP NOW' : up === false ? 'NOT IN CONTACT' : '') }),
      source ? el('span', { textContent: source }) : null, age(time),
      ...links.filter(([, href]) => href).map(([l, href]) => link(l, href))));
}

/** DSN Now contacts → entries (band, rate, power, dish, complex). `nameOf(contact)` names the craft. */
export function dsnEntries(contacts, time, nameOf = (c) => c.code) {
  return contacts.map((c) => {
    const d = c.down, u = c.up;
    const value = [
      d ? `↓ ${d.band}-BAND ${d.rate > 0 ? dsnRate(d.rate) : 'CARRIER'} · ${d.power} dBm` : null,
      u ? `↑ ${u.band}-BAND${u.power ? ` ${u.power} kW` : ''}` : null,
      `${c.dish.replace(/^DSS/, 'DSS-')} · ${dishSize(c.dish)} M · ${DSN_COMPLEX[c.station] ?? c.station?.toUpperCase()}`,
      c.rtltSec ? `ONE-WAY LIGHT ${formatLight(c.rtltSec / 2)}` : null,
    ].filter(Boolean).join(' · ');
    return commsEntry({ name: `${nameOf(c).toUpperCase()} ⇄ ${c.dish.replace(/^DSS/, 'DSS-')}`, value, source: 'NASA DSN NOW', time, up: true, tier: 'measured',
      detail: 'NASA Deep Space Network status (eyes.nasa.gov/dsn): received power and data rate as reported by the station, refreshed every 20 s.',
      links: [['DSN NOW ↗', 'https://eyes.nasa.gov/dsn/dsn.html']] });
  });
}

/** Last-seen entries for craft not in contact now. */
function lastSeenEntries(list) {
  return list.map((s) => commsEntry({ name: `${s.name.toUpperCase()}`, value: `LAST ⇄ ${String(s.dish).replace(/^DSS/, 'DSS-')} · ${DSN_COMPLEX[s.station] ?? s.station}${s.band ? ` · ${s.band}-BAND` : ''}`,
    source: 'LAST SEEN BY THIS BACKEND', time: s.at, up: false, tier: 'measured', status: 'NOT IN CONTACT',
    detail: 'When this backend last saw the craft in the DSN Now feed. It only watches while the app polls, so earlier contacts may be missing.' }));
}

/** The spacecraft panel's DSN section: contacts now, or when it was last seen. */
export function spacecraftComms(dsn, horizonsId, nameOf) {
  if (STANDALONE) return [el('p', { className: 'note', textContent: NEEDS_BACKEND })];
  if (!dsn) return [el('p', { className: 'note', textContent: 'Live DSN status needs the local backend.' })];
  const mine = dsn.contacts?.filter((c) => String(c.spacecraftId) === String(horizonsId)) ?? [];
  const seen = dsn.lastSeen?.[horizonsId];
  return [
    ...(mine.length ? dsnEntries(mine, dsn.time, nameOf)
      : seen ? lastSeenEntries([{ ...seen, name: nameOf({ code: seen.code, spacecraftId: Number(horizonsId) }) }])
        : [el('p', { className: 'note', textContent: 'NOT IN CONTACT RIGHT NOW. Antennas are shared by dozens of missions; check back in a few hours.' })]),
    el('p', { className: 'note', textContent: 'Only NASA\'s DSN publishes a live machine-readable contact feed. ESA ESTRACK and JAXA\'s stations (Usuda, Misasa) publish none, so contacts through them are not shown.' }),
  ];
}

// ---- satellites ---------------------------------------------------------------------------------

/** The Satellite View's COMMS section: SatNOGS transmitters and observations, the ISS's ham radio. */
export function satelliteComms(norad) {
  const box = el('div', { className: 'cm-list' });
  if (norad === 25544) {
    box.append(el('h4', { className: 'cm-sub', textContent: 'AMATEUR RADIO · ARISS' }),
      el('dl', { className: 'cm-facts' }, ISS_RADIO.rows.flatMap(([k, v]) => [el('dt', {}, el('span', { textContent: k }), badge('reported', ISS_RADIO.source)), el('dd', { className: 'mono', textContent: v })])),
      el('div', { className: 'body-list' }, ISS_RADIO.links.map(([l, href]) => link(l, href))),
      el('p', { className: 'note', textContent: 'School contacts and SSTV weekends are scheduled events, published by ARISS; there is no live API, so these are links. Live video is under LIVE FEEDS.' }));
  }
  const live = el('div', { className: 'cm-list' }, el('p', { className: 'note', textContent: STANDALONE ? NEEDS_BACKEND : 'ASKING SATNOGS…' }));
  box.append(el('h4', { className: 'cm-sub', textContent: 'RADIO · SATNOGS' }), live);
  if (STANDALONE) return box;
  fetch(`/api/comms/satnogs/${norad}`).then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status)))).then((d) => {
    const tx = (d.transmitters.rows ?? []).filter((t) => t.alive);
    const obs = d.observations.rows ?? [];
    live.replaceChildren(
      ...(tx.length ? tx.slice(0, 8).map((t) => commsEntry({
        name: t.description.toUpperCase(),
        value: [t.downlink ? `↓ ${t.downlink.toFixed(3)} MHz` : null, t.uplink ? `↑ ${t.uplink.toFixed(3)} MHz` : null, t.mode, t.baud ? `${t.baud} BAUD` : null].filter(Boolean).join(' · '),
        source: 'SATNOGS DB', time: d.transmitters.fetched, tier: 'reported', up: null,
        status: t.status === 'active' ? 'LISTED ACTIVE' : t.status.toUpperCase(),
        detail: `Crowd-sourced transmitter record (SatNOGS DB, CC BY-SA 4.0)${t.citation ? `; cited: ${t.citation}` : ''}. "Active" means listed as transmitting, not that it is overhead now.`,
      })) : [el('p', { className: 'note', textContent: d.transmitters.rows ? 'SatNOGS lists no live transmitter for this satellite.' : 'SatNOGS DB unreachable.' })]),
      tx.length > 8 ? el('p', { className: 'note', textContent: `+${tx.length - 8} MORE IN SATNOGS DB` }) : null,
      el('h4', { className: 'cm-sub', textContent: 'HEARD LATELY · SATNOGS NETWORK' }),
      ...(obs.length ? obs.slice(0, 5).map((o) => commsEntry({
        name: `${String(o.station).toUpperCase()}${o.frequencyMhz ? ` · ${o.frequencyMhz.toFixed(3)} MHz` : ''}`,
        value: [o.description, o.mode, o.maxAltitude != null ? `PASS MAX ${o.maxAltitude}° ELEV` : null, o.decoded ? `${o.decoded} DECODED FRAME FILE${o.decoded > 1 ? 'S' : ''}` : null].filter(Boolean).join(' · ').toUpperCase(),
        source: 'SATNOGS NETWORK', time: o.end, tier: 'measured', up: null, status: 'HEARD',
        detail: 'A volunteer ground station recorded this pass and it was vetted "good" (signal present). Waterfall and audio are the raw recording (CC BY-SA 4.0).',
        links: [['WATERFALL ↗', o.waterfall], ['AUDIO ↗', o.audio], ['OBSERVATION ↗', o.url]],
      })) : [el('p', { className: 'note', textContent: d.observations.rows ? 'No good SatNOGS observation of this satellite recently.' : 'SatNOGS Network unreachable.' })]),
      el('div', { className: 'body-list' }, link('SATNOGS DB ↗', d.links.db), link('ALL OBSERVATIONS ↗', d.links.network)),
      el('p', { className: 'note credit', textContent: d.credit }));
  }).catch(() => live.replaceChildren(el('p', { className: 'note', textContent: 'SatNOGS is unreachable from the backend right now.' })));
  return box;
}

// ---- bodies (detail views) ----------------------------------------------------------------------

const ROVERS = [['m20', 'PERSEVERANCE', 'MEDA'], ['msl', 'CURIOSITY', 'REMS']];
const nowJd = () => Date.now() / 86400000 + 2440587.5;

/**
 * The COMMS card for Earth, the Moon or Mars (null for any other body).
 * opts: { system } — for Mars's light time (System View positions in AU).
 */
export function createCommsCard(bodyId, { system } = {}) {
  if (!['earth', 'moon', 'mars'].includes(bodyId)) return null;
  const node = el('section', { className: 'sv-card cm-card' },
    el('div', { className: 'sv-card-head' }, el('h3', { textContent: `COMMS · ${bodyId.toUpperCase()}` }),
      badge('measured', 'Live links from public feeds; every entry carries its own source, age and badge.')));
  const map = bodyId === 'earth' ? createSignalsMap() : null;
  if (STANDALONE) {
    node.append(el('p', { className: 'note', textContent: NEEDS_BACKEND }));
    return { node, extra: map, tick() {}, dispose() {} }; // the map is its own part (detail.js disposes it)
  }
  const dsnBox = el('div', { className: 'cm-list' }, el('p', { className: 'note', textContent: 'ASKING THE DEEP SPACE NETWORK…' }));
  const light = bodyId === 'mars' ? el('div', { className: 'cm-list' }) : null;
  node.append(el('h4', { className: 'cm-sub', textContent: bodyId === 'earth' ? 'DEEP SPACE NETWORK · THE THREE COMPLEXES NOW' : `DEEP SPACE NETWORK · ${bodyId === 'moon' ? 'LUNAR' : 'MARS'} CRAFT` }), dsnBox);
  if (light) node.append(el('h4', { className: 'cm-sub', textContent: 'LIGHT TIME' }), light);

  let dsnAt = 0, lightAt = 0, dead = false;
  async function pollDsn() {
    dsnAt = performance.now();
    try {
      const r = await fetch('/api/dsn');
      if (!r.ok) throw new Error(r.status);
      drawDsn(await r.json());
    } catch { if (!dead) dsnBox.replaceChildren(el('p', { className: 'note', textContent: 'DSN Now is unreachable from the backend right now.' })); }
  }
  function drawDsn(d) {
    if (dead) return;
    if (bodyId === 'earth') {
      dsnBox.replaceChildren(...Object.entries(DSN_COMPLEX).map(([st, label]) => {
        const here = d.contacts.filter((c) => c.station === st);
        const dishes = new Set(here.map((c) => c.dish));
        return commsEntry({ name: label, value: here.length ? here.map((c) => `${c.code} (${c.dish.replace(/^DSS/, 'DSS-')})`).join(' · ') : 'NO ACTIVE LINKS', up: here.length > 0,
          status: here.length ? `${dishes.size} DISH${dishes.size === 1 ? '' : 'ES'} · ${here.length} LINK${here.length === 1 ? '' : 'S'}` : 'IDLE', source: 'NASA DSN NOW', time: d.time, tier: 'measured',
          detail: 'Which spacecraft each Deep Space Network complex is talking to now (eyes.nasa.gov/dsn).', links: [['DSN NOW ↗', 'https://eyes.nasa.gov/dsn/dsn.html']] });
      }), el('p', { className: 'note', textContent: 'Goldstone, Madrid and Canberra sit ~120° apart in longitude so one of them can always see a deep-space craft. Open any craft for its link details.' }));
      return;
    }
    const now = contactsFor(bodyId, d.contacts);
    const names = BODY_CRAFT[bodyId];
    const seen = lastSeenFor(bodyId, d.lastSeen).filter((s) => !now.some((c) => c.spacecraftId === s.id));
    dsnBox.replaceChildren(...dsnEntries(now, d.time, (c) => names[String(c.code).toLowerCase()] ?? c.code), ...lastSeenEntries(seen.slice(0, 6)),
      ...(now.length || seen.length ? [] : [el('p', { className: 'note', textContent: `No ${bodyId === 'moon' ? 'lunar' : 'Mars'} craft in contact right now, and none seen since this backend started watching.` })]),
      el('p', { className: 'note', textContent: `Watched: ${Object.values(names).filter((v, i, a) => a.indexOf(v) === i).join(', ')}. ${bodyId === 'mars' ? 'The rovers mostly talk through the orbiters (UHF relay), which then talk to Earth.' : 'Craft come and go with missions (Artemis, CLPS landers when active).'}` }));
  }
  function drawLight() {
    lightAt = performance.now();
    try {
      const jd = nowJd();
      const a = system.positionOf('mars', jd), b = system.positionOf('earth', jd);
      const au = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      const s = lightSeconds(au);
      light.replaceChildren(commsEntry({ name: 'EARTH → MARS, ONE WAY', value: `${formatLight(s)} · ${au.toFixed(3)} AU · ROUND TRIP ${formatLight(2 * s)}`, tier: 'computed', source: 'EPHEMERIS · NOW (WALL CLOCK)', up: null, status: 'SIGNAL DELAY',
        detail: 'Distance between the planets\' centres now (the app\'s ephemeris) divided by the speed of light. A command sent now arrives this much later.' }));
    } catch { light.replaceChildren(el('p', { className: 'note', textContent: 'POSITIONS UNAVAILABLE' })); }
  }

  // Mars: the rovers' newest raw images and weather
  if (bodyId === 'mars') {
    for (const [rover, name, wx] of ROVERS) {
      const grid = el('div', { className: 'im-grid cm-raw' }, el('p', { className: 'note', textContent: 'LOADING RAW IMAGES…' }));
      const weather = el('div', { className: 'cm-list' });
      node.append(el('h4', { className: 'cm-sub', textContent: `${name} · NEWEST RAW IMAGES` }), grid, weather);
      fetch(`/api/comms/mars-raw/${rover}`).then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status)))).then((d) => {
        if (!d.images.length) throw new Error('none');
        const head = d.images[0];
        grid.replaceChildren(...d.images.slice(0, 6).map((i) => {
          const tile = el('figure', { className: 'im-tile' }, el('img', { src: `/api/comms/raw-image?url=${encodeURIComponent(i.thumb)}`, alt: i.title, loading: 'lazy' }),
            el('figcaption', {}, el('span', { textContent: `SOL ${i.sol} · ${i.camera.replace(/_/g, ' ')}` }), badge('measured', `${d.credit}. Raw, unprocessed downlink.`), el('span', { className: 'im-time mono', textContent: i.taken ? `${i.taken.slice(0, 16).replace('T', ' ')} UTC` : '' })));
          if (i.link) tile.addEventListener('click', () => window.open(i.link, '_blank', 'noopener'));
          return tile;
        }));
        grid.after(commsEntry({ name: `${name} · LAST DOWNLINK`, value: `SOL ${head.sol} · ${d.images.length}+ NEW IMAGES · ${head.camera.replace(/_/g, ' ')}`, source: 'NASA RAW IMAGES', time: head.received ?? head.taken, tier: 'measured', up: null,
          status: 'LAST CONTACT (VIA RELAY)', detail: 'When NASA received the newest raw image: the last data downlinked from the rover that is public.',
          links: [['ALL RAW IMAGES ↗', rover === 'm20' ? 'https://mars.nasa.gov/mars2020/multimedia/raw-images/' : 'https://mars.nasa.gov/msl/multimedia/raw-images/']] }));
      }).catch(() => grid.replaceChildren(el('p', { className: 'note', textContent: 'Raw images unavailable right now.' })));
      fetch(`/api/comms/mars-weather/${rover}`).then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status)))).then((d) => {
        const w = d.latest;
        if (!w) throw new Error('none');
        const old = Date.now() - Date.parse(w.date) > 30 * 86400000;
        weather.replaceChildren(commsEntry({ name: `${name} WEATHER · ${wx} · SOL ${w.sol}`,
          value: [w.minC != null ? `${w.minC}…${w.maxC} °C` : null, w.pressurePa != null ? `${w.pressurePa} Pa` : null, w.opacity?.toUpperCase(), w.uv ? `UV ${w.uv.toUpperCase()}` : null, w.season?.toUpperCase()].filter(Boolean).join(' · '),
          source: `${d.instrument} · EARTH DATE ${w.date}${old ? ' · NOT UPDATED RECENTLY' : ''}`, time: `${w.date}T12:00:00Z`, tier: 'measured', up: null, status: 'LATEST PUBLISHED SOL',
          detail: `${d.credit}. Air temperature range and pressure for the sol, as published for outreach.` }));
      }).catch(() => weather.replaceChildren(el('p', { className: 'note', textContent: `${wx} weather unavailable right now.` })));
    }
  }

  pollDsn();
  if (light) drawLight();
  return {
    node, extra: map,
    tick() {
      if (performance.now() - dsnAt > 20000) pollDsn();
      if (light && performance.now() - lightAt > 5000) drawLight();
    },
    dispose() { dead = true; },
  };
}
