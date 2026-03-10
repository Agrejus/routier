---
title: Terminal Methods
layout: default
parent: Queries
nav_order: 6
permalink: /concepts/queries/terminal-methods/
---

# Terminal Methods

All queries must end with a terminal method to execute. These methods actually perform the query and return results.

## Quick Navigation

- [Quick Reference](#quick-reference)
- [Detailed Examples](#detailed-examples)
- [Important Notes](#important-notes)
- [Common Patterns](#common-patterns)
- [Related Topics](#related-topics)

## Quick Reference

| Method                    | Description                     | Example                                            |
| ------------------------- | ------------------------------- | -------------------------------------------------- |
| `toArrayAsync()`          | Get all results as an array     | `await ctx.products.toArrayAsync()`                |
| `firstAsync()`            | Get first item (throws if none) | `await ctx.products.firstAsync()`                  |
| `firstOrUndefinedAsync()` | Get first item or undefined     | `await ctx.products.firstOrUndefinedAsync()`       |
| `someAsync()`             | Check if any items exist        | `await ctx.products.someAsync()`                   |
| `everyAsync(predicate)`   | Check if all items match        | `await ctx.products.everyAsync(p => p.inStock)`    |
| `countAsync()`            | Count total items               | `await ctx.products.countAsync()`                  |
| `sumAsync(field)`         | Sum numeric field               | `await ctx.products.sumAsync(p => p.price)`        |
| `minAsync(field)`         | Get minimum value               | `await ctx.products.minAsync(p => p.price)`        |
| `maxAsync(field)`         | Get maximum value               | `await ctx.products.maxAsync(p => p.price)`        |
| `distinctAsync()`         | Get unique values               | `await ctx.products.distinctAsync()`               |
| `toGroupAsync(selector)`  | Group items by key              | `await ctx.products.toGroupAsync(p => p.category)` |
| `removeAsync()`           | Delete matching items           | `await ctx.products.removeAsync()`                 |

## Detailed Examples

### Getting All Results


{% highlight ts linenos %}{% include code/from-docs/concepts/queries/terminal-methods/block-1.ts %}{% endhighlight %}


### Getting Single Items


{% highlight ts linenos %}{% include code/from-docs/concepts/queries/terminal-methods/block-2.ts %}{% endhighlight %}


### Checking Existence


{% highlight ts linenos %}{% include code/from-docs/concepts/queries/terminal-methods/block-3.ts %}{% endhighlight %}


### Counting Items


{% highlight ts linenos %}{% include code/from-docs/concepts/queries/terminal-methods/block-4.ts %}{% endhighlight %}


### Aggregation Operations


{% highlight ts linenos %}{% include code/from-docs/concepts/queries/terminal-methods/block-5.ts %}{% endhighlight %}


### Distinct Values


{% highlight ts linenos %}{% include code/from-docs/concepts/queries/terminal-methods/block-6.ts %}{% endhighlight %}


### Grouping Data

Group items by a key value, returning a record where keys are the grouped values and values are arrays of items with that key:


{% highlight ts linenos %}{% include code/from-docs/concepts/queries/terminal-methods/block-7.ts %}{% endhighlight %}


The selector function must return a value that can be used as an object key (string, number, or Date). Each group contains an array of all items that share the same key value.

### Removal Operations


{% highlight ts linenos %}{% include code/from-docs/concepts/queries/terminal-methods/block-8.ts %}{% endhighlight %}


## Important Notes

### Lazy Evaluation

- Queries are **lazy** - nothing executes until you call a terminal method
- You can chain multiple operations before calling a terminal method
- The query is built up and executed only when the terminal method is called

### Async vs Callback Styles

Both async Promises and callback styles are supported:


{% highlight ts linenos %}{% include code/from-docs/concepts/queries/terminal-methods/block-9.ts %}{% endhighlight %}


### Live Queries

For live results that update automatically, you can chain `.subscribe()` before a terminal method:


{% highlight ts linenos %}{% include code/from-docs/concepts/queries/terminal-methods/block-10.ts %}{% endhighlight %}


## Common Patterns

### Data Validation


{% highlight ts linenos %}{% include code/from-docs/concepts/queries/terminal-methods/block-11.ts %}{% endhighlight %}


### Pagination with Count


{% highlight ts linenos %}{% include code/from-docs/concepts/queries/terminal-methods/block-12.ts %}{% endhighlight %}


### Conditional Operations


{% highlight ts linenos %}{% include code/from-docs/concepts/queries/terminal-methods/block-13.ts %}{% endhighlight %}


### Organizing Data by Category


{% highlight ts linenos %}{% include code/from-docs/concepts/queries/terminal-methods/block-14.ts %}{% endhighlight %}


## Related Topics

- [Filtering Data](/concepts/queries/filtering/) - Filter before terminal methods
- [Sorting Results](/concepts/queries/sorting/) - Sort before terminal methods
- [Aggregation](/concepts/queries/aggregation/) - Aggregation terminal methods
