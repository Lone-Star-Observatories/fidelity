// The night sky from a surface (#48): the Milky Way from ESA's Gaia DR3 colour flux map, deep-sky
// objects at their true positions, sizes and orientations (nebula and galaxy images where licensed,
// rings for star clusters at their measured half-member radius), and constellation figures with
// names. Everything sits on the celestial sphere (directions only), in the scene's ecliptic frame;
// the daylight model fades it with the stars.

import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { eqToEcl, frameToScene } from '../../astro/frames.js';
import { raDecToUnit, imageAxes, paAxes, galToRaDec, MILKY_WAY } from '../../data/skylayers.js';
import { CONSTELLATION_LINES, CONSTELLATION_LABELS } from '../../data/constellation-lines.js';
import { CONSTELLATION_NAMES } from '../../data/constellations.js';
import { NEBULAE, NEBULA_KIND, FAMOUS_CLUSTERS } from '../../data/deepsky.js';
import { NEBULA_3D } from '../../data/nebula3d.js';
import { GALAXY_IMAGES } from '../../data/galaxy-images.js';
import { nebulaImageUrl } from '../../data/catalog.js';

const LOGV = '#include <common>\n#include <logdepthbuf_pars_vertex>\n';
const LOGF = '#include <logdepthbuf_pars_fragment>\n';
const toScene = (u) => new THREE.Vector3(...frameToScene(eqToEcl(u)));

// Milky Way sphere: equirectangular in RA/Dec, RA 0 at the centre increasing to the left (hips2fits CAR)
const MW_FRAG = `${LOGF}varying vec3 vDir; uniform sampler2D uMap; uniform float uOpacity;
  void main() {
    #include <logdepthbuf_fragment>
    vec3 e = vec3(vDir.x, -vDir.z, vDir.y); float ob = 0.40909280;
    vec3 q = vec3(e.x, e.y * cos(ob) - e.z * sin(ob), e.y * sin(ob) + e.z * cos(ob));
    float ra = atan(q.y, q.x), dec = asin(clamp(q.z, -1.0, 1.0));
    vec3 t = texture2D(uMap, vec2(fract(0.5 - ra / 6.2831853), 0.5 + dec / 3.1415927)).rgb;
    gl_FragColor = vec4(t * uOpacity, 1.0);
    #include <colorspace_fragment>
  }`;
const MW_VERT = `${LOGV}varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  #include <logdepthbuf_vertex>
  }`;
// deep-sky image: sky level subtracted, a soft round edge so no square shows
const DSO_VERT = `${LOGV}varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  #include <logdepthbuf_vertex>
  }`;
const DSO_FRAG = `${LOGF}varying vec2 vUv; uniform sampler2D uMap; uniform float uOpacity, uBlack, uGain, uRound;
  void main() {
    #include <logdepthbuf_fragment>
    vec3 t = max(texture2D(uMap, vUv).rgb - uBlack, 0.0) * uGain;
    vec2 c = abs(vUv - 0.5) * 2.0;
    float r = uRound > 0.5 ? length(c) : max(c.x, c.y);
    gl_FragColor = vec4(t * uOpacity * smoothstep(1.0, 0.82, r), 1.0);
    #include <colorspace_fragment>
  }`;

