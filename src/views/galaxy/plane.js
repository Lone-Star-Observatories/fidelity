// The calibrated Milky Way artwork (PIA10748) as a mesh in the galactic plane, galactocentric,
// in kly (Sgr A* at the origin, Sol at (−R₀, z₀, 0)). Shared by the Galaxy and Quadrant views.
import * as THREE from 'three';
import { IMAGE, imageMapper } from '../../astro/galaxy.js';
import { loadTexture } from '../system/materials.js';

export function createGalaxyPlane({ opacity = 1 } = {}) {
  const W = IMAGE.widthKly;
  const map = imageMapper(IMAGE.sunOffset[0], IMAGE.sunOffset[1]);
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(W, W), new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity, depthWrite: false }));
  // image right → map(1,0), image down → map(0,1), normal → galactic north
  const [rx, rz] = map(1, 0), [dx, dz] = map(0, 1);
  const right = new THREE.Vector3(rx, 0, rz), up = new THREE.Vector3(-dx, 0, -dz), normal = new THREE.Vector3().crossVectors(right, up);
  plane.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, normal));
  loadTexture('milkyWay').then((t) => {
    if (!t) return;
    plane.material.map = t;
    plane.material.color.set(0xffffff);
    plane.material.needsUpdate = true;
  });
  return plane;
}
