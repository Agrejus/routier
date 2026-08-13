---
title: Bulk Operations
---

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

<<< @/_snippets/code/from-docs/how-to/crud/bulk/README/block-1.ts

### Bulk Add with Array

<<< @/_snippets/code/from-docs/how-to/crud/bulk/README/block-2.ts

### Bulk Add with Data Generation

<<< @/_snippets/code/from-docs/how-to/crud/bulk/README/block-3.ts

## Bulk Update Operations

### Batch Property Updates

<<< @/_snippets/code/from-docs/how-to/crud/bulk/README/block-4.ts

### Conditional Bulk Updates

<<< @/_snippets/code/from-docs/how-to/crud/bulk/README/block-5.ts

### Bulk Updates with Transformations

<<< @/_snippets/code/from-docs/how-to/crud/bulk/README/block-6.ts

## Bulk Delete Operations

### Remove Multiple Entities

<<< @/_snippets/code/from-docs/how-to/crud/bulk/README/block-7.ts

### Remove by Query

<<< @/_snippets/code/from-docs/how-to/crud/bulk/README/block-8.ts

### Bulk Remove with Confirmation

<<< @/_snippets/code/from-docs/how-to/crud/bulk/README/block-9.ts

## Bulk Operations with Change Tracking

### Efficient Change Management

<<< @/_snippets/code/from-docs/how-to/crud/bulk/README/block-10.ts

### Previewing Bulk Changes

<<< @/_snippets/code/from-docs/how-to/crud/bulk/README/block-11.ts

## Performance Considerations

### Batch Size Optimization

<<< @/_snippets/code/from-docs/how-to/crud/bulk/README/block-12.ts

### Memory Management

<<< @/_snippets/code/from-docs/how-to/crud/bulk/README/block-13.ts

## Error Handling in Bulk Operations

### Graceful Failure Handling

<<< @/_snippets/code/from-docs/how-to/crud/bulk/README/block-14.ts

### Partial Success Handling

<<< @/_snippets/code/from-docs/how-to/crud/bulk/README/block-15.ts

## Best Practices

### 1. **Use Appropriate Batch Sizes**

<<< @/_snippets/code/from-docs/how-to/crud/bulk/README/block-16.ts

### 2. **Save Changes Strategically**

<<< @/_snippets/code/from-docs/how-to/crud/bulk/README/block-17.ts

### 3. **Handle Errors Gracefully**

<<< @/_snippets/code/from-docs/how-to/crud/bulk/README/block-18.ts

### 4. **Monitor Performance**

<<< @/_snippets/code/from-docs/how-to/crud/bulk/README/block-19.ts

## Next Steps

- [CRUD Operations](/how-to/crud/README) - Back to basic CRUD operations
- [Data Collections](/concepts/data-collections/memory-collections) - Understanding collections and change tracking

- [State Management](/guides/state-management) - Managing application state with Routier
