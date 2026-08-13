---
title: Reusable Queries
---

# Reusable Queries (Query Composer)

`Queryable.compose(schema)` builds a query definition without a store or collection. Later, pass that definition to `collection.apply(...)` and execute it normally.

It is similar to a stored procedure in how application code uses it—a named, parameterized query that can be invoked repeatedly—but it is **not stored in the database**. Routier retains the query operations and translates them for whichever plugin executes the collection.

## Define, apply, execute

```ts
import { Queryable } from "@routier/datastore";
import { productSchema } from "./schemas";

export const availableProducts = (category: string, minimumStock = 1) =>
  Queryable.compose(productSchema)
    .where(
      (product, params) =>
        product.category === params.category &&
        product.stock >= params.minimumStock,
      { category, minimumStock },
    )
    .sort(product => product.name);
```

Apply it to a collection and choose a terminal operation:

```ts
const query = availableProducts("hardware", 5);

const rows = await store.products
  .apply(query)
  .toArrayAsync();

const count = await store.products
  .apply(availableProducts("hardware", 5))
  .countAsync();
```

The composer does not execute anything. `apply()` attaches its recorded operations to the collection; `toArrayAsync()`, `countAsync()`, or another terminal method performs the read.

## Why use one

- Keep query policy next to domain code instead of UI code.
- Reuse the same definition from HTTP handlers, jobs, and components.
- Unit-test query construction separately from storage setup.
- Pass ordinary typed parameters instead of rebuilding predicates at each call site.
- Apply the definition to any compatible collection using the same root schema.

```ts
export const expensiveProducts = (minimumPrice: number) =>
  Queryable.compose(productSchema)
    .where((product, params) => product.price >= params.minimumPrice, {
      minimumPrice,
    });

await primary.products.apply(expensiveProducts(100)).toArrayAsync();
await replica.products.apply(expensiveProducts(100)).toArrayAsync();
```

## Supported composer operations

Before `apply()`, `QueryableComposer` exposes:

| Operation | Purpose |
| --- | --- |
| `.where(predicate)` | Add a filter |
| `.where(predicate, params)` | Add a parameterized filter |
| `.map(selector)` | Project to a new shape |
| `.sort(selector)` | Sort ascending |
| `.sortDescending(selector)` | Sort descending |
| `.skip(count)` | Skip rows |
| `.take(count)` | Limit rows |

The staged types prevent invalid pagination ordering—for example, `skip()` is not available after `take()`.

A composer intentionally has no terminal methods because it has no collection to execute against.

## Continue composing after apply

`apply()` returns a normal `QueryableAsync`, so collection-dependent operations can follow it:

```ts
const base = availableProducts("hardware");

const firstPage = await store.products
  .apply(base)
  .take(20)
  .toArrayAsync();

const nearest = await store.products
  .apply(base)
  .nearest(product => product.embedding, queryEmbedding, 10)
  .toArrayAsync();

const suppliers = await store.products
  .apply(base)
  .join(s => s.suppliers, product => product.supplierId, supplier => supplier.id)
  .toArrayAsync();
```

`search()` is not a composer operation. Full-text search starts from a collection because it needs that collection's generated search-index registration.

## Prefer factories for parameterized definitions

Return a fresh composer from a function:

```ts
export const productsForTenant = (tenantId: string) =>
  Queryable.compose(productSchema)
    .where((product, params) => product.tenantId === params.tenantId, {
      tenantId,
    });
```

This keeps each invocation self-contained and avoids accidentally adding more operations to a shared definition while constructing another query.

## Direct query versus reusable query

| Direct | Reusable |
| --- | --- |
| `store.products.where(...).toArrayAsync()` | `store.products.apply(productsForTenant(id)).toArrayAsync()` |
| Starts from a collection | Starts from a compiled schema |
| Best for one call site | Best for named application query policy |
| Executes at a terminal method | Still executes only after `apply()` and a terminal method |

## API names

The public API is:

```ts
Queryable.compose(compiledSchema)
collection.apply(composer)
```

There is no separate public `query()` or `createQuery()` method. `Query` in `@routier/core/plugins` is the lower-level plugin request model, not the application-facing reusable-query builder.

## Related

- [Query Overview](/concepts/queries/)
- [Filtering](/concepts/queries/filtering)
- [Joins](/concepts/queries/joins)
- [Vector Search](/concepts/queries/vector-search)
- [Query Architecture](/concepts/query-architecture)
