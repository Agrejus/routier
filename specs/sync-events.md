# Sync hooks

The replication plugins grew one callback per situation: `onRevalidateError`,
`onRevalidateNotModified`, `onSync`, `onSyncDeadLetter`, `onConflict`, `onMirrorError` and
`onAuthError`, plus retry options tuned per plugin. An app could not tell which to use, some
fired twice for one failure, retries were hidden policy, and the case an app most needs to see
— a first read that fails (#66) — fired none of them and returned an empty result.

They are replaced by two hooks that every sync plugin shares.

## Principles

- **Nothing is on by default.** No retries, no background sync, no events. You turn behaviour
  on with your own code or with the helpers this package exports.
- **A terminal call shows the final outcome.** `toArrayAsync()`, `countAsync()`, `sumAsync()`
  and the rest succeed if any attempt succeeds, and throw only when the failure is final. A
  failure is never visible in `onError` while the query looks successful.
- **One interface.** `HttpDbPlugin`, `HttpSwrDbPlugin`, `HttpTransportDbPlugin` and
  `OptimisticUpdatesDbPlugin` take the same two hooks with the same types. Each plugin's
  types offer only the actions it can carry out.

## The hooks

```ts
interface SyncHooks<TError> {
    onEvent?: (event: SyncEvent) => void;
    onError?: (error: TError) => void;
}
```

### `onEvent`: what happened

```ts
type SyncEvent =
    | { type: "read"; ok: true; collectionName: string; status: number | null }
    | { type: "read"; ok: false; collectionName: string; status: number | null; error: Error }
    | { type: "changes-rejected"; collectionName: string; changes: RejectedChange[]; conflict: boolean; status: number | null; error: Error }
    | { type: "synced"; sent: number; failed: number; rejected: number };

type RejectedChange = { kind: "add" | "update" | "remove"; entity: unknown };
```

| Event | Fires when | Fired by |
| --- | --- | --- |
| `read` | A fetch from the source finishes, successfully or not | all four |
| `changes-rejected` | Changes are finally refused: dead-lettered, rejected from `onError`, or a direct write that ended in `done()` | all four |
| `synced` | A sync attempted at least one change | `HttpSwrDbPlugin` |

`status` is the HTTP status when there is one, otherwise `null`. `conflict` is `true` for
HTTP 409. Each outcome is reported once: a read shared by several callers reports one `read`,
and rejected changes are reported once per collection. `onEvent` is independent of `onError`.
An exception thrown by `onEvent` is caught and logged.

### `onError`: decide what a failing request does

```ts
type RequestError =
    | { kind: "http"; status: number; headers: Headers; body: unknown } & Common & Actions
    | { kind: "network" } & Common & Actions
    | { kind: "store" } & Common & Actions;

type Common = {
    operation: "read" | "write";
    collectionName: string;
    method: string | null;
    url: string | null;
    attempt: number;
    error: Error;
};
```

`kind: "network"` means no response arrived (offline, DNS, timeout). `kind: "store"` is a
failure from a plugin that is not HTTP, such as the Dexie or PouchDB source under an
`OptimisticUpdatesDbPlugin`. `body` is parsed as JSON when it can be, and is text otherwise.

The actions depend on the plugin and the operation:

| Plugin | Read | Write |
| --- | --- | --- |
| `HttpSwrDbPlugin` | `retry()` · `done()` · `useCached()` | `retry()` · `reject()` · `defer()` (queued) |
| `OptimisticUpdatesDbPlugin` | `retry()` · `done()` · `useCached()` | `retry()` · `reject()` |
| `HttpDbPlugin`, `HttpTransportDbPlugin` | `retry()` · `done()` | `retry()` · `done()` |

- `retry()` sends the request again and resolves when that attempt finishes. If it fails,
  `onError` runs again with `attempt + 1`. There is no cap.
- `done()` ends the request. A read throws the error; a direct write makes the save throw.
- `useCached()` ends a read with what the plugin holds locally, which may be empty.
- `reject()` gives up on queued or acknowledged changes; they are reported as
  `changes-rejected`.
- `defer()` leaves queued changes for the next sync.

An action can be called at any time, including after `onError` returns, and the operation
waits until one is called. Only the first action called counts. If `onError` throws, or the
promise it returns rejects, before an action is called, the request ends as if there were no
`onError`, and the error is logged.

Only request failures reach `onError`: an HTTP error status (`kind: "http"`) or no response
(`kind: "network"`). A response that arrives but cannot be read fails the operation directly. Under
`OptimisticUpdatesDbPlugin` any failure of the source plugin is asked about, as `kind: "store"`
unless it carries an HTTP status or is a network failure.

With no `onError`, a failed read throws, a failed direct write throws, a failed queued write
stays queued, and a failed `OptimisticUpdatesDbPlugin` mirror write is reported as
`changes-rejected`.

Authentication is not special: a 401 or 403 is `kind: "http"`. Refresh the credentials and
call `retry()`; `getHeaders` is called again for every attempt.

```ts
onError: async (e) => {
    if (e.kind === "http" && e.status === 401) {
        await refreshToken();
        return e.retry();
    }
    e.done();
}
```

When plugins are stacked, such as an `OptimisticUpdatesDbPlugin` over an `HttpDbPlugin`, the
inner plugin's `onError` runs first, and only what it ends with `done()` reaches the outer one.

`OptimisticUpdatesDbPlugin` loads a collection from its source on the first read, and that load
is the read `onError` sees. After `useCached()` the memory copy is not treated as loaded: the
next read loads again, and a write to that collection fails rather than landing in a copy that
does not hold the source's rows.

### Queued writes

`HttpSwrDbPlugin` sends queued changes a collection at a time, as one request. After a save,
`postOnPersist` (on by default) schedules a send `writeBatchDelayMs` later, so a burst of saves
goes out as one request; there is no separate direct-POST path. `formatRequestBody` shapes every
request, including changes sent again after a failure.

When `onError` calls `reject()` on a batch, the rejection narrows: if the response names the
refused changes (`rejectedOpIds`) or refuses the whole batch (`rejectionScope: "batch"`), those
are rejected and the rest are sent again; otherwise each change is sent on its own, and `onError`
is asked about each one that fails. A change edited again while it was being sent is not
rejected: the newer edit stays queued.

## Helpers

Both are opt-in.

- `createRetry({ maxAttempts, baseDelayMs, maxDelayMs })` returns an `onError` that retries
  `network` failures, HTTP 408, 429 and 5xx with exponential backoff, honouring
  `Retry-After`. A 401 or 403 is not retried. A request it gives up on ends with `done()` where
  there is one; a queued write is rejected when the server refused it (another 4xx) and
  otherwise deferred to the next sync; an `OptimisticUpdatesDbPlugin` write is rejected. The
  defaults are 3 attempts, a 500 ms base delay and a 30 s maximum.
- `defaultSync()` returns `{ onError: createRetry(), autoSync: { ... } }`, the behaviour these
  plugins had built in before, to spread into the constructor.

```ts
const backoff = createRetry({ maxAttempts: 3 });

new HttpSwrDbPlugin(cache, {
    getUrl,
    onError: (e) => (e.kind === "network" && e.operation === "read" ? e.useCached() : backoff(e)),
    onEvent: (e) => { ... },
});
```

## What changes

| Before | After |
| --- | --- |
| `onRevalidateError` | `onEvent` `read` with `ok: false` |
| `onRevalidateNotModified` | Removed |
| `onSync` | `onEvent` `synced` |
| `onSyncDeadLetter`, `onConflict` | `onEvent` `changes-rejected` |
| `onMirrorError` on `OptimisticUpdatesDbPlugin` | `onEvent` `changes-rejected`, and `onError` |
| `onAuthError` | `onError` with `kind: "http"` and a 401 or 403 |
| `queryRetryBaseDelayMs`, `queryRetryMaxDelayMs`, `queryRetryMaxAttempts`, `bulkPersistRetryBaseDelayMs`, `bulkPersistRetryMaxDelayMs`, `bulkPersistRetryMaxAttempts` | `createRetry(...)` in `onError` |
| `autoSync` on by default, `autoSync.onOnline` | `autoSync` off by default; `defaultSync()` turns it on |
| `syncNow()` returns `{ flushed, failed, deadLettered }` | `{ sent, failed, rejected }` |
| A failed first read resolves empty (#66) | It throws, unless `onError` calls `useCached()` |

`PluginSyncEngine` keeps `onMirrorError` and `onMirrorPersisted`: it is the building block
`OptimisticUpdatesDbPlugin` is made from, not something an app configures.

These are breaking changes with no deprecated aliases; the packages are release candidates.
