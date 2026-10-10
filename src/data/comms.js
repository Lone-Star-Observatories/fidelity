// COMMS (#35): which DSN contacts belong to which body, and the facts the COMMS sections show.
// DSN Now names craft by a short code (dsn.xml `spacecraft`, listed in eyes.nasa.gov/dsn/config.xml).

// Craft whose comms are about a body: the DSN code (lower case) → name. Kept by code rather than
// NAIF id so craft not in the app's fleet (MAVEN, Perseverance, Danuri, Artemis) still match.
export const BODY_CRAFT = {
  moon: { lro: 'Lunar Reconnaissance Orbiter', ch2: 'Chandrayaan-2', ch2o: 'Chandrayaan-2 Orbiter', kplo: 'Danuri (KPLO)', caps: 'CAPSTONE',
    em2: 'Artemis II (Orion)', em3: 'Artemis III', slim: 'SLIM' },
  mars: { mro: 'Mars Reconnaissance Orbiter', mros: 'MRO (relay)', m01o: 'Mars Odyssey', m01s: 'Mars Odyssey', mvn: 'MAVEN', mex: 'Mars Express',
    tgo: 'ExoMars TGO', emm: 'Hope (Emirates Mars Mission)', msl: 'Curiosity', m20: 'Perseverance' },
};
/** DSN contacts about `bodyId` (Moon or Mars craft), by code. */
export const contactsFor = (bodyId, contacts) => (contacts ?? []).filter((c) => BODY_CRAFT[bodyId]?.[String(c.code).toLowerCase()]);
/** Last-seen entries (`/api/dsn` lastSeen) about `bodyId`, newest first. */
export const lastSeenFor = (bodyId, lastSeen) => Object.entries(lastSeen ?? {})
  .filter(([, v]) => BODY_CRAFT[bodyId]?.[String(v.code).toLowerCase()])
  .map(([id, v]) => ({ id: Number(id), ...v, name: BODY_CRAFT[bodyId][String(v.code).toLowerCase()] }))
  .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

export const DSN_COMPLEX = { Goldstone: 'GOLDSTONE, USA', Madrid: 'MADRID, SPAIN', Canberra: 'CANBERRA, AUSTRALIA' };
/** Dish diameter: DSS-14, -43 and -63 are the 70 m antennas; the rest are 34 m. */
export const dishSize = (dish) => (/^DSS-?(14|43|63)$/i.test(dish ?? '') ? 70 : 34);
export const dsnRate = (b) => (b >= 1e6 ? `${(b / 1e6).toFixed(1)} Mb/s` : b >= 1e3 ? `${(b / 1e3).toFixed(1)} kb/s` : `${b.toFixed(b < 10 ? 1 : 0)} b/s`);

/** "12 S AGO", "4 MIN AGO", "3.2 H AGO", "6 DAYS AGO" (or "IN …" for the future). */
export function ago(t, now = Date.now()) {
  const ms = now - (typeof t === 'number' ? t : Date.parse(t));
  if (!Number.isFinite(ms)) return '—';
  const s = Math.abs(ms) / 1000;
  const v = s < 90 ? `${Math.round(s)} S` : s < 5400 ? `${Math.round(s / 60)} MIN` : s < 172800 ? `${(s / 3600).toFixed(1)} H` : `${Math.round(s / 86400)} DAYS`;
  return ms >= 0 ? `${v} AGO` : `IN ${v}`;
}

/** One-way light time in seconds for a distance in AU (or km with `km`). */
export const lightSeconds = (d, km = false) => (km ? d / 299792.458 : d * 499.00478384);
export const formatLight = (s) => (s < 120 ? `${s.toFixed(1)} S` : s < 7200 ? `${Math.floor(s / 60)} MIN ${String(Math.round(s % 60)).padStart(2, '0')} S` : `${(s / 3600).toFixed(2)} H`);

// ISS amateur radio (ARISS), as published at ariss.org/contact-the-iss.html (checked 2026-10-10).
export const ISS_RADIO = {
  source: 'ARISS: Amateur Radio on the International Space Station (ariss.org/contact-the-iss.html, checked 2026-10-10)',
  rows: [
    ['VOICE DOWNLINK', '145.800 MHz FM · WORLDWIDE'],
    ['VOICE UPLINK', '144.490 MHz (ITU REGIONS 2, 3) · 145.200 MHz (REGION 1)'],
    ['APRS / PACKET', '145.825 MHz (VHF) · 437.825 MHz (UHF) · DIGIPEATER, 1200 BAUD AFSK'],
    ['CROSS-BAND REPEATER', '↑ 145.990 MHz (PL 67 Hz) · ↓ 437.800 MHz'],
    ['SSTV', '437.550 MHz ROBOT36 DURING ANNOUNCED EVENTS'],
  ],
  links: [
    ['ARISS SCHOOL CONTACTS ↗', 'https://www.ariss.org/upcoming-educational-contacts.html'],
    ['SSTV EVENTS ↗', 'https://www.ariss.org/upcoming-sstv-events.html'],
    ['ARISS SSTV GALLERY ↗', 'https://ariss-usa.org/ARISS_SSTV/'],
  ],
};

// Curated live video for the Earth signals map: places with a public live view and clear terms
// (operators' own pages; opened in a new window, never embedded). [lat, lon, name, href, detail]
export const CURATED_VIDEO = [
  [19.4069, -155.2834, 'Kīlauea summit webcams', 'https://www.usgs.gov/volcanoes/kilauea/summit-webcams', 'USGS HAWAIIAN VOLCANO OBSERVATORY · PUBLIC DOMAIN'],
  [19.4721, -155.5922, 'Mauna Loa webcams', 'https://www.usgs.gov/volcanoes/mauna-loa/webcams', 'USGS HAWAIIAN VOLCANO OBSERVATORY · PUBLIC DOMAIN'],
  [46.1914, -122.1956, 'Mount St. Helens webcams', 'https://www.usgs.gov/volcanoes/mount-st-helens/webcams', 'USGS CASCADES VOLCANO OBSERVATORY · PUBLIC DOMAIN'],
  [44.4605, -110.8281, 'Yellowstone webcams (Old Faithful)', 'https://www.usgs.gov/volcanoes/yellowstone/webcams', 'USGS YELLOWSTONE VOLCANO OBSERVATORY · PUBLIC DOMAIN'],
  [61.2989, -152.2539, 'Alaska volcano webcams', 'https://avo.alaska.edu/webcam', 'ALASKA VOLCANO OBSERVATORY (USGS / UAF / ADGGS)'],
];
