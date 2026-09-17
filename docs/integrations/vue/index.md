---
title: Vue
---

# Vue Integration

`@routier/vue` connects Routier live queries to Vue 3 components through a `useQuery` composable. It is the Vue counterpart of [`@routier/react`](/integrations/react/): the same query callbacks, the same `pending` / `success` / `error` state, with Vue's reactivity handling dependencies for you.

## Installation

```bash
npm install @routier/vue
# peer dependency
npm install vue
```

## useQuery

```ts
function useQuery<T>(
  query: (callback: (result: ResultType<T>) => void) => void | (() => void),
): Readonly<ShallowRef<LiveQueryState<T>>>;
```

The returned ref holds a discriminated union. Narrow on `status` before reading `data` or `error`:

| `status`    | Fields                          |
| ----------- | ------------------------------- |
| `"pending"` | `loading: true`                 |
| `"success"` | `data: T`, `isSuccess: true`    |
| `"error"`   | `error: Error`, `isError: true` |

### No dependency array

The query runs inside `watchEffect`, so every ref it reads is tracked automatically. Change `page.value` and the composable unsubscribes the old query, returns to `pending`, and subscribes to the new page. Results from a subscription that has already been replaced are ignored, so a slow page cannot overwrite a newer one.

### Cleanup

The subscription stops with the component, or with the `effectScope` that created it. You do not unsubscribe by hand.

## Example: a live, paginated grid

A store module shared by every component:

<<< @/_snippets/code/home/inventory.ts

A component that pages through it. Changing `page` resubscribes to the new page, and editing a row refreshes every live query that includes it:

```vue
<script setup lang="ts">
import { computed, ref } from "vue";
import { useQuery } from "@routier/vue";
import { store, type Product } from "./inventory";

const page = ref(1);
const pageSize = 6;

const rows = useQuery<Product[]>(onResult =>
  store.products
    .sort(p => p.name)
    .skip((page.value - 1) * pageSize)
    .take(pageSize)
    .subscribe()
    .toArray(onResult),
);

const total = useQuery<number>(onResult => store.products.subscribe().count(onResult));
const pageCount = computed(() =>
  Math.max(1, Math.ceil((total.value.status === "success" ? total.value.data : 0) / pageSize)),
);

async function restock(product: Product) {
  product.stock += 10;
  await store.saveChangesAsync();
}
</script>

<template>
  <p v-if="rows.status === 'error'">{{ rows.error.message }}</p>
  <ul v-else-if="rows.status === 'success'">
    <li v-for="product in rows.data" :key="product.id">
      {{ product.name }}: {{ product.stock }}
      <button @click="restock(product)">+10</button>
    </li>
  </ul>
  <button :disabled="page === 1" @click="page--">‹</button>
  Page {{ page }} of {{ pageCount }}
  <button :disabled="page >= pageCount" @click="page++">›</button>
</template>
```

The full component behind the Vue view of the [homepage demo](/#showcase) is in [`docs/_snippets/code/home/ProductGrid.vue`](https://github.com/Agrejus/routier/blob/main/docs/_snippets/code/home/ProductGrid.vue).

## Sharing a store

Create the `DataStore` once, in a module as above or with `provide` / `inject`, and read it from components. Creating a store inside `setup` gives every component instance its own database.

## Server-side rendering

Live queries belong in the browser. With Nuxt or VitePress, render components that subscribe inside `<ClientOnly>`, or create the store only on the client.
