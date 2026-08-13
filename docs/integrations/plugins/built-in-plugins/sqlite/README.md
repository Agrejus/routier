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

### Turso/libSQL

```ts
import { createClient } from "@libsql/client";
import { SqliteDbPlugin } from "@routier/sqlite-plugin";
import { tursoDriver } from "@routier/sqlite-plugin/drivers/turso";

const client = createClient({ url, authToken });
new SqliteDbPlugin("app", { driver: tursoDriver(client) });
```

## Guarantees and limits

- A normal SQLite save uses one `BEGIN IMMEDIATE` transaction and rolls back whole on failure.
- Objects, arrays, and vectors use JSON unless a driver/backend adds native support.
- Missing tables and indexes are created lazily; existing schema migration is your responsibility.
- `ConcurrencyDbPlugin` is supported by the ordinary SQLite drivers, but Cloudflare D1 explicitly rejects it because D1 cannot provide the required conditional-update contract.
- The browser worker is required for OPFS sync access handles; the plugin creates it for common bundlers.

See [Server Database Plugins](/integrations/plugins/built-in-plugins/server-databases), [Wrapper Plugins](/integrations/plugins/built-in-plugins/wrappers), and the [generated SQLite API](/reference/api/plugins/sqlite/src/README).
