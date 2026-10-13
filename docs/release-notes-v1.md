# USS Fidelity 1.0

An LCARS-style ship's console for exploring real astronomical data, from Earth orbit to the nearby universe.
It runs locally (`npm run build && npm start`, http://127.0.0.1:4011) and as a single-file offline preview
(`npm run build:standalone`). Every value and image is badged MEASURED, COMPUTED, MODELLED or IMAGINED.

## Views
- **Universe → Galaxy → Quadrant → Navigation → System**, with Star, Planet, Moon, Object and Satellite detail views and
  the surface view (stand anywhere, LOOK AT anything). Search, click anything, double-click to drill down.
- **System View:** Kepler or JPL Horizons ephemerides; every active Earth satellite (SGP4); deep-space craft;
  moons, dwarf planets, asteroids and comets; belts, zones and Lagrange points; magnetic fields; eclipses,
  transits and alignments; the DETAIL slider; real relief from measured elevation models; Venus' and Earth's cloud layers
  above a ground you can land on; a ray-marched solar corona.
- **Detail views:** observing data from your location, all-wavelength imagery and archives, spectra, launch windows,
  crew cards, surface sites.
- **Time:** one clock for every view, from −1 Gyr/s to +1 Gyr/s, a timeline of sky events and missions, deep
  time to 10¹⁰⁰ years (Earth Timeline, Future).
- **Spectrum:** an editable transmission curve, from gamma rays to radio, applied to every view, with real maps where
  they exist and predicted looks where they don't, audited per body and band.
- **Fly the USS Fidelity:** impulse, warp and real physics; autopilot and AUTOLAND; relativistic sky; ship's log.
- **COMMS:** SubSpace (radio stations, cameras, live video) and RF (KiwiSDR, WebSDR in-app, your own SDR with
  a waterfall, the Ham It Up converter), and licensed amateur transmission with its safeguards. COMMS keeps playing
  in other views.
- **The Computer:** a wake-word voice that answers about what's on screen, acts, and runs the ship's calculators
  (positions, distances, orbits, transfers, sky events, arithmetic).
- **Postcards**, events feed, future missions, Star Trek layer (IMAGINED).

## Checks
`npm test` (orbital mechanics against JPL Horizons, and the rest of the suite) and `npm run build` pass on `main`.

## Not in 1.0
- The native apps: macOS (#51, shell started in a separate repository) and iOS/iPadOS (#52). They need Xcode and
  App Store accounts and are tracked separately.
- Stated limits per feature are listed in [`backlog.md`](backlog.md).
