[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / Conflict

# Type Alias: Conflict\<T\>

> **Conflict**\<`T`\> = `object`

Defined in: [core/src/plugins/conflicts.ts:13](https://github.com/Agrejus/routier/blob/main/core/src/plugins/conflicts.ts#L13)

A local change the server refused because the row changed there first.

Every row is in the application's shape. `base` holds the values the edited fields had before
the local edit, so it names exactly the fields the client changed; it is empty for an add, and
empty when the plugin could not learn them. `remote` is the server's current row, or `null`
when the server no longer has it.

## Type Parameters

### T

`T` *extends* `object` = [`UnknownRecord`](UnknownRecord.md)

## Properties

### collectionName

> **collectionName**: `string`

Defined in: [core/src/plugins/conflicts.ts:14](https://github.com/Agrejus/routier/blob/main/core/src/plugins/conflicts.ts#L14)

***

### kind

> **kind**: [`ConflictKind`](ConflictKind.md)

Defined in: [core/src/plugins/conflicts.ts:15](https://github.com/Agrejus/routier/blob/main/core/src/plugins/conflicts.ts#L15)

***

### base

> **base**: `Partial`\<`T`\>

Defined in: [core/src/plugins/conflicts.ts:16](https://github.com/Agrejus/routier/blob/main/core/src/plugins/conflicts.ts#L16)

***

### local

> **local**: `T`

Defined in: [core/src/plugins/conflicts.ts:17](https://github.com/Agrejus/routier/blob/main/core/src/plugins/conflicts.ts#L17)

***

### remote

> **remote**: `T` \| `null`

Defined in: [core/src/plugins/conflicts.ts:18](https://github.com/Agrejus/routier/blob/main/core/src/plugins/conflicts.ts#L18)
