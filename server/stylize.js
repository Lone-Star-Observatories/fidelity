// Postcards (#40): the optional AI STYLIZE step. The browser posts a rendered postcard and a prompt
// built from the scene's facts; this relay sends them to OpenAI's image-edit endpoint with the key held
// here (env FIDELITY_OPENAI_KEY or OPENAI_API_KEY, the same as the voice relay, #21) and returns the
// image. Results are cached on disk by a hash of (image, prompt, settings), so a re-share never
// re-sends. Off unless the user asks for it; the browser explains what is sent first.

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from './config.js';

const cfg = {
  key: process.env.FIDELITY_OPENAI_KEY || process.env.OPENAI_API_KEY || '',
  model: process.env.FIDELITY_IMAGE_MODEL || 'gpt-image-1',
  url: process.env.FIDELITY_IMAGE_URL || 'https://api.openai.com/v1/images/edits',
};
const dir = path.join(config.dataDir, 'stylize');
const SIZES = new Set(['1024x1024', '1536x1024', '1024x1536']);
const QUALITY = new Set(['low', 'medium', 'high']);
export const MAX_BODY = 24 * 1024 * 1024;

export const stylizeStatus = () => ({ available: !!cfg.key, model: cfg.model });

const fail = (status, msg) => Object.assign(new Error(msg), { status });

/** Validate a request body { image: data:image/png;base64,…, prompt, size, quality } → its parts. */
export function parseStylize(body) {
  const m = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(body?.image ?? '');
  if (!m) throw fail(400, 'image must be a PNG or JPEG data URL');
  const prompt = String(body.prompt ?? '').trim();
  if (prompt.length < 10 || prompt.length > 4000) throw fail(400, 'prompt must be 10–4000 characters');
  const size = SIZES.has(body.size) ? body.size : '1024x1024';
  const quality = QUALITY.has(body.quality) ? body.quality : 'medium';
  const bytes = Buffer.from(m[2], 'base64');
  if (bytes.length > 20 * 1024 * 1024) throw fail(413, 'image too large');
  return { type: m[1], bytes, prompt, size, quality };
}

/** The cache key for one request (the model is part of it: a new model gives a new picture). */
export const stylizeKey = ({ bytes, prompt, size, quality }, model = cfg.model) =>
  crypto.createHash('sha256').update(bytes).update('\0').update(prompt).update(`\0${size}\0${quality}\0${model}`).digest('hex').slice(0, 32);

export async function stylize(body) {
  const req = parseStylize(body);
  const key = stylizeKey(req), file = path.join(dir, `${key}.png`);
  try { return { image: `data:image/png;base64,${(await fs.readFile(file)).toString('base64')}`, cache: 'hit', model: cfg.model }; } catch { /* miss */ }
  if (!cfg.key) throw fail(503, 'No OpenAI key: set FIDELITY_OPENAI_KEY (or OPENAI_API_KEY) for the backend');
  const form = new FormData();
  form.append('model', cfg.model);
  form.append('image', new Blob([req.bytes], { type: `image/${req.type}` }), `postcard.${req.type === 'png' ? 'png' : 'jpg'}`);
  form.append('prompt', req.prompt);
  form.append('size', req.size);
  form.append('quality', req.quality);
  form.append('n', '1');
  const r = await fetch(cfg.url, { method: 'POST', headers: { authorization: `Bearer ${cfg.key}` }, body: form, signal: AbortSignal.timeout(180000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw fail(r.status === 400 ? 400 : 502, `OpenAI ${r.status}: ${j?.error?.message ?? 'image edit failed'}`);
  const b64 = j?.data?.[0]?.b64_json;
  if (!b64) throw fail(502, 'OpenAI returned no image');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(file, Buffer.from(b64, 'base64'));
  return { image: `data:image/png;base64,${b64}`, cache: 'miss', model: cfg.model };
}

/**
 * Only this app's own page may spend the user's credits: the request must be JSON (so a cross-site
 * form post cannot send it without a CORS preflight, which is never answered) and any Origin must be
 * this backend's.
 */
export function allowedPost(req, host) {
  const ct = req.headers['content-type'] || '';
  if (!/^application\/json\b/i.test(ct)) return false;
  const origin = req.headers.origin;
  if (!origin) return true;
  try { const u = new URL(origin); return u.host === host || /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(u.host); } catch { return false; }
}
