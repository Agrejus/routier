[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / MemoryExecutionReason

# Type Alias: MemoryExecutionReason

> **MemoryExecutionReason** = `"not-parsable"` \| `"unmapped-property"` \| `"renamed-property"` \| `"map-rename"` \| `"after-nearest"` \| `"after-join"` \| `"cross-plugin-join"`

Defined in: [core/src/plugins/query/types.ts:34](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/types.ts#L34)

Why an option runs in memory rather than in the database.

A code rather than a sentence, so a test can assert on it — the sentences live in
`MEMORY_EXECUTION_EXPLANATIONS`. Every cause is a ratchet, because `nextExecutionTarget`
never returns to `"database"`, so the code recorded is the FIRST cause and it stays on every
option after it. Reporting a later one would name a symptom of this one.
