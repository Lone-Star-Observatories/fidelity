// USS Fidelity — bridge console. Wires the LCARS shell, router, clock and views.

import { createClock, STEP_UNITS, yearsLimit, calendarLimit } from './astro/clock.js';
import { formatOffset } from './astro/timerate.js';
import { shipDate, dateFromJd, jdFromDate, isoDay } from './astro/time.js';
import { VALID_RANGE } from './astro/kepler.js';
import { LY_PER_PC } from './astro/frames.js';
import { createSystemView } from './views/system/SystemView.js';
import { createNavigationView } from './views/navigation/NavigationView.js';
import { createStarView } from './views/star/StarView.js';
import { createPlanetView } from './views/planet/PlanetView.js';
import { detailCards } from './panels/detail.js';
import { spacecraftComms } from './panels/comms.js';
import { captureWhenReady } from './panels/surface.js';
import { createGalaxyView, R0_KLY, IMAGE } from './views/galaxy/GalaxyView.js';
import { GALACTIC_YEAR_MYR, OMEGA_PATTERN, OMEGA_SUN, VC_KMS } from './astro/galaxy.js';
import { createQuadrantView, NEBULA_COLORS, ageTeff } from './views/quadrant/QuadrantView.js';
import { createUniverseView, typeName, MLY_PER_MPC, MOTION } from './views/universe/UniverseView.js';
import { NEBULA_KIND } from './data/deepsky.js';
import { blackbodyRGB, rgbToHex } from './astro/frames.js';
import { LIGHT_SECONDS_PER_AU, AU_KM } from './data/sol.js';
import { solSystem, buildStarSystem } from './data/systems.js';
import { fetchNearby, fetchStar, fetchSky, fetchTextureCredits, fetchSpectrum, fetchGalaxyStars, fetchSmallBodies, fetchClusters, fetchGalaxies, fetchPlanets, fetchGaiaBright, fetchStarLookup, fetchStarSearch } from './data/catalog.js';
import { badge, TIERS } from './data/provenance.js';
import { shownScale, scaleDetail } from './data/bandarchive.js';
import { DETAIL_LEVELS, DETAIL_MAX, DETAIL_FLAGS, flagsForLevel, levelOfFlags } from './data/detail.js';
import { settings } from './settings.js';
import { onRoute, go } from './router.js';
import { onBookmark, onPostcard } from './views/cameraControls.js';
import { createPostcard } from './panels/postcard.js';
import { liveInfo } from './views/system/materials.js';
import { encodeCamera, decodeCamera } from './views/cameraMath.js';
import { ROADMAP } from './roadmap.js';
import { createSatellitePanel } from './panels/satellite.js';
import { createSitesPanel } from './panels/sites.js';
import { createNavList } from './panels/navlist.js';
import { LAGRANGE_EXPLAINER, lagrangeDiagram } from './panels/explainers.js';
import { createStarCard } from './panels/starcard.js';
import { deepSkyDetail } from './panels/deepsky.js';
import { earthPole, moonAxes, poleStar, obliquityDeg } from './astro/orientation.js';
import { moonGeocentric } from './astro/moons.js';
import { spiralAngleDeg, SOLAR } from './views/system/solarfield.js';
import { fmtYear, span, humanScale, LIFETIME_YEARS } from './data/lighttime.js';
import { POP_COLORS } from './views/system/belts.js';
import { fetchDsn, ephemerisEnd } from './data/spacecraft-ephem.js';
import { createSkyEventsPanel } from './panels/skyevents.js';
import { createTimeControl } from './panels/timecontrol.js';
import { collapsibleSections } from './panels/collapse.js';
import { createEventsPanel } from './panels/events.js';
import { createTransferPanel } from './panels/transfer.js';
import { createFuturePanel } from './panels/future.js';
import { createFutureEventsPanel } from './panels/futureevents.js';
import { createEarthTimelinePanel } from './panels/earthtimeline.js';
import { createMagneticPanel } from './panels/magnetic.js';
import { createSearch } from './panels/search.js';
import { createCommsView } from './views/comms/CommsView.js';
import { PLANETSHINE } from './astro/planetshine.js';
import { FUTURE_MISSIONS } from './data/future-missions.js';
import { SITES } from './data/sites.js';
import { loadEvents, onEvents, eventsFeed } from './data/events.js';
import { satrecFromRow } from './astro/sgp4.js';
import { requestEvents } from './data/skyevents.js';
import { loadedRows, earthFromHorizons, preloadMonth } from './data/horizons.js';
import { useEarthEphemeris } from './astro/eclipses.js';
import { createComputer } from './voice/computer.js';
import { BANDS, bandById, passById } from './data/bands.js';
import { setCurrentBand, setCurrentCurve, currentBand, onBand } from './data/bandstate.js';
import { typeBandNote } from './astro/galaxyband.js';
import { curveFromLegacy, normCurve, canonical, describeCurve, fmtRange } from './data/curve.js';
import { createSpectrumControl, resText } from './panels/spectrum.js';
import { bandLoads, configureBandLoads } from './data/bandload.js';
import { onBandRes, prefetchPreviews } from './views/system/bandtextures.js';

const $ = (id) => document.getElementById(id);
const h = (tag, props = {}, ...kids) => {
  const el = Object.assign(document.createElement(tag), props);
  for (const k of kids.flat()) if (k != null) el.append(k);
  return el;
};
const STANDALONE = import.meta.env.MODE === 'standalone';

const clock = createClock();
// ?t=2027-08-02T10:06:38Z sets the ship's clock (shareable moments; ?hold to freeze it there)
{
  const q = new URLSearchParams(location.search), t = Date.parse(q.get('t') ?? '');
  if (Number.isFinite(t)) { clock.set(jdFromDate(new Date(t))); if (q.has('hold')) clock.toggleHold(); }
}
let route = { level: 'system', system: 'sol', body: null };
let lastFrame = null;
let currentSystem = 'sol'; // the system the ship is "in"; Navigation looks outward from it
let navRadius = 25;

// ---- views -------------------------------------------------------------------------
const system = createSystemView($('system-view'), {
  clock,
  onSelect: (id) => go({ level: 'system', system: currentSystem, body: id }),
  onFeature: (f) => { const b = system.model?.bodies.find((x) => x.id === f.body); if (b) sitesPanel.show({ ...f, kind: 'feature', tier: 'measured', url: f.gazetteerId ? `https://planetarynames.wr.usgs.gov/Feature/${f.gazetteerId}` : null,
    short: f.name.toUpperCase(), note: `${f.type}${f.diameterKm ? `, ${f.diameterKm.toLocaleString()} km across` : ''}. Its name is approved by the International Astronomical Union.` }, b); },
  onSite: (site) => { const b = system.model?.bodies.find((x) => x.id === site.body); if (b) sitesPanel.show(site, b); },
  onPickStar: (p) => pickStarIn('system', p),
  onDrillStar: (id) => go({ level: 'star', system: currentSystem, body: id }),
  onDeepSky: (o) => deepSkyCard(o), // #48: a deep-sky object clicked on the surface view's sky
  onFrame: (f) => { if (route.level === 'system' || route.level === 'satellite') lastFrame = f; },
});
const starView = createStarView($('star-view'));
// Double-click a planet's globe: stand at that spot in the System View, looking up (#19, #23).
let pendingSurface = null;
let pendingSiteView = null; // VIEW FROM ABOVE a site once its body is framed (#37)
// ?surface=25.7,32.65 stands on the routed body there (e.g. #/system/sol/earth) once it is framed; &look=sun turns to the Sun
{
  const sf = new URLSearchParams(location.search).get('surface')?.split(',').map(Number);
  const id = location.hash.split('/').filter(Boolean)[3];
  if (sf?.length === 2 && sf.every(Number.isFinite) && id) pendingSurface = { id, lat: sf[0], lon: sf[1], lookSun: new URLSearchParams(location.search).get('look') === 'sun' };
}
const planetView = createPlanetView($('planet-view'), {
  onSurface: (id, lat, lon) => { pendingSurface = { id, lat, lon }; go({ level: 'system', system: currentSystem, body: id }); },
});
// FROM THE SURFACE (#36): stand at a picture's site, or render the view there (opts.render captures it)
const surfaceHooks = {
  stand: (id, lat, lon, opts = {}) => { pendingSurface = { id, lat, lon, ...opts }; go({ level: 'system', system: currentSystem, body: id }); },
  mark: (id, list) => planetView.setSurfaceMarks(id, list),
};
const galaxy = createGalaxyView($('galaxy-view'), {
  onFrame: (f) => { if (route.level === 'galaxy') lastFrame = f; },
  onPickStar: (p) => pickStarIn('galaxy', p),
  onDrill: (p) => (p?.id ? go({ level: 'navigation', system: p.id }) : go({ level: 'quadrant' })), // drill down (#23)
});
let galaxyStarsLoaded = false;
const quadrant = createQuadrantView($('quadrant-view'), {
  onSelect: (id) => { quadrantSel = id; quadrant.select(id); renderQuadrantPanel(); },
  onPickStar: (p) => pickStarIn('quadrant', p),
  onDrill: (p) => go({ level: 'navigation', system: p?.id ?? 'sol' }),
  onDetail: () => { if (route.level === 'quadrant') renderQuadrantPanel(); }, // a nebula image or member list arrived (#24)
});
const universe = createUniverseView($('universe-view'), { onSelect: (id) => { universeSel = id; universe.select(id); renderUniversePanel(); }, onDrill: () => go({ level: 'galaxy' }) });
let quadrantSel = null, universeSel = null, quadrantLoaded = false, universeLoaded = false;
const nav = createNavigationView($('navigation-view'), {
  onSelect: (id) => selectNavStar(id),
  onDrill: (id) => go({ level: 'system', system: id }),
  onFrame: (f) => { if (route.level === 'navigation') lastFrame = f; },
  onArrivals: (st) => { if (route.level === 'navigation' && !st?.loading) renderNavPanel(); }, // deep-time arrivals loaded (#29)
});

// ---- rail ----------------------------------------------------------------------------
const LEVEL_BUTTONS = [
  ['universe', 'UNIVERSE', 'var(--rose)'], ['galaxy', 'GALAXY', 'var(--lilac)'],
  ['quadrant', 'QUADRANT', 'var(--apricot)'], ['navigation', 'NAVIGATION', 'var(--gold)'],
  ['system', 'SYSTEM', 'var(--peach)'],
];
const LIVE_LEVELS = new Set(['universe', 'galaxy', 'quadrant', 'navigation', 'system']);
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

// EVENTS (#32/#33): the weekly events feed; a dot when something happens within 24 hours
const eventsBtn = h('button', { className: 'rail-btn sub events-btn', title: 'Launches, landings, dockings, spacewalks and sky events' }, 'EVENTS');
eventsBtn.dataset.sub = 'events';
eventsBtn.addEventListener('click', () => go({ level: 'events', system: 'sol' }));
railSubs.append(eventsBtn);
// FUTURE (#53): supernovae, stellar passes, impacts and the Sun's evolution
const futureBtn = h('button', { className: 'rail-btn sub', title: 'Future events: supernovae, close stellar passes, impact risks, the Sun\'s evolution' }, 'FUTURE');
futureBtn.dataset.sub = 'future';
futureBtn.addEventListener('click', () => go({ level: 'future', system: 'sol' }));
railSubs.append(futureBtn);
// EARTH TIMELINE (#54): climate, ice ages, orbital cycles, geology, impacts and the deep future
const timelineBtn = h('button', { className: 'rail-btn sub', title: 'Earth past and future: climate, ice ages, Milankovitch cycles, geology, impacts, the deep future' }, 'TIMELINE');
timelineBtn.dataset.sub = 'timeline';
timelineBtn.addEventListener('click', () => go({ level: 'timeline', system: 'sol' }));
railSubs.append(timelineBtn);

function syncRail() {
  for (const b of railLevels.children) b.classList.toggle('active', b.dataset.level === route.level);
  railSubs.querySelector('[data-sub="star"]').classList.toggle('active', route.level === 'star');
  for (const k of ['planet', 'moon', 'object', 'satellite', 'events', 'future', 'timeline']) railSubs.querySelector(`[data-sub="${k}"]`).classList.toggle('active', route.level === k);
}

// ---- camera bookmarks (#39) ---------------------------------------------------------------
// LINK (or B) puts the camera, its mode and the epoch in the URL: ?t=<ISO>[&hold]&cam=…[&surface=lat,lon]
// before the route's hash. Opening such a link applies the camera once its view has framed the route.
let pendingCam = (() => { const c = new URLSearchParams(location.search).get('cam'); return c ? decodeCamera(c) : null; })();
function applyPendingCam(rig) {
  if (!pendingCam || !rig) return;
  const c = pendingCam;
  pendingCam = null;
  rig.apply(c);
}
/** A URL that reopens this view: route, camera state (from a rig's state()), mode and epoch. */
function viewLink(state) {
  const q = new URLSearchParams(location.search);
  for (const k of ['cam', 'surface', 'look', 'hold', 't']) q.delete(k);
  q.set('t', dateFromJd(clock.jd).toISOString());
  if (clock.rate.days === 0) q.set('hold', '1');
  if (state.mode === 'surface') {
    const sp = system.surfaceSpot();
    if (sp) q.set('surface', `${sp.lat.toFixed(5)},${sp.lon.toFixed(5)}`);
  }
  q.set('cam', encodeCamera(state));
  return `${location.origin}${location.pathname}?${q.toString().replace(/%2C/g, ',').replace(/%3A/g, ':')}${location.hash}`;
}
onBookmark((state) => {
  const url = viewLink(state);
  try { history.replaceState(null, '', url); } catch { /* sandboxed frame */ }
  const done = () => toast('VIEW LINK COPIED · CAMERA, MODE AND EPOCH'), fail = () => toast('VIEW LINK IS IN THE ADDRESS BAR');
  try { navigator.clipboard.writeText(url).then(done, fail); } catch { fail(); }
});

// ---- postcards (#40) ------------------------------------------------------------------------
const SYSTEM_LEVELS = ['system', 'events', 'future', 'timeline', 'satellite'];
const viewOf = (lvl) => (SYSTEM_LEVELS.includes(lvl) ? system : lvl === 'star' ? starView : ['planet', 'moon', 'object'].includes(lvl) ? planetView
  : lvl === 'galaxy' ? galaxy : lvl === 'quadrant' ? quadrant : lvl === 'universe' ? universe : lvl === 'navigation' ? nav : null);
