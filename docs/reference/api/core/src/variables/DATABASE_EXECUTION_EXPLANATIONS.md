[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / DATABASE\_EXECUTION\_EXPLANATIONS

# Variable: DATABASE\_EXECUTION\_EXPLANATIONS

> `const` **DATABASE\_EXECUTION\_EXPLANATIONS**: `Record`\<`Exclude`\<[`DatabaseExecutionReason`](../type-aliases/DatabaseExecutionReason.md), `"executed"`\>, `string`\>

Defined in: [core/src/plugins/query/explain.ts:47](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/explain.ts#L47)

Why an option planned for the database did not run there. `executed` has no sentence: it needs no
explaining, and a step made of executed options is a database step like any other.
