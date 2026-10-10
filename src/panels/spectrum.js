// The SPECTRUM control (#66): a translucent overlay above the view with one log-wavelength axis from
// gamma rays to radio (10⁻⁶ nm to 10 m), the transmission curve T(λ) drawn over colour-coded bands,
// the named bands and all 70 bandpasses with their limits (each included or excluded), custom
// windows (drag on the axis, or type "3–5 µm"), draggable window edges and transmission, one-click
// presets (FULL SPECTRUM, HUMAN EYE, each band, every instrument), and a readout: effective wavelength,
// bandwidth, the bands included, the colour key and which real images went into the view.

import { BANDS } from '../data/bands.js';
import { AXIS, BAND_RANGES, compose, describeCurve, normCurve, parseRange, fmtRange, fmtRangeAll, fmtWave, support, passInfo,
  presetFull, presetEye, presetBand, presetPass, curveLabel, canonical } from '../data/curve.js';
import { badge } from '../data/provenance.js';

const SVGNS = 'http://www.w3.org/2000/svg';
const svg = (tag, attrs = {}, ...kids) => { const e = document.createElementNS(SVGNS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); for (const c of kids) if (c != null) e.append(c); return e; };
const BAND_COLOUR = { gamma: '#ff4dcc', xray: '#33bfd9', uv: '#8c4dff', visible: '#cccccc', ir: '#f2401a', microwave: '#00b3e6', radio: '#ff8c00' };
const L0 = Math.log10(AXIS[0]), L1 = Math.log10(AXIS[1]);
const TICKS = [[1e-6, '1 fm'], [1e-3, '1 pm'], [1, '1 nm'], [1e3, '1 µm'], [1e6, '1 mm'], [1e9, '1 m']];
const UNIT_TICKS = [[1.24e-6, '1 GeV'], [1.24e-3, '1 MeV'], [1.24, '1 keV'], [1240, '1 eV'], [3e5, '1 THz'], [3e8, '1 GHz'], [3e9, '100 MHz']];
const pct = (x) => `${Math.round(x * 100)}%`;
const RES_TEXT = { preview: 'PREVIEW · LOADING FULL RESOLUTION', loading: 'LOADING', full: 'FULL RESOLUTION', failed: 'FULL RESOLUTION FAILED', 'failed-preview': 'PREVIEW ONLY · FULL RESOLUTION FAILED' };
export const resText = (res) => RES_TEXT[res] ?? '';

/**
 * createSpectrumControl({ h, pill, getCurve, setCurve, context, voiceStatus }) → { button, overlay, refresh, open, close }
 *   context(): { body: { name, look } | null, sky: { layers, measured } | null } for the readout
 *   voiceStatus: { get(): boolean, toggle() } for the VOICE STATUS pill (#62)
 */
