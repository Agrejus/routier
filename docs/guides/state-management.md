---
title: State Management
---

## State Management

Patterns for local state, derived data, and cross-collection composition in Routier applications.

## Overview

State management in Routier involves managing application state through collections, live queries, and derived data. Routier provides built-in features that make state management straightforward and efficient.

## Key Concepts

### Collections as State

Collections act as your primary state containers:


<<< @/_snippets/code/from-docs/guides/state-management/block-1.ts


### Live Queries

Keep UI in sync with data changes automatically:


<<< @/_snippets/code/from-docs/guides/state-management/block-2.ts


Note: With `.subscribe()`, you must use callback-based methods (not async methods like `toArrayAsync()`).

Live queries reach other browser tabs, and other worker threads in Node, because change
notifications travel over a `BroadcastChannel`. A sender cannot see who is listening on the other
end of one, so by default every save publishes its changes in case another tab is subscribed.

If the process is the only one reading the database — a server, a script, a single-tab app — set
`crossTabSync: false` on the store. Saves then skip that work whenever nothing in the current
process is subscribed, which the repository benchmark measures at roughly 10% of insert time.
Subscriptions within the process keep working. See
**[Live Queries](/guides/live-queries#cross-tab-delivery-and-the-cost-of-a-save)**.

### Change Tracking

All modifications are tracked automatically until saved:


<<< @/_snippets/code/from-docs/guides/state-management/block-3.ts


### Derived State

Compute derived data from your collections:


<<< @/_snippets/code/from-docs/guides/state-management/block-4.ts


## Patterns

- **Single Source of Truth**: Collections serve as your data source
- **Automatic Updates**: Live queries keep UI in sync
- **Explicit Persistence**: Changes saved with `saveChangesAsync()`
- **Type Safety**: Full TypeScript support

## Related Guides

- **[Live Queries](/guides/live-queries)** - Reactive data patterns
- **[Views](/how-to/collections/views)** - Create read-only derived collections
- **[Syncing](/guides/syncing)** - Sync with remote sources
- **[Change Tracking](/concepts/change-tracking)** - Understanding change tracking
- **[Data Manipulation](/guides/data-manipulation)** - Working with your data
