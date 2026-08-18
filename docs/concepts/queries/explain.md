---
title: Explain
---

# Explain

Add `.explain()` to a query chain to see where each part of the query ran. The query still executes. Every terminal after `.explain()` returns `{ data, explanation }` instead of the rows alone.

```ts
const { data, explanation } = await ctx.products
    .where(p => p.price > 50)
    .sort(p => p.price)
    .explain()
    .toArrayAsync();
```

Use it as a development tool: add it, read the output, delete it.

## Why it exists

Routier pushes as much of a query as possible down to the storage plugin. Options the plugin cannot run are executed in memory, over the rows the plugin returned. This split is invisible in normal use. `.explain()` makes it visible, so you can see when a query reads more rows than it returns and why.

## The explanation object

The explanation is plain JSON. You can log it, assert on it in a test, or send it over a wire.

| Field            | Content                                                                 |
| ---------------- | ----------------------------------------------------------------------- |
| `collection`     | The collection name.                                                     |
| `database`       | The database name.                                                       |
| `summary`        | Option counts per location, deduped reason codes, and a one-paragraph explanation. |
| `executionSteps` | At most two steps: the database prefix, then the memory tail.            |
| `plugin.kind`    | The plugin class name.                                                   |

Each database step carries `executedQueries` — what the plugin actually ran, reported by the plugin itself:

```json
{
  "text": "SELECT \"_id\", \"name\", \"price\" FROM \"products\" WHERE \"price\" > ? ORDER BY \"price\" ASC",
  "parameters": [50]
}
```

`text` is SQL for a SQL engine. A store with no statement language describes its access path instead, for example `products: scanned 3 in-memory records`.

Each memory step carries a `reason` code and a one-sentence `explanation`:

| Reason              | Meaning                                                                 |
| ------------------- | ----------------------------------------------------------------------- |
| `not-parsable`      | A filter could not be parsed into an expression tree.                    |
| `unmapped-property` | The property is not stored in the database.                              |
| `renamed-property`  | The property is stored under a different name.                           |
| `map-rename`        | A `map` renamed or dropped properties, so later options refer to names the database does not have. |
| `after-nearest`     | Options after a vector search run in memory.                             |
| `after-join`        | Options after a join run in memory.                                      |
| `cross-plugin-join` | The two sides of a join live on different plugins.                       |

## Formatted output

`formatExplanation` renders the explanation for a terminal:

```ts
import { formatExplanation } from "@routier/core/plugins";

console.log(formatExplanation(explanation));
```

```
products · app.db · 2 steps

  STEP 1 of 2 — database
    These options are sent to the plugin.

    filter   price > 50
    sort     price asc

    SELECT "_id", "name", "price" FROM "products" WHERE "price" > ? ORDER BY "price" ASC
    parameters: [50]

  STEP 2 of 2 — memory  [map-rename]
    Routier runs these over the rows the database returned, after
    deserializing them.

    map      name → label, price

  2 options ran in the database, 1 ran in memory.
```

## Joins

A join reads twice, and the explanation reports both reads in execution order. `.explain()` is available on a joined query:

```ts
const { data, explanation } = await ctx.teams
    .join(s => s.members, team => team._id, member => member.teamId)
    .explain()
    .toArrayAsync();
```

## Plugins that do not report

Reporting is optional for a plugin. When the plugin reports nothing, the rest of the explanation still stands — the step analysis comes from Routier, not from the plugin. The database step then carries a marker instead of statements:

```json
{
  "executedQueriesUnsupported": "This plugin did not report what it executed. It may not support explain."
}
```

All built-in plugins report.

## Remote plugins

`.explain()` works through [HTTP transport](/integrations/plugins/http-transport). The request carries the explain flag, the server's plugin reports what it ran, and the response carries the statements back. The client's explanation then shows the server's SQL on the database step. A server whose plugin does not report produces the unsupported marker above.

::: warning
`executedQueries.parameters` carries live query values. Treat a logged explanation like a logged query.
:::

## Limits

- `.explain()` is not available on a subscribed query. A subscription re-runs its query on every change, and the report would grow without bound.
- A cached read reports `cache hit — no query was executed` instead of a statement.

## Related Topics

- [Query Architecture](/concepts/query-architecture) - How Routier decides what runs in the database
- [Terminal Methods](/concepts/queries/terminal-methods) - The methods that execute a query
- [Build a Storage Plugin](/integrations/plugins/create-your-own/) - How a plugin reports what it executed
