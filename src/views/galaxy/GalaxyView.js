// Galaxy View — the Milky Way face-on, with Sol and the catalogue stars where they really are.
//
// The galaxy itself is a volumetric particle model (#22, ./model.js): bar and bulge, thin and
// thick discs, Reid et al. 2019 spiral arms with dust lanes and HII regions, and the stellar
// halo, badged MODELLED. NASA/JPL-Caltech/R. Hurt's face-on artist's concept (PIA10748),
// calibrated so Sol lands at R₀ = 26.7 kly (GRAVITY 2019), is an optional IMAGINED overlay.
// Units: thousands of light-years.
//
// Deep time (#18): stars turn differentially on a flat rotation curve (in the vertex shader),
// the spiral pattern turns at its own slower-near-the-centre pattern speed, the Sun's frame
// (Sol, quadrant spokes, catalogue reach) rides with the Sun, and the satellite galaxies follow
// orbits integrated in a simple halo. All MODELLED; badged as such in the panel.
//
// Spectrum filter (#28): the model re-weights its components for the band (model.setBand), and the
// Magellanic Clouds swap to a real image in that band (src/data/satellite-bands.js): optical DSS2 in
// full spectrum and visible, Spitzer in the infrared, GALEX/Swift UV, ROSAT, Fermi, Planck, HI4PI.

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { teffFromBV, blackbodyRGB } from '../../astro/frames.js';
import { bandStarColour, currentBand, onBand } from '../../data/bandstate.js';
import { cloudImageFor, cloudCredit, cloudSurveyUrl } from '../../data/satellite-bands.js';
import { galaxyBandNote } from '../../astro/galaxyband.js';
import { PAL_RGB } from '../system/starband.js';
import { paletteIndex } from '../system/bandskin.js';
import { R0_KLY, Z_SUN_KLY, IMAGE, galToScene, VC_KMS, KMS_KLY_PER_MYR, CORE_KLY, OMEGA_SUN, OMEGA_PATTERN,
  SATELLITE_ORBITS, integrateOrbit, orbitAt, kpcToScene } from '../../astro/galaxy.js';
import { loadTexture } from '../system/materials.js';

export { R0_KLY, Z_SUN_KLY, IMAGE, galToScene };
import { createGalaxyPlane } from './plane.js';
import { createGalaxyModel, ARMS, armRadius, armToScene } from './model.js';
import { settings } from '../../settings.js';
import { pickPoint, onClicks } from '../pick.js';


// Stars: galactocentric positions (kly) turned about the pole by −Ω(R)·t on the GPU.
const STAR_VERT = `
  attribute vec3 color; varying vec3 vColor; uniform float uT; uniform float uPixel; uniform float uSize;
  void main() {
    vColor = color;
    float R = length(position.xz);
    float a = -${(VC_KMS * KMS_KLY_PER_MYR).toFixed(6)} / sqrt(R * R + ${(CORE_KLY * CORE_KLY).toFixed(4)}) * uT;
    float c = cos(a), s = sin(a);
    vec3 p = vec3(position.x * c + position.z * s, position.y, -position.x * s + position.z * c);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = uSize * uPixel;
  }`;
const STAR_FRAG = `
  varying vec3 vColor;
  void main() { float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.15, d); if (a < 0.02) discard; gl_FragColor = vec4(vColor, a); }`;
// Satellite-galaxy images: camera-facing quads, additive, with the square edges faded out.
const IMG_FRAG = `
  uniform sampler2D uMap; uniform float uOpacity; uniform vec3 uTint; uniform float uMono; varying vec2 vUv;
  void main() { float f = smoothstep(0.5, 0.28, length(vUv - 0.5));
    vec3 c = max(texture2D(uMap, vUv).rgb - 0.03, 0.0);
    c = mix(c, dot(c, vec3(0.333)) * uTint * 1.5, uMono); // a band's false colour (#28)
    gl_FragColor = vec4(c * f * uOpacity, 1.0); }`;
