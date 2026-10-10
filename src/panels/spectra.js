// Spectra for the detail views (#28 groundwork):
//   SOL BODIES   reflected sunlight + thermal glow, 0.3–30 µm, as seen from Earth this month:
//                MODELLED by NASA GSFC's Planetary Spectrum Generator with the body's own
//                atmosphere and surface template. Gas bands from the lab marked on top.
//   STARS        the star's own MEASURED Gaia DR3 BP/RP spectrum, 336–1020 nm.
//   EXOPLANETS   every MEASURED transmission, eclipse or direct-imaging spectrum in the NASA
//                Exoplanet Archive, with error bars.

import { badge } from '../data/provenance.js';
import { BANDS, SOL_ATMOSPHERES } from '../data/planets.js';

const STANDALONE = import.meta.env.MODE === 'standalone';
const SVGNS = 'http://www.w3.org/2000/svg';
const REFLECTED = '#7777ee', THERMAL = '#c97a00', TOTAL = '#ffcc99'; // validated pair on black; total is the neutral ink
const el = (tag, props = {}, ...kids) => {
  const e = Object.assign(document.createElement(tag), props);
  for (const k of kids.flat()) if (k != null) e.append(k);
  return e;
};
const svg = (tag, attrs = {}, text) => {
  const e = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text != null) e.textContent = text;
  return e;
};
const card = (title, tier, detail, ...body) => el('section', { className: 'sv-card' },
  el('div', { className: 'sv-card-head' }, el('h3', { textContent: title }), badge(tier, detail)), ...body);
const sig = (x, n = 3) => (x == null ? '—' : Math.abs(x) >= 1e4 || Math.abs(x) < 1e-3 ? x.toExponential(n - 1) : x.toPrecision(n));
const offline = (title, tier) => card(title, tier, 'Needs the local backend.',
  el('p', { className: 'note', textContent: 'Loaded through the local backend (npm start); not in the single-file preview.' }));

/** Wavelength (nm) → approximate visible colour, for the rainbow strip. */
function wavelengthRGB(nm) {
  let r = 0, g = 0, b = 0;
  if (nm < 440) { r = -(nm - 440) / 60; b = 1; } else if (nm < 490) { g = (nm - 440) / 50; b = 1; }
  else if (nm < 510) { g = 1; b = -(nm - 510) / 20; } else if (nm < 580) { r = (nm - 510) / 70; g = 1; }
  else if (nm < 645) { r = 1; g = -(nm - 645) / 65; } else { r = 1; }
  const f = nm < 420 ? 0.3 + 0.7 * (nm - 380) / 40 : nm > 700 ? 0.3 + 0.7 * (750 - nm) / 50 : 1;
  return `rgb(${[r, g, b].map((c) => Math.round(255 * Math.max(0, c * f) ** 0.8)).join(',')})`;
}

/**
 * A spectrum chart. series: [{ label, color, dash?, pts: [[x, y], …] }]; x in µm or nm.
 * Options: xLog, yLog, xLabel, yLabel, unit (x), markers: [{ x, label }], errors: [{ x, y, lo, hi }], visibleBand (in x units) for the rainbow.
 */
