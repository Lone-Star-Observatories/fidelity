// LIVE SIGNALS · EARTH (#35): a flat map of places you can listen to or watch right now: internet
// radio stations, public SDR receivers, traffic cameras, observatory and volcano cams (and Windy
// webcams when the backend has a key). Markers come from the backend (/api/signals/:layer), which
// fetches and caches each open source; clicking lists what is under the cursor, each opening the
// operator's own page or stream in a new window (nothing third-party is embedded).

import { badge } from '../data/provenance.js';
import { CURATED_VIDEO, ago } from '../data/comms.js';
import { OBSERVATORIES } from '../data/observatories.js';

const STANDALONE = import.meta.env.MODE === 'standalone';
const el = (tag, props = {}, ...kids) => {
  const e = Object.assign(document.createElement(tag), props);
  for (const k of kids.flat()) if (k != null && k !== false) e.append(k);
  return e;
};
const pill = (label, on, onClick, extra = '') => {
  const b = el('button', { type: 'button', className: `pill cat${on ? '' : ' off'}${extra}`, textContent: label });
  b.addEventListener('click', onClick);
  return b;
};
const COLOURS = { radio: '#ff9900', kiwisdr: '#99ccff', traffic: '#cc6666', video: '#ffcc66', windy: '#cc99cc' };

// curated, bundled layer: observatory cams (#37) and volcano observatories
const VIDEO = {
  id: 'video', label: 'LIVE VIDEO · OBSERVATORIES & VOLCANOES', kind: 'camera', available: true,
  credit: 'Observatory webcams and streams as listed in the SITES layer (each operator\'s own page), and the USGS / Alaska volcano observatories\' webcam pages (US Government work, public domain).',
  licence: 'Operators\' own pages (linked, not embedded)',
  markers: [
    ...OBSERVATORIES.filter(([, , , , o]) => o.feeds?.length && o.url).map(([, name, lat, lon, o]) => {
      const yt = o.feeds.find((f) => f.kind === 'video')?.streams?.[0]?.id; // a YouTube live stream, for the COMMS viewscreen (#69)
      return [lat, lon, name, o.url, `${o.agency.toUpperCase()} · ${o.feeds.length} LIVE VIEW${o.feeds.length > 1 ? 'S' : ''}`, null, yt ? { youtube: yt } : null];
    }),
    ...CURATED_VIDEO,
  ],
};

/**
 * opts (COMMS, #69): only: layer ids to show; onPick(layerId, marker, layer): a primary button per
 * hit (pickLabel(layerId) names it); extra: [{ id, label, colour, kind, markers, credit, licence }]
 * bundled layers; title.
 */
