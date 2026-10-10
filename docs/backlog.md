# Backlog

Tracked as GitHub issues in this repo. This file mirrors the plan.

| # | Item | Scope |
|---|---|---|
| 1 | **Sol System View + Sector 001 beacon** | The engine (floating origin, log depth, warp flights), real planet positions (Kepler offline + JPL Horizons), ship's clock, ENHANCED/TRUE scale, provenance badges, LCARS shell, routes, local backend and disk cache, RAID catalog scanner. |
| 2 | ✅ **Navigation View** | Done. Stars within 10–100 ly of any star (HYG v4.4, downloaded on demand), planet hosts ringed (NASA Exoplanet Archive), galactic-plane chart with quadrants I–IV, Sector 001 always marked. Selecting a star warps into a System View built from archive data, with every value badged, a real sky from that star, and an arrow back to Sol. |
| 3 | **Earth neighbourhood: Satellite + Object views** | CelesTrak GP + SGP4 (the ISS, the GEO ring), Van Allen belts (MODELLED), magnetopause driven by live solar wind (linked to the solar weather app), Hill spheres and Lagrange points, asteroid/Kuiper belt samples, planetary rings, the Oort cloud shell (MODELLED). |
| 4 | ✅ **Quadrant → Universe** (Galaxy done in #10) | Galactic quadrants I–IV plus the Starfleet overlay (IMAGINED), tiled Gaia density, clusters and nebulae; Milky Way model with Sector 001; nearby galaxies with a distance filter (NED/Cosmicflows-4). |

| 6 | ✅ **Realistic skins** | Spacecraft mosaics for every Sol body, Earth's clouds and city lights, real rotation phase, recoloured photospheres for stars, analog skins for exoplanets. Credits shown. |
| 7 | ✅ **Binary and multiple stars** | ORB6 orbits in true 3D, barycentric motion, measured masses (Sirius B as a white dwarf, α Cen A+B with Proxima around the pair), planets riding with their host star. |
| 8 | ✅ **Star View** | Close-up photosphere, observed template spectrum (Pickles) against the blackbody with line IDs and an infrared range, composition by mass (Asplund 2009 for the Sun, [Fe/H]-scaled otherwise), white dwarfs handled. |
| 9 | ✅ **Planet View** | Globe, atmosphere by volume (Sol) or measured JWST detections (exoplanets), spectral fingerprints, interior to scale, density on the mass–radius diagram with minimum-mass and unmeasured-radius caveats. |
| 10 | ✅ **Galaxy View** | NASA/JPL-Caltech face-on Milky Way (IMAGINED artwork), calibrated so Sol lands at R₀ = 26.7 kly and the 46k brightest catalogue stars within 1.5 kly sit at their true galactic positions; arms, Sgr A*, satellite galaxies, IAU quadrants and the optional Starfleet overlay. |
| 11 | ✅ **Moons, dwarf planets, asteroids** | 26 moons (JPL elements, Horizons-fitted, tested) and 13 small bodies (SBDB) with real mosaics where they exist; Moon View and Object View (the Planet View fed with moon data). |
| 12 | ✅ **Points of interest** | Belts from 61k real orbits (GPU-propagated), GEO ring, Van Allen belts, Lagrange points, Hill spheres, heliosphere, Oort cloud. |
| 13 | ✅ **Every active Earth satellite** | CelesTrak + SGP4, travel to any satellite, live feeds and telemetry. |
| 14 | ✅ **Deep-space spacecraft** | Horizons fleet with DSN Now link status. |
| 15 | ✅ **Navigation filters** | List and drill into nearest systems, stars, planets, nebulae. |
| 16 | ✅ **Message light-time** | A light pulse to Earth and back, arrival and reply years, lifetimes beyond 75 ly. |
| 17 | ✅ **Live skins** | Today's Sun (SDO) and Earth (GIBS); honest Moon. |
| 19 | **Realism pass** | Comet tails, ~~surface view on double-click~~ (done), real shapes, spin axes and wobble, magnetospheres, the Sun's field and heliosphere asymmetry, explainers. |
| 18 | ✅ **Galaxy motion & images** | Spitzer images of the Magellanic Clouds at their real sizes; galactic time from 1 kyr/s to 50 Myr/s over ±2 Gyr (differential rotation, arm pattern speed, the Sun's frame); satellite-galaxy orbits integrated in a halo; Local Group vs CMB and Andromeda arrows in the Universe View; 55k Gaia DR3 stars beyond 1.5 kly. |
| 20 | ✅ **Star motions** | Navigation View velocity arrows (Sun-relative and galactocentric) and deep-time steps. |
| 21 | **Voice: "Computer"** | Local wake word, ChatGPT voice through a backend relay (key stays local), spoken answers about what's on screen. |
| 22 | **3D Milky Way** | Volumetric bulge, bar, disks, arms and dust instead of the flat image; fainter under the stars. |
| 23 | **Click anything, double-click to drill down** | Every star investigable; click highlights (orbits too); double-click drills down to the surface view (done in the System and Planet views). |
| 24 | **3D nebulae and clusters** | Best-effort 3D nebula models with real imagery; clusters drawn from their Gaia members; major stars in nebulae investigable. |
| 25 | **Star Trek layer** | Alpha–Delta quadrants always on; canonical planets at their real stars (IMAGINED). |
| 26 | **Satellite detail & feeds** | UCS database detail for every satellite, clear feed status, trajectory-end markers. |
| 27 | **UI polish** | Thicker orbits, wider resizable panel, legend spacing, Horizons on by default. |
| 28 | **Spectral filtering** | Filter every view by band (full, radio, microwave, IR, visible, UV, X-ray, gamma) then common bandpass. Per body and band: real image if one exists, else a predicted skin (best image convolved with the expected spectral response), else "not observed". |
| 29 | **Deep-time arrivals** | Load and integrate stars well beyond the view radius (prefer Gaia DR3 velocities) so stars that move into the neighbourhood appear as today's neighbours disperse; badge catalogue completeness. |
| 30 | **Eclipses, transits, alignments** | Solar eclipse umbra/penumbra on Earth, lunar eclipses, transits, occultations, conjunctions; validated against the Five Millennium Canon. |
| 31 | **Corona easter egg** | Real totality photograph of the corona in the surface view inside the umbra. |
| 32 | **Events feed** | Self-hosted `/events` service (computed + launches), cached by `/api/events`, offline fallback. |
| 33 | **Notable events button** | List upcoming events; click to jump the clock and fly to the best view. |
| 34 | **Unified time control** | One time control on its own bottom row, live to Gyr/s, replacing the per-view deep/galactic time. |
| 35 | **COMMS and live-signals map** | COMMS section for anything with live links (DSN, SatNOGS, ISS video/ham, Moon and Mars telemetry); Earth map of radio stations, SDR receivers, webcams and traffic cams. |
| 36 | **From the surface** | Planet/Moon/Object views show real landed imagery (Apollo, Mars rovers, Venera, Huygens, Hayabusa…) or a generated landscape badged IMAGINED. |
| 37 | **Surface sites of note** | Apollo, Luna, Chang'e, Mars rover traverses, Venera, Huygens, small-body touchdowns; candidate/planned sites badged; Starman's Tesla Roadster (Horizons −143205) in orbit. |
| 38 | **Magnetic fields** | Toggleable field lines, magnetopauses and bow shocks for the Sun, Earth, giants, Mercury, Ganymede; crustal fields of Mars and the Moon. |
| 39 | **Framing and camera** | Fill view, fullscreen, zoom controls with real-unit readouts, orbit / free look / free fly modes, saved viewpoints. |
| 40 | **Postcards** | Capture the view as an LCARS-framed image with provenance and credits; save or share to socials. |
| 41 | **Star Trek universe objects** | Shipyards (Utopia Planitia), starbases (Spacedock, DS9), sector numbers, territories, Neutral Zone, wormhole, canon homeworlds at real stars (Vulcan at 40 Eridani A); all IMAGINED and toggleable. |
| 42 | **Fly the USS Fidelity** | Original pilotable ship model; thrusters, impulse, warp (TNG scale, IMAGINED); autopilot to any object; chase and bridge cameras; real-travel-time panel (light, chemical, ion, light sail, time dilation). |
| 43 | **Look at** | View any body from any other (surface or orbit) at true apparent size and phase, light-time corrected, with zoom from naked eye to telescope. |
| 44 | **Future missions** | Confirmed, planned and proposed missions (Dragonfly, MMX, EnVision, Uranus Orbiter…) with tiered badges, cards and ghost trajectories. |
| 45 | **Launch windows and trajectories** | Lambert solver, porkchop plots (C3, v∞, Δv), next windows for every Solar System target, transfer arcs drawn in the System View. |

Candidates not yet scheduled (to be prioritised): Earthprise layers on Earth (GIBS), and a catalog ingestion/tiling pipeline for the
RAID datasets. Gaia DR3 neighbours (the faint red and brown dwarfs HYG misses) would complete the Navigation View; the two nearest brown-dwarf systems (Luhman 16, WISE 0855) are already bundled.

Asset production queue: see [assets.md](assets.md). First local mission-model batch
covers ten craft (nine GLBs). Remaining craft, shape reconstructions and imagery are
still pending; physical body-frame and dimension calibration remains required.

### Visual assets progress — 2026-10-10, second batch

Delivered 15 additional NASA craft/class files, 5 PDS shapes with preview LODs and 8 generated exoplanet class skins. Mission IDs/NORAD aliases and focused shapes are connected to the viewer; standalone includes shape/texture previews. Still open: physical calibration and albedo registration, generic-class catalogue matching, OSIRIS geometry budget, Tiangong/New Horizons/Gaia/Euclid/JUICE and remaining craft, Deimos/Arrokoth/Haumea/Vesta/Ceres shapes, actual map upgrades, brown dwarfs and scene art. Detailed progress and limits: `docs/assets.md`.
