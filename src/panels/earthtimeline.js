// EARTH TIMELINE (#54): Earth's past and future in the right panel. Milankovitch cycles and
// 65° N summer insolation from Laskar (2004), loaded on demand; the Keeling curve from NOAA (via the
// backend); Earth's slowing spin and the leap-minute/leap-hour scenarios; impact energies, craters
// and recurrence from the Earth Impact Effects Program; and the catalogue of epochs, each with its
// range and sources. GO TO sets the ship's clock there (deep time where the clock supports it).

import { TIMELINE, TIMELINE_GROUPS } from '../data/earth-timeline.js';
import { orbitAt, insolation, S0_MARS, summer65N, precessionIndex, perihelionLongitude, perihelionSeason, nextPerihelionAtJuneSolstice } from '../astro/milankovitch.js';
import { leapScenarios, dayLength, impactEnergyMt, craterKm, recurrenceYears, LEAP_SECONDS_END } from '../astro/earthtime.js';
import { deltaT } from '../astro/eclipses.js';
import { jdFromDate } from '../astro/time.js';

const SVGNS = 'http://www.w3.org/2000/svg';
const svg = (tag, attrs = {}, ...kids) => { const el = document.createElementNS(SVGNS, tag); for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v); el.append(...kids); return el; };
const DEG = 180 / Math.PI;
const CALENDAR_YEARS = 273000;
const SUP = (n) => String(n).replace(/[0-9-]/g, (c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'['0123456789'.indexOf(c)] ?? '⁻');
const fmtYears = (y) => { const a = Math.abs(y); const s = a >= 1e12 ? `~${(a / 10 ** Math.floor(Math.log10(a))).toFixed(0)} × 10${SUP(Math.floor(Math.log10(a)))} YR` : a >= 1e9 ? `${+(a / 1e9).toFixed(2)} GYR` : a >= 1e6 ? `${+(a / 1e6).toFixed(2)} MYR` : a >= 1e4 ? `${Math.round(a / 1e3)} KYR` : `${Math.round(a).toLocaleString()} YR`; return y < 0 ? `${s} AGO` : `${s} AHEAD`; };
const fmtMt = (mt) => (mt >= 1e6 ? `${(mt / 1e6).toFixed(1)} MILLION MT` : mt >= 1e3 ? `${Math.round(mt).toLocaleString()} MT` : `${mt.toFixed(mt < 10 ? 1 : 0)} MT`);
const fmtRecur = (y) => (y >= 1e6 ? `~EVERY ${+(y / 1e6).toFixed(y >= 1e7 ? 0 : 1)} MYR` : y >= 1e3 ? `~EVERY ${Math.round(y / 1e3)} KYR` : `~EVERY ${Math.round(y)} YR`);

/** A single-series line chart: one y axis, a marker at `mark` (the ship's clock) and `today`. */
function lineChart({ xs, ys, xMin, xMax, yMin, yMax, yTicks, xTicks, label, mark, today = 0, unit = '', band = null, invert = false }) {
  const W = 360, H = 104, L = 40, R = 16, T = 14, B = 18;
  const x = (v) => L + ((v - xMin) / (xMax - xMin)) * (W - L - R), y = (v) => { const f = (Math.min(yMax, Math.max(yMin, v)) - yMin) / (yMax - yMin); return T + (invert ? f : 1 - f) * (H - T - B); };
  let d = '';
  for (let i = 0; i < xs.length; i++) if (xs[i] >= xMin && xs[i] <= xMax) d += `${d ? 'L' : 'M'}${x(xs[i]).toFixed(1)},${y(ys[i]).toFixed(1)}`;
  const kids = [
    svg('text', { x: L, y: 10, class: 'fc-label fc-title' }, label),
    svg('line', { x1: L, x2: L, y1: T, y2: H - B, class: 'fc-axis' }), svg('line', { x1: L, x2: W - R, y1: H - B, y2: H - B, class: 'fc-axis' }),
    ...yTicks.map((v) => svg('text', { x: L - 4, y: y(v) + 3, 'text-anchor': 'end', class: 'fc-label' }, `${v}${unit}`)),
    ...xTicks.map(([v, t]) => svg('text', { x: x(v), y: H - 5, 'text-anchor': 'middle', class: 'fc-label' }, t)),
  ];
  if (today >= xMin && today <= xMax) kids.push(svg('line', { x1: x(today), x2: x(today), y1: T, y2: H - B, class: 'fc-ref' }));
  if (band) {
    const idx = xs.map((v, i) => i).filter((i) => xs[i] >= xMin && xs[i] <= xMax);
    const pts = [...idx.map((i) => `${x(xs[i]).toFixed(1)},${y(band[0][i]).toFixed(1)}`), ...idx.reverse().map((i) => `${x(xs[i]).toFixed(1)},${y(band[1][i]).toFixed(1)}`)];
    if (pts.length) kids.push(svg('path', { d: `M${pts.join('L')}Z`, class: 'fc-band' }));
  }
  kids.push(svg('path', { d, class: 'fc-line' }));
  if (mark != null && mark >= xMin && mark <= xMax) kids.push(svg('line', { x1: x(mark), x2: x(mark), y1: T, y2: H - B, class: 'fc-mark' }));
  return svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'future-chart', role: 'img', 'aria-label': label }, ...kids);
}

