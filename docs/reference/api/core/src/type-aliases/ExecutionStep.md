[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / ExecutionStep

# Type Alias: ExecutionStep

> **ExecutionStep** = `object`

Defined in: [core/src/plugins/query/explain.ts:42](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/explain.ts#L42)

## Properties

### step

> **step**: `number`

Defined in: [core/src/plugins/query/explain.ts:43](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/explain.ts#L43)

***

### of

> **of**: `number`

Defined in: [core/src/plugins/query/explain.ts:44](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/explain.ts#L44)

***

### executedIn

> **executedIn**: [`QueryOptionExecutionTarget`](QueryOptionExecutionTarget.md)

Defined in: [core/src/plugins/query/explain.ts:45](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/explain.ts#L45)

***

### description

> **description**: `string`

Defined in: [core/src/plugins/query/explain.ts:46](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/explain.ts#L46)

***

### options

> **options**: [`ExplainedOption`](ExplainedOption.md)[]

Defined in: [core/src/plugins/query/explain.ts:47](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/explain.ts#L47)

***

### executedQueries?

> `optional` **executedQueries**: [`ExecutedQuery`](ExecutedQuery.md)[]

Defined in: [core/src/plugins/query/explain.ts:49](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/explain.ts#L49)

Set on database steps once the plugin has reported.

***

### executedQueriesUnsupported?

> `optional` **executedQueriesUnsupported**: `string`

Defined in: [core/src/plugins/query/explain.ts:51](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/explain.ts#L51)

Set on the first database step instead, when the plugin reported nothing.

***

### reason?

> `optional` **reason**: [`MemoryExecutionReason`](MemoryExecutionReason.md)

Defined in: [core/src/plugins/query/explain.ts:53](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/explain.ts#L53)

Set on memory steps only.

***

### explanation?

> `optional` **explanation**: `string`

Defined in: [core/src/plugins/query/explain.ts:54](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/explain.ts#L54)
