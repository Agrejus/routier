---
title: Query Composer
layout: default
parent: Queries
nav_order: 7
permalink: /concepts/queries/query-composer/
---

# Query Composer

The Query Composer enables you to build reusable, parameterized queries that can be applied to collections later. This pattern is especially useful for creating query factories, sharing query logic across your application, and building complex queries with dynamic parameters.

## Quick Navigation

- [What is Query Composer?](#what-is-query-composer)
- [Why Use Query Composer?](#why-use-query-composer)
- [Basic Usage](#basic-usage)
- [Advanced Patterns](#advanced-patterns)
- [When to Use Query Composer](#when-to-use-query-composer)
- [Related Topics](#related-topics)

## What is Query Composer?

Query Composer is a way to build queries independently of a collection. Instead of starting from a collection and chaining operations, you compose a query using `Queryable.compose()` and then apply it to a collection when needed.

### The Problem It Solves

When building queries directly on collections, you must have the collection instance available:

```ts
// Direct query - requires collection instance
const products = await dataStore.products
  .where(([p, params]) => p.category === params.category, {
    category: "electronics",
  })
  .where(([p, params]) => p.price >= params.minPrice, { minPrice: 100 })
  .toArrayAsync();
```

This works well for one-off queries, but becomes limiting when you want to:

- **Reuse query logic** across different parts of your application
- **Create query factories** that generate queries based on parameters
- **Share query definitions** without executing them immediately
- **Build queries conditionally** before knowing which collection to use

### The Solution

Query Composer separates query building from query execution:

```ts
// Compose a query independently
const filterByCategoryAndPrice = (params: {
  category: string;
  minPrice: number;
}) =>
  Queryable.compose(dataStore.products.schema)
    .where(([x, p]) => x.category === p.category, params)
    .where(([x, p]) => x.price >= p.minPrice, params);

// Apply it later to a collection
const results = await dataStore.products
  .apply(filterByCategoryAndPrice({ category: "electronics", minPrice: 100 }))
  .toArrayAsync();
```

**Note**: You can import schemas directly instead of accessing them from the data store. This makes your query composers completely independent:

```ts
// Import the schema directly
import { productsSchema } from "./schemas/product";

// Compose queries without needing a data store instance
const filterByCategory = (category: string) =>
  Queryable.compose(productsSchema).where(
    ([x, p]) => x.category === p.category,
    { category }
  );

// Use it with any collection that uses this schema
const results = await dataStore.products
  .apply(filterByCategory("electronics"))
  .toArrayAsync();
```

This pattern is especially useful when:

- Building query libraries in separate modules
- Creating reusable query utilities
- Testing queries independently of data store instances

## Why Use Query Composer?

### 1. Reusable Query Logic

Create query factories that can be reused throughout your application:

```ts
// Define once, use anywhere
const createProductFilter = (params: { category: string; inStock: boolean }) =>
  Queryable.compose(productSchema)
    .where(([x, p]) => x.category === p.category, params)
    .where(([x, p]) => x.inStock === p.inStock, params)
    .sort((x) => x.price);

// Use in multiple places
const electronics = await dataStore.products
  .apply(createProductFilter({ category: "electronics", inStock: true }))
  .toArrayAsync();

const accessories = await dataStore.products
  .apply(createProductFilter({ category: "accessories", inStock: true }))
  .toArrayAsync();
```

### 2. Separation of Concerns

Separate query definition from query execution. Import schemas directly to make queries completely independent:

```ts
// schemas/product.ts - Export your schema
export const productsSchema = s
  .define("products", {
    name: s.string(),
    price: s.number(),
    category: s.string(),
    inStock: s.boolean(),
  })
  .compile();

// queries/productQueries.ts - Import schema and define queries
import { productsSchema } from "../schemas/product";

export const productQueries = {
  byCategory: (category: string) =>
    Queryable.compose(productsSchema).where(
      ([x, p]) => x.category === p.category,
      { category }
    ),

  expensive: (minPrice: number) =>
    Queryable.compose(productsSchema)
      .where(([x, p]) => x.price >= p.minPrice, { minPrice })
      .sortDescending((x) => x.price),

  inStock: () =>
    Queryable.compose(productsSchema).where((x) => x.inStock === true),
};

// app.ts - Use queries with your data store
import { productQueries } from "./queries/productQueries";

const electronics = await dataStore.products
  .apply(productQueries.byCategory("electronics"))
  .toArrayAsync();
```

### 3. Complex Query Building

Build complex queries with multiple parameters and operations:

```ts
const createAdvancedFilter = (params: {
  category: string;
  minPrice: number;
  maxPrice: number;
  inStock: boolean;
}) =>
  Queryable.compose(productSchema)
    .where(([x, p]) => x.category === p.category, params)
    .where(([x, p]) => x.price >= p.minPrice && x.price <= p.maxPrice, params)
    .where(([x, p]) => x.inStock === p.inStock, params)
    .sort((x) => x.price)
    .take(10);

const results = await dataStore.products
  .apply(
    createAdvancedFilter({
      category: "electronics",
      minPrice: 100,
      maxPrice: 500,
      inStock: true,
    })
  )
  .toArrayAsync();
```

## Basic Usage

### Creating a Simple Composer

Start with `Queryable.compose()` and pass the schema. You can access the schema from the data store or import it directly:

```ts
// Option 1: Access schema from data store
const filterByName = (params: { name: string }) =>
  Queryable.compose(dataStore.products.schema).where(
    ([x, p]) => x.name === p.name,
    params
  );

// Option 2: Import schema directly (recommended for reusable queries)
import { productsSchema } from "./schemas/product";

const filterByName = (params: { name: string }) =>
  Queryable.compose(productsSchema).where(
    ([x, p]) => x.name === p.name,
    params
  );

// Apply to collection
const result = await dataStore.products
  .apply(filterByName({ name: "Laptop" }))
  .firstOrUndefinedAsync();
```

### Chaining Operations

Composers support all standard query operations:

```ts
const complexQuery = (params: { category: string; minPrice: number }) =>
  Queryable.compose(dataStore.products.schema)
    .where(([x, p]) => x.category === p.category, params)
    .where(([x, p]) => x.price >= p.minPrice, params)
    .sort((x) => x.price)
    .take(5);

const results = await dataStore.products
  .apply(complexQuery({ category: "electronics", minPrice: 100 }))
  .toArrayAsync();
```

### Using with Pagination

Composers work seamlessly with pagination:

```ts
const createPaginatedQuery = (params: {
  category: string;
  page: number;
  pageSize: number;
}) =>
  Queryable.compose(dataStore.products.schema)
    .where(([x, p]) => x.category === p.category, params)
    .skip(params.page * params.pageSize)
    .take(params.pageSize)
    .sort((x) => x.name);

const page1 = await dataStore.products
  .apply(
    createPaginatedQuery({ category: "electronics", page: 0, pageSize: 10 })
  )
  .toArrayAsync();
```

## Advanced Patterns

### Query Factories

Create factories that generate queries based on different criteria:

```ts
class ProductQueryFactory {
  static byCategory(category: string) {
    return Queryable.compose(productSchema).where(
      ([x, p]) => x.category === p.category,
      { category }
    );
  }

  static byPriceRange(minPrice: number, maxPrice: number) {
    return Queryable.compose(productSchema).where(
      ([x, p]) => x.price >= p.minPrice && x.price <= p.maxPrice,
      {
        minPrice,
        maxPrice,
      }
    );
  }

  static inStock() {
    return Queryable.compose(productSchema).where((x) => x.inStock === true);
  }

  static topExpensive(limit: number) {
    return Queryable.compose(productSchema)
      .sortDescending((x) => x.price)
      .take(limit);
  }
}

// Usage
const electronics = await dataStore.products
  .apply(ProductQueryFactory.byCategory("electronics"))
  .toArrayAsync();

const top10 = await dataStore.products
  .apply(ProductQueryFactory.topExpensive(10))
  .toArrayAsync();
```

### Conditional Query Building

Build queries conditionally based on runtime conditions:

```ts
const buildSearchQuery = (searchParams: {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
}) => {
  let query = Queryable.compose(productSchema);

  if (searchParams.category) {
    query = query.where(([x, p]) => x.category === p.category, searchParams);
  }

  if (searchParams.minPrice !== undefined) {
    query = query.where(([x, p]) => x.price >= p.minPrice, searchParams);
  }

  if (searchParams.maxPrice !== undefined) {
    query = query.where(([x, p]) => x.price <= p.maxPrice, searchParams);
  }

  if (searchParams.inStock !== undefined) {
    query = query.where(([x, p]) => x.inStock === p.inStock, searchParams);
  }

  return query.sort((x) => x.name);
};

const results = await dataStore.products
  .apply(
    buildSearchQuery({
      category: "electronics",
      minPrice: 100,
      inStock: true,
    })
  )
  .toArrayAsync();
```

### Combining Composers with Additional Operations

You can apply a composer and then chain additional operations:

```ts
const baseQuery = (params: { category: string }) =>
  Queryable.compose(productSchema).where(
    ([x, p]) => x.category === p.category,
    params
  );

// Apply composer, then add more operations
const results = await dataStore.products
  .apply(baseQuery({ category: "electronics" }))
  .where((x) => x.inStock === true) // Additional filter
  .sort((x) => x.price)
  .take(10)
  .toArrayAsync();
```

## When to Use Query Composer

### Use Query Composer When:

✅ **You need reusable query logic** across multiple parts of your application  
✅ **You want to create query factories** for common query patterns  
✅ **You're building queries conditionally** based on user input or application state  
✅ **You want to separate query definition from execution** for better code organization  
✅ **You're creating query libraries** or shared query utilities

### Use Direct Queries When:

✅ **The query is simple and one-off**  
✅ **You don't need to reuse the query logic**  
✅ **The query is tightly coupled to a specific collection instance**  
✅ **You prefer the simpler, more direct syntax**

## Key Differences from Direct Queries

| Aspect               | Direct Queries                          | Query Composer                                             |
| -------------------- | --------------------------------------- | ---------------------------------------------------------- |
| **Starting Point**   | Collection instance                     | Schema                                                     |
| **Query Building**   | Built inline on collection              | Built separately, then applied via `.apply()`              |
| **Execution**        | Executes when terminal method is called | Executes when terminal method is called (after `.apply()`) |
| **Reusability**      | Limited to collection instance          | Can be reused across collections                           |
| **Parameterization** | Inline with query                       | Encapsulated in composer function                          |
| **Use Case**         | One-off queries                         | Reusable query patterns                                    |

## Best Practices

### 1. Use Descriptive Function Names

```ts
// ✅ Good - clear intent
const filterExpensiveElectronics = (minPrice: number) =>
  Queryable.compose(productSchema)
    .where(([x, p]) => x.category === "electronics", {})
    .where(([x, p]) => x.price >= p.minPrice, { minPrice });

// ❌ Bad - unclear purpose
const q1 = (p: number) => Queryable.compose(productSchema).where(...);
```

### 2. Group Related Queries

```ts
// ✅ Good - organized query module
export const productQueries = {
  byCategory: (category: string) => ...,
  byPriceRange: (min: number, max: number) => ...,
  inStock: () => ...,
  topRated: (limit: number) => ...
};
```

### 3. Type Your Parameters

```ts
// ✅ Good - explicit types
const filterProducts = (params: {
  category: string;
  minPrice: number;
  inStock: boolean;
}) => Queryable.compose(productSchema)...
```

### 4. Keep Composers Focused

```ts
// ✅ Good - single responsibility
const filterByCategory = (category: string) => ...;
const filterByPrice = (minPrice: number) => ...;

// ❌ Bad - too many responsibilities
const doEverything = (params: {...}) => ...;
```

## Related Topics

- [Filtering Data](/concepts/queries/filtering/) - Learn about parameterized queries
- [Query Architecture](/concepts/query-architecture/) - Understand how queries work internally
- [Sorting Results](/concepts/queries/sorting/) - Learn about sorting operations
- [Pagination](/concepts/queries/pagination/) - Learn about pagination patterns
