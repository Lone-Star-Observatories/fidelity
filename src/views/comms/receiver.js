// COMMS RF receiver console (#69): listen to a public SDR receiver from inside the ship. Reception
// only — it tunes and plays what the receiver already hears, and never transmits.
//
//   KiwiSDR (ws /api/rf/kiwi): the backend relays the receiver's audio (SND) and waterfall (W/F).
//     The console tunes (frequency, demodulator, bandwidth, AGC), shows a scrolling waterfall, and
//     scans the receiver's whole 0–30 MHz view for clear signals to jump to.
//   Local SDR (ws /api/rf/local, loopback only): one IQ stream from the device (bladeRF, RTL-SDR, ...)
//     feeds both the waterfall rows ("LWF", src/data/sdr.js) and the audio, demodulated in the
//     backend. A spectrum trace sits over the waterfall; click either to tune. Tuning inside the
//     span moves only the backend's NCO; the scan pauses the stream and sweeps +-2 MHz.
//   The audio runs through the shared COMMS chain (jitter buffer, hiss filter, auto-notch).
//   A frequency converter in the local SDR's path (Ham It Up, src/data/converter.js): the console
//   works in antenna-side frequencies (dial, waterfall axis, click-to-tune, scan results); only the
//   tune and sweep requests use the SDR's frequency (antenna + LO).

import { kiwiTag, parseKiwiMsg, parseKiwiSnd, parseKiwiWf, MODES, passband, findSignals, formatFrequency, bandName, suggestMode } from '../../data/rf.js';
import { toDeviceHz, toAntennaHz, antennaRange, converting, converterLabel } from '../../data/converter.js';
import { parseWfRow, rowAxis, axisTicks } from '../../data/sdr.js';

const el = (tag, props = {}, ...kids) => {
  const e = Object.assign(document.createElement(tag), props);
  for (const k of kids.flat()) if (k != null && k !== false) e.append(k);
  return e;
};
// bandwidth per mode: the range the demodulator accepts, the wheel's increment, presets, and the default
export const BW = {
  am: { min: 1000, max: 16000, inc: 500, presets: [3000, 4000, 6000, 8000, 10000, 12000], def: 6000 },
  usb: { min: 500, max: 4000, inc: 100, presets: [1800, 2100, 2400, 2700, 3000, 3600], def: 2400 },
  lsb: { min: 500, max: 4000, inc: 100, presets: [1800, 2100, 2400, 2700, 3000, 3600], def: 2400 },
  cw: { min: 50, max: 2000, inc: 50, presets: [100, 200, 300, 500, 1000], def: 500 },
  nbfm: { min: 4000, max: 25000, inc: 500, presets: [6000, 8000, 10000, 12500, 16000, 20000], def: 12500 },
  wbfm: { min: 50000, max: 250000, inc: 10000, presets: [100000, 150000, 180000, 200000, 250000], def: 180000 },
};
const KIWI_MAX_BW = 11000; // a KiwiSDR's audio channel is 12 kHz wide
/** Clamp and snap a bandwidth for a mode (a KiwiSDR stops at 11 kHz). */
export function clampBw(mode, hz, local = true) {
  const b = BW[mode] ?? BW.am, max = local ? b.max : Math.min(b.max, KIWI_MAX_BW);
  return Math.max(b.min, Math.min(max, Math.round(hz / b.inc) * b.inc));
}
const BW_KEY = 'fidelity.rxBw'; // each mode's last bandwidth, per viewer
const savedBw = () => { try { return JSON.parse(localStorage.getItem(BW_KEY) || '{}') ?? {}; } catch { return {}; } };
const saveBw = (mode, hz) => { try { localStorage.setItem(BW_KEY, JSON.stringify({ ...savedBw(), [mode]: hz })); } catch { /* private mode */ } };
const bwLabel = (bw) => (bw >= 1000 ? `${+(bw / 1000).toFixed(bw % 1000 ? 2 : 0)} kHz` : `${bw} Hz`);
// the local SDR also demodulates wideband FM (broadcast); a KiwiSDR stops at 30 MHz
const LOCAL_MODES = { ...MODES, wbfm: { label: 'WFM', low: -90000, high: 90000 } };
const STEPS = [[100, '100 Hz'], [1000, '1 kHz'], [5000, '5 kHz'], [9000, '9 kHz'], [12500, '12.5 kHz'], [25000, '25 kHz'], [100000, '100 kHz'], [1000000, '1 MHz']];
// the tuning step (buttons, custom value, mouse wheel) is remembered per viewer
const STEP_KEY = 'fidelity.rxStep';
const savedStep = () => { try { const v = Number(localStorage.getItem(STEP_KEY)); return v >= 1 && v <= 1e8 ? v : null; } catch { return null; } };
const saveStep = (v) => { try { localStorage.setItem(STEP_KEY, String(v)); } catch { /* private mode */ } };
/** Mouse wheel → whole steps (up = higher frequency); trackpads' small deltas accumulate to a notch. */
export function wheelSteps(e, acc) {
  const px = e.deltaMode === 1 ? e.deltaY * 34 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY; // a mouse notch is ~100 px (3 lines)
  acc.v += px;
  const n = Math.trunc(acc.v / 100);
  if (n) acc.v -= n * 100;
  return n ? -n : 0;
}
// KiwiSDR waterfall colour ramp (cold → hot), dBm clamped to [min, max]
const RAMP = [[0, 0, 40], [0, 40, 120], [0, 120, 160], [40, 180, 120], [200, 200, 40], [255, 120, 20], [255, 40, 40]];
function heat(db, min, max) {
  const t = Math.max(0, Math.min(1, (db - min) / (max - min))) * (RAMP.length - 1), i = Math.min(RAMP.length - 2, Math.floor(t)), f = t - i;
  return [0, 1, 2].map((c) => Math.round(RAMP[i][c] + (RAMP[i + 1][c] - RAMP[i][c]) * f));
}

