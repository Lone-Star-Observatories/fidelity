// Smooth occultation-constrained ellipsoid, not resolved surface topography.
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { SphereGeometry } from 'three';
import { makeGLB } from './import-shapes.mjs';
import { SHAPES } from '../../src/data/shapes.js';
const root = new URL('../../', import.meta.url);
const spec = {
  semiaxesKm: { long: 1161, intermediate: 852, polar: 513 },
  source: 'https://arxiv.org/abs/2006.03113',
  sourceLabel: 'https://arxiv.org/pdf/2006.03113',
  credit: 'Fidelity smooth ellipsoid from Ortiz et al. 2017 occultation/photometry analysis',
  citation: 'Ortiz et al. (2017), Nature 550, doi:10.1038/nature24051; 2017-01-21 stellar occultation and rotational photometry. Semiaxes 1161 × 852 × 513 km are model-dependent.',
  label: 'OCCULTATION ELLIPSOID', tier: 'modelled', units: 'km',
  frame: 'Illustrative axes: +X along long equatorial axis, +Y along shortest/polar axis, −Z toward east along intermediate axis. No calibrated inertial pole, absolute spin phase or terrain longitude registration.',
  origin: 'Geometric ellipsoid centre; centre of mass is not independently measured.',
  observationDate: '2017-01-21', modelDate: '2017', retrieved: '2026-10-10', texLon0: -180,
  limits: 'One published smooth ellipsoid fit; uncertainties and alternative interior/shape models remain. No terrain relief or ring geometry is included; current attitude is illustrative.',
  processing: 'Analytic ellipsoid tessellation in km, planetocentric seam-split UVs, normals and Meshopt compression. No resolved topography is asserted.'
};
function ellipsoid(width, height) {
  const geometry = new SphereGeometry(1, width, height);
  geometry.scale(spec.semiaxesKm.long, spec.semiaxesKm.polar, spec.semiaxesKm.intermediate);
  const shape = { vertices: [...geometry.attributes.position.array], indices: [...geometry.index.array] };
  geometry.dispose();
  return shape;
}
const master = await makeGLB(ellipsoid(64, 32), 20000);
const preview = await makeGLB(ellipsoid(32, 16), 2000);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
await fs.writeFile(new URL('public/shapes/haumea.glb', root), master.bytes);
await fs.writeFile(new URL('public/shapes/haumea-preview.glb', root), preview.bytes);
const records = { ...SHAPES, haumea: { ...spec, url: '/shapes/haumea.glb', previewUrl: '/shapes/haumea-preview.glb',
  triangles: master.triangles, previewTriangles: preview.triangles, maxRadiusKm: master.maxRadiusKm,
  bytes: master.bytes.length, previewBytes: preview.bytes.length, sha256: hash(master.bytes),
  previewSha256: hash(preview.bytes), sourceSha256: null } };
await fs.writeFile(new URL('src/data/shapes.js', root), '// Credited body-fixed reconstructions and smooth modelled ellipsoids.\nexport const SHAPES = ' + JSON.stringify(records, null, 2) + ';\nexport const shapeFor = (id) => SHAPES[id] ?? null;\n');
console.log('Haumea', records.haumea.triangles, records.haumea.previewTriangles, 'triangles');
