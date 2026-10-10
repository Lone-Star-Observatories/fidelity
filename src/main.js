// USS Fidelity — bridge console. Wires the LCARS shell, router, clock and views.

import { createClock } from './astro/clock.js';
import { shipDate, dateFromJd, jdFromDate, isoDay } from './astro/time.js';
import { VALID_RANGE } from './astro/kepler.js';
import { LY_PER_PC } from './astro/frames.js';
import { createSystemView } from './views/system/SystemView.js';
import { createNavigationView } from './views/navigation/NavigationView.js';
import { createStarView } from './views/star/StarView.js';
import { createPlanetView } from './views/planet/PlanetView.js';
import { createGalaxyView, R0_KLY, IMAGE } from './views/galaxy/GalaxyView.js';
import { LIGHT_SECONDS_PER_AU, AU_KM } from './data/sol.js';
import { solSystem, buildStarSystem } from './data/systems.js';
import { fetchNearby, fetchStar, fetchSky, fetchTextureCredits, fetchSpectrum, fetchGalaxyStars, fetchSmallBodies } from './data/catalog.js';
import { badge, TIERS } from './data/provenance.js';
import { settings } from './settings.js';
import { onRoute, go } from './router.js';
import { ROADMAP } from './roadmap.js';
import { createSatellitePanel } from './panels/satellite.js';
import { fmtYear, span, humanScale, LIFETIME_YEARS } from './data/lighttime.js';
import { POP_COLORS } from './views/system/belts.js';
import { fetchDsn } from './data/spacecraft-ephem.js';

const $ = (id) => document.getElementById(id);
const h = (tag, props = {}, ...kids) => {
  const el = Object.assign(document.createElement(tag), props);
  for (const k of kids.flat()) if (k != null) el.append(k);
  return el;
};
const STANDALONE = import.meta.env.MODE === 'standalone';

const clock = createClock();
let route = { level: 'system', system: 'sol', body: null };
let lastFrame = null;
let currentSystem = 'sol'; // the system the ship is "in"; Navigation looks outward from it
let navRadius = 25;

// ---- views -------------------------------------------------------------------------
const system = createSystemView($('system-view'), {
  clock,
  onSelect: (id) => go({ level: 'system', system: currentSystem, body: id }),
  onFrame: (f) => { if (route.level === 'system' || route.level === 'satellite') lastFrame = f; },
});
const starView = createStarView($('star-view'));
const planetView = createPlanetView($('planet-view'));
const galaxy = createGalaxyView($('galaxy-view'), { onFrame: (f) => { if (route.level === 'galaxy') lastFrame = f; } });
let galaxyStarsLoaded = false;
const nav = createNavigationView($('navigation-view'), {
  onSelect: (id) => selectNavStar(id),
  onFrame: (f) => { if (route.level === 'navigation') lastFrame = f; },
});

// ---- rail ----------------------------------------------------------------------------
const LEVEL_BUTTONS = [
  ['universe', 'UNIVERSE', 'var(--rose)'], ['galaxy', 'GALAXY', 'var(--lilac)'],
  ['quadrant', 'QUADRANT', 'var(--apricot)'], ['navigation', 'NAVIGATION', 'var(--gold)'],
  ['system', 'SYSTEM', 'var(--peach)'],
];
const LIVE_LEVELS = new Set(['galaxy', 'navigation', 'system']);
const SUB_BUTTONS = [['star', 'STAR'], ['planet', 'PLANET'], ['moon', 'MOON'], ['satellite', 'SATELLITE'], ['object', 'OBJECT']];

const railLevels = $('rail-levels');
LEVEL_BUTTONS.forEach(([id, label, c], i) => {
  const live = LIVE_LEVELS.has(id);
  const b = h('button', { className: `rail-btn${live ? '' : ' dormant'}`, title: live ? '' : 'Subsystem offline' },
    h('small', { textContent: String(i + 1).padStart(2, '0') }), label);
  b.style.setProperty('--c', c);
  b.dataset.level = id;
  b.addEventListener('click', () => go({ level: id, system: currentSystem }));
  railLevels.append(b);
});
const railSubs = $('rail-subviews');
for (const [id, label] of SUB_BUTTONS) {
  const b = h('button', { className: 'rail-btn sub' }, label);
  b.dataset.sub = id;
  b.addEventListener('click', () => {
    // Star sub-view currently means "focus the star inside System View".
    if (id === 'star') {
      const b = route.body && system.model?.bodies.find((x) => x.id === route.body && (x.starLike || x.kind === 'star'));
      return go({ level: 'star', system: currentSystem, body: b?.id ?? system.model?.starId ?? 'sun' });
    }
    if (id === 'planet') {
      const m = system.model;
      const b = route.body && m?.bodies.find((x) => x.id === route.body && !(x.starLike || x.kind === 'star'));
      const pick = b ?? m?.bodies.find((x) => x.id === 'earth') ?? m?.bodies.find((x) => !(x.starLike || x.kind === 'star'));
      if (pick) return go({ level: 'planet', system: currentSystem, body: pick.id });
      return toast('NO KNOWN PLANETS IN THIS SYSTEM');
    }
    if (id === 'satellite') {
      if (currentSystem !== 'sol') return toast('SATELLITE TRACKING COVERS SECTOR 001 ONLY');
      return go({ level: 'satellite', system: 'sol', body: route.level === 'satellite' ? route.body : '25544' });
    }
    if (id === 'moon' || id === 'object') {
      const m = system.model;
      const want = (x) => (id === 'moon' ? x.kind === 'moon' : x.orbit?.type === 'elements');
      const cur = route.body && m?.bodies.find((x) => x.id === route.body);
      const pick = (cur && want(cur) && cur) || (id === 'moon' && cur && m.bodies.find((x) => x.kind === 'moon' && x.parent === cur.id)) || m?.bodies.find(want);
      if (pick) return go({ level: id, system: currentSystem, body: pick.id });
      return toast(id === 'moon' ? 'NO KNOWN MOONS IN THIS SYSTEM' : 'NO CATALOGUED OBJECTS IN THIS SYSTEM YET');
    }
    toast(`${label} VIEW OFFLINE — ${ROADMAP[id].status}`);
  });
  railSubs.append(b);
}

