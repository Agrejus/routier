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
| `someAsync()`             | Check if any items exist        | `await ctx.products.someAsync()`                   |
| `countAsync()`            | Count total items               | `await ctx.products.countAsync()`                  |
| `sumAsync(field)`         | Sum numeric field               | `await ctx.products.sumAsync(p => p.price)`        |
| `minAsync(field)`         | Get minimum value               | `await ctx.products.minAsync(p => p.price)`        |
| `maxAsync(field)`         | Get maximum value               | `await ctx.products.maxAsync(p => p.price)`        |
| `distinctAsync()`         | Get unique values               | `await ctx.products.distinctAsync()`               |
| `toGroupAsync(selector)`  | Group items by key              | `await ctx.products.toGroupAsync(p => p.category)` |

### Query Operations (Chaining)

| Method                     | Description             | Example                                                     |
| -------------------------- | ----------------------- | ----------------------------------------------------------- |
| `where(predicate)`         | Filter results          | `ctx.products.where(p => p.price > 100)`                    |
| `sort(field)`              | Sort ascending          | `ctx.products.sort(p => p.name)`                            |
| `orderByDescending(field)` | Sort descending         | `ctx.products.orderByDescending(p => p.price)`              |
| `map(selector)`            | Transform/select fields | `ctx.products.map(p => ({ name: p.name, price: p.price }))` |
| `skip(count)`              | Skip first N items      | `ctx.products.skip(10)`                                     |
| `take(count)`              | Take first N items      | `ctx.products.take(5)`                                      |
| `subscribe()`              | Enable live updates     | `ctx.products.subscribe().toArray(callback)`                |

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
- [Field Selection](/concepts/queries/field-selection) - Data transformation
- [Pagination](/concepts/queries/pagination) - Pagination strategies
- [Aggregation](/concepts/queries/aggregation) - Aggregation operations
- [Terminal Methods](/concepts/queries/terminal-methods) - Query execution methods
- [Query Composer](/concepts/queries/query-composer) - Reusable, parameterized queries
