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
import { createPaleoEarth } from './paleoearth.js';
import { jdFromDate } from '../../astro/time.js';
import { AU_KM, SUN } from '../../data/sol.js';
import { visualImageUrl } from '../../data/catalog.js';

const SUN_POLE = SUN.pole;
const loader = new THREE.TextureLoader();
import { createHorizonsEphemeris } from '../../data/horizons.js';
import { settings } from '../../settings.js';
import { planetTexture, glowTexture, ringTexture } from './textures.js';
import { pickPoint } from '../pick.js';
import { createSiteLayer, siteDir } from './sites.js';
import { createTrekSystemLayer } from './trek.js';
import { fetchTraverse, fetchFeatures, fetchClusters } from '../../data/catalog.js';
import { createFeatureLayer } from './features.js';
import { angularDiameterDeg, phase as lookPhase, describeSize, fmtLightTime, fitFov, magnification, NAKED_EYE_FOV, C_KM_S } from '../../astro/lookat.js';
import { createCameraRig, reducedMotion } from '../cameraControls.js';
import { createHelm } from '../ship/helm.js';
import { fitDistance, METERS } from '../cameraMath.js';
import { dirToLatLon, latLonToDir, horizonFrame, lookAt as surfaceLook, altAz, DAY_SKY, daylight } from './surface.js';
import { planetMaterial, cloudMaterial, starMaterial, applySkin, loadTexture, applyLiveSkin, loadLive, BAND_UNIFORMS } from './materials.js';
import { cloudLayer, createDescent, startDescent, stepDescent, descentGauge, GROUND_EYE_KM, visibilityKm } from '../../astro/atmosphere.js';
import { superRotation, cloudCoverAt, layerLook, createMurkVeil, layerReadout, addCloudSlices, cloudDetail, cloudSides, loadEarthClouds, cloudTopAt, icePriorTexture, helmLayerLook } from './clouds.js';
import { cloudColumn } from '../../astro/atmosphere.js';
import { badge } from '../../data/provenance.js';
import { createRelief } from './relief.js';
import { fmtElevation, reliefK } from '../../astro/dem.js';
import { BANDS, bandById, passById } from '../../data/bands.js';
import { starBandDelta, paletteIndex, ringBandLook } from './bandskin.js';
import { bandTexture, hipsUrl, applyBandToMaterial, progressiveFeed, feedCredit, FULL_DELAY_MS } from './bandtextures.js';
import { prepare, skyLayers as curveSkyLayers, curveStarDelta, curveStarRgb, starCurveLook } from './curvelook.js';
import { starBandLook } from './starband.js';
import { bakedFeed, bakedHips, bakedText } from '../../data/bandbake.js';
import { curveFromLegacy } from '../../data/curve.js';
import { bandLoads } from '../../data/bandload.js';
import { currentBand } from '../../data/bandstate.js';
import { bodyAxes, meridianDirection } from '../../astro/rotation.js';
import { earthAxes, moonAxes, earthPole, ECLIPTIC_POLE } from '../../astro/orientation.js';
import { createComet, cometMagnitude } from './comet.js';
import { createSolarField } from './solarfield.js';
import { ELEMENTS } from '../../astro/kepler.js';
import { MASS_RATIO } from '../../data/poi.js';
import { createBelts } from './belts.js';
import { createSatelliteLayer } from './satellites.js';
import { createMissionLayer } from './missions.js';
import { createMagFields } from './magfields.js';
import { createRadioBelts } from './radiobelts.js'; // #61
import { createSkyGlare } from './skyglare.js';
import { createSkyLayers } from './skylayers.js';
import { PLANETSHINE, planetshineFraction, planetshineDisplay, angleBetween, litFraction } from '../../astro/planetshine.js';
import { FOV_PRESETS, presetFov, horizontalFov, glareStrength } from '../../astro/apparent.js';
import { transferArc, transferPosition } from '../../astro/transfer.js';
import { stateAt, precessionToJ2000, temeToEcliptic } from '../../astro/sgp4.js';
import { hiddenByDetail } from '../../data/detail.js';
import { heliocentricAt, localAt, localDaySamples, trajectory, ephemerisEnd } from '../../data/spacecraft-ephem.js';

const NAIF = { earth: 399, moon: 301, mars: 499, jupiter: 599, saturn: 699 };
const isoDate = (jd) => new Date((jd - 2440587.5) * 86400000).toISOString().slice(0, 10);
import { geoRing, vanAllen, hillSphere, heliosphere, oortCloud, DIPOLE_POLE } from './zones.js';
import { moonOffsetKm } from '../../astro/moons.js';
import { smallBodyPosition, smallBodyOrbit } from '../../astro/smallbodies.js';
import { makeSnapshot } from '../snapshot.js';
import { createGovernor } from '../governor.js';
import { SKINS } from '../../data/skins.js';
import { createCorona, createCoronaPass, loadCoronaFeed, sunPixelRadius, coronaPostcard } from './corona.js';

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