const latLonText = (lat, lon) => `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(2)}°${lon >= 0 ? 'E' : 'W'}`;
/** What the active view shows, for the postcard's stamps: place, provenance tiers, image credits, scene facts. */
function describePostcard() {
  const v = viewOf(route.level);
  if (!v?.snapshot) return null;
  const title = $('view-title').textContent || 'USS FIDELITY';
  const tiers = { measured: [], reported: [], computed: [], modelled: [], imagined: [] };
  const imgCredits = [], bodies = [];
  const titleCase = (t) => t.toLowerCase().replace(/(^|[\s(/-])(\p{L})/gu, (_, a, c) => a + c.toUpperCase());
  let place = title, subject = titleCase(title.split(' · ').slice(1).join(' · ') || title), lighting = null;
  if (v === system && system.model) {
    const m = system.model, surf = system.onSurface, focus = route.body && m.bodies.find((x) => x.id === route.body);
    const where = m.isSol ? 'the Solar System' : `the ${m.name} system`;
    subject = focus ? `${m.isSol && ['moon', 'sun'].includes(focus.id) ? 'The ' : ''}${focus.name} in ${where}` : where.charAt(0).toUpperCase() + where.slice(1);
    tiers.measured.push('STARS'); tiers.computed.push('POSITIONS');
    for (const f of system.framed?.(3) ?? []) {
      bodies.push(f.name);
      if (f.live) { tiers.measured.push('LIVE IMAGERY'); if (f.live.credit) imgCredits.push(f.live.credit); }
      else if (f.imagined) tiers.imagined.push(`${f.name.toUpperCase()}'S SURFACE`);
      else { tiers.measured.push('SURFACE MAPS'); if (credits[f.map]) imgCredits.push(credits[f.map]); }
    }
    if (surf) {
      const b = m.bodies.find((x) => x.id === surf.id), sp = system.surfaceSpot();
      const name = b ? (m.isSol && ['moon', 'sun'].includes(b.id) ? `the ${b.name}` : b.name) : surf.id;
      let lon = sp ? sp.lon + ((b?.texLon0 ?? -180) + 180) : null;
      if (lon > 180) lon -= 360;
      place = `STANDING ON ${name.toUpperCase()}${sp ? ` · ${latLonText(sp.lat, lon)}` : ''}`;
      subject = `From the surface of ${name}${sp ? `, ${latLonText(sp.lat, lon)}` : ''}`;
      tiers.imagined.push('SURFACE');
      lighting = 'as rendered: the Sun\'s position and every phase come from the ship\'s clock';
      if (settings.get('deepsky')) imgCredits.push('Deep-sky images: DSS2 (STScI/AURA) and others, credited per object in the app');
    } else if (settings.get('scale') !== 'true') tiers.imagined.push('BODY SIZES (ENLARGED)');
    const pf = system.postcardFacts ?? {};
    if (pf.paleo) tiers.modelled.push('PAST EARTH');
    if (pf.scenario?.length) tiers.modelled.push('SCENARIO');
    if (settings.get('band') && settings.get('band') !== 'full') tiers.measured.push(`${String(settings.get('band')).toUpperCase()} BAND`);
  } else if (v === galaxy || v === quadrant) {
    tiers.measured.push('STARS'); tiers.modelled.push('MILKY WAY MODEL');
    if (settings.get('galaxyArt')) { tiers.imagined.push("ARTIST'S FACE-ON MILKY WAY"); imgCredits.push('NASA/JPL-Caltech/R. Hurt (SSC/Caltech), PIA10748'); }
  } else if (v === universe) {
    tiers.measured.push('GALAXY POSITIONS'); tiers.measured.push('GALAXY IMAGES');
    imgCredits.push('Digitized Sky Survey 2 (POSS-II / UK Schmidt; STScI/AURA) and 2MASS (UMass/IPAC-Caltech, NASA/NSF), via CDS hips2fits');
  } else if (v === nav) {
    tiers.measured.push('STARS'); tiers.computed.push('ORBITS');
  } else if (v === starView) {
    const b = system.model?.bodies.find((x) => x.id === route.body);
    tiers.measured.push('STAR DATA');
    if (system.model?.isSol && (!b || b.id === system.model.starId)) { // the Sun: a solar map, or SDO's live disc
      tiers.measured.push('SOLAR DISC');
      const live = settings.get('liveSkins') && liveInfo.get('sdo-hmi');
      if (live?.credit) imgCredits.push(live.credit); else if (credits.sun) imgCredits.push(credits.sun);
    } else tiers.imagined.push('STAR SURFACE');
  } else if (v === planetView) {
    const b = system.model?.bodies.find((x) => x.id === route.body);
    if (b) bodies.push(b.name);
    if (b?.skin?.map && credits[b.skin.map] && !b.surfacePending) { tiers.measured.push('SURFACE MAP'); imgCredits.push(credits[b.skin.map]); }
    else tiers.imagined.push('SURFACE');
  }
  if (!clock.isNow) tiers.computed.push('SKY AT THE SHIP\'S DATE');
  const date = clock.inCalendar ? dateFromJd(clock.jd) : null;
  const rig = v.camera;
  let link = null;
  try { const st = rig?.state?.(); if (st) link = viewLink(st); } catch { /* no camera state */ }
  return {
    title, place, subject, snapshot: v.snapshot, tiers, credits: imgCredits, years: clock.years, date,
    shipDate: date ? `${shipDate(date)} · ${date.toISOString().slice(0, 16).replace('T', ' ')} UTC` : `DEEP TIME · ${formatOffset(clock.years)}`,
    realDate: new Date().toISOString().slice(0, 16).replace('T', ' '),
    link,
    facts: { view: title.toLowerCase(), subject, bodies, date: date ? date.toISOString().slice(0, 10) : formatOffset(clock.years), lighting },
  };
}
const postcard = createPostcard({ h, pill: (...a) => pill(...a), toast, settings, describe: describePostcard, standalone: STANDALONE }); // pill is defined further down
onPostcard(() => postcard.open());

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
// ---- text size ------------------------------------------------------------------------------
const TEXT_STEPS = [0.8, 0.9, 1, 1.1, 1.25, 1.4, 1.6];
const textOut = h('div', { className: 'ctl-readout mono text-size', title: 'Text size' });
function applyTextScale() {
  const v = settings.get('textScale') ?? 1;
  document.documentElement.style.setProperty('--text-scale', String(v));
  textOut.textContent = `${Math.round(v * 100)}%`;
  window.dispatchEvent(new Event('resize')); // labels and panels re-measure
}
const stepText = (dir) => {
  const v = settings.get('textScale') ?? 1;
  const i = TEXT_STEPS.reduce((best, s, k) => (Math.abs(s - v) < Math.abs(TEXT_STEPS[best] - v) ? k : best), 0);
  settings.set('textScale', TEXT_STEPS[Math.max(0, Math.min(TEXT_STEPS.length - 1, i + dir))]);
};
settings.onChange((k) => { if (k === 'textScale') applyTextScale(); });
applyTextScale();
{ // in the top bar, so it is always in reach
  const btn = (label, dir, title) => Object.assign(h('button', { className: 'pill square', textContent: label, title }), { onclick: () => stepText(dir) });
  $('text-size').append(btn('A−', -1, 'Smaller text'), textOut, btn('A+', 1, 'Larger text'));
}
// each bottom-bar row scrolls sideways with the mouse wheel when its controls overflow
const scrollRow = (row) => { row.addEventListener('wheel', (e) => { if (row.scrollWidth > row.clientWidth && Math.abs(e.deltaY) > Math.abs(e.deltaX)) { row.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false }); return row; };
// ---- the spectrum control (#28, #66) -----------------------------------------------------------
// The state is a transmission curve T(λ) (src/data/curve.js), remembered as the `curve` setting; the
// old `band` / `bandPass` settings map onto the curve of that one bandpass (and still work if set).
const microns = (s) => s.replace(/ ?µm\b/g, ' MICRONS'); // 'µ' upper-cases to Greek 'Μ'
const storedCurve = () => normCurve(settings.get('curve') ?? curveFromLegacy(settings.get('band'), settings.get('bandPass')));
let syncingLegacy = false;
function setCurve(c) {
  const n = normCurve(c), can = canonical(n);
  syncingLegacy = true; // keep band/bandPass meaningful for anything that still reads them
  settings.set('band', can.kind === 'full' ? 'full' : can.kind === 'pass' ? can.band.id : describeCurve(n).dominant ?? 'full'); // custom: its dominant band
  settings.set('bandPass', can.kind === 'pass' ? can.pass.id : null);
  syncingLegacy = false;
  settings.set('curve', n.full ? null : n);
}
let spectrum = null; // the SPECTRUM button and overlay, made with the other controls below
let bandTimer = null;
function applyBandEverywhere() {
  bandLoads.begin(); // each change restarts the loading state (#62)
  performance.mark?.('fidelity:band-change');
  setCurrentCurve(storedCurve());
  system.setCurve();
  for (const v of [nav, galaxy, quadrant]) v.recolourBand?.();
  document.body.dataset.band = currentBand().band.id;
  spectrum?.refresh();
  if (route?.level === 'system' && route.body && system.model?.bodies.some((b) => b.id === route.body)) renderBodyPanel(route.body);
}
settings.onChange((k) => {
  if (k === 'curve') { clearTimeout(bandTimer); bandTimer = setTimeout(applyBandEverywhere, 0); } // one apply per burst of changes
  else if ((k === 'band' || k === 'bandPass') && !syncingLegacy) { settings.set('curve', curveFromLegacy(settings.get('band'), settings.get('bandPass'))); }
});
// "Processing" (#62): a local voice every 3 s while full-resolution band images load, and a pulsing pill
const voiceStatusOn = () => { const v = settings.get('voiceStatus'); return v === 'on' || (v !== 'off' && computer.state !== 'off'); };
const procPill = h('div', { className: 'band-processing', hidden: true });
function sayLocal(text) {
  const synth = globalThis.speechSynthesis;
  if (!synth || typeof SpeechSynthesisUtterance === 'undefined') return;
  if (synth.speaking && text === 'Processing') return;
  const u = new SpeechSynthesisUtterance(text);
  const v = synth.getVoices().find((x) => /^en/i.test(x.lang) && /female|samantha|zira|karen|serena|google uk english female/i.test(x.name)) ?? synth.getVoices().find((x) => /^en/i.test(x.lang));
  if (v) u.voice = v;
  u.rate = 1.05; u.pitch = 0.95; u.volume = 0.85;
  synth.speak(u);
}
let procHide = null;
function showLoadState(st) {
  clearTimeout(procHide);
  if (st.phase === 'loading' && st.pending > 0) {
    procPill.textContent = `PROCESSING… ${st.pending}`;
    procPill.title = `Full-resolution band images still loading:\n${st.waiting.join('\n')}`;
    procHide = setTimeout(() => { procPill.hidden = false; }, 250); // quick loads never flash the pill
    procPill.classList.remove('pulse'); void procPill.offsetWidth; procPill.classList.add('pulse');
  } else if (st.phase === 'failed') {
    procPill.textContent = st.pending > 0 ? `UNABLE TO COMPLETE · ${st.pending} STILL LOADING` : 'UNABLE TO COMPLETE · PREVIEW KEPT';
    procPill.hidden = false; procPill.classList.add('failed');
    procHide = setTimeout(() => { procPill.hidden = true; procPill.classList.remove('failed'); }, 6000);
  } else { procPill.hidden = true; procPill.classList.remove('failed'); }
  updateBandRow();
}
configureBandLoads({ speak: sayLocal, enabled: () => voiceStatusOn(), canSpeak: () => !['speaking', 'thinking', 'hearing', 'connecting'].includes(computer.state), onChange: showLoadState });
// the panel's IN THIS BAND row follows PREVIEW → LOADING → FULL
let bandRow = null;
function updateBandRow() {
  if (!bandRow) return;
  const look = system.bandLookOf(bandRow.id);
  if (look) bandRow.dd.textContent = `${look.label}${look.res ? ` · ${resText(look.res)}` : ''}`;
  if (bandRow.scale) showBandScale(bandRow.scale, look);
  spectrum?.refreshReadout();
}
// an archive map's physical scale on the band bar and a SCALE row (#72), once its scale and levels are known
function showBandScale(el, look) {
  const sc = look?.mode === 'real' ? look.scale : null, s = sc && look.levels ? shownScale(sc, look.levels) : null;
  el.dt.hidden = el.dd.hidden = el.badge.hidden = !s;
  if (el.lo) { // the bar's ends (standalone, or until the scale arrives: FAINT … BRIGHT as before)
    el.lo.textContent = s ? s.loText : 'FAINT';
    el.hi.textContent = s ? s.hiText : el.hiDefault;
    el.lo.parentElement?.classList.toggle('scaled', !!s);
  }
  if (!s) return;
  el.dd.textContent = `${s.text} · FALSE COLOUR`;
  const b = badge(sc.tier ?? 'computed', scaleDetail(sc, s));
  el.badge.replaceWith(b); el.badge = b;
}
onBandRes(updateBandRow);
// panels that describe the band (#28): Galaxy, Universe and Star views re-render when it changes
onBand(() => queueMicrotask(() => {
  if (route?.level === 'galaxy') renderGalaxyPanel();
  else if (route?.level === 'universe') renderUniversePanel();
  else if (route?.level === 'star' && route.body && system.model?.bodies.some((b) => b.id === route.body)) renderBodyPanel(route.body, { inStarView: true });
}));
// ---- "Computer" (#21) ----------------------------------------------------------------------
let voiceBtn = null, voiceStars = null;
const VOICE_STATES = { off: 'OFF', untrained: 'TRAIN THE WAKE WORD FIRST', listening: 'LISTENING FOR "COMPUTER" (ON THIS MACHINE ONLY)', training: 'SAY "COMPUTER"…',
  connecting: 'CONNECTING…', hearing: 'GO AHEAD…', thinking: 'WORKING…', speaking: 'SPEAKING' };
/** What is on screen right now, for the ship's computer: the view, what it is centred on, the clock and
 * scale, layers, band, anything playing out (missions, eclipses, a webcast) and the side panel's text. */
function screenContext() {
  const lines = [], sel = route.body && system.model?.bodies.find((b) => b.id === route.body);
  lines.push(`VIEW: ${$('view-title').textContent}`);
  if (route.level === 'comms') lines.push(comms.context());
  lines.push(`ROUTE: ${route.level}${route.system ? ` / system ${system.model?.name ?? route.system}` : ''}${route.body ? ` / ${sel?.name ?? route.body}` : ''}`);
  if (['system', 'satellite', 'events'].includes(route.level) && system.model) {
    const f = system.model.bodies.find((b) => b.id === system.focusId);
    lines.push(`CAMERA CENTRED ON: ${f?.name ?? system.focusId}${system.onSurface ? ` (standing on the surface of ${system.model.bodies.find((b) => b.id === system.onSurface.id)?.name ?? system.onSurface.id}, looking up)` : ''}`);
  }
  const d = dateFromJd(clock.jd);
  lines.push(`SHIP'S CLOCK: ${clock.inCalendar ? `${d.toISOString().slice(0, 16).replace('T', ' ')} UTC` : `${formatOffset(clock.years)} from now (deep time)`}, running at ${clock.rate.label}${clock.isNow ? ' (live, now)' : ''}${clock.clamped ? ` (stopped at this view's limit: ${clock.clamped})` : ''}`);
  lines.push(`SCALE: ${settings.get('scale') === 'true' ? 'TRUE (real sizes)' : 'ENHANCED (bodies enlarged)'} · EPHEMERIS: ${settings.get('ephemeris') === 'horizons' ? 'JPL Horizons' : 'Keplerian elements'}`);
  const on = ['labels', 'orbits', 'dwarfs', 'smallBodies', 'spacecraft', 'belts', 'satellites', 'zones', 'axes', 'fields', 'liveSkins', 'missions'].filter((k) => settings.get(k));
  lines.push(`LAYERS ON: ${on.join(', ') || 'none'}`);
  const cb = currentBand();
  if (!cb.full) {
    lines.push(`SPECTRAL BAND: ${cb.band.label}${cb.pass ? ` · ${cb.pass.label}` : ''} (false colour)`);
    lines.push(describeCurve(cb.curve).text); // the spectrum control's readout (#66), for "what am I looking at?"
    const fl = system.bandLookOf(route.body ?? system.focusId);
    if (fl) lines.push(`IN THIS BAND (${route.body ?? system.focusId}): ${fl.label}${fl.res ? ` · ${resText(fl.res)}` : ''}`);
  }
  const active = system.activeMissions?.map((id) => eventsFeed()?.events.find((e) => e.id === id)?.title).filter(Boolean) ?? [];
  if (active.length) lines.push(`PLAYING OUT IN THE 3D VIEW (modelled paths): ${active.join('; ')}`);
  const fv = $('feed-viewer');
  if (fv && !fv.hidden) lines.push(`VIDEO / FEED WINDOW OPEN: ${fv.querySelector('.fv-title')?.textContent ?? ''} ${fv.querySelector('.fv-sub')?.textContent ?? ''}`.trim());
  if (starCard?.current) lines.push(`SELECTED STAR CARD: ${starCard.current.name ?? starCard.current.id ?? 'a catalogue star'}`);
  lines.push('', 'SIDE PANEL (badges in brackets give each value\'s provenance):', (panelEl.innerText || '').replace(/\n{2,}/g, '\n').slice(0, 6000));
  return lines.join('\n');
}
const computer = createComputer({
  context: () => screenContext(),
  names: () => {
    const m = system.model, out = (m?.bodies ?? []).map((b) => ({ name: b.name, go: () => go({ level: 'system', system: m.id, body: b.id }) }));
    for (const st of voiceStars ?? []) if (st.name) out.push({ name: st.name, go: () => go({ level: 'system', system: st.id }) });
    return out;
  },
  setLayer: (k, on) => settings.set(k, on),
  comms: (c) => (route.level === 'comms' ? comms.voice(c) : { ok: false, error: 'Open COMMS first (top bar).' }), // #69
  setTime: (iso) => { if (/^now$/i.test(iso)) { clock.now(); return true; } const t = Date.parse(iso); if (!Number.isFinite(t)) return false; clock.set(jdFromDate(new Date(t))); return true; },
  canInterrupt: () => !!settings.get('voiceInterrupt'),
  status: () => fetch('/api/voice/status').then((r) => (r.ok ? r.json() : null)).catch(() => null),
  onState: (st, _d, log) => renderVoice(st, log),
});
function renderVoice(st = computer.state, log = computer.log) {
  voiceBtn?.classList.toggle('listening', st !== 'off');
  const vp = $('voice-panel');
  if (vp.hidden) return;
  const live = st === 'hearing' || st === 'training';
  vp.replaceChildren(
    h('div', { className: 'vp-head' }, h('b', { textContent: 'COMPUTER' }), pill('✕', () => { vp.hidden = true; }, 'square')),
    h('div', { className: `vp-state${live ? ' live' : ''}`, textContent: VOICE_STATES[st] ?? st.toUpperCase() }),
    h('div', { className: 'vp-log' }, log.slice(-12).map((l) => h('div', { className: l.who, textContent: `${l.who === 'you' ? 'YOU' : 'FIDELITY'}: ${l.text}` }))),
    h('div', { className: 'vp-actions' },
      pill(st === 'off' ? 'LISTEN' : 'STOP LISTENING', () => computer.listen(st === 'off').catch((e) => toast(`MICROPHONE: ${String(e.message || e).toUpperCase()}`))),
      pill('TALK NOW', () => computer.talk().catch((e) => toast(`MICROPHONE: ${String(e.message || e).toUpperCase()}`))),
      pill(computer.trained ? 'RETRAIN "COMPUTER"' : 'TRAIN "COMPUTER"', () => computer.train(3, (k) => toast(`${k} OF 3 — ${k < 3 ? 'AGAIN' : 'DONE'}`)).catch((e) => toast(String(e.message || e).toUpperCase()))),
      st === 'speaking' || st === 'thinking' ? pill('STOP', () => computer.stop()) : null,
      pill(settings.get('voiceInterrupt') ? 'INTERRUPT: WAKE WORD' : 'INTERRUPT: OFF', () => { settings.set('voiceInterrupt', !settings.get('voiceInterrupt')); renderVoice(); }),
      pill(`VOICE STATUS ${voiceStatusOn() ? 'ON' : 'OFF'}`, () => { settings.set('voiceStatus', voiceStatusOn() ? 'off' : 'on'); renderVoice(); })),
    h('p', { className: 'note', textContent: 'The wake word is recognised on this machine from your own three recordings; only what you say after it goes to the ship\'s computer (OpenAI Realtime, through the local backend, which holds the key).' }));
  const lg = vp.querySelector('.vp-log'); if (lg) lg.scrollTop = lg.scrollHeight;
}
function openVoice() {
  const vp = $('voice-panel');
  vp.hidden = !vp.hidden;
  if (!voiceStars) fetchNearby('sol', 25).then((d) => { voiceStars = d?.stars ?? []; }).catch(() => { voiceStars = []; });
  renderVoice();
}
const pill = (label, onClick, cls = '') => {
  const b = h('button', { className: `pill ${cls}`, textContent: label });
  b.addEventListener('click', onClick);
  return b;
};
const dateIn = h('input', { type: 'date', id: 'ship-date', title: 'Jump to date (UTC)' });
// Typed dates jump on Enter only (each keystroke of a year is a valid, wrong date: "0002", "0020"…);
// a date picked from the calendar jumps at once. Leaving the field un-entered reverts it to the clock.
let dateTyped = false;
const jumpToDate = () => {
  dateTyped = false;
  if (!dateIn.value) return;
  const [y, m, d] = dateIn.value.split('-').map(Number);
  clock.set(jdFromDate(new Date(Date.UTC(y, m - 1, d, 12))));
};
dateIn.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); jumpToDate(); dateIn.blur(); }
  else if (e.key === 'Escape') { dateTyped = false; dateIn.blur(); }
  else if (e.key.length === 1 || ['Backspace', 'Delete', 'ArrowUp', 'ArrowDown'].includes(e.key)) dateTyped = true;
});
dateIn.addEventListener('change', () => { if (!dateTyped) jumpToDate(); });
dateIn.addEventListener('blur', () => { dateTyped = false; });

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

