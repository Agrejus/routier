# Bulk Operations

Routier provides powerful bulk operations for efficiently handling large numbers of entities. Bulk operations are optimized for performance and can significantly improve the speed of data operations when working with multiple entities.

## Overview

Bulk operations allow you to:

- **Add multiple entities** in a single operation
- **Update multiple entities** efficiently
- **Remove multiple entities** by criteria
- **Process large datasets** with minimal overhead
- **Maintain consistency** across multiple operations

## ⚠️ Important: Persistence Requires Save

**Note: Bulk operations (add, update, remove) are tracked in memory but are NOT automatically persisted to the database. You must call `saveChanges()` or `saveChangesAsync()` to persist all bulk changes.**

## Bulk Create Operations

### Adding Multiple Entities

```typescript
const ctx = new AppContext();

// Add multiple users at once
const newUsers = await ctx.users.addAsync(
  {
    name: "John Doe",
    email: "john@example.com",
    age: 30,
  },
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
```

### Bulk Add with Array

```typescript
// Prepare array of entities
const usersToAdd = [
  { name: "User 1", email: "user1@example.com", age: 20 },
  { name: "User 2", email: "user2@example.com", age: 22 },
  { name: "User 3", email: "user3@example.com", age: 24 },
  // ... more users
];

// Add all at once
const addedUsers = await ctx.users.addAsync(...usersToAdd);
console.log(`Bulk added ${addedUsers.length} users`);
```

### Bulk Add with Data Generation

```typescript
// Generate test data
const generateUsers = (count: number) => {
  return Array.from({ length: count }, (_, i) => ({
    name: `User ${i + 1}`,
    email: `user${i + 1}@example.com`,
    age: 20 + (i % 40), // Ages 20-59
    status: i % 2 === 0 ? "active" : "inactive",
  }));
};

// Bulk add 100 users
const testUsers = generateUsers(100);
const addedUsers = await ctx.users.addAsync(...testUsers);
console.log(`Generated and added ${addedUsers.length} test users`);
```

## Bulk Update Operations

### Batch Property Updates

```typescript
// Get users to update
const usersToUpdate = await ctx.users
  .where((user) => user.status === "inactive")
  .toArrayAsync();

// Update all users in batch
usersToUpdate.forEach((user) => {
  user.status = "active";
  user.lastActivated = new Date();
  user.activationCount = (user.activationCount || 0) + 1;
});

// All changes are tracked automatically
console.log(`Updated ${usersToUpdate.length} users`);
```

### Conditional Bulk Updates

```typescript
// Update users based on conditions
const usersToUpdate = await ctx.users
  .where((user) => user.age < 18)
  .toArrayAsync();

// Apply different updates based on age
usersToUpdate.forEach((user) => {
  if (user.age < 13) {
    user.category = "child";
    user.requiresParentalConsent = true;
  } else {
    user.category = "teen";
    user.requiresParentalConsent = false;
  }

  user.lastCategoryUpdate = new Date();
});
```

### Bulk Updates with Transformations

```typescript
// Get users and transform them
const usersToTransform = await ctx.users
  .where((user) => user.name.includes(" "))
  .toArrayAsync();

// Transform names to title case
usersToTransform.forEach((user) => {
  user.name = user.name
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");

  user.nameNormalized = user.name.toLowerCase().replace(/\s+/g, "-");
});
```

## Bulk Delete Operations

### Remove Multiple Entities

```typescript
// Get users to remove
const usersToRemove = await ctx.users
  .where((user) => user.status === "deleted")
  .toArrayAsync();

// Remove all at once
await ctx.users.removeAsync(...usersToRemove);
console.log(`Removed ${usersToRemove.length} deleted users`);
```

### Remove by Query

```typescript
// Remove all users matching criteria
await ctx.users
  .where(
    (user) => user.lastLogin < new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
  )
  .removeAsync();

console.log("Removed users inactive for over 1 year");
```

### Bulk Remove with Confirmation

```typescript
// Get users to remove
const usersToRemove = await ctx.users
  .where((user) => user.status === "suspended")
  .toArrayAsync();

if (usersToRemove.length > 0) {
  console.log(`About to remove ${usersToRemove.length} suspended users`);

  // Confirm removal
  const confirmed = confirm(`Remove ${usersToRemove.length} suspended users?`);

  if (confirmed) {
    await ctx.users.removeAsync(...usersToRemove);
    console.log("Suspended users removed");
  }
}
```

## Bulk Operations with Change Tracking

### Efficient Change Management

```typescript
// Perform multiple operations
async function bulkUserOperations() {
  const ctx = new AppContext();

  try {
    // 1. Add new users
    const newUsers = await ctx.users.addAsync(
      { name: "New User 1", email: "new1@example.com" },
      { name: "New User 2", email: "new2@example.com" }
    );

    // 2. Update existing users
    const existingUsers = await ctx.users
      .where((user) => user.status === "pending")
      .toArrayAsync();

    existingUsers.forEach((user) => {
      user.status = "active";
      user.activatedAt = new Date();
    });

    // 3. Remove old users
    const oldUsers = await ctx.users
      .where(
        (user) =>
          user.createdAt < new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      )
      .toArrayAsync();

    await ctx.users.removeAsync(...oldUsers);

    // 4. Save all changes at once
    const result = await ctx.saveChangesAsync();
    console.log("Bulk operations completed:", result);
  } catch (error) {
    console.error("Bulk operations failed:", error);
  }
}
```

