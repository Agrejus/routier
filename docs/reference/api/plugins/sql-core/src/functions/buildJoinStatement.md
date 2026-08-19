[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/sql-core/src](../README.md) / buildJoinStatement

# Function: buildJoinStatement()

> **buildJoinStatement**\<`TOuter`, `TInner`\>(`options`): [`SqlJoinStatement`](../type-aliases/SqlJoinStatement.md)

Defined in: [plugins/sql-core/src/joins.ts:53](https://github.com/Agrejus/routier/blob/main/plugins/sql-core/src/joins.ts#L53)

Builds the whole joined SELECT around an already-built outer statement.

## Type Parameters

### TOuter

`TOuter` *extends* `object`

### TInner

`TInner` *extends* `object`

## Parameters

### options

#### dialect

[`SqlDialect`](../interfaces/SqlDialect.md)

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

#### outer

`string`

#### outerParams

readonly `unknown`[]

#### keyCast?

\{ `outer?`: `string`; `inner?`: `string`; \}

A SQL type to cast a key column to before comparing, per side.

Needed when the two key columns have different SQL types even though the schema declares
the same one. PostgreSQL is the case: a single string identity key is a `uuid` column while
a plain string foreign key is `text`, and it refuses `uuid = text` outright. A typeless
engine like SQLite never needs this.

Which side to cast is not a free choice. Casting the TEXT side to `uuid` would preserve the
primary key index, but it throws for the whole query the moment one row holds a value that
is not a uuid — and a foreign key pointing at a row that no longer exists is exactly the
case a `leftJoin` is for. Casting the uuid side to text always succeeds.

#### keyCast.outer?

`string`

#### keyCast.inner?

`string`

## Returns

[`SqlJoinStatement`](../type-aliases/SqlJoinStatement.md)
