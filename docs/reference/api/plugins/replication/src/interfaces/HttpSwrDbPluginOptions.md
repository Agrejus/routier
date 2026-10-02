[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/replication/src](../README.md) / HttpSwrDbPluginOptions

# Interface: HttpSwrDbPluginOptions

Defined in: [plugins/replication/src/HttpSwrDbPlugin.ts:91](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpSwrDbPlugin.ts#L91)

SWR-specific options for HttpSwrDbPlugin.

## Extends

- [`HttpPluginOptions`](HttpPluginOptions.md)

## Properties

### getUrl()

> **getUrl**: (`collectionName`) => `string`

Defined in: [plugins/replication/src/HttpDbPlugin.ts:47](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpDbPlugin.ts#L47)

#### Parameters

##### collectionName

`string`

#### Returns

`string`

#### Inherited from

[`HttpPluginOptions`](HttpPluginOptions.md).[`getUrl`](HttpPluginOptions.md#geturl)

***

### databaseName?

> `optional` **databaseName**: `string`

Defined in: [plugins/replication/src/HttpDbPlugin.ts:57](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpDbPlugin.ts#L57)

See `IDbPlugin.databaseName`. `getUrl` is a caller-supplied function of collection name,
so there is no origin this plugin can read without inventing a collection to ask about —
hence a plain option with a shared default.

Set it whenever an application talks to more than one HTTP backend over the same schema:
leaving both on the default makes them one database as far as subscriptions are
concerned, and each would be notified of the other's writes.

#### Inherited from

[`HttpPluginOptions`](HttpPluginOptions.md).[`databaseName`](HttpPluginOptions.md#databasename)

***

### getHeaders()?

> `optional` **getHeaders**: () => `Record`\<`string`, `string`\> \| `Promise`\<`Record`\<`string`, `string`\>\>

Defined in: [plugins/replication/src/HttpDbPlugin.ts:59](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpDbPlugin.ts#L59)

Headers for every request (e.g. Authorization). Can be async. Re-evaluated per retry attempt.

#### Returns

`Record`\<`string`, `string`\> \| `Promise`\<`Record`\<`string`, `string`\>\>

#### Inherited from

[`HttpPluginOptions`](HttpPluginOptions.md).[`getHeaders`](HttpPluginOptions.md#getheaders)

***

### ignoreQueryForCollections?

> `optional` **ignoreQueryForCollections**: `string`[]

Defined in: [plugins/replication/src/HttpDbPlugin.ts:64](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpDbPlugin.ts#L64)

Collection names for which to ignore the query and select everything.
No filter, sort, skip, or take is sent; server returns full allowed set.

#### Inherited from

[`HttpPluginOptions`](HttpPluginOptions.md).[`ignoreQueryForCollections`](HttpPluginOptions.md#ignorequeryforcollections)

***

### queryRetryMaxAttempts?

> `optional` **queryRetryMaxAttempts**: `number`

Defined in: [plugins/replication/src/HttpDbPlugin.ts:74](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpDbPlugin.ts#L74)

Max number of query attempts (including initial). Default 10. 401/403 stop immediately.

#### Inherited from

[`HttpPluginOptions`](HttpPluginOptions.md).[`queryRetryMaxAttempts`](HttpPluginOptions.md#queryretrymaxattempts)

***

### requestTimeoutMs?

> `optional` **requestTimeoutMs**: `number`

Defined in: [plugins/replication/src/HttpDbPlugin.ts:76](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpDbPlugin.ts#L76)

Per-request timeout (ms); a hung connection fails instead of stalling forever. Default 30_000; 0 disables.

#### Inherited from

[`HttpPluginOptions`](HttpPluginOptions.md).[`requestTimeoutMs`](HttpPluginOptions.md#requesttimeoutms)

***

### minRequestIntervalMs?

> `optional` **minRequestIntervalMs**: `number`

Defined in: [plugins/replication/src/HttpDbPlugin.ts:85](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpDbPlugin.ts#L85)

Minimum gap between requests to the same URL (reads) or collection (writes). Default 100.

This plugin is the only place HTTP actually leaves the process, so pacing lives here: a
composing plugin cannot leak past it, and an app using this plugin directly gets the same
protection. Concurrent GETs for one URL collapse into a single request. 0 removes the gap;
calls for one key still never overlap.

#### Inherited from

[`HttpPluginOptions`](HttpPluginOptions.md).[`minRequestIntervalMs`](HttpPluginOptions.md#minrequestintervalms)

***

### writeBatchDelayMs?

> `optional` **writeBatchDelayMs**: `number`

Defined in: [plugins/replication/src/HttpDbPlugin.ts:93](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpDbPlugin.ts#L93)

Quiet window (ms) used to batch writes to the same URL. Default 25.

Every POST accepted during the window contributes its adds/updates/removes (and opIds) to
one request. The timer restarts when another write arrives, so a burst of ten saves becomes
one POST rather than ten serialized POSTs. Set to 0 to disable batching.

#### Inherited from

[`HttpPluginOptions`](HttpPluginOptions.md).[`writeBatchDelayMs`](HttpPluginOptions.md#writebatchdelayms)

***

### onAuthError?

> `optional` **onAuthError**: [`AuthErrorHandler`](../type-aliases/AuthErrorHandler.md)

Defined in: [plugins/replication/src/HttpDbPlugin.ts:99](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpDbPlugin.ts#L99)

Called when the remote returns 401 or 403 (query and bulkPersist; use event.context to
distinguish). Return/resolve `true` to signal re-auth succeeded — the failed operation
then retries once with fresh headers.

#### Inherited from

[`HttpPluginOptions`](HttpPluginOptions.md).[`onAuthError`](HttpPluginOptions.md#onautherror)

***

### translateRemoteResponse()?

> `optional` **translateRemoteResponse**: (`schema`, `data`) => `unknown`

Defined in: [plugins/replication/src/HttpDbPlugin.ts:101](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpDbPlugin.ts#L101)

#### Parameters

##### schema

`CompiledSchema`\<`UnknownRecord`\>

##### data

`unknown`

#### Returns

`unknown`

#### Inherited from

[`HttpPluginOptions`](HttpPluginOptions.md).[`translateRemoteResponse`](HttpPluginOptions.md#translateremoteresponse)

***

### autoSync?

> `optional` **autoSync**: `false` \| [`AutoSyncOptions`](AutoSyncOptions.md)

Defined in: [plugins/replication/src/HttpSwrDbPlugin.ts:100](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpSwrDbPlugin.ts#L100)

Background sync policy. Omit for the automatic default (retry on a backing-off timer plus
an immediate flush when connectivity returns), pass an object to tune it, or pass `false`
to turn it off entirely and drive `syncNow()` yourself.

Turning it off does not turn off *queueing* — changes are still recorded durably before
every ack. It only means nothing replays them until you ask.

***

### onSync()?

> `optional` **onSync**: (`outcome`) => `void`

Defined in: [plugins/replication/src/HttpSwrDbPlugin.ts:105](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpSwrDbPlugin.ts#L105)

Called after every flush, automatic or manual, with what it moved. Use it for a
"last synced" indicator or to refresh a pending count.

#### Parameters

##### outcome

[`SyncOutcome`](SyncOutcome.md)

#### Returns

`void`

***

### postOnPersist?

> `optional` **postOnPersist**: `boolean`

Defined in: [plugins/replication/src/HttpSwrDbPlugin.ts:122](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpSwrDbPlugin.ts#L122)

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

Defined in: [plugins/replication/src/HttpSwrDbPlugin.ts:124](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpSwrDbPlugin.ts#L124)

Max time (ms) to consider cache fresh; after this, the next read triggers a background revalidate. Default 60_000.

***

### bulkPersistRetryBaseDelayMs?

> `optional` **bulkPersistRetryBaseDelayMs**: `number`

Defined in: [plugins/replication/src/HttpSwrDbPlugin.ts:126](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpSwrDbPlugin.ts#L126)

Base delay (ms) for exponential backoff on bulkPersist retry. Default 1000.

***

### bulkPersistRetryMaxDelayMs?

> `optional` **bulkPersistRetryMaxDelayMs**: `number`

Defined in: [plugins/replication/src/HttpSwrDbPlugin.ts:128](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpSwrDbPlugin.ts#L128)

Max delay (ms) between bulkPersist retries. Default 60_000.

***

### bulkPersistRetryMaxAttempts?

> `optional` **bulkPersistRetryMaxAttempts**: `number`

Defined in: [plugins/replication/src/HttpSwrDbPlugin.ts:130](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpSwrDbPlugin.ts#L130)

Max number of bulkPersist attempts (including initial). Default 10. Auth errors (401/403) stop immediately.

***

### queryRetryBaseDelayMs?

> `optional` **queryRetryBaseDelayMs**: `number`

Defined in: [plugins/replication/src/HttpSwrDbPlugin.ts:132](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpSwrDbPlugin.ts#L132)

Passed to HttpDbPlugin (query retry is handled there). Base delay (ms) for backoff. Default 1000.

#### Overrides

[`HttpPluginOptions`](HttpPluginOptions.md).[`queryRetryBaseDelayMs`](HttpPluginOptions.md#queryretrybasedelayms)

***

### queryRetryMaxDelayMs?

> `optional` **queryRetryMaxDelayMs**: `number`

Defined in: [plugins/replication/src/HttpSwrDbPlugin.ts:134](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpSwrDbPlugin.ts#L134)

Passed to HttpDbPlugin (query retry is handled there). Max delay (ms) between retries. Default 60_000.

#### Overrides

[`HttpPluginOptions`](HttpPluginOptions.md).[`queryRetryMaxDelayMs`](HttpPluginOptions.md#queryretrymaxdelayms)

***

### onRevalidateError()?

> `optional` **onRevalidateError**: (`error`, `context`) => `void`

Defined in: [plugins/replication/src/HttpSwrDbPlugin.ts:139](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpSwrDbPlugin.ts#L139)

Called when background revalidate fails (e.g. offline, network error). Use for logging or toasts.
Revalidate failures are not reported back via done(); the UI keeps showing cached data.

#### Parameters

##### error

`Error`

##### context

###### collectionName

`string`

###### cacheKey?

`string`

#### Returns

`void`

***

### conditionalRevalidation?

> `optional` **conditionalRevalidation**: `boolean`

Defined in: [plugins/replication/src/HttpSwrDbPlugin.ts:140](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpSwrDbPlugin.ts#L140)

***

### onRevalidateNotModified()?

> `optional` **onRevalidateNotModified**: (`context`) => `void`

Defined in: [plugins/replication/src/HttpSwrDbPlugin.ts:141](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpSwrDbPlugin.ts#L141)

#### Parameters

##### context

###### collectionName

`string`

###### cacheKey

`string`

#### Returns

`void`

***

### onSyncDeadLetter()?

> `optional` **onSyncDeadLetter**: (`changes`, `error`) => `void`

Defined in: [plugins/replication/src/HttpSwrDbPlugin.ts:147](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpSwrDbPlugin.ts#L147)

Called when the queue permanently gives up on changes: the server rejected them with a
non-retryable status (4xx other than 401/403/408/429). Dead-lettered changes stop
flushing and stop shielding their entities from revalidate — surface them to the user.

#### Parameters

##### changes

[`DeadLetteredChange`](../type-aliases/DeadLetteredChange.md)[]

##### error

`Error`

#### Returns

`void`

***

### onConflict()?

> `optional` **onConflict**: (`context`) => `void`

Defined in: [plugins/replication/src/HttpSwrDbPlugin.ts:152](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpSwrDbPlugin.ts#L152)

Called when the server answers 409 Conflict for a change. Informational — the change
dead-letters (409 is non-retryable) and the server copy wins on the next revalidate.

#### Parameters

##### context

###### collectionName

`string`

###### entities

`unknown`[]

###### error

`Error`

#### Returns

`void`

***

### translatePersistResponse()?

> `optional` **translatePersistResponse**: (`schema`, `responseBody`) => `unknown`[]

Defined in: [plugins/replication/src/HttpSwrDbPlugin.ts:158](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpSwrDbPlugin.ts#L158)

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

Defined in: [plugins/replication/src/HttpSwrDbPlugin.ts:166](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpSwrDbPlugin.ts#L166)

IDbPlugin to use for persisting the unsynced queue (e.g. same as swrStore). No datastore required.
The queue is stored via query/bulkPersist in a reserved collection (_routier_unsynced).

Required: UnsyncedQueue has no default store. Pass a durable plugin to survive a
refresh with unsynced items intact, or a MemoryPlugin to accept losing them.
