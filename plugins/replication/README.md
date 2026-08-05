# @routier/replication-plugin

HTTP and local-first replication for Routier. Read from local storage first, keep working
offline, and synchronize with a remote API in the background.

```ts
import { DataStore } from "@routier/datastore";
import { HttpSwrDbPlugin } from "@routier/replication-plugin";
import { DexiePlugin } from "@routier/dexie-plugin";

class AppStore extends DataStore {
  constructor() {
    super(new HttpSwrDbPlugin({
      source: new DexiePlugin("app"),
      baseUrl: "https://api.example.com",
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
[docs](../../docs/integrations/plugins/built-in-plugins/replication/README.md).

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

- [Replication plugin guide](../../docs/integrations/plugins/built-in-plugins/replication/README.md)
- [Local-first apps](../../docs/guides/local-first-apps.md)
