[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/postgresql/src](../README.md) / buildSelectFromExpression

# Function: buildSelectFromExpression()

> **buildSelectFromExpression**\<`TEntity`, `TShape`\>(`options`): `object`

Defined in: plugins/postgres-core/dist/utils.d.ts:41

Builds a SELECT statement from a table, an Expression, and optional columns.

## Type Parameters

### TEntity

`TEntity` *extends* `object`

### TShape

`TShape`

## Parameters

### options

#### query

`IQuery`\<`TEntity`, `TShape`\>

#### schema

`CompiledSchema`\<`TEntity`\>

## Returns

`object`

### sql

> **sql**: `string`

### params

> **params**: `any`[]
