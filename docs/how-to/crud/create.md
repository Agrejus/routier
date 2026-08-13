---
title: Create Operations
---

# Create Operations

Create operations in Routier allow you to add new entities to your collections. The framework provides both synchronous and asynchronous methods, with automatic change tracking and type safety.

## Quick Navigation

- [Overview](#overview)
- [Basic Create Operations](#basic-create-operations)
- [Schema-Driven Creation](#schema-driven-creation)
- [Type Safety and Error Handling](#type-safety-and-error-handling)
- [Advanced Create Patterns](#advanced-create-patterns)
- [Performance Considerations](#performance-considerations)
- [Best Practices](#best-practices)
- [Common Patterns](#common-patterns)
- [Next Steps](#next-steps)

## Overview

When you create entities in Routier:

1. **Entities are type-checked** against your schema
2. **Default values are applied** automatically
3. **Identity fields are generated** if specified
4. **Changes are tracked** for later persistence
5. **Entities are returned** with all properties set

## ⚠️ Important: Persistence Requires Save

**Note: When you call `addAsync()`, the entity is added to the collection in memory, but it is NOT automatically persisted to the database. You must call `saveChanges()` or `saveChangesAsync()` to persist the changes.**

## Basic Create Operations

### Adding Single Entities

The simplest way to create a new entity is using `addAsync()`:

<<< @/_snippets/code/from-docs/how-to/crud/create/single-entity.ts

### Adding Multiple Entities

You can add multiple entities in a single operation for better performance:

<<< @/_snippets/code/from-docs/how-to/crud/create/multiple-entities.ts

### Adding with Callbacks

For advanced scenarios, you can use callback-based operations with error handling:

<<< @/_snippets/code/from-docs/how-to/crud/create/callback-pattern.ts

## Schema-Driven Creation

### Automatic Default Values

Routier automatically applies default values defined in your schema:

<<< @/_snippets/code/from-docs/how-to/crud/create/default-values.ts

### Identity Field Generation

Identity fields are automatically generated when creating new entities:

<<< @/_snippets/code/from-docs/how-to/crud/create/identity-generation.ts

### Nested Object Creation

You can create entities with nested objects and arrays:

<<< @/_snippets/code/from-docs/how-to/crud/create/nested-objects.ts

## Type Safety and Error Handling

### Schema Type Checking

Routier provides compile-time type safety through TypeScript:

<<< @/_snippets/code/from-docs/how-to/crud/create/schema-type-checking.ts

### TypeScript Type Safety

Use `InferCreateType` for proper type inference:

<<< @/_snippets/code/from-docs/how-to/crud/create/typescript-type-safety.ts

### Constraint Enforcement

Constraint enforcement depends on your plugin implementation:

<<< @/_snippets/code/from-docs/how-to/crud/create/constraint-enforcement.ts

## Advanced Create Patterns

### Conditional Creation

Create entities based on conditions or business logic:

<<< @/_snippets/code/from-docs/how-to/crud/create/conditional-creation.ts

### Batch Creation with Type Safety

Create multiple entities with proper type checking:

<<< @/_snippets/code/from-docs/how-to/crud/create/batch-creation.ts

### Creation with Computed Fields

Create entities that include computed or derived fields:

<<< @/_snippets/code/from-docs/how-to/crud/create/computed-fields.ts

## Performance Considerations

### Batch Creation

Batch creation is more efficient than individual creates:

<<< @/_snippets/code/from-docs/how-to/crud/create/batch-performance.ts

### Memory Management

Consider memory usage when creating large numbers of entities:

<<< @/_snippets/code/from-docs/how-to/crud/create/memory-management.ts

## Best Practices

### 1. **Type-Check Data Before Creation**

Validate data before creating entities:

<<< @/_snippets/code/from-docs/how-to/crud/create/type-check-data.ts

### 2. **Use Appropriate Default Values**

Define meaningful default values in your schema:

<<< @/_snippets/code/from-docs/how-to/crud/create/appropriate-defaults.ts

### 3. **Handle Errors Gracefully**

Implement proper error handling for create operations:

<<< @/_snippets/code/from-docs/how-to/crud/create/handle-errors.ts

### 4. **Leverage Schema Features**

Use schema features like enums, defaults, and constraints effectively:

<<< @/_snippets/code/from-docs/how-to/crud/create/leverage-schema-features.ts

## Common Patterns

### User Registration


<<< @/_snippets/code/from-docs/how-to/crud/create/block-1.ts


### Product Catalog Management


<<< @/_snippets/code/from-docs/how-to/crud/create/block-2.ts


### Bulk Data Import


<<< @/_snippets/code/from-docs/how-to/crud/create/block-3.ts


## Next Steps

- [Data Manipulation](/guides/data-manipulation) - Learn about proxy-based updates and array/object manipulation
- [Read Operations](/how-to/crud/read) - Learn how to query and retrieve data
- [Update Operations](/how-to/crud/update) - Learn how to modify existing entities
- [Delete Operations](/how-to/crud/delete) - Learn how to remove entities
- [Bulk Operations](/how-to/crud/bulk/README) - Learn how to handle multiple entities efficiently
