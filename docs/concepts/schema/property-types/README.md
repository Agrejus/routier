# Property Types

Routier provides a comprehensive set of property types for building robust schemas. Each type can be enhanced with modifiers to specify behavior and constraints.

## Basic Types

### String

```typescript
const schema = s.define("users", {
  // Basic string
  name: s.string(),

  // String with literal constraints
  status: s.string<"active" | "inactive" | "suspended">(),
  role: s.string<"user" | "admin" | "moderator">(),

  // String with modifiers
  email: s.string().distinct(),
  username: s.string().index(),
  bio: s.string().optional(),
});
```

### Number

```typescript
const schema = s.define("users", {
  // Basic number
  age: s.number(),

  // Number with literal constraints
  priority: s.number<1 | 2 | 3 | 4 | 5>(),
  score: s.number<0 | 10 | 20 | 30 | 40 | 50 | 60 | 70 | 80 | 90 | 100>(),

  // Number with modifiers
  count: s.number().default(0),
  rating: s.number().index(),
  version: s.number().identity(),
  // Note: .default() accepts both direct values and functions
});
```

### Boolean

```typescript
const schema = s.define("users", {
  // Basic boolean
  isActive: s.boolean(),

  // Boolean with literal constraints
  verified: s.boolean<true>(), // Only true allowed

  // Boolean with modifiers
  isEnabled: s.boolean().default(true),
  hasPermission: s.boolean().optional(),
});
```

### Date

```typescript
const schema = s.define("users", {
  // Basic date
  createdAt: s.date(),

  // Date with modifiers
  updatedAt: s.date().default(() => new Date()),
  lastLogin: s.date().nullable(),
  birthDate: s.date().optional(),
  // Note: .default() accepts both direct values and functions
});
```

## Complex Types

### Object

```typescript
const schema = s.define("users", {
  // Nested object
  address: s.object({
    street: s.string(),
    city: s.string(),
    state: s.string(),
    zipCode: s.string(),
  }),

  // Object with modifiers
  profile: s
    .object({
      bio: s.string().optional(),
      avatar: s.string().optional(),
      preferences: s
        .object({
          theme: s.string<"light" | "dark">().default("light"),
          notifications: s.boolean().default(true),
        })
        .default(() => ({ theme: "light", notifications: true })),
    })
    .optional(),

  // Object with identity
  metadata: s
    .object({
      source: s.string(),
      version: s.string(),
    })
    .identity(),
});
```

### Array

```typescript
const schema = s.define("users", {
  // Basic array
  tags: s.array(s.string()),

  // Array with modifiers
  scores: s.array(s.number()).default(() => []),
  phoneNumbers: s.array(s.string()).optional(),

  // Array of objects
  orders: s.array(
    s.object({
      productId: s.string(),
      quantity: s.number(),
      price: s.number(),
    })
  ),

  // Nested arrays
  matrix: s.array(s.array(s.number())),
});
```

## Type Constraints with Generics

Routier's type system allows you to constrain properties to specific literal values using TypeScript generics:

### String Literals

```typescript
const schema = s.define("products", {
  // Single literal value
  type: s.string<"physical">(),

  // Multiple literal values
  status: s.string<"draft" | "published" | "archived">(),
  category: s.string<"electronics" | "clothing" | "books">(),

  // With modifiers
  priority: s.string<"low" | "medium" | "high">().default("medium"),
});
```

### Number Literals

```typescript
const schema = s.define("orders", {
  // Single literal value
  maxItems: s.number<10>(),

  // Multiple literal values
  status: s.number<0 | 1 | 2>(), // 0=pending, 1=processing, 2=completed

  // With modifiers
  priority: s.number<1 | 2 | 3 | 4 | 5>().default(3),
});
```

### Boolean Literals

```typescript
const schema = s.define("users", {
  // Only true allowed
  verified: s.boolean<true>(),

  // Only false allowed
  disabled: s.boolean<false>(),

  // With modifiers
  isAdmin: s.boolean<true>().optional(),
});
```

