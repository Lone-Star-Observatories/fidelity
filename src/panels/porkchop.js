// Porkchop plot (#45): departure date (x) against arrival date (y), shaded by launch energy C3
// (one-hue sequential ramp: dark = cheap, near the surface; light = expensive), with labelled C3
// contours drawn to scale, the optimum ringed and labelled, and a per-cell hover readout.
// Cells above the clip (3 × the minimum) stay blank. Plain SVG, no dependencies.

const SVGNS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, text) => {
  const e = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text != null) e.textContent = text;
  return e;
};
// sequential blue ramp (dataviz reference palette, steps 700 → 100): cheap transfers recede into the dark surface
const RAMP = ['#0d366b', '#104281', '#184f95', '#1c5cab', '#256abf', '#2a78d6', '#3987e5', '#5598e7', '#6da7ec', '#86b6ef', '#9ec5f4', '#b7d3f6', '#cde2fb'];
const iso = (jd) => new Date((jd - 2440587.5) * 86400000).toISOString().slice(0, 10);

/** Marching squares: segments [[x1,y1,x2,y2]] (grid units) where field crosses `level`. */
export function contourSegments(f, level) {
  const out = [], ny = f.length, nx = f[0].length;
  const at = (a, b) => (level - a) / (b - a);
  for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const v = [f[j][i], f[j][i + 1], f[j + 1][i + 1], f[j + 1][i]];
    if (v.some((x) => x == null || !Number.isFinite(x))) continue;
    const e = [];
    if ((v[0] < level) !== (v[1] < level)) e.push([i + at(v[0], v[1]), j]);
    if ((v[1] < level) !== (v[2] < level)) e.push([i + 1, j + at(v[1], v[2])]);
    if ((v[3] < level) !== (v[2] < level)) e.push([i + at(v[3], v[2]), j + 1]);
    if ((v[0] < level) !== (v[3] < level)) e.push([i, j + at(v[0], v[3])]);
    if (e.length === 2) out.push([...e[0], ...e[1]]);
    else if (e.length === 4) out.push([...e[0], ...e[1]], [...e[2], ...e[3]]);
  }
  return out;
}

/**
 * grid = { deps: [jd], arrs: [jd], c3: [[row by arr][col by dep]] (null where impossible), cell(i, j) → transfer }.
 * onPick(transfer) is called when a cell is clicked.
 */
