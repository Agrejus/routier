[**routier-collection**](../../../README.md)

---

[routier-collection](../../../README.md) / [core/src](../README.md) / OptimisticReplicationDbPlugin

# Class: OptimisticReplicationDbPlugin

Defined in: [core/src/plugins/replication/OptimisticReplicationDbPlugin.ts:30](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/replication/OptimisticReplicationDbPlugin.ts#L30)

Interface for a database plugin, which provides query, destroy, and bulk operations.

## Implements

- [`IDbPlugin`](../interfaces/IDbPlugin.md)

## Constructors

### constructor()

> **new OptimisticReplicationDbPlugin**(`plugins`): `OptimisticReplicationDbPlugin`

Defined in: [core/src/plugins/replication/OptimisticReplicationDbPlugin.ts:39](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/replication/OptimisticReplicationDbPlugin.ts#L39)

Creates a new OptimisticDbPluginReplicator that coordinates operations between a source database and its replicas.

#### Parameters

##### plugins

[`OptimisticReplicationPluginOptions`](../type-aliases/OptimisticReplicationPluginOptions.md)

Configuration object containing the source, read, and replica database plugins

- `plugins.source` - The primary database plugin that will receive all operations first
- `plugins.read` - The read-optimized plugin (typically a memory plugin) used for fast queries
- `plugins.replicas` - Additional database plugins that will replicate operations from the source

#### Returns

`OptimisticReplicationDbPlugin`

A new OptimisticReplicationDbPlugin instance that manages the source-replica relationship

## Methods

### query()

> **query**\<`TEntity`, `TShape`\>(`event`, `done`): `void`

Defined in: [core/src/plugins/replication/OptimisticReplicationDbPlugin.ts:52](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/replication/OptimisticReplicationDbPlugin.ts#L52)

Will query the read plugin if there is one, otherwise the source plugin will be queried

#### Type Parameters

##### TEntity

`TEntity` _extends_ `object`

##### TShape

`TShape` _extends_ `unknown` = `TEntity`

#### Parameters

##### event

[`DbPluginQueryEvent`](../type-aliases/DbPluginQueryEvent.md)\<`TEntity`, `TShape`\>

##### done

[`PluginEventCallbackResult`](../type-aliases/PluginEventCallbackResult.md)\<[`ITranslatedValue`](ITranslatedValue.md)\<`TShape`\>\>

Callback with the result or error. The result must be wrapped in an `ITranslatedValue` to allow the datastore to iterate over results (for grouped queries) and determine if change tracking should be enabled.

#### Returns

`void`

#### Implementation of

[`IDbPlugin`](../interfaces/IDbPlugin.md).[`query`](../interfaces/IDbPlugin.md#query)

---

### destroy()

> **destroy**(`event`, `done`): `void`

Defined in: [core/src/plugins/replication/OptimisticReplicationDbPlugin.ts:151](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/replication/OptimisticReplicationDbPlugin.ts#L151)

Destroys or cleans up the plugin, closing connections or freeing resources.

#### Parameters

##### event

[`DbPluginEvent`](../type-aliases/DbPluginEvent.md)

##### done

[`PluginEventCallbackResult`](../type-aliases/PluginEventCallbackResult.md)\<`never`\>

Callback with an optional error.

#### Returns

`void`

#### Implementation of

[`IDbPlugin`](../interfaces/IDbPlugin.md).[`destroy`](../interfaces/IDbPlugin.md#destroy)

---

### bulkPersist()

> **bulkPersist**(`event`, `done`): `void`

Defined in: [core/src/plugins/replication/OptimisticReplicationDbPlugin.ts:176](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/replication/OptimisticReplicationDbPlugin.ts#L176)

Executes bulk operations (add, update, remove) on the database.

#### Parameters

##### event

[`DbPluginBulkPersistEvent`](../type-aliases/DbPluginBulkPersistEvent.md)

The bulk operations event containing schema, parent, and changes.

##### done

[`PluginEventCallbackPartialResult`](../type-aliases/PluginEventCallbackPartialResult.md)\<[`BulkPersistResult`](BulkPersistResult.md)\>

Callback with the result or error.

#### Returns

`void`

#### Implementation of

[`IDbPlugin`](../interfaces/IDbPlugin.md).[`bulkPersist`](../interfaces/IDbPlugin.md#bulkpersist)
