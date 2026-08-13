---
title: React Hooks
---

# React Hooks

The `useQuery` hook connects React components to Routier's live query system, automatically subscribing to data changes and managing subscription cleanup.

## How It Works

`useQuery` follows a subscription pattern:

1. **Setup**: Your query function sets up a subscription and provides a callback
2. **Updates**: The callback receives new data as it changes
3. **Cleanup**: When dependencies change or the component unmounts, subscriptions are cleaned up
4. **State**: Returns a discriminated union for safe status checking


<<< @/_snippets/code/from-docs/integrations/react/hooks/index/block-1.ts


The hook uses `useEffect` internally, re-running your query when dependencies change and calling the cleanup function you return.

**Important:** When you subscribe to a query inside `useQuery`, you **must return the unsubscribe handler** from your callback. The query chain (e.g. `.subscribe().where(...).firstOrUndefined(callback)`) returns that handler. If you use a block body, explicitly `return` it so the hook can clean up on unmount or when dependencies change—otherwise you risk subscription leaks and stale updates.

## API


<<< @/_snippets/code/from-docs/integrations/react/hooks/index/block-2.ts


**Parameters:**

- `subscribe` - Function that creates your subscription and calls the callback with results. **Must return** the unsubscribe handler (the return value of the query chain, e.g. `.subscribe().toArray(callback)`) so the hook can clean up.
- `deps` - Optional dependency array (works like `useEffect` dependencies)

**Returns:** A state object with `status`, `loading`, `error`, and `data` properties

## Understanding Subscriptions

### With `.subscribe()` - Live Updates

Calling `.subscribe()` creates a live query that **automatically re-runs** when data changes. You **must return** the unsubscribe handler so `useQuery` can clean up:


<<< @/_snippets/code/from-docs/integrations/react/hooks/index/block-3.tsx


With a block body, explicitly return the result of the chain:


<<< @/_snippets/code/from-docs/integrations/react/hooks/index/block-4.tsx


**Use `.subscribe()` when:**

- You want your UI to stay in sync with data changes
- Building reactive, real-time features
- Data is expected to change during the component's lifetime

### Without `.subscribe()` - One-Time Query

Omitting `.subscribe()` runs the query **once** when the component mounts:


<<< @/_snippets/code/from-docs/integrations/react/hooks/index/block-5.tsx


**Use without `.subscribe()` when:**

- Fetching static data that won't change
- Performing one-time initialization
- Loading data for a single render

## Examples

### Basic List Query

Subscribe to an entire collection:

<<< @/_snippets/code/from-docs/integrations/react/hooks/block-1.tsx

### Count Query

Get the count of items:

<<< @/_snippets/code/from-docs/integrations/react/hooks/block-2.tsx

### Filtered Query with Dependencies

Search and filter with reactive updates:

<<< @/_snippets/code/from-docs/integrations/react/hooks/block-3.tsx

### Single Item Query

Get one item by ID or condition:

<<< @/_snippets/code/from-docs/integrations/react/hooks/block-4.tsx

### Sorted Results

Apply sorting to your query:

<<< @/_snippets/code/from-docs/integrations/react/hooks/block-5.tsx

### Pagination with Dependencies

Use take/skip with reactive filtering:

<<< @/_snippets/code/from-docs/integrations/react/hooks/block-6.tsx

### Custom Subscription with Cleanup

For advanced use cases with manual cleanup:

<<< @/_snippets/code/from-docs/integrations/react/hooks/block-7.tsx

### Multiple Queries in One Component

Run multiple independent queries:

<<< @/_snippets/code/from-docs/integrations/react/hooks/block-8.tsx

### One-Time Queries Without Subscription

For static data that doesn't need updates:

<<< @/_snippets/code/from-docs/integrations/react/hooks/block-9.tsx

## Suspense with Async Terminals (React 19)

`useQuery` is an effect-based subscription hook; it returns `pending`, `error`, or `success` state and does not suspend. For React 19 Suspense, pass a stable Promise from a Routier async terminal such as `toArrayAsync()` to React's `use()`:

<<< @/_snippets/code/from-docs/concepts/queries/pagination/suspense-pagination.tsx

Create or cache the Promise outside the component that calls `use()`. Creating `toArrayAsync()` directly during that component's render produces a new Promise on every retry. This pattern performs one read for each Promise; it is not a live subscription. See [React pagination choices](/concepts/queries/pagination#react-19-suspense-pagination) for the behavioral comparison and error-boundary note.

