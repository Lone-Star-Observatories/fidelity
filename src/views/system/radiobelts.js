// Jupiter's synchrotron radiation belts in the spectrum filter (#61): a MODELLED glow of points around
// the planet, in its magnetic-equator frame (JRM09 dipole tilt, turning with System III), shown when
// the band look carries `belts` (the belts' share of the total flux at that frequency, from
// src/data/band-physics.js). The shape follows the VLA/LOFAR images: emission peaks ~1.5 R_J in the
// magnetic equator (the "ears" either side of the disc), with fainter high-latitude lobes near the
// electrons' mirror points (de Pater et al. 2003; Girard et al. 2016). Distances go through the
// body's radial compression like the field lines (magfields.js).

import * as THREE from 'three';
import { MAGNETIC } from '../../astro/magnetic.js';
import { latLonToDir } from './surface.js';
import { SYNCHROTRON } from '../../data/band-physics.js';

const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);

/** Seeded points (body radii, magnetic frame) with brightness weights. */
function beltPoints(spec, n = 5000) {
  let s = 61;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
  const pts = [], w = [];
  while (pts.length < n) {
    const L = Math.min(3.5, Math.max(1.15, spec.peakRj * Math.exp(0.22 * gauss())));
    const lobe = rnd() < 0.2;
    const lat = lobe ? (rnd() < 0.5 ? -1 : 1) * (27 + 6 * gauss()) * (Math.PI / 180) : 8 * gauss() * (Math.PI / 180);
    const r = L * Math.cos(lat) ** 2;
    if (r < 1.03) continue;
    const phi = 2 * Math.PI * rnd();
    pts.push([r * Math.cos(lat) * Math.cos(phi), r * Math.cos(lat) * Math.sin(phi), r * Math.sin(lat)]);
    w.push((lobe ? 0.45 : 1) * Math.exp(-((L - spec.peakRj) ** 2) / 0.5));
  }
  return { pts, w };
}

/** deps: { radial(body, rRadii) → displayed distance in display radii } */
export function createRadioBelts({ radial }) {
  const entries = new Map(); // id → { obj, base, key }

  function build(id, node) {
    const mag = MAGNETIC[id], spec = SYNCHROTRON[id];
    const a = v3(latLonToDir(mag.poleLat ?? 90 - mag.tiltDeg, mag.poleLon)).normalize();
    const e1 = new THREE.Vector3(0, 1, 0).cross(a);
    if (e1.lengthSq() < 1e-8) e1.set(1, 0, 0); else e1.normalize();
    const e2 = a.clone().cross(e1).normalize();
    const { pts, w } = beltPoints(spec);
    const base = pts.map(([x, y, z]) => e1.clone().multiplyScalar(x).add(e2.clone().multiplyScalar(y)).add(a.clone().multiplyScalar(z)));
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(base.length * 3), 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(base.length * 3), 3));
    const obj = new THREE.Points(geo, new THREE.PointsMaterial({ size: 2, sizeAttenuation: false, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    obj.frustumCulled = false; obj.renderOrder = 2; obj.visible = false;
    node.tilt.add(obj);
    const e = { obj, base, w, key: null, tint: null };
    entries.set(id, e);
    return e;
  }

  return {
    /**
     * Per frame: show the belts of every body whose band look has `belts` (0…1), tinted `tint`
     * ([r, g, b] of the band palette), placed through the radial compression for `scaleKey`.
     */
    update(nodes, scaleKey, tint) {
      for (const id of Object.keys(SYNCHROTRON)) {
        const n = nodes[id], f = n?.bandLook?.belts;
        let e = entries.get(id);
        if (!n || !f) { if (e) e.obj.visible = false; continue; }
        if (!MAGNETIC[id]) continue;
        e ??= build(id, n);
        e.obj.visible = true;
        e.obj.rotation.copy(n.mesh.rotation); // turns with System III like the field lines
        if (e.key !== scaleKey) {
          const arr = e.obj.geometry.attributes.position.array;
          e.base.forEach((p, i) => { const r = p.length(), k = radial(n.body, r) / r; arr[i * 3] = p.x * k; arr[i * 3 + 1] = p.y * k; arr[i * 3 + 2] = p.z * k; });
          e.obj.geometry.attributes.position.needsUpdate = true;
          e.key = scaleKey;
        }
        const tk = `${tint.join(',')}|${f.toFixed(3)}`;
        if (e.tint !== tk) {
          const col = e.obj.geometry.attributes.color.array, k = 0.35 + 0.65 * f;
          e.w.forEach((w, i) => { col[i * 3] = tint[0] * w * k; col[i * 3 + 1] = tint[1] * w * k; col[i * 3 + 2] = tint[2] * w * k; });
          e.obj.geometry.attributes.color.needsUpdate = true;
          e.tint = tk;
        }
      }
    },
    clear() { for (const e of entries.values()) { e.obj.parent?.remove(e.obj); e.obj.geometry.dispose(); e.obj.material.dispose(); } entries.clear(); },
  };
}