export function createSkyLayers({ scene, radius, loadTexture, onPick }) {
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);
  const R = radius;
  const labels = [];
  const label = (text, cls, dir, data) => {
    const el = document.createElement(data ? 'button' : 'div');
    el.className = `nav-label ${cls}`;
    el.textContent = text;
    if (data) { el.title = data.title ?? ''; el.addEventListener('pointerdown', (e) => e.stopPropagation()); el.addEventListener('click', (e) => { e.stopPropagation(); onPick?.(data); }); }
    const o = new CSS2DObject(el);
    o.position.copy(dir).multiplyScalar(R * 0.9);
    o.center.set(-0.06, 0.5);
    group.add(o);
    labels.push({ o, kind: cls });
    return o;
  };

  // ---- Milky Way ------------------------------------------------------------------------------
  const mwMat = new THREE.ShaderMaterial({ uniforms: { uMap: { value: null }, uOpacity: { value: 0 } }, vertexShader: MW_VERT, fragmentShader: MW_FRAG,
    side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const milky = new THREE.Mesh(new THREE.SphereGeometry(R * 0.96, 96, 48), mwMat);
  milky.renderOrder = -3; milky.frustumCulled = false;
  group.add(milky);
  let mwState = 'idle';
  const loadMilkyWay = () => {
    if (mwState !== 'idle') return;
    mwState = 'loading';
    loadTexture(`/api/hips?id=${encodeURIComponent(MILKY_WAY.hips)}`).then((t) => { mwMat.uniforms.uMap.value = t; mwState = t ? 'ready' : 'failed'; });
  };

  // ---- deep-sky images ------------------------------------------------------------------------
  const dso = new THREE.Group();
  group.add(dso);
  const quads = [];
  function quad({ key, ra, dec, wArcmin, hArcmin, north = 0, black = 0, gain = 1, round = false, opacity = 0.6 }) {
    const dir = toScene(raDecToUnit(ra, dec)).normalize();
    const ax = imageAxes(ra, dec, north), up = toScene(ax.up).normalize(), z = dir.clone().negate(), right = up.clone().cross(z).normalize();
    const mat = new THREE.ShaderMaterial({ uniforms: { uMap: { value: null }, uOpacity: { value: 0 }, uBlack: { value: black }, uGain: { value: gain }, uRound: { value: round ? 1 : 0 } },
      vertexShader: DSO_VERT, fragmentShader: DSO_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, z));
    const d = R * 0.92, k = (a) => 2 * d * Math.tan(((a / 60) * Math.PI) / 360);
    m.scale.set(k(wArcmin), k(hArcmin), 1);
    m.position.copy(dir).multiplyScalar(d);
    m.renderOrder = -2; m.frustumCulled = false;
    dso.add(m);
    quads.push({ m, key, opacity, state: 'idle' });
    return dir;
  }
  // nebulae: their #24 images, registered by the image's own astrometry
  for (const [name, kind, ra, dec, ly, note] of NEBULAE) {
    const n = NEBULA_3D[name], img = n?.img;
    const dir = img?.fov ? quad({ key: img.key, ra: img.ra, dec: img.dec, wArcmin: img.fov[0], hArcmin: img.fov[1], north: img.north ?? 0, black: img.black ?? 0.02, gain: 1.1, opacity: 0.55 })
      : toScene(raDecToUnit(ra, dec)).normalize();
    label(name.toUpperCase(), 'sky-dso neb', dir, { kind: 'nebula', id: `neb-${name}`, name, sub: NEBULA_KIND[kind] ?? kind, distLy: ly, note, sizeArcmin: n?.model?.R ? 2 * n.model.R : null,
      credit: img?.credit, licence: img?.licence, title: `${NEBULA_KIND[kind] ?? kind} · ${ly.toLocaleString('en')} LY. Image: ${img?.credit ?? 'none'}` });
  }
  // galaxies: survey cutouts centred on each, north up, at the cutout's true field
  for (const g of GALAXY_IMAGES) {
    const dir = quad({ key: g.img.key, ra: g.ra, dec: g.dec, wArcmin: g.img.fov, hArcmin: g.img.fov, black: 0.09, gain: 1.35, round: true, opacity: 0.6 });
    label(g.name.toUpperCase(), 'sky-dso gal', dir, { kind: 'galaxy', id: `gal-${g.ungc}`, name: g.name, sub: g.type.toUpperCase(), sizeArcmin: g.d25, pa: g.pa, incl: g.incl, orient: g.orient, orientSource: g.orientSource,
      credit: g.img.credit, licence: g.img.licence, title: `${g.type} galaxy · D25 ${g.d25}′ · PA ${g.pa}°. Image: ${g.img.credit}` });
  }
  // star clusters: a ring at the Hunt & Reffert half-member radius (filled by setClusters)
  const rings = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xffcc99, transparent: true, opacity: 0.5, depthWrite: false }));
  rings.renderOrder = -1; rings.frustumCulled = false;
  dso.add(rings);
  let clustersSet = false;
  function setClusters(d) {
    if (clustersSet || !d?.rows) return;
    clustersSet = true;
    const f = Object.fromEntries(d.fields.map((k, i) => [k, i])), pts = [];
    for (const r of d.rows) {
      const common = FAMOUS_CLUSTERS[r[f.name]];
      if (!common) continue;
      const [ra, dec] = galToRaDec(r[f.l], r[f.b]), radArcmin = (Math.atan(r[f.r50pc] / r[f.distPc]) * 180 / Math.PI) * 60;
      const { major, minor } = paAxes(ra, dec, 0), c = raDecToUnit(ra, dec), a = (radArcmin / 60) * Math.PI / 180;
      let prev = null;
      for (let i = 0; i <= 48; i++) {
        const t = (i / 48) * 2 * Math.PI, v = c.map((x, j) => Math.cos(a) * x + Math.sin(a) * (Math.cos(t) * major[j] + Math.sin(t) * minor[j]));
        const p = toScene(v).normalize().multiplyScalar(R * 0.915);
        if (prev) pts.push(prev, p);
        prev = p;
      }
      label(common.toUpperCase(), 'sky-dso cl', toScene(c).normalize(), { kind: 'cluster', id: `cl-${r[f.name]}`, name: common, sub: `${r[f.type] === 'g' ? 'GLOBULAR' : 'OPEN'} CLUSTER · ${r[f.name]}`,
        distLy: r[f.distPc] * 3.2616, members: r[f.members], sizeArcmin: 2 * radArcmin, credit: 'Hunt & Reffert 2023 (Gaia DR3)', title: `Ring: the radius holding half the Gaia DR3 members (r50 = ${r[f.r50pc].toFixed(1)} pc)` });
    }
    rings.geometry.dispose();
    rings.geometry = new THREE.BufferGeometry().setFromPoints(pts);
  }

  // ---- constellations ---------------------------------------------------------------------------
  const cpts = [];
  for (const segs of Object.values(CONSTELLATION_LINES)) for (const s of segs) for (let i = 2; i < s.length; i += 2) {
    cpts.push(toScene(raDecToUnit(s[i - 2], s[i - 1])).multiplyScalar(R * 0.97), toScene(raDecToUnit(s[i], s[i + 1])).multiplyScalar(R * 0.97));
  }
  const cons = new THREE.Group();
  const lines = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(cpts), new THREE.LineBasicMaterial({ color: 0x6f8fcf, transparent: true, opacity: 0.45, depthWrite: false }));
  lines.frustumCulled = false; lines.renderOrder = -1;
  cons.add(lines);
  group.add(cons);
  for (const [abbr, [ra, dec, rank]] of Object.entries(CONSTELLATION_LABELS)) {
    const o = label((CONSTELLATION_NAMES[abbr] ?? abbr).toUpperCase(), `sky-con rank${rank}`, toScene(raDecToUnit(ra, dec)).normalize());
    o.userData.rank = rank;
  }

  return {
    /** Per frame. on: standing on a surface; fade: 1 at night, 0 in full daylight; flags: { deepsky, constellations, labels }. */
    update({ on, fade, flags, camera }) {
      group.visible = on;
      if (!on) { for (const l of labels) l.o.visible = false; return; } // CSS2D labels do not inherit visibility
      loadMilkyWay();
      mwMat.uniforms.uOpacity.value = 0.5 * fade;
      dso.visible = flags.deepsky && fade > 0.02;
      cons.visible = flags.constellations && fade > 0.02;
      if (dso.visible) for (const q of quads) {
        if (q.state === 'idle') {
          q.state = 'loading';
          const url = nebulaImageUrl(q.key);
          if (!url) { q.state = 'none'; continue; }
          loadTexture(url).then((t) => { q.m.material.uniforms.uMap.value = t; q.state = t ? 'ready' : 'failed'; });
        }
        q.m.visible = q.state === 'ready';
        q.m.material.uniforms.uOpacity.value = q.opacity * fade;
      }
      // CSS2D shows points behind the camera too when the near plane is tiny (their depth rounds to 1):
      // keep labels to the half of the sky in front
      const fwd = camera ? camera.getWorldDirection(new THREE.Vector3()) : null, cosMax = camera ? Math.cos(Math.min(Math.PI / 2, (camera.fov * Math.max(1, camera.aspect) * Math.PI) / 180 * 0.75)) : 0;
      for (const l of labels) {
        const isCon = l.kind.startsWith('sky-con');
        l.o.visible = (isCon ? cons.visible : dso.visible) && flags.labels && (!fwd || l.o.position.dot(fwd) / l.o.position.length() > cosMax);
      }
    },
    setClusters,
    get milkyWayState() { return mwState; },
    hide() { group.visible = false; },
  };
}
