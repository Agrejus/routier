---
title: Sorting
layout: default
parent: Queries
nav_order: 2
permalink: /concepts/queries/sorting/
---

# Sorting Results

Sort your data in ascending or descending order using `orderBy` and `orderByDescending`.

## Quick Navigation

- [Ascending Sort](#ascending-sort)
- [Descending Sort](#descending-sort)
- [Multiple Sort Criteria](#multiple-sort-criteria)
- [Combined with Filtering](#combined-with-filtering)
- [Related](#related)

## Ascending Sort

Sort data in ascending order:

{% capture snippet_sorting_ascending %}{% include code/from-docs/concepts/queries/sorting-ascending.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_sorting_ascending | strip }}{% endhighlight %}

## Descending Sort

Sort data in descending order:

{% capture snippet_sorting_descending %}{% include code/from-docs/concepts/queries/sorting-descending.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_sorting_descending | strip }}{% endhighlight %}

## Multiple Sort Criteria

Chain multiple sort operations for complex sorting:

```ts
// Sort by category first, then by price
const productsByCategoryAndPrice = await dataStore.products
  .orderBy((p) => p.category)
  .orderBy((p) => p.price)
  .toArrayAsync();
```

## Combined with Filtering

Sort filtered results:

```ts
const expensiveProductsSorted = await dataStore.products
  .where((p) => p.price > 100)
  .orderByDescending((p) => p.price)
  .toArrayAsync();
```

## Related

- [Filtering Data](/concepts/queries/filtering/)
- [Pagination](/concepts/queries/pagination/)
- [Terminal Methods](/concepts/queries/terminal-methods/)
