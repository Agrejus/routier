---
title: HttpSwrDbPlugin with Optimistic Replication
layout: default
parent: Guides
nav_order: 9
---

# HttpSwrDbPlugin with Optimistic Replication

Combine **HttpSwrDbPlugin** (stale-while-revalidate over HTTP) with **OptimisticUpdatesDbPlugin** for extremely fast reads: IndexedDB cache → in-memory store → instant UI. This pattern is ideal for apps that sync with a remote API and need sub-millisecond query response times.

For a full map of plugin combinations and when to use each, see **[Plugin Compositions](plugin-compositions.md)**.

## Quick Navigation
- [Architecture](#architecture)
- [Critical: Plugin Order](#critical-plugin-order)
- [Setup](#setup)
- [Complete Example](#complete-example)
- [Customizing the Request Body](#customizing-the-request-body)
- [Unsynced Queue Storage](#unsynced-queue-storage)
- [Related Guides](#related-guides)

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Your Application                                        │
└─────────────────────────────────────────┬───────────────────────────────────────┘
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           HttpSwrDbPlugin                                         │
│  • Queries: cache first, revalidate in background when stale                      │
│  • Writes: persist to store, POST to server, retry on failure                    │
└─────────────────────────────────────────┬───────────────────────────────────────┘
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      OptimisticUpdatesDbPlugin                                  │
│  • Reads: from memory (instant)                                                   │
│  • Writes: to Dexie (persistent), then replicate to memory                       │
└─────────────────────────────────────────┬───────────────────────────────────────┘
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           DexiePlugin (IndexedDB)                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

Reads flow: **Memory** → instant. Writes flow: **Memory** → Dexie → HTTP POST. Server updates revalidate the cache and propagate to memory.

## Critical: Plugin Order

**You must pass the OptimisticUpdatesDbPlugin to HttpSwrDbPlugin, not the other way around.**

{% highlight ts linenos %}{% include code/from-docs/guides/http-swr-with-optimistic/block-1.ts %}{% endhighlight %}

{% highlight ts linenos %}{% include code/from-docs/guides/http-swr-with-optimistic/block-2.ts %}{% endhighlight %}

If you reverse the order, server updates will require a **double refresh** to appear in the UI. The revalidate flow must hit the optimistic plugin's memory store so subscriptions are notified correctly.

## Setup

Install the required packages:

```bash
npm install @routier/core @routier/datastore @routier/replication-plugin @routier/dexie-plugin
```

## Complete Example


{% highlight ts linenos %}{% include code/from-docs/guides/http-swr-with-optimistic/block-4.ts %}{% endhighlight %}


### Key points

1. **Optimistic plugin wraps Dexie**: `new OptimisticUpdatesDbPlugin(swrStoreDb)` — all reads come from memory.
2. **HttpSwrDbPlugin receives the optimistic plugin**: `new HttpSwrDbPlugin(optimisticPlugin, options)` — SWR manages cache freshness and HTTP sync.
3. **Separate Dexie for unsynced queue**: Use `new DexiePlugin('myapp_unsynced')` with a different database name. Sharing the same Dexie instance with the SWR store causes `Table _routier_unsynced does not exist` (see [Debug Logging](/how-to/debug-logging.md) for details).
4. **translateRemoteResponse**: Adapt your API's response shape to `{ data: unknown[] }` if it differs.

## Customizing the Request Body

Override `formatRequestBody` when you need to strip or transform fields before sending to the server (e.g. client-only properties):


{% highlight ts linenos %}{% include code/from-docs/guides/http-swr-with-optimistic/block-5.ts %}{% endhighlight %}


## Unsynced Queue Storage

The unsynced queue tracks entities written to the local store but not yet confirmed by the server.

| Option | Behavior |
|--------|----------|
| `unsyncedQueueStore: new DexiePlugin('myapp_unsynced')` | Persistent across refresh. Must use a **separate** Dexie database (different name than the SWR store). |
| `unsyncedQueueStore: new MemoryPlugin('unsynced')` | In-memory only; queue cleared on page refresh. Use when persistence is not needed. |

## Related Guides

- [Plugin Compositions](plugin-compositions.md) — Map of all plugin combinations
- [Optimistic Replication](optimistic-replication.md) — Base pattern without HTTP
- [Syncing](syncing.md) — Sync with remote APIs
- [Debug Logging](/how-to/debug-logging.md) — Enabling logs for troubleshooting
