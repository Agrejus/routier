# Routier Async Patterns

## When to Use Async vs Callbacks

### Use Async Versions When:
1. **Internal helper methods** - Private/protected methods that don't need to be overridden
2. **New code** - When writing new functionality, prefer async/await for readability
3. **Complex nested operations** - Async/await reduces callback hell and improves readability
4. **Error handling** - Try/catch is cleaner than checking `result.ok === Result.ERROR`

### Keep Callback Versions When:
1. **Abstract methods** - Methods that subclasses must implement (for flexibility)
2. **Public API methods** - Methods that are part of the public interface and may be called with callbacks
3. **Performance-critical paths** - If you need the absolute minimum overhead (though async overhead is negligible)

## Performance Considerations

**Async versions have NO performance penalty** - They are thin wrappers around callback versions using `toPromise()`:

```typescript
// Async version (what you write)
const result = await collection.toArrayAsync();

// What it actually does (under the hood)
const result = await toPromise<InferType<T>[]>(done => 
    collection.toArray(done)
);
```

The `toPromise` utility simply wraps the callback in a Promise, so there's no additional overhead.

## Converting Callback Code to Async

### Pattern 1: Simple Query
```typescript
// ❌ Callback version (nested)
collection.toArray((result) => {
    if (result.ok === Result.ERROR) {
        handleError(result.error);
        return;
    }
    processData(result.data);
});

// ✅ Async version (linear)
try {
    const data = await collection.toArrayAsync();
    processData(data);
} catch (error) {
    handleError(error);
}
```

### Pattern 2: Chained Operations
```typescript
// ❌ Callback version (callback hell)
getMetadata((metadataResult) => {
    if (metadataResult.ok === Result.ERROR) {
        return done(metadataResult);
    }
    fetchData(metadataResult.data, (fetchResult) => {
        if (fetchResult.ok === Result.ERROR) {
            return done(fetchResult);
        }
        processData(fetchResult.data, (processResult) => {
            done(processResult);
        });
    });
});

// ✅ Async version (linear)
try {
    const metadata = await getMetadataAsync();
    const data = await fetchDataAsync(metadata);
    await processDataAsync(data);
    done(Result.success());
} catch (error) {
    done(Result.error(error));
}
```

### Pattern 3: Wrapping Callback Methods
```typescript
// Create async wrapper for callback-based method
protected async getSyncMetadataAsync(schemaId: SchemaId): Promise<SyncMetadata | null> {
    return await this.metadataCollection
        .where((x) => x.schemaId === schemaId)
        .firstOrUndefinedAsync() as SyncMetadata | null;
}

// Keep callback version for backward compatibility
protected getSyncMetadata(schemaId: SchemaId, done: CallbackResult<SyncMetadata | null>): void {
    this.getSyncMetadataAsync(schemaId)
        .then(metadata => done(Result.success(metadata)))
        .catch(error => done(Result.error(error)));
}
```

## Available Async Methods

### Collection Query Methods
- `toArrayAsync()` - Returns `Promise<InferType<T>[]>`
- `firstAsync()` - Returns `Promise<InferType<T>>` (throws if none)
- `firstOrUndefinedAsync()` - Returns `Promise<InferType<T> | undefined>`
- `someAsync()` - Returns `Promise<boolean>`
- `countAsync()` - Returns `Promise<number>`
- `sumAsync(selector)` - Returns `Promise<number>`
- `minAsync(selector)` - Returns `Promise<number>`
- `maxAsync(selector)` - Returns `Promise<number>`
- `distinctAsync()` - Returns `Promise<T[]>`
- `toGroupAsync(selector)` - Returns `Promise<Record<key, T[]>>`

### Collection Mutation Methods
- `addAsync(...entities)` - Returns `Promise<InferType<T>[]>`
- `removeAsync(...entities)` - Returns `Promise<InferType<T>[]>`

### DataStore Methods
- `saveChangesAsync()` - Returns `Promise<BulkPersistResult>`

## Using `toPromise` Utility

For callback-based methods that don't have async versions, use `toPromise`:

```typescript
import { toPromise } from "@routier/core/results";

// Convert callback to Promise
const result = await toPromise<ReturnType>(done => 
    callbackMethod(params, done)
);

// toPromise automatically:
// - Resolves with result.data if result.ok === Result.SUCCESS
// - Rejects with result.error if result.ok === Result.ERROR
```

## Error Handling

### With Async/Await
```typescript
try {
    const data = await collection.toArrayAsync();
    // Process data
} catch (error) {
    // Handle error - automatically catches rejections
    logger.error("Query failed", error);
}
```

### With Callbacks
```typescript
collection.toArray((result) => {
    if (result.ok === Result.ERROR) {
        // Handle error - must check manually
        logger.error("Query failed", result.error);
        return;
    }
    // Process result.data
});
```

## Best Practices

1. **Prefer async for new code** - More readable and maintainable
2. **Keep callbacks for abstract methods** - Allows subclasses flexibility
3. **Use async wrappers** - Create async versions that wrap callback methods
4. **Consistent error handling** - Use try/catch with async, check `result.ok` with callbacks
5. **No performance concerns** - Async is just syntactic sugar over callbacks

## Example: Refactored Sync Workflow

```typescript
// ✅ Async version (cleaner)
protected async getSyncMetadataAsync(schemaId: SchemaId): Promise<SyncMetadata | null> {
    return await this.metadataCollection
        .where((x) => x.schemaId === schemaId)
        .firstOrUndefinedAsync() as SyncMetadata | null;
}

// ✅ Async version for complex operations
private async calculateChangesAsync<T>(schema: CompiledSchema<T>, remoteData: T[]) {
    const localData = await collection.toArrayAsync() as T[];
    // ... process data linearly
    return { adds, updates, removals };
}

// ✅ Keep callback wrapper for backward compatibility
protected getSyncMetadata(schemaId: SchemaId, done: CallbackResult<SyncMetadata | null>): void {
    this.getSyncMetadataAsync(schemaId)
        .then(metadata => done(Result.success(metadata)))
        .catch(error => done(Result.error(error)));
}
```

## Summary

- **Async versions are wrappers** - No performance difference
- **Use async for readability** - Especially in complex nested operations
- **Keep callbacks for abstract methods** - Maintain flexibility for subclasses
- **Use `toPromise`** - Convert callback methods to Promises when needed
- **Error handling is cleaner** - Try/catch vs manual `result.ok` checks
