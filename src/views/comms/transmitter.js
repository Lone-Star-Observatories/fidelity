// COMMS transmission (#69), browser side: TRANSMIT SETUP, the hailing frequency, and the big red
// TRANSMITTING indicator. Shown only when the backend reports a transmit-capable SDR (HackRF,
// bladeRF). "Open a hailing frequency 146" puts the microphone live as narrowband FM on 146.000 MHz;
// "close hailing frequency" ends it with the station ID in CW.
//
//   The callsign, attestation, region, gain and timeout live in this browser (settings.txSetup) and
//   go only to the local backend with each request. The backend (server/tx.js) checks everything
//   again (src/data/tx.js txGate), refuses anything not from this machine, modulates, times out and
//   identifies. The microphone goes as Int16 PCM at 16 kHz over ws /api/rf/tx.

import { TX, txGate, parseHailingFrequency, formatBands, normalizeCallsign, clampGain, clampTimeoutS, regionOf, DEFAULT_ANTENNAS, ANTENNA_BANDS, describeAntennaBands } from '../../data/tx.js';
import { resampler } from '../../voice/wake.js';
import { converting, converterLabel, converterAllowsTx, normalizeConverter } from '../../data/converter.js';

const el = (tag, props = {}, ...kids) => {
  const e = Object.assign(document.createElement(tag), props);
  for (const k of kids.flat()) if (k != null && k !== false) e.append(k);
  return e;
};
const TAP = `class TxTap extends AudioWorkletProcessor { process(i) { const c = i[0] && i[0][0]; if (c) this.port.postMessage(c.slice(0)); return true; } }
registerProcessor('fidelity-tx-tap', TxTap);`;
const MHZ = (hz) => (hz / 1e6).toFixed(3);
const clock = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const REASONS = { operator: 'closed by the operator', timeout: 'timeout', 'no-audio': 'no microphone audio', disconnect: 'the page let go', device: 'the transmitter stopped', 'left COMMS': 'COMMS closed' };
const REGIONS = [[1, 'REGION 1 · EUROPE, AFRICA, MIDDLE EAST'], [2, 'REGION 2 · THE AMERICAS'], [3, 'REGION 3 · ASIA-PACIFIC']];

