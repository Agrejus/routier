[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/sql-core/src](../README.md) / ListSource

# Type Alias: ListSource

> **ListSource** = `object`

Defined in: [plugins/sql-core/src/sql.ts:178](https://github.com/Agrejus/routier/blob/main/plugins/sql-core/src/sql.ts#L178)

Engines that accept ISO-8601 directly.

A `Date` still has to become one: a driver binds a string, and `s.date()` is stored as ISO, so a
filter comparing a Date param has to be bound in the same form the column holds.

## Properties

### sql

> **sql**: `string`

Defined in: [plugins/sql-core/src/sql.ts:178](https://github.com/Agrejus/routier/blob/main/plugins/sql-core/src/sql.ts#L178)

***

### params

> **params**: readonly `unknown`[]

Defined in: [plugins/sql-core/src/sql.ts:178](https://github.com/Agrejus/routier/blob/main/plugins/sql-core/src/sql.ts#L178)
