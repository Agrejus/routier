[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/replication/src](../README.md) / byCollection

# Variable: byCollection()

> `const` **byCollection**: \<`T`\>(`resolvers`, `fallback?`) => [`ConflictResolver`](../type-aliases/ConflictResolver.md)\<`T`\>

Defined in: core/dist/plugins/conflicts.d.ts:54

Picks a resolver by collection name, and `fallback` for every other collection.

## Type Parameters

### T

`T` *extends* `object` = `UnknownRecord`

## Parameters

### resolvers

`Readonly`\<`Record`\<`string`, [`ConflictResolver`](../type-aliases/ConflictResolver.md)\<`T`\>\>\>

### fallback?

[`ConflictResolver`](../type-aliases/ConflictResolver.md)\<`T`\>

## Returns

[`ConflictResolver`](../type-aliases/ConflictResolver.md)\<`T`\>
