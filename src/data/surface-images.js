// FROM THE SURFACE (#36): what it looks like standing there. Real pictures taken on (or within
// metres of) the surface wherever a spacecraft or a person took them, MEASURED; elsewhere the app
// renders the view from its own surface mode, IMAGINED (src/panels/surface.js).
//
// Every curated entry: mission, instrument, date (and sol on Mars), where (a #37 site id and/or
// planetocentric lat/lon, east positive), credit, licence, the colour treatment and the source page.
// Images are fetched only through the backend's allowlisted, disk-cached proxies: NASA's image
// library previews (`/api/nasa-image/:id/:size`) and `/api/surface-image?src=` for the hosts below.
// Checked 2026-10-10: every NASA library id and NSSDCA URL returned an image.

import { sitesFor } from './sites.js';

/** How the colours of a picture relate to what an eye would see. */
export const COLOUR_TYPES = {
  natural: 'NATURAL COLOUR',
  'white-balanced': 'WHITE-BALANCED',
  false: 'FALSE COLOUR',
  enhanced: 'ENHANCED / RECONSTRUCTED COLOUR',
  greyscale: 'BLACK AND WHITE',
  raw: 'RAW (UNCALIBRATED)',
};
export const COLOUR_HINTS = {
  natural: 'Approximately what the eye would see there, in that light.',
  'white-balanced': 'Colours shifted as if lit by Earth daylight, so rocks look as geologists would see them at home; the real light there is different.',
  false: 'Colours stand for other wavelengths or are stretched to separate materials: not what an eye would see.',
  enhanced: 'Colour added, reconstructed from spectra or strongly stretched: indicative only.',
  greyscale: 'A single-band (monochrome) camera.',
  raw: 'As the camera sent it: no colour calibration or white balance.',
};

/** Hosts (and path prefixes) the image proxy may fetch. HTTPS only. */
export const SURFACE_HOSTS = [
  { host: 'images-assets.nasa.gov', path: /^\/image\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.~-]+\.(jpg|jpeg|png)$/i },
  { host: 'nssdc.gsfc.nasa.gov', path: /^\/image\/planetary\/[a-z]+\/[A-Za-z0-9_.-]+\.(jpg|jpeg|png)$/i },
  { host: 'mars.nasa.gov', path: /^\/(mars2020-raw-images|msl-raw-images)\/[A-Za-z0-9_./-]+\.(jpg|jpeg|png)$/i },
];
/** Is `url` an image the proxy may fetch? */
export function imageAllowed(url) {
  let u;
  try { u = new URL(url); } catch { return false; }
  if (u.protocol !== 'https:' || u.username || u.password || u.port || u.search || u.hash) return false;
  if (u.pathname.includes('..')) return false;
  return SURFACE_HOSTS.some((h) => h.host === u.hostname && h.path.test(u.pathname));
}

const NASA_ID = /^[A-Za-z0-9_.-]{2,80}$/;
const PD_NASA = 'Public domain (NASA media guidelines; credit requested)';
const NSSDCA = (file) => ({ src: `https://nssdc.gsfc.nasa.gov/image/planetary/${file}` });
const lib = (nasaId) => ({ nasaId, page: `https://images.nasa.gov/details/${nasaId}` });

// [id, title, mission, instrument, date, site id | null, extra]
const img = (body, id, title, mission, instrument, date, site, extra) => ({ body, id, title, mission, instrument, date, site, ...extra });

