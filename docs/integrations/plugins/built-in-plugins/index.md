---
title: Plugins
---

# Plugins

A `DataStore` needs one storage `IDbPlugin`. Start with the backend that owns your rows, then add only the capabilities your application needs.

## Start here

| I need to… | Go to |
| --- | --- |
| Choose where rows are stored | [Choose a storage plugin](#choose-a-storage-plugin) |
| Add caching, retries, concurrency, or batching | [Wrapper Plugins](/integrations/plugins/built-in-plugins/wrappers) |
| Measure or trace database operations | [Wrapper Plugins](/integrations/plugins/built-in-plugins/wrappers#telemetrydbplugin) or [OpenTelemetry](/integrations/plugins/built-in-plugins/otel) |
| Sync over HTTP or build a local-first/SWR stack | [Replication & SWR](/integrations/plugins/built-in-plugins/replication/README) |
| Store file attachments or upload directly to S3/R2 | [Files and Blob Storage](/integrations/plugins/built-in-plugins/files) |
| Encrypt selected schema properties | [Encryption](/integrations/plugins/built-in-plugins/encryption) |
| Combine several plugins safely | [Composition Recipes](/guides/plugin-compositions) |
| Add a new database backend | [Build a Storage Plugin](/integrations/plugins/create-your-own/) |

Application code does not implement query or result translation. Those are plugin-author responsibilities used only when adapting a new backend; they live under **Plugins → Plugin Authors** in navigation.

## Choose a storage plugin

| Package | Environment / backend | Constructor | Important constraint |
| --- | --- | --- | --- |
| [`@routier/memory-plugin`](/integrations/plugins/built-in-plugins/memory/README) | Any; volatile memory | `new MemoryPlugin(databaseName?)` | Data ends with the process |
| [`@routier/browser-storage-plugin`](/integrations/plugins/built-in-plugins/local-storage/README) | Browser `localStorage` or `sessionStorage` | `new BrowserStoragePlugin(name, storage)` | Whole-collection synchronous writes; one writer across tabs |
| [`@routier/dexie-plugin`](/integrations/plugins/built-in-plugins/dexie/README) | Browser IndexedDB | `new DexiePlugin(name, { version? })` | Bump `version` when index/schema layout changes |
| [`@routier/file-system-plugin`](/integrations/plugins/built-in-plugins/file-system/README) | Node JSON files | `new FileSystemPlugin(path, name)` | One process; rewrites a whole collection |
| [`@routier/sqlite-plugin`](/integrations/plugins/built-in-plugins/sqlite/README) | Node or browser/OPFS | `new SqliteDbPlugin(name, { driver? })` | Node default needs 22.5+; optional drivers cover older Node/browser |
| `@routier/postgresql-plugin` | PostgreSQL via `pg` | `new PostgresDbPlugin(config)` | No automatic schema migration |
| `@routier/mysql-plugin` | MySQL via `mysql2` | `new MysqlDbPlugin(config)` | No automatic schema migration |
| `@routier/mongodb-plugin` | MongoDB | `new MongoDbPlugin(driver, databaseName?)` | Transactions require a replica set and an explicit driver choice |
| [`@routier/pouchdb-plugin`](/integrations/plugins/built-in-plugins/pouchdb/README) | PouchDB / CouchDB replication | `new PouchDbPlugin(name, options?)` | One physical document store; scope logical collections |

See [Server Database Plugins](/integrations/plugins/built-in-plugins/server-databases) for PostgreSQL, MySQL, and MongoDB setup and contracts.

## Add behavior with wrappers

Wrappers also implement `IDbPlugin`, so they can be nested:

```ts
const plugin = new CacheDbPlugin(
  new RetryDbPlugin(new PostgresDbPlugin(config), { attempts: 3 }),
  { max: 100 },
);
```

| Wrapper | Package | Purpose |
| --- | --- | --- |
| `CacheDbPlugin` | `@routier/core/plugins` | Read-through LRU; invalidates writes passing through it |
| `RetryDbPlugin` | `@routier/core/plugins` | Retries reads only |
| `ConcurrencyDbPlugin` | `@routier/core/plugins` | Hidden version column and optimistic concurrency |
| `BatchingDbPlugin` | `@routier/core/plugins` | Serializes writes and optionally coalesces atomic saves |
| `TelemetryDbPlugin` | `@routier/core/plugins` | One timing event per operation, to a sink or the logger |
| `OtelDbPlugin` | `@routier/otel-plugin` | One OpenTelemetry span per operation |
| `BlobDbPlugin` | `@routier/blob-plugin` | Uploads `s.file()` content and stores references |
| `HttpDbPlugin` | `@routier/replication-plugin` | Direct HTTP transport |
| `HttpSwrDbPlugin` | `@routier/replication-plugin` | Local mirror plus stale-while-revalidate HTTP reads |
| `OptimisticUpdatesDbPlugin` | `@routier/replication-plugin` | Fast optimistic reads over a source plugin |
| `PluginSyncEngine` | `@routier/replication-plugin` | Configurable source/mirror synchronization |

Read [Wrapper Plugins](/integrations/plugins/built-in-plugins/wrappers) before choosing order: wrappers can observe only operations below them, and some require guarantees from the inner plugin.

## Schema-level integrations

These integrate at the schema boundary rather than serving as the datastore's storage plugin:

- [`@routier/blob-plugin`](/integrations/plugins/built-in-plugins/files) wraps storage for `s.file()` and exposes memory, file-system, and S3-compatible blob stores.
- [`@routier/encryption`](/integrations/plugins/built-in-plugins/encryption) returns a two-way `x.transform(...)` for AES-GCM property encryption.
- `@routier/sql-plugin-core` is a toolkit for plugin authors (`toSql`, dialects, column/update/join helpers), not an application storage plugin.

## Installation

Install core, datastore, and only the integrations you use:

```bash
npm install @routier/core @routier/datastore @routier/dexie-plugin
```

All packages expose ESM and CommonJS entry points. Optional database drivers and SDKs remain peer dependencies; each plugin page names the required peer.

## Composition rules

1. The outermost wrapper receives calls first.
2. Destroy flows through the full stack.
3. A cache sees only writes routed through that cache.
4. `RetryDbPlugin` never retries writes; a generic wrapper cannot know whether a partial write landed.
5. Set `BatchingDbPlugin({ isAtomic: true })` only when the inner plugin guarantees a failed save applied nothing.
6. `ConcurrencyDbPlugin` works only when the inner plugin enforces conditional updates. See its support table in [Wrapper Plugins](/integrations/plugins/built-in-plugins/wrappers).

See [Plugin Compositions](/guides/plugin-compositions) for common stacks and [Create Your Own Plugin](/integrations/plugins/create-your-own/) for the `IDbPlugin` contract.
