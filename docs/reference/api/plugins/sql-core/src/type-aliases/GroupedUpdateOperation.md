[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/sql-core/src](../README.md) / GroupedUpdateOperation

# Type Alias: GroupedUpdateOperation

> **GroupedUpdateOperation** = `object`

Defined in: [plugins/sql-core/src/updates.ts:158](https://github.com/Agrejus/routier/blob/main/plugins/sql-core/src/updates.ts#L158)

## Properties

### sql

> **sql**: `string`

Defined in: [plugins/sql-core/src/updates.ts:159](https://github.com/Agrejus/routier/blob/main/plugins/sql-core/src/updates.ts#L159)

***

### params

> **params**: `unknown`[]

Defined in: [plugins/sql-core/src/updates.ts:161](https://github.com/Agrejus/routier/blob/main/plugins/sql-core/src/updates.ts#L161)

Parameters for this statement alone, numbered from the dialect's first placeholder.

***

### ids

> **ids**: `unknown`[]

Defined in: [plugins/sql-core/src/updates.ts:165](https://github.com/Agrejus/routier/blob/main/plugins/sql-core/src/updates.ts#L165)

Id values of the rows this statement updates, in WHERE-clause order — for engines
without RETURNING, which must select the updated rows back by id. Only meaningful
for single-key schemas; composite-key callers must use [keyTuples](#keytuples).

***

### keyTuples

> **keyTuples**: [`KeyTuple`](KeyTuple.md)[]

Defined in: [plugins/sql-core/src/updates.ts:168](https://github.com/Agrejus/routier/blob/main/plugins/sql-core/src/updates.ts#L168)

Full identity of each updated row, in WHERE-clause order. Correct for both single
and composite keys, so select-back should prefer it over [ids](#ids).
