// FUTURE (#53): the future-events catalogue in the right panel. Supernova scenarios get a light
// curve scaled to their distance, passing stars their pull on the planets, the pole stars their
// computed run, the Sun its track, and Earth the live impact-risk lists. GO TO sets the clock (deep
// time where the clock supports it) and flies to the place to watch.

import { FUTURE_EVENTS, FUTURE_GROUPS, SUN_STAGES } from '../data/future-events.js';
import { apparentMag, lightCurve, brightnessWords, daysBrighterThan, sunLuminosity, habitableZone, earthLeavesHabitableZone, poleStarSequence, passingStarPull } from '../astro/future.js';
import { jdFromDate } from '../astro/time.js';

const SVGNS = 'http://www.w3.org/2000/svg';
const svg = (tag, attrs = {}, ...kids) => { const el = document.createElementNS(SVGNS, tag); for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v); el.append(...kids); return el; };
const fmtYears = (y) => (y >= 1e9 ? `${+(y / 1e9).toFixed(2)} GYR` : y >= 1e6 ? `${+(y / 1e6).toFixed(2)} MYR` : y >= 1e4 ? `${Math.round(y / 1e3)} KYR` : `${Math.round(y).toLocaleString()} YR`);
const yearStr = (y) => (y <= 0 ? `${1 - y} BCE` : `AD ${y}`);
const CALENDAR_YEARS = 273000; // JavaScript dates: the clock's reach without deep time

/** A supernova light curve: apparent magnitude against days, with the daylight and naked-eye limits. */
function lightCurveChart(peak, sd, type) {
  const W = 340, H = 150, L = 34, R = 8, T = 8, B = 22, DAYS = 1500, MIN = -13, MAX = 8;
  const x = (d) => L + (d / DAYS) * (W - L - R), y = (m) => T + ((m - MIN) / (MAX - MIN)) * (H - T - B);
  const path = (off) => Array.from({ length: 151 }, (_, i) => { const d = (i / 150) * DAYS, m = Math.min(MAX, peak + off + lightCurve(d, type)); return `${i ? 'L' : 'M'}${x(d).toFixed(1)},${y(m).toFixed(1)}`; }).join('');
  const band = `${path(-sd)}${Array.from({ length: 151 }, (_, i) => { const d = DAYS - (i / 150) * DAYS, m = Math.min(MAX, peak + sd + lightCurve(d, type)); return `L${x(d).toFixed(1)},${y(m).toFixed(1)}`; }).join('')}Z`;
  const ref = (m, label) => [svg('line', { x1: L, x2: W - R, y1: y(m), y2: y(m), class: 'fc-ref' }), svg('text', { x: W - R - 2, y: y(m) - 3, 'text-anchor': 'end', class: 'fc-label' }, label)];
  const axis = [svg('line', { x1: L, x2: L, y1: T, y2: H - B, class: 'fc-axis' }), svg('line', { x1: L, x2: W - R, y1: H - B, y2: H - B, class: 'fc-axis' })];
  const ticksY = [-12, -8, -4, 0, 4, 8].map((m) => svg('text', { x: L - 4, y: y(m) + 4, 'text-anchor': 'end', class: 'fc-label' }, String(m)));
  const ticksX = [0, 365, 730, 1095, 1460].map((d, i) => svg('text', { x: x(d), y: H - 6, 'text-anchor': 'middle', class: 'fc-label' }, i ? `${i} YR` : '0'));
  return svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'future-chart', role: 'img', 'aria-label': `Light curve: peak magnitude ${peak.toFixed(1)}, fading over years` },
    ...axis, ...ref(-4, 'DAYLIGHT (VENUS)'), ...ref(6, 'NAKED EYE'), ...ref(-12.7, 'FULL MOON'),
    svg('path', { d: band, class: 'fc-band' }), svg('path', { d: path(0), class: 'fc-line' }), ...ticksY, ...ticksX);
}

