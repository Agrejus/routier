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

## Features

- **Live Queries**: Automatic re-renders when data changes
- **Type Safe**: Full TypeScript support with discriminated unions
- **Performance Optimized**: Built-in memoization and cleanup handling
- **Simple API**: Minimal boilerplate, maximum productivity

## Quick Start

```tsx
import { useQuery } from "@routier/react";
import { useDataStore } from "./context/DataStoreContext";

function ProductsList() {
  const dataStore = useDataStore();

  const products = useQuery(
    (callback) => dataStore.products.subscribe().toArray(callback),
    []
  );

  if (products.status === "pending") return <div>Loading...</div>;
  if (products.status === "error") return <div>Error!</div>;

  return (
    <ul>
      {products.data?.map((product) => (
        <li key={product.id}>{product.name}</li>
      ))}
    </ul>
  );
}
```

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

## What's Next?

- **[React Hooks](./hooks/)** - Learn how `useQuery` works with detailed examples
- **[Best Practices](./best-practices/)** - Patterns, performance tips, and common scenarios

## Related Guides

- [Live Queries](/guides/live-queries/) - Understanding live queries in depth
- [Optimistic Updates](/guides/optimistic-updates/) - Optimistic update patterns
- [State Management](/guides/state-management/) - Managing application state
