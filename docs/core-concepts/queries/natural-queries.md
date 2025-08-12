# Natural Queries

Routier provides a natural, fluent query API that makes data retrieval intuitive and powerful.

## Basic Querying

```typescript
const ctx = new AppContext();

// Get all users
const allUsers = await ctx.users.toArrayAsync();

// Get first user
const firstUser = await ctx.users.firstOrUndefinedAsync();

// Check if any users exist
const hasUsers = await ctx.users.someAsync();
```

## Filtering with Where

```typescript
// Simple filter
const activeUsers = await ctx.users
  .where((user) => user.status === "active")
  .toArrayAsync();

// Filter with parameters
const usersByName = await ctx.users
  .where((user, params) => user.name.startsWith(params.prefix), {
    prefix: "John",
  })
  .toArrayAsync();

// Multiple conditions
const filteredUsers = await ctx.users
  .where((user) => user.age >= 18 && user.status === "active")
  .toArrayAsync();
```

## Sorting

```typescript
// Single sort
const sortedUsers = await ctx.users.sort((user) => user.name).toArrayAsync();

// Multiple sorts
const multiSorted = await ctx.users
  .sort((user) => user.age)
  .sort((user) => user.name)
  .toArrayAsync();

// Reverse sort
const reverseSorted = await ctx.users
  .sort((user) => user.createdAt, "desc")
  .toArrayAsync();
```

## Mapping and Transformation

```typescript
// Transform data
const userNames = await ctx.users.map((user) => user.name).toArrayAsync();

// Complex transformation
const userSummaries = await ctx.users
  .map((user) => ({
    id: user._id,
    displayName: `${user.firstName} ${user.lastName}`,
    age: user.age,
    isAdult: user.age >= 18,
  }))
  .toArrayAsync();
```

## Aggregation

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

## Pagination

```typescript
// Skip and take
const page1 = await ctx.users.skip(0).take(10).toArrayAsync();

const page2 = await ctx.users.skip(10).take(10).toArrayAsync();
```

## Chaining Queries

```typescript
// Complex query chain
const result = await ctx.users
  .where((user) => user.status === "active")
  .sort((user) => user.createdAt)
  .skip(0)
  .take(20)
  .map((user) => ({
    id: user._id,
    name: user.name,
    daysSinceCreated: Math.floor(
      (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    ),
  }))
  .toArrayAsync();
```

## Next Steps

- [Expressions](expressions/README.md) - Advanced filtering expressions
- [Query Options](query-options/README.md) - Available query options
- [Performance Optimization](../data-pipeline/performance-optimization.md) - Optimizing query performance
