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
│                                      │           │ server/imagery.js   surveys, NASA │
│                                      │           │ server/bodyspectra.js PSG/Gaia/NEA│
│                                      │           │ server/dsn.js       DSN Now       │
│                                      │           │ server/comms.js     SatNOGS, Mars │
│                                      │           │ server/signals.js   signals map   │
│                                      │           │ server/deepsky.js   VizieR        │
│                                      │           │ server/nebulae.js   nebula images │
│                                      │           │ server/events.js    events feed   │
│                                      │           │ server/surfaceimages.js landed    │
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
- **Detail cards** (#60, `src/panels/detail.js`): every Star, Planet, Moon and Object View opens with
  FROM EARTH (`fromearth.js`: theskylive-style observing data for the viewer's location, from
  `src/astro/observe.js`, plus the `eyepiece.js` telescope drawing), IMAGERY (`imagery.js`: live
  feeds, survey cutouts gamma→radio, NASA archive with a lightbox) and a spectrum (`spectra.js`:
  PSG for Sol bodies, Gaia XP for stars, Exoplanet Archive for exoplanets). The views expose
  `setExtras`; `main.js` ticks the cards from its 200 ms loop. The observer location is the
  `observer` setting (browser geolocation or typed; default Greenwich).
- **Planet View** (`src/views/planet/`) shows a close-up globe, the atmosphere by volume (or
  JWST detections, or "not yet measured"), spectral fingerprints, the interior to scale, and
  the mass–radius diagram against composition curves.
- **Provenance.** Each value shown in the UI carries a tier badge from `src/data/provenance.js`.
- **Routes.** `#/system/<system>[/<body>]` (system: `sol`, `hyg-<n>` or `exo-<host>`), `#/star/<system>/<star>`, `#/planet/<system>/<planet>`, `#/moon/sol/<moon>`, `#/object/sol/<body>`, `#/satellite/sol/<norad>`,
  `#/navigation/<system>`, `#/quadrant`, `#/galaxy`, `#/universe`, `#/events[/<event id>]`. The Sector 001 beacon is
  `#/system/sol`.

## Backend API

| Route | Returns |
|---|---|
| `GET /api/health` | Liveness and configured catalog folders |
| `GET /api/horizons/vectors?body=399&month=2026-10` | Daily heliocentric vectors for a calendar month |
| `GET /api/nearby?center=sol&radiusLy=25` | Stars within a radius of a star (Sol always included), with planet counts, space velocity (`vKms`), `rvKnown` and velocity source `vSrc` (0 HYG, 1 Gaia DR3, 2 Gaia DR3 astrometry + catalogue RV); `motions` says whether Gaia motions have loaded |
| `GET /api/arrivals?center=sol&fromLy=25&toLy=250` | Deep-time arrivals (#29): stars with a measured motion in the shell `fromLy < d ≤ toLy` (≤ 1,000 ly), each with its system's shared motion: `[id, name, x, y, z pc, absmag, B−V, system, vx, vy, vz km/s, flags]` (flags = rvKnown + 2 × vSrc; vSrc 3 = a Gaia DR3 RV-slice star not in HYG, sent with `name` null for "Gaia DR3 &lt;source_id&gt;"), plus the catalogue's density near Sol, `gaiaRv` (slice status and counts) and `completeness` (half-complete radius per absolute-magnitude class, HYG alone and with the slice; the merged density). The slice loads in the background on the first request (≈ 25 s once, then from a year-long disk cache); until then `gaiaRv.status` is `loading` and the client asks again. `gaia=0` leaves it out. 25–250 ly ≈ 81k rows / 7.3 MB (2.8 MB gzipped), 250–1,000 ly ≈ 128k rows / 11.7 MB (4.5 MB gzipped); JSON responses over 256 kB are gzipped when the browser accepts it |
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
| `GET /api/observing/jwst/schedule` | JWST now / next / previous visits parsed from STScI's weekly schedule reports (`server/observing.js`) |
| `GET /api/observing/:mission/recent` | Newest public HST or JWST images from MAST: `{ images: [{ target, instrument, filters, observed, preview }] }`; `GET /api/observing/preview?uri=mast:…` serves a preview (MAST product URIs only, cached on disk) |
| `GET /api/traverse/:id` | A Mars rover's drive path (`m20`, `msl`): `{ points: [[lon, lat], …], distanceKm, sol, credit }`, planetocentric east-positive, from NASA/JPL MMGIS, thinned (`server/traverse.js`) |
| `GET /api/feed/:id` | A live feed: images as binary with `x-feed-time` / `x-feed-credit`; JSON feeds as `{ time, credit, data }` (`GET /api/feeds` lists them) |
| `GET /api/horizons/local?body=-74&center=499&day=YYYY-MM-DD` | One day of planet-relative states (km, km/s; 10 min) for orbiters |
| `GET /api/horizons/local-month?body=-74&center=499&month=YYYY-MM` | A month of planet-relative states (20 min): stand-in while a day loads, and what fast time-play runs on. Month and track responses clipped by a predicted ephemeris's end carry `ephemerisEnd` (drawn as an end marker) |
| `GET /api/horizons/track?body=-31&start=…&stop=…&n=400` | Heliocentric trajectory (AU), clipped to where the ephemeris exists |
| `GET /api/dsn` | DSN Now contacts `{ station, dish, spacecraftId (NAIF), down/up rate & power, rangeKm }`, plus `lastSeen` per craft (when this backend last saw it in contact) |
| `GET /api/comms/satnogs/:norad` | COMMS (#35): SatNOGS DB transmitters and the newest good Network observations (waterfall, audio) `{ transmitters: { rows, fetched }, observations: { rows, fetched }, credit }` (`server/comms.js`) |
| `GET /api/comms/mars-raw/:rover` · `GET /api/comms/raw-image?url=` | Newest Perseverance (`m20`) / Curiosity (`msl`) raw images; one image, only from the rovers' raw-image folders |
| `GET /api/comms/mars-weather/:rover` | Newest published sol of REMS (`msl`) or MEDA (`m20`) weather |
| `GET /api/signals` · `GET /api/signals/:layer` | Live-signals map (#35): the layers with credit, licence and availability; one layer's markers `[lat, lon, name, href, detail, extra]` (`radio`, `kiwisdr`, `traffic`, `windy` with `FIDELITY_WINDY_KEY`) (`server/signals.js`) |
| `GET /api/clusters` | Star clusters `[name, l, b, distPc, members, logAge, type, r50pc]` (Hunt & Reffert 2023) |
| `GET /api/cluster-members?name=` | One catalogued cluster's brightest ≤ 2,500 Gaia DR3 members `[ra, dec, plx, ePlx, G, BP−RP, prob, gaiaId, inTidal]` with its distance, r50, tidal radius and A_V (VizieR, cached 90 days; unknown names 404) |
| `GET /api/nebula-image/:key` | A landmark nebula's real image (allowlist: `src/data/nebula3d.js`), downloaded once to `data/nebulae/`, JPEG/PNG checked (`server/nebulae.js`) |
| `GET /api/star-lookup?ra=&dec=[&distLy=][&gaia=1]` | Identify a star by position: SIMBAD (brightest stellar object in the cone) and optionally Gaia DR3 (best parallax match), cached |
| `GET /api/gaia-bright` | Gaia DR3 stars G < 9, parallax/error > 10, beyond ~1.6 kly: `[gx, gy, gz]` ly, M_G×10, BP−RP×100 (ESA TAP, cached 90 days) |
| `GET /api/galaxies` | `{ ungc: [name, ra, dec, distMpc, T, M_B, D_kpc, method], groups: [pgc, n, distMpc, SGX, SGY, SGZ] }` |
| `GET /api/galaxy?maxLy=1500&maxAbs=2` | Bright catalogue stars as heliocentric galactic `[gx, gy, gz]` ly, absmag×10, B−V×100 |
| `GET /api/surveys` · `GET /api/survey/:key?ra=&dec=&fov=[&size=]` | Sky-survey list; a JPEG cutout (north up, east left; 404 where the survey has no coverage) from CDS hips2fits (`server/imagery.js`) |
| `GET /api/nasa-images?q=&must=` · `GET /api/nasa-image/:id/(thumb\|medium)` | NASA Image Library search (captions must name the body); preview images |
| `GET /api/surface-images?body=` · `GET /api/surface-image?src=` | FROM THE SURFACE (#36): `{ body, curated, live, pending, errors }`: the curated landed imagery of `src/data/surface-images.js` with local preview URLs, plus (Mars) the newest Perseverance and Curiosity raw images at each rover's latest traverse point (cached 1 h); an image from an allowlisted host/path only (`SURFACE_HOSTS`), JPEG/PNG verified, cached a year (`server/surfaceimages.js`) |
| `GET /api/psg?body=&month=YYYY-MM` | PSG modelled spectrum `{ wavelengthUm, total, reflected?, thermal? }` W/sr/m²/µm (`server/bodyspectra.js`) |
| `GET /api/star-spectrum?ra=&dec=[&distLy=]` | Gaia DR3 XP spectrum `{ found, gaiaId, nm, flux, err }` of the star SIMBAD finds there |
| `GET /api/exo-spectra?planet=` · `GET /api/exo-spectrum?path=` | Exoplanet Archive spectra list; one spectrum's points `{ um, width, value, errHi, errLo, limit }` |
| `GET /api/catalogs` | Inventory of local catalog folders |
| `GET /api/cache` | What is stored on disk |
| `GET /api/crew` · `GET /api/crew/image?file=` | People in space with open-data facts (#46); licensed portraits and flags, cached |
| `GET /api/events` | The weekly events feed (`events/events.json` from GitHub, `FIDELITY_EVENTS_URL` to override; cached 3 h; the bundled copy when offline or newer), with `streams` refreshed from the curated YouTube channels' RSS every 15 min. Adds `origin`, `cache`, `error` |

## Standalone preview

`npm run build:standalone` writes `dist-standalone/fidelity.html`. It's one self-contained file
with a bundled snapshot of the stars within 100 ly of Sol, their planets, a few skies,
and preview-sized surface images.
It needs no backend, so it can be shared or published as a Claude artifact. JPL Horizons
mode is disabled there. Deep-time arrivals (#29) come only from the snapshot's own 100 ly
(the 1,000 ly catalogue and the Gaia DR3 radial-velocity slice are backend-only, so the
snapshot does not grow); the chart badge says so when that runs short.

## Adding a view

1. Create `src/views/<level>/<Name>View.js` exporting `create…View(container, deps)` with
   `show()` and `hide()`. Give it the camera cluster (`createCameraRig` from
   `src/views/cameraControls.js`, exposed as `camera`; see "Camera controls" below) and call
   `rig.update(now)` every frame, running the view's own target easing and `controls.update()` only
   when it returns true.
2. Mount it in `src/main.js` routing; remove its entry from `src/roadmap.js`.
3. Add any upstream it needs as a backend route with a cache namespace. Don't fetch
   non-CORS upstreams from the browser.
4. Tag every displayed value with a provenance badge, and update `docs/data-sources.md`.

## Moons and small bodies

`src/astro/moons.js` gives parent-relative positions (the Moon from a lunar theory, the rest
from JPL mean elements with a Horizons-fitted phase in `src/data/moon-fit.js`, regenerated by
`node scripts/fit-moons.js`); `src/astro/smallbodies.js` propagates SBDB osculating orbits. The 49 named small bodies are
grouped in the body list by region (dwarf planets, asteroid belt, near-Earth, Jupiter Trojans,
centaurs/Kuiper belt/comets); those without a mosaic draw as plain spheres (`surfacePending`).
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

## COMMS and the live-signals map (#35)

`src/panels/comms.js` builds every COMMS section from one entry shape (`commsEntry`: name, value, source,
age that ticks every second, badge, link up / not in contact, links): `spacecraftComms` (the spacecraft
panel's DSN section, from the 20 s poll in `main.js`), `satelliteComms` (Satellite View: SatNOGS, and the
ISS's ARISS frequencies from `src/data/comms.js`) and `createCommsCard` (Earth, Moon, Mars detail views,
added by `detail.js`; it polls `/api/dsn` itself and matches craft to a body by DSN code, `BODY_CRAFT`).
`src/panels/signalsmap.js` is Earth's LIVE SIGNALS card: an equirectangular canvas over `/api/texture/earth`
with wheel/drag zoom, one pill per layer, and a click list whose links open the operator's page or stream in
a new window (nothing third-party is embedded or fetched by the browser; rover thumbnails come through
`/api/comms/raw-image`). Styles live in `src/styles/comms.css`. The standalone preview shows a "needs the
local backend" note and only the bundled observatory and volcano markers.

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

## 3D nebulae and cluster members (#24)

`src/data/nebula3d.js` gives each Quadrant View nebula a real image (credit, licence, date, centre, field
of view, "north is θ° left of vertical" from the publisher's AVM metadata) and a 3D model (`blister`,
`cloud`, `shell`, `filled`, `barrel`; radius R in arcmin, depth in R, literature reference).
`src/views/quadrant/deepsky3d.js` draws each as a box in the plane of the sky at the nebula's distance
(`skyBasis` in `src/astro/skyplane.js`: faces Sol, north along celestial north; physical size = angular
size × distance) and ray-marches it: every sample takes the image pixel behind it along our line of
sight, weighted by the model profile divided by its integral along that sightline, so from Sol the volume
adds up to exactly the image (MEASURED) and from anywhere else shows the model (MODELLED). Dark clouds are drawn
as a dust volume only (their image is the star field behind them), its opacity from how dark the blurred image is;
survey cutouts are sampled one mip level softer so their stars don't streak through the volume. Images load when a nebula is selected
or more than ~10 px on screen. Clusters load their members (`/api/cluster-members`) when selected or
larger than ~40 px (three at a time, 30 kept): measured directions, G brightness, BP−RP dereddened by the
cluster's A_V; along the line of sight `memberDistance` shrinks each parallax distance toward the cluster's
by inverse variance and fills what parallax cannot pin with a reproducible scatter as wide as r50
(the panel counts both). Globulars add a glow for their unresolved core. Members, stars in
`NEBULA_STARS` and their labels open the #23 star card; cluster and nebula dots select them. Selecting a
nebula flies in from Sol's side. In the standalone preview images and members are not available (said so).

## Surface view

Double-click a body in the System View (or its globe in the Planet View) to stand there
2 m up and look straight up (`src/views/system/surface.js`: texture lat/lon ⇄ mesh
direction, local horizon frame, alt/az). The camera turns with the body each frame, the
scale switches to TRUE while standing, drag looks around (sky follows the cursor) and the
wheel zooms; Esc or BACK TO ORBIT restores the previous scale. Chart overlays (belts,
satellites, spacecraft, orbits, zones, markers) are hidden; daylight (Sun altitude, civil
twilight) tints the background for Earth, Mars, Venus and Titan and fades the stars.

## Camera controls (#39)

Every 3D view (System, Navigation, Quadrant, Galaxy, Universe, the Star and Planet/Moon/Object
globes, and the surface view) carries the same camera cluster, bottom-left (beside the Navigation
View's orientation gauge; under the globe in the detail views). `src/views/cameraControls.js`
(`createCameraRig`) builds it and owns the keyboard, pointer and touch handling; the maths is pure
and tested in `src/views/cameraMath.js` (`tests/camera.test.js`).

- **Modes.** ORBIT is each view's OrbitControls. LOOK turns the camera on the spot (drag: the sky
  follows the pointer; pitch stops short of the poles). FLY adds W A S D / arrows and Q / E (down /
  up), Shift ×5; speed is 0.8 × the distance to the nearest surface per second (`flySpeed`), so it
  works from 100 m above a moon to 100 Mly out. In LOOK and FLY, zoom (wheel, pinch, + / −, the
  slider) changes the field of view. Touch: one finger orbits or looks, two fingers pinch (zoom in
  ORBIT and LOOK, forward/back in FLY) and pan (slide in FLY). Choosing ORBIT again returns smoothly:
  the view's `toOrbit` hook or, by default, a new target on the line of sight at the distance of
  whatever is in front (`ahead`), then a 0.7 s slerp to face it and back to the view's field. Keys:
  1 / 2 / 3 modes, + / − zoom, F fill view, Shift+F full screen, R reset, B link, C zoom to cursor;
  tooltips show them. The mode is remembered per view (`settings.cameraModes`).
- **Framing.** FILL VIEW frames the selection with `fitDistance` (the sphere's angular radius equals
  the narrower half field, so tall and wide viewports both fit; the right panel is its own grid
  column, so the viewport's aspect already accounts for it): a body's disc (rings included), a
  star's planetary orbits (the farthest orbit vertex), a region's extent, the Navigation sphere, the
  Galaxy disc, a selected nebula or cluster, the Quadrant or Universe filter radius. RESET returns to
  the view's default framing. The rig's own flights (`flyTo`, `frameSphere`) ease distance in log
  space and turn the view direction; under `prefers-reduced-motion` they, the System View's flights,
  the views' target easing (`motionK`) and the warp streaks jump instead.
- **Read-outs** are in real units: ORBIT shows the width of the view at the target
  (`VIEW 12 AU ACROSS`, picking M, KM, MILLION KM, AU, LY, KLY, MLY or GLY), LOOK / FLY and the
  surface view the field (`0.6° FIELD`). The slider is logarithmic between the controls' min and max
  distance (or field).
- **Full screen** (`cam-full` on `#app`) hides the rail and side panel and widens the viewport; Esc
  or the button restores it. The detail views also expand their globe to the whole viewport.
- **Bookmarks.** LINK writes `?t=<ISO>[&hold=1]&cam=<mode,x,y,z,qx,qy,qz,qw,fov[,tx,ty,tz]>` before the
  route's hash, copies it, and `main.js` applies it once the route's view has framed itself
  (`applyPendingCam`). Positions are in the view's frame and unit; the System View's are AU
  relative to the routed body. The surface view writes `&surface=lat,lon&cam=s,az,alt,fov`.
- **System View.** The floating origin stays on the focus in ORBIT and LOOK. In FLY it rides on the
  nearest body (`anchorId`, handed over with hysteresis when another body is 30% nearer), so the camera
  co-moves with it and stays precise; you cannot fly below a surface. Returning to ORBIT picks the
  body nearest the line of sight (within 2° or 1.2 × its apparent radius) or the body you rode with,
  re-expresses the camera relative to it and flies there without a second route flight
  (`quietFocus`). The body flights of the panel and route keep working in LOOK and FLY (orbit-style
  while they run). In the surface view the cluster drives `surface.fov` and its buttons: FIT 70°,
  RESET back to the zenith.

## Space telescopes

Hubble's satellite feed and JWST's body panel open an OBSERVING card in the feed viewer
(`observingBody` in `src/panels/satellite.js`): for JWST, the visit in progress (with a progress
bar) and what comes next, from STScI's published schedule (PLANNED); for both, a grid of the newest
public MAST images that opens each one large.

## From the surface (#36)

`src/panels/surface.js` builds the FROM THE SURFACE card for every Planet, Moon and Object View (passed to
`detailCards` as `surface` hooks by `main.js`). `surfaceSelection` (`src/data/surface-images.js`) decides: real
pictures from the surface where they exist (MEASURED: curated archival sets keyed to #37 site ids, live Mars raw
images, Earth's observatory webcams), sorted nearest the last rendered spot; otherwise the card leads with the
in-app render (IMAGINED). RENDER AT a site sets `pendingSurface` with `look: 'best'` (face the parent planet or the
Sun, horizon a fifth of the way up) and `daylight: 20` (walk to the nearest point where the Sun is 20° up, so a
render is not a black night); after ~3 s `captureWhenReady` calls `SystemView.capture()` (re-renders and copies the
canvas in the same task, so no `preserveDrawingBuffer`) and keeps the JPEG with the HUD read-out, time and actual
lat/lon in `localStorage` (a per-viewer convenience; renders can always be redone). The render's inputs (map, horizon
distance from the radius, gravity, sky model, the star's and parent's computed apparent sizes) are listed under the
IMAGINED badge. Each image's site is a camera marker on the Planet View globe (`setSurfaceMarks`); clicking one
stands there. No AI image service: it would need hosting and would be invention presented as a picture.

## Surface sites (#37)

`src/data/sites.js` lists sites per body (planetocentric lat, east lon, kind, source, `approx` for
uncertain points, `tier: 'planned'` for proposals, optional `traverse` and `feeds`).
`src/views/system/sites.js` builds a layer per body under its `tilt` group (so it turns and scales
with the globe; `siteDir` applies `texLon0`): one dot layer per kind, CSS2D labels on the near
side (major sites only until the camera is within ~0.8 radii, greedy screen-space de-clutter), and
rover and helicopter paths fetched from `/api/traverse` (lunar traverses from the bundled
`public/traverses/moon.json`, ids `moon:*`) the first time the body is focused. The layer shows
from orbit only: it floats a few km up, which from the surface view would be in the sky. The Planet View
globe gets the dots (`siteDots`). `src/panels/sites.js` renders the SITES OF NOTE section (kind
filters, stored in `settings.siteHidden`) and the site card (STAND HERE → `surfaceAt`, live feeds
through the satellite panel's feed viewer). Observatories (`src/data/observatories.js`) are Earth
sites whose feeds are backend webcam ids (`cam-*`, allowlisted in `server/webcams.js`) or YouTube
streams. SITES toggles the layer.

## Named features and FROM ABOVE

`src/views/system/features.js` labels IAU features on a focused globe from
`public/features/<body>.json`: a feature is labelled once it spans ~26 px, biggest first, near side
only, avoiding the site labels (`sites.placed`); NAMES toggles them and a click opens the same card
as a site. FROM ABOVE (`system.viewSite(id, lat, lon, spanKm)`) swoops the camera down over a site or
feature and orbits it there (OrbitControls target on the site, which follows the turning body; the
near plane follows the distance to the site); other bodies' labels hide meanwhile. Live rovers get
their NASA model at the end of their path (`loadCraftModel`, enlarged). Site cards add PHOTOS from
`/api/nasa-images` (mission + surface first, then the mission alone), badged REPORTED.

## LOOK AT (#43)

`system.lookAt(obs, target, { mode, apparent })` uses the surface view: FROM THE SURFACE stands on the
observer where the target is ~35° up and tracks it (dragging stops tracking; ⌖ TRACK resumes);
FROM ORBIT hovers just above the observer on the side facing the target, ignoring the horizon
(stars and spacecraft can only be observers this way). Both run at TRUE scale. In APPARENT mode
the target is drawn where it was when the arriving light left (one light-time iteration);
GEOMETRIC draws it where it is now. The HUD reads out angular size (vs the full Moon), illuminated
fraction and phase angle, distance, light-time, altitude/azimuth and the next rise or set
(`orientationAt` re-derives the observer's orientation at any time; 10-minute search over 4 days,
bisected), and the field with its magnification over a 60° naked-eye field. The math is in
`src/astro/lookat.js`; tests compare Earth from the Moon against JPL Horizons (site 301).

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
`?t=<ISO time>[&hold]` sets the ship's clock from the URL (`&cam=…` restores a camera, #39); `?surface=lat,lon[&look=sun]` stands on the routed body. In totality the surface view fades in a real corona photograph (#31; docs/assets.md) with the diamond ring and Baily's beads at the contacts.

## Launch windows and transfers (#45)

`src/astro/lambert.js` solves Lambert's problem with Izzo's 2015 algorithm (Householder iterations on the
non-dimensional time-of-flight equation, multi-revolution low/high paths, prograde or retrograde) and propagates
two-body orbits with universal variables. `src/astro/transfer.js` builds on the app's ephemeris (Standish elements
for planets, SBDB elements for small bodies; moons via their parent planet): `transfer()` gives C3, departure and
arrival v∞ and a Δv budget (200 km LEO injection; capture into a 1.1 R circular orbit, a 1.1 × 100 R ellipse for the
giants, or a speed match for small bodies); `porkchop()`/`porkchopByArrival()` grid them; `launchWindows()` finds the
local minima of least C3 along the departure axis (shallow dips between windows filtered) and the span within 30%
of each. Body panels (`src/panels/transfer.js`) list the next windows with Hohmann and synodic facts and an
explainer diagram; picking one draws the transfer in the System View (`setTransfer`: thick dashed arc, departure and
arrival markers, a ghost craft riding it while the clock is inside the flight) and opens the porkchop
(`src/panels/porkchop.js`: departure × arrival grid shaded by C3 on a one-hue ramp, marching-squares contours,
optimum ringed, hover readout, click to fly a cell). Mars offers a check against Perseverance's Horizons cruise.

## Future missions (#44)

`src/data/future-missions.js` is the curated list (43 missions, last checked in `CHECKED`): tiers IN FLIGHT,
CONFIRMED, PLANNED, PROPOSED (with `notSelected` for proposals that lost their competition) and CANCELLED / PAUSED,
each with agency, target body id, launch and arrival as announced, goal, status, sources, the JPL Horizons id where a
reference trajectory is published, and a Launch Library 2 pattern so the card shows the live launch date from the
events feed (#32). `src/panels/future.js` puts FUTURE MISSIONS in the Sol system panel (grouped by tier), an
UPCOMING section in each target's panel ("Dragonfly arrives 2034-12"; a planet also lists its moons' missions), and
mission cards in the feed viewer. SHOW PATH draws the Horizons reference trajectory (pre-launch planning tracks such as
MMX's are MODELLED; craft in flight COMPUTED) or, failing that, a direct transfer in the window nearest the planned
launch from the #45 solver (MODELLED), as a lilac ghost labelled PLANNED that rides the path on the ship's clock.
`pathTier`/`factTier` decide the badges and never return MEASURED (tested).

## Crew cards (#46)

`server/crew.js` serves `GET /api/crew`: the community people-in-space feed (corquaid, MIT; cached 6 h) with each
person enriched once a month from open data, one Wikimedia request at a time with backoff on HTTP 429: the
Wikipedia page → Wikidata item (birth date, citizenship, time in space P2873, employer, description; CC0), the
citizenship's flag (P41) and the Commons licence of the feed's portrait. `GET /api/crew/image?file=` serves a
240 px portrait or a flag only when its Commons licence is public domain or Creative Commons and the file belongs to
the current crew (not an open proxy), cached 90 days. `src/panels/crew.js` shows the list per craft (ISS, Tiangong
or everyone: PEOPLE IN SPACE in the satellite search section) with flags, faces and the live mission day, and a card
per person: role, agency, nationality, birth (year when Wikidata has only the year), employer, mission and launch,
days on this mission and in total counting live, Wikidata's time in space, links. Spacewalk counts have no open
structured source and say so. Where a portrait's licence is unclear, initials stand in. The standalone snapshot
carries the facts without images.

## Magnetic fields (#38)

`src/astro/magnetic.js` holds each body's dipole (equatorial surface field, tilt, north-end longitude, polarity,
offset), its typical magnetopause stand-off and bow shock, and sources: Earth and Jupiter derived from their
degree-1 Gauss coefficients (IGRF-14 2025, Juno JRM09), the rest from MESSENGER, Cassini, Voyager 2 and Galileo;
Mars and the Moon get crustal-anomaly loops instead. Field lines are dipole shells r = L sin²θ out to 0.8 × the
stand-off; the magnetopause is Shue et al. 1998 (Earth's driven by the live DSCOVR/ACE wind and IMF Bz; other
planets α = 0.6 at their typical stand-off) and the bow shock a conic. `src/views/system/magfields.js` hangs the lines
in each body's tilt frame (copying its spin, so the giants' axes turn with System III), coloured by |B| on a log ramp
with chevrons along the field, and draws the boundaries around the body facing the Sun (Ganymede's facing the
corotating plasma, its trailing side). Every distance goes through the body's radial compression (`localMap`), so
ENHANCED stays consistent with the moons and TRUE shows Jupiter's magnetosphere at full size. MAG FIELDS (the old
FIELDS toggle) controls both this and the Sun's Parker spiral. `src/panels/magnetic.js` adds a MAGNETIC FIELD
section to body panels. Not done: a PFSS model from today's magnetogram, draped fields at Venus, Titan and comets,
and stellar Zeeman-Doppler fields.

## Events feed and mission replays (#32, #33)

`scripts/events/build-events.js` (weekly GitHub Action `.github/workflows/events.yml`, or `npm run events`) writes
`events/events.json`, schema `fidelity.events/1` (`src/data/events-schema.js`, shared by generator, backend, app and
tests): launches and operations from Launch Library 2 (`scripts/events/ll2.js`), sky events from the app's own
ephemeris plus meteor showers, comets and aurora forecasts (`scripts/events/sky.js`), and webcasts
(`server/youtube.js`). Each run drops events that are over (`elapsed` in the schema module: past their end, their
modelled flight and their date precision) and adds the new ones. A failed source keeps last week's still-upcoming
events, marked stale. A weekly Claude Routine (Mondays 07:47 UTC) checks the Action's publish and rebuilds the file
itself if the Action did not. Times on tracks are seconds from the
event time.

Launches, landings and dockings with a minute-or-better time carry a `model`: Earth-fixed tracks
`[t, lat, lon, altKm]` (ascent and coast, booster returns, re-entry) and station-relative LVLH profiles
`[t, radialKm, alongKm, crossKm]`, all generated by `src/astro/trajectory.js`. In the System View,
`src/views/system/missions.js` draws whichever are live at the ship's clock: tracks are converted with
`fixedToInertial` so they turn with the ground, and pass through the same radial compression as satellites
(`localMap`); station-relative vehicles are placed in the station's SGP4 frame, so a docking is seen at true scale
from the Satellite View. Labels give mission time, altitude and the timeline phase; MISSIONS toggles the layer.

`src/panels/events.js` is the EVENTS rail entry (`#/events[/<id>]`): filters by kind and organisation, detail with
provenance on every value (REPORTED for published schedules and sites, MODELLED for paths and forecasts, COMPUTED
for ephemeris events), webcasts and channel live streams in the feed viewer, and GO TO EVENT, which sets the clock
just before the action (launches at T−60 s in real time) and frames the pad, recovery zone or station. A red dot on
the rail marks an event within 24 hours. The clock gained a 1 MIN/S rate.

VISIBLE FROM MY LOCATION (#33) filters the list with `src/astro/eventvis.js` (`eventVisibility(e, { lat, lon })` →
`{ visible: true | false | null, reason, tier }`), and every row shows the reason once a location is set. The
location is the `observer` setting shared with the FROM EARTH cards: typed, or browser geolocation on request, kept
in localStorage and never sent anywhere (no request carries it; the computation runs in the page). Solar eclipses
are judged at the place's own maximum (topocentric Sun and Moon from `eclipses.js`, scanned between the contacts):
in the umbra (path), in the penumbra (partial, with the obscuration) or neither, and whether the Sun is up then;
lunar eclipses by the Moon's altitude at maximum or during the eclipse; occultations, conjunctions, oppositions,
elongations, parades and transits by the bodies' altitudes at the event time (a dark sky, Sun below −6°, for the
night-sky events, the Sun up for transits; slow events also get that night's dark hours; occultations say whether
the Moon covers the target from here); meteor showers by the radiant; aurora watches by geomagnetic latitude
(MODELLED); launches, operations and webcasts are always watchable (REPORTED). Comets have no sky position in the
feed, so they stay "not computed" and are never filtered out. For a solar eclipse GO TO EVENT now stands on Earth
at the app's own point of greatest eclipse (on the centreline of a central eclipse) two minutes before it, in real
time, and turns to the Sun (`SystemView.surfaceAt(id, lat, lon, { lookSun })`); VIEW FROM SPACE keeps the old
framing, and WATCH FROM MY LOCATION stands at the observer's own maximum.

## Voice: "Computer" (#21)

`src/voice/wake.js` spots the wake word on the machine: an energy endpointer cuts utterances
from the microphone (AudioWorklet, resampled to 16 kHz) and DTW over MFCCs compares them with the
viewer's three recordings (localStorage). Only after it fires does `src/voice/computer.js` stream
24 kHz PCM16 through `ws://…/api/voice` to the Realtime API, with a description of the screen as
instructions (`screenContext` in `main.js`: view and route, what the camera is centred on or the surface
spot, clock and rate, scale, layers, spectral band, missions playing out, an open video/feed window, the
selected star and the side panel's text; refreshed at each wake and after every tool call) and three tools
(`go_to`, `set_layer`, `set_time`). Replies finish: while one plays, heard sound is not even matched
against the wake word, and the server VAD may not cancel it (`interrupt_response: false`); STOP or Esc
ends it, and the INTERRUPT toggle lets a confident wake word (within 0.7 × the trained threshold) barge in. Replies play
and are transcribed in the COMPUTER panel. Without a key
(or the backend), the browser's on-device recogniser, where available, handles "go to …" and
"show/hide …" locally. Tests: frame codec and relay against a mock upstream, DTW, endpointer,
resampler, command parsing.

## Time steps

The STEP control moves the clock by n units (minute … millennium; months and longer step the
calendar via `stepJd`, clamping to the month length) with ◀| / |▶ or the `[` / `]` keys, and RUN sets a
custom rate of n units per second (`clock.setRate`); ◀◀ / ▶▶ return to the preset ladder (which runs on to
±1 millennium, Myr and Gyr per second). n may be fractional or negative; it and the unit are remembered.
The units run on to MYR and GYR (mean lengths, Julian years) for deep time.

## One clock, deep time and view limits (#34)

`src/astro/clock.js` keeps one double-precision JD that may run far beyond JavaScript's dates
(±273,790 years; a double still resolves ~10 s at 2 Gyr). `clock.jd` is that time clamped to the
calendar, so every date-based consumer always gets a valid `Date`; `clock.deepJd` is the unclamped
JD, `clock.years` the offset from now in Julian years and `clock.inCalendar` says which applies. The
readout (`clockReadout` / `formatOffset` in `timerate.js`) shows a UTC date inside the calendar and
an offset such as "+1.2 MYR" or "−2.0 GYR" beyond it; the top-bar stardate shows `DEEP TIME · …`.

Each view sets the part of time valid for it (`clock.setLimit`, from `limitFor(level)` in `main.js`
on every route change and when the EPHEMERIS toggle changes): the System View and its detail
views use the ephemeris span (KEPLER ELEMENTS 3000 BCE–3000 CE; JPL HORIZONS 1–9999 CE, the
`YYYY-MM` months the backend can ask for), the Navigation View ORBITS INTEGRATED ±50 MYR, the Galaxy
View SATELLITE ORBITS ±2 GYR, Quadrant and Universe the calendar. Nothing goes past ±2 Gyr. When
time reaches a limit, or a new view's limit is narrower than the current time, the clock is
brought to the edge and held, and `clock.clamped` gives the reason, shown under the readout as
`⚠ STOPPED · <reason>` (otherwise `RANGE · <reason>`); the TIMELINE shades what lies outside. The
clock ticks in `main.js`'s time-control loop whatever view is showing (the System View also ticks
it; a second tick in the same frame does nothing). `syncDeepTime` then hands the Navigation View
its epoch (`nav.setEpoch`, whole years from now) and the Galaxy View its time (`galaxy.setTime`,
Myr) whenever they change; the panels only show the epoch and point to the TIME row.

## Text size

Every `font-size` in `lcars.css` is `calc(Npx * var(--text-scale, 1))`; the A− / A+ control in the top
bar sets `--text-scale` (80–160%, remembered as `textScale`), so text grows without changing the layout.
Right-panel section headings fold their section away on click (`src/panels/collapse.js`, remembered by title); body lists are at most two columns wide. The bottom bar has two rows. On top is the time control (`src/panels/timecontrol.js`, maths in `src/astro/timerate.js`): the clock readout with a GO TO date field; a middle panel that swaps between RATE (one logarithmic slider from −1 Gyr/s through HOLD and real time to +1 Gyr/s, with detents at each unit) and TIMELINE (a zoomable strip centred on the clock: drag to scrub, wheel or DAY…KYR to zoom, click a marker to go to it; markers are the computed sky events plus the feed's missions, and the shaded band is the window the sky events were computed for); HOLD, ⇄ REV (the same rate the other way), NOW and the n-unit STEP/RUN controls. Below, on the elbow's arm, are the view toggles. Each row scrolls sideways with the mouse wheel when it overflows. The slider now reaches ±1 Gyr/s and the timeline zooms to MYR and GYR (offset ticks from now beyond a 10,000-year window); the clock stops (HOLD) at the active view's limit, with the reason under the readout (see *One clock, deep time and view limits*).

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
camera-facing quads. Galactic time is the ship's clock (#34): `syncDeepTime` in `main.js` sets it, within ±2 Gyr.

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

**Arrivals (#29).** Stars move ~3.3 ly per Myr for every km/s, so in a few Myr today's neighbours
leave and others arrive from hundreds of ly away. `src/views/navigation/arrivals.js` loads
`/api/arrivals` shells around the centre star (radius → 250 ly with the chart, 250 → 1,000 ly once
the inner shell stops covering stars up to 100 km/s) and integrates them in a worker
(`orbits.worker.js`, `integrateBatch` in `galpot.js`: same potential and leapfrog, Float32 tracks;
±5 Myr at 0.1 Myr steps sampled every Myr, re-integrated to ±50 Myr at 0.25 Myr steps sampled
every 2.5 Myr once deep time passes 5 Myr; tested to agree within 0.1 ly). Each epoch,
`computeEpoch` screens every far star at its nearest sample and interpolates the few that can be
inside the sphere; those are drawn as a second point cloud with arrows, labels on selection, the
8-ly-of-Sol lines and picking. Today's stars that leave the sphere vanish (Sol and the centre
stay). Closest passes screen far stars along straight lines (slack for tidal and vertical pull)
and integrate the rest. The chart badge (`.drift-badge`, `drift.js`) counts stars in the sphere,
arrivals and departures; reports completeness against the catalogue's own density within 20 ly of
Sol and the distance where it halves; compares like with like (stars bright enough to be complete
out to the loaded radius, Hipparcos V ≈ 7.5); says when stars faster than *v* = (loaded − radius)
/ |t| are not loaded, or what is still loading. Velocities: the backend fetches Gaia DR3
astrometry and RVs for Hipparcos stars within ~1,090 ly once (`hipMotions` in `server/gaia.js`,
~1 min, cached 90 days; meanwhile HYG velocities are used and the client re-asks) and
`applyGaia` gives 62k HYG stars Gaia positions and velocities (parallax/error > 10; Gaia RV with
error < 5 km/s, else the catalogue RV).
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

## From Earth (#60)

`src/astro/observe.js` turns the app's heliocentric ecliptic positions (`system.positionOf(id, jd)`,
scene axes mapped back to the ecliptic) into what an observer on Earth sees: astrometric J2000
RA/Dec with light-time iteration, elongation, phase angle and illuminated fraction, equatorial
angular diameter, magnitude (`src/data/photometry.js`) and the constellation (Roman 1987 boundaries,
position precessed to B1875 with IAU 1976). Horizon work precesses to the equinox of date and uses
the IAU 1982 GMST; rise/transit/set scan the observer's local mean solar day in 6–12 minute steps and
bisect (upper limb and parallax for the Sun and Moon). Stars use their catalogue J2000 position.
`tests/observe.test.js` checks all 48 Sol bodies against a JPL Horizons observer table and
Auckland rise/set times (`tests/fixtures/horizons-observer-2026-10-10.json`). The standalone preview
keeps FROM EARTH (computed in the browser) but not imagery or spectra (backend only).
