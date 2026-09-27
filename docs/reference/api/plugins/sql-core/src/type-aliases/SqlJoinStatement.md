[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/sql-core/src](../README.md) / SqlJoinStatement

# Type Alias: SqlJoinStatement

> **SqlJoinStatement** = `object`

Defined in: [plugins/sql-core/src/joins.ts:41](https://github.com/Agrejus/routier/blob/main/plugins/sql-core/src/joins.ts#L41)

## Properties

### sql

> **sql**: `string`

Defined in: [plugins/sql-core/src/joins.ts:42](https://github.com/Agrejus/routier/blob/main/plugins/sql-core/src/joins.ts#L42)

***

### params

> **params**: `unknown`[]

Defined in: [plugins/sql-core/src/joins.ts:43](https://github.com/Agrejus/routier/blob/main/plugins/sql-core/src/joins.ts#L43)

***

### columns

> **columns**: `ResultColumn`[]

Defined in: [plugins/sql-core/src/joins.ts:51](https://github.com/Agrejus/routier/blob/main/plugins/sql-core/src/joins.ts#L51)

The flat columns the projection emits, in order, aliased per side.

Returned rather than re-derived by the caller: a transfer plan that disagrees with the
select list files every column under another column's name, and the only way to make that
impossible is for one place to produce both.
