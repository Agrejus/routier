---
title: SQLite Plugin
---

# SQLite Plugin

`@routier/sqlite-plugin` runs in Node and in modern browsers. Package export conditions select the environment-specific default.

## Basic usage

```bash
npm install @routier/sqlite-plugin
```

```ts
import { SqliteDbPlugin } from "@routier/sqlite-plugin";

class AppStore extends DataStore {
  products = this.collection(productSchema).proxy().create();
  constructor() { super(new SqliteDbPlugin("app.sqlite")); }
}
```

## Drivers

| Driver | Environment | Storage | Additional install |
| --- | --- | --- | --- |
| `nodeSqliteDriver()` (Node default) | Node 22.5+ | File | None |
| `wasmDriver()` (browser default) | Modern browser | OPFS | `@sqlite.org/sqlite-wasm` |
| `sqlite3Driver()` | Node 18+ | File | `sqlite3` |
| `tursoDriver(client)` | Node/browser | libSQL/Turso client | `@libsql/client` |
| D1 entry point | Cloudflare Workers | D1 | Platform binding |

### Node 18 or 20

```ts
import { SqliteDbPlugin } from "@routier/sqlite-plugin";
import { sqlite3Driver } from "@routier/sqlite-plugin/drivers/sqlite3";

new SqliteDbPlugin("app.sqlite", { driver: sqlite3Driver() });
```

### Browser

Install `@sqlite.org/sqlite-wasm`; the default browser entry uses a worker and OPFS. It uses `opfs-sahpool`, so COOP/COEP headers are not required. For non-durable browser data, pass `wasmDriver({ storage: "memory" })`.

`@sqlite.org/sqlite-wasm` is required for the browser driver but is not declared as a peer dependency: every upstream release is prerelease-tagged, so no semver range can match it. Install an exact build, for example `npm install @sqlite.org/sqlite-wasm@3.53.0-build1` (the version the plugin is tested against).

### Testing

Test runners resolve export conditions differently from bundlers. Vitest loads `node_modules` with Node's resolver, so even `environment: "jsdom"` gets the Node build — which is the right one for logic tests. Jest's `jest-environment-jsdom` enables the `browser` condition and gets the WASM build, which fails with `Worker is not defined`; set `testEnvironmentOptions: { customExportConditions: ["node", "node-addons"] }` to get the Node build. Test OPFS and the worker in a real browser (Vitest browser mode or Playwright). `Object.keys(await import("@routier/sqlite-plugin"))` contains `wasmDriver` in the browser build and `nodeSqliteDriver` in the Node build.

### Turso/libSQL

```ts
import { createClient } from "@libsql/client";
import { SqliteDbPlugin } from "@routier/sqlite-plugin";
import { tursoDriver } from "@routier/sqlite-plugin/drivers/turso";

const client = createClient({ url, authToken });
new SqliteDbPlugin("app", { driver: tursoDriver(client) });
```

## Connections and performance

In Node (`nodeSqliteDriver()` and `sqlite3Driver()`), each plugin keeps two connections open instead of opening one per operation:

| Connection | Used by | Behaviour |
| --- | --- | --- |
| Writer | Saves | One save at a time, each in a `BEGIN IMMEDIATE` transaction |
| Reader | Queries | Never sees a save that is in progress or rolled back, and never waits for one |

- A connection idle for one second is closed, and reopened on next use.
- `nodeSqliteDriver()` also keeps each connection's 64 most recently used prepared statements.
- Other plugins and processes on the same file still contend through SQLite's file locks.

Measured on one core against 0.6.0:

| Workload | Change |
| --- | --- |
| Small queries | about 50% faster |
| Saves | about 30% faster |

`wasmDriver()` is unchanged: the browser worker already holds one database open per page. `tursoDriver()` and D1 still use one connection per operation.

### In-memory databases

SQLite gives each connection its own `":memory:"` database, so an in-memory plugin gets exactly one connection. Saves and queries take turns on it, a query never sees a save in progress, and it is never closed for being idle. The data lasts until `destroyAsync()`, and each plugin starts with its own empty database.

```ts
new SqliteDbPlugin(":memory:");
```

Requires `@routier/sqlite-plugin` 0.6.1 or later; earlier versions lost every row.

### Custom drivers

A `SqliteDriver` that can keep a connection open across operations sets `keepsConnections: true` to get the writer and reader above. Without it, the plugin opens and closes a connection for every operation.

## Guarantees and limits

- A normal SQLite save uses one `BEGIN IMMEDIATE` transaction and rolls back whole on failure.
- A save of any size is split into statements that fit SQLite's limits (32,766 parameters, 500 removed rows) inside that one transaction (0.6.2 and later).
- Objects, arrays, and vectors use JSON unless a driver/backend adds native support.
- Missing tables and indexes are created lazily; existing schema migration is your responsibility.
- `ConcurrencyDbPlugin` is supported by the ordinary SQLite drivers, but Cloudflare D1 explicitly rejects it because D1 cannot provide the required conditional-update contract.
- The browser worker is required for OPFS sync access handles; the plugin creates it for common bundlers.

See [Server Database Plugins](/integrations/plugins/built-in-plugins/server-databases), [Wrapper Plugins](/integrations/plugins/built-in-plugins/wrappers), and the [generated SQLite API](/reference/api/plugins/sqlite/src/README).
