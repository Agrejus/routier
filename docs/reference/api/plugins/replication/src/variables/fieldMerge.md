[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/replication/src](../README.md) / fieldMerge

# Variable: fieldMerge()

> `const` **fieldMerge**: \<`T`\>(`options?`) => [`ConflictResolver`](../type-aliases/ConflictResolver.md)\<`T`\>

Defined in: core/dist/plugins/conflicts.d.ts:52

Keeps both sides' changes: the server's row, with every field only the client changed set to
the client's value. A field both sides changed takes `onBoth`, or the server's value.

A row the server no longer has stays deleted.

## Type Parameters

### T

`T` *extends* `object` = `UnknownRecord`

## Parameters

### options?

[`FieldMergeOptions`](../type-aliases/FieldMergeOptions.md)\<`T`\>

## Returns

[`ConflictResolver`](../type-aliases/ConflictResolver.md)\<`T`\>
