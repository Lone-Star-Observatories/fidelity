// IMAGERY: every kind of picture of a body the backend can find.
//   LIVE        today's views (the Sun from a ground telescope and from SDO/SOHO, the Earth from
//               L1 and geostationary orbit, the Moon as it looks this hour).
//   ALL WAVELENGTHS  sky-survey cutouts at the body's position from gamma rays to radio
//               (CDS hips2fits). For Solar System bodies the survey is the background sky and
//               the crosshair marks where the body is now: it moves, the surveys don't.
//   ARCHIVE     the NASA Image and Video Library: spacecraft and telescope images (and
//               artists' concepts, badged as such).

import { badge } from '../data/provenance.js';
import { formatRa, formatDec } from '../astro/observe.js';
import { settings } from '../settings.js';

const STANDALONE = import.meta.env.MODE === 'standalone';
const el = (tag, props = {}, ...kids) => {
  const e = Object.assign(document.createElement(tag), props);
  for (const k of kids.flat()) if (k != null) e.append(k);
  return e;
};
const pill = (label, on, onClick) => {
  const b = el('button', { type: 'button', className: `pill${on ? ' on' : ''}`, textContent: label });
  b.addEventListener('click', onClick);
  return b;
};

// Live feeds per body: [feed id, label, tier, note]
const LIVE = {
  sun: [
    ['gong-halpha', 'FROM EARTH · H-ALPHA', 'measured', 'A ground-based telescope of the GONG network: the Sun as seen from Earth\'s surface right now, in the red light of hydrogen (656.3 nm).'],
    ['sdo-hmi', 'VISIBLE · SUNSPOTS', 'measured', 'SDO HMI continuum: the photosphere as the eye would see it through a solar filter.'],
    ['sdo-hmimag', 'MAGNETIC FIELD', 'measured', 'SDO HMI magnetogram: white and black are opposite magnetic polarities; sunspots sit in the strongest fields.'],
    ['sdo-1600', 'ULTRAVIOLET 1600 Å', 'measured', 'SDO AIA: the top of the photosphere and the transition region.'],
    ['sdo-304', 'EXTREME UV 304 Å', 'measured', 'SDO AIA: the chromosphere and prominences (helium II, ~50,000 K).'],
    ['sdo-171', 'EXTREME UV 171 Å', 'measured', 'SDO AIA: coronal loops at ~600,000 K.'],
    ['sdo-193', 'EXTREME UV 193 Å', 'measured', 'SDO AIA: the corona at ~1.5 million K; dark patches are coronal holes, where fast solar wind escapes.'],
    ['sdo-131', 'EXTREME UV 131 Å', 'measured', 'SDO AIA: the hottest flaring plasma (~10 million K).'],
    ['lasco-c2', 'CORONAGRAPH · 6 R☉', 'measured', 'SOHO LASCO C2 blocks the disc to show the outer corona and coronal mass ejections.'],
    ['lasco-c3', 'CORONAGRAPH · 30 R☉', 'measured', 'SOHO LASCO C3: the solar wind streaming out; stars, planets and comets pass behind.'],
  ],
  earth: [
    ['epic', 'FROM L1 · DSCOVR EPIC', 'measured', 'The whole sunlit Earth from 1.5 million km, several times a day.'],
    ['goes-east', 'GOES-19 · AMERICAS', 'measured', 'Geostationary full disc, every 10 minutes.'],
    ['goes-west', 'GOES-18 · PACIFIC', 'measured', 'Geostationary full disc, every 10 minutes.'],
    ['himawari', 'HIMAWARI-9 · ASIA–PACIFIC', 'measured', 'Geostationary true colour.'],
    ['mtg-0', 'METEOSAT-12 · EUROPE–AFRICA', 'measured', 'Geostationary GeoColour.'],
  ],
  moon: [
    ['moon-now', 'THIS HOUR FROM EARTH', 'modelled', 'NASA SVS Dial-a-Moon: phase, libration and apparent size for this hour, rendered from Lunar Reconnaissance Orbiter maps (a computed view, not a photograph).'],
  ],
};