export function createSpectrumControl({ h, pill, getCurve, setCurve, context = () => ({}), voiceStatus = null }) {
  let draft = null; // the curve while an edge is being dragged
  const button = pill('FULL', () => (overlay.hidden ? open() : close()), 'square');
  button.title = 'Spectrum: an editable transmission curve from gamma rays to radio'; button.classList.add('spectrum-btn');
  const overlay = h('div', { className: 'spectrum-overlay', hidden: true });
  const plot = svg('svg', { class: 'sp-plot', height: '170' });
  const lists = h('div', { className: 'sp-lists' });
  const readout = h('div', { className: 'sp-readout' });
  const addIn = h('input', { className: 'sp-in', type: 'text', placeholder: 'e.g. 3–5 µm · 1.4 GHz · 0.1–2.4 keV · 21 cm' });
  const instSel = h('select', { className: 'ctl-select', title: 'Instrument bandpasses: one click sets the curve to that filter' },
    h('option', { value: '', textContent: 'INSTRUMENT…' }),
    BANDS.filter((b) => b.passes.length).map((b) => h('optgroup', { label: b.label }, b.passes.map((p) => h('option', { value: p.id, textContent: p.label })))));
  instSel.addEventListener('change', () => { if (instSel.value) setCurve(presetPass(instSel.value)); instSel.value = ''; });
  const cur = () => normCurve(draft ?? getCurve());
  const editable = () => { const c = cur(); return c.full ? { parts: [], excl: [] } : { parts: c.parts.map((p) => ({ ...p })), excl: c.excl.map((r) => ({ ...r })) }; };
  /** Excluding from FULL SPECTRUM starts from a window over the whole axis. */
  const fromFull = () => { const c = cur(); return c.full ? { parts: [{ key: 'win:all', lo: AXIS[0], hi: AXIS[1], label: 'ALL WAVELENGTHS' }], excl: [] } : editable(); };
  let winSeq = 1;
  function addWindow(lo, hi, exclude = false) {
    if (exclude) { const c = fromFull(); c.excl.push({ key: `excl:${winSeq++}`, lo, hi }); setCurve(c); return; }
    const c = editable(); c.parts.push({ key: `win:${Date.now().toString(36)}${winSeq++}`, lo, hi, t: 1 }); setCurve(c);
  }
  const addFromText = (exclude) => {
    const r = parseRange(addIn.value);
    if (!r) { addIn.classList.add('bad'); return; }
    addIn.classList.remove('bad'); addIn.value = '';
    addWindow(r[0], r[1], exclude);
  };
  addIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') addFromText(e.shiftKey); });

  // ---- include / exclude a band or bandpass --------------------------------------------------
  const keyOfPass = (id) => `pass:${id}`, keyOfBand = (id) => `band:${id}`;
  const isIn = (key) => cur().parts?.some((p) => p.key === key || (key.startsWith('pass:') && p.pass === key.slice(5)));
  const isOut = (key) => cur().excl?.some((r) => r.key === key);
  function toggleIn(key, make) {
    const c = editable();
    if (isIn(key)) c.parts = c.parts.filter((p) => !(p.key === key || (key.startsWith('pass:') && p.pass === key.slice(5))));
    else { c.parts.push(make()); c.excl = c.excl.filter((r) => r.key !== key); }
    setCurve(c.parts.length || c.excl.length ? c : { parts: [], excl: [] });
  }
  function toggleOut(key, lo, hi, label) {
    const c = fromFull();
    if (isOut(key)) c.excl = c.excl.filter((r) => r.key !== key);
    else { c.excl.push({ key, lo, hi, label }); c.parts = c.parts.filter((p) => p.key !== key && !(key.startsWith('pass:') && p.pass === key.slice(5))); }
    setCurve(c);
  }

  // ---- the plot ----------------------------------------------------------------------------
  let W = 900;
  const M = 10, TOP = 22, BASE = 118, STRIP = 122;
  const x = (nm) => M + ((Math.log10(nm) - L0) / (L1 - L0)) * (W - 2 * M);
  const nmAt = (px) => 10 ** (L0 + ((px - M) / (W - 2 * M)) * (L1 - L0));
  const y = (t) => BASE - t * (BASE - TOP);
  function drawPlot() {
    W = Math.max(320, (overlay.clientWidth || 924) - 28); // the overlay's inner width: drawn 1:1, never scaled
    plot.setAttribute('viewBox', `0 0 ${W} 170`); plot.setAttribute('width', String(W)); plot.setAttribute('height', '170');
    const c = cur(), kids = [];
    kids.push(svg('defs', {}, svg('pattern', { id: 'sp-hatch', width: '6', height: '6', patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, svg('rect', { width: '3', height: '6', fill: 'rgba(255,68,51,0.55)' }))));
    kids.push(svg('rect', { class: 'sp-bg', x: '0', y: '0', width: String(W), height: '170', fill: 'transparent' }));
    for (const b of BAND_RANGES) {
      const x0 = x(b.lo), x1 = x(b.hi);
      kids.push(svg('rect', { x: String(x0), y: String(TOP), width: String(x1 - x0), height: String(BASE - TOP), fill: BAND_COLOUR[b.id], opacity: '0.08' }));
      kids.push(svg('rect', { class: 'sp-band', x: String(x0), y: String(STRIP), width: String(x1 - x0), height: '14', fill: BAND_COLOUR[b.id], opacity: '0.75', 'data-band': b.id }));
      kids.push(svg('text', { x: String((x0 + x1) / 2), y: String(STRIP + 11), class: 'sp-band-label', 'text-anchor': 'middle' }, b.label.split(' ')[0]));
    }
    for (let d = L0; d <= L1; d++) kids.push(svg('line', { x1: String(x(10 ** d)), x2: String(x(10 ** d)), y1: String(BASE), y2: String(BASE + 3), class: 'sp-tick' }));
    for (const [nm, t] of TICKS) kids.push(svg('text', { x: String(x(nm)), y: String(STRIP + 28), class: 'sp-tick-label', 'text-anchor': 'middle' }, t));
    for (const [nm, t] of UNIT_TICKS) kids.push(svg('text', { x: String(x(nm)), y: String(TOP - 8), class: 'sp-unit-label', 'text-anchor': 'middle' }, t));
    // pass positions along the axis
    for (const b of BANDS) for (const p of b.passes) { const s = support(p.filter); if (s) kids.push(svg('line', { x1: String(x(Math.sqrt(s[0] * s[1]))), x2: String(x(Math.sqrt(s[0] * s[1]))), y1: String(BASE - 4), y2: String(BASE), class: 'sp-pass-tick' })); }
    if (c.full) kids.push(svg('text', { x: String(W / 2), y: String((TOP + BASE) / 2), class: 'sp-full', 'text-anchor': 'middle' }, 'FULL SPECTRUM · THE ORDINARY VIEW · DRAG ON THE AXIS TO ADD A WINDOW'));
    else {
      const f = compose(c);
      if (f?.points.length) {
        const pts = [[x(f.points[0][0]), BASE], ...f.points.map(([l, t]) => [x(l), y(t)]), [x(f.points.at(-1)[0]), BASE]];
        kids.push(svg('polygon', { class: 'sp-curve-fill', points: pts.map((p) => p.join(',')).join(' ') }));
        kids.push(svg('polyline', { class: 'sp-curve', points: pts.map((p) => p.join(',')).join(' ') }));
      }
      c.excl.forEach((r, i) => kids.push(svg('rect', { class: 'sp-excl', x: String(x(r.lo)), y: String(TOP), width: String(Math.max(2, x(r.hi) - x(r.lo))), height: String(BASE - TOP), 'data-excl': String(i) },
        svg('title', {}, `EXCLUDED ${r.label ?? ''} ${fmtRange(r.lo, r.hi)} (double-click to remove)`))));
      c.parts.forEach((p, i) => {
        if (p.pass) return;
        const x0 = x(p.lo), x1 = x(p.hi), yt = y(p.t ?? 1);
        kids.push(svg('rect', { class: 'sp-win', x: String(x0), y: String(yt), width: String(Math.max(2, x1 - x0)), height: String(BASE - yt), 'data-part': String(i), 'data-h': 'move' },
          svg('title', {}, `${p.label ?? 'WINDOW'} ${fmtRange(p.lo, p.hi)} · T ${pct(p.t ?? 1)} (drag edges or top; double-click to remove)`)));
        kids.push(svg('rect', { class: 'sp-handle', x: String(x0 - 4), y: String(TOP), width: '8', height: String(BASE - TOP), 'data-part': String(i), 'data-h': 'lo' }));
        kids.push(svg('rect', { class: 'sp-handle', x: String(x1 - 4), y: String(TOP), width: '8', height: String(BASE - TOP), 'data-part': String(i), 'data-h': 'hi' }));
        kids.push(svg('rect', { class: 'sp-handle sp-top', x: String(x0), y: String(yt - 4), width: String(Math.max(2, x1 - x0)), height: '8', 'data-part': String(i), 'data-h': 't' }));
      });
    }
    kids.push(svg('text', { x: String(M), y: String(TOP - 8), class: 'sp-axis-label' }, 'T(λ)'));
    plot.replaceChildren(...kids);
  }
  // dragging: a new window (or, with Shift/Alt, an exclusion) on the background; window edges, body and top
  let drag = null;
  const px = (e) => { const r = plot.getBoundingClientRect(); return [(e.clientX - r.left) * (W / r.width), e.clientY - r.top]; };
  plot.addEventListener('pointerdown', (e) => {
    const t = e.target, [X, Y] = px(e);
    plot.setPointerCapture(e.pointerId);
    if (t.dataset?.part != null) { const c = editable(); drag = { kind: t.dataset.h, i: Number(t.dataset.part), c, X0: X, p0: { ...c.parts[Number(t.dataset.part)] } }; draft = c; return; }
    if (t.dataset?.excl != null) return;
    if (Y > BASE + 2) return;
    drag = { kind: 'new', X0: X, X1: X, exclude: e.shiftKey || e.altKey };
  });
  plot.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const [X, Y] = px(e);
    if (drag.kind === 'new') { drag.X1 = X; drawPlot(); const a = Math.min(drag.X0, X), b = Math.max(drag.X0, X); plot.append(svg('rect', { class: drag.exclude ? 'sp-excl' : 'sp-win', x: String(a), y: String(TOP), width: String(b - a), height: String(BASE - TOP) })); return; }
    const p = drag.c.parts[drag.i], k = 10 ** (((X - drag.X0) / (W - 2 * M)) * (L1 - L0));
    if (drag.kind === 'lo') p.lo = Math.min(nmAt(X), p.hi * 0.999);
    else if (drag.kind === 'hi') p.hi = Math.max(nmAt(X), p.lo * 1.001);
    else if (drag.kind === 'move') { p.lo = Math.max(AXIS[0], drag.p0.lo * k); p.hi = Math.min(AXIS[1], drag.p0.hi * k); }
    else if (drag.kind === 't') p.t = Math.round(Math.max(0, Math.min(1, (BASE - Y) / (BASE - TOP))) * 100) / 100;
    if (drag.kind !== 't') { p.label = undefined; p.band = undefined; p.key = p.key?.startsWith('band:') ? `win:${p.key.slice(5)}${winSeq++}` : p.key; }
    draft = drag.c; drawPlot();
  });
  const endDrag = () => {
    if (!drag) return;
    const d = drag; drag = null;
    if (d.kind === 'new') { draft = null; const a = Math.min(d.X0, d.X1), b = Math.max(d.X0, d.X1); if (b - a >= 3) addWindow(nmAt(a), nmAt(b), d.exclude); else drawPlot(); return; }
    const c = draft; draft = null; setCurve(c);
  };
  plot.addEventListener('pointerup', endDrag);
  plot.addEventListener('pointercancel', endDrag);
  plot.addEventListener('dblclick', (e) => {
    const t = e.target, c = editable();
    if (t.dataset?.part != null) { c.parts.splice(Number(t.dataset.part), 1); setCurve(c.parts.length || c.excl.length ? c : presetFull()); }
    else if (t.dataset?.excl != null) { c.excl.splice(Number(t.dataset.excl), 1); setCurve(c); }
  });

  // ---- the lists ---------------------------------------------------------------------------
  const io = (key, make, lo, hi, label) => h('span', { className: 'sp-io' },
    pill('IN', () => toggleIn(key, make), `square${isIn(key) ? ' on' : ''}`),
    pill('OUT', () => toggleOut(key, lo, hi, label), `square right${isOut(key) ? ' out' : ''}`));
  const openBands = new Set();
  function drawLists() {
    const c = cur();
    const inCurve = h('div', { className: 'sp-parts' },
      h('div', { className: 'sp-h' }, 'IN THE CURVE'),
      c.full ? h('div', { className: 'sp-row' }, 'FULL SPECTRUM: the ordinary view, nothing filtered.') : null,
      ...(c.parts ?? []).map((p, i) => {
        const range = p.pass ? support(passInfo(p.pass)?.pass.filter) : [p.lo, p.hi];
        const tIn = h('input', { type: 'number', min: '0', max: '100', step: '5', className: 'sp-t', value: String(Math.round((p.t ?? 1) * 100)), title: 'Transmission of this part (%)' });
        tIn.addEventListener('change', () => { const e = editable(); e.parts[i].t = Math.max(0, Math.min(100, Number(tIn.value) || 0)) / 100; setCurve(e); });
        return h('div', { className: 'sp-row' },
          h('b', { textContent: p.pass ? passInfo(p.pass)?.pass.label ?? p.pass : p.label ?? 'WINDOW' }),
          h('span', { className: 'sp-range', textContent: range ? fmtRangeAll(...range) : '' }),
          h('span', { className: 'sp-tl' }, 'T ', tIn, '%'),
          pill('✕', () => { const e = editable(); e.parts.splice(i, 1); setCurve(e.parts.length || e.excl.length ? e : presetFull()); }, 'square'));
      }),
      ...(c.excl ?? []).map((r, i) => h('div', { className: 'sp-row sp-row-out' },
        h('b', { textContent: `EXCLUDED ${r.label ?? ''}`.trim() }), h('span', { className: 'sp-range', textContent: fmtRangeAll(r.lo, r.hi) }),
        pill('✕', () => { const e = editable(); e.excl.splice(i, 1); setCurve(e); }, 'square'))),
      h('div', { className: 'sp-row sp-add' }, addIn, pill('ADD WINDOW', () => addFromText(false), 'square'), pill('EXCLUDE', () => addFromText(true), 'square')),
      h('p', { className: 'note', textContent: 'Drag on the axis to add a window (Shift-drag to exclude a range); drag a window\'s edges to resize it, its top to set its transmission, its middle to move it; double-click to remove.' }));
    const bands = h('div', { className: 'sp-bands' }, h('div', { className: 'sp-h' }, 'BANDS AND BANDPASSES'),
      ...BAND_RANGES.map((r) => {
        const b = BANDS.find((x) => x.id === r.id), kb = keyOfBand(r.id);
        const det = h('details', { className: 'sp-band-det', open: openBands.has(r.id) });
        det.addEventListener('toggle', () => { if (det.open) openBands.add(r.id); else openBands.delete(r.id); });
        det.append(h('summary', {},
          h('i', { className: 'sp-swatch', style: `background:${BAND_COLOUR[r.id]}` }), h('b', { textContent: r.label }),
          h('span', { className: 'sp-range', textContent: fmtRangeAll(r.lo, r.hi) }), io(kb, () => ({ key: kb, lo: r.lo, hi: r.hi, band: r.id, label: r.label }), r.lo, r.hi, r.label)),
        ...(b?.passes ?? []).map((p) => {
          const s = support(p.filter) ?? [1, 2], k = keyOfPass(p.id);
          return h('div', { className: 'sp-row' }, h('span', { className: 'sp-pass', textContent: p.label }),
            h('span', { className: 'sp-range', textContent: fmtRangeAll(...s) }), p.sky ? h('span', { className: 'sp-tag', textContent: 'SKY', title: p.skyCredit }) : null,
            io(k, () => ({ key: k, pass: p.id }), s[0], s[1], p.label));
        }));
        return det;
      }));
    lists.replaceChildren(inCurve, bands);
  }

  function drawReadout() {
    const c = cur(), d = describeCurve(c), ctx = context() ?? {}, kids = [];
    kids.push(h('div', { className: 'sp-h' }, 'READOUT'));
    const dl = h('dl');
    const row = (label, value, tier, detail) => { dl.append(h('dt', { textContent: label }), h('dd', { textContent: value }), tier ? badge(tier, detail) : h('span')); };
    row('CURVE', d.label, 'computed', 'The transmission curve you set: presets, windows and exclusions.');
    if (!d.full && !d.empty) {
      row('EFFECTIVE λ', `${fmtWave(d.effNm)}${d.composite ? ` · LOG CENTRE ${fmtWave(d.centreNm)}` : ''}`, 'computed', 'Effective wavelength ∫λT dλ / ∫T dλ (the convention of the bandpass filters); log centre: the middle of the curve on the log axis.');
      row('BANDWIDTH', `${fmtWave(d.widthNm)} EQUIVALENT · ${fmtRange(...d.span)}`, 'computed', 'Equivalent width ∫T dλ / max T, and the range where T exceeds 1% of its peak.');
      row('BANDS', d.bands.map((b) => `${b.label} ${pct(b.share)}`).join(' · '), 'computed', 'Share of the curve in each band, in log wavelength (every octave counts the same).');
    }
    kids.push(dl);
    if (!d.full && !d.empty) {
      if (d.composite) kids.push(h('div', { className: 'sp-key' }, ...d.thirds.map((t, i) => h('span', { className: `k${i}`, textContent: fmtRange(...t) }))),
        h('p', { className: 'note', textContent: 'THREE-BAND COMPOSITE: the curve\'s log range in thirds, shortest → blue, middle → green, longest → red, like an RGB composite of three filters.' }));
      else kids.push(h('div', { className: `band-key band-${d.palette}` }, h('span', { textContent: 'FAINT' }), h('span', { textContent: d.dominant === 'visible' ? 'BRIGHT · MONOCHROME' : 'BRIGHT · FALSE COLOUR' })));
    }
    const look = ctx.body?.look;
    if (look) {
      const bl = h('dl');
      bl.append(h('dt', { textContent: ctx.body.name.toUpperCase() }), h('dd', { textContent: `${look.label}${look.res ? ` · ${resText(look.res)}` : ''}` }), badge(look.tier, look.detail));
      for (const s of look.sources ?? []) bl.append(h('dt', { textContent: s.drawn ? 'REAL · DRAWN' : 'REAL · LISTED' }), h('dd', { textContent: `${s.credit} · ${pct(s.weight)}` }), badge('measured', s.note ?? s.credit));
      if (look.notObserved?.length) bl.append(h('dt', { textContent: 'NOT OBSERVED' }), h('dd', { textContent: look.notObserved.map((r) => fmtRange(...r)).join(', ') }), badge('computed', 'Parts of the curve with no real image and nothing to predict from.'));
      else if (look.uncovered?.length) bl.append(h('dt', { textContent: 'NO REAL IMAGE' }), h('dd', { textContent: look.uncovered.map((r) => fmtRange(...r)).join(', ') }), badge('modelled', 'Predicted there (MODELLED · PREDICTED).'));
      kids.push(bl);
    }
    const sky = ctx.sky;
    if (sky && !d.full) {
      const sl = h('dl');
      if (sky.layers?.length) for (const L of sky.layers) sl.append(h('dt', { textContent: 'SKY' }), h('dd', { textContent: `${L.skyCredit.split(/[,(]/)[0].trim().toUpperCase()} · ${pct(L.weight)}${L.look?.res ? ` · ${resText(L.look.res)}` : ''}` }), badge('measured', L.skyCredit));
      else sl.append(h('dt', { textContent: 'SKY' }), h('dd', { textContent: 'CATALOGUE STARS, RE-WEIGHTED THROUGH T(λ)' }), badge('computed', 'No all-sky survey overlaps the curve: catalogue stars brightened or dimmed by their blackbody through T relative to V (Vega system).'));
      kids.push(sl);
    }
    readout.replaceChildren(...kids);
  }

  const presets = h('div', { className: 'sp-presets' },
    pill('FULL SPECTRUM', () => setCurve(presetFull()), 'square'), pill('HUMAN EYE', () => setCurve(presetEye()), 'square'),
    ...BAND_RANGES.map((b) => pill(b.label.split(' ')[0], () => setCurve(presetBand(b.id)), 'square')), instSel,
    voiceStatus ? (() => { const b = pill('', () => { voiceStatus.toggle(); sync(); }, 'square'); const sync = () => { b.textContent = `VOICE STATUS ${voiceStatus.get() ? 'ON' : 'OFF'}`; b.classList.toggle('on', voiceStatus.get()); }; sync(); b.title = 'Say "Processing" every 3 s while full-resolution band images load (a local voice, no key needed)'; return b; })() : null,
    h('span', { className: 'sp-fill' }), pill('✕', () => close(), 'square'));
  overlay.append(h('div', { className: 'sp-head' }, h('b', { textContent: 'SPECTRUM · TRANSMISSION T(λ)' }), presets), plot, h('div', { className: 'sp-body' }, lists, readout));

  function refresh() {
    const c = normCurve(getCurve()), can = canonical(c);
    button.textContent = (c.full ? 'FULL' : can.kind === 'pass' ? `${can.band.short} · ${can.pass.label}` : curveLabel(c)).replace(/ ?µm\b/g, ' MICRONS').toUpperCase(); // 'µ' upper-cases to Greek 'Μ'
    button.classList.toggle('on', !c.full);
    if (overlay.hidden) return;
    drawPlot(); drawLists(); drawReadout();
  }
  function open() { overlay.hidden = false; refresh(); }
  function close() { overlay.hidden = true; }
  window.addEventListener('resize', () => { if (!overlay.hidden) drawPlot(); });
  return { button, overlay, refresh, open, close, refreshReadout: () => { if (!overlay.hidden) drawReadout(); } };
}
