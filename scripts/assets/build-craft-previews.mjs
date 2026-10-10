// Compact, self-contained mission geometry for the offline viewer.
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, simplify, normals, prune, meshopt, textureCompress } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier } from 'meshoptimizer';
import draco3d from 'draco3dgltf';
import sharp from 'sharp';
import { MODELS } from '../../src/data/models.js';
const root = new URL('../../', import.meta.url);
await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder,
  'draco3d.decoder': await draco3d.createDecoderModule(),
});
const assets = { ...MODELS };
for (const [id, asset] of Object.entries(assets)) {
  const doc = await io.read(new URL(`public${asset.url}`, root).pathname);
  for (const extension of doc.getRoot().listExtensionsUsed()) if (extension.extensionName === 'KHR_draco_mesh_compression') extension.dispose();
  const count = () => doc.getRoot().listMeshes().flatMap(m => m.listPrimitives()).filter(p => p.getMode() === 4).reduce((n,p) => n + (p.getIndices() ?? p.getAttribute('POSITION')).getCount()/3,0);
  if (count() > 4000) {
    for (const mesh of doc.getRoot().listMeshes()) for (const p of mesh.listPrimitives()) { p.setAttribute('NORMAL',null); p.setAttribute('TANGENT',null); }
    await doc.transform(weld(), simplify({simplifier:MeshoptSimplifier,ratio:4000/count(),error:0.025}),normals(),prune());
  }
  await doc.transform(textureCompress({encoder:sharp,resize:[256,256],quality:55}),meshopt({encoder:MeshoptEncoder}));
  const bytes = await io.writeBinary(doc);
  asset.previewUrl = `/models/${id}-preview.glb`;
  asset.previewBytes = bytes.length;
  asset.previewSha256 = createHash('sha256').update(bytes).digest('hex');
  asset.previewProcessing = 'Mission geometry simplified toward 4,000 triangles with 2.5% error ceiling; textures limited to 256 pixels; Meshopt compression. Author axes and existing registration limits retained.';
  await fs.writeFile(new URL(`public${asset.previewUrl}`,root),bytes);
  console.log(id,bytes.length);
}
const file = new URL('src/data/models.js',root), original = await fs.readFile(file,'utf8');
await fs.writeFile(file,original.split('export const MODELS = ')[0]+'export const MODELS = '+JSON.stringify(assets,null,2)+';\n'+original.slice(original.indexOf(';\n')+2));
