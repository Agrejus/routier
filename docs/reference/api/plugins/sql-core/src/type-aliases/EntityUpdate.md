[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/sql-core/src](../README.md) / EntityUpdate

# Type Alias: EntityUpdate

> **EntityUpdate** = `object`

Defined in: [plugins/sql-core/src/updates.ts:26](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/sql-core/src/updates.ts#L26)

The grouped-UPDATE builder shared by the SQL plugins.

Entities in one save rarely change the same columns, so updates are grouped by their
changed-column set and each group becomes one statement:

  UPDATE "t" SET "col" = CASE "id" WHEN ? THEN ? ... ELSE "col" END, ... WHERE "id" IN (...)

One statement PER GROUP, never joined with ';': PostgreSQL's extended query protocol and
mysql2's default configuration both permit exactly one command per parameterized
statement, and SQLite's driver only tolerates the join by accident. This used to be
duplicated verbatim in the sqlite, postgresql, and mysql plugins — with the join bug in
all three (defect #22) — so it lives here now, and the dialect supplies quoting and
placeholders.

The CASE form needs one column to switch on, so it applies only to single-key schemas.
Composite keys take the per-row branch instead: one UPDATE each, with every identity
column in the WHERE. Both branches return the same operation shape, so callers do not
distinguish them.

## Properties

### entity

> **entity**: `Record`\<`string`, `unknown`\>

Defined in: [plugins/sql-core/src/updates.ts:27](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/sql-core/src/updates.ts#L27)

***

### delta

> **delta**: `Record`\<`string`, `unknown`\>

Defined in: [plugins/sql-core/src/updates.ts:28](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/sql-core/src/updates.ts#L28)

***

### concurrency?

> `optional` **concurrency**: `object`

Defined in: [plugins/sql-core/src/updates.ts:30](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/sql-core/src/updates.ts#L30)

Present when the row carries an optimistic-concurrency token — see EntityUpdateInfo.

#### column

> **column**: `string`

#### expected

> **expected**: `number`
