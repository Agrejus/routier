---
title: Queries
layout: default
parent: Concepts
nav_order: 2
has_children: true
permalink: /concepts/queries/
---

## Queries

Routier queries are fluent and can only be performed through a collection. Build your query by chaining operations and finish with a terminal method to execute.

### Key points

- **Queries run via a collection**: `context.users.where(u => u.name === "James").firstOrUndefinedAsync()`
- **Chaining is lazy**: nothing executes until you call a terminal method like `toArrayAsync()` or `firstAsync()`.
- **Both async Promises and callback styles are supported** for all terminal operations.

### Basic querying

{% capture snippet_toc7ki %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{
  {
    snippet_toc7ki | escape;
  }
}
```

### Filtering with where

{% capture snippet_wfoe49 %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{
  {
    snippet_wfoe49 | escape;
  }
}
```

### Sorting

{% capture snippet_kwlaer %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{
  {
    snippet_kwlaer | escape;
  }
}
```

### Selecting fields with map

{% capture snippet_hkwyrg %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{
  {
    snippet_hkwyrg | escape;
  }
}
```

### Pagination

{% capture snippet_9ysmzy %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{
  {
    snippet_9ysmzy | escape;
  }
}
```

### Aggregation and set operations

{% capture snippet_cy63oz %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{
  {
    snippet_cy63oz | escape;
  }
}
```

### Terminal methods (execute the query)

- **toArray / toArrayAsync**: return all results
- **first / firstAsync**: first item, throws if none
- **firstOrUndefined / firstOrUndefinedAsync**: first item or undefined
- **some / someAsync**: any match
- **every / everyAsync**: all match (evaluated client-side against the result set)
- **min/max/sum (and Async)**: numeric aggregations
- **count / countAsync**: count of items
- **distinct / distinctAsync**: unique set of current shape
- **remove / removeAsync**: delete items matching the current query

Example removal:

{% capture snippet_8vys4s %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{
  {
    snippet_8vys4s | escape;
  }
}
```

### Notes

- `where` supports either a simple predicate `(item) => boolean` or a parameterized predicate `(item, params) => boolean` with a params object.
- To get distinct values of a specific field, use `map` to project that field before calling `distinctAsync()`.
- For live results, see Live Queries; you can chain `.subscribe()` before a terminal method to receive updates.

### Computed or unmapped properties

When filtering on a computed or unmapped property (not tracked in the database), the filter runs in memory. If you start your query with only computed/unmapped filters, the system will load records first and then apply those filters client‑side.

Best practice: apply database‑backed filters first, then computed/unmapped filters. This minimizes the number of records that need to be loaded into memory.

Example (in this schema, `firstName` is stored in the database while `age` is a computed property):

{% capture snippet_muj42f %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{
  {
    snippet_muj42f | escape;
  }
}
```

### Related

- [Expressions](/concepts/queries/expressions/)
- [Query Options](/concepts/queries/query-options/)
