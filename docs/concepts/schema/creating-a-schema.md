---
title: Creating a Schema
---

# Creating A Schema

Schemas in Routier define the structure and behavior of your data entities. The schema builder provides a fluent, type-safe API for creating robust data schemas.

## Quick Navigation

- [Basic Schema Definition](#basic-schema-definition)
- [Schema Builder API](#schema-builder-api)
- [Property Modifiers](#property-modifiers)
- [Complete Example](#complete-example)
- [Modifier Chaining](#modifier-chaining)
- [Compiling Schemas](#compiling-schemas)
- [Next Steps](#next-steps)

## Basic Schema Definition

<<< @/_snippets/code/from-docs/concepts/schema/creating-a-schema/basic-schema.ts

## Schema Builder API

The `s` object provides the main entry point for schema creation:

### Core Functions

- **`s.define(collectionName, schema)`** - Creates a schema definition
- **`s.number<T>()`** - Number property with optional literal constraints
- **`s.string<T>()`** - String property with optional literal constraints
- **`s.boolean<T>()`** - Boolean property
- **`s.date<T>()`** - Date property
- **`s.array(schema)`** - Array property containing other schemas
- **`s.object(schema)`** - Object property with nested schema

### Literal Type Constraints

You can constrain properties to specific literal values:

<<< @/_snippets/code/from-docs/concepts/schema/creating-a-schema/literal-constraints.ts

## Property Modifiers

Each schema type supports a set of modifiers that can be chained together:

### Core Modifiers

<<< @/_snippets/code/from-docs/concepts/schema/creating-a-schema/core-modifiers.ts

### Serialization Modifiers

<<< @/_snippets/code/from-docs/concepts/schema/creating-a-schema/serialization-modifiers.ts

### Array and Object Modifiers

<<< @/_snippets/code/from-docs/concepts/schema/creating-a-schema/array-object-modifiers.ts

## Complete Example

<<< @/_snippets/code/from-docs/concepts/schema/creating-a-schema/complete-example.ts

## Modifier Chaining

Modifiers can be chained in any order, but it's recommended to follow a logical pattern:

<<< @/_snippets/code/from-docs/concepts/schema/creating-a-schema/modifier-chaining.ts

## Compiling Schemas

Always call `.compile()` at the end to create the final schema:

<<< @/_snippets/code/from-docs/concepts/schema/creating-a-schema/compiling-schemas.ts

## Next Steps

- [Property Types](/concepts/schema/property-types/README) - Detailed property type reference
- [Modifiers](/concepts/schema/modifiers/README) - All available property modifiers
- [InferType](/concepts/schema/infer-type) - Type inference and type safety
- [Why Schemas?](/concepts/schema/why-schemas) - Understanding the benefits of schemas
