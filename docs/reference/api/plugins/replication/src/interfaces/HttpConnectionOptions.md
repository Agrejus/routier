[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/replication/src](../README.md) / HttpConnectionOptions

# Interface: HttpConnectionOptions

Defined in: [plugins/replication/src/HttpDbPlugin.ts:29](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpDbPlugin.ts#L29)

Plugin configuration.

## Extended by

- [`HttpPluginOptions`](HttpPluginOptions.md)
- [`HttpSwrDbPluginOptions`](HttpSwrDbPluginOptions.md)

## Properties

### getUrl()

> **getUrl**: (`collectionName`) => `string`

Defined in: [plugins/replication/src/HttpDbPlugin.ts:30](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpDbPlugin.ts#L30)

#### Parameters

##### collectionName

`string`

#### Returns

`string`

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

***

### getHeaders()?

> `optional` **getHeaders**: () => `Record`\<`string`, `string`\> \| `Promise`\<`Record`\<`string`, `string`\>\>

Defined in: [plugins/replication/src/HttpDbPlugin.ts:42](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpDbPlugin.ts#L42)

Headers for every request (e.g. Authorization). Can be async. Re-evaluated per retry attempt.

#### Returns

`Record`\<`string`, `string`\> \| `Promise`\<`Record`\<`string`, `string`\>\>

***

### ignoreQueryForCollections?

> `optional` **ignoreQueryForCollections**: `string`[]

Defined in: [plugins/replication/src/HttpDbPlugin.ts:47](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpDbPlugin.ts#L47)

Collection names for which to ignore the query and select everything.
No filter, sort, skip, or take is sent; server returns full allowed set.

***

### requestTimeoutMs?

> `optional` **requestTimeoutMs**: `number`

Defined in: [plugins/replication/src/HttpDbPlugin.ts:49](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpDbPlugin.ts#L49)

Per-request timeout (ms); a hung connection fails instead of stalling forever. Default 30_000; 0 disables.

***

### minRequestIntervalMs?

> `optional` **minRequestIntervalMs**: `number`

Defined in: [plugins/replication/src/HttpDbPlugin.ts:58](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpDbPlugin.ts#L58)

Minimum gap between requests to the same URL (reads) or collection (writes). Default 100.

This plugin is the only place HTTP actually leaves the process, so pacing lives here: a
composing plugin cannot leak past it, and an app using this plugin directly gets the same
protection. Concurrent GETs for one URL collapse into a single request. 0 removes the gap;
calls for one key still never overlap.

***

### writeBatchDelayMs?

> `optional` **writeBatchDelayMs**: `number`

Defined in: [plugins/replication/src/HttpDbPlugin.ts:66](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpDbPlugin.ts#L66)

Quiet window (ms) used to batch writes to the same URL. Default 25.

Every POST accepted during the window contributes its adds/updates/removes (and opIds) to
one request. The timer restarts when another write arrives, so a burst of ten saves becomes
one POST rather than ten serialized POSTs. Set to 0 to disable batching.

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
