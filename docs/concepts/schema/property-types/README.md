---
title: Property Types
layout: default
parent: Schema
grand_parent: Concepts
nav_order: 2
---

# Property Types

Routier provides a comprehensive set of property types for building robust schemas. Each type can be enhanced with modifiers to specify behavior and constraints.

## Basic Types

### String

{% capture snippet_34jf1v %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{
  {
    snippet_34jf1v | escape;
  }
}
```

### Number

{% capture snippet_oempxx %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{
  {
    snippet_oempxx | escape;
  }
}
```

### Boolean

{% capture snippet_t1gwom %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{
  {
    snippet_t1gwom | escape;
  }
}
```

### Date

{% capture snippet_0o33ad %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{
  {
    snippet_0o33ad | escape;
  }
}
```

## Complex Types

### Object

{% capture snippet_y9r625 %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{
  {
    snippet_y9r625 | escape;
  }
}
```

### Array

{% capture snippet_fh5wji %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{
  {
    snippet_fh5wji | escape;
  }
}
```

## Type Constraints with Generics

Routier's type system allows you to constrain properties to specific literal values using TypeScript generics:

### String Literals

{% capture snippet_sepo73 %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{
  {
    snippet_sepo73 | escape;
  }
}
```

### Number Literals

{% capture snippet_vo0j1n %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{
  {
    snippet_vo0j1n | escape;
  }
}
```

### Boolean Literals

{% capture snippet_ep1grl %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{
  {
    snippet_ep1grl | escape;
  }
}
```

## Type Composition

### Combining Types

{% capture snippet_ot7kh4 %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{
  {
    snippet_ot7kh4 | escape;
  }
}
```

## Type Conversion

### Converting to Arrays

Any type can be converted to an array using the `.array()` modifier:

{% capture snippet_y4i5de %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{
  {
    snippet_y4i5de | escape;
  }
}
```

## Special Use Cases

### Identity Properties

Properties that auto-generate values:

{% capture snippet_zbhp4c %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{
  {
    snippet_zbhp4c | escape;
  }
}
```

### Key Properties

Properties that serve as unique identifiers:

{% capture snippet_myq6n4 %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{
  {
    snippet_myq6n4 | escape;
  }
}
```

### Indexed Properties

Properties that create database indexes:

{% capture snippet_mtslo8 %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{
  {
    snippet_mtslo8 | escape;
  }
}
```

## Best Practices

### 1. **Use Literal Types for Constrained Values**

{% capture snippet_qqb4dt %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{
  {
    snippet_qqb4dt | escape;
  }
}
```

### 2. **Leverage Type Inference**

{% capture snippet_b4mi9q %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{
  {
    snippet_b4mi9q | escape;
  }
}
```

### 3. **Use Appropriate Types**

{% capture snippet_u6gsr0 %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{
  {
    snippet_u6gsr0 | escape;
  }
}
```

### 4. **Structure Complex Data**

{% capture snippet_unwd1x %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{
  {
    snippet_unwd1x | escape;
  }
}
```

## Type Compatibility

### Modifier Support

Different types support different modifiers:

| Modifier         | String | Number | Boolean | Date | Object | Array |
| ---------------- | ------ | ------ | ------- | ---- | ------ | ----- |
| `.optional()`    | ✅     | ✅     | ✅      | ✅   | ✅     | ✅    |
| `.nullable()`    | ✅     | ✅     | ✅      | ✅   | ✅     | ✅    |
| `.default()`     | ✅     | ✅     | ✅      | ✅   | ✅     | ✅    |
| `.readonly()`    | ✅     | ✅     | ✅      | ✅   | ✅     | ✅    |
| `.deserialize()` | ✅     | ✅     | ✅      | ✅   | ✅     | ✅    |
| `.serialize()`   | ✅     | ✅     | ✅      | ✅   | ✅     | ✅    |
| `.array()`       | ✅     | ✅     | ✅      | ✅   | ✅     | ✅    |
| `.index()`       | ✅     | ✅     | ✅      | ✅   | ✅     | ✅    |
| `.key()`         | ✅     | ✅     | ✅      | ❌   | ❌     | ❌    |
| `.identity()`    | ✅     | ✅     | ✅      | ✅   | ✅     | ❌    |
| `.distinct()`    | ✅     | ✅     | ✅      | ✅   | ❌     | ❌    |

## Summary of Types

- Array: `s.array(innerType)`
- Boolean: `s.boolean()`
- Date: `s.date()`
- Number: `s.number()`
- Object: `s.object({...})`
- String: `s.string()`

## Next Steps

- [Modifiers](modifiers/README.md) - Property modifiers and constraints
- [Creating A Schema](../creating-a-schema.md) - Back to schema creation
- [Schema Reference](../reference.md) - Complete schema API reference
