---
title: API Reference
---

# API Reference

Use this page to find a public API by package. The [generated reference](/reference/api/README) contains signatures for every exported core, datastore, React, and plugin entry point; task-focused pages explain behavior and combinations.

## @routier/datastore

```ts
import { DataStore, Collection, Queryable } from "@routier/datastore";
```

### DataStore

| Member | Purpose |
| --- | --- |
| `new DataStore(plugin, options?)` | Construct a store; normally called by a subclass |
| `collection(schema)` | Protected collection-builder entry point |
| `view(schema)` | Protected view-builder entry point |
| `schemas` | Read-only collection of schemas registered by this store |
| `getCollection(schema)` | Resolve a configured collection by schema |
| `getDbPlugin<T>()` | Access the configured plugin/stack |
| `saveChanges(done)` / `saveChangesAsync()` | Persist every pending collection change |
| `previewChanges(done)` / `previewChangesAsync()` | Inspect pending changes without saving |
| `hasChanges(done)` / `hasChangesAsync()` | Test whether any collection is dirty |
| `destroy(done)` / `destroyAsync()` | Destroy the underlying database and dispose the store |
| `[Symbol.dispose]()` | Abort subscriptions and release this store without deleting the database |

`DataStoreOptions` has `crossTabSync?: boolean` (default `true`) and `semiJoinKeyThreshold?: number` (default `500`).

### Collection builder

A declaration is `collection(schema) → features → mode → create()`:

- Features: `scope`, `softDelete`, `audit(...).derive(...)`, `fullTextSearch`.
- Modes: `proxy`, `diff`, `immutable`, `readonly`.
- Construction: `create()` or `create(factory)` for a custom subclass.

See [Configuring Collections](/how-to/collections/configuring-collections) for the complete compatibility and behavior table.

### Collection and query surface

| Group | Members |
| --- | --- |
| Create | `instance`, `add`/`addAsync` (writable modes) |
| Update | direct mutation (`proxy`, `diff`); `update`, `current`, `isCurrent` (`immutable`) |
| Delete | `remove`/`removeAsync`, `removeAll`/`removeAllAsync` (writable modes) |
| Compose | `where`, `sort`, `sortDescending`, `skip`, `take`, `map`, `nearest`, `search`, `join`, `leftJoin`, `toQueryable`, `apply` |
| Reusable query | `Queryable.compose(schema)` builds a definition; `collection.apply(composer)` attaches it |
| Execute | `toArray`, `first`, `firstOrUndefined`, `some`, `every`, `min`, `max`, `sum`, `count`, `distinct`, `toGroup` and each `*Async` form |
| Live query | `subscribe()` followed by a terminal method; the terminal callback returns an unsubscribe function |
| Tracking | `hasChanges`, `tag`, `tags`, `attachments` |
| Search maintenance | `fullTextSearch.check()`, `fullTextSearch.rebuild()` |

Most filters have plain and parameterized overloads:

```ts
store.products.where(p => p.active).toArrayAsync();
store.products.where((p, q) => p.price >= q.min, { min: 10 }).toArrayAsync();
```

Start with [Queries](/concepts/queries/), [Reusable Queries](/concepts/queries/query-composer), and [Terminal Methods](/concepts/queries/terminal-methods).

## @routier/core

The root export mirrors the public subpath exports below. Prefer a focused subpath when it makes dependencies clearer.

| Import | Main API |
| --- | --- |
| `@routier/core/schema` | `s`, schema/property classes, `InferType`, `InferCreateType`, `SchemaDefinition`, property metadata |
| `@routier/core/plugins` | `IDbPlugin`, events, query options, translators, `CacheDbPlugin`, `RetryDbPlugin`, `ConcurrencyDbPlugin`, `BatchingDbPlugin` |
| `@routier/core/expressions` | Expression types, parsing, evaluation, query filter types |
| `@routier/core/collections` | Persist change/result buckets, schema collections, in-memory collection primitives |
| `@routier/core/results` | `Result`, `PluginEventResult`, callback/result types and helpers |
| `@routier/core/errors` | `SchemaError`, `OptimisticConcurrencyError`, `PluginDestroyedError` |
| `@routier/core/capabilities` | Capability, tracing, and performance instrumentation |
| `@routier/core/assertions` | Runtime assertions and expression type guards |
| `@routier/core/utilities` | IDs, hashing, cloning, logger, runtime and collection helpers |
| `@routier/core/pipeline` | `TrampolinePipeline`, `SyncronousQueue` |
| `@routier/core/performance` | `now`, `measure` |
| `@routier/core/types` | Shared utility types |

The schema factories and valid modifier combinations are listed in [Schema API](/concepts/schema/schema-api). Generic wrapper behavior is in [Wrapper Plugins](/integrations/plugins/built-in-plugins/wrappers).

## @routier/react

```ts
import { useQuery } from "@routier/react";

const result = useQuery(
  () => store.products.where(p => p.active).subscribe().toArray,
  [store]
);
```

`useQuery(queryFactory, deps)` executes a Routier callback query, manages its unsubscribe handler, and returns `{ status, data?, error? }`. See [React Hooks](/integrations/react/hooks/).

## Plugin packages

| Package | Primary exports |
| --- | --- |
| `@routier/memory-plugin` | `MemoryPlugin`, `MemoryDatabase`, `assertIsMemoryPlugin` |
| `@routier/browser-storage-plugin` | `BrowserStoragePlugin` |
| `@routier/dexie-plugin` | `DexiePlugin` |
| `@routier/file-system-plugin` | `FileSystemPlugin`, `FileSystemDbCollection` |
| `@routier/sqlite-plugin` | `SqliteDbPlugin`, driver interfaces; subpaths for `sqlite3`, Turso, and D1 |
| `@routier/postgresql-plugin` | `PostgresDbPlugin`, config/SQL result types, `PostgresSqlTranslator` |
| `@routier/mysql-plugin` | `MysqlDbPlugin`, config/SQL result types |
| `@routier/mongodb-plugin` | `MongoDbPlugin`, `MongoClientDriver`, MQL translation and driver interfaces |
| `@routier/pouchdb-plugin` | `PouchDbPlugin` and sync/design-document types |
| `@routier/replication-plugin` | HTTP, SWR, optimistic, transport, sync engine, auth/dead-letter types |
| `@routier/blob-plugin` | `S3Plugin`, `BlobDbPlugin`, `createFiles`, direct upload, file references and blob-store contracts |
| `@routier/encryption` | `createKeyring`, `encryption`, keyring types, `isEnvelope` |
| `@routier/sql-plugin-core` | SQL dialect, query, column, update, and join helpers for plugin authors |

See the [Plugin Catalog](/integrations/plugins/built-in-plugins/) for setup and selection.

## Generated reference

Run `npm run typedoc` at the repository root after changing a public export or JSDoc. It generates reference pages from all package entry points in `typedoc.json`.

- [Complete generated reference](/reference/api/README)
- [Core concepts](/concepts/)
- [How-to guides](/how-to/collections/)