// DETAIL slider: the System View's layers step by step, from the bare system (star, planets, moons,
// orbits) at the left to every layer at the right; it writes the layer flags, and reads them back
const detailCtl = (() => {
  const input = h('input', { type: 'range', className: 'detail-slider', min: '0', max: String(DETAIL_MAX), step: '1',
    title: `DETAIL: drag right to add map elements (${DETAIL_LEVELS.map((l) => l.label.replace(/^\+ /, '')).join(' → ')})` });
  const read = h('div', { className: 'detail-read' });
  let writing = false;
  input.addEventListener('input', () => {
    writing = true;
    for (const [k, v] of Object.entries(flagsForLevel(Number(input.value)))) if (settings.get(k) !== v) settings.set(k, v);
    writing = false; sync();
  });
  const sync = () => {
    if (writing) return;
    const n = levelOfFlags(settings.get);
    input.value = String(n);
    read.textContent = DETAIL_LEVELS[n].label;
    input.style.setProperty('--fill', `${(n / DETAIL_MAX) * 100}%`);
  };
  settings.onChange((k) => { if (DETAIL_FLAGS.includes(k)) sync(); }); sync();
  return h('div', { className: 'ctl-group detail-ctl' }, h('div', { className: 'ctl-label', textContent: 'DETAIL' }), h('div', { className: 'detail-box' }, input, read));
})();

// ---- step the clock by n units, or run at n units per second -------------------------------
const stepIn = h('input', { type: 'number', className: 'ctl-num', step: 'any', title: 'How many units (decimals and negatives allowed)', value: String(settings.get('stepN') ?? 1) });
const stepUnit = h('select', { className: 'ctl-select', title: 'Step unit' }, STEP_UNITS.map((u) => h('option', { value: u.id, textContent: u.label })));
stepUnit.value = settings.get('stepUnit') ?? 'day';
const stepN = () => { const n = Number(stepIn.value); return Number.isFinite(n) && n !== 0 ? n : 1; };
stepIn.addEventListener('change', () => settings.set('stepN', stepN()));
stepUnit.addEventListener('change', () => settings.set('stepUnit', stepUnit.value));
const unitOf = () => STEP_UNITS.find((u) => u.id === stepUnit.value) ?? STEP_UNITS[2];
const stepBy = (dir) => clock.step(dir * stepN(), unitOf().id);
const runAt = () => {
  const n = stepN(), u = unitOf();
  clock.setRate(n * u.days, `${n} ${u.label}${Math.abs(n) === 1 ? '' : 'S'}/S`.replace('MILLENNIUMS', 'MILLENNIA').replace('CENTURYS', 'CENTURIES').replace(/([MG]YR)S\//, '$1/'));
};
// [ and ] step back and forward from anywhere but a text field
window.addEventListener('keydown', (e) => {
  if (e.target.closest?.('input, select, textarea') || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === '[') stepBy(-1); else if (e.key === ']') stepBy(1);
  else if (e.key === 'Escape' && (computer.state === 'speaking' || computer.state === 'thinking')) computer.stop(); // Esc ends the computer's reply
});

spectrum = createSpectrumControl({ h, pill, getCurve: storedCurve, setCurve,
  context: () => {
    const id = route?.body ?? system.focusId, b = id && system.model?.bodies.find((x) => x.id === id);
    return { body: b ? { name: b.name, look: system.bandLookOf(b.id) } : null, sky: system.bandSkies?.() ?? null };
  },
  voiceStatus: { get: () => voiceStatusOn(), toggle: () => settings.set('voiceStatus', voiceStatusOn() ? 'off' : 'on') } });
// two rows: the time control above (#34), everything else on the elbow's arm below
const timeCtl = createTimeControl({ h, pill, clock, settings, go, dateIn,
  stepControls: [pill('◀|', () => stepBy(-1), 'square'), stepIn, stepUnit, pill('|▶', () => stepBy(1), 'square'), pill('RUN', runAt, 'square')] });
// The clock ticks here, whatever view is showing (the System View also ticks it in its own frame).
const tcLoop = (now) => { clock.tick(now); syncDeepTime(); timeCtl.frame(); requestAnimationFrame(tcLoop); };
requestAnimationFrame(tcLoop);
controls.append(scrollRow(timeCtl.el), scrollRow(h('div', { className: 'bar-row' },
  h('div', { className: 'ctl-group' }, h('div', { className: 'ctl-label', textContent: 'SCALE' }),
    toggle('scale', 'enhanced', 'true', 'ENHANCED', 'TRUE')),
  h('div', { className: 'ctl-group' }, h('div', { className: 'ctl-label', textContent: 'SPECTRUM' }), spectrum.button),
  h('div', { className: 'ctl-group' }, h('div', { className: 'ctl-label', textContent: 'EPHEMERIS' }),
    toggle('ephemeris', 'kepler', 'horizons', 'KEPLER', 'JPL HORIZONS')),
  detailCtl,
  h('div', { className: 'ctl-group' }, (voiceBtn = pill('COMPUTER', () => openVoice(), 'square')), flag('labels', 'LABELS'), flag('orbits', 'ORBITS'), flag('dwarfs', 'DWARFS'), flag('smallBodies', 'SMALL BODIES'), flag('spacecraft', 'CRAFT'), flag('belts', 'BELTS'), flag('satellites', 'SATS'), flag('zones', 'ZONES'), flag('axes', 'AXES'), flag('fields', 'MAG FIELDS'), flag('features', 'NAMES'), flag('sites', 'SITES'), flag('deepsky', 'DEEP SKY'), flag('constellations', 'CONST'), flag('liveSkins', 'LIVE'), flag('missions', 'MISSIONS')),
  h('div', { className: 'bar-fill' }))));
// The standalone preview has no backend: Horizons there is the months bundled in its snapshot
// (this month and next), Keplerian elements outside them.
if (STANDALONE) {
  const hz = [...controls.querySelectorAll('.pill')].find((b) => b.textContent === 'JPL HORIZONS');
  hz.title = 'Bundled JPL Horizons months only in this preview (Keplerian elements outside them); run `npm start` for any date.';
}
$('viewport').append(spectrum.overlay, procPill);
applyBandEverywhere(); // the remembered spectrum curve
// warm every band's preview once the first views have loaded, one at a time (#62)
setTimeout(() => { (window.requestIdleCallback ?? ((f) => setTimeout(f, 0)))(() => prefetchPreviews()); }, 8000);

// ---- panel helpers ----------------------------------------------------------------------
const panelEl = $('panel');
// The right panel is resizable: drag its left edge (width remembered in settings).
{
  const app = $('app'), handle = document.createElement('div');
  handle.className = 'panel-resize';
  handle.title = 'Drag to resize the panel (double-click to reset)';
  app.appendChild(handle);
  const apply = (w) => (w ? app.style.setProperty('--panel-w', `${w}px`) : app.style.removeProperty('--panel-w'));
  apply(settings.get('panelWidth'));
  handle.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    handle.setPointerCapture(e.pointerId);
    handle.classList.add('drag');
    const right = app.getBoundingClientRect().right;
    const move = (ev) => apply(Math.round(Math.max(280, Math.min(window.innerWidth * 0.6, right - ev.clientX - 10))));
    const up = () => {
      handle.removeEventListener('pointermove', move); handle.classList.remove('drag');
      const w = parseInt(app.style.getPropertyValue('--panel-w'), 10);
      if (w) settings.set('panelWidth', w);
      window.dispatchEvent(new Event('resize'));
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up, { once: true });
  });
  handle.addEventListener('dblclick', () => { settings.set('panelWidth', null); apply(null); });
}
collapsibleSections(panelEl, settings); // click a section heading to fold it
// replaceChildren would print `null` for skipped optional sections
const panel = { replaceChildren: (...kids) => panelEl.replaceChildren(...kids.filter((k) => k != null)) };
// SELECTED STAR card for stars clicked in the Galaxy, Quadrant and System (sky) views (#23)
let starCardView = null;
const starCard = createStarCard({
  h, row: (...a) => row(...a), fmt: (...a) => fmt(...a), go, fetchStar, fetchStarLookup,
  onUpdate: () => {
    if (!starCard?.current) starCardView = null;
    if (route.level === 'galaxy') renderGalaxyPanel();
    else if (route.level === 'quadrant') renderQuadrantPanel();
    else if (route.level === 'system' && starCardView === 'system') renderSkyStarPanel();
  },
});
function pickStarIn(view, p) { starCardView = view; starCard.select(p); }
const starCardFor = (view) => (starCardView === view && starCard.current ? starCard.section() : []);
function renderSkyStarPanel() {
  if (!starCard.current) { const m = system.model; if (m) renderSystemPanel?.(); return; }
  resetLive();
  panel.replaceChildren(
    h('h2', { textContent: 'IN THE SKY' }),
    h('div', { className: 'kind', textContent: `A STAR SEEN FROM ${(system.model?.name ?? 'HERE').toUpperCase()}` }),
    ...starCard.section(),
    h('div', { className: 'body-list' }, pill('◀ BACK TO THE SYSTEM', () => { starCardView = null; starCard.clear(); go({ level: 'system', system: currentSystem }); })),
    renderLegend());
}
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

