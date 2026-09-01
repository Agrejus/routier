---
title: Strict Comparison Types
---

# Why my strict comparison returns nothing

You saw this warning:

```
Routier: 'price' is a number, and this filter compares it against "5", which is a string.
A strict comparison between them is the same answer for every row, so no row matches and
the filter runs in memory.
```

Your filter compares a column against a value of a different type, with `===` or `!==`. JavaScript
answers that comparison the same way for every row, so the filter cannot select anything.

## The cause

`===` compares type as well as value. `5 === "5"` is `false` in JavaScript, whatever the row holds.

```ts
// price is s.number()
const price = req.query.price;      // "5" — a string, from the URL

await ctx.products.where(p => p.price === price).toArrayAsync();
// 0 rows, always
```

The value usually arrives as a string from a form, a URL, a query parameter, or `JSON.parse` of a
field that was serialized as text.

## What Routier does

Routier detects the mismatch and runs the filter in memory rather than in the database. The rows you
get are the rows JavaScript gives you.

`.explain()` reports it:

```
STEP 1 of 1 — memory  [predicate-error]
    filter   price === "5"
```

Routier does not correct your filter. Correcting it would mean guessing which of the two types you
meant, and a wrong guess returns rows you did not ask for.

## Both directions

| filter | rows returned |
|---|---|
| `p.price === "5"` | none |
| `p.price !== "5"` | every row |

The second one is the dangerous one. It looks like it filters, and it does not.

## How to fix it

Convert the value to the column's type before the filter. This is the recommended fix.

```ts
const price = Number(req.query.price);

await ctx.products.where(([p, params]) => p.price === params.price, { price }).toArrayAsync();
```

If you want JavaScript's coercing comparison, use `==` or `!=`. Routier coerces the value to the
column's type for a loose comparison, and pushes the filter down.

```ts
await ctx.products.where(p => p.price == "5").toArrayAsync();
// 1 row, and it runs in the database
```

## Which types Routier checks

| schema type | JavaScript type it must be compared against |
|---|---|
| `s.number()` | `number` |
| `s.string()` | `string` |
| `s.boolean()` | `boolean` |
| `s.date()` | `Date` |

A `null` or `undefined` value is never a mismatch: `p.name === null` is a legitimate filter.

A `bigint` compared to a `s.number()` column is a mismatch, because `5 === 5n` is `false` in
JavaScript.

## Turning the warning off

The warning goes through Routier's logger, at `warn` level.

```bash
ROUTIER_LOG_LEVEL=error   # or: silent
```

Turning the warning off does not change the rows. The filter still runs in memory, and still returns
what JavaScript returns.

## Related

- [Filtering](/concepts/queries/filtering)
- [`.explain()`](/concepts/queries/explain)
- [Creating a schema](/concepts/schema/creating-a-schema)
