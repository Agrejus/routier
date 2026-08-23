# PGlite Console

PostgreSQL, compiled to WebAssembly, running in a browser tab and persisted to OPFS. The
smallest application that proves `@routier/pglite-plugin` works end to end.

## Run it

The example resolves the plugin from `dist`, not from source. Build the repository first.

1. Build the packages.

   ```bash
   npm run build
   ```

2. Start the example.

   ```bash
   node_modules/.bin/vite examples/pglite-console
   ```

3. Open http://localhost:5220.

Seed some rows, then press **Reload page**. The banner reports how many rows survived. They came
out of OPFS, written by the previous page load.

## What it shows

| Button | What it proves |
| --- | --- |
| Seed 5 | Writes commit, and the table is created lazily on first use |
| Raise prices 10% | Change tracking produces an `UPDATE`, not a rewrite |
| Query JSONB + column | A filter reaching into a nested JSONB column runs in PostgreSQL |
| Count + sum | Aggregates run in the database |
| Reload page | Data persists across a new page, worker and WASM instance |

## Two things a consumer has to get right

**`worker: { format: 'es' }` in `vite.config.ts` is required.** Vite bundles the worker behind
`new Worker(new URL(...))`, and its default worker format is `iife`, which cannot code-split.
PGlite reaches its filesystems through dynamic imports, so without this the build fails with
"UMD and IIFE output formats are not supported for code-splitting builds".

**PGlite and the Routier packages must be excluded from dependency pre-bundling.** esbuild
rewrites module URLs, which breaks both the worker URL and PGlite's own `.wasm` and `.data`
lookups. See `optimizeDeps.exclude` in `vite.config.ts`.

## Expected console noise

Two handled failures are logged by PGlite from inside the worker on first use:

- `extension "vector" is not available` — the pgvector probe. The plugin falls back to storing
  embeddings as JSONB, which is the documented behaviour.
- `relation "products" does not exist` — the lazy `CREATE TABLE` miss. The plugin creates the
  table and retries.

Both are recovered. They are noisy because PGlite reports every server error to the console
before the client decides what to do with it.

## Known defects this example works around

Neither is a PGlite defect. Both reproduce on `main` with `@routier/postgresql-plugin` against a
real PostgreSQL server, and both pass on SQLite — which stores JSON as text and round-trips
dates unchanged, so it forgives them.

- **An identity key with a `s.date()` property fails to save.** The echoed row cannot be matched
  back to the tracked entity, because `TIMESTAMP` returns shifted into local time. The schema
  here has no date; use an explicit key if you need one.
- **`arrayColumn.includes(value)` produces invalid SQL.** `includes` is rendered as a string
  `LIKE` by `@routier/sql-plugin-core`, so against a JSONB array PostgreSQL answers
  `operator does not exist: jsonb ~~ text`. The example filters on a nested object property and
  a plain column instead.
