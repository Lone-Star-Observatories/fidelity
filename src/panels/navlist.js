// Navigation lists (#15): nearest systems, stars, planets and deep-sky objects, with filters
// and drill-down (a system opens to its stars and planets). Distances are from the current star.

import { eqToGal, LY_PER_PC } from '../astro/frames.js';
import { NEBULAE, NEBULA_KIND } from '../data/deepsky.js';

const DEG = Math.PI / 180;
const CLASSES = ['O', 'B', 'A', 'F', 'G', 'K', 'M', 'WD', 'BD'];
/** Broad class of a star: O–M from the spectral type, WD for white dwarfs, BD for brown dwarfs. */
export function starClass(s) {
  if (s.archiveOnly === 2) return 'BD';
  const t = (s.spect || '').replace(/^(sd|esd|d|g|c)(?=[OBAFGKM])/, '').trim();
  if (/^D[ABOQZCX]?/.test(t)) return 'WD';
  if (/^[LTY]/.test(t)) return 'BD';
  const m = t.match(/^[OBAFGKM]/);
  return m ? m[0] : null;
}
/**
 * A system's name from its stars: "Luhman 16A" + "Luhman 16B" → "Luhman 16 AB"; a primary with a
 * differently named companion ("Sirius" + "Sirius B") → "Sirius AB"; a single star keeps its name.
 */
export function systemName(members) {
  if (members.length < 2) return members[0]?.name ?? '';
  const comp = /^(.*?)\s?([A-D][a-z]?)$/;
  const bases = members.map((m) => { const x = m.name.match(comp); return x ? [x[1], x[2]] : [m.name, 'A']; });
  const base = bases[0][0];
  if (!bases.every(([b]) => b === base)) return `${members[0].name} system`;
  return `${base} ${bases.map(([, l]) => l).sort().join('')}`;
}
const PLANET_KINDS = {
  all: ['ALL', () => true],
  rocky: ['ROCKY', (p) => (p.radiusEarth != null ? p.radiusEarth < 1.6 : p.massEarth != null && p.massEarth < 5)],
  mid: ['SUPER-EARTH / SUB-NEPTUNE', (p) => (p.radiusEarth != null ? p.radiusEarth >= 1.6 && p.radiusEarth < 4 : p.massEarth >= 5 && p.massEarth < 30)],
  giant: ['GIANTS', (p) => (p.radiusEarth != null ? p.radiusEarth >= 4 : p.massEarth >= 30)],
  temperate: ['TEMPERATE', (p) => (p.insol != null ? p.insol > 0.25 && p.insol < 1.8 : p.teqK != null && p.teqK > 180 && p.teqK < 320)],
  transiting: ['TRANSITING', (p) => p.transits],
};

