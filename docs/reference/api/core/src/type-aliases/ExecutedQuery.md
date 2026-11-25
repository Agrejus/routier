[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / ExecutedQuery

# Type Alias: ExecutedQuery

> **ExecutedQuery** = `object`

Defined in: [core/src/plugins/query/explain.ts:31](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/explain.ts#L31)

One thing a backend actually executed, in the backend's own language.

A plugin pushes these onto `DbPluginQueryEvent.executedQueries` as it runs them, so a join,
which reads twice, reports both in execution order. `text` is code in `language`, with each
value written as `?` and listed in `parameters`. Anything that is not code, such as "full scan,
no index", goes in `note`.

## Properties

### text

> **text**: `string`

Defined in: [core/src/plugins/query/explain.ts:32](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/explain.ts#L32)

***

### parameters?

> `optional` **parameters**: `unknown`[]

Defined in: [core/src/plugins/query/explain.ts:33](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/explain.ts#L33)

***

### language?

> `optional` **language**: `string`

Defined in: [core/src/plugins/query/explain.ts:35](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/explain.ts#L35)

What `text` is written in, as the plugin names it: `"sql"` or `"javascript"`, for example.

***

### note?

> `optional` **note**: `string`

Defined in: [core/src/plugins/query/explain.ts:36](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/explain.ts#L36)
