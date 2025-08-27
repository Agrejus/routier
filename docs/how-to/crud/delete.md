# Delete Operations

Delete operations in Routier allow you to remove entities from your collections. The framework provides both individual and batch deletion methods, with support for query-based removal and proper cleanup.

## Overview

Routier's delete operations feature:

1. **Individual entity removal** - Remove specific entities by reference
2. **Batch deletion** - Remove multiple entities efficiently
3. **Query-based removal** - Remove entities matching specific criteria
4. **Automatic cleanup** - Proper disposal of removed entities
5. **Change tracking** - Deletions are tracked until saved

## ⚠️ Important: Persistence Requires Save

**Note: When you call `removeAsync()`, the entity is marked for removal in memory, but it is NOT automatically removed from the database. You must call `saveChanges()` or `saveChangesAsync()` to persist the deletion.**

## Basic Delete Operations

### Removing Single Entities

```typescript
const ctx = new AppContext();

// Get user to remove
const userToRemove = await ctx.users.firstOrUndefinedAsync(
  (u) => u.email === "john@example.com"
);

if (userToRemove) {
  // Remove the user
  await ctx.users.removeAsync(userToRemove);
  console.log("User removed successfully");
}
```

### Removing Multiple Entities

```typescript
// Get multiple users to remove
const usersToRemove = await ctx.users
  .where((user) => user.status === "deleted")
  .toArrayAsync();

// Remove all at once
await ctx.users.removeAsync(...usersToRemove);
console.log(`Removed ${usersToRemove.length} deleted users`);
```

### Removing with Callbacks

```typescript
**Note: Callback-based operations use a discriminated union result pattern. The callback receives a single `result` parameter that can be either `{ ok: "success", data: T }` or `{ ok: "error", error: any }`.**

// Using callback-based API with result pattern
const userToRemove = await ctx.users.firstOrUndefinedAsync(
  (u) => u.id === "user-123"
);

if (userToRemove) {
  ctx.users.remove([userToRemove], (result) => {
    if (result.ok === "error") {
      console.error("Failed to remove user:", result.error);
      return;
    }
    console.log("User removed successfully:", result.data);
  });
}
```

## Query-Based Deletion

### Remove by Query

```typescript
// Remove all users matching criteria
await ctx.users.where((user) => user.status === "suspended").removeAsync();

console.log("All suspended users removed");
```

### Remove with Complex Criteria

```typescript
// Remove users based on multiple conditions
await ctx.users
  .where(
    (user) =>
      user.status === "inactive" &&
      user.lastLogin < new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
  )
  .removeAsync();

console.log("Inactive users inactive for over 1 year removed");
```

### Remove with Parameters

```typescript
// Remove users with parameterized criteria
async function removeUsersByAgeRange(minAge: number, maxAge: number) {
  await ctx.users
    .where(
      (user, params) => user.age >= params.minAge && user.age <= params.maxAge,
      { minAge, maxAge }
    )
    .removeAsync();

  console.log(`Removed users between ${minAge} and ${maxAge} years old`);
}

// Usage
await removeUsersByAgeRange(13, 17); // Remove teenage users
```

## Batch Deletion Patterns

### Remove by Status

```typescript
// Remove users by different statuses
async function cleanupUsersByStatus() {
  const statusesToRemove = ["deleted", "suspended", "banned"];

  for (const status of statusesToRemove) {
    const usersToRemove = await ctx.users
      .where((user) => user.status === status)
      .toArrayAsync();

    if (usersToRemove.length > 0) {
      await ctx.users.removeAsync(...usersToRemove);
      console.log(
        `Removed ${usersToRemove.length} users with status: ${status}`
      );
    }
  }
}

await cleanupUsersByStatus();
```

### Remove with Confirmation

```typescript
// Remove users with confirmation
async function removeUsersWithConfirmation(criteria: any) {
  const usersToRemove = await ctx.users
    .where((user) => user.status === criteria.status)
    .toArrayAsync();

  if (usersToRemove.length === 0) {
    console.log("No users found matching criteria");
    return;
  }

  console.log(`Found ${usersToRemove.length} users to remove`);
  console.log(
    "Users:",
    usersToRemove.map((u) => u.name)
  );

  // Confirm removal
  const confirmed = confirm(`Remove ${usersToRemove.length} users?`);

  if (confirmed) {
    await ctx.users.removeAsync(...usersToRemove);
    console.log("Users removed successfully");
  } else {
    console.log("Removal cancelled");
  }
}

// Usage
await removeUsersWithConfirmation({ status: "suspended" });
```

### Remove with Backup

```typescript
// Remove users with backup
async function removeUsersWithBackup(criteria: any) {
  const usersToRemove = await ctx.users
    .where((user) => user.status === criteria.status)
    .toArrayAsync();

  if (usersToRemove.length === 0) {
    return;
  }

  // Create backup before removal
  const backup = usersToRemove.map((user) => ({
    ...user,
    removedAt: new Date(),
    removedBy: "system",
    originalId: user.id,
  }));

  // Store backup (could be in a different collection or file)
  await ctx.userBackups.addAsync(...backup);

  // Remove users
  await ctx.users.removeAsync(...usersToRemove);

  console.log(`Removed ${usersToRemove.length} users with backup created`);
}
```

