[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / fieldMerge

# Function: fieldMerge()

> **fieldMerge**\<`T`\>(`options`): [`ConflictResolver`](../type-aliases/ConflictResolver.md)\<`T`\>

Defined in: [core/src/plugins/conflicts.ts:62](https://github.com/Agrejus/routier/blob/main/core/src/plugins/conflicts.ts#L62)

Keeps both sides' changes: the server's row, with every field only the client changed set to
the client's value. A field both sides changed takes `onBoth`, or the server's value.

A row the server no longer has stays deleted.

## Type Parameters

### T

`T` *extends* `object` = [`UnknownRecord`](../type-aliases/UnknownRecord.md)

## Parameters

### options

[`FieldMergeOptions`](../type-aliases/FieldMergeOptions.md)\<`T`\> = `{}`

## Returns

[`ConflictResolver`](../type-aliases/ConflictResolver.md)\<`T`\>
