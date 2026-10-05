---
title: Replication Plugin
doc_role: reference
---

# Replication Plugin

`@routier/replication-plugin` provides the HTTP and local-first replication building blocks for Routier. Use it when your app should read from local storage first, keep working offline, and synchronize with a remote API in the background.

## When To Use It

Use the replication plugin when you want one of these patterns:

- `HttpDbPlugin` for direct HTTP-backed collections and views.
- `HttpSwrDbPlugin` for stale-while-revalidate reads with background refresh.
- `OptimisticUpdatesDbPlugin` for memory-first reads layered on top of a persistent store.
- `HttpSwrDbPlugin` + `OptimisticUpdatesDbPlugin` for local-first SWR with optimistic updates.

For the full local-first background, see [Local-First Apps](/guides/local-first-apps). For the highest-performance composition, see [HttpSwrDbPlugin with Optimistic Replication](/guides/http-swr-with-optimistic).

## Installation

```bash
npm install @routier/replication-plugin
```

Install a local store plugin as well when you want persistent offline storage:

```bash
npm install @routier/dexie-plugin
```

## Minimal Setup

<<< @/_snippets/code/from-docs/integrations/plugins/built-in-plugins/replication/README/block-1.ts

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
- `translateRemoteResponse(schema, data)`: adapts your API payload to the array shape Routier expects.
- `writeBatchDelayMs`: debounce window for combining rapid writes to one URL (default `25`; `0` disables batching).
- `onError(error)` and `onEvent(event)`: the hooks shared by every replication plugin, described below.

### `HttpSwrDbPlugin`

`HttpSwrDbPlugin` extends the HTTP options with local-first SWR behavior:

- `maxAgeMs`: how long cached data is considered fresh before revalidation starts.
- `unsyncedQueueStore`: where pending writes are persisted until the server confirms them.
- `autoSync`: turns on background replay (off by default); `true` uses the defaults.

## Errors, Retries and Events

Nothing is retried or synced in the background unless you ask. Every replication plugin takes the
same two hooks.

`onError(error)` decides what a failing request does. `error.kind` is `"http"` (with `status`,
`headers` and `body`), `"network"` or `"store"`, and the error carries the actions the plugin can
carry out: `retry()` and `done()` everywhere, `useCached()` for reads on `HttpSwrDbPlugin` and
`OptimisticUpdatesDbPlugin`, and `reject()` and `defer()` for queued writes. The request waits until
an action is called. A 401 is just `kind: "http"`: refresh the token and call `retry()`, and
`getHeaders` runs again.

`onEvent(event)` reports what happened: `read` (`ok`, `status`), `changes-rejected` (`conflict` for a
409) and `synced` (`sent`, `failed`, `rejected`).

`createRetry({ maxAttempts, baseDelayMs, maxDelayMs })` is an `onError` with exponential backoff for
network failures, 408, 429 and 5xx. `defaultSync()` returns `{ onError: createRetry(), autoSync: true }`
to spread into the constructor.

## Structured Permanent Rejections

When `onError` calls `reject()` on a failed batch, a permanent `4xx` response that does not say
which changes were refused could mean the whole request is invalid or one entity poisoned the batch.
To preserve valid writes, `HttpSwrDbPlugin` then sends each entity alone and asks `onError` about each
one that fails. That is safe but costs `N` requests.

Servers can avoid that fan-out by returning one of these JSON bodies with the permanent status:

```json
{ "error": "account is read-only", "rejectionScope": "batch" }
```

The entire batch is dead-lettered without probes. Use this only when no entity in the request could
succeed.

```json
{ "error": "validation failed", "rejectedOpIds": ["operation-id-2"] }
```

The listed operations are dead-lettered and all unlisted operations are retried together in one
request. Operation IDs come from `meta.opIds`, parallel to the `adds`, `updates`, and `removes`
arrays. An unstructured response retains the per-item isolation fallback for compatibility and to
avoid discarding valid writes.

## Operational Notes

- `translateRemoteResponse` is usually required when your API returns `{ data: [...] }` or another wrapped payload.
- `ignoreQueryForCollections` is useful for server-owned scopes such as `"users"` or tenant-bound collections.
- `unsyncedQueueStore` persists a reserved collection named `_routier_unsynced`; keep that store isolated from your main cache when your backend has store-specific constraints.
- Override `formatRequestBody(...)` on `HttpSwrDbPlugin` when you need to strip client-only fields or match an existing API contract.

## Related

- [Local-First Apps](/guides/local-first-apps)
- [HttpSwrDbPlugin with Optimistic Replication](/guides/http-swr-with-optimistic)
- [Optimistic Replication](/guides/optimistic-replication)
- [Plugin Catalog](/integrations/plugins/built-in-plugins/)
- [Replication Plugin API](/reference/api/plugins/replication/src/README)
