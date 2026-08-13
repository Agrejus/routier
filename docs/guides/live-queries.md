---
title: Live Queries
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

| Method          | Description         | Example                                      |
| --------------- | ------------------- | -------------------------------------------- |
| `subscribe()`   | Enable live updates | `ctx.products.subscribe().toArray(callback)` |
| `unsubscribe()` | Stop live updates   | `query.unsubscribe()`                        |

## Important: Callbacks vs Async

When using `.subscribe()`, you **must use callback-based methods** (not async methods):


<<< @/_snippets/code/from-docs/guides/live-queries/block-1.ts


The reason: subscriptions need to trigger the callback whenever data changes, which can't be done with promises. Callbacks can be invoked at any time, making them perfect for reactive updates.

## Basic Live Queries

### Simple Live Query


<<< @/_snippets/code/from-docs/guides/live-queries/block-2.ts


### Live Query with Filtering


<<< @/_snippets/code/from-docs/guides/live-queries/block-3.ts


### Live Query with Sorting


<<< @/_snippets/code/from-docs/guides/live-queries/block-4.ts


## Advanced Live Query Patterns

### Live Aggregation


<<< @/_snippets/code/from-docs/guides/live-queries/block-5.ts


### Live Pagination


<<< @/_snippets/code/from-docs/guides/live-queries/block-6.ts


### Live Single Item


<<< @/_snippets/code/from-docs/guides/live-queries/block-7.ts


## Managing Live Queries

### Unsubscribing


<<< @/_snippets/code/from-docs/guides/live-queries/block-8.ts


### Conditional Live Queries


<<< @/_snippets/code/from-docs/guides/live-queries/block-9.ts


## Performance Considerations

### Efficient Live Queries


<<< @/_snippets/code/from-docs/guides/live-queries/block-10.ts


### Memory Management


<<< @/_snippets/code/from-docs/guides/live-queries/block-11.ts


### Cross-tab delivery and the cost of a save

Live queries work across browser tabs. Change notifications travel over a `BroadcastChannel`, so a
save in one tab updates a subscribed query in another. Worker threads in Node behave the same way.

That reach has a price on every save. A `BroadcastChannel` sender cannot ask who is listening on the
other end, so by default each save prepares its changes for the wire and publishes them on the chance
that a second tab is subscribed — even when nothing is.

Set `crossTabSync: false` on the store when the process is the only one reading the database, such as
a server, a script, or an app you know runs in a single tab. Saves then skip that work entirely
whenever nothing in the current process is subscribed. Measured on the repository benchmark, this is
worth about 10% of insert time and about 17% on a diff-tracked update of 1,000 entities.

The default stays `true`, so leaving the option alone keeps cross-tab live queries working.

Note what the flag does and does not promise. Subscriptions inside the same process keep working
either way — turning it off only skips the publish when there is no local listener. Turning it off
while another tab **is** subscribed raises no error; that tab simply stops receiving updates.


## Common Patterns

### Real-time Dashboard


<<< @/_snippets/code/from-docs/guides/live-queries/block-12.ts


### Live Search Results


<<< @/_snippets/code/from-docs/guides/live-queries/block-13.ts


### Live Notifications


<<< @/_snippets/code/from-docs/guides/live-queries/block-14.ts


## Best Practices

### 1. **Use Live Queries for Real-time Data**


<<< @/_snippets/code/from-docs/guides/live-queries/block-15.ts


### 2. **Apply Filters Before Subscribing**


<<< @/_snippets/code/from-docs/guides/live-queries/block-16.ts


### 3. **Clean Up Subscriptions**


<<< @/_snippets/code/from-docs/guides/live-queries/block-17.ts


### 4. **Use Appropriate Terminal Methods**


<<< @/_snippets/code/from-docs/guides/live-queries/block-18.ts


## Error Handling

### Live Query Error Handling


<<< @/_snippets/code/from-docs/guides/live-queries/block-19.ts


## Related Topics

- [Queries](/concepts/queries/) - Basic query operations
- [State Management](/guides/state-management) - Managing application state
- [Data Manipulation](/guides/data-manipulation) - Modifying data
