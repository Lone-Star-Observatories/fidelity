// SKY EVENTS (#30): eclipses, transits, occultations and alignments in the body panels, each
// with a button that sets the ship's clock to it and flies to the best body to watch it from.
// Every value is COMPUTED from the app's own ephemeris (src/astro/eclipses.js).

import { skyEvents, onSkyEvents, solarEclipseAt, lunarEclipseAt } from '../data/skyevents.js';
import { lunarShadow, localCircumstances, solarShadow, jovianEvents, jovianPlaneCrossing, R_EARTH } from '../astro/eclipses.js';
import { MOONS } from '../data/moons.js';

const NAMES = { mercury: 'Mercury', venus: 'Venus', mars: 'Mars', jupiter: 'Jupiter', saturn: 'Saturn', uranus: 'Uranus', neptune: 'Neptune', moon: 'the Moon',
  io: 'Io', europa: 'Europa', ganymede: 'Ganymede', callisto: 'Callisto' };
const cap = (s) => s.toUpperCase();
const utc = (jd) => new Date((jd - 2440587.5) * 86400000).toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
const hms = (jd) => new Date((jd - 2440587.5) * 86400000).toISOString().slice(11, 19);
const dur = (s) => (s >= 3600 ? `${Math.floor(s / 3600)}H ${Math.round((s % 3600) / 60)}M` : `${Math.floor(s / 60)}M ${String(Math.round(s % 60)).padStart(2, '0')}S`);
const ll = (p) => `${Math.abs(p.lat).toFixed(1)}°${p.lat >= 0 ? 'N' : 'S'} ${Math.abs(p.lon).toFixed(1)}°${p.lon >= 0 ? 'E' : 'W'}`;
const GALILEAN = MOONS.filter((m) => ['io', 'europa', 'ganymede', 'callisto'].includes(m.id));

/** One-line title for an event. */
export function eventTitle(e) {
  if (e.type === 'solar') return `${cap(e.kind)} SOLAR ECLIPSE`;
  if (e.type === 'lunar') return `${cap(e.kind)} LUNAR ECLIPSE`;
  if (e.type === 'transit') return `TRANSIT OF ${cap(NAMES[e.body])}`;
  if (e.type === 'occultation') return `THE MOON OCCULTS ${cap(NAMES[e.body] ?? e.body)}`;
  if (e.kind === 'conjunction') return `CONJUNCTION · ${cap(e.body.split('–').map((x) => NAMES[x] ?? x).join(' & ').replace('THE MOON', 'MOON'))}`;
  if (e.kind === 'planetary parade') return `PLANETARY PARADE · ${e.body.split(', ').length} PLANETS`;
  return `${cap(e.kind)} · ${cap(NAMES[e.body] ?? e.body)}`;
}
/** Short detail line. */
export function eventDetail(e) {
  if (e.type === 'solar') return [e.place ? `GREATEST AT ${ll(e.place)}` : null, `MAG ${e.magnitude.toFixed(3)}`, e.durationS ? `${e.kind === 'annular' ? 'ANNULARITY' : 'TOTALITY'} ${dur(e.durationS)}` : null, `γ ${e.gamma.toFixed(3)}`].filter(Boolean).join(' · ');
  if (e.type === 'lunar') return [e.kind === 'penumbral' ? `PENUMBRAL MAG ${e.penumbralMagnitude.toFixed(3)}` : `UMBRAL MAG ${e.magnitude.toFixed(3)}`,
    e.contacts.U2 && e.contacts.U3 ? `TOTALITY ${dur((e.contacts.U3 - e.contacts.U2) * 86400)}` : null, 'VISIBLE WHEREVER THE MOON IS UP'].filter(Boolean).join(' · ');
  if (e.type === 'transit') return `${e.contacts.C1 ? `${hms(e.contacts.C1)}–${hms(e.contacts.C4)} UTC · ` : ''}CLOSEST ${Math.round(e.separationArcsec)}″ FROM THE SUN'S CENTRE`;
  if (e.type === 'occultation') return `SOMEWHERE ON EARTH · ${e.separationDeg.toFixed(2)}° GEOCENTRIC`;
  if (e.kind === 'conjunction') return `${e.separationDeg.toFixed(2)}° APART`;
  if (e.kind === 'greatest elongation') return `${e.elongationDeg.toFixed(1)}° FROM THE SUN · ${cap(e.side)}`;
  if (e.kind === 'opposition') return `${e.distanceAu.toFixed(2)} AU FROM EARTH · UP ALL NIGHT`;
  if (e.kind === 'planetary parade') return `${e.body.toUpperCase()} WITHIN ${Math.round(e.spanDeg)}° (THRESHOLD ${e.thresholdDeg}°, ALL > 15° FROM THE SUN)`;
  return '';
}
/** Where to watch it from: [body to fly to]. */
export const watchFrom = (e) => (e.type === 'solar' ? 'earth' : e.type === 'lunar' ? 'moon' : e.type === 'transit' ? 'sun' : e.type === 'occultation' ? 'moon'
  : e.kind === 'opposition' || e.kind === 'greatest elongation' ? e.body : e.kind === 'conjunction' ? e.body.split('–')[0] : 'earth');
