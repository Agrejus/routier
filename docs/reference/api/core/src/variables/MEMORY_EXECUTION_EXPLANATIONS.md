[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / MEMORY\_EXECUTION\_EXPLANATIONS

# Variable: MEMORY\_EXECUTION\_EXPLANATIONS

> `const` **MEMORY\_EXECUTION\_EXPLANATIONS**: `Record`\<[`MemoryExecutionReason`](../type-aliases/MemoryExecutionReason.md), `string`\>

Defined in: [core/src/plugins/query/explain.ts:11](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/plugins/query/explain.ts#L11)

One sentence per reason code, written for someone meeting pushdown for the first time.

Beside the codes rather than in the formatter, so console output, a failing test and the
docs all say the same thing.
