[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/replication/src](../README.md) / PluginSyncEngine

# Class: PluginSyncEngine

Defined in: [plugins/replication/src/PluginSyncEngine.ts:90](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/PluginSyncEngine.ts#L90)

## Implements

- `IDbPlugin`

## Constructors

### Constructor

> **new PluginSyncEngine**(`options`): `PluginSyncEngine`

Defined in: [plugins/replication/src/PluginSyncEngine.ts:112](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/PluginSyncEngine.ts#L112)

#### Parameters

##### options

[`PluginSyncEngineOptions`](../type-aliases/PluginSyncEngineOptions.md)

#### Returns

`PluginSyncEngine`

## Accessors

### databaseName

#### Get Signature

> **get** **databaseName**(): `string`

Defined in: [plugins/replication/src/PluginSyncEngine.ts:108](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/PluginSyncEngine.ts#L108)

The SOURCE's name. Mirrors are copies of one database rather than databases in their own
right, so the engine identifies itself by what it is a view of.

##### Returns

`string`

#### Implementation of

`IDbPlugin.databaseName`

## Methods

### query()

> **query**\<`TRoot`, `TShape`\>(`event`, `done`): `void`

Defined in: [plugins/replication/src/PluginSyncEngine.ts:131](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/PluginSyncEngine.ts#L131)

Executes a query operation on the database.

#### Type Parameters

##### TRoot

`TRoot` *extends* `object`

##### TShape

`TShape` *extends* `unknown` = `TRoot`

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

Defined in: [plugins/replication/src/PluginSyncEngine.ts:140](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/PluginSyncEngine.ts#L140)

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

Defined in: [plugins/replication/src/PluginSyncEngine.ts:149](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/PluginSyncEngine.ts#L149)

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
