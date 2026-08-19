[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/postgresql/src](../README.md) / SqlOperation

# Type Alias: SqlOperation

> **SqlOperation** = `object`

Defined in: [plugins/postgresql/src/types.ts:3](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/postgresql/src/types.ts#L3)

## Properties

### sql

> **sql**: `string`

Defined in: [plugins/postgresql/src/types.ts:4](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/postgresql/src/types.ts#L4)

***

### params

> **params**: `any`[]

Defined in: [plugins/postgresql/src/types.ts:5](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/postgresql/src/types.ts#L5)

***

### conflictCheck?

> `optional` **conflictCheck**: `object`

Defined in: [plugins/postgresql/src/types.ts:7](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/postgresql/src/types.ts#L7)

Present on a token-checked UPDATE: zero affected rows means a concurrency conflict on this row.

#### id

> **id**: `unknown`
