---
title: CRUD
layout: default
parent: Data Operations
has_children: true
nav_order: 1
---

# CRUD Operations

Routier provides a powerful and intuitive CRUD (Create, Read, Update, Delete) API that leverages change tracking and proxy-based entities for efficient data management.

## Overview

CRUD operations in Routier work through a **DataStore** class that you inherit from. The DataStore manages collections of entities and provides change tracking through proxy objects. Here's how it works:

1. **Create a DataStore** by inheriting from the base class
2. **Define collections** using schemas
3. **Perform operations** on collections (add, remove, update)
4. **Track changes** automatically through proxy entities
5. **Save changes** when ready to persist

## ⚠️ Critical: Persistence Requires Explicit Save

**Important: Changes made to entities (including adds, updates, and deletes) are NOT automatically persisted to the database. You must explicitly call `saveChanges()` or `saveChangesAsync()` to persist any changes.**

## CRUD Operations Overview

### Create Operations

- **Add single entities** with `addAsync()`
- **Add multiple entities** in batch operations
- **Automatic schema validation** and default value application
- **Identity field generation** for key fields
- **Type-safe creation** with TypeScript support

### Read Operations

- **Fluent query API** with chainable operations
- **Powerful filtering** with `where()` clauses
- **Flexible sorting** with `orderBy()` and `orderByDescending()`
- **Pagination support** with `skip()` and `take()`
- **Aggregation operations** like `count()`, `sum()`, `min()`, `max()`
- **Data transformation** with `select()` and `map()`

### Update Operations

- **Proxy-based change tracking** - entities automatically detect modifications
- **No manual update calls** needed - just modify properties directly
- **Batch updates** for multiple entities
- **Nested object updates** with deep change detection
- **Array manipulation** with automatic change tracking

### Delete Operations

- **Individual entity removal** with `removeAsync()`
- **Batch deletion** for multiple entities
- **Query-based removal** with `removeByQueryAsync()`
- **Automatic cleanup** and proper disposal
- **Cascading deletion** patterns for related data

## Change Tracking and Persistence

### How Change Tracking Works

Routier uses **proxy objects** to automatically track changes to entities:

1. **Entities are proxied** when returned from queries
2. **Property changes are tracked** automatically
3. **Changes accumulate** in memory until you explicitly save them
4. **No manual update calls** needed for tracking
5. **Changes are NOT persisted until saveChanges() is called**

### Key Concepts

- **Proxy Entities**: All entities returned from queries are proxy objects that track changes
- **Change Detection**: Property modifications are automatically detected and recorded
- **Batch Persistence**: Multiple changes are saved together with `saveChanges()`
- **Memory Management**: Changes exist in memory until explicitly persisted
- **Rollback Support**: Changes can be discarded before saving

## API Patterns

### Async Methods

Routier provides both synchronous and asynchronous methods. The async methods (`addAsync()`, `removeAsync()`, etc.) are recommended for most use cases as they provide cleaner error handling and better performance.

### Callback Pattern

For advanced scenarios, Routier supports callback-based operations using a discriminated union result pattern:

- **Success**: `{ ok: "success", data: T }`
- **Error**: `{ ok: "error", error: any }`

### Type Safety

- **Schema-driven types** with automatic TypeScript inference
- **Compile-time validation** through TypeScript's type system
- **Runtime type checking** available through schema validation
- **Generic support** for custom entity types

## Next Steps

- [Data Manipulation](../../guides/data-manipulation) - Learn about proxy-based updates and array/object manipulation
- [Create Operations](create.md) - Learn how to add new entities with detailed examples
- [Read Operations](read.md) - Learn how to query and retrieve data with advanced filtering
- [Update Operations](update.md) - Learn how to modify existing entities with change tracking
- [Delete Operations](delete.md) - Learn how to remove entities safely and efficiently
- [Bulk Operations](bulk/README.md) - Learn how to handle multiple entities efficiently
