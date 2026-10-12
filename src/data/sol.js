// Sector 001 — the Sol system. Physical values from the NASA Planetary Fact Sheet
// (https://nssdc.gsfc.nasa.gov/planetary/factsheet/) and the Sun Fact Sheet.
// Pole directions (RA/Dec, J2000 equatorial) and rotation (W = W0 + Ẇ·d, degrees, d = days
// from J2000) from the IAU WGCCRE 2015 report; Earth turns by Greenwich mean sidereal time.
// texLon0 = longitude at the left edge of the texture (default −180°, i.e. centred on 0°).
// Surfaces are global mosaics from spacecraft imagery, fetched on demand (server/textures.js).

export const AU_KM = 149597870.7;
export const LIGHT_SECONDS_PER_AU = 499.004784;

export const SUN = {
  id: 'sun', name: 'Sol', kind: 'star', spectral: 'G2V',
  radiusKm: 695700, massKg: 1.9885e30, massSun: 1, teffK: 5772, rotationHours: 609.12,
  pole: [286.13, 63.87], color: 0xffd27a, skin: { map: 'sun', live: 'sdo-hmi', liveDisk: true }, iau: [84.176, 14.1844],
};

// rotationHours < 0 means retrograde rotation.
export const PLANETS = [
  { id: 'mercury', name: 'Mercury', kind: 'planet', radiusKm: 2439.7, massKg: 3.301e23, gravity: 3.7,
    rotationHours: 1407.6, periodDays: 88.0, meanTempC: 167, pole: [281.0103, 61.4155],
    palette: ['#8c8580', '#a59d95', '#6f6964'], horizons: '199', skin: { map: 'mercury' }, iau: [329.5988, 6.1385108] },
  { id: 'venus', name: 'Venus', kind: 'planet', radiusKm: 6051.8, massKg: 4.867e24, gravity: 8.9,
    rotationHours: -5832.5, periodDays: 224.7, meanTempC: 464, pole: [272.76, 67.16],
    palette: ['#e8d3a2', '#d9bf85', '#f1e2bd'], banded: true, horizons: '299', skin: { map: 'venus', ground: 'venusRadar', groundRadar: true }, iau: [160.2, -1.4813688] },
  { id: 'earth', name: 'Earth', kind: 'planet', radiusKm: 6371.0, massKg: 5.972e24, gravity: 9.8,
    rotationHours: 23.9345, periodDays: 365.256, meanTempC: 15, pole: [0, 90],
    palette: ['#1f4fa0', '#2f7d4a', '#e9eef2'], earthlike: true, horizons: '399', skin: { map: 'earth', night: 'earthNight', clouds: 'earthClouds', live: 'gibs-noaa20' }, iau: 'gmst' },
  { id: 'mars', name: 'Mars', kind: 'planet', radiusKm: 3389.5, massKg: 6.417e23, gravity: 3.7,
    rotationHours: 24.6229, periodDays: 687.0, meanTempC: -65, pole: [317.269, 54.432],
    palette: ['#b5532f', '#8f3d22', '#d27a4f'], horizons: '499', skin: { map: 'mars' }, iau: [176.63, 350.89198226] },
  { id: 'jupiter', name: 'Jupiter', kind: 'planet', radiusKm: 69911, massKg: 1.898e27, gravity: 23.1,
    rotationHours: 9.925, periodDays: 4331, meanTempC: -110, pole: [268.057, 64.495],
    palette: ['#d8c3a5', '#b08a63', '#efe3cf', '#a36b45'], banded: true, horizons: '599', skin: { map: 'jupiter' }, iau: [284.95, 870.536] },
  { id: 'saturn', name: 'Saturn', kind: 'planet', radiusKm: 58232, massKg: 5.683e26, gravity: 9.0,
    rotationHours: 10.656, periodDays: 10747, meanTempC: -140, pole: [40.589, 83.537],
    palette: ['#e3d3a8', '#c9b27f', '#efe6c8'], banded: true, horizons: '699', skin: { map: 'saturn', ring: 'saturnRing' }, iau: [38.9, 810.7939024],
    // Main rings, C ring inner edge to the F ring (km from centre), matching the ring map.
    rings: { innerKm: 74658, outerKm: 140220 } },
  { id: 'uranus', name: 'Uranus', kind: 'planet', radiusKm: 25362, massKg: 8.681e25, gravity: 8.7,
    rotationHours: -17.24, periodDays: 30589, meanTempC: -195, pole: [257.311, -15.175],
    palette: ['#a7dfe6', '#93cfd8', '#bfe9ee'], banded: true, horizons: '799', skin: { map: 'uranus' }, iau: [203.81, -501.1600928] },
  { id: 'neptune', name: 'Neptune', kind: 'planet', radiusKm: 24622, massKg: 1.024e26, gravity: 11.0,
    rotationHours: 16.11, periodDays: 59800, meanTempC: -200, pole: [299.36, 43.46],
    palette: ['#3f63c7', '#2d4fa8', '#6b8be0'], banded: true, horizons: '899', skin: { map: 'neptune' }, iau: [249.978, 541.1397757] },
  { id: 'pluto', name: 'Pluto', kind: 'dwarf planet', radiusKm: 1188.3, massKg: 1.303e22, gravity: 0.62,
    rotationHours: -153.29, periodDays: 90560, meanTempC: -225, pole: [132.993, -6.163],
    palette: ['#c9b59a', '#8e7a66', '#e6d9c5'], horizons: '999', skin: { map: 'pluto' }, iau: [302.695, 56.3625225], texLon0: 0 },
];

export const BODIES = [SUN, ...PLANETS];
export const byId = Object.fromEntries(BODIES.map((b) => [b.id, b]));
