---
title: React Adapter
---

# React Adapter

Routier supports two React data-loading styles:

| Choose | Use when |
| --- | --- |
| [`useQuery` with `.subscribe()`](#live-query-with-usequery) | The component should update whenever matching stored data changes |
| [React 19 `use()` with `<Suspense>`](#suspense-read-react-19) | Each request is a one-time Promise read and loading belongs to a Suspense boundary |

<div style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 16px; margin: 20px 0; border-radius: 4px;">
  <p style="margin: 0 0 8px 0; font-weight: 600; color: #166534;">⚛️ See React Integration Live</p>
  <p style="margin: 0 0 12px 0; color: #15803d;">Explore a working React example with <code>useQuery</code>, live queries, and reactive updates in CodeSandbox.</p>
  <p style="margin: 0;">
    <a href="https://codesandbox.io/p/devbox/routier-4nlxsx" target="_blank" rel="noopener noreferrer" style="color: #22c55e; font-weight: 600;">Open CodeSandbox Demo →</a>
  </p>
</div>

## Live query with `useQuery`

`useQuery` connects a callback terminal to React state. Adding `.subscribe()` delivers the initial result and reruns the query when matching stored data changes. Return the query chain so the hook receives its unsubscribe function.

<<< @/_snippets/code/react/adapter-quick.tsx

This style exposes explicit `pending`, `error`, and `success` states. Dependencies behave like `useEffect` dependencies and recreate the subscription when they change.

## Suspense read (React 19)

React 19's `use()` reads the Promise returned by a Routier async terminal such as `toArrayAsync()`. The nearest `<Suspense>` boundary displays its fallback while that Promise is pending.

<<< @/_snippets/code/react/adapter-suspense.tsx

The Promise must remain stable while React retries the suspended render. This example keeps it in a parent `useRef`. The parent does not suspend—it commits with the boundary's fallback—so the ref survives retries of `ProductsListContent`. Do not create the Promise or initialize the ref inside the child that calls `use()`.

This is a one-time read, not a subscription. Later database mutations do not replace the cached result automatically. Use `useQuery` with `.subscribe()` when the component must stay live. A rejected Promise is handled by the nearest React error boundary, not the Suspense fallback.

## Which should I use?

- Use **`useQuery`** for lists, counters, search results, and detail views that should react to local writes, synchronization, or changes from another tab.
- Use **Suspense** for route-level or boundary-level one-time loading where your application already manages stable request Promises and invalidation.
- Use both in one application when different screens have different lifecycle requirements.

## Continue

- [React Hooks](/integrations/react/hooks/) — complete `useQuery` API, dependencies, cleanup, and Suspense example.
- [React Best Practices](/integrations/react/best-practices/) — datastore lifetime and subscription patterns.
- [Reactive and Suspense Pagination](/concepts/queries/pagination#reactive-pagination) — page-number and page-size examples using both approaches.
