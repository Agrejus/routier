---
title: Data Manipulation
layout: default
parent: Guides
nav_order: 4
---

## Data Manipulation

Practical recipes for transforming, joining, and filtering data in your Routier collections.

## Overview

Data manipulation guides you through practical recipes for working with your Routier collections:

- **Transformation**: Reshape and transform entities using `map()` to project specific fields
- **Filtering**: Narrow down results with `where()` clauses and parameterized queries
- **Aggregation**: Perform calculations with `sum()`, `count()`, `min()`, `max()` methods
- **Sorting**: Organize data with `orderBy()` and `orderByDescending()`
- **Field Selection**: Reduce data transfer by selecting only needed properties

## Quick Reference

All data manipulation operations are built into the query API. Here are common patterns:

```ts
// Transform data - reshape entities
const summaries = await ctx.products
  .map((p) => ({ name: p.name, price: p.price }))
  .toArrayAsync();

// Aggregate data - calculate totals
const total = await ctx.products
  .where((p) => p.inStock)
  .sumAsync((p) => p.price);

// Combine operations - filter, sort, and transform
const results = await ctx.products
  .where((p) => p.category === "electronics")
  .orderBy((p) => p.price)
  .map((p) => ({ id: p.id, name: p.name }))
  .toArrayAsync();
```

## Related Guides

- **[Queries Guide](/concepts/queries/)** - Comprehensive query documentation
- **[Field Selection](/concepts/queries/field-selection/)** - Data transformation techniques
- **[Filtering](/concepts/queries/filtering/)** - Advanced filtering patterns
- **[Aggregation](/concepts/queries/aggregation/)** - Aggregation operations
