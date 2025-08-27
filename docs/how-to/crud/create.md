# Create Operations

Create operations in Routier allow you to add new entities to your collections. The framework provides both synchronous and asynchronous methods, with automatic change tracking and validation.

## Overview

When you create entities in Routier:

1. **Entities are validated** against your schema
2. **Default values are applied** automatically
3. **Identity fields are generated** if specified
4. **Changes are tracked** for later persistence
5. **Entities are returned** with all properties set

## ⚠️ Important: Persistence Requires Save

**Note: When you call `addAsync()`, the entity is added to the collection in memory, but it is NOT automatically persisted to the database. You must call `saveChanges()` or `saveChangesAsync()` to persist the changes.**

## Basic Create Operations

### Adding Single Entities

```typescript
const ctx = new AppContext();

// Add a single user
const newUser = await ctx.users.addAsync({
  name: "John Doe",
  email: "john@example.com",
  age: 30,
});

console.log(newUser);
// Output: { id: "generated-uuid", name: "John Doe", email: "john@example.com", age: 30 }
```

### Adding Multiple Entities

```typescript
// Add multiple users at once
const newUsers = await ctx.users.addAsync(
  {
    name: "Jane Smith",
    email: "jane@example.com",
    age: 25,
  },
  {
    name: "Bob Johnson",
    email: "bob@example.com",
    age: 35,
  }
);

console.log(`Added ${newUsers.length} users`);
// Output: Added 2 users
```

### Adding with Callbacks

**Note: Callback-based operations use a discriminated union result pattern. The callback receives a single `result` parameter that can be either `{ ok: "success", data: T }` or `{ ok: "error", error: any }`.**

```typescript
// Using callback-based API with result pattern
ctx.users.add(
  {
    name: "Alice Brown",
    email: "alice@example.com",
    age: 28,
  },
  (result) => {
    if (result.ok === "error") {
      console.error("Failed to add user:", result.error);
      return;
    }
    console.log("User added successfully:", result.data);
  }
);
```

## Schema-Driven Creation

### Automatic Default Values

```typescript
const productSchema = s
  .define("products", {
    id: s.string().key().identity(),
    name: s.string(),
    price: s.number(),
    inStock: s.boolean().default(true),
    createdAt: s.date().default(() => new Date()),
    tags: s.array(s.string()).default(() => []),
  })
  .compile();

// Create product with minimal data
const newProduct = await ctx.products.addAsync({
  name: "Laptop",
  price: 999.99,
});

console.log(newProduct);
// Output: {
//   id: "generated-uuid",
//   name: "Laptop",
//   price: 999.99,
//   inStock: true,           // Default applied
//   createdAt: "2024-01-15T10:30:00.000Z", // Default applied
//   tags: []                 // Default applied
// }
```

### Identity Field Generation

```typescript
const userSchema = s
  .define("users", {
    id: s.string().key().identity(), // Auto-generated UUID
    email: s.string().distinct(),
    createdAt: s.date().identity(), // Auto-generated timestamp
    version: s.number().identity(), // Auto-incrementing number
  })
  .compile();

const newUser = await ctx.users.addAsync({
  email: "user@example.com",
});

console.log(newUser);
// Output: {
//   id: "uuid-v4-string",           // Auto-generated
//   email: "user@example.com",
//   createdAt: "2024-01-15T10:30:00.000Z", // Auto-generated
//   version: 1                      // Auto-generated
// }
```

### Nested Object Creation

```typescript
const orderSchema = s
  .define("orders", {
    id: s.string().key().identity(),
    customer: s.object({
      name: s.string(),
      email: s.string(),
      address: s.object({
        street: s.string(),
        city: s.string(),
        zipCode: s.string(),
      }),
    }),
    items: s.array(
      s.object({
        productId: s.string(),
        quantity: s.number(),
        price: s.number(),
      })
    ),
  })
  .compile();

const newOrder = await ctx.orders.addAsync({
  customer: {
    name: "John Doe",
    email: "john@example.com",
    address: {
      street: "123 Main St",
      city: "Anytown",
      zipCode: "12345",
    },
  },
  items: [
    {
      productId: "prod-123",
      quantity: 2,
      price: 29.99,
    },
  ],
});

console.log(newOrder.customer.address.city); // "Anytown"
```

