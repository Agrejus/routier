# Read Operations

Read operations in Routier provide powerful querying capabilities with a fluent, chainable API. The framework supports filtering, sorting, pagination, and aggregation operations.

## Overview

Routier's read operations feature:

1. **Fluent query API** - Chain multiple operations together
2. **Type-safe queries** - Full TypeScript support
3. **Efficient filtering** - Database-level query optimization
4. **Flexible sorting** - Multiple sort criteria support
5. **Built-in aggregation** - Count, sum, min, max operations
6. **Pagination support** - Skip and take operations

## Basic Query Operations

### Getting All Entities

```typescript
const ctx = new AppContext();

// Get all users
const allUsers = await ctx.users.toArrayAsync();
console.log(`Found ${allUsers.length} users`);

// Get first user
const firstUser = await ctx.users.firstOrUndefinedAsync();
if (firstUser) {
  console.log("First user:", firstUser.name);
}

// Check if any users exist
const hasUsers = await ctx.users.someAsync();
console.log("Has users:", hasUsers);
```

### Getting Single Entities

```typescript
// Get first user matching criteria
const user = await ctx.users.firstOrUndefinedAsync(
  (u) => u.email === "john@example.com"
);
if (user) {
  console.log("Found user:", user.name);
}

**Note: Callback-based operations use a discriminated union result pattern. The callback receives a single `result` parameter that can be either `{ ok: "success", data: T }` or `{ ok: "error", error: any }`.**

// Get first user with callback API
ctx.users.first(
  (u) => u.email === "john@example.com",
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

## Filtering with Where

### Simple Filters

```typescript
// Filter by single condition
const activeUsers = await ctx.users
  .where((user) => user.status === "active")
  .toArrayAsync();

console.log(`Found ${activeUsers.length} active users`);

// Filter by multiple conditions
const adultActiveUsers = await ctx.users
  .where((user) => user.age >= 18 && user.status === "active")
  .toArrayAsync();

console.log(`Found ${adultActiveUsers.length} adult active users`);
```

### Parameterized Filters

```typescript
// Filter with parameters for dynamic queries
const usersByName = await ctx.users
  .where((user, params) => user.name.startsWith(params.prefix), {
    prefix: "John",
  })
  .toArrayAsync();

console.log(
  `Found ${usersByName.length} users with names starting with "John"`
);

// Complex parameterized filter
const usersByAgeRange = await ctx.users
  .where(
    (user, params) => user.age >= params.minAge && user.age <= params.maxAge,
    {
      minAge: 18,
      maxAge: 65,
    }
  )
  .toArrayAsync();

console.log(
  `Found ${usersByAgeRange.length} users between 18 and 65 years old`
);
```

### Advanced Filters

```typescript
// Filter with string operations
const usersWithLongNames = await ctx.users
  .where((user) => user.name.length > 10)
  .toArrayAsync();

// Filter with date operations
const recentUsers = await ctx.users
  .where(
    (user) => user.createdAt > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  )
  .toArrayAsync();

// Filter with array operations
const usersWithTags = await ctx.users
  .where((user) => user.tags && user.tags.includes("premium"))
  .toArrayAsync();

// Filter with nested object properties
const usersInCity = await ctx.users
  .where((user) => user.address?.city === "New York")
  .toArrayAsync();
```

## Sorting

### Basic Sorting

```typescript
// Sort by single field
const sortedUsers = await ctx.users.sort((user) => user.name).toArrayAsync();

// Sort by multiple fields (order matters)
const multiSortedUsers = await ctx.users
  .sort((user) => user.age) // Primary sort: age
  .sort((user) => user.name) // Secondary sort: name
  .toArrayAsync();

// Sort in descending order
const reverseSortedUsers = await ctx.users
  .sort((user) => user.createdAt, "desc")
  .toArrayAsync();
```

### Complex Sorting

```typescript
// Sort by computed values
const usersByFullName = await ctx.users
  .sort((user) => `${user.firstName} ${user.lastName}`)
  .toArrayAsync();

// Sort by nested properties
const usersByCity = await ctx.users
  .sort((user) => user.address?.city || "")
  .toArrayAsync();

// Sort with custom comparison
const usersByStatus = await ctx.users
  .sort((user) => {
    const statusOrder = { active: 1, pending: 2, inactive: 3 };
    return statusOrder[user.status] || 4;
  })
  .toArrayAsync();
