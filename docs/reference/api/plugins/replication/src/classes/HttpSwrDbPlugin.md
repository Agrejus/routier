[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/replication/src](../README.md) / HttpSwrDbPlugin

# Class: HttpSwrDbPlugin

Defined in: [plugins/replication/src/HttpSwrDbPlugin.ts:220](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/replication/src/HttpSwrDbPlugin.ts#L220)

## Implements

- `IDbPlugin`

## Constructors

### Constructor

> **new HttpSwrDbPlugin**(`swrStore`, `options`): `HttpSwrDbPlugin`

Defined in: [plugins/replication/src/HttpSwrDbPlugin.ts:287](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/replication/src/HttpSwrDbPlugin.ts#L287)

#### Parameters

##### swrStore

`IDbPlugin`

##### options

[`HttpSwrDbPluginOptions`](../interfaces/HttpSwrDbPluginOptions.md)

#### Returns

`HttpSwrDbPlugin`

## Accessors

### databaseName

#### Get Signature

> **get** **databaseName**(): `string`

Defined in: [plugins/replication/src/HttpSwrDbPlugin.ts:283](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/replication/src/HttpSwrDbPlugin.ts#L283)

The REMOTE's name. The swr store is a local cache of it, so two instances backed by one
server are one database for subscription purposes — which is what makes their stores
see each other's writes.

##### Returns

`string`

#### Implementation of

`IDbPlugin.databaseName`

## Methods

### syncNow()

> **syncNow**(): `Promise`\<[`SyncOutcome`](../interfaces/SyncOutcome.md)\>

Defined in: [plugins/replication/src/HttpSwrDbPlugin.ts:323](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/replication/src/HttpSwrDbPlugin.ts#L323)

Flushes everything unsynced now, instead of waiting for the background timer.

The manual half of the sync story: a "Sync now" button, a flush before logout, or the
whole mechanism when `autoSync: false`. Safe to call at any time and safe to call
concurrently with the background loop — each change carries an idempotency key, so a
server that tracks them applies a double-send once.

#### Returns

`Promise`\<[`SyncOutcome`](../interfaces/SyncOutcome.md)\>

***

### pendingCount()

> **pendingCount**(): `Promise`\<`number`\>

Defined in: [plugins/replication/src/HttpSwrDbPlugin.ts:331](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/replication/src/HttpSwrDbPlugin.ts#L331)

How many changes are waiting to reach the server. 0 means everything acked locally has
also been confirmed remotely. Dead-lettered changes are not counted — see `deadLetters()`.

#### Returns

`Promise`\<`number`\>

***

### deadLetters()

> **deadLetters**(): `Promise`\<`InferCompiledSchema`\<\{ `id`: `SchemaIdentity`\<`string`, `"identity"` \| `"key"`\>; `collectionName`: `SchemaString`\<`string`, `never`\>; `recordIds`: `SchemaString`\<`string`, `never`\>; `changeKind`: `SchemaOptional`\<`string`, `"optional"`\>; `entityJson`: `SchemaString`\<`string`, `never`\>; `revision`: `SchemaOptional`\<`string`, `"optional"`\>; `opId`: `SchemaOptional`\<`string`, `"optional"`\>; `status`: `SchemaOptional`\<`string`, `"optional"`\>; `attempts`: `SchemaOptional`\<`number`, `"optional"`\>; `seq`: `SchemaOptional`\<`number`, `"optional"`\>; `payloadJson`: `SchemaOptional`\<`string`, `"optional"`\>; \}\>[]\>

Defined in: [plugins/replication/src/HttpSwrDbPlugin.ts:340](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/replication/src/HttpSwrDbPlugin.ts#L340)

Changes the queue has given up on, because the server rejected them in a way retrying
cannot fix. These are also reported as they happen through `onSyncDeadLetter`; this is
the "what is still broken" view for a screen the user can act on.

#### Returns

`Promise`\<`InferCompiledSchema`\<\{ `id`: `SchemaIdentity`\<`string`, `"identity"` \| `"key"`\>; `collectionName`: `SchemaString`\<`string`, `never`\>; `recordIds`: `SchemaString`\<`string`, `never`\>; `changeKind`: `SchemaOptional`\<`string`, `"optional"`\>; `entityJson`: `SchemaString`\<`string`, `never`\>; `revision`: `SchemaOptional`\<`string`, `"optional"`\>; `opId`: `SchemaOptional`\<`string`, `"optional"`\>; `status`: `SchemaOptional`\<`string`, `"optional"`\>; `attempts`: `SchemaOptional`\<`number`, `"optional"`\>; `seq`: `SchemaOptional`\<`number`, `"optional"`\>; `payloadJson`: `SchemaOptional`\<`string`, `"optional"`\>; \}\>[]\>

***

### retryDeadLetters()

> **retryDeadLetters**(): `Promise`\<\{ `revived`: `number`; `outcome`: [`SyncOutcome`](../interfaces/SyncOutcome.md); \}\>

Defined in: [plugins/replication/src/HttpSwrDbPlugin.ts:350](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/replication/src/HttpSwrDbPlugin.ts#L350)

Puts dead-lettered changes back in the queue and flushes. Returns how many were revived.

For after the reason they failed is gone — the record was corrected, a bad deploy was
rolled back. Never automatic: the server already said this cannot work.

#### Returns

`Promise`\<\{ `revived`: `number`; `outcome`: [`SyncOutcome`](../interfaces/SyncOutcome.md); \}\>

***

### query()

> **query**\<`TRoot`, `TShape`\>(`event`, `done`): `void`

Defined in: [plugins/replication/src/HttpSwrDbPlugin.ts:361](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/replication/src/HttpSwrDbPlugin.ts#L361)

Executes a query operation on the database.

#### Type Parameters

##### TRoot

`TRoot` *extends* `object`

##### TShape

`TShape`

#### Parameters

##### event

`DbPluginQueryEvent`\<`TRoot`, `TShape`\>

The query event containing schema, parent, and query operation.

##### done

`PluginEventCallbackResult`\<`ITranslatedValue`\<`TShape`\>\>

Callback with the result or error.

#### Returns

`void`

#### Implementation of

`IDbPlugin.query`

***

### bulkPersist()

> **bulkPersist**(`event`, `done`): `void`

Defined in: [plugins/replication/src/HttpSwrDbPlugin.ts:391](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/replication/src/HttpSwrDbPlugin.ts#L391)

Executes bulk operations (add, update, remove) on the database.

#### Parameters

##### event

`DbPluginBulkPersistEvent`

The bulk operations event containing schema, parent, and changes.

##### done

`PluginEventCallbackPartialResult`\<`BulkPersistResult`\>

Callback with the result or error.

#### Returns

`void`

#### Implementation of

`IDbPlugin.bulkPersist`

***

### destroy()

> **destroy**(`event`, `done`): `void`

Defined in: [plugins/replication/src/HttpSwrDbPlugin.ts:402](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/replication/src/HttpSwrDbPlugin.ts#L402)

Destroys or cleans up the plugin, closing connections or freeing resources.

#### Parameters

##### event

`DbPluginEvent`

##### done

`PluginEventCallbackResult`\<`never`\>

Callback with an optional error.

#### Returns

`void`

#### Implementation of

`IDbPlugin.destroy`