function syncRail() {
  for (const b of railLevels.children) b.classList.toggle('active', b.dataset.level === route.level);
  railSubs.querySelector('[data-sub="star"]').classList.toggle('active', route.level === 'star');
  for (const k of ['planet', 'moon', 'object', 'satellite']) railSubs.querySelector(`[data-sub="${k}"]`).classList.toggle('active', route.level === k);
}

// ---- toast & warp -----------------------------------------------------------------------
let toastTimer;
function toast(msg, ms = 3200) {
  const t = $('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}
function warp() {
  const w = $('warp');
  w.classList.remove('go');
  void w.offsetWidth;
  w.classList.add('go');
}

// ---- beacon ---------------------------------------------------------------------------
$('beacon').addEventListener('click', () => go({ level: 'system', system: 'sol' }));

// ---- bottom controls ----------------------------------------------------------------------
const controls = $('controls');
const pill = (label, onClick, cls = '') => {
  const b = h('button', { className: `pill ${cls}`, textContent: label });
  b.addEventListener('click', onClick);
  return b;
};
const rateOut = h('div', { className: 'ctl-readout mono' });
const holdBtn = pill('❚❚', () => clock.toggleHold());
const dateIn = h('input', { type: 'date', id: 'ship-date', title: 'Jump to date (UTC)' });
dateIn.addEventListener('change', () => {
  if (!dateIn.value) return;
  const [y, m, d] = dateIn.value.split('-').map(Number);
  clock.set(jdFromDate(new Date(Date.UTC(y, m - 1, d, 12))));
});

const toggle = (key, a, b, labelA, labelB) => {
  const group = h('div', { className: 'ctl-group' });
  const ba = pill(labelA, () => settings.set(key, a));
  const bb = pill(labelB, () => settings.set(key, b), 'right');
  const sync = () => { ba.classList.toggle('on', settings.get(key) === a); bb.classList.toggle('on', settings.get(key) === b); };
  settings.onChange(sync); sync();
  group.append(ba, bb);
  return group;
};
const flag = (key, label) => {
  const b = pill(label, () => settings.set(key, !settings.get(key)), 'square');
  const sync = () => b.classList.toggle('on', !!settings.get(key));
  settings.onChange(sync); sync();
  return b;
};

controls.append(
  h('div', { className: 'ctl-group' },
    h('div', { className: 'ctl-label', textContent: 'TIME' }),
    pill('◀◀', () => clock.slower(), 'square'), holdBtn, pill('▶▶', () => clock.faster(), 'square'),
    rateOut, pill('NOW', () => clock.now(), 'square'), dateIn),
  h('div', { className: 'ctl-group' }, h('div', { className: 'ctl-label', textContent: 'SCALE' }),
    toggle('scale', 'enhanced', 'true', 'ENHANCED', 'TRUE')),
  h('div', { className: 'ctl-group' }, h('div', { className: 'ctl-label', textContent: 'EPHEMERIS' }),
    toggle('ephemeris', 'kepler', 'horizons', 'KEPLER', 'JPL HORIZONS')),
  h('div', { className: 'ctl-group' }, flag('labels', 'LABELS'), flag('orbits', 'ORBITS'), flag('belts', 'BELTS'), flag('satellites', 'SATS'), flag('zones', 'ZONES')),
  h('div', { className: 'bar-fill' }),
);
// Standalone build (e.g. a shared preview) has no backend, so no Horizons proxy.
if (STANDALONE) {
  settings.set('ephemeris', 'kepler');
  const hz = [...controls.querySelectorAll('.pill')].find((b) => b.textContent === 'JPL HORIZONS');
  hz.disabled = true;
  hz.title = 'Needs the local backend: run `npm start` from the fidelity repo.';
}
const syncClock = () => {
  rateOut.textContent = clock.rate.label;
  holdBtn.textContent = clock.rate.days === 0 ? '▶' : '❚❚';
};
clock.onChange(syncClock); syncClock();

// ---- panel helpers ----------------------------------------------------------------------
const panelEl = $('panel');
// replaceChildren would print `null` for skipped optional sections
const panel = { replaceChildren: (...kids) => panelEl.replaceChildren(...kids.filter((k) => k != null)) };
const live = {}; // element refs refreshed by the ticker; reset whenever the panel is rebuilt
const resetLive = () => { for (const k of Object.keys(live)) delete live[k]; };

const fmt = (n, d = 3) => n.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });
const lightTime = (au) => {
  const s = au * LIGHT_SECONDS_PER_AU;
  return s < 120 ? `${fmt(s, 1)} S` : s < 7200 ? `${fmt(s / 60, 1)} MIN` : `${fmt(s / 3600, 2)} H`;
};

function row(dl, label, value, tier, detail) {
  const dd = h('dd', { textContent: value });
  dl.append(h('dt', { textContent: label }), dd, tier ? badge(tier, detail) : h('span'));
  return dd;
}
let credits = {};
let beltCounts = null;
fetchTextureCredits().then((c) => { credits = c; });

const factList = (facts, body) => {
  const dl = h('dl');
  for (const f of facts) {
    // Surface facts carry the credit of the image actually in use.
    const credit = body?.skin?.map && (f.label === 'SURFACE' || f.label === 'SKIN') ? credits[body.skin.map] : null;
    row(dl, f.label, f.value, f.tier, credit ? `${f.detail}\nImage: ${credit}` : f.detail);
  }
  return dl;
};

function renderLegend() {
  return h('div', {},
    h('h3', { textContent: 'DATA PROVENANCE' }),
    h('div', { className: 'legend' }, Object.keys(TIERS).map((t) => badge(t))),
    h('p', { className: 'note', textContent: 'Every value is tagged. Hover a badge for what it means.' }));
}

const satPanel = createSatellitePanel({ h, pill, row, factList, badge, renderLegend, go, system, clock, toast, panel, live, resetLive, $ });

const sectorName = (m) => (m.isSol ? 'SECTOR 001' : `${fmt(m.distLy, 1)} LY FROM SOL`);

// ---- system panels ----------------------------------------------------------------------
const KEY = [['main', 'MAIN BELT', '2.1–3.3 AU'], ['neo', 'NEAR-EARTH ASTEROIDS', 'CROSS OR APPROACH EARTH\'S ORBIT'], ['trojan', 'JUPITER TROJANS', 'AT JUPITER\'S L4 / L5'],
  ['centaur', 'CENTAURS', 'BETWEEN JUPITER AND NEPTUNE'], ['tno', 'TRANS-NEPTUNIAN OBJECTS', 'KUIPER BELT AND BEYOND']];
