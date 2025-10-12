---
title: Aggregation
layout: default
parent: Queries
nav_order: 5
permalink: /concepts/queries/aggregation/
---

# Aggregation Operations

Perform calculations on your data with aggregation methods like `sum`, `min`, `max`, `count`, and `distinct`.

## Basic Aggregation

Perform calculations on your data:

{% capture snippet_aggregation_basic %}{% include code/from-docs/concepts/queries/aggregation-basic.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_aggregation_basic | strip }}{% endhighlight %}

## Aggregation with Filtering

Calculate values on filtered data:

```ts
// Count products in stock
const inStockCount = await dataStore.products
  .where((p) => p.inStock === true)
  .countAsync();

// Sum prices of electronics
const electronicsTotal = await dataStore.products
  .where((p) => p.category === "electronics")
  .sumAsync((p) => p.price);
```

## Distinct Values

Get unique values:

```ts
// Get unique categories
const uniqueCategories = await dataStore.products
  .map((p) => p.category)
  .distinctAsync();

// Get unique prices
const uniquePrices = await dataStore.products
  .map((p) => p.price)
  .distinctAsync();
```

## Boolean Operations

Check conditions across your data:

```ts
// Check if any expensive products exist
const hasExpensiveProducts = await dataStore.products
  .where((p) => p.price > 1000)
  .someAsync();

// Check if all electronics are in stock
const allElectronicsInStock = await dataStore.products
  .where((p) => p.category === "electronics")
  .everyAsync((p) => p.inStock === true);
```

## Related

- [Filtering Data](/concepts/queries/filtering/)
- [Field Selection](/concepts/queries/field-selection/)
- [Terminal Methods](/concepts/queries/terminal-methods/)
