---
title: Schema Modifiers
---

# Schema Modifiers

Schema-level modifiers extend entities with derived values and methods that are not direct stored fields.

## Computed

Create a derived value from the entity. By default, computed values are not persisted.

<<< @/_snippets/code/from-docs/concepts/schema/modifiers/collection-modifiers/block-1.ts

### Tracked computed

Persist a computed value to the store for indexing/sorting and faster reads.

<<< @/_snippets/code/from-docs/concepts/schema/modifiers/collection-modifiers/block-2.ts

Notes:

- Use `.tracked()` when you need to query/index by the computed value.
- Tracked fields increase write cost due to recomputation/persistence.

## Function

Attach non-persisted methods to an entity.

<<< @/_snippets/code/from-docs/concepts/schema/modifiers/collection-modifiers/block-3.ts

Behavior:

- Functions are not saved to the database.
- Use functions for domain helpers and computed behavior that returns ephemeral values.
