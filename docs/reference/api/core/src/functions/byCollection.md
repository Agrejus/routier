[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / byCollection

# Function: byCollection()

> **byCollection**\<`T`\>(`resolvers`, `fallback`): [`ConflictResolver`](../type-aliases/ConflictResolver.md)\<`T`\>

Defined in: [core/src/plugins/conflicts.ts:92](https://github.com/Agrejus/routier/blob/main/core/src/plugins/conflicts.ts#L92)

Picks a resolver by collection name, and `fallback` for every other collection.

## Type Parameters

### T

`T` *extends* `object` = [`UnknownRecord`](../type-aliases/UnknownRecord.md)

## Parameters

### resolvers

`Readonly`\<`Record`\<`string`, [`ConflictResolver`](../type-aliases/ConflictResolver.md)\<`T`\>\>\>

### fallback

[`ConflictResolver`](../type-aliases/ConflictResolver.md)\<`T`\> = `...`

## Returns

[`ConflictResolver`](../type-aliases/ConflictResolver.md)\<`T`\>