const MOON = [
  img('moon', 'as11-40-5903', 'Aldrin beside the Eagle\'s leg, Tranquility Base', 'Apollo 11', 'Hasselblad 500EL, 70 mm (Armstrong)', '1969-07-20', 'apollo11-lm',
    { ...lib('as11-40-5903'), colour: 'natural', credit: 'NASA / Neil A. Armstrong', licence: PD_NASA, note: 'The first people on another world. Ektachrome film; the grey is the real colour of the mare soil.' }),
  img('moon', 'as12-48-7133', 'Surveyor 3, with the Apollo 12 LM behind', 'Apollo 12', 'Hasselblad 500EL, 70 mm', '1969-11-20', 'surveyor3',
    { ...lib('AS12-48-7133'), colour: 'natural', credit: 'NASA / Alan L. Bean', licence: PD_NASA, note: 'Two spacecraft on the Moon: Surveyor 3 (landed April 1967) in the foreground, Intrepid behind it, 180 m apart.' }),
  img('moon', 'as15-85-11425', 'Hadley Rille, looking north-west', 'Apollo 15', 'Hasselblad 500EL, 70 mm', '1971-07-31', null,
    { ...lib('as15-85-11425'), lat: 26.08, lon: 3.56, approx: 'NEAR STATION 2 (ST. GEORGE CRATER), ~1.5 KM FROM THE LM', colour: 'natural', credit: 'NASA', licence: PD_NASA, note: 'Layering in the rille wall and boulders on its floor, from the first Apollo 15 moonwalk.' }),
  img('moon', 'as17-140-21497', 'Schmitt at the split boulder, Station 6', 'Apollo 17', 'Hasselblad 500EL, 70 mm (Cernan)', '1972-12-13', null,
    { ...lib('as17-140-21497'), lat: 20.29, lon: 30.80, approx: 'STATION 6, NORTH MASSIF FOOT, ~4 KM FROM THE LM', colour: 'natural', credit: 'NASA / Eugene A. Cernan', licence: PD_NASA, note: 'The last human expedition on the Moon, Taurus–Littrow valley.' }),
  img('moon', 'pia02976', 'Surveyor 1\'s shadow in the late lunar afternoon', 'Surveyor 1', 'Surveyor TV camera', '1966-06', 'surveyor1',
    { ...lib('PIA02976'), colour: 'greyscale', credit: 'NASA/JPL', licence: PD_NASA, note: 'The first US soft landing: the lander\'s own shadow, the horizon at upper right.' }),
];

