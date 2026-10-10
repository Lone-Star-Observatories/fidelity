// "Computer" (#21): say the wake word, ask, and the ship answers out loud.
//
//   Listening: the microphone feeds the local wake-word spotter (wake.js) and nothing else.
//   Wake: a chirp, then the next utterance streams through the backend relay (/api/voice) to
//     the OpenAI Realtime API with the current view and panel facts as context; the reply is
//     spoken and transcribed. The model can act: go to a body, toggle a layer, set the clock.
//   Barge-in: the wake word during a reply stops it ("Computer, stop" stops too).
//   Offline or no key: on-device speech recognition (where the browser offers it) handles
//     navigation commands; otherwise push-to-talk explains what is missing.

import { RATE, createEndpointer, matchWake, loadTemplates, saveTemplates, resampler } from './wake.js';

const OUT_RATE = 24000;
const TAP = `class Tap extends AudioWorkletProcessor { process(i) { const c = i[0] && i[0][0]; if (c) this.port.postMessage(c.slice(0)); return true; } }
registerProcessor('fidelity-tap', Tap);`;

/** PCM16 little-endian base64 of Float32 samples. */
export function pcm16Base64(x) {
  const b = new Uint8Array(x.length * 2);
  for (let i = 0; i < x.length; i++) { const v = Math.max(-1, Math.min(1, x[i])) * 0x7fff; b[2 * i] = v & 255; b[2 * i + 1] = (v >> 8) & 255; }
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}
/** Float32 samples from PCM16 base64. */
export function base64Pcm16(b64) {
  const s = atob(b64), n = s.length >> 1, out = new Float32Array(n);
  for (let i = 0; i < n; i++) { let v = s.charCodeAt(2 * i) | (s.charCodeAt(2 * i + 1) << 8); if (v >= 0x8000) v -= 0x10000; out[i] = v / 0x8000; }
  return out;
}

/** Parse a spoken navigation command (offline fallback): { action, target } or null. */
export function parseCommand(text, names) {
  const t = text.toLowerCase().replace(/^computer[, ]*/, '').trim();
  const find = (s) => names.find((n) => s.includes(n.name.toLowerCase()));
  let m = t.match(/^(?:go|take me|fly|warp|set course) (?:to |for )?(.+)$/);
  if (m) { const n = find(m[1]); return n ? { action: 'go', target: n } : null; }
  m = t.match(/^(show|hide|turn on|turn off) (?:the )?(.+)$/);
  if (m) {
    const LAYERS = { labels: 'labels', orbits: 'orbits', belts: 'belts', asteroids: 'belts', satellites: 'satellites', zones: 'zones', 'van allen': 'zones', axes: 'axes', fields: 'fields', field: 'fields' };
    const key = Object.keys(LAYERS).sort((a, b) => b.length - a.length).find((k) => m[2].includes(k)); // 'van allen' before 'belts'
    return key ? { action: 'layer', layer: LAYERS[key], on: m[1] === 'show' || m[1] === 'turn on' } : null;
  }
  if (/^(stop|cancel|never mind|silence)\b/.test(t)) return { action: 'stop' };
  return null;
}

const TOOLS = [
  { type: 'function', name: 'go_to', description: 'Fly the ship to a body (planet, moon, star, spacecraft, satellite) or star system by name.', parameters: { type: 'object', properties: { name: { type: 'string', description: 'e.g. Europa, Jupiter, Proxima Centauri, ISS, Voyager 1' } }, required: ['name'] } },
  { type: 'function', name: 'set_layer', description: 'Show or hide a display layer.', parameters: { type: 'object', properties: { layer: { type: 'string', enum: ['labels', 'orbits', 'belts', 'satellites', 'zones', 'axes', 'fields', 'liveSkins'] }, on: { type: 'boolean' } }, required: ['layer', 'on'] } },
  { type: 'function', name: 'set_time', description: "Set the ship's clock to a date/time (ISO 8601, UTC), or 'now'.", parameters: { type: 'object', properties: { iso: { type: 'string' } }, required: ['iso'] } },
];
const PERSONA = `You are the computer of the starship USS Fidelity, a scientific astronomy explorer. Speak like a ship's computer: calm, precise, brief (two to four sentences unless asked for more). Answer about what the viewer is looking at, using the on-screen facts below when they help; say plainly when something is unknown or modelled. You can act with the tools (fly somewhere, toggle a layer, set the clock) when the viewer asks.`;

/**
 * The voice controller. `ctx` supplies the app: context() → string (view + selection + panel
 * facts), names() → [{ name, go() }], setLayer(name, on), setTime(iso), onState(state, detail).
 */
