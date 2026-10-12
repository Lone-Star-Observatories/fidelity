// LAUNCH WINDOWS (#45): for a Solar System body, the next windows from Earth with flight time,
// C3, arrival v∞ and the Δv budget; a porkchop plot per window; the transfer arc in the System
// View; a Hohmann/synodic explainer; and, for Mars, a check against Perseverance's real path.
// Everything is COMPUTED from the app's ephemeris (Standish/SBDB elements) and Izzo's Lambert solver.

import { targetFor, planetPos, launchWindows, porkchopByArrival, transfer, hohmann, synodicDays, periodDays, tofRange, injectionDv, upcoming, windowsStale } from '../astro/transfer.js';
import { ELEMENTS } from '../astro/kepler.js';
import { porkchopSvg } from './porkchop.js';
import { trajectory } from '../data/spacecraft-ephem.js';
import { sequencesFor, routePath, FLYBY } from '../astro/flyby.js';
import FlybyWorker from '../astro/flyby.worker.js?worker&inline';

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
  s.append(sv('circle', { cx: -r2, cy: 0, r: 4, fill: '#ff9966' }), sv('text', { x: -r2 + 4, y: -10, 'text-anchor': 'start', class: 'explain-label' }, `${name.toUpperCase()} AT ARRIVAL`));
  s.append(sv('text', { x: -125, y: 112, class: 'explain-note' }, 'CIRCULAR, COPLANAR ORBITS · NOT TO SCALE IN TIME'));
  return s;
}

export { targetFor } from '../astro/transfer.js'; // moved there so it is testable without the DOM

