# @routier/react

Lightweight React bindings for Routier collections. This package exports the `useQuery` hook to subscribe to live query results with a simple callback interface.

## Install

```bash
npm install @routier/react
# peer deps (provided by your app)
npm install react react-dom
```

Ensure your bundler/app resolves a single copy of React. This package declares React as a peer dependency and does not bundle it.

## Exports

```ts
import { useQuery } from "@routier/react";
```

## useQuery

Signature:

```ts
function useQuery<T>(
  subscribe: (callback: (result: ResultType<T>) => void) => void | (() => void),
  deps?: any[]
): {
  status: "pending" | "success" | "error";
  loading: boolean;
  error: Error | null;
  data: T | undefined;
};
```

Behavior:

- Subscribes to your data source and updates when the callback fires.
- Returns a simple state object: `{ status, loading, error, data }`.
- Unsubscribes automatically on unmount or dep changes if you return a cleanup function from `subscribe`.

### Examples

Count example:

```ts
const productCount = useQuery<number>(
  (cb) => dataStore.products.subscribe().count(cb),
  []
);

if (productCount.status === "success") {
  console.log(productCount.data);
}
```

Array example:

```ts
const products = useQuery<any[]>(
  (cb) => dataStore.products.subscribe().toArray(cb),
  []
);

if (products.status === "success") {
  products.data?.forEach((p) => console.log(p.name));
}
```

Custom subscription with cleanup:

```ts
useQuery(
  (cb) => {
    const sub = dataStore.products.subscribe();
    const unsubscribe = sub.onChange(() => sub.toArray(cb));
    // initial emit
    sub.toArray(cb);
    return unsubscribe;
  },
  [
    /* deps */
  ]
);
```

## Troubleshooting: Invalid hook call

If you see "Invalid hook call":

1. Ensure a single React instance in your app (`npm ls react`).
2. Do not import internal source files; import from `@routier/react`.
3. Your bundler should alias `react` and `react-dom` to the app’s `node_modules` (monorepo setups):

```js
// webpack/rspack
resolve: {
  alias: {
    react: path.resolve(__dirname, 'node_modules/react'),
    'react-dom': path.resolve(__dirname, 'node_modules/react-dom')
  }
}
```

## Notes

- React is a peer dependency (not bundled).
- The library builds to ESM and CJS and ships TypeScript declarations.