/** A deep-sky object picked on the surface view's sky (#48): its card in the feed viewer. */
function deepSkyCard(o) {
  const v = $('feed-viewer'), dl = h('dl');
  row(dl, 'KIND', o.sub ?? o.kind.toUpperCase(), 'measured', 'Catalogue classification.');
  if (o.distLy) row(dl, 'DISTANCE', `${fmt(o.distLy, 0)} LY`, 'measured', o.kind === 'cluster' ? 'Hunt & Reffert 2023 (Gaia DR3 parallaxes).' : 'Literature distance (src/data/deepsky.js).');
  if (o.sizeArcmin) row(dl, 'SIZE ON THE SKY', o.sizeArcmin >= 60 ? `${(o.sizeArcmin / 60).toFixed(1)}°` : `${o.sizeArcmin.toFixed(1)}′`, 'measured', o.kind === 'galaxy' ? 'D25 major axis (RC3 / HyperLEDA).' : o.kind === 'cluster' ? 'Twice the half-member radius.' : 'Extent of the modelled nebula.');
  if (o.members) row(dl, 'MEMBERS', fmt(o.members, 0), 'measured', 'Gaia DR3 members (Hunt & Reffert 2023).');
  if (o.pa != null) row(dl, 'ORIENTATION', `PA ${o.pa}° · INCLINATION ${o.incl}°`, o.orient, o.orientSource);
  if (o.credit) row(dl, 'IMAGE', o.kind === 'cluster' ? 'NONE (RING AT r50)' : 'SURVEY / PRESS IMAGE', 'measured', `${o.credit}${o.licence ? ` · ${o.licence}` : ''}`);
  v.hidden = false;
  v.replaceChildren(
    h('div', { className: 'fv-head' }, h('span', { className: 'fv-title', textContent: o.name.toUpperCase() }), h('span', { className: 'fv-sub', textContent: 'ON THE SKY FROM HERE' }), badge('measured', o.credit ?? ''),
      pill('✕', () => { v.hidden = true; v.replaceChildren(); }, 'square')),
    h('div', { className: 'fv-body fv-card' }, h('div', {}, dl, o.note ? h('p', { className: 'note', textContent: o.note }) : null,
      h('div', { className: 'body-list' }, pill(o.kind === 'galaxy' ? 'SHOW IN THE UNIVERSE VIEW ▸' : 'SHOW IN THE QUADRANT VIEW ▸', () => {
        v.hidden = true;
        if (o.kind === 'galaxy') { universeSel = o.id; go({ level: 'universe' }); } else { quadrantSel = o.id; go({ level: 'quadrant' }); }
      })))),
    h('div', { className: 'fv-credit', textContent: o.credit ?? '' }));
}

function renderLegend() {
  return h('div', {},
    h('h3', { textContent: 'DATA PROVENANCE' }),
    h('div', { className: 'legend' }, Object.keys(TIERS).map((t) => badge(t))),
    h('p', { className: 'note', textContent: 'Every value is tagged. Hover a badge for what it means.' }));
}

const navList = createNavList({ h, pill, fmt, fetchPlanets, fetchClusters,
  go: (r) => { if (r.select) quadrantSel = r.select; go(r); },
  onSelectStar: (id) => selectNavStar(id), onRerender: () => { if (route.level === 'navigation') renderNavPanel(); } });
const skyPanel = createSkyEventsPanel({ h, row, pill, go, clock, system });
const earthHz = earthFromHorizons();
const satPanel = createSatellitePanel({ h, pill, row, factList, badge, renderLegend, go, system, clock, toast, panel, live, resetLive, $ });
const sitesPanel = createSitesPanel({ h, pill, row, badge, settings, panel, resetLive, renderLegend,
  viewFeed: (f, name) => satPanel.viewFeed(f, name),
  back: (b) => renderBodyPanel(b.id),
  globe: () => system.endSiteView(),
  above: (b, s) => {
    const span = s.traverseInfo?.spanKm ?? (s.diameterKm ? s.diameterKm * 0.6 : 30);
    if (route.level === 'system' && system.focusId === b.id) system.viewSite(b.id, s.lat, s.lon, span);
    else { pendingSiteView = { id: b.id, lat: s.lat, lon: s.lon, span }; go({ level: 'system', system: 'sol', body: b.id }); }
  },
  stand: (b, s) => {
    if (route.level === 'system' && system.focusId === b.id) system.surfaceAt(b.id, s.lat, s.lon);
    else { pendingSurface = { id: b.id, lat: s.lat, lon: s.lon }; go({ level: 'system', system: 'sol', body: b.id }); }
  } });