export function createSystemView(container, { clock, onSelect, onSite, onFeature, onFrame, onPickStar, onDrillStar, onDeepSky, onTrek, onHelm, onElevation }) {
  const relief = createRelief({ settings }); // #80: DEM relief, displacement and close-up terrain
  let hiddenKinds = null, hiddenTrek = null, hiddenSet = new Set();
  const siteViewSize = { w: 1, h: 1 };
  // the Star Trek sites (#41) follow the STAR TREK layer as well as their filter
  const hiddenSiteKinds = () => {
    const a = settings.get('siteHidden'), t = !settings.get('starfleet');
    if (a !== hiddenKinds || t !== hiddenTrek) { hiddenKinds = a; hiddenTrek = t; hiddenSet = new Set([...(a ?? []), ...(t ? ['trek'] : [])]); }
    return hiddenSet;
  };
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
  // the Star Trek layer (#41): stations around Sol's bodies, imagined orbits at real stars
  const trek = createTrekSystemLayer({ onTrek: (id) => onTrek?.(id) });
  root.add(trek.group);
  const trekTmp = new THREE.Vector3();
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
    // #42: at relativistic impulse the helm sets uAbBeta (β) and uAbDir (unit velocity, scene axes): each star is
    // moved to its aberrated direction and its colour and size follow the Doppler factor (warp.js aberrateCos /
    // dopplerFactor; positions exact, colour and brightness an approximation). β = 0 leaves the sky as it is.
    uniforms: { uPixel: { value: renderer.getPixelRatio() }, uFade: { value: 1 }, uAbBeta: { value: 0 }, uAbDir: { value: new THREE.Vector3(0, 0, -1) } },
    vertexShader: `attribute float size; attribute vec3 color; varying vec3 vColor; uniform float uPixel; uniform float uAbBeta; uniform vec3 uAbDir;
      void main() {
        vec3 p = position; vColor = color; float s = size;
        if (uAbBeta > 0.0) {
          float r = length(p); vec3 d = p / r; float c = dot(d, uAbDir);
          float cp = (c + uAbBeta) / (1.0 + uAbBeta * c);
          vec3 perp = d - c * uAbDir; float pl = length(perp);
          if (pl > 1e-6) p = (uAbDir * cp + perp / pl * sqrt(max(0.0, 1.0 - cp * cp))) * r;
          float D = sqrt(1.0 - uAbBeta * uAbBeta) / (1.0 - uAbBeta * cp);
          float k = clamp(log2(D), -3.0, 3.0);
          vColor = color * vec3(pow(0.62, k), 1.0, pow(1.6, k)) * clamp(D * D, 0.08, 6.0);
          s = size * clamp(sqrt(D), 0.4, 2.2);
        }
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
        gl_PointSize = s * uPixel; }`,
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
  // A custom transmission curve (#66) blends every overlapping survey by its overlap with T(λ) and
  // takes each body's look from curvelook.js. Survey previews show at once, full resolution cross-fades in (#62).
  let band = BANDS[0], pass = null, curve = null; // curve: the #66 curve when it is not one bandpass
  const PAL_RGB = [[1, 1, 1], [1, 0.55, 0.15], [0.3, 0.85, 1], [1, 0.45, 0.2], [1, 1, 1], [0.7, 0.55, 1], [0.4, 0.9, 1], [1, 0.4, 0.9]];
  const skyBandMaterial = () => new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, transparent: true,
    uniforms: { uMap: { value: null }, uPrev: { value: null }, uXf: { value: 1 }, uOpacity: { value: 0 }, uFade: skyMat.uniforms.uFade },
    vertexShader: `varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    // scene (x, y, z) = ecliptic (x, z, −y) → equatorial → RA/Dec; the survey is equirectangular in
    // RA/Dec with RA 0 at the centre, increasing to the left
    fragmentShader: `varying vec3 vDir; uniform sampler2D uMap; uniform sampler2D uPrev; uniform float uXf; uniform float uOpacity; uniform float uFade;
      void main() { vec3 e = vec3(vDir.x, -vDir.z, vDir.y); float ob = 0.40909280;
        vec3 q = vec3(e.x, e.y * cos(ob) - e.z * sin(ob), e.y * sin(ob) + e.z * cos(ob));
        float ra = atan(q.y, q.x), dec = asin(clamp(q.z, -1.0, 1.0));
        vec2 uv = vec2(fract(0.5 - ra / 6.2831853), 0.5 + dec / 3.1415927);
        vec4 t = texture2D(uMap, uv);
        if (uXf < 0.999) t = mix(texture2D(uPrev, uv), t, uXf); // preview → full resolution (#62)
        gl_FragColor = vec4(t.rgb, t.a * uOpacity * uFade); // transparent where the survey has no data
        #include <colorspace_fragment>
      }`,
  });
  const skyGeo = new THREE.SphereGeometry(SKY_R * 0.95, 96, 48);
  const skyBands = []; // one sphere per blended survey
  const skyBandMesh = (i) => {
    if (!skyBands[i]) {
      const m = new THREE.Mesh(skyGeo, skyBandMaterial());
      m.renderOrder = -2 + i * 0.01; m.frustumCulled = false; m.visible = false; m.userData = {};
      scene.add(m); skyBands[i] = m;
    }
    return skyBands[i];
  };
  const STANDALONE_BANDS = import.meta.env?.MODE === 'standalone';
  let skyNow = { layers: [], measured: 0 };
  const bandCurve = () => (curve ?? (band.id === 'full' ? { full: true } : curveFromLegacy(band.id, pass?.id)));

  /** One survey on sphere `mesh` at `opacity`: preview at once, full resolution cross-faded in. */
  function showSurvey(mesh, layer, opacity) {
    const u = mesh.material.uniforms, look = { sky: layer.sky, res: 'loading', label: layer.skyCredit };
    layer.look = look;
    const same = mesh.userData.sky === layer.sky && u.uMap.value;
    mesh.userData.sky = layer.sky; mesh.userData.look = look;
    if (same) { u.uOpacity.value = opacity; look.res = mesh.userData.res ?? 'full'; return; }
    u.uOpacity.value = 0; u.uXf.value = 1;
    const current = () => mesh.userData.look === look;
    let shown = null;
    bandTexture(hipsUrl(layer.sky, 'preview')).then((r) => {
      if (!r || !current() || shown) return;
      u.uMap.value = r.texture; u.uOpacity.value = opacity; shown = 'preview'; look.res = mesh.userData.res = 'preview';
      if (STANDALONE_BANDS) { look.res = mesh.userData.res = 'baked'; const b = bakedHips(layer.sky); if (b) look.label = `${layer.skyCredit} · ${bakedText(b)}`; }
    });
    if (STANDALONE_BANDS) return; // the standalone preview: only its baked copy (#28)
    const full = new Promise((ok) => setTimeout(ok, FULL_DELAY_MS)).then(() => (!current() ? true : bandTexture(hipsUrl(layer.sky)).then((r) => {
      if (!current()) return true;
      if (!r) { look.res = mesh.userData.res = shown ? 'failed-preview' : 'failed'; return null; }
      if (shown) {
        u.uPrev.value = u.uMap.value; u.uXf.value = 0;
        const t0 = performance.now(), step = () => { const k = Math.min(1, (performance.now() - t0) / 600); u.uXf.value = k; if (k < 1) requestAnimationFrame(step); };
        requestAnimationFrame(step);
      }
      u.uMap.value = r.texture; u.uOpacity.value = opacity; shown = 'full'; look.res = mesh.userData.res = 'full';
      return true;
    })));
    bandLoads.track(full, layer.skyCredit);
  }
  // the night sky from a surface (#48): Milky Way, deep-sky objects, constellations
  const skyTexLoader = new THREE.TextureLoader();
  const skyLayers = createSkyLayers({ scene, radius: SKY_R, onPick: (o) => onDeepSky?.(o),
    loadTexture: (url) => (STANDALONE_BANDS ? Promise.resolve(null) : new Promise((res) => skyTexLoader.load(url, (t) => { t.colorSpace = THREE.SRGBColorSpace; res(t); }, undefined, () => res(null)))) });
  let skyClustersAsked = false;

  function applySkyBand() {
    const full = band.id === 'full';
    skyNow = full ? { layers: [], measured: 0 } : curveSkyLayers(bandCurve());
    // the standalone preview draws the surveys it carries baked (#28), re-weighted among themselves
    const baked = STANDALONE_BANDS ? skyNow.layers.filter((L) => bakedHips(L.sky)) : null, bw = baked?.reduce((a, L) => a + L.weight, 0);
    const layers = STANDALONE_BANDS ? baked.map((L) => ({ ...L, weight: L.weight / bw })) : skyNow.layers;
    if (STANDALONE_BANDS) skyNow = { ...skyNow, layers, measured: layers.length ? skyNow.measured * bw : 0 }; // approximately: the share of the overlap the baked surveys carry
    // a running average: layer k drawn at w_k / Σ_{j≤k} w_j over the ones before gives each its weight
    let acc = 0;
    skyBands.forEach((m, i) => { if (i >= layers.length) { m.visible = false; m.userData.look = null; } });
    layers.forEach((L, i) => { acc += L.weight; const m = skyBandMesh(i); m.visible = true; showSurvey(m, L, L.weight / acc); });
    if (!skyBase) return;
    // catalogue stars: shown over a survey only where the survey shows starlight (IR, visible, UV);
    // re-weighted by their blackbody in the band (a custom curve: integrated through T(λ))
    const n = skyBase.mags.length, mags = new Float32Array(n), cols = new Float32Array(n * 3);
    const p = pass ?? band.passes[0], tint = PAL_RGB[paletteIndex(band.palette)], sp = layers.length > 0, prep = curve ? prepare(curve) : null;
    for (let i = 0; i < n; i++) {
      if (prep) {
        const d = curveStarDelta(skyBase.teff[i], prep.f), c = curveStarRgb(skyBase.teff[i], prep, [skyBase.cols[i * 3], skyBase.cols[i * 3 + 1], skyBase.cols[i * 3 + 2]]), mx = Math.max(...c) || 1;
        mags[i] = d === -Infinity || sp ? 99 : skyBase.mags[i] - d;
        cols.set([c[0] / mx, c[1] / mx, c[2] / mx], i * 3);
        continue;
      }
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
    // a custom curve keeps clouds where it is mostly visible light, rings where visible or infrared
    const dom = curve ? band.dominant : band.id;
    for (const id in nodes) {
      const n = nodes[id], u = n.mesh?.material?.uniforms;
      // a cloud shell shows where it is mostly visible light; Venus' deck in every band but radio, which sees the ground (#83)
      if (n.clouds) n.cloudBandOK = n.clouds.userData.opaque ? dom !== 'radio' : full || dom === 'visible';
      if (n.ring && curve && band.id === 'custom') n.ring.visible = full || dom === 'visible' || dom === 'ir'; // a custom curve: visible/IR rings
      else if (n.ring) { // #61: rings by their own measured look in the band (reflected ice, cold microwave, O Kα X-rays)
        const r = ringBandLook(n.body, band, p), t = full ? [1, 1, 1] : r.palette ? PAL_RGB[r.palette] : [1, 1, 1], k = full ? 1 : Math.min(1.6, Math.max(0.12, r.gain));
        n.ring.visible = r.visible; n.ring.material.color?.setRGB(t[0] * k, t[1] * k, t[2] * k);
      }
      if (isStar(n.body)) { applyStarBand(n, p); continue; }
      if (!u?.uBandMode) continue;
      n.bandLook = applyBandToMaterial(u, n.body, band, p);
      if (n.clouds?.material?.uniforms?.uBandMode && !n.clouds.userData.opaque) n.clouds.material.uniforms.uBandMode.value = 0;
    }
    applySkyBand();
  }
  /** An SDO frame on the Sun's disc, preview first (#62). */
  function showSunFeed(n, u, feed, look) {
    // #72: a map that fails to load (today's SRH) gives way to its fallback (archival Nobeyama), labelled as such
    const fb = look.fallback, onFail = fb ? () => { n.bandLook = fb; if (u.uBandMix) u.uBandMix.value = fb.mix; showSunFeed(n, u, fb.feed, fb); } : null;
    progressiveFeed(feed, look, () => n.bandLook === look, (l) => { u.uDisk.value = l.texture; u.uHasDisk.value = 1; u.uBandDisk.value = 1; if (l.disk) u.uDiskR.value = l.disk; feedCredit(look, l); }, onFail);
  }
  function applyStarBand(n, p) {
    const u = n.mesh?.material?.uniforms;
    if (!u?.uBandTint) return;
    // the additive glare follows the disc's brightness in the band
    const glare = n.mesh.children?.find((c) => c.isSprite);
    const setGlare = () => { if (glare) { const t = u.uBandTint.value; glare.material.opacity = glare.userData.base = 0.85 * Math.min(1, Math.max(t.r, t.g, t.b)); glare.material.color.set(band.id === 'full' ? n.body.color ?? 0xffffff : 0xffffff).multiply(band.id === 'full' ? new THREE.Color(1, 1, 1) : t.clone().multiplyScalar(1 / Math.max(1e-3, Math.max(t.r, t.g, t.b)))); } };
    queueMicrotask(setGlare);
    n.corona?.setBand(band, p); // #79: the 3D corona's look follows the band too
    u.uBandDisk.value = 0;
    if (band.id === 'full') { u.uBandTint.value.setRGB(1, 1, 1); n.bandLook = null; restoreStarDisk(n); return; }
    const sol = model.isSol && n.body.id === model.starId;
    if (sol) { // the Sun: the same look as the Star View (starband.js): its maps by bandpass id, or by `range` overlap for a custom curve, weighted (#28)
      const s = starBandLook({ teff: n.body.teffK ?? 5772, isSun: true, hasFeed: (id) => !STANDALONE_BANDS || !!bakedFeed(id) }, band, p);
      n.bandLook = s;
      u.uBandTint.value.setRGB(...s.tint);
      if (s.feed) { if (u.uBandMix) u.uBandMix.value = s.mix; showSunFeed(n, u, s.feed, s); return; }
      restoreStarDisk(n);
      return;
    }
    if (curve) { // a custom curve (#66): the photosphere through T(λ)
      const s = starCurveLook(n.body.teffK ?? 5772, prepare(curve), n.body.name);
      u.uBandTint.value.setRGB(...s.tint); n.bandLook = s.look;
      return;
    }
    const tint = PAL_RGB[paletteIndex(band.palette)];
    const teff = n.body.teffK ?? 5772, d = starBandDelta(teff, p);
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
    let mesh, clouds = null, ringMesh = null, corona3d = null;
    if (body.marker) return addMarker(body);
    if (body.kind === 'satellite' || body.kind === 'spacecraft') return addSatelliteNode(body);
    const placeholder = planetTexture(isStar(body) ? { id: body.id, banded: body.banded, palette: ['#d9a35a', '#f2c879', '#b97a3a'] } : body);
    if (isStar(body)) {
      mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), starMaterial(placeholder, body.color, body.skin?.recolour));
      loadTexture(body.skin?.map).then((t) => { if (t) mesh.material.uniforms.uMap.value = t; });
      if (body.skin?.live) liveTargets.push({ id: body.id, material: mesh.material, skin: body.skin });
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: body.color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.85 }));
      glow.scale.setScalar(6);
      glow.userData.base = 0.85;
      mesh.add(glow);
      if (model.isSol && body.id === model.starId) { // #79: the 3D corona, in the Sun's own frame (y = its rotation axis)
        corona3d = createCorona();
        corona3d.setBand(band, pass ?? band.passes[0] ?? null);
        mesh.add(corona3d.mesh);
        loadCoronaFeed();
      }
    } else {
      const mat = planetMaterial(placeholder, { tint: body.skin?.tint, dem: !!model.isSol }); // #80: relief from the body's DEM, if it has one
      mat.userData.host = body.orbit?.host ?? model.starId;
      mat.userData.body = body.id;
      // #83: a world whose globe shows its clouds (Venus) draws its ground under them, on its own map
      const groundMap = model.isSol ? body.skin?.ground : null;
      applySkin(mat, groundMap ? { ...body.skin, map: groundMap } : body.skin);
      if (groundMap && body.skin.groundRadar) mat.uniforms.uRadar.value = 1;
      if (body.skin?.live) liveTargets.push({ id: body.id, material: mat, skin: body.skin });
      mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 48), mat);
      lit.push(mat);
      if (body.skin?.clouds || groundMap) {
        // #83: the shell at the layer's height (Venus 70 km, measured; Earth 10 km, assumed); an opaque deck
        // (Venus) carries the globe's own map and shares its spectrum-filter look
        const layer = model.isSol ? cloudLayer(body.id) : null, opaque = !!groundMap;
        const cm = cloudMaterial(placeholder, { opaque });
        cm.userData.host = mat.userData.host;
        cm.userData.body = body.id;
        clouds = new THREE.Mesh(new THREE.SphereGeometry(layer ? 1 + layer.shellKm / body.radiusKm : 1.012, 96, 48), cm);
        clouds.userData = { layer, opaque, staticTex: null, radiusKm: body.radiusKm };
        if (layer?.slicesKm && !opaque) addCloudSlices(clouds, layer, body.radiusKm); // #83: Earth's cloud volume, stacked slices
        if (opaque) {
          for (const k of BAND_UNIFORMS) cm.uniforms[k] = mat.uniforms[k];
          loadTexture(body.skin.map).then((t) => { if (t) cm.uniforms.uMap.value = t; });
        } else {
          cm.uniforms.uMap.value = new THREE.Texture(); // invisible until the cloud map arrives
          loadTexture(body.skin.clouds).then((t) => { if (t) { clouds.userData.staticTex = t; if (!clouds.userData.live) cm.uniforms.uMap.value = t; } });
        }
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
    // #37: landing, impact and rover sites on this globe
    const sites = model.isSol && !isStar(body) ? createSiteLayer(body, { onSite: (s) => onSite?.(s), loadTraverse: fetchTraverse, loadModel: async (id) => { const m = await loadCraftModel(id); if (m) inspectCraft(m); return m; } }) : null;
    if (sites) tilt.add(sites.group);
    // IAU named features (craters, montes, valles…) on worlds with a surface
    const features = model.isSol && !isStar(body) && !['jupiter', 'saturn', 'uranus', 'neptune', 'earth'].includes(body.id)
      ? createFeatureLayer(body, { onFeature: (f) => onFeature?.(f), load: fetchFeatures }) : null;
    if (features) tilt.add(features.group);
    const color = body.kind === 'moon' ? 0x8899aa : body.orbit?.type === 'elements' ? (body.kind === 'comet' ? 0x66ccff : 0xaa9977) : orbitColor(body, i);
    nodes[body.id] = { body, group, tilt, mesh, clouds, ring: ringMesh, label, pos: new THREE.Vector3(), orbit: null, orbitJd: null, color, axis, comet, sites, features, corona: corona3d };
    if (model.isSol && !isStar(body)) relief.attach(nodes[body.id]);
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
      n.sites?.dispose();
      n.features?.dispose();
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
    clearTransfer();
    magFields = null; // its objects hung on the old nodes, disposed by clear()
    radioBelts = null; // likewise (#61)
    model = m;
    tree = m.binary ? hierarchy(m.binary.orbits, m.binary.mass) : null;
    m.bodies.forEach(addBody);
    trek.load(m);
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
    helm?.onLoad(); // after an interstellar jump the ship drops out of warp at the edge of the new system
    // #42: build the ship and compile its shaders in the background, so TAKE THE HELM does not stall on them
    setTimeout(() => { if (helm && !helm.active) helm.prewarm(renderer); }, 2500);
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
        pts = au.map((p) => toScene(p.length > 3 ? p.slice(1) : p)); node.trackDone = true; // rows are [jd, x, y, z] AU
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
  /**
   * Planetshine (#49): each moon of a planet in PLANETSHINE gets a second light from its parent,
   * p·(R/d)²·Φ(α) of its sunlight (true geometry), shown through planetshineDisplay's exposure.
   */
  const psState = {}; // moon id → { f, alpha, parent } for panels and the surface view
  function planetshineAt(id, jd) { // call with unmapped = true
    const b = nodes[id]?.body, spec = b?.kind === 'moon' && PLANETSHINE[b.parent];
    if (!spec || !nodes[b.parent]) return null;
    const P = scenePosition(b.parent, jd, new THREE.Vector3()), M = scenePosition(id, jd, new THREE.Vector3()).sub(P), S = scenePosition(model.starId, jd, new THREE.Vector3()).sub(P);
    const alpha = angleBetween(S.toArray(), M.toArray());
    return (psState[id] = { f: planetshineFraction(spec.p, nodes[b.parent].body.radiusKm, M.length() * AU_KM, alpha), alpha, parent: b.parent, name: spec.name, spec });
  }
  function updatePlanetshine(jd) {
    if (!model?.isSol) return;
    unmapped = true;
    try {
      for (const m of lit) {
        const st = planetshineAt(m.userData.body, jd);
        if (!st) continue;
        const { f, spec } = st, b = nodes[m.userData.body].body;
        const k = settings.get('planetshine') === false ? 0 : planetshineDisplay(f);
        m.uniforms.uPsCol.value.setRGB(spec.tint[0] * k, spec.tint[1] * k, spec.tint[2] * k);
        m.uniforms.uAmbient.value = k > 0 ? 0.008 : 0.035; // the fake ambient gives way to the real light
        m.uniforms.uPsPos.value.copy(nodes[b.parent].pos).add(root.position);
      }
    } finally { unmapped = false; }
  }
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

  // ---- magnetic fields (#38) ---------------------------------------------------------------------
  let magFields = null;
  let radioBelts = null; // #61
  const magTmp = new THREE.Vector3(), magTmp2 = new THREE.Vector3();
  function updateMagFields(jd, now) {
    if (!model?.isSol) return;
    const show = !!settings.get('fields') && !surface;
    if (!magFields && !show) return;
    magFields ??= createMagFields({
      radial: (body, r) => localMap(body, magTmp.set((r * body.radiusKm) / AU_KM, 0, 0)).length() / displayRadius(body),
      toDisplayAU: (body, km) => localMap(body, km.clone().multiplyScalar(1 / AU_KM)),
      upstream: (body, id) => {
        if (id === 'ganymede') { // the corotating plasma overtakes Ganymede: upstream is its trailing side
          scenePosition(id, jd + 0.01, magTmp2).sub(scenePosition(id, jd, magTmp));
          return magTmp2.clone().negate().normalize();
        }
        return nodes[model.starId].pos.clone().sub(nodes[id].pos).normalize();
      },
    });
    magFields.update(nodes, show, `${scaleMix.toFixed(3)}|${model.scale}`, now);
  }

  // ---- transfer orbits (#45) -------------------------------------------------------------------
  // The computed Lambert arc (dashed), departure and arrival markers, a ghost craft riding it while
  // the clock is inside the flight, and optionally a real mission's Horizons track to compare.
  let transferViz = null;
  function clearTransfer() {
    if (!transferViz) return;
    for (const o of transferViz.objs) { root.remove(o); o.geometry?.dispose(); o.material?.dispose(); o.element?.remove(); }
    transferViz = null;
  }
  function setTransfer(spec) {
    clearTransfer();
    if (!(spec?.x || spec?.track?.length) || !model?.isSol) return;
    const { x } = spec, objs = [];
    const toV = (p) => toScene(p, new THREE.Vector3());
    // a computed transfer, or a published track (Horizons rows [jd TDB, x, y, z] AU)
    const arcPts = x ? transferArc(x, 160).map(toV) : spec.track.map((r) => toV(r.slice(1)));
    const span = x ? { from: x.depJd, to: x.arrJd } : { from: spec.track[0][0] - 69.184 / 86400, to: spec.track.at(-1)[0] - 69.184 / 86400 };
    const colour = spec.ghost ? 0xcc99cc : 0xff9900;
    const seg = [];
    for (let i = 1; i < arcPts.length; i += 2) seg.push(...arcPts[i - 1].toArray(), ...arcPts[i].toArray()); // every other step: a dashed look
    const arc = new LineSegments2(new LineSegmentsGeometry().setPositions(seg), new LineMaterial({ color: colour, linewidth: 2.6, transparent: true, opacity: 0.95, depthWrite: false, resolution: fat.resolution }));
    arc.frustumCulled = false; arc.renderOrder = 3;
    objs.push(arc);
    if (spec.compare?.length) {
      const cmp = new THREE.Line(new THREE.BufferGeometry().setFromPoints(spec.compare.map((p) => toV(p.length > 3 ? p.slice(1) : p))), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false }));
      cmp.frustumCulled = false; objs.push(cmp);
    }
    const tag = (text, cls) => { const el = document.createElement('div'); el.className = `nav-label mission-label ${cls}`; el.textContent = text; const o = new CSS2DObject(el); objs.push(o); return o; };
    const dot = (color, size) => { const p = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3)), new THREE.PointsMaterial({ color, size, sizeAttenuation: false, depthWrite: false })); p.frustumCulled = false; objs.push(p); return p; };
    const iso = (jd) => new Date((jd - 2440587.5) * 86400000).toISOString().slice(0, 10);
    const dep = dot(0x99ccff, 8), arr = dot(0xff9966, 8), craft = dot(colour, 9);
    dep.position.copy(arcPts[0]); arr.position.copy(arcPts.at(-1));
    const depTag = tag(spec.depText ?? (x ? `DEPART EARTH ${iso(span.from)}` : `TRACK FROM ${iso(span.from)}`), 'site'), arrTag = tag(spec.arrText ?? (x ? `ARRIVE ${iso(span.to)}` : `TO ${iso(span.to)}`), 'site'), craftTag = tag('', spec.ghost ? 'ghost' : 'transfer');
    depTag.position.copy(arcPts[0]); arrTag.position.copy(arcPts.at(-1));
    for (const m of spec.marks ?? []) { // e.g. gravity-assist flybys (#45): a dot and a tag where the route meets the planet
      const p = toV(m.p), d = dot(0xffcc66, 8); d.position.copy(p);
      tag(m.text, 'site').position.copy(p);
    }
    for (const o of objs) root.add(o);
    transferViz = { x, spec, span, objs, craft, craftTag };
  }
  /** Position (AU) on the drawn transfer or track at `jd`, or null outside it. */
  function transferVizPosition(jd) {
    if (!transferViz) return null;
    const { x, spec, span } = transferViz;
    if (x) return transferPosition(x, jd);
    if (jd < span.from || jd > span.to) return null;
    const t = spec.track, j = jd + 69.184 / 86400;
    let i = 1;
    while (i < t.length - 1 && t[i][0] < j) i++;
    const a = t[i - 1], b = t[i], f = (j - a[0]) / (b[0] - a[0] || 1);
    return [1, 2, 3].map((k) => a[k] + (b[k] - a[k]) * f);
  }
  function updateTransfer(jd) {
    if (!transferViz) return;
    const { craft, craftTag, spec, span } = transferViz;
    const p = transferVizPosition(jd), on = !!p && !surface;
    craft.visible = craftTag.visible = on;
    if (on) {
      toScene(p, craft.position); craftTag.position.copy(craft.position);
      craftTag.element.textContent = `${spec.label ?? 'TRANSFER'} · DAY ${Math.floor(jd - span.from)} OF ${Math.round(span.to - span.from)} · ${(spec.tier ?? 'computed').toUpperCase()}`;
    }
  }

  // ---- mission activity from the events feed (#32) ---------------------------------------------
  let missions = null, missionEvents = [], satrecFor = () => null;
  const missionMap = (km) => localMap(nodes.earth.body, toScene(km, new THREE.Vector3()).multiplyScalar(1 / AU_KM)).add(nodes.earth.pos);
  function stationState(norad, jd) {
    const rec = satrecFor(norad), st = rec && stateAt(rec, jd);
    if (!st) return null;
    const P = precessionToJ2000(jd);
    return { r: temeToEcliptic(st.position, P), v: temeToEcliptic(st.velocity, P) };
  }
  function updateMissions(jd) {
    if (!model?.isSol || !nodes.earth) { missions?.update(jd, false); return; }
    if (!missions) { missions = createMissionLayer({ root, fat, map: missionMap, stationState }); missions.setEvents(missionEvents); }
    missions.update(jd, !surface && settings.get('missions') !== false);
  }

  // ---- focus & camera flight ---------------------------------------------------------
  let focusId = 'sun';
  let helm = null; // HELM (#42), created with the camera rig below
  let flight = null; // { from: Vector3 (scene), t0, dur, d0 }
  // VIEW FROM ABOVE (#37): the camera hovers over a surface site, orbiting it rather than the body's centre
  let siteView = null; // { id, lat, lon, spanKm, ready, last: Vector3, r }
  const siteWorld = (n, lat, lon, out) => { const g = n.sites?.group ?? n.tilt; g.updateWorldMatrix(true, false); return out.set(...siteDir(n.body, lat, lon)).applyMatrix4(g.matrixWorld); };
  function endSiteView() { if (!siteView) return; siteView = null; controls.target.set(0, 0, 0); }
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

  function flyTo(id, { overview = null, distance = null, dir = null } = {}) {
    if (!nodes[id]) return;
    if (helm?.active) helm.disengage({ quiet: true }); // a survey, a site or LOOK AT takes the camera from the helm
    if (surface) exitSurface(false);
    endSiteView();
    if (overview == null && nodes[id].body.marker) overview = markerView(nodes[id].body);
    // #39: honour prefers-reduced-motion; `distance` overrides the landing distance (FILL VIEW), `dir` turns the view (RESET)
    flight = { from: focusPos.clone(), t0: performance.now(), dur: reducedMotion() ? 1 : 1600, d0: camera.position.length(), d1: distance,
      dir0: dir ? camera.position.clone().normalize() : null, dir1: dir ? dir.clone().normalize() : null };
    controls.target.set(0, 0, 0); // zoom-to-cursor may have moved it off the focus
    focusId = id;
    anchorId = id;
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
    return ray.intersectObjects(pickables, false).find((hit) => shown(hit.object)); // nothing hidden (DETAIL slider, far moons) is clickable
  };
  const shown = (o) => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
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
  // #80: the height under the pointer (panel read-out and a tag by the cursor), from the body's DEM
  const elevTag = Object.assign(document.createElement('div'), { className: 'elev-tag' });
  elevTag.hidden = true;
  container.appendChild(elevTag);
  let elevAt = 0, elevLast = null;
  labels.domElement.addEventListener('pointermove', (e) => {
    if (performance.now() - elevAt < 70) return;
    elevAt = performance.now();
    const hit = !surface && !e.buttons ? pick(e) : null;
    const id = hit?.object?.userData?.id, n = id && nodes[id];
    let out = null;
    if (n && hit.object === n.mesh && relief.has(id)) {
      const d = hit.object.worldToLocal(hit.point.clone()).normalize();
      const r = relief.elevationAtDir(id, d.toArray(), 99, false);
      if (r) out = { id, ...r };
    }
    if (out || elevLast) onElevation?.(out);
    elevLast = out;
    if (out && Number.isFinite(out.h)) {
      const rect = container.getBoundingClientRect();
      elevTag.textContent = `${fmtElevation(out.h)} · ${out.meta.name.split(' ').slice(0, 3).join(' ').toUpperCase()}`;
      elevTag.style.left = `${e.clientX - rect.left + 14}px`; elevTag.style.top = `${e.clientY - rect.top + 12}px`;
      elevTag.hidden = false;
    } else elevTag.hidden = true;
  });
  labels.domElement.addEventListener('pointerleave', () => { elevTag.hidden = true; if (elevLast) onElevation?.(null); elevLast = null; });
  labels.domElement.addEventListener('dblclick', (e) => {
    if (surface) { zoomOnDisc(e); return; }
    if (helm?.active) return; // at the helm a double-click is two steering clicks, not a landing
    clearTimeout(clickTimer);
    const hit = pick(e);
    if (!hit) return;
    const id = hit.object.userData.id, n = nodes[id];
    if (n && isStar(n.body)) { onDrillStar?.(id); return; } // drill down: a star opens its Star View
    if (!n || n.body.marker || n.body.kind === 'satellite' || n.body.kind === 'spacecraft') { flashHud('NO SURFACE HERE'); return; }
    const local = hit.object.worldToLocal(hit.point.clone());
    const normal = hit.face ? hit.face.normal.clone() : local.clone().normalize();
    enterSurface(id, { object: hit.object, local, normal, layer: 'clouds' }); // #83: on Venus and Earth, on top of the clouds
  });

  // ---- surface view: stand where you double-clicked and look up ---------------------------
  // The camera sits 2 m above the surface, turns with the body, and starts at the zenith.
  // TRUE scale while standing (the sky must be real); drag to look around, wheel to zoom.
  let surface = null, skyGlare = null; // { id, object, local (object frame), normal (object frame), az, alt, fov, prevScale, sphere }
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
  // field-of-view presets and the optional (labelled) enlarged Sun and Moon (#47)
  const hudFov = document.createElement('div');
  hudFov.className = 'surface-presets';
  const presetBtns = FOV_PRESETS.map((p) => {
    const b = Object.assign(document.createElement('button'), { className: 'pill', textContent: `${p.label} ${p.deg}°`, title: p.note });
    b.addEventListener('click', () => { if (surface) { surface.fov = presetFov(p, camera.aspect); surface.preset = p.id; } });
    return b;
  });
  const hudBig = Object.assign(document.createElement('button'), { className: 'pill', textContent: 'TRUE SIZE', title: 'Sun and Moon at their true angular size. Click to enlarge them ×4 (labelled IMAGINED) for visibility.' });
  hudBig.addEventListener('click', () => { if (surface) surface.enlarge = surface.enlarge === 1 ? 4 : 1; });
  hudFov.append(...presetBtns, hudBig);
  // from a moon: find the parent planet (#49)
  const hudPlanet = Object.assign(document.createElement('button'), { className: 'pill', hidden: true });
  hudPlanet.addEventListener('click', () => { if (surface) surface.lookParent = true; });
  const planetArrow = Object.assign(document.createElement('div'), { className: 'edge-beacon planet-arrow', hidden: true });
  planetArrow.innerHTML = '<span class="arrow">▲</span><span class="txt"></span>';
  container.appendChild(planetArrow);
  const parentTag = (() => { const el = document.createElement('div'); el.className = 'nav-label host parent-tag'; const o = new CSS2DObject(el); o.center.set(-0.08, 0.5); o.visible = false; scene.add(o); return o; })();
  // LOOK AT (#43): what you're looking at, and buttons to re-track it, go naked-eye, or toggle light-time
  const hudLook = document.createElement('div');
  hudLook.className = 'surface-look';
  const hudTrack = Object.assign(document.createElement('button'), { className: 'pill', textContent: '⌖ TRACK', title: 'Keep the target centred' });
  hudTrack.addEventListener('click', () => { if (surface?.look) { surface.look.track = true; } });
  const hudFit = Object.assign(document.createElement('button'), { className: 'pill', textContent: '⤢ FIT TARGET', title: 'Zoom so the target fills a quarter of the field' });
  hudFit.addEventListener('click', () => { if (surface?.look) surface.look.fitted = false; });
  const hudLt = Object.assign(document.createElement('button'), { className: 'pill', textContent: 'APPARENT', title: 'Apparent: where it was when its light left (as astronomers see it). Geometric: where it is now.' });
  hudLt.addEventListener('click', () => { if (surface?.look) { surface.look.apparent = !surface.look.apparent; hudLt.textContent = surface.look.apparent ? 'APPARENT' : 'GEOMETRIC'; } });
  const hudLookBtns = document.createElement('div');
  hudLookBtns.className = 'surface-look-btns';
  hudLookBtns.append(hudTrack, hudFit, hudLt); // field presets (NAKED EYE … TELESCOPE) are in the #47 row
  // #83: Venus and Earth: a cloud layer above the ground: DESCEND through it, ASCEND back to the tops
  const hudLayer = document.createElement('div');
  hudLayer.className = 'surface-layer';
  const hudDescend = Object.assign(document.createElement('button'), { className: 'pill', textContent: '▼ DESCEND TO THE GROUND', hidden: true, title: 'Down through the clouds to the real ground, 2 m above it' });
  hudDescend.addEventListener('click', () => descend('down'));
  const hudAscend = Object.assign(document.createElement('button'), { className: 'pill', textContent: '▲ ASCEND TO THE CLOUD TOPS', hidden: true });
  hudAscend.addEventListener('click', () => descend('up'));
  hud.append(hudText, hudSub, hudLayer, hudLook, hudBack, hudDescend, hudAscend, hudSun, hudPlanet, hudLookBtns, hudFov);
  container.appendChild(hud);
  const flash = Object.assign(document.createElement('div'), { className: 'surface-flash' });
  flash.hidden = true;
  container.appendChild(flash);
  // a large gauge in the view's bottom-right corner while DESCEND / ASCEND is flying: the camera on a tape from the
  // ground to the cloud tops (the flight's log scale), the cloud deck on it, altitude, rate and time to arrival
  const gauge = Object.assign(document.createElement('div'), { className: 'descent-gauge', hidden: true });
  const gEl = (cls, parent = gauge, text = '') => { const el = Object.assign(document.createElement('div'), { className: cls, textContent: text }); parent.appendChild(el); return el; };
  const gHead = gEl('dg-head'), gBody = gEl('dg-body'), gTape = gEl('dg-tape', gBody);
  const gDeck = gEl('dg-deck', gTape), gFill = gEl('dg-fill', gTape), gMark = gEl('dg-mark', gTape);
  gEl('dg-end dg-top', gTape, 'TOPS'); gEl('dg-end dg-gnd', gTape, 'GROUND');
  const gRead = gEl('dg-read', gBody), gAlt = gEl('dg-alt', gRead);
  gEl('dg-lbl', gRead, 'ABOVE THE GROUND ').appendChild(badge('computed', 'The camera height over the measured ground (DEM).'));
  const gRate = gEl('dg-rate', gRead);
  gEl('dg-lbl', gRead, 'FLIGHT RATE ').appendChild(badge('imagined', 'How fast the app flies you down or up: time-compressed so the trip takes about half a minute, eased on a log scale (slower near the ground). Not a real lander\'s descent (Venera took ~1 hour).'));
  const gEta = gEl('dg-eta', gRead);
  container.appendChild(gauge);
  let gaugeDone = null; // { phase, at } for a few seconds after arriving
  const gKm = (x) => (x >= 10 ? `${x.toFixed(1)} KM` : x >= 1 ? `${x.toFixed(2)} KM` : `${Math.round(x * 1000).toLocaleString('en-US')} M`);
  function updateGauge(s) {
    const now = performance.now() / 1000;
    const col = s?.col, ref = s?.groundRefKm ?? 0;
    const g = s?.descent ? descentGauge(s.descent, now, col ? { baseKm: Math.max(0, col.baseKm - ref), topKm: Math.max(0, col.topKm - ref) } : null) : null;
    if (g?.moving) gaugeDone = null;
    else if (g && gauge.dataset.phase && gauge.dataset.phase !== g.phase && (gauge.dataset.phase === 'down' || gauge.dataset.phase === 'up')) gaugeDone = { phase: g.phase, at: now };
    const show = !!g && (g.moving || (gaugeDone && now - gaugeDone.at < 4));
    gauge.hidden = !show;
    if (!g) { gauge.dataset.phase = ''; return; }
    gauge.dataset.phase = g.phase;
    if (!show) return;
    gauge.classList.toggle('up', g.phase === 'up' || g.phase === 'top');
    gauge.classList.toggle('arrived', !g.moving);
    gHead.textContent = g.phase === 'down' ? '▼ DESCENDING' : g.phase === 'up' ? '▲ ASCENDING' : g.phase === 'ground' ? '■ TOUCHDOWN' : '■ AT THE CLOUD TOPS';
    const pct = (f) => `${(f * 100).toFixed(2)}%`;
    gMark.style.bottom = pct(g.frac); gFill.style.height = pct(g.frac);
    gDeck.hidden = !g.deck;
    if (g.deck) { gDeck.style.bottom = pct(g.deck.base); gDeck.style.height = pct(Math.max(0.01, g.deck.top - g.deck.base)); }
    gAlt.textContent = gKm(g.altKm);
    const v = Math.abs(g.vKmS);
    gRate.textContent = !g.moving ? '0 M/S' : `${g.vKmS < 0 ? '▼' : '▲'} ${v >= 1 ? `${v.toFixed(2)} KM/S` : `${Math.round(v * 1000).toLocaleString('en-US')} M/S`}`;
    gEta.textContent = g.moving ? `${g.phase === 'down' ? 'GROUND' : 'CLOUD TOPS'} IN ${Math.ceil(g.etaS)} S` : g.phase === 'ground' ? '2 M ABOVE THE GROUND' : 'ABOVE THE CLOUD DECK';
  }
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

  /** #83: start descending ('down') or ascending ('up') through the cloud layer; false where there is none. */
  function descend(dir) {
    if (!surface?.descent) return false;
    surface.descent = startDescent(surface.descent, dir, performance.now() / 1000, cloudLayer(surface.id).descentS);
    return true;
  }
  let murkVeil = null;
  /** Undo the under-cloud light and fog on a body's ground (shared by its globe and terrain patch). */
  function resetLayerLight(id) {
    murkVeil?.hide();
    const u = nodes[id]?.mesh?.material?.uniforms;
    if (!u?.uSkyAmb) return;
    u.uSunColor.value.setRGB(1.3, 1.3, 1.3); u.uSkyAmb.value.setRGB(0, 0, 0); u.uFogK.value = 0;
  }
  let layerHudAt = 0;
  /** The layer read-outs, each with its provenance badge (rebuilt a few times a second). */
  function layerHud(s, r, aboveKm, look) {
    hudLayer.hidden = !r;
    if (!r || performance.now() - layerHudAt < 200) return;
    layerHudAt = performance.now();
    const venus = s.id === 'venus', L = r.layer, n = nodes[s.id];
    const km = (x) => (x >= 10 ? `${x.toFixed(1)} KM` : x >= 1 ? `${x.toFixed(2)} KM` : `${Math.round(x * 1000).toLocaleString('en-US')} M`);
    const p = venus ? `${r.pBar >= 10 ? r.pBar.toFixed(1) : r.pBar >= 0.1 ? r.pBar.toFixed(2) : r.pBar.toPrecision(2)} BAR` : `${Math.round(r.pBar * 1000).toLocaleString('en-US')} HPA`;
    const live = n?.clouds?.userData?.live;
    const rows = [
      [`ALTITUDE ${km(aboveKm)} ABOVE THE GROUND · ${km(Math.abs(r.altKm))} ${r.altKm < 0 ? 'BELOW' : 'ABOVE'} ${venus ? 'THE 6,052 KM SPHERE (VIRA)' : 'SEA LEVEL'}`, 'computed', 'From the camera height over the DEM ground and the measured ground height.'],
      [`${p} · ${Math.round(r.tC)} °C (${Math.round(r.tK)} K) · ${venus ? 'VIRA: PIONEER VENUS + VENERA' : 'US STANDARD ATMOSPHERE 1976'}`, 'measured',
        venus ? `${r.source}: a reference profile built from the probes' measurements, interpolated by altitude (log pressure); not a reading for this spot today.` : `${r.source}: the reference mid-latitude profile built from balloon and rocket measurements; today's air here differs with the weather.`],
      venus ? [`CLOUD DECK ${L.baseKm}–${L.topKm} KM, HAZE TO ${L.hazeTopKm} KM · SUPER-ROTATING WESTWARD IN ~${L.superRotationDays} DAYS (THE GROUND: 243 DAYS)`, 'measured', L.note]
        : s.colMeasured && s.cloudTop != null ? [`CLOUD TOP HERE ${s.cloudTop.toFixed(2)} KM (NOAA-20 VIIRS, ${n.clouds.userData.measured}) · BASE ~${r.col.baseKm.toFixed(1)} KM`, 'measured', 'Cloud-top height from the VIIRS cloud product via NASA GIBS (50 m bins). The cloud base is MODELLED: the top less 45% of its height, 0.8–4 km thick; the product has no base.']
          : s.colMeasured ? ['NO CLOUD TOP RETRIEVED OVER THIS SPOT: CLEAR SKY THAT DAY', 'measured', 'The VIIRS cloud mask found no cloud here; bright ground (snow, ice) is not drawn as cloud.']
            : [`CLOUDS DRAWN FROM ${L.baseKm} TO ${L.topKm} KM: ASSUMED HEIGHTS`, 'modelled', L.note],
      !venus ? [n.clouds?.userData?.measured ? `CLOUDS: NOAA-20 VIIRS TRUE COLOUR AND CLOUD-TOP HEIGHT, ${n.clouds.userData.measured} (NASA GIBS)` : live ? `CLOUDS: TODAY'S SATELLITE MOSAIC (${(liveState.earth?.feed ?? 'GIBS').toUpperCase()}, NASA GIBS), PICKED OUT BY WHITENESS` : 'CLOUDS: BLUE MARBLE 2004 (MODIS), DRIFTED', 'measured',
        n.clouds?.userData?.measured ? 'Where cloud is: the VIIRS cloud-top product (pixels with a retrieval); how dense: whiteness in the same overpasses\' true colour. Snow and ice have no cloud top, so they are not drawn as cloud.' : live ? 'Where the clouds are is measured (whiteness); persistent ice sheets and high snow are held back by a MODELLED prior (latitude, ice-sheet outlines, height above 4–5 km); elsewhere snow can still read as cloud.' : 'Where the clouds are is measured (2004); snow and ice can read as cloud.'] : null,
      venus ? ['GROUND: MAGELLAN RADAR ON MAGELLAN ALTIMETRY, COLOURED AFTER VENERA 13/14', 'modelled', 'Radar brightness (roughness) is not colour: rock colours from the Venera 13/14 lander images; heights and radar brightness MEASURED (Magellan, USGS Astrogeology).'] : null,
      venus && look && !look.sunVisible ? [`LIGHT ~${Math.max(1, Math.round(r.light * 100))}% OF THE SUNLIGHT ABOVE THE CLOUDS · ORANGE, NO SUN DISC${look.where === 'below' ? ` · VISIBILITY ~${Math.round(visibilityKm(look.fogK))} KM` : ''} · EXPOSURE ADAPTED`, 'modelled', 'Venera 11–14 and Pioneer Venus measured ~2–3% of the sunlight at the ground, reddened; visibility from Rayleigh scattering in the dense CO₂.'] : null,
    ].filter(Boolean);
    hudLayer.replaceChildren(...rows.map(([t, tier, d]) => { const el = document.createElement('div'); el.append(document.createTextNode(`${t} `), badge(tier, d)); return el; }));
  }
  function enterSurface(id, { object, local, normal, layer = 'ground' }) {
    if (helm?.active) helm.disengage({ quiet: true }); // standing on a surface takes the camera from the helm (#42)
    siteView = null;
    const n = nodes[id];
    if (!n) return;
    const sphere = object === n.mesh;
    if (surface) resetLayerLight(surface.id);
    surface = { id, object, local, normal: sphere ? local.clone().normalize() : normal.normalize(), az: 0, alt: 90, fov: 70,
      prevScale: settings.get('scale'), sphere, frame: null, enlarge: 1, preset: null, sizes: null,
      descent: sphere && model.isSol && cloudLayer(id) ? createDescent(id, { at: layer === 'clouds' ? 'top' : 'ground' }) : null, layerLook: null };
    scaleMix = 1; // TRUE scale at once: an easing disc would be the wrong size for its first seconds
    flight = null;
    focusId = id;
    anchorId = id; // FREE MOVE resumes from this body when we leave the surface
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
    gauge.hidden = true; gauge.dataset.phase = ''; gaugeDone = null;
    hudLook.textContent = '';
    for (const c of [...compass, zenithTag, parentTag]) c.visible = false;
    planetArrow.hidden = true;
    resetLayerLight(s.id);
    skyMat.uniforms.uFade.value = 1;
    scene.background = null;
    skyGlare?.hide();
    const g = nodes[model?.starId]?.mesh?.children?.find((ch) => ch.isSprite);
    if (g) g.visible = true;
    camera.fov = 50; camera.updateProjectionMatrix();
    camera.up.set(0, 1, 0);
    controls.enabled = rig.mode === 'orbit';
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
    if (surface.look && !surface.look.orbit) surface.look.track = false; // looking around: ⌖ TRACK brings it back
    const k = surface.fov / container.clientHeight;
    surface.az = (surface.az - (e.clientX - lookDrag[0]) * k + 360) % 360;
    surface.alt = Math.max(-15, Math.min(90, surface.alt + (e.clientY - lookDrag[1]) * k));
    lookDrag = [e.clientX, e.clientY];
  });
  labels.domElement.addEventListener('wheel', (e) => {
    if (!surface) return;
    e.preventDefault();
    surface.fov = Math.max(surface.look ? 0.02 : 0.2, Math.min(110, surface.fov * Math.exp(e.deltaY * 0.001)));
    surface.preset = null;
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
      if (s.layerLook && !s.layerLook.bodiesVisible) show = false; // under Venus' deck: no Sun, no sky (#83)
      if (s.look?.target === id) show = true; // LOOK AT: the target is always drawn (even a spacecraft or a far moon)
      n.group.visible = show;
      n.label.visible = show;
    }
    if (parentTag.visible && nodes[here.parent]) nodes[here.parent].label.visible = false; // its fuller tag stands in (#49)
  }
  /**
   * From a moon (#49): the parent planet's label with size and phase, an arrow at the screen edge
   * when it is out of view, LOOK AT, and where it cannot be seen (below the horizon, or never from
   * the far side of a tidally locked moon).
   */
  function updateParentFinder(s, n, p, f, sunPos, disc) {
    const b = n.body, pn = b.kind === 'moon' && nodes[b.parent];
    hudPlanet.hidden = !pn;
    if (!pn || !disc) { parentTag.visible = false; planetArrow.hidden = true; s.parentNote = null; return; }
    const pos = disc.pos, a = altAz(f, pos.clone().sub(p).toArray());
    const lit = litFraction(angleBetween(sunPos.clone().sub(pos).toArray(), p.clone().sub(pos).toArray()));
    const name = pn.body.name.toUpperCase(), deg = disc.deg;
    const sz = deg >= 1 ? `${deg.toFixed(1)}°` : `${deg.toFixed(2)}°`;
    if (s.lookParent) { s.az = a.az; s.alt = Math.min(89.9, Math.max(-5, a.alt)); s.fov = Math.min(110, Math.max(deg * 4, 1)); s.preset = null; s.lookParent = false; if (s.look) s.look.track = false; if (a.alt < 0) flashHud(`${name} IS BELOW THE HORIZON`); }
    hudPlanet.textContent = `◉ LOOK AT ${name}`;
    // a locked moon keeps its parent fixed in the sky: below the horizon means never (bar libration)
    const libration = b.id === 'moon' ? 8 : 1; // the Moon's optical libration reaches ~8°; the others' is tiny
    s.parentNote = a.alt >= 0 ? null : b.locked ? (a.alt < -libration ? `${name} NEVER RISES FROM HERE (FAR SIDE)` : `${name} SITS ON THE HORIZON; LIBRATION LIFTS IT INTO VIEW AT TIMES`) : `${name} IS BELOW THE HORIZON`;
    parentTag.element.textContent = `${name} · ${sz} · ${Math.round(lit * 100)}% LIT`;
    parentTag.element.title = `Apparent diameter (COMPUTED) and the lit fraction of its disc, (1 + cos phase angle)/2. ${psState[b.id] ? `${psState[b.id].name} here: ${psState[b.id].f.toExponential(1)} of sunlight.` : ''}`;
    parentTag.position.copy(pos);
    const q = pos.clone().project(camera), onScreen = q.z < 1 && Math.abs(q.x) < 0.98 && Math.abs(q.y) < 0.98;
    parentTag.visible = onScreen && a.alt > -0.5;
    planetArrow.hidden = onScreen;
    if (!onScreen) {
      let x = q.x, y = q.y;
      if (q.z > 1) { x = -x; y = -y; }
      const mx = Math.max(Math.abs(x), Math.abs(y)) || 1; x /= mx; y /= mx;
      const W = container.clientWidth, H = container.clientHeight, inset = 60;
      planetArrow.style.left = `${inset + ((x + 1) / 2) * (W - 2 * inset)}px`;
      planetArrow.style.top = `${inset + ((-y + 1) / 2) * (H - 2 * inset)}px`;
      planetArrow.querySelector('.arrow').style.transform = `rotate(${Math.atan2(x, y)}rad)`;
      planetArrow.querySelector('.txt').textContent = s.parentNote ?? `${name} · ${Math.round(a.alt)}° UP · AZ ${Math.round(a.az)}° · ${sz} · ${Math.round(lit * 100)}% LIT`;
    }
  }
  /** Double-click in the surface view: frame the Sun, Moon or planet nearest the cursor (#47). */
  function zoomOnDisc(e) {
    const s = surface, r = renderer.domElement.getBoundingClientRect();
    let best = null;
    for (const d of s.sizes ?? []) {
      const q = d.pos.clone().project(camera);
      if (q.z > 1) continue;
      const px = Math.hypot(((q.x + 1) / 2) * r.width + r.left - e.clientX, ((1 - q.y) / 2) * r.height + r.top - e.clientY);
      if (px < 60 && (!best || px < best.px)) best = { ...d, px };
    }
    if (!best) return;
    const f = s.frame, a = altAz(f, best.pos.clone().sub(camera.position).toArray());
    s.az = a.az; s.alt = Math.min(89.9, a.alt); s.fov = Math.max(0.2, Math.min(110, best.deg * 3)); s.preset = null;
    if (s.look) s.look.track = false;
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
    // #79: other eclipses show the 3D corona model (aligned to the solar axis) in place of the 2017 photograph,
    // unless the DETAIL slider has the 3D corona off
    if (c.shown === 'representative' && sunN.corona && settings.get('corona') !== false) {
      coronaTotality = c.plane.material.opacity; c.plane.visible = false; c.shown = 'modelled';
    }
  }
  const coronaPass = createCoronaPass(renderer);
  const drawCorona = (o) => { const c = model?.isSol ? nodes[model.starId]?.corona : null; if (c) coronaPass.render(scene, camera, c, o); };
  let coronaTotality = 0; // 0…1: the 3D corona's opacity in totality, seen from a surface (#79)
  const cz = { cam: new THREE.Vector3(), e: new THREE.Vector3(), ecl: new THREE.Vector3(), q: new THREE.Quaternion(), w: new THREE.Vector3(), d: new THREE.Vector3(), p: new THREE.Vector3(), o: new THREE.Vector3() };
  /**
   * Every body in front of the Sun's corona (within its footprint on screen and nearer than its far edge), largest-looking
   * first: the Moon in an eclipse, Mercury or Venus in transit, any planet or moon seen against the corona from space.
   * Centres are given relative to the camera in the Sun's frame (R☉), worked out here in double precision.
   */
  const occPool = [];
  function coronaOccluders(sunN, sunDist, px, camLocal) {
    if (px < 2) return [];
    const S = sunN.mesh.getWorldPosition(cz.w), R = displayRadius(sunN.body), d = cz.d.copy(S).sub(camera.position).normalize();
    const ext = R * (sunN.corona.look?.extent ?? 6), reach = Math.atan(ext / sunDist);
    const radPerPx = ((camera.fov * Math.PI) / 180) / (renderer.domElement.clientHeight || innerHeight);
    const found = [];
    for (const id in nodes) {
      const o = nodes[id];
      if (o === sunN || o.body.marker || !o.group.visible || !o.mesh || isStar(o.body)) continue;
      const P = o.group.getWorldPosition(cz.p), dist = P.distanceTo(camera.position);
      if (!(dist < sunDist + ext) || dist < 1e-12) continue;
      const r = displayRadius(o.body), ang = Math.atan(r / dist);
      if (ang < radPerPx * 0.35 && dist > r * 1.01) continue; // well under a pixel of the (half-resolution) pass
      const sep = Math.acos(Math.max(-1, Math.min(1, cz.o.copy(P).sub(camera.position).normalize().dot(d))));
      if (sep < reach + ang) found.push({ P: P.clone(), r, ang });
    }
    found.sort((a, b) => b.ang - a.ang);
    return found.slice(0, 8).map((f, i) => {
      const rel = (occPool[i] ??= new THREE.Vector3());
      return { rel: rel.copy(sunN.mesh.worldToLocal(f.P)).sub(camLocal), radius: f.r / R };
    });
  }
  /** The 3D corona (#79): camera, Earth and ecliptic north in the Sun's own frame; its glare sprite dims as the corona takes over. */
  function updateSunCorona(jd, now) {
    const n = model?.isSol ? nodes[model.starId] : null, c = n?.corona;
    if (!c) return;
    n.mesh.updateWorldMatrix(true, false);
    const q = n.mesh.getWorldQuaternion(cz.q).invert();
    const earthLocal = nodes.earth ? cz.e.copy(nodes.earth.pos).sub(n.pos).normalize().applyQuaternion(q) : cz.e.set(0, 0, 1).applyQuaternion(q);
    const dist = camera.position.distanceTo(n.mesh.getWorldPosition(cz.w));
    const px = sunPixelRadius(camera, displayRadius(n.body), dist, renderer.domElement.clientHeight || innerHeight);
    // from a surface the corona shows only in totality (it is a millionth of the daylit sky's brightness)
    const opacity = surface ? coronaTotality : 1;
    const camLocal = n.mesh.worldToLocal(cz.cam.copy(camera.position));
    c.update({ occluders: coronaOccluders(n, dist, px, camLocal), on: settings.get('corona') !== false && n.group.visible, camLocal, earthLocal,
      eclLocal: cz.ecl.set(0, 1, 0).applyQuaternion(q), jd, now, pxRadius: px, opacity });
    coronaTotality = 0;
    const glare = n.mesh.children.find((ch) => ch.isSprite);
    if (glare && !surface && glare.userData.base != null) glare.material.opacity = glare.userData.base * (c.mesh.visible ? 1 - 0.95 * THREE.MathUtils.smoothstep(px, 6, 60) : 1);
  }

  /** Place the camera on the surface for this frame (after positions and orientations are set). */
  function updateSurface(jd) {
    const s = surface, n = nodes[s.id];
    root.updateMatrixWorld(true);
    if (s.look?.orbit) return updateOrbitLook(jd);
    // #36 renders in daylight: move to the nearest point where the Sun stands `daylight`° up
    if (s.daylight != null && s.sphere) {
      const sunL = s.object.worldToLocal(nodes[model.starId].group.getWorldPosition(sv.c)).normalize();
      const v = sv.e.copy(s.local).normalize(), want = (90 - s.daylight) * DEG;
      if (Math.acos(Math.max(-1, Math.min(1, v.dot(sunL)))) > want) {
        const w = v.clone().addScaledVector(sunL, -v.dot(sunL));
        if (w.lengthSq() < 1e-12) w.set(sunL.y, -sunL.x, 0);
        w.normalize();
        const nv = sunL.clone().multiplyScalar(Math.cos(want)).addScaledVector(w, Math.sin(want));
        s.local.copy(nv).multiplyScalar(s.local.length()); s.normal.copy(nv);
      }
      s.daylight = null;
    }
    const centre = n.group.getWorldPosition(sv.c);
    const R = n.body.radiusKm || 1;
    // 2 m above the surface, in the object's own units (spheres are unit radius); on the DEM's ground where there is one (#80)
    const ground = s.sphere ? (relief.patchGround(s.id) ?? relief.groundAtDir(s.id, sv.e.copy(s.local).normalize().toArray(), { surface: true })) : 1;
    s.ground = s.sphere ? relief.elevationAtDir(s.id, sv.e.copy(s.local).normalize().toArray(), 99, false) : null;
    // #83: on Venus and Earth the camera may be anywhere from the cloud tops down to 2 m above the ground
    const layer = s.descent ? cloudLayer(s.id) : null;
    let groundRefKm = 0; // the ground's height above the layers' reference
    if (layer) {
      // above the layers' reference: Earth's sea level (the sea surface is drawn flat), Venus' 6,052 km VIRA sphere (the DEM's is 6,051 km)
      const hD = s.ground && Number.isFinite(s.ground.hDraw ?? s.ground.h) ? (s.ground.hDraw ?? s.ground.h) / 1000 : 0;
      groundRefKm = s.id === 'earth' ? Math.max(0, hD) : hD + ((s.ground?.meta?.refRadiusKm ?? R) - layer.refRadiusKm);
      // the cloud column over the spot (#83): Earth's measured cloud top where VIIRS has one, else the assumed layer
      const ec = n.clouds?.userData?.measured ? n.clouds.userData.ec : null, llc = dirToLatLon(s.local.toArray());
      s.cloudTop = ec ? cloudTopAt(ec, (llc.lon + 180) / 360, (llc.lat + 90) / 180) : null;
      s.col = cloudColumn(s.id, s.cloudTop);
      s.colMeasured = !!ec;
      s.groundRefKm = groundRefKm;
      const top = Math.max(0.5, s.col.standKm - groundRefKm); // the cloud tops are at a height, not a height over the ground
      if (Math.abs(top - s.descent.top) > 1e-6) s.descent = { ...s.descent, top, ...(s.descent.phase === 'top' ? { altKm: top, fromKm: top, toKm: top } : {}) };
      s.descent = stepDescent(s.descent, performance.now() / 1000);
    }
    const aboveKm = s.descent?.altKm ?? GROUND_EYE_KM;
    const lift = s.sphere ? ground + aboveKm / R : 1;
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
    if (s.lookSun) { s.az = sun.az; s.alt = Math.min(89.9, sun.alt); s.fov = Math.min(s.fov, 6); s.lookSun = false; if (s.look) s.look.track = false; }
    if (s.look) { // LOOK AT: follow the target across the sky
      const tn = nodes[s.look.target];
      const t = tn ? altAz(f, tn.group.getWorldPosition(sv.d).sub(p).toArray()) : null;
      if (t && s.look.track) { s.az = t.az; s.alt = Math.max(-15, Math.min(89.9, t.alt)); }
      s.look.altAz = t;
      updateLookReadout(jd, p);
    }
    // a landscape view (#36 renders): face the parent planet (from a moon) or the Sun if up, with the horizon in frame
    if (s.lookBest) {
      const parentN = n.body.kind === 'moon' && nodes[n.body.parent];
      const planet = parentN ? altAz(f, parentN.group.getWorldPosition(sv.d).sub(p).toArray()) : null;
      const pick = [planet, sun].find((c) => c && c.alt > 2) ?? planet ?? sun;
      // the horizon a fifth of the way up the frame, the target inside it (camera fov is vertical)
      s.fov = Math.max(70, Math.min(110, (Math.max(0, pick.alt) + 6) / 0.8));
      s.az = pick.az; s.alt = 0.3 * s.fov; s.lookBest = false;
    }
    const air = DAY_SKY[s.id];
    let day = air ? (air.always ? Math.max(0.15, daylight(sun.alt)) : daylight(sun.alt)) : 0;
    // a solar eclipse dims the day by the share of the Sun the Moon hides; totality brings out the stars (#30)
    const llNow = s.sphere ? dirToLatLon(s.local.toArray()) : null;
    s.eclipse = s.id === 'earth' && llNow && model.isSol ? eclipseDaylight(jd, llNow.lat, llNow.lon, surfacePoint) : null;
    if (s.eclipse) day *= s.eclipse.light;
    // #83: the layer we are in: sky, light, fog and murk from the cloud tops to the ground
    let look = null, layerR = null;
    if (layer) {
      const altRef = groundRefKm + aboveKm;
      const c = n.clouds, cu = c?.material?.uniforms;
      let cover = 1;
      if (s.id === 'earth' && cu && llNow) cover = cloudCoverAt(cu.uMap.value, (llNow.lon + 180) / 360 + (n.mesh.rotation.y - c.rotation.y) / (2 * Math.PI), (llNow.lat + 90) / 180, cu.uAlphaFromLuma.value);
      if (s.colMeasured && s.cloudTop == null) cover = 0; // no cloud top retrieved over the spot: clear (snow is not cloud)
      const d0 = daylight(sun.alt) * (s.eclipse?.light ?? 1);
      look = layerLook(s.id, altRef, { day: d0, cover, col: s.col });
      s.cover = cover;
      layerR = layerReadout(s.id, altRef, aboveKm, s.col);
      day = d0;
      const gu = n.mesh.material.uniforms;
      if (gu.uSkyAmb) {
        gu.uSunColor.value.setRGB(1.3 * look.sunScale * look.sunTint[0], 1.3 * look.sunScale * look.sunTint[1], 1.3 * look.sunScale * look.sunTint[2]);
        gu.uSkyAmb.value.setRGB(...look.skyAmb);
        gu.uSkyUp.value.set(...f.up);
        gu.uFogK.value = look.fogK * AU_KM;
        gu.uFogCol.value.setRGB(...look.fogRgb);
      }
      murkVeil ??= createMurkVeil(scene);
      murkVeil.set(look.murk, look.murkRgb);
    }
    s.layerLook = look;
    updateCorona(p, s.eclipse);
    // the Sun's glare (#47): the orbit-view sprite goes; a glare fixed in the observer's field, as
    // bright as the sunlight that reaches the ground, takes over outside the exact disc
    const glare = nodes[model.starId]?.mesh?.children?.find((ch) => ch.isSprite);
    if (glare) glare.visible = false;
    const sunPos = star.group.getWorldPosition(sv.d.clone());
    const sunDistKm = sunPos.distanceTo(p) * AU_KM;
    const sunDeg = angularDiameterDeg(star.body.radiusKm, sunDistKm);
    skyGlare ??= createSkyGlare(scene);
    const hasAir = !!DAY_SKY[s.id] && !DAY_SKY[s.id].always;
    skyGlare.update({ sunPos, eye: p, camera, sunRadiusDeg: (sunDeg / 2) * s.enlarge, fovDeg: s.fov,
      strength: look && !look.sunVisible ? 0 : glareStrength(sunDistKm / AU_KM, sun.alt, { obscuration: s.eclipse?.obscuration ?? 0, k: hasAir ? 0.2 : 0 }) * 0.9 });
    // apparent sizes of the Sun and the other big discs in this sky, true and as rendered
    const discs = [{ id: model.starId, label: 'SUN', pos: sunPos, deg: sunDeg }];
    const other = s.id === 'earth' ? 'moon' : n.body.kind === 'moon' ? n.body.parent : null;
    if (other && nodes[other]) {
      const on = nodes[other], op = on.group.getWorldPosition(new THREE.Vector3());
      discs.push({ id: other, label: on.body.name.toUpperCase(), pos: op, deg: angularDiameterDeg(on.body.radiusKm, op.distanceTo(p) * AU_KM) });
    }
    for (const d of discs) { // rendered: the mesh's world radius over its distance (TRUE scale makes them equal)
      const m = nodes[d.id].mesh;
      if (s.enlarge !== 1) nodes[d.id].tilt.scale.multiplyScalar(s.enlarge);
      m.updateWorldMatrix(true, false);
      const wr = new THREE.Vector3().setFromMatrixScale(m.matrixWorld).x;
      d.renderedDeg = (2 * Math.asin(Math.min(1, wr / d.pos.distanceTo(p))) * 180) / Math.PI;
    }
    s.sizes = discs;
    updateParentFinder(s, n, p, f, sunPos, discs[1]);
    hudSun.hidden = sun.alt < -1 || (look && !look.sunVisible);
    if (look) { // #83: the sky from inside the layer
      const k = look.sky;
      scene.background = k[0] + k[1] + k[2] > 0.002 ? (scene.background?.isColor ? scene.background : new THREE.Color()).setRGB(k[0], k[1], k[2], THREE.LinearSRGBColorSpace) : null;
      skyMat.uniforms.uFade.value = look.starFade ?? Math.max(0, 1 - day * 1.6);
      s.day = look.sunVisible ? day : 1;
    } else if (air && day > 0) {
      const k = air.always ? Math.min(1, day) * 0.7 : day * 0.9;
      scene.background = (scene.background?.isColor ? scene.background : new THREE.Color()).setRGB(air.rgb[0] * k, air.rgb[1] * k, air.rgb[2] * k, THREE.LinearSRGBColorSpace);
    } else scene.background = null;
    if (!look) {
      skyMat.uniforms.uFade.value = air?.hidesStars ? Math.max(0, 1 - day * 1.6) : 1;
      s.day = air?.hidesStars ? day : 0;
    }
    // read-out
    const ll = s.sphere ? dirToLatLon(s.local.toArray()) : null;
    const where = ll ? `${Math.abs(ll.lat).toFixed(2)}°${ll.lat >= 0 ? 'N' : 'S'} ${Math.abs(ll.lon).toFixed(2)}°${ll.lon >= 0 ? 'E' : 'W'}` : 'ON ITS SURFACE';
    const giant = (n.body.radiusKm ?? 0) > 20000;
    const lead = look ? (look.where === 'above' ? 'ABOVE THE CLOUDS OF' : look.where === 'in' ? 'IN THE CLOUDS OF' : s.descent.phase === 'ground' ? 'STANDING ON' : 'UNDER THE CLOUDS OF') : giant ? 'AT THE CLOUD TOPS OF' : 'STANDING ON';
    const text = `${lead} ${n.body.name.toUpperCase()} · ${where}${s.descent?.phase === 'down' ? ' · DESCENDING' : s.descent?.phase === 'up' ? ' · ASCENDING' : ''}`;
    layerHud(s, layerR, aboveKm, look);
    updateGauge(s);
    hudDescend.hidden = !s.descent || s.descent.phase === 'ground' || s.descent.phase === 'down';
    hudAscend.hidden = !s.descent || s.descent.phase === 'top' || s.descent.phase === 'up';
    const lookTxt = s.alt > 89.5 ? 'LOOKING STRAIGHT UP' : `LOOKING ${Math.round(s.az)}° AZ · ${Math.round(s.alt)}° ALT`;
    const coronaTxt = corona?.shown ? (corona.shown === 'measured' ? ' · CORONA: THIS ECLIPSE (NASA/CARLA THOMAS, MEASURED)' : corona.shown === 'modelled' ? ' · CORONA: 3D MODEL ON THE SOLAR AXIS (MODELLED, NOT A PHOTO OF THIS ECLIPSE)' : ` · CORONA: REPRESENTATIVE (${CORONA.date}, NASA/CARLA THOMAS)`) : '';
    const ecl = s.eclipse && s.eclipse.obscuration > 0 && sun.alt > -1 ? (s.eclipse.total ? ` · TOTAL ECLIPSE: TOTALITY${coronaTxt}` : ` · ECLIPSE: ${Math.round(s.eclipse.obscuration * 100)}% OF THE SUN HIDDEN${coronaTxt}`) : '';
    const sunTxt = `SUN ${sun.alt >= 0 ? `${sun.alt.toFixed(1)}° UP` : `${(-sun.alt).toFixed(1)}° BELOW THE HORIZON`} · AZ ${Math.round(sun.az)}°${ecl}`;
    const dp = (x) => (x >= 1 ? x.toFixed(1) : x >= 0.1 ? x.toFixed(2) : x >= 0.01 ? x.toFixed(3) : `${(x * 3600).toFixed(1)}″`).replace(/(\d)$/, '$1°');
    const sizes = `${discs.map((d) => `${d.label} ${dp(d.deg)}`).join(' · ')}${s.enlarge !== 1 ? ` · SUN & ${discs[1]?.label ?? 'MOON'} ENLARGED ×${s.enlarge} (IMAGINED, NOT TRUE SIZE)` : ''}`;
    const hfov = horizontalFov(s.fov, camera.aspect);
    const fovTxt = `FOV ${hfov < 10 ? hfov.toFixed(1) : Math.round(hfov)}° × ${s.fov < 10 ? s.fov.toFixed(1) : Math.round(s.fov)}°${s.preset ? ` (${FOV_PRESETS.find((x) => x.id === s.preset).label})` : ''}`;
    presetBtns.forEach((b, i) => b.classList.toggle('on', s.preset === FOV_PRESETS[i].id));
    hudBig.textContent = s.enlarge === 1 ? 'TRUE SIZE' : `ENLARGED ×${s.enlarge}`;
    hudBig.classList.toggle('on', s.enlarge !== 1);
    const g = s.ground && Number.isFinite(s.ground.h) ? ` · GROUND ${fmtElevation(s.ground.h)} (${s.ground.meta.ref.toUpperCase()} · ${s.ground.meta.name.toUpperCase()} · MEASURED${relief.k > 1 ? ` · TERRAIN DRAWN ×${relief.k}, EXAGGERATED` : relief.k === 0 ? ' · RELIEF OFF' : ''})` : '';
    const airNote = look && s.id === 'venus' ? (look.sunVisible ? 'Above the deck: the Sun shines on a sea of sulphuric-acid cloud.' : air.note) : air?.note;
    const sub = `${lookTxt} · ${sunTxt}${g}${s.parentNote ? ` · ${s.parentNote}` : ''} · ${sizes} · ${fovTxt}${airNote ? ` · ${airNote}` : ''}${giant ? ' · No solid surface: a giant planet is gas all the way down.' : ''} · DRAG TO LOOK · WHEEL TO ZOOM · ESC TO RETURN`;
    if (hudText.textContent !== text) hudText.textContent = text;
    if (hudSub.textContent !== sub) hudSub.textContent = sub;
    hudSub.title = `Apparent diameters from this spot (COMPUTED from the ephemeris and radii): ${discs.map((d) => `${d.label} ${(d.deg * 60).toFixed(2)}′, drawn ${(d.renderedDeg * 60).toFixed(2)}′`).join('; ')}.`;
  }

  // ---- LOOK AT (#43) ---------------------------------------------------------------------------
  // Stand on (or hover just above) one body and look at another, at TRUE scale: its real angular
  // size, phase, light-time-corrected position, and when it rises and sets.
  const oA = new THREE.Vector3(), oB = new THREE.Vector3(), oC = new THREE.Vector3(), oQ = new THREE.Quaternion(), oM = new THREE.Matrix4(), Y = new THREE.Vector3(0, 1, 0);
  /** The body's orientation at `jd` (quaternion of its tilt group) and extra spin about local +y. */
  function orientationAt(id, jd, q) {
    const n = nodes[id], b = n.body;
    const toS = (v) => new THREE.Vector3(...frameToScene(eqToEcl(v)));
    if (model.isSol && (id === 'moon' || id === 'earth')) {
      const ax = id === 'earth' ? earthAxes(jd, b.texLon0 ?? -180) : moonAxes(jd, b.texLon0 ?? -180);
      q.setFromRotationMatrix(oM.makeBasis(toS(ax.x), toS(ax.y), toS(ax.z))); return 0;
    }
    if (b.locked && nodes[b.parent]) {
      const pos = scenePosition(id, jd, new THREE.Vector3());
      const to = scenePosition(b.parent, jd, new THREE.Vector3()).sub(pos).normalize();
      const ahead = scenePosition(id, jd + (b.periodDays ?? b.moon?.elements.P ?? 1) / 50, new THREE.Vector3()).sub(pos);
      const up = to.clone().negate().cross(ahead).normalize();
      const x = to.sub(up.clone().multiplyScalar(to.dot(up))).normalize();
      q.setFromRotationMatrix(oM.makeBasis(x, up, x.clone().cross(up))); return 0;
    }
    if (b.iau && b.pole) {
      const ax = bodyAxes(b.pole, b.iau, jd, b.texLon0 ?? -180);
      q.setFromRotationMatrix(oM.makeBasis(toS(ax.x), toS(ax.y), toS(ax.z))); return 0;
    }
    q.copy(n.tilt.quaternion);
    return b.rotationHours ? ((jd * 24) / b.rotationHours) * Math.PI * 2 % (Math.PI * 2) : 0;
  }
  /** Altitude (deg) of the LOOK AT target from the standing point at `jd`. */
  function lookAltAt(L, jd) {
    const c = scenePosition(L.obs, jd, oA);
    const spin = orientationAt(L.obs, jd, oQ);
    const up = oC.copy(L.local).normalize().applyAxisAngle(Y, spin).applyQuaternion(oQ);
    const d = scenePosition(L.target, jd, oB).sub(c).normalize();
    return Math.asin(Math.max(-1, Math.min(1, up.dot(d)))) / DEG;
  }
  /** Next rise and set within 4 days (10-minute steps, refined by bisection), or 'ALWAYS UP' / 'NEVER RISES'. */
  function riseSet(L, jd) {
    const step = 10 / 1440, h0 = -0.3;
    let prev = lookAltAt(L, jd), rise = null, set = null;
    const refine = (a, b) => { for (let k = 0; k < 12; k++) { const m = (a + b) / 2; ((lookAltAt(L, m) > h0) === (lookAltAt(L, a) > h0)) ? (a = m) : (b = m); } return (a + b) / 2; };
    for (let t = jd + step; t <= jd + 4 && (rise == null || set == null); t += step) {
      const a = lookAltAt(L, t);
      if (prev <= h0 && a > h0 && rise == null) rise = refine(t - step, t);
      if (prev > h0 && a <= h0 && set == null) set = refine(t - step, t);
      prev = a;
    }
    return { rise, set, up: lookAltAt(L, jd) > h0 };
  }
  const inTime = (days) => { const m = Math.round(days * 1440); return m < 60 ? `${m} MIN` : `${Math.floor(m / 60)} H ${String(m % 60).padStart(2, '0')} MIN`; };

  function updateLookReadout(jd, eye) {
    const L = surface.look, tn = nodes[L.target], star = nodes[model.starId];
    if (!tn) return;
    const tp = tn.group.getWorldPosition(oA), sp = star.group.getWorldPosition(oB);
    const dKm = tp.distanceTo(eye) * AU_KM;
    const deg = angularDiameterDeg(tn.body.radiusKm || 0.001, dKm);
    if (!L.fitted) { surface.fov = fitFov(deg); L.fitted = scaleMix === 1; } // keep fitting until TRUE scale has settled
    const ph = isStar(tn.body) ? null : lookPhase(sp.clone().sub(tp).toArray(), eye.clone().sub(tp).toArray());
    const lt = dKm / C_KM_S;
    let sky = '';
    if (!L.orbit && L.altAz) {
      if (performance.now() - (L.rsAt ?? 0) > 3000) { L.rs = riseSet(L, jd); L.rsAt = performance.now(); }
      const rs = L.rs;
      const next = rs ? (rs.up ? (rs.set != null ? ` · SETS IN ${inTime(rs.set - jd)}` : ' · ALWAYS UP') : (rs.rise != null ? ` · RISES IN ${inTime(rs.rise - jd)}` : ' · DOES NOT RISE IN 4 DAYS')) : '';
      sky = L.altAz.alt >= 0 ? ` · ${L.altAz.alt.toFixed(1)}° UP, AZ ${Math.round(L.altAz.az)}°${next}` : ` · BELOW THE HORIZON${next}`;
    }
    const m = magnification(surface.fov);
    const text = `${tn.body.name.toUpperCase()} · ${describeSize(deg)}${ph ? ` · ${Math.round(ph.illuminated * 100)}% LIT (PHASE ${Math.round(ph.angleDeg)}°)` : ''} · ${Math.round(dKm).toLocaleString()} KM${sky}`
      + ` · ${L.apparent ? `AS IT WAS ${fmtLightTime(lt)} AGO` : `GEOMETRIC (LIGHT TAKES ${fmtLightTime(lt)})`} · FIELD ${surface.fov < 1 ? surface.fov.toFixed(2) : surface.fov.toFixed(1)}°${m > 1.05 ? ` · ×${m < 10 ? m.toFixed(1) : Math.round(m)}` : ' · NAKED EYE'}${L.track || L.orbit ? '' : ' · NOT TRACKING'}`;
    if (hudLook.textContent !== text) hudLook.textContent = text;
    L.info = { deg, dKm, lt, illuminated: ph?.illuminated ?? null, phaseDeg: ph?.angleDeg ?? null, alt: L.altAz?.alt ?? null };
  }
  /** From orbit: hover just above the observer on the side facing the target and frame it. */
  function updateOrbitLook(jd) {
    const s = surface, L = s.look, n = nodes[L.obs], tn = nodes[L.target];
    if (!n || !tn) return;
    const c = n.group.getWorldPosition(sv.c), tp = tn.group.getWorldPosition(sv.d);
    const u = sv.e.copy(tp).sub(c).normalize();
    const p = sv.a.copy(c).addScaledVector(u, Math.max(displayRadius(n.body) * 1.25, 1e-12));
    camera.position.copy(p);
    camera.up.copy(Y.clone().applyQuaternion(n.tilt.getWorldQuaternion(sv.q)));
    camera.lookAt(tp);
    if (Math.abs(camera.fov - s.fov) > 1e-3) { camera.fov = s.fov; camera.updateProjectionMatrix(); }
    camera.near = 1e-14; camera.far = 1e6; camera.updateProjectionMatrix();
    for (const cc of [...compass, zenithTag]) cc.visible = false;
    scene.background = null; skyMat.uniforms.uFade.value = 1; s.day = 0; hudSun.hidden = true;
    updateLookReadout(jd, p);
    const text = `FROM ${n.body.name.toUpperCase()} · LOOKING AT ${tn.body.name.toUpperCase()}`;
    if (hudText.textContent !== text) hudText.textContent = text;
    const sub = 'FROM JUST ABOVE IT, IGNORING THE HORIZON · TRUE SCALE · WHEEL TO ZOOM · ESC TO RETURN';
    if (hudSub.textContent !== sub) hudSub.textContent = sub;
  }
  /** LOOK AT `target` from `obs`: standing on it where the target is ~35° up, or hovering above it. */
  function lookAtBody(obs, target, { mode = 'surface', apparent = true } = {}) {
    const n = nodes[obs], tn = nodes[target];
    if (!n || !tn || obs === target) return false;
    const noGround = isStar(n.body) || n.body.marker || n.body.kind === 'spacecraft' || n.body.kind === 'satellite';
    const orbit = mode === 'orbit' || noGround;
    root.updateMatrixWorld(true);
    let local = new THREE.Vector3(0, 1, 0);
    if (!orbit) {
      const dirL = n.mesh.worldToLocal(tn.group.getWorldPosition(new THREE.Vector3())).normalize();
      const w = new THREE.Vector3().crossVectors(dirL, Y);
      if (w.lengthSq() < 1e-8) w.set(1, 0, 0);
      w.normalize();
      local = dirL.clone().multiplyScalar(Math.cos(55 * DEG)).addScaledVector(w, Math.sin(55 * DEG)).normalize();
    }
    enterSurface(obs, { object: n.mesh, local, normal: local.clone() });
    surface.look = { obs, target, apparent, orbit, local: local.clone(), track: true, fitted: false };
    hudLt.textContent = apparent ? 'APPARENT' : 'GEOMETRIC';
    return true;
  }
  // ---- camera controls (#39): ORBIT / LOOK / FLY, zoom, FILL VIEW, RESET, bookmarks ---------------
  let anchorId = 'sun'; // FREE MOVE: the body the floating origin rides on (the nearest one)
  let nearestSurf = 1; // AU from the camera to the nearest surface
  let quietFocus = null; // the return to ORBIT already flies to this body; skip the route's own flight
  const camWorld = (v) => v.copy(focusPos).add(camera.position); // camera in root coordinates
  const flyable = (n) => n && !n.body.marker && !n.body._missing && n.group.visible !== false;
  /** Track the nearest body; hand the origin over when another one is clearly nearer (hysteresis). */
  function updateAnchor() {
    if (!nodes[anchorId]) anchorId = focusId;
    const c = camWorld(tmp6);
    let best = anchorId, bestD = c.distanceTo(nodes[anchorId].pos) - viewEnvelope(nodes[anchorId].body);
    const anchorD = bestD;
    for (const id in nodes) {
      const n = nodes[id];
      if (id === anchorId || !flyable(n)) continue;
      const d = c.distanceTo(n.pos) - viewEnvelope(n.body);
      if (d < bestD) { best = id; bestD = d; }
    }
    if (best !== anchorId && bestD < 0.7 * anchorD) {
      camera.position.add(nodes[anchorId].pos).sub(nodes[best].pos);
      anchorId = best;
    }
    nearestSurf = Math.max(1e-12, Math.min(bestD, anchorD)); // ≥ 15 cm
  }
  /** The body nearest the line of sight (within 2° or its own apparent size), else null. */
  function aheadBody() {
    const c = camWorld(tmp6), f = tmp7.set(0, 0, -1).applyQuaternion(camera.quaternion);
    let best = null, bestD = Infinity;
    for (const id in nodes) {
      const n = nodes[id];
      if (!flyable(n)) continue;
      const v = tmp8.copy(n.pos).sub(c), dist = v.length(), along = v.dot(f);
      if (along <= 0 || dist === 0) continue;
      const angle = Math.acos(Math.min(1, along / dist)), angR = Math.asin(Math.min(1, viewEnvelope(n.body) / dist));
      if (angle < Math.max(2 * DEG, angR * 1.2) && dist < bestD) { best = id; bestD = dist; }
    }
    return best;
  }
  /** The selection's framing distance (AU): a body's disc, a star's planetary orbits, a region's extent. */
  function fitAU() {
    const n = nodes[focusId], b = n.body, aspect = camera.aspect || 1;
    if (b.marker) return markerView(b);
    if (isStar(b) && overviewAU != null) {
      // the planets' orbits: the farthest point of any of them from the focus (the camera's pivot)
      root.updateMatrixWorld(true);
      let far = 0;
      for (const id in nodes) {
        const m = nodes[id], pos = m.orbit?.geometry?.attributes?.position;
        if (!pos || m.body.kind !== 'planet' || m.group.visible === false) continue;
        for (let i = 0; i < pos.count; i++) far = Math.max(far, tmp6.fromBufferAttribute(pos, i).applyMatrix4(m.orbit.matrixWorld).length());
      }
      if (far > 0) return fitDistance(far, camera.fov, aspect, 1.02);
    }
    const ring = b.rings ? b.rings.outerKm / b.radiusKm : 1;
    return fitDistance(viewEnvelope(b) * ring, camera.fov, aspect, 1.05);
  }
  const rig = createCameraRig({
    key: 'system', camera, controls, dom: labels.domElement, container,
    // near a body drawn enlarged (ENHANCED), lengths are in that body's own scale: undo its enlargement
    metersPerUnit: () => {
      const n = model && nodes[focusId];
      if (!n) return METERS.au;
      const r = displayRadius(n.body), d = camera.position.distanceTo(controls.target);
      return d < r * 200 ? METERS.au * (trueRadius(n.body) / r) : METERS.au;
    },
    minFov: 0.05, maxFov: 100,
    nearest: () => nearestSurf,
    busy: () => !!flight || !!siteView, // FROM ABOVE (#37) drives the camera itself
    captured: () => !!helm?.active, // HELM (#42) flies the camera with the ship
    override: () => (surface ? {
      fov: surface.fov, minFov: surface.look ? 0.02 : 2, maxFov: 110, // LOOK AT (#43) zooms to telescope fields
      setFov: (v) => { surface.fov = v; },
      fit: () => { if (surface.look) surface.look.fitted = false; else surface.fov = 70; }, // LOOK AT: fit the target
      reset: () => { surface.az = 0; surface.alt = 90; surface.fov = 70; },
    } : null),
    toOrbit(prev) {
      if (surface || !model) return true;
      // orbit whatever is in front of you; otherwise the body you rode with (FLY) or the focus (LOOK)
      const id = aheadBody() ?? (prev === 'fly' ? anchorId : focusId);
      if (!nodes[id]) return true;
      const c = camWorld(tmp9.set(0, 0, 0)).clone();
      focusPos.copy(nodes[id].pos);
      camera.position.copy(c).sub(focusPos);
      controls.target.set(0, 0, 0);
      const d = camera.position.length(), env = viewEnvelope(nodes[id].body);
      if (id !== focusId || d < env * 1.3) {
        flight = { from: focusPos.clone(), t0: performance.now(), dur: reducedMotion() ? 1 : 1200, d0: Math.max(d, 1e-15), d1: Math.max(d, env * 1.6) };
      }
      const changed = id !== focusId;
      focusId = id; anchorId = id; overviewAU = null; framedRadius = null;
      if (changed) { quietFocus = id; setTimeout(() => { if (quietFocus === id) quietFocus = null; }, 2000); onSelect?.(id); }
      return true;
    },
    moved() { // don't fly into the ground
      const r = viewEnvelope(nodes[anchorId]?.body ?? nodes[focusId].body) * 1.0005;
      if (camera.position.length() < r) camera.position.setLength(r);
    },
    fit() { if (model && nodes[focusId]) flyTo(focusId, { overview: overviewAU != null ? fitAU() : null, distance: fitAU() }); },
    reset() {
      if (!model) return;
      const s = model.survey[0];
      if (overviewAU != null && focusId === (s.centre && nodes[s.centre] ? s.centre : model.starId)) flyTo(focusId, { overview: s.au, dir: new THREE.Vector3(0, 0.45, 0.9) });
      else flyTo(focusId);
    },
    state(mode) {
      if (surface) return { mode: 'surface', az: surface.az, alt: surface.alt, fov: surface.fov };
      // relative to the routed (focused) body, whatever the origin rides on
      const p = camWorld(new THREE.Vector3()).sub(nodes[focusId].pos);
      return { mode, p: p.toArray(), q: camera.quaternion.toArray(), fov: camera.fov };
    },
    apply(s) {
      if (s.mode === 'surface') { if (surface) { surface.az = s.az; surface.alt = s.alt; surface.fov = s.fov; } return; }
      flight = null;
      anchorId = focusId;
      focusPos.copy(nodes[focusId].pos);
      camera.position.fromArray(s.p);
      camera.quaternion.fromArray(s.q);
      controls.target.set(0, 0, 0);
      framedRadius = null;
    },
  });

  // ---- HELM (#42): fly the USS Fidelity; the floating origin rides on the ship ---------------------
  helm = createHelm({
    scene, camera, controls, dom: labels.domElement, container, rig,
    nodes: () => nodes, model: () => model, focusId: () => focusId,
    trueRadius: (b) => trueRadius(b), isStar, flyable,
    // REAL PHYSICS (#42): ephemeris positions at any time (body velocities by finite difference) and the clock's rate
    positionAt: (id, jd, out) => scenePosition(id, jd, out), jd: () => clock.jd, clockRate: () => clock.rate?.days ?? 0,
    // #80: the drawn ground under the ship (AU from the body's centre), from the DEM where there is one
    groundRadius(id, offset) {
      const n = nodes[id];
      if (!n || !relief.has(id) || !n.mesh) return null;
      const d = offset.clone().applyQuaternion(n.mesh.getWorldQuaternion(new THREE.Quaternion()).invert()).normalize();
      return trueRadius(n.body) * relief.groundAtDir(id, d.toArray());
    },
    inspect: (o) => inspectCraft(o),
    prepare(id) { if (nodes[id]) { void upgradeCraft(nodes[id]); void upgradeShape(nodes[id]); } }, // the craft's model or the body's shape, as a focus would load
    exitOthers() { if (surface) exitSurface(false); endSiteView(); flight = null; },
    on(kind, data) {
      if (kind === 'disengage') { if (!data.quiet) helmHandBack(data); }
      else if (kind === 'select') { quietFocus = data; setTimeout(() => { if (quietFocus === data) quietFocus = null; }, 2000); onSelect?.(data); }
      onHelm?.(kind, data);
    },
  });
  /** Leaving the helm: orbit the nearest body from where the camera is, easing out to its framing distance. */
  function helmHandBack({ id, camWorld }) {
    if (!model) return;
    if (!nodes[id]) id = model.starId;
    focusId = id; anchorId = id; overviewAU = null; framedRadius = null;
    focusPos.copy(nodes[id].pos);
    camera.position.copy(camWorld).sub(focusPos);
    controls.target.set(0, 0, 0);
    flight = { from: focusPos.clone(), t0: performance.now(), dur: reducedMotion() ? 1 : 1400, d0: Math.max(camera.position.length(), 1e-15), d1: null };
    quietFocus = id; setTimeout(() => { if (quietFocus === id) quietFocus = null; }, 2000);
    onSelect?.(id);
  }

  // ---- frame loop -------------------------------------------------------------------------
  const reliefCam = new THREE.Vector3(), reliefDir = new THREE.Vector3();
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
    siteViewSize.w = w; siteViewSize.h = h;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(container);

  // Hover over the site: first frame places the camera above it (a little south, looking down and
  // north) at a height that fits its paths; afterwards the camera follows the turning, moving body.
  const svP = new THREE.Vector3(), svN = new THREE.Vector3(), svQ = new THREE.Quaternion(), svD = new THREE.Vector3();
  function updateSiteView() {
    const n = nodes[siteView.id];
    if (!n || focusId !== siteView.id) { endSiteView(); return; }
    siteWorld(n, siteView.lat, siteView.lon, svP);
    const r = displayRadius(n.body);
    if (!siteView.ready) {
      svN.copy(svP).normalize();
      const h = Math.max(2, siteView.spanKm * 2.2) / n.body.radiusKm * r; // height (scene units) that fits the span
      const pole = tmp6.set(0, 1, 0).applyQuaternion(n.tilt.getWorldQuaternion(svQ)).normalize();
      const south = pole.sub(tmp8.copy(svN).multiplyScalar(pole.dot(svN))).normalize().negate();
      const dest = svN.clone().multiplyScalar(h).addScaledVector(south, h * 0.45); // offset from the site
      siteView.anim = { t0: performance.now(), from: camera.position.clone().sub(svP), dest };
      controls.target.copy(svP);
      siteView.ready = true; siteView.last = svP.clone(); siteView.r = r;
    }
    const a = siteView.anim;
    if (a) { // swoop down: direction blended, distance eased in log space
      const k = ease(Math.min(1, (performance.now() - a.t0) / 1800));
      svD.copy(a.from).normalize().lerp(tmp9.copy(a.dest).normalize(), k).normalize()
        .multiplyScalar(Math.exp(Math.log(a.from.length()) + (Math.log(a.dest.length()) - Math.log(a.from.length())) * k));
      camera.position.copy(svP).add(svD);
      if (k >= 1) siteView.anim = null;
    } else if (r !== siteView.r) { // ENHANCED ⇄ TRUE: keep the same view of the site
      camera.position.copy(svP).add(tmp9.copy(camera.position).sub(siteView.last).multiplyScalar(r / siteView.r));
    } else camera.position.add(tmp9.copy(svP).sub(siteView.last));
    siteView.r = r;
    controls.target.copy(svP);
    siteView.last.copy(svP);
  }

  // a slow GPU (a software renderer, an old chip): lower the render scale and leave the page idle gaps (governor.js)
  const governor = createGovernor({ min: 0.5 });
  let lastFrameAt = null, idleTimer = null;
  function applyRenderScale(k) {
    const pr0 = renderer.getPixelRatio(), pr1 = Math.min(devicePixelRatio, 2) * k;
    if (Math.abs(pr1 - pr0) < 1e-6) return;
    const seen = new Set(); // shared uniform objects are scaled once
    scene.traverse((x) => { for (const m of [x.material].flat()) { const u = m?.uniforms?.uPixel; if (u && typeof u.value === 'number' && !seen.has(u)) { seen.add(u); u.value *= pr1 / pr0; } } });
    renderer.setPixelRatio(pr1);
    resize();
  }
  function frame(now) {
    if (!running) return;
    const gv = governor.update(lastFrameAt == null ? 0 : now - lastFrameAt);
    lastFrameAt = now;
    if (gv.changed) applyRenderScale(gv.scale);
    if (gv.idleMs) idleTimer = setTimeout(() => { idleTimer = null; if (running) requestAnimationFrame(frame); }, gv.idleMs);
    else requestAnimationFrame(frame);
    clock.tick(now);
    if (!model) return;
    const jd = clock.jd;
    updatePaleoEarth(jd);

    const targetMix = settings.get('scale') === 'true' || surface || helm.active ? 1 : 0;
    scaleMix += (targetMix - scaleMix) * 0.08;
    if (surface || helm.active) scaleMix = 1; // TRUE scale at the helm: real distances, real sizes
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
        n.label.visible = !siteView && (id === fid || (zonesOn && showLabels && (local ? nearEarth : n.body.kind === 'lagrange point' || overviewAU != null)));
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
      const culled = id !== focusId && hiddenByDetail(n.body, settings.get); // DETAIL slider: a focused body always shows
      const local = n.body.kind === 'moon' || (n.body.kind === 'spacecraft' && n.body.parent);
      const near = !local || fb.id === n.body.parent || fb.parent === n.body.parent || fb.id === n.body.id;
      const minorFar = n.body.orbit?.type === 'elements' && overviewAU != null && overviewAU < 6 && n.body.belt !== 'MAIN BELT';
      n.label.visible = !culled && !siteView && ((showLabels && near && !minorFar) || id === focusId); // hovering over a site: only its own labels
      n.group.visible = !culled && !n.body._missing && (n.body.kind !== 'moon' || near || overviewAU == null || camera.position.length() < 3);
      n.label.element.classList.toggle('focused', id === focusId);
      n.sites?.update({ on: settings.get('sites'), focused: id === focusId && !surface, surface: surface?.id === id, hidden: hiddenSiteKinds(), camera, size: siteViewSize, spin: n.mesh.rotation.y });
      if (n.features) { n.features.group.rotation.y = n.mesh.rotation.y; n.features.update({ on: settings.get('features'), focused: id === focusId, surface: surface?.id === id, camera, size: siteViewSize, blocked: n.sites?.placed }); }
      if (n.body.orbit) {
        updateOrbit(n, jd);
        n.orbit.visible = (showOrbits || id === focusId) && !surface && !culled;
        n.orbit.material.opacity = id === focusId ? 0.9 : n.body.orbit.type === 'elements' ? 0.32 : n.body.kind === 'spacecraft' ? 0.22 : 0.45;
        fat.sync(n.orbit, id === focusId ? 3 : 1.6);
        if (n.endMark) n.endMark.visible = n.orbit.visible && !surface;
      }
    }

    trek.update({ on: settings.get('starfleet'), nodes, focusId, planeNormal: model.planeNormal, hideAll: !!surface || !!siteView, camera,
      mapRadius: (b, au) => localMap(b, trekTmp.set(au, 0, 0)).length() });

    // LOOK AT, apparent: draw the target where it was when the light now arriving left it
    if (surface?.look?.apparent && nodes[surface.look.target] && nodes[surface.look.obs]) {
      const L = surface.look, tn = nodes[L.target];
      const ltDays = (tn.pos.distanceTo(nodes[L.obs].pos) * AU_KM) / C_KM_S / 86400;
      scenePosition(L.target, jd - ltDays, tn.pos);
      tn.group.position.copy(tn.pos);
    }
    // Camera flight: slide the floating origin from the old focus to the new one
    // while easing the camera's distance (log-space, so 30 AU → 1e-4 AU feels smooth).
    const helmOrigin = helm.update(now); // the ship's position (AU, root coordinates) while at the helm
    if (helmOrigin) {
      focusPos.copy(helmOrigin);
      const sel = helm.selected;
      focusId = sel && nodes[sel] ? sel : nodes[helm.anchor] ? helm.anchor : focusId; // labels and orbit highlight follow the course target
    }
    helmCloudLight(helmOrigin); // #83: under Venus' deck at the helm, the surface view's overcast
    const ab = helmOrigin ? helm.aberration() : null; // #42: relativistic aberration and Doppler on the sky (or none)
    skyMat.uniforms.uAbBeta.value = ab ? ab.beta : 0;
    if (ab) skyMat.uniforms.uAbDir.value.fromArray(ab.dir);
    const target = nodes[focusId].pos;
    if (helmOrigin) { /* the helm placed the camera relative to the ship */ }
    else if (flight) {
      const t = Math.min(1, (now - flight.t0) / flight.dur), k = ease(t);
      focusPos.lerpVectors(flight.from, target, k);
      const d1 = flight.d1 ?? overviewAU ?? viewDistance(focusId); // live, so a scale switch mid-flight still lands well
      const d = Math.exp(Math.log(flight.d0) + (Math.log(d1) - Math.log(flight.d0)) * k);
      if (flight.dir1) camera.position.copy(flight.dir0).lerp(flight.dir1, k);
      camera.position.setLength(d);
      if (t >= 1) { flight = null; framedRadius = displayRadius(nodes[focusId].body); }
    } else if (rig.mode === 'fly' && !surface) {
      // FREE MOVE (#39): the floating origin rides on the nearest body, so the camera moves with it and stays precise
      updateAnchor();
      focusPos.copy(nodes[anchorId].pos);
    } else {
      focusPos.copy(target);
      // Switching ENHANCED ⇄ TRUE while framing a body: keep it the same size on screen.
      if (siteView && !surface) updateSiteView();
      else if (!surface && overviewAU == null && framedRadius) {
        const r = displayRadius(nodes[focusId].body);
        camera.position.multiplyScalar(r / framedRadius);
        framedRadius = r;
      }
    }
    root.position.copy(focusPos).negate();
    if (zones) updateZones(jd);
    if (zones && helmLayer && !helmLayer.look.bodiesVisible) for (const o of [zones.geo.object, ...zones.va.map((z) => z.object), zones.helio.group, zones.oort, ...zones.hill.map((h) => h.shape.object)]) o.visible = false;
    updateExtras(jd);
    const deckHides = !!helmLayer && !helmLayer.look.bodiesVisible; // under Venus' deck at the helm: no sky (#83)
    if (belts) { belts.update(jd); belts.points.visible = settings.get('belts') && !deckHides; }
    if (sats && nodes.earth) {
      sats.points.visible = settings.get('satellites') && !deckHides;
      sats.points.position.copy(nodes.earth.pos);
      sats.update(jd, trueRadius(nodes.earth.body), enhancedRadius(nodes.earth.body, model.scale), scaleMix, clock.rate.days ?? 0);
    }
    // near plane follows the camera so 100 m spacecraft can be seen at true scale
    const near = Math.min(1e-7, Math.max(1e-15, (siteView ? camera.position.distanceTo(controls.target) : camera.position.length()) * 1e-3));
    if (!surface && Math.abs(near - camera.near) / camera.near > 0.2) { camera.near = near; camera.updateProjectionMatrix(); }
    for (const m of lit) m.uniforms.uSunPos.value.copy((nodes[m.userData.host] ?? nodes[model.starId]).pos).add(root.position);
    updateShadows(jd);
    updatePlanetshine(jd);
    updateEclipseLines(jd);
    updateTracks(jd);
    updateMissions(jd);
    updateTransfer(jd);
    updateMagFields(jd, now);
    if (model?.isSol && band.id !== 'full') { // Jupiter's synchrotron belts in radio bands (#61)
      radioBelts ??= createRadioBelts({ radial: (body, r) => localMap(body, magTmp.set((r * body.radiusKm) / AU_KM, 0, 0)).length() / displayRadius(body) });
      radioBelts.update(nodes, `${scaleMix.toFixed(3)}|${model.scale}`, PAL_RGB[paletteIndex(band.palette)]);
    } else radioBelts?.update({}, '', [0, 0, 0]);
    for (const id in nodes) if (nodes[id].clouds) updateCloudShell(nodes[id], jd, now);
    if (liveState.sun && nodes.sun && nodes.earth) { // the live solar disk faces Earth, solar north up
      const u = nodes.sun.mesh.material.uniforms;
      u.uEarthDir.value.copy(nodes.earth.pos).sub(nodes.sun.pos).normalize();
      u.uNorth.value.copy(poleVector(nodes.sun.body.pole));
    }
    if (nodes.earth && band.id !== 'full') for (const id in nodes) { // whole-disc band images face Earth, the body's north as imaged (#28)
      const n = nodes[id], u = n.mesh?.material?.uniforms;
      if (!(u?.uDiscOn?.value > 0.5)) continue;
      u.uDiscE.value.copy(nodes.earth.pos).sub(n.pos).normalize();
      if (n.body.pole) u.uDiscN.value.copy(poleVector(n.body.pole));
    }
    // the night sky from a surface (#48)
    if (surface && !skyClustersAsked) { skyClustersAsked = true; fetchClusters().then((d) => skyLayers.setClusters(d)).catch(() => {}); }
    skyLayers.update({ on: !!surface && band.id === 'full', fade: skyMat.uniforms.uFade.value, camera,
      flags: { deepsky: settings.get('deepsky') !== false, constellations: !!settings.get('constellations'), labels: settings.get('labels') } });
    // #80: denser globes and terrain patches near the camera (standing on a body: around the spot)
    root.updateMatrixWorld(true);
    for (const id in nodes) {
      const n = nodes[id];
      if (!relief.has(id) || !n.group.visible) continue;
      const camLocal = n.mesh.worldToLocal(reliefCam.copy(camera.position));
      relief.update(n, { camLocal, focused: id === focusId, surface: surface?.id === id && surface.sphere ? { dir: reliefDir.copy(surface.local).normalize() } : null, fov: camera.fov });
    }
    const orbiting = rig.update(now);
    if (surface) { updateSurface(jd); surfaceSky(); }
    else if (helm.active) { /* the helm drives the camera (and OrbitControls in its ORBIT view) */ }
    else {
      controls.minDistance = siteView ? displayRadius(nodes[focusId].body) * 2e-5 : viewEnvelope(nodes[focusId].body) * 1.3;
      if (orbiting) controls.update();
    }

    updateSunCorona(jd, now);
    renderer.render(scene, camera);
    drawCorona();
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

  // ---- Earth through time (#54): sea level, ice sheets and past coastlines on the globe -------------
  let paleo = null, paleoScenario = null, paleoApplied;
  const paleoBanner = document.createElement('div');
  paleoBanner.className = 'paleo-banner';
  paleoBanner.hidden = true;
  container.append(paleoBanner);
  function updatePaleoEarth(jd) {
    const earth = model?.isSol ? nodes.earth : null;
    if (!earth?.mesh?.material?.uniforms?.uPaleo) { paleoBanner.hidden = true; return; }
    paleo ??= createPaleoEarth(earth.mesh.material, { fetchCoastlines: (ma) => fetch(`/api/paleo-coastlines?time=${ma}`).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))) });
    if (paleoApplied !== paleoScenario) { paleo.setScenario(paleoScenario); paleoApplied = paleoScenario; }
    // years from now: the deep-time clock where there is one (#34), else from the calendar JD
    paleo.update(typeof clock.years === 'number' ? clock.years : (jd - jdFromDate(new Date())) / 365.25);
    const t = paleo.banner;
    // today's clouds do not belong on another epoch's Earth
    earth.paleoOn = !!t; // updateCloudShell hides the shell (#83)
    paleoBanner.hidden = !t;
    if (t && paleoBanner.textContent !== t) paleoBanner.textContent = t;
  }

  // ---- clouds and ground (#83) --------------------------------------------------------------------
  /**
   * The helm under Venus' deck (#42, #83): the same dim orange overcast as standing there (clouds.js layerLook):
   * the ground's light and fog, the murk veil, the sky colour, no Sun, no other bodies, labels or orbit lines, and
   * the ship lit by the diffuse light. Undone when the ship climbs out or the helm is left.
   */
  let helmLayer = null;
  const hlOff = new THREE.Vector3(), hlSun = new THREE.Vector3();
  function helmCloudLight(origin) {
    const prev = helmLayer;
    helmLayer = null;
    const id = origin && !surface ? helm.anchor : null, n = id ? nodes[id] : null, L = n && model.isSol ? cloudLayer(id) : null;
    if (L && nodes[model.starId]) {
      hlOff.copy(origin).sub(n.pos);
      const altKm = hlOff.length() * AU_KM - (L.refRadiusKm ?? n.body.radiusKm);
      hlSun.copy(nodes[model.starId].pos).sub(origin).normalize();
      const sunAlt = (Math.asin(Math.max(-1, Math.min(1, hlOff.clone().normalize().dot(hlSun)))) * 180) / Math.PI;
      const look = helmLayerLook(id, altKm, sunAlt);
      if (look) helmLayer = { id, look, altKm };
    }
    const ship = helm.shipObject;
    if (prev && prev.id !== helmLayer?.id) { // climbed out (or left the helm): put the light back
      resetLayerLight(prev.id);
      scene.background = null; skyMat.uniforms.uFade.value = 1;
      starLight.color.setHex(model.bodies.find((b) => b.id === model.starId)?.color ?? 0xfff4e0); starLight.intensity = 2.4;
      ship.traverse((o) => { if (o.material?.isMeshStandardMaterial && o.material.envMap) o.material.envMapIntensity = 0.8; });
    }
    if (!helmLayer) return;
    const look = helmLayer.look, gu = n.mesh.material.uniforms;
    if (gu.uSkyAmb) {
      gu.uSunColor.value.setRGB(1.3 * look.sunScale * look.sunTint[0], 1.3 * look.sunScale * look.sunTint[1], 1.3 * look.sunScale * look.sunTint[2]);
      gu.uSkyAmb.value.setRGB(...look.skyAmb);
      gu.uSkyUp.value.copy(hlOff).normalize();
      gu.uFogK.value = look.fogK * AU_KM;
      gu.uFogCol.value.setRGB(...look.fogRgb);
    }
    murkVeil ??= createMurkVeil(scene);
    murkVeil.set(look.murk, look.murkRgb);
    const k = look.sky;
    scene.background = (scene.background?.isColor ? scene.background : new THREE.Color()).setRGB(k[0], k[1], k[2], THREE.LinearSRGBColorSpace);
    skyMat.uniforms.uFade.value = look.starFade ?? 0;
    // the ship in the same diffuse orange light
    starLight.color.setRGB(...look.sunTint); starLight.intensity = 2.4 * look.sunScale;
    const env = 0.8 * Math.max(0.08, Math.pow(look.light, 0.25));
    ship.traverse((o) => { if (o.material?.isMeshStandardMaterial && o.material.envMap) o.material.envMapIntensity = env; });
    if (!look.bodiesVisible) for (const k2 in nodes) {
      if (k2 === id) continue;
      const m = nodes[k2];
      m.group.visible = false; m.label.visible = false;
      if (m.orbit) { m.orbit.visible = false; fat.sync(m.orbit, 1); } // and its thick twin (#27)
      if (m.endMark) m.endMark.visible = false;
    }
    if (nodes[id].orbit) { nodes[id].orbit.visible = false; fat.sync(nodes[id].orbit, 1); }
  }
  const cloudSun = new THREE.Vector3();
  /**
   * Each frame for a body with a cloud shell: its rotation against the ground (Venus super-rotates; today's
   * imagery is registered; the 2004 snapshot drifts), its map (today's GIBS clouds by whiteness, else the static
   * map), visibility (band, deep time, standing under Venus' deck) and the shadows it casts on the ground.
   */
  function updateCloudShell(n, jd, now) {
    const c = n.clouds, cu = c.material.uniforms, gu = n.mesh?.material?.uniforms, L = c.userData.layer;
    const liveTex = !c.userData.opaque && liveState[n.body.id] && gu?.uHasLive?.value > 0.5 ? gu.uLive.value : null;
    c.userData.live = !!liveTex;
    // #83: Earth's measured clouds: NOAA-20's cloud-top heights and true colour of the same day (when live skins are on)
    const slices = !!c.userData.slices;
    if (slices && settings.get('liveSkins') && !c.userData.ecAsked) { c.userData.ecAsked = true; loadEarthClouds().then((ec) => { c.userData.ec = ec; }); }
    const ec = slices && settings.get('liveSkins') ? c.userData.ec : null;
    c.userData.measured = ec ? ec.date : null;
    if (c.userData.opaque) c.rotation.y = n.mesh.rotation.y + superRotation(L, jd);
    else if (ec) {
      c.rotation.y = n.mesh.rotation.y;
      if (cu.uMap.value !== ec.colour) cu.uMap.value = ec.colour;
      cu.uAlphaFromLuma.value = 2; cu.uCth.value = ec.heights; cu.uCthOn.value = 1; cu.uSnowOn.value = 0;
    } else if (liveTex) {
      c.rotation.y = n.mesh.rotation.y; if (cu.uMap.value !== liveTex) cu.uMap.value = liveTex; cu.uAlphaFromLuma.value = 2;
      if (cu.uCthOn) { cu.uCthOn.value = 0; const ice = icePriorTexture(); cu.uSnowMask.value = ice; cu.uSnowOn.value = ice ? 1 : 0; } // MODELLED: persistent ice is not cloud
    } else {
      c.rotation.y = (now / 1000) * 0.004; // a static 2004 snapshot, drifted gently so it reads as weather
      if (c.userData.staticTex && cu.uMap.value !== c.userData.staticTex) cu.uMap.value = c.userData.staticTex;
      cu.uAlphaFromLuma.value = 1;
      if (cu.uCthOn) { cu.uCthOn.value = 0; cu.uSnowOn.value = 0; }
    }
    if (!c.userData.opaque) { // #83 (speckles): draw only the faces the camera can see, never a shell's far side
      const camLocalD = n.mesh.worldToLocal(cloudSun.copy(camera.position)).length();
      if (slices) cloudDetail(c, camLocalD < 1.15); // fine geometry close up: a coarse sphere's facets sag kilometres below the slice heights
      cloudSides(c, camLocalD);
    }
    const standing = surface?.id === n.body.id ? surface : helmLayer?.id === n.body.id ? { layerLook: helmLayer.look } : null;
    c.visible = n.cloudBandOK !== false && !n.paleoOn && !(standing?.layerLook?.hideShell);
    if (!gu) return;
    if (gu.uLiveSplit) gu.uLiveSplit.value = liveTex && c.visible ? 1 : 0; // the clouds are on the shell, not the ground
    if (gu.uCloudMode) { // shadows on the ground: Earth's shell (Venus' light is diffuse under its deck)
      const on = L && !c.userData.opaque && c.visible && band.id === 'full' && cu.uMap.value?.image;
      gu.uCloudMode.value = on ? cu.uAlphaFromLuma.value : 0;
      if (on) {
        gu.uCloudTex.value = cu.uMap.value;
        gu.uCloudH.value = (slices ? (L.topKm + L.baseKm) / 2 : L.shellKm) / n.body.radiusKm; // the volume's middle
        if (gu.uCloudGateOn) { gu.uCloudGateOn.value = ec ? 1 : 0; gu.uCloudGate.value = ec ? ec.heights : null; }
        gu.uCloudU.value = (n.mesh.rotation.y - c.rotation.y) / (2 * Math.PI);
        const star = nodes[n.mesh.material.userData.host] ?? nodes[model.starId];
        if (star) gu.uSunL.value.copy(n.mesh.worldToLocal(star.group.getWorldPosition(cloudSun))).normalize();
      }
    }
  }

  // ---- scenarios (#53): opt-in "what if" visuals, always labelled MODELLED -------------------------
  //   star: { ra, dec (J2000 deg), mag, label, color? }: a supernova at its real place in the sky.
  //   ring: { body, innerKm, outerKm, label }: a new ring (Desdemona–Cressida debris, Phobos).
  let scenario = null;
  function clearScenario() {
    if (!scenario) return;
    if (scenario.star) { scene.remove(scenario.star); scenario.star.geometry.dispose(); }
    if (scenario.ring) { scenario.ring.parent?.remove(scenario.ring); scenario.ring.geometry.dispose(); }
    for (const l of scenario.labels) l.parent?.remove(l), l.element.remove();
    scenario = null;
  }
  function scenarioLabel(text) {
    const el = document.createElement('button');
    el.className = 'body-label scenario-label';
    const x = document.createElement('span');
    x.textContent = ' ✕'; x.dataset.snapshot = 'skip'; // postcards (#40) leave the close mark out
    el.append(text, x);
    el.title = 'A modelled scenario (#53). Click to remove it.';
    el.addEventListener('pointerdown', (e) => e.stopPropagation());
    el.addEventListener('click', (e) => { e.stopPropagation(); setScenario(null); });
    const obj = new CSS2DObject(el);
    obj.center.set(-0.1, 0.5);
    return obj;
  }
  function setScenario(s) {
    clearScenario();
    if (!s) return;
    scenario = { labels: [] };
    if (s.star) {
      const d = poleVector([s.star.ra, s.star.dec]).multiplyScalar(SKY_R * 0.97);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([d.x, d.y, d.z]), 3));
      g.setAttribute('size', new THREE.BufferAttribute(new Float32Array([Math.min(34, Math.max(4, 6.2 - 1.6 * s.star.mag))]), 1));
      g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(s.star.color ?? [0.85, 0.9, 1]), 3));
      // the sky's own point shader; not faded by daylight: brighter than magnitude −4 it shows by day
      const mat = skyMat.clone();
      mat.uniforms = { uPixel: skyMat.uniforms.uPixel, uFade: { value: s.star.mag < -4 ? 1 : skyMat.uniforms.uFade.value } };
      scenario.star = new THREE.Points(g, mat);
      scenario.star.renderOrder = 0; scenario.star.frustumCulled = false;
      const label = scenarioLabel(s.star.label);
      label.position.copy(d);
      scenario.star.add(label); scenario.labels.push(label);
      scene.add(scenario.star);
    }
    if (s.ring && nodes[s.ring.body]) {
      const n = nodes[s.ring.body], r = n.body.radiusKm;
      const geo = new THREE.RingGeometry(s.ring.innerKm / r, s.ring.outerKm / r, 160, 1);
      const mat = new THREE.MeshBasicMaterial({ color: 0xc9b9a8, transparent: true, opacity: 0.42, side: THREE.DoubleSide, depthWrite: false });
      scenario.ring = new THREE.Mesh(geo, mat);
      scenario.ring.rotation.x = -Math.PI / 2;
      n.tilt.add(scenario.ring); // in the planet's equator, scaled with it like its real rings
      const label = scenarioLabel(s.ring.label);
      label.position.set(s.ring.outerKm / r, 0, 0);
      scenario.ring.add(label); scenario.labels.push(label);
    }
  }

  // #80: for browser checks and the console (like window.__fidelityCameras): relief state, and a camera
  // placed `phaseDeg` from the sunward direction of the focused body at `dist` display radii (terminator views)
  if (typeof window !== 'undefined') window.__fidelityRelief = {
    relief,
    get nodes() { return nodes; }, // #83: body nodes (globe, cloud shell) for browser checks
    elevationAt: (id, lat, lon) => (nodes[id] && relief.has(id) ? relief.elevationAtDir(id, siteDir(nodes[id].body, lat, lon), 99, false) : null),
    terminatorView(phaseDeg = 80, dist = 2.6) {
      const n = nodes[focusId], sun = nodes[model.starId];
      if (!n || !sun) return false;
      const toSun = sun.pos.clone().sub(n.pos).normalize(), pole = new THREE.Vector3(0, 1, 0).applyQuaternion(n.tilt.quaternion);
      const side = pole.clone().cross(toSun).normalize();
      const dir = toSun.clone().multiplyScalar(Math.cos(phaseDeg * DEG)).addScaledVector(side, Math.sin(phaseDeg * DEG)).normalize();
      flight = null; overviewAU = null;
      camera.position.copy(dir.multiplyScalar(displayRadius(n.body) * dist));
      controls.target.set(0, 0, 0); framedRadius = displayRadius(n.body);
      return true;
    },
    /** Camera over planetocentric lat/lon of the focused body at `dist` display radii; → the Sun's altitude there (deg). */
    overSite(lat, lon, dist = 1.6) {
      const n = nodes[focusId], sun = nodes[model.starId];
      if (!n || !sun) return null;
      root.updateMatrixWorld(true);
      const g = n.sites?.group ?? n.mesh, w = n.mesh.getWorldPosition(new THREE.Vector3());
      const up = new THREE.Vector3(...siteDir(n.body, lat, lon)).applyMatrix4(g.matrixWorld).sub(w).normalize();
      flight = null; overviewAU = null;
      camera.position.copy(up).multiplyScalar(displayRadius(n.body) * dist);
      controls.target.set(0, 0, 0); framedRadius = displayRadius(n.body);
      return 90 - up.angleTo(sun.pos.clone().sub(n.pos)) / DEG;
    },
    /** Sun–body–camera angle (deg) for the focused body. */
    phaseNow() {
      const n = nodes[focusId], sun = nodes[model.starId];
      if (!n || !sun) return null;
      const w = n.mesh.getWorldPosition(new THREE.Vector3()), u = n.mesh.material.uniforms?.uSunPos?.value;
      return { geometric: sun.pos.clone().sub(n.pos).angleTo(camera.position.clone().sub(n.pos).add(focusPos)) / DEG, shader: u ? u.clone().sub(w).angleTo(camera.position.clone().sub(w)) / DEG : null };
    },
  };

  const viewApi = {
    /** #40: what a postcard must declare: the paleo-Earth banner and any scenario labels showing. */
    get postcardFacts() { return { paleo: paleo?.banner ?? null, scenario: scenario ? scenario.labels.map((l) => l.element.firstChild?.textContent ?? '') : [] }; },
    /** #40, #79: the 3D corona's provenance for a postcard when it is drawn and the Sun is in frame (coronaPostcard), else null. */
    get postcardCorona() {
      const c = model?.isSol ? nodes[model.starId]?.corona : null;
      return c?.mesh.visible && viewApi.framed(1).some((f) => f.id === model.starId) ? coronaPostcard(c) : null;
    },
    /** #40: bodies drawn at least `minPx` screen pixels across radius: [{ id, name, px, lit (0–1), from (lit side on screen), map, live, imagined }], biggest first. */
    framed(minPx = 3) {
      const H = renderer.domElement.clientHeight || 800, f = (H / 2) / Math.tan((camera.fov * Math.PI) / 360);
      const out = [], wp = new THREE.Vector3(), ndc = new THREE.Vector3();
      for (const [id, n] of Object.entries(nodes)) {
        if (!n.mesh || !n.group.visible || n.body.marker) continue; // regions and Lagrange points are markers, not bodies
        n.mesh.getWorldPosition(wp);
        n.mesh.geometry?.computeBoundingSphere?.();
        const sc = n.mesh.getWorldScale(new THREE.Vector3());
        const r = (n.mesh.geometry?.boundingSphere?.radius ?? 1) * Math.max(sc.x, sc.y, sc.z), d = wp.distanceTo(camera.position);
        const standing = surface?.id === id;
        ndc.copy(wp).project(camera);
        const ahead = wp.clone().sub(camera.position).dot(camera.getWorldDirection(new THREE.Vector3())) > 0;
        const px = d > r ? (r / Math.sqrt(d * d - r * r)) * f : Infinity;
        const near = px > 2 * H; // filling the view: its centre may sit off-screen
        if (!standing && !(near || (ahead && Math.abs(ndc.x) < 1 + px / H && Math.abs(ndc.y) < 1 + px / H))) continue;
        if (!standing && px < minPx) continue;
        // phase as seen from the camera: the lit fraction of the disc, and which side the light comes from on screen
        let lit = null, from = null;
        const sunNode = nodes[model.starId];
        if (sunNode && id !== model.starId && !standing) {
          const sp = sunNode.group.getWorldPosition(new THREE.Vector3());
          const toSun = sp.clone().sub(wp).normalize(), toCam = camera.position.clone().sub(wp).normalize();
          lit = (1 + toSun.dot(toCam)) / 2;
          const a = wp.clone().project(camera), b = wp.clone().add(toSun.multiplyScalar(r)).project(camera);
          const dx = b.x - a.x, dy = b.y - a.y;
          if (Math.hypot(dx, dy) > 1e-6) from = `${dy > Math.abs(dx) * 0.5 ? 'upper ' : dy < -Math.abs(dx) * 0.5 ? 'lower ' : ''}${Math.abs(dx) > Math.abs(dy) * 0.5 ? (dx > 0 ? 'right' : 'left') : ''}`.trim();
        }
        out.push({ id, name: n.body.name, px, lit, from, map: n.body.skin?.map ?? null, live: liveState[id] ?? null, imagined: !!(n.body.surfacePending || !n.body.skin?.map || SKINS[n.body.skin?.map]?.tier === 'imagined') });
      }
      return out.sort((a, b) => b.px - a.px);
    },
    /** #40: re-render at w × h for a postcard (see views/snapshot.js). */
    snapshot: makeSnapshot({ renderer, scene, camera, labels, draw: () => { renderer.render(scene, camera); drawCorona({ full: true }); labels.render(scene, camera); }, restore: resize, setSize: (w, h) => fat.setSize(w, h) }),
    /** Earth through time (#54): { sea, label } (a sea level, m) or { ma } (GPlates coastlines) or null to follow the clock. */
    setEarthEpoch(s) { paleoScenario = s ?? null; },
    /** Opt-in scenario visuals (#53): { star?, ring? } or null to clear. */
    setScenario,
    /** In the surface view, turn to face J2000 RA/Dec (deg); false if not standing anywhere. */
    lookAtSky(ra, dec) {
      if (!surface?.frame) return false;
      const a = altAz(surface.frame, poleVector([ra, dec]).toArray());
      surface.az = a.az; surface.alt = Math.max(-5, Math.min(89.9, a.alt));
      return a;
    },
    /** The spectrum filter (#28): band id and bandpass id (null = the band's default). */
    setBand(bandId, passId) { band = bandById(bandId); pass = passById(band, passId); curve = null; applyBand(); },
    /** The spectrum control's curve (#66): follows the shared state (bandstate.js currentBand()). */
    setCurve() { const cb = currentBand(); band = cb.band; pass = cb.pass; curve = cb.custom ? cb.curve : null; applyBand(); },
    get band() { return { band, pass: pass ?? band.passes[0] ?? null, curve }; },
    /** How body `id` is drawn in the current band: { mode, tier, label, detail, res } or null in full spectrum. */
    bandLookOf: (id) => nodes[id]?.bandLook ?? null,
    /** The sky survey in use (the most heavily weighted), or null. */
    bandSky: () => (band.id === 'full' ? null : skyNow.layers[0] ?? null),
    /** Every survey blended into the sky: [{ sky, skyCredit, weight, look: { res } }] and the measured fraction. */
    bandSkies: () => (band.id === 'full' ? { layers: [], measured: 0 } : skyNow),
    show() { container.hidden = false; resize(); if (!running) { running = true; lastFrameAt = null; if (idleTimer == null) requestAnimationFrame(frame); } },
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
    /** Live solar wind for Earth's magnetopause (#38): { Dp nPa, Bz nT, time }. */
    setSolarWind(w) { if (!magFields) updateMagFields(clock.jd, performance.now()); magFields?.setWind(w); },
    /** Current magnetopause stand-off (body radii) for a body with a field, or null. */
    magnetopauseOf: (id) => magFields?.standoffOf(id) ?? null,
    /** Draw a transfer orbit (#45): { x: transfer(), label, compare?: Horizons AU points } or null to clear. */
    setTransfer,
    /** Heliocentric AU position on the drawn transfer at `jd`, or null. */
    transferPositionAt: (jd) => transferVizPosition(jd),
    /** Events-feed items with a flight model (#32); `opts.satrecFor(norad)` positions stations. */
    setMissionEvents(list, opts = {}) {
      missionEvents = list ?? [];
      if (opts.satrecFor) satrecFor = opts.satrecFor;
      missions?.setEvents(missionEvents);
    },
    /** Ids of the feed events drawn right now. */
    get activeMissions() { return missions?.active ?? []; },
    /** Frame Earth with the camera over a ground point (deg) from `distKm` above it. */
    viewEarthPoint(lat, lon, distKm = 9000) {
      if (!nodes.earth) return;
      flyTo('earth', { overview: localMap(nodes.earth.body, new THREE.Vector3((6378 + distKm) / AU_KM, 0, 0)).length() });
      const p = inertialPoint(clock.jd, lat, lon);
      camera.position.copy(toScene(p, new THREE.Vector3()).normalize().multiplyScalar(camera.position.length()));
    },
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
    focus(id, opts) { if (helm.active) { helm.select(id); return; } if (quietFocus === id && focusId === id) { quietFocus = null; return; } flyTo(id, opts); },
    /** HELM (#42): engage, set course, read-outs (see views/ship/helm.js). */
    helm,
    /** The camera controls (#39): mode, zoom, fit, reset, bookmark state. */
    camera: rig,
    /** True while the return to ORBIT (#39) is already flying to `id` (no warp, no second flight). */
    quietFocus: (id) => quietFocus === id && focusId === id,
    /** #80: height (m) at planetocentric lat / east lon on body `id` from its DEM: { h, meta, res, cellKm } or null. */
    elevationAt(id, lat, lon) {
      const n = nodes[id];
      if (!n || !relief.has(id)) return null;
      return relief.elevationAtDir(id, siteDir(n.body, lat, lon), 99, false);
    },
    /** #80: the ground under the surface view, or null. */
    get groundHere() { return surface?.ground ?? null; },
    /** Where we stand (texture lat/lon, as surfaceAt takes them), or null. */
    surfaceSpot: () => (surface?.sphere ? dirToLatLon(surface.local.toArray()) : null),
    /** Stand on body `id` at latitude/longitude (deg) and look up. */
    /** VIEW FROM ABOVE: hover over a surface site, framing `spanKm` around it (#37). */
    viewSite(id, lat, lon, spanKm = 30) {
      if (!nodes[id]) return false;
      if (helm.active) { helm.disengage({ quiet: true }); flyTo(id); }
      if (focusId !== id || surface) flyTo(id);
      siteView = { id, lat, lon, spanKm, ready: false };
      return true;
    },
    endSiteView() { if (siteView) { endSiteView(); flyTo(focusId); } },
    get siteView() { return siteView ? { id: siteView.id, lat: siteView.lat, lon: siteView.lon } : null; },
    /** LOOK AT (#43): view `target` from `obs` ('surface' or 'orbit'); `apparent` corrects for light-time. */
    lookAt(obs, target, opts) { return lookAtBody(obs, target, opts); },
    get lookInfo() { return surface?.look ? { ...surface.look.info, obs: surface.look.obs, target: surface.look.target, orbit: surface.look.orbit } : null; },
    /** Stand at a site given in planetographic east longitude (sites, search): converted to the map's longitude. */
    surfaceAtSite(id, lat, lon, opts) { const b = nodes[id]?.body; return this.surfaceAt(id, lat, lon - ((b?.texLon0 ?? -180) + 180), opts); },
    surfaceAt(id, lat, lon, { lookSun = false, look = null, daylight = null, layer = 'ground' } = {}) {
      const n = nodes[id];
      if (!n || isStar(n.body)) return false;
      const local = new THREE.Vector3(...latLonToDir(lat, lon));
      enterSurface(id, { object: n.mesh, local, normal: local.clone(), layer }); // #83: sites, renders and events stand on the ground; layer 'clouds' on the tops
      surface.lookSun = lookSun;
      surface.lookBest = look === 'best';
      surface.daylight = daylight;
      return true;
    },
    /** Planetshine on a moon now (#49): { f (fraction of sunlight), alpha (phase angle at the planet), parent, name } or null. */
    planetshineOf(id) {
      if (psState[id] || !model?.isSol) return psState[id] ?? null;
      unmapped = true;
      try { return planetshineAt(id, clock.jd); } finally { unmapped = false; }
    },
    /** The surface view's apparent sizes (#47): [{ id, label, deg (true), renderedDeg }], and the field. */
    surfaceInfo() { return surface ? { fov: surface.fov, hfov: horizontalFov(surface.fov, camera.aspect), preset: surface.preset, enlarge: surface.enlarge, az: surface.az, alt: surface.alt,
      sizes: (surface.sizes ?? []).map(({ id, label, deg, renderedDeg }) => ({ id, label, deg, renderedDeg })) } : null; },
    /** Point the surface camera: { az, alt, fov, preset, enlarge } (any subset). */
    surfaceLook(o = {}) {
      if (!surface) return false;
      if (o.preset) { const p = FOV_PRESETS.find((x) => x.id === o.preset); if (p) { surface.fov = presetFov(p, camera.aspect); surface.preset = p.id; } }
      for (const k of ['az', 'alt', 'fov', 'enlarge']) if (o[k] != null) surface[k] = o[k];
      if (o.target) { const d = (surface.sizes ?? []).find((x) => x.id === o.target); if (d && surface.frame) { const a = altAz(surface.frame, d.pos.clone().sub(camera.position).toArray()); surface.az = a.az; surface.alt = Math.min(89.9, a.alt); } }
      return true;
    },
    /** #36: the surface view as a JPEG data URL (≤ maxW px wide) with its read-out, or null when not standing. */
    capture(maxW = 640) {
      if (!surface) return null;
      renderer.render(scene, camera); // the drawing buffer is only readable in the task that drew it
      const src = renderer.domElement, k = Math.min(1, maxW / src.width);
      const c = Object.assign(document.createElement('canvas'), { width: Math.round(src.width * k), height: Math.round(src.height * k) });
      c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
      const ll = surface.sphere ? dirToLatLon(surface.local.toArray()) : null;
      let lon = ll ? ll.lon + ((nodes[surface.id].body.texLon0 ?? -180) + 180) : null; // planetocentric
      if (lon > 180) lon -= 360;
      return { url: c.toDataURL('image/jpeg', 0.82), hud: hudText.textContent, sub: hudSub.textContent, jd: clock.jd,
        lat: ll?.lat ?? null, lon, look: { az: surface.az, alt: surface.alt, fov: surface.fov } };
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
    /** #83: DESCEND ('down') / ASCEND ('up') through the cloud layer in the surface view; false where there is none. */
    descend,
    /** #83: the layer state in the surface view: { phase, altKm (above the ground), where, murk, sunVisible, readout } or null. */
    get surfaceLayer() {
      if (!surface?.descent) return null;
      const L = surface.layerLook;
      return { phase: surface.descent.phase, altKm: surface.descent.altKm, where: L?.where ?? null, murk: L?.murk ?? null, cover: surface.cover ?? null, sunVisible: L?.sunVisible ?? null, light: L?.light ?? null, readout: hudLayer.textContent };
    },
    overview(au, centre, localKm) {
      if (localKm && nodes[centre]) au = 2.4 * localMap(nodes[centre].body, new THREE.Vector3(localKm / AU_KM, 0, 0)).length();
      flyTo(centre && nodes[centre] ? centre : model.starId, { overview: au });
    },
    get focusId() { return focusId; },
    /** True (physical) scene position of a body, AU, at the clock (or at `jd`): no ENHANCED compression around planets. */
    positionOf: (id, jd) => truePosition(id, jd ?? clock.jd).toArray(),
    /** Distance (AU) from a body to its own star (planets), its parent (moons, local craft) or the system's centre (stars). */
    hostDistance(id) {
      const b = nodes[id]?.body;
      const p = truePosition(id);
      if (!b || isStar(b)) return p.length();
      if (b.parent && nodes[b.parent]) return p.distanceTo(truePosition(b.parent));
      if (b.orbit?.type === 'moon') return Math.hypot(...moonOffsetKm(b.moon, clock.jd)) / AU_KM;
      return p.distanceTo(b.orbit?.host ? hostScene(b.orbit.host, clock.jd, new THREE.Vector3()) : new THREE.Vector3());
    },
    enhancementOf: (id) => (nodes[id] ? enhancement(nodes[id].body, model.scale) : 1), // 1 while another system loads
    /** { time, credit, feed } if body `id` wears a live skin right now. */
    liveSkinOf: (id) => liveState[id] ?? null,
  };
  if (typeof window !== 'undefined') window.__fidelityRelief.view = viewApi;
  return viewApi;
}
