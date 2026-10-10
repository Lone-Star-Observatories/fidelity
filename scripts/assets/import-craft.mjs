#!/usr/bin/env node
// Reproducible imports from published NASA assets; writes only verified budget-compliant GLBs.
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, flatten, join, weld, simplify, normals, prune, meshopt, textureCompress } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier } from 'meshoptimizer';
import draco3d from 'draco3dgltf';
import sharp from 'sharp';
import { MODELS } from '../../src/data/models.js';

const root = new URL('../../', import.meta.url);
const repo = (directory, filename = directory) => `https://raw.githubusercontent.com/nasa/NASA-3D-Resources/master/${encodeURIComponent('3D Models')}/${encodeURIComponent(directory)}/${encodeURIComponent(filename)}.glb`;
const imports = {
  soho: ['Solar and Heliospheric Observatory'],
  ace: ['Advanced Composition Explorer'],
  'stereo-a': ['Solar TErrestrial RElations Observatory (STEREO)'],
  'pioneer-10': ['Pioneer 10'],
  'osiris-apex': ['Origins, Spectral Interpretation, Resource Identification, and Security - Regolith Explorer (OSIRIS-REx)', 'OSIRIS-REx'],
  'mars-odyssey': ['Mars Odyssey'],
  sdo: ['Solar Dynamics Observatory'],
  aqua: ['Aqua (B)'], terra: ['Terra'], 'suomi-npp': ['Suomi National Polar-orbiting Partnership (Suomi NPP)'],
  'landsat-8': ['Landsat 8'], 'cubesat-1u': ['CubeSat - 1 RU Generic'], 'cubesat-2u': ['CubeSat - 2 RU Generic'],
  'geo-weather': ['Geostationary Operational Environmental Satellites'],
  'europa-clipper': { source: 'https://assets.science.nasa.gov/content/dam/science/missions/europa-clipper/3d/clipper_spacecraft.glb', credit: 'NASA/JPL-Caltech, Europa Clipper team', sourcePage: 'https://science.nasa.gov/missions/europa-clipper/europa-clipper-resources/europa-clipper-downloadable-3d-model/' },
  curiosity: { source: 'https://assets.science.nasa.gov/content/dam/science/psd/solar/2023/09/c/Curiosity_static.glb', credit: 'NASA Visualization Technology Applications and Development (VTAD)', sourcePage: 'https://science.nasa.gov/resource/curiosity-3d-model/' },
};

await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO(fetch).setAllowNetwork(true).registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(), 'draco3d.encoder': await draco3d.createEncoderModule(),
  'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder,
});
const count = (doc) => doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives()).filter((p) => p.getMode() === 4)
  .reduce((n, p) => n + (p.getIndices() ?? p.getAttribute('POSITION')).getCount() / 3, 0);