const transferPanel = createTransferPanel({ h, pill, row, system, clock, toast, $, badge });
const magneticPanel = createMagneticPanel({ h, row, settings, system });
const futurePanel = createFuturePanel({ h, pill, row, badge, system, clock, toast, go, $ });
const futureEvents = createFutureEventsPanel({ h, pill, row, badge, go, clock, toast, panel, system, settings });
const earthTimeline = createEarthTimelinePanel({ h, pill, row, badge, go, clock, toast, panel, system });
const eventsPanel = createEventsPanel({ h, pill, row, badge, go, clock, system, toast, panel, live, resetLive, $ });
// COMMS (#69): SubSpace and RF reception
const comms = createCommsView($('comms-view'), { badge, pill, settings, toast, onPanel: () => { if (route.level === 'comms') renderCommsPanel(); } });
function renderCommsPanel() { resetLive(); panel.replaceChildren(...comms.panel(h, row), renderLegend()); }
$('comms-tab').addEventListener('click', () => go({ level: 'comms', system: 'sol' }));
// SEARCH (#63): the top-bar box; kinds that need the shell's state route through these actions
createSearch({ h, badge, $, go, clock, actions: {
  satellites: () => satPanel.load(),
  stars: (q) => fetchStarSearch(q),
  mission: (id) => { const m = FUTURE_MISSIONS.find((x) => x.id === id); if (m) futurePanel.openCard(m); },
  site: (id) => {
    const s = SITES.find((x) => x.id === id);
    if (!s) return;
    if (route.level === 'system' && currentSystem === 'sol' && system.focusId === s.body) system.surfaceAt(s.body, s.lat, s.lon);
    else { pendingSurface = { id: s.body, lat: s.lat, lon: s.lon }; go({ level: 'system', system: 'sol', body: s.body }); }
  },
  quadrant: (id) => { quadrantSel = id; if (route.level === 'quadrant') { quadrant.select(id); renderQuadrantPanel(); } else go({ level: 'quadrant' }); },
  universe: (id) => { universeSel = id; if (route.level === 'universe') { universe.select(id); renderUniversePanel(); } else go({ level: 'universe' }); },
} });
// Feed items with a flight model play out in the System View; stations are placed by SGP4 from the satellite catalogue.
{
  let satrecs = new Map();
  const attach = (f) => f && system.setMissionEvents(f.events, { satrecFor: (n) => satrecs.get(n) ?? null });
  onEvents(attach);
  loadEvents().then((f) => {
    if (!f?.events.some((e) => e.target?.norad)) return;
    satPanel.load().then((d) => {
      const want = new Set(f.events.map((e) => e.target?.norad).filter(Boolean));
      satrecs = new Map((d?.rows ?? []).filter((r) => want.has(r[0])).map((r) => [r[0], satrecFromRow(r)]));
      attach(f);
    });
  });
}

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
    // COMMS (#35): band, rate, power, antenna, complex, age; last seen when not in contact
    live.dsnOne.replaceChildren(...spacecraftComms(dsn, live.dsnCraft, (c) => system.model?.bodies.find((b) => b.horizons === String(c.spacecraftId))?.name ?? c.code));
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
    // small bodies by region (JPL SBDB orbit class)
    ...(() => {
      const small = m.bodies.filter((b) => b.orbit?.type === 'elements');
      const of = (re) => small.filter((b) => re.test(b.belt ?? ''));
      return [
        ['DWARF PLANETS', small.filter((b) => b.kind === 'dwarf planet')],
        ['ASTEROID BELT', of(/MAIN BELT/).filter((b) => b.kind !== 'dwarf planet')],
        ['NEAR-EARTH ASTEROIDS', of(/NEAR-EARTH/)],
        ['JUPITER TROJANS', of(/TROJAN/)],
        ['CENTAURS, KUIPER BELT & COMETS', small.filter((b) => b.kind !== 'dwarf planet' && !/MAIN BELT|NEAR-EARTH|TROJAN/.test(b.belt ?? ''))],
      ];
    })(),
    ['SPACECRAFT · DEEP SPACE', m.bodies.filter((b) => b.kind === 'spacecraft')],
    ['REGIONS', m.bodies.filter((b) => b.kind === 'region')],
    ['LAGRANGE POINTS', m.bodies.filter((b) => b.kind === 'lagrange point')],
  ];
}
// FROM EARTH, imagery and spectra cards of the open detail view (src/panels/detail.js)
let detail = null;
function setDetail(d, place) { detail?.dispose(); detail = d; place(d); }

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
      ...futurePanel.systemSection(m),
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
  if (b.kind === 'spacecraft' && b.horizons) {
    live.ephem = row(pos, 'EPHEMERIS', '—', 'measured', 'JPL Horizons publishes each craft\'s trajectory only as far ahead as its navigators predict; beyond that the craft is not drawn.');
    live.ephemHz = b.horizons;
  }
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
  if (b.skin?.live) {
    live.skinBody = b.id;
    live.skin = row(look, 'LIVE SKIN', STANDALONE ? 'NEEDS THE LOCAL BACKEND' : 'LOADING…', 'measured',
      b.id === 'sun' ? 'Latest SDO HMI full-disk image (Helioviewer), projected onto the Earth-facing hemisphere; the far side is a stand-in map.'
        : "Yesterday's global mosaic from NOAA-20 VIIRS (NASA GIBS), with its real clouds; the Blue Marble fills swath gaps and polar night.");
  }
  if (!b.marker) live.size = row(look, 'SIZE ON SCREEN', '—', 'imagined', 'Enhanced scale enlarges bodies so they are visible.');
  if (b.id === 'main-belt' || b.id === 'kuiper-belt' || b.id === 'trojans') {
    const c = beltCounts;
    if (c) row(look, 'DRAWN HERE', `${fmt((b.id === 'main-belt' ? c.main : b.id === 'trojans' ? c.trojan : c.tno + c.centaur), 0)} REAL ORBITS`, 'measured', 'JPL Small-Body Database orbits; positions solved live from Kepler\'s equation.');
  }

  // #19: spin axis, comet activity, the Sun's field, explainers
  const extra = [];
  if (m.isSol && (b.id === 'earth' || b.id === 'moon')) {
    const dl = h('dl');
    live.axisBody = b.id;
    if (b.id === 'earth') {
      live.axis1 = row(dl, 'POLE STAR', '—', 'computed', 'The bright star nearest the north celestial pole on the shown date. Precession moves the pole around a circle: Thuban in 2700 BC, Polaris now, Vega around AD 14,000.');
      live.axis2 = row(dl, 'AXIAL TILT', '—', 'computed', 'Obliquity of the ecliptic of date (IAU 1980; it swings between 22.1° and 24.5° over 41,000 years, held at the J2000 value beyond ±2,000 years).');
      row(dl, 'PRECESSION', '25,772 YEARS', 'measured', 'The axis sweeps a 23.4°-radius cone, driven by the Sun and Moon pulling on Earth\'s equatorial bulge (50.29″ a year).');
      row(dl, 'NUTATION', '18.6 YEARS · ±9″', 'measured', 'A nod on top of precession, from the Moon\'s tilted orbit turning (IAU 1980 largest terms).');
    } else {
      live.axis1 = row(dl, 'LIBRATION', '—', 'computed', 'Where the Earth stands in the Moon\'s sky: the near side wobbles about ±7.9° east–west (uniform spin on an elliptical orbit) and ±6.7° north–south (tilted axis), so we see 59% of the surface over time. IAU 2009 rotation model.');
      row(dl, 'ROTATION MODEL', 'IAU 2009', 'measured', 'Pole and prime meridian with the E1–E13 periodic terms (Archinal et al. 2011).');
    }
    extra.push(h('h3', { textContent: 'SPIN AXIS' }), dl, h('p', { className: 'note', textContent: 'Toggle AXES to draw spin axes, and Earth\'s precession circle among the stars.' }));
  }
  if (b.comet) {
    const dl = h('dl');
    live.cometBody = b.id;
    live.comet1 = row(dl, 'ACTIVITY', '—', 'modelled', 'Ices sublimate from ~5 AU inwards (water within ~3 AU): the coma and tails grow as it nears the Sun.');
    live.comet2 = row(dl, 'TOTAL MAGNITUDE', '—', 'computed', `m = M1 + 5 log Δ + K1 log r with M1 ${b.comet.M1}, K1 ${b.comet.K1} (JPL SBDB). Naked eye below ~6.`);
    live.comet3 = row(dl, 'TAILS', '—', 'modelled', 'Ion tail straight away from the Sun (blue), dust tail curving behind (yellow-white); lengths scaled from Halley in 1986.');
    if (b.comet.perihelion) row(dl, 'NEXT PERIHELION', b.comet.perihelion, 'computed', 'Set the date there to see it active.');
    extra.push(h('h3', { textContent: 'COMET' }), dl);
  }
  if (m.isSol && b.id === 'sun') {
    const dl = h('dl');
    row(dl, 'FIELD AT 1 AU', `${SOLAR.b1AU_nT} NT`, 'measured', 'Typical interplanetary field strength at Earth (OMNI); it falls as 1/r² near the Sun and 1/r far out.');
    row(dl, 'SPIRAL ANGLE AT 1 AU', `${fmt(spiralAngleDeg(1), 0)}°`, 'computed', `Parker spiral for a ${SOLAR.windKms} km/s wind and the Sun's 25.38-day sidereal rotation.`);
    row(dl, 'CURRENT SHEET TILT', `${SOLAR.tiltDeg}°`, 'modelled', 'The wavy boundary between outward and inward field. Its tilt follows the solar cycle (~10° at minimum, ~70° near maximum); 45° is a stand-in for the 2026 declining phase.');
    row(dl, 'NORTH POLARITY', 'INWARD (−)', 'modelled', 'Since the cycle-25 polar-field reversal (2024). Blue lines point in, orange out.');
    extra.push(h('h3', { textContent: 'MAGNETIC FIELD' }), dl, h('p', { className: 'note', textContent: 'Toggle FIELDS to draw the Parker-spiral field lines and the current sheet, turning with the Sun.' }));
  }
  {
    // the spectrum filter (#28, #66): how this body is drawn in the band or curve, and the sky behind it
    const cb = currentBand(), look = system.bandLookOf(b.id);
    bandRow = null;
    if (!cb.full) {
      const dl = h('dl');
      if (look) {
        const res = look.res ? ` · ${resText(look.res)}` : '';
        const detail = look.res && look.res !== 'full' ? `${look.detail}\n${look.res.startsWith('failed') ? `The full-resolution image could not be loaded; the low-resolution preview is shown (still ${look.tier === 'modelled' ? 'MODELLED' : 'MEASURED'}).` : look.res === 'baked' ? 'The offline preview carries this small copy, baked when the file was built; the local backend serves the full resolution.' : `A low-resolution preview of the ${look.tier === 'modelled' ? 'modelled map (MODELLED · PREDICTED)' : 'real map (MEASURED)'} is shown while the full resolution loads.`}` : look.detail;
        bandRow = { id: b.id, dd: row(dl, 'IN THIS BAND', `${look.label}${res}`, look.tier, detail) };
        if (look.mode === 'real' && look.source?.archive?.scale) { // #72: filled by showBandScale when the scale and levels arrive
          const sdd = row(dl, 'SCALE', '', 'computed');
          bandRow.scale = { dt: sdd.previousSibling, dd: sdd, badge: sdd.nextSibling };
        }
        for (const s of look.sources ?? []) row(dl, `${s.predicted ? 'MODELLED MAP' : 'REAL MAP'} · ${s.drawn ? 'DRAWN' : 'LISTED'}`, `${s.credit.split(/[,(:]/)[0].trim().toUpperCase()} · ${Math.round(s.weight * 100)}%`, s.predicted ? 'modelled' : 'measured', `${s.credit}${s.note ? `\n${s.note}` : ''}${s.drawn ? '' : '\nOverlaps the curve but is not drawn: one map per globe (the best-covered).'}`);
        if (look.notObserved?.length) row(dl, 'NOT OBSERVED', look.notObserved.map((r) => fmtRange(...r)).join(', '), 'computed', 'Parts of the curve with no real image of this body and no spectral signature to predict from.');
        else if (look.uncovered?.length && look.mode === 'curve') row(dl, 'NO REAL IMAGE', look.uncovered.map((r) => fmtRange(...r)).join(', '), 'modelled', 'Predicted there (MODELLED · PREDICTED).');
      }
      const skies = system.bandSkies?.() ?? { layers: [] };
      if (skies.layers.length) for (const L of skies.layers) row(dl, 'SKY', `${L.skyCredit.split(/[,(]/)[0].trim().toUpperCase()}${skies.layers.length > 1 ? ` · ${Math.round(L.weight * 100)}%` : ''}`, 'measured', L.skyCredit);
      else row(dl, 'SKY', 'CATALOGUE STARS, RE-WEIGHTED', 'computed', cb.custom ? 'No all-sky survey overlaps the curve: catalogue stars brightened or dimmed by their blackbody through T(λ) relative to V (Vega system).' : 'No all-sky survey in this bandpass: catalogue stars brightened or dimmed by their blackbody in the band (Vega system).');
      const d = cb.custom ? cb.prep.desc : null;
      const keyLo = h('span', { textContent: 'FAINT' }), keyHi = h('span', { textContent: (cb.band.dominant ?? cb.band.id) === 'visible' ? 'BRIGHT · MONOCHROME' : 'BRIGHT · FALSE COLOUR' });
      extra.unshift(h('h3', { textContent: `SPECTRUM · ${cb.custom ? microns(cb.pass.label).toUpperCase() : `${cb.band.label}${cb.pass ? ` · ${microns(cb.pass.label).toUpperCase()}` : ''}`}` }), dl,
        look?.mode === 'glow' ? h('p', { className: 'note explain', textContent: look.detail } ) : null,
        d?.composite ? h('div', { className: 'sp-key' }, ...d.thirds.map((t, i) => h('span', { className: `k${i}`, textContent: fmtRange(...t) })))
          : h('div', { className: `band-key band-${cb.band.palette}` }, keyLo, keyHi));
      if (bandRow?.scale) { Object.assign(bandRow.scale, { lo: keyLo, hi: keyHi, hiDefault: keyHi.textContent }); showBandScale(bandRow.scale, look); }
    }
  }
  if (m.isSol && ['sun', 'earth', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'].includes(b.id)) extra.push(...skyPanel.section(b.id));
  if (b.explain) extra.push(h('h3', { textContent: 'WHAT IS THIS' }), h('p', { className: 'note explain', textContent: b.explain }));
  if (m.isSol && b.id !== 'earth' && b.id !== 'sun' && !b.marker && b.kind !== 'spacecraft' && b.kind !== 'satellite') extra.push(...transferPanel.section(b, m.bodies)); // #45
  if (m.isSol) extra.push(...futurePanel.section(b, m)); // #44
  if (m.isSol && b.id === 'earth') extra.push(h('h3', { textContent: 'EARTH THROUGH TIME' }), h('div', { className: 'body-list' }, pill('EARTH TIMELINE ▸', () => go({ level: 'timeline', system: 'sol' })))); // #54
  if (m.isSol) extra.push(...magneticPanel.section(b.id)); // #38
  if (m.isSol && b.kind === 'moon' && PLANETSHINE[b.parent]) { // #49
    const ps = PLANETSHINE[b.parent], st = system.planetshineOf(b.id), dl = h('dl');
    const parent = m.bodies.find((x) => x.id === b.parent)?.name ?? b.parent;
    row(dl, ps.name, st ? `${st.f.toExponential(1)} OF SUNLIGHT · ${parent.toUpperCase()} ${Math.round((1 + Math.cos(st.alpha)) / 2 * 100)}% LIT FROM HERE` : 'COMPUTING…', 'computed',
      `Sunlight reflected by ${parent} onto ${b.name}'s night side: geometric albedo × (radius / distance)² × Lambert phase law. ${ps.source}. For comparison, earthshine on the Moon at new Moon is ~1×10⁻⁴ (BBSO: Qiu et al. 2003; Pallé et al. 2003).`);
    row(dl, 'ON SCREEN', 'BRIGHTENED (LOG EXPOSURE)', 'modelled', 'The eye adapts to a night side; a screen cannot show 10⁻⁴ beside full sunlight, so planetshine is drawn at 4% of full brightness for 10⁻⁴, +3% per decade, in the reflected light\'s colour.');
    extra.push(h('h3', { textContent: 'PLANETSHINE' }), dl);
  }
  if (b.kind === 'lagrange point') {
    const [a, c] = (b.pair ?? 'sun-earth').split('-').map((x) => x.toUpperCase());
    extra.push(h('h3', { textContent: 'WHAT IS A LAGRANGE POINT' }), h('div', { className: 'explain-figure' }, lagrangeDiagram(b.L, a, c)), h('p', { className: 'note explain', textContent: LAGRANGE_EXPLAINER }));
  }

  panel.replaceChildren(
    h('h2', { textContent: b.name.toUpperCase() }),
    h('div', { className: 'kind', textContent: `${sectorName(m)} · ${b.kind.toUpperCase()}` }),
    ...(b.marker ? extra : []),
    h('h3', { textContent: 'POSITION' }), pos,
    ...groups.flatMap(([g, facts]) => [h('h3', { textContent: g }), factList(facts, b)]),
    ...(b.marker ? [] : extra),
    b.skin?.map && credits[b.skin.map] ? h('p', { className: 'note credit', textContent: `IMAGE · ${credits[b.skin.map]}` }) : null,
    look,
    (live.range = h('p', { className: 'warn' })),
    h('div', { className: 'body-list' },
      inStarView ? pill('◀ SYSTEM VIEW', () => go({ level: 'system', system: m.id, body: b.id })) : pill('◀ SYSTEM', () => go({ level: 'system', system: m.id })),
      inStarView ? null : isStar ? pill('STAR VIEW ▸', () => go({ level: 'star', system: m.id, body: b.id })) :
        detailLevel(b) ? pill(`${detailLevel(b).toUpperCase()} VIEW ▸`, () => go({ level: detailLevel(b), system: m.id, body: b.id })) : null,
      b.parent ? pill(`◀ ${b.parent.toUpperCase()}`, () => go({ level: 'system', system: m.id, body: b.parent })) : null),
    ...(m.isSol && !inStarView ? lookAtSection(b, m) : []),
    ...(m.isSol ? sitesPanel.section(b) : []),
    ...(moonsOf(m, b.id).length ? [h('h3', { textContent: 'MOONS' }),
      h('div', { className: 'body-list' }, moonsOf(m, b.id).map((x) => pill(x.name.toUpperCase(), () => go({ level: 'system', system: m.id, body: x.id }))))] : []),
    b.note ? h('p', { className: 'note', textContent: b.note }) : null,
    ...(b.id === 'jwst' ? [h('h3', { textContent: 'OBSERVING NOW' }), h('div', { className: 'body-list' },
      pill('POINTED AT NOW · RECENT IMAGES ▸', () => satPanel.viewFeed({ kind: 'observing', mission: 'jwst', label: 'OBSERVING' }, 'JWST'))),
      h('p', { className: 'note', textContent: 'From STScI\'s published weekly schedule (the plan) and the newest public images in MAST.' })] : []),
    ...(b.kind === 'spacecraft' ? [h('h3', { textContent: 'COMMS · DEEP SPACE NETWORK' }), (live.dsnOne = h('div', { className: 'cm-list' }))] : []),
    ...(m.isSol && b.id === 'earth' ? [h('h3', { textContent: 'SATELLITES' }), satPanel.searchSection()] : []),
    renderLegend(),
  );
}

const moonsOf = (m, id) => m.bodies.filter((x) => x.kind === 'moon' && x.parent === id);

// LOOK AT (#43): see another body from this one, at its true size, phase and position
function lookAtSection(b, m) {
  if (b.marker) return [];
  const ground = !(b.starLike || b.kind === 'star' || b.kind === 'spacecraft' || b.kind === 'satellite');
  const look = (target, mode) => { system.lookAt(b.id, target, { mode }); };
  const picks = [b.parent, ...moonsOf(m, b.id).slice(0, 6).map((x) => x.id), 'sun', 'earth']
    .filter((id, i, a) => id && id !== b.id && a.indexOf(id) === i && m.bodies.some((x) => x.id === id));
  const name = (id) => m.bodies.find((x) => x.id === id)?.name.toUpperCase() ?? id;
  const sel = h('select', { className: 'ctl-select look-select', title: 'Anything else: planets, moons, small bodies, spacecraft' },
    h('option', { value: '', textContent: 'ANY BODY…' }),
    ...m.bodies.filter((x) => x.id !== b.id && !x.marker).map((x) => h('option', { value: x.id, textContent: x.name })));
  let mode = ground ? 'surface' : 'orbit';
  const modeBtn = ground ? pill('FROM THE SURFACE', () => { mode = mode === 'surface' ? 'orbit' : 'surface'; modeBtn.textContent = mode === 'surface' ? 'FROM THE SURFACE' : 'FROM ORBIT'; }, 'square') : null;
  sel.addEventListener('change', () => { if (sel.value) look(sel.value, mode); });
  return [h('h3', { textContent: `LOOK AT · FROM ${b.name.toUpperCase()}` }),
    h('div', { className: 'body-list' }, ...picks.map((id) => pill(`${name(id)} ▸`, () => look(id, mode))), sel, modeBtn),
    h('p', { className: 'note', textContent: ground
      ? 'Stand on it where the target is up in the sky (or hover above it, FROM ORBIT): true size, phase and light-time, with naked-eye and telescope fields.'
      : 'Hover just above it and look: true size, phase and light-time.' })];
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

// ---- galaxy panel ------------------------------------------------------------------------
// Galactic deep time (#18) follows the ship's clock (#34), within ±2 Gyr (see syncDeepTime).
const myr = (t) => (Math.abs(t) < 1 ? `${fmt(t * 1000, 0)} THOUSAND YEARS` : Math.abs(t) < 1000 ? `${fmt(t, Math.abs(t) < 10 ? 1 : 0)} MILLION YEARS` : `${fmt(t / 1000, 2)} BILLION YEARS`);
function galEpochText() {
  const t = galaxy.epoch;
  if (Math.abs(t) < 1e-6) return 'NOW';
  return `${t > 0 ? '+' : '−'}${myr(Math.abs(t))} · ${fmt(Math.abs(t) / GALACTIC_YEAR_MYR, 2)} GALACTIC YEARS · SUN TURNED ${fmt((Math.abs(t) * OMEGA_SUN * 180) / Math.PI % 360, 0)}°`;
}
function renderGalaxyPanel() {
  resetLive();
  const fleet = pill(settings.get('starfleet') ? 'STARFLEET OVERLAY: ON' : 'STARFLEET OVERLAY: OFF', () => {
    settings.set('starfleet', !settings.get('starfleet'));
    renderGalaxyPanel();
  }, settings.get('starfleet') ? 'on' : '');
  live.galEpoch = h('p', { className: 'warn mono', textContent: galEpochText() });
  const gaia = galaxy.gaiaCount;
  panel.replaceChildren(
    h('h2', { textContent: 'MILKY WAY' }),
    h('div', { className: 'kind', textContent: 'BARRED SPIRAL GALAXY · SEEN FROM GALACTIC NORTH' }),
    ...starCardFor('galaxy'),
    starCardFor('galaxy').length ? null : h('p', { className: 'note', textContent: 'Click any star to investigate it; double-click to drill down (a catalogue star opens Navigation, anywhere else the Quadrant).' }),
    h('h3', { textContent: 'VIEW' }),
    h('div', { className: 'body-list' },
      pill('WHOLE GALAXY', () => galaxy.view('galaxy')), pill('SOLAR NEIGHBOURHOOD', () => galaxy.view('sol')), pill('GAIA STARS', () => galaxy.view('gaia')),
      pill('GALACTIC CENTRE', () => galaxy.view('centre')), pill('SATELLITE GALAXIES', () => galaxy.view('satellites'))),
    h('h3', { textContent: 'GALAXY MODEL' }),
    h('div', { className: 'body-list' },
      ...[[0.2, 'FAINT'], [0.45, 'SOFT'], [0.8, 'BRIGHT'], [1.3, 'VIVID']].map(([k, label]) => pill(label, () => { settings.set('galaxyBright', k); galaxy.applyLook(); quadrant.applyLook(); renderGalaxyPanel(); }, Math.abs((settings.get('galaxyBright') ?? 0.45) - k) < 0.01 ? 'on' : '')),
      pill(settings.get('galaxyArt') ? 'ARTWORK OVERLAY: ON' : 'ARTWORK OVERLAY: OFF', () => { settings.set('galaxyArt', !settings.get('galaxyArt')); galaxy.applyLook(); quadrant.applyLook(); renderGalaxyPanel(); }, settings.get('galaxyArt') ? 'on' : '')),
    h('p', { className: 'note', textContent: 'A 3D model built from measurements: the bar and bulge, thin and thick discs, the spiral arms traced by masers in star-forming regions (blue: young stars; pink: HII regions; dark: dust lanes) and the halo. Our side of the arms is measured; the far side is extrapolated.' }),
    h('h3', { textContent: 'GALACTIC TIME' }),
    live.galEpoch,
    h('p', { className: 'note', textContent: 'Galactic time is the ship\'s clock: run it from the TIME row below (MYR/S or GYR/S; ⇄ REV runs it backwards, NOW returns). The galaxy shows ±2 billion years, and the clock stops there.' }),
    h('p', { className: 'note', textContent: 'Stars circle the centre on a flat rotation curve, so the inner disc laps the outer and the neighbourhood smears into an arc. The spiral arms are a pattern that turns at its own speed; the Sun sits close to corotation, so it keeps pace with them. The satellite galaxies follow their orbits (±2 billion years).' }),
    h('h3', { textContent: 'QUADRANTS' }),
    h('div', { className: 'body-list' }, fleet, pill('NAVIGATION ▸', () => go({ level: 'navigation', system: currentSystem }))),
    h('p', { className: 'note', textContent: 'Orange spokes: the real IAU galactic quadrants I–IV, measured by galactic longitude from the Sun. The Starfleet overlay draws Star Trek\'s Alpha–Delta quadrants, centred on the galactic core.' }),
    h('h3', { textContent: 'FACTS' }),
    factList([
      { label: 'SOL → CENTRE', value: `${R0_KLY.toFixed(1)} KLY`, tier: 'measured', detail: 'R₀ = 8.178 kpc from stars orbiting Sgr A* (GRAVITY Collaboration 2019).' },
      { label: 'SOL ABOVE PLANE', value: '68 LY', tier: 'measured', detail: 'z₀ = 20.8 pc (Bennett & Bovy 2019).' },
      { label: 'SOL ORBIT SPEED', value: `≈ ${VC_KMS} KM/S`, tier: 'measured', detail: 'Circular velocity at the Sun (e.g. Eilers et al. 2019); the Sun itself moves ~12 km/s faster than that (Schönrich et al. 2010).' },
      { label: 'GALACTIC YEAR', value: `≈ ${fmt(GALACTIC_YEAR_MYR, 0)} MILLION YR`, tier: 'computed', detail: '2πR₀ / v. The last time the Sun was here, the first dinosaurs were appearing.' },
      { label: 'ARM PATTERN SPEED', value: '28.2 KM/S/KPC', tier: 'measured', detail: `From the birthplaces of Gaia open clusters (Dias et al. 2019): one turn in ${fmt((2 * Math.PI) / OMEGA_PATTERN, 0)} million years, close to the Sun's own.` },
      { label: 'ROTATION MODEL', value: 'FLAT CURVE', tier: 'modelled', detail: 'Every star on a circular orbit at its present radius; real stars also oscillate in and out and up and down (epicycles), so this shows the shear, not individual futures.' },
      { label: 'STARS', value: '100–400 BILLION', tier: 'modelled', detail: 'From the galaxy\'s mass and light; nobody has counted them.' },
      { label: 'SGR A* MASS', value: '4.3 MILLION × SUN', tier: 'measured', detail: 'From the orbit of the star S2 (GRAVITY 2019); imaged by the Event Horizon Telescope in 2022.' },
      { label: 'GALAXY MODEL', value: `${fmt(galaxy.modelComponents.reduce((n, c) => n + c.count, 0), 0)} PARTICLES`, tier: 'modelled', detail: 'Bar and boxy bulge (Wegg & Gerhard 2013; bar angle 27°), thin disc (scale length 2.6 kpc, height 0.3 kpc) and thick disc (2.0, 0.9 kpc; Bland-Hawthorn & Gerhard 2016), spiral arms from maser parallaxes (Reid et al. 2019; arms continued at a 12° pitch beyond the measured range), dust on the arms\' inner edges, stellar halo ρ ∝ r^−3.5 (Deason et al. 2011). Particles are illustrative: each stands for millions of stars.' },
      { label: 'ARTWORK', value: settings.get('galaxyArt') ? "ARTIST'S CONCEPT · ON" : "ARTIST'S CONCEPT · OFF", tier: 'imagined', detail: `NASA/JPL-Caltech/R. Hurt (SSC/Caltech), PIA10748, built from Spitzer data. We cannot photograph our galaxy from outside. Scaled so Sol sits at R₀; the image spans ${IMAGE.widthKly.toFixed(0)} kly.` },
      { label: 'NEAR STARS', value: 'HYG · TO 1.5 KLY', tier: 'measured', detail: 'Every HYG star within 1,500 ly brighter than absolute magnitude 2, at its parallax position.' },
      { label: 'FAR STARS', value: gaia ? `${fmt(gaia, 0)} · GAIA DR3` : 'GAIA DR3 · LOADING', tier: 'measured', detail: 'Gaia DR3 stars brighter than G = 9 with parallax better than 10%, beyond ~1.6 kly: they trace the Orion Spur and reach into the Perseus and Sagittarius arms. Dust hides everything farther, which is why the galaxy beyond is still drawn from a concept.' },
      { label: 'STARS IN OTHER GALAXIES', value: 'ONLY THE BRIGHTEST', tier: 'measured', detail: 'Gaia measures individual stars in the Magellanic Clouds, but their parallaxes are too small to place them one by one; Hubble resolves stars in Andromeda. So the Clouds are shown as images.' },
      ...galaxyBandFacts(), // the spectrum filter (#28)
      { label: 'SATELLITE ORBITS', value: 'INTEGRATED · ±2 GYR', tier: 'modelled', detail: 'From HST proper motions (Kallivayalil et al. 2013) and Law & Majewski 2010 for Sagittarius, in a simple halo (233 km/s, no dynamical friction). The Clouds may be on their first pass, so treat the past half (dashed) as a sketch.' },
    ]),
    renderLegend(),
  );
}
/** The spectrum filter (#28) in the Galaxy panel: what the model shows in the band, and each Cloud's image. */
function galaxyBandFacts() {
  const bi = galaxy.bandInfo, cb = currentBand(), out = [];
  if (!cb.full) out.push({ label: `SPECTRUM · ${cb.band.short ?? cb.band.label}`, value: bi.model.value, tier: bi.model.dark ? 'computed' : 'modelled',
    detail: `${bi.model.detail} Each component of the model is re-weighted by its spectrum through ${cb.pass?.label ?? 'the band'} (src/astro/galaxyband.js); the gas disc and the Fermi and eROSITA bubbles exist only outside the visible.` });
  for (const [id, name] of [['lmc', 'LMC IMAGE'], ['smc', 'SMC IMAGE']]) {
    const c = bi.clouds[id];
    if (c) out.push({ label: name, value: c.value, tier: c.tier, detail: `${c.detail} Drawn at the Cloud's real diameter (LMC 32 kly, SMC 19 kly), always facing you.` });
  }
  return out;
}

// ---- quadrant & universe panels ------------------------------------------------------------
const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;
const keyRow = (color, label, sub) => h('div', { className: 'ck-row' }, h('span', { className: 'ck-dot', style: `background:${color}` }), h('span', { textContent: label }), h('span', { className: 'ck-sub', textContent: sub }));
const lightLeft = (ly) => (ly < 1e4 ? `LIGHT LEFT IN ${Math.round(yearOf(clock.jd) - ly)}` : ly < 1e6 ? `LIGHT LEFT ${fmt(ly / 1000, 0)},000 YEARS AGO` : `LIGHT LEFT ${fmt(ly / 1e6, ly < 1e7 ? 1 : 0)} MILLION YEARS AGO`);
const lyText = (ly) => (ly < 1e4 ? `${fmt(ly, 0)} LY` : ly < 1e6 ? `${fmt(ly / 1000, 1)} KLY` : `${fmt(ly / 1e6, 1)} MLY`);

function objectList(objs, radiusLy, sel, pick) {
  const inside = objs.filter((o) => o.distLy <= radiusLy * 1.02).sort((a, b) => a.distLy - b.distLy);
  return h('div', { className: 'host-list' }, inside.slice(0, 60).map((o) => {
    const b = h('button', { className: `host-row${o.id === sel ? ' on' : ''}` }, h('span', { textContent: o.name.toUpperCase() }), h('span', { className: 'mono', textContent: lyText(o.distLy) }));
    b.addEventListener('click', () => pick(o.id));
    return b;
  }));
}

function renderQuadrantPanel() {
  resetLive();
  const R = quadrant.radius, c = quadrant.counts();
  const sel = quadrant.object(quadrantSel);
  const selBlock = deepSkyDetail({ h, factList, fmt, lyText, lightLeft, sel, detail: sel && quadrant.detail(sel.id) }); // #24
  const ages = [[6.7, 'UNDER 10 MILLION YEARS'], [8, '100 MILLION YEARS'], [9.2, 'OVER A BILLION YEARS']];
  panel.replaceChildren(
    h('h2', { textContent: 'OUR QUADRANT' }),
    h('div', { className: 'kind', textContent: 'THE MILKY WAY AROUND SECTOR 001 · GALACTIC PLANE HORIZONTAL' }),
    ...starCardFor('quadrant'),
    h('h3', { textContent: 'RANGE' }),
    h('div', { className: 'body-list' }, [1000, 3000, 10000, 30000].map((r) => pill(`${fmt(r / 1000, 0)} KLY`, () => { quadrant.setRadius(r); renderQuadrantPanel(); }, r === R ? 'on' : ''))),
    h('p', { className: 'note', textContent: `${fmt(c.clusters, 0)} STAR CLUSTERS · ${c.nebulae} LANDMARK NEBULAE WITHIN ${fmt(R, 0)} LY` }),
    ...selBlock,
    h('h3', { textContent: 'LANDMARKS · NEAREST FIRST' }), objectList(quadrant.objects, R, quadrantSel, (id) => { quadrantSel = id; quadrant.select(id); renderQuadrantPanel(); }),
    h('h3', { textContent: 'KEY' }),
    h('div', { className: 'colour-key' },
      ...ages.map(([a, l]) => keyRow(hex(rgbToHex(blackbodyRGB(ageTeff(a)))), `CLUSTER · ${l}`, a < 7 ? 'HOT BLUE STARS STILL SHINING' : a > 9 ? 'ONLY COOL RED STARS LEFT' : '')),
      ...Object.entries(NEBULA_COLORS).map(([k, col]) => keyRow(hex(col), NEBULA_KIND[k], '')),
      keyRow('#d8d0c0', 'STARS (HYG, BRIGHTER THAN M = 2)', 'OUT TO 1.5 KLY')),
    h('div', { className: 'body-list' }, pill('◀ NAVIGATION', () => go({ level: 'navigation', system: currentSystem })), pill('GALAXY ▸', () => go({ level: 'galaxy' }))),
    factList([
      { label: 'CLUSTERS', value: 'GAIA DR3', tier: 'measured', detail: 'Hunt & Reffert 2023: 7,167 clusters found in Gaia DR3 with distances and ages.' },
      { label: 'NEBULAE', value: 'REAL IMAGES, 3D BY MODEL', tier: 'measured', detail: 'Hubble, Webb, ESO, Chandra and sky-survey images at true size, distance and orientation (#24). Their depth is MODELLED: select a nebula for its model.' },
      { label: 'BACKGROUND', value: "ARTIST'S CONCEPT", tier: 'imagined', detail: 'NASA/JPL-Caltech PIA10748, calibrated so Sol sits at R₀ (see Galaxy View).' },
    ]),
    renderLegend(),
  );
}

/** Image, orientation and shape rows for a galaxy drawn with its real image (#50). */
function galaxyFormFacts(g) {
  if (!g) return [];
  return [
    { label: 'IMAGE', value: `${g.img.survey === 'twomass' ? '2MASS NEAR-IR' : 'DSS2 COLOUR'} · ${g.img.date}`, tier: 'measured', detail: `${g.img.credit}. ${g.img.licence}. Cutout ${g.img.fov.toFixed(0)}′ wide, north up, centred on RA ${g.ra.toFixed(3)}°, Dec ${g.dec.toFixed(3)}°.` },
    { label: 'ORIENTATION', value: `PA ${g.pa}° · INCLINATION ${g.incl}°${g.near ? ` · ${g.near} SIDE NEARER` : ''}`, tier: g.orient, detail: `${g.orientSource}.${g.near ? '' : ' Which side is nearer is not established here: one of the two mirror-image tilts is drawn.'}` },
    { label: 'SIZE', value: `D25 ${g.d25}′`, tier: 'measured', detail: 'Major axis to the 25 mag/arcsec² isophote (RC3 / HyperLEDA), drawn at the galaxy\'s distance.' },
    { label: 'SHAPE', value: g.type === 'elliptical' ? 'ELLIPSOID GLOW + IMAGE ON THE SKY PLANE' : g.type === 'spiral' ? 'DISC + BULGE + THICKNESS GLOW' : 'DISC + THICKNESS GLOW', tier: 'modelled',
      detail: g.type === 'elliptical' ? 'An oblate ellipsoid with the observed axis ratio; the true 3D shape of an elliptical is not known from one viewpoint.' : 'The image is projected onto a thin disc (scale height ~2% of D25) so it looks exactly as observed from the Milky Way; seen from elsewhere, the disc texture is an approximation (the far side, dust and bulge are not reconstructed).' },
  ];
}

function renderUniversePanel() {
  resetLive();
  const R = universe.radius, c = universe.counts();
  const sel = universe.objects.find((o) => o.id === universeSel);
  const selBlock = sel ? [
    h('h3', { textContent: 'SELECTED' }), h('h2', { className: 'sel-name', textContent: sel.name.toUpperCase() }),
    factList(sel.kind === 'galaxy' ? [
      { label: 'TYPE', value: typeName(sel.type), tier: 'measured', detail: `Morphological type T = ${sel.type} (UNGC).` },
      { label: 'DISTANCE', value: lyText(sel.distLy), tier: 'measured', detail: `Method: ${sel.method ?? '—'} (Cep = Cepheids, TRGB = tip of the red-giant branch, TF = Tully–Fisher, h = Hubble flow).` },
      ...(sel.diameterKpc ? [{ label: 'DIAMETER', value: `${fmt(sel.diameterKpc * 3.26156, 0)},000 LY`, tier: 'measured', detail: 'Holmberg-like diameter at 26.5 mag/arcsec² (UNGC).' }] : []),
      ...(sel.absB != null ? [{ label: 'BRIGHTNESS', value: `M_B ${fmt(sel.absB, 1)}`, tier: 'computed', detail: 'Absolute blue magnitude; the Milky Way is about −20.8.' }] : []),
      { label: 'LIGHT', value: lightLeft(sel.distLy), tier: 'computed' },
      ...galaxyFormFacts(universe.formOf(sel.id)),
    ] : [
      { label: 'TYPE', value: 'CLUSTER OF GALAXIES', tier: 'measured' },
      { label: 'DISTANCE', value: lyText(sel.distLy), tier: 'measured', detail: 'Literature distance (Cosmicflows).' },
      { label: 'LIGHT', value: lightLeft(sel.distLy), tier: 'computed' },
    ]),
    sel.note ? h('p', { className: 'note', textContent: sel.note }) : null,
  ] : [];
  panel.replaceChildren(
    h('h2', { textContent: 'THE NEARBY UNIVERSE' }),
    h('div', { className: 'kind', textContent: 'CENTRED ON THE MILKY WAY · SUPERGALACTIC PLANE HORIZONTAL' }),
    h('h3', { textContent: 'DISTANCE FILTER' }),
    h('div', { className: 'body-list' }, [3, 30, 100, 300, 1000, 2500].map((r) => pill(`${fmt(r, 0)} MLY`, () => { universe.setRadius(r); renderUniversePanel(); }, r === R ? 'on' : ''))),
    h('p', { className: 'note', textContent: `${fmt(c.galaxies, 0)} CATALOGUED NEARBY GALAXIES · ${fmt(c.groups, 0)} GALAXY GROUPS WITHIN ${fmt(R, 0)} MILLION LY` }),
    ...selBlock,
    h('h3', { textContent: 'LANDMARKS · NEAREST FIRST' }), objectList(universe.objects, R * 1e6, universeSel, (id) => { universeSel = id; universe.select(id); renderUniversePanel(); }),
    h('h3', { textContent: 'KEY' }),
    h('div', { className: 'colour-key' },
      keyRow(hex(rgbToHex(blackbodyRGB(4300))), 'ELLIPTICAL / LENTICULAR', 'OLD STARS'),
      keyRow(hex(rgbToHex(blackbodyRGB(6200))), 'SPIRAL', ''),
      keyRow(hex(rgbToHex(blackbodyRGB(9000))), 'IRREGULAR / DWARF', 'YOUNG STARS'),
      keyRow('#c0ccff', 'GALAXY GROUP (COSMICFLOWS-4)', 'SIZE = NUMBER OF GALAXIES'),
      keyRow('#ffcc66', 'GOLD ARROW: LOCAL GROUP MOTION', `${MOTION.lg.kms} KM/S THROUGH THE COSMIC MICROWAVE BACKGROUND`),
      keyRow('#ff8866', 'RED ARROW: ANDROMEDA APPROACHING', `${-MOTION.m31.radialKms} KM/S · MERGER IN ~${MOTION.m31.mergeGyr} GYR`)),
    h('p', { className: 'note', textContent: 'Double-click the Milky Way to drill down into the Galaxy View.' }),
    h('div', { className: 'body-list' }, pill('◀ GALAXY', () => go({ level: 'galaxy' }))),
    factList([
      { label: 'NEARBY GALAXIES', value: '869 · UNGC', tier: 'measured', detail: 'Karachentsev et al. 2013: every known galaxy within ~11 Mpc (36 million ly).' },
      { label: 'GROUPS', value: '38,000 · COSMICFLOWS-4', tier: 'measured', detail: 'Tully et al. 2023: galaxy groups with distances measured independently of redshift.' },
      { label: 'LOCAL GROUP MOTION', value: `${MOTION.lg.kms} KM/S`, tier: 'measured', detail: `Gold arrow. The cosmic microwave background looks hotter one way than the other: we move through it towards l = ${MOTION.lg.l}°, b = +${MOTION.lg.b}° (COBE, Planck), mostly pulled by the Great Attractor and the Shapley Supercluster. That is ${fmt(MOTION.lg.kms * 3.3356e-3, 1)} million ly every billion years.` },
      { label: 'ANDROMEDA', value: `${-MOTION.m31.radialKms} KM/S CLOSING`, tier: 'measured', detail: `Red arrow (zoom to 3 or 10 MLY). Its blueshift and Hubble proper motions (~${MOTION.m31.tangentialKms} km/s sideways; van der Marel et al. 2019) give a near head-on approach.` },
      { label: 'MILKOMEDA', value: `IN ~${MOTION.m31.mergeGyr} BILLION YR`, tier: 'modelled', detail: 'N-body simulations put the first pass in ~4 billion years and the merger into one elliptical galaxy ~2 billion years later; newer Gaia-based work gives it only ~50% odds within 10 billion years (Sawala et al. 2025).' },
      ...(currentBand().full ? [] : [{ label: `SPECTRUM · ${currentBand().band.short ?? currentBand().band.label}`, value: 'RE-WEIGHTED BY TYPE', tier: 'modelled',
        detail: `${typeBandNote(currentBand().pass?.filter) ?? ''} Each galaxy's catalogued blue brightness is scaled by a typical spectrum of its type through ${currentBand().pass?.label ?? 'the band'} (src/astro/galaxyband.js), in the band's false colour; groups as a spiral-like mix. Not measured galaxy by galaxy.` }]), // #28
      { label: 'DOTS', value: 'POSITIONS, NOT SIZES', tier: 'imagined', detail: 'Dot size encodes brightness or richness; real galaxies are far smaller than the gaps between them.' },
      { label: 'GALAXY IMAGES', value: '17 NEAREST BIG GALAXIES', tier: 'measured', detail: 'Zoom in (or select one) and M31, M33, M81, M82, M83, M101, M51, M104, NGC 253, NGC 4945, Centaurus A, M32, M110, NGC 6822, IC 10 and Maffei 1/2 appear at their real D25 size from their survey images (DSS2; 2MASS behind the Milky Way), turned to their measured position angle and inclination. Shapes are MODELLED over MEASURED imagery; the Magellanic Clouds\' Spitzer images are in the Galaxy View (#18).' },
    ]),
    h('p', { className: 'note', textContent: 'Empty wedges above and below are the Zone of Avoidance: the Milky Way\'s own dust hides what lies behind it.' }),
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

  const sel = navSelected && (d.stars.find((s) => s.id === navSelected) ?? nav.findStar(navSelected)); // or a deep-time arrival (#29)
  let selBlock = [];
  if (sel) {
    const dl = h('dl');
    row(dl, 'FROM HERE', `${fmt(distLy(sel, c), 2)} LY`, 'measured', 'From parallax distances in the catalogue.');
    if (c.id !== 'sol' && sel.id !== 'sol') {
      const sol = d.stars.find((s) => s.id === 'sol');
      if (sol) row(dl, 'FROM SOL', `${fmt(distLy(sel, sol), 2)} LY`, 'measured', 'Parallax.');
    }
    if (sel.spect) row(dl, 'CLASS', sel.spect, 'measured', 'Spectral type.');
    const gaiaOnly = sel.vSrc === 3; // a deep-time arrival from the Gaia DR3 RV slice (#29)
    if (sel.absmag != null) row(dl, 'ABS. MAGNITUDE', fmt(sel.absmag, 2), 'computed', gaiaOnly ? 'V estimated from Gaia G and BP−RP (Riello et al. 2021) and the Gaia parallax.' : 'From apparent brightness and distance.');
    if (!gaiaOnly) row(dl, 'KNOWN PLANETS', String(sel.planets || 0), 'measured', sel.planets ? 'NASA Exoplanet Archive.' : 'None detected yet, which is not the same as none.');
    row(dl, 'CATALOGUE', gaiaOnly ? 'GAIA DR3 · RADIAL-VELOCITY SLICE' : sel.archiveOnly === 2 ? 'BROWN DWARF · LITERATURE' : sel.archiveOnly ? 'EXOPLANET ARCHIVE' : sel.vSrc ? 'HYG v4.4 · GAIA DR3 MOTION' : 'HYG v4.4', 'measured',
      gaiaOnly ? 'Too faint for Hipparcos/HYG: position, parallax, proper motion and radial velocity all from Gaia DR3 (parallax > 10 mas, parallax/error > 10). Loaded only for deep time.'
        : sel.archiveOnly === 2 ? 'Too faint for Hipparcos; found by WISE. Parallax from the discovery and follow-up papers.' : sel.archiveOnly ? 'Too faint for HYG; position from the Exoplanet Archive.' : sel.vSrc ? 'Hipparcos / Yale / Gliese compilation; position and space motion from Gaia DR3 (#29).' : 'Hipparcos / Yale / Gliese compilation.');
    selBlock = [
      h('h3', { textContent: 'SELECTED' }),
      h('h2', { className: 'sel-name', textContent: sel.name.toUpperCase() }),
      dl,
      gaiaOnly ? h('p', { className: 'note', textContent: 'Not in the chart catalogue, so there is no system to warp to or chart to centre on it; it appears only in deep time.' })
        : h('div', { className: 'body-list' },
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
    ...navList.render(d, (s) => distLy(s, c), navSelected),
    ...motionSection(d),
    ...transmissionSection(d, sel),
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

// ---- space motion & deep time (#20) ---------------------------------------------------------
// Deep time follows the ship's clock (#34); orbits are integrated ±50 Myr (src/astro/galpot.js).
const yrs = (t) => (Math.abs(t) >= 1e6 ? `${fmt(t / 1e6, 2)} MILLION YEARS` : `${fmt(t, 0)} YEARS`);
function motionSection(d) {
  const m = nav.motion, c = d.center;
  const enc = nav.encounters(5e6).filter((e) => e.tYears > 0 && e.dMinLy < e.nowLy).sort((a, b) => a.dMinLy - b.dMinLy).slice(0, 6);
  live.epoch = h('p', { className: 'warn mono' });
  return [
    h('h3', { textContent: 'SPACE MOTION' }),
    h('div', { className: 'body-list' },
      pill('OFF', () => { nav.setMotion({ mode: 'off' }); renderNavPanel(); }, m.mode === 'off' ? 'on' : ''),
      pill(`RELATIVE TO ${c.id === 'sol' ? 'SOL' : c.name.toUpperCase()}`, () => { nav.setMotion({ mode: 'relative' }); renderNavPanel(); }, m.mode === 'relative' ? 'on' : ''),
      pill('AROUND THE GALAXY', () => { nav.setMotion({ mode: 'galactic' }); renderNavPanel(); }, m.mode === 'galactic' ? 'on' : '')),
    m.mode === 'off' ? null : h('div', { className: 'body-list' }, [[1e4, '10 KYR'], [1e5, '100 KYR'], [1e6, '1 MYR']].map(([w, label]) =>
      pill(`ARROWS · ${label}`, () => { nav.setMotion({ window: w }); renderNavPanel(); }, m.window === w ? 'on' : ''))),
    h('p', { className: 'note', textContent: m.mode === 'galactic'
      ? 'Each arrow is a star\'s velocity around the galactic centre right now in deep time (Sun: ~245 km/s towards l = 90°), drawn over the arrow window. Run deep time and the neighbourhood streams that way together, the chart riding along; the slow spreading is each star\'s own 20–50 km/s, and the arrows turn as the orbits curve.'
      : m.mode === 'relative' ? `Arrows: where each star goes, seen from ${c.id === 'sol' ? 'the Sun' : c.name}. Dim arrows have no measured radial velocity, so only their sideways motion is known. The gold arrow is Sol's own path around the galaxy (~250 km/s), which carries the whole neighbourhood with it.` : 'Show where each star is heading.' }),
    h('p', { className: 'note', textContent: 'Green lines: every system within 8 ly of Sol, with its distance. Run deep time to watch stars come and go.' }),
    h('div', { className: 'ctl-label', textContent: 'DEEP TIME' }),
    live.epoch,
    h('p', { className: 'note', textContent: 'Deep time is the ship\'s clock: run it from the TIME row below (KYR/S or MYR/S; ⇄ REV runs it backwards, NOW returns). Orbits are integrated ±50 million years, and the clock stops there.' }),
    h('h3', { textContent: `CLOSEST FUTURE PASSES · ${c.id === 'sol' ? 'SOL' : c.name.toUpperCase()}` }),
    h('div', { className: 'host-list' }, enc.length ? enc.map((e) => {
      const b = h('button', { className: 'host-row' }, h('span', { textContent: `${e.star.name.toUpperCase()}${e.rvKnown ? '' : ' *'}${e.arrival ? ` · NOW ${fmt(e.nowLy, 0)} LY` : ''}` }),
        h('span', { className: 'mono', textContent: `${fmt(e.dMinLy, 2)} LY IN ${yrs(e.tYears)}` }));
      b.addEventListener('click', () => { nav.setMotion({ mode: 'relative' }); clock.setRate(0); clock.setYears(e.tYears); syncDeepTime(); selectNavStar(e.star.id); });
      return b;
    }) : [h('p', { className: 'note', textContent: 'No star comes closer within 5 million years.' })]),
    h('p', { className: 'note', textContent: `Every star follows its integrated orbit through a Milky Way mass model (bulge, disc and dark halo; Bovy 2015), ±50 million years. Velocities: Gaia DR3 parallaxes, proper motions and radial velocities where Gaia has the star, otherwise HYG (Hipparcos proper motions and catalogue radial velocities); 1 km/s of error moves a star ~3 ly per million years. A system's stars share its best-measured motion. * no radial velocity: the real pass could be quite different. Gaia DR3 puts Gliese 710 at ~0.17 ly (10,800 AU) in 1.29 million years.${nav.unmoved ? ` ${nav.unmoved} star${nav.unmoved === 1 ? '' : 's'} with no measured motion ${nav.unmoved === 1 ? 'is' : 'are'} hidden away from the present.` : ''}` }),
    arrivalsNote(),
  ];
}
/** Where deep-time arrivals come from and how far they reach (#29). */
function arrivalsNote() {
  const a = nav.arrivals;
  if (!a) return null;
  const n = (x) => fmt(x, 0);
  const text = a.preview
    ? `Arrivals: this preview only holds stars within ${a.previewLy} ly of Sol, so in deep time the sphere empties sooner than it should. Run the local backend (npm start) for every catalogue star with a measured motion within ${n(1000)} ly.`
    : a.error ? `Arrivals unavailable: ${a.error}.`
    : `Arrivals: ${n(a.count)} stars with measured motions out to ${n(a.loadedLy)} ly${a.loading ? ` (${a.loading.toLowerCase()})` : ''} are integrated too; each appears when it enters the sphere and the chart's own stars vanish when they leave. More load as deep time runs further (out to ${n(1000)} ly). ${gaiaRvNote(a)}`;
  return h('p', { className: 'note', textContent: text });
}

// ---- one clock for every view (#34) ---------------------------------------------------------
// Each view honours the part of time valid for it: the clock stops at its edges, with the reason.
const NAV_LIMIT_YEARS = 5e7, GALAXY_LIMIT_YEARS = 2e9;
function limitFor(level) {
  if (level === 'navigation') return yearsLimit(NAV_LIMIT_YEARS, 'ORBITS INTEGRATED ±50 MYR');
  if (level === 'galaxy') return yearsLimit(GALAXY_LIMIT_YEARS, 'SATELLITE ORBITS ±2 GYR');
  if (level === 'quadrant' || level === 'universe') return null; // the calendar (±273 kyr)
  // the System View and its detail views: the ephemeris's span
  return settings.get('ephemeris') === 'horizons'
    ? calendarLimit(1, 9999, 'JPL HORIZONS · 1–9999 CE') // the backend asks Horizons for YYYY-MM months
    : calendarLimit(-2999, 3000, 'KEPLER ELEMENTS · 3000 BCE–3000 CE'); // Standish's long-span elements
}
const applyTimeLimit = () => clock.setLimit(limitFor(route.level));
settings.onChange((k) => { if (k === 'ephemeris') applyTimeLimit(); });
/** Deep-time views follow the clock: the Navigation View's epoch (years) and the Galaxy View's (Myr). */
function syncDeepTime() {
  const y = Math.round(clock.years); // whole years: at the present the views show the catalogue epoch exactly
  if (route.level === 'navigation') {
    const t = Math.max(-NAV_LIMIT_YEARS, Math.min(NAV_LIMIT_YEARS, y));
    if (t !== nav.epoch) nav.setEpoch(t);
    if (live.epoch) live.epoch.textContent = t === 0 ? 'EPOCH: NOW' : `EPOCH: ${t > 0 ? '+' : '−'}${yrs(Math.abs(t))} · YEAR ${fmt(yearOf(jdFromDate(new Date())) + t, 0)}`;
  } else if (route.level === 'galaxy') {
    const t = Math.max(-GALAXY_LIMIT_YEARS, Math.min(GALAXY_LIMIT_YEARS, y)) / 1e6;
    if (t !== galaxy.epoch) { galaxy.setTime(t); if (live.galEpoch) live.galEpoch.textContent = galEpochText(); }
  }
}

/** What the Gaia DR3 radial-velocity slice adds to the arrivals, and what is still missing (#29). */
function gaiaRvNote(a) {
  const n = (x) => fmt(x, 0), g = a.gaiaRv, b = a.bySource ?? [0, 0, 0, 0];
  const counts = `Loaded so far: ${n(b[1] + b[2])} Hipparcos stars with Gaia DR3 motions, ${n(b[3])} Gaia DR3 radial-velocity stars not in HYG, ${n(b[0])} with HYG motions.`;
  if (g?.status === 'ok' && a.completeness) {
    const lost = a.completeness.classes.filter((c) => c.mergedLy != null && c.mergedLy < 200).map((c) => `${c.label} beyond ~${n(c.mergedLy)} ly`);
    return `${counts} The Gaia slice (${n(g.rows)} stars with a radial velocity and parallax > 10 mas; ${n(g.noisy)} set aside for RV errors of 5 km/s or more, ${n(g.matched)} already in HYG) fills in K and early-M dwarfs out to ${n(a.completeness.gaiaLy)} ly; the sphere's density halves beyond ~${a.completeness.density?.halfLy ?? '?'} ly instead of ~${a.density?.halfLy ?? 60}.${lost.length ? ` Still missing: ${lost.join(', ')} (Gaia measures radial velocities only to G_RVS ≈ 14), and brown dwarfs.` : ''}`;
  }
  if (g?.status === 'loading') return `${counts} Gaia DR3 radial-velocity stars are still loading.`;
  return `${counts} Beyond ~${a.density?.halfLy ?? 60} ly the catalogue holds mainly the brighter stars, so arrivals under-count faint red and brown dwarfs${g?.status === 'error' ? ` (the Gaia DR3 radial-velocity slice failed: ${g.error})` : ''}.`;
}

// ---- message light-time (#16) --------------------------------------------------------------
const ago = (iso) => {
  if (!iso) return '';
  const m = (Date.now() - Date.parse(iso.endsWith('Z') ? iso : `${iso}Z`)) / 60000;
  return m < 90 ? `${Math.max(0, Math.round(m))} MIN OLD` : m < 2880 ? `${(m / 60).toFixed(1)} H OLD` : `${(m / 1440).toFixed(1)} DAYS OLD`;
};
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
    applyPendingCam(nav.camera);
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
  $('stardate').textContent = clock.inCalendar ? `${shipDate(date)} · ${date.toISOString().slice(0, 16).replace('T', ' ')} UTC` : `DEEP TIME · ${formatOffset(clock.years)}`;
  if (document.activeElement !== dateIn) dateIn.value = isoDay(date);
  const m = system.model;

  // sky events (#30): the Sun from JPL Horizons where its months are loaded, Standish elsewhere
  const hz = settings.get('ephemeris') === 'horizons';
  useEarthEphemeris(hz ? earthHz : null);
  if (m?.isSol) {
    if (hz) preloadMonth('399', clock.jd);
    requestEvents(clock.jd, () => (hz ? loadedRows('399') : null));
    skyPanel.tick();
  }
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

  if (['system', 'star', 'planet', 'moon', 'object'].includes(route.level) && route.body && m && (f || route.level !== 'system')) {
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
    if (live.ephem) {
      const end = ephemerisEnd(live.ephemHz), past = end && clock.jd > jdFromDate(new Date(`${end}T00:00:00Z`));
      live.ephem.textContent = !end ? 'JPL HORIZONS' : past ? `ENDED ${end} · NOT DRAWN` : `PUBLISHED TO ${end}`;
      live.ephem.classList.toggle('warn', !!past);
    }
    if (live.skin) {
      const l = system.liveSkinOf(live.skinBody);
      live.skin.textContent = !settings.get('liveSkins') ? 'OFF (TOGGLE LIVE)' : l ? `${l.time ? l.time.slice(0, 16).replace('T', ' ') + ' UTC' : 'TODAY'} · ${ago(l.time)}` : STANDALONE ? 'NEEDS THE LOCAL BACKEND' : 'LOADING…';
      if (l) live.skin.nextSibling.title = `${TIERS.measured.hint}\n${l.credit}`;
    }
    if (live.axis1 && live.axisBody === 'earth') {
      const ps = poleStar(clock.jd);
      live.axis1.textContent = `${ps.name.toUpperCase()} · ${fmt(ps.sep, ps.sep < 2 ? 2 : 1)}° FROM THE POLE`;
      live.axis2.textContent = `${fmt(obliquityDeg(clock.jd), 3)}°`;
    } else if (live.axis1 && live.axisBody === 'moon') {
      const g = moonGeocentric(clock.jd), rr = Math.hypot(...g), E = 23.4392911 * Math.PI / 180;
      const d = [-g[0] / rr, (-g[1] * Math.cos(E) + g[2] * Math.sin(E)) / rr, (-g[1] * Math.sin(E) - g[2] * Math.cos(E)) / rr];
      const ax = moonAxes(clock.jd), dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
      const lat = Math.asin(dot(d, ax.y)) * 180 / Math.PI, lon = Math.atan2(-dot(d, ax.z), dot(d, ax.x)) * 180 / Math.PI;
      live.axis1.textContent = `EARTH AT ${fmt(Math.abs(lon), 1)}°${lon >= 0 ? 'E' : 'W'} ${fmt(Math.abs(lat), 1)}°${lat >= 0 ? 'N' : 'S'}`;
    }
    if (live.comet1) {
      const c = system.cometState(live.cometBody);
      if (c) {
        live.comet1.textContent = c.activity > 0.01 ? `ACTIVE · ${fmt(c.rAU, 2)} AU FROM THE SUN` : `DORMANT · ${fmt(c.rAU, 1)} AU FROM THE SUN`;
        live.comet2.textContent = c.mag != null ? `${fmt(c.mag, 1)}${c.mag < 6 ? ' · NAKED EYE' : ''}` : '—';
        live.comet3.textContent = c.activity > 0.01 ? `ION ${fmt(c.ionAU, 2)} AU · DUST ${fmt(c.dustAU, 2)} AU · COMA ${fmt(c.comaKm, 0)} KM` : 'NONE (FROZEN NUCLEUS)';
      }
    }
    if (live.size) {
      const k = system.enhancementOf(id) ** (1 - (f?.scaleMix ?? 0));
      live.size.textContent = k > 1.5 ? `×${fmt(k, 0)} ENLARGED` : 'TRUE SCALE';
      live.size.nextSibling.style.visibility = k > 1.5 ? 'visible' : 'hidden';
    }
  }
}
setInterval(() => { tick(); if (['star', 'planet', 'moon', 'object'].includes(route.level)) detail?.tick(); if (route.level === 'satellite') satPanel.tick(); if (['planet', 'moon', 'object'].includes(route.level)) transferPanel.tick(); if (route.level === 'navigation') tickMessage(); if (route.level === 'events') eventsPanel.tick(); if (route.level === 'timeline') earthTimeline.tick(); }, 200);
setInterval(() => eventsBtn.classList.toggle('alert', eventsPanel.soon() > 0), 30000);
setInterval(() => { if (settings.get('fields') && system.model?.isSol) magneticPanel.refreshWind(); }, 60000); // Earth's magnetopause follows the live solar wind (#38)
settings.onChange((k, v) => { if (k === 'fields' && v) magneticPanel.refreshWind(); });
loadEvents().then(() => eventsBtn.classList.toggle('alert', eventsPanel.soon() > 0));

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
  $('comms-tab').hidden = currentSystem !== 'sol'; // COMMS is Sector 001's (#69)
  const m = system.model;
  const away = currentSystem !== 'sol';
  $('beacon-sub').textContent = away && m && m.id === currentSystem ? `${fmt(m.distLy, 1)} LY` : away ? 'RETURN' : 'HOME';
}

// ---- routing ----------------------------------------------------------------------------------
onRoute(async (r) => {
  const prev = route;
  route = r;
  applyTimeLimit(); // the new view's valid time range (#34)
  setDetail(null, () => {}); // the open detail view's cards stop ticking while the next view loads
  if (!(prev && prev.level === r.level && (r.level === 'galaxy' || r.level === 'quadrant'))) starCardView = null;
  lastFrame = null;
  syncRail();
  if (r.level !== 'satellite' && !(r.level === 'events' && prev?.level === 'events')) satPanel.closeViewer(); // keep a webcast playing while browsing events
  if (r.level !== 'quadrant') quadrant.hide();
  if (r.level !== 'universe') universe.hide();
  if (r.level === 'quadrant' || r.level === 'universe') {
    system.hide(); nav.hide(); starView.hide(); planetView.hide(); galaxy.hide();
    $('offline').hidden = true;
    $('beacon-sub').textContent = currentSystem === 'sol' ? 'HOME' : 'RETURN';
    if (r.level === 'quadrant') {
      $('view-title').textContent = 'QUADRANT VIEW · AROUND SECTOR 001';
      quadrant.show();
      if (quadrantSel) quadrant.select(quadrantSel);
      applyPendingCam(quadrant.camera);
      renderQuadrantPanel();
      if (!quadrantLoaded) {
        quadrantLoaded = true;
        fetchGalaxyStars().then((d) => quadrant.setStars(d));
        fetchClusters().then((d) => { quadrant.setClusters(d); if (quadrantSel) quadrant.select(quadrantSel); if (route.level === 'quadrant') renderQuadrantPanel(); });
      }
    } else {
      $('view-title').textContent = 'UNIVERSE VIEW · THE NEARBY UNIVERSE';
      universe.show();
      applyPendingCam(universe.camera);
      if (universeSel) universe.select(universeSel);
      renderUniversePanel();
      if (!universeLoaded) {
        universeLoaded = true;
        fetchGalaxies().then((d) => { universe.setGalaxies(d); if (universeSel) universe.select(universeSel); if (route.level === 'universe') renderUniversePanel(); });
      }
    }
    return;
  }
  if (r.level === 'system' && r.body?.startsWith('sat-')) return go({ level: 'satellite', system: 'sol', body: r.body.slice(4) });
  if (r.level !== 'events') eventsPanel.leave();
  if (r.level !== 'future' && r.level !== 'system') futureEvents.leave();
  if (r.level !== 'timeline' && r.level !== 'system' && r.level !== 'planet') earthTimeline.leave(); // the epoch stays while you look at Earth // a scenario stays while you look at it in the System View
  if (r.level !== 'comms') { comms.hide(); $('comms-tab').classList.remove('on'); }
  if (r.level === 'comms') { // COMMS (#69): SubSpace and RF reception, Sector 001
    system.hide(); nav.hide(); starView.hide(); planetView.hide(); galaxy.hide();
    $('offline').hidden = true;
    $('view-title').textContent = 'COMMS · SUBSPACE AND RF RECEPTION';
    $('comms-tab').classList.add('on');
    comms.show();
    renderCommsPanel();
    return;
  }
  if (r.level === 'timeline') {
    nav.hide(); starView.hide(); galaxy.hide(); planetView.hide();
    $('offline').hidden = true;
    system.show();
    if (!(await ensureSystem('sol')) || route !== r) return;
    if (prev.level !== 'timeline') { warp(); system.focus('earth'); }
    $('view-title').textContent = 'EARTH TIMELINE · CLIMATE, ICE, CYCLES, GEOLOGY, IMPACTS';
    syncBeacon();
    earthTimeline.render(r.body);
    return;
  }
  if (r.level === 'future') {
    nav.hide(); starView.hide(); galaxy.hide(); planetView.hide();
    $('offline').hidden = true;
    system.show();
    if (!(await ensureSystem('sol')) || route !== r) return;
    if (prev.level !== 'future') warp();
    $('view-title').textContent = 'FUTURE · SUPERNOVAE, PASSING STARS, IMPACTS, THE SUN';
    syncBeacon();
    futureEvents.render(r.body);
    return;
  }
  if (r.level === 'events') {
    nav.hide(); starView.hide(); galaxy.hide(); planetView.hide();
    $('offline').hidden = true;
    system.show();
    if (!(await ensureSystem('sol')) || route !== r) return;
    if (prev.level !== 'events') { warp(); system.focus('earth'); }
    $('view-title').textContent = 'EVENTS · LAUNCHES, LANDINGS, STATION OPS, SKY';
    syncBeacon();
    eventsPanel.render(r.body);
    return;
  }
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
      if (pendingSurface?.id === body.id) {
        const ps = pendingSurface; pendingSurface = null;
        system.surfaceAt(ps.id, ps.lat, ps.lon, { lookSun: ps.lookSun, look: ps.look, daylight: ps.daylight });
        if (ps.render) captureWhenReady(system, { id: ps.id, ...ps.render }, { toast, clock });
      }
      else if (system.onSurface?.id === body.id) { /* standing on it already */ }
      else if (fresh || prev.body !== r.body || prev.level !== 'system') { if (!fresh && !system.quietFocus(body.id)) warp(); system.focus(body.id); }
      if (pendingSiteView?.id === body.id) { const pv = pendingSiteView; pendingSiteView = null; system.viewSite(pv.id, pv.lat, pv.lon, pv.span); }
      renderBodyPanel(body.id);
    } else {
      if (!fresh && (prev.body || prev.level !== 'system')) system.overview(m.survey[0].au, m.survey[0].centre);
      renderSystemPanel();
    }
    applyPendingCam(system.camera);
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
    setDetail(detailCards(b, m, { system, clock }), (d) => starView.setExtras(d));
    renderBodyPanel(b.id, { inStarView: true });
    applyPendingCam(starView.camera);
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
    setDetail(detailCards(b, m, { system, clock, surface: surfaceHooks }), (d) => planetView.setExtras([...d.top, ...d.spectrum]));
    renderBodyPanel(b.id, { inStarView: true });
    applyPendingCam(planetView.camera);
    syncRail();
  } else if (r.level === 'galaxy') {
    system.hide(); nav.hide(); starView.hide(); planetView.hide();
    $('offline').hidden = true;
    $('view-title').textContent = 'GALAXY VIEW · MILKY WAY';
    $('beacon-sub').textContent = currentSystem === 'sol' ? 'HOME' : 'RETURN';
    galaxy.show();
    applyPendingCam(galaxy.camera);
    renderGalaxyPanel();
    if (!galaxyStarsLoaded) {
      galaxyStarsLoaded = true;
      fetchGalaxyStars().then((d) => galaxy.setStars(d));
      fetchGaiaBright().then((d) => { galaxy.setGaia(d); if (route.level === 'galaxy') renderGalaxyPanel(); });
    }
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

