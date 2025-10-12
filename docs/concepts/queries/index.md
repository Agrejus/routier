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

### Table of Contents

- [Getting Started](#getting-started)
- [Query Building](#query-building)
- [Advanced Queries](#advanced-queries)
- [Reference](#reference)

### Key Concepts

- **Queries run via a collection**: `context.users.where(u => u.name === "James").firstOrUndefinedAsync()`
- **Chaining is lazy**: nothing executes until you call a terminal method like `toArrayAsync()` or `firstAsync()`.
- **Both async Promises and callback styles are supported** for all terminal operations.

## Getting Started

### Basic Querying

The simplest way to query your data:

{% capture snippet_toc7ki %}{% include code/from-docs/concepts/queries/basic-querying.ts %}{% endcapture %}

{% highlight ts %}{{ snippet_toc7ki | strip }}{% endhighlight %}

### Common Patterns

Here are the most common query patterns you'll use:

```ts
// Get all items
const all = await dataStore.products.toArrayAsync();

// Get first item
const first = await dataStore.products.firstAsync();

// Check if any exist
const hasItems = await dataStore.products.someAsync();

// Count items
const count = await dataStore.products.countAsync();
```

## Query Building

### Filtering Data

Filter your data with `where` clauses:

**Simple filtering:**
{% capture snippet_filtering_simple %}{% include code/from-docs/concepts/queries/filtering-simple.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_filtering_simple | strip }}{% endhighlight %}

**Multiple conditions:**
{% capture snippet_filtering_multiple %}{% include code/from-docs/concepts/queries/filtering-multiple.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_filtering_multiple | strip }}{% endhighlight %}

**Parameterized queries:**
{% capture snippet_filtering_parameterized %}{% include code/from-docs/concepts/queries/filtering-parameterized.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_filtering_parameterized | strip }}{% endhighlight %}

### Sorting Results

Sort your data in ascending or descending order:

**Ascending sort:**
{% capture snippet_sorting_ascending %}{% include code/from-docs/concepts/queries/sorting-ascending.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_sorting_ascending | strip }}{% endhighlight %}

**Descending sort:**
{% capture snippet_sorting_descending %}{% include code/from-docs/concepts/queries/sorting-descending.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_sorting_descending | strip }}{% endhighlight %}

### Selecting Fields

Use `map` to select specific fields or create computed values:

**Select specific fields:**
{% capture snippet_selecting_fields %}{% include code/from-docs/concepts/queries/selecting-fields.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_selecting_fields | strip }}{% endhighlight %}

**Computed fields:**
{% capture snippet_selecting_computed %}{% include code/from-docs/concepts/queries/selecting-computed.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_selecting_computed | strip }}{% endhighlight %}

### Pagination

Use `take` and `skip` for pagination:

{% capture snippet_pagination_example %}{% include code/from-docs/concepts/queries/pagination-example.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_pagination_example | strip }}{% endhighlight %}

## Advanced Queries

### Aggregation

Perform calculations on your data with aggregation methods:

{% capture snippet_aggregation_basic %}{% include code/from-docs/concepts/queries/aggregation-basic.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_aggregation_basic | strip }}{% endhighlight %}

### Computed Properties

When filtering on computed or unmapped properties (not tracked in the database), the filter runs in memory.

**Best practice**: Apply database-backed filters first, then computed/unmapped filters to minimize records loaded into memory.

{% capture snippet_muj42f %}{% include code/from-docs/concepts/queries/computed-unmapped-properties.ts %}{% endcapture %}

{% highlight ts %}{{ snippet_muj42f | strip }}{% endhighlight %}

## Reference

### Terminal Methods

All queries must end with a terminal method to execute:

- **toArray / toArrayAsync**: return all results
- **first / firstAsync**: first item, throws if none
- **firstOrUndefined / firstOrUndefinedAsync**: first item or undefined
- **some / someAsync**: any match
- **every / everyAsync**: all match (evaluated client-side against the result set)
- **min/max/sum (and Async)**: numeric aggregations
- **count / countAsync**: count of items
- **distinct / distinctAsync**: unique set of current shape
- **remove / removeAsync**: delete items matching the current query

{% capture snippet_terminal_methods %}{% include code/from-docs/concepts/queries/terminal-methods.ts %}{% endcapture %}

{% highlight ts %}{{ snippet_terminal_methods | strip }}{% endhighlight %}

### Removal Examples

{% capture snippet_8vys4s %}{% include code/from-docs/concepts/queries/example-removal.ts %}{% endcapture %}

{% highlight ts %}{{ snippet_8vys4s | strip }}{% endhighlight %}

### Important Notes

- `where` supports either a simple predicate `(item) => boolean` or a parameterized predicate `(item, params) => boolean` with a params object
- To get distinct values of a specific field, use `map` to project that field before calling `distinctAsync()`
- For live results, see Live Queries; you can chain `.subscribe()` before a terminal method to receive updates

### Related Topics

- [Expressions](/concepts/queries/expressions/)
- [Query Options](/concepts/queries/query-options/)