export function spectrumChart({ series, xLog = false, yLog = false, xLabel, yLabel, xUnit = 'µm', yUnit = '', markers = [], errors = null, rainbow = null, aria = 'Spectrum' }) {
  const W = 900, H = 340, m = { l: 64, r: 18, t: markers.length ? 40 : 16, b: 58 };
  const pw = W - m.l - m.r, ph = H - m.t - m.b;
  const xs = series.flatMap((s) => s.pts.map((p) => p[0])).concat(errors?.map((e) => e.x) ?? []);
  const ys = series.flatMap((s) => s.pts.map((p) => p[1])).concat(errors?.flatMap((e) => [e.lo, e.hi]) ?? []).filter((v) => Number.isFinite(v) && (!yLog || v > 0));
  const fx = xLog ? Math.log10 : (v) => v, fy = yLog ? Math.log10 : (v) => v;
  let [x0, x1] = [Math.min(...xs), Math.max(...xs)].map(fx);
  if (x1 - x0 < 1e-9) { x0 -= 0.5; x1 += 0.5; }
  let y0 = fy(Math.min(...ys)), y1 = fy(Math.max(...ys));
  if (yLog) { y0 = Math.max(y0, y1 - 7); y0 = Math.floor(y0); y1 = Math.ceil(y1); } else { const pad = (y1 - y0) * 0.08 || Math.abs(y1) * 0.1 || 1; y0 -= pad; y1 += pad; }
  const X = (v) => m.l + ((fx(v) - x0) / (x1 - x0)) * pw;
  const Y = (v) => m.t + ph - ((Math.max(fy(v), y0) - y0) / (y1 - y0)) * ph;
  const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'sv-chart', role: 'img', 'aria-label': aria });

  // grid
  const yTicks = yLog ? Array.from({ length: y1 - y0 + 1 }, (_, i) => 10 ** (y0 + i)) : niceTicks(y0, y1, 5);
  for (const v of yTicks) {
    s.append(svg('line', { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v), class: 'grid' }));
    s.append(svg('text', { x: m.l - 8, y: Y(v) + 4, class: 'tick', 'text-anchor': 'end' }, yLog ? `1e${Math.round(Math.log10(v))}` : sig(v, 3)));
  }
  const xTicks = xLog ? [0.3, 0.5, 1, 2, 3, 5, 10, 20, 30, 50, 100, 300, 500, 1000, 2000].filter((v) => fx(v) >= x0 - 1e-9 && fx(v) <= x1 + 1e-9) : niceTicks(x0, x1, 8);
  for (const v of xTicks) {
    s.append(svg('line', { x1: X(v), x2: X(v), y1: m.t, y2: m.t + ph, class: 'grid' }));
    s.append(svg('text', { x: X(v), y: H - m.b + 34, class: 'tick', 'text-anchor': 'middle' }, String(+v.toPrecision(3))));
  }
  s.append(svg('text', { x: m.l + pw / 2, y: H - 6, class: 'axis-label', 'text-anchor': 'middle' }, xLabel));
  s.append(svg('text', { x: 12, y: m.t + ph / 2, class: 'axis-label', 'text-anchor': 'middle', transform: `rotate(-90 12 ${m.t + ph / 2})` }, yLabel));
  // the eye's band
  if (rainbow) {
    const id = `rb-${Math.random().toString(36).slice(2, 8)}`;
    const grad = svg('linearGradient', { id, x1: '0', x2: '1' });
    for (let nm = 380; nm <= 750; nm += 10) grad.append(svg('stop', { offset: `${((nm - 380) / 370) * 100}%`, 'stop-color': wavelengthRGB(nm) }));
    const defs = svg('defs'); defs.append(grad); s.append(defs);
    const a = Math.max(X(rainbow[0]), m.l), b = Math.min(X(rainbow[1]), m.l + pw);
    if (b > a) s.append(svg('rect', { x: a, y: H - m.b + 8, width: b - a, height: 8, rx: 2, fill: `url(#${id})` }));
  }
  // markers (absorption bands, lines): neighbours closer than ~14 px merge into one label
  const merged = [];
  for (const mk of [...markers].filter((k) => fx(k.x) >= x0 && fx(k.x) <= x1).sort((p, q) => p.x - q.x)) {
    const last = merged.at(-1);
    if (last && X(mk.x) - X(last.x) < 14) { if (!last.labels.includes(mk.label)) last.labels.push(mk.label); }
    else merged.push({ x: mk.x, labels: [mk.label] });
  }
  let lastX = -1e9, row = 0;
  for (const mk of merged) {
    const x = X(mk.x), label = mk.labels.slice(0, 2).join('·') + (mk.labels.length > 2 ? '…' : '');
    row = x - lastX < 8 * label.length ? (row + 1) % 2 : 0;
    lastX = x;
    s.append(svg('line', { x1: x, x2: x, y1: m.t - 4, y2: m.t + ph, class: 'line-marker' }));
    const t = svg('text', { x, y: m.t - 22 + row * 12, class: 'line-label', 'text-anchor': 'middle' }, label);
    t.append(svg('title', {}, mk.labels.join(', ')));
    s.append(t);
  }
  // error bars + points
  if (errors) {
    for (const e of errors) {
      const g = svg('g', {});
      g.append(svg('line', { x1: X(e.x), x2: X(e.x), y1: Y(e.hi), y2: Y(e.lo), stroke: THERMAL, 'stroke-width': 1.5, opacity: 0.7 }));
      g.append(svg('circle', { cx: X(e.x), cy: Y(e.y), r: e.limit ? 0 : 4, fill: THERMAL, stroke: '#000', 'stroke-width': 2 }));
      if (e.limit) g.append(svg('path', { d: `M${X(e.x) - 5},${Y(e.y)}L${X(e.x) + 5},${Y(e.y)}M${X(e.x)},${Y(e.y)}L${X(e.x)},${Y(e.y) + 12 * (e.limit > 0 ? 1 : -1)}`, stroke: THERMAL, 'stroke-width': 2 }));
      g.append(svg('title', {}, `${sig(e.x, 4)} ${xUnit}: ${sig(e.y, 4)}${yUnit} (${sig(e.lo, 3)}–${sig(e.hi, 3)})`));
      s.append(g);
    }
  }
  for (const se of series) {
    const d = se.pts.filter(([, y]) => Number.isFinite(y) && (!yLog || y > 0)).map(([x, y], i) => `${i ? 'L' : 'M'}${X(x).toFixed(1)},${Y(y).toFixed(1)}`).join('');
    s.append(svg('path', { d, fill: 'none', stroke: se.color, 'stroke-width': 2, 'stroke-dasharray': se.dash ?? 'none', 'stroke-linejoin': 'round' }));
    if (se.band) {
      const up = se.band.map(([x, , hi]) => `${X(x).toFixed(1)},${Y(hi).toFixed(1)}`), lo = se.band.map(([x, lo]) => `${X(x).toFixed(1)},${Y(lo).toFixed(1)}`).reverse();
      s.append(svg('path', { d: `M${up.join('L')}L${lo.join('L')}Z`, fill: se.color, 'fill-opacity': 0.18, stroke: 'none' }));
    }
  }

  // hover: crosshair + readout of every series at that wavelength
  const wrap = el('div', { className: 'sv-chart-wrap' }, s);
  if (series.length) {
    const cross = svg('line', { y1: m.t, y2: m.t + ph, class: 'crosshair', visibility: 'hidden' });
    s.append(cross);
    const tip = el('div', { className: 'sv-tip', hidden: true });
    wrap.append(tip);
    const hit = svg('rect', { x: m.l, y: m.t, width: pw, height: ph, fill: 'transparent' });
    s.append(hit);
    hit.addEventListener('pointermove', (ev) => {
      const r = s.getBoundingClientRect();
      const px = ((ev.clientX - r.left) / r.width) * W;
      const xv = xLog ? 10 ** (x0 + ((px - m.l) / pw) * (x1 - x0)) : x0 + ((px - m.l) / pw) * (x1 - x0);
      cross.setAttribute('x1', px); cross.setAttribute('x2', px); cross.setAttribute('visibility', 'visible');
      const rows = series.map((se) => {
        let best = null;
        for (const p of se.pts) if (!best || Math.abs(p[0] - xv) < Math.abs(best[0] - xv)) best = p;
        return el('div', {}, el('span', { className: 'sw', style: `background:${se.color}` }), `${se.label}: `, el('b', { textContent: `${sig(best?.[1], 3)}${yUnit}` }));
      });
      tip.replaceChildren(el('div', { textContent: `${sig(xv, 3)} ${xUnit}` }), ...rows);
      tip.hidden = false;
      const left = ((ev.clientX - r.left) / r.width) * wrap.clientWidth;
      tip.style.left = `${Math.min(left + 14, wrap.clientWidth - 200)}px`;
      tip.style.top = '8px';
    });
    hit.addEventListener('pointerleave', () => { tip.hidden = true; cross.setAttribute('visibility', 'hidden'); });
  }
  const legend = series.length > 1 ? el('div', { className: 'sv-legend' }, series.map((se) =>
    el('span', {}, el('span', { className: `sw${se.dash ? ' dash' : ''}`, style: se.dash ? `border-color:${se.color}` : `background:${se.color}` }), se.label.toUpperCase()))) : null;
  return el('div', {}, legend, wrap);
}

