---
title: Queries
---

# Queries

Routier queries are fluent and can only be performed through a collection. Build your query by chaining operations and finish with a terminal method to execute.

## Quick Reference

### Terminal Methods (Query Execution)

| Method                    | Description                     | Example                                            |
| ------------------------- | ------------------------------- | -------------------------------------------------- |
| `toArrayAsync()`          | Get all results as an array     | `await ctx.products.toArrayAsync()`                |
| `firstAsync()`            | Get first item (throws if none) | `await ctx.products.firstAsync()`                  |
| `firstOrUndefinedAsync()` | Get first item or undefined     | `await ctx.products.firstOrUndefinedAsync()`       |
| `someAsync()`             | Check if any items match        | `await ctx.products.someAsync(p => p.active)`      |
| `everyAsync()`            | Check if all items match        | `await ctx.products.everyAsync(p => p.active)`     |
| `countAsync()`            | Count total items               | `await ctx.products.countAsync()`                  |
| `sumAsync(field)`         | Sum numeric field               | `await ctx.products.sumAsync(p => p.price)`        |
| `minAsync(field)`         | Get minimum value               | `await ctx.products.minAsync(p => p.price)`        |
| `maxAsync(field)`         | Get maximum value               | `await ctx.products.maxAsync(p => p.price)`        |
| `distinctAsync()`         | Get unique values               | `await ctx.products.distinctAsync()`               |
| `toGroupAsync(selector)`  | Group items by key              | `await ctx.products.toGroupAsync(p => p.category)` |

### Query Operations (Chaining)

| Method                     | Description             | Example                                                     |
| -------------------------- | ----------------------- | ----------------------------------------------------------- |
| `where(predicate, params?)` | Filter results | `ctx.products.where(p => p.price > 100)` |
| `sort(field)` | Sort ascending | `ctx.products.sort(p => p.name)` |
| `sortDescending(field)` | Sort descending | `ctx.products.sortDescending(p => p.price)` |
| `map(selector)` | Transform/select fields | `ctx.products.map(p => ({ name: p.name }))` |
| `skip(count)` / `take(count)` | Window results | `ctx.products.skip(10).take(5)` |
| `join(inner, outerKey, innerKey)` | Return matching tuples | `ctx.teams.join(s => s.members, t => t.id, m => m.teamId)` |
| `leftJoin(...)` | Keep unmatched left rows | `ctx.teams.leftJoin(s => s.members, t => t.id, m => m.teamId)` |
| `nearest(field, vector, count)` | Rank vector similarity | `ctx.products.nearest(p => p.embedding, query, 10)` |
| `search(terms, options?)` | Ranked full-text search | `ctx.products.search("copper pipe")` |
| `subscribe()` | Enable live updates | `ctx.products.subscribe().toArray(callback)` |

## Major query features

- [Joins](/concepts/queries/joins) — inner and left equi-joins, same-store and cross-store joins, tuple operations, scopes, and backend execution.
- [Full-Text Search](/concepts/queries/full-text-search) — ranked search over `.searchable()` strings.
- [Vector Search](/concepts/queries/vector-search) — cosine-similarity ordering with `s.vector()` and `.nearest()`.
- [Reusable Queries](/concepts/queries/query-composer) — define a typed query with `Queryable.compose()` and execute it through `collection.apply()`.

## Detailed Examples

### Getting All Results


<<< @/_snippets/code/from-docs/concepts/queries/index/block-1.ts


### Getting Single Items


<<< @/_snippets/code/from-docs/concepts/queries/index/block-2.ts


### Checking Existence


<<< @/_snippets/code/from-docs/concepts/queries/index/block-3.ts


### Counting Items


<<< @/_snippets/code/from-docs/concepts/queries/index/block-4.ts


### Filtering Data


<<< @/_snippets/code/from-docs/concepts/queries/index/block-5.ts


### Sorting Results


<<< @/_snippets/code/from-docs/concepts/queries/index/block-6.ts


### Field Selection and Transformation


<<< @/_snippets/code/from-docs/concepts/queries/index/block-7.ts


### Pagination


<<< @/_snippets/code/from-docs/concepts/queries/index/block-8.ts


### Aggregation Operations


<<< @/_snippets/code/from-docs/concepts/queries/index/block-9.ts


### Complex Queries


<<< @/_snippets/code/from-docs/concepts/queries/index/block-10.ts


## Key Concepts

### Query Execution

- **Lazy evaluation**: Queries don't execute until you call a terminal method
- **Chaining**: You can chain multiple operations together
- **Collection-based**: All queries must start with a collection

### Performance Tips

- **Database filters first**: Apply `where` clauses on database fields before computed fields
- **Limit results**: Use `take()` to limit large result sets
- **Efficient pagination**: Use `skip()` and `take()` for pagination

### Computed Properties

When filtering on computed properties (not stored in database), the filter runs in memory:


<<< @/_snippets/code/from-docs/concepts/queries/index/block-11.ts


## Related Topics

- [Filtering](/concepts/queries/filtering) - Detailed filtering examples
- [Sorting](/concepts/queries/sorting) - Advanced sorting techniques
- [Joins](/concepts/queries/joins) - Join collections and views
- [Full-Text Search](/concepts/queries/full-text-search) - Ranked text search
- [Vector Search](/concepts/queries/vector-search) - Nearest-neighbor queries
- [Field Selection](/concepts/queries/field-selection) - Data transformation
- [Pagination](/concepts/queries/pagination) - Pagination strategies
- [Aggregation](/concepts/queries/aggregation) - Aggregation operations
- [Terminal Methods](/concepts/queries/terminal-methods) - Query execution methods
- [Reusable Queries](/concepts/queries/query-composer) - `Queryable.compose()` and `collection.apply()`
