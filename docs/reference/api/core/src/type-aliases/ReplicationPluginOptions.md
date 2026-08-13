[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / ReplicationPluginOptions

# Type Alias: ReplicationPluginOptions

> **ReplicationPluginOptions** = `object`

Defined in: [core/src/plugins/types.ts:94](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/types.ts#L94)

Represents a collection of database plugins with a primary source and optional replicas.
Used for implementing read/write separation and high availability.

## Properties

### source

> **source**: [`IDbPlugin`](../interfaces/IDbPlugin.md)

Defined in: [core/src/plugins/types.ts:96](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/types.ts#L96)

The primary database plugin that handles all write operations, do not include in the list of replicas.

***

### replicas

> **replicas**: [`IDbPlugin`](../interfaces/IDbPlugin.md)[]

Defined in: [core/src/plugins/types.ts:98](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/types.ts#L98)

Array of replica database plugins that can be used for read operations.

***

### read?

> `optional` **read**: [`IDbPlugin`](../interfaces/IDbPlugin.md)

Defined in: [core/src/plugins/types.ts:104](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/types.ts#L104)

The primary database plugin that handles all read operations, do not include in the list of replicas.
Used when the source plugin should generate the identity properties, but the read replica will only
read data. Typically this is a MemoryPlugin. Should not be included in the list of replicas.