export function porkchopSvg(grid, { target = 'TARGET', onPick } = {}) {
  const W = 520, H = 400, L = 64, R = 14, T = 16, B = 46, pw = W - L - R, ph = H - T - B;
  const nx = grid.deps.length, ny = grid.arrs.length;
  let min = Infinity, best = null;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const v = grid.c3[j][i]; if (v != null && v < min) { min = v; best = [i, j]; } }
  const clip = Math.max(min * 3, min + 20);
  const s = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', class: 'porkchop', 'aria-label': `Porkchop plot to ${target}: departure against arrival date, shaded by C3; minimum ${min.toFixed(1)} km²/s²` });
  const cw = pw / nx, ch = ph / ny;
  const xOf = (i) => L + (i + 0.5) * cw, yOf = (j) => T + ph - (j + 0.5) * ch;
  const cells = el('g');
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const v = grid.c3[j][i];
    if (v == null || v > clip) continue;
    const k = Math.min(RAMP.length - 1, Math.floor(((v - min) / (clip - min)) * RAMP.length));
    cells.append(el('rect', { x: L + i * cw, y: T + ph - (j + 1) * ch, width: cw + 0.3, height: ch + 0.3, fill: RAMP[k], 'data-i': i, 'data-j': j }));
  }
  s.append(cells);
  // contours at round C3 levels
  const step = min < 20 ? 5 : min < 60 ? 10 : 20;
  const lines = el('g', { fill: 'none', stroke: 'var(--text, #ffcc99)', 'stroke-width': 1, 'stroke-opacity': 0.75 });
  for (let lv = Math.ceil(min / step) * step; lv <= clip; lv += step) {
    const segs = contourSegments(grid.c3, lv);
    for (const [x1, y1, x2, y2] of segs) lines.append(el('line', { x1: L + (x1 + 0.5) * cw, y1: T + ph - (y1 + 0.5) * ch, x2: L + (x2 + 0.5) * cw, y2: T + ph - (y2 + 0.5) * ch }));
    const mid = segs[Math.floor(segs.length / 2)];
    if (mid) s.append(el('text', { x: L + (mid[0] + 0.5) * cw, y: T + ph - (mid[1] + 0.5) * ch - 2, class: 'pc-contour' }, String(lv)));
  }
  s.append(lines);
  // axes: ticks at month starts
  const ax = el('g', { class: 'pc-axis' });
  ax.append(el('line', { x1: L, y1: T + ph, x2: L + pw, y2: T + ph }), el('line', { x1: L, y1: T, x2: L, y2: T + ph }));
  const ticks = (arr, n) => { const out = []; const k = Math.max(1, Math.round(arr.length / n)); for (let i = 0; i < arr.length; i += k) out.push(i); return out; };
  for (const i of ticks(grid.deps, 5)) { ax.append(el('line', { x1: xOf(i), y1: T + ph, x2: xOf(i), y2: T + ph + 4 })); ax.append(el('text', { x: xOf(i), y: T + ph + 16, 'text-anchor': 'middle' }, iso(grid.deps[i]))); }
  for (const j of ticks(grid.arrs, 6)) { ax.append(el('line', { x1: L - 4, y1: yOf(j), x2: L, y2: yOf(j) })); ax.append(el('text', { x: L - 6, y: yOf(j) + 3, 'text-anchor': 'end' }, iso(grid.arrs[j]))); }
  ax.append(el('text', { x: L + pw / 2, y: H - 6, 'text-anchor': 'middle' }, 'DEPARTURE FROM EARTH (UTC)'));
  ax.append(el('text', { x: 12, y: T + ph / 2, 'text-anchor': 'middle', transform: `rotate(-90 12 ${T + ph / 2})` }, `ARRIVAL AT ${target}`));
  s.append(ax);
  if (best) {
    s.append(el('circle', { cx: xOf(best[0]), cy: yOf(best[1]), r: 6, fill: 'none', stroke: '#ff9900', 'stroke-width': 2 }));
    s.append(el('text', { x: xOf(best[0]) + 9, y: yOf(best[1]) - 7, class: 'pc-best' }, `MIN C3 ${min.toFixed(1)}`));
  }
  // hover readout + click to pick
  const tip = el('text', { x: L + 6, y: T + 12, class: 'pc-tip' });
  const hl = el('rect', { width: cw, height: ch, fill: 'none', stroke: '#fff', 'stroke-width': 1, visibility: 'hidden' });
  s.append(hl, tip);
  const cellAt = (evt) => {
    const p = s.createSVGPoint(); p.x = evt.clientX; p.y = evt.clientY;
    const q = p.matrixTransform(s.getScreenCTM().inverse());
    const i = Math.floor((q.x - L) / cw), j = Math.floor((T + ph - q.y) / ch);
    return i >= 0 && i < nx && j >= 0 && j < ny ? [i, j] : null;
  };
  s.addEventListener('pointermove', (evt) => {
    const c = cellAt(evt), x = c && grid.cell(c[0], c[1]);
    if (!x) { hl.setAttribute('visibility', 'hidden'); tip.textContent = ''; return; }
    hl.setAttribute('x', L + c[0] * cw); hl.setAttribute('y', T + ph - (c[1] + 1) * ch); hl.setAttribute('visibility', 'visible');
    tip.textContent = `${iso(x.depJd)} → ${iso(x.arrJd)} · ${Math.round(x.tofDays)} D · C3 ${x.c3.toFixed(1)} · V∞ ${x.vinfArr.toFixed(2)} KM/S · ΔV ${x.dvTotal.toFixed(2)} KM/S`;
  });
  s.addEventListener('pointerleave', () => { hl.setAttribute('visibility', 'hidden'); tip.textContent = ''; });
  s.addEventListener('click', (evt) => { const c = cellAt(evt), x = c && grid.cell(c[0], c[1]); if (x) onPick?.(x); });
  // legend: the ramp with its range
  const lg = el('g', { class: 'pc-axis' });
  RAMP.forEach((c, k) => lg.append(el('rect', { x: L + pw - 130 + k * 10, y: T + 2, width: 10, height: 6, fill: c })));
  lg.append(el('text', { x: L + pw - 134, y: T + 8, 'text-anchor': 'end' }, `C3 ${min.toFixed(0)}`), el('text', { x: L + pw, y: T + 20, 'text-anchor': 'end' }, `${clip.toFixed(0)} KM²/S²`));
  s.append(lg);
  return s;
}
