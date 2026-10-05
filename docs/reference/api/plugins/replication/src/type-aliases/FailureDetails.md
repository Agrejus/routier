[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/replication/src](../README.md) / FailureDetails

# Type Alias: FailureDetails\<TOperation\>

> **FailureDetails**\<`TOperation`\> = [`FailureKind`](FailureKind.md) & `object`

Defined in: plugins/replication/src/syncHooks.ts:29

## Type Declaration

### operation

> **operation**: `TOperation`

### collectionName

> **collectionName**: `string`

### method

> **method**: `string` \| `null`

### url

> **url**: `string` \| `null`

### attempt

> **attempt**: `number`

### error

> **error**: `Error`

## Type Parameters

### TOperation

`TOperation` *extends* `"read"` \| `"write"`
