[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/sql-core/src](../README.md) / GroupedUpdateOperation

# Type Alias: GroupedUpdateOperation

> **GroupedUpdateOperation** = `object`

Defined in: [plugins/sql-core/src/updates.ts:152](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/sql-core/src/updates.ts#L152)

## Properties

### sql

> **sql**: `string`

Defined in: [plugins/sql-core/src/updates.ts:153](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/sql-core/src/updates.ts#L153)

***

### params

> **params**: `unknown`[]

Defined in: [plugins/sql-core/src/updates.ts:155](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/sql-core/src/updates.ts#L155)

Parameters for this statement alone, numbered from the dialect's first placeholder.

***

### ids

> **ids**: `unknown`[]

Defined in: [plugins/sql-core/src/updates.ts:159](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/sql-core/src/updates.ts#L159)

Id values of the rows this statement updates, in WHERE-clause order — for engines
without RETURNING, which must select the updated rows back by id. Only meaningful
for single-key schemas; composite-key callers must use [keyTuples](#keytuples).

***

### keyTuples

> **keyTuples**: [`KeyTuple`](KeyTuple.md)[]

Defined in: [plugins/sql-core/src/updates.ts:162](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/sql-core/src/updates.ts#L162)

Full identity of each updated row, in WHERE-clause order. Correct for both single
and composite keys, so select-back should prefer it over [ids](#ids).
