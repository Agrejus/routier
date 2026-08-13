---
title: API Reference
---

# API Reference

Complete API documentation for Routier packages. This page provides an overview of the main APIs available in each package.

## Quick Navigation

- [@routier/datastore](#routierdatastore)
- [@routier/core](#routiercore)
- [@routier/react](#routierreact)
- [Schema API](#schema-api)
- [Query API](#query-api)

## @routier/datastore

The main package for creating data stores and managing collections.

### DataStore

The primary class for managing collections and data persistence.

**Import:**


<<< @/_snippets/code/from-docs/api/index/block-1.ts


**Main Methods:**

- `constructor(dbPlugin: IDbPlugin)` - Creates a new DataStore instance
- `collection(schema)` - Returns a collection builder (protected, used in subclasses)
- `view(schema)` - Returns a view builder (protected, used in subclasses)
- `saveAsync()` - Persists all pending changes
- `save(done)` - Persists all pending changes (callback)
- `hasChanges()` - Checks if there are unsaved changes
- `dispose()` - Cleans up resources

### Collection

Represents a collection of entities with full CRUD operations.

**Import:**


<<< @/_snippets/code/from-docs/api/index/block-2.ts


**Main Methods:**

**Query Operations:**

- `where(expression, params?)` - Filter entities
- `sort(selector)` - Sort ascending
- `sortDescending(selector)` - Sort descending
- `skip(amount)` - Skip n entities
- `take(amount)` - Limit to n entities
- `toArray(done)` - Get all results (callback)
- `toArrayAsync()` - Get all results (Promise)
- `first(expression?, done)` - Get first entity (callback)
- `firstAsync(expression?)` - Get first entity (Promise)
- `subscribe()` - Create a live query subscription
- `toQueryable()` - Convert to QueryableAsync for dynamic queries

**Modification Operations:**

- `add(...entities)` - Add entities (returns entities)
- `addAsync(...entities)` - Add entities (returns Promise)
- `instance(...entities)` - Create entity instances for change tracking
- `remove(...entities)` - Remove entities
- `removeAsync(...entities)` - Remove entities (Promise)

**Change Tracking:**

- `hasChanges()` - Check if collection has unsaved changes
- `tags.get()` - Get all tag values
- `tags.destroy()` - Destroy all tags
- `tag(value)` - Create or get a tag for tracking changes
- `attachments.set(...entities)` - Attach entities to change tracking
- `attachments.remove(...entities)` - Detach entities from change tracking
- `attachments.has(entity)` - Check if entity is attached
- `attachments.get(entity)` - Get attached entity
- `attachments.filter(selector)` - Filter attached entities
- `attachments.find(selector)` - Find attached entity
- `attachments.markDirty(...entities)` - Force mark entities as dirty
- `attachments.getChangeType(entity)` - Get change type for entity

## @routier/core

Core utilities, schema definitions, and shared types.

### Schema API (`@routier/core/schema`)

**Import:**


<<< @/_snippets/code/from-docs/api/index/block-3.ts


**Schema Builder:**

- `s.define(name, properties)` - Define a new schema
- `s.string()` - String property type
- `s.number()` - Number property type
- `s.boolean()` - Boolean property type
- `s.date()` - Date property type
- `s.object({ ... })` - Object property type
- `s.array(type)` - Array property type

**Property Modifiers:**

- `.key()` - Mark as primary key
- `.identity()` - Auto-generate identity value
- `.distinct()` - Ensure unique values
- `.default(value)` - Default value
- `.optional()` - Make optional
- `.nullable()` - Allow null
- `.index()` - Create index for querying
- `.tracked()` - Track changes to this property

**Schema Modifiers:**

- `.modify(w => ({ ... }))` - Add computed/function properties
- `.compile()` - Compile schema to use with collections

**Type Utilities:**

- `InferType<typeof schema>` - Extract entity type from schema
- `InferCreateType<typeof schema>` - Extract creation type (excludes identities/defaults)

### Query API

**Filtering:**


<<< @/_snippets/code/from-docs/api/index/block-4.ts


**Sorting:**


<<< @/_snippets/code/from-docs/api/index/block-5.ts


**Pagination:**


<<< @/_snippets/code/from-docs/api/index/block-6.ts


**Terminal Operations:**


<<< @/_snippets/code/from-docs/api/index/block-7.ts


## @routier/react

React integration hooks for Routier.

### useQuery

React hook for subscribing to live queries.

**Import:**


<<< @/_snippets/code/from-docs/api/index/block-8.ts


**Signature:**


<<< @/_snippets/code/from-docs/api/index/block-9.ts


**Return Type:**


<<< @/_snippets/code/from-docs/api/index/block-10.ts


**Usage:**


<<< @/_snippets/code/from-docs/api/index/block-11.ts


## Core Utilities

### Results (`@routier/core/results`)

- `Result.SUCCESS` - Success result code
- `Result.ERROR` - Error result code
- `Result.success<T>(data)` - Create success result
- `Result.error(error)` - Create error result

### Plugins (`@routier/core/plugins`)

- `IDbPlugin` - Interface for database plugins
- `QueryOptionsCollection<T>` - Query options configuration

## Detailed API Reference

Complete auto-generated API documentation with full type signatures, method parameters, return types, and detailed descriptions is available:

- **[Complete API Reference](/reference/api/README)** - Full generated documentation index
- **[@routier/datastore API](/reference/api/datastore/src/README)** - DataStore and Collection classes
- **[@routier/core API](/reference/api/core/src/README)** - Schema, utilities, and core functionality
- **[@routier/react API](/reference/api/react/src/README)** - React hooks

### Key API Classes

**@routier/datastore:**

- [DataStore](/reference/api/datastore/src/classes/DataStore) - Main data store class
- [Collection](/reference/api/datastore/src/classes/Collection) - Collection class with query and CRUD operations

**@routier/core:**

- Schema builders: [SchemaString](/reference/api/core/src/classes/SchemaString), [SchemaNumber](/reference/api/core/src/classes/SchemaNumber), [SchemaObject](/reference/api/core/src/classes/SchemaObject), etc.
- [s](/reference/api/core/src/variables/s) - Schema builder variable
- [Result](/reference/api/core/src/classes/Result) - Result type for operations
- [IDbPlugin](/reference/api/core/src/interfaces/IDbPlugin) - Database plugin interface

**@routier/react:**

- [useQuery](/reference/api/react/src/functions/useQuery) - React hook for live queries

## Related

- [Getting Started Guide](/getting-started/overview)
- [Schema Concepts](/concepts/schema/)
- [Query Concepts](/concepts/queries/)
- [Live Queries Guide](/guides/live-queries)
