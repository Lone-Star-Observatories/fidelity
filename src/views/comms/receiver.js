// COMMS RF receiver console (#69): listen to a public SDR receiver from inside the ship. Reception
// only — it tunes and plays what the receiver already hears, and never transmits.
//
//   KiwiSDR (ws /api/rf/kiwi): the backend relays the receiver's audio (SND) and waterfall (W/F).
//     The console tunes (frequency, demodulator, bandwidth, AGC), shows a scrolling waterfall, and
//     scans the receiver's whole 0–30 MHz view for clear signals to jump to.
//   Local RTL-SDR (ws /api/rf/local): audio only (no waterfall); scanning uses the backend sweep.
//   The audio runs through the shared COMMS chain (jitter buffer, hiss filter, auto-notch).

import { kiwiTag, parseKiwiMsg, parseKiwiSnd, parseKiwiWf, MODES, passband, findSignals, formatFrequency, bandName, suggestMode } from '../../data/rf.js';

const el = (tag, props = {}, ...kids) => {
  const e = Object.assign(document.createElement(tag), props);
  for (const k of kids.flat()) if (k != null && k !== false) e.append(k);
  return e;
};
const MODE_BW = { am: [4000, 6000, 9800], usb: [1800, 2400, 2800], lsb: [1800, 2400, 2800], cw: [200, 500], nbfm: [8000, 12000] };
const STEPS = [[100, '100 Hz'], [1000, '1 kHz'], [5000, '5 kHz'], [9000, '9 kHz'], [100000, '100 kHz'], [1000000, '1 MHz']];
// KiwiSDR waterfall colour ramp (cold → hot), dBm clamped to [min, max]
const RAMP = [[0, 0, 40], [0, 40, 120], [0, 120, 160], [40, 180, 120], [200, 200, 40], [255, 120, 20], [255, 40, 40]];
function heat(db, min, max) {
  const t = Math.max(0, Math.min(1, (db - min) / (max - min))) * (RAMP.length - 1), i = Math.min(RAMP.length - 2, Math.floor(t)), f = t - i;
  return [0, 1, 2].map((c) => Math.round(RAMP[i][c] + (RAMP[i + 1][c] - RAMP[i][c]) * f));
}

