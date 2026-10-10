// USS Fidelity — bridge console. Wires the LCARS shell, router, clock and views.

import { createClock, RATES } from './astro/clock.js';
import { shipDate, dateFromJd, jdFromDate, isoDay } from './astro/time.js';
import { VALID_RANGE } from './astro/kepler.js';
import { createSystemView, enhancement } from './views/system/SystemView.js';
import { BODIES, byId, LIGHT_SECONDS_PER_AU, AU_KM } from './data/sol.js';
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

const clock = createClock();
let route = { level: 'system', system: 'sol', body: null };
let lastFrame = null;

// ---- views -------------------------------------------------------------------------
const system = createSystemView($('system-view'), {
  clock,
  onSelect: (id) => go({ level: 'system', system: 'sol', body: id }),
  onFrame: (f) => { lastFrame = f; },
});

// ---- rail ----------------------------------------------------------------------------
const LEVEL_BUTTONS = [
  ['universe', 'UNIVERSE', 'var(--rose)'], ['galaxy', 'GALAXY', 'var(--lilac)'],
  ['quadrant', 'QUADRANT', 'var(--apricot)'], ['navigation', 'NAVIGATION', 'var(--gold)'],
  ['system', 'SYSTEM', 'var(--peach)'],
];
const SUB_BUTTONS = [['star', 'STAR'], ['planet', 'PLANET'], ['moon', 'MOON'], ['satellite', 'SATELLITE'], ['object', 'OBJECT']];

const railLevels = $('rail-levels');
for (const [id, label, c] of LEVEL_BUTTONS) {
  const live = id === 'system';
  const b = h('button', { className: `rail-btn${live ? '' : ' dormant'}`, title: live ? '' : 'Subsystem offline' },
    h('small', { textContent: String(LEVEL_BUTTONS.findIndex((x) => x[0] === id) + 1).padStart(2, '0') }), label);
  b.style.setProperty('--c', c);
  b.dataset.level = id;
  b.addEventListener('click', () => go({ level: id }));
  railLevels.append(b);
}
const railSubs = $('rail-subviews');
for (const [id, label] of SUB_BUTTONS) {
  const b = h('button', { className: 'rail-btn sub dormant' }, label);
  b.dataset.sub = id;
  b.addEventListener('click', () => {
    if (id === 'star') return go({ level: 'system', system: 'sol', body: 'sun' });
    toast(`${label} VIEW OFFLINE — ${ROADMAP[id].status}`);
  });
  railSubs.append(b);
}
// Star sub-view currently means "focus the star inside System View".
railSubs.querySelector('[data-sub="star"]').classList.remove('dormant');

function syncRail() {
  for (const b of railLevels.children) b.classList.toggle('active', b.dataset.level === route.level);
  railSubs.querySelector('[data-sub="star"]').classList.toggle('active', route.level === 'system' && route.body === 'sun');
}

// ---- toast & warp -----------------------------------------------------------------------
let toastTimer;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 3200);
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
const dateIn = h('input', { type: 'date', title: 'Jump to date (UTC)' });
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
if (import.meta.env.VITE_STANDALONE) {
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

// ---- panel ------------------------------------------------------------------------------
const panel = $('panel');
const live = {}; // element refs refreshed by the ticker; reset whenever the panel is rebuilt
const resetLive = () => { for (const k of Object.keys(live)) delete live[k]; };

const fmt = (n, d = 3) => n.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });
const fmtSci = (n) => n.toExponential(3).replace('e+', ' × 10^');
const lightTime = (au) => {
  const s = au * LIGHT_SECONDS_PER_AU;
  return s < 120 ? `${fmt(s, 1)} S` : s < 7200 ? `${fmt(s / 60, 1)} MIN` : `${fmt(s / 3600, 2)} H`;
};

function row(dl, label, value, tier, detail) {
  const dd = h('dd', { textContent: value });
  dl.append(h('dt', { textContent: label }), dd, tier ? badge(tier, detail) : h('span'));
  return dd;
}

function renderLegend() {
  return h('div', {},
    h('h3', { textContent: 'DATA PROVENANCE' }),
    h('div', { className: 'legend' }, Object.keys(TIERS).map((t) => badge(t))),
    h('p', { className: 'note', textContent: 'Every value is tagged. Hover a badge for what it means.' }));
}

