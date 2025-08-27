# CRUD Operations

Routier provides a powerful and intuitive CRUD (Create, Read, Update, Delete) API that leverages change tracking and proxy-based entities for efficient data management.

## Overview

CRUD operations in Routier work through a **DataStore** class that you inherit from. The DataStore manages collections of entities and provides change tracking through proxy objects. Here's how it works:

1. **Create a DataStore** by inheriting from the base class
2. **Define collections** using schemas
3. **Perform operations** on collections (add, remove, update)
4. **Track changes** automatically through proxy entities
5. **Save changes** when ready to persist

## ⚠️ Critical: Persistence Requires Explicit Save

**Important: Changes made to entities (including adds, updates, and deletes) are NOT automatically persisted to the database. You must explicitly call `saveChanges()` or `saveChangesAsync()` to persist any changes.**

```typescript
// Example: Changes are tracked but NOT persisted
const user = await ctx.users.firstOrUndefinedAsync((u) => u.id === "123");
user.name = "New Name"; // Change tracked in memory

// Change is tracked but NOT in database yet
const hasChanges = await ctx.hasChangesAsync(); // true

// Must call saveChanges to persist to database
await ctx.saveChangesAsync(); // Now change is persisted
```

## Creating a DataStore

### Basic Setup

```typescript
import { DataStore } from "routier";
import { MemoryPlugin } from "routier-plugin-memory";
import { s } from "routier-core/schema";

// Define your schemas
const userSchema = s
  .define("users", {
    id: s.string().key().identity(),
    name: s.string(),
    email: s.string().distinct(),
    age: s.number().optional(),
  })
  .compile();

// Create your DataStore class
class AppContext extends DataStore {
  constructor() {
    // Pass a plugin to the super constructor
    super(new MemoryPlugin("my-app"));
  }

  // Create collections from schemas
  users = this.collection(userSchema).create();
}
```

### Using Different Plugins

```typescript
import { MemoryPlugin } from "routier-plugin-memory";
import { DexiePlugin } from "routier-plugin-dexie";
import { PouchDbPlugin } from "routier-plugin-pouchdb";

// Memory (fastest, no persistence)
class MemoryContext extends DataStore {
  constructor() {
    super(new MemoryPlugin("my-app"));
  }
  users = this.collection(userSchema).create();
}

// Dexie (IndexedDB, browser persistence)
class DexieContext extends DataStore {
  constructor() {
    super(new DexiePlugin("my-database"));
  }
  users = this.collection(userSchema).create();
}

// PouchDB (sync-capable)
class PouchContext extends DataStore {
  constructor() {
    super(new PouchDbPlugin("my-sync-db"));
  }
  users = this.collection(userSchema).create();
}
```

## CRUD Operations

### Callback API Result Pattern

Routier uses a **discriminated union result pattern** for callback-based operations. The callback receives a single `result` parameter that can be either:

- **Success**: `{ ok: "success", data: T }`
- **Error**: `{ ok: "error", error: any }`

```typescript
// Example: Adding with callback
ctx.users.add({ name: "John Doe", email: "john@example.com" }, (result) => {
  if (result.ok === "error") {
    console.error("Failed to add user:", result.error);
    return;
  }
  console.log("User added:", result.data);
});

// Example: Querying with callback
ctx.users.first(
  (user) => user.email === "john@example.com",
  (result) => {
    if (result.ok === "error") {
      console.error("Query failed:", result.error);
      return;
    }
    const user = result.data;
    if (user) {
      console.log("Found user:", user.name);
    }
  }
);
```

### Create (Add)

#### Adding Single Entities

```typescript
const ctx = new AppContext();

// Add a single user
const newUser = await ctx.users.addAsync({
  name: "John Doe",
  email: "john@example.com",
  age: 30,
});

console.log(newUser); // User with generated ID
```

#### Adding Multiple Entities

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

console.log(newUsers); // Array of users with generated IDs
```

#### Adding with Callbacks

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
    console.log("User added:", result.data);
  }
);
```

### Read (Query)

#### Basic Queries

```typescript
// Get all users
const allUsers = await ctx.users.toArrayAsync();

// Get first user
const firstUser = await ctx.users.firstOrUndefinedAsync();

// Check if any users exist
const hasUsers = await ctx.users.someAsync();
```

#### Filtered Queries

```typescript
// Filter by condition
const activeUsers = await ctx.users
  .where((user) => user.age >= 18)
  .toArrayAsync();

// Filter with parameters
const usersByName = await ctx.users
  .where((user, params) => user.name.startsWith(params.prefix), {
    prefix: "John",
  })
  .toArrayAsync();

// Complex filters
const filteredUsers = await ctx.users
  .where((user) => user.age >= 18 && user.email.includes("@"))
  .toArrayAsync();
```

