// Text search (#63): a box in the top bar (/ or Ctrl/⌘+K focuses it) that finds anything the ship
// knows: Sol's bodies, Lagrange points and regions, spacecraft and missions (with the events feed),
// Earth satellites, stars and exoplanets in the Navigation catalogue (via /api/star-search), surface
// sites, nebulae, star clusters, galaxies, and sky and dated events (which set the clock). Results
// group by kind with provenance badges; ↑ ↓ Enter Esc work; recent picks are remembered locally.

import { indexEntries, search, groupHits, fold } from '../data/search.js';
import { staticEntries } from '../data/search-index.js';
import { eventsFeed } from '../data/events.js';
import { skyEvents } from '../data/skyevents.js';
import { eventTitle, watchFrom } from './skyevents.js';
import { dateFromJd } from '../astro/time.js';

const RECENT_KEY = 'fidelity.search.recent';
// group order and labels; tier = the badge each kind carries
const KINDS = {
  body: { label: 'SOL · BODIES', tier: 'measured' }, 'small body': { label: 'SOL · SMALL BODIES', tier: 'measured' },
  place: { label: 'SOL · POINTS & REGIONS', tier: 'computed' }, spacecraft: { label: 'SPACECRAFT', tier: 'measured' },
  mission: { label: 'MISSIONS', tier: 'reported' }, event: { label: 'EVENTS · FEED', tier: 'reported' }, sky: { label: 'SKY EVENTS', tier: 'computed' },
  satellite: { label: 'EARTH SATELLITES', tier: 'measured' }, star: { label: 'STARS', tier: 'measured' }, 'exoplanet host': { label: 'PLANET HOSTS', tier: 'measured' },
  exoplanet: { label: 'EXOPLANETS', tier: 'measured' }, site: { label: 'SURFACE SITES', tier: 'measured' }, nebula: { label: 'NEBULAE', tier: 'measured' },
  cluster: { label: 'STAR CLUSTERS', tier: 'measured' }, galaxy: { label: 'GALAXIES', tier: 'measured' }, 'galaxy cluster': { label: 'GALAXY CLUSTERS', tier: 'measured' },
};
const utc = (jd) => dateFromJd(jd).toISOString().slice(0, 16).replace('T', ' ');
const read = () => { try { return JSON.parse(localStorage.getItem(RECENT_KEY)) ?? []; } catch { return []; } };
const write = (list) => { try { localStorage.setItem(RECENT_KEY, JSON.stringify(list)); } catch { /* private mode */ } };

/** Live entries: the events feed and computed sky events, as they stand now. */
export function liveEntries(now) {
  const out = [];
  for (const e of eventsFeed()?.events ?? []) out.push({ kind: 'event', id: e.id, name: e.title, aliases: [...(e.orgs ?? []), ...(e.bodies ?? []), e.type].filter((x) => typeof x === 'string'), sub: `${(e.category ?? e.type ?? '').toUpperCase()} · ${(e.time ?? '').slice(0, 10)}`, route: { event: e.id } });
  for (const e of skyEvents() ?? []) {
    if ((e.contacts?.P4 ?? e.end ?? e.greatest) < now) continue;
    const t = eventTitle(e);
    out.push({ kind: 'sky', id: `sky-${e.type}-${e.greatest}`, name: t, aliases: [e.type, e.kind, `${e.type} eclipse`].filter(Boolean), sub: `${utc(e.greatest)} UTC`, route: { sky: e } });
  }
  return out;
}

