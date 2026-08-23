# DB migration bench

One Routier store, five storage plugins, the same queries. This is the app behind the
"migrating databases" blog post.

The flow is a journey. Pick a starting database and it gets seeded with faker data
(seeded PRNG, so every run and every database sees identical orders). Then migrate:
every row is selected out of the current database and inserted into the target, and the
same queries run there. Each stop adds a column to the results table, and every stop's
`.explain()` output for the filter query is shown so you can verify the same expression
tree ran everywhere.

Databases: Memory, localStorage, Dexie (IndexedDB), PouchDB (IndexedDB), SQLite (OPFS).

## Run it

1. Build the workspace packages at the repo root: `npm run build`. The app imports the dist
   bundles because the SQLite plugin's OPFS worker is emitted next to them.
2. In this directory: `../../node_modules/.bin/vite build`, then
   `../../node_modules/.bin/vite preview`.
3. Open `http://localhost:5211` and click a starting database, or drive it with query params:
   - `?path=pouchdb,dexie,sqlite,memory&n=25000` runs a whole journey on load.
   - `&skip=update,find` skips ops by substring match on their names.
   - Results land on `window.__JOURNEY__`; the live stores on `window.__STORES__`.

## Gotchas

- **Benchmark with the window visible, or headless.** Chrome throttles occluded windows
  and the timings inflate 5-25x without any error. `scripts/` in the blog workflow ran
  this headless for that reason.
- 25,000 orders serialize to ~7MB, which is over localStorage's 5MB quota — the
  localStorage stop fails with `QuotaExceededError` at that size on purpose. It fits at
  15,000.
- The schema keys are `_id` + `_rev` because PouchDB requires them (the plugin now refuses
  an identity key under any other name instead of corrupting reads).
- Every journey seeds fresh uniquely named databases. The SQLite plugin's OPFS SAH pool
  has a fixed number of file handles, so many runs eventually fail with `SQLITE_CANTOPEN`.
  Clear site data (or OPFS) and rerun.
- Vite minification breaks the compiled schema (generated code calls core helpers by their
  source names), so `build.minify` is off in `vite.config.ts`.

Measured medians live in `results/`.
