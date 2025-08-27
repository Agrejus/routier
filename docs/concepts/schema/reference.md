# Schema Reference

Complete API reference for Routier schemas, including all methods, types, and advanced features.

## Schema Builder

### `s.object()`

Creates an object schema with the specified properties.

```typescript
const schema = s.object({
  id: s.string().key().identity(),
  name: s.string(),
  email: s.string().email(),
});
```

### `s.define(name, properties)`

Defines a named schema with properties and returns a schema builder.

```typescript
const schema = s
  .define("user", {
    id: s.string().key().identity(),
    name: s.string(),
    email: s.string().email(),
  })
  .compile();
```

### `s.array(elementType)`

Creates an array schema with the specified element type.

```typescript
const schema = s.object({
  tags: s.array(s.string()),
  scores: s.array(s.number()),
  users: s.array(
    s.object({
      id: s.string(),
      name: s.string(),
    })
  ),
});
```

### `s.union(types)`

Creates a union schema that accepts any of the specified types.

```typescript
const schema = s.object({
  identifier: s.union([s.string(), s.number()]),
  status: s.union([
    s.literal("active"),
    s.literal("inactive"),
    s.literal("pending"),
  ]),
});
```

### `s.literal(...values)`

Creates a literal schema that only accepts the specified values.

```typescript
const schema = s.object({
  role: s.literal("admin", "user", "moderator"),
  type: s.literal("post", "comment", "user"),
  status: s.literal("draft", "published", "archived"),
});
```

### `s.any()`

Creates a schema that accepts any value.

```typescript
const schema = s.object({
  metadata: s.any(),
  customData: s.any(),
});
```

### `s.unknown()`

Creates a schema that accepts unknown values (safer than `any`).

```typescript
const schema = s.object({
  externalData: s.unknown(),
  apiResponse: s.unknown(),
});
```

### `s.record(keyType, valueType)`

Creates a record schema for key-value pairs.

```typescript
const schema = s.object({
  settings: s.record(s.string(), s.unknown()),
  metadata: s.record(s.string(), s.string()),
  config: s.record(s.string(), s.union([s.string(), s.number(), s.boolean()])),
});
```

## Property Types

### String Properties

```typescript
// Basic string
s.string();

// String with validation
s.string().email();
s.string().url();
s.string().uuid();
s.string().ipv4();
s.string().ipv6();
s.string().creditCard();
s.string().phoneNumber();

// String with constraints
s.string().min(1);
s.string().max(100);
s.string().length(10);

// String with pattern
s.string().pattern(/^[a-zA-Z]+$/);
```

### Number Properties

```typescript
// Basic number
s.number();

// Number with constraints
s.number().min(0);
s.number().max(100);
s.number().integer();
s.number().positive();
s.number().negative();
s.number().precision(2);
s.number().multiple(5);
```

### Boolean Properties

```typescript
// Basic boolean
s.boolean();

// Boolean with default
s.boolean().default(true);
s.boolean().default(false);
```

### Date Properties

```typescript
// Basic date
s.date();

// Date with constraints
s.date().min(new Date());
s.date().max(new Date());
s.date().past();
s.date().future();
s.date().today();
s.date().weekday();
s.date().weekend();
```

## Property Modifiers

### Identity and Keys

```typescript
// Primary key
s.string().key();

// Auto-generated identity
s.string().identity();
s.number().identity();
s.date().identity();

// Unique constraint
s.string().unique();
s.number().unique();
```

### Indexing

```typescript
// Single field index
s.string().index();

// Compound index
s.string().index("compound_name");
s.number().index("compound_name");
```

### Validation

```typescript
// Range validation
s.number().min(0).max(100);
s.string().min(1).max(100);
s.array(s.string()).min(1).max(10);

// Pattern validation
s.string().pattern(/regex/);

// Custom validation
s.string().validate((value) => boolean | string);
```

### Defaults and Values

```typescript
// Default values
s.string().default("value");
s.number().default(0);
s.boolean().default(true);
s.date().default(() => new Date());
s.array(s.string()).default(() => []);

// Required fields
s.string().required();

// Optional fields
s.string().optional();
```

### Behavior Control

```typescript
// Read-only properties
s.string().readonly()

// Change tracking
s.string().tracked()

// Computed properties
s.string().computed((entity) => string)

// Function properties
s.function().computed((entity) => function)
```

### Serialization

```typescript
// Custom serialization
s.date().serialize((date) => string);
s.number().serialize((num) => string);

// Custom deserialization
s.date().deserialize((str) => Date);
s.number().deserialize((str) => number);
```

## Schema Modification

### `.modify(modifier)`

Applies modifications to the schema.

```typescript
const schema = s
  .define("user", {
    firstName: s.string(),
    lastName: s.string(),
  })
  .modify((w) => ({
    fullName: w.computed((user) => `${user.firstName} ${user.lastName}`),
    documentType: w.computed((_, t) => t).tracked(),
    greet: w.function(
      (user) => (greeting) => `${greeting}, ${user.firstName}!`
    ),
  }))
  .compile();
```

### Computed Properties

```typescript
// Basic computed property
w.computed((entity) => value);

// Computed with type context
w.computed((entity, type) => value);

// Computed with tracking
w.computed((entity) => value).tracked();
```

