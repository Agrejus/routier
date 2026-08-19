[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / QueryExplanationSummary

# Type Alias: QueryExplanationSummary

> **QueryExplanationSummary** = `object`

Defined in: [core/src/plugins/query/explain.ts:57](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/explain.ts#L57)

## Properties

### database

> **database**: `number`

Defined in: [core/src/plugins/query/explain.ts:58](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/explain.ts#L58)

***

### memory

> **memory**: `number`

Defined in: [core/src/plugins/query/explain.ts:59](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/explain.ts#L59)

***

### reasons

> **reasons**: [`MemoryExecutionReason`](MemoryExecutionReason.md)[]

Defined in: [core/src/plugins/query/explain.ts:61](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/explain.ts#L61)

Deduped, in first-seen order. Empty when the whole query pushed down.

***

### explanation

> **explanation**: `string`

Defined in: [core/src/plugins/query/explain.ts:62](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/explain.ts#L62)
