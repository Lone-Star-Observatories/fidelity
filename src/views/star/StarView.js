// Star View — one star up close: its photosphere, its spectrum, what it is made of.
//
// Spectrum: a real observed spectrum of a star of the same type (Pickles 1998), not this
// star's own, plus the blackbody curve at its temperature and the lines that reveal its
// elements. Composition: the Sun's measured photosphere, or the solar mix scaled by the
// star's measured metallicity.
//
// Spectrum filter (#28): the photosphere and a SPECTRUM BAND card follow the current band
// (./../system/starband.js: the Sun's SDO/NoRH images, its measured signatures, or a blackbody
// through the filter), and the chart shades the bandpass, or points to it when it is off the chart.

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createCameraRig } from '../cameraControls.js';
import { starMaterial, loadTexture, applyLiveSkin, loadLive } from '../system/materials.js';
import { currentBand, onBand } from '../../data/bandstate.js';
import { starBandLook, PAL_RGB } from '../system/starband.js';
import { bakedFeed } from '../../data/bandbake.js';
import { feedCredit } from '../system/bandtextures.js';
import { paletteIndex } from '../system/bandskin.js';
import { effectiveNm } from '../../astro/bands.js';
import { SUN } from '../../data/sol.js';
import { settings } from '../../settings.js';
import { glowTexture, planetTexture } from '../system/textures.js';
import { badge } from '../../data/provenance.js';
import { starComposition, STELLAR_LINES, planck, wienPeakNm } from '../../data/composition.js';
import { bodyVisualFor } from '../../data/bespoke.js';
import { stellarResearchCards } from './research.js';

const SVGNS = 'http://www.w3.org/2000/svg';
const OBSERVED = '#c97a00'; // validated against the black surface with the blackbody blue
const BLACKBODY = '#7777ee';

const el = (tag, props = {}, ...kids) => {
  const e = Object.assign(document.createElement(tag), props);
  for (const k of kids.flat()) if (k != null) e.append(k);
  return e;
};
const svg = (tag, attrs = {}) => {
  const e = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
};
const STANDALONE = import.meta.env?.MODE === 'standalone';
const upper = (s) => s.replace(/ ?µm\b/g, ' MICRONS').toUpperCase(); // 'µ' upper-cases to Greek 'Μ'
/** A wavelength (nm) in the unit people use for it: keV/MeV for X and gamma rays, nm, µm, mm, cm, m. */
export function wavelengthText(nm) {
  if (nm < 0.01) return `${(1.23984e-3 / nm).toPrecision(2)} MeV`;
  if (nm < 10) return `${(1.23984 / nm).toPrecision(2)} keV`;
  if (nm < 1000) return `${Math.round(nm)} nm`;
  if (nm < 1e6) return `${(nm / 1000).toPrecision(3)} µm`;
  if (nm < 1e7) return `${(nm / 1e6).toPrecision(2)} mm`;
  if (nm < 1e9) return `${(nm / 1e7).toPrecision(3)} cm`;
  return `${(nm / 1e9).toPrecision(2)} m`;
}
const fmt = (n, d = 0) => Number(n).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });

/** Approximate visible colour of a wavelength (for the rainbow strip under the chart). */
function wavelengthRGB(nm) {
  let r = 0, g = 0, b = 0;
  if (nm < 440) { r = -(nm - 440) / 60; b = 1; } else if (nm < 490) { g = (nm - 440) / 50; b = 1; }
  else if (nm < 510) { g = 1; b = -(nm - 510) / 20; } else if (nm < 580) { r = (nm - 510) / 70; g = 1; }
  else if (nm < 645) { r = 1; g = -(nm - 645) / 65; } else { r = 1; }
  const f = nm < 420 ? 0.3 + 0.7 * (nm - 380) / 40 : nm > 700 ? 0.3 + 0.7 * (750 - nm) / 50 : 1;
  return `rgb(${[r, g, b].map((c) => Math.round(255 * Math.max(0, c * f) ** 0.8)).join(',')})`;
}