```

## Pagination

### Skip and Take

```typescript
// Get first 10 users
const firstPage = await ctx.users.take(10).toArrayAsync();

// Get users 11-20
const secondPage = await ctx.users.skip(10).take(10).toArrayAsync();

// Get users 21-30
const thirdPage = await ctx.users.skip(20).take(10).toArrayAsync();
```

### Complete Pagination Example

```typescript
async function getUsersPage(page: number, pageSize: number = 10) {
  const skip = (page - 1) * pageSize;

  const users = await ctx.users
    .sort((user) => user.name)
    .skip(skip)
    .take(pageSize)
    .toArrayAsync();

  // Get total count for pagination info
  const totalUsers = await ctx.users.countAsync();
  const totalPages = Math.ceil(totalUsers / pageSize);

  return {
    users,
    pagination: {
      currentPage: page,
      pageSize,
      totalUsers,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
}

// Usage
const page1 = await getUsersPage(1, 10);
console.log(`Page 1: ${page1.users.length} users`);
console.log(`Total pages: ${page1.pagination.totalPages}`);
```

## Aggregation Operations

### Counting

```typescript
// Count all users
const totalUsers = await ctx.users.countAsync();
console.log(`Total users: ${totalUsers}`);

// Count filtered users
const activeUserCount = await ctx.users
  .where((user) => user.status === "active")
  .countAsync();

console.log(`Active users: ${activeUserCount}`);
```

### Sum Operations

```typescript
// Sum numeric values
const totalAge = await ctx.users.sumAsync((user) => user.age);
console.log(`Total age: ${totalAge}`);

// Sum with filtering
const activeUsersTotalAge = await ctx.users
  .where((user) => user.status === "active")
  .sumAsync((user) => user.age);

console.log(`Active users total age: ${activeUsersTotalAge}`);
```

### Min and Max Operations

```typescript
// Find minimum value
const youngestAge = await ctx.users.minAsync((user) => user.age);
console.log(`Youngest user age: ${youngestAge}`);

// Find maximum value
const oldestAge = await ctx.users.maxAsync((user) => user.age);
console.log(`Oldest user age: ${oldestAge}`);

// Min/Max with filtering
const activeUsersYoungestAge = await ctx.users
  .where((user) => user.status === "active")
  .minAsync((user) => user.age);

console.log(`Youngest active user age: ${activeUsersYoungestAge}`);
```

### Distinct Values

```typescript
// Get unique values
const uniqueAges = await ctx.users.distinctAsync((user) => user.age);
console.log("Unique ages:", uniqueAges);

// Get unique cities
const uniqueCities = await ctx.users.distinctAsync(
  (user) => user.address?.city
);
console.log("Unique cities:", uniqueCities);
```

## Data Transformation

### Mapping Data

```typescript
// Transform to simple values
const userNames = await ctx.users.map((user) => user.name).toArrayAsync();
console.log("User names:", userNames);

// Transform to objects
const userSummaries = await ctx.users
  .map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    isAdult: user.age >= 18,
  }))
  .toArrayAsync();

console.log("User summaries:", userSummaries);

// Transform with computed values
const userStats = await ctx.users
  .map((user) => ({
    name: user.name,
    age: user.age,
    ageGroup: user.age < 18 ? "minor" : user.age < 65 ? "adult" : "senior",
    nameLength: user.name.length,
  }))
  .toArrayAsync();
```

### Complex Transformations

```typescript
// Transform with conditional logic
const userDisplayInfo = await ctx.users
  .map((user) => {
    const displayName = user.nickname || user.name;
    const status = user.isVerified ? "verified" : "unverified";
    const lastSeen = user.lastLogin
      ? `Last seen: ${user.lastLogin.toLocaleDateString()}`
      : "Never logged in";

    return {
      displayName,
      status,
      lastSeen,
      profileComplete: !!(user.avatar && user.bio),
    };
  })
  .toArrayAsync();
```

## Query Chaining

### Complex Query Examples

```typescript
// Complex query with multiple operations
const premiumActiveUsers = await ctx.users
  .where((user) => user.status === "active")
  .where((user) => user.subscription === "premium")
  .sort((user) => user.lastLogin)
  .take(20)
  .map((user) => ({
    name: user.name,
    email: user.email,
    daysSinceLastLogin: Math.floor(
      (Date.now() - user.lastLogin.getTime()) / (1000 * 60 * 60 * 24)
    ),
  }))
  .toArrayAsync();

