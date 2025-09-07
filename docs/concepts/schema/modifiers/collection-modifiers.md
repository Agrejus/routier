---
title: Collection Modifiers
layout: default
parent: Schema
grand_parent: Concepts
nav_order: 3
---

# Collection Modifiers

Collection-level modifiers extend entities with derived values and methods that are not direct stored fields.

## Computed

Create a derived value from the entity. By default, computed values are not persisted.



{% capture snippet_924ccs %}{% include code/%}{% endcapture %}

```ts
{{ snippet_924ccs | escape }}
```


### Tracked computed

Persist a computed value to the store for indexing/sorting and faster reads.



{% capture snippet_fv4rns %}{% include code/%}{% endcapture %}

```ts
{{ snippet_fv4rns | escape }}
```


Notes:

- Use `.tracked()` when you need to query/index by the computed value.
- Tracked fields increase write cost due to recomputation/persistence.

## Function

Attach non-persisted methods to an entity.



{% capture snippet_nft04r %}{% include code/%}{% endcapture %}

```ts
{{ snippet_nft04r | escape }}
```


Behavior:

- Functions are not saved to the database.
- Use functions for domain helpers and computed behavior that returns ephemeral values.
