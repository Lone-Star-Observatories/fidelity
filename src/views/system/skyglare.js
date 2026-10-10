// The Sun's glare from a surface (#47). Glare forms in the eye or the lens, not in the sky, so its
// shape is fixed in the observer's field: through binoculars or a telescope (magnification
// 50°/fov) the Sun grows but its glare does not. The profile is a disability-glare core (∝ 1/θ²,
// after the CIE glare spread function) plus a wide aureole, scaled by the Sun's brightness
// (glareStrength in src/astro/apparent.js). Outside the disc only: the Sun's disc itself is drawn
// by its own mesh at its exact angular size, so the limb stays sharp at every zoom.

import * as THREE from 'three';

const VERT = `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    #include <logdepthbuf_vertex>
  }`;
const FRAG = `
  #include <logdepthbuf_pars_fragment>
  varying vec2 vUv; uniform float uHalfDeg, uSunDeg, uMag, uStrength; uniform vec3 uColor;
  void main() {
    #include <logdepthbuf_fragment>
    float th = length(vUv - 0.5) * 2.0 * uHalfDeg;          // degrees from the Sun's centre, on the sky
    if (th < uSunDeg) discard;                                // the disc is the Sun mesh's job
    float te = th * uMag;                                     // degrees in the observer's field
    float core = min(0.62, 0.5 * (0.25 / te) * (0.25 / te)); // stays below the disc's brightness at the limb
    float aureole = 0.14 * exp(-te / 3.0) + 0.05 * exp(-te / 12.0);
    float edge = smoothstep(uHalfDeg, uHalfDeg * 0.8, th);
    float a = uStrength * (core + aureole) * edge;
    gl_FragColor = vec4(uColor * a, 1.0);
  }`;

export function createSkyGlare(scene) {
  const uniforms = { uHalfDeg: { value: 20 }, uSunDeg: { value: 0.27 }, uMag: { value: 1 }, uStrength: { value: 0 }, uColor: { value: new THREE.Color(1, 0.93, 0.8) } };
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  mesh.frustumCulled = false; mesh.visible = false; mesh.renderOrder = 3;
  scene.add(mesh);
  return {
    /**
     * sunPos: Sun centre (world), eye: camera position, camera, sunRadiusDeg: angular radius,
     * fovDeg: vertical field, strength 0…1, color: THREE.Color.
     */
    update({ sunPos, eye, camera, sunRadiusDeg, fovDeg, strength, color }) {
      mesh.visible = strength > 0.002;
      if (!mesh.visible) return;
      const mag = Math.max(1, 50 / fovDeg);
      const half = Math.min(60, Math.max(sunRadiusDeg * 4, 24 / mag));
      const D = sunPos.distanceTo(eye);
      mesh.position.copy(sunPos);
      mesh.quaternion.copy(camera.quaternion);
      mesh.scale.setScalar(D * Math.tan((half * Math.PI) / 180));
      uniforms.uHalfDeg.value = half; uniforms.uSunDeg.value = sunRadiusDeg; uniforms.uMag.value = mag; uniforms.uStrength.value = strength;
      if (color) uniforms.uColor.value.copy(color);
    },
    hide() { mesh.visible = false; },
  };
}
