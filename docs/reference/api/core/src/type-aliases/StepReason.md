[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / StepReason

# Type Alias: StepReason

> **StepReason** = [`MemoryExecutionReason`](MemoryExecutionReason.md) \| `Exclude`\<[`DatabaseExecutionReason`](DatabaseExecutionReason.md), `"executed"`\>

Defined in: [core/src/plugins/query/explain.ts:65](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/explain.ts#L65)

Why a step is not in the database. `executed` never appears: those steps ARE in the database.
