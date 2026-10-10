// System View — the star system around the ship: Sol (Sector 001) with real planet
// positions, or any other star with its known planets (see src/data/systems.js).
//
// Scale strategy: the scene is in AU with a floating origin — the focused body sits
// at (0,0,0) and the whole system is offset around it — plus a logarithmic depth
// buffer, so true-scale Earth (4e-5 AU) and Neptune's orbit (30 AU) coexist.

import * as THREE from 'three';
import { shapeFor } from '../../data/shapes.js';
import { createFatLines } from './fatlines.js';
import { deltaT, shadowOutlines, fixedToInertial, inertialPoint } from '../../astro/eclipses.js';
import { solarEclipseAt } from '../../data/skyevents.js';
import { eclipseDaylight } from '../../panels/skyevents.js';
import { surfacePoint } from '../../astro/eclipses.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { loadBodyShape, loadCraftModel, disposeModel } from './models.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { heliocentric, orbitPath, positionAt, ellipse } from '../../astro/kepler.js';
import { relativeSky, hierarchy, place, besselianYear } from '../../astro/binary.js';
import { eqToEcl, frameToScene, teffFromBV, blackbodyRGB } from '../../astro/frames.js';
import { AU_KM, SUN } from '../../data/sol.js';
import { visualImageUrl } from '../../data/catalog.js';

const SUN_POLE = SUN.pole;
const loader = new THREE.TextureLoader();
import { createHorizonsEphemeris } from '../../data/horizons.js';
import { settings } from '../../settings.js';
import { planetTexture, glowTexture, ringTexture } from './textures.js';
import { pickPoint } from '../pick.js';
import { dirToLatLon, latLonToDir, horizonFrame, lookAt as surfaceLook, altAz, DAY_SKY, daylight } from './surface.js';
import { planetMaterial, cloudMaterial, starMaterial, applySkin, loadTexture, applyLiveSkin, loadLive } from './materials.js';
import { BANDS, bandById, passById, bodyBandSource } from '../../data/bands.js';
import { starBandDelta, paletteIndex } from './bandskin.js';
import { bandTexture, hipsUrl, applyBandToMaterial } from './bandtextures.js';
import { bodyAxes, meridianDirection } from '../../astro/rotation.js';
import { earthAxes, moonAxes, earthPole, ECLIPTIC_POLE } from '../../astro/orientation.js';
import { createComet, cometMagnitude } from './comet.js';
import { createSolarField } from './solarfield.js';
import { ELEMENTS } from '../../astro/kepler.js';
import { MASS_RATIO } from '../../data/poi.js';
import { createBelts } from './belts.js';
import { createSatelliteLayer } from './satellites.js';
import { stateAt, precessionToJ2000, temeToEcliptic } from '../../astro/sgp4.js';
import { heliocentricAt, localAt, localDaySamples, trajectory, ephemerisEnd } from '../../data/spacecraft-ephem.js';

const NAIF = { earth: 399, moon: 301, mars: 499, jupiter: 599, saturn: 699 };
const isoDate = (jd) => new Date((jd - 2440587.5) * 86400000).toISOString().slice(0, 10);
import { geoRing, vanAllen, hillSphere, heliosphere, oortCloud, DIPOLE_POLE } from './zones.js';
import { moonOffsetKm } from '../../astro/moons.js';
import { smallBodyPosition, smallBodyOrbit } from '../../astro/smallbodies.js';

const DEG = Math.PI / 180;
const ORBIT_COLORS = { mercury: 0x9999ff, venus: 0xffcc99, earth: 0x99ccff, mars: 0xcc6666,
  jupiter: 0xff9966, saturn: 0xffcc66, uranus: 0x99cccc, neptune: 0x9999ff, pluto: 0xcc99cc };
const EXO_ORBIT_COLORS = [0x9999ff, 0xffcc99, 0x99ccff, 0xcc6666, 0xff9966, 0xffcc66, 0x99cccc, 0xcc99cc];

// J2000 ecliptic [x, y, z] → three.js (ecliptic plane = XZ, ecliptic north = +Y).
const toScene = ([x, y, z], v = new THREE.Vector3()) => v.set(x, z, -y);

function poleVector([raDeg, decDeg]) {
  const a = raDeg * DEG, d = decDeg * DEG;
  return new THREE.Vector3(...frameToScene(eqToEcl([Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)]))).normalize();
}

/** Display radius in AU. Enhanced mode enlarges bodies (relative to the system's scale) so they are visible. */
const trueRadius = (b) => b.radiusKm / AU_KM;
const enhancedRadius = (b, scale) => Math.max(trueRadius(b),
  (b.starLike || b.kind === 'star'
    ? (scale < 1 ? 0.045 : 0.07) * Math.pow(b.radiusKm / 695700, 0.4) * (b.sizeBoost ?? 1) // keeps a white dwarf visibly smaller than its companion
    : 0.022 * Math.pow(b.radiusKm / 6371, 0.42)) * scale);
export const enhancement = (b, scale = 1) => enhancedRadius(b, scale) / trueRadius(b);

/**
 * Distances around a planet (moons, satellites, belts) in ENHANCED mode: the planet is drawn
 * hundreds of times too big, so x = r / R is compressed logarithmically outside the surface
 * (keeps every moon outside its planet and in order). TRUE mode is exact.
 */
