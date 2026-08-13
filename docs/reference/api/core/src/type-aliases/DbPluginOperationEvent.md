[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / DbPluginOperationEvent

# Type Alias: DbPluginOperationEvent\<TOperation\>

> **DbPluginOperationEvent**\<`TOperation`\> = [`DbPluginEvent`](DbPluginEvent.md) & `object`

Defined in: [core/src/plugins/types.ts:85](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/types.ts#L85)

Event for a specific plugin operation, extending the base event with an operation payload.

## Type Declaration

### operation

> **operation**: `TOperation`

The operation payload (query, changes, etc.).

## Type Parameters

### TOperation

`TOperation`
