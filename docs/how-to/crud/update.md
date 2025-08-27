# Update Operations

Update operations in Routier leverage the framework's powerful change tracking system. Entities returned from queries are **proxy objects** that automatically track changes, making updates simple and efficient.

## Overview

Routier's update system works through:

1. **Proxy-based change tracking** - Entities automatically track modifications
2. **No manual update calls** - Changes are detected automatically
3. **Batch change management** - Multiple changes are saved together
4. **Type-safe updates** - Full TypeScript support for property modifications
5. **Efficient persistence** - Changes are optimized for database operations

## How Change Tracking Works

### Proxy Entities

When you query entities in Routier, they are returned as **proxy objects** that automatically track changes:

```typescript
const ctx = new AppContext();

// Get a user - this returns a proxy object
const user = await ctx.users.firstOrUndefinedAsync(
  (u) => u.name === "John Doe"
);

if (user) {
  // These changes are automatically tracked by the proxy
  user.name = "John Smith"; // Tracked
  user.age = 31; // Tracked
  user.profile.avatar = "new-avatar.jpg"; // Nested changes tracked

  // The entity knows it has been modified
  // No need to call any update methods

  // IMPORTANT: Changes are NOT persisted until saveChanges() is called
}
```

### Automatic Change Detection

```typescript
// Get user and make changes
const user = await ctx.users.firstOrUndefinedAsync(
  (u) => u.email === "john@example.com"
);

if (user) {
  // Update basic properties
  user.firstName = "Johnny";
  user.lastName = "Smith";

  // Update nested objects
  user.address.street = "456 Oak Avenue";
  user.address.city = "New City";

  // Update arrays
  user.tags.push("premium");
  user.tags.push("verified");

  // All changes are tracked automatically
  console.log("User has been modified");

  // Note: Changes are still only in memory at this point
}
```

## Basic Update Operations

### Single Property Updates

```typescript
const ctx = new AppContext();

// Get user and update
const user = await ctx.users.firstOrUndefinedAsync(
  (u) => u.email === "john@example.com"
);

if (user) {
  // Simple property update
  user.name = "John Smith";
  user.age = 31;

  // Changes are tracked automatically
  console.log("User updated:", user.name);
}
```

### Multiple Property Updates

```typescript
// Update multiple properties at once
const user = await ctx.users.firstOrUndefinedAsync((u) => u.id === "user-123");

if (user) {
  // Update multiple properties
  user.firstName = "John";
  user.lastName = "Smith";
  user.email = "john.smith@example.com";
  user.phone = "+1-555-0123";
  user.status = "active";

  // All changes are tracked
  console.log("Multiple properties updated");
}
```

### Nested Object Updates

```typescript
// Update nested object properties
const user = await ctx.users.firstOrUndefinedAsync((u) => u.id === "user-123");

if (user) {
  // Update nested address
  user.address.street = "789 Pine Street";
  user.address.city = "Metropolis";
  user.address.state = "NY";
  user.address.zipCode = "10001";

  // Update nested profile
  user.profile.bio = "Updated bio information";
  user.profile.website = "https://johnsmith.com";
  user.profile.socialMedia = {
    twitter: "@johnsmith",
    linkedin: "john-smith-123",
  };

  // All nested changes are tracked
  console.log("Nested objects updated");
}
```

### Array Updates

```typescript
// Update array properties
const user = await ctx.users.firstOrUndefinedAsync((u) => u.id === "user-123");

if (user) {
  // Add to arrays
  user.tags.push("premium");
  user.tags.push("verified");

  // Remove from arrays
  user.tags = user.tags.filter((tag) => tag !== "temporary");

  // Replace entire arrays
  user.preferences = ["dark-theme", "notifications", "analytics"];

  // Update array elements
  if (user.orders.length > 0) {
    user.orders[0].status = "shipped";
    user.orders[0].trackingNumber = "TRK123456";
  }

  // All array changes are tracked
  console.log("Arrays updated");
}
```

## Batch Update Operations

### Update Multiple Entities

```typescript
// Get multiple users to update
const usersToUpdate = await ctx.users
  .where((user) => user.status === "inactive")
  .toArrayAsync();

// Update all users in batch
usersToUpdate.forEach((user) => {
  user.status = "active";
  user.lastActivated = new Date();
  user.activationCount = (user.activationCount || 0) + 1;
});

console.log(`Updated ${usersToUpdate.length} users`);
```

### Conditional Batch Updates

```typescript
// Update users based on different conditions
const usersToUpdate = await ctx.users
  .where((user) => user.age < 18)
  .toArrayAsync();

// Apply different updates based on age
usersToUpdate.forEach((user) => {
  if (user.age < 13) {
    user.category = "child";
    user.requiresParentalConsent = true;
    user.accessLevel = "restricted";
  } else {
    user.category = "teen";
    user.requiresParentalConsent = false;
    user.accessLevel = "limited";
  }

  user.lastCategoryUpdate = new Date();
  user.updatedBy = "system";
});

console.log(`Updated ${usersToUpdate.length} users with age-based categories`);
```

