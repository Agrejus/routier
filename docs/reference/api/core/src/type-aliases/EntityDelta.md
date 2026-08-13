[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / EntityDelta

# Type Alias: EntityDelta\<T\>

> **EntityDelta**\<`T`\> = `DeltaProperties`\<[`InferType`](InferType.md)\<`T`\>\>

Defined in: [core/src/plugins/types.ts:138](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/types.ts#L138)

What changed about an entity, expressed as a **partial entity**.

A change two levels deep appears where it actually lives —
`{ nested: { inner: { value } } }` — not as a flattened key.

This deliberately carries no storage vocabulary. It used to be typed
`{ [key: string]: string | number | Date }`, which was wrong twice over: it excluded
booleans, nulls, arrays and objects that the schema happily allows, and its flat
scalar shape was really a SQL `SET column = ?` list — one storage family's concern
leaking into the contract every plugin sees.

Translating this into storage terms belongs to the plugin. A document store can merge it
as-is; a SQL plugin decides which columns it touches and how a nested value is encoded
(see `toColumnAssignments` in `@routier/sql-plugin-core`, which stores nested objects and
arrays as JSON). Core does not need to know, and must not.

## Type Parameters

### T

`T` *extends* `object`
