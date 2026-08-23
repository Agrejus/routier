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
| `"app"` | `opfs-ahp://app` — the default |
| `"idb://app"` | IndexedDB. Slower, but works in Safari |
| `"memory://app"` | Lost on navigation |

There is no separate `storage` option, because the prefix already says it.

### What your build has to do

Serve PGlite's `.wasm` and `.data` assets, and let your bundler emit the worker.
`new Worker(new URL(...), { type: 'module' })` is the form Vite, webpack 5 and Rspack all
understand. Pass `workerUrl` if your setup needs a different URL.

No COOP or COEP headers are required.

### Durability

OPFS is per origin and survives reload and navigation. A browser may evict it under storage
pressure unless the origin is persisted — `navigator.storage.persist()` asks.

### Tabs

Multi-tab safe. One tab is elected leader and owns the database; the rest proxy their queries to
it, and another election runs when the leader closes.

### Safari

`opfs-ahp` does **not** work in Safari. Safari caps synchronous access handles at 252 and a
PostgreSQL installation needs over 300 files. Use `idb://` there.

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
- `destroy()` closes the database. It does not delete the data — same as
  `@routier/postgresql-plugin`, and unlike `@routier/sqlite-plugin`.
- PGlite has one connection, so the plugin runs one operation at a time against it. A save and a
  view's reconcile queue rather than interleave.

## License

MIT
