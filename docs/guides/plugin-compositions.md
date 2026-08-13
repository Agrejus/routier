---
title: Plugin Compositions
---

# Plugin Compositions

Routier's plugin system is fully composable. Plugins implement `IDbPlugin` and can wrap or be wrapped by other plugins. This page maps common combinations to their use cases and guides.

## Quick Navigation

- [How Composition Works](#how-composition-works)
- [HttpSwrDbPlugin Combinations](#httpswrdbplugin-combinations)
- [OptimisticUpdatesDbPlugin Combinations](#optimisticupdatesdbplugin-combinations)
- [Storage-Only Combinations](#storage-only-combinations)
- [Quick Reference](#quick-reference)

## How Composition Works

Every plugin implements `IDbPlugin` (query, bulkPersist, destroy). Composition means passing one plugin as the "store" to another:

```
YourApp → PluginA(PluginB(PluginC))
```

Plugins are interchangeable at each layer. Choose the combination that fits your architecture.

## HttpSwrDbPlugin Combinations

HttpSwrDbPlugin does stale-while-revalidate over HTTP: cache-first reads, background revalidate when stale, POST writes to your API. It accepts **any** `IDbPlugin` as its store.

These combinations give users a **local-first** experience: the app works offline using the local cache and syncs when back online. See [Local-First Apps](/guides/local-first-apps) for the full picture.

| Store | Use Case | Guide |
|-------|----------|-------|
| **DexiePlugin** | IndexedDB-backed cache, simple setup | [Syncing](/guides/syncing) |
| **MemoryPlugin** | In-memory cache, no persistence | [Syncing](/guides/syncing) |
| **PouchDB** | PouchDB as local cache | [Syncing](/guides/syncing) |
| **LocalStoragePlugin** | localStorage-backed cache | [Syncing](/guides/syncing) |
| **OptimisticUpdatesDbPlugin(Dexie)** | IndexedDB + in-memory reads, maximum speed | [HttpSwrDbPlugin with Optimistic Replication](/guides/http-swr-with-optimistic) |
| **OptimisticUpdatesDbPlugin(any)** | Any backend + in-memory reads | [HttpSwrDbPlugin with Optimistic Replication](/guides/http-swr-with-optimistic) |

## OptimisticUpdatesDbPlugin Combinations

OptimisticUpdatesDbPlugin uses an in-memory store for reads and a source plugin for writes. Reads are instant; writes persist to the source and replicate back to memory.

| Source | Use Case | Guide |
|--------|----------|-------|
| **DexiePlugin** | IndexedDB persistence, fast reads | [Optimistic Replication](/guides/optimistic-replication) |
| **MemoryPlugin** | Pure in-memory (rare) | [Optimistic Replication](/guides/optimistic-replication) |
| **PouchDB** | PouchDB as write backend | [Optimistic Replication](/guides/optimistic-replication) |
| **Any IDbPlugin** | Custom or third-party backend | [Optimistic Replication](/guides/optimistic-replication) |

OptimisticUpdatesDbPlugin can be used **with or without** HttpSwrDbPlugin. Use it alone when you have a local-only or custom sync flow.

## Storage-Only Combinations

Use a single storage plugin when you don't need HTTP sync or an extra memory layer:

| Plugin | Use Case | Link |
|--------|----------|------|
| **DexiePlugin** | IndexedDB in the browser | [Dexie Plugin](/integrations/plugins/built-in-plugins/dexie/README) |
| **MemoryPlugin** | In-memory, tests, prototypes | [Memory Plugin](/integrations/plugins/built-in-plugins/memory/README) |
| **PouchDB** | PouchDB with CouchDB sync | [PouchDB Plugin](/integrations/plugins/built-in-plugins/pouchdb/README) |
| **LocalStoragePlugin** | localStorage | [Local Storage Plugin](/integrations/plugins/built-in-plugins/local-storage/README) |
| **FileSystemPlugin** | File-based (Node.js) | [File System Plugin](/integrations/plugins/built-in-plugins/file-system/README) |
| **SQLitePlugin** | SQLite | [SQLite Plugin](/integrations/plugins/built-in-plugins/sqlite/README) |

## Quick Reference

| I want... | Composition | Guide |
|-----------|-------------|-------|
| HTTP sync with IndexedDB cache | HttpSwrDbPlugin(DexiePlugin) | [Syncing](/guides/syncing) |
| HTTP sync with in-memory cache | HttpSwrDbPlugin(MemoryPlugin) | [Syncing](/guides/syncing) |
| HTTP sync + fastest possible reads | HttpSwrDbPlugin(OptimisticUpdatesDbPlugin(DexiePlugin)) | [HttpSwrDbPlugin with Optimistic](/guides/http-swr-with-optimistic) |
| Local-only, instant reads from memory | OptimisticUpdatesDbPlugin(DexiePlugin) | [Optimistic Replication](/guides/optimistic-replication) |
| Local-only, IndexedDB | DexiePlugin | [Dexie Plugin](/integrations/plugins/built-in-plugins/dexie/README) |
| Local-only, in-memory | MemoryPlugin | [Memory Plugin](/integrations/plugins/built-in-plugins/memory/README) |

## Related

- [Local-First Apps](/guides/local-first-apps) — Why and how Routier builds offline-first experiences
- [Syncing](/guides/syncing) — Remote sync patterns
- [Optimistic Replication](/guides/optimistic-replication) — In-memory reads with persistent writes
- [HttpSwrDbPlugin with Optimistic Replication](/guides/http-swr-with-optimistic) — HTTP + optimistic (max speed)
- [Built-in Plugins](/integrations/plugins/built-in-plugins/) — Plugin reference
