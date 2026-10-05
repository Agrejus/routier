---
title: History Tracking
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

History tracking in Routier can be implemented in two ways, and they promise different things:

| Approach | Records | Written |
| --- | --- | --- |
| `.audit()` on the collection | Every change, from each save's own changes | In the same save as the change |
| A view with a content-based key | Each state the view reads | After the save, when the view recomputes |

Use `.audit()` when the history must be complete: audit trails, compliance, undo. A view re-reads its source after a change, so two saves that land before it reads are recorded as one version.

### Recording Every Change with `.audit()`

Declare the history collection, then audit the collection it records. `derive` receives each save's changes for that collection and emits the history rows:


<<< @/_snippets/code/from-docs/guides/history-tracking/block-0.ts


**How this approach works:**

1. **Handed the changes**: `derive` is called once per save with every change to `products` in it. Each change carries `operation`, `id`, `entity`, `at`, and for updates `delta` and `previous`.

2. **Same save**: The emitted rows are written in the same save as the change they describe. On a backend with atomic batches they commit together, and a rejected history row fails the save.

3. **Nothing skipped**: Two saves in quick succession produce two sets of rows, because nothing has to be read back afterwards.

4. **Your shape**: The history schema and its columns are yours. Emit nothing to skip a save, or several rows to record several things.

Database-assigned IDs are not available to an audit row describing a new entity, so record an ID the application assigns, as `productId` does here.

### Snapshots with Views

A view whose key is computed from the row's content keeps every state it reads, instead of updating one row. The view recomputes after its source changes, so it records the source's state at the moment it reads. A state that only existed between two saves the view did not read in between is never recorded. Use a view when you want snapshots of what the data looked like; use `.audit()` when you need every change.

#### Using Computed Properties for Change Detection

When your history table is subscribed to a data source, you can use computed properties with the `tracked()` modifier to automatically insert a new record whenever the subscribed data changes. This approach computes the ID based on the entire entity state, ensuring any change results in a new record:


<<< @/_snippets/code/from-docs/guides/history-tracking/block-1.ts


**How this approach works:**

1. **Computed ID**: The `id` field is computed using `fastHash(JSON.stringify(entity))`, which generates a hash based on the entire entity's serialized state.

2. **Tracked modifier**: The `tracked()` modifier ensures the computed value is persisted to storage, making it available for indexing and querying.

3. **Key modifier**: The `key()` modifier marks this as the primary key. Since the ID changes when any property changes, Routier treats changed entities as new records rather than updates.

4. **Automatic change detection**: When the view reads its source and the computed ID differs from those it holds, a new record with the new ID is inserted, preserving the previous state.

This pattern is particularly useful when your history table is derived from a view that subscribes to another collection, as it automatically handles change detection at the schema level.

#### Using Views with Schema Hash Functions

Another way to implement history tracking is using views with a unique hashing strategy to detect changes and insert new records instead of updating existing ones. This approach uses `fastHash` with the schema's hash function to generate a unique ID based on the entire object:


<<< @/_snippets/code/from-docs/guides/history-tracking/block-2.ts


**How this approach works:**

1. **Hash the entire object**: `productsSchema.hash(x, HashType.Object)` generates a deterministic hash of all object properties. This hash uniquely represents the current state of the entity.

2. **Fast hash for ID**: `fastHash()` converts the string hash to a numeric ID that serves as the primary key for the history record.

3. **Change detection**: When any property changes, the hash changes, producing a completely new ID. This ensures Routier treats it as a new record rather than an update.

4. **History preservation**: Old records remain in the history table untouched, and a new record is inserted for each state the view reads.

### Querying History

Once you have a history table, you can query it to see all historical states of your entities:


<<< @/_snippets/code/from-docs/guides/history-tracking/block-3.ts


### When to Use History Tables

- **Audit trails**: Track all changes over time for compliance and accountability (use `.audit()`)
- **Version history**: Maintain snapshots of entity states for comparison
- **Change tracking**: Know exactly when and how data changed
- **Undo/Redo**: Retrieve previous states to restore entities to earlier versions
- **Debugging**: Understand how data evolved over time during troubleshooting

### Important Considerations

- **Completeness**: Only `.audit()` records every change. A history view can merge saves that land before it reads.
- **Storage growth**: History tables grow over time. Consider archiving old history or implementing retention policies.
- **Performance**: Large history tables may require indexing. Consider adding indexes on frequently queried fields like `productId` or `createdDate`.
- **Scoping**: If using a single-store backend (like PouchDB), use `.scope()` to filter history records by `documentType`.

## Related Guides

- **[Configuring Collections](/how-to/collections/configuring-collections)** - The `.audit()` declaration
- **[Views](/how-to/collections/views)** - Understanding how views work for history tracking
- **[Change Tracking](/concepts/change-tracking)** - How Routier tracks changes
- **[State Management](/guides/state-management)** - Managing application state
- **[Data Manipulation](/guides/data-manipulation)** - Working with your data
