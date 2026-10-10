// FROM EARTH: how to find a body in our sky, in the spirit of theskylive.com: where it is
// (RA/Dec, constellation), how bright and big it looks, its phase and elongation, whether it is
// up now and when it rises, crosses the meridian and sets for the viewer's location.
// Every number is COMPUTED by src/astro/observe.js from the app's ephemeris or catalogue.

import { badge } from '../data/provenance.js';
import { createEyepiece } from './eyepiece.js';
import { settings } from '../settings.js';
import {
  geocentric, describe, apparentMagnitude, constellation, subObserverLatitude, equatorialRadiusKm, riseTransitSet,
  ofDate, eclToEq, fromRaDec, horizontal, refraction, formatRa, formatDec, compass, bestMonth, AU_KM,
} from '../astro/observe.js';

const DEG = Math.PI / 180;
const MONTHS = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
export const DEFAULT_OBSERVER = { lat: 51.4769, lon: -0.0005, label: 'GREENWICH (DEFAULT)' };
const el = (tag, props = {}, ...kids) => {
  const e = Object.assign(document.createElement(tag), props);
  for (const k of kids.flat()) if (k != null) e.append(k);
  return e;
};
const fmt = (n, d = 0) => Number(n).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });
const dateOf = (jd) => new Date((jd - 2440587.5) * 86400000);
const clockTime = (jd) => dateOf(jd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }).toUpperCase();
const utc = (jd) => dateOf(jd).toISOString().slice(0, 16).replace('T', ' ') + ' UTC';

export function observer() {
  const o = settings.get('observer');
  return o && Number.isFinite(o.lat) && Number.isFinite(o.lon) ? o : DEFAULT_OBSERVER;
}

/** Visibility class for an apparent magnitude. */
export function reach(mag) {
  if (mag == null) return '—';
  return mag <= 6 ? 'NAKED EYE' : mag <= 9 ? 'BINOCULARS' : mag <= 13 ? 'SMALL TELESCOPE' : mag <= 20 ? 'LARGE TELESCOPE' : mag <= 26 ? 'PROFESSIONAL OBSERVATORY' : 'HUBBLE / JWST ONLY';
}

/** Angular size as text. */
export function angle(arcsec) {
  if (arcsec == null) return '—';
  if (arcsec >= 3600) return `${fmt(arcsec / 3600, 2)}°`;
  if (arcsec >= 60) return `${fmt(arcsec / 60, 1)}′`;
  return arcsec >= 0.1 ? `${fmt(arcsec, 2)}″` : `${fmt(arcsec * 1000, 2)} MILLIARCSEC`;
}

/**
 * Snapshot of a target as seen from Earth at `jd`.
 * target: { kind: 'sol', id, radiusKm, pole, positionAt(id, jd) → heliocentric ecliptic AU }
 *       | { kind: 'star', ra, dec, distPc, mag, sepArcsec? }
 */
export function skyState(target, jd) {
  if (target.kind === 'star') {
    return { ra: target.ra, dec: target.dec, eq: fromRaDec(target.ra, target.dec), mag: target.mag ?? null, star: true };
  }
  const helio = (id) => (t) => target.positionAt(id, t);
  const g = geocentric(helio(target.id), helio('earth'), jd);
  const d = describe(g, { radiusKm: equatorialRadiusKm(target.id, target.radiusKm) });
  const lat = target.pole ? subObserverLatitude(d.eq, target.pole) : 0;
  return { ...d, mag: apparentMagnitude(target.id, d, { ringTilt: lat, subLat: lat }), subLat: lat, lightDays: g.lightDays };
}

/** Rise/transit/set for the local day containing `jd` (local mean solar day at the observer's longitude). */
export function localDay(target, jd, obs) {
  const off = obs.lon / 360;
  const jd0 = Math.floor(jd + off - 0.5) + 0.5 - off;
  const raDecAt = target.kind === 'star'
    ? (() => { const p = ofDate(fromRaDec(target.ra, target.dec), jd); return () => p; })()
    : (t) => ofDate(eclToEq(geocentric((u) => target.positionAt(target.id, u), (u) => target.positionAt('earth', u), t).geo), t);
  let h0 = -0.5667;
  if (target.kind === 'sol' && (target.id === 'sun' || target.id === 'moon')) {
    const s = skyState(target, jd);
    h0 -= s.angularDiameterArcsec / 7200; // upper limb
    if (target.id === 'moon') h0 += Math.asin(6378.137 / (s.delta * AU_KM)) / DEG; // horizontal parallax
  }
  return { jd0, ...riseTransitSet(raDecAt, jd0, obs.lat, obs.lon, { h0, stepMin: target.id === 'moon' ? 6 : 12 }) };
}

