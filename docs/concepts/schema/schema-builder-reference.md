# Schema Builder Reference

This document provides a comprehensive reference for the Routier schema builder, showing all available types, modifiers, and their combinations.

## Schema Builder Entry Point

```typescript
import { s } from "routier-core/schema";

// Start every schema with s.define()
const schema = s
  .define("collectionName", {
    // properties go here
  })
  .compile();
```

## Available Types

### Basic Types

| Type        | Builder            | Generic Support | Description                               |
| ----------- | ------------------ | --------------- | ----------------------------------------- |
| **String**  | `s.string<T>()`    | ✅              | String with optional literal constraints  |
| **Number**  | `s.number<T>()`    | ✅              | Number with optional literal constraints  |
| **Boolean** | `s.boolean<T>()`   | ✅              | Boolean with optional literal constraints |
| **Date**    | `s.date<T>()`      | ✅              | Date with optional literal constraints    |
| **Array**   | `s.array(schema)`  | ❌              | Array containing other schemas            |
| **Object**  | `s.object(schema)` | ❌              | Object with nested schema                 |

### Type Examples

```typescript
// String types
s.string()                           // Any string
s.string<"active" | "inactive">()   // Constrained to specific values

// Number types
s.number()                           // Any number
s.number<1 | 2 | 3 | 4 | 5>()      // Constrained to specific values

// Boolean types
s.boolean()                          // Any boolean
s.boolean<true>()                   // Only true allowed

// Date types
s.date()                            // Any date
s.date<Date>()                     // Generic date (same as above)

// Array types
s.array(s.string())                 // Array of strings
s.array(s.number())                 // Array of numbers
s.array(s.object({...}))            // Array of objects

// Object types
s.object({                          // Object with nested schema
  name: s.string(),
  age: s.number()
})
```

## Available Modifiers

### Core Modifiers (All Types)

| Modifier        | Method             | Description              | Returns             |
| --------------- | ------------------ | ------------------------ | ------------------- |
| **Optional**    | `.optional()`      | Makes property optional  | `SchemaOptional`    |
| **Nullable**    | `.nullable()`      | Allows null values       | `SchemaNullable`    |
| **Default**     | `.default(value)`  | Sets default value       | `SchemaDefault`     |
| **Readonly**    | `.readonly()`      | Makes property read-only | `SchemaReadonly`    |
| **Deserialize** | `.deserialize(fn)` | Custom deserialization   | `SchemaDeserialize` |
| **Serialize**   | `.serialize(fn)`   | Custom serialization     | `SchemaSerialize`   |
| **Array**       | `.array()`         | Converts to array type   | `SchemaArray`       |
| **Index**       | `.index(...names)` | Creates database indexes | `SchemaIndex`       |

### Type-Specific Modifiers

| Modifier     | Method        | Available On                          | Description           | Returns          |
| ------------ | ------------- | ------------------------------------- | --------------------- | ---------------- |
| **Key**      | `.key()`      | `string`, `number`, `date`            | Marks as primary key  | `SchemaKey`      |
| **Identity** | `.identity()` | `string`, `number`, `date`, `boolean` | Auto-generates values | `SchemaIdentity` |
| **Distinct** | `.distinct()` | `string`, `number`, `date`, `boolean` | Ensures unique values | `SchemaDistinct` |

## Complete Modifier Reference

### `.optional()`

Makes a property optional (can be undefined).

```typescript
// Available on all types
s.string().optional()
s.number().optional()
s.boolean().optional()
s.date().optional()
s.object({...}).optional()
s.array(s.string()).optional()
```

### `.nullable()`

Makes a property nullable (can be null).

```typescript
// Available on all types
s.string().nullable()
s.number().nullable()
s.boolean().nullable()
s.date().nullable()
s.object({...}).nullable()
s.array(s.string()).nullable()
```

### `.default(value | function)`

Sets a default value for the property. Can accept either a direct value or a function that returns a value.

```typescript
// Available on all types
// Direct values
s.string().default("active")
s.number().default(0)
s.boolean().default(true)

// Function values (evaluated when needed)
s.date().default(() => new Date())
s.string().default(() => generateId())

// Complex defaults with functions
s.object({...}).default(() => ({ theme: "light" }))
s.array(s.string()).default(() => [])

// Dynamic defaults based on injected context
s.string().default((injected) => injected.currentUserId)
```

### `.readonly()`

Makes a property read-only after creation.

```typescript
// Available on all types
s.string().readonly()
s.number().readonly()
s.boolean().readonly()
s.date().readonly()
s.object({...}).readonly()
s.array(s.string()).readonly()
```

### `.deserialize(fn)`

Custom deserialization function.