/** Which events belong in a body's panel. */
const relevant = (id, e) => {
  if (id === 'earth' || id === 'sun') return e.type === 'solar' || e.type === 'lunar' || e.type === 'transit' || e.kind === 'planetary parade';
  if (id === 'moon') return e.type === 'solar' || e.type === 'lunar' || e.type === 'occultation';
  return !!e.body && (e.body === id || e.body.split(/–|, /).includes(id));
};

export function createSkyEventsPanel({ h, row, pill, go, clock, system }) {
  let box = null, bodyId = null, liveDl = null, live = {};

  function list() {
    if (!box) return;
    const now = clock.jd;
    const upcoming = skyEvents().filter((e) => relevant(bodyId, e) && (e.contacts?.P4 ?? e.end ?? e.greatest) >= now).slice(0, bodyId === 'earth' || bodyId === 'moon' || bodyId === 'sun' ? 8 : 6);
    const rows = upcoming.map((e) => h('button', { className: 'host-row event-row', title: `${eventTitle(e)}\n${eventDetail(e)}\nCOMPUTED from the app's ephemeris${e.sun === 'horizons' ? ' (Sun from JPL Horizons, ~10 s)' : ' (Sun from Standish elements, ~±1 min)'}. Click to set the clock there.`,
      onclick: () => { clock.set(e.type === 'solar' || e.type === 'lunar' ? e.greatest - 2 / 1440 : e.greatest); go({ level: 'system', system: 'sol', body: watchFrom(e) }); } },
    h('span', { textContent: eventTitle(e) }), h('span', { className: 'mono', textContent: `${utc(e.greatest)} · ${eventDetail(e)}` })));
    box.replaceChildren(...(rows.length ? rows : [h('p', { className: 'note', textContent: skyEvents().length ? 'NONE IN THE NEXT TWO YEARS.' : 'COMPUTING…' })]));
  }
  onSkyEvents(list);

  /** The section for body `id` (Sol only), or null. */
  function section(id) {
    bodyId = id; live = {};
    box = h('div', { className: 'host-list' });
    liveDl = h('dl');
    const extra = [];
    if (id === 'earth' || id === 'moon' || id === 'sun') {
      live.state = row(liveDl, 'NOW', '—', 'computed', 'Shadow geometry at the ship\'s clock: the Moon\'s shadow on Earth, or Earth\'s on the Moon.');
    }
    if (id === 'jupiter') {
      const s = jovianPlaneCrossing(clock.jd);
      row(liveDl, 'MUTUAL EVENTS', s.season ? 'IN SEASON' : 'NOT IN SEASON', 'computed',
        `Earth ${s.earthDeg.toFixed(2)}° and the Sun ${s.sunDeg.toFixed(2)}° from Jupiter's equatorial plane. Within ~1° (every ~6 years) the Galilean moons eclipse and occult one another; individual events need ephemerides good to ~100 km (IMCCE), so they are not predicted here.`);
      const ev = jovianEvents(GALILEAN, clock.jd - 0.1, clock.jd + 2);
      extra.push(h('h3', { textContent: 'GALILEAN MOONS · NEXT 2 DAYS' }), h('div', { className: 'host-list' }, ev.slice(0, 10).map((e) => h('button', { className: 'host-row event-row',
        title: 'COMPUTED from fitted mean elements (≈1° along the orbit): times ±~10 min. Light time to Earth included. Click to set the clock there.',
        onclick: () => { clock.set(e.start + 5 / 1440); go({ level: 'system', system: 'sol', body: 'jupiter' }); } },
      h('span', { textContent: `${cap(NAMES[e.body])} · ${cap({ transit: 'transit', shadow: 'shadow transit', occultation: 'occulted', eclipse: 'eclipsed' }[e.kind])}` }),
      h('span', { className: 'mono', textContent: `${utc(e.start)} – ${hms(e.end)}` })))));
    }
    list();
    return [h('h3', { textContent: 'SKY EVENTS · COMPUTED' }), liveDl, box, ...extra,
      h('p', { className: 'note', textContent: 'From the app\'s own ephemeris, so they match the views: eclipses checked against the NASA/GSFC Five Millennium Canon (≈10 s with JPL Horizons, ~1 min with Keplerian elements). Click an event to jump there.' })];
  }

  /** Live status, from the shell's ticker. */
  function tick() {
    if (!live.state) return;
    const jd = clock.jd, se = solarEclipseAt(jd), le = lunarEclipseAt(jd);
    if (se && (bodyId === 'earth' || bodyId === 'sun' || bodyId === 'moon')) {
      const g = solarShadow(jd), central = g.dist < R_EARTH;
      let txt = `${eventTitle(se)} UNDER WAY`;
      if (central && se.place) {
        const kind = g.l2 > 0 ? 'UMBRA' : 'ANTUMBRA';
        txt += ` · ${kind} ON THE GROUND`;
      } else txt += ' · PENUMBRA ON EARTH (PARTIAL)';
      const left = (se.contacts.P4 - jd) * 86400;
      live.state.textContent = `${txt} · ENDS IN ${dur(left)}`;
    } else if (le && (bodyId === 'moon' || bodyId === 'earth' || bodyId === 'sun')) {
      const l = lunarShadow(jd);
      live.state.textContent = l.umbral >= 1 ? `TOTAL LUNAR ECLIPSE · UMBRAL MAG ${l.umbral.toFixed(3)}` : l.umbral > 0 ? `PARTIAL LUNAR ECLIPSE · UMBRAL MAG ${l.umbral.toFixed(3)}` : `PENUMBRAL · MAG ${Math.max(0, l.penumbral).toFixed(3)}`;
    } else {
      const next = skyEvents().find((e) => (e.type === 'solar' || e.type === 'lunar') && e.greatest > jd);
      live.state.textContent = next ? `NO ECLIPSE · NEXT IN ${Math.ceil(next.greatest - jd)} DAYS` : 'NO ECLIPSE';
    }
  }
  return { section, tick, refresh: list };
}

/** Sunlight left at an Earth surface point during a solar eclipse (1 = none hidden). */
export function eclipseDaylight(jd, lat, lon, surfacePoint) {
  if (!solarEclipseAt(jd)) return { light: 1, obscuration: 0 };
  const c = localCircumstances(jd, surfacePoint(lat, lon));
  const total = c.sm > c.ss && c.sep < c.sm - c.ss;
  return { light: total ? 0.001 : Math.pow(1 - c.obscuration, 0.15), obscuration: c.obscuration, total, magnitude: c.magnitude, sep: c.sep, sm: c.sm, ss: c.ss, eclipse: solarEclipseAt(jd) };
}