export function createNavList({ h, pill, fmt, go, fetchPlanets, fetchClusters, onSelectStar, onRerender }) {
  const state = { tab: 'systems', sys: 'all', classes: new Set(), withPlanets: false, planetKind: 'all', open: null };
  const planetsCache = new Map(); // `${center}|${radius}` → rows | 'loading'
  let clusters = null, clustersLoading = false;

  function planetsFor(d) {
    const key = `${d.center.id}|${d.radiusLy}`;
    const c = planetsCache.get(key);
    if (c && c !== 'loading') return c;
    if (!c) {
      planetsCache.set(key, 'loading');
      fetchPlanets(d.center.id, d.radiusLy).then((r) => { planetsCache.set(key, r?.planets ? r.planets.map((x) => Object.fromEntries(r.fields.map((f, i) => [f, x[i]]))) : []); onRerender(); })
        .catch(() => { planetsCache.set(key, []); onRerender(); });
    }
    return null;
  }

  const tabs = (d) => h('div', { className: 'body-list nav-tabs' }, [['systems', 'SYSTEMS'], ['stars', 'STARS'], ['planets', 'PLANETS'], ['deep', 'DEEP SKY']].map(([k, label]) =>
    pill(label, () => { state.tab = k; onRerender(); }, state.tab === k ? 'on' : '')));
  const chip = (label, on, fn) => pill(label, fn, `chip${on ? ' on' : ''}`);
  const rowBtn = (left, right, on, fn, cls = '') => {
    const b = h('button', { className: `host-row${on ? ' on' : ''} ${cls}` }, h('span', { textContent: left }), h('span', { className: 'mono', textContent: right }));
    b.addEventListener('click', fn);
    return b;
  };

  /** Systems: stars grouped by their system id; each row opens to show its stars and planets. */
  function systemsList(d, inRange, dist, selected) {
    const groups = new Map();
    for (const s of inRange) {
      const k = s.system ?? s.id;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(s);
    }
    let systems = [...groups.entries()].map(([k, members]) => {
      members.sort((a, b) => (a.absmag ?? 99) - (b.absmag ?? 99));
      return { key: k, members, primary: members[0], dist: Math.min(...members.map(dist)), planets: members.reduce((n, s) => n + (s.planets || 0), 0) };
    }).sort((a, b) => a.dist - b.dist);
    if (state.sys === 'multiple') systems = systems.filter((s) => s.members.length > 1);
    if (state.sys === 'planets') systems = systems.filter((s) => s.planets);
    const planets = planetsFor(d);
    const out = [h('div', { className: 'body-list' },
      chip('ALL', state.sys === 'all', () => { state.sys = 'all'; onRerender(); }),
      chip('MULTIPLE STARS', state.sys === 'multiple', () => { state.sys = 'multiple'; onRerender(); }),
      chip('WITH PLANETS', state.sys === 'planets', () => { state.sys = 'planets'; onRerender(); })),
    h('p', { className: 'note', textContent: `${systems.length} SYSTEMS` })];
    const list = h('div', { className: 'host-list' });
    for (const s of systems.slice(0, 80)) {
      const name = systemName(s.members).toUpperCase();
      const tagTxt = [s.members.length > 1 ? `${s.members.length}★` : null, s.planets ? `${s.planets} PL` : null].filter(Boolean).join(' · ');
      list.append(rowBtn(name, `${fmt(s.dist, 1)} LY${tagTxt ? ` · ${tagTxt}` : ''}`, state.open === s.key || s.members.some((m) => m.id === selected), () => {
        state.open = state.open === s.key ? null : s.key; onSelectStar(s.primary.id);
      }));
      if (state.open === s.key) {
        for (const m of s.members) list.append(rowBtn(`  ★ ${m.name.toUpperCase()}`, `${m.spect ?? '—'} · ${fmt(dist(m), 2)} LY`, m.id === selected, () => onSelectStar(m.id), 'sub'));
        const ids = new Set(s.members.map((m) => m.id));
        for (const p of (planets ?? []).filter((p) => ids.has(p.hostId))) {
          list.append(rowBtn(`  ◦ ${p.name.toUpperCase()}`, planetSummary(p), false, () => go({ level: 'planet', system: p.hostId, body: (p.letter ?? p.name).toLowerCase().replace(/[^a-z0-9]+/g, '-') }), 'sub'));
        }
        if (s.planets && !planets) list.append(h('p', { className: 'note', textContent: 'LOADING PLANETS…' }));
        list.append(h('div', { className: 'body-list' }, pill('WARP TO SYSTEM ▸', () => go({ level: 'system', system: s.primary.id }))));
      }
    }
    out.push(list);
    return out;
  }

  function planetSummary(p) {
    const size = p.radiusEarth != null ? `${fmt(p.radiusEarth, 1)} R⊕` : p.massEarth != null ? `${p.massIsMin ? '≥' : ''}${fmt(p.massEarth, 1)} M⊕` : '';
    return [size, p.teqK ? `${fmt(p.teqK, 0)} K` : null].filter(Boolean).join(' · ');
  }

  function starsList(inRange, dist, selected) {
    let stars = inRange.slice().sort((a, b) => dist(a) - dist(b));
    if (state.classes.size) stars = stars.filter((s) => state.classes.has(starClass(s)));
    if (state.withPlanets) stars = stars.filter((s) => s.planets);
    const counts = {};
    for (const s of inRange) { const c = starClass(s); if (c) counts[c] = (counts[c] ?? 0) + 1; }
    return [
      h('div', { className: 'body-list' }, CLASSES.filter((c) => counts[c]).map((c) =>
        chip(`${c} · ${counts[c]}`, state.classes.has(c), () => { state.classes.has(c) ? state.classes.delete(c) : state.classes.add(c); onRerender(); })),
      chip('WITH PLANETS', state.withPlanets, () => { state.withPlanets = !state.withPlanets; onRerender(); })),
      h('p', { className: 'note', textContent: `${stars.length} STARS${state.classes.size ? ` · CLASS ${[...state.classes].join(', ')}` : ''}` }),
      h('div', { className: 'host-list' }, stars.slice(0, 100).map((s) => rowBtn(s.name.toUpperCase(),
        `${s.spect ?? '—'} · ${fmt(dist(s), 2)} LY${s.planets ? ` · ${s.planets} PL` : ''}`, s.id === selected, () => onSelectStar(s.id)))),
    ];
  }

  function planetsList(d) {
    const planets = planetsFor(d);
    if (!planets) return [h('p', { className: 'note', textContent: 'LOADING PLANETS…' })];
    const [, test] = PLANET_KINDS[state.planetKind];
    const list = planets.filter(test);
    return [
      h('div', { className: 'body-list' }, Object.entries(PLANET_KINDS).map(([k, [label]]) => chip(label, state.planetKind === k, () => { state.planetKind = k; onRerender(); }))),
      h('p', { className: 'note', textContent: `${list.length} OF ${planets.length} KNOWN PLANETS WITHIN ${d.radiusLy} LY · NASA EXOPLANET ARCHIVE` }),
      h('div', { className: 'host-list' }, list.slice(0, 100).map((p) => rowBtn(p.name.toUpperCase(), `${fmt(p.distLy, 1)} LY${planetSummary(p) ? ` · ${planetSummary(p)}` : ''}`, false,
        () => go({ level: 'planet', system: p.hostId, body: (p.letter ?? p.name).toLowerCase().replace(/[^a-z0-9]+/g, '-') })))),
      h('p', { className: 'note', textContent: 'TEMPERATE: receives between a quarter and nearly twice the starlight Earth does. ≥ marks a minimum mass (radial velocity).' }),
    ];
  }

  /** Nearest clusters and nebulae from the current star (galactic frame, light-years). */
  function deepList(d) {
    if (!clusters && !clustersLoading) { clustersLoading = true; fetchClusters().then((c) => { clusters = c?.rows ?? []; onRerender(); }).catch(() => { clusters = []; }); }
    const cg = eqToGal([d.center.x * LY_PER_PC, d.center.y * LY_PER_PC, d.center.z * LY_PER_PC]);
    const lbd = (l, b, ly) => [ly * Math.cos(b * DEG) * Math.cos(l * DEG), ly * Math.cos(b * DEG) * Math.sin(l * DEG), ly * Math.sin(b * DEG)];
    const from = (g) => Math.hypot(g[0] - cg[0], g[1] - cg[1], g[2] - cg[2]);
    const items = [
      ...NEBULAE.map(([name, kind, ra, dec, ly]) => {
        const a = ra * DEG, de = dec * DEG;
        return { name, kind: NEBULA_KIND[kind], dist: from(eqToGal([ly * Math.cos(de) * Math.cos(a), ly * Math.cos(de) * Math.sin(a), ly * Math.sin(de)])), id: `neb-${name}` };
      }),
      ...(clusters ?? []).map(([name, l, b, pc, n, , type]) => ({ name, kind: type === 'g' ? 'GLOBULAR CLUSTER' : 'OPEN CLUSTER', dist: from(lbd(l, b, pc * LY_PER_PC)), members: n, id: `cl-${name}` })),
    ].sort((a, b) => a.dist - b.dist);
    return [
      h('p', { className: 'note', textContent: clusters ? 'NEAREST STAR CLUSTERS AND NEBULAE · OPEN THE QUADRANT VIEW TO SEE THEM' : 'LOADING CLUSTERS…' }),
      h('div', { className: 'host-list' }, items.slice(0, 60).map((o) => rowBtn(o.name.toUpperCase(), `${fmt(o.dist, 0)} LY · ${o.kind}`, false, () => go({ level: 'quadrant', select: o.id })))),
    ];
  }

  return {
    render(d, dist, selected) {
      const inRange = d.stars.filter((s) => s.id !== d.center.id && dist(s) <= d.radiusLy);
      const body = state.tab === 'systems' ? systemsList(d, inRange, dist, selected)
        : state.tab === 'stars' ? starsList(inRange, dist, selected)
          : state.tab === 'planets' ? planetsList(d) : deepList(d);
      return [h('h3', { textContent: 'NEAREST · FILTER & DRILL DOWN' }), tabs(d), ...body];
    },
  };
}
