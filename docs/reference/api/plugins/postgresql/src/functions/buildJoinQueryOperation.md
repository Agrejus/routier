[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/postgresql/src](../README.md) / buildJoinQueryOperation

# Function: buildJoinQueryOperation()

> **buildJoinQueryOperation**\<`TEntity`, `TShape`, `TInner`\>(`query`, `innerSchema`, `vectors?`): [`SqlOperation`](../type-aliases/SqlOperation.md) & `object`

Defined in: plugins/postgres-core/dist/utils.d.ts:95

Builds the joined SELECT for a query carrying a `join` option.

The emission itself is shared (`buildJoinStatement`); this supplies the two things only the
plugin knows — the inner schema, which lives in the event's schema collection, and the outer
side's own statement.

The outer side is built by the ordinary single-table path and used as a derived table, because
PostgreSQL applies `ORDER BY` and `LIMIT` to the JOINED rows: a `.take(2)` recorded before the
join has to window the outer rows, not the pairs, or it answers a different question from every
other backend. Its parameters are bound first, and the inner side's scope placeholders continue
the `$n` numbering from there.

## Type Parameters

### TEntity

`TEntity` *extends* `object`

### TShape

`TShape`

### TInner

`TInner` *extends* `object`

## Parameters

### query

`IQuery`\<`TEntity`, `TShape`\>

### innerSchema

`CompiledSchema`\<`TInner`\>

### vectors?

[`PostgresVectorSupport`](../type-aliases/PostgresVectorSupport.md)

## Returns

[`SqlOperation`](../type-aliases/SqlOperation.md) & `object`