export function createStarView(container) {
  // ---- hero: the star itself ----------------------------------------------------------
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0, 5.2);
  let star = null, glow = null, running = false;

  const hero = el('div', { className: 'sv-hero' });
  hero.append(renderer.domElement);
  const heroFacts = el('dl', { className: 'sv-hero-facts' });
  const title = el('div', { className: 'sv-title' });
  const spectrumBox = el('section', { className: 'sv-card' });
  const compositionBox = el('section', { className: 'sv-card' });
  const bandBox = el('section', { className: 'sv-card', hidden: true }); // the spectrum filter (#28)
  const researchBox = el('div', { className: 'stellar-research' });
  const extras = el('div', { className: 'pv-cards' }); // FROM EARTH and imagery (src/panels)
  const ownSpectrum = el('div', { className: 'pv-cards' }); // the star's measured Gaia spectrum
  container.replaceChildren(el('div', { className: 'sv' },
    el('div', { className: 'sv-top' }, hero, el('div', { className: 'sv-hero-text' }, title, heroFacts)),
    bandBox, extras, spectrumBox, ownSpectrum, compositionBox, researchBox));

  // camera controls (#39): drag to turn, wheel / pinch / slider to zoom, FILL VIEW, full-screen star
  const controls = new OrbitControls(camera, renderer.domElement);
  Object.assign(controls, { enableDamping: true, dampingFactor: 0.08, enablePan: false, minDistance: 1.12, maxDistance: 40, rotateSpeed: 0.6 });
  let starBody = null;
  const rig = createCameraRig({
    key: 'star', camera, controls, dom: renderer.domElement, container, host: hero, inline: true,
    metersPerUnit: () => (starBody?.radiusKm ?? 695700) * 1000, minFov: 0.2, maxFov: 80, noCursorZoom: true,
    nearest: (p) => Math.max(1e-4, p.length() - 1),
    toOrbit: () => { controls.target.set(0, 0, 0); return true; }, // always orbit the globe; the settle turns back to it
    fit: () => rig.frameSphere(new THREE.Vector3(), 1, 1.04),
    reset: () => rig.flyTo({ target: new THREE.Vector3(), position: new THREE.Vector3(0, 0, 5.2) }),
    onFullscreen: (on) => { container.classList.toggle('hero-full', on); if (on) container.scrollTop = 0; sizeHero(); },
  });
  function sizeHero() {
    const w = hero.clientWidth || 260, h = container.classList.contains('hero-full') ? hero.clientHeight || w : w;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(sizeHero).observe(hero);

  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    if (star) {
      star.rotation.y = now * 0.00004;
      const u = star.material.uniforms;
      if (u.uHasDisk.value) { u.uEarthDir.value.set(0, 0, 1); u.uNorth.value.set(0, 1, 0); } // Earth is where the default camera stands: orbit round to see the far side
    }
    if (rig.update(now)) controls.update();
    renderer.render(scene, camera);
  }

  function setStar(body, isSun) {
    if (star) { scene.remove(star); star.geometry.dispose(); star.material.dispose(); }
    const placeholder = planetTexture({ id: body.id, banded: body.banded, palette: ['#d9a35a', '#f2c879', '#b97a3a'] });
    star = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), starMaterial(placeholder, body.color, !isSun));
    const current = star;
    const visual = !isSun && bodyVisualFor(body);
    if (visual?.kind === 'star' && visual.surfaceMap) loadTexture(visual.surfaceMap.key).then(t => { if (t && star === current) current.material.uniforms.uMap.value = t; });
    if (isSun) loadTexture('sun').then((t) => { if (t && star === current) current.material.uniforms.uMap.value = t; });
    // the Sun's live disc (seen from Earth, facing the camera) is applied by applyBand in full spectrum
    glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: body.color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.75 }));
    glow.scale.setScalar(3.6);
    star.add(glow);
    star.rotation.x = 0.25;
    scene.add(star);
    applyBand();
  }

  // ---- the spectrum filter (#28): photosphere and band card ------------------------------
  let bandLook = null, bandFeedTime = null;
  function applyBand() {
    if (!star || !current) return;
    const { band, pass } = currentBand(), u = star.material.uniforms, mesh = star, glowNow = glow;
    const look = starBandLook({ teff: current.body.teffK ?? 5772, isSun: current.isSun, hasFeed: (id) => !STANDALONE || !!bakedFeed(id) }, band, pass);
    bandLook = look; bandFeedTime = null;
    u.uBandDisk.value = 0;
    const setGlow = (t) => {
      const m = Math.max(...t);
      glowNow.material.opacity = 0.75 * Math.min(1, m);
      glowNow.material.color.set(current.body.color ?? 0xffffff);
      if (look) glowNow.material.color.setRGB(...t.map((c) => c / Math.max(1e-3, m)));
    };
    if (!look) { // full spectrum: the usual star (and the Sun's live disc, if live skins are on)
      u.uBandTint.value.setRGB(1, 1, 1); setGlow([1, 1, 1]);
      if (current.isSun) applyLiveSkin(star.material, SUN.skin, settings.get('liveSkins')); else u.uHasDisk.value = 0;
      drawBandCard();
      return;
    }
    u.uBandTint.value.setRGB(...look.tint); setGlow(look.tint);
    const showFeed = (lk) => loadLive(lk.feed, 6 * 3600000).then((l) => {
      if (bandLook !== lk || star !== mesh) return;
      // #72: a map that fails to load (today's SRH) gives way to its fallback (archival Nobeyama), labelled as such
      if (!l && lk.fallback) { bandLook = lk.fallback; drawBandCard(); showFeed(lk.fallback); return; }
      if (!l) { lk.label = 'REAL IMAGE UNAVAILABLE · NEEDS THE LOCAL BACKEND'; lk.tier = 'computed'; drawBandCard(); return; }
      u.uDisk.value = l.texture; u.uHasDisk.value = 1; u.uBandDisk.value = 1; u.uBandMix.value = lk.mix ?? 1; if (l.disk) u.uDiskR.value = l.disk;
      feedCredit(lk, l); bandFeedTime = l.time; drawBandCard();
    });
    if (look.feed) showFeed(look);
    else if (current.isSun) u.uHasDisk.value = 0; // the band look replaces the live visible disc
    drawBandCard();
  }
  function drawBandCard() {
    const { band, pass } = currentBand();
    bandBox.hidden = !bandLook;
    if (!bandLook) return;
    const nm = pass?.filter ? effectiveNm(pass.filter) : null;
    bandBox.replaceChildren(
      el('div', { className: 'sv-card-head' }, el('h3', { textContent: `SPECTRUM BAND · ${band.label}${pass ? ` · ${upper(pass.label)}` : ''}` }), badge(bandLook.tier, bandLook.detail)),
      el('div', { className: 'sv-comp-title', textContent: upper(bandLook.label) }),
      el('p', { className: 'note', textContent: `${bandLook.detail}${bandFeedTime ? ` Observed ${bandFeedTime.slice(0, 16).replace('T', ' ')} UTC.` : ''}${nm ? ` Effective wavelength ${wavelengthText(nm)}.` : ''}` }),
      el('div', { className: `band-key band-${band.palette}` }, el('span', { textContent: 'FAINT' }), el('span', { textContent: bandLook.mode === 'real' ? 'IMAGE IN ITS OWN COLOURS' : band.id === 'visible' ? 'BRIGHT · MONOCHROME' : 'BRIGHT · FALSE COLOUR' })));
  }
  onBand(({ pass }) => {
    const nm = pass?.filter ? effectiveNm(pass.filter) : null;
    if (nm && nm > 1000 && nm <= 2500) range = 'ir'; // show the bandpass on the chart when the chart can
    applyBand();
    if (current) drawSpectrum();
  });

  // ---- spectrum chart -----------------------------------------------------------------
  let range = 'visible';
  // Brown dwarfs: the molecules and alkali metals that define the L, T and Y classes.
  const BROWN_DWARF_BANDS = [
    { nm: 589, label: 'Na I' }, { nm: 768, label: 'K I' }, { nm: 990, label: 'FeH' }, { nm: 1140, label: 'H₂O' },
    { nm: 1400, label: 'H₂O' }, { nm: 1650, label: 'CH₄' }, { nm: 1900, label: 'H₂O' }, { nm: 2300, label: 'CH₄ / CO' },
  ];
  let current = null; // { body, spectrum, isSun }

  function drawSpectrum() {
    const { body, spectrum } = current;
    const T = body.teffK;
    const [x0, x1] = range === 'visible' ? [320, 1000] : [320, 2500];
    const W = 900, H = 330, m = { l: 46, r: 18, t: 46, b: 58 };
    const pw = W - m.l - m.r, ph = H - m.t - m.b;
    const X = (nm) => m.l + ((nm - x0) / (x1 - x0)) * pw;

    // series
    const pts = [];
    if (spectrum) {
      const { from, step } = spectrum.grid;
      spectrum.flux.forEach((f, i) => { const nm = from + i * step; if (nm >= x0 && nm <= x1) pts.push([nm, f]); });
    }
    const bb = [];
    for (let nm = x0; nm <= x1; nm += (x1 - x0) / 400) bb.push([nm, planck(nm, T)]);
    // normalise: observed to its peak in range; blackbody to the same mean flux over the range
    const obsMax = Math.max(...pts.map((p) => p[1]), 1e-9);
    const obs = pts.map(([nm, f]) => [nm, f / obsMax]);
    const mean = (arr) => arr.reduce((s, p) => s + p[1], 0) / Math.max(arr.length, 1);
    const k = obs.length ? mean(obs) / mean(bb) : 1 / Math.max(...bb.map((p) => p[1]));
    const bbN = bb.map(([nm, f]) => [nm, f * k]);
    const yMax = Math.max(1, ...bbN.map((p) => p[1])) * 1.05;
    const Y = (v) => m.t + ph - (v / yMax) * ph;
    const path = (arr) => arr.map(([nm, v], i) => `${i ? 'L' : 'M'}${X(nm).toFixed(1)},${Y(v).toFixed(1)}`).join('');

    const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'sv-chart', role: 'img',
      'aria-label': `Spectrum of ${body.name}: ${spectrum ? `observed ${spectrum.template} template and ` : ''}blackbody at ${T} K` });

    // grid & axes (recessive)
    for (let v = 0; v <= yMax; v += 0.25) {
      s.append(svg('line', { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v), class: 'grid' }));
      s.append(Object.assign(svg('text', { x: m.l - 8, y: Y(v) + 4, class: 'tick', 'text-anchor': 'end' }), { textContent: v.toFixed(2) }));
    }
    const tickStep = range === 'visible' ? 100 : 250;
    for (let nm = Math.ceil(x0 / tickStep) * tickStep; nm <= x1; nm += tickStep) {
      s.append(Object.assign(svg('text', { x: X(nm), y: H - m.b + 30, class: 'tick', 'text-anchor': 'middle' }), { textContent: nm }));
    }
    s.append(Object.assign(svg('text', { x: m.l + pw / 2, y: H - 8, class: 'axis-label', 'text-anchor': 'middle' }), { textContent: 'WAVELENGTH (nm)' }));
    s.append(Object.assign(svg('text', { x: 12, y: m.t + ph / 2, class: 'axis-label', 'text-anchor': 'middle', transform: `rotate(-90 12 ${m.t + ph / 2})` }), { textContent: 'RELATIVE FLUX' }));

    // what the eye sees: the visible band
    const grad = svg('linearGradient', { id: 'sv-rainbow', x1: '0', x2: '1' });
    for (let nm = 380; nm <= 750; nm += 10) grad.append(svg('stop', { offset: `${((nm - 380) / 370) * 100}%`, 'stop-color': wavelengthRGB(nm) }));
    const defs = svg('defs'); defs.append(grad); s.append(defs);
    s.append(svg('rect', { x: X(380), y: H - m.b + 6, width: X(750) - X(380), height: 8, rx: 2, fill: 'url(#sv-rainbow)' }));
    s.append(Object.assign(svg('text', { x: X(565), y: H - m.b + 4, class: 'tick muted', 'text-anchor': 'middle' }), { textContent: 'VISIBLE' }));

    // lines, labelled at the top
    const lines = (body.kind === 'brown dwarf' ? BROWN_DWARF_BANDS : STELLAR_LINES).filter((l) => l.nm >= x0 && l.nm <= x1 && (range !== 'visible' || l.nm < 1000));
    let lastX = -99;
    for (const l of lines) {
      const x = X(l.nm);
      s.append(svg('line', { x1: x, x2: x, y1: m.t - 4, y2: m.t + ph, class: 'line-marker' }));
      if (x - lastX > 13) {
        s.append(Object.assign(svg('text', { x: x + 3, y: m.t - 8, class: 'line-label', transform: `rotate(-50 ${x + 3} ${m.t - 8})` }), { textContent: l.label }));
        lastX = x;
      }
    }

    // Wien peak (computed)
    const peak = wienPeakNm(T);
    if (peak >= x0 && peak <= x1) {
      s.append(svg('line', { x1: X(peak), x2: X(peak), y1: m.t, y2: m.t + ph, class: 'peak' }));
      const right = X(peak) > W - m.r - 90;
      s.append(Object.assign(svg('text', { x: X(peak) + (right ? -5 : 5), y: m.t + 14, class: 'tick', 'text-anchor': right ? 'end' : 'start' }), { textContent: `PEAK ${fmt(peak)} nm` }));
    }

    // the spectrum filter's bandpass (#28): its transmission curve shaded, or a pointer when off the chart
    const cb = currentBand();
    if (!cb.full && cb.pass?.filter) {
      const pal = PAL_RGB[paletteIndex(cb.band.palette)], colour = `rgb(${pal.map((c) => Math.round(255 * c)).join(',')})`;
      const pts = cb.pass.filter.points, tMax = Math.max(...pts.map((q) => q[1]), 1e-9), nmEff = effectiveNm(cb.pass.filter);
      const inside = pts.filter(([nm]) => nm >= x0 && nm <= x1);
      if (inside.length >= 2) {
        const top = (t) => m.t + ph - (t / tMax) * ph * 0.92;
        const d = `M${X(inside[0][0]).toFixed(1)},${(m.t + ph).toFixed(1)}` + inside.map(([nm, t]) => `L${X(nm).toFixed(1)},${top(t).toFixed(1)}`).join('') + `L${X(inside.at(-1)[0]).toFixed(1)},${(m.t + ph).toFixed(1)}Z`;
        s.append(svg('path', { d, fill: colour, 'fill-opacity': 0.16, stroke: colour, 'stroke-opacity': 0.7, 'stroke-width': 1.2, class: 'band-pass' }));
        const lx = Math.min(Math.max(X(Math.min(Math.max(nmEff, x0), x1)), m.l + 60), W - m.r - 60);
        s.append(Object.assign(svg('text', { x: lx, y: m.t + ph - 6, class: 'tick', 'text-anchor': 'middle', fill: colour }), { textContent: `BAND · ${upper(cb.pass.label)}` }));
      } else {
        const left = nmEff < x0;
        s.append(Object.assign(svg('text', { x: left ? m.l + 6 : W - m.r - 6, y: m.t + ph - 8, class: 'tick', 'text-anchor': left ? 'start' : 'end', fill: colour }),
          { textContent: `${left ? '◀ ' : ''}BAND · ${upper(cb.pass.label)} · ${wavelengthText(nmEff)} · OFF THIS CHART${left ? '' : ' ▶'}` }));
      }
    }

    s.append(svg('path', { d: path(bbN), fill: 'none', stroke: BLACKBODY, 'stroke-width': 2, 'stroke-dasharray': '6 4', 'stroke-linecap': 'round' }));
    if (obs.length) s.append(svg('path', { d: path(obs), fill: 'none', stroke: OBSERVED, 'stroke-width': 2, 'stroke-linejoin': 'round' }));

    // hover: crosshair + readout
    const cross = svg('line', { y1: m.t, y2: m.t + ph, class: 'crosshair', visibility: 'hidden' });
    const dotO = svg('circle', { r: 4, fill: OBSERVED, stroke: '#000', 'stroke-width': 2, visibility: 'hidden' });
    const dotB = svg('circle', { r: 4, fill: BLACKBODY, stroke: '#000', 'stroke-width': 2, visibility: 'hidden' });
    const hit = svg('rect', { x: m.l, y: m.t, width: pw, height: ph, fill: 'transparent' });
    s.append(cross, dotO, dotB, hit);
    const tip = el('div', { className: 'sv-tip', hidden: true });
    const at = (arr, nm) => { let best = arr[0]; for (const p of arr) if (Math.abs(p[0] - nm) < Math.abs(best[0] - nm)) best = p; return best; };
    hit.addEventListener('pointermove', (e) => {
      const r = s.getBoundingClientRect();
      const nm = x0 + ((((e.clientX - r.left) / r.width) * W - m.l) / pw) * (x1 - x0);
      const b = at(bbN, nm), o = obs.length ? at(obs, nm) : null;
      cross.setAttribute('x1', X(nm)); cross.setAttribute('x2', X(nm)); cross.setAttribute('visibility', 'visible');
      dotB.setAttribute('cx', X(b[0])); dotB.setAttribute('cy', Y(b[1])); dotB.setAttribute('visibility', 'visible');
      if (o) { dotO.setAttribute('cx', X(o[0])); dotO.setAttribute('cy', Y(o[1])); dotO.setAttribute('visibility', 'visible'); }
      const near = lines.find((l) => Math.abs(l.nm - nm) < (x1 - x0) / 120);
      tip.hidden = false;
      tip.innerHTML = `<b>${fmt(nm)} nm</b>${near ? ` · ${near.label}` : ''}<br>` +
        `${o ? `<span class="sw" style="background:${OBSERVED}"></span>OBSERVED ${o[1].toFixed(3)}<br>` : ''}` +
        `<span class="sw dash" style="border-color:${BLACKBODY}"></span>BLACKBODY ${b[1].toFixed(3)}`;
      const px = ((X(nm) / W) * r.width);
      tip.style.left = `${Math.min(px + 12, r.width - 170)}px`;
      tip.style.top = `${(Y(o ? o[1] : b[1]) / H) * r.height - 10}px`;
    });
    hit.addEventListener('pointerleave', () => { tip.hidden = true; for (const n of [cross, dotO, dotB]) n.setAttribute('visibility', 'hidden'); });

    const toggle = (label, key) => {
      const b = el('button', { className: `pill${range === key ? ' on' : ''}`, textContent: label });
      b.addEventListener('click', () => { range = key; drawSpectrum(); });
      return b;
    };
    const legend = el('div', { className: 'sv-legend' },
      spectrum ? el('span', {}, el('span', { className: 'sw', style: `background:${OBSERVED}` }), `OBSERVED · ${spectrum.template} TEMPLATE`, badge('measured',
        `A real flux-calibrated spectrum of a typical ${spectrum.template} star (${spectrum.source}).${spectrum.exact ? '' : ` Closest type in the library to ${spectrum.requested}.`} Not this star's own spectrum.`)) : null,
      el('span', {}, el('span', { className: 'sw dash', style: `border-color:${BLACKBODY}` }), `BLACKBODY · ${fmt(T)} K`, badge('computed', "Planck's law at the star's temperature, scaled to the observed flux.")),
      el('span', {}, el('span', { className: 'sw line' }), 'LINES', badge('measured', 'Laboratory wavelengths of the strongest stellar lines.')));

    spectrumBox.replaceChildren(
      el('div', { className: 'sv-card-head' }, el('h3', { textContent: 'SPECTRUM' }), el('div', { className: 'sv-toggles' }, toggle('VISIBLE', 'visible'), toggle('+ INFRARED', 'ir'))),
      legend,
      el('div', { className: 'sv-chart-wrap' }, s, tip),
      el('p', { className: 'note', textContent: spectrum
        ? 'Dips are absorption lines: atoms in the star\'s atmosphere absorbing their own colours of light. The gap between the dashed curve and the observed one is the star\'s chemistry.'
        : `${body.kind === 'white dwarf' ? 'White dwarfs are not in the stellar template library' : body.kind === 'brown dwarf' ? 'Brown dwarfs are too cool for the stellar template library, and emit mostly beyond 1 µm' : 'No template matched'}; the curve is the blackbody at its temperature. ${body.spectral?.startsWith('DA') ? 'A DA white dwarf shows only very broad hydrogen (Balmer) lines, widened by its immense surface gravity.' : ''}` }),
    );
  }

  // ---- composition ------------------------------------------------------------------------
  function drawComposition() {
    const { body, isSun } = current;
    const c = starComposition(body, isSun);
    const reveals = { H: 'Balmer lines (Hα, Hβ…)', He: 'He I 1083 nm (hot stars)', Ca: 'Ca II H & K, triplet', Na: 'Na D', Mg: 'Mg b', Fe: 'Fe I lines', C: 'G band (CH)', O: 'O I 777 nm' };
    const rows = c.elements.slice(0, 10);
    const minLog = -5; // 0.001%
    const list = el('div', { className: 'sv-bars' }, rows.map((r) => {
      const pct = r.frac * 100;
      const w = Math.max(2, ((Math.log10(Math.max(r.frac, 1e-7)) - minLog) / -minLog) * 100);
      return el('div', { className: 'sv-bar', title: `${r.name}: ${pct < 0.01 ? pct.toExponential(2) : pct.toFixed(3)}% by mass` },
        el('span', { className: 'sv-el', textContent: r.el }),
        el('span', { className: 'sv-track' }, el('span', { className: 'sv-fill', style: `width:${w}%` })),
        el('span', { className: 'sv-val mono', textContent: pct >= 1 ? `${pct.toFixed(1)}%` : pct >= 0.01 ? `${pct.toFixed(3)}%` : `${pct.toExponential(1)}%` }),
        el('span', { className: 'sv-rev', textContent: reveals[r.el] ?? '' }));
    }));
    compositionBox.replaceChildren(
      el('div', { className: 'sv-card-head' }, el('h3', { textContent: 'COMPOSITION · BY MASS' }), badge(c.tier, c.note)),
      el('div', { className: 'sv-comp-title', textContent: c.title }),
      ...(c.whiteDwarf ? [] : [el('div', { className: 'sv-xyz mono' },
        `X (HYDROGEN) ${c.X.toFixed(3)} · Y (HELIUM) ${c.Y.toFixed(3)} · Z (METALS) ${c.Z.toFixed(4)}`)]),
      list,
      el('p', { className: 'note', textContent: `${c.note} Bars use a log scale: hydrogen and helium dwarf everything else.` }),
    );
  }

  function setHeroFacts(body) {
    heroFacts.replaceChildren(...[
      ['CLASS', body.spectral], ['TEMPERATURE', `${fmt(body.teffK)} K`],
      ['RADIUS', `${(body.radiusKm / 695700).toFixed(body.radiusKm < 70000 ? 4 : 3)} × SUN`],
      body.kind === 'brown dwarf' ? ['MASS', `${body.massJup ?? '?'} × JUPITER`] : ['MASS', `${body.massSun?.toFixed(3) ?? '—'} × SUN`],
      ['PEAK EMISSION', wienPeakNm(body.teffK) > 2500 ? `${fmt(wienPeakNm(body.teffK) / 1000, 1)} µm (BEYOND THIS CHART)` : `${fmt(wienPeakNm(body.teffK))} nm`],
    ].flatMap(([k, v]) => [el('dt', { textContent: k }), el('dd', { textContent: v })]));
  }

  return {
    show() { container.hidden = false; sizeHero(); if (!running) { running = true; requestAnimationFrame(frame); } },
    camera: rig,
    hide() { container.hidden = true; running = false; },
    /** Cards built outside the view: `top` under the hero, `spectrum` after the template spectrum. */
    setExtras({ top = [], spectrum = [] } = {}) { extras.replaceChildren(...top.filter(Boolean)); ownSpectrum.replaceChildren(...spectrum.filter(Boolean)); },
    /** Show `body` (a star body from a system model); `spectrum` from /api/spectrum or null. */
    load(body, { isSun = false, systemName = '', spectrum = null } = {}) {
      current = { body, isSun, spectrum };
      starBody = body;
      camera.position.set(0, 0, 5.2); controls.target.set(0, 0, 0);
      if (body.kind === 'brown dwarf') range = 'ir';
      title.replaceChildren(el('h2', { textContent: body.name.toUpperCase() }), el('div', { className: 'kind', textContent: `STAR VIEW · ${systemName.toUpperCase()}` }));
      setStar(body, isSun);
      setHeroFacts(body);
      drawSpectrum();
      drawComposition();
      researchBox.replaceChildren(...stellarResearchCards(body));
    },
    setSpectrum(spectrum) { if (current) { current.spectrum = spectrum; drawSpectrum(); } },
  };
}
