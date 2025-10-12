---
title: Filtering
layout: default
parent: Queries
nav_order: 1
permalink: /concepts/queries/filtering/
---

# Filtering Data

Filter your data with `where` clauses to find exactly what you need.

## Simple Filtering

Filter by a single condition:

{% capture snippet_filtering_simple %}{% include code/from-docs/concepts/queries/filtering-simple.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_filtering_simple | strip }}{% endhighlight %}

## Multiple Conditions

Chain multiple `where` clauses for AND logic:

{% capture snippet_filtering_multiple %}{% include code/from-docs/concepts/queries/filtering-multiple.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_filtering_multiple | strip }}{% endhighlight %}

## Parameterized Queries

Use parameters for dynamic filtering:

{% capture snippet_filtering_parameterized %}{% include code/from-docs/concepts/queries/filtering-parameterized.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_filtering_parameterized | strip }}{% endhighlight %}

## Notes

- `where` supports either a simple predicate `(item) => boolean` or a parameterized predicate `(item, params) => boolean` with a params object
- Multiple `where` clauses are combined with AND logic
- For OR logic, use a single `where` with `||` operators inside the predicate

## Related

- [Sorting Results](/concepts/queries/sorting/)
- [Pagination](/concepts/queries/pagination/)
- [Terminal Methods](/concepts/queries/terminal-methods/)