function renderSystemPanel() {
  resetLive();
  panel.replaceChildren(
    h('h2', { textContent: 'SOL' }),
    h('div', { className: 'kind', textContent: 'SECTOR 001 · G2V MAIN-SEQUENCE STAR · 9 MAJOR BODIES' }),
    h('h3', { textContent: 'BODIES' }),
    h('div', { className: 'body-list' }, BODIES.map((b) => pill(b.name.toUpperCase(), () => go({ level: 'system', system: 'sol', body: b.id })))),
    h('h3', { textContent: 'SURVEY' }),
    h('div', { className: 'body-list' },
      pill('INNER SYSTEM', () => { warp(); system.overview(4.2); }),
      pill('OUTER SYSTEM', () => { warp(); system.overview(80); })),
    h('h3', { textContent: 'EPHEMERIS' }),
    (live.eph = h('p', { className: 'note' })),
    (live.range = h('p', { className: 'warn' })),
    renderLegend(),
  );
}

function renderBodyPanel(id) {
  resetLive();
  const b = byId[id];
  const dl = h('dl');
  live.pos = row(dl, 'FROM SOL', '—', 'computed');
  live.posTier = dl.lastChild;
  if (id !== 'earth') live.earth = row(dl, 'FROM EARTH', '—', 'computed');
  live.light = row(dl, 'LIGHT TIME', '—', 'computed', 'Light travel time from Earth (or from Sol, for Earth).');
  const phys = h('dl');
  row(phys, 'RADIUS', `${fmt(b.radiusKm, 1)} KM`, 'measured', 'NASA fact sheet (mean radius).');
  row(phys, 'MASS', `${fmtSci(b.massKg)} KG`, 'measured', 'Derived from the gravitational pull on moons & spacecraft.');
  if (b.gravity) row(phys, 'SURFACE G', `${b.gravity} M/S²`, 'measured');
  row(phys, 'DAY (SIDEREAL)', `${fmt(Math.abs(b.rotationHours), 2)} H${b.rotationHours < 0 ? ' · RETROGRADE' : ''}`, 'measured');
  if (b.periodDays) row(phys, 'YEAR', `${fmt(b.periodDays, b.periodDays < 1000 ? 1 : 0)} DAYS`, 'measured');
  if (b.meanTempC != null) row(phys, 'MEAN TEMP', `${b.meanTempC} °C`, 'measured');
  if (b.teffK) row(phys, 'SURFACE TEMP', `${b.teffK} K`, 'measured');
  if (b.spectral) row(phys, 'CLASS', b.spectral, 'measured');
  row(phys, 'SPIN AXIS', `RA ${b.pole[0]}° DEC ${b.pole[1]}°`, 'measured', 'IAU WGCCRE pole orientation.');

  const look = h('dl');
  row(look, 'APPEARANCE', 'STYLISED', 'imagined', 'Colours are stand-ins; Planet View will load NASA imagery.');
  live.size = row(look, 'SIZE ON SCREEN', '—', 'imagined', 'Enhanced scale enlarges bodies so they are visible.');

  panel.replaceChildren(
    h('h2', { textContent: b.name.toUpperCase() }),
    h('div', { className: 'kind', textContent: `SECTOR 001 · ${b.kind.toUpperCase()}` }),
    h('h3', { textContent: 'POSITION' }), dl,
    h('h3', { textContent: 'PHYSICAL' }), phys,
    h('h3', { textContent: 'RENDERING' }), look,
    (live.range = h('p', { className: 'warn' })),
    h('div', { className: 'body-list' },
      pill('◀ SYSTEM', () => go({ level: 'system', system: 'sol' })),
      b.kind === 'star' ? pill('STAR VIEW', () => toast(`STAR VIEW OFFLINE — ${ROADMAP.star.status}`)) :
        pill('PLANET VIEW', () => toast(`PLANET VIEW OFFLINE — ${ROADMAP.planet.status}`))),
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

// ---- live ticker (≈5 Hz) -----------------------------------------------------------------
function tick() {
  const f = lastFrame;
  const date = dateFromJd(clock.jd);
  $('stardate').textContent = `${shipDate(date)} · ${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
  if (document.activeElement !== dateIn) dateIn.value = isoDay(date);

  const y = date.getUTCFullYear();
  const outOfRange = settings.get('ephemeris') === 'kepler' && (y < VALID_RANGE.fromYear || y > VALID_RANGE.toYear);
  if (live.range) live.range.textContent = outOfRange ? `⚠ ${y} IS OUTSIDE THE KEPLER MODEL RANGE (1800–2050) — POSITIONS DEGRADE` : '';

  if (live.eph) {
    const hz = f?.horizonsStatus;
    live.eph.textContent = settings.get('ephemeris') === 'horizons'
      ? `JPL HORIZONS vectors, fetched on demand and stored locally${hz?.pending ? ` · LOADING ${hz.pending}` : ''}${hz?.failed ? ' · LINK FAILED, USING KEPLER FALLBACK' : ''}.`
      : 'Standish Keplerian elements (JPL) — offline, ≲0.3° error 1800–2050. Switch to JPL HORIZONS for ephemeris-grade positions.';
  }

  if (route.level === 'system' && route.body && f) {
    const id = route.body;
    const p = system.positionOf(id);
    const rSun = Math.hypot(...p);
    if (live.pos) live.pos.textContent = id === 'sun' ? '0 AU · ORIGIN' : `${fmt(rSun)} AU`;
    if (live.posTier) {
      const src = f.sources[id] === 'horizons' ? 'JPL Horizons ephemeris (DE441).' : 'Keplerian elements (Standish, JPL).';
      live.posTier.title = `${TIERS.computed.hint}\n${src}`;
    }
    let ref = rSun;
    if (live.earth) {
      const e = system.positionOf('earth');
      ref = Math.hypot(p[0] - e[0], p[1] - e[1], p[2] - e[2]);
      live.earth.textContent = `${fmt(ref)} AU · ${fmt((ref * AU_KM) / 1e6, 1)} M KM`;
    }
    if (live.light) live.light.textContent = lightTime(ref);
    if (live.size) {
      const k = enhancement(byId[id]) ** (1 - f.scaleMix);
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
  const f = lastFrame;
  if (route.level !== 'system' || !f || f.sun.visible || f.focusId === 'sun') { el.hidden = true; return; }
  let { x, y } = f.sun;
  if (f.sun.behind) { x = -x; y = -y; }
  const m = Math.max(Math.abs(x), Math.abs(y)) || 1;
  x /= m; y /= m; // push to the viewport edge
  const vp = $('viewport').getBoundingClientRect();
  el.hidden = false;
  const inset = 70; // keep the label fully inside the viewport
  el.style.left = `${inset + ((x + 1) / 2) * (vp.width - 2 * inset)}px`;
  el.style.top = `${inset / 2 + ((-y + 1) / 2) * (vp.height - inset)}px`;
  el.querySelector('.arrow').style.transform = `rotate(${Math.atan2(x, y)}rad)`;
})();

// ---- routing ----------------------------------------------------------------------------------
onRoute((r) => {
  const prev = route;
  route = r;
  syncRail();
  const offline = $('offline');
  if (r.level === 'system') {
    offline.hidden = true;
    system.show();
    $('view-title').textContent = `SYSTEM VIEW · SOL${r.body ? ` · ${byId[r.body]?.name.toUpperCase() ?? ''}` : ''}`;
    $('beacon-sub').textContent = 'HOME';
    if (r.body && byId[r.body]) {
      if (prev.body !== r.body || prev.level !== 'system') { warp(); system.focus(r.body); }
      renderBodyPanel(r.body);
    } else {
      if (prev.body || prev.level !== 'system' || !prev.initialised) system.overview(4.2);
      renderSystemPanel();
    }
  } else {
    system.hide();
    const info = ROADMAP[r.level];
    $('view-title').textContent = `${r.level.toUpperCase()} VIEW`;
    $('beacon-sub').textContent = 'RETURN';
    offline.hidden = false;
    offline.replaceChildren(
      h('h2', { textContent: `${r.level.toUpperCase()} VIEW` }),
      h('p', { textContent: info.blurb }),
      h('p', { className: 'note', textContent: `SUBSYSTEM OFFLINE · ${info.status}` }),
      pill('◆ RETURN TO SECTOR 001', () => go({ level: 'system', system: 'sol' })),
    );
    renderOfflinePanel(r.level);
  }
  route.initialised = true;
});