/** A receiver console bound to the COMMS audio chain. mount() opens the link; it renders into `screen` (waterfall) and `console` (controls). */
export function createReceiver({ audio, pill, badge, onPanel }) {
  let rx = null, ws = null, wf = null, wfCtx = null, pollRaf = 0;
  const KIWI_SPAN = 30e6; // a Kiwi's full view, used for the waterfall and scan

  function wsUrl(receiver) {
    const base = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`;
    return receiver.local ? `${base}/api/rf/local` : `${base}/api/rf/kiwi?r=${encodeURIComponent(receiver.url)}`;
  }

  // ---- audio + waterfall from the receiver ---------------------------------------------------------
  const wfBuf = []; // recent full-span waterfall rows (Float32 dBm) for the scan
  function onFrame(data) {
    const { tag, body } = kiwiTag(new Uint8Array(data));
    if (tag === 'MSG') { const m = parseKiwiMsg(body); if (m.audio_rate) rx.rate = Number(m.audio_rate) || rx.rate; return; }
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
    }
  }

  function drawWaterfallRow(db) {
    if (!wf || !wfCtx) return;
    const W = wf.width, H = wf.height;
    wfCtx.drawImage(wf, 0, 0, W, H - 1, 0, 1, W, H - 1); // scroll down one line
    const row = wfCtx.createImageData(W, 1), n = db.length;
    for (let x = 0; x < W; x++) {
      const [r, g, b] = heat(db[Math.floor((x / W) * n)] ?? -120, rx.wfMin, rx.wfMax);
      row.data.set([r, g, b, 255], x * 4);
    }
    wfCtx.putImageData(row, 0, 0);
    // tuning cursor
    const cx = Math.round((rx.freqHz / KIWI_SPAN) * W);
    wfCtx.fillStyle = 'rgba(255,255,255,0.6)';
    wfCtx.fillRect(cx, 0, 1, 2);
  }

  // ---- the viewscreen (waterfall) and the control console -----------------------------------------
  function renderScreen(setScreen) {
    const canvas = el('canvas', { className: 'cx-wf', width: 1024, height: 240 });
    const legend = el('div', { className: 'cx-wf-legend mono' });
    setScreen(el('div', { className: 'cx-rx-screen' },
      el('div', { className: 'cx-rx-read' },
        el('div', { className: 'cx-rx-freq mono', id: 'cx-freq' }, formatFrequency(rx.freqHz)),
        el('div', { className: 'cx-rx-sub mono', id: 'cx-sub' }, `${rx.name.toUpperCase()} · ${rx.mode.toUpperCase()}`)),
      canvas, legend));
    wf = canvas; wfCtx = canvas.getContext('2d');
    wfCtx.fillStyle = '#04070c'; wfCtx.fillRect(0, 0, canvas.width, canvas.height);
    legend.textContent = rx.local ? 'LOCAL SDR · AUDIO ONLY (NO WATERFALL)' : '0–30 MHz · DRAG THE WATERFALL TO TUNE';
    if (!rx.local) {
      const tuneFromX = (e) => { const b = canvas.getBoundingClientRect(); setFreq(Math.round(((e.clientX - b.left) / b.width) * KIWI_SPAN)); };
      canvas.style.cursor = 'crosshair';
      canvas.addEventListener('click', tuneFromX);
    }
    updateReadout();
  }
  function updateReadout() {
    const f = document.getElementById('cx-freq'), s = document.getElementById('cx-sub');
    if (f) f.textContent = formatFrequency(rx.freqHz);
    if (s) s.textContent = `${rx.name.toUpperCase()} · ${rx.mode.toUpperCase()} · ${rx.bwHz >= 1000 ? `${(rx.bwHz / 1000).toFixed(1)} kHz` : `${rx.bwHz} Hz`}${rx.rssi != null ? ` · ${rx.rssi.toFixed(0)} dBm` : ''}${bandName(rx.freqHz) ? ` · ${bandName(rx.freqHz)}` : ''}`;
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
    const stepRow = el('div', { className: 'body-list cx-rx-steps' }, STEPS.map(([v, label]) => {
      const b = pill(label, () => { rx.step = v; mark(stepRow, b); }); if (v === rx.step) b.classList.add('on'); return b;
    }));
    const modeRow = el('div', { className: 'body-list' }, Object.keys(MODES).map((mode) => {
      const b = pill(MODES[mode].label, () => setMode(mode)); if (mode === rx.mode) b.classList.add('on'); b.dataset.mode = mode; return b;
    }));
    box._modeRow = modeRow;
    const bwRow = el('div', { className: 'body-list', id: 'cx-bw' });
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
      el('p', { className: 'note', textContent: rx.local ? 'Local SDR: the backend sweeps the band with rtl_power. Reception only — nothing is transmitted.' : 'KiwiSDR: the receiver scans its own 0–30 MHz view. Public receivers have listener slots and time limits; be a good guest. Reception only.' }),
      badge('reported', rx.local ? 'Your own SDR hardware.' : rx.layer?.credit ?? ''));
    return box;
  }
  function renderBw(row) {
    const list = MODE_BW[rx.mode] ?? [passband(rx.mode).high - passband(rx.mode).low];
    row.replaceChildren(...list.map((bw) => { const b = pill(bw >= 1000 ? `${(bw / 1000).toFixed(1)} kHz` : `${bw} Hz`, () => { rx.bwHz = bw; mark(row, b); retune(); audio.setBand(bw + 1000); }); if (bw === rx.bwHz) b.classList.add('on'); return b; }));
  }
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
    rx.mode = mode; rx.bwHz = (MODE_BW[mode] ?? [6000])[1] ?? (MODE_BW[mode] ?? [6000])[0];
    if (box?._modeRow) for (const b of box._modeRow.querySelectorAll('.pill')) b.classList.toggle('on', b.dataset.mode === mode);
    if (box?._bwRow) renderBw(box._bwRow);
    audio.setBand(rx.bwHz + 1000); updateReadout(); retune();
  }
  function retune() {
    if (ws?.readyState !== 1) return;
    rx.playing = true;
    const msg = rx.local ? { type: 'tune', freqHz: rx.freqHz, mode: rx.mode, gain: null, driver: rx.driver } : { type: 'tune', freqHz: rx.freqHz, mode: rx.mode, bwHz: rx.bwHz, agc: rx.agc };
    ws.send(JSON.stringify(msg));
  }

  // ---- scan ---------------------------------------------------------------------------------------
  async function scan() {
    const results = box?._results; if (!results) return;
    results.replaceChildren(el('p', { className: 'note', textContent: 'SCANNING…' }));
    let signals = [];
    if (rx.local) {
      try {
        const j = await fetch(`/api/rf/local/scan?from=${Math.max(rx.minHz, rx.freqHz - 2e6)}&to=${Math.min(rx.maxHz, rx.freqHz + 2e6)}&driver=${rx.driver}`).then((r) => r.json());
        signals = j.signals ?? [];
      } catch { results.replaceChildren(el('p', { className: 'warn', textContent: 'Sweep failed (is the dongle busy?).' })); return; }
    } else {
      if (!wfBuf.length) { results.replaceChildren(el('p', { className: 'note', textContent: 'No waterfall yet — give it a moment.' })); return; }
      const n = wfBuf[0].length, avg = new Float32Array(n); // average the recent full-span rows
      for (const r of wfBuf) for (let i = 0; i < n; i++) avg[i] += r[i] / wfBuf.length;
      signals = findSignals(avg, { startHz: 0, spanHz: KIWI_SPAN, snrDb: 12 });
    }
    if (!signals.length) { results.replaceChildren(el('p', { className: 'note', textContent: 'No clear signals stood out.' })); return; }
    results.replaceChildren(...signals.slice(0, 20).map((s) => {
      const b = el('button', { className: 'host-row', onclick: () => { setMode(suggestMode(s.freqHz) === 'wbfm' ? 'nbfm' : suggestMode(s.freqHz)); setFreq(s.freqHz); } },
        el('span', { textContent: formatFrequency(s.freqHz) }),
        el('span', { className: 'mono', textContent: `${s.snr.toFixed(0)} dB${bandName(s.freqHz) ? ` · ${bandName(s.freqHz)}` : ''}` }));
      return b;
    }));
  }

  // ---- lifecycle ----------------------------------------------------------------------------------
  function open(receiver, setScreen) {
    close();
    const minHz = receiver.minHz ?? (receiver.local ? 24e6 : 0), maxHz = receiver.maxHz ?? (receiver.local ? 1766e6 : 30e6);
    const startHz = receiver.local ? Math.min(Math.max(98.1e6, minHz), maxHz) : 9.6e6;
    rx = { ...receiver, driver: receiver.driver ?? 'rtl', minHz, maxHz, freqHz: startHz, mode: 'am', bwHz: 6000, agc: 'fast', gain: 50, volume: 0.9, rate: 12000, step: 5000, rssi: null, playing: false, wfMin: -110, wfMax: -20 };
    rx.mode = receiver.local ? suggestMode(rx.freqHz) : 'am';
    if (rx.mode === 'wbfm') rx.mode = 'nbfm';
    rx.bwHz = (MODE_BW[rx.mode] ?? [6000])[1] ?? 6000;
    audio.resume(); audio.setBand(rx.bwHz + 1000); audio.setVolume(rx.volume);
    renderScreen(setScreen);
    onPanel?.();
    try { ws = new WebSocket(wsUrl(receiver)); } catch { setState('COULD NOT OPEN THE LINK'); return; }
    ws.binaryType = 'arraybuffer';
    ws.onmessage = (e) => {
      if (typeof e.data !== 'string') return onFrame(e.data);
      let m; try { m = JSON.parse(e.data); } catch { return; }
      if (m.type === 'open') { if (m.rate) rx.rate = m.rate; setState('LINK OPEN · RECEIVING'); retune(); }
      else if (m.type === 'error') setState(`RECEIVER: ${m.message}`);
      else if (m.type === 'closed') setState('RECEIVER CLOSED THE LINK');
    };
    ws.onerror = () => setState('COULD NOT REACH THE RECEIVER');
    ws.onclose = () => { if (rx) setState('LINK CLOSED'); };
  }
  function setState(t) { const s = document.getElementById('cx-state'); if (s) s.textContent = t; }
  function close() {
    if (ws) { try { ws.close(); } catch { /* gone */ } ws = null; }
    cancelAnimationFrame(pollRaf);
    wfBuf.length = 0; rx = null; box = null; wf = null; wfCtx = null;
  }

  return {
    /** Open a receiver: renders the waterfall via setScreen() and returns the control panel. */
    open(receiver, setScreen) { open(receiver, setScreen); box = controls(); return box; },
    close,
    /** Voice/commands: tune to a frequency (Hz), or scan for signals. */
    tune(hz) { if (rx && Number.isFinite(hz)) { setFreq(hz); return true; } return false; },
    scan() { if (rx) { scan(); return true; } return false; },
    get active() { return !!rx; },
    get info() { return rx ? { freqHz: rx.freqHz, mode: rx.mode, name: rx.name } : null; },
  };
}
