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
// Optional IDs limit a rebuild; stored texture limits make later rebuilds repeatable.
const args = process.argv.slice(2);
const sizeArg = args.find(arg => arg.startsWith('--texture-size='));
const textureSizeOverride = sizeArg ? Number(sizeArg.split('=')[1]) : null;
const selectedIds = args.filter(arg => !arg.startsWith('--'));
if (args.some(arg => arg.startsWith('--') && arg !== sizeArg)
    || (sizeArg && (!Number.isInteger(textureSizeOverride) || textureSizeOverride < 64 || textureSizeOverride > 256))
    || selectedIds.some(id => !MODELS[id])) throw Error('Use known model IDs and an optional --texture-size=64..256.');
await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder,
  'draco3d.decoder': await draco3d.createDecoderModule(),
});
const assets = { ...MODELS };
for (const [id, asset] of Object.entries(assets)) {
  if (selectedIds.length && !selectedIds.includes(id)) continue;
  const textureSize = textureSizeOverride ?? asset.previewTextureSize ?? 256;
  const doc = await io.read(new URL(`public${asset.url}`, root).pathname);
  for (const extension of doc.getRoot().listExtensionsUsed()) if (extension.extensionName === 'KHR_draco_mesh_compression') extension.dispose();
  const count = () => doc.getRoot().listMeshes().flatMap(m => m.listPrimitives()).filter(p => p.getMode() === 4).reduce((n,p) => n + (p.getIndices() ?? p.getAttribute('POSITION')).getCount()/3,0);
  // previewFlat: texture seams stop the simplifier (Europa Clipper stayed at 33k of 44k triangles, 950 kB), so each
  // material keeps its texture's mean colour (linear light) and the UVs go; the stored flag keeps rebuilds repeatable
  if (asset.previewFlat) for (const m of doc.getRoot().listMaterials()) {
    const t = m.getBaseColorTexture();
    if (t) {
      const { data } = await sharp(Buffer.from(t.getImage())).resize(1, 1, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
      const lin = (v) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }, f = m.getBaseColorFactor();
      m.setBaseColorFactor([f[0] * lin(data[0]), f[1] * lin(data[1]), f[2] * lin(data[2]), f[3]]);
    }
    m.setBaseColorTexture(null); m.setNormalTexture(null); m.setMetallicRoughnessTexture(null); m.setOcclusionTexture(null); m.setEmissiveTexture(null);
  }
  if (count() > 4000) {
    for (const mesh of doc.getRoot().listMeshes()) for (const p of mesh.listPrimitives()) {
      p.setAttribute('NORMAL',null); p.setAttribute('TANGENT',null);
      if (asset.previewFlat) for (const s of p.listSemantics()) if (s.startsWith('TEXCOORD')) p.setAttribute(s,null);
    }
    await doc.transform(weld(), simplify({simplifier:MeshoptSimplifier,ratio:4000/count(),error:0.025}),normals(),prune());
  }
  await doc.transform(textureCompress({encoder:sharp,resize:[textureSize,textureSize],quality:55}),meshopt({encoder:MeshoptEncoder}));
  const bytes = await io.writeBinary(doc);
  asset.previewUrl = `/models/${id}-preview.glb`;
  asset.previewBytes = bytes.length;
  asset.previewSha256 = createHash('sha256').update(bytes).digest('hex');
  asset.previewTextureSize = textureSize;
  asset.previewProcessing = `Mission geometry simplified toward 4,000 triangles with 2.5% error ceiling; ${asset.previewFlat ? 'textures replaced by each material\'s mean colour (flat preview)' : `textures limited to ${textureSize} pixels`}; Meshopt compression. Author axes and existing registration limits retained.`;
  await fs.writeFile(new URL(`public${asset.previewUrl}`,root),bytes);
  console.log(id,bytes.length);
}
const file = new URL('src/data/models.js',root), original = await fs.readFile(file,'utf8');
await fs.writeFile(file,original.split('export const MODELS = ')[0]+'export const MODELS = '+JSON.stringify(assets,null,2)+';\n'+original.slice(original.indexOf(';\n')+2));
