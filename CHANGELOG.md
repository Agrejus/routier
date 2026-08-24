# Change Log

Hand-written, one section per release, grouped by package with breaking changes first. See
`specs/RELEASING.md` for the procedure.

## @routier/pouchdb-plugin 0.5.0 (2026-08-23)

An independent release, so the header names the package: nothing else changes.

### Breaking — @routier/pouchdb-plugin

- `pouchdb` moves from `dependencies` to `peerDependencies` at `>=9.0.0`. npm 7 and later
  install a required peer automatically, so an ordinary `npm install` is unaffected. What
  changes is that the version is now yours to choose, and you can satisfy the specifier with
  `pouchdb-core` plus the adapters you actually use rather than the meta-package — which pulls
  in `leveldown`, a native binding with no prebuilt artifact for current Node.

  It is a REQUIRED peer, not an optional one. A PouchDB plugin cannot load without PouchDB, and
  marking it optional would have promised an import that works with the package absent while the
  bundle still needs it on the first line.

- A schema whose identity key is not named `_id` is now refused, with a message naming the
  collection and the fix. It used to be accepted.

  PouchDB generates a document id as `_id` and echoes it back as `_id`. An identity key under
  any other name was therefore never filled in, so every entity read back with an undefined key
  and the change tracker merged them all into one. Corruption with no error — the worst
  available outcome, and worse than the save failing. A caller-supplied key (`default` or
  computed) is stored as an ordinary field and round-trips under any name; only `identity` is
  affected.

### Fixed — @routier/pouchdb-plugin

- Schema validation ran over every schema registered in the store, so one unusable collection
  blocked saves to collections that were fine. It now checks only the schemas a save actually
  writes.
## PGlite (2026-08-23)

PostgreSQL in the browser. `@routier/pglite-plugin` runs PGlite — PostgreSQL compiled to
WebAssembly — persisted to OPFS behind a leader-elected worker, and in Node against a
directory or memory. It generates the same SQL as `@routier/postgresql-plugin`, because both
now build their statements from the same package. Documented at
`/integrations/plugins/built-in-plugins/pglite/README`.

### Versions

`@routier/postgres-plugin-core` and `@routier/pglite-plugin` start at `0.1.0`, for the reason
recorded under `0.5.0`: a version is a claim about a package's own history, and neither has
one yet.

`@routier/postgresql-plugin` goes to `0.5.0`. Its public API is unchanged — `PostgresDbPlugin`,
`PostgresDbPluginConfig` and every symbol that moved is still importable from it — but it now
declares `@routier/postgres-plugin-core` as a required peer, and an existing install that does
not add it gets an unmet peer and a failing import. On `0.x` that earns a minor rather than a
patch.

`@routier/sql-plugin-core` goes to `0.5.0` for the `SqlDialect` change described below. Every
plugin declares it at `>=0.4.0`, so none of them needs republishing.

`@routier/core` is untouched.

### Added — @routier/postgres-plugin-core 0.1.0 (first release)

- The PostgreSQL half of the SQL plugins, with no database client in it. `PostgresDbPluginBase`
  is a complete `IDbPlugin` minus the engine; a `PostgresDriver` supplies `connect`, `dispose`,
  and a connection with `all`, `run` and `release`.
- Moved here unchanged from `@routier/postgresql-plugin`: `compiledSchemaToPostgresTable`,
  `buildFromQueryOperation`, `buildJoinQueryOperation`, `buildFromPersistOperation`,
  `PostgresSqlTranslator`, `PostgresVectorSupport` and `NO_VECTOR_SUPPORT`. They imported
  nothing Node-specific and never needed to live next to `pg`.
- Transactions are deliberately absent from the driver interface. Every engine behind it is
  PostgreSQL, so `BEGIN`, `SAVEPOINT` and `ROLLBACK TO SAVEPOINT` are statements the plugin
  issues through `run`.
- `RECOVERABLE_SQLSTATE` is exported, because a driver whose transport drops the error code has
  to put it back. See the PGlite worker note below.
- Peer dependencies only: `@routier/core` and `@routier/sql-plugin-core`. No runtime
  dependencies.

### Added — @routier/pglite-plugin 0.1.0 (first release)

- `new PGliteDbPlugin(name)` — PostgreSQL in WebAssembly. The name is PGlite's data directory
  and its prefix picks the storage: a bare name becomes `opfs-ahp://` in a browser, and
  `idb://`, `memory://` or a path are passed through. There is no separate `storage` option,
  because the prefix already says it.
- Export conditions select the build. The browser entry runs the database in a Web Worker,
  which is forced rather than chosen: `createSyncAccessHandle` does not exist on the main
  thread and PGlite's OPFS filesystem needs it. The worker elects a leader, so several tabs
  share one database — unlike `@routier/sqlite-plugin`, whose SAH pool takes exclusive handles
  and fails to open in a second tab.
