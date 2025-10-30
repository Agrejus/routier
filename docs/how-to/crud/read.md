---
title: Read Operations
layout: default
parent: CRUD
grand_parent: Data Operations
nav_order: 3
---

# Read Operations

Read operations in Routier provide powerful querying capabilities with a fluent, chainable API. The framework supports filtering, sorting, pagination, and aggregation operations.

## Quick Navigation

- [Overview](#overview)
- [Comprehensive Query Documentation](#comprehensive-query-documentation)
- [Key Concepts](#key-concepts)
- [Next Steps](#next-steps)

## Overview

Routier's read operations feature:

1. **Fluent query API** - Chain multiple operations together
2. **Type-safe queries** - Full TypeScript support
3. **Efficient filtering** - Database-level query optimization
4. **Flexible sorting** - Multiple sort criteria support
5. **Built-in aggregation** - Count, sum, min, max operations
6. **Pagination support** - Skip and take operations

## Comprehensive Query Documentation

For detailed information about read operations, including:

- **Basic querying** with `toArrayAsync()`, `firstAsync()`, `countAsync()`
- **Filtering** with `where()` clauses and parameterized queries
- **Sorting** with `orderBy()` and `orderByDescending()`
- **Field selection** with `map()` and `select()`
- **Pagination** with `skip()` and `take()`
- **Aggregation** operations like `sum()`, `min()`, `max()`, `distinct()`
- **Computed properties** and performance optimization
- **Terminal methods** and query execution

Please refer to the comprehensive [Queries documentation](../../concepts/queries/) which covers all aspects of querying in Routier with detailed examples and best practices.

## Key Concepts

### Query Execution

All queries must end with a terminal method to execute:

- `toArrayAsync()` - return all results
- `firstAsync()` - first item, throws if none
- `firstOrUndefinedAsync()` - first item or undefined
- `someAsync()` - any match
- `countAsync()` - count of items
- `sumAsync()`, `minAsync()`, `maxAsync()` - aggregations

### Query Chaining

Queries are lazy and chainable - nothing executes until you call a terminal method:

```ts
// This query chain doesn't execute until toArrayAsync() is called
const results = await dataStore.products
  .where((p) => p.price > 100)
  .sort((p) => p.name)
  .skip(10)
  .take(5)
  .toArrayAsync();
```

### Performance Considerations

- Apply database-backed filters first, then computed/unmapped filters
- Use appropriate terminal methods for your use case
- Consider pagination for large datasets

## Next Steps

- [Data Manipulation](../../guides/data-manipulation) - Learn about proxy-based updates and array/object manipulation
- [Queries Documentation](../../concepts/queries/) - Comprehensive querying guide with examples
- [Create Operations](create.md) - Learn how to add new entities
- [Update Operations](update.md) - Learn how to modify existing entities
- [Delete Operations](delete.md) - Learn how to remove entities
- [Bulk Operations](bulk/README.md) - Learn how to handle multiple entities efficiently
