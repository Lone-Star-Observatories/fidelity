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
| System | IAU WGCCRE 2015 rotation models; GMST for Earth | Real rotation phase: Earth's day/night falls where it really is | bundled | ✅ |
| System | Surface imagery (below) | Realistic skins for every body | live, cached in `data/textures/` | ✅ #6 |
| System | JPL DE kernels (`de440.bsp`) | Offline ephemeris-grade positions | local | ⏳ |
| Star | [Pickles 1998](https://ui.adsabs.harvard.edu/abs/1998PASP..110..863P) UVKLIB, via the STScI CDBS reference atlas | 131 observed, flux-calibrated spectra (O5–M10, classes I–V). Each star gets the closest type, labelled as a template and not its own spectrum. | downloaded once (131 FITS), cached as JSON | ✅ #8 |
| Star | Asplund, Grevesse, Sauval & Scott 2009 | Solar photospheric abundances (X, Y, Z and elements by mass) | bundled | ✅ #8 |
| Star | NASA Exoplanet Archive `st_met` | Measured metallicity [Fe/H]; the element mix is the Sun's scaled to it (MODELLED) | live | ✅ #8 |
| Star | SDO / SOHO imagery, LSO solar weather app | Live solar imagery and activity | live | ⏳ |
| Planet | NASA/USGS global mosaics; NASA GIBS (Earth, daily) | Real surfaces; Earthprise layers | live / local | ⏳ |
| Moon | JPL SSD satellite elements; LRO | Moon orbits and surfaces | live | ⏳ |
| Satellite | CelesTrak GP (OMM/TLE) + SGP4 | Earth-orbit satellites, the ISS | live | ⏳ #3 |
| Object | JPL SBDB / MPCORB | Asteroid and Kuiper-belt orbits | local / live | ⏳ #3 |
| Object | NOAA SWPC solar wind (DSCOVR/ACE) | Magnetopause stand-off distance | live | ⏳ #3 |
| Object | Physical constants and models | GEO ring, Van Allen belts, Hill spheres, Lagrange points, Oort cloud (MODELLED) | bundled | ⏳ #3 |
| Navigation / System | [HYG v4.4](https://codeberg.org/astronexus/hyg) (Hipparcos + Yale + Gliese, 119,614 stars) | Star positions (parallax), magnitudes, B−V colour, spectral type, names; the real night sky from any star | local, else downloaded once (13.6 MB) to `data/catalogs/` | ✅ |
| Navigation / System | [NASA Exoplanet Archive](https://exoplanetarchive.ipac.caltech.edu/) `pscomppars` (TAP) | Planets within 212 ly of Sol: orbits, sizes, masses (and whether they are true or minimum masses), transit flags and times, host-star parameters | live, cached 7 days | ✅ |
| System | [ORB6](https://www.astro.gsu.edu/wds/orb6.html), the Sixth Catalog of Orbits of Visual Binary Stars (USNO/GSU) | 4,007 visual-binary orbits (P, a, i, Ω, T, e, ω) used for true-3D binary and multiple systems | downloaded once, refreshed monthly | ✅ #7 |
| System | Literature masses (Bond et al. 2015/2017; Akeson et al. 2021; Kervella et al. 2008/2017; Eggenberger et al. 2008) | Measured component masses and white-dwarf properties for Sirius, Procyon, α Cen (with Proxima), 70 Oph and 61 Cyg | bundled | ✅ #7 |
| Navigation | Gaia DR3 | Fainter neighbours HYG misses (red and brown dwarfs) | local | ⏳ |
| Quadrant | Gaia DR3 (tiled level-of-detail), cluster catalogues, OpenNGC | Star density, clusters, nebulae | local | ⏳ #4 |
| Galaxy | Spiral-arm and bar models, Harris globular clusters | Milky Way structure | bundled / local | ⏳ #4 |
| Universe | NED, Cosmicflows-4, 2MRS | Nearby galaxies and distances | local / live | ⏳ #4 |

## Multiple stars

`server/stars.js` joins three things:
- **Membership:** HYG's component grouping (e.g. Sirius B is HYG "Gl 244B" under Sirius).
- **Orbits:** ORB6, matched by Hipparcos number.
- **Wide pairs:** position matching, which links Proxima to α Cen AB through ORB6's "AC" orbit.

`src/astro/binary.js` then places each orbit in 3D:
1. Thiele–Innes on the sky, then parallax to turn arcseconds into AU, then the sky's north/east/line-of-sight axes into the scene frame.
2. Builds the hierarchy inner pair first, so every star moves about the shared centre of mass.

Provenance:

| Value | Tier |
|---|---|
| Orbital elements | MEASURED |
| Total mass from a³/P² | COMPUTED |
| Component masses | MEASURED where published, otherwise estimated |
| Which side of an orbit is nearer to us | Ambiguous without radial velocities, and the panel says so |

## Surface imagery

`server/textures.js` lists each body's sources in order of preference. A download is
kept only if it really is a JPEG or PNG. Node's `fetch` is tried first, then the system
`curl` for hosts that challenge Node's HTTP client.

| Body | Image | Tier |
|---|---|---|
| Earth | NASA Blue Marble Next Generation (Dec 2004), MODIS cloud layer, Black Marble 2016 city lights on the night side | MEASURED |
| Jupiter | NASA/JPL/SSI Cassini cylindrical map, Dec 2000 (PIA07782) | MEASURED |
| Pluto | NASA/JHUAPL/SwRI New Horizons global colour mosaic (PIA11707). The southern band was in polar night and is shown black. | MEASURED |
| Sun, Mercury, Venus (cloud tops), Mars, Saturn with rings, Uranus, Neptune | [Solar System Scope](https://www.solarsystemscope.com/textures/) (CC BY 4.0), built from NASA mission imagery | MEASURED |
| Other stars | The Sun's granulation recoloured to the star's blackbody colour, with limb darkening | IMAGINED surface, COMPUTED colour |
| Exoplanets | *Analog skins*: a real Solar System surface recoloured for the planet's class (e.g. hot Jupiter → darkened Jupiter). The panel names the analog. | IMAGINED |

## How other systems are built

`src/data/systems.js` turns a star and its archive rows into a System View model, tagging each value:

| Value | Tier | Rule |
|---|---|---|
| Orbital period | MEASURED | Archive value. Kepler's third law fills a missing period or orbit size (COMPUTED). |
| Eccentricity | MEASURED / IMAGINED | Unknown values are assumed circular. |
| Position along the orbit | COMPUTED / IMAGINED | From the measured transit time for transiting planets, otherwise illustrative. |
| Orbit plane | COMPUTED / IMAGINED | Transiting systems are edge-on to Sol, so the plane contains our line of sight. Otherwise the plane is unknown. |
| Radius | MEASURED / MODELLED | Measured only for transiting planets. Otherwise it comes from a mass–radius relation. |
| Mass | MEASURED / MODELLED | `pl_bmassprov` says whether it is a true mass, a minimum mass (M·sin i) or derived from the radius. |
| Appearance | IMAGINED | No exoplanet surface has been imaged, so the look is inferred from size and temperature. |

## Local catalogs (the RAID)

```bash
npm run catalogs -- /Volumes/DATA/catalogs        # one-off inventory
FIDELITY_CATALOG_DIRS=/Volumes/DATA/catalogs npm start   # make them available to the app (/api/catalogs)
```

The scanner recognises the catalogs above by file name and lists which view each one
feeds. Anything it doesn't recognise is listed separately so it can be mapped.
