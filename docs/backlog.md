# Backlog

Tracked as GitHub issues in this repo. This file mirrors the plan.

| # | Item | Scope |
|---|---|---|
| 1 | **Sol System View + Sector 001 beacon** | The engine (floating origin, log depth, warp flights), real planet positions (Kepler offline + JPL Horizons), ship's clock, ENHANCED/TRUE scale, provenance badges, LCARS shell, routes, local backend and disk cache, RAID catalog scanner. |
| 2 | ✅ **Navigation View** | Done. Stars within 10–100 ly of any star (HYG v4.4, downloaded on demand), planet hosts ringed (NASA Exoplanet Archive), galactic-plane chart with quadrants I–IV, Sector 001 always marked. Selecting a star warps into a System View built from archive data, with every value badged, a real sky from that star, and an arrow back to Sol. |
| 3 | **Earth neighbourhood: Satellite + Object views** | CelesTrak GP + SGP4 (the ISS, the GEO ring), Van Allen belts (MODELLED), magnetopause driven by live solar wind (linked to the solar weather app), Hill spheres and Lagrange points, asteroid/Kuiper belt samples, planetary rings, the Oort cloud shell (MODELLED). |
| 4 | **Quadrant → Universe** (Galaxy done in #10) | Galactic quadrants I–IV plus the Starfleet overlay (IMAGINED), tiled Gaia density, clusters and nebulae; Milky Way model with Sector 001; nearby galaxies with a distance filter (NED/Cosmicflows-4). |

| 6 | ✅ **Realistic skins** | Spacecraft mosaics for every Sol body, Earth's clouds and city lights, real rotation phase, recoloured photospheres for stars, analog skins for exoplanets. Credits shown. |
| 7 | ✅ **Binary and multiple stars** | ORB6 orbits in true 3D, barycentric motion, measured masses (Sirius B as a white dwarf, α Cen A+B with Proxima around the pair), planets riding with their host star. |
| 8 | ✅ **Star View** | Close-up photosphere, observed template spectrum (Pickles) against the blackbody with line IDs and an infrared range, composition by mass (Asplund 2009 for the Sun, [Fe/H]-scaled otherwise), white dwarfs handled. |
| 9 | ✅ **Planet View** | Globe, atmosphere by volume (Sol) or measured JWST detections (exoplanets), spectral fingerprints, interior to scale, density on the mass–radius diagram with minimum-mass and unmeasured-radius caveats. |
| 10 | ✅ **Galaxy View** | NASA/JPL-Caltech face-on Milky Way (IMAGINED artwork), calibrated so Sol lands at R₀ = 26.7 kly and the 46k brightest catalogue stars within 1.5 kly sit at their true galactic positions; arms, Sgr A*, satellite galaxies, IAU quadrants and the optional Starfleet overlay. |

Candidates not yet scheduled (to be prioritised): Earthprise layers on Earth (GIBS), Moon View, and a catalog ingestion/tiling pipeline for the
RAID datasets. Gaia DR3 neighbours (the faint red and brown dwarfs HYG misses) would complete the Navigation View; the two nearest brown-dwarf systems (Luhman 16, WISE 0855) are already bundled.
