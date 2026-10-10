// Small single-series line charts for live telemetry (solar wind, X-ray flux): one y-axis,
// recessive grid, a direct label on the latest value, and a hover crosshair with readout.

const NS = 'http://www.w3.org/2000/svg';
const svg = (tag, attrs = {}, text) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text != null) e.textContent = text;
  return e;
};

/**
 * points: [{ t: Date, v: number }]; opts: { unit, log, bands: [[value, label]], color, format }.
 * Returns an <svg> element.
 */
export function lineChart(points, { unit = '', log = false, bands = [], color = '#c97a00', format = (v) => v.toFixed(0), title = '' } = {}) {
  const W = 560, H = 210, m = { l: 52, r: 66, t: 14, b: 26 };
  const pts = points.filter((p) => Number.isFinite(p.v) && (!log || p.v > 0));
  const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'tele-chart', role: 'img', 'aria-label': title });
  if (pts.length < 2) { root.append(svg('text', { x: W / 2, y: H / 2, 'text-anchor': 'middle', class: 'tc-muted' }, 'NO RECENT DATA')); return root; }
  const t0 = +pts[0].t, t1 = +pts.at(-1).t;
  const f = log ? Math.log10 : (v) => v;
  let lo = Math.min(...pts.map((p) => f(p.v))), hi = Math.max(...pts.map((p) => f(p.v)));
  for (const [b] of bands) { lo = Math.min(lo, f(b)); hi = Math.max(hi, f(b)); }
  if (log) { lo = Math.floor(lo); hi = Math.ceil(hi); } else { const pad = (hi - lo) * 0.1 || 1; lo -= pad; hi += pad; }
  const X = (t) => m.l + ((+t - t0) / (t1 - t0 || 1)) * (W - m.l - m.r);
  const Y = (v) => H - m.b - ((f(v) - lo) / (hi - lo || 1)) * (H - m.t - m.b);
  // grid + y ticks
  const ticks = log ? Array.from({ length: hi - lo + 1 }, (_, i) => 10 ** (lo + i)) : Array.from({ length: 5 }, (_, i) => (lo + ((hi - lo) * i) / 4));
  for (const v of ticks) {
    const y = Y(log ? v : v);
    root.append(svg('line', { x1: m.l, x2: W - m.r, y1: y, y2: y, class: 'tc-grid' }));
    root.append(svg('text', { x: m.l - 6, y: y + 4, 'text-anchor': 'end', class: 'tc-tick' }, log ? `1e${Math.round(Math.log10(v))}` : format(v)));
  }
  for (const [b, label] of bands) {
    const y = Y(b);
    root.append(svg('line', { x1: m.l, x2: W - m.r, y1: y, y2: y, class: 'tc-band' }));
    root.append(svg('text', { x: W - m.r + 6, y: y + 4, class: 'tc-tick' }, label));
  }
  // x labels: start and end times (UTC)
  const hm = (t) => new Date(t).toISOString().slice(11, 16);
  root.append(svg('text', { x: m.l, y: H - 6, class: 'tc-tick' }, `${hm(t0)} UTC`));
  root.append(svg('text', { x: W - m.r, y: H - 6, 'text-anchor': 'end', class: 'tc-tick' }, hm(t1)));
  root.append(svg('text', { x: m.l - 6, y: m.t - 2, 'text-anchor': 'end', class: 'tc-tick' }, unit));
  // series
  root.append(svg('path', { d: pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.t).toFixed(1)},${Y(p.v).toFixed(1)}`).join(''), fill: 'none', stroke: color, 'stroke-width': 2, 'stroke-linejoin': 'round' }));
  const last = pts.at(-1);
  root.append(svg('circle', { cx: X(last.t), cy: Y(last.v), r: 4, fill: color, stroke: '#000', 'stroke-width': 2 }));
  root.append(svg('text', { x: X(last.t) + 8, y: Y(last.v) + 4, class: 'tc-label' }, format(last.v)));
  // hover crosshair
  const cross = svg('line', { y1: m.t, y2: H - m.b, class: 'tc-cross', visibility: 'hidden' });
  const dot = svg('circle', { r: 4, fill: color, stroke: '#000', 'stroke-width': 2, visibility: 'hidden' });
  const read = svg('text', { y: m.t + 12, class: 'tc-read', visibility: 'hidden' });
  root.append(cross, dot, read);
  const hit = svg('rect', { x: m.l, y: m.t, width: W - m.l - m.r, height: H - m.t - m.b, fill: 'transparent' });
  hit.addEventListener('pointermove', (e) => {
    const r = root.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    const t = t0 + ((x - m.l) / (W - m.l - m.r)) * (t1 - t0);
    let best = pts[0];
    for (const p of pts) if (Math.abs(+p.t - t) < Math.abs(+best.t - t)) best = p;
    const px = X(best.t);
    for (const el of [cross, dot, read]) el.setAttribute('visibility', 'visible');
    cross.setAttribute('x1', px); cross.setAttribute('x2', px);
    dot.setAttribute('cx', px); dot.setAttribute('cy', Y(best.v));
    read.setAttribute('x', Math.min(px + 6, W - m.r - 120)); read.textContent = `${hm(best.t)} · ${format(best.v)} ${unit}`;
  });
  hit.addEventListener('pointerleave', () => { for (const el of [cross, dot, read]) el.setAttribute('visibility', 'hidden'); });
  root.append(hit);
  return root;
}
