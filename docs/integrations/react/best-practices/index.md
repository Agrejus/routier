---
title: Best Practices
layout: default
parent: React
grand_parent: Integrations
nav_order: 2
---

# React Best Practices

Build robust, performant React applications with Routier by following these patterns and practices.

## Table of Contents

- [Accessing Your Data Store](#accessing-your-data-store)
- [Common Pitfalls](#common-pitfalls)
- [Error Handling](#error-handling)
- [Loading States](#loading-states)
- [Performance Optimization](#performance-optimization)
- [Testing](#testing)
- [Common Patterns](#common-patterns)

## Accessing Your Data Store

You have flexibility in how you provide your DataStore to components. Here are the common approaches:

### Simple Custom Hook

Create a custom hook that returns a new DataStore instance:


{% highlight tsx linenos %}{% include code/from-docs/integrations/react/best-practices/index/block-1.tsx %}{% endhighlight %}


**Critical:** You **must** use `useMemo` when creating a DataStore instance. Without `useMemo`, a new DataStore is created on every render, which causes subscriptions to be recreated infinitely. Each new datastore instance triggers `useQuery`'s effect to re-run, creating new subscriptions, which can cause performance issues and infinite loops.

**Note:** Subscriptions work via BroadcastChannel, so updates work across different DataStore instances. You can create a new instance in each component without losing live updates, but each instance must be memoized.

### With React Context (Optional)

If you prefer to share a single instance through your component tree:


{% highlight tsx linenos %}{% include code/from-docs/integrations/react/best-practices/index/block-2.tsx %}{% endhighlight %}


**Important:** Routier uses BroadcastChannel for subscriptions, so even different DataStore instances will receive update notifications automatically. Both approaches work seamlessly with live queries.

### Debug Logging in Vite

Routier is built with rspack, which replaces `import.meta.env` with `undefined` in the bundle. In a Vite app, you must enable debug logging explicitly by setting `globalThis.__ROUTIER_DEBUG__` at the top of your entry file (before any routier imports):


{% highlight tsx linenos %}{% include code/from-docs/integrations/react/best-practices/index/block-3.tsx %}{% endhighlight %}


For full details on enabling and disabling logging across all environments, see [Debug Logging](/how-to/debug-logging.md).

## Common Pitfalls

### Infinite Subscription Loops

**Problem:** Creating a new DataStore instance on every render causes infinite subscription loops.


{% highlight tsx linenos %}{% include code/from-docs/integrations/react/best-practices/index/block-4.tsx %}{% endhighlight %}


**Why this happens:**

1. Component renders, creates new DataStore instance
2. `useQuery` sees a new `dataStore` reference in dependencies
3. Effect re-runs, creates new subscription
4. Subscription triggers callback, component re-renders
5. Back to step 1 - infinite loop

**Solution:** Always memoize your DataStore instance:


{% highlight tsx linenos %}{% include code/from-docs/integrations/react/best-practices/index/block-5.tsx %}{% endhighlight %}


**How to identify:** If you see subscriptions firing repeatedly or your component re-rendering continuously, check that your DataStore is memoized with `useMemo`.

## Error Handling

### Standard Error Pattern

Always check status before accessing data:


{% highlight tsx linenos %}{% include code/from-docs/integrations/react/best-practices/index/block-6.tsx %}{% endhighlight %}


### Custom Error Component


{% highlight tsx linenos %}{% include code/from-docs/integrations/react/best-practices/index/block-7.tsx %}{% endhighlight %}


### Error Boundary Pattern


{% highlight tsx linenos %}{% include code/from-docs/integrations/react/best-practices/index/block-8.tsx %}{% endhighlight %}


## Loading States

### Reusable Loading Component


{% highlight tsx linenos %}{% include code/from-docs/integrations/react/best-practices/index/block-9.tsx %}{% endhighlight %}


### Skeleton Screens

For better UX, show skeleton screens instead of spinners:


{% highlight tsx linenos %}{% include code/from-docs/integrations/react/best-practices/index/block-10.tsx %}{% endhighlight %}


## Performance Optimization

**Note:** Routier's query evaluation is extremely fast (less than 1ms), so memoization is typically unnecessary unless you're dealing with very complex queries or very large datasets.

### Debounce Search Inputs


{% highlight tsx linenos %}{% include code/from-docs/integrations/react/best-practices/index/block-11.tsx %}{% endhighlight %}


### Split Components

Keep query logic separate from presentation:


{% highlight tsx linenos %}{% include code/from-docs/integrations/react/best-practices/index/block-12.tsx %}{% endhighlight %}


## Testing

### Mock DataStore for Testing


{% highlight tsx linenos %}{% include code/from-docs/integrations/react/best-practices/index/block-13.tsx %}{% endhighlight %}


### Testing useQuery


{% highlight tsx linenos %}{% include code/from-docs/integrations/react/best-practices/index/block-14.tsx %}{% endhighlight %}


## Understanding Query Patterns

### Decision Guide: Choosing the Right Pattern

**Ask yourself:**

1. Does my data change during the component's lifetime?
2. Do I need to show initial data, or only changes?

| Pattern               | Use When                                  | Syntax                        |
| --------------------- | ----------------------------------------- | ----------------------------- |
| **Live subscription** | Data changes, need both initial + updates | `.subscribe().toArray(cb)`    |
| **One-time query**    | Static data, fetch once                   | `.toArray(cb)` (no subscribe) |

### Live Queries vs One-Time Queries

**With `.subscribe()`** - Dynamic data that changes:


{% highlight tsx linenos %}{% include code/from-docs/integrations/react/best-practices/index/block-15.tsx %}{% endhighlight %}


**Without `.subscribe()`** - Static data that doesn't change:


{% highlight tsx linenos %}{% include code/from-docs/integrations/react/best-practices/index/block-16.tsx %}{% endhighlight %}


## Common Patterns

### Refetch Pattern

Implement a manual refetch:


{% highlight tsx linenos %}{% include code/from-docs/integrations/react/best-practices/index/block-17.tsx %}{% endhighlight %}


### Conditional Queries

Skip queries based on conditions:


{% highlight tsx linenos %}{% include code/from-docs/integrations/react/best-practices/index/block-18.tsx %}{% endhighlight %}


### Optimistic Updates Pattern

Combine queries with mutations:


{% highlight tsx linenos %}{% include code/from-docs/integrations/react/best-practices/index/block-19.tsx %}{% endhighlight %}


### Computed Values

Derive data from queries:


{% highlight tsx linenos %}{% include code/from-docs/integrations/react/best-practices/index/block-20.tsx %}{% endhighlight %}


## Anti-Patterns to Avoid

### Don't Call Queries Outside Components


{% highlight tsx linenos %}{% include code/from-docs/integrations/react/best-practices/index/block-21.tsx %}{% endhighlight %}


### Don't Forget Dependencies


{% highlight tsx linenos %}{% include code/from-docs/integrations/react/best-practices/index/block-22.tsx %}{% endhighlight %}


### Don't Access Data Without Status Check


{% highlight tsx linenos %}{% include code/from-docs/integrations/react/best-practices/index/block-23.tsx %}{% endhighlight %}


## Next Steps

- [React Hooks](/integrations/react/hooks/) - Learn about the `useQuery` hook
- [Live Queries Guide](/guides/live-queries/) - Understanding live queries
- [Optimistic Replication Guide](/guides/optimistic-replication/) - Using optimistic replication
- [State Management Guide](/guides/state-management/) - Managing application state
