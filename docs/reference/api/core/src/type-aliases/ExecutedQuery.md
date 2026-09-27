[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / ExecutedQuery

# Type Alias: ExecutedQuery

> **ExecutedQuery** = `object`

Defined in: [core/src/plugins/query/explain.ts:29](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/explain.ts#L29)

One thing a backend actually executed, in the backend's own language.

A plugin pushes these onto `DbPluginQueryEvent.executedQueries` as it runs them, so a join —
which reads twice — reports both, in execution order. `text` is not required to be SQL: a
key-value store describes what it did in whatever terms it has.

## Properties

### text

> **text**: `string`

Defined in: [core/src/plugins/query/explain.ts:30](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/explain.ts#L30)

***

### parameters?

> `optional` **parameters**: `unknown`[]

Defined in: [core/src/plugins/query/explain.ts:31](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/explain.ts#L31)
