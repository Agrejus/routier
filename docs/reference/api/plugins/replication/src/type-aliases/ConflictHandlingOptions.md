[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/replication/src](../README.md) / ConflictHandlingOptions

# Type Alias: ConflictHandlingOptions

> **ConflictHandlingOptions** = `object`

Defined in: [plugins/replication/src/conflictSettler.ts:12](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/conflictSettler.ts#L12)

## Extended by

- [`HttpSwrDbPluginOptions`](../interfaces/HttpSwrDbPluginOptions.md)

## Properties

### resolveConflict?

> `optional` **resolveConflict**: [`ConflictResolver`](ConflictResolver.md)

Defined in: [plugins/replication/src/conflictSettler.ts:14](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/conflictSettler.ts#L14)

Decides a write the server refused as a conflict. Without it, a conflict is handled like any other failed write.

***

### isConflict()?

> `optional` **isConflict**: (`failure`) => `boolean`

Defined in: [plugins/replication/src/conflictSettler.ts:16](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/conflictSettler.ts#L16)

Whether a failed write is a conflict. Default: an HTTP 409.

#### Parameters

##### failure

[`FailureKind`](FailureKind.md)

#### Returns

`boolean`

***

### fetchRemote()?

> `optional` **fetchRemote**: (`collectionName`, `local`) => `Promise`\<`UnknownRecord` \| `null`\>

Defined in: [plugins/replication/src/conflictSettler.ts:18](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/conflictSettler.ts#L18)

Reads the server's current row when the conflict response does not carry it.

#### Parameters

##### collectionName

`string`

##### local

`UnknownRecord`

#### Returns

`Promise`\<`UnknownRecord` \| `null`\>
