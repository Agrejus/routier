---
title: React Hooks
layout: default
parent: React
grand_parent: Integrations
nav_order: 1
---

# React Hooks

The `useQuery` hook connects React components to Routier's live query system, automatically subscribing to data changes and managing subscription cleanup.

## How It Works

`useQuery` follows a subscription pattern:

1. **Setup**: Your query function sets up a subscription and provides a callback
2. **Updates**: The callback receives new data as it changes
3. **Cleanup**: When dependencies change or the component unmounts, subscriptions are cleaned up
4. **State**: Returns a discriminated union for safe status checking

```ts
type LiveQueryState<T> =
  | { status: "pending"; loading: true; error: null; data: undefined }
  | { status: "error"; loading: false; error: Error; data: undefined }
  | { status: "success"; loading: false; error: null; data: T };
```

The hook uses `useEffect` internally, re-running your query when dependencies change and calling the cleanup function you return.

## API

```ts
function useQuery<T>(
  subscribe: (callback: (result: ResultType<T>) => void) => void | (() => void),
  deps?: any[]
): LiveQueryState<T>;
```

**Parameters:**

- `subscribe` - Function that creates your subscription and calls the callback with results
- `deps` - Optional dependency array (works like `useEffect` dependencies)

**Returns:** A state object with `status`, `loading`, `error`, and `data` properties

## Understanding Subscriptions

### With `.subscribe()` - Live Updates

Calling `.subscribe()` creates a live query that **automatically re-runs** when data changes:

```tsx
// ✅ Live updates - re-renders when products change
const products = useQuery(
  (callback) => dataStore.products.subscribe().toArray(callback),
  []
);

// When you add a product, the component automatically updates
await dataStore.products.addAsync({ name: "New Product" });
await dataStore.saveChangesAsync();
```

**Use `.subscribe()` when:**

- You want your UI to stay in sync with data changes
- Building reactive, real-time features
- Data is expected to change during the component's lifetime

### Without `.subscribe()` - One-Time Query

Omitting `.subscribe()` runs the query **once** when the component mounts:

```tsx
// ❌ One-time only - never updates
const products = useQuery(
  (callback) => dataStore.products.toArray(callback), // No .subscribe()
  []
);

// Adding products won't cause a re-render
await dataStore.products.addAsync({ name: "New Product" });
// Component stays the same
```

**Use without `.subscribe()` when:**

- Fetching static data that won't change
- Performing one-time initialization
- Loading data for a single render

### Deferring the First Query

Use `.defer()` to skip the initial query and only listen to **changes**:

```tsx
// Only gets data AFTER the first change, ignores initial state
const products = useQuery(
  (callback) => dataStore.products.subscribe().defer().toArray(callback),
  []
);
```

**Behavior with `.defer()`:**

1. Component mounts, stays in `pending` state
2. First query is skipped
3. Waits for the next change event
4. On change, queries and updates

**Use `.defer()` when:**

- Building activity feeds or notifications
- Showing only new items after mount
- Analytics dashboards that update on events
- Chat applications (only new messages)

## Examples

### Basic List Query

Subscribe to an entire collection:

{% capture snippet_react_basic %}{% include code/from-docs/integrations/react/hooks/block-1.tsx %}{% endcapture %}
{% highlight tsx %}{{ snippet_react_basic | strip }}{% endhighlight %}

### Count Query

Get the count of items:

{% capture snippet_react_count %}{% include code/from-docs/integrations/react/hooks/block-2.tsx %}{% endcapture %}
{% highlight tsx %}{{ snippet_react_count | strip }}{% endhighlight %}

### Filtered Query with Dependencies

Search and filter with reactive updates:

{% capture snippet_react_filtered %}{% include code/from-docs/integrations/react/hooks/block-3.tsx %}{% endcapture %}
{% highlight tsx %}{{ snippet_react_filtered | strip }}{% endhighlight %}

### Single Item Query

Get one item by ID or condition:

{% capture snippet_react_single %}{% include code/from-docs/integrations/react/hooks/block-4.tsx %}{% endcapture %}
{% highlight tsx %}{{ snippet_react_single | strip }}{% endhighlight %}

### Sorted Results

Apply sorting to your query:

{% capture snippet_react_sorted %}{% include code/from-docs/integrations/react/hooks/block-5.tsx %}{% endcapture %}
{% highlight tsx %}{{ snippet_react_sorted | strip }}{% endhighlight %}

### Pagination with Dependencies

Use take/skip with reactive filtering:

{% capture snippet_react_pagination %}{% include code/from-docs/integrations/react/hooks/block-6.tsx %}{% endcapture %}
{% highlight tsx %}{{ snippet_react_pagination | strip }}{% endhighlight %}

### Custom Subscription with Cleanup

For advanced use cases with manual cleanup:

{% capture snippet_react_custom %}{% include code/from-docs/integrations/react/hooks/block-7.tsx %}{% endcapture %}
{% highlight tsx %}{{ snippet_react_custom | strip }}{% endhighlight %}

