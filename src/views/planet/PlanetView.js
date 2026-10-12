// Planet View — one world up close: its surface, what its air is made of, where those gases
// absorb light, what is inside it, and where it sits among rocky, watery and gassy worlds.

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createCameraRig } from '../cameraControls.js';
import { planetMaterial, cloudMaterial, applySkin, loadTexture, applyLiveSkin } from '../system/materials.js';
import { applyBandToMaterial } from '../system/bandtextures.js';
import { currentBand, onBand } from '../../data/bandstate.js';
import { settings } from '../../settings.js';
import { loadBodyShape, disposeModel } from '../system/models.js';
import { planetTexture, ringTexture } from '../system/textures.js';
import { bodyVisualFor } from '../../data/bespoke.js';
import { visualImageUrl } from '../../data/catalog.js';
import { badge } from '../../data/provenance.js';
import { dirToLatLon } from '../system/surface.js';
import { siteDots, siteDir } from '../system/sites.js';
import { PLANETS } from '../../data/sol.js';
import { SOL_ATMOSPHERES, SOL_INTERIORS, INTERIOR_SOURCES, BANDS, MOLECULE_NAMES, EXO_ATMOSPHERES, MR_CURVES, density } from '../../data/planets.js';
import { makeSnapshot } from '../snapshot.js';

const SVGNS = 'http://www.w3.org/2000/svg';
const HIGHLIGHT = '#c97a00';
const el = (tag, props = {}, ...kids) => {
  const e = Object.assign(document.createElement(tag), props);
  for (const k of kids.flat()) if (k != null) e.append(k);
  return e;
};
const svg = (tag, attrs = {}, text) => {
  const e = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text != null) e.textContent = text;
  return e;
};
const fmt = (n, d = 0) => Number(n).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });
const pctText = (p) => (p >= 1 ? `${p.toFixed(p >= 10 ? 1 : 2)}%` : p >= 0.001 ? `${p.toPrecision(2)}%` : `${(p * 1e4).toPrecision(2)} PPM`);
const card = (title, tier, detail, ...body) => el('section', { className: 'sv-card' },
  el('div', { className: 'sv-card-head' }, el('h3', { textContent: title }), tier ? badge(tier, detail) : null), ...body);

// Interior layer fills: one warm ramp, hottest (iron) darkest-saturated, crust lightest.
const LAYER_FILL = { iron: '#8a4d10', 'iron-liquid': '#b0651a', metallic: '#7a6a8a', rock: '#a87c4a', ice: '#5f7f99', gas: '#c9b48a', crust: '#d9c3a0', water: '#2f5f9f' };

