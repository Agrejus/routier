[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / loadJoinInnerSide

# Function: loadJoinInnerSide()

> **loadJoinInnerSide**\<`TRoot`, `TShape`\>(`event`, `query`, `done`, `outerKeys?`): `void`

Defined in: [core/src/plugins/query/join.ts:339](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/plugins/query/join.ts#L339)

Loads a join's inner side by asking the plugin to run an ORDINARY query for it.

The generic way for a plugin to interpret a join — one call, no join-specific reading code.
The inner side is just "this collection, under these filters", which is a query every plugin
already knows how to answer, through whatever indexes and scoping it normally applies.

Only the DATABASE half of `innerOptions` is sent. The memory half would mean nothing to the
plugin, and `executeJoin` re-applies every filter regardless — filters are pure, so the second
pass costs a walk over the survivors and guarantees the inner scopes are honoured even if the
plugin silently ignored them.

The inner query carries no `join` option of its own, so this cannot recurse.

## Type Parameters

### TRoot

`TRoot` *extends* `object`

### TShape

`TShape`

## Parameters

### event

[`DbPluginQueryEvent`](../type-aliases/DbPluginQueryEvent.md)\<`TRoot`, `TShape`\>

### query

(`innerEvent`, `done`) => `void`

How this plugin runs a query. **Not necessarily `plugin.query`**: a plugin that
serializes queries through a work queue must pass its UN-QUEUED path, or this call waits behind
the outer query that is still holding the queue and the plugin deadlocks.

### done

(`result`) => `void`

### outerKeys?

`ReadonlySet`\<`unknown`\>

The outer side's distinct keys, when the caller already has them.

Only a plugin that runs its outer query FIRST can supply these, and most run this loader
before anything else — so it is optional, and its absence costs a wider inner read rather
than a wrong one.

## Returns

`void`