const MARS = [
  img('mars', 'viking1-pano', 'Chryse Planitia panorama', 'Viking 1 lander', 'Facsimile camera', '1976-07', 'viking1',
    { ...NSSDCA('mars/vikinglander1-1.jpg'), page: 'https://nssdc.gsfc.nasa.gov/photo_gallery/photogallery-mars.html', colour: 'enhanced', credit: 'NASA/JPL (via NASA NSSDCA)', licence: PD_NASA, note: 'The first photographs from the surface of Mars (1976). Colour from the camera\'s filter diodes, as reprocessed for the archive.' }),
  img('mars', 'pia00396', 'Viking Lander 2\'s first picture on Utopia Planitia', 'Viking 2 lander', 'Facsimile camera', '1976-09-03', 'viking2',
    { ...lib('PIA00396'), colour: 'greyscale', credit: 'NASA/JPL', licence: PD_NASA, note: 'Rocks and a footpad on the boulder-strewn plain where Viking 2 landed.' }),
  img('mars', 'pia00662', '360° "Monster" panorama, Sol 3', 'Mars Pathfinder', 'IMP (Imager for Mars Pathfinder)', '1997-07-06', 'pathfinder',
    { ...lib('PIA00662'), sol: 3, colour: 'greyscale', credit: 'NASA/JPL', licence: PD_NASA, note: 'The lander\'s petals, airbags, ramps and Sojourner on the Ares Vallis flood plain. The camera stood 1.8 m up.' }),
  img('mars', 'pia11746', 'Full-circle Bonestell panorama, Home Plate', 'Spirit (MER-A)', 'Pancam', '2008', 'spirit-final',
    { ...lib('PIA11746'), approx: 'NEAR HOME PLATE, GUSEV (WITHIN ~1 KM)', colour: 'natural', credit: 'NASA/JPL-Caltech/Cornell University', licence: PD_NASA, note: 'Approximately true colour, where Spirit spent its third Martian winter.' }),
  img('mars', 'pia11754', 'Full-circle Santorini panorama, Victoria crater', 'Opportunity (MER-B)', 'Pancam', '2008', null,
    { ...lib('PIA11754'), lat: -2.05, lon: -5.50, approx: 'VICTORIA CRATER RIM, MERIDIANI (WITHIN ~1 KM)', colour: 'natural', credit: 'NASA/JPL-Caltech/Cornell University', licence: PD_NASA, note: 'Approximately true colour on the plains of Meridiani.' }),
  img('mars', 'pia11007', 'Full-circle colour panorama of the landing site', 'Phoenix', 'SSI (Surface Stereo Imager)', '2008-06', 'phoenix',
    { ...lib('PIA11007'), colour: 'natural', credit: 'NASA/JPL-Caltech/University of Arizona/Texas A&M University', licence: PD_NASA, note: 'Approximately true colour: polygon-patterned permafrost ground at 68° N.' }),
  img('mars', 'pia16101', 'Landing-site panorama with Mount Sharp', 'Curiosity (MSL)', 'Mastcam', '2012-08', 'curiosity-landing',
    { ...lib('PIA16101'), colour: 'white-balanced', credit: 'NASA/JPL-Caltech/MSSS', licence: PD_NASA, note: 'Bradbury Landing, Gale crater: the highest part of Mount Sharp visible to the rover. Mastcam panoramas are usually white-balanced.' }),
  img('mars', 'pia19400', 'Sunset in Gale crater, Sol 956', 'Curiosity (MSL)', 'Mastcam (left)', '2015-04-15', null,
    { ...lib('PIA19400'), sol: 956, lat: -4.72, lon: 137.37, approx: 'PAHRUMP HILLS AREA, ~5 KM FROM THE LANDING SITE', colour: 'white-balanced', credit: 'NASA/JPL-Caltech/MSSS/Texas A&M Univ.', licence: PD_NASA, note: 'The first colour Martian sunset Curiosity saw: fine dust lets blue light through near the Sun. Calibrated and white-balanced.' }),
  img('mars', 'pia24264', 'Mastcam-Z\'s first 360° panorama, Sol 3', 'Perseverance (Mars 2020)', 'Mastcam-Z', '2021-02-21', 'perseverance-landing',
    { ...lib('PIA24264'), sol: 3, colour: 'natural', credit: 'NASA/JPL-Caltech/ASU/MSSS', licence: PD_NASA, note: 'Octavia E. Butler Landing, Jezero crater: 142 images stitched on Earth.' }),
  img('mars', 'pia23140', 'Homestead hollow panorama, Sol 14', 'InSight', 'IDC (Instrument Deployment Camera)', '2018-12-09', 'insight',
    { ...lib('PIA23140'), sol: 14, colour: 'natural', credit: 'NASA/JPL-Caltech', licence: PD_NASA, note: 'A 290° view of the degraded crater InSight landed in, Elysium Planitia.' }),
];

const VENUS = [
  img('venus', 'venera9-10', 'The first pictures from the surface of another planet', 'Venera 9 and 10 landers', 'Optical-mechanical panoramic cameras', '1975-10-22', 'venera9',
    { ...NSSDCA('venus/venera9-10.jpg'), page: 'https://nssdc.gsfc.nasa.gov/photo_gallery/photogallery-venus.html', colour: 'greyscale', credit: 'Soviet Academy of Sciences / IKI (via NASA NSSDCA)', licence: 'Soviet mission data, archived by NASA NSSDCA; no formal licence stated: credit IKI, check before reuse', note: 'Venera 9 (top, on a 30° slope) and Venera 10 (bottom, ~2,100 km away). Rocks 0.3–1 m across. The lander was crushed and cooked within the hour.' }),
  img('venus', 'venera13-left', 'Venera 13 colour panorama (left half)', 'Venera 13 lander', 'Colour optical-mechanical camera', '1982-03-01', 'venera13',
    { ...NSSDCA('venus/venera13-left.jpg'), page: 'https://nssdc.gsfc.nasa.gov/photo_gallery/photogallery-venus.html', colour: 'natural', credit: 'Soviet Academy of Sciences / IKI (via NASA NSSDCA)', licence: 'Soviet mission data, archived by NASA NSSDCA; no formal licence stated: credit IKI, check before reuse', note: 'Colour from filter scans (approximate). The orange is real: sunlight filtered through 50 km of cloud. Part of the lander and its dropped lens cap at the bottom. Survived 127 minutes at 457 °C and 89 bar.' }),
  img('venus', 'venera14', 'Venera 14 panorama', 'Venera 14 lander', 'Colour optical-mechanical camera', '1982-03-05', 'venera14',
    { ...NSSDCA('venus/venera14.jpg'), page: 'https://nssdc.gsfc.nasa.gov/photo_gallery/photogallery-venus.html', colour: 'natural', credit: 'Soviet Academy of Sciences / IKI (via NASA NSSDCA)', licence: 'Soviet mission data, archived by NASA NSSDCA; no formal licence stated: credit IKI, check before reuse', note: 'Flat layered basaltic plates, ~950 km from Venera 13. Colour approximate, from filter scans.' }),
];

