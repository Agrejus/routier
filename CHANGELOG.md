# Change Log

Hand-written, one section per release, grouped by package with breaking changes first. See
`RELEASING.md` for the procedure.

## Unreleased

Twenty-one defects fixed, recorded as `specs/known-defects.md` #27 through #49, plus the first
CI this repository has had. Every publishable package changed.

Most of these were found by pointing tests at something real for the first time — a MySQL
server, a CouchDB server, three SQL engines answering the same question, and a sync server that
can change its data behind the client's back. None of them were visible to the suites that
existed.

**Suggested version: 0.3.0 across the board.** There are breaking changes below, and on `0.x` a
minor bump is how that is said.

### Breaking

- **`@routier/mysql-plugin`** — `s.number()` now maps to `DOUBLE` instead of `DECIMAL(20, 10)`.
  mysql2 returns DECIMAL as a *string*, so every add failed to match its echo and threw "Cannot
  find internal addition". **A table created by an earlier version still has DECIMAL columns and
  the plugin does not migrate it** — recreate the table or alter the column type.
- **`@routier/mysql-plugin`** — `pool.min` removed from `MysqlDbPluginConfig`. mysql2 has no
  minimum-pool concept and the field was silently discarded.
- **`@routier/mysql-plugin`** — passing both `connectionString` and any discrete connection
  field now throws. There is no correct precedence to guess between them.
- **`@routier/sql-plugin-core`** — `SqlDialect` gains a required `encodeDate`. Custom dialects
  must implement it; pass the value through for engines that accept ISO-8601.
- **`@routier/sql-plugin-core`** — `GroupedUpdateOperation` gains `keyTuples` and
  `ConditionalUpdateOperation` gains `keyTuple`. Consumers building select-back queries should
  use them rather than `ids`, which is only meaningful for single-key schemas.
- **`@routier/pouchdb-plugin`** — `sync()` and every sync callback now take
  `ReadonlySchemaCollection`. The documented call `plugin.sync(store.schemas)` did not compile
  before, because a store exposes the readonly type.
- **`@routier/replication-plugin`** — `HttpSwrDbPlugin` no longer sends `skip`/`take` to the
  server; windows are applied locally. A windowed read now syncs the whole filtered set. Bound
  what you sync with `where(...)`. Use `HttpDbPlugin` directly if you need the server to
  paginate.

### Fixed

**`@routier/sql-plugin-core`** — three silent wrong-row defects (#27, #28, #29). `null == x.prop`
rendered `? IS NULL`, a tautology matching every row. Behind it, a sentinel collision made
`"x" == x.prop` render `prop IS NULL`, dropping the value entirely. And both update builders
matched composite keys on the first component only, so an update overwrote its siblings.

**`@routier/mysql-plugin`** — first execution against a real server, which failed 81 of 86 cases
(#35–#38). DDL ran inside the transaction, and MySQL commits implicitly on DDL, so a failed save
left earlier writes durable. Dates were rejected outright. `undefined` parameters could not be
bound. Booleans came back as 0/1. `count()` after `skip()` returned `[]`. A throwing rollback
leaked a pool connection.

**`@routier/pouchdb-plugin`** — state was module-global, so only the first plugin in a process
could replicate and every database shared one index cache (#39–#43). Replication was wired to a
different database object than the plugin's own reads and writes. `destroy()` left the sync
running. Every added document was requested twice.

**`@routier/dexie-plugin`** — a save spanning two collections was two concurrent transactions, so
it could half-commit (#44–#47). The schema cache was validated by counting entries. There was no
way to evolve a schema; the constructor now takes `{ version }`.

**`@routier/browser-storage-plugin`** — an add-only save from a fresh instance deleted every
previously persisted row (#30). Unparseable values are now reported with the storage key named
and left in place rather than discarded.

**`@routier/sqlite-plugin`** — every query leaked its connection, `BEGIN IMMEDIATE` errors were
discarded so batches ran with no transaction, the DDL cache was shared across files, and an
unopenable file crashed the process while hanging the save (#31–#34).

**`@routier/postgresql-plugin`** — bound parameter values were written to stdout on every
operation. They are row data and are now never logged at any level.

**`@routier/replication-plugin`** — paginated reads with `skip > 0` returned `[]`, and
revalidating one page deleted another page's rows (#48, #49). The background flush now
reconciles the server's echo instead of discarding it.

### Added

- **`@routier/sync-server`** (private) — a server implementing the replication wire contract
  with an admin channel, so a test can change data with the client uninvolved.
- Per-plugin `README.md` stating durability, process/tab boundary, concurrency, migration
  policy, disposal and failure semantics.
- `e2e/src/dialectConformance.test.ts` — one SQL matrix run against SQLite, PostgreSQL and MySQL.
- `e2e/src/swrServerToClient.test.ts`, `e2e/src/mysqlContainer.test.ts`,
  `e2e/src/couchdbReplication.test.ts`.
- GitHub Actions CI, and `npm run typecheck` / `npm run test` / `npm run release:pack-check`.

### Changed

- Licensing reconciled to MIT everywhere; root `package.json` said ISC.
- All ten plugin rspack configs use `builtin:swc-loader`; `ts-loader` needed webpack as a peer
  and made a clean-workspace build fail.
- Every package declares `files` and ships a real `LICENSE`. Five were publishing `src/` and
  tests.
- Benchmark baseline re-recorded — see `benchmark/README.md` for the regression it absorbs.
- Stress memory scenarios measure retained heap after a forced collection. Run with
  `NODE_OPTIONS=--expose-gc` or the assertion is skipped.

### Removed

- `plugins/chrome-extension` — held one orphaned jest config and no implementation.
- `lerna.json` — configured a release process that did not exist. See `RELEASING.md`.

## 0.0.1-alpha.1 (2025-09-18)

Generated by lerna. Version bump only for package routier-collection.
