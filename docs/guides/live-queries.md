---
title: Live Queries
layout: default
parent: Guides
nav_order: 1
---

# Live Queries

Live queries automatically update when the underlying data changes, providing real-time reactive data for your applications.

## Overview

Live queries in Routier allow you to subscribe to data changes and automatically receive updates when the underlying data is modified. This is perfect for building reactive UIs and real-time applications.

## Quick Navigation

- [Quick Reference](#quick-reference)
- [Basic Live Queries](#basic-live-queries)
  - [Simple Live Query](#simple-live-query)
  - [Live Query with Filtering](#live-query-with-filtering)
  - [Live Query with Sorting](#live-query-with-sorting)
- [Advanced Live Query Patterns](#advanced-live-query-patterns)
  - [Live Aggregation](#live-aggregation)
  - [Live Pagination](#live-pagination)
  - [Live Single Item](#live-single-item)
- [Managing Live Queries](#managing-live-queries)
- [Performance Considerations](#performance-considerations)
- [Common Patterns](#common-patterns)
- [Best Practices](#best-practices)
- [Error Handling](#error-handling)
- [Related Topics](#related-topics)

## Quick Reference

| Method          | Description         | Example                                   |
| --------------- | ------------------- | ----------------------------------------- |
| `subscribe()`   | Enable live updates | `ctx.products.subscribe().toArrayAsync()` |
| `unsubscribe()` | Stop live updates   | `query.unsubscribe()`                     |

## Basic Live Queries

### Simple Live Query

```ts
import { DataStore } from "@routier/datastore";
import { s } from "@routier/core/schema";
import { MemoryPlugin } from "@routier/memory-plugin";

const userSchema = s
  .define("users", {
    id: s.string().key().identity(),
    email: s.string().distinct(),
    name: s.string(),
    createdAt: s.date().default(() => new Date()),
  })
  .compile();

class Ctx extends DataStore {
  users = this.collection(userSchema).create();
  constructor() {
    super(new MemoryPlugin("app"));
  }
}

const ctx = new Ctx();

// Create a live query that updates automatically
const liveUsers = ctx.users.subscribe().toArrayAsync();

// The liveUsers will automatically update when users are added, updated, or removed
```

### Live Query with Filtering

```ts
// Live query with filtering - updates when filtered data changes
const liveActiveUsers = ctx.users
  .where((u) => u.isActive === true)
  .subscribe()
  .toArrayAsync();

// This will automatically update when:
// - New active users are added
// - Existing users become active/inactive
// - Active users are removed
```

### Live Query with Sorting

```ts
// Live query with sorting - maintains sort order as data changes
const liveSortedUsers = ctx.users
  .orderBy((u) => u.name)
  .subscribe()
  .toArrayAsync();

// This will automatically update and maintain alphabetical order when:
// - New users are added
// - User names are updated
// - Users are removed
```

## Advanced Live Query Patterns

### Live Aggregation

```ts
// Live count that updates automatically
const liveUserCount = ctx.users.subscribe().countAsync();

// Live sum that updates automatically
const liveTotalValue = ctx.products
  .where((p) => p.inStock === true)
  .subscribe()
  .sumAsync((p) => p.price);
```

### Live Pagination

```ts
// Live paginated results
const pageSize = 10;
const currentPage = 0;

const livePage = ctx.users
  .skip(currentPage * pageSize)
  .take(pageSize)
  .subscribe()
  .toArrayAsync();

// This will update when users are added/removed/modified
// affecting the current page
```

### Live Single Item

```ts
// Live single item query
const liveFirstUser = ctx.users
  .orderBy((u) => u.createdAt)
  .subscribe()
  .firstOrUndefinedAsync();

// This will update when the first user changes
```

## Managing Live Queries

### Unsubscribing

```ts
// Create a live query
const liveQuery = ctx.users.subscribe().toArrayAsync();

// Later, unsubscribe to stop updates
liveQuery.unsubscribe();
```

### Conditional Live Queries

```ts
// Only create live query if needed
let liveUsers = null;

if (shouldUseLiveQuery) {
  liveUsers = ctx.users.subscribe().toArrayAsync();
} else {
  liveUsers = ctx.users.toArrayAsync();
}
```

## Performance Considerations

### Efficient Live Queries

```ts
// Good: Apply filters before subscribing
const liveExpensiveProducts = ctx.products
  .where((p) => p.price > 100)
  .subscribe()
  .toArrayAsync();

// Less efficient: Subscribe to all data then filter
const allProducts = ctx.products.subscribe().toArrayAsync();
const expensiveProducts = allProducts.filter((p) => p.price > 100);
```

### Memory Management

```ts
// Clean up live queries when components unmount
class UserComponent {
  private liveUsers: any = null;

  async initialize() {
    this.liveUsers = ctx.users.subscribe().toArrayAsync();
  }

  destroy() {
    if (this.liveUsers) {
      this.liveUsers.unsubscribe();
    }
  }
}
```

## Common Patterns

### Real-time Dashboard

```ts
// Live dashboard with multiple live queries
const dashboard = {
  totalUsers: ctx.users.subscribe().countAsync(),
  activeUsers: ctx.users
    .where((u) => u.isActive === true)
    .subscribe()
    .countAsync(),
  recentUsers: ctx.users
    .orderByDescending((u) => u.createdAt)
    .take(5)
    .subscribe()
    .toArrayAsync(),
};
```

### Live Search Results

```ts
// Live search that updates as user types
const searchTerm = "john";
const liveSearchResults = ctx.users
  .where((u) => u.name.toLowerCase().includes(searchTerm.toLowerCase()))
  .subscribe()
  .toArrayAsync();
```

### Live Notifications

```ts
// Live query for unread notifications
const liveUnreadNotifications = ctx.notifications
  .where((n) => n.isRead === false)
  .orderByDescending((n) => n.createdAt)
  .subscribe()
  .toArrayAsync();
```

## Best Practices

### 1. **Use Live Queries for Real-time Data**

```ts
// Good: Use live queries for data that changes frequently
const liveMessages = ctx.messages.subscribe().toArrayAsync();

// Less useful: Static data doesn't need live queries
const staticConfig = ctx.config.toArrayAsync();
```

### 2. **Apply Filters Before Subscribing**

```ts
// Good: Filter before subscribing
const liveActiveUsers = ctx.users
  .where((u) => u.isActive === true)
  .subscribe()
  .toArrayAsync();

// Less efficient: Subscribe to all data
const allUsers = ctx.users.subscribe().toArrayAsync();
```

### 3. **Clean Up Subscriptions**

```ts
// Always unsubscribe when done
const liveQuery = ctx.users.subscribe().toArrayAsync();

// Clean up
liveQuery.unsubscribe();
```

### 4. **Use Appropriate Terminal Methods**

```ts
// Use countAsync for counts
const liveCount = ctx.users.subscribe().countAsync();

// Use toArrayAsync for lists
const liveList = ctx.users.subscribe().toArrayAsync();

// Use firstAsync for single items
const liveFirst = ctx.users.subscribe().firstAsync();
```

## Error Handling

### Live Query Error Handling

```ts
try {
  const liveUsers = ctx.users.subscribe().toArrayAsync();
  // Handle live updates
} catch (error) {
  console.error("Live query error:", error);
  // Fallback to regular query
  const users = await ctx.users.toArrayAsync();
}
```

## Related Topics

- [Queries](/concepts/queries/) - Basic query operations
- [State Management](/guides/state-management/) - Managing application state
- [Data Manipulation](/guides/data-manipulation/) - Modifying data
