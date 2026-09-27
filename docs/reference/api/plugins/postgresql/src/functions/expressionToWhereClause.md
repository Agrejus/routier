[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/postgresql/src](../README.md) / expressionToWhereClause

# ~~Function: expressionToWhereClause()~~

> **expressionToWhereClause**(`expr`): `object`

Defined in: plugins/postgres-core/dist/utils.d.ts:34

Translates an Expression tree to a SQL WHERE clause and parameters.

## Parameters

### expr

`Expression`

## Returns

`object`

### ~~where~~

> **where**: `string`

### ~~params~~

> **params**: `any`[]

## Deprecated

Use `toSql(expr, 'postgresql')` from `@routier/sql-plugin-core` for dialect-agnostic SQL.
