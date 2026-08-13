---
title: Extending Collections
---

## Extending Collections

You can extend a generated collection to add domain-specific helpers while preserving typing and change tracking. This allows you to encapsulate business logic and create intent-revealing APIs specific to your domain.

## Quick Navigation

- [Basic Example](#basic-example)
- [Adding Helper Methods](#adding-helper-methods)
- [Combining Operations](#combining-operations)
- [Notes](#notes)
- [When to Use](#when-to-use)

### Basic Example

The simplest way to extend a collection is to add custom methods using the `create()` method:

<<< @/_snippets/code/from-docs/how-to/collections/extending-collections/block-1.ts

This example shows how to add helper methods that:

- Combine query and create operations (`findOrCreateByEmailAsync`)
- Combine querying and updates in a single operation (`activatePendingUsersAsync`)
- Maintain full type safety and change tracking

### Adding Helper Methods

You can add any number of custom methods that work with your collection's data:

<<< @/_snippets/code/from-docs/how-to/collections/extending-collections/block-2.ts

This example demonstrates:

- Methods that combine multiple operations (`restockAndUpdatePriceAsync`)
- Query helpers with parameters (`findLowStockAsync`)
- Bulk operations that work with multiple entities (`bulkRestockAsync`)

### Notes

- The `create((Instance, ...args) => new class extends Instance { ... })` pattern ensures the subclass receives the same constructor args and types as the base collection.
- Always call `super(...args)` in the constructor to properly initialize the base collection.
- Prefer adding cohesive, high-level helpers (e.g. `addWithDefaults`, `findLowStock`, `bulkRestock`) rather than simple wrappers.
- All methods from the selected mode remain available (`where`, `map`, `toArrayAsync`, and—for writable modes—`addAsync`, `removeAsync`, attachments, etc.).
- Extended collections maintain full type safety - TypeScript will infer types from your schema automatically.
- Changes made through custom methods are tracked like standard operations. Persist them with `store.saveChangesAsync()`.

### When to Use

Extend collections when you want to:

- **Encapsulate repeated operations**: If you find yourself writing the same query and update pattern multiple times, extract it into a custom method.
- **Provide domain-specific APIs**: Create methods that express your business logic clearly (e.g. `activatePendingUsers` instead of querying and updating manually).
- **Combine multiple operations**: Group related operations into single methods that make your code more readable and maintainable.
- **Add validation or business rules**: Enforce domain constraints in custom methods before calling base collection methods.

### Combining Operations

Extended collections work seamlessly with all base collection features. You can use queries, change tracking, and persistence within your custom methods:


<<< @/_snippets/code/from-docs/how-to/collections/extending-collections/block-1.ts

