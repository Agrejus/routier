# Creating A Schema

Schemas in Routier define the structure and behavior of your data entities. The schema builder provides a fluent, type-safe API for creating robust data schemas.

## Basic Schema Definition

```typescript
import { s } from "routier-core/schema";

const userSchema = s
  .define("users", {
    id: s.string().key().identity(),
    name: s.string(),
    email: s.string(),
    age: s.number().optional(),
    isActive: s.boolean().default(true),
    createdAt: s.date().default(() => new Date()),
  })
  .compile();
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

```typescript
const schema = s.define("products", {
  status: s.string<"draft" | "published" | "archived">(),
  priority: s.number<1 | 2 | 3 | 4 | 5>(),
  type: s.boolean<true>(), // Only true allowed
});
```

## Property Modifiers

Each schema type supports a set of modifiers that can be chained together:

### Core Modifiers

```typescript
const schema = s.define("users", {
  // Identity and keys
  id: s.string().key().identity(),
  email: s.string().identity(),

  // Optional and nullable
  middleName: s.string().optional(),
  avatar: s.string().nullable(),

  // Default values (can be direct values or functions)
  status: s.string().default("active"),
  isEnabled: s.boolean().default(true),
  createdAt: s.date().default(() => new Date()),

  // Readonly properties
  id: s.string().key().identity().readonly(),

  // Indexed fields
  name: s.string().index(),
  category: s.string().index("cat_status"),
  status: s.string().index("cat_status"), // Compound index
});
```

### Serialization Modifiers

```typescript
const schema = s.define("users", {
  // Custom serialization
  date: s
    .date()
    .default(() => new Date())
    .deserialize((str) => new Date(str))
    .serialize((date) => date.toISOString()),

  // Custom transformation
  fullName: s
    .string()
    .deserialize((str) => str.trim())
    .serialize((str) => str.toLowerCase()),
});
```

### Array and Object Modifiers

```typescript
const schema = s.define("orders", {
  // Array with modifiers
  tags: s
    .array(s.string())
    .optional()
    .default(() => []),

  // Object with modifiers
  address: s
    .object({
      street: s.string(),
      city: s.string(),
      zipCode: s.string(),
    })
    .optional(),

  // Nested arrays
  items: s.array(
    s.object({
      productId: s.string(),
      quantity: s.number().min(1),
      price: s.number().min(0),
    })
  ),
});
```

## Complete Example

```typescript
const userSchema = s
  .define("users", {
    // Primary key
    id: s.string().key().identity(),

    // Required fields
    firstName: s.string(),
    lastName: s.string(),
    email: s.string().identity(),

    // Optional fields with defaults
    middleName: s.string().optional(),
    avatar: s.string().url().optional(),
    isActive: s.boolean().default(true),

    // Dates with defaults
    createdAt: s
      .date()
      .default(() => new Date())
      .readonly(),
    updatedAt: s.date().default(() => new Date()),

    // Nested objects
    profile: s
      .object({
        bio: s.string().optional(),
        website: s.string().url().optional(),
        preferences: s
          .object({
            theme: s.string<"light" | "dark">().default("light"),
            language: s.string<"en" | "es" | "fr">().default("en"),
          })
          .default(() => ({ theme: "light", language: "en" })),
      })
      .optional(),

    // Arrays
    tags: s
      .array(s.string())
      .optional()
      .default(() => []),
    roles: s
      .array(s.string<"user" | "admin" | "moderator">())
      .default(() => ["user"]),

    // Indexed fields
    username: s.string().index(),
    status: s
      .string<"active" | "inactive" | "suspended">()
      .index("status_created"),
    createdAt: s.date().index("status_created"),
  })
  .compile();
```

## Modifier Chaining

Modifiers can be chained in any order, but it's recommended to follow a logical pattern:

```typescript
// Good - logical order
email: s.string().email().min(5).max(100).unique().required().tracked();

// Avoid - confusing order
email: s.string().required().email().unique().max(100).min(5);
```

## Compiling Schemas

Always call `.compile()` at the end to create the final schema:

```typescript
const schema = s
  .define("example", {
    // ... properties
  })
  .compile(); // This is required!
```

## Next Steps

- [Property Types](property-types/README.md) - Detailed property type reference
- [Modifiers](modifiers/README.md) - All available property modifiers
- [Schema Reference](reference.md) - Complete schema API reference
- [Why Schemas?](why-schemas.md) - Understanding the benefits of schemas
