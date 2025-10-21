---
title: Queries
layout: default
parent: Concepts
nav_order: 2
has_children: true
permalink: /concepts/queries/
---

# Queries

Routier queries are fluent and can only be performed through a collection. Build your query by chaining operations and finish with a terminal method to execute.

## Quick Reference

### Terminal Methods (Query Execution)

| Method                    | Description                     | Example                                      |
| ------------------------- | ------------------------------- | -------------------------------------------- |
| `toArrayAsync()`          | Get all results as an array     | `await ctx.products.toArrayAsync()`          |
| `firstAsync()`            | Get first item (throws if none) | `await ctx.products.firstAsync()`            |
| `firstOrUndefinedAsync()` | Get first item or undefined     | `await ctx.products.firstOrUndefinedAsync()` |
| `someAsync()`             | Check if any items exist        | `await ctx.products.someAsync()`             |
| `countAsync()`            | Count total items               | `await ctx.products.countAsync()`            |
| `sumAsync(field)`         | Sum numeric field               | `await ctx.products.sumAsync(p => p.price)`  |
| `minAsync(field)`         | Get minimum value               | `await ctx.products.minAsync(p => p.price)`  |
| `maxAsync(field)`         | Get maximum value               | `await ctx.products.maxAsync(p => p.price)`  |
| `distinctAsync()`         | Get unique values               | `await ctx.products.distinctAsync()`         |

### Query Operations (Chaining)

| Method                     | Description             | Example                                                     |
| -------------------------- | ----------------------- | ----------------------------------------------------------- |
| `where(predicate)`         | Filter results          | `ctx.products.where(p => p.price > 100)`                    |
| `orderBy(field)`           | Sort ascending          | `ctx.products.orderBy(p => p.name)`                         |
| `orderByDescending(field)` | Sort descending         | `ctx.products.orderByDescending(p => p.price)`              |
| `map(selector)`            | Transform/select fields | `ctx.products.map(p => ({ name: p.name, price: p.price }))` |
| `skip(count)`              | Skip first N items      | `ctx.products.skip(10)`                                     |
| `take(count)`              | Take first N items      | `ctx.products.take(5)`                                      |

## Detailed Examples

### Getting All Results

```ts
// Get all products
const allProducts = await ctx.products.toArrayAsync();
```

### Getting Single Items

```ts
// Get first product (throws if none exist)
const firstProduct = await ctx.products.firstAsync();

// Get first product or undefined if none exist
const firstOrUndefined = await ctx.products.firstOrUndefinedAsync();
```

### Checking Existence

```ts
// Check if any products exist
const hasProducts = await ctx.products.someAsync();

// Check if all products are in stock
const allInStock = await ctx.products.everyAsync((p) => p.inStock);
```

### Counting Items

```ts
// Count total products
const totalCount = await ctx.products.countAsync();

// Count products in specific category
const electronicsCount = await ctx.products
  .where((p) => p.category === "electronics")
  .countAsync();
```

### Filtering Data

```ts
// Simple filtering
const expensiveProducts = await ctx.products
  .where((p) => p.price > 100)
  .toArrayAsync();

// Multiple filters
const activeElectronics = await ctx.products
  .where((p) => p.category === "electronics")
  .where((p) => p.inStock === true)
  .toArrayAsync();

// Parameterized filtering
const productsInRange = await ctx.products
  .where((p, params) => p.price >= params.min && p.price <= params.max, {
    min: 50,
    max: 200,
  })
  .toArrayAsync();
```

### Sorting Results

```ts
// Sort by price (ascending)
const productsByPrice = await ctx.products
  .orderBy((p) => p.price)
  .toArrayAsync();

// Sort by price (descending)
const expensiveFirst = await ctx.products
  .orderByDescending((p) => p.price)
  .toArrayAsync();

// Multiple sort criteria
const sortedProducts = await ctx.products
  .orderBy((p) => p.category)
  .orderBy((p) => p.name)
  .toArrayAsync();
```

### Field Selection and Transformation

```ts
// Select specific fields
const productSummaries = await ctx.products
  .map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price,
  }))
  .toArrayAsync();

// Create computed fields
const productsWithTax = await ctx.products
  .map((p) => ({
    ...p,
    priceWithTax: p.price * 1.1,
  }))
  .toArrayAsync();
```

### Pagination

```ts
// Get first 10 products
const firstPage = await ctx.products.take(10).toArrayAsync();

// Get second page (skip first 10, take next 10)
const secondPage = await ctx.products.skip(10).take(10).toArrayAsync();

// Pagination helper
const pageSize = 10;
const pageNumber = 2; // 0-based
const page = await ctx.products
  .skip(pageSize * pageNumber)
  .take(pageSize)
  .toArrayAsync();
```

### Aggregation Operations

```ts
// Sum prices of in-stock products
const totalValue = await ctx.products
  .where((p) => p.inStock === true)
  .sumAsync((p) => p.price);

// Get minimum and maximum prices
const minPrice = await ctx.products.minAsync((p) => p.price);
const maxPrice = await ctx.products.maxAsync((p) => p.price);

// Get distinct categories
const categories = await ctx.products.map((p) => p.category).distinctAsync();
```

### Complex Queries

```ts
// Complex query with multiple operations
const topExpensiveElectronics = await ctx.products
  .where((p) => p.category === "electronics")
  .where((p) => p.inStock === true)
  .orderByDescending((p) => p.price)
  .take(5)
  .map((p) => ({
    name: p.name,
    price: p.price,
    priceWithTax: p.price * 1.1,
  }))
  .toArrayAsync();
```

## Key Concepts

### Query Execution

- **Lazy evaluation**: Queries don't execute until you call a terminal method
- **Chaining**: You can chain multiple operations together
- **Collection-based**: All queries must start with a collection

### Performance Tips

- **Database filters first**: Apply `where` clauses on database fields before computed fields
- **Limit results**: Use `take()` to limit large result sets
- **Efficient pagination**: Use `skip()` and `take()` for pagination

### Computed Properties

When filtering on computed properties (not stored in database), the filter runs in memory:

```ts
// Good: Database-backed filter first
const expensiveElectronics = await ctx.products
  .where((p) => p.category === "electronics") // Database filter
  .where((p) => p.isExpensive === true) // Computed filter
  .toArrayAsync();

// Less efficient: Computed filter first
const allExpensive = await ctx.products
  .where((p) => p.isExpensive === true) // Loads all records
  .where((p) => p.category === "electronics") // Then filters
  .toArrayAsync();
```

## Related Topics

- [Filtering](/concepts/queries/filtering/) - Detailed filtering examples
- [Sorting](/concepts/queries/sorting/) - Advanced sorting techniques
- [Field Selection](/concepts/queries/field-selection/) - Data transformation
- [Pagination](/concepts/queries/pagination/) - Pagination strategies
- [Aggregation](/concepts/queries/aggregation/) - Aggregation operations
- [Terminal Methods](/concepts/queries/terminal-methods/) - Query execution methods
