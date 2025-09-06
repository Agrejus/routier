# Collection Modifiers

Collection-level modifiers extend entities with derived values and methods that are not direct stored fields.

## Computed

Create a derived value from the entity. By default, computed values are not persisted.

```typescript
const schema = s.define("users", {
  firstName: s.string(),
  lastName: s.string(),

  // Not persisted by default
  fullName: s.string().computed((user) => `${user.firstName} ${user.lastName}`),
});
```

### Tracked computed

Persist a computed value to the store for indexing/sorting and faster reads.

```typescript
const schema = s.define("orders", {
  items: s.array(s.object({ price: s.number(), quantity: s.number() })),

  // Persisted computed field
  total: s
    .number()
    .computed((order) =>
      order.items.reduce((sum, i) => sum + i.price * i.quantity, 0)
    )
    .tracked()
    .index(),
});
```

Notes:

- Use `.tracked()` when you need to query/index by the computed value.
- Tracked fields increase write cost due to recomputation/persistence.

## Function

Attach non-persisted methods to an entity.

```typescript
const schema = s.define("users", {
  firstName: s.string(),
  lastName: s.string(),

  // Method is not stored; available at runtime on entity instances
  greet: s.function((user) => `Hello, ${user.firstName}!`),
});
```

Behavior:

- Functions are not saved to the database.
- Use functions for domain helpers and computed behavior that returns ephemeral values.
