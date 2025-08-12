# Creating A Schema

Schemas in Routier define the structure and behavior of your data entities.

## Basic Schema Definition

```typescript
import { s } from "routier-core/schema";

const userSchema = s
  .define("user", {
    _id: s.string().key().identity(),
    _rev: s.string().identity(),
    name: s.string(),
    email: s.string(),
    age: s.number().optional(),
  })
  .compile();
```

## Schema Structure

### Required Properties

Every schema should have:

- **`_id`** - Unique identifier (usually with `.key().identity()`)
- **`_rev`** - Revision identifier for change tracking

### Property Types

```typescript
const exampleSchema = s
  .define("example", {
    // Basic types
    stringField: s.string(),
    numberField: s.number(),
    booleanField: s.boolean(),
    dateField: s.date(),

    // Complex types
    objectField: s.object({
      nested: s.string(),
      deep: s.object({
        value: s.number(),
      }),
    }),
    arrayField: s.array(s.string()),

    // Special types
    anyField: s.any(),
    unknownField: s.unknown(),
  })
  .compile();
```

## Property Modifiers

### Identity and Keys

```typescript
const schema = s
  .define("example", {
    // Primary key with auto-generated ID
    _id: s.string().key().identity(),

    // Unique identifier
    email: s.string().identity(),

    // Indexed field
    name: s.string().index(),

    // Compound index
    category: s.string().index("category", "status"),
    status: s.string().index("category", "status"),
  })
  .compile();
```

### Defaults and Validation

```typescript
const schema = s
  .define("example", {
    // Default values
    createdAt: s.date().default(() => new Date()),
    status: s.string().default("active"),

    // Optional fields
    description: s.string().optional(),

    // Readonly fields
    id: s.string().readonly(),

    // Tracked fields (for change detection)
    lastModified: s.date().tracked(),
  })
  .compile();
```

### Serialization

```typescript
const schema = s
  .define("example", {
    // Custom serialization
    date: s
      .date()
      .default(() => new Date())
      .deserialize((x) => new Date(x))
      .serialize((x) => x.toISOString()),

    // Custom transformation
    fullName: s
      .string()
      .deserialize((x) => x.trim())
      .serialize((x) => x.toLowerCase()),
  })
  .compile();
```

## Schema Modification

### Computed Properties

```typescript
const schema = s
  .define("user", {
    firstName: s.string(),
    lastName: s.string(),
    age: s.number(),
  })
  .modify((w) => ({
    // Computed property
    fullName: w.computed((w) => `${w.firstName} ${w.lastName}`),

    // Computed with type context
    documentType: w.computed((_, t) => t).tracked(),

    // Function property
    greet: w.function((w) => `Hello, ${w.firstName}!`),
  }))
  .compile();
```

## Compiling Schemas

Always call `.compile()` at the end to create the final schema:

```typescript
const schema = s
  .define("example", {
    // ... properties
  })
  .modify((w) => ({
    // ... modifications
  }))
  .compile(); // This is required!
```

## Next Steps

- [Property Types](property-types/README.md) - Detailed property type reference
- [Modifiers](modifiers/README.md) - All available property modifiers
- [Schema Reference](reference.md) - Complete schema API reference
- [Why Schemas?](why-schemas.md) - Understanding the benefits of schemas
