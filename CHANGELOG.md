# Change Log

Hand-written, one section per release, grouped by package with breaking changes first. See
`specs/RELEASING.md` for the procedure.

## Queries on renamed columns reach the SQL engine (unreleased)

A property mapped to a column with `.from()` used to send every filter, sort and similarity
search over it, and everything after, to memory before any plugin saw the query: the SQL plugins
read the whole table and filtered it in JavaScript (#43). Versions are set at release; the
sqlite plugin's next patch is already claimed by an in-flight branch.

Core no longer decides this. A renamed option is planned for the database like any other, with its
`PropertyInfo` attached, and a plugin that cannot read `.from()` names hands it back through the
capability report that already exists. `IDbPlugin` is unchanged.

### Changed — @routier/core

- **Breaking, types only:** `MemoryExecutionReason` no longer has `renamed-property`, because core
  no longer sends a renamed property to memory. A plugin that hands one back records
  `missing-capability`, and `.explain()` reports that instead.
- **Breaking:** `QueryOptionsCollection.forgetReports()` is removed. Reports are per dispatch now:
  `forDispatch()` gives each dispatch a copy with nothing reported, so there is nothing to forget. A
  caller that reused one collection across dispatches and cleared it in between sends a copy instead.
- `QueryOptionsCollection` keeps a filter, sort or `nearest` over a renamed property with the
  database. An unmapped property still runs in memory (`unmapped-property`).
- The ephemeral plugins (memory, file-system, browser-storage) report renamed options, since they
  run the caller's lambdas over stored records. Their leading-filter pass and explained scan skip a
  reported filter, and a join after a report is paired by the datastore.
- `splitSendableOptions` leaves out options a plugin reported.

### Added — @routier/core

- `getStorageDateReviver(schema)`: for a plugin that runs the caller's lambdas over records a JSON
  store handed back, turns ISO strings back into Dates at the root, in objects and in arrays, by
  storage path and in place. Keys are not moved, and a property with a custom serializer,
  deserializer or transform is left alone. Built once per schema, `null` for a schema with no dates.
- `reportRenamedProperties(options, names?)`: reports every filter, sort, `nearest`, `map` and `group`
  over a property with renamed segments, for a plugin that evaluates options over rows as stored. A
  `map` is reported when any field it selects is renamed, and a `group` when its key is or any field
  it copies into its members is. `sum`, `min`, `max` and `distinct` read the `map` in front of them,
  so they are handed back with it.
- `QueryOptionsCollection.forDispatch()`: a copy of the options for one dispatch, every database
  option `executed` again. A split half is copied with its origin, so a report on it still cascades
  over that dispatch alone. A join's inner options are copied too.
- `parseSelector(schema, selector)`: reads a sort, map, group or `nearest` selector with the filter
  grammar, for the properties its value is read from (`reads`, and `property` when there is one) and
  whether the value is that property (`isDirectProperty`). A call the filter grammar has no node for,
  such as `getFullYear()`, is kept for what it reads. Cached by source per schema, like `toExpression`.
  The datastore records the result on every `sort` and `nearest` option and every `QueryField`, as
  optional fields, so an option built without a selector is still read as its property.

### Fixed — selectors that compute a value (@routier/core, @routier/datastore, @routier/sql-plugin-core, @routier/sqlite-plugin, @routier/postgres-plugin-core, @routier/mysql-plugin, @routier/mongodb-plugin, @routier/dexie-plugin)

- The property a sort, map, group or `nearest` reads was taken by splitting the selector's source on
  `.`, so `r => r.dueDate.getTime()` resolved no property, and `r => 100 - r.price` resolved `price`.
  Selectors are now parsed, and an unparsable one (a closure) keeps its old name and property and is
  never treated as the property itself.
- SQL plugins hand back a sort, `nearest` or `map` whose selector computes its value, and the aggregate
  after the `map`. A sort by `100 - x.age` was pushed down as `ORDER BY "age"` and returned the wrong
  order with no error; `sort(x => x.name.length)`, `map(x => x.amount * 2)` and `sumAsync(x => x.amount * 2)`
  failed with `no such column`. The defect predates #43.
- The memory, file-system, browser-storage, Dexie and PouchDB plugins, and `HttpDbPlugin`, hand back a
  computed selector over a renamed property, as they did a plain one. `sort(r => r.dueDate.getTime())`
  threw, and `map(r => r.amount * 2)` or `sumAsync` over a renamed `amount` returned `NaN`.
- MongoDB hands back a computed sort rather than sending the path of the property it reads. Dexie no
  longer seeds a sort from an index for one. `splitSendableOptions` keeps a computed sort or `nearest`
  local, since it would travel as the property it reads.
- The contract suite's `RENAMED_CALL_SELECTOR_TESTS` export is removed; those cases pass on every plugin.
  A `derived selectors` section covers computed sorts, projections, groups and aggregates.

### Fixed — @routier/datastore

- Capability reports are per dispatch. A report was written onto option items that a queryable
  keeps, that a snapshot shares, and that a subscription re-sent on every change, so it outlived the
  dispatch that made it. Every dispatch now sends its own copy of the options (one-shot reads, each
  terminal, each subscription re-query, and the change probe), and the memory pass reads the copy the
  plugin answered. A live query on SQLite or PostgreSQL filtering on a renamed column used to fall
  back to a full table scan after a notification the probe answered empty. Rows were still correct.
- A subscription's change probe answers a filter on a renamed property itself, since the rows it is
  seeded with are already deserialized. It used to hand the filter back and match every changed row,
  so every change re-queried the real plugin, including one the filter excludes.
- When a plugin reports an option in front of an aggregate or projection, the rows it returns are
  deserialized before the memory pass. They used to reach it in storage shape whenever the query as
  a whole turned change tracking off, so `.where(x => x.renamed === 'a').countAsync()` counted zero.

### Changed — @routier/dexie-plugin, @routier/pouchdb-plugin

- Report renamed filters, sorts, `nearest`, projections and groups before choosing an index. Dexie
  only pushes a window, `count` or `distinct` down when nothing before it was reported; PouchDB builds
  its view predicate and index lookup from executed filters only.

### Fixed — @routier/core (memory, file-system, browser-storage), @routier/dexie-plugin, @routier/pouchdb-plugin

- A `map`, `sum`, `min`, `max`, `map(...).distinct()` or `toGroup` over a renamed property answers
  correctly on a read the store was not tracking. These plugins ran the caller's selector over rows
  as stored, where the property has another key, so a projection came back `undefined`, `sum` threw,
  `min`/`max` found no items and a group had one `undefined` key. PouchDB, which deserialized before
  running options, only lost renamed values inside a group's members. The defect predates #43.

### Fixed — @routier/core (memory, file-system, browser-storage), @routier/dexie-plugin, @routier/replication-plugin

- Options run by the plugin see Dates. Every one of these ran the caller's lambdas over dates as the
  ISO strings the datastore serialized them to, so a date filter against a Date matched nothing and
  `sort(r => r.date.getTime())` or `map(r => r.date.getFullYear())` threw. The ephemeral plugins
  already held root dates as Dates, and now hold dates in objects and arrays the same way, including
  what file-system and browser-storage read back from JSON. Dexie revives rows before its predicates
  and the translator run. `HttpDbPlugin` revives the rows a response carries, and
  `HttpTransportDbPlugin` the rows it finishes locally. Rows keep their storage keys.

### Fixed — @routier/pouchdb-plugin

- A property declared with `.from()` reads back. Documents were always stored under the `from`
  name, but the plugin returned rows it had already deserialized, and the datastore deserialized
  them again by storage name, so every read from a store that was not still tracking the rows
  returned the property as `undefined` (and a nested object under a renamed key threw). Rows are now
  handed back as stored. A projection or aggregate is unchanged. Existing data needs no migration.
- The translator no longer deserializes documents before running options. It turns dates back into
  Dates, the one thing PouchDB's JSON changed, at their storage paths, and leaves every key where it
  is stored. The view predicate sees Dates too, so `where(([r, p]) => r.createdDate > p.d)` returns
  the matching rows; it returned none. A custom `.serialize()`/`.deserialize()` property now reaches
  the options as stored, as it does on every other plugin that runs options over its rows.
- An index view on a renamed property reads its `from` name. It used to read the in-memory name and
  emit nothing. The view has a new name, so a database with the old design document gets it
  replaced on its next indexed read.
- An identity key declared with `.from()` is refused at save, like an identity key not named `_id`.
  PouchDB fills in `_id`, so the key never read back.

### Fixed — @routier/mongodb-plugin

- A sort on a renamed property sends the stored path. It used to send the in-memory name, which was
  masked while renamed sorts ran in memory. Filters already used the stored path.
- A `nearest` over a renamed vector is reported, since it is scored in JavaScript over stored documents.
- A `map` or `group` over a renamed property is reported for the same reason, and an aggregate after
  the `map` goes back with it. They used to read the in-memory name from stored documents.
- A filter against a Date matches. The datastore serializes a date to its ISO string before the plugin
  inserts it, so documents hold the string, but a Date value was sent as it is and BSON never orders a
  Date against a string: `where(([r, p]) => r.createdDate > p.d, { d })` and
  `p.dates.includes(r.createdDate)` matched no documents. Dates are sent as ISO strings in field
  predicates, `$in` and `$nin` lists, and `$literal` operands. The defect predates #43.
- Options run in JavaScript see Dates. The translator revives dates at their storage paths before a
  `group`, `map`, `nearest` or a handed-back option runs, without moving keys, so `toGroup` by a date
  no longer keys by the ISO string, and `toGroup(r => r.createdDate.getFullYear())` no longer throws.

### Changed — @routier/replication-plugin

- `HttpDbPlugin` and `HttpTransportDbPlugin` report renamed options instead of sending them, as
  before: neither can know whether the far end reads `.from()` names.

### Fixed — @routier/postgres-plugin-core, @routier/sqlite-plugin (including D1), @routier/mysql-plugin

- A filter on a renamed property now reaches the engine, so `WHERE "display_name" = $1` is issued for
  a property declared as `.from('display_name')`. A join whose inner scope filters on a renamed
  property can now be pushed down too.
- `ORDER BY` names the storage column, or the JSON path through renamed segments for a nested
  property. It used to emit the in-memory name, which was masked while renamed sorts ran in memory.
- `sum`/`min`/`max` read the storage column, and a `map` selecting a renamed property aliases it
  back to the property name. Neither is gated on a filter, so before this fix
  `.sumAsync(x => x.renamed)` failed in the engine with an unknown column.
- `toGroup` over a schema with a renamed property is reported. No statement renders a group, and the
  rows were grouped in JavaScript by in-memory names over rows keyed by column, so every row landed
  under an `undefined` key.

### Added — @routier/sql-plugin-core

- `propertyColumn` and `referencedColumn`, the one renderer filters, sorts, aggregates and
  projections now share for a property's storage column. `selectExpression` aliases a renamed
  root column as well as a nested path.

## Dexie reads use the indexes the schema declares (2026-09-01)

### Fixed — @routier/dexie-plugin 0.4.2

- A filter on a property declared with `.index()`, `.distinct()`, or as the single primary key
  now becomes an IndexedDB index seek instead of a full cursor walk: a strict equality, an OR of
  strict equalities on one property (run as one seek per value — Dexie's own `anyOf` is a
  cursor walk and measured slower than the predicate), one or two range bounds on one property,
  or an equality on every member of a compound `.index("name")` group. The rest of the filter
  still runs as the caller's predicate over the seeked rows; when the seek answers the whole
  filter the predicate is dropped.
- `skip`/`take` go to Dexie after the predicates, so the cursor stops at the window instead of
  reading every match. Dexie composes `offset`/`limit` into the filter chain in call order,
  which is why the predicates are attached first.
- A single `sort` on an indexed, non-nullable string, number, or Date property runs as an
  `orderBy` index walk when no seek is in use, with any remaining predicate applied during the
  walk, so a page deep into a sorted table no longer reads and sorts the whole table.
- `count()` runs in Dexie when the query has no window or projection.
- The translator no longer re-runs every filter predicate in memory over rows Dexie already
  filtered, and the stores string is derived once per compiled schema instead of on every
  operation.
- Date values are never used as seek keys: rows store dates as ISO strings, which a Date key
  does not match, and an `above(Date)` seek would have returned every row.
- Measured at 4k rows in headless Chromium (p50): sort+skip+take page 15.6→6.2ms, count all
  15.7→3.0ms, single-property filter 16.2→11.7ms, filtered sum 14.9→10.0ms, range seek 3.6ms,
  OR-of-two-values count 28→10.4ms.
- Seeks only follow declared indexes, so a schema without `.index()` still walks. Add
  `.index()` to the properties you filter and sort by.

## Filters read as written, and explain says what it ran (2026-09-01)

The filter parser now reads the JavaScript people actually write — the full operator set, with
each engine declaring which calls it can run instead of claiming ones it cannot render — and
`.explain()` reports the predicate itself rather than `<predicate>`, with values held out as `?`
the way a bound statement would. Every plugin released here compiled against new core exports
(`describeFilters` among them), so each one's core peer floor moves to `>=0.7.0` — that is the
version the new dists actually require.

### Breaking — @routier/core 0.7.0

- `PropertyInfo.supportsDeserialization` is removed, along with the internal set of supported
  types it mirrored. `deserialize` is now total: a type it has no conversion for returns the
  value unchanged instead of throwing, so callers call it unconditionally rather than asking
  permission first.
- `EXPRESSION_TYPES` and the `ExpressionType` union are removed from the expressions surface.

### Breaking — @routier/sql-plugin-core 0.7.0

- `canPushDownJoin` is removed. New exports carry the work instead: `canRenderInSql`,
  `selectExpression`, `selectList`, and `columnList`.

### Breaking — @routier/replication-plugin 0.5.0

- `PluginSyncEngine`'s `onMirrorError` context now hands back the failing `plugin` itself
  instead of a `pluginIndex` into an array the caller may not hold. A mirror whose promise
  rejected used to report index `-1`; it now reports the actual plugin too.

### Fixed — @routier/replication-plugin 0.5.0

- `OptimisticUpdatesDbPlugin` hydrates a collection before the first write to it, not only the
  first read. A write before any read used to mark the collection authoritative while memory
  held nothing but that write — every pre-existing source row became invisible for the life of
  the instance. Writes now also wait behind an in-flight hydration, so a stale hydration
  snapshot can no longer land on top of a remove and resurrect it.
- `OptimisticUpdatesDbPlugin` accepts options and exposes `onMirrorError`, so a write that acked
  locally but never reached the durable store is observable instead of being a log line.

### Added — @routier/sqlite-plugin 0.5.1

- The wasm worker caches prepared statements per database (LRU of 64), resetting and rebinding
  instead of re-preparing. Measured at 4k rows over real OPFS: single-write acks ~17% faster,
  by-id reads ~30% faster.

### Fixed — the filter remediation, per engine

- `@routier/datastore` 0.4.1 — the queryable pipeline reports what ran where, and a filter an
  engine refuses runs in memory over the rows the predicate means.
- `@routier/mongodb-plugin` 0.4.1 — MQL translation covers the expanded operator set and stops
  claiming calls it cannot render.
- `@routier/mysql-plugin` 0.5.1 and `@routier/postgres-plugin-core` 0.3.1 — the same claimed-call
  honesty in their dialects.
- `@routier/dexie-plugin` 0.4.1 — `.explain()` shows the JavaScript predicate it walks the cursor
  with, values held out as `?`, keeping the "no index" note that separates a slow backend from a
  silent memory fallback.

## PGlite in the browser, and a shared engine per database (2026-08-24)

A coordinated release across the PostgreSQL family plus a SQLite fix. `@routier/pglite-plugin`
and `@routier/postgres-plugin-core` both take a breaking change.

### Breaking — @routier/postgres-plugin-core 0.2.0

- `PostgresDriver.dispose()` is now `PostgresDriver.destroy()`, and it means "what destroy means
  for this engine" rather than "release the engine". A server driver ends its pool and leaves the
  data; an embedded driver, which owns the storage it created, closes **and deletes**.

  One member rather than a release followed by a delete, because for an engine that serialises
  access the two must happen in one turn — anything in between can start work against a database
  that is about to be deleted underneath it. Only affects code implementing this driver; nothing
  in a plugin's public surface changes.

### Breaking — @routier/pglite-plugin 0.2.0

- `destroy()` now **deletes the data**, where before it closed the database and left it. This is
  what the shared plugin contract requires of an embedded plugin, and what `@routier/dexie-plugin`
  and `@routier/sqlite-plugin` already did. The plugin was the outlier: it inherited a server's
  semantics from `@routier/postgres-plugin-core`, where refusing to drop somebody's database is
  correct. It now runs the shared contract suite, which is what would have caught the divergence.

  To release a database without deleting it, hold the instance yourself and wrap it with
  `pgliteDbPlugin`.

- A bare database name no longer always resolves to `opfs-ahp://`. It now resolves to the fastest
  storage that persists on the current browser: OPFS, or IndexedDB on WebKit, which caps
  synchronous access handles at 252 while a PostgreSQL installation needs over 300 files. Naming
  a prefix outright still wins, and still fails on WebKit if you ask for OPFS there.

  Every iOS browser is WebKit, not only Safari, and an iPad asking for the desktop site sends a
  Macintosh user agent — both are handled.

- `pgliteDbPlugin`'s `destroy` closes the instance and then **fails**, rather than reporting
  success over data it did not delete. It wraps an engine the caller owns, so it cannot know where
  the storage is. Pass `deleteStorage` in the options to opt back in.

### Added — @routier/pglite-plugin 0.2.0

- One engine per data directory, shared by every store over it, in Node and the browser. A
  component that rebuilds its store on each mount pays for one worker and one PostgreSQL boot
  rather than one per mount. The engine starts on first use, and starts again after a destroy, so
  a store that shares a destroyed database opens a fresh empty one instead of holding a closed
  connection. Opening one directory twice with a different `workerUrl` or set of `extensions` is
  refused rather than served by a second engine.

- `@routier/pglite-plugin/browser-storage`, a subpath with `resolveDataDir` for showing a user
  where the data went and `deleteDataDir` for removing storage that has no live store. A subpath
  because TypeScript does not resolve the `browser` export condition, so browser-only helpers on
  the root entry are invisible to it.

### Fixed — @routier/postgres-plugin-core 0.2.0

- A `vector` column no longer fails to create against a database where the extension is missing.
  The probe that decides whether a real vector column is possible is answered once per plugin
  instance, and the database it described is not necessarily the one being written to later — an
  embedded engine another store destroyed is replaced by an empty one. The extension is now
  installed at table-creation time rather than the DDL failing on `type "vector" does not exist`.

- `destroy` no longer closes the engine out from under work in flight, on a driver that
  serialises: close and delete take a queue turn like every other operation.

### Fixed — @routier/sqlite-plugin 0.4.1

- The OPFS SAH pool now grows instead of stopping at six databases. It is a fixed set of
  preallocated file handles and does not grow on demand, so a page holding a seventh open database
  failed with `SQLITE_CANTOPEN` on a database that was perfectly fine. Headroom is kept for the
  rollback journal, which is a second file created mid-transaction rather than at open. A pool that
  is genuinely full now says so, naming the capacity and how to recover.

- Two operations arriving together on one database name share a single open, instead of each
  opening it — two pool slots for one name, each growing the pool for the other.

### Changed — @routier/postgresql-plugin 0.5.1

- No behaviour change. Its driver implements the renamed `destroy()` member, so it requires
  `@routier/postgres-plugin-core` at `>=0.2.0`.

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
