# Plugin Production-Readiness Audit

## Scope

This audit covers every directory under `plugins/` except `plugins/replication`:

- `browser-storage`
- `chrome-extension`
- `dexie`
- `file-system`
- `memory`
- `mysql`
- `postgresql`
- `pouchdb`
- `sql-core`
- `sqlite`

The review included implementation code, tests, package metadata, build/typecheck/lint scripts, repository E2E coverage, and the documented framework-wide defects. This was an evaluation only; no plugin source files were changed as part of the audit.

## Executive summary

None of the persistent plugins should currently be advertised as unconditionally production-ready.

- **Memory** is suitable for its explicitly ephemeral/test-oriented role.
- **File system** is usable only for controlled, single-process workloads where a JSON-file store is acceptable.
- **PostgreSQL** is the closest persistent/server plugin to production use, but still needs release hardening and shared SQL correctness fixes.
- **SQLite** is promising but has connection-lifecycle, cache-scoping, transaction-start, and shared SQL issues.
- **Dexie** needs atomicity and schema-evolution work.
- **Browser storage**, **MySQL**, and **PouchDB** have correctness or lifecycle problems that should block production endorsement.
- **SQL core** has shared bugs that affect SQLite, PostgreSQL, and MySQL.
- **Chrome extension** is not a plugin implementation at all; its directory contains only Jest configuration.

### Readiness matrix

| Plugin | Verdict | Summary |
|---|---|---|
| Memory | Ready for intended ephemeral use | Correctly scoped for tests, demos, and process-local transient data; not durable storage. |
| File system | Conditional / limited production use | Single-process only, whole-file rewrites, and no cross-process coherence. |
| Browser storage | Not production-ready | Add-only saves can overwrite previously persisted records because fresh collections are not hydrated first. |
| Dexie | Not production-ready | Multi-schema saves are not one transaction; fixed schema version and cache behavior do not support safe schema evolution. |
| SQLite | Needs fixes | Query connections leak, transaction-start errors are ignored, and schema cache is globally mis-scoped. |
| PostgreSQL | Beta / closest to ready | Real-server behavior passed, but test lifecycle hangs, SQL parameters are logged, and shared SQL limitations remain. |
| MySQL | Not production-ready | No real-server validation, ignored config fields, no optimistic-concurrency path, and composite-key assumptions. |
| PouchDB | Not production-ready | Global cross-database state, sync lifecycle leaks, duplicate ID handling, and possible double callbacks. |
| SQL core | Not production-ready as a shared foundation | Incorrect reversed-null SQL and single-ID update generation can produce wrong behavior. |
| Chrome extension | Not implemented | No package manifest or source implementation. |

## Highest-priority findings

### Critical: browser-storage can lose existing rows on a later add

`BrowserStoragePlugin.resolveCollection()` creates a new in-memory collection on every operation (`plugins/browser-storage/src/BrowserStoragePlugin.ts:16-18`). `EphemeralDataPlugin` loads storage only when a batch has updates or removes, not for an add-only batch (`core/src/plugins/EphemeralDataPlugin.ts:110-125`). The collection then serializes its current in-memory records over the complete storage value (`plugins/browser-storage/src/BrowserStorageCollection.ts:60-65`).

Consequently, an add-only save performed by a fresh plugin/store instance can start from an empty collection and replace previously persisted data with only the new rows. Multiple tabs or store instances can also race as independent read-modify-write owners.

**Required fix:** hydrate before every operation that rewrites the complete collection, then serialize mutations per storage key. For multi-tab use, add a revision/CAS strategy or explicitly state that concurrent writers are unsupported.

### High: shared SQL update generation assumes one ID column

Both conditional and grouped updates use only `schema.idProperties[0]`:

- `plugins/sql-core/src/updates.ts:55-59`, `85-87`
- `plugins/sql-core/src/updates.ts:128-132`, `176-199`

