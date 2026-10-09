# Data sources by view

✅ = in use · ⏳ = planned. Access: **live** = fetched on demand and cached in
`data/cache/`; **local** = a catalog already on disk (`FIDELITY_CATALOG_DIRS`);
**bundled** = small tables in the source tree.

| View | Source | Provides | Access | Status |
|---|---|---|---|---|
| System | Standish, *Keplerian Elements for Approximate Positions of the Major Planets* (JPL) | Planet positions 1800–2050, ≲0.3° error (checked against Horizons in `tests/`) | bundled | ✅ |
| System | [JPL Horizons API](https://ssd-api.jpl.nasa.gov/doc/horizons.html) | Ephemeris-grade heliocentric vectors (DE441) | live (through the backend; Horizons has no CORS) | ✅ |
| System | [NASA Planetary Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/) | Radius, mass, gravity, day/year lengths, temperature | bundled | ✅ |
| System | IAU WGCCRE 2015 | Spin-axis (pole) directions | bundled | ✅ |
| System | JPL DE kernels (`de440.bsp`) | Offline ephemeris-grade positions | local | ⏳ |
| Star | SDO / SOHO imagery, LSO solar weather app | Live solar imagery and activity | live | ⏳ |
| Planet | NASA/USGS global mosaics; NASA GIBS (Earth, daily) | Real surfaces; Earthprise layers | live / local | ⏳ |
| Moon | JPL SSD satellite elements; LRO | Moon orbits and surfaces | live | ⏳ |
| Satellite | CelesTrak GP (OMM/TLE) + SGP4 | Earth-orbit satellites, the ISS | live | ⏳ #3 |
| Object | JPL SBDB / MPCORB | Asteroid and Kuiper-belt orbits | local / live | ⏳ #3 |
| Object | NOAA SWPC solar wind (DSCOVR/ACE) | Magnetopause stand-off distance | live | ⏳ #3 |
| Object | Physical constants and models | GEO ring, Van Allen belts, Hill spheres, Lagrange points, Oort cloud (MODELLED) | bundled | ⏳ #3 |
| Navigation | HYG / AT-HYG, Gaia DR3 | Nearby stars (position, colour, magnitude) | local | ⏳ #2 |
| Navigation / System | NASA Exoplanet Archive (TAP) | Planets of other systems | live / local | ⏳ #2 |
| Quadrant | Gaia DR3 (tiled level-of-detail), cluster catalogues, OpenNGC | Star density, clusters, nebulae | local | ⏳ #4 |
| Galaxy | Spiral-arm and bar models, Harris globular clusters | Milky Way structure | bundled / local | ⏳ #4 |
| Universe | NED, Cosmicflows-4, 2MRS | Nearby galaxies and distances | local / live | ⏳ #4 |

## Local catalogs (the RAID)

```bash
npm run catalogs -- /Volumes/DATA/catalogs        # one-off inventory
FIDELITY_CATALOG_DIRS=/Volumes/DATA/catalogs npm start   # make them available to the app (/api/catalogs)
```

The scanner recognises the catalogs above by file name and lists which view each one
feeds. Anything it doesn't recognise is listed separately so it can be mapped.