export function createSearch({ h, badge, $, go, clock, actions }) {
  const host = $('search');
  const input = h('input', { type: 'search', className: 'search-input', placeholder: 'SEARCH  /', autocomplete: 'off', spellcheck: false, 'aria-label': 'Search everything (/ or Ctrl+K)' });
  const list = h('div', { className: 'search-drop', role: 'listbox', hidden: true });
  host.append(input, list);

  let base = null, sats = null, liveAt = 0, live = [], remote = [], remoteQ = '', items = [], active = -1, timer = null;
  const index = () => {
    base ??= indexEntries(staticEntries());
    if (Date.now() - liveAt > 30000) { live = indexEntries(liveEntries(clock.jd)); liveAt = Date.now(); }
    return [...base, ...live, ...(sats ?? [])];
  };
  function loadSatellites() {
    if (sats) return;
    sats = [];
    actions.satellites?.().then((d) => {
      if (!d?.rows) return;
      sats = indexEntries(d.rows.map((r) => ({ kind: 'satellite', id: String(r[0]), name: r[1], aliases: [String(r[0]), `NORAD ${r[0]}`], sub: `NORAD ${r[0]}`, route: { satellite: String(r[0]) }, boost: r[0] === 25544 ? 4 : 0 })));
      if (input.value.trim()) render();
    });
  }

  function choose(hit) {
    if (!hit) return;
    const { _keys, score, ...keep } = hit;
    if (keep.kind !== 'sky') write([keep, ...read().filter((x) => !(x.kind === keep.kind && x.id === keep.id))].slice(0, 8));
    close(); input.value = ''; input.blur();
    const r = hit.route ?? {};
    if (r.body) return go({ level: 'system', system: 'sol', body: r.body });
    if (r.satellite) return go({ level: 'satellite', system: 'sol', body: r.satellite });
    if (r.event) return go({ level: 'events', system: 'sol', body: r.event });
    if (r.sky) { clock.set(r.sky.type === 'solar' || r.sky.type === 'lunar' ? r.sky.greatest - 2 / 1440 : r.sky.greatest); return go({ level: 'system', system: 'sol', body: watchFrom(r.sky) }); }
    if (r.mission) return actions.mission?.(r.mission);
    if (r.site) return actions.site?.(r.site);
    if (r.quadrant) return actions.quadrant?.(r.quadrant);
    if (r.universe) return actions.universe?.(r.universe);
    if (r.system) return go({ level: 'system', system: r.system, body: r.body ?? null });
  }

  function row(hit, i) {
    const k = KINDS[hit.kind] ?? { tier: 'measured' };
    const b = h('button', { className: `search-row${i === active ? ' on' : ''}`, role: 'option', type: 'button' },
      h('span', { className: 'search-name', textContent: hit.name.toUpperCase() }),
      h('span', { className: 'search-sub mono', textContent: hit.sub ?? '' }),
      badge(hit.tier ?? k.tier));
    b.addEventListener('pointerdown', (e) => e.preventDefault()); // keep focus in the input
    b.addEventListener('click', () => choose(hit));
    b.addEventListener('pointerenter', () => { active = i; mark(); });
    return b;
  }
  function mark() { [...list.querySelectorAll('.search-row')].forEach((el, i) => el.classList.toggle('on', i === active)); list.querySelector('.search-row.on')?.scrollIntoView({ block: 'nearest' }); }

  function render() {
    const q = input.value.trim();
    list.replaceChildren();
    items = [];
    if (!q) {
      const rec = read();
      if (!rec.length) { list.append(h('p', { className: 'search-note', textContent: 'TYPE A NAME: PLANETS, MOONS, ASTEROIDS (16 PSYCHE), CRAFT, SATELLITES, STARS (ALPHA CEN, HD 10700), SITES, NEBULAE, GALAXIES, EVENTS.' })); }
      else { list.append(h('div', { className: 'search-group', textContent: 'RECENT' })); items = rec; rec.forEach((hit, i) => list.append(row(hit, i))); }
      list.hidden = false;
      return;
    }
    const hits = search(index(), q, { limit: 60 });
    const stars = remoteQ === fold(q) ? remote : [];
    const all = [...hits, ...stars].sort((a, b) => b.score - a.score);
    const groups = groupHits(all, 6);
    for (const g of groups) {
      list.append(h('div', { className: 'search-group', textContent: KINDS[g.kind]?.label ?? g.kind.toUpperCase() }));
      for (const hit of g.hits) { list.append(row(hit, items.length)); items.push(hit); }
    }
    if (!groups.length) list.append(h('p', { className: 'search-note', textContent: fold(q).length < 2 || remoteQ === fold(q) ? 'NO MATCH' : 'SEARCHING THE STAR CATALOGUE…' }));
    if (active >= items.length) active = items.length - 1;
    if (active < 0 && items.length) active = 0;
    mark();
    list.hidden = false;
  }

  async function askStars(q) {
    const f = fold(q);
    if (f.length < 2) return;
    const res = await actions.stars?.(q);
    if (fold(input.value.trim()) !== f) return; // typed on
    remote = (res?.hits ?? []).map((s) => ({ ...s, sub: s.kind === 'exoplanet' ? `${s.host.toUpperCase()} · ${s.distLy.toFixed(1)} LY${s.year ? ` · FOUND ${s.year}` : ''}` : `${s.distLy.toFixed(s.distLy < 100 ? 2 : 0)} LY${s.spect ? ` · ${s.spect}` : ''}${s.planets ? ` · ${s.planets} PLANET${s.planets > 1 ? 'S' : ''}` : ''}`,
      route: { system: s.system, body: s.body ?? null }, score: s.score - 1 })); // a Sol name of the same strength comes first
    remoteQ = f;
    render();
  }

  input.addEventListener('input', () => { active = 0; render(); clearTimeout(timer); timer = setTimeout(() => askStars(input.value.trim()), 180); });
  input.addEventListener('focus', () => { loadSatellites(); render(); });
  input.addEventListener('blur', () => setTimeout(close, 120));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(items.length - 1, active + 1); mark(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(0, active - 1); mark(); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(items[active] ?? items[0]); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (input.value) { input.value = ''; render(); } else { close(); input.blur(); } }
  });
  function close() { list.hidden = true; active = -1; }
  // / or Ctrl/⌘+K from anywhere outside a text field
  addEventListener('keydown', (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
    if ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey)) { e.preventDefault(); input.focus(); input.select(); }
    else if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); input.focus(); input.select(); }
  }, true);

  return { focus: () => input.focus(), choose, get input() { return input; } };
}
