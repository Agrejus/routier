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


{% highlight ts linenos %}{% include code/from-docs/integrations/react/hooks/index/block-1.ts %}{% endhighlight %}


The hook uses `useEffect` internally, re-running your query when dependencies change and calling the cleanup function you return.

**Important:** When you subscribe to a query inside `useQuery`, you **must return the unsubscribe handler** from your callback. The query chain (e.g. `.subscribe().where(...).firstOrUndefined(callback)`) returns that handler. If you use a block body, explicitly `return` it so the hook can clean up on unmount or when dependencies change—otherwise you risk subscription leaks and stale updates.

## API


{% highlight ts linenos %}{% include code/from-docs/integrations/react/hooks/index/block-2.ts %}{% endhighlight %}


**Parameters:**

- `subscribe` - Function that creates your subscription and calls the callback with results. **Must return** the unsubscribe handler (the return value of the query chain, e.g. `.subscribe().toArray(callback)`) so the hook can clean up.
- `deps` - Optional dependency array (works like `useEffect` dependencies)

**Returns:** A state object with `status`, `loading`, `error`, and `data` properties

## Understanding Subscriptions

### With `.subscribe()` - Live Updates

Calling `.subscribe()` creates a live query that **automatically re-runs** when data changes. You **must return** the unsubscribe handler so `useQuery` can clean up:


{% highlight tsx linenos %}{% include code/from-docs/integrations/react/hooks/index/block-3.tsx %}{% endhighlight %}


With a block body, explicitly return the result of the chain:


{% highlight tsx linenos %}{% include code/from-docs/integrations/react/hooks/index/block-4.tsx %}{% endhighlight %}


**Use `.subscribe()` when:**

- You want your UI to stay in sync with data changes
- Building reactive, real-time features
- Data is expected to change during the component's lifetime

### Without `.subscribe()` - One-Time Query

Omitting `.subscribe()` runs the query **once** when the component mounts:


{% highlight tsx linenos %}{% include code/from-docs/integrations/react/hooks/index/block-5.tsx %}{% endhighlight %}


**Use without `.subscribe()` when:**

- Fetching static data that won't change
- Performing one-time initialization
- Loading data for a single render

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

## Quick Reference

| Query Type         | Pattern                          | When to Use                          |
| ------------------ | -------------------------------- | ------------------------------------ |
| **Live Updates**   | `.subscribe().toArray(callback)` | Data changes, need initial + updates |
| **One-Time Fetch** | `.toArray(callback)`             | Static data, fetch once only         |

**Rule:** When using `.subscribe()`, **return** the query from your callback (e.g. `return dataStore.users.subscribe().where(...).firstOrUndefined(callback)`) so `useQuery` can unsubscribe on cleanup.

**Examples:**

- Products list (changes) → Use `.subscribe()` and return the query
- App config (static) → No `.subscribe()`

## Patterns and Best Practices

### Accessing Your Data Store

Create your DataStore in a simple custom hook:


{% highlight tsx linenos %}{% include code/from-docs/integrations/react/hooks/index/block-6.tsx %}{% endhighlight %}


**Critical:** You **must** use `useMemo` when creating a DataStore instance. Without `useMemo`, a new DataStore is created on every render, which causes subscriptions to be recreated infinitely. Each new datastore instance triggers `useQuery`'s effect to re-run, creating new subscriptions, which can cause performance issues and infinite loops.

**Note:** Subscriptions work via BroadcastChannel, so live updates work across different DataStore instances. You can create a new instance per component without losing reactivity, but each instance must be memoized.

Alternatively, you can use Context if you prefer a shared instance across your app. See the [Best Practices](/integrations/react/best-practices/) guide for details.

### Status Checking

Always check status before accessing data:


{% highlight tsx linenos %}{% include code/from-docs/integrations/react/hooks/index/block-7.tsx %}{% endhighlight %}


TypeScript's discriminated unions make this safe:


{% highlight tsx linenos %}{% include code/from-docs/integrations/react/hooks/index/block-8.tsx %}{% endhighlight %}


### Dependencies Array

Use the deps array to control when queries re-run:


{% highlight tsx linenos %}{% include code/from-docs/integrations/react/hooks/index/block-9.tsx %}{% endhighlight %}


### Return the Unsubscribe Handler

When you subscribe inside `useQuery`, the query chain returns an unsubscribe function. You **must** return it from your callback so the hook can clean up when the component unmounts or when dependencies change. If you don't, subscriptions leak and the component may not update correctly.

- **Arrow expression:** `(callback) => dataStore.products.subscribe().toArray(callback)` — the return value is implicit.
- **Block body:** use `return` so the handler is passed to `useQuery`:


{% highlight tsx linenos %}{% include code/from-docs/integrations/react/hooks/index/block-10.tsx %}{% endhighlight %}


For custom subscriptions (e.g. `onChange`), return your cleanup function the same way:


{% highlight tsx linenos %}{% include code/from-docs/integrations/react/hooks/index/block-11.tsx %}{% endhighlight %}


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


{% highlight tsx linenos %}{% include code/from-docs/integrations/react/hooks/index/block-12.tsx %}{% endhighlight %}


### Optimistic Updates

Combine with collection mutations for optimistic updates:


{% highlight tsx linenos %}{% include code/from-docs/integrations/react/hooks/index/block-13.tsx %}{% endhighlight %}


## See Also

- [Live Queries Guide](../../../guides/live-queries/) - Understanding live queries
- [Optimistic Replication Guide](../../../guides/optimistic-replication/) - Using optimistic replication
- [State Management Guide](../../../guides/state-management/) - Managing application state
