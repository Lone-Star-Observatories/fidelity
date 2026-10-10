// THROUGH A TELESCOPE: an eyepiece drawing of a Sol body at its true angular size and phase,
// with Saturn's rings at their real tilt and the planet's moons where they are now. North up,
// east left (the sky as seen without a star diagonal). A COMPUTED diagram, not an image.

import { badge } from '../data/provenance.js';
import { geocentric, describe, eclToEq, toRaDec, subObserverLatitude } from '../astro/observe.js';

const SVGNS = 'http://www.w3.org/2000/svg';
const DEG = Math.PI / 180;
const svg = (tag, attrs = {}, text) => {
  const e = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text != null) e.textContent = text;
  return e;
};
const el = (tag, props = {}, ...kids) => {
  const e = Object.assign(document.createElement(tag), props);
  for (const k of kids.flat()) if (k != null) e.append(k);
  return e;
};

/** Position angle (deg, north through east) of point 2 seen from point 1 (Meeus 48.5). */
export function positionAngle(ra1, dec1, ra2, dec2) {
  const da = (ra2 - ra1) * DEG;
  return (Math.atan2(Math.sin(da) * Math.cos(dec2 * DEG),
    Math.cos(dec1 * DEG) * Math.sin(dec2 * DEG) - Math.sin(dec1 * DEG) * Math.cos(dec2 * DEG) * Math.cos(da)) / DEG + 360) % 360;
}

/** Offsets (arcsec east, north) of (ra2, dec2) from (ra1, dec1), small-field. */
export function skyOffset(ra1, dec1, ra2, dec2) {
  let da = ra2 - ra1; if (da > 180) da -= 360; if (da < -180) da += 360;
  return [da * Math.cos(dec1 * DEG) * 3600, (dec2 - dec1) * 3600];
}

// field of view (arcsec) per magnification, for a 50° apparent-field eyepiece
const MAGS = [[25, 7200], [100, 1800], [250, 720]];

/**
 * target: { id, radiusKm, pole, rings?, positionAt(id, jd), moons: [{ id, name }], palette }
 * Returns { node, update(jd) }.
 */
