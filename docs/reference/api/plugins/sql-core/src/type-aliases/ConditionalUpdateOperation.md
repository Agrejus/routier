[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/sql-core/src](../README.md) / ConditionalUpdateOperation

# Type Alias: ConditionalUpdateOperation

> **ConditionalUpdateOperation** = `object`

Defined in: [plugins/sql-core/src/updates.ts:84](https://github.com/Agrejus/routier/blob/main/plugins/sql-core/src/updates.ts#L84)

One conditional UPDATE per row, for schemas with a `.concurrency()` token.

Token-checked rows cannot ride the grouped CASE statement: each row's WHERE carries its
own `AND token = expected`, and the caller must be able to tell WHICH row a zero-row
result belongs to. `id` identifies the row so an empty result (or RETURNING set) can be
reported as a conflict on that row. Rows without a token (they predate it — the write
initializes it) get the same per-row statement without the token clause.

## Properties

### sql

> **sql**: `string`

Defined in: [plugins/sql-core/src/updates.ts:85](https://github.com/Agrejus/routier/blob/main/plugins/sql-core/src/updates.ts#L85)

***

### params

> **params**: `unknown`[]

Defined in: [plugins/sql-core/src/updates.ts:86](https://github.com/Agrejus/routier/blob/main/plugins/sql-core/src/updates.ts#L86)

***

### id

> **id**: `unknown`

Defined in: [plugins/sql-core/src/updates.ts:88](https://github.com/Agrejus/routier/blob/main/plugins/sql-core/src/updates.ts#L88)

How a conflict on this row is reported — see conflictIdOf.

***

### keyTuple

> **keyTuple**: [`KeyTuple`](KeyTuple.md)

Defined in: [plugins/sql-core/src/updates.ts:90](https://github.com/Agrejus/routier/blob/main/plugins/sql-core/src/updates.ts#L90)

The row's full identity, for callers that need to re-select it.

***

### checked

> **checked**: `boolean`

Defined in: [plugins/sql-core/src/updates.ts:92](https://github.com/Agrejus/routier/blob/main/plugins/sql-core/src/updates.ts#L92)

True when the statement carries a token check — a zero-row result is a CONFLICT.