- **PGlite has one connection, so the driver serialises `connect`.** A save runs `BEGIN`,
  several statements, `COMMIT`; a query arriving mid-save on the same connection would execute
  inside that transaction, and a second save's `BEGIN` would be an error. Callers queue
  instead. This is a fact about this engine and is stated on its driver — `pg` has a pool and
  pays nothing for it.
- **`PGliteWorker` rebuilds a worker-side failure as `new Error(message)`, which drops the
  SQLSTATE.** The plugin reads `code` to decide whether a missing table has to be created, so
  the first write to any new collection failed — in the browser and nowhere else. The driver
  restores the code from the message, which is safe there and only there: PGlite is a fixed
  build running in the C locale, so those strings cannot vary.
- `s.vector()` and `.nearest()` work with or without pgvector. Without it the embedding goes to
  JSONB and the search is scored in memory; with it the table gets a real `vector(n)` column
  and PostgreSQL orders with `<=>`. pgvector is a separate optional peer,
  `@electric-sql/pglite-pgvector`, and because extensions are built inside the worker a browser
  application supplies its own worker through `workerUrl`.
- `pgliteDbPlugin(name, instance)` builds a plugin over a PGlite instance you already have, for
  sharing one database with a live query, a sync client, or an extension set this package does
  not know about.
- `@electric-sql/pglite` is a peer dependency. `opfs-ahp` does not work in Safari, which caps
  synchronous access handles at 252 while PostgreSQL needs over 300 files; use `idb://` there.

### Changed — @routier/postgresql-plugin 0.5.0

- The plugin is now a subclass over `pgDriver(config)`, and everything it does with a statement
  lives in `@routier/postgres-plugin-core`. `PostgresDbPlugin` and `PostgresDbPluginConfig` are
  unchanged, and `index.ts` re-exports the moved symbols, so no import breaks.
- `@routier/postgres-plugin-core` is a new required peer. This is the only reason the version
  moves.
- The three copies of the retry-on-missing-table path — query, query retry, and persist —
  collapse into one, matching how `@routier/sqlite-plugin` already did it.
- No behaviour change. Lazy table creation, savepoint recovery, the concurrent-creator races
  (`42P07`, `23505`), the pgvector probe, join pushdown refusal, JSON decoding on both paths and
  `OptimisticConcurrencyError` all work exactly as before, and the container suite covers them.

### Fixed — @routier/sql-plugin-core 0.5.0

- `array.includes(value)` produced a string `LIKE` against a JSON column. PostgreSQL and MySQL
  rejected it (`operator does not exist: jsonb ~~ text`); **SQLite accepted it and returned the
  wrong rows**, because a substring test matches a longer element and matches across element
  boundaries. Membership now uses each engine's own containment: `json_each` for SQLite, `@>`
  for PostgreSQL, `JSON_CONTAINS` for MySQL, `OPENJSON` for SQL Server. See known defect #69.
- **Breaking for plugin authors.** `SqlDialect` gains `arrayContainsExpression` and
  `encodeArrayContainsValue`, so a dialect implemented outside this repository no longer
  compiles. Nothing else changes, and every plugin here declares the peer at `>=0.4.0`, which
  `0.5.0` satisfies — no plugin needs republishing for it.

### Fixed — dates did not survive a round trip — @routier/postgres-plugin-core, @routier/mysql-plugin 0.5.0

Reported as "a schema with an identity key and a `s.date()` property cannot be saved". That was
the alarm, not the defect. See known defect #70.

- **PostgreSQL stored `TIMESTAMP`**, which carries no offset, so the driver read the naive value
  back as local time and every date returned shifted by the client's UTC offset. Now
  `TIMESTAMPTZ`. Setting the session timezone does not help — the shift happens in the client's
  parser, and `pg` has no equivalent to mysql2's `timezone` option.
- **MySQL stored `DATETIME`**, whose default precision is whole seconds, so the milliseconds a
  JS `Date` carries were truncated. Now `DATETIME(3)`, the exact precision of a JS `Date`.

The identity key was the detector, not the cause. With an explicit key the correlation hash is
never consulted, so the shifted date was accepted **silently**. Nothing in the hash or codegen
path changed, deliberately: normalising the date out of the hash would have silenced the
detector and left the corruption in place.

`@routier/mysql-plugin` goes to `0.5.0` for the DDL change. `@routier/postgresql-plugin` is
already moving to `0.5.0` above.

**Neither change migrates an existing table.** These plugins create a table when it is missing
and never alter one, so a table already created with `TIMESTAMP` or `DATETIME` keeps that type
and the old behaviour. Changing it on live data is a migration.

Pinned by a `dates` block in the conformance matrix, run against all four engines.

### Added — testing