export function createTransferPanel({ h, pill, row, system, clock, toast, $, badge }) {
  const cache = new Map(); // body id → { fromJd, ws }: the windows searched from that date
  let shown = null; // { body, x }
  let live = null; // the open launch-window section: { key, t, box, render }
  let lastSearch = 0, searching = false;

  /** Search the next windows for target `t` from the clock's date (a few tens of ms of Lambert solves). */
  function search(t) {
    const fromJd = Math.floor(clock.jd);
    const years = t.aAu > 6 ? 14 : t.aAu > 3 ? 10 : 7;
    let ws = [];
    try { ws = launchWindows(t, fromJd, { aAu: t.aAu, years, stepDays: t.aAu > 3 ? 8 : 4, count: 5, minGapDays: Math.max(120, 0.6 * synodicDays(365.25636, t.periodDays)) }); } catch (err) { console.warn('windows', err); }
    return { fromJd, ws };
  }
  /**
   * Re-run the search when the clock leaves what it covered: before its start, or past all but the
   * last window (so the list always shows the next ones). Throttled while the clock runs fast.
   */
  function refresh(first = false) {
    if (!live) return;
    if (!live.box.isConnected && !first) { live = null; return; }
    const e = cache.get(live.key);
    if (e && !windowsStale(e, clock.jd)) { live.render(); return; }
    const now = performance.now();
    if (searching || (!first && now - lastSearch < 1500)) return;
    lastSearch = now; searching = true;
    const l = live;
    if (e) l.box.replaceChildren(h('p', { className: 'note', textContent: `THE CLOCK MOVED · SEARCHING WINDOWS FROM ${iso(clock.jd)}…` }));
    setTimeout(() => {
      try { cache.set(l.key, search(l.t)); } finally { searching = false; }
      l.shownSig = null;
      if (l.box.isConnected) l.render();
    }, 30);
  }
  clock.onChange(() => refresh());

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

  // ---- gravity assists (#45): on demand, in a worker; compared with the best direct transfer ----
  const assistCache = new Map(); // body id → { fromJd, maxDays, rows: [{ via, routes }] }
  let worker = null, job = 0;
  const viaName = (via) => via.map((id) => FLYBY[id].name.toUpperCase()).join(' → ');
  function showRoute(r, t) {
    const marks = r.flybys.map((f) => ({ p: routePath({ legs: [r.legs.find((L) => Math.abs(L.fromJd - f.jd) < 1e-6)] }, 1)[0].slice(1), text: `${f.name.toUpperCase()} ${iso(f.jd)} · ${Math.round(f.altKm).toLocaleString('en-US')} KM` }));
    const track = routePath(r).map(([jd, ...p]) => [jd + 69.184 / 86400, ...p]); // tracks are TDB like Horizons rows
    system.setTransfer({ track, label: `VIA ${viaName(r.via)}`, depText: `DEPART EARTH ${iso(r.depJd)}`, arrText: `ARRIVE ${t.name.toUpperCase()} ${iso(r.arrJd)}`, marks });
    shown = { body: t.id, route: r };
    clock.set(r.depJd);
    system.overview(Math.max(2.4, Math.max(t.aAu ?? 1.5, ...r.via.map((id) => ELEMENTS[id][0][0])) * 2.6), 'sun');
    toast(`DEPART ${iso(r.depJd)} · ${r.flybys.map((f) => `${f.name.toUpperCase()} ${iso(f.jd)}`).join(' · ')} · ARRIVE ${iso(r.arrJd)} · RUN THE CLOCK TO FLY IT`);
  }
  function routeBudget(r, t, direct) {
    const dl = h('dl');
    row(dl, 'DEPART', `${iso(r.depJd)} · C3 ${r.c3.toFixed(1)} KM²/S² · ΔV ${r.dvDepart.toFixed(2)} KM/S FROM LEO`, 'computed', 'Lambert legs (Izzo 2015) on the app\'s ephemeris; patched conics.');
    for (const f of r.flybys) row(dl, `${f.name.toUpperCase()} FLYBY`, `${iso(f.jd)} · ${Math.round(f.altKm).toLocaleString('en-US')} KM UP · V∞ ${f.vinfIn.toFixed(2)} → ${f.vinfOut.toFixed(2)} KM/S · TURN ${f.turnDeg.toFixed(1)}°${f.dv > 0.005 ? ` · BURN ${f.dv.toFixed(2)} KM/S` : ' · UNPOWERED'}`, 'computed',
      f.ok ? 'The hyperbola joining the two legs: the periapsis that gives the turn, and a burn at periapsis for any change of speed (a powered flyby).' : `The legs need more turn than a pass at the lowest safe height gives (${f.maxTurnDeg.toFixed(1)}° max); the shortfall is charged as a burn.`);
    row(dl, 'ARRIVE', `${iso(r.arrJd)} · ${days(r.tofDays)} IN FLIGHT · V∞ ${r.vinfArr.toFixed(2)} KM/S`, 'computed', `${r.arriveKind}: ${r.dvArrive.toFixed(2)} km/s.`);
    row(dl, 'ΔV TOTAL', `${r.dvTotal.toFixed(2)} KM/S${direct ? ` · DIRECT ${direct.dvTotal.toFixed(2)} (${r.dvTotal < direct.dvTotal ? `SAVES ${(direct.dvTotal - r.dvTotal).toFixed(2)}` : `COSTS ${(r.dvTotal - direct.dvTotal).toFixed(2)} MORE`})` : ''}`, 'computed', 'Launch from LEO + flyby burns + arrival, impulsive; no deep-space manoeuvres, margins or navigation errors.');
    return dl;
  }
  function assistSection(t, key) {
    const seqs = sequencesFor(t.aAu ?? 1, t.id);
    if (!seqs.length || !t.spec) return null;
    const box = h('div', { className: 'host-list' }), sel = h('div');
    const directBest = () => { const ws = cache.get(key)?.ws ?? []; return ws.length ? ws.reduce((a, w) => (w.best.dvTotal < a.dvTotal ? w.best : a), ws[0].best) : null; };
    const fill = (e) => {
      const direct = directBest();
      box.replaceChildren(...e.rows.flatMap(({ via, routes }) => (routes.length ? routes.slice(0, 2).map((r) => h('button', { className: 'host-row event-row', title: 'Click to draw this route and set the clock to its departure.', onclick: () => { showRoute(r, t); sel.replaceChildren(routeBudget(r, t, direct), h('div', { className: 'body-list' }, pill('CLEAR', () => { system.setTransfer(null); sel.replaceChildren(); }))); } },
        h('span', { textContent: `VIA ${viaName(via)} · ${iso(r.depJd)} → ${iso(r.arrJd)}` }),
        h('span', { className: 'mono', textContent: `${days(r.tofDays)} · C3 ${r.c3.toFixed(1)} · ΔV ${r.dvTotal.toFixed(1)} KM/S${direct ? (r.dvTotal < direct.dvTotal ? ` · SAVES ${(direct.dvTotal - r.dvTotal).toFixed(1)}` : ` · +${(r.dvTotal - direct.dvTotal).toFixed(1)} VS DIRECT`) : ''}` })))
        : [h('p', { className: 'note', textContent: `VIA ${viaName(via)}: NO ROUTE WITHIN THE FLIGHT TIME IN THESE YEARS.` })])),
        h('p', { className: 'note', textContent: `SEARCHED FROM ${iso(e.fromJd)} · ARRIVING WITHIN ${days(e.maxDays)} (THE BEST DIRECT TRANSFER'S FLIGHT TIME) · ΔV INCLUDES ARRIVAL` }));
    };
    const run = () => {
      const direct = directBest();
      const maxDays = direct ? Math.max(direct.tofDays, 180) : (t.aAu > 6 ? 12 : 4) * 365.25;
      const years = t.aAu > 6 ? 14 : t.aAu > 3 ? 10 : 7, fromJd = Math.floor(clock.jd);
      const e = { fromJd, maxDays, rows: [] };
      worker ??= new FlybyWorker();
      const id = ++job;
      box.replaceChildren(h('p', { className: 'note', textContent: `SEARCHING ${seqs.map(viaName).join(' · ')}… (A FEW SECONDS EACH)` }));
      worker.onmessage = (m) => {
        if (m.data.id !== job) return;
        if (m.data.done) { assistCache.set(key, e); if (box.isConnected) fill(e); return; }
        e.rows.push({ via: m.data.via, routes: m.data.routes });
        if (box.isConnected) fill({ ...e, rows: [...e.rows, ...seqs.slice(e.rows.length).map((via) => ({ via, routes: [], pending: true }))] });
      };
      worker.postMessage({ id, target: t.spec, massKg: t.massKg, radiusKm: t.radiusKm, aAu: t.aAu, sequences: seqs, fromJd, years, maxDays });
    };
    const cached = assistCache.get(key);
    if (cached && Math.abs(cached.fromJd - clock.jd) < 30) fill(cached);
    else box.replaceChildren(h('p', { className: 'note', textContent: `Routes that borrow speed from ${[...new Set(seqs.flat())].map((id) => FLYBY[id].name).join(', ')} on the way. The search runs on demand (a few seconds per sequence).` }));
    return h('div', {}, h('h3', { textContent: 'GRAVITY ASSISTS' }), box, h('div', { className: 'body-list' }, pill('SEARCH ROUTES ▸', run)), sel);
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
    const windowRow = (w, jd) => h('button', { className: 'host-row event-row', title: 'Click to draw this transfer and set the clock to its departure.', onclick: () => pick(w) },
      h('span', { textContent: `${iso(w.opens)} – ${iso(w.closes)}${w.opens <= jd ? ' · OPEN NOW' : ''}` }),
      h('span', { className: 'mono', textContent: `BEST ${iso(w.best.depJd)} · ${days(w.best.tofDays)} · C3 ${w.best.c3.toFixed(1)} · ΔV ${w.best.dvTotal.toFixed(1)} KM/S` }));
    live = { key: b.id, t, box, shownSig: null, render() {
      const e = cache.get(b.id), jd = clock.jd;
      if (!e) return;
      const ws = upcoming(e, jd), sig = ws.map((w) => `${w.opens}:${w.opens <= jd}`).join() || `none:${e.fromJd}`;
      if (sig === this.shownSig) return; // unchanged: keep the rows (and any hover) as they are
      this.shownSig = sig;
      box.replaceChildren(...(ws.length ? ws.map((w) => windowRow(w, jd)) : [h('p', { className: 'note', textContent: 'NO DIRECT WINDOW FOUND IN THE NEXT DECADE.' })]),
        h('p', { className: 'note', textContent: `SEARCHED FROM ${iso(e.fromJd)} · FOLLOWS THE SHIP'S CLOCK` }));
    } };
    refresh(true);
    const hm = hohmann(1, Math.max(0.3, t.aAu)), syn = synodicDays(365.25636, t.periodDays);
    const facts = h('dl');
    row(facts, 'HOHMANN', `${days(hm.tofDays)} · ΔV ${injectionDv(hm.dv1).toFixed(2)} KM/S FROM LEO`, 'computed', 'Idealised circular, coplanar orbits at the mean distance: the textbook minimum.');
    row(facts, 'WINDOWS RECUR', `EVERY ${days(syn)}`, 'computed', 'The synodic period: how often Earth and the target return to the same relative positions.');
    const extra = [assistSection(t, b.id)].filter(Boolean);
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

  return { section, tick: () => refresh(), get shown() { return shown; } };
}
