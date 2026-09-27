[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / isDatabaseStep

# Function: isDatabaseStep()

> **isDatabaseStep**(`step`): `step is { step: number; of: number; executedIn: { kind: "database"; database: string; plugin: string }; options: ExplainedOption[]; executedQueries: ExecutedQuery[]; executedQueriesUnsupported?: string }`

Defined in: [core/src/plugins/query/explain.ts:100](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/explain.ts#L100)

TypeScript does not narrow a union from a discriminant nested inside a property, so the two kinds
of step need a guard rather than an inline check.

## Parameters

### step

[`ExecutionStep`](../type-aliases/ExecutionStep.md)

## Returns

`step is { step: number; of: number; executedIn: { kind: "database"; database: string; plugin: string }; options: ExplainedOption[]; executedQueries: ExecutedQuery[]; executedQueriesUnsupported?: string }`
