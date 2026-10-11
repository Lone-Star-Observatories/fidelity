// Postcards (#40): frame layout, the provenance line (never optional), captions, share links,
// stylize prompts, and the backend relay's request checks.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SIZES, frameLayout, provenanceLine, hasImagined, epochLabel, captionFor, captionDate, shareLinks, STYLES, stylePrompt, editSize, costEstimate, fileName } from '../src/panels/postcard-core.js';
import { pixelRatioFor } from '../src/views/snapshot.js';
import { parseStylize, stylizeKey, allowedPost } from '../server/stylize.js';

test('postcard sizes and frame layout: the render fills the inner area; without the frame a strip remains', () => {
  assert.deepEqual(SIZES.map((s) => [s.id, s.w, s.h]), [['square', 1080, 1080], ['story', 1080, 1920], ['landscape', 1920, 1080], ['4k', 3840, 2160]]);
  for (const s of SIZES) {
    const L = frameLayout(s.w, s.h, true);
    assert.ok(L.inner.x > 0 && L.inner.y > 0 && L.inner.x + L.inner.w < s.w && L.inner.y + L.inner.h < s.h, s.id);
    assert.ok(L.inner.w > s.w * 0.9 && L.inner.h > s.h * 0.7, `${s.id}: the picture dominates`);
    const F = frameLayout(s.w, s.h, false);
    assert.deepEqual(F.inner, { x: 0, y: 0, w: s.w, h: s.h });
    assert.ok(F.strip.h > 0 && F.strip.y + F.strip.h === s.h);
  }
  assert.equal(frameLayout(3840, 2160, true).s, 2); // 4K scales the bars with the short side
  assert.equal(pixelRatioFor(1080, 1920), 1);
  assert.equal(pixelRatioFor(3840, 2160), 2); // 4K renders at 2× so labels keep their on-screen proportions
});

test('provenance line: tier order, de-duplicated, and IMAGINED detected', () => {
  const t = { imagined: ['SURFACE'], measured: ['STARS', 'STARS', 'SURFACE MAPS'], computed: ['POSITIONS'] };
  assert.equal(provenanceLine(t), 'STARS MEASURED · SURFACE MAPS MEASURED · POSITIONS COMPUTED · SURFACE IMAGINED');
  assert.equal(hasImagined(t), true);
  assert.equal(hasImagined({ measured: ['STARS'] }), false);
  assert.equal(provenanceLine({}), '');
});

test('epoch and caption text', () => {
  assert.equal(epochLabel(0), null);
  assert.equal(epochLabel(26613.2), '+26,613 YEARS');
  assert.equal(epochLabel(-1.25e6), '−1.25 MILLION YEARS');
  assert.equal(epochLabel(-2 / 365.25), '−2 DAYS');
  assert.equal(captionDate(new Date('2026-10-10T08:00:00Z')), '10 Oct 2026');
  assert.equal(captionDate(new Date('-000099-03-01T00:00:00Z')), '1 Mar 100 BCE'); // astronomical year −99 = 100 BCE
  assert.equal(captionDate(null, 1.3e6), '+1.3 million years');
  assert.equal(captionFor({ subject: 'Saturn in the Solar System', date: new Date('2026-10-10T00:00:00Z') }), 'Saturn in the Solar System · 10 Oct 2026 · USS Fidelity');
  assert.match(captionFor({ subject: 'X', date: null, years: 5, stylized: 'OIL PAINTING' }), /AI-stylized by an image model: oil painting; not a photograph/);
});

