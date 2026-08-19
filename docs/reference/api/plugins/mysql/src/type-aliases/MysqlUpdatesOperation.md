[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/mysql/src](../README.md) / MysqlUpdatesOperation

# Type Alias: MysqlUpdatesOperation

> **MysqlUpdatesOperation** = [`SqlOperation`](SqlOperation.md) & `object`

Defined in: [plugins/mysql/src/types.ts:26](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/mysql/src/types.ts#L26)

MySQL has no RETURNING, so the updated rows are selected back afterwards. `keyTuples`
carries each row's FULL identity — selecting back on one component of a composite key
echoes the wrong rows.

## Type Declaration

### ids

> **ids**: `unknown`[]

### keyTuples

> **keyTuples**: `Record`\<`string`, `unknown`\>[]

### conflictCheck?

> `optional` **conflictCheck**: `object`

Present on a token-checked UPDATE. MySQL has no RETURNING, so a conflict shows up as
`affectedRows === 0` rather than an empty result set — the statement is valid and
succeeds, it simply matches no row because the token moved.

#### conflictCheck.id

> **id**: `unknown`