export function createEyepiece(target) {
  const S = 300, C = S / 2, R = C - 6;
  const s = svg('svg', { viewBox: `0 0 ${S} ${S + 34}`, class: 'ep-svg', role: 'img', 'aria-label': 'Telescope eyepiece view' });
  const caption = el('div', { className: 'note mono' });
  let magIdx = 2, lastJd = null;
  const pills = el('div', { className: 'im-pills' }, el('span', { className: 'im-label', textContent: 'POWER' }));
  for (const [i, [m]] of MAGS.entries()) {
    const b = el('button', { type: 'button', className: `pill${i === magIdx ? ' on' : ''}`, textContent: `${m}×` });
    b.addEventListener('click', () => { magIdx = i; pills.querySelectorAll('.pill').forEach((p, k) => p.classList.toggle('on', k === i)); if (lastJd) update(lastJd); });
    pills.append(b);
  }
  const node = el('div', { className: 'ep' },
    el('div', { className: 'ep-head' }, el('span', { className: 'im-sub', textContent: 'THROUGH A TELESCOPE NOW' }),
      badge('computed', 'Drawn from the computed apparent size, phase, ring tilt and moon positions. Colours are the body\'s generic palette: a diagram, not a photograph.')),
    pills, s, caption);

  const at = (id) => (t) => target.positionAt(id, t);
  function update(jd) {
    lastJd = jd;
    const [mag, fovArcsec] = MAGS[magIdx];
    const g = geocentric(at(target.id), at('earth'), jd);
    const d = describe(g, { radiusKm: target.radiusKm });
    const sun = toRaDec(eclToEq(geocentric(at('sun'), at('earth'), jd).geo));
    const px = (2 * R) / fovArcsec; // pixels per arcsec
    const rPx = Math.max(1.2, (d.angularDiameterArcsec / 2) * px);
    const kids = [svg('circle', { cx: C, cy: C, r: R, fill: '#020208', stroke: '#9977aa', 'stroke-width': 3 })];
    const clip = svg('clipPath', { id: 'ep-clip' }); clip.append(svg('circle', { cx: C, cy: C, r: R }));
    const defs = svg('defs'); defs.append(clip); kids.push(defs);
    const g0 = svg('g', { 'clip-path': 'url(#ep-clip)' });
    // screen: x right, y down; sky: north up, east left → a position angle θ points along (−sin θ, −cos θ)
    const dir = (pa) => [-Math.sin(pa * DEG), -Math.cos(pa * DEG)];
    const pal = target.palette ?? ['#ccc', '#aaa'];
    const grad = svg('linearGradient', { id: 'ep-grad', x1: '0', x2: '0', y1: '0', y2: '1' });
    pal.slice(0, 4).forEach((c, i, a) => grad.append(svg('stop', { offset: `${(i / Math.max(1, a.length - 1)) * 100}%`, 'stop-color': c })));
    defs.append(grad);
    const B = target.rings && target.pole ? subObserverLatitude(d.eq, target.pole) : 0;
    const polePa = target.pole ? positionAngle(d.ra, d.dec, target.pole[0], target.pole[1]) : 0;
    const brightPa = positionAngle(d.ra, d.dec, sun.ra, sun.dec);
    /** The globe (phase towards the Sun) and rings (at their tilt), centred on (cx, cy), radius r px. */
    function drawDisc(parent, cx, cy, r) {
      let ringBack = null, ringFront = null;
      if (target.rings && target.pole) {
        const rotR = Math.atan2(...dir(polePa).reverse()) / DEG + 90; // ring major axis ⟂ pole
        const ro = (target.rings.outerKm / target.radiusKm) * r, ri = (target.rings.innerKm / target.radiusKm) * r;
        const k = Math.max(0.01, Math.abs(Math.sin(B * DEG)));
        const ring = (front) => {
          const grp = svg('g', { transform: `rotate(${rotR} ${cx} ${cy})` });
          // local −y points to the pole we see; the near half of the rings lies on the other side
          const half = front === (B > 0) ? 0 : 1;
          grp.append(svg('path', { d: `M${cx - ro},${cy} A${ro},${ro * k} 0 0 ${half} ${cx + ro},${cy} L${cx + ri},${cy} A${ri},${ri * k} 0 0 ${1 - half} ${cx - ri},${cy} Z`,
            fill: '#d8c79a', 'fill-opacity': 0.85 }));
          return grp;
        };
        ringBack = ring(false); ringFront = ring(true);
      }
      if (ringBack) parent.append(ringBack);
      // lit half-disc towards the Sun plus a terminator half-ellipse
      const rot = Math.atan2(...dir(brightPa).reverse()) / DEG;
      const kx = Math.cos(d.phase * DEG) * r; // terminator semi-axis: + gibbous, − crescent
      const globe = svg('g', { transform: `rotate(${rot} ${cx} ${cy})` });
      globe.append(svg('circle', { cx, cy, r, fill: '#151515' }));
      globe.append(svg('path', { d: `M${cx},${cy - r} A${r},${r} 0 0 1 ${cx},${cy + r} A${Math.abs(kx)},${r} 0 0 ${kx > 0 ? 1 : 0} ${cx},${cy - r} Z`, fill: 'url(#ep-grad)' }));
      parent.append(globe);
      if (ringFront) parent.append(ringFront);
    }
    drawDisc(g0, C, C, rPx);
    // moons
    const labels = [];
    for (const mo of target.moons ?? []) {
      let r2;
      try { r2 = toRaDec(eclToEq(geocentric(at(mo.id), at('earth'), jd).geo)); } catch { continue; }
      const [e, n] = skyOffset(d.ra, d.dec, r2.ra, r2.dec);
      const x = C - e * px, y = C - n * px;
      if (Math.hypot(x - C, y - C) > R) continue;
      g0.append(svg('circle', { cx: x, cy: y, r: 2.2, fill: '#ffcc99' }));
      // label only where it does not collide with the planet or another label
      const ly = y - 6;
      if (Math.hypot(x - C, ly - C) > rPx * (target.rings ? 2.4 : 1.2) + 8 && !labels.some(([a, b]) => Math.abs(a - x) < 44 && Math.abs(b - ly) < 11)) {
        labels.push([x, ly]);
        g0.append(svg('text', { x, y: ly, class: 'ep-label', 'text-anchor': 'middle' }, mo.name.toUpperCase()));
      }
    }
    kids.push(g0);
    // the disc enlarged, in a corner, when it is only a few pixels across at this power
    if (rPx < 14 && d.angularDiameterArcsec > 0.5) {
      const ins = svg('g', {});
      const ir = target.rings ? 18 : 30, ix = S - 44, iy = S - 22;
      ins.append(svg('circle', { cx: ix, cy: iy, r: 42, fill: '#000', stroke: '#9977aa', 'stroke-width': 1.5 }));
      drawDisc(ins, ix, iy, ir);
      ins.append(svg('text', { x: ix, y: iy + 52, class: 'ep-label', 'text-anchor': 'middle' }, `DISC ×${Math.round(ir / rPx)}`));
      kids.push(ins);
    }
    kids.push(svg('text', { x: C, y: 16, class: 'ep-label', 'text-anchor': 'middle' }, 'N'), svg('text', { x: 12, y: C + 4, class: 'ep-label', 'text-anchor': 'middle' }, 'E'));
    s.replaceChildren(...kids);
    const fovText = fovArcsec >= 3600 ? `${fovArcsec / 3600}°` : `${fovArcsec / 60}′`;
    caption.textContent = `${mag}× · FIELD ${fovText} · DISC ${d.angularDiameterArcsec >= 1 ? `${d.angularDiameterArcsec.toFixed(1)}″` : 'A POINT OF LIGHT'} · ${Math.round(d.illuminated * 100)}% LIT${rPx <= 1.5 ? ' · TOO SMALL TO SHOW A DISC' : ''}`;
  }
  return { node, update };
}
