// Surface sites of note (#37): the SITES section of a body's panel (filters + list) and the card
// for one site: mission, date, what happened, coordinates with their source, "stand here", and any
// live feed (rover raw images, observatory webcams and streams).

import { sitesFor, SITE_KINDS } from '../data/sites.js';

const fmtLat = (x) => `${Math.abs(x).toFixed(4)}° ${x >= 0 ? 'N' : 'S'}`;
const fmtLon = (x) => `${Math.abs(x).toFixed(4)}° ${x >= 0 ? 'E' : 'W'}`;

export function createSitesPanel({ h, pill, row, badge, settings, panel, resetLive, renderLegend, viewFeed, stand, back }) {
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
    row(facts, 'WHAT', k.label, s.tier === 'planned' ? 'planned' : 'measured', k.hint);
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
      row(drive, s.traverseVerb ?? 'DRIVEN', `${t.distanceKm.toLocaleString()} KM`, 'measured', `${t.credit}. Summed along the published path.`);
      if (t.sol != null) row(drive, 'PATH UP TO', `SOL ${t.sol}`, 'measured');
      row(drive, 'NOW AT', `${fmtLat(t.last[1])} · ${fmtLon(t.last[0])}`, 'measured', 'End of the published traverse (the white dot).');
    }
    panel.replaceChildren(
      h('h2', { textContent: s.name.toUpperCase() }),
      h('div', { className: 'kind', textContent: `${body.name.toUpperCase()} · SITE OF NOTE · ${k.label}` }),
      h('div', { className: 'body-list' },
        pill('◀ BACK', () => back(body)),
        pill('STAND HERE ▸', () => stand(body, s))),
      s.note ? h('p', { className: 'note explain', textContent: s.note }) : null,
      ...(s.identity ? [h('h3', { textContent: 'WHOSE ROCKET?' }), h('dl', {}, h('dt', { textContent: 'IDENTITY' }), h('dd', { textContent: s.identity }), badge('modelled', 'Orbit reconstruction; disputed and unconfirmed.'))] : []),
      h('h3', { textContent: 'MISSION' }), facts,
      h('h3', { textContent: 'LOCATION' }), where,
      ...(drive ? [h('h3', { textContent: 'TRAVERSE' }), drive] : []),
      ...(s.feeds?.length ? [h('h3', { textContent: 'LIVE FEEDS' }), h('div', { className: 'body-list' }, s.feeds.map((f) => pill(`${f.label} ▸`, () => viewFeed(f, s.name.toUpperCase()))))] : []),
      s.url ? h('p', { className: 'note credit' }, 'SOURCE · ', h('a', { href: s.url, target: '_blank', rel: 'noopener', textContent: `${s.source} ↗` })) : h('p', { className: 'note credit', textContent: `SOURCE · ${s.source}` }),
      renderLegend(),
    );
  }

  return { section, show };
}
