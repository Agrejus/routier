---
title: Natural Queries
layout: default
parent: Queries
grand_parent: Concepts
nav_order: 1
---

# Natural Queries

Routier provides a natural, fluent query API that makes data retrieval intuitive and powerful. All queries are performed through a collection.

## Quick Navigation

- [Basic Querying](#basic-querying)
- [Filtering with Where](#filtering-with-where)
- [Sorting](#sorting)
- [Mapping and Transformation](#mapping-and-transformation)
- [Aggregation](#aggregation)
- [Pagination](#pagination)
- [Chaining Queries](#chaining-queries)
- [Next Steps](#next-steps)

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

Routier transforms JavaScript queries into agnostic expressions that plugins can translate into any query language. This architecture, inspired by [.NET Expression Trees](https://docs.microsoft.com/en-us/dotnet/csharp/expression-trees), enables powerful cross-platform querying.

#### How Expression Trees Work

Expression trees represent code as data structures rather than executable code. In Routier, when you write:

```ts
dataStore.products.where((p) => p.price > 100 && p.category === "electronics");
```

Routier parses this into an abstract syntax tree (AST) that represents the logical structure:

```
OperatorExpression (&&)
├── left: ComparatorExpression (greater-than)
│   ├── left: PropertyExpression (p.price)
│   └── right: ValueExpression (100)
└── right: ComparatorExpression (equals)
    ├── left: PropertyExpression (p.category)
    └── right: ValueExpression ("electronics")
```

This tree structure allows Routier to:

- **Analyze** the query structure without executing it
- **Optimize** by reordering operations or combining filters
- **Translate** into different query languages (SQL, MongoDB, etc.)
- **Validate** query correctness before execution

#### Plugin Translation

Each storage plugin receives these expression trees and translates them into their native query language:

- **SQLite Plugin**: Converts `OperatorExpression` to SQL `AND`/`OR`, `ComparatorExpression` to SQL operators (`=`, `>`, `LIKE`, etc.)
- **Dexie Plugin**: Uses IndexedDB's native filtering with JavaScript functions
- **PouchDB Plugin**: Translates to PouchDB query functions and map/reduce operations
- **Memory Plugin**: Optimizes for in-memory filtering with direct JavaScript evaluation

This abstraction means you can write the same query syntax regardless of your underlying storage technology.

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
