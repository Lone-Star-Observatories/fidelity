// COMMS: a WebSDR receiver in the main viewer (#69). WebSDR (PA3FWM's software) has no open audio
// API and we do not reverse-engineer or relay its audio: the operator's own page opens in an iframe,
// tuned by the parameter the page reads itself (?tune=7074usb, src/data/websdr.js). Our dial, band
// and mode controls (and the Computer's "tune") rebuild that URL; the page reloads at the new
// frequency. The backend checks once (cached) whether the page may be framed; if the operator
// forbids it (X-Frame-Options / CSP frame-ancestors) the console links out instead.
// The browser loads only /api/* and the operator's own page (in the iframe).

import { formatFrequency, bandName, suggestMode } from '../../data/rf.js';
import { websdrTuneUrl, websdrTuneParam, websdrBandFor } from '../../data/websdr.js';

const el = (tag, props = {}, ...kids) => {
  const e = Object.assign(document.createElement(tag), props);
  for (const k of kids.flat()) if (k != null && k !== false) e.append(k);
  return e;
};
const MODES = [['am', 'AM'], ['nbfm', 'FM'], ['usb', 'USB'], ['lsb', 'LSB'], ['cw', 'CW']];
const STEPS = [[100, '100 Hz'], [1000, '1 kHz'], [5000, '5 kHz'], [10000, '10 kHz'], [100000, '100 kHz']];
const PAGE_W = 1100; // the WebSDR page is laid out ~1024 px wide; scale it down to the viewer
const mhz = (v) => (v < 1 ? `${(v * 1000).toFixed(0)} kHz` : `${Number(v.toFixed(3))} MHz`);

/** Where to start on a receiver: 7.074 MHz USB if it covers 40 m, else the middle of its first band. */
export function websdrStart(bands) {
  if (websdrBandFor(bands, 7.074e6)) return { freqHz: 7.074e6, mode: 'usb' };
  const b = bands?.[0];
  if (!b) return { freqHz: 7.074e6, mode: 'usb' };
  const hz = Math.round(((b.l + b.h) / 2) * 1e6 / 1000) * 1000, m = suggestMode(hz);
  return { freqHz: hz, mode: m === 'wbfm' ? 'nbfm' : m };
}

