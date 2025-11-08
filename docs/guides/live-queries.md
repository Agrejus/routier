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
- [Important: Callbacks vs Async](#important-callbacks-vs-async)
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

| Method          | Description         | Example                                              |
| --------------- | ------------------- | ---------------------------------------------------- |
| `subscribe()`   | Enable live updates | `ctx.products.subscribe().toArray(callback)`         |
| `defer()`       | Skip initial query  | `ctx.products.defer().subscribe().toArray(callback)` |
| `unsubscribe()` | Stop live updates   | `query.unsubscribe()`                                |

## Important: Callbacks vs Async

When using `.subscribe()`, you **must use callback-based methods** (not async methods):

```ts
// ✅ Correct: Use callbacks with .subscribe()
ctx.users.subscribe().toArray((result) => {
  if (result.ok === "success") {
    console.log(result.data);
  }
});

// ❌ Incorrect: Cannot use async methods with .subscribe()
// This will NOT work:
const data = await ctx.users.subscribe().toArrayAsync();
```

The reason: subscriptions need to trigger the callback whenever data changes, which can't be done with promises. Callbacks can be invoked at any time, making them perfect for reactive updates.

## Basic Live Queries

### Simple Live Query

```ts
// Create a live query that updates automatically
ctx.users.subscribe().toArray((result) => {
  if (result.ok === "success") {
    console.log(result.data); // Live data updates automatically
  }
});

// The query will automatically update when users are added, updated, or removed
```

### Live Query with Filtering

```ts
// Live query with filtering - updates when filtered data changes
ctx.users
  .where((u) => u.isActive === true)
  .subscribe()
  .toArray((result) => {
    if (result.ok === "success") {
      console.log("Active users:", result.data);
    }
  });

// This will automatically update when:
// - New active users are added
// - Existing users become active/inactive
// - Active users are removed
```

### Live Query with Sorting

```ts
// Live query with sorting - maintains sort order as data changes
ctx.users
  .sort((u) => u.name)
  .subscribe()
  .toArray((result) => {
    if (result.ok === "success") {
      console.log("Sorted users:", result.data);
    }
  });

// This will automatically update and maintain alphabetical order when:
// - New users are added
// - User names are updated
// - Users are removed
```

## Deferring the Initial Query

The `.defer()` method skips the **first** query execution only, then listens to all subsequent changes. This is useful when you only want to react to new data, not load existing data on initial setup.

### How `.defer()` Works

When you use `.defer()`, the query:

1. Sets up the subscription without executing the query immediately
2. Waits for the first change event to occur
3. Executes the query when the first change happens
4. After the first change, behaves normally—executes on every subsequent change

**Important:** `.defer()` must be called **before** `.subscribe()`:

```ts
// ✅ Correct: defer() before subscribe()
ctx.products
  .defer()
  .subscribe()
  .toArray((result) => {
    if (result.ok === "success") {
      console.log("Data after first change:", result.data);
    }
  });

// ❌ Incorrect: subscribe() before defer() won't work as expected
ctx.products
  .subscribe()
  .defer()
  .toArray((result) => {
    // This will still execute the initial query
  });
```

### When to Use `.defer()`

Use `.defer()` when you want to:

- **Skip initial data load**: Only react to changes, not current state
- **Prevent view computation on datastore creation**: In views, prevent the derive function from executing immediately when the datastore is instantiated
- **Activity feeds**: Show only new items after a component mounts
- **Notifications**: Display only new notifications, not historical ones
- **Chat messages**: Show only new messages after joining a chat

### Example: Activity Feed

```ts
// Skip first query, then show activities on changes
ctx.activities
  .defer()
  .subscribe()
  .toArray((result) => {
    if (result.ok === "success") {
      // This callback is NOT called on initial setup (first execution skipped)
      // It's called on the first change event
      // It's called on every subsequent change (normal behavior)
      console.log("Activities:", result.data);
    }
  });
```

### Example: In Views

When creating views, use `.defer()` to prevent the view from computing immediately when the datastore is created:

```ts
commentsView = this.view(commentsViewSchema)
  .derive((done) => {
    // defer() prevents this query from executing when the datastore is created
    // The view will only compute when comments actually change
    const unsubscribe = this.comments
      .defer()
      .subscribe()
      .toArray((response) => {
        if (response.ok === "error") {
          return done([]);
        }

        done(
          response.data.map((x) => ({
            id: `view:${x._id}`,
            content: x.content,
            // ... transform data
          }))
        );
      });

    return unsubscribe; // Return unsubscribe function for cleanup
  })
  .create();
```

**Why use `.defer()` in views?**

- Without `.defer()`, the view would execute the query immediately when the datastore is instantiated
- This can cause unnecessary computation if the view is created but not immediately needed
- With `.defer()`, the view skips the first computation on creation, then computes on the first change and all subsequent changes

### Comparison: With vs Without `.defer()`

```ts
// Without .defer() - Executes immediately
ctx.products.subscribe().toArray((result) => {
  // ✅ Called immediately with current data
  // ✅ Called again on every subsequent change
  console.log("Products:", result.data);
});

// With .defer() - Skips first execution only
ctx.products
  .defer()
  .subscribe()
  .toArray((result) => {
    // ❌ NOT called on initial setup (first execution skipped)
    // ✅ Called on first change event
    // ✅ Called on every subsequent change (normal behavior)
    console.log("Products after change:", result.data);
  });
```

## Advanced Live Query Patterns

### Live Aggregation

```ts
// Live count that updates automatically
ctx.users.subscribe().count((result) => {
  if (result.ok === "success") {
    console.log("User count:", result.data);
  }
});

// Live sum that updates automatically
ctx.products
  .where((p) => p.inStock === true)
  .subscribe()
  .sum(
    (result, selector) => {
      if (result.ok === "success") {
        console.log("Total value:", result.data);
      }
    },
    (p) => p.price
  );
```

### Live Pagination

```ts
// Live paginated results
const pageSize = 10;
const currentPage = 0;

ctx.users
  .skip(currentPage * pageSize)
  .take(pageSize)
  .subscribe()
  .toArray((result) => {
    if (result.ok === "success") {
      console.log("Current page:", result.data);
    }
  });

// This will update when users are added/removed/modified
// affecting the current page
```

### Live Single Item

```ts
// Live single item query
ctx.users
  .sort((u) => u.createdAt)
  .subscribe()
  .firstOrUndefined((result) => {
    if (result.ok === "success") {
      console.log("First user:", result.data);
    }
  });

// This will update when the first user changes
```

## Managing Live Queries

### Unsubscribing

```ts
// Create a live query
const subscription = ctx.users.subscribe().toArray((result) => {
  if (result.ok === "success") {
    console.log(result.data);
  }
});

// Later, unsubscribe to stop updates
subscription.unsubscribe();
```

### Conditional Live Queries

```ts
// Only create live query if needed
let unsubscribe: (() => void) | null = null;

if (shouldUseLiveQuery) {
  unsubscribe = ctx.users.subscribe().toArray((result) => {
    if (result.ok === "success") {
      // Handle data
    }
  }).unsubscribe;
} else {
  ctx.users.toArrayAsync().then((data) => {
    // Handle data
  });
}
```

## Performance Considerations

### Efficient Live Queries

```ts
// Good: Apply filters before subscribing
ctx.products
  .where((p) => p.price > 100)
  .subscribe()
  .toArray((result) => {
    if (result.ok === "success") {
      // Handle expensive products
    }
  });

// Less efficient: Subscribe to all data then filter
ctx.products.subscribe().toArray((result) => {
  if (result.ok === "success") {
    const expensiveProducts = result.data.filter((p) => p.price > 100);
    // Handle filtered results
  }
});
```

### Memory Management

```ts
// Clean up live queries when components unmount
class UserComponent {
  private unsubscribe: (() => void) | null = null;

  initialize() {
    const subscription = ctx.users.subscribe().toArray((result) => {
      if (result.ok === "success") {
        // Handle data
      }
    });
    this.unsubscribe = subscription.unsubscribe;
  }

  destroy() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }
}
```

## Common Patterns

### Real-time Dashboard

```ts
// Live dashboard with multiple live queries
ctx.users.subscribe().count((result) => {
  if (result.ok === "success") {
    console.log("Total users:", result.data);
  }
});

ctx.products
  .where((p) => p.inStock === true)
  .subscribe()
  .count((result) => {
    if (result.ok === "success") {
      console.log("Active products:", result.data);
    }
  });

ctx.products
  .orderByDescending((p) => p.sales)
  .take(5)
  .subscribe()
  .toArray((result) => {
    if (result.ok === "success") {
      console.log("Top sellers:", result.data);
    }
  });
```

### Live Search Results

```ts
// Live search that updates as user types
const searchTerm = "john";
ctx.users
  .where((u) => u.name.toLowerCase().includes(searchTerm.toLowerCase()))
  .subscribe()
  .toArray((result) => {
    if (result.ok === "success") {
      console.log("Search results:", result.data);
    }
  });
```

### Live Notifications

```ts
// Live query for unread notifications
ctx.notifications
  .where((n) => n.isRead === false)
  .orderByDescending((n) => n.createdAt)
  .subscribe()
  .toArray((result) => {
    if (result.ok === "success") {
      console.log("Unread notifications:", result.data);
    }
  });
```

## Best Practices

### 1. **Use Live Queries for Real-time Data**

```ts
// Good: Use live queries for data that changes frequently
ctx.messages.subscribe().toArray((result) => {
  if (result.ok === "success") {
    console.log("Messages:", result.data);
  }
});

// Less useful: Static data doesn't need live queries
const staticConfig = await ctx.config.toArrayAsync();
```

### 2. **Apply Filters Before Subscribing**

```ts
// Good: Filter before subscribing to reduce tracked changes
ctx.users
  .where((u) => u.isActive === true)
  .subscribe()
  .toArray((result) => {
    if (result.ok === "success") {
      // Handle active users
    }
  });

// Less efficient: Subscribe to all data, then filter in component
ctx.users.subscribe().toArray((result) => {
  if (result.ok === "success") {
    const activeUsers = result.data.filter((u) => u.isActive);
    // Handle filtered results
  }
});
```

### 3. **Clean Up Subscriptions**

```ts
// Always unsubscribe when done
const subscription = ctx.users.subscribe().toArray((result) => {
  if (result.ok === "success") {
    // Handle data
  }
});

// Clean up
subscription.unsubscribe();
```

### 4. **Use Appropriate Terminal Methods**

```ts
// Use count() for counts
ctx.users.subscribe().count((result) => {
  if (result.ok === "success") {
    console.log("Count:", result.data);
  }
});

// Use toArray() for lists
ctx.users.subscribe().toArray((result) => {
  if (result.ok === "success") {
    console.log("List:", result.data);
  }
});

// Use firstOrUndefined() for single items
ctx.users.subscribe().firstOrUndefined((result) => {
  if (result.ok === "success") {
    console.log("First:", result.data);
  }
});
```

## Error Handling

### Live Query Error Handling

```ts
ctx.users.subscribe().toArray((result) => {
  if (result.ok === "success") {
    // Handle live updates
  } else {
    console.error("Live query error:", result.error);
    // Fallback to regular query
    ctx.users.toArrayAsync().then((users) => {
      // Handle fallback data
    });
  }
});
```

## Related Topics

- [Queries](/concepts/queries/) - Basic query operations
- [State Management](/guides/state-management/) - Managing application state
- [Data Manipulation](/guides/data-manipulation/) - Modifying data
