// FROM THE SURFACE (#36): what it looks like standing there.
//   ON THE GROUND   real pictures taken on (or metres above) the surface: Apollo, Surveyor, Viking,
//                   the Mars rovers and landers, Venera, Huygens, NEAR, Philae (MEASURED).
//   LIVE            today's raw images from Perseverance and Curiosity; Earth's observatory webcams.
//   RENDERED HERE   for everywhere else (and for comparison): the app's own surface view captured
//                   at a site and time, the true-scale sky over the body's map (IMAGINED). No image
//                   service: the render is this ship's System View, so it works offline.
// Each image's site is marked on the globe (click a marker to stand there).

import { badge } from '../data/provenance.js';
import { surfaceSelection, proxiedImage, separationDeg, COLOUR_TYPES, COLOUR_HINTS } from '../data/surface-images.js';
import { sitesFor } from '../data/sites.js';
import { DAY_SKY } from '../views/system/surface.js';

const STANDALONE = import.meta.env?.MODE === 'standalone';
const el = (tag, props = {}, ...kids) => {
  const e = Object.assign(document.createElement(tag), props);
  for (const k of kids.flat()) if (k != null) e.append(k);
  return e;
};
const pill = (label, onClick, title = '') => {
  const b = el('button', { type: 'button', className: 'pill', textContent: label, title });
  b.addEventListener('click', onClick);
  return b;
};
const fmtLatLon = (lat, lon) => `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(2)}°${lon >= 0 ? 'E' : 'W'}`;
const G = 6.674e-11, AU_KM = 149597870.7;

// ---- renders: captured surface views, kept per viewer (a convenience; they can be re-rendered) ----
const STORE_KEY = 'fidelity.surfaceRenders';
const PER_BODY = 4, MAX_TOTAL = 24;
let renders = null;
function loadRenders() {
  if (renders) return renders;
  try { renders = JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); } catch { renders = []; }
  if (!Array.isArray(renders)) renders = [];
  return renders;
}
function saveRenders() { try { localStorage.setItem(STORE_KEY, JSON.stringify(renders)); } catch { /* full or blocked: keep in memory */ } }
export const rendersFor = (system, body) => loadRenders().filter((r) => r.system === system && r.body === body);
function addRender(r) {
  loadRenders();
  renders = [r, ...renders.filter((x) => !(x.system === r.system && x.body === r.body && x.lat === r.lat && x.lon === r.lon))];
  const count = {};
  renders = renders.filter((x) => { const k = `${x.system}/${x.body}`; count[k] = (count[k] ?? 0) + 1; return count[k] <= PER_BODY; }).slice(0, MAX_TOTAL);
  saveRenders();
}
/** The last place a render was made on this body (images sort nearest to it). */
const lastSpot = (system, body) => rendersFor(system, body)[0] ?? null;
let inDaylight = true; // RENDER in sunlight by default (the nearest sunlit spot to the site)

/** Texture longitude for a planetocentric one (the surface view and globe work in texture coordinates). */
export const texLon = (b, lon) => { let l = lon - ((b.texLon0 ?? -180) + 180); if (l > 180) l -= 360; if (l < -180) l += 360; return l; };

/**
 * After the System View has stood at a spot for RENDER, capture the view once its maps have had
 * time to load. `req` = { id, lat, lon (planetocentric), system, bodyName, label }.
 */
export function captureWhenReady(system, req, { toast, clock } = {}) {
  const t0 = performance.now();
  let arrived = null;
  const poll = setInterval(() => {
    const now = performance.now();
    if (system.onSurface?.id !== req.id) { if (arrived || now - t0 > 20000) clearInterval(poll); return; } // still warping there, or left
    arrived ??= now;
    if (now - arrived < 2800) return;
    clearInterval(poll);
    const shot = system.capture?.(640);
    if (!shot?.url) return;
    // in daylight mode the ship may have walked to the nearest sunlit spot: record where it actually stood
    const moved = shot.lat != null && separationDeg(shot.lat, shot.lon, req.lat, req.lon) > 0.5;
    addRender({ system: req.system, body: req.id, lat: shot.lat ?? req.lat, lon: shot.lon ?? req.lon,
      label: req.label ? `${moved ? 'NEAREST DAYLIGHT TO ' : ''}${req.label.replace(/^NEAREST DAYLIGHT TO /, '')}` : null, url: shot.url,
      time: new Date(((clock?.jd ?? shot.jd) - 2440587.5) * 86400000).toISOString().slice(0, 16) + 'Z', hud: shot.hud, sub: shot.sub, look: shot.look });
    toast?.(`RENDERED · ${req.bodyName.toUpperCase()} · SAVED TO FROM THE SURFACE (IMAGINED)`);
  }, 250);
}