## Advanced Deletion Patterns

### Cascading Deletion

```typescript
// Remove user and related data
async function removeUserCascading(userId: string) {
  const user = await ctx.users.firstOrUndefinedAsync((u) => u.id === userId);

  if (!user) {
    console.log("User not found");
    return;
  }

  try {
    // Remove related orders
    const userOrders = await ctx.orders
      .where((order) => order.userId === userId)
      .toArrayAsync();

    if (userOrders.length > 0) {
      await ctx.orders.removeAsync(...userOrders);
      console.log(`Removed ${userOrders.length} orders`);
    }

    // Remove related profile
    const userProfile = await ctx.userProfiles.firstOrUndefinedAsync(
      (p) => p.userId === userId
    );

    if (userProfile) {
      await ctx.userProfiles.removeAsync(userProfile);
      console.log("Removed user profile");
    }

    // Remove user
    await ctx.users.removeAsync(user);
    console.log("User removed successfully");
  } catch (error) {
    console.error("Failed to remove user and related data:", error);
    throw error;
  }
}
```

### Soft Deletion

```typescript
// Soft delete instead of hard delete
async function softDeleteUser(userId: string) {
  const user = await ctx.users.firstOrUndefinedAsync((u) => u.id === userId);

  if (!user) {
    console.log("User not found");
    return;
  }

  // Mark as deleted instead of removing
  user.status = "deleted";
  user.deletedAt = new Date();
  user.deletedBy = "system";
  user.isDeleted = true;

  // Keep the user but mark as deleted
  console.log("User soft deleted");
}
```

### Conditional Deletion

```typescript
// Remove users based on business rules
async function removeUsersByBusinessRules() {
  const usersToEvaluate = await ctx.users
    .where((user) => user.status === "pending")
    .toArrayAsync();

  const usersToRemove = [];

  for (const user of usersToEvaluate) {
    // Check business rules
    const shouldRemove =
      user.createdAt < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) && // Older than 7 days
      !user.emailVerified && // Not verified
      !user.phoneVerified; // Not verified

    if (shouldRemove) {
      usersToRemove.push(user);
    }
  }

  if (usersToRemove.length > 0) {
    await ctx.users.removeAsync(...usersToRemove);
    console.log(
      `Removed ${usersToRemove.length} users based on business rules`
    );
  }
}
```

## Change Management for Deletions

### Checking Deletion Changes

```typescript
// Check what deletions are pending
const changes = await ctx.previewChangesAsync();
console.log("Pending changes:", changes);

if (changes.aggregate.removes > 0) {
  console.log(`${changes.aggregate.removes} entities marked for removal`);
}
```

### Saving Deletion Changes

```typescript
// Remove users and save changes
async function removeUsersAndSave(userIds: string[]) {
  for (const userId of userIds) {
    const user = await ctx.users.firstOrUndefinedAsync((u) => u.id === userId);
    if (user) {
      await ctx.users.removeAsync(user);
    }
  }

  // Save all deletion changes
  const result = await ctx.saveChangesAsync();
  console.log("Deletion changes saved:", result);
}
```

### Rolling Back Deletions

```typescript
// Rollback deletions before saving
async function removeUsersWithRollback(userIds: string[]) {
  const removedUsers = [];

  try {
    // Remove users
    for (const userId of userIds) {
      const user = await ctx.users.firstOrUndefinedAsync(
        (u) => u.id === userId
      );
      if (user) {
        await ctx.users.removeAsync(user);
        removedUsers.push(user);
      }
    }

    // Check if we want to proceed
    const confirmed = confirm(`Remove ${removedUsers.length} users?`);

    if (confirmed) {
      await ctx.saveChangesAsync();
      console.log("Users removed successfully");
    } else {
      // Rollback by clearing the change tracker
      // Note: This is a simplified example - actual rollback depends on your setup
      console.log("Removal cancelled, changes rolled back");
    }
  } catch (error) {
    console.error("Failed to remove users:", error);
    throw error;
  }
}
```

## Performance Considerations

### Batch Deletion

```typescript
// ✅ Good - batch deletion is more efficient
const usersToRemove = await ctx.users
  .where((user) => user.status === "deleted")
  .toArrayAsync();

await ctx.users.removeAsync(...usersToRemove);
await ctx.saveChangesAsync(); // Save all at once

// ❌ Avoid - individual deletion and saving
for (const user of usersToRemove) {
  await ctx.users.removeAsync(user);
  await ctx.saveChangesAsync(); // Inefficient
}
```

### Large Dataset Deletion

