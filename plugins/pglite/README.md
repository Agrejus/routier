# @routier/pglite-plugin

<p align="center">
  <img src="https://routier.dev/routier.svg" alt="Routier" width="140" height="140" />
</p>

Real PostgreSQL, in WebAssembly. In the browser it persists to OPFS and is safe across tabs; in
Node it runs in-process against a directory or memory.

It is the same dialect as `@routier/postgresql-plugin` — both build their statements with
`@routier/postgres-plugin-core` — so a query that works against your server works here.

## Install

```bash
npm install @routier/pglite-plugin @electric-sql/pglite
```

## Browser

```ts
import { PGliteDbPlugin } from "@routier/pglite-plugin";
import { DataStore } from "@routier/datastore";

class AppStore extends DataStore {
  products = this.collection(productSchema).proxy().create();
}

const store = new AppStore(new PGliteDbPlugin("app"));
```

The name is PGlite's data directory, and its prefix chooses the storage:

| Value | Storage |
|---|---|
| `"app"` | The fastest storage that persists here: `opfs-ahp://`, or `idb://` on WebKit |
| `"opfs-ahp://app"` | OPFS, named outright |
| `"idb://app"` | IndexedDB. Slower, and the only one WebKit can hold PostgreSQL in |
| `"memory://app"` | Lost on navigation |

There is no separate `storage` option, because the prefix already says it. To show a user where
the data actually went, `resolveDataDir(name, navigator.userAgent)` from
`@routier/pglite-plugin/browser-storage` returns the same answer the constructor used. It is a
subpath because TypeScript does not resolve the `browser` condition — on the root entry it would
resolve the Node build's types and not be visible at all.

### What your build has to do

Serve PGlite's `.wasm` and `.data` assets, and let your bundler emit the worker.
`new Worker(new URL(...), { type: 'module' })` is the form Vite, webpack 5 and Rspack all
understand. Pass `workerUrl` if your setup needs a different URL.

No COOP or COEP headers are required.

**Vite needs two settings.** Without the first the production build fails outright:

```ts
export default defineConfig({
  // Vite's default worker format is `iife`, which cannot code-split. PGlite reaches its
  // filesystems through dynamic imports, so the build fails with "UMD and IIFE output
  // formats are not supported for code-splitting builds".
  worker: { format: "es" },
  optimizeDeps: {
    // esbuild pre-bundling rewrites module URLs, breaking the worker URL and PGlite's own
    // .wasm/.data lookups.
    exclude: ["@routier/pglite-plugin", "@routier/postgres-plugin-core", "@electric-sql/pglite"],
  },
});
```

A complete, working setup is in `examples/pglite-console`.

### Expected console output

PGlite reports every server error to the console before the client decides what to do with it,
so two handled failures are visible on first use: `extension "vector" is not available` (the
pgvector probe) and `relation "..." does not exist` (the lazy `CREATE TABLE` miss). Both are
recovered.

### Durability

OPFS is per origin and survives reload and navigation. A browser may evict it under storage
pressure unless the origin is persisted — `navigator.storage.persist()` asks.

### Tabs

Multi-tab safe. One tab is elected leader and owns the database; the rest proxy their queries to
it, and another election runs when the leader closes.

### Safari, and every browser on iOS

Handled, as long as you pass a bare name. WebKit caps synchronous access handles at 252 and a
PostgreSQL installation needs over 300 files, so `opfs-ahp` cannot open there — a bare name
resolves to `idb://` instead. Every iOS browser is WebKit, not only Safari.

Naming `opfs-ahp://` outright still fails on WebKit. It has to: you said which storage you
wanted.

### Destroying a database

`destroy()` closes the database **and deletes it**, the same as `@routier/dexie-plugin` and
`@routier/sqlite-plugin`. The shared plugin contract requires it.

```ts
await store.destroyAsync();   // closed, and the data is gone
```

It takes a moment longer than a plain close. `destroy` cannot delete until the browser has
released the terminated worker's OPFS access handles, and that happens after the close which
terminated it has already resolved, so it retries internally.

