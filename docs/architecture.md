# Architecture

```
browser (Vite-built SPA, three.js)                 local backend (Node ≥20, no deps)
┌──────────────────────────────────────┐           ┌───────────────────────────────────┐
│ LCARS shell  src/main.js, styles/    │  /api/*   │ server/index.js   static + API    │
│ router       #/system/sol/earth …    │ ────────▶ │ server/horizons.js  JPL proxy     │
│ clock        src/astro/clock.js      │           │ server/stars.js     HYG + planets │
│                                      │           │ server/binaries.js  ORB6 orbits   │
│                                      │           │ server/textures.js  imagery       │
│                                      │           │ server/tiff.js      USGS mosaics  │
│                                      │           │ server/satellites.js CelesTrak    │
│                                      │           │ server/feeds.js     live feeds    │
│                                      │           │ server/dsn.js       DSN Now       │
│                                      │           │ server/deepsky.js   VizieR        │
│ views        src/views/<level>/      │           │ server/catalogs.js  RAID scanner  │
│ models       src/data/systems.js     │           │ server/cache.js     disk cache    │
│ astro math   src/astro/{kepler,      │           └──────────────┬────────────────────┘
│              frames}.js              │                          │ on demand
└──────────────────────────────────────┘                          │
                                                     data/cache/  ◀─┘  (+ FIDELITY_CATALOG_DIRS)
```

- **Local only.** The backend binds to `127.0.0.1:4011`. `npm start` serves the built app
  and the API. `npm run dev` runs Vite on `:5173`, which proxies `/api` to the backend.
- **On demand, stored locally.** Each upstream request is cached as JSON in `data/cache/<ns>/`.
  If an upstream fails, a stale copy is served. Horizons data is cached per body per
  calendar month.
- **Scale.** Each level is its own scene in its natural unit (km, AU, ly, Mly). The System
  View uses AU with a *floating origin*: the focused body sits at (0,0,0). It also uses a
  logarithmic depth buffer, so true-scale Earth (4×10⁻⁵ AU) and Neptune's orbit (30 AU)
  render together. Camera flights ease distance in log space.
- **Frames.** Catalogue positions are J2000 equatorial parsecs. The System View uses the
  ecliptic frame, so every system's sky and the direction to Sol share one frame. The
  Navigation View uses the IAU galactic frame (the plane is horizontal, l = 0° points at the
  galactic centre) and is centred on the current star. See `src/astro/frames.js`.
- **One system model.** Sol and other stars both become a model (`src/data/systems.js`):
  one or more stars (binary orbits in `model.binary`), planets attached to their host star, orbits, a survey of camera distances, and facts that each carry a provenance tier.
  The System View and the info panel render whatever model they're given.
- **Bodies.** `src/views/system/materials.js` holds the planet shader (lit by the star,
  with an optional night-side emission map), the cloud layer and the limb-darkened
  photosphere. Sol bodies are oriented with the IAU pole and prime meridian
  (`src/astro/rotation.js`), and Earth turns by sidereal time.
- **Star View** (`src/views/star/`) shows a close-up photosphere, the spectrum chart (observed
  template, blackbody, lab line positions, Wien peak, hover readout) and composition bars.
- **Planet View** (`src/views/planet/`) shows a close-up globe, the atmosphere by volume (or
  JWST detections, or "not yet measured"), spectral fingerprints, the interior to scale, and
  the mass–radius diagram against composition curves.
- **Provenance.** Each value shown in the UI carries a tier badge from `src/data/provenance.js`.
- **Routes.** `#/system/<system>[/<body>]` (system: `sol`, `hyg-<n>` or `exo-<host>`), `#/star/<system>/<star>`, `#/planet/<system>/<planet>`, `#/moon/sol/<moon>`, `#/object/sol/<body>`, `#/satellite/sol/<norad>`,
  `#/navigation/<system>`, `#/quadrant`, `#/galaxy`, `#/universe`. The Sector 001 beacon is
  `#/system/sol`.

## Backend API

| Route | Returns |
|---|---|
| `GET /api/health` | Liveness and configured catalog folders |
| `GET /api/horizons/vectors?body=399&month=2026-10` | Daily heliocentric vectors for a calendar month |
| `GET /api/nearby?center=sol&radiusLy=25` | Stars within a radius of a star (Sol always included), with planet counts |
| `GET /api/stars/<id>` | One star, its archive host row and its planets |
| `GET /api/sky?center=<id>&maxMag=6.5` | The naked-eye sky from a star: directions and apparent magnitudes |
| `GET /api/texture/<key>` | A surface image (allowlisted keys only), downloaded once and cached |
| `GET /api/textures` | Credit line for each texture |
| `GET /api/spectrum?type=G8V&feh=-0.5` | Closest Pickles template spectrum (300–2500 nm, peak = 1) |
| `GET /api/smallbodies` | Small-body populations: compact orbit rows `[pop, a, e, i, Ω, ω, M, epochOffset, H]` |
| `GET /api/satellites` | Active satellites: compact OMM rows `[norad, name, category, epoch ms, n, e, i, Ω, ω, M, B*, ṅ, n̈, intl id]` |
| `GET /api/satellites/:norad` | SATCAT record (owner, launch, type, radar size) |
| `GET /api/feed/:id` | A live feed: images as binary with `x-feed-time` / `x-feed-credit`; JSON feeds as `{ time, credit, data }` (`GET /api/feeds` lists them) |
| `GET /api/horizons/local?body=-74&center=499&day=YYYY-MM-DD` | One day of planet-relative states (km, km/s; 10 min) for orbiters |
| `GET /api/horizons/track?body=-31&start=…&stop=…&n=400` | Heliocentric trajectory (AU), clipped to where the ephemeris exists |
| `GET /api/dsn` | DSN Now contacts `{ station, dish, spacecraftId (NAIF), down/up rate & power, rangeKm }` |
| `GET /api/clusters` | Star clusters `[name, l, b, distPc, members, logAge, type]` (Hunt & Reffert 2023) |
| `GET /api/galaxies` | `{ ungc: [name, ra, dec, distMpc, T, M_B, D_kpc, method], groups: [pgc, n, distMpc, SGX, SGY, SGZ] }` |
| `GET /api/galaxy?maxLy=1500&maxAbs=2` | Bright catalogue stars as heliocentric galactic `[gx, gy, gz]` ly, absmag×10, B−V×100 |
| `GET /api/catalogs` | Inventory of local catalog folders |
| `GET /api/cache` | What is stored on disk |

