[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / ExecutionStep

# Type Alias: ExecutionStep

> **ExecutionStep** = \{ `step`: `number`; `of`: `number`; `executedIn`: `Extract`\<[`ExecutedIn`](ExecutedIn.md), \{ `kind`: `"database"`; \}\>; `options`: [`ExplainedOption`](ExplainedOption.md)[]; `executedQueries`: [`ExecutedQuery`](ExecutedQuery.md)[]; `executedQueriesUnsupported?`: `string`; \} \| \{ `step`: `number`; `of`: `number`; `executedIn`: `Extract`\<[`ExecutedIn`](ExecutedIn.md), \{ `kind`: `"memory"`; \}\>; `options`: [`ExplainedOption`](ExplainedOption.md)[]; `reason?`: [`StepReason`](StepReason.md); `explanation?`: `string`; \}

Defined in: [core/src/plugins/query/explain.ts:73](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/explain.ts#L73)

One run of options in one place.

A union, so a memory step cannot carry statements it could not have run and a database step cannot
carry a reason for not being in the database.

## Type Declaration

\{ `step`: `number`; `of`: `number`; `executedIn`: `Extract`\<[`ExecutedIn`](ExecutedIn.md), \{ `kind`: `"database"`; \}\>; `options`: [`ExplainedOption`](ExplainedOption.md)[]; `executedQueries`: [`ExecutedQuery`](ExecutedQuery.md)[]; `executedQueriesUnsupported?`: `string`; \}

### step

> **step**: `number`

### of

> **of**: `number`

### executedIn

> **executedIn**: `Extract`\<[`ExecutedIn`](ExecutedIn.md), \{ `kind`: `"database"`; \}\>

### options

> **options**: [`ExplainedOption`](ExplainedOption.md)[]

### executedQueries

> **executedQueries**: [`ExecutedQuery`](ExecutedQuery.md)[]

What the plugin reported running. Empty when it reported nothing.

### executedQueriesUnsupported?

> `optional` **executedQueriesUnsupported**: `string`

Set instead, when this plugin does not report what it executed.

\{ `step`: `number`; `of`: `number`; `executedIn`: `Extract`\<[`ExecutedIn`](ExecutedIn.md), \{ `kind`: `"memory"`; \}\>; `options`: [`ExplainedOption`](ExplainedOption.md)[]; `reason?`: [`StepReason`](StepReason.md); `explanation?`: `string`; \}

### step

> **step**: `number`

### of

> **of**: `number`

### executedIn

> **executedIn**: `Extract`\<[`ExecutedIn`](ExecutedIn.md), \{ `kind`: `"memory"`; \}\>

### options

> **options**: [`ExplainedOption`](ExplainedOption.md)[]

### reason?

> `optional` **reason**: [`StepReason`](StepReason.md)

### explanation?

> `optional` **explanation**: `string`
