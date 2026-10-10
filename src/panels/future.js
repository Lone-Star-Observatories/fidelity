// FUTURE MISSIONS (#44): cards for confirmed, planned and proposed missions (and those in flight or
// ended), an UPCOMING list in each target's panel, and the path in the System View: the published
// JPL Horizons reference trajectory where there is one, otherwise a direct transfer in the launch
// window computed by the #45 solver. Future paths are ghosts labelled PLANNED and badged MODELLED,
// never shown as real positions.

import { FUTURE_MISSIONS, MISSION_TIERS, CHECKED, pathTier, factTier, looseJd } from '../data/future-missions.js';
import { launchWindows } from '../astro/transfer.js';
import { targetFor } from './transfer.js';
import { trajectory } from '../data/spacecraft-ephem.js';
import { eventsFeed } from '../data/events.js';

const TIER_ORDER = ['in-flight', 'confirmed', 'planned', 'proposed', 'ended'];
const iso = (jd) => new Date((jd - 2440587.5) * 86400000).toISOString().slice(0, 10);
/** Missions bound for `id` itself, or (for a planet) for its moons. */
export const missionsFor = (id, bodies = []) => FUTURE_MISSIONS.filter((m) => m.target === id || bodies.some((b) => b.parent === id && b.id === m.target));
/** The live launch date from the events feed (#32) when it lists the mission. */
function liveLaunch(m) {
  if (!m.ll2) return null;
  const re = new RegExp(m.ll2, 'i');
  return eventsFeed()?.events.find((e) => e.category === 'launch' && re.test(e.title)) ?? null;
}

