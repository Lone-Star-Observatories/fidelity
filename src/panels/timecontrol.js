// The time control (#34): the bottom bar's top row. A readout of the ship's clock with a date
// field, a middle panel that swaps between the RATE slider (one logarithmic scale from −1
// millennium/s through HOLD and real time to +1 millennium/s, with detents at each unit) and the
// TIMELINE (a zoomable strip centred on the clock: drag to scrub, wheel to zoom, click an event
// to go to it), and the HOLD / RUN / NOW and step controls.

import { sliderToDays, daysToSlider, rateLabel, timelineTicks, RATE_UNITS, SLIDER_MAX } from '../astro/timerate.js';
import { skyEvents, onSkyEvents, skyEventsWindow } from '../data/skyevents.js';
import { eventsFeed, onEvents } from '../data/events.js';
import { eventTitle, watchFrom } from './skyevents.js';
import { dateFromJd } from '../astro/time.js';

// what the timeline marks, and in which colour (CSS custom properties of the LCARS palette)
const MARK = (e) => (e.type === 'solar' ? '--gold' : e.type === 'lunar' ? '--rose' : e.type === 'transit' ? '--ice'
  : e.kind === 'opposition' ? '--apricot' : e.kind === 'planetary parade' ? '--lilac' : null);
const ZOOMS = [['DAY', 1], ['MONTH', 30.436875], ['YEAR', 365.25], ['DECADE', 3652.5], ['CENTURY', 36525], ['KYR', 365250]];
const SPAN_MIN = 0.25, SPAN_MAX = 3.6525e6;

