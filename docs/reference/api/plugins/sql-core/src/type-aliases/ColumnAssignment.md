[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/sql-core/src](../README.md) / ColumnAssignment

# Type Alias: ColumnAssignment

> **ColumnAssignment** = `object`

Defined in: [plugins/sql-core/src/columns.ts:19](https://github.com/Agrejus/routier/blob/main/plugins/sql-core/src/columns.ts#L19)

Turning a partial entity into column assignments.

`@routier/core` hands plugins an `EntityDelta` — what changed, shaped like the entity.
That is a statement about the data model and nothing else; it does not know what a column
is. This is where it becomes SQL, and it is the only place that decides a nested object
or array is stored as JSON.

Before this existed each SQL plugin read `Object.keys(delta)` directly and bound the raw
value as a parameter. That worked only because the delta type promised
`string | number | Date` — a promise the schema never made. A nested object reached the
driver as an object and either threw or was coerced to `"[object Object]"`.

## Properties

### column

> `readonly` **column**: `string`

Defined in: [plugins/sql-core/src/columns.ts:21](https://github.com/Agrejus/routier/blob/main/plugins/sql-core/src/columns.ts#L21)

Storage-side column name, already resolved through any `.from()` rename.

***

### value

> `readonly` **value**: `unknown`

Defined in: [plugins/sql-core/src/columns.ts:23](https://github.com/Agrejus/routier/blob/main/plugins/sql-core/src/columns.ts#L23)

Parameter value, JSON-encoded when the property is nested.
