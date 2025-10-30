---
title: Built-in Plugins
layout: default
parent: Integrations
has_children: true
nav_order: 1
permalink: /integrations/plugins/built-in-plugins/
---

## Built-in Plugins

Routier provides several built-in storage plugins to get you started quickly.

## Quick Navigation

- [Overview](#overview)
- [Installation](#installation)
- [Creating Your Own Plugin](#creating-your-own-plugin)

## Overview

Each plugin provides storage capabilities for different environments:

- **Memory**: Fast in-memory storage for testing and prototyping
- **Local Storage**: Persistent browser storage
- **File System**: File-based storage for Node.js environments
- **Dexie**: IndexedDB wrapper with advanced querying
- **SQLite**: SQL database for desktop and server applications
- **PouchDB**: Sync-enabled NoSQL database

## Installation

Install the plugins you need:

```bash
npm install @routier/memory-plugin
npm install @routier/local-storage-plugin
npm install @routier/file-system-plugin
npm install @routier/dexie-plugin
npm install @routier/sqlite-plugin
npm install @routier/pouchdb-plugin
```

## Creating Your Own Plugin

Creating a custom plugin is straightforward—implement the `IDbPlugin` interface from `@routier/core/plugins`. The interface requires three methods: `query`, `bulkPersist`, and `destroy`.

### Implementing the Interface

```ts
import {
  IDbPlugin,
  DbPluginQueryEvent,
  DbPluginBulkPersistEvent,
  DbPluginEvent,
} from "@routier/core/plugins";
import {
  PluginEventCallbackResult,
  PluginEventCallbackPartialResult,
  PluginEventResult,
} from "@routier/core/results";
import { BulkPersistResult } from "@routier/core/collections";

export class MyCustomPlugin implements IDbPlugin {
  private options: any;

  constructor(options: any) {
    this.options = options;
  }

  query<TRoot extends {}, TShape>(
    event: DbPluginQueryEvent<TRoot, TShape>,
    done: PluginEventCallbackResult<TShape>
  ): void {
    // Translate event.operation to your backend's query format
    // Execute the query and call done with results
    done(PluginEventResult.success(event.id, results));
  }

  bulkPersist(
    event: DbPluginBulkPersistEvent,
    done: PluginEventCallbackPartialResult<BulkPersistResult>
  ): void {
    // event.operation contains ALL collections/views with changes
    // You decide how to handle each schema's adds/updates/removes
    const result = event.operation.toResult();

    for (const [schemaId, changes] of event.operation) {
      // Iterate through each schema's changes
      const { adds, updates, removes, hasItems } = changes;
      if (!hasItems) continue;

      // Get schema for this collection
      const schema = event.schemas.get(schemaId);

      // Process adds, updates, removes for this schema
    }

    done(PluginEventResult.success(event.id, result));
  }

  destroy(event: DbPluginEvent, done: PluginEventCallbackResult<never>): void {
    // Clean up resources, close connections
    done(PluginEventResult.success(event.id));
  }
}
```

### Important Considerations

#### Query Translation

The `query` method receives `event.operation` which contains a Routier query with filters, sorts, pagination, etc. You need to translate this into your backend's query format:

- **Filters**: `event.operation.options` contains filter expressions that need translation
- **Sorting**: Extract sort operations from `event.operation.options`
- **Pagination**: Handle `skip` and `take` options
- **Field Selection**: Support `map` operations for field selection
- **Aggregations**: Translate `count`, `min`, `max`, `sum`, etc. to your backend

For SQL backends, Routier provides `SqlTranslator` to help translate results back to entities. Consider using helper utilities similar to `buildFromQueryOperation` used in the SQLite plugin.

#### Bulk Persist Iteration

The `bulkPersist` method receives **all collections and views** that have changes:

```ts
for (const [schemaId, changes] of event.operation) {
  // schemaId is the schema identifier
  // changes contains adds, updates, removes for this schema

  const schema = event.schemas.get(schemaId);
  const { adds, updates, removes, hasItems } = changes;

  // hasItems tells you if there are any changes to process
  if (!hasItems) continue;

  // Process adds, updates, removes as needed
  // Note: removes are typically executed first when updating
  // the same collection (to avoid constraint violations)
}
```

#### Schema Information

Access schema metadata via `event.schemas.get(schemaId)` to get:

- Collection name: `schema.collectionName`
- Properties: `schema.properties` (keys, identities, indexes, distinct constraints)
- Identity properties: Properties marked with `.key().identity()`
- Indexed properties: Properties marked with `.index()`

#### Indexes and Table Creation

**Plugins are responsible for:**

- Creating tables/collections/storage structures
- Creating indexes for properties marked with `.index()`
- Enforcing uniqueness for `.distinct()` properties
- Handling identity/auto-increment columns
- Managing schemas (collections vs views - your plugin decides)

The SQLite plugin creates tables lazily on first use, but you can create them eagerly in a setup phase.

#### Result Handling

For `query`: Return entities matching the query shape. Routier handles change tracking automatically.

For `bulkPersist`: You must populate the result object returned by `event.operation.toResult()`. After persisting, update the result:

```ts
const result = event.operation.toResult();

// After persisting adds
const { adds } = result.get(schemaId);
adds.push(...persistedEntities);

// Similar for updates and removes
```

#### Single Collection Datastores

If your backend uses a single physical collection for all entities (like PouchDB), you need a way to separate entities by collection. Add a tracked computed property to schemas that stores the collection name:

```ts
.modify(x => ({
  documentType: x.computed((_, collectionName) => collectionName).tracked()
}))
```

Then filter by `documentType` when querying to ensure collections don't collide.

### Complete Example

See the [SQLite plugin implementation](https://github.com/agrejus/routier/blob/main/plugins/sqlite/src/SqliteDbPlugin.ts) for a complete reference showing:

- Query translation
- Bulk persist iteration
- Table creation and schema management
- Transaction handling
- Error handling

## Related

- [Create Your Own Plugin](../create-your-own/) - Detailed guide with more examples
