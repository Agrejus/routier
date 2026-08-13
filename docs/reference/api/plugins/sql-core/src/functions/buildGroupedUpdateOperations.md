[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/sql-core/src](../README.md) / buildGroupedUpdateOperations

# Function: buildGroupedUpdateOperations()

> **buildGroupedUpdateOperations**\<`T`\>(`schema`, `updates`, `dialect`, `options?`): [`GroupedUpdateOperation`](../type-aliases/GroupedUpdateOperation.md)[]

Defined in: [plugins/sql-core/src/updates.ts:165](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/sql-core/src/updates.ts#L165)

## Type Parameters

### T

`T` *extends* `object`

## Parameters

### schema

`CompiledSchema`\<`T`\>

### updates

readonly [`EntityUpdate`](../type-aliases/EntityUpdate.md)[]

### dialect

[`SqlDialect`](../interfaces/SqlDialect.md)

### options?

#### suffix?

`string`

Appended verbatim to each statement, e.g. ` RETURNING "a", "b"`. Omit for
engines without RETURNING.

## Returns

[`GroupedUpdateOperation`](../type-aliases/GroupedUpdateOperation.md)[]