export function createWebSdr({ pill, badge, onPanel }) {
  let rx = null, box = null, frame = null, reloadTimer = 0, resizeObs = null, setScreenFn = null;

  const credit = () => `${rx.name} · ${rx.host} · WebSDR software by PA3FWM; the receiver and its page are the operator's own.`;
  const tunedUrl = () => websdrTuneUrl(rx.url, rx);

  function overlay() {
    return el('div', { className: 'cx-overlay mono' }, `WEBSDR · ${rx.name.toUpperCase()} · ${rx.host.toUpperCase()} · OPERATOR'S OWN PAGE`, badge('reported', credit()));
  }
  function showEmbed() {
    const iframe = el('iframe', { className: 'cx-websdr', src: tunedUrl(), title: `WebSDR: ${rx.name}`, allow: 'autoplay', referrerPolicy: 'no-referrer' });
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups'); // never navigates our page
    const wrap = el('div', { className: 'cx-websdr-wrap' }, iframe);
    frame = iframe;
    const fit = () => { const w = wrap.clientWidth, h = wrap.clientHeight; if (!w) return; const k = Math.min(1, w / PAGE_W); iframe.style.width = `${PAGE_W}px`; iframe.style.height = `${Math.ceil(h / k)}px`; iframe.style.transform = `scale(${k})`; };
    resizeObs?.disconnect(); resizeObs = new ResizeObserver(fit); resizeObs.observe(wrap);
    setScreenFn(wrap, overlay());
    requestAnimationFrame(fit);
  }
  function showLinkOut(why) {
    frame = null;
    setScreenFn(el('div', { className: 'cx-banner' }, el('div', { className: 'cx-big', textContent: 'RECEIVER SELECTED' }),
      el('div', { className: 'cx-small mono', textContent: rx.name.toUpperCase() }),
      el('div', { className: 'cx-small mono', textContent: why }),
      el('a', { className: 'pill', href: tunedUrl(), target: '_blank', rel: 'noopener noreferrer', textContent: `OPEN ON THE OPERATOR'S PAGE · ${formatFrequency(rx.freqHz)} ${rx.mode === 'nbfm' ? 'FM' : rx.mode.toUpperCase()} ↗` })), overlay());
  }

  async function checkFraming() {
    const token = rx;
    setScreenFn(el('div', { className: 'cx-banner' }, el('div', { className: 'cx-big', textContent: 'CONTACTING RECEIVER' }), el('div', { className: 'cx-small mono', textContent: rx.host.toUpperCase() })));
    let v;
    try {
      const r = await fetch(`/api/rf/websdr/frame?u=${encodeURIComponent(rx.url)}`);
      v = await r.json();
      if (!r.ok) v = { embeddable: false, reason: v.error ?? `HTTP ${r.status}`, unchecked: true };
    } catch (e) { v = { embeddable: false, reason: e.message, unchecked: true }; }
    if (rx !== token) return;
    rx.framing = v;
    if (v.embeddable) showEmbed();
    else { rx.linkWhy = v.unchecked ? `COULD NOT CHECK THE PAGE (${String(v.reason).toUpperCase()}): IT OPENS ON THE OPERATOR'S SITE` : `THE OPERATOR'S PAGE REFUSES EMBEDDING (${String(v.reason).toUpperCase()}): IT OPENS ON THEIR SITE`; showLinkOut(rx.linkWhy); }
    renderState();
  }

  // ---- tuning: rebuild the URL; the page reloads at the new frequency (debounced) -----------------------
  function retune() {
    updateReadout();
    clearTimeout(reloadTimer);
    if (frame) reloadTimer = setTimeout(() => { if (frame) frame.src = tunedUrl(); }, 700);
    else if (rx.linkWhy) showLinkOut(rx.linkWhy); // the link-out button carries the new tuning
  }
  function setFreq(hz) { rx.freqHz = Math.max(1000, Math.round(hz)); if (box?._freq) box._freq.value = (rx.freqHz / 1000).toFixed(3); retune(); }
  function setMode(m) { rx.mode = m; if (box?._modes) for (const b of box._modes.querySelectorAll('.pill')) b.classList.toggle('on', b.dataset.mode === m); retune(); }

  function updateReadout() {
    if (!box) return;
    const band = websdrBandFor(rx.bands, rx.freqHz);
    box._read.textContent = `${formatFrequency(rx.freqHz)} · ${rx.mode === 'nbfm' ? 'FM' : rx.mode.toUpperCase()}${bandName(rx.freqHz) ? ` · ${bandName(rx.freqHz)}` : ''}`;
    box._param.textContent = `?tune=${websdrTuneParam(rx)}`;
    box._warn.textContent = band ? '' : 'Outside this receiver\'s bands: its page will stay where it was.';
    if (box._open) box._open.href = tunedUrl();
    if (box._bands) for (const b of box._bands.querySelectorAll('.pill')) b.classList.toggle('on', b._band === band);
  }
  function renderState() {
    if (!box) return;
    const f = rx.framing;
    box._state.textContent = !f ? 'CHECKING WHETHER THE PAGE MAY BE EMBEDDED…' : f.embeddable ? 'ON SCREEN · THE OPERATOR\'S PAGE · CLICK IT ONCE TO START ITS AUDIO' : 'LINK OUT · THE PAGE CANNOT BE EMBEDDED';
  }

  function controls() {
    const b = el('div', { className: 'cx-rx' });
    const step = (dir) => setFreq(rx.freqHz + dir * rx.step);
    const freq = el('input', { className: 'cx-rx-input mono', value: (rx.freqHz / 1000).toFixed(3), inputMode: 'decimal', title: 'Frequency in kHz' });
    freq.addEventListener('change', () => { const hz = Math.round(Number(freq.value) * 1000); if (Number.isFinite(hz) && hz > 0) setFreq(hz); });
    b._freq = freq;
    const steps = el('div', { className: 'body-list cx-rx-steps' }, STEPS.map(([v, label]) => { const p = pill(label, () => { rx.step = v; for (const q of steps.querySelectorAll('.pill')) q.classList.toggle('on', q === p); }); if (v === rx.step) p.classList.add('on'); return p; }));
    const modes = el('div', { className: 'body-list' }, MODES.map(([m, label]) => { const p = pill(label, () => setMode(m)); p.dataset.mode = m; if (m === rx.mode) p.classList.add('on'); return p; }));
    b._modes = modes;
    const bands = el('div', { className: 'body-list' }, (rx.bands ?? []).map((band) => {
      const p = pill(`${mhz(band.l)}–${mhz(band.h)}`, () => { const hz = Math.round(((band.l + band.h) / 2) * 1e6 / 1000) * 1000, m = suggestMode(hz); setMode(m === 'wbfm' ? 'nbfm' : m); setFreq(hz); });
      p._band = band; p.title = band.a ? `Antenna: ${band.a}` : ''; return p;
    }));
    b._bands = bands;
    b._read = el('div', { className: 'cx-rx-freq mono' });
    b._param = el('div', { className: 'mono cx-rx-unit' });
    b._warn = el('p', { className: 'warn' });
    b._state = el('div', { className: 'cx-rx-state mono' });
    b._open = el('a', { className: 'pill', href: tunedUrl(), target: '_blank', rel: 'noopener noreferrer', textContent: 'OPERATOR\'S PAGE ↗' });
    const info = el('dl');
    const row = (k, v, tier, note) => info.append(el('dt', { textContent: k }), el('dd', { textContent: v }), badge(tier, note));
    row('TYPE', 'WEBSDR (PUBLIC)', 'reported', credit());
    if (rx.info?.qth) row('LOCATOR', rx.info.qth, 'reported', 'Maidenhead grid square, as listed.');
    row('LISTENING', String(rx.info?.users ?? 0), 'reported', 'Listeners when the list was taken.');
    b.append(
      el('h3', { textContent: 'RECEIVER · WEBSDR' }), el('h2', { className: 'sel-name', textContent: rx.name.toUpperCase() }), b._state, info,
      el('h3', { textContent: 'TUNE' }), b._read,
      el('div', { className: 'cx-rx-row' }, pill('−', () => step(-1), 'square'), freq, el('span', { className: 'mono cx-rx-unit', textContent: 'kHz' }), pill('+', () => step(1), 'square')),
      el('p', { className: 'note', textContent: 'Step size:' }), steps,
      el('h3', { textContent: 'MODE' }), modes,
      rx.bands?.length ? el('h3', { textContent: `BANDS · ${rx.bands.length}` }) : null, bands,
      b._param, b._warn,
      el('div', { className: 'body-list' }, b._open),
      el('p', { className: 'note', textContent: 'The operator\'s own WebSDR page, in the main viewer and tuned through its ?tune= link: each change reloads it at the new frequency. Its audio plays from their page (not the COMMS audio chain); nothing is relayed or recorded here. Reception only.' }),
      badge('reported', credit()));
    box = b;
    updateReadout(); renderState();
    return b;
  }

  function close() {
    clearTimeout(reloadTimer); resizeObs?.disconnect(); resizeObs = null;
    if (frame) { try { frame.src = 'about:blank'; } catch { /* gone */ } }
    rx = null; box = null; frame = null;
  }

  return {
    /** Open a WebSDR from its map marker; renders into the viewer via setScreen and returns the finder console. */
    open(receiver, setScreen) {
      close();
      setScreenFn = setScreen;
      let host = '';
      try { host = new URL(receiver.url).host; } catch { /* listed URLs are http(s) */ }
      rx = { name: receiver.name, url: receiver.url, host, bands: receiver.info?.bands ?? [], info: receiver.info ?? {}, step: 1000, framing: null, ...websdrStart(receiver.info?.bands) };
      const c = controls();
      checkFraming();
      onPanel?.();
      return c;
    },
    close,
    tune(hz) { if (rx && Number.isFinite(hz) && hz > 0) { setFreq(hz); return true; } return false; },
    mode(m) { const k = m === 'fm' || m === 'wbfm' ? 'nbfm' : m; if (rx && MODES.some(([x]) => x === k)) { setMode(k); return true; } return false; },
    get active() { return !!rx; },
    get info() { return rx ? { freqHz: rx.freqHz, mode: rx.mode, name: rx.name, embedded: !!frame } : null; },
  };
}
