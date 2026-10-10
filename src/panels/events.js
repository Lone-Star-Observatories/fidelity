// EVENTS (#32, #33): the weekly events feed as a panel — launches (SpaceX, NASA, ESA, other agencies
// and private companies), station traffic, spacewalks, landings, deep-space milestones and sky
// events — filterable by kind and by organisation, with webcasts in the feed viewer and a button
// that sets the ship's clock to the moment and flies to where it happens. Launches, landings and
// dockings then play out in the System View (src/views/system/missions.js).

import { CATEGORIES } from '../data/events-schema.js';
import { loadEvents, eventsFeed, onEvents, jumpJd, modelSpan } from '../data/events.js';
import { missionClock } from '../views/system/missions.js';

const ORG_FILTERS = [['SpaceX', 'SPACEX'], ['NASA', 'NASA'], ['ESA', 'ESA'], ['private', 'PRIVATE'], ['agencies', 'OTHER AGENCIES']];
const OTHER_AGENCIES = ['Roscosmos', 'CNSA', 'JAXA', 'ISRO', 'agency', 'Arianespace', 'NOAA'];
const SOL_BODIES = new Set(['mercury', 'venus', 'earth', 'moon', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'sun']);
const FINE = new Set(['second', 'minute', 'hour']);

const ll = (lat, lon) => `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(2)}°${lon >= 0 ? 'E' : 'W'}`;
const when = (e) => {
  const d = new Date(e.time).toISOString();
  if (FINE.has(e.precision)) return `${d.slice(0, 16).replace('T', ' ')} UTC`;
  if (e.precision === 'day') return `${d.slice(0, 10)} (DAY)`;
  return `NET ${d.slice(0, 7)} (${(e.precision ?? '').toUpperCase()})`;
};
export function countdown(jdEvent, jdNow) {
  const s = (jdEvent - jdNow) * 86400, a = Math.abs(s);
  const txt = a < 3600 ? `${Math.round(a / 60)} MIN` : a < 172800 ? `${Math.floor(a / 3600)} H ${Math.round((a % 3600) / 60)} M` : `${Math.round(a / 86400)} DAYS`;
  return s >= 0 ? `IN ${txt}` : `${txt} AGO`;
}
const orgMatch = (e, f) => (f === 'agencies' ? e.orgs?.some((o) => OTHER_AGENCIES.includes(o)) : e.orgs?.includes(f));

