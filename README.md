# USS Fidelity

An LCARS-style ship's console for exploring real NASA and astronomical data, from Earth
orbit out to nearby galaxies. It runs locally. Data is loaded on demand and stored on
your machine.

**Status:** System, Star, Planet, Navigation and Galaxy views are online. Every
other view shows an OFFLINE screen that links to its ticket. See [`docs/backlog.md`](docs/backlog.md).

## Run it

Requires Node 20 or newer.

```bash
git clone https://github.com/Lone-Star-Observatories/fidelity && cd fidelity
npm install
npm run build && npm start        # → http://127.0.0.1:4011
# or, while developing:
npm run dev                       # → http://127.0.0.1:5173 (proxies /api to the backend)
npm test                          # orbital mechanics checked against JPL Horizons
npm run build:standalone          # → dist-standalone/fidelity.html, a backend-free preview
```

The first Navigation visit downloads the HYG star catalogue (13.6 MB, once) and the NASA
Exoplanet Archive planet list (cached for a week). Both are stored under `data/`.

| Env var | Default | Purpose |
|---|---|---|
| `FIDELITY_PORT` | `4011` | Backend port (binds to `127.0.0.1` only) |
| `FIDELITY_DATA_DIR` | `./data` | Where on-demand downloads are cached |
| `FIDELITY_CATALOG_DIRS` | — | Folders with catalogs you already have (e.g. `/Volumes/DATA/catalogs`); separate several with `:` |
| `FIDELITY_OPENAI_KEY` (or `OPENAI_API_KEY`) | — | Enables the "Computer" voice (OpenAI Realtime). Held by the backend only; the page never sees it |
| `FIDELITY_REALTIME_MODEL` | `gpt-realtime` | Realtime model for the voice |

Run `npm run catalogs -- /path/to/catalogs` to see which of your downloaded catalogs the
ship recognises and which view will use each one.

## What you can do today

- Fly between the Sun, the eight planets and Pluto, all at their real positions for the
  ship's clock, wearing real spacecraft imagery. Earth has clouds and city lights, and its
  day/night line falls where it really is. Positions come from Keplerian elements offline, or from **JPL Horizons**
  (fetched on demand and cached on disk).
- Run time forwards or backwards (1 hour/s up to 1 year/s), or jump to any date.
- Switch between **ENHANCED** sizes (labelled with how much each body is enlarged) and
  **TRUE** scale.
- Read light-time and distances. Every value carries a provenance badge:
  MEASURED · COMPUTED · MODELLED · IMAGINED.
- The **Sector 001** beacon is always in the top bar; an edge arrow points back to Sol.
- **Navigation:** look outward 10–100 light-years from any star. The chart is in the
  galactic frame with quadrants I–IV, and planet hosts are ringed. Select a star and
  **warp** to it.
- **Binary and multiple stars:** Sirius A and B on their measured 50-year orbit (Sirius B
  as a white dwarf smaller than Earth), α Centauri A and B with Proxima circling the pair.
  Orbits come from the USNO Sixth Orbit Catalog. The nearest brown dwarfs are there too:
  Luhman 16 A and B on their 26.6-year orbit, and WISE 0855−0714, the coldest known (285 K).
- **Star View:** any star's real spectrum type (observed template against its blackbody,
  with Hα, Na D, Ca II and other lines marked) and what it is made of.
- **Moons and small bodies:** 26 moons on orbits checked against JPL Horizons, Ceres, Vesta,
  the dwarf planets, Sedna and Halley's comet, with spacecraft maps where they exist; Moon
  View and Object View for their make-up.
- **Points of interest:** the asteroid belt, Trojans and Kuiper belt from 61,000 real orbits,
  the geostationary ring, Van Allen belts tilted with Earth's magnetic pole, Lagrange points
  (with what is parked there), Hill spheres, the heliosphere and the Oort cloud.
- **Satellites:** all ~16,700 active satellites from CelesTrak, moving by SGP4; fly to any of
  them, read its computed telemetry, and open its live feed where one exists (GOES and
  Himawari full-disk Earth, SDO's Sun, yesterday's Earth from Terra/Aqua/VIIRS, ISS video and
  crew, solar wind and X-rays).
- **Deep-space fleet:** Voyagers, New Horizons, Parker, JWST, Juno, the Mars orbiters and
  more from JPL Horizons, with their trajectories, and NASA DSN Now showing which dish is
  talking to each right now and how fast.
- **Navigation lists:** nearest systems, stars (by class), planets (rocky, temperate, giants…)
  and deep-sky objects, with drill-down from a system to its stars and planets.
- **Star motion and deep time:** arrows showing where every star is heading (relative to us or
  around the galaxy), a clock running up to a million years a second, and the closest future
  passes (α Centauri, Ross 248, Gliese 710).
- **Light-time messages:** send a light pulse from any star to Earth (or from Earth to any star)
  and watch it cross the chart at 1 ly per 10 s, with the year it arrives and the year a reply
  comes back; long trips are counted in human lifetimes.
- **Live skins:** Earth wears yesterday's satellite mosaic with its real clouds, the Sun
  today's SDO image with today's sunspots (toggle LIVE).
- **Quadrant View:** 7,000 Gaia star clusters (coloured by age) and landmark nebulae around
  Sector 001, over the Milky Way's arms.
- **Universe View:** every known galaxy within 36 million ly and 38,000 galaxy groups out to
  2.5 billion ly, with a distance filter.
- **Galaxy View:** the NASA/JPL-Caltech Milky Way artwork laid in the galactic plane and
  calibrated so Sol sits 26.7 kly from Sgr A*, with the brightest catalogue stars at their
  true positions, 55k Gaia stars beyond them, the IAU quadrants and an optional Starfleet
  Alpha–Delta overlay. Galactic time runs from 1 kyr/s to 50 Myr/s: the disc shears, the
  arms turn at their pattern speed, and the Magellanic Clouds (real Spitzer images) and the
  Sagittarius dwarf follow their orbits.
- **Planet View:** any planet's air by volume, where those gases absorb light, its interior
  to scale, and where it sits among rocky, watery and gassy worlds. Exoplanets show measured
  JWST results where they exist and "not yet measured" everywhere else.
- **Other star systems:** Proxima Centauri, TRAPPIST-1, τ Ceti and hundreds more, built
  from the NASA Exoplanet Archive. Transiting planets sit where their transit timings put
  them. Every unknown is badged as such. The sky is the real one as seen from that star.

## Docs

- [`docs/concept.md`](docs/concept.md): the vision, the scale ladder and the decisions so far
- [`docs/data-sources.md`](docs/data-sources.md): which data feeds which view
- [`docs/architecture.md`](docs/architecture.md): how the app is built, and how to add a view
- [`docs/backlog.md`](docs/backlog.md): planned work

MIT licensed (see `LICENSE`). LCARS is a fan homage to the Star Trek: The Next Generation console design. This is a
non-commercial project and is not affiliated with Paramount.
