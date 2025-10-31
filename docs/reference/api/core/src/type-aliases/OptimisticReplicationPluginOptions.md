[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / OptimisticReplicationPluginOptions

# Type Alias: OptimisticReplicationPluginOptions

> **OptimisticReplicationPluginOptions** = `object`

Defined in: [core/src/plugins/types.ts:78](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/types.ts#L78)

## Properties

### source

> **source**: [`IDbPlugin`](../interfaces/IDbPlugin.md)

Defined in: [core/src/plugins/types.ts:80](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/types.ts#L80)

The primary database plugin that handles all write operations, do not include in the list of replicas.

***

### replicas

> **replicas**: [`IDbPlugin`](../interfaces/IDbPlugin.md)[]

Defined in: [core/src/plugins/types.ts:83](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/types.ts#L83)

Array of replica database plugins that can be used for read operations.

***

### read

> **read**: [`IDbPlugin`](../interfaces/IDbPlugin.md)

Defined in: [core/src/plugins/types.ts:86](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/types.ts#L86)

Must be a MemoryPlugin
