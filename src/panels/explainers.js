// "What is this" explainers for points of interest (#19): plain-language text, and a diagram
// of the five Lagrange points of a two-body pair with the selected one highlighted.

const SVGNS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, text) => {
  const e = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text != null) e.textContent = text;
  return e;
};

export const LAGRANGE_EXPLAINER = 'Where the pull of two bodies and the motion of orbiting together balance, a small object can keep station with them. L1, L2 and L3 lie on the line through both and are unstable: craft parked there need small regular burns. L4 and L5 sit 60° ahead and behind, at the corners of equilateral triangles, and are stable when the larger body is at least 25 times heavier, so asteroids collect there (Jupiter\'s Trojans).';

/** SVG of L1–L5 around a primary/secondary pair (not to scale near the secondary), highlighting `L`. */
export function lagrangeDiagram(L, primary = 'SUN', secondary = 'EARTH') {
  const s = el('svg', { viewBox: '-130 -118 260 236', role: 'img', 'aria-label': `Lagrange points of the ${primary}–${secondary} pair, L${L} highlighted`, class: 'explain-svg' });
  const R = 90;
  s.append(el('circle', { cx: 0, cy: 0, r: R, fill: 'none', stroke: 'currentColor', 'stroke-opacity': 0.25, 'stroke-dasharray': '3 4' }));
  const sx = R, sy = 0;
  const pts = { 1: [R - 22, 0], 2: [R + 22, 0], 3: [-R, 0], 4: [R * Math.cos(Math.PI / 3), -R * Math.sin(Math.PI / 3)], 5: [R * Math.cos(Math.PI / 3), R * Math.sin(Math.PI / 3)] };
  for (const k of [4, 5]) s.append(el('polyline', { points: `0,0 ${pts[k][0]},${pts[k][1]} ${sx},${sy} 0,0`, fill: 'none', stroke: 'currentColor', 'stroke-opacity': 0.25 }));
  s.append(el('line', { x1: -R - 10, y1: 0, x2: R + 32, y2: 0, stroke: 'currentColor', 'stroke-opacity': 0.25 }));
  s.append(el('circle', { cx: 0, cy: 0, r: 10, fill: '#ffcc66' }), el('text', { x: 0, y: 26, 'text-anchor': 'middle', class: 'explain-label' }, primary));
  s.append(el('circle', { cx: sx, cy: sy, r: 5, fill: '#99ccff' }), el('text', { x: sx, y: sy - 12, 'text-anchor': 'middle', class: 'explain-label' }, secondary));
  for (const [k, [x, y]] of Object.entries(pts)) {
    const on = Number(k) === Number(L);
    s.append(el('circle', { cx: x, cy: y, r: on ? 6 : 3.5, fill: on ? '#ff9900' : 'none', stroke: '#ff9900', 'stroke-width': 1.5 }));
    s.append(el('text', { x: x + (k === '3' ? -4 : 0), y: y + (Number(k) === 5 ? 17 : -10), 'text-anchor': 'middle', class: `explain-label${on ? ' on' : ''}` }, `L${k}`));
  }
  s.append(el('text', { x: -125, y: 112, class: 'explain-note' }, 'ORBIT DIRECTION ↻ · L1/L2 DISTANCES EXAGGERATED'));
  return s;
}