function niceTicks(a, b, n) {
  const span = b - a, step0 = span / n, mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((k) => span / k <= n) ?? mag * 10;
  const out = [];
  for (let v = Math.ceil(a / step) * step; v <= b + 1e-12; v += step) out.push(+v.toPrecision(10));
  return out;
}

// ---- Sol bodies: PSG ---------------------------------------------------------------------------
export const PSG_BODIES = new Set(['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'moon', 'io', 'europa', 'ganymede', 'callisto',
  'titan', 'enceladus', 'triton', 'charon', 'rhea', 'dione', 'tethys', 'iapetus', 'mimas', 'titania', 'oberon', 'ariel', 'umbriel', 'miranda', 'phobos', 'deimos',
  'ceres', 'vesta', 'pallas', 'eris', 'makemake', 'haumea']);

export function bodySpectrumCard(b, jd) {
  const title = 'SPECTRUM · SUNLIGHT AND HEAT';
  const detail = 'NASA GSFC Planetary Spectrum Generator: radiative transfer through this body\'s template atmosphere and surface. A model, not an observation.';
  if (!PSG_BODIES.has(b.id)) return null;
  if (STANDALONE) return offline(title, 'modelled');
  const month = new Date((jd - 2440587.5) * 86400000).toISOString().slice(0, 7);
  const holder = el('div', {}, el('p', { className: 'note', textContent: 'ASKING THE PLANETARY SPECTRUM GENERATOR…' }));
  const node = card(title, 'modelled', detail, holder);
  fetch(`/api/psg?body=${b.id}&month=${month}`).then((r) => (r.ok ? r.json() : r.json().then((j) => Promise.reject(new Error(j.error))))).then((d) => {
    const pts = (arr) => (arr ? d.wavelengthUm.map((x, i) => [x, arr[i]]) : []);
    const series = [{ label: 'Total', color: TOTAL, pts: pts(d.total) }];
    if (d.reflected) series.push({ label: 'Reflected sunlight', color: REFLECTED, dash: '6 4', pts: pts(d.reflected) });
    if (d.thermal) series.push({ label: 'Thermal glow', color: THERMAL, dash: '2 3', pts: pts(d.thermal) });
    const gases = (SOL_ATMOSPHERES[b.id]?.gases ?? []).map(([label, key]) => [label, key]).filter(([, k]) => BANDS[k]);
    const markers = gases.flatMap(([label, key]) => BANDS[key].filter(([c]) => c >= 300).map(([c]) => ({ x: c / 1000, label })));
    // where reflected and thermal light cross (when PSG splits them)
    let cross = null;
    if (d.reflected && d.thermal) for (let i = 1; i < d.wavelengthUm.length; i++) if (d.thermal[i] > d.reflected[i] && d.thermal[i - 1] <= d.reflected[i - 1]) { cross = d.wavelengthUm[i]; break; }
    holder.replaceChildren(
      el('div', { className: 'sv-comp-title', textContent: cross ? `REFLECTS SUNLIGHT SHORTWARD OF ${cross.toFixed(1)} µM · GLOWS WITH ITS OWN HEAT BEYOND` : 'REFLECTED SUNLIGHT (LEFT HUMP) · ITS OWN HEAT (RIGHT HUMP)' }),
      spectrumChart({ series, xLog: true, yLog: true, xLabel: 'WAVELENGTH (µm, LOG)', yLabel: 'RADIANCE (W/sr/m²/µm)', markers, rainbow: [0.38, 0.75], aria: `Modelled spectrum of ${b.name}` }),
      el('p', { className: 'note', textContent: `${d.source}; ${d.geometry}, ${d.month}. Dips are where gases absorb (laboratory band positions marked above). The two humps are the Sun's light bounced back and the body's own infrared glow: the colder the world, the further right its glow peaks.` }));
  }).catch((err) => holder.replaceChildren(el('p', { className: 'note', textContent: `PLANETARY SPECTRUM GENERATOR UNAVAILABLE (${err.message}).` })));
  return node;
}