## Validation and Error Handling

### Schema Validation

```typescript
try {
  const invalidUser = await ctx.users.addAsync({
    // Missing required fields
    age: 30,
    // name and email are required but missing
  });
} catch (error) {
  console.error("Validation failed:", error.message);
  // Output: Validation failed: Required field 'name' is missing
}
```

### Type Validation

```typescript
try {
  const invalidUser = await ctx.users.addAsync({
    name: "John Doe",
    email: "john@example.com",
    age: "thirty", // Should be number, not string
  });
} catch (error) {
  console.error("Type validation failed:", error.message);
  // Output: Type validation failed: Expected number for field 'age'
}
```

### Constraint Validation

```typescript
try {
  const duplicateUser = await ctx.users.addAsync({
    name: "John Doe",
    email: "john@example.com", // Email must be unique
    age: 30,
  });
} catch (error) {
  console.error("Constraint validation failed:", error.message);
  // Output: Constraint validation failed: Email must be unique
}
```

## Advanced Create Patterns

### Conditional Creation

```typescript
async function createUserIfNotExists(userData: any) {
  // Check if user already exists
  const existingUser = await ctx.users.firstOrUndefinedAsync(
    (user) => user.email === userData.email
  );

  if (existingUser) {
    console.log("User already exists:", existingUser);
    return existingUser;
  }

  // Create new user
  const newUser = await ctx.users.addAsync(userData);
  console.log("New user created:", newUser);
  return newUser;
}

// Usage
const user = await createUserIfNotExists({
  name: "John Doe",
  email: "john@example.com",
  age: 30,
});
```

### Batch Creation with Validation

```typescript
async function createUsersWithValidation(usersData: any[]) {
  const validUsers = [];
  const invalidUsers = [];

  for (const userData of usersData) {
    try {
      // Validate data before adding
      if (!userData.name || !userData.email) {
        invalidUsers.push({
          data: userData,
          reason: "Missing required fields",
        });
        continue;
      }

      if (userData.age && (userData.age < 0 || userData.age > 150)) {
        invalidUsers.push({ data: userData, reason: "Invalid age" });
        continue;
      }

      validUsers.push(userData);
    } catch (error) {
      invalidUsers.push({ data: userData, reason: error.message });
    }
  }

  // Add all valid users
  if (validUsers.length > 0) {
    const addedUsers = await ctx.users.addAsync(...validUsers);
    console.log(`Added ${addedUsers.length} valid users`);
  }

  if (invalidUsers.length > 0) {
    console.warn(`${invalidUsers.length} users were invalid:`, invalidUsers);
  }

  return { validUsers, invalidUsers };
}

// Usage
const usersData = [
  { name: "John", email: "john@example.com", age: 30 },
  { name: "Jane", email: "jane@example.com" }, // Missing age
  { name: "Bob", email: "bob@example.com", age: 200 }, // Invalid age
  { email: "alice@example.com", age: 25 }, // Missing name
];

const result = await createUsersWithValidation(usersData);
```

### Creation with Computed Fields

```typescript
const userSchema = s
  .define("users", {
    id: s.string().key().identity(),
    firstName: s.string(),
    lastName: s.string(),
    fullName: s
      .string()
      .computed((user) => `${user.firstName} ${user.lastName}`),
    email: s.string().distinct(),
    createdAt: s.date().default(() => new Date()),
  })
  .compile();

const newUser = await ctx.users.addAsync({
  firstName: "John",
  lastName: "Doe",
  email: "john.doe@example.com",
});

console.log(newUser.fullName); // "John Doe" - computed automatically
```

## Performance Considerations

### Batch Creation

