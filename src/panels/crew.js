// Crew cards (#46): who is in space right now, per craft, with flag and portrait thumbnails; click
// for a full card with role, agency, nationality, birth year, time in space (earlier flights plus this
// mission, counting live) and a one-line summary. Facts are MEASURED (sourced and dated: the crew
// feed and Wikidata); portraits and flags appear only where their Commons licence allows, otherwise
// initials and the country name stand in.

import snapshot from '#snapshot';
import { aboard, missionDays, totalDays, initials } from '../data/crew.js';

const DAY_MS = 86400000;
let data = null, loading = null;
/** The crew list: /api/crew, or the standalone snapshot's copy. */
export function loadCrew() {
  loading ??= (snapshot ? Promise.resolve(snapshot.crew ?? null) : fetch('/api/crew').then((r) => (r.ok ? r.json() : null)).catch(() => null))
    .then((d) => { data = d; if (!d) loading = null; return d; });
  return loading;
}
export function createCrewView({ h, pill, row, badge, $ }) {
  let timer = null;
  const face = (p, size) => (p.portrait?.url
    ? h('img', { className: `crew-face s${size}`, src: p.portrait.url, alt: p.name, title: `${p.name} · ${p.portrait.licence}${p.portrait.artist ? ` · ${p.portrait.artist}` : ''}` })
    : h('span', { className: `crew-face s${size} initials`, textContent: initials(p.name), title: p.portrait?.file ? `Portrait licence (${p.portrait.licence ?? 'unknown'}) does not allow showing it here` : 'No portrait' }));
  const flag = (p) => (p.flag?.url ? h('img', { className: 'crew-flag', src: p.flag.url, alt: p.country, title: `${p.country} · flag: ${p.flag.licence}` }) : h('span', { className: 'crew-flag text', textContent: (p.flagCode ?? '').toUpperCase(), title: p.country }));
  const days = (d) => (d == null ? '—' : d >= 365 ? `${(d / 365.25).toFixed(2)} YR (${Math.floor(d)} D)` : `${d.toFixed(1)} D`);

  function frame(title, sub, body, credit) {
    clearInterval(timer);
    const v = $('feed-viewer');
    v.hidden = false;
    v.replaceChildren(
      h('div', { className: 'fv-head' }, h('span', { className: 'fv-title', textContent: title }), h('span', { className: 'fv-sub', textContent: sub }), badge('measured', credit),
        pill('✕', () => { clearInterval(timer); v.hidden = true; v.replaceChildren(); }, 'square')),
      h('div', { className: 'fv-body fv-card' }, body),
      h('div', { className: 'fv-credit', textContent: credit }));
  }

  /** The crew list for a craft (or everyone), in the feed viewer. */
  async function open(craft = null, label = 'PEOPLE IN SPACE') {
    frame(label, 'LOADING…', h('p', { className: 'note', textContent: 'Checking who is aboard…' }), '');
    const d = await loadCrew();
    if (!d) return frame(label, 'UNAVAILABLE', h('p', { className: 'warn', textContent: 'Crew data needs the local backend (npm start).' }), '');
    const list = aboard(d.people, craft);
    const crafts = Object.entries(d.byCraft ?? {}).map(([c, n]) => `${c.toUpperCase()} ${n}`).join(' · ');
    const rows = list.map((p) => {
      const live = h('span', { className: 'mono' });
      const b = h('button', { className: 'host-row crew-row', onclick: () => card(p, d) }, face(p, 36), flag(p),
        h('span', { className: 'crew-name' }, h('b', { textContent: p.name.toUpperCase() }), h('span', { textContent: [p.position, p.agency, p.spacecraft].filter(Boolean).join(' · ').toUpperCase() })), live);
      b.live = live; b.person = p;
      return b;
    });
    const tick = () => { for (const r of rows) r.live.textContent = `DAY ${Math.floor(missionDays(r.person) ?? 0) + 1}`; };
    frame(label, `${list.length} ABOARD · ${d.number} IN SPACE NOW${d.expedition ? ` · ISS EXPEDITION ${d.expedition}` : ''}`,
      h('div', {}, h('p', { className: 'note', textContent: `PEOPLE IN SPACE RIGHT NOW: ${d.number} · ${crafts}` }), h('div', { className: 'host-list' }, rows),
        h('p', { className: 'note', textContent: 'Click anyone for their card. Faces and flags appear where the Commons licence allows; otherwise initials.' })),
      `${d.credit} Updated ${d.time.slice(0, 16).replace('T', ' ')} UTC.`);
    tick(); timer = setInterval(tick, 60000);
  }

  /** One person's full card. */
  function card(p, d) {
    const dl = h('dl'), wd = p.wikidata, now = Date.now();
    const src = (what) => `${what} · source: ${what === 'crew feed' ? 'corquaid people-in-space (MIT)' : 'Wikidata (CC0)'}, as of ${d.time.slice(0, 10)}`;
    row(dl, 'ROLE', (p.position ?? '—').toUpperCase(), 'measured', src('crew feed'));
    row(dl, 'AGENCY', (p.agency ?? '—').toUpperCase(), 'measured', src('crew feed'));
    row(dl, 'NATIONALITY', (wd?.citizenships?.map((c) => c.name).filter(Boolean).join(' · ') || p.country || '—').toUpperCase(), 'measured', wd ? src('Wikidata') : src('crew feed'));
    if (wd?.birth) { // Wikidata dates of year or month precision come as YYYY-00-00 / YYYY-MM-00
      const born = Date.parse(wd.birth.replace(/-00/g, '-01')), exact = !/-00/.test(wd.birth);
      row(dl, 'BORN', `${exact ? wd.birth : wd.birth.slice(0, 4)} · AGE ${exact ? '' : '~'}${Math.floor((now - born) / (365.2425 * DAY_MS))}`, 'measured', src('Wikidata'));
    }
    if (wd?.employers?.length) row(dl, 'EMPLOYER', wd.employers.join(' · ').toUpperCase(), 'measured', src('Wikidata'));
    row(dl, 'MISSION', `${p.spacecraft.toUpperCase()}${p.launched ? ` · LAUNCHED ${p.launched.slice(0, 10)}` : ''}`, 'measured', src('crew feed'));
    const onMission = row(dl, 'THIS MISSION', '—', 'computed', 'Time since launch on this mission, counting live.');
    row(dl, 'EARLIER FLIGHTS', days(p.priorDaysInSpace), 'measured', `${src('crew feed')}: days in space before this mission.`);
    const total = row(dl, 'TOTAL IN SPACE', '—', 'computed', 'Earlier flights plus this mission, counting live.');
    if (wd?.timeInSpaceDays != null) row(dl, 'WIKIDATA TIME', days(wd.timeInSpaceDays), 'measured', `${src('Wikidata')} (property P2873; may not include the current mission).`);
    row(dl, 'SPACEWALKS', 'NOT IN OPEN DATA', 'measured', 'No open, structured source lists spacewalk counts or hours per astronaut (Wikidata has no such property); see the agency biography.');
    const tick = () => {
      const md = missionDays(p);
      onMission.textContent = md == null ? '—' : `${Math.floor(md)} D ${Math.floor((md % 1) * 24)} H ${Math.floor(((md * 24) % 1) * 60)} M`;
      total.textContent = days(totalDays(p));
    };
    const credit = [p.portrait?.url ? `Portrait: ${p.portrait.artist || 'Wikimedia Commons'} · ${p.portrait.licence}` : null, p.flag?.url ? `Flag: Wikimedia Commons · ${p.flag.licence}` : null, 'Facts: crew feed (MIT) and Wikidata (CC0).'].filter(Boolean).join(' · ');
    frame(p.name.toUpperCase(), [p.position, p.spacecraft].filter(Boolean).join(' · ').toUpperCase(),
      h('div', {},
        h('div', { className: 'crew-head' }, face(p, 96), h('div', {}, flag(p), h('p', { className: 'note', textContent: wd?.description ? wd.description.replace(/^./, (c) => c.toUpperCase()) + '.' : '' }))),
        dl,
        h('div', { className: 'body-list' },
          p.wikipedia ? pill('BIOGRAPHY ↗', () => window.open(p.wikipedia, '_blank', 'noopener')) : null,
          wd?.url ? pill('WIKIDATA ↗', () => window.open(wd.url, '_blank', 'noopener')) : null,
          p.portrait?.page ? pill('PORTRAIT SOURCE ↗', () => window.open(p.portrait.page, '_blank', 'noopener')) : null,
          pill('◀ CREW', () => open(null))),
        p.portrait && !p.portrait.url ? h('p', { className: 'note', textContent: `The portrait's licence (${p.portrait.licence ?? 'unknown'}) does not let it be shown here, so initials stand in.` }) : null),
      credit);
    tick(); timer = setInterval(tick, 30000);
  }

  return { open, card };
}
