---
title: Views
layout: default
parent: Collections
grand_parent: Data Operations
nav_order: 3
---

## Views

Views are read-only collections that are automatically computed and saved from other collections. They update automatically when their source data changes.

## Quick Navigation

- [What Are Views?](#what-are-views)
- [Views vs Collections](#views-vs-collections)
- [Creating a View](#creating-a-view)
- [One-to-One Views](#one-to-one-views)
- [History Tables](#history-tables)
- [View Patterns](#view-patterns)
- [Manual Computation](#manual-computation)
- [View Lifecycle](#view-lifecycle)
- [Related Topics](#related-topics)

## What Are Views?

Views are **derived collections** that:

- **Read-only**: You can query views, but cannot add, update, or delete directly
- **Auto-updating**: Views automatically recompute and save when source collections change
- **Reactive**: Views use live queries to subscribe to source data changes
- **Computed**: Views transform data from one or more source collections into a new structure

Views are ideal for:

- **Materialized data**: Pre-computed aggregations or transformations
- **Denormalized data**: Flattened structures for faster queries
- **History tracking**: Recording snapshots when data changes
- **Cross-collection views**: Combining data from multiple sources

## Views vs Collections

| Feature             | Collections                             | Views                              |
| ------------------- | --------------------------------------- | ---------------------------------- |
| **Mutability**      | Read-write (add, update, delete)        | Read-only (query only)             |
| **Data Source**     | Direct storage                          | Derived from collections           |
| **Updates**         | Manual (`addAsync`, `saveChangesAsync`) | Automatic (when source changes)    |
| **Identity Keys**   | Can use identity keys                   | Must use computed/predictable keys |
| **Change Tracking** | Mutable                                 | Immutable                          |

**Collections** are your primary data storage where you actively create, update, and delete entities. **Views** are computed representations that automatically stay in sync with their source collections.

## Creating a View

Views are created using `.view()` followed by `.derive()` to specify how data is computed:

```ts
import { DataStore } from "@routier/datastore";
import { productsSchema } from "./schemas/product";
import { productsViewSchema } from "./schemas/productsView";

export class AppDataStore extends DataStore {
  products = this.collection(productsSchema).create();

  productsView = this.view(productsViewSchema)
    .scope(([x, p]) => x.documentType === p.collectionName, productsViewSchema)
    .derive((done) => {
      return this.products.subscribe().toArray((productsResponse) => {
        if (productsResponse.ok === "error") {
          return done([]);
        }

        done(
          productsResponse.data.map((x) => ({
            id: `view:${x._id}`, // Predictable ID for updates
            category: x.category,
            inStock: x.inStock,
            name: x.name,
            price: x.price,
            tags: x.tags,
            createdDate: x.createdDate,
            documentType: productsViewSchema.collectionName,
          }))
        );
      });
    })
    .create();
}
```

## One-to-One Views

One-to-one views maintain a predictable mapping between source entities and view entities. Use a predictable ID pattern like `view:${originalId}`:

```ts
productsView = this.view(productsViewSchema)
  .derive((done) => {
    return this.products.subscribe().toArray((response) => {
      if (response.ok === "error") {
        return done([]);
      }

      done(
        response.data.map((x) => ({
          id: `view:${x._id}`, // Predictable ID - view updates existing records
          name: x.name,
          price: x.price,
          // ... other fields
        }))
      );
    });
  })
  .create();
```

**Key points:**

- **Predictable IDs**: Use patterns like `view:${x._id}` so Routier can find and update existing records
- **Updates vs Inserts**: When a view record with a matching ID exists, Routier updates it. Without a predictable ID, every computation would insert new records.
- **1:1 relationship**: Each source entity maps to exactly one view entity

## History Tables

History tables are views that create a new record every time source data changes, preserving an immutable audit trail. They use `fastHash` with the schema's hash function to generate unique IDs based on the entire object state, ensuring each change creates a new record rather than updating an existing one.

This pattern is ideal for:

- **Audit trails**: Track all changes over time
- **Version history**: Maintain snapshots of entity states
- **Change tracking**: Know when and how data changed
- **Undo/Redo**: Retrieve previous states

For complete implementation details, examples, and best practices, see the **[History Tracking guide]({{ site.baseurl }}/guides/history-tracking)**.

## View Patterns

### Transforming Data

Views can reshape data from source collections:

```ts
commentsView = this.view(commentsViewSchema)
  .derive((done) => {
    return this.comments.subscribe().toArray((response) => {
      if (response.ok === "error") {
        return done([]);
      }

      done(
        response.data.map((x) => ({
          id: `view:${x._id}`,
          content: x.content,
          user: {
            name: x.author, // Flattened structure
          },
          createdAt: new Date(),
          replies: x.replies,
        }))
      );
    });
  })
  .create();
```

### Combining Multiple Sources

You can subscribe to multiple collections and combine their data:

```ts
combinedView = this.view(combinedViewSchema)
  .derive((done) => {
    let usersData: User[] = [];
    let postsData: Post[] = [];
    let subscriptionCount = 0;

    const checkAndCombine = () => {
      subscriptionCount++;
      if (subscriptionCount === 2) {
        // Combine users and posts
        done(combineUsersAndPosts(usersData, postsData));
      }
    };

    this.users.subscribe().toArray((response) => {
      if (response.ok === "success") {
        usersData = response.data;
      }
      checkAndCombine();
    });

    this.posts.subscribe().toArray((response) => {
      if (response.ok === "success") {
        postsData = response.data;
      }
      checkAndCombine();
    });
  })
  .create();
```

### Scoped Views

Use `.scope()` to filter view data, especially useful for single-store backends:

```ts
productsView = this.view(productsViewSchema)
  .scope(([x, p]) => x.documentType === p.collectionName, productsViewSchema)
  .derive((done) => {
    // View logic here
  })
  .create();
```

## View Lifecycle

1. **Creation**: View is created and derive function is called immediately
2. **Subscription**: View subscribes to source collections via live queries
3. **Change Detection**: When source data changes, derive function is invoked
4. **Computation**: Derive function transforms source data into view data
5. **Auto-Save**: View automatically persists computed data (no `saveChangesAsync` needed)
6. **Update/Insert**: Routier compares IDs and either updates existing records or inserts new ones

## Manual Computation

Views automatically compute when source data changes, but you can also manually trigger computation using `compute()` or `computeAsync()`:

```ts
// Trigger view computation manually (callback-based)
ctx.productsView.compute((result) => {
  if (result.ok === "success") {
    console.log("View computed successfully");
  }
});

// Trigger view computation manually (async)
await ctx.productsView.computeAsync();
```

**When to use:**

- **Force refresh**: Manually recompute the view after external changes
- **Initial sync**: Compute the view if it's out of sync or was retroactively added to an existing application
- **Debugging**: Test view logic independently of source data changes

The `compute` methods run the derive function you provided when creating the view, which will trigger subscriptions and update the view data.

## Important Notes

- **No Identity Keys**: Views cannot use identity keys. All IDs must be computed/predictable
- **Automatic Persistence**: Views save automatically—you don't call `saveChangesAsync()`
- **Manual Computation**: Use `compute()` or `computeAsync()` to manually trigger view computation
- **Unsubscribe on Dispose**: Views automatically clean up subscriptions when disposed
- **Error Handling**: Always check `response.ok === "error"` and return an empty array or handle the error

## Related Topics

- **[Collections Overview](index.md)** - Understanding collections
- **[Scope Single Store](scope-single-store.md)** - Scoping views for single-store backends
- **[Live Queries]({{ site.baseurl }}/guides/live-queries)** - Understanding reactive queries
- **[History Tracking]({{ site.baseurl }}/guides/history-tracking)** - Implementing audit trails and version history
- **[State Management]({{ site.baseurl }}/guides/state-management)** - Managing application state