This means updates to schemas with composite keys can match the wrong rows. The grouped `CASE` expression and final `IN` predicate are both based solely on the first key column. MySQL select-back after updates repeats the same assumption (`plugins/mysql/src/MysqlDbPlugin.ts:139-140`, `152-159`).

This affects SQLite, PostgreSQL, and MySQL because they consume the shared builders.

**Required fix:** generate tuple-aware predicates for all identity columns, add collision tests where rows share the first key component, and ensure update echo/select-back uses the same complete key.

### High: reversed null comparisons generate incorrect SQL

For an expression shaped like `null == entity.property`, SQL core renders a placeholder null test rather than a column null test (`plugins/sql-core/src/sql.ts:257-260`). The result is equivalent to `NULL IS NULL`, which is true independently of the row, instead of `column IS NULL`.

**Required fix:** normalize property/value operand order before rendering, or make the right-column null strategy render the quoted column. Add positive, negated, and all-dialect tests.

### High: PouchDB state is global rather than database-scoped

PouchDB declares a module-global queue and cache (`plugins/pouchdb/src/PouchDbPlugin.ts:11-13`). Sync is stored under the single key `"sync"` (`plugins/pouchdb/src/PouchDbPlugin.ts:68-109`), so only the first plugin/database can establish sync in a process. Other index/cache entries and every PouchDB operation also share process-global coordination.

There is no retained sync handle lifecycle that is cancelled during destroy. This can leak replication activity and couple unrelated databases.

**Required fix:** make queue, index cache, and sync handle instance- or database-scoped; cancel sync and close retained databases during disposal/destroy.

### High: SQLite query connections are normally never closed

`_doQueryWork` creates a new `sqlite3.Database` for every query, while `shouldClose` defaults to `false` (`plugins/sqlite/src/SqliteDbPlugin.ts:255-260`). Every normal success and error branch therefore leaves the connection open (`plugins/sqlite/src/SqliteDbPlugin.ts:264-293`). `destroy()` opens and closes a new connection; it does not close earlier query connections (`plugins/sqlite/src/SqliteDbPlugin.ts:49-67`).

**Required fix:** either maintain one owned connection and expose explicit disposal, or close each per-operation connection on all paths.

## Per-plugin evaluation

### Memory

**Verdict: ready for intended ephemeral use.**

The process-global registry is keyed by database name (`plugins/memory/src/MemoryPlugin.ts:7-16`), and collections are shared by database and collection name (`plugins/memory/src/MemoryPlugin.ts:29-40`). That behavior is useful for multiple stores intentionally targeting the same in-process database.

Caveats:

- Data is process-local and non-durable by design.
- The default database name means separately created default instances share state.
- `destroy()` clears the shared named database for every user of that name (`plugins/memory/src/MemoryPlugin.ts:56-59`).

This is acceptable if documented as part of the plugin's contract.

### File system

**Verdict: conditional; suitable only for controlled single-process use.**

The implementation clearly documents its boundary: the in-memory registry is authoritative after first access and writes from another process are never observed (`plugins/file-system/src/FileSystemPlugin.ts:8-23`). The registry is correctly keyed by resolved database path and collection (`plugins/file-system/src/FileSystemPlugin.ts:43-59`), and destructive path validation is a good safeguard (`plugins/file-system/src/FileSystemPlugin.ts:62-89`).

Remaining limitations:

- Whole collections are rewritten as JSON.
- There is no cross-process lock or refresh protocol.
- A crash during replacement needs explicit durability guarantees (temporary file, fsync, atomic rename) before this is suitable for important data.
- The process-global collection registry needs cleanup on destroy to avoid stale in-memory state if the same path is recreated.

Use it for local tools, small datasets, and single-process deployments—not as a general database.

### Browser storage

**Verdict: not production-ready.**

The add-only lost-update defect described above is a release blocker. In addition:

- Every save rewrites the whole collection (`plugins/browser-storage/src/BrowserStorageCollection.ts:60-65`).
- There is no multi-tab writer coordination.
- JSON parse failure makes the collection unusable without a recovery policy (`plugins/browser-storage/src/BrowserStorageCollection.ts:38-56`).
- Browser storage quota and synchronous `localStorage` behavior need explicit handling and documentation.

### Dexie

**Verdict: not production-ready without atomicity and migration work.**

Findings:

1. Every operation opens a fresh Dexie instance and hardcodes `version(1)` (`plugins/dexie/src/DexiePlugin.ts:21-27`). There is no schema migration/version strategy.
2. Schema cache reuse is based partly on collection count, not a schema fingerprint (`plugins/dexie/src/DexiePlugin.ts:165-188`). A changed index definition or a different same-sized schema can reuse stale metadata.
3. A bulk persist launches independent operations and waits with `Promise.all` (`plugins/dexie/src/DexiePlugin.ts:56-162`). It is not one transaction spanning all affected tables, so a later failure can leave earlier changes committed.
4. Some identity-add paths are awaited immediately while others are queued, making partial-commit behavior even less uniform (`plugins/dexie/src/DexiePlugin.ts:104-153`).
5. There is no visible optimistic-concurrency enforcement comparable to SQLite/PostgreSQL.
6. `_doWork` does not close the database when synchronous setup/work throws (`plugins/dexie/src/DexiePlugin.ts:28-39`).

**Required fix:** one Dexie transaction covering every affected table, a schema fingerprint and version-upgrade contract, conflict tests, and lifecycle cleanup on every path.

### SQLite

**Verdict: needs fixes before production endorsement.**

Positive points include transactional bulk persistence, JSON-column decoding, and dedicated optimistic-concurrency tests.

Blockers and risks:

- Per-query connections remain open by default, as described above.
- `BEGIN IMMEDIATE TRANSACTION` is issued without a callback and its error is ignored (`plugins/sqlite/src/SqliteDbPlugin.ts:142-149`); later operations can run after a failed begin.
- The module-global table cache is keyed only by collection name (`plugins/sqlite/src/SqliteDbPlugin.ts:12`, `22-25`, `93-103`). Different files or schemas sharing a collection name can receive stale DDL.
- `destroy()` only closes a newly opened connection and then unlinks the file; it does not own or close outstanding connections.
- Composite-key updates inherit the shared SQL defect.
- Automatic `CREATE TABLE IF NOT EXISTS` is initialization, not schema migration; changed schemas are not reconciled.

### PostgreSQL

**Verdict: beta; closest persistent plugin to production readiness, but not release-ready.**

The real PostgreSQL container suite reported all 13 tests passing, which gives this plugin the strongest backend evidence in the audit. The plugin also installs pool error handling and releases checked-out clients on the reviewed query paths.

Remaining concerns:

- The container Jest process did not exit after the 13 passing tests and timed out after five minutes. This appears likely to be undisposed stores/pools in test setup, but it is still a release-gate failure and lifecycle ownership needs to be made unambiguous.
- SQL and complete parameter arrays are logged unconditionally (`plugins/postgresql/src/PostgresDbPlugin.ts:176-183`, `369-375`, `387-391`). Parameters can contain personal data, credentials, or secrets. Logging should be opt-in and redact values by default.
- Composite-key updates inherit the shared SQL defect.
- Runtime table creation does not provide schema migrations.
- More failure-path integration tests are needed: rollback, disconnect during transaction, pool exhaustion, duplicate keys, and concurrency conflicts on a real server.

The hanging test process should be fixed by disposing every created store/pool in `afterEach`/`afterAll`, then verified with Jest open-handle detection.

### MySQL

**Verdict: not production-ready.**

Findings:

- `connectionString` and pool `min` are exposed in configuration but ignored by pool construction (`plugins/mysql/src/MysqlDbPlugin.ts:10-19`, `27-36`).
- There is no MySQL real-server/container integration suite comparable to PostgreSQL.
- There is no visible conditional optimistic-concurrency update path; only SQLite and PostgreSQL use the shared conditional update builder.
- Update/select-back logic assumes the first identity column (`plugins/mysql/src/MysqlDbPlugin.ts:139-140`, `152-159`).
- Table creation occurs after beginning a transaction (`plugins/mysql/src/MysqlDbPlugin.ts:101-117`). MySQL DDL can implicitly commit, so first-use persistence is not guaranteed to be atomic as the surrounding code suggests.
- Auto-increment select-back assumes a consecutive ID block (`plugins/mysql/src/MysqlDbPlugin.ts:170-175`), which needs real-server validation under the supported MySQL configurations.
- Schema migration behavior is undefined.

Before release, add a container test matrix, honor or remove every public config option, implement concurrency semantics, and separate schema initialization/migration from data transactions.

### PouchDB

**Verdict: not production-ready.**

In addition to global cache/sync state:

- `_doWork` defaults to leaving databases open; when `shouldClose` is true, it can invoke `done` once from `db.close` and again immediately (`plugins/pouchdb/src/PouchDbPlugin.ts:664-675`). This is a concrete double-callback bug.
- `destroy()` explicitly requests `shouldClose: false` (`plugins/pouchdb/src/PouchDbPlugin.ts:678-689`).
- Add response IDs are initialized from every response and then successful IDs are pushed a second time (`plugins/pouchdb/src/PouchDbPlugin.ts:222-237`), potentially causing duplicate bulk-get requests/results.
- One module-global synchronous queue serializes unrelated databases (`plugins/pouchdb/src/PouchDbPlugin.ts:11`, `693-712`). A stalled operation can block all PouchDB plugin instances.
- The sync handle is not cancelled on destroy.
- The public option/auth/header behavior needs real CouchDB replication tests rather than only local mocks.

### SQL core

**Verdict: needs correctness fixes before downstream SQL plugins can be production-ready.**

The reversed-null and composite-key update defects are shared release blockers. SQL core also needs a dialect conformance suite that runs generated statements against real SQLite, PostgreSQL, and MySQL engines—not only string snapshots/unit tests.

Recommended coverage:

- Both operand orders for every comparator.
- Null and negated-null semantics.
- Composite primary keys for add, update, remove, select-back, and concurrency checks.
- Renamed columns and nested JSON values.
- Empty and mixed update deltas.
- Dialect-specific quoting and placeholders.

### Chrome extension

**Verdict: not implemented.**

`plugins/chrome-extension` contains only `jest.config.js`. It has no `package.json`, source entry point, implementation, tests, or distributable artifact. It should either be implemented, moved to a placeholder/examples area, or removed from the plugin inventory to avoid implying support.

## Validation performed

- All plugin lint commands passed.
- TypeScript checks initially failed for file-system, MySQL, PostgreSQL, and SQLite because dependent workspace declaration output was stale or missing. After rebuilding `core` and `sql-core` declarations, all plugin typechecks passed.
- The plugin Jest project passed. However, project-level selection also included replication tests, so this result is not a clean per-plugin coverage signal.
- Standard SQLite persistence/JSON E2E tests passed.
- The real PostgreSQL container tests reported **13 passing tests**, but Jest did not exit and the command timed out after five minutes due to an open asynchronous resource.
- Bundle builds for the audited plugins are currently blocked: their Rspack configurations use `ts-loader`, which requires an uninstalled `webpack` module. This is repository-wide release tooling debt rather than proof of a runtime defect, but packages cannot be considered releasable while their declared build command fails.
- No real MySQL server validation was found or completed.

## Packaging and documentation

Packaging is not release-ready across the plugin set:

- Only PouchDB currently has a plugin README in its directory.
- Several `package.json` files reference `README.md` and/or `LICENSE` in `files`, but those files do not exist in the package directory.
- Browser storage, MySQL, PostgreSQL, SQL core, and SQLite have no explicit `files` allowlist.
- Package behavior, lifecycle/disposal requirements, concurrency guarantees, migration policy, supported engine versions, and failure semantics are generally undocumented.
- `pouchdb` has inconsistent build scripts: `build` runs only `tsc`, while `build2` runs bundle plus declarations.

A release check should run `npm pack --dry-run` for every package and verify only intended artifacts, README, license, declarations, and source maps are present.

## Framework-wide blockers

Plugin-local fixes alone do not establish end-to-end production readiness. The repository's documented core/datastore issues can affect every backend, including:

- deep nested enrichment corruption;
- nested mutations that are not tracked and can be silently lost;
- pipeline paths that can hang.

These should remain explicit global release blockers unless the supported production subset excludes the affected features and documents that exclusion.

## Recommended remediation order

1. **Fix shared SQL correctness:** reversed-null comparisons and composite-key updates/select-back.
2. **Fix browser-storage data loss:** hydrate and serialize every whole-collection rewrite.
3. **Fix lifecycle leaks:** SQLite connections, PouchDB handles/sync, and PostgreSQL test pool disposal.
4. **Fix PouchDB isolation and callbacks:** scope all state by database/instance, eliminate duplicate IDs and double callbacks, cancel sync.
5. **Make Dexie writes atomic:** one multi-table transaction and a real schema-version/migration design.
6. **Harden MySQL:** real container tests, config correctness, transaction/DDL separation, and optimistic concurrency.
7. **Repair release tooling:** remove the `ts-loader`/Webpack mismatch, run package builds and `npm pack --dry-run` in CI.
8. **Add package documentation:** lifecycle, durability, concurrency, migration, environment, and supported-use boundaries.
9. **Resolve or explicitly exclude framework-wide known defects.**

## Suggested release gates

A plugin should not be labeled production-ready until it has:

- a passing clean build, lint, typecheck, unit suite, and package dry-run;
- backend-realistic E2E tests, including restart/durability tests for persistent plugins;
- transaction rollback and partial-failure tests;
- concurrent writer tests at its claimed concurrency boundary;
- complete single-key and composite-key coverage where supported;
- defined schema migration/version behavior;
- deterministic disposal with no open handles;
- documentation of durability and process/tab boundaries;
- no dependency on unresolved framework defects for its advertised feature set.

---

# Remediation status — 2026-08-05

Every finding above was worked through `PRODUCTION-RELEASE-PLAN.md`. This section records
what happened to each one. Nineteen defects were fixed and recorded as `specs/known-defects.md`
#27 through #47; six of them were found by the new tests rather than by the audit.

## Readiness matrix, after

| Plugin | Before | After | What changed |
|---|---|---|---|
| Memory | Ready for ephemeral use | Ready for ephemeral use | Shared-name `destroy()` documented at the call site, in the docs page, and in the package README |
| File system | Conditional / limited | **Ready, single-process** | `fsync` before the rename; single-process boundary documented |
| Browser storage | **Not production-ready** | **Ready, single-writer** | #30 — the data-loss defect is fixed; multi-tab writing documented as unsupported |
| Dexie | **Not production-ready** | **Ready** | #44–#47 — one transaction per save, `version` option, fingerprinted cache, lifecycle in `try` |
| SQLite | Needs fixes | **Ready** | #31–#34 — connection leak, BEGIN errors, cache scope, unopenable-file hang |
| PostgreSQL | Beta / closest to ready | **Ready** | Parameters no longer logged; pool disposal in tests; failure paths covered |
| MySQL | **Not production-ready** | **Ready** | #35–#38 — first run against a real server; DDL, four type mappings, `count()`, pool release |
| PouchDB | **Not production-ready** | **Ready** | #39–#43 — instance-scoped state, replication fixed, sync cancelled on destroy |
| SQL core | **Not production-ready** | **Ready** | #27–#29 — reversed-null, sentinel collision, composite keys |
| Chrome extension | Not implemented | **Removed** | The directory held one orphaned jest config |

