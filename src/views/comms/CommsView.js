// COMMS (#69): Sector 001's communications station. Reception only.
//
//   SUBSPACE: signals carried at light speed over the internet: radio stations, traffic cameras,
//     webcams and live video on the Earth map. The viewscreen stays dark until a station is hailed:
//     HAILING → SIGNAL RECEIVED → "ON SCREEN?" when it has video (yes / no, or "on screen" to the
//     computer; ALWAYS ON SCREEN skips the question). Without video, or declined, the audio plays and
//     the finder (right panel) shows the station, its links and what is playing.
//   RF: radio reception. Public KiwiSDR receivers (0–30 MHz) and a local SDR (RTL-SDR, 24–1766 MHz)
//     at the observer's location are on the map, with the receiver's details in the finder; the
//     receiver console (dial, waterfall, scan) is still to come. A transmit-capable device is
//     reported but nothing transmits.

import { createSignalsMap } from '../../panels/signalsmap.js';
import { createCommsAudio } from './audio.js';
import { stationMedia } from '../../data/rf.js';

const STANDALONE = import.meta.env?.MODE === 'standalone';
const el = (tag, props = {}, ...kids) => {
  const e = Object.assign(document.createElement(tag), props);
  for (const k of kids.flat()) if (k != null && k !== false) e.append(k);
  return e;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function createCommsView(container, { badge, pill, settings, onPanel, toast }) {
  const audio = createCommsAudio();
  let mode = 'subspace', station = null, prompt = null, devices = null, receiver = null, hailToken = 0;
  const radioEl = el('audio', { preload: 'none', crossOrigin: 'anonymous' });

  // ---- layout --------------------------------------------------------------------------------
  const modeBtns = {};
  const head = el('div', { className: 'cx-head' },
    el('h2', { textContent: 'COMMS · SECTOR 001' }),
    el('div', { className: 'body-list cx-modes' }, ...[['subspace', 'SUBSPACE RECEPTION'], ['rf', 'RF RECEPTION']].map(([id, label]) => (modeBtns[id] = pill(label, () => setMode(id))))),
    el('span', { className: 'cx-dev mono' }));
  const subMap = createSignalsMap({ only: ['stations', 'radio', 'traffic', 'trafficcams', 'worldcams', 'video'], title: 'SUBSPACE · STATIONS ON EARTH', onPick: (id, m, l) => hail(id, m, l), pickLabel: () => 'HAIL' });
  const rfMap = createSignalsMap({ only: ['websdr', 'kiwisdr'], title: 'RF · RECEIVERS', onPick: (id, m, l) => selectReceiver(id, m, l), pickLabel: () => 'SELECT',
    extra: [{ id: 'localsdr', label: 'LOCAL SDR', colour: '#66ff99', kind: 'sdr', markers: [], credit: 'This machine (rtl-sdr tools), at the observer location set in FROM EARTH.', licence: 'Your hardware' }] });
  const screen = el('div', { className: 'cx-screen' });
  const screenFrame = el('div', { className: 'cx-screen-frame' }, screen, el('div', { className: 'cx-screen-label mono', textContent: 'MAIN VIEWER' }));
  const consoleBox = el('div', { className: 'cx-console' });
  const mapBox = el('div', { className: 'cx-map' });
  container.replaceChildren(el('div', { className: 'cx-wrap' }, head, mapBox, screenFrame, consoleBox));

  // ---- viewscreen ---------------------------------------------------------------------------------
  const setScreen = (...kids) => screen.replaceChildren(...kids);
  const banner = (big, small, cls = '') => el('div', { className: `cx-banner ${cls}` }, el('div', { className: 'cx-big', textContent: big }), small ? el('div', { className: 'cx-small mono', textContent: small }) : null);
  function idle() { setScreen(el('div', { className: 'cx-idle mono', textContent: mode === 'subspace' ? 'NO SIGNAL · HAIL A STATION ON THE MAP' : 'NO RECEIVER · TUNE IN TO ONE ON THE MAP' })); }
  // audio-only: a spectrum bar display
  let vizRaf = 0;
  function visualiser(label) {
    const c = el('canvas', { className: 'cx-viz' });
    setScreen(el('div', { className: 'cx-audio' }, banner('AUDIO CHANNEL OPEN', label), c));
    cancelAnimationFrame(vizRaf);
    const draw = () => {
      if (!c.isConnected) return;
      vizRaf = requestAnimationFrame(draw);
      const s = audio.spectrum(), W = (c.width = c.clientWidth), H = (c.height = c.clientHeight), g = c.getContext('2d');
      g.clearRect(0, 0, W, H);
      if (!s) return;
      const n = 64, step = Math.floor(s.length / 2 / n);
      for (let i = 0; i < n; i++) { const v = s[i * step] / 255, bh = v * H; g.fillStyle = `hsl(${30 - v * 20}, 100%, ${45 + v * 20}%)`; g.fillRect((i * W) / n + 1, H - bh, W / n - 2, bh); }
    };
    draw();
  }

  // ---- SUBSPACE: hailing ------------------------------------------------------------------------
  async function hail(layerId, m, layer) {
    closeChannel(false);
    const token = ++hailToken;
    audio.resume();
    station = { layerId, m, layer, media: stationMedia(layerId, m), name: m[2], onScreen: false, nowPlaying: null };
    if (station.media.place != null) loadPlace().then(() => { if (station?.choices && !station.stream) station.stream = station.choices.find((x) => x.url === station.media.stream) ?? null; onPanel?.(); });
    onPanel?.();
    setScreen(banner('HAILING', station.name.toUpperCase(), 'cx-hailing'));
    await sleep(1300); if (token !== hailToken) return;
    setScreen(banner('SIGNAL RECEIVED', `${layer.label} · ${station.name.toUpperCase()}`, 'cx-received'));
    await sleep(900); if (token !== hailToken) return;
    if (station.media.video) {
      if (settings.get('alwaysOnScreen')) return onScreen(true);
      const always = el('input', { type: 'checkbox', checked: !!settings.get('alwaysOnScreen') });
      always.addEventListener('change', () => settings.set('alwaysOnScreen', always.checked));
      prompt = 'onscreen';
      setScreen(el('div', { className: 'cx-banner cx-prompt' }, el('div', { className: 'cx-big', textContent: 'ON SCREEN?' }),
        el('div', { className: 'body-list' }, pill('YES · ON SCREEN', () => onScreen(true)), pill('NO · AUDIO ONLY', () => onScreen(false))),
        el('label', { className: 'cx-always mono' }, always, ' ALWAYS ON SCREEN'),
        el('div', { className: 'cx-small mono', textContent: 'OR SAY "COMPUTER, ON SCREEN"' })));
    } else onScreen(false);
  }
  const media = (u) => `/api/comms/media?u=${encodeURIComponent(u)}`;
  let refresh = 0;
  function onScreen(yes) {
    if (!station) return { ok: false, error: 'no station hailed' };
    prompt = null;
    clearInterval(refresh);
    const md = station.media;
    station.onScreen = !!(yes && md.video);
    if (station.onScreen) {
      let v;
      if (md.video === 'mp4') {
        v = el('video', { src: media(md.src), poster: md.still ? media(md.still) : '', autoplay: true, loop: true, muted: true, playsInline: true, className: 'cx-video' });
        // no H.264 decoder (some browsers): fall back to the camera's still, refreshed
        if (md.still) v.addEventListener('error', () => { const img = el('img', { src: media(md.still), className: 'cx-video', alt: station?.name ?? '' }); v.replaceWith(img); refresh = setInterval(() => { img.src = `${media(md.still)}&t=${Date.now()}`; }, 15000); }, { once: true });
      }
      else if (md.video === 'image') { v = el('img', { src: media(md.src), className: 'cx-video', alt: station.name }); refresh = setInterval(() => { v.src = `${media(md.src)}&t=${Date.now()}`; }, 15000); }
      else if (md.video === 'youtube') v = el('iframe', { src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(md.src)}?autoplay=1`, allow: 'autoplay; encrypted-media; picture-in-picture', allowFullscreen: true, className: 'cx-video', title: station.name });
      else if (md.video === 'iframe') v = el('iframe', { src: md.src, className: 'cx-video', title: station.name, allow: 'autoplay' });
      setScreen(v, el('div', { className: 'cx-overlay mono', textContent: `${station.name.toUpperCase()} · ON SCREEN` }));
    }
    if (md.audio && md.stream) {
      if (STANDALONE) { setScreen(banner('NO SUBSPACE RELAY', 'Station audio needs the local backend (npm start).')); }
      else {
        radioEl.src = `/api/comms/stream?u=${encodeURIComponent(md.stream)}`;
        audio.media(radioEl); audio.setBand(10000);
        radioEl.play().catch(() => toast?.('PRESS PLAY: THE BROWSER BLOCKED AUTOPLAY'));
        if (!station.onScreen) visualiser(station.name.toUpperCase());
        pollNowPlaying();
      }
    } else if (!station.onScreen) setScreen(banner(md.video ? 'AUDIO NOT CARRIED' : 'NO AUDIO OR VIDEO ON THIS CHANNEL', 'SEE THE FINDER FOR THE STATION\'S OWN LINKS'));
    onPanel?.();
    return { ok: true, said: station.onScreen ? 'On screen.' : md.audio ? 'Audio only.' : 'Station details are in the finder.' };
  }
  let npTimer = 0;
  function pollNowPlaying() {
    clearInterval(npTimer);
    const u = station?.media.stream;
    const tick = () => fetch(`/api/comms/nowplaying?u=${encodeURIComponent(u)}`).then((r) => r.json()).then((d) => { if (station?.media.stream === u && d.title !== station.nowPlaying?.title) { station.nowPlaying = d; onPanel?.(); } }).catch(() => {});
    setTimeout(tick, 2500); npTimer = setInterval(tick, 10000);
  }
  function closeChannel(render = true) {
    hailToken++;
    clearInterval(refresh); clearInterval(npTimer); cancelAnimationFrame(vizRaf);
    radioEl.pause(); radioEl.removeAttribute('src'); radioEl.load();
    audio.flush();
    station = null; prompt = null;
    if (render) { idle(); onPanel?.(); }
    return { ok: true, said: 'Channel closed.' };
  }

  // ---- RF: receivers ------------------------------------------------------------------------------
  async function loadDevices() {
    if (STANDALONE) return;
    try { devices = await fetch('/api/rf/devices').then((r) => r.json()); } catch { devices = null; }
    const obs = settings.get('observer');
    if (devices?.rx?.length) rfMap.setExtra('localsdr', [[obs?.lat ?? 51.4779, obs?.lon ?? 0, `LOCAL SDR · ${devices.rx[0].label}${obs ? '' : ' (set your location in FROM EARTH)'}`, '', `${(devices.rx[0].rangeHz[0] / 1e6).toFixed(0)}–${(devices.rx[0].rangeHz[1] / 1e6).toFixed(0)} MHz · THIS MACHINE`, 1]]);
    syncDev();
  }
  function syncDev() {
    const d = head.querySelector('.cx-dev');
    if (!devices) { d.textContent = STANDALONE ? 'RF NEEDS THE LOCAL BACKEND' : 'CHECKING HARDWARE…'; return; }
    d.textContent = [devices.rx.length ? `RX: ${devices.rx.map((x) => x.label).join(', ')}` : 'NO LOCAL RECEIVER', devices.tx.length ? `TX-CAPABLE: ${devices.tx.map((x) => x.label).join(', ')} · TRANSMIT NOT ENABLED` : 'NO TX DEVICE'].join(' · ');
  }

  /** RF: a receiver picked on the map (its console is still to come). */
  function selectReceiver(layerId, m, layer) {
    closeChannel(false);
    receiver = { layerId, m, layer, name: m[2], local: layerId === 'localsdr' };
    setScreen(banner('RECEIVER SELECTED', receiver.name.toUpperCase()), el('div', { className: 'cx-overlay mono', textContent: 'RECEIVER CONSOLE PENDING' }));
    onPanel?.();
  }

  // ---- stations by city: a place has many stations; pick one in the finder ---------------------------------
  async function loadPlace() {
    if (station?.media.place == null || station.choices) return;
    try { station.choices = (await fetch(`/api/signals/stations/place?i=${station.media.place}`).then((r) => r.json())).streams; } catch { station.choices = []; }
    onPanel?.();
  }
  function chooseStream(s) {
    if (!station) return;
    station.media = { ...station.media, stream: s.url, audio: true };
    station.stream = s;
    onScreen(false);
  }

  // ---- mode ------------------------------------------------------------------------------------------
  function setMode(m) {
    mode = m;
    closeChannel(false);
    receiver = null;
    for (const [id, b] of Object.entries(modeBtns)) b.classList.toggle('on', id === m);
    mapBox.replaceChildren((m === 'subspace' ? subMap : rfMap).node);
    requestAnimationFrame(() => (m === 'subspace' ? subMap : rfMap).redraw());
    consoleBox.replaceChildren(el('p', { className: 'note', textContent: m === 'subspace'
      ? 'SubSpace: signals carried at light speed over the internet. Hail a station on the map: its video can go on screen; otherwise its audio plays and its details are in the finder.'
      : 'RF: radio receivers. WebSDR receivers (your list, HF to 10 GHz), public KiwiSDR receivers (0–30 MHz) and your own SDR (if one is plugged in) are on the map. The receiver console (dial, waterfall, scan) is still to come. Nothing here transmits.' }));
    if (m === 'rf' && !devices) loadDevices();
    idle();
    onPanel?.();
  }

  // ---- finder (right panel) -------------------------------------------------------------------------
  function panel(h, row) {
    const out = [h('h2', { textContent: 'COMMS' }), h('div', { className: 'kind', textContent: mode === 'subspace' ? 'SUBSPACE RECEPTION · FINDER' : 'RF RECEPTION · FINDER' })];
    if (mode === 'subspace' && station) {
      const [lat, lon, name, href, detail] = station.m, dl = h('dl');
      out.push(h('h3', { textContent: 'CHANNEL' }), h('h2', { className: 'sel-name', textContent: name.toUpperCase() }));
      row(dl, 'SOURCE', station.layer.label, 'reported', `${station.layer.credit ?? ''}`);
      row(dl, 'DETAIL', detail || '—', 'reported', 'As published by the directory or operator.');
      row(dl, 'LOCATION', `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(2)}°${lon >= 0 ? 'E' : 'W'}`, 'reported', 'Position as listed.');
      row(dl, 'ON SCREEN', station.onScreen ? 'YES' : station.media.video ? 'NO (AUDIO ONLY)' : 'NO VIDEO ON THIS CHANNEL', 'measured', 'What the viewscreen is showing.');
      if (station.stream) row(dl, 'STATION', station.stream.name.toUpperCase(), 'reported', 'Chosen from this place\'s list.');
      if (station.media.stream) {
        const np = station.nowPlaying;
        row(dl, 'NOW PLAYING', np?.title || (np ? 'NOT ANNOUNCED BY THE STATION' : 'LISTENING…'), 'reported', 'From the stream\'s own metadata (ICY StreamTitle), read by the local backend.');
        if (np?.name) row(dl, 'STREAM NAME', np.name, 'reported', 'icy-name header.');
        if (np?.bitrate) row(dl, 'BITRATE', `${np.bitrate} kb/s`, 'reported', 'icy-br header.');
      }
      out.push(dl);
      if (station.choices) out.push(h('h3', { textContent: `STATIONS HERE · ${station.choices.length}` }),
        h('div', { className: 'host-list' }, station.choices.slice(0, 200).map((s) => h('button', { className: `host-row${station.stream?.url === s.url ? ' sel' : ''}`, onclick: () => chooseStream(s) }, h('span', { textContent: s.name.toUpperCase() }), h('span', { className: 'mono', textContent: 'LISTEN' })))));
      out.push(h('div', { className: 'body-list' },
        station.media.video && !station.onScreen ? pill('ON SCREEN', () => onScreen(true)) : null,
        station.onScreen && station.media.audio ? pill('OFF SCREEN', () => onScreen(false)) : null,
        pill('CLOSE CHANNEL', () => closeChannel()),
        href && /^https?:/.test(href) ? h('a', { className: 'pill', href, target: '_blank', rel: 'noopener noreferrer', textContent: 'STATION PAGE ↗' }) : null,
        station.media.stream ? h('a', { className: 'pill', href: station.media.stream, target: '_blank', rel: 'noopener noreferrer', textContent: 'STREAM ↗' }) : null));
    } else if (mode === 'rf' && receiver) {
      const [lat, lon, name, href, detail, extra] = receiver.m, dl = h('dl');
      out.push(h('h3', { textContent: 'RECEIVER' }), h('h2', { className: 'sel-name', textContent: name.toUpperCase() }));
      row(dl, 'TYPE', receiver.local ? 'LOCAL SDR (THIS MACHINE)' : receiver.layerId === 'websdr' ? 'WEBSDR (PUBLIC)' : 'KIWISDR (PUBLIC)', receiver.local ? 'measured' : 'reported', receiver.local ? 'Detected with the rtl-sdr tools.' : receiver.layer.credit ?? '');
      row(dl, 'COVERAGE', detail || '—', 'reported', 'As listed by the operator.');
      const info = receiver.m[6];
      if (receiver.layerId === 'kiwisdr') row(dl, 'SLOTS', extra === 1 ? 'FREE SLOT NOW' : extra === 0 ? 'FULL NOW' : '—', 'reported', 'From the public KiwiSDR list.');
      if (receiver.layerId === 'websdr') { row(dl, 'LISTENING', String(info?.users ?? 0), 'reported', 'Listeners when the list was taken.'); if (info?.qth) row(dl, 'LOCATOR', info.qth, 'reported', 'Maidenhead grid square.'); }
      row(dl, 'LOCATION', `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(2)}°${lon >= 0 ? 'E' : 'W'}`, 'reported', 'Position as listed.');
      out.push(dl);
      if (info?.bands?.length) out.push(h('h3', { textContent: `BANDS · ${info.bands.length}` }), h('div', { className: 'host-list' }, info.bands.map((b) => h('div', { className: 'host-row' },
        h('span', { textContent: `${b.l < 1 ? (b.l * 1000).toFixed(0) + ' kHz' : b.l.toFixed(3) + ' MHz'} – ${b.h < 1 ? (b.h * 1000).toFixed(0) + ' kHz' : b.h.toFixed(3) + ' MHz'}` }), h('span', { className: 'mono', textContent: (b.a || '').toUpperCase() })))));
      out.push(h('p', { className: 'note', textContent: 'The receiver console (tuning, waterfall, scan) is still to come; OPEN RECEIVER listens on the operator\'s own page.' }),
        h('div', { className: 'body-list' }, href && /^https?:/.test(href) ? h('a', { className: 'pill', href, target: '_blank', rel: 'noopener noreferrer', textContent: 'OPEN RECEIVER ↗' }) : null));
    } else out.push(h('p', { className: 'note', textContent: mode === 'subspace' ? 'Hail a station on the map: radio (Radio Browser and your stations-by-city list), traffic cameras, webcams and live observatory video.' : 'Select a receiver on the map.' }));
    if (mode === 'rf' && devices) out.push(h('h3', { textContent: 'HARDWARE' }), h('p', { className: 'note', textContent: head.querySelector('.cx-dev').textContent }));
    return out;
  }

  // ---- voice ("Computer, on screen") -----------------------------------------------------------------
  function voice(c) {
    if (c.command === 'on_screen') return station?.media.video ? onScreen(true) : { ok: false, error: station ? 'This channel carries no video.' : 'No station hailed.' };
    if (c.command === 'off_screen') return station ? onScreen(false) : { ok: false, error: 'No station hailed.' };
    if (c.command === 'close_channel') return closeChannel();
    return { ok: false, error: 'The RF receiver console is not built yet.' };
  }
  const context = () => `COMMS (${mode === 'subspace' ? 'SubSpace reception' : 'RF reception'})${station ? `: channel open to ${station.name}${station.onScreen ? ', on screen' : ''}${station.nowPlaying?.title ? `, now playing ${station.nowPlaying.title}` : ''}` : receiver ? `: receiver ${receiver.name} selected` : ', no channel open'}${prompt === 'onscreen' ? '. The viewscreen is asking "On screen?"' : ''}.`;

  let started = false;
  return {
    show() { container.hidden = false; if (!started) { started = true; setMode('subspace'); } else (mode === 'subspace' ? subMap : rfMap).redraw(); },
    hide() { container.hidden = true; closeChannel(false); },
    panel, voice, context,
    get mode() { return mode; },
  };
}