### Batch Updates with Transformations

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
  user.nameUpdated = true;
  user.lastNameUpdate = new Date();
});

console.log(`Transformed ${usersToTransform.length} user names`);
```

## Advanced Update Patterns

### Computed Updates

```typescript
// Update based on computed values
const usersToUpdate = await ctx.users
  .where((user) => user.status === "active")
  .toArrayAsync();

usersToUpdate.forEach((user) => {
  // Compute age group
  user.ageGroup = user.age < 18 ? "minor" : user.age < 65 ? "adult" : "senior";

  // Compute profile completeness
  user.profileComplete = !!(user.avatar && user.bio && user.address);

  // Compute account age
  const accountAge = Date.now() - user.createdAt.getTime();
  user.accountAgeDays = Math.floor(accountAge / (1000 * 60 * 60 * 24));

  // Compute verification status
  user.isFullyVerified =
    user.emailVerified && user.phoneVerified && user.idVerified;
});

console.log(`Updated ${usersToUpdate.length} users with computed values`);
```

### Incremental Updates

```typescript
// Increment counters and timestamps
const usersToUpdate = await ctx.users
  .where((user) => user.status === "active")
  .toArrayAsync();

usersToUpdate.forEach((user) => {
  // Increment counters
  user.loginCount = (user.loginCount || 0) + 1;
  user.viewCount = (user.viewCount || 0) + 1;

  // Update timestamps
  user.lastLogin = new Date();
  user.lastActivity = new Date();

  // Increment version
  user.version = (user.version || 0) + 1;
});

console.log(`Incremented counters for ${usersToUpdate.length} users`);
```

### Conditional Field Updates

```typescript
// Update fields conditionally
const usersToUpdate = await ctx.users
  .where((user) => user.status === "pending")
  .toArrayAsync();

usersToUpdate.forEach((user) => {
  // Only update if certain conditions are met
  if (user.email && user.email.includes("@")) {
    user.emailVerified = true;
    user.verificationDate = new Date();
  }

  if (user.phone && user.phone.length >= 10) {
    user.phoneVerified = true;
    user.phoneVerificationDate = new Date();
  }

  // Update status based on verification
  if (user.emailVerified && user.phoneVerified) {
    user.status = "verified";
    user.verifiedAt = new Date();
  }
});

console.log(`Conditionally updated ${usersToUpdate.length} users`);
```

## Change Management

### Checking for Changes

```typescript
// Check if there are any unsaved changes
const hasChanges = await ctx.hasChangesAsync();
console.log("Has unsaved changes:", hasChanges);

// Preview what changes would be saved
const changes = await ctx.previewChangesAsync();
console.log("Pending changes:", changes);

// Check changes for specific collection
const userChanges = ctx.users.hasChanges();
console.log("Users collection has changes:", userChanges);
```

### Saving Changes

```typescript
// Save all pending changes
const result = await ctx.saveChangesAsync();
console.log("Changes saved:", result);

**Note: Callback-based operations use a discriminated union result pattern. The callback receives a single `result` parameter that can be either `{ ok: "success", data: T }` or `{ ok: "error", error: any }`.**

// Using callback-based API with result pattern
ctx.saveChanges((result) => {
  if (result.ok === "error") {
    console.error("Failed to save changes:", result.error);
    return;
  }
  console.log("Changes saved successfully:", result.data);
});
```

### Partial Saves

```typescript
// Save changes for specific operations
async function updateUserProfile(userId: string, profileData: any) {
  const user = await ctx.users.firstOrUndefinedAsync((u) => u.id === userId);

  if (!user) {
    throw new Error("User not found");
  }

  // Update profile
  Object.assign(user.profile, profileData);
  user.profileUpdatedAt = new Date();

  // Save only these changes
  await ctx.saveChangesAsync();

  console.log("User profile updated and saved");
  return user;
}
```

## Update Validation

### Schema Validation

```typescript
// Updates are validated against the schema
const user = await ctx.users.firstOrUndefinedAsync((u) => u.id === "user-123");

