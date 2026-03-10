---
title: Live Queries
layout: default
parent: Guides
nav_order: 1
---

# Live Queries

Live queries automatically update when the underlying data changes, providing real-time reactive data for your applications.

## Overview

Live queries in Routier allow you to subscribe to data changes and automatically receive updates when the underlying data is modified. This is perfect for building reactive UIs and real-time applications.

## Quick Navigation

- [Quick Reference](#quick-reference)
- [Important: Callbacks vs Async](#important-callbacks-vs-async)
- [Basic Live Queries](#basic-live-queries)
  - [Simple Live Query](#simple-live-query)
  - [Live Query with Filtering](#live-query-with-filtering)
  - [Live Query with Sorting](#live-query-with-sorting)
- [Advanced Live Query Patterns](#advanced-live-query-patterns)
  - [Live Aggregation](#live-aggregation)
  - [Live Pagination](#live-pagination)
  - [Live Single Item](#live-single-item)
- [Managing Live Queries](#managing-live-queries)
- [Performance Considerations](#performance-considerations)
- [Common Patterns](#common-patterns)
- [Best Practices](#best-practices)
- [Error Handling](#error-handling)
- [Related Topics](#related-topics)

## Quick Reference

| Method          | Description         | Example                                      |
| --------------- | ------------------- | -------------------------------------------- |
| `subscribe()`   | Enable live updates | `ctx.products.subscribe().toArray(callback)` |
| `unsubscribe()` | Stop live updates   | `query.unsubscribe()`                        |

## Important: Callbacks vs Async

When using `.subscribe()`, you **must use callback-based methods** (not async methods):


{% highlight ts linenos %}{% include code/from-docs/guides/live-queries/block-1.ts %}{% endhighlight %}


The reason: subscriptions need to trigger the callback whenever data changes, which can't be done with promises. Callbacks can be invoked at any time, making them perfect for reactive updates.

## Basic Live Queries

### Simple Live Query


{% highlight ts linenos %}{% include code/from-docs/guides/live-queries/block-2.ts %}{% endhighlight %}


### Live Query with Filtering


{% highlight ts linenos %}{% include code/from-docs/guides/live-queries/block-3.ts %}{% endhighlight %}


### Live Query with Sorting


{% highlight ts linenos %}{% include code/from-docs/guides/live-queries/block-4.ts %}{% endhighlight %}


## Advanced Live Query Patterns

### Live Aggregation


{% highlight ts linenos %}{% include code/from-docs/guides/live-queries/block-5.ts %}{% endhighlight %}


### Live Pagination


{% highlight ts linenos %}{% include code/from-docs/guides/live-queries/block-6.ts %}{% endhighlight %}


### Live Single Item


{% highlight ts linenos %}{% include code/from-docs/guides/live-queries/block-7.ts %}{% endhighlight %}


## Managing Live Queries

### Unsubscribing


{% highlight ts linenos %}{% include code/from-docs/guides/live-queries/block-8.ts %}{% endhighlight %}


### Conditional Live Queries


{% highlight ts linenos %}{% include code/from-docs/guides/live-queries/block-9.ts %}{% endhighlight %}


## Performance Considerations

### Efficient Live Queries


{% highlight ts linenos %}{% include code/from-docs/guides/live-queries/block-10.ts %}{% endhighlight %}


### Memory Management


{% highlight ts linenos %}{% include code/from-docs/guides/live-queries/block-11.ts %}{% endhighlight %}


## Common Patterns

### Real-time Dashboard


{% highlight ts linenos %}{% include code/from-docs/guides/live-queries/block-12.ts %}{% endhighlight %}


### Live Search Results


{% highlight ts linenos %}{% include code/from-docs/guides/live-queries/block-13.ts %}{% endhighlight %}


### Live Notifications


{% highlight ts linenos %}{% include code/from-docs/guides/live-queries/block-14.ts %}{% endhighlight %}


## Best Practices

### 1. **Use Live Queries for Real-time Data**


{% highlight ts linenos %}{% include code/from-docs/guides/live-queries/block-15.ts %}{% endhighlight %}


### 2. **Apply Filters Before Subscribing**


{% highlight ts linenos %}{% include code/from-docs/guides/live-queries/block-16.ts %}{% endhighlight %}


### 3. **Clean Up Subscriptions**


{% highlight ts linenos %}{% include code/from-docs/guides/live-queries/block-17.ts %}{% endhighlight %}


### 4. **Use Appropriate Terminal Methods**


{% highlight ts linenos %}{% include code/from-docs/guides/live-queries/block-18.ts %}{% endhighlight %}


## Error Handling

### Live Query Error Handling


{% highlight ts linenos %}{% include code/from-docs/guides/live-queries/block-19.ts %}{% endhighlight %}


## Related Topics

- [Queries](/concepts/queries/) - Basic query operations
- [State Management](/guides/state-management/) - Managing application state
- [Data Manipulation](/guides/data-manipulation/) - Modifying data
