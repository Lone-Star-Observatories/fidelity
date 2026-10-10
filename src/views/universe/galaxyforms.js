// Galaxy forms for the Universe View (#50): nearby galaxies drawn from their real images at their
// real size, oriented by position angle and inclination. Spirals and irregulars are a disc textured
// so that, seen from the Milky Way, it reproduces the survey image exactly (each disc point samples
// the image where it projects on our sky), with a bulge glow and a thickness glow; ellipticals are
// an ellipsoid glow with the image on the sky plane. The images are MEASURED, the 3D shapes MODELLED,
// and the orientation MEASURED where it comes from the disc's rotation. Far away, they fade back to
// the catalogue's dots.

import * as THREE from 'three';
import { GALAXY_IMAGES } from '../../data/galaxy-images.js';

const MLY_PER_MPC = 3.26156;
const DISC_VERT = `varying vec2 vUv; varying vec2 vR; attribute vec2 disc;
  void main() { vUv = uv; vR = disc; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const DISC_FRAG = `varying vec2 vUv; varying vec2 vR; uniform sampler2D uMap; uniform float uOpacity, uBlack, uGain; uniform vec3 uTint;
  void main() {
    float r = length(vR);
    vec3 t = pow(max(texture2D(uMap, vUv).rgb - uBlack, 0.0) / (1.0 - uBlack), vec3(1.6)) * uGain; // plate cores saturate: compress the bright end
    float a = uOpacity * smoothstep(1.0, 0.7, r);
    gl_FragColor = vec4(t * uTint * a, 1.0);
    #include <colorspace_fragment>
  }`;
// ellipsoid glow: brightest through the centre (longest path), fading to the limb
const ELL_VERT = `varying vec3 vN; varying vec3 vV; void main() { vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`;
const ELL_FRAG = `varying vec3 vN; varying vec3 vV; uniform vec3 uColor; uniform float uOpacity;
  void main() { float k = pow(max(dot(vN, vV), 0.0), 2.2); gl_FragColor = vec4(uColor * k * uOpacity, 1.0); }`;

function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,240,215,1)'); grad.addColorStop(0.25, 'rgba(255,220,170,0.55)'); grad.addColorStop(1, 'rgba(255,200,140,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

/**
 * sgScene(ra, dec, distMly) → THREE.Vector3 in the view's scene; loadTexture(url) → Promise<Texture|null>;
 * imageUrl(key) → url or null.
 */
export function createGalaxyForms({ scene, sgScene, loadTexture, imageUrl }) {
  const group = new THREE.Group();
  scene.add(group);
  const forms = [];
  let glow = null;

  function build(ungcRows) {
    if (forms.length || !ungcRows) return;
    const byName = new Map(ungcRows.map((r) => [r[0], r]));
    glow ??= glowTexture();
    for (const g of GALAXY_IMAGES) {
      const row = byName.get(g.ungc);
      if (!row) continue;
      const distMly = row[3] * MLY_PER_MPC, c = sgScene(g.ra, g.dec, distMly);
      // sky directions at the galaxy, in scene coordinates (finite differences through the same transform)
      const eps = 1e-3, toward = c.clone().negate().normalize();
      const N = sgScene(g.ra, g.dec + eps, distMly).sub(c).normalize(), E = sgScene(g.ra + eps / Math.cos((g.dec * Math.PI) / 180), g.dec, distMly).sub(c).normalize();
      const rad = (x) => (x * Math.PI) / 180, pa = rad(g.pa), inc = rad(g.incl);
      const major = N.clone().multiplyScalar(Math.cos(pa)).addScaledVector(E, Math.sin(pa));
      let minor = N.clone().multiplyScalar(-Math.sin(pa)).addScaledVector(E, Math.cos(pa));
      if (g.near) { // point the minor axis at the established near side (e.g. NW)
        const want = { N: N, S: N.clone().negate(), E: E, W: E.clone().negate(), NW: N.clone().sub(E), NE: N.clone().add(E), SW: N.clone().negate().sub(E), SE: E.clone().sub(N) }[g.near];
        if (want && minor.dot(want) < 0) minor.negate();
      }
      // in the disc plane: the major axis, and the minor axis tilted towards us by the inclination
      const inPlane = minor.clone().multiplyScalar(Math.cos(inc)).addScaledVector(toward, Math.sin(inc)).normalize();
      const normal = major.clone().cross(inPlane).normalize();
      const sizeMly = distMly * Math.tan(rad(g.d25 / 60) / 2) * 2; // D25 at its distance
      const fovMly = distMly * Math.tan(rad(g.img.fov / 60) / 2) * 2;
      const right = E.clone().negate(); // image right is west, as seen from inside our sky
      const obj = new THREE.Group();
      obj.position.copy(c);
      const mats = [];
      const imgMat = (opacity) => {
        const m = new THREE.ShaderMaterial({ uniforms: { uMap: { value: null }, uOpacity: { value: 0 }, uBlack: { value: g.img.survey === 'twomass' ? 0.04 : 0.1 }, uGain: { value: 1.05 }, uTint: { value: new THREE.Color(1, 1, 1) } },
          vertexShader: DISC_VERT, fragmentShader: DISC_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
        m.userData.base = opacity; mats.push(m);
        return m;
      };
      // a disc (or, for an elliptical, the sky-plane image) whose texture reproduces the image from here
      const discMesh = (axisA, axisB, radius, offset, opacity) => {
        const geo = new THREE.CircleGeometry(1, 72), pos = geo.attributes.position, uv = geo.attributes.uv, disc = new Float32Array(pos.count * 2);
        for (let i = 0; i < pos.count; i++) {
          const x = pos.getX(i), y = pos.getY(i);
          const w = axisA.clone().multiplyScalar(x * radius).addScaledVector(axisB, y * radius).addScaledVector(normal, offset);
          pos.setXYZ(i, w.x, w.y, w.z);
          // orthographic projection on our sky: offsets along the image's right and up (north)
          uv.setXY(i, 0.5 + w.dot(right) / fovMly, 0.5 + w.dot(N) / fovMly);
          disc[i * 2] = x; disc[i * 2 + 1] = y;
        }
        geo.setAttribute('disc', new THREE.BufferAttribute(disc, 2));
        const m = new THREE.Mesh(geo, imgMat(opacity));
        m.frustumCulled = false;
        return m;
      };
      if (g.type === 'elliptical') {
        obj.add(discMesh(right, N, fovMly * 0.45, 0, 0.9)); // the image itself, on the sky plane
        const ell = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), new THREE.ShaderMaterial({ uniforms: { uColor: { value: new THREE.Color(1, 0.82, 0.6) }, uOpacity: { value: 0 } },
          vertexShader: ELL_VERT, fragmentShader: ELL_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
        // axes: the major axis on the sky, the apparent minor axis, and depth like the minor (oblate, MODELLED)
        const q = g.axisRatio, basis = new THREE.Matrix4().makeBasis(major, minor, toward);
        ell.quaternion.setFromRotationMatrix(basis);
        ell.scale.set(sizeMly / 2, (sizeMly / 2) * q, (sizeMly / 2) * q);
        ell.material.userData.base = 0.35; mats.push(ell.material);
        obj.add(ell);
      } else {
        obj.add(discMesh(major, inPlane, sizeMly / 2, 0, 0.75));
        // thickness: fainter copies above and below the plane (scale height ~2% of D25, MODELLED)
        for (const k of [-1, 1]) obj.add(discMesh(major, inPlane, sizeMly / 2 * 0.9, k * sizeMly * 0.02, 0.15));
        if (g.type === 'spiral') {
          const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xffe2b8, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
          s.scale.setScalar(sizeMly * 0.16); // a bulge glow; its real size and brightness vary (MODELLED)
          s.material.userData.base = 0.3; mats.push(s.material);
          obj.add(s);
        }
      }
      obj.visible = false;
      group.add(obj);
      forms.push({ g, obj, mats, c, sizeMly, distMly, normal, state: 'idle', id: `gal-${g.ungc}` });
    }
  }

  const tmp = new THREE.Vector3();
  return {
    build,
    get forms() { return forms; },
    formOf: (id) => forms.find((f) => f.id === id) ?? null,
    /** Per frame: fade each form in by its apparent size (px), out beyond the distance filter `radius`. */
    update(camera, heightPx, radius) {
      const k = heightPx / (2 * Math.tan((camera.fov * Math.PI) / 360));
      for (const f of forms) {
        const d = tmp.copy(f.c).sub(camera.position).length(), px = (f.sizeMly / d) * k;
        const a = f.distMly > radius * 1.02 ? 0 : THREE.MathUtils.smoothstep(px, 6, 30);
        f.obj.visible = a > 0.01;
        if (!f.obj.visible) continue;
        if (f.state === 'idle') {
          f.state = 'loading';
          const url = imageUrl(f.g.img.key);
          if (url) loadTexture(url).then((t) => { f.state = t ? 'ready' : 'failed'; for (const m of f.mats) if (m.uniforms?.uMap) m.uniforms.uMap.value = t; });
          else f.state = 'failed';
        }
        for (const m of f.mats) {
          const img = !!m.uniforms?.uMap;
          const v = m.userData.base * a * (img && f.state !== 'ready' ? 0 : 1);
          if (m.uniforms?.uOpacity) m.uniforms.uOpacity.value = v; else m.opacity = v;
        }
      }
    },
  };
}
