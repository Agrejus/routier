[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/sql-core/src](../README.md) / toColumnValueMap

# Function: toColumnValueMap()

> **toColumnValueMap**\<`T`\>(`delta`, `schema`, `dialect`, `entity?`): `Map`\<`string`, `unknown`\>

Defined in: [plugins/sql-core/src/columns.ts:163](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/sql-core/src/columns.ts#L163)

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
