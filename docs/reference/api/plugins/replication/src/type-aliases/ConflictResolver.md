[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/replication/src](../README.md) / ConflictResolver

# Type Alias: ConflictResolver()\<T\>

> **ConflictResolver**\<`T`\> = (`conflict`) => [`ConflictResolution`](ConflictResolution.md)\<`T`\> \| `Promise`\<[`ConflictResolution`](ConflictResolution.md)\<`T`\>\>

Defined in: core/dist/plugins/conflicts.d.ts:31

Decides a conflict. May be async, so it can ask the user. Throwing hands the change back to
the plugin's usual handling for a rejected write.

## Type Parameters

### T

`T` *extends* `object` = `UnknownRecord`

## Parameters

### conflict

[`Conflict`](Conflict.md)\<`T`\>

## Returns

[`ConflictResolution`](ConflictResolution.md)\<`T`\> \| `Promise`\<[`ConflictResolution`](ConflictResolution.md)\<`T`\>\>