// ---- Deep Space Network ----------------------------------------------------------------------
let dsn = null;
async function pollDsn() {
  try { dsn = await fetchDsn(); } catch { /* offline */ }
  renderDsn();
}
if (!STANDALONE) { pollDsn(); setInterval(pollDsn, 20000); }
const STATIONS = { Goldstone: 'GOLDSTONE, USA', Madrid: 'MADRID, SPAIN', Canberra: 'CANBERRA, AUSTRALIA' };
const rate = (b) => (b >= 1e6 ? `${(b / 1e6).toFixed(1)} Mb/s` : b >= 1e3 ? `${(b / 1e3).toFixed(1)} kb/s` : `${b.toFixed(b < 10 ? 1 : 0)} b/s`);
function dsnRows(contacts) {
  return contacts.map((c) => {
    const craft = system.model?.bodies.find((b) => b.horizons === String(c.spacecraftId));
    const btn = h('button', { className: 'host-row' },
      h('span', { textContent: `${craft ? craft.name.toUpperCase() : c.code} · ${c.dish}` }),
      h('span', { className: 'mono', textContent: `${c.down ? `↓ ${rate(c.down.rate)} · ${c.down.power} dBm` : '↑ UPLINK'} · ${STATIONS[c.station] ?? c.station}` }));
    if (craft) btn.addEventListener('click', () => go({ level: 'system', system: 'sol', body: craft.id }));
    return btn;
  });
}
function renderDsn() {
  if (live.dsnBoard) {
    live.dsnBoard.replaceChildren(...(dsn?.contacts?.length ? dsnRows(dsn.contacts) : [h('p', { className: 'note', textContent: STANDALONE ? 'Live DSN status needs the local backend (npm start).' : 'NO DATA YET' })]));
  }
  if (live.dsnCraft) {
    const mine = dsn?.contacts?.filter((c) => String(c.spacecraftId) === live.dsnCraft) ?? [];
    live.dsnOne.replaceChildren(...(mine.length ? dsnRows(mine) : [h('p', { className: 'note', textContent: dsn ? 'NOT IN CONTACT RIGHT NOW. Antennas are shared by dozens of missions; check back in a few hours.' : 'Live DSN status needs the local backend.' })]));
  }
}

function colourKey() {
  return h('div', { className: 'colour-key' }, KEY.map(([k, label, where]) => h('div', { className: 'ck-row' },
    h('span', { className: 'ck-dot', style: `background:#${POP_COLORS[k].toString(16).padStart(6, '0')}` }),
    h('span', { textContent: label }), h('span', { className: 'ck-sub', textContent: where }))),
  h('p', { className: 'note', textContent: 'Every dot is a real object on its measured orbit (JPL Small-Body Database), moving with the clock. Satellite colours are listed under EARTH ORBIT.' }));
}

function bodyGroups(m) {
  if (!m.isSol) return [['BODIES', m.bodies]];
  return [
    ['STAR & PLANETS', m.bodies.filter((b) => b.orbit?.type === 'sol' || b.kind === 'star')],
    ['DWARF PLANETS, ASTEROIDS & COMETS', m.bodies.filter((b) => b.orbit?.type === 'elements')],
    ['SPACECRAFT · DEEP SPACE', m.bodies.filter((b) => b.kind === 'spacecraft')],
    ['REGIONS', m.bodies.filter((b) => b.kind === 'region')],
    ['LAGRANGE POINTS', m.bodies.filter((b) => b.kind === 'lagrange point')],
  ];
}
const detailLevel = (b) => (b.marker || b.kind === 'spacecraft' ? null : b.kind === 'moon' ? 'moon' : b.orbit?.type === 'elements' ? 'object' : 'planet');
function renderSystemPanel() {
  renderSystemPanelInner();
  renderDsn();
}

function renderSystemPanelInner() {
  resetLive();
  const m = system.model;
  panel.replaceChildren(
    h('h2', { textContent: m.name.toUpperCase() }),
    h('div', { className: 'kind', textContent: m.subtitle }),
    ...bodyGroups(m).flatMap(([title, list]) => [
      h('h3', { textContent: title }),
      h('div', { className: 'body-list' }, list.map((b) => pill(b.name.toUpperCase(), () => go({ level: 'system', system: m.id, body: b.id })))),
    ]),
    h('h3', { textContent: 'SURVEY' }),
    h('div', { className: 'body-list' },
      m.survey.map((s) => pill(s.label, () => { warp(); system.overview(s.au, s.centre, s.localKm); })),
      pill('NAVIGATION ▸', () => go({ level: 'navigation', system: m.id })),
      m.isSol ? null : pill('MESSAGE TO EARTH ▸', () => {
        pendingMessage = true;
        navRadius = [10, 25, 50, 100].find((r) => r > m.distLy * 1.05) ?? 100; // keep Earth on the chart
        go({ level: 'navigation', system: m.id });
      })),
    ...(m.isSol ? [
      h('h3', { textContent: 'KEY · SMALL BODIES' }), colourKey(),
      h('h3', { textContent: 'EARTH ORBIT · SATELLITES' }), satPanel.searchSection(),
      h('h3', { textContent: 'DEEP SPACE NETWORK · NOW' }), (live.dsnBoard = h('div', { className: 'host-list' })),
      h('p', { className: 'note', textContent: 'NASA DSN Now: who the 34 m and 70 m dishes are talking to, refreshed every 20 s.' }),
      h('h3', { textContent: 'EPHEMERIS' }),
      (live.eph = h('p', { className: 'note' })),
      (live.range = h('p', { className: 'warn' })),
    ] : [
      ...(m.binary ? [
        h('h3', { textContent: 'STAR ORBITS' }),
        ...m.binary.orbits.map((o) => factList([
          { label: o.letters.join('–'), value: `${m.bodies.find((b) => b.id === o.primary).name.toUpperCase()} + ${m.bodies.find((b) => b.id === o.secondary).name.toUpperCase()}`, tier: 'measured', detail: `${o.wds} ${o.designation}` },
          { label: 'PERIOD', value: o.periodYears > 1000 ? `${fmt(o.periodYears, 0)} YR` : `${fmt(o.periodYears, 2)} YR`, tier: 'measured', detail: `ORB6, ${o.ref}. Grade ${o.grade} (1 = definitive, 5 = indeterminate).` },
          { label: 'SIZE', value: `${fmt(o.aArcsec * o.distPc, 1)} AU`, tier: 'measured', detail: 'Semi-major axis: ORB6 angular size × parallax distance.' },
        ])),
        h('p', { className: 'note', textContent: 'Each star moves about the shared centre of mass. Which side of each orbit is nearer to us is ambiguous without radial velocities.' }),
      ] : []),
      ...(m.bodies.some((b) => b.kind === 'exoplanet') ? [
        h('h3', { textContent: 'PLANET ORBITS' }),
        factList([{ label: 'ORBIT PLANE', value: m.transiting ? 'EDGE-ON TO SOL' : 'UNKNOWN', tier: m.transiting ? 'computed' : 'imagined',
          detail: m.transiting ? 'At least one planet transits, so the orbits are edge-on as seen from Sol.' : 'No planet transits; the orientation is unknown.' }]),
      ] : []),
      ...m.notes.map((n) => h('p', { className: 'note', textContent: n })),
    ]),
    (live.sky = h('p', { className: 'note' })),
    renderLegend(),
  );
}

