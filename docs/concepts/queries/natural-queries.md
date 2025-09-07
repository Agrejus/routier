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

```ts
{
  {
    snippet_cohq0u | escape;
  }
}
```

Queries always start from a collection:

{% capture snippet_25zqea %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{
  {
    snippet_25zqea | escape;
  }
}
```

## Filtering with Where

{% capture snippet_odc3mc %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{
  {
    snippet_odc3mc | escape;
  }
}
```

### Parameterized queries

When compiling to a JavaScript filter function, free variables cannot be evaluated. Inject values via parameters to avoid full collection scans:

{% capture snippet_yh53h9 %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{
  {
    snippet_yh53h9 | escape;
  }
}
```

## Sorting

{% capture snippet_9ex9mv %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{
  {
    snippet_9ex9mv | escape;
  }
}
```

## Mapping and Transformation

{% capture snippet_biz3yl %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{
  {
    snippet_biz3yl | escape;
  }
}
```

## Aggregation

{% capture snippet_2o2ifg %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{
  {
    snippet_2o2ifg | escape;
  }
}
```

## Pagination

{% capture snippet_ia3pbi %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{
  {
    snippet_ia3pbi | escape;
  }
}
```

## Chaining Queries

{% capture snippet_sxpk65 %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{
  {
    snippet_sxpk65 | escape;
  }
}
```

## Next Steps

- [Expressions](/concepts/queries/expressions/) - Advanced filtering expressions
- [Query Options](/concepts/queries/query-options/) - Available query options
- [Performance Optimization](/concepts/data-pipeline/performance-optimization.md) - Optimizing query performance
