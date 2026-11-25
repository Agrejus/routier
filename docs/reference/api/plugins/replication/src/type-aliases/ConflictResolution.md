[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/replication/src](../README.md) / ConflictResolution

# Type Alias: ConflictResolution\<T\>

> **ConflictResolution**\<`T`\> = `T` \| `null` \| `DeferConflict`

Defined in: core/dist/plugins/conflicts.d.ts:26

What to do about a conflict: a row to save and send again, `null` to accept the server's row,
or `{ defer: true }`.

## Type Parameters

### T

`T` *extends* `object` = `UnknownRecord`
