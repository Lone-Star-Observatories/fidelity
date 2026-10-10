// USS Fidelity — bridge console. Wires the LCARS shell, router, clock and views.

import { createClock } from './astro/clock.js';
import { shipDate, dateFromJd, jdFromDate, isoDay } from './astro/time.js';
import { VALID_RANGE } from './astro/kepler.js';
import { LY_PER_PC } from './astro/frames.js';
import { createSystemView } from './views/system/SystemView.js';
import { createNavigationView } from './views/navigation/NavigationView.js';
import { createStarView } from './views/star/StarView.js';
import { createPlanetView } from './views/planet/PlanetView.js';
import { LIGHT_SECONDS_PER_AU, AU_KM } from './data/sol.js';
import { solSystem, buildStarSystem } from './data/systems.js';
import { fetchNearby, fetchStar, fetchSky, fetchTextureCredits, fetchSpectrum } from './data/catalog.js';
import { badge, TIERS } from './data/provenance.js';
import { settings } from './settings.js';
import { onRoute, go } from './router.js';
import { ROADMAP } from './roadmap.js';

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
  onFrame: (f) => { if (route.level === 'system') lastFrame = f; },
});
const starView = createStarView($('star-view'));
const planetView = createPlanetView($('planet-view'));
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
const LIVE_LEVELS = new Set(['navigation', 'system']);
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
  const b = h('button', { className: `rail-btn sub${id === 'star' || id === 'planet' ? '' : ' dormant'}` }, label);
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
    toast(`${label} VIEW OFFLINE — ${ROADMAP[id].status}`);
  });
  railSubs.append(b);
}

function syncRail() {
  for (const b of railLevels.children) b.classList.toggle('active', b.dataset.level === route.level);
  railSubs.querySelector('[data-sub="star"]').classList.toggle('active', route.level === 'star');
  railSubs.querySelector('[data-sub="planet"]').classList.toggle('active', route.level === 'planet');
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
  h('div', { className: 'ctl-group' }, flag('labels', 'LABELS'), flag('orbits', 'ORBITS')),
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

const sectorName = (m) => (m.isSol ? 'SECTOR 001' : `${fmt(m.distLy, 1)} LY FROM SOL`);

// ---- system panels ----------------------------------------------------------------------
function renderSystemPanel() {
  resetLive();
  const m = system.model;
  panel.replaceChildren(
    h('h2', { textContent: m.name.toUpperCase() }),
    h('div', { className: 'kind', textContent: m.subtitle }),
    h('h3', { textContent: 'BODIES' }),
    h('div', { className: 'body-list' }, m.bodies.map((b) => pill(b.name.toUpperCase(), () => go({ level: 'system', system: m.id, body: b.id })))),
    h('h3', { textContent: 'SURVEY' }),
    h('div', { className: 'body-list' },
      m.survey.map((s) => pill(s.label, () => { warp(); system.overview(s.au, s.centre); })),
      pill('NAVIGATION ▸', () => go({ level: 'navigation', system: m.id }))),
    ...(m.isSol ? [
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

function renderBodyPanel(id, { inStarView = false } = {}) { // inStarView: any detail view
  resetLive();
  const m = system.model;
  const b = m.bodies.find((x) => x.id === id);
  const isStar = !!(b.starLike || b.kind === 'star');
  const star = m.bodies.find((x) => x.id === (b.orbit?.host ?? m.starId)) ?? m.bodies[0];
  const pos = h('dl');
  if (!isStar) live.pos = row(pos, `FROM ${star.name.toUpperCase()}`, '—', 'computed');
  live.posTier = pos.lastChild;
  if (m.isSol && id !== 'earth') live.earth = row(pos, 'FROM EARTH', '—', 'computed');
  live.light = row(pos, m.isSol ? 'LIGHT TIME' : 'STARLIGHT TRAVEL', '—', 'computed',
    m.isSol ? 'Light travel time from Earth (or from Sol, for Earth).' : 'Time for light to reach this world from its star.');
  if (isStar) {
    pos.replaceChildren();
    if (m.multiplicity > 1) live.pos = row(pos, 'FROM BARYCENTRE', '—', 'computed', 'Distance from the centre of mass of the whole star system, from the ORB6 orbits.');
    else row(pos, 'POSITION', 'SYSTEM CENTRE', 'computed');
  }

  const groups = Object.entries(b.facts || {}).filter(([, f]) => f.length);
  const look = h('dl');
  live.size = row(look, 'SIZE ON SCREEN', '—', 'imagined', 'Enhanced scale enlarges bodies so they are visible.');

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
        pill('PLANET VIEW ▸', () => go({ level: 'planet', system: m.id, body: b.id }))),
    renderLegend(),
  );
}

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
    row(dl, 'CATALOGUE', sel.archiveOnly ? 'EXOPLANET ARCHIVE' : 'HYG v4.4', 'measured', sel.archiveOnly ? 'Too faint for HYG; position from the Exoplanet Archive.' : 'Hipparcos / Yale / Gliese compilation.');
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

  if (['system', 'star', 'planet'].includes(route.level) && route.body && m && (f || route.level === 'star')) {
    const id = route.body;
    const p = system.positionOf(id);
    const r = system.hostDistance(id);
    if (live.pos) live.pos.textContent = `${fmt(r, r < 0.1 ? 4 : 3)} AU`;
    if (live.posTier) {
      const src = !m.isSol ? 'Keplerian orbit from Exoplanet Archive elements.'
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
setInterval(tick, 200);

// ---- edge beacon (per animation frame) ---------------------------------------------------
(function beaconLoop() {
  requestAnimationFrame(beaconLoop);
  const el = $('edge-beacon');
  const b = lastFrame?.beacon;
  const active = (route.level === 'system' || route.level === 'navigation') && $('offline').hidden;
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
  if (r.level === 'system') {
    nav.hide();
    starView.hide();
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
    $('offline').hidden = true;
    if (!(await ensureSystem(r.system)) || route !== r) return;
    const m = system.model;
    const b = m.bodies.find((x) => x.id === r.body && (x.starLike || x.kind === 'star')) ?? m.bodies.find((x) => x.id === m.starId);
    $('view-title').textContent = `STAR VIEW · ${b.name.toUpperCase()}`;
    syncBeacon();
    starView.show();
    starView.load(b, { isSun: m.isSol, systemName: m.name });
    renderBodyPanel(b.id, { inStarView: true });
    const isWD = b.kind === 'white dwarf';
    if (!isWD) fetchSpectrum(b.spectral, b.metallicity).then((sp) => { if (route === r) starView.setSpectrum(sp); });
    syncRail();
  } else if (r.level === 'planet') {
    nav.hide();
    system.hide();
    starView.hide();
    $('offline').hidden = true;
    if (!(await ensureSystem(r.system)) || route !== r) return;
    const m = system.model;
    const b = m.bodies.find((x) => x.id === r.body && !(x.starLike || x.kind === 'star'));
    if (!b) return go({ level: 'system', system: m.id });
    $('view-title').textContent = `PLANET VIEW · ${b.name.toUpperCase()}`;
    syncBeacon();
    planetView.show();
    planetView.load(b, { isSol: m.isSol, systemName: m.name });
    renderBodyPanel(b.id, { inStarView: true });
    syncRail();
  } else if (r.level === 'navigation') {
    system.hide();
    starView.hide();
    planetView.hide();
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
