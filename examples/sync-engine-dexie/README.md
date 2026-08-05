# PluginSyncEngine + Dexie + optimistic updates

A runnable example of the offline-first stack, talking to a real HTTP server.

```bash
npx tsx --tsconfig tsconfig.test.json examples/sync-engine-dexie/index.ts
```

Run it from the repo root. `--tsconfig tsconfig.test.json` is what maps `@routier/*` to
source; without it Node looks for `dist/` builds that do not exist in a clean checkout.

## What it sets up

```
DataStore
  └─ PluginSyncEngine              source = local, mirrors = the API
       ├─ OptimisticUpdatesDbPlugin    in-memory read cache
       │    └─ DexiePlugin             durable local storage (IndexedDB)
       └─ HttpDbPlugin                 the server
```

The server is started in-process with `node:http` and implements the replication wire
contract (`GET /:collection`, `POST /:collection` with `{ adds, updates, removes, meta }`).
It logs every request so you can see exactly what the client sent and when.

Node has no IndexedDB, so `fake-indexeddb/auto` provides one. It is a real IndexedDB
implementation — Dexie cannot tell the difference — and it is how the Dexie plugin's own
test suite runs.

## What it demonstrates

1. A write acks on the local store (~14 ms) and reaches the server in the background.
2. Reads are served locally: **0 GET requests**, because the HTTP plugin is a mirror, not a
   read route.
3. Updates and removes propagate too, in one POST.
4. With the server stopped, `saveChangesAsync` still succeeds in ~1 ms and `onMirrorError`
   fires — the local write is never blocked by the network.
5. When the server returns, the offline write is **not** replayed. `PluginSyncEngine` has no
   queue; `HttpSwrDbPlugin` is the layer that adds one.
6. A second store over the same Dexie database still sees both rows — the local data is
   durable, not just cached in memory.

Point 5 is the one to read carefully before choosing this stack: it gives you a fast local
write and best-effort replication, not guaranteed delivery.

## Two things worth knowing

- `store[Symbol.dispose]()` releases a store; `destroyAsync()` **deletes the database**
  (`DexiePlugin.destroy` calls `db.delete()`). Step 6 needs the former.
- `mirrorPersistPayloadMode: 'resolve-from-source-result'` looks necessary here for locally
  assigned identity keys, and is not — see the comment in `buildStore`. Verified by running
  it both ways.

## Browser version

```bash
node examples/sync-engine-dexie/browser/serve.mjs   # http://127.0.0.1:5180
```

Same stack, real IndexedDB instead of `fake-indexeddb`, and the API is served from the same
origin so nothing is hidden behind CORS or a proxy. One process: `serve.mjs` bundles `app.ts`
with esbuild, serves the page, and hosts the API.

Buttons: add / update / remove products, count the network requests a read costs, reload the
store from IndexedDB, and take the API down and back up. Both tables and both logs update
live, so the local copy drifting from the server is visible as it happens.

Screenshots of a full run are in `browser/screenshots/`.

Note on bundling: esbuild's `alias` option cannot map `@routier/core/schema`, only whole
specifiers — `serve.mjs` uses a small `onResolve` plugin instead. Anything that resolves
`@routier/*` to source needs the same treatment.

## The queue, and the two stacks side by side

The browser demo has a **Stack** switch:

| | `PluginSyncEngine` | `HttpSwrDbPlugin` |
|---|---|---|
| Local write acks immediately | yes | yes |
| Failed write is remembered | no | yes, durably (IndexedDB) |
| Replays when the server returns | no | yes, automatically |
| Permanent rejection (422) | reported once, then gone | dead-lettered, retryable |

Sequence worth walking through in queue mode: take the API down → add products (badge shows
`2 pending`) → bring the API back and **touch nothing**. Within a few seconds the client log
says `auto-sync replayed 2 change(s)`, both rows appear on the server in one coalesced POST, and
the badge returns to `0 pending`.

Then: `Reject writes (422)` → add → `Sync now`. The change is dead-lettered rather than retried
forever (`0 pending, 1 dead`). The demo's 422 body includes `rejectionScope: "batch"`, so a rejected
10-item burst is dead-lettered as one batch instead of triggering ten per-item probes. `Accept
writes again` → `Retry dead letters` → it goes through. The dead letter survives a page reload,
because the queue is a Dexie store like any other.

