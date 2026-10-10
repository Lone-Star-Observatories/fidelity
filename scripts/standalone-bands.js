// Band images baked into the standalone preview (#28): a small, budgeted set of previews from the same
// backend code the app uses (server/feeds.js, server/bandimages.js, server/imagery.js), re-encoded as
// small WebP and keyed by the URL the app would ask the backend for (src/data/bandbake.js reads them).
//   The Sun: SDO AIA EUV/UV, Nobeyama 17 GHz, SRH 3 GHz and the modelled 1.4 GHz disc (256×256 → 192×192)
//   The System View sky: all-sky surveys from radio to gamma rays (256×128). Not ROSAT: hips2fits renders its
//     256×128 preview all black (sparse counts at that scale), so a baked copy would show nothing.
//   The Galaxy View: Magellanic Cloud cutouts in a few bands (128×128)
// Images are added in priority order until the byte budget is spent; anything unavailable is skipped
// (the app then falls back to its predicted looks, as before).

import sharp from 'sharp';
import { feed } from '../server/feeds.js';
import { hipsImage } from '../server/bandimages.js';
import { surveyCutout } from '../server/imagery.js';
import { cloudSurveyUrl, CLOUDS } from '../src/data/satellite-bands.js';

/** What to bake, highest priority first. */
export const BAKE = [
  ...['sdo-171', 'sdo-304', 'sdo-1600', 'sdo-94', 'srh-3000', 'sunmodel-1400', 'norh-17', 'sdo-193', 'sunmodel-408'].map((id) => ({ kind: 'feed', id })),
  ...['CDS/P/Haslam408', 'CDS/P/Fermi/color', 'CDS/P/WMAP/K/9yr', 'CDS/P/2MASS/color', 'CDS/P/AKARI/FIS/WideS', 'CDS/P/HI4PI/NHI', 'CDS/P/allWISE/color'].map((id) => ({ kind: 'hips', id })),
  ...[['rass', 'lmc'], ['hi4pi', 'lmc'], ['planck', 'lmc'], ['hi4pi', 'smc']].map(([survey, cloud]) => ({ kind: 'cloud', survey, cloud })),
];
const SIZE = { feed: [192, 192], hips: [256, 128], cloud: [128, 128] };
const QUALITY = { feed: 55, hips: 50, cloud: 55 };

async function webp(buf, [w, h], quality) {
  const out = await sharp(buf).resize(w, h, { fit: 'fill' }).webp({ quality, alphaQuality: 60, effort: 6 }).toBuffer();
  return `data:image/webp;base64,${out.toString('base64')}`;
}

/** { bandImages: { [url]: { src, w, h, time, credit, disk?, predicted? } }, report: [{ url, bytes } | { url, skipped }], bytes } */
export async function bakeBandImages({ budget = 100_000, log = console.log } = {}) {
  const bandImages = {}, report = [];
  let bytes = 0;
  for (const item of BAKE) {
    let url, got;
    try {
      if (item.kind === 'feed') {
        url = `/api/feed/${item.id}?size=preview`;
        const f = await feed(item.id, { preview: true });
        got = { body: f.body, time: f.time ?? null, credit: f.credit, disk: f.disk ?? null, predicted: item.id.startsWith('sunmodel-') || undefined };
      } else if (item.kind === 'hips') {
        url = `/api/hips?id=${encodeURIComponent(item.id)}&size=preview`;
        got = { body: (await hipsImage(item.id, 'preview')).body, time: null, credit: item.id };
      } else {
        url = cloudSurveyUrl(item.survey, item.cloud);
        const c = CLOUDS[item.cloud], q = new URLSearchParams({ ra: String(c.ra), dec: String(c.dec), fov: String(c.fov), size: '512' });
        got = { body: (await surveyCutout(item.survey, q)).body, time: null, credit: item.survey };
      }
      const st = await sharp(got.body).stats();
      if (st.channels.slice(0, 3).every((c) => c.max < 8)) throw new Error('blank image');
      const [w, h] = SIZE[item.kind], src = await webp(got.body, [w, h], QUALITY[item.kind]);
      const cost = Math.ceil(((src.length - src.indexOf(',') - 1) * 3) / 4);
      if (bytes + cost > budget) { report.push({ url, skipped: `over the ${budget}-byte budget (${cost} bytes)` }); continue; }
      bytes += cost;
      bandImages[url] = { src, w, h, time: got.time, credit: got.credit, ...(got.disk ? { disk: got.disk } : {}), ...(got.predicted ? { predicted: true } : {}) };
      report.push({ url, bytes: cost });
    } catch (err) {
      report.push({ url: url ?? JSON.stringify(item), skipped: err.message });
      log(`  band image ${url ?? item.id}: ${err.message}`);
    }
  }
  return { bandImages, report, bytes };
}