function renderBodyPanel(id, opts) {
  renderBodyPanelInner(id, opts);
  const b = system.model.bodies.find((x) => x.id === id);
  if (b?.kind === 'spacecraft') live.dsnCraft = b.horizons;
  renderDsn();
}

function renderBodyPanelInner(id, { inStarView = false } = {}) { // inStarView: any detail view
  resetLive();
  const m = system.model;
  const b = m.bodies.find((x) => x.id === id);
  const isStar = !!(b.starLike || b.kind === 'star');
  const star = m.bodies.find((x) => x.id === (b.orbit?.host ?? b.parent ?? m.starId)) ?? m.bodies[0];
  const pos = h('dl');
  live.posKm = b.kind === 'moon' || (b.kind === 'spacecraft' && !!b.parent);
  if (!isStar) live.pos = row(pos, `FROM ${star.name.toUpperCase()}`, '—', 'computed');
  live.posTier = pos.lastChild;
  if (m.isSol && id !== 'earth' && b.parent !== 'earth') live.earth = row(pos, 'FROM EARTH', '—', 'computed');
  live.light = row(pos, m.isSol ? 'LIGHT TIME' : 'STARLIGHT TRAVEL', '—', 'computed',
    m.isSol ? 'Light travel time from Earth (or from Sol, for Earth).' : 'Time for light to reach this world from its star.');
  if (b.kind === 'region') {
    pos.replaceChildren();
    live.pos = live.earth = live.light = null;
    row(pos, 'CENTRED ON', b.anchor === 'sun' ? 'SOL' : 'EARTH', 'computed');
  }
  if (isStar) {
    pos.replaceChildren();
    if (m.multiplicity > 1) live.pos = row(pos, 'FROM BARYCENTRE', '—', 'computed', 'Distance from the centre of mass of the whole star system, from the ORB6 orbits.');
    else row(pos, 'POSITION', 'SYSTEM CENTRE', 'computed');
  }

  const groups = Object.entries(b.facts || {}).filter(([, f]) => f.length);
  const look = h('dl');
  if (!b.marker) live.size = row(look, 'SIZE ON SCREEN', '—', 'imagined', 'Enhanced scale enlarges bodies so they are visible.');
  if (b.id === 'main-belt' || b.id === 'kuiper-belt' || b.id === 'trojans') {
    const c = beltCounts;
    if (c) row(look, 'DRAWN HERE', `${fmt((b.id === 'main-belt' ? c.main : b.id === 'trojans' ? c.trojan : c.tno + c.centaur), 0)} REAL ORBITS`, 'measured', 'JPL Small-Body Database orbits; positions solved live from Kepler\'s equation.');
  }

  panel.replaceChildren(
    h('h2', { textContent: b.name.toUpperCase() }),
    h('div', { className: 'kind', textContent: `${sectorName(m)} · ${b.kind.toUpperCase()}` }),
    h('h3', { textContent: 'POSITION' }), pos,
    ...groups.flatMap(([g, facts]) => [h('h3', { textContent: g }), factList(facts, b)]),
    b.skin?.map && credits[b.skin.map] ? h('p', { className: 'note credit', textContent: `IMAGE · ${credits[b.skin.map]}` }) : null,
    look,
    (live.range = h('p', { className: 'warn' })),
    h('div', { className: 'body-list' },
      inStarView ? pill('◀ SYSTEM VIEW', () => go({ level: 'system', system: m.id, body: b.id })) : pill('◀ SYSTEM', () => go({ level: 'system', system: m.id })),
      inStarView ? null : isStar ? pill('STAR VIEW ▸', () => go({ level: 'star', system: m.id, body: b.id })) :
        detailLevel(b) ? pill(`${detailLevel(b).toUpperCase()} VIEW ▸`, () => go({ level: detailLevel(b), system: m.id, body: b.id })) : null,
      b.parent ? pill(`◀ ${b.parent.toUpperCase()}`, () => go({ level: 'system', system: m.id, body: b.parent })) : null),
    ...(moonsOf(m, b.id).length ? [h('h3', { textContent: 'MOONS' }),
      h('div', { className: 'body-list' }, moonsOf(m, b.id).map((x) => pill(x.name.toUpperCase(), () => go({ level: 'system', system: m.id, body: x.id }))))] : []),
    b.note ? h('p', { className: 'note', textContent: b.note }) : null,
    ...(b.kind === 'spacecraft' ? [h('h3', { textContent: 'DEEP SPACE NETWORK · LIVE' }), (live.dsnOne = h('div', { className: 'host-list' }))] : []),
    ...(m.isSol && b.id === 'earth' ? [h('h3', { textContent: 'SATELLITES' }), satPanel.searchSection()] : []),
    renderLegend(),
  );
}

const moonsOf = (m, id) => m.bodies.filter((x) => x.kind === 'moon' && x.parent === id);

