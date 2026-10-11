// LIVE SIGNALS · EARTH (#35): a line-art map (LCARS tactical style: today's coastlines and borders,
// Natural Earth via src/data/worldmap.js) of places you can listen to or watch right now: internet
// radio stations, public SDR receivers, traffic and weather cameras, live YouTube webcams and
// observatory cams. Markers come from the backend (/api/signals/:layer), which
// fetches and caches each open source; clicking lists what is under the cursor, each opening the
// operator's own page or stream in a new window (nothing third-party is embedded).

import { badge } from '../data/provenance.js';
import { CURATED_VIDEO, ago } from '../data/comms.js';
import { OBSERVATORIES } from '../data/observatories.js';
import { decodeWorld, countryAt } from '../data/worldmap.js';

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
const COLOURS = { stations: '#66cc66', websdr: '#66ccff', radio: '#ff9900', kiwisdr: '#99ccff', traffic: '#cc6666', trafficcams: '#cc8866', worldcams: '#cc99cc', video: '#ffcc66' };

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
 * bundled layers; title; fill: the map takes its frame's height (CSS) instead of a 2:1 strip.
 */
export function createSignalsMap(opts = {}) {
  const want = (id) => !opts.only || opts.only.includes(id);
  const layers = new Map(want('video') ? [['video', { ...VIDEO, on: true, state: 'ready', count: VIDEO.markers.length, fetched: null }]] : []);
  for (const x of opts.extra ?? []) { layers.set(x.id, { on: true, state: 'ready', count: x.markers.length, fetched: null, available: true, ...x }); if (x.colour) COLOURS[x.id] = x.colour; }
  const node = el('section', { className: `sv-card sm-card${opts.fill ? ' sm-fillcard' : ''}` },
    el('div', { className: 'sv-card-head' }, el('h3', { textContent: opts.title ?? 'LIVE SIGNALS · EARTH' }),
      badge('reported', 'Marker positions are as published by each directory or operator; the feeds behind them are live.')));
  const pills = el('div', { className: 'im-pills sm-pills' });
  const canvas = el('canvas', { className: 'sm-canvas' });
  const tip = el('div', { className: 'sm-tip', hidden: true });
  const readout = el('div', { className: 'sm-readout mono' });
  const frame = el('div', { className: `sm-frame${opts.fill ? ' sm-fill' : ''}` }, canvas, tip, readout,
    el('div', { className: 'sm-lcars-top' }, el('span', { className: 'sm-lcars-title', textContent: opts.title ?? 'LIVE SIGNALS · EARTH' })),
    el('div', { className: 'sm-lcars-side' }, el('i'), el('i'), el('i'), el('i')),
    el('div', { className: 'sm-zoom' }, ...[['+', 1.6], ['−', 1 / 1.6], ['⟲', 0]].map(([l, f]) => {
      const b = el('button', { type: 'button', className: 'pill square', textContent: l });
      b.addEventListener('click', () => { if (f) zoomAt(view.cy, view.cx, f); else Object.assign(view, { cx: 0, cy: 0, z: 1 }); clampView(); draw(); });
      return b;
    })));
  const info = el('div', { className: 'sm-info' }, el('p', { className: 'note', textContent: 'Point at a marker for its details; click to list what is there. Scroll or + / − to zoom, drag to pan.' }));
  const credits = el('div', { className: 'sm-credits' });
  const notes = el('p', { className: 'note', textContent: STANDALONE
    ? 'Radio stations, SDR receivers and traffic cameras load through the local backend (npm start); this preview shows only the bundled observatory and volcano views.'
    : 'Stations by city and WebSDR receivers come from the lists you supplied in data/ (local only). Aircraft (OpenSky) are not shown yet.' });
  node.append(pills, frame, info, credits, notes);

  // ---- view: equirectangular, centre (cx lon, cy lat), zoom z; at z = 1 the map covers the frame -----
  const view = { cx: 0, cy: 0, z: 1 };
  let W = 0, H = 0, world = null, paths = null, hover = null, hoverCountry = null;
  const scale = () => Math.max(W / 360, H / 180) * view.z; // px per degree
  const toXY = (lat, lon) => { const k = scale(); return [W / 2 + (lon - view.cx) * k, H / 2 - (lat - view.cy) * k]; };
  const toLL = (x, y) => { const k = scale(); return [view.cy - (y - H / 2) / k, view.cx + (x - W / 2) / k]; };
  const clampView = () => {
    view.z = Math.min(64, Math.max(1, view.z));
    const k = scale() || 1, hx = Math.min(180, W / 2 / k), hy = Math.min(90, H / 2 / k);
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

  // today's coastlines and borders, as paths in degrees (drawn under a lon/lat → px transform)
  const ringPath = (p, r) => r.forEach(([lon, lat], j) => (j ? p.lineTo(lon, lat) : p.moveTo(lon, lat)));
  fetch(`${import.meta.env.BASE_URL ?? '/'}shapes/world-50m.json`).then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status)))).then((topo) => {
    world = decodeWorld(topo);
    const line = (ids) => { const p = new Path2D(); for (const i of ids) ringPath(p, world.arcs[i]); return p; };
    const land = new Path2D();
    for (const c of world.countries) for (const poly of c.polys) for (const r of poly) ringPath(land, r);
    paths = { land, coast: line(world.coast), borders: line(world.borders) };
    draw();
  }).catch(() => {}); // the grid alone (e.g. the standalone preview, which doesn't bundle the outlines)
  const countryPath = (c) => (c.path ??= (() => { const p = new Path2D(); for (const poly of c.polys) for (const r of poly) ringPath(p, r); return p; })());

  /**
   * Paint the map on `g` (in CSS px; `dpr` is the canvas's device-pixel ratio) over a w × h area at
   * `s` px per degree, centred on the view. `k` scales markers and lines (a postcard is bigger).
   */
  function paint(g, w, h, s, { dpr = 1, k = 1, highlight = true } = {}) {
    const xy = (lat, lon) => [w / 2 + (lon - view.cx) * s, h / 2 - (lat - view.cy) * s];
    const bg = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
    bg.addColorStop(0, '#0a1430'); bg.addColorStop(1, '#03060f');
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    const [x0, y0] = xy(90, -180), [x1, y1] = xy(-90, 180);
    // graticule: 10° fine, 30° bold
    for (const [step, a] of [[10, 0.07], [30, 0.16]]) {
      g.strokeStyle = `rgba(110,150,255,${a})`; g.lineWidth = k; g.beginPath();
      for (let lon = -180; lon <= 180; lon += step) { const [x] = xy(0, lon); g.moveTo(x, y0); g.lineTo(x, y1); }
      for (let lat = -90; lat <= 90; lat += step) { const [, y] = xy(lat, 0); g.moveTo(x0, y); g.lineTo(x1, y); }
      g.stroke();
    }
    if (paths) {
      g.save();
      g.setTransform(dpr * s, 0, 0, -dpr * s, dpr * (w / 2 - view.cx * s), dpr * (h / 2 + view.cy * s));
      const hp = highlight && hoverCountry && countryPath(hoverCountry);
      for (const shift of [-360, 0, 360]) { // outlines are unwrapped across the antimeridian (worldmap.js)
        g.save(); g.translate(shift, 0);
        g.fillStyle = 'rgba(40,80,190,0.30)'; g.fill(paths.land, 'evenodd');
        if (hp) { g.fillStyle = 'rgba(120,170,255,0.28)'; g.fill(hp, 'evenodd'); }
        g.lineJoin = 'round';
        g.strokeStyle = 'rgba(120,160,255,0.45)'; g.lineWidth = (0.8 * k) / s; g.stroke(paths.borders);
        g.shadowColor = '#4f8cff'; g.shadowBlur = 6 * dpr * k;
        g.strokeStyle = '#8fb8ff'; g.lineWidth = (1.3 * k) / s; g.stroke(paths.coast);
        if (hp) { g.strokeStyle = '#d6e6ff'; g.lineWidth = (1.6 * k) / s; g.stroke(hp); }
        g.restore();
      }
      g.restore();
    }
    const r = Math.min(4.5, 1.8 + view.z * 0.25) * k;
    for (const [id, l] of layers) {
      if (!l.on || !l.markers) continue;
      g.fillStyle = COLOURS[id] ?? '#fff';
      g.globalAlpha = id === 'video' ? 1 : 0.85;
      for (const m of l.markers) {
        const [x, y] = xy(m[0], m[1]);
        if (x < -5 * k || y < -5 * k || x > w + 5 * k || y > h + 5 * k) continue;
        g.beginPath(); g.arc(x, y, id === 'video' ? r + 1.5 * k : r, 0, 2 * Math.PI); g.fill();
      }
    }
    g.globalAlpha = 1;
    if (highlight && hover) { // the marker under the cursor: a ring and crosshair ticks
      const [x, y] = xy(hover.m[0], hover.m[1]);
      g.strokeStyle = COLOURS[hover.id] ?? '#fff'; g.lineWidth = 2;
      g.beginPath(); g.arc(x, y, r + 6, 0, 2 * Math.PI); g.stroke();
      g.beginPath();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { g.moveTo(x + dx * (r + 9), y + dy * (r + 9)); g.lineTo(x + dx * (r + 15), y + dy * (r + 15)); }
      g.stroke();
    }
  }
  function draw() {
    const dpr = window.devicePixelRatio || 1;
    W = canvas.clientWidth; H = opts.fill ? canvas.clientHeight : Math.round(W / 2);
    if (!W || !H) return;
    if (!opts.fill) canvas.style.height = `${H}px`;
    clampView();
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    const g = canvas.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    paint(g, W, H, scale(), { dpr });
  }
  /** #40: the map as shown, repainted at w × h for a postcard (covering the card, markers scaled to match). */
  function snapshot(w, h) {
    const c = Object.assign(document.createElement('canvas'), { width: w, height: h });
    const s = Math.max(w / 360, h / 180) * view.z; // the screen's rule (cover the frame) at the card's size
    paint(c.getContext('2d'), w, h, s, { k: s / (scale() || s), highlight: false });
    return c;
  }
  /** #40: the credits of what the map shows (the outlines and each layer that is on). */
  const shownCredits = () => [...(paths ? ['MAP: Natural Earth 1:50m coastlines and borders (public domain)'] : []),
    ...[...layers.values()].filter((l) => l.on && l.state === 'ready').map((l) => `${l.label}: ${l.credit}`)];

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
      if ((id === 'radio' || id === 'stations') && extra) links.push([id === 'stations' && m[6]?.n > 1 ? `LISTEN (1 OF ${m[6].n}) ↗` : 'LISTEN ↗', extra]);
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
      if (drag.moved) { const k = scale(); view.cx = drag.cx - dx / k; view.cy = drag.cy + dy / k; clampView(); tip.hidden = true; draw(); }
      return;
    }
    const [x, y] = local(e);
    const h = hits(x, y, 1e6);
    canvas.style.cursor = h.length ? 'pointer' : 'grab';
    const [lat, lon] = toLL(x, y);
    const c = !h.length && world ? countryAt(world, lat, lon) : null;
    readout.textContent = `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(2)}°${lon >= 0 ? 'E' : 'W'}${c ? ` · ${c.name.toUpperCase()}` : ''}`;
    const nh = h[0] ?? null;
    if (nh?.m !== hover?.m || c !== hoverCountry) { hover = nh; hoverCountry = c; draw(); }
    showTip(nh, h.length, x, y);
  });
  canvas.addEventListener('pointerleave', () => { tip.hidden = true; readout.textContent = ''; if (hover || hoverCountry) { hover = hoverCountry = null; draw(); } });
  /** The hover card: name, what it is, where, which list; how many more are under the cursor. */
  function showTip(h, n, x, y) {
    if (!h) { tip.hidden = true; return; }
    const l = layers.get(h.id), [lat, lon, name, , detail] = h.m;
    tip.replaceChildren(
      el('div', { className: 'sm-tip-name' }, el('span', { className: 'sm-dot', style: `background:${COLOURS[h.id]}` }), ` ${name}`),
      detail ? el('div', { className: 'sm-tip-row mono', textContent: detail }) : null,
      el('div', { className: 'sm-tip-row mono', textContent: `${l.label} · ${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(2)}°${lon >= 0 ? 'E' : 'W'}` }),
      el('div', { className: 'sm-tip-row mono dim', textContent: n > 1 ? `+${n - 1} MORE HERE · CLICK TO LIST` : 'CLICK FOR DETAILS' }));
    tip.hidden = false;
    const fw = frame.clientWidth, tw = tip.offsetWidth, th = tip.offsetHeight;
    tip.style.left = `${Math.max(8, Math.min(fw - tw - 8, x + 16))}px`;
    tip.style.top = `${y - th - 12 < 8 ? y + 18 : y - th - 12}px`;
  }
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
      const n = l.state === 'ready' ? ` · ${l.count.toLocaleString()}` : l.state === 'loading' ? ' · …' : l.state === 'error' ? ' · UNAVAILABLE' : l.state === 'nokey' ? (l.needsFile ? ' · NEEDS LOCAL EXPORT' : ' · NEEDS KEY') : '';
      const b = pill(`${l.label}${n}`, l.on && l.state === 'ready', () => { l.on = !l.on; drawPills(); draw(); }, l.state === 'ready' ? '' : ' sm-wait');
      b.style.setProperty('--dot', COLOURS[id] ?? '#fff');
      if (l.state !== 'ready') b.disabled = l.state !== 'loading';
      return b;
    }), ...(STANDALONE ? [] : [].map(([t, u]) =>
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
    snapshot, shownCredits,
  };
}
