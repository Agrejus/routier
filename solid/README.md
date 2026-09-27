# @routier/solid

<p align="center">
  <img src="https://routier.dev/routier.svg" alt="Routier" width="140" height="140" />
</p>

Solid signals for Routier. `createLiveQuery` turns a live Routier query into a signal, and tracks the signals the query reads.

## Install

```bash
npm install @routier/solid
# peer dependencies (provided by your app)
npm install solid-js
```

## createLiveQuery

```ts
function createLiveQuery<T>(
  query: (callback: (result: ResultType<T>) => void) => void | (() => void)
): Accessor<LiveQueryState<T>>;
```

The state is a discriminated union on `status`:

| `status`    | Fields                          |
| ----------- | ------------------------------- |
| `"pending"` | `loading: true`                 |
| `"success"` | `data: T`, `isSuccess: true`    |
| `"error"`   | `error: Error`, `isError: true` |

- The query runs in an effect. Signals it reads are dependencies: when one changes, the previous subscription stops and the query runs again from `pending`.
- The subscription stops when its owner is disposed.

## Example

```tsx
import { createSignal, For } from "solid-js";
import { createLiveQuery } from "@routier/solid";
import { store, type Product } from "./store";

export function Products() {
  const [page, setPage] = createSignal(1);
  const rows = createLiveQuery<Product[]>((onResult) =>
    store.products.sort((p) => p.name).skip((page() - 1) * 10).take(10).subscribe().toArray(onResult),
  );
  const products = () => {
    const state = rows();
    return state.status === "success" ? state.data : [];
  };

  return (
    <>
      <ul><For each={products()}>{(product) => <li>{product.name}</li>}</For></ul>
      <button onClick={() => setPage(page() + 1)}>Next</button>
    </>
  );
}
```

## Notes

- Solid is a peer dependency and is not bundled.
- The package builds to ESM and CJS and ships TypeScript declarations.

Full guide: https://routier.dev/integrations/solid/