function renderOfflinePanel(level) {
  resetLive();
  const r = ROADMAP[level];
  panel.replaceChildren(
    h('h2', { textContent: level.toUpperCase() }),
    h('div', { className: 'kind', textContent: 'SUBSYSTEM OFFLINE' }),
    h('h3', { textContent: 'PLANNED DATA' }),
    h('p', { className: 'note', textContent: r.data }),
    renderLegend());
}

// ---- galaxy panel ------------------------------------------------------------------------
function renderGalaxyPanel() {
  resetLive();
  const fleet = pill(settings.get('starfleet') ? 'STARFLEET OVERLAY: ON' : 'STARFLEET OVERLAY: OFF', () => {
    settings.set('starfleet', !settings.get('starfleet'));
    renderGalaxyPanel();
  }, settings.get('starfleet') ? 'on' : '');
  panel.replaceChildren(
    h('h2', { textContent: 'MILKY WAY' }),
    h('div', { className: 'kind', textContent: 'BARRED SPIRAL GALAXY · SEEN FROM GALACTIC NORTH' }),
    h('h3', { textContent: 'VIEW' }),
    h('div', { className: 'body-list' },
      pill('WHOLE GALAXY', () => galaxy.view('galaxy')), pill('SOLAR NEIGHBOURHOOD', () => galaxy.view('sol')),
      pill('GALACTIC CENTRE', () => galaxy.view('centre')), pill('SATELLITE GALAXIES', () => galaxy.view('satellites'))),
    h('h3', { textContent: 'QUADRANTS' }),
    h('div', { className: 'body-list' }, fleet, pill('NAVIGATION ▸', () => go({ level: 'navigation', system: currentSystem }))),
    h('p', { className: 'note', textContent: 'Orange spokes: the real IAU galactic quadrants I–IV, measured by galactic longitude from the Sun. The Starfleet overlay draws Star Trek\'s Alpha–Delta quadrants, centred on the galactic core.' }),
    h('h3', { textContent: 'FACTS' }),
    factList([
      { label: 'SOL → CENTRE', value: `${R0_KLY.toFixed(1)} KLY`, tier: 'measured', detail: 'R₀ = 8.178 kpc from stars orbiting Sgr A* (GRAVITY Collaboration 2019).' },
      { label: 'SOL ABOVE PLANE', value: '68 LY', tier: 'measured', detail: 'z₀ = 20.8 pc (Bennett & Bovy 2019).' },
      { label: 'SOL ORBIT SPEED', value: '≈ 230 KM/S', tier: 'measured', detail: 'Circular velocity at the Sun (e.g. Eilers et al. 2019).' },
      { label: 'GALACTIC YEAR', value: '≈ 225 MILLION YR', tier: 'computed', detail: '2πR₀ / v.' },
      { label: 'STARS', value: '100–400 BILLION', tier: 'modelled', detail: 'From the galaxy\'s mass and light; nobody has counted them.' },
      { label: 'SGR A* MASS', value: '4.3 MILLION × SUN', tier: 'measured', detail: 'From the orbit of the star S2 (GRAVITY 2019); imaged by the Event Horizon Telescope in 2022.' },
      { label: 'IMAGE', value: "ARTIST'S CONCEPT", tier: 'imagined', detail: `NASA/JPL-Caltech/R. Hurt (SSC/Caltech), PIA10748, built from Spitzer data. We cannot photograph our galaxy from outside. Scaled so Sol sits at R₀; the image spans ${IMAGE.widthKly.toFixed(0)} kly.` },
      { label: 'BLUE DOTS', value: 'CATALOGUE STARS', tier: 'measured', detail: 'Every HYG star within 1,500 ly brighter than absolute magnitude 2, at its parallax position. That is as far as the catalogue reaches: a tiny bubble in the galaxy.' },
    ]),
    renderLegend(),
  );
}

// ---- navigation panel --------------------------------------------------------------------
let navSelected = null;

function distLy(a, b) { return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) * LY_PER_PC; }

function renderNavPanel() {
  resetLive();
  const d = nav.data;
  if (!d) return;
  const c = d.center;
  const inRange = d.stars.filter((s) => s.id !== c.id && distLy(s, c) <= d.radiusLy);
  const hosts = inRange.filter((s) => s.planets).sort((a, b) => distLy(a, c) - distLy(b, c));
  const radii = h('div', { className: 'body-list radius-list' }, [10, 25, 50, 100].map((r) =>
    pill(`${r} LY`, () => { navRadius = r; showNavigation(c.id); }, r === d.radiusLy ? 'on' : '')));

  const sel = navSelected && d.stars.find((s) => s.id === navSelected);
  let selBlock = [];
  if (sel) {
    const dl = h('dl');
    row(dl, 'FROM HERE', `${fmt(distLy(sel, c), 2)} LY`, 'measured', 'From parallax distances in the catalogue.');
    if (c.id !== 'sol' && sel.id !== 'sol') {
      const sol = d.stars.find((s) => s.id === 'sol');
      if (sol) row(dl, 'FROM SOL', `${fmt(distLy(sel, sol), 2)} LY`, 'measured', 'Parallax.');
    }
    if (sel.spect) row(dl, 'CLASS', sel.spect, 'measured', 'Spectral type.');
    if (sel.absmag != null) row(dl, 'ABS. MAGNITUDE', fmt(sel.absmag, 2), 'computed', 'From apparent brightness and distance.');
    row(dl, 'KNOWN PLANETS', String(sel.planets || 0), 'measured', sel.planets ? 'NASA Exoplanet Archive.' : 'None detected yet, which is not the same as none.');
    row(dl, 'CATALOGUE', sel.archiveOnly === 2 ? 'BROWN DWARF · LITERATURE' : sel.archiveOnly ? 'EXOPLANET ARCHIVE' : 'HYG v4.4', 'measured',
      sel.archiveOnly === 2 ? 'Too faint for Hipparcos; found by WISE. Parallax from the discovery and follow-up papers.' : sel.archiveOnly ? 'Too faint for HYG; position from the Exoplanet Archive.' : 'Hipparcos / Yale / Gliese compilation.');
    selBlock = [
      h('h3', { textContent: 'SELECTED' }),
      h('h2', { className: 'sel-name', textContent: sel.name.toUpperCase() }),
      dl,
      h('div', { className: 'body-list' },
        pill(sel.id === c.id ? 'ENTER SYSTEM ▸' : 'WARP TO SYSTEM ▸', () => { warp(); go({ level: 'system', system: sel.id }); }),
        sel.id !== c.id ? pill('NAVIGATE FROM HERE', () => showNavigation(sel.id)) : null),
    ];
  }

  panel.replaceChildren(
    h('h2', { textContent: 'NAVIGATION' }),
    h('div', { className: 'kind', textContent: `LOOKING OUT FROM ${c.name.toUpperCase()}${c.id === 'sol' ? ' · SECTOR 001' : ''}` }),
    h('h3', { textContent: 'SENSOR RANGE' }), radii,
    h('p', { className: 'note', textContent: `${inRange.length} STARS · ${hosts.length} WITH KNOWN PLANETS WITHIN ${d.radiusLy} LY` }),
    ...selBlock,
    ...transmissionSection(d, sel),
    h('h3', { textContent: 'PLANETARY SYSTEMS · NEAREST FIRST' }),
    h('div', { className: 'host-list' }, hosts.slice(0, 60).map((s) => {
      const b = h('button', { className: `host-row${s.id === navSelected ? ' on' : ''}` },
        h('span', { textContent: s.name.toUpperCase() }), h('span', { className: 'mono', textContent: `${fmt(distLy(s, c), 1)} LY · ${s.planets}` }));
      b.addEventListener('click', () => selectNavStar(s.id));
      return b;
    })),
    h('h3', { textContent: 'CHART' }),
    factList([
      { label: 'STAR POSITIONS', value: 'PARALLAX', tier: 'measured', detail: d.sources.stars },
      { label: 'PLANET HOSTS', value: 'RINGED', tier: 'measured', detail: d.sources.planets },
      { label: 'STAR COLOUR', value: 'FROM B−V', tier: 'computed', detail: 'Blackbody colour at the temperature implied by the colour index.' },
      { label: 'STAR SIZE', value: 'LUMINOSITY', tier: 'imagined', detail: 'Dot size encodes absolute magnitude, not physical size.' },
      { label: 'GRID', value: 'GALACTIC PLANE', tier: 'computed', detail: 'IAU galactic frame; quadrants I–IV by galactic longitude.' },
    ]),
    h('p', { className: 'note', textContent: 'The catalogue misses many faint red and brown dwarfs, so the real neighbourhood is more crowded than shown.' }),
    renderLegend(),
  );
}

