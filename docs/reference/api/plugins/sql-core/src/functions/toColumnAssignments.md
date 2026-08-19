[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/sql-core/src](../README.md) / toColumnAssignments

# Function: toColumnAssignments()

> **toColumnAssignments**\<`T`\>(`delta`, `schema`, `dialect`, `entity?`): [`ColumnAssignment`](../type-aliases/ColumnAssignment.md)[]

Defined in: [plugins/sql-core/src/columns.ts:122](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/sql-core/src/columns.ts#L122)

Maps a delta to the columns it assigns.

Unknown keys are skipped rather than thrown on: a delta is data arriving from another
layer, and a property that no longer exists in the schema should not take down a save
that is otherwise valid. Callers that care can compare lengths.

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

[`ColumnAssignment`](../type-aliases/ColumnAssignment.md)[]
