// Postcards (#40): re-render a view at a chosen size instead of grabbing the screen. The WebGL buffer
// is only readable in the task that drew it, so one synchronous call resizes the renderer, draws, copies
// the pixels to a 2D canvas, rasterises the HTML labels (CSS2DRenderer elements) on top and restores
// the screen size; the screen never shows the capture-size frame.
//
// Sizes above 1080 px render at a higher pixel ratio rather than a bigger layout, so labels, lines and
// point sprites keep the proportions they have on screen. Shader point sizes driven by a `uPixel`
// uniform are scaled with it for the capture.

/**
 * A view's snapshot function. `o` = { renderer, scene, camera, labels (CSS2DRenderer, optional),
 * draw() (render the scene and labels, as the frame loop does), restore() (the view's resize),
 * setSize(w, h) (optional: anything else sized in CSS pixels, e.g. fat-line resolution) }.
 * Returns snapshot(w, h, { labels, base }) → a w × h canvas (base: false gives the label layer alone, transparent).
 */
export function makeSnapshot(o) {
  return function snapshot(w, h, { labels: withLabels = true, base = true } = {}) {
    const { renderer, scene, camera, labels } = o;
    const k = pixelRatioFor(w, h), lw = Math.round(w / k), lh = Math.round(h / k);
    const pr = renderer.getPixelRatio(), aspect = camera.aspect;
    const pix = [];
    scene.traverse((x) => {
      for (const m of [x.material].flat()) {
        const u = m?.uniforms?.uPixel;
        if (u && typeof u.value === 'number' && !pix.some((p) => p.u === u)) pix.push({ u, v: u.value });
      }
    });
    const out = Object.assign(document.createElement('canvas'), { width: w, height: h });
    const g = out.getContext('2d');
    if (base) { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); }
    try {
      renderer.setPixelRatio(k);
      renderer.setSize(lw, lh, false);
      labels?.setSize(lw, lh);
      o.setSize?.(lw, lh);
      camera.aspect = lw / lh; camera.updateProjectionMatrix();
      for (const p of pix) p.u.value = (p.v * k) / pr;
      o.draw();
      if (base) g.drawImage(renderer.domElement, 0, 0, w, h);
      if (withLabels && labels) drawLabels(g, labels.domElement, w / lw);
    } finally {
      for (const p of pix) p.u.value = p.v;
      renderer.setPixelRatio(pr);
      camera.aspect = aspect; camera.updateProjectionMatrix();
      o.restore();
      o.draw();
    }
    return out;
  };
}

/** The capture's pixel ratio: 1 up to 1080 px on the short side, then larger, so the layout stays screen-like. */
export const pixelRatioFor = (w, h) => Math.max(1, Math.min(w, h) / 1080);

const visible = (el, root) => {
  if (el.checkVisibility && !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return 0;
  let a = 1;
  for (let e = el; e && e !== root.parentElement; e = e.parentElement) {
    const cs = getComputedStyle(e);
    if (cs.display === 'none' || cs.visibility === 'hidden') return 0;
    a *= +cs.opacity;
  }
  return a;
};
const transparent = (c) => !c || c === 'transparent' || /rgba\([^)]*,\s*0\)$/.test(c);

/** Draw the label layer `root` (laid out at CSS size) onto `g`, scaled by `k`. */
export function drawLabels(g, root, k) {
  const R = root.getBoundingClientRect();
  const W = g.canvas.width, H = g.canvas.height;
  const inFrame = (r) => r.width > 0 && r.right > R.left && r.left < R.left + W / k && r.bottom > R.top && r.top < R.top + H / k;
  for (const el of root.querySelectorAll('*')) {
    if (el.closest('[data-snapshot="skip"]')) continue;
    const a = visible(el, root);
    if (!a) continue;
    const cs = getComputedStyle(el), r = el.getBoundingClientRect();
    if (!inFrame(r)) continue;
    g.save();
    g.globalAlpha = a;
    const x = (r.left - R.left) * k, y = (r.top - R.top) * k, bw = r.width * k, bh = r.height * k;
    if (!transparent(cs.backgroundColor)) { g.fillStyle = cs.backgroundColor; g.beginPath(); g.roundRect?.(x, y, bw, bh, parseFloat(cs.borderTopLeftRadius) * k || 0); g.fill(); }
    for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
      const wd = parseFloat(cs[`border${side}Width`]);
      if (!wd || cs[`border${side}Style`] === 'none' || transparent(cs[`border${side}Color`])) continue;
      g.fillStyle = cs[`border${side}Color`];
      const t = wd * k;
      if (side === 'Top') g.fillRect(x, y, bw, t); else if (side === 'Bottom') g.fillRect(x, y + bh - t, bw, t);
      else if (side === 'Left') g.fillRect(x, y, t, bh); else g.fillRect(x + bw - t, y, t, bh);
    }
    for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent.trim()) drawText(g, n, cs, R, k);
    g.restore();
  }
}

function drawText(g, node, cs, R, k) {
  const tt = cs.textTransform, raw = node.textContent;
  const text = (s) => (tt === 'uppercase' ? s.toUpperCase() : tt === 'lowercase' ? s.toLowerCase() : s);
  g.font = `${cs.fontStyle} ${cs.fontWeight} ${parseFloat(cs.fontSize) * k}px ${cs.fontFamily}`;
  if ('letterSpacing' in g) g.letterSpacing = `${(parseFloat(cs.letterSpacing) || 0) * k}px`;
  g.fillStyle = cs.color;
  g.textBaseline = 'middle';
  const sh = cs.textShadow && cs.textShadow !== 'none' ? cs.textShadow.match(/^(rgba?\([^)]*\)|#\w+|\w+)\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s*([\d.]+)?/) : null;
  if (sh) { g.shadowColor = sh[1]; g.shadowOffsetX = +sh[2] * k; g.shadowOffsetY = +sh[3] * k; g.shadowBlur = (+sh[4] || 0) * k; }
  const range = document.createRange();
  range.selectNodeContents(node);
  const rects = [...range.getClientRects()].filter((r) => r.width > 0);
  if (rects.length <= 1) {
    const r = rects[0];
    if (r) g.fillText(text(raw.replace(/\s+/g, ' ').trim()), (r.left - R.left) * k, (r.top - R.top + r.height / 2) * k);
    return;
  }
  // wrapped text: place each word where the browser laid it out
  for (const m of raw.matchAll(/\S+/g)) {
    range.setStart(node, m.index); range.setEnd(node, m.index + m[0].length);
    const r = range.getBoundingClientRect();
    if (r.width) g.fillText(text(m[0]), (r.left - R.left) * k, (r.top - R.top + r.height / 2) * k);
  }
}