- PGlite joins the dialect conformance matrix in `e2e/src/dialectConformance.test.ts`. That
  matrix exists because SQLite is the permissive engine — it stores JSON as text, accepts
  several statements per call, and serialises writers — so it forgives three classes of bug the
  others do not. Until now the strict engine ran only behind `E2E_CONTAINERS`; it now runs
  without Docker.
- `e2e/src/pgliteParity.test.ts` writes one row through both engines and compares what comes
  back. They are different clients over one wire protocol, and decoding is where they may
  differ: `node-postgres` returns `COUNT(*)` as a string and PGlite as a number, which
  `PostgresSqlTranslator` already absorbed.
- `e2e/browser` gains a PGlite fixture and proves OPFS survives a full page reload in Chromium.
- An `array membership` block joins the conformance matrix, including the prefix case that
  SQLite alone got wrong. It is what pins defect #69 across all four engines.
- `examples/pglite-console` is a working Vite application: PostgreSQL in a browser tab,
  persisted to OPFS, with a reload button. Building it is what found #69 and the Vite worker
  format requirement.

### Changed — test scripts

- `test:e2e` and `test:e2e:containers` now run Jest under `--experimental-vm-modules`, which
  PGlite needs: it reaches its WebAssembly through `await import()` from Emscripten's own glue,
  and a Jest VM context refuses that. The rejection arrives as an uncaught exception, so it
  cannot be caught — a suite has to check the flag before touching the engine, which
  `vmModulesEnabled` in `@routier/test-utils` does.
- The flag is **not** global. Under it Jest refuses to `require` `@faker-js/faker`'s ESM build,
  which six existing suites import. A bare `npm test` therefore lists the PGlite blocks as
  skipped rather than running or silently omitting them.

### Changed — architecture

- The `plugins` domain may now import `@routier/postgres-plugin-core`, and the check for
  "packages under plugins/ implement IDbPlugin" accepts a package that extends a base which
  does. The bases are named — `EphemeralDataPlugin`, `PostgresDbPluginBase`,
  `SqliteDbPluginBase` — so `extends Anything` cannot pass by accident.
- `IDbPlugin` is unchanged, and the `IDbPlugin is frozen` guard still passes.

## @routier/react 0.4.1 (2026-08-19)

An independent patch, so the header names the package: nothing else changes.

### Fixed — @routier/react

- `require("@routier/react")` threw `exports is not defined in ES module scope`. This package is
  the only one declaring `"type": "module"`, which makes Node read **any** `.js` as ESM — and the
  vite config named the CommonJS build `index.cjs.js`. Node therefore loaded CommonJS output in an
  ESM scope and the module was unusable from `require`. The bundle now uses the `.cjs` extension,
  which forces CommonJS regardless of `type`, and `main`/`module`/`exports` point at
  `dist/index.cjs` and `dist/index.js` like every other package.

  Only `require` was affected; `import` worked throughout.

### Fixed — release tooling

- `scripts/consumer-check.mjs` had no entry for `@routier/react` or `@routier/mongodb-plugin`, and
  it only checks packages named in its two lists. It is the one gate that loads built bundles the
  way a user does, so the defect above shipped in `0.4.0` unnoticed. Both are now covered; the
  react failure reproduced on the first run.

## 0.5.0 (2026-08-19)

Telemetry as an explicit plugin instead of runtime reflection, plus a new OpenTelemetry
package. Documented at `/integrations/plugins/built-in-plugins/wrappers#telemetrydbplugin` and
`/integrations/plugins/built-in-plugins/otel`.

### Versions

**Independent, not lockstep.** Only `@routier/core` and the new `@routier/otel-plugin` change.
The new package starts at `0.1.0` rather than joining core's number: it is unproven, and a
version is a claim about a package's own history, not a badge of which release it shipped in.
Unifying can wait until the packages leave `0.x`.
Unlike `0.3.0` and `0.4.0`, no plugin needs republishing: every plugin declares
`@routier/core` as a peer at `>=0.4.0`, which `0.5.0` satisfies, and plugin bundles no longer
inline core — dependencies and peers are externalised, so a dist `require`s core rather than
carrying a copy of it. The peer floors deliberately stay at `>=0.4.0`, because nothing removed
here was ever used by a plugin.

### Breaking — @routier/core

- `@routier/core/capabilities` is removed, along with `Capability`, `PerformanceCapability`,
  `TracingCapability`, `PerformanceMetrics`, `MethodInfo` and `MethodInfoMetadata`. The
  subpath export and its `typesVersions` entry are gone, so an import of either fails to
  resolve rather than resolving to something empty.

  These wrapped a datastore by reflection, replacing methods to time and trace them. Replace
  with `TelemetryDbPlugin` below, which measures the same operations by decorating the plugin
  the datastore already talks to — no method replacement, and it composes with the other
  wrappers instead of mutating an instance.

### Added — @routier/core

