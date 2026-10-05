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
`conditionalRevalidation: false`. A 304 is reported as a `read` event with `ok: true` and
`status: 304`.

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

### Errors, retries and events

Nothing is on by default: no retries, no background sync. Two hooks, shared by `HttpDbPlugin`,
`HttpSwrDbPlugin`, `HttpTransportDbPlugin` and `OptimisticUpdatesDbPlugin`, turn behavior on.

`onError` decides what a failing request does. It receives the failure — `kind` is `"http"`
(with `status`, `headers` and `body`), `"network"` or `"store"` — and the actions that plugin can
carry out:

| Plugin | Read | Write |
| --- | --- | --- |
| `HttpSwrDbPlugin` | `retry()` · `done()` · `useCached()` | `retry()` · `reject()` · `defer()` |
| `OptimisticUpdatesDbPlugin` | `retry()` · `done()` · `useCached()` | `retry()` · `reject()` |
| `HttpDbPlugin`, `HttpTransportDbPlugin` | `retry()` · `done()` | `retry()` · `done()` |

The request waits until an action is called, so `onError` can refresh a token, wait for the
network, or ask the user first. A read ended with `done()` throws; `useCached()` answers from
the local copy. With no `onError`, a failed read throws and a failed queued write stays queued.

`onEvent` reports what happened: `read` (`ok` and `status`), `changes-rejected` (`conflict` is
`true` for a 409) and `synced` (`sent`, `failed`, `rejected`).

```ts
import { createRetry, HttpSwrDbPlugin } from '@routier/replication-plugin';

const backoff = createRetry({ maxAttempts: 5 });

new HttpSwrDbPlugin(cache, {
    getUrl,
    unsyncedQueueStore,
    autoSync: true,
    onError: async (error) => {
        if (error.kind === 'http' && error.status === 401 && error.attempt === 1) {
            await refreshToken();
            return error.retry();
        }
        if (error.kind === 'network' && error.operation === 'read') {
            return error.useCached();
        }
        return backoff(error);
    },
    onEvent: (event) => { /* update sync status UI */ },
});
```

`createRetry` retries network failures, 408, 429 and 5xx with backoff (honoring `Retry-After`),
and otherwise ends the request: a refused write is rejected, and one that ran out of attempts
stays queued. `defaultSync()` returns `{ onError: createRetry(), autoSync: true }`.

`autoSync` turns on background replay: a backing-off timer from 1 second to 60 seconds, and an
immediate flush on the browser's `online` event (`syncWhenOnline`, on by default). Without it,
queued changes go out after each save (`postOnPersist`, on by default) or when you call
`syncNow()`, which returns `{ sent, failed, rejected }`.

When a batch is rejected, `reject()` narrows it: only the changes the server named in
`rejectedOpIds` are rejected, or, if it named none, each change is sent on its own and
`onError` is asked about each one that fails. A rejected change moves to a dead-letter state.

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

- A failed write stays in the unsynced queue unless `onError` rejects it.
- A failed first read throws unless `onError` answers it from the cache.
- A local write never fails because the network is down. That is the point.

## Supported versions

Node 18 or later, and any browser with `fetch`.

## See also

- [Replication plugin guide](https://routier.dev/integrations/plugins/built-in-plugins/replication/README)
- [Local-first apps](https://routier.dev/guides/local-first-apps)
