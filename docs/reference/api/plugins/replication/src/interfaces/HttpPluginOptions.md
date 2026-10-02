[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/replication/src](../README.md) / HttpPluginOptions

# Interface: HttpPluginOptions

Defined in: [plugins/replication/src/HttpDbPlugin.ts:46](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpDbPlugin.ts#L46)

Plugin configuration.

## Extended by

- [`HttpSwrDbPluginOptions`](HttpSwrDbPluginOptions.md)

## Properties

### getUrl()

> **getUrl**: (`collectionName`) => `string`

Defined in: [plugins/replication/src/HttpDbPlugin.ts:47](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpDbPlugin.ts#L47)

#### Parameters

##### collectionName

`string`

#### Returns

`string`

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

***

### getHeaders()?

> `optional` **getHeaders**: () => `Record`\<`string`, `string`\> \| `Promise`\<`Record`\<`string`, `string`\>\>

Defined in: [plugins/replication/src/HttpDbPlugin.ts:59](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpDbPlugin.ts#L59)

Headers for every request (e.g. Authorization). Can be async. Re-evaluated per retry attempt.

#### Returns

`Record`\<`string`, `string`\> \| `Promise`\<`Record`\<`string`, `string`\>\>

***

### ignoreQueryForCollections?

> `optional` **ignoreQueryForCollections**: `string`[]

Defined in: [plugins/replication/src/HttpDbPlugin.ts:64](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpDbPlugin.ts#L64)

Collection names for which to ignore the query and select everything.
No filter, sort, skip, or take is sent; server returns full allowed set.

***

### queryRetryBaseDelayMs?

> `optional` **queryRetryBaseDelayMs**: `number`

Defined in: [plugins/replication/src/HttpDbPlugin.ts:70](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpDbPlugin.ts#L70)

Base delay (ms) for exponential backoff on query retry. When 0 or omitted, no retries (single attempt).
401/403 never retried (except once after a successful re-auth); other failures retry with
jittered delay capped at queryRetryMaxDelayMs, honoring Retry-After.

***

### queryRetryMaxDelayMs?

> `optional` **queryRetryMaxDelayMs**: `number`

Defined in: [plugins/replication/src/HttpDbPlugin.ts:72](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpDbPlugin.ts#L72)

Max delay (ms) between query retries. Ignored when queryRetryBaseDelayMs is 0.

***

### queryRetryMaxAttempts?

> `optional` **queryRetryMaxAttempts**: `number`

Defined in: [plugins/replication/src/HttpDbPlugin.ts:74](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpDbPlugin.ts#L74)

Max number of query attempts (including initial). Default 10. 401/403 stop immediately.

***

### requestTimeoutMs?

> `optional` **requestTimeoutMs**: `number`

Defined in: [plugins/replication/src/HttpDbPlugin.ts:76](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpDbPlugin.ts#L76)

Per-request timeout (ms); a hung connection fails instead of stalling forever. Default 30_000; 0 disables.

***

### minRequestIntervalMs?

> `optional` **minRequestIntervalMs**: `number`

Defined in: [plugins/replication/src/HttpDbPlugin.ts:85](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpDbPlugin.ts#L85)

Minimum gap between requests to the same URL (reads) or collection (writes). Default 100.

This plugin is the only place HTTP actually leaves the process, so pacing lives here: a
composing plugin cannot leak past it, and an app using this plugin directly gets the same
protection. Concurrent GETs for one URL collapse into a single request. 0 removes the gap;
calls for one key still never overlap.

***

### writeBatchDelayMs?

> `optional` **writeBatchDelayMs**: `number`

Defined in: [plugins/replication/src/HttpDbPlugin.ts:93](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpDbPlugin.ts#L93)

Quiet window (ms) used to batch writes to the same URL. Default 25.

Every POST accepted during the window contributes its adds/updates/removes (and opIds) to
one request. The timer restarts when another write arrives, so a burst of ten saves becomes
one POST rather than ten serialized POSTs. Set to 0 to disable batching.

***

### onAuthError?

> `optional` **onAuthError**: [`AuthErrorHandler`](../type-aliases/AuthErrorHandler.md)

Defined in: [plugins/replication/src/HttpDbPlugin.ts:99](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpDbPlugin.ts#L99)

Called when the remote returns 401 or 403 (query and bulkPersist; use event.context to
distinguish). Return/resolve `true` to signal re-auth succeeded — the failed operation
then retries once with fresh headers.

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
