[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / ReplicationPluginOptions

# Type Alias: ReplicationPluginOptions

> **ReplicationPluginOptions** = `object`

Defined in: [core/src/plugins/types.ts:65](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/types.ts#L65)

Represents a collection of database plugins with a primary source and optional replicas.
Used for implementing read/write separation and high availability.

## Properties

### source

> **source**: [`IDbPlugin`](../interfaces/IDbPlugin.md)

Defined in: [core/src/plugins/types.ts:67](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/types.ts#L67)

The primary database plugin that handles all write operations, do not include in the list of replicas.

***

### replicas

> **replicas**: [`IDbPlugin`](../interfaces/IDbPlugin.md)[]

Defined in: [core/src/plugins/types.ts:69](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/types.ts#L69)

Array of replica database plugins that can be used for read operations.

***

### read?

> `optional` **read**: [`IDbPlugin`](../interfaces/IDbPlugin.md)

Defined in: [core/src/plugins/types.ts:75](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/types.ts#L75)

The primary database plugin that handles all read operations, do not include in the list of replicas.
Used when the source plugin should generate the identity properties, but the read replica will only
read data. Typically this is a MemoryPlugin. Should not be included in the list of replicas.
