[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/sql-core/src](../README.md) / splitJoinRows

# Function: splitJoinRows()

> **splitJoinRows**\<`TOuter`, `TInner`\>(`options`): `JoinTuple`[]

Defined in: [plugins/sql-core/src/joins.ts:160](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/sql-core/src/joins.ts#L160)

Cuts flat joined rows back into tuples, each half deserialized against its own schema.

The inner half of an unmatched `LEFT JOIN` row is `undefined`, and the test for that is the
inner KEY column being `NULL` — never "all its columns are null". A matched row whose other
columns happen to be null is a real row and must come back as an entity; the key cannot be
null on a row that matched, because a null key matches nothing.

## Type Parameters

### TOuter

`TOuter` *extends* `object`

### TInner

`TInner` *extends* `object`

## Parameters

### options

#### rows

readonly `UnknownRecord`[]

#### kind

`JoinKind`

#### join

\{ `kind`: `JoinKind`; `innerSchemaId`: `SchemaId`; `outerKey`: `JoinKeyReference`; `innerKey`: `JoinKeyReference`; `innerOptions`: `QueryOptionsCollection`\<`any`\>; `crossPlugin`: `boolean`; `semiJoinKeyThreshold`: `number`; \}

#### join.kind

`JoinKind`

#### join.innerSchemaId

`SchemaId`

Resolved through `event.schemas`, which already carries every schema in the store.

#### join.outerKey

`JoinKeyReference`

#### join.innerKey

`JoinKeyReference`

#### join.innerOptions

`QueryOptionsCollection`\<`any`\>

The inner side's own filters — INCLUDING its soft-delete scope and `.scope()`
filters. Every interpreter must apply these: it is the only place they exist, because
a join bypasses the inner collection's normal read path.

#### join.crossPlugin

`boolean`

Whether the two sides live on DIFFERENT plugin instances, in which case no plugin can
receive the option and the datastore is the interpreter.

Decided by plugin instance identity at build time, never by comparing database names —
two plugins over one database are still two interpreters, and one name can front two
databases.

#### join.semiJoinKeyThreshold

`number`

How many distinct outer keys are still worth turning into an `IN (...)` prefilter on the
inner read — the datastore's `semiJoinKeyThreshold`, default 500.

Carried in the option because the decision is made where the join executes, which is
usually inside a plugin, and a plugin cannot see a datastore's configuration. A number
serializes; a reference to the store would not.

Cost only. Above the threshold the inner side is read under its own scopes and the hash
join discards the surplus — the same answer by a slower route.

#### outerSchema

`CompiledSchema`\<`TOuter`\>

#### innerSchema

`CompiledSchema`\<`TInner`\>

## Returns

`JoinTuple`[]
