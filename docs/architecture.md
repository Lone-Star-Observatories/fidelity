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
│                                      │           │ server/dem.js       DEM tiles     │
│                                      │           │ server/satellites.js CelesTrak    │
│                                      │           │ server/feeds.js     live feeds    │
│                                      │           │ server/imagery.js   surveys, NASA │
│                                      │           │ server/bodyspectra.js PSG/Gaia/NEA│
│                                      │           │ server/bandarchive.js band maps   │
│                                      │           │ server/dsn.js       DSN Now       │
│                                      │           │ server/comms.js     SatNOGS, Mars │
│                                      │           │ server/signals.js   signals map   │
│                                      │           │ server/deepsky.js   VizieR        │
│                                      │           │ server/nebulae.js   nebula images │
│                                      │           │ server/events.js    events feed   │
│                                      │           │ server/search.js    star search   │
│                                      │           │ server/rf.js        COMMS relays  │
│                                      │           │ server/tx.js, fm.js hailing (TX)  │
│                                      │           │ server/surfaceimages.js landed    │
│                                      │           │ server/corona.js    corona shape  │
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
| `GET /api/paleo-coastlines?time=66` | Continents reconstructed to 1–250 Ma by the GPlates Web Service (Müller et al. 2019): `polygons` of [lon, lat] rings (`server/paleomap.js`, cached a year) |
| `GET /api/co2` | NOAA GML Mauna Loa monthly CO₂ (the Keeling curve, #54): `rows` of [decimal year, ppm, de-seasonalized ppm] (`server/co2.js`, cached a day) |
| `GET /api/impact-risk` | Earth impact-risk lists (#53): NASA CNEOS Sentry and ESA NEOCC, each `{ fetched, count, rows }` sorted by cumulative Palermo scale (`server/risk.js`, cached 12 h) |
| `GET /api/texture/<key>` | A surface image (allowlisted keys only), downloaded once and cached |
| `GET /api/dem-tile/<body>/<z>/<x>/<y>` · `GET /api/dem-info` | Elevation tiles (#80): 256×256 16-bit greyscale PNG of heights (m) over lon −180 + x·s … +s, lat 90 − y·s … −s, s = 90°/2^z, tEXt `min`/`max` for the quantisation; levels up to the source's own resolution (Mars, Moon, Mercury, Earth z ≤ 4). Read from the raw DEMs by HTTP range requests (PDS IMG, uncompressed GeoTIFF strips; ETOPO1 through ERDDAP), cached for good in `data/cache/dem/`; `dem-info` lists each body's source, credit and finest level (`server/dem.js`) |
| `GET /api/textures` | Credit line for each texture |
| `GET /api/spectrum?type=G8V&feh=-0.5` | Closest Pickles template spectrum (300–2500 nm, peak = 1) |
| `GET /api/smallbodies` | Small-body populations: compact orbit rows `[pop, a, e, i, Ω, ω, M, epochOffset, H]` |
| `GET /api/voice/status` · `WS /api/voice` | "Computer" voice (#21): whether a key is configured; a same-origin WebSocket relay to the OpenAI Realtime API that adds the key (`server/voice.js`, hand-written RFC 6455) |
| `GET /api/hips?id=…` · `GET /api/gibs-band?layers=…` | Spectrum filter (#28): a whitelisted all-sky or planetary HiPS survey as a 2048×1024 equirectangular PNG (hips2fits; transparent where there is no data), and yesterday's GIBS mosaic of a whitelisted layer set (`server/bandimages.js`). `&size=preview` (#62): a small copy fetched at that size (256×128 sky, 512×256 body map) and cached the same way; every upstream band fetch goes through one queue (3 at a time, previews first). `x-band-size` gives the size. GIBS's latest day for layer sets marked `latest` (SMAP). The Sun's microwave maps are feeds `srh-12960` (the latest daily Siberian Radioheliograph 12.96 GHz FITS → PNG, #72) and `norh-17`/`norh-34` (`server/solarradio.js`, archival Nobeyama FITS → PNG); its radio maps `srh-3000`/`srh-6000` (SRH 3 and 6 GHz) and the MODELLED · PREDICTED discs `sunmodel-408`/`-1400`/`-2400` (`server/solarmodel.js`; inputs NOAA SWPC F10.7 and RSTN, cached 3 h, and the SDO HMI magnetogram) |
| `GET /api/band-archive?id=…` · `GET /api/band-disc?id=…` | Spectrum filter archive imagery (#28, `server/bandarchive.js`, allowlisted from the `archive`/`disc` entries of `src/data/bandarchive.js`, archive hosts only): a global equirectangular PNG built from NASA Trek WMTS tiles (mosaicked), a PDS 8-bit raster or a PDS ASCII table of binned values (`server/png.js` decodes and encodes PNG without dependencies); a whole-disc JPEG as published by ESA/Webb, ESA/Hubble, Chandra (`chandra.harvard.edu`) or NOIRLab (`storage.noirlab.edu`) (#72). `&size=preview`: 512×256 (zoom 0 / resampled) or the publisher's thumbnail (an entry without `preview` serves the image itself). Cached a year through the band upstream queue. `&meta=1` (#72): the map's physical scale as JSON `{ id, kind, scale: { min, max, unit, what, tier, source, stretch, … } | null }` (grey 0 → min, 255 → max, linear): for a table, the 1st–99th percentile stretch its image is drawn with (image cache keys carry the stretch version), computed from the same cached table and cached beside the image; for the XRS raster and Diviner, the documented scaling in `scale` (`src/data/bandarchive.js`); null for Titan's VIMS mosaics |
| `GET /api/satellites` | Active satellites: compact OMM rows `[norad, name, category, epoch ms, n, e, i, Ω, ω, M, B*, ṅ, n̈, intl id]` |
| `GET /api/satellites/:norad` | SATCAT record (owner, launch, type, radar size) with its UCS record as `UCS` (purpose, operator, mass, lifetime, links; `server/ucs.js`) |
| `GET /api/observing/jwst/schedule` | JWST now / next / previous visits parsed from STScI's weekly schedule reports (`server/observing.js`) |
| `GET /api/observing/:mission/recent` | Newest public HST or JWST images from MAST: `{ images: [{ target, instrument, filters, observed, preview }] }`; `GET /api/observing/preview?uri=mast:…` serves a preview (MAST product URIs only, cached on disk) |
| `GET /api/traverse/:id` | A Mars rover's drive path (`m20`, `msl`): `{ points: [[lon, lat], …], distanceKm, sol, credit }`, planetocentric east-positive, from NASA/JPL MMGIS, thinned (`server/traverse.js`) |
| `GET /api/feed/:id[?size=preview]` | A live feed: images as binary with `x-feed-time` / `x-feed-credit` (SDO/LASCO frames also at 256×256 with `size=preview`, #62); JSON feeds as `{ time, credit, data }` (`GET /api/feeds` lists them) |
| `GET /api/horizons/local?body=-74&center=499&day=YYYY-MM-DD` | One day of planet-relative states (km, km/s; 10 min) for orbiters |
| `GET /api/horizons/local-month?body=-74&center=499&month=YYYY-MM` | A month of planet-relative states (20 min): stand-in while a day loads, and what fast time-play runs on. Month and track responses clipped by a predicted ephemeris's end carry `ephemerisEnd` (drawn as an end marker) |
| `GET /api/horizons/track?body=-31&start=…&stop=…&n=400` | Heliocentric trajectory (AU), clipped to where the ephemeris exists |
| `GET /api/dsn` | DSN Now contacts `{ station, dish, spacecraftId (NAIF), down/up rate & power, rangeKm }`, plus `lastSeen` per craft (when this backend last saw it in contact) |
| `GET /api/comms/satnogs/:norad` | COMMS (#35): SatNOGS DB transmitters and the newest good Network observations (waterfall, audio) `{ transmitters: { rows, fetched }, observations: { rows, fetched }, credit }` (`server/comms.js`) |
| `GET /api/comms/mars-raw/:rover` · `GET /api/comms/raw-image?url=` | Newest Perseverance (`m20`) / Curiosity (`msl`) raw images; one image, only from the rovers' raw-image folders |
| `GET /api/comms/mars-weather/:rover` | Newest published sol of REMS (`msl`) or MEDA (`m20`) weather |
| `GET /api/rf/devices` | COMMS (#69): local SDRs `{ rx, tx, tools }`; `rx` lists receive devices with `streaming`/`waterfall` when their IQ tool is installed (`FIDELITY_FAKE_SDR=1` adds a SIMULATED SDR, `FIDELITY_BLADERF_XB200=1` extends the bladeRF to 60 kHz); `tx` lists transmit-capable devices (bladeRF first: the primary transmitter, its model from `bladeRF-cli -p`; then HackRF; never an RTL-SDR) with `ready` when their transmit tool is installed (`FIDELITY_FAKE_TX=1` adds a simulated one) |
| `WS /api/rf/local` | COMMS local SDR (#69): loopback only (peer, Host and Origin). `{type:'tune', freqHz (SDR side), mode, bwHz, agc, gain, driver, converter}` → `tuned {centreHz, freqHz, rateHz, audioRate, tool, fake}`; `{type:'scan', fromHz, toHz}` → `scan {signals}` (SDR side); `stop`. Binary: Kiwi-style `SND` audio and `LWF` waterfall rows (`src/data/sdr.js`) from one IQ stream (`server/sdr.js`, `server/sdrdsp.js`) |
| `GET /api/rf/websdr/frame?u=` | COMMS (#69): may a listed WebSDR page be framed? `{ url, finalUrl, status, embeddable, reason, checked }` from its X-Frame-Options / CSP frame-ancestors (HEAD, else a GET read to the headers), cached 7 days; unlisted URLs 403 |
| `WS /api/rf/tx` | COMMS hailing frequency (#69): loopback only (peer, Host and Origin). `{type:'open', freqHz, callsign, attested, region, gainDb, timeoutS, driver, converter, antennas, antennaId}` → `open` / `refused {code, reason}`; then binary Int16 mic PCM at 16 kHz; `{type:'close'}`. Server sends `state` (elapsed, remaining, sending ID) each second and `closed {reason, idSent}` (`server/tx.js`) |
| `GET /api/signals` · `GET /api/signals/:layer` | Live-signals map (#35): the layers with credit, licence and availability; one layer's markers `[lat, lon, name, href, detail, extra]` (`radio`, `kiwisdr`, `traffic`, plus local lists `trafficcams`/`worldcams`) (`server/signals.js`) |
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
mode is disabled there. Band imagery (#28, #62) is mostly backend-only: the standalone carries a small
budgeted set of baked previews (`snapshot.bandImages`, see "Spectrum filter") and otherwise computes
predicted skins and re-weighted stars. Deep-time arrivals (#29) come only from the snapshot's own 100 ly
(the 1,000 ly catalogue and the Gaia DR3 radial-velocity slice are backend-only, so the
snapshot does not grow); the chart badge says so when that runs short.

**Size gate.** The file must stay under 16,000,000 bytes (the Claude artifact limit; the builder refuses to write a
larger one). Dossier and context images are shown on cards at most ~420 px high, so the builder caps any non-IMAGINED
image larger than 1,600 px on its long side at 1,600 px (`capSize`: the same picture, smaller; JPEG stays JPEG at q90,
PNG stays lossless PNG; the normal app serves the originals) and logs each one. On 2026-10-12 that touched three images
(Phobos HiRISE 3374×3298, Io 2256×1158, Luyten NACO 1707×1707: 935,250 → 505,285 raw bytes) and took the build from
16,088,479 bytes (over the gate) to 15,626,914; nothing else was dropped. The 3D corona (#79) needs no data in the
preview: it uses the solar-cycle model (no feed offline).

## Mac App Store build (#51)

`VITE_FIDELITY_APP_STORE=1 npm run build:standalone` is the standalone above in its App Store
flavour (`src/appstore.js` exports `APP_STORE`): it leaves out franchise-branded extras, the Star Trek
layer (#25, #41: `settings.get('starfleet')` is always false and the panels' STAR TREK sections are empty)
and the STAR TREK postcard style, which App Review treats as third-party trademarks.
The macOS shell lives in [allengeer/fidelity-osx](https://github.com/allengeer/fidelity-osx): a sandboxed
SwiftUI app whose WKWebView loads this file from `fidelity://app/index.html` through a URL scheme handler,
with no local server or port. `/api/*` on that scheme goes to a Swift router, which will take over
`server/*.js` route by route with the same paths and JSON. Until a route is ported it answers 404, and the
standalone build never calls it.

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
5. Add the level to `viewKey` / `CURTAIN_LABEL` in `src/main.js` so it opens behind the loading curtain.

**Loading curtain.** Switching main views (`viewKey`: Universe, Galaxy, Quadrant, Navigation per
system, the System View and the levels drawn in it per system, each Star/Planet/Moon/Object view)
drops a blank LOADING curtain over the viewport (`src/views/viewcurtain.js`). It counts every
texture and model three.js loads (`THREE.DefaultLoadingManager`) and every `fetch()` started after
the switch, and lifts once 30% of them have arrived (`curtainReady`: never before 250 ms, not before
600 ms once something started, after 450 ms if nothing started because the view was cached, and
always by 15 s). The view keeps loading and drawing behind it; SHOW NOW lifts it at once. Focusing a
body inside the same view doesn't drop it.

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

## Band disc images (#28)

Where a body has no global map in a band but a whole-disc image exists (JWST, Hubble; #72: Chandra X-rays of Jupiter,
Gemini 4.7 µm Jupiter and 3.8 µm Io), the
`BODY_BAND` entry is a `disc` (`src/data/bandarchive.js`: image size, disc centre, equatorial and
polar radii in pixels, north position angle, all measured on the image, plus the observation date).
The planet shader's `bandSample` then projects the image orthographically onto the hemisphere facing
`uDiscE` (Earth, updated per frame in the System View; the camera in the Planet View) with the body's
pole `uDiscN` rotated to `uDiscPA`; its alpha falls to zero towards the limb and is zero on the far
side. Disc looks are drawn through the curve mix (mode 6): the image at weight 1, the predicted look
(`bandLook` for `<id>~`) at 10⁻³, so the far side shows the predicted skin and the near side the image.
The badge reads DISC IMAGE · date · EARTH-FACING SIDE ONLY. `discUv` mirrors the projection for tests.

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
On a body with an elevation model the camera stands on the DEM's ground and the horizon is a
terrain patch from the measured heights (mountains, crater rims; see Elevation and relief, #80).
On Venus and Earth a double-click stands on the cloud tops, and DESCEND / ASCEND fly through the cloud layer to the
ground and back (see Clouds and ground, #83).

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
  Beyond JavaScript's dates the epoch is `?y=<years from now>` (applied after the view's time range is in force, so
  Navigation's ±50 Myr and the Galaxy's ±2 Gyr survive); Quadrant/Universe add `&r=<radius>` and every view with a
  selection adds `&sel=` (Quadrant/Universe object id, Navigation star id, Galaxy star pick as `kind:id:gx,gy,gz`).
- **System View.** The floating origin stays on the focus in ORBIT and LOOK. In FLY it rides on the
  nearest body (`anchorId`, handed over with hysteresis when another body is 30% nearer), so the camera
  co-moves with it and stays precise; you cannot fly below a surface. Returning to ORBIT picks the
  body nearest the line of sight (within 2° or 1.2 × its apparent radius) or the body you rode with,
  re-expresses the camera relative to it and flies there without a second route flight
  (`quietFocus`). The body flights of the panel and route keep working in LOOK and FLY (orbit-style
  while they run). While the HELM (#42) flies the ship, the rig's `captured()` hook hands it the keys,
  pointer and camera and the cluster is hidden (P still opens a postcard). In the surface view the cluster drives `surface.fov` and its buttons: FIT 70°,
  RESET back to the zenith.

Apparent size (#47, `src/astro/apparent.js`): the scale snaps to TRUE on landing (`scaleMix = 1`), so
every disc covers 2·asin(R/d) from the first frame; the HUD reports the true and the drawn diameter of
the Sun and the Moon (or the parent planet) and the field as horizontal × vertical. FOV presets set
`camera.fov` from a horizontal field (cameras, eye) or a round field's diameter (binoculars,
telescope). The orbit-view glare sprite is hidden while standing; `skyglare.js` draws a glare plane
fixed in the observer's field (it does not grow with magnification), outside the disc only, scaled by
`glareStrength` (illuminance ∝ 1/d², airmass extinction, eclipse obscuration). ENLARGED ×4 multiplies
the Sun's and the Moon's mesh scale and says so in the HUD.

Night sky (#48, `src/views/system/skylayers.js`, geometry in `src/data/skylayers.js`): shown while
standing, in the full band. A back-side sphere maps the Gaia DR3 colour flux map (equirectangular
RA/Dec from hips2fits, through `/api/hips`); deep-sky images are additive quads on the sphere, turned
by `imageAxes` (north angle, east left as seen from inside) and sized from their field; cluster rings
use `galToRaDec`; constellation lines and names come from `src/data/constellation-lines.js`. Labels
behind the camera are hidden by hand (CSS2D shows them when the near plane is tiny). A click opens a
card in the feed viewer (`deepSkyCard` in `main.js`).

Planetshine (#49, `src/astro/planetshine.js`): `updatePlanetshine` computes, in true geometry, each
moon's planetshine fraction p·(R/d)²·Φ(α) and feeds the planet shader's second light (`uPsPos`,
`uPsCol` = tint × `planetshineDisplay(f)`), lowering the fake ambient for those moons. Standing on a
moon, `updateParentFinder` labels the parent with its size and lit fraction, draws an edge arrow when
it is off screen, aims ◉ LOOK AT and explains when a locked moon's far side never sees it.

## Text search (#63)

`src/data/search.js` is the pure matcher (fold to lower case without accents, Greek letters spelled
out; exact > prefix > word prefix > substring > typo-tolerant Damerau–Levenshtein, which runs only
when exact matching finds little), shared by the browser and `server/search.js`. `src/data/search-index.js`
builds the static entries (Sol bodies with aliases and minor-planet numbers, spacecraft with acronyms,
missions, sites, deep sky); `src/panels/search.js` adds the events feed, sky events and the satellite
catalogue, asks `/api/star-search` for stars and exoplanets (HYG designations kept by `parseHyg` as
`alt`), groups hits by kind with badges and routes a pick through `go()` or shell actions (stand at a
site, select in the Quadrant or Universe View, open a mission card, set the clock for a sky event).

## Universe View galaxy forms (#50)

`src/views/universe/galaxyforms.js` builds a form for each galaxy in `src/data/galaxy-images.js` once
the UNGC rows arrive (distance from UNGC, size from D25). Sky directions at the galaxy come from
finite differences through `radecToSupergal`; the disc lies along the major axis (PA) and the minor
axis tilted towards us by the inclination (towards the stated near side when known). Each disc vertex
gets the uv where it projects on our sky, so from the Milky Way the disc shows the cutout exactly.
Forms fade in between 6 and 30 px apparent size; `select` eases the camera to ~3× the galaxy's size.
Cutouts are served by `/api/nebula-image/<key>` (the same allowlisted, cached route as #24).

## COMMS (#69)

`#/comms` (top-bar COMMS, shown in Sector 001) opens `src/views/comms/CommsView.js` in the viewport:
two `createSignalsMap` instances (SUBSPACE layers; RF receivers) with a HAIL / SELECT button per hit,
a viewscreen and the finder (`comms.panel()` in the right panel). Opening a station runs OPENING CHANNEL (radio) or OPENING FEED (cameras, video) → SIGNAL
RECEIVED → ON SCREEN? (`stationMedia` in `src/data/rf.js` says what a station carries; the
`alwaysOnScreen` setting skips the question). Audio goes `<audio src=/api/comms/stream>` →
`src/views/comms/audio.js` (jitter buffer for receiver PCM, high-pass, low-pass, automatic notch,
compressor). Backend `server/rf.js`: the stream relay (raw socket for SHOUTcast "ICY 200", fetch
otherwise, metadata stripped, titles at `/api/comms/nowplaying`), camera media, `/api/rf/devices`,
the KiwiSDR relay (`ws /api/rf/kiwi`), the local SDR (`ws /api/rf/local`) and the WebSDR framing check.
Every upstream URL must be on a cached station list (no open proxy). The RF receiver console (`src/views/comms/receiver.js`) opens for KiwiSDR (`ws /api/rf/kiwi`) and the
local SDR (`ws /api/rf/local`): it tunes, shows a spectrum trace over a scrolling waterfall with a frequency axis
(click either to tune), plays received audio through the chain, and scans for clear signals. A WebSDR
opens in the main viewer (`src/views/comms/websdr.js`, below).

**Local SDR: one IQ stream, waterfall and audio.** An SDR is opened by one program at a time, so the
backend (`server/sdr.js`) runs a single raw-IQ process per device and does everything else in plain JS
(`server/sdrdsp.js`):

```
bladeRF   sh -c 'bladeRF-cli -e "$1" 3>&1 1>&2 | cat' sh "set frequency rx F; set samplerate rx 1000000;
          set bandwidth rx 1000000; set agc rx on | set gain rx G; rx config file=/dev/fd/3 format=bin n=0 …;
          rx start; rx wait"                     (SC16 Q11; fd 3 is a real pipe: Node gives children socket
                                                   pairs, which /dev/fd/N and /dev/stdin cannot reopen on Linux)
RTL-SDR   rtl_fm -f F -M raw -s 240000 [-g G] -l 0 -     (the existing rtl_fm path, raw IQ instead of audio)
HackRF…   rx_fm -d driver=… -f F -M raw -s 240000 …      (rx_tools / SoapySDR; also a bladeRF without bladeRF-cli)
   │ int16 IQ → ±1
   ├─ spectrum: Hann, 1024-point radix-2 FFT, power averaged over ≤ 16 frames, ~10 rows/s, DC in the middle
   │            → "LWF" row: seq, SDR centre, rate, one byte per bin (dBFS + 200)
   └─ demod: NCO to the listening offset → decimating FIRs to ~50 kHz (WFM: ~250 kHz) → mode filter →
             AM (envelope) / USB / LSB / CW (500 Hz BFO) / NBFM / WFM (75 µs de-emphasis) → AGC fast / slow
             (Kiwi decay presets) / off → Int16 at ~25 kHz → "SND" frames (S-meter = channel dBFS)
```

Listening anywhere inside the span (± rate/2 less a guard) moves only the NCO; leaving it restarts the
process at the new centre (a lilac line marks the retune on the waterfall). The scan pauses the stream,
sweeps ±2 MHz around the dial (rtl_power on an RTL-SDR; otherwise stepped captures, 75 % of each span
kept and stitched) and resumes. The browser maps everything through the converter: the dial and tune
requests use antenna ± LO; each row's axis (`rowAxis` in `src/data/sdr.js`) is the SDR's span shifted
back to the antenna, so through the Ham It Up a 7.074 MHz signal (SDR 132.074 MHz) is drawn, clicked and
scanned at 7.074 MHz. Colours follow the noise floor (dBFS, uncalibrated, badged MEASURED; IMAGINED for
the simulated SDR). `FIDELITY_FAKE_SDR=1` adds a SIMULATED SDR whose spawn emits synthetic IQ (a few HF,
FM-broadcast and 2 m signals plus noise, through a simulated Ham It Up whose switch follows SIGNAL PATH);
the tests use the same fake spawn. Not yet tried on real hardware: bladeRF-cli's `n=0` streaming, the
XB-200 commands and the rtl_fm/rx_fm raw scaling are from their documentation.

**WebSDR in the main viewer.** WebSDR (PA3FWM) has no open audio API and its audio protocol is not
relayed. The operator's own page opens in a sandboxed iframe (scripts, same origin, forms, popups; no
top navigation), scaled to the viewer, tuned with the parameter the page itself reads:
`?tune=<kHz><mode>` (`websdrTuneUrl` in `src/data/websdr.js`: 7074usb, 3630lsb, 198am, 145500fm,
10136.5cw; NBFM and WFM map to `fm`). Our dial, steps, band pills (from the list entry), mode pills and
the Computer's `tune` (with an optional mode word: "tune to 7074 usb") rebuild the URL and the page
reloads, debounced. First `GET /api/rf/websdr/frame` checks the page's X-Frame-Options and CSP
frame-ancestors (`framingVerdict`); a page that refuses framing, or one the backend cannot reach, gets
the old link-out with a note saying why. The viewer carries the operator's credit (REPORTED). Its audio
plays from their page (click it once: browser autoplay rules), not through the COMMS chain. Voice: the `comms` tool
(on screen, off screen, tune, scan, close channel, open/close hailing) and offline phrases.

**Transmission (hailing frequency).** Only when `/api/rf/devices` lists a transmit-capable SDR does
the RF finder show TRANSMIT SETUP (`src/views/comms/transmitter.js`): callsign, a licence
attestation (both in `settings.txSetup`, never sent anywhere but the local backend), ITU region,
TX gain (0–20 dB, default 0) and timeout (default 3 min, 1–30), and ANTENNAS: the operator's list
(name, bands 2 m / 70 cm / HF receive only, or none ticked = unknown; directional), prefilled with
editable defaults (Arrow dual-band Yagi: 2 m + 70 cm, directional; Small arrow and Donut: unknown;
Small loop and Wire: HF receive only), and the one in use (no default: the operator picks it).
"Open a hailing frequency 146" (voice, or the button) goes:

```
txGate (src/data/tx.js)  device ready → no converter in the path unless bypassed → callsign → attestation
                         → band plan (whole 11 kHz signal inside 2 m / 70 cm for the region: R2 144–148,
                         420–450; R1 144–146, 430–440; R3 144–148, 430–440) → the device's range (a bladeRF
                         x40/x115 starts at 300 MHz) → the antenna in use is marked for that band (antennaCheck:
                         "Unable to comply: the Small loop is set for HF receive only. Select the Arrow … for 146 MHz.")
browser  getUserMedia → AudioWorklet → resample 16 kHz → Int16 → ws /api/rf/tx (loopback only)
server   txGate again → createTxSession (server/tx.js): one at a time
         mic jitter buffer (≤ 500 ms) → server/fm.js: HP 300 Hz + LP 3 kHz (4th order) → pre-emphasis
         (750 µs, 1 kHz full scale = full deviation) → clip → 3 kHz splatter filter → clip
         → FM ±2.5 kHz (Carson 2 × (2.5 + 3) = 11 kHz, the ≈10 kHz NFM channel) at 2 Msps
         → SC16 Q11 → bladeRF-cli -e "set frequency tx F; set samplerate tx 2000000; set bandwidth tx 1500000;
                       set gain tx G; tx config file=/dev/stdin format=bin …; tx start; tx wait"   (primary)
           or int8 IQ → hackrf_transfer -t - -f F -s 2000000 -b 1750000 -x G -a 0      (HackRF, amp off)
```

Safety: the session ends at the timeout, after 15 s without mic frames, on CLOSE (button or "close
hailing frequency"), when the page disconnects, or when COMMS is left; every end sends the station
ID (callsign in CW, 20 wpm, 800 Hz tone, 5 ms shaped keying, as FM) before stdin closes and the tool
exits, and a long transmission IDs every 10 minutes (FCC §97.119). The mic goes off the moment
closing starts. Opening silences every received channel so nothing heard is retransmitted. A big
red TRANSMITTING bar (frequency, callsign, time on air, time to timeout, device, antenna, and
"DIRECTIONAL: POINT AT THE STATION" for a directional antenna, CLOSE) sits in the COMMS header while
the session runs. bladeRF gain is `set gain tx` in the board's own scale (0 is near the bottom on a
2.0 micro; libbladeRF clamps to the board's range).

**Receiver console tuning.** The mouse wheel on the receiver screen tunes by the step (one notch = one step; trackpad
deltas accumulate; up = higher). Over the shaded passband block on the spectrum or waterfall, or with Shift, the wheel
widens or narrows the bandwidth instead. Steps: 100 Hz–1 MHz including 12.5 and 25 kHz channel steps, plus a custom value;
remembered per viewer (localStorage). Bandwidth per mode (`BW` in `receiver.js`): presets, a slider over the mode's
range (AM 1–16 kHz, SSB 0.5–4 kHz, CW 50 Hz–2 kHz, NBFM 4–25 kHz, WFM 50–250 kHz; a KiwiSDR stops at 11 kHz) and a
value box, remembered per mode. The local demodulator's filters follow the bandwidth (`server/sdrdsp.js`: the second
decimation keeps the whole passband; WFM's first stage keeps half its bandwidth).

**COMMS in the background.** Leaving COMMS for any other view (Galaxy, Quadrant and Universe included) hides it but keeps an open channel or receiver playing; the header button beside COMMS shows what is playing and pauses or plays it (`comms.toggleAudio`: the COMMS audio context suspends and the radio element pauses). A transmission still closes on leaving COMMS.

**My station and my SDR.** The RF finder opens with MY STATION (`src/data/station.js`): the operator's location
from the browser, a click on the map (`signalsMap.pickPoint`, Esc cancels) or typed as a Maidenhead grid square or
coordinates, stored in the `observer` setting that FROM EARTH also uses and drawn on the map as MY STATION with its
locator. MY SDR lists the detected local receivers (`/api/rf/devices`, `?fresh=1` for RESCAN past the 30 s cache);
OPEN MY SDR, or a click on MY STATION, opens its console. With none detected it says why from the tool probe
(`sdrDiagnosis`: bladeRF-cli or rtl-sdr missing, tool present but no board, another program holding the radio).

**Signal path (frequency converter).** SIGNAL PATH in the RF finder (`settings.rfConverter`,
`src/data/converter.js`): none / Ham It Up (LO 125.000 MHz, up) / custom LO and direction, plus
BYPASS (the Ham It Up's switch). Converting, the local SDR console (`receiver.js`) works in
antenna-side frequencies: tune and sweep requests go to the SDR at antenna ± LO, the dial, readout,
waterfall axis, click-to-tune, scan results and the map's range show the true antenna frequency (the
KiwiSDR waterfall never goes through it). A receive converter is a passive mixer: driven
backwards it radiates the LO feedthrough, the image and mixing products unfiltered (FCC §97.307)
and can be damaged, so txGate refuses transmit while one is converting ("TX through the Ham It Up is
not supported: set it to BYPASS or connect the transmitter directly. HF transmit needs a proper
transverter and low-pass filter."); transmit stays on the direct 2 m / 70 cm bands with it bypassed. Writes to the tool are paced (backpressure, never > 200 ms ahead of
real time), silence keeps the carrier when the mic runs dry. `FIDELITY_FAKE_TX=1` (development)
adds a SIMULATED TX whose IQ goes nowhere, badged IMAGINED. Tests (`tests/tx.test.js`) measure the
IQ: instantaneous-frequency deviation, 99 % occupied bandwidth, the limiter, CW timing, the
timeout and the gate, with a fake spawn; the real tools are never run in tests. Not yet tried on
real hardware.

The map is line art in the LCARS tactical style: today's coastlines and borders from Natural Earth
1:50m (`public/shapes/world-50m.json`, built by `scripts/build-worldmap.mjs`, decoded by
`src/data/worldmap.js`: arcs shared by two countries are borders, the rest coastline; outlines are
unwrapped across the antimeridian and drawn at ±360° as well) over a navy graticule, as cached
`Path2D`s under a lon/lat transform so zoom and pan stay smooth. With `fill: true` (COMMS) it covers
its frame edge to edge inside LCARS bars. Pointing at a marker rings it and shows a card (name,
detail, list, position, how many more are under the cursor); pointing at land highlights the
country and names it in the readout. In COMMS the map opens in a popup (`.cx-map-pop`) over the
view — it auto-opens when you switch modes and closes once you hail a station or select a receiver;
CHANGE STATION / CHANGE RECEIVER in the header reopens it. This leaves the main viewer (the waterfall
and spectrum, or video) full width below the header, with the receiver controls and a separate
TRANSMIT box (`.cx-tx-box`) in the finder.

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

## Elevation and relief (#80)

Each body with a measured global DEM has real topography: relief shading at every distance,
true (or labelled, exaggerated) heights close up, terrain on the surface view's horizon and an
elevation read-out with its source.

- **Data.** `scripts/build-dem.mjs` fetches each DEM once (raw files in `data/dem-raw/`, never
  committed), box-averages it onto the app's grid and writes `public/dem/<body>.png` (1440 × 720,
  0.25°; Enceladus 720 × 360, its native 0.5°) plus `public/dem/index.json` (min/max metres,
  reference surface, resolution, coverage, credit, licence, source URL). One convention for every
  body (`src/astro/dem.js`): equirectangular, pixel-is-area, row 0 at 90° N, column 0 at 180° W,
  east-positive planetocentric longitude; 16-bit grey, 0 = no data, 1…65535 = min…max. A body
  whose colour map starts elsewhere (`texLon0`: Pluto and Ceres at 0°) samples the DEM at
  `u + (texLon0 + 180)/360`, the same offset `siteDir` uses. Sources, resolutions and licences:
  [data-sources.md](data-sources.md#elevation-models-80). Bundled: Earth (ETOPO1), Moon (LOLA),
  Mars (MOLA), Mercury (MESSENGER/USGS), Venus (Magellan), Ceres and Vesta (Dawn/DLR), Pluto and
  Charon (New Horizons, encounter hemispheres), Enceladus (Cassini ISS shape model): 13 MB in all.
  Phobos, Hyperion and the other shape-model bodies keep their 3D shapes. Titan, Ganymede, Europa,
  Callisto and Io have no open global grid: smooth spheres, and the panel says why.
- **Decoding** (`src/data/dem.js`): the PNG is inflated with `DecompressionStream` and unfiltered
  in JS (an `<img>` would round it to 8 bits), dequantised to metres (NaN = no data) for read-outs,
  and uploaded as a half-float `R16F` texture with a box-filtered mip chain (rows flipped so v = 1 is
  north like the sphere's UVs). No data → the reference surface; Earth's sea floor is flattened to sea
  level on the GPU (the ocean surface carries no relief) while read-outs give the bathymetry.
- **Shading and displacement** (`materials.js`, `DEM` define): the vertex shader displaces the
  sphere by `1 + k·h/R` (k = exaggeration, R = body radius) and passes the local east/north
  directions; the fragment shader derives the normal map from four height taps (central
  differences; step = one texel or the pixel footprint with the matching mip level, so distant globes
  do not sparkle) and tilts the normal by the slopes before lighting. Band modes, eclipses and
  planetshine use the tilted normal too. The normal map is computed on the fly from the one height
  file rather than shipped as a second image, so every exaggeration is exact (`slopeNormal` in
  `src/astro/dem.js` is the same maths, tested). Venus' relief is on its ground, under the opaque cloud deck
  (#83): hidden from orbit, seen from the helm and the surface view.
- **Close up** (`src/views/system/relief.js`): within 4 radii the globe swaps to a 384 × 192 sphere;
  within ~0.25 radii of the ground (FROM ABOVE, FLY) and in the surface view a terrain patch is built
  around the point below the camera: a polar grid of 96 rings × 192 spokes, rings packed towards
  the centre (≈ 40 m apart in Earth's surface view), heights from the finest tiles loaded
  (`/api/dem-tile`, the level chosen per ring so cells match the spacing; the bundled grid until they
  arrive, then rebuilt), positions relative to the patch centre for float precision, lit by its own
  geometry with the globe's shared uniforms. The globe is discarded under it (`uDemClip`). The
  standing patch reaches ~350 km, enough for mountains and crater rims on the horizon.
- **RELIEF** (body panel, ELEVATION section): OFF · TRUE · ×2 · ×5 · ×10 · ×20 (`settings.relief`,
  default TRUE). Exaggerations are labelled in the panel and the surface HUD.
- **Read-outs**: the height under the pointer (panel row AT CURSOR and a tag by the cursor),
  each site's height in its card, and the ground under the surface view in its HUD, all MEASURED
  with the model named. The surface camera stands 2 m above the DEM's ground, not the sphere.
- **Following the terrain**: site dots, labels, rover traverses and models (`sites.js`) and named
  features (`features.js`) are re-seated on the drawn ground when the DEM loads or the exaggeration
  changes; Planet View globes get the same relief and lifted dots. The helm (`helm.js`) keeps its
  0.2 %-of-radius clearance above the terrain and reports altitude above it.
- **Standalone**: no DEMs (16 MB budget); globes stay smooth and the panel says so.
- **Browser checks**: `window.__fidelityRelief` (`terminatorView(phase, dist)`, `overSite(lat, lon,
  dist)`, `elevationAt`, `phaseNow`, `view` = the System View API).

## Clouds and ground: Venus and Earth (#83)

Venus and Earth have two layers: a cloud shell at its height and the #80 ground beneath it, which the surface view
descends to and the helm lands on.

- **Model** (`src/astro/atmosphere.js`, pure, `tests/atmosphere.test.js`): the VIRA profile for Venus and the US
  Standard Atmosphere 1976 for Earth (pressure, temperature by altitude), `CLOUD_LAYERS` (Venus deck 48–70 km, haze to
  90 km, measured, super-rotation 4 days; Earth's shell at 10 km, ASSUMED: the imagery has no height), the murk, light
  fraction, Sun visibility and Rayleigh extinction by altitude (MODELLED), and the DESCEND / ASCEND state machine
  (`createDescent`, `startDescent`, `stepDescent`: altitude above the ground eased in log(altitude + 5 km), 40 s for
  Venus, 24 s for Earth, reversible mid-way; it takes the time as an argument).
- **Shells** (`SystemView.addBody`, `src/views/system/clouds.js`): a body with `skin.ground` (Venus: `venusRadar`,
  `groundRadar`) draws its globe with that map, coloured in the planet shader after Venera 13/14 (`uRadar`), and its
  own map (`skin.map`, the cloud tops) on an opaque `cloudMaterial({ opaque: true })` shell at 1 + 70 km / R that
  shares the globe's spectrum-filter uniforms (`BAND_UNIFORMS`): the band looks are unchanged, and in radio bands the
  deck hides so the ground (Magellan's emissivity map) shows. `updateCloudShell` turns Venus' deck westward
  (`superRotation(layer, jd)`), registers Earth's shell to today's GIBS image (alpha from whiteness,
  `uAlphaFromLuma = 2`; the ground drops the image's clouds, `uLiveSplit`) or drifts the 2004 snapshot, hides the
  shell in deep time (`paleoOn`), outside its bands and under Venus' deck, and feeds the ground shader the shadow
  lookup (`cloudShadow()`: the shell seen from each ground point towards the Sun, `uCloudTex/uCloudH/uCloudU/uSunL`).
  Venus' DEM is now shaded on the globe (`shading: 'all'`): the deck hides it from orbit, the helm sees it below.
- **Surface view**: double-click (System View, or the Planet View globe) enters with `layer: 'clouds'`: on Venus and
  Earth the camera starts on the cloud tops (`standKm`: 70.5 km, 10.8 km); `surfaceAt` (sites, events, postcards,
  `?surface=`) keeps the ground unless `layer: 'clouds'` (`&layer=clouds`). The HUD's DESCEND / ASCEND run the state
  machine; `updateSurface` lifts the camera by the altitude above the DEM ground (2 m at the bottom), and
  `layerLook` sets the sky, star fade, Sun and body visibility (none under Venus' deck), the ground's light (`uSunColor`
  scaled and tinted, `uSkyAmb` diffuse orange from the zenith `uSkyUp`), aerial perspective (`uFogK`, `uFogCol`) and
  the murk veil (`createMurkVeil`: a clip-space quad drawn last, so postcards keep it). Earth's murk follows the cloud
  cover over the spot (`cloudCoverAt` reads the cloud map on a small canvas). The read-outs (`layerHud`): altitude
  above the ground and the reference, pressure and temperature with the profile's name, the layer, the cloud source,
  Venus' ground and light, each with its badge. Leaving resets the ground's light (`resetLayerLight`).
- **Helm** (`helm.js`): REAL PHYSICS sweeps against the drawn ground under the ship (the DEM, within 1.5 radii) rather
  than the sphere; a touch-down sets the ship level on the ground (60 m up) and re-seats it as finer tiles load;
  IMPULSE / WARP clearance already used the ground; no cloud is a surface.
- **Browser checks**: `view.descend('down' | 'up')`, `view.surfaceLayer` (phase, altitude, layer, murk, cloud cover,
  Sun, light, read-out) and `window.__fidelityRelief.nodes` (globe and shell).

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
for planets, SBDB elements for small bodies; moons via their parent planet, `targetFor()`, which gives none for
Earth's own Moon since Earth is the launch site): `transfer()` gives C3, departure and
arrival v∞ and a Δv budget (200 km LEO injection; capture into a 1.1 R circular orbit, a 1.1 × 100 R ellipse for the
giants, or a speed match for small bodies); `porkchop()`/`porkchopByArrival()` grid them; `launchWindows()` finds the
local minima of least C3 along the departure axis (shallow dips between windows filtered) and the span within 30%
of each. Body panels (`src/panels/transfer.js`) list the next windows with Hohmann and synodic facts and an
explainer diagram. The list follows the ship's clock: each search remembers the date it ran from, and
`windowsStale()` triggers a new search when the clock goes back before that date or past all but the last window.
Searches are throttled to one every 1.5 s while the clock runs. Picking a window draws the transfer in the System View (`setTransfer`: thick dashed arc, departure and
arrival markers, a ghost craft riding it while the clock is inside the flight) and opens the porkchop
(`src/panels/porkchop.js`: departure × arrival grid shaded by C3 on a one-hue ramp, marching-squares contours,
optimum ringed, hover readout, click to fly a cell). Mars offers a check against Perseverance's Horizons cruise.
GRAVITY ASSISTS (`src/astro/flyby.js`, run in `flyby.worker.js`): patched conics, a Lambert leg between each pair of
planets and a powered flyby at each (`flybyJoin`: the periapsis giving the turn, a periapsis burn for any change of
speed, and a penalty when the turn exceeds the lowest safe pass). `sequencesFor` picks sequences by the target's
distance; `searchSequence` grids departure × leg times, keeps routes arriving within the best direct transfer's flight
time (Δv alone would always pick the slowest path) and refines the best by coordinate descent. The route is drawn
through `setTransfer({ track, marks })`. Checked on flown dates: New Horizons C3 158.6 (157.75 flown), Jupiter pass
33 RJ (32), Pluto v∞ 13.79 km/s (13.78); Mariner 10's Venus pass 5,738 km (5,768); the search re-finds New Horizons'
January 2006 window.

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

## Future events (#53)

The FUTURE rail entry (`#/future/<id>`) lists what is coming, grouped as stellar deaths, close passes,
the Solar System and the Sun (`src/data/future-events.js`, rendered by `src/panels/futureevents.js`;
not to be confused with `src/panels/future.js`, the future missions of #44). Calculations live in
`src/astro/future.js`: supernova peak magnitudes from distance and a type's absolute magnitude, with
template light curves (Type II-P, stripped-envelope) giving days in daylight and as a naked-eye star;
the Sun's main-sequence brightening (Gough 1981) and habitable zone (Kopparapu et al. 2013); the
run of pole stars from the app's precession model; a passing star's direct and tidal pull. Supernova
timing is always a MODELLED window, never a date; Sirius is explained as impossible. The Sun's card plots its
MIST v1.2 track on the HR diagram (`src/data/sun-track.js`, `node scripts/sun-track.js`, loaded on demand); the
impact-risk card adds the Moon (2024 YR4's odds as reported, ruled out in March 2026). Scenario visuals are
opt-in through `system.setScenario({ star, ring })`: a supernova drawn at its J2000 position and computed
magnitude (kept in daylight below magnitude −4) with SHOW IN THE SKY standing you at your observer location
at the star's next transit (`system.lookAtSky`), and the modelled Desdemona–Cressida and Phobos rings; each
has a MODELLED label with ✕, and they clear when you leave the FUTURE and System views. Gliese 710's card
charts the modelled comet shower. GO TO sets the
clock (an ISO date, or years ahead; past the calendar's ±273 kyr it needs the deep-time clock,
`clock.setYears`) and routes to the place to watch.

## Earth timeline (#54)

The TIMELINE rail entry (`#/timeline/<id>`, also EARTH TIMELINE in Earth's panel) lists Earth's past
and future by theme (`src/data/earth-timeline.js`, rendered by `src/panels/earthtimeline.js`), from
the K–Pg impact to the end of the universe. Live calculations: Milankovitch cycles and 65° N June
insolation from Laskar et al. (2004) (`src/data/la2004.js`, regenerated by `node scripts/la2004.js`,
every 1 kyr from 2.7 Myr ago to +1 Myr, loaded on demand) via `src/astro/milankovitch.js`, with a
readout at the ship's clock; the next perihelion at the June solstice; the Keeling curve
(`/api/co2`); Earth's slowing spin, ΔT and the leap-minute and leap-hour scenarios after 2035, and
impact energy, crater and recurrence from the Earth Impact Effects Program (`src/astro/earthtime.js`).
Recorded past is MEASURED, orbital mechanics COMPUTED, projections and the deep future MODELLED with
their ranges. GO sets the clock as FUTURE does. A logarithmic slider runs from 66 Myr ago to 10¹⁰⁰ years ahead
with an era banner (Adams & Laughlin 1997 for the far future) and the epochs near the chosen time; THE RECORD
charts LR04, ice-core CO₂ and sea level (`src/data/paleo.js`), and Mars' card charts its La2004 cycles
(`src/data/la2004-mars.js`), both regenerated by `node scripts/paleo.js` and loaded on demand.
Earth's globe changes with the epoch (`src/views/system/paleoearth.js`, uniforms in the planet shader): sea level
against ETOPO1 (flooding only what the open ocean reaches), PaleoMIST ice sheets for the last 30 kyr, GPlates
coastlines, or the Messinian drawdown (the elevation layer's alpha splits the Mediterranean at the Sicily sill and carries its depth; the floor deeper than each basin's fall keeps brine, the rest is exposed, shading to salt pans). Back to 120 ka the model's BIOME4 biomes colour the land (class maps through a palette, the four nearest cells' colours blended), fading in over the first 3 kyr; around 6 ka the records' North Africa map is drawn over them, since the model keeps the Sahara too dry; a banner names the source and tier, and today's clouds, live imagery and city lights are hidden. In the
System View the clock is held to the ephemeris span (#34), so an epoch outside it is shown on the globe through
`system.setEarthEpoch({ years | sea | ma })` while the planets stay at the ship's clock; inside it the globe
follows the clock. Leaving for a view without Earth clears it.

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
selected star and the side panel's text; refreshed at each wake and after every tool call) and its tools:
`go_to`, `set_layer`, `set_time`, `comms`, the helm's `set_course` and `helm` (#42), and the ship's calculators (`src/voice/shipcalc.js`): `body_state`
(distances, light time, speed, RA/Dec, constellation, elongation, phase, size and magnitude from Earth, light-time
corrected, from the System View's own positions: Horizons or Kepler, Kepler for the planets when the ship is at
another star), `distance` (between bodies or to a nearby star, with straight-line travel time at a speed or a
fraction of c), `orbit` (osculating elements about the parent from the ephemeris state), `transfer` (Hohmann
reference, synodic period and the next launch windows from the #45 Lambert search), `sky_events` (the next
eclipses, transits, oppositions, conjunctions and elongations from the #30 searches) and `calculate` (a
safe arithmetic parser with SI constants; nothing else is evaluated). Each result carries its epoch, method
and tier; tests check body_state against JPL Horizons. The persona is the ship's computer, never an assistant
or AI: it runs a calculator for any number, and answers "Unable to comply." / "Insufficient data." with the
reason instead of claiming it cannot calculate. Replies finish: while one plays, heard sound is not even matched
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
Right-panel section headings fold their section away on click (`src/panels/collapse.js`, remembered by title); body lists are at most two columns wide. The time control (`src/panels/timecontrol.js`, maths in `src/astro/timerate.js`) sits in three places: the clock readout with a GO TO date field in the left rail's lowest orange block; HOLD, ⇄ REV, NOW and the n-unit STEP/RUN controls in the purple block above the bottom elbow (both pinned while the rail's view buttons scroll); and, as a frameless strip over the bottom of every view that runs on the clock (all but COMMS; `#time-dock`, the viewport's `--dock-h` lifts the camera cluster, gauges, toasts and panels above it, and detail views pad their foot by it), a panel that swaps between RATE (one logarithmic slider from −1 Gyr/s through HOLD and real time to +1 Gyr/s, with detents at each unit) and TIMELINE (a zoomable strip centred on the clock: drag to scrub, wheel or DAY…KYR to zoom, click a marker to go to it; markers are the computed sky events plus the feed's missions, and the shaded band is the window the sky events were computed for). The bottom bar holds the view toggles, led by the DETAIL slider (#75, `src/data/detail.js`): far left is the bare system (star, planets, moons, orbits) and each step to the right switches on one more group of layer flags (3D CORONA, #79; DWARFS, SMALL BODIES for the catalogued asteroids and comets, BELTS, CRAFT with MISSIONS, ZONES, SATS, NAMES with SITES, AXES with MAG FIELDS). It writes the ordinary flags, so the toggles still fine-tune a step, and it reads back the deepest step whose flags are all on. The System View hides a body whose flag is off (`hiddenByDetail`: label, globe and orbit) unless it is the focus, and nothing hidden can be picked. Each row scrolls sideways with the mouse wheel when it overflows. The slider now reaches ±1 Gyr/s and the timeline zooms to MYR and GYR (offset ticks from now beyond a 10,000-year window); the clock stops (HOLD) at the active view's limit, with the reason under the readout (see *One clock, deep time and view limits*).

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
its badge and a false-colour key. For an archive element/abundance map or Diviner (#72) the key's ends
carry physical values: `bandtextures.js` fetches `/api/band-archive?id=…&meta=1` (`archiveScale`, backend
only) into `look.scale` and keeps the auto-levels in `look.levels`; `shownScale` (`src/data/bandarchive.js`)
turns them into the values at the bar's black and white points (the texture is sRGB, the levels are in
linear light), shown on the bar ("≤ 0.15 ppm Th … ≥ 7.4 ppm Th"), in a SCALE row (COMPUTED for
abundances, MEASURED for Diviner; source and stretch in the badge) and in the SPECTRUM overlay's readout.
Not in the standalone (these maps are backend-only there) nor for custom curves.
In the Navigation View (`src/views/navigation/starlook.js`, `bandStarLook` in bandstate.js) a star's
point size is its luminosity in the band: absolute magnitude minus the band-minus-V Δmag, the same
shift the System View applies to its sky stars, with a 6 px floor so the M dwarfs that make up most
of the neighbourhood always read under the velocity arrows. Colour keeps full strength (the band's
hue); a star whose photosphere emits essentially nothing in the band (radio, X-ray, gamma) becomes a
hollow NOT OBSERVED marker instead of vanishing, and a key on the chart says so (COMPUTED).

**Band audit (#61).** `docs/research/band-audit.json` (written by `scripts/band-audit.js`) records,
for every Sol body × band, what has been observed, what imagery exists, the mechanism, what the app
showed before and shows now, and the sources. The measured physics behind it lives in
`src/data/band-physics.js`: `brightnessTempK` (disc brightness-temperature spectra of the giants and
Venus, VLA/WMAP/CLASS), `subsurfaceTemps` (airless bodies at λ ≥ 0.3 mm: the diurnal swing damped
with depth, Piddington & Minnett, times an effective emissivity for scattering ice, Juno MWR/ALMA),
`synchrotron` (Jupiter's belts' share of the flux) and `RING_TB` (Saturn's rings, WMAP).
`bandLook` calls them for λ ≥ 0.3 mm and adds `belts` (drawn by `radiobelts.js`: seeded points in
the JRM09 magnetic-equator frame, through the radial compression) and `gain` (the disc dims beside
them). Giant-planet and Titan reflectance is the measured Karkoschka (1998) spectrum
(`src/data/reflectance-karkoschka.js`, from `scripts/karkoschka.js`). New glow kinds in the planet
shader: 5 auroral ovals over a faint disc, 6 volcanic hot spots (Io, 3–5 µm), 7 Venus's near-IR
night-side windows. `ringBandLook` sets Saturn's ring tint per band. `BODY_BAND` entries carry
`range: [nmLo, nmHi]`; band-level keys only where the map fits every pass.

Views consume the band only through `currentBand()`/`onBand()` and decide by wavelength
(`effectiveNm(pass.filter)`), so a custom transmission curve works too.
- **Galaxy model** (`model.setBand`, Galaxy and Quadrant views): `src/astro/galaxyband.js` holds each
  component's display spectrum (thin/thick disc, bulge, nuclear cluster, arm OB stars, HII regions,
  halo, dust extinction and dust emission, gas, Fermi and eROSITA bubbles) as anchors from γ-rays to
  408 MHz; `bandResponse` through the filter gives each layer's weight. Narrow filters on Hα/[O III]/
  [S II] boost HII regions; one on 21 cm, the gas. Dust switches to additive glow when it emits more than it
  absorbs (far-IR). Three layers exist only outside the visible: the HI gas disc (Kalberla & Kerp
  2009), the Fermi bubbles and the eROSITA bubbles. Faint bands are auto-levelled (never dimmed);
  the panel's SPECTRUM fact says what dominates, badged MODELLED (COMPUTED "not observed" in the EUV).
- **Universe galaxies**: `galaxyTypeWeight(T, filter)` re-weights each UNGC galaxy by its type
  (E/S0, spiral, irregular), groups as spirals, in the band's false colour; MODELLED.
- **Magellanic Clouds**: `src/data/satellite-bands.js` picks a real image by wavelength (DSS2 in full
  and visible, 2MASS, Spitzer, AKARI, Planck, HI4PI, ROSAT, Fermi, GALEX NUV over Swift UVOT) from
  `/api/survey/:key` (two hidden keys, `galexnuv` and `uvotw1`, return asinh-stretched PNGs). The
  standalone preview keeps Spitzer plus baked 128×128 cutouts (LMC ROSAT, HI4PI, Planck; SMC HI4PI).
- **The Sun, in the Star and System views alike**: `src/views/system/starband.js` (`sunBandLook`, used by
  `starBandLook` and by `SystemView.applyStarBand`) gives the photosphere's look: one bandpass takes the
  `BODY_BAND.sun` map keyed by its id (the old rule, reproduced exactly); a custom curve takes every map
  whose `range` overlaps it (SDO, NoRH, SRH 3/6/12.96 GHz, the modelled radio discs), weighted like any body
  (`sunCurveLook`): the best-covered map is drawn on the Earth-facing disc and blended over the predicted
  tint (signatures, photosphere) by its share (`mix` → the star shader's `uBandMix`). Otherwise its
  measured signatures, or the blackbody through the filter. A SPECTRUM BAND card and the chart's shaded
  bandpass (or an off-chart pointer) follow the band.
- **Sun microwaves**: `server/solarradio.js` decodes NoRH FITS to PNG (feeds `norh-17`, `norh-34`). The
  13.8 GHz (Ku) pass shows the latest daily SRH 12.96 GHz map (feed `srh-12960`, #72); its `BODY_BAND` entry
  carries a `fallback` (Nobeyama 17 GHz, labelled archival): `sunBandLook` returns it when the map cannot be
  shown (the standalone has no baked SRH 12.96 GHz copy) and as `look.fallback`, which the Star View
  (`showFeed`) and System View (`showSunFeed` → `progressiveFeed(…, onFail)`) switch to when the feed fails.
  SRH publishes maps only at 3.0, 6.0 and 12.96 GHz, so 23–94 GHz keep Nobeyama, labelled archival 2014.
- **Sun radio** (`server/solarmodel.js`): feed `srh-3000` is today's Siberian Radioheliograph 3.0 GHz
  CLEAN map (MEASURED; the map nearest Badary's noon that passes a sanity check, smoothed to the beam,
  256×256); `srh-6000` and `srh-12960` (#72) the same from the SRH0612 and SRH1224 arrays (`srhFeed(credit,
  MHz, scale)`, the beam ∝ 1/f, 12.96 GHz on its own log scale). Below 3 GHz no imager is fetchable, so feeds `sunmodel-408`, `sunmodel-1400`, `sunmodel-2400`
  are MODELLED · PREDICTED discs: Zirin et al. (1991) quiet-Sun Tb saturating to the 10⁶ K corona, limb
  brightening at dm and a larger disc at m wavelengths, active regions placed from the SDO HMI
  magnetogram (feed `sdo-hmimag`, decoded by a dependency-free PNG reader), the total set by the day's
  RSTN flux at the nearest frequency (NOAA SWPC) or else F10.7. Their `BODY_BAND` entries carry
  `predicted: true`: `bandLook` badges them MODELLED, `realOverlap` returns `mapped` (drawn) apart from
  `measured`, so a curve counts them as PREDICTED; the feed's credit (shown as the badge detail) names
  the inputs: F10.7 value and date, the RSTN reading, the HMI frame time.
- **Earth microwave/radio**: GMI brightness-temperature composite and SMAP 1.41 GHz via
  `/api/gibs-band`; entries marked `latest` ask GIBS for its default (latest) day.
- **Standalone preview**: `scripts/standalone-bands.js` bakes a budgeted set of previews into
  `snapshot.bandImages` (WebP, keyed by the backend URL they replace; `src/data/bandbake.js`): the Sun
  (SDO AIA 171/304/1600/94/193, SRH 3 GHz, NoRH 17 GHz, the modelled 1.4 GHz and 408 MHz discs, 192×192),
  the System View sky (Haslam 408 MHz, WMAP K, 2MASS, AllWISE, AKARI, HI4PI, Fermi; 256×128) and Magellanic
  Cloud cutouts (128×128). `hipsUrl`/`gibsUrl`/`realUrls`, `loadLive`, `loadFeedPreview`/`progressiveFeed`
  and the Galaxy View's Clouds use them offline; a look showing one says BAKED w×h · date (res `baked`).
  Everything else is predicted, sketched or the bundled Spitzer images, as before. The builder spends at
  most 60 kB on them and drops them if the HTML would exceed the 16 MB gate. Measured 2026-10-10 (same
  day, same network): before, 15,994,261 bytes (5,739 under the gate; the live snapshot data had grown
  since the 15,926,772 recorded that morning); the upstream surface previews re-encoded as WebP q82
  instead of JPEG q82 (same 512×256, same source) save ~123 kB of snapshot; the 20 baked band images
  cost 31,638 bytes; after, 15,892,264 bytes (107,736 under). Verified offline in Chromium
  (`context.setOffline(true)`, `file://…/fidelity.html`): the System View's Sun in AIA 171 Å, the
  modelled 1.4 GHz and 408 MHz discs with the Haslam sky, a 3 GHz window adding the SRH map (2%,
  listed), the Star View in AIA 304 Å and the Galaxy View's LMC/SMC in HI4PI, all from baked copies.
**The transmission curve (#66).** The SPECTRUM button opens a translucent overlay
(`src/panels/spectrum.js`) with one log-wavelength axis from 10⁻⁶ nm to 10 m and the curve T(λ) ∈ [0, 1]
over colour-coded bands. The state is a curve (`src/data/curve.js`): parts (a bandpass filter, the CIE
photopic eye, or a window lo–hi with a transmission) combined by max, minus excluded ranges; it is the
`curve` setting (old `band`/`bandPass` settings map onto the curve of that bandpass). `currentBand()`
still returns `{ band, pass, full }` (plus `curve`, `custom`, `prep`): a curve that is exactly one
bandpass canonicalises to that band and pass, so every old result is reproduced exactly; any other
curve gives a synthetic band `custom` (the dominant band's palette) and pass (`filter: { points }`,
`curve`). Views computed from T(λ) (`src/views/system/curvelook.js`, integrals in log wavelength):
- bodies: every `BODY_BAND` map whose bandpass R_i overlaps T, weighted by ∫T·R_i (normalised); the
  measured fraction is ∫min(T, max R̂_i)/∫T. The best-covered map is drawn, others listed. The rest,
  max(0, T − max R̂), is predicted segment by segment with `bandLook()` (reflected 150 nm–2.6 µm, thermal
  beyond, X-ray/gamma glows); the planet shader's mode 6 blends real map, reflected, thermal and glow
  by those weights. The badge text gives the mix ("62% MEASURED · 38% PREDICTED") and NOT OBSERVED ranges.
  A `BODY_BAND` entry's bandpass is its optional `range: [nmLo, nmHi]`, else the filter of the pass it is
  keyed by, else (band-level key) the pass showing the same map, else the union of the band's passes.
- the Sun: its maps by overlap (SDO, NoRH, SRH; a modelled radio disc counts as PREDICTED), drawn weighted by their share, its measured radio/microwave/gamma signatures, the photosphere for the rest;
- stars: a blackbody through T relative to V (Vega system, COMPUTED), 90 nm–30 µm;
- the sky: every overlapping all-sky survey, blended by overlap (one sphere each); none: re-weighted stars.
- colour: a narrow curve keeps its band's palette; a wide one (two bands with ≥ 10% each, more than ×3
  in wavelength, or a visible curve wider than ×1.33) is a three-band composite: the curve's log range
  in thirds, short → blue, middle → green, long → red, with a key in the panel.
The readout (effective wavelength, equivalent width, bands included, colour) is also in the Computer's
screen context (`describeCurve().text`).

**Instant previews and "Processing" (#62).** Every real map and survey loads as a preview first
(`size=preview`), then full resolution 350 ms later (so rapid switching does not fetch every band),
cross-faded in by the shader (`uBandTexPrev`/`uBandFade`, the sky's `uPrev`/`uXf`); previews of every
band are prefetched one at a time after start-up. Each look carries `res` (PREVIEW → LOADING → FULL, or
FAILED with the preview kept); a newer look always wins (`u.__look` guards). Full-resolution loads are
tracked by `src/data/bandload.js`: a new generation per change; while anything is pending a PROCESSING… n
pill pulses and, with VOICE STATUS on (default: on while the Computer listens), the browser's own
speech synthesis says "Processing" every 3 s (skipped while the Computer is replying), "Complete" at
the end if it spoke, "Unable to complete" once on the first failure. No API key or network is needed.

## Corona (#79)

The Sun in the System and Star views has a 3D corona: a volume ray-marched per pixel, so it reads as a
layered, wispy cloud from any side (orbit round the Sun, look from a pole), not a flat glow.

- **Frame and alignment.** The corona is a bounding sphere (`src/views/system/corona.js`, `createCorona`) parented
  to the photosphere mesh (System View: inside the tilt group, so +y is the IAU solar pole; Star View: a non-spinning
  frame tilted like the star). Each frame the view passes the camera, the direction to Earth and ecliptic north in
  that frame. Structure measured on disc images is placed with the same projection the disc images use
  (`imageToDir` mirrors the star shader's `uEarthDir`/`uNorth` mapping), so EUV loops sit on the active regions the
  SDO image shows and holes on its dark patches.
- **Physics per band** (`src/data/corona.js`, `coronaLook`, decided by effective wavelength so a custom curve works):
  white light and near IR take the Baumbach (1937) K + F brightness law, each term r^-k turned into the emissivity
  r^-(k+1)/(√π Γ(k/2)/Γ((k+1)/2)) so the march reproduces Baumbach along every line of sight (tested);
  EUV/soft X-rays (0.1–40 nm) are optically thin n² with the hydrostatic scale height H = kT/(μ m_p g☉) at the AIA
  channel's temperature, plus loop arcades over active regions, drawn in Helioviewer's AIA colours; the thermal IR
  is the dust F corona (flattened to the ecliptic, thinning inside a few R☉); radio is an optically thick free–free
  corona (Baumbach–Allen n_e², absorption set so τ = 1 at the radio radius 1 + 0.12 f_GHz^-0.8, as in
  `server/solarmodel.js`); microwaves a thin rim with gyro-resonance blobs over active regions; Lyman-α a scattered
  corona; above ~10 keV nothing (quiet-corona emission is not observed there; the panel says so).
- **Honest brightness.** Each look carries the corona-to-disc ratio (white light 1.1×10⁻⁷ at 1.5 R☉) and the
  exaggeration needed to show it; EUV and radio are drawn to scale. The display is a log stretch (a radial-filter
  look), so relative brightness inside the corona is kept.
- **Structure** (`server/corona.js`, feed `corona`, hourly): the PA profile of the SOHO LASCO C2 image (2.5–4 R☉; C3
  at 5.5–9 R☉ when C2 is more than 3 days old, as on 2026-10-12, when C2's latest frame was 13 days old), each ring
  divided by its median, gives the streamers (PA, width, contrast) and a belt through the limb streamers nearest the
  equator; the AIA 193 Å preview, cut into cells normalised by their ring (limb brightening cancels), gives active
  regions (bright) and coronal holes (dark). **Streamers in 3D** (`placeStreamer`): helmet streamers are folds of the
  streamer belt round the heliospheric current sheet, so each measured streamer is put where its line of sight (every
  direction seen at its PA from Earth) crosses the fitted belt sheet, at the crossing nearest the plane of the sky, and
  stretched along the belt (half-length 0.3 rad + its width); together they make a warped sheet round the Sun that
  looks right from any side in the System View and still projects onto LASCO's position angles from Earth (tested). A
  streamer whose line of sight meets the belt no nearer than 60° to the sky plane (a pseudostreamer, a face-on belt)
  stays in the sky plane. This is a model, not tomography: one coronagraph view cannot tell front from back. When the feed is missing
  (standalone, offline) or more than 14 days from the clock, `modelledStructure` builds a solar-cycle corona: belt
  tilt 10°→70° with activity (`cycleActivity`: cycle 25 minimum 2019.96, maximum late 2024), polar holes at minimum,
  active regions by number and Spörer latitude at illustrative longitudes that turn with the Sun.
- **Wisps.** Radial striations are value noise in direction only, with puffs drifting outwards slowly (IMAGINED).
- **Panel.** The Sun's CORONA section (`coronaLayers`) lists each layer with its badge: streamers, loops and holes
  MODELLED (from MEASURED positions; illustrative positions IMAGINED), fall-off MODELLED, brightness IMAGINED where
  exaggerated, wisps IMAGINED. The disc imagery keeps its own MEASURED badge in the SPECTRUM section.
- **Occlusion.** The pass has no depth buffer; instead the System View hands the shader every body in front of the
  Sun (`coronaOccluders`: within the corona's footprint on screen, nearer than its far edge, with a radius of at least ~⅓
  screen pixel; up to 8, largest first), as spheres whose centres are taken relative to the camera in double
  precision. Each line of sight ends on the Sun or on the first of them it meets (the Moon in an eclipse, Mercury or
  Venus in transit or against the corona, any moon or planet seen from space), and lines grazing a limb lose their
  corona over ~1.5 pass pixels, so limbs are anti-aliased at half resolution. Rings and non-spherical shape models
  occlude as their bounding sphere.
- **Cost.** 20–56 march steps (more when the Sun is large on screen) over the sphere's pixels only, drawn at half
  resolution into a render target on its own layer and added over the frame (`createCoronaPass`). **Adaptive
  quality** (`createQualityGovernor`, `CORONA_QUALITY`): while the corona is drawn the pass averages the frame
  interval (each counted at most 100 ms; gaps over 5 s, a hidden tab, ignored); after ~1 s slower than 28 ms
  (~35 fps) it steps down a level (resolution ×1 → ×0.4 of the half-resolution target, steps ×1 → ×0.4, at least
  12), after ~4 s faster than 19 ms it steps back up, and a level that was too slow straight after stepping up is not
  tried again. The current level is on the canvas as `data-corona-quality` (0 = best) for browser checks.
  Postcards always render at the best level. Checked only on SwiftShader (≈2 s a frame headless, so it falls to the
  cheapest level); no real-GPU frame time has been measured. The DETAIL slider's second step, `+ 3D CORONA` (setting
  `corona`, toggle CORONA), turns it off, leaving the old glare.
- **Star View.** The hero canvas is a box on the page, so the pass fades the corona to nothing over the outer 16% of
  the canvas (`edgeFade`); the thermal-IR dust haze (12 R☉) no longer shows the canvas outline.
- **Eclipses.** From a surface the corona shows only in totality. On 2017-08-21 the real photograph stays
  (MEASURED); for other eclipses the 3D model on the solar axis replaces the representative 2017 photograph (HUD:
  CORONA: 3D MODEL ON THE SOLAR AXIS (MODELLED, NOT A PHOTO OF THIS ECLIPSE)); with the corona off, the photograph.
  Checked in a browser at 2024-04-08 18:17 UTC from 25.3°N 104.1°W and 2026-08-12 17:46 UTC from 65.2°N 25.2°W (model,
  cut cleanly by the Moon's limb) and 2017-08-21 18:26 UTC from 36.97°N 87.67°W (the photograph, 3D corona hidden).
- **Postcards.** The views' snapshot draw calls the pass with `{ full: true }`, so a postcard carries the corona at the
  best quality level whatever the screen was using, and when the corona is drawn and the Sun is in frame
  (`postcardCorona`, `coronaPostcard`) the provenance line adds 3D CORONA (MODELLED) and CORONA WISPS, CORONA
  BRIGHTNESS (EXAGGERATED) where it is, and CORONA ACTIVE REGIONS (ILLUSTRATIVE) without measured structure (IMAGINED),
  crediting LASCO/AIA when the structure is measured.

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

The standalone builder transcodes local generated map previews and IMAGINED dossier images to quality-80 WebP at existing dimensions. Scientific context images follow the original embedding path, except that any larger than 1,600 px on the long side is capped at 1,600 px (see "Standalone preview", size gate). Registry/normal-build JPEG files and all model/shape GLBs are unchanged; source credits still resolve to the original assets. Combined standalone size is 15.85 MB.

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

## Postcards (#40)

Every 3D view exposes `snapshot(w, h, { labels, base })` built by `src/views/snapshot.js`. In one synchronous task it
sets the renderer to the postcard size (above 1080 px on the short side, a higher pixel ratio rather than a bigger
layout, with `uPixel` point-size uniforms scaled to match), draws, copies the WebGL buffer to a 2D canvas, rasterises
the CSS2D label layer (backgrounds, borders and text from computed styles; `data-snapshot="skip"` leaves an element
out), then restores the screen size. `base: false` gives the label layer alone (TECHNICAL style overlays it).
`src/panels/postcard.js` is the dialog and the frame compositor; `postcard-core.js` holds the DOM-free parts
(sizes, frame layout, provenance line, caption, share links, stylize prompts and cost). `main.js` `describePostcard()`
says what is in frame: the System View's `framed()` lists bodies (not markers) at least 3 px across with their skin map,
live feed, whether the surface is IMAGINED, and the rendered phase (lit fraction and lit side, for the stylize prompt);
COMMS repaints its 2D map (`signalsmap.js` `snapshot()`) and credits the layers shown; `postcardFacts` adds the paleo-Earth banner and scenarios; settings add ENHANCED
sizes, the surface view and NASA's Milky Way artwork. The provenance line and credits are stamped with or without the
frame. AI STYLIZE posts the unlabelled render to `POST /api/stylize` (`server/stylize.js`): JSON only and same-origin
(so a cross-site form cannot spend the key), forwarded to OpenAI's image-edit endpoint with the backend's key, cached
under `data/stylize/` by a hash of image, prompt, size, quality and model.


## Star Trek layer (#25, #41)

Fiction drawn over the real data, never mixed into it: every piece is badged IMAGINED, drawn in its own LCARS
overlay colour (`--trek`, `#ff88aa`; labels italic with a dashed edge, where real labels have a solid left border)
and switched by one shared setting, `starfleet` (default **on**; the STAR TREK LAYER pill in the Navigation,
Quadrant, Galaxy and System panels).

- **Data.** `src/data/trek.js` holds every place in one shape: `id`, `name`, `kind` (homeworld, colony, station,
  starbase, yard, territory, feature, route, sector, quadrant), `views`, `placement`, `confidence` (`canon` on
  screen, `reference` from a licensed book, mostly *Star Trek: Star Charts* 2002, `fan` an approximate spot after
  Star Charts' maps), `source`, `firstAppearance` (series, episode, year; `featured` when it is a defining rather
  than first appearance; `null` plus `appearanceNote` when not checked), our own `summary`, `alternatives`
  (conflicting placements) and a Memory Alpha search link. Placements: a real catalogue star (HYG id, HIP or
  Gliese number, RA/Dec, parallax distance), heliocentric galactic l/b/distance (with a radius for regions), an
  arc, a path, a surface site, or an orbit around a Sol body. `trekApprox` marks everything not pinned to a real
  star as APPROXIMATE. `tests/trek.test.js` checks the data and the canon geometry.
- **Quadrants.** Star Trek's quadrants are lines through the galactic core; as in Star Charts, the Alpha/Beta line
  runs through Sol: Alpha on the side of galactic longitude 180–360°, Beta 0–180°, Gamma beyond Alpha and Delta
  beyond Beta. The Galaxy View draws the cross and the four names (the overlay of #10); the Navigation View draws
  the Alpha/Beta border through Sol towards the core (dashed line and a faint upright curtain, riding with Sol in deep
  time) with ALPHA and BETA labels; the Quadrant View draws it at every range and, at 30 kly, the Gamma/Delta line
  through the core. The IAU galactic quadrants I–IV stay as they were (orange spokes, lilac labels).
- **Navigation View.** Worlds at real stars (Vulcan at 40 Eridani A, Andoria at ε Indi, Tellar at 61 Cygni A, Wolf
  359, Alpha Centauri, Altair VI, Vega colony) attach to the catalogue star already on the chart (`trekStarMatch`: by
  HYG id, then by name) as a pink ring and a label on the star's left; the star's own point, colour and label are
  untouched. They follow their star through deep time.
- **Quadrant View.** Far real stars (Rigel, Deneb IV), approximate homeworlds (Qo'noS, Romulus & Remus, Bajor,
  Cardassia Prime, Ferenginar), DS9, Starbase 375, the Badlands, Briar Patch, Mutara Nebula, Delphic Expanse, the
  Romulan Neutral Zone (a dashed arc) and the Bajoran wormhole's Alpha end, plus the powers' territories as soft
  translucent discs in the plane. Territory labels show within ~2,600 ly of the camera, small places within ~650 ly.
- **Galaxy View.** The Dominion (Gamma) and Borg space (Delta) as soft discs, the Great Barrier round the core and
  the galactic barrier at the rim as dashed rings, the Bajoran wormhole to its Gamma end and Voyager's route home
  (~70,000 ly) as dashed paths, all inside `fleetGroup` so they turn with the Sun's frame in deep time.
- **System View.** `src/views/system/trek.js` hangs the Sol stations (Utopia Planitia Fleet Yards, San Francisco
  Fleet Yards, Earth Spacedock, Earth Station McKinley, Jupiter Station) off their body: a dashed ring at the
  station's height, re-mapped each frame through the radial compression (`localMap`) so it clears the enlarged
  globe, with a marker on the camera's side of the ring (they have no real orbit to follow). Shown around the focused
  body. Surface places (Starfleet HQ & Academy, Utopia Planitia, Tycho City, New Berlin) join the sites layer as the
  `trek` site kind (tier `imagined`; hidden with the layer as well as by their SITES filter). In another star
  system, a world Star Trek puts at one of its stars gets a dashed ring at √L AU (where it would receive Earth's
  sunlight; an assumption, said so on the card).
- **Cards.** `src/panels/trek.js` builds each view's STAR TREK section (toggle and list) and the card: summary,
  first appearance, placement and its source, confidence, APPROXIMATE or AT THE REAL STAR, the real star's own
  distance (the one MEASURED row, labelled as the star's), conflicts, the Memory Alpha link with its CC BY-NC
  credit and the trademark notice. WARP TO opens the real star's System View (`go({ level: 'system', system:
  <HYG id> })`) and pulls back to show the imagined ring. Clicking any pink label opens its card; BACK returns to
  the view's panel (`renderCurrentPanel` in `main.js`). Postcards add STAR TREK OVERLAY to the IMAGINED stamp
  while the layer is on.
- **Licensing.** Star Trek is a trademark of Paramount / CBS Studios. This is a non-commercial fan homage: no
  franchise artwork, logos or text; summaries are original and Memory Alpha is linked, not copied.

## Helm: flying the USS Fidelity (#42)

TAKE THE HELM (system panel, or TAKE THE HELM HERE / SET COURSE in a body panel; H leaves) turns the System
View into a cockpit. `src/views/ship/helm.js` (`createHelm`, made by SystemView with its scene, camera,
OrbitControls, rig and node table) owns the ship's state, input, autopilot, camera, effects and HUD;
`src/views/ship/shipModel.js` builds the ship; `src/astro/warp.js` holds the pure, tested maths
(`tests/warp.test.js`); `src/panels/helm.js` the side-panel sections.

- **The ship** is an original design built in code (IMAGINED, credited to this repo, no GLB): a swept arrowhead
  lifting body (352 m) with a dorsal spine and bridge blister, a ventral keel with an amber deflector ring, and two
  slim nacelles slung below and outboard of the wingtips; red impulse strips, running lights, a registry decal and
  lit windows; ~7k triangles. Metres, nose along −Z, +Y dorsal, +X starboard, scaled to AU at the scene origin.
  `setGlow(k)` brightens and whitens the nacelles and deflector with warp; `setBridge(on)` hides the blister for
  the first-person camera. Craft materials get the studio environment map like mission models.
- **Floating origin on the ship.** The ship's position is kept relative to the nearest body (`anchor`, handed over
  when another is 30% nearer, as FLY does), and every frame SystemView sets `focusPos` to it, so the ship sits at
  the scene origin and the camera within kilometres of it: precise at a station 1 km away and at 40 AU alike. The
  scale is TRUE while at the helm (`scaleMix = 1`, so distances, sizes and the autopilot's standoffs are real);
  `focusId` follows the course target (labels, orbit highlight). The body flights of the panel and route turn into
  a selection (`system.focus` → `helm.select`); a survey, a site view, LOOK AT or standing on a surface takes the
  camera back (`disengage({ quiet })`); leaving the helm otherwise orbits the nearest body from where the camera is
  (`helmHandBack`). Double-click does not land while flying.
- **Views.** CHASE (a lagging third-person camera, wheel to pull back), BRIDGE (first person, LCARS frame and
  reticle, wheel zooms the field), ORBIT (OrbitControls around the ship). Keys 1 / 2 / 3 or V.
- **Flight models.** IMPULSE / WARP: the throttle (W/S or R/F, the slider) runs from FULL STOP through 1 m/s
  (log scale) to full impulse 0.25 c, then warp 1 → 9.99; the speed eases exponentially (so slow frames stay on
  time), and no speed between 0.25 c and c is ever flown: the warp field forms or collapses (flash). Warp follows
  the TNG scale v = w^(10/3) c to warp 9 (≈ 1,516 c), then log-interpolates through the Technical Manual's figures
  (9.6 ≈ 1,909 c, 9.9 ≈ 3,053 c, 9.99 ≈ 7,912 c) towards an unattainable warp 10; on this curve Voyager's quoted
  9.975 comes out near 5,400 c (other quoted figures differ; it is all fiction). REAL PHYSICS:
  Newtonian thrust at 1 / 10 / 100 / 1000 g along the nose, proper velocity integrated so speeds stay below c,
  no warp, under gravity (below). Steering: A/D and ←/→ yaw, ↑/↓ pitch, Q/E roll, drag (CHASE
  and BRIDGE; touch too), Shift faster; X full stop; C set course for the selection; Esc cancels the autopilot.
  Ship motion runs on the wall clock (real seconds); the simulation clock and its rate are untouched, except
  that REAL PHYSICS follows the clock's rate when it runs faster than real time (below).
- **Gravity in REAL PHYSICS** (`src/astro/orbit.js`, pure and tested in `tests/orbit.test.js`). Every star,
  planet, dwarf planet and moon with a known `massKg` (or `massSun`) is a point mass (a uniform sphere inside its
  radius), GM = G·M with G = 6.6743 × 10⁻¹¹ (CODATA 2018), at the app's own positions for the clock time
  (`SystemView` hands the helm `positionAt(id, jd)`, `jd()` and `clockRate()`). The ship moves in the frame of the
  *dominant* body: the smallest Laplace sphere of influence a·(m/M)^0.4 that contains it (`dominantBody`), else
  the star. In that accelerating frame its acceleration is every body's pull minus the frame body's own
  acceleration (the tidal form), so the frame is exact; the bodies are interpolated between their positions at the
  start and end of the frame. Velocity Verlet (`verletStep`), sub-stepped to 1% of the local dynamical time
  √(r³/GM) and 10% of the time to the nearest surface (≤ 60 s, ≤ 4,000 steps a frame; a 1 s headless frame is
  fine). When the frame body changes, the velocity gains the old body's velocity minus the new one's (central
  differences of the ephemeris over ±1 min), so the inertial velocity is continuous. Time: the ship follows the
  clock's rate when it is faster than real time, up to ×10,000 (the HUD says `×1,000 WITH THE CLOCK`, or CAPPED);
  when the clock is held, slower or reversed the ship flies in real time and says so. A swept segment–sphere test
  against every massive body (`segmentHitsSphere`), and a point test against craft, stops the ship at the
  surface: IMPACT, or LANDED at ≤ 10 m/s relative to the body; a burn (W/S) lifts off. Taking the helm in REAL
  PHYSICS, or leaving a held standard orbit, starts a free circular orbit with the same velocity; FULL STOP (X)
  burns to match the dominant body's velocity, after which the ship falls. Clock jumps (scrubbing) are not swept.
- **Read-outs** (HUD): speed (m/s → km/s → c), regime (MANOEUVRING ≤ 100 km/s, IMPULSE, WARP, STANDARD ORBIT,
  STATION-KEEPING), β, warp factor (IMAGINED), γ and the ship clock's rate (COMPUTED; at warp the fiction has no
  dilation), the nearest body and its altitude, the anchor frame, and the autopilot's distance and ETA. In REAL
  PHYSICS: the osculating orbit about the dominant body from the state vector (`stateToElements`: periapsis and
  apoapsis altitude, eccentricity, period, or ESCAPE with e and v∞; COMPUTED), the time rate, and IMPACT / LANDED.
- **Autopilot.** SET COURSE (panel, C, voice) turns the ship, picks a cruise (AUTO: impulse if it gets there in
  ~20 s, else the warp factor that does, up to 9.9; or FULL IMPULSE / WARP 2–9.9 from the CRUISE button), cruises,
  and decelerates in proportion to what is left (v = d / 0.9 s + 0.3 km/s, dropping out of warp at full impulse)
  to an arrival point between the ship and the body: 3 radii for worlds, 5 for stars, 6 (≥ 40 km) for small
  bodies, ≥ 0.6 km from craft. It then holds STANDARD ORBIT about the body's spin axis at the real angular rate
  √(GM/r³) (period shown; the ship keeps its attitude) or STATION-KEEPING (facing the craft). Any manual input takes
  over. Arrival selects the body (route and panel follow).
- **Other stars.** WARP TO A STAR (system panel: the 14 nearest catalogued stars) or FLY THERE AT THE HELM (the
  Navigation View's selected star) turns towards the star's real direction (catalogue J2000 positions → scene axes),
  goes to warp 9.9 for ~3 s and hands the ship to the Navigation View with a course laid in for the star (below);
  arriving there hands it back down, and `helm.onLoad` (called by `SystemView.load`, or by main.js when the system
  is already loaded) drops the ship out of warp at the system's edge, on the side it came from, and sets course for
  the star. A ship flown in by hand keeps its heading and drops to full impulse instead.
- **Between the stars: one ship across the views.** `src/views/ship/shipState.js` holds the one ship: who flies it
  (`frame`: `system`, `deep` or nobody), its heliocentric galactic position in light-years (today's catalogue
  positions; deep time moves the stars, not the ship), its attitude in the galaxy-scale scene axes, speed, flight
  model, view, cruise, SIM, course, and the SHIP'S LOG, distance and clocks (shared with the System View helm, this
  session only). The frame maths (ecliptic ⇄ equatorial ⇄ galactic, scene axes, the attitude rotation between the
  System View's ecliptic axes and the galactic ones) is tested in `tests/shipstate.test.js`. Hand-overs, decided by
  pure functions in `src/views/ship/handover.js` (same tests):
  - *System → Navigation*: past the system's edge (`systemEdgeAU`: 200 AU or 1.15 × the widest survey framing;
    ~300 AU at Sol) and heading out, or after WARP TO A STAR's warp-up. The helm's `handUp` reports the position
    relative to the star, attitude and speed (`deepspace`); main.js converts them (`shipToDeepSpace`: the star's
    galactic position from `solDirection` × `distLy`) and opens Navigation centred on that star.
  - *Navigation → System*: within 0.02 ly (~1,300 AU) of a charted star, or arriving on a course for it (stand-off
    0.01 ly); the star just left only recaptures the ship after it has been 0.03 ly away.
  - *Navigation → Quadrant*: beyond the chart's sensor radius, heading out. *Quadrant → Navigation*: stopped or
    arriving with a charted star within 50 ly (Navigation centred on it, 100 ly range), or closing on Sol within
    50 ly. *Quadrant → Galaxy*: beyond the Quadrant View's radius, heading out. *Galaxy → Quadrant*: within 90% of
    that radius of Sol, closing or stopped. The Quadrant View is Sol-centred only, so far targets (Sgr A*, the
    Magellanic Clouds, the Sagittarius dwarf) are flown and reached in the Galaxy View.
  `src/views/ship/deepHelm.js` (`createDeepHelm`) flies the ship in the Navigation, Quadrant and Galaxy views with
  the System View helm's controls and HUD classes (CHASE / BRIDGE / ORBIT, throttle to warp 9.99, REAL PHYSICS
  without gravity: the Galaxy's pull near the Sun is ~2 × 10⁻¹⁰ m/s²). Each view makes one with its `toScene`
  (galactic ly → its scene: centred on the chart's star, heliocentric, or galactocentric kly), its course targets
  (catalogue stars; Sol, landmark clusters and nebulae; Sol, Sgr A* and the satellite galaxies) and its hand-over
  rule; the view calls `frame()` before rendering and `overlay()` after, and its camera rig is `captured()`.
  Drawing: the chart is rendered from a camera at the ship's position and the 352 m ship is drawn over it in its
  own scene, in metres, from a chase or bridge camera with the same orientation (depth cleared between: no
  light-year depth buffer holds both); in ORBIT the camera circles the ship's position at chart scale and a marker
  (dot, heading line, label) and a dashed course line show it. Double-click drills are off while flying.
  Time out here: warp 9.9 ≈ 3,053 c is 12 hours to Alpha Centauri and 9 years to the galactic centre. The HUD gives
  the real flight time at the chosen warp (FLIGHT ETA) and a SIM speed-up (IMAGINED, a viewing aid: ×1 to 10
  YEARS/S, comma and full stop, or AUTO: the course's flight in ~25 s, else 1 H/S, 1 WEEK/S or 1 YEAR/S by view)
  plays it; the log's ship and Earth clocks count flight time, and the app clock is not moved. The autopilot
  cruises at warp 9.9 (AUTO) or the CRUISE choice and slows in proportion to what is left in watching time.
  Panels (`helmPanel.deepSection`): helm status, FULL STOP / LEAVE HELM, SET COURSE for the selection (Navigation
  star, Quadrant object or Sol, Galaxy targets), HONEST TRAVEL for the rest of the course (or to the selection) and
  the SHIP'S LOG. LEAVE HELM out here parks the ship (nobody flies it) and the view is as before; views are exactly
  as before whenever nobody is at the helm out there. `window.__fidelityShip` exposes the shared state, the
  galaxy-scale helms, the clock and the router for browser checks.
- **Effects** (IMAGINED): a tunnel of additive streaks that rides with the camera along the line of flight (faint
  at high impulse, long and fast at warp), the shell's `#warp` flash on entering warp, and the nacelle glow.
- **Side panel.** Body panels carry HELM / FLY THERE (SET COURSE, live ON COURSE / IN STANDARD ORBIT) and HONEST
  TRAVEL from the ship (or from Earth / the system's star when not flying): distance, light, Voyager-speed chemical,
  Dawn-class ion, Orion nuclear pulse and Starshot (with ship time) as COMPUTED straight-line times, full impulse
  and a 1 g burn-coast-brake rocket with Earth and ship time (COMPUTED), and the quoted warp (IMAGINED). The system
  panel carries the helm status, WARP TO A STAR (with honest travel for the jump) and the SHIP'S LOG (events,
  distance travelled, ship time vs Earth time, places visited; this session only). Postcards badge the ship and the
  warp streaks IMAGINED. `window.__fidelityHelm` exposes the controller for browser checks, like the camera rigs.

A POSTCARD button sits in the top bar (`#postcard-tab` in `index.html`, wired in `main.js`) so a
postcard is always one click away, in any view; the per-view `P` shortcut (3D camera bars and COMMS)
still works. When the current view has no `snapshot` (a map or a list), `open()` says so and does
nothing.

