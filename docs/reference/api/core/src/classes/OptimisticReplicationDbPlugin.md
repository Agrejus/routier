[**routier-collection**](/reference/api/README)

---

[routier-collection](/reference/api/README) / [core/src](/reference/api/core/src/README) / OptimisticReplicationDbPlugin

# Class: OptimisticReplicationDbPlugin

Defined in: [core/src/plugins/replication/OptimisticReplicationDbPlugin.ts:30](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/replication/OptimisticReplicationDbPlugin.ts#L30)

Interface for a database plugin, which provides query, destroy, and bulk operations.

## Implements

- [`IDbPlugin`](/reference/api/core/src/interfaces/IDbPlugin)

## Constructors

### constructor()

> **new OptimisticReplicationDbPlugin**(`plugins`): `OptimisticReplicationDbPlugin`

Defined in: [core/src/plugins/replication/OptimisticReplicationDbPlugin.ts:39](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/replication/OptimisticReplicationDbPlugin.ts#L39)

Creates a new OptimisticDbPluginReplicator that coordinates operations between a source database and its replicas.

#### Parameters

##### plugins

[`OptimisticReplicationPluginOptions`](/reference/api/core/src/type-aliases/OptimisticReplicationPluginOptions)

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

[`DbPluginQueryEvent`](/reference/api/core/src/type-aliases/DbPluginQueryEvent)\<`TEntity`, `TShape`\>

##### done

[`PluginEventCallbackResult`](/reference/api/core/src/type-aliases/PluginEventCallbackResult)\<`ITranslatedValue`\<`TShape`\>\>

Callback with the result or error. The result must be wrapped in an `ITranslatedValue` to allow the datastore to iterate over results (for grouped queries) and determine if change tracking should be enabled.

#### Returns

`void`

#### Implementation of

[`IDbPlugin`](/reference/api/core/src/interfaces/IDbPlugin).[`query`](/reference/api/core/src/interfaces/IDbPlugin#query)

---

### destroy()

> **destroy**(`event`, `done`): `void`

Defined in: [core/src/plugins/replication/OptimisticReplicationDbPlugin.ts:151](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/replication/OptimisticReplicationDbPlugin.ts#L151)

Destroys or cleans up the plugin, closing connections or freeing resources.

#### Parameters

##### event

[`DbPluginEvent`](/reference/api/core/src/type-aliases/DbPluginEvent)

##### done

[`PluginEventCallbackResult`](/reference/api/core/src/type-aliases/PluginEventCallbackResult)\<`never`\>

Callback with an optional error.

#### Returns

`void`

#### Implementation of

[`IDbPlugin`](/reference/api/core/src/interfaces/IDbPlugin).[`destroy`](/reference/api/core/src/interfaces/IDbPlugin#destroy)

---

### bulkPersist()

> **bulkPersist**(`event`, `done`): `void`

Defined in: [core/src/plugins/replication/OptimisticReplicationDbPlugin.ts:176](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/replication/OptimisticReplicationDbPlugin.ts#L176)

Executes bulk operations (add, update, remove) on the database.

#### Parameters

##### event

[`DbPluginBulkPersistEvent`](/reference/api/core/src/type-aliases/DbPluginBulkPersistEvent)

The bulk operations event containing schema, parent, and changes.

##### done

[`PluginEventCallbackPartialResult`](/reference/api/core/src/type-aliases/PluginEventCallbackPartialResult)\<[`BulkPersistResult`](/reference/api/core/src/classes/BulkPersistResult)\>

Callback with the result or error.

#### Returns

`void`

#### Implementation of

[`IDbPlugin`](/reference/api/core/src/interfaces/IDbPlugin).[`bulkPersist`](/reference/api/core/src/interfaces/IDbPlugin#bulkpersist)