const BANDS = [['gamma', 'GAMMA'], ['x-ray', 'X-RAY'], ['uv', 'UV'], ['visible', 'VISIBLE'], ['near-ir', 'NEAR IR'], ['mid-ir', 'MID IR'], ['far-ir', 'FAR IR'], ['microwave', 'MICROWAVE'], ['radio', 'RADIO']];
const SURVEY_ORDER = ['fermi', 'rass', 'galex', 'dss2', 'panstarrs', 'mellinger', 'twomass', 'wise', 'akari', 'planck', 'nvss', 'hi4pi'];
const SURVEY_META = {
  fermi: ['gamma', 'FERMI · GAMMA'], rass: ['x-ray', 'ROSAT · X-RAY'], galex: ['uv', 'GALEX · UV'], dss2: ['visible', 'DSS2 · VISIBLE'],
  panstarrs: ['visible', 'PAN-STARRS'], mellinger: ['visible', 'NAKED-EYE SKY'], twomass: ['near-ir', '2MASS · NEAR IR'], wise: ['mid-ir', 'WISE · MID IR'],
  akari: ['far-ir', 'AKARI · FAR IR'], planck: ['microwave', 'PLANCK · MICROWAVE'], nvss: ['radio', 'NVSS · RADIO'], hi4pi: ['radio', 'HI4PI · 21 CM'],
};
// the spectrum filter's bands (#28, settings 'band') → this strip's survey bands
const FROM_FILTER = { radio: 'radio', microwave: 'microwave', ir: 'ir', visible: 'visible', uv: 'uv', xray: 'x-ray', gamma: 'gamma' };
const inBand = (b, surveyBand) => b === 'all' || b === surveyBand || (b === 'ir' && /-ir$/.test(surveyBand));
const FOVS = [[0.08, '5′'], [0.33, '20′'], [1, '1°'], [5, '5°'], [20, '20°']];
const ARTWORK = /\b(artist|artist's|illustration|concept|rendering|rendered|animation|simulat|depiction|imagined|visuali[sz]ation)/i;

/**
 * The IMAGERY card. target: { id, name, kind: 'sol' | 'star' | 'exoplanet', liveKey?, archive: { q, must } | null,
 * moving: bool, sky(): { ra, dec } | null, defaultFov }.
 */
export function createImageryCard(target) {
  const node = el('section', { className: 'sv-card im-card' },
    el('div', { className: 'sv-card-head' }, el('h3', { textContent: 'IMAGERY · ALL KINDS' }),
      badge('measured', 'Observations from telescopes and spacecraft; each image carries its own source and badge.')));
  if (STANDALONE) {
    node.append(el('p', { className: 'note', textContent: 'Live views, sky surveys across the spectrum and NASA\'s image archive load through the local backend (npm start). The single-file preview has none of them.' }));
    return { node, tick() {}, dispose() {} };
  }
  const objectUrls = [];
  const lightbox = el('div', { className: 'im-lightbox', hidden: true });
  lightbox.addEventListener('click', (e) => { if (e.target === lightbox || e.target.classList.contains('im-close')) lightbox.hidden = true; });
  const open = (src, title, ...info) => {
    lightbox.replaceChildren(el('div', { className: 'im-box' },
      el('button', { type: 'button', className: 'pill im-close', textContent: 'CLOSE ✕' }),
      el('img', { src, alt: title }), el('h4', { textContent: title }), ...info));
    lightbox.hidden = false;
  };

  // ---- live ---------------------------------------------------------------------------------
  const live = LIVE[target.liveKey ?? target.id];
  if (live && target.kind === 'sol') {
    const grid = el('div', { className: 'im-grid' });
    for (const [feed, label, tier, note] of live) {
      const img = el('img', { alt: label, loading: 'lazy' });
      const time = el('span', { className: 'im-time mono', textContent: 'LOADING…' });
      const tile = el('figure', { className: 'im-tile' }, img, el('figcaption', {}, el('span', { textContent: label }), badge(tier, note), time));
      tile.addEventListener('click', () => img.src && open(img.src, label, el('p', { className: 'note', textContent: note }), el('p', { className: 'note', textContent: `${time.textContent} · ${decodeURIComponent(img.dataset.credit ?? '')}` })));
      grid.append(tile);
      fetch(`/api/feed/${feed}`).then(async (r) => {
        if (!r.ok) throw new Error(r.status);
        const t = r.headers.get('x-feed-time');
        img.dataset.credit = r.headers.get('x-feed-credit') ?? '';
        const url = URL.createObjectURL(await r.blob());
        objectUrls.push(url);
        img.src = url;
        time.textContent = t ? `${t.slice(0, 16).replace('T', ' ')} UTC` : 'LATEST';
      }).catch(() => { time.textContent = 'UNAVAILABLE'; tile.classList.add('im-dead'); });
    }
    node.append(el('h4', { className: 'im-sub', textContent: target.id === 'sun' ? 'LIVE · THE SUN TODAY' : target.id === 'earth' ? 'LIVE · EARTH TODAY' : 'NOW' }), grid);
  }

  // ---- all wavelengths ------------------------------------------------------------------------
  let fov = target.defaultFov ?? 0.33, centre = null, band = FROM_FILTER[settings.get('band')] ?? 'all', drawnAt = 0;
  const surveyGrid = el('div', { className: 'im-grid im-survey' });
  const where = el('p', { className: 'note mono' });
  const fovPills = el('div', { className: 'im-pills' });
  const bandPills = el('div', { className: 'im-pills' });
  const drawPills = () => {
    fovPills.replaceChildren(el('span', { className: 'im-label', textContent: 'FIELD' }), ...FOVS.map(([f, l]) => pill(l, Math.abs(f - fov) < 1e-6, () => { fov = f; drawPills(); drawSurveys(true); })));
    bandPills.replaceChildren(el('span', { className: 'im-label', textContent: 'BAND' }), pill('ALL', band === 'all', () => { band = 'all'; drawPills(); drawSurveys(true); }),
      ...BANDS.map(([b, l]) => pill(l, band === b || (band === 'ir' && /-ir$/.test(b)), () => { band = b; drawPills(); drawSurveys(true); })));
  };
  function drawSurveys(force = false) {
    const s = target.sky();
    if (!s) { where.textContent = 'POSITION UNKNOWN'; return; }
    // a moving body: refetch only once it has moved a twentieth of the field
    // (and at most every 5 s, so a fast clock does not reload the strip continuously)
    if (!force && centre && (Math.hypot((s.ra - centre.ra) * Math.cos(s.dec * Math.PI / 180), s.dec - centre.dec) < fov / 20 || performance.now() - drawnAt < 5000)) return;
    centre = { ra: s.ra, dec: s.dec };
    drawnAt = performance.now();
    where.textContent = `CENTRE ${formatRa(centre.ra)} · ${formatDec(centre.dec)} (J2000) · FIELD ${FOVS.find(([f]) => f === fov)?.[1] ?? `${fov}°`} · NORTH UP, EAST LEFT`;
    const keys = SURVEY_ORDER.filter((k) => inBand(band, SURVEY_META[k][0]));
    surveyGrid.replaceChildren(...keys.map((k) => {
      const [, label] = SURVEY_META[k];
      const src = `/api/survey/${k}?ra=${centre.ra.toFixed(4)}&dec=${centre.dec.toFixed(4)}&fov=${fov}`;
      const img = el('img', { src, alt: `${label} at ${target.name}`, loading: 'lazy' });
      const tile = el('figure', { className: 'im-tile' }, el('div', { className: 'im-frame' }, img, target.moving ? el('span', { className: 'im-cross' }) : null),
        el('figcaption', {}, el('span', { textContent: label }), badge('measured', 'Sky-survey image (CDS HiPS, via hips2fits). Survey epochs range from the 1950s plates to the 2010s.')));
      img.addEventListener('error', () => { tile.classList.add('im-dead'); tile.querySelector('figcaption').append(el('span', { className: 'im-time mono', textContent: 'NOT COVERED HERE' })); });
      tile.addEventListener('click', () => !tile.classList.contains('im-dead') && open(src.replace(/fov=/, 'size=1024&fov='), `${label} · ${target.name.toUpperCase()}`,
        el('p', { className: 'note', textContent: target.moving
          ? 'The background sky from the survey. The body was not there when it was taken: the crosshair marks where it is at the ship\'s clock.'
          : 'Survey image centred on the catalogue position.' })));
      return tile;
    }));
  }
  drawPills();
  if (target.surveys !== false) node.append(el('h4', { className: 'im-sub', textContent: target.moving ? 'ITS SKY · GAMMA RAYS TO RADIO' : 'ALL WAVELENGTHS · GAMMA RAYS TO RADIO' }),
    el('p', { className: 'note', textContent: target.moving
      ? 'Survey images of the patch of sky it is crossing now, across the spectrum. Surveys are fixed snapshots of the stars; the crosshair is where this body is at the ship\'s clock (COMPUTED). Use them as finder charts.'
      : target.kind === 'exoplanet'
        ? 'Survey images of the host star across the spectrum. The planet itself is far too close to its star and too faint to appear in any of them.'
        : 'This star (centre) across the spectrum: hot gas shines in X-rays, young stars in ultraviolet, cool stars and dust in the infrared, cold gas in radio. Blank tiles: that survey does not cover this part of the sky.' }),
    bandPills, fovPills, where, surveyGrid);
  if (target.surveys !== false) drawSurveys(true);

  // ---- archive --------------------------------------------------------------------------------
  if (target.archive) {
    const gallery = el('div', { className: 'im-grid im-archive' }, el('p', { className: 'note', textContent: 'SEARCHING NASA\'S IMAGE LIBRARY…' }));
    node.append(el('h4', { className: 'im-sub', textContent: 'ARCHIVE · NASA IMAGE AND VIDEO LIBRARY' }), gallery);
    const q = new URLSearchParams({ q: target.archive.q, must: target.archive.must ?? '' });
    fetch(`/api/nasa-images?${q}`).then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status)))).then((res) => {
      if (!res.items.length) { gallery.replaceChildren(el('p', { className: 'note', textContent: 'NO IMAGES OF THIS BODY IN NASA\'S LIBRARY.' })); return; }
      gallery.replaceChildren(...res.items.slice(0, 24).map((it) => {
        const art = ARTWORK.test(`${it.title} ${it.description} ${it.keywords.join(' ')}`);
        const tier = art ? 'imagined' : 'measured';
        const note = art ? 'The caption calls this an artist\'s concept, illustration or simulation.' : 'A spacecraft or telescope image (by its caption; check the description).';
        const img = el('img', { src: `/api/nasa-image/${encodeURIComponent(it.nasaId)}/thumb`, alt: it.title, loading: 'lazy' });
        const tile = el('figure', { className: 'im-tile' }, img, el('figcaption', {}, el('span', { textContent: it.title.toUpperCase().slice(0, 60) }), badge(tier, note),
          el('span', { className: 'im-time mono', textContent: it.date ?? '' })));
        img.addEventListener('error', () => tile.classList.add('im-dead'));
        tile.addEventListener('click', () => open(`/api/nasa-image/${encodeURIComponent(it.nasaId)}/medium`, it.title,
          el('p', { className: 'note mono', textContent: [it.date, it.center, it.creator].filter(Boolean).join(' · ') }),
          el('div', {}, badge(tier, note)),
          el('p', { className: 'note', textContent: it.description }),
          el('a', { href: `https://images.nasa.gov/details/${encodeURIComponent(it.nasaId)}`, target: '_blank', rel: 'noopener noreferrer', textContent: `FULL RESOLUTION AT IMAGES.NASA.GOV (${it.nasaId})` })));
        return tile;
      }));
      gallery.after(el('p', { className: 'note credit', textContent: `${res.source}. NASA imagery is generally public domain; credits as captioned.` }));
    }).catch(() => gallery.replaceChildren(el('p', { className: 'note', textContent: 'NASA IMAGE LIBRARY UNREACHABLE (OFFLINE?).' })));
  }

  node.append(lightbox);
  return {
    node,
    /** Re-centre the survey strip on a moving body (cheap: only when it has moved). */
    tick() { if (target.moving && target.surveys !== false) drawSurveys(false); },
    dispose() { for (const u of objectUrls) URL.revokeObjectURL(u); },
  };
}
