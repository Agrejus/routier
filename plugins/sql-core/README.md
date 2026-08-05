# @routier/sql-plugin-core

Shared SQL generation for Routier's SQL plugins. The SQLite, PostgreSQL, and MySQL plugins all
build their statements here.

This package is a building block for plugin authors. Use it if you are writing a plugin for
another SQL engine. Application code does not import it.

```ts
import {
  getDialect,
  toSql,
  buildGroupedUpdateOperations,
  toColumnValueMap,
  decodeJsonColumns,
} from "@routier/sql-plugin-core";
```

## What it provides

| Export | Purpose |
|---|---|
| `getDialect(name)` | Quoting, placeholders, JSON and date encoding, `LIKE` vs `GLOB` |
| `toSql(expression, dialect)` | A `WHERE` fragment and its parameters, from an expression tree |
| `toColumnAssignments`, `toColumnValueMap` | A partial entity to columns, with renames applied and nested values encoded |
| `sqlColumnProperties(schema)` | Root properties only — the table's real column list |
| `decodeJsonColumns(rows, schema)` | The read-side inverse of the JSON encoding |
| `buildGroupedUpdateOperations` | `UPDATE` statements for a batch, grouped by changed columns |
| `buildConditionalUpdateOperations` | One token-checked `UPDATE` per row, for optimistic concurrency |

## Contracts

### Dialects

`sqlite`, `postgresql`, `mysql`, and `mssql`. A dialect supplies identifier quoting, the
placeholder form, the JSON column type, and the two value encoders — `encodeJson` and
`encodeDate`.

`encodeDate` exists because MySQL's `DATETIME` rejects ISO-8601. The other dialects pass the
value through.

### Nested values

A nested object or array is **one column**, named for its root property. `schema.properties`
is flat and lists `nested`, `nested.inner`, and `nested.inner.value` side by side, so building
columns from every property produces bogus columns that collide the moment two nested objects
share a child name. Use `sqlColumnProperties`.

Encoding is decided on the value's **runtime shape**, not its declared type. A property that
carries its own `.serialize()` arrives already stringified, and encoding it again would
double-encode.

### Update statements

Single-key schemas get one grouped statement per changed-column set:

```sql
UPDATE "t" SET "col" = CASE "id" WHEN ? THEN ? … ELSE "col" END WHERE "id" IN (…)
```

Composite-key schemas get **one statement per row**, with every identity column in the
`WHERE`. A `CASE` over one component of a composite key applies one row's value to every row
that shares that component.

Statements are never joined with `;`. PostgreSQL's extended query protocol and mysql2's
default configuration both allow exactly one command per parameterized statement.

Every operation carries `keyTuples` — each row's full identity. Engines without `RETURNING`
must select rows back with it, not with a bare id.

### Placeholders

Each returned statement numbers its own placeholders from the dialect's first. A shared
counter across statements is what made them inseparable before.

## Testing a new dialect

`e2e/src/dialectConformance.ts` is a matrix of behaviour every engine must agree on: both
operand orders for every comparator, null tests on either side, composite keys, renamed
columns, nested JSON, and mixed update batches. Wire a new backend into it and run it against
a real server.

String assertions are not enough on their own. The two worst defects this package has had —
a reversed null test rendering `? IS NULL`, and an operand-order sentinel collision — both
produced valid SQL that an engine ran happily and answered wrongly.

## Supported versions

Node 18 or later. No runtime dependencies outside `@routier/core`.
