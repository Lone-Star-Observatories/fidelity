# USS Fidelity — concept

USS Fidelity is a ship's console for exploring **real** astronomical data, from Earth
orbit out to nearby galaxies. It is part of the Lone Star Observatories *USS* series
(USS Earthprise was the first brainstorm: interfaces over public satellite data).

It runs **locally**: a static web app plus a small Node backend on `127.0.0.1`. Data is
loaded **on demand** from public sources (NASA, JPL, CelesTrak, …) or from catalogs
already on local disk, and **stored locally** so visited regions keep working offline.

## The scale ladder

Each view is one rung; you zoom or warp between them.

```
Universe View        nearby galaxies, with a distance filter              (Mly)
  └ Galaxy View      the Milky Way with Sector 001 marked                 (kly)
     └ Quadrant View star systems in our galactic quadrant                (100s–1000s ly)
        └ Navigation View  look outward from the current system: nearest  (ly)
           │               features within a radius; select → warp there
           └ System View   the star system around the ship                (AU)
              ├ Star View
              ├ Planet View      (Earth's Planet View hosts the Earthprise apps)
              ├ Moon View
              ├ Satellite View   artificial satellites, the ISS
              └ Object View      Oort cloud, asteroid & Kuiper belts, planetary rings,
                                 regions of interest: the geostationary ring, Van Allen
                                 belts, magnetopause, spheres of gravitational influence

Sector 001 beacon: always visible, one press returns home to Sol.
```

## Decisions (2026-10-09)

| # | Question | Decision |
|---|---|---|
| 1 | Quadrants: real (Sun-centred galactic quadrants I–IV) or Star Trek (galactic-centre Alpha/Beta/Gamma/Delta)? | **Honest and fun.** The canonical grid is the real IAU galactic quadrants I–IV. A toggleable "Starfleet overlay" draws the Alpha/Beta/Gamma/Delta division, badged IMAGINED. |
| 2 | Tag everything with what kind of data it is? | **Yes** — four provenance tiers (below), on every value and visual. |
| 3 | Per-level scenes, warp transitions, floating origin, an address for every view? | **Yes.** Hash routes such as `#/system/sol/earth` and `#/navigation`. |
| 4 | Data volume (Gaia, asteroid orbits) | **A small local backend.** It proxies upstreams that lack CORS, caches to disk, and indexes catalogs already downloaded to the RAID (`npm run catalogs`). |
| 5 | Visual language | **LCARS** — a straight homage to the TNG-era console look. |
| — | Delivery | A standalone, locally run web app. Public repo `Lone-Star-Observatories/fidelity`. |

## Honesty: provenance tiers

| Badge | Meaning | Examples |
|---|---|---|
| **MEASURED** | Directly observed or measured | Planet radius and mass, spin-axis direction, solar wind speed |
| **COMPUTED** | Calculated from measurements | Planet positions (Keplerian elements or JPL Horizons), light-time, Hill spheres |
| **MODELLED** | Theory, not directly observed | Oort cloud, Van Allen belt shapes from models, galactic spiral-arm model |
| **IMAGINED** | Artistic licence or exaggeration | Stylised planet colours, ENHANCED sizes, exoplanet surfaces, the decorative star backdrop, the Starfleet quadrant overlay |

The ENHANCED/TRUE scale toggle is part of this: in ENHANCED mode every enlarged body says
by how much (for example "×376 ENLARGED").

## Fun

- LCARS chrome, warp-streak transitions, a ship's clock you can run forwards and backwards
  (1 hour/s up to 1 year/s), and light-time readouts ("Saturn is 70 light-minutes away").
- Planned: ties to the LSO solar weather app. A CME arriving at Earth visibly compresses
  the magnetopause in Object View.
