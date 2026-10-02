# @routier/vue

<p align="center">
  <img src="https://routier.dev/routier.svg" alt="Routier" width="140" height="140" />
</p>

Vue 3 composables for Routier collections. This package exports `useQuery`, which turns a live Routier query into a reactive ref.

## Install

```bash
npm install @routier/vue
# peer dependency (provided by your app)
npm install vue
```

## useQuery

```ts
function useQuery<T>(
  query: (callback: (result: ResultType<T>) => void) => void | (() => void)
): Readonly<ShallowRef<LiveQueryState<T>>>;
```

`LiveQueryState<T>` is a discriminated union on `status`:

| `status`    | Fields                                                   |
| ----------- | -------------------------------------------------------- |
| `"pending"` | `loading: true`                                          |
| `"success"` | `data: T`, `isSuccess: true`                             |
| `"error"`   | `error: Error`, `isError: true`                          |

Behavior:

- The query runs inside `watchEffect`. Any ref or reactive value it reads becomes a dependency, so there is no dependency array to maintain.
- When a dependency changes, the previous subscription is unsubscribed, the state returns to `pending`, and the query runs again.
- Results from a subscription that has been replaced are ignored, so a slow page never overwrites a newer one.
- The subscription stops with the component or effect scope that created it.

## Example

```vue
<script setup lang="ts">
import { ref } from "vue";
import { useQuery } from "@routier/vue";
import { store, type Product } from "./store";

const page = ref(1);
const pageSize = 10;

const products = useQuery<Product[]>((onResult) =>
  store.products
    .sort((p) => p.name)
    .skip((page.value - 1) * pageSize)
    .take(pageSize)
    .subscribe()
    .toArray(onResult),
);
</script>

<template>
  <p v-if="products.status === 'pending'">Loading…</p>
  <p v-else-if="products.status === 'error'">{{ products.error.message }}</p>
  <ul v-else>
    <li v-for="product in products.data" :key="product.id">{{ product.name }}</li>
  </ul>
  <button @click="page++">Next page</button>
</template>
```

Keep one store instance for the app, for example in a module or with `provide`/`inject`, so every component shares the same data and subscriptions.

## Notes

- Vue is a peer dependency and is not bundled. Make sure your app resolves a single copy of Vue.
- The package builds to ESM and CJS and ships TypeScript declarations.
