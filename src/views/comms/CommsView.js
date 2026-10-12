// COMMS (#69): Sector 001's communications station.
//
//   SUBSPACE: signals carried at light speed over the internet: radio stations, traffic cameras,
//     webcams and live video on the Earth map. The viewscreen stays dark until a station is hailed:
//     OPENING CHANNEL (radio) or OPENING FEED (cameras, video) → SIGNAL RECEIVED → "ON SCREEN?" when it has video (yes / no, or "on screen" to the
//     computer; ALWAYS ON SCREEN skips the question). Without video, or declined, the audio plays and
//     the finder (right panel) shows the station, its links and what is playing.
//   RF: radio reception. Public KiwiSDR receivers (0–30 MHz) and a local SDR (bladeRF, RTL-SDR, …)
//     at the observer's location are on the map; the receiver console (dial, waterfall, scan) opens
//     in the finder. A WebSDR opens the operator's own page in the main viewer, tuned from our dial,
//     band and mode controls (websdr.js), or links out when the page refuses framing.
//   TRANSMIT (transmitter.js): only when the backend reports a transmit-capable SDR (HackRF, bladeRF).
//     A licensed operator's hailing frequency: amateur 2 m / 70 cm narrowband FM from the microphone,
//     with the big red TRANSMITTING indicator, a timeout and the CW station ID.

import { createSignalsMap } from '../../panels/signalsmap.js';
import { createCommsAudio } from './audio.js';
import { stationMedia, parseFrequency } from '../../data/rf.js';
import { createReceiver } from './receiver.js';
import { createWebSdr } from './websdr.js';
import { createTransmitter } from './transmitter.js';
import { parseLocation, station as stationAt, toGrid, sdrDiagnosis } from '../../data/station.js';
import { normalizeConverter, converting, converterLabel, antennaRange, HAM_IT_UP_LO } from '../../data/converter.js';