export const compressRadii = (x) => (x <= 1 ? x : 1 + 1.6 * Math.log(x));

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function createSystemView(container, { clock, onSelect, onFrame, onPickStar, onDrillStar }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
  const fat = createFatLines(); // thick orbit lines (#27)
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  const labels = new CSS2DRenderer();
  labels.domElement.className = 'labels-layer';
  container.appendChild(labels.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 1e-7, 1e6);
  camera.position.set(0, 1.6, 3.2);
  const controls = new OrbitControls(camera, labels.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.zoomSpeed = 1.4;

  // Everything orbiting lives in `root`, which is shifted so the focus is at origin.
  const root = new THREE.Group();
  scene.add(root);
  scene.add(new THREE.AmbientLight(0xffffff, 0.06)); // rendering aid: keep night sides faintly visible
  const starLight = new THREE.PointLight(0xfff4e0, 2.4, 0, 0);
  root.add(starLight);
  // Studio environment assigned only to craft materials, never to the scene or planets.
  let craftEnvironment = null;
  function inspectCraft(object) {
    if (!craftEnvironment) {
      const room = new RoomEnvironment(), generator = new THREE.PMREMGenerator(renderer);
      craftEnvironment = generator.fromScene(room, 0.04).texture;
      craftEnvironment.userData.shared = true;
      room.dispose(); generator.dispose();
    }
    object.traverse(o => {
      for (const material of (Array.isArray(o.material) ? o.material : [o.material])) {
        if (!material?.isMeshStandardMaterial) continue;
        material.envMap = craftEnvironment;
        material.envMapIntensity = 0.8;
        material.needsUpdate = true;
      }
    });
  }

  // ---- sky: real stars as seen from this system (falls back to a decorative field) ----
  let bandReady = false; // the spectrum filter (below) is set up after the sky
  const SKY_R = 2e5;
  const skyMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uPixel: { value: renderer.getPixelRatio() }, uFade: { value: 1 } },
    vertexShader: `attribute float size; attribute vec3 color; varying vec3 vColor; uniform float uPixel;
      void main() { vColor = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
        gl_PointSize = size * uPixel; }`,
    fragmentShader: `varying vec3 vColor; uniform float uFade; void main() { float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d) * uFade; if (a < 0.01) discard; gl_FragColor = vec4(vColor, a); }`,
  });
  const sky = new THREE.Points(new THREE.BufferGeometry(), skyMat);
  sky.renderOrder = -1;
  sky.frustumCulled = false;
  scene.add(sky);
  let skySource = 'decorative';

  let skyRows = []; // clickable catalogue sky stars (#23)
  let skyBase = null; // { dirs, mags, cols, teff } as loaded, for re-colouring by band (#28)
  function setSkyPoints(dirs, mags, colors) {
    const n = mags.length, pos = new Float32Array(n * 3), size = new Float32Array(n), col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos.set([dirs[i * 3] * SKY_R, dirs[i * 3 + 1] * SKY_R, dirs[i * 3 + 2] * SKY_R], i * 3);
      size[i] = Math.max(1.2, 6.2 - 0.85 * mags[i]);
      const dim = Math.min(1, Math.max(0.35, 1.25 - mags[i] * 0.13));
      col.set([colors[i * 3] * dim, colors[i * 3 + 1] * dim, colors[i * 3 + 2] * dim], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('size', new THREE.BufferAttribute(size, 1));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    sky.geometry.dispose();
    sky.geometry = g;
  }

  function decorativeSky() {
    const n = 3000, dirs = new Float32Array(n * 3), mags = new Float32Array(n), cols = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = Math.random() * 2 - 1, t = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      dirs.set([s * Math.cos(t), u, s * Math.sin(t)], i * 3);
      mags[i] = 3 + Math.random() * 3.5;
      cols.set([0.6, 0.62, 0.78], i * 3);
    }
    skyBase = { dirs, mags, cols, teff: new Float32Array(n).fill(6000) };
    setSkyPoints(dirs, mags, cols);
    if (bandReady) applySkyBand();
    skySource = 'decorative';
    skyRows = [];
  }
  decorativeSky();

  /** rows: [dx, dy, dz (equatorial unit), mag, ci, name, id] as seen from this system. */
  function setSky(rows) {
    skyRows = rows.map(([x, y, z, m, ci, name, id]) => ({ kind: 'sky', eq: [x, y, z], mag: m, name: name ?? null, id: id ?? null }));
    const n = rows.length, dirs = new Float32Array(n * 3), mags = new Float32Array(n), cols = new Float32Array(n * 3);
    const teff = new Float32Array(n);
    rows.forEach(([x, y, z, m, ci], i) => {
      dirs.set(frameToScene(eqToEcl([x, y, z])), i * 3);
      mags[i] = m;
      teff[i] = teffFromBV(ci ?? 0.6);
      cols.set(blackbodyRGB(teff[i]), i * 3);
    });
    skyBase = { dirs, mags, cols, teff };
    setSkyPoints(dirs, mags, cols);
    if (bandReady) applySkyBand();
    skySource = 'catalogue';
  }

  // ---- the spectrum filter (#28) ----------------------------------------------------------------
  // The sky becomes an all-sky survey in the band (CDS HiPS, MEASURED) or, without one, the
  // catalogue stars re-weighted by their blackbody in the band (COMPUTED); bodies take their band
  // look from bandskin.js (real map, predicted skin, modelled glow, or not observed).
  let band = BANDS[0], pass = null;
  const PAL_RGB = [[1, 1, 1], [1, 0.55, 0.15], [0.3, 0.85, 1], [1, 0.45, 0.2], [1, 1, 1], [0.7, 0.55, 1], [0.4, 0.9, 1], [1, 0.4, 0.9]];
  const skyBandMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, transparent: true,
    uniforms: { uMap: { value: null }, uOpacity: { value: 0 }, uFade: { value: 1 } },
    vertexShader: `varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    // scene (x, y, z) = ecliptic (x, z, −y) → equatorial → RA/Dec; the survey is equirectangular in
    // RA/Dec with RA 0 at the centre, increasing to the left
    fragmentShader: `varying vec3 vDir; uniform sampler2D uMap; uniform float uOpacity; uniform float uFade;
      void main() { vec3 e = vec3(vDir.x, -vDir.z, vDir.y); float ob = 0.40909280;
        vec3 q = vec3(e.x, e.y * cos(ob) - e.z * sin(ob), e.y * sin(ob) + e.z * cos(ob));
        float ra = atan(q.y, q.x), dec = asin(clamp(q.z, -1.0, 1.0));
        vec2 uv = vec2(fract(0.5 - ra / 6.2831853), 0.5 + dec / 3.1415927);
        vec4 t = texture2D(uMap, uv);
        gl_FragColor = vec4(t.rgb, t.a * uOpacity * uFade); // transparent where the survey has no data
        #include <colorspace_fragment>
      }`,
  });
  const skyBand = new THREE.Mesh(new THREE.SphereGeometry(SKY_R * 0.95, 96, 48), skyBandMat);
  skyBand.renderOrder = -2; skyBand.frustumCulled = false; skyBand.visible = false;
  scene.add(skyBand);
  const STANDALONE_BANDS = import.meta.env?.MODE === 'standalone';
  const skyPass = () => (pass?.sky ? pass : band.passes.find((p) => p.sky) ?? null);

  function applySkyBand() {
    const full = band.id === 'full';
    const sp = full ? null : skyPass();
    skyBand.visible = !!sp && !STANDALONE_BANDS;
    if (sp && !STANDALONE_BANDS) {
      const url = hipsUrl(sp.sky);
      skyBandMat.uniforms.uOpacity.value = 0;
      bandTexture(url).then((r) => { if (r && skyPass()?.sky === sp.sky) { skyBandMat.uniforms.uMap.value = r.texture; skyBandMat.uniforms.uOpacity.value = 1; } });
    }
    if (!skyBase) return;
    // catalogue stars: shown over a survey only where the survey shows starlight (IR, visible, UV);
    // re-weighted by their blackbody in the band
    const n = skyBase.mags.length, mags = new Float32Array(n), cols = new Float32Array(n * 3);
    const p = pass ?? band.passes[0], tint = PAL_RGB[paletteIndex(band.palette)];
    for (let i = 0; i < n; i++) {
      const d = full || band.id === 'visible' && p?.id === 'vis-V' ? 0 : starBandDelta(skyBase.teff[i], p);
      mags[i] = d === -Infinity || sp ? 99 : skyBase.mags[i] - d;
      const c = full || band.id === 'visible' ? [skyBase.cols[i * 3], skyBase.cols[i * 3 + 1], skyBase.cols[i * 3 + 2]] : tint;
      cols.set(c, i * 3);
    }
    setSkyPoints(skyBase.dirs, mags, cols);
    sky.visible = !sp;
  }

  /** Set every body's band look and load what it needs. */
  function applyBand() {
    const full = band.id === 'full', p = pass ?? band.passes[0] ?? null;
    for (const id in nodes) {
      const n = nodes[id], u = n.mesh?.material?.uniforms;
      if (n.clouds) n.clouds.visible = full || band.id === 'visible';
      if (n.ring) n.ring.visible = full || band.id === 'visible' || band.id === 'ir';
      if (isStar(n.body)) { applyStarBand(n, p); continue; }
      if (!u?.uBandMode) continue;
      n.bandLook = applyBandToMaterial(u, n.body, band, p);
      if (n.clouds?.material?.uniforms?.uBandMode) n.clouds.material.uniforms.uBandMode.value = 0;
    }
    applySkyBand();
  }
  function applyStarBand(n, p) {
    const u = n.mesh?.material?.uniforms;
    if (!u?.uBandTint) return;
    // the additive glare follows the disc's brightness in the band
    const glare = n.mesh.children?.find((c) => c.isSprite);
    const setGlare = () => { if (glare) { const t = u.uBandTint.value; glare.material.opacity = 0.85 * Math.min(1, Math.max(t.r, t.g, t.b)); glare.material.color.set(band.id === 'full' ? n.body.color ?? 0xffffff : 0xffffff).multiply(band.id === 'full' ? new THREE.Color(1, 1, 1) : t.clone().multiplyScalar(1 / Math.max(1e-3, Math.max(t.r, t.g, t.b)))); } };
    queueMicrotask(setGlare);
    u.uBandDisk.value = 0;
    if (band.id === 'full') { u.uBandTint.value.setRGB(1, 1, 1); n.bandLook = null; restoreStarDisk(n); return; }
    const src = model.isSol && n.body.id === model.starId ? bodyBandSource('sun', band, p) : null;
    if (src?.feed && !STANDALONE_BANDS) {
      n.bandLook = { mode: 'real', tier: 'measured', label: src.note ?? 'REAL IMAGE IN THIS BAND', detail: src.credit };
      loadLive(src.feed).then((l) => { if (!l || n.bandLook?.detail !== src.credit) return; u.uDisk.value = l.texture; u.uHasDisk.value = 1; u.uBandDisk.value = 1; if (l.disk) u.uDiskR.value = l.disk; });
      u.uBandTint.value.setRGB(1, 1, 1);
      return;
    }
    const teff = n.body.teffK ?? 5772, d = starBandDelta(teff, p), tint = PAL_RGB[paletteIndex(band.palette)];
    if (d === -Infinity) { u.uBandTint.value.setRGB(0.02, 0.02, 0.02); n.bandLook = { mode: 'dark', tier: 'computed', label: 'NOT OBSERVED IN THIS BAND', detail: `A ${Math.round(teff)} K photosphere emits almost nothing in ${p?.label ?? band.label}; no image or measured flux of this star is available here.` }; return; }
    const k = Math.max(0.05, Math.min(3, 10 ** (0.4 * Math.max(-6, Math.min(6, d)) * 0.35)));
    u.uBandTint.value.setRGB(tint[0] * k, tint[1] * k, tint[2] * k);
    n.bandLook = { mode: 'computed', tier: 'computed', label: `${d >= 0 ? 'BRIGHTER' : 'FAINTER'} BY ${Math.abs(d).toFixed(1)} MAG THAN IN V`, detail: `A ${Math.round(teff)} K blackbody through ${p?.label}, relative to the V band in the Vega system (COMPUTED). Display brightness compressed.` };
  }
  bandReady = true;
  function restoreStarDisk(n) {
    const u = n.mesh?.material?.uniforms;
    if (!u) return;
    const lt = liveTargets.find((t) => t.id === n.body.id);
    if (lt) applyLiveSkin(lt.material, lt.skin, settings.get('liveSkins'));
    else u.uHasDisk.value = 0;
  }

  // ---- bodies -------------------------------------------------------------------------
  let model = null;
  let nodes = {}; // id → { body, group, tilt, mesh, label, orbit, pos }
  let pickables = [];
  let lit = []; // planet materials that need the star's position each frame
  // Live skins: re-applied when the setting changes and refreshed every 15 minutes.
  let liveTargets = [];
  const liveState = {}; // body id → { time, credit } while a live skin is showing
  function refreshLive() {
    for (const t of liveTargets) {
      applyLiveSkin(t.material, t.skin, settings.get('liveSkins')).then((l) => {
        if (l && settings.get('liveSkins')) liveState[t.id] = { time: l.time, credit: l.credit, feed: t.skin.live };
        else delete liveState[t.id];
      });
    }
  }
  settings.onChange((k) => { if (k === 'liveSkins') refreshLive(); });
  setInterval(refreshLive, 15 * 60000);

  function makeLabel(body) {
    const el = document.createElement('button');
    el.className = `body-label kind-${body.kind.replace(' ', '-')}`;
    el.textContent = body.name.toUpperCase();
    el.addEventListener('pointerdown', (e) => e.stopPropagation());
    el.addEventListener('click', (e) => { e.stopPropagation(); onSelect(body.id); });
    const obj = new CSS2DObject(el);
    obj.center.set(-0.15, 1.2);
    return obj;
  }

  function orbitColor(body, i) {
    return ORBIT_COLORS[body.id] ?? EXO_ORBIT_COLORS[i % EXO_ORBIT_COLORS.length];
  }

  function addBody(body, i) {
    const group = new THREE.Group();
    const tilt = new THREE.Group();
    const pole = body.pole ? poleVector(body.pole) : new THREE.Vector3(...model.planeNormal);
    tilt.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), pole);
    group.add(tilt);
    let mesh, clouds = null, ringMesh = null;
    if (body.marker) return addMarker(body);
    if (body.kind === 'satellite' || body.kind === 'spacecraft') return addSatelliteNode(body);
    const placeholder = planetTexture(isStar(body) ? { id: body.id, banded: body.banded, palette: ['#d9a35a', '#f2c879', '#b97a3a'] } : body);
    if (isStar(body)) {
      mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), starMaterial(placeholder, body.color, body.skin?.recolour));
      loadTexture(body.skin?.map).then((t) => { if (t) mesh.material.uniforms.uMap.value = t; });
      if (body.skin?.live) liveTargets.push({ id: body.id, material: mesh.material, skin: body.skin });
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: body.color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.85 }));
      glow.scale.setScalar(6);
      mesh.add(glow);
    } else {
      const mat = planetMaterial(placeholder, { tint: body.skin?.tint });
      mat.userData.host = body.orbit?.host ?? model.starId;
      mat.userData.body = body.id;
      applySkin(mat, body.skin);
      if (body.skin?.live) liveTargets.push({ id: body.id, material: mat, skin: body.skin });
      mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 48), mat);
      lit.push(mat);
      if (body.skin?.clouds) {
        const cm = cloudMaterial(placeholder);
        cm.userData.host = mat.userData.host;
        cm.userData.body = body.id;
        clouds = new THREE.Mesh(new THREE.SphereGeometry(1.012, 96, 48), cm);
        cm.uniforms.uMap.value = new THREE.Texture(); // invisible until the cloud map arrives
        loadTexture(body.skin.clouds).then((t) => { if (t) cm.uniforms.uMap.value = t; });
        lit.push(cm);
        tilt.add(clouds);
      }
      if (body.rings) {
        const inner = body.rings.innerKm / body.radiusKm, outer = body.rings.outerKm / body.radiusKm;
        const geo = new THREE.RingGeometry(inner, outer, 160, 1);
        const p = geo.attributes.position, uv = geo.attributes.uv;
        for (let k = 0; k < p.count; k++) uv.setXY(k, (Math.hypot(p.getX(k), p.getY(k)) - inner) / (outer - inner), 0.5);
        const ringMat = new THREE.MeshBasicMaterial({ map: ringTexture(), side: THREE.DoubleSide, transparent: true, depthWrite: false });
        loadTexture(body.skin?.ring).then((t) => { if (t) { ringMat.map = t; ringMat.needsUpdate = true; } });
        const ring = new THREE.Mesh(geo, ringMat);
        ring.rotation.x = -Math.PI / 2;
        tilt.add(ring); // scaled with the planet via `tilt.scale`
        ringMesh = ring;
      }
    }
    mesh.userData.id = body.id;
    tilt.add(mesh);
    // spin axis through the poles (AXES toggle): north half warm, south half cool
    const axisGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 1.75, 0, 0, 0, 0, 0, -1.75, 0], 3))
      .setAttribute('color', new THREE.Float32BufferAttribute([1, 0.7, 0.3, 1, 0.7, 0.3, 0.4, 0.7, 1, 0.4, 0.7, 1], 3));
    const axis = new THREE.LineSegments(axisGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85 }));
    axis.visible = false;
    tilt.add(axis);
    let comet = null;
    if (body.comet) { comet = createComet(renderer.getPixelRatio()); group.add(comet.group); }
    // A fixed-size pip keeps true-scale worlds findable when they are sub-pixel.
    const pipGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
    const minor = body.kind === 'moon' || body.orbit?.type === 'elements';
    group.add(new THREE.Points(pipGeo, new THREE.PointsMaterial({
      size: isStar(body) ? 6 : minor ? 3 : 4, sizeAttenuation: false, color: body.color ?? (minor ? 0xbbbbbb : orbitColor(body, i)) })));
    pickables.push(mesh);
    const label = makeLabel(body);
    group.add(label);
    root.add(group);
    const color = body.kind === 'moon' ? 0x8899aa : body.orbit?.type === 'elements' ? (body.kind === 'comet' ? 0x66ccff : 0xaa9977) : orbitColor(body, i);
    nodes[body.id] = { body, group, tilt, mesh, clouds, ring: ringMesh, label, pos: new THREE.Vector3(), orbit: null, orbitJd: null, color, axis, comet };
  }

  // Regions and Lagrange points: a label (and a pip for points), no globe.
  function addMarker(body) {
    const group = new THREE.Group(), tilt = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(1), new THREE.MeshBasicMaterial({ color: 0xffcc66, wireframe: true, visible: false }));
    mesh.userData.id = body.id;
    tilt.add(mesh); group.add(tilt);
    if (body.kind === 'lagrange point') {
      const pipGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
      group.add(new THREE.Points(pipGeo, new THREE.PointsMaterial({ size: 6, sizeAttenuation: false, color: 0xffcc66 })));
    }
    const label = makeLabel(body);
    label.element.classList.add('poi');
    group.add(label);
    root.add(group);
    nodes[body.id] = { body, group, tilt, mesh, clouds: null, label, pos: new THREE.Vector3(), orbit: null, orbitJd: null, color: 0xffcc66 };
  }

  // A spacecraft: a representative model (bus, solar wings, antenna) inside a unit sphere.
  function addSatelliteNode(body) {
    const group = new THREE.Group(), tilt = new THREE.Group();
    const model3d = new THREE.Group();
    const foil = new THREE.MeshStandardMaterial({ color: 0xd4a94f, metalness: 0.6, roughness: 0.35 });
    const cells = new THREE.MeshStandardMaterial({ color: 0x1d2f6b, metalness: 0.3, roughness: 0.4, side: THREE.DoubleSide });
    const white = new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.2, roughness: 0.6 });
    model3d.add(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.3, 0.3), foil));
    for (const s of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.01, 0.26), cells);
      wing.position.set(s * 0.5, 0, 0);
      model3d.add(wing);
    }
    const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.02, 0.06, 24), white);
    dish.position.set(0, -0.2, 0);
    model3d.add(dish);
    inspectCraft(model3d);
    const mesh = model3d;
    mesh.userData.id = body.id;
    tilt.add(mesh); group.add(tilt);
    const pipGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
    group.add(new THREE.Points(pipGeo, new THREE.PointsMaterial({ size: 5, sizeAttenuation: false, color: 0xffd966 })));
    const label = makeLabel(body);
    group.add(label);
    root.add(group);
    for (const m of model3d.children) { m.userData.id = body.id; pickables.push(m); }
    nodes[body.id] = { body, group, tilt, mesh, clouds: null, label, pos: new THREE.Vector3(), orbit: null, orbitJd: null, color: 0xffd966 };
  }

  // Load only the focused craft. A system switch invalidates pending results.
  async function upgradeCraft(node) {
    if (!node || !['spacecraft', 'satellite'].includes(node.body.kind) || node.modelRequested) return;
    node.modelRequested = true;
    try {
      const detailed = await loadCraftModel(node.body.id);
      if (!detailed) return;
      if (nodes[node.body.id] !== node) { disposeModel(detailed); return; }
      inspectCraft(detailed);
      const old = node.mesh;
      const oldMeshes = new Set();
      old.traverse((o) => { if (o.isMesh) oldMeshes.add(o); });
      pickables = pickables.filter((o) => !oldMeshes.has(o));
      node.tilt.remove(old);
      disposeModel(old);
      detailed.traverse((o) => {
        if (o.isMesh) { o.userData.id = node.body.id; pickables.push(o); }
      });
      node.mesh = detailed;
      node.tilt.add(detailed);
    } catch (err) {
      node.modelRequested = false;
      console.warn(`Spacecraft model unavailable: ${node.body.id}`, err);
    }
  }

  async function upgradeShape(node) {
    if (!node || !shapeFor(node.body.id) || node.shapeRequested) return;
    node.shapeRequested = true;
    try {
      const detailed = await loadBodyShape(node.body.id, node.body.radiusKm);
      if (!detailed) return;
      if (nodes[node.body.id] !== node) { disposeModel(detailed); return; }
      const old = node.mesh, material = old.material;
      detailed.traverse((o) => {
        if (!o.isMesh) return;
        for (const m of (Array.isArray(o.material) ? o.material : [o.material])) m?.dispose();
        o.material = material;
        o.userData.id = node.body.id;
        pickables.push(o);
      });
      pickables = pickables.filter((o) => o !== old);
      node.tilt.remove(old);
      old.geometry.dispose();
      node.mesh = detailed;
      node.tilt.add(detailed);
    } catch (err) {
      node.shapeRequested = false;
      console.warn(`Body shape unavailable: ${node.body.id}`, err);
    }
  }

  /** True geocentric offset (scene axes, AU) of a satellite from SGP4; cached per jd. */
  function satOffset(b, jd) {
    if (b._jd === jd && b._off) return b._off;
    const st = stateAt(b.satrec, jd);
    b._jd = jd;
    b._off = st ? toScene(temeToEcliptic(st.position, precessionToJ2000(jd))).multiplyScalar(1 / AU_KM) : null;
    return b._off;
  }

  // ---- zones & belts (Sol only) -----------------------------------------------------------
  let zones = null, belts = null, sats = null;
  function buildZones() {
    const helio = heliosphere((v) => frameToScene(v), eqToEcl);
    zones = {
      geo: geoRing(), va: vanAllen(), helio, oort: oortCloud(),
      hill: model.bodies.filter((b) => ELEMENTS[b.id] && b.massKg).map((b) => {
        const [[a, e]] = ELEMENTS[b.id];
        const rH = a * (1 - e) * Math.cbrt(b.massKg / (3 * 1.9885e30)) * AU_KM;
        return { id: b.id, shape: hillSphere(rH / b.radiusKm, ORBIT_COLORS[b.id] ?? 0x9999ff) };
      }),
    };
    root.add(zones.geo.object, ...zones.va.map((z) => z.object), helio.group, zones.oort, ...zones.hill.map((h) => h.shape.object));
  }
  // the Sun's field (FIELDS toggle) and Earth's precession circle on the sky (AXES toggle)
  let solarField = null, precession = null;
  function buildSolarExtras() {
    const f = createSolarField();
    const outer = new THREE.Group();
    outer.add(f.group);
    outer.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), poleVector(nodes[model.starId].body.pole));
    solarField = { ...f, outer };
    root.add(outer);
    // the north celestial pole traces a circle about the ecliptic pole every ~25,772 years
    const k = new THREE.Vector3(...frameToScene(eqToEcl(ECLIPTIC_POLE)));
    const pts = [];
    for (let i = 0; i <= 256; i++) {
      const jd = 2451545 + (i / 256) * 25772 * 365.25;
      pts.push(new THREE.Vector3(...frameToScene(eqToEcl(earthPole(jd, { withNutation: false })))).multiplyScalar(SKY_R * 0.98));
    }
    const circle = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xffaa55, transparent: true, opacity: 0.5, depthWrite: false }));
    circle.frustumCulled = false;
    const now = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3)),
      new THREE.PointsMaterial({ color: 0xffaa55, size: 7, sizeAttenuation: false, depthWrite: false }));
    now.frustumCulled = false;
    const el = document.createElement('div');
    el.className = 'nav-label motion';
    el.textContent = 'NORTH CELESTIAL POLE · PRECESSION CIRCLE 25,772 YR';
    const tagObj = new CSS2DObject(el);
    precession = { circle, now, tag: tagObj, k };
    scene.add(circle, now, tagObj);
  }
  function disposeSolarExtras() {
    if (solarField) { root.remove(solarField.outer); solarField.outer.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); }); solarField = null; }
    if (precession) { for (const o of [precession.circle, precession.now, precession.tag]) { scene.remove(o); o.geometry?.dispose(); o.material?.dispose(); } precession.tag.element.remove(); precession = null; }
  }
  function updateExtras(jd) {
    const axesOn = !!settings.get('axes') && !surface, fieldsOn = !!settings.get('fields') && !surface;
    for (const id in nodes) if (nodes[id].axis) nodes[id].axis.visible = axesOn && !nodes[id].body.marker;
    if (solarField) {
      solarField.outer.visible = fieldsOn;
      solarField.outer.position.copy(nodes[model.starId].pos);
      solarField.rotate(jd);
    }
    if (precession) {
      const on = axesOn && model.isSol;
      precession.circle.visible = precession.now.visible = precession.tag.visible = on;
      if (on) {
        const p = new THREE.Vector3(...frameToScene(eqToEcl(earthPole(jd)))).multiplyScalar(SKY_R * 0.98);
        precession.now.geometry.attributes.position.setXYZ(0, p.x, p.y, p.z);
        precession.now.geometry.attributes.position.needsUpdate = true;
        precession.tag.position.copy(p);
      }
    }
    // comets: coma and tails from the Sun's direction and the comet's motion
    const sun = nodes[model.starId];
    for (const id in nodes) {
      const n = nodes[id];
      if (!n.comet) continue;
      const anti = tmp6.copy(n.pos).sub(sun.pos);
      const rAU = truePosition(id).distanceTo(truePosition(model.starId));
      const trail = scenePosition(id, jd - 2, tmp7).sub(n.pos);
      n.cometState = n.comet.update(anti, trail, rAU, displayRadius(n.body), 1);
      n.cometState.rAU = rAU;
    }
  }
  function disposeZones() {
    disposeSolarExtras();
    if (!zones) return;
    const objs = [zones.geo.object, ...zones.va.map((z) => z.object), zones.helio.group, zones.oort, ...zones.hill.map((h) => h.shape.object)];
    for (const o of objs) { root.remove(o); o.traverse((x) => { x.geometry?.dispose(); x.material?.dispose(); }); }
    zones = null;
  }
  const scalarMap = (parent) => (x) => localMap(parent, tmpS.set(x * trueRadius(parent), 0, 0)).x;
  const tmpS = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  function updateZones(jd) {
    const on = settings.get('zones');
    const key = `${scaleMix.toFixed(4)}|${model.scale}`;
    const earth = nodes.earth;
    // the heliosphere and Oort cloud only read from outside: hide them while the camera is deep inside
    const fromSun = camera.position.length() > 1e-9 ? tmpS.copy(camera.position).add(focusPos).length() : 0;
    zones.geo.object.visible = on;
    zones.helio.group.visible = on && fromSun > 60;
    zones.oort.visible = on && fromSun > 600;
    for (const z of zones.va) z.object.visible = on;
    if (!on) { for (const h of zones.hill) h.shape.object.visible = false; return; }
    const pole = poleVector(earth.body.pole);
    zones.geo.remap(scalarMap(earth.body), key);
    zones.geo.object.position.copy(earth.pos);
    zones.geo.object.quaternion.setFromUnitVectors(UP, pole);
    // magnetic dipole axis turns with the Earth
    const m = meridianDirection(earth.body.pole, 'gmst', jd, DIPOLE_POLE.lon);
    const pe = [0, 0, 1], cl = Math.cos(DIPOLE_POLE.lat * DEG), sl = Math.sin(DIPOLE_POLE.lat * DEG);
    const axis = new THREE.Vector3(...frameToScene(eqToEcl(m.map((v, k) => v * cl + pe[k] * sl)))).normalize();
    for (const z of zones.va) {
      z.remap(scalarMap(earth.body), key);
      z.object.position.copy(earth.pos);
      z.object.quaternion.setFromUnitVectors(UP, axis);
    }
    for (const h of zones.hill) {
      const n = nodes[h.id];
      h.shape.remap(scalarMap(n.body), key);
      h.shape.object.position.copy(n.pos);
      h.shape.object.visible = true;
    }
  }

  function clear() {
    for (const id in nodes) {
      const n = nodes[id];
      root.remove(n.group);
      n.label.element.remove();
      // Geometries and materials are per-body; textures are shared through the loader cache.
      disposeModel(n.mesh);
      n.group.traverse((o) => { if (o === n.mesh || n.mesh.getObjectById(o.id)) return; o.geometry?.dispose(); o.material?.dispose(); });
      if (n.orbit) { root.remove(n.orbit); n.orbit.geometry.dispose(); n.orbit.material.dispose(); }
      if (n.endMark) { root.remove(n.endMark); n.endMark.element.remove(); }
    }
    nodes = {};
    fat.prune(new Set());
    disposeZones();
    if (belts) { root.remove(belts.points); belts.points.geometry.dispose(); belts.points.material.dispose(); belts = null; }
    if (sats) { root.remove(sats.points); sats.dispose(); sats = null; }
    pickables = [];
    lit = [];
    liveTargets = [];
    for (const k of Object.keys(liveState)) delete liveState[k];
    for (const tr of tracks) for (const l of [tr.a, tr.b]) { root.remove(l); l.geometry.dispose(); l.material.dispose(); }
    tracks.length = 0;
  }

  /** Show a system model (see src/data/systems.js). */
  function load(m) {
    clear();
    model = m;
    tree = m.binary ? hierarchy(m.binary.orbits, m.binary.mass) : null;
    m.bodies.forEach(addBody);
    if (m.isSol) { buildZones(); buildSolarExtras(); }
    refreshLive();
    if (band.id !== 'full') applyBand();
    for (const o of m.binary?.orbits ?? []) addBinaryTrack(o);
    const star = m.bodies.find((x) => x.id === m.starId);
    starLight.color.setHex(star.color ?? 0xfff4e0);
    const outer = Math.max(...m.survey.map((x) => x.au ?? 0));
    controls.maxDistance = Math.max(outer * 40, ...m.bodies.map((b) => (b.viewAU ?? 0) * 1.5));
    focusId = m.starId;
    focusPos.set(0, 0, 0);
    flight = null;
    overviewAU = m.survey[0].au;
    camera.position.set(0, 0.45, 0.9).setLength(overviewAU);
    framedRadius = null;
    placedJd = null;
  }

  const isStar = (b) => b.starLike || b.kind === 'star';
  function truePosition(id, jd = clock.jd) {
    unmapped = true;
    try { return scenePosition(id, jd, new THREE.Vector3()); } finally { unmapped = false; }
  }
  const elementsOf = (o) => ({ a: o.a, e: o.e, I: 0, node: 0, peri: o.omega });
  const basisToScene = ([x, y, z], { u, v, n }, out = new THREE.Vector3()) =>
    out.set(u[0] * x + v[0] * y + n[0] * z, u[1] * x + v[1] * y + n[1] * z, u[2] * x + v[2] * y + n[2] * z);

  // ---- multiple stars: barycentric positions from the ORB6 orbits -------------------------
  let tree = null;
  let placedJd = null, placed = null;
  const relScene = (o, t) => {
    const [nn, ee, zz] = relativeSky(o, t).map((v) => v * o.distPc); // AU
    return [0, 1, 2].map((k) => o.basis.n[k] * nn + o.basis.e[k] * ee + o.basis.r[k] * zz);
  };
  function starPlacement(jd) {
    if (placedJd !== jd) { placed = place(tree, besselianYear(jd), relScene); placedJd = jd; }
    return placed;
  }

  // Each binary orbit is drawn as the two barycentric ellipses about the pair's centre.
  const tracks = [];
  function addBinaryTrack(o) {
    const P = o.periodYears;
    const pts = [];
    for (let k = 0; k <= 256; k++) pts.push(new THREE.Vector3(...relScene(o, o.periastronYear + (k / 256) * P)));
    const mk = (color) => {
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.5 }));
      root.add(line);
      return line;
    };
    tracks.push({ orbit: o, a: mk(0xffcc66), b: mk(0x9999ff) });
  }

  function updateTracks(jd) {
    if (!tracks.length) return;
    const { centres } = starPlacement(jd);
    for (const tr of tracks) {
      const c = centres.find((x) => x.orbit === tr.orbit);
      if (!c) continue;
      tr.a.position.set(...c.centre); tr.a.scale.setScalar(-c.fa); // primary: opposite side, scaled
      tr.b.position.set(...c.centre); tr.b.scale.setScalar(c.fb);
      tr.a.visible = tr.b.visible = settings.get('orbits');
    }
  }

  // Moon orbits: one period of true parent-relative positions, re-mapped every frame (the
  // ENHANCED compression depends on the scale mix).
  function updateMoonOrbit(node, jd) {
    const b = node.body, P = b.periodDays ?? b.moon.elements.P;
    const rel = (t) => (b.satrec ? (satOffsetAt(b, t) ?? new THREE.Vector3()) : toScene(moonOffsetKm(b.moon, t)).multiplyScalar(1 / AU_KM));
    if (!node.samples || Math.abs(jd - node.orbitJd) > P / 6) {
      node.samples = [];
      for (let k = 0; k <= 160; k++) node.samples.push(rel(jd + (k / 160 - 0.5) * P));
      node.orbitJd = jd;
      if (!node.orbit) {
        const geo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(161 * 3), 3));
        node.orbit = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: node.color, transparent: true, opacity: 0.4 }));
        node.orbit.frustumCulled = false;
        root.add(node.orbit);
      }
    }
    const parent = nodes[b.parent], attr = node.orbit.geometry.attributes.position;
    node.samples.forEach((v, k) => { localMap(parent.body, tmp4.copy(v)); attr.setXYZ(k, tmp4.x, tmp4.y, tmp4.z); });
    attr.needsUpdate = true;
    node.orbit.position.copy(parent.pos);
  }
  const tmp4 = new THREE.Vector3();
  const satOffsetAt = (b, t) => { const st = stateAt(b.satrec, t); return st ? toScene(temeToEcliptic(st.position, precessionToJ2000(t))).multiplyScalar(1 / AU_KM) : null; };

  // Spacecraft trajectories: the day's planet-relative arc (re-mapped each frame) or the
  // heliocentric path from launch (or the recent past) to a year ahead.
  function updateCraftTrack(node, jd) {
    const b = node.body, o = b.orbit;
    let pts = null;
    if (o.center) {
      // rebuilt only when the day's samples or the scale change, not every frame
      const km = localDaySamples(o.hz, NAIF[o.center], jd), cb = nodes[o.center].body;
      const key = km && `${scaleMix}|${enhancedRadius(cb, model.scale)}`;
      if (km && (km !== node.trackKm || key !== node.trackKey)) {
        pts = km.map((p) => localMap(cb, toScene(p).multiplyScalar(1 / AU_KM)));
        node.trackKm = km; node.trackKey = key;
      }
    } else if (!node.trackDone) {
      const au = trajectory(o.hz, b.trackFrom ?? isoDate(jd - 365), isoDate(Math.max(jd, 2440587.5 + Date.now() / 86400000) + 365));
      if (au) {
        pts = au.map((p) => toScene(p)); node.trackDone = true;
        // the published (predicted) ephemeris stops inside the window: mark where (#26)
        const end = ephemerisEnd(o.hz);
        if (end && pts.length) {
          const el = document.createElement('div');
          el.className = 'nav-label ephem-end';
          el.textContent = `◆ ${b.name.toUpperCase()} · EPHEMERIS ENDS ${end}`;
          node.endMark = new CSS2DObject(el);
          node.endMark.position.copy(pts[pts.length - 1]);
          root.add(node.endMark);
        }
      }
    }
    if (pts && pts.length > 1) {
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      if (node.orbit) { node.orbit.geometry.dispose(); node.orbit.geometry = geo; }
      else {
        node.orbit = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffd966, transparent: true, opacity: 0.3 }));
        node.orbit.frustumCulled = false;
        root.add(node.orbit);
      }
    }
    if (node.orbit && o.center) node.orbit.position.copy(nodes[o.center].pos);
    if (!node.orbit) { // placeholder so the frame loop can toggle it
      node.orbit = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xffd966, transparent: true, opacity: 0.5 }));
      root.add(node.orbit);
    }
  }

  function updateOrbit(node, jd) {
    const o = node.body.orbit;
    if (!o) return;
    if (o.type === 'moon' || o.type === 'sgp4') return updateMoonOrbit(node, jd);
    if (o.type === 'horizons') return updateCraftTrack(node, jd);
    if (o.type === 'kepler' && node.orbit) { node.orbit.position.copy(hostScene(o.host, jd)); return; }
    if (node.orbit && Math.abs(jd - node.orbitJd) < 365) return;
    const pts = o.type === 'sol'
      ? orbitPath(node.body.id, jd, 512).map((p) => toScene(p))
      : o.type === 'elements' ? smallBodyOrbit(nearestElements(o, jd), 512).map((p) => toScene(p))
      : ellipse(elementsOf(o), 256).map((p) => basisToScene(p, o.basis));
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    if (node.orbit) { node.orbit.geometry.dispose(); node.orbit.geometry = geo; }
    else {
      node.orbit = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: node.color, transparent: true, opacity: o.type === 'elements' ? 0.32 : 0.45 }));
      root.add(node.orbit);
    }
    node.orbitJd = jd;
    if (o.type === 'kepler') node.orbit.position.copy(hostScene(o.host, jd));
  }

  // ---- ephemeris --------------------------------------------------------------------
  let horizonsStatus = { pending: 0, failed: false };
  let horizons = null; // created lazily for Sol (needs the body table)
  const sourceOf = {}; // per body: 'horizons' | 'kepler'

  /** Scene position (AU) of a star in this system. */
  function hostScene(id, jd, out = new THREE.Vector3()) {
    if (!tree) return out.set(0, 0, 0);
    const p = starPlacement(jd).leaves[id];
    return p ? out.set(...p) : out.set(0, 0, 0);
  }

  /** Scene position (AU) of body `id` at `jd`. */
  function scenePosition(id, jd, v = new THREE.Vector3()) {
    const b = nodes[id]?.body;
    if (!b) return v.set(0, 0, 0);
    if (isStar(b)) return model.isSol ? v.set(0, 0, 0) : hostScene(id, jd, v);
    const o = b.orbit;
    if (o.type === 'anchor') return scenePosition(o.anchor, jd, v);
    if (o.type === 'horizons') {
      if (o.center) {
        const off = localAt(o.hz, NAIF[o.center], jd);
        b._missing = !off;
        if (!off) return scenePosition(o.center, jd, v);
        localMap(nodes[o.center].body, toScene(off, v).multiplyScalar(1 / AU_KM));
        return addParent(v, o.center, jd);
      }
      const p = heliocentricAt(o.hz, jd);
      b._missing = !p;
      return p ? toScene(p, v) : v.set(0, 0, 0);
    }
    if (o.type === 'sgp4') {
      const off = satOffset(b, jd);
      if (!off) return v.copy(scenePosition('earth', jd, v));
      localMap(nodes.earth.body, v.copy(off));
      return addParent(v, 'earth', jd);
    }
    if (o.type === 'lagrange') return lagrangePosition(o, jd, v);
    if (o.type === 'moon') {
      // the moon series run on TT (UT + ΔT ≈ 69 s, which is ~37″ of the Moon's motion)
      toScene(moonOffsetKm(b.moon, jd + deltaT(jd) / 86400), v).multiplyScalar(1 / AU_KM);
      localMap(nodes[o.parent].body, v);
      return addParent(v, o.parent, jd);
    }
    if (o.type === 'elements') { sourceOf[id] = 'kepler'; return toScene(smallBodyPosition(nearestElements(o, jd), jd), v); }
    if (o.type === 'sol') {
      if (settings.get('ephemeris') === 'horizons') {
        horizons ??= createHorizonsEphemeris(Object.fromEntries(model.bodies.map((x) => [x.id, x])), (st) => { horizonsStatus = st; });
        const p = horizons.positionOf(id, jd);
        if (p) { sourceOf[id] = 'horizons'; return toScene(p, v); }
      }
      sourceOf[id] = 'kepler';
      return toScene(heliocentric(id, jd), v);
    }
    sourceOf[id] = 'kepler';
    basisToScene(positionAt(elementsOf(o), o.M0 + (2 * Math.PI * (jd - o.epochJd)) / o.periodDays), o.basis, v);
    return v.add(hostScene(o.host, jd, tmp3));
  }
  const tmp3 = new THREE.Vector3();
  // a parent's position needs its own scratch vector at each level (LRO → Moon → Earth):
  // sharing one let the Moon's lookup of Earth overwrite itself and throw LRO ~1 AU out
  const parentTmp = Array.from({ length: 8 }, () => new THREE.Vector3());
  let depth = 0;
  function addParent(v, id, jd) {
    const t = parentTmp[depth++];
    try { return v.add(scenePosition(id, jd, t)); } finally { depth--; }
  }

  /**
   * Lagrange points of a pair (primary, secondary). L1/L2 sit a Hill radius either side of the
   * secondary; L4/L5 lead and trail it by 60°; L3 is opposite. Points near a planet go through
   * that planet's radial compression so they line up with its moons.
   */
  function lagrangePosition({ pair, L }, jd, v) {
    const mu = MASS_RATIO[pair];
    const [a, b] = pair.split('-');
    if (a === 'earth') { // Earth–Moon: offsets from Earth, mapped around Earth
      const moon = nodes.moon.body.moon;
      const r = new THREE.Vector3().copy(toScene(moonOffsetKm(moon, jd))).multiplyScalar(1 / AU_KM);
      const ahead = toScene(moonOffsetKm(moon, jd + 0.5)).multiplyScalar(1 / AU_KM);
      const n = r.clone().cross(ahead).normalize();
      const h = Math.cbrt(mu / 3);
      if (L === 1) r.multiplyScalar(1 - h); else if (L === 2) r.multiplyScalar(1 + h);
      else r.applyAxisAngle(n, (L === 4 ? 1 : -1) * Math.PI / 3);
      localMap(nodes.earth.body, r);
      return v.copy(r).add(nodes.earth.pos);
    }
    const B = scenePosition(b, jd, new THREE.Vector3());
    if (L === 1 || L === 2) {
      const off = B.clone().normalize().multiplyScalar((L === 1 ? -1 : 1) * B.length() * Math.cbrt(mu / 3));
      localMap(nodes[b].body, off);
      return v.copy(B).add(off);
    }
    if (L === 3) return v.copy(B).multiplyScalar(-(1 + (5 * mu) / 12));
    const ahead = scenePosition(b, jd + 5, new THREE.Vector3());
    const n = B.clone().cross(ahead).normalize();
    return v.copy(B).applyAxisAngle(n, (L === 4 ? 1 : -1) * Math.PI / 3);
  }

  /** The element set whose epoch is nearest `jd` (comets carry one per apparition). */
  const nearestElements = (o, jd) => (o.alt ?? []).reduce((best, el) => (Math.abs(el.epochJd - jd) < Math.abs(best.epochJd - jd) ? el : best), o.el);

  /** Map a true parent-relative offset (AU, in place) to its displayed offset at the current scale mix. */
  let unmapped = false; // true while computing physical (not displayed) positions
  function localMap(parent, v) {
    if (unmapped) return v;
    const r = v.length();
    if (!r) return v;
    const R = trueRadius(parent), Re = enhancedRadius(parent, model.scale);
    const rE = Re * compressRadii(r / R);
    return v.multiplyScalar((rE * Math.pow(r / rE, scaleMix)) / r);
  }

  // ---- eclipse shadows (#30) ----------------------------------------------------------------
  // Each lit body takes the one occluder most nearly between it and the Sun; the shader works out,
  // per point, how much of the Sun's disc it hides, in true geometry (so ENHANCED scale is fine).
  const OCCLUDERS = { earth: ['moon'], moon: ['earth'], jupiter: ['io', 'europa', 'ganymede', 'callisto'], io: ['jupiter'], europa: ['jupiter'],
    ganymede: ['jupiter'], callisto: ['jupiter'], saturn: ['titan'], titan: ['saturn'], mars: ['phobos', 'deimos'], pluto: ['charon'], charon: ['pluto'] };
  // sunlight refracted through an occluder's atmosphere into its umbra (Earth: the red eclipsed Moon), MODELLED
  const UMBRA_TINT = { earth: [0.42, 0.13, 0.05] };
  const shadowTmp = { c: new THREE.Vector3(), s: new THREE.Vector3(), o: new THREE.Vector3(), best: new THREE.Vector3() };
  function updateShadows(jd) {
    if (!model?.isSol) return;
    const truePos = {};
    unmapped = true;
    try {
      const at = (id) => (truePos[id] ??= scenePosition(id, jd, new THREE.Vector3()));
      for (const m of lit) {
        const id = m.userData.body, u = m.uniforms, cands = (OCCLUDERS[id] ?? []).filter((o) => nodes[o] && !nodes[o].body._missing);
        u.uOccOn.value = 0;
        if (!cands.length || !nodes[id]) continue;
        const c = shadowTmp.c.copy(at(id)), toS = shadowTmp.s.copy(at(model.starId)).sub(c);
        const rs = Math.asin(Math.min(1, nodes[model.starId].body.radiusKm / AU_KM / toS.length())), rb = nodes[id].body.radiusKm / AU_KM;
        let best = null;
        for (const o of cands) {
          const v = shadowTmp.o.copy(at(o)).sub(c);
          if (v.dot(toS) <= 0) continue; // behind the body
          const ro = Math.asin(Math.min(1, nodes[o].body.radiusKm / AU_KM / v.length()));
          // could its disc reach the Sun's from somewhere on this body? (the body's own size widens the margin)
          const margin = v.angleTo(toS) - rs - ro - Math.asin(Math.min(1, rb / v.length())) * 1.05;
          if (margin < 0 && (!best || margin < best.margin)) best = { o, margin, v: shadowTmp.best.copy(v) };
        }
        if (!best) continue;
        u.uOccOn.value = 1;
        u.uOccRel.value.copy(best.v).multiplyScalar(AU_KM);
        u.uOccR.value = nodes[best.o].body.radiusKm;
        u.uSunRel.value.copy(toS).multiplyScalar(AU_KM);
        u.uSunR.value = nodes[model.starId].body.radiusKm;
        u.uBodyR.value = nodes[id].body.radiusKm;
        u.uCentreW.value.copy(nodes[id].pos).add(root.position);
        u.uUmbraTint.value.setRGB(...(UMBRA_TINT[best.o] ?? [0, 0, 0]));
      }
    } finally { unmapped = false; }
  }

  // ---- eclipse outlines on Earth (#30) ----------------------------------------------------------
  // During a solar eclipse: the umbra (or antumbra) and penumbra where they meet the ground now,
  // and the path of totality/annularity (centre line and limits) turning with the Earth.
  let eclipseLines = null;
  const ECL_STYLE = { umbra: [0xff3355, 2.5, 0.95], penumbra: [0xffaa44, 1.6, 0.7], centre: [0xffffff, 1.4, 0.75], north: [0xff6688, 1.2, 0.6], south: [0xff6688, 1.2, 0.6] };
  function updateEclipseLines(jd) {
    const e = model?.isSol && nodes.earth && !surface ? solarEclipseAt(jd) : null;
    if (!e) { if (eclipseLines) for (const l of Object.values(eclipseLines)) l.visible = false; return; }
    if (!eclipseLines) {
      eclipseLines = {};
      for (const [k, [color, width, opacity]] of Object.entries(ECL_STYLE)) {
        const l = new LineSegments2(new LineSegmentsGeometry(), new LineMaterial({ color, linewidth: width, transparent: true, opacity, depthWrite: false, resolution: fat.resolution }));
        l.frustumCulled = false;
        root.add(l);
        eclipseLines[k] = l;
      }
    }
    const E = nodes.earth, k = (displayRadius(E.body) / trueRadius(E.body)) * 1.004 / AU_KM;
    const toS = (v) => { const p = toScene(v, tmpE).multiplyScalar(k).add(E.pos); return [p.x, p.y, p.z]; };
    const set = (line, pts) => { // pts: inertial km or null (breaks)
      const seg = [];
      for (let i = 1; i < pts.length; i++) if (pts[i - 1] && pts[i]) seg.push(...toS(pts[i - 1]), ...toS(pts[i]));
      line.visible = seg.length > 0;
      if (seg.length) { line.geometry.dispose(); line.geometry = new LineSegmentsGeometry().setPositions(seg); }
    };
    const o = shadowOutlines(jd);
    set(eclipseLines.umbra, o.umbra.map((q) => q && fixedToInertial(jd, q)));
    set(eclipseLines.penumbra, o.penumbra.map((q) => q && fixedToInertial(jd, q)));
    for (const key of ['centre', 'north', 'south']) set(eclipseLines[key], (e.path?.[key] ?? []).map((g) => inertialPoint(jd, g.lat, g.lon)));
  }
  const tmpE = new THREE.Vector3();

  // ---- focus & camera flight ---------------------------------------------------------
  let focusId = 'sun';
  let flight = null; // { from: Vector3 (scene), t0, dur, d0 }
  const focusPos = new THREE.Vector3();
  let scaleMix = settings.get('scale') === 'true' ? 1 : 0;

  const displayRadius = (b) => {
    const t = trueRadius(b), e = enhancedRadius(b, model.scale);
    return e * Math.pow(t / e, scaleMix); // log-interpolate between modes
  };
  const viewEnvelope = (b) => displayRadius(b) * Math.max(1, (shapeFor(b.id)?.maxRadiusKm ?? b.radiusKm) / b.radiusKm);
  const viewDistance = (id) => viewEnvelope(nodes[id].body) * (isStar(nodes[id].body) ? 14 : 7);

  let overviewAU = null; // set when framing the whole system rather than one body
  let framedRadius = null; // focus radius the camera distance was last fitted to

  /** Camera distance (AU) for regions and Lagrange points. */
  function markerView(b) {
    const local = (parent, km) => 2.4 * localMap(nodes[parent].body, new THREE.Vector3(km / AU_KM, 0, 0)).length();
    if (b.kind === 'region') return b.viewKm ? local(b.anchor, b.viewKm) : b.viewAU;
    if (b.pair === 'earth-moon') return local('earth', 4.8e5);
    if (b.pair === 'sun-earth') return b.L <= 2 ? local('earth', 1.7e6) : 2.6;
    return 9;
  }

  function flyTo(id, { overview = null } = {}) {
    if (!nodes[id]) return;
    if (surface) exitSurface(false);
    if (overview == null && nodes[id].body.marker) overview = markerView(nodes[id].body);
    flight = { from: focusPos.clone(), t0: performance.now(), dur: 1600, d0: camera.position.length() };
    focusId = id;
    void upgradeCraft(nodes[id]);
    void upgradeShape(nodes[id]);
    overviewAU = overview;
    framedRadius = null;
  }

  // ---- picking --------------------------------------------------------------------------
  const ray = new THREE.Raycaster();
  let down = null;
  labels.domElement.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
  const pick = (e) => {
    const r = renderer.domElement.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
    return ray.intersectObjects(pickables, false)[0];
  };
  let clickTimer = null;
  // an orbit line selects its body (#23): ray against the visible orbits, tolerance in screen terms
  const pickOrbit = (e) => {
    const r = renderer.domElement.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
    const lines = Object.values(nodes).filter((n) => n.orbit?.visible && n.group.visible !== false).map((n) => n.orbit);
    let best = null;
    for (const l of lines) {
      ray.params.Line.threshold = camera.position.length() * 0.006;
      const h = ray.intersectObject(l, false)[0];
      if (h && (!best || h.distance < best.distance)) best = { ...h, id: Object.keys(nodes).find((k) => nodes[k].orbit === l) };
    }
    return best?.id ?? null;
  };
  // the background stars: the catalogue sky as seen from this system (#23)
  const pickSky = (e) => {
    if (!skyRows.length) return null;
    const pos = sky.geometry.attributes.position.array;
    const hit = pickPoint(pos, pos.length / 3, sky, camera, renderer.domElement.getBoundingClientRect(), e.clientX, e.clientY, 7);
    return hit ? skyRows[hit.index] : null;
  };
  labels.domElement.addEventListener('pointerup', (e) => {
    if (surface || !down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
    const hit = pick(e);
    // wait a moment so a double-click goes to the surface instead of starting a flight
    clearTimeout(clickTimer);
    const ev = { clientX: e.clientX, clientY: e.clientY };
    clickTimer = setTimeout(() => {
      if (hit) return onSelect(hit.object.userData.id);
      const orbitOf = pickOrbit(ev);
      if (orbitOf) return onSelect(orbitOf);
      const star = pickSky(ev);
      if (star) onPickStar?.(star);
    }, 260);
  });
  labels.domElement.addEventListener('dblclick', (e) => {
    if (surface) return;
    clearTimeout(clickTimer);
    const hit = pick(e);
    if (!hit) return;
    const id = hit.object.userData.id, n = nodes[id];
    if (n && isStar(n.body)) { onDrillStar?.(id); return; } // drill down: a star opens its Star View
    if (!n || n.body.marker || n.body.kind === 'satellite' || n.body.kind === 'spacecraft') { flashHud('NO SURFACE HERE'); return; }
    const local = hit.object.worldToLocal(hit.point.clone());
    const normal = hit.face ? hit.face.normal.clone() : local.clone().normalize();
    enterSurface(id, { object: hit.object, local, normal });
  });

  // ---- surface view: stand where you double-clicked and look up ---------------------------
  // The camera sits 2 m above the surface, turns with the body, and starts at the zenith.
  // TRUE scale while standing (the sky must be real); drag to look around, wheel to zoom.
  let surface = null; // { id, object, local (object frame), normal (object frame), az, alt, fov, prevScale, sphere }
  const hud = document.createElement('div');
  hud.className = 'surface-hud';
  hud.hidden = true;
  const hudText = document.createElement('div'), hudSub = document.createElement('div');
  hudSub.className = 'surface-sub';
  const hudBack = Object.assign(document.createElement('button'), { className: 'pill', textContent: '▲ BACK TO ORBIT' });
  hudBack.addEventListener('click', () => exitSurface(true));
  // turn to the Sun (and zoom in): the way to watch an eclipse (#31)
  const hudSun = Object.assign(document.createElement('button'), { className: 'pill', textContent: '☉ LOOK AT THE SUN' });
  hudSun.addEventListener('click', () => { if (surface) surface.lookSun = true; });
  hud.append(hudText, hudSub, hudBack, hudSun);
  container.appendChild(hud);
  const flash = Object.assign(document.createElement('div'), { className: 'surface-flash' });
  flash.hidden = true;
  container.appendChild(flash);
  let flashT = null;
  function flashHud(text) { flash.textContent = text; flash.hidden = false; clearTimeout(flashT); flashT = setTimeout(() => { flash.hidden = true; }, 2200); }
  const compass = ['N', 'E', 'S', 'W'].map((t, i) => {
    const el = document.createElement('div');
    el.className = 'nav-label compass';
    el.textContent = t;
    const o = new CSS2DObject(el);
    o.center.set(0.5, 0.5);
    o.visible = false;
    o.userData.az = i * 90;
    scene.add(o);
    return o;
  });
  const zenithTag = (() => { const el = document.createElement('div'); el.className = 'nav-label compass zenith'; el.textContent = '+ ZENITH'; const o = new CSS2DObject(el); o.visible = false; scene.add(o); return o; })();

  function enterSurface(id, { object, local, normal }) {
    const n = nodes[id];
    if (!n) return;
    const sphere = object === n.mesh;
    surface = { id, object, local, normal: sphere ? local.clone().normalize() : normal.normalize(), az: 0, alt: 90, fov: 70,
      prevScale: settings.get('scale'), sphere, frame: null };
    flight = null;
    focusId = id;
    overviewAU = null;
    if (settings.get('scale') !== 'true') settings.set('scale', 'true');
    controls.enabled = false;
    hud.hidden = false;
    onSelect?.(id, { surface: true });
  }
  function exitSurface(restore = true) {
    if (!surface) return;
    const s = surface;
    surface = null;
    hud.hidden = true;
    for (const c of [...compass, zenithTag]) c.visible = false;
    skyMat.uniforms.uFade.value = 1;
    scene.background = null;
    camera.fov = 50; camera.updateProjectionMatrix();
    camera.up.set(0, 1, 0);
    controls.enabled = true;
    if (restore) {
      if (s.prevScale !== settings.get('scale')) settings.set('scale', s.prevScale);
      // back out above the spot we stood on
      const out = tmp.copy(camera.position).normalize();
      camera.position.copy(out.lengthSq() ? out : tmp.set(0, 0.6, 1).normalize()).multiplyScalar(viewDistance(s.id));
      controls.target.set(0, 0, 0);
      framedRadius = null;
    }
  }
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && surface && !container.hidden) exitSurface(true); });
  // look around: drag (azimuth/altitude), wheel (field of view)
  let lookDrag = null;
  labels.domElement.addEventListener('pointerdown', (e) => { if (surface) lookDrag = [e.clientX, e.clientY]; });
  window.addEventListener('pointerup', () => { lookDrag = null; });
  labels.domElement.addEventListener('pointermove', (e) => {
    if (!surface || !lookDrag) return;
    const k = surface.fov / container.clientHeight;
    surface.az = (surface.az - (e.clientX - lookDrag[0]) * k + 360) % 360;
    surface.alt = Math.max(-15, Math.min(90, surface.alt + (e.clientY - lookDrag[1]) * k));
    lookDrag = [e.clientX, e.clientY];
  });
  labels.domElement.addEventListener('wheel', (e) => {
    if (!surface) return;
    e.preventDefault();
    surface.fov = Math.max(2, Math.min(110, surface.fov * Math.exp(e.deltaY * 0.001)));
  }, { passive: false });

  const sv = { a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3(), d: new THREE.Vector3(), e: new THREE.Vector3(), q: new THREE.Quaternion() };
  /**
   * What you'd see from the ground: the Sun, the planets, our own moon (or, from a moon, its
   * planet and sibling moons). Belts, satellites, spacecraft, orbit lines, zones and markers are
   * chart overlays, not sky, so they go; in daylight only the Sun and the brightest neighbours stay.
   */
  function surfaceSky() {
    const s = surface, here = nodes[s.id].body;
    if (zones) for (const o of [zones.geo.object, ...zones.va.map((z) => z.object), zones.helio.group, zones.oort, ...zones.hill.map((h) => h.shape.object)]) o.visible = false;
    if (belts) belts.points.visible = false;
    if (sats) sats.points.visible = false;
    for (const id in nodes) {
      const n = nodes[id], b = n.body;
      if (n.orbit) n.orbit.visible = false;
      let show;
      if (id === s.id) { n.group.visible = true; n.label.visible = false; continue; } // the ground underfoot
      else if (b.comet) show = (n.cometState?.activity ?? 0) > 0.01; // an active comet is a sight; a dormant one is invisible
      else if (b.marker || b.kind === 'satellite' || b.kind === 'spacecraft' || b.orbit?.type === 'elements') show = false;
      else if (b.kind === 'moon') show = b.parent === s.id || b.parent === here.parent; // our moon(s), or sibling moons
      else show = true; // stars and planets
      // daylight: only the Sun, the planet overhead (from a moon) and our own moon
      if (show && s.day > 0.5 && !isStar(b) && !(b.kind === 'moon' && b.parent === s.id) && id !== here.parent) show = false;
      n.group.visible = show;
      n.label.visible = show;
    }
  }
  // ---- the corona in totality (#31) -----------------------------------------------------------
  // A real photograph of the corona fades in when the Moon fully covers the Sun, its streamer
  // axis (equatorial near solar minimum, as in 2017) turned onto today's solar equator, its dark
  // lunar disc scaled to the Moon's apparent size; the diamond ring and Baily's beads flash at
  // second and third contact.
  const CORONA = { url: '/references/corona-2017-08-21.jpg', discFrac: 113.83 / 1024, axisDeg: 66.9, date: '2017-08-21',
    credit: 'NASA/Carla Thomas, total solar eclipse of 2017-08-21 from NASA Armstrong\'s Gulfstream III' };
  const ARCSEC = Math.PI / 648000;
  let corona = null;
  function coronaObjects() {
    if (corona) return corona;
    const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const url = visualImageUrl({ url: CORONA.url });
    if (url) loader.load(url, (t) => { t.colorSpace = THREE.SRGBColorSpace; mat.map = t; mat.needsUpdate = true; });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    plane.frustumCulled = false; plane.visible = false;
    const bead = () => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xfff6e8, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true, opacity: 0 })); sp.visible = false; return sp; };
    const ring = bead(), beads = [bead(), bead(), bead(), bead(), bead()];
    scene.add(plane, ring, ...beads);
    corona = { plane, ring, beads, shown: null };
    return corona;
  }
  const solarNorth = (() => { const [ra, dec] = SUN_POLE.map((x) => (x * Math.PI) / 180); return new THREE.Vector3(...frameToScene(eqToEcl([Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)]))); })();
  const cv = { s: new THREE.Vector3(), m: new THREE.Vector3(), d: new THREE.Vector3(), n: new THREE.Vector3(), x: new THREE.Vector3(), q: new THREE.Quaternion(), r: new THREE.Quaternion(), b: new THREE.Matrix4() };
  function updateCorona(p, e) {
    const c = corona ?? (e ? coronaObjects() : null);
    if (!c) return;
    const sunN = nodes[model.starId], moonN = nodes.moon;
    const g = e && e.sm > e.ss && sunN && moonN ? e.sep - (e.sm - e.ss) : Infinity; // < 0 in totality
    const hide = () => { c.plane.visible = false; c.ring.visible = false; for (const b of c.beads) b.visible = false; c.shown = null; };
    if (!(g < 6 * ARCSEC)) { hide(); return; }
    const S = sunN.group.getWorldPosition(cv.s), M = moonN.group.getWorldPosition(cv.m);
    const d = cv.d.copy(S).sub(p), D = d.length(); d.normalize();
    // the corona plane: facing us at the Sun, solar north projected on the sky as 'up'
    const up = cv.n.copy(solarNorth).addScaledVector(d, -solarNorth.dot(d)).normalize();
    const back = d.clone().negate(), right = cv.x.crossVectors(up, back);
    c.plane.quaternion.setFromRotationMatrix(cv.b.makeBasis(right, up, back)).multiply(cv.r.setFromAxisAngle(new THREE.Vector3(0, 0, 1), (-CORONA.axisDeg * Math.PI) / 180));
    c.plane.position.copy(S);
    c.plane.scale.setScalar((D * Math.tan(e.sm)) / CORONA.discFrac);
    c.plane.visible = true;
    c.plane.material.opacity = THREE.MathUtils.smoothstep(-g, -4 * ARCSEC, 3 * ARCSEC); // fades in over the last arcseconds
    // diamond ring and beads: the last sunlight through lunar valleys, where the limbs meet
    const limbDir = M.clone().sub(p).normalize();
    const toward = d.clone().sub(limbDir).addScaledVector(d, -d.clone().sub(limbDir).dot(d)).normalize(); // Moon centre → Sun centre on the sky
    const rSun = D * Math.tan(e.ss);
    const ringK = Math.exp(-(((g / ARCSEC) - 1.5) ** 2) / 2) * (g > -1 * ARCSEC ? 1 : 0);
    c.ring.position.copy(S).addScaledVector(toward, rSun);
    c.ring.scale.setScalar(rSun * 1.6 * (0.6 + ringK));
    c.ring.material.opacity = ringK;
    c.ring.visible = ringK > 0.01;
    const side = cv.x.crossVectors(toward, d).normalize(), t = performance.now() / 1000;
    c.beads.forEach((b, i) => {
      const a = ((i - 2) * 9 * Math.PI) / 180, k = g > -1.5 * ARCSEC && g < 2.5 * ARCSEC ? 0.55 + 0.45 * Math.sin(t * (7 + i * 3) + i * 1.7) : 0;
      b.position.copy(S).addScaledVector(toward, rSun * Math.cos(a)).addScaledVector(side, rSun * Math.sin(a));
      b.scale.setScalar(rSun * 0.18);
      b.material.opacity = k * (i === 2 ? 0 : 1);
      b.visible = k > 0.01;
    });
    c.shown = e.eclipse && Math.abs(e.eclipse.greatest - (Date.parse(`${CORONA.date}T18:26:00Z`) / 86400000 + 2440587.5)) < 1 ? 'measured' : 'representative';
  }

  /** Place the camera on the surface for this frame (after positions and orientations are set). */
  function updateSurface(jd) {
    const s = surface, n = nodes[s.id];
    root.updateMatrixWorld(true);
    const centre = n.group.getWorldPosition(sv.c);
    const R = n.body.radiusKm || 1;
    // 2 m above the surface, in the object's own units (spheres are unit radius)
    const lift = s.sphere ? 1 + 0.002 / R : 1;
    const p = s.object.localToWorld(sv.a.copy(s.local).multiplyScalar(s.sphere ? lift / s.local.length() : 1));
    if (!s.sphere) p.add(sv.b.copy(s.normal).transformDirection(s.object.matrixWorld).multiplyScalar(0.002 / AU_KM));
    const up = s.sphere ? sv.b.copy(p).sub(centre).normalize() : sv.b.copy(s.normal).transformDirection(s.object.matrixWorld);
    const pole = new THREE.Vector3(0, 1, 0).applyQuaternion(n.tilt.getWorldQuaternion(sv.q));
    const f = horizonFrame(up.toArray(), pole.toArray());
    s.frame = f;
    const { dir, camUp } = surfaceLook(f, s.az, s.alt);
    camera.position.copy(p);
    camera.up.set(...camUp);
    camera.lookAt(sv.d.copy(p).add(sv.e.set(...dir))); // p stays the standing point
    if (Math.abs(camera.fov - s.fov) > 1e-3) { camera.fov = s.fov; camera.updateProjectionMatrix(); }
    camera.near = 1e-14; camera.far = 1e6; camera.updateProjectionMatrix();
    // compass on the horizon, zenith marker
    for (const c of compass) { const d = surfaceLook(f, c.userData.az, 0).dir; c.position.set(p.x + d[0] * 1e-3, p.y + d[1] * 1e-3, p.z + d[2] * 1e-3); c.visible = true; }
    zenithTag.position.set(p.x + f.up[0] * 1e-3, p.y + f.up[1] * 1e-3, p.z + f.up[2] * 1e-3); zenithTag.visible = true;
    // the Sun: altitude, daylight sky
    const star = nodes[model.starId];
    const sunDir = star.group.getWorldPosition(sv.c).sub(p);
    const sun = altAz(f, sunDir.toArray());
    if (s.lookSun) { s.az = sun.az; s.alt = Math.min(89.9, sun.alt); s.fov = Math.min(s.fov, 6); s.lookSun = false; }
    hudSun.hidden = sun.alt < -1;
    const air = DAY_SKY[s.id];
    let day = air ? (air.always ? Math.max(0.15, daylight(sun.alt)) : daylight(sun.alt)) : 0;
    // a solar eclipse dims the day by the share of the Sun the Moon hides; totality brings out the stars (#30)
    const llNow = s.sphere ? dirToLatLon(s.local.toArray()) : null;
    s.eclipse = s.id === 'earth' && llNow && model.isSol ? eclipseDaylight(jd, llNow.lat, llNow.lon, surfacePoint) : null;
    if (s.eclipse) day *= s.eclipse.light;
    updateCorona(p, s.eclipse);
    // the Sun's glare sprite goes with the sunlight that is left
    const glare = nodes[model.starId]?.mesh?.children?.find((ch) => ch.isSprite);
    if (glare) glare.material.opacity = 0.85 * (s.eclipse ? 1 - s.eclipse.obscuration : 1);
    if (air && day > 0) {
      const k = air.always ? Math.min(1, day) * 0.7 : day * 0.9;
      scene.background = (scene.background?.isColor ? scene.background : new THREE.Color()).setRGB(air.rgb[0] * k, air.rgb[1] * k, air.rgb[2] * k, THREE.LinearSRGBColorSpace);
    } else scene.background = null;
    skyMat.uniforms.uFade.value = air?.hidesStars ? Math.max(0, 1 - day * 1.6) : 1;
    s.day = air?.hidesStars ? day : 0;
    // read-out
    const ll = s.sphere ? dirToLatLon(s.local.toArray()) : null;
    const where = ll ? `${Math.abs(ll.lat).toFixed(2)}°${ll.lat >= 0 ? 'N' : 'S'} ${Math.abs(ll.lon).toFixed(2)}°${ll.lon >= 0 ? 'E' : 'W'}` : 'ON ITS SURFACE';
    const giant = (n.body.radiusKm ?? 0) > 20000;
    const text = `${giant ? 'AT THE CLOUD TOPS OF' : 'STANDING ON'} ${n.body.name.toUpperCase()} · ${where}`;
    const look = s.alt > 89.5 ? 'LOOKING STRAIGHT UP' : `LOOKING ${Math.round(s.az)}° AZ · ${Math.round(s.alt)}° ALT`;
    const coronaTxt = corona?.shown ? (corona.shown === 'measured' ? ' · CORONA: THIS ECLIPSE (NASA/CARLA THOMAS, MEASURED)' : ` · CORONA: REPRESENTATIVE (${CORONA.date}, NASA/CARLA THOMAS)`) : '';
    const ecl = s.eclipse && s.eclipse.obscuration > 0 && sun.alt > -1 ? (s.eclipse.total ? ` · TOTAL ECLIPSE: TOTALITY${coronaTxt}` : ` · ECLIPSE: ${Math.round(s.eclipse.obscuration * 100)}% OF THE SUN HIDDEN${coronaTxt}`) : '';
    const sunTxt = `SUN ${sun.alt >= 0 ? `${sun.alt.toFixed(1)}° UP` : `${(-sun.alt).toFixed(1)}° BELOW THE HORIZON`} · AZ ${Math.round(sun.az)}°${ecl}`;
    const sub = `${look} · ${sunTxt} · FOV ${Math.round(s.fov)}°${air ? ` · ${air.note}` : ''}${giant ? ' · No solid surface: a giant planet is gas all the way down.' : ''} · DRAG TO LOOK · WHEEL TO ZOOM · ESC TO RETURN`;
    if (hudText.textContent !== text) hudText.textContent = text;
    if (hudSub.textContent !== sub) hudSub.textContent = sub;
  }

  // ---- frame loop -------------------------------------------------------------------------
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const tmp6 = new THREE.Vector3(), tmp7 = new THREE.Vector3(), tmp8 = new THREE.Vector3(), tmp9 = new THREE.Vector3();
  const basis = new THREE.Matrix4();
  const beaconScreen = new THREE.Vector3();
  let running = false;

  function resize() {
    const { clientWidth: w, clientHeight: h } = container;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    labels.setSize(w, h);
    fat.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(container);

  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    clock.tick(now);
    if (!model) return;
    const jd = clock.jd;

    const targetMix = settings.get('scale') === 'true' ? 1 : 0;
    scaleMix += (targetMix - scaleMix) * 0.08;
    if (Math.abs(targetMix - scaleMix) < 1e-3) scaleMix = targetMix;
    const showLabels = settings.get('labels'), showOrbits = settings.get('orbits');

    for (const id in nodes) {
      const n = nodes[id];
      scenePosition(id, jd, n.pos);
      n.group.position.copy(n.pos);
      n.tilt.scale.setScalar(displayRadius(n.body));
      if (n.body.marker) {
        if (n.body.labelAt) { // regions: label away from the anchor
          const la = n.body.labelAt;
          if (n.body.anchor === 'sun') n.label.position.set(...la);
          else n.label.position.copy(localMap(nodes[n.body.anchor].body, tmp6.set(la[0] / AU_KM, la[1] / AU_KM, la[2] / AU_KM)));
        }
        const zonesOn = settings.get('zones'), fid = focusId;
        const nearEarth = ['earth', 'moon', 'geo-ring', 'van-allen', 'hill-spheres'].includes(fid) || fid.startsWith('em-') || fid === 'se-l1' || fid === 'se-l2';
        const local = n.body.anchor === 'earth' || n.body.pair === 'earth-moon' || (n.body.pair === 'sun-earth' && n.body.L <= 2);
        n.label.visible = id === fid || (zonesOn && showLabels && (local ? nearEarth : n.body.kind === 'lagrange point' || overviewAU != null));
        n.group.visible = n.label.visible || n.body.kind === 'lagrange point' && zonesOn;
        continue;
      }
      if (model.isSol && (id === 'moon' || id === 'earth')) {
        // Earth: precessing, nutating pole and sidereal time from the equinox of date.
        // Moon: IAU 2009 rotation, so it librates as seen from Earth.
        const ax = id === 'earth' ? earthAxes(jd, n.body.texLon0 ?? -180) : moonAxes(jd, n.body.texLon0 ?? -180);
        const toS = (v) => new THREE.Vector3(...frameToScene(eqToEcl(v)));
        basis.makeBasis(toS(ax.x), toS(ax.y), toS(ax.z));
        n.tilt.quaternion.setFromRotationMatrix(basis);
        n.mesh.rotation.y = 0;
      } else if (n.body.locked) {
        // Tidally locked: the prime meridian (texture centre) faces the planet; spin axis = orbit normal.
        const to = tmp6.copy(nodes[n.body.parent].pos).sub(n.pos).normalize();
        const ahead = scenePosition(id, jd + (n.body.periodDays ?? n.body.moon.elements.P) / 50, tmp7).sub(n.pos);
        const up = tmp8.copy(to).negate().cross(ahead).normalize(); // r × v
        const x = to.sub(tmp9.copy(up).multiplyScalar(to.dot(up))).normalize();
        basis.makeBasis(x, up, tmp9.copy(x).cross(up));
        n.tilt.quaternion.setFromRotationMatrix(basis);
        n.mesh.rotation.y = 0;
      } else if (n.body.iau && n.body.pole) {
        // Real orientation: IAU pole + prime meridian (Earth by sidereal time).
        const ax = bodyAxes(n.body.pole, n.body.iau, jd, n.body.texLon0 ?? -180);
        const toS = (v) => new THREE.Vector3(...frameToScene(eqToEcl(v)));
        basis.makeBasis(toS(ax.x), toS(ax.y), toS(ax.z));
        n.tilt.quaternion.setFromRotationMatrix(basis);
        n.mesh.rotation.y = 0;
      } else {
        n.mesh.rotation.y = n.body.rotationHours ? ((jd * 24) / n.body.rotationHours) * Math.PI * 2 % (Math.PI * 2) : 0;
      }
      const fb = nodes[focusId].body;
      const local = n.body.kind === 'moon' || (n.body.kind === 'spacecraft' && n.body.parent);
      const near = !local || fb.id === n.body.parent || fb.parent === n.body.parent || fb.id === n.body.id;
      const minorFar = n.body.orbit?.type === 'elements' && overviewAU != null && overviewAU < 6 && n.body.belt !== 'MAIN BELT';
      n.label.visible = (showLabels && near && !minorFar) || id === focusId;
      n.group.visible = !n.body._missing && (n.body.kind !== 'moon' || near || overviewAU == null || camera.position.length() < 3);
      n.label.element.classList.toggle('focused', id === focusId);
      if (n.body.orbit) {
        updateOrbit(n, jd);
        n.orbit.visible = (showOrbits || id === focusId) && !surface;
        n.orbit.material.opacity = id === focusId ? 0.9 : n.body.orbit.type === 'elements' ? 0.32 : n.body.kind === 'spacecraft' ? 0.22 : 0.45;
        fat.sync(n.orbit, id === focusId ? 3 : 1.6);
        if (n.endMark) n.endMark.visible = n.orbit.visible && !surface;
      }
    }

    // Camera flight: slide the floating origin from the old focus to the new one
    // while easing the camera's distance (log-space, so 30 AU → 1e-4 AU feels smooth).
    const target = nodes[focusId].pos;
    if (flight) {
      const t = Math.min(1, (now - flight.t0) / flight.dur), k = ease(t);
      focusPos.lerpVectors(flight.from, target, k);
      const d1 = overviewAU ?? viewDistance(focusId); // live, so a scale switch mid-flight still lands well
      const d = Math.exp(Math.log(flight.d0) + (Math.log(d1) - Math.log(flight.d0)) * k);
      camera.position.setLength(d);
      if (t >= 1) { flight = null; framedRadius = displayRadius(nodes[focusId].body); }
    } else {
      focusPos.copy(target);
      // Switching ENHANCED ⇄ TRUE while framing a body: keep it the same size on screen.
      if (!surface && overviewAU == null && framedRadius) {
        const r = displayRadius(nodes[focusId].body);
        camera.position.multiplyScalar(r / framedRadius);
        framedRadius = r;
      }
    }
    root.position.copy(focusPos).negate();
    if (zones) updateZones(jd);
    updateExtras(jd);
    if (belts) { belts.update(jd); belts.points.visible = settings.get('belts'); }
    if (sats && nodes.earth) {
      sats.points.visible = settings.get('satellites');
      sats.points.position.copy(nodes.earth.pos);
      sats.update(jd, trueRadius(nodes.earth.body), enhancedRadius(nodes.earth.body, model.scale), scaleMix, clock.rate.days ?? 0);
    }
    // near plane follows the camera so 100 m spacecraft can be seen at true scale
    const near = Math.min(1e-7, Math.max(1e-15, camera.position.length() * 1e-3));
    if (!surface && Math.abs(near - camera.near) / camera.near > 0.2) { camera.near = near; camera.updateProjectionMatrix(); }
    for (const m of lit) m.uniforms.uSunPos.value.copy((nodes[m.userData.host] ?? nodes[model.starId]).pos).add(root.position);
    updateShadows(jd);
    updateEclipseLines(jd);
    updateTracks(jd);
    for (const id in nodes) {
      const c = nodes[id].clouds;
      if (c) {
        c.rotation.y = (now / 1000) * 0.004; // clouds: a static 2004 snapshot, drifted gently so they read as weather
        c.visible = !liveState[id]; // today's imagery already has today's clouds
      }
    }
    if (liveState.sun && nodes.sun && nodes.earth) { // the live solar disk faces Earth, solar north up
      const u = nodes.sun.mesh.material.uniforms;
      u.uEarthDir.value.copy(nodes.earth.pos).sub(nodes.sun.pos).normalize();
      u.uNorth.value.copy(poleVector(nodes.sun.body.pole));
    }
    if (surface) { updateSurface(jd); surfaceSky(); }
    else {
      controls.minDistance = viewEnvelope(nodes[focusId].body) * 1.3;
      controls.update();
    }

    renderer.render(scene, camera);
    labels.render(scene, camera);

    // Sector-001 edge beacon: Sol's star in Sector 001, otherwise the direction to Sol.
    if (model.isSol) tmp.copy(nodes[model.starId].pos).sub(focusPos);
    else tmp.set(...model.solDirection).multiplyScalar(1000).add(camera.position);
    beaconScreen.copy(tmp).project(camera);
    const behind = tmp.clone().applyMatrix4(camera.matrixWorldInverse).z > 0;
    onFrame?.({
      jd, focusId, scaleMix, horizonsStatus, skySource,
      sources: { ...sourceOf },
      beacon: {
        x: beaconScreen.x, y: beaconScreen.y, behind,
        visible: !behind && Math.abs(beaconScreen.x) <= 1 && Math.abs(beaconScreen.y) <= 1,
        atFocus: model.isSol && focusId === model.starId,
      },
    });
  }

  return {
    /** The spectrum filter (#28): band id and bandpass id (null = the band's default). */
    setBand(bandId, passId) { band = bandById(bandId); pass = passById(band, passId); applyBand(); },
    get band() { return { band, pass: pass ?? band.passes[0] ?? null }; },
    /** How body `id` is drawn in the current band: { mode, tier, label, detail } or null in full spectrum. */
    bandLookOf: (id) => nodes[id]?.bandLook ?? null,
    /** The sky survey in use, or null. */
    bandSky: () => (band.id === 'full' ? null : (pass?.sky ? pass : band.passes.find((x) => x.sky)) ?? null),
    show() { container.hidden = false; resize(); if (!running) { running = true; requestAnimationFrame(frame); } },
    hide() { container.hidden = true; running = false; },
    load,
    setSky, decorativeSky,
    /** Every active Earth satellite from /api/satellites (Sol only). */
    setSatellites(data) {
      if (!model?.isSol || sats || !data?.rows?.length) return null;
      sats = createSatelliteLayer(data, renderer.getPixelRatio());
      root.add(sats.points);
      return sats.count;
    },
    /** Add (once) and return a focusable satellite body. */
    addSatellite(body) {
      if (!nodes[body.id]) { model.bodies.push(body); addBody(body, 0); }
      sats?.select(body.norad);
      return nodes[body.id].body;
    },
    showSatelliteCategory(c, on) { sats?.showCategory(c, on); },
    satelliteState(id) {
      const b = nodes[id]?.body;
      return b?.satrec ? stateAt(b.satrec, clock.jd) : null;
    },
    /** Small-body populations from /api/smallbodies (Sol only). */
    setBelts(data) {
      if (!model?.isSol || belts || !data?.rows?.length) return null;
      belts = createBelts(data, renderer.getPixelRatio());
      root.add(belts.points);
      return belts.counts;
    },
    get model() { return model; },
    focus(id, opts) { flyTo(id, opts); },
    /** Stand on body `id` at latitude/longitude (deg) and look up. */
    surfaceAt(id, lat, lon, { lookSun = false } = {}) {
      const n = nodes[id];
      if (!n || isStar(n.body)) return false;
      const local = new THREE.Vector3(...latLonToDir(lat, lon));
      enterSurface(id, { object: n.mesh, local, normal: local.clone() });
      surface.lookSun = lookSun;
      return true;
    },
    exitSurface: () => exitSurface(true),
    /** Live comet state: activity, coma and tail sizes, heliocentric and geocentric distance, total magnitude. */
    cometState(id) {
      const n = nodes[id];
      if (!n?.comet || !n.cometState) return null;
      const dEarth = nodes.earth ? truePosition(id).distanceTo(truePosition('earth')) : null;
      return { ...n.cometState, deltaAU: dEarth, mag: dEarth ? cometMagnitude(n.body.comet, dEarth, n.cometState.rAU) : null };
    },
    get onSurface() { return surface ? { id: surface.id } : null; },
    overview(au, centre, localKm) {
      if (localKm && nodes[centre]) au = 2.4 * localMap(nodes[centre].body, new THREE.Vector3(localKm / AU_KM, 0, 0)).length();
      flyTo(centre && nodes[centre] ? centre : model.starId, { overview: au });
    },
    get focusId() { return focusId; },
    /** Scene position of a body, AU. */
    /** True (physical) scene position of a body, AU: no ENHANCED compression around planets. */
    positionOf: (id) => truePosition(id).toArray(),
    /** Distance (AU) from a body to its own star (planets), its parent (moons, local craft) or the system's centre (stars). */
    hostDistance(id) {
      const b = nodes[id]?.body;
      const p = truePosition(id);
      if (!b || isStar(b)) return p.length();
      if (b.parent && nodes[b.parent]) return p.distanceTo(truePosition(b.parent));
      if (b.orbit?.type === 'moon') return Math.hypot(...moonOffsetKm(b.moon, clock.jd)) / AU_KM;
      return p.distanceTo(b.orbit?.host ? hostScene(b.orbit.host, clock.jd, new THREE.Vector3()) : new THREE.Vector3());
    },
    enhancementOf: (id) => enhancement(nodes[id].body, model.scale),
    /** { time, credit, feed } if body `id` wears a live skin right now. */
    liveSkinOf: (id) => liveState[id] ?? null,
  };
}
