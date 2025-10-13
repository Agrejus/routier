---
title: Schema
layout: default
parent: Concepts
nav_order: 1
has_children: true
permalink: /concepts/schema/
---

# Schemas

Schemas in Routier define the structure, behavior, and constraints of your data entities. They provide type safety, validation, and metadata that ensures your application works correctly with your data structure.

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
- Enable automatic validation and transformation
- Support database indexing and constraints
- Enable change tracking and serialization

## Schema Builder

Routier provides a fluent, type-safe schema builder API:

{% capture snippet_basic_schema %}{% include code/from-docs/concepts/schema/basic-schema.ts %}{% endcapture %}

{% highlight ts %}{{ snippet_basic_schema | strip }}{% endhighlight %}

## Key Features

### Type Safety

- Full TypeScript support with generic constraints
- Literal type constraints for enum-like values
- Compile-time validation of schema structure

### Flexible Modifiers

- **Behavior**: `optional()`, `nullable()`, `readonly()`
- **Values**: `default()`, `identity()`
- **Constraints**: `key()`, `distinct()`
- **Serialization**: `serialize()`, `deserialize()`
- **Performance**: `index()`

### Collection-level Modifiers

- **Computed**: `computed(fn)` derives a value from the entity (and optionally collection name/injected context). Defaults to untracked and not persisted.
- **Tracked**: `tracked()` on a computed property persists the derived value to storage for faster reads and indexing.
- **Function**: `function(fn)` attaches non-persisted methods to entities.

### Rich Type System

- **Primitives**: `string`, `number`, `boolean`, `date`
- **Complex**: `object`, `array`
- **Constraints**: Literal types with generics
- **Composition**: Nested schemas and arrays

## Documentation

### Getting Started

- **[Creating A Schema](creating-a-schema.md)** - Learn how to create your first schema
- **[Schema Builder Reference](schema-builder-reference.md)** - Complete reference for all types and modifiers

### Core Concepts

- **[Property Types](property-types/README.md)** - Available property types and their capabilities
- **[Modifiers](modifiers/README.md)** - All available property modifiers and constraints

### Reference

- **[Schema Reference](reference.md)** - Complete schema API reference
- **[Why Schemas?](why-schemas.md)** - Understanding the benefits and philosophy

## Quick Examples

### Basic Entity

{% capture snippet_basic_schema %}{% include code/from-docs/concepts/schema/basic-schema.ts %}{% endcapture %}

{% highlight ts %}{{ snippet_basic_schema | strip }}{% endhighlight %}

### Complex Nested Schema

{% capture snippet_complex_schema %}{% include code/from-docs/concepts/schema/complex-schema.ts %}{% endcapture %}

{% highlight ts %}{{ snippet_complex_schema | strip }}{% endhighlight %}

### Constrained Values

{% capture snippet_constrained_schema %}{% include code/from-docs/concepts/schema/constrained-schema.ts %}{% endcapture %}

{% highlight ts %}{{ snippet_constrained_schema | strip }}{% endhighlight %}

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

## Next Steps

1. **[Create your first schema](creating-a-schema.md)** - Start building schemas
2. **[Explore the builder reference](schema-builder-reference.md)** - Learn all available options
3. **[Understand property types](property-types/README.md)** - Choose the right types for your data
4. **[Apply modifiers](modifiers/README.md)** - Customize behavior and constraints

Schemas are the foundation of Routier's data management system. They provide the structure and rules that make your data consistent, safe, and performant.
