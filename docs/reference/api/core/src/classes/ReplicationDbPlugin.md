[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / ReplicationDbPlugin

# Class: ReplicationDbPlugin

Defined in: [core/src/plugins/replication/ReplicationDbPlugin.ts:7](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/replication/ReplicationDbPlugin.ts#L7)

Interface for a database plugin, which provides query, destroy, and bulk operations.

## Implements

- [`IDbPlugin`](../interfaces/IDbPlugin.md)

## Properties

### plugins

> **plugins**: [`ReplicationPluginOptions`](../type-aliases/ReplicationPluginOptions.md)

Defined in: [core/src/plugins/replication/ReplicationDbPlugin.ts:9](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/replication/ReplicationDbPlugin.ts#L9)

## Methods

### create()

> `static` **create**(`plugins`): `ReplicationDbPlugin`

Defined in: [core/src/plugins/replication/ReplicationDbPlugin.ts:22](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/replication/ReplicationDbPlugin.ts#L22)

Creates a new DbPluginReplicator that coordinates operations between a source database and its replicas.

#### Parameters

##### plugins

[`ReplicationPluginOptions`](../type-aliases/ReplicationPluginOptions.md)

#### Returns

`ReplicationDbPlugin`

A new DbPluginReplicator instance that manages the source-replica relationship

***

### query()

> **query**\<`TEntity`, `TShape`\>(`event`, `done`): `void`

Defined in: [core/src/plugins/replication/ReplicationDbPlugin.ts:29](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/replication/ReplicationDbPlugin.ts#L29)

Will query the read plugin if there is one, otherwise the source plugin will be queried

#### Type Parameters

##### TEntity

`TEntity` *extends* `object`

##### TShape

`TShape` *extends* `unknown` = `TEntity`

#### Parameters

##### event

[`DbPluginQueryEvent`](../type-aliases/DbPluginQueryEvent.md)\<`TEntity`, `TShape`\>

##### done

[`PluginEventCallbackResult`](../type-aliases/PluginEventCallbackResult.md)\<`TShape`\>

#### Returns

`void`

#### Implementation of

[`IDbPlugin`](../interfaces/IDbPlugin.md).[`query`](../interfaces/IDbPlugin.md#query)

***

### destroy()

> **destroy**(`event`, `done`): `void`

Defined in: [core/src/plugins/replication/ReplicationDbPlugin.ts:40](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/replication/ReplicationDbPlugin.ts#L40)

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

***

### bulkPersist()

> **bulkPersist**(`event`, `done`): `void`

Defined in: [core/src/plugins/replication/ReplicationDbPlugin.ts:66](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/replication/ReplicationDbPlugin.ts#L66)

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