export function createTransmitter({ settings, pill, badge, toast, onChange, beforeOpen }) {
  let devices = null, ws = null, mic = null, actx = null, live = null, message = null, ticker = 0;
  const setup = () => {
    const s = { callsign: '', attested: false, region: 2, gainDb: TX.defaultGainDb, timeoutS: TX.defaultTimeoutS, antennaId: null, ...(settings.get('txSetup') ?? {}) };
    if (!Array.isArray(s.antennas)) s.antennas = DEFAULT_ANTENNAS.map((a) => ({ ...a, bands: [...a.bands] })); // editable defaults
    return s;
  };
  const save = (patch) => settings.set('txSetup', { ...setup(), ...patch });
  const changed = () => onChange?.();

  // ---- the indicator (big, red, always in COMMS while transmitting) -------------------------------
  const indicator = el('div', { className: 'cx-tx-live', hidden: true, role: 'status' });
  function renderIndicator() {
    indicator.hidden = !live;
    if (!live) { indicator.replaceChildren(); return; }
    const s = setup(), elapsed = live.status === 'opening' ? 0 : live.elapsedMs + (performance.now() - live.at), remaining = Math.max(0, live.timeoutMs - elapsed);
    const big = live.status === 'opening' ? 'OPENING HAILING FREQUENCY' : live.sendingId || live.status === 'closing' ? 'TRANSMITTING · STATION ID' : 'TRANSMITTING';
    indicator.classList.toggle('closing', live.status === 'closing');
    indicator.replaceChildren(
      el('div', { className: 'cx-tx-dot', textContent: '●' }),
      el('div', { className: 'cx-tx-text' },
        el('div', { className: 'cx-tx-big', textContent: big }),
        el('div', { className: 'cx-tx-freq mono', textContent: `${MHZ(live.freqHz)} MHz · NFM ±2.5 kHz · ${normalizeCallsign(s.callsign)}` }),
        el('div', { className: 'cx-tx-sub mono', textContent: live.status === 'closing' || live.sendingId ? `SENDING ${normalizeCallsign(s.callsign)} IN CW (20 WPM, 800 HZ)` : `ON AIR ${clock(elapsed)} · TIMEOUT IN ${clock(remaining)}${live.device ? ` · ${live.device.toUpperCase()}` : ''}${live.antenna ? ` · ${live.antenna.toUpperCase()}` : ''}` }),
        live.directional ? el('div', { className: 'cx-tx-dir mono', textContent: 'DIRECTIONAL: POINT AT THE STATION' }) : null,
        live.fake ? badge('imagined', 'FIDELITY_FAKE_TX=1: a simulated transmitter. The modulator runs; nothing radiates.') : badge('measured', 'Elapsed time and state as reported by the local transmitter session (server/tx.js).')),
      ...(live.status === 'closing' ? [] : [pill('CLOSE HAILING FREQUENCY', () => close('operator'))]));
  }

  // ---- the microphone → backend --------------------------------------------------------------------
  async function startMic() {
    mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    actx = new AudioContext();
    await actx.audioWorklet.addModule(URL.createObjectURL(new Blob([TAP], { type: 'text/javascript' })));
    const node = new AudioWorkletNode(actx, 'fidelity-tx-tap'), down = resampler(actx.sampleRate, TX.audioRate);
    actx.createMediaStreamSource(mic).connect(node);
    let pend = [], n = 0;
    node.port.onmessage = (e) => {
      const x = down(e.data);
      pend.push(x); n += x.length;
      if (n < 320 || ws?.readyState !== 1 || live?.status !== 'tx') { if (live?.status !== 'tx') { pend = []; n = 0; } return; }
      const b = new Int16Array(n);
      let o = 0;
      for (const c of pend) for (let i = 0; i < c.length; i++) b[o++] = Math.max(-32768, Math.min(32767, Math.round(c[i] * 32767)));
      pend = []; n = 0;
      ws.send(b.buffer);
    };
  }
  function stopMic() {
    mic?.getTracks().forEach((t) => t.stop());
    actx?.close().catch(() => {});
    mic = actx = null;
  }

  // ---- open / close --------------------------------------------------------------------------------
  const conv = () => normalizeConverter(settings.get('rfConverter'));
  function gate(freqHz) { const s = setup(); return txGate({ devices: devices ?? [], callsign: s.callsign, attested: s.attested, freqHz, region: s.region, converter: conv(), antennas: s.antennas, antennaId: s.antennaId }); }
  /** Open a hailing frequency ("146", "146.52", or Hz). { ok, said } or { ok: false, error }. */
  function open(freq) {
    if (live) return { ok: false, error: `Already transmitting on ${MHZ(live.freqHz)} megahertz. Say "close hailing frequency" first.` };
    if (devices == null) return { ok: false, error: 'Transmission needs the local backend (npm start) and a transmit-capable SDR; none has been detected.' };
    const hz = typeof freq === 'number' ? freq : parseHailingFrequency(freq);
    const g = gate(hz ?? NaN);
    if (!g.ok) { message = { warn: true, text: g.reason }; changed(); return { ok: false, error: g.reason }; }
    start(hz, g);
    return { ok: true, said: `Hailing frequency open: ${MHZ(hz)} megahertz, FM. You are transmitting.${g.note ? ` ${g.note}` : ''}` };
  }
  async function start(hz, g) {
    beforeOpen?.(); // nothing received keeps playing into the microphone
    const s = setup();
    live = { status: 'opening', freqHz: hz, elapsedMs: 0, timeoutMs: clampTimeoutS(s.timeoutS) * 1000, at: performance.now(), device: g.device.label, fake: !!g.device.fake, antenna: g.antenna.name, directional: !!g.antenna.directional };
    message = g.note ? { warn: false, text: g.note } : null;
    renderIndicator(); changed();
    clearInterval(ticker); ticker = setInterval(renderIndicator, 250);
    try { await startMic(); } catch (e) { return fail(`The microphone is unavailable (${e.message || e}); nothing was transmitted.`); }
    if (!live) return stopMic();
    try { ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/rf/tx`); } catch { return fail('Could not reach the local backend; nothing was transmitted.'); }
    ws.binaryType = 'arraybuffer';
    ws.onopen = () => ws.send(JSON.stringify({ type: 'open', freqHz: hz, callsign: normalizeCallsign(s.callsign), attested: s.attested === true, region: regionOf(s.region), gainDb: clampGain(s.gainDb), timeoutS: clampTimeoutS(s.timeoutS), driver: g.device.driver, converter: conv(), antennas: s.antennas, antennaId: s.antennaId }));
    ws.onmessage = (e) => {
      let m; try { m = JSON.parse(e.data); } catch { return; }
      if (!live) return;
      if (m.type === 'open') { Object.assign(live, { status: 'tx', device: m.device, fake: !!m.fake, at: performance.now() }); renderIndicator(); changed(); }
      else if (m.type === 'state') { Object.assign(live, { status: m.state === 'closing' ? 'closing' : live.status === 'opening' ? 'opening' : 'tx', elapsedMs: m.elapsedMs, timeoutMs: m.timeoutMs, sendingId: m.sendingId, at: performance.now() }); if (m.state === 'closing') stopMic(); renderIndicator(); }
      else if (m.type === 'refused') fail(m.reason);
      else if (m.type === 'closed') finish(m);
    };
    ws.onerror = () => { if (live?.status === 'opening') fail('The local backend refused the transmit link; nothing was transmitted.'); };
    ws.onclose = () => { if (live) finish({ reason: 'disconnect', idSent: null }); };
  }
  function teardown() {
    stopMic();
    clearInterval(ticker);
    const w = ws; ws = null; live = null;
    if (w) { w.onclose = null; try { w.close(); } catch { /* gone */ } }
    renderIndicator(); changed();
  }
  function fail(text) { message = { warn: true, text }; toast?.(`NOT TRANSMITTING: ${text.toUpperCase()}`); teardown(); }
  function finish(m) {
    const call = normalizeCallsign(setup().callsign), why = REASONS[m.reason] ?? m.reason;
    message = { warn: m.reason === 'device' || m.reason === 'timeout', text: `Hailing frequency closed: ${why}.${m.idSent ? ` Station ID sent (${call} in CW).` : m.idSent === false ? ' No station ID could be sent: identify by voice.' : ' The backend sends the station ID as it closes.'}${m.error ? ` ${m.error}` : ''}` };
    toast?.(`HAILING FREQUENCY CLOSED · ${why.toUpperCase()}`);
    teardown();
  }
  /** Close the hailing frequency: the mic goes off at once, the backend sends the ID and releases the SDR. */
  function close(why = 'operator') {
    if (!live) return { ok: false, error: 'No hailing frequency is open.' };
    stopMic();
    if (ws?.readyState === 1) { ws.send(JSON.stringify({ type: 'close' })); live.status = 'closing'; renderIndicator(); changed(); }
    else teardown();
    if (why !== 'operator' && ws) setTimeout(() => { if (ws) { try { ws.close(); } catch { /* gone */ } } }, 100); // leaving COMMS: the backend still IDs on disconnect
    return { ok: true, said: `Closing hailing frequency. Sending station identification, ${normalizeCallsign(setup().callsign).split('').join(' ')}.` };
  }

  // ---- TRANSMIT SETUP (RF finder) ------------------------------------------------------------------
  function panel() {
    if (!devices?.length) return []; // no transmit-capable SDR: no transmit section at all
    const s = setup(), ready = devices.filter((d) => d.ready), blocked = converterAllowsTx(conv());
    const call = el('input', { className: 'cx-rx-input mono cx-tx-call cx-tx-callsign', value: s.callsign, placeholder: 'CALLSIGN', maxLength: 16, autocomplete: 'off', spellcheck: false });
    const att = el('input', { type: 'checkbox', checked: s.attested === true });
    call.addEventListener('change', () => { const c = normalizeCallsign(call.value); call.value = c; save({ callsign: c, attested: false }); att.checked = false; message = null; changed(); }); // a new callsign needs a new attestation
    att.addEventListener('change', () => { save({ attested: att.checked }); changed(); });
    const region = el('select', { className: 'cx-tx-select mono' }, REGIONS.map(([v, l]) => el('option', { value: String(v), textContent: l, selected: regionOf(s.region) === v })));
    region.addEventListener('change', () => { save({ region: Number(region.value) }); changed(); });
    const gain = el('input', { type: 'number', className: 'cx-rx-input mono cx-tx-num', min: '0', max: String(TX.maxGainDb), step: '1', value: String(clampGain(s.gainDb)) });
    gain.addEventListener('change', () => { const g = clampGain(gain.value); gain.value = String(g); save({ gainDb: g }); });
    const tmo = el('select', { className: 'cx-tx-select mono' }, [60, 120, 180, 300, 600, 900, 1800].map((v) => el('option', { value: String(v), textContent: `${v / 60} MIN`, selected: clampTimeoutS(s.timeoutS) === v })));
    tmo.addEventListener('change', () => save({ timeoutS: clampTimeoutS(tmo.value) }));
    const freq = el('input', { className: 'cx-rx-input mono', value: live ? MHZ(live.freqHz) : '146.520', inputMode: 'decimal', title: 'MHz (three digits: 146 = 146.000 MHz)' });
    return [
      el('h3', { textContent: 'TRANSMIT SETUP' }),
      el('p', { className: 'note', textContent: `Transmitting needs an amateur radio licence. Your callsign and this attestation stay in this browser and go only to the local backend. Device: ${devices.map((d) => `${d.label}${d.ready ? '' : ' (not ready)'}`).join(', ')}.` }),
      ...devices.filter((d) => !d.ready || d.fake).map((d) => el('p', { className: d.fake ? 'note' : 'warn', textContent: d.note })),
      // the signal path: a receive converter (Ham It Up) must be bypassed; TX goes straight to 2 m / 70 cm
      blocked.ok
        ? el('p', { className: 'note', textContent: `Signal path: ${converting(conv()) ? '' : converterLabel(conv()) ? `${converterLabel(conv())} — ` : 'no converter — '}the transmitter feeds the antenna directly on 2 m / 70 cm.` })
        : el('p', { className: 'warn cx-tx-block', textContent: `${blocked.reason} (SIGNAL PATH: ${converterLabel(conv())}.)` }),
      ...antennaPanel(s),
      el('div', { className: 'cx-rx-row' }, el('span', { className: 'mono cx-tx-lab', textContent: 'CALLSIGN' }), call),
      el('label', { className: 'cx-always mono cx-tx-att' }, att, ' I hold an amateur radio licence valid for these bands where I am, and I am the control operator of this station.'),
      el('div', { className: 'cx-rx-row' }, el('span', { className: 'mono cx-tx-lab', textContent: 'BAND PLAN' }), region),
      el('div', { className: 'cx-rx-row' }, el('span', { className: 'mono cx-tx-lab', textContent: 'TX GAIN dB' }), gain, el('span', { className: 'mono cx-rx-unit', textContent: `0–${TX.maxGainDb} (BLADERF "SET GAIN TX"; HACKRF VGA, AMP OFF)` })),
      el('div', { className: 'cx-rx-row' }, el('span', { className: 'mono cx-tx-lab', textContent: 'TIMEOUT' }), tmo),
      el('h3', { textContent: 'HAILING FREQUENCY' }),
      el('div', { className: 'cx-rx-row' }, freq, el('span', { className: 'mono cx-rx-unit', textContent: 'MHz' })),
      el('div', { className: 'body-list' }, live ? pill('CLOSE HAILING FREQUENCY', () => close('operator'), 'cx-tx-close') : Object.assign(pill('OPEN HAILING FREQUENCY', () => { const r = open(freq.value); if (!r.ok) toast?.(r.error.toUpperCase()); }, 'cx-tx-open'), { disabled: !ready.length || !blocked.ok })),
      message ? el('p', { className: message.warn ? 'warn' : 'note', textContent: message.text }) : null,
      el('p', { className: 'note', textContent: `Amateur bands only, ITU Region ${regionOf(s.region)}: ${formatBands(s.region)}. Narrowband FM, ±2.5 kHz deviation, audio 300–3000 Hz with pre-emphasis and a limiter: ${TX.carsonHz / 1000} kHz wide by Carson's rule (the ≈10 kHz NFM channel). Station ID in CW at the end and every 10 minutes. Or say "Computer, open a hailing frequency 146".` }),
      el('div', {}, badge('reported', 'The band plan and identification rules as published (ITU Radio Regulations Art. 5, FCC Part 97 §97.119); you are responsible for your licence conditions.')),
    ];
  }

  /** ANTENNAS: the operator's list (name, bands, directional) and the one in use. */
  function antennaPanel(s) {
    const list = s.antennas, saveList = (antennas, extra = {}) => { save({ antennas, ...extra }); changed(); };
    const use = el('select', { className: 'cx-tx-select mono cx-tx-ant' },
      el('option', { value: '', textContent: '— SELECT THE ANTENNA IN USE —', selected: !list.some((a) => a.id === s.antennaId) }),
      list.map((a) => el('option', { value: a.id, textContent: `${a.name.toUpperCase()} · ${describeAntennaBands(a.bands).toUpperCase()}${a.directional ? ' · DIRECTIONAL' : ''}`, selected: a.id === s.antennaId })));
    use.addEventListener('change', () => { save({ antennaId: use.value || null }); message = null; changed(); });
    const rows = list.map((a, i) => {
      const name = el('input', { className: 'cx-rx-input mono cx-tx-call', value: a.name, maxLength: 40, title: 'Antenna name' });
      name.addEventListener('change', () => saveList(list.map((x, j) => (j === i ? { ...x, name: name.value.trim() || x.name } : x))));
      const band = ([k, l]) => { const c = el('input', { type: 'checkbox', checked: a.bands.includes(k) });
        c.addEventListener('change', () => saveList(list.map((x, j) => (j === i ? { ...x, bands: c.checked ? [...new Set([...x.bands, k])] : x.bands.filter((b) => b !== k) } : x))));
        return el('label', { className: 'cx-always mono' }, c, ` ${l.toUpperCase()}`); };
      const dir = el('input', { type: 'checkbox', checked: !!a.directional });
      dir.addEventListener('change', () => saveList(list.map((x, j) => (j === i ? { ...x, directional: dir.checked } : x))));
      return el('div', { className: `cx-tx-antrow${a.id === s.antennaId ? ' sel' : ''}` },
        el('div', { className: 'cx-rx-row' }, name, pill('✕', () => saveList(list.filter((_, j) => j !== i), a.id === s.antennaId ? { antennaId: null } : {}), 'square')),
        el('div', { className: 'cx-tx-bands' }, ANTENNA_BANDS.map(band), el('label', { className: 'cx-always mono' }, dir, ' DIRECTIONAL')),
        a.bands.length ? null : el('div', { className: 'mono cx-tx-unknown', textContent: 'BAND UNKNOWN: TICK THE BANDS IT IS BUILT FOR' }));
    });
    return [
      el('h3', { textContent: 'ANTENNAS' }),
      el('div', { className: 'cx-rx-row' }, el('span', { className: 'mono cx-tx-lab', textContent: 'IN USE' }), use),
      ...rows,
      el('div', { className: 'body-list' }, pill('ADD ANTENNA', () => saveList([...list, { id: `ant-${Date.now().toString(36)}`, name: `Antenna ${list.length + 1}`, bands: [], directional: false }]))),
      el('p', { className: 'note', textContent: 'Transmitting needs the antenna in use marked for the band (no tick = unknown, never transmits). A small HF loop or a random wire is a poor, possibly high-SWR match at 2 m / 70 cm. The list stays in this browser.' }),
    ];
  }

  return {
    indicator,
    panel,
    open,
    close,
    /** The backend's transmit-capable devices (null: unknown / no backend). */
    setDevices(d) { devices = d; },
    get devices() { return devices; },
    get live() { return live ? { freqHz: live.freqHz, status: live.status } : null; },
  };
}
