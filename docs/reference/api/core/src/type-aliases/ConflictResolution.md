[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / ConflictResolution

# Type Alias: ConflictResolution\<T\>

> **ConflictResolution**\<`T`\> = `T` \| `null` \| [`DeferConflict`](DeferConflict.md)

Defined in: [core/src/plugins/conflicts.ts:28](https://github.com/Agrejus/routier/blob/main/core/src/plugins/conflicts.ts#L28)

What to do about a conflict: a row to save and send again, `null` to accept the server's row,
or `{ defer: true }`.

## Type Parameters

### T

`T` *extends* `object` = [`UnknownRecord`](UnknownRecord.md)
