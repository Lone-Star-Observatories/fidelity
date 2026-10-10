// Star View — one star up close: its photosphere, its spectrum, what it is made of.
//
// Spectrum: a real observed spectrum of a star of the same type (Pickles 1998), not this
// star's own, plus the blackbody curve at its temperature and the lines that reveal its
// elements. Composition: the Sun's measured photosphere, or the solar mix scaled by the
// star's measured metallicity.

import * as THREE from 'three';
import { starMaterial, loadTexture, applyLiveSkin } from '../system/materials.js';
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
  const researchBox = el('div', { className: 'stellar-research' });
  container.replaceChildren(el('div', { className: 'sv' },
    el('div', { className: 'sv-top' }, hero, el('div', { className: 'sv-hero-text' }, title, heroFacts)),
    spectrumBox, compositionBox, researchBox));

  function sizeHero() {
    const w = hero.clientWidth || 260;
    renderer.setSize(w, w, false);
  }
  new ResizeObserver(sizeHero).observe(hero);

  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    if (star) {
      star.rotation.y = now * 0.00004;
      const u = star.material.uniforms;
      if (u.uHasDisk.value) { u.uEarthDir.value.copy(camera.position).normalize(); u.uNorth.value.set(0, 1, 0); }
    }
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
    if (isSun) applyLiveSkin(star.material, SUN.skin, settings.get('liveSkins')); // seen from Earth: the live disk faces the camera
    glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: body.color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.75 }));
    glow.scale.setScalar(3.6);
    star.add(glow);
    star.rotation.x = 0.25;
    scene.add(star);
  }

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
    hide() { container.hidden = true; running = false; },
    /** Show `body` (a star body from a system model); `spectrum` from /api/spectrum or null. */
    load(body, { isSun = false, systemName = '', spectrum = null } = {}) {
      current = { body, isSun, spectrum };
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
