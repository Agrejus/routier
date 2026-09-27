---
title: Svelte
description: "Use Routier in Svelte with liveQuery: a readable store that follows a live query."
---

# Svelte Integration

`@routier/svelte` turns a Routier live query into a Svelte readable store. It works in Svelte 4 and Svelte 5, in `.svelte` components and in plain `.ts` modules, and needs no compiler plugin.

## Installation

```bash
npm install @routier/svelte
# peer dependency
npm install svelte
```

## liveQuery

```ts
function liveQuery<T>(
  query: (callback: (result: ResultType<T>) => void) => void | (() => void),
): Readable<LiveQueryState<T>>;
```

The store holds a discriminated union. Narrow on `status` before reading `data` or `error`:

| `status`    | Fields                          |
| ----------- | ------------------------------- |
| `"pending"` | `loading: true`                 |
| `"success"` | `data: T`, `isSuccess: true`    |
| `"error"`   | `error: Error`, `isError: true` |

### Lifecycle

The query runs when the store gets its first subscriber, which in a component is the first `$store` read. Every subscriber shares that one query. It unsubscribes when the last subscriber leaves, and starts again, from `pending`, if someone subscribes later. Results from a stopped subscription are ignored.

### Changing parameters

A store's query is fixed when you create it. To re-query when a value changes, derive from a store holding that value. `derived` stops the previous query each time the value changes:

<<< @/_snippets/code/integrations/svelte/products.ts

The `store` and `Product` come from a shared module, the same one the [Vue page](/integrations/vue/) uses.

## Example

```svelte
<script lang="ts">
  import { page, rows, total, pageSize } from "./products";

  const pageCount = $derived(Math.max(1, Math.ceil(($total.status === "success" ? $total.data : 0) / pageSize)));
</script>

{#if $rows.status === "error"}
  <p>{$rows.error.message}</p>
{:else if $rows.status === "success"}
  <ul>
    {#each $rows.data as product (product.id)}
      <li>{product.name}: {product.stock}</li>
    {/each}
  </ul>
{/if}
<button disabled={$page === 1} onclick={() => page.update((n) => n - 1)}>‹</button>
Page {$page} of {pageCount}
<button disabled={$page >= pageCount} onclick={() => page.update((n) => n + 1)}>›</button>
```

This is Svelte 5 syntax. In Svelte 4, use `$:` for `pageCount` and `on:click`; the stores themselves work the same in both.

## Sharing a store

Create the `DataStore` once, in a module, and import it where you need it. With SvelteKit, create it only in the browser, because live queries belong on the client.
