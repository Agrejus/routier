[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / splitSendableOptions

# Function: splitSendableOptions()

> **splitSendableOptions**\<`T`\>(`options`): `object`

Defined in: [core/src/plugins/wire/query.ts:31](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/wire/query.ts#L31)

Splits options into the PREFIX that can be sent and the remainder that cannot.

A prefix, not a filtered subset, and that is the whole correctness argument. Options are ordered,
and most are not idempotent: sending `count` while keeping `map` local would count unmapped rows,
and applying `take` on both sides would window twice. So the split stops at the first option that
cannot travel, and everything from there on runs where the closures are.

It is the same shape as the database/memory split this composes with — one more cut of the same
ordered list, for one more reason.

## Type Parameters

### T

`T`

## Parameters

### options

[`QueryOptionsCollection`](../classes/QueryOptionsCollection.md)\<`T`\>

## Returns

`object`

### sendable

> **sendable**: [`QueryOptionsCollection`](../classes/QueryOptionsCollection.md)\<`T`\>

### local

> **local**: [`QueryOptionsCollection`](../classes/QueryOptionsCollection.md)\<`T`\>
