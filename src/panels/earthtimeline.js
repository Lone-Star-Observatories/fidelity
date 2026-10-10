// EARTH TIMELINE (#54): Earth's past and future in the right panel. Milankovitch cycles and
// 65° N summer insolation from Laskar (2004), loaded on demand; the Keeling curve from NOAA (via the
// backend); Earth's slowing spin and the leap-minute/leap-hour scenarios; impact energies, craters
// and recurrence from the Earth Impact Effects Program; and the catalogue of epochs, each with its
// range and sources. GO TO sets the ship's clock there (deep time where the clock supports it).

import { TIMELINE, TIMELINE_GROUPS } from '../data/earth-timeline.js';
import { orbitAt, summer65N, precessionIndex, perihelionLongitude, perihelionSeason, nextPerihelionAtJuneSolstice } from '../astro/milankovitch.js';
import { leapScenarios, dayLength, impactEnergyMt, craterKm, recurrenceYears, LEAP_SECONDS_END } from '../astro/earthtime.js';
import { deltaT } from '../astro/eclipses.js';
import { jdFromDate } from '../astro/time.js';

const SVGNS = 'http://www.w3.org/2000/svg';
const svg = (tag, attrs = {}, ...kids) => { const el = document.createElementNS(SVGNS, tag); for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v); el.append(...kids); return el; };
const DEG = 180 / Math.PI;
const CALENDAR_YEARS = 273000;
const fmtYears = (y) => { const a = Math.abs(y); const s = a >= 1e9 ? `${+(a / 1e9).toFixed(2)} GYR` : a >= 1e6 ? `${+(a / 1e6).toFixed(2)} MYR` : a >= 1e4 ? `${Math.round(a / 1e3)} KYR` : `${Math.round(a).toLocaleString()} YR`; return y < 0 ? `${s} AGO` : `${s} AHEAD`; };
const fmtMt = (mt) => (mt >= 1e6 ? `${(mt / 1e6).toFixed(1)} MILLION MT` : mt >= 1e3 ? `${Math.round(mt).toLocaleString()} MT` : `${mt.toFixed(mt < 10 ? 1 : 0)} MT`);
const fmtRecur = (y) => (y >= 1e6 ? `~EVERY ${+(y / 1e6).toFixed(y >= 1e7 ? 0 : 1)} MYR` : y >= 1e3 ? `~EVERY ${Math.round(y / 1e3)} KYR` : `~EVERY ${Math.round(y)} YR`);

/** A single-series line chart: one y axis, a marker at `mark` (the ship's clock) and `today`. */
function lineChart({ xs, ys, xMin, xMax, yMin, yMax, yTicks, xTicks, label, mark, today = 0, unit = '' }) {
  const W = 360, H = 104, L = 40, R = 16, T = 14, B = 18;
  const x = (v) => L + ((v - xMin) / (xMax - xMin)) * (W - L - R), y = (v) => T + (1 - (v - yMin) / (yMax - yMin)) * (H - T - B);
  let d = '';
  for (let i = 0; i < xs.length; i++) if (xs[i] >= xMin && xs[i] <= xMax) d += `${d ? 'L' : 'M'}${x(xs[i]).toFixed(1)},${y(ys[i]).toFixed(1)}`;
  const kids = [
    svg('text', { x: L, y: 10, class: 'fc-label fc-title' }, label),
    svg('line', { x1: L, x2: L, y1: T, y2: H - B, class: 'fc-axis' }), svg('line', { x1: L, x2: W - R, y1: H - B, y2: H - B, class: 'fc-axis' }),
    ...yTicks.map((v) => svg('text', { x: L - 4, y: y(v) + 3, 'text-anchor': 'end', class: 'fc-label' }, `${v}${unit}`)),
    ...xTicks.map(([v, t]) => svg('text', { x: x(v), y: H - 5, 'text-anchor': 'middle', class: 'fc-label' }, t)),
  ];
  if (today >= xMin && today <= xMax) kids.push(svg('line', { x1: x(today), x2: x(today), y1: T, y2: H - B, class: 'fc-ref' }));
  kids.push(svg('path', { d, class: 'fc-line' }));
  if (mark != null && mark >= xMin && mark <= xMax) kids.push(svg('line', { x1: x(mark), x2: x(mark), y1: T, y2: H - B, class: 'fc-mark' }));
  return svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'future-chart', role: 'img', 'aria-label': label }, ...kids);
}