```typescript
// Available on all types
s.string().deserialize((str) => str.trim())
s.number().deserialize((str) => parseInt(str))
s.date().deserialize((str) => new Date(str))
s.boolean().deserialize((val) => Boolean(val))
s.object({...}).deserialize((str) => JSON.parse(str))
s.array(s.string()).deserialize((str) => str.split(","))
```

### `.serialize(fn)`

Custom serialization function.

```typescript
// Available on all types
s.string().serialize((str) => str.toLowerCase())
s.number().serialize((num) => Math.round(num))
s.date().serialize((date) => date.toISOString())
s.boolean().serialize((bool) => bool ? 1 : 0)
s.object({...}).serialize((obj) => JSON.stringify(obj))
s.array(s.string()).serialize((arr) => arr.join(","))
```

### `.array()`

Converts the property to an array type.

```typescript
// Available on all types
s.string().array()                    // string[] -> string[][]
s.number().array()                    // number[] -> number[][]
s.boolean().array()                   // boolean[] -> boolean[][]
s.date().array()                      // Date[] -> Date[][]
s.object({...}).array()               // object[] -> object[][]
s.array(s.string()).array()           // string[][] -> string[][][]
```

### `.index(...names)`

Creates database indexes for efficient querying.

```typescript
// Available on all types
s.string().index(); // Single field index
s.string().index("compound"); // Compound index
s.string().index("idx1", "idx2"); // Multiple indexes
s.number().index("priority");
s.date().index("created_at");
s.boolean().index("status");
```

### `.key()`

Marks a property as a primary key.

```typescript
// Available on: string, number, date
s.string().key();
s.number().key();
s.date().key();

// Not available on: boolean, object, array
// s.boolean().key()     // ❌ Error
// s.object({...}).key() // ❌ Error
// s.array(s.string()).key() // ❌ Error
```

### `.identity()`

Automatically generates values for the property.

```typescript
// Available on: string, number, date, boolean
s.string().identity();
s.number().identity();
s.date().identity();
s.boolean().identity();

// Not available on: object, array
// s.object({...}).identity() // ❌ Error
// s.array(s.string()).identity() // ❌ Error
```

### `.distinct()`

Ensures the property value is unique across all entities.

```typescript
// Available on: string, number, date, boolean
s.string().distinct();
s.number().distinct();
s.date().distinct();
s.boolean().distinct();

// Not available on: object, array
// s.object({...}).distinct() // ❌ Error
// s.array(s.string()).distinct() // ❌ Error
```

## Modifier Combinations

### Valid Combinations

Modifiers can be chained together in various combinations:

```typescript
// Basic combinations
s.string().optional().nullable();
s.string().default("value").readonly();
s.string().distinct().index();

// Complex combinations
s.string()
  .distinct()
  .optional()
  .default("user@example.com")
  .deserialize((str) => str.toLowerCase())
  .serialize((str) => str.trim())
  .index("email");
```

### Mutually Exclusive Modifiers

Some modifiers cannot be used together:

```typescript
// ❌ Cannot use .key() with .optional() (keys are always required)
s.string().key().optional(); // Error

// ❌ Cannot use .identity() with .default() (identity generates values)
s.string().identity().default("value"); // Error

// ✅ Can use .optional() with .nullable()
s.string().optional().nullable(); // Valid

// ✅ Can use .distinct() with .index()
s.string().distinct().index(); // Valid
```

## Default Value Examples

### Direct Values vs Functions

```typescript
const schema = s.define("users", {
  // Direct values - set once when schema is created
  status: s.string().default("active"),
  isEnabled: s.boolean().default(true),
  count: s.number().default(0),

  // Function values - evaluated each time default is needed
  createdAt: s.date().default(() => new Date()),
  updatedAt: s.date().default(() => new Date()),

  // Complex defaults with functions
  tags: s.array(s.string()).default(() => []),
  metadata: s
    .object({
      version: s.string().default("1.0.0"),
      lastModified: s.date().default(() => new Date()),
    })
    .default(() => ({ version: "1.0.0", lastModified: new Date() })),

  // Context-dependent defaults using injected parameter
  userId: s.string().default((injected) => injected.currentUserId),
  tenantId: s.string().default((injected) => injected.tenantId),
});
```

## Complete Schema Examples

### Basic User Schema

```typescript
const userSchema = s
  .define("users", {
    // Primary key
    id: s.string().key().identity(),

    // Required fields
    firstName: s.string(),
    lastName: s.string(),
    email: s.string().distinct(),

    // Optional fields
    middleName: s.string().optional(),
    avatar: s.string().optional(),

    // Fields with defaults
    isActive: s.boolean().default(true),
    createdAt: s.date().default(() => new Date()),

    // Readonly fields
    version: s.number().identity().readonly(),

    // Indexed fields
    username: s.string().index(),
    status: s.string<"active" | "inactive">().index("status_created"),
    createdAt: s.date().index("status_created"),
  })
  .compile();
```

### Complex Product Schema

