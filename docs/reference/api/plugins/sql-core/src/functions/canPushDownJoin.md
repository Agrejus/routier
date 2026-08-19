[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/sql-core/src](../README.md) / canPushDownJoin

# Function: canPushDownJoin()

> **canPushDownJoin**(`join`): `boolean`

Defined in: [plugins/sql-core/src/joins.ts:149](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/sql-core/src/joins.ts#L149)

Whether every filter of the inner side can be expressed in SQL.

A plugin must ask this BEFORE claiming a join was pushed down. An inner filter that core
marked memory-only — an unmapped or a renamed property — has no column to compare, so the
emitted statement would silently return rows the scope excludes. Answering `false` sends the
join back to an interpretation that can apply it.

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

## Returns

`boolean`