## Finding-by-finding

| Finding | Status |
|---|---|
| Critical: browser-storage loses rows on a later add | **Fixed** — #30. Collection registry plus hydrate-in-`save()`, the file-system template |
| High: shared SQL update generation assumes one ID column | **Fixed** — #29. Composite keys take one full-key `UPDATE` per row; single-key output is byte-identical |
| High: reversed null comparisons generate incorrect SQL | **Fixed** — #27, and #28 behind it: the same sentinel collision made `"x" == p.prop` render `prop IS NULL` |
| High: PouchDB state is global rather than database-scoped | **Fixed** — #39. Queue, index cache and sync handle are instance fields |
| High: SQLite connection lifecycle | **Fixed** — #31. `shouldClose` removed; every path closes |
| High: SQLite ignores transaction-start errors | **Fixed** — #32 |
| High: SQLite table cache is module-global | **Fixed** — #33 |
| High: Dexie multi-schema saves are not one transaction | **Fixed** — #44 |
| High: Dexie schema version is fixed at 1 | **Fixed** — #46. `version` constructor option, with a message naming it when Dexie refuses |
| High: MySQL has no real-server validation | **Fixed** — `e2e/src/mysqlContainer.test.ts`, 24 cases plus the contract kit. It failed 81 of 86 on its first run |
| High: MySQL ignores `connectionString` and `pool.min` | **Fixed** — `connectionString` honoured and mutually exclusive with the discrete fields; `pool.min` removed from the type |
| High: MySQL creates tables inside the transaction | **Fixed** — #35. DDL runs before `beginTransaction` |
| High: MySQL has no optimistic-concurrency path | **Fixed** — wired to the shared conditional-update builder, detecting conflicts from `affectedRows` |
| Medium: PostgreSQL logs SQL parameters | **Fixed** — gated logger; parameter values are never logged at any level |
| Medium: PostgreSQL container suite hangs | **Fixed** — per-test pool disposal. The suite finishes in 7s with `--detectOpenHandles` clean |
| Medium: PouchDB duplicate IDs | **Fixed** — #42, both copies of the block |
| Medium: PouchDB possible double callback | **Fixed** — #41 |
| Medium: `ts-loader` in Rspack builds | **Fixed** — all ten configs use `builtin:swc-loader`; the devDependency is gone |
| Medium: missing LICENSE and README in packages | **Fixed** — both present in all ten, enforced by `npm run release:pack-check` |
| Medium: missing `files` allowlists | **Fixed** — five packages were publishing `src/` and tests |
| Medium: no CI | **Fixed** — `.github/workflows/ci.yml`, two jobs |
| Chrome extension is not a plugin | **Removed**, as planned |

## Documented limitations, not fixed

These were decided as out of scope and are stated in the package READMEs:

- **Browser storage: multi-tab writing.** Two tabs are independent read-modify-write owners
  of one key and the last save wins. CAS or revisions would be the fix.
- **Dexie: optimistic concurrency.** Dexie offers no conditional-update primitive to build it
  on, so `ConcurrencyDbPlugin` cannot detect a stale write there.
- **SQL schema migrations.** All three SQL plugins create a missing table and never alter an
  existing one. A migration design is its own project.
- **MySQL auto-increment select-back.** Requires `innodb_autoinc_lock_mode` 0 or 1. Under
  mode 2 the plugin fails the save with both settings named rather than echoing wrong rows.
- **Rich types on SQL plugins.** SQLite and MySQL run the contract kit with
  `supportsRichTypes: false`: a SQL column cannot distinguish an absent optional property
  from one explicitly set to null.

## Release gates — measured