// ---- message light-time (#16) --------------------------------------------------------------
const yearOf = (jd) => { const d = dateFromJd(jd); return d.getUTCFullYear() + (d - Date.UTC(d.getUTCFullYear(), 0, 1)) / (365.25 * 86400000); };
const SPEEDS = [[1, '1 LY / S'], [0.1, '1 LY / 10 S'], [1 / 60, '1 LY / MIN']];
let msgSpeed = 0.1, msgSent = null, pendingMessage = false;

function transmissionSection(d, sel) {
  const c = d.center, sol = d.stars.find((s) => s.id === 'sol');
  const far = c.id === 'sol' ? (sel && sel.id !== 'sol' ? sel : null) : sol;
  if (!far) return [h('h3', { textContent: 'TRANSMISSION' }), h('p', { className: 'note', textContent: 'Select a star to send it a message from Earth and see when a reply could come back.' })];
  const dist = distLy(far, c), y0 = yearOf(clock.jd);
  const from = c.id === 'sol' ? 'EARTH' : c.name.toUpperCase(), to = far.id === 'sol' ? 'EARTH' : far.name.toUpperCase();
  const dl = h('dl');
  row(dl, 'DISTANCE', `${fmt(dist, 2)} LY`, 'measured', 'From parallax: light needs one year per light-year.');
  row(dl, 'SENT', fmtYear(y0), 'computed', 'The ship\'s clock.');
  row(dl, `REACHES ${to}`, fmtYear(y0 + dist), 'computed', `After ${span(dist)} at the speed of light.`);
  row(dl, 'REPLY BACK', fmtYear(y0 + 2 * dist), 'computed', 'If they answer the moment it arrives.');
  row(dl, 'ROUND TRIP', span(2 * dist), 'computed', dist > LIFETIME_YEARS / 2 ? `Measured in human lifetimes of ${LIFETIME_YEARS} years.` : '');
  const human = humanScale(2 * dist);
  live.msgNow = h('p', { className: 'warn mono' });
  const speeds = h('div', { className: 'body-list' }, SPEEDS.map(([v, label]) => pill(label, () => { msgSpeed = v; nav.setMessageSpeed(v); renderNavPanel(); }, v === msgSpeed ? 'on' : '')));
  return [
    h('h3', { textContent: `TRANSMISSION · ${from} → ${to}` }), dl,
    h('p', { className: 'note', textContent: human }),
    h('div', { className: 'body-list' }, pill(nav.message ? 'RESEND ▸' : 'TRANSMIT ▸', () => {
      nav.sendMessage(c.id, far.id, msgSpeed); msgSent = { y0, dist }; renderNavPanel();
    })),
    h('div', { className: 'ctl-label', textContent: 'PLAYBACK' }), speeds,
    live.msgNow,
  ];
}

function tickMessage() {
  const s = nav.message;
  if (!live.msgNow || !s || !msgSent) return;
  const y = msgSent.y0 + s.travelled;
  live.msgNow.textContent = s.done ? `REPLY RECEIVED · ${fmtYear(msgSent.y0 + 2 * s.dist)} · ${span(2 * s.dist)} AFTER SENDING`
    : s.out ? `OUTBOUND · ${fmt(s.travelled, 2)} / ${fmt(s.dist, 2)} LY · MESSAGE YEAR ${fmtYear(y)}`
      : `REPLY · ${fmt(s.travelled - s.dist, 2)} / ${fmt(s.dist, 2)} LY · MESSAGE YEAR ${fmtYear(y)}`;
}

function selectNavStar(id) {
  navSelected = id;
  nav.select(id);
  renderNavPanel();
}

// ---- loading systems & navigation --------------------------------------------------------
let loadToken = 0;
function overlay(title, text, actions = []) {
  const o = $('offline');
  o.hidden = false;
  o.replaceChildren(h('h2', { textContent: title }), h('p', { textContent: text }), ...actions);
}
const backendNeeded = STANDALONE
  ? 'This preview has no local backend. Run the app with `npm start` to load the star catalogue.'
  : 'The local backend could not load the catalogue.';

