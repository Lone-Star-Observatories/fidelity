// POSTCARD (#40): capture the current view as a polished image and save or share it. The view is
// re-rendered at the chosen size (views/snapshot.js), labels included; an optional LCARS frame carries
// the place, the dates and the epoch. The provenance line and the image credits are always stamped,
// so CC BY attribution travels with the picture and artwork is never passed off as real.
// Images stay on this machine; the opt-in AI STYLIZE step sends one to OpenAI through the local
// backend (server/stylize.js) after saying so, and stamps the result AI-STYLIZED · IMAGINED.

import { SIZES, frameLayout, provenanceLine, hasImagined, epochLabel, captionFor, shareLinks, STYLES, stylePrompt, editSize, costEstimate, fileName } from './postcard-core.js';

const FONT = "'Antonio', 'Arial Narrow', 'Roboto Condensed', sans-serif";
const C = { orange: '#ff9900', gold: '#ffcc66', peach: '#ffcc99', apricot: '#ff9966', lilac: '#cc99cc', blue: '#9999ff', ice: '#99ccff', rose: '#cc6666', dim: '#b39c86' };

/** Shrink `text` to fit `maxW` at up to `px` (down to 55% of it), then clip with an ellipsis. */
function fitText(g, text, x, y, maxW, px, { weight = 400, color = C.peach, align = 'left' } = {}) {
  let size = px;
  g.font = `${weight} ${size}px ${FONT}`;
  while (g.measureText(text).width > maxW && size > px * 0.55) { size -= 1; g.font = `${weight} ${size}px ${FONT}`; }
  let t = text;
  while (t.length > 4 && g.measureText(t).width > maxW) t = `${t.slice(0, -2).trimEnd()}…`;
  g.fillStyle = color; g.textAlign = align; g.textBaseline = 'middle';
  g.fillText(t, x, y);
  return size;
}
/** Wrap `text` into at most `lines` lines of `maxW`, shrinking the font until it fits. */
function wrapText(g, text, x, y, maxW, px, lines, color) {
  let size = px;
  for (;;) {
    g.font = `400 ${size}px ${FONT}`;
    const words = text.split(' '), out = [''];
    for (const w of words) { const t = out.at(-1) ? `${out.at(-1)} ${w}` : w; if (g.measureText(t).width <= maxW || !out.at(-1)) out[out.length - 1] = t; else out.push(w); }
    if (out.length <= lines || size <= px * 0.6) {
      g.fillStyle = color; g.textAlign = 'left'; g.textBaseline = 'middle';
      out.slice(0, lines).forEach((l, i) => g.fillText(i === lines - 1 && out.length > lines ? `${l}…` : l, x, y + i * size * 1.2));
      return;
    }
    size -= 1;
  }
}
const rrect = (g, x, y, w, h, r, color) => { g.fillStyle = color; g.beginPath(); g.roundRect(x, y, w, h, r); g.fill(); };

/** Draw `src` (canvas or image) to cover the rectangle r (centred crop). */
function cover(g, src, r) {
  const sw = src.width, sh = src.height, k = Math.max(r.w / sw, r.h / sh);
  const cw = r.w / k, ch = r.h / k;
  g.drawImage(src, (sw - cw) / 2, (sh - ch) / 2, cw, ch, r.x, r.y, r.w, r.h);
}

/**
 * Compose a postcard. d = describe() (title, place, tiers, credits, date, years, realDate);
 * art = the w × h render for the inner area (or a stylized image to cover it); o = { size, frame };
 * stamp = 'AI-STYLIZED · OIL PAINTING · IMAGINED' for a stylized card.
 */
