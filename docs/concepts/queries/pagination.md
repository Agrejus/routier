---
title: Pagination
layout: default
parent: Queries
nav_order: 4
permalink: /concepts/queries/pagination/
---

# Pagination

Use `take` and `skip` to implement pagination for large datasets.

## Quick Navigation

- [Basic Pagination](#basic-pagination)
- [Simple Take and Skip](#simple-take-and-skip)
- [Pagination with Filtering](#pagination-with-filtering)
- [Pagination with Sorting](#pagination-with-sorting)
- [Related](#related)

## Basic Pagination

Implement page-based pagination:

{% capture snippet_pagination_example %}{% include code/from-docs/concepts/queries/pagination-example.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_pagination_example | strip }}{% endhighlight %}

## Simple Take and Skip

```ts
// Get first 10 items
const firstPage = await dataStore.products.take(10).toArrayAsync();

// Skip first 10, get next 10
const secondPage = await dataStore.products.skip(10).take(10).toArrayAsync();
```

## Pagination with Filtering

Paginate filtered results:

```ts
const expensiveProductsPage = await dataStore.products
  .where((p) => p.price > 100)
  .sort((p) => p.price)
  .skip(20)
  .take(10)
  .toArrayAsync();
```

## Pagination with Sorting

Paginate sorted results:

```ts
const sortedProductsPage = await dataStore.products
  .sortDescending((p) => p.price)
  .skip(0)
  .take(5)
  .toArrayAsync();
```

## Related

- [Filtering Data](/concepts/queries/filtering/)
- [Sorting Results](/concepts/queries/sorting/)
- [Terminal Methods](/concepts/queries/terminal-methods/)
