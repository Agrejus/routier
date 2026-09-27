[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/sql-core/src](../README.md) / entityResultColumns

# Function: entityResultColumns()

> **entityResultColumns**\<`T`\>(`schema`): `ResultColumn`[]

Defined in: [plugins/sql-core/src/resultShape.ts:21](https://github.com/Agrejus/routier/blob/main/plugins/sql-core/src/resultShape.ts#L21)

The columns an ordinary entity SELECT projects: root properties, under their storage names.

Root properties ONLY, and that is the SQL-specific part. `schema.properties` lists `nested`,
`nested.inner` and `nested.inner.value` side by side, and a flat table stores that whole subtree
in ONE column named for its root — so listing every property names columns that do not exist.
A store that nests natively has no such rule, which is why this cannot live in core.

## Type Parameters

### T

`T` *extends* `object`

## Parameters

### schema

`CompiledSchema`\<`T`\>

## Returns

`ResultColumn`[]
