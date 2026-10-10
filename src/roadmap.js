// What each not-yet-built view will be, shown on its OFFLINE screen.
// Ticket references point at GitHub issues in Lone-Star-Observatories/fidelity.

export const ROADMAP = {
  navigation: {
    status: 'ONLINE · NEEDS THE LOCAL BACKEND',
    blurb: 'Look outward from the current system: real stars within a chosen radius, systems with known planets highlighted. Select one to warp into its System View.',
    data: 'HYG / Gaia DR3 star catalogues (local), NASA Exoplanet Archive.',
  },
  satellite: {
    status: 'SCHEDULED · TICKET #3',
    blurb: 'Live Earth-orbit traffic: the ISS, the geostationary ring and more.',
    data: 'CelesTrak GP elements propagated with SGP4.',
  },
  object: {
    status: 'SCHEDULED · TICKET #3',
    blurb: 'Belts, rings and regions of interest: Van Allen belts, magnetopause, gravity spheres, asteroid and Kuiper belts, the Oort cloud.',
    data: 'JPL SBDB / MPCORB, NOAA SWPC solar wind, physical models.',
  },
  quadrant: {
    status: 'SCHEDULED · TICKET #4',
    blurb: 'Zoom out to our quadrant of the Milky Way: star systems, clusters and nebulae.',
    data: 'Gaia DR3 (tiled, local), cluster and deep-sky catalogues.',
  },
  galaxy: {
    status: 'SCHEDULED · TICKET #4',
    blurb: 'The Milky Way: spiral arms, the bar, Sgr A*, globular clusters and satellite galaxies, with Sector 001 marked.',
    data: 'Galactic structure models, Harris globular cluster catalogue.',
  },
  universe: {
    status: 'SCHEDULED · TICKET #4',
    blurb: 'Look outward at nearby galaxies — the Local Group, Virgo, Laniakea — with a distance filter.',
    data: 'NED, Cosmicflows-4, 2MRS.',
  },
  star: { status: 'NOT YET SCHEDULED', blurb: '', data: 'SDO, SOHO, Gaia DR3 astrophysical parameters.' },
  planet: { status: 'NOT YET SCHEDULED', blurb: '', data: 'NASA/USGS global mosaics; NASA GIBS live imagery for Earth.' },
  moon: { status: 'NOT YET SCHEDULED', blurb: '', data: 'JPL SSD satellite elements, LRO and mission mosaics.' },
};
