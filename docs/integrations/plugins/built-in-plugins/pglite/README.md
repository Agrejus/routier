---
title: PGlite Plugin
---

# PGlite Plugin

`@routier/pglite-plugin` runs PostgreSQL in WebAssembly. In the browser it stores data in OPFS. In Node it stores data in a directory or in memory. Package export conditions select the build.

The plugin generates the same SQL as `@routier/postgresql-plugin`. Both build their statements with `@routier/postgres-plugin-core`. A query that runs against your server runs here.

## Basic usage

```bash
npm install @routier/pglite-plugin @electric-sql/pglite
```

```ts
import { PGliteDbPlugin } from "@routier/pglite-plugin";

class AppStore extends DataStore {
  products = this.collection(productSchema).proxy().create();
  constructor() { super(new PGliteDbPlugin("app")); }
}
```

## Storage

The name is PGlite's data directory. The prefix selects the storage.

| Value | Environment | Storage | Survives a reload |
| --- | --- | --- | --- |
| `"app"` | Browser | OPFS (`opfs-ahp://app`) | Yes |
| `"idb://app"` | Browser | IndexedDB | Yes |
| `"memory://app"` | Both | Memory | No |
| `"./data/app"` | Node | Directory | Yes |

There is no separate `storage` option. The prefix states where the data lives.

## Browser

The database runs in a Web Worker. This is a requirement, not a choice: `createSyncAccessHandle` does not exist on the main thread, and PGlite's OPFS filesystem needs it.

Your bundler emits the worker from `new Worker(new URL(...), { type: "module" })`. Vite, webpack 5 and Rspack all support this form. Pass `workerUrl` if your build needs a different URL.

Serve the `.wasm` and `.data` assets that PGlite loads at run time. COOP and COEP headers are not required.

### Tabs

The plugin is safe across tabs. One tab is elected leader and owns the database. Other tabs send their queries to the leader. A new election runs when the leader closes.

### Safari

`opfs-ahp` does not work in Safari. Safari limits an origin to 252 open sync access handles. A PostgreSQL installation needs more than 300 files. Use `idb://` in Safari.

### Download size

PGlite is about 3 MB of WebAssembly, plus its data file. Use `@routier/dexie-plugin` or `@routier/sqlite-plugin` when size matters more than PostgreSQL parity.

## Node

The `node` export condition selects an in-process build with no worker.

```ts
import { PGliteDbPlugin } from "@routier/pglite-plugin";

new PGliteDbPlugin("./data/app");
new PGliteDbPlugin("memory://app");
```

Tests use this build. It gives PostgreSQL behaviour without a container.

## Vectors

`s.vector()` and `.nearest()` work with or without pgvector. Without the extension, the plugin stores the embedding as JSONB and scores the search in memory. With the extension, the plugin creates a `vector(n)` column and PostgreSQL orders the rows with `<=>`.

pgvector ships as a separate package. Extensions are built inside the worker, so a browser application supplies its own worker.

1. Install the extension.

   ```bash
   npm install @electric-sql/pglite-pgvector
   ```

2. Write a worker that loads it.

   ```ts
   import { PGlite } from "@electric-sql/pglite";
   import { worker } from "@electric-sql/pglite/worker";
   import { vector } from "@electric-sql/pglite-pgvector";

   worker({
     init: (options) => new PGlite({ dataDir: options.dataDir, extensions: { vector } }),
   });
   ```

3. Point the plugin at that worker.

   ```ts
   new PGliteDbPlugin("app", {
     workerUrl: new URL("./my-pglite-worker.js", import.meta.url),
   });
   ```

In Node, pass the extension to the plugin instead.

```ts
import { vector } from "@electric-sql/pglite-pgvector";

new PGliteDbPlugin("./data/app", { extensions: { vector } });
```

## An existing instance

Use `pgliteDbPlugin` to share one database with code outside Routier, such as a live query or a sync client.

```ts
import { pgliteDbPlugin } from "@routier/pglite-plugin";

const store = new AppStore(pgliteDbPlugin("app", existingPGliteInstance));
```

## Guarantees and limits

- A save runs in one transaction and rolls back whole on failure.
- The plugin creates a missing table on first use. It does not run migrations.
- Root objects and arrays use JSONB.
- `ConcurrencyDbPlugin` is supported. A conflict raises `OptimisticConcurrencyError`.
- `destroy()` closes the database and keeps the data. `@routier/sqlite-plugin` deletes the database instead.
- PGlite has one connection. The plugin runs one operation at a time. A save and a view reconcile queue instead of running together.