if (user) {
  try {
    // This will be validated against the schema
    user.age = "invalid-age"; // Should be number
  } catch (error) {
    console.error("Validation failed:", error.message);
    // The change won't be tracked if it's invalid
  }
}
```

### Business Logic Validation

```typescript
// Custom validation before updates
async function updateUserStatus(userId: string, newStatus: string) {
  const user = await ctx.users.firstOrUndefinedAsync((u) => u.id === userId);

  if (!user) {
    throw new Error("User not found");
  }

  // Business logic validation
  if (newStatus === "suspended" && user.role === "admin") {
    throw new Error("Cannot suspend admin users");
  }

  if (newStatus === "premium" && user.subscriptionLevel === "free") {
    throw new Error("Free users cannot have premium status");
  }

  // Update if validation passes
  user.status = newStatus;
  user.statusUpdatedAt = new Date();
  user.statusUpdatedBy = "system";

  await ctx.saveChangesAsync();
  console.log("User status updated successfully");
}
```

## Performance Considerations

### Batch Updates

```typescript
// ✅ Good - batch updates are more efficient
const usersToUpdate = await ctx.users
  .where((user) => user.status === "pending")
  .toArrayAsync();

usersToUpdate.forEach((user) => {
  user.status = "active";
  user.activatedAt = new Date();
});

await ctx.saveChangesAsync(); // Save all at once

// ❌ Avoid - saving after every update
for (const user of usersToUpdate) {
  user.status = "active";
  user.activatedAt = new Date();
  await ctx.saveChangesAsync(); // Inefficient
}
```

### Change Batching

```typescript
// Group related changes together
async function processUserRegistration(userId: string) {
  const user = await ctx.users.firstOrUndefinedAsync((u) => u.id === userId);

  if (!user) return;

  // Group all registration-related updates
  user.status = "active";
  user.registeredAt = new Date();
  user.verificationStatus = "verified";
  user.welcomeEmailSent = true;
  user.lastActivity = new Date();

  // Save all changes together
  await ctx.saveChangesAsync();

  console.log("User registration completed");
}
```

## Best Practices

### 1. **Leverage Change Tracking**

```typescript
// ✅ Good - let the proxy track changes automatically
const user = await ctx.users.firstOrUndefinedAsync((u) => u.id === userId);
if (user) {
  user.name = "New Name";
  user.email = "new@email.com";
  // Changes tracked automatically
}

// ❌ Avoid - manual change tracking
// user.markDirty();
// user.trackChange('name', 'New Name');
```

### 2. **Update Related Fields Together**

```typescript
// ✅ Good - update related fields together
const user = await ctx.users.firstOrUndefinedAsync((u) => u.id === userId);
if (user) {
  user.firstName = "John";
  user.lastName = "Smith";
  user.fullName = "John Smith"; // Related field
  user.nameUpdatedAt = new Date(); // Metadata
}

// ❌ Avoid - scattered updates
// user.firstName = "John";
// // ... later ...
// user.lastName = "Smith";
// // ... later ...
// user.fullName = "John Smith";
```

### 3. **Validate Before Updating**

```typescript
// ✅ Good - validate before updating
async function safeUpdate(userId: string, updateData: any) {
  const user = await ctx.users.firstOrUndefinedAsync((u) => u.id === userId);

  if (!user) {
    throw new Error("User not found");
  }

  // Validate update data
  if (updateData.email && !updateData.email.includes("@")) {
    throw new Error("Invalid email format");
  }

  if (updateData.age && (updateData.age < 0 || updateData.age > 150)) {
    throw new Error("Invalid age");
  }

  // Apply updates
  Object.assign(user, updateData);
  user.updatedAt = new Date();

  await ctx.saveChangesAsync();
}

// ❌ Avoid - updating without validation
// user.email = invalidEmail;
// user.age = -5;
```

### 4. **Use Meaningful Update Patterns**

```typescript
// ✅ Good - clear update patterns
const user = await ctx.users.firstOrUndefinedAsync((u) => u.id === userId);
if (user) {
  // Clear what's being updated
  user.profile = {
    ...user.profile,
    ...profileUpdates,
    updatedAt: new Date(),
  };

  // Clear metadata
  user.lastProfileUpdate = new Date();
  user.profileUpdateCount = (user.profileUpdateCount || 0) + 1;
}

// ❌ Avoid - unclear updates
// Object.assign(user, randomData);
// user.randomField = randomValue;
```

## Error Handling

### Update Error Handling

```typescript
async function updateUserSafely(userId: string, updateData: any) {
  try {
    const user = await ctx.users.firstOrUndefinedAsync((u) => u.id === userId);

    if (!user) {
      throw new Error("User not found");
    }

    // Apply updates
    Object.assign(user, updateData);
    user.updatedAt = new Date();

    // Save changes
    await ctx.saveChangesAsync();

    console.log("User updated successfully");
    return user;
  } catch (error) {
    console.error("Failed to update user:", error);

    // Check what changes were made before the error
    const changes = await ctx.previewChangesAsync();
    console.log("Partial changes:", changes);

    throw error;
  }
}
```

## Next Steps

- [Create Operations](create.md) - Learn how to add new entities
- [Read Operations](read.md) - Learn how to query and retrieve data
- [Delete Operations](delete.md) - Learn how to remove entities
- [Bulk Operations](bulk/README.md) - Learn how to handle multiple entities efficiently
