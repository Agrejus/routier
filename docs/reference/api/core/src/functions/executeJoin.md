[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / executeJoin

# Function: executeJoin()

> **executeJoin**(`options`): [`JoinTuple`](../type-aliases/JoinTuple.md)[]

Defined in: [core/src/plugins/query/join.ts:510](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/plugins/query/join.ts#L510)

A join over rows both sides have already deserialized, with the inner side's scopes applied.

The one entry point every interpreter uses: `JsonTranslator.join` inside a plugin, and the
datastore's own memory half for a cross-plugin join. Callers hand over ENTITY-shape rows —
`toEntityShape` is separate because a caller may already have paid for it.

## Parameters

### options

#### option

\{ `kind`: [`JoinKind`](../type-aliases/JoinKind.md); `innerSchemaId`: [`SchemaId`](../type-aliases/SchemaId.md); `outerKey`: [`JoinKeyReference`](../type-aliases/JoinKeyReference.md); `innerKey`: [`JoinKeyReference`](../type-aliases/JoinKeyReference.md); `innerOptions`: [`QueryOptionsCollection`](../classes/QueryOptionsCollection.md)\<`any`\>; `crossPlugin`: `boolean`; `semiJoinKeyThreshold`: `number`; \}

#### option.kind

[`JoinKind`](../type-aliases/JoinKind.md)

#### option.innerSchemaId

[`SchemaId`](../type-aliases/SchemaId.md)

Resolved through `event.schemas`, which already carries every schema in the store.

#### option.outerKey

[`JoinKeyReference`](../type-aliases/JoinKeyReference.md)

#### option.innerKey

[`JoinKeyReference`](../type-aliases/JoinKeyReference.md)

#### option.innerOptions

[`QueryOptionsCollection`](../classes/QueryOptionsCollection.md)\<`any`\>

The inner side's own filters — INCLUDING its soft-delete scope and `.scope()`
filters. Every interpreter must apply these: it is the only place they exist, because
a join bypasses the inner collection's normal read path.

#### option.crossPlugin

`boolean`

Whether the two sides live on DIFFERENT plugin instances, in which case no plugin can
receive the option and the datastore is the interpreter.

Decided by plugin instance identity at build time, never by comparing database names —
two plugins over one database are still two interpreters, and one name can front two
databases.

#### option.semiJoinKeyThreshold

`number`

How many distinct outer keys are still worth turning into an `IN (...)` prefilter on the
inner read — the datastore's `semiJoinKeyThreshold`, default 500.

Carried in the option because the decision is made where the join executes, which is
usually inside a plugin, and a plugin cannot see a datastore's configuration. A number
serializes; a reference to the store would not.

Cost only. Above the threshold the inner side is read under its own scopes and the hash
join discards the surplus — the same answer by a slower route.

#### outerRows

[`UnknownRecord`](../type-aliases/UnknownRecord.md)[]

#### innerRows

[`UnknownRecord`](../type-aliases/UnknownRecord.md)[]

## Returns

[`JoinTuple`](../type-aliases/JoinTuple.md)[]
