[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / toEntityShape

# Function: toEntityShape()

> **toEntityShape**(`schema`, `rows`): [`UnknownRecord`](../type-aliases/UnknownRecord.md)[]

Defined in: [core/src/plugins/query/join.ts:71](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/join.ts#L71)

Turns storage-shape records into entity-shape values, one side of a join at a time.

The inner side does NOT pass through the outer query's normal deserialization —
`DatabaseDataAccessStrategy.query` transforms against the outer schema only — so each side
is deserialized with its own schema here, which is what makes the two halves of a tuple
readable by the same property names the caller wrote in the selectors.

`"diff"` rather than `"proxy"`: join results are read-only projections and never attach to
the change tracker, so there is nothing for a tracking proxy to record.

## Parameters

### schema

[`CompiledSchemaCore`](../type-aliases/CompiledSchemaCore.md)\<`any`\>

### rows

readonly `unknown`[]

## Returns

[`UnknownRecord`](../type-aliases/UnknownRecord.md)[]