export function createTimeControl({ h, pill, clock, settings, go, dateIn, stepControls }) {
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim() || '#fc9';

  // ---- readout -------------------------------------------------------------------------------
  const clockOut = h('div', { className: 'tc-clock mono' });
  const readout = h('div', { className: 'tc-readout', title: 'The ship\'s clock (UTC). Type a date and press Enter to go there.' },
    clockOut, h('div', { className: 'tc-date' }, h('span', { textContent: 'GO TO' }), dateIn));

  // ---- the middle panel: RATE or TIMELINE ----------------------------------------------------
  const rateOut = h('div', { className: 'tc-rate mono' });
  const tabRate = pill('RATE', () => settings.set('timePanel', 'rate'), 'square tc-tab');
  const tabLine = pill('TIMELINE', () => settings.set('timePanel', 'timeline'), 'square tc-tab');
  const hint = h('div', { className: 'tc-hint' });

  // RATE: a native range input (keyboard arrows work) over tick labels at the detents
  const slider = h('input', { type: 'range', className: 'tc-slider', min: String(-SLIDER_MAX), max: String(SLIDER_MAX), step: '1', value: '0', title: 'Rate: drag, scroll or use the arrow keys. Centre = HOLD.' });
  const ticks = h('div', { className: 'tc-ticks', ariaHidden: 'true' });
  const tickAt = (days, label, cls = '') => {
    const pos = (daysToSlider(days) + SLIDER_MAX) / (2 * SLIDER_MAX);
    ticks.append(h('span', { className: `tc-tick ${cls}`, textContent: label, style: `left: calc(${(pos * 100).toFixed(2)}% + ${(13 - 26 * pos).toFixed(1)}px)` }));
  };
  const shown = RATE_UNITS.filter((u) => ['HR', 'DAY', 'MO', 'YR', 'CEN', 'KYR'].includes(u.tick));
  for (const u of [...shown].reverse()) tickAt(-u.days, `−${u.tick}`);
  tickAt(0, 'HOLD', 'hold');
  tickAt(RATE_UNITS[0].days, 'REAL', 'real');
  for (const u of shown) tickAt(u.days, u.tick);
  const ratePane = h('div', { className: 'tc-pane tc-pane-rate' }, slider, ticks);
  const applySlider = () => { const d = sliderToDays(Number(slider.value)); clock.setRate(d, rateLabel(d)); };
  slider.addEventListener('input', applySlider);
  slider.addEventListener('wheel', (e) => {
    e.preventDefault(); e.stopPropagation();
    slider.value = String(Math.max(-SLIDER_MAX, Math.min(SLIDER_MAX, Number(slider.value) - Math.sign(e.deltaY || e.deltaX) * 15)));
    applySlider();
  }, { passive: false });

  // TIMELINE: a canvas centred on the clock
  const canvas = h('canvas', { className: 'tc-canvas' });
  const linePane = h('div', { className: 'tc-pane tc-pane-line' }, canvas);
  const zooms = h('div', { className: 'tc-zooms' }, ZOOMS.map(([label, s]) => pill(label, () => setSpan(s), 'square tc-zoom')));
  let span = settings.get('timelineSpan') ?? 730, saveSpan = 0, marks = [], hover = null;
  const setSpan = (s) => {
    span = Math.min(SPAN_MAX, Math.max(SPAN_MIN, s));
    clearTimeout(saveSpan); saveSpan = setTimeout(() => settings.set('timelineSpan', span), 400);
    draw();
  };
  const items = () => {
    const out = [];
    for (const e of skyEvents()) { const c = MARK(e); if (c) out.push({ jd: e.greatest, title: eventTitle(e), colour: c, sky: e }); }
    for (const e of eventsFeed()?.events ?? []) if (Number.isFinite(e.jd) && e.category !== 'celestial') // sky events come from our own ephemeris
       out.push({ jd: e.jd, title: e.title.toUpperCase(), colour: '--blue', feed: e });
    return out.sort((a, b) => a.jd - b.jd);
  };

  function draw() {
    if (linePane.hidden || !canvas.isConnected) return;
    const w = canvas.clientWidth, ht = canvas.clientHeight, dpr = devicePixelRatio || 1;
    if (!w || !ht) return;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(ht * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(ht * dpr); }
    const g = canvas.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, ht);
    const jd = clock.jd, from = jd - span / 2, to = jd + span / 2, x = (t) => ((t - from) / span) * w;
    const scale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--text-scale')) || 1;
    const font = `${Math.round(11 * scale)}px Antonio, 'Arial Narrow', sans-serif`;
    g.font = font; g.textBaseline = 'alphabetic';
    const axisY = Math.round(ht * 0.62);
    // the window the sky-events list was computed for
    const win = skyEventsWindow();
    if (win) { g.fillStyle = 'rgba(153, 119, 170, 0.18)'; g.fillRect(x(win.from), axisY - 3, x(win.to) - x(win.from), 6); }
    g.fillStyle = css('--violet'); g.fillRect(0, axisY - 1, w, 2);
    // ticks
    g.fillStyle = css('--lilac'); g.strokeStyle = css('--violet'); g.lineWidth = 1;
    for (const t of timelineTicks(from, to, w, 70 * scale)) {
      const tx = Math.round(x(t.jd)) + 0.5;
      g.beginPath(); g.moveTo(tx, axisY); g.lineTo(tx, axisY + 6); g.stroke();
      g.fillText(t.label, tx + 3, axisY + 6 + 11 * scale);
    }
    // events: diamonds on the axis, then labels where they fit in two rows above it (sky events first)
    marks = [];
    for (const it of items()) {
      if (it.jd < from || it.jd > to) continue;
      const ex = x(it.jd);
      g.fillStyle = css(it.colour);
      const r = it.sky ? 5 : 3.5;
      g.beginPath(); g.moveTo(ex, axisY - r - 1); g.lineTo(ex + r, axisY); g.lineTo(ex, axisY + r + 1); g.lineTo(ex - r, axisY); g.closePath(); g.fill();
      marks.push({ x: ex, it });
    }
    const rows = [[], []];
    for (const m of [...marks.filter((k) => k.it.sky), ...marks.filter((k) => !k.it.sky)]) {
      const label = `${m.it.title} · ${dateFromJd(m.it.jd).toISOString().slice(0, 10)}`, a = m.x - 4, b = a + g.measureText(label).width;
      if (a < 0 || b > w) continue;
      const r = rows.findIndex((row) => row.every(([p, q]) => b + 10 < p || a > q + 10));
      if (r < 0) continue;
      rows[r].push([a, b]);
      g.fillStyle = css(m.it.colour);
      g.fillText(label, a, axisY - 9 - r * 13 * scale);
    }
    // the playhead (the ship's clock) in the centre
    g.fillStyle = css('--gold');
    g.fillRect(Math.round(w / 2) - 1, 2, 3, ht - 4);
    g.beginPath(); g.arc(w / 2 + 0.5, 6, 5, 0, Math.PI * 2); g.fill();
  }
  const nearMark = (px) => marks.reduce((best, m) => (Math.abs(m.x - px) < 8 && (!best || Math.abs(m.x - px) < Math.abs(best.x - px)) ? m : best), null);
  const goTo = (it) => {
    if (it.sky) { const e = it.sky; clock.set(e.type === 'solar' || e.type === 'lunar' ? e.greatest - 2 / 1440 : e.greatest); go({ level: 'system', system: 'sol', body: watchFrom(e) }); }
    else clock.set(it.jd);
  };
  // drag to scrub (the clock holds while you drag), click a marker to go there, wheel to zoom
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    drag = { x0: e.clientX, jd0: clock.jd, moved: false, rate: clock.snapshot() };
    clock.setRate(0);
  });
  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    if (drag) {
      if (Math.abs(e.clientX - drag.x0) > 3) drag.moved = true;
      if (drag.moved) clock.set(drag.jd0 - ((e.clientX - drag.x0) / r.width) * span);
      return;
    }
    const m = nearMark(e.clientX - r.left);
    if (m !== hover) { hover = m; canvas.title = m ? `${m.it.title}\n${dateFromJd(m.it.jd).toISOString().slice(0, 16).replace('T', ' ')} UTC\nClick to go there.` : 'Drag to scrub through time · wheel to zoom · click an event to go to it'; canvas.style.cursor = m ? 'pointer' : 'ew-resize'; }
  });
  const endDrag = (e) => {
    if (!drag) return;
    const d = drag; drag = null;
    clock.restore(d.rate);
    if (!d.moved) { const m = nearMark(e.clientX - canvas.getBoundingClientRect().left); if (m) goTo(m.it); }
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); e.stopPropagation(); setSpan(span * (e.deltaY > 0 ? 1.25 : 0.8)); }, { passive: false });
  onSkyEvents(() => draw());
  onEvents?.(() => draw());
  new ResizeObserver(() => draw()).observe(canvas);

  const panes = h('div', { className: 'tc-panes' }, ratePane, linePane);
  const mid = h('div', { className: 'tc-mid' }, h('div', { className: 'tc-head' }, tabRate, tabLine, hint, zooms, rateOut), panes);

  // ---- right: HOLD / NOW and the step controls ----------------------------------------------
  const holdBtn = pill('❚❚ HOLD', () => clock.toggleHold(), 'square tc-hold');
  const right = h('div', { className: 'tc-right' },
    h('div', { className: 'tc-row' }, holdBtn, pill('NOW', () => clock.now(), 'square tc-now')),
    h('div', { className: 'tc-row', title: 'Step the clock by n units ([ and ] keys), or RUN at n units per second' }, ...stepControls));

  const row = h('div', { className: 'bar-row time-row' }, h('div', { className: 'ctl-label tc-label', textContent: 'TIME' }), readout, mid, right);

  // ---- keep everything in step with the clock and settings ----------------------------------
  const syncPanel = () => {
    const p = settings.get('timePanel') === 'timeline' ? 'timeline' : 'rate';
    ratePane.hidden = p !== 'rate'; linePane.hidden = zooms.hidden = p !== 'timeline'; hint.hidden = p !== 'rate';
    tabRate.classList.toggle('on', p === 'rate'); tabLine.classList.toggle('on', p === 'timeline');
    hint.textContent = 'DRAG · SCROLL · ARROW KEYS · DETENTS AT EACH UNIT';
    draw();
  };
  settings.onChange((k) => { if (k === 'timePanel') syncPanel(); });
  const syncRate = () => {
    rateOut.textContent = clock.rate.label;
    holdBtn.textContent = clock.rate.days === 0 ? '▶ RESUME' : '❚❚ HOLD';
    if (document.activeElement !== slider) slider.value = String(daysToSlider(clock.rate.days));
  };
  clock.onChange(syncRate);
  syncPanel(); syncRate();

  return {
    el: row,
    /** Per frame: the readout and, when shown, the timeline. */
    frame() {
      const d = dateFromJd(clock.jd);
      clockOut.textContent = Number.isNaN(d.getTime()) ? '—' : d.toISOString().slice(0, 19).replace('T', ' ');
      if (!linePane.hidden) draw();
    },
  };
}