export function createFuturePanel({ h, pill, row, badge, system, clock, toast, go, $ }) {
  const tierBadge = (t) => { const el = h('span', { className: `mtier mtier-${t}`, textContent: MISSION_TIERS[t].label, title: MISSION_TIERS[t].hint }); return el; };

  /** Draw a mission's path: the Horizons reference where published, else a modelled window transfer. */
  function showPath(m, model) {
    const label = `${m.name.toUpperCase()} · ${m.tier === 'in-flight' ? 'IN FLIGHT' : 'PLANNED'}`;
    if (m.horizons) {
      const now = Date.now() / 86400000 + 2440587.5;
      const start = m.tier === 'in-flight' ? iso(now - 30) : m.launch && /^\d{4}-\d{2}-\d{2}/.test(m.launch) ? m.launch.slice(0, 10) : iso(looseJd(m.launch) ?? now);
      const end = iso(Math.max(looseJd(m.arrival) ?? 0, looseJd(start) + 400) + 30);
      let tries = 0;
      const poll = () => {
        const pts = trajectory(String(m.horizons), start, end);
        if (!pts && tries++ < 40) return setTimeout(poll, 500);
        if (!pts?.length) return toast('REFERENCE TRAJECTORY UNAVAILABLE (NEEDS THE LOCAL BACKEND)');
        system.setTransfer({ track: pts, label, tier: pathTier(m, 'horizons'), ghost: m.tier !== 'in-flight' });
        clock.set(pts[0][0] - 69.184 / 86400); // the start of the track: launch, or today for craft in flight
        system.overview(3.5, 'sun');
        toast(`${m.name.toUpperCase()}: JPL HORIZONS ${m.tier === 'in-flight' ? 'TRAJECTORY' : 'REFERENCE (PLANNING) TRAJECTORY'}`);
      };
      return poll();
    }
    const target = model && m.target ? model.bodies.find((b) => b.id === m.target) : null;
    const t = target && targetFor(target, model.bodies);
    const from = looseJd(m.launch);
    if (!t || !from) return toast('NO HELIOCENTRIC PATH TO DRAW FOR THIS MISSION');
    const [w] = launchWindows(t, from - 120, { aAu: t.aAu, years: 2.2, stepDays: t.aAu > 3 ? 8 : 4, count: 1, minGapDays: 200 });
    if (!w) return toast('NO DIRECT WINDOW NEAR THE PLANNED LAUNCH');
    system.setTransfer({ x: w.best, label: `${label} · MODELLED`, tier: 'modelled', ghost: true });
    clock.set(w.best.depJd);
    system.overview(Math.max(2.4, t.aAu * 2.6), 'sun');
    toast(`MODELLED: A DIRECT TRANSFER IN THE ${iso(w.best.depJd).slice(0, 7)} WINDOW · THE REAL MISSION MAY USE GRAVITY ASSISTS`);
  }

  /** The mission card, in the feed viewer. */
  function openCard(m, model) {
    const v = $('feed-viewer'), ft = factTier(m), dl = h('dl');
    row(dl, 'STATUS', MISSION_TIERS[m.tier].label, ft, m.status ?? '');
    row(dl, 'AGENCY', `${m.agency}${m.partners ? ` · ${[].concat(m.partners).join(', ')}` : ''}`.toUpperCase(), ft, 'As announced.');
    row(dl, 'TARGET', (m.targetName ?? '—').toUpperCase(), ft, 'Destination as announced.');
    row(dl, 'LAUNCH', m.launch ?? '—', ft, m.tier === 'proposed' ? 'A concept date, not a schedule.' : 'Announced date or window; launch dates slip.');
    row(dl, 'ARRIVAL', m.arrival ?? '—', ft, 'Announced arrival at the target.');
    const ll = liveLaunch(m);
    if (ll) row(dl, 'NEXT LAUNCH', `${ll.time.slice(0, 16).replace('T', ' ')} UTC · ${ll.status?.toUpperCase() ?? ''}`, 'reported', 'Live from the weekly events feed (Launch Library 2).');
    row(dl, 'PATH', m.horizons ? `JPL HORIZONS ${m.horizons}` : m.target ? 'DIRECT TRANSFER (MODELLED)' : 'NONE DRAWN', m.horizons ? pathTier(m, 'horizons') : 'modelled',
      m.horizonsNote ?? 'No published trajectory: a direct transfer in the launch window from the #45 solver stands in; the real mission may use gravity assists.');
    row(dl, 'CHECKED', CHECKED, 'reported', 'The date this entry was last checked against its sources. Statuses change.');
    v.hidden = false;
    v.replaceChildren(
      h('div', { className: 'fv-head' }, h('span', { className: 'fv-title', textContent: m.name.toUpperCase() }), tierBadge(m.tier),
        m.notSelected ? h('span', { className: 'mtier mtier-ended', textContent: 'NOT SELECTED' }) : null, pill('✕', () => { v.hidden = true; v.replaceChildren(); }, 'square')),
      h('div', { className: 'fv-body fv-card' },
        m.goal ? h('p', { className: 'note', textContent: m.goal }) : null,
        dl,
        m.status ? h('p', { className: 'note', textContent: m.status }) : null,
        m.unverified ? h('p', { className: 'warn', textContent: `Unverified (weaker sources): ${[].concat(m.unverified).join(' · ')}` }) : null,
        h('div', { className: 'body-list' },
          (m.horizons || m.target) && m.tier !== 'ended' ? pill('SHOW PATH ▸', () => showPath(m, model)) : null,
          m.craft ? pill('GO TO CRAFT ▸', () => go({ level: 'system', system: 'sol', body: m.craft })) : null,
          m.target && model?.bodies.some((b) => b.id === m.target) ? pill('GO TO TARGET ▸', () => go({ level: 'system', system: 'sol', body: m.target })) : null),
        h('div', { className: 'host-list' }, (m.sources ?? []).map((u) => h('a', { className: 'host-row', href: u.url ?? u, target: '_blank', rel: 'noopener' }, h('span', { textContent: (u.title ?? (u.url ?? u).replace(/^https?:\/\/(www\.)?/, '').split('/')[0]).toUpperCase() }), h('span', { className: 'mono', textContent: 'SOURCE ↗' }))))),
      h('div', { className: 'fv-credit', textContent: `Curated list, last checked ${CHECKED}. Future paths are drawn as ghosts labelled PLANNED: never real positions.` }));
  }

  const missionRow = (m, model) => h('button', { className: 'host-row event-row', onclick: () => openCard(m, model) },
    h('span', {}, `${m.name.toUpperCase()} `, tierBadge(m.tier), m.notSelected ? ' NOT SELECTED' : ''),
    h('span', { className: 'mono', textContent: [m.agency, m.target && m.targetName ? `→ ${m.targetName}` : null, m.launch ? `LAUNCH ${m.launch}` : null, m.arrival ? `ARRIVES ${m.arrival}` : null].filter(Boolean).join(' · ').toUpperCase() }));

  /** UPCOMING section for a body's panel ([] when none). */
  function section(b, model) {
    const list = missionsFor(b.id, model.bodies).filter((m) => m.tier !== 'ended' && !(m.tier === 'in-flight' && (looseJd(m.arrival) ?? Infinity) < clock.jd));
    if (!list.length) return [];
    const first = list.filter((m) => m.arrival).sort((p, q) => (looseJd(p.arrival) ?? 0) - (looseJd(q.arrival) ?? 0))[0];
    return [h('h3', { textContent: `UPCOMING · ${first ? `${first.name.toUpperCase()} ARRIVES ${first.arrival}` : `${list.length} MISSION${list.length > 1 ? 'S' : ''}`}` }),
      h('div', { className: 'host-list' }, list.map((m) => missionRow(m, model)))];
  }

  /** FUTURE MISSIONS for the Sol system panel, grouped by tier. */
  function systemSection(model) {
    return [h('h3', { textContent: `FUTURE MISSIONS · ${FUTURE_MISSIONS.filter((m) => m.tier !== 'ended' && m.tier !== 'in-flight').length}` }),
      ...TIER_ORDER.flatMap((t) => {
        const ms = FUTURE_MISSIONS.filter((m) => m.tier === t);
        return ms.length ? [h('div', { className: 'kind', textContent: `${MISSION_TIERS[t].label} · ${ms.length}` }), h('div', { className: 'host-list' }, ms.map((m) => missionRow(m, model)))] : [];
      }),
      h('p', { className: 'note', textContent: `Curated from agency pages and reputable reporting, last checked ${CHECKED}. Each card shows its sources. Future craft appear only as ghosts labelled PLANNED on modelled paths.` })];
  }

  return { section, systemSection, openCard };
}
