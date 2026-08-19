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
- [Getting The Type Out](#getting-the-type-out)
- [Extending A Schema With `.modify()`](#extending-a-schema-with-modify)
- [Next Steps](#next-steps)

## Basic Schema Definition

<<< @/_snippets/code/from-docs/concepts/schema/creating-a-schema/basic-schema.ts

## Schema Builder API

The `s` object provides the main entry point for schema creation:

### Core Functions

- **`s.define(collectionName, schema)`** - Creates a schema definition
- **`s.number<T>()`** - Number property with optional literal constraints
- **`s.string(...literals)`** - String property with optional literal constraints
- **`s.string({ maxLength }, ...literals)`** - String plus a storage length declaration
- **`s.boolean<T>()`** - Boolean property
- **`s.date<T>()`** - Date property
- **`s.array(schema)`** - Array property containing another schema property
- **`s.object(schema)`** - Object property with nested schema
- **`s.file()`** - File input/reference output used with `@routier/blob-plugin`
- **`s.vector(dimensions)`** - Fixed-width numeric embedding used with `.nearest()`

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

## Getting The Type Out

A compiled schema already describes the shape of your data, so you never write that shape a
second time. `InferType` reads the entity type back off the schema, the way `z.infer` does in
Zod:

```ts
type Product = InferType<typeof productSchema>;
```

Note that `typeof productSchema` on its own is the type of the **schema object**, not the
entity — it has no `name` or `price` on it. `InferType` is what unwraps it.

There is a second one worth knowing. `InferCreateType` is the shape you pass when *adding* an
entity, which omits identity properties and anything with a default, because the store fills
those in:

<<< @/_snippets/code/from-docs/concepts/schema/creating-a-schema/inferring-types.ts

Reach for these instead of hand-writing an interface. A hand-written one has to be updated
every time the schema changes, and nothing tells you when you have missed one.

See [InferType](/concepts/schema/infer-type) for the full reference.

## Extending A Schema With `.modify()`

`.modify()` runs after `define()` and adds properties that are derived from the entity rather
than supplied by the caller. It receives three builders:

| Builder | Stored? | You get |
| --- | --- | --- |
| `x.computed(fn)` | No | The value `fn` returns, recomputed on read |
| `x.computed(fn).tracked()` | **Yes** | The same value, persisted so the backend can filter and index it |
| `x.function(fn)` | No | Whatever `fn` returns — return a function to get a method on the entity |
| `x.transform({ to, from, stores })` | Stored, converted | An existing property whose stored form differs from its in-memory form |

`fn` receives `(entity, collectionName, injected)`. The `collectionName` argument is why
`documentType: x.computed((_, collectionName) => collectionName).tracked()` is a common idiom —
it tags rows when several collections share one physical store.

<<< @/_snippets/code/from-docs/concepts/schema/creating-a-schema/modify-computed.ts

Two things worth being clear about:

**`computed` versus `computed().tracked()` is about the database, not the type.** Both give you
the same property to read. Only the tracked one exists as a column, so only the tracked one can
be filtered or sorted in the backend rather than in memory.

**`x.function` holds whatever your function returns.** Returning a value gives you a value;
returning a function gives you a method, which is the `describe()` case above. Unlike
`computed`, it can never be `.tracked()` — behavior is not storable.

`x.transform` replaces an existing property under the same name, declaring both directions of a
storage conversion. See [Schema API](/concepts/schema/schema-api#derived-and-transformed-properties)
for its options, and [Encryption](/integrations/plugins/built-in-plugins/encryption) for a
packaged one.

## Next Steps

- [Schema API](/concepts/schema/schema-api) - Complete factories and modifier compatibility
- [Property Types](/concepts/schema/property-types/README) - Detailed property type reference
- [Modifiers](/concepts/schema/modifiers/README) - All available property modifiers
- [InferType](/concepts/schema/infer-type) - Type inference and type safety
- [Why Schemas?](/concepts/schema/why-schemas) - Understanding the benefits of schemas