### Function Properties

```typescript
// Basic function property
w.function((entity) => function)

// Function with parameters
w.function((entity) => (param1, param2) => result)

// Function with validation
w.function((entity) => function).validate((fn) => boolean)
```

## Schema Compilation

### `.compile()`

Compiles the schema into its final form.

```typescript
const schema = s
  .define("user", {
    id: s.string().key().identity(),
    name: s.string(),
  })
  .compile();
```

## Schema Information

### `.getProperties()`

Returns information about all properties in the schema.

```typescript
const properties = schema.getProperties();
// Returns array of PropertyInfo objects
```

### `.getIndexes()`

Returns information about all indexes in the schema.

```typescript
const indexes = schema.getIndexes();
// Returns array of IndexInfo objects
```

### `.getIdProperties()`

Returns information about identity properties.

```typescript
const idProperties = schema.getIdProperties();
// Returns array of PropertyInfo objects
```

### `.hasIdentityKeys`

Boolean indicating if the schema has identity keys.

```typescript
if (schema.hasIdentityKeys) {
  // Schema has identity keys
}
```

## Type Inference

### `InferType<T>`

Extracts the TypeScript type from a schema.

```typescript
const userSchema = s.object({
  id: s.string().key().identity(),
  name: s.string(),
  email: s.string().email(),
});

type User = InferType<typeof userSchema>;
// User = { id: string; name: string; email: string; }
```

### `InferCreateType<T>`

Extracts the creation type (without identity fields).

```typescript
type CreateUser = InferCreateType<typeof userSchema>;
// CreateUser = { name: string; email: string; }
```

## Schema Structure Checking

### `.validate(data)`

Validates data against the schema.

```typescript
const result = schema.validate(userData);
if (result.valid) {
  // Data is valid
  const user = result.data;
} else {
  // Data is invalid
  console.log(result.errors);
}
```

### `.isValid(data)`

Quick check if data is valid.

```typescript
if (schema.isValid(userData)) {
  // Data is valid
} else {
  // Data is invalid
}
```

## Schema Serialization

### `.serialize(data)`

Serializes data according to schema rules.

```typescript
const serialized = schema.serialize(userData);
// Returns serialized version of the data
```

### `.deserialize(data)`

Deserializes data according to schema rules.

```typescript
const deserialized = schema.deserialize(serializedData);
// Returns deserialized version of the data
```

## Advanced Features

### Custom Validators

```typescript
const schema = s.object({
  email: s
    .string()
    .email()
    .validate((email) => {
      // Custom business logic
      if (email.endsWith("@example.com")) {
        return "Example.com emails not allowed";
      }
      return true;
    }),
});
```

### Conditional Validation

```typescript
const schema = s.object({
  type: s.literal("individual", "company"),
  companyName: s.string().validate((name, entity) => {
    if (entity.type === "company" && !name) {
      return "Company name required for company type";
    }
    return true;
  }),
});
```

### Dynamic Schemas

```typescript
const createDynamicSchema = (fields: string[]) => {
  const properties: Record<string, any> = {
    id: s.string().key().identity(),
  };

  fields.forEach((field) => {
    properties[field] = s.string();
  });

  return s.object(properties).compile();
};
```

## Best Practices

### 1. **Schema Organization**

```typescript
// Good - organized by purpose
const userSchema = s
  .define("user", {
    // Identity
    id: s.string().key().identity(),

    // Required fields
    name: s.string().required(),
    email: s.string().email().required(),

    // Optional fields
    avatar: s.string().url().optional(),

    // Computed fields
    displayName: s
      .string()
      .computed((user) => (user.avatar ? user.name : user.name)),
  })
  .compile();
```

### 2. **Validation Strategy**

```typescript
// Good - validate at schema level
const schema = s.object({
  age: s.number().min(0).max(120),
  email: s.string().email().unique(),
});

// Avoid - validation in application code
// if (user.age < 0 || user.age > 120) { ... }
```

### 3. **Type Safety**

```typescript
// Good - leverage TypeScript inference
const user = await ctx.users.addAsync({
  name: "John",
  email: "john@example.com",
  // TypeScript will catch missing required fields
});

// Good - use inferred types
type User = InferType<typeof userSchema>;
function processUser(user: User) { ... }
```

### 4. **Performance Considerations**

```typescript
// Good - use indexes for frequently queried fields
const schema = s.object({
  id: s.string().key().identity(),
  email: s.string().email().unique().index(),
  status: s.string().index(),
});

// Good - avoid unnecessary computed properties
// Only compute what you actually need
```

## Error Handling

### Validation Errors

```typescript
const result = schema.validate(data);
if (!result.valid) {
  result.errors.forEach((error) => {
    console.log(`Field ${error.field}: ${error.message}`);
  });
}
```

### Schema Compilation Errors

```typescript
try {
  const schema = s
    .object({
      // Invalid schema definition
    })
    .compile();
} catch (error) {
  console.log("Schema compilation failed:", error.message);
}
```

## Next Steps

- [Creating A Schema](creating-a-schema.md) - Back to schema creation guide
- [Property Types](property-types/README.md) - Detailed property type reference
- [Modifiers](modifiers/README.md) - Property modifier reference
- [Why Schemas?](why-schemas.md) - Understanding schema benefits