async function ensureSystem(id) {
  if (system.model?.id === id) return true;
  const token = ++loadToken;
  if (id === 'sol') {
    system.load(solSystem());
  } else {
    overlay('PLOTTING COURSE', `Loading ${id} from the catalogue…`);
    try {
      const detail = await fetchStar(id);
      if (token !== loadToken) return false;
      system.load(buildStarSystem(detail));
      $('offline').hidden = true;
    } catch (err) {
      if (token !== loadToken) return false;
      overlay('COURSE UNAVAILABLE', `${err.message}. ${backendNeeded}`, [pill('◆ RETURN TO SECTOR 001', () => go({ level: 'system', system: 'sol' }))]);
      return false;
    }
  }
  currentSystem = id;
  if (id === 'sol') {
    fetchSmallBodies().then((d) => { const c = system.setBelts(d); if (c) beltCounts = c; });
    satPanel.load();
  }
  system.decorativeSky();
  fetchSky(id).then((s) => { if (system.model?.id === id) system.setSky(s.stars); }).catch(() => {});
  return true;
}

async function showNavigation(center) {
  currentSystem = center;
  if (route.level !== 'navigation' || route.system !== center) return go({ level: 'navigation', system: center });
  const token = ++loadToken;
  overlay('LONG-RANGE SENSORS', `Scanning ${navRadius} light-years around ${center === 'sol' ? 'Sol' : center}…`);
  try {
    const d = await fetchNearby(center, navRadius);
    if (token !== loadToken || route.level !== 'navigation') return;
    $('offline').hidden = true;
    nav.load(d);
    navSelected = null;
    msgSent = null;
    if (pendingMessage && d.center.id !== 'sol') {
      pendingMessage = false;
      nav.sendMessage(d.center.id, 'sol', msgSpeed);
      msgSent = { y0: yearOf(clock.jd), dist: distLy(d.stars.find((s) => s.id === 'sol'), d.center) };
    }
    renderNavPanel();
    $('view-title').textContent = `NAVIGATION · ${d.center.name.toUpperCase()}`;
  } catch (err) {
    if (token !== loadToken) return;
    overlay('SENSORS OFFLINE', `${err.message}. ${backendNeeded}`, [pill('◆ RETURN TO SECTOR 001', () => go({ level: 'system', system: 'sol' }))]);
    renderOfflinePanel('navigation');
  }
}