### Multiple Queries in One Component

Run multiple independent queries:

{% capture snippet_react_multi %}{% include code/from-docs/integrations/react/hooks/block-8.tsx %}{% endcapture %}
{% highlight tsx %}{{ snippet_react_multi | strip }}{% endhighlight %}

### One-Time Queries Without Subscription

For static data that doesn't need updates:

{% capture snippet_react_onetime %}{% include code/from-docs/integrations/react/hooks/block-9.tsx %}{% endcapture %}
{% highlight tsx %}{{ snippet_react_onetime | strip }}{% endhighlight %}

### Deferred Queries (Change-Only Subscriptions)

Only listen to changes, ignore initial state:

{% capture snippet_react_defer %}{% include code/from-docs/integrations/react/hooks/block-10.tsx %}{% endcapture %}
{% highlight tsx %}{{ snippet_react_defer | strip }}{% endhighlight %}

## Quick Reference

| Query Type         | Pattern                                  | When to Use                              |
| ------------------ | ---------------------------------------- | ---------------------------------------- |
| **Live Updates**   | `.subscribe().toArray(callback)`         | Data changes, need initial + updates     |
| **One-Time Fetch** | `.toArray(callback)`                     | Static data, fetch once only             |
| **Change-Only**    | `.subscribe().defer().toArray(callback)` | Only show new data, ignore current state |

**Examples:**

- Products list (changes) → Use `.subscribe()`
- App config (static) → No `.subscribe()`
- Notifications (new only) → Use `.defer()`

## Patterns and Best Practices

### Accessing Your Data Store

Create your DataStore in a simple custom hook:

```tsx
// hooks/useDataStore.ts
import { useMemo } from "react";
import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/plugins-memory";

export function useDataStore() {
  return useMemo(() => new DataStore(new MemoryPlugin("app")), []);
}
```

**Note:** Subscriptions work via BroadcastChannel, so live updates work across different DataStore instances. You can create a new instance per component without losing reactivity.

Alternatively, you can use Context if you prefer a shared instance across your app. See the [Best Practices](/integrations/react/best-practices/) guide for details.

### Status Checking

Always check status before accessing data:

```tsx
if (result.status === "pending") return <Loading />;
if (result.status === "error") return <Error error={result.error} />;
return <DataView data={result.data} />;
```

TypeScript's discriminated unions make this safe:

```tsx
// TypeScript knows data is defined when status is 'success'
if (result.status === "success") {
  console.log(result.data); // ✅ Safe
}
```

### Dependencies Array

Use the deps array to control when queries re-run:

```tsx
// Re-run when searchTerm changes
const results = useQuery(
  (cb) =>
    dataStore.products
      .where((p) => p.name.includes(searchTerm))
      .subscribe()
      .toArray(cb),
  [searchTerm] // Re-subscribe when searchTerm changes
);
```

### Cleanup Functions

Return a cleanup function from your subscription:

```tsx
const data = useQuery((callback) => {
  const sub = dataStore.products.subscribe();
  const unsub = sub.onChange(() => sub.toArray(callback));
  sub.toArray(callback);

  return unsub; // Cleanup function
}, []);
```

## Troubleshooting

### Hook Not Updating

If your component doesn't re-render when data changes:

- Ensure you're calling `.subscribe()` on your collection
- Check that dependencies are correctly specified in the deps array
- Verify the cleanup function is being returned

### Invalid Hook Call

Common causes:

- **Duplicate React instances**: Run `npm ls react` to check
- **Import from wrong package**: Use `@routier/react` not internal paths
- **Bundler configuration**: Alias `react` and `react-dom` properly

### Memory Leaks

Prevent leaks by:

- Always returning cleanup functions from subscriptions
- Not holding references to query results outside the hook
- Using the deps array to prevent unnecessary re-subscriptions

## Advanced Usage

### Combining with Other Hooks

```tsx
function useFilteredProducts(searchTerm: string) {
  const dataStore = useDataStore();

  const products = useQuery(
    (cb) =>
      dataStore.products
        .where((p) => p.name.includes(searchTerm))
        .subscribe()
        .toArray(cb),
    [searchTerm]
  );

  const count = useMemo(
    () => (products.status === "success" ? products.data?.length : 0),
    [products]
  );

  return { products, count };
}
```

### Optimistic Updates

Combine with collection mutations for optimistic updates:

```tsx
async function addProduct(product: Product) {
  // Optimistic add
  await dataStore.products.addAsync(product);
  await dataStore.saveChangesAsync();

  // Query automatically updates with new data
}
```

## See Also

- [Live Queries Guide](../../../guides/live-queries/) - Understanding live queries
- [Optimistic Replication Guide](../../../guides/optimistic-replication/) - Using optimistic replication
- [State Management Guide](../../../guides/state-management/) - Managing application state
