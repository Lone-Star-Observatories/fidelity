// Import a researched batch without rebuilding or replacing earlier dossiers.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { BODY_VISUALS } from '../../src/data/bespoke.js';
import { skyGeometry } from '../../src/astro/appearance.js';
const root = new URL('../../', import.meta.url);
const [manifestPath, sourceDir] = process.argv.slice(2);
if (!manifestPath || !sourceDir) throw Error('Supply a research manifest and generated-image directory.');
const batch = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
const visuals = structuredClone(BODY_VISUALS), outputs = [];
const hash = data => createHash('sha256').update(data).digest('hex');
for (const dossier of batch.bodies) {
  if (visuals[dossier.id]) throw Error(`Dossier already exists: ${dossier.id}`);
  const visual = structuredClone(dossier);
  delete visual.inputs;
  const previewWidth = dossier.previewWidth ?? 640;
  if (!Number.isInteger(previewWidth) || previewWidth < 256 || previewWidth > 640) throw Error('Invalid preview width');
  visual.skyModel = { ...visual.skyModel, ...skyGeometry(visual.skyModel) };
  for (const [role, sourceFile] of Object.entries(dossier.inputs)) {
    if (!['surfaceMap', 'surfaceImage', 'skyImage'].includes(role) || path.basename(sourceFile) !== sourceFile) throw Error('Invalid image input');
    const raw = await fs.readFile(path.join(sourceDir, sourceFile));
    const map = role === 'surfaceMap', width = map ? 2048 : 1536, height = map ? 1024 : 864;
    const metadata = await sharp(raw).metadata();
    if (Math.abs(metadata.width / metadata.height - width / height) > 0.03) throw Error(`Unexpected aspect ratio: ${sourceFile}`);
    const master = await sharp(raw).resize(width, height).jpeg({ quality: 85 }).toBuffer();
    const preview = await sharp(raw).resize(map ? 512 : previewWidth, map ? 256 : Math.round(previewWidth * 9 / 16)).jpeg({ quality: 80 }).toBuffer();
    if (master.length > 700 * 1024) throw Error(`Image exceeds budget: ${sourceFile}`);
    const slug = role.replace(/[A-Z]/g, letter => '-' + letter.toLowerCase());
    const url = `/bespoke/${visual.id}-${slug}.jpg`, previewUrl = `/bespoke/${visual.id}-${slug}-preview.jpg`;
    visual[role] = { ...(visual[role] ?? {}), url, previewUrl, tier: 'imagined', generated: batch.generated,
      observationDate: null, credit: 'Fidelity / OpenAI image generation · researched hypothetical illustration',
      terms: 'Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.',
      sourceFile, sourceSha256: hash(raw), sha256: hash(master), previewSha256: hash(preview),
      bytes: master.length, previewBytes: preview.length, width, height, previewWidth: map ? 512 : previewWidth, previewHeight: map ? 256 : Math.round(previewWidth * 9 / 16),
      processing: visual.kind === 'star' ? 'Resampled JPEG. Original generated PNG retained; photospheric morphology, magnetic regions and emissive appearance are artistic and not radiometrically calibrated.' : 'Resampled JPEG. Original generated PNG retained; terrain, albedo pattern and material appearance are artistic and not radiometrically calibrated.' };
    outputs.push([url, master], [previewUrl, preview]);
  }
  visuals[visual.id] = visual;
}
// All inputs validated before publishing assets or the registry.
await fs.mkdir(new URL('public/bespoke/', root), { recursive: true });
for (const [url, bytes] of outputs) await fs.writeFile(new URL('public' + url, root), bytes);
const footer = `\nconst normalize = (name) => String(name ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
export function bodyVisualFor(body) {
  if (!body) return null;
  const catalog = body.catalog ?? body.star ?? body;
  const names = [body.name, catalog.hd && \`HD \${catalog.hd}\`, catalog.gl].filter(Boolean);
  for (const name of names) {
    const visual = Object.values(BODY_VISUALS).find(v => v.aliases.some(alias => normalize(alias) === normalize(name)));
    if (visual) return visual;
  }
  return null;
}
export const BESPOKE_TEXTURES = Object.fromEntries(Object.values(BODY_VISUALS).filter(v => v.surfaceMap).map(v => [v.surfaceMap.key, v.surfaceMap]));\n`;
await fs.writeFile(new URL('src/data/bespoke.js', root), '// Individual researched hypotheses; actual maps retain priority.\nexport const BODY_VISUALS = ' + JSON.stringify(visuals, null, 2) + ';\n' + footer);
console.log('Imported', batch.bodies.map(body => body.name).join(', '));
