# DB migration bench

One Routier store, seven collections, six storage plugins, the same queries. This is the app
behind the "migrating databases" blog post.

The flow is a journey. Pick a starting database and it gets seeded with faker data
(seeded PRNG, so every run and every database sees identical rows). Then migrate:
**every collection** is selected out of the current database and inserted into the target, and
the same queries run there.

The migration names no collection. `ShopStore.all()` exposes `DataStore`'s protected
`collections` map, so `migrate.ts` copies whatever the store happens to hold and picks up a new
collection without being edited. It filters to writable collections: views live in the same map
and a `ReadonlyCollection` has no `addAsync`, so taking everything would fail on the first one.
Identity properties come from each schema's `idProperties` rather than being named, because the
target assigns its own.

The dataset is ~10,000 documents over seven collections — orders, products, customers,
suppliers, invoices, shipments, reviews — split by a fixed share, so any total divides the same
way. The query suite runs against `orders`, which is why it takes the largest share. Each stop adds a column to the results table, and every stop's
`.explain()` output for the filter query is shown so you can verify the same expression
tree ran everywhere.

Databases: Memory, localStorage, Dexie (IndexedDB), PouchDB (IndexedDB), SQLite (OPFS),
PGlite (PostgreSQL in WebAssembly).

The **Query inspector** runs any of its four queries against any engine and shows the plan that
executed, from `.explain()`. It seeds its own small store of orders rather than reading the
migration lab's, so it works on a first visit and is never explaining a plan for rows something
else is still writing.

"Run on every plugin" runs the selected query across all six and keeps each result, so switching
between plugins afterwards is instant and comparing them is a matter of looking. Each tab shows
what that plugin actually sent — which is where the engines stop looking alike:

```
SQLite   SELECT ... FROM (SELECT ... FROM "orders" ORDER BY "createdAt" DESC) AS subquery_1
         LIMIT 25 OFFSET 1000
PGlite   SELECT ... FROM "orders" ORDER BY "createdAt" DESC LIMIT 25 OFFSET 1000
Dexie    orders.toCollection().filter(<predicate>)
Memory   orders: scanned 172 in-memory records
```

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
- localStorage has a ~5MB quota, so a large enough dataset makes that stop fail with
  `QuotaExceededError` on purpose. Splitting the total across seven collections moved the
  threshold: orders are 40% of it now, so 10,000 documents fit where 10,000 orders did not.
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
