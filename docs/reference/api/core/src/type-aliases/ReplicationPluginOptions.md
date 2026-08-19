[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / ReplicationPluginOptions

# Type Alias: ReplicationPluginOptions

> **ReplicationPluginOptions** = `object`

Defined in: [core/src/plugins/types.ts:136](https://github.com/Agrejus/routier/blob/main/core/src/plugins/types.ts#L136)

Represents a collection of database plugins with a primary source and optional replicas.
Used for implementing read/write separation and high availability.

## Properties

### source

> **source**: [`IDbPlugin`](../interfaces/IDbPlugin.md)

Defined in: [core/src/plugins/types.ts:138](https://github.com/Agrejus/routier/blob/main/core/src/plugins/types.ts#L138)

The primary database plugin that handles all write operations, do not include in the list of replicas.

***

### replicas

> **replicas**: [`IDbPlugin`](../interfaces/IDbPlugin.md)[]

Defined in: [core/src/plugins/types.ts:140](https://github.com/Agrejus/routier/blob/main/core/src/plugins/types.ts#L140)

Array of replica database plugins that can be used for read operations.

***

### read?

> `optional` **read**: [`IDbPlugin`](../interfaces/IDbPlugin.md)

Defined in: [core/src/plugins/types.ts:146](https://github.com/Agrejus/routier/blob/main/core/src/plugins/types.ts#L146)

The primary database plugin that handles all read operations, do not include in the list of replicas.
Used when the source plugin should generate the identity properties, but the read replica will only
read data. Typically this is a MemoryPlugin. Should not be included in the list of replicas.
