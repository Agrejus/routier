---
title: Property Types
---

# Property Types

Routier provides a comprehensive set of property types for building robust schemas. Each type can be enhanced with modifiers to specify behavior and constraints.

## Basic Types

### String

<<< @/_snippets/code/from-docs/concepts/schema/property-types/string-examples.ts

#### Type Narrowing with `constrain()`

Use `constrain()` to narrow string types to branded or tagged types:

<<< @/_snippets/code/from-docs/concepts/schema/property-types/string-constrain.ts

### Number

<<< @/_snippets/code/from-docs/concepts/schema/property-types/number-examples.ts

### Boolean

<<< @/_snippets/code/from-docs/concepts/schema/property-types/boolean-examples.ts

### Date

<<< @/_snippets/code/from-docs/concepts/schema/property-types/date-examples.ts

## Complex Types

### Object

<<< @/_snippets/code/from-docs/concepts/schema/property-types/object-examples.ts

### Array

<<< @/_snippets/code/from-docs/concepts/schema/property-types/array-examples.ts

## Type Constraints with Generics

Routier's type system allows you to constrain properties to specific literal values using TypeScript generics:

### String Literals

<<< @/_snippets/code/from-docs/concepts/schema/property-types/string-literals.ts

### Type Narrowing with `constrain()`

For string properties, you can use `constrain()` to narrow the type to branded or tagged types. This is useful for creating type-safe identifiers like UUIDs:

<<< @/_snippets/code/from-docs/concepts/schema/property-types/string-constrain.ts

### Number Literals

<<< @/_snippets/code/from-docs/concepts/schema/property-types/number-literals.ts

### Boolean Literals

<<< @/_snippets/code/from-docs/concepts/schema/property-types/boolean-literals.ts

## Type Composition

### Combining Types

<<< @/_snippets/code/from-docs/concepts/schema/property-types/type-composition.ts

## Type Conversion

### Converting to Arrays

Any type can be converted to an array using the `.array()` modifier:

<<< @/_snippets/code/from-docs/concepts/schema/property-types/array-conversions.ts

## Special Use Cases

### Identity Properties

Properties that auto-generate values:

<<< @/_snippets/code/from-docs/concepts/schema/property-types/identity-properties.ts

### Key Properties

Properties that serve as unique identifiers:

<<< @/_snippets/code/from-docs/concepts/schema/property-types/key-properties.ts

### Indexed Properties

Properties that create database indexes:

<<< @/_snippets/code/from-docs/concepts/schema/property-types/indexed-properties.ts

## Best Practices

### 1. **Use Literal Types for Constrained Values**

<<< @/_snippets/code/from-docs/concepts/schema/property-types/literal-best-practice.ts

### 2. **Leverage Type Inference**

<<< @/_snippets/code/from-docs/concepts/schema/property-types/type-inference-best-practice.ts

### 3. **Use Appropriate Types**

<<< @/_snippets/code/from-docs/concepts/schema/property-types/appropriate-types-best-practice.ts

### 4. **Structure Complex Data**

<<< @/_snippets/code/from-docs/concepts/schema/property-types/complex-structure-best-practice.ts

## Type Compatibility

### Modifier Support

Different types support different modifiers:

See the [complete modifier matrix](/concepts/schema/schema-api#modifier-matrix). It includes file and vector properties and is aligned with the fluent methods exposed by each source type.

## Summary of Types

- Array: `s.array(innerType)`
- Boolean: `s.boolean()`
- Date: `s.date()`
- File: `s.file()` — content on create, a reference on read; use `BlobDbPlugin`
- Number: `s.number()`
- Object: `s.object({...})`
- String: `s.string()` or `s.string({ maxLength }, ...literals)`
- Vector: `s.vector(dimensions)` — fixed-width `number[]` for `.nearest()`

## Next Steps

- [Modifiers](/concepts/schema/modifiers/README) - Property modifiers and constraints
- [Creating A Schema](/concepts/schema/creating-a-schema) - Back to schema creation
