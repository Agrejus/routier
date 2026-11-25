[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / QueryExplanationSummary

# Type Alias: QueryExplanationSummary

> **QueryExplanationSummary** = `object`

Defined in: [core/src/plugins/query/explain.ts:107](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/explain.ts#L107)

## Properties

### database

> **database**: `number`

Defined in: [core/src/plugins/query/explain.ts:108](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/explain.ts#L108)

***

### memory

> **memory**: `number`

Defined in: [core/src/plugins/query/explain.ts:109](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/explain.ts#L109)

***

### reasons

> **reasons**: [`StepReason`](StepReason.md)[]

Defined in: [core/src/plugins/query/explain.ts:111](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/explain.ts#L111)

Deduped, in first-seen order. Empty when the whole query pushed down.

***

### explanation

> **explanation**: `string`

Defined in: [core/src/plugins/query/explain.ts:112](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/explain.ts#L112)