/**
 * The FROM EARTH card. `getJd()` reads the ship's clock; call `tick()` from the live loop.
 * `onSky(state)` hears the current RA/Dec (the imagery card centres its finder chart on it).
 */
export function createFromEarthCard(target, { getJd, onSky } = {}) {
  const dl = el('dl', { className: 'fe-list' });
  const rows = {};
  const row = (key, label, tier, detail) => {
    const dd = el('dd', { className: 'mono', textContent: '—' });
    dl.append(el('dt', {}, label, ' ', badge(tier, detail)), dd);
    rows[key] = dd;
  };
  const sol = target.kind === 'sol';
  row('radec', 'RA · DEC (J2000)', 'computed', sol ? 'Astrometric, light-time corrected, from the app\'s ephemeris (JPL Horizons when loaded). Matches Horizons to ~1″.' : 'Catalogue position (HYG / Hipparcos, epoch J2000).');
  row('con', 'CONSTELLATION', 'computed', 'IAU boundaries (Delporte 1930) as tabulated by Roman (1987), position precessed to B1875.');
  row('mag', 'MAGNITUDE', sol ? 'computed' : 'measured', sol
    ? 'Apparent visual magnitude: Mallama & Hilton 2018 (planets), H–G (small bodies), JPL Horizons V(1,0) (moons). Lower is brighter; the faintest naked-eye stars are ~6.'
    : 'Catalogue apparent V magnitude (HYG: Hipparcos / Tycho / Gliese).');
  row('reach', 'TO SEE IT YOU NEED', 'computed', 'From the magnitude alone: under a dark sky the eye reaches ~6, binoculars ~9, a small telescope ~13. Glare, twilight and city light raise the bar.');
  if (sol) {
    if (target.id !== 'earth') row('dist', 'DISTANCE FROM EARTH', 'computed', 'Geocentric distance when the light we see left it.');
    if (target.id !== 'sun') row('sun', 'DISTANCE FROM SUN', 'computed', 'Heliocentric distance.');
    if (target.id !== 'sun') row('elong', 'ELONGATION', 'computed', 'Angle from the Sun on our sky. East of the Sun = evening sky; west = morning sky. Under ~15° it is lost in twilight.');
    if (target.id !== 'sun') row('phase', 'PHASE', 'computed', 'Fraction of the disc we see lit, and the Sun–body–Earth (phase) angle.');
    row('size', 'APPARENT SIZE', 'computed', 'Angular diameter (equatorial). The Moon is ~31′; the eye resolves ~1′; a small telescope ~1″.');
  } else {
    row('dist', 'DISTANCE', 'measured', 'Catalogue parallax distance.');
    if (target.sepArcsec != null) row('sepr', 'GREATEST SEPARATION FROM ITS STAR', 'computed', 'Orbit size ÷ distance: how far a telescope would have to split planet from star (JWST\'s coronagraphs work beyond ~0.5″).');
    row('best', 'BEST SEEN', 'computed', 'The month it stands highest at local midnight (opposite the Sun).');
  }
  row('now', 'NOW', 'computed', 'Altitude and azimuth for the observer, with standard refraction (azimuth from north through east).');
  row('rise', 'RISES', 'computed', 'Local day at the observer: rising of the centre with 34′ refraction (upper limb for the Sun and Moon; the Moon\'s parallax included). Times in your browser\'s time zone.');
  row('transit', 'HIGHEST (TRANSIT)', 'computed', 'Crossing the meridian, with its altitude there.');
  row('set', 'SETS', 'computed', 'Setting of the centre (upper limb for the Sun and Moon).');

  const obsLine = el('div', { className: 'fe-observer' });
  const latIn = el('input', { type: 'number', step: '0.0001', min: -90, max: 90, placeholder: 'LAT', className: 'fe-in' });
  const lonIn = el('input', { type: 'number', step: '0.0001', min: -180, max: 180, placeholder: 'LON (E+)', className: 'fe-in' });
  const form = el('form', { className: 'fe-form', hidden: true }, latIn, lonIn, el('button', { type: 'submit', className: 'pill', textContent: 'SET' }));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const lat = Number(latIn.value), lon = Number(lonIn.value);
    if (!(Math.abs(lat) <= 90 && Math.abs(lon) <= 180)) return;
    settings.set('observer', { lat, lon, label: `${fmt(Math.abs(lat), 2)}°${lat >= 0 ? 'N' : 'S'} ${fmt(Math.abs(lon), 2)}°${lon >= 0 ? 'E' : 'W'}` });
    form.hidden = true;
  });
  const useMine = el('button', { type: 'button', className: 'pill', textContent: 'USE MY LOCATION' });
  useMine.addEventListener('click', () => {
    if (!navigator.geolocation) { useMine.textContent = 'NOT AVAILABLE'; return; }
    useMine.textContent = 'LOCATING…';
    // coarse is enough for rise and set times, and it stays in the browser (settings, localStorage)
    navigator.geolocation.getCurrentPosition((p) => {
      settings.set('observer', { lat: +p.coords.latitude.toFixed(3), lon: +p.coords.longitude.toFixed(3), label: 'MY LOCATION' });
      useMine.textContent = 'USE MY LOCATION';
    }, () => { useMine.textContent = 'LOCATION DENIED'; }, { maximumAge: 3600000, timeout: 15000 });
  });
  const setBtn = el('button', { type: 'button', className: 'pill', textContent: 'SET…' });
  setBtn.addEventListener('click', () => { const o = observer(); latIn.value = o.lat; lonIn.value = o.lon; form.hidden = !form.hidden; });
  const obsText = el('span', { className: 'mono' });
  obsLine.append(el('span', { textContent: 'OBSERVER ' }), obsText, useMine, setBtn);

  const verdict = el('div', { className: 'sv-comp-title' });
  const node = el('section', { className: 'sv-card fe-card' },
    el('div', { className: 'sv-card-head' }, el('h3', { textContent: 'FROM EARTH · FINDING IT IN OUR SKY' }), badge('computed', 'Computed from the app\'s ephemeris and the catalogue; checked against JPL Horizons.')),
    verdict, obsLine, form, el('div', { className: 'fe-body' }, dl),
    el('p', { className: 'note', textContent: sol
      ? 'Follows the ship\'s clock: set a date to plan an observation. Positions are geocentric; for the Moon, your location shifts it by up to a degree (included in rise and set).'
      : 'A star\'s place barely changes in a lifetime (proper motion is ignored here); its rising and setting repeat each sidereal day, about four minutes earlier each night.' }));

  const eyepiece = sol && !['sun', 'moon', 'earth'].includes(target.id) ? createEyepiece(target) : null;
  if (eyepiece) node.querySelector('.fe-body').append(eyepiece.node);
  let dayKey = null, day = null, lastTick = 0, lastEye = 0;
  const unsub = settings.onChange((k) => { if (k === 'observer') { dayKey = null; lastTick = 0; tick(); } });

  function tick(force = false) {
    const now = performance.now();
    if (!force && now - lastTick < 500) return;
    lastTick = now;
    const jd = getJd();
    const o = observer();
    obsText.textContent = `${o.label} · ${fmt(Math.abs(o.lat), 2)}°${o.lat >= 0 ? 'N' : 'S'} ${fmt(Math.abs(o.lon), 2)}°${o.lon >= 0 ? 'E' : 'W'}`;
    let s;
    try { s = skyState(target, jd); } catch { return; }
    onSky?.(s);
    const c = constellation(s.ra, s.dec);
    rows.radec.textContent = `${formatRa(s.ra)} · ${formatDec(s.dec)}`;
    rows.con.textContent = c.name.toUpperCase();
    rows.mag.textContent = s.mag == null ? 'UNKNOWN' : `${s.mag > 0 ? '+' : ''}${fmt(s.mag, 2)}`;
    const glare = sol && target.id !== 'sun' && s.elongation < 12 && target.id !== 'earth';
    rows.reach.textContent = target.id === 'sun' ? 'NEVER LOOK DIRECTLY · SOLAR FILTER ONLY' : glare ? `${reach(s.mag)} · BUT LOST IN THE SUN'S GLARE NOW` : reach(s.mag);
    if (sol) {
      if (rows.dist) rows.dist.textContent = s.delta < 0.01 ? `${fmt(s.delta * AU_KM, 0)} KM · ${fmt(s.delta * AU_KM / 299792.458, 2)} LIGHT-SECONDS`
        : `${fmt(s.delta, 4)} AU · ${fmt(s.delta * AU_KM / 1e6, 1)} M KM · ${lightText(s.lightDays)}`;
      if (rows.sun) rows.sun.textContent = `${fmt(s.r, 4)} AU`;
      if (rows.elong) rows.elong.textContent = `${fmt(s.elongation, 1)}° ${s.east ? 'EAST · EVENING SKY' : 'WEST · MORNING SKY'}`;
      if (rows.phase) rows.phase.textContent = `${fmt(s.illuminated * 100, 1)}% LIT · PHASE ANGLE ${fmt(s.phase, 1)}°${target.id === 'moon' ? ` · ${moonPhaseName(s)}` : ''}`;
      rows.size.textContent = angle(s.angularDiameterArcsec);
    } else {
      rows.dist.textContent = `${fmt(target.distPc * 3.26156, target.distPc < 30 ? 2 : 0)} LIGHT-YEARS · ${fmt(target.distPc, 2)} PC`;
      if (rows.sepr) rows.sepr.textContent = angle(target.sepArcsec);
      rows.best.textContent = MONTHS[bestMonth(s.ra)];
    }
    const pd = ofDate(s.eq, jd);
    const hz = horizontal(pd.ra, pd.dec, jd, o.lat, o.lon);
    const alt = hz.alt + refraction(hz.alt);
    rows.now.textContent = `${alt > 0 ? 'UP' : 'BELOW THE HORIZON'} · ALT ${fmt(alt, 1)}° · AZ ${fmt(hz.az, 0)}° (${compass(hz.az)})`;
    const key = `${Math.floor(jd + o.lon / 360 - 0.5)}|${o.lat}|${o.lon}`;
    if (key !== dayKey) {
      dayKey = key;
      try { day = localDay(target, jd, o); } catch { day = null; }
    }
    if (day) {
      const t = (x) => (x == null ? null : `${clockTime(x)}`);
      rows.rise.textContent = day.always === 'up' ? 'NEVER SETS TODAY (CIRCUMPOLAR)' : day.always === 'down' ? 'DOES NOT RISE TODAY' : t(day.rise) ?? 'NOT TODAY';
      rows.set.textContent = day.always ? '—' : t(day.set) ?? 'NOT TODAY';
      rows.transit.textContent = day.transit ? `${t(day.transit)} · ${fmt(day.transitAlt, 1)}° HIGH` : '—';
      rows.rise.title = day.rise ? utc(day.rise) : ''; rows.set.title = day.set ? utc(day.set) : ''; rows.transit.title = day.transit ? utc(day.transit) : '';
    }
    verdict.textContent = summary(target, s, alt, day);
    if (eyepiece && (force || now - lastEye > 2000)) { lastEye = now; try { eyepiece.update(jd); } catch { /* ephemeris not ready */ } }
  }

  function summary(t, s, alt, d) {
    if (t.kind === 'sol' && t.id === 'earth') return 'YOU ARE STANDING ON IT';
    const where = `IN ${constellation(s.ra, s.dec).name.toUpperCase()}`;
    const vis = s.mag == null ? '' : ` · ${reach(s.mag)}`;
    const up = alt > 0 ? ' · ABOVE YOUR HORIZON NOW' : d?.always === 'down' ? ' · NEVER RISES FROM YOUR LATITUDE TODAY' : ' · BELOW YOUR HORIZON NOW';
    return `${where}${vis}${up}`;
  }

  tick(true);
  return { node, tick, dispose: unsub, get state() { try { return skyState(target, getJd()); } catch { return null; } } };
}

function lightText(days) {
  const s = days * 86400;
  return s < 120 ? `${fmt(s, 1)} LIGHT-SECONDS` : s < 7200 ? `${fmt(s / 60, 1)} LIGHT-MINUTES` : `${fmt(s / 3600, 2)} LIGHT-HOURS`;
}
function moonPhaseName(s) {
  const waxing = s.east; // east of the Sun: evening, waxing
  const k = s.illuminated;
  if (k < 0.02) return 'NEW';
  if (k > 0.98) return 'FULL';
  if (Math.abs(k - 0.5) < 0.04) return waxing ? 'FIRST QUARTER' : 'LAST QUARTER';
  return `${waxing ? 'WAXING' : 'WANING'} ${k < 0.5 ? 'CRESCENT' : 'GIBBOUS'}`;
}
