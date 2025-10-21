---
title: Aggregation
layout: default
parent: Queries
nav_order: 5
permalink: /concepts/queries/aggregation/
---

# Aggregation Operations

Perform calculations on your data with aggregation methods like `sum`, `min`, `max`, `count`, and `distinct`.

## Quick Reference

| Method                  | Description              | Example                                         |
| ----------------------- | ------------------------ | ----------------------------------------------- |
| `countAsync()`          | Count total items        | `await ctx.products.countAsync()`               |
| `sumAsync(field)`       | Sum numeric field        | `await ctx.products.sumAsync(p => p.price)`     |
| `minAsync(field)`       | Get minimum value        | `await ctx.products.minAsync(p => p.price)`     |
| `maxAsync(field)`       | Get maximum value        | `await ctx.products.maxAsync(p => p.price)`     |
| `distinctAsync()`       | Get unique values        | `await ctx.products.distinctAsync()`            |
| `someAsync()`           | Check if any items exist | `await ctx.products.someAsync()`                |
| `everyAsync(predicate)` | Check if all items match | `await ctx.products.everyAsync(p => p.inStock)` |

## Detailed Examples

### Counting Items

```ts
// Count all products
const totalCount = await ctx.products.countAsync();

// Count products in specific category
const electronicsCount = await ctx.products
  .where((p) => p.category === "electronics")
  .countAsync();

// Count products in stock
const inStockCount = await ctx.products
  .where((p) => p.inStock === true)
  .countAsync();
```

### Sum Operations

```ts
// Sum all product prices
const totalValue = await ctx.products.sumAsync((p) => p.price);

// Sum prices of electronics only
const electronicsTotal = await ctx.products
  .where((p) => p.category === "electronics")
  .sumAsync((p) => p.price);

// Sum prices of in-stock products
const inStockValue = await ctx.products
  .where((p) => p.inStock === true)
  .sumAsync((p) => p.price);
```

### Min and Max Operations

```ts
// Get minimum price
const minPrice = await ctx.products.minAsync((p) => p.price);

// Get maximum price
const maxPrice = await ctx.products.maxAsync((p) => p.price);

// Get minimum price of electronics
const minElectronicsPrice = await ctx.products
  .where((p) => p.category === "electronics")
  .minAsync((p) => p.price);

// Get maximum price of in-stock products
const maxInStockPrice = await ctx.products
  .where((p) => p.inStock === true)
  .maxAsync((p) => p.price);
```

### Distinct Values

```ts
// Get unique categories
const uniqueCategories = await ctx.products
  .map((p) => p.category)
  .distinctAsync();

// Get unique prices
const uniquePrices = await ctx.products.map((p) => p.price).distinctAsync();

// Get unique product names
const uniqueNames = await ctx.products.map((p) => p.name).distinctAsync();
```

### Boolean Operations

```ts
// Check if any products exist
const hasProducts = await ctx.products.someAsync();

// Check if any expensive products exist
const hasExpensiveProducts = await ctx.products
  .where((p) => p.price > 1000)
  .someAsync();

// Check if all products are in stock
const allInStock = await ctx.products.everyAsync((p) => p.inStock);

// Check if all electronics are in stock
const allElectronicsInStock = await ctx.products
  .where((p) => p.category === "electronics")
  .everyAsync((p) => p.inStock === true);
```

### Complex Aggregations

```ts
// Get statistics for electronics
const electronicsStats = {
  count: await ctx.products
    .where((p) => p.category === "electronics")
    .countAsync(),
  totalValue: await ctx.products
    .where((p) => p.category === "electronics")
    .sumAsync((p) => p.price),
  minPrice: await ctx.products
    .where((p) => p.category === "electronics")
    .minAsync((p) => p.price),
  maxPrice: await ctx.products
    .where((p) => p.category === "electronics")
    .maxAsync((p) => p.price),
};

// Get average price (sum / count)
const totalValue = await ctx.products.sumAsync((p) => p.price);
const totalCount = await ctx.products.countAsync();
const averagePrice = totalValue / totalCount;
```

## Common Patterns

### Inventory Management

```ts
// Get inventory summary
const inventorySummary = {
  totalProducts: await ctx.products.countAsync(),
  inStockProducts: await ctx.products
    .where((p) => p.inStock === true)
    .countAsync(),
  totalValue: await ctx.products
    .where((p) => p.inStock === true)
    .sumAsync((p) => p.price),
  categories: await ctx.products.map((p) => p.category).distinctAsync(),
};
```

### Price Analysis

```ts
// Analyze price ranges
const priceAnalysis = {
  minPrice: await ctx.products.minAsync((p) => p.price),
  maxPrice: await ctx.products.maxAsync((p) => p.price),
  totalValue: await ctx.products.sumAsync((p) => p.price),
  expensiveProducts: await ctx.products
    .where((p) => p.price > 100)
    .countAsync(),
};
```

### Category Analysis

```ts
// Analyze by category
const categoryAnalysis = await Promise.all(
  categories.map(async (category) => ({
    category,
    count: await ctx.products
      .where((p) => p.category === category)
      .countAsync(),
    totalValue: await ctx.products
      .where((p) => p.category === category)
      .sumAsync((p) => p.price),
  }))
);
```

## Performance Tips

### Efficient Aggregation

- **Filter first**: Apply `where` clauses before aggregation to reduce data
- **Use appropriate methods**: Choose the right aggregation method for your needs
- **Batch operations**: Combine multiple aggregations when possible

### Memory Considerations

```ts
// Good: Filter before aggregation
const expensiveCount = await ctx.products
  .where((p) => p.price > 100)
  .countAsync();

// Less efficient: Load all data then filter
const allProducts = await ctx.products.toArrayAsync();
const expensiveCount = allProducts.filter((p) => p.price > 100).length;
```

## Related Topics

- [Filtering Data](/concepts/queries/filtering/) - Filter before aggregating
- [Field Selection](/concepts/queries/field-selection/) - Transform data before aggregation
- [Terminal Methods](/concepts/queries/terminal-methods/) - All query execution methods
