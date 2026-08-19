[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / withExecutedQueries

# Function: withExecutedQueries()

> **withExecutedQueries**(`explanation`, `executedQueries`): [`QueryExplanation`](../type-aliases/QueryExplanation.md)

Defined in: [core/src/plugins/query/explain.ts:286](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/plugins/query/explain.ts#L286)

Attaches what the backend reported to the step that was sent to it.

Reporting is optional for a plugin, so an empty report is not an error: the step is marked
`executedQueriesUnsupported` instead, and the rest of the explanation stands — the pushdown
analysis comes from the options and is correct with or without the plugin's statements.

Copies the steps rather than writing into them, so the explanation a caller already holds
does not gain statements after the fact. Options and their details are shared with the
original — nothing mutates them, and copying deeper would only look safer than it is.

## Parameters

### explanation

[`QueryExplanation`](../type-aliases/QueryExplanation.md)

### executedQueries

[`ExecutedQuery`](../type-aliases/ExecutedQuery.md)[]

## Returns

[`QueryExplanation`](../type-aliases/QueryExplanation.md)