export function composePostcard(d, art, o, { stamp = null, overlay = null } = {}) {
  const S = SIZES.find((s) => s.id === o.size) ?? SIZES[0];
  const { w, h } = S, L = frameLayout(w, h, o.frame);
  const c = Object.assign(document.createElement('canvas'), { width: w, height: h });
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
  g.save(); g.beginPath(); g.rect(L.inner.x, L.inner.y, L.inner.w, L.inner.h); g.clip();
  cover(g, art, L.inner);
  if (overlay) g.drawImage(overlay, L.inner.x, L.inner.y, L.inner.w, L.inner.h);
  g.restore();
  const tiers = d.tiers;
  const prov = [stamp, provenanceLine(tiers)].filter(Boolean).join(' · '); // the stamp leads: AI-STYLIZED · <STYLE> · IMAGINED
  const credits = d.credits.length ? `IMAGERY: ${[...new Set(d.credits)].join(' · ')}` : '';
  const dates = [d.shipDate && `SHIP DATE ${d.shipDate}`, d.realDate && `REAL UTC ${d.realDate}`, epochLabel(d.years) && `EPOCH ${epochLabel(d.years)}`].filter(Boolean).join(' · ');
  const imagined = !!stamp || hasImagined(tiers);
  if (!o.frame) {
    const st = L.strip, s = L.s, pad = Math.round(16 * s);
    g.fillStyle = 'rgba(0,0,0,0.72)'; g.fillRect(st.x, st.y, st.w, st.h);
    g.fillStyle = imagined ? C.rose : C.orange; g.fillRect(st.x, st.y, Math.round(8 * s), st.h);
    const right = fitText(g, 'USS FIDELITY', w - pad, st.y + st.h * 0.3, w * 0.3, Math.round(20 * s), { weight: 600, color: C.orange, align: 'right' });
    fitText(g, prov, pad + 8 * s, st.y + st.h * 0.3, w - 2 * pad - right * 8, Math.round(19 * s), { color: imagined ? C.apricot : C.peach, weight: 600 });
    fitText(g, [dates, credits].filter(Boolean).join(' · '), pad + 8 * s, st.y + st.h * 0.72, w - 2 * pad, Math.round(15 * s), { color: C.dim });
    return c;
  }
  const s = L.s, gap = L.gap, bar = Math.round(22 * s), elbowW = Math.round(150 * s), r = Math.round(46 * s), pad = Math.round(18 * s);
  // top-left elbow, bar segments, then the title row
  rrect(g, 0, 0, elbowW, L.top, [r, 0, 0, 0], C.orange);
  g.fillStyle = '#000'; g.beginPath(); g.roundRect(L.side, bar, elbowW, L.top, [Math.round(22 * s), 0, 0, 0]); g.fill();
  const segs = [[C.orange, 0.42], [C.lilac, 0.18], [C.gold, 0.28], [C.blue, 0.12]];
  let x = elbowW + gap;
  for (const [col, f] of segs) { const sw = (w - elbowW - gap * segs.length) * f; rrect(g, x, 0, sw, bar, f === 0.12 ? [0, bar / 2, bar / 2, 0] : 0, col); x += sw + gap; }
  const titleY = bar + (L.top - bar) / 2;
  const nameW = fitText(g, 'USS FIDELITY', w - pad, titleY, w * 0.28, Math.round(40 * s), { weight: 700, color: C.orange, align: 'right' });
  void nameW;
  fitText(g, (d.place || d.title || '').toUpperCase(), L.side + gap * 2 + Math.round(10 * s), titleY, w - L.side - w * 0.3 - gap * 4, Math.round(38 * s), { weight: 600, color: C.gold });
  // left bar between the elbows
  const midTop = L.top + gap, midBot = h - L.foot - gap;
  const third = (midBot - midTop - gap * 2) / 3;
  [C.lilac, C.apricot, C.ice].forEach((col, i) => rrect(g, 0, midTop + i * (third + gap), L.side, third, 0, col));
  // bottom-left elbow and bar, then the stamps
  rrect(g, 0, h - L.foot, elbowW, L.foot, [0, 0, 0, r], imagined ? C.rose : C.orange);
  g.fillStyle = '#000'; g.beginPath(); g.roundRect(L.side, h - L.foot - 1, elbowW, L.foot - bar + 1, [0, 0, 0, Math.round(22 * s)]); g.fill();
  x = elbowW + gap;
  const bsegs = [[C.gold, 0.2], [C.orange, 0.5], [C.lilac, 0.3]];
  for (const [col, f] of bsegs) { const sw = (w - elbowW - gap * bsegs.length) * f; rrect(g, x, h - bar, sw, bar, f === 0.3 ? [0, bar / 2, bar / 2, 0] : 0, col); x += sw + gap; }
  const tx = L.side + gap * 2 + Math.round(10 * s), tw = w - tx - pad;
  const footTop = h - L.foot, lineH = (L.foot - bar) / 4;
  fitText(g, dates, tx, footTop + lineH * 0.8, tw, Math.round(24 * s), { weight: 600, color: C.peach });
  fitText(g, prov, tx, footTop + lineH * 1.8, tw, Math.round(22 * s), { weight: 600, color: imagined ? C.apricot : C.ice });
  if (credits) wrapText(g, credits, tx, footTop + lineH * 2.7, tw, Math.round(16 * s), 2, C.dim);
  return c;
}

const blobOf = (canvas, type, q) => new Promise((ok) => canvas.toBlob(ok, type, q));

/**
 * The POSTCARD dialog. describe() → the current view: { title, place, subject, snapshot, tiers,
 * credits, facts, date, years, shipDate, realDate, link } or null when the view cannot be captured.
 */
