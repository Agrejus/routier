---
title: React
layout: default
parent: Integrations
has_children: true
nav_order: 2
permalink: /integrations/react/
---

# React Integration

Routier provides first-class support for React through the `useQuery` hook, enabling reactive data fetching with automatic updates when your data changes.

<div style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 16px; margin: 20px 0; border-radius: 4px;">
  <p style="margin: 0 0 8px 0; font-weight: 600; color: #166534;">⚛️ Interactive React Demo</p>
  <p style="margin: 0 0 12px 0; color: #15803d;">See Routier's React integration in action with live examples of `useQuery`, live queries, and reactive updates.</p>
  <p style="margin: 0;">
    <a href="https://codesandbox.io/p/devbox/routier-4nlxsx" target="_blank" rel="noopener noreferrer" style="color: #22c55e; font-weight: 600;">Open CodeSandbox Demo →</a>
  </p>
</div>

## Features

- **Live Queries**: Automatic re-renders when data changes
- **Type Safe**: Full TypeScript support with discriminated unions
- **Performance Optimized**: Built-in memoization and cleanup handling
- **Simple API**: Minimal boilerplate, maximum productivity

## Quick Start

```tsx
import { useQuery } from "@routier/react";
import { useDataStore } from "./hooks/useDataStore";

function ProductsList() {
  const dataStore = useDataStore(); // Must be memoized in useDataStore hook

  const products = useQuery(
    (callback) => dataStore.products.subscribe().toArray(callback),
    [dataStore]
  );

  if (products.status === "pending") return <div>Loading...</div>;
  if (products.status === "error") return <div>Error!</div>;

  return (
    <ul>
      {products.status === "success" &&
        products.data.map((product) => (
          <li key={product.id}>{product.name}</li>
        ))}
    </ul>
  );
}
```

**Important:** Your `useDataStore` hook must use `useMemo` to memoize the DataStore instance. Creating a new DataStore on every render will cause infinite subscription loops. See the [Best Practices](./best-practices/) guide for details.

## Installation

```bash
npm install @routier/react
# Install peer dependencies
npm install react react-dom
```

## Core Concepts

### useQuery Hook

The `useQuery` hook subscribes to Routier collections and returns loading, error, and success states:

```tsx
const result = useQuery(
  (callback) => collection.subscribe().toArray(callback),
  [
    /* dependencies */
  ]
);

// result.status: 'pending' | 'success' | 'error'
// result.loading: boolean
// result.error: Error | null
// result.data: T | undefined
```

### Automatic Updates

Queries automatically re-render when your data changes:

```tsx
// Add a product
await dataStore.products.addAsync({ name: "New Product" });
await dataStore.saveChangesAsync();

// Component automatically re-renders with new data!
```

### Type Safety

TypeScript knows exactly what state your component is in:

```tsx
if (products.status === "success") {
  // TypeScript knows products.data is defined here
  console.log(products.data); // ✅ Safe
}
```

## Related Topics

- **[React Hooks](./hooks/)** - Detailed guide to `useQuery` and other hooks
- **[Best Practices](./best-practices/)** - Patterns, performance tips, and common scenarios

## Concepts You'll Need

- [Live Queries](/guides/live-queries/) - Understanding live queries in depth
- [Optimistic Replication](/guides/optimistic-replication/) - Fast reads with memory replication
- [State Management](/guides/state-management/) - Managing application state
