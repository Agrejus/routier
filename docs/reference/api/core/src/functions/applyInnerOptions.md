[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / applyInnerOptions

# Function: applyInnerOptions()

> **applyInnerOptions**(`rows`, `innerOptions`): [`UnknownRecord`](../type-aliases/UnknownRecord.md)[]

Defined in: [core/src/plugins/query/join.ts:140](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/query/join.ts#L140)

Applies an inner side's own filters to its rows.

**This is the correctness trap of the whole feature.** Every interpretation of a join
bypasses the inner collection's normal datastore read path, so the inner side's soft-delete
scope and `.scope()` filters exist ONLY because `innerOptions` carries them. An interpreter
that skips this returns soft-deleted rows.

Filters only. Nothing else reaches `innerOptions` today — scopes are filters — and applying
a `skip`/`take` recorded against the inner collection to the rows feeding a join would
change which pairs exist rather than which rows are visible.

## Parameters

### rows

[`UnknownRecord`](../type-aliases/UnknownRecord.md)[]

### innerOptions

[`QueryOptionsCollection`](../classes/QueryOptionsCollection.md)\<`any`\>

## Returns

[`UnknownRecord`](../type-aliases/UnknownRecord.md)[]
