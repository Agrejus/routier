# DB migration bench

One Routier store, six storage plugins, the same queries. This is the app behind the
"migrating databases" blog post.

The flow is a journey. Pick a starting database and it gets seeded with faker data
(seeded PRNG, so every run and every database sees identical orders). Then migrate:
every row is selected out of the current database and inserted into the target, and the
same queries run there. Each stop adds a column to the results table, and every stop's
`.explain()` output for the filter query is shown so you can verify the same expression
tree ran everywhere.

Databases: Memory, localStorage, Dexie (IndexedDB), PouchDB (IndexedDB), SQLite (OPFS),
PGlite (PostgreSQL in WebAssembly).

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
- **PGlite persists, and a journey cleans up after the one before it.** Its installation is
  ~1,080 files and ~40MB, and `destroy` closes the database without deleting it. A run cannot
  remove its own storage either — the worker's OPFS handles are still held when `destroy`
  returns. So `removeStalePGliteDatabases` runs at the start of each journey and deletes what
  earlier journeys recorded in `localStorage`. Steady state is one installation, not one per
  run.
- The plugin picks the storage: OPFS, or IndexedDB on WebKit, which cannot hold a PostgreSQL
  installation in OPFS. The lab does not choose, so it needs no browser check of its own.
- PGlite's first query pays for booting WebAssembly PostgreSQL, so its seed timing carries
  a fixed startup cost the other engines do not have.
- PGlite logs two handled errors on first use — `extension "vector" is not available` and
  `relation "..." does not exist`. Both are recovered; it reports server errors before the
  client decides what to do with them.
- `vite.config.ts` sets `worker.format: 'es'` for PGlite. Without it the production build
  fails outright on code-splitting.

Every stop reports a **cold start** — opening the engine and answering one statement on an
empty database. It is kept out of the seed timing and out of the totals, because it is paid once
per database rather than per row, and folding a one-off cost into a throughput number hides both.
It is the number that separates the engines most: measured headless, SQLite 121ms against
PGlite 2,249ms, because PGlite builds a PostgreSQL installation where SQLite opens a file.

Measured medians live in `results/`.
