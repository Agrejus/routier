# @routier/replication-plugin

<p align="center">
  <img src="https://routier.dev/routier.svg" alt="Routier" width="140" height="140" />
</p>

HTTP and local-first replication for Routier. Read from local storage first, keep working
offline, and synchronize with a remote API in the background.

```ts
import { DataStore } from "@routier/datastore";
import { HttpSwrDbPlugin } from "@routier/replication-plugin";
import { DexiePlugin } from "@routier/dexie-plugin";

const cache = new DexiePlugin("app");

class AppStore extends DataStore {
  constructor() {
    super(new HttpSwrDbPlugin(cache, {
      getUrl: (collectionName) => `https://api.example.com/${collectionName}`,
      unsyncedQueueStore: cache,
    }));
  }
}
```

## Exported plugins

| Export | Use it for |
|---|---|
| `HttpDbPlugin` | Reads and writes straight to an HTTP API |
| `HttpSwrDbPlugin` | Cache-first reads with background revalidation, and an offline write queue |
| `OptimisticUpdatesDbPlugin` | Memory-first reads over a persistent source plugin |

The full guide is in
[docs](https://routier.dev/integrations/plugins/built-in-plugins/replication/README).

## Contracts

### Durability

The wrapped source plugin decides. `HttpSwrDbPlugin` writes through to it, so a save is as
durable as Dexie, PouchDB, or whatever else you supply.

Unsynced writes are held in a queue in that same store, so they survive a reload and replay on
the next successful flush.

### Consistency

**Eventually consistent by design.** A read returns local data immediately and may be stale.
A write applies locally first and reaches the server later.

The server is the authority. When a response echoes entities back, they upsert into the local
store under the collection's mutex, and subscribers are notified.

### Revalidation and etags

A revalidation sends the `ETag` of the last response for that query as `If-None-Match`. On
`304 Not Modified` the local rows stay as they are and the query counts as fresh. The etag is
stored in the local store, so it survives a reload. It is only sent while the local store still
holds as many rows for the query as it did when the etag was stored. Turn this off with
`conditionalRevalidation: false`, and observe it with `onRevalidateNotModified`.

When the schema declares an `.etag()`, a returned row that the local store already has is
compared by etag: a newer server row replaces the local one, the same etag is skipped, and an
older one is ignored. Rows without an etag are compared field by field. The server owns etags:
the local store keeps the values the server sent and never generates its own.

### Pagination

`HttpSwrDbPlugin` pushes `filter` and `sort` down to the server. It does **not** push `skip`
and `take` — those are applied locally, to the rows it holds.

The reason is that a predicate survives being applied twice and a window does not. The plugin
answers a read from its local store, so anything it pushes down gets applied a second time
when that store is queried. Re-filtering rows the server already filtered gives the same
answer; re-skipping a page the server already skipped gives an empty one.

So a windowed read syncs the whole filtered set and pages it locally. Bound what you sync with
`where(...)`, not with `take(...)`.

**If you need the server to paginate,** use `HttpDbPlugin` directly. It pushes the window down
and keeps no local copy, which is the right shape for a large collection you do not want on
the client — at the cost of a round trip per page and no offline reads.

### Offline and retry

Unsynced changes retry on a backing-off timer, from 1 second to 60 seconds, and immediately on
the browser's `online` event. The interval resets after a productive flush.

Override with `autoSync`:

```ts
autoSync?: false | { delayMs?: number; maxDelayMs?: number; onOnline?: boolean }
onSync?: (outcome: SyncOutcome) => void
```

`autoSync: false` turns automatic replay off. Call the sync API yourself.

A change that the server rejects permanently moves to a dead-letter state rather than
retrying forever.

### Concurrency

Writes to one collection are serialized by a mutex, so a background flush and a foreground
save cannot interleave on the same collection.

Conflict resolution is the server's. The plugin sends what it has and applies what comes back.

### Schema migration

The source plugin's policy applies. This plugin adds none of its own.

### Disposal

Call `store.destroyAsync()`. It stops the retry timer, removes the `online` listener, and
destroys the wrapped source plugin.

A store that is never destroyed leaves a timer running.

### Failure semantics

- A failed request leaves the change in the unsynced queue and schedules a retry.
- A 4xx that will not succeed on retry dead-letters the change.
- A local write never fails because the network is down. That is the point.

## Supported versions

Node 18 or later, and any browser with `fetch`.

## See also

- [Replication plugin guide](https://routier.dev/integrations/plugins/built-in-plugins/replication/README)
- [Local-first apps](https://routier.dev/guides/local-first-apps)