// ---- live ticker (≈5 Hz) -----------------------------------------------------------------
function tick() {
  const f = lastFrame;
  const date = dateFromJd(clock.jd);
  $('stardate').textContent = `${shipDate(date)} · ${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
  if (document.activeElement !== dateIn) dateIn.value = isoDay(date);
  const m = system.model;

  const y = date.getUTCFullYear();
  const outOfRange = m?.isSol && settings.get('ephemeris') === 'kepler' && (y < VALID_RANGE.fromYear || y > VALID_RANGE.toYear);
  if (live.range) live.range.textContent = outOfRange ? `⚠ ${y} IS OUTSIDE THE KEPLER MODEL RANGE (1800–2050) — POSITIONS DEGRADE` : '';

  if (live.eph) {
    const hz = f?.horizonsStatus;
    live.eph.textContent = settings.get('ephemeris') === 'horizons'
      ? `JPL HORIZONS vectors, fetched on demand and stored locally${hz?.pending ? ` · LOADING ${hz.pending}` : ''}${hz?.failed ? ' · LINK FAILED, USING KEPLER FALLBACK' : ''}.`
      : 'Standish Keplerian elements (JPL) — offline, ≲0.3° error 1800–2050. Switch to JPL HORIZONS for ephemeris-grade positions.';
  }
  if (live.sky && f) {
    live.sky.textContent = f.skySource === 'catalogue'
      ? 'SKY: real stars brighter than magnitude 6.5 as seen from here (HYG).'
      : 'SKY: decorative backdrop (catalogue not loaded).';
  }

  if (['system', 'star', 'planet', 'moon', 'object'].includes(route.level) && route.body && m && (f || route.level === 'star')) {
    const id = route.body;
    const p = system.positionOf(id);
    const r = system.hostDistance(id);
    if (live.pos) live.pos.textContent = live.posKm ? `${fmt(r * AU_KM, 0)} KM` : `${fmt(r, r < 0.1 ? 4 : 3)} AU`;
    if (live.posTier) {
      const bb = m.bodies.find((x) => x.id === id);
      const src = bb?.kind === 'moon' ? 'Moon ephemeris (see ORBIT · POSITION).' : bb?.orbit?.type === 'elements' ? 'Two-body orbit from JPL SBDB elements.'
        : !m.isSol ? 'Keplerian orbit from Exoplanet Archive elements.'
        : f?.sources[id] === 'horizons' ? 'JPL Horizons ephemeris (DE441).' : 'Keplerian elements (Standish, JPL).';
      live.posTier.title = `${TIERS.computed.hint}\n${src}`;
    }
    let ref = r;
    if (live.earth) {
      const e = system.positionOf('earth');
      ref = Math.hypot(p[0] - e[0], p[1] - e[1], p[2] - e[2]);
      live.earth.textContent = `${fmt(ref)} AU · ${fmt((ref * AU_KM) / 1e6, 1)} M KM`;
    }
    if (live.light) live.light.textContent = r === 0 && !live.earth ? '—' : lightTime(ref);
    if (live.size) {
      const k = system.enhancementOf(id) ** (1 - (f?.scaleMix ?? 0));
      live.size.textContent = k > 1.5 ? `×${fmt(k, 0)} ENLARGED` : 'TRUE SCALE';
      live.size.nextSibling.style.visibility = k > 1.5 ? 'visible' : 'hidden';
    }
  }
}
setInterval(() => { tick(); if (route.level === 'satellite') satPanel.tick(); if (route.level === 'navigation') tickMessage(); }, 200);

// ---- edge beacon (per animation frame) ---------------------------------------------------
(function beaconLoop() {
  requestAnimationFrame(beaconLoop);
  const el = $('edge-beacon');
  const b = lastFrame?.beacon;
  const active = ['system', 'navigation', 'galaxy', 'satellite'].includes(route.level) && $('offline').hidden;
  if (!active || !b || b.visible || b.atFocus) { el.hidden = true; return; }
  let { x, y } = b;
  if (b.behind) { x = -x; y = -y; }
  const mx = Math.max(Math.abs(x), Math.abs(y)) || 1;
  x /= mx; y /= mx; // push to the viewport edge
  const vp = $('viewport').getBoundingClientRect();
  el.hidden = false;
  const inset = 70; // keep the label fully inside the viewport
  el.style.left = `${inset + ((x + 1) / 2) * (vp.width - 2 * inset)}px`;
  el.style.top = `${inset / 2 + ((-y + 1) / 2) * (vp.height - inset)}px`;
  el.querySelector('.arrow').style.transform = `rotate(${Math.atan2(x, y)}rad)`;
})();

function syncBeacon() {
  const m = system.model;
  const away = currentSystem !== 'sol';
  $('beacon-sub').textContent = away && m && m.id === currentSystem ? `${fmt(m.distLy, 1)} LY` : away ? 'RETURN' : 'HOME';
}

// ---- routing ----------------------------------------------------------------------------------
onRoute(async (r) => {
  const prev = route;
  route = r;
  lastFrame = null;
  syncRail();
  if (r.level !== 'satellite') satPanel.closeViewer();
  if (r.level === 'system' && r.body?.startsWith('sat-')) return go({ level: 'satellite', system: 'sol', body: r.body.slice(4) });
  if (r.level === 'satellite') {
    nav.hide(); starView.hide(); galaxy.hide(); planetView.hide();
    $('offline').hidden = true;
    system.show();
    if (!(await ensureSystem('sol')) || route !== r) return;
    if (prev.level !== 'satellite' || prev.body !== r.body) warp();
    const b = await satPanel.show(r.body);
    if (route !== r) return;
    $('view-title').textContent = `SATELLITE VIEW · ${b ? b.name : r.body}`;
    syncBeacon();
    return;
  }
  if (r.level === 'system') {
    nav.hide();
    starView.hide();
    galaxy.hide();
    planetView.hide();
    $('offline').hidden = true;
    system.show();
    const fresh = system.model?.id !== r.system;
    if (fresh && r.system !== 'sol') warp();
    if (!(await ensureSystem(r.system)) || route !== r) return;
    const m = system.model;
    const body = r.body && m.bodies.find((b) => b.id === r.body);
    $('view-title').textContent = `SYSTEM VIEW · ${m.name.toUpperCase()}${body ? ` · ${body.name.toUpperCase()}` : ''}`;
    syncBeacon();
    if (body) {
      if (fresh || prev.body !== r.body || prev.level !== 'system') { if (!fresh) warp(); system.focus(body.id); }
      renderBodyPanel(body.id);
    } else {
      if (!fresh && (prev.body || prev.level !== 'system')) system.overview(m.survey[0].au, m.survey[0].centre);
      renderSystemPanel();
    }
    syncRail();
  } else if (r.level === 'star') {
    nav.hide();
    system.hide();
    planetView.hide();
    galaxy.hide();
    $('offline').hidden = true;
    if (!(await ensureSystem(r.system)) || route !== r) return;
    const m = system.model;
    const b = m.bodies.find((x) => x.id === r.body && (x.starLike || x.kind === 'star')) ?? m.bodies.find((x) => x.id === m.starId);
    $('view-title').textContent = `STAR VIEW · ${b.name.toUpperCase()}`;
    syncBeacon();
    starView.show();
    starView.load(b, { isSun: m.isSol, systemName: m.name });
    renderBodyPanel(b.id, { inStarView: true });
    const noTemplate = b.kind === 'white dwarf' || b.kind === 'brown dwarf';
    if (!noTemplate) fetchSpectrum(b.spectral, b.metallicity).then((sp) => { if (route === r) starView.setSpectrum(sp); });
    syncRail();
  } else if (r.level === 'planet' || r.level === 'moon' || r.level === 'object') {
    nav.hide();
    system.hide();
    starView.hide();
    galaxy.hide();
    $('offline').hidden = true;
    if (!(await ensureSystem(r.system)) || route !== r) return;
    const m = system.model;
    const b = m.bodies.find((x) => x.id === r.body && !(x.starLike || x.kind === 'star'));
    if (!b) return go({ level: 'system', system: m.id });
    if (detailLevel(b) !== r.level) return go({ level: detailLevel(b), system: m.id, body: b.id });
    $('view-title').textContent = `${r.level.toUpperCase()} VIEW · ${b.name.toUpperCase()}`;
    syncBeacon();
    planetView.show();
    planetView.load(b, { isSol: m.isSol, systemName: m.name });
    renderBodyPanel(b.id, { inStarView: true });
    syncRail();
  } else if (r.level === 'galaxy') {
    system.hide(); nav.hide(); starView.hide(); planetView.hide();
    $('offline').hidden = true;
    $('view-title').textContent = 'GALAXY VIEW · MILKY WAY';
    $('beacon-sub').textContent = currentSystem === 'sol' ? 'HOME' : 'RETURN';
    galaxy.show();
    renderGalaxyPanel();
    if (!galaxyStarsLoaded) { galaxyStarsLoaded = true; fetchGalaxyStars().then((d) => galaxy.setStars(d)); }
  } else if (r.level === 'navigation') {
    system.hide();
    starView.hide();
    planetView.hide();
    galaxy.hide();
    nav.show();
    if (!r.system) return go({ level: 'navigation', system: currentSystem });
    $('view-title').textContent = 'NAVIGATION';
    currentSystem = r.system;
    syncBeacon();
    showNavigation(r.system);
  } else {
    system.hide();
    nav.hide();
    starView.hide();
    galaxy.hide();
    planetView.hide();
    const info = ROADMAP[r.level];
    $('view-title').textContent = `${r.level.toUpperCase()} VIEW`;
    $('beacon-sub').textContent = 'RETURN';
    overlay(`${r.level.toUpperCase()} VIEW`, info.blurb, [
      h('p', { className: 'note', textContent: `SUBSYSTEM OFFLINE · ${info.status}` }),
      pill('◆ RETURN TO SECTOR 001', () => go({ level: 'system', system: 'sol' })),
    ]);
    renderOfflinePanel(r.level);
  }
});
