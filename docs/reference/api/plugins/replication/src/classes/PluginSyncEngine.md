[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/replication/src](../README.md) / PluginSyncEngine

# Class: PluginSyncEngine

Defined in: [plugins/replication/src/PluginSyncEngine.ts:87](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/PluginSyncEngine.ts#L87)

## Implements

- `IDbPlugin`

## Constructors

### Constructor

> **new PluginSyncEngine**(`options`): `PluginSyncEngine`

Defined in: [plugins/replication/src/PluginSyncEngine.ts:107](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/PluginSyncEngine.ts#L107)

#### Parameters

##### options

[`PluginSyncEngineOptions`](../type-aliases/PluginSyncEngineOptions.md)

#### Returns

`PluginSyncEngine`

## Accessors

### databaseName

#### Get Signature

> **get** **databaseName**(): `string`

Defined in: [plugins/replication/src/PluginSyncEngine.ts:103](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/PluginSyncEngine.ts#L103)

The SOURCE's name. Mirrors are copies of one database rather than databases in their own
right, so the engine identifies itself by what it is a view of.

##### Returns

`string`

#### Implementation of

`IDbPlugin.databaseName`

## Methods

### query()

> **query**\<`TRoot`, `TShape`\>(`event`, `done`): `void`

Defined in: [plugins/replication/src/PluginSyncEngine.ts:124](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/PluginSyncEngine.ts#L124)

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

Defined in: [plugins/replication/src/PluginSyncEngine.ts:133](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/PluginSyncEngine.ts#L133)

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

Defined in: [plugins/replication/src/PluginSyncEngine.ts:142](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/PluginSyncEngine.ts#L142)

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
