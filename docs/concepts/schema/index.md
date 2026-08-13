---
title: Schema
---

# Schemas

Schemas in Routier define the structure, behavior, and constraints of your data entities. They provide type safety, transformation, and metadata that ensures your application works correctly with your data structure.

## Quick Navigation

- [What Are Schemas?](#what-are-schemas)
- [Schema Builder](#schema-builder)
- [Key Features](#key-features)
- [Documentation](#documentation)
- [Quick Examples](#quick-examples)
- [Benefits](#benefits)
- [Next Steps](#next-steps)

## What Are Schemas?

Schemas are type definitions that:

- Define the structure of your data entities
- Provide compile-time type safety
- Enable automatic transformation and serialization
- Support database indexing and constraints
- Enable change tracking and data management

## Schema Builder

Routier provides a fluent, type-safe schema builder API:


<<< @/_snippets/code/from-docs/concepts/schema/basic-schema.ts

## Key Features

### Type Safety

- Full TypeScript support with generic constraints
- Literal type constraints for enum-like values
- Compile-time type checking of schema structure

### Flexible Modifiers

- **Behavior**: `optional()`, `nullable()`, `readonly()`
- **Values**: `default()`, `identity()`
- **Constraints**: `key()`, `distinct()`
- **Serialization**: `serialize()`, `deserialize()`
- **Performance**: `index()`
- **Mapping**: `from()`

### Collection-level Modifiers

- **Computed**: `computed(fn)` derives a value from the entity (and optionally collection name/injected context). Defaults to untracked and not persisted. Computation is performed on save.
- **Tracked**: `tracked()` on a computed property persists the derived value to storage for faster reads and indexing.
- **Function**: `function(fn)` attaches non-persisted methods to entities.

### Schema Metadata

Sometimes you need information **about a collection**, not about individual fields—for example:

- API routes or HTTP headers for that collection
- Feature flags (e.g., “orders are read-only in production”)
- UI hints such as display labels, default sort, or grouping

Routier supports this via **schema metadata**. When you call `compile`, you can pass an arbitrary metadata object, and the compiled schema will expose it as a typed `metadata` property:

```ts
import { s } from '@routier/core/schema';

type OrdersMetadata = {
  http: {
    baseUrl: string;
    timeoutMs: number;
  };
  ui: {
    displayName: string;
    defaultSort: 'createdAt' | 'total';
  };
};

export const ordersSchema = s
  .define('orders', {
    id: s.string().key().identity(),
    customerId: s.string(),
    total: s.number(),
    status: s.string('pending', 'paid', 'shipped'),
    createdAt: s.date().default(() => new Date()),
  })
  .compile<OrdersMetadata>({
    http: {
      baseUrl: '/api/orders',
      timeoutMs: 5000,
    },
    ui: {
      displayName: 'Orders',
      defaultSort: 'createdAt',
    },
  });

// Later in your app or plugins:
ordersSchema.metadata.http.baseUrl;   // '/api/orders'
ordersSchema.metadata.ui.displayName; // 'Orders'
```

This keeps **collection-level configuration** colocated with the schema and strongly typed, without polluting the entity shape itself. Plugins (for example, HTTP or sync plugins) can also read this metadata from the compiled schema to drive behavior such as routing, indexing strategy, or conflict resolution.

### Rich Type System

- **Primitives**: `string`, `number`, `boolean`, `date`
- **Complex**: `object`, `array`
- **Constraints**: Literal types with generics
- **Composition**: Nested schemas and arrays

## Documentation

### Getting Started

- **[Creating A Schema](/concepts/schema/creating-a-schema)** - Learn how to create your first schema

### Core Concepts

- **[Property Types](/concepts/schema/property-types/README)** - Available property types and their capabilities
- **[Modifiers](/concepts/schema/modifiers/README)** - All available property modifiers and constraints
- **[Optional vs nullable over HTTP](/concepts/schema/modifiers/README#optional-vs-nullable-over-http)** - Sending missing values safely over JSON
- **[InferType](/concepts/schema/infer-type)** - Type inference and type safety

### Reference

- **[Why Schemas?](/concepts/schema/why-schemas)** - Understanding the benefits and philosophy

## Quick Examples

### Basic Entity


<<< @/_snippets/code/from-docs/concepts/schema/basic-schema.ts

### Complex Nested Schema


<<< @/_snippets/code/from-docs/concepts/schema/complex-schema.ts

### Constrained Values


<<< @/_snippets/code/from-docs/concepts/schema/constrained-schema.ts

## Benefits

### Development Experience

- **IntelliSense**: Full autocomplete and type checking
- **Refactoring**: Safe refactoring with TypeScript
- **Documentation**: Self-documenting code structure

### Data Management

- **Serialization**: Built-in serialization/deserialization
- **Transformation**: Property mapping and remapping
- **Defaults**: Automatic default value application
- **Identity**: Primary key and identity management

### Database Integration

- **Indexing**: Schema-driven index creation for distinct properties and custom indexes
- **Constraints**: Unique constraints for distinct properties
- **Change Tracking**: Efficient change detection
- **Schema Translation**: Converts to native database schemas

### Performance

Schemas are compiled into optimized JavaScript functions that eliminate runtime overhead:

- **Code Generation**: Schema definitions are compiled into fast, specialized functions for serialization, cloning, comparison, and change tracking
- **Zero Runtime Reflection**: All property access and transformations are pre-compiled, avoiding expensive runtime property inspection
- **Optimized Data Paths**: Generated code uses direct property access and optimized algorithms for common operations
- **Memory Efficiency**: Compiled schemas minimize memory allocations and garbage collection pressure


<<< @/_snippets/code/from-docs/concepts/schema/memory-efficiency-example.ts

## Next Steps

1. **[Create your first schema](/concepts/schema/creating-a-schema)** - Start building schemas
2. **[Understand property types](/concepts/schema/property-types/README)** - Choose the right types for your data
3. **[Apply modifiers](/concepts/schema/modifiers/README)** - Customize behavior and constraints
4. **[Learn about type inference](/concepts/schema/infer-type)** - Leverage TypeScript integration
5. **[Data Manipulation](/guides/data-manipulation)** - Learn how to update entities with proxies

Schemas are the foundation of Routier's data management system. They provide the structure and rules that make your data consistent, safe, and performant.
