---
title: React
---

# React Integration

Routier supports live React subscriptions through `useQuery` and one-time React 19 Suspense reads through Routier's Promise-based terminal methods.

<div style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 16px; margin: 20px 0; border-radius: 4px;">
  <p style="margin: 0 0 8px 0; font-weight: 600; color: #166534;">⚛️ Interactive React Demo</p>
  <p style="margin: 0 0 12px 0; color: #15803d;">See Routier's React integration in action with live examples of `useQuery`, live queries, and reactive updates.</p>
  <p style="margin: 0;">
    <a href="https://codesandbox.io/p/devbox/routier-4nlxsx" target="_blank" rel="noopener noreferrer" style="color: #22c55e; font-weight: 600;">Open CodeSandbox Demo →</a>
  </p>
</div>

## Features

- **Live Queries**: `useQuery` re-renders when subscribed data changes
- **Suspense Reads**: React 19 `use()` reads `toArrayAsync()` and other Promise terminals
- **Type Safe**: Discriminated hook state and inferred query result types
- **Lifecycle Safe**: Dependency-driven subscription cleanup

## Choose a loading style

| Style | Behavior |
| --- | --- |
| `useQuery` + `.subscribe()` | Initial result plus live updates; explicit pending/error/success state |
| React 19 `use()` + `<Suspense>` | One result per stable Promise; boundary-based loading and errors through an error boundary |

## Live-query quick start


<<< @/_snippets/code/from-docs/integrations/react/index/block-1.tsx


**Important:** Your `useDataStore` hook must use `useMemo` or Context to keep the DataStore instance stable. Creating a new DataStore on every render recreates subscriptions continuously. See [Best Practices](/integrations/react/best-practices/) for details.

## Suspense quick start (React 19)

Use an async terminal and keep its Promise in a parent ref so the component that calls `use()` receives the same request on every retry:

<<< @/_snippets/code/react/adapter-suspense.tsx

This performs a one-time read; it does not subscribe to later database changes. See the [React Adapter](/getting-started/react-adapter#which-should-i-use) for the complete comparison.

## Installation

```bash
npm install @routier/react
# Install peer dependencies
npm install react react-dom
```

## Core Concepts

### useQuery Hook

The `useQuery` hook subscribes to Routier collections and returns loading, error, and success states:


<<< @/_snippets/code/from-docs/integrations/react/index/block-3.tsx


### Automatic Updates

Queries automatically re-render when your data changes:


<<< @/_snippets/code/from-docs/integrations/react/index/block-4.tsx


### Type Safety

TypeScript knows exactly what state your component is in:


<<< @/_snippets/code/from-docs/integrations/react/index/block-5.tsx


## Related Topics

- **[React Adapter](/getting-started/react-adapter)** - Side-by-side live-query and Suspense examples
- **[React Hooks](/integrations/react/hooks/)** - Detailed `useQuery`, cleanup, and Suspense guide
- **[Best Practices](/integrations/react/best-practices/)** - Datastore lifetime and subscription patterns

## Concepts You'll Need

- [Live Queries](/guides/live-queries) - Understanding live queries in depth
- [Optimistic Replication](/guides/optimistic-replication) - Fast reads with memory replication
- [State Management](/guides/state-management) - Managing application state
