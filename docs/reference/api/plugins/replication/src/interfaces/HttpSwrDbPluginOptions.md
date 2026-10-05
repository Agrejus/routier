[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/replication/src](../README.md) / HttpSwrDbPluginOptions

# Interface: HttpSwrDbPluginOptions

Defined in: [plugins/replication/src/HttpSwrDbPlugin.ts:68](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpSwrDbPlugin.ts#L68)

SWR-specific options for HttpSwrDbPlugin.

## Extends

- [`HttpConnectionOptions`](HttpConnectionOptions.md).[`SyncHooks`](SyncHooks.md)\<[`SwrRequestError`](../type-aliases/SwrRequestError.md)\>

## Properties

### getUrl()

> **getUrl**: (`collectionName`) => `string`

Defined in: [plugins/replication/src/HttpDbPlugin.ts:30](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpDbPlugin.ts#L30)

#### Parameters

##### collectionName

`string`

#### Returns

`string`

#### Inherited from

[`HttpConnectionOptions`](HttpConnectionOptions.md).[`getUrl`](HttpConnectionOptions.md#geturl)

***

### databaseName?

> `optional` **databaseName**: `string`

Defined in: [plugins/replication/src/HttpDbPlugin.ts:40](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpDbPlugin.ts#L40)

See `IDbPlugin.databaseName`. `getUrl` is a caller-supplied function of collection name,
so there is no origin this plugin can read without inventing a collection to ask about —
hence a plain option with a shared default.

Set it whenever an application talks to more than one HTTP backend over the same schema:
leaving both on the default makes them one database as far as subscriptions are
concerned, and each would be notified of the other's writes.

#### Inherited from

[`HttpConnectionOptions`](HttpConnectionOptions.md).[`databaseName`](HttpConnectionOptions.md#databasename)

***

### getHeaders()?

> `optional` **getHeaders**: () => `Record`\<`string`, `string`\> \| `Promise`\<`Record`\<`string`, `string`\>\>

Defined in: [plugins/replication/src/HttpDbPlugin.ts:42](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpDbPlugin.ts#L42)

Headers for every request (e.g. Authorization). Can be async. Re-evaluated per retry attempt.

#### Returns

`Record`\<`string`, `string`\> \| `Promise`\<`Record`\<`string`, `string`\>\>

#### Inherited from

[`HttpConnectionOptions`](HttpConnectionOptions.md).[`getHeaders`](HttpConnectionOptions.md#getheaders)

***

### ignoreQueryForCollections?

> `optional` **ignoreQueryForCollections**: `string`[]

Defined in: [plugins/replication/src/HttpDbPlugin.ts:47](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpDbPlugin.ts#L47)

Collection names for which to ignore the query and select everything.
No filter, sort, skip, or take is sent; server returns full allowed set.

#### Inherited from

[`HttpConnectionOptions`](HttpConnectionOptions.md).[`ignoreQueryForCollections`](HttpConnectionOptions.md#ignorequeryforcollections)

***

### requestTimeoutMs?

> `optional` **requestTimeoutMs**: `number`

Defined in: [plugins/replication/src/HttpDbPlugin.ts:49](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpDbPlugin.ts#L49)

Per-request timeout (ms); a hung connection fails instead of stalling forever. Default 30_000; 0 disables.

#### Inherited from

[`HttpConnectionOptions`](HttpConnectionOptions.md).[`requestTimeoutMs`](HttpConnectionOptions.md#requesttimeoutms)

***

### minRequestIntervalMs?

> `optional` **minRequestIntervalMs**: `number`

Defined in: [plugins/replication/src/HttpDbPlugin.ts:58](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpDbPlugin.ts#L58)

Minimum gap between requests to the same URL (reads) or collection (writes). Default 100.

This plugin is the only place HTTP actually leaves the process, so pacing lives here: a
composing plugin cannot leak past it, and an app using this plugin directly gets the same
protection. Concurrent GETs for one URL collapse into a single request. 0 removes the gap;
calls for one key still never overlap.

#### Inherited from

[`HttpConnectionOptions`](HttpConnectionOptions.md).[`minRequestIntervalMs`](HttpConnectionOptions.md#minrequestintervalms)

***

### writeBatchDelayMs?

> `optional` **writeBatchDelayMs**: `number`

Defined in: [plugins/replication/src/HttpDbPlugin.ts:66](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpDbPlugin.ts#L66)

Quiet window (ms) used to batch writes to the same URL. Default 25.

Every POST accepted during the window contributes its adds/updates/removes (and opIds) to
one request. The timer restarts when another write arrives, so a burst of ten saves becomes
one POST rather than ten serialized POSTs. Set to 0 to disable batching.

#### Inherited from

[`HttpConnectionOptions`](HttpConnectionOptions.md).[`writeBatchDelayMs`](HttpConnectionOptions.md#writebatchdelayms)

***

### translateRemoteResponse()?

> `optional` **translateRemoteResponse**: (`schema`, `data`) => `unknown`

Defined in: [plugins/replication/src/HttpDbPlugin.ts:68](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpDbPlugin.ts#L68)

#### Parameters

##### schema

`CompiledSchema`\<`UnknownRecord`\>

##### data

`unknown`

#### Returns

`unknown`

#### Inherited from

[`HttpConnectionOptions`](HttpConnectionOptions.md).[`translateRemoteResponse`](HttpConnectionOptions.md#translateremoteresponse)

***

### autoSync?

> `optional` **autoSync**: `boolean` \| [`AutoSyncOptions`](AutoSyncOptions.md)

Defined in: [plugins/replication/src/HttpSwrDbPlugin.ts:77](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpSwrDbPlugin.ts#L77)

Background sync policy. Omit for the automatic default (retry on a backing-off timer plus
an immediate flush when connectivity returns), pass an object to tune it, or pass `false`
to turn it off entirely and drive `syncNow()` yourself.

Turning it off does not turn off *queueing* — changes are still recorded durably before
every ack. It only means nothing replays them until you ask.

***

### postOnPersist?

> `optional` **postOnPersist**: `boolean`

Defined in: [plugins/replication/src/HttpSwrDbPlugin.ts:94](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpSwrDbPlugin.ts#L94)

Whether a save also POSTs immediately, or is left to the batching flush. Default true.

`true` is the low-latency path: the write enters HttpDbPlugin's short batching window
immediately, and its response can be reconciled through `translatePersistResponse`.
Rapid writes to the same URL share one POST by default (`writeBatchDelayMs` controls the
window), while an isolated write pays only that short delay.

`false` acknowledges locally, records the change durably as always, and leaves delivery to
the paced queue flush — one request per collection per flush, however many saves went into
it. This adds up to `autoSync.delayMs` of latency and skips echo reconciliation (the flush
has no schema to translate with), but is useful when delivery should happen only on the
background/manual sync cadence.

With `autoSync: false` as well, nothing is delivered until you call `syncNow()`.

***

### maxAgeMs?

> `optional` **maxAgeMs**: `number`

Defined in: [plugins/replication/src/HttpSwrDbPlugin.ts:96](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpSwrDbPlugin.ts#L96)

Max time (ms) to consider cache fresh; after this, the next read triggers a background revalidate. Default 60_000.

***

### conditionalRevalidation?

> `optional` **conditionalRevalidation**: `boolean`

Defined in: [plugins/replication/src/HttpSwrDbPlugin.ts:97](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpSwrDbPlugin.ts#L97)

***

### translatePersistResponse()?

> `optional` **translatePersistResponse**: (`schema`, `responseBody`) => `unknown`[]

Defined in: [plugins/replication/src/HttpSwrDbPlugin.ts:103](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpSwrDbPlugin.ts#L103)

Reconciles the POST response into the SWR store: given the response body, return the
canonical entities the server echoed (or null to skip). Fixes server-assigned ids and
timestamps drifting from the optimistic local copy.

#### Parameters

##### schema

`CompiledSchema`\<`UnknownRecord`\>

##### responseBody

`unknown`

#### Returns

`unknown`[]

***

### unsyncedQueueStore

> **unsyncedQueueStore**: `IDbPlugin`

Defined in: [plugins/replication/src/HttpSwrDbPlugin.ts:111](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpSwrDbPlugin.ts#L111)

IDbPlugin to use for persisting the unsynced queue (e.g. same as swrStore). No datastore required.
The queue is stored via query/bulkPersist in a reserved collection (_routier_unsynced).

Required: UnsyncedQueue has no default store. Pass a durable plugin to survive a
refresh with unsynced items intact, or a MemoryPlugin to accept losing them.

***

### onEvent()?

> `optional` **onEvent**: (`event`) => `void`

Defined in: plugins/replication/src/syncHooks.ts:59

#### Parameters

##### event

[`SyncEvent`](../type-aliases/SyncEvent.md)

#### Returns

`void`

#### Inherited from

[`SyncHooks`](SyncHooks.md).[`onEvent`](SyncHooks.md#onevent)

***

### onError()?

> `optional` **onError**: (`error`) => `void`

Defined in: plugins/replication/src/syncHooks.ts:60

#### Parameters

##### error

[`SwrRequestError`](../type-aliases/SwrRequestError.md)

#### Returns

`void`

#### Inherited from

[`SyncHooks`](SyncHooks.md).[`onError`](SyncHooks.md#onerror)
