import * as THREE from 'three';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { modelFor } from '../../data/models.js';
import snapshot from '#snapshot';

const draco = new DRACOLoader().setDecoderPath('/decoders/draco/').setDecoderConfig({ type: 'wasm' });
const loader = new GLTFLoader().setDRACOLoader(draco).setMeshoptDecoder(MeshoptDecoder);

/** Dispose an owned model, including embedded textures. */
export function disposeModel(object) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  object.traverse((child) => {
    if (child.geometry) geometries.add(child.geometry);
    for (const material of (Array.isArray(child.material) ? child.material : [child.material])) {
      if (!material) continue;
      materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    }
  });
  geometries.forEach((g) => g.dispose());
  textures.forEach((t) => t.dispose());
  materials.forEach((m) => m.dispose());
}

/** Normalize published visualization to the viewer's catalog-radius envelope.
 * Author axes are preserved: these are illustrative attitudes, not telemetry.
 * The single-file preview keeps its lightweight representative craft.
 */
export async function loadCraftModel(id) {
  const asset = modelFor(id);
  if (!asset || snapshot) return null;
  const { scene } = await loader.loadAsync(asset.url);
  const bounds = new THREE.Box3().setFromObject(scene);
  const radius = bounds.getBoundingSphere(new THREE.Sphere()).radius;
  if (!Number.isFinite(radius) || radius <= 0) {
    disposeModel(scene);
    throw new Error(`Invalid model bounds: ${id}`);
  }
  const centre = bounds.getCenter(new THREE.Vector3());
  const wrapper = new THREE.Group();
  wrapper.add(scene);
  scene.position.sub(centre);
  wrapper.scale.setScalar(1 / radius);
  wrapper.userData.asset = asset;
  return wrapper;
}
