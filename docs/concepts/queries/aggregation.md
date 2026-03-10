---
title: Aggregation
layout: default
parent: Queries
nav_order: 5
permalink: /concepts/queries/aggregation/
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


{% highlight ts linenos %}{% include code/from-docs/concepts/queries/aggregation/block-1.ts %}{% endhighlight %}


### Sum Operations


{% highlight ts linenos %}{% include code/from-docs/concepts/queries/aggregation/block-2.ts %}{% endhighlight %}


### Min and Max Operations


{% highlight ts linenos %}{% include code/from-docs/concepts/queries/aggregation/block-3.ts %}{% endhighlight %}


### Distinct Values


{% highlight ts linenos %}{% include code/from-docs/concepts/queries/aggregation/block-4.ts %}{% endhighlight %}


### Boolean Operations


{% highlight ts linenos %}{% include code/from-docs/concepts/queries/aggregation/block-5.ts %}{% endhighlight %}


### Complex Aggregations


{% highlight ts linenos %}{% include code/from-docs/concepts/queries/aggregation/block-6.ts %}{% endhighlight %}


## Common Patterns

### Inventory Management


{% highlight ts linenos %}{% include code/from-docs/concepts/queries/aggregation/block-7.ts %}{% endhighlight %}


### Price Analysis


{% highlight ts linenos %}{% include code/from-docs/concepts/queries/aggregation/block-8.ts %}{% endhighlight %}


### Category Analysis


{% highlight ts linenos %}{% include code/from-docs/concepts/queries/aggregation/block-9.ts %}{% endhighlight %}


## Performance Tips

### Efficient Aggregation

- **Filter first**: Apply `where` clauses before aggregation to reduce data
- **Use appropriate methods**: Choose the right aggregation method for your needs
- **Batch operations**: Combine multiple aggregations when possible

### Memory Considerations


{% highlight ts linenos %}{% include code/from-docs/concepts/queries/aggregation/block-10.ts %}{% endhighlight %}


## Related Topics

- [Filtering Data](/concepts/queries/filtering/) - Filter before aggregating
- [Field Selection](/concepts/queries/field-selection/) - Transform data before aggregation
- [Terminal Methods](/concepts/queries/terminal-methods/) - All query execution methods
