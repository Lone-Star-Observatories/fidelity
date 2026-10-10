import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SURFACE_IMAGES, LIVE_SURFACE, PENDING_SURFACE, COLOUR_TYPES, COLOUR_HINTS, imageAllowed, proxiedImage, surfaceSelection, nearestFirst, separationDeg } from '../src/data/surface-images.js';
import { sitesFor } from '../src/data/sites.js';
import { solSystem } from '../src/data/systems.js';
import { m20Items, mslItems, sniffImage, surfaceImages, surfaceImage } from '../server/surfaceimages.js';
import { texLon } from '../src/panels/surface.js';

const sol = solSystem();
const body = (id) => sol.bodies.find((b) => b.id === id);
const all = Object.values(SURFACE_IMAGES).flat();

test('every curated surface image is complete: mission, instrument, date, location, credit, licence, colour type, source', () => {
  assert.ok(all.length >= 25);
  const ids = new Set();
  for (const e of all) {
    const what = `${e.body}/${e.id}`;
    assert.ok(!ids.has(e.id), `${what} duplicate id`); ids.add(e.id);
    assert.ok(body(e.body), `${what}: body exists in the app`);
    for (const k of ['title', 'mission', 'instrument', 'date', 'credit', 'licence']) assert.ok(typeof e[k] === 'string' && e[k].length > 2, `${what}: ${k}`);
    assert.ok(e.date === 'live' || /^\d{4}(-\d{2}(-\d{2})?)?$/.test(e.date), `${what}: date ${e.date}`);
    assert.ok(e.colour in COLOUR_TYPES && COLOUR_HINTS[e.colour], `${what}: colour type ${e.colour}`);
    assert.ok(Number.isFinite(e.lat) && Math.abs(e.lat) <= 90 && Number.isFinite(e.lon) && Math.abs(e.lon) <= 180, `${what}: location`);
    if (e.site) assert.ok(sitesFor(e.body).some((s) => s.id === e.site), `${what}: site ${e.site} is a #37 site`);
    else assert.ok(e.approx, `${what}: a location without a site says how approximate it is`);
    assert.equal(e.tier, 'measured');
    if (e.sol != null) assert.equal(e.body, 'mars', `${what}: sols are Martian days`);
    // the source: a NASA library id, an allowlisted URL, or one of the backend's webcam feeds
    const sources = [e.nasaId, e.src, e.feed].filter(Boolean);
    assert.equal(sources.length, 1, `${what}: exactly one image source`);
    if (e.src) assert.ok(imageAllowed(e.src), `${what}: ${e.src} on an allowlisted host`);
    if (e.nasaId) assert.match(e.nasaId, /^[A-Za-z0-9_.-]{2,80}$/);
    if (e.feed) assert.match(e.feed, /^cam-[a-z0-9-]+$/);
    if (!e.feed) assert.ok(proxiedImage(e, 'thumb')?.startsWith('/api/'), `${what}: a local proxied URL`);
    assert.ok(e.page ? /^https?:\/\//.test(e.page) : e.feed, `${what}: source page`);
  }
});

test('the bodies with real landed imagery are covered; the rest are listed as ready to attach', () => {
  for (const id of ['moon', 'mars', 'venus', 'titan', 'eros', '67p', 'earth']) assert.ok(SURFACE_IMAGES[id]?.length, id);
  for (const p of PENDING_SURFACE) {
    assert.ok(body(p.body), `${p.body} exists`);
    assert.ok(p.why && p.source && /^https?:\/\//.test(p.page), `${p.set}: why, source and page`);
    if (p.site) assert.ok(sitesFor(p.body).some((s) => s.id === p.site), p.site);
  }
  for (const id of ['ryugu', 'itokawa', 'bennu']) assert.ok(PENDING_SURFACE.some((p) => p.body === id), `${id} pending`);
});

test('MEASURED where a spacecraft took pictures on the surface, IMAGINED (an in-app render) everywhere else', () => {
  for (const id of ['moon', 'mars', 'venus', 'titan', 'earth', 'eros', '67p']) assert.equal(surfaceSelection(body(id)).tier, 'measured', id);
  for (const id of ['mercury', 'jupiter', 'europa', 'ceres', 'pluto', 'bennu', 'ryugu']) assert.equal(surfaceSelection(body(id)).tier, 'imagined', id);
  // an exoplanet is never shown Sol's pictures, even if it shares an id
  assert.equal(surfaceSelection({ id: 'mars', radiusKm: 3390 }, { isSol: false }).tier, 'imagined');
  assert.equal(surfaceSelection({ id: 'mars', radiusKm: 3390 }, { isSol: false }).images.length, 0);
  // giants have no ground: the render is at the cloud tops
  assert.equal(surfaceSelection(body('jupiter')).solidSurface, false);
  assert.match(surfaceSelection(body('jupiter')).renderLabel, /CLOUD TOPS/);
  assert.equal(surfaceSelection(body('moon')).solidSurface, true);
  assert.equal(surfaceSelection(body('mars')).live.length, LIVE_SURFACE.mars.length);
});

test('images sort nearest-first to the surface spot', () => {
  const near = surfaceSelection(body('mars'), { near: { lat: 18.4, lon: 77.4 } }).images; // Jezero
  assert.equal(near[0].mission, 'Perseverance (Mars 2020)');
  const viking = nearestFirst(SURFACE_IMAGES.mars, 22, -48)[0];
  assert.equal(viking.site, 'viking1');
  assert.ok(Math.abs(separationDeg(0, 0, 0, 90) - 90) < 1e-9);
  assert.ok(Math.abs(separationDeg(10, 179, 10, -179) - 2 * Math.cos(10 * Math.PI / 180)) < 0.01);
  assert.deepEqual(nearestFirst(SURFACE_IMAGES.venus, null, null).map((x) => x.id), SURFACE_IMAGES.venus.map((x) => x.id));
});

test('the image proxy allowlist: HTTPS, known hosts and paths, image files only', () => {
  assert.ok(imageAllowed('https://images-assets.nasa.gov/image/PIA07232/PIA07232~thumb.jpg'));
  assert.ok(imageAllowed('https://nssdc.gsfc.nasa.gov/image/planetary/venus/venera14.jpg'));
  assert.ok(imageAllowed('https://mars.nasa.gov/mars2020-raw-images/pub/ods/surface/sol/02004/ids/edr/browse/zcam/ZL7_2004_0844860540_348EBY_N0910970ZCAM01018_0340LMJ01_800.jpg'));
  assert.ok(imageAllowed('https://mars.nasa.gov/msl-raw-images/proj/msl/redops/ods/surface/sol/05033/opgs/edr/ncam/NLB_844313041EDR_F1250558NCAM00327M_.JPG'));
  for (const bad of ['http://nssdc.gsfc.nasa.gov/image/planetary/venus/venera14.jpg', 'https://evil.example/image/planetary/x.jpg',
    'https://mars.nasa.gov/rss/api/?feed=raw_images', 'https://mars.nasa.gov/msl-raw-images/../../etc/passwd.jpg',
    'https://nssdc.gsfc.nasa.gov/image/planetary/venus/venera14.html', 'https://user:pw@nssdc.gsfc.nasa.gov/image/planetary/venus/v.jpg',
    'https://nssdc.gsfc.nasa.gov.evil.example/image/planetary/venus/v.jpg', 'https://nssdc.gsfc.nasa.gov:8443/image/planetary/venus/v.jpg', 'not a url', ''])
    assert.equal(imageAllowed(bad), false, bad);
});

test('raw-image API rows: full frames only, dated, on allowlisted hosts, honestly badged as raw', () => {
  const m20 = m20Items({ images: [
    { imageid: 'ZL7_A', sol: 2004, sample_type: 'Full', date_taken_utc: '2026-10-09T23:54:17.572', credit: 'NASA/JPL-Caltech/ASU', title: 'Sol 2004: Left Mastcam-Z',
      image_files: { medium: 'https://mars.nasa.gov/mars2020-raw-images/pub/a_800.jpg', large: 'https://mars.nasa.gov/mars2020-raw-images/pub/a_1200.jpg' } },
    { imageid: 'ZL7_B', sol: 2004, sample_type: 'Thumbnail', image_files: { medium: 'https://mars.nasa.gov/mars2020-raw-images/pub/b.jpg' } },
  ] }, 'Mastcam-Z (left)');
  assert.equal(m20.length, 1);
  assert.equal(m20[0].sol, 2004); assert.equal(m20[0].date, '2026-10-09T23:54:17Z'); assert.equal(m20[0].colour, 'raw');
  assert.ok(imageAllowed(m20[0].src));
  const msl = mslItems({ items: [
    { imageid: 'NLB_1', sol: 5033, instrument: 'NAV_LEFT_B', date_taken: '2026-10-03T16:36:30.000Z', https_url: 'https://mars.nasa.gov/msl-raw-images/proj/msl/x.JPG', extended: { sample_type: 'full' } },
    { imageid: 'ML_2', sol: 5033, instrument: 'MAST_LEFT', https_url: 'https://mars.nasa.gov/msl-raw-images/proj/msl/y.JPG', extended: { sample_type: 'subframe' } },
  ] }, 'Navcam (left, B side)');
  assert.equal(msl.length, 1);
  assert.equal(msl[0].colour, 'greyscale');
  assert.equal(msl[0].credit, 'NASA/JPL-Caltech');
});

test('the proxy refuses other hosts before fetching, and checks magic bytes', async () => {
  await assert.rejects(surfaceImage(new URLSearchParams({ src: 'https://example.com/a.jpg' })), (e) => e.status === 403);
  await assert.rejects(surfaceImages(new URLSearchParams({ body: '../etc' })), (e) => e.status === 400);
  const none = await surfaceImages(new URLSearchParams({ body: 'mercury' }));
  assert.deepEqual([none.curated.length, none.live.length], [0, 0]);
  const venus = await surfaceImages(new URLSearchParams({ body: 'venus' }));
  assert.ok(venus.curated.every((e) => e.thumbUrl.startsWith('/api/surface-image?src=')));
  assert.equal(sniffImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0])), 'image/jpeg');
  assert.equal(sniffImage(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0])), 'image/png');
  assert.equal(sniffImage(Buffer.from('<html>')), null);
});

test('planetocentric → texture longitude follows the body\'s texture origin (Pluto)', () => {
  assert.equal(texLon({}, 23.47), 23.47);
  assert.equal(texLon({ texLon0: 0 }, 30), -150);
  assert.equal(texLon({ texLon0: 0 }, -170), 10);
});
