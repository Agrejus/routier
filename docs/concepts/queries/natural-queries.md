---
title: Natural Queries
layout: default
parent: Queries
grand_parent: Concepts
nav_order: 1
---

# Natural Queries

Routier provides a natural, fluent query API that makes data retrieval intuitive and powerful. All queries are performed through a collection.

## Basic Querying

{% capture snippet_cohq0u %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_cohq0u  | strip }}{% endhighlight %}

Queries always start from a collection:

{% capture snippet_25zqea %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_25zqea  | strip }}{% endhighlight %}

## Filtering with Where

{% capture snippet_odc3mc %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_odc3mc  | strip }}{% endhighlight %}

### Parameterized queries

When compiling to a JavaScript filter function, free variables cannot be evaluated. Inject values via parameters to avoid full collection scans:

{% capture snippet_yh53h9 %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_yh53h9  | strip }}{% endhighlight %}

### Expression parsing and fallback behavior

Routier's expression parser is extremely robust and handles a wide variety of JavaScript expressions including comparisons, string methods, array operations, logical operators, and parameterized queries. The parser attempts to convert these expressions into database-optimized queries for maximum performance.

When an expression cannot be parsed (returns `NOT_PARSABLE`), Routier falls back to selecting all data from the collection and running the query in memory. This fallback ensures your queries always work, but may impact performance on large datasets. Use parameterized queries and avoid complex expressions that cannot be parsed to maintain optimal performance.

## Sorting

{% capture snippet_9ex9mv %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_9ex9mv  | strip }}{% endhighlight %}

## Mapping and Transformation

{% capture snippet_biz3yl %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_biz3yl  | strip }}{% endhighlight %}

## Aggregation

{% capture snippet_2o2ifg %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_2o2ifg  | strip }}{% endhighlight %}

## Pagination

{% capture snippet_ia3pbi %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_ia3pbi  | strip }}{% endhighlight %}

## Chaining Queries

{% capture snippet_sxpk65 %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_sxpk65  | strip }}{% endhighlight %}

## Next Steps

- [Expressions](/concepts/queries/expressions/) - Advanced filtering expressions
- [Query Options](/concepts/queries/query-options/) - Available query options
- [Performance Optimization](/concepts/data-pipeline/performance-optimization.md) - Optimizing query performance