const TITAN = [
  img('titan', 'pia07232', 'The surface of Titan: first colour view', 'Cassini–Huygens (Huygens probe)', 'DISR (Descent Imager/Spectral Radiometer)', '2005-01-14', 'huygens',
    { ...lib('PIA07232'), colour: 'enhanced', credit: 'ESA/NASA/JPL/University of Arizona', licence: 'ESA/NASA/University of Arizona; NASA-released, credit required', note: 'Taken on the ground: rounded water-ice "pebbles" 10–15 cm across, ~85 cm away. Colour reconstructed from DISR\'s reflection spectra.' }),
  img('titan', 'pia06439', 'Descent panorama from 7 to 0.5 km', 'Cassini–Huygens (Huygens probe)', 'DISR (Descent Imager/Spectral Radiometer)', '2005-01-14', 'huygens',
    { ...lib('PIA06439'), colour: 'greyscale', credit: 'ESA/NASA/JPL/University of Arizona', licence: 'ESA/NASA/University of Arizona; NASA-released, credit required', note: 'Drainage channels cut into a bright ridge beside the dark plain where the probe landed. The white dots are its ground track.' }),
];

const SMALL = [
  img('eros', 'pia03148', 'The last, closest image of Eros', 'NEAR Shoemaker', 'MSI (Multispectral Imager)', '2001-02-12', 'near-eros',
    { ...lib('PIA03148'), colour: 'greyscale', credit: 'NASA/JHUAPL', licence: PD_NASA, note: 'From about 120 m up, moments before the first touchdown on an asteroid; the streaks at the bottom are where transmission stopped at contact.' }),
  img('67p', 'pia18878', 'Comet 67P from 40 m', 'Rosetta / Philae', 'ROLIS (descent imager)', '2014-11-12', 'philae-agilkia',
    { ...lib('PIA18878'), colour: 'greyscale', credit: 'ESA/Rosetta/Philae/ROLIS/DLR', licence: 'ESA/DLR; NASA-released, credit required', note: 'About 40 m above the Agilkia site, during the descent.' }),
  img('67p', 'pia18876', 'Welcome to a comet: Philae on the surface', 'Rosetta / Philae', 'CIVA-P panoramic cameras', '2014-11-12', 'philae-abydos',
    { ...lib('PIA18876'), colour: 'greyscale', credit: 'ESA/Rosetta/Philae/CIVA', licence: 'ESA; NASA-released, credit required', note: 'One of the lander\'s feet in the foreground, at its final, shaded resting place.' }),
  img('67p', 'pia18879', 'First panorama from a comet\'s surface', 'Rosetta / Philae', 'CIVA-P panoramic cameras', '2014-11-13', 'philae-abydos',
    { ...lib('PIA18879'), colour: 'greyscale', credit: 'ESA/Rosetta/Philae/CIVA', licence: 'ESA; NASA-released, credit required', note: 'Unprocessed 360° view around the final touchdown point, beneath a cliff.' }),
];

