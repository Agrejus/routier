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

- [Available Terminal Methods](#available-terminal-methods)
- [Basic Terminal Methods](#basic-terminal-methods)
- [Removal Operations](#removal-operations)
- [Important Notes](#important-notes)
- [Related](#related)

## Available Terminal Methods

- **toArray / toArrayAsync**: return all results
- **first / firstAsync**: first item, throws if none
- **firstOrUndefined / firstOrUndefinedAsync**: first item or undefined
- **some / someAsync**: any match
- **every / everyAsync**: all match (evaluated client-side against the result set)
- **min/max/sum (and Async)**: numeric aggregations
- **count / countAsync**: count of items
- **distinct / distinctAsync**: unique set of current shape
- **remove / removeAsync**: delete items matching the current query

## Basic Terminal Methods

{% capture snippet_terminal_methods %}{% include code/from-docs/concepts/queries/terminal-methods.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_terminal_methods | strip }}{% endhighlight %}

## Removal Operations

Delete items matching your query:

{% capture snippet_8vys4s %}{% include code/from-docs/concepts/queries/example-removal.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_8vys4s | strip }}{% endhighlight %}

## Important Notes

- Queries are **lazy** - nothing executes until you call a terminal method
- Both async Promises and callback styles are supported for all terminal operations
- For live results, see Live Queries; you can chain `.subscribe()` before a terminal method to receive updates

## Related

- [Filtering Data](/concepts/queries/filtering/)
- [Sorting Results](/concepts/queries/sorting/)
- [Aggregation](/concepts/queries/aggregation/)
