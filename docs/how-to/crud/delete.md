---
title: Delete Operations
---

# Delete Operations

Delete operations in Routier allow you to remove entities from your collections. The framework provides both individual and batch deletion methods, with support for query-based removal and proper cleanup.

## Quick Navigation

- [Overview](#overview)
- [Basic Delete Operations](#basic-delete-operations)
- [Query-Based Deletion](#query-based-deletion)
- [Batch Deletion Patterns](#batch-deletion-patterns)
- [Advanced Deletion Patterns](#advanced-deletion-patterns)
- [Change Management for Deletions](#change-management-for-deletions)
- [Performance Considerations](#performance-considerations)
- [Error Handling](#error-handling)
- [Best Practices](#best-practices)
- [Common Deletion Patterns](#common-deletion-patterns)
- [Deletion Strategies](#deletion-strategies)
- [Next Steps](#next-steps)

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

Remove individual entities by reference:

<<< @/_snippets/code/from-docs/how-to/crud/delete/removing-single-entities.ts

### Removing Multiple Entities

Remove multiple entities in a single operation:

<<< @/_snippets/code/from-docs/how-to/crud/delete/removing-multiple-entities.ts

### Removing with Callbacks

Use callback-based deletion for advanced error handling:

<<< @/_snippets/code/from-docs/how-to/crud/delete/removing-with-callbacks.ts

## Query-Based Deletion

### Remove by Query

Remove entities matching specific criteria:

<<< @/_snippets/code/from-docs/how-to/crud/delete/remove-by-query.ts

### Remove with Complex Criteria

Apply complex filtering conditions for deletion:

<<< @/_snippets/code/from-docs/how-to/crud/delete/remove-with-complex-criteria.ts

### Remove with Parameters

Use parameterized queries for dynamic deletion:

<<< @/_snippets/code/from-docs/how-to/crud/delete/remove-with-parameters.ts

## Batch Deletion Patterns

### Remove by Status

Delete entities based on status or state:

<<< @/_snippets/code/from-docs/how-to/crud/delete/remove-by-status.ts

### Remove with Confirmation

Implement confirmation patterns for important deletions:

<<< @/_snippets/code/from-docs/how-to/crud/delete/remove-with-confirmation.ts

### Remove with Backup

Create backups before performing deletions:

<<< @/_snippets/code/from-docs/how-to/crud/delete/remove-with-backup.ts

## Advanced Deletion Patterns

### Cascading Deletion

Handle related data when deleting entities:

<<< @/_snippets/code/from-docs/how-to/crud/delete/cascading-deletion.ts

### Soft Deletion

Implement soft deletion patterns:

<<< @/_snippets/code/from-docs/how-to/crud/delete/soft-deletion.ts

### Conditional Deletion

Apply conditional logic to deletion operations:

<<< @/_snippets/code/from-docs/how-to/crud/delete/conditional-deletion.ts

## Change Management for Deletions

### Checking Deletion Changes

Monitor deletion changes before saving:

<<< @/_snippets/code/from-docs/how-to/crud/delete/checking-deletion-changes.ts

### Saving Deletion Changes

Persist deletion changes to the database:

<<< @/_snippets/code/from-docs/how-to/crud/delete/saving-deletion-changes.ts

### Rolling Back Deletions

Implement rollback mechanisms for deletions:

<<< @/_snippets/code/from-docs/how-to/crud/delete/rolling-back-deletions.ts

## Performance Considerations

### Batch Deletion

Optimize performance with batch deletion operations:

<<< @/_snippets/code/from-docs/how-to/crud/delete/batch-deletion.ts

### Large Dataset Deletion

Handle large dataset deletions efficiently:

<<< @/_snippets/code/from-docs/how-to/crud/delete/large-dataset-deletion.ts

## Error Handling

### Safe Deletion

Implement safe deletion patterns with error handling:

<<< @/_snippets/code/from-docs/how-to/crud/delete/safe-deletion.ts

### Deletion with Recovery

Implement recovery mechanisms for failed deletions:

<<< @/_snippets/code/from-docs/how-to/crud/delete/deletion-with-recovery.ts

## Best Practices

### 1. **Confirm Deletions for Important Data**

Always confirm important deletions:

<<< @/_snippets/code/from-docs/how-to/crud/delete/confirm-deletions.ts

### 2. **Use Appropriate Deletion Methods**

Choose the right deletion method for your use case:

<<< @/_snippets/code/from-docs/how-to/crud/delete/appropriate-deletion-methods.ts

### 3. **Handle Related Data Appropriately**

Consider related data when deleting entities:

<<< @/_snippets/code/from-docs/how-to/crud/delete/handle-related-data.ts

### 4. **Log Deletion Operations**

Implement logging for deletion operations:

<<< @/_snippets/code/from-docs/how-to/crud/delete/log-deletion-operations.ts

## Common Deletion Patterns

### User Account Deletion


<<< @/_snippets/code/from-docs/how-to/crud/delete/block-1.ts


### Cleanup Operations


<<< @/_snippets/code/from-docs/how-to/crud/delete/block-2.ts


### Batch Cleanup with Confirmation


<<< @/_snippets/code/from-docs/how-to/crud/delete/block-3.ts


## Deletion Strategies

### Hard Delete vs Soft Delete

**Hard Delete**: Permanently removes entities from the database


<<< @/_snippets/code/from-docs/how-to/crud/delete/block-4.ts


**Soft Delete**: Marks entities as deleted without removing them


<<< @/_snippets/code/from-docs/how-to/crud/delete/block-5.ts


### Cascade Delete Patterns

**Manual Cascade**: Explicitly delete related entities


<<< @/_snippets/code/from-docs/how-to/crud/delete/block-6.ts


**Database Cascade**: Let the database handle cascading (plugin-dependent)


<<< @/_snippets/code/from-docs/how-to/crud/delete/block-7.ts


## Next Steps

- [Data Manipulation](/guides/data-manipulation) - Learn about proxy-based updates and array/object manipulation
- [Create Operations](/how-to/crud/create) - Learn how to add new entities
- [Read Operations](/how-to/crud/read) - Learn how to query and retrieve data
- [Update Operations](/how-to/crud/update) - Learn how to modify existing entities
- [Bulk Operations](/how-to/crud/bulk/README) - Learn how to handle multiple entities efficiently
