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
| Planet | NASA planetary fact sheets; Curiosity SAM (Franz et al. 2017); New Horizons (Gladstone et al. 2016) | Sol atmospheres by volume and surface pressures | bundled | ✅ #9 |
| Planet | PREM (Earth), InSight (Mars), Juno (Jupiter), ring seismology (Saturn), published models (others) | Interior layers, drawn to scale (MODELLED) | bundled | ✅ #9 |
| Planet | Laboratory molecular band positions (HITRAN-era values) | Spectral fingerprints of O₂, O₃, H₂O, CO₂, CH₄, NH₃, CO… (depths illustrative, MODELLED) | bundled | ✅ #9 |
| Planet | Zeng, Sasselov & Jacobsen 2016/2019 | Mass–radius composition curves (iron, Earth-like, 50% water, H/He) | bundled | ✅ #9 |
| Planet | JWST/Spitzer papers (Fu 2024, Madhusudhan 2023, Hu 2024, Greene 2023, Zieba 2023, Kreidberg 2019, Moran 2023, Kempton 2023) | Measured exoplanet atmospheres where they exist | bundled | ✅ #9 |
| Planet | NASA GIBS (Earth, daily) | Live Earth imagery; Earthprise layers | live | ⏳ |
| Moon | [JPL SSD mean satellite elements](https://ssd.jpl.nasa.gov/sats/elem/) (Laplace-plane geometry, precession), phase fitted to JPL Horizons 2016–2036 by `scripts/fit-moons.js`; the Moon by a truncated ELP-2000/82 series (Meeus ch. 47) | 26 moons, parent-relative, tested against Horizons | bundled | ✅ #11 |
| Moon | [NASA 3D Resources](https://github.com/nasa/NASA-3D-Resources) global maps (Voyager, Galileo, Cassini, New Horizons); USGS Astrogeology Dawn mosaics for Ceres and Vesta, range-sampled from the GeoTIFFs by `server/tiff.js` | Moon and asteroid surfaces | downloaded once to `data/textures/` | ✅ #11 |
| Satellite | [CelesTrak GP](https://celestrak.org/NORAD/documentation/gp-data-formats.php) (OMM) + groups, SATCAT; SGP4 via [satellite.js](https://github.com/shashwatak/satellite-js) | All ~16,700 active satellites, categories, owner/launch/size; tested against JPL Horizons' ISS | live, cached 12 h (CelesTrak asks ≥ 2 h) | ✅ #13 |
| Satellite | NOAA/NESDIS STAR (GOES-19, GOES-18), NICT (Himawari-9), Helioviewer (SDO AIA/HMI), NASA GIBS (Terra, Aqua, Suomi NPP, NOAA-20/21), NASA EPIC (DSCOVR), NOAA SWPC (solar wind, GOES X-rays), NASA live video, corquaid people-in-space | Live views and telemetry from spacecraft, each stamped with its observation time | live, cached minutes–hours (`/api/feed/:id`) | ✅ #13 |
| Object | [JPL SBDB](https://ssd-api.jpl.nasa.gov/doc/sbdb.html) osculating elements + physical parameters | Ceres, Vesta, Pallas, Hygiea, the dwarf planets, Sedna, Arrokoth, Halley | bundled (`src/data/moons.js`) | ✅ #11 |
| Object | [JPL SBDB query API](https://ssd-api.jpl.nasa.gov/doc/sbdb_query.html) | 61k real orbits: NEOs (H<20), main belt (H<14.5), Jupiter Trojans (H<15), all Centaurs and TNOs; positions solved on the GPU | live, cached 30 days (`/api/smallbodies`) | ✅ #12 |
| Spacecraft | [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/) spacecraft ephemerides (NAIF ids) | 31 deep-space craft: daily heliocentric vectors, 10-minute planet-relative states (Mars, Moon, Jupiter orbiters; L1/L2 craft relative to Earth), and trajectories since launch | live, cached (`/api/horizons/*`) | ✅ #14 |
| Spacecraft | [NASA DSN Now](https://eyes.nasa.gov/dsn/dsn.html) | Which spacecraft the Deep Space Network is talking to: dish, data rate, received power, range | live, 20 s (`/api/dsn`) | ✅ #14 |
| Object | IGRF-14 dipole (2025); Van Allen Probes climatology; Voyager 1/2 shock and heliopause crossings; IBEX inflow direction; Hill-sphere and Lagrange-point formulas | GEO ring, Van Allen belts, heliosphere, Oort cloud (MODELLED/IMAGINED where shapes are unmeasured), Lagrange points, Hill spheres | bundled (`src/data/poi.js`, `src/views/system/zones.js`) | ✅ #12 |
| Object | NOAA SWPC solar wind (DSCOVR/ACE) | Magnetopause stand-off distance | live | ⏳ #3 |
| Navigation / System | [HYG v4.4](https://codeberg.org/astronexus/hyg) (Hipparcos + Yale + Gliese, 119,614 stars) | Star positions (parallax), magnitudes, B−V colour, spectral type, names; the real night sky from any star | local, else downloaded once (13.6 MB) to `data/catalogs/` | ✅ |
| Navigation / System | [NASA Exoplanet Archive](https://exoplanetarchive.ipac.caltech.edu/) `pscomppars` (TAP) | Planets within 212 ly of Sol: orbits, sizes, masses (and whether they are true or minimum masses), transit flags and times, host-star parameters | live, cached 7 days | ✅ |
| System | [ORB6](https://www.astro.gsu.edu/wds/orb6.html), the Sixth Catalog of Orbits of Visual Binary Stars (USNO/GSU) | 4,007 visual-binary orbits (P, a, i, Ω, T, e, ω) used for true-3D binary and multiple systems | downloaded once, refreshed monthly | ✅ #7 |
| System | Literature masses (Bond et al. 2015/2017; Akeson et al. 2021; Kervella et al. 2008/2017; Eggenberger et al. 2008) | Measured component masses and white-dwarf properties for Sirius, Procyon, α Cen (with Proxima), 70 Oph and 61 Cyg | bundled | ✅ #7 |
| Navigation / System | Literature astrometry: Luhman 2013/2014; Bedin et al. 2024; Luhman & Esplin 2016; masses Lazorenko & Sahlmann 2018; WISE 0855 temperature Luhman et al. 2024 (JWST) | The nearest brown dwarfs HYG misses: Luhman 16 AB (6.5 ly, on its ORB6 orbit) and WISE 0855−0714 (7.4 ly), in `server/neighbours.js` | bundled | ✅ |
| Navigation | Gaia DR3 | The other faint neighbours HYG misses (red and brown dwarfs) | local | ⏳ |
| Quadrant | Gaia DR3 (tiled level-of-detail), cluster catalogues, OpenNGC | Star density, clusters, nebulae | local | ⏳ #4 |
| Galaxy | [PIA10748](https://photojournal.jpl.nasa.gov/catalog/PIA10748) face-on Milky Way (NASA/JPL-Caltech/R. Hurt, from Spitzer), calibrated against the annotated [PIA19341](https://photojournal.jpl.nasa.gov/catalog/PIA19341) | The galaxy image under the stars (IMAGINED: an artist's concept) | downloaded once to `data/` | ✅ #10 |
| Galaxy | GRAVITY Collaboration 2019 (R₀ = 8.178 kpc); Bennett & Bovy 2019 (z₀ = 20.8 pc); LMC/SMC/Sgr dSph distances (Pietrzyński 2019, Graczyk 2020, Vasiliev & Belokurov 2020) | Sol's place in the galaxy, satellite galaxies | bundled | ✅ #10 |
| Galaxy | Harris globular clusters | Globular cluster halo | local | ⏳ #4 |
| Universe | NED, Cosmicflows-4, 2MRS | Nearby galaxies and distances | local / live | ⏳ #4 |

## Multiple stars

`server/stars.js` joins three things:
- **Membership:** HYG's component grouping (e.g. Sirius B is HYG "Gl 244B" under Sirius).
- **Orbits:** ORB6, matched by Hipparcos number.
- **Wide pairs:** position matching, which links Proxima to α Cen AB through ORB6's "AC" orbit.
- **No Hipparcos number:** orbits of the bundled brown dwarfs (Luhman 16) are matched by position.

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

## Galaxy calibration

PIA19341 is PIA10748 rotated 90° clockwise with the Sun marked (pixel 416.0, 668.8 of 1308).
Mapped back, the Sun sits (0.0117, 0.1816) image-widths from the centre of PIA10748; with
R₀ = 26.67 kly the image is ≈147 kly across. `src/astro/galaxy.js` holds the numbers and
`tests/galaxy.test.js` checks that the marked Sun lands at R₀. Catalogue stars are HYG rows
rotated into galactic coordinates (`/api/galaxy`), so they sit at their true positions on the art.
