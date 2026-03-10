---
title: Replication Plugin
layout: default
parent: Built-in Plugins
grand_parent: Integrations
nav_order: 6
doc_role: reference
permalink: /integrations/plugins/built-in-plugins/replication/
---

# Replication Plugin

`@routier/replication-plugin` provides the HTTP and local-first replication building blocks for Routier. Use it when your app should read from local storage first, keep working offline, and synchronize with a remote API in the background.

## When To Use It

Use the replication plugin when you want one of these patterns:

- `HttpDbPlugin` for direct HTTP-backed collections and views.
- `HttpSwrDbPlugin` for stale-while-revalidate reads with background refresh.
- `OptimisticUpdatesDbPlugin` for memory-first reads layered on top of a persistent store.
- `HttpSwrDbPlugin` + `OptimisticUpdatesDbPlugin` for local-first SWR with optimistic updates.

For the full local-first background, see [Local-First Apps](/guides/local-first-apps.md). For the highest-performance composition, see [HttpSwrDbPlugin with Optimistic Replication](/guides/http-swr-with-optimistic.md).

## Installation

```bash
npm install @routier/replication-plugin
```

Install a local store plugin as well when you want persistent offline storage:

```bash
npm install @routier/dexie-plugin
```

## Minimal Setup

{% capture replication_basic %}{% include code/from-docs/integrations/plugins/built-in-plugins/replication/README/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ replication_basic | strip }}{% endhighlight %}

## Exported Plugins

| Export | Best for | Notes |
|--------|----------|-------|
| `HttpDbPlugin` | Server-backed reads and writes over HTTP | Sends query filters, sorts, skip, and take to your API. |
| `HttpSwrDbPlugin` | Cache-first reads with background revalidation | Keeps local data fresh while the UI continues reading from cache. |
| `OptimisticUpdatesDbPlugin` | Memory-first reads over a persistent source plugin | Hydrates memory from the wrapped source plugin and keeps reads extremely fast. |

## Recommended Composition

For most production web apps, use this layering:

1. `DexiePlugin` stores the durable local cache in IndexedDB.
2. `OptimisticUpdatesDbPlugin` mirrors that cache into memory for instant reads.
3. `HttpSwrDbPlugin` serves stale-while-revalidate reads and syncs writes to your API.

That gives you SWR semantics, optimistic local UX, and offline resilience without making every query wait on the network.

## Key Options

### `HttpDbPlugin`

`HttpDbPlugin` is the simplest remote plugin. Its main options are:

- `getUrl(collectionName)`: maps each Routier collection to an API endpoint.
- `getHeaders()`: injects auth or tenant headers per request.
- `ignoreQueryForCollections`: skips query serialization for collections the server always scopes itself.
- `queryRetryBaseDelayMs`, `queryRetryMaxDelayMs`, `queryRetryMaxAttempts`: control retry backoff for reads.
- `translateRemoteResponse(schema, data)`: adapts your API payload to the array shape Routier expects.

### `HttpSwrDbPlugin`

`HttpSwrDbPlugin` extends the HTTP options with local-first SWR behavior:

- `maxAgeMs`: how long cached data is considered fresh before revalidation starts.
- `bulkPersistRetryBaseDelayMs`, `bulkPersistRetryMaxDelayMs`, `bulkPersistRetryMaxAttempts`: retry controls for writes.
- `onAuthError(event)`: lets you trigger token refresh or sign-out on `401` and `403`.
- `onRevalidateError(error, context)`: log or surface background refresh failures without breaking the current UI.
- `unsyncedQueueStore`: where pending writes are persisted until the server confirms them.

## Operational Notes

- `translateRemoteResponse` is usually required when your API returns `{ data: [...] }` or another wrapped payload.
- `ignoreQueryForCollections` is useful for server-owned scopes such as `"users"` or tenant-bound collections.
- `unsyncedQueueStore` persists a reserved collection named `_routier_unsynced`; keep that store isolated from your main cache when your backend has store-specific constraints.
- Override `formatRequestBody(...)` on `HttpSwrDbPlugin` when you need to strip client-only fields or match an existing API contract.

## Related

- [Local-First Apps](/guides/local-first-apps.md)
- [HttpSwrDbPlugin with Optimistic Replication](/guides/http-swr-with-optimistic.md)
- [Optimistic Replication](/guides/optimistic-replication.md)
- [Built-in Plugins](/integrations/plugins/built-in-plugins/)
- [OptimisticReplicationDbPlugin API](/reference/api/core/src/classes/OptimisticReplicationDbPlugin.md)
- [ReplicationDbPlugin API](/reference/api/core/src/classes/ReplicationDbPlugin.md)
