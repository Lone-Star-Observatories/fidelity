# Backlog

Tracked as GitHub issues in this repo. This file mirrors the plan.

| # | Item | Scope |
|---|---|---|
| 1 | **Sol System View + Sector 001 beacon** | The engine (floating origin, log depth, warp flights), real planet positions (Kepler offline + JPL Horizons), ship's clock, ENHANCED/TRUE scale, provenance badges, LCARS shell, routes, local backend and disk cache, RAID catalog scanner. |
| 2 | **Navigation View** | Stars within N ly of the current system (HYG/Gaia from local catalogs), exoplanet hosts highlighted (NASA Exoplanet Archive), select → warp into a System View built from archive data (planets badged COMPUTED/IMAGINED where parameters are missing). Sector 001 marker visible. |
| 3 | **Earth neighbourhood: Satellite + Object views** | CelesTrak GP + SGP4 (the ISS, the GEO ring), Van Allen belts (MODELLED), magnetopause driven by live solar wind (linked to the solar weather app), Hill spheres and Lagrange points, asteroid/Kuiper belt samples, planetary rings, the Oort cloud shell (MODELLED). |
| 4 | **Quadrant → Galaxy → Universe** | Galactic quadrants I–IV plus the Starfleet overlay (IMAGINED), tiled Gaia density, clusters and nebulae; Milky Way model with Sector 001; nearby galaxies with a distance filter (NED/Cosmicflows-4). |

Candidates not yet scheduled (to be prioritised): Star View, Planet View (NASA mosaics;
Earthprise layers on Earth), Moon View, and a catalog ingestion/tiling pipeline for the
RAID datasets.