const STANDALONE = import.meta.env?.MODE === 'standalone';
// band images of the Clouds, loaded once: a survey cutout, or two drawn one over the other (UV)
const imgCache = new Map();
const loadImg = (url) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = url; });
function cloudTexture(over, under) {
  const key = `${over}|${under ?? ''}`;
  if (!imgCache.has(key)) imgCache.set(key, Promise.all([loadImg(over), under ? loadImg(under) : null]).then(([a, b]) => {
    if (!a && !b) return null;
    const c = document.createElement('canvas'); c.width = c.height = 512;
    const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, 512, 512);
    if (b) g.drawImage(b, 0, 0, 512, 512);
    if (a) g.drawImage(a, 0, 0, 512, 512); // transparent where it has no data, so the one below shows
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }));
  return imgCache.get(key);
}
const IMG_VERT = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
/** Gaia BP−RP → an approximate B−V, for colouring (observed colours: distant stars are reddened by dust). */
export const bprpToBV = (bprp) => 0.78 * bprp;

const DEG = Math.PI / 180;
const lbdToGal = (l, b, d) => [d * Math.cos(b * DEG) * Math.cos(l * DEG), d * Math.cos(b * DEG) * Math.sin(l * DEG), d * Math.sin(b * DEG)];

export function createGalaxyView(container, { onFrame, onPickStar, onDrill } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);
  const labels = new CSS2DRenderer();
  labels.domElement.className = 'labels-layer';
  container.appendChild(labels.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.001, 3000);
  const controls = new OrbitControls(camera, labels.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 0.05;
  controls.maxDistance = 900;

  // ---- the image, in the galactic plane --------------------------------------------------
  const plane = createGalaxyPlane({ opacity: 0.55 });
  scene.add(plane);
  // the volumetric model (#22) is the default; the artwork is an optional overlay
  const model = createGalaxyModel({ pixelRatio: renderer.getPixelRatio() });
  model.tune({ scale: 150 });
  const applyLook = () => {
    plane.visible = !!settings.get('galaxyArt');
    model.setBrightness(settings.get('galaxyBright') ?? 0.45);
  };
  applyLook();

  // ---- labels ------------------------------------------------------------------------------
  const tags = [];
  function tag(text, cls, pos, always = false, parent = scene) {
    const el = document.createElement('div');
    el.className = `nav-label ${cls}`;
    el.textContent = text;
    const o = new CSS2DObject(el);
    o.position.set(...pos);
    o.center.set(-0.08, 0.5);
    parent.add(o);
    tags.push({ o, always });
    return o;
  }
  // frames that turn with time: the spiral pattern and the Sun's own frame
  const patternGroup = new THREE.Group(), sunGroup = new THREE.Group();
  scene.remove(plane);
  patternGroup.add(plane, model.group);
  scene.add(patternGroup, sunGroup);
  const sol = galToScene([0, 0, 0]);
  tag('◆ SOL · SECTOR 001', 'sol', sol, true, sunGroup);
  tag('SGR A* · GALACTIC CENTRE', 'center', [0, 0, 0], true);
  // arm names where the model draws them (middle of each arm's fitted range, Reid et al. 2019)
  for (const arm of ARMS) {
    const b = (arm.range[0] + arm.range[1]) / 2;
    tag(arm.name.toUpperCase(), 'spoke', armToScene(b, armRadius(arm, b) + 0.3), false, patternGroup);
  }

  // ---- satellite galaxies: integrated orbits, Spitzer images ---------------------------------
  const satellites = SATELLITE_ORBITS.map((s) => {
    const orbit = integrateOrbit(s.pos, s.vel);
    const pts = orbit.points.map((p) => new THREE.Vector3(...kpcToScene(p)));
    const half = (pts.length - 1) / 2;
    const past = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts.slice(0, half + 1)), new THREE.LineDashedMaterial({ color: 0x8888cc, transparent: true, opacity: 0.35, dashSize: 3, gapSize: 3 }));
    past.computeLineDistances();
    const future = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts.slice(half)), new THREE.LineBasicMaterial({ color: 0x9999ff, transparent: true, opacity: 0.5 }));
    scene.add(past, future);
    const body = new THREE.Group();
    body.add(new THREE.Mesh(new THREE.SphereGeometry(1.2, 16, 12), new THREE.MeshBasicMaterial({ color: 0x9999ff })));
    if (s.texture) {
      const mat = new THREE.ShaderMaterial({ uniforms: { uMap: { value: null }, uOpacity: { value: 1.3 }, uTint: { value: new THREE.Color(1, 1, 1) }, uMono: { value: 0 } }, vertexShader: IMG_VERT, fragmentShader: IMG_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      const quad = new THREE.Mesh(new THREE.PlaneGeometry(s.diameterKly * 1.3, s.diameterKly * 1.3), mat);
      quad.visible = false;
      body.add(quad);
      body.userData.quad = quad;
      body.userData.mat = mat;
    }
    scene.add(body);
    const label = tag(s.name, 'host', [0, 0, 0], true, body);
    label.position.set(s.diameterKly * 0.4, 0, 0);
    return { ...s, orbit, body, label, shown: '' };
  });
  // ---- the spectrum filter (#28): the galaxy model and the Clouds follow the band ---------------
  let bandInfo = { model: galaxyBandNote(null), clouds: {} };
  function applyCloudBand(s, cb) {
    const quad = s.body.userData.quad, mat = s.body.userData.mat, marker = s.body.children[0];
    const img = cloudImageFor(cb), tint = PAL_RGB[paletteIndex(cb.band.palette)];
    mat.uniforms.uTint.value.setRGB(...tint);
    mat.uniforms.uMono.value = !cb.full && cb.band.palette !== 'visible' ? 1 : 0;
    const show = (t, info) => { if (bandInfo.clouds[s.id] !== info) return; if (t) { mat.uniforms.uMap.value = t; quad.visible = true; marker.visible = false; } else { quad.visible = false; marker.visible = true; info.value = 'IMAGE UNAVAILABLE'; info.tier = 'computed'; } };
    // the standalone preview has no backend for survey cutouts: only the bundled Spitzer mosaics
    const useSpitzer = img?.texture || (STANDALONE && cb.full);
    if (!img && !useSpitzer) { quad.visible = false; marker.visible = true; bandInfo.clouds[s.id] = { value: 'NOT OBSERVED IN THIS BAND', tier: 'computed', detail: 'Interstellar gas absorbs the extreme ultraviolet; no image of the Clouds exists here.' }; return; }
    if (STANDALONE && !useSpitzer) { quad.visible = false; marker.visible = true; bandInfo.clouds[s.id] = { value: 'BAND IMAGE NEEDS THE LOCAL BACKEND', tier: 'computed', detail: 'The standalone preview only carries the Spitzer infrared images.' }; return; }
    const shown = useSpitzer ? { id: 'spitzer', label: 'SPITZER · INFRARED', credit: { lmc: 'NASA/JPL-Caltech/M. Meixner (STScI) & the SAGE Legacy Team, PIA07136: Spitzer 3.6–24 µm mosaic.', smc: 'NASA/JPL-Caltech/STScI, PIA12485: Spitzer infrared mosaic.' }, nearest: !img?.texture, ...(img?.texture ? img : {}) } : img;
    const info = { value: `${shown.label}${shown.nearest ? ' · NEAREST MAPPED BAND' : ''}`, tier: 'measured', detail: cloudCredit(shown, s.id) };
    bandInfo.clouds[s.id] = info;
    if (useSpitzer) loadTexture(s.texture).then((t) => show(t, info));
    else cloudTexture(cloudSurveyUrl(shown.survey, s.id), shown.under ? cloudSurveyUrl(shown.under, s.id) : null).then((t) => show(t, info));
  }
  function applyBand(cb = currentBand()) {
    const w = model.setBand(cb);
    bandInfo = { model: galaxyBandNote(w), clouds: {} };
    for (const s of satellites) if (s.body.userData.quad) applyCloudBand(s, cb);
  }

  function placeSatellites(t) {
    const sun = new THREE.Vector3(...sol).applyAxisAngle(Y, -OMEGA_SUN * t);
    for (const s of satellites) {
      s.body.position.set(...kpcToScene(orbitAt(s.orbit, t)));
      const text = `${s.name} · ${Math.round(s.body.position.distanceTo(sun))} KLY`;
      if (text !== s.shown) { s.label.element.textContent = text; s.shown = text; }
    }
  }

  // ---- quadrants ------------------------------------------------------------------------------
  const quadGroup = new THREE.Group(), fleetGroup = new THREE.Group();
  sunGroup.add(quadGroup, fleetGroup);
  const line = (group, a, b, color, opacity = 0.45, dashed = false) => {
    const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...a), new THREE.Vector3(...b)]);
    const m = dashed ? new THREE.LineDashedMaterial({ color, transparent: true, opacity, dashSize: 1.5, gapSize: 1 }) : new THREE.LineBasicMaterial({ color, transparent: true, opacity });
    const l = new THREE.Line(g, m);
    if (dashed) l.computeLineDistances();
    group.add(l);
  };
  // IAU galactic quadrants: longitude spokes from the Sun
  const reach = 60;
  for (const l of [0, 90, 180, 270]) {
    const end = galToScene(lbdToGal(l, 0, reach));
    line(quadGroup, sol, end, 0xff9966, 0.5);
  }
  ['I', 'II', 'III', 'IV'].forEach((q, i) => {
    const p = galToScene(lbdToGal(45 + 90 * i, 0, 22));
    const o = tag(`QUADRANT ${q}`, 'quadrant', p);
    quadGroup.add(o);
  });
  // Starfleet's quadrants: centred on the galactic core, split along the core–Sol line (IMAGINED)
  {
    const R = 60;
    line(fleetGroup, [-R, 0, 0], [R, 0, 0], 0xcc6666, 0.7, true);
    line(fleetGroup, [0, 0, -R], [0, 0, R], 0xcc6666, 0.7, true);
    // seen from galactic north with Sol at the bottom: Alpha bottom-left, Beta bottom-right
    const fleet = [['ALPHA', -30, 30], ['BETA', -30, -30], ['GAMMA', 30, 30], ['DELTA', 30, -30]];
    for (const [n, x, z] of fleet) fleetGroup.add(tag(`${n} QUADRANT`, 'fleet', [x, 0, z]));
  }

  // ---- stars: HYG within 1.5 kly, Gaia DR3 beyond ---------------------------------------------
  const starUniforms = { uT: { value: 0 }, uPixel: { value: renderer.getPixelRatio() }, uSize: { value: 2 } };
  const layers = {};
  let reachRing = null;
  function makeStars(rows, colourOf, size) {
    const n = rows.length, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    rows.forEach(([gx, gy, gz, m10, c100], i) => {
      pos.set(galToScene([gx, gy, gz], 0.001), i * 3);
      const t = teffFromBV(colourOf(c100)), c = bandStarColour(t, blackbodyRGB(t)); // spectrum filter (#28)
      const k = Math.min(1, Math.max(0.35, 0.9 - m10 / 40));
      col.set([c[0] * k, c[1] * k, c[2] * k], i * 3);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const u = { ...starUniforms, uSize: { value: size } };
    const p = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: u, vertexShader: STAR_VERT, fragmentShader: STAR_FRAG, transparent: true, depthWrite: false }));
    p.frustumCulled = false;
    p.userData.band = { rows, colourOf };
    scene.add(p);
    return p;
  }
  const layerRows = {};
  function setLayer(key, rows, colourOf, size) {
    layerRows[key] = rows ?? [];
    if (layers[key]) { scene.remove(layers[key]); layers[key].geometry.dispose(); layers[key].material.dispose(); }
    layers[key] = rows?.length ? makeStars(rows, colourOf, size) : null;
  }
  function setStars(d) {
    if (!d) return;
    setLayer('hyg', d.stars, (c) => (c != null ? c / 100 : 0.6), 2);
    if (!reachRing) {
      const pts = [];
      for (let k = 0; k <= 128; k++) { const a = (k / 128) * Math.PI * 2; pts.push(new THREE.Vector3(sol[0] + Math.cos(a) * d.maxLy / 1000, sol[1], sol[2] + Math.sin(a) * d.maxLy / 1000)); }
      reachRing = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x9999ff, transparent: true, opacity: 0.7 }));
      sunGroup.add(reachRing);
      tag(`HYG CATALOGUE REACH · ${(d.maxLy / 1000).toFixed(1)} KLY`, 'ring', [sol[0], sol[1], sol[2] - d.maxLy / 1000 - 0.2], false, sunGroup);
    }
  }
  let gaiaCount = 0;
  function setGaia(d) {
    if (!d?.stars) return;
    gaiaCount = d.stars.length;
    setLayer('gaia', d.stars, (c) => (c != null ? bprpToBV(c / 100) : 0.6), 1.6);
  }

  // ---- deep time -------------------------------------------------------------------------------
  const Y = new THREE.Vector3(0, 1, 0);
  let epoch = 0, follow = false;
  function setTime(tMyr) {
    const before = new THREE.Vector3(...sol).applyAxisAngle(Y, -OMEGA_SUN * epoch);
    epoch = tMyr;
    for (const l of Object.values(layers)) if (l) l.material.uniforms.uT.value = tMyr;
    starUniforms.uT.value = tMyr;
    patternGroup.rotation.y = -OMEGA_PATTERN * tMyr;
    sunGroup.rotation.y = -OMEGA_SUN * tMyr;
    placeSatellites(tMyr);
    if (follow) { // keep Sol in frame when looking at the neighbourhood
      const d = new THREE.Vector3(...sol).applyAxisAngle(Y, -OMEGA_SUN * tMyr).sub(before);
      target.add(d); controls.target.add(d); camera.position.add(d);
      if (want.pos) want.pos.add(d);
    }
  }

  // ---- click a star to investigate it (#23); double-click to drill down to the Quadrant View
  const pv = new THREE.Vector3();
  function pickStar(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    let best = null;
    for (const key of ['hyg', 'gaia']) {
      const pts = layers[key];
      if (!pts) continue;
      const pos = pts.geometry.attributes.position.array, k = VC_KMS * KMS_KLY_PER_MYR;
      const at = (i) => { // same differential rotation as the vertex shader
        const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
        const a = (-k / Math.sqrt(x * x + z * z + CORE_KLY * CORE_KLY)) * epoch, c = Math.cos(a), s = Math.sin(a);
        return pv.set(x * c + z * s, y, -x * s + z * c);
      };
      const hit = pickPoint(at, pos.length / 3, null, camera, rect, e.clientX, e.clientY, 8);
      if (hit && (!best || hit.px < best.px)) best = { ...hit, key };
    }
    if (!best) return null;
    const row = layerRows[best.key][best.index];
    return { kind: best.key, id: row[5] ?? null, gal: [row[0], row[1], row[2]], distLy: Math.hypot(row[0], row[1], row[2]) };
  }
  onClicks(labels.domElement, {
    click: (e) => { const p = pickStar(e); if (p) onPickStar?.(p); },
    dblclick: (e) => { const p = pickStar(e); onDrill?.(p); },
  });

  // ---- camera presets --------------------------------------------------------------------------
  const target = new THREE.Vector3(), want = { pos: null };
  function frameOn(centre, dist, tilt = 0.55) {
    target.set(...centre);
    want.pos = new THREE.Vector3(centre[0] - dist * 0.25, centre[1] + dist * Math.cos(tilt), centre[2] + dist * Math.sin(tilt));
  }
  frameOn([0, 0, 0], 150);
  camera.position.copy(want.pos);
  placeSatellites(0);
  applyBand();
  onBand(applyBand);

  let running = false;
  function resize() {
    const { clientWidth: w, clientHeight: h } = container;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    labels.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(container);

  const tmp = new THREE.Vector3();
  function frame() {
    if (!running) return;
    requestAnimationFrame(frame);
    if (want.pos) {
      controls.target.lerp(target, 0.08);
      camera.position.lerp(want.pos, 0.08);
      if (camera.position.distanceTo(want.pos) < 0.01 * want.pos.distanceTo(target) + 1e-4) want.pos = null;
    }
    controls.update();
    fleetGroup.visible = !!settings.get('starfleet');
    const show = settings.get('labels');
    for (const t of tags) if (t.o.parent !== fleetGroup && t.o.parent !== quadGroup) t.o.visible = !!(show || t.always);
    for (const s of satellites) if (s.body.userData.quad) s.body.userData.quad.quaternion.copy(camera.quaternion);
    renderer.render(scene, camera);
    labels.render(scene, camera);
    const solNow = new THREE.Vector3(...sol).applyAxisAngle(Y, -OMEGA_SUN * epoch);
    tmp.copy(solNow).project(camera);
    const behind = solNow.clone().applyMatrix4(camera.matrixWorldInverse).z > 0;
    onFrame?.({ beacon: { x: tmp.x, y: tmp.y, behind, atFocus: false, visible: !behind && Math.abs(tmp.x) <= 1 && Math.abs(tmp.y) <= 1 } });
  }

  /** Re-colour the stars for the current spectrum band (#28). */
  function recolourBand() {
    for (const p of Object.values(layers)) {
      if (!p?.userData.band) continue;
      const { rows, colourOf } = p.userData.band, c = p.geometry.attributes.color;
      rows.forEach(([, , , m10, c100], i) => {
        const t = teffFromBV(colourOf(c100)), rgb = bandStarColour(t, blackbodyRGB(t)), k = Math.min(1, Math.max(0.35, 0.9 - m10 / 40));
        c.setXYZ(i, rgb[0] * k, rgb[1] * k, rgb[2] * k);
      });
      c.needsUpdate = true;
    }
  }
  return {
    recolourBand,
    show() { container.hidden = false; resize(); if (!running) { running = true; requestAnimationFrame(frame); } },
    hide() { container.hidden = true; running = false; },
    setStars, setGaia, setTime, applyLook,
    get modelComponents() { return model.components; },
    /** The spectrum filter (#28): { model: { value, detail, dark }, clouds: { lmc|smc: { value, tier, detail } } }. */
    get bandInfo() { return bandInfo; },
    get epoch() { return epoch; },
    get gaiaCount() { return gaiaCount; },
    view(which) {
      follow = which === 'sol';
      if (which === 'galaxy') frameOn([0, 0, 0], 150);
      else if (which === 'sol') frameOn(new THREE.Vector3(...sol).applyAxisAngle(Y, -OMEGA_SUN * epoch).toArray(), 5.5, 0.7);
      else if (which === 'gaia') { follow = true; frameOn(new THREE.Vector3(...sol).applyAxisAngle(Y, -OMEGA_SUN * epoch).toArray(), 22, 0.75); }
      else if (which === 'centre') frameOn([0, 0, 0], 18, 0.6);
      else if (which === 'satellites') frameOn([0, -55, 75], 360, 0.6);
    },
  };
}
