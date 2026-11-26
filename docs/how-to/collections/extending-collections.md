---
title: Extending Collections
---

## Extending Collections

You can extend a generated collection to add domain-specific helpers while preserving typing and change tracking. This allows you to encapsulate business logic and create intent-revealing APIs specific to your domain.

## Quick Navigation

- [Basic Example](#basic-example)
- [Adding Helper Methods](#adding-helper-methods)
- [Passing Your Own Values](#passing-your-own-values)
- [Recipe: Upsert and Remove by Query](#recipe-upsert-and-remove-by-query)
- [Recipe: Undo and Redo](#recipe-undo-and-redo)
- [Notes](#notes)
- [When to Use](#when-to-use)

### Basic Example

Write a class that extends `Collection`. Then pass a function to `create()` that builds it:

<<< @/_snippets/code/from-docs/how-to/collections/extending-collections/block-1.ts

- `create()` calls your function with two arguments. The second one, `dependencies`, is what the base `Collection` needs. Pass it to your class.
- Give the property its type: `users: UserCollection = ...`.
- `findOrCreateByEmailAsync` combines a query and an add.
- `activatePendingUsersAsync` combines a query and an update.
- A query reads saved rows, so the example saves the new user before it activates pending users.

### Adding Helper Methods

A collection class can hold as many methods as you need:

<<< @/_snippets/code/from-docs/how-to/collections/extending-collections/block-2.ts

This example demonstrates:

- Methods that combine multiple operations (`restockAndUpdatePriceAsync`)
- Query helpers with parameters (`findLowStockAsync`)
- Bulk operations that work with multiple entities (`bulkRestockAsync`)

### Passing Your Own Values

Your class can take more than `dependencies`. Add your own constructor parameters, and pass the values in the function you give to `create()`:

<<< @/_snippets/code/from-docs/how-to/collections/extending-collections/own-values.ts

- `OrderCollection` takes a `Clock` after `dependencies`. Its constructor passes `dependencies` to `super`.
- `CollectionDependencies` is the type of `dependencies`. Import it from `@routier/datastore`.
- The store takes the clock in its own constructor. It builds the collection there, after `super(...)`, so the clock is in scope.
- In tests, pass a fixed clock. `placedAt` is then the same on every run.
- Pass a logger, an API client or the signed-in user the same way.

### Recipe: Upsert and Remove by Query

Routier has no built-in upsert. Add one to your own collection. `upsertAsync` looks the row up by its key. It adds the row when it is missing, and it updates the row when it exists:

<<< @/_snippets/code/from-docs/how-to/collections/extending-collections/upsert.ts

- Removing by query is built in: `where(...).removeAsync()` removes every matching row. `removeByEmailDomainAsync` gives that query a name.
- Like every change, the upsert is saved by `saveChangesAsync()`.

### Recipe: Undo and Redo

The collection can keep its own undo and redo stacks. `edit` records each row before and after a change. `undo` and `redo` put a row back to one of those states:

<<< @/_snippets/code/from-docs/how-to/collections/extending-collections/undo-redo.ts

- Each undo or redo is a normal change, so save it with `saveChangesAsync()`.
- The stacks live in memory and cover edits made through `edit`. They are empty again after a reload.
- For a history that lasts across reloads, or that covers adds and removes, record changes with [`.audit()`](/guides/history-tracking).

### Notes

- Write a named class that extends `Collection`, and pass `(_, dependencies) => new MyCollection(dependencies)` to `create()`.
- Give the property its type, as in `products: ProductCollection = ...`. Without it, TypeScript's `strict` mode reports that the property "implicitly has type 'any'".
- The first argument to your function is the base collection class. An anonymous `class extends` that argument hits the same `strict` error, so prefer a named class.
- Prefer cohesive, high-level helpers (e.g. `addWithDefaults`, `findLowStock`, `bulkRestock`) over simple wrappers.
- All methods from the selected mode remain available (`where`, `map`, `toArrayAsync`, and, for writable modes, `addAsync`, `removeAsync`, attachments, etc.).
- Extended collections keep full type safety. TypeScript infers types from your schema.
- Changes made through custom methods are tracked like any other change. Persist them with `store.saveChangesAsync()`.

### When to Use

Extend collections when you want to:

- **Encapsulate repeated operations**: If you find yourself writing the same query and update pattern multiple times, extract it into a custom method.
- **Provide domain-specific APIs**: Create methods that express your business logic clearly (e.g. `activatePendingUsers` instead of querying and updating manually).
- **Combine multiple operations**: Group related operations into single methods that make your code more readable and maintainable.
- **Add validation or business rules**: Enforce domain constraints in custom methods before calling base collection methods.
