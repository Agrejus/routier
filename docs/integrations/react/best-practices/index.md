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
- [Error Handling](#error-handling)
- [Loading States](#loading-states)
- [Performance Optimization](#performance-optimization)
- [Testing](#testing)
- [Common Patterns](#common-patterns)

## Accessing Your Data Store

You have flexibility in how you provide your DataStore to components. Here are the common approaches:

### Simple Custom Hook

Create a custom hook that returns a new DataStore instance:

```tsx
// hooks/useDataStore.ts
import { useMemo } from "react";
import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";

export function useDataStore() {
  return useMemo(() => new DataStore(new MemoryPlugin("app")), []);
}
```

**Note:** Subscriptions work via BroadcastChannel, so updates work across different DataStore instances. You can create a new instance in each component without losing live updates.

### With React Context (Optional)

If you prefer to share a single instance through your component tree:

```tsx
// DataStoreContext.tsx
import { createContext, useContext, ReactNode } from "react";
import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";

const DataStoreContext = createContext<DataStore | null>(null);

export function DataStoreProvider({ children }: { children: ReactNode }) {
  const store = useMemo(() => new DataStore(new MemoryPlugin("app")), []);

  return (
    <DataStoreContext.Provider value={store}>
      {children}
    </DataStoreContext.Provider>
  );
}

export function useDataStore() {
  const context = useContext(DataStoreContext);
  if (!context) {
    throw new Error("useDataStore must be used within DataStoreProvider");
  }
  return context;
}
```

**Important:** Routier uses BroadcastChannel for subscriptions, so even different DataStore instances will receive update notifications automatically. Both approaches work seamlessly with live queries.

## Error Handling

### Standard Error Pattern

Always check status before accessing data:

```tsx
const products = useQuery(
  (cb) => dataStore.products.subscribe().toArray(cb),
  []
);

if (products.status === "pending") {
  return <LoadingSpinner />;
}

if (products.status === "error") {
  return <ErrorMessage error={products.error} />;
}

return <ProductsList products={products.data} />;
```

### Custom Error Component

```tsx
interface ErrorDisplayProps {
  error: Error;
  retry?: () => void;
}

function ErrorDisplay({ error, retry }: ErrorDisplayProps) {
  return (
    <div className="error">
      <p>Something went wrong: {error.message}</p>
      {retry && <button onClick={retry}>Retry</button>}
    </div>
  );
}

// Usage
if (products.status === "error") {
  return <ErrorDisplay error={products.error} />;
}
```

### Error Boundary Pattern

```tsx
import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class QueryErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return <ErrorDisplay error={this.state.error!} />;
    }

    return this.props.children;
  }
}

// Usage
<QueryErrorBoundary>
  <ProductsList />
</QueryErrorBoundary>;
```

## Loading States

### Reusable Loading Component

```tsx
interface LoadingProps {
  size?: "small" | "medium" | "large";
  message?: string;
}

function Loading({ size = "medium", message = "Loading..." }: LoadingProps) {
  return (
    <div className={`loading loading-${size}`}>
      <Spinner />
      <p>{message}</p>
    </div>
  );
}

// Usage
if (products.status === "pending") {
  return <Loading message="Loading products..." />;
}
```

### Skeleton Screens

For better UX, show skeleton screens instead of spinners:

```tsx
function ProductSkeleton() {
  return (
    <div className="skeleton">
      <div className="skeleton-image"></div>
      <div className="skeleton-title"></div>
      <div className="skeleton-description"></div>
    </div>
  );
}

// Usage
if (products.status === "pending") {
  return Array(3)
    .fill(0)
    .map((_, i) => <ProductSkeleton key={i} />);
}
```

## Performance Optimization

**Note:** Routier's query evaluation is extremely fast (less than 1ms), so memoization is typically unnecessary unless you're dealing with very complex queries or very large datasets.

### Debounce Search Inputs

```tsx
import { useState, useEffect } from "react";

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

function SearchableProducts() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  const products = useQuery(
    (cb) =>
      dataStore.products
        .where((p) => p.name.includes(debouncedSearch))
        .subscribe()
        .toArray(cb),
    [debouncedSearch]
  );

  return (
    <>
      <input value={search} onChange={(e) => setSearch(e.target.value)} />
      {/* Render products */}
    </>
  );
}
```

### Split Components

Keep query logic separate from presentation:

```tsx
// hooks/useProducts.ts
export function useProducts(searchTerm: string) {
  const dataStore = useDataStore();

  return useQuery(
    (cb) =>
      dataStore.products
        .where((p) => p.name.includes(searchTerm))
        .subscribe()
        .toArray(cb),
    [searchTerm]
  );
}

// components/ProductsList.tsx
export function ProductsList({ searchTerm }: { searchTerm: string }) {
  const products = useProducts(searchTerm);

  if (products.status === "pending") return <Loading />;
  if (products.status === "error")
    return <ErrorDisplay error={products.error} />;

  return (
    <ul>
      {products.data?.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </ul>
  );
}
```

## Testing

### Mock DataStore for Testing

```tsx
// test-utils/mockStore.ts
import { MemoryPlugin } from "@routier/memory-plugin";
import { DataStore } from "@routier/datastore";

export function createMockStore() {
  return new DataStore(new MemoryPlugin("test"));
}

// Usage in tests
import { render } from "@testing-library/react";
import { DataStoreProvider } from "../contexts/DataStoreContext";

function renderWithStore(component: ReactElement, store: DataStore) {
  return render(
    <DataStoreProvider store={store}>{component}</DataStoreProvider>
  );
}

test("renders products", () => {
  const store = createMockStore();
  // Populate store with test data
  store.products.addAsync({ name: "Test Product" });

  renderWithStore(<ProductsList />, store);
  // Assertions...
});
```

### Testing useQuery

```tsx
import { renderHook, waitFor } from "@testing-library/react";

test("useQuery returns data", async () => {
  const store = createMockStore();
  await store.products.addAsync({ name: "Test" });
  await store.saveChangesAsync();

  const { result } = renderHook(
    () => useQuery((cb) => store.products.subscribe().toArray(cb), []),
    {
      wrapper: ({ children }) => (
        <DataStoreProvider store={store}>{children}</DataStoreProvider>
      ),
    }
  );

  await waitFor(() => {
    expect(result.current.status).toBe("success");
  });

  expect(result.current.data).toHaveLength(1);
});
```

## Understanding Query Patterns

### Decision Guide: Choosing the Right Pattern

**Ask yourself:**

1. Does my data change during the component's lifetime?
2. Do I need to show initial data, or only changes?

| Pattern               | Use When                                  | Syntax                             |
| --------------------- | ----------------------------------------- | ---------------------------------- |
| **Live subscription** | Data changes, need both initial + updates | `.subscribe().toArray(cb)`         |
| **One-time query**    | Static data, fetch once                   | `.toArray(cb)` (no subscribe)      |
| **Defer updates**     | Only show new data, ignore current        | `.subscribe().defer().toArray(cb)` |

### Live Queries vs One-Time Queries

**With `.subscribe()`** - Dynamic data that changes:

```tsx
// ✅ Use .subscribe() when data changes
function ProductsList() {
  const products = useQuery(
    (callback) => dataStore.products.subscribe().toArray(callback),
    []
  );
  // Automatically updates when products are added/updated/removed
}
```

**Without `.subscribe()`** - Static data that doesn't change:

```tsx
// ✅ Use without .subscribe() for static/one-time data
function ConfigDisplay() {
  const config = useQuery(
    (callback) => dataStore.config.toArray(callback), // No .subscribe()
    []
  );
  // Runs once, never updates - perfect for app configuration
}
```

### When to Use `.defer()`

The `.defer()` method skips the first query and only listens to changes:

```tsx
// Perfect for real-time notifications
function NotificationsFeed() {
  const notifications = useQuery(
    (callback) => dataStore.notifications.subscribe().defer().toArray(callback),
    []
  );

  // Component mounts with pending state
  // When a new notification arrives, it queries and updates
  // User only sees new notifications, not historical ones
}
```

**When to use `.defer()`:**

- Activity feeds and notifications
- Real-time chat messages (only new messages after mount)
- Event-driven dashboards
- Any scenario where you only care about changes, not current state

**Real-world example - Chat Messages:**

```tsx
function ChatWindow() {
  const dataStore = useDataStore();

  // Only show NEW messages after user joins the chat
  // Don't load entire chat history on mount
  const messages = useQuery(
    (callback) => dataStore.messages.subscribe().defer().toArray(callback),
    []
  );

  return (
    <div>
      {messages.status === "pending" && (
        <div>Joined chat. Waiting for messages...</div>
      )}
      {messages.status === "success" && (
        <ul>
          {messages.data?.map((msg) => (
            <li key={msg.id}>{msg.text}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

**Comparison:**

```tsx
// Without .defer() - Loads all messages immediately
const messages = useQuery(
  (cb) => dataStore.messages.subscribe().toArray(cb),
  []
);
// Shows: [message1, message2, message3, ...] (entire history)

// With .defer() - Only shows new messages
const messages = useQuery(
  (cb) => dataStore.messages.subscribe().defer().toArray(cb),
  []
);
// Shows: [] initially, then only [message4, message5, ...] (only new)
```

## Common Patterns

### Refetch Pattern

Implement a manual refetch:

```tsx
function RefetchableProducts() {
  const [key, setKey] = useState(0);

  const products = useQuery(
    (cb) => dataStore.products.subscribe().toArray(cb),
    [key] // Re-run when key changes
  );

  const refetch = () => setKey((prev) => prev + 1);

  return (
    <>
      <button onClick={refetch}>Refresh</button>
      {/* Render products */}
    </>
  );
}
```

### Conditional Queries

Skip queries based on conditions:

```tsx
function ConditionalQuery({ userId }: { userId?: string }) {
  const dataStore = useDataStore();

  const orders = useQuery(
    (cb) => {
      if (!userId) return; // Skip query
      return dataStore.orders
        .where((o) => o.userId === userId)
        .subscribe()
        .toArray(cb);
    },
    [userId]
  );

  if (!userId) return <div>Please select a user</div>;
  // Rest of component...
}
```

### Optimistic Updates Pattern

Combine queries with mutations:

```tsx
async function addProduct(product: ProductData) {
  // Add optimistically
  await dataStore.products.addAsync(product);
  await dataStore.saveChangesAsync();

  // Query automatically updates with new data
}

function ProductsWithAdd() {
  const products = useQuery(
    (cb) => dataStore.products.subscribe().toArray(cb),
    []
  );

  const handleAdd = async (product: ProductData) => {
    await addProduct(product);
  };

  return (
    <>
      <AddProductForm onSubmit={handleAdd} />
      {/* Render products */}
    </>
  );
}
```

### Computed Values

Derive data from queries:

```tsx
function ProductStats() {
  const dataStore = useDataStore();

  const products = useQuery(
    (cb) => dataStore.products.subscribe().toArray(cb),
    []
  );

  const stats = useMemo(() => {
    if (products.status !== "success") return null;

    return {
      total: products.data!.length,
      totalValue: products.data!.reduce((sum, p) => sum + p.price, 0),
      averagePrice:
        products.data!.reduce((sum, p) => sum + p.price, 0) /
        products.data!.length,
    };
  }, [products]);

  if (products.status === "pending") return <Loading />;
  if (!stats) return null;

  return (
    <div>
      <p>Total Products: {stats.total}</p>
      <p>Total Value: ${stats.totalValue}</p>
      <p>Average Price: ${stats.averagePrice}</p>
    </div>
  );
}
```

## Anti-Patterns to Avoid

### Don't Call Queries Outside Components

```tsx
// ❌ Bad
const data = useQuery(/* ... */); // Called outside component

function MyComponent() {
  return <div>{data.data}</div>;
}

// ✅ Good
function MyComponent() {
  const data = useQuery(/* ... */); // Inside component
  return <div>{data.data}</div>;
}
```

### Don't Forget Dependencies

```tsx
// ❌ Bad - will not update when searchTerm changes
const products = useQuery(
  (cb) =>
    dataStore.products
      .where((p) => p.name.includes(searchTerm))
      .subscribe()
      .toArray(cb),
  [] // Missing searchTerm
);

// ✅ Good
const products = useQuery(
  (cb) =>
    dataStore.products
      .where((p) => p.name.includes(searchTerm))
      .subscribe()
      .toArray(cb),
  [searchTerm] // Include dependencies
);
```

### Don't Access Data Without Status Check

```tsx
// ❌ Bad
if (result.data) {
  // Could be undefined
  console.log(result.data);
}

// ✅ Good
if (result.status === "success") {
  console.log(result.data); // TypeScript knows data is defined
}
```

## Next Steps

- [React Hooks](/integrations/react/hooks/) - Learn about the `useQuery` hook
- [Live Queries Guide](/guides/live-queries/) - Understanding live queries
- [Optimistic Updates Guide](/guides/optimistic-updates/) - Using optimistic updates
- [State Management Guide](/guides/state-management/) - Managing application state
