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
  logarithmic depth buffer (orbit lines are drawn as screen-space Line2 twins of their thin lines, `fatlines.js`), so true-scale Earth (4×10⁻⁵ AU) and Neptune's orbit (30 AU)
  render together. Camera flights ease distance in log space.
- **Frames.** Catalogue positions are J2000 equatorial parsecs. The System View uses the
  ecliptic frame, so every system's sky and the direction to Sol share one frame. The
  Navigation View uses the IAU galactic frame (the plane is horizontal, l = 0° points at the
  galactic centre) and is centred on the current star. See `src/astro/frames.js`.
- **One system model.** Sol and other stars both become a model (`src/data/systems.js`):
  one or more stars (binary orbits in `model.binary`; in ENHANCED mode each star's `sizeBoost` draws the biggest at ~4% of the tightest stellar orbit, companions at least half that, capped by their own planets), planets attached to their host star, orbits, a survey of camera distances, and facts that each carry a provenance tier.
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
| `GET /api/planets?center=sol&radiusLy=50` | Known planets around stars in range, nearest first (radius, mass, period, temperature, insolation, discovery) |
| `GET /api/sky?center=<id>&maxMag=6.5` | The naked-eye sky from a star: directions and apparent magnitudes |
| `GET /api/texture/<key>` | A surface image (allowlisted keys only), downloaded once and cached |
| `GET /api/textures` | Credit line for each texture |
| `GET /api/spectrum?type=G8V&feh=-0.5` | Closest Pickles template spectrum (300–2500 nm, peak = 1) |
| `GET /api/smallbodies` | Small-body populations: compact orbit rows `[pop, a, e, i, Ω, ω, M, epochOffset, H]` |
| `GET /api/voice/status` · `WS /api/voice` | "Computer" voice (#21): whether a key is configured; a same-origin WebSocket relay to the OpenAI Realtime API that adds the key (`server/voice.js`, hand-written RFC 6455) |
| `GET /api/hips?id=…` · `GET /api/gibs-band?layers=…` | Spectrum filter (#28): a whitelisted all-sky or planetary HiPS survey as a 2048×1024 equirectangular PNG (hips2fits; transparent where there is no data), and yesterday's GIBS mosaic of a whitelisted layer set (`server/bandimages.js`) |
| `GET /api/satellites` | Active satellites: compact OMM rows `[norad, name, category, epoch ms, n, e, i, Ω, ω, M, B*, ṅ, n̈, intl id]` |
| `GET /api/satellites/:norad` | SATCAT record (owner, launch, type, radar size) with its UCS record as `UCS` (purpose, operator, mass, lifetime, links; `server/ucs.js`) |
| `GET /api/feed/:id` | A live feed: images as binary with `x-feed-time` / `x-feed-credit`; JSON feeds as `{ time, credit, data }` (`GET /api/feeds` lists them) |
| `GET /api/horizons/local?body=-74&center=499&day=YYYY-MM-DD` | One day of planet-relative states (km, km/s; 10 min) for orbiters |
| `GET /api/horizons/local-month?body=-74&center=499&month=YYYY-MM` | A month of planet-relative states (20 min): stand-in while a day loads, and what fast time-play runs on. Month and track responses clipped by a predicted ephemeris's end carry `ephemerisEnd` (drawn as an end marker) |
| `GET /api/horizons/track?body=-31&start=…&stop=…&n=400` | Heliocentric trajectory (AU), clipped to where the ephemeris exists |
| `GET /api/dsn` | DSN Now contacts `{ station, dish, spacecraftId (NAIF), down/up rate & power, rangeKm }` |
| `GET /api/clusters` | Star clusters `[name, l, b, distPc, members, logAge, type]` (Hunt & Reffert 2023) |
| `GET /api/star-lookup?ra=&dec=[&distLy=][&gaia=1]` | Identify a star by position: SIMBAD (brightest stellar object in the cone) and optionally Gaia DR3 (best parallax match), cached |
| `GET /api/gaia-bright` | Gaia DR3 stars G < 9, parallax/error > 10, beyond ~1.6 kly: `[gx, gy, gz]` ly, M_G×10, BP−RP×100 (ESA TAP, cached 90 days) |
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
TRUE scale. `src/panels/satellite.js` builds the Satellite View panel and feed viewer (ISS video embeds the YouTube streams in `ISS_STREAMS`, switchable in the viewer).

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
(CSS2DRenderer only hides on `=== false`). The Universe View also draws the Local Group's
CMB motion and Andromeda's approach (`MOTION`).

## Surface view

Double-click a body in the System View (or its globe in the Planet View) to stand there
2 m up and look straight up (`src/views/system/surface.js`: texture lat/lon ⇄ mesh
direction, local horizon frame, alt/az). The camera turns with the body each frame, the
scale switches to TRUE while standing, drag looks around (sky follows the cursor) and the
wheel zooms; Esc or BACK TO ORBIT restores the previous scale. Chart overlays (belts,
satellites, spacecraft, orbits, zones, markers) are hidden; daylight (Sun altitude, civil
twilight) tints the background for Earth, Mars, Venus and Titan and fades the stars.

## Click anything (#23)

`src/views/pick.js` does screen-space point picking (`pickPoint`) and click/double-click
wiring (`onClicks`). The Galaxy View picks HYG and Gaia points (re-applying the shader's
differential rotation on the CPU), the Quadrant View its catalogue stars, the System View its
bodies, then orbit lines, then the background sky. `/api/galaxy` and `/api/sky` rows carry the
HYG id. `src/panels/starcard.js` renders the SELECTED STAR card from the HYG detail and
`/api/star-lookup`. Double-click drills down one level: Universe → Galaxy → Quadrant →
Navigation → System → Star View, and bodies → the surface view.

## Realism layers (#19)

`src/astro/orientation.js` turns Earth (precessing, nutating pole; GMST from the equinox of
date) and the Moon (IAU 2009, so it librates) in the System View. The AXES toggle draws spin
axes in each body's `tilt` group and Earth's precession circle on the sky sphere. Comets
(`comet.js`) carry a coma, ion and dust tail oriented each frame from the Sun line and the
trailing velocity; bodies can carry `altElements` per apparition and the nearest epoch is used.
FIELDS draws `solarfield.js` (Parker spiral, current sheet) in the Sun's equatorial frame,
turning at the Carrington rate. Points of interest carry `explain` text; Lagrange points get
the `lagrangeDiagram` SVG (`src/panels/explainers.js`).

## Eclipses and sky events (#30)

`src/astro/eclipses.js` computes solar and lunar eclipses, Mercury/Venus transits, lunar
occultations, Galilean-moon transits/shadows/eclipses (plus Jupiter's mutual-event season) and
alignments (oppositions, greatest elongations, conjunctions, parades) from the app's own
ephemeris: the Moon (Meeus ch. 47, all 60+60 terms, rigorous precession to J2000), the Sun
from Earth's heliocentric position (JPL Horizons daily vectors, cubic-interpolated, when
loaded via `useEarthEphemeris`; Standish elements otherwise), TT = UT + ΔT. Solar shadows are
limb-tangent cones on the WGS-84 ellipsoid; lunar ones use Danjon's enlargement. The event list
runs in a worker (`src/data/skyevents.*`) for −45 d…+2 yr around the clock. In the System View
each planet material darkens per fragment by the fraction of the Sun its nearest occluder
hides (true geometry, so ENHANCED scale is fine; Earth's umbra tints the Moon red), Earth
shows the live umbra/penumbra outlines and the path of totality, the surface view dims the
sky by the local obscuration, and body panels list the events (`src/panels/skyevents.js`).
`?t=<ISO time>[&hold]` sets the ship's clock from the URL; `?surface=lat,lon[&look=sun]` stands on the routed body. In totality the surface view fades in a real corona photograph (#31; docs/assets.md) with the diamond ring and Baily's beads at the contacts.

## Voice: "Computer" (#21)

`src/voice/wake.js` spots the wake word on the machine: an energy endpointer cuts utterances
from the microphone (AudioWorklet, resampled to 16 kHz) and DTW over MFCCs compares them with the
viewer's three recordings (localStorage). Only after it fires does `src/voice/computer.js` stream
24 kHz PCM16 through `ws://…/api/voice` to the Realtime API, with the view title, clock and the
panel's text as instructions and three tools (`go_to`, `set_layer`, `set_time`). Replies play
and are transcribed in the COMPUTER panel; the wake word or "stop" interrupts. Without a key
(or the backend), the browser's on-device recogniser, where available, handles "go to …" and
"show/hide …" locally. Tests: frame codec and relay against a mock upstream, DTW, endpointer,
resampler, command parsing.

## Text size

Every `font-size` in `lcars.css` is `calc(Npx * var(--text-scale, 1))`; the A− / A+ control in the top
bar sets `--text-scale` (80–160%, remembered as `textScale`), so text grows without changing the layout.
The bottom bar scrolls sideways with the mouse wheel when its controls overflow.

## Spectrum filter (#28)

`src/data/bands.js` lists the bands (FULL, RADIO … GAMMA), their bandpasses with filter curves
(`src/astro/bands.js`: SVO curves bundled by `scripts/filters.js`, top-hats in frequency/energy
elsewhere; `bandResponse` is the photon-weighted convolution, tested against band-averaged
Planck, Vega's zero point and the Rayleigh–Jeans limit), the all-sky survey for each, and real
body maps (`BODY_BAND`). `bandskin.js` decides each body's look in a band: real map, predicted
reflected skin (the visible image × the body's reflectance through the filter), predicted thermal
emission (Planck from a day/night or cloud-top temperature model), an observed high-energy
signature, or NOT OBSERVED. The planet shader draws all of these in per-band false colour
(`materials.js`, uniforms set by `bandtextures.js`); stars are tinted by their blackbody in the
band (Vega system); the System View sky becomes the band's survey (a shader maps RA/Dec onto the
sphere) or re-weighted catalogue stars. `src/data/bandstate.js` shares the band with the
Navigation, Galaxy, Quadrant and Planet views. Panels show a SPECTRUM section with the source,
its badge and a false-colour key.

## Milky Way model

`src/views/galaxy/model.js` builds the galaxy as seeded particle layers (thin and thick disc,
bar/bulge, nuclear cluster, Reid 2019 arms, HII regions, dust drawn with normal blending under
the additive starlight, halo) in galactocentric kly. The Galaxy View puts it in `patternGroup`
(turns at the pattern speed); the Quadrant View scales it ×1000 and tunes it faint and small
(`model.tune`) so real stars read first. `galaxyBright` and `galaxyArt` settings control it.

## Galactic deep time

`src/astro/galaxy.js` holds the dynamics: a flat rotation curve with a soft core (`omega(R)`),
the arm pattern speed and integrated satellite orbits (`integrateOrbit`, leapfrog in a log
halo, ±2 Gyr). The Galaxy View turns stars in the vertex shader by −Ω(R)·t about +y (the disc
turns towards scene −z at the Sun), the image and arm labels in `patternGroup` at Ωp, and Sol,
spokes, reach ring and Starfleet overlay in `sunGroup` at Ω☉. Satellite images are additive,
camera-facing quads. The time loop lives in `main.js` (`galLoop`).

## Navigation lists and star motion

`src/panels/navlist.js` builds the SYSTEMS / STARS / PLANETS / DEEP SKY lists with filters;
systems are stars sharing a `system` id (from the backend's component grouping), and open to
show their stars and planets. `/api/nearby` rows carry each star's space velocity (`vKms`,
HYG's pc/yr converted to km/s; `rvKnown` = 0 means sideways motion only). The Navigation View
draws motion arrows relative to the current star or around the galaxy (adding the Sun's
Schönrich 2010 motion and a 233 km/s circular speed). Deep time integrates every star's orbit
in a Milky Way mass model (`src/astro/galpot.js`: gala's MilkyWayPotential, leapfrog at
0.1 Myr, sampled every Myr, cubic Hermite in between; ±5 Myr up front, extended to ±50 Myr on
demand), so positions and arrows follow curved orbits. A system's stars share its best-measured
motion; stars with no measured motion are hidden away from the present. Closest approaches are
found along the same orbits (20 kyr scan + golden-section refinement). Arrows have four-barbed heads; Sol's galactic
motion is a separate gold arrow (capped at 0.6 × the radius). Systems within 8 ly of Sol get a
line and distance label, refreshed with the epoch (`updateProximity`). An SVG orientation gauge
(`.orient-gauge`) shows where the galactic centre, rotation and north point on screen.
## Spacecraft visualization assets

`src/data/models.js` maps craft IDs and satellite NORAD IDs to credited local GLBs in
`public/models/`. `src/views/system/models.js` uses GLTFLoader with local Draco and
bundled Meshopt decoders. SystemView loads a mission model on focus, replaces its
pickable meshes, and discards pending results after a system switch. The single-file
preview embeds compact mission models. See `docs/assets.md` for registration limits.

## Reconstructed shapes and class skins

`src/data/shapes.js` supplies native-kilometre PDS GLBs. Focus loads replace the sphere while preserving the planet shader, picking and source origin; camera framing uses the model envelope. Meshopt is bundled, including standalone data-URI previews. `src/data/skins.js` supplies local IMAGINED exoplanet maps and credits through the catalogue texture interface. Build-time import tooling is under `scripts/assets/`; it does not add backend dependencies.

## Individual body hypotheses

`src/data/bespoke.js` matches full body names to research dossiers and companion imagery, avoiding ambiguous planet-letter IDs. System construction selects bespoke maps before generic exoplanet skins, and before independent generic lunar/small-body placeholders; native scientific maps stay preferred. Planet/Object View shows surface, observer/sky and source-context cards with provenance badges. The catalogue interface resolves local textures and standalone embedded images. `src/astro/appearance.js` computes representative stellar disc geometry; it does not claim calibrated raster photometry. The standalone builder embeds smaller companion images as `bodyImages`; full snapshot size must be checked as the library grows.

Bespoke batches can be added through `scripts/assets/import-body-batch.mjs` and a saved research/input manifest without regenerating previous dossiers. The importer validates aspect ratios and size budgets, then writes compressed assets and the expanded registry. Research cards expose modelled interpretations separately, including ambiguous atmosphere/activity scenarios.

The Proxima b/d dossiers use full-name aliases (Proxima, Proxima Cen and Proxima Centauri) while keeping planet-letter IDs insufficient for visual selection. Neutral albedo maps and illuminated observer images share a research record but retain separate roles.

The standalone builder uses build-time Sharp to resize upstream surface previews, preserves transparent rings, and can sample absent native TIFF previews into `data/preview-textures/`. That cache is distinct from normal-resolution backend imagery. Selected-source credits survive resizing. The final HTML has a 16,000,000-byte build gate; the current full catalogue artifact is verified below it and runs with networking disabled.

Shape records can carry a source-specific display label; Haumea uses OCCULTATION ELLIPSOID instead of a PDS reconstruction claim. The native-km loader also supports smooth published ellipsoid fits. Build-time PDS parsing/GLB helpers can be imported without running network imports, and regeneration preserves entries from other shape pipelines.

Borrowed observed-body skins are prohibited: Moon, Mars, Pluto, Sun and Jupiter imagery is never assigned to a different body. Unfinished Solar System maps use independent procedural IMAGINED placeholders labelled BESPOKE QUEUED; existing native maps and completed individual dossiers retain priority. Non-Solar photospheres also use independent procedural illustrations.

Offline spacecraft rendering: the standalone snapshot embeds Meshopt mission preview GLBs keyed by their normal asset URL. The loader selects these data URIs instead of disabling mission models. Previews preserve credited source geometry with reduced detail and existing illustrative attitude/size limits. `scripts/assets/build-craft-previews.mjs` records preview processing, byte counts and SHA-256 hashes; the 16 MB HTML gate remains enforced.

Satellite panel rendering also fixes an undefined body reference in the model credit line. Craft materials receive a dedicated studio environment map so dark metal materials remain legible without changing planet illumination; this lighting is illustrative, not telemetry. Browser checks decode all 24 normal and embedded GLBs, render the ISS route with networking disabled, and verify all 71 offline images. Current standalone size is 14.25 MB.

Barnard c/d/e batch (2026-10-10): three independent IMAGINED albedo maps and observer images now replace generic class skins by full-name matching. Basant et al. 2025 supplies confirmed RV constraints, the 2024 stellar analysis supplies adopted host parameters, and the 2026 dynamical study is conditional modelling context. No observed radius, terrain, atmosphere or chemistry is implied. Geometric host diameters at representative distances are 3.599°, 5.246° and 2.588° respectively. Source bright-core widths were checked after image generation edits: approximately 11% below, 1% above and 17% below the target. These remain explicitly approximate raster sizes; exact calibration is refinement work. Primary downloads and generated originals retain SHA-256 records. The additive manifest is `docs/research/barnard-cde-batch-2026-10-10.json`; all previous dossiers remain unchanged.

Rebase integration preserves upstream live skins, surface controls, nearby planet lists, Galactic deep time and Quadrant/Universe snapshot fields alongside local shapes, models and body imagery. Normal tests/build and offline browser checks cover the combined version. Current full standalone is 15.76 MB, under the 16 MB gate but with little headroom; subsequent batches need preview compression or size budgeting.

Standalone image sharing: bespoke map cards now resolve snapshot.textures by asset.key before the legacy bodyImages URL fallback. The builder omits a second copy only when that texture is embedded. Other observer/context images remain embedded by URL; normal browser URLs are unchanged. This frees 371,925 bytes before adding Epsilon Eridani b. Dossiers can set surfaceLabel and skyLabel so gas giants explicitly show cloud-top/above-cloud views.

The GJ 887 additions use the existing additive dossier/texture registry, full-name aliases and cloud-card labels. No changes to catalogue fields, mission models or live/native imagery routes. Each standalone globe map is embedded once and reused by the dossier card; observer images remain separate. Registry now 15 dossiers.

The standalone builder transcodes local generated map previews and IMAGINED dossier images to quality-80 WebP at existing dimensions. Scientific context images follow the original embedding path. Registry/normal-build JPEG files and all model/shape GLBs are unchanged; source credits still resolve to the original assets. Combined standalone size is 15.85 MB.

Craft preview rebuilding accepts selected model IDs and `--texture-size=128`; omitted overrides use recorded per-model sizes (otherwise 256). Curiosity/Europa Clipper use 128-pixel preview textures with unchanged mesh/material counts; normal source models remain intact. Ross 128 b and Gl 725 A b use additive full-name dossier matching and disclose approximate raster geometry.

The standalone snapshot is now gzip-compressed losslessly and stored as base64 in the ignored generated `standalone/snapshot-packed.js`. The `#snapshot` alias selects `src/data/embedded-snapshot.js`; top-level await decodes it once with browser DecompressionStream before dependent modules execute. All catalogue fields, native imagery and GLB bytes are preserved. The builder checks exact gzip round-trip equality and still retains readable snapshot.json for inspection. Normal builds use the unchanged null snapshot. A current browser with gzip DecompressionStream support is required; unsupported browsers show a clear message.

Individual dossiers may carry `statusNote`; Planet View inserts a PLANET STATUS card ahead of their hypothetical imagery, distinguishing catalogue membership from disputed independent detection evidence. Tau Ceti f/g/h use conditional map/sky labels. The queue carries the same discovery-status notice. Previous dossiers omit this optional field and retain their existing cards.