#### Sorting and Pagination

```typescript
// Sort by name
const sortedUsers = await ctx.users.sort((user) => user.name).toArrayAsync();

// Sort by multiple fields
const multiSorted = await ctx.users
  .sort((user) => user.age)
  .sort((user) => user.name)
  .toArrayAsync();

// Pagination
const paginatedUsers = await ctx.users
  .sort((user) => user.name)
  .skip(10)
  .take(5)
  .toArrayAsync();
```

#### Aggregation

```typescript
// Count
const userCount = await ctx.users.countAsync();

// Sum
const totalAge = await ctx.users.sumAsync((user) => user.age);

// Min/Max
const youngestAge = await ctx.users.minAsync((user) => user.age);
const oldestAge = await ctx.users.maxAsync((user) => user.age);

// Distinct values
const uniqueAges = await ctx.users.distinctAsync((user) => user.age);
```

### Update

#### Direct Property Updates

The key feature of Routier is that entities returned from queries are **proxy objects** that automatically track changes:

```typescript
// Get a user
const user = await ctx.users.firstOrUndefinedAsync(
  (u) => u.name === "John Doe"
);

if (user) {
  // Update properties directly - changes are tracked automatically
  user.name = "John Smith";
  user.age = 31;

  // The entity tracks its own changes via the proxy
  // No need to call any update methods
}
```

#### Batch Updates

```typescript
// Update multiple users
const usersToUpdate = await ctx.users
  .where((user) => user.age < 18)
  .toArrayAsync();

// Update each user
usersToUpdate.forEach((user) => {
  user.status = "minor";
  user.requiresParentalConsent = true;
});
```

#### Update with Callbacks

```typescript
// Using callback-based API for updates
ctx.users.first(
  (user) => user.name === "John Doe",
  (result) => {
    if (result.ok === "error") {
      console.error("Failed to find user:", result.error);
      return;
    }

    const user = result.data;
    if (user) {
      user.name = "John Smith";
      user.age = 31;
    }
  }
);
```

### Delete (Remove)

#### Removing Single Entities

```typescript
// Get and remove a user
const userToRemove = await ctx.users.firstOrUndefinedAsync(
  (u) => u.name === "John Doe"
);

if (userToRemove) {
  await ctx.users.removeAsync(userToRemove);
}
```

#### Removing Multiple Entities

```typescript
// Remove multiple users
const usersToRemove = await ctx.users
  .where((user) => user.status === "inactive")
  .toArrayAsync();

await ctx.users.removeAsync(...usersToRemove);
```

#### Removing by Query

```typescript
// Remove all users matching a condition
await ctx.users.where((user) => user.age < 13).removeAsync();
```

#### Remove with Callbacks

```typescript
// Using callback-based API with result pattern
ctx.users.remove([userToRemove], (result) => {
  if (result.ok === "error") {
    console.error("Failed to remove user:", result.error);
    return;
  }
  console.log("User removed:", result.data);
});
```

## Change Tracking and Persistence

### How Change Tracking Works

Routier uses **proxy objects** to automatically track changes to entities:

1. **Entities are proxied** when returned from queries
2. **Property changes are tracked** automatically
3. **Changes accumulate** in memory until you explicitly save them
4. **No manual update calls** needed for tracking
5. **Changes are NOT persisted until saveChanges() is called**

```typescript
const user = await ctx.users.firstOrUndefinedAsync(
  (u) => u.name === "John Doe"
);

if (user) {
  // These changes are automatically tracked
  user.name = "John Smith"; // Tracked
  user.email = "john.smith@example.com"; // Tracked
  user.profile.avatar = "new-avatar.jpg"; // Nested changes tracked

  // The entity knows it has been modified
  // Changes are stored in the proxy
}
```

### Checking for Changes

```typescript
// Check if there are any unsaved changes
const hasChanges = await ctx.hasChangesAsync();
console.log("Has unsaved changes:", hasChanges);

// Preview what changes would be saved
const changes = await ctx.previewChangesAsync();
console.log("Pending changes:", changes);

// Important: Changes are only in memory until saveChanges() is called
```

### Saving Changes

**Important: Changes are NOT automatically persisted to the database. You must explicitly call `saveChanges()` or `saveChangesAsync()` to persist any changes.**