export function createSignalsMap(opts = {}) {
  const want = (id) => !opts.only || opts.only.includes(id);
  const layers = new Map(want('video') ? [['video', { ...VIDEO, on: true, state: 'ready', count: VIDEO.markers.length, fetched: null }]] : []);
  for (const x of opts.extra ?? []) { layers.set(x.id, { on: true, state: 'ready', count: x.markers.length, fetched: null, available: true, ...x }); if (x.colour) COLOURS[x.id] = x.colour; }
  const node = el('section', { className: 'sv-card sm-card' },
    el('div', { className: 'sv-card-head' }, el('h3', { textContent: opts.title ?? 'LIVE SIGNALS · EARTH' }),
      badge('reported', 'Marker positions are as published by each directory or operator; the feeds behind them are live.')));
  const pills = el('div', { className: 'im-pills sm-pills' });
  const canvas = el('canvas', { className: 'sm-canvas' });
  const frame = el('div', { className: 'sm-frame' }, canvas,
    el('div', { className: 'sm-zoom' }, ...[['+', 1.6], ['−', 1 / 1.6], ['⟲', 0]].map(([l, f]) => {
      const b = el('button', { type: 'button', className: 'pill square', textContent: l });
      b.addEventListener('click', () => { if (f) zoomAt(view.cx, view.cy, f); else Object.assign(view, { cx: 0, cy: 0, z: 1 }); draw(); });
      return b;
    })));
  const info = el('div', { className: 'sm-info' }, el('p', { className: 'note', textContent: 'Click a marker to see what is there; scroll or use + / − to zoom, drag to pan.' }));
  const credits = el('div', { className: 'sm-credits' });
  const notes = el('p', { className: 'note', textContent: STANDALONE
    ? 'Radio stations, SDR receivers and traffic cameras load through the local backend (npm start); this preview shows only the bundled observatory and volcano views.'
    : 'Radio Garden (no public API) and the WebSDR.org list (re-use needs permission) are links only, awaiting permission. Aircraft (OpenSky) are not shown yet.' });
  node.append(pills, frame, info, credits, notes);

  // ---- view: equirectangular, centre (cx lon, cy lat) and zoom ----------------------------------
  const view = { cx: 0, cy: 0, z: 1 };
  let W = 0, H = 0, texture = null;
  const toXY = (lat, lon) => [W / 2 + ((lon - view.cx) / 360) * W * view.z, H / 2 - ((lat - view.cy) / 180) * H * view.z];
  const toLL = (x, y) => [view.cy - ((y - H / 2) / (H * view.z)) * 180, view.cx + ((x - W / 2) / (W * view.z)) * 360];
  const clampView = () => {
    view.z = Math.min(48, Math.max(1, view.z));
    const hx = 180 / view.z, hy = 90 / view.z;
    view.cx = Math.min(180 - hx, Math.max(-180 + hx, view.cx));
    view.cy = Math.min(90 - hy, Math.max(-90 + hy, view.cy));
  };
  function zoomAt(lat, lon, f) {
    // keep (lat, lon) under the same screen point
    const [x, y] = toXY(lat, lon);
    view.z *= f;
    clampView();
    const [lat2, lon2] = toLL(x, y);
    view.cx += lon - lon2; view.cy += lat - lat2;
    clampView();
  }

  if (!STANDALONE) {
    const img = new Image();
    img.onload = () => { texture = img; draw(); };
    img.src = '/api/texture/earth';
  }

  function draw() {
    const dpr = window.devicePixelRatio || 1;
    W = canvas.clientWidth; H = Math.round(W / 2);
    if (!W) return;
    canvas.style.height = `${H}px`;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    const g = canvas.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#05070c'; g.fillRect(0, 0, W, H);
    const [x0, y0] = toXY(90, -180), [x1, y1] = toXY(-90, 180);
    if (texture) { g.globalAlpha = 0.75; g.drawImage(texture, x0, y0, x1 - x0, y1 - y0); g.globalAlpha = 1; }
    g.strokeStyle = 'rgba(153,153,255,0.18)'; g.lineWidth = 1;
    for (let lon = -180; lon <= 180; lon += 30) { const [x] = toXY(0, lon); g.beginPath(); g.moveTo(x, y0); g.lineTo(x, y1); g.stroke(); }
    for (let lat = -60; lat <= 60; lat += 30) { const [, y] = toXY(lat, 0); g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke(); }
    const r = Math.min(4, 1.6 + view.z * 0.25);
    for (const [id, l] of layers) {
      if (!l.on || !l.markers) continue;
      g.fillStyle = COLOURS[id] ?? '#fff';
      g.globalAlpha = id === 'video' ? 1 : 0.8;
      for (const m of l.markers) {
        const [x, y] = toXY(m[0], m[1]);
        if (x < -5 || y < -5 || x > W + 5 || y > H + 5) continue;
        g.beginPath(); g.arc(x, y, id === 'video' ? r + 1.5 : r, 0, 2 * Math.PI); g.fill();
      }
    }
    g.globalAlpha = 1;
  }

  function hits(px, py, max = 14) {
    const out = [];
    for (const [id, l] of layers) {
      if (!l.on || !l.markers) continue;
      for (const m of l.markers) {
        const [x, y] = toXY(m[0], m[1]);
        const d = Math.hypot(x - px, y - py);
        if (d < 8) out.push({ d, id, m });
      }
    }
    return out.sort((a, b) => a.d - b.d).slice(0, max);
  }
  const local = (e) => { const b = canvas.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };

  function showInfo(list, total) {
    if (!list.length) { info.replaceChildren(el('p', { className: 'note', textContent: 'Nothing here. Zoom in on a cluster to separate markers.' })); return; }
    info.replaceChildren(...list.map(({ id, m }) => {
      const l = layers.get(id);
      const [lat, lon, name, href, detail, extra] = m;
      const primary = opts.onPick ? el('button', { type: 'button', className: 'pill cm-link sm-pick', textContent: opts.pickLabel?.(id) ?? 'SELECT', onclick: () => opts.onPick(id, m, l) }) : null;
      const links = [[l.kind === 'audio' ? 'HOMEPAGE ↗' : l.kind === 'sdr' ? 'OPEN RECEIVER ↗' : id === 'traffic' ? 'CURRENT IMAGE ↗' : 'OPEN ↗', href]];
      if (id === 'radio' && extra) links.push(['LISTEN ↗', extra]);
      if (id === 'traffic' && extra) links.push([/\.m3u8/.test(extra) ? 'HLS VIDEO ↗' : 'VIDEO CLIP ↗', extra]);
      return el('div', { className: 'cm-entry sm-hit' },
        el('div', { className: 'cm-head' }, el('span', { className: 'sm-dot', style: `background:${COLOURS[id]}` }), el('span', { className: 'cm-name', textContent: name }),
          badge('reported', `${l.credit}${l.fetched ? `\nList fetched ${l.fetched}` : ''}`)),
        el('div', { className: 'cm-val mono', textContent: `${detail} · ${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(2)}°${lon >= 0 ? 'E' : 'W'}` }),
        el('div', { className: 'cm-meta' },
          el('span', { className: 'cm-status', textContent: id === 'kiwisdr' ? (extra === 1 ? 'FREE SLOT NOW' : extra === 0 ? 'FULL NOW' : '') : id === 'video' ? 'OPERATOR PAGE' : 'LISTED LIVE' }),
          el('span', { textContent: l.label }), l.fetched ? el('span', { className: 'mono', textContent: `LIST ${ago(l.fetched)}` }) : null,
          primary, ...links.filter(([, u]) => u).map(([t, u]) => el('a', { className: 'pill cm-link', href: u, target: '_blank', rel: 'noopener noreferrer', textContent: t }))));
    }), total > list.length ? el('p', { className: 'note', textContent: `+${total - list.length} more here: zoom in.` }) : null);
  }

  // ---- interaction -------------------------------------------------------------------------------
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, cx: view.cx, cy: view.cy, moved: false }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => {
    if (drag) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.hypot(dx, dy) > 3) drag.moved = true;
      if (drag.moved) { view.cx = drag.cx - (dx / (W * view.z)) * 360; view.cy = drag.cy + (dy / (H * view.z)) * 180; clampView(); draw(); }
      return;
    }
    const [x, y] = local(e);
    const h = hits(x, y, 1);
    canvas.style.cursor = h.length ? 'pointer' : 'grab';
    canvas.title = h.length ? h[0].m[2] : '';
  });
  canvas.addEventListener('pointerup', (e) => {
    const wasDrag = drag?.moved;
    drag = null;
    if (wasDrag) return;
    const [x, y] = local(e);
    const all = hits(x, y, 1e6);
    showInfo(all.slice(0, 14), all.length);
  });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const [x, y] = local(e);
    const [lat, lon] = toLL(x, y);
    zoomAt(lat, lon, e.deltaY < 0 ? 1.25 : 1 / 1.25);
    draw();
  }, { passive: false });
  const ro = new ResizeObserver(() => draw());
  ro.observe(canvas);

  // ---- layers ------------------------------------------------------------------------------------
  function drawPills() {
    pills.replaceChildren(el('span', { className: 'im-label', textContent: 'SHOW' }), ...[...layers].map(([id, l]) => {
      const n = l.state === 'ready' ? ` · ${l.count.toLocaleString()}` : l.state === 'loading' ? ' · …' : l.state === 'error' ? ' · UNAVAILABLE' : l.state === 'nokey' ? ' · NEEDS KEY' : '';
      const b = pill(`${l.label}${n}`, l.on && l.state === 'ready', () => { l.on = !l.on; drawPills(); draw(); }, l.state === 'ready' ? '' : ' sm-wait');
      b.style.setProperty('--dot', COLOURS[id] ?? '#fff');
      if (l.state !== 'ready') b.disabled = l.state !== 'loading';
      return b;
    }), ...(STANDALONE ? [] : [['WEBSDR.ORG ↗', 'http://websdr.org/'], ['RADIO GARDEN ↗', 'https://radio.garden/']].map(([t, u]) =>
      el('a', { className: 'pill sm-await', href: u, target: '_blank', rel: 'noopener noreferrer', textContent: `${t.replace(' ↗', '')} · AWAITING PERMISSION ↗` }))));
    credits.replaceChildren(...[...layers.values()].filter((l) => l.on && l.state === 'ready').map((l) =>
      el('p', { className: 'note credit', textContent: `${l.label}: ${l.credit} Licence: ${l.licence}.${l.fetched ? ` List fetched ${l.fetched.slice(0, 16).replace('T', ' ')} UTC.` : ''}` })));
  }
  drawPills();
  let dead = false;
  if (!STANDALONE) {
    fetch('/api/signals').then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status)))).then((d) => {
      for (const l of d.layers) {
        if (!want(l.id)) continue;
        layers.set(l.id, { ...l, on: true, state: l.available ? 'loading' : 'nokey', count: 0, markers: null });
        if (!l.available) continue;
        fetch(`/api/signals/${l.id}`).then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status)))).then((x) => {
          if (dead) return;
          Object.assign(layers.get(l.id), { state: 'ready', markers: x.markers, count: x.count, fetched: x.fetched });
          drawPills(); draw();
        }).catch(() => { if (!dead) { layers.get(l.id).state = 'error'; drawPills(); } });
      }
      // put the curated layer last so it draws on top
      const v = layers.get('video'); if (v) { layers.delete('video'); layers.set('video', v); }
      drawPills();
    }).catch(() => {});
  }
  requestAnimationFrame(draw);
  return {
    node, tick() {}, dispose() { dead = true; ro.disconnect(); },
    /** Replace a bundled layer's markers (e.g. the local SDR once detected). */
    setExtra(id, markers) { const l = layers.get(id); if (l) { l.markers = markers; l.count = markers.length; drawPills(); draw(); } },
    /** Fly the map to a point. */
    focus(lat, lon, z = 4) { view.cx = lon; view.cy = lat; view.z = z; clampView(); draw(); },
    redraw: () => draw(),
  };
}
