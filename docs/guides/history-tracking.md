---
title: History Tracking
layout: default
parent: Guides
nav_order: 5
---

## History Tracking

Track, undo, and redo changes across entities and collections to implement audit trails and undo/redo functionality.

## Overview

History tracking in Routier allows you to:

- **Track Changes**: Monitor all modifications to entities
- **Implement Undo/Redo**: Roll back or reapply changes as needed
- **Create Audit Trails**: Keep a record of who changed what and when
- **Manage State History**: Navigate through different states of your data

## Key Features

- Complete change tracking for all entity modifications
- Automatic timestamp and source tracking
- Efficient storage of change metadata
- Support for batch operations and transactions

## Use Cases

- Undo/redo functionality in applications
- Audit logging for compliance
- Debugging and troubleshooting
- Time-travel debugging
- Collaborative editing features

## Implementing History Tracking

History tracking in Routier can be implemented in different ways. Both approaches create history tables that automatically record a new entry every time source data changes, preserving a complete audit trail.

### Using Computed Properties for Change Detection

When your history table is subscribed to a data source, you can use computed properties with the `tracked()` modifier to automatically insert a new record whenever the subscribed data changes. This approach computes the ID based on the entire entity state, ensuring any change results in a new record:


{% highlight ts linenos %}{% include code/from-docs/guides/history-tracking/block-1.ts %}{% endhighlight %}


**How this approach works:**

1. **Computed ID**: The `id` field is computed using `fastHash(JSON.stringify(entity))`, which generates a hash based on the entire entity's serialized state.

2. **Tracked modifier**: The `tracked()` modifier ensures the computed value is persisted to storage, making it available for indexing and querying.

3. **Key modifier**: The `key()` modifier marks this as the primary key. Since the ID changes when any property changes, Routier treats changed entities as new records rather than updates.

4. **Automatic change detection**: When the subscribed data source changes, the computed ID recalculates. If the hash differs from the stored value, a new record with the new ID is inserted, preserving the previous state.

This pattern is particularly useful when your history table is derived from a view that subscribes to another collection, as it automatically handles change detection at the schema level.

### Using Views with Schema Hash Functions

Another way to implement history tracking is using views with a unique hashing strategy to detect changes and insert new records instead of updating existing ones. This approach uses `fastHash` with the schema's hash function to generate a unique ID based on the entire object:


{% highlight ts linenos %}{% include code/from-docs/guides/history-tracking/block-2.ts %}{% endhighlight %}


**How this approach works:**

1. **Hash the entire object**: `productsSchema.hash(x, HashType.Object)` generates a deterministic hash of all object properties. This hash uniquely represents the current state of the entity.

2. **Fast hash for ID**: `fastHash()` converts the string hash to a numeric ID that serves as the primary key for the history record.

3. **Change detection**: When any property changes, the hash changes, producing a completely new ID. This ensures Routier treats it as a new record rather than an update.

4. **History preservation**: Old records remain in the history table untouched, and new records are inserted whenever data changes. This creates an immutable audit trail.

### Querying History

Once you have a history table, you can query it to see all historical states of your entities:


{% highlight ts linenos %}{% include code/from-docs/guides/history-tracking/block-3.ts %}{% endhighlight %}


### When to Use History Tables

- **Audit trails**: Track all changes over time for compliance and accountability
- **Version history**: Maintain snapshots of entity states for comparison
- **Change tracking**: Know exactly when and how data changed
- **Undo/Redo**: Retrieve previous states to restore entities to earlier versions
- **Debugging**: Understand how data evolved over time during troubleshooting

### Important Considerations

- **Storage growth**: History tables grow over time. Consider archiving old history or implementing retention policies.
- **Performance**: Large history tables may require indexing. Consider adding indexes on frequently queried fields like `productId` or `createdDate`.
- **Scoping**: If using a single-store backend (like PouchDB), use `.scope()` to filter history records by `documentType`.

## Related Guides

- **[Views]({{ site.baseurl }}/how-to/collections/views/)** - Understanding how views work for history tracking
- **[Change Tracking](/concepts/change-tracking/)** - How Routier tracks changes
- **[State Management](state-management.md)** - Managing application state
- **[Data Manipulation](data-manipulation.md)** - Working with your data
