---
title: Aggregation
---

# Aggregation Operations

Perform calculations on your data with aggregation methods like `sum`, `min`, `max`, `count`, and `distinct`.

## Quick Reference

| Method                  | Description              | Example                                         |
| ----------------------- | ------------------------ | ----------------------------------------------- |
| `countAsync()`          | Count total items        | `await ctx.products.countAsync()`               |
| `sumAsync(field)`       | Sum numeric field        | `await ctx.products.sumAsync(p => p.price)`     |
| `minAsync(field)`       | Get minimum value        | `await ctx.products.minAsync(p => p.price)`     |
| `maxAsync(field)`       | Get maximum value        | `await ctx.products.maxAsync(p => p.price)`     |
| `distinctAsync()`       | Get unique values        | `await ctx.products.distinctAsync()`            |
| `someAsync()`           | Check if any items exist | `await ctx.products.someAsync()`                |
| `everyAsync(predicate)` | Check if all items match | `await ctx.products.everyAsync(p => p.inStock)` |

## Detailed Examples

### Counting Items


<<< @/_snippets/code/from-docs/concepts/queries/aggregation/block-1.ts


### Sum Operations


<<< @/_snippets/code/from-docs/concepts/queries/aggregation/block-2.ts


### Min and Max Operations


<<< @/_snippets/code/from-docs/concepts/queries/aggregation/block-3.ts


### Distinct Values


<<< @/_snippets/code/from-docs/concepts/queries/aggregation/block-4.ts


### Boolean Operations


<<< @/_snippets/code/from-docs/concepts/queries/aggregation/block-5.ts


### Complex Aggregations


<<< @/_snippets/code/from-docs/concepts/queries/aggregation/block-6.ts


## Common Patterns

### Inventory Management


<<< @/_snippets/code/from-docs/concepts/queries/aggregation/block-7.ts


### Price Analysis


<<< @/_snippets/code/from-docs/concepts/queries/aggregation/block-8.ts


### Category Analysis


<<< @/_snippets/code/from-docs/concepts/queries/aggregation/block-9.ts


## Performance Tips

### Efficient Aggregation

- **Filter first**: Apply `where` clauses before aggregation to reduce data
- **Use appropriate methods**: Choose the right aggregation method for your needs
- **Batch operations**: Combine multiple aggregations when possible

### Memory Considerations


<<< @/_snippets/code/from-docs/concepts/queries/aggregation/block-10.ts


## Related Topics

- [Filtering Data](/concepts/queries/filtering) - Filter before aggregating
- [Field Selection](/concepts/queries/field-selection) - Transform data before aggregation
- [Terminal Methods](/concepts/queries/terminal-methods) - All query execution methods