export function createPostcard({ h, pill, toast, settings, describe, standalone }) {
  let overlay = null;
  const prefs = () => ({ size: 'landscape', labels: true, frame: true, link: false, quality: 'medium', ...(settings.get('postcard') || {}) });
  const save = (patch) => settings.set('postcard', { ...(settings.get('postcard') || {}), ...patch });

  function close() { overlay?.remove(); overlay = null; window.removeEventListener('keydown', onKey, true); }
  function onKey(e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } }

  async function open() {
    if (overlay) return close();
    let d = describe();
    if (!d?.snapshot) { toast('POSTCARDS NEED A 3D VIEW · THIS ONE IS A MAP OR A LIST'); return; }
    const preview = h('img', { className: 'pc-preview', alt: 'Postcard preview' });
    const caption = h('textarea', { className: 'pc-caption', rows: 2, spellcheck: true, title: 'The caption shared with the image; edit it freely.' });
    const note = h('p', { className: 'note pc-note' });
    const strip = h('div', { className: 'pc-strip' });
    const versions = [{ id: 'original', label: 'ORIGINAL', canvas: null }];
    let current = 'original';
    const state = prefs();

    const pick = (id) => { current = id; showCurrent(); };
    function showCurrent() {
      const v = versions.find((x) => x.id === current) ?? versions[0];
      preview.src = v.canvas.toDataURL('image/jpeg', 0.85);
      caption.value = captionFor({ subject: d.subject, date: d.date, years: d.years, stylized: v.style ?? null }) + (state.link && d.link ? ` ${d.link}` : '');
      strip.replaceChildren(...versions.map((x) => {
        const b = h('button', { className: `pc-thumb${x.id === current ? ' on' : ''}`, title: x.label, onclick: () => pick(x.id) },
          h('img', { src: x.thumb, alt: x.label }), h('span', { textContent: x.label }));
        return b;
      }));
      strip.hidden = versions.length < 2;
      note.textContent = v.style
        ? `AI-STYLIZED BY ${v.model?.toUpperCase() ?? 'AN IMAGE MODEL'} · IMAGINED: an image model repainted the render; positions are the app's, details are not. The original is kept.`
        : hasImagined(d.tiers) ? `IMAGINED IN FRAME: ${[...new Set(d.tiers.imagined)].join(', ')}. The provenance line says so on every postcard and cannot be switched off.` : 'Everything in frame is MEASURED, REPORTED, COMPUTED or MODELLED, as the provenance line lists.';
    }
    const thumbOf = (c) => { const t = Object.assign(document.createElement('canvas'), { width: 160, height: Math.round(160 * c.height / c.width) }); t.getContext('2d').drawImage(c, 0, 0, t.width, t.height); return t.toDataURL('image/jpeg', 0.7); };

    function renderOriginal() {
      d = describe() ?? d;
      const S = SIZES.find((s) => s.id === state.size) ?? SIZES[0], L = frameLayout(S.w, S.h, state.frame);
      const art = d.snapshot(L.inner.w, L.inner.h, { labels: state.labels });
      const v = versions[0];
      v.canvas = composePostcard(d, art, state);
      v.thumb = thumbOf(v.canvas);
      // stylized versions are re-framed (not re-generated) when the size or frame changes
      for (const sv of versions.slice(1)) { sv.canvas = composePostcard(d, sv.image, state, { stamp: `AI-STYLIZED · ${sv.style} · IMAGINED`, overlay: sv.ownLabels || state.labels ? labelsLayer(L) : null }); sv.thumb = thumbOf(sv.canvas); }
      showCurrent();
    }
    const labelsLayer = (L) => d.snapshot(L.inner.w, L.inner.h, { labels: true, base: false });

    const opt = (key, label, tip) => {
      const b = pill(label, () => { state[key] = !state[key]; save({ [key]: state[key] }); b.classList.toggle('on', state[key]); key === 'link' ? showCurrent() : renderOriginal(); }, 'square');
      b.title = tip; b.classList.toggle('on', !!state[key]);
      return b;
    };
    const sizeBtns = SIZES.map((s) => {
      const b = pill(s.label, () => { state.size = s.id; save({ size: s.id }); for (const x of sizeBtns) x.classList.toggle('on', x === b); renderOriginal(); }, 'square');
      b.title = `${s.w} × ${s.h} px`; b.classList.toggle('on', state.size === s.id);
      return b;
    });

    const active = () => versions.find((x) => x.id === current) ?? versions[0];
    async function download(type) {
      const v = active();
      const ext = type === 'image/png' ? 'png' : 'jpg', name = fileName(`${d.title}${v.style ? ` ${v.style}` : ''}`, d.date, ext);
      const blob = await blobOf(v.canvas, type, 0.92);
      if (standalone) { showToSave(URL.createObjectURL(blob)); return; } // the standalone preview cannot start downloads
      const a = h('a', { href: URL.createObjectURL(blob), download: name });
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 30000);
      toast(`SAVED · ${name.toUpperCase()}`);
    }
    function showToSave(url) {
      const box = h('div', { className: 'pc-save' }, h('p', { className: 'note', textContent: 'Long-press or right-click the image and choose Save Image.' }), h('img', { src: url, alt: 'Postcard' }), pill('CLOSE', () => box.remove(), 'square'));
      overlay.append(box);
    }
    async function share() {
      const v = active();
      const blob = await blobOf(v.canvas, 'image/png');
      const file = new File([blob], fileName(d.title, d.date, 'png'), { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], text: caption.value, title: 'USS Fidelity postcard' }); } catch (err) { if (err?.name !== 'AbortError') toast('SHARE FAILED'); }
      } else toast('THIS BROWSER CANNOT SHARE FILES · SAVE THE IMAGE, THEN ATTACH IT');
    }
    async function copyImage() {
      try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': blobOf(active().canvas, 'image/png') })]); toast('IMAGE COPIED'); }
      catch { toast('THIS BROWSER CANNOT COPY IMAGES · SAVE IT INSTEAD'); }
    }
    const copyText = (t) => navigator.clipboard?.writeText(t).catch(() => {});
    function social(l) {
      if (l.needsServer) {
        const host = window.prompt('Your Mastodon server (for example mastodon.social):', prefs().mastodon || '');
        if (!host) return;
        save({ mastodon: host.trim() });
        l = shareLinks(caption.value, null, { mastodon: host }).find((x) => x.id === 'mastodon');
        if (!l.href) { toast('THAT DOES NOT LOOK LIKE A SERVER NAME'); return; }
      }
      if (l.copy) { copyText(caption.value); toast('CAPTION COPIED · PASTE IT WITH THE SAVED IMAGE'); }
      window.open(l.href, '_blank', 'noopener');
    }
    const socialRow = h('div', { className: 'body-list pc-social' });
    const fillSocial = () => socialRow.replaceChildren(...shareLinks(caption.value, null, { mastodon: prefs().mastodon }).map((l) => {
      const b = pill(`${l.label} ↗`, () => social(shareLinks(caption.value, null, { mastodon: prefs().mastodon }).find((x) => x.id === l.id)), 'square');
      b.title = 'Opens a new post with the caption. Links cannot carry the image: save it first, then attach it.';
      return b;
    }));
    caption.addEventListener('input', fillSocial);

    // ---- AI STYLIZE (local backend only, opt-in) ----
    const styl = h('div', { className: 'pc-stylize', hidden: true });
    if (!standalone) setupStylize();
    async function setupStylize() {
      let st = null;
      try { st = await (await fetch('/api/stylize/status')).json(); } catch { /* no backend */ }
      if (!overlay) return;
      if (!st) return;
      styl.hidden = false;
      if (!st.available) { styl.append(h('h3', { textContent: 'AI STYLIZE' }), h('p', { className: 'note', textContent: 'Optional: repaint the postcard with an image model. Set FIDELITY_OPENAI_KEY (or OPENAI_API_KEY) for the local backend to enable it.' })); return; }
      const chosen = new Set(['photoreal']);
      const styleBtns = STYLES.map((s) => {
        const b = pill(s.label, () => { chosen.has(s.id) ? chosen.delete(s.id) : chosen.add(s.id); b.classList.toggle('on', chosen.has(s.id)); costOut(); }, 'square');
        b.classList.toggle('on', chosen.has(s.id));
        return b;
      });
      const q = h('select', { className: 'pc-quality', title: 'Image quality: higher costs more' }, ...['low', 'medium', 'high'].map((v) => h('option', { value: v, textContent: v.toUpperCase(), selected: state.quality === v })));
      q.addEventListener('change', () => { state.quality = q.value; save({ quality: q.value }); costOut(); });
      const cost = h('span', { className: 'mono pc-cost' });
      const costOut = () => {
        const S = SIZES.find((s) => s.id === state.size), each = costEstimate(state.quality, editSize(S.w, S.h));
        cost.textContent = `≈ US$${(each * chosen.size).toFixed(2)} FOR ${chosen.size} (ESTIMATE · ${st.model.toUpperCase()})`;
      };
      costOut();
      const go = pill('STYLIZE ▸', () => run(), 'square');
      styl.append(h('h3', { textContent: 'AI STYLIZE · OPTIONAL' }), h('div', { className: 'body-list' }, ...styleBtns), h('div', { className: 'pc-row' }, q, cost, go));
      async function run() {
        if (!chosen.size) return;
        if (!prefs().stylizeOk) {
          const ok = window.confirm(`AI STYLIZE sends this render (no labels, no frame) and a description of the scene to OpenAI (${st.model}) using the API key on your backend. Each image costs roughly US$${costEstimate(state.quality, '1024x1024').toFixed(2)}–${costEstimate(state.quality, '1536x1024').toFixed(2)} at ${state.quality} quality (an estimate: check OpenAI's current prices). Results are cached on this machine, the original is always kept, and stylized images are stamped AI-STYLIZED · IMAGINED.\n\nSend it?`);
          if (!ok) return;
          save({ stylizeOk: true });
        }
        const S = SIZES.find((s) => s.id === state.size), size = editSize(S.w, S.h), [ew, eh] = size.split('x').map(Number);
        const base = d.snapshot(ew, eh, { labels: false }).toDataURL('image/png');
        go.disabled = true;
        for (const id of chosen) {
          const style = STYLES.find((s) => s.id === id);
          note.textContent = `STYLIZING · ${style.label} · THIS CAN TAKE A MINUTE…`;
          try {
            const r = await fetch('/api/stylize', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ image: base, prompt: stylePrompt(id, d.facts), size, quality: state.quality }) });
            const j = await r.json();
            if (!r.ok) throw new Error(j.error || r.status);
            const img = await new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = j.image; });
            const vid = `ai-${id}`;
            const existing = versions.findIndex((x) => x.id === vid);
            const v = { id: vid, label: `AI · ${style.label}`, style: style.label, image: img, model: j.model, ownLabels: !!style.ownLabels };
            if (existing >= 0) versions[existing] = v; else versions.push(v);
            if (!overlay) return;
            const L = frameLayout(S.w, S.h, state.frame);
            v.canvas = composePostcard(d, img, state, { stamp: `AI-STYLIZED · ${style.label} · IMAGINED`, overlay: v.ownLabels || state.labels ? labelsLayer(L) : null });
            v.thumb = thumbOf(v.canvas);
            current = vid;
            showCurrent();
          } catch (err) { toast(`STYLIZE FAILED · ${String(err.message || err).slice(0, 120).toUpperCase()}`, 6000); }
        }
        go.disabled = false;
        showCurrent();
      }
    }

    overlay = h('div', { className: 'pc-overlay', onclick: (e) => { if (e.target === overlay) close(); } },
      h('div', { className: 'pc-box', role: 'dialog', ariaLabel: 'Postcard' },
        h('div', { className: 'fv-head' }, h('span', { className: 'fv-title', textContent: 'POSTCARD' }), h('span', { className: 'fv-sub', textContent: d.title }), pill('✕', close, 'square')),
        h('div', { className: 'pc-body' },
          h('div', { className: 'pc-left' }, preview, strip),
          h('div', { className: 'pc-right' },
            h('h3', { textContent: 'SIZE' }), h('div', { className: 'body-list' }, ...sizeBtns),
            h('h3', { textContent: 'OPTIONS' }), h('div', { className: 'body-list' },
              opt('labels', 'LABELS', 'Draw the view\'s labels into the image'),
              opt('frame', 'LCARS FRAME', 'Frame with the place, the dates and the epoch (the provenance line and credits are stamped either way)'),
              opt('link', 'VIEW LINK', 'Add a link that reopens this view (camera, mode and epoch) to the caption')),
            h('h3', { textContent: 'CAPTION' }), caption, note,
            h('h3', { textContent: 'SAVE AND SHARE' }), h('div', { className: 'body-list' },
              pill('SAVE PNG', () => download('image/png'), 'square'), pill('SAVE JPEG', () => download('image/jpeg'), 'square'),
              pill('COPY IMAGE', copyImage, 'square'), pill('SHARE…', share, 'square'), pill('COPY CAPTION', () => { copyText(caption.value); toast('CAPTION COPIED'); }, 'square')),
            socialRow,
            h('p', { className: 'note', textContent: 'No accounts, no uploads: the image stays on this machine until you attach it somewhere. Post links carry the caption only, so save the image first.' }),
            styl))));
    document.body.append(overlay);
    window.addEventListener('keydown', onKey, true);
    renderOriginal();
    fillSocial();
  }
  return { open, close, get isOpen() { return !!overlay; } };
}