const STANDALONE = import.meta.env?.MODE === 'standalone';
const el = (tag, props = {}, ...kids) => {
  const e = Object.assign(document.createElement(tag), props);
  for (const k of kids.flat()) if (k != null && k !== false) e.append(k);
  return e;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function createCommsView(container, { badge, pill, settings, onPanel, toast, onPostcard, onAudio }) {
  const audio = createCommsAudio();
  const rxConsole = createReceiver({ audio, pill, badge, onPanel: () => onPanel?.(), converter: () => settings.get('rfConverter') });
  const webSdr = createWebSdr({ pill, badge, onPanel: () => onPanel?.() });
  // the transmitter: opening it silences every received channel, so nothing heard is retransmitted
  const tx = createTransmitter({ settings, pill, badge, toast, onChange: () => onPanel?.(), beforeOpen: () => { closeChannel(false); receiver = null; idle(); onPanel?.(); } });
  let keyHooked = false;
  let mode = 'subspace', station = null, prompt = null, devices = null, receiver = null, hailToken = 0;
  const radioEl = el('audio', { preload: 'none', crossOrigin: 'anonymous' });

  // ---- layout --------------------------------------------------------------------------------
  const modeBtns = {};
  let chooseBtn;
  const head = el('div', { className: 'cx-head' },
    el('h2', { textContent: 'COMMS · SECTOR 001' }),
    el('div', { className: 'body-list cx-modes' }, ...[['subspace', 'SUBSPACE RECEPTION'], ['rf', 'RF RECEPTION']].map(([id, label]) => (modeBtns[id] = pill(label, () => setMode(id))))),
    (chooseBtn = pill('CHANGE STATION', () => openMapPop())),
    el('span', { className: 'cx-dev mono' }),
    tx.indicator);
  const isRadio = (id) => id === 'radio' || id === 'stations'; // a broadcast: you open a channel to it; cameras and video are feeds
  const subMap = createSignalsMap({ only: ['stations', 'radio', 'traffic', 'trafficcams', 'worldcams', 'video'], title: 'SUBSPACE · STATIONS ON EARTH', fill: true, onPick: (id, m, l) => hail(id, m, l), pickLabel: (id) => (isRadio(id) ? 'OPEN CHANNEL' : 'OPEN FEED') });
  const rfMap = createSignalsMap({ only: ['websdr', 'kiwisdr'], title: 'RF · RECEIVERS', fill: true, onPick: (id, m, l) => selectReceiver(id, m, l), pickLabel: () => 'SELECT',
    extra: [{ id: 'station', label: 'MY STATION', colour: '#ffcc66', kind: 'station', markers: [], credit: 'Your station location (MY STATION in the RF finder; shared with FROM EARTH).', licence: 'Yours' },
      { id: 'localsdr', label: 'LOCAL SDR', colour: '#66ff99', kind: 'sdr', markers: [], credit: 'This machine (bladeRF-cli, rtl-sdr or rx_tools), at your station location.', licence: 'Your hardware' }] });
  const screen = el('div', { className: 'cx-screen' });
  const screenFrame = el('div', { className: 'cx-screen-frame' }, screen, el('div', { className: 'cx-screen-label mono', textContent: 'MAIN VIEWER' }));
  const consoleBox = el('div', { className: 'cx-console' });
  // The main viewer (waterfall + spectrum) is full width; the map lives in a popup you open to pick a
  // new station or receiver (CHANGE STATION / CHANGE RECEIVER in the header, or the map auto-opens on
  // entering a mode and closes once you pick).
  const mapBox = el('div', { className: 'cx-map' });
  const mapPopTitle = el('span', { className: 'mono cx-map-pop-title', textContent: 'CHOOSE A STATION' });
  const mapPop = el('div', { className: 'cx-map-pop', hidden: true },
    el('div', { className: 'cx-map-pop-inner' },
      el('div', { className: 'cx-map-pop-head' }, mapPopTitle, pill('CLOSE', () => closeMapPop(), 'square')),
      mapBox));
  mapPop.addEventListener('click', (e) => { if (e.target === mapPop) closeMapPop(); }); // click the backdrop to close
  container.replaceChildren(el('div', { className: 'cx-wrap' }, head,
    el('div', { className: 'cx-body' }, el('div', { className: 'cx-side' }, screenFrame, consoleBox)),
    mapPop));
  function openMapPop() { mapPop.hidden = false; const mp = mode === 'subspace' ? subMap : rfMap; requestAnimationFrame(() => mp.redraw()); }
  function closeMapPop() { mapPop.hidden = true; }

  // ---- viewscreen ---------------------------------------------------------------------------------
  const setScreen = (...kids) => screen.replaceChildren(...kids);
  const banner = (big, small, cls = '') => el('div', { className: `cx-banner ${cls}` }, el('div', { className: 'cx-big', textContent: big }), small ? el('div', { className: 'cx-small mono', textContent: small }) : null);
  function idle() { setScreen(el('div', { className: 'cx-idle mono', textContent: mode === 'subspace' ? 'NO SIGNAL · OPEN A CHANNEL ON THE MAP' : 'NO RECEIVER · TUNE IN TO ONE ON THE MAP' })); }
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
    closeMapPop();
    const token = ++hailToken;
    audio.resume();
    station = { layerId, m, layer, media: stationMedia(layerId, m), name: m[2], onScreen: false, nowPlaying: null };
    paused = false; setTimeout(audioChanged, 0);
    if (station.media.place != null) loadPlace().then(() => { if (station?.choices && !station.stream) station.stream = station.choices.find((x) => x.url === station.media.stream) ?? null; onPanel?.(); });
    onPanel?.();
    setScreen(banner(isRadio(layerId) ? 'OPENING CHANNEL' : 'OPENING FEED', station.name.toUpperCase(), 'cx-hailing'));
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
  // ---- background audio: COMMS keeps playing in other views; the header's ▶/❚❚ pauses it ---------
  let paused = false;
  const audioNow = () => {
    const name = station?.name ?? (rxConsole.active ? rxConsole.info?.name : null) ?? (webSdr.active ? webSdr.info?.name : null);
    return name ? { name, paused, kind: station ? 'channel' : 'receiver' } : null;
  };
  const audioChanged = () => onAudio?.(audioNow());
  async function setPaused(p) {
    paused = !!p;
    if (paused) { radioEl.pause(); await audio.suspend(); }
    else { await audio.resume(); if (radioEl.getAttribute('src')) radioEl.play().catch(() => {}); }
    audioChanged();
  }
  function closeChannel(render = true) {
    hailToken++; paused = false; setTimeout(audioChanged, 0);
    clearInterval(refresh); clearInterval(npTimer); cancelAnimationFrame(vizRaf);
    radioEl.pause(); radioEl.removeAttribute('src'); radioEl.load();
    rxConsole.close();
    webSdr.close();
    audio.flush();
    station = null; prompt = null;
    if (render) { idle(); onPanel?.(); }
    return { ok: true, said: 'Channel closed.' };
  }

  // ---- RF: receivers ------------------------------------------------------------------------------
  async function loadDevices(fresh = false) {
    if (STANDALONE) return;
    try { devices = await fetch(`/api/rf/devices${fresh ? '?fresh=1' : ''}`).then((r) => r.json()); } catch { devices = null; }
    tx.setDevices(devices ? devices.tx ?? [] : null);
    localMarkers();
    syncDev();
  }
  /** The local SDR on the map, its range seen from the antenna (through a converter when one is active). */
  let localList = []; // the local SDR markers, one per detected receiver (MY SDR opens them)
  function localMarkers() {
    const obs = settings.get('observer'), conv = settings.get('rfConverter');
    rfMap.setExtra('station', obs ? [[obs.lat, obs.lon, `MY STATION · ${obs.grid ?? toGrid(obs.lat, obs.lon)}`, '', obs.label ?? '', 1, { station: true }]] : []);
    localList = (devices?.rx ?? []).map((dev, i) => { const [lo, hi] = antennaRange(dev.rangeHz, conv); return [(obs?.lat ?? 51.4779) + i * 0.12, obs?.lon ?? 0,
      `LOCAL SDR · ${dev.label}${obs ? '' : ' (set MY STATION in RF)'}`, '',
      `${lo < 1e6 ? (lo / 1e3).toFixed(0) + ' kHz' : (lo / 1e6).toFixed(0) + ' MHz'}–${(hi / 1e6).toFixed(0)} MHz · ${dev.fake ? 'SIMULATED (FIDELITY_FAKE_SDR)' : 'THIS MACHINE'}${converting(conv) ? ` · VIA ${converterLabel(conv)}` : ''}`, 1, { driver: dev.driver, maxHz: dev.rangeHz[1], minHz: dev.rangeHz[0], fake: !!dev.fake }]; });
    rfMap.setExtra('localsdr', localList);
  }
  const unsubStation = settings.onChange((k) => { if (k === 'observer') { localMarkers(); if (mode === 'rf') onPanel?.(); } });

  // ---- MY STATION and MY SDR (RF finder): where the operator is, and which local radio to use ---------
  function setStation(st) { settings.set('observer', st); rfMap.focus(st.lat, st.lon, 6); }
  function stationPanel() {
    const obs = settings.get('observer');
    const out = [el('h3', { textContent: 'MY STATION' })];
    out.push(el('p', { className: 'note', textContent: obs
      ? `${obs.label ?? ''} · GRID ${obs.grid ?? toGrid(obs.lat, obs.lon)}. Your local SDR sits here on the map; FROM EARTH uses it too.`
      : 'Not set. Your local SDR appears on the map at your station, and FROM EARTH uses it for rise and set times.' }));
    const input = el('input', { className: 'cx-rx-input mono', placeholder: 'GRID (EM12kx) OR LAT, LON', title: 'A Maidenhead grid square, "32.78, -96.80" or "32.78N 96.80W"' });
    const msg = el('span', { className: 'mono cx-tx-lab' });
    const apply = () => { const st = parseLocation(input.value); if (!st) { msg.textContent = 'UNREADABLE: TRY EM12kx OR 32.78, -96.80'; return; } setStation(st); };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') apply(); });
    out.push(el('div', { className: 'cx-rx-row' }, input, pill('SET', apply)), msg,
      el('div', { className: 'body-list' },
        pill('USE MY LOCATION', () => {
          if (!navigator.geolocation) { toast?.('LOCATION NOT AVAILABLE IN THIS BROWSER'); return; }
          navigator.geolocation.getCurrentPosition((p) => setStation(stationAt(p.coords.latitude, p.coords.longitude, 'MY LOCATION')), () => toast?.('LOCATION PERMISSION DENIED: PLACE ON MAP OR TYPE A GRID'), { timeout: 15000 });
        }),
        pill(rfMap.placing ? 'CLICK THE MAP… (ESC)' : 'PLACE ON MAP', () => { rfMap.pickPoint((lat, lon) => setStation(stationAt(lat, lon)), () => onPanel?.()); toast?.('CLICK YOUR STATION ON THE MAP'); onPanel?.(); }),
        obs ? pill('SHOW ON MAP', () => rfMap.focus(obs.lat, obs.lon, 6)) : null));
    // MY SDR: the detected local receivers; OPEN starts its console (waterfall, dial, audio)
    out.push(el('h3', { textContent: 'MY SDR' }));
    if (STANDALONE) { out.push(el('p', { className: 'note', textContent: 'A local SDR needs the local backend (npm start on the machine it is plugged into).' })); return out; }
    if (!devices) { out.push(el('p', { className: 'note', textContent: 'CHECKING HARDWARE…' })); return out; }
    if (localList.length) {
      const pick = el('select', { className: 'cx-tx-select mono' }, localList.map((m, i) => el('option', { value: String(i), textContent: devices.rx[i].label.toUpperCase(), selected: devices.rx[i].driver === settings.get('rfLocalDevice') })));
      pick.addEventListener('change', () => settings.set('rfLocalDevice', devices.rx[Number(pick.value)].driver));
      const chosen = () => localList[Number(pick.value)] ?? localList[0];
      out.push(el('div', { className: 'cx-rx-row' }, el('span', { className: 'mono cx-tx-lab', textContent: 'RADIO' }), pick),
        el('div', { className: 'body-list' }, pill('OPEN MY SDR', () => { settings.set('rfLocalDevice', devices.rx[Number(pick.value)].driver); selectReceiver('localsdr', chosen(), null); }), pill('RESCAN', () => rescan())));
    } else {
      out.push(el('p', { className: 'note', textContent: 'No local receiver detected.' }), ...sdrDiagnosis(devices).map((t) => el('p', { className: 'note', textContent: t })),
        el('div', { className: 'body-list' }, pill('RESCAN', () => rescan())));
    }
    return out;
  }
  async function rescan() { devices = null; onPanel?.(); await loadDevices(true); onPanel?.(); }

  // ---- SIGNAL PATH: a frequency converter between the antenna and the local SDR (Ham It Up) ---------
  function signalPathPanel() {
    const c = normalizeConverter(settings.get('rfConverter'));
    const set = (patch) => {
      settings.set('rfConverter', normalizeConverter({ ...c, ...patch }));
      if (receiver?.local) { closeChannel(false); receiver = null; idle(); } // retune from scratch through the new path
      localMarkers(); onPanel?.();
    };
    const kind = el('select', { className: 'cx-tx-select mono' }, [['none', 'NONE (ANTENNA → SDR)'], ['hamitup', 'HAM IT UP · LO 125.000 MHz, UP'], ['custom', 'CUSTOM LO']].map(([v, l]) => el('option', { value: v, textContent: l, selected: c.kind === v })));
    kind.addEventListener('change', () => set({ kind: kind.value, bypass: false }));
    const out = [el('h3', { textContent: 'SIGNAL PATH' }),
      el('div', { className: 'cx-rx-row' }, el('span', { className: 'mono cx-tx-lab', textContent: 'CONVERTER' }), kind)];
    if (c.kind === 'custom') {
      const lo = el('input', { className: 'cx-rx-input mono cx-tx-num', value: (c.loHz / 1e6).toFixed(3), inputMode: 'decimal', title: 'LO in MHz' });
      lo.addEventListener('change', () => { const v = Number(lo.value) * 1e6; set({ loHz: v > 0 ? v : HAM_IT_UP_LO }); });
      const dir = el('select', { className: 'cx-tx-select mono' }, [['up', 'UP (SDR = ANTENNA + LO)'], ['down', 'DOWN (SDR = ANTENNA − LO)']].map(([v, l]) => el('option', { value: v, textContent: l, selected: c.direction === v })));
      dir.addEventListener('change', () => set({ direction: dir.value }));
      out.push(el('div', { className: 'cx-rx-row' }, el('span', { className: 'mono cx-tx-lab', textContent: 'LO MHz' }), lo, dir));
    }
    if (c.kind !== 'none') {
      const by = el('input', { type: 'checkbox', checked: c.bypass });
      by.addEventListener('change', () => set({ bypass: by.checked }));
      out.push(el('label', { className: 'cx-always mono' }, by, ' BYPASS (THE CONVERTER\'S BYPASS SWITCH IS ON: NO CONVERSION)'),
        el('p', { className: 'note', textContent: converting(c)
          ? `Receiving: the local SDR tunes the antenna frequency ${c.direction === 'up' ? '+' : '−'} ${(c.loHz / 1e6).toFixed(3)} MHz; every frequency shown (dial, scan results) is the true antenna-side one. Transmitting is blocked while the converter is in the path.`
          : 'Bypassed: the antenna goes straight to the SDR, so frequencies are tuned as shown and transmitting on 2 m / 70 cm is possible.' }));
    }
    return out;
  }
  function syncDev() {
    const d = head.querySelector('.cx-dev');
    if (!devices) { d.textContent = STANDALONE ? 'RF NEEDS THE LOCAL BACKEND' : 'CHECKING HARDWARE…'; return; }
    d.textContent = [devices.rx.length ? `RX: ${devices.rx.map((x) => x.label).join(', ')}` : 'NO LOCAL RECEIVER', devices.tx.length ? `TX: ${devices.tx.map((x) => `${x.label}${x.ready ? '' : ' (TOOL MISSING)'}`).join(', ')} · TRANSMIT SETUP IN RF` : 'NO TX DEVICE'].join(' · ');
  }

  /** RF: a receiver picked on the map. KiwiSDR and the local SDR open a listening console; a WebSDR opens its operator's page in the viewer. */
  function selectReceiver(layerId, m, layer) {
    if (layerId === 'station') { const mine = localList.find((x, i) => devices.rx[i].driver === settings.get('rfLocalDevice')) ?? localList[0]; if (mine) return selectReceiver('localsdr', mine, null); return; } // MY STATION opens my SDR
    closeChannel(false);
    paused = false; setTimeout(audioChanged, 300); // the console reports active once it opens
    closeMapPop();
    const local = layerId === 'localsdr';
    receiver = { layerId, m, layer, name: m[2], url: m[3], local };
    if (layerId === 'kiwisdr' || local) {
      const dev = local ? (m[6] ?? {}) : {};
      receiver.consoleBox = rxConsole.open({ name: m[2], url: m[3], local, layer, driver: dev.driver ?? 'rtl', minHz: dev.minHz, maxHz: dev.maxHz, fake: !!dev.fake }, (...kids) => setScreen(...kids));
    } else if (layerId === 'websdr' && /^https?:/.test(m[3] ?? '')) {
      receiver.consoleBox = webSdr.open({ name: m[2], url: m[3], info: m[6] }, (...kids) => setScreen(...kids));
    } else {
      receiver.consoleBox = null;
      setScreen(banner('RECEIVER SELECTED', receiver.name.toUpperCase()), el('div', { className: 'cx-overlay mono', textContent: 'OPENS ON THE OPERATOR\'S OWN PAGE' }));
    }
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
    chooseBtn.textContent = m === 'subspace' ? 'CHANGE STATION' : 'CHANGE RECEIVER';
    mapPopTitle.textContent = m === 'subspace' ? 'CHOOSE A STATION' : 'CHOOSE A RECEIVER';
    openMapPop(); // show the map so they can pick; picking (hail/select) closes it
    consoleBox.replaceChildren(el('p', { className: 'note', textContent: m === 'subspace'
      ? 'SubSpace: signals carried at light speed over the internet. Open a channel to a station on the map: its video can go on screen; otherwise its audio plays and its details are in the finder.'
      : `RF: radio receivers. WebSDR receivers (your list, HF to 10 GHz: the operator's page opens in the main viewer), public KiwiSDR receivers (0–30 MHz) and your own SDR (if one is plugged in, with a live waterfall) are on the map. ${tx.devices?.length ? 'A transmit-capable SDR is connected: TRANSMIT SETUP is in the finder (licensed amateur operators only).' : 'Reception only: no transmit-capable SDR is connected.'}` }));
    if (m === 'rf' && !devices) loadDevices().then(() => onPanel?.());
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
    } else if (mode === 'rf' && receiver?.consoleBox) {
      out.push(receiver.consoleBox);
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
      out.push(h('p', { className: 'note', textContent: 'OPEN RECEIVER listens on the operator\'s own page.' }),
        h('div', { className: 'body-list' }, href && /^https?:/.test(href) ? h('a', { className: 'pill', href, target: '_blank', rel: 'noopener noreferrer', textContent: 'OPEN RECEIVER ↗' }) : null));
    } else out.push(h('p', { className: 'note', textContent: mode === 'subspace' ? 'Open a channel on the map: radio (Radio Browser and your stations-by-city list), traffic cameras, webcams and live observatory video.' : 'Select a receiver on the map, or open MY SDR below.' }));
    if (mode === 'rf' && !receiver?.consoleBox) out.push(...stationPanel());
    if (mode === 'rf' && devices && (devices.rx.length || devices.tx.length)) out.push(...signalPathPanel());
    if (mode === 'rf') { const tp = tx.panel(); if (tp.length) out.push(h('div', { className: 'cx-tx-box' }, ...tp)); } // TRANSMIT lives in its own box, apart from the receiver controls
    if (mode === 'rf' && devices) out.push(h('h3', { textContent: 'HARDWARE' }), h('p', { className: 'note', textContent: head.querySelector('.cx-dev').textContent }));
    return out;
  }

  // ---- voice ("Computer, on screen") -----------------------------------------------------------------
  function voice(c) {
    if (c.command === 'on_screen') return station?.media.video ? onScreen(true) : { ok: false, error: station ? 'This channel carries no video.' : 'No station hailed.' };
    if (c.command === 'off_screen') return station ? onScreen(false) : { ok: false, error: 'No station hailed.' };
    if (c.command === 'close_channel') return closeChannel();
    if (c.command === 'scan') return rxConsole.active && rxConsole.scan() ? { ok: true, said: 'Scanning for signals.' } : { ok: false, error: 'Tune in to a receiver first.' };
    if (c.command === 'tune') {
      // "7074 usb", "9.6 MHz AM": an optional demodulator word after the frequency
      const text = String(c.frequency ?? ''), mm = text.match(/\b(usb|lsb|am|cw|nbfm|wfm|wbfm|fm)\b\s*$/i);
      const hz = parseFrequency(mm ? text.slice(0, mm.index).trim() : text, { defaultUnit: 'kHz' });
      if (!hz) return { ok: false, error: 'I did not catch the frequency.' };
      const mode = mm ? { fm: 'nbfm', wfm: 'wbfm' }[mm[1].toLowerCase()] ?? mm[1].toLowerCase() : null;
      const target = rxConsole.active ? rxConsole : webSdr.active ? webSdr : null;
      if (!target) return { ok: false, error: 'Tune in to a receiver first.' };
      if (mode) target.mode(mode);
      return target.tune(hz) ? { ok: true, said: `Tuning to ${(hz / 1e6).toFixed(3)} megahertz${mode ? ` ${mm[1].toUpperCase()}` : ''}.` } : { ok: false, error: 'Tune in to a receiver first.' };
    }
    if (c.command === 'open_hailing') return tx.open(c.frequency ?? '');
    if (c.command === 'close_hailing') return tx.close('operator');
    return { ok: false, error: 'Say on screen, off screen, scan, tune, close channel, open a hailing frequency or close hailing frequency.' };
  }
  const context = () => `COMMS (${mode === 'subspace' ? 'SubSpace reception' : 'RF reception'})${station ? `: channel open to ${station.name}${station.onScreen ? ', on screen' : ''}${station.nowPlaying?.title ? `, now playing ${station.nowPlaying.title}` : ''}` : rxConsole.active ? `: receiver ${rxConsole.info?.name} open at ${(rxConsole.info?.freqHz / 1e6).toFixed(3)} MHz ${rxConsole.info?.mode}` : webSdr.active ? `: WebSDR ${webSdr.info?.name} ${webSdr.info?.embedded ? 'on the main viewer' : '(links out to its page)'} tuned to ${(webSdr.info?.freqHz / 1e6).toFixed(3)} MHz ${webSdr.info?.mode}` : receiver ? `: receiver ${receiver.name} selected` : ', no channel open'}${prompt === 'onscreen' ? '. The viewscreen is asking "On screen?"' : ''}${tx.live ? `. TRANSMITTING (hailing frequency open) on ${(tx.live.freqHz / 1e6).toFixed(3)} MHz FM` : ''}.`;

  let started = false;
  return {
    show() { container.hidden = false; // P opens a postcard here too (#40); the 3D views' camera bars handle it elsewhere
      if (!keyHooked && onPostcard) { keyHooked = true; window.addEventListener('keydown', (e) => { if (!container.hidden && (e.key === 'p' || e.key === 'P') && !e.metaKey && !e.ctrlKey && !e.altKey && !e.target.closest?.('input, select, textarea, [contenteditable]') && !document.querySelector('.pc-overlay')) { e.preventDefault(); onPostcard(); } }); } if (!started) { started = true; setMode('subspace'); loadDevices(); } else (mode === 'subspace' ? subMap : rfMap).redraw(); },
    // leaving COMMS keeps a channel or receiver playing (the header's ▶/❚❚ controls it); a transmission never outlives the view
    hide() { if (container.hidden) return; container.hidden = true; tx.close('left COMMS'); audioChanged(); },
    /** The header's COMMS audio button: what is playing, and pause/play. */
    get audio() { return audioNow(); },
    toggleAudio() { if (audioNow()) setPaused(!paused); },
    closeAudio() { closeChannel(!container.hidden); },
    panel, voice, context,
    get mode() { return mode; },
    /** #40: postcards of the active map (the 2D map repainted at the postcard's size; no labels layer). */
    snapshot: (w, h, o = {}) => (o.base === false ? null : (mode === 'subspace' ? subMap : rfMap).snapshot(w, h)), // no separate label layer
    get postcardCredits() { return (mode === 'subspace' ? subMap : rfMap).shownCredits(); },
  };
}