test('share links carry the caption; Facebook and Mastodon need what they need', () => {
  const l = shareLinks('Saturn · USS Fidelity', null);
  const by = Object.fromEntries(l.map((x) => [x.id, x]));
  assert.equal(by.x.href, 'https://twitter.com/intent/tweet?text=Saturn%20%C2%B7%20USS%20Fidelity');
  assert.match(by.bluesky.href, /^https:\/\/bsky\.app\/intent\/compose\?text=/);
  assert.match(by.threads.href, /^https:\/\/www\.threads\.net\/intent\/post\?text=/);
  assert.match(by.reddit.href, /title=Saturn/);
  assert.equal(by.facebook.copy, true); // no public link: open Facebook and paste the copied caption
  assert.equal(by.mastodon.href, null);
  assert.equal(by.mastodon.needsServer, true);
  const local = Object.fromEntries(shareLinks('a', 'http://127.0.0.1:4011/?cam=1').map((x) => [x.id, x]));
  assert.equal(local.facebook.copy, true); // a loopback link is no use to anyone else
  const pub = Object.fromEntries(shareLinks('a', 'https://example.org/v', { mastodon: 'https://mastodon.social/@me' }).map((x) => [x.id, x]));
  assert.match(pub.facebook.href, /sharer\.php\?u=https%3A%2F%2Fexample\.org%2Fv/);
  assert.match(pub.mastodon.href, /^https:\/\/mastodon\.social\/share\?text=a%20https/);
  assert.equal(Object.fromEntries(shareLinks('a', null, { mastodon: 'not a host' }).map((x) => [x.id, x])).mastodon.href, null);
});

test('stylize prompts keep the scene and forbid inventions; TECHNICAL leaves labels to the app', () => {
  assert.deepEqual(STYLES.map((s) => s.id), ['photoreal', 'trek', 'oil', 'illustration', 'technical']);
  const facts = { view: 'system view · sol', subject: 'From the surface of the Moon', bodies: ['Moon', 'Earth'], date: '2026-10-10', lighting: 'Sun 12° up' };
  for (const s of STYLES) {
    const p = stylePrompt(s.id, facts);
    assert.match(p, /positions and the relative sizes of every body exactly/);
    assert.match(p, /Do not add, remove or rename any object/);
    assert.match(p, /Bodies in frame: Moon, Earth\./);
    assert.match(p, /Date: 2026-10-10\./);
  }
  assert.match(stylePrompt('trek', facts), /no franchise logos/);
  assert.match(stylePrompt('technical', facts), /Draw no text, numbers or labels/);
  assert.equal(STYLES.find((s) => s.id === 'technical').ownLabels, true);
  assert.equal(editSize(1080, 1080), '1024x1024');
  assert.equal(editSize(1080, 1920), '1024x1536');
  assert.equal(editSize(3840, 2160), '1536x1024');
  assert.ok(costEstimate('high', '1536x1024') > costEstimate('medium', '1536x1024'));
  assert.equal(fileName('SYSTEM VIEW · SOL · SATURN', new Date('2026-10-10T00:00:00Z'), 'png'), 'fidelity-system-view-sol-saturn-2026-10-10.png');
});

test('stylize relay: validates the request, keys the cache, and only takes JSON from this app', () => {
  const png = `data:image/png;base64,${Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString('base64')}`;
  assert.throws(() => parseStylize({ image: 'http://x/y.png', prompt: 'a long enough prompt' }), /data URL/);
  assert.throws(() => parseStylize({ image: png, prompt: 'short' }), /prompt/);
  const r = parseStylize({ image: png, prompt: 'Make this photorealistic.', size: '999x1', quality: 'ultra' });
  assert.equal(r.size, '1024x1024'); assert.equal(r.quality, 'medium');
  const k1 = stylizeKey(r, 'm'), k2 = stylizeKey({ ...r, prompt: `${r.prompt}!` }, 'm'), k3 = stylizeKey(r, 'm2');
  assert.notEqual(k1, k2); assert.notEqual(k1, k3); assert.equal(k1, stylizeKey(r, 'm'));
  const req = (ct, origin) => ({ headers: { 'content-type': ct, ...(origin ? { origin } : {}) } });
  assert.equal(allowedPost(req('application/json'), '127.0.0.1:4011'), true);
  assert.equal(allowedPost(req('application/json', 'http://127.0.0.1:4011'), '127.0.0.1:4011'), true);
  assert.equal(allowedPost(req('application/json', 'http://localhost:5173'), '127.0.0.1:4011'), true); // the Vite dev server
  assert.equal(allowedPost(req('text/plain'), '127.0.0.1:4011'), false); // a cross-site form post
  assert.equal(allowedPost(req('application/json', 'https://evil.example'), '127.0.0.1:4011'), false);
});