// ---- stars: Gaia DR3 XP -----------------------------------------------------------------------
const STAR_LINES = [[410.2, 'Hδ'], [434.0, 'Hγ'], [486.1, 'Hβ'], [517.3, 'Mg b'], [589.3, 'Na D'], [656.3, 'Hα'], [705, 'TiO'], [760.5, 'O₂ (air)'], [849.8, 'Ca II'], [866.2, 'Ca II']];

/** star: { name, ra, dec, distLy } */
export function starSpectrumCard(star) {
  const title = 'THIS STAR\'S OWN SPECTRUM · GAIA DR3';
  if (STANDALONE) return offline(title, 'measured');
  const holder = el('div', {}, el('p', { className: 'note', textContent: 'LOOKING UP THIS STAR IN GAIA DR3 (VIA SIMBAD)…' }));
  const node = card(title, 'measured', 'Low-resolution BP/RP spectrophotometry of this star by ESA\'s Gaia (DR3), absolutely calibrated.', holder);
  const q = new URLSearchParams({ ra: star.ra.toFixed(5), dec: star.dec.toFixed(5), ...(star.distLy ? { distLy: star.distLy.toFixed(2) } : {}) });
  fetch(`/api/star-spectrum?${q}`).then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status)))).then((d) => {
    if (!d.found) { holder.replaceChildren(el('p', { className: 'note', textContent: `${d.reason}${d.simbad ? ` (SIMBAD: ${d.simbad})` : ''} The template spectrum above stands in.` })); return; }
    const peak = Math.max(...d.flux);
    const pts = d.nm.map((x, i) => [x, d.flux[i] / peak]);
    const band = d.nm.map((x, i) => [x, (d.flux[i] - d.err[i]) / peak, (d.flux[i] + d.err[i]) / peak]);
    let iMax = 0; d.flux.forEach((f, i) => { if (f > d.flux[iMax]) iMax = i; });
    holder.replaceChildren(
      el('div', { className: 'sv-comp-title', textContent: `GAIA DR3 ${d.gaiaId} · BRIGHTEST AT ${d.nm[iMax]} NM · PEAK ${peak.toExponential(2)} W/M²/NM AT EARTH` }),
      spectrumChart({ series: [{ label: 'Gaia BP/RP flux', color: THERMAL, pts, band }], xLabel: 'WAVELENGTH (nm)', yLabel: 'FLUX (PEAK = 1)', xUnit: 'nm',
        markers: STAR_LINES.map(([x, label]) => ({ x, label })), rainbow: [380, 750], aria: `Gaia spectrum of ${star.name}` }),
      el('p', { className: 'note', textContent: `${d.source}. SIMBAD match: ${d.simbad}. The shaded band is the ±1σ uncertainty. At Gaia's resolution (R ≈ 30–100) single lines blur together; strong features (Hα, the Ca II triplet, TiO in cool stars) still dent the curve.` }));
  }).catch(() => holder.replaceChildren(el('p', { className: 'note', textContent: 'SIMBAD OR THE GAIA ARCHIVE DID NOT ANSWER (OFFLINE OR BUSY). REOPEN THIS VIEW TO TRY AGAIN.' })));
  return node;
}

