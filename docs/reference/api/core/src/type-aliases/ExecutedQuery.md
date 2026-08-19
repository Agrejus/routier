[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / ExecutedQuery

# Type Alias: ExecutedQuery

> **ExecutedQuery** = `object`

Defined in: [core/src/plugins/query/explain.ts:28](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/plugins/query/explain.ts#L28)

One thing a backend actually executed, in the backend's own language.

A plugin pushes these onto `DbPluginQueryEvent.executedQueries` as it runs them, so a join —
which reads twice — reports both, in execution order. `text` is not required to be SQL: a
key-value store describes what it did in whatever terms it has.

## Properties

### text

> **text**: `string`

Defined in: [core/src/plugins/query/explain.ts:29](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/plugins/query/explain.ts#L29)

***

### parameters?

> `optional` **parameters**: `unknown`[]

Defined in: [core/src/plugins/query/explain.ts:30](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/plugins/query/explain.ts#L30)
