[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / clientWins

# Function: clientWins()

> **clientWins**\<`T`\>(): [`ConflictResolver`](../type-aliases/ConflictResolver.md)\<`T`\>

Defined in: [core/src/plugins/conflicts.ts:44](https://github.com/Agrejus/routier/blob/main/core/src/plugins/conflicts.ts#L44)

The local row wins, and is sent again over the server's version.

## Type Parameters

### T

`T` *extends* `object` = [`UnknownRecord`](../type-aliases/UnknownRecord.md)

## Returns

[`ConflictResolver`](../type-aliases/ConflictResolver.md)\<`T`\>
