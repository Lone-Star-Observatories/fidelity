// LAUNCH WINDOWS (#45): for a Solar System body, the next windows from Earth with flight time,
// C3, arrival v∞ and the Δv budget; a porkchop plot per window; the transfer arc in the System
// View; a Hohmann/synodic explainer; and, for Mars, a check against Perseverance's real path.
// Everything is COMPUTED from the app's ephemeris (Standish/SBDB elements) and Izzo's Lambert solver.

import { planetPos, launchWindows, porkchopByArrival, transfer, hohmann, synodicDays, periodDays, tofRange, injectionDv } from '../astro/transfer.js';
import { smallBodyPosition } from '../astro/smallbodies.js';
import { ELEMENTS } from '../astro/kepler.js';
import { porkchopSvg } from './porkchop.js';
import { trajectory } from '../data/spacecraft-ephem.js';

const iso = (jd) => new Date((jd - 2440587.5) * 86400000).toISOString().slice(0, 10);
const jdOf = (s) => Date.parse(s) / 86400000 + 2440587.5;
const days = (d) => (d >= 730 ? `${(d / 365.25).toFixed(1)} YR` : `${Math.round(d)} D`);

export const TRANSFER_EXPLAINER = 'The cheapest way between two circular orbits is a Hohmann transfer: half an ellipse that just touches both. Leaving at the right moment means the target arrives at the far end of that ellipse just as the craft does, so the planets must be in the right places: the angle between them repeats once every synodic period, which is why launch windows to Mars open every ~26 months, to Venus every ~19 and to Jupiter every ~13. Real orbits are elliptical and tilted, so mission designers solve Lambert\'s problem for every pair of departure and arrival dates and plot the energy needed: the porkchop plot. C3 is the launch energy (the square of the speed left over after escaping Earth); v∞ is the speed relative to the target on arrival.';

const SVGNS = 'http://www.w3.org/2000/svg';
const sv = (tag, attrs = {}, text) => { const e = document.createElementNS(SVGNS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); if (text != null) e.textContent = text; return e; };
/** Diagram: Earth's and the target's circular orbits and the Hohmann half-ellipse between them. */
export function hohmannDiagram(aAu, name) {
  const s = sv('svg', { viewBox: '-130 -118 260 236', role: 'img', 'aria-label': `Hohmann transfer from Earth to ${name}`, class: 'explain-svg' });
  const big = Math.max(1, aAu), k = 100 / big, r1 = k * 1, r2 = k * aAu;
  s.append(sv('circle', { cx: 0, cy: 0, r: 7, fill: '#ffcc66' }));
  for (const [r, c] of [[r1, '#99ccff'], [r2, '#ff9966']]) s.append(sv('circle', { cx: 0, cy: 0, r, fill: 'none', stroke: c, 'stroke-opacity': 0.6 }));
  const a = (r1 + r2) / 2, b = Math.sqrt(r1 * r2); // half of the transfer ellipse, Sun at a focus
  s.append(sv('path', { d: `M ${r1} 0 A ${a} ${b} 0 0 ${aAu > 1 ? 0 : 1} ${-r2} 0`, fill: 'none', stroke: '#ff9900', 'stroke-width': 2, 'stroke-dasharray': '5 4' }));
  s.append(sv('circle', { cx: r1, cy: 0, r: 4, fill: '#99ccff' }), sv('text', { x: r1, y: 16, 'text-anchor': 'middle', class: 'explain-label' }, 'EARTH AT LAUNCH'));
  s.append(sv('circle', { cx: -r2, cy: 0, r: 4, fill: '#ff9966' }), sv('text', { x: -r2 + 4, y: 16, 'text-anchor': 'start', class: 'explain-label' }, `${name.toUpperCase()} AT ARRIVAL`));
  s.append(sv('text', { x: -125, y: 112, class: 'explain-note' }, 'CIRCULAR, COPLANAR ORBITS · NOT TO SCALE IN TIME'));
  return s;
}

/**
 * The target for a body in the Sol model: planets by Standish elements, small bodies by their
 * SBDB elements, moons through their parent planet (the transfer ends at the parent's sphere of
 * influence; reaching the moon's orbit costs extra and is not included).
 */
