[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/replication/src](../README.md) / OptimisticUpdatesDbPlugin

# Class: OptimisticUpdatesDbPlugin

Defined in: [plugins/replication/src/OptimisticUpdatesDbPlugin.ts:16](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/OptimisticUpdatesDbPlugin.ts#L16)

## Implements

- `IDbPlugin`

## Constructors

### Constructor

> **new OptimisticUpdatesDbPlugin**(`source`, `options?`): `OptimisticUpdatesDbPlugin`

Defined in: [plugins/replication/src/OptimisticUpdatesDbPlugin.ts:50](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/OptimisticUpdatesDbPlugin.ts#L50)

#### Parameters

##### source

`IDbPlugin`

##### options?

[`OptimisticUpdatesDbPluginOptions`](../type-aliases/OptimisticUpdatesDbPluginOptions.md)

#### Returns

`OptimisticUpdatesDbPlugin`

## Accessors

### databaseName

#### Get Signature

> **get** **databaseName**(): `string`

Defined in: [plugins/replication/src/OptimisticUpdatesDbPlugin.ts:46](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/OptimisticUpdatesDbPlugin.ts#L46)

The SOURCE's name. The read plugin is a per-instance scratch copy with a uuid name;
identifying by it would give every instance its own subscription scope and cut two
stores over one source database off from each other.

##### Returns

`string`

#### Implementation of

`IDbPlugin.databaseName`

## Methods

### query()

> **query**\<`TEntity`, `TShape`\>(`event`, `done`): `void`

Defined in: [plugins/replication/src/OptimisticUpdatesDbPlugin.ts:74](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/OptimisticUpdatesDbPlugin.ts#L74)

Executes a query operation on the database.

#### Type Parameters

##### TEntity

`TEntity` *extends* `object`

##### TShape

`TShape` *extends* `unknown` = `TEntity`

#### Parameters

##### event

`DbPluginQueryEvent`\<`TEntity`, `TShape`\>

The query event containing schema, parent, and query operation.

##### done

`PluginEventCallbackResult`\<`ITranslatedValue`\<`TShape`\>\>

Callback with the result or error.

#### Returns

`void`

#### Implementation of

`IDbPlugin.query`

***

### destroy()

> **destroy**(`event`, `done`): `void`

Defined in: [plugins/replication/src/OptimisticUpdatesDbPlugin.ts:237](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/OptimisticUpdatesDbPlugin.ts#L237)

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

***

### bulkPersist()

> **bulkPersist**(`event`, `done`): `void`

Defined in: [plugins/replication/src/OptimisticUpdatesDbPlugin.ts:241](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/OptimisticUpdatesDbPlugin.ts#L241)

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
