// Surface sites of note (#37): where spacecraft landed, crashed or drove, where they are planned to
// go, and (on Earth) launch sites and observatories with live feeds. Coordinates are planetocentric
// latitude and east-positive longitude in degrees, in the same convention as the body textures;
// each site cites its source. Proposed places carry tier 'planned' and are never mixed with places
// where something actually landed.

export const SITE_KINDS = {
  crewed: { label: 'CREWED LANDING', color: 0xffcc66, hint: 'People walked here.' },
  lander: { label: 'LANDER', color: 0x99ccff, hint: 'A robotic lander touched down here.' },
  rover: { label: 'ROVER', color: 0x66ff99, hint: 'A rover landed here; its traverse is drawn where published.' },
  impact: { label: 'IMPACT / CRASH', color: 0xff6655, hint: 'A spacecraft or stage hit the surface here, by design or by accident.' },
  planned: { label: 'PLANNED / CANDIDATE', color: 0xcceeff, hint: 'Proposed: nothing has landed here yet.' },
  observatory: { label: 'OBSERVATORY', color: 0xcc99ff, hint: 'A telescope site, with live views where the operator publishes them.' },
  launch: { label: 'LAUNCH SITE', color: 0xff9966, hint: 'Where rockets leave Earth.' },
};

const site = (body, id, name, lat, lon, kind, extra = {}) => ({ id, body, name, lat, lon, kind, tier: kind === 'planned' ? 'planned' : 'measured', ...extra });

// Earth: launch sites (coordinates of the main pads/centres, WGS84 ≈ planetocentric to 0.2°).
const EARTH = [
  site('earth', 'ksc', 'Kennedy Space Center & Cape Canaveral', 28.5729, -80.649, 'launch', { short: 'CAPE CANAVERAL', major: true, agency: 'NASA / US Space Force', source: 'NASA KSC (LC-39A)', note: 'Apollo, the Shuttle, Falcon 9 and Falcon Heavy, SLS and Artemis.' }),
  site('earth', 'starbase', 'Starbase, Boca Chica', 25.997, -97.157, 'launch', { short: 'STARBASE', agency: 'SpaceX', source: 'SpaceX Starbase (orbital launch mount)', note: 'Home of Starship.' }),
  site('earth', 'baikonur', 'Baikonur Cosmodrome', 45.920, 63.342, 'launch', { short: 'BAIKONUR', major: true, agency: 'Roscosmos', source: 'Gagarin\'s Start (Site 1)', note: 'Sputnik, Gagarin, and Soyuz crews to the ISS.' }),
  site('earth', 'vandenberg', 'Vandenberg Space Force Base', 34.632, -120.611, 'launch', { short: 'VANDENBERG', agency: 'US Space Force', source: 'SLC-4E', note: 'Polar and Sun-synchronous orbits.' }),
  site('earth', 'jiuquan', 'Jiuquan Satellite Launch Center', 40.958, 100.291, 'launch', { short: 'JIUQUAN', agency: 'CNSA / CMSA', source: 'Launch Area 4', note: 'Shenzhou crews to Tiangong.' }),
  site('earth', 'wenchang', 'Wenchang Space Launch Site', 19.614, 110.951, 'launch', { short: 'WENCHANG', agency: 'CNSA', source: 'LC-101', note: 'Long March 5: Chang\'e 5 and 6, Tianwen-1, Tiangong modules.' }),
  site('earth', 'kourou', 'Guiana Space Centre, Kourou', 5.239, -52.768, 'launch', { short: 'KOUROU', major: true, agency: 'ESA / CNES / Arianespace', source: 'ELA-3', note: 'Ariane: JWST launched from here on 25 Dec 2021.' }),
  site('earth', 'tanegashima', 'Tanegashima Space Center', 30.401, 130.975, 'launch', { short: 'TANEGASHIMA', agency: 'JAXA', source: 'Yoshinobu LC', note: 'H-IIA/H3: Hayabusa2, SLIM.' }),
  site('earth', 'sriharikota', 'Satish Dhawan Space Centre, Sriharikota', 13.720, 80.230, 'launch', { short: 'SRIHARIKOTA', agency: 'ISRO', source: 'Second Launch Pad', note: 'Chandrayaan-3, Mangalyaan, Aditya-L1.' }),
];

export const SITES = [...EARTH];

const byBody = new Map();
for (const s of SITES) (byBody.get(s.body) ?? byBody.set(s.body, []).get(s.body)).push(s);
/** Sites on one body (empty array if none). */
export const sitesFor = (bodyId) => byBody.get(bodyId) ?? [];
