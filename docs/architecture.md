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
- **Routes.** `#/system/<system>[/<body>]` (system: `sol`, `hyg-<n>` or `exo-<host>`), `#/star/<system>/<star>`, `#/planet/<system>/<planet>`, `#/moon/sol/<moon>`, `#/object/sol/<body>`,
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