// Earth: a few public live views from the ground (#37 observatory webcams, through `/api/feed/:id`).
const EARTH = [
  img('earth', 'live-paranal', 'Paranal, Atacama desert (VLT)', 'ESO Paranal', 'Panorama webcam', 'live', 'paranal',
    { feed: 'cam-eso-paranal-pano', colour: 'natural', credit: 'ESO', licence: 'ESO webcam image (ESO terms: credit ESO)', note: 'One of the driest, darkest places on Earth, 2,635 m up.' }),
  img('earth', 'live-mcdonald', 'McDonald Observatory, West Texas', 'McDonald Observatory', '360° webcam', 'live', 'mcdonald',
    { feed: 'cam-mcdonald-pano', colour: 'natural', credit: 'McDonald Observatory, UT Austin', licence: 'Operator webcam, credit required', note: 'Mt Locke and the Hobby–Eberly Telescope.' }),
  img('earth', 'live-south-pole', 'The South Pole', 'NOAA GML South Pole observatory', 'Webcam', 'live', 'south-pole',
    { feed: 'cam-south-pole-aro', colour: 'natural', credit: 'NOAA GML / NSF USAP', licence: 'US Government work (public domain)', note: 'Six months of day, six of night, 2,810 m up on the ice.' }),
  img('earth', 'live-la-palma', 'Roque de los Muchachos, La Palma', 'Nordic Optical Telescope', 'Caldera webcam', 'live', 'la-palma',
    { feed: 'cam-not-caldera', colour: 'natural', credit: 'Nordic Optical Telescope', licence: 'Operator webcam, credit required', note: 'Above the clouds on the rim of the Caldera de Taburiente.' }),
  img('earth', 'live-mt-wilson', 'Mount Wilson, over Los Angeles', 'HPWREN', 'HPWREN fire-watch camera', 'live', 'mt-wilson',
    { feed: 'cam-mt-wilson-hpwren', colour: 'natural', credit: 'HPWREN (UC San Diego)', licence: 'HPWREN imagery, credit required', note: 'Where Hubble measured the expanding universe.' }),
];

/** Curated sets by body id, each entry resolved to a location { lat, lon, siteName }. */
export const SURFACE_IMAGES = {};
for (const e of [...MOON, ...MARS, ...VENUS, ...TITAN, ...SMALL, ...EARTH]) {
  const s = e.site ? sitesFor(e.body).find((x) => x.id === e.site) : null;
  const where = { lat: e.lat ?? s?.lat ?? null, lon: e.lon ?? s?.lon ?? null, siteName: s?.name ?? null };
  (SURFACE_IMAGES[e.body] ??= []).push(Object.freeze({ ...e, ...where, tier: 'measured' }));
}

/** Live raw-image feeds the backend reads for a body (latest pictures, with today's rover position). */
export const LIVE_SURFACE = {
  mars: [
    { id: 'm20', mission: 'Perseverance (Mars 2020)', traverse: 'm20', page: 'https://science.nasa.gov/mission/mars-2020-perseverance/raw-images/',
      api: 'https://mars.nasa.gov/rss/api/?feed=raw_images&category=mars2020&feedtype=json', cameras: [['MCZ_LEFT', 'Mastcam-Z (left)'], ['NAVCAM_LEFT', 'Navcam (left)']] },
    { id: 'msl', mission: 'Curiosity (MSL)', traverse: 'msl', page: 'https://science.nasa.gov/mission/msl-curiosity/raw-images/',
      api: 'https://mars.nasa.gov/api/v1/raw_image_items/', cameras: [['MAST_LEFT', 'Mastcam (left)'], ['NAV_LEFT_B', 'Navcam (left, B side)']] },
  ],
};