export function createFutureEventsPanel({ h, pill, row, badge, go, clock, toast, panel, system, settings }) {
  let risk = null, riskLoading = false, selected = null;

  /** Set the clock `years` ahead (or to an ISO date) and fly to `target`. */
  function goTo(e) {
    if (e.iso) clock.set(jdFromDate(new Date(e.iso)));
    else if (e.years != null) {
      if (typeof clock.setYears === 'function') clock.setYears(e.years);
      else if (Math.abs(e.years) < CALENDAR_YEARS) clock.set(jdFromDate(new Date()) + e.years * 365.25);
      else { toast(`${fmtYears(e.years)} AHEAD IS BEYOND THE CLOCK'S CALENDAR (±273 KYR)`); return; }
    }
    if (e.go) go(e.go);
  }

  // ---- scenario visuals in the System View (#53): opt-in, labelled MODELLED, cleared on leaving FUTURE ----
  const observer = () => { const o = settings?.get('observer'); return o && Number.isFinite(o.lat) && Number.isFinite(o.lon) ? o : { lat: 51.4779, lon: 0, label: 'GREENWICH' }; };
  /** The next time (JD, within a sidereal day of `jd`) a star at `raDeg` crosses the meridian at east longitude `lonDeg`. */
  const nextTransit = (jd, raDeg, lonDeg) => {
    const lst = (280.46061837 + 360.98564736629 * (jd - 2451545) + lonDeg) % 360;
    return jd + ((((raDeg - lst) % 360) + 360) % 360) / 360.98564736629;
  };
  function showInSky(e) {
    const { ra, dec, M, distLy, av } = e.sn, peak = apparentMag(M, distLy, av), o = observer();
    system?.setScenario({ star: { ra, dec, mag: peak, label: `${e.title.split(':')[0].replace(' GOES SUPERNOVA', '')} SUPERNOVA · MAG ${peak.toFixed(1)} · MODELLED` } });
    clock.set(nextTransit(clock.jd, ra, o.lon));
    clock.setRate(0);
    if (!system?.surfaceAt('earth', o.lat, o.lon)) { toast('STAND ON EARTH TO SEE IT IN THE SKY'); return; }
    let tries = 0;
    const turn = () => { const a = system.lookAtSky(ra, dec); if (!a && ++tries < 40) return setTimeout(turn, 100); if (a && a.alt < 0) toast(`BELOW THE HORIZON FROM ${(o.label ?? '').toUpperCase() || 'HERE'} (ALTITUDE ${a.alt.toFixed(0)}°): SET ANOTHER OBSERVER`); };
    turn();
    toast(`${o.label ? o.label.toUpperCase() : `${o.lat.toFixed(1)}°, ${o.lon.toFixed(1)}°`} · THE STAR AT ITS HIGHEST · CLOCK HELD`);
  }
  function showRing(e) {
    system?.setScenario({ ring: e.ring });
    system?.focus(e.ring.body);
    toast(`${e.ring.label} · SHOWN IN THE SYSTEM VIEW`);
  }
  /** Gliese 710's modelled comet shower: extra naked-eye comets per year against time (shape illustrative). */
  function showerChart(sh) {
    const W = 360, H = 110, L = 34, R = 10, T = 14, B = 18, X0 = 0, X1 = 6e6;
    const x = (y) => L + ((y - X0) / (X1 - X0)) * (W - L - R), y = (v) => T + (1 - v / 12) * (H - T - B);
    const rate = (t) => (t < sh.startYears ? 0 : t < sh.startYears + 5e5 ? sh.extraPerYear * (t - sh.startYears) / 5e5 : t < sh.startYears + sh.durationYears ? sh.extraPerYear : Math.max(0, sh.extraPerYear * (1 - (t - sh.startYears - sh.durationYears) / 5e5)));
    const d = Array.from({ length: 121 }, (_, i) => { const t = (i / 120) * X1; return `${i ? 'L' : 'M'}${x(t).toFixed(1)},${y(rate(t)).toFixed(1)}`; }).join('');
    return svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'future-chart', role: 'img', 'aria-label': 'Modelled extra comets per year after Gliese 710 passes' },
      svg('text', { x: L, y: 10, class: 'fc-label fc-title' }, 'EXTRA NAKED-EYE COMETS PER YEAR (MODELLED)'),
      svg('line', { x1: L, x2: L, y1: T, y2: H - B, class: 'fc-axis' }), svg('line', { x1: L, x2: W - R, y1: H - B, y2: H - B, class: 'fc-axis' }),
      ...[0, 5, 10].map((v) => svg('text', { x: L - 4, y: y(v) + 3, 'text-anchor': 'end', class: 'fc-label' }, String(v))),
      ...[[0, 'NOW'], [1.29e6, 'PASS'], [3e6, '3 MYR'], [6e6, '6 MYR']].map(([t, l]) => svg('text', { x: x(t), y: H - 5, 'text-anchor': 'middle', class: 'fc-label' }, l)),
      svg('line', { x1: x(sh.startYears), x2: x(sh.startYears), y1: T, y2: H - B, class: 'fc-ref' }),
      svg('path', { d, class: 'fc-line' }));
  }
  function snSection(e) {
    const { M, Msd, distLy, type, av } = e.sn;
    const peak = apparentMag(M, distLy, av), dl = h('dl');
    row(dl, 'PEAK BRIGHTNESS', `MAG ${peak.toFixed(1)} (±${Msd})`, 'computed', `M_V ${M} ± ${Msd} (${type === 'IIP' ? 'Type II-P, Anderson et al. 2014' : 'stripped-envelope / super-luminous'}) at ${distLy.toLocaleString()} ly${av ? `, with ${av} mag of extinction` : ', before interstellar extinction'}.`);
    row(dl, 'LOOKS LIKE', brightnessWords(peak), 'computed', 'Compared with the full Moon (−12.7), half Moon (~−10), Venus (−4.6) and Sirius (−1.5).');
    const day = daysBrighterThan(peak, -4, type), eye = daysBrighterThan(peak, 6, type);
    row(dl, 'IN DAYLIGHT (MAG < −4)', day ? `~${day} DAYS` : 'NO', 'modelled', 'From the light-curve template; −4 is about Venus, visible by day if you know where to look.');
    row(dl, 'NAKED EYE (MAG < 6)', eye >= 3650 ? 'OVER 10 YEARS' : `~${(eye / 365.25).toFixed(1)} YEARS`, 'modelled', 'From the light-curve template; a dark sky.');
    return [dl, h('div', { className: 'explain-figure' }, lightCurveChart(peak, Msd, type)),
      h('p', { className: 'note', textContent: 'MODELLED light curve (template shape, scaled to the distance); the shaded band is the spread in peak brightness of real supernovae of this type.' }),
      system ? h('div', { className: 'body-list' }, pill(`SHOW IN THE SKY FROM ${(observer().label ?? 'MY LOCATION').toUpperCase()} ▸`, () => showInSky(e))) : null];
  }
  function poleSection() {
    const runs = poleStarSequence(-3000, 28000, 25).filter((r) => r.minSepDeg < 7);
    return [h('div', { className: 'host-list' }, runs.map((r) => h('div', { className: 'host-row' },
      h('span', { textContent: r.name.toUpperCase() }),
      h('span', { className: 'mono', textContent: `${yearStr(r.fromYear)} – ${yearStr(r.toYear)} · CLOSEST ${r.minSepDeg.toFixed(1)}° ~${yearStr(r.bestYear)}` })))),
    h('p', { className: 'note', textContent: 'COMPUTED: the bright star nearest the north celestial pole, every 25 years. Separations under 7° only; between them there is no good pole star.' })];
  }
  function sunSection() {
    const dl = h('dl');
    for (const g of [0, 0.5, 1, 2, 3, 4]) {
      const L = sunLuminosity(g), hz = habitableZone(L);
      row(dl, g ? `+${g} GYR` : 'TODAY', `${L.toFixed(2)} L☉ · HABITABLE ZONE ${hz.inner.toFixed(2)}–${hz.outer.toFixed(2)} AU`, 'computed', 'Main-sequence luminosity from Gough (1981); habitable zone from Kopparapu et al. (2013).');
    }
    row(dl, 'EARTH LEAVES THE ZONE', `IN ~${earthLeavesHabitableZone().toFixed(1)} GYR`, 'computed', 'When the runaway-greenhouse limit passes 1 au.');
    const stages = h('dl');
    for (const st of SUN_STAGES) row(stages, `+${st.gyr} GYR`, `${st.label}: ${st.detail}`, st.computed ? 'computed' : 'modelled', st.computed ? 'Gough 1981 with Kopparapu et al. 2013.' : 'Schröder & Smith 2008.');
    return [dl, stages,
    h('p', { className: 'note', textContent: 'Late stages MODELLED by Schröder & Smith (2008); the dates beyond the main sequence carry a few hundred million years of uncertainty.' }),
    ...hrSection()];
  }
  // The Sun's track on the Hertzsprung–Russell diagram (MIST v1.2, 1 M☉, solar metallicity), loaded on demand.
  let track = null;
  const PHASE = { '-1': 'PRE-MAIN SEQUENCE', 0: 'MAIN SEQUENCE', 2: 'RED-GIANT BRANCH', 3: 'CORE HELIUM BURNING', 4: 'EARLY AGB', 5: 'THERMALLY PULSING AGB', 6: 'POST-AGB → WHITE DWARF' };
  function hrSection() {
    if (!track) { track = 'loading'; import('../data/sun-track.js').then((m) => { track = m.default; if (selected === 'sun-future') render(); }); }
    if (track === 'loading') return [h('p', { className: 'note', textContent: 'LOADING THE MIST TRACK…' })];
    const W = 360, H = 230, L = 34, R = 8, T = 10, B = 22, TMAX = 5.3, TMIN = 3.45, LMIN = -4.5, LMAX = 4.2;
    const x = (lt) => L + ((TMAX - lt) / (TMAX - TMIN)) * (W - L - R), y = (ll) => T + ((LMAX - ll) / (LMAX - LMIN)) * (H - T - B);
    const pts = track.filter((r) => r[5] >= 0).map((r) => `${x(r[3]).toFixed(1)},${y(r[2]).toFixed(1)}`);
    const NOW = 4.57e9, i = track.findIndex((r) => r[0] >= NOW), a = track[i - 1], b = track[i], f = (NOW - a[0]) / (b[0] - a[0]);
    const now = [a[2] + (b[2] - a[2]) * f, a[3] + (b[3] - a[3]) * f];
    const first = (ph) => track.find((r) => r[5] === ph);
    const tip = track.filter((r) => r[5] === 2).reduce((m, r) => (r[4] > m[4] ? r : m));
    const maxR = track.reduce((m, r) => (r[4] > m[4] ? r : m)), last = track.at(-1);
    const clump = track.filter((r) => r[5] === 3).reduce((m, r) => (r[2] < m[2] ? r : m)); // settled core helium burning (red clump)
    // [label, log L, log T, dx, dy, anchor]: placed by hand so they clear each other near the giant branch
    const marks = [['TODAY', now[0], now[1], -6, 12, 'end'], ['RED GIANT BEGINS', first(2)[2], first(2)[3], -6, -5, 'end'], ['TIP · HELIUM FLASH', tip[2], tip[3], -6, 4, 'end'],
      ['HELIUM BURNING (RED CLUMP)', clump[2], clump[3], -6, 4, 'end'], ['AGB, LARGEST', maxR[2], maxR[3], -6, -4, 'end'], ['WHITE DWARF', last[2], last[3], 6, 12, 'start']];
    const fig = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'future-chart', role: 'img', 'aria-label': 'The Sun\'s evolutionary track on the Hertzsprung–Russell diagram' },
      svg('line', { x1: L, x2: L, y1: T, y2: H - B, class: 'fc-axis' }), svg('line', { x1: L, x2: W - R, y1: H - B, y2: H - B, class: 'fc-axis' }),
      ...[-4, -2, 0, 2, 4].map((v) => svg('text', { x: L - 4, y: y(v) + 3, 'text-anchor': 'end', class: 'fc-label' }, v ? `10${v > 0 ? '⁺' : '⁻'}${'⁰¹²³⁴'[Math.abs(v)]}` : '1')),
      ...[[5, '100,000 K'], [4.5, '30,000'], [4, '10,000'], [3.7, '5,000']].map(([lt, t]) => svg('text', { x: x(lt), y: H - 6, 'text-anchor': 'middle', class: 'fc-label' }, t)),
      svg('text', { x: L + 4, y: T + 8, class: 'fc-label fc-title' }, 'LUMINOSITY (L☉) VS SURFACE TEMPERATURE'),
      svg('path', { d: `M${pts.join('L')}`, class: 'fc-line' }),
      ...marks.flatMap(([t, ll, lt, dx, dy, anchor]) => [svg('circle', { cx: x(lt), cy: y(ll), r: 3, class: 'fc-dot' }),
        svg('text', { x: x(lt) + dx, y: y(ll) + dy, 'text-anchor': anchor, class: 'fc-label' }, t)]));
    const dl = h('dl'), ahead = (r) => `+${((r[0] - NOW) / 1e9).toFixed(2)} GYR`;
    row(dl, 'RED-GIANT BRANCH BEGINS', `${ahead(first(2))}`, 'modelled', 'MIST v1.2 (Choi et al. 2016), 1 M☉, [Fe/H] = 0.');
    row(dl, 'TIP AND HELIUM FLASH', `${ahead(tip)} · ${Math.round(10 ** tip[4])} R☉ · ${Math.round(10 ** tip[2]).toLocaleString()} L☉ · ${tip[1].toFixed(2)} M☉`, 'modelled', 'MIST v1.2; Schröder & Smith (2008) give +7.59 Gyr, 256 R☉, 2,730 L☉: the models differ in mass loss.');
    row(dl, 'CORE HELIUM BURNING', `${ahead(clump)} · ~${Math.round(10 ** clump[2])} L☉ · ${Math.round(10 ** clump[4])} R☉`, 'modelled', 'MIST v1.2: the quiet phase after the helium flash.');
    row(dl, 'LARGEST (THERMALLY PULSING AGB)', `${ahead(maxR)} · ${Math.round(10 ** maxR[4])} R☉ (${(10 ** maxR[4] * 0.00465).toFixed(2)} AU)`, 'modelled', 'MIST v1.2.');
    row(dl, 'WHITE DWARF', `${last[1].toFixed(2)} M☉`, 'modelled', 'MIST v1.2; Schröder & Smith (2008): 0.54 M☉.');
    return [h('h3', { textContent: 'THE SUN ON THE HERTZSPRUNG–RUSSELL DIAGRAM' }), h('div', { className: 'explain-figure' }, fig), dl,
      h('p', { className: 'note', textContent: `MODELLED: MIST v1.2 track (Choi et al. 2016; Dotter 2016). At today's measured age (4.57 Gyr) this grid track gives ${(10 ** now[0]).toFixed(2)} L☉ and ${Math.round(10 ** now[1]).toLocaleString()} K against the real Sun's 1.00 L☉ and 5,772 K: a grid track, not a solar-calibrated model, so its dates carry ~10% systematic uncertainty.` })];
  }
  function starSection(e) {
    const { massSun, distAu } = e.star, p = passingStarPull(massSun, distAu), dl = h('dl');
    row(dl, 'ITS PULL VS THE SUN\'S ON EARTH', p.direct.toExponential(1), 'computed', `${massSun} M☉ at ${distAu.toLocaleString()} au, against 1 M☉ at 1 au.`);
    row(dl, 'TIDAL STRETCH ACROSS EARTH\'S ORBIT', p.tidal.toExponential(1), 'computed', 'The differential part, which is what could change a planet\'s orbit: negligible.');
    return [dl];
  }
  /** The Moon: no catalogue publishes lunar impact odds; the one well-known case, as reported. */
  function moonSection() {
    const dl = h('dl');
    row(dl, '2024 YR4 (~60 M) · FEB 2025', '1.7% CHANCE OF HITTING THE MOON, 2032-12-22', 'reported', 'NASA CNEOS, February 2025.');
    row(dl, '2024 YR4 · APR → JUN 2025', '3.8% → 4.3%', 'reported', 'NASA CNEOS, with JWST astrometry from May 2025 (NASA Planetary Defense blog, 2025-06-05).');
    row(dl, '2024 YR4 · 2026-03-05', 'RULED OUT: IT MISSES THE MOON', 'reported', 'NASA CNEOS, from JWST observations on 2026-02-18 and 2026-02-26.');
    return [h('h3', { textContent: 'THE MOON' }), dl,
      h('p', { className: 'note', textContent: 'Sentry and NEOCC list Earth impacts only; no object currently has a published lunar impact probability. YR4 shows how odds change as observations come in.' }),
      h('p', { className: 'note' }, 'SOURCE: ', h('a', { href: 'https://science.nasa.gov/solar-system/asteroids/2024-yr4', target: '_blank', rel: 'noopener', textContent: 'NASA: 2024 YR4' }))];
  }
  function riskSection() {
    if (!risk && !riskLoading) {
      riskLoading = true;
      fetch('/api/impact-risk').then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))).then((j) => { risk = j; }).catch((err) => { risk = { error: err.message }; })
        .finally(() => { riskLoading = false; if (selected === 'impact-risk') render(); });
      return [h('p', { className: 'note', textContent: 'LOADING NASA SENTRY AND ESA NEOCC…' }), ...moonSection()];
    }
    if (!risk || risk.error) return [h('p', { className: 'warn', textContent: 'Risk lists unavailable: start the local backend (npm start) and go online.' }), ...moonSection()];
    const list = (title, src, fmt) => (src?.rows ? [h('h3', { textContent: `${title} · ${src.count} OBJECTS` }),
      h('div', { className: 'host-list' }, src.rows.slice(0, 12).map((r) => h('div', { className: 'host-row', title: fmt.title(r) }, h('span', { textContent: fmt.name(r) }), h('span', { className: 'mono', textContent: fmt.line(r) })))),
      h('p', { className: 'note', textContent: `${src.fetched ? `FETCHED ${src.fetched.slice(0, 16).replace('T', ' ')} UTC` : ''}${src.updated ? ` · LIST UPDATED ${src.updated}` : ''}. Sorted by cumulative Palermo scale (0 = as risky as the background; −2 = 1% of it).` })]
      : [h('p', { className: 'warn', textContent: `${title}: ${src?.error ?? 'unavailable'}` })]);
    const torino = Math.max(0, ...[...(risk.sentry?.rows ?? []), ...(risk.neocc?.rows ?? [])].map((r) => r.ts ?? 0));
    const tdl = h('dl');
    row(tdl, 'HIGHEST TORINO RATING NOW', String(torino), 'computed', 'Torino scale 0–10 across both lists; 0 = no hazard, 1 = normal (no unusual danger), 2–4 = meriting attention by astronomers, 5+ = threatening.');
    const size = (m) => (m == null ? '?' : m >= 1000 ? `${(m / 1000).toFixed(1)} KM` : `${Math.round(m)} M`);
    return [tdl, ...moonSection(),
      ...list('NASA SENTRY', risk.sentry, { name: (r) => r.name.toUpperCase(), line: (r) => `${r.years} · P ${r.ip?.toExponential(1)} · PS ${r.psCum} · ${size(r.diameterM)}`, title: (r) => `${r.nImp} potential impacts ${r.years}; cumulative probability ${r.ip}; Palermo ${r.psCum} (max ${r.psMax}); Torino ${r.ts ?? 0}; ~${size(r.diameterM)}; v∞ ${r.vInfKms?.toFixed(1)} km/s; last observed ${r.lastObs}` }),
      ...list('ESA NEOCC', risk.neocc, { name: (r) => `${r.des}${r.name ? ` ${r.name}` : ''}`.toUpperCase(), line: (r) => `${r.date.slice(0, 10)} · P ${r.ipCum?.toExponential(1)} · PS ${r.psCum} · ${size(r.diameterM)}`, title: (r) => `Most likely impact ${r.date} UTC (probability ${r.ipMax}); impacts possible ${r.years}; cumulative ${r.ipCum}; Palermo ${r.psCum}; Torino ${r.ts}; ${size(r.diameterM)}; ${r.vKms} km/s` }),
    ];
  }

  function card(e) {
    const open = selected === e.id;
    const head = h('button', { className: `host-row event-row${open ? ' future-open' : ''}`, onclick: () => { selected = open ? null : e.id; render(); } },
      h('span', { textContent: e.title }), h('span', { className: 'mono', textContent: e.when }));
    if (!open) return [head];
    const ringBtn = e.ring && system ? [h('div', { className: 'body-list' }, pill('SHOW THE RING ▸', () => showRing(e)))] : [];
    const extra = e.sn ? snSection(e) : e.poles ? poleSection() : e.sunTrack ? sunSection() : e.star ? starSection(e) : e.risk ? riskSection() : [];
    const facts = h('dl');
    for (const [label, value, tier, detail] of e.facts) row(facts, label, value, tier, detail);
    const canGo = e.iso || e.go || e.years != null;
    return [head, h('div', { className: 'future-card' },
      h('div', { className: 'legend' }, badge(e.tier, e.impossible ? 'Computed from measured masses: this cannot happen.' : ''), e.impossible ? h('span', { className: 'warn', textContent: 'NOT POSSIBLE' }) : null),
      h('p', { className: 'note explain', textContent: e.summary }),
      e.facts.length ? facts : null, ...extra, ...ringBtn,
      h('p', { className: 'note' }, 'SOURCE: ', h('a', { href: e.url, target: '_blank', rel: 'noopener', textContent: e.source })),
      canGo ? h('div', { className: 'body-list' }, pill(e.iso ? 'GO TO THE DATE ▸' : e.years != null ? `GO ${fmtYears(e.years)} AHEAD ▸` : 'SHOW ▸', () => goTo(e))) : null)];
  }

  function render(id = selected) {
    selected = id;
    panel.replaceChildren(
      h('h2', { textContent: 'FUTURE' }),
      h('div', { className: 'kind', textContent: 'WHAT IS COMING · FROM 2029 TO THE SUN\'S LAST LIGHT' }),
      h('p', { className: 'note', textContent: 'Firm predictions from measured orbits and motions are COMPUTED. Nobody can predict when a star will explode, so supernovae are MODELLED scenarios with a window, never a date. Click an event for details.' }),
      ...FUTURE_GROUPS.flatMap(([g, title]) => [h('h3', { textContent: title }), h('div', { className: 'host-list' }, FUTURE_EVENTS.filter((e) => e.group === g).flatMap(card))]),
    );
  }
  /** Leaving FUTURE: take the scenario visuals away. */
  const leave = () => system?.setScenario(null);
  return { render, leave };
}