| Gate | Result |
|---|---|
| `npx tsc --noEmit` per package | Clean. `npm run typecheck` covers every workspace |
| `npm run lint` | Clean — 0 warnings, 0 errors |
| Unit and contract suites | 5,981 passing, 141 skipped |
| Jest exits without `--forceExit` | Yes. The last leaked handle — three undisposed stores in `ChangeTracker.test.ts` — is fixed, and no worker warning remains |
| `E2E_CONTAINERS=1 npx jest --selectProjects e2e` | 202 passing across SQLite, PostgreSQL, MySQL and CouchDB |
| `STRESS=1 E2E_CONTAINERS=1 npx jest --selectProjects stress` | 65 passing, including S8 against both servers |
| `npm run release:pack-check` | Twelve of thirteen packages pack correctly. `@routier/react` needs a bundle, which only CI can build |
| `npm run build` | Green, and now runnable locally — see below |
| `npm run benchmark` | **Two pre-existing regressions**, see below |

### The benchmark result, honestly

`update-1000` and `diff-update-1000` exceed the 15% gate. They are **not** caused by this
work. Running the same benchmark at `8aba2a3`, the commit before any of it, reproduces both
(`+20.8%` and `+15.8%`), so the recorded baseline is stale relative to change-tracking work
that landed earlier.

The baseline was deliberately NOT re-recorded. `npm run benchmark:update` would erase a real
signal, and deciding whether that regression is acceptable is a separate call from this one.

Benchmarks run against `MemoryPlugin` only, so none of the SQL builder changes are exercised
by them. The SQL hot paths are covered by the stress program instead: S8's volume and churn
scenarios run against real PostgreSQL and MySQL servers and pass.

### The build, which had never run

`npm run build` had never completed successfully in this repository. Nothing verified bundle
output, so three defects sat in it untouched. CI found all three, one per push:

1. **`core`, `datastore` and `test-utils` still used `ts-loader`.** The Phase 9 sweep covered
   `plugins/*`, which is what the plan enumerated. ts-loader needs webpack as a peer, so the
   first build ever attempted failed with `Cannot find module 'webpack'`.
2. **`npm run build --workspaces` builds alphabetically**, which violates the dependency graph:
   `datastore` imports `@routier/memory-plugin`, and mysql/postgresql/sqlite import
   `@routier/sql-plugin-core`. Packages resolve siblings through `main: dist/index.js`, so an
   unbuilt dependency is missing. Stale `dist/` folders hid it locally.
3. **`tsconfig.test.json` sets `baseUrl` to the repo root, which contains a directory named
   `react`.** TypeScript prefers baseUrl-relative resolution for a bare specifier, so once
   `react/dist/index.d.ts` existed — after any build — `import { useEffect } from "react"`
   resolved to the workspace and every hook import failed. It only looked fine on an unbuilt
   checkout. CI builds before it tests, so it would have failed on every run.

It is now runnable locally. npm's optional-dependency bug (npm/cli#4828) drops the platform
binaries; install them together, since installing one with `--no-save` prunes the other:

```
npm install --no-save --ignore-scripts @rspack/binding-darwin-arm64@<@rspack/core version> @rollup/rollup-darwin-arm64
npm rebuild sqlite3   # --ignore-scripts skips its native build; ~21 suites fail without it
```

### The stress gate on CI

`STRESS=1 E2E_CONTAINERS=1` passes locally in full — 65 of 65, including S8 against real
PostgreSQL and MySQL. On GitHub runners one scenario fails:
`s3-churn-mutation-cycles` → "memory: 10,000 cycles over 1,000 entities leave no residue".

It asserts an RSS decay ratio below 0.85 and reported 0.95 and 1.00 on two runs, with RSS
starting around 1.08GB on a 2-core runner. The scenario uses the memory backend, on a code
path this work did not touch, and it passes locally on every attempt including under a 1GB
heap cap. The assertion measures resident set size, which depends on when the collector
returns pages, and a shared runner under memory pressure never shows the decay.

Left as is. Loosening a leak detector to make a pipeline green is the wrong trade, and whether
to re-tune the heuristic — or force a collection before sampling — is a decision for whoever
owns the stress program.
