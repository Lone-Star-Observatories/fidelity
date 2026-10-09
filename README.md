# USS Fidelity

An LCARS-style ship's console for exploring real NASA and astronomical data, from Earth
orbit out to nearby galaxies. It runs locally. Data is loaded on demand and stored on
your machine.

**Status:** System View for Sector 001 (Sol) is online. Every other view shows an OFFLINE
screen that links to its ticket. See [`docs/backlog.md`](docs/backlog.md).

## Run it

Requires Node 20 or newer.

```bash
git clone https://github.com/Lone-Star-Observatories/fidelity && cd fidelity
npm install
npm run build && npm start        # → http://127.0.0.1:4011
# or, while developing:
npm run dev                       # → http://127.0.0.1:5173 (proxies /api to the backend)
npm test                          # orbital mechanics checked against JPL Horizons
```

| Env var | Default | Purpose |
|---|---|---|
| `FIDELITY_PORT` | `4011` | Backend port (binds to `127.0.0.1` only) |
| `FIDELITY_DATA_DIR` | `./data` | Where on-demand downloads are cached |
| `FIDELITY_CATALOG_DIRS` | — | Folders with catalogs you already have (e.g. `/Volumes/DATA/catalogs`); separate several with `:` |

Run `npm run catalogs -- /path/to/catalogs` to see which of your downloaded catalogs the
ship recognises and which view will use each one.

## What you can do today

- Fly between the Sun, the eight planets and Pluto, all at their real positions for the
  ship's clock. Positions come from Keplerian elements offline, or from **JPL Horizons**
  (fetched on demand and cached on disk).
- Run time forwards or backwards (1 hour/s up to 1 year/s), or jump to any date.
- Switch between **ENHANCED** sizes (labelled with how much each body is enlarged) and
  **TRUE** scale.
- Read light-time and distances. Every value carries a provenance badge:
  MEASURED · COMPUTED · MODELLED · IMAGINED.
- The **Sector 001** beacon is always in the top bar; an edge arrow points back to Sol.

## Docs

- [`docs/concept.md`](docs/concept.md): the vision, the scale ladder and the decisions so far
- [`docs/data-sources.md`](docs/data-sources.md): which data feeds which view
- [`docs/architecture.md`](docs/architecture.md): how the app is built, and how to add a view
- [`docs/backlog.md`](docs/backlog.md): planned work

MIT licensed (see `LICENSE`). LCARS is a fan homage to the Star Trek: The Next Generation console design. This is a
non-commercial project and is not affiliated with Paramount.
