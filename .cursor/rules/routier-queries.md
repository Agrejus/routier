# Routier Query Rules

## Query Entry Point

**The collection is the query entry point**, not `subscribe()`. All queries start directly from a collection instance.

```typescript
// ✅ CORRECT: Collection is the entry point
collection.where((x) => x.field === value).toArrayAsync();

// ❌ WRONG: Don't use subscribe() for one-time queries
collection.subscribe().where((x) => x.field === value).toArrayAsync();
```

## When to Use `subscribe()`

`subscribe()` is a **query operation** that enables **live updates** (reactive queries). Only use it when you need the query to automatically re-execute when data changes.

```typescript
// ✅ CORRECT: Use subscribe() for live/reactive queries
collection.subscribe()
    .where((x) => x.status === 'active')
    .toArray((result) => {
        // This callback will be called again whenever matching data changes
    });

// ✅ CORRECT: One-time query without subscribe()
collection
    .where((x) => x.status === 'active')
    .toArrayAsync(); // Returns a Promise, executes once
```

## Query Structure

### Basic Pattern
1. **Start with collection** - The collection is the entry point
2. **Chain operations** - Add filters, sorting, transformations
3. **Terminate with execution method** - Call a terminal method to execute

```typescript
// Pattern: collection -> operations -> terminal method
collection
    .where((x) => x.field === value)  // Operation
    .sort((x) => x.name)               // Operation
    .take(10)                          // Operation
    .toArrayAsync();                    // Terminal method (executes query)
```

## Query Operations (Chaining)

These methods can be chained together:

- `where(predicate)` - Filter results
- `sort(field)` - Sort ascending
- `orderByDescending(field)` - Sort descending
- `map(selector)` - Transform/select fields
- `skip(count)` - Skip first N items
- `take(count)` - Take first N items
- `subscribe()` - Enable live updates (use only when needed)

## Terminal Methods (Execution)

These methods execute the query and return results:

### Async Methods (Return Promises)
- `toArrayAsync()` - Get all results as an array
- `firstAsync()` - Get first item (throws if none)
- `firstOrUndefinedAsync()` - Get first item or undefined
- `someAsync()` - Check if any items exist
- `countAsync()` - Count total items
- `sumAsync(field)` - Sum numeric field
- `minAsync(field)` - Get minimum value
- `maxAsync(field)` - Get maximum value
- `distinctAsync()` - Get unique values
- `toGroupAsync(selector)` - Group items by key

### Callback Methods (Use callbacks)
- `toArray(callback)` - Get all results
- `first(callback)` - Get first item
- `firstOrUndefined(callback)` - Get first item or undefined

## Common Patterns

### Pattern 1: Simple One-Time Query
```typescript
// ✅ CORRECT: Direct query without subscribe()
const results = await collection
    .where((x) => x.status === 'active')
    .toArrayAsync();
```

### Pattern 2: Single Item Query
```typescript
// ✅ CORRECT: Get first matching item or undefined
const item = await collection
    .where((x) => x.id === targetId)
    .firstOrUndefinedAsync();
```

### Pattern 3: Live/Reactive Query
```typescript
// ✅ CORRECT: Use subscribe() for live updates
collection.subscribe()
    .where((x) => x.status === 'active')
    .toArray((result) => {
        if (result.ok === Result.SUCCESS) {
            // This will be called again when data changes
            updateUI(result.data);
        }
    });
```

### Pattern 4: Callback-Based Query
```typescript
// ✅ CORRECT: Using callback instead of async/await
collection
    .where((x) => x.field === value)
    .firstOrUndefined((result) => {
        if (result.ok === Result.SUCCESS && result.data) {
            // Handle result.data
        }
    });
```

## Performance Best Practices

### 1. Database Filters First
Apply `where` clauses on database-backed fields before computed fields:

```typescript
// ✅ GOOD: Database filter first
collection
    .where((x) => x.category === 'electronics')  // Database field
    .where((x) => x.isExpensive === true)         // Computed field
    .toArrayAsync();

// ❌ LESS EFFICIENT: Computed filter first (loads all records)
collection
    .where((x) => x.isExpensive === true)         // Computed - loads all
    .where((x) => x.category === 'electronics')   // Then filters
    .toArrayAsync();
```

### 2. Limit Large Result Sets
Always use `take()` for potentially large result sets:

```typescript
// ✅ CORRECT: Limit results
collection
    .where((x) => x.status === 'active')
    .take(100)
    .toArrayAsync();
```

### 3. Efficient Pagination
Use `skip()` and `take()` together:

```typescript
// ✅ CORRECT: Pagination
const pageSize = 10;
const pageNumber = 2; // 0-based
const page = await collection
    .skip(pageSize * pageNumber)
    .take(pageSize)
    .toArrayAsync();
```

## Anti-Patterns to Avoid

1. ❌ **Using `subscribe()` for one-time queries** - Only use for live updates
2. ❌ **Not terminating queries** - Always call a terminal method
3. ❌ **Computed filters before database filters** - Less efficient
4. ❌ **Unlimited queries** - Always use `take()` for large datasets
5. ❌ **Nested subscriptions** - Don't create subscriptions inside subscriptions unnecessarily

## Query Execution

- **Lazy evaluation**: Queries don't execute until you call a terminal method
- **Chaining**: You can chain multiple operations together
- **Collection-based**: All queries must start with a collection instance

## References

- [Routier Queries Documentation](https://routier.dev/concepts/queries/)
- [Filtering](https://routier.dev/concepts/queries/filtering/)
- [Terminal Methods](https://routier.dev/concepts/queries/terminal-methods/)