export function createEventsPanel({ h, pill, row, badge, go, clock, system, toast, panel, live, resetLive, $ }) {
  const state = { cat: 'all', orgs: new Set(), past: false, selected: null };
  let rendered = false;

  // ---- video viewer (shares the feed viewer with the Satellite View) ----------------------------
  function openVideo(title, sub, v, credit) {
    const el = $('feed-viewer');
    el.hidden = false;
    el.replaceChildren(
      h('div', { className: 'fv-head' }, h('span', { className: 'fv-title', textContent: title.toUpperCase() }), h('span', { className: 'fv-sub', textContent: sub }),
        badge('reported', `Webcast published by ${credit || 'the operator'}; embedded from YouTube.`), pill('✕', () => { el.hidden = true; el.replaceChildren(); }, 'square')),
      h('div', { className: 'fv-body' }, h('div', {},
        v.embed ? h('iframe', { src: `${v.embed}${v.embed.includes('?') ? '&' : '?'}autoplay=1`, allow: 'autoplay; encrypted-media; picture-in-picture', allowFullscreen: true, className: 'fv-video', title }) : h('p', { className: 'note', textContent: 'This webcast cannot be embedded here.' }),
        h('a', { href: v.url, target: '_blank', rel: 'noopener', className: 'fv-link', textContent: 'OPEN AT SOURCE ↗' }))),
      h('div', { className: 'fv-credit', textContent: credit ?? '' }));
  }
  const closeViewer = () => { const el = $('feed-viewer'); if (el) { el.hidden = true; el.replaceChildren(); } };

  // ---- going there ------------------------------------------------------------------------
  function goTo(e) {
    clock.set(jumpJd(e));
    if (e.model?.kind === 'launch' || e.model?.kind === 'landing') {
      if (e.model?.kind === 'launch') clock.setRate(1 / 86400);
      const loc = e.location;
      if (loc?.lat != null) system.viewEarthPoint(loc.lat, loc.lon, e.model.kind === 'launch' ? 6000 : 9000);
      toast(`${e.model.kind === 'launch' ? 'LIFTOFF' : 'TOUCHDOWN'} ${e.model.kind === 'launch' ? 'IN 60 S' : 'IN 45 MIN'} · ${e.model.kind === 'launch' ? 'REAL TIME' : 'TRY 1 MIN/S'}`);
      return;
    }
    if (e.target?.norad && e.category === 'station') { go({ level: 'satellite', system: 'sol', body: String(e.target.norad) }); return; }
    if (e.type === 'lunar-eclipse' || e.type === 'occultation') { go({ level: 'system', system: 'sol', body: 'moon' }); return; }
    if (e.type === 'transit') { go({ level: 'system', system: 'sol', body: 'sun' }); return; }
    if (e.location?.lat != null) { system.viewEarthPoint(e.location.lat, e.location.lon, 12000); return; }
    const body = (e.bodies ?? []).find((b) => SOL_BODIES.has(b) && b !== 'earth') ?? (e.bodies?.includes('earth') ? 'earth' : null);
    if (body) go({ level: 'system', system: 'sol', body });
  }

  // ---- list ------------------------------------------------------------------------------
  function filtered(feed) {
    const now = clock.jd;
    return feed.events.filter((e) => (state.cat === 'all' || e.category === state.cat)
      && (!state.orgs.size || [...state.orgs].some((f) => orgMatch(e, f)))
      && (state.past ? true : (e.endJd ?? modelSpan(e)?.to ?? e.jd) >= now - 0.25));
  }
  const tierNote = (e) => (e.tier === 'reported' ? `Published by ${e.source?.name ?? 'the operator'}${e.status ? ` · status ${e.status.toUpperCase()}` : ''}. Schedules slip.` : e.tier === 'modelled' ? `Forecast: ${e.source?.name}` : `Computed: ${e.source?.name ?? ''}`);

  function eventRow(e) {
    const soon = e.jd - clock.jd > 0 && e.jd - clock.jd < 1;
    const cd = h('span', { className: 'mono' });
    live.eventCountdowns.push([cd, e]);
    const b = h('button', { className: `host-row event-row${state.selected === e.id ? ' active' : ''}`, title: `${e.title}\n${tierNote(e)}\nClick for details.`, onclick: () => { state.selected = e.id; go({ level: 'events', system: 'sol', body: e.id }); } },
      h('span', {}, soon ? h('span', { className: 'soon-dot', textContent: '● ' }) : null, `${e.title.toUpperCase()}`, e.video?.length ? ' ▶' : '', e.model ? ' ◈' : ''),
      cd);
    return b;
  }

  function detail(e) {
    const dl = h('dl');
    row(dl, 'WHEN', when(e), e.tier, tierNote(e));
    if (e.status) row(dl, 'STATUS', e.status.toUpperCase(), e.tier === 'computed' ? 'computed' : e.tier, tierNote(e));
    if (e.location?.name || e.location?.lat != null) row(dl, 'WHERE', `${(e.location.name ?? '').toUpperCase()}${e.location.lat != null ? ` · ${ll(e.location.lat, e.location.lon)}` : ''}`, e.location.tier ?? e.tier,
      e.location.tier === 'modelled' ? 'Approximate: the operator names the zone, not the point.' : 'Published coordinates.');
    if (e.vehicle?.rocket) row(dl, 'VEHICLE', `${e.vehicle.rocket.toUpperCase()}${e.vehicle.spacecraft ? ` · ${e.vehicle.spacecraft.toUpperCase()}` : ''}`, 'reported', e.vehicle.provider ?? '');
    if (e.mission?.orbit) row(dl, 'ORBIT', e.mission.orbit.toUpperCase(), 'reported', 'Target orbit class from Launch Library 2.');
    if (e.target?.name) row(dl, 'TARGET', e.target.name.toUpperCase(), 'reported', `NORAD ${e.target.norad}, positioned live by SGP4.`);
    for (const b of e.vehicle?.boosters ?? []) row(dl, 'BOOSTER', `${b.serial ?? '—'} · ${b.landing.type ?? ''} ${b.landing.abbrev ?? b.landing.name ?? ''}${b.landing.lat != null ? ` · ${ll(b.landing.lat, b.landing.lon)}` : ''}`.toUpperCase(), b.landing.tier,
      b.landing.tier === 'modelled' ? 'Drone-ship position modelled from the published downrange distance along the modelled ground track.' : 'Published landing zone.');
    if (e.orgs?.length) row(dl, 'WHO', e.orgs.join(' · ').toUpperCase(), 'reported', 'Organisations involved.');
    if (e.visibility?.note) row(dl, 'SEE IT', e.visibility.note.toUpperCase(), e.tier === 'reported' ? 'modelled' : e.tier, 'Where on Earth this can be seen.');
    for (const t of e.model?.tracks ?? []) row(dl, 'PATH', `${t.label.toUpperCase()} · ${t.points.length} PTS`, t.tier, t.basis);
    if (e.model?.relative) row(dl, 'APPROACH', 'STATION-RELATIVE PROFILE', e.model.relative.tier, e.model.relative.basis);
    const vids = e.video ?? [];
    return [
      h('h3', { textContent: e.title.toUpperCase() }),
      h('div', { className: 'kind', textContent: `${CATEGORIES[e.category]} · ${e.type.replace(/-/g, ' ').toUpperCase()}` }),
      dl,
      e.description ? h('p', { className: 'note', textContent: e.description }) : null,
      h('div', { className: 'body-list' },
        pill(e.model ? 'GO TO EVENT ◈ ▸' : 'GO TO EVENT ▸', () => goTo(e)),
        e.model && e.model.kind !== 'launch' ? pill('1 MIN/S', () => clock.setRate(1 / 1440)) : null,
        ...vids.slice(0, 4).map((v, i) => pill(v.embed ? `WATCH${vids.length > 1 ? ` ${i + 1}` : ''} ▶` : `${(v.publisher ?? 'WEBCAST').toUpperCase()} ↗`,
          () => (v.embed ? openVideo(e.title, `${v.publisher ?? ''}${v.start ? ` · ${v.start.slice(0, 16).replace('T', ' ')} UTC` : ''}`, v, v.publisher) : window.open(v.url, '_blank', 'noopener')))),
        ...(e.links ?? []).slice(0, 3).map((l) => pill(`${l.title.toUpperCase().slice(0, 24)} ↗`, () => window.open(l.url, '_blank', 'noopener')))),
      e.model ? h('p', { className: 'note', textContent: 'GO TO EVENT sets the ship\'s clock just before it starts and frames it: the modelled flight then plays out in the System View (◈). Paths are generic models pinned to the published pad, landing zones, orbit and timeline, not telemetry.' }) : null,
    ];
  }

  function streamsSection(feed) {
    const now = Date.now();
    const st = (feed.streams ?? []).filter((s) => s.status === 'live' || s.status === 'upcoming' || Date.parse(s.start) > now - 3 * 86400e3).slice(0, 10);
    return [
      h('h3', { textContent: 'WEBCASTS · LIVE, UPCOMING, RECENT' }),
      h('div', { className: 'host-list' }, st.length ? st.map((s) => h('button', { className: 'host-row event-row', title: `${s.title}\n${s.publisher ?? ''}`,
        onclick: () => openVideo(s.title, `${s.status.toUpperCase()} · ${s.publisher ?? ''}`, s, s.publisher) },
      h('span', { textContent: `${s.status === 'live' ? '● LIVE · ' : ''}${s.title.toUpperCase()}` }),
      h('span', { className: 'mono', textContent: `${s.status.toUpperCase()} · ${(s.publisher ?? '').toUpperCase()} · ${s.start?.slice(0, 16).replace('T', ' ')} UTC` }))) : [h('p', { className: 'note', textContent: 'NO WEBCASTS LISTED.' })]),
      h('h3', { textContent: 'SPACE CHANNELS · LIVE NOW (WHEN ON AIR)' }),
      h('div', { className: 'body-list' }, (feed.channels ?? []).map((c) => pill(c.name.toUpperCase(), () => openVideo(c.name, 'CURRENT LIVE STREAM', c, `${c.name}: ${c.note}`)))),
      h('p', { className: 'note', textContent: 'A channel button plays whatever that channel is broadcasting live; YouTube shows a notice when it is off air.' }),
    ];
  }

  function render(selectedId = state.selected) {
    resetLive();
    rendered = true;
    state.selected = selectedId;
    const feed = eventsFeed();
    live.eventCountdowns = [];
    if (!feed) {
      panel.replaceChildren(h('h2', { textContent: 'EVENTS' }), h('p', { className: 'note', textContent: 'LOADING THE EVENTS FEED…' }));
      loadEvents().then((f) => { if (rendered) { if (f) render(); else panel.replaceChildren(h('h2', { textContent: 'EVENTS' }), h('p', { className: 'warn', textContent: 'Events feed unavailable: start the local backend (npm start) or go online.' })); } });
      return;
    }
    const list = filtered(feed);
    const sel = feed.events.find((e) => e.id === state.selected);
    const catPills = [['all', 'ALL'], ...Object.entries(CATEGORIES).filter(([k]) => feed.events.some((e) => e.category === k))].map(([k, label]) => {
      const b = pill(label, () => { state.cat = k; render(); });
      b.classList.toggle('on', state.cat === k);
      return b;
    });
    const orgPills = ORG_FILTERS.map(([k, label]) => {
      const b = pill(label, () => { state.orgs.has(k) ? state.orgs.delete(k) : state.orgs.add(k); render(); });
      b.classList.toggle('on', state.orgs.has(k));
      return b;
    });
    const pastBtn = pill('PAST WEEK', () => { state.past = !state.past; render(); });
    pastBtn.classList.toggle('on', state.past);
    const stale = (feed.sources ?? []).filter((s) => s.status !== 'ok');
    panel.replaceChildren(
      h('h2', { textContent: 'EVENTS' }),
      h('div', { className: 'kind', textContent: `FEED OF ${feed.generated.slice(0, 10)} · ${feed.origin === 'github' ? 'GITHUB' : feed.origin === 'backend' ? 'VIA LOCAL BACKEND' : 'BUNDLED COPY'}` }),
      ...(sel ? detail(sel) : []),
      h('h3', { textContent: 'ON SCREEN NOW' }), (live.eventsActive = h('p', { className: 'note', textContent: '—' })),
      h('h3', { textContent: 'FILTER' }), h('div', { className: 'body-list' }, catPills), h('div', { className: 'body-list' }, orgPills, pastBtn),
      h('h3', { textContent: `UPCOMING · ${list.length}` }),
      h('div', { className: 'host-list' }, list.length ? list.slice(0, 80).map(eventRow) : [h('p', { className: 'note', textContent: 'NOTHING MATCHES THESE FILTERS.' })]),
      ...streamsSection(feed),
      h('h3', { textContent: 'SOURCES' }),
      h('div', { className: 'host-list' }, (feed.sources ?? []).map((s) => h('a', { className: 'host-row', href: s.url, target: '_blank', rel: 'noopener' },
        h('span', { textContent: s.name.toUpperCase() }), h('span', { className: `mono${s.status !== 'ok' ? ' warn' : ''}`, textContent: `${s.status.toUpperCase()} · ${s.count ?? 0}${s.licence ? ` · ${s.licence.toUpperCase()}` : ''}` })))),
      stale.length ? h('p', { className: 'warn', textContent: `${stale.length} source(s) failed at the last publish; their events are carried over from the previous week.` }) : null,
      h('p', { className: 'note', textContent: `Published weekly to GitHub (events/events.json). ${feed.note ?? ''} ▶ has a webcast, ◈ plays in the System View, ● within 24 hours.` }),
    );
    tick();
  }

  /** Countdowns and the on-screen list (from the shell's 200 ms ticker). */
  function tick() {
    const now = clock.jd;
    for (const [el, e] of live.eventCountdowns ?? []) {
      const s = modelSpan(e), on = s && now >= s.from && now <= s.to;
      el.textContent = `${on ? `${missionClock((now - e.jd) * 86400)} · ` : `${countdown(e.jd, now)} · `}${when(e)}`;
    }
    if (live.eventsActive) {
      const ids = system.activeMissions, feed = eventsFeed();
      const names = ids.map((id) => feed?.events.find((e) => e.id === id)?.title).filter(Boolean);
      live.eventsActive.textContent = names.length ? names.join(' · ').toUpperCase() : 'NO MODELLED ACTIVITY AT THE SHIP\'S CLOCK. PICK AN EVENT WITH ◈ AND GO TO IT.';
    }
  }

  /** Events within the next 24 h of the real clock (for the rail alert). */
  function soon() {
    const feed = eventsFeed(), now = Date.now() / 86400000 + 2440587.5;
    return (feed?.events ?? []).filter((e) => e.jd > now && e.jd - now < 1 && FINE.has(e.precision)).length;
  }

  onEvents(() => { if (rendered && panel.isConnected) render(); });

  return { render, tick, soon, goTo, closeViewer, leave: () => { rendered = false; } };
}
