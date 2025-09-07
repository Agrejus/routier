---
title: Creating a Schema
layout: default
parent: Schema
grand_parent: Concepts
nav_order: 1
---

# Creating A Schema

Schemas in Routier define the structure and behavior of your data entities. The schema builder provides a fluent, type-safe API for creating robust data schemas.

## Basic Schema Definition

{% capture snippet_uwvygh %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{
  {
    snippet_uwvygh | escape;
  }
}
```

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

{% capture snippet_r07whk %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{
  {
    snippet_r07whk | escape;
  }
}
```

## Property Modifiers

Each schema type supports a set of modifiers that can be chained together:

### Core Modifiers

{% capture snippet_834udw %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{
  {
    snippet_834udw | escape;
  }
}
```

### Serialization Modifiers

{% capture snippet_5wxct0 %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{
  {
    snippet_5wxct0 | escape;
  }
}
```

### Array and Object Modifiers

{% capture snippet_rl0i32 %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{
  {
    snippet_rl0i32 | escape;
  }
}
```

## Complete Example

{% capture snippet_btkdlv %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{
  {
    snippet_btkdlv | escape;
  }
}
```

## Modifier Chaining

Modifiers can be chained in any order, but it's recommended to follow a logical pattern:

{% capture snippet_yeelah %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{
  {
    snippet_yeelah | escape;
  }
}
```

## Compiling Schemas

Always call `.compile()` at the end to create the final schema:

{% capture snippet_k6k6vd %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{
  {
    snippet_k6k6vd | escape;
  }
}
```

## Next Steps

- [Property Types](property-types/README.md) - Detailed property type reference
- [Modifiers](modifiers/README.md) - All available property modifiers
- [Schema Reference](reference.md) - Complete schema API reference
- [Why Schemas?](why-schemas.md) - Understanding the benefits of schemas
