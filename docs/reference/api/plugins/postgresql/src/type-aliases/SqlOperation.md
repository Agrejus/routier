[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/postgresql/src](../README.md) / SqlOperation

# Type Alias: SqlOperation

> **SqlOperation** = `object`

Defined in: [plugins/postgresql/src/types.ts:3](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/postgresql/src/types.ts#L3)

## Properties

### sql

> **sql**: `string`

Defined in: [plugins/postgresql/src/types.ts:4](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/postgresql/src/types.ts#L4)

***

### params

> **params**: `any`[]

Defined in: [plugins/postgresql/src/types.ts:5](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/postgresql/src/types.ts#L5)

***

### conflictCheck?

> `optional` **conflictCheck**: `object`

Defined in: [plugins/postgresql/src/types.ts:7](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/postgresql/src/types.ts#L7)

Present on a token-checked UPDATE: zero affected rows means a concurrency conflict on this row.

#### id

> **id**: `unknown`
