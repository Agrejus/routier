---
title: Solid
description: "Use Routier in Solid with createLiveQuery: a signal that follows a live query and tracks its own dependencies."
---

# Solid Integration

`@routier/solid` turns a Routier live query into a Solid signal. Signals the query reads are tracked, so there is no dependency list to maintain.

## Installation

```bash
npm install @routier/solid
# peer dependency
npm install solid-js
```

## createLiveQuery

```ts
function createLiveQuery<T>(
  query: (callback: (result: ResultType<T>) => void) => void | (() => void),
): Accessor<LiveQueryState<T>>;
```

The accessor returns a discriminated union. Narrow on `status` before reading `data` or `error`:

| `status`    | Fields                          |
| ----------- | ------------------------------- |
| `"pending"` | `loading: true`                 |
| `"success"` | `data: T`, `isSuccess: true`    |
| `"error"`   | `error: Error`, `isError: true` |

### Tracking

The query runs inside an effect. Any signal it reads while building the query becomes a dependency. When one changes, the previous subscription stops, the state returns to `pending`, and the query runs again. Results from a stopped subscription are ignored.

### Cleanup

The subscription stops when its owner is disposed: the component, or the root that created it.

## Example

<<< @/_snippets/code/integrations/solid/products.ts

`products` and `error` narrow the state once, so the JSX only reads plain values:

```tsx
import { For, Show } from "solid-js";
import { createProductPage } from "./products";

export function ProductGrid() {
  const { page, setPage, products, error } = createProductPage();

  return (
    <>
      <Show when={error()}>{(message) => <p>{message()}</p>}</Show>
      <ul>
        <For each={products()}>{(product) => <li>{product.name}: {product.stock}</li>}</For>
      </ul>
      <button disabled={page() === 1} onClick={() => setPage(page() - 1)}>‹</button>
      <button onClick={() => setPage(page() + 1)}>›</button>
    </>
  );
}
```

`store` and `Product` come from a shared module, the same one the [Vue page](/integrations/vue/) uses.

## Server-side rendering

Effects don't run during SolidStart's server render, so the state stays `pending` there and the query starts in the browser.
