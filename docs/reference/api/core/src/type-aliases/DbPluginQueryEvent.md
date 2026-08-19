[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / DbPluginQueryEvent

# Type Alias: DbPluginQueryEvent\<TRoot, TShape\>

> **DbPluginQueryEvent**\<`TRoot`, `TShape`\> = [`DbPluginOperationEvent`](DbPluginOperationEvent.md)\<[`IQuery`](IQuery.md)\<`TRoot`, `TShape`\>\> & `object`

Defined in: [core/src/plugins/types.ts:56](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/plugins/types.ts#L56)

Event for a query operation, including schema, parent, and the query operation.

## Type Declaration

### explain

> **explain**: `boolean`

Whether the caller asked for an explanation. Required, never optional: a query is
either explained or it is not, and "unset" is not a third state.

A plugin is free to ignore it. One that reports unconditionally is correct; one that
checks the flag to skip building report strings is also correct. What a plugin must
NOT do is treat `true` as an instruction it has to obey — a plugin that cannot report
simply doesn't, and the datastore marks the step as not reported.

### executedQueries

> **executedQueries**: [`ExecutedQuery`](ExecutedQuery.md)[]

Where a plugin reports what it executed. Pushing to it is how a plugin supports
`.explain()` — a plugin that never pushes still answers queries, and its explanations
mark the database step as not reported (`executedQueriesUnsupported`) instead of
showing statements.

The datastore decides whether anyone sees it: with `explain` on it reads the array and
an empty one means "not supported"; with `explain` off it takes no action either way.

An array the DATASTORE creates and the plugin pushes into, rather than a value the plugin
returns. The result envelope is rebuilt in at least six places between a plugin and the
caller — the memory half re-translates, joins build fresh tuple values, the cache
reconstructs from stored entries — so anything carried on it is discarded before arrival.
The event is not rebuilt, and an array survives the shallow spread in `ConcurrencyDbPlugin`
because both sides then hold the same array. Assigning a new one would not.

Push once per query actually executed, in execution order, so a join reports both reads.
`text` is whatever the backend runs — SQL for a SQL engine, a description of the access
path for a store that has no statement. A plugin that answered without touching its
backend pushes a description of that instead — `CacheDbPlugin` pushes "cache hit" —
because pushing nothing reads as "this plugin does not report".

Push AFTER the query runs, not before. `RetryDbPlugin` re-invokes with the same event, so
a plugin that pushes first reports an entry per failed attempt.

The array accumulates for as long as the event lives. That is why `.explain()` is not
offered on a subscribed queryable: `subscribeQuery` builds its event once and re-issues it
on every change notification, which would grow this without bound.

## Type Parameters

### TRoot

`TRoot` *extends* `object`

### TShape

`TShape`
