[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/sql-core/src](../README.md) / casingWarning

# Function: casingWarning()

> **casingWarning**(`engine`): `string`

Defined in: [plugins/sql-core/src/capability.ts:118](https://github.com/Agrejus/routier/blob/main/plugins/sql-core/src/capability.ts#L118)

SQLite's `lower()` folds ASCII only, so `lower('É')` is `'É'` where JavaScript gives `'é'`.

## Parameters

### engine

`string`

## Returns

`string`
