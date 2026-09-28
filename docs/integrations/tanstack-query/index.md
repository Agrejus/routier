---
title: TanStack Query
description: "Keep TanStack Query as your cache layer and feed it Routier live queries with liveQueryOptions."
---

# TanStack Query Integration

`@routier/tanstack-query` lets a team that already uses TanStack Query adopt Routier without dropping its cache layer. `liveQueryOptions` turns a Routier live query into query options: the first result resolves the query, and every later result is written into the TanStack cache, so components re-render as the data changes.

It's built on `@tanstack/query-core`, so the same options work with React Query, Vue Query, Solid Query, Svelte Query, and Angular Query.

## Installation

```bash
npm install @routier/tanstack-query
# plus the TanStack adapter you already use, for example
npm install @tanstack/react-query
```

Requires `@tanstack/query-core` 5.66 or later, which every current adapter includes.

## liveQueryOptions

```ts
function liveQueryOptions<T, TKey extends QueryKey>(options: {
  queryKey: TKey;
  query: (callback: (result: ResultType<T>) => void) => void | (() => void);
}): { queryKey: TKey; queryFn: (context) => Promise<T>; staleTime: number };
```

<<< @/_snippets/code/integrations/tanstack-query/products.ts

```tsx
import { useQuery } from "@tanstack/react-query";
import { lowStockQuery } from "./products";

export function LowStock() {
  const { data, isPending, error } = useQuery(lowStockQuery(5));

  if (isPending) return <p>Loading…</p>;
  if (error) return <p>{error.message}</p>;

  return <ul>{data.map((p) => <li key={p.id}>{p.name}: {p.stock}</li>)}</ul>;
}
```

## How it behaves

- **The first result resolves the query.** A first result that is an error rejects it, so TanStack's `error` state and `retry` apply as usual.
- **Later results go into the cache** with `setQueryData`, so every component using that key updates. There is no refetch and no network request.
- **A later error invalidates the query.** TanStack then runs the query function again, and its error handling takes over.
- **`staleTime` is `Infinity`.** The data is live, so window focus and remounts don't refetch it. Spread the options and override `staleTime` if you want that anyway.
- **One subscription per key and client.** If TanStack runs the query function again, for example after `refetch()`, the previous subscription stops. The subscription also stops when TanStack removes the query from its cache, after `gcTime` with no observers.

## When to use this instead of a framework binding

Use it when TanStack Query is already how your app loads and caches data, or when you want its devtools, `select`, and suspense support on top of Routier. Otherwise the framework bindings ([React](/integrations/react/), [Vue](/integrations/vue/), [Svelte](/integrations/svelte/), [Solid](/integrations/solid/), [Angular](/integrations/angular/)) are simpler: one fewer cache between the store and the component.
