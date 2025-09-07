# Schemas

Schemas in Routier define the structure, behavior, and constraints of your data entities. They provide type safety, validation, and metadata that ensures your application works correctly with your data structure.

## What Are Schemas?

Schemas are type definitions that:

- Define the structure of your data entities
- Provide compile-time type safety
- Enable automatic validation and transformation
- Support database indexing and constraints
- Enable change tracking and serialization

## Schema Builder

Routier provides a fluent, type-safe schema builder API:


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/index/block-1.ts %}{% endhighlight %}


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


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/index/block-2.ts %}{% endhighlight %}


### Complex Nested Schema


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/index/block-3.ts %}{% endhighlight %}


### Constrained Values


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/index/block-4.ts %}{% endhighlight %}


## Benefits

### Development Experience

- **IntelliSense**: Full autocomplete and type checking
- **Refactoring**: Safe refactoring with TypeScript
- **Documentation**: Self-documenting code structure

### Runtime Safety

- **Validation**: Automatic data validation
- **Transformation**: Built-in serialization/deserialization
- **Constraints**: Database-level constraints and indexes

### Performance

- **Indexing**: Automatic database index creation
- **Change Tracking**: Efficient change detection
- **Serialization**: Optimized data transformation

## Next Steps

1. **[Create your first schema](creating-a-schema.md)** - Start building schemas
2. **[Explore the builder reference](schema-builder-reference.md)** - Learn all available options
3. **[Understand property types](property-types/README.md)** - Choose the right types for your data
4. **[Apply modifiers](modifiers/README.md)** - Customize behavior and constraints

Schemas are the foundation of Routier's data management system. They provide the structure and rules that make your data consistent, safe, and performant.