console.log("Premium active users:", premiumActiveUsers);
```

### Query with Aggregation

```typescript
// Get statistics for different user groups
const userStats = await ctx.users
  .where((user) => user.status === "active")
  .map((user) => ({
    ageGroup: user.age < 18 ? "minor" : user.age < 65 ? "adult" : "senior",
    hasProfile: !!(user.avatar && user.bio),
    isVerified: user.isVerified,
  }))
  .toArrayAsync();

// Process the results
const stats = {
  total: userStats.length,
  byAgeGroup: {
    minor: userStats.filter((u) => u.ageGroup === "minor").length,
    adult: userStats.filter((u) => u.ageGroup === "adult").length,
    senior: userStats.filter((u) => u.ageGroup === "senior").length,
  },
  withProfile: userStats.filter((u) => u.hasProfile).length,
  verified: userStats.filter((u) => u.isVerified).length,
};

console.log("User statistics:", stats);
```

## Performance Considerations

### Query Optimization

```typescript
// ✅ Good - use appropriate filters early
const activeUsers = await ctx.users
  .where((user) => user.status === "active") // Filter first
  .sort((user) => user.name) // Then sort
  .take(10) // Then limit
  .toArrayAsync();

// ❌ Avoid - sorting before filtering
const inefficientQuery = await ctx.users
  .sort((user) => user.name) // Sorting all users
  .where((user) => user.status === "active") // Then filtering
  .take(10) // Then limiting
  .toArrayAsync();
```

### Memory Management

```typescript
// For large datasets, use pagination
async function processAllUsers(batchSize = 100) {
  let processed = 0;
  let hasMore = true;

  while (hasMore) {
    const batch = await ctx.users
      .skip(processed)
      .take(batchSize)
      .toArrayAsync();

    if (batch.length === 0) {
      hasMore = false;
      break;
    }

    // Process batch
    for (const user of batch) {
      // Process user
      console.log(`Processing user: ${user.name}`);
    }

    processed += batch.length;
    console.log(`Processed ${processed} users`);
  }
}

// Usage
await processAllUsers(100);
```

## Best Practices

### 1. **Use Appropriate Query Methods**

```typescript
// ✅ Good - use specific methods for single results
const user = await ctx.users.firstOrUndefinedAsync(
  (u) => u.email === "john@example.com"
);

// ❌ Avoid - getting array when you need one item
const users = await ctx.users
  .where((u) => u.email === "john@example.com")
  .take(1)
  .toArrayAsync();
const user = users[0];
```

### 2. **Chain Operations Efficiently**

```typescript
// ✅ Good - logical order: filter → sort → paginate → transform
const result = await ctx.users
  .where((user) => user.status === "active") // Filter first
  .sort((user) => user.name) // Then sort
  .skip(10) // Then paginate
  .take(5) // Then limit
  .map((user) => ({ name: user.name })) // Finally transform
  .toArrayAsync();

// ❌ Avoid - inefficient order
const result = await ctx.users
  .sort((user) => user.name) // Sorting all users
  .map((user) => ({ name: user.name })) // Transforming all users
  .where((user) => user.status === "active") // Then filtering
  .skip(10) // Then paginating
  .take(5) // Then limiting
  .toArrayAsync();
```

### 3. **Handle Empty Results Gracefully**

```typescript
// ✅ Good - handle empty results
const users = await ctx.users
  .where((user) => user.status === "inactive")
  .toArrayAsync();

if (users.length === 0) {
  console.log("No inactive users found");
  return;
}

console.log(`Found ${users.length} inactive users`);
```

### 4. **Use Type-Safe Queries**

```typescript
// ✅ Good - leverage TypeScript for type safety
interface UserQuery {
  status: "active" | "inactive";
  minAge: number;
  maxAge: number;
}

async function queryUsers(params: UserQuery) {
  return await ctx.users
    .where((user) => user.status === params.status)
    .where((user) => user.age >= params.minAge && user.age <= params.maxAge)
    .toArrayAsync();
}

// TypeScript will catch errors at compile time
const users = await queryUsers({
  status: "active",
  minAge: 18,
  maxAge: 65,
});
```

## Next Steps

- [Create Operations](create.md) - Learn how to add new entities
- [Update Operations](update.md) - Learn how to modify existing entities
- [Delete Operations](delete.md) - Learn how to remove entities
- [Bulk Operations](bulk/README.md) - Learn how to handle multiple entities efficiently
