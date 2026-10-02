# @routier/svelte

<p align="center">
  <img src="https://routier.dev/routier.svg" alt="Routier" width="140" height="140" />
</p>

Svelte stores for Routier. `liveQuery` turns a live Routier query into a readable store, in Svelte 4 or 5, with no compiler plugin.

## Install

```bash
npm install @routier/svelte
# peer dependencies (provided by your app)
npm install svelte
```

## liveQuery

```ts
function liveQuery<T>(
  query: (callback: (result: ResultType<T>) => void) => void | (() => void)
): Readable<LiveQueryState<T>>;
```

The state is a discriminated union on `status`:

| `status`    | Fields                          |
| ----------- | ------------------------------- |
| `"pending"` | `loading: true`                 |
| `"success"` | `data: T`, `isSuccess: true`    |
| `"error"`   | `error: Error`, `isError: true` |

- The query runs when the store gets its first subscriber, and every subscriber shares it.
- It unsubscribes when the last subscriber leaves, and starts again from `pending` on the next subscribe.
- To re-query when a value changes, `derived` from a store holding that value.

## Example

```svelte
<script lang="ts">
  import { liveQuery } from "@routier/svelte";
  import { store, type Product } from "./store";

  const products = liveQuery<Product[]>((onResult) => store.products.subscribe().toArray(onResult));
</script>

{#if $products.status === "success"}
  <ul>{#each $products.data as product (product.id)}<li>{product.name}</li>{/each}</ul>
{/if}
```

## Notes

- Svelte is a peer dependency and is not bundled.
- The package builds to ESM and CJS and ships TypeScript declarations.

Full guide: https://routier.dev/integrations/svelte/