/** Archival sets found but not attached yet (licence to confirm or host not proxied); ready to add here. */
export const PENDING_SURFACE = [
  { body: 'moon', set: "Chang'e 3/4/5/6 and Yutu/Yutu-2 panoramas", source: 'CNSA / CLEP (Lunar and Planetary Data Release System, moon.bao.ac.cn)', page: 'https://moon.bao.ac.cn/', why: 'Licence check: CNSA data terms require registration and do not state public reuse.' },
  { body: 'moon', set: 'Lunokhod 1/2 panoramas', source: 'Russian Academy of Sciences / IKI (reprocessed by Don P. Mitchell)', page: 'http://mentallandscape.com/C_CatalogMoon.htm', why: 'Licence check: reprocessing copyright (D. P. Mitchell); Soviet originals with no stated licence.' },
  { body: 'moon', set: 'Apollo Hasselblad magazines (full rolls)', source: 'Project Apollo Archive (Flickr, public domain scans)', page: 'https://www.flickr.com/photos/projectapolloarchive/albums', why: 'Needs Flickr API access (key) to list albums; NASA library ids are used instead for now.' },
  { body: 'mars', set: 'Zhurong rover panoramas (Utopia Planitia)', source: 'CNSA', page: 'https://www.cnsa.gov.cn/', site: 'zhurong-lander', why: 'Licence check: CNSA terms not stated for reuse.' },
  { body: 'venus', set: 'Venera 9–14 panoramas, reprocessed', source: 'Don P. Mitchell (mentallandscape.com), from IKI originals', page: 'http://mentallandscape.com/C_CatalogVenus.htm', why: 'Licence check: the reprocessing is the author\'s work; NSSDCA originals are attached instead.' },
  { body: 'ryugu', set: 'MINERVA-II1 rover and MASCOT surface images', source: 'JAXA, University of Tokyo, DLR/CNES', page: 'https://www.hayabusa2.jaxa.jp/en/galleries/', site: 'hayabusa2-td1', why: 'Host not proxied yet; JAXA image terms (credit required) to confirm.' },
  { body: 'itokawa', set: 'Hayabusa descent images of MUSES-C Regio (~70 m)', source: 'JAXA/ISAS', page: 'https://www.isas.jaxa.jp/en/', site: 'hayabusa-muses-c', why: 'Host not proxied yet; JAXA image terms (credit required) to confirm.' },
  { body: 'bennu', set: 'OSIRIS-REx SamCam touch-and-go sequence (Nightingale)', source: 'NASA/Goddard/University of Arizona', page: 'https://science.nasa.gov/mission/osiris-rex/', site: 'osirisrex-nightingale', why: 'Public domain; not in the NASA image library under a stable id: attach once a stable URL is chosen.' },
];

const R2D = 180 / Math.PI;
/** Great-circle separation of two lat/lon points, degrees. */
export function separationDeg(lat1, lon1, lat2, lon2) {
  const d = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * d) / 2) ** 2 + Math.cos(lat1 * d) * Math.cos(lat2 * d) * Math.sin(((lon2 - lon1) * d) / 2) ** 2;
  return 2 * Math.asin(Math.min(1, Math.sqrt(a))) * R2D;
}
/** Sort images nearest-first to (lat, lon); entries without a location go last. Stable otherwise. */
export function nearestFirst(items, lat, lon) {
  if (lat == null || lon == null) return [...items];
  const key = (x) => (x.lat == null ? Infinity : separationDeg(lat, lon, x.lat, x.lon));
  return items.map((x, i) => [key(x), i, x]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map((r) => r[2]);
}

/**
 * What the FROM THE SURFACE card shows for a body: real imagery (MEASURED) if any exists for it,
 * otherwise the in-app render (IMAGINED). `near` = { lat, lon } sorts the images nearest-first.
 * Returns { tier, images, live, pending, solidSurface, renderLabel }.
 */
export function surfaceSelection(body, { near = null, isSol = true } = {}) {
  const id = body?.id;
  const images = isSol ? nearestFirst(SURFACE_IMAGES[id] ?? [], near?.lat, near?.lon) : [];
  const live = isSol ? LIVE_SURFACE[id] ?? [] : [];
  const pending = isSol ? PENDING_SURFACE.filter((p) => p.body === id) : [];
  const giant = (body?.radiusKm ?? 0) > 20000 && body?.kind !== 'star';
  return {
    tier: images.length || live.length ? 'measured' : 'imagined',
    images, live, pending,
    solidSurface: !giant,
    renderLabel: giant ? 'AT THE CLOUD TOPS (1 BAR)' : 'STANDING ON THE SURFACE',
  };
}

/** Local URL of an image's preview ('thumb') or large ('full') version through the backend proxies. */
export function proxiedImage(e, size = 'thumb') {
  if (e.nasaId && NASA_ID.test(e.nasaId)) return `/api/nasa-image/${encodeURIComponent(e.nasaId)}/${size === 'full' ? 'medium' : 'thumb'}`;
  const src = size === 'full' ? e.full ?? e.src : e.thumb ?? e.src;
  return src && imageAllowed(src) ? `/api/surface-image?src=${encodeURIComponent(src)}` : null;
}