There is nothing to close by hand. The plugin opens a connection per operation and releases it
in a `finally`, so between saves it holds no connection open — you never connect or disconnect,
and a store you simply stop using needs no call at all.

`pgliteDbPlugin` is for **sharing** one database with code outside Routier — a sync client, a
live query, an extension set the shipped entry points do not build. It closes the instance you
handed it and does not delete, because that lifecycle is yours. Do not reach for it as a way to
avoid `destroy`.

### Size

PGlite is roughly 3 MB of WebAssembly plus its data file. That is the price of real PostgreSQL in
a browser, and it is not the right default for a small application — `@routier/dexie-plugin` and
`@routier/sqlite-plugin` are much smaller.

## Node

The `node` export condition selects an in-process build with no worker.

```ts
import { PGliteDbPlugin } from "@routier/pglite-plugin";

new PGliteDbPlugin("./data/app"); // a directory on disk
new PGliteDbPlugin("memory://app"); // discarded when the process exits
```

Useful for tests: it is the strict engine, with no container to start.

## pgvector

`s.vector()` and `.nearest()` work either way. Without the extension the embedding is stored as
JSONB and the search is scored in memory; with it you get a real `vector(n)` column and `<=>`
ordering.

pgvector ships separately, and extensions are constructed inside the worker, so in the browser you
supply your own worker:

```bash
npm install @electric-sql/pglite-pgvector
```

```ts
// my-pglite-worker.js
import { PGlite } from "@electric-sql/pglite";
import { worker } from "@electric-sql/pglite/worker";
import { vector } from "@electric-sql/pglite-pgvector";

worker({
  init: (options) => new PGlite({ dataDir: options.dataDir, extensions: { vector } }),
});
```

```ts
new PGliteDbPlugin("app", {
  workerUrl: new URL("./my-pglite-worker.js", import.meta.url),
});
```

In Node, pass the extension directly:

```ts
import { vector } from "@electric-sql/pglite-pgvector";

new PGliteDbPlugin("./data/app", { extensions: { vector } });
```

## An instance you already have

To share one database with code outside Routier — a live query, a sync client, an extension set
this package does not know about:

```ts
import { pgliteDbPlugin } from "@routier/pglite-plugin";

const store = new AppStore(pgliteDbPlugin("app", existingPGliteInstance));
```

## Notes

- Tables are created lazily on first use. This plugin does not run migrations.
- `destroy()` closes the database and deletes it, like the other embedded plugins here, and
  unlike `@routier/postgresql-plugin`, which disconnects from a server it does not own.
- Connections are the plugin's business. One is taken per operation and released in a
  `finally`; a save is a single `BEGIN`/`COMMIT` on one connection. Nothing is held open
  between operations, and no caller ever sees a connection.
- **One engine per data directory, shared by every store over it.** A component that rebuilds
  its store on each mount pays for one worker and one PostgreSQL boot, not one per mount. The
  driver is what is shared, not just the worker: PGlite is a single connection and the driver
  serialises access to it, so two drivers over one instance would each believe they had it to
  themselves and one store's `BEGIN` would land inside another's transaction.
- **The engine starts on first use and can start again.** A `destroy` closes it, deletes the
  directory and leaves the slot cold; a store that shares it and was not itself destroyed opens
  a fresh engine on its next operation and finds the data gone — the same thing a surviving
  `@routier/dexie-plugin` or `@routier/sqlite-plugin` store sees. The destroyed store itself
  fails with `PluginDestroyedError`, per instance.
- Close and delete both happen inside the driver's queue, so a destroy waits for an operation
  that is in flight instead of closing the database underneath it.
- The engine is keyed by data directory alone. Opening one directory a second time with a
  different `workerUrl`, or a different set of `extensions`, is refused rather than served by a
  second engine — two engines over one directory means two write paths over one set of files.
- `pgliteDbPlugin` takes an instance you own, so it cannot know where the storage is. Its
  `destroy` closes the instance and then fails, rather than reporting data deleted that is still
  there. Pass `deleteStorage` in the options if you know how to remove it.
- PGlite has one connection, so the plugin runs one operation at a time against it. A save and a
  view's reconcile queue rather than interleave.

## License

MIT
