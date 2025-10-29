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

## Implementing History Tracking with Views

History tracking in Routier is implemented using **views** that create history tables. A history table automatically records a new entry every time source data changes, preserving a complete audit trail.

### Creating a History Table

History tables use views with a unique hashing strategy to detect changes and insert new records instead of updating existing ones. Use `fastHash` with the schema's hash function to generate a unique ID based on the entire object:

```ts
import { DataStore } from "@routier/datastore";
import { s } from "@routier/core/schema";
import { fastHash, HashType } from "@routier/core";

const productsSchema = s
  .define("products", {
    id: s.string().key().identity(),
    name: s.string(),
    price: s.number(),
    category: s.string(),
    inStock: s.boolean(),
    tags: s.array(s.string()),
    createdDate: s.date(),
  })
  .compile();

const productsHistorySchema = s
  .define("productsHistory", {
    id: s.string().key(),
    productId: s.string(),
    name: s.string(),
    price: s.number(),
    category: s.string(),
    inStock: s.boolean(),
    tags: s.array(s.string()),
    createdDate: s.date(),
    documentType: s.string(),
  })
  .compile();

export class AppDataStore extends DataStore {
  products = this.collection(productsSchema).create();

  productsHistory = this.view(productsHistorySchema)
    .derive((done) => {
      return this.products.subscribe().toArray((response) => {
        if (response.ok === "error") {
          return done([]);
        }

        done(
          response.data.map((x) => ({
            // Hash the object so we can compare if anything has changed
            // This ensures a new record is inserted when anything changes
            id: fastHash(productsSchema.hash(x, HashType.Object)),
            productId: x._id,
            category: x.category,
            inStock: x.inStock,
            name: x.name,
            price: x.price,
            tags: x.tags,
            createdDate: x.createdDate,
            documentType: productsHistorySchema.collectionName,
          }))
        );
      });
    })
    .create();
}
```

### How It Works

1. **Hash the entire object**: `productsSchema.hash(x, HashType.Object)` generates a deterministic hash of all object properties. This hash uniquely represents the current state of the entity.

2. **Fast hash for ID**: `fastHash()` converts the string hash to a numeric ID that serves as the primary key for the history record.

3. **Change detection**: When any property changes, the hash changes, producing a completely new ID. This ensures Routier treats it as a new record rather than an update.

4. **History preservation**: Old records remain in the history table untouched, and new records are inserted whenever data changes. This creates an immutable audit trail.

### Querying History

Once you have a history table, you can query it to see all historical states of your entities:

```ts
// Get all history for a specific product
const productHistory = await ctx.productsHistory
  .where((p) => p.productId === "product-123")
  .orderBy((p) => p.createdDate)
  .toArrayAsync();

// Get the latest version of each product
const latestHistory = await ctx.productsHistory
  .groupBy((p) => p.productId)
  .select((g) => g.items.max((h) => h.createdDate))
  .toArrayAsync();
```

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

- **[Views](/how-to/collections/views.md)** - Understanding how views work for history tracking
- **[Change Tracking](/concepts/change-tracking/)** - How Routier tracks changes
- **[State Management](state-management.md)** - Managing application state
- **[Data Manipulation](data-manipulation.md)** - Working with your data