## Type Composition

### Combining Types

```typescript
const schema = s.define("ecommerce", {
  // Complex nested structure
  user: s.object({
    id: s.string().key().identity(),
    profile: s.object({
      personal: s.object({
        firstName: s.string(),
        lastName: s.string(),
        birthDate: s.date().optional(),
      }),
      contact: s.object({
        email: s.string().distinct(),
        phone: s.string().optional(),
      }),
      preferences: s.object({
        theme: s.string<"light" | "dark" | "auto">().default("auto"),
        language: s.string<"en" | "es" | "fr">().default("en"),
        notifications: s.boolean().default(true),
      }),
    }),
    roles: s.array(s.string<"user" | "moderator" | "admin">()),
    metadata: s
      .object({
        source: s.string(),
        version: s.string(),
      })
      .optional(),
  }),
});
```

## Type Conversion

### Converting to Arrays

Any type can be converted to an array using the `.array()` modifier:

```typescript
const schema = s.define("users", {
  // Convert string to array of strings
  singleTag: s.string().array(),

  // Convert number to array of numbers
  singleScore: s.number().array(),

  // Convert object to array of objects
  singleAddress: s
    .object({
      street: s.string(),
      city: s.string(),
    })
    .array(),

  // Convert boolean to array of booleans
  singleFlag: s.boolean().array(),
});
```

## Special Use Cases

### Identity Properties

Properties that auto-generate values:

```typescript
const schema = s.define("users", {
  // Auto-generated UUID
  id: s.string().key().identity(),

  // Auto-generated timestamp
  createdAt: s.date().identity(),

  // Auto-incrementing number
  version: s.number().identity(),

  // Auto-generated boolean
  isVerified: s.boolean().identity(),
});
```

### Key Properties

Properties that serve as unique identifiers:

```typescript
const schema = s.define("users", {
  // Primary key
  id: s.string().key().identity(),

  // Alternative keys
  email: s.string().key(),
  username: s.string().key(),

  // Composite key (multiple properties)
  orderId: s.string().key(),
  itemId: s.string().key(),
});
```

### Indexed Properties

Properties that create database indexes:

```typescript
const schema = s.define("users", {
  // Single field index
  name: s.string().index(),

  // Compound index
  category: s.string().index("cat_status"),
  status: s.string().index("cat_status"),

  // Multiple indexes
  email: s.string().index("email").index("email_status"),
  isActive: s.boolean().index("email_status"),
});
```

## Best Practices

### 1. **Use Literal Types for Constrained Values**

```typescript
// Good - type-safe constrained values
status: s.string<"active" | "inactive" | "suspended">();

// Avoid - generic types when specific ones exist
status: s.string(); // No type safety
```

### 2. **Leverage Type Inference**

```typescript
// Good - TypeScript will infer the correct type
const user = await ctx.users.addAsync({
  firstName: "John",
  lastName: "Doe",
  email: "john@example.com",
});

// TypeScript knows user.firstName is string
```

### 3. **Use Appropriate Types**

```typescript
// Good - specific types
email: s.string().distinct();
age: s.number().default(18);

// Avoid - generic types
email: s.any();
age: s.any();
```

### 4. **Structure Complex Data**

```typescript
// Good - well-structured nested objects
profile: s.object({
  personal: s.object({
    firstName: s.string(),
    lastName: s.string(),
  }),
  contact: s.object({
    email: s.string().distinct(),
    phone: s.string().optional(),
  }),
});

// Avoid - flat structure with prefixes
firstName: s.string(),
lastName: s.string(),
email: s.string().distinct(),
phone: s.string().optional(),
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

## Next Steps

- [Modifiers](modifiers/README.md) - Property modifiers and constraints
- [Creating A Schema](../creating-a-schema.md) - Back to schema creation
- [Schema Reference](../reference.md) - Complete schema API reference
