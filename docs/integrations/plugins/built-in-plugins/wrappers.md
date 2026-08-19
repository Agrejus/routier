---
title: Wrapper Plugins
---

# Wrapper Plugins

Wrapper plugins add behavior around any `IDbPlugin`. Import the generic wrappers from `@routier/core/plugins`:

```ts
import {
  BatchingDbPlugin,
  CacheDbPlugin,
  ConcurrencyDbPlugin,
  RetryDbPlugin,
  TelemetryDbPlugin,
} from "@routier/core/plugins";
```

## CacheDbPlugin

```ts
new CacheDbPlugin(inner, { max: 100 })
```

A read-through least-recently-used cache. `max` is the number of query results (default `100`, minimum `1`). A write invalidates every cached query for each schema it touches.

Use it only when stale reads from external writers are acceptable. It cannot observe a write performed by another process, tab, store, or by code that bypasses this wrapper. Non-structured-cloneable query results are returned but not cached.

## RetryDbPlugin

```ts
new RetryDbPlugin(inner, {
  attempts: 3,
  delayMs: attempt => 50 * 2 ** (attempt - 2),
  shouldRetry: (error, attempt) => isTransient(error),
})
```

Retries failed **reads only**. `attempts` includes the initial call and defaults to `3`. The default delay is 50 ms before attempt 2, then 100 ms, 200 ms, and so on. The default retries every read error; use `shouldRetry` to exclude permanent errors.

Writes are never retried: a generic wrapper cannot know whether a failed non-atomic batch partly landed, and repeating an identity insert can duplicate data.

## ConcurrencyDbPlugin

```ts
new ConcurrencyDbPlugin(inner)
```

Adds optimistic concurrency without changing schemas or entity types. The wrapper maintains a hidden `__version` field. An update to a row previously read through this wrapper includes the observed version; a stale write rejects the save with `OptimisticConcurrencyError` and writes nothing when the backend is transactional.

Recovery is explicit: catch the error, re-read current data, reapply the intended change, and save again.

```ts
import { OptimisticConcurrencyError } from "@routier/core/errors";

try {
  await store.saveChangesAsync();
} catch (error) {
  if (OptimisticConcurrencyError.is(error)) {
    console.log(error.collectionName, error.conflicts);
  }
}
```

The inner plugin must enforce conditional updates. SQLite (except D1), PostgreSQL, MySQL, MongoDB, memory, browser-storage, and file-system support the contract. Dexie and PouchDB do not. Existing SQL tables need an added nullable numeric `__version` column; newly created tables receive it automatically.

A row attached and updated without first being read by this wrapper has no observed version and is initialized unchecked. It is protected after the next read.

## BatchingDbPlugin

```ts
new BatchingDbPlugin(inner, {
  isAtomic: true,
  maxBatchSize: 100,
})
```

Serializes overlapping writes. With `isAtomic` omitted or false it sends one queued save at a time. With `isAtomic: true`, overlapping saves may be coalesced into one inner write, up to `maxBatchSize` (default `100`). It never sleeps to fill a batch; only work already waiting is grouped.

`isAtomic: true` is a promise made by your application: when `inner.bulkPersist` reports failure, none of that save was applied. SQLite, PostgreSQL, and MySQL make a save transactional. Do not enable coalescing around a plugin that can partially apply a failed batch.

## TelemetryDbPlugin

```ts
new TelemetryDbPlugin(inner, { onEvent: event => myMetrics.record(event) })
```

Measures every operation the inner plugin performs and hands one `TelemetryEvent` per call to a
sink. It stores nothing and changes nothing: the result object reaches the caller untouched.

Each event carries the `operation` (`"query"`, `"bulkPersist"` or `"destroy"`), `durationMs`,
`ok` (`"success"`, `"partial"` or `"error"`), the `eventId` and `source` of the plugin event, and
the `schemas` it touched. `error` is present when `ok` is not `"success"`.

`onEvent` defaults to `loggerSink()`, which writes through the levelled logger — so
`ROUTIER_LOG_LEVEL` governs whether anything is emitted. `collectingSink(array)` pushes events
into an array, for tests or custom buffering.

```ts
import { collectingSink, TelemetryEvent } from "@routier/core/plugins";

const events: TelemetryEvent[] = [];
const store = new MyStore(new TelemetryDbPlugin(inner, { onEvent: collectingSink(events) }));
```

A sink that throws is swallowed: observability never fails a data operation.

For OpenTelemetry spans instead of plain events, use
[`@routier/otel-plugin`](/integrations/plugins/built-in-plugins/otel).

## Replication wrappers

`@routier/replication-plugin` exports higher-level wrappers:

- `HttpDbPlugin` sends queries and writes directly over HTTP.
- `HttpTransportDbPlugin` transports the plugin event protocol.
- `HttpSwrDbPlugin` serves a local mirror and revalidates from HTTP.
- `OptimisticUpdatesDbPlugin` serves fast optimistic values while a source persists them.
- `PluginSyncEngine` exposes source/mirror failure and acknowledgement policies.

See [Replication Plugin](/integrations/plugins/built-in-plugins/replication/README), [HTTP Transport](/integrations/plugins/http-transport), and [Plugin Compositions](/guides/plugin-compositions).

## Ordering

Read the stack from outside to inside:

```ts
new CacheDbPlugin(
  new RetryDbPlugin(
    new ConcurrencyDbPlugin(
      new PostgresDbPlugin(config)
    )
  )
)
```

Here cache hits bypass retry/concurrency reads; misses are retried, concurrency sees returned rows, and PostgreSQL performs storage. Writes invalidate the cache, pass through retry unchanged, gain a version check, then run in PostgreSQL.

Prefer the smallest stack that states the guarantees you need. Every wrapper should have a reason and an understood failure boundary.
