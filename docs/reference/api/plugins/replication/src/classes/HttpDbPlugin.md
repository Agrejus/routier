[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/replication/src](../README.md) / HttpDbPlugin

# Class: HttpDbPlugin

Defined in: [plugins/replication/src/HttpDbPlugin.ts:80](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpDbPlugin.ts#L80)

## Implements

- `IDbPlugin`

## Constructors

### Constructor

> **new HttpDbPlugin**(`options`): `HttpDbPlugin`

Defined in: [plugins/replication/src/HttpDbPlugin.ts:101](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpDbPlugin.ts#L101)

#### Parameters

##### options

[`HttpPluginOptions`](../interfaces/HttpPluginOptions.md)

#### Returns

`HttpDbPlugin`

## Properties

### databaseName

> `readonly` **databaseName**: `string`

Defined in: [plugins/replication/src/HttpDbPlugin.ts:99](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpDbPlugin.ts#L99)

See `IDbPlugin.databaseName` and `HttpPluginOptions.databaseName`.

#### Implementation of

`IDbPlugin.databaseName`

## Methods

### collectionUrl()

> **collectionUrl**(`collectionName`): `string`

Defined in: [plugins/replication/src/HttpDbPlugin.ts:123](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpDbPlugin.ts#L123)

Exposed for composing plugins (e.g. HttpSwrDbPlugin) that need to build request URLs.

#### Parameters

##### collectionName

`string`

#### Returns

`string`

***

### requestHeaders()

> **requestHeaders**(): `Promise`\<`Record`\<`string`, `string`\>\>

Defined in: [plugins/replication/src/HttpDbPlugin.ts:128](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpDbPlugin.ts#L128)

Exposed for composing plugins that need to add auth or other headers to fetch/HTTP calls.

#### Returns

`Promise`\<`Record`\<`string`, `string`\>\>

***

### query()

> **query**\<`TRoot`, `TShape`\>(`event`, `done`): `void`

Defined in: [plugins/replication/src/HttpDbPlugin.ts:134](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpDbPlugin.ts#L134)

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

### queryUrl()

> **queryUrl**\<`TRoot`, `TShape`\>(`event`): `string`

Defined in: [plugins/replication/src/HttpDbPlugin.ts:195](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpDbPlugin.ts#L195)

#### Type Parameters

##### TRoot

`TRoot` *extends* `object`

##### TShape

`TShape`

#### Parameters

##### event

`DbPluginQueryEvent`\<`TRoot`, `TShape`\>

#### Returns

`string`

***

### queryConditional()

> **queryConditional**\<`TRoot`, `TShape`\>(`event`, `ifNoneMatch`): `Promise`\<`ConditionalQueryResult`\<`TShape`\>\>

Defined in: [plugins/replication/src/HttpDbPlugin.ts:200](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpDbPlugin.ts#L200)

#### Type Parameters

##### TRoot

`TRoot` *extends* `object`

##### TShape

`TShape`

#### Parameters

##### event

`DbPluginQueryEvent`\<`TRoot`, `TShape`\>

##### ifNoneMatch

`string`

#### Returns

`Promise`\<`ConditionalQueryResult`\<`TShape`\>\>

***

### bulkPersist()

> **bulkPersist**(`event`, `done`): `void`

Defined in: [plugins/replication/src/HttpDbPlugin.ts:208](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpDbPlugin.ts#L208)

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

Defined in: [plugins/replication/src/HttpDbPlugin.ts:271](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpDbPlugin.ts#L271)

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

Defined in: [plugins/replication/src/HttpDbPlugin.ts:291](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpDbPlugin.ts#L291)

Calls accepted and not finished, including writes waiting in the batch window.

#### Returns

`number`

***

### destroy()

> **destroy**(`_event`, `done`): `void`

Defined in: [plugins/replication/src/HttpDbPlugin.ts:321](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpDbPlugin.ts#L321)

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