export function createComputer(ctx) {
  let audio = null, mic = null, node = null, ws = null, wsReady = null, state = 'off', wake = loadTemplates();
  let toWake = null, toUp = null, endpointer = null, streaming = false, enrol = null, playing = [], playEnd = 0, outCtx = null, localRec = null;
  const log = [];
  const set = (s, detail) => { state = s; ctx.onState?.(s, detail, log); };
  const say = (who, text) => { if (!text) return; const last = log.at(-1); if (last && last.who === who && last.open) last.text += text; else log.push({ who, text, open: true }); ctx.onState?.(state, null, log); };
  const closeLine = () => { const last = log.at(-1); if (last) last.open = false; };

  async function chirp(up = true) {
    try {
      outCtx ??= new AudioContext({ sampleRate: OUT_RATE });
      const t = outCtx.currentTime, o = outCtx.createOscillator(), g = outCtx.createGain();
      o.frequency.setValueAtTime(up ? 880 : 1320, t); o.frequency.setValueAtTime(up ? 1320 : 880, t + 0.09);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.15, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      o.connect(g).connect(outCtx.destination); o.start(t); o.stop(t + 0.22);
    } catch { /* no audio */ }
  }

  // ---- microphone --------------------------------------------------------------------------
  async function startMic() {
    if (mic) return;
    mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    audio = new AudioContext();
    await audio.audioWorklet.addModule(URL.createObjectURL(new Blob([TAP], { type: 'text/javascript' })));
    node = new AudioWorkletNode(audio, 'fidelity-tap');
    audio.createMediaStreamSource(mic).connect(node);
    toWake = resampler(audio.sampleRate, RATE);
    toUp = resampler(audio.sampleRate, OUT_RATE);
    endpointer = createEndpointer((u) => onUtterance(u));
    node.port.onmessage = (e) => {
      const x = e.data;
      if (streaming && ws?.readyState === 1) ws.send(JSON.stringify({ type: 'input_audio_buffer.append', audio: pcm16Base64(toUp(x)) }));
      else toUp(x); // keep the resampler's phase
      endpointer.push(toWake(x));
    };
  }
  function stopMic() {
    mic?.getTracks().forEach((t) => t.stop());
    audio?.close().catch(() => {});
    mic = audio = node = null;
  }

  function onUtterance(u) {
    if (enrol) { enrol.got.push(u); enrol.step?.(enrol.got.length); return; }
    if (!wake || streaming) return;
    const { match } = matchWake(u, wake);
    if (match) wakeUp();
  }

  // ---- the relay ---------------------------------------------------------------------------
  function connect() {
    if (ws && ws.readyState <= 1) return wsReady;
    ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/voice`);
    wsReady = new Promise((resolve, reject) => {
      ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.type === 'relay.open') resolve(); onEvent(m); };
      ws.onerror = () => reject(new Error('relay unavailable'));
      ws.onclose = () => { ws = null; streaming = false; if (state !== 'off') set('listening'); };
    });
    return wsReady;
  }
  const send = (m) => ws?.readyState === 1 && ws.send(JSON.stringify(m));
  function sessionUpdate() {
    send({ type: 'session.update', session: {
      type: 'realtime', instructions: `${PERSONA}\n\nON SCREEN NOW:\n${ctx.context()}`, output_modalities: ['audio'], tools: TOOLS, tool_choice: 'auto',
      audio: {
        input: { format: { type: 'audio/pcm', rate: OUT_RATE }, turn_detection: { type: 'server_vad', silence_duration_ms: 700, create_response: true }, transcription: { model: 'gpt-4o-mini-transcribe' } },
        output: { format: { type: 'audio/pcm', rate: OUT_RATE }, voice: 'alloy' },
      },
    } });
  }

  function onEvent(m) {
    const t = m.type;
    if (t === 'error') { say('ship', `⚠ ${m.error?.message ?? 'error'}`); closeLine(); return; }
    if (t === 'input_audio_buffer.speech_stopped') { streaming = false; set('thinking'); }
    if (t === 'conversation.item.input_audio_transcription.completed') {
      say('you', m.transcript); closeLine();
      if (/^\s*(computer[, ]*)?(stop|cancel|silence)\b/i.test(m.transcript ?? '')) stopSpeaking();
    }
    if (t === 'response.output_audio.delta' || t === 'response.audio.delta') { set('speaking'); play(base64Pcm16(m.delta)); }
    if (t === 'response.output_audio_transcript.delta' || t === 'response.audio_transcript.delta') say('ship', m.delta);
    if (t === 'response.function_call_arguments.done') runTool(m.name, m.arguments, m.call_id);
    if (t === 'response.done') {
      closeLine();
      const calls = (m.response?.output ?? []).filter((o) => o.type === 'function_call');
      if (calls.length) send({ type: 'response.create' }); // speak after acting
      else setTimeout(() => { if (state === 'speaking' || state === 'thinking') set('listening'); }, Math.max(0, (playEnd - (outCtx?.currentTime ?? 0)) * 1000));
    }
  }

  function runTool(name, args, callId) {
    let out;
    try {
      const a = JSON.parse(args || '{}');
      if (name === 'go_to') {
        const n = ctx.names().find((x) => x.name.toLowerCase() === String(a.name).toLowerCase()) ?? ctx.names().find((x) => x.name.toLowerCase().includes(String(a.name).toLowerCase()));
        if (n) { n.go(); out = { ok: true, flying_to: n.name }; } else out = { ok: false, error: `no body called ${a.name} in the loaded catalogues` };
      } else if (name === 'set_layer') { ctx.setLayer(a.layer, !!a.on); out = { ok: true }; }
      else if (name === 'set_time') { out = ctx.setTime(a.iso) ? { ok: true } : { ok: false, error: 'unreadable date' }; }
      else out = { ok: false, error: 'unknown tool' };
    } catch (err) { out = { ok: false, error: String(err.message || err) }; }
    send({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: callId, output: JSON.stringify(out) } });
  }

  // ---- playback ----------------------------------------------------------------------------
  function play(x) {
    outCtx ??= new AudioContext({ sampleRate: OUT_RATE });
    const buf = outCtx.createBuffer(1, x.length, OUT_RATE);
    buf.copyToChannel(x, 0);
    const src = outCtx.createBufferSource();
    src.buffer = buf; src.connect(outCtx.destination);
    playEnd = Math.max(playEnd, outCtx.currentTime + 0.05);
    src.start(playEnd);
    playEnd += buf.duration;
    playing.push(src);
    src.onended = () => { playing = playing.filter((p) => p !== src); };
  }
  function stopSpeaking() {
    for (const p of playing) { try { p.stop(); } catch { /* done */ } }
    playing = []; playEnd = 0;
    send({ type: 'response.cancel' });
    if (state === 'speaking' || state === 'thinking') set('listening');
  }

  // ---- a turn ------------------------------------------------------------------------------
  async function wakeUp() {
    if (state === 'speaking' || state === 'thinking') stopSpeaking(); // barge-in
    chirp(true);
    const status = await ctx.status();
    if (!status?.configured) return localCommand(status);
    set('connecting');
    try { await connect(); } catch { say('ship', '⚠ The voice relay is unavailable: run the local backend (npm start).'); closeLine(); set('listening'); return; }
    sessionUpdate();
    streaming = true;
    set('hearing');
  }

  /** No key: try the browser's on-device recogniser for navigation commands. */
  async function localCommand(status) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const local = SR && SR.available ? await SR.available({ langs: ['en-US'], processLocally: true }).catch(() => 'unavailable') : 'unavailable';
    if (!SR || local !== 'available') {
      say('ship', status ? 'Voice answers need an OpenAI key on the local backend (FIDELITY_OPENAI_KEY). On-device recognition for commands is not available in this browser.' : 'Voice needs the local backend (npm start).');
      closeLine(); set('listening'); return;
    }
    set('hearing');
    localRec = new SR();
    localRec.lang = 'en-US'; localRec.processLocally = true; localRec.interimResults = false;
    localRec.onresult = (e) => {
      const text = e.results[0][0].transcript;
      say('you', text); closeLine();
      const c = parseCommand(text, ctx.names());
      if (c?.action === 'go') { c.target.go(); say('ship', `Setting course for ${c.target.name}.`); }
      else if (c?.action === 'layer') { ctx.setLayer(c.layer, c.on); say('ship', `${c.on ? 'Showing' : 'Hiding'} ${c.layer}.`); }
      else say('ship', 'Offline I can only take navigation commands: "go to Mars", "show the zones".');
      closeLine();
    };
    localRec.onend = () => { localRec = null; set('listening'); };
    localRec.start();
  }

  return {
    get state() { return state; },
    get trained() { return !!wake; },
    get log() { return log; },
    /** Start or stop listening for the wake word. */
    async listen(on) {
      if (!on) { stopSpeaking(); streaming = false; ws?.close(); stopMic(); set('off'); return; }
      await startMic();
      set(wake ? 'listening' : 'untrained');
    },
    /** Push-to-talk: a turn without the wake word. */
    async talk() { await startMic(); wakeUp(); },
    stop: stopSpeaking,
    /** Record the wake word `n` times; `onStep(k)` after each. */
    async train(n = 3, onStep = () => {}) {
      await startMic();
      set('training');
      const got = await new Promise((resolve) => { enrol = { got: [], step: (k) => { onStep(k); chirp(false); if (k >= n) resolve(enrol.got); } }; });
      enrol = null;
      wake = saveTemplates(got);
      set('listening');
      return wake;
    },
  };
}
