[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/replication/src](../README.md) / Conflict

# Type Alias: Conflict\<T\>

> **Conflict**\<`T`\> = `object`

Defined in: core/dist/plugins/conflicts.d.ts:11

A local change the server refused because the row changed there first.

Every row is in the application's shape. `base` holds the values the edited fields had before
the local edit, so it names exactly the fields the client changed; it is empty for an add, and
empty when the plugin could not learn them. `remote` is the server's current row, or `null`
when the server no longer has it.

## Type Parameters

### T

`T` *extends* `object` = `UnknownRecord`

## Properties

### collectionName

> **collectionName**: `string`

Defined in: core/dist/plugins/conflicts.d.ts:12

***

### kind

> **kind**: `ConflictKind`

Defined in: core/dist/plugins/conflicts.d.ts:13

***

### base

> **base**: `Partial`\<`T`\>

Defined in: core/dist/plugins/conflicts.d.ts:14

***

### local

> **local**: `T`

Defined in: core/dist/plugins/conflicts.d.ts:15

***

### remote

> **remote**: `T` \| `null`

Defined in: core/dist/plugins/conflicts.d.ts:16
