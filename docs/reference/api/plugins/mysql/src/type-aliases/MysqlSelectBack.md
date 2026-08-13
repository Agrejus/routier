[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/mysql/src](../README.md) / MysqlSelectBack

# Type Alias: MysqlSelectBack

> **MysqlSelectBack** = \{ `mode`: `"insert-id"`; `rowCount`: `number`; \} \| \{ `mode`: `"by-key"`; `ids`: `unknown`[]; \} \| \{ `mode`: `"by-composite-key"`; `keyTuples`: `Record`\<`string`, `unknown`\>[]; \}

Defined in: [plugins/mysql/src/types.ts:10](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/mysql/src/types.ts#L10)

MySQL has no RETURNING, and `mergeChanges` requires the entire inserted document back —
so every write operation carries how its rows can be read back after it runs.

## Type Declaration

\{ `mode`: `"insert-id"`; `rowCount`: `number`; \}

### mode

> **mode**: `"insert-id"`

### rowCount

> **rowCount**: `number`

Single numeric AUTO_INCREMENT key: a simple multi-row INSERT allocates a consecutive
id block, so the rows are `insertId .. insertId + rowCount - 1`.

\{ `mode`: `"by-key"`; `ids`: `unknown`[]; \}

### mode

> **mode**: `"by-key"`

### ids

> **ids**: `unknown`[]

Every key value is known client-side (caller-supplied keys, or identities this
plugin generated): select by `key IN (...)`.

\{ `mode`: `"by-composite-key"`; `keyTuples`: `Record`\<`string`, `unknown`\>[]; \}

### mode

> **mode**: `"by-composite-key"`

### keyTuples

> **keyTuples**: `Record`\<`string`, `unknown`\>[]

Composite keys: one (col = ? AND ...) conjunction per row.
