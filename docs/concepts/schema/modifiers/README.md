# Property Modifiers

Property modifiers in Routier allow you to customize the behavior, constraints, and metadata of your schema properties. They can be chained together to create powerful, flexible schemas that accurately represent your database structure.

## Available Modifiers

All schema types support these core modifiers:

- **`.optional()`** - Makes the property optional
- **`.nullable()`** - Allows the property to be null
- **`.default(value)`** - Sets a default value
- **`.readonly()`** - Makes the property read-only
- **`.deserialize(fn)`** - Custom deserialization function
- **`.serialize(fn)`** - Custom serialization function
- **`.array()`** - Converts the property to an array type
- **`.index(...names)`** - Creates database indexes

Additional modifiers are available on specific types:

- **`.key()`** - Marks as primary key (string, number, date)
- **`.identity()`** - Auto-generates values (string, number, date, boolean)
- **`.distinct()`** - Ensures unique values (string, number, date, boolean)

## Identity and Keys

### `.key()`

Marks a property as a primary key for the entity.

```typescript
const schema = s.define("users", {
  id: s.string().key().identity(), // Primary key
  email: s.string().key(), // Alternative key
  username: s.string().key(), // Another key
});
```

**Available on:** `string`, `number`, `date`

### `.identity()`

Automatically generates a unique value for the property.

```typescript
const schema = s.define("users", {
  id: s.string().key().identity(), // Auto-generated UUID
  createdAt: s.date().identity(), // Auto-generated timestamp
  version: s.number().identity(), // Auto-incrementing number
});
```

**Available on:** `string`, `number`, `date`, `boolean`

## Indexing

### `.index()`

Creates a database index for efficient querying.

```typescript
const schema = s.define("users", {
  id: s.string().key().identity(),
  name: s.string().index(), // Single field index
  category: s.string().index("cat_status"), // Compound index
  status: s.string().index("cat_status"), // Same compound index
  priority: s.number().index(), // Numeric index
});
```

**Available on:** All types

### Compound Indexes

Multiple fields can share the same index name for compound indexing.

```typescript
const schema = s.define("orders", {
  id: s.string().key().identity(),
  userId: s.string().index("user_date"), // Compound index
  date: s.date().index("user_date"), // Same compound index
  type: s.string().index("user_date"), // Same compound index
});
```

## Defaults and Values

### `.default()`

Sets a default value for the property. Can accept either a direct value or a function that returns a value.

```typescript
const schema = s.define("users", {
  // Direct values
  status: s.string().default("active"),
  isEnabled: s.boolean().default(true),
  count: s.number().default(0),

  // Function values (evaluated when needed)
  createdAt: s.date().default(() => new Date()),
  updatedAt: s.date().default(() => new Date()),

  // Complex defaults with functions
  tags: s.array(s.string()).default(() => []),
  settings: s
    .object({
      theme: s.string().default("light"),
      language: s.string().default("en"),
    })
    .default(() => ({ theme: "light", language: "en" })),

  // Dynamic defaults based on injected context
  userId: s.string().default((injected) => injected.currentUserId),
});
```

**Available on:** All types

**Note:** When using a function, it's evaluated each time a default is needed, making it perfect for dynamic values like timestamps or context-dependent defaults. The function can also accept an optional `injected` parameter for context-dependent defaults.

## Behavior Control

### `.optional()`

Makes the property optional (can be undefined).

```typescript
const schema = s.define("users", {
  id: s.string().key().identity(),
  name: s.string(),
  middleName: s.string().optional(),
  nickname: s.string().optional(),
  avatar: s.string().optional(),
});
```

**Available on:** All types

### `.nullable()`

Makes the property nullable (can be null).

```typescript
const schema = s.define("users", {
  id: s.string().key().identity(),
  name: s.string(),
  avatar: s.string().nullable(),
  lastLogin: s.date().nullable(),
});
```

**Available on:** All types

### `.readonly()`

Makes the property read-only after creation.

```typescript
const schema = s.define("users", {
  id: s.string().key().identity().readonly(),
  createdAt: s
    .date()
    .default(() => new Date())
    .readonly(),
  version: s.number().identity().readonly(),
});
```

