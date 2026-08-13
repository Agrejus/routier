---
title: Local-First Apps
doc_role: guide
description: Design, implement, synchronize, and operate a local-first Routier application.
---

# Local-First Apps

A local-first application treats on-device data as the user's working copy. Reads and edits continue without waiting for the network; synchronization reconciles that working copy with a remote authority when communication succeeds.

Routier supplies local storage, reactive queries, tracked mutations, and HTTP replication building blocks. It does **not** make an application local-first merely by installing a plugin: you must choose what is cached, make pending work durable, define the server contract, and design conflicts and recovery.

## Quick navigation

- [Choose an architecture](#choose-an-architecture)
- [Recommended browser stack](#recommended-browser-stack)
- [Read lifecycle](#read-lifecycle)
- [Write and sync lifecycle](#write-and-sync-lifecycle)
- [Server contract](#server-contract)
- [Conflicts and rejected changes](#conflicts-and-rejected-changes)
- [Show sync state](#show-sync-state)
- [Data modeling](#data-modeling-for-local-first)
- [Security and account isolation](#security-and-account-isolation)
- [Testing offline behavior](#testing-offline-behavior)
- [Production checklist](#production-checklist)

## What “offline” actually guarantees

A warm local cache can answer without the server. A device that has never downloaded the requested data cannot invent it.

| Situation | Expected behavior with `HttpSwrDbPlugin` |
| --- | --- |
| Matching cached data is fresh | Return local data without a remote request |
| Matching cached data is stale | Return local data, then revalidate in the background |
| No matching cached data exists | Fetch remotely and populate the cache; this read can fail offline |
| A local write has not reached the server | Keep it in the local store and unsynced queue |
| Connectivity returns | Automatic sync requests an immediate queue flush by default |

The browser's `online` event is only a retry trigger; it is not proof that your API is reachable. Successful requests and queue state are the useful signals.

## Choose an architecture

| Goal | Composition | Tradeoff |
| --- | --- | --- |
| Local-only browser app | `DexiePlugin` | Durable and simple; no remote synchronization |
| Cache-first HTTP synchronization | `HttpSwrDbPlugin(DexiePlugin)` | Durable local reads; IndexedDB is the query path |
| Cache-first HTTP plus memory-speed reads | `HttpSwrDbPlugin(OptimisticUpdatesDbPlugin(DexiePlugin))` | Fastest reads; extra memory and initial hydration |
| Direct server reads and writes | `HttpDbPlugin` | Not local-first; network is on the critical path |
| CouchDB-compatible replication | `PouchDbPlugin` with PouchDB replication | Different synchronization protocol and conflict model |

Start with `HttpSwrDbPlugin(DexiePlugin)` unless profiling shows that IndexedDB query latency requires the memory layer. `OptimisticUpdatesDbPlugin` mirrors each hydrated collection in memory, so dataset size matters.

## Recommended browser stack

```text
Application collections and live queries
                 │
                 ▼
HttpSwrDbPlugin ───────────────────────► HTTP API
  │  cache-first reads                    GET revalidation
  │  locally accepted writes              POST synchronization
  │
  ▼
OptimisticUpdatesDbPlugin (optional)
  ├── MemoryPlugin       fast read model
  └── DexiePlugin        durable local cache

Separate DexiePlugin
  └── _routier_unsynced  durable delivery obligations
```

Install the replication and local-storage packages:

```bash
npm install @routier/replication-plugin @routier/dexie-plugin
```

A production-oriented setup looks like this:

<<< @/_snippets/code/from-docs/guides/local-first-apps/production-stack.ts

Keep the `HttpSwrDbPlugin` instance so the application can inspect and control synchronization. Keep the main cache and unsynced queue in **separate Dexie databases**. Use durable queue storage in production; a `MemoryPlugin` queue loses pending writes on reload.

### Plugin order matters

The HTTP SWR plugin must be outermost:

```ts
new HttpSwrDbPlugin(
  new OptimisticUpdatesDbPlugin(new DexiePlugin("app_cache")),
  options,
);
```

This lets remote revalidation update the optimistic layer and notify live queries. Reversing the wrappers can leave the in-memory read model stale. See the [full composition guide](/guides/http-swr-with-optimistic#critical-plugin-order).

## Read lifecycle

For each serialized query, `HttpSwrDbPlugin` tracks cache freshness independently.

1. **Read local first.** The wrapped plugin executes the Routier query. With the optimistic wrapper, the first query hydrates that collection from the durable cache into memory.
2. **Handle a cache miss.** The HTTP request is blocking because there is no local result to display. A successful response is translated, persisted locally, and returned.
3. **Return a fresh hit.** Before `maxAgeMs` expires, the local result is returned without revalidation.
4. **Return a stale hit.** The stale result is returned immediately. Revalidation runs in the background.
5. **Apply the remote diff.** Server rows are compared with the cache. Adds, updates, and removals are persisted locally; subscribed queries are notified.
6. **Keep stale data on failure.** A failed background revalidation does not replace a successful cached result. Observe it through `onRevalidateError`.

Concurrent reads for the same URL are coalesced, and concurrent revalidations for the same cache key share work.

::: warning Joins through HTTP SWR
`HttpSwrDbPlugin` intentionally rejects joins because a local joined tuple cannot be coherently reconciled with remote entity rows. Use `HttpDbPlugin` for a server-backed joined read, query the collections separately, or maintain a denormalized local read model.
:::

## Write and sync lifecycle

Calling `saveChangesAsync()` with `HttpSwrDbPlugin` means **accepted locally and recorded for delivery**, not necessarily accepted by the server.

1. Routier sends tracked adds, updates, and removes to the SWR plugin.
2. The change is applied to the local store, updating local/live reads.
3. Every operation is written to `_routier_unsynced`. This queue write is awaited before success is reported.
4. By default, `postOnPersist: true` also starts the HTTP POST path immediately. Rapid writes to one URL share a short batching window.
5. A successful response removes acknowledged queue entries. `translatePersistResponse` can replace optimistic entities with canonical server versions.
6. A transient failure leaves entries queued. Automatic synchronization retries with backoff and flushes immediately when the platform emits `online`.

With `postOnPersist: false`, saves remain local until the paced background flush. With both `postOnPersist: false` and `autoSync: false`, nothing is sent until `syncNow()` is called.

### Delivery is at least once

Queued operations have IDs in `meta.opIds`. A request can reach the server even if its response never reaches the client, so the client may replay it. The server should record operation IDs and make replays idempotent. Do not rely on “the browser only sent this once.”

## Server contract

`HttpDbPlugin` and `HttpSwrDbPlugin` use one URL per collection.

### Reads

```http
GET /data/products?filter=...&sort=...&skip=...&take=...
```

`getUrl(collectionName)` chooses the endpoint. The server must enforce authentication and tenant scope regardless of incoming query parameters. Use `ignoreQueryForCollections` when the endpoint always returns its complete authorized set and should not receive serialized query options.

Adapt wrapped API responses with `translateRemoteResponse`:

```ts
translateRemoteResponse(_schema, body) {
  return (body as { data?: unknown[] }).data ?? [];
}
```

### Writes

The default POST body is:

```json
{
  "adds": [{ "id": "p1", "name": "New" }],
  "updates": [{ "id": "p2", "name": "Renamed" }],
  "removes": [{ "id": "p3", "name": "Old" }],
  "meta": {
    "opIds": {
      "adds": ["operation-1"],
      "updates": ["operation-2"],
      "removes": ["operation-3"]
    }
  }
}
```

Updates contain key fields plus changed fields. Operation-ID arrays are parallel to the corresponding operation arrays. A server may ignore `meta`, but replay safety is stronger when it deduplicates these IDs.

Return canonical saved entities when the server assigns IDs, versions, normalized values, or timestamps, then adapt them with `translatePersistResponse`.

### Status behavior

| Response | Routier behavior |
| --- | --- |
| Success | Remove confirmed operations from the queue |
| `401` or `403` | Call `onAuthError`; retry once only if it returns `true` |
| `408`, `429`, network error, or retryable server failure | Keep queued and retry with backoff |
| `409` | Call `onConflict`, dead-letter the change, then allow the server copy to win on revalidation |
| Other permanent `4xx` | Dead-letter rejected work rather than retry forever |

For batched validation, the server can return `rejectedOpIds` so valid operations continue without one request per entity. See [Structured Permanent Rejections](/integrations/plugins/built-in-plugins/replication/README#structured-permanent-rejections).

## Conflicts and rejected changes

Routier protects an entity with pending local work from being overwritten by revalidation. That protection ends when the server confirms the operation or permanently rejects it.

Routier does not provide an automatic CRDT or business-level merge policy. Choose one explicitly:

- **Server wins:** return `409`; notify the user, dead-letter the local operation, and revalidate.
- **Version check:** store a revision/version property and reject an update based on an older version.
- **Field merge:** let the server merge non-overlapping fields and return the canonical entity.
- **Manual resolution:** retain enough context to show local and remote values and let the user decide.

Do not silently discard dead letters. Surface them through `onSyncDeadLetter` and provide a correction, dismissal, export, or retry workflow. `retryDeadLetters()` is appropriate only after the reason for rejection has been fixed.

## Show sync state

“Offline” and “synced” are different states. A reachable network can still have rejected work, and an offline app can have no pending work.

```ts
const pending = await store.sync.pendingCount();
const outcome = await store.sync.syncNow();
const failures = await store.sync.deadLetters();

console.log({ pending, outcome, failures });

// After the user fixes the underlying problem:
const retried = await store.sync.retryDeadLetters();
```

Use `onSync(outcome)` to update a last-sync indicator after automatic or manual flushes. A useful UI distinguishes:

- saved locally
- waiting to sync
- synchronizing
- synced
- needs attention

Do not block normal local editing merely because a background revalidation failed. Do make permanent rejection visible.

## Data modeling for local-first

### Prefer client-generated stable keys

A locally created row needs an identity before contacting the server. UUID/string identities avoid temporary-key replacement. If the server assigns IDs, implement `translatePersistResponse` and test references to the replaced entity.

### Carry server versions explicitly

Add a version, revision, or server-updated timestamp if the API performs optimistic concurrency checks. Default update payloads contain keys plus changed fields; if an unchanged expected revision must accompany every update, override `formatRequestBody(...)` to include it. Treat client clocks as untrusted for conflict ordering unless the product deliberately accepts that limitation.

### Scope cached data

Collection scopes are useful for tenant/user filters, but the server must enforce the same boundary. Use distinct cache and queue names per account or tenant, and decide what happens to each database on sign-out.

### Plan schema evolution

A local cache can survive many application releases. Test old stored rows against new defaults, mappings, transforms, and backend migrations. Do not assume clearing all local data is safe while unsynced work exists.

### Cache only what can be local

Sensitive data in IndexedDB is accessible to the browser profile and any script running with the application's privileges. Minimize cached fields and use [property encryption](/integrations/plugins/built-in-plugins/encryption) when its threat model fits. Encryption does not replace XSS prevention, authorization, or secure key handling.

## Security and account isolation

- Fetch authorization headers for every request; Routier reevaluates `getHeaders` on retries.
- Return `true` from `onAuthError` only after credentials were actually refreshed.
- Enforce authorization and tenant filters on the server. Client scopes are not security controls.
- Namespace local cache and queue databases by environment and account.
- Never expose one user's warm cache while another user is signing in.
- On logout, decide whether to flush, retain, export, or discard pending work before deleting local storage.
- Set `databaseName` when multiple HTTP backends use the same schemas so subscription notifications do not cross backend boundaries.

## Testing offline behavior

A local-first release should exercise state transitions, not only happy-path CRUD:

1. **Cold start offline:** verify the app clearly handles data that was never cached.
2. **Warm start offline:** reload and confirm cached reads still work.
3. **Offline mutation:** add, update, and remove; verify live queries update and `pendingCount()` increases.
4. **Reload before sync:** confirm a durable queue survives a full page reload.
5. **Reconnect:** dispatch/use a real connectivity restoration and verify the queue drains.
6. **Lost response:** let the server apply a POST but drop the response; verify replay is idempotent.
7. **Auth expiry:** return `401`, refresh credentials, return `true`, and verify exactly one retry.
8. **Conflict:** return `409`; verify the change dead-letters and the server version appears after revalidation.
9. **Validation rejection:** reject one item in a batch and ensure valid operations still synchronize.
10. **Concurrent local write and revalidation:** verify pending local work is not clobbered.
11. **Multi-tab update:** verify subscribed views receive the expected storage notification.
12. **Upgrade with pending work:** open a previous cache/queue using the new application version.

Use throttling and request failure injection rather than relying only on `navigator.onLine`. Enable [debug logging](/how-to/debug-logging) while validating queue and revalidation behavior.

## Production checklist

- [ ] Durable local store selected for every offline-required collection
- [ ] Durable, separate unsynced queue configured
- [ ] Client-generated or correctly reconciled identities
- [ ] Server deduplicates `meta.opIds`
- [ ] Authentication refresh returns the correct retry signal
- [ ] Tenant authorization enforced remotely and cache names isolated locally
- [ ] Conflict and dead-letter UX defined
- [ ] Pending/synced/failed states visible where users need them
- [ ] Cold-cache offline behavior designed
- [ ] Cache and queue schema upgrades tested
- [ ] Sensitive cached fields reviewed
- [ ] Revalidation, synchronization, and dead-letter callbacks monitored
- [ ] Logout behavior for pending work decided
- [ ] Dataset fits IndexedDB and, if enabled, the memory mirror

## Related guides

- [Replication Plugin Reference](/integrations/plugins/built-in-plugins/replication/README)
- [HTTP SWR with Optimistic Updates](/guides/http-swr-with-optimistic)
- [Plugin Compositions](/guides/plugin-compositions)
- [Live Queries](/guides/live-queries)
- [Change Tracking](/concepts/change-tracking)
- [Debug Logging](/how-to/debug-logging)