- `TelemetryDbPlugin` wraps any `IDbPlugin` and emits one `TelemetryEvent` per `query`,
  `bulkPersist` and `destroy`: `operation`, `durationMs`, `ok`, `eventId`, `source`, the
  `schemas` touched, and `error` when `ok` is not `"success"`.
- `TelemetrySink`, `TelemetryEvent` and `TelemetryDbPluginOptions` are exported with it.
- `loggerSink()` is the default sink and writes through the levelled logger, so
  `ROUTIER_LOG_LEVEL` governs whether anything is emitted. `collectingSink(array)` buffers
  into an array for tests and custom aggregation.
- A sink that throws is swallowed: observability never fails a data operation. The result
  object reaches the caller by the same reference, never a copy.
- No new dependencies.

### Added — @routier/otel-plugin 0.1.0 (first release)

- `OtelDbPlugin` wraps any `IDbPlugin` and emits one OpenTelemetry span per operation, named
  `routier.query`, `routier.bulkPersist` or `routier.destroy`, with `db.system`,
  `db.collection.name`, `routier.source`, `routier.event.id`, and `db.query.text` when the
  inner plugin reports what it executed.
- The inner plugin runs inside the span's context, so spans it creates itself nest underneath
  rather than becoming roots.
- A failed or partial operation records the exception and sets status `ERROR`; a partial save
  also sets the status message to `"partial"`. Span bookkeeping is wrapped so that a throw
  while setting attributes cannot fail the operation, and the span always ends.
- `@opentelemetry/api` is a peer dependency and the package has **no runtime dependencies** —
  the SDK belongs to the host application. Pass a `Tracer` to use your own instrumentation
  scope; the default is `trace.getTracer("routier")`, a no-op until you register a provider.

## 0.4.0 (2026-08-18)

Query explain, end to end: `.explain()` on any query — joins included — returns
`{ data, explanation }`, where the explanation reports which query options ran in the database,
which ran in memory and why, and the exact statements the plugin executed. Documented at
`/concepts/queries/explain` on the docs site.

### Versions

**Every publishable package goes to `0.4.0`, in lockstep**, for the same reason as `0.3.0`:
`@routier/core` changes in a breaking way, every plugin depends on core, and plugin dists bundle
core source. `@routier/blob-plugin` was already at `0.4.0` from an independent release and has
no code change; the coordinated publish skips it.

### Breaking — @routier/core

- `DbPluginQueryEvent` gains two required fields: `explain: boolean` (whether the caller asked
  for an explanation) and `executedQueries: ExecutedQuery[]` (the array a plugin pushes what it
  ran into, after it runs). Code that constructs query events must supply both. Plugins are not
  required to push — an explanation then marks their step as `executedQueriesUnsupported`.
- The wire protocol changes: `SerializedQueryRequest` gains a required `explain: boolean`, and a
  query response may carry `executedQueries`. The request handler has no explain setting — it
  returns whatever the plugin reported when the caller asked. Gate access with `authorize`
  (check `request.explain`) where statement text must not leave the server.
- `createRequestHandler` no longer accepts `allowExplain` (added and removed within this
  release cycle; it never shipped).

### Breaking — @routier/datastore

- Terminal return types are now `Explainable<E, T>` — identical to before (`T`) unless
  `.explain()` is in the chain, in which case terminals return `{ data, explanation }`.
- `RequestContext.explainedCopy()` is renamed to `withExplainOn()`.

### Explain

- `explainQuery` builds the step analysis from the resolved query options; plugins report what
  they executed by pushing to `event.executedQueries`. `formatExplanation` renders it for a
  terminal. Memory-execution reasons are named codes with one-sentence explanations.
- Every built-in plugin reports: SQL with parameters (sqlite, D1, postgresql, mysql), the find
  document (mongodb), the access path (dexie, pouchdb, memory-family), `GET <url>`
  (`HttpDbPlugin`), and `cache hit — no query was executed` (`CacheDbPlugin`).
- Joins report both reads in execution order. The memory family reports the inner-side scan and
  whether semi-join narrowing applied.
- `.explain()` works through `HttpTransportDbPlugin`: the flag crosses the wire and the server's
  statements come back on the response.
- `HttpSwrDbPlugin` background revalidation no longer inherits the caller's explain flag or
  report array, so a revalidation cannot stamp its queries onto a later read's explanation.

### Fixes

- MongoDB: removed `filtersAllPushedDown`, a windowing guard that could never trigger — an
  untranslatable filter throws instead. Dead code; no behavior change.
- Shared plugin contract: the explain row-count test now compares two reads of one store, so it
  holds on server-backed plugins where a second store shares the database.

### Tests and docs

- New shared contract sections exercise explain against every plugin, including a joined
  explain in the join contract; postgres and mongo container suites gain explain tests; a new
  overhead benchmark (`plugins/memory/src/tests/overhead.test.ts`) bounds the datastore layer at
  measured ~2.8µs per returned entity and asserts it in CI.
