[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/postgresql/src](../README.md) / SqlOperation

# Type Alias: SqlOperation

> **SqlOperation** = `object`

Defined in: plugins/postgres-core/dist/types.d.ts:3

## Properties

### sql

> **sql**: `string`

Defined in: plugins/postgres-core/dist/types.d.ts:4

***

### params

> **params**: `any`[]

Defined in: plugins/postgres-core/dist/types.d.ts:5

***

### conflictCheck?

> `optional` **conflictCheck**: `object`

Defined in: plugins/postgres-core/dist/types.d.ts:7

Present on a token-checked UPDATE: zero affected rows means a concurrency conflict on this row.

#### id

> **id**: `unknown`

***

### result?

> `optional` **result**: readonly `ResultColumn`[]

Defined in: plugins/postgres-core/dist/types.d.ts:21

The columns this statement returns, in order, described beside the select list that emits
them — never parsed back out of the SQL.

A DESCRIPTION, not an instruction. What a driver does with it is the driver's business: the
PGlite worker driver turns it into a transfer plan and encodes rows columnar, and every
server-backed driver ignores it.

Absent when the result cannot be described — an aggregate replaces the select list, so the
columns projected are not the columns returned.
