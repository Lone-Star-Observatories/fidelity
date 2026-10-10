# CLAUDE.md

Read `docs/architecture.md` first. How we work:

- **Docs are part of every change.** When you add a view, data source or backend route,
  update `docs/data-sources.md`, `docs/architecture.md` and `docs/backlog.md`.
- **Honest and fun.** Every value or visual shown carries a provenance badge
  (`src/data/provenance.js`). Never present IMAGINED content as MEASURED.
- **Local-first.** Browser code calls only `/api/*` or CORS-friendly public APIs. Anything
  else goes through a cached backend route. The backend stays dependency-free and
  bound to loopback.
- **Checks before a PR:** `npm test && npm run build`. Astro math changes need a test
  against JPL Horizons reference values.
- Work on a branch, open a PR into `main` that references the issue (`#N`), squash-merge.
