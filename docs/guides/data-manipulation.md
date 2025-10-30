---
title: Data Manipulation
layout: default
parent: Guides
nav_order: 4
---

## Data Manipulation

Practical recipes for transforming, updating, and working with data in your Routier collections.

## Quick Navigation

- [Overview](#overview)
- [Querying and Transforming Data](#querying-and-transforming-data)
- [Updating Entities with Proxies](#updating-entities-with-proxies)
- [How Proxies Work](#how-proxies-work)
- [Complete Example](#complete-example)
- [Related Guides](#related-guides)

## Overview

Data manipulation in Routier covers both querying your data and modifying it through proxy-based entities:

- **Querying**: Filter, sort, aggregate, and transform data with the fluent query API
- **Transforming**: Reshape entities using `map()` to project specific fields
- **Updating**: Modify entities using JavaScript proxies for automatic change tracking
- **Arrays & Objects**: Proper techniques for updating nested structures

## Querying and Transforming Data

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
  .sort((p) => p.price)
  .map((p) => ({ id: p.id, name: p.name }))
  .toArrayAsync();
```

## Updating Entities with Proxies

Entities returned from queries are **proxy objects** that automatically track changes. This means you update data by simply modifying properties—no manual update methods needed.

### How Proxies Work

JavaScript proxies intercept property assignments, allowing Routier to detect and track every change. When you modify an entity, the proxy:

1. Intercepts the property assignment
2. Records what changed
3. Marks the entity as dirty
4. Returns the operation as successful

This happens transparently—you write normal JavaScript code and Routier handles the tracking.

### Updating Simple Properties

Update properties directly:

```ts
const user = await ctx.users.firstOrUndefinedAsync((u) => u.id === "user-123");

if (user) {
  // Direct property updates - automatically tracked
  user.name = "John Smith";
  user.age = 31;
  user.email = "john@example.com";

  // Changes tracked, but not yet persisted
  await ctx.saveChangesAsync(); // Now saved to storage
}
```

### Updating Nested Objects

Nested objects are also proxied, so changes are tracked automatically:

```ts
const user = await ctx.users.firstOrUndefinedAsync((u) => u.id === "user-123");

if (user) {
  // Update nested address
  user.address.street = "789 Pine Street";
  user.address.city = "Metropolis";
  user.address.zipCode = "10001";

  // Update nested profile
  user.profile.bio = "Updated bio";
  user.profile.website = "https://johnsmith.com";

  // All nested changes are tracked
  await ctx.saveChangesAsync();
}
```

### Updating Arrays

Arrays require special handling. Here's what works and what doesn't:

#### ✅ Works: Mutating Arrays Directly

```ts
const user = await ctx.users.firstOrUndefinedAsync((u) => u.id === "user-123");

if (user) {
  // Add items to array
  user.tags.push("premium");
  user.tags.push("verified");

  // Remove items by replacing the array
  user.tags = user.tags.filter((tag) => tag !== "temporary");

  // Modify array elements
  if (user.orders.length > 0) {
    user.orders[0].status = "shipped";
    user.orders[0].trackingNumber = "TRK123456";
  }

  await ctx.saveChangesAsync();
}
```

#### ⚠️ Limitation: Replacing Entire Arrays

When you replace an entire array, the change is tracked:

```ts
// ✅ This works - replaces the entire array
user.preferences = ["dark-theme", "notifications", "analytics"];

// ❌ This doesn't work - doesn't track individual array mutations
// user.orders.pop(); // Not tracked
// user.orders[5] = newOrder; // Not tracked

// ✅ Instead, replace the array
user.orders = [...user.orders.slice(0, 5), newOrder, ...user.orders.slice(6)];
```

### What Works and What Doesn't

**✅ Works (Tracked):**

- Direct property assignment: `user.name = "John"`
- Nested property updates: `user.address.city = "NYC"`
- Array mutations: `user.tags.push("new")`
- Replacing arrays: `user.tags = ["new", "array"]`
- Updating array elements: `user.orders[0].status = "shipped"`

**❌ Doesn't Work (Not Tracked):**

- Array methods that don't mutate: `.filter()`, `.map()`, `.slice()` (unless you reassign)
- Reassigning non-existent properties (adds to object but may not persist)
- Methods attached to the entity (these are stripped before persistence)

### Complete Example

Here's a complete example showing proper update patterns:

```ts
const user = await ctx.users.firstOrUndefinedAsync(
  (u) => u.email === "john@example.com"
);

if (user) {
  // Update simple properties
  user.firstName = "John";
  user.lastName = "Smith";

  // Update nested objects
  user.address.street = "456 Oak Avenue";
  user.address.city = "New York";

  // Modify arrays
  user.tags.push("premium");
  user.tags.push("verified");

  // Replace array entirely
  user.preferences = ["dark-theme", "notifications"];

  // All changes tracked in memory
  await ctx.saveChangesAsync(); // Persist to storage
}
```

## Related Guides

- **[Update Operations](/how-to/crud/update)** - Detailed guide to updating entities
- **[Queries Guide](/concepts/queries/)** - Comprehensive query documentation
- **[Field Selection](/concepts/queries/field-selection/)** - Data transformation techniques
- **[Filtering](/concepts/queries/filtering/)** - Advanced filtering patterns
