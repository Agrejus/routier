---
title: API Reference
layout: default
nav_order: 10
permalink: /api/
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

```typescript
import { DataStore } from "@routier/datastore";
```

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

```typescript
import { Collection } from "@routier/datastore";
```

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

```typescript
import { s, InferType, InferCreateType } from "@routier/core/schema";
```

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

```typescript
collection.where((entity) => entity.field === value);
collection.where(([entity, params]) => entity.field === params.value, {
  value,
});
```

**Sorting:**

```typescript
collection.sort((entity) => entity.field);
collection.sortDescending((entity) => entity.field);
```

**Pagination:**

```typescript
collection.skip(10).take(20);
```

**Terminal Operations:**

```typescript
await collection.toArrayAsync();
await collection.firstAsync();
collection.subscribe().toArray(callback);
```

## @routier/react

React integration hooks for Routier.

### useQuery

React hook for subscribing to live queries.

**Import:**

```typescript
import { useQuery } from "@routier/react";
```

**Signature:**

```typescript
function useQuery<T>(
  query: (callback: (result: ResultType<T>) => void) => void | (() => void),
  deps: any[] = []
): LiveQueryState<T>;
```

**Return Type:**

```typescript
type LiveQueryState<T> =
  | { status: "pending"; loading: true; error: null; data: undefined }
  | { status: "error"; loading: false; error: Error; data: undefined }
  | { status: "success"; loading: false; error: null; data: T };
```

**Usage:**

```typescript
const products = useQuery(
  c => dataStore.products.subscribe().toArray(c),
  [dataStore]
);

if (products.status === "loading") return <div>Loading...</div>;
if (products.status === "error") return <div>Error: {products.error.message}</div>;
return <div>{products.data.map(...)}</div>;
```

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

- **[Complete API Reference]({{ site.baseurl }}/reference/api/)** - Full generated documentation index
- **[@routier/datastore API]({{ site.baseurl }}/reference/api/datastore/src/README.md)** - DataStore and Collection classes
- **[@routier/core API]({{ site.baseurl }}/reference/api/core/src/README.md)** - Schema, utilities, and core functionality
- **[@routier/react API]({{ site.baseurl }}/reference/api/react/src/README.md)** - React hooks

### Key API Classes

**@routier/datastore:**

- [DataStore]({{ site.baseurl }}/reference/api/datastore/src/classes/DataStore.md) - Main data store class
- [Collection]({{ site.baseurl }}/reference/api/datastore/src/classes/Collection.md) - Collection class with query and CRUD operations

**@routier/core:**

- Schema builders: [SchemaString]({{ site.baseurl }}/reference/api/core/src/classes/SchemaString.md), [SchemaNumber]({{ site.baseurl }}/reference/api/core/src/classes/SchemaNumber.md), [SchemaObject]({{ site.baseurl }}/reference/api/core/src/classes/SchemaObject.md), etc.
- [s]({{ site.baseurl }}/reference/api/core/src/variables/s.md) - Schema builder variable
- [Result]({{ site.baseurl }}/reference/api/core/src/classes/Result.md) - Result type for operations
- [IDbPlugin]({{ site.baseurl }}/reference/api/core/src/interfaces/IDbPlugin.md) - Database plugin interface

**@routier/react:**

- [useQuery]({{ site.baseurl }}/reference/api/react/src/functions/useQuery.md) - React hook for live queries

## Related

- [Getting Started Guide]({{ site.baseurl }}/getting-started/overview)
- [Schema Concepts]({{ site.baseurl }}/concepts/schema/)
- [Query Concepts]({{ site.baseurl }}/concepts/queries/)
- [Live Queries Guide]({{ site.baseurl }}/guides/live-queries)
