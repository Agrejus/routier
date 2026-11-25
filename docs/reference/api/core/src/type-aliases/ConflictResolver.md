[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / ConflictResolver

# Type Alias: ConflictResolver()\<T\>

> **ConflictResolver**\<`T`\> = (`conflict`) => [`ConflictResolution`](ConflictResolution.md)\<`T`\> \| `Promise`\<[`ConflictResolution`](ConflictResolution.md)\<`T`\>\>

Defined in: [core/src/plugins/conflicts.ts:34](https://github.com/Agrejus/routier/blob/main/core/src/plugins/conflicts.ts#L34)

Decides a conflict. May be async, so it can ask the user. Throwing hands the change back to
the plugin's usual handling for a rejected write.

## Type Parameters

### T

`T` *extends* `object` = [`UnknownRecord`](UnknownRecord.md)

## Parameters

### conflict

[`Conflict`](Conflict.md)\<`T`\>

## Returns

[`ConflictResolution`](ConflictResolution.md)\<`T`\> \| `Promise`\<[`ConflictResolution`](ConflictResolution.md)\<`T`\>\>
