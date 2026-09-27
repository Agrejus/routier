[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/sql-core/src](../README.md) / canPushDownJoin

# Function: canPushDownJoin()

> **canPushDownJoin**(`join`, `dialect?`, `divergentCalls?`): `boolean`

Defined in: [plugins/sql-core/src/joins.ts:175](https://github.com/Agrejus/routier/blob/main/plugins/sql-core/src/joins.ts#L175)

Whether every filter of the inner side can be expressed in SQL, by this dialect.

A plugin must ask this BEFORE claiming a join was pushed down. Two ways the answer is no:

 - core marked an inner filter memory-only — an unmapped property — so there is no column to
   compare and the statement would silently return rows the scope excludes. A renamed property is
   not one: it renders its storage column, qualified by the inner alias, like any other;
 - the filter holds a call this ENGINE cannot render. The main read path asks `canRenderInSql`
   before translating, and without the same question here a join was the one way to reach a
   renderer for a call the dialect does not claim.

`dialect` is optional so an existing caller keeps its meaning; passing it is what closes the
second hole.

## Parameters

### join

#### kind

`JoinKind`

#### innerSchemaId

`SchemaId`

Resolved through `event.schemas`, which already carries every schema in the store.

#### outerKey

`JoinKeyReference`

#### innerKey

`JoinKeyReference`

#### innerOptions

`QueryOptionsCollection`\<`any`\>

The inner side's own filters — INCLUDING its soft-delete scope and `.scope()`
filters. Every interpreter must apply these: it is the only place they exist, because
a join bypasses the inner collection's normal read path.

#### crossPlugin

`boolean`

Whether the two sides live on DIFFERENT plugin instances, in which case no plugin can
receive the option and the datastore is the interpreter.

Decided by plugin instance identity at build time, never by comparing database names —
two plugins over one database are still two interpreters, and one name can front two
databases.

#### semiJoinKeyThreshold

`number`

How many distinct outer keys are still worth turning into an `IN (...)` prefilter on the
inner read — the datastore's `semiJoinKeyThreshold`, default 500.

Carried in the option because the decision is made where the join executes, which is
usually inside a plugin, and a plugin cannot see a datastore's configuration. A number
serializes; a reference to the store would not.

Cost only. Above the threshold the inner side is read under its own scopes and the hash
join discards the surplus — the same answer by a slower route.

### dialect?

[`SqlDialectName`](../type-aliases/SqlDialectName.md) | [`SqlDialect`](../interfaces/SqlDialect.md)

### divergentCalls?

readonly `Call`[] = `[]`

## Returns

`boolean`