### Previewing Bulk Changes

```typescript
// Preview what will be saved
const changes = await ctx.previewChangesAsync();

console.log("Pending changes:");
console.log(`- ${changes.aggregate.adds} entities to add`);
console.log(`- ${changes.aggregate.updates} entities to update`);
console.log(`- ${changes.aggregate.removes} entities to remove`);

// Review changes before saving
if (changes.aggregate.total > 100) {
  console.warn("Large number of changes detected. Review before saving.");
  // Show confirmation dialog or review interface
} else {
  await ctx.saveChangesAsync();
}
```

## Performance Considerations

### Batch Size Optimization

```typescript
// For very large datasets, consider batching
async function addLargeDataset(entities: any[], batchSize = 1000) {
  const ctx = new AppContext();

  for (let i = 0; i < entities.length; i += batchSize) {
    const batch = entities.slice(i, i + batchSize);
    await ctx.users.addAsync(...batch);

    // Save every batch to avoid memory issues
    await ctx.saveChangesAsync();

    console.log(`Processed batch ${Math.floor(i / batchSize) + 1}`);
  }
}

// Usage
const largeDataset = generateUsers(10000);
await addLargeDataset(largeDataset, 1000);
```

### Memory Management

```typescript
// Clear references after bulk operations
async function bulkOperationWithCleanup() {
  const ctx = new AppContext();

  try {
    // Perform bulk operations
    const usersToUpdate = await ctx.users
      .where((user) => user.status === "pending")
      .toArrayAsync();

    usersToUpdate.forEach((user) => {
      user.status = "active";
    });

    await ctx.saveChangesAsync();

    // Clear references to free memory
    usersToUpdate.length = 0;
  } catch (error) {
    console.error("Operation failed:", error);
  }
}
```

## Error Handling in Bulk Operations

### Graceful Failure Handling

```typescript
async function safeBulkOperation() {
  const ctx = new AppContext();

  try {
    // Start transaction-like operation
    const usersToAdd = generateUsers(100);
    const usersToUpdate = await ctx.users
      .where((user) => user.status === "pending")
      .toArrayAsync();

    // Add new users
    await ctx.users.addAsync(...usersToAdd);

    // Update existing users
    usersToUpdate.forEach((user) => {
      user.status = "active";
    });

    // Save all changes
    await ctx.saveChangesAsync();

    console.log("Bulk operation completed successfully");
  } catch (error) {
    console.error("Bulk operation failed:", error);

    // Check what changes were made before the error
    const changes = await ctx.previewChangesAsync();
    console.log("Partial changes:", changes);

    // You might want to rollback or handle partial success
    throw error;
  }
}
```

### Partial Success Handling

```typescript
async function bulkOperationWithPartialSuccess() {
  const ctx = new AppContext();

  try {
    // Try to add users in smaller batches
    const allUsers = generateUsers(1000);
    const batchSize = 100;
    let successCount = 0;
    let failureCount = 0;

    for (let i = 0; i < allUsers.length; i += batchSize) {
      try {
        const batch = allUsers.slice(i, i + batchSize);
        await ctx.users.addAsync(...batch);
        await ctx.saveChangesAsync();
        successCount += batch.length;
      } catch (batchError) {
        failureCount += batch.length;
        console.error(
          `Batch ${Math.floor(i / batchSize) + 1} failed:`,
          batchError
        );
        // Continue with next batch
      }
    }

    console.log(
      `Bulk operation completed: ${successCount} successful, ${failureCount} failed`
    );
  } catch (error) {
    console.error("Bulk operation failed completely:", error);
  }
}
```

## Best Practices

### 1. **Use Appropriate Batch Sizes**

```typescript
// ✅ Good - reasonable batch sizes
const batchSize = 1000; // Good for most operations

// ❌ Avoid - extremely large batches
const batchSize = 100000; // May cause memory issues
```

### 2. **Save Changes Strategically**

```typescript
// ✅ Good - save after logical units
await ctx.users.addAsync(...newUsers);
await ctx.userProfiles.addAsync(...newProfiles);
await ctx.saveChangesAsync(); // Save related operations together

// ❌ Avoid - saving after every operation
for (const user of users) {
  await ctx.users.addAsync(user);
  await ctx.saveChangesAsync(); // Inefficient
}
```

### 3. **Handle Errors Gracefully**

```typescript
// ✅ Good - comprehensive error handling
try {
  await performBulkOperation();
} catch (error) {
  console.error("Operation failed:", error);
  // Handle partial success, rollback, etc.
}

// ❌ Avoid - ignoring errors
await performBulkOperation(); // Errors may go unnoticed
```

### 4. **Monitor Performance**

```typescript
// ✅ Good - track operation performance
const startTime = performance.now();
await performBulkOperation();
const duration = performance.now() - startTime;
console.log(`Bulk operation took ${duration}ms`);

// Use this data to optimize batch sizes and operations
```

## Next Steps

- [CRUD Operations](../README.md) - Back to basic CRUD operations
- [Data Collections](../../data-collections/) - Understanding collections and change tracking
- [Performance Optimization](../../../advanced-features/performance-profiling/) - Optimizing bulk operations
- [State Management](../state-management/) - Managing application state with Routier