/** What went into a render: honest inputs for the IMAGINED badge and the note. */
function renderInputs(b, m, system, sel) {
  const lines = [];
  const R = b.radiusKm ?? 0;
  const map = b.surfacePending || !b.skin?.map ? 'this body\'s placeholder map (no spacecraft mosaic yet)' : 'the body\'s spacecraft map in this app';
  lines.push(sel.solidSurface ? `GROUND: ${map}, draped over a smooth sphere: no relief, no rocks, no shadows of terrain.` : `BELOW: ${map} (cloud tops), on a smooth sphere.`);
  if (sel.solidSurface && R) lines.push(`HORIZON: ${Math.sqrt(2 * R * 0.002).toFixed(R < 50 ? 2 : 1)} km away for an eye 2 m up (geometry of a ${R.toLocaleString('en-US', { maximumFractionDigits: 1 })} km sphere, no refraction).`);
  else lines.push('NO SOLID SURFACE: the camera floats 2 m above the 1-bar level; real cloud decks, haze and depth are not drawn.');
  if (b.massKg && R) lines.push(`GRAVITY: ${(G * b.massKg / (R * 1000) ** 2).toPrecision(2)} m/s² (does not change the picture, only how far you could throw a rock).`);
  const air = DAY_SKY[b.id];
  lines.push(`SKY: ${air ? `${air.note} Modelled as one uniform colour scaled by the Sun's altitude.`
    : sel.solidSurface ? 'Black: no air (or too little) to scatter sunlight, so stars stay out by day (the Sun\'s glare is a sprite).'
      : 'NOT MODELLED: drawn black with stars; a real sky at the 1-bar level would be bright and hazy by day under higher cloud decks.'}`);
  try {
    const star = m.bodies.find((x) => x.id === (b.orbit?.host ?? b.host ?? m.starId)) ?? m.bodies.find((x) => x.id === m.starId);
    const p = system.positionOf(b.id), s = system.positionOf(star.id);
    const dAU = Math.hypot(p[0] - s[0], p[1] - s[1], p[2] - s[2]);
    if (star?.radiusKm && dAU > 0) lines.push(`${star.name.toUpperCase()}: ${(2 * Math.atan(star.radiusKm / (dAU * AU_KM)) * 180 / Math.PI * 60).toFixed(1)}′ across from ${dAU.toFixed(2)} AU (Earth sees the Sun 32′).`);
    const parent = b.parent && m.bodies.find((x) => x.id === b.parent);
    if (parent?.radiusKm) {
      const q = system.positionOf(parent.id), dKm = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) * AU_KM;
      lines.push(`${parent.name.toUpperCase()} IN THE SKY: ${(2 * Math.atan(parent.radiusKm / dKm) * 180 / Math.PI).toFixed(2)}° across from ${Math.round(dKm).toLocaleString('en-US')} km (the Moon from Earth: 0.52°).`);
    }
  } catch { /* positions not ready */ }
  lines.push('STARS AND PLANETS: catalogue positions and the ship\'s clock (COMPUTED); exposure and glare are artistic.');
  return lines;
}

/**
 * The FROM THE SURFACE card for body `b` of model `m`. hooks: { stand(id, lat, texLon, opts) → the System
 * View surface mode (texture coordinates; opts.render asks for a capture), mark(id, [{ lat, lon, kind, label }])
 * → markers on the Planet View globe (planetocentric) }.
 */
export function createSurfaceCard(b, m, { system, hooks }) {
  const near = lastSpot(m.id, b.id);
  const sel = surfaceSelection(b, { near, isSol: !!m.isSol });
  const head = el('div', { className: 'sv-card-head' }, el('h3', { textContent: 'FROM THE SURFACE' }),
    sel.tier === 'measured'
      ? badge('measured', 'Pictures taken on the surface (or metres above it) by landers, rovers and astronauts. Renders below are badged IMAGINED.')
      : badge('imagined', 'No spacecraft has photographed this surface: the views here are rendered by this app from its maps and sky model.'));
  const node = el('section', { className: 'sv-card im-card sf-card' }, head);
  const objectUrls = [];
  const lightbox = el('div', { className: 'im-lightbox', hidden: true });
  lightbox.addEventListener('click', (e) => { if (e.target === lightbox || e.target.classList.contains('im-close')) lightbox.hidden = true; });
  const marks = [];
  const pushMark = (x, kind) => { if (x.lat != null && x.lon != null) marks.push({ lat: x.lat, lon: x.lon, kind, label: x.title ?? x.label ?? '' }); };

  const stand = (lat, lon, opts = {}) => hooks?.stand?.(b.id, lat, texLon(b, lon), opts);
  const render = (lat, lon, label) => stand(lat, lon, { look: 'best', daylight: inDaylight ? 20 : null, render: { lat, lon, label, system: m.id, bodyName: b.name } });

  function info(e) {
    const rows = [
      ['MISSION', e.mission], ['INSTRUMENT', e.instrument],
      ['DATE', e.date === 'live' ? 'LIVE (REFRESHED EVERY FEW MINUTES)' : `${e.date ?? '—'}${e.sol != null ? ` · SOL ${e.sol}` : ''}`],
      ['LOCATION', e.lat != null ? `${fmtLatLon(e.lat, e.lon)}${e.siteName ? ` · ${e.siteName.toUpperCase()}` : ''}${e.approx ? ` · ${e.approx}` : ''}` : 'NOT PUBLISHED'],
      ['COLOUR', COLOUR_TYPES[e.colour] ?? e.colour], ['CREDIT', e.credit], ['LICENCE', e.licence],
    ];
    return el('dl', { className: 'fe-list' }, rows.flatMap(([k, v]) => [el('dt', { textContent: k }), el('dd', { textContent: v ?? '—' })]));
  }
  function open(e, src) {
    const actions = el('div', { className: 'im-pills' });
    if (e.lat != null) actions.append(pill('⌖ STAND HERE', () => { lightbox.hidden = true; stand(e.lat, e.lon); }, 'The surface view at this site (System View)'),
      pill('◐ RENDER HERE', () => { lightbox.hidden = true; render(e.lat, e.lon, e.siteName ?? e.title); }, 'Capture this app\'s own view from the site, to compare (IMAGINED)'));
    lightbox.replaceChildren(el('div', { className: 'im-box' },
      el('button', { type: 'button', className: 'pill im-close', textContent: 'CLOSE ✕' }),
      el('img', { src, alt: e.title }), el('h4', { textContent: e.title.toUpperCase() }),
      el('div', {}, badge('measured', e.live ? 'A raw image from the rover, as downlinked.' : 'Taken on the surface by the spacecraft or crew named.'), ' ',
        el('span', { className: 'im-time mono', textContent: ` ${COLOUR_TYPES[e.colour] ?? ''}: ${COLOUR_HINTS[e.colour] ?? ''}` })),
      info(e), e.note ? el('p', { className: 'note', textContent: e.note }) : null,
      e.page ? el('a', { href: e.page, target: '_blank', rel: 'noopener noreferrer', textContent: 'SOURCE PAGE ↗' }) : null, actions));
    lightbox.hidden = false;
  }
  function tile(e, src, fullSrc, { feed = false } = {}) {
    const img = el('img', { alt: e.title, loading: 'lazy' });
    const when = e.date === 'live' ? 'LIVE' : `${e.date ?? ''}${e.sol != null ? ` · SOL ${e.sol}` : ''}`;
    const time = el('span', { className: 'im-time mono', textContent: feed ? 'LOADING…' : when });
    const t = el('figure', { className: 'im-tile', title: e.note ?? '' }, img,
      el('figcaption', {}, el('span', { textContent: e.title.toUpperCase().slice(0, 60) }), badge('measured', `${e.mission} · ${COLOUR_TYPES[e.colour] ?? ''}`), time));
    if (feed) {
      fetch(src).then(async (r) => {
        if (!r.ok) throw new Error(r.status);
        const ft = r.headers.get('x-feed-time');
        const url = URL.createObjectURL(await r.blob());
        objectUrls.push(url);
        img.src = url;
        time.textContent = ft ? `${ft.slice(0, 16).replace('T', ' ')} UTC` : 'LATEST';
      }).catch(() => { time.textContent = 'UNAVAILABLE'; t.classList.add('im-dead'); });
    } else {
      img.src = src;
      img.addEventListener('error', () => { t.classList.add('im-dead'); time.textContent = 'UNAVAILABLE'; });
    }
    t.addEventListener('click', () => !t.classList.contains('im-dead') && open(e, feed ? img.src : fullSrc));
    return t;
  }

  // ---- on the ground (curated) ------------------------------------------------------------------
  const archival = sel.images.filter((e) => !e.feed), feeds = sel.images.filter((e) => e.feed);
  if (archival.length) {
    node.append(el('h4', { className: 'im-sub', textContent: `ON THE GROUND · ${archival.length} PICTURES${near ? ' · NEAREST YOUR LAST RENDER FIRST' : ''}` }));
    if (STANDALONE) node.append(el('p', { className: 'note', textContent: 'These pictures load through the local backend (npm start); the single-file preview lists them on the globe but cannot fetch them. RENDER below works offline.' }));
    else node.append(el('div', { className: 'im-grid' }, archival.map((e) => tile(e, proxiedImage(e, 'thumb'), proxiedImage(e, 'full')))));
    for (const e of archival) pushMark(e, 'measured');
  }
  if (feeds.length) {
    node.append(el('h4', { className: 'im-sub', textContent: 'LIVE FROM THE GROUND · OBSERVATORY CAMERAS' }));
    if (STANDALONE) node.append(el('p', { className: 'note', textContent: 'Live cameras need the local backend (npm start).' }));
    else node.append(el('div', { className: 'im-grid' }, feeds.map((e) => tile(e, `/api/feed/${e.feed}`, null, { feed: true }))));
    for (const e of feeds) pushMark(e, 'live');
  }
  // ---- live rover raw images ----------------------------------------------------------------------
  if (sel.live.length && !STANDALONE) {
    const grid = el('div', { className: 'im-grid' }, el('p', { className: 'note', textContent: 'ASKING THE ROVERS FOR THEIR LATEST PICTURES…' }));
    node.append(el('h4', { className: 'im-sub', textContent: `LATEST FROM ${sel.live.map((r) => r.mission.split(' ')[0].toUpperCase()).join(' AND ')} · RAW` }), grid);
    fetch(`/api/surface-images?body=${encodeURIComponent(b.id)}`).then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status)))).then((res) => {
      if (!res.live.length) { grid.replaceChildren(el('p', { className: 'note', textContent: `NO RAW IMAGES RIGHT NOW${res.errors.length ? ` (${res.errors.join('; ')})` : ''}.` })); return; }
      grid.replaceChildren(...res.live.map((e) => tile(e, e.thumbUrl, e.fullUrl)));
      grid.after(el('p', { className: 'note credit', textContent: `NASA/JPL-Caltech raw-image feeds (${sel.live.map((r) => r.mission).join(', ')}), refreshed hourly; placed at each rover's latest mapped position. Raw: uncalibrated colour.` }));
      for (const e of res.live.slice(0, 1)) pushMark({ ...e, title: `${e.mission} TODAY` }, 'live');
      hooks?.mark?.(b.id, marks);
    }).catch(() => grid.replaceChildren(el('p', { className: 'note', textContent: 'RAW-IMAGE FEEDS UNREACHABLE (OFFLINE?).' })));
  }
  if (!sel.images.length && !sel.live.length) {
    node.append(el('p', { className: 'note', textContent: m.isSol
      ? `No spacecraft has ${sel.solidSurface ? 'landed on' : 'photographed from inside'} ${b.name} and sent back a picture. What it would look like is rendered below from this ship's own maps and sky (IMAGINED).`
      : `${b.name} has never been seen as more than a point of light (if at all). The view below is rendered from this app's model of the system (IMAGINED): its map is a generated class skin.` }));
  }
  if (sel.pending.length) {
    node.append(el('details', { className: 'sf-pending' }, el('summary', { textContent: `READY TO ATTACH · ${sel.pending.length} MORE SET${sel.pending.length > 1 ? 'S' : ''}` }),
      ...sel.pending.map((p) => el('p', { className: 'note' }, el('a', { href: p.page, target: '_blank', rel: 'noopener noreferrer', textContent: p.set }), ` · ${p.source}. ${p.why}`))));
  }

  // ---- rendered here ------------------------------------------------------------------------------
  const spots = [];
  const seen = new Set();
  const siteList = sitesFor(b.id).filter((s) => s.kind !== 'planned' && s.kind !== 'launch');
  const short = (e) => { const s = e.site && siteList.find((x) => x.id === e.site); return s?.short ?? e.short ?? e.mission ?? e.name ?? ''; };
  for (const e of [...archival, ...siteList.filter((s) => s.major), ...siteList]) {
    const label = short(e).toUpperCase();
    const k = `${e.lat?.toFixed(1)},${e.lon?.toFixed(1)}`;
    if (e.lat == null || seen.has(k)) continue;
    seen.add(k); spots.push({ lat: e.lat, lon: e.lon, label: label.length > 34 ? `${label.slice(0, 32)}…` : label });
    if (spots.length >= 4) break;
  }
  if (!spots.length) spots.push({ lat: 0, lon: 0, label: '0° N 0° E' }, { lat: 45, lon: 90, label: '45° N 90° E' });
  const shots = rendersFor(m.id, b.id);
  const renderGrid = el('div', { className: 'im-grid' }, shots.map((r) => {
    const t = el('figure', { className: 'im-tile' }, el('img', { src: r.url, alt: `${b.name}: rendered view at ${fmtLatLon(r.lat, r.lon)}` }),
      el('figcaption', {}, el('span', { textContent: `${r.label ?? fmtLatLon(r.lat, r.lon)}`.toUpperCase().slice(0, 50) }), badge('imagined', 'Rendered by this app from its maps and sky model; see the inputs below.'),
        el('span', { className: 'im-time mono', textContent: `${r.time} · ${fmtLatLon(r.lat, r.lon)}` })));
    t.addEventListener('click', () => {
      lightbox.replaceChildren(el('div', { className: 'im-box' },
        el('button', { type: 'button', className: 'pill im-close', textContent: 'CLOSE ✕' }),
        el('img', { src: r.url, alt: '' }), el('h4', { textContent: `${b.name.toUpperCase()} · RENDERED BY THIS SHIP` }),
        el('div', {}, badge('imagined', 'Not a photograph.')), el('p', { className: 'note mono', textContent: `${r.hud ?? ''} · ${r.time}` }),
        el('p', { className: 'note', textContent: r.sub ?? '' }),
        el('div', { className: 'im-pills' }, pill('⌖ STAND HERE (LIVE)', () => { lightbox.hidden = true; stand(r.lat, r.lon); }), pill('◐ RE-RENDER NOW', () => { lightbox.hidden = true; render(r.lat, r.lon, r.label); }))));
      lightbox.hidden = false;
    });
    pushMark({ lat: r.lat, lon: r.lon, title: `RENDER · ${r.label ?? ''}` }, 'render');
    return t;
  }));
  const inputs = renderInputs(b, m, system, sel);
  const dayPill = el('button', { type: 'button', className: `pill${inDaylight ? ' on' : ''}`, textContent: '☀ IN DAYLIGHT',
    title: 'On: if it is night (or the Sun is low) at the site at the ship\'s clock, stand at the nearest spot where the Sun is 20° up. Off: exactly at the site, whatever the hour.' });
  dayPill.addEventListener('click', () => { inDaylight = !inDaylight; dayPill.classList.toggle('on', inDaylight); });
  node.append(el('h4', { className: 'im-sub', textContent: `RENDERED HERE · ${sel.renderLabel}` }),
    el('div', { className: 'im-pills' }, el('span', { className: 'im-label', textContent: 'RENDER AT' }), dayPill,
      ...spots.map((s) => pill(s.label, () => render(s.lat, s.lon, s.label), `Stand at ${fmtLatLon(s.lat, s.lon)} at the ship's clock, face the Sun or ${b.parent ? 'the planet' : 'the sky'}, and capture the view`))),
    shots.length ? renderGrid : el('p', { className: 'note', textContent: 'Nothing rendered yet. RENDER AT a site: the ship goes to the surface view there, captures what you see (it stays on screen to look around), and the picture appears here.' }),
    el('details', { className: 'sf-inputs' }, el('summary', {}, 'WHAT A RENDER IS MADE OF ', badge('imagined', inputs.join('\n'))),
      ...inputs.map((t) => el('p', { className: 'note', textContent: t })),
      el('p', { className: 'note', textContent: 'Double-click anywhere on the globe above to stand there yourself. An AI-generated landscape is not offered: it would need an image service, and would be invention dressed as a photograph.' })));

  node.append(lightbox);
  hooks?.mark?.(b.id, marks);
  return { node, tick() {}, dispose() { for (const u of objectUrls) URL.revokeObjectURL(u); } };
}
