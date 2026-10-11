// Universe View — the nearby universe in supergalactic coordinates (the plane of the Local
// Supercluster horizontal), centred on the Milky Way: 869 named nearby galaxies (UNGC) and
// 38,000 galaxy groups with measured distances (Cosmicflows-4), with a distance filter.
// Spectrum filter (#28): galaxies are re-weighted by morphological type for the band
// (src/astro/galaxyband.js galaxyTypeWeight: ellipticals bright in the near-IR and X-rays, spirals in
// the far-IR and radio, irregulars in the UV and HI), in the band's false colour. MODELLED.

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { radecToSupergal, galToSupergal, frameToScene, blackbodyRGB } from '../../astro/frames.js';
import { GALAXY_NAMES, GALAXY_CLUSTERS } from '../../data/deepsky.js';
import { settings } from '../../settings.js';
import { onClicks } from '../pick.js';
import { createCameraRig, motionK, nearestPoint, aheadPoint } from '../cameraControls.js';
import { METERS } from '../cameraMath.js';
import { currentBand, onBand } from '../../data/bandstate.js';
import { galaxyTypeWeight } from '../../astro/galaxyband.js';
import { PAL_RGB } from '../system/starband.js';
import { paletteIndex } from '../system/bandskin.js';
import { createGalaxyForms } from './galaxyforms.js';
import { nebulaImageUrl } from '../../data/catalog.js';
import { makeSnapshot } from '../snapshot.js';

export const MLY_PER_MPC = 3.26156;
// Morphological type (de Vaucouleurs T) → colour: ellipticals/lenticulars red-gold, spirals white, irregulars blue.
export const typeTeff = (T) => (T == null ? 6500 : T <= 0 ? 4300 : T <= 5 ? 6200 : 9000);
export const typeName = (T) => (T == null ? 'GALAXY' : T <= -3 ? 'ELLIPTICAL' : T <= 0 ? 'LENTICULAR' : T <= 8 ? 'SPIRAL' : T === 9 || T === 10 ? 'IRREGULAR' : 'DWARF');

// Motion of the Milky Way's neighbourhood. CMB dipole: the Local Group moves 627 ± 22 km/s
// towards l = 276°, b = +30° (Kogut et al. 1993; Planck 2020). Andromeda: −110 km/s radial,
// ~57 km/s tangential (van der Marel et al. 2019); merger in ~4.5 Gyr (Sohn/van der Marel 2012).
export const MOTION = {
  lg: { kms: 627, l: 276, b: 30 },
  m31: { ra: 10.6847, dec: 41.269, mly: 2.5, radialKms: -110, tangentialKms: 57, mergeGyr: 4.5 },
};

/** What the two arrows mean (KEY and hover labels). */
export const MOTION_KEY = {
  lg: `Gold arrow: the Local Group (Milky Way, Andromeda and their neighbours) moves at ${MOTION.lg.kms} ± 22 km/s towards galactic l = ${MOTION.lg.l}°, b = +${MOTION.lg.b}° relative to the cosmic microwave background, measured from the CMB dipole (Kogut et al. 1993; Planck 2020). MEASURED.`,
  m31: `Red arrow: Andromeda approaches the Milky Way at ${-MOTION.m31.radialKms} km/s (radial velocity, Sun's motion removed), with only ~${MOTION.m31.tangentialKms} km/s sideways (HST/Gaia proper motions, van der Marel et al. 2019), so the two collide in ~${MOTION.m31.mergeGyr} Gyr. MEASURED velocities, MODELLED merger time.`,
};

const VERT = `
  attribute float size; attribute vec3 color; varying vec3 vColor; varying float vFar; uniform float uPixel; uniform float uRadius;
  void main() { vColor = color; vFar = length(position) > uRadius ? 1.0 : 0.0;
    vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = size * uPixel; }`;
const FRAG = `
  varying vec3 vColor; varying float vFar;
  void main() { if (vFar > 0.5) discard; float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.05, d); if (a < 0.02) discard; gl_FragColor = vec4(vColor, a); }`;

