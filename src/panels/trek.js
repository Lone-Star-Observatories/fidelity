// The Star Trek layer's side-panel parts (#25, #41): the STAR TREK section of each view's panel (the one
// shared toggle and a list of what the view draws) and the card for one fictional place: first appearance,
// our own summary, where it is placed and on whose authority, how sure that is, conflicting placements, a
// Memory Alpha link, and WARP TO the real star where there is one. Everything is badged IMAGINED; the only
// MEASURED value on a card is the real star's own distance, labelled as the star's.

import { TREK, TREK_BY_ID, TREK_KINDS, TREK_CONFIDENCE, TREK_SERIES, TREK_LICENCE, trekFor, trekAtStar, trekWhere, trekApprox } from '../data/trek.js';

const appearance = (f) => [f.series === 'FILM' ? null : TREK_SERIES[f.series], f.episode ? `"${f.episode.toUpperCase()}"` : null, f.year].filter(Boolean).join(' · ');

export function createTrekPanel({ h, pill, row, badge, settings, panel, resetLive, renderLegend, go, warp, back, warpTo = null }) {
  /** The one switch for the whole layer, in every view. */
  const toggle = (after) => pill(settings.get('starfleet') ? 'STAR TREK LAYER: ON' : 'STAR TREK LAYER: OFF', () => {
    settings.set('starfleet', !settings.get('starfleet'));
    after?.();
  }, settings.get('starfleet') ? 'on' : '');

  function list(entries) {
    return h('div', { className: 'host-list' }, entries.map((t) => {
      const b = h('button', { className: 'host-row trek-row' },
        h('span', { textContent: t.name.toUpperCase() }),
        h('span', { className: 'mono', textContent: `${TREK_KINDS[t.kind]} · ${TREK_CONFIDENCE[t.confidence].label}${trekApprox(t) ? ' · ≈' : ''}` }));
      b.addEventListener('click', () => show(t.id));
      return b;
    }));
  }

  /**
   * The STAR TREK section for a view: 'navigation' | 'quadrant' | 'galaxy', or 'system' with the model
   * (Sol: its stations and sites; another system: the worlds Star Trek puts at its stars).
   */
  function section(view, { model = null, after = null, starIds = null } = {}) {
    let entries = view === 'system'
      ? (model?.isSol ? TREK.filter((t) => ['orbit', 'surface'].includes(t.placement.type)) : (model?.bodies ?? []).flatMap((b) => trekAtStar(b.id)))
      : trekFor(view);
    if (view === 'navigation' && starIds) entries = entries.filter((t) => t.placement.type !== 'star' || t.placement.hyg === 'sol' || starIds.has(t.placement.hyg));
    if (view === 'system' && !entries.length) return [];
    const on = !!settings.get('starfleet');
    const note = {
      navigation: 'Pink: Star Trek\'s Alpha/Beta border (from the galactic core through Sol) and the worlds the franchise or its licensed Star Charts puts at real stars, ringed and labelled to the left of the real star. The stars themselves are untouched.',
      quadrant: 'Pink: Star Trek\'s quadrant borders, the powers\' territories as soft discs, and homeworlds and features (zoom in). ≈ marks an approximate position.',
      galaxy: 'Pink: Star Trek\'s four quadrants, the Dominion and Borg space, the barriers, the Bajoran wormhole and Voyager\'s route home. ≈ marks an approximate position.',
      system: model?.isSol ? 'Pink: Star Trek\'s stations, drawn on plausible orbits around the focused body, and its sites on the globes (the SITES layer).' : 'A pink dashed ring marks where the imagined planet would orbit: at the distance where it would get Earth\'s sunlight (an assumption). The real system is unchanged.',
    }[view];
    return [
      h('h3', {}, 'STAR TREK ', badge('imagined', 'Fiction: Star Trek\'s places, drawn over the real data and never mixed into it.')),
      h('div', { className: 'body-list' }, toggle(after)),
      on ? h('p', { className: 'note', textContent: note }) : h('p', { className: 'note', textContent: 'The Star Trek layer is off.' }),
      on ? list(entries) : null,
    ];
  }

  /** Stations and sites of one Sol body, for its panel. */
  function bodySection(body, after) {
    const entries = TREK.filter((t) => t.placement.body === body.id);
    if (!entries.length) return [];
    return [h('h3', {}, 'STAR TREK ', badge('imagined', 'Fiction: Star Trek\'s places at this body.')), h('div', { className: 'body-list' }, toggle(after)),
      settings.get('starfleet') ? list(entries) : h('p', { className: 'note', textContent: 'The Star Trek layer is off.' })];
  }

  /** The card for one fictional place. */
  function show(id) {
    const t = TREK_BY_ID.get(id);
    if (!t) return;
    resetLive();
    const p = t.placement, conf = TREK_CONFIDENCE[t.confidence];
    const facts = h('dl');
    row(facts, 'WHAT', `${TREK_KINDS[t.kind]} · FICTION`, 'imagined', 'From Star Trek. Not a real place.');
    if (t.firstAppearance) {
      const f = t.firstAppearance;
      row(facts, f.featured ? 'SEEN IN' : 'FIRST APPEARANCE', appearance(f), 'imagined', `${f.series === 'FILM' ? 'Feature film' : `Star Trek: ${TREK_SERIES[f.series].toLowerCase()}`}${f.what ? ` (${f.what})` : ''}.${f.featured ? ' A defining appearance; not necessarily the first mention.' : ''}`);
    } else row(facts, 'FIRST APPEARANCE', 'NOT CHECKED', 'imagined', t.appearanceNote ?? '');
    const where = h('dl');
    row(where, 'PLACED AT', trekWhere(t), 'imagined', t.source);
    row(where, 'CONFIDENCE', conf.label, 'imagined', conf.hint);
    row(where, 'POSITION', trekApprox(t) ? 'APPROXIMATE' : 'AT THE REAL STAR', 'imagined', trekApprox(t) ? 'The drawn spot is approximate: see the source.' : 'The label rides on the real catalogue star; the star itself is not altered.');
    if (p.type === 'star' && p.hyg !== 'sol') row(where, 'THE REAL STAR', `${p.star.toUpperCase()} · ${p.distLy.toLocaleString('en-US')} LY`, 'measured', 'HYG v4.4 parallax distance. The star is real; the Star Trek world is not.');
    const canWarp = p.type === 'star' && p.hyg !== 'sol';
    const solBody = p.type === 'orbit' || p.type === 'surface' ? p.body : null;
    panel.replaceChildren(
      h('h2', { textContent: t.name.toUpperCase() }),
      h('div', { className: 'kind' }, `STAR TREK · ${TREK_KINDS[t.kind]} `, badge('imagined', 'Fiction: a Star Trek place drawn as an overlay.')),
      h('div', { className: 'body-list' },
        pill('◀ BACK', () => back()),
        canWarp ? pill(`WARP TO ${p.star.replace(/ \(.*\)/, '').toUpperCase()} ▸`, () => { warp(); if (warpTo) warpTo(p.hyg); else go({ level: 'system', system: p.hyg }); }) : null,
        solBody ? pill(`${solBody.toUpperCase()} ▸`, () => go({ level: 'system', system: 'sol', body: solBody })) : null),
      canWarp ? h('p', { className: 'note', textContent: 'WARP TO opens the real star system as measured; a pink dashed ring marks where the imagined world would orbit.' }) : null,
      h('p', { className: 'note explain', textContent: t.summary }),
      h('h3', { textContent: 'IN STAR TREK' }), facts,
      h('h3', { textContent: 'PLACEMENT' }), where,
      h('p', { className: 'note', textContent: `SOURCE · ${t.source}` }),
      t.alternatives ? h('h3', { textContent: 'CONFLICTS & ALTERNATIVES' }) : null,
      t.alternatives ? h('p', { className: 'note', textContent: t.alternatives }) : null,
      h('p', { className: 'note credit' }, 'MORE · ', h('a', { href: t.memoryAlpha, target: '_blank', rel: 'noopener noreferrer', textContent: 'Memory Alpha ↗' }),
        ' (the Star Trek fan wiki, CC BY-NC; summarised here in our own words, not copied).'),
      h('p', { className: 'note credit', textContent: TREK_LICENCE }),
      renderLegend(),
    );
  }

  return { section, bodySection, show, toggle };
}
