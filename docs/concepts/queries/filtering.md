---
title: Filtering
layout: default
parent: Queries
nav_order: 1
permalink: /concepts/queries/filtering/
---

# Filtering Data

Filter your data with `where` clauses to find exactly what you need.

## Quick Navigation

- [Simple Filtering](#simple-filtering)
- [Multiple Conditions](#multiple-conditions)
- [Parameterized Queries](#parameterized-queries)
- [Notes](#notes)
- [Related](#related)

## Simple Filtering

Filter by a single condition:

{% capture snippet_filtering_simple %}{% include code/from-docs/concepts/queries/filtering-simple.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_filtering_simple | strip }}{% endhighlight %}

## Multiple Conditions

Chain multiple `where` clauses for AND logic:

{% capture snippet_filtering_multiple %}{% include code/from-docs/concepts/queries/filtering-multiple.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_filtering_multiple | strip }}{% endhighlight %}

## Parameterized Queries

Use parameters for dynamic filtering with variables. This is **required** when you want to use variables in your query predicates.

### Why Parameterized Queries?

When you need to use variables in your query, you must use parameterized queries. Direct variable usage in predicates will still work, but Routier will fall back to selecting all records because it cannot evaluate the variable values:

```ts
// ⚠️ This works but selects ALL records first, then filters in memory - less efficient
const minPrice = 100;
const maxPrice = 500;
const products = await dataStore.products
  .where((p) => p.price >= minPrice && p.price <= maxPrice) // Selects all, filters in memory
  .toArrayAsync();
```

**Result**: You'll get the correct filtered results, but Routier will first load all records into memory, then apply the filter. This is less efficient than database-level filtering.

### How Parameterized Queries Work

Pass variables through a parameters object:

{% capture snippet_filtering_parameterized %}{% include code/from-docs/concepts/queries/filtering-parameterized.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_filtering_parameterized | strip }}{% endhighlight %}

### Common Use Cases

**Dynamic filtering based on user input:**

```ts
const searchTerm = "laptop";
const category = "electronics";
const minPrice = 100;

const results = await dataStore.products
  .where(
    ([p, params]) =>
      p.name.toLowerCase().includes(params.searchTerm.toLowerCase()) &&
      p.category === params.category &&
      p.price >= params.minPrice,
    { searchTerm, category, minPrice }
  )
  .toArrayAsync();
```

**Pagination with dynamic page size:**

```ts
const page = 2;
const pageSize = 20;
const offset = (page - 1) * pageSize;

const products = await dataStore.products
  .where(([p, params]) => p.inStock === true, {})
  .skip(offset)
  .take(pageSize)
  .toArrayAsync();
```

## Notes

- `where` supports either a simple predicate `(item) => boolean` or a parameterized predicate `(item, params) => boolean` with a params object
- **Use parameterized queries when you need variables** - non-parameterized queries with variables will select all records and filter in memory (less efficient)
- Multiple `where` clauses are combined with AND logic
- For OR logic, use a single `where` with `||` operators inside the predicate

## Related

- [Sorting Results](/concepts/queries/sorting/)
- [Pagination](/concepts/queries/pagination/)
- [Terminal Methods](/concepts/queries/terminal-methods/)
