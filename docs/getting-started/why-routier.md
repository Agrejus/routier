---
title: Why Routier?
description: Understand what Routier solves, how it fits your stack, and when to choose it.
---

# Why Routier?

Choose Routier when your application's data behavior should remain stable even if its storage changes.

Front-end applications often accumulate the same data layer piecemeal: TypeScript models, defaults, serialization, browser persistence, query helpers, reactive state, optimistic updates, caching, and synchronization. Each piece can work, but the application becomes responsible for keeping all of them consistent.

Routier puts those concerns behind typed schemas, collections, queries, and a small storage-plugin boundary.

## What Routier changes

Without a shared data layer, changing IndexedDB libraries, moving data into SQLite, adding a server database, or introducing offline synchronization can force changes throughout application code. With Routier, components and services use the same collection API while the configured plugin owns persistence.

```ts
// Application code is independent of the selected storage plugin.
const activeUsers = await store.users
  .where(user => user.active)
  .sort(user => user.name)
  .toArrayAsync();
```

The same query shape can target memory, browser storage, IndexedDB, SQLite, PostgreSQL, MySQL, MongoDB, PouchDB, or another `IDbPlugin`. Switching plugins preserves the Routier-facing application API; it does not automatically migrate existing data or make every backend's operational guarantees identical.

## Why choose it

### One domain contract

A Routier schema defines persisted shape, keys, defaults, indexes, computed values, mapping, and storage transforms. TypeScript types are inferred from that definition, reducing drift between a model and its persistence metadata.

Validation remains your choice: compose Standard JSON Schema with Zod, AJV, or another validator when runtime validation is required.

### Rich queries without coupling application code to a backend

Collections expose filtering, stable sorting, pagination, projection, aggregation, inner and left joins, full-text search, vector similarity, and reusable query recipes. A plugin can push supported work into its backend; Routier can finish unsupported operations in its query pipeline.

That gives application code one query vocabulary without pretending every database has identical capabilities or performance.

### Reactive data without a second synchronization layer

Add `.subscribe()` to keep a query current as stored data changes. The React adapter converts those result subscriptions into component state and handles cleanup. The query remains the source of truth rather than a separately maintained client-side copy.

### Mutations and reads use the same model

Collections track adds, updates, and removals until `saveChangesAsync()`. Routier applies schema behavior and updates subscribed reads through the same data layer. Optimistic and replication plugins can add immediate local writes, queues, retries, and reconciliation without changing every consumer.

### Capabilities compose around storage

Start with the plugin that owns the rows, then add only what the application needs:

- caching and stale-while-revalidate
- retries, concurrency control, and batching
- HTTP replication and optimistic updates
- property encryption
- file and blob storage

This is why plugins are central to Routier rather than an extension afterthought.

## How Routier fits your stack

| Routier is… | Routier is not… |
| --- | --- |
| A typed application data layer | A database server |
| A common collection and query API | A promise that every backend behaves identically |
| A reactive persistence boundary | A general-purpose UI state manager |
| A local-first and replication toolkit | A hosted synchronization service |
| Compatible with runtime validators | A replacement for Zod, AJV, or input validation |
| Able to target SQL backends | A SQL migration and administration suite |

You still choose the database, its deployment, migrations, backup strategy, authorization boundary, and durability guarantees. Routier standardizes the application-facing data workflow.

## Routier is a strong fit when

- The application must work locally or offline.
- UI queries should update when persisted data changes.
- Storage may differ between browser, desktop, test, and server runtimes.
- You want schema behavior, querying, mutation tracking, and persistence in one typed API.
- You expect to add caching, replication, encryption, or attachments over time.
- Keeping domain code independent of a particular storage SDK is valuable.

## Consider something simpler when

- The application only sends a few stateless requests to a server and keeps no meaningful local data.
- A framework's basic request cache already covers the complete data lifecycle.
- Most application value depends on database-specific SQL, procedures, or administration features that should remain explicit.
- You need only transient UI state; a UI state library is the more direct tool.
- Introducing schemas, collections, and a unit-of-work save boundary would add more structure than the application needs.

## Evaluate it in five minutes

1. [Run the Quick Start](/getting-started/quick-start) to define a schema, collection, mutation, and query.
2. [Choose a storage plugin](/integrations/plugins/built-in-plugins/) for the environment you actually deploy.
3. Review [queries](/concepts/queries/), especially [joins](/concepts/queries/joins) and [live queries](/guides/live-queries).
4. Read [plugin compositions](/guides/plugin-compositions) if the application needs caching, replication, or optimistic writes.
5. Check the [performance model](/concepts/performance) and the selected plugin's guarantees before committing.