Automatic is the default and needs no configuration. The demo passes
`autoSync: { delayMs: 3_000 }` only so the replay is quick enough to watch; omitting `autoSync`
starts at 1s and backs off to 60s, and `autoSync: false` hands the whole thing to `syncNow()`.

## Updates send keys plus what changed

An update does not ship the whole row. The change tracker reports which properties moved, and the
plugin sends the key fields plus those properties:

```
POST products → 1 update  updates sent: ["_id","price"]
```

Two consequences worth knowing before pointing this at a real API:

- **Your server must merge, not replace.** `row = body` blanks every column the client did not
  send. This demo did exactly that at first and the row came back with `name: undefined`; the fix
  is one line in `serve.mjs` — `{ ...existing, ...patch }`.
- **An empty delta means "write the whole entity".** That is core's convention for a change the
  tracker could not attribute to specific fields (a diff-tracked mutation, or an explicit
  `markedDirty`), so the plugin sends the full row in that case. A merging server handles both
  shapes correctly.

Adds and removes are unchanged: an add has no prior state to patch, and a remove is addressed by
key.

## Request pacing

The demo has two controls for this: **Burst: 10 saves**, and a **Writes:** toggle.

| Writes setting | 10 rapid saves cost |
| --- | --- |
| immediate, batched (default) | **1 POST** |
| deferred queue flush (`postOnPersist: false`) | **1 POST** |

The default path debounces writes to the same endpoint for `writeBatchDelayMs` (25 ms by default),
merges all `adds`/`updates`/`removes` and idempotency keys, and then sends one request. The deferred
setting hands delivery to the paced flush instead: the write is still durable and acknowledged
immediately, but may wait up to `autoSync.delayMs` and does not perform echo reconciliation.
Set `writeBatchDelayMs: 0` if an API requires one request per logical save.

Reads are paced too, and one case used to be a genuine bug: a cold cache read by five components
at once now costs **one** GET, because cache misses share by cache key the way revalidates always
did.

Pacing itself lives in `HttpDbPlugin` — the transport, the only place a request actually leaves the
process — so it applies whether you use that plugin directly or compose it under
`HttpSwrDbPlugin`. `minRequestIntervalMs` (default 100 ms) is the floor between two physical
requests to the same URL, after write batching has occurred.

## The stress page — built to find bugs

```
http://127.0.0.1:5180/complex
```

Two related collections (projects, tasks) written in **one** save, read through five different
queries at once, and audited against the server field by field. `browser/complex.ts`.

Buttons: seed, load 5 views, churn both collections, reload, sync now, take the API down, and
**Settle & audit** — which waits for the queue to drain and then compares local against the server
row by row, reporting any drift as a count rather than something to eyeball.

It earned its keep on the first run. Three findings, in `specs/known-defects.md` where relevant:

- **Defect #25 (core, open)** — mutating a row that is still a pending addition throws
  `Cannot find internal addition` out of `saveChangesAsync`, on every plugin, *after* the write has
  landed. The seed did exactly this. Pinned by a failing test in
  `datastore/src/change-tracking/ChangeTracker.test.ts`.
- **Defect #26 (core, open)** — query results from a `proxy()` collection carry an enumerable
  `__tracking__` property, so `JSON.stringify(row)` includes the change tracker's state. The audit
  reported it as five discrepancies against the server. Replication is unaffected: wire bodies are
  built from prepared entities.
- **An empty filtered result was treated as a cold cache** (replication, **fixed**) — a filter
  matching nothing went to the network on every read, ignoring `maxAgeMs`: three reads of an empty
  view cost four GETs. Freshness now decides, so an empty view is cached like any other.
- **Repeated edits to one queued entity failed on durable stores** (replication, **fixed**) — the
  unsynced queue always persisted a re-enqueued `(collection, kind, entity)` row as an add. Memory
  silently upserted it, but Dexie's insert-only `bulkAdd` raised `ConstraintError`, leaving local
  changes acknowledged but absent from the sync queue. Queue mutations are now serialized and an
  existing queue key is updated with `bulkPut`; repeated online/offline churn remains convergent.

The demo server also had to be fixed twice along the way — it kept one flat row map for all
collections, and it replaced rows on update instead of merging the partial payload.
