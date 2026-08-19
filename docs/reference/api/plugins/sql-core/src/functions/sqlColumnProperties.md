[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/sql-core/src](../README.md) / sqlColumnProperties

# Function: sqlColumnProperties()

> **sqlColumnProperties**\<`T`\>(`schema`): `PropertyInfo`\<`T`\>[]

Defined in: [plugins/sql-core/src/columns.ts:39](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/sql-core/src/columns.ts#L39)

Root properties only — nested children are reached through their parent's value.

Exported because the whole table layout depends on it. `schema.properties` is flat: it
lists `nested`, `nested.inner`, and `nested.inner.value` side by side, and
`getResolvedName()` returns the LEAF name (`from ?? name`). So building columns from every
property gives a table with bogus `inner` and `value` columns that collide the moment two
nested objects share a child name — and no way to bind a value to them, because the entity
has no top-level `value` key.

A nested subtree is one JSON column, named for its root. That is the only layout that
round-trips.

## Type Parameters

### T

`T` *extends* `object`

## Parameters

### schema

`CompiledSchema`\<`T`\>

## Returns

`PropertyInfo`\<`T`\>[]
