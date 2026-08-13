[**routier-collection**](/reference/api/README)

---

[routier-collection](/reference/api/README) / [core/src](/reference/api/core/src/README) / ReplicationDbPlugin

# Class: ReplicationDbPlugin

Defined in: [core/src/plugins/replication/ReplicationDbPlugin.ts:7](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/replication/ReplicationDbPlugin.ts#L7)

Interface for a database plugin, which provides query, destroy, and bulk operations.

## Implements

- [`IDbPlugin`](/reference/api/core/src/interfaces/IDbPlugin)

## Properties

### plugins

> **plugins**: [`ReplicationPluginOptions`](/reference/api/core/src/type-aliases/ReplicationPluginOptions)

Defined in: [core/src/plugins/replication/ReplicationDbPlugin.ts:9](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/replication/ReplicationDbPlugin.ts#L9)

## Constructors

### constructor()

> **new ReplicationDbPlugin**(`plugins`): `ReplicationDbPlugin`

Defined in: [core/src/plugins/replication/ReplicationDbPlugin.ts:20](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/replication/ReplicationDbPlugin.ts#L20)

Creates a new ReplicationDbPlugin that coordinates operations between a source database and its replicas.

#### Parameters

##### plugins

[`ReplicationPluginOptions`](/reference/api/core/src/type-aliases/ReplicationPluginOptions)

Configuration object containing the source, read (optional), and replica database plugins

- `plugins.source` - The primary database plugin that will receive all operations first
- `plugins.read` - Optional read-optimized plugin (typically a memory plugin) used for fast queries
- `plugins.replicas` - Additional database plugins that will replicate operations from the source

#### Returns

`ReplicationDbPlugin`

A new ReplicationDbPlugin instance that manages the source-replica relationship

## Methods

### query()

> **query**\<`TEntity`, `TShape`\>(`event`, `done`): `void`

Defined in: [core/src/plugins/replication/ReplicationDbPlugin.ts:29](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/replication/ReplicationDbPlugin.ts#L29)

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

Defined in: [core/src/plugins/replication/ReplicationDbPlugin.ts:40](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/replication/ReplicationDbPlugin.ts#L40)

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

Defined in: [core/src/plugins/replication/ReplicationDbPlugin.ts:66](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/replication/ReplicationDbPlugin.ts#L66)

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