export function targetFor(b, bodies) {
  if (ELEMENTS[b.id] && b.id !== 'earth') return { id: b.id, name: b.name, pos: planetPos(b.id), massKg: b.massKg, radiusKm: b.radiusKm, aAu: ELEMENTS[b.id][0][0], periodDays: periodDays(b.id) };
  if (b.orbit?.type === 'elements' && b.orbit.el) {
    const el = b.orbit.el;
    return { id: b.id, name: b.name, pos: (jd) => smallBodyPosition(el, jd), massKg: b.massKg, radiusKm: b.radiusKm, aAu: el.a, periodDays: 365.25636 * el.a ** 1.5, small: true };
  }
  if (b.kind === 'moon' && b.parent && ELEMENTS[b.parent]) {
    const p = bodies.find((x) => x.id === b.parent);
    return { ...targetFor(p, bodies), viaParent: p.name, name: b.name };
  }
  return null;
}

export function createTransferPanel({ h, pill, row, system, clock, toast, $, badge }) {
  const cache = new Map(); // body id → windows
  let shown = null; // { body, x }

  function show(x, t, compare = null) {
    shown = { body: t.id, x };
    system.setTransfer({ x, targetId: t.id, label: `TRANSFER TO ${t.name.toUpperCase()}`, compare });
    clock.set(x.depJd);
    system.overview(Math.max(2.4, (t.aAu ?? 1.5) * 2.6), 'sun');
    toast(`DEPARTURE ${iso(x.depJd)} · ARRIVAL ${iso(x.arrJd)} · RUN THE CLOCK TO FLY IT`);
  }

  function budget(x, t) {
    const dl = h('dl');
    row(dl, 'DEPART', `${iso(x.depJd)} · FROM 200 KM LOW EARTH ORBIT`, 'computed', 'Lambert solution (Izzo 2015) on the app\'s ephemeris; window dates good to a few days.');
    row(dl, 'ARRIVE', `${iso(x.arrJd)} · ${days(x.tofDays)} IN FLIGHT`, 'computed', 'Time of flight of the transfer orbit.');
    row(dl, 'C3', `${x.c3.toFixed(1)} KM²/S²`, 'computed', 'Launch energy: the square of the hyperbolic excess speed leaving Earth.');
    row(dl, 'ΔV DEPART', `${x.dvDepart.toFixed(2)} KM/S`, 'computed', 'From a 200 km circular parking orbit onto the departure hyperbola.');
    row(dl, 'V∞ ARRIVAL', `${x.vinfArr.toFixed(2)} KM/S`, 'computed', `Speed relative to ${t.viaParent ?? t.name} on arrival (a flyby needs no more).`);
    row(dl, 'ΔV ARRIVE', `${x.dvArrive.toFixed(2)} KM/S`, 'computed', `${x.arriveKind}${t.viaParent ? ` at ${t.viaParent}; reaching ${t.name}'s orbit costs extra, not included` : ''}.`);
    row(dl, 'ΔV TOTAL', `${x.dvTotal.toFixed(2)} KM/S`, 'computed', 'Departure plus arrival, impulsive burns; no gravity assists or margins.');
    return dl;
  }

  function openPorkchop(w, t) {
    const v = $('feed-viewer');
    const span = Math.max(60, Math.min(260, (w.closes - w.opens) * 2.2));
    const tr = tofRange(t.aAu ?? 1.5);
    const grid = porkchopByArrival(t, w.best.depJd - span / 2, w.best.depJd + span / 2, w.best.depJd + tr[0], w.best.depJd + span / 2 + tr[1], { n: 44 });
    v.hidden = false;
    v.replaceChildren(
      h('div', { className: 'fv-head' }, h('span', { className: 'fv-title', textContent: `PORKCHOP · EARTH → ${t.name.toUpperCase()}` }), h('span', { className: 'fv-sub', textContent: `WINDOW ${iso(w.opens)} – ${iso(w.closes)}` }),
        badge('computed', 'Every cell is a Lambert solution between Earth and the target on those dates (app ephemeris).'), pill('✕', () => { v.hidden = true; v.replaceChildren(); }, 'square')),
      h('div', { className: 'fv-body' }, porkchopSvg(grid, { target: t.name.toUpperCase(), onPick: (x) => show(x, t) })),
      h('div', { className: 'fv-credit', textContent: 'Shaded by C3 (darker = cheaper), contours every few km²/s², the optimum ringed. Hover for the budget; click a cell to fly that transfer.' }));
  }

  /** Body panel section for body `b` (Sol only), or [] when no transfer applies. */
  function section(b, bodies) {
    const t = targetFor(b, bodies);
    if (!t) return [];
    const box = h('div', { className: 'host-list' }, h('p', { className: 'note', textContent: 'SEARCHING THE NEXT WINDOWS…' }));
    const sel = h('div');
    const pick = (w) => {
      show(w.best, t);
      sel.replaceChildren(budget(w.best, t), h('div', { className: 'body-list' },
        pill('PORKCHOP ▸', () => openPorkchop(w, t)),
        pill('CLEAR', () => { system.setTransfer(null); sel.replaceChildren(); })));
    };
    const windowRow = (w) => h('button', { className: 'host-row event-row', title: 'Click to draw this transfer and set the clock to its departure.', onclick: () => pick(w) },
      h('span', { textContent: `${iso(w.opens)} – ${iso(w.closes)}` }),
      h('span', { className: 'mono', textContent: `BEST ${iso(w.best.depJd)} · ${days(w.best.tofDays)} · C3 ${w.best.c3.toFixed(1)} · ΔV ${w.best.dvTotal.toFixed(1)} KM/S` }));
    const fill = (ws) => box.replaceChildren(...(ws.length ? ws.map(windowRow) : [h('p', { className: 'note', textContent: 'NO DIRECT WINDOW FOUND IN THE NEXT DECADE.' })]));
    const key = b.id;
    if (cache.has(key)) fill(cache.get(key));
    else setTimeout(() => {
      const years = t.aAu > 6 ? 14 : t.aAu > 3 ? 10 : 7;
      let ws = [];
      try { ws = launchWindows(t, Math.floor(clock.jd), { aAu: t.aAu, years, stepDays: t.aAu > 3 ? 8 : 4, count: 5, minGapDays: Math.max(120, 0.6 * synodicDays(365.25636, t.periodDays)) }); } catch (err) { console.warn('windows', err); }
      cache.set(key, ws);
      if (box.isConnected) fill(ws);
    }, 30);
    const hm = hohmann(1, Math.max(0.3, t.aAu)), syn = synodicDays(365.25636, t.periodDays);
    const facts = h('dl');
    row(facts, 'HOHMANN', `${days(hm.tofDays)} · ΔV ${injectionDv(hm.dv1).toFixed(2)} KM/S FROM LEO`, 'computed', 'Idealised circular, coplanar orbits at the mean distance: the textbook minimum.');
    row(facts, 'WINDOWS RECUR', `EVERY ${days(syn)}`, 'computed', 'The synodic period: how often Earth and the target return to the same relative positions.');
    const extra = [];
    if (b.id === 'mars') extra.push(h('div', { className: 'body-list' }, pill('CHECK: PERSEVERANCE 2020 ▸', () => checkPerseverance(t, sel))));
    return [h('h3', { textContent: `LAUNCH WINDOWS · EARTH → ${t.name.toUpperCase()}${t.viaParent ? ` (VIA ${t.viaParent.toUpperCase()})` : ''}` }), facts, box, sel, ...extra,
      h('h3', { textContent: 'WHY WINDOWS REPEAT' }), h('div', { className: 'explain-figure' }, hohmannDiagram(Math.max(0.3, Math.min(t.aAu, 40)), t.viaParent ?? t.name)), h('p', { className: 'note explain', textContent: TRANSFER_EXPLAINER })];
  }

  /** Real-mission check: the computed transfer for Perseverance's dates against its Horizons track. */
  async function checkPerseverance(t, sel) {
    const x = transfer(t, jdOf('2020-07-30T11:50:00Z'), 203.1);
    show(x, t);
    sel.replaceChildren(budget(x, t), h('p', { className: 'note', textContent: 'Loading Perseverance\'s cruise from JPL Horizons…' }));
    let tries = 0;
    const poll = () => {
      const pts = trajectory('-168', '2020-07-31', '2021-02-17');
      if (!pts && tries++ < 40) return setTimeout(poll, 500);
      if (!pts) { sel.lastChild.textContent = 'Horizons track unavailable (needs the local backend).'; return; }
      system.setTransfer({ x, targetId: t.id, label: 'COMPUTED · MARS 2020 DATES', compare: pts });
      let worst = 0;
      for (const [jd, ...p] of pts) { // Horizons rows: [jd (TDB), x, y, z] AU; compared at the same instant
        const q = system.transferPositionAt?.(jd - 69.184 / 86400);
        if (q) worst = Math.max(worst, Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]));
      }
      sel.lastChild.textContent = `Perseverance left on 2020-07-30 with C3 ≈ 14.5 km²/s² (computed here: ${x.c3.toFixed(2)}). Its Horizons cruise (white) and the computed Lambert arc (orange) differ by at most ${(worst * 149.6).toFixed(2)} million km over the cruise (the real craft also made trajectory-correction burns the ideal arc leaves out).`;
    };
    poll();
  }

  return { section, get shown() { return shown; } };
}