```typescript
// For very large datasets, consider batching
async function removeLargeDataset(criteria: any, batchSize = 1000) {
  let totalRemoved = 0;
  let hasMore = true;

  while (hasMore) {
    const batch = await ctx.users
      .where((user) => user.status === criteria.status)
      .take(batchSize)
      .toArrayAsync();

    if (batch.length === 0) {
      hasMore = false;
      break;
    }

    await ctx.users.removeAsync(...batch);
    await ctx.saveChangesAsync();

    totalRemoved += batch.length;
    console.log(
      `Removed batch: ${batch.length} users (Total: ${totalRemoved})`
    );
  }

  console.log(`Total users removed: ${totalRemoved}`);
}

// Usage
await removeLargeDataset({ status: "inactive" }, 1000);
```

## Error Handling

### Safe Deletion

```typescript
async function safeDeleteUser(userId: string) {
  try {
    const user = await ctx.users.firstOrUndefinedAsync((u) => u.id === userId);

    if (!user) {
      throw new Error("User not found");
    }

    // Check if user can be deleted
    if (user.status === "admin") {
      throw new Error("Cannot delete admin users");
    }

    if (user.hasActiveOrders) {
      throw new Error("Cannot delete user with active orders");
    }

    // Proceed with deletion
    await ctx.users.removeAsync(user);
    await ctx.saveChangesAsync();

    console.log("User deleted successfully");
  } catch (error) {
    console.error("Failed to delete user:", error);
    throw error;
  }
}
```

### Deletion with Recovery

```typescript
async function deleteUserWithRecovery(userId: string) {
  const user = await ctx.users.firstOrUndefinedAsync((u) => u.id === userId);

  if (!user) {
    throw new Error("User not found");
  }

  try {
    // Create recovery point
    const recoveryData = {
      originalUser: { ...user },
      deletedAt: new Date(),
      deletedBy: "system",
    };

    // Store recovery data
    await ctx.deletionRecovery.addAsync(recoveryData);

    // Proceed with deletion
    await ctx.users.removeAsync(user);
    await ctx.saveChangesAsync();

    console.log("User deleted with recovery data stored");
  } catch (error) {
    console.error("Failed to delete user:", error);

    // Clean up recovery data if deletion failed
    await ctx.deletionRecovery
      .where((r) => r.originalUser.id === userId)
      .removeAsync();

    throw error;
  }
}
```

## Best Practices

### 1. **Confirm Deletions for Important Data**

```typescript
// ✅ Good - confirm important deletions
async function deleteUserWithConfirmation(userId: string) {
  const user = await ctx.users.firstOrUndefinedAsync((u) => u.id === userId);

  if (!user) return;

  const confirmed = confirm(
    `Are you sure you want to delete user "${user.name}" (${user.email})?`
  );

  if (confirmed) {
    await ctx.users.removeAsync(user);
    await ctx.saveChangesAsync();
    console.log("User deleted");
  }
}

// ❌ Avoid - silent deletions
// await ctx.users.removeAsync(user);
```

### 2. **Use Appropriate Deletion Methods**

```typescript
// ✅ Good - use query-based removal for multiple entities
await ctx.users.where((user) => user.status === "deleted").removeAsync();

// ✅ Good - use individual removal for specific entities
await ctx.users.removeAsync(specificUser);

// ❌ Avoid - mixing approaches unnecessarily
const users = await ctx.users
  .where((u) => u.status === "deleted")
  .toArrayAsync();
for (const user of users) {
  await ctx.users.removeAsync(user); // Less efficient
}
```

### 3. **Handle Related Data Appropriately**

```typescript
// ✅ Good - handle related data before deletion
async function deleteUserWithCleanup(userId: string) {
  // Remove related data first
  await ctx.userOrders.where((order) => order.userId === userId).removeAsync();

  await ctx.userProfiles
    .where((profile) => profile.userId === userId)
    .removeAsync();

  // Then remove user
  const user = await ctx.users.firstOrUndefinedAsync((u) => u.id === userId);
  if (user) {
    await ctx.users.removeAsync(user);
  }

  await ctx.saveChangesAsync();
}

// ❌ Avoid - leaving orphaned data
// await ctx.users.removeAsync(user);
// // Related orders and profiles are now orphaned
```

### 4. **Log Deletion Operations**

```typescript
// ✅ Good - log deletion operations
async function deleteUserWithLogging(userId: string, reason: string) {
  const user = await ctx.users.firstOrUndefinedAsync((u) => u.id === userId);

  if (!user) return;

  // Log the deletion
  await ctx.deletionLogs.addAsync({
    entityType: "user",
    entityId: userId,
    entityName: user.name,
    deletedAt: new Date(),
    deletedBy: "system",
    reason: reason,
  });

  // Perform deletion
  await ctx.users.removeAsync(user);
  await ctx.saveChangesAsync();

  console.log(`User "${user.name}" deleted. Reason: ${reason}`);
}
```

## Next Steps

- [Create Operations](create.md) - Learn how to add new entities
- [Read Operations](read.md) - Learn how to query and retrieve data
- [Update Operations](update.md) - Learn how to modify existing entities
- [Bulk Operations](bulk/README.md) - Learn how to handle multiple entities efficiently
