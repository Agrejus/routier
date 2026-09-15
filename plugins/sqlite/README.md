# @routier/sqlite-plugin

<p align="center">
  <img src="https://routier.dev/routier.svg" alt="Routier" width="140" height="140" />
</p>

Routier storage backed by SQLite, in Node and in the browser.

```ts
import { DataStore } from "@routier/datastore";
import { SqliteDbPlugin } from "@routier/sqlite-plugin";

class AppStore extends DataStore {
  constructor() {
    super(new SqliteDbPlugin("app.sqlite"));
  }
}
```

That code runs in both places. The package declares `browser` and `node` conditions, so a
bundler targeting the web resolves the WebAssembly build and Node resolves `node:sqlite`. Test
runners pick one or the other by their own rules — see [Tests](#tests-vitest-jest).

The plugin builds its SQL with `@routier/sql-plugin-core`, which it shares with the PostgreSQL
and MySQL plugins.

## Engines

The plugin talks to SQLite through a small driver interface — `all`, `run`, `close`,
`deleteDatabase`. Three drivers ship with it.

| Driver | Where | Storage | Install |
| --- | --- | --- | --- |
| `node:sqlite` (default in Node) | Node 22.5+ | a file | nothing |
| `wasmDriver()` (default in a browser) | any modern browser | OPFS | `@sqlite.org/sqlite-wasm` |
| `sqlite3Driver()` | Node 18+ | a file | `sqlite3` |

Neither optional engine is installed for you: a Node application does not download a WASM
binary, and a web application does not build a native module. `sqlite3` is an optional **peer**
dependency. `@sqlite.org/sqlite-wasm` is not declared at all — see [The browser](#the-browser).

### Node 18 or 20

`node:sqlite` needs Node 22.5. On an older Node, pass the `sqlite3` driver and install
`sqlite3` yourself:

```ts
import { SqliteDbPlugin } from "@routier/sqlite-plugin";
import { sqlite3Driver } from "@routier/sqlite-plugin/drivers/sqlite3";

new SqliteDbPlugin("app.sqlite", { driver: sqlite3Driver() });
```

### The browser

Install the engine, and let your bundler emit the worker and serve the `.wasm` asset:

```
npm install @sqlite.org/sqlite-wasm@3.53.0-build1
```

`@sqlite.org/sqlite-wasm` is **required** by the browser driver but deliberately **not** declared
as a peer dependency. Every upstream release is prerelease-tagged (`3.53.0-build1`,
`3.53.4-build1`), and semver ranges never match a prerelease, so any declared range made npm
fail with `ETARGET`. Install an exact build. This release is tested against `3.53.0-build1`.
Without the package, the first query fails with "The SQLite worker failed to load".

Two things are worth knowing.

**It runs in a worker, and that is not optional.** OPFS is reachable only from a worker —
`FileSystemFileHandle.createSyncAccessHandle`, which every OPFS VFS is built on, is undefined
on the main thread. The driver spawns the worker for you with
`new Worker(new URL('./wasmWorker.js', import.meta.url), { type: 'module' })`, the form Vite,
webpack 5 and Rspack all understand. Pass `workerUrl` if your setup needs a different one.

**No COOP or COEP headers are required.** The driver uses the `opfs-sahpool` VFS rather than
the plain `opfs` one, which needs `SharedArrayBuffer` and therefore cross-origin isolation.
An ordinary page works.

For a database that should not survive a reload:

```ts
import { SqliteDbPlugin, wasmDriver } from "@routier/sqlite-plugin";

new SqliteDbPlugin("app.sqlite", { driver: wasmDriver({ storage: "memory" }) });
```

### Tests (Vitest, Jest)

A test runner does not choose a build the way a bundler does.

- **Vitest** externalises `node_modules` and loads them with Node's resolver, which matches
  `node`, not `browser`. Under `environment: "jsdom"` you get the **Node** build.
- **Jest** with `jest-environment-jsdom` enables the `browser` condition by default, so you get
  the **browser** build — which imports fine and then fails on the first open with
  `Worker is not defined`. jsdom has no `Worker` and no OPFS, and even `storage: "memory"` runs
  in the worker.

For tests that exercise your data logic, the Node build is the right one: the runner is Node
22.5+, `node:sqlite` is loaded lazily, and it is the same SQL the browser runs. In Jest, ask for
it explicitly:

```js
// jest.config.js
module.exports = {
  testEnvironment: "jsdom",
  testEnvironmentOptions: { customExportConditions: ["node", "node-addons"] },
};
```

To cover OPFS and the WASM worker themselves, run in a real browser — Vitest browser mode or
Playwright. jsdom cannot.

To see which build loaded, list the exports: the browser build has `wasmDriver`, the Node build
has `nodeSqliteDriver`.

```ts
console.log(Object.keys(await import("@routier/sqlite-plugin")));
```

## Contracts

### Durability

SQLite's own. A committed transaction is on disk when `COMMIT` returns.

Every save runs inside one `BEGIN IMMEDIATE` transaction. If any statement fails, the whole
save rolls back and the plugin reports the error.

### Column types

SQLite has no boolean, date, array, or object column type. The plugin maps them as follows.

| Schema type | Column type | Notes |
|---|---|---|
| `s.string()` | `TEXT` | |
| `s.number()` | `REAL` | |
| `s.boolean()` | `INTEGER` | Stored as 0 or 1 |
| `s.date()` | `TEXT` | ISO-8601 |
| `s.object()`, `s.array()` | `JSON` | One column per root property |

Nested objects and arrays round-trip without a schema serializer. Booleans and dates come back
as the stored form, so declare `.serialize()` and `.deserialize()` on those properties if you
need the original JavaScript type. This is why the plugin runs the contract kit with
`supportsRichTypes: false`.

### Concurrency

SQLite serializes writers at the file level. In Node the plugin opens one connection per
operation and closes it on every completion path, which is what lets that file locking do its
job.

In the browser there is no second process to lock against, so the worker holds one database
open for the life of the page and `close()` is a no-op. The SAH pool takes **exclusive** OPFS
access handles: two tabs on one origin cannot hold the same database, and the second fails to
open rather than corrupting it. Treat the browser plugin as single-tab unless you coordinate
above it.

**The pool grows as databases are opened.** It is a fixed set of preallocated file handles —
six by default — and every database held open takes one, so the seventh used to fail with
`SQLITE_CANTOPEN` on a database that was perfectly fine. The worker now adds capacity before
the pool runs out, and keeps slack for the rollback journal, which is a second file created
mid-transaction rather than at open. `destroyAsync()` unlinks a database and returns its slot.

`BEGIN IMMEDIATE` takes the write lock up front, so a contended file fails the save with
`SQLITE_BUSY` instead of failing part-way through.

Optimistic concurrency is supported. Wrap the plugin in `ConcurrencyDbPlugin` and a stale
write fails with `OptimisticConcurrencyError` naming the row.

### Process boundary

In Node, several processes may use one file. SQLite's locking makes that safe. Throughput is
another matter: writers wait for each other.

In the browser, the boundary is the origin. OPFS storage is per origin and is not shared
across origins. A browser may evict it under storage pressure unless the origin is persisted;
`navigator.storage.persist()` asks for that.

### Schema migration

**Initialization only.** The plugin runs `CREATE TABLE` when a table is missing. It never
alters an existing table.

A schema change that adds, removes, or renames a column does not change a table that already
exists, and the next write fails on the missing column. Migrate the database yourself.

### Disposal

Call `store.destroyAsync()` to close and delete the database — the file in Node, the OPFS
entry in a browser.

In Node, connections are per-operation and always closed, so a store that is never destroyed
holds no file handles. A test run needs no `--forceExit` on account of this plugin.

### Failure semantics

- A statement error rolls the transaction back and fails the save.
- A file that cannot be opened — a directory in its place, a permissions failure, a missing
  parent — fails the operation. It does not crash the process and does not hang.
- A concurrency conflict fails the save with `OptimisticConcurrencyError` and writes nothing.
- In the browser, a worker that cannot load fails every pending operation with an error naming
  the cause, rather than leaving them unresolved.

## Supported versions

**Node 22.5 or later** with the default `node:sqlite` engine, which is built into Node and
compiles nothing on install. Node 18 and 20 work with `sqlite3Driver()`.

Browsers need OPFS and module workers: Chrome and Edge 108+, Safari 17+, Firefox 111+. The
`memory` storage mode has no OPFS requirement.

## See also

- [SQLite plugin guide](https://routier.dev/integrations/plugins/built-in-plugins/sqlite/README)
