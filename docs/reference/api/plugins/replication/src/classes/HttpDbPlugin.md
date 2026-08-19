[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/replication/src](../README.md) / HttpDbPlugin

# Class: HttpDbPlugin

Defined in: [plugins/replication/src/HttpDbPlugin.ts:115](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpDbPlugin.ts#L115)

## Implements

- `IDbPlugin`

## Constructors

### Constructor

> **new HttpDbPlugin**(`options`): `HttpDbPlugin`

Defined in: [plugins/replication/src/HttpDbPlugin.ts:138](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpDbPlugin.ts#L138)

#### Parameters

##### options

[`HttpPluginOptions`](../interfaces/HttpPluginOptions.md)

#### Returns

`HttpDbPlugin`

## Properties

### databaseName

> `readonly` **databaseName**: `string`

Defined in: [plugins/replication/src/HttpDbPlugin.ts:136](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpDbPlugin.ts#L136)

See `IDbPlugin.databaseName` and `HttpPluginOptions.databaseName`.

#### Implementation of

`IDbPlugin.databaseName`

## Methods

### collectionUrl()

> **collectionUrl**(`collectionName`): `string`

Defined in: [plugins/replication/src/HttpDbPlugin.ts:156](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpDbPlugin.ts#L156)

Exposed for composing plugins (e.g. HttpSwrDbPlugin) that need to build request URLs.

#### Parameters

##### collectionName

`string`

#### Returns

`string`

***

### requestHeaders()

> **requestHeaders**(): `Promise`\<`Record`\<`string`, `string`\>\>

Defined in: [plugins/replication/src/HttpDbPlugin.ts:161](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpDbPlugin.ts#L161)

Exposed for composing plugins that need to add auth or other headers to fetch/HTTP calls.

#### Returns

`Promise`\<`Record`\<`string`, `string`\>\>

***

### notifyAuthError()

> **notifyAuthError**(`event`): `Promise`\<`boolean`\>

Defined in: [plugins/replication/src/HttpDbPlugin.ts:170](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpDbPlugin.ts#L170)

Notifies onAuthError and reports whether the handler claims re-auth succeeded
(a truthy return/resolution). Handler exceptions are logged, never propagated.

#### Parameters

##### event

[`AuthErrorEvent`](../interfaces/AuthErrorEvent.md)

#### Returns

`Promise`\<`boolean`\>

***

### query()

> **query**\<`TRoot`, `TShape`\>(`event`, `done`): `void`

Defined in: [plugins/replication/src/HttpDbPlugin.ts:234](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpDbPlugin.ts#L234)

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

Defined in: [plugins/replication/src/HttpDbPlugin.ts:330](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpDbPlugin.ts#L330)

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

### postJson()

> **postJson**(`url`, `body`, `_collectionName`): `Promise`\<`unknown`\>

Defined in: [plugins/replication/src/HttpDbPlugin.ts:435](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpDbPlugin.ts#L435)

Enqueues a body for batching by URL, then POSTs the merged body through the pacer.

Exposed because a composing plugin has no business opening its own sockets: this used to be
duplicated inside HttpSwrDbPlugin, with a second RequestTracker and no pacing at all, so
every write bypassed everything this class guarantees.

#### Parameters

##### url

`string`

##### body

`string`

##### \_collectionName

`string`

#### Returns

`Promise`\<`unknown`\>

***

### pendingRequestCount()

> **pendingRequestCount**(): `number`

Defined in: [plugins/replication/src/HttpDbPlugin.ts:455](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpDbPlugin.ts#L455)

Calls accepted and not finished, including writes waiting in the batch window.

#### Returns

`number`

***

### destroy()

> **destroy**(`_event`, `done`): `void`

Defined in: [plugins/replication/src/HttpDbPlugin.ts:478](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpDbPlugin.ts#L478)

Destroys or cleans up the plugin, closing connections or freeing resources.

#### Parameters

##### \_event

`DbPluginEvent`

##### done

`PluginEventCallbackResult`\<`never`\>

Callback with an optional error.

#### Returns

`void`

#### Implementation of

`IDbPlugin.destroy`