- Docs: new `/concepts/queries/explain` page, an "Overhead, measured" section in
  `/concepts/performance`, and explain references in query architecture, terminal methods,
  plugin authoring, and HTTP transport. `RELEASING.md`, `PLUGIN_AUDIT.md`,
  `PRODUCTION-RELEASE-PLAN.md` and `HARDENING-HANDOFF.md` moved from the repository root to
  `specs/`.

## 0.3.0 (2026-08-12)

Thirty-nine defects fixed, recorded as `specs/known-defects.md` #27 through #65, plus the first
CI this repository has had. Every publishable package changed.

Most of these were found by pointing tests at something real for the first time — a MySQL
server, a CouchDB server, three SQL engines answering the same question, and a sync server that
can change its data behind the client's back. None of them were visible to the suites that
existed.

### Versions

**Every publishable package goes to `0.3.0`, in lockstep.**

This reverses the policy stated in `RELEASING.md` and in earlier drafts of this section, which
argued that bumping an unaffected package to `0.3.0` claims a break that did not happen. That
reasoning is sound in general and does not describe this release: thirteen of the seventeen
packages have shipped-code changes, `@routier/core` and `@routier/datastore` both change in
breaking ways, and every plugin depends on core. A consumer upgrading one package has to upgrade
core with it regardless, so independent numbers would document a freedom nobody has.

Four packages have no shipped-code change and are bumped anyway, which is the cost of the
decision rather than an oversight: `@routier/react`, `@routier/memory-plugin`,
`@routier/browser-storage-plugin` and `@routier/encryption`.

| Package | From | To |
| --- | --- | --- |
| `@routier/core` | 0.2.1 | 0.3.0 |
| `@routier/datastore` | 0.2.1 | 0.3.0 |
| `@routier/react` | 0.2.0 | 0.3.0 |
| `@routier/test-utils` | 0.0.1-alpha.1 | 0.3.0 |
| `@routier/blob-plugin` | 0.1.0 | 0.3.0 |
| `@routier/browser-storage-plugin` | 0.2.0 | 0.3.0 |
| `@routier/dexie-plugin` | 0.2.0 | 0.3.0 |
| `@routier/encryption` | 0.1.0 | 0.3.0 |
| `@routier/file-system-plugin` | 0.2.0 | 0.3.0 |
| `@routier/memory-plugin` | 0.2.0 | 0.3.0 |
| `@routier/mongodb-plugin` | — | 0.3.0 |
| `@routier/mysql-plugin` | — | 0.3.0 |
| `@routier/postgresql-plugin` | 0.2.1 | 0.3.0 |
| `@routier/pouchdb-plugin` | 0.2.0 | 0.3.0 |
| `@routier/replication-plugin` | 0.2.1 | 0.3.0 |
| `@routier/sql-plugin-core` | — | 0.3.0 |
| `@routier/sqlite-plugin` | 0.2.0 | 0.3.0 |

Internal ranges moved with them. Two are runtime dependencies rather than dev ones —
`@routier/datastore` and `@routier/replication-plugin` both depend on `@routier/memory-plugin` —
and a `^0.2.1` range does not match `0.3.0`, so leaving them would have shipped an unsatisfiable
install.

### Full-text search

Search that returns the same rows in the same order on every backend. Core tokenises and ranks;
no plugin contains any search code.

```ts
title: s.string().searchable()

articles = this.collection(articleSchema).fullTextSearch().proxy().create()

await store.articles.search('copper pipe').where(x => x.published).take(10).toArrayAsync()
```

The index is an ordinary generated collection — one row per (term, field, document) — maintained
in the save pipeline beside `.audit()`, so its rows commit in the same transaction as the
documents they describe. An add whose key the database assigns is the exception: the row's key
embeds an id that does not exist until the insert runs, so those rows are written immediately
after, and a failure reaches the caller rather than a log.

`collection.fullTextSearch.check()` and `.rebuild()` make that repairable on a schedule. `check`
reports drift without writing; `rebuild` writes only differences, so a healthy index costs two
reads and no writes. `rebuild` also builds the index the first time over data that predates the
declaration.

Ranking is term frequency only — no BM25, no stemming, no phrase search — and the `score` a
result carries is ordered-by, not contractual. Engine-native search (FTS5, `tsvector`,
`FULLTEXT`) is deliberately unused: each tokenises and ranks differently, so the same query would
return different rows on different backends. See `docs/concepts/queries/full-text-search.md`.

Proven by one contract run against ten backends with no exemptions: memory, Dexie, file-system,
browser-storage, SQLite, PouchDB, Cloudflare D1, PostgreSQL, MySQL and MongoDB.

Two of those needed a plugin fixed first, and both were defects rather than limits of the design:

- **`@routier/mongodb-plugin` no longer requires `.identity()` on `_id`.** The rule reasoned that
  Mongo fills in a missing `_id`, which only describes a key nobody supplies — and a key without
  `.identity()` is by definition one the caller supplies. It was stricter than the database and
  rejected schemas that work.
- **`@routier/pouchdb-plugin` resolves a missing `_rev` itself.** It used to make its write
  protocol the caller's problem: a schema had to declare `_rev` and every entity had to carry the
  current value. A revision is a fact the database owns, so the plugin now looks up any missing
  one in a single `allDocs`, and only when one is missing. Declaring `_rev` is now an
  optimisation, not a requirement.

Also added, and useful on its own: `s.string({ maxLength })`, which MySQL maps to `VARCHAR(n)`
instead of the blanket `VARCHAR(255)`; and `previous` alongside `delta` on every update, so an
audit declaration can record before-and-after with no extra configuration.

### Every package now ships both module formats

Installing the tarballs into a clean project and running them — which nothing here had done —
found that no package was correctly consumable, in one of two ways (#50, #51).

Six emitted ESM while declaring `"type": "commonjs"`, so `require()` threw `ERR_REQUIRE_ESM` on
Node 18 and 20, both inside the range the READMEs state. The other six emitted CommonJS, which
Node's ESM interop exposes only as a default export, so the `import { MysqlDbPlugin } from ...`
in their own READMEs bound `undefined`.

Every package now builds twice from one shared config — ESM at `dist/index.js`, CommonJS at
`dist/index.cjs` — declared through `exports`. Both entry points are verified by
`npm run release:pack-check`.

Three consequences worth knowing:

- `@routier/pouchdb-plugin` could not be loaded in Node at all (#52). `target: "web"` inlined
  pouchdb's browser build, which reads `self` at module scope.
- Dependencies are no longer bundled (#53). `@routier/core` is a `peerDependency` of all eleven
  plugins and ten of them bundled it anyway, so a consumer of the datastore and two plugins
  loaded three copies. Bundles were up to 1.4 MB and are now 1–45 KB.
- Minification stays off, deliberately (#55). The schema codegen embeds a function's source and
  calls it by name, so any minifier breaks the first schema compile. `scripts/rspack.library.mjs`
  states the constraint that ten `mode: "development"` configs had been satisfying by accident.

### `@routier/sqlite-plugin` runs in the browser

The plugin talks to SQLite through a small driver interface — `all`, `run`, `close`,
`deleteDatabase` — and ships three implementations. The same
`new SqliteDbPlugin('app.sqlite')` now works in Node and in a web application; the package's
`browser` and `node` conditions pick the engine.

| Driver | Where | Storage | Install |
| --- | --- | --- | --- |
| `node:sqlite` (default in Node) | Node 22.5+ | a file | nothing |
| `wasmDriver()` (default in a browser) | modern browsers | OPFS | `@sqlite.org/sqlite-wasm` |
| `sqlite3Driver()` | Node 18+ | a file | `sqlite3` |

**The default Node engine changed** from `sqlite3` to `node:sqlite`, and `sqlite3` is now an
optional peer dependency rather than a dependency. Nothing compiles on install, so the package
no longer fails on a machine without a build toolchain — it was the one package the consumer
check could not cover. This raises the plugin's floor to **Node 22.5**; on Node 18 or 20, pass
`sqlite3Driver()` and install `sqlite3` yourself.

The browser driver runs SQLite in a worker it spawns. That is forced, not stylistic:
`createSyncAccessHandle` is undefined on the main thread, and every OPFS VFS is built on it.
It uses the `opfs-sahpool` VFS, so **no COOP or COEP headers are required** — the plain OPFS
VFS needs `SharedArrayBuffer` and therefore cross-origin isolation.

Verified in a real browser by `npm run test:browser`, which builds a page through the `browser`
condition, saves, queries, and reloads to prove the data came off disk.

### Republish required

`@routier/sqlite-plugin`, `@routier/postgresql-plugin` and `@routier/browser-storage-plugin` are
**unusable as currently published**. Each declares `main: ./dist/index.js` and shipped no `dist/`
directory at all — the tarballs hold `src/`, `tsconfig.json` and `jest.config.js`. Any install
fails on first import. They had no `files` allowlist, so the pack took whatever was on disk.

`npm run release:pack-check` now reads each manifest's `main`, `types`, `module`, `browser` and
every path in `exports`, and fails if the tarball does not contain them. All three of the broken
releases fail the new check.

### Breaking

Two packages. Both are published, so both can break a real installation.

- **`@routier/pouchdb-plugin`** — `sync()` and every sync callback now take
  `ReadonlySchemaCollection` instead of `SchemaCollection`. The documented call
  `plugin.sync(store.schemas)` did not compile before, because a store exposes the readonly type.
  This only breaks a handler that annotates its parameter explicitly, and only under
  `strictFunctionTypes`. Drop the annotation and let it infer.
- **`@routier/replication-plugin`** — `HttpSwrDbPlugin` no longer sends `skip`/`take` to the
  server; windows are applied locally. No compile error: a paginated read that returned `[]`
  before now returns rows, and a windowed read syncs the whole filtered set rather than one page.
  Bound what you sync with `where(...)`. Use `HttpDbPlugin` directly if you need the server to
  paginate.
- **`@routier/dexie-plugin`** — a schema with a nested object produces a different index
  layout, because the children of that object are no longer emitted as top-level indexes
  (#60). Dexie keys its layout to a version number, so an existing database hits
  "The stored database holds a different index layout for this version" until you bump
  `new DexiePlugin(name, { version })`. Only schemas with nested objects are affected. A
  schema with **two** nested objects sharing a child name could not open a database at all
  before this, so those have nothing to migrate.
- **`@routier/sqlite-plugin`** — the default engine is `node:sqlite` instead of `sqlite3`, and
  `sqlite3` moved from a dependency to an optional peer dependency. The plugin needs **Node
  22.5** by default; on Node 18 or 20, install `sqlite3` and pass `sqlite3Driver()`. Nothing
  about the constructor or the stored data changed, and a database written by the old version
  opens unchanged.

### Behaviour changes that are not breaking

Neither changes an API, and neither can break code that was already correct. Both change what
happens on a path that was previously wrong.

- **`@routier/dexie-plugin`** — one save is now one `db.transaction`. A save spanning two
  collections used to be two concurrent transactions and could half-commit; it now fails whole.
- **`@routier/sqlite-plugin`** — a `BEGIN IMMEDIATE` that fails now fails the save. It was
  discarded, so the batch ran with no transaction at all.

### Not breaking: new packages

`@routier/mysql-plugin` and `@routier/sql-plugin-core` have never been published. Their
`SqlDialect.encodeDate` requirement, `GroupedUpdateOperation.keyTuples`, the removal of
`pool.min`, the `connectionString` exclusivity check and the `DECIMAL` → `DOUBLE` mapping are all
part of a first release. There is no earlier version for them to break.

### Fixed

**`@routier/sql-plugin-core`** — three silent wrong-row defects (#27, #28, #29). `null == x.prop`
rendered `? IS NULL`, a tautology matching every row. Behind it, a sentinel collision made
`"x" == x.prop` render `prop IS NULL`, dropping the value entirely. And both update builders
matched composite keys on the first component only, so an update overwrote its siblings.

**`@routier/mysql-plugin`** — no schema declaring an index could create its table (#64). The
DDL builder emitted `CREATE TABLE ...; CREATE INDEX ...;` as one string, and mysql2 runs one
statement per query, so the table was never created and every save failed. Indexes are now
declared inside the table body as `KEY`. No MySQL test had an indexed property, which is why
nothing caught it.

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

**`@routier/sqlite-plugin`** — every query selected columns that do not exist (#57). The
column list came from `schema.properties`, which includes the children of a nested object;
those are not columns, since the object is stored whole in one JSON column. A schema with one
nested object emitted `SELECT "nested", "inner", "value", "count" ...`. It passed for as long
as the plugin existed because `sqlite3` enables SQLite's double-quoted-string misfeature,
which reinterprets an unknown `"inner"` as the literal `'inner'`; any engine with `SQLITE_DQS=0`
would have failed every nested-object query. Also fixed: a parameterless read returned no rows
from the WASM engine (#58), and `destroy` silently did nothing when it ran before anything had
been opened (#59).

**Every package** — `npm run typecheck` overwrote the bundles (#56). The `tsc` script was plain
`tsc`, and each `tsconfig.json` sets `declaration` and `outDir: ./dist` with no `noEmit`, so
type checking emitted unbundled JavaScript over the Rspack output. Because the gate order was
build, lint, typecheck, test, pack-check, every later gate was inspecting tsc's output. A
publish after a green run would have shipped an `index.js` full of extensionless relative
imports that Node's ESM loader rejects. All thirteen now run `tsc --noEmit`.

**`@routier/core`** — an optional object inferred `never` for every one of its fields (#62),
and a schema whose only contributing properties were files could not be added at all (#63).
Both were found by adding `s.file()`; the first is a type-only fault of the same family as
#61, the second a `ReferenceError` in generated code.

**`@routier/core`** — `tag()` on an object property broke the entity's inferred type (#61).
`SchemaTag<T>` carries the same `T` as whatever it wrapped without carrying which class that
was, so a tagged object fell through to the generic branch and typed its children as
`SchemaString` rather than `string`. Runtime was always correct; only the types lied, which is
why it survived — every existing use of `tag()` was on a string or number, where the bug is
invisible. Tagged arrays were wrong too.

**`@routier/core`** — a program that finished its work never exited (#54). A DataStore opens a
BroadcastChannel sender and receiver per collection, and in Node an open channel is a referenced
handle, so any script that did not call `destroyAsync()` hung forever after its last line — the
README quick start included. Both channels are now `unref`ed.

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

- **`transform`** — a two-way transform declared in `.modify()`, beside `computed` and
  `function`. `computed` derives a value one way and cannot come back; a transform declares
  both directions, so the property keeps its type and only its stored form changes.

  ```ts
  .modify(x => ({ ssn: x.transform(myCipher) }))
  ```

  `to` and `from` may be async and are held as live references, never stringified into
  generated code the way `computed` is — so they close over whatever they need, and there is
  no property to repeat and no value to inject. A transform declares `stores` and `comparable`
  itself, so a caller writes neither.

  Transforms are applied by the datastore, between the change tracker and the plugin. `to`
  runs on the way down and `from` on the way back; a filter on a transformed property is
  rewritten to compare against the stored form when the transform declares
  `comparable: 'equality'`, and rejected otherwise rather than returning wrong rows. The
  plugin receives a schema view in which a transformed property reports the type it stores, so
  it builds the right column through unmodified code.

  Core ships no transform of its own. Encryption is one thing a caller might write here;
  compression, redaction and a custom codec are others.
- **`s.file()`** — a schema primitive whose write shape differs from its read shape. Assign a
  `File`, `Blob`, `Uint8Array` or string; store and read back a reference (key, size, content
  type, checksum, name). `InferCreateType` accepts content and `InferType` gives the
  reference, through every modifier.

  It had to be in core rather than the blob plugin: the generated `preprocess` rebuilds an
  object property field by field from its declared children, so content assigned to one is
  discarded before any plugin sees the entity — it does not arrive mangled, it does not arrive
  at all. A file is a leaf, so the value passes through untouched, and `BlobDbPlugin` swaps it
  for a reference during `bulkPersist`, the only place an upload can happen because
  `preprocess` is synchronous.
- **`@routier/encryption`** (new, 0.1.0) — AES-GCM as a schema transform, not a plugin.
  `x.transform(encryption(keyring))` and your database plugin never learns it happened.
  Randomised by default; `{ searchable: true }` is deterministic and keeps equality filters
  working, at the cost of revealing which rows share a value. Keys live in a keyring with ids
  so rotation adds a key rather than replacing one, and AES-GCM authenticates, so a value
  altered in the database fails to decrypt rather than reading back as anything. Nothing about
  the package is privileged: a transform of your own with the same two functions works
  identically.

- **`@routier/blob-plugin`** (new, 0.1.0) — files and media: metadata in your database, bytes
  in blob storage. A `BlobStore` is five operations (`put`, `has`, `get`, `delete`, and
  optionally `url` and `list`), with stores for memory and the local filesystem; S3, R2, GCS
  and Azure are the same interface. `s3BlobStore` covers AWS, Cloudflare R2 and Google Cloud
  Storage — all three speak the S3 API and differ only in the endpoint — and is verified
  against MinIO in a container, including a presigned URL fetched with no credentials. Keys
  are the SHA-256 of the content. Direct upload is supported: your server signs, the browser
  PUTs straight to storage, and content the service already holds transfers nothing at all.
  The signature covers the content type and the checksum — with the AWS presigner's defaults
  only `host` is signed, and a client could drop the checksum header to store arbitrary bytes
  at a content-addressed key. Keys, which makes uploads
  idempotent and dedupes identical files — and means removing a record must never delete its
  bytes, so storage is reclaimed by an explicit `sweepOrphans(live)` instead. A blob store and
  a database cannot be written atomically, so the upload happens first and a failed save leaves
  a sweepable orphan rather than a row pointing at bytes that were never written.
- **`@routier/sync-server`** (private) — a server implementing the replication wire contract
  with an admin channel, so a test can change data with the client uninvolved.
- Per-plugin `README.md` stating durability, process/tab boundary, concurrency, migration
  policy, disposal and failure semantics.
- `e2e/src/dialectConformance.test.ts` — one SQL matrix run against SQLite, PostgreSQL and MySQL.
- `e2e/src/swrServerToClient.test.ts`, `e2e/src/mysqlContainer.test.ts`,
  `e2e/src/couchdbReplication.test.ts`.
- GitHub Actions CI, and `npm run typecheck` / `npm run test` / `npm run release:pack-check`.
- `npm run release:consumer-check` — packs every package, installs the tarballs into a
  throwaway project, and imports, requires and uses them. It is the only gate that exercises
  the built bundle rather than `src/`, and it found #50 through #54 and #56.

### Changed

- The README quick start, and the same example in `core/` and `datastore/`, called
  `this.collection(schema).create()`. `create()` moved to the configured builder, so the first
  code a new user runs threw `create is not a function`. They now call `.proxy().create()`.
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
