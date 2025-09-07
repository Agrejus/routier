---
title: Queries
layout: default
parent: Concepts
nav_order: 2
has_children: true
permalink: /concepts/queries/
---

## Queries

Routier queries are fluent and can only be performed through a collection. Build your query by chaining operations and finish with a terminal method to execute.

### Key points

- **Queries run via a collection**: `context.users.where(u => u.name === "James").firstOrUndefinedAsync()`
- **Chaining is lazy**: nothing executes until you call a terminal method like `toArrayAsync()` or `firstAsync()`.
- **Both async Promises and callback styles are supported** for all terminal operations.

### Basic querying

{% highlight ts linenos %}{% include code/from-docs/concepts/queries/index/block-1.ts %}{% endhighlight %}

### Filtering with where

{% highlight ts linenos %}{% include code/from-docs/concepts/queries/index/block-2.ts %}{% endhighlight %}

### Sorting

{% highlight ts linenos %}{% include code/from-docs/concepts/queries/index/block-3.ts %}{% endhighlight %}

### Selecting fields with map

{% highlight ts linenos %}{% include code/from-docs/concepts/queries/index/block-4.ts %}{% endhighlight %}

### Pagination

{% highlight ts linenos %}{% include code/from-docs/concepts/queries/index/block-5.ts %}{% endhighlight %}

### Aggregation and set operations

{% highlight ts linenos %}{% include code/from-docs/concepts/queries/index/block-6.ts %}{% endhighlight %}

### Terminal methods (execute the query)

- **toArray / toArrayAsync**: return all results
- **first / firstAsync**: first item, throws if none
- **firstOrUndefined / firstOrUndefinedAsync**: first item or undefined
- **some / someAsync**: any match
- **every / everyAsync**: all match (evaluated client-side against the result set)
- **min/max/sum (and Async)**: numeric aggregations
- **count / countAsync**: count of items
- **distinct / distinctAsync**: unique set of current shape
- **remove / removeAsync**: delete items matching the current query

Example removal:

{% highlight ts linenos %}{% include code/from-docs/concepts/queries/index/block-7.ts %}{% endhighlight %}

### Notes

- `where` supports either a simple predicate `(item) => boolean` or a parameterized predicate `(item, params) => boolean` with a params object.
- To get distinct values of a specific field, use `map` to project that field before calling `distinctAsync()`.
- For live results, see Live Queries; you can chain `.subscribe()` before a terminal method to receive updates.

### Computed or unmapped properties

When filtering on a computed or unmapped property (not tracked in the database), the filter runs in memory. If you start your query with only computed/unmapped filters, the system will load records first and then apply those filters client‑side.

Best practice: apply database‑backed filters first, then computed/unmapped filters. This minimizes the number of records that need to be loaded into memory.

Example (in this schema, `firstName` is stored in the database while `age` is a computed property):

{% highlight ts linenos %}{% include code/from-docs/concepts/queries/index/block-8.ts %}{% endhighlight %}

### Related

- [Expressions](/concepts/queries/expressions/)
- [Query Options](/concepts/queries/query-options/)