export function createPlanetView(container, { onSurface } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0, 6.2);
  const pivot = new THREE.Group();
  pivot.rotation.z = 0.35;
  scene.add(pivot);
  let globe = null, clouds = null, sites = null, mats = [], running = false, globeBody = null;
  // the spectrum filter (#28): the globe takes the same band look as in the System View
  function applyBand() {
    if (!globeBody || !mats[0]) return;
    const { band, pass } = currentBand();
    applyBandToMaterial(mats[0].uniforms, globeBody, band, pass);
    if (clouds) clouds.visible = band.id === 'full' || (band.dominant ?? band.id) === 'visible'; // a custom curve (#66): its dominant band
  }
  onBand(applyBand);
  const sun = new THREE.Vector3(-9, 2, 6); // light from the left, a little towards us

  const hero = el('div', { className: 'sv-hero' });
  hero.append(renderer.domElement);
  const heroFacts = el('dl', { className: 'sv-hero-facts' });
  const title = el('div', { className: 'sv-title' });
  const body = el('div', { className: 'pv-cards' });
  const extras = el('div', { className: 'pv-cards' }); // FROM EARTH, imagery, spectra (src/panels)
  container.replaceChildren(el('div', { className: 'sv' },
    el('div', { className: 'sv-top' }, hero, el('div', { className: 'sv-hero-text' }, title, heroFacts)), extras, body));
  // camera controls (#39): drag to turn the globe, wheel / pinch / slider to zoom, FILL VIEW, full-screen globe
  const controls = new OrbitControls(camera, renderer.domElement);
  Object.assign(controls, { enableDamping: true, dampingFactor: 0.08, enablePan: false, minDistance: 1.12, maxDistance: 40, rotateSpeed: 0.6 });
  const outerRadius = () => (globeBody?.rings ? globeBody.rings.outerKm / globeBody.radiusKm : 1);
  const defaultZ = () => (globeBody?.rings ? 10 : 6.2);
  const rig = createCameraRig({
    key: 'planet', camera, controls, dom: renderer.domElement, container, host: hero, inline: true,
    metersPerUnit: () => (globeBody?.radiusKm ?? 1) * 1000, minFov: 0.2, maxFov: 80, noCursorZoom: true,
    nearest: (p) => Math.max(1e-4, p.length() - 1),
    toOrbit: () => { controls.target.set(0, 0, 0); return true; }, // always orbit the globe; the settle turns back to it
    fit: () => rig.frameSphere(new THREE.Vector3(), outerRadius(), 1.04),
    reset: () => rig.flyTo({ target: new THREE.Vector3(), position: new THREE.Vector3(0, 0, defaultZ()) }),
    onFullscreen: (on) => { container.classList.toggle('hero-full', on); if (on) container.scrollTop = 0; sizeHero(); },
  });
  function sizeHero() {
    const w = hero.clientWidth || 260, h = container.classList.contains('hero-full') ? hero.clientHeight || w : w;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(sizeHero).observe(hero);
  // double-click the globe to stand on that spot and look up (System View surface mode)
  let current = null;
  const ray = new THREE.Raycaster();
  renderer.domElement.title = 'Double-click to stand here and look up';
  renderer.domElement.addEventListener('dblclick', (e) => {
    if (!globe || !current) return;
    const r = renderer.domElement.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
    const hit = ray.intersectObject(globe, false)[0];
    if (!hit) return;
    const { lat, lon } = dirToLatLon(globe.worldToLocal(hit.point.clone()).toArray());
    onSurface?.(current.id, lat, lon);
  });
  // #36: FROM THE SURFACE markers (a picture was taken here; click to stand there)
  let marks = null;
  const MARK_COLOR = { measured: '#ffcc66', live: '#66ff99', render: '#cc99ff' };
  const markTex = {};
  const markTexture = (kind) => markTex[kind] ??= (() => {
    const c = Object.assign(document.createElement('canvas'), { width: 64, height: 64 });
    const g = c.getContext('2d');
    g.fillStyle = '#000'; g.beginPath(); g.arc(32, 32, 30, 0, Math.PI * 2); g.fill();
    g.fillStyle = MARK_COLOR[kind] ?? '#fff'; g.beginPath(); g.arc(32, 32, 25, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#000'; g.fillRect(16, 25, 32, 19); g.fillRect(25, 20, 12, 6); // a camera
    g.fillStyle = MARK_COLOR[kind] ?? '#fff'; g.beginPath(); g.arc(32, 34, 6, 0, Math.PI * 2); g.fill();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.userData.shared = true; return t;
  })();
  function setMarks(list) {
    if (marks) { pivot.remove(marks); for (const s of marks.children) s.material.dispose(); marks = null; }
    if (!globeBody || !list?.length) return;
    marks = new THREE.Group();
    for (const m of list) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: markTexture(m.kind), depthWrite: false }));
      s.position.set(...siteDir(globeBody, m.lat, m.lon).map((c) => c * 1.03));
      s.scale.setScalar(0.075);
      s.userData.mark = m;
      marks.add(s);
    }
    pivot.add(marks);
  }
  renderer.domElement.addEventListener('click', (e) => {
    if (!marks || !globe || !current) return;
    const r = renderer.domElement.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
    const hit = ray.intersectObjects([globe, ...marks.children], true)[0];
    const m = hit?.object?.userData?.mark;
    if (!m) return;
    const { lat, lon } = dirToLatLon(siteDir(globeBody, m.lat, m.lon));
    onSurface?.(current.id, lat, lon);
  });
  renderer.domElement.addEventListener('pointermove', (e) => {
    if (!marks) return;
    const r = renderer.domElement.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
    const m = ray.intersectObjects([globe, ...marks.children], true)[0]?.object?.userData?.mark;
    renderer.domElement.style.cursor = m ? 'pointer' : '';
    renderer.domElement.title = m ? `${m.label} · click to stand here` : 'Double-click to stand here and look up';
  });

  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    if (globe) globe.rotation.y = now * 0.00012;
    if (sites && globe) sites.rotation.y = globe.rotation.y;
    if (marks && globe) marks.rotation.y = globe.rotation.y;
    if (clouds) clouds.rotation.y = now * 0.000128;
    for (const m of mats) m.uniforms.uSunPos.value.copy(sun);
    if (rig.update(now)) controls.update();
    // a whole-disc band image (#28) faces the viewer here, north along the globe's axis (the System View uses Earth's direction)
    for (const m of mats) if (m.uniforms.uDiscOn?.value > 0.5) { m.uniforms.uDiscE.value.copy(camera.position).normalize(); m.uniforms.uDiscN.value.set(0, 1, 0).applyEuler(pivot.rotation); }
    renderer.render(scene, camera);
  }

  function setGlobe(b) {
    for (const o of [...pivot.children]) { pivot.remove(o); disposeModel(o); }
    mats = []; clouds = null; marks = null;
    const placeholder = planetTexture(b.palette ? b : { id: b.id, palette: ['#777', '#888', '#666'] });
    const mat = planetMaterial(placeholder, { tint: b.skin?.tint, ambient: 0.05 });
    applySkin(mat, b.skin);
    mats.push(mat);
    globe = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 64), mat);
    pivot.add(globe);
    globeBody = b;
    const pendingGlobe = globe;
    loadBodyShape(b.id, b.radiusKm).then((shape) => {
      if (!shape) return;
      if (globe !== pendingGlobe) { disposeModel(shape); return; }
      shape.traverse((o) => {
        if (!o.isMesh) return;
        for (const material of (Array.isArray(o.material) ? o.material : [o.material])) material?.dispose();
        o.material = mat;
      });
      pivot.remove(pendingGlobe);
      pendingGlobe.geometry.dispose();
      globe = shape; pivot.add(globe);
    }).catch((error) => console.warn(`Body shape unavailable: ${b.id}`, error));
    // #37: sites of note as dots, turning with the globe (SITES toggle and filters)
    sites = settings.get('sites') ? siteDots(b, new Set([...(settings.get('siteHidden') ?? []), ...(settings.get('starfleet') ? [] : ['trek'])])) : null;
    if (sites) pivot.add(sites);
    if (b.skin?.clouds) {
      const cm = cloudMaterial(placeholder);
      cm.uniforms.uMap.value = new THREE.Texture();
      loadTexture(b.skin.clouds).then((t) => { if (t) cm.uniforms.uMap.value = t; });
      mats.push(cm);
      clouds = new THREE.Mesh(new THREE.SphereGeometry(1.012, 128, 64), cm);
      pivot.add(clouds);
    }
    applyBand();
    // today's imagery (with today's clouds) where the backend can fetch it
    const myClouds = clouds;
    applyLiveSkin(mat, b.skin, settings.get('liveSkins')).then((l) => { if (l && myClouds) myClouds.visible = false; });
    if (b.rings) {
      const inner = b.rings.innerKm / b.radiusKm, outer = b.rings.outerKm / b.radiusKm;
      const geo = new THREE.RingGeometry(inner, outer, 160, 1);
      const p = geo.attributes.position, uv = geo.attributes.uv;
      for (let k = 0; k < p.count; k++) uv.setXY(k, (Math.hypot(p.getX(k), p.getY(k)) - inner) / (outer - inner), 0.5);
      const rm = new THREE.MeshBasicMaterial({ map: ringTexture(), side: THREE.DoubleSide, transparent: true, depthWrite: false });
      loadTexture(b.skin?.ring).then((t) => { if (t) { rm.map = t; rm.needsUpdate = true; } });
      const ring = new THREE.Mesh(geo, rm);
      ring.rotation.x = -Math.PI / 2 + 0.45;
      pivot.add(ring);
    }
    camera.position.set(0, 0, defaultZ());
    controls.target.set(0, 0, 0);
  }

  function bespokeCards(b) {
    const visual = bodyVisualFor(b);
    if (!visual) return [];
    const note = [...(visual.assumed ?? []), ...(visual.unknown ?? [])].join(' ');
    const sources = el('div', { className: 'bespoke-sources' }, ...visual.references.map(ref =>
      el('a', { href: ref.url, target: '_blank', rel: 'noopener noreferrer', textContent: ref.title })));
    const result = [];
    if (visual.statusNote) result.push(card('PLANET STATUS', 'modelled', 'Archive membership and independent detection evidence can differ.',
      el('p', { className: 'note', textContent: visual.statusNote })));
    for (const [label, asset] of [[visual.surfaceLabel ?? 'SURFACE HYPOTHESIS', visual.surfaceImage ?? visual.surfaceMap], [visual.skyLabel ?? 'SKY FROM THE SURFACE', visual.skyImage]]) {
      const url = visualImageUrl(asset);
      if (!url) continue;
      const content = el('div', {}, el('img', { src: url, loading: 'lazy', className: 'bespoke-image', alt: `${b.name}: ${label.toLowerCase()}, hypothetical illustration` }),
        el('p', { className: 'note', textContent: note }), el('p', { className: 'note', textContent: asset.credit }));
      if (asset === visual.skyImage) content.append(el('p', { className: 'note', textContent:
        `${visual.skyModel.star}: ${visual.skyModel.temperatureK} K; calculated angular diameter ${visual.skyModel.angularDiameterDeg.toFixed(3)}°. Stellar colour and size in this illustration are approximate.` }));
      result.push(card(label, 'imagined', 'Research constrains this scenario; foreground, viewpoint and unmeasured properties are hypothetical.', content));
    }
    result.push(card('RESEARCH CONTEXT', 'modelled', 'Sources distinguish measurements, models and artistic assumptions.',
      el('p', { className: 'note', textContent: visual.measured.join(' ') }),
      ...(visual.modelled ?? []).map(text => el('div', {}, badge('modelled', text), el('p', { className: 'note', textContent: text }))),
      ...(visual.contextImages ?? []).map(asset => el('div', {},
        visualImageUrl(asset) ? el('img', { src: visualImageUrl(asset), loading: 'lazy', className: 'bespoke-image', alt: asset.description }) : null,
        badge(asset.tier, asset.description), el('p', { className: 'note', textContent: asset.description }),
        asset.sourceUrl ? el('a', { href: asset.sourceUrl, target: '_blank', rel: 'noopener noreferrer', textContent: asset.credit }) : el('p', { className: 'note', textContent: asset.credit }),
        asset.termsUrl ? el('a', { href: asset.termsUrl, target: '_blank', rel: 'noopener noreferrer', textContent: asset.terms }) : null)), sources));
    return result;
  }

  // ---- atmosphere --------------------------------------------------------------------------
  function atmosphereCard(b, isSol) {
    if (isSol) {
      const a = SOL_ATMOSPHERES[b.id];
      if (!a) return null;
      const minLog = -6;
      const rows = a.gases.map(([label, key, pct]) => {
        const w = Math.max(2, ((Math.log10(pct / 100) - minLog) / -minLog) * 100);
        return el('div', { className: 'sv-bar', title: `${MOLECULE_NAMES[key] ?? label}: ${pctText(pct)} by volume` },
          el('span', { className: 'sv-el', textContent: label }),
          el('span', { className: 'sv-track' }, el('span', { className: 'sv-fill', style: `width:${w}%` })),
          el('span', { className: 'sv-val mono', textContent: pctText(pct) }),
          el('span', { className: 'sv-rev', textContent: MOLECULE_NAMES[key] ?? '' }));
      });
      const pressure = a.pressureBar == null ? 'NO SURFACE: A DEEPENING GAS ENVELOPE'
        : a.pressureBar < 1e-6 ? `SURFACE PRESSURE ≈ ${a.pressureBar.toExponential(0)} BAR (NEAR VACUUM)` : `SURFACE PRESSURE ${a.pressureBar >= 1 ? fmt(a.pressureBar, a.pressureBar < 10 ? 2 : 0) : a.pressureBar.toPrecision(2)} BAR`;
      return card(`${a.kind} · BY VOLUME`, 'measured', a.source,
        el('div', { className: 'sv-comp-title', textContent: pressure }),
        el('div', { className: 'sv-bars' }, rows),
        el('p', { className: 'note', textContent: `${a.source}. Bars use a log scale so trace gases stay visible.` }));
    }
    const det = EXO_ATMOSPHERES[b.name];
    if (!det) {
      return card('ATMOSPHERE', 'imagined', 'Not measured.',
        el('div', { className: 'sv-comp-title', textContent: 'NOT YET MEASURED' }),
        el('p', { className: 'note', textContent: 'No spectrum of this planet\'s atmosphere exists yet. Transiting planets around bright, nearby stars are the best targets for JWST and future telescopes.' }));
    }
    return card('ATMOSPHERE · DETECTED GASES', 'measured', det.ref,
      el('div', { className: 'sv-comp-title', textContent: det.gases.length ? det.gases.map((g) => MOLECULE_NAMES[g] ?? g).join(' · ') : 'NO THICK ATMOSPHERE DETECTED' }),
      el('p', { className: 'note', textContent: `${det.note} (${det.ref})` }));
  }

  // ---- spectral fingerprints -------------------------------------------------------------------
  function fingerprintCard(b, isSol) {
    let gases;
    if (isSol) gases = (SOL_ATMOSPHERES[b.id]?.gases ?? []).map(([label, key, pct]) => ({ label, key, pct }));
    else gases = (EXO_ATMOSPHERES[b.name]?.gases ?? []).map((key) => ({ label: key, key, pct: null }));
    gases = gases.filter((g) => BANDS[g.key]);
    if (!gases.length) return null;
    const x0 = 300, x1 = 2500, W = 900, rowH = 30, m = { l: 92, r: 16, t: 14, b: 44 };
    const H = m.t + gases.length * rowH + m.b, pw = W - m.l - m.r;
    const X = (nm) => m.l + ((nm - x0) / (x1 - x0)) * pw;
    const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'sv-chart', role: 'img', 'aria-label': `Where ${b.name}'s gases absorb light` });
    for (let nm = 500; nm <= x1; nm += 500) {
      s.append(svg('line', { x1: X(nm), x2: X(nm), y1: m.t, y2: H - m.b, class: 'grid' }));
      s.append(svg('text', { x: X(nm), y: H - m.b + 18, class: 'tick', 'text-anchor': 'middle' }, String(nm)));
    }
    s.append(svg('rect', { x: X(380), y: H - m.b + 26, width: X(750) - X(380), height: 5, rx: 2, fill: 'url(#pv-rainbow)' }));
    const grad = svg('linearGradient', { id: 'pv-rainbow', x1: '0', x2: '1' });
    [['0%', '#7f00ff'], ['18%', '#0040ff'], ['35%', '#00c0ff'], ['50%', '#00ff40'], ['65%', '#ffff00'], ['82%', '#ff8000'], ['100%', '#ff0000']]
      .forEach(([o, c]) => grad.append(svg('stop', { offset: o, 'stop-color': c, 'stop-opacity': 0.7 })));
    const defs = svg('defs'); defs.append(grad); s.append(defs);
    s.append(svg('text', { x: m.l + pw / 2, y: H - 4, class: 'axis-label', 'text-anchor': 'middle' }, 'WAVELENGTH (nm)'));
    gases.forEach((g, i) => {
      const y = m.t + i * rowH;
      s.append(svg('text', { x: m.l - 10, y: y + rowH / 2 + 4, class: 'tick', 'text-anchor': 'end' }, g.label));
      s.append(svg('line', { x1: m.l, x2: W - m.r, y1: y + rowH / 2, y2: y + rowH / 2, class: 'grid' }));
      // more abundant gases draw darker bands (opacity on a log scale); detections at full strength
      const op = g.pct == null ? 0.95 : Math.max(0.25, Math.min(1, 1 + Math.log10(g.pct / 100) / 6));
      for (const [c, hw, name] of BANDS[g.key]) {
        if (c + hw < x0 || c - hw > x1) continue;
        const r = svg('rect', { x: X(Math.max(x0, c - hw)), y: y + 6, width: Math.max(3, X(c + hw) - X(c - hw)), height: rowH - 12, rx: 3, fill: HIGHLIGHT, 'fill-opacity': op });
        r.append(svg('title', {}, `${MOLECULE_NAMES[g.key] ?? g.key} · ${c} nm${name ? ` (${name})` : ''}`));
        s.append(r);
      }
    });
    return card('SPECTRAL FINGERPRINTS', 'modelled', 'Band positions are laboratory measurements; band depths here are illustrative, not a measured spectrum of this planet.',
      el('div', { className: 'sv-chart-wrap' }, s),
      el('p', { className: 'note', textContent: isSol
        ? 'Where each gas in this atmosphere absorbs sunlight. Telescopes find these same gases on other worlds by looking for these bands: oxygen\'s A band at 760 nm and ozone together are a classic sign of life on Earth.'
        : 'Bands of the gases detected in this planet\'s measured spectrum.' }));
  }

  // ---- interior ---------------------------------------------------------------------------------
  function interiorCard(b, isSol) {
    const layers = isSol ? SOL_INTERIORS[b.id] : null;
    if (!layers) return null;
    const S = 260, c = S / 2, R = S / 2 - 6;
    const s = svg('svg', { viewBox: `0 0 ${S} ${S}`, class: 'pv-interior', role: 'img', 'aria-label': `Interior of ${b.name}` });
    for (let i = layers.length - 1; i >= 0; i--) {
      const [name, frac, kind] = layers[i];
      const circ = svg('circle', { cx: c, cy: c, r: R * frac, fill: LAYER_FILL[kind], stroke: '#000', 'stroke-width': 2 });
      circ.append(svg('title', {}, `${name}: out to ${fmt(frac * b.radiusKm)} km`));
      s.append(circ);
    }
    const list = el('div', { className: 'pv-layers' }, layers.map(([name, frac, kind], i) =>
      el('div', { className: 'pv-layer' }, el('span', { className: 'pv-swatch', style: `background:${LAYER_FILL[kind]}` }),
        el('span', { textContent: name }),
        el('span', { className: 'mono pv-depth', textContent: `${fmt((i ? layers[i - 1][1] : 0) * b.radiusKm)}–${fmt(frac * b.radiusKm)} KM` }))));
    const src = INTERIOR_SOURCES[b.id] ?? 'Models fitted to mass, radius and gravity-field measurements';
    return card('INTERIOR · TO SCALE', 'modelled', src, el('div', { className: 'pv-interior-wrap' }, s, list),
      el('p', { className: 'note', textContent: `${src}. Layer radii are model values; only Earth's and Mars's come from seismology.` }));
  }

  // ---- mass–radius ---------------------------------------------------------------------------------
  function massRadiusCard(b, isSol) {
    const mE = isSol ? b.massKg / 5.972e24 : b.massEarth;
    const rE = isSol ? b.radiusKm / 6371 : b.radiusEarth;
    if (!mE || !rE) return null;
    const W = 900, H = 380, m = { l: 56, r: 140, t: 16, b: 46 };
    const pw = W - m.l - m.r, ph = H - m.t - m.b;
    const [lm0, lm1, lr0, lr1] = [Math.log10(0.02), Math.log10(5000), Math.log10(0.25), Math.log10(25)];
    const X = (mm) => m.l + ((Math.log10(mm) - lm0) / (lm1 - lm0)) * pw;
    const Y = (rr) => m.t + ph - ((Math.log10(rr) - lr0) / (lr1 - lr0)) * ph;
    const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'sv-chart', role: 'img', 'aria-label': `${b.name} on the mass–radius diagram` });
    for (const v of [0.1, 1, 10, 100, 1000]) {
      s.append(svg('line', { x1: X(v), x2: X(v), y1: m.t, y2: m.t + ph, class: 'grid' }));
      s.append(svg('text', { x: X(v), y: H - m.b + 18, class: 'tick', 'text-anchor': 'middle' }, String(v)));
    }
    for (const v of [0.3, 1, 3, 10]) {
      s.append(svg('line', { x1: m.l, x2: m.l + pw, y1: Y(v), y2: Y(v), class: 'grid' }));
      s.append(svg('text', { x: m.l - 8, y: Y(v) + 4, class: 'tick', 'text-anchor': 'end' }, String(v)));
    }
    s.append(svg('text', { x: m.l + pw / 2, y: H - 6, class: 'axis-label', 'text-anchor': 'middle' }, 'MASS (EARTH = 1)'));
    s.append(svg('text', { x: 14, y: m.t + ph / 2, class: 'axis-label', 'text-anchor': 'middle', transform: `rotate(-90 14 ${m.t + ph / 2})` }, 'RADIUS (EARTH = 1)'));
    // composition curves: neutral ink, identified by direct labels (not colour)
    for (const c of MR_CURVES) {
      const pts = [];
      for (let lm = Math.log10(c.min ?? 0.02); lm <= Math.log10(c.max ?? 5000); lm += 0.02) pts.push([10 ** lm, c.R(10 ** lm)]);
      s.append(svg('path', { d: pts.map(([mm, rr], i) => `${i ? 'L' : 'M'}${X(mm).toFixed(1)},${Y(rr).toFixed(1)}`).join(''), class: `mr-curve mr-${c.id}` }));
      const [lm, lr] = pts[pts.length - 1];
      s.append(svg('text', { x: X(lm) + 6, y: Y(lr) + 4, class: 'mr-label' }, c.label));
    }
    // Sol planets for reference
    for (const p of PLANETS) {
      if (p.id === b.id) continue;
      const pm = p.massKg / 5.972e24, pr = p.radiusKm / 6371;
      const g = svg('g', {});
      g.append(svg('circle', { cx: X(pm), cy: Y(pr), r: 5, class: 'mr-ref' }));
      g.append(svg('text', { x: X(pm) + 8, y: Y(pr) - 6, class: 'tick' }, p.name.toUpperCase()));
      g.append(svg('title', {}, `${p.name}: ${pm.toPrecision(3)} M⊕, ${pr.toPrecision(3)} R⊕`));
      s.append(g);
    }
    // this planet
    const here = svg('g', {});
    if (!isSol && b.massIsMinimum) {
      here.append(svg('line', { x1: X(mE), x2: X(mE * 6), y1: Y(rE), y2: Y(rE), stroke: HIGHLIGHT, 'stroke-width': 2, 'stroke-dasharray': '4 3' }));
      here.append(svg('path', { d: `M${X(mE * 6)},${Y(rE) - 5}L${X(mE * 6) + 8},${Y(rE)}L${X(mE * 6)},${Y(rE) + 5}Z`, fill: HIGHLIGHT }));
    }
    here.append(svg('circle', { cx: X(mE), cy: Y(rE), r: 8, fill: HIGHLIGHT, stroke: '#000', 'stroke-width': 2 }));
    here.append(svg('text', { x: X(mE) + 12, y: Y(rE) + 16, class: 'mr-here' }, b.name.toUpperCase()));
    here.append(svg('title', {}, `${b.name}: ${mE.toPrecision(3)} M⊕${b.massIsMinimum ? ' (minimum)' : ''}, ${rE.toPrecision(3)} R⊕`));
    s.append(here);

    const rho = density(mE * 5.972e24, rE * 6371);
    const verdict = !isSol && !b.radiusMeasured ? 'CANNOT TELL YET: THE RADIUS HAS NOT BEEN MEASURED'
      : rE < MR_CURVES[0].R(mE) * 0.97 ? 'DENSER THAN PURE IRON: THE MASS OR RADIUS IS LIKELY OFF'
      : rE <= MR_CURVES[1].R(mE) * 1.08 ? 'ROCKY, WITH AN IRON CORE' : rE <= MR_CURVES[2].R(mE) * 1.08 ? 'ROCK PLUS WATER OR ICE'
        : mE < 15 ? 'NEEDS A GAS ENVELOPE TO BE THIS LARGE' : 'GAS-RICH: MOSTLY HYDROGEN AND HELIUM';
    const tier = isSol ? 'measured' : b.radiusMeasured && !b.massIsMinimum ? 'computed' : 'modelled';
    return card('BULK COMPOSITION · MASS–RADIUS', tier,
      isSol ? 'Measured mass and radius.' : b.radiusMeasured ? (b.massIsMinimum ? 'Radius measured; mass is a minimum, so density is an upper bound.' : 'Measured mass and radius.') : 'Radius is estimated from mass, so this placement is circular.',
      el('div', { className: 'sv-comp-title', textContent: `DENSITY ${rho.toFixed(2)} G/CM³ · ${verdict}` }),
      el('div', { className: 'sv-chart-wrap' }, s),
      el('p', { className: 'note', textContent: `Curves: what a planet made purely of iron, Earth-like rock, half water, or hydrogen and helium would measure (after Zeng et al. 2016/2019), badged MODELLED. ${!isSol && b.massIsMinimum ? 'The arrow: this mass is a minimum (radial velocity), so the true point lies to the right.' : ''}${!isSol && !b.radiusMeasured ? ' This planet\'s radius was not measured, so it sits on the curve it was estimated from.' : ''}` }));
  }

  return {
    /** #40: re-render at w × h for a postcard (see views/snapshot.js). */
    snapshot: makeSnapshot({ renderer, scene, camera, draw: () => renderer.render(scene, camera), restore: sizeHero }),
    show() { container.hidden = false; if (!running) { running = true; requestAnimationFrame(frame); } },
    camera: rig,
    hide() { container.hidden = true; running = false; },
    /** Cards built outside the view (observing data, imagery, spectra), shown under the hero. */
    setExtras(nodes) { extras.replaceChildren(...nodes.filter(Boolean)); },
    /** #36: camera markers on the globe for body `id` ([{ lat, lon (planetocentric), kind, label }]). */
    setSurfaceMarks(id, list) { if (current?.id === id) setMarks(list); },
    load(b, { isSol = false, systemName = '' } = {}) {
      const minor = ['moon', 'asteroid', 'comet', 'dwarf planet'].includes(b.kind) && b.id !== 'pluto';
      const view = b.kind === 'moon' ? 'MOON VIEW' : minor ? 'OBJECT VIEW' : 'PLANET VIEW';
      title.replaceChildren(el('h2', { textContent: b.name.toUpperCase() }), el('div', { className: 'kind', textContent: `${view} · ${systemName.toUpperCase()}` }));
      const mE = isSol ? (b.massKg ? b.massKg / 5.972e24 : null) : b.massEarth;
      const rE = b.radiusKm / 6371;
      heroFacts.replaceChildren(...[
        ['RADIUS', `${fmt(b.radiusKm)} KM · ${rE.toFixed(2)} × EARTH`],
        ['MASS', mE ? `${mE.toPrecision(3)} × EARTH${b.massIsMinimum ? ' (MIN)' : ''}` : 'UNKNOWN'],
        ['DENSITY', mE ? `${density(mE * 5.972e24, b.radiusKm).toFixed(2)} G/CM³` : '—'],
        ['TEMPERATURE', isSol ? (b.meanTempC != null ? `${b.meanTempC} °C MEAN` : '—') : b.teq ? `${fmt(b.teq)} K EQUILIBRIUM` : '—'],
        ['CLASS', isSol ? (b.kind === 'moon' ? `MOON OF ${b.parent.toUpperCase()}` : minor ? b.kind.toUpperCase() : b.kind === 'dwarf planet' ? 'DWARF PLANET' : rE > 3 ? 'GIANT PLANET' : 'ROCKY PLANET') : b.planetClass],
      ].flatMap(([k, v]) => [el('dt', { textContent: k }), el('dd', { textContent: v })]));
      setGlobe(b);
      current = b;
      // The mass–radius diagram is for planets; moons and small bodies are far off its scale.
      body.replaceChildren(...bespokeCards(b), ...[atmosphereCard(b, isSol), fingerprintCard(b, isSol), interiorCard(b, isSol), minor || !mE ? null : massRadiusCard(b, isSol)].filter(Boolean));
    },
  };
}
