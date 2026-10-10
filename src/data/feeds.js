// Which live feeds belong to which spacecraft (by NORAD catalogue number). Feed ids are served
// by the backend (server/feeds.js) and cached briefly; video is embedded from the operator.

// ISS live video: specific YouTube stream ids (the old channel-level `live_stream?channel=`
// embed no longer resolves). The viewer offers them as channels; if one is offline, try the next.
export const ISS_STREAMS = [
  { id: 'awQzjn72bI0', label: 'NASA HD', credit: 'NASA — live high-definition views from the ISS (official stream; blank or blue screen during loss of signal)' },
  { id: 'fO9e9jnhYK8', label: 'SEN 4K', credit: 'Sen — 24/7 Earth from Sen\'s 4K cameras on the ISS' },
];
/** Embed and watch URLs for a YouTube stream id. */
export const youtubeEmbed = (id) => `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&playsinline=1`;
export const youtubeWatch = (id) => `https://www.youtube.com/watch?v=${id}`;

export const SAT_FEEDS = {
  25544: [ // ISS
    { kind: 'video', label: 'LIVE VIDEO', streams: ISS_STREAMS },
    { kind: 'crew', id: 'crew', label: 'CREW ABOARD', craft: 'ISS' },
  ],
  48274: [{ kind: 'crew', id: 'crew', label: 'CREW ABOARD', craft: 'TIANGONG' }], // Tiangong (CSS Tianhe)
  60133: [{ kind: 'image', id: 'goes-east', label: 'FULL DISK · NOW' }, { kind: 'xray', id: 'goes-xray', label: 'SOLAR X-RAYS' }], // GOES-19
  51850: [{ kind: 'image', id: 'goes-west', label: 'FULL DISK · NOW' }], // GOES-18
  41836: [{ kind: 'image', id: 'himawari', label: 'FULL DISK · NOW' }], // Himawari-9
  36395: [{ kind: 'image', id: 'sdo-hmi', label: 'SUN · VISIBLE' }, { kind: 'image', id: 'sdo-193', label: 'SUN · CORONA 193 Å' }, { kind: 'image', id: 'sdo-304', label: 'SUN · 304 Å' }], // SDO
  20580: [{ kind: 'observing', mission: 'hst', label: 'RECENT IMAGES' }], // Hubble
  25994: [{ kind: 'image', id: 'gibs-terra', label: "YESTERDAY'S EARTH" }], // Terra
  27424: [{ kind: 'image', id: 'gibs-aqua', label: "YESTERDAY'S EARTH" }], // Aqua
  37849: [{ kind: 'image', id: 'gibs-snpp', label: "YESTERDAY'S EARTH" }], // Suomi NPP
  43013: [{ kind: 'image', id: 'gibs-noaa20', label: "YESTERDAY'S EARTH" }], // NOAA-20
  54234: [{ kind: 'image', id: 'gibs-noaa21', label: "YESTERDAY'S EARTH" }], // NOAA-21
  54743: [{ kind: 'image', id: 'mtg-0', label: 'FULL DISK · NOW' }], // Meteosat-12 (MTG-I1), 0°
  40732: [{ kind: 'image', id: 'msg-0', label: 'FULL DISK · NOW' }], // Meteosat-11, 0° full-disk service
  38552: [{ kind: 'image', id: 'msg-rss', label: 'RAPID SCAN · EUROPE' }], // Meteosat-10, 5-minute rapid scan
  28912: [{ kind: 'image', id: 'msg-iodc', label: 'INDIAN OCEAN · NOW' }], // Meteosat-9, IODC 45.5° E
  41335: [{ kind: 'image', id: 'sentinel3-olci', label: "TODAY'S SWATHS (A+B)" }], // Sentinel-3A
  43437: [{ kind: 'image', id: 'sentinel3-olci', label: "TODAY'S SWATHS (A+B)" }], // Sentinel-3B
  39084: [{ kind: 'image', id: 'hls-landsat', label: 'RECENT SCENES (L8+L9)' }], // Landsat 8
  49260: [{ kind: 'image', id: 'hls-landsat', label: 'RECENT SCENES (L8+L9)' }], // Landsat 9
  40697: [{ kind: 'image', id: 'hls-sentinel2', label: 'RECENT SCENES (S2)' }], // Sentinel-2A
  42063: [{ kind: 'image', id: 'hls-sentinel2', label: 'RECENT SCENES (S2)' }], // Sentinel-2B
  60989: [{ kind: 'image', id: 'hls-sentinel2', label: 'RECENT SCENES (S2)' }], // Sentinel-2C
};
/** Does this satellite have a live feed? */
export const hasFeed = (norad) => (SAT_FEEDS[norad]?.length ?? 0) > 0;

// Shortcuts in the satellite panel.
export const FEATURED = [[25544, 'ISS'], [48274, 'TIANGONG'], [20580, 'HUBBLE'], [60133, 'GOES-19'], [41836, 'HIMAWARI-9'], [36395, 'SDO'], [25994, 'TERRA'], [43013, 'NOAA-20'], [49260, 'LANDSAT 9'], [54743, 'METEOSAT-12'], [40697, 'SENTINEL-2A']];

// Real sizes (largest dimension, km) where well known; others are drawn at a nominal 5 m.
export const SAT_SIZE_KM = { 25544: 0.109, 48274: 0.055, 20580: 0.0132, 60133: 0.0062, 51850: 0.0062, 36395: 0.0062, 25994: 0.0068, 27424: 0.0068 };

export const CATEGORY_LABEL = { stations: 'SPACE STATIONS', science: 'SCIENCE', weather: 'WEATHER', earth: 'EARTH OBSERVATION', navigation: 'NAVIGATION (GNSS)',
  starlink: 'STARLINK', oneweb: 'ONEWEB', comms: 'COMMUNICATIONS', military: 'MILITARY', other: 'OTHER' };
