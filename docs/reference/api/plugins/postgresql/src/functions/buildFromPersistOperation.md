[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/postgresql/src](../README.md) / buildFromPersistOperation

# Function: buildFromPersistOperation()

> **buildFromPersistOperation**\<`TEntity`\>(`schema`, `changes`): `object`

Defined in: plugins/postgres-core/dist/utils.d.ts:48

## Type Parameters

### TEntity

`TEntity` *extends* `object`

## Parameters

### schema

`CompiledSchema`\<`TEntity`\>

### changes

`SchemaPersistChanges`\<`Record`\<`string`, `unknown`\>\>

## Returns

`object`

### adds

> **adds**: [`SqlOperation`](../type-aliases/SqlOperation.md)

### updates

> **updates**: [`SqlOperation`](../type-aliases/SqlOperation.md)[]

### removes

> **removes**: [`SqlOperation`](../type-aliases/SqlOperation.md)
