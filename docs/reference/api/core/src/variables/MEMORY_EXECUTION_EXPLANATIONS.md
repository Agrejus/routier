[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / MEMORY\_EXECUTION\_EXPLANATIONS

# Variable: MEMORY\_EXECUTION\_EXPLANATIONS

> `const` **MEMORY\_EXECUTION\_EXPLANATIONS**: `Record`\<[`MemoryExecutionReason`](../type-aliases/MemoryExecutionReason.md), `string`\>

Defined in: [core/src/plugins/query/explain.ts:11](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/explain.ts#L11)

One sentence per reason code, written for someone meeting pushdown for the first time.

Beside the codes rather than in the formatter, so console output, a failing test and the
docs all say the same thing.
