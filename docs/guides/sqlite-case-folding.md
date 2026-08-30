---
title: SQLite Case Folding
---

# Why my `.toLowerCase()` filter misses rows on SQLite

You saw this warning:

```
Routier: turso cannot be given JavaScript's toLowerCase, so a filter using it runs in memory
instead of the database. The rows are correct; the query reads more of the table than it needs to.
```

Your rows are correct. The query is slower than it could be.

## The cause

SQLite's built-in `lower()` and `upper()` only fold ASCII characters. Everything else passes through
unchanged.

```sql
select lower('ÉaB');   -- 'Éab'   — the É is untouched
```

JavaScript folds the full Unicode range:

```js
'ÉaB'.toLowerCase();   // 'éab'
```

So a filter pushed down to SQLite would compare `'Éab'` where your predicate means `'éab'`, and the
row would not match.

```ts
// name is 'Écho'
await ctx.products.where(p => p.name.toLowerCase() === 'écho').toArrayAsync();
```

The divergence appears only on non-ASCII data. A database of ASCII names never shows it, which is
what makes it easy to ship.

## What Routier does

It depends on the driver.

| driver | behaviour |
|---|---|
| `node:sqlite` | Routier replaces `lower()` and `upper()` with JavaScript's, and pushes the filter down |
| `sqlite3` | the filter runs in memory |
| Turso | the filter runs in memory |
| WASM | the filter runs in memory |
| Cloudflare D1 | the filter runs in memory |

SQLite lets a connection replace a built-in function, so on `node:sqlite` there is no divergence and
no cost. The other drivers give Routier no way to define a function, so it hands the filter back and
the datastore applies it after the rows are read.

`.explain()` reports it:

```
STEP 2 of 2 — memory  [engine-divergence]
    filter   name.toLowerCase() === "écho"
```

## The cost

The query reads every row the other filters did not exclude, instead of letting SQLite narrow it.
On a small table this is not measurable. On a large one it is a table scan.

## How to make it fast

Pick one.

**Use the `node:sqlite` driver.** This is the recommended option. It needs Node 22.5 or later.

```ts
import { SqliteDbPlugin } from '@routier/sqlite-plugin';

const plugin = new SqliteDbPlugin('app.sqlite');   // node:sqlite is the default
```

**Store a folded column.** Write the lower-cased value at save time and filter on it directly. This
works on every driver, and it is the only option that also gets you an index.

```ts
const productSchema = s.define('products', {
    id: s.string().key().identity(),
    name: s.string(),
    nameFolded: s.string()
}).compile();

await ctx.products.where(p => p.nameFolded === 'écho').toArrayAsync();
```

**Accept the memory pass.** If the table is small, or the filter runs beside another that does narrow
the read, the cost is not worth removing.

## Why Routier does not just push it down anyway

Pushing it down returns the wrong rows, silently, only for users with non-ASCII data. Routier
returns the rows your predicate means and tells you what it cost.

## Turning the warning off

The warning goes through Routier's logger, at `warn` level.

```bash
ROUTIER_LOG_LEVEL=error   # or: silent
```

Turning the warning off does not change the rows or the speed.

## Related

- [Filtering](/concepts/queries/filtering)
- [`.explain()`](/concepts/queries/explain)
- [Built-in plugins](/integrations/plugins/built-in-plugins/)
