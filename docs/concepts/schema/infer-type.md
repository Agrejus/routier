---
title: InferType
---

# InferType

`InferType` is a TypeScript utility type that extracts the runtime type of entities from Routier schemas. It provides compile-time type safety by inferring the actual TypeScript type that corresponds to your schema definition.

## Quick Navigation

- [What is InferType?](#what-is-infertype)
- [Basic Usage](#basic-usage)
- [InferType vs InferCreateType](#infertype-vs-infercreatetype)
- [Real-World Examples](#real-world-examples)
- [Type Safety Benefits](#type-safety-benefits)
- [Best Practices](#best-practices)
- [Related](#related)

## What is InferType?

`InferType` takes a compiled schema and returns the TypeScript type that represents the actual entity structure at runtime. This includes:

- **All properties** defined in your schema
- **Applied modifiers** like `optional()`, `nullable()`, `default()`
- **Nested objects and arrays** with their complete structure
- **Computed properties** and their return types

## Basic Usage


<<< @/_snippets/code/from-docs/concepts/schema/infertype-basic.ts

## InferType vs InferCreateType

Routier provides two related type utilities:

### InferType

- **Purpose**: Represents the complete entity after creation
- **Includes**: All properties, including those with defaults and identities
- **Use case**: Working with existing entities from the database

### InferCreateType

- **Purpose**: Represents the entity structure for creation
- **Excludes**: Properties with defaults (optional) and identity properties (auto-generated)
- **Use case**: Creating new entities with `addAsync()`


<<< @/_snippets/code/from-docs/concepts/schema/infertype-comparison.ts

## Real-World Examples

### Function Parameters


<<< @/_snippets/code/from-docs/concepts/schema/infertype-functions.ts

### API Responses


<<< @/_snippets/code/from-docs/concepts/schema/infertype-api.ts

### Complex Nested Types


<<< @/_snippets/code/from-docs/concepts/schema/infertype-nested.ts

## Type Safety Benefits

### Compile-Time Type Checking


<<< @/_snippets/code/from-docs/concepts/schema/infer-type/block-1.ts


### IntelliSense Support


<<< @/_snippets/code/from-docs/concepts/schema/infer-type/block-2.ts


### Refactoring Safety

When you change your schema, TypeScript will show errors everywhere the type is used, ensuring you update all related code.

## Best Practices

### 1. Use Type Aliases


<<< @/_snippets/code/from-docs/concepts/schema/infer-type/block-3.ts


### 2. Export Types for Reuse


<<< @/_snippets/code/from-docs/concepts/schema/infer-type/block-4.ts


### 3. Use Appropriate Type


<<< @/_snippets/code/from-docs/concepts/schema/infer-type/block-5.ts


### 4. Use `constrain()` for Branded Types

When working with branded or tagged types (like UUIDs), use `constrain()` to narrow string types:


<<< @/_snippets/code/from-docs/concepts/schema/infer-type/block-6.ts


## Related

- **[Creating A Schema](/concepts/schema/creating-a-schema)** - Learn how to define schemas
- **[Property Types](/concepts/schema/property-types/README)** - Available property types
- **[Modifiers](/concepts/schema/modifiers/README)** - Property modifiers and constraints
