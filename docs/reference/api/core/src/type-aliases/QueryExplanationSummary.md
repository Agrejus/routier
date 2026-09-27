[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / QueryExplanationSummary

# Type Alias: QueryExplanationSummary

> **QueryExplanationSummary** = `object`

Defined in: [core/src/plugins/query/explain.ts:102](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/explain.ts#L102)

## Properties

### database

> **database**: `number`

Defined in: [core/src/plugins/query/explain.ts:103](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/explain.ts#L103)

***

### memory

> **memory**: `number`

Defined in: [core/src/plugins/query/explain.ts:104](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/explain.ts#L104)

***

### reasons

> **reasons**: [`StepReason`](StepReason.md)[]

Defined in: [core/src/plugins/query/explain.ts:106](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/explain.ts#L106)

Deduped, in first-seen order. Empty when the whole query pushed down.

***

### explanation

> **explanation**: `string`

Defined in: [core/src/plugins/query/explain.ts:107](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/explain.ts#L107)
