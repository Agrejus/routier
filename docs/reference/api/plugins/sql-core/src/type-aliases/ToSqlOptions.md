[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/sql-core/src](../README.md) / ToSqlOptions

# Type Alias: ToSqlOptions

> **ToSqlOptions** = `object`

Defined in: [plugins/sql-core/src/sql.ts:595](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/sql-core/src/sql.ts#L595)

## Properties

### alias?

> `optional` **alias**: `string`

Defined in: [plugins/sql-core/src/sql.ts:604](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/sql-core/src/sql.ts#L604)

Table alias to qualify every column with — `"o"."name"` rather than `"name"`.

Needed only when the statement names more than one table, which today means a join. Any
column present on BOTH sides is otherwise ambiguous and the engine rejects the whole
statement; a discriminator column that every collection carries makes that the normal case
rather than an edge one.

***

### paramOffset?

> `optional` **paramOffset**: `number`

Defined in: [plugins/sql-core/src/sql.ts:612](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/sql-core/src/sql.ts#L612)

Where this clause's placeholders start counting.

Irrelevant to a dialect with positional `?`, and load-bearing for one with numbered
placeholders: two clauses rendered separately and concatenated both start at `$1`, so the
second binds the first's values. The caller adding the clauses knows the running total.
