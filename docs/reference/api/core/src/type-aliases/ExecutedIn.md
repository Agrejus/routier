[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / ExecutedIn

# Type Alias: ExecutedIn

> **ExecutedIn** = \{ `kind`: `"database"`; `database`: `string`; `plugin`: `string`; \} \| \{ `kind`: `"memory"`; \}

Defined in: [core/src/plugins/query/explain.ts:60](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/explain.ts#L60)

Where a step ran.

A database step names WHICH database, because a cross-plugin join reads from more than one — and a
name alone does not say whether the second was PostgreSQL or PouchDB, which is the difference
between a statement a reader recognises and one they cannot place.
