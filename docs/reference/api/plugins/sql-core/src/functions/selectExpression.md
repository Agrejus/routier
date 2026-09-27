[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/sql-core/src](../README.md) / selectExpression

# Function: selectExpression()

> **selectExpression**(`column`, `dialect`): `string`

Defined in: [plugins/sql-core/src/columns.ts:305](https://github.com/Agrejus/routier/blob/main/plugins/sql-core/src/columns.ts#L305)

The SELECT expression for one result column.

Aliased back to the name the result shape expects whenever that is not where the value is
stored: a nested property is read out of its JSON column by path, and a renamed one is read from
its `.from()` column. A projection names its columns by in-memory name (`mappedResultColumns`),
so without the alias `.map(x => x.displayName)` selects a column the table does not have.

## Parameters

### column

`ResultColumn`

### dialect

[`SqlDialect`](../interfaces/SqlDialect.md)

## Returns

`string`