export function createEarthTimelinePanel({ h, pill, row, badge, go, clock, toast, panel, system }) {
  let la = null, laLoading = false, co2 = null, co2Loading = false, selected = null, span = 'recent';

  const shipKyr = () => (typeof clock.years === 'number' ? clock.years : (clock.jd - jdFromDate(new Date())) / 365.25) / 1000;
  // The System View keeps the planets inside its ephemeris span (the clock's limit there), so a time
  // outside it is shown on Earth's globe instead, while the planets stay at the ship's clock.
  const RECORD_YEARS = 798000, PLATES_MA = 250;
  function goTo(e) {
    const y = e.years;
    if (y == null) { go(e.go ?? { level: 'system', system: 'sol', body: 'earth' }); return; }
    const target = e.go ?? { level: 'system', system: 'sol', body: 'earth' };
    const lim = clock.limit, jdAt = jdFromDate(new Date()) + y * 365.25;
    const systemish = !['navigation', 'galaxy', 'quadrant', 'universe'].includes(target.level);
    if (!systemish || !lim || (jdAt >= lim.minJd && jdAt <= lim.maxJd)) {
      go(target); // the destination's time limit first, then the time inside it
      setTimeout(() => { if (typeof clock.setYears === 'function') clock.setYears(y); else clock.set(jdAt); }, 0);
      return;
    }
    // beyond the planets' ephemeris: Earth's globe at that epoch, where there is a record or reconstruction
    if (y < 0 && -y <= RECORD_YEARS) { system?.setEarthEpoch({ years: y }); go({ level: 'system', system: 'sol', body: 'earth' }); toast(`THE GLOBE SHOWS EARTH ${fmtYears(y)}; THE PLANETS STAY AT THE SHIP'S CLOCK (${lim.reason})`); return; }
    if (y < 0 && -y / 1e6 <= PLATES_MA && -y >= 1e6) { system?.setEarthEpoch({ ma: Math.round(-y / 1e6) }); go({ level: 'system', system: 'sol', body: 'earth' }); toast(`THE GLOBE SHOWS THE CONTINENTS ${fmtYears(y)}; THE PLANETS STAY AT THE SHIP'S CLOCK`); return; }
    toast(`${fmtYears(y)} IS BEYOND THE SYSTEM VIEW'S RANGE (${lim.reason}) AND EARTH'S RECORDS`);
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
  let paleo = null, mars = null;
  const lazy = (which) => {
    if (which === 'paleo' && !paleo) { paleo = 'loading'; import('../data/paleo.js').then((m) => { paleo = m; render(); }); }
    if (which === 'mars' && !mars) { mars = 'loading'; import('../data/la2004-mars.js').then((m) => { mars = m.default; render(); }); }
  };
  const pastTicks = (ka) => (ka > 1000 ? [[-3000, '3 MA'], [-2000, '2 MA'], [-1000, '1 MA'], [0, 'NOW']] : [[-800, '800 KA'], [-600, '600'], [-400, '400'], [-200, '200'], [0, 'NOW']]);
  function paleoRecords() {
    lazy('paleo');
    if (!paleo || paleo === 'loading') return [h('p', { className: 'note', textContent: 'LOADING THE PALEOCLIMATE RECORDS…' })];
    const mark = shipKyr(), xsOf = (rows) => rows.map((r) => -r[0]);
    const { LR04, CO2, SEA_LEVEL } = paleo;
    return [
      h('div', { className: 'explain-figure' }, lineChart({ xs: xsOf(LR04), ys: LR04.map((r) => r[1]), xMin: -3000, xMax: 0, yMin: 2.5, yMax: 5.2, yTicks: [3, 4, 5], xTicks: pastTicks(3000), label: 'ICE VOLUME: BENTHIC δ¹⁸O (‰, MORE ICE DOWN)', mark, today: null, invert: true })),
      h('div', { className: 'explain-figure' }, lineChart({ xs: xsOf(CO2), ys: CO2.map((r) => r[1]), xMin: -810, xMax: 0, yMin: 160, yMax: 320, yTicks: [180, 240, 300], xTicks: pastTicks(800), label: 'CO₂ IN ANTARCTIC ICE (PPM)', mark, today: null })),
      h('div', { className: 'explain-figure' }, lineChart({ xs: xsOf(SEA_LEVEL), ys: SEA_LEVEL.map((r) => r[1]), band: [SEA_LEVEL.map((r) => r[2]), SEA_LEVEL.map((r) => r[3])], xMin: -800, xMax: 0, yMin: -150, yMax: 30, yTicks: [-120, -60, 0], xTicks: pastTicks(800), label: 'SEA LEVEL (M VS TODAY, 95% RANGE)', mark, today: null })),
      h('p', { className: 'note', textContent: 'MEASURED: LR04 stack of 57 benthic δ¹⁸O records (Lisiecki & Raymo 2005); Antarctic ice-core CO₂ composite (Bereiter et al. 2015), 1,000-year means; sea-level stack (Spratt & Lisiecki 2016). The present-day sea-level value carries the stack\'s ±10 m spread. Gold line: the ship\'s clock.' })];
  }
  function marsCycles() {
    lazy('mars');
    if (!mars || mars === 'loading') return [h('p', { className: 'note', textContent: 'LOADING LASKAR 2004 (MARS)…' })];
    const xs = [], ob = [], ec = [], qn = [];
    for (let k = -5000; k <= 1000; k += 2) { const o = orbitAt(mars, k); if (!o) continue; xs.push(k); ob.push(o.eps * DEG); ec.push(o.e); qn.push(insolation(o, 85, 90, S0_MARS)); }
    const mark = shipKyr(), o = orbitAt(mars, mark), dl = h('dl');
    if (o) {
      row(dl, 'MARS AT THE SHIP\'S CLOCK', `OBLIQUITY ${(o.eps * DEG).toFixed(1)}° · E ${o.e.toFixed(3)}`, 'computed', 'Laskar et al. 2004 (Icarus 170, 343)');
      row(dl, '85° N SUMMER-SOLSTICE INSOLATION', `${insolation(o, 85, 90, S0_MARS).toFixed(0)} W/M²`, 'computed', 'Daily mean at the northern summer solstice (Ls 90°), the forcing on the north polar cap.');
    }
    const ticks = [[-5000, '5 MA'], [-3000, '3 MA'], [-1000, '1 MA'], [0, 'NOW'], [1000, '+1']];
    return [dl,
      h('div', { className: 'explain-figure' }, lineChart({ xs, ys: ob, xMin: -5000, xMax: 1000, yMin: 10, yMax: 50, yTicks: [15, 25, 35, 45], xTicks: ticks, label: 'MARS OBLIQUITY (°)', mark })),
      h('div', { className: 'explain-figure' }, lineChart({ xs, ys: ec, xMin: -5000, xMax: 1000, yMin: 0, yMax: 0.13, yTicks: [0, 0.05, 0.1], xTicks: ticks, label: 'MARS ECCENTRICITY', mark })),
      h('div', { className: 'explain-figure' }, lineChart({ xs, ys: qn, xMin: -5000, xMax: 1000, yMin: 150, yMax: 650, yTicks: [200, 400, 600], xTicks: ticks, label: '85° N SUMMER INSOLATION (W/M²)', mark })),
      h('p', { className: 'note', textContent: 'COMPUTED from Laskar et al. (2004). About 4–5 million years ago Mars\' mean tilt dropped from ~35° to ~25°; over longer spans it is chaotic, so the record beyond ~10–20 Myr is a range, not a prediction.' })];
  }
  const WIDGETS = { paleo: paleoRecords, mars: marsCycles, milankovitch, perihelion, keeling, spin, impact: impactTable, comet };

  function card(e) {
    const open = selected === e.id;
    const head = h('button', { className: `host-row event-row${open ? ' future-open' : ''}`, onclick: () => { selected = open ? null : e.id; render(); } },
      h('span', { textContent: e.title }), h('span', { className: 'mono', textContent: e.when }));
    if (!open) return [head];
    const facts = h('dl');
    for (const [label, value, tier, detail] of e.facts) row(facts, label, value, tier, detail);
    const canGo = e.years != null || e.go;
    const globe = e.globe && system ? h('div', { className: 'body-list' }, ...e.globe.map((g) => pill(`ON THE GLOBE: ${g.label} ▸`, () => showGlobe(g))),
      pill('TODAY\'S EARTH', () => { system.setEarthEpoch(null); toast('TODAY\'S EARTH'); })) : null;
    return [head, h('div', { className: 'future-card' },
      h('div', { className: 'legend' }, badge(e.tier)),
      h('p', { className: 'note explain', textContent: e.summary }),
      e.facts.length ? facts : null,
      ...(e.widget ? WIDGETS[e.widget]() : []),
      h('p', { className: 'note' }, 'SOURCE: ', h('a', { href: e.url, target: '_blank', rel: 'noopener', textContent: e.source })),
      globe,
      canGo ? h('div', { className: 'body-list' }, pill(e.years ? `GO ${fmtYears(e.years)} ▸` : 'SHOW ▸', () => goTo(e))) : null)];
  }

  // ---- the log time slider: 66 Myr ago … now … 10¹⁰⁰ years ahead -----------------------------------
  const PAST_LOG = Math.log10(6.6e7), FUTURE_LOG = 100, SMAX = 1000;
  const sliderToYears = (v) => (v === 0 ? 0 : v < 0 ? -(10 ** ((-v / SMAX) * PAST_LOG)) : 10 ** ((v / SMAX) * FUTURE_LOG));
  const yearsToSlider = (y) => (Math.abs(y) < 1 ? 0 : y < 0 ? -Math.round((Math.log10(-y) / PAST_LOG) * SMAX) : Math.round((Math.log10(y) / FUTURE_LOG) * SMAX));
  // eras (Adams & Laughlin 1997 for the far future), [from, to] years from now
  const ERAS = [
    [-6.6e7, -2.58e6, 'CENOZOIC: AFTER THE DINOSAURS', 'Mammals spread; the continents near their present places; a warm world cooling.'],
    [-2.58e6, -11700, 'THE ICE AGES (PLEISTOCENE)', 'Ice sheets come and go with the orbital cycles.'],
    [-11700, -1, 'THE HOLOCENE', 'A warm interglacial: farming, cities, writing.'],
    [-1, 1e3, 'NOW: THE HUMAN AGE', 'CO₂ rising a few ppm a year; seas rising.'],
    [1e3, 1e6, 'A DELAYED ICE AGE', 'Orbital cycles continue; our CO₂ postpones the next glaciation past ~100,000 years.'],
    [1e6, 6e8, 'DRIFTING CONTINENTS', 'Plates move on; the next supercontinent in ~200–250 Myr.'],
    [6e8, 3e9, 'THE BIOSPHERE ENDS', 'CO₂ starvation, the oceans lost, the last microbes.'],
    [3e9, 8e9, 'THE SUN\'S LAST STAGES', 'Red giant, helium flash, planetary nebula, white dwarf.'],
    [8e9, 1e14, 'THE STELLIFEROUS ERA ENDS', 'The Local Group merges; red dwarfs burn on for trillions of years; star formation ends ~10¹⁴ years.'],
    [1e14, 1e40, 'THE DEGENERATE ERA', 'White dwarfs, neutron stars and brown dwarfs; galaxies evaporate; protons may decay.'],
    [1e40, 1e100, 'THE BLACK-HOLE ERA', 'Only black holes, slowly evaporating by Hawking radiation.'],
    [1e100, Infinity, 'THE DARK ERA', 'Photons, leptons and ever-thinner radiation; heat death in the standard model.'],
  ];
  const eraAt = (y) => ERAS.find(([a, b]) => y >= a && y < b) ?? ERAS[3];
  let scrub = 0;
  const near = (y) => TIMELINE.filter((e) => {
    const w = e.window ?? (e.years != null ? [e.years, e.years] : null);
    if (!w) return false;
    if (y >= Math.min(...w) && y <= Math.max(...w)) return true;
    const ly = Math.sign(y) * Math.log10(Math.abs(y) + 1), lw = w.map((v) => Math.sign(v) * Math.log10(Math.abs(v) + 1));
    return Math.min(...lw.map((v) => Math.abs(v - ly))) < 0.35;
  });
  const SW = 360, xOf = (v) => 6 + ((v + SMAX) / (2 * SMAX)) * (SW - 12);
  function strip() {
    return svg('svg', { viewBox: `0 0 ${SW} 46`, class: 'future-chart', role: 'img', 'aria-label': 'Epochs on a logarithmic time axis' },
      ...ERAS.map(([a, b], i) => { const x0 = xOf(yearsToSlider(Math.max(a, -6.6e7))), x1 = xOf(yearsToSlider(Math.min(b, 1e100))); return svg('rect', { x: x0, y: 4, width: Math.max(0, x1 - x0), height: 10, class: `era-band era-${i % 2}` }); }),
      ...TIMELINE.filter((e) => e.years != null || e.window).map((e) => { const x = xOf(yearsToSlider(e.years ?? e.window[0])); return svg('line', { x1: x, x2: x, y1: 16, y2: 26, class: 'fc-tick' }); }),
      ...[[-6.6e7, '66 MA'], [-1e4, '10 KA'], [0, 'NOW'], [1e20, '10²⁰'], [1e40, '10⁴⁰'], [1e70, '10⁷⁰'], [1e100, '10¹⁰⁰ YR']].map(([y, t]) => svg('text', { x: xOf(yearsToSlider(y)), y: 40, 'text-anchor': y === -6.6e7 ? 'start' : y === 1e100 ? 'end' : 'middle', class: 'fc-label' }, t)),
      svg('line', { x1: xOf(yearsToSlider(scrub)), x2: xOf(yearsToSlider(scrub)), y1: 2, y2: 30, class: 'fc-mark' }));
  }
  function sliderInfo() {
    const [, , name, what] = eraAt(scrub), here = near(scrub), dl = h('dl');
    row(dl, 'TIME', Math.abs(scrub) < 1 ? 'NOW' : fmtYears(scrub), 'computed', 'Logarithmic: each step multiplies the time.');
    row(dl, 'ERA', name, 'modelled', what);
    return [dl,
      here.length ? h('div', { className: 'host-list' }, here.slice(0, 6).map((e) => h('button', { className: 'host-row event-row', onclick: () => { selected = e.id; render(); } }, h('span', { textContent: e.title }), h('span', { className: 'mono', textContent: e.when })))) : h('p', { className: 'note', textContent: 'NOTHING CATALOGUED RIGHT HERE: SLIDE ON.' }),
      Math.abs(scrub) >= 1 && Math.abs(scrub) <= 2e9 ? h('div', { className: 'body-list' }, pill(`SET THE CLOCK ${fmtYears(scrub)} ▸`, () => goTo({ years: scrub, go: { level: 'system', system: 'sol', body: 'earth' } }))) : null];
  }
  function logSlider() {
    const figure = h('div', { className: 'explain-figure' }, strip()), info = h('div', { className: 'timeline-info' }, ...sliderInfo().filter(Boolean));
    const input = h('input', { type: 'range', className: 'tc-slider', min: String(-SMAX), max: String(SMAX), step: '1', value: String(yearsToSlider(scrub)), title: 'Time from now, logarithmic: 66 million years ago to 10¹⁰⁰ years ahead' });
    input.setAttribute('aria-label', 'Time from now (logarithmic)');
    input.addEventListener('input', () => { scrub = sliderToYears(Number(input.value)); figure.replaceChildren(strip()); info.replaceChildren(...sliderInfo().filter(Boolean)); });
    return [figure, input, info];
  }

  /** Show an epoch on Earth's globe: a time (through the clock), a sea level or a plate reconstruction. */
  function showGlobe(g) {
    system.setEarthEpoch(g.years != null ? { years: g.years } : g.ma ? { ma: g.ma } : g.messinian ? { messinian: true } : { sea: g.sea, label: g.label });
    system.focus('earth');
  }

  function render(id = selected) {
    selected = id;
    panel.replaceChildren(
      h('h2', { textContent: 'EARTH TIMELINE' }),
      h('div', { className: 'kind', textContent: 'FROM THE DINOSAURS\' LAST DAY TO THE END OF THE UNIVERSE' }),
      h('p', { className: 'note', textContent: 'The recorded past is MEASURED, orbital mechanics COMPUTED, projections and scenarios MODELLED with their ranges. "What if" scenarios are labelled. Click an epoch for details; GO sets the ship\'s clock.' }),
      h('h3', { textContent: 'TIME FROM NOW · LOGARITHMIC' }), h('div', { className: 'timeline-slider' }, ...logSlider()),
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
  /** Leaving for a view without Earth's globe: back to today's Earth. */
  const leave = () => system?.setEarthEpoch(null);
  return { render, tick, leave };
}