export function createUniverseView(container, { onSelect, onFrame, onDrill } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);
  const labels = new CSS2DRenderer();
  labels.domElement.className = 'labels-layer';
  container.appendChild(labels.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.001, 1e5);
  const controls = new OrbitControls(camera, labels.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 0.05;
  controls.maxDistance = 20000;

  const uniforms = { uPixel: { value: renderer.getPixelRatio() }, uRadius: { value: 100 } };
  function makePoints(rows) {
    const n = rows.length, pos = new Float32Array(n * 3), size = new Float32Array(n), col = new Float32Array(n * 3);
    rows.forEach((r, i) => { pos.set(r.slice(0, 3), i * 3); size[i] = r[3]; col.set(r.slice(4, 7), i * 3); });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('size', new THREE.BufferAttribute(size, 1));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const p = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false }));
    p.frustumCulled = false;
    scene.add(p);
    return p;
  }

  const tags = [];
  function tag(text, cls, pos, { kind = 'chart', always = false, onClick = null } = {}) {
    const el = document.createElement(onClick ? 'button' : 'div');
    el.className = `nav-label ${cls}`;
    el.textContent = text;
    if (onClick) { el.addEventListener('pointerdown', (e) => e.stopPropagation()); el.addEventListener('click', (e) => { e.stopPropagation(); onClick(); }); }
    const o = new CSS2DObject(el);
    o.position.copy(pos);
    o.center.set(-0.12, 0.5);
    scene.add(o);
    tags.push({ obj: o, kind, dist: pos.length(), always });
    return o;
  }

  // supergalactic plane rings
  const chart = new THREE.Group();
  scene.add(chart);
  function drawChart(R) {
    for (const o of [...chart.children]) { chart.remove(o); o.geometry.dispose(); o.material.dispose(); }
    for (const t of tags.filter((x) => x.kind === 'chart')) { scene.remove(t.obj); t.obj.element.remove(); }
    tags.splice(0, tags.length, ...tags.filter((x) => x.kind !== 'chart'));
    for (const r of [R / 3, R]) {
      const pts = [];
      for (let i = 0; i <= 160; i++) { const a = (i / 160) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r)); }
      chart.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x9977aa, transparent: true, opacity: 0.35 })));
      tag(`${r.toLocaleString('en-US', { maximumFractionDigits: 1 })} MLY`, 'ring', new THREE.Vector3(r * Math.cos(-0.35), 0, r * Math.sin(-0.35)));
    }
    tag('SUPERGALACTIC PLANE', 'spoke', new THREE.Vector3(R * 1.05, 0, 0));
  }

  // the spectrum filter (#28): a galaxy's colour in the band, from its type (groups: a spiral-like mix)
  function bandColour(T, base) {
    const { band, pass, full } = currentBand();
    if (full || !pass?.filter) return base;
    const w = galaxyTypeWeight(T, pass.filter), k = Math.min(1.6, Math.sqrt(w)); // compressed for display
    const t = band.palette === 'visible' ? base : PAL_RGB[paletteIndex(band.palette)];
    return [t[0] * k, t[1] * k, t[2] * k];
  }
  function recolourBand() {
    for (const [pts, rows, colourOf] of [[ungcPts, ungcRows, (r) => bandColour(r[4], blackbodyRGB(typeTeff(r[4])))], [groupPts, groupRows, (r) => { const k = Math.min(1, 0.6 + 0.15 * Math.log10(r[1])); return bandColour(null, [0.75 * k, 0.8 * k, k]); }]]) {
      if (!pts) continue;
      const c = pts.geometry.attributes.color;
      rows.forEach((r, i) => c.setXYZ(i, ...colourOf(r)));
      c.needsUpdate = true;
    }
  }
  onBand(recolourBand);

  const objects = [];
  // real images with 3D form for the nearest big galaxies (#50)
  const texLoader = new THREE.TextureLoader();
  const forms = createGalaxyForms({ scene, sgScene: (ra, dec, d) => sgScene(ra, dec, d), imageUrl: nebulaImageUrl,
    loadTexture: (url) => new Promise((res) => texLoader.load(url, (t) => { t.colorSpace = THREE.SRGBColorSpace; res(t); }, undefined, () => res(null))) });
  let ungcPts = null, groupPts = null, groupRows = [], ungcRows = [];
  const sgScene = (ra, dec, d) => new THREE.Vector3(...frameToScene(radecToSupergal(ra, dec, d)));

  function setGalaxies(d) {
    if (ungcPts || !d?.ungc) return;
    ungcRows = d.ungc.rows;
    forms.build(ungcRows);
    groupRows = d.groups.rows;
    // groups: SG Cartesian in velocity units; place along that direction at the measured distance
    groupPts = makePoints(d.groups.rows.map(([, n, dist, x, y, z]) => {
      const r = Math.hypot(x, y, z) || 1, D = dist * MLY_PER_MPC;
      const p = frameToScene([(x / r) * D, (y / r) * D, (z / r) * D]);
      const k = Math.min(1, 0.6 + 0.15 * Math.log10(n));
      return [...p, Math.max(2, Math.min(8, 2 + 1.8 * Math.log10(n))), 0.75 * k, 0.8 * k, k];
    }));
    ungcPts = makePoints(d.ungc.rows.map(([, ra, dec, mpc, T, absB]) => {
      const c = blackbodyRGB(typeTeff(T));
      return [...sgScene(ra, dec, mpc * MLY_PER_MPC).toArray(), Math.max(2, Math.min(11, 2 + (-(absB ?? -12) - 10) * 0.8)), c[0], c[1], c[2]];
    }));
    for (const [name, ra, dec, mpc, T, absB, kpc, method] of d.ungc.rows) {
      const common = GALAXY_NAMES[name];
      if (!common) continue;
      const pos = sgScene(ra, dec, mpc * MLY_PER_MPC);
      const id = `gal-${name}`;
      objects.push({ id, name: common, catalogue: name, kind: 'galaxy', pos, distLy: mpc * MLY_PER_MPC * 1e6, type: T, absB, diameterKpc: kpc, method });
      tag(common.toUpperCase(), 'host', pos, { kind: 'object', onClick: () => onSelect?.(id) });
    }
    recolourBand();
  }
  for (const [name, ra, dec, mly, note] of GALAXY_CLUSTERS) {
    const pos = sgScene(ra, dec, mly);
    const id = `gcl-${name}`;
    objects.push({ id, name, kind: 'galaxy cluster', pos, distLy: mly * 1e6, note });
    tag(name.toUpperCase(), 'named', pos, { kind: 'object', onClick: () => onSelect?.(id) });
  }
  tag('MILKY WAY · SECTOR 001', 'sol', new THREE.Vector3(), { always: true });
  makePoints([[0, 0, 0, 10, 1, 0.85, 0.55]]);

  // ---- motion (#18): the Local Group against the CMB, and Andromeda closing on us ---------------
  const D = Math.PI / 180;
  const galDir = (l, b) => new THREE.Vector3(...frameToScene(galToSupergal([Math.cos(b * D) * Math.cos(l * D), Math.cos(b * D) * Math.sin(l * D), Math.sin(b * D)]))).normalize();
  const lgDir = galDir(MOTION.lg.l, MOTION.lg.b);
  const lgArrow = new THREE.ArrowHelper(lgDir, new THREE.Vector3(), 1, 0xffcc66);
  const m31 = sgScene(MOTION.m31.ra, MOTION.m31.dec, MOTION.m31.mly);
  const m31Arrow = new THREE.ArrowHelper(m31.clone().negate().normalize(), m31, 1, 0xff8866);
  scene.add(lgArrow, m31Arrow);
  const lgTag = tag(`LOCAL GROUP → ${MOTION.lg.kms} KM/S VS THE CMB`, 'motion', lgDir, { kind: 'motion', always: true });
  const m31Tag = tag(`ANDROMEDA → ${-MOTION.m31.radialKms} KM/S CLOSING · MERGES IN ~${MOTION.m31.mergeGyr} GYR`, 'motion', m31, { kind: 'motion' });
  lgTag.element.title = MOTION_KEY.lg; m31Tag.element.title = MOTION_KEY.m31;
  function scaleMotion(R) {
    const L = R * 0.3;
    lgArrow.setLength(L, L * 0.18, L * 0.08);
    lgTag.position.copy(lgDir).multiplyScalar(L * 1.05);
    const d = m31.length() * 0.75;
    m31Arrow.setLength(d, Math.min(d * 0.25, R * 0.03), Math.min(d * 0.1, R * 0.012));
    m31Tag.position.copy(m31).multiplyScalar(0.6);
    for (const t of tags) if (t.obj === m31Tag) t.dist = R <= 10 ? m31.length() : Infinity; // only once Andromeda stands clear of the crowd
  }

  let radius = 30;
  const target = new THREE.Vector3();
  // double-click the Milky Way to drill down into the Galaxy View (#23)
  onClicks(labels.domElement, {
    dblclick: (e) => {
      const r = renderer.domElement.getBoundingClientRect(), p = new THREE.Vector3().project(camera);
      const d = Math.hypot(((p.x + 1) / 2) * r.width + r.left - e.clientX, ((1 - p.y) / 2) * r.height + r.top - e.clientY);
      if (d < 40) onDrill?.();
    },
  });
  function setRadius(R) {
    radius = R;
    uniforms.uRadius.value = R * 1.02;
    drawChart(R);
    scaleMotion(R);
    controls.maxDistance = R * 6;
    target.set(0, 0, 0);
    camera.position.set(R * 0.4, R * 0.9, R * 1.5);
  }
  let selected = null, zoomTo = null;
  function select(id) {
    selected = objects.find((o) => o.id === id) ?? null;
    for (const t of tags) t.obj.element.classList.toggle('selected', !!selected && t.obj.position.equals(selected.pos));
    if (selected) target.copy(selected.pos);
    const f = selected && forms.formOf(selected.id);
    zoomTo = f ? Math.max(f.sizeMly * 3.2, 0.06) : null;
    return selected;
  }

  let running = false;
  function resize() {
    const { clientWidth: w, clientHeight: h } = container;
    if (!w || !h) return;
    renderer.setSize(w, h, false); labels.setSize(w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(container);
  const tmp = new THREE.Vector3();
  // camera controls (#39): the Milky Way, galaxies and clusters are what FLY speeds up near
  const eachObject = (fn) => { fn(0, 0, 0, 0.05); for (const o of objects) if (o.distLy <= radius * 1.02e6) fn(o.pos.x, o.pos.y, o.pos.z, 0); };
  const rig = createCameraRig({
    key: 'universe', camera, controls, dom: labels.domElement, container, target, metersPerUnit: METERS.mly,
    nearest: (pos) => Math.max(0.01, nearestPoint(pos, eachObject)),
    ahead: (pos, dir) => aheadPoint(pos, dir, eachObject),
    fit: () => rig.frameSphere(selected ? selected.pos : new THREE.Vector3(), selected ? Math.max(0.3, (selected.diameterKpc ?? 30) * 3.26e-3 * 4) : radius, 1.02),
    reset: () => rig.flyTo({ target: new THREE.Vector3(), position: new THREE.Vector3(radius * 0.4, radius * 0.9, radius * 1.5) }),
  });
  function frame() {
    if (!running) return;
    requestAnimationFrame(frame);
    if (rig.update()) {
      if (controls.target.distanceToSquared(target) > 1e-6) {
        const delta = tmp.copy(target).sub(controls.target).multiplyScalar(motionK(0.08));
        controls.target.add(delta); camera.position.add(delta);
      }
      controls.update();
    }
    if (zoomTo != null) { // a selected galaxy with a form: ease in until it fills the view
      const off = camera.position.clone().sub(controls.target), d = off.length(), nd = d + (zoomTo - d) * 0.08;
      camera.position.copy(controls.target).addScaledVector(off.normalize(), nd);
      if (Math.abs(nd - zoomTo) < zoomTo * 0.01) zoomTo = null;
    }
    forms.update(camera, container.clientHeight || 600, radius);
    const show = settings.get('labels');
    // labels for objects inside the filter, and not swamped: only those beyond 2% of the radius
    for (const t of tags) t.obj.visible = !!(t.always || t.kind === 'chart' || (show && t.dist <= radius * 1.02 && t.dist >= radius * 0.03) || (selected && t.obj.position.equals(selected.pos)));
    renderer.render(scene, camera);
    labels.render(scene, camera);
    onFrame?.({});
  }
  setRadius(30);

  return {
    /** #40: re-render at w × h for a postcard (see views/snapshot.js). */
    snapshot: makeSnapshot({ renderer, scene, camera, labels, draw: () => { renderer.render(scene, camera); labels.render(scene, camera); }, restore: resize }),
    show() { container.hidden = false; resize(); if (!running) { running = true; requestAnimationFrame(frame); } },
    hide() { container.hidden = true; running = false; },
    setGalaxies, setRadius, select, recolourBand,
    camera: rig,
    get radius() { return radius; },
    get objects() { return objects; },
    /** The image-and-shape record of a galaxy (#50), or null. */
    formOf: (id) => forms.formOf(id)?.g ?? null,
    counts() {
      const R = radius / MLY_PER_MPC;
      return { galaxies: ungcRows.filter((r) => r[3] <= R).length, groups: groupRows.filter((r) => r[2] <= R).length };
    },
  };
}