```typescript
// ✅ Good - batch creation is more efficient
const users = await ctx.users.addAsync(
  { name: "User 1", email: "user1@example.com" },
  { name: "User 2", email: "user2@example.com" },
  { name: "User 3", email: "user3@example.com" }
);

// ❌ Avoid - individual creation is less efficient
const user1 = await ctx.users.addAsync({
  name: "User 1",
  email: "user1@example.com",
});
const user2 = await ctx.users.addAsync({
  name: "User 2",
  email: "user2@example.com",
});
const user3 = await ctx.users.addAsync({
  name: "User 3",
  email: "user3@example.com",
});
```

### Memory Management

```typescript
// For large datasets, consider batching
async function createLargeDataset(entities: any[], batchSize = 1000) {
  for (let i = 0; i < entities.length; i += batchSize) {
    const batch = entities.slice(i, i + batchSize);
    await ctx.users.addAsync(...batch);

    // Save every batch to avoid memory issues
    await ctx.saveChangesAsync();

    console.log(`Created batch ${Math.floor(i / batchSize) + 1}`);
  }
}

// Usage
const largeDataset = generateUsers(10000);
await createLargeDataset(largeDataset, 1000);
```

## Best Practices

### 1. **Validate Data Before Creation**

```typescript
// ✅ Good - validate before creating
function validateUserData(userData: any) {
  if (!userData.name || userData.name.trim().length === 0) {
    throw new Error("Name is required");
  }

  if (!userData.email || !userData.email.includes("@")) {
    throw new Error("Valid email is required");
  }

  if (userData.age && (userData.age < 0 || userData.age > 150)) {
    throw new Error("Age must be between 0 and 150");
  }
}

// Usage
try {
  validateUserData(userData);
  const user = await ctx.users.addAsync(userData);
} catch (error) {
  console.error("Validation failed:", error.message);
}
```

### 2. **Use Appropriate Default Values**

```typescript
// ✅ Good - meaningful defaults
const productSchema = s
  .define("products", {
    id: s.string().key().identity(),
    name: s.string(),
    price: s.number(),
    inStock: s.boolean().default(true),
    createdAt: s.date().default(() => new Date()),
    status: s.string<"draft" | "published" | "archived">().default("draft"),
  })
  .compile();

// ❌ Avoid - confusing defaults
const productSchema = s
  .define("products", {
    id: s.string().key().identity(),
    name: s.string(),
    price: s.number(),
    inStock: s.boolean().default(false), // Most products should be in stock
    status: s.string().default("unknown"), // Vague default
  })
  .compile();
```

### 3. **Handle Errors Gracefully**

```typescript
// ✅ Good - comprehensive error handling
async function createUserSafely(userData: any) {
  try {
    const user = await ctx.users.addAsync(userData);
    console.log("User created successfully:", user);
    return user;
  } catch (error) {
    if (error.message.includes("unique")) {
      console.error("User with this email already exists");
      // Handle duplicate gracefully
    } else if (error.message.includes("required")) {
      console.error("Missing required fields");
      // Handle validation errors
    } else {
      console.error("Unexpected error:", error);
      // Handle unexpected errors
    }

    throw error; // Re-throw for caller to handle
  }
}
```

### 4. **Leverage Schema Features**

```typescript
// ✅ Good - use schema features effectively
const userSchema = s
  .define("users", {
    id: s.string().key().identity(),
    email: s.string().distinct(), // Ensures uniqueness
    status: s.string<"active" | "inactive" | "suspended">().default("active"),
    createdAt: s.date().identity(), // Auto-generated
    updatedAt: s.date().default(() => new Date()),
  })
  .compile();

// The schema handles uniqueness, defaults, and identity generation
const user = await ctx.users.addAsync({
  email: "user@example.com",
  // Other fields get sensible defaults
});
```

## Next Steps

- [Read Operations](read.md) - Learn how to query and retrieve data
- [Update Operations](update.md) - Learn how to modify existing entities
- [Delete Operations](delete.md) - Learn how to remove entities
- [Bulk Operations](bulk/README.md) - Learn how to handle multiple entities efficiently
