[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/sql-core/src](../README.md) / toColumnValueMap

# Function: toColumnValueMap()

> **toColumnValueMap**\<`T`\>(`delta`, `schema`, `dialect`, `entity?`): `Map`\<`string`, `unknown`\>

Defined in: [plugins/sql-core/src/columns.ts:163](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/sql-core/src/columns.ts#L163)

`toColumnAssignments` as a column-keyed map, for callers building a `SET` clause that
needs to look values up by column rather than iterate in order.

## Type Parameters

### T

`T` *extends* `object`

## Parameters

### delta

`Record`\<`string`, `unknown`\>

### schema

`CompiledSchema`\<`T`\>

### dialect

[`SqlDialect`](../interfaces/SqlDialect.md)

### entity?

`Record`\<`string`, `unknown`\>

## Returns

`Map`\<`string`, `unknown`\>
