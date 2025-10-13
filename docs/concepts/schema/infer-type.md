---
title: InferType
layout: default
parent: Schema
nav_order: 6
permalink: /concepts/schema/infer-type/
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

{% capture snippet_infertype_basic %}{% include code/from-docs/concepts/schema/infertype-basic.ts %}{% endcapture %}

{% highlight ts %}{{ snippet_infertype_basic | strip }}{% endhighlight %}

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

{% capture snippet_infertype_comparison %}{% include code/from-docs/concepts/schema/infertype-comparison.ts %}{% endcapture %}

{% highlight ts %}{{ snippet_infertype_comparison | strip }}{% endhighlight %}

## Real-World Examples

### Function Parameters

{% capture snippet_infertype_functions %}{% include code/from-docs/concepts/schema/infertype-functions.ts %}{% endcapture %}

{% highlight ts %}{{ snippet_infertype_functions | strip }}{% endhighlight %}

### API Responses

{% capture snippet_infertype_api %}{% include code/from-docs/concepts/schema/infertype-api.ts %}{% endcapture %}

{% highlight ts %}{{ snippet_infertype_api | strip }}{% endhighlight %}

### Complex Nested Types

{% capture snippet_infertype_nested %}{% include code/from-docs/concepts/schema/infertype-nested.ts %}{% endcapture %}

{% highlight ts %}{{ snippet_infertype_nested | strip }}{% endhighlight %}

## Type Safety Benefits

### Compile-Time Type Checking

```typescript
// ✅ TypeScript will catch this error at compile time
function processUser(user: User) {
  console.log(user.email); // ✅ Valid - email exists on User type
  console.log(user.invalidField); // ❌ Error - property doesn't exist
}
```

### IntelliSense Support

```typescript
const user: User = await ctx.users.firstAsync();
user. // ← IntelliSense shows all available properties
```

### Refactoring Safety

When you change your schema, TypeScript will show errors everywhere the type is used, ensuring you update all related code.

## Best Practices

### 1. Use Type Aliases

```typescript
// ✅ Good - reusable type alias
type User = InferType<typeof userSchema>;
type CreateUser = InferCreateType<typeof userSchema>;

// ❌ Avoid - repeating the type everywhere
function processUser(user: InferType<typeof userSchema>) { ... }
```

### 2. Export Types for Reuse

```typescript
// schema.ts
export const userSchema = s.define("users", { ... }).compile();
export type User = InferType<typeof userSchema>;
export type CreateUser = InferCreateType<typeof userSchema>;

// other-file.ts
import { User, CreateUser } from './schema';
```

### 3. Use Appropriate Type

```typescript
// ✅ Use InferCreateType for creation
async function createUser(data: CreateUser) {
  return await ctx.users.addAsync(data);
}

// ✅ Use InferType for existing entities
async function updateUser(user: User, updates: Partial<User>) {
  return await ctx.users.updateAsync(user, updates);
}
```

## Related

- **[Creating A Schema](creating-a-schema.md)** - Learn how to define schemas
- **[Property Types](property-types/README.md)** - Available property types
- **[Modifiers](modifiers/README.md)** - Property modifiers and constraints
