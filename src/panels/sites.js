// Surface sites of note (#37): the SITES section of a body's panel (filters + list) and the card
// for one site: mission, date, what happened, coordinates with their source, "stand here", and any
// live feed (rover raw images, observatory webcams and streams).

import { modelPreview, siteModelId } from './model-preview.js';
import { sitesFor, SITE_KINDS } from '../data/sites.js';

const fmtLat = (x) => `${Math.abs(x).toFixed(4)}° ${x >= 0 ? 'N' : 'S'}`;
const fmtLon = (x) => `${Math.abs(x).toFixed(4)}° ${x >= 0 ? 'E' : 'W'}`;

export function createSitesPanel({ h, pill, row, badge, settings, panel, resetLive, renderLegend, viewFeed, stand, above, globe, back }) {
  const hidden = () => new Set(settings.get('siteHidden') ?? []);
  const toggleKind = (k) => {
    const s = hidden();
    s.has(k) ? s.delete(k) : s.add(k);
    settings.set('siteHidden', [...s]);
  };

  /** SITES section for a body's panel, or [] when it has none. */
  function section(body) {
    const list = sitesFor(body.id);
    if (!list.length) return [];
    const kinds = [...new Set(list.map((s) => s.kind))];
    const listEl = h('div', { className: 'host-list' });
    const filters = h('div', { className: 'body-list site-filters' });
    const draw = () => {
      const off = hidden();
      filters.replaceChildren(...kinds.map((k) => {
        const b = pill(`${off.has(k) ? '○' : '●'} ${SITE_KINDS[k].label}`, () => { toggleKind(k); draw(); }, `site-filter site-${k}`);
        b.classList.toggle('off', off.has(k));
        return b;
      }));
      listEl.replaceChildren(...list.filter((s) => !off.has(s.kind)).map((s) => {
        const b = h('button', { className: 'host-row' },
          h('span', { textContent: s.name }),
          h('span', { className: `mono site-${s.kind}`, textContent: `${SITE_KINDS[s.kind].label}${s.date ? ` · ${s.date.slice(0, 4)}` : ''}${s.feeds?.length ? ' · ● LIVE' : ''}` }));
        b.addEventListener('click', () => show(s, body));
        return b;
      }));
    };
    draw();
    return [h('h3', { textContent: `SITES OF NOTE · ${list.length}` }), filters, listEl,
      h('p', { className: 'note', textContent: settings.get('sites') ? 'Dots on the globe (labels on the near side; zoom in for all). Tap a label or a row for its card.' : 'Turn on SITES to draw them on the globe.' })];
  }

  /** The card for one site, in the side panel. */
  function show(s, body) {
    resetLive();
    const k = SITE_KINDS[s.kind];
    const facts = h('dl');
    row(facts, 'WHAT', s.kind === 'feature' ? s.type.toUpperCase() : k.label, s.tier === 'planned' ? 'planned' : 'measured', k.hint);
    if (s.diameterKm) row(facts, 'SIZE', `${s.diameterKm.toLocaleString()} KM`, 'measured', 'Diameter or length (USGS Gazetteer).');
    if (s.mission) row(facts, 'MISSION', s.mission.toUpperCase(), 'measured');
    if (s.agency) row(facts, 'BY', s.agency.toUpperCase(), 'measured');
    if (s.vehicle) row(facts, 'LAUNCH VEHICLE', s.vehicle.toUpperCase(), 'measured');
    if (s.date) row(facts, s.kind === 'planned' ? 'TARGET' : s.kind === 'observatory' || s.kind === 'launch' ? 'SINCE' : 'DATE', s.date, s.tier === 'planned' ? 'planned' : 'measured');
    const where = h('dl');
    row(where, 'LATITUDE', fmtLat(s.lat), s.tier === 'planned' ? 'planned' : 'measured', `Planetocentric. Source: ${s.source}`);
    row(where, 'LONGITUDE', fmtLon(s.lon), s.tier === 'planned' ? 'planned' : 'measured', `East-positive. Source: ${s.source}`);
    if (s.elevM != null) row(where, 'ELEVATION', `${s.elevM.toLocaleString()} M`, 'measured');
    if (s.approx) row(where, 'PRECISION', s.approx, 'modelled', 'The point drawn stands for a region or an uncertain position.');
    const t = s.traverseInfo;
    const drive = t ? h('dl') : null;
    if (t) {
      if (t.distanceKm != null) row(drive, s.traverseVerb ?? 'DRIVEN', `${t.distanceKm.toLocaleString()} KM`, 'measured', `${t.credit}. Summed along the published path.`);
      if (t.sol != null) row(drive, 'PATH UP TO', `SOL ${t.sol}`, 'measured');
      if (t.modelScale) row(drive, 'ROVER MODEL', `NASA MODEL · ENLARGED ×${t.modelScale.toLocaleString()}`, 'imagined', 'Drawn at its current position, enlarged so it can be found from above; the real rover is about 3 m long.');
      if (t.live) row(drive, 'NOW AT', `${fmtLat(t.last[1])} · ${fmtLon(t.last[0])}`, 'measured', 'End of the published traverse (the white dot).');
    }
    panel.replaceChildren(
      h('h2', { textContent: s.name.toUpperCase() }),
      h('div', { className: 'kind', textContent: `${body.name.toUpperCase()} · SITE OF NOTE · ${k.label}` }),
      h('div', { className: 'body-list' },
        pill('◀ BACK', () => back(body)),
        pill('FROM ABOVE ▸', () => above(body, s)),
        pill('STAND HERE ▸', () => stand(body, s)),
        pill('WHOLE GLOBE', () => globe())),
      s.note ? h('p', { className: 'note explain', textContent: s.note }) : null,
      ...(s.identity ? [h('h3', { textContent: 'WHOSE ROCKET?' }), h('dl', {}, h('dt', { textContent: 'IDENTITY' }), h('dd', { textContent: s.identity }), badge('modelled', 'Orbit reconstruction; disputed and unconfirmed.'))] : []),
      h('h3', { textContent: s.kind === 'impact' ? 'IMPACT' : 'MISSION' }), facts,
      ...(siteModelId(s) ? [h('h3', { textContent: 'VEHICLE MODEL' }), modelPreview(siteModelId(s)), badge('modelled', 'Drag to rotate. Visualization; dimensions and configuration are approximate.')] : []),
      h('h3', { textContent: 'LOCATION' }), where,
      ...(drive ? [h('h3', { textContent: 'TRAVERSE' }), drive] : []),
      ...(s.feeds?.length ? [h('h3', { textContent: 'LIVE FEEDS' }), h('div', { className: 'body-list' }, s.feeds.map((f) => pill(`${f.label} ▸`, () => viewFeed(f, s.name.toUpperCase()))))] : []),
      ...photos(s),
      s.url ? h('p', { className: 'note credit' }, 'SOURCE · ', h('a', { href: s.url, target: '_blank', rel: 'noopener', textContent: `${s.source} ↗` })) : h('p', { className: 'note credit', textContent: `SOURCE · ${s.source}` }),
      renderLegend(),
    );
  }

  /** PHOTOS: NASA Image and Video Library results for the mission (backend-cached), click to enlarge. */
  function photos(s) {
    if (!s.mission || ['feature', 'observatory', 'launch', 'planned'].includes(s.kind)) return [];
    const term = s.mission.split(/[(/]/)[0].trim();
    if (term.length < 3) return [];
    const grid = h('div', { className: 'obs-grid' }), big = h('div', { className: 'obs-big' });
    const note = h('p', { className: 'note', textContent: 'Searching the NASA Image and Video Library…' });
    const search = (q) => fetch(`/api/nasa-images?${new URLSearchParams({ q, must: term.toLowerCase() })}`).then((r) => (r.ok ? r.json() : null));
    const where = s.body === 'moon' ? 'lunar surface' : `${s.body} surface`;
    // surface pictures first (a bare mission name finds anniversary events and launch-pad shots), then anything
    search(`${term} ${where}`).then((a) => ((a?.items?.length ?? 0) >= 4 ? a : search(term))).then((res) => {
      const items = (res?.items ?? []).slice(0, 12);
      if (!items.length) { note.textContent = 'No photos found in the NASA library for this mission.'; return; }
      note.textContent = 'From the NASA Image and Video Library, as captioned by NASA (some are artwork or diagrams: read the caption).';
      grid.replaceChildren(...items.map((it) => {
        const b = h('button', { className: 'obs-thumb', title: it.title }, h('img', { src: `/api/nasa-image/${encodeURIComponent(it.nasaId)}/thumb`, alt: it.title, loading: 'lazy' }), h('span', { textContent: it.title }));
        b.addEventListener('click', () => big.replaceChildren(h('img', { src: `/api/nasa-image/${encodeURIComponent(it.nasaId)}/medium`, className: 'fv-img', alt: it.title }),
          h('div', { className: 'obs-meta', textContent: `${it.title}${it.date ? ` · ${it.date}` : ''}${it.center ? ` · ${it.center}` : ''}`.toUpperCase() }),
          it.description ? h('p', { className: 'note', textContent: it.description }) : null));
        return b;
      }));
    }).catch(() => { note.textContent = 'Photos need the local backend.'; });
    return [h('h3', {}, 'PHOTOS ', badge('reported', 'Published by NASA with its caption; not checked image by image.')), note, grid, big];
  }

  return { section, show };
}