/** A receiver console bound to the COMMS audio chain. mount() opens the link; it renders into `screen` (waterfall) and `console` (controls). */
export function createReceiver({ audio, pill, badge, onPanel, converter = () => null }) {
  let rx = null, ws = null, wf = null, wfCtx = null, spec = null, specCtx = null, axisEl = null, legendEl = null, pollRaf = 0;
  const KIWI_SPAN = 30e6; // a Kiwi's full view, used for the waterfall and scan

  function wsUrl(receiver) {
    const base = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`;
    return receiver.local ? `${base}/api/rf/local` : `${base}/api/rf/kiwi?r=${encodeURIComponent(receiver.url)}`;
  }

  // ---- audio + waterfall from the receiver ---------------------------------------------------------
  const wfBuf = []; // recent full-span waterfall rows (Float32 dBm) for the scan
  function onFrame(data) {
    const { tag, body } = kiwiTag(new Uint8Array(data));
    if (tag === 'MSG') {
      const m = parseKiwiMsg(body);
      if (m.audio_rate) rx.rate = Number(m.audio_rate) || rx.rate;
      // why a public KiwiSDR hands the channel back (often straight after connecting): no free slot,
      // password-only, or down. Remember it so the close that follows keeps the real reason.
      if (m.too_busy != null) setState(rx.closeHint = `RECEIVER FULL · NO FREE CHANNEL${m.too_busy && m.too_busy !== true ? ` (${m.too_busy} IN USE)` : ''} · TRY ANOTHER`);
      else if (m.badp === '1' || m.badp === 1) setState(rx.closeHint = 'RECEIVER NEEDS A PASSWORD · NOT PUBLIC · TRY ANOTHER');
      else if (m.down != null) setState(rx.closeHint = 'RECEIVER IS DOWN FOR MAINTENANCE · TRY ANOTHER');
      return;
    }
    if (tag === 'SND') {
      const s = parseKiwiSnd(body);
      if (!s) return;
      rx.rssi = s.rssi;
      if (rx.playing) audio.pcm(s.samples, rx.rate);
      return;
    }
    if (tag === 'W/F') {
      const w = parseKiwiWf(body);
      if (!w) return;
      drawWaterfallRow(w.db);
      wfBuf.push(w.db);
      if (wfBuf.length > 24) wfBuf.shift();
      return;
    }
    if (tag === 'LWF' && rx.local) { // the local SDR's own spectrum (SDR-side centre; the axis maps it to the antenna)
      const row = parseWfRow(body);
      if (!row) return;
      const axis = rowAxis(row, rx.conv);
      if (rx.fake !== row.fake) { rx.fake = row.fake; renderLegend(); }
      if (!rx.axis || rx.axis.startHz !== axis.startHz || rx.axis.spanHz !== axis.spanHz) { if (rx.axis) markRetune(); rx.axis = axis; renderAxis(); renderLegend(); }
      autoRange(row.db);
      drawWaterfallRow(row.db);
    }
  }
  /** The visible span: { startHz, spanHz } antenna side, from the left edge of the first bin. */
  const span = () => (rx.local ? (rx.axis ? { startHz: rx.axis.startHz - rx.axis.binHz / 2, spanHz: rx.axis.spanHz } : null) : { startHz: 0, spanHz: KIWI_SPAN });
  /** Colour range follows the noise floor (local SDR: dBFS, not calibrated dBm). */
  function autoRange(db) {
    const s = Float32Array.from(db).sort(), floor = s[Math.floor(s.length * 0.2)];
    rx.floor = rx.floor == null ? floor : rx.floor + (floor - rx.floor) * 0.1;
    rx.wfMin = rx.floor - 8; rx.wfMax = rx.floor + 62;
  }
  function markRetune() { // the device moved: a line across the waterfall where the old span ends
    if (!wfCtx) return;
    wfCtx.drawImage(wf, 0, 0, wf.width, wf.height - 1, 0, 1, wf.width, wf.height - 1);
    wfCtx.fillStyle = 'rgba(204,153,255,0.7)'; wfCtx.fillRect(0, 0, wf.width, 1);
    rx.specAvg = null;
  }

  function drawWaterfallRow(db) {
    if (!wf || !wfCtx) return;
    const W = wf.width, H = wf.height, sp = span();
    if (!sp) return;
    wfCtx.drawImage(wf, 0, 0, W, H - 1, 0, 1, W, H - 1); // scroll down one line
    const row = wfCtx.createImageData(W, 1), n = db.length;
    for (let x = 0; x < W; x++) {
      const [r, g, b] = heat(db[Math.floor((x / W) * n)] ?? -120, rx.wfMin, rx.wfMax);
      row.data.set([r, g, b, 255], x * 4);
    }
    wfCtx.putImageData(row, 0, 0);
    // tuning cursor
    const cx = Math.round(((rx.freqHz - sp.startHz) / sp.spanHz) * W);
    wfCtx.fillStyle = 'rgba(255,255,255,0.6)';
    wfCtx.fillRect(cx, 0, 1, 2);
    drawSpectrum(db, sp);
  }
  /** The tuned passband's x range on a canvas W wide over span sp (the "tune block"). */
  function passbandX(sp, W) {
    const pb = passband(rx.mode === 'wbfm' ? 'nbfm' : rx.mode, rx.bwHz);
    return [((rx.freqHz + pb.low - sp.startHz) / sp.spanHz) * W, ((rx.freqHz + pb.high - sp.startHz) / sp.spanHz) * W];
  }
  /** The spectrum trace over the waterfall: smoothed over rows, with the tuned passband shaded. */
  function drawSpectrum(db, sp) {
    if (!spec || !specCtx) return;
    const W = spec.width, H = spec.height, n = db.length, g = specCtx;
    if (!rx.specAvg || rx.specAvg.length !== n) rx.specAvg = Float32Array.from(db);
    else for (let i = 0; i < n; i++) rx.specAvg[i] += (db[i] - rx.specAvg[i]) * 0.35;
    const lo = rx.wfMin - 4, hi = rx.wfMax + 6, y = (v) => H - ((v - lo) / (hi - lo)) * H;
    g.fillStyle = '#04070c'; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(80,110,160,0.35)'; g.lineWidth = 1;
    for (let v = Math.ceil(lo / 20) * 20; v < hi; v += 20) { g.beginPath(); g.moveTo(0, y(v) + 0.5); g.lineTo(W, y(v) + 0.5); g.stroke(); }
    const [x0, x1] = passbandX(sp, W);
    g.fillStyle = 'rgba(255,153,0,0.18)'; g.fillRect(x0, 0, Math.max(1, x1 - x0), H);
    g.strokeStyle = 'rgba(255,153,0,0.55)'; g.lineWidth = 1; g.strokeRect(x0 + 0.5, 0.5, Math.max(1, x1 - x0) - 1, H - 1);
    g.fillStyle = '#ffb347'; g.font = '16px monospace'; g.fillText(bwLabel(rx.bwHz), Math.min(W - 90, x1 + 4), 36);
    g.beginPath();
    for (let x = 0; x < W; x++) { const v = rx.specAvg[Math.floor((x / W) * n)]; if (x) g.lineTo(x, y(v)); else g.moveTo(x, y(v)); }
    g.strokeStyle = '#ffcc66'; g.lineWidth = 1.5; g.stroke();
    g.lineTo(W, H); g.lineTo(0, H); g.closePath(); g.fillStyle = 'rgba(255,204,102,0.12)'; g.fill();
    const cx = ((rx.freqHz - sp.startHz) / sp.spanHz) * W;
    g.fillStyle = 'rgba(255,255,255,0.8)'; g.fillRect(Math.round(cx), 0, 1, H);
    g.fillStyle = '#99a'; g.font = '18px monospace';
    g.fillText(`${Math.round(hi)} ${rx.local ? 'dBFS' : 'dBm'}`, 6, 18); g.fillText(`${Math.round(lo)}`, 6, H - 6);
  }
  /** Frequency labels under the waterfall (antenna side). */
  function renderAxis() {
    if (!axisEl) return;
    const sp = span();
    if (!sp) { axisEl.replaceChildren(); return; }
    axisEl.replaceChildren(...axisTicks(sp.startHz, sp.spanHz, rx.local ? 5 : 6).map((t) => el('span', { className: 'cx-wf-tick', textContent: t.label, style: `left:${(((t.hz - sp.startHz) / sp.spanHz) * 100).toFixed(2)}%` })));
    axisEl.append(el('span', { className: 'cx-wf-unit', textContent: sp.startHz + sp.spanHz >= 1e6 ? 'MHz' : 'kHz' }));
  }
  function renderLegend() {
    if (!legendEl) return;
    if (!rx.local) { legendEl.replaceChildren(el('span', { textContent: '0–30 MHz · CLICK THE WATERFALL TO TUNE' })); return; }
    const sp = rx.axis ? `SPAN ${(rx.axis.spanHz / 1e3).toFixed(0)} kHz · ` : '';
    const conv = rx.conv ? `AXIS: ANTENNA (SDR − ${(toDeviceHz(0, rx.conv) / 1e6).toFixed(3)} MHz) · ` : 'AXIS: SDR = ANTENNA · ';
    legendEl.replaceChildren(el('span', { textContent: `${rx.fake ? 'SIMULATED SDR · ' : 'LOCAL SDR · '}${sp}${conv}CLICK TO TUNE ` }),
      rx.fake ? badge('imagined', 'FIDELITY_FAKE_SDR=1: a development stand-in. Synthetic IQ (a few tones and noise); nothing is received.') : badge('measured', "Your SDR's IQ stream: a 1024-point FFT averaged over up to 16 frames per row, in dBFS (uncalibrated)."));
  }

  // ---- the viewscreen (waterfall) and the control console -----------------------------------------
  function renderScreen(setScreen) {
    const canvas = el('canvas', { className: 'cx-wf', width: 1024, height: 240 });
    const trace = el('canvas', { className: 'cx-spec', width: 1024, height: 150 });
    axisEl = el('div', { className: 'cx-wf-axis mono' });
    legendEl = el('div', { className: 'cx-wf-legend mono' });
    const screenEl = el('div', { className: 'cx-rx-screen' },
      el('div', { className: 'cx-rx-read' },
        el('div', { className: 'cx-rx-freq mono', id: 'cx-freq' }, formatFrequency(rx.freqHz)),
        el('div', { className: 'cx-rx-sub mono', id: 'cx-sub' }, `${rx.name.toUpperCase()} · ${rx.mode.toUpperCase()}`)),
      trace, canvas, axisEl, legendEl);
    setScreen(screenEl);
    wf = canvas; wfCtx = canvas.getContext('2d');
    spec = trace; specCtx = trace.getContext('2d');
    wfCtx.fillStyle = '#04070c'; wfCtx.fillRect(0, 0, canvas.width, canvas.height);
    specCtx.fillStyle = '#04070c'; specCtx.fillRect(0, 0, trace.width, trace.height);
    renderLegend(); renderAxis();
    // click the waterfall or the spectrum to tune (the antenna-side frequency under the pointer)
    const tuneFromX = (e) => {
      const sp = span(); if (!sp) return;
      const b = e.currentTarget.getBoundingClientRect(), hz = sp.startHz + ((e.clientX - b.left) / b.width) * sp.spanHz;
      setFreq(rx.local ? Math.round(hz / 100) * 100 : Math.round(hz));
    };
    for (const c of [canvas, trace]) { c.style.cursor = 'crosshair'; c.addEventListener('click', tuneFromX); }
    // the mouse wheel anywhere on the receiver screen (frequency, spectrum, waterfall) tunes by the step (up = higher)
    const acc = { v: 0 };
    const accBw = { v: 0 };
    const overBlock = (e) => {
      if (e.shiftKey) return true;
      const c = [canvas, trace].find((x) => x.contains(e.target)), sp = span();
      if (!c || !sp) return false;
      const b = c.getBoundingClientRect(), [x0, x1] = passbandX(sp, b.width), x = e.clientX - b.left;
      return x >= Math.min(x0, (x0 + x1) / 2 - 8) && x <= Math.max(x1, (x0 + x1) / 2 + 8); // at least 16 px to aim at
    };
    screenEl.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (overBlock(e)) { const n = wheelSteps(e, accBw); if (n) setBw(rx.bwHz + n * (BW[rx.mode] ?? BW.am).inc); return; }
      const n = wheelSteps(e, acc); if (n) step(n);
    }, { passive: false });
    screenEl.title = 'Mouse wheel: tune by the step · over the shaded passband (or with Shift): widen or narrow the bandwidth · click: tune there';
    updateReadout();
  }
  function updateReadout() {
    const f = document.getElementById('cx-freq'), s = document.getElementById('cx-sub');
    if (f) f.textContent = formatFrequency(rx.freqHz);
    if (s) s.textContent = `${rx.name.toUpperCase()}${rx.conv ? ` · VIA ${converterLabel(rx.conv)} (SDR ${formatFrequency(toDeviceHz(rx.freqHz, rx.conv))})` : ''} · ${(rx.local ? LOCAL_MODES : MODES)[rx.mode]?.label ?? rx.mode.toUpperCase()} · ${rx.bwHz >= 1000 ? `${(rx.bwHz / 1000).toFixed(1)} kHz` : `${rx.bwHz} Hz`}${rx.rssi != null ? ` · ${rx.rssi.toFixed(0)} ${rx.local ? 'dBFS' : 'dBm'}` : ''}${bandName(rx.freqHz) ? ` · ${bandName(rx.freqHz)}` : ''}`;
  }

  /** The control panel (goes in the right finder). */
  function controls() {
    const box = el('div', { className: 'cx-rx' });
    const freqRow = el('div', { className: 'cx-rx-row' },
      pill('−', () => step(-1), 'square'),
      (() => { const i = el('input', { className: 'cx-rx-input mono', value: (rx.freqHz / 1000).toFixed(3), inputMode: 'decimal', title: 'Frequency in kHz' });
        i.addEventListener('change', () => { const hz = Math.round(Number(i.value) * 1000); if (Number.isFinite(hz) && hz > 0) setFreq(hz); }); box._freq = i; return i; })(),
      el('span', { className: 'mono cx-rx-unit', textContent: 'kHz' }),
      pill('+', () => step(1), 'square'));
    const custom = el('input', { className: 'cx-rx-input mono cx-rx-stepin', value: STEPS.some(([v]) => v === rx.step) ? '' : String(rx.step / 1000), placeholder: 'CUSTOM kHz', inputMode: 'decimal', title: 'Your own step in kHz (e.g. 6.25, 8.33, 50)' });
    const stepRow = el('div', { className: 'body-list cx-rx-steps' }, STEPS.map(([v, label]) => {
      const b = pill(label, () => { rx.step = v; saveStep(v); custom.value = ''; mark(stepRow, b); }); if (v === rx.step) b.classList.add('on'); return b;
    }), custom);
    custom.addEventListener('change', () => { const v = Math.round(Number(custom.value) * 1000); if (v >= 1 && v <= 1e8) { rx.step = v; saveStep(v); mark(stepRow, null); } });
    const modes = rx.local ? LOCAL_MODES : MODES;
    const modeRow = el('div', { className: 'body-list' }, Object.keys(modes).map((mode) => {
      const b = pill(modes[mode].label, () => setMode(mode)); if (mode === rx.mode) b.classList.add('on'); b.dataset.mode = mode; return b;
    }));
    box._modeRow = modeRow;
    const bwRow = el('div', { className: 'cx-rx-bwbox', id: 'cx-bw' });
    box._bwRow = bwRow; renderBw(bwRow);
    const agcRow = el('div', { className: 'body-list' }, ['fast', 'slow', 'off'].map((a) => {
      const b = pill(`AGC ${a.toUpperCase()}`, () => { rx.agc = a; mark(agcRow, b); retune(); }); if (a === rx.agc) b.classList.add('on'); return b;
    }));
    const vol = el('input', { type: 'range', min: '0', max: '1.5', step: '0.05', value: String(rx.volume), className: 'cx-rx-vol' });
    vol.addEventListener('input', () => { rx.volume = Number(vol.value); audio.setVolume(rx.volume); });
    const scanBtn = pill('SCAN FOR SIGNALS', () => scan());
    const results = el('div', { className: 'host-list', id: 'cx-scan' });
    box._results = results;
    box.append(
      el('h3', { textContent: 'RECEIVER' }),
      el('h2', { className: 'sel-name', textContent: rx.name.toUpperCase() }),
      el('div', { className: 'cx-rx-state mono', id: 'cx-state', textContent: 'CONNECTING…' }),
      el('h3', { textContent: 'TUNE' }), freqRow,
      el('p', { className: 'note', textContent: 'Step size:' }), stepRow,
      el('h3', { textContent: 'DEMODULATOR' }), modeRow,
      el('p', { className: 'note', textContent: 'Bandwidth:' }), bwRow,
      agcRow,
      el('div', { className: 'cx-rx-row' }, el('span', { className: 'mono', textContent: 'VOLUME' }), vol),
      el('h3', { textContent: 'SCAN' }), scanBtn, results,
      el('p', { className: 'note', textContent: rx.local ? `Local SDR: one IQ stream feeds the waterfall and the audio; the scan pauses it and sweeps ±2 MHz (rtl_power on an RTL-SDR, stepped captures otherwise).${rx.conv ? ` Through the ${converterLabel(rx.conv)}: every frequency shown is the true (antenna-side) one; the SDR tunes ${toDeviceHz(0, rx.conv) > 0 ? '+' : ''}${(toDeviceHz(0, rx.conv) / 1e6).toFixed(3)} MHz from it.` : ''} Reception only.` : 'KiwiSDR: the receiver scans its own 0–30 MHz view. Public receivers have listener slots and time limits; be a good guest. Reception only.' }),
      badge('reported', rx.local ? 'Your own SDR hardware.' : rx.layer?.credit ?? ''));
    return box;
  }
  /** The bandwidth controls: presets, a slider over the mode's whole range and a value box (all follow the wheel). */
  function renderBw(row) {
    const b = BW[rx.mode] ?? BW.am, max = rx.local ? b.max : Math.min(b.max, KIWI_MAX_BW);
    const presets = b.presets.filter((v) => v <= max);
    const pills = presets.map((bw) => { const p = pill(bwLabel(bw), () => setBw(bw)); p.dataset.bw = String(bw); return p; });
    const slider = el('input', { type: 'range', className: 'cx-rx-bw', min: String(b.min), max: String(max), step: String(b.inc), value: String(rx.bwHz), title: 'Bandwidth' });
    slider.addEventListener('input', () => setBw(Number(slider.value)));
    const val = el('input', { className: 'cx-rx-input mono cx-rx-bwin', value: String(rx.bwHz / 1000), inputMode: 'decimal', title: `Bandwidth in kHz (${bwLabel(b.min)}–${bwLabel(max)})` });
    val.addEventListener('change', () => { const v = Number(val.value) * 1000; if (Number.isFinite(v) && v > 0) setBw(v); });
    row.replaceChildren(el('div', { className: 'body-list' }, pills), el('div', { className: 'cx-rx-row' }, el('span', { className: 'mono', textContent: bwLabel(b.min) }), slider, el('span', { className: 'mono', textContent: bwLabel(max) }), val, el('span', { className: 'mono cx-rx-unit', textContent: 'kHz' })));
    row._sync = () => { slider.value = String(rx.bwHz); if (document.activeElement !== val) val.value = String(rx.bwHz / 1000); for (const p of pills) p.classList.toggle('on', Number(p.dataset.bw) === rx.bwHz); };
    row._sync();
  }
  function setBw(hz) {
    const bw = clampBw(rx.mode, hz, rx.local);
    if (bw === rx.bwHz) return;
    rx.bwHz = bw; saveBw(rx.mode, bw);
    box?._bwRow?._sync?.();
    audio.setBand(Math.min(bw, 24000) + 1000); updateReadout(); retune();
  }
  const bwFor = (mode) => clampBw(mode, savedBw()[mode] ?? (BW[mode] ?? BW.am).def, rx.local);
  const mark = (row, on) => { for (const b of row.querySelectorAll('.pill')) b.classList.toggle('on', b === on); };

  // ---- tuning -------------------------------------------------------------------------------------
  let box = null;
  function setFreq(hz) {
    rx.freqHz = Math.max(rx.minHz, Math.min(rx.maxHz, Math.round(hz)));
    if (box?._freq) box._freq.value = (rx.freqHz / 1000).toFixed(3);
    updateReadout(); retune();
  }
  const step = (dir) => setFreq(rx.freqHz + dir * rx.step);
  function setMode(mode) {
    rx.mode = mode; rx.bwHz = bwFor(mode);
    if (box?._modeRow) for (const b of box._modeRow.querySelectorAll('.pill')) b.classList.toggle('on', b.dataset.mode === mode);
    if (box?._bwRow) renderBw(box._bwRow);
    audio.setBand(Math.min(rx.bwHz, 24000) + 1000); updateReadout(); retune();
  }
  function retune() {
    if (ws?.readyState !== 1) return;
    rx.playing = true;
    const msg = rx.local ? { type: 'tune', freqHz: toDeviceHz(rx.freqHz, rx.conv), mode: rx.mode, bwHz: rx.bwHz, agc: rx.agc, gain: null, driver: rx.driver, converter: rx.convSetting } : { type: 'tune', freqHz: rx.freqHz, mode: rx.mode, bwHz: rx.bwHz, agc: rx.agc };
    ws.send(JSON.stringify(msg));
  }

  // ---- scan ---------------------------------------------------------------------------------------
  async function scan() {
    const results = box?._results; if (!results) return;
    results.replaceChildren(el('p', { className: 'note', textContent: 'SCANNING…' }));
    let signals = [];
    if (rx.local) {
      if (ws?.readyState !== 1) { results.replaceChildren(el('p', { className: 'warn', textContent: 'The link to the SDR is not open.' })); return; }
      const from = toDeviceHz(Math.max(rx.minHz, rx.freqHz - 2e6), rx.conv), to = toDeviceHz(Math.min(rx.maxHz, rx.freqHz + 2e6), rx.conv);
      const reply = new Promise((resolve) => { rx.onScan = resolve; setTimeout(() => resolve(null), 60000); });
      ws.send(JSON.stringify({ type: 'scan', fromHz: Math.min(from, to), toHz: Math.max(from, to) }));
      const j = await reply;
      if (!rx || !box?._results) return;
      if (!j) { results.replaceChildren(el('p', { className: 'warn', textContent: 'Sweep failed (is the device busy?).' })); return; }
      signals = (j.signals ?? []).map((s) => ({ ...s, freqHz: toAntennaHz(s.freqHz, rx.conv) })); // back to the antenna side
    } else {
      if (!wfBuf.length) { results.replaceChildren(el('p', { className: 'note', textContent: 'No waterfall yet — give it a moment.' })); return; }
      const n = wfBuf[0].length, avg = new Float32Array(n); // average the recent full-span rows
      for (const r of wfBuf) for (let i = 0; i < n; i++) avg[i] += r[i] / wfBuf.length;
      signals = findSignals(avg, { startHz: 0, spanHz: KIWI_SPAN, snrDb: 12 });
    }
    if (!signals.length) { results.replaceChildren(el('p', { className: 'note', textContent: 'No clear signals stood out.' })); return; }
    results.replaceChildren(...signals.slice(0, 20).map((s) => {
      const b = el('button', { className: 'host-row', onclick: () => { const m = suggestMode(s.freqHz); setMode(m === 'wbfm' && !rx.local ? 'nbfm' : m); setFreq(s.freqHz); } },
        el('span', { textContent: formatFrequency(s.freqHz) }),
        el('span', { className: 'mono', textContent: `${s.snr.toFixed(0)} dB${bandName(s.freqHz) ? ` · ${bandName(s.freqHz)}` : ''}` }));
      return b;
    }));
  }

  // ---- lifecycle ----------------------------------------------------------------------------------
  function open(receiver, setScreen) {
    close();
    const conv = receiver.local && converting(converter()) ? converter() : null;
    const devRange = [receiver.minHz ?? (receiver.local ? 24e6 : 0), receiver.maxHz ?? (receiver.local ? 1766e6 : 30e6)];
    const [minHz, maxHz] = conv ? antennaRange(devRange, conv) : devRange; // the dial works in antenna-side frequencies
    const startHz = receiver.local ? Math.min(Math.max(conv ? 9.6e6 : 98.1e6, minHz), maxHz) : 9.6e6;
    rx = { ...receiver, conv, convSetting: receiver.local ? converter() : null, driver: receiver.driver ?? 'rtl', minHz, maxHz, freqHz: startHz, mode: 'am', bwHz: 6000, agc: 'fast', gain: 50, volume: 0.9, rate: 12000, step: savedStep() ?? 5000, rssi: null, playing: false, wfMin: -110, wfMax: -20, axis: null, floor: null, fake: !!receiver.fake, closeHint: null };
    rx.mode = receiver.local ? suggestMode(rx.freqHz) : 'am';
    if (rx.mode === 'wbfm' && !receiver.local) rx.mode = 'nbfm';
    rx.bwHz = bwFor(rx.mode);
    audio.resume(); audio.setBand(Math.min(rx.bwHz, 24000) + 1000); audio.setVolume(rx.volume);
    renderScreen(setScreen);
    onPanel?.();
    try { ws = new WebSocket(wsUrl(receiver)); } catch { setState('COULD NOT OPEN THE LINK'); return; }
    ws.binaryType = 'arraybuffer';
    ws.onmessage = (e) => {
      if (typeof e.data !== 'string') return onFrame(e.data);
      let m; try { m = JSON.parse(e.data); } catch { return; }
      if (m.type === 'open') { if (m.rate) rx.rate = m.rate; setState('LINK OPEN · RECEIVING'); retune(); } // KiwiSDR upstream open
      else if (m.type === 'ready') retune(); // local SDR link up: start the device
      else if (m.type === 'tuned') { rx.rate = m.audioRate || rx.rate; if (rx.fake !== !!m.fake) { rx.fake = !!m.fake; renderLegend(); } setState(`LINK OPEN · RECEIVING${m.fake ? ' · SIMULATED' : ''} · ${(m.tool ?? '').toUpperCase()} ${(m.rateHz / 1e3).toFixed(0)} kS/s`); }
      else if (m.type === 'scanning') setState('SCANNING · AUDIO PAUSED');
      else if (m.type === 'scan') { rx.onScan?.(m); rx.onScan = null; }
      else if (m.type === 'error') setState(`RECEIVER: ${m.message}`);
      else if (m.type === 'closed') setState(rx.closeHint ?? `RECEIVER CLOSED THE LINK${m.reason ? ` · ${m.reason}` : m.code && ![1000, 1005, 1006].includes(m.code) ? ` (${m.code})` : ''}`);
    };
    ws.onerror = () => setState('COULD NOT REACH THE RECEIVER');
    ws.onclose = () => { if (rx) setState(rx.closeHint ?? 'LINK CLOSED'); };
  }
  function setState(t) { const s = document.getElementById('cx-state'); if (s) s.textContent = t; }
  function close() {
    if (ws) { try { ws.close(); } catch { /* gone */ } ws = null; }
    cancelAnimationFrame(pollRaf);
    rx?.onScan?.(null);
    wfBuf.length = 0; rx = null; box = null; wf = null; wfCtx = null; spec = null; specCtx = null; axisEl = null; legendEl = null;
  }

  return {
    /** Open a receiver: renders the waterfall via setScreen() and returns the control panel. */
    open(receiver, setScreen) { open(receiver, setScreen); box = controls(); return box; },
    close,
    /** Voice/commands: tune to a frequency (Hz), or scan for signals. */
    tune(hz) { if (rx && Number.isFinite(hz)) { setFreq(hz); return true; } return false; },
    scan() { if (rx) { scan(); return true; } return false; },
    get active() { return !!rx; },
    /** Voice: change the demodulator ('am', 'usb', 'lsb', 'cw', 'nbfm'; 'wbfm' on the local SDR). */
    mode(m) { if (rx && (rx.local ? LOCAL_MODES : MODES)[m]) { setMode(m); return true; } return false; },
    get info() { return rx ? { freqHz: rx.freqHz, mode: rx.mode, name: rx.name } : null; },
  };
}
