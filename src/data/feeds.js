// Which live feeds belong to which spacecraft (by NORAD catalogue number). Feed ids are served
// by the backend (server/feeds.js) and cached briefly; video is embedded from the operator.

export const SAT_FEEDS = {
  25544: [ // ISS
    { kind: 'video', label: 'LIVE VIDEO', url: 'https://www.youtube.com/embed/live_stream?channel=UCLA_DiR1FfKNvjuUpBHmylQ', link: 'https://www.nasa.gov/live',
      credit: 'NASA live stream (often Earth views from the ISS; sometimes other NASA programming)' },
    { kind: 'crew', id: 'crew', label: 'CREW ABOARD', craft: 'ISS' },
  ],
  48274: [{ kind: 'crew', id: 'crew', label: 'CREW ABOARD', craft: 'TIANGONG' }], // Tiangong (CSS Tianhe)
  60133: [{ kind: 'image', id: 'goes-east', label: 'FULL DISK · NOW' }, { kind: 'xray', id: 'goes-xray', label: 'SOLAR X-RAYS' }], // GOES-19
  51850: [{ kind: 'image', id: 'goes-west', label: 'FULL DISK · NOW' }], // GOES-18
  41836: [{ kind: 'image', id: 'himawari', label: 'FULL DISK · NOW' }], // Himawari-9
  36395: [{ kind: 'image', id: 'sdo-hmi', label: 'SUN · VISIBLE' }, { kind: 'image', id: 'sdo-193', label: 'SUN · CORONA 193 Å' }, { kind: 'image', id: 'sdo-304', label: 'SUN · 304 Å' }], // SDO
  25994: [{ kind: 'image', id: 'gibs-terra', label: "YESTERDAY'S EARTH" }], // Terra
  27424: [{ kind: 'image', id: 'gibs-aqua', label: "YESTERDAY'S EARTH" }], // Aqua
  37849: [{ kind: 'image', id: 'gibs-snpp', label: "YESTERDAY'S EARTH" }], // Suomi NPP
  43013: [{ kind: 'image', id: 'gibs-noaa20', label: "YESTERDAY'S EARTH" }], // NOAA-20
  54234: [{ kind: 'image', id: 'gibs-noaa21', label: "YESTERDAY'S EARTH" }], // NOAA-21
};

// Shortcuts in the satellite panel.
export const FEATURED = [[25544, 'ISS'], [48274, 'TIANGONG'], [20580, 'HUBBLE'], [60133, 'GOES-19'], [41836, 'HIMAWARI-9'], [36395, 'SDO'], [25994, 'TERRA'], [43013, 'NOAA-20'], [49260, 'LANDSAT 9']];

// Real sizes (largest dimension, km) where well known; others are drawn at a nominal 5 m.
export const SAT_SIZE_KM = { 25544: 0.109, 48274: 0.055, 20580: 0.0132, 60133: 0.0062, 51850: 0.0062, 36395: 0.0062, 25994: 0.0068, 27424: 0.0068 };

export const CATEGORY_LABEL = { stations: 'SPACE STATIONS', science: 'SCIENCE', weather: 'WEATHER', earth: 'EARTH OBSERVATION', navigation: 'NAVIGATION (GNSS)',
  starlink: 'STARLINK', oneweb: 'ONEWEB', comms: 'COMMUNICATIONS', military: 'MILITARY', other: 'OTHER' };
