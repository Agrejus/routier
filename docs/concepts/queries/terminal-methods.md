---
title: Terminal Methods
layout: default
parent: Queries
nav_order: 6
permalink: /concepts/queries/terminal-methods/
---

# Terminal Methods

All queries must end with a terminal method to execute. These methods actually perform the query and return results.

## Quick Navigation

- [Quick Reference](#quick-reference)
- [Detailed Examples](#detailed-examples)
- [Important Notes](#important-notes)
- [Common Patterns](#common-patterns)
- [Related Topics](#related-topics)

## Quick Reference

| Method                    | Description                     | Example                                         |
| ------------------------- | ------------------------------- | ----------------------------------------------- |
| `toArrayAsync()`          | Get all results as an array     | `await ctx.products.toArrayAsync()`             |
| `firstAsync()`            | Get first item (throws if none) | `await ctx.products.firstAsync()`               |
| `firstOrUndefinedAsync()` | Get first item or undefined     | `await ctx.products.firstOrUndefinedAsync()`    |
| `someAsync()`             | Check if any items exist        | `await ctx.products.someAsync()`                |
| `everyAsync(predicate)`   | Check if all items match        | `await ctx.products.everyAsync(p => p.inStock)` |
| `countAsync()`            | Count total items               | `await ctx.products.countAsync()`               |
| `sumAsync(field)`         | Sum numeric field               | `await ctx.products.sumAsync(p => p.price)`     |
| `minAsync(field)`         | Get minimum value               | `await ctx.products.minAsync(p => p.price)`     |
| `maxAsync(field)`         | Get maximum value               | `await ctx.products.maxAsync(p => p.price)`     |
| `distinctAsync()`         | Get unique values               | `await ctx.products.distinctAsync()`            |
| `removeAsync()`           | Delete matching items           | `await ctx.products.removeAsync()`              |

## Detailed Examples

### Getting All Results

```ts
// Get all products
const allProducts = await ctx.products.toArrayAsync();

// Get all products with filtering
const expensiveProducts = await ctx.products
  .where((p) => p.price > 100)
  .toArrayAsync();
```

### Getting Single Items

```ts
// Get first product (throws if none exist)
const firstProduct = await ctx.products.firstAsync();

// Get first product or undefined if none exist
const firstOrUndefined = await ctx.products.firstOrUndefinedAsync();

// Get first expensive product
const firstExpensive = await ctx.products
  .where((p) => p.price > 100)
  .firstOrUndefinedAsync();
```

### Checking Existence

```ts
// Check if any products exist
const hasProducts = await ctx.products.someAsync();

// Check if any expensive products exist
const hasExpensiveProducts = await ctx.products
  .where((p) => p.price > 100)
  .someAsync();

// Check if all products are in stock
const allInStock = await ctx.products.everyAsync((p) => p.inStock);

// Check if all electronics are in stock
const allElectronicsInStock = await ctx.products
  .where((p) => p.category === "electronics")
  .everyAsync((p) => p.inStock);
```

### Counting Items

```ts
// Count all products
const totalCount = await ctx.products.countAsync();

// Count products in specific category
const electronicsCount = await ctx.products
  .where((p) => p.category === "electronics")
  .countAsync();

// Count expensive products
const expensiveCount = await ctx.products
  .where((p) => p.price > 100)
  .countAsync();
```

### Aggregation Operations

```ts
// Sum all product prices
const totalValue = await ctx.products.sumAsync((p) => p.price);

// Sum prices of electronics
const electronicsValue = await ctx.products
  .where((p) => p.category === "electronics")
  .sumAsync((p) => p.price);

// Get minimum price
const minPrice = await ctx.products.minAsync((p) => p.price);

// Get maximum price
const maxPrice = await ctx.products.maxAsync((p) => p.price);

// Get minimum price of electronics
const minElectronicsPrice = await ctx.products
  .where((p) => p.category === "electronics")
  .minAsync((p) => p.price);
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

### Removal Operations

```ts
// Remove all products
await ctx.products.removeAsync();

// Remove expensive products
await ctx.products.where((p) => p.price > 100).removeAsync();

// Remove products in specific category
await ctx.products.where((p) => p.category === "electronics").removeAsync();

// Remove out of stock products
await ctx.products.where((p) => p.inStock === false).removeAsync();
```

## Important Notes

### Lazy Evaluation

- Queries are **lazy** - nothing executes until you call a terminal method
- You can chain multiple operations before calling a terminal method
- The query is built up and executed only when the terminal method is called

### Async vs Callback Styles

Both async Promises and callback styles are supported:

```ts
// Async style (recommended)
const products = await ctx.products.toArrayAsync();

// Callback style
ctx.products.toArray((result) => {
  if (result.ok === "success") {
    console.log("Products:", result.data);
  } else {
    console.error("Error:", result.error);
  }
});
```

### Live Queries

For live results that update automatically, you can chain `.subscribe()` before a terminal method:

```ts
// Live query - will update when data changes
ctx.products
  .where((p) => p.price > 100)
  .subscribe()
  .toArrayAsync();
```

## Common Patterns

### Data Validation

```ts
// Check if user exists before creating
const userExists = await ctx.users.where((u) => u.email === email).someAsync();

if (userExists) {
  throw new Error("User already exists");
}
```

### Pagination with Count

```ts
// Get page data and total count
const pageSize = 10;
const page = 1;
const offset = (page - 1) * pageSize;

const [products, totalCount] = await Promise.all([
  ctx.products.skip(offset).take(pageSize).toArrayAsync(),
  ctx.products.countAsync(),
]);
```

### Conditional Operations

```ts
// Only proceed if data exists
const hasData = await ctx.products.someAsync();
if (hasData) {
  const firstProduct = await ctx.products.firstAsync();
  // Process first product
}
```

## Related Topics

- [Filtering Data](/concepts/queries/filtering/) - Filter before terminal methods
- [Sorting Results](/concepts/queries/sorting/) - Sort before terminal methods
- [Aggregation](/concepts/queries/aggregation/) - Aggregation terminal methods
