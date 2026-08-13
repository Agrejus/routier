---
title: Update Operations
---

# Update Operations

Update operations in Routier leverage the framework's powerful change tracking system. Entities returned from queries are **proxy objects** that automatically track changes, making updates simple and efficient.

## Quick Navigation

- [Overview](#overview)
- [How Change Tracking Works](#how-change-tracking-works)
- [Basic Update Operations](#basic-update-operations)
- [Batch Update Operations](#batch-update-operations)
- [Advanced Update Patterns](#advanced-update-patterns)
- [Change Management](#change-management)
- [Update Type Safety](#update-type-safety)
- [Performance Considerations](#performance-considerations)
- [Best Practices](#best-practices)
- [Error Handling](#error-handling)
- [Common Update Patterns](#common-update-patterns)
- [Next Steps](#next-steps)

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

<<< @/_snippets/code/from-docs/how-to/crud/update/proxy-entities.ts

### Automatic Change Detection

Routier automatically detects property changes without requiring manual update calls:

<<< @/_snippets/code/from-docs/how-to/crud/update/automatic-change-detection.ts

## Basic Update Operations

### Single Property Updates

Update individual properties on entities:

<<< @/_snippets/code/from-docs/how-to/crud/update/single-property-updates.ts

### Multiple Property Updates

Update multiple properties on a single entity:

<<< @/_snippets/code/from-docs/how-to/crud/update/multiple-property-updates.ts

### Nested Object Updates

Update nested objects and their properties:

<<< @/_snippets/code/from-docs/how-to/crud/update/nested-object-updates.ts

### Array Updates

Modify arrays within entities:

<<< @/_snippets/code/from-docs/how-to/crud/update/array-updates.ts

## Batch Update Operations

### Update Multiple Entities

Update multiple entities efficiently:

<<< @/_snippets/code/from-docs/how-to/crud/update/update-multiple-entities.ts

### Conditional Batch Updates

Apply updates based on conditions:

<<< @/_snippets/code/from-docs/how-to/crud/update/conditional-batch-updates.ts

### Batch Updates with Transformations

Apply transformations to multiple entities:

<<< @/_snippets/code/from-docs/how-to/crud/update/batch-updates-with-transformations.ts

## Advanced Update Patterns

### Computed Updates

Update entities with computed or derived values:

<<< @/_snippets/code/from-docs/how-to/crud/update/computed-updates.ts

### Incremental Updates

Apply incremental changes to numeric fields:

<<< @/_snippets/code/from-docs/how-to/crud/update/incremental-updates.ts

### Conditional Field Updates

Update fields based on specific conditions:

<<< @/_snippets/code/from-docs/how-to/crud/update/conditional-field-updates.ts

## Change Management

### Checking for Changes

Monitor and check for pending changes:

<<< @/_snippets/code/from-docs/how-to/crud/update/checking-for-changes.ts

### Saving Changes

Persist tracked changes to the database:

<<< @/_snippets/code/from-docs/how-to/crud/update/saving-changes.ts

### Partial Saves

Save changes in batches or selectively:

<<< @/_snippets/code/from-docs/how-to/crud/update/partial-saves.ts

## Update Type Safety

### Schema Type Checking

Ensure type safety when updating entities:

<<< @/_snippets/code/from-docs/how-to/crud/update/schema-type-checking.ts

### Business Logic Type Checking

Implement business logic validation during updates:

<<< @/_snippets/code/from-docs/how-to/crud/update/business-logic-type-checking.ts

## Performance Considerations

### Batch Updates

Optimize performance with batch update operations:

<<< @/_snippets/code/from-docs/how-to/crud/update/batch-updates.ts

### Change Batching

Manage change batching for optimal performance:

<<< @/_snippets/code/from-docs/how-to/crud/update/change-batching.ts

## Best Practices

### 1. **Leverage Change Tracking**

Take advantage of automatic change tracking:

<<< @/_snippets/code/from-docs/how-to/crud/update/leverage-change-tracking.ts

### 2. **Update Related Fields Together**

Update related fields in a single operation:

<<< @/_snippets/code/from-docs/how-to/crud/update/update-related-fields-together.ts

### 3. **Validate Before Updating**

Implement validation before applying updates:

<<< @/_snippets/code/from-docs/how-to/crud/update/validate-before-updating.ts

### 4. **Use Meaningful Update Patterns**

Follow consistent patterns for updates:

<<< @/_snippets/code/from-docs/how-to/crud/update/meaningful-update-patterns.ts

## Error Handling

### Update Error Handling

Handle errors gracefully during update operations:

<<< @/_snippets/code/from-docs/how-to/crud/update/update-error-handling.ts

## Common Update Patterns

### User Profile Updates


<<< @/_snippets/code/from-docs/how-to/crud/update/block-1.ts


### Status Updates


<<< @/_snippets/code/from-docs/how-to/crud/update/block-2.ts


### Batch Price Updates


<<< @/_snippets/code/from-docs/how-to/crud/update/block-3.ts


## Next Steps

- [Data Manipulation](/guides/data-manipulation) - Learn about proxy-based updates and array/object manipulation
- [Create Operations](/how-to/crud/create) - Learn how to add new entities
- [Read Operations](/how-to/crud/read) - Learn how to query and retrieve data
- [Delete Operations](/how-to/crud/delete) - Learn how to remove entities
- [Bulk Operations](/how-to/crud/bulk/README) - Learn how to handle multiple entities efficiently