// ---- exoplanets: NASA Exoplanet Archive ------------------------------------------------------------
export function exoSpectraCard(planetName) {
  const title = 'MEASURED SPECTRA · EXOPLANET ARCHIVE';
  if (STANDALONE) return offline(title, 'measured');
  const holder = el('div', {}, el('p', { className: 'note', textContent: 'SEARCHING THE ATMOSPHERIC SPECTROSCOPY TABLE…' }));
  const node = card(title, 'measured', 'Published transmission, eclipse and direct-imaging spectra (NASA Exoplanet Archive).', holder);
  fetch(`/api/exo-spectra?planet=${encodeURIComponent(planetName)}`).then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status)))).then((list) => {
    if (!list.spectra.length) {
      holder.replaceChildren(el('p', { className: 'note', textContent: 'No published spectrum of this planet yet. Spectra exist for about 300 planets, mostly hot giants that transit bright stars.' }));
      node.remove(); // keep the page short: the ATMOSPHERE card already says "not yet measured"
      return;
    }
    const pills = el('div', { className: 'im-pills' });
    const plot = el('div', {});
    const sorted = [...list.spectra].sort((a, b) => (b.points ?? 0) - (a.points ?? 0));
    const show = (s) => {
      pills.querySelectorAll('.pill').forEach((p) => p.classList.toggle('on', p.dataset.path === s.path));
      plot.replaceChildren(el('p', { className: 'note', textContent: 'LOADING SPECTRUM…' }));
      fetch(`/api/exo-spectrum?path=${encodeURIComponent(s.path)}`).then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status)))).then((d) => {
        const errors = d.points.map((p) => ({ x: p.um, y: p.value, lo: p.value + (p.errLo ?? 0), hi: p.value + (p.errHi ?? 0), limit: p.limit }));
        const what = { Transmission: 'Starlight filtered through the planet\'s atmosphere during transit: a deeper transit at a wavelength means the air is opaque there (a gas absorbs).',
          Eclipse: 'The planet\'s own light, measured as it disappears behind its star: deeper eclipses mean a brighter (hotter) planet at that wavelength.',
          'Direct Imaging': 'Light from the planet itself, separated from its star by a coronagraph.' }[d.kind] ?? '';
        plot.replaceChildren(
          el('div', { className: 'sv-comp-title', textContent: `${d.kind.toUpperCase()} · ${(d.facility ?? '').toUpperCase()} · ${d.points.length} POINTS` }),
          spectrumChart({ series: [], errors, xLabel: 'WAVELENGTH (µm)', yLabel: `${d.label} (${d.unit})`, yUnit: d.unit === '%' ? '%' : '', rainbow: [0.38, 0.75], aria: `${d.kind} spectrum of ${planetName}` }),
          el('p', { className: 'note', textContent: `${what} ${d.reference}${d.instrument ? `, ${d.instrument}` : ''}${d.note ? ` (${d.note})` : ''}.` }),
          el('a', { href: `https://ui.adsabs.harvard.edu/abs/${encodeURIComponent(s.bibcode)}/abstract`, target: '_blank', rel: 'noopener noreferrer', textContent: `PAPER: ${s.bibcode}` }));
      }).catch(() => plot.replaceChildren(el('p', { className: 'note', textContent: 'SPECTRUM FILE UNAVAILABLE.' })));
    };
    for (const s of sorted.slice(0, 16)) {
      const b = el('button', { type: 'button', className: 'pill', textContent: `${s.type.toUpperCase()} · ${(s.instrument ?? s.facility ?? '').slice(0, 34).toUpperCase()} · ${s.authors}` });
      b.title = `${s.facility}: ${s.instrument} (${s.points} points, ${s.minUm}–${s.maxUm} µm)`;
      b.dataset.path = s.path;
      b.addEventListener('click', () => show(s));
      pills.append(b);
    }
    holder.replaceChildren(el('p', { className: 'note', textContent: `${list.spectra.length} published spectr${list.spectra.length === 1 ? 'um' : 'a'}. ${list.source}.` }), pills, plot);
    show(sorted[0]);
  }).catch(() => holder.replaceChildren(el('p', { className: 'note', textContent: 'EXOPLANET ARCHIVE UNREACHABLE (OFFLINE?).' })));
  return node;
}