export function createEarthTimelinePanel({ h, pill, row, badge, go, clock, toast, panel }) {
  let la = null, laLoading = false, co2 = null, co2Loading = false, selected = null, span = 'recent';

  const shipKyr = () => (typeof clock.years === 'number' ? clock.years : (clock.jd - jdFromDate(new Date())) / 365.25) / 1000;
  function goTo(e) {
    if (e.years != null) {
      if (typeof clock.setYears === 'function') clock.setYears(e.years);
      else if (Math.abs(e.years) < CALENDAR_YEARS) clock.set(jdFromDate(new Date()) + e.years * 365.25);
      else { toast(`${fmtYears(e.years)} IS BEYOND THE CLOCK'S CALENDAR (±273 KYR)`); return; }
    }
    go(e.go ?? { level: 'system', system: 'sol', body: 'earth' });
  }
  const needLa = () => {
    if (la || laLoading) return;
    laLoading = true;
    import('../data/la2004.js').then((m) => { la = m.default; laLoading = false; render(); });
  };

  // ---- widgets ------------------------------------------------------------------------------
  function milankovitch() {
    if (!la) { needLa(); return [h('p', { className: 'note', textContent: 'LOADING LASKAR 2004…' })]; }
    const [xMin, xMax, step] = span === 'recent' ? [-800, 200, 1] : [-2700, 1000, 2];
    const xs = [], e = [], ob = [], pr = [], q = [];
    for (let k = xMin; k <= xMax; k += step) { const o = orbitAt(la, k); if (!o) continue; xs.push(k); e.push(o.e); ob.push(o.eps * DEG); pr.push(precessionIndex(o)); q.push(summer65N(o)); }
    const ticks = span === 'recent' ? [[-800, '800 KA'], [-400, '400 KA'], [0, 'NOW'], [200, '+200']] : [[-2580, '2.58 MA'], [-1000, '1 MA'], [0, 'NOW'], [1000, '+1 MYR']];
    const mark = shipKyr(), o = orbitAt(la, mark);
    const dl = h('dl');
    if (o) {
      row(dl, 'AT THE SHIP\'S CLOCK', Math.abs(mark) < 0.001 ? 'NOW' : fmtYears(mark * 1000), 'computed', 'The ship\'s clock, in thousands of years from J2000.');
      row(dl, 'ECCENTRICITY', o.e.toFixed(4), 'computed', 'Laskar et al. 2004');
      row(dl, 'OBLIQUITY', `${(o.eps * DEG).toFixed(2)}°`, 'computed', 'Laskar et al. 2004');
      row(dl, 'PERIHELION', perihelionSeason(o), 'computed', `Sun's longitude at perihelion ${perihelionLongitude(o).toFixed(0)}° (90° = June solstice).`);
      row(dl, '65° N JUNE INSOLATION', `${summer65N(o).toFixed(0)} W/M²`, 'computed', 'Daily mean at the June solstice (Berger 1978 formula, S₀ = 1361 W/m²).');
    } else row(dl, 'AT THE SHIP\'S CLOCK', 'OUTSIDE 2.7 MA – +1 MYR', 'computed', 'Laskar\'s table here covers the Quaternary and the next million years.');
    const sw = pill(span === 'recent' ? 'SHOW 2.7 MA – +1 MYR' : 'SHOW 800 KA – +200 KYR', () => { span = span === 'recent' ? 'long' : 'recent'; render(); });
    const chart = (ys, yMin, yMax, yTicks, label, unit) => lineChart({ xs, ys, xMin, xMax, yMin, yMax, yTicks, xTicks: ticks, label, mark, unit });
    return [dl,
      h('div', { className: 'explain-figure' }, chart(q, 420, 560, [440, 500, 560], '65° N JUNE INSOLATION (W/M²)', '')),
      h('div', { className: 'explain-figure' }, chart(e, 0, 0.06, [0, 0.03, 0.06], 'ECCENTRICITY', '')),
      h('div', { className: 'explain-figure' }, chart(ob, 22, 24.6, [22, 23, 24], 'OBLIQUITY (°)', '')),
      h('div', { className: 'explain-figure' }, chart(pr, -0.06, 0.06, [-0.05, 0, 0.05], 'PRECESSION INDEX e·sin ϖ', '')),
      h('div', { className: 'body-list' }, sw),
      h('p', { className: 'note', textContent: 'COMPUTED from Laskar et al. (2004). Gold line: the ship\'s clock; dashed: today. The insolation peaks 11,000 and 127,000 years ago ended ice ages; the low 115,000 years ago began the last one.' })];
  }
  function perihelion() {
    if (!la) { needLa(); return [h('p', { className: 'note', textContent: 'LOADING LASKAR 2004…' })]; }
    const k = nextPerihelionAtJuneSolstice(la, 0), last = nextPerihelionAtJuneSolstice(la, -25);
    const dl = h('dl');
    row(dl, 'PERIHELION TODAY', perihelionSeason(orbitAt(la, 0)), 'computed', 'Early January.');
    if (last != null && last < 0) row(dl, 'LAST AT THE JUNE SOLSTICE', fmtYears(last * 1000), 'computed', 'The Green Sahara peaked soon after.');
    if (k != null) row(dl, 'NEXT AT THE JUNE SOLSTICE', fmtYears(k * 1000), 'computed', 'Laskar et al. 2004; northern summers closest to the Sun ("mirrored seasons").');
    return [dl];
  }
  function keeling() {
    if (!co2 && !co2Loading) {
      co2Loading = true;
      fetch('/api/co2').then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))).then((j) => { co2 = j; }).catch((err) => { co2 = { error: err.message }; })
        .finally(() => { co2Loading = false; render(); });
    }
    if (!co2) return [h('p', { className: 'note', textContent: 'LOADING NOAA MAUNA LOA…' })];
    if (co2.error) return [h('p', { className: 'warn', textContent: 'Keeling curve unavailable: start the local backend (npm start) and go online.' })];
    const rows = co2.rows, last = rows.at(-1), xs = rows.map((r) => r[0]), ys = rows.map((r) => r[1]);
    const tenAgo = rows.find((r) => r[0] >= last[0] - 10 && r[2]) ?? rows[0];
    const rate = ((last[2] ?? last[1]) - (tenAgo[2] ?? tenAgo[1])) / (last[0] - tenAgo[0]);
    const dl = h('dl');
    row(dl, 'LATEST MONTH', `${last[1].toFixed(1)} PPM (${Math.floor(last[0])}-${String(Math.round((last[0] % 1) * 12 + 0.5)).padStart(2, '0')})`, 'measured', `${co2.source}, fetched ${co2.fetched.slice(0, 10)}.`);
    row(dl, 'RISE, LAST 10 YEARS', `${rate.toFixed(2)} PPM/YR`, 'computed', 'From the de-seasonalized series.');
    row(dl, 'VS THE END OF THE LAST ICE AGE', `~${Math.round(rate / 0.0114)}× FASTER`, 'computed', '~80 ppm over ~7,000 years, 18–11 ka.');
    const yr = new Date().getUTCFullYear();
    return [dl, h('div', { className: 'explain-figure' }, lineChart({ xs, ys, xMin: 1958, xMax: yr + 1, yMin: 300, yMax: 440, yTicks: [320, 360, 400, 440], xTicks: [[1960, '1960'], [1990, '1990'], [2020, '2020']], label: 'CO₂ AT MAUNA LOA (PPM)', today: null }))];
  }
  function spin() {
    const s = leapScenarios(), dl = h('dl');
    row(dl, 'ΔT (TT − UT1) AT THE SHIP\'S CLOCK', `${deltaT(clock.jd).toFixed(1)} S`, 'computed', 'IERS observed to 2026, Espenak & Meeus before, the long-term parabola beyond (the same ΔT as the eclipse predictions).');
    row(dl, 'LEAP MINUTE (UT1 − UTC = 60 S)', `~${Math.round(LEAP_SECONDS_END + s.minute[0])}–${Math.round(LEAP_SECONDS_END + s.minute[1])}`, 'computed', 'If leap seconds stop in 2035: excess day length 0–1 ms now, growing 1.7–2.3 ms per century.');
    row(dl, 'LEAP HOUR (3,600 S)', `~${Math.round((LEAP_SECONDS_END + s.hour[0]) / 100) * 100}–${Math.round((LEAP_SECONDS_END + s.hour[1]) / 100) * 100}`, 'computed', 'Same scenarios.');
    row(dl, 'DAY 70 MILLION YEARS AGO', `${dayLength(-7e7).toFixed(2)} H`, 'computed', 'At 2.3 ms per century; fossil rudist shells give ~23.5 h at 70 Ma (de Winter et al. 2020).');
    row(dl, 'DAY IN 250 MILLION YEARS', `~${dayLength(2.5e8).toFixed(1)} H`, 'modelled', 'If tidal braking continued at today\'s rate (it has varied with the shape of the oceans).');
    return [dl];
  }
  function impactTable() {
    const cases = [['CHELYABINSK-SIZE', 0.02, 19, 3300], ['TUNGUSKA-SIZE', 0.06, 20, 3000], ['1 KM ASTEROID', 1, 20, 3000], ['5 KM ASTEROID', 5, 20, 3000], ['10 KM (CHICXULUB-CLASS)', 10, 20, 3000]];
    const dl = h('dl');
    for (const [name, d, v, rho] of cases) {
      const E = impactEnergyMt(d, v, rho), D = craterKm(d, v, rho);
      row(dl, name, `${fmtMt(E)} TNT · ${d < 0.1 ? 'LIKELY AIRBURST (NO CRATER)' : `CRATER ~${D.toFixed(0)} KM`} · ${fmtRecur(recurrenceYears(E))}`, 'computed',
        `${d * 1000 >= 1000 ? `${d} km` : `${Math.round(d * 1000)} m`} at ${v} km/s, density ${rho} kg/m³, 45° into rock. Small bodies mostly explode in the air (Chelyabinsk 2013, Tunguska 1908), so their crater is notional.`);
    }
    return [dl, h('p', { className: 'note', textContent: 'For Chicxulub the scaling gives ~110 km for 10 km at 20 km/s; the real crater is ~180 km, which fits a larger or faster impactor (estimates 10–15 km, 20–25 km/s).' })];
  }
  function comet() {
    const dl = h('dl');
    for (const [name, d, v, rho] of [['10 KM COMET AT 55 KM/S', 10, 55, 600], ['10 KM ASTEROID AT 20 KM/S', 10, 20, 3000], ['30 KM COMET AT 55 KM/S', 30, 55, 600]]) {
      const E = impactEnergyMt(d, v, rho);
      row(dl, name, `${fmtMt(E)} TNT · CRATER ~${craterKm(d, v, rho).toFixed(0)} KM`, 'computed', `Density ${rho} kg/m³; a long-period comet falls in at up to ~70 km/s.`);
    }
    return [dl];
  }
  const WIDGETS = { milankovitch, perihelion, keeling, spin, impact: impactTable, comet };

  function card(e) {
    const open = selected === e.id;
    const head = h('button', { className: `host-row event-row${open ? ' future-open' : ''}`, onclick: () => { selected = open ? null : e.id; render(); } },
      h('span', { textContent: e.title }), h('span', { className: 'mono', textContent: e.when }));
    if (!open) return [head];
    const facts = h('dl');
    for (const [label, value, tier, detail] of e.facts) row(facts, label, value, tier, detail);
    const canGo = e.years != null || e.go;
    return [head, h('div', { className: 'future-card' },
      h('div', { className: 'legend' }, badge(e.tier)),
      h('p', { className: 'note explain', textContent: e.summary }),
      e.facts.length ? facts : null,
      ...(e.widget ? WIDGETS[e.widget]() : []),
      h('p', { className: 'note' }, 'SOURCE: ', h('a', { href: e.url, target: '_blank', rel: 'noopener', textContent: e.source })),
      canGo ? h('div', { className: 'body-list' }, pill(e.years ? `GO ${fmtYears(e.years)} ▸` : 'SHOW ▸', () => goTo(e))) : null)];
  }

  function render(id = selected) {
    selected = id;
    panel.replaceChildren(
      h('h2', { textContent: 'EARTH TIMELINE' }),
      h('div', { className: 'kind', textContent: 'FROM THE DINOSAURS\' LAST DAY TO THE END OF THE UNIVERSE' }),
      h('p', { className: 'note', textContent: 'The recorded past is MEASURED, orbital mechanics COMPUTED, projections and scenarios MODELLED with their ranges. "What if" scenarios are labelled. Click an epoch for details; GO sets the ship\'s clock.' }),
      ...TIMELINE_GROUPS.flatMap(([g, title]) => [h('h3', { textContent: title }), h('div', { className: 'host-list' }, TIMELINE.filter((e) => e.group === g).flatMap(card))]),
    );
  }
  /** Keep the "at the ship's clock" readout current while the Milankovitch card is open. */
  let lastKyr = null;
  function tick() {
    if (!la || !['milankovitch', 'quaternary', 'next-glaciation'].includes(selected)) return;
    const k = Math.round(shipKyr());
    if (k !== lastKyr) { lastKyr = k; render(); }
  }
  return { render, tick };
}