**Available on:** All types

## Serialization

### `.serialize()`

Custom serialization function for the property.

```typescript
const schema = s.define("users", {
  date: s.date().serialize((date) => date.toISOString()),
  price: s.number().serialize((price) => Math.round(price * 100)),
  tags: s.array(s.string()).serialize((tags) => tags.join(",")),
  settings: s
    .object({
      theme: s.string(),
      language: s.string(),
    })
    .serialize((settings) => JSON.stringify(settings)),
});
```

**Available on:** All types

### `.deserialize()`

Custom deserialization function for the property.

```typescript
const schema = s.define("users", {
  date: s.date().deserialize((str) => new Date(str)),
  price: s.number().deserialize((cents) => cents / 100),
  tags: s.string().deserialize((str) => str.split(",").filter(Boolean)),
  settings: s.string().deserialize((str) => JSON.parse(str)),
});
```

**Available on:** All types

## Type Conversion

### `.array()`

Converts the property to an array type.

```typescript
const schema = s.define("users", {
  id: s.string().key().identity(),
  name: s.string(),

  // Convert single string to array of strings
  tags: s.string().array(),

  // Convert single number to array of numbers
  scores: s.number().array(),

  // Convert object to array of objects
  addresses: s
    .object({
      street: s.string(),
      city: s.string(),
    })
    .array(),
});
```

**Available on:** All types

### `.distinct()`

Ensures the property value is unique across all entities.

```typescript
const schema = s.define("users", {
  id: s.string().key().identity(),
  email: s.string().distinct(), // Must be unique
  username: s.string().distinct(), // Must be unique
  phoneNumber: s.string().distinct(), // Must be unique
});
```

**Available on:** `string`, `number`, `date`, `boolean`

## Chaining Modifiers

Modifiers can be chained together in any order:

```typescript
const schema = s.define("users", {
  // Complex property with multiple modifiers
  email: s
    .string()
    .default("user@example.com")
    .distinct()
    .optional()
    .deserialize((str) => str.toLowerCase())
    .serialize((str) => str.trim()),

  // Computed property with modifiers
  displayName: s
    .string()
    .optional()
    .default(() => "Anonymous"),

  // Array with complex validation
  scores: s
    .array(s.number())
    .default(() => [])
    .optional(),
});
```

## Modifier Compatibility

Not all modifiers can be used together. Here are the key rules:

### Mutually Exclusive Modifiers

- **`.optional()`** and **`.nullable()`** - Can be used together
- **`.key()`** and **`.optional()`** - Cannot be used together (keys are always required)
- **`.identity()`** and **`.default()`** - Cannot be used together (identity generates values)

### Modifier Order

While modifiers can be chained in any order, it's recommended to follow this pattern:

```typescript
// Good - logical order
email: s.string().distinct().optional().default("user@example.com");

// Avoid - confusing order
email: s.string().default("user@example.com").distinct().optional();
```

## Best Practices

### 1. **Use Built-in Modifiers**

```typescript
// Good - use built-in modifiers
email: s.string().distinct();
createdAt: s.date().default(() => new Date());

// Avoid - custom validation when built-in exists
email: s.string().validate((email) => email.includes("@"));
```

### 2. **Define Constraints Early**

```typescript
// Good - define constraints at schema level
age: s.number().default(18);

// Avoid - constraints defined elsewhere
age: s.number(); // Constraints defined elsewhere
```

### 3. **Leverage Type Safety**

```typescript
// Good - use literal types for constrained values
status: s.string<"active" | "inactive" | "suspended">();

// Avoid - generic types when specific ones exist
status: s.string(); // No type safety
```

### 4. **Use Appropriate Modifiers**

```typescript
// Good - use .optional() for truly optional fields
middleName: s.string().optional();

// Avoid - using .nullable() when .optional() is more appropriate
middleName: s.string().nullable(); // Allows null but not undefined
```

## Next Steps

- [Property Types](../property-types/README.md) - Available property types
- [Creating A Schema](../creating-a-schema.md) - Back to schema creation
- [Schema Reference](../reference.md) - Complete schema API reference