## Quick Reference

| Query Type         | Pattern                          | When to Use                          |
| ------------------ | -------------------------------- | ------------------------------------ |
| **Live Updates**   | `useQuery` + `.subscribe().toArray(callback)` | Data changes, need initial + updates |
| **One-Time Fetch** | `useQuery` + `.toArray(callback)` | Effect-based fetch with explicit status |
| **Suspense Read (React 19)** | `use(toArrayAsync())` with a stable/cached Promise | Boundary-based loading for one-time reads |

**Rule:** When using `.subscribe()`, **return** the query from your callback (e.g. `return dataStore.users.subscribe().where(...).firstOrUndefined(callback)`) so `useQuery` can unsubscribe on cleanup.

**Examples:**

- Products list (changes) → Use `.subscribe()` and return the query
- App config (static) → No `.subscribe()`

## Patterns and Best Practices

### Accessing Your Data Store

Create your DataStore in a simple custom hook:


<<< @/_snippets/code/from-docs/integrations/react/hooks/index/block-6.tsx


**Critical:** You **must** use `useMemo` when creating a DataStore instance. Without `useMemo`, a new DataStore is created on every render, which causes subscriptions to be recreated infinitely. Each new datastore instance triggers `useQuery`'s effect to re-run, creating new subscriptions, which can cause performance issues and infinite loops.

**Note:** Subscriptions work via BroadcastChannel, so live updates work across different DataStore instances. You can create a new instance per component without losing reactivity, but each instance must be memoized.

Alternatively, you can use Context if you prefer a shared instance across your app. See the [Best Practices](/integrations/react/best-practices/) guide for details.

### Status Checking

Always check status before accessing data:


<<< @/_snippets/code/from-docs/integrations/react/hooks/index/block-7.tsx


TypeScript's discriminated unions make this safe:


<<< @/_snippets/code/from-docs/integrations/react/hooks/index/block-8.tsx


### Dependencies Array

Use the deps array to control when queries re-run:


<<< @/_snippets/code/from-docs/integrations/react/hooks/index/block-9.tsx


### Return the Unsubscribe Handler

When you subscribe inside `useQuery`, the query chain returns an unsubscribe function. You **must** return it from your callback so the hook can clean up when the component unmounts or when dependencies change. If you don't, subscriptions leak and the component may not update correctly.

- **Arrow expression:** `(callback) => dataStore.products.subscribe().toArray(callback)` — the return value is implicit.
- **Block body:** use `return` so the handler is passed to `useQuery`:


<<< @/_snippets/code/from-docs/integrations/react/hooks/index/block-10.tsx


For custom subscriptions (e.g. `onChange`), return your cleanup function the same way:


<<< @/_snippets/code/from-docs/integrations/react/hooks/index/block-11.tsx


## Troubleshooting

### Hook Not Updating

If your component doesn't re-render when data changes:

- Ensure you're calling `.subscribe()` on your collection
- **Return the unsubscribe handler** from your query callback (the query chain returns it; with a block body use `return`)
- Check that dependencies are correctly specified in the deps array

### Invalid Hook Call

Common causes:

- **Duplicate React instances**: Run `npm ls react` to check
- **Import from wrong package**: Use `@routier/react` not internal paths
- **Bundler configuration**: Alias `react` and `react-dom` properly

### Memory Leaks

Prevent leaks by:

- **Always return the unsubscribe handler** from your query callback—when using `.subscribe()`, return the result of the chain (e.g. `return dataStore.users.subscribe().where(...).firstOrUndefined(callback)`)
- Not holding references to query results outside the hook
- Using the deps array to prevent unnecessary re-subscriptions

## Advanced Usage

### Combining with Other Hooks


<<< @/_snippets/code/from-docs/integrations/react/hooks/index/block-12.tsx


### Optimistic Updates

Combine with collection mutations for optimistic updates:


<<< @/_snippets/code/from-docs/integrations/react/hooks/index/block-13.tsx


## See Also

- [Live Queries Guide](/guides/live-queries) - Understanding live queries
- [Optimistic Replication Guide](/guides/optimistic-replication) - Using optimistic replication
- [State Management Guide](/guides/state-management) - Managing application state
