---
title: Local-First Apps
layout: default
parent: Guides
nav_order: 2
---

# Local-First Apps

Build apps that work offline and sync when online. Routier is designed for local-first: data lives on the device first, the network is optional.

## Quick Navigation

- [What is Local-First?](#what-is-local-first)
- [Why Local-First?](#why-local-first)
- [How Routier Enables It](#how-routier-enables-it)
- [Get Started](#get-started)
- [Related Guides](#related-guides)

## What is Local-First?

In a **local-first** app, data is stored and processed on the user's device by default. The app works fully offline. When the network is available, it syncs with the server in the background. Users never see a loading spinner for reads—the UI is instant because data is already local.

| Traditional (Server-First) | Local-First |
|---------------------------|-------------|
| Every read hits the network | Reads come from local storage |
| Offline = broken app | Offline = app works, syncs later |
| Spinners, loading states | Instant UI |
| Network latency affects every interaction | Network latency hidden in background sync |

## Why Local-First?

- **Instant UX** — No waiting for the server. Queries return from IndexedDB or memory in milliseconds.
- **Offline resilience** — Users can work on planes, in low-signal areas, or when the server is down.
- **Data ownership** — Users have a copy of their data on device. You're not a thin client to a remote database.
- **Collaboration-ready** — Local-first pairs naturally with sync: merge changes when online, handle conflicts explicitly.

## How Routier Enables It

Routier's plugin architecture makes local-first the default. You choose where data lives:

1. **Local storage first** — Dexie (IndexedDB), Memory, PouchDB, LocalStorage, or SQLite. All reads and writes go through your chosen plugin.
2. **Sync when you need it** — Compose with HttpSwrDbPlugin for HTTP sync. Cache-first reads, background revalidate, writes POST to your API. The app works offline and syncs when back online.
3. **Optional speed boost** — Add OptimisticUpdatesDbPlugin for in-memory reads. Instant queries even when the underlying store is IndexedDB.

```
User Device
┌─────────────────────────────────────────────────────────┐
│  Your App (React, Vue, etc.)                             │
└─────────────────────────┬───────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  Routier DataStore                                       │
│  • Live queries (reactive)                               │
│  • Optimistic mutations                                  │
│  • Change tracking                                       │
└─────────────────────────┬───────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  Plugin (local-first by design)                          │
│  • DexiePlugin → IndexedDB                               │
│  • HttpSwrDbPlugin(Dexie) → IndexedDB + HTTP sync        │
│  • HttpSwrDbPlugin(Memory) → in-memory + HTTP sync       │
└─────────────────────────┬───────────────────────────────┘
                          │
                          ▼
               Local storage  ←→  Sync (when online)
```

## Get Started

| Goal | Composition | Guide |
|------|-------------|-------|
| **HTTP sync + offline** | HttpSwrDbPlugin(DexiePlugin) | [Plugin Compositions](plugin-compositions.md) |
| **HTTP sync + fastest reads** | HttpSwrDbPlugin(OptimisticUpdatesDbPlugin(DexiePlugin)) | [HttpSwrDbPlugin with Optimistic](http-swr-with-optimistic.md) |
| **Local-only (no sync)** | DexiePlugin or MemoryPlugin | [Plugin Compositions](plugin-compositions.md) |

See **[Plugin Compositions](plugin-compositions.md)** for the full map of combinations and when to use each.

## Related Guides

- [Plugin Compositions](plugin-compositions.md) — Choose your storage and sync combination
- [Syncing](syncing.md) — Sync patterns and conflict handling
- [HttpSwrDbPlugin with Optimistic Replication](http-swr-with-optimistic.md) — Maximum speed with HTTP sync
- [Optimistic Replication](optimistic-replication.md) — In-memory reads with persistent storage
