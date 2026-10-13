import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// The planet shader's texture units: most GPUs allow 16 per fragment shader (Apple/Metal, ANGLE on D3D11, many
// integrated GPUs), while SwiftShader, which the browser checks use, allows 32. Over 16 the shader does not link on a
// real GPU and every body loses its skin, so each variant is counted here.
const src = fs.readFileSync(new URL('../src/views/system/materials.js', import.meta.url), 'utf8');
const shader = (name) => { const i = src.indexOf(`const ${name} = /* glsl */\``), a = src.indexOf('`', i) + 1; return src.slice(a, src.indexOf('`;', a)); };

/** A small preprocessor for #ifdef / #ifndef / #else / #endif. */
function preprocess(glsl, defines) {
  const out = [], stack = [];
  for (const line of glsl.split('\n')) {
    const t = line.trim(), on = stack.every(Boolean);
    let m;
    if ((m = t.match(/^#ifdef (\w+)/))) stack.push(defines.has(m[1]));
    else if ((m = t.match(/^#ifndef (\w+)/))) stack.push(!defines.has(m[1]));
    else if (t.startsWith('#else')) stack.push(!stack.pop());
    else if (t.startsWith('#endif')) { assert.ok(stack.length, 'unbalanced #endif'); stack.pop(); }
    else if (on) out.push(line);
  }
  assert.equal(stack.length, 0, 'unbalanced #if');
  return out.join('\n');
}
const samplers = (glsl) => [...glsl.matchAll(/uniform sampler2D (\w+)/g)].map((m) => m[1]);
// the combinations that occur: a body's ground (DEM, with PALEO on Earth while an epoch is shown), a cloud shell or
// slice (no DEM; SLICE for Earth's cloud volume), the Planet View's globe (DEM). SLICE never meets DEM or PALEO.
const VARIANTS = [[], ['DEM'], ['SLICE'], ['PALEO'], ['DEM', 'PALEO'], ['SLICE', 'PALEO']];

test('no planet shader variant needs more than 15 texture units (the common GPU limit is 16)', () => {
  const frag = shader('PLANET_FRAG');
  for (const v of VARIANTS) {
    const used = samplers(preprocess(frag, new Set(v)));
    assert.ok(used.length <= 15, `${v.join('+') || 'base'}: ${used.length} samplers (${used.join(', ')})`);
  }
});

test('every texture a variant reads is declared in that variant', () => {
  const frag = shader('PLANET_FRAG');
  const all = new Set(samplers(frag));
  for (const v of VARIANTS) {
    const code = preprocess(frag, new Set(v)), declared = new Set(samplers(code));
    for (const name of all) {
      const reads = new RegExp(`texture(2D|Lod)?\\(\\s*${name}\\b|\\(\\s*${name}\\s*,|biomeColour\\(${name}`).test(code.replace(/uniform sampler2D \w+;/g, ''));
      if (reads) assert.ok(declared.has(name), `${v.join('+') || 'base'} reads ${name} without declaring it`);
    }
  }
});

test('the PALEO variant drops today\'s imagery, and SLICE carries the cloud-top textures', () => {
  const frag = shader('PLANET_FRAG');
  const paleo = samplers(preprocess(frag, new Set(['DEM', 'PALEO']))), live = samplers(preprocess(frag, new Set(['DEM'])));
  assert.ok(!paleo.includes('uLive') && !paleo.includes('uNight') && paleo.includes('uIceA'));
  assert.ok(live.includes('uLive') && !live.includes('uIceA') && !live.includes('uCth'));
  assert.ok(samplers(preprocess(frag, new Set(['SLICE']))).includes('uCth'));
});
