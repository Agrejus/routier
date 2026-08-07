# Change Log

Hand-written, one section per release, grouped by package with breaking changes first. See
`RELEASING.md` for the procedure.

## Unreleased

Thirty-seven defects fixed, recorded as `specs/known-defects.md` #27 through #63, plus the first
CI this repository has had. Every publishable package changed.

Most of these were found by pointing tests at something real for the first time — a MySQL
server, a CouchDB server, three SQL engines answering the same question, and a sync server that
can change its data behind the client's back. None of them were visible to the suites that
existed.

### Versions

Independent, not lockstep. On `0.x` a minor bump means a breaking change, so bumping an
unaffected package to `0.3.0` would claim a break that did not happen.

| Package | From | To | Why |
| --- | --- | --- | --- |
| `@routier/pouchdb-plugin` | 0.2.0 | **0.3.0** | breaking: sync callback types |
| `@routier/replication-plugin` | 0.2.1 | **0.3.0** | breaking: no `skip`/`take` pushdown |
| `@routier/core` | 0.2.1 | **0.3.0** | `s.file()`, corrected wrapper inference |
| `@routier/datastore` | 0.2.1 | 0.2.2 | fixes |
| `@routier/postgresql-plugin` | 0.2.1 | 0.2.2 | fixes, republish (see below) |
| `@routier/browser-storage-plugin` | 0.2.0 | 0.2.1 | fixes, republish (see below) |
| `@routier/sqlite-plugin` | 0.2.0 | **0.3.0** | breaking: default engine, Node floor |
| `@routier/dexie-plugin` | 0.2.0 | **0.3.0** | breaking: index layout changed |
| `@routier/file-system-plugin` | 0.2.0 | 0.2.1 | fixes |
| `@routier/memory-plugin` | 0.2.0 | 0.2.1 | packaging, docs |
| `@routier/react` | 0.2.0 | 0.2.1 | packaging |
| `@routier/mysql-plugin` | — | 0.2.0 | first publish |
| `@routier/sql-plugin-core` | — | 0.2.0 | first publish |

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
- **`@routier/encryption-plugin`** (new, 0.1.0) — field-level encryption as a wrapper, so one
  implementation covers all nine backends. `encrypted(s.string())` is randomised: a fresh IV
  per write, nothing leaks, and a filter on it throws rather than quietly becoming a full
  scan. `encrypted(s.string(), { searchable: true })` is deterministic, so an equality filter
  still runs in the database against an index — at the cost of revealing which rows share a
  value, which is why it is opt-in. Keys live in a keyring with ids and every value records
  the id that wrote it, so rotation adds a key instead of replacing one. AES-GCM authenticates,
  so a value altered in the database fails to decrypt rather than reading back as anything.
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