```typescript
const productSchema = s
  .define("products", {
    // Primary key
    id: s.string().key().identity(),

    // Basic fields
    name: s.string(),
    description: s.string().optional(),
    price: s.number(),

    // Constrained fields
    status: s.string<"draft" | "published" | "archived">(),
    category: s.string<"electronics" | "clothing" | "books">(),
    priority: s.number<1 | 2 | 3 | 4 | 5>().default(3),

    // Object fields
    metadata: s
      .object({
        source: s.string(),
        version: s.string(),
        tags: s.array(s.string()).default(() => []),
      })
      .optional(),

    // Array fields
    images: s.array(s.string()).default(() => []),
    variants: s
      .array(
        s.object({
          color: s.string(),
          size: s.string(),
          stock: s.number().default(0),
        })
      )
      .default(() => []),

    // Indexed fields
    name: s.string().index("name_category"),
    category: s.string().index("name_category"),
    price: s.number().index("price_range"),
  })
  .compile();
```

### Nested Schema Example

```typescript
const orderSchema = s
  .define("orders", {
    // Primary key
    id: s.string().key().identity(),

    // User reference
    userId: s.string().index("user_date"),

    // Order details
    items: s.array(
      s.object({
        productId: s.string(),
        quantity: s.number(),
        price: s.number(),
        total: s.number().computed((item) => item.quantity * item.price),
      })
    ),

    // Shipping information
    shipping: s.object({
      address: s.object({
        street: s.string(),
        city: s.string(),
        state: s.string(),
        zipCode: s.string(),
        country: s.string(),
      }),
      method: s.string<"standard" | "express" | "overnight">(),
      cost: s.number(),
    }),

    // Order metadata
    status: s.string<"pending" | "processing" | "shipped" | "delivered">(),
    createdAt: s
      .date()
      .default(() => new Date())
      .index("user_date"),
    updatedAt: s.date().default(() => new Date()),

    // Computed fields
    totalItems: s
      .number()
      .computed((order) =>
        order.items.reduce((sum, item) => sum + item.quantity, 0)
      ),
    totalAmount: s
      .number()
      .computed(
        (order) =>
          order.items.reduce((sum, item) => sum + item.total, 0) +
          order.shipping.cost
      ),
  })
  .compile();
```

## Best Practices

### 1. **Use Literal Types for Constraints**

```typescript
// ✅ Good - type-safe constrained values
status: s.string<"active" | "inactive" | "suspended">();

// ❌ Avoid - generic types when specific ones exist
status: s.string(); // No type safety
```

### 2. **Chain Modifiers Logically**

```typescript
// ✅ Good - logical order
email: s.string().distinct().optional().default("user@example.com");

// ❌ Avoid - confusing order
email: s.string().default("user@example.com").distinct().optional();
```

### 3. **Use Appropriate Modifiers**

```typescript
// ✅ Good - use .optional() for truly optional fields
middleName: s.string().optional();

// ❌ Avoid - using .nullable() when .optional() is more appropriate
middleName: s.string().nullable(); // Allows null but not undefined
```

### 4. **Leverage Type Safety**

```typescript
// ✅ Good - TypeScript will infer the correct type
const user = await ctx.users.addAsync({
  firstName: "John",
  lastName: "Doe",
  email: "john@example.com",
});

// TypeScript knows user.firstName is string
```

## Type Compatibility Matrix

| Type        | Optional | Nullable | Default | Readonly | Deserialize | Serialize | Array | Index | Key | Identity | Distinct |
| ----------- | -------- | -------- | ------- | -------- | ----------- | --------- | ----- | ----- | --- | -------- | -------- |
| **String**  | ✅       | ✅       | ✅      | ✅       | ✅          | ✅        | ✅    | ✅    | ✅  | ✅       | ✅       |
| **Number**  | ✅       | ✅       | ✅      | ✅       | ✅          | ✅        | ✅    | ✅    | ✅  | ✅       | ✅       |
| **Boolean** | ✅       | ✅       | ✅      | ✅       | ✅          | ✅        | ✅    | ✅    | ❌  | ✅       | ✅       |
| **Date**    | ✅       | ✅       | ✅      | ✅       | ✅          | ✅        | ✅    | ✅    | ✅  | ✅       | ✅       |
| **Object**  | ✅       | ✅       | ✅      | ✅       | ❌          | ❌        | ✅    | ❌    | ❌  | ✅       | ❌       |
| **Array**   | ✅       | ✅       | ✅      | ❌       | ✅          | ✅        | ❌    | ✅    | ❌  | ❌       | ❌       |

## Next Steps

- [Creating A Schema](creating-a-schema.md) - How to create schemas
- [Property Types](property-types/README.md) - Detailed property type reference
- [Modifiers](modifiers/README.md) - All available property modifiers
- [Schema Reference](reference.md) - Complete schema API reference