## Standalone preview

`npm run build:standalone` writes `dist-standalone/fidelity.html`. It's one self-contained file
with a bundled snapshot of the stars within 100 ly of Sol, their planets, a few skies,
and preview-sized surface images.
It needs no backend, so it can be shared or published as a Claude artifact. JPL Horizons
mode is disabled there.

## Adding a view

1. Create `src/views/<level>/<Name>View.js` exporting `create…View(container, deps)` with
   `show()` and `hide()`.
2. Mount it in `src/main.js` routing; remove its entry from `src/roadmap.js`.
3. Add any upstream it needs as a backend route with a cache namespace. Don't fetch
   non-CORS upstreams from the browser.
4. Tag every displayed value with a provenance badge, and update `docs/data-sources.md`.

## Moons and small bodies

`src/astro/moons.js` gives parent-relative positions (the Moon from a lunar theory, the rest
from JPL mean elements with a Horizons-fitted phase in `src/data/moon-fit.js`, regenerated by
`node scripts/fit-moons.js`); `src/astro/smallbodies.js` propagates SBDB osculating orbits.
In ENHANCED scale a planet is drawn hundreds of times too big, so distances around it are
compressed (`compressRadii`: linear inside the planet, logarithmic outside) to keep every moon
outside its planet and in order; TRUE scale is exact. Synchronous moons keep the texture's
prime meridian facing the planet.

## Belts and zones

`src/views/system/belts.js` draws every small-body population as points whose positions are
solved from their orbital elements in the vertex shader (Kepler's equation, 10 Newton steps),
so 61k objects move with the clock at no CPU cost. `src/views/system/zones.js` builds shapes in
a planet's radii (GEO ring, dipole-shell Van Allen belts, Hill spheres) that are re-mapped
through the same radial compression as the moons; heliosphere and Oort cloud are heliocentric.
Regions and Lagrange points are `marker` bodies in the Sol model, so they focus, route
(`#/system/sol/se-l2`) and show facts like any body. BELTS and ZONES toggle them.

## Satellites

`src/views/system/satellites.worker.js` (inlined by Vite) runs SGP4 for the whole catalogue a
few times a second and posts positions and velocities; `satellites.js` draws them as points,
extrapolating along each velocity and applying the Earth-radius compression in the shader. The
focused satellite is a real node propagated on the main thread every frame (exact at any clock
rate), with a representative model and its orbit. TEME → J2000 uses IAU 1976 precession
(`src/astro/sgp4.js`). The camera near plane follows its distance so 100 m spacecraft render at
TRUE scale. `src/panels/satellite.js` builds the Satellite View panel and feed viewer.

## Deep-space fleet

`src/data/spacecraft.js` lists the craft by NAIF id; `src/data/spacecraft-ephem.js` loads their
Horizons data lazily (Hermite interpolation for planet-relative states, TDB→UTC applied) and
falls back to the standalone snapshot keyed by the same URLs (`src/data/horizons-urls.js`).
Craft that orbit or hover near a body are positioned relative to it and pass through its radial
compression. Panel distances always use true (uncompressed) positions. The backend queues
Horizons calls three at a time.

## Light-time messages

`NavigationView.sendMessage(from, to, lyPerSec)` animates a pulse out and a reply back;
`src/data/lighttime.js` formats years, spans (lifetimes of 75 years beyond that) and the
human-scale sentence. The navigation panel's TRANSMISSION card reads the pulse state live.

## Live skins

`applyLiveSkin` (`src/views/system/materials.js`) layers a feed image over a body's base map:
Earth's GIBS mosaic in the planet shader (base map shows through swath gaps and polar night;
the separate cloud layer hides), the Sun's SDO disk projected orthographically onto the
Earth-facing hemisphere (solar north up, radius from Helioviewer's metadata) in the star
shader. System, Star and Planet views all use it; it refreshes every 15 minutes.

## Quadrant and Universe views

`src/views/quadrant/QuadrantView.js`: heliocentric galactic frame in light-years, Sol at the
origin, over the calibrated Milky Way plane (`src/views/galaxy/plane.js`, shared with the Galaxy
View); clusters coloured by age, nebulae by kind. `src/views/universe/UniverseView.js`:
supergalactic frame (`galToSupergal` in `src/astro/frames.js`), Mly; Cosmicflows group positions
are their velocity-space direction scaled to the measured distance. Both filter points in the
shader by radius (`uRadius`) and labels by distance. Label `visible` must be a strict boolean
(CSS2DRenderer only hides on `=== false`).