```typescript
// Save all pending changes
const result = await ctx.saveChangesAsync();
console.log("Changes saved:", result);

// Using callback-based API with result pattern
ctx.saveChanges((result) => {
  if (result.ok === "error") {
    console.error("Failed to save changes:", result.error);
    return;
  }
  console.log("Changes saved successfully:", result.data);
});
```

## Complete CRUD Example

```typescript
import { DataStore } from "routier";
import { MemoryPlugin } from "routier-plugin-memory";
import { s } from "routier-core/schema";

// Define schema
const productSchema = s
  .define("products", {
    id: s.string().key().identity(),
    name: s.string(),
    price: s.number(),
    category: s.string<"electronics" | "clothing" | "books">(),
    inStock: s.boolean().default(true),
    createdAt: s.date().default(() => new Date()),
  })
  .compile();

// Create DataStore
class ProductStore extends DataStore {
  constructor() {
    super(new MemoryPlugin("products"));
  }

  products = this.collection(productSchema).create();
}

// Usage
async function manageProducts() {
  const store = new ProductStore();

  try {
    // CREATE
    const newProduct = await store.products.addAsync({
      name: "Laptop",
      price: 999.99,
      category: "electronics",
    });

    // READ
    const allProducts = await store.products.toArrayAsync();
    const electronics = await store.products
      .where((p) => p.category === "electronics")
      .toArrayAsync();

    // UPDATE
    if (newProduct) {
      newProduct.price = 899.99; // Changes tracked automatically
      newProduct.inStock = false;
    }

    // Check for changes
    const hasChanges = await store.hasChangesAsync();
    console.log("Has changes:", hasChanges);

    // SAVE - CRITICAL: Changes are NOT persisted until this is called
    if (hasChanges) {
      const result = await store.saveChangesAsync();
      console.log("Changes saved:", result);
    }

    // DELETE
    if (newProduct) {
      await store.products.removeAsync(newProduct);
      await store.saveChangesAsync(); // Must save to persist deletion
    }
  } catch (error) {
    console.error("Error managing products:", error);
  }
}
```

## Best Practices

### 1. **Use Async Methods for Simplicity**

```typescript
// ✅ Good - async/await is cleaner
const user = await ctx.users.addAsync({ name: "John" });

// ❌ Avoid - callback-based API is more verbose
ctx.users.add({ name: "John" }, (result, error) => {
  // Handle result
});
```

### 2. **Leverage Change Tracking**

```typescript
// ✅ Good - let the proxy track changes
const user = await ctx.users.firstOrUndefinedAsync((u) => u.name === "John");
if (user) {
  user.name = "Johnny"; // Automatically tracked
  user.age = 25; // Automatically tracked
}

// ❌ Avoid - manual change tracking
// user.markDirty();
// user.trackChange('name', 'Johnny');
```

### 3. **Batch Operations When Possible**

```typescript
// ✅ Good - batch operations are more efficient
const users = await ctx.users.addAsync(
  { name: "User 1" },
  { name: "User 2" },
  { name: "User 3" }
);

// ❌ Avoid - multiple individual operations
const user1 = await ctx.users.addAsync({ name: "User 1" });
const user2 = await ctx.users.addAsync({ name: "User 2" });
const user3 = await ctx.users.addAsync({ name: "User 3" });
```

### 4. **Save Changes Strategically**

**Critical: You must call `saveChanges()` or `saveChangesAsync()` to persist any changes to the database.**

```typescript
// ✅ Good - save changes when logical units are complete
await ctx.users.addAsync(newUser);
await ctx.userProfiles.addAsync(newProfile);
await ctx.saveChangesAsync(); // Save both together

// ❌ Avoid - saving after every operation
await ctx.users.addAsync(newUser);
await ctx.saveChangesAsync();
await ctx.userProfiles.addAsync(newProfile);
await ctx.saveChangesAsync();

// ❌ Avoid - forgetting to save changes (changes will be lost)
await ctx.users.addAsync(newUser);
await ctx.userProfiles.addAsync(newProfile);
// Missing: await ctx.saveChangesAsync(); - Changes will NOT be persisted!
```

### 5. **Handle Errors Gracefully**

```typescript
try {
  const user = await ctx.users.addAsync({
    name: "John Doe",
    email: "john@example.com",
  });

  await ctx.saveChangesAsync();
  console.log("User created successfully:", user);
} catch (error) {
  console.error("Failed to create user:", error);
  // Handle error appropriately
}
```

## Next Steps

- [Bulk Operations](bulk/) - Advanced bulk CRUD operations
- [Data Collections](../data-collections/) - Understanding collections and change tracking
- [Queries](../../core-concepts/queries/) - Advanced querying capabilities
- [State Management](../state-management/) - Managing application state with Routier