export async function importCraft(id, spec) {
  const item = Array.isArray(spec) ? { source: repo(...spec), credit: `NASA 3D Resources — ${spec[0]}`, sourcePage: 'https://github.com/nasa/NASA-3D-Resources' } : spec;
  const response = await fetch(item.source, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`${id}: HTTP ${response.status}`);
  const sourceBytes = new Uint8Array(await response.arrayBuffer());
  const doc = await io.readBinary(sourceBytes).catch((error) => { if (error.message.includes('external')) return io.read(item.source); throw error; });
  for (const extension of doc.getRoot().listExtensionsUsed()) if (extension.extensionName === 'KHR_draco_mesh_compression') extension.dispose();
  if (id === 'osiris-apex') {
    for (const material of doc.getRoot().listMaterials()) {
      const image = material.getBaseColorTexture()?.getImage();
      if (image) {
        const { channels } = await sharp(image).stats();
        const factor = material.getBaseColorFactor();
        material.setBaseColorFactor([channels[0].mean / 255 * factor[0], channels[1].mean / 255 * factor[1], channels[2].mean / 255 * factor[2], factor[3]]);
      }
      material.setBaseColorTexture(null).setNormalTexture(null).setMetallicRoughnessTexture(null).setOcclusionTexture(null).setEmissiveTexture(null);
    }
    for (const mesh of doc.getRoot().listMeshes()) for (const p of mesh.listPrimitives()) { p.setAttribute('TEXCOORD_0', null); p.setAttribute('TEXCOORD_1', null); }
  }
  await doc.transform(dedup(), flatten(), join(), prune(), textureCompress({ encoder: sharp, resize: ['curiosity', 'europa-clipper'].includes(id) ? [512, 512] : [1024, 1024], quality: 65, ...(id === 'europa-clipper' ? {targetFormat:'webp'} : {}) }));
  let processing = 'Deduplicated, flattened and joined; textures limited to 1024²; Meshopt compressed.';
  if (id === 'osiris-apex') processing += ' Source texture detail replaced by mean material colours to permit simplification; shape and original configuration retained.';
  if (count(doc) > 50000) {
    for (const mesh of doc.getRoot().listMeshes()) for (const p of mesh.listPrimitives()) { p.setAttribute('NORMAL', null); p.setAttribute('TANGENT', null); }
    await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: Math.min(0.2, 30000 / count(doc)), error: 0.02 }), normals(), prune());
    processing += ' Split normals removed before welding and simplification (≤20% target, 2% error ceiling); normals recomputed.';
  }
  if (count(doc) > 50000) {
    for (const mesh of doc.getRoot().listMeshes()) for (const p of mesh.listPrimitives()) { p.setAttribute('NORMAL', null); p.setAttribute('TANGENT', null); }
    await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: 0.5, error: 0.05 }), normals(), prune());
    processing += ' Second simplification pass: 50% target, 5% error ceiling.';
  }
  const triangles = count(doc);
  if (triangles > 50000) throw new Error(`${id}: ${triangles} triangles still exceeds budget`);
  await doc.transform(meshopt({ encoder: MeshoptEncoder }));
  const bytes = await io.writeBinary(doc);
  if (bytes.length > 2e6) throw new Error(`${id}: ${bytes.length} bytes still exceeds budget`);
  const maxTextureSize = doc.getRoot().listTextures().reduce((n, t) => Math.max(n, ...(t.getSize() ?? [0, 0])), 0);
  if (maxTextureSize > 1024) throw new Error(`${id}: oversized texture`);
  await fs.writeFile(new URL(`public/models/${id}.glb`, root), bytes);
  return { ...MODELS.hubble, ...item, licence: Array.isArray(spec) ? MODELS.hubble.licence : 'NASA Science mission visualization; credited source retained. Use authorized by project owner.', url: `/models/${id}.glb`, processing, triangles, bytes: bytes.length, maxTextureSize,
    sha256: createHash('sha256').update(bytes).digest('hex'), sourceSha256: createHash('sha256').update(sourceBytes).digest('hex'),
    retrieved: '2026-10-10', fidelity: id === 'osiris-apex' ? 'Original OSIRIS-REx design, including pre-return sample-capsule configuration; an approximation for OSIRIS-APEX.' : 'Published mission or class visualization; dimensions and body frame not independently calibrated.' + (id === 'pioneer-10' ? ' Pioneer 11 shares the Pioneer 10 visualization; mission differences are not represented.' : '') };
}

const selected = process.argv.slice(2);
const results = { ...MODELS };
const failureFile = new URL('docs/asset-import-failures.json', root);
const previousFailures = JSON.parse(await fs.readFile(failureFile, 'utf8').catch(() => '[]'));
const failures = previousFailures.filter(f => selected.length && !selected.includes(f.id));
for (const [id, spec] of Object.entries(imports)) {
  if (selected.length && !selected.includes(id)) continue;
  try { results[id] = await importCraft(id, spec); console.log(`${id}: ${results[id].triangles} triangles, ${results[id].bytes} bytes`); }
  catch (error) { failures.push({ id, reason: error.message }); console.warn(error.message); }
}
const file = new URL('src/data/models.js', root), old = await fs.readFile(file, 'utf8');
await fs.writeFile(file, old.split('export const MODELS = ')[0] + 'export const MODELS = ' + JSON.stringify(results, null, 2) + ';\n' + old.slice(old.indexOf(';\n') + 2));
await fs.writeFile(failureFile, JSON.stringify(failures, null, 2) + '\n');
if (failures.some(f => !selected.length || selected.includes(f.id))) process.exitCode = 1;
