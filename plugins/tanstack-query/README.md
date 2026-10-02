# @routier/tanstack-query

<p align="center">
  <img src="https://routier.dev/routier.svg" alt="Routier" width="140" height="140" />
</p>

Feed Routier live queries into TanStack Query. `liveQueryOptions` returns query options whose first result resolves the query and whose later results are written into the cache. Built on `@tanstack/query-core` 5.66 or later, so it works with every TanStack adapter.

## Install

```bash
npm install @routier/tanstack-query
# peer dependencies (provided by your app)
npm install @tanstack/react-query
```

## liveQueryOptions

```ts
function liveQueryOptions<T, TKey extends QueryKey>(options: {
  queryKey: TKey;
  query: (callback: (result: ResultType<T>) => void) => void | (() => void);
}): { queryKey: TKey; queryFn: (context) => Promise<T>; staleTime: number };
```

- The first result resolves the query; a first error rejects it, so TanStack's error state and retries apply.
- Later results are written with `setQueryData`. A later error invalidates the query.
- `staleTime` is `Infinity`, because the data is live.
- The subscription stops when TanStack removes the query from its cache, or when the query function runs again.

## Example

```tsx
import { useQuery } from "@tanstack/react-query";
import { liveQueryOptions } from "@routier/tanstack-query";
import { store, type Product } from "./store";

const productsQuery = liveQueryOptions<Product[], ["products"]>({
  queryKey: ["products"],
  query: (onResult) => store.products.subscribe().toArray(onResult),
});

export function Products() {
  const { data } = useQuery(productsQuery);
  return <ul>{data?.map((p) => <li key={p.id}>{p.name}</li>)}</ul>;
}
```

## Notes

- TanStack Query is a peer dependency and is not bundled.
- The package builds to ESM and CJS and ships TypeScript declarations.

Full guide: https://routier.dev/integrations/tanstack-query/
