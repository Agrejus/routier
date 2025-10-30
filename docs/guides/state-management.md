---
title: State Management
layout: default
parent: Guides
nav_order: 3
---

## State Management

Patterns for local state, derived data, and cross-collection composition in Routier applications.

## Overview

State management in Routier involves managing application state through collections, live queries, and derived data. Routier provides built-in features that make state management straightforward and efficient.

## Key Concepts

### Collections as State

Collections act as your primary state containers:

```ts
class AppContext extends DataStore {
  users = this.collection(userSchema).create();
  products = this.collection(productSchema).create();
}
```

### Live Queries

Keep UI in sync with data changes automatically:

```ts
ctx.users.subscribe().toArray((result) => {
  if (result.ok === "success") {
    console.log("Users:", result.data); // Automatically updates when users change
  }
});
```

Note: With `.subscribe()`, you must use callback-based methods (not async methods like `toArrayAsync()`).

### Change Tracking

All modifications are tracked automatically until saved:

```ts
user.name = "New Name"; // Tracked automatically
await ctx.saveChangesAsync(); // Persisted
```

### Derived State

Compute derived data from your collections:

```ts
const stats = {
  totalUsers: await ctx.users.countAsync(),
  activeUsers: await ctx.users.where((u) => u.isActive).countAsync(),
};
```

## Patterns

- **Single Source of Truth**: Collections serve as your data source
- **Automatic Updates**: Live queries keep UI in sync
- **Explicit Persistence**: Changes saved with `saveChangesAsync()`
- **Type Safety**: Full TypeScript support

## Related Guides

- **[Live Queries](live-queries.md)** - Reactive data patterns
- **[Views]({{ site.baseurl }}/how-to/collections/views/)** - Create read-only derived collections
- **[Syncing](syncing.md)** - Sync with remote sources
- **[Change Tracking](/concepts/change-tracking/)** - Understanding change tracking
- **[Data Manipulation](data-manipulation.md)** - Working with your data
