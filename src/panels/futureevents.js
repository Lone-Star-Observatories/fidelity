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

export function createFutureEventsPanel({ h, pill, row, badge, go, clock, toast, panel }) {
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

  function snSection(e) {
    const { M, Msd, distLy, type, av } = e.sn;
    const peak = apparentMag(M, distLy, av), dl = h('dl');
    row(dl, 'PEAK BRIGHTNESS', `MAG ${peak.toFixed(1)} (±${Msd})`, 'computed', `M_V ${M} ± ${Msd} (${type === 'IIP' ? 'Type II-P, Anderson et al. 2014' : 'stripped-envelope / super-luminous'}) at ${distLy.toLocaleString()} ly${av ? `, with ${av} mag of extinction` : ', before interstellar extinction'}.`);
    row(dl, 'LOOKS LIKE', brightnessWords(peak), 'computed', 'Compared with the full Moon (−12.7), half Moon (~−10), Venus (−4.6) and Sirius (−1.5).');
    const day = daysBrighterThan(peak, -4, type), eye = daysBrighterThan(peak, 6, type);
    row(dl, 'IN DAYLIGHT (MAG < −4)', day ? `~${day} DAYS` : 'NO', 'modelled', 'From the light-curve template; −4 is about Venus, visible by day if you know where to look.');
    row(dl, 'NAKED EYE (MAG < 6)', eye >= 3650 ? 'OVER 10 YEARS' : `~${(eye / 365.25).toFixed(1)} YEARS`, 'modelled', 'From the light-curve template; a dark sky.');
    return [dl, h('div', { className: 'explain-figure' }, lightCurveChart(peak, Msd, type)),
      h('p', { className: 'note', textContent: 'MODELLED light curve (template shape, scaled to the distance); the shaded band is the spread in peak brightness of real supernovae of this type.' })];
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
    return [dl, h('div', { className: 'host-list' }, SUN_STAGES.map((s) => h('div', { className: 'host-row', title: s.detail },
      h('span', { textContent: `+${s.gyr} GYR · ${s.label}` }), h('span', { className: 'mono', textContent: s.detail })))),
    h('p', { className: 'note', textContent: 'Late stages MODELLED by Schröder & Smith (2008); the dates beyond the main sequence carry a few hundred million years of uncertainty.' })];
  }
  function starSection(e) {
    const { massSun, distAu } = e.star, p = passingStarPull(massSun, distAu), dl = h('dl');
    row(dl, 'ITS PULL VS THE SUN\'S ON EARTH', p.direct.toExponential(1), 'computed', `${massSun} M☉ at ${distAu.toLocaleString()} au, against 1 M☉ at 1 au.`);
    row(dl, 'TIDAL STRETCH ACROSS EARTH\'S ORBIT', p.tidal.toExponential(1), 'computed', 'The differential part, which is what could change a planet\'s orbit: negligible.');
    return [dl];
  }
  function riskSection() {
    if (!risk && !riskLoading) {
      riskLoading = true;
      fetch('/api/impact-risk').then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))).then((j) => { risk = j; }).catch((err) => { risk = { error: err.message }; })
        .finally(() => { riskLoading = false; if (selected === 'impact-risk') render(); });
      return [h('p', { className: 'note', textContent: 'LOADING NASA SENTRY AND ESA NEOCC…' })];
    }
    if (!risk || risk.error) return [h('p', { className: 'warn', textContent: 'Risk lists unavailable: start the local backend (npm start) and go online.' })];
    const list = (title, src, fmt) => (src?.rows ? [h('h3', { textContent: `${title} · ${src.count} OBJECTS` }),
      h('div', { className: 'host-list' }, src.rows.slice(0, 12).map((r) => h('div', { className: 'host-row', title: fmt.title(r) }, h('span', { textContent: fmt.name(r) }), h('span', { className: 'mono', textContent: fmt.line(r) })))),
      h('p', { className: 'note', textContent: `${src.fetched ? `FETCHED ${src.fetched.slice(0, 16).replace('T', ' ')} UTC` : ''}${src.updated ? ` · LIST UPDATED ${src.updated}` : ''}. Sorted by cumulative Palermo scale (0 = as risky as the background; −2 = 1% of it).` })]
      : [h('p', { className: 'warn', textContent: `${title}: ${src?.error ?? 'unavailable'}` })]);
    const torino = Math.max(0, ...[...(risk.sentry?.rows ?? []), ...(risk.neocc?.rows ?? [])].map((r) => r.ts ?? 0));
    const tdl = h('dl');
    row(tdl, 'HIGHEST TORINO RATING NOW', String(torino), 'computed', 'Torino scale 0–10 across both lists; 0 = no hazard, 1 = normal (no unusual danger), 2–4 = meriting attention by astronomers, 5+ = threatening.');
    const size = (m) => (m == null ? '?' : m >= 1000 ? `${(m / 1000).toFixed(1)} KM` : `${Math.round(m)} M`);
    return [tdl,
      ...list('NASA SENTRY', risk.sentry, { name: (r) => r.name.toUpperCase(), line: (r) => `${r.years} · P ${r.ip?.toExponential(1)} · PS ${r.psCum} · ${size(r.diameterM)}`, title: (r) => `${r.nImp} potential impacts ${r.years}; cumulative probability ${r.ip}; Palermo ${r.psCum} (max ${r.psMax}); Torino ${r.ts ?? 0}; ~${size(r.diameterM)}; v∞ ${r.vInfKms?.toFixed(1)} km/s; last observed ${r.lastObs}` }),
      ...list('ESA NEOCC', risk.neocc, { name: (r) => `${r.des}${r.name ? ` ${r.name}` : ''}`.toUpperCase(), line: (r) => `${r.date.slice(0, 10)} · P ${r.ipCum?.toExponential(1)} · PS ${r.psCum} · ${size(r.diameterM)}`, title: (r) => `Most likely impact ${r.date} UTC (probability ${r.ipMax}); impacts possible ${r.years}; cumulative ${r.ipCum}; Palermo ${r.psCum}; Torino ${r.ts}; ${size(r.diameterM)}; ${r.vKms} km/s` }),
    ];
  }

  function card(e) {
    const open = selected === e.id;
    const head = h('button', { className: `host-row event-row${open ? ' future-open' : ''}`, onclick: () => { selected = open ? null : e.id; render(); } },
      h('span', { textContent: e.title }), h('span', { className: 'mono', textContent: e.when }));
    if (!open) return [head];
    const extra = e.sn ? snSection(e) : e.poles ? poleSection() : e.sunTrack ? sunSection() : e.star ? starSection(e) : e.risk ? riskSection() : [];
    const facts = h('dl');
    for (const [label, value, tier, detail] of e.facts) row(facts, label, value, tier, detail);
    const canGo = e.iso || e.go || e.years != null;
    return [head, h('div', { className: 'future-card' },
      h('div', { className: 'legend' }, badge(e.tier, e.impossible ? 'Computed from measured masses: this cannot happen.' : ''), e.impossible ? h('span', { className: 'warn', textContent: 'NOT POSSIBLE' }) : null),
      h('p', { className: 'note explain', textContent: e.summary }),
      e.facts.length ? facts : null, ...extra,
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
  return { render };
}
